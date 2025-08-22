-- Competitions table
CREATE TABLE competitions (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    type VARCHAR(50) NOT NULL,
    club VARCHAR(100),
    handicapAllowance VARCHAR(10),
    joinCode VARCHAR(20),
    notes TEXT,
    groups JSONB,
    course_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teams table
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    competition_id INTEGER REFERENCES competitions(id) ON DELETE CASCADE,
    name VARCHAR(100)
);

-- Holes table
CREATE TABLE holes (
    id SERIAL PRIMARY KEY,
    competition_id INTEGER REFERENCES competitions(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    par INTEGER NOT NULL,
    stroke_index INTEGER NOT NULL
);

CREATE TABLE teams_users (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    teebox VARCHAR(20),
    course_handicap NUMERIC(4,1)
);

-- Scores table
CREATE TABLE scores (
    id SERIAL PRIMARY KEY,
    competition_id INTEGER REFERENCES competitions(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    hole_id INTEGER REFERENCES holes(id) ON DELETE CASCADE,
    strokes INTEGER,
    points INTEGER
);