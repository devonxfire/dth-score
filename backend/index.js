require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

const prisma = new PrismaClient();

// Helper: ensure teams exist for groups in a competition. This extracts the logic
// that used to live inside the PATCH /api/competitions/:id/groups handler so
// we can call it after creating a competition as well (automatic team creation
// for new competitions that include groups). It will create teams for 2-player
// groups and, for 4BBB competitions, create two teams for each 4-player group.
async function processGroupsForCompetition(compId, groups) {
  if (!compId || !Array.isArray(groups) || groups.length === 0) return;
  try {
    // Determine competition type (needed to know whether 4-player groups represent 4BBB teams)
    const compRow = await prisma.competitions.findUnique({ where: { id: Number(compId) } });
    const compTypeLower = (compRow?.type || '').toString().toLowerCase();
    const isFourBbb = compTypeLower.includes('4bbb') || compTypeLower.includes('fourbbb') || (!!compRow && !!compRow.fourballs);

    // Fetch all existing teams for this competition
    const existingTeams = await prisma.teams.findMany({ where: { competition_id: Number(compId) } });
    // Also prefetch any existing teams_users rows for this competition so we can
    // use them as a fallback source for course_handicap when creating new teams
    // (this mirrors what the remediation script does).
    let teamsUsersForComp = [];
    try {
      teamsUsersForComp = await prisma.teams_users.findMany({ where: { teams: { competition_id: Number(compId) } }, include: { users: true, teams: true } });
    } catch (e) {
      // non-fatal: we'll attempt other fallbacks if this fetch fails
      teamsUsersForComp = [];
    }
    // Prefetch all users once and build a normalized lookup to allow tolerant name matching
    let usersList = [];
    const usersByNorm = {};
    function normalizeNameForMatch(n) {
      if (!n && n !== 0) return '';
      try {
        return String(n)
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
        return (n || '').toString().trim().toLowerCase();
      }
    }
    try {
      usersList = await prisma.users.findMany();
      for (const u of usersList || []) {
        const candidates = [];
        if (u.name) candidates.push(u.name);
        if (u.displayName) candidates.push(u.displayName);
        if (u.display_name) candidates.push(u.display_name);
        if (u.displayname) candidates.push(u.displayname);
        if (u.nick) candidates.push(u.nick);
        if (u.nickname) candidates.push(u.nickname);
        for (const c of candidates) {
          if (!c) continue;
          const k = normalizeNameForMatch(c);
          if (!k) continue;
          usersByNorm[k] = usersByNorm[k] || u;
        }
        // also index raw name
        const rawk = normalizeNameForMatch(u.name);
        if (rawk) usersByNorm[rawk] = usersByNorm[rawk] || u;
      }
    } catch (e) {
      usersList = [];
    }
    // Map of team key (sorted normalized player names) to team object
    const teamKey = (players) => players.map(p => normalizeNameForMatch(p)).sort().join('|');
    const existingTeamMap = {};
    for (const team of existingTeams) {
      if (Array.isArray(team.players)) {
        existingTeamMap[teamKey(team.players)] = team;
      }
    }

    // Helper to ensure a team exists for a pair of players
    async function ensureTeamForPair(pairPlayers, pairLabel, group, i, existingTeamsLocal) {
      if (!Array.isArray(pairPlayers) || pairPlayers.length !== 2) return null;
      const key = teamKey(pairPlayers);
      let foundTeam = existingTeamMap[key];
      if (foundTeam) return foundTeam;
      // Find the most similar old team (max overlap)
      let bestMatch = null;
      let bestOverlap = 0;
      for (const oldTeam of existingTeamsLocal) {
        if (!Array.isArray(oldTeam.players)) continue;
        const overlap = oldTeam.players.filter(p => pairPlayers.includes(p)).length;
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestMatch = oldTeam;
        }
      }
      // Create new team for this pair
      foundTeam = await prisma.teams.create({
        data: {
          competition_id: Number(compId),
          name: group && group.name ? `${group.name} ${pairLabel}` : `Group ${i + 1} ${pairLabel}`,
          players: pairPlayers
        }
      });
      // write team id back to supplied group object so callers (and subsequent GETs)
      // can see the team association immediately without waiting for name-based lookup
      try { if (group) { group.teamIds = group.teamIds || []; group.teamIds[pairLabel === 'A' ? 0 : 1] = foundTeam.id; } } catch (e) {}
      // Copy teams_users and scores from bestMatch if applicable
      if (bestMatch && Array.isArray(bestMatch.players)) {
        for (const player of pairPlayers) {
          if (bestMatch.players.includes(player)) {
            // tolerant user lookup using normalized index built earlier
            const pnorm = normalizeNameForMatch(player);
            let user = usersByNorm[pnorm];
            if (!user) {
              try { user = await prisma.users.findFirst({ where: { name: player } }); } catch (e) { user = null; }
            }
            if (user) {
              const oldTU = await prisma.teams_users.findFirst({ where: { team_id: bestMatch.id, user_id: user.id } });
              if (oldTU) {
                await prisma.teams_users.create({
                  data: {
                    team_id: foundTeam.id,
                    user_id: user.id,
                    teebox: oldTU.teebox,
                    course_handicap: oldTU.course_handicap,
                    waters: oldTU.waters,
                    dog: oldTU.dog,
                    two_clubs: oldTU.two_clubs,
                    fines: oldTU.fines
                  }
                });
              }
              const oldScores = await prisma.scores.findMany({ where: { team_id: bestMatch.id, user_id: user.id, competition_id: Number(compId) } });
              for (const score of oldScores) {
                await prisma.scores.create({
                  data: {
                    competition_id: Number(compId),
                    team_id: foundTeam.id,
                    user_id: user.id,
                    hole_id: score.hole_id,
                    strokes: score.strokes
                  }
                });
              }
            }
          }
        }
      } else {
        // No best-match data to copy from: create teams_users rows for each player
        for (const player of pairPlayers) {
          // tolerant user lookup using normalized index built earlier
          const norm = normalizeNameForMatch(player);
          let user = usersByNorm[norm];
          if (!user) {
            // final fallback: try exact DB lookup by name
            try { user = await prisma.users.findFirst({ where: { name: player } }); } catch (e) { user = null; }
          }
          if (!user) continue;
          // Determine course_handicap: prefer group-provided handicaps, else any existing teams_users for this user in the comp
          let ch = undefined;
          try {
            if (group && group.handicaps && group.handicaps[player] !== undefined && group.handicaps[player] !== null && group.handicaps[player] !== '') {
              const parsed = Number(group.handicaps[player]);
              if (!isNaN(parsed)) ch = parsed;
            }
          } catch (e) {}
          if (ch === undefined) {
            // try any teams_users within this comp prefetched earlier
            const fallbackTu = teamsUsersForComp.find(tu => tu && tu.user_id === user.id && tu.course_handicap != null);
            if (fallbackTu && fallbackTu.course_handicap != null) ch = Number(fallbackTu.course_handicap);
            // Removed cross-competition fallback: handicap should default to undefined if not explicitly set
          }
          try {
            await prisma.teams_users.create({
              data: {
                team_id: foundTeam.id,
                user_id: user.id,
                teebox: (group && group.teeboxes && group.teeboxes[player]) ? group.teeboxes[player] : undefined,
                course_handicap: ch !== undefined ? ch : undefined
              }
            });
          } catch (e) {
            // ignore create errors (unique constraint or other) — non-fatal
            try { console.warn('teams_users.create warning (ignored):', e && e.message ? e.message : e); } catch (ee) {}
          }
        }
      }
      existingTeamMap[key] = foundTeam;
      return foundTeam;
    }

    // Iterate groups and create teams where necessary
    for (const [i, group] of (groups || []).entries()) {
      if (!Array.isArray(group.players) || group.players.length === 0) continue;
      // If this is a 4-player 4-ball and the competition is of 4BBB type, create/update two teams
      if (isFourBbb && Array.isArray(group.players) && group.players.length === 4) {
        const pairA = [group.players[0], group.players[1]];
        const pairB = [group.players[2], group.players[3]];
        await ensureTeamForPair(pairA, 'A', group, i, existingTeams);
        await ensureTeamForPair(pairB, 'B', group, i, existingTeams);
        continue;
      }
      // If this is a 2-player team object, preserve old behavior
          if (Array.isArray(group.players) && group.players.length === 2) {
        const key = teamKey(group.players);
        let foundTeam = existingTeamMap[key];
        if (!foundTeam) {
          // Find the most similar old team (max overlap)
          let bestMatch = null;
          let bestOverlap = 0;
          for (const oldTeam of existingTeams) {
            if (!Array.isArray(oldTeam.players)) continue;
            const overlap = oldTeam.players.filter(p => group.players.includes(p)).length;
            if (overlap > bestOverlap) {
              bestOverlap = overlap;
              bestMatch = oldTeam;
            }
          }
          // Create new team
          foundTeam = await prisma.teams.create({
            data: {
              competition_id: Number(compId),
              name: group.name || `Group ${i + 1}`,
              players: group.players
            }
          });
          // write team id back to group so GET and UI can see team association immediately
          try { if (group) group.teamId = foundTeam.id; } catch (e) {}
          // Copy teams_users and scores from bestMatch if applicable
                if (bestMatch && Array.isArray(bestMatch.players)) {
            for (const player of group.players) {
        if (bestMatch.players.includes(player)) {
          // tolerant user lookup
          const pnorm = normalizeNameForMatch(player);
          let user = usersByNorm[pnorm];
          if (!user) { try { user = await prisma.users.findFirst({ where: { name: player } }); } catch (e) { user = null; } }
          if (user) {
                  const oldTU = await prisma.teams_users.findFirst({ where: { team_id: bestMatch.id, user_id: user.id } });
                  if (oldTU) {
                    await prisma.teams_users.create({
                      data: {
                        team_id: foundTeam.id,
                        user_id: user.id,
                        teebox: oldTU.teebox,
                        course_handicap: oldTU.course_handicap,
                        waters: oldTU.waters,
                        dog: oldTU.dog,
                        two_clubs: oldTU.two_clubs,
                        fines: oldTU.fines
                      }
                    });
                  }
                  const oldScores = await prisma.scores.findMany({ where: { team_id: bestMatch.id, user_id: user.id, competition_id: Number(compId) } });
                  for (const score of oldScores) {
                    await prisma.scores.create({
                      data: {
                        competition_id: Number(compId),
                        team_id: foundTeam.id,
                        user_id: user.id,
                        hole_id: score.hole_id,
                        strokes: score.strokes
                      }
                    });
                  }
                }
              }
            }
                } else {
                  // No bestMatch: create teams_users rows using any provided group.handicaps or fallbacks
                  for (const player of group.players) {
                    // tolerant lookup
                    const pnorm = normalizeNameForMatch(player);
                    let user = usersByNorm[pnorm];
                    if (!user) { try { user = await prisma.users.findFirst({ where: { name: player } }); } catch (e) { user = null; } }
                    if (!user) continue;
                    let ch = undefined;
                    try {
                      if (group && group.handicaps && group.handicaps[player] !== undefined && group.handicaps[player] !== null && group.handicaps[player] !== '') {
                        const parsed = Number(group.handicaps[player]);
                        if (!isNaN(parsed)) ch = parsed;
                      }
                    } catch (e) {}
                    if (ch === undefined) {
                      const fallbackTu = teamsUsersForComp.find(tu => tu && tu.user_id === user.id && tu.course_handicap != null);
                      if (fallbackTu && fallbackTu.course_handicap != null) ch = Number(fallbackTu.course_handicap);
                    }
                    try {
                      await prisma.teams_users.create({ data: { team_id: foundTeam.id, user_id: user.id, teebox: (group && group.teeboxes && group.teeboxes[player]) ? group.teeboxes[player] : undefined, course_handicap: ch !== undefined ? ch : undefined } });
                    } catch (e) {
                      try { console.warn('teams_users.create warning (ignored):', e && e.message ? e.message : e); } catch (ee) {}
                    }
                  }
                }
          existingTeamMap[key] = foundTeam;
        }
      }
      // Other sizes: skip
    }
    // After creating teams and teams_users, fetch latest teams_users for this competition
    try {
      const allTeams = await prisma.teams.findMany({ where: { competition_id: Number(compId) } });
      const teamIds = (allTeams || []).map(t => t.id).filter(Boolean);
      let allTeamUsers = [];
      if (teamIds.length > 0) {
        allTeamUsers = await prisma.teams_users.findMany({ where: { team_id: { in: teamIds } }, include: { users: true, teams: true } });
      }
      // Build handicaps map back onto the groups array so the saved competition reflects course_handicap
      for (const group of (groups || [])) {
        try {
          if (!group || !Array.isArray(group.players)) continue;
          group.handicaps = group.handicaps || {};
          group.teeboxes = group.teeboxes || {};
          for (const player of group.players) {
            // look for teams_users rows matching player name within any of the group's teams (teamIds or teamId)
            const norm = normalizeNameForMatch(player);
            let match = null;
            if (Array.isArray(group.teamIds) && group.teamIds.length > 0) {
              match = allTeamUsers.find(tu => tu && tu.team_id && group.teamIds.includes(tu.team_id) && tu.users && normalizeNameForMatch(tu.users.name) === norm);
            }
            if (!match && (group.teamId || group.id || group.team_id || group.group_id)) {
              const tId = group.teamId || group.id || group.team_id || group.group_id;
              match = allTeamUsers.find(tu => tu && tu.team_id === tId && tu.users && normalizeNameForMatch(tu.users.name) === norm);
            }
            // final fallback: any teams_users in this competition matching by name
            if (!match) {
              match = allTeamUsers.find(tu => tu && tu.users && normalizeNameForMatch(tu.users.name) === norm && tu.course_handicap != null);
            }
            if (match && match.course_handicap != null) {
              group.handicaps[player] = match.course_handicap;
            }
            if (match && match.teebox) {
              group.teeboxes[player] = match.teebox;
            }
          }
        } catch (e) { /* ignore per-group errors */ }
      }
      // Persist enriched groups back to competitions table so GET /api/competitions/:id returns handicaps immediately
      try {
        await prisma.competitions.update({ where: { id: Number(compId) }, data: { groups } });
      } catch (e) { console.warn('Failed to persist enriched groups with handicaps', e && e.message ? e.message : e); }
    } catch (e) {
      // ignore enrichment errors
      try { console.warn('processGroupsForCompetition enrichment warning', e && e.message ? e.message : e); } catch (ee) {}
    }
  } catch (e) {
    console.error('processGroupsForCompetition error', e);
  }
}

