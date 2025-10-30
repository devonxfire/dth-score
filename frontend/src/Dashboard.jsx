import OpenCompModal from './OpenCompModal';
import { apiUrl } from './api';


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
  const [showOpenCompModal, setShowOpenCompModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [comps, setComps] = useState([]);
  const [userComp, setUserComp] = useState(null);

  useEffect(() => {
    fetch(apiUrl('/api/competitions'))
      .then(res => res.json())
      .then(data => {
        setComps(Array.isArray(data) ? data : []);
      })
      .catch(() => setComps([]));
  }, []);

  useEffect(() => {
    if (!user || !comps.length) {
      setUserComp(null);
      return;
    }
    const today = new Date();
    function nameMatch(a, b) {
      if (!a || !b) return false;
      const normA = a.trim().toLowerCase();
      const normB = b.trim().toLowerCase();
      return normA && normB && (normA === normB || (normA.length > 1 && normB.includes(normA)) || (normB.length > 1 && normA.includes(normB)));
    }
    // Find any comp (open or closed) where user is in a group (players or displayNames)
    const compsWithUser = comps.filter(comp => {
      if (!Array.isArray(comp.groups)) return false;
      return comp.groups.some(g =>
        (Array.isArray(g.players) && g.players.some(p => nameMatch(p, user.name))) ||
        (Array.isArray(g.displayNames) && g.displayNames.some(p => nameMatch(p, user.name)))
      );
    });
    let scorecardComp = null;
    if (compsWithUser.length > 0) {
      // Prefer open comps, then most recent
      const openComps = compsWithUser.filter(comp => {
        if (!comp.date) return false;
        const compDate = new Date(comp.date);
        return compDate >= new Date(today.getFullYear(), today.getMonth(), today.getDate());
      });
      if (openComps.length > 0) {
        openComps.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        scorecardComp = openComps[0];
      } else {
        compsWithUser.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        scorecardComp = compsWithUser[0];
      }
    } else {
      scorecardComp = comps.find(comp => comp.users && comp.users.some(u => nameMatch(u.name, user.name)));
    }
    setUserComp(scorecardComp || null);
  }, [user, comps]);

  return (
    <PageBackground>
      {/* Top nav menu */}
      <TopMenu user={user} userComp={userComp} onSignOut={onSignOut} competitionList={comps} />
      <div className="relative z-10 flex flex-col items-center px-4 mt-12">
        <img
          src={westlakeLogo}
          alt="Westlake Golf Club Badge"
          className="mb-8 max-h-48 w-auto"
          style={{ objectFit: 'contain' }}
        />
  <h1 className="text-5xl font-extrabold drop-shadow-lg text-center mb-1 leading-tight flex items-end justify-center gap-2" style={{ color: 'white', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>
    Welcome
  </h1>
  <h2 className="text-3xl font-extrabold drop-shadow-lg text-center mb-1" style={{ color: 'white', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>
    {user?.name || ''}!
  </h2>
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
          {/* Only show button if admin and there are no open competitions */}
          {user?.isadmin && comps.filter(comp => comp.status === 'Open').length === 0 && (
            <button
              className="w-full py-3 px-4 border border-white text-white font-extrabold rounded-2xl transition text-lg flex items-center justify-center gap-2"
              style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)', fontFamily: 'Merriweather, Georgia, serif' }}
              onClick={() => navigate('/create')}
              onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
            >
              <PlusIcon className="h-6 w-6 text-white" aria-hidden="true" />
              Create New Competition
            </button>
          )}
                            <button
                              className="w-full py-3 px-4 border border-white text-white font-extrabold rounded-2xl transition text-lg flex items-center justify-center gap-2"
                              style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)', fontFamily: 'Merriweather, Georgia, serif' }}
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