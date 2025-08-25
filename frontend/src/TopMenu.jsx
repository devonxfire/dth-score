import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function TopMenu({ user, userComp, isPlayerInComp, onSignOut, competitionList }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Robustly find the comp the user is a player in (for "My Scorecard" button)
  let scorecardComp = userComp;
  if (!scorecardComp && competitionList && user && user.name) {
    // Prefer open competitions where user is assigned to a group
    const today = new Date();
    // Find open comps with user assigned to a group
    const openComps = competitionList.filter(comp => {
      if (!comp.date || !Array.isArray(comp.groups)) return false;
      const compDate = new Date(comp.date);
      const isOpen = compDate >= new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const assigned = comp.groups.some(g => Array.isArray(g.players) && g.players.includes(user.name));
      return isOpen && assigned;
    });
    if (openComps.length > 0) {
      // Pick most recent open comp
      openComps.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      scorecardComp = openComps[0];
    } else {
      // Fallback: any comp where user is a player (old logic)
      scorecardComp = competitionList.find(comp => comp.users && comp.users.some(u => u.name === user.name));
    }
  }
  const compId = scorecardComp && (scorecardComp.joinCode || scorecardComp.joincode || scorecardComp.id || scorecardComp._id || scorecardComp.competitionType);

  return (
    <div className="flex flex-wrap justify-between gap-6 mt-8 mb-4 w-full max-w-2xl mx-auto px-8">
      <button
        className={`text-sm text-white font-semibold opacity-80 hover:opacity-100 hover:underline focus:underline bg-transparent border-none outline-none px-2 py-1 cursor-pointer ${location.pathname === '/dashboard' ? 'border-b-4' : ''}`}
        style={location.pathname === '/dashboard' ? { borderColor: '#1B3A6B', borderBottomWidth: 2, background: 'none', borderStyle: 'solid', boxShadow: 'none' } : { background: 'none', border: 'none', boxShadow: 'none' }}
        onClick={() => navigate('/dashboard')}
      >
        Dashboard
      </button>
      {scorecardComp && (
        <button
          className={`text-sm font-extrabold opacity-90 px-2 py-1 rounded text-green-600 hover:text-green-700 focus:text-green-700 transition-colors duration-150 cursor-pointer ${location.pathname.startsWith('/scorecard') ? 'border-b-4' : ''}`}
          style={location.pathname.startsWith('/scorecard') ? { borderColor: '#1B3A6B', borderBottomWidth: 2, background: 'none', borderStyle: 'solid', boxShadow: 'none' } : { background: 'none', border: 'none', boxShadow: 'none' }}
          onClick={() => navigate(`/scorecard/${compId}`, { state: { competition: scorecardComp } })}
        >
          My Scorecard
        </button>
      )}
      <button
        className={`text-sm text-white font-semibold opacity-80 hover:opacity-100 hover:underline focus:underline bg-transparent border-none outline-none px-2 py-1 cursor-pointer ${location.pathname === '/recent' ? 'border-b-4' : ''}`}
        style={location.pathname === '/recent' ? { borderColor: '#1B3A6B', borderBottomWidth: 2, background: 'none', borderStyle: 'solid', boxShadow: 'none' } : { background: 'none', border: 'none', boxShadow: 'none' }}
        onClick={() => navigate('/recent')}
      >
        Competitions
      </button>
      <span
        className="text-sm text-white font-semibold opacity-80 bg-transparent border-none outline-none px-2 py-1 cursor-default select-none"
        style={{ background: 'none', border: 'none', boxShadow: 'none', lineHeight: '2.25rem' }}
      >
        Welcome, {(user?.name?.split(' ')[0]) || 'Player'}!
      </span>
      <button
        className="text-sm text-white font-semibold opacity-80 hover:opacity-100 hover:underline focus:underline bg-transparent border-none outline-none px-2 py-1 cursor-pointer"
        style={{ background: 'none', border: 'none', boxShadow: 'none' }}
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
