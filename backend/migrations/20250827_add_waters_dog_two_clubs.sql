-- Migration: Add waters, dog, and two_clubs columns to teams_users
ALTER TABLE teams_users
  ADD COLUMN waters INTEGER DEFAULT 0,
  ADD COLUMN dog BOOLEAN DEFAULT FALSE,
  ADD COLUMN two_clubs INTEGER DEFAULT 0;
