// Format date as DD/MM/YYYY
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

import React, { useEffect, useState } from "react";
import { apiUrl } from './api';
import { ArrowLeftIcon, ChartBarIcon, TrophyIcon, SignalIcon } from '@heroicons/react/24/solid';
import { useLocation, useNavigate, useParams } from "react-router-dom";
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
  const params = useParams();
  const [comp, setComp] = useState(location.state?.comp || null);
  const compId = comp?.id || params.id;

  useEffect(() => {
    if (!compId) return;
    fetch(apiUrl(`/api/competitions/${compId}`))
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setComp(data); });
  }, [compId]);

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
      <div>
        <TopMenu user={user} userComp={isPlayerInComp ? comp : null} isPlayerInComp={isPlayerInComp} competitionList={comp ? [comp] : []} />
        <div className="flex flex-col items-center px-4 mt-12">
          <div className="mb-10">
            <h1 className="text-4xl font-extrabold drop-shadow-lg text-center mb-1 leading-tight flex items-end justify-center gap-2" style={{ color: '#002F5F', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>
              Competition Info
            </h1>
            <div className="mx-auto mt-2 mb-4" style={{height: '2px', maxWidth: 340, background: 'white', opacity: 0.7, borderRadius: 2}}></div>
          </div>
  {/* Mobile stacked info (keeps blue theme, full-width buttons) */}
  <table className="w-full sm:hidden border-collapse text-base shadow-xl overflow-hidden bg-white/10 mb-6" style={{ fontFamily: 'Lato, Arial, sans-serif', background: '#002F5F', color: 'white', borderColor: '#FFD700', borderRadius: 8, border: '2px solid #FFD700' }}>
    <tbody>
      <tr className="border-b border-white/20">
        <td className="px-3 py-3"><strong className="text-[#FFD700]">Date:</strong> <span className="text-white">{formatDate(comp.date)}</span></td>
      </tr>
      <tr className="border-b border-white/20">
        <td className="px-3 py-3"><strong className="text-[#FFD700]">Course:</strong> <span className="text-white">{comp.club || '-'}</span></td>
      </tr>
      <tr className="border-b border-white/20">
        <td className="px-3 py-3"><strong className="text-[#FFD700]">Type:</strong> <span className="text-white">{COMP_TYPE_DISPLAY[comp.type] || comp.type || ''}</span></td>
      </tr>
      {comp.handicapallowance && (
        <tr className="border-b border-white/20"><td className="px-3 py-3"><strong className="text-[#FFD700]">Handicap Allowance:</strong> <span className="text-white">{comp.handicapallowance}{typeof comp.handicapallowance === 'string' && comp.handicapallowance.includes('%') ? '' : '%'}</span></td></tr>
      )}
      <tr className="border-b border-white/20">
        <td className="px-3 py-3"><strong className="text-[#FFD700]">Notes:</strong> <span className="text-white">{comp.notes && comp.notes.trim() !== '' ? comp.notes : '-'}</span></td>
      </tr>
      {comp.teeBox && (
        <tr className="border-b border-white/20"><td className="px-3 py-3"><strong className="text-[#FFD700]">Tee Box:</strong> <span className="text-white">{comp.teeBox}</span></td></tr>
      )}
      {comp.groups && Array.isArray(comp.groups) && (
        <tr className="border-b border-white/20">
          <td className="px-3 py-3">
            <div className="mb-2 text-[#FFD700] font-semibold">Groups</div>
            <div className="flex flex-col gap-2">
              {comp.groups.map((group, idx) => (
                <div key={idx} className="p-2 rounded border border-white/10">
                  <div className="text-white font-semibold">{group.name || idx + 1} <span className="text-sm text-white/80">{group.teeTime ? ` — ${group.teeTime}` : ''}</span></div>
                  <div className="text-white text-sm">
                    {Array.isArray(group.players) && group.players.length > 0 ? (
                      group.players.map((name, i, arr) => {
                        if (['Guest 1','Guest 2','Guest 3'].includes(name) && Array.isArray(group.displayNames) && group.displayNames[i]) {
                          return (<div key={i} className="font-bold">GUEST - {group.displayNames[i]}{i < arr.length - 1 ? ', ' : ''}</div>);
                        } else if (['Guest 1','Guest 2','Guest 3'].includes(name)) {
                          return (<div key={i} className="font-bold">{name}{i < arr.length - 1 ? ', ' : ''}</div>);
                        } else if (typeof name === 'string') {
                          const parts = name.trim().split(/\s+/);
                          let initial = '', surname = '';
                          if (parts.length > 1) {
                            initial = parts[0][0].toUpperCase();
                            surname = parts[parts.length - 1].toUpperCase();
                          } else {
                            initial = parts[0][0].toUpperCase();
                            surname = '';
                          }
                          return (<div key={i}>{initial}{surname && '. '}{surname}{i < arr.length - 1 ? ', ' : ''}</div>);
                        } else return null;
                      })
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
      <tr>
        <td className="px-3 py-3">
          <div className="flex flex-col gap-3">
            <button onClick={() => navigate('/recent')} className="w-full py-2 rounded-2xl bg-[#1B3A6B] text-white font-semibold flex items-center justify-center gap-2">
              <ArrowLeftIcon className="h-5 w-5" />
              <span>Back to Competitions</span>
            </button>
            {isPlayerInComp && (
              <button onClick={() => {
                const medalTypes = ['medalStrokeplay', 'medal strokeplay', 'stroke'];
                if (medalTypes.includes((comp.type || '').toLowerCase().replace(/\s+/g, ''))) {
                  navigate(`/scorecard-medal/${compId}`);
                } else {
                  navigate(`/scorecard/${compId}`);
                }
              }} className="w-full py-2 rounded-2xl bg-[#FFD700] text-[#002F5F] font-semibold flex items-center justify-center gap-2 scorecard-pulse">
                <SignalIcon className="h-5 w-5" style={{ color: '#002F5F' }} />
                <span>My Scorecard</span>
              </button>
            )}
            <button onClick={() => navigate(`/medal-leaderboard/${compId}`)} className="w-full py-2 rounded-2xl bg-[#1B3A6B] text-white font-semibold flex items-center justify-center gap-2">
              <TrophyIcon className="h-5 w-5" style={{ color: '#FFD700' }} />
              <span>Leaderboard</span>
            </button>
          </div>
        </td>
      </tr>
    </tbody>
  </table>

  {/* Desktop content (keeps original layout) */}
  <div className="hidden sm:block w-full max-w-4xl rounded-2xl bg-transparent text-white mb-8 px-8 p-6" style={{ backdropFilter: 'none', fontFamily: 'Lato, Arial, sans-serif', color: 'white', borderColor: '#FFD700', marginTop: '-2.5rem' }}>
          <div className="mb-4">
              <div><span className="font-semibold">Date:</span> {formatDate(comp.date)}</div>
              <div><span className="font-semibold">Course:</span> {comp.club || '-'}</div>
              <div><span className="font-semibold">Type:</span> {COMP_TYPE_DISPLAY[comp.type] || comp.type || ''}</div>
              {comp.handicapallowance && (
                <div><span className="font-semibold">Handicap Allowance:</span> {comp.handicapallowance}{typeof comp.handicapallowance === 'string' && comp.handicapallowance.includes('%') ? '' : '%'}</div>
              )}
              <div><span className="font-semibold">Notes:</span> {comp.notes && comp.notes.trim() !== '' ? comp.notes : '-'}</div>
              {comp.teeBox && <div><span className="font-semibold">Tee Box:</span> {comp.teeBox}</div>}
            </div>
            {comp.groups && Array.isArray(comp.groups) && (
              <div className="mb-4">
                <table className="min-w-full border text-center mb-2" style={{ fontFamily: 'Lato, Arial, sans-serif', color: 'white', borderColor: '#FFD700' }}>
                  <thead>
                    <tr style={{ background: '#00204A' }}>
                      <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Group</th>
                      <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Tee Time</th>
                      <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Players</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comp.groups.map((group, idx) => (
                      <tr key={idx} style={idx === 0 ? { background: '#00204A' } : {}}>
                        <td className="border px-2 py-1">{group.name || idx + 1}</td>
                        <td className="border px-2 py-1">{group.teeTime || "-"}</td>
                        <td className="border px-2 py-1">
                          {Array.isArray(group.players) && group.players.length > 0 ? (
                            <div className="flex flex-row items-center gap-2 justify-center">
                              {group.players.map((name, i, arr) => {
                                if (['Guest 1','Guest 2','Guest 3'].includes(name) && Array.isArray(group.displayNames) && group.displayNames[i]) {
                                  return (
                                    <span key={i} style={{ whiteSpace: 'nowrap', color: 'white', fontWeight: 700 }}>
                                      GUEST - {group.displayNames[i]}{i < arr.length - 1 ? ', ' : ''}
                                    </span>
                                  );
                                } else if (['Guest 1','Guest 2','Guest 3'].includes(name)) {
                                  return (
                                    <span key={i} style={{ whiteSpace: 'nowrap', color: 'white', fontWeight: 700 }}>
                                      {name}{i < arr.length - 1 ? ', ' : ''}
                                    </span>
                                  );
                                } else if (typeof name === 'string') {
                                  const parts = name.trim().split(/\s+/);
                                  let initial = '', surname = '';
                                  if (parts.length > 1) {
                                    initial = parts[0][0].toUpperCase();
                                    surname = parts[parts.length - 1].toUpperCase();
                                  } else {
                                    initial = parts[0][0].toUpperCase();
                                    surname = '';
                                  }
                                  return (
                                    <span key={i} style={{ whiteSpace: 'nowrap' }}>
                                      {initial}{surname && '. '}{surname}{i < arr.length - 1 ? ', ' : ''}
                                    </span>
                                  );
                                } else {
                                  return null;
                                }
                              })}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex gap-3 justify-start mt-2" style={{ maxWidth: 340 }}>
              <button
                className="py-2 px-4 border border-white text-white rounded-2xl font-semibold transition flex flex-row items-center whitespace-nowrap"
                style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                onClick={() => navigate('/recent')}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
              >
                <ArrowLeftIcon className="h-5 w-5 mr-1 inline-block align-text-bottom" />
                Back to Competitions
              </button>
              {isPlayerInComp && (
                <button
                  className="py-2 px-4 border border-white rounded-2xl font-semibold transition flex flex-row items-center whitespace-nowrap scorecard-pulse"
                  style={{ backgroundColor: '#FFD700', color: '#002F5F', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                  onClick={() => {
                    const medalTypes = ['medalStrokeplay', 'medal strokeplay', 'stroke'];
                    if (medalTypes.includes((comp.type || '').toLowerCase().replace(/\s+/g, ''))) {
                      navigate(`/scorecard-medal/${compId}`);
                    } else {
                      navigate(`/scorecard/${compId}`);
                    }
                  }}
                  onMouseOver={e => e.currentTarget.style.backgroundColor = '#ffe066'}
                  onMouseOut={e => e.currentTarget.style.backgroundColor = '#FFD700'}
                >
                  <SignalIcon className="h-5 w-5 mr-1 inline-block align-text-bottom" style={{ color: '#002F5F' }} />
                  My Scorecard
                </button>
              )}
              <button
                className="py-2 px-4 border border-white text-white rounded-2xl font-semibold transition flex flex-row items-center whitespace-nowrap"
                style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                onClick={() => navigate(`/medal-leaderboard/${compId}`)}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
              >
                <TrophyIcon className="h-5 w-5 mr-1 inline-block align-text-bottom" style={{ color: '#FFD700' }} />
                Leaderboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageBackground>
  );
}
