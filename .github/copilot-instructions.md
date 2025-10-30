<!-- Copilot / AI assistant instructions for the dth-score repository -->

This file contains focused, practical guidance for an AI coding assistant that needs to become productive in this repository quickly.

High-level architecture
- Backend: `backend/` — Node (CommonJS), Express + Prisma. Main server: `backend/index.js`. DB schema: `backend/prisma/schema.prisma` and top-level `schema.sql`.
- Frontend: `frontend/` — React + Vite + Tailwind. Vite plugin used: `@tailwindcss/vite`. Key files: `frontend/vite.config.js`, `frontend/src/api.js`, `frontend/src/*.jsx`.
- Data flow: Frontend calls REST endpoints under `/api/*` on the backend. Backend uses Prisma to read/write Postgres tables (competitions, teams, users, scores, teams_users, holes).

Critical files and what they contain
- `backend/index.js` — All server endpoints. Important endpoints to know:
  - GET `/api/competitions`, POST `/api/competitions` (create + auto-seed holes)
  - GET `/api/competitions/:id` (returns competition with `groups` + debug info)
  - PATCH `/api/teams/:teamId/users/:userId/scores` — core 4BBB scoring calculation; updates `team_points`.
  - PATCH `/api/competitions/:compId/players/:playerName/fines` — fallback upsert for fines by player name.
  - Medal-specific endpoints: GET/PATCH `/api/competitions/:id/groups/:groupId/player/:playerName`.
- `frontend/src/api.js` — central helper: exports `API_BASE` (uses `import.meta.env.VITE_API_BASE`) and `apiUrl(path)` used across components. Prefer using this helper rather than hardcoding URLs.
- `frontend/vite.config.js` — contains Tailwind plugin and (important) a small fallback line to force Lightning CSS WASM when the environment variable isn't set:
  `process.env.LIGHTNING_CSS_FORCE_WASM = process.env.LIGHTNING_CSS_FORCE_WASM || '1'`

Developer workflows (how to run / build / debug)
- Local backend:
  - Install: `cd backend && npm install`
  - Run: `node index.js` (or run via your Node debugger). No `start` script in `package.json`; use `node index.js` or add a script if you prefer.
  - Prisma dev: run migrations and introspection as normal: `npx prisma migrate dev` / `npx prisma db pull`.
- Local frontend:
  - Install + dev: `cd frontend && npm install && npm run dev`
  - Production build: `cd frontend && npm install && npm run build`
  - If builds fail with lightningcss native-binary errors, set the env var when building:
    `export LIGHTNING_CSS_FORCE_WASM=1 && npm run build`
  - The project also contains a safe fallback in `vite.config.js` to set `LIGHTNING_CSS_FORCE_WASM` if omitted.

Vercel / deployment notes
- Project root for the frontend must be the `frontend/` folder. Recommended Vercel settings:
  - Root Directory: `frontend`
  - Install command: `npm install`
  - Build command: `npm run build`
  - Output directory: Vite defaults to `dist` (no change required)
- Required environment variables (set for Production & Preview):
  - `VITE_API_BASE` = https://dth-score.onrender.com (or your backend URL)
  - `LIGHTNING_CSS_FORCE_WASM` = 1

Project-specific conventions & notable patterns
- Env var prefix: frontend expects runtime build-time vars using the `VITE_` prefix (e.g. `VITE_API_BASE`). Use `import.meta.env.VITE_API_BASE` or the `apiUrl` helper.
- API helper: `frontend/src/api.js` centralizes the base URL. Search/modify frontend code by looking for `apiUrl(` calls.
- Database interactions: backend uses Prisma and `upsert` patterns (e.g., scores upsert keyed by competition_id/team_id/user_id/hole_id).
- Team matching: when matching `groups` from the competition JSON to `teams` rows, the server compares normalized player name sets — handle whitespace/order variations when adding features.

Common pitfalls & debugging tips
- Vercel build error: "Cannot find module '../lightningcss.linux-x64-gnu.node'"
  - Root cause: `lightningcss` tries to load a platform-native binary during the build. Fixes:
    - Set `LIGHTNING_CSS_FORCE_WASM=1` in Vercel env (or locally when building).
    - The repo contains a small fallback in `frontend/vite.config.js` to set the env var if missing.
- PostCSS / Tailwind confusion
  - Do not mix a hand-written `postcss.config.cjs` that directly `require('tailwindcss')` with `@tailwindcss/vite`. If you add PostCSS config, also install and pin compatible `postcss`/`autoprefixer` versions.
- Backend debugging
  - The server logs helpful console messages (many endpoints log request params). Use these logs and Prisma query output to trace data issues.

Quick reference (files & commands)
- Backend main: `backend/index.js`
- Frontend main: `frontend/src/main.jsx` and `frontend/src/api.js`
- DB schema: `backend/prisma/schema.prisma`, root `schema.sql`
- Local dev backend: `cd backend && npm install && node index.js`
- Local dev frontend: `cd frontend && npm install && npm run dev`
- Local prod build (force lightningcss WASM if needed):
  `cd frontend && export LIGHTNING_CSS_FORCE_WASM=1 && npm run build`

When you're unsure, look in `backend/index.js` first — it contains the authoritative business logic for scoring, fines, and group/team behavior.

If anything here is unclear or you want more detail (examples of common edits, test harnesses, or a checklist for PR reviews), tell me which area to expand and I'll update this file.