// Refresh the competitions.groups handicaps/teeboxes from the latest teams_users rows
// This is a lightweight update used after teams_users rows change (so the UI shows
// the updated CH immediately without waiting for a manual groups save).
async function refreshCompetitionGroupsFromTeamsUsers(compId) {
  if (!compId) return;
  try {
    const comp = await prisma.competitions.findUnique({ where: { id: Number(compId) } });
    if (!comp || !Array.isArray(comp.groups) || comp.groups.length === 0) return;
    // small normalizer (copied logic to be robust)
    function normalizeNameForMatch(n) {
      if (!n && n !== 0) return '';
      try {
        return String(n)
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
        return (n || '').toString().trim().toLowerCase();
      }
    }
    const allTeams = await prisma.teams.findMany({ where: { competition_id: Number(compId) } });
    const teamIds = (allTeams || []).map(t => t.id).filter(Boolean);
    let allTeamUsers = [];
    if (teamIds.length > 0) {
      allTeamUsers = await prisma.teams_users.findMany({ where: { team_id: { in: teamIds } }, include: { users: true } });
    }
    const groups = JSON.parse(JSON.stringify(comp.groups || []));
    for (const group of groups) {
      try {
        if (!group || !Array.isArray(group.players)) continue;
        group.handicaps = group.handicaps || {};
        group.teeboxes = group.teeboxes || {};
        for (const player of group.players) {
          const norm = normalizeNameForMatch(player);
          let match = null;
          if (Array.isArray(group.teamIds) && group.teamIds.length > 0) {
            match = allTeamUsers.find(tu => tu && tu.team_id && group.teamIds.includes(tu.team_id) && tu.users && normalizeNameForMatch(tu.users.name) === norm);
          }
          if (!match && (group.teamId || group.id || group.team_id || group.group_id)) {
            const tId = group.teamId || group.id || group.team_id || group.group_id;
            match = allTeamUsers.find(tu => tu && tu.team_id === tId && tu.users && normalizeNameForMatch(tu.users.name) === norm);
          }
          if (!match) {
            match = allTeamUsers.find(tu => tu && tu.users && normalizeNameForMatch(tu.users.name) === norm && tu.course_handicap != null);
          }
          if (match && match.course_handicap != null) group.handicaps[player] = match.course_handicap;
          if (match && match.teebox) group.teeboxes[player] = match.teebox;
        }
      } catch (e) { /* ignore per-group errors */ }
    }
    try {
      await prisma.competitions.update({ where: { id: Number(compId) }, data: { groups } });
    } catch (e) { console.warn('refreshCompetitionGroupsFromTeamsUsers: failed to persist groups', e && e.message ? e.message : e); }
  } catch (e) {
    console.warn('refreshCompetitionGroupsFromTeamsUsers error', e && e.message ? e.message : e);
  }
}

// Simple event id generator
function makeEventId() {
  return Math.random().toString(36).slice(2, 8) + '-' + Date.now().toString(36);
}

// In-memory signature dedupe with short TTL to avoid rapid duplicate emits
const _popupSigDedupe = new Map(); // sig -> ts
function popupSignatureSeen(sig, ttl = 10000) {
  if (!sig) return false;
  try {
    const now = Date.now();
    const prev = _popupSigDedupe.get(sig);
    if (prev && (now - prev) < ttl) return true;
    _popupSigDedupe.set(sig, now);
    setTimeout(() => { try { _popupSigDedupe.delete(sig); } catch (e) {} }, ttl + 50);
    return false;
  } catch (e) { return false; }
}

