import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// Helper: check if user is admin
function isAdmin(user) {
  return user && (user.role === 'admin' || user.isAdmin || user.isadmin);
}
import PageBackground from './PageBackground';

// Medal Results Page UI (fetches real data)
export default function ResultsMedal() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [competition, setCompetition] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Get current user from localStorage
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    if (stored) try { return JSON.parse(stored); } catch (e) { return null; }
    return null;
  });
  // Fines state: { [playerName]: number }
  const [fines, setFines] = useState({});

  useEffect(() => {
    async function fetchResults() {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch competition data
        const res = await fetch(`/api/competitions/${id}`);
        if (!res.ok) throw new Error('Competition not found');
        const comp = await res.json();
        setCompetition(comp);
        // 2. Gather all players from all groups
        let playerRows = [];
        if (comp.groups && comp.users) {
          for (const group of comp.groups) {
            if (!Array.isArray(group.players) || !group.teamId) continue;
            for (const playerName of group.players) {
              const user = comp.users.find(u => u.name === playerName);
              if (!user) continue;
              // 3. Fetch scores for this player
              const scoreRes = await fetch(`/api/teams/${group.teamId}/users/${user.id}/scores?competitionId=${comp.id}`);
              let scores = [];
              if (scoreRes.ok) {
                const scoreData = await scoreRes.json();
                scores = Array.isArray(scoreData.scores) ? scoreData.scores : [];
              }
              // 4. Compute gross (sum of all entered scores)
              const gross = scores.reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
              // 5. Get PH (Playing Handicap) with allowance, and CH (Course Handicap)
              let ph = 0;
              let ch = 0;
              if (group.handicaps && group.handicaps[playerName]) {
                const fullHandicap = parseInt(group.handicaps[playerName], 10) || 0;
                ch = fullHandicap;
                if (comp.handicapallowance && !isNaN(Number(comp.handicapallowance))) {
                  ph = Math.round(fullHandicap * Number(comp.handicapallowance) / 100);
                } else {
                  ph = fullHandicap;
                }
              } else if (user.handicap) {
                ph = user.handicap;
                ch = user.handicap;
              }
              // 6. Net = Gross - PH, DTH Net = Gross - CH
              const net = gross - ph;
              const dthNet = gross - ch;
              playerRows.push({
                name: playerName,
                gross,
                net,
                dthNet,
                ph,
                ch,
                scores,
              });
            }
          }
        }
        // 7. Sort by net ascending, assign position
        playerRows.sort((a, b) => a.net - b.net);
        playerRows.forEach((p, i) => (p.position = i + 1));
        setPlayers(playerRows);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchResults();
  }, [id]);

  return (
    <PageBackground>
      <div className="flex flex-col items-center px-4 mt-12">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-white drop-shadow-lg text-center">
            {competition?.name || 'Medal Results'}
          </h2>
          <div className="mx-auto mt-2" style={{height: '2px', maxWidth: 340, background: 'white', opacity: 0.7, borderRadius: 2}}></div>
        </div>
        {/* Action buttons stacked vertically at top right, copied from Scorecard */}
  <div className="flex flex-col items-end space-y-2 ml-8 mt-2 w-full max-w-4xl" style={{alignItems:'flex-end'}}>
          <button
            onClick={() => navigate('/dashboard')}
            className="py-2 px-4 w-44 bg-[#1B3A6B] text-white rounded-2xl hover:bg-white hover:text-[#1B3A6B] border border-white transition"
          >
            Dashboard
          </button>
          <button
            onClick={() => {
              const compId = competition?.id || competition?._id || competition?.joinCode || competition?.joincode || id;
              console.log('Navigating to Scorecard with compId:', compId, 'competition:', competition);
              navigate(`/scorecard/${compId}`, { state: { competition } });
            }}
            className="py-2 px-4 w-44 bg-[#1B3A6B] text-white font-semibold rounded-2xl hover:bg-white hover:text-[#1B3A6B] border border-white transition"
          >
            Back to Scorecard
          </button>
          <button
            disabled
            className="py-2 px-4 w-44 bg-gray-400 text-white font-semibold rounded-2xl border border-white transition opacity-60 cursor-not-allowed mt-2"
            title="PDF export coming soon!"
          >
            Export to PDF
          </button>
        </div>
      </div>
      <div className="flex flex-col items-center px-4 mt-8">
        <div className="w-full max-w-4xl rounded-2xl shadow-lg bg-transparent text-white mb-8" style={{ backdropFilter: 'none' }}>
          {loading ? (
            <div className="text-center text-white py-8">Loading results...</div>
          ) : error ? (
            <div className="text-center text-red-400 py-8">{error}</div>
          ) : (
            <table className="min-w-full border text-center mb-8">
              <thead>
                <tr className="bg-blue-900/90">
                  <th className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}>Pos</th>
                  <th className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}>Name</th>
                  <th className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}>Gross</th>
                  <th className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}>Net</th>
                  <th className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}>DTH Net</th>
                  <th className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}>Dog</th>
                  <th className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}>Waters</th>
                  <th className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}>2 Clubs</th>
                  <th className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}>Fines</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p, idx) => (
                  <tr key={p.name} className={idx % 2 === 0 ? 'bg-white/5' : ''}>
                    <td className="border px-2 py-1 font-bold">{p.position}</td>
                    <td className="border px-2 py-1 text-left">{p.name}</td>
                    <td className="border px-2 py-1">{p.gross}</td>
                    <td className="border px-2 py-1">{p.net}</td>
                    <td className="border px-2 py-1">{p.dthNet}</td>
                    <td className="border px-2 py-1"></td>
                    <td className="border px-2 py-1"></td>
                    <td className="border px-2 py-1"></td>
                    <td className="border px-2 py-1">
                      {isAdmin(user) ? (
                        <input
                          type="number"
                          min="0"
                          className="w-16 text-center text-white bg-transparent rounded mx-auto block"
                          value={fines[p.name] || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setFines(f => ({ ...f, [p.name]: val === '' ? '' : Math.max(0, parseInt(val, 10) || 0) }));
                          }}
                          placeholder="0"
                          style={{ color: 'white' }}
                        />
                      ) : (
                        fines[p.name] || ''
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </PageBackground>
  );
}
