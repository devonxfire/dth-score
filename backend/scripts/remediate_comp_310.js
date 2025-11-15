const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function normalizeName(s) {
  if (!s && s !== 0) return '';
  try {
    return String(s)
      .normalize('NFKD')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/''/g, "'")
      .replace(/["()\[\]{}]/g, '')
      .replace(/[^\w\s\-']/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  } catch (e) {
    return String(s || '').trim().toLowerCase();
  }
}

async function main() {
  const compId = Number(process.argv[2] || 310);
  if (!compId) {
    console.error('Usage: node remediate_comp_310.js <competitionId>');
    process.exit(1);
  }

  console.log('Remediation start for competition', compId);

  const comp = await prisma.competitions.findUnique({ where: { id: compId } });
  if (!comp) {
    console.error('Competition not found:', compId);
    process.exit(1);
  }

  const groups = Array.isArray(comp.groups) ? comp.groups : (comp.groups || []);
  if (!groups || groups.length === 0) {
    console.error('No groups found for competition', compId);
    process.exit(1);
  }

  // Load all users into memory and build normalized index
  const users = await prisma.users.findMany();
  const usersByNorm = {};
  users.forEach(u => {
    const n = normalizeName(u.name || '');
    if (!usersByNorm[n]) usersByNorm[n] = [];
    usersByNorm[n].push(u);
  });

  // Helper to find best user for a player name
  function findUserByName(name) {
    if (!name) return null;
    const n = normalizeName(name);
    if (usersByNorm[n] && usersByNorm[n].length > 0) return usersByNorm[n][0];
    // try last-name match
    const parts = (n || '').split(' ').filter(Boolean);
    const last = parts.length > 0 ? parts[parts.length - 1] : '';
    if (last) {
      for (const key of Object.keys(usersByNorm)) {
        if (key.includes(last)) return usersByNorm[key][0];
      }
    }
    return null;
  }

  // For each group create teams (split 4-player into two 2-player teams)
  const createdTeams = [];

  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const players = Array.isArray(g.players) ? g.players.slice() : [];
    if (players.length === 0) continue;

    // If 4-player and no teamIds, create two teams
    if (players.length === 4) {
      const pairs = [players.slice(0,2), players.slice(2,4)];
      g.teamIds = g.teamIds || [];
      for (const pair of pairs) {
        // create team
        const teamName = pair.join(' / ');
        const team = await prisma.teams.create({ data: { competition_id: compId, name: teamName, players: pair } });
        createdTeams.push(team);

        // create teams_users rows
        for (const pname of pair) {
          const user = findUserByName(pname);
          let userId = null;
          if (user) userId = user.id;

          // attempt to find latest historical teams_users for that user to copy CH/teebox
          let historical = null;
          if (userId) {
            historical = await prisma.teams_users.findFirst({ where: { user_id: userId, course_handicap: { not: null } }, orderBy: { id: 'desc' } });
          }

          const ch = historical ? historical.course_handicap : null;
          const teebox = historical ? historical.teebox : null;

          await prisma.teams_users.create({ data: { team_id: team.id, user_id: userId, course_handicap: ch, teebox } });
        }

        g.teamIds.push(team.id);
      }
    } else {
      // non-4 player groups: create a single team
      const teamName = players.join(' / ');
      const team = await prisma.teams.create({ data: { competition_id: compId, name: teamName, players } });
      createdTeams.push(team);
      g.teamId = team.id;
      g.teamIds = g.teamIds || [team.id];

      for (const pname of players) {
        const user = findUserByName(pname);
        const userId = user ? user.id : null;
        let historical = null;
        if (userId) {
          historical = await prisma.teams_users.findFirst({ where: { user_id: userId, course_handicap: { not: null } }, orderBy: { id: 'desc' } });
        }
        const ch = historical ? historical.course_handicap : null;
        const teebox = historical ? historical.teebox : null;
        await prisma.teams_users.create({ data: { team_id: team.id, user_id: userId, course_handicap: ch, teebox } });
      }
    }
  }

  // After creating teams/users, fetch teams_users for this competition's teams and build group.handicaps
  const teamIds = createdTeams.map(t => t.id);
  const tus = await prisma.teams_users.findMany({ where: { team_id: { in: teamIds } }, include: { users: true, teams: true } });

  // Build a map teamId -> { playerName -> course_handicap }
  const teamHandicaps = {};
  tus.forEach(r => {
    const team = r.team_id;
    const userName = r.users?.name || null;
    if (!teamHandicaps[team]) teamHandicaps[team] = {};
    if (userName) teamHandicaps[team][userName] = r.course_handicap;
  });

  // Now update competition.groups to include handicaps mapping per group player name
  const updatedGroups = groups.map(g => {
    const handicaps = {};
    const players = Array.isArray(g.players) ? g.players : [];
    const gids = Array.isArray(g.teamIds) ? g.teamIds : (g.teamId ? [g.teamId] : []);
    // For each player, try to find CH from any of the group's teamIds
    players.forEach(pname => {
      let found = null;
      for (const tid of gids) {
        const map = teamHandicaps[tid] || {};
        // attempt exact match first
        if (map[pname] != null) { found = map[pname]; break; }
        // try normalized keys
        const normP = normalizeName(pname);
        for (const k of Object.keys(map)) {
          if (normalizeName(k) === normP) { found = map[k]; break; }
        }
        if (found != null) break;
      }
      handicaps[pname] = found != null ? found : null;
    });
    return { ...g, handicaps };
  });

  await prisma.competitions.update({ where: { id: compId }, data: { groups: updatedGroups } });

  console.log('Remediation completed. Created teams:', createdTeams.map(t => ({ id: t.id, name: t.name }))); 
  console.log('Updated competition.groups with handicaps for competition', compId);

  await prisma.$disconnect();
}

main().catch(err => { console.error(err); prisma.$disconnect(); process.exit(1); });
