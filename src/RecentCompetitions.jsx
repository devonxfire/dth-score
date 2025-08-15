import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageBackground from './PageBackground';

export default function RecentCompetitions() {
  const [comps, setComps] = useState([]);
  const navigate = useNavigate();

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
      <div className="flex flex-col items-center px-4 mt-12">
        <h2 className="text-3xl font-bold text-white mb-6 drop-shadow-lg text-center">Recent Competitions</h2>
      </div>
      <div className="flex flex-col items-center px-4 mt-8">
        <div className="w-full max-w-2xl rounded-2xl shadow-lg bg-transparent text-white mb-8" style={{ backdropFilter: 'none' }}>
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
                      <td className="border px-2 py-1">{comp.type}</td>
                      <td className="border px-2 py-1">
                        <button className="py-1 px-3 bg-teal-600 border border-transparent text-white font-semibold hover:bg-teal-700 transition" onClick={() => navigate(`/competition/${comp.code}`)}>Info</button>
                      </td>
                      <td className="border px-2 py-1">{status}</td>
                    </tr>,
                    <tr key={comp.code + '-actions'}>
                      <td colSpan={4} className="border px-2 py-2 bg-white/5">
                        <div className="flex gap-4 justify-center">
                          {status === 'Open' ? (
                            <button className="py-2 px-4 w-full max-w-xs bg-teal-600 border border-transparent text-white font-semibold hover:bg-teal-700 transition" onClick={() => handleSelect(comp)}>Join</button>
                          ) : (
                            <span className="flex items-center justify-center w-full bg-red-900/80 text-gray-300 font-semibold uppercase tracking-wide rounded select-none" style={{minHeight: '40px', letterSpacing: '0.05em'}}>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="#fff0" />
                                <line x1="7" y1="7" x2="17" y2="17" stroke="currentColor" strokeWidth="2" />
                              </svg>
                              Complete
                            </span>
                          )}
                          <button className="py-2 px-4 w-full max-w-xs bg-teal-600 border border-transparent text-white font-semibold hover:bg-teal-700 transition" onClick={() => navigate(`/leaderboard/${comp.code}`)}>View Leaderboard</button>
                        </div>
                      </td>
                    </tr>
                  ];
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageBackground>
  );
}