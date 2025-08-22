
import { useState, useEffect } from 'react';
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
  const navigate = useNavigate();
  // Modal state for tee/handicap
  const [showTeeModal, setShowTeeModal] = useState(false);
  const [selectedTee, setSelectedTee] = useState('');
  const [inputHandicap, setInputHandicap] = useState('');
  const [savingTee, setSavingTee] = useState(false);
  const [teeError, setTeeError] = useState('');

  // Prefer location.state, fallback to props
  const initialCompetition = location.state?.competition || props.competition || null;
  const initialPlayer = location.state?.player || props.player || null;
  const [competition, setCompetition] = useState(initialCompetition);
  const [player, setPlayer] = useState(initialPlayer);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Show modal if player is present but missing teebox or course_handicap
  useEffect(() => {
    if (player && (!player.teebox || !player.course_handicap)) {
      setShowTeeModal(true);
      setSelectedTee(player.teebox || '');
      setInputHandicap(player.course_handicap || '');
    }
  }, [player]);
  const isAlliance = competition && competition.type?.toLowerCase().includes('alliance');
  let groupPlayers = [player && player.name].filter(Boolean);
  if (isAlliance && competition && competition.groups && player) {
    const foundGroup = competition.groups.find(g => g.players?.includes(player.name));
    if (foundGroup) groupPlayers = foundGroup.players;
  }
  const scores = groupPlayers.map(() => Array(18).fill(''));
  const playingHandicap = player && player.handicap ? player.handicap : '';
  function handleScoreChange() {}
  function totalScore() { return 0; }
  function handleSaveScores() {}

  return (
    <PageBackground>
      {/* Tee/Handicap Modal */}
      {showTeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="w-full max-w-sm flex flex-col items-center rounded-2xl shadow-lg border border-white bg-transparent p-8" style={{background: 'rgba(0,0,0,0.35)'}}>
            <h2 className="text-2xl font-bold mb-4 text-white drop-shadow">Set Your Tee & Handicap</h2>
            <label className="mb-2 w-full text-left text-white font-semibold">Tee Box</label>
            <select
              className="mb-4 w-full p-2 border border-white bg-transparent text-white rounded focus:outline-none"
              value={selectedTee}
              onChange={e => setSelectedTee(e.target.value)}
            >
              <option value="">Select Tee</option>
              <option value="White">White</option>
              <option value="Yellow">Yellow</option>
              <option value="Red">Red</option>
            </select>
            <label className="mb-2 w-full text-left text-white font-semibold">FULL Course Handicap</label>
            <input
              type="number"
              className="mb-4 w-full p-2 border border-white bg-transparent text-white rounded focus:outline-none"
              value={inputHandicap}
              onChange={e => setInputHandicap(e.target.value)}
              min="0"
              max="54"
            />
            {teeError && <div className="text-red-300 mb-2 font-semibold">{teeError}</div>}
            <button
              className="w-full py-2 px-4 border border-white text-white font-semibold rounded-2xl transition text-lg"
              style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
              disabled={savingTee}
              onClick={async () => {
                setTeeError('');
                if (!selectedTee || !inputHandicap) {
                  setTeeError('Please select a tee and enter your handicap.');
                  return;
                }
                setSavingTee(true);
                try {
                  // PATCH to backend
                  const teamId = player.team_id || player.teamId || player.group_id || player.groupId;
                  const userId = player.id || player.user_id || player.userId;
                  const res = await fetch(`/api/teams/${teamId}/users/${userId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ teebox: selectedTee, course_handicap: inputHandicap })
                  });
                  if (!res.ok) throw new Error('Failed to save');
                  // Update player state
                  setPlayer(p => ({ ...p, teebox: selectedTee, course_handicap: inputHandicap }));
                  setShowTeeModal(false);
                } catch (e) {
                  setTeeError('Failed to save. Please try again.');
                } finally {
                  setSavingTee(false);
                }
              }}
            >
              {savingTee ? 'Saving...' : 'Save & Continue'}
            </button>
            <button
              className="w-full mt-2 py-2 px-4 border border-white text-white font-semibold rounded-2xl transition text-lg bg-transparent hover:bg-white hover:text-[#1B3A6B]"
              onClick={() => navigate('/dashboard')}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {!competition || !player ? (
        <div className="text-white p-8">No competition or player data found.</div>
      ) : !showTeeModal && (
        <>
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
                <span className="font-semibold">Date:</span> {competition.date} <br />
                <span className="font-semibold">Tee Box:</span> {player.teebox} <br />
                <span className="font-semibold">Handicap Allowance:</span> {competition.handicapAllowance ? competition.handicapAllowance + '%' : 'N/A'} <br />
                <span className="font-semibold">4 Balls:</span> {competition.fourballs} <br />
                {competition.notes && <><span className="font-semibold">Notes from Captain:</span> {competition.notes} <br /></>}
              </div>
              {isAlliance && (
                <div className="mb-4">
                  <div className="font-semibold mb-1">Group Members:</div>
                  <ul className="mb-2">
                    {groupPlayers.map((name, idx) => {
                      let ph = '';
                      if (name === player.name && player.handicap) {
                        ph = playingHandicap;
                      } else if (competition.groups) {
                        const group = competition.groups.find(g => g.players?.includes(name));
                        if (group && group.handicaps && group.handicaps[name] !== undefined) {
                          ph = group.handicaps[name];
                        }
                      }
                      return (
                        <li key={name} className="mb-1">
                          <span className="font-semibold">{name}</span>
                          {ph !== '' ? (
                            <span className="ml-2 text-green-200">Playing Handicap: {ph}</span>
                          ) : (
                            <span className="ml-2 text-red-200">No Handicap</span>
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
                    <tr>
                      {groupPlayers.length > 1 && <th className="border px-2 py-1 bg-white/10">Player</th>}
                      {defaultHoles.map(hole => (
                        <th key={hole.number} className="border px-2 py-1 bg-white/10">{hole.number}</th>
                      ))}
                      <th className="border px-2 py-1 bg-white/10">Total</th>
                    </tr>
                    <tr>
                      {groupPlayers.length > 1 && <th className="border px-2 py-1 bg-white/5">HOLE</th>}
                      {defaultHoles.map(hole => (
                        <th key={hole.number} className="border px-2 py-1 bg-white/5">{hole.number}</th>
                      ))}
                      <th className="border px-2 py-1 bg-white/5"></th>
                    </tr>
                    <tr>
                      {groupPlayers.length > 1 && <th className="border px-2 py-1 bg-white/5">PAR</th>}
                      {defaultHoles.map(hole => (
                        <th key={hole.number} className="border px-2 py-1 bg-white/5">{hole.par}</th>
                      ))}
                      <th className="border px-2 py-1 bg-white/5"></th>
                    </tr>
                    <tr>
                      {groupPlayers.length > 1 && <th className="border px-2 py-1 bg-white/5">STROKE</th>}
                      {defaultHoles.map(hole => (
                        <th key={hole.number} className="border px-2 py-1 bg-white/5">{hole.index}</th>
                      ))}
                      <th className="border px-2 py-1 bg-white/5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupPlayers.map((name, pIdx) => (
                      <tr key={name}>
                        {groupPlayers.length > 1 && <td className="border px-2 py-1 font-semibold text-left">{name}</td>}
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
                </table>
              </div>
              <button
                onClick={handleSaveScores}
                className="mt-6 w-full py-2 px-4 bg-transparent border border-white text-white font-semibold rounded-2xl hover:bg-white hover:text-black transition"
              >
                Save Scores
              </button>
              <button
                onClick={() => {
                  const compJoinCode = competition.joinCode || competition.joincode || (player && (player.joinCode || player.joincode)) || '';
                  if (compJoinCode) {
                    navigate(`/leaderboard/${compJoinCode}`, { state: { date: competition.date, type: competition.type } });
                  } else {
                    alert('Competition join code not found.');
                  }
                }}
                className="mt-3 w-full py-2 px-4 bg-yellow-500 text-white font-semibold rounded-2xl hover:bg-yellow-600 transition"
              >
                View Leaderboard
              </button>
            </div>
          </div>
        </>
      )}
    </PageBackground>
  );
}
