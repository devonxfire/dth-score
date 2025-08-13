import React, { useEffect, useState } from 'react';
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

function Leaderboard() {
  const [entries, setEntries] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();
  const filterDate = location.state?.date;
  const filterType = location.state?.type;

  useEffect(() => {
    let saved = JSON.parse(localStorage.getItem('scores') || '[]');
    if (filterDate && filterType) {
      saved = saved.filter(e => e.date === filterDate && e.competitionType === filterType);
    }
    setEntries(saved);
  }, [filterDate, filterType]);

  // Get competition and date from first entry (filtered)
  const comp = entries[0]?.competitionType || '';
  const date = entries[0]?.date || '';
  // Determine comp type
  const isMedal = comp.toLowerCase().includes('medal');
  const isStableford = comp.toLowerCase().includes('stableford');

  // Helper: calculate net and points
  function getPlayingHandicap(entry) {
    const full = parseFloat(entry.player?.handicap || 0);
    return Math.round(full * 0.95);
  }
  function getNet(entry) {
    return entry.total - getPlayingHandicap(entry);
  }
  function getStablefordPoints(entry) {
    // Allocate shots per hole using stroke index
    const ph = getPlayingHandicap(entry);
    let points = 0;
    for (let i = 0; i < (entry.scores?.length || 0); i++) {
      const gross = parseInt(entry.scores[i] || 0);
      if (!gross) continue;
      const hole = defaultHoles[i];
      // Calculate shots for this hole
      let shots = 0;
      if (ph > 0) {
        shots = Math.floor(ph / 18);
        // Extra shots for lowest indexes
        if (hole.index <= (ph % 18)) shots += 1;
      }
      const net = gross - shots;
      const par = hole.par;
      if (net === par - 2) points += 4; // eagle
      else if (net === par - 1) points += 3; // birdie
      else if (net === par) points += 2; // par
      else if (net === par + 1) points += 1; // bogey
      // else 0
    }
    return points;
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-50 px-4 py-8">
      <div className="bg-white rounded shadow p-6 w-full max-w-3xl mb-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 py-2 px-4 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
        >
          ← Back to Scorecard
        </button>
        <h2 className="text-2xl font-bold text-purple-700 mb-2">Leaderboard</h2>
        {comp && <div className="text-lg font-semibold text-gray-700 mb-1">{comp.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div>}
        {date && <div className="text-md text-gray-500 mb-4">{date}</div>}
        {entries.length === 0 ? (
          <div className="text-gray-500">No scores submitted yet.</div>
        ) : (
          <table className="min-w-full border text-center">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1">Player</th>
                <th className="border px-2 py-1">Tee Box</th>
                <th className="border px-2 py-1">Gross</th>
                {isMedal && <th className="border px-2 py-1">Net</th>}
                {isStableford && <>
                  <th className="border px-2 py-1">Net</th>
                  <th className="border px-2 py-1">Points</th>
                </>}
              </tr>
            </thead>
            <tbody>
              {entries
                .sort((a, b) => b.total - a.total)
                .map((entry, idx) => (
                  <tr key={idx}>
                    <td className="border px-2 py-1">{entry.player?.name}</td>
                    <td className="border px-2 py-1">{entry.player?.teebox}</td>
                    <td className="border px-2 py-1 font-bold">{entry.total}</td>
                    {isMedal && <td className="border px-2 py-1">{getNet(entry)}</td>}
                    {isStableford && <>
                      <td className="border px-2 py-1">{getNet(entry)}</td>
                      <td className="border px-2 py-1">{getStablefordPoints(entry)}</td>
                    </>}
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Leaderboard;
