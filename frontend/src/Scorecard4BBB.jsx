
import React, { useState, useEffect } from 'react';
import { TrophyIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import PageBackground from './PageBackground';
import TopMenu from './TopMenu';
import './popupJiggle.css';

// Modal state for reset confirmation
// (restored below imports)

// Format date as dd/mm/yyyy
function formatDate(dateVal) {
  if (!dateVal) return '';
  let dateObj;
  if (dateVal instanceof Date) {
    dateObj = dateVal;
  } else if (typeof dateVal === 'string') {
    // Handles ISO string with or without time
    dateObj = new Date(dateVal);
    if (isNaN(dateObj)) {
      // fallback: try to parse as yyyy-mm-dd
      const [year, month, day] = dateVal.split('-');
      if (year && month && day) return `${day}/${month}/${year}`;
      return dateVal;
    }
  } else {
    return '';
  }
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
}

// Define a color array for up to 4 players (A, B, C, D)
const playerColors = [
  'bg-blue-100 text-blue-900', // A
  'bg-blue-100 text-blue-900', // B
  'bg-green-100 text-green-900', // C
  'bg-green-100 text-green-900'  // D
];

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


export default function Scorecard4BBB(props) {
  // Waters popup state
  const [showWatersPopup, setShowWatersPopup] = useState(false);
  const [watersPlayer, setWatersPlayer] = useState(null);
  const watersTimeoutRef = React.useRef(null);
  // Dog popup state
  const [showDogPopup, setShowDogPopup] = useState(false);
  const [dogPlayer, setDogPlayer] = useState(null);
  const dogTimeoutRef = React.useRef(null);
  // Mini table stats: Waters, Dog, 2 Clubs (persisted in backend)
  const [miniTableStats, setMiniTableStats] = useState({});
  // Birdie popup state
  const [showBirdie, setShowBirdie] = useState(false);
  const [birdieHole, setBirdieHole] = useState(null);
  const [birdiePlayer, setBirdiePlayer] = useState(null);
  const birdieTimeoutRef = React.useRef(null);
  // Eagle popup state
  const [showEagle, setShowEagle] = useState(false);
  const [eagleHole, setEagleHole] = useState(null);
  const [eaglePlayer, setEaglePlayer] = useState(null);
  const eagleTimeoutRef = React.useRef(null);
  // Blowup popup state
  const [showBlowup, setShowBlowup] = useState(false);
  const [blowupHole, setBlowupHole] = useState(null);
  const [blowupPlayer, setBlowupPlayer] = useState(null);
  const blowupTimeoutRef = React.useRef(null);
  // Top menu for UI consistency (copied from ResultsMedal)
  const userMenu = (() => {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch {
      return null;
    }
  })();

  // Handler to reset all gross scores (local and backend)
  const handleResetScorecard = async () => {
    setScores(groupPlayers.map(() => Array(18).fill('')));
    if (!competition || !competition.id || !groupTeamId) return;
    for (let pIdx = 0; pIdx < groupPlayers.length; pIdx++) {
      let userId = null;
      if (competition.users) {
        const user = competition.users.find(u => u.name === groupPlayers[pIdx]);
        if (user) userId = user.id || user.user_id || user.userId;
      }
      if (!userId) continue;
      const url = `/api/teams/${groupTeamId}/users/${userId}/scores`;
      try {
        await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ competitionId: competition.id, scores: Array(18).fill('') })
        });
      } catch (err) {
      }
    }
  };
  // Modal state for reset confirmation
  const [showResetModal, setShowResetModal] = useState(false);
  // Helper to find groupForPlayer from competition and player
  function nameMatch(a, b) {
    if (!a || !b) return false;
    const normA = a.trim().toLowerCase();
    const normB = b.trim().toLowerCase();
    return normA && normB && (normA === normB || normA.length > 1 && normB.includes(normA) || normB.length > 1 && normA.includes(normB));
  }
  function getGroupForPlayer(competition, player) {
    if (competition && competition.groups && competition.groups.length > 0) {
      let group = competition.groups.find(g => Array.isArray(g.players) && g.players.some(p => nameMatch(p, player?.name)));
      if (!group) group = competition.groups[0];
      return group;
    }
    return null;
  }

  const location = useLocation();
  const navigate = useNavigate();
  // Modal state for tee/handicap
  const [showTeeModal, setShowTeeModal] = useState(false);
  const [selectedTee, setSelectedTee] = useState('');
  const [inputHandicap, setInputHandicap] = useState('');
  const [savingTee, setSavingTee] = useState(false);
  const [teeError, setTeeError] = useState('');

  // Prefer location.state, fallback to props, fallback to fetch by id from URL
  const { id: urlId } = useParams();
  const initialCompetition = location.state?.competition || props.competition || null;
  const initialPlayer = location.state?.player || props.player || null;
  const [competition, setCompetition] = useState(initialCompetition);
  // Always set player to the logged-in user if not provided
  const [player, setPlayer] = useState(() => {
    if (initialPlayer) return initialPlayer;
    // Try to find the logged-in user from localStorage
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) { return null; }
    }
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Always fetch latest competition data on mount if competition.id exists, or fetch by URL id if not present
  useEffect(() => {
    async function fetchCompetition() {
      if (initialCompetition && initialCompetition.id) {
        setLoading(true);
        try {
          const res = await fetch(`/api/competitions/${initialCompetition.id}`);
          if (res.ok) {
            const data = await res.json();
            setCompetition(data);
          }
        } catch (e) {
          // ignore
        } finally {
          setLoading(false);
        }
      } else if (urlId) {
        setLoading(true);
        try {
          const res = await fetch(`/api/competitions/${urlId}`);
          if (res.ok) {
            const data = await res.json();
            setCompetition(data);
          }
        } catch (e) {
          // ignore
        } finally {
          setLoading(false);
        }
      }
    }
    fetchCompetition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Move groupForPlayer, groupPlayers, groupTeamId above the modal useEffect ---
  let groupPlayers = [];
  let groupForPlayer = null;
  let groupTeamId = null;
  if (competition && competition.groups && competition.groups.length > 0) {
    // Find the group that contains the logged-in player
    groupForPlayer = competition.groups.find(g => Array.isArray(g.players) && g.players.includes(player?.name));
    if (!groupForPlayer) {
      // fallback to first group if not found
      groupForPlayer = competition.groups[0];
    }
    groupPlayers = groupForPlayer.players || [];
    groupTeamId = groupForPlayer.teamId;
  } else if (player && player.name) {
    groupPlayers = [player.name];
  }

  // Fetch mini table stats from backend on load or group change
  useEffect(() => {
    async function fetchStats() {
      if (!groupTeamId || !competition || !competition.users) return;
      const stats = {};
      for (const name of groupPlayers) {
        const user = competition.users.find(u => u.name === name);
        if (!user) continue;
        const userId = user.id || user.user_id || user.userId;
        try {
          const res = await fetch(`/api/teams/${groupTeamId}/users/${userId}`);
          if (res.ok) {
            const data = await res.json();
            stats[name] = {
              waters: data.waters ?? '',
              dog: !!data.dog,
              twoClubs: data.two_clubs ?? ''
            };
          } else {
            stats[name] = { waters: '', dog: false, twoClubs: '' };
          }
        } catch {
          stats[name] = { waters: '', dog: false, twoClubs: '' };
        }
      }
      setMiniTableStats(stats);
    }
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupTeamId, groupPlayers.length]);

  // Now the modal useEffect can safely reference groupForPlayer
  useEffect(() => {
    if (player && groupForPlayer) {
      const backendTee = groupForPlayer.teeboxes?.[player.name];
      const backendHandi = groupForPlayer.handicaps?.[player.name];
      if (!backendTee && !backendHandi) {
        setShowTeeModal(true);
        setSelectedTee('');
        setInputHandicap('');
      } else {
        setShowTeeModal(false);
      }
    }
  }, [player, groupForPlayer]);
  const isAlliance = competition && competition.type?.toLowerCase().includes('alliance');
  // Scores state: [playerIdx][holeIdx] = value
  const [scores, setScores] = useState(() => groupPlayers.map(() => Array(18).fill('')));
  // Track loading state for scores
  const [scoresLoading, setScoresLoading] = useState(false);
  const playingHandicap = player && player.handicap ? player.handicap : '';

  // Fetch scores for all players on mount or when groupPlayers changes
  useEffect(() => {
    let cancelled = false;
    async function fetchAllScores() {
      if (!competition || !competition.id || !groupTeamId) return;
      setScoresLoading(true);
      const newScores = await Promise.all(groupPlayers.map(async (name, idx) => {
        // Find userId for this player
        let userId = null;
        if (competition.users) {
          const user = competition.users.find(u => u.name === name);
          if (user) userId = user.id || user.user_id || user.userId;
        }
        const url = `/api/teams/${groupTeamId}/users/${userId}/scores?competitionId=${competition.id}`;
        if (!userId) return Array(18).fill('');
        try {
          const res = await fetch(url);
          if (!res.ok) {
            return Array(18).fill('');
          }
          const data = await res.json();
          return Array.isArray(data.scores) && data.scores.length === 18 ? data.scores.map(v => v == null ? '' : v) : Array(18).fill('');
        } catch (err) {
          return Array(18).fill('');
        }
      }));
      if (!cancelled) setScores(newScores);
      setScoresLoading(false);
    }
    fetchAllScores();
    return () => { cancelled = true; };
  }, [groupPlayers.length, competition?.id, groupTeamId]);

  async function handleScoreChange(holeIdx, value, playerIdx) {
    setScores(prev => {
      const updated = prev.map(row => [...row]);
      updated[playerIdx][holeIdx] = value;
      // Birdie/Eagle/Blowup detection logic
      const gross = parseInt(value, 10);
      const hole = defaultHoles[holeIdx];
      if (gross > 0 && hole) {
        // Eagle: 2 under par
        if (gross === hole.par - 2) {
          setEagleHole(hole.number);
          setEaglePlayer(groupPlayers[playerIdx]);
          setShowEagle(true);
          if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200, 100, 200]);
          }
          if (eagleTimeoutRef.current) clearTimeout(eagleTimeoutRef.current);
          eagleTimeoutRef.current = setTimeout(() => setShowEagle(false), 30000);
        } else if (gross === hole.par - 1) {
          setBirdieHole(hole.number);
          setBirdiePlayer(groupPlayers[playerIdx]);
          setShowBirdie(true);
          if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
          }
          if (birdieTimeoutRef.current) clearTimeout(birdieTimeoutRef.current);
          birdieTimeoutRef.current = setTimeout(() => setShowBirdie(false), 30000);
        } else if (gross >= hole.par + 3) {
          setBlowupHole(hole.number);
          setBlowupPlayer(groupPlayers[playerIdx]);
          setShowBlowup(true);
          if (navigator.vibrate) {
            navigator.vibrate([400, 100, 400]);
          }
          if (blowupTimeoutRef.current) clearTimeout(blowupTimeoutRef.current);
          blowupTimeoutRef.current = setTimeout(() => setShowBlowup(false), 30000);
        }
      }
      return updated;
    });
    // Save scores for this player
    if (!competition || !competition.id || !groupTeamId) return;
    // Find userId for this player
    let userId = null;
    if (competition.users) {
      const user = competition.users.find(u => u.name === groupPlayers[playerIdx]);
      if (user) userId = user.id || user.user_id || user.userId;
    }
    if (!userId) {
      return;
    }
    // Prepare scores array for this player
    const playerScores = scores[playerIdx].map((v, idx) => idx === holeIdx ? value : v);
    const patchUrl = `/api/teams/${groupTeamId}/users/${userId}/scores`;
    const patchBody = { competitionId: competition.id, scores: playerScores.map(v => v === '' ? null : Number(v)) };
    try {
      const res = await fetch(patchUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody)
      });
      const result = await res.json();
    } catch (err) {
      console.error('PATCH error:', err);
    }
  }

  function totalScore(playerIdx) {
    return scores[playerIdx].reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0);
  }
  async function handleSaveScores() {
    // Optionally, you could save all players' scores here, but for now just reload all scores from backend
    if (typeof fetchAllScores === 'function') {
      setScoresLoading(true);
      await fetchAllScores();
      setScoresLoading(false);
    }
  }

  return (
    <PageBackground>
  {/* Birdie Celebration Popup */}
      {showBirdie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-8 flex flex-col items-center border-4 border-[#FFD700] popup-jiggle">
            <span className="text-6xl mb-2" role="img" aria-label="Birdie">🕊️</span>
            <h2 className="text-3xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>Birdie!</h2>
            <div className="text-lg font-semibold text-white mb-1" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>For {birdiePlayer} on Hole {birdieHole}</div>
            <button
              className="mt-2 px-6 py-2 rounded-2xl font-bold shadow border border-white transition text-lg"
              style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
              onClick={() => {
                setShowBirdie(false);
                if (birdieTimeoutRef.current) clearTimeout(birdieTimeoutRef.current);
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

  {/* Eagle Celebration Popup */}
      {showEagle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-8 flex flex-col items-center border-4 border-[#FFD700] popup-jiggle">
            <span className="text-6xl mb-2" role="img" aria-label="Eagle">🦅</span>
            <h2 className="text-3xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>Eagle!</h2>
            <div className="text-lg font-semibold text-white mb-1" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>For {eaglePlayer} on Hole {eagleHole}</div>
            <button
              className="mt-2 px-6 py-2 rounded-2xl font-bold shadow border border-white transition text-lg"
              style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
              onClick={() => {
                setShowEagle(false);
                if (eagleTimeoutRef.current) clearTimeout(eagleTimeoutRef.current);
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

  {/* Blowup Popup */}
      {/* Dog Popup */}
      {showDogPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-8 flex flex-col items-center border-4 border-[#FFD700] popup-jiggle">
            <span className="text-6xl mb-2" role="img" aria-label="Dog">🐶</span>
            <h2 className="text-3xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>Woof!</h2>
            <div className="text-lg font-semibold text-white mb-1" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>{dogPlayer} has just gotten the dog</div>
            <button
              className="mt-2 px-6 py-2 rounded-2xl font-bold shadow border border-white transition text-lg"
              style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
              onClick={() => {
                setShowDogPopup(false);
                if (dogTimeoutRef.current) clearTimeout(dogTimeoutRef.current);
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {showBlowup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-8 flex flex-col items-center border-4 border-[#FFD700] popup-jiggle">
            <span className="text-6xl mb-2" role="img" aria-label="Explosion">💥</span>
            <h2 className="text-3xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>How embarrassing.</h2>
            <div className="text-lg font-semibold text-white mb-1" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>{blowupPlayer} just blew up on Hole {blowupHole}.</div>
            <button
              className="mt-2 px-6 py-2 rounded-2xl font-bold shadow border border-white transition text-lg"
              style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
              onClick={() => {
                setShowBlowup(false);
                if (blowupTimeoutRef.current) clearTimeout(blowupTimeoutRef.current);
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <TopMenu
        user={userMenu}
        userComp={props.competition}
        isPlayerInComp={props.isPlayerInComp}
        competitionList={props.competitionList}
      />
      {/* Tee/Handicap Modal */}
      {showTeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm flex flex-col items-center rounded-2xl shadow-2xl border-4 border-[#FFD700] bg-[#002F5F] p-8">
            <h2 className="text-3xl font-extrabold mb-4 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>Set Your Tee & Handicap</h2>
            <label className="mb-2 w-full text-left text-white font-semibold" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>Tee Box</label>
            <select
              className="mb-4 w-full p-2 border border-white bg-transparent text-white rounded focus:outline-none"
              value={selectedTee}
              onChange={e => setSelectedTee(e.target.value)}
              style={{ fontFamily: 'Lato, Arial, sans-serif' }}
            >
              <option value="">Select Tee</option>
              <option value="White">White</option>
              <option value="Yellow">Yellow</option>
              <option value="Red">Red</option>
            </select>
            <label className="mb-2 w-full text-left text-white font-semibold" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>FULL Course Handicap</label>
            <input
              type="number"
              className="mb-4 w-full p-2 border border-white bg-transparent text-white rounded focus:outline-none"
              value={inputHandicap}
              onChange={e => setInputHandicap(e.target.value)}
              min="0"
              max="54"
              style={{ fontFamily: 'Lato, Arial, sans-serif' }}
            />
            {teeError && <div className="text-red-300 mb-2 font-semibold" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>{teeError}</div>}
            <button
              className="w-full py-2 px-4 border border-white text-white font-bold rounded-2xl transition text-lg"
              style={{ backgroundColor: '#FFD700', color: '#002F5F', fontFamily: 'Lato, Arial, sans-serif', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = '#ffe066'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = '#FFD700'}
              disabled={savingTee}
              onClick={async () => {
                setTeeError('');
                if (!selectedTee || !inputHandicap) {
                  setTeeError('Please select a tee and enter your handicap.');
                  return;
                }
                setSavingTee(true);
                try {
                  // Debug logs to help diagnose missing teamId
                  // PATCH to backend using groupTeamId
                  const teamId = groupTeamId;
                  const userId = player.id || player.user_id || player.userId;
                  if (!teamId) {
                    setTeeError('Team ID not found for your group.');
                    setSavingTee(false);
                    return;
                  }
                  const patchUrl = `/api/teams/${teamId}/users/${userId}`;
                  const patchBody = { teebox: selectedTee, course_handicap: inputHandicap };
                  const res = await fetch(patchUrl, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(patchBody)
                  });
                  if (!res.ok) throw new Error('Failed to save');
                  // Update player state
                  setPlayer(p => ({ ...p, teebox: selectedTee, course_handicap: inputHandicap }));
                  // Re-fetch competition data to update mini table
                  if (competition && competition.id) {
                    setLoading(true);
                    try {
                      const compRes = await fetch(`/api/competitions/${competition.id}`);
                      if (compRes.ok) {
                        const compData = await compRes.json();
                        setCompetition(compData);
                      }
                    } catch (e) {
                      // ignore
                    } finally {
                      setLoading(false);
                    }
                  }
                  setShowTeeModal(false);
                } catch (e) {
                  setTeeError('Failed to save. Please try again.');

                  // Show modal ONLY if player is present and BOTH teebox AND course_handicap are missing in backend data
                  useEffect(() => {
                    if (player && competition) {
                      const groupForPlayer = getGroupForPlayer(competition, player);
                      const backendTee = groupForPlayer?.teeboxes?.[player.name];
                      const backendHandi = groupForPlayer?.handicaps?.[player.name];
                      if (!backendTee && !backendHandi) {
                        setShowTeeModal(true);
                        setSelectedTee('');
                        setInputHandicap('');
                      } else {
                        setShowTeeModal(false);
                      }
                    }
                  }, [player, competition]);
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
          <div className="flex flex-col items-center px-4">
            <div className="mt-12">
              <h1 className="text-4xl font-extrabold drop-shadow-lg text-center mb-1 leading-tight" style={{ color: '#002F5F', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>
                {groupForPlayer && competition.groups.length > 1
                  ? `4 BALL #${competition.groups.indexOf(groupForPlayer) + 1}'s Scorecard`
                  : 'Scorecard'}
              </h1>
              <div className="mx-auto mt-2 mb-4" style={{height: '2px', maxWidth: 340, background: 'white', opacity: 0.7, borderRadius: 2}}></div>
            </div>
          </div>
          <div className="flex flex-col items-center px-4 mt-4">
            <div className="w-full max-w-4xl rounded-2xl bg-transparent text-white mb-8 px-8 p-6" style={{ backdropFilter: 'none', fontFamily: 'Lato, Arial, sans-serif', color: 'white', borderColor: '#FFD700' }}>
              <div className="flex flex-row justify-between items-start w-full">
                {/* Mini table and comp info */}
                <div className="mb-2 text-white/90" style={{ fontFamily: 'Lato, Arial, sans-serif', color: 'white' }}>
                  <span className="font-semibold">Date:</span> {formatDate(competition.date)} <br />
                  <span className="font-semibold">Club:</span> {competition.club || '-'} <br />
                  <span className="font-semibold">Type:</span> {COMP_TYPE_DISPLAY[competition.type] || competition.type?.replace(/(^|\s|_)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase()).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/-/g, ' ')} <br />
                  {/* Tee Box removed as per user request */}
                  <span className="font-semibold">Handicap Allowance:</span> {
                    competition.handicapallowance && competition.handicapallowance !== 'N/A'
                      ? competition.handicapallowance + '%'
                      : 'N/A'
                  } <br />
                  <span className="font-semibold">Notes:</span> {competition.notes && competition.notes.trim() ? competition.notes : '-'} <br />
                  <br />
                  {/* 4 Ball number removed as per user request */}
                  {groupPlayers.length >= 2 && (
                    <div className="my-2">
                      <table className="min-w-[300px] border text-white text-sm rounded mb-2" style={{ fontFamily: 'Lato, Arial, sans-serif', background: '#002F5F', color: 'white', borderColor: '#FFD700' }}>
                        <thead>
                          <tr>
                            <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}></th>
                            <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Name</th>
                            <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Tee</th>
                            <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>CH</th>
                            <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>PH</th>
                            <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Waters</th>
                            <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Dog</th>
                            <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>2 Clubs</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupPlayers.map((name, idx) => {
                            // State for Waters, Dog, 2 Clubs
                            if (!miniTableStats[name]) {
                              miniTableStats[name] = { waters: '', dog: false, twoClubs: '' };
                            }
                            // Try to get full and adjusted handicap from the correct group structure
                            let fullHandicap = '';
                            let adjHandicap = '';
                            let teebox = '';
                            if (groupForPlayer) {
                              if (groupForPlayer.handicaps) {
                                fullHandicap = groupForPlayer.handicaps[name] || '';
                              }
                              if (groupForPlayer.teeboxes) {
                                teebox = groupForPlayer.teeboxes[name] || '';
                              }
                            }
                            // Calculate adjusted handicap if allowance is set
                            if (fullHandicap && competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                              adjHandicap = Math.round(Number(fullHandicap) * Number(competition.handicapallowance) / 100);
                            }
                            // Conditional tee color
                            let teeBg = '';
                            if (teebox === 'White') teeBg = 'bg-white text-black border-white';
                            else if (teebox === 'Red') teeBg = 'bg-red-500 text-white';
                            else if (teebox === 'Yellow') teeBg = 'bg-yellow-300 text-black border-white';
                            // Format player name as first initial + surname (ignore nickname), or show guest display name if present
                            let displayName = name;
                            const guestIdx = ['Guest 1','Guest 2','Guest 3'].indexOf(name);
                            let guestDisplay = null;
                            if (guestIdx !== -1 && Array.isArray(groupForPlayer?.displayNames) && groupForPlayer.displayNames[guestIdx]) {
                              guestDisplay = `GUEST - ${groupForPlayer.displayNames[guestIdx]}`;
                            }
                            if (guestDisplay) {
                              displayName = guestDisplay;
                            } else if (guestIdx !== -1) {
                              displayName = name;
                            } else if (name && typeof name === 'string') {
                              const parts = name.trim().split(' ');
                              if (parts.length > 1) {
                                displayName = parts[0][0] + '. ' + parts[parts.length - 1];
                              } else {
                                displayName = name;
                              }
                            }
                            return (
                              <tr key={name}>
                                <td className={`border border-white px-2 py-1 font-bold text-center align-middle ${playerColors[idx % playerColors.length]}`} style={{ minWidth: 32 }}>{String.fromCharCode(65 + idx)}</td>
                                <td className={`border border-white px-2 py-1 font-semibold text-left ${playerColors[idx % playerColors.length]}`}>{displayName}</td>
                                <td className={`border px-2 py-1 text-center ${teeBg}`}>
                                  {teebox !== '' ? teebox : '-'}
                                </td>
                                <td className="border px-2 py-1 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    max="54"
                                    value={fullHandicap !== '' ? fullHandicap : ''}
                                    onChange={async (e) => {
                                      const newCH = e.target.value;
                                      // Update backend for this player's CH
                                      if (!groupTeamId) return;
                                      let userId = null;
                                      if (competition.users) {
                                        const user = competition.users.find(u => u.name === name);
                                        if (user) userId = user.id || user.user_id || user.userId;
                                      }
                                      if (!userId) return;
                                      const patchUrl = `/api/teams/${groupTeamId}/users/${userId}`;
                                      const patchBody = { course_handicap: newCH };
                                      try {
                                        await fetch(patchUrl, {
                                          method: 'PATCH',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify(patchBody)
                                        });
                                        // Optionally update UI immediately
                                        if (groupForPlayer && groupForPlayer.handicaps) {
                                          groupForPlayer.handicaps[name] = newCH;
                                        }
                                        // Optionally re-fetch competition data
                                        if (competition && competition.id) {
                                          const res = await fetch(`/api/competitions/${competition.id}`);
                                          if (res.ok) {
                                            const data = await res.json();
                                            setCompetition(data);
                                          }
                                        }
                                      } catch (err) {
                                        alert('Failed to update Course Handicap.');
                                      }
                                    }}
                                    className="w-14 text-center text-white bg-transparent rounded focus:outline-none font-semibold no-spinner"
                                    style={{ border: 'none', MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none' }}
                                  />
                                </td>
                                <td className="border px-2 py-1 text-center">{adjHandicap !== '' ? adjHandicap : '-'}</td>
                                {/* Waters column */}
                                <td className="border px-2 py-1 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    className="w-12 text-center text-white bg-transparent rounded focus:outline-none font-semibold no-spinner"
                                    style={{ border: 'none', MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none' }}
                                    value={miniTableStats[name]?.waters || ''}
                                    onChange={async e => {
                                      const val = e.target.value;
                                      setMiniTableStats(stats => ({
                                        ...stats,
                                        [name]: {
                                          ...stats[name],
                                          waters: val
                                        }
                                      }));
                                      // Update backend
                                      if (!groupTeamId || !competition.users) return;
                                      const user = competition.users.find(u => u.name === name);
                                      if (!user) return;
                                      const userId = user.id || user.user_id || user.userId;
                                      await fetch(`/api/teams/${groupTeamId}/users/${userId}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ waters: val })
                                      });
                                      if (val && Number(val) > 0) {
                                        setWatersPlayer(name);
                                        setShowWatersPopup(true);
                                        if (watersTimeoutRef.current) clearTimeout(watersTimeoutRef.current);
                                        watersTimeoutRef.current = setTimeout(() => setShowWatersPopup(false), 30000);
                                      }
                                    }}
                                  />
      {/* Waters Popup */}
      {showWatersPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-8 flex flex-col items-center border-4 border-[#FFD700] popup-jiggle">
            <span className="text-6xl mb-2" role="img" aria-label="Splash">💧</span>
            <h2 className="text-3xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>Splash!</h2>
            <div className="text-lg font-semibold text-white mb-1" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>{watersPlayer} has just earned a water</div>
            <button
              className="mt-2 px-6 py-2 rounded-2xl font-bold shadow border border-white transition text-lg"
              style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
              onClick={() => {
                setShowWatersPopup(false);
                if (watersTimeoutRef.current) clearTimeout(watersTimeoutRef.current);
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
                                </td>
                                {/* Dog column */}
                                <td className="border px-2 py-1 text-center">
                                  <input
                                    type="checkbox"
                                    checked={!!miniTableStats[name]?.dog}
                                    onChange={async e => {
                                      if (!groupTeamId || !competition.users) return;
                                      const user = competition.users.find(u => u.name === name);
                                      if (!user) return;
                                      const userId = user.id || user.user_id || user.userId;
                                      if (e.target.checked) {
                                        // Unset dog for all, set for this player
                                        setMiniTableStats(stats => {
                                          const newStats = {};
                                          Object.keys(stats).forEach(playerName => {
                                            newStats[playerName] = {
                                              ...stats[playerName],
                                              dog: false
                                            };
                                          });
                                          newStats[name] = {
                                            ...newStats[name],
                                            dog: true
                                          };
                                          return newStats;
                                        });
                                        // Unset dog for all in backend, then set for this player
                                        for (const otherName of groupPlayers) {
                                          const otherUser = competition.users.find(u => u.name === otherName);
                                          if (!otherUser) continue;
                                          const otherUserId = otherUser.id || otherUser.user_id || otherUser.userId;
                                          await fetch(`/api/teams/${groupTeamId}/users/${otherUserId}`, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ dog: otherName === name })
                                          });
                                        }
                                        setDogPlayer(name);
                                        setShowDogPopup(true);
                                        if (dogTimeoutRef.current) clearTimeout(dogTimeoutRef.current);
                                        dogTimeoutRef.current = setTimeout(() => setShowDogPopup(false), 30000);
                                      } else {
                                        setMiniTableStats(stats => ({
                                          ...stats,
                                          [name]: {
                                            ...stats[name],
                                            dog: false
                                          }
                                        }));
                                        await fetch(`/api/teams/${groupTeamId}/users/${userId}`, {
                                          method: 'PATCH',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ dog: false })
                                        });
                                      }
                                    }}
                                  />
                                </td>
                                {/* 2 Clubs column */}
                                <td className="border px-2 py-1 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    className="w-12 text-center text-white bg-transparent rounded focus:outline-none font-semibold no-spinner"
                                    style={{ border: 'none', MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none' }}
                                    value={miniTableStats[name]?.twoClubs || ''}
                                    onChange={async e => {
                                      const val = e.target.value;
                                      setMiniTableStats(stats => ({
                                        ...stats,
                                        [name]: {
                                          ...stats[name],
                                          twoClubs: val
                                        }
                                      }));
                                      if (!groupTeamId || !competition.users) return;
                                      const user = competition.users.find(u => u.name === name);
                                      if (!user) return;
                                      const userId = user.id || user.user_id || user.userId;
                                      await fetch(`/api/teams/${groupTeamId}/users/${userId}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ two_clubs: val })
                                      });
                                    }}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {competition.notes && <><span className="font-semibold">Notes from Captain:</span> {competition.notes} <br /></>}
                </div>
                {/* Action buttons stacked vertically at top right */}
                <div className="flex flex-col items-end space-y-2 ml-8 mt-2">
                  {/* Dashboard button removed */}
                  <button
                    onClick={() => {
                      if (competition && (competition.id || competition._id || competition.joinCode || competition.joincode)) {
                        const compId = competition.id || competition._id || competition.joinCode || competition.joincode;
                        navigate(`/results/${compId}`);
                      } else {
                        alert('Competition ID not found.');
                      }
                    }}
                    className="py-2 px-4 w-44 bg-[#1B3A6B] text-white font-semibold rounded-2xl hover:bg-white hover:text-[#1B3A6B] border border-white transition"
                  >
                    <TrophyIcon className="h-5 w-5 mr-1 inline-block align-text-bottom" style={{ color: '#FFD700', filter: 'drop-shadow(0 1px 2px #bfa100)' }} />
                    Leaderboard
                  </button>
                  {/* Sign Scorecard button removed */}
                  <button
                    onClick={() => setShowResetModal(true)}
                    className="py-2 px-4 w-44 text-white font-bold rounded-2xl border border-white transition flex items-center"
                    style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                    onMouseOver={e => e.currentTarget.style.backgroundColor = '#FFD700'}
                    onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
                  >
                    <ArrowPathIcon className="h-6 w-6 mr-2 inline-block" />
                    Reset Scores
                  </button>
                </div>
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
                      // Guest display name logic
                      let displayName = name;
                      const group = competition.groups?.find(g => g.players?.includes(name));
                      const guestIdx = ['Guest 1','Guest 2','Guest 3'].indexOf(name);
                      let guestDisplay = null;
                      if (guestIdx !== -1 && Array.isArray(group?.displayNames) && group.displayNames[guestIdx]) {
                        guestDisplay = `GUEST - ${group.displayNames[guestIdx]}`;
                      }
                      if (guestDisplay) {
                        displayName = guestDisplay;
                      } else if (guestIdx !== -1) {
                        displayName = name;
                      } else if (name && typeof name === 'string') {
                        const parts = name.trim().split(' ');
                        if (parts.length > 1) {
                          displayName = parts[0][0] + '. ' + parts[parts.length - 1];
                        } else {
                          displayName = name;
                        }
                      }
                      return (
                        <li key={name} className="mb-1">
                          <span className="font-semibold">{displayName}</span>
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
                {/* Front 9 Table */}
                <h3 className="text-lg font-bold text-center mb-2 text-white">Front 9</h3>
                <table className="min-w-full border text-center mb-8">
                  <thead>
                    <tr className="bg-gray-800/90">
                      <th className="border px-2 py-1 bg-white/5"></th>
                      <th className="border px-2 py-1 bg-white/5">HOLE</th>
                      {defaultHoles.slice(0,9).map(hole => (
                        <th key={hole.number} className="border px-2 py-1 bg-white/5">{hole.number}</th>
                      ))}
                      <th className="border px-2 py-1 bg-white/5 font-bold">Out</th>
                    </tr>
                    <tr className="bg-blue-900/90">
                      <th className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}></th>
                      <th className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}>PAR</th>
                      {defaultHoles.slice(0,9).map(hole => (
                        <th key={hole.number} className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}>{hole.par}</th>
                      ))}
                      <th className="border px-2 py-1 font-bold" style={{background:'#1B3A6B',color:'white'}}>36</th>
                    </tr>
                    <tr className="bg-gray-900/90">
                      <th className="border px-2 py-1 bg-white/5"></th>
                      <th className="border px-2 py-1 bg-white/5">STROKE</th>
                      {defaultHoles.slice(0,9).map(hole => (
                        <th key={hole.number} className="border px-2 py-1 bg-white/5">{hole.index}</th>
                      ))}
                      <th className="border px-2 py-1 bg-white/5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupPlayers.map((name, pIdx) => (
                      <React.Fragment key={name + '-rows-front'}>
                        {/* Score row */}
                        <tr key={name + '-gross-front'}>
                          <td rowSpan={2} className={`border border-white px-2 py-1 font-bold text-lg text-center align-middle ${playerColors[pIdx % playerColors.length]}`} style={{ minWidth: 32, verticalAlign: 'middle' }}>
                            {String.fromCharCode(65 + pIdx)}
                          </td>
                          <td className="border px-2 py-1 text-base font-bold bg-white/10 text-center" style={{ minWidth: 40 }}>Score</td>
                          {defaultHoles.slice(0,9).map((hole, hIdx) => (
                            <td key={hIdx} className="border py-1 text-center align-middle font-bold text-base">
                              <div className="flex items-center justify-center">
                                {(() => {
                                  const row = Array.isArray(scores[pIdx]) ? scores[pIdx] : [];
                                  const val = row[hIdx];
                                  const gross = parseInt(val, 10);
                                  const isEagleOrBetter = gross > 0 && gross <= hole.par - 2;
                                  const isBirdie = gross > 0 && gross === hole.par - 1;
                                  const isBogey = gross > 0 && gross === hole.par + 1;
                                  const isDoubleBogey = gross > 0 && gross === hole.par + 2;
                                  const isTripleOrWorse = gross > 0 && gross >= hole.par + 3;
                                  let inputClass = 'w-10 h-10 text-center focus:outline-none block mx-auto font-bold text-base no-spinner px-0';
                                  if (isEagleOrBetter) inputClass += ' text-blue-400 border-blue-400 rounded-full border-2';
                                  else if (isBirdie) inputClass += ' text-green-500 border-green-500 rounded-full border';
                                  else if (isTripleOrWorse) inputClass += ' text-purple-400 border-purple-400 border';
                                  else if (isDoubleBogey) inputClass += ' text-red-400 border-red-400 border-2 double-border';
                                  else if (isBogey) inputClass += ' text-yellow-400 border-yellow-400 border';
                                  else inputClass += ' text-white';
                                  return (
                                    <input
                                      type="number"
                                      min="0"
                                      max="20"
                                      value={val === undefined ? '' : val}
                                      onChange={e => handleScoreChange(hIdx, e.target.value, pIdx)}
                                      className={inputClass}
                                      inputMode="numeric"
                                      style={{ MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}
                                    />
                                  );
                                })()}
                              </div>
                            </td>
                          ))}
                          <td className="border px-2 py-1 font-bold text-base">{Array.isArray(scores[pIdx]) ? scores[pIdx].slice(0,9).reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0) : ''}</td>
                        </tr>
                        {/* Result row (no player label cell) */}
                        <tr key={name + '-net-front'}>
                          <td className="border px-2 py-1 bg-white/10 text-base font-bold text-center align-middle" style={{ minWidth: 40, verticalAlign: 'middle', height: '44px' }}>Result</td>
                          {(() => {
                            let adjHandicap = 0;
                            if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[name]) {
                              const fullHandicap = parseInt(groupForPlayer.handicaps[name], 10) || 0;
                              if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                adjHandicap = Math.round(fullHandicap * Number(competition.handicapallowance) / 100);
                              } else {
                                adjHandicap = fullHandicap;
                              }
                            }
                            let pointsTotal = 0;
                            const row = Array.isArray(scores[pIdx]) ? scores[pIdx] : [];
                            return defaultHoles.slice(0,9).map((hole, hIdx) => {
                              const strokeIdx = hole.index;
                              let strokesReceived = 0;
                              if (adjHandicap > 0) {
                                if (adjHandicap >= 18) {
                                  strokesReceived = 1;
                                  if (adjHandicap - 18 >= strokeIdx) strokesReceived = 2;
                                  else if (strokeIdx <= (adjHandicap % 18)) strokesReceived = 2;
                                } else if (strokeIdx <= adjHandicap) {
                                  strokesReceived = 1;
                                }
                              }
                              const gross = parseInt(row[hIdx], 10) || 0;
                              const net = gross ? gross - strokesReceived : null;
                              // Stableford points: 6=triple eagle, 5=double eagle, 4=eagle, 3=birdie, 2=par, 1=bogey, 0=worse
                              let pts = 0;
                              if (net !== null) {
                                if (net === hole.par - 4) pts = 6; // triple eagle
                                else if (net === hole.par - 3) pts = 5; // double eagle (albatross)
                                else if (net === hole.par - 2) pts = 4; // eagle
                                else if (net === hole.par - 1) pts = 3; // birdie
                                else if (net === hole.par) pts = 2; // par
                                else if (net === hole.par + 1) pts = 1; // bogey
                              }
                              pointsTotal += pts;
                              return (
                                <td key={hIdx} className="border px-1 py-1 bg-white/5 align-middle font-bold text-base" style={{ verticalAlign: 'middle', height: '44px' }}>
                                  {gross ? pts : ''}
                                </td>
                              );
                            });
                          })()}
                          {/* Net front 9 total */}
                          <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>
                            {(() => {
                              let adjHandicap = 0;
                              if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[name]) {
                                const fullHandicap = parseInt(groupForPlayer.handicaps[name], 10) || 0;
                                if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                  adjHandicap = Math.round(fullHandicap * Number(competition.handicapallowance) / 100);
                                } else {
                                  adjHandicap = fullHandicap;
                                }
                              }
                              let pointsTotal = 0;
                              const row = Array.isArray(scores[pIdx]) ? scores[pIdx] : [];
                              defaultHoles.slice(0,9).forEach((hole, hIdx) => {
                                const strokeIdx = hole.index;
                                let strokesReceived = 0;
                                if (adjHandicap > 0) {
                                  if (adjHandicap >= 18) {
                                    strokesReceived = 1;
                                    if (adjHandicap - 18 >= strokeIdx) strokesReceived = 2;
                                    else if (strokeIdx <= (adjHandicap % 18)) strokesReceived = 2;
                                  } else if (strokeIdx <= adjHandicap) {
                                    strokesReceived = 1;
                                  }
                                }
                                const gross = row[hIdx] !== undefined && row[hIdx] !== '' ? parseInt(row[hIdx], 10) : null;
                                const net = gross !== null && !isNaN(gross) && gross > 0 ? gross - strokesReceived : null;
                                let pts = '';
                                if (net !== null) {
                                  if (net === hole.par - 4) pts = 6;
                                  else if (net === hole.par - 3) pts = 5;
                                  else if (net === hole.par - 2) pts = 4;
                                  else if (net === hole.par - 1) pts = 3;
                                  else if (net === hole.par) pts = 2;
                                  else if (net === hole.par + 1) pts = 1;
                                  else pts = 0;
                                }
                                if (pts !== '' && gross !== null && !isNaN(gross) && gross > 0) pointsTotal += pts;
                              });
                              return pointsTotal !== 0 ? pointsTotal : '';
                            })()}
                          </td>
                        </tr>
                        {/* Insert B/B Score row after player B's Result row (pIdx === 1) */}
                        {pIdx === 1 && (
                          <tr key="bb-score-front-ab">
                            <td className="border border-white px-2 py-1" style={{ minWidth: 32 }}></td>
                            <td className="border px-2 py-1 text-base font-bold text-center" style={{ minWidth: 40 }}>B/B Score</td>
                            {defaultHoles.slice(0,9).map((hole, hIdx) => {
                              // ...existing code for A/B logic...
                              let adjHandicapA = 0;
                              if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[0]]) {
                                const fullHandicapA = parseInt(groupForPlayer.handicaps[groupPlayers[0]], 10) || 0;
                                if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                  adjHandicapA = Math.round(fullHandicapA * Number(competition.handicapallowance) / 100);
                                } else {
                                  adjHandicapA = fullHandicapA;
                                }
                              }
                              let strokesA = 0;
                              if (adjHandicapA > 0) {
                                if (adjHandicapA >= 18) {
                                  strokesA = 1;
                                  if (adjHandicapA - 18 >= hole.index) strokesA = 2;
                                  else if (hole.index <= (adjHandicapA % 18)) strokesA = 2;
                                } else if (hole.index <= adjHandicapA) {
                                  strokesA = 1;
                                }
                              }
                              const grossA = Array.isArray(scores[0]) ? parseInt(scores[0][hIdx], 10) : null;
                              const netA = grossA !== null && !isNaN(grossA) && grossA > 0 ? grossA - strokesA : null;
                              // Calculate net for B
                              let adjHandicapB = 0;
                              if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[1]]) {
                                const fullHandicapB = parseInt(groupForPlayer.handicaps[groupPlayers[1]], 10) || 0;
                                if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                  adjHandicapB = Math.round(fullHandicapB * Number(competition.handicapallowance) / 100);
                                } else {
                                  adjHandicapB = fullHandicapB;
                                }
                              }
                              let strokesB = 0;
                              if (adjHandicapB > 0) {
                                if (adjHandicapB >= 18) {
                                  strokesB = 1;
                                  if (adjHandicapB - 18 >= hole.index) strokesB = 2;
                                  else if (hole.index <= (adjHandicapB % 18)) strokesB = 2;
                                } else if (hole.index <= adjHandicapB) {
                                  strokesB = 1;
                                }
                              }
                              const grossB = Array.isArray(scores[1]) ? parseInt(scores[1][hIdx], 10) : null;
                              const netB = grossB !== null && !isNaN(grossB) && grossB > 0 ? grossB - strokesB : null;
                              function points(net, par) {
                                if (net == null) return '';
                                if (net === par - 4) return 6;
                                if (net === par - 3) return 5;
                                if (net === par - 2) return 4;
                                if (net === par - 1) return 3;
                                if (net === par) return 2;
                                if (net === par + 1) return 1;
                                return 0;
                              }
                              const ptsA = points(netA, hole.par);
                              const ptsB = points(netB, hole.par);
                              const best = ptsA === '' && ptsB === '' ? '' : Math.max(ptsA || 0, ptsB || 0);
                              const bothBlank = (grossA === null && grossB === null);
                              return (
                                <td key={hIdx} className="border border-white py-1 text-center align-middle font-bold text-base text-white" style={{ verticalAlign: 'middle', height: '44px' }}>{bothBlank ? '' : best}</td>
                              );
                            })}
                            <td className="border border-white px-2 py-1 font-bold text-base text-white" style={{ verticalAlign: 'middle', height: '44px' }}>
                              {(() => {
                                let total = 0;
                                for (let hIdx = 0; hIdx < 9; hIdx++) {
                                  const hole = defaultHoles[hIdx];
                                  // ...existing code for A/B logic...
                                  let adjHandicapA = 0;
                                  if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[0]]) {
                                    const fullHandicapA = parseInt(groupForPlayer.handicaps[groupPlayers[0]], 10) || 0;
                                    if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                      adjHandicapA = Math.round(fullHandicapA * Number(competition.handicapallowance) / 100);
                                    } else {
                                      adjHandicapA = fullHandicapA;
                                    }
                                  }
                                  let strokesA = 0;
                                  if (adjHandicapA > 0) {
                                    if (adjHandicapA >= 18) {
                                      strokesA = 1;
                                      if (adjHandicapA - 18 >= hole.index) strokesA = 2;
                                      else if (hole.index <= (adjHandicapA % 18)) strokesA = 2;
                                    } else if (hole.index <= adjHandicapA) {
                                      strokesA = 1;
                                    }
                                  }
                                  const grossA = Array.isArray(scores[0]) ? parseInt(scores[0][hIdx], 10) : null;
                                  const netA = grossA !== null && !isNaN(grossA) && grossA > 0 ? grossA - strokesA : null;
                                  // ...existing code for B...
                                  let adjHandicapB = 0;
                                  if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[1]]) {
                                    const fullHandicapB = parseInt(groupForPlayer.handicaps[groupPlayers[1]], 10) || 0;
                                    if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                      adjHandicapB = Math.round(fullHandicapB * Number(competition.handicapallowance) / 100);
                                    } else {
                                      adjHandicapB = fullHandicapB;
                                    }
                                  }
                                  let strokesB = 0;
                                  if (adjHandicapB > 0) {
                                    if (adjHandicapB >= 18) {
                                      strokesB = 1;
                                      if (adjHandicapB - 18 >= hole.index) strokesB = 2;
                                      else if (hole.index <= (adjHandicapB % 18)) strokesB = 2;
                                    } else if (hole.index <= adjHandicapB) {
                                      strokesB = 1;
                                    }
                                  }
                                  const grossB = Array.isArray(scores[1]) ? parseInt(scores[1][hIdx], 10) : null;
                                  const netB = grossB !== null && !isNaN(grossB) && grossB > 0 ? grossB - strokesB : null;
                                  function points(net, par) {
                                    if (net == null) return '';
                                    if (net === par - 4) return 6;
                                    if (net === par - 3) return 5;
                                    if (net === par - 2) return 4;
                                    if (net === par - 1) return 3;
                                    if (net === par) return 2;
                                    if (net === par + 1) return 1;
                                    return 0;
                                  }
                                  const ptsA = points(netA, hole.par);
                                  const ptsB = points(netB, hole.par);
                                  const best = ptsA === '' && ptsB === '' ? '' : Math.max(ptsA || 0, ptsB || 0);
                                  if (best !== '') total += best;
                                }
                                return total !== 0 ? total : '';
                              })()}
                            </td>
                          </tr>
                        )}
                        {pIdx === 3 && groupPlayers.length >= 4 && (
                          <tr key="bb-score-front-cd">
                            <td className="border border-white px-2 py-1" style={{ minWidth: 32 }}></td>
                            <td className="border px-2 py-1 text-base font-bold text-center" style={{ minWidth: 40 }}>B/B Score</td>
                            {defaultHoles.slice(0,9).map((hole, hIdx) => {
                              // ...existing code for C/D logic...
                              let adjHandicapC = 0;
                              if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[2]]) {
                                const fullHandicapC = parseInt(groupForPlayer.handicaps[groupPlayers[2]], 10) || 0;
                                if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                  adjHandicapC = Math.round(fullHandicapC * Number(competition.handicapallowance) / 100);
                                } else {
                                  adjHandicapC = fullHandicapC;
                                }
                              }
                              let strokesC = 0;
                              if (adjHandicapC > 0) {
                                if (adjHandicapC >= 18) {
                                  strokesC = 1;
                                  if (adjHandicapC - 18 >= hole.index) strokesC = 2;
                                  else if (hole.index <= (adjHandicapC % 18)) strokesC = 2;
                                } else if (hole.index <= adjHandicapC) {
                                  strokesC = 1;
                                }
                              }
                              const grossC = Array.isArray(scores[2]) ? parseInt(scores[2][hIdx], 10) : null;
                              const netC = grossC !== null && !isNaN(grossC) && grossC > 0 ? grossC - strokesC : null;
                              // Calculate net for D
                              let adjHandicapD = 0;
                              if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[3]]) {
                                const fullHandicapD = parseInt(groupForPlayer.handicaps[groupPlayers[3]], 10) || 0;
                                if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                  adjHandicapD = Math.round(fullHandicapD * Number(competition.handicapallowance) / 100);
                                } else {
                                  adjHandicapD = fullHandicapD;
                                }
                              }
                              let strokesD = 0;
                              if (adjHandicapD > 0) {
                                if (adjHandicapD >= 18) {
                                  strokesD = 1;
                                  if (adjHandicapD - 18 >= hole.index) strokesD = 2;
                                  else if (hole.index <= (adjHandicapD % 18)) strokesD = 2;
                                } else if (hole.index <= adjHandicapD) {
                                  strokesD = 1;
                                }
                              }
                              const grossD = Array.isArray(scores[3]) ? parseInt(scores[3][hIdx], 10) : null;
                              const netD = grossD !== null && !isNaN(grossD) && grossD > 0 ? grossD - strokesD : null;
                              function points(net, par) {
                                if (net == null) return '';
                                if (net === par - 4) return 6;
                                if (net === par - 3) return 5;
                                if (net === par - 2) return 4;
                                if (net === par - 1) return 3;
                                if (net === par) return 2;
                                if (net === par + 1) return 1;
                                return 0;
                              }
                              const ptsC = points(netC, hole.par);
                              const ptsD = points(netD, hole.par);
                              const best = ptsC === '' && ptsD === '' ? '' : Math.max(ptsC || 0, ptsD || 0);
                              const bothBlank = (grossC === null && grossD === null);
                              return (
                                <td key={hIdx} className="border border-white py-1 text-center align-middle font-bold text-base text-white" style={{ verticalAlign: 'middle', height: '44px' }}>{bothBlank ? '' : best}</td>
                              );
                            })}
                            <td className="border border-white px-2 py-1 font-bold text-base text-white" style={{ verticalAlign: 'middle', height: '44px' }}>
                              {(() => {
                                let total = 0;
                                for (let hIdx = 0; hIdx < 9; hIdx++) {
                                  const hole = defaultHoles[hIdx];
                                  // ...existing code for C/D logic...
                                  let adjHandicapC = 0;
                                  if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[2]]) {
                                    const fullHandicapC = parseInt(groupForPlayer.handicaps[groupPlayers[2]], 10) || 0;
                                    if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                      adjHandicapC = Math.round(fullHandicapC * Number(competition.handicapallowance) / 100);
                                    } else {
                                      adjHandicapC = fullHandicapC;
                                    }
                                  }
                                  let strokesC = 0;
                                  if (adjHandicapC > 0) {
                                    if (adjHandicapC >= 18) {
                                      strokesC = 1;
                                      if (adjHandicapC - 18 >= hole.index) strokesC = 2;
                                      else if (hole.index <= (adjHandicapC % 18)) strokesC = 2;
                                    } else if (hole.index <= adjHandicapC) {
                                      strokesC = 1;
                                    }
                                  }
                                  const grossC = Array.isArray(scores[2]) ? parseInt(scores[2][hIdx], 10) : null;
                                  const netC = grossC !== null && !isNaN(grossC) && grossC > 0 ? grossC - strokesC : null;
                                  // ...existing code for D...
                                  let adjHandicapD = 0;
                                  if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[3]]) {
                                    const fullHandicapD = parseInt(groupForPlayer.handicaps[groupPlayers[3]], 10) || 0;
                                    if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                      adjHandicapD = Math.round(fullHandicapD * Number(competition.handicapallowance) / 100);
                                    } else {
                                      adjHandicapD = fullHandicapD;
                                    }
                                  }
                                  let strokesD = 0;
                                  if (adjHandicapD > 0) {
                                    if (adjHandicapD >= 18) {
                                      strokesD = 1;
                                      if (adjHandicapD - 18 >= hole.index) strokesD = 2;
                                      else if (hole.index <= (adjHandicapD % 18)) strokesD = 2;
                                    } else if (hole.index <= adjHandicapD) {
                                      strokesD = 1;
                                    }
                                  }
                                  const grossD = Array.isArray(scores[3]) ? parseInt(scores[3][hIdx], 10) : null;
                                  const netD = grossD !== null && !isNaN(grossD) && grossD > 0 ? grossD - strokesD : null;
                                  function points(net, par) {
                                    if (net == null) return '';
                                    if (net === par - 4) return 6;
                                    if (net === par - 3) return 5;
                                    if (net === par - 2) return 4;
                                    if (net === par - 1) return 3;
                                    if (net === par) return 2;
                                    if (net === par + 1) return 1;
                                    return 0;
                                  }
                                  const ptsC = points(netC, hole.par);
                                  const ptsD = points(netD, hole.par);
                                  const best = ptsC === '' && ptsD === '' ? '' : Math.max(ptsC || 0, ptsD || 0);
                                  if (best !== '') total += best;
                                }
                                return total !== 0 ? total : '';
                              })()}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>

                {/* Back 9 Table */}
                <h3 className="text-lg font-bold text-center mb-2 text-white">Back 9</h3>
                <table className="min-w-full border text-center">
                  <thead>
                    <tr className="bg-gray-800/90">
                      <th className="border px-2 py-1 bg-white/5"></th>
                      <th className="border px-2 py-1 bg-white/5">HOLE</th>
                      {defaultHoles.slice(9,18).map(hole => (
                        <th key={hole.number} className="border px-2 py-1 bg-white/5">{hole.number}</th>
                      ))}
                      <th className="border px-2 py-1 bg-white/5 font-bold">In</th>
                      <th className="border px-2 py-1 bg-white/5 font-bold">TOTAL</th>
                    </tr>
                    <tr className="bg-blue-900/90">
                      <th className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}></th>
                      <th className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}>PAR</th>
                      {defaultHoles.slice(9,18).map(hole => (
                        <th key={hole.number} className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}>{hole.par}</th>
                      ))}
                      <th className="border px-2 py-1 font-bold" style={{background:'#1B3A6B',color:'white'}}>36</th>
                      <th className="border px-2 py-1 font-bold" style={{background:'#1B3A6B',color:'white'}}>72</th>
                    </tr>
                    <tr className="bg-gray-900/90">
                      <th className="border px-2 py-1 bg-white/5"></th>
                      <th className="border px-2 py-1 bg-white/5">STROKE</th>
                      {defaultHoles.slice(9,18).map(hole => (
                        <th key={hole.number} className="border px-2 py-1 bg-white/5">{hole.index}</th>
                      ))}
                      <th className="border px-2 py-1 bg-white/5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupPlayers.map((name, pIdx) => (
                      <React.Fragment key={name + '-rows-back'}>
                        {/* Gross row */}
                        <tr key={name + '-gross-back'}>
                          <td rowSpan={2} className={`border border-white px-2 py-1 font-bold text-lg text-center align-middle ${playerColors[pIdx % playerColors.length]}`} style={{ minWidth: 32, verticalAlign: 'middle' }}>
                            {String.fromCharCode(65 + pIdx)}
                          </td>
                          <td className="border px-2 py-1 text-base font-bold bg-white/10 text-center" style={{ minWidth: 40 }}>Score</td>
                          {defaultHoles.slice(9,18).map((hole, hIdx) => (
                            <td key={hIdx} className="border py-1 text-center align-middle font-bold text-base">
                              <div className="flex items-center justify-center">
                                {(() => {
                                  const row = Array.isArray(scores[pIdx]) ? scores[pIdx] : [];
                                  const val = row[hIdx+9];
                                  const gross = parseInt(val, 10);
                                  const isEagleOrBetter = gross > 0 && gross <= hole.par - 2;
                                  const isBirdie = gross > 0 && gross === hole.par - 1;
                                  const isBogey = gross > 0 && gross === hole.par + 1;
                                  const isDoubleBogey = gross > 0 && gross === hole.par + 2;
                                  const isTripleOrWorse = gross > 0 && gross >= hole.par + 3;
                                  let inputClass = 'w-10 h-10 text-center focus:outline-none block mx-auto font-bold text-base no-spinner px-0';
                                  if (isEagleOrBetter) inputClass += ' text-blue-400 border-blue-400 rounded-full border-2';
                                  else if (isBirdie) inputClass += ' text-green-500 border-green-500 rounded-full border';
                                  else if (isTripleOrWorse) inputClass += ' text-purple-400 border-purple-400 border';
                                  else if (isDoubleBogey) inputClass += ' text-red-400 border-red-400 border-2 double-border';
                                  else if (isBogey) inputClass += ' text-yellow-400 border-yellow-400 border';
                                  else inputClass += ' text-white';
                                  return (
                                    <input
                                      type="number"
                                      min="0"
                                      max="20"
                                      value={val === undefined ? '' : val}
                                      onChange={e => handleScoreChange(hIdx+9, e.target.value, pIdx)}
                                      className={inputClass}
                                      inputMode="numeric"
                                      style={{ MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}
                                    />
                                  );
                                })()}
                              </div>
                            </td>
                          ))}

                          <td className="border px-2 py-1 font-bold text-base">{Array.isArray(scores[pIdx]) ? scores[pIdx].slice(9,18).reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0) : ''}</td>
                          <td className="border px-2 py-1 font-bold text-base">{Array.isArray(scores[pIdx]) ? scores[pIdx].reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0) : ''}</td>
                        </tr>
                        {/* Net row (no player label cell) */}
                        <tr key={name + '-net-back'}>
                          <td className="border px-2 py-1 bg-white/10 text-base font-bold text-center align-middle" style={{ minWidth: 40, verticalAlign: 'middle', height: '44px' }}>Result</td>
                          {(() => {
                            let adjHandicap = 0;
                            if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[name]) {
                              const fullHandicap = parseInt(groupForPlayer.handicaps[name], 10) || 0;
                              if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                adjHandicap = Math.round(fullHandicap * Number(competition.handicapallowance) / 100);
                              } else {
                                adjHandicap = fullHandicap;
                              }
                            }
                            let pointsTotal = 0;
                            const row = Array.isArray(scores[pIdx]) ? scores[pIdx] : [];
                            return defaultHoles.slice(9,18).map((hole, hIdx) => {
                              const strokeIdx = hole.index;
                              let strokesReceived = 0;
                              if (adjHandicap > 0) {
                                if (adjHandicap >= 18) {
                                  strokesReceived = 1;
                                  if (adjHandicap - 18 >= strokeIdx) strokesReceived = 2;
                                  else if (strokeIdx <= (adjHandicap % 18)) strokesReceived = 2;
                                } else if (strokeIdx <= adjHandicap) {
                                  strokesReceived = 1;
                                }
                              }
                              const gross = parseInt(row[hIdx+9], 10) || 0;
                              const net = gross ? gross - strokesReceived : null;
                              // Stableford points: 3=birdie, 2=par, 1=bogey, 0=worse
                              let pts = 0;
                              if (net !== null) {
                                if (net === hole.par - 1) pts = 3;
                                else if (net === hole.par) pts = 2;
                                else if (net === hole.par + 1) pts = 1;
                              }
                              pointsTotal += pts;
                              return (
                                <td key={hIdx} className="border px-1 py-1 bg-white/5 align-middle font-bold text-base" style={{ verticalAlign: 'middle', height: '44px' }}>
                                  {gross ? pts : ''}
                                </td>
                              );
                            });
                          })()}
                          {/* Net back 9 and total */}
                          <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>
                            {(() => {
                              let adjHandicap = 0;
                              if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[name]) {
                                const fullHandicap = parseInt(groupForPlayer.handicaps[name], 10) || 0;
                                if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                  adjHandicap = Math.round(fullHandicap * Number(competition.handicapallowance) / 100);
                                } else {
                                  adjHandicap = fullHandicap;
                                }
                              }
                              let pointsTotal = 0;
                              const row = Array.isArray(scores[pIdx]) ? scores[pIdx] : [];
                              defaultHoles.slice(9,18).forEach((hole, hIdx) => {
                                const strokeIdx = hole.index;
                                let strokesReceived = 0;
                                if (adjHandicap > 0) {
                                  if (adjHandicap >= 18) {
                                    strokesReceived = 1;
                                    if (adjHandicap - 18 >= strokeIdx) strokesReceived = 2;
                                    else if (strokeIdx <= (adjHandicap % 18)) strokesReceived = 2;
                                  } else if (strokeIdx <= adjHandicap) {
                                    strokesReceived = 1;
                                  }
                                }
                                const gross = row[hIdx+9] !== undefined && row[hIdx+9] !== '' ? parseInt(row[hIdx+9], 10) : null;
                                const net = gross !== null && !isNaN(gross) && gross > 0 ? gross - strokesReceived : null;
                                let pts = '';
                                if (net !== null) {
                                  if (net === hole.par - 4) pts = 6;
                                  else if (net === hole.par - 3) pts = 5;
                                  else if (net === hole.par - 2) pts = 4;
                                  else if (net === hole.par - 1) pts = 3;
                                  else if (net === hole.par) pts = 2;
                                  else if (net === hole.par + 1) pts = 1;
                                  else pts = 0;
                                }
                                if (pts !== '' && gross !== null && !isNaN(gross) && gross > 0) pointsTotal += pts;
                              });
                              return pointsTotal !== 0 ? pointsTotal : '';
                            })()}
                          </td>
                          <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>
                            {(() => {
                              let adjHandicap = 0;
                              if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[name]) {
                                const fullHandicap = parseInt(groupForPlayer.handicaps[name], 10) || 0;
                                if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                  adjHandicap = Math.round(fullHandicap * Number(competition.handicapallowance) / 100);
                                } else {
                                  adjHandicap = fullHandicap;
                                }
                              }
                              let netTotal = 0;
                              const row = Array.isArray(scores[pIdx]) ? scores[pIdx] : [];
                              defaultHoles.forEach((hole, hIdx) => {
                                const strokeIdx = hole.index;
                                let strokesReceived = 0;
                                if (adjHandicap > 0) {
                                  if (adjHandicap >= 18) {
                                    strokesReceived = 1;
                                    if (adjHandicap - 18 >= strokeIdx) strokesReceived = 2;
                                    else if (strokeIdx <= (adjHandicap % 18)) strokesReceived = 2;
                                  } else if (strokeIdx <= adjHandicap) {
                                    strokesReceived = 1;
                                  }
                                }
                                const gross = parseInt(row[hIdx], 10) || 0;
                                const net = gross ? gross - strokesReceived : 0;
                                if (typeof net === 'number') netTotal += net;
                              });
                              return netTotal;
                            })()}
                          </td>
                        </tr>
                        {/* Insert B/B Score row after player B's Result row (pIdx === 1) for back 9 */}
                        {pIdx === 1 && (
                          <tr key="bb-score-back">
                            <td className="border border-white px-2 py-1" style={{ minWidth: 32 }}></td>
                            <td className="border px-2 py-1 text-base font-bold text-center" style={{ minWidth: 40 }}>B/B Score</td>
                            {defaultHoles.slice(9,18).map((hole, hIdx) => {
                              // Calculate net for A
                              let adjHandicapA = 0;
                              if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[0]]) {
                                const fullHandicapA = parseInt(groupForPlayer.handicaps[groupPlayers[0]], 10) || 0;
                                if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                  adjHandicapA = Math.round(fullHandicapA * Number(competition.handicapallowance) / 100);
                                } else {
                                  adjHandicapA = fullHandicapA;
                                }
                              }
                              let strokesA = 0;
                              if (adjHandicapA > 0) {
                                if (adjHandicapA >= 18) {
                                  strokesA = 1;
                                  if (adjHandicapA - 18 >= hole.index) strokesA = 2;
                                  else if (hole.index <= (adjHandicapA % 18)) strokesA = 2;
                                } else if (hole.index <= adjHandicapA) {
                                  strokesA = 1;
                                }
                              }
                              const grossA = Array.isArray(scores[0]) ? parseInt(scores[0][hIdx+9], 10) || 0 : 0;
                              const netA = grossA ? grossA - strokesA : null;
                              // Calculate net for B
                              let adjHandicapB = 0;
                              if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[1]]) {
                                const fullHandicapB = parseInt(groupForPlayer.handicaps[groupPlayers[1]], 10) || 0;
                                if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                  adjHandicapB = Math.round(fullHandicapB * Number(competition.handicapallowance) / 100);
                                } else {
                                  adjHandicapB = fullHandicapB;
                                }
                              }
                              let strokesB = 0;
                              if (adjHandicapB > 0) {
                                if (adjHandicapB >= 18) {
                                  strokesB = 1;
                                  if (adjHandicapB - 18 >= hole.index) strokesB = 2;
                                  else if (hole.index <= (adjHandicapB % 18)) strokesB = 2;
                                } else if (hole.index <= adjHandicapB) {
                                  strokesB = 1;
                                }
                              }
                              const grossB = Array.isArray(scores[1]) ? parseInt(scores[1][hIdx+9], 10) || 0 : 0;
                              const netB = grossB ? grossB - strokesB : null;
                              // Stableford points: 3=birdie, 2=par, 1=bogey, 0=worse
                              function points(net, par) {
                                if (net == null) return 0;
                                if (net === par - 1) return 3;
                                if (net === par) return 2;
                                if (net === par + 1) return 1;
                                return 0;
                              }
                              const ptsA = points(netA, hole.par);
                              const ptsB = points(netB, hole.par);
                              const best = Math.max(ptsA, ptsB);
                              return (
                                <td key={hIdx} className="border border-white py-1 text-center align-middle font-bold text-base text-white" style={{ verticalAlign: 'middle', height: '44px' }}>{best > 0 ? best : ''}</td>
                              );
                            })}
                            <td className="border border-white px-2 py-1 font-bold text-base text-white" style={{ verticalAlign: 'middle', height: '44px' }}>
                              {(() => {
                                let total = 0;
                                for (let hIdx = 9; hIdx < 18; hIdx++) {
                                  const hole = defaultHoles[hIdx];
                                  // A
                                  let adjHandicapA = 0;
                                  if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[0]]) {
                                    const fullHandicapA = parseInt(groupForPlayer.handicaps[groupPlayers[0]], 10) || 0;
                                    if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                      adjHandicapA = Math.round(fullHandicapA * Number(competition.handicapallowance) / 100);
                                    } else {
                                      adjHandicapA = fullHandicapA;
                                    }
                                  }
                                  let strokesA = 0;
                                  if (adjHandicapA > 0) {
                                    if (adjHandicapA >= 18) {
                                      strokesA = 1;
                                      if (adjHandicapA - 18 >= hole.index) strokesA = 2;
                                      else if (hole.index <= (adjHandicapA % 18)) strokesA = 2;
                                    } else if (hole.index <= adjHandicapA) {
                                      strokesA = 1;
                                    }
                                  }
                                  const grossA = Array.isArray(scores[0]) ? parseInt(scores[0][hIdx], 10) : null;
                                  const netA = grossA !== null && !isNaN(grossA) && grossA > 0 ? grossA - strokesA : null;
                                  // B
                                  let adjHandicapB = 0;
                                  if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[1]]) {
                                    const fullHandicapB = parseInt(groupForPlayer.handicaps[groupPlayers[1]], 10) || 0;
                                    if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                      adjHandicapB = Math.round(fullHandicapB * Number(competition.handicapallowance) / 100);
                                    } else {
                                      adjHandicapB = fullHandicapB;
                                    }
                                  }
                                  let strokesB = 0;
                                  if (adjHandicapB > 0) {
                                    if (adjHandicapB >= 18) {
                                      strokesB = 1;
                                      if (adjHandicapB - 18 >= hole.index) strokesB = 2;
                                      else if (hole.index <= (adjHandicapB % 18)) strokesB = 2;
                                    } else if (hole.index <= adjHandicapB) {
                                      strokesB = 1;
                                    }
                                  }
                                  const grossB = Array.isArray(scores[1]) ? parseInt(scores[1][hIdx], 10) : null;
                                  const netB = grossB !== null && !isNaN(grossB) && grossB > 0 ? grossB - strokesB : null;
                                  function points(net, par) {
                                    if (net == null) return '';
                                    if (net === par - 4) return 6;
                                    if (net === par - 3) return 5;
                                    if (net === par - 2) return 4;
                                    if (net === par - 1) return 3;
                                    if (net === par) return 2;
                                    if (net === par + 1) return 1;
                                    return 0;
                                  }
                                  const ptsA = points(netA, hole.par);
                                  const ptsB = points(netB, hole.par);
                                  const best = ptsA === '' && ptsB === '' ? '' : Math.max(ptsA || 0, ptsB || 0);
                                  if (best !== '') total += best;
                                }
                                return total !== 0 ? total : '';
                              })()}
                            </td>
                            <td className="border border-white px-2 py-1 font-bold text-base text-white" style={{ verticalAlign: 'middle', height: '44px' }}></td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {showResetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                  <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center border-4 border-[#FFD700]">
                    <div className="flex flex-col items-center mb-4">
                      <span className="text-5xl mb-2" role="img" aria-label="Warning">⚠️</span>
                      <h2 className="text-3xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>Reset Scorecard?</h2>
                    </div>
                    <p className="mb-6 text-white text-center text-base font-medium" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>This will <span className='font-bold' style={{ color: '#FFD700' }}>permanently clear all gross scores for all players</span> in this group.<br/>This action cannot be undone.<br/><br/>Are you sure you want to reset?</p>
                    <div className="flex gap-4 w-full justify-center">
                      <button
                        className="px-5 py-2 rounded-2xl font-bold shadow border border-white transition text-lg"
                        style={{ backgroundColor: '#888', color: 'white', fontFamily: 'Lato, Arial, sans-serif' }}
                        onClick={() => setShowResetModal(false)}
                      >
                        Cancel
                      </button>
                      <button
                        className="px-5 py-2 rounded-2xl font-bold shadow border border-white transition text-lg"
                        style={{ backgroundColor: '#FFD700', color: '#002F5F', fontFamily: 'Lato, Arial, sans-serif', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                        onMouseOver={e => e.currentTarget.style.backgroundColor = '#ffe066'}
                        onMouseOut={e => e.currentTarget.style.backgroundColor = '#FFD700'}
                        onClick={async () => {
                          await handleResetScorecard();
                          setShowResetModal(false);
                        }}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </PageBackground>
  );
}