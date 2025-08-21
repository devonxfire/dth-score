
// ...existing code...


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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


// Create Competition endpoint
app.post('/api/competitions', async (req, res) => {
  const { name, date, type, club, handicapAllowance, joinCode, code, notes, groups } = req.body;
  if (!name || !date || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO competitions 
        (name, date, type, club, handicapAllowance, joinCode, code, notes, groups, course_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, NOW())
        RETURNING *`,
      [name, date, type, club, handicapAllowance, joinCode, code, notes, groups ? JSON.stringify(groups) : null]
    );
    res.status(201).json({ success: true, competition: result.rows[0] });
  } catch (err) {
    console.error('Error creating competition:', err);
    res.status(500).json({ error: 'Database error' });
  }
});
