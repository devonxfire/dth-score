
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import PageBackground from './PageBackground';

const COMP_TYPE_DISPLAY = {
  fourBbbStableford: '4BBB Stableford (2 Scores to Count)',
  alliance: 'Alliance',
  medalStrokeplay: 'Medal Strokeplay',
  individualStableford: 'Individual Stableford',
};

export default function RecentCompetitions() {
  const [comps, setComps] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const all = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('comp_')) {
        try {
          const comp = JSON.parse(localStorage.getItem(key));
          all.push(comp);
        } catch {}
      }
    }
    // Sort by date descending
    all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    setComps(all);
  }, []);

  function handleSelect(comp) {
    navigate('/join', { state: { code: comp.code } });
  }

  return (
    <PageBackground>
      {/* Top nav menu (copied from CreateCompetition.jsx for perfect match) */}
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
          onClick={() => {
            if (typeof window.onSignOut === 'function') window.onSignOut();
            else if (typeof window.signOut === 'function') window.signOut();
          }}
        >
          Sign Out
        </button>
      </div>
      <div className="flex flex-col items-center px-4 mt-12">
        <h2 className="text-3xl font-bold text-white mb-2 drop-shadow-lg text-center">Recent Competitions</h2>
      </div>
      <div className="flex flex-col items-center px-4 mt-8">
  <div className="w-full max-w-4xl rounded-2xl shadow-lg bg-transparent text-white mb-8 px-8" style={{ backdropFilter: 'none' }}>
          <table className="min-w-full border text-center mb-6">
            <thead>
              <tr className="bg-white/10">
                <th className="border px-2 py-1">Date</th>
                <th className="border px-2 py-1">Type</th>
                <th className="border px-2 py-1">Info</th>
                <th className="border px-2 py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {comps.length === 0 ? (
                <tr>
                  <td colSpan={4} className="border px-2 py-4 text-white/80">No competitions found.</td>
                </tr>
              ) : (
                comps.flatMap((comp, idx) => {
                  let status = 'Open';
                  if (comp.date) {
                    const today = new Date();
                    const compDate = new Date(comp.date);
                    if (compDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
                      status = 'Closed';
                    }
                  }
                  return [
                    <tr key={comp.code + '-spacer'}>
                      <td colSpan={4} style={{ height: idx === 0 ? 0 : 32, background: 'transparent', border: 'none', padding: 0 }}></td>
                    </tr>,
                    idx !== 0 && (
                      <tr key={comp.code + '-headings'} className="bg-white/10">
                        <th className="border px-2 py-1">Date</th>
                        <th className="border px-2 py-1">Type</th>
                        <th className="border px-2 py-1">Info</th>
                        <th className="border px-2 py-1">Status</th>
                      </tr>
                    ),
                    <tr key={comp.code + '-info'} className="border-t-4 border-transparent">
                      <td className="border px-2 py-1">{comp.date?.split('-').reverse().join('/')}</td>
                      <td className="border px-2 py-1">{COMP_TYPE_DISPLAY[comp.type] || ''}</td>
                      <td className="border px-2 py-1">
                        <button
                          className="py-1 px-3 border border-white text-white font-semibold rounded-2xl transition"
                          style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                          onClick={() => navigate(`/competition/${comp.code}`, { state: { comp } })}
                          onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
                          onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
                        >
                          Info
                        </button>
                      </td>
                      <td className="border px-2 py-1">{status}</td>
                    </tr>,
                    <tr key={comp.code + '-actions'}>
                      <td colSpan={4} className="border px-2 py-2 bg-white/5">
                        <div className="flex gap-4 justify-center">
                          {status === 'Open' ? (
                            <button
                              className="py-2 px-4 w-full max-w-xs border border-white text-white font-semibold rounded-2xl transition"
                              style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                              onClick={() => handleSelect(comp)}
                              onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
                              onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
                            >
                              Join
                            </button>
                          ) : (
                            <span className="flex items-center justify-center w-full bg-red-900/80 text-gray-300 font-semibold uppercase tracking-wide rounded select-none" style={{minHeight: '40px', letterSpacing: '0.05em'}}>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="#fff0" />
                                <line x1="7" y1="7" x2="17" y2="17" stroke="currentColor" strokeWidth="2" />
                              </svg>
                              Complete
                            </span>
                          )}
                          <button
                            className="py-2 px-4 w-full max-w-xs border border-white text-white font-semibold rounded-2xl transition"
                            style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                            onClick={() => navigate(`/leaderboard/${comp.code}`)}
                            onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
                            onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
                          >
                            View Leaderboard
                          </button>
                        </div>
                      </td>
                    </tr>
                  ];
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="w-full max-w-4xl flex justify-start mt-2 px-8">
          <button
            className="py-2 px-6 border border-white text-white font-semibold rounded-2xl transition text-lg"
            style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
            onClick={() => navigate('/create')}
            onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
          >
            <span className="mr-2 text-xl font-bold align-middle">+</span>Add New
          </button>
        </div>
        <div className="w-full max-w-2xl flex justify-start">
        </div>
      </div>
    </PageBackground>
  );
}