// Get all teams for a competition (for leaderboard)
app.get('/api/teams', async (req, res) => {
  const { competitionId } = req.query;
  if (!competitionId) return res.status(400).json({ error: 'competitionId required' });
  try {
    const teams = await prisma.teams.findMany({
      where: { competition_id: Number(competitionId) },
      select: {
        id: true,
        players: true,
        team_points: true
      }
    });
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/', (req, res) => {
  res.send('Backend is running!');
});

      
app.patch('/api/competitions/:id/groups', async (req, res) => {
  const { id } = req.params;
  const { groups } = req.body;
  if (!groups) {
    return res.status(400).json({ error: 'Groups data required' });
  }
  const compId = Number(id);
  if (!compId || isNaN(compId)) {
    return res.status(400).json({ error: 'Competition id required and must be a valid integer.' });
  }
  try {
    // Fetch existing competition so we can preserve per-player data (scores, teeboxes, handicaps, waters, dog, two_clubs, fines, displayNames)
    const existingComp = await prisma.competitions.findUnique({ where: { id: compId } });
    const existingGroups = Array.isArray(existingComp?.groups) ? existingComp.groups : [];

    // Best-match merging: for each incoming group, find the existing group with the highest player overlap
    const mappingProps = ['scores', 'teeboxes', 'handicaps', 'waters', 'dog', 'two_clubs', 'fines'];
    function normalizeName(n) {
      return (n || '').toString().trim().toLowerCase();
    }

    const usedExisting = new Array(existingGroups.length).fill(false);
    const groupsToSave = (Array.isArray(groups) ? groups : []).map((newG) => {
      const incomingPlayers = Array.isArray(newG.players) ? newG.players.filter(Boolean) : [];
      // find best matching existing group by normalized player overlap
      let bestIdx = -1;
      let bestOverlap = 0;
      for (let j = 0; j < existingGroups.length; j++) {
        const eg = existingGroups[j];
        if (!eg || !Array.isArray(eg.players)) continue;
        const overlap = eg.players.filter(p => incomingPlayers.some(ip => normalizeName(ip) === normalizeName(p))).length;
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestIdx = j;
        }
      }

      // Start from a copy of the best-matching existing group if found, otherwise from a fresh base
      let base = { players: incomingPlayers };
      if (bestIdx !== -1 && existingGroups[bestIdx]) {
        base = JSON.parse(JSON.stringify(existingGroups[bestIdx]));
      }

      const merged = Object.assign({}, base);
      // Replace players array with incoming order
      merged.players = Array.isArray(newG.players) ? newG.players : merged.players || [];

      // Ensure mapping props exist and preserve values for players that remain from base
      // Use normalized name matching to avoid punctuation/spacing mismatches and re-key maps
      const baseNameLookup = {};
      if (base && Array.isArray(base.players)) {
        for (const bp of base.players) {
          if (!bp) continue;
          baseNameLookup[normalizeName(bp)] = bp;
        }
      }
      for (const prop of mappingProps) {
        const incomingMap = (newG && newG[prop] && typeof newG[prop] === 'object') ? newG[prop] : {};
        const baseMap = (base && base[prop] && typeof base[prop] === 'object') ? base[prop] : {};
        const newMap = {};
        for (const p of merged.players) {
          if (!p) continue;
          // incoming override (keyed by incoming player name) takes precedence
          if (incomingMap && incomingMap[p] !== undefined) {
            newMap[p] = incomingMap[p];
            continue;
          }
          // otherwise try to find a base key that matches this player by normalized name
          const key = baseNameLookup[normalizeName(p)];
          if (key !== undefined && baseMap && baseMap[key] !== undefined) {
            // copy deep-ish
            try {
              newMap[p] = JSON.parse(JSON.stringify(baseMap[key]));
            } catch (e) {
              newMap[p] = baseMap[key];
            }
          }
        }
        merged[prop] = newMap;
      }

      // Handle displayNames (positional array). Prefer incoming, else try to keep base mapping by matching names
      if (Array.isArray(newG.displayNames) && newG.displayNames.length > 0) {
        merged.displayNames = newG.displayNames.slice();
      } else if (Array.isArray(base.displayNames) && Array.isArray(base.players)) {
        // map base displayNames to new positions by name
        merged.displayNames = Array(merged.players.length).fill('');
        for (let idx = 0; idx < merged.players.length; idx++) {
          const name = merged.players[idx];
          const baseIdx = base.players ? base.players.findIndex(p => normalizeName(p) === normalizeName(name)) : -1;
          if (baseIdx >= 0 && base.displayNames && base.displayNames[baseIdx] !== undefined) merged.displayNames[idx] = base.displayNames[baseIdx];
        }
      } else {
        merged.displayNames = Array(merged.players.length).fill('');
      }

      // Apply other top-level fields from incoming (teeTime, name, etc.) - incoming should override base
      if (newG.teeTime !== undefined) merged.teeTime = newG.teeTime;
      if (newG.name !== undefined) merged.name = newG.name;
      if (newG.groupIndex !== undefined) merged.groupIndex = newG.groupIndex;

      return merged;
    });

    // Save merged groups to competitions table
    try {
      console.log('groupsToSave debug:', JSON.stringify(groupsToSave, null, 2));
    } catch (e) {}
    const updated = await prisma.competitions.update({
      where: { id: compId },
      data: { groups: groupsToSave },
    });

    // Reuse shared helper to process/create teams for the saved groups (keeps behavior consistent with
    // the logic in other places). This will create teams for 2-player groups and split 4-player
    // groups into two teams when the competition is a 4BBB/fourball type.
    try {
      await processGroupsForCompetition(compId, groupsToSave);
    } catch (e) {
      console.error('Error while processing groups after save (processGroupsForCompetition):', e);
    }
    res.json({ success: true, competition: updated });
  } catch (err) {
    console.error('Error updating groups:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Test endpoint: fetch all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.users.findMany();
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get all competitions
app.get('/api/competitions', async (req, res) => {
  try {
    const competitions = await prisma.competitions.findMany({ orderBy: { date: 'desc' } });
    res.json(competitions);
  } catch (err) {
    console.error('Error fetching competitions:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get all competitions
app.post('/api/competitions', async (req, res) => {
  const data = req.body;
  if (!data.handicapAllowance && !data.handicapallowance) {
    return res.status(400).json({ error: 'Handicap allowance is required' });
  }
  // Normalize key to match Prisma schema
  if (data.handicapAllowance && !data.handicapallowance) {
    data.handicapallowance = data.handicapAllowance;
    delete data.handicapAllowance;
  }
  try {
    const comp = await prisma.competitions.create({ data });
    // Automatically seed 18 holes for this competition using Westlake hole data
    const westlake = [
      { number: 1, par: 4, stroke_index: 5 },
      { number: 2, par: 4, stroke_index: 7 },
      { number: 3, par: 3, stroke_index: 17 },
      { number: 4, par: 5, stroke_index: 1 },
      { number: 5, par: 4, stroke_index: 11 },
      { number: 6, par: 3, stroke_index: 15 },
      { number: 7, par: 5, stroke_index: 3 },
      { number: 8, par: 4, stroke_index: 13 },
      { number: 9, par: 4, stroke_index: 9 },
      { number: 10, par: 4, stroke_index: 10 },
      { number: 11, par: 4, stroke_index: 4 },
      { number: 12, par: 4, stroke_index: 12 },
      { number: 13, par: 5, stroke_index: 2 },
      { number: 14, par: 4, stroke_index: 14 },
      { number: 15, par: 3, stroke_index: 18 },
      { number: 16, par: 5, stroke_index: 6 },
      { number: 17, par: 3, stroke_index: 16 },
      { number: 18, par: 4, stroke_index: 8 }
    ];
    const holesData = westlake.map(h => ({ ...h, competition_id: comp.id }));
    await prisma.holes.createMany({ data: holesData });
    // If the client supplied groups on creation, ensure underlying teams are created
    try {
      if (data.groups && Array.isArray(data.groups) && data.groups.length > 0) {
        await processGroupsForCompetition(comp.id, data.groups);
      }
    } catch (e) {
      console.error('Error processing groups for new competition:', e);
    }
    res.json({ success: true, competition: comp });
  } catch (err) {
    console.error('Error creating competition:', err);
    res.status(500).json({ error: 'Database error' });
  }
});
// (Stray code removed)

// Get competition by ID
app.get('/api/competitions/:id', async (req, res) => {
  const { id } = req.params;
  try {
  const comp = await prisma.competitions.findUnique({ where: { id: Number(id) }, include: { holes: { orderBy: { number: 'asc' } } } });
    if (!comp) {
      return res.status(404).json({ error: 'Competition not found' });
    }
    // Deep copy to avoid mutating DB object
  let compOut = JSON.parse(JSON.stringify(comp));
    let debug = [];
    let users = await prisma.users.findMany();
  // Helper to robustly match a player display name to a users row.
  // Use a stronger normalizer (strip punctuation, smart quotes, collapse whitespace)
  function normalizeNameForMatch(n) {
    if (!n && n !== 0) return '';
    try {
      return String(n)
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
      return (n || '').toString().trim().toLowerCase();
    }
  }

  // Build an index of users by several name candidates for fast in-memory lookup
  const usersByNorm = {};
  for (const u of users || []) {
    if (!u) continue;
    const candidates = [];
    if (u.name) candidates.push(u.name);
    if (u.displayName) candidates.push(u.displayName);
    if (u.display_name) candidates.push(u.display_name);
    if (u.displayname) candidates.push(u.displayname);
    if (u.nick) candidates.push(u.nick);
    if (u.nickname) candidates.push(u.nickname);
    // also include raw name
    if (u.name) candidates.push(u.name);
    for (const c of candidates) {
      if (!c) continue;
      const k = normalizeNameForMatch(c);
      if (!k) continue;
      usersByNorm[k] = usersByNorm[k] || u;
    }
  }

  function findUserByName(playerName) {
    if (!playerName) return null;
    const target = normalizeNameForMatch(playerName);
    if (!target) return null;
    if (usersByNorm[target]) return usersByNorm[target];
    return null;
  }

  // Pre-fetch teams_users rows for this competition once to allow fallbacks when no user is found
  let teamsUsersForComp = [];
  try {
    teamsUsersForComp = await prisma.teams_users.findMany({ where: { teams: { competition_id: Number(id) } }, include: { users: true } });
  } catch (e) { /* ignore fetch errors; fallbacks will be best-effort */ }
  // Determine competition type to know whether 4-player groups map to two teams
  const compRow = await prisma.competitions.findUnique({ where: { id: Number(id) } });
  const compTypeLower = (compRow?.type || '').toString().toLowerCase();
  const isFourBbb = compTypeLower.includes('4bbb') || compTypeLower.includes('fourbbb') || (!!compRow && !!compRow.fourballs);
    if (Array.isArray(compOut.groups)) {
      // Fetch all teams for this competition once
      const allTeams = await prisma.teams.findMany({ where: { competition_id: Number(id) } });
      for (const group of compOut.groups) {
        // Collect debug info
        let groupDebug = { groupPlayers: group.players };
        // Robustly match group to team by comparing sets of player names (ignoring order/whitespace)
        let foundTeam = null;
        if (Array.isArray(group.players)) {
          // Only map 4-player groups to underlying teams when competition is 4BBB
          if (isFourBbb && group.players.length === 4) {
            const pairA = [group.players[0], group.players[1]];
            const pairB = [group.players[2], group.players[3]];
            for (const team of allTeams) {
              if (!Array.isArray(team.players)) continue;
              const tSet = new Set(team.players.map(p => normalizeNameForMatch(p)));
              if (tSet.size === 2 && pairA.every(p => tSet.has(normalizeNameForMatch(p)))) {
                group.teamIds = group.teamIds || [];
                group.teamIds[0] = team.id;
              }
              if (tSet.size === 2 && pairB.every(p => tSet.has(normalizeNameForMatch(p)))) {
                group.teamIds = group.teamIds || [];
                group.teamIds[1] = team.id;
              }
            }
          } else {
            const groupSet = new Set(group.players.map(p => normalizeNameForMatch(p)));
            for (const team of allTeams) {
              if (Array.isArray(team.players)) {
                const teamSet = new Set(team.players.map(p => normalizeNameForMatch(p)));
                if (groupSet.size === teamSet.size && groupSet.size > 0 && [...groupSet].every(p => teamSet.has(p))) {
                  foundTeam = team;
                  break;
                }
              }
            }
          }
        }
        groupDebug.foundTeam = foundTeam;
        debug.push(groupDebug);
        // For 4-player groups, we may have stored two teamIds (pairA and pairB)
          if (group.teamIds && Array.isArray(group.teamIds) && group.teamIds.length > 0) {
          // Populate handicaps/teeboxes by searching teams_users for each player across assigned teams
          group.handicaps = {};
          group.teeboxes = {};
          for (const playerName of group.players) {
            const user = findUserByName(playerName);
            if (user) {
              // Try each team id in teamIds to find teams_users
              for (const tId of group.teamIds) {
                if (!tId) continue;
                const tu = await prisma.teams_users.findFirst({ where: { team_id: tId, user_id: user.id } });
                if (tu) {
                  if (tu.course_handicap !== null && tu.course_handicap !== undefined) group.handicaps[playerName] = tu.course_handicap;
                  if (tu.teebox) group.teeboxes[playerName] = tu.teebox;
                  break;
                }
              }
              // Fallback: if we didn't find a teams_users row via the explicit teamIds,
              // try to find any teams_users for this user within the same competition.
              if (group.handicaps[playerName] === undefined) {
                try {
                  const fallbackTu = await prisma.teams_users.findFirst({ where: { user_id: user.id, teams: { competition_id: Number(id) } }, include: { teams: true } });
                  if (fallbackTu) {
                    if (fallbackTu.course_handicap !== null && fallbackTu.course_handicap !== undefined) group.handicaps[playerName] = fallbackTu.course_handicap;
                    if (fallbackTu.teebox) group.teeboxes[playerName] = fallbackTu.teebox;
                  }
                } catch (e) { /* ignore */ }
              }
            } else {
              // No user row matched — try to find a teams_users row by matching the associated user's name
              try {
                const normTarget = normalizeNameForMatch(playerName);
                const tuMatch = teamsUsersForComp.find(tu => tu && tu.users && normalizeNameForMatch(tu.users.name) === normTarget);
                if (tuMatch) {
                  if (tuMatch.course_handicap !== null && tuMatch.course_handicap !== undefined) group.handicaps[playerName] = tuMatch.course_handicap;
                  if (tuMatch.teebox) group.teeboxes[playerName] = tuMatch.teebox;
                }
              } catch (e) { /* ignore */ }
            }
          }
        } else {
          // Single team mapping (old behavior)
          group.teamId = foundTeam ? foundTeam.id : null;
          if (foundTeam && Array.isArray(group.players)) {
            group.handicaps = {};
            group.teeboxes = {};
            for (const playerName of group.players) {
              const user = findUserByName(playerName);
              if (user) {
                const tu = await prisma.teams_users.findFirst({ where: { team_id: foundTeam.id, user_id: user.id } });
                if (tu) {
                  if (tu.course_handicap !== null && tu.course_handicap !== undefined) {
                    group.handicaps[playerName] = tu.course_handicap;
                  }
                  if (tu.teebox) {
                    group.teeboxes[playerName] = tu.teebox;
                  }
                } else {
                  // Fallback: try any teams_users for this user within the same competition
                  try {
                    const fallbackTu = await prisma.teams_users.findFirst({ where: { user_id: user.id, teams: { competition_id: Number(id) } }, include: { teams: true } });
                    if (fallbackTu) {
                      if (fallbackTu.course_handicap !== null && fallbackTu.course_handicap !== undefined) group.handicaps[playerName] = fallbackTu.course_handicap;
                      if (fallbackTu.teebox) group.teeboxes[playerName] = fallbackTu.teebox;
                    }
                  } catch (e) { /* ignore */ }
                }
              } else {
                // try teams_users fallback by matching associated user name
                try {
                  const normTarget = normalizeNameForMatch(playerName);
                  const tuMatch = teamsUsersForComp.find(tu => tu && tu.users && normalizeNameForMatch(tu.users.name) === normTarget);
                  if (tuMatch) {
                    if (tuMatch.course_handicap !== null && tuMatch.course_handicap !== undefined) group.handicaps[playerName] = tuMatch.course_handicap;
                    if (tuMatch.teebox) group.teeboxes[playerName] = tuMatch.teebox;
                  }
                } catch (e) { /* ignore */ }
              }
            }
          }
        }
      }
    }
    // Final pass: if any group still lacks handicaps, try to find any teams_users rows for those players within this competition
    try {
      for (const group of (compOut.groups || [])) {
        if (!group || !Array.isArray(group.players)) continue;
        if (group.handicaps && Object.keys(group.handicaps).length > 0) continue;
        group.handicaps = group.handicaps || {};
        for (const playerName of group.players) {
          try {
            const user = findUserByName(playerName);
            if (user) {
              // Only search within the current competition (not across all competitions)
              const anyTu = await prisma.teams_users.findFirst({ where: { user_id: user.id, teams: { competition_id: Number(id) }, course_handicap: { not: null } } });
              if (anyTu && anyTu.course_handicap != null) {
                group.handicaps[playerName] = anyTu.course_handicap;
                try { console.log(`Enriched group.handicaps (final pass) for '${playerName}' from teams_users id ${anyTu.id}`); } catch (e) {}
                continue;
              }
            }
            // If still not found via users, try the prefetched teams_users rows
            const normTarget = normalizeNameForMatch(playerName);
            const tuMatch = teamsUsersForComp.find(tu => tu && tu.users && normalizeNameForMatch(tu.users.name) === normTarget && tu.course_handicap != null);
            if (tuMatch) {
              group.handicaps[playerName] = tuMatch.course_handicap;
              try { console.log(`Enriched group.handicaps (final pass) for '${playerName}' from teams_users id ${tuMatch.id}`); } catch (e) {}
            }
          } catch (e) { /* ignore per-player errors */ }
        }
      }
    } catch (e) { /* ignore final pass errors */ }

    res.json({ ...compOut, debug, users });
  } catch (err) {
    console.error('Error fetching competition:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Compute a 4BBB-style leaderboard directly from competitions.groups and teams_users/scores
// This endpoint is a fast, authoritative server-side computation that uses stored groups (handicaps)
// and scores to produce team and per-player stats (gross, PH, CH, Net, DTH Net) without relying on
// the client-side `entries` state. Useful when group.handicaps are partially populated.
app.get('/api/competitions/:id/leaderboard-4bbb', async (req, res) => {
  const { id } = req.params;
  try {
    const compId = Number(id);
    if (!compId) return res.status(400).json({ error: 'Invalid competition id' });
    const comp = await prisma.competitions.findUnique({ where: { id: compId }, include: { holes: { orderBy: { number: 'asc' } } } });
    if (!comp) return res.status(404).json({ error: 'Competition not found' });

    const holes = Array.isArray(comp.holes) ? comp.holes : [];
    // fetch teams_users for this competition to map player names -> user_id and CH
    const teams = await prisma.teams.findMany({ where: { competition_id: compId } });
    const teamIds = (teams || []).map(t => t.id).filter(Boolean);
    const allTeamUsers = teamIds.length > 0 ? await prisma.teams_users.findMany({ where: { team_id: { in: teamIds } }, include: { users: true } }) : [];
    // fetch all scores for this competition (we will map by user_id and hole)
    const allScores = await prisma.scores.findMany({ where: { competition_id: compId } });

    // helper normalizer (same approach as other helpers)
    function normalizeName(n) {
      if (!n && n !== 0) return '';
      try {
        return String(n).normalize('NFKD').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/''/g, "'").replace(/["()\[\]{}]/g, '').replace(/[^\w\s\-']/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
      } catch (e) { return (n || '').toString().trim().toLowerCase(); }
    }

    const allowanceRaw = comp?.handicapallowance ?? comp?.handicapAllowance ?? 100;
    const allowance = (parseFloat(allowanceRaw) || 100) / 100;

    // Map hole id -> index and stroke_index for receiving strokes
    const holeIdToIndex = {};
    const holeIndexToStrokeIndex = {};
    holes.forEach((h, idx) => { holeIdToIndex[h.id] = idx; holeIndexToStrokeIndex[idx] = (h.stroke_index != null ? Number(h.stroke_index) : (h.index != null ? Number(h.index) : undefined)); });

    // Build helper to get teams_users row for a player name (prefer matching within provided group teamIds)
    function findTeamUserForName(name, candidateTeamIds) {
      const norm = normalizeName(name);
      // first, prefer explicit teamIds
      if (Array.isArray(candidateTeamIds) && candidateTeamIds.length > 0) {
        for (const tu of allTeamUsers) {
          if (!tu || !tu.users) continue;
          if (!candidateTeamIds.includes(tu.team_id)) continue;
          if (normalizeName(tu.users.name) === norm) return tu;
        }
      }
      // fallback: any teams_users in this competition matching by name
      for (const tu of allTeamUsers) {
        if (!tu || !tu.users) continue;
        if (normalizeName(tu.users.name) === norm) return tu;
      }
      return null;
    }

    // helper: compute strokesReceived for a hole given playing handicap (PH) and hole stroke_index
    function strokesReceivedForHole(ph, strokeIndex) {
      let strokesReceived = 0;
      if (!strokeIndex) strokeIndex = 0;
      if (ph > 0) {
        if (ph >= 18) {
          strokesReceived = 1;
          if ((ph - 18) >= strokeIndex) strokesReceived = 2;
          else if (strokeIndex <= (ph % 18)) strokesReceived = 2;
        } else if (strokeIndex <= ph) {
          strokesReceived = 1;
        }
      }
      return strokesReceived;
    }

    // stableford points helper
    function stablefordPoints(net, par) {
      if (net == null || Number.isNaN(net)) return 0;
      if (net <= par - 4) return 6;
      if (net === par - 3) return 5;
      if (net === par - 2) return 4;
      if (net === par - 1) return 3;
      if (net === par) return 2;
      if (net === par + 1) return 1;
      return 0;
    }

    const outTeams = [];
    const groups = Array.isArray(comp.groups) ? comp.groups : [];
    for (const group of groups) {
      if (!group || !Array.isArray(group.players)) continue;
      // Determine pairs: if 4-player group assume pairA [0,1], pairB [2,3]; if 2-player group treat as single team
      const isFour = Array.isArray(group.players) && group.players.length === 4;
      const pairs = isFour ? [[group.players[0], group.players[1]], [group.players[2], group.players[3]]] : [group.players.slice(0,2)];
      // candidate teamIds for matching (group.teamIds or group.teamId)
      const candidateTeamIds = Array.isArray(group.teamIds) && group.teamIds.length > 0 ? group.teamIds : (group.teamId ? [group.teamId] : []);
      for (let pIdx = 0; pIdx < pairs.length; pIdx++) {
        const pair = pairs[pIdx];
        // gather per-player computed stats
        const playerStats = [];
        for (const playerName of pair) {
          const tu = findTeamUserForName(playerName, candidateTeamIds);
          const userId = tu && tu.user_id ? Number(tu.user_id) : null;
          const chRaw = (group && group.handicaps && group.handicaps[playerName] !== undefined) ? group.handicaps[playerName] : (tu && (tu.course_handicap !== null && tu.course_handicap !== undefined) ? tu.course_handicap : null);
          const ch = chRaw !== null && chRaw !== undefined && chRaw !== '' ? Number(chRaw) : null;
          const ph = ch != null ? Math.round((Number(ch) || 0) * allowance) : 0;
          // assemble per-hole strokes for this player from allScores using userId
          const perHoleStrokes = Array(18).fill(null);
          if (userId) {
            for (const s of allScores) {
              if (s.user_id === userId) {
                const idx = holeIdToIndex[s.hole_id];
                if (idx != null && idx >= 0 && idx < 18) perHoleStrokes[idx] = s.strokes != null ? Number(s.strokes) : null;
              }
            }
          }
          const gross = perHoleStrokes.reduce((sum, v) => sum + (Number.isFinite(Number(v)) ? Number(v) : 0), 0);
          const net = gross && ph ? gross - ph : (gross || 0) - (ph || 0);
          const dthNet = gross - (ch != null ? ch : 0);
          // compute stableford per hole using PH-derived strokes received
          const perHolePoints = Array(18).fill(0);
          for (let hi = 0; hi < 18; hi++) {
            const strokes = perHoleStrokes[hi];
            if (strokes == null || strokes === '' || !Number.isFinite(Number(strokes)) || Number(strokes) <= 0) { perHolePoints[hi] = 0; continue; }
            const strokeIdx = holeIndexToStrokeIndex[hi] || 0;
            const strokesReceived = strokesReceivedForHole(ph, strokeIdx);
            const holePar = (holes[hi] && holes[hi].par != null) ? Number(holes[hi].par) : 4;
            const netStrokes = Number(strokes) - strokesReceived;
            perHolePoints[hi] = stablefordPoints(netStrokes, holePar);
          }
          const points = perHolePoints.reduce((s,v) => s + (v || 0), 0);
          playerStats.push({ name: playerName, userId, ch: ch != null ? ch : null, ph, gross, net, dthNet, perHoleStrokes, perHolePoints, points });
        }
        // compute team best-ball per hole (max of two players' perHolePoints)
        const teamPerHole = Array(18).fill(0);
        for (let hi = 0; hi < 18; hi++) {
          const a = (playerStats[0] && playerStats[0].perHolePoints && Number.isFinite(playerStats[0].perHolePoints[hi]) ? Number(playerStats[0].perHolePoints[hi]) : 0);
          const b = (playerStats[1] && playerStats[1].perHolePoints && Number.isFinite(playerStats[1].perHolePoints[hi]) ? Number(playerStats[1].perHolePoints[hi]) : 0);
          teamPerHole[hi] = Math.max(a,b);
        }
        const teamPoints = teamPerHole.reduce((s,v) => s + (v || 0), 0);
        outTeams.push({ groupIndex: groups.indexOf(group), pairIndex: pIdx, players: playerStats, teamPoints, teamPerHole, teamIds: group.teamIds || (group.teamId ? [group.teamId] : []) });
      }
    }

    res.json({ competitionId: compId, teams: outTeams });
  } catch (e) {
    console.error('leaderboard-4bbb error', e && e.stack ? e.stack : e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all scores for a player in a team for a competition (returns array of 18, index = hole-1)
app.get('/api/teams/:teamId/users/:userId/scores', async (req, res) => {
  const { teamId, userId } = req.params;
  const { competitionId } = req.query; // pass as query param
  if (!competitionId) return res.status(400).json({ error: 'competitionId required' });
  try {
    // Fetch holes for this competition, ordered by number (1-18)
    const holes = await prisma.holes.findMany({
      where: { competition_id: Number(competitionId) },
      orderBy: { number: 'asc' }
    });
    const scores = await prisma.scores.findMany({
      where: {
        team_id: Number(teamId),
        user_id: Number(userId),
        competition_id: Number(competitionId)
      }
    });
    // Map scores to the correct hole order
    const result = Array(18).fill(null);
    holes.forEach((hole, idx) => {
      const score = scores.find(s => s.hole_id === hole.id);
      result[idx] = score && score.strokes != null ? score.strokes : null;
    });
    res.json({ scores: result });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// DEBUG: list teams_users rows for a team or competition (admin/dev helper)
app.get('/api/debug/teams_users', async (req, res) => {
  const { teamId, competitionId } = req.query;
  try {
    if (teamId) {
      const rows = await prisma.teams_users.findMany({ where: { team_id: Number(teamId) } });
      return res.json(rows);
    }
    if (competitionId) {
      const teams = await prisma.teams.findMany({ where: { competition_id: Number(competitionId) } });
      const ids = (teams || []).map(t => t.id).filter(Boolean);
      if (ids.length === 0) return res.json([]);
  const rows = await prisma.teams_users.findMany({ where: { team_id: { in: ids } }, include: { teams: true, users: true } });
      return res.json(rows);
    }
    return res.status(400).json({ error: 'teamId or competitionId required' });
  } catch (e) {
    console.error('debug/teams_users error', e);
    return res.status(500).json({ error: 'Database error' });
  }
});

// Save all scores for a player in a team for a competition
app.patch('/api/teams/:teamId/users/:userId/scores', async (req, res) => {
  const { teamId, userId } = req.params;
  const { competitionId, scores, bbScore } = req.body; // scores: array of 18 numbers/nulls, bbScore: optional number
  const logTime = new Date().toISOString();
  if (!competitionId || !Array.isArray(scores) || scores.length !== 18) {
    return res.status(400).json({ error: 'competitionId and 18 scores required' });
  }
  // Defensive check: if a client accidentally sends an all-empty scores array we will
  // refuse to apply it unless allowClear === true is provided. This prevents accidental
  // mass-deletes caused by buggy clients. Operators can still clear scores explicitly.
  try {
    const allowClear = req.body && req.body.allowClear === true;
    const numNonEmpty = scores.reduce((c, s) => c + ((s != null && s !== '') ? 1 : 0), 0);
    if (numNonEmpty === 0 && !allowClear) {
      console.warn(`[${logTime}] Rejecting all-empty scores update for team/user (need allowClear=true to clear):`, { teamId, userId, competitionId });
      return res.status(400).json({ error: 'No non-empty scores provided. To clear existing scores explicitly include { allowClear: true } in the request body.' });
    }
    // Audit logging: list of hole indexes that contain non-empty values and request origin info
    const touchedIndexes = scores.map((s, i) => ((s != null && s !== '') ? i : -1)).filter(i => i >= 0);
    const originSocket = req && req.headers && (req.headers['x-origin-socket'] || req.headers['X-Origin-Socket']) ? (req.headers['x-origin-socket'] || req.headers['X-Origin-Socket']) : null;
    const originIp = req && (req.ip || req.headers['x-forwarded-for'] || req.connection && req.connection.remoteAddress) ? (req.ip || req.headers['x-forwarded-for'] || (req.connection && req.connection.remoteAddress)) : 'unknown';
    // Fetch previous scores for this user/team/competition
    let prevScores = [];
    try {
      prevScores = await prisma.scores.findMany({
        where: {
          competition_id: Number(competitionId),
          team_id: Number(teamId),
          user_id: Number(userId)
        },
        orderBy: { hole_id: 'asc' }
      });
    } catch (e) { prevScores = []; }
    const prevStrokes = prevScores.map(s => s.strokes);
    console.log(`[${logTime}] PATCH /api/teams/${teamId}/users/${userId}/scores`);
    console.log(`  competitionId=${competitionId}, nonEmpty=${numNonEmpty}, allowClear=${allowClear}, touchedIndexes=[${touchedIndexes.join(',')}]`);
    console.log(`  originSocket=${originSocket || ''}, originIp=${originIp}`);
    console.log(`  prevScores: [${prevStrokes.join(', ')}]`);
    console.log(`  newScores:  [${scores.join(', ')}]`);
    if (typeof bbScore !== 'undefined') console.log(`  bbScore (frontend override): ${bbScore}`);
  } catch (e) { console.error(`[${logTime}] Error in logging score update:`, e); }
  try {
    // Fetch holes for this competition, ordered by number (1-18)
    const holes = await prisma.holes.findMany({
      where: { competition_id: Number(competitionId) },
      orderBy: { number: 'asc' }
    });
    for (let i = 0; i < 18; i++) {
      const strokes = scores[i];
      const hole = holes[i];
      if (!hole) continue;
      // IMPORTANT: treat empty string ('') as a client-side no-op to avoid accidental
      // clears caused by clients that send full arrays with blanks. Do NOT delete
      // the existing DB score when strokes === ''. If an operator intentionally
      // wants to clear all scores they must send an all-empty array with allowClear=true
      // (handled above). This prevents inadvertent loss of previously-entered hole values.
      if (strokes == null || strokes === '') {
        // Skip updating/deleting; treat as "no change" for this hole
        continue;
      }
      const upsertData = {
        where: {
          competition_id_team_id_user_id_hole_id: {
            competition_id: Number(competitionId),
            team_id: Number(teamId),
            user_id: Number(userId),
            hole_id: hole.id
          }
        },
        update: { strokes: Number(strokes) },
        create: {
          competition_id: Number(competitionId),
          team_id: Number(teamId),
          user_id: Number(userId),
          hole_id: hole.id,
          strokes: Number(strokes)
        }
      };
      await prisma.scores.upsert(upsertData);
    }
    // --- 4BBB Team Points Calculation ---
    // 1. Fetch all team members
    const team = await prisma.teams.findUnique({
      where: { id: Number(teamId) },
      include: { teams_users: true }
    });
    if (team) {
      // 2. Fetch all scores for this team in this competition
      const allScores = await prisma.scores.findMany({
        where: {
          competition_id: Number(competitionId),
          team_id: Number(teamId)
        }
      });
      // 3. Fetch holes for this competition, ordered by number
      const holes = await prisma.holes.findMany({
        where: { competition_id: Number(competitionId) },
        orderBy: { number: 'asc' }
      });
      // 4. Build a map: user_id -> handicap (from teams_users)
      const handicapMap = {};
      for (const tu of team.teams_users) {
        if (tu.user_id != null && tu.course_handicap != null) {
          handicapMap[tu.user_id] = Number(tu.course_handicap);
        }
      }
      // Log CH values for all team members
      try {
        const chLog = team.teams_users.map(tu => `user:${tu.user_id} CH:${tu.course_handicap}`).join(', ');
        console.log(`[${logTime}] TeamId ${teamId} CH values: ${chLog}`);
      } catch (e) { console.error(`[${logTime}] Error logging CH values:`, e); }
      // 5. Get handicap allowance for competition (if any)
      let comp = null;
      let handicapAllowance = 1;
      try {
        comp = await prisma.competitions.findUnique({ where: { id: Number(competitionId) } });
        if (comp && comp.handicapallowance && !isNaN(Number(comp.handicapallowance))) {
          handicapAllowance = Number(comp.handicapallowance) / 100;
        }
      } catch {}
      // 6. For each hole, find best Stableford points among all team members
      let teamPoints = 0;
      for (const hole of holes) {
        let bestPoints = 0;
        for (const tu of team.teams_users) {
          const userId = tu.user_id;
          // Find score for this user/hole
          const scoreObj = allScores.find(s => s.user_id === userId && s.hole_id === hole.id);
          if (!scoreObj || scoreObj.strokes == null || Number(scoreObj.strokes) <= 0) continue; // Ignore blank/zero scores
          // Calculate adjusted handicap for this user
          let adjHandicap = 0;
          if (handicapMap[userId] != null) {
            adjHandicap = Math.round(handicapMap[userId] * handicapAllowance);
          }
          // Calculate strokes received for this hole
          let strokesReceived = 0;
          if (adjHandicap > 0) {
            if (adjHandicap >= 18) {
              strokesReceived = 1;
              if (adjHandicap - 18 >= hole.stroke_index) strokesReceived = 2;
              else if (hole.stroke_index <= (adjHandicap % 18)) strokesReceived = 2;
            } else if (hole.stroke_index <= adjHandicap) {
              strokesReceived = 1;
            }
          }
          const gross = Number(scoreObj.strokes);
          const net = gross ? gross - strokesReceived : null;
          // Stableford points: 6=triple eagle, 5=double eagle, 4=eagle, 3=birdie, 2=par, 1=bogey, 0=worse
          let pts = 0;
          if (net !== null) {
            if (net === hole.par - 4) pts = 6;
            else if (net === hole.par - 3) pts = 5;
            else if (net === hole.par - 2) pts = 4;
            else if (net === hole.par - 1) pts = 3;
            else if (net === hole.par) pts = 2;
            else if (net === hole.par + 1) pts = 1;
          }
          if (pts > bestPoints) bestPoints = pts;
        }
        teamPoints += bestPoints;
      }
      // 7. Update team_points in teams table
      // If bbScore is provided by frontend, use it. Otherwise, use backend calculation.
      const updatedTeam = await prisma.teams.update({
        where: { id: Number(teamId) },
        data: { team_points: typeof bbScore === 'number' ? bbScore : teamPoints }
      });
      // Prepare delta payload: include changed user ids, team points and mapped scores (holeIndex)
      try {
        const compIdNum = Number(competitionId);
        if (global.io && compIdNum) {
          // allScores variable contains score rows for this team and competition
          const changedUserIds = Array.from(new Set(allScores.map(s => s.user_id)));
          // Map hole_id to hole index (0-based) using holes array
          const holeIdToIndex = {};
          holes.forEach((h, idx) => { holeIdToIndex[h.id] = idx; });
          const mappedScores = allScores.map(s => ({ userId: s.user_id, holeIndex: holeIdToIndex[s.hole_id] ?? null, strokes: s.strokes }));
          global.io.to(`competition:${compIdNum}`).emit('scores-updated', { competitionId: compIdNum, teamId: Number(teamId), teamPoints: updatedTeam.team_points, changedUserIds, mappedScores });
          // Emit popup-events for any eagle/birdie/blowup detected in mappedScores
          try {
            for (const s of mappedScores) {
              const strokes = Number(s.strokes);
              const holeIndex = s.holeIndex;
              const hole = holes[holeIndex];
              if (!hole || hole.par == null) continue;
              const par = Number(hole.par);
              let type = null;
              if (strokes === par - 2) type = 'eagle';
              else if (strokes === par - 1) type = 'birdie';
              else if (strokes >= par + 3) type = 'blowup';
              if (!type) continue;
              const userId = s.userId;
              let playerName = userId ? `user:${userId}` : null;
              try {
                if (userId) {
                  const userRow = await prisma.users.findUnique({ where: { id: Number(userId) } });
                  if (userRow) playerName = userRow.name;
                }
              } catch (e) {}
              const event = {
                eventId: makeEventId(),
                competitionId: compIdNum,
                groupId: updatedTeam.id || null,
                type,
                playerName,
                holeNumber: (holeIndex != null) ? (holeIndex + 1) : null,
                ts: Date.now()
              };
              try { event.signature = `${event.type}:${playerName}:${event.holeNumber}:${compIdNum}`; } catch (e) {}
              const originSocket = req && req.headers && (req.headers['x-origin-socket'] || req.headers['X-Origin-Socket']) ? (req.headers['x-origin-socket'] || req.headers['X-Origin-Socket']) : null;
              if (popupSignatureSeen(event.signature)) continue;
              try { if (originSocket) event.originSocketId = originSocket; } catch (e) {}
              try { global.io.to(`competition:${compIdNum}`).emit('popup-event', event); } catch (e) {}
            }
          } catch (e) { console.error('Error emitting popup-event from scores update', e); }
        }
      } catch (e) {
        console.error('Error emitting scores-updated socket event', e);
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/teams/:teamId/users/:userId/scores error:', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update competition status by ID (admin only)
app.patch('/api/competitions/:id', async (req, res) => {
  const { id } = req.params;
  const adminSecret = req.header('X-Admin-Secret');
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden: invalid admin secret' });
  }
  const {
    type,
    date,
    club,
    handicapAllowance,
    fourballs,
    notes,
    status,
    groups
  } = req.body;
  // Build update data object dynamically
  const updateData = {};
  if (type !== undefined) updateData.type = type;
  if (date !== undefined) updateData.date = date;
  if (club !== undefined) updateData.club = club;
  if (handicapAllowance !== undefined) updateData.handicapallowance = handicapAllowance;
  if (fourballs !== undefined) updateData.fourballs = fourballs;
  if (notes !== undefined) updateData.notes = notes;
  if (status !== undefined) updateData.status = status;
  if (groups !== undefined) updateData.groups = groups;
  console.log('PATCH /api/competitions/:id updateData:', updateData);
  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: 'No valid fields provided for update' });
  }
  try {
    const updated = await prisma.competitions.update({
      where: { id: Number(id) },
      data: updateData,
    });
    res.json({ success: true, competition: updated });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});
// Delete competition by ID
// Simple admin check: require X-Admin-Secret header to match env var ADMIN_SECRET
app.delete('/api/competitions/:id', async (req, res) => {

  const { id } = req.params;
  const adminSecret = req.headers['x-admin-secret'];
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'Admin authorization required' });
  }
  try {
    const deleted = await prisma.competitions.delete({ where: { id: Number(id) } });
    if (!deleted) {
      return res.status(404).json({ error: 'Competition not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting competition:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Login endpoint: authenticate user by username and password
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    // Only allow first-letter case-insensitive matches for username and password.
    // Strategy:
    // 1) Try an exact username match.
    // 2) If not found, try the username with the first character's case toggled (Dev <-> dev).
    // 3) For password, accept exact match or the provided password with only the first
    //    character's case toggled.
    const toggleFirstChar = (s) => {
      if (!s || s.length === 0) return s;
      const first = s[0];
      const rest = s.slice(1);
      const toggledFirst = first === first.toUpperCase() ? first.toLowerCase() : first.toUpperCase();
      return toggledFirst + rest;
    };

    // 1) exact username
    let user = await prisma.users.findFirst({ where: { username } });
    // 2) try toggled-first username if not found
    if (!user) {
      const altUsername = toggleFirstChar(username);
      if (altUsername !== username) {
        user = await prisma.users.findFirst({ where: { username: altUsername } });
      }
    }

    if (user) {
      const stored = user.password || '';
      const provided = password || '';
      // exact match OK
      if (stored === provided) {
        return res.json({ success: true, user });
      }
      // allow only first-letter toggled match
      if (toggleFirstChar(provided) === stored) {
        return res.json({ success: true, user });
      }
    }
    // Fallback: credentials invalid
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update a player's tee and course handicap for a team
app.patch('/api/teams/:teamId/users/:userId', async (req, res) => {
  const { teamId, userId } = req.params;
  const { teebox, course_handicap, waters, dog, two_clubs, fines } = req.body;
  try {
    let record = await prisma.teams_users.findFirst({
      where: {
        team_id: Number(teamId),
        user_id: Number(userId)
      }
    });
    const updateData = {
      teebox,
      course_handicap: course_handicap !== undefined ? Number(course_handicap) : undefined,
      waters: waters !== undefined ? Number(waters) : undefined,
      dog: dog !== undefined ? Boolean(dog) : undefined,
      two_clubs: two_clubs !== undefined ? Number(two_clubs) : undefined,
      fines: fines !== undefined ? Number(fines) : undefined
    };
    // Remove undefined fields so Prisma doesn't overwrite with null
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);
    if (record) {
      record = await prisma.teams_users.update({
        where: { id: record.id },
        data: updateData
      });
    } else {
      record = await prisma.teams_users.create({
        data: {
          team_id: Number(teamId),
          user_id: Number(userId),
          ...updateData
        }
      });
    }
    // Emit socket event to notify clients who are viewing this competition
    try {
      const team = await prisma.teams.findUnique({ where: { id: Number(teamId) } });
      if (team && team.competition_id && global.io) {
        global.io.to(`competition:${team.competition_id}`).emit('team-user-updated', { competitionId: team.competition_id, teamId: Number(teamId), userId: Number(userId) });
      }
    } catch (e) {
      console.error('Error emitting team-user-updated', e);
    }
    // If the update included course_handicap or teebox, refresh the competition's groups handicaps
    try {
      const wantsRefresh = Object.prototype.hasOwnProperty.call(req.body, 'course_handicap') || Object.prototype.hasOwnProperty.call(req.body, 'teebox');
      if (wantsRefresh) {
        // run in background - do not block response
        (async () => {
          try {
            const team = await prisma.teams.findUnique({ where: { id: Number(teamId) } });
            if (team && team.competition_id) await refreshCompetitionGroupsFromTeamsUsers(team.competition_id);
          } catch (e) { console.warn('background refreshCompetitionGroupsFromTeamsUsers failed', e && e.message ? e.message : e); }
        })();
      }
    } catch (e) { console.warn('teams_users patch refresh check failed', e && e.message ? e.message : e); }
    res.json(record);
  } catch (err) {
    console.error('Error upserting teams_users:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Fetch a player's tee and course handicap for a team
app.get('/api/teams/:teamId/users/:userId', async (req, res) => {
  const { teamId, userId } = req.params;
  try {
    const record = await prisma.teams_users.findFirst({
      where: {
        team_id: Number(teamId),
        user_id: Number(userId)
      },
      select: {
        teebox: true,
        course_handicap: true,
        waters: true,
        dog: true,
        two_clubs: true,
        fines: true
      }
    });
    if (!record) return res.status(404).json({ error: 'Not found' });
    res.json(record);
  } catch (err) {
    console.error('Error fetching teams_users:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Fallback: upsert fines by competition and player name when teamId/userId not known
app.patch('/api/competitions/:compId/players/:playerName/fines', async (req, res) => {
  const { compId, playerName } = req.params;
  const { fines } = req.body;
  try {
    console.log('[fines-fallback] Attempting to save fines for', playerName, 'in competition', compId);
    
    // Normalize function that handles quotes, apostrophes, and special characters
    const normalized = (s) => {
      if (!s) return '';
      return String(s)
        .replace(/['']/g, "'")  // Normalize curly quotes to straight quotes
        .replace(/[""]/g, '"')   // Normalize curly double quotes
        .trim()
        .toLowerCase();
    };
    
    // Find teams for competition
    const teams = await prisma.teams.findMany({ where: { competition_id: Number(compId) } });
    console.log('[fines-fallback] Found', teams.length, 'teams for competition', compId);
    
    // If no teams exist (e.g., Medal individual competitions), try to save to competition.groups.fines directly
    if (!teams || teams.length === 0) {
      console.log('[fines-fallback] No teams found, attempting to save to competition.groups.fines');
      try {
        const comp = await prisma.competitions.findUnique({ where: { id: Number(compId) } });
        if (!comp) return res.status(404).json({ error: 'Competition not found' });
        
        const groups = Array.isArray(comp.groups) ? comp.groups : [];
        let updated = false;
        let matchedPlayerName = null;
        
        // Find the group containing this player and update their fines
        for (const group of groups) {
          if (Array.isArray(group.players)) {
            // Try to find exact match first, then normalized match
            const exactMatch = group.players.find(p => p === playerName);
            if (exactMatch) {
              matchedPlayerName = exactMatch;
            } else {
              const normalizedPlayerName = normalized(playerName);
              matchedPlayerName = group.players.find(p => normalized(p) === normalizedPlayerName);
            }
            
            if (matchedPlayerName) {
              // Initialize fines object if it doesn't exist
              if (!group.fines || typeof group.fines !== 'object') {
                group.fines = {};
              }
              // Update fines using the matched player name (preserves original formatting)
              group.fines[matchedPlayerName] = fines !== undefined && fines !== null ? Number(fines) : null;
              updated = true;
              console.log('[fines-fallback] Updated fines in group.fines for', matchedPlayerName);
              break;
            }
          }
        }
        
        if (!updated) {
          console.log('[fines-fallback] Player not found in any group');
          return res.status(404).json({ error: 'Player not found in any group' });
        }
        
        // Save updated groups back to competition
        await prisma.competitions.update({
          where: { id: Number(compId) },
          data: { groups }
        });
        
        // Emit socket update
        try {
          if (global.io) {
            global.io.to(`competition:${compId}`).emit('fines-updated', { competitionId: Number(compId), playerName: matchedPlayerName });
          }
        } catch (e) {
          console.error('Error emitting fines-updated', e);
        }
        
        console.log('[fines-fallback] Successfully saved fines to competition.groups');
        return res.json({ fines: fines !== undefined && fines !== null ? Number(fines) : null });
      } catch (err) {
        console.error('Error saving fines to competition.groups:', err);
        return res.status(500).json({ error: 'Failed to save fines to competition groups' });
      }
    }
    
    let foundTeam = null;
    let matchedPlayerName = null;
    
    // Find team that contains this player name in its players array (string match)
    for (const t of teams) {
      if (Array.isArray(t.players)) {
        console.log('[fines-fallback] Checking team', t.id, 'with players:', t.players);
        
        // Try exact match first
        if (t.players.includes(playerName)) {
          foundTeam = t;
          matchedPlayerName = playerName;
          console.log('[fines-fallback] Found matching team:', t.id, '(exact match)');
          break;
        }
        
        // Try normalized match
        const normalizedPlayerName = normalized(playerName);
        matchedPlayerName = t.players.find(p => normalized(p) === normalizedPlayerName);
        if (matchedPlayerName) {
          foundTeam = t;
          console.log('[fines-fallback] Found matching team:', t.id, '(normalized match for', matchedPlayerName, ')');
          break;
        }
      }
    }
    
    if (!foundTeam) {
      console.log('[fines-fallback] Team for player not found in', teams.length, 'teams');
      return res.status(404).json({ error: 'Team for player not found' });
    }
    
    // Find user record by name (case-insensitive, handle quotes)
    const allUsers = await prisma.users.findMany();
    const normalizedPlayerName = normalized(playerName);
    const user = allUsers.find(u => normalized(u.name) === normalizedPlayerName);
    if (!user) {
      console.log('[fines-fallback] User not found in database. Searched for:', playerName, 'normalized:', normalizedPlayerName);
      return res.status(404).json({ error: 'User not found' });
    }
    console.log('[fines-fallback] Found user:', user.id, user.name);
    
    // Upsert teams_users record
    let record = await prisma.teams_users.findFirst({ where: { team_id: foundTeam.id, user_id: user.id } });
    const updateData = { fines: fines !== undefined && fines !== null ? Number(fines) : null };
    if (record) {
      console.log('[fines-fallback] Updating existing teams_users record:', record.id);
      record = await prisma.teams_users.update({ where: { id: record.id }, data: updateData });
    } else {
      console.log('[fines-fallback] Creating new teams_users record');
      record = await prisma.teams_users.create({ data: { team_id: foundTeam.id, user_id: user.id, ...updateData } });
    }
    try {
      if (foundTeam && foundTeam.competition_id && global.io) {
        global.io.to(`competition:${foundTeam.competition_id}`).emit('fines-updated', { competitionId: foundTeam.competition_id, teamId: foundTeam.id, userId: user.id });
      }
    } catch (e) {
      console.error('Error emitting fines-updated', e);
    }
    console.log('[fines-fallback] Successfully saved fines via teams_users');
    res.json(record);
  } catch (err) {
    console.error('Error upserting fines by competition/player:', err);
    res.status(500).json({ error: 'Server error' });
  }
});
// Helper to generate a 6-character alphanumeric join code
// function generateJoinCode() {
//   r  PGPASSWORD=1234 psql -h localhost -p 5432 -U postgres -d dth_score -c "INSERT INTO users (name, username, password, isadmin) VALUES ('Brett \"Roger\" Martindale', 'brett', 'martindale', false) ON CONFLICT (username) DO UPDATE SET name = EXCLUDED.name, password = EXCLUDED.password, isadmin = EXCLUDED.isadmin;"eturn Math.random().toString(36).substring(2, 8).toUpperCase();
// }


// Test PATCH endpoint for debugging
app.patch('/api/test', (req, res) => {
  console.log('Test PATCH hit');
  res.json({ ok: true });
});

// Create HTTP server and attach Socket.IO
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Expose io globally so route handlers can emit events
global.io = io;

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
  socket.on('join', ({ competitionId }) => {
    if (competitionId != null) {
      const room = `competition:${competitionId}`;
      socket.join(room);
      console.log(`Socket ${socket.id} joined room ${room}`);
    }
  });
  socket.on('leave', ({ competitionId }) => {
    if (competitionId != null) {
      const room = `competition:${competitionId}`;
      socket.leave(room);
      console.log(`Socket ${socket.id} left room ${room}`);
    }
  });
  // Re-broadcast client-sent saved medal updates to the competition room.
  // This allows clients to notify other clients immediately (optimistic global popups)
  socket.on('client-medal-saved', (payload) => {
    try {
      const compId = Number(payload?.competitionId);
      if (!compId) return;
      // Echo the payload as a server-originated `medal-player-updated` event so
      // clients receive the same shape they expect from server-side saves.
      global.io.to(`competition:${compId}`).emit('medal-player-updated', payload);
    } catch (e) {
      console.error('Error handling client-medal-saved', e);
    }
  });
  // Re-broadcast client-sent team/user drafts (course_handicap/teebox/etc) so other viewers
  // of the competition see the optimistic change immediately. Emit as the canonical
  // `team-user-updated` event so existing listeners handle it identically to persisted updates.
  socket.on('client-team-user-updated', (payload) => {
    try {
      const compId = Number(payload?.competitionId);
      if (!compId) return;
      // Attach origin socket id so recipients can dedupe if they came from the same socket
      try { payload.originSocketId = socket.id; } catch (e) {}
      console.log(`Rebroadcasting client-team-user-updated to competition:${compId}`);
      global.io.to(`competition:${compId}`).emit('team-user-updated', payload);
    } catch (e) {
      console.error('Error handling client-team-user-updated', e);
    }
  });
  // Re-broadcast lightweight score drafts so leaderboards and other scorecards can
  // reflect partial/real-time score edits instantly. Emit as `score-draft-updated`.
  socket.on('client-score-updated', (payload) => {
    try {
      const compId = Number(payload?.competitionId);
      if (!compId) return;
      try { payload.originSocketId = socket.id; } catch (e) {}
      // Minimal logging for diagnostics
      // payload may include: teamId, userId, playerName, holeIndex, strokes, scores (optional full array)
      console.log(`Rebroadcasting client-score-updated to competition:${compId}`, { teamId: payload.teamId, userId: payload.userId, holeIndex: payload.holeIndex });
      global.io.to(`competition:${compId}`).emit('score-draft-updated', payload);
    } catch (e) {
      console.error('Error handling client-score-updated', e);
    }
  });
  // Clients may show optimistic popups locally. To ensure other viewers see
  // those popups even when the HTTP save didn't change server state (no
  // server-side popup emitted), allow clients to request a server rebroadcast
  // of a canonical popup-event via 'client-popup'. The server will attach
  // an eventId and originSocketId and use popupSignatureSeen to prevent dupes.
  socket.on('client-popup', (payload) => {
      console.log('[backend] client-popup received:', payload, 'from socket:', socket.id);
    try {
      const compId = Number(payload?.competitionId);
      if (!compId) return;
      const type = payload.type;
      const playerName = payload.playerName;
      const holeNumber = payload.holeNumber || null;
      const sig = payload.signature || payload.signature === 0 ? payload.signature : (type && playerName ? `${type}:${playerName}:${holeNumber}:${compId}` : null);
      if (!sig) return;
      // server-side dedupe to avoid rapid duplicate rebroadcasts
      if (popupSignatureSeen(sig)) {
        console.log('[backend] popupSignatureSeen deduped:', sig, payload);
        return;
      }
      const event = {
        eventId: makeEventId(),
        competitionId: compId,
        type,
        playerName,
        holeNumber: holeNumber || null,
        ts: Date.now(),
        signature: sig,
        originSocketId: socket.id
      };
      console.log('[backend] Rebroadcasting popup-event to competition room:', `competition:${compId}`, event);
      global.io.to(`competition:${compId}`).emit('popup-event', event);
    } catch (e) {
      console.error('Error handling client-popup', e);
    }
  });
  socket.on('disconnect', () => {
    // console.log('Socket disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Create Competition endpoint
app.post('/api/competitions', async (req, res) => {
  let { date, type, club, handicapAllowance, joinCode, notes, groups } = req.body;
  if (!date || !type || !handicapAllowance) {
    return res.status(400).json({ error: 'Missing required fields (date, type, or handicap allowance)'});
  }
  // Always generate a unique join code if not provided or empty
  if (!joinCode) joinCode = generateJoinCode();
  try {
    const comp = await prisma.competitions.create({
      data: {
        date: new Date(date),
        type,
        club,
        handicapallowance: handicapAllowance,
        joincode: joinCode,
        notes,
        groups: groups || undefined,
        course_id: null,
        created_at: new Date()
      }
    });
    // If groups were supplied at creation, create underlying teams automatically
    try {
      if (groups && Array.isArray(groups) && groups.length > 0) {
        await processGroupsForCompetition(comp.id, groups);
      }
    } catch (e) {
      console.error('Error processing groups for new competition (post-create):', e);
    }
    res.status(201).json({ success: true, competition: comp });
  } catch (err) {
    console.error('Error creating competition:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Medal: Update player data (teebox, handicap, scores) in a group
app.patch('/api/competitions/:id/groups/:groupId/player/:playerName', async (req, res) => {
  const { id, groupId, playerName } = req.params;
  const { teebox, handicap, scores, waters, dog, two_clubs } = req.body; // scores: array of 18 numbers/nulls
  try {
    const comp = await prisma.competitions.findUnique({ where: { id: Number(id) } });
    if (!comp || !Array.isArray(comp.groups)) {
      return res.status(404).json({ error: 'Competition or groups not found' });
    }
    const groupIdx = comp.groups.findIndex((g, idx) => String(idx) === String(groupId));
    if (groupIdx === -1) {
      return res.status(404).json({ error: 'Group not found' });
    }
    const group = comp.groups[groupIdx];
    // Update teebox and handicap
    group.teeboxes = group.teeboxes || {};
    group.handicaps = group.handicaps || {};
    if (teebox !== undefined) group.teeboxes[playerName] = teebox;
    if (handicap !== undefined) group.handicaps[playerName] = handicap;
    // Update scores
    group.scores = group.scores || {};
    if (Array.isArray(scores) && scores.length === 18) {
      group.scores[playerName] = scores;
    }
    // Update mini table stats
    group.waters = group.waters || {};
    group.dog = group.dog || {};
    group.two_clubs = group.two_clubs || {};
    if (waters !== undefined) group.waters[playerName] = waters;
    if (dog !== undefined) group.dog[playerName] = dog;
    if (two_clubs !== undefined) {
      group.two_clubs[playerName] = two_clubs;
    }
    // AUTOMATIC two_clubs assignment:
    // If the submitted scores include a '2' on a par-3, compute the number of such
    // occurrences and set group.two_clubs[playerName] to that count (capped at the
    // total number of par-3 holes on the course). Also persist to teams_users if we
    // can resolve a team and user record.
    try {
      if (Array.isArray(scores) && scores.length === 18) {
        // Fetch holes for this competition to know which holes are par-3
        const holes = await prisma.holes.findMany({ where: { competition_id: Number(id) }, orderBy: { number: 'asc' } });
        const par3Count = holes.filter(h => Number(h.par) === 3).length || 0;
        let twoOnPar3 = 0;
        for (let hi = 0; hi < Math.min(holes.length, scores.length); hi++) {
          const hole = holes[hi];
          if (!hole) continue;
          const stroke = scores[hi];
          // Accept numeric 2 or string '2'
          if (Number(hole.par) === 3 && stroke != null && String(stroke) !== '' && Number(stroke) === 2) {
            twoOnPar3++;
          }
        }
  const computedTwoClubs = Math.min(twoOnPar3, par3Count);
  // Only update if a meaningful value (0 allowed) — set to 0 if none
  group.two_clubs[playerName] = computedTwoClubs;
        // Persist to teams_users when possible
        try {
          // Find the user by name (case-sensitive name match as elsewhere in code)
          const user = await prisma.users.findFirst({ where: { name: playerName } });
          if (user) {
            // Find team in this competition that contains this player.
            // Try exact array membership first, then fall back to a normalized string match
            let team = await prisma.teams.findFirst({ where: { competition_id: Number(id), players: { has: playerName } } });
            if (!team) {
              const allTeams = await prisma.teams.findMany({ where: { competition_id: Number(id) } });
              const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
              const target = normalize(playerName);
              for (const t of allTeams) {
                if (!Array.isArray(t.players)) continue;
                for (const p of t.players) {
                  if (normalize(p) === target) {
                    team = t;
                    break;
                  }
                }
                if (team) break;
              }
            }
            if (team) {
              // Upsert teams_users record with computed two_clubs
              let tu = await prisma.teams_users.findFirst({ where: { team_id: team.id, user_id: user.id } });
              if (tu) {
                await prisma.teams_users.update({ where: { id: tu.id }, data: { two_clubs: computedTwoClubs } });
              } else {
                await prisma.teams_users.create({ data: { team_id: team.id, user_id: user.id, two_clubs: computedTwoClubs } });
              }
            }
          }
        } catch (errTu) {
          console.error('Error persisting two_clubs to teams_users:', errTu);
        }
      }
    } catch (errAuto) {
      console.error('Error computing automatic two_clubs:', errAuto);
    }
    // Save updated groups array
    const updated = await prisma.competitions.update({
      where: { id: Number(id) },
      data: { groups: comp.groups }
    });
    try {
        if (global.io) {
        // Emit the updated group object so clients can merge locally without a full refetch
        const updatedGroup = (updated && Array.isArray(updated.groups)) ? updated.groups[groupIdx] : comp.groups[groupIdx];
        global.io.to(`competition:${Number(id)}`).emit('medal-player-updated', { competitionId: Number(id), groupId: Number(groupId), playerName, group: updatedGroup });
        // Now detect mini-stat flips and score-based changes and emit popup-events
        try {
          const beforeGroup = comp.groups[groupIdx] || {};
          const afterGroup = updatedGroup || {};
          // mini stats
          const props = ['waters', 'dog', 'two_clubs'];
          for (const prop of props) {
            const beforeMap = beforeGroup[prop] || {};
            const afterMap = afterGroup[prop] || {};
            const beforeVal = beforeMap[playerName];
            const afterVal = afterMap[playerName];
            const becameTrue = ((afterVal || false) && !beforeVal);
            if (becameTrue) {
              const type = (prop === 'waters') ? 'waters' : (prop === 'dog') ? 'dog' : 'two_clubs';
              const event = {
                eventId: makeEventId(),
                competitionId: Number(id),
                groupId: Number(groupId),
                type,
                playerName,
                ts: Date.now()
              };
              try { event.signature = `${type}:${playerName}:g:${groupId}:c:${Number(id)}`; } catch (e) {}
              const originSocket = req && req.headers && (req.headers['x-origin-socket'] || req.headers['X-Origin-Socket']) ? (req.headers['x-origin-socket'] || req.headers['X-Origin-Socket']) : null;
              if (!popupSignatureSeen(event.signature)) {
                try { if (originSocket) event.originSocketId = originSocket; } catch (e) {}
                try { global.io.to(`competition:${Number(id)}`).emit('popup-event', event); } catch (e) {}
              }
            }
          }
          // score diffs
          try {
            const beforeScores = (beforeGroup.scores && beforeGroup.scores[playerName]) || [];
            const afterScores = (afterGroup.scores && afterGroup.scores[playerName]) || [];
            const holesForComp = await prisma.holes.findMany({ where: { competition_id: Number(id) }, orderBy: { number: 'asc' } });
            for (let hi = 0; hi < Math.max(beforeScores.length, afterScores.length); hi++) {
              const beforeVal = beforeScores[hi];
              const afterVal = afterScores[hi];
              if (String(beforeVal) === String(afterVal)) continue;
              const hole = holesForComp[hi];
              if (!hole || hole.par == null) continue;
              const par = Number(hole.par);
              const strokes = afterVal == null || afterVal === '' ? null : Number(afterVal);
              if (strokes == null || !Number.isFinite(strokes)) continue;
              let type = null;
              if (strokes === par - 2) type = 'eagle';
              else if (strokes === par - 1) type = 'birdie';
              else if (strokes >= par + 3) type = 'blowup';
              if (!type) continue;
              const event = {
                eventId: makeEventId(),
                competitionId: Number(id),
                groupId: Number(groupId),
                type,
                playerName,
                holeNumber: hi + 1,
                ts: Date.now()
              };
              try { event.signature = `${event.type}:${playerName}:${event.holeNumber}:${Number(id)}`; } catch (e) {}
              const originSocket = req && req.headers && (req.headers['x-origin-socket'] || req.headers['X-Origin-Socket']) ? (req.headers['x-origin-socket'] || req.headers['X-Origin-Socket']) : null;
              if (!popupSignatureSeen(event.signature)) {
                try { if (originSocket) event.originSocketId = originSocket; } catch (e) {}
                try { global.io.to(`competition:${Number(id)}`).emit('popup-event', event); } catch (e) {}
              }
            }
          } catch (e) { console.error('Error emitting popup-event from medal score changes', e); }
        } catch (e) { console.error('Error emitting popup-event from medal update', e); }
      }
    } catch (e) {
      console.error('Error emitting medal-player-updated', e);
    }
    res.json({ success: true, group });
  } catch (err) {
    console.error('Error updating Medal player data:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Medal: Fetch player data in a group
app.get('/api/competitions/:id/groups/:groupId/player/:playerName', async (req, res) => {
  const { id, groupId, playerName } = req.params;
  try {
    const comp = await prisma.competitions.findUnique({ where: { id: Number(id) } });
    if (!comp || !Array.isArray(comp.groups)) {
      console.error('Competition or groups not found', { id });
      return res.status(404).json({ error: 'Competition or groups not found' });
    }
    const groupIdx = comp.groups.findIndex((g, idx) => String(idx) === String(groupId));
    if (groupIdx === -1) {
      console.error('Group not found', { groupId });
      return res.status(404).json({ error: 'Group not found' });
    }
    const group = comp.groups[groupIdx];
    const teebox = group.teeboxes?.[playerName] || null;
    const handicap = group.handicaps?.[playerName] || null;
    let scores = group.scores?.[playerName];
    if (!Array.isArray(scores)) {
      scores = Array(18).fill('');
    } else {
      scores = scores.map(v => (v == null ? '' : String(v)));
    }
    const waters = group.waters?.[playerName] ?? '';
    const dog = group.dog?.[playerName] ?? false;
    const two_clubs = group.two_clubs?.[playerName] ?? '';
    res.json({ teebox, handicap, scores, waters, dog, two_clubs });
  } catch (err) {
    console.error('Error fetching Medal player data:', err);
    res.status(500).json({ error: 'Database error' });
  }
});