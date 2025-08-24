



require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
app.use(cors());
app.use(express.json());

const prisma = new PrismaClient();

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
  try {
    // Update groups in competitions table
    const updated = await prisma.competitions.update({
      where: { id: Number(id) },
      data: { groups: groups },
    });
    // For each group, ensure a team exists in the teams table
    for (const [i, group] of groups.entries()) {
      if (!Array.isArray(group.players) || group.players.length === 0) continue;
      // Try to find an existing team for this comp with the same players
      const existingTeam = await prisma.teams.findFirst({
        where: {
          competition_id: Number(id),
          players: { equals: group.players }
        }
      });
      if (!existingTeam) {
        await prisma.teams.create({
          data: {
            competition_id: Number(id),
            name: group.name || `Group ${i + 1}`,
            players: group.players
          }
        });
      }
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
    // Automatically seed 18 holes for this competition
    const holesData = Array.from({ length: 18 }, (_, i) => ({
      number: i + 1,
      competition_id: comp.id,
      par: 4, // Default par, adjust as needed
      stroke_index: i + 1 // Default stroke index, adjust as needed
    }));
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
    const comp = await prisma.competitions.findUnique({ where: { id: Number(id) } });
    if (!comp) {
      return res.status(404).json({ error: 'Competition not found' });
    }
    // Deep copy to avoid mutating DB object
    let compOut = JSON.parse(JSON.stringify(comp));
    let debug = [];
    let users = await prisma.users.findMany();
    if (Array.isArray(compOut.groups)) {
      // Fetch all teams for this competition once
      const allTeams = await prisma.teams.findMany({ where: { competition_id: Number(id) } });
      for (const group of compOut.groups) {
        // Collect debug info
        let groupDebug = { groupPlayers: group.players };
        // Robustly match group to team by comparing sets of player names (ignoring order/whitespace)
        let foundTeam = null;
        if (Array.isArray(group.players)) {
          const groupSet = new Set(group.players.map(p => p && p.trim && p.trim()));
          for (const team of allTeams) {
            if (Array.isArray(team.players)) {
              const teamSet = new Set(team.players.map(p => p && p.trim && p.trim()));
              if (groupSet.size === teamSet.size && [...groupSet].every(p => teamSet.has(p))) {
                foundTeam = team;
                break;
              }
            }
          }
        }
        groupDebug.foundTeam = foundTeam;
        debug.push(groupDebug);
        if (foundTeam) {
          group.teamId = foundTeam.id;
        }
        if (foundTeam && Array.isArray(group.players)) {
          // Build lookup for player handicaps and teeboxes
          group.handicaps = {};
          group.teeboxes = {};
          for (const playerName of group.players) {
            // Try to find user by name
            const user = users.find(u => u.name === playerName);
            if (user) {
              const tu = await prisma.teams_users.findFirst({
                where: { team_id: foundTeam.id, user_id: user.id }
              });
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
  const { competitionId, scores } = req.body; // scores: array of 18 numbers/nulls
  if (!competitionId || !Array.isArray(scores) || scores.length !== 18) {
    return res.status(400).json({ error: 'competitionId and 18 scores required' });
  }
  try {
    console.log('PATCH /api/teams/:teamId/users/:userId/scores called');
    console.log('Params:', req.params);
    console.log('Body:', req.body);
    // Fetch holes for this competition, ordered by number (1-18)
    const holes = await prisma.holes.findMany({
      where: { competition_id: Number(competitionId) },
      orderBy: { number: 'asc' }
    });
    for (let i = 0; i < 18; i++) {
      const strokes = scores[i];
      const hole = holes[i];
      if (!hole) {
        console.log(`Skipping hole index ${i}: no hole found`);
        continue;
      }
      if (strokes == null || strokes === '') {
        // Delete score record if exists
        await prisma.scores.deleteMany({
          where: {
            competition_id: Number(competitionId),
            team_id: Number(teamId),
            user_id: Number(userId),
            hole_id: hole.id
          }
        });
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
      console.log(`Upserting score for hole #${i+1} (hole_id=${hole.id}):`, upsertData);
      await prisma.scores.upsert(upsertData);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/teams/:teamId/users/:userId/scores error:', err && err.stack ? err.stack : err);
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
    const user = await prisma.users.findFirst({ where: { username, password } });
    if (user) {
      res.json({ success: true, user });
    } else {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update a player's tee and course handicap for a team
app.patch('/api/teams/:teamId/users/:userId', async (req, res) => {
  const { teamId, userId } = req.params;
  const { teebox, course_handicap } = req.body;
  try {
    let record = await prisma.teams_users.findFirst({
      where: {
        team_id: Number(teamId),
        user_id: Number(userId)
      }
    });
    if (record) {
      record = await prisma.teams_users.update({
        where: { id: record.id },
        data: {
          teebox,
          course_handicap: course_handicap ? Number(course_handicap) : null
        }
      });
    } else {
      record = await prisma.teams_users.create({
        data: {
          team_id: Number(teamId),
          user_id: Number(userId),
          teebox,
          course_handicap: course_handicap ? Number(course_handicap) : null
        }
      });
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
        course_handicap: true
      }
    });
    if (!record) return res.status(404).json({ error: 'Not found' });
    res.json(record);
  } catch (err) {
    console.error('Error fetching teams_users:', err);
    res.status(500).json({ error: 'Database error' });
  }
});
// Helper to generate a 6-character alphanumeric join code
function generateJoinCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


// Create Competition endpoint
app.post('/api/competitions', async (req, res) => {
  console.log('POST /api/competitions body:', req.body);
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
