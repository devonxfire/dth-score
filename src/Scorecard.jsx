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
  const [scores, setScores] = useState(Array(18).fill(''));

  function handleScoreChange(idx, value) {
    const newScores = [...scores];
    newScores[idx] = value;
    setScores(newScores);
  }


  function totalScore() {
    return scores.reduce((sum, val) => sum + (parseInt(val) || 0), 0);
  }

  // Calculate playing handicap (shots to allocate)
  function getPlayingHandicap() {
    return playingHandicap ? parseInt(playingHandicap) : 0;
  }

  // Calculate Stableford points per hole
  function getPointsPerHole() {
    const ph = getPlayingHandicap();
    const points = [];
    for (let i = 0; i < defaultHoles.length; i++) {
      const gross = parseInt(scores[i] || 0);
      if (!gross) {
        points.push('');
        continue;
      }
      const hole = defaultHoles[i];
      let shots = 0;
      if (ph > 0) {
        shots = Math.floor(ph / 18);
        if (hole.index <= (ph % 18)) shots += 1;
      }
      const net = gross - shots;
      const par = hole.par;
      if (net === par - 2) points.push(4); // eagle
      else if (net === par - 1) points.push(3); // birdie
      else if (net === par) points.push(2); // par
      else if (net === par + 1) points.push(1); // bogey
      else points.push(0);
    }
    return points;
  }

  function totalPoints() {
    return getPointsPerHole().reduce((sum, val) => sum + (parseInt(val) || 0), 0);
  }

  function handleSaveScores() {
    const entry = {
      player,
      scores,
      total: totalScore(),
      date: competition.date,
      competitionType: competition.type,
    };
    const prev = JSON.parse(localStorage.getItem('scores') || '[]');
    localStorage.setItem('scores', JSON.stringify([...prev, entry]));
    alert('Scores saved!');
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-50 px-4 py-8">
      <div className="bg-white rounded shadow p-6 w-full max-w-3xl mb-8">
        <h2 className="text-2xl font-bold text-green-700 mb-2">{player.name ? `${player.name}'s Scorecard` : 'Scorecard'}</h2>
        <div className="mb-2 text-gray-700">
          <span className="font-semibold">Competition:</span> {competition.type} <br />
          <span className="font-semibold">Date:</span> {formatDate(competition.date)} <br />
          <span className="font-semibold">Tee Box:</span> {player.teebox} <br />
          <span className="font-semibold">Handicap Allowance:</span> {competition.handicapAllowance}% <br />
          <span className="font-semibold">Full Handicap:</span> {fullHandicap} <br />
          <span className="font-semibold">Playing Handicap:</span> {playingHandicap} <br />
          <span className="font-semibold">4 Balls:</span> {competition.fourballs} <br />
          {competition.notes && <><span className="font-semibold">Notes from Captain:</span> {competition.notes} <br /></>}
        </div>
  <div className="overflow-x-auto">
          <table className="min-w-full border text-center">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1">Hole</th>
                {defaultHoles.map(h => <th key={h.number} className="border px-2 py-1">{h.number}</th>)}
                <th className="border px-2 py-1">Total</th>
              </tr>
              <tr>
                <td className="border px-2 py-1 font-semibold">Par</td>
                {defaultHoles.map(h => <td key={h.number} className="border px-2 py-1">{h.par}</td>)}
                <td className="border px-2 py-1 font-semibold">-</td>
              </tr>
              <tr>
                <td className="border px-2 py-1 font-semibold">Stroke</td>
                {defaultHoles.map(h => <td key={h.number} className="border px-2 py-1">{h.index}</td>)}
                <td className="border px-2 py-1 font-semibold">-</td>
              </tr>
            </thead>
            <tbody>
              <tr>
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
              <tr>
                <td className="border px-2 py-1 font-semibold">Points</td>
                {getPointsPerHole().map((pt, idx) => (
                  <td key={idx} className="border px-2 py-1">{pt}</td>
                ))}
                <td className="border px-2 py-1 font-bold">{totalPoints()}</td>
              </tr>
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
