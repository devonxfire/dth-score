import PageBackground from './PageBackground';
import { useNavigate } from 'react-router-dom';
import westlakeLogo from './assets/westlake-logo2.png';

export default function Dashboard({ user, onSignOut }) {
  const navigate = useNavigate();
  return (
    <PageBackground>
      <div className="relative z-10 flex flex-col items-center px-4 mt-12">
        <img
          src={westlakeLogo}
          alt="Westlake Golf Club Badge"
          className="mb-8 max-h-48 w-auto"
          style={{ objectFit: 'contain' }}
        />
        <h1 className="text-5xl font-bold text-white mb-1 drop-shadow-lg text-center">Welcome, {user}!</h1>
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
      {/* Sign Out button bottom right */}
      <div className="relative z-10 flex flex-col items-center px-4 mt-2">
  <div className="w-full max-w-md flex justify-center mt-2">
          <button
            className="text-sm text-white font-semibold opacity-80 hover:opacity-100 hover:underline focus:underline bg-transparent border-none outline-none px-2 py-1 cursor-pointer"
            style={{ background: 'none', border: 'none', boxShadow: 'none' }}
            onClick={onSignOut}
          >
            Sign Out
          </button>
        </div>
      </div>
    </PageBackground>
  );
}
