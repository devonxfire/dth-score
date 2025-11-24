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
      // Prefer open comps (status === 'Open' OR date >= today), then most recent
      const openComps = compsWithUser.filter(comp => {
        if (!comp.date) return false;
        const compDate = new Date(comp.date);
        const isFutureOrToday = compDate >= new Date(today.getFullYear(), today.getMonth(), today.getDate());
        // Check both status field AND date to determine if comp is truly open
        return comp.status === 'Open' || (comp.status !== 'Closed' && isFutureOrToday);
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
          {userComp && userComp.status === 'Open' && (
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

          {/* Share App Button - Admin Only - Subtle WhatsApp style, bottom center */}
          {user?.isadmin && (
            <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50">
              <button
                className="py-2 px-3 rounded-full transition text-sm flex items-center justify-center gap-2 shadow-lg"
                style={{ 
                  backgroundColor: '#25D366', 
                  color: 'white',
                  fontFamily: 'Lato, Arial, sans-serif', 
                  border: 'none',
                  fontSize: '13px',
                  width: 'auto',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
                }}
                onClick={() => {
                  const appUrl = window.location.origin;
                  const whatsappMessage = `Hey! Check out DTH Score - our golf scoring app: ${appUrl}`;
                  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;
                  window.open(whatsappUrl, '_blank');
                }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#1FAF56'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = '#25D366'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <span className="ml-2">Share via WhatsApp</span>
              </button>
            </div>
          )}
                          </div>
                        </div>
    </PageBackground>
  );
}