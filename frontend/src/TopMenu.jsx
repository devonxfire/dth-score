import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function TopMenu({ user, userComp, isPlayerInComp, onSignOut, competitionList }) {
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
  );
}
