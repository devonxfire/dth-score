


import PageBackground from './PageBackground';
// Flexible name match: case-insensitive, partial match
function nameMatch(a, b) {
  if (!a || !b) return false;
  const normA = a.trim().toLowerCase();
  const normB = b.trim().toLowerCase();
  return normA && normB && (normA === normB || (normA.length > 1 && normB.includes(normA)) || (normB.length > 1 && normA.includes(normB)));
}
// Format date as DD/MM/YYYY
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}
import { PlusIcon, EyeIcon, SignalIcon } from '@heroicons/react/24/solid';
import './scorecardPulse.css';
import './scorecardPulse.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import westlakeLogo from './assets/westlake-logo2.png';
import TopMenu from './TopMenu';

export default function Dashboard({ user, onSignOut }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [comps, setComps] = useState([]);
  const [userComp, setUserComp] = useState(null);

  useEffect(() => {
    fetch('/api/competitions')
      .then(res => res.json())
      .then(data => {
        setComps(Array.isArray(data) ? data : []);
        // Debug: log competitions
      })
      .catch(() => setComps([]));
  }, []);

  useEffect(() => {
    if (!user || !comps.length) {
      setUserComp(null);
      return;
    }
    const today = new Date();
    // Find most recent open comp where user is assigned to a group
    const openComps = comps.filter(comp => {
      if (!comp.date || !Array.isArray(comp.groups)) return false;
      const compDate = new Date(comp.date);
      const isOpen = compDate >= new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const assigned = comp.groups.some(g => Array.isArray(g.players) && g.players.some(p => nameMatch(p, user.name)));
      // Debug: log group player names and assignment check
      if (isOpen) {
        comp.groups.forEach((g, idx) => {
        });
      }
      return isOpen && assigned;
    });
    if (!openComps.length) {
      setUserComp(null);
      return;
    }
    // Sort by date descending and pick most recent
    openComps.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    setUserComp(openComps[0]);
  }, [user, comps]);

  return (
    <PageBackground>
      {/* Top nav menu */}
      <TopMenu user={user} userComp={userComp} onSignOut={onSignOut} />
      <div className="relative z-10 flex flex-col items-center px-4 mt-12">
        <img
          src={westlakeLogo}
          alt="Westlake Golf Club Badge"
          className="mb-8 max-h-48 w-auto"
          style={{ objectFit: 'contain' }}
        />
  <h1 className="text-5xl font-bold text-white mb-1 drop-shadow-lg text-center">Welcome</h1>
  <h2 className="text-3xl font-semibold text-white mb-1 drop-shadow-lg text-center">{user?.name || ''}!</h2>
      </div>
      <div className="relative z-10 flex flex-col items-center px-4 mt-2">
        <div className="w-full max-w-md rounded-2xl shadow-lg p-8 flex flex-col gap-6" style={{ background: 'none' }}>
          {userComp && (
            <button
              className="w-full py-3 px-4 text-white font-semibold rounded-2xl text-lg flex items-center justify-center gap-2 scorecard-pulse"
              style={{ boxShadow: '0 2px 8px 0 rgba(255,0,0,0.10)' }}
              onClick={() => {
                // Find the group/team the user is assigned to
                const group = userComp.groups.find(g => Array.isArray(g.players) && g.players.some(p => nameMatch(p, user.name)));
                // Find the player object in the group (if available, use nameMatch)
                let playerObj = null;
                if (group && Array.isArray(group.members)) {
                  playerObj = group.members.find(m => nameMatch(m.name, user.name)) || null;
                }
                // Fallback: build player object from user and group
                if (!playerObj) {
                  // Try to get teamId from group.teamId, group.id, or group.team_id
                  const teamId = group?.teamId || group?.id || group?.team_id || group?.group_id;
                  playerObj = {
                    name: user.name,
                    id: user.id,
                    user_id: user.id,
                    team_id: teamId,
                    teebox: group?.teeboxes?.[user.name] || '',
                    course_handicap: group?.handicaps?.[user.name] || '',
                  };
                }
                const compId = userComp.joinCode || userComp.joincode || userComp.id || userComp._id || userComp.competitionType;
                navigate(`/scorecard/${compId}`, {
                  state: {
                    player: playerObj,
                    competition: userComp,
                  }
                });
              }}
            >
              <SignalIcon className="h-6 w-6 text-white" aria-hidden="true" />
              {`My Scorecard for ${formatDate(userComp.date)}`}
            </button>
          )}
          {user?.isadmin && (
            <button
              className="w-full py-3 px-4 border border-white text-white font-semibold rounded-2xl transition text-lg flex items-center justify-center gap-2"
              style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                                onClick={() => navigate('/create')}
                                onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
                                onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
                              >
                                <PlusIcon className="h-6 w-6 text-white" aria-hidden="true" />
                                Create New Competition
                              </button>
                            )}
                            <button
                              className="w-full py-3 px-4 border border-white text-white font-semibold rounded-2xl transition text-lg flex items-center justify-center gap-2"
                              style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                              onClick={() => navigate('/recent')}
                              onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
                              onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
                            >
                              <EyeIcon className="h-6 w-6 text-white" aria-hidden="true" />
                              View All Competitions
                            </button>
                          </div>
                        </div>
    </PageBackground>
  );
}