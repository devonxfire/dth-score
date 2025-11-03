import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function TopMenu({ user, userComp, isPlayerInComp, onSignOut, competitionList }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // close when clicked outside
  useEffect(() => {
    function onClick(e) {
      if (!menuOpen) return;
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  // Prevent body scroll while mobile menu is open
  useEffect(() => {
    if (menuOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
    return undefined;
  }, [menuOpen]);
  const navigate = useNavigate();
  const location = useLocation();

  // Active-path helpers for mobile menu highlighting
  const isDashboardPath = location.pathname === '/dashboard';
  const isLeaderboardPath = location.pathname.startsWith('/medal-leaderboard');
  const isRecentPath = location.pathname === '/recent';
  const isScorecardPath = location.pathname.startsWith('/scorecard');

  // If `user` prop isn't provided (some pages don't pass it), try to recover from localStorage
  let resolvedUser = user;
  if (!resolvedUser) {
    try {
      const raw = localStorage.getItem('user');
      if (raw) resolvedUser = JSON.parse(raw);
    } catch (e) {
      // ignore parse errors
      resolvedUser = null;
    }
  }

  // Compute a friendly first name to display
  const firstName = (resolvedUser && (resolvedUser.firstName || resolvedUser.givenName || (resolvedUser.name && resolvedUser.name.split(' ')[0]))) || 'Player';

  // Robustly find the comp the user is a player in (for "My Scorecard" button)
  let scorecardComp = userComp;
  // resolvedName: canonical name string to match against group.player entries
  const resolvedName = (resolvedUser && (resolvedUser.name || resolvedUser.displayName || (resolvedUser.firstName ? `${resolvedUser.firstName} ${resolvedUser.lastName || ''}` : null))) || null;

  // Determine if current user is admin (several possible flags present across the app)
  const isAdmin = !!(resolvedUser && (resolvedUser.role === 'admin' || resolvedUser.isAdmin || resolvedUser.isadmin));

  if (!scorecardComp && competitionList && resolvedName) {
    // Prefer open competitions where user is assigned to a group
    const today = new Date();
    // Find open comps with user assigned to a group
    const openComps = competitionList.filter(comp => {
      if (!comp.date || !Array.isArray(comp.groups)) return false;
      const compDate = new Date(comp.date);
      const isOpen = compDate >= new Date(today.getFullYear(), today.getMonth(), today.getDate());
      function nameMatch(a, b) {
        if (!a || !b) return false;
        const normA = a.trim().toLowerCase();
        const normB = b.trim().toLowerCase();
        return normA && normB && (normA === normB || normA.length > 1 && normB.includes(normA) || normB.length > 1 && normA.includes(normB));
      }
      const assigned = comp.groups.some(g => Array.isArray(g.players) && g.players.some(p => nameMatch(p, resolvedName)));
      return isOpen && assigned;
    });
    if (openComps.length > 0) {
      // Pick most recent open comp
      openComps.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      scorecardComp = openComps[0];
    } else {
      // Fallback: any comp where user is a player (old logic)
      scorecardComp = competitionList.find(comp => comp.users && comp.users.some(u => (u.name || u.displayName) === resolvedName));
    }
  }
  // Decide which competition id to use for top-menu navigation. Prefer the user's scorecardComp
  // but allow admins to target the current/latest open competition when not assigned to a group.
  let compId = scorecardComp && (scorecardComp.joinCode || scorecardComp.joincode || scorecardComp.id || scorecardComp._id || scorecardComp.competitionType);
  if (!compId && isAdmin && Array.isArray(competitionList) && competitionList.length > 0) {
    // Prefer an open competition (status === 'Open') and the most recent one
    const today = new Date();
    const openComps = competitionList.filter(comp => comp && (comp.status === 'Open' || (comp.date && new Date(comp.date) >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))));
    const pick = (openComps.length > 0 ? openComps.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0] : competitionList.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]);
    if (pick) compId = (pick.joinCode || pick.joincode || pick.id || pick._id || pick.competitionType);
  }

  return (
    <div
      className="flex flex-wrap justify-between gap-6 mt-0 sm:mt-8 mb-4 w-full px-4 sm:px-8 sm:max-w-4xl sm:mx-auto rounded-none sm:rounded-2xl"
      style={{ background: '#002F5F', fontFamily: 'Lato, Arial, sans-serif', boxShadow: '0 2px 8px 0 rgba(0,47,95,0.10)' }}
    >
      {/* Mobile header: hamburger + title + sign out */}
      <div className="w-full flex items-center justify-between sm:hidden">
        <button
          aria-label="Open menu"
          aria-expanded={menuOpen}
          className="p-2"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-sm font-semibold px-2 py-1 cursor-default select-none" style={{ color: 'white', fontFamily: 'Merriweather, Georgia, serif' }}>
          Welcome, {firstName}!
        </span>
        <button
          className="p-2"
          style={{ color: 'white', background: 'none', border: 'none' }}
          onClick={onSignOut || (() => {
            if (typeof window.onSignOut === 'function') window.onSignOut();
            else if (typeof window.signOut === 'function') window.signOut();
            else {
              localStorage.removeItem('user');
              window.location.href = '/';
            }
          })}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 17l5-5-5-5M21 12H9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13 19H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Desktop menu (hidden on small screens) - render each item as an equal-width cell */}
      <div className="hidden sm:flex items-center w-full">
        <div className="flex items-center w-full">
          <div className="flex-1 min-w-0 text-center">
            <button
              className={`w-full text-sm font-semibold py-1 cursor-pointer transition-colors duration-150`}
                style={location.pathname === '/dashboard' ? { color: '#FFD700', background: 'none', border: 'none', fontFamily: 'Merriweather, Georgia, serif' } : { color: 'white', background: 'none', border: 'none', fontFamily: 'Lato, Arial, sans-serif' }}
              onClick={() => navigate('/dashboard')}
            >
              Dashboard
            </button>
          </div>
          <div className="flex-1 min-w-0 text-center">
            <button
              className="w-full text-sm font-semibold py-1 cursor-pointer transition-colors duration-150"
                  style={{ color: (location.pathname.startsWith('/scorecard') || (location.pathname.startsWith('/scorecard') && compId)) ? '#FFD700' : (compId ? 'white' : '#888'), background: 'none', border: 'none', fontFamily: 'Lato, Arial, sans-serif', opacity: compId ? 1 : 0.5, pointerEvents: compId ? 'auto' : 'none' }}
                disabled={!compId}
                onClick={() => {
                  if (scorecardComp && compId && resolvedName) {
                    let group = null;
                    let playerObj = null;
                    if (scorecardComp.groups) {
                      group = scorecardComp.groups.find(g => Array.isArray(g.players) && g.players.includes(resolvedName));
                      if (group && Array.isArray(group.members)) {
                        playerObj = group.members.find(m => (m.name === resolvedName || m.displayName === resolvedName)) || null;
                      }
                      if (!playerObj) {
                        const teamId = group?.teamId || group?.id || group?.team_id || group?.group_id;
                        playerObj = {
                          name: resolvedName,
                          id: resolvedUser?.id,
                          user_id: resolvedUser?.id,
                          team_id: teamId,
                          teebox: group?.teeboxes?.[resolvedName] || '',
                          course_handicap: group?.handicaps?.[resolvedName] || '',
                        };
                      }
                    }
                    navigate(`/scorecard/${compId}`, { state: { player: playerObj, competition: scorecardComp } });
                  } else if (compId) {
                    // For admins (or fallback), allow navigating to the scorecard route without player state.
                    navigate(`/scorecard/${compId}`);
                  } else {
                    navigate('/dashboard');
                  }
                }}
            >
              My Scorecard
            </button>
          </div>
          <div className="flex-1 min-w-0 text-center">
            <button
              className={`w-full text-sm font-semibold py-1 cursor-pointer transition-colors duration-150`}
                style={location.pathname.startsWith('/medal-leaderboard') ? { color: '#FFD700', background: 'none', border: 'none', fontFamily: 'Merriweather, Georgia, serif', opacity: compId ? 1 : 0.5, pointerEvents: compId ? 'auto' : 'none' } : { color: compId ? 'white' : '#888', background: 'none', border: 'none', fontFamily: 'Lato, Arial, sans-serif', opacity: compId ? 1 : 0.5, pointerEvents: compId ? 'auto' : 'none' }}
              disabled={!compId}
              onClick={() => compId ? navigate(`/medal-leaderboard/${compId}`) : null}
            >
              Leaderboard
            </button>
          </div>
          <div className="flex-1 min-w-0 text-center">
            <button
              className={`w-full text-sm font-semibold py-1 cursor-pointer transition-colors duration-150`}
                style={location.pathname === '/recent' ? { color: '#FFD700', background: 'none', border: 'none', fontFamily: 'Merriweather, Georgia, serif' } : { color: 'white', background: 'none', border: 'none', fontFamily: 'Lato, Arial, sans-serif' }}
              onClick={() => navigate('/recent')}
            >
              Competitions
            </button>
          </div>
          <div className="flex-1 min-w-0 text-center">
            <span
              className="text-sm font-semibold cursor-default select-none block py-1"
              style={{ color: 'white', background: 'none', border: 'none', fontFamily: 'Merriweather, Georgia, serif', lineHeight: '2.25rem' }}
            >
              Welcome, {firstName}!
            </span>
          </div>
          <div className="flex-1 min-w-0 text-center">
            <button
              className="w-full text-sm font-semibold py-1 cursor-pointer transition-colors duration-150"
              style={{ color: 'white', background: 'none', border: 'none', fontFamily: 'Lato, Arial, sans-serif' }}
              onClick={onSignOut || (() => {
                if (typeof window.onSignOut === 'function') window.onSignOut();
                else if (typeof window.signOut === 'function') window.signOut();
                else {
                  localStorage.removeItem('user');
                  window.location.href = '/';
                }
              })}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/40" />
          <div ref={menuRef} className="absolute top-0 left-0 right-0 bottom-0 bg-[#002F5F] p-4 overflow-auto">
              <div className="flex flex-col">
                <button
                  onClick={() => { setMenuOpen(false); navigate('/dashboard'); }}
                  className="text-left py-3 text-lg font-semibold"
                  style={{ color: isDashboardPath ? '#FFD700' : 'white' }}
                  aria-current={isDashboardPath ? 'page' : undefined}
                >
                  Dashboard
                </button>
                <button onClick={() => {
                setMenuOpen(false);
                if (scorecardComp && compId && resolvedName) {
                  let group = null;
                  let playerObj = null;
                  if (scorecardComp.groups) {
                    group = scorecardComp.groups.find(g => Array.isArray(g.players) && g.players.includes(resolvedName));
                    if (group && Array.isArray(group.members)) {
                      playerObj = group.members.find(m => (m.name === resolvedName || m.displayName === resolvedName)) || null;
                    }
                    if (!playerObj) {
                      const teamId = group?.teamId || group?.id || group?.team_id || group?.group_id;
                      playerObj = {
                        name: resolvedName,
                        id: resolvedUser?.id,
                        user_id: resolvedUser?.id,
                        team_id: teamId,
                        teebox: group?.teeboxes?.[resolvedName] || '',
                        course_handicap: group?.handicaps?.[resolvedName] || '',
                      };
                    }
                  }
                  navigate(`/scorecard/${compId}`, { state: { player: playerObj, competition: scorecardComp } });
                } else if (compId) {
                  // Admins/fallback: allow opening scorecard without a player state
                  navigate(`/scorecard/${compId}`);
                } else {
                  navigate('/dashboard');
                }
              }}
                className="text-left py-3 text-lg font-semibold"
                style={{ color: isScorecardPath ? '#FFD700' : 'white' }}
                aria-current={isScorecardPath ? 'page' : undefined}
              >
                My Scorecard
              </button>
              <button
                onClick={() => { setMenuOpen(false); compId ? navigate(`/medal-leaderboard/${compId}`) : null; }}
                className="text-left py-3 text-lg font-semibold"
                style={{ color: isLeaderboardPath ? '#FFD700' : 'white' }}
                aria-current={isLeaderboardPath ? 'page' : undefined}
              >
                Leaderboard
              </button>
              <button
                onClick={() => { setMenuOpen(false); navigate('/recent'); }}
                className="text-left py-3 text-lg font-semibold"
                style={{ color: isRecentPath ? '#FFD700' : 'white' }}
                aria-current={isRecentPath ? 'page' : undefined}
              >
                Competitions
              </button>
              <button
                onClick={() => { setMenuOpen(false); (onSignOut || (() => { localStorage.removeItem('user'); window.location.href = '/'; }))(); }}
                className="text-left py-3 text-lg font-semibold"
                style={{ color: 'white' }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
