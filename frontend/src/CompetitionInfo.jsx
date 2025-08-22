// Format date as DD/MM/YYYY
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PageBackground from './PageBackground';

const COMP_TYPE_DISPLAY = {
  fourBbbStableford: '4BBB Stableford (2 Scores to Count)',
  '4bbb stableford': '4BBB Stableford (2 Scores to Count)',
  alliance: 'Alliance',
  medalStrokeplay: 'Medal Strokeplay',
  'medal strokeplay': 'Medal Strokeplay',
  stroke: 'Medal Strokeplay',
  individualStableford: 'Individual Stableford',
  'individual stableford': 'Individual Stableford',
};

export default function CompetitionInfo({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const comp = location.state?.comp;

  if (!comp) {
    return (
      <PageBackground>
        <div className="flex flex-col items-center min-h-screen justify-center px-4">
          <div className="flex flex-col items-center px-4 mt-12">
            <h2 className="text-5xl font-bold text-white mb-1 drop-shadow-lg text-center">Competition Info</h2>
            <p className="text-xl text-white mb-6 drop-shadow text-center">No competition data found.</p>
          </div>
          <div className="flex flex-col items-center px-4 mt-8 w-full">
            <div className="w-full max-w-md rounded-2xl shadow-lg bg-transparent text-white mb-8 p-6 text-center" style={{ backdropFilter: 'none' }}>
              <div className="text-red-400 mb-4">No competition data found.</div>
              <button className="py-2 px-4 bg-transparent border border-white text-white rounded-2xl hover:bg-white hover:text-black transition" onClick={() => navigate(-1)}>
                Back
              </button>
            </div>
          </div>
        </div>
      </PageBackground>
    );
  }

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
            Welcome, {(user?.name?.split(' ')[0]) || 'Player'}
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
      <div className="flex flex-col items-center px-4 mt-12">
        <h2 className="text-3xl font-bold text-white mb-2 drop-shadow-lg text-center">Competition Info</h2>
        <p className="text-xl text-white mb-6 drop-shadow text-center">Details for this golf competition.</p>
      </div>
      <div className="flex flex-col items-center px-4 mt-8">
        <div className="w-full max-w-4xl rounded-2xl shadow-lg bg-transparent text-white mb-8 px-8 p-6" style={{ backdropFilter: 'none' }}>
          <div className="mb-4">
              <div><span className="font-semibold">Date:</span> {formatDate(comp.date)}</div>
              <div><span className="font-semibold">Type:</span> {COMP_TYPE_DISPLAY[comp.type] || comp.type || ''}</div>
              <div><span className="font-semibold">Join Code:</span> {comp.joinCode || comp.joincode || '-'}</div>
              {comp.teeBox && <div><span className="font-semibold">Tee Box:</span> {comp.teeBox}</div>}
            </div>
            {comp.groups && Array.isArray(comp.groups) && (
              <div className="mb-4">
                <h3 className="font-semibold mb-2">Groups / Teams</h3>
                <table className="min-w-full border text-center mb-2">
                  <thead>
                    <tr className="bg-white/10">
                      <th className="border px-2 py-1">Group</th>
                      <th className="border px-2 py-1">Tee Time</th>
                      <th className="border px-2 py-1">Players</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comp.groups.map((group, idx) => (
                      <tr key={idx}>
                        <td className="border px-2 py-1">{group.name || idx + 1}</td>
                        <td className="border px-2 py-1">{group.teeTime || "-"}</td>
                        <td className="border px-2 py-1">{group.players?.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button
              className="py-2 px-4 border border-white text-white rounded-2xl font-semibold transition"
              style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
              onClick={() => navigate(-1)}
              onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
            >
              Back
            </button>
          </div>
    </div>
  </PageBackground>
  );
}
