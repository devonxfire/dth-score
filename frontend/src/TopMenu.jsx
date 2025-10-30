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
  const navigate = useNavigate();
  const location = useLocation();

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
  const compId = scorecardComp && (scorecardComp.joinCode || scorecardComp.joincode || scorecardComp.id || scorecardComp._id || scorecardComp.competitionType);

  return (
    <div
      className="flex flex-wrap justify-between gap-6 mt-8 mb-4 w-full max-w-4xl mx-auto px-8 rounded-2xl"
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

      {/* Desktop menu (hidden on small screens) */}
      <div className="hidden sm:flex items-center justify-between gap-6 w-full">
        <div className="flex items-center gap-4">
          <button
            className={`text-sm font-semibold px-2 py-1 cursor-pointer transition-colors duration-150 ${location.pathname === '/dashboard' ? 'border-b-4' : ''}`}
            style={location.pathname === '/dashboard' ? { color: '#FFD700', borderColor: '#FFD700', borderBottomWidth: 3, background: 'none', borderStyle: 'solid', fontFamily: 'Merriweather, Georgia, serif' } : { color: 'white', background: 'none', border: 'none', fontFamily: 'Lato, Arial, sans-serif' }}
            onClick={() => navigate('/dashboard')}
          >
            Dashboard
          </button>
          <button
            className="text-sm font-semibold px-2 py-1 cursor-pointer transition-colors duration-150 "
            style={{ color: compId ? 'white' : '#888', background: 'none', border: 'none', fontFamily: 'Lato, Arial, sans-serif', opacity: compId ? 1 : 0.5, pointerEvents: compId ? 'auto' : 'none' }}
            disabled={!compId}
            onClick={() => {
              if (scorecardComp && compId && resolvedName) {
                // ...existing code...
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
              } else {
                navigate('/dashboard');
              }
            }}
          >
            My Scorecard
          </button>
          <button
            className={`text-sm font-semibold px-2 py-1 cursor-pointer transition-colors duration-150 ${location.pathname.startsWith('/medal-leaderboard') ? 'border-b-4' : ''}`}
            style={location.pathname.startsWith('/medal-leaderboard') ? { color: '#FFD700', borderColor: '#FFD700', borderBottomWidth: 3, background: 'none', borderStyle: 'solid', fontFamily: 'Merriweather, Georgia, serif', opacity: compId ? 1 : 0.5, pointerEvents: compId ? 'auto' : 'none' } : { color: compId ? 'white' : '#888', background: 'none', border: 'none', fontFamily: 'Lato, Arial, sans-serif', opacity: compId ? 1 : 0.5, pointerEvents: compId ? 'auto' : 'none' }}
            disabled={!compId}
            onClick={() => compId ? navigate(`/medal-leaderboard/${compId}`) : null}
          >
            Leaderboard
          </button>
          <button
            className={`text-sm font-semibold px-2 py-1 cursor-pointer transition-colors duration-150 ${location.pathname === '/recent' ? 'border-b-4' : ''}`}
            style={location.pathname === '/recent' ? { color: '#FFD700', borderColor: '#FFD700', borderBottomWidth: 3, background: 'none', borderStyle: 'solid', fontFamily: 'Merriweather, Georgia, serif' } : { color: 'white', background: 'none', border: 'none', fontFamily: 'Lato, Arial, sans-serif' }}
            onClick={() => navigate('/recent')}
          >
            Competitions
          </button>
        </div>

        <div className="flex items-center gap-4">
          <span
            className="text-sm font-semibold px-2 py-1 cursor-default select-none"
            style={{ color: 'white', background: 'none', border: 'none', fontFamily: 'Merriweather, Georgia, serif', lineHeight: '2.25rem' }}
          >
            Welcome, {firstName}!
          </span>
          <button
            className="text-sm font-semibold px-2 py-1 cursor-pointer transition-colors duration-150"
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

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" />
          <div ref={menuRef} className="absolute top-0 left-0 right-0 bg-[#002F5F] p-4">
            <div className="flex flex-col">
              <button onClick={() => { setMenuOpen(false); navigate('/dashboard'); }} className="text-left text-white py-3 text-lg font-semibold">Dashboard</button>
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
                } else {
                  navigate('/dashboard');
                }
              }} className="text-left text-white py-3 text-lg font-semibold">My Scorecard</button>
              <button onClick={() => { setMenuOpen(false); compId ? navigate(`/medal-leaderboard/${compId}`) : null; }} className="text-left text-white py-3 text-lg font-semibold">Leaderboard</button>
              <button onClick={() => { setMenuOpen(false); navigate('/recent'); }} className="text-left text-white py-3 text-lg font-semibold">Competitions</button>
              <button onClick={() => { setMenuOpen(false); (onSignOut || (() => { localStorage.removeItem('user'); window.location.href = '/'; }))(); }} className="text-left text-white py-3 text-lg font-semibold">Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
