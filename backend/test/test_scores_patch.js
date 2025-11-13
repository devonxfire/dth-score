#!/usr/bin/env node
// Small test harness for PATCH /api/teams/:teamId/users/:userId/scores
// Usage:
//   BACKEND_URL=http://localhost:3000 COMPETITION_ID=185 TEAM_ID=226 USER_ID=30 node test_scores_patch.js
// Optional: TARGET_INDEX (0-based) to pick which hole the client sends a value for (default 11)

async function main() {
  const base = process.env.BACKEND_URL || 'http://localhost:3000';
  const compId = process.env.COMPETITION_ID || process.argv[2];
  const teamId = process.env.TEAM_ID || process.argv[3];
  const userId = process.env.USER_ID || process.argv[4];
  const targetIndex = Number(process.env.TARGET_INDEX || process.argv[5] || 11);

  if (!compId || !teamId || !userId) {
    console.error('Missing required params. Provide COMPETITION_ID, TEAM_ID and USER_ID as env vars or args.');
    console.error('Example: BACKEND_URL=http://localhost:3000 COMPETITION_ID=185 TEAM_ID=226 USER_ID=30 node test_scores_patch.js');
    process.exit(2);
  }

  const fetch = globalThis.fetch;
  if (!fetch) {
    console.error('Global fetch() is not available in this Node. Run with Node 18+ or add a fetch polyfill.');
    process.exit(2);
  }

  const getScores = async () => {
    const url = `${base}/api/teams/${teamId}/users/${userId}/scores?competitionId=${compId}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`GET scores failed: ${r.status} ${await r.text()}`);
    return r.json();
  };

  const patchScores = async (scores, opts = {}) => {
    const url = `${base}/api/teams/${teamId}/users/${userId}/scores`;
    const body = Object.assign({ competitionId: Number(compId), scores }, opts);
    const r = await fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { json = text; }
    return { status: r.status, body: json };
  };

  console.log('Using', { base, compId, teamId, userId, targetIndex });

  // 1) Read baseline
  const before = await getScores();
  console.log('Before scores:', JSON.stringify(before.scores));

  // 2) Send PATCH that contains only one non-empty index and empty strings everywhere else
  const payload1 = Array(18).fill('');
  payload1[targetIndex] = '5';
  console.log('Sending PATCH with single filled index:', targetIndex);
  const res1 = await patchScores(payload1);
  console.log('PATCH response:', res1.status, JSON.stringify(res1.body));

  const after1 = await getScores();
  console.log('After scores:', JSON.stringify(after1.scores));

  // Evaluate: any index other than targetIndex that was non-empty before should still be the same
  let ok = true;
  for (let i = 0; i < 18; i++) {
    const beforeVal = before.scores[i];
    const afterVal = after1.scores[i];
    const beforeNonEmpty = beforeVal !== null && beforeVal !== '' && beforeVal !== undefined;
    if (i === targetIndex) continue;
    if (beforeNonEmpty) {
      // Compare string/number equivalently
      const beforeStr = String(beforeVal);
      const afterStr = afterVal === null || afterVal === undefined ? '' : String(afterVal);
      if (beforeStr !== afterStr) {
        console.error(`Regression: hole ${i+1} was '${beforeStr}' before but is now '${afterStr}'`);
        ok = false;
      }
    }
  }

  if (ok) console.log('PASS: non-touched holes preserved after single-index PATCH');
  else console.error('FAIL: some non-touched holes were cleared/changed');

  // 3) Test all-empty array without allowClear (should be rejected)
  const payload2 = Array(18).fill('');
  console.log('Sending all-empty PATCH (expect 400 rejection)');
  const res2 = await patchScores(payload2);
  console.log('All-empty PATCH response:', res2.status, JSON.stringify(res2.body));
  if (res2.status === 400) console.log('PASS: all-empty patch rejected as expected');
  else console.error('WARNING: all-empty patch was accepted (unexpected)');

  process.exit(ok && res2.status === 400 ? 0 : 3);
}

main().catch(err => { console.error('Test failed:', err && err.stack ? err.stack : err); process.exit(1); });
