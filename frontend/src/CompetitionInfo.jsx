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
import TopMenu from './TopMenu';

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

  // For TopMenu: pass user and comp as userComp if user is a player in this comp
  const isPlayerInComp = user && comp && comp.groups && comp.groups.some(g => Array.isArray(g.players) && g.players.includes(user.name));

  if (!comp) {
    return (
      <PageBackground>
        <TopMenu user={user} userComp={null} isPlayerInComp={false} />
        <div className="flex flex-col items-center min-h-screen justify-center px-4">
          <div className="flex flex-col items-center px-4 mt-12">
            <h2 className="text-5xl font-bold text-white mb-1 drop-shadow-lg text-center">Competition Info</h2>
            <p className="text-xl text-white mb-6 drop-shadow text-center">No competition data found.</p>
          </div>
          <div className="flex flex-col items-center px-4 mt-8 w-full">
            <div className="w-full max-w-md rounded-2xl shadow-lg bg-transparent text-white mb-8 p-6 text-center" style={{ backdropFilter: 'none' }}>
              <div className="text-red-400 mb-4">No competition data found.</div>
              <button className="py-2 px-4 bg-transparent border border-white text-white rounded-2xl hover:bg-white hover:text-black transition" onClick={() => navigate('/recent')}>
                Back to Competitions
              </button>
            </div>
          </div>
        </div>
      </PageBackground>
    );
  }

  return (
    <PageBackground>
      <TopMenu user={user} userComp={isPlayerInComp ? comp : null} isPlayerInComp={isPlayerInComp} />
      <div className="flex flex-col items-center px-4 mt-4">
        <div className="mb-0">
          <h1 className="text-4xl font-extrabold text-white drop-shadow-lg text-center mb-1 leading-tight" style={{ letterSpacing: '0.01em', textShadow: '0 2px 8px rgba(0,0,0,0.10)' }}>Competition Info</h1>
          <div className="mx-auto mt-1 mb-1" style={{height: '2px', maxWidth: 340, background: 'white', opacity: 0.7, borderRadius: 2}}></div>
        </div>
  <div className="w-full max-w-4xl rounded-2xl bg-transparent text-white mb-8 px-8 p-6" style={{ backdropFilter: 'none', marginTop: 0 }}>
          <div className="mb-4">
              <div><span className="font-semibold">Date:</span> {formatDate(comp.date)}</div>
              <div><span className="font-semibold">Type:</span> {COMP_TYPE_DISPLAY[comp.type] || comp.type || ''}</div>
              {comp.handicapallowance && (
                <div><span className="font-semibold">Handicap Allowance:</span> {comp.handicapallowance}{typeof comp.handicapallowance === 'string' && comp.handicapallowance.includes('%') ? '' : '%'}</div>
              )}
              {comp.teeBox && <div><span className="font-semibold">Tee Box:</span> {comp.teeBox}</div>}
            </div>
            {comp.groups && Array.isArray(comp.groups) && (
              <div className="mb-4">
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
                        <td className="border px-2 py-1">
                          {Array.isArray(group.players) && group.players.length > 0 ? (
                            <div className="flex flex-col items-center">
                              {group.players.map((name, i) => (
                                <span key={i}>{name}</span>
                              ))}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button
              className="py-2 px-4 border border-white text-white rounded-2xl font-semibold transition"
              style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
              onClick={() => navigate('/recent')}
              onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
            >
              Back to Competitions
            </button>
          </div>
    </div>
  </PageBackground>
  );
}
