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

// Update groups for a competition
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

    // Determine competition type (needed to know whether 4-player groups represent 4BBB teams)
    const compRow = existingComp || await prisma.competitions.findUnique({ where: { id: compId } });
    const compTypeLower = (compRow?.type || '').toString().toLowerCase();
    const isFourBbb = compTypeLower.includes('4bbb') || compTypeLower.includes('fourbbb') || (!!compRow && !!compRow.fourballs);

    // Fetch all existing teams for this competition
    const existingTeams = await prisma.teams.findMany({ where: { competition_id: Number(id) } });
    // Map of team key (sorted player names) to team object
    const teamKey = (players) => players.map(p => p && p.trim && p.trim()).sort().join('|');
    const existingTeamMap = {};
    for (const team of existingTeams) {
      if (Array.isArray(team.players)) {
        existingTeamMap[teamKey(team.players)] = team;
      }
    }

    // Create teams for each incoming group. Groups can be either 2-player (team) objects
    // or 4-player 4-balls. For 4-player groups we create two teams: players[0,1] and players[2,3].
  for (const [i, group] of (groupsToSave || groups).entries()) {
      if (!Array.isArray(group.players) || group.players.length === 0) continue;
      // Helper to process a pair of players and create/find a team for them
      async function ensureTeamForPair(pairPlayers, pairLabel) {
        if (!Array.isArray(pairPlayers) || pairPlayers.length !== 2) return null;
        const key = teamKey(pairPlayers);
        let foundTeam = existingTeamMap[key];
        if (foundTeam) return foundTeam;
        // Find the most similar old team (max overlap)
        let bestMatch = null;
        let bestOverlap = 0;
        for (const oldTeam of existingTeams) {
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
            competition_id: Number(id),
            name: group.name ? `${group.name} ${pairLabel}` : `Group ${i + 1} ${pairLabel}`,
            players: pairPlayers
          }
        });
        // Copy teams_users and scores from bestMatch if applicable
        if (bestMatch && Array.isArray(bestMatch.players)) {
          for (const player of pairPlayers) {
            if (bestMatch.players.includes(player)) {
              const user = await prisma.users.findFirst({ where: { name: player } });
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
                const oldScores = await prisma.scores.findMany({ where: { team_id: bestMatch.id, user_id: user.id, competition_id: Number(id) } });
                for (const score of oldScores) {
                  await prisma.scores.create({
                    data: {
                      competition_id: Number(id),
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
        }
        existingTeamMap[key] = foundTeam;
        return foundTeam;
      }

      // If this is a 4-player 4-ball and the competition is of 4BBB type, create/update two teams
      if (isFourBbb && Array.isArray(group.players) && group.players.length === 4) {
        const pairA = [group.players[0], group.players[1]];
        const pairB = [group.players[2], group.players[3]];
        await ensureTeamForPair(pairA, 'A');
        await ensureTeamForPair(pairB, 'B');
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
              competition_id: Number(id),
              name: group.name || `Group ${i + 1}`,
              players: group.players
            }
          });
          // Copy teams_users and scores from bestMatch if applicable
          if (bestMatch && Array.isArray(bestMatch.players)) {
            for (const player of group.players) {
              if (bestMatch.players.includes(player)) {
                const user = await prisma.users.findFirst({ where: { name: player } });
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
                  const oldScores = await prisma.scores.findMany({ where: { team_id: bestMatch.id, user_id: user.id, competition_id: Number(id) } });
                  for (const score of oldScores) {
                    await prisma.scores.create({
                      data: {
                        competition_id: Number(id),
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
          }
          existingTeamMap[key] = foundTeam;
        }
      }
      // Other sizes: skip
    }
    // Do NOT delete or update any existing teams, scores, or player info
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
              const tSet = new Set(team.players.map(p => p && p.trim && p.trim()));
              if (tSet.size === 2 && pairA.every(p => tSet.has(p))) {
                group.teamIds = group.teamIds || [];
                group.teamIds[0] = team.id;
              }
              if (tSet.size === 2 && pairB.every(p => tSet.has(p))) {
                group.teamIds = group.teamIds || [];
                group.teamIds[1] = team.id;
              }
            }
          } else {
            const groupSet = new Set(group.players.map(p => p && p.trim && p.trim()));
            for (const team of allTeams) {
              if (Array.isArray(team.players)) {
                const teamSet = new Set(team.players.map(p => p && p.trim && p.trim()));
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
            const user = users.find(u => u.name === playerName);
            if (!user) continue;
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
          }
        } else {
          // Single team mapping (old behavior)
          group.teamId = foundTeam ? foundTeam.id : null;
          if (foundTeam && Array.isArray(group.players)) {
            group.handicaps = {};
            group.teeboxes = {};
            for (const playerName of group.players) {
              const user = users.find(u => u.name === playerName);
              if (user) {
                const tu = await prisma.teams_users.findFirst({ where: { team_id: foundTeam.id, user_id: user.id } });
                if (tu) {
                  if (tu.course_handicap !== null && tu.course_handicap !== undefined) {
                    group.handicaps[playerName] = tu.course_handicap;
                  }
                  if (tu.teebox) {
                    group.teeboxes[playerName] = tu.teebox;
                  }
                }
              }
            }
          }
        }
      }
    }
    res.json({ ...compOut, debug, users });
  } catch (err) {
    console.error('Error fetching competition:', err);
    res.status(500).json({ error: 'Database error' });
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

// Save all scores for a player in a team for a competition
app.patch('/api/teams/:teamId/users/:userId/scores', async (req, res) => {
  const { teamId, userId } = req.params;
  const { competitionId, scores, bbScore } = req.body; // scores: array of 18 numbers/nulls, bbScore: optional number
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
      console.warn('Rejecting all-empty scores update for team/user (need allowClear=true to clear):', { teamId, userId, competitionId });
      return res.status(400).json({ error: 'No non-empty scores provided. To clear existing scores explicitly include { allowClear: true } in the request body.' });
    }
    // Audit logging: list of hole indexes that contain non-empty values and request origin info
    const touchedIndexes = scores.map((s, i) => ((s != null && s !== '') ? i : -1)).filter(i => i >= 0);
    const originSocket = req && req.headers && (req.headers['x-origin-socket'] || req.headers['X-Origin-Socket']) ? (req.headers['x-origin-socket'] || req.headers['X-Origin-Socket']) : null;
    const originIp = req && (req.ip || req.headers['x-forwarded-for'] || req.connection && req.connection.remoteAddress) ? (req.ip || req.headers['x-forwarded-for'] || (req.connection && req.connection.remoteAddress)) : 'unknown';
    console.log(`PATCH /api/teams/${teamId}/users/${userId}/scores payload: competitionId=${competitionId}, nonEmpty=${numNonEmpty}, allowClear=${allowClear}, touchedIndexes=[${touchedIndexes.join(',')}], originSocket=${originSocket || ''}, originIp=${originIp}`);
  } catch (e) {}
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
    // Find teams for competition
    const teams = await prisma.teams.findMany({ where: { competition_id: Number(compId) } });
    if (!teams || teams.length === 0) return res.status(404).json({ error: 'No teams found for competition' });
    const normalized = (s) => (s || '').trim().toLowerCase();
    let foundTeam = null;
    // Find team that contains this player name in its players array (string match)
    for (const t of teams) {
      if (Array.isArray(t.players)) {
        if (t.players.map(p => normalized(p)).includes(normalized(playerName))) {
          foundTeam = t;
          break;
        }
      }
    }
    if (!foundTeam) return res.status(404).json({ error: 'Team for player not found' });
    // Find user record by name (case-insensitive)
    const allUsers = await prisma.users.findMany();
    const user = allUsers.find(u => normalized(u.name) === normalized(playerName));
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Upsert teams_users record
    let record = await prisma.teams_users.findFirst({ where: { team_id: foundTeam.id, user_id: user.id } });
    const updateData = { fines: fines !== undefined && fines !== null ? Number(fines) : null };
    if (record) {
      record = await prisma.teams_users.update({ where: { id: record.id }, data: updateData });
    } else {
      record = await prisma.teams_users.create({ data: { team_id: foundTeam.id, user_id: user.id, ...updateData } });
    }
    try {
      if (foundTeam && foundTeam.competition_id && global.io) {
        global.io.to(`competition:${foundTeam.competition_id}`).emit('fines-updated', { competitionId: foundTeam.competition_id, teamId: foundTeam.id, userId: user.id });
      }
    } catch (e) {
      console.error('Error emitting fines-updated', e);
    }
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
      console.log(`Rebroadcasting client-medal-saved to competition:${compId}`);
      global.io.to(`competition:${compId}`).emit('medal-player-updated', payload);
    } catch (e) {
      console.error('Error handling client-medal-saved', e);
    }
  });
  // Clients may show optimistic popups locally. To ensure other viewers see
  // those popups even when the HTTP save didn't change server state (no
  // server-side popup emitted), allow clients to request a server rebroadcast
  // of a canonical popup-event via 'client-popup'. The server will attach
  // an eventId and originSocketId and use popupSignatureSeen to prevent dupes.
  socket.on('client-popup', (payload) => {
    try {
      const compId = Number(payload?.competitionId);
      if (!compId) return;
      const type = payload.type;
      const playerName = payload.playerName;
      const holeNumber = payload.holeNumber || null;
      const sig = payload.signature || payload.signature === 0 ? payload.signature : (type && playerName ? `${type}:${playerName}:${holeNumber}:${compId}` : null);
      if (!sig) return;
      // server-side dedupe to avoid rapid duplicate rebroadcasts
      if (popupSignatureSeen(sig)) return;
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
  console.log('PATCH Medal player:', { id, groupId, playerName, teebox, handicap, scores, waters, dog, two_clubs });
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
  console.log(`two_clubs debug: competition=${id} player=${playerName} par3Count=${par3Count} twoOnPar3=${twoOnPar3} computedTwoClubs=${computedTwoClubs}`);
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
              if (team) console.log(`two_clubs: matched team via normalized player name for player='${playerName}' -> team.id=${team.id}`);
            }
            if (team) {
              // Upsert teams_users record with computed two_clubs
              let tu = await prisma.teams_users.findFirst({ where: { team_id: team.id, user_id: user.id } });
              if (tu) {
                const updatedTu = await prisma.teams_users.update({ where: { id: tu.id }, data: { two_clubs: computedTwoClubs } });
                console.log(`two_clubs persisted: updated teams_users id=${updatedTu.id} team_id=${team.id} user_id=${user.id} two_clubs=${updatedTu.two_clubs}`);
              } else {
                const createdTu = await prisma.teams_users.create({ data: { team_id: team.id, user_id: user.id, two_clubs: computedTwoClubs } });
                console.log(`two_clubs persisted: created teams_users id=${createdTu.id} team_id=${team.id} user_id=${user.id} two_clubs=${createdTu.two_clubs}`);
              }
            } else {
              console.log(`two_clubs persistence: team not found for competition=${id} player=${playerName}`);
            }
          } else {
            console.log(`two_clubs persistence: user not found for playerName='${playerName}'`);
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
    console.log('Updated groups:', JSON.stringify(comp.groups));
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
  console.log('GET Medal player:', { id, groupId, playerName });
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
    console.log('GET Medal response:', { teebox, handicap, scores, waters, dog, two_clubs });
    res.json({ teebox, handicap, scores, waters, dog, two_clubs });
  } catch (err) {
    console.error('Error fetching Medal player data:', err);
    res.status(500).json({ error: 'Database error' });
  }
});