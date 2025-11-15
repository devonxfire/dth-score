const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Usage: node set_course_handicaps.js <json-string-or-path-to-json-file>');
    console.error('Example (inline): node set_course_handicaps.js "[{\"teamId\":285,\"userId\":10,\"course_handicap\":12},{\"teamId\":286,\"userId\":1,\"course_handicap\":11}]"');
    console.error('Example (file): node set_course_handicaps.js ./handicaps.json');
    process.exit(1);
  }

  let payload;
  try {
    if (raw.trim().startsWith('{') || raw.trim().startsWith('[')) {
      payload = JSON.parse(raw);
    } else {
      const filePath = path.resolve(process.cwd(), raw);
      payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to parse input JSON:', e.message);
    process.exit(1);
  }

  // Accept either an object map {"285:10": 12} or an array of objects [{teamId,userId,course_handicap}]
  let actions = [];
  if (Array.isArray(payload)) {
    actions = payload.map(p => ({ teamId: Number(p.teamId), userId: Number(p.userId), course_handicap: p.course_handicap === null ? null : Number(p.course_handicap) }));
  } else if (typeof payload === 'object') {
    // object where key is "teamId:userId" or "teamId_userId"
    for (const k of Object.keys(payload)) {
      const v = payload[k];
      const parts = k.split(/[:_]/).map(s => Number(s));
      if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
        actions.push({ teamId: parts[0], userId: parts[1], course_handicap: v === null ? null : Number(v) });
      }
    }
  }

  if (actions.length === 0) {
    console.error('No valid actions parsed from input. Expected an array of {teamId,userId,course_handicap} or a map.');
    process.exit(1);
  }

  try {
    for (const a of actions) {
      if (!Number.isFinite(a.teamId) || !Number.isFinite(a.userId)) {
        console.warn('Skipping invalid entry', a);
        continue;
      }
      console.log(`Updating team_id=${a.teamId} user_id=${a.userId} -> course_handicap=${a.course_handicap}`);
      const res = await prisma.teams_users.updateMany({ where: { team_id: a.teamId, user_id: a.userId }, data: { course_handicap: a.course_handicap } });
      if (res.count === 0) {
        console.warn(`No teams_users row found for team_id=${a.teamId} user_id=${a.userId}. Consider creating teams_users rows first.`);
      } else {
        console.log(`Updated ${res.count} row(s)`);
      }
    }

    // Print verification for all affected teams
    const teamIds = Array.from(new Set(actions.map(a => a.teamId).filter(Boolean)));
    const where = teamIds.length > 0 ? { team_id: { in: teamIds } } : undefined;
    const rows = await prisma.teams_users.findMany({ where, include: { users: true, teams: true } });
    console.log('Current teams_users rows for affected teams:');
    for (const r of rows) {
      console.log(JSON.stringify({ id: r.id, team_id: r.team_id, user_id: r.user_id, course_handicap: r.course_handicap, userName: r.users?.name, teamName: r.teams?.name }, null, 2));
    }
  } catch (e) {
    console.error('Error updating teams_users:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
