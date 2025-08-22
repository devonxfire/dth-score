

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
  try {
    const result = await pool.query(
      'UPDATE competitions SET groups = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(groups), id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Competition not found' });
    }
    res.json({ success: true, competition: result.rows[0] });
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
    const result = await pool.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get all competitions
app.get('/api/competitions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM competitions ORDER BY date DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching competitions:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get competition by ID
app.get('/api/competitions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM competitions WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Competition not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching competition:', err);
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
    const result = await pool.query('DELETE FROM competitions WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
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
    const result = await pool.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);
    if (result.rows.length === 1) {
      res.json({ success: true, user: result.rows[0] });
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
    const result = await pool.query(
      `UPDATE team_members
       SET teebox = $1, course_handicap = $2
       WHERE team_id = $3 AND user_id = $4
       RETURNING *`,
      [teebox, course_handicap, teamId, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating team_members:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Fetch a player's tee and course handicap for a team
app.get('/api/teams/:teamId/users/:userId', async (req, res) => {
  const { teamId, userId } = req.params;
  try {
    const result = await pool.query(
      `SELECT teebox, course_handicap FROM team_members WHERE team_id = $1 AND user_id = $2`,
      [teamId, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching team_members:', err);
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
  if (!date || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  // Always generate a unique join code if not provided or empty
  if (!joinCode) joinCode = generateJoinCode();
  try {
    const result = await pool.query(
      `INSERT INTO competitions 
        (date, type, club, handicapAllowance, joinCode, notes, groups, course_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NOW())
        RETURNING *`,
      [date, type, club, handicapAllowance, joinCode, notes, groups ? JSON.stringify(groups) : null]
    );
    const comp = result.rows[0];
    // Defensive: if joinCode is missing from DB row, add it from variable
    if (!comp.joincode && joinCode) comp.joincode = joinCode;
    res.status(201).json({ success: true, competition: comp });
  } catch (err) {
    console.error('Error creating competition:', err);
    res.status(500).json({ error: 'Database error' });
  }
});
