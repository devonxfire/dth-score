


import PageBackground from './PageBackground';
import { useNavigate, useLocation } from 'react-router-dom';
import westlakeLogo from './assets/westlake-logo2.png';

// Helper to find the most recent open comp the user has joined
function getUserOpenComp(user) {
  const joinedScores = JSON.parse(localStorage.getItem('scores') || '[]').filter(e => e.player?.name === user);
  if (!joinedScores.length) return null;
  // Find the most recent open comp (by date)
  const today = new Date();
  const openComps = joinedScores.filter(e => {
    const compDate = new Date(e.date);
    return compDate >= new Date(today.getFullYear(), today.getMonth(), today.getDate());
  });
  if (!openComps.length) return null;
  // Sort by date descending
  openComps.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return openComps[0];
}

export default function Dashboard({ user, onSignOut }) {
  const navigate = useNavigate();
  const location = useLocation();
  const userComp = typeof window !== 'undefined' ? getUserOpenComp(user) : null;
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
          className={`text-sm text-white font-semibold opacity-80 hover:opacity-100 hover:underline focus:underline bg-transparent border-none outline-none px-2 py-1 cursor-pointer ${location.pathname === '/profile' ? 'border-b-4' : ''}`}
          style={location.pathname === '/profile' ? { borderColor: '#1B3A6B', borderBottomWidth: 2, background: 'none', borderStyle: 'solid', boxShadow: 'none' } : { background: 'none', border: 'none', boxShadow: 'none' }}
          onClick={() => navigate('/profile')}
          disabled
        >
          My Profile
        </button>
        <button
          className={`text-sm text-white font-semibold opacity-80 hover:opacity-100 hover:underline focus:underline bg-transparent border-none outline-none px-2 py-1 cursor-pointer ${location.pathname === '/recent' ? 'border-b-4' : ''}`}
          style={location.pathname === '/recent' ? { borderColor: '#1B3A6B', borderBottomWidth: 2, background: 'none', borderStyle: 'solid', boxShadow: 'none' } : { background: 'none', border: 'none', boxShadow: 'none' }}
          onClick={() => navigate('/recent')}
        >
          Competitions
        </button>
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
          <button
            className="w-full py-3 px-4 border border-white text-white font-semibold rounded-2xl transition text-lg"
            style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
            onClick={() => navigate('/profile')}
            onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
            disabled
          >
            My Profile (coming soon)
          </button>
          {userComp && (
            <button
              className="w-full py-3 px-4 border border-green-400 text-green-200 font-semibold rounded-2xl transition text-lg"
              style={{ backgroundColor: '#22457F', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
              onClick={() => navigate(`/scorecard/${userComp.competitionType}`, { state: { player: userComp.player, competition: userComp } })}
              onMouseOver={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = '#22457F'}
            >
              View My Scorecard
            </button>
          )}
          <button
            className="w-full py-3 px-4 border border-white text-white font-semibold rounded-2xl transition text-lg"
            style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
            onClick={() => navigate('/recent')}
            onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
          >
            View Competitions
          </button>
          <button
            className="w-full py-3 px-4 border border-white text-white font-semibold rounded-2xl transition text-lg"
            style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
            onClick={() => navigate('/create')}
            onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
          >
            Create New Competition
          </button>
        </div>
      </div>
    </PageBackground>
  );
}
