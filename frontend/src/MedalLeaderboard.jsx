import React, { useEffect, useState } from 'react';
import { apiUrl } from './api';
import PageBackground from './PageBackground';
import TopMenu from './TopMenu';
import { useLocation, useNavigate } from 'react-router-dom';
import { SignalIcon } from '@heroicons/react/24/solid';

// Lightweight, stable replacement for MedalLeaderboard focusing on the header
// and the My Scorecard / Export Results area. This deliberately keeps logic
// minimal to avoid syntax/HSR issues while restoring the requested UI.

export default function MedalLeaderboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [comp, setComp] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const id = location.pathname.split('/').pop();

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) setCurrentUser(JSON.parse(raw));
    } catch (e) {}
    if (!id) return;
    fetch(apiUrl(`/api/competitions/${id}`))
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setComp(data); })
      .catch(() => {});
  }, [id]);

  function isAdmin(user) {
    return user && (user.role === 'admin' || user.isAdmin || user.isadmin || (user.username && ['devon','arno','arno_cap'].includes(user.username.toLowerCase())) );
  }

  const today = new Date();
  const isOpenComp = comp && (comp.status === 'Open' || (comp.date && new Date(comp.date) >= new Date(today.getFullYear(), today.getMonth(), today.getDate())));
  const isPlayerInComp = currentUser && comp && comp.groups && Array.isArray(comp.groups) && comp.groups.some(g => Array.isArray(g.players) && g.players.includes(currentUser.name));
  const showMyScorecard = Boolean(isAdmin(currentUser) || isPlayerInComp);

  return (
    <PageBackground>
      <TopMenu userComp={comp} competitionList={comp ? [comp] : []} />
      <div className="flex flex-col items-center px-4 mt-12" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>
        <h1 className="text-4xl font-extrabold drop-shadow-lg text-center mb-1 leading-tight flex items-end justify-center gap-2" style={{ color: '#002F5F', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>
          <span style={{lineHeight:1}}>Leaderboard</span>
        </h1>
        <div className="mx-auto mt-2" style={{height: '2px', maxWidth: 340, background: 'white', opacity: 0.7, borderRadius: 2}}></div>
      </div>

      <div className="flex flex-col items-center px-4 mt-8">
        <div className="w-full max-w-4xl rounded-2xl shadow-lg bg-transparent text-white mb-8" style={{ backdropFilter: 'none' }}>
          <div className="flex justify-center mb-4">
            <button
              onClick={() => { /* keep original export handled elsewhere */ }}
              className="py-2 px-4 bg-[#002F5F] text-[#FFD700] border border-[#FFD700] rounded-2xl hover:bg-[#FFD700] hover:text-[#002F5F] transition"
              style={{ fontFamily: 'Lato, Arial, sans-serif' }}
            >
              Export Results
            </button>
          </div>

          <div className="text-white/90 text-base mb-4" style={{minWidth: 260, textAlign: 'left'}}>
            <div style={{ marginTop: 8, marginBottom: 6, textDecoration: 'underline', textUnderlineOffset: 3 }} className="font-semibold">Competition</div>
            <div><span className="font-semibold">Date:</span> {comp?.date ? new Date(comp.date).toLocaleDateString('en-GB') : '-'}</div>
            <div><span className="font-semibold">Type:</span> {(comp?.type) || ''}</div>
            <div style={{ marginTop: 8 }}>
              {showMyScorecard && (
                <button
                  onClick={() => {
                    if (!isAdmin(currentUser) && !isPlayerInComp) return;
                    const medalTypes = ['medalStrokeplay', 'medal strokeplay', 'stroke'];
                    if (medalTypes.includes((comp?.type || '').toLowerCase().replace(/\s+/g, ''))) {
                      navigate(`/scorecard-medal/${id}`);
                    } else {
                      navigate(`/scorecard/${id}`);
                    }
                  }}
                  className="py-2 px-4 border border-white rounded-2xl font-extrabold transition flex flex-row items-center whitespace-nowrap"
                  style={{ backgroundColor: '#FFD700', color: '#002F5F', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)', fontFamily: 'Lato, Arial, sans-serif', opacity: (isAdmin(currentUser) || (isPlayerInComp && isOpenComp)) ? 1 : 0.5, pointerEvents: (isAdmin(currentUser) || (isPlayerInComp && isOpenComp)) ? 'auto' : 'none' }}
                  onMouseOver={e => { if (isAdmin(currentUser) || (isPlayerInComp && isOpenComp)) e.currentTarget.style.backgroundColor = '#ffe066'; }}
                  onMouseOut={e => { if (isAdmin(currentUser) || (isPlayerInComp && isOpenComp)) e.currentTarget.style.backgroundColor = '#FFD700'; }}
                >
                  <SignalIcon className="h-5 w-5 mr-1 inline-block align-text-bottom" style={{ color: '#002F5F' }} />
                  <span>My Scorecard</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageBackground>
  );
}