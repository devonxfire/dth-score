


import PageBackground from './PageBackground';
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

export default function Dashboard({ user, onSignOut }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [comps, setComps] = useState([]);
  const [userComp, setUserComp] = useState(null);

  useEffect(() => {
    fetch('/api/competitions')
      .then(res => res.json())
      .then(data => setComps(Array.isArray(data) ? data : []))
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
      const assigned = comp.groups.some(g => Array.isArray(g.players) && g.players.includes(user.name));
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
      <div className="flex flex-wrap justify-around gap-6 mt-8 mb-4 w-full max-w-2xl mx-auto px-8">
        <button
          className={`text-sm text-white font-semibold opacity-80 hover:opacity-100 hover:underline focus:underline bg-transparent border-none outline-none px-2 py-1 cursor-pointer ${location.pathname === '/dashboard' ? 'border-b-4' : ''}`}
          style={location.pathname === '/dashboard' ? { borderColor: '#1B3A6B', borderBottomWidth: 2, background: 'none', borderStyle: 'solid', boxShadow: 'none' } : { background: 'none', border: 'none', boxShadow: 'none' }}
          onClick={() => navigate('/dashboard')}
        >
          Dashboard
        </button>
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
          onClick={onSignOut}
        >
          Sign Out
        </button>
      </div>
      <div className="relative z-10 flex flex-col items-center px-4 mt-12">
        <img
          src={westlakeLogo}
          alt="Westlake Golf Club Badge"
          className="mb-8 max-h-48 w-auto"
          style={{ objectFit: 'contain' }}
        />
  <h1 className="text-5xl font-bold text-white mb-1 drop-shadow-lg text-center">Welcome, {user?.name || ''}!</h1>
        <p className="text-xl text-white mb-6 drop-shadow text-center">What would you like to do today?</p>
      </div>
      <div className="relative z-10 flex flex-col items-center px-4 mt-2">
  <div className="w-full max-w-md rounded-2xl shadow-lg p-8 flex flex-col gap-6" style={{ background: 'none' }}>
          {userComp && (
            <button
              className="w-full py-3 px-4 border border-red-400 text-white font-semibold rounded-2xl text-lg flex items-center justify-center gap-2 scorecard-pulse"
              style={{ boxShadow: '0 2px 8px 0 rgba(255,0,0,0.10)' }}
              onClick={() => {
                // Find the group/team the user is assigned to
                const group = userComp.groups.find(g => Array.isArray(g.players) && g.players.includes(user.name));
                // Find the player object in the group (if available)
                let playerObj = null;
                if (group && Array.isArray(group.members)) {
                  playerObj = group.members.find(m => m.name === user.name) || null;
                }
                // Fallback: build player object from user and group
                if (!playerObj) {
                  playerObj = {
                    name: user.name,
                    id: user.id,
                    user_id: user.id,
                    team_id: group?.id || group?.team_id || group?.group_id,
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