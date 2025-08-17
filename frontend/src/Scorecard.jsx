
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageBackground from './PageBackground';

const COMP_TYPE_DISPLAY = {
  fourBbbStableford: '4BBB Stableford (2 Scores to Count)',
  alliance: 'Alliance',
  medalStrokeplay: 'Medal Strokeplay',
  individualStableford: 'Individual Stableford',
};

// Westlake Golf Club holes: par and stroke index

const defaultHoles = [
  { number: 1, par: 4, index: 5 },
  { number: 2, par: 4, index: 7 },
  { number: 3, par: 3, index: 17 },
  { number: 4, par: 5, index: 1 },
  { number: 5, par: 4, index: 11 },
  { number: 6, par: 3, index: 15 },
  { number: 7, par: 5, index: 3 },
  { number: 8, par: 4, index: 13 },
  { number: 9, par: 4, index: 9 },
  { number: 10, par: 4, index: 10 },
  { number: 11, par: 4, index: 4 },
  { number: 12, par: 4, index: 12 },
  { number: 13, par: 5, index: 2 },
  { number: 14, par: 4, index: 14 },
  { number: 15, par: 3, index: 18 },
  { number: 16, par: 5, index: 6 },
  { number: 17, par: 3, index: 16 },
  { number: 18, par: 4, index: 8 },
];

