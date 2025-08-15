import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

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
    <div className="min-h-screen flex flex-col items-center bg-gray-50 px-4 py-8">
      <div className="bg-white rounded shadow p-6 w-full max-w-3xl mb-8">
        <div className="flex justify-between mb-2">
          <button
            onClick={() => navigate('/')}
            className="py-2 px-4 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition mr-2"
          >
            Home
          </button>
        </div>
        <h2 className="text-2xl font-bold text-green-700 mb-2">
          {isAlliance
            ? `${groupPlayers.join(', ')}'s Scorecard`
            : player.name
              ? `${player.name}'s Scorecard`
              : 'Scorecard'}
        </h2>
        <div className="mb-2 text-gray-700">
          <span className="font-semibold">Competition:</span> {competition.type
            ? competition.type
                .replace(/[-_]/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase())
            : ''} <br />
          <span className="font-semibold">Date:</span> {formatDate(competition.date)} <br />
          <span className="font-semibold">Tee Box:</span> {player.teebox} <br />
          <span className="font-semibold">Handicap Allowance:</span> {competition.handicapAllowance}% <br />
          <span className="font-semibold">4 Balls:</span> {competition.fourballs} <br />
          {competition.notes && <><span className="font-semibold">Notes from Captain:</span> {competition.notes} <br /></>}
        </div>
        {/* Alliance: Show group members and their playing handicaps */}
        {isAlliance && (
          <div className="mb-4">
            <div className="font-semibold mb-1">Group Members:</div>
            <ul className="mb-2">
              {groupPlayers.map((name, idx) => {
                // If this is the current player, always show their playing handicap
                if (name === player.name) {
                  return (
                    <li key={name} className="mb-1">
                      <span className="font-semibold">{name}</span>
                      <span className="ml-2 text-green-700">Playing Handicap: {playingHandicap}</span>
                    </li>
                  );
                }
                // Try to find this player's join info in localStorage
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
                      <span className="ml-2 text-green-700">Playing Handicap: {ph}</span>
                    ) : (
                      <span className="ml-2 text-red-600">NOT JOINED YET</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
  <div className="overflow-x-auto">
    <table className="min-w-full border text-center">
      <thead>
        <tr className="bg-gray-100">
          <th className="border px-2 py-1">Player</th>
          <th className="border px-2 py-1">Hole</th>
          {defaultHoles.map(h => <th key={h.number} className="border px-2 py-1">{h.number}</th>)}
          <th className="border px-2 py-1">Total</th>
        </tr>
        <tr>
          <td className="border px-2 py-1 font-semibold"></td>
          <td className="border px-2 py-1 font-semibold">Par</td>
          {defaultHoles.map(h => <td key={h.number} className="border px-2 py-1">{h.par}</td>)}
          <td className="border px-2 py-1 font-semibold">-</td>
        </tr>
        <tr>
          <td className="border px-2 py-1 font-semibold"></td>
          <td className="border px-2 py-1 font-semibold">Stroke</td>
          {defaultHoles.map(h => <td key={h.number} className="border px-2 py-1">{h.index}</td>)}
          <td className="border px-2 py-1 font-semibold">-</td>
        </tr>
      </thead>
      <tbody>
        {isAlliance
          ? groupPlayers.map((name, pIdx) => (
              <tr key={name}>
                <td className="border px-2 py-1 font-semibold">{name}</td>
                <td className="border px-2 py-1 font-semibold">Score</td>
                {scores[pIdx].map((score, idx) => (
                  <td key={idx} className="border px-2 py-1">
                    <input
                      type="number"
                      min="1"
                      value={score}
                      onChange={e => handleScoreChange(idx, e.target.value, pIdx)}
                      className="w-14 border rounded px-1 py-0.5 text-center focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </td>
                ))}
                <td className="border px-2 py-1 font-bold">{totalScore(pIdx)}</td>
              </tr>
            ))
          : (
              <tr>
                <td className="border px-2 py-1 font-semibold">{player.name}</td>
                <td className="border px-2 py-1 font-semibold">Score</td>
                {scores.map((score, idx) => (
                  <td key={idx} className="border px-2 py-1">
                    <input
                      type="number"
                      min="1"
                      value={score}
                      onChange={e => handleScoreChange(idx, e.target.value)}
                      className="w-14 border rounded px-1 py-0.5 text-center focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                  </td>
                ))}
                <td className="border px-2 py-1 font-bold">{totalScore()}</td>
              </tr>
            )}
        {/* Medal/Stableford/Alliance points row */}
        {isMedal && !isAlliance && (
          <tr>
            <td className="border px-2 py-1 font-semibold"></td>
            <td className="border px-2 py-1 font-semibold">Net</td>
            {getNetPerHole().map((net, idx) => (
              <td key={idx} className="border px-2 py-1">{net}</td>
            ))}
            <td className="border px-2 py-1 font-bold">{totalNet()}</td>
          </tr>
        )}
        {isStableford && !isAlliance && (
          <tr>
            <td className="border px-2 py-1 font-semibold"></td>
            <td className="border px-2 py-1 font-semibold">Points</td>
            {getPointsPerHole().map((pt, idx) => (
              <td key={idx} className="border px-2 py-1">{pt}</td>
            ))}
            <td className="border px-2 py-1 font-bold">{totalPoints()}</td>
          </tr>
        )}
        {/* Alliance: show best 2 points per hole row */}
        {isAlliance && (
          <tr>
            <td className="border px-2 py-1 font-semibold" colSpan={2}>Best 2 Points</td>
            {defaultHoles.map((_, hIdx) => {
              // For each hole, get all players' points, sort, sum best 2
              const allPoints = getPointsPerHole().map(arr => arr[hIdx]);
              const best2 = allPoints.sort((a, b) => b - a).slice(0, 2);
              const sum = best2.reduce((a, b) => a + (parseInt(b) || 0), 0);
              return <td key={hIdx} className="border px-2 py-1 font-bold">{sum}</td>;
            })}
            <td className="border px-2 py-1 font-bold">{defaultHoles.reduce((acc, _, hIdx) => {
              const allPoints = getPointsPerHole().map(arr => arr[hIdx]);
              const best2 = allPoints.sort((a, b) => b - a).slice(0, 2);
              return acc + best2.reduce((a, b) => a + (parseInt(b) || 0), 0);
            }, 0)}</td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
        <button
          onClick={handleSaveScores}
          className="mt-6 w-full py-2 px-4 bg-green-600 text-white font-semibold rounded hover:bg-green-700 transition"
        >
          Save Scores
        </button>
        <button
          onClick={() => navigate('/leaderboard', { state: { date: competition.date, type: competition.type } })}
          className="mt-3 w-full py-2 px-4 bg-yellow-500 text-white font-semibold rounded hover:bg-yellow-600 transition"
        >
          View Leaderboard
        </button>
      </div>
    </div>
  );
}
