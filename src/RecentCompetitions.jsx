import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function RecentCompetitions() {
  const [comps, setComps] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Get all keys from localStorage that start with 'comp_'
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
    // Go to join form, prefill code
    navigate('/join/form', { state: { code: comp.code } });
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-50 px-4 py-8">
      <div className="bg-white rounded shadow p-6 w-full max-w-2xl mb-8">
        <h2 className="text-2xl font-bold text-blue-700 mb-4">Recent Competitions</h2>
        {comps.length === 0 ? (
          <div className="text-gray-500">No competitions found.</div>
        ) : (
          <table className="min-w-full border text-center mb-6">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1">Date</th>
                <th className="border px-2 py-1">Type</th>
                <th className="border px-2 py-1">Status</th>
                <th className="border px-2 py-1">Join</th>
                <th className="border px-2 py-1">Leaderboard</th>
              </tr>
            </thead>
            <tbody>
              {comps.map((comp, idx) => {
                // Status: Open if today or future, Closed if past
                let status = 'Open';
                if (comp.date) {
                  const today = new Date();
                  const compDate = new Date(comp.date);
                  if (compDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
                    status = 'Closed';
                  }
                }
                return (
                  <tr key={idx}>
                    <td className="border px-2 py-1">{comp.date?.split('-').reverse().join('/')}</td>
                    <td className="border px-2 py-1">{comp.type?.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</td>
                    <td className="border px-2 py-1">{status}</td>
                    <td className="border px-2 py-1">
                      {status === 'Open' ? (
                        <button
                          className="py-1 px-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                          onClick={() => handleSelect(comp)}
                        >
                          Join
                        </button>
                      ) : (
                        <span className="text-gray-400">Complete</span>
                      )}
                    </td>
                    <td className="border px-2 py-1">
                      <button
                        className="py-1 px-3 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition"
                        onClick={() => navigate('/leaderboard', { state: { date: comp.date, type: comp.type } })}
                      >
                        View Leaderboard
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <button
          className="py-2 px-4 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
      </div>
    </div>
  );
}