export default function Scorecard(props) {
  const location = useLocation();
  const player = location.state?.player || { name: 'Player', handicap: '', teebox: '', code: '' };
  // Use competition from location.state if present, else fallback
  const competition = location.state?.competition || {
    type: '4BBB Stableford (2 Scores to Count)',
    date: '2025-08-13',
    handicapAllowance: '95',
    fourballs: '4',
    notes: 'Example notes',
  };
  // Alliance logic: get group members if Alliance comp
  const isAlliance = competition.type?.toLowerCase().includes('alliance');
  let groupPlayers = [player.name];
  if (isAlliance) {
    // Try to get group from comp data in localStorage
    try {
      const compData = JSON.parse(localStorage.getItem(`comp_${player.code}`));
      const group = compData?.groups?.find(g => g.players?.includes(player.name));
      if (group) groupPlayers = group.players;
    } catch {}
  }
  const navigate = useNavigate();
  // Calculate playing handicap (adjusted)
  const fullHandicap = player.handicap || '';
  const allowance = competition.handicapAllowance ? parseFloat(competition.handicapAllowance) : 100;
  const playingHandicap = fullHandicap ? Math.round((parseFloat(fullHandicap) * allowance) / 100) : '';
  // Format date as DD/MM/YYYY
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }
  // For Alliance: scores is 2D array [playerIdx][holeIdx]
  const [scores, setScores] = useState(
    isAlliance
      ? Array(groupPlayers.length).fill(0).map(() => Array(18).fill(''))
      : Array(18).fill('')
  );

  function handleScoreChange(idx, value, playerIdx = 0) {
    if (isAlliance) {
      const newScores = scores.map(arr => [...arr]);
      newScores[playerIdx][idx] = value;
      setScores(newScores);
    } else {
      const newScores = [...scores];
      newScores[idx] = value;
      setScores(newScores);
    }
  }


  function totalScore(playerIdx = 0) {
    if (isAlliance) {
      return scores[playerIdx].reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    }
    return scores.reduce((sum, val) => sum + (parseInt(val) || 0), 0);
  }

  // Calculate playing handicap (shots to allocate)
  function getPlayingHandicap() {
    return playingHandicap ? parseInt(playingHandicap) : 0;
  }

  // Determine comp type
  const isMedal = competition.type?.toLowerCase().includes('medal');
  const isStableford = competition.type?.toLowerCase().includes('stableford');

  // Calculate Stableford points per hole (for Stableford only)
  function getPointsPerHole(playerIdx = 0) {
    if (!isStableford && !isAlliance) return [];
    // For Alliance, calculate for each player
    const getPoints = (gross, ph, hole) => {
      if (!gross) return '';
      let shots = 0;
      if (ph > 0) {
        shots = Math.floor(ph / 18);
        if (hole.index <= (ph % 18)) shots += 1;
      }
      const net = gross - shots;
      const par = hole.par;
      if (net === par - 2) return 4;
      if (net === par - 1) return 3;
      if (net === par) return 2;
      if (net === par + 1) return 1;
      return 0;
    };
    if (isAlliance) {
      // Return 2D array: [playerIdx][holeIdx]
      return scores.map((playerScores, pIdx) =>
        playerScores.map((score, hIdx) => {
          // Get handicap for this player
          // For now, assume all group members have same handicap as entered (can be improved)
          const ph = getPlayingHandicap();
          return getPoints(parseInt(score || 0), ph, defaultHoles[hIdx]);
        })
      );
    } else {
      const ph = getPlayingHandicap();
      return defaultHoles.map((hole, i) => getPoints(parseInt(scores[i] || 0), ph, hole));
    }
  }

  function totalPoints(playerIdx = 0) {
    if (isAlliance) {
      return getPointsPerHole()[playerIdx].reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    }
    return getPointsPerHole().reduce((sum, val) => sum + (parseInt(val) || 0), 0);
  }

  // Medal: Net per hole and total
  function getNetPerHole() {
    if (!isMedal) return [];
    const ph = getPlayingHandicap();
    // Allocate shots per hole
    let shotsPerHole = Array(18).fill(Math.floor(ph / 18));
    for (let i = 0; i < ph % 18; i++) {
      // Find hole with index == i+1
      const idx = defaultHoles.findIndex(h => h.index === i + 1);
      if (idx !== -1) shotsPerHole[idx] += 1;
    }
    return scores.map((score, idx) => {
      if (!score) return '';
      return parseInt(score) - shotsPerHole[idx];
    });
  }
  function totalNet() {
    return getNetPerHole().reduce((sum, val) => sum + (parseInt(val) || 0), 0);
  }

  function handleSaveScores() {
    let entries = [];
    if (isAlliance) {
      // Save one entry per group member, with their scores
      entries = groupPlayers.map((name, idx) => ({
        player: { ...player, name },
        scores: scores[idx],
        total: totalScore(idx),
        date: competition.date,
        competitionType: competition.type,
      }));
    } else {
      entries = [{
        player,
        scores,
        total: totalScore(),
        date: competition.date,
        competitionType: competition.type,
      }];
    }
    const prev = JSON.parse(localStorage.getItem('scores') || '[]');
    localStorage.setItem('scores', JSON.stringify([...prev, ...entries]));
    alert('Scores saved!');
  }


  return (
    <PageBackground>
      <div className="flex flex-col items-center px-4 mt-12">
        <h2 className="text-3xl font-bold text-white mb-6 drop-shadow-lg text-center">
          {isAlliance
            ? `${groupPlayers.join(', ')}'s Scorecard`
            : player.name
              ? `${player.name}'s Scorecard`
              : 'Scorecard'}
        </h2>
      </div>
      <div className="flex flex-col items-center px-4 mt-8">
        <div className="w-full max-w-3xl rounded-2xl shadow-lg bg-transparent text-white mb-8" style={{ backdropFilter: 'none' }}>
          <div className="flex justify-between mb-2">
            <button
              onClick={() => navigate('/')}
              className="py-2 px-4 bg-transparent border border-white text-white rounded-2xl hover:bg-white hover:text-black transition mr-2"
            >
              Home
            </button>
          </div>
          <div className="mb-2 text-white/90">
            <span className="font-semibold">Competition:</span> {COMP_TYPE_DISPLAY[competition.type] || competition.type?.replace(/(^|\s|_)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase()).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/-/g, ' ')} <br />
            <span className="font-semibold">Date:</span> {formatDate(competition.date)} <br />
            <span className="font-semibold">Tee Box:</span> {player.teebox} <br />
            <span className="font-semibold">Handicap Allowance:</span> {competition.handicapAllowance}% <br />
            <span className="font-semibold">4 Balls:</span> {competition.fourballs} <br />
            {competition.notes && <><span className="font-semibold">Notes from Captain:</span> {competition.notes} <br /></>}
          </div>
          {isAlliance && (
            <div className="mb-4">
              <div className="font-semibold mb-1">Group Members:</div>
              <ul className="mb-2">
                {groupPlayers.map((name, idx) => {
                  if (name === player.name) {
                    return (
                      <li key={name} className="mb-1">
                        <span className="font-semibold">{name}</span>
                        <span className="ml-2 text-green-200">Playing Handicap: {playingHandicap}</span>
                      </li>
                    );
                  }
                  let joined = null;
                  try {
                    const allScores = JSON.parse(localStorage.getItem('scores') || '[]');
                    joined = allScores.find(e => e.player?.name === name && e.competitionType === competition.type && e.date === competition.date);
                  } catch {}
                  let ph = '';
                  if (joined) {
                    const full = parseFloat(joined.player?.handicap || 0);
                    const allowance = competition.handicapAllowance ? parseFloat(competition.handicapAllowance) : 100;
                    ph = full ? Math.round((full * allowance) / 100) : '';
                  }
                  return (
                    <li key={name} className="mb-1">
                      <span className="font-semibold">{name}</span>
                      {joined ? (
                        <span className="ml-2 text-green-200">Playing Handicap: {ph}</span>
                      ) : (
                        <span className="ml-2 text-red-200">NOT JOINED YET</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <div className="overflow-x-auto">
            {isAlliance ? (
              <table className="min-w-full border text-center">
                <thead>
                  <tr>
                    <th className="border px-2 py-1 bg-white/10">Player</th>
                    {defaultHoles.map(hole => (
                      <th key={hole.number} className="border px-2 py-1 bg-white/10">{hole.number}</th>
                    ))}
                    <th className="border px-2 py-1 bg-white/10">Total</th>
                  </tr>
                  <tr>
                    <th className="border px-2 py-1 bg-white/5">HOLE</th>
                    {defaultHoles.map(hole => (
                      <th key={hole.number} className="border px-2 py-1 bg-white/5">{hole.number}</th>
                    ))}
                    <th className="border px-2 py-1 bg-white/5"></th>
                  </tr>
                  <tr>
                    <th className="border px-2 py-1 bg-white/5">PAR</th>
                    {defaultHoles.map(hole => (
                      <th key={hole.number} className="border px-2 py-1 bg-white/5">{hole.par}</th>
                    ))}
                    <th className="border px-2 py-1 bg-white/5"></th>
                  </tr>
                  <tr>
                    <th className="border px-2 py-1 bg-white/5">STROKE</th>
                    {defaultHoles.map(hole => (
                      <th key={hole.number} className="border px-2 py-1 bg-white/5">{hole.index}</th>
                    ))}
                    <th className="border px-2 py-1 bg-white/5"></th>
                  </tr>
                </thead>
                <tbody>
                  {groupPlayers.map((name, pIdx) => (
                    <tr key={name}>
                      <td className="border px-2 py-1 font-semibold text-left">{name}</td>
                      {defaultHoles.map((hole, hIdx) => (
                        <td key={hIdx} className="border px-1 py-1">
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={scores[pIdx][hIdx]}
                            onChange={e => handleScoreChange(hIdx, e.target.value, pIdx)}
                            className="w-12 text-center rounded bg-white/10 text-white border border-white/30 focus:outline-none"
                          />
                        </td>
                      ))}
                      <td className="border px-2 py-1 font-bold">{totalScore(pIdx)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th className="border px-2 py-1 bg-green-900/60 text-green-200">RESULT</th>
                    {defaultHoles.map((hole, hIdx) => {
                      // Calculate Stableford points for each player for this hole
                      const points = groupPlayers.map((name, pIdx) => {
                        // Try to get playing handicap for each player from scores, group, or player object
                        let ph = null;
                        // 1. Try from competition.groups (if available)
                        if (isAlliance && competition.groups) {
                          const group = competition.groups.find(g => g.players?.includes(name));
                          if (group && group.handicaps && group.handicaps[name] !== undefined) {
                            ph = parseInt(group.handicaps[name]);
                          }
                        }
                        // 2. Try from scores array (if saved previously)
                        if (ph === null && Array.isArray(window.scores)) {
                          const entry = window.scores.find(e => e.player?.name === name && e.competitionType === competition.type && e.date === competition.date);
                          if (entry && entry.player && entry.player.handicap) {
                            ph = Math.round(parseFloat(entry.player.handicap) * (parseFloat(competition.handicapAllowance) || 100) / 100);
                          }
                        }
                        // 3. Try from player object (if this is the logged-in user)
                        if (ph === null && player && player.name === name && player.handicap) {
                          ph = Math.round(parseFloat(player.handicap) * (parseFloat(competition.handicapAllowance) || 100) / 100);
                        }
                        // 4. Fallback to 0
                        if (ph === null) ph = 0;
                        const gross = parseInt(scores[pIdx][hIdx] || 0);
                        if (!gross) return 0;
                        let shots = 0;
                        if (ph > 0) {
                          shots = Math.floor(ph / 18);
                          if (hole.index <= (ph % 18)) shots += 1;
                        }
                        const net = gross - shots;
                        if (net === hole.par - 2) return 4;
                        if (net === hole.par - 1) return 3;
                        if (net === hole.par) return 2;
                        if (net === hole.par + 1) return 1;
                        return 0;
                      });
                      // Take the best 2 scores for this hole
                      const best2 = [...points].sort((a, b) => b - a).slice(0, 2);
                      const sum = best2.reduce((a, b) => a + b, 0);
                      return (
                        <th key={hIdx} className="border px-2 py-1 bg-green-900/60 text-green-200">{sum}</th>
                      );
                    })}
                    <th className="border px-2 py-1 bg-green-900/60 text-green-200 font-bold">
                      {/* Total team points: sum of all best2 sums */}
                      {defaultHoles.reduce((total, hole, hIdx) => {
                        const points = groupPlayers.map((name, pIdx) => {
                          let ph = null;
                          if (isAlliance && competition.groups) {
                            const group = competition.groups.find(g => g.players?.includes(name));
                            if (group && group.handicaps && group.handicaps[name] !== undefined) {
                              ph = parseInt(group.handicaps[name]);
                            }
                          }
                          if (ph === null && Array.isArray(window.scores)) {
                            const entry = window.scores.find(e => e.player?.name === name && e.competitionType === competition.type && e.date === competition.date);
                            if (entry && entry.player && entry.player.handicap) {
                              ph = Math.round(parseFloat(entry.player.handicap) * (parseFloat(competition.handicapAllowance) || 100) / 100);
                            }
                          }
                          if (ph === null && player && player.name === name && player.handicap) {
                            ph = Math.round(parseFloat(player.handicap) * (parseFloat(competition.handicapAllowance) || 100) / 100);
                          }
                          if (ph === null) ph = 0;
                          const gross = parseInt(scores[pIdx][hIdx] || 0);
                          if (!gross) return 0;
                          let shots = 0;
                          if (ph > 0) {
                            shots = Math.floor(ph / 18);
                            if (hole.index <= (ph % 18)) shots += 1;
                          }
                          const net = gross - shots;
                          if (net === hole.par - 2) return 4;
                          if (net === hole.par - 1) return 3;
                          if (net === hole.par) return 2;
                          if (net === hole.par + 1) return 1;
                          return 0;
                        });
                        const best2 = [...points].sort((a, b) => b - a).slice(0, 2);
                        return total + best2.reduce((a, b) => a + b, 0);
                      }, 0)}
                    </th>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <table className="min-w-full border text-center">
                <thead>
                  <tr>
                    {defaultHoles.map(hole => (
                      <th key={hole.number} className="border px-2 py-1">{hole.number}</th>
                    ))}
                    <th className="border px-2 py-1">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {defaultHoles.map((hole, idx) => (
                      <td key={idx} className="border px-1 py-1">
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={scores[idx]}
                          onChange={e => handleScoreChange(idx, e.target.value)}
                          className="w-12 text-center rounded bg-white/10 text-white border border-white/30 focus:outline-none"
                        />
                      </td>
                    ))}
                    <td className="border px-2 py-1 font-bold">{totalScore()}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
          <button
            onClick={handleSaveScores}
            className="mt-6 w-full py-2 px-4 bg-transparent border border-white text-white font-semibold rounded-2xl hover:bg-white hover:text-black transition"
          >
            Save Scores
          </button>
          <button
            onClick={() => {
              // Try to get comp code from competition object or player
              const compCode = competition.code || competition.joinCode || (player && player.code) || '';
              if (compCode) {
                navigate(`/leaderboard/${compCode}`, { state: { date: competition.date, type: competition.type } });
              } else {
                alert('Competition code not found.');
              }
            }}
            className="mt-3 w-full py-2 px-4 bg-yellow-500 text-white font-semibold rounded-2xl hover:bg-yellow-600 transition"
          >
            View Leaderboard
          </button>
        </div>
      </div>
    </PageBackground>
  );
}
