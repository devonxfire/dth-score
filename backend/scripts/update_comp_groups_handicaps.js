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
  console.log('Update handicaps for competition', compId);
  const comp = await prisma.competitions.findUnique({ where: { id: compId } });
  if (!comp) { console.error('Competition not found'); process.exit(1); }
  const groups = Array.isArray(comp.groups) ? comp.groups : [];

  // collect all teamIds referenced in groups
  const teamIds = new Set();
  groups.forEach(g => {
    if (Array.isArray(g.teamIds)) g.teamIds.forEach(t => teamIds.add(t));
    if (g.teamId) teamIds.add(g.teamId);
  });
  const tIds = Array.from(teamIds).filter(Boolean);
  if (tIds.length === 0) { console.log('No teamIds referenced in groups'); await prisma.$disconnect(); return; }

  const tus = await prisma.teams_users.findMany({ where: { team_id: { in: tIds } }, include: { users: true } });
  const mapByTeam = {};
  tus.forEach(r => {
    if (!mapByTeam[r.team_id]) mapByTeam[r.team_id] = [];
    mapByTeam[r.team_id].push(r);
  });

  const updated = groups.map(g => {
    const players = Array.isArray(g.players) ? g.players : [];
    const gids = Array.isArray(g.teamIds) ? g.teamIds : (g.teamId ? [g.teamId] : []);
    const handicaps = {};
    players.forEach(p => {
      let found = null;
      const normP = normalizeName(p);
      for (const tid of gids) {
        const rows = mapByTeam[tid] || [];
        for (const r of rows) {
          const uname = r.users?.name || '';
          if (uname === p) { found = r.course_handicap; break; }
          if (normalizeName(uname) === normP) { found = r.course_handicap; break; }
        }
        if (found != null) break;
      }
      handicaps[p] = found != null ? found : null;
    });
    return { ...g, handicaps };
  });

  await prisma.competitions.update({ where: { id: compId }, data: { groups: updated } });
  console.log('Updated competition groups handicaps for comp', compId);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
