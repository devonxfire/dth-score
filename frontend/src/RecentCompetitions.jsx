// Format date as DD/MM/YYYY
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}


import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import PageBackground from './PageBackground';

// Helper: check if user is admin
function isAdmin(user) {
  return user && (user.role === 'admin' || user.isAdmin || user.isadmin);
}

const COMP_TYPE_DISPLAY = {
  fourBbbStableford: '4BBB Stableford (2 Scores to Count)',
  alliance: 'Alliance',
  medalStrokeplay: 'Medal Strokeplay',
  individualStableford: 'Individual Stableford',
};


export default function RecentCompetitions({ user }) {
  const location = useLocation();
  const [comps, setComps] = useState([]);
  const navigate = useNavigate();
  

  // Fetch competitions
  useEffect(() => {
    fetch('/api/competitions')
      .then(res => res.json())
      .then(data => setComps(Array.isArray(data) ? data : []))
      .catch(() => setComps([]));
  }, []);

  // Delete competition handler
  const handleDelete = async (compId) => {
    if (!window.confirm('Are you sure you want to delete this competition?')) return;
    // Get admin secret from VITE_ADMIN_SECRET only
    const adminSecret = import.meta.env.VITE_ADMIN_SECRET;
    if (!adminSecret) {
      alert('Admin secret not set in frontend .env.');
      return;
    }
    const res = await fetch(`/api/competitions/${compId}`, {
      method: 'DELETE',
      headers: { 'X-Admin-Secret': adminSecret },
    });
    if (res.ok) {
      setComps(comps => comps.filter(c => c.id !== compId));
    } else {
      alert('Failed to delete competition.');
    }
  };

  return (
    <PageBackground>
      {/* Top nav menu */}
      <div className="flex flex-wrap justify-between items-center mt-8 mb-4 w-full max-w-2xl mx-auto px-8">
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
          onClick={() => {
            if (typeof window.onSignOut === 'function') window.onSignOut();
            else if (typeof window.signOut === 'function') window.signOut();
          }}
        >
          Sign Out
        </button>
      </div>
      <div className="flex flex-col items-center px-4 mt-8">
        <h1 className="text-3xl font-bold mb-6 text-white drop-shadow-lg">Recent Competitions</h1>
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
              ) : comps.flatMap((comp, idx) => {
                const keyBase = comp.id || comp.joinCode || comp.joincode || idx;
                let status = 'Open';
                if (comp.date) {
                  const today = new Date();
                  const compDate = new Date(comp.date);
                  if (compDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
                    status = 'Closed';
                  }
                }
                return [
                  <tr key={keyBase + '-spacer'}>
                    <td colSpan={4} style={{ height: idx === 0 ? 0 : 32, background: 'transparent', border: 'none', padding: 0 }}></td>
                  </tr>,
                  <tr key={keyBase + '-info'} className="border-t-4 border-transparent">
                    <td className="border px-2 py-1">{formatDate(comp.date)}</td>
                    <td className="border px-2 py-1">{COMP_TYPE_DISPLAY[comp.type] || comp.type || ''}</td>
                    <td className="border px-2 py-1">{comp.club || comp.joinCode || comp.joincode || '-'}</td>
                    <td className="border px-2 py-1">{status}</td>
                  </tr>,
                  <tr key={keyBase + '-actions'}>
                    <td colSpan={4} className="border px-2 py-2 bg-white/5">
                      <div className="flex gap-4 justify-center">
                        <button
                          className="py-1 px-3 border border-white text-white font-semibold rounded-2xl transition"
                          style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                          onClick={() => navigate(`/competition/${comp.joinCode || comp.joincode || comp.id}`, { state: { comp } })}
                          onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
                          onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
                        >
                          Info
                        </button>
                        {status === 'Open' && user && Array.isArray(comp.groups) && comp.groups.some(g => Array.isArray(g.players) && g.players.includes(user.name)) ? (
                          <button
                            className="py-2 px-4 w-full max-w-xs border border-white text-white font-semibold rounded-2xl transition"
                            style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                            onClick={() => handleSelect && handleSelect(comp)}
                            onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
                            onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
                          >
                            Join
                          </button>
                        ) : status === 'Open' ? (
                          <span className="flex items-center justify-center w-full bg-yellow-900/80 text-gray-300 font-semibold uppercase tracking-wide rounded select-none" style={{minHeight: '40px', letterSpacing: '0.05em'}}>
                            YOU AREN'T PLAYING
                          </span>
                        ) : (
                          <span className="flex items-center justify-center w-full bg-red-900/80 text-gray-300 font-semibold uppercase tracking-wide rounded select-none" style={{minHeight: '40px', letterSpacing: '0.05em'}}>
                            Closed
                          </span>
                        )}
                        {isAdmin(user) && (
                          <button
                            className="py-1 px-3 border border-red-400 text-red-300 font-semibold rounded-2xl transition ml-2 hover:bg-red-900/80"
                            style={{ boxShadow: '0 2px 8px 0 rgba(255,0,0,0.10)' }}
                            onClick={() => handleDelete(comp.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ];
              })}
            </tbody>
          </table>
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
      </div>
    </PageBackground>
  );
}