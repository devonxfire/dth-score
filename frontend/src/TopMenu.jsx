import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiUrl } from './api';

// Note: TopMenu may be rendered on pages that only pass a single `comp` via
// `competitionList` (e.g. CompetitionInfo). To reliably find the currently OPEN
// competition we fetch the full competitions list when a full list isn't provided
// via props. This prevents the menu from thinking a single (possibly closed)
// comp is the open comp.

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
  const isLeaderboardPath = location.pathname.startsWith('/leaderboard');
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
  // Local copy of competitions: prefer the prop `competitionList` when a full list
  // is provided. If the prop is absent or only contains a single comp (common when
  // pages pass `[comp]`), fetch the full list so we can correctly determine the
  // currently OPEN competition across all comps.
  const [localCompetitionList, setLocalCompetitionList] = useState(Array.isArray(competitionList) && competitionList.length > 1 ? competitionList : []);

  useEffect(() => {
    // keep local list in sync when a full list is supplied by the caller
    if (Array.isArray(competitionList) && competitionList.length > 1) {
      setLocalCompetitionList(competitionList);
    }
  }, [competitionList]);

  useEffect(() => {
  // If caller didn't provide a full competition list (or only passed a single
  // comp), fetch the full list so we can find the true open competition.
  if (!Array.isArray(competitionList) || competitionList.length <= 1) {
      let cancelled = false;
      (async () => {
        try {
          const res = await fetch(apiUrl('/api/competitions'));
          if (!res.ok) return;
          const data = await res.json();
          if (!cancelled) setLocalCompetitionList(Array.isArray(data) ? data : []);
        } catch (e) {
          // ignore fetch errors
        }
      })();
      return () => { cancelled = true; };
    }
    return undefined;
  }, [competitionList]);

  // Listen for explicit competitions updates from other pages (e.g. RecentCompetitions)
  useEffect(() => {
    let mounted = true;
    async function onUpdated(e) {
      // Try to re-fetch authoritative competitions list; fallback to event.detail
      try {
        const res = await fetch(apiUrl('/api/competitions'));
        if (res.ok) {
          const data = await res.json();
          if (mounted) setLocalCompetitionList(Array.isArray(data) ? data : []);
          return;
        }
      } catch (err) {
        // ignore and fallback
      }
      try {
        const data = e?.detail;
        if (mounted && Array.isArray(data)) setLocalCompetitionList(data);
      } catch (err) {}
    }
    window.addEventListener('competitionsUpdated', onUpdated);
    return () => { mounted = false; window.removeEventListener('competitionsUpdated', onUpdated); };
  }, []);

  if (!scorecardComp && (localCompetitionList || []).length > 0 && resolvedName) {
    // Prefer open competitions where user is assigned to a group
    const today = new Date();
    // Find open comps with user assigned to a group
    const openComps = localCompetitionList.filter(comp => {
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
      scorecardComp = (localCompetitionList || []).find(comp => comp.users && comp.users.some(u => (u.name || u.displayName) === resolvedName));
    }
  }


  // Determine the currently OPEN competition (most recent). Links to Scorecard/Leaderboard
  // should only point to the open competition. If no open competition exists, those links
  // will be disabled and greyed out.
  let openComp = null;
  let openCompId = null;
  if (Array.isArray(localCompetitionList) && localCompetitionList.length > 0) {
    const today = new Date();
    const openCompsAll = localCompetitionList.filter(c => c && (c.status === 'Open' || (c.date && new Date(c.date) >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))));
    if (openCompsAll.length > 0) {
      openCompsAll.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      openComp = openCompsAll[0];
      openCompId = openComp.id || openComp._id || openComp.joinCode || openComp.joincode || null;
    }
  }

  // Use the open competition id/object for leaderboard/scorecard navigation. If no open
  // competition is present, compId will be null and buttons will be disabled.
  const compId = openCompId;
  const leaderboardComp = openComp;

  // Only allow navigation to Scorecard/Leaderboard when there is an OPEN competition
  // available. Relying on `userComp` here can cause stale props to keep links active
  // after an admin toggles status; use the locally-resolved `openComp` instead so
  // TopMenu updates immediately when the competition list changes.
  const allowCompLinks = Boolean(openComp);

  // Determine competition type to decide which leaderboard route to use.
  // Use the open competition type when available.
  let compType = (openComp && openComp.type) || (scorecardComp && scorecardComp.type) || '';
  if (!compType && Array.isArray(competitionList) && compId) {
    const found = competitionList.find(c => (c.joinCode || c.joincode || c.id || c._id || c.competitionType) == compId || (c.id || c._id) == compId);
    compType = found?.type || '';
  }
  compType = (compType || '').toString().toLowerCase();

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
                  style={{ color: (location.pathname.startsWith('/scorecard') || (location.pathname.startsWith('/scorecard') && compId)) ? '#FFD700' : (allowCompLinks ? 'white' : '#888'), background: 'none', border: 'none', fontFamily: 'Lato, Arial, sans-serif', opacity: allowCompLinks ? 1 : 0.5, pointerEvents: allowCompLinks ? 'auto' : 'none' }}
                  disabled={!allowCompLinks}
                onClick={() => {
                  if (openComp && compId && resolvedName) {
                      let group = null;
                      let playerObj = null;
                      if (openComp.groups) {
                        group = openComp.groups.find(g => Array.isArray(g.players) && g.players.includes(resolvedName));
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
                      navigate(`/scorecard/${compId}`, { state: { player: playerObj, competition: openComp } });
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
                style={isLeaderboardPath ? { color: '#FFD700', background: 'none', border: 'none', fontFamily: 'Merriweather, Georgia, serif', opacity: allowCompLinks ? 1 : 0.5, pointerEvents: allowCompLinks ? 'auto' : 'none' } : { color: allowCompLinks ? 'white' : '#888', background: 'none', border: 'none', fontFamily: 'Lato, Arial, sans-serif', opacity: allowCompLinks ? 1 : 0.5, pointerEvents: allowCompLinks ? 'auto' : 'none' }}
              disabled={!allowCompLinks}
              onClick={async () => {
                    // Always fetch the authoritative competitions list and navigate
                    // only when a current OPEN competition is found.
                    try {
                      const listRes = await fetch(apiUrl('/api/competitions'));
                      if (!listRes.ok) return;
                      const all = await listRes.json();
                      const today = new Date();
                      const open = (all || []).filter(c => c && (c.status === 'Open' || (c.date && new Date(c.date) >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))));
                      if (!open || open.length === 0) return;
                      open.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                      const pick = open[0];
                      const pickId = pick.id || pick._id || pick.joinCode || pick.joincode;
                      if (!pickId) return;
                      try {
                        const compRes = await fetch(apiUrl(`/api/competitions/${pickId}`));
                        if (compRes.ok) {
                          const compData = await compRes.json();
                          try { console.debug('TopMenu: navigating to leaderboard (desktop) pickId:', pickId, 'compData:', compData); } catch (e) {}
                          navigate(`/leaderboard/${pickId}`, { state: { competition: compData } });
                          return;
                        }
                      } catch (e) {
                        try { console.debug('TopMenu: navigating to leaderboard (desktop) fallback pickId:', pickId, 'pick:', pick); } catch (e) {}
                        navigate(`/leaderboard/${pickId}`, { state: { competition: pick } });
                        return;
                      }
                    } catch (e) {
                      // ignore
                    }
              }}
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
                if (!allowCompLinks) return; // disabled
                if (openComp && compId && resolvedName) {
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
                    navigate(`/scorecard/${compId}`, { state: { player: playerObj, competition: openComp } });
                } else if (compId) {
                  // Admins/fallback: allow opening scorecard without a player state
                  navigate(`/scorecard/${compId}`);
                } else {
                  navigate('/dashboard');
                }
              }}
                className="text-left py-3 text-lg font-semibold"
                style={{ color: isScorecardPath ? '#FFD700' : (allowCompLinks ? 'white' : '#888'), opacity: allowCompLinks ? 1 : 0.5 }}
                aria-current={isScorecardPath ? 'page' : undefined}
              >
                My Scorecard
              </button>
              <button
                onClick={async () => { setMenuOpen(false);
                  if (!allowCompLinks) return; // disabled
                    try {
                      const listRes = await fetch(apiUrl('/api/competitions'));
                      if (listRes.ok) {
                        const all = await listRes.json();
                        const today = new Date();
                        const open = (all || []).filter(c => c && (c.status === 'Open' || (c.date && new Date(c.date) >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))));
                        if (open.length > 0) {
                          open.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                          const pick = open[0];
                          const pickId = pick.id || pick._id || pick.joinCode || pick.joincode;
                          try {
                            const compRes = await fetch(apiUrl(`/api/competitions/${pickId}`));
                            if (compRes.ok) {
                              const compData = await compRes.json();
                                  try { console.debug('TopMenu: navigating to leaderboard (mobile) pickId:', pickId, 'compData:', compData); } catch (e) {}
                                  navigate(`/leaderboard/${pickId}`, { state: { competition: compData } });
                                  return;
                                }
                              } catch (e) {
                                try { console.debug('TopMenu: navigating to leaderboard (mobile) fallback pickId:', pickId, 'pick:', pick); } catch (e) {}
                                navigate(`/leaderboard/${pickId}`, { state: { competition: pick } });
                                return;
                              }
                        }
                      }
                    } catch (e) {}
          if (!compId) return; try { const res = await fetch(apiUrl(`/api/competitions/${compId}`)); if (res.ok) { const data = await res.json(); try { console.debug('TopMenu: navigating to leaderboard (mobile) fallback compId:', compId, 'data:', data); } catch (e) {} navigate(`/leaderboard/${compId}`, { state: { competition: data } }); return; } } catch (e) {}
          try { console.debug('TopMenu: navigating to leaderboard (mobile) final fallback compId:', compId, 'leaderboardComp:', leaderboardComp); } catch (e) {}
          navigate(`/leaderboard/${compId}`, { state: { competition: leaderboardComp } });
                }}
                className="text-left py-3 text-lg font-semibold"
                style={{ color: isLeaderboardPath ? '#FFD700' : (allowCompLinks ? 'white' : '#888'), opacity: allowCompLinks ? 1 : 0.5 }}
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
