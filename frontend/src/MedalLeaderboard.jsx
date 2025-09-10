  // Helper: get par for holes played
  function getParDiff(entry) {
    const holesPlayed = entry.scores?.filter(s => s && s !== '').length || 0;
    if (!holesPlayed) return '';
    let gross = 0;
    let par = 0;
    for (let i = 0; i < holesPlayed; i++) {
      gross += parseInt(entry.scores[i] || 0);
      par += defaultHoles[i]?.par || 0;
    }
    const diff = gross - par;
    if (holesPlayed === 0) return '';
    if (diff === 0) return 'E';
    if (diff > 0) return `+${diff}`;
    return `${diff}`;
  }
// Format date as DD/MM/YYYY
function formatDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

import React, { useEffect, useState } from 'react';
import { useBackendTeams } from './hooks/useBackendTeams';
import { useLocation, useNavigate } from 'react-router-dom';
import PageBackground from './PageBackground';
import TopMenu from './TopMenu';

const COMP_TYPE_DISPLAY = {
  fourBbbStableford: '4BBB Stableford (2 Scores to Count)',
  alliance: 'Alliance',
  medalStrokeplay: 'Medal Strokeplay',
  individualStableford: 'Individual Stableford',
};
// Westlake Golf Club holes: par and stroke index
const defaultHoles = [
  { number: 1, par: 4, index: 5 },
  { number: 2, par: 4, index: 7 },
  { number: 3, par: 3, index: 17 },
  { number: 4, par: 5, index: 1 },
  { number: 5, par: 4, index: 11 },
  { number: 6, par: 3, index: 15 },
  { number: 7, par: 5, index: 3 },
  { number: 8, par: 4, index: 13 },
  { number: 9, par: 4, index: 9 },
  { number: 10, par: 4, index: 10 },
  { number: 11, par: 4, index: 4 },
  { number: 12, par: 4, index: 12 },
  { number: 13, par: 5, index: 2 },
  { number: 14, par: 4, index: 14 },
  { number: 15, par: 3, index: 18 },
  { number: 16, par: 5, index: 6 },
  { number: 17, par: 3, index: 16 },
  { number: 18, par: 4, index: 8 },
];

function MedalLeaderboard() {
  const [entries, setEntries] = useState([]);
  const [comp, setComp] = useState(null);
  const [groups, setGroups] = useState([]);
  const [compId, setCompId] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  // Get comp id from URL if using react-router
  const id = location.pathname.split('/').pop();

  useEffect(() => {
    // Fetch competition and scores for this comp
    fetch(`/api/competitions/${id}`)
      .then(res => res.json())
      .then(data => {
        setComp(data);
        setGroups(Array.isArray(data.groups) ? data.groups : []);
        // Flatten all players in all groups into leaderboard entries
        const entries = [];
        if (Array.isArray(data.groups)) {
          data.groups.forEach((group, groupIdx) => {
            if (Array.isArray(group.players)) {
              group.players.forEach(name => {
                const scores = group.scores?.[name] || Array(18).fill('');
                const handicap = group.handicaps?.[name] ?? '';
                const teebox = group.teeboxes?.[name] ?? '';
                const waters = group.waters?.[name] ?? '';
                const dog = group.dog?.[name] ?? false;
                const twoClubs = group.two_clubs?.[name] ?? '';
                const fines = group.fines?.[name] ?? '';
                const gross = scores.reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0);
                const net = gross && handicap !== '' ? gross - Math.round(parseFloat(handicap) * 0.95) : '';
                entries.push({
                  name,
                  scores,
                  total: gross || '',
                  net,
                  waters,
                  dog,
                  twoClubs,
                  fines,
                  handicap,
                  teebox,
                  groupIdx
                });
              });
            }
          });
        }
        setEntries(entries);
      });
  }, [id]);

  // Get comp type and date from comp object
  let compRaw = comp?.type || comp?.competitionType || '';
  let compKey = compRaw
    .replace(/\s+/g, '')
    .replace(/\(.*\)/, '')
    .replace(/[^a-zA-Z]/g, '')
    .replace(/^[0-9]+/, '')
    .replace(/^[A-Z]/, m => m.toLowerCase())
    .replace(/(\w)([A-Z])/g, (m, p1, p2) => p1 + p2.toLowerCase());
  if (compKey === '4bbbstableford') compKey = 'fourBbbStableford';
  if (compKey === 'medalstrokeplay') compKey = 'medalStrokeplay';
  if (compKey === 'individualstableford') compKey = 'individualStableford';
  if (compKey === 'alliance') compKey = 'alliance';
  const date = comp?.date || '';
  // Determine comp type
  const isMedal = compRaw.toLowerCase().includes('medal');
  const isStableford = compRaw.toLowerCase().includes('stableford');
  const isAlliance = compRaw.toLowerCase().includes('alliance');

  function getAllianceTeams() {
    // Use latest groups from backend
    return groups.map((group, idx) => {
      // Find player entries for this group (case-insensitive, trimmed match, support guest display names)
      const groupEntries = (group.players || []).map((name, i) => {
        if (["Guest 1","Guest 2","Guest 3"].includes(name) && Array.isArray(group.displayNames) && group.displayNames[i]) {
          // Try to match guest by display name
          const guestName = group.displayNames[i].trim().toLowerCase();
          return entries.find(e => e.name?.trim().toLowerCase() === guestName);
        } else if (typeof name === 'string') {
          const norm = name.trim().toLowerCase();
          return entries.find(e => e.name?.trim().toLowerCase() === norm);
        } else {
          return undefined;
        }
      }).filter(Boolean);
      // For each hole, get best 2 stableford points
      const holes = 18;
      let teamPoints = 0;
      let thru = 0;
      for (let h = 0; h < holes; h++) {
        // Get points for each player for this hole
        const pts = groupEntries.map(e => {
          // Calculate points for this hole only
          const ph = getPlayingHandicap(e);
          const gross = parseInt(e.scores?.[h], 10);
          if (!gross || isNaN(gross) || gross <= 0) return 0;
          const hole = defaultHoles[h];
          let strokesReceived = 0;
          if (ph > 0) {
            strokesReceived = Math.floor(ph / 18);
            if (hole.index <= (ph % 18)) strokesReceived += 1;
          }
          const net = gross - strokesReceived;
          const par = hole.par;
          if (net === par - 4) return 6; // triple eagle
          if (net === par - 3) return 5; // double eagle
          if (net === par - 2) return 4; // eagle
          if (net === par - 1) return 3; // birdie
          if (net === par) return 2; // par
          if (net === par + 1) return 1; // bogey
          return 0;
        });
        // Best single score to count (BB Score)
        const best = Math.max(...pts);
        if (best > 0) thru = h + 1;
        teamPoints += best;
      }
      // Propagate guest display names for UI
      let displayPlayers = (group.players || []).map((name, i) => {
        const guestIdx = ['Guest 1','Guest 2','Guest 3'].indexOf(name);
        if (guestIdx !== -1 && Array.isArray(group.displayNames) && group.displayNames[guestIdx]) {
          return `GUEST - ${group.displayNames[guestIdx]}`;
        } else if (guestIdx !== -1) {
          return name;
        } else if (typeof name === 'string') {
          const parts = name.trim().split(' ');
          if (parts.length > 1) {
            return parts[0][0] + '. ' + parts[parts.length - 1];
          } else {
            return name;
          }
        } else {
          return '';
        }
      });
      // Find backend team_points by matching player names
      let backendTeamPoints;
      if (backendTeams && backendTeams.length > 0) {
        const groupKey = (group.players || []).map(p => p && p.trim && p.trim()).sort().join('|');
        const found = backendTeams.find(t => {
          if (!Array.isArray(t.players)) return false;
          const teamKey = t.players.map(p => p && p.trim && p.trim()).sort().join('|');
          return teamKey === groupKey;
        });
        backendTeamPoints = found?.team_points;
      }
      return {
        groupNum: idx + 1,
        teeTime: group.teeTime,
        players: displayPlayers,
        teamPoints,
        backendTeamPoints,
        thru,
      };
    });
  }

  // Helper: calculate net and points
  function getPlayingHandicap(entry) {
    const full = parseFloat(entry.player?.handicap || 0);
    return Math.round(full * 0.95);
  }
  function getNet(entry) {
    return entry.total - getPlayingHandicap(entry);
  }
  function getStablefordPoints(entry) {
    // Allocate shots per hole using stroke index
    const ph = getPlayingHandicap(entry);
    let points = 0;
    for (let i = 0; i < (entry.scores?.length || 0); i++) {
      const gross = parseInt(entry.scores[i] || 0);
      if (!gross) continue;
      const hole = defaultHoles[i];
      // Calculate shots for this hole
      let shots = 0;
      if (ph > 0) {
        shots = Math.floor(ph / 18);
        // Extra shots for lowest indexes
        if (hole.index <= (ph % 18)) shots += 1;
      }
      const net = gross - shots;
      const par = hole.par;
      if (net === par - 2) points += 4; // eagle
      else if (net === par - 1) points += 3; // birdie
      else if (net === par) points += 2; // par
      else if (net === par + 1) points += 1; // bogey
      // else 0
    }
    return points;
  }

  // Determine if any player has played less than 18 holes
  const showThru = entries.some(e => (e.scores?.filter(s => s && s !== '').length || 0) < 18);

  // Compute leaderboard rows with position, thru, dthNet, etc.
  const leaderboardRows = entries.map(entry => {
    const holesPlayed = entry.scores?.filter(s => s && s !== '').length || 0;
    let thru = holesPlayed === 18 ? 'F' : holesPlayed;
    // Course Handicap (CH)
    const ch = entry.handicap !== '' ? parseInt(entry.handicap, 10) || 0 : 0;
    // Playing Handicap (PH) with allowance
    const allowance = comp?.handicapallowance ? parseFloat(comp.handicapallowance) : 100;
    const ph = Math.round(ch * (allowance / 100));
    // DTH Net = Gross - CH
    const dthNet = entry.total - ch;
    // Net = Gross - PH
    const net = entry.total - ph;
    return {
      ...entry,
      thru,
      ch,
      ph,
      dthNet,
      net
    };
  });
  // Sort: finished first, then by net
  leaderboardRows.sort((a, b) => {
    const thruA = a.thru === 'F' ? 18 : (typeof a.thru === 'number' ? a.thru : -1);
    const thruB = b.thru === 'F' ? 18 : (typeof b.thru === 'number' ? b.thru : -1);
    if (thruA !== thruB) return thruB - thruA;
    return a.net - b.net;
  });
  leaderboardRows.forEach((p, i) => (p.position = i + 1));
  // Good Scores section
  const goodScores = leaderboardRows.filter(p => typeof p.dthNet === 'number' && p.dthNet < 70 && p.thru === 'F');
  return (
    <PageBackground>
      <TopMenu userComp={comp} competitionList={comp ? [comp] : []} />
      <div className="flex flex-col items-center px-4 mt-12">
        <h1 className="text-4xl font-extrabold drop-shadow-lg text-center mb-1 leading-tight flex items-end justify-center gap-2" style={{ color: '#002F5F', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <span style={{lineHeight:1}}>Leaderboard</span>
        </h1>
        {comp?.date && (
          <div className="text-lg text-white text-center mb-2 font-semibold" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>
            {new Date(comp.date).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        )}
        <div className="mx-auto mt-2" style={{height: '2px', maxWidth: 340, background: 'white', opacity: 0.7, borderRadius: 2}}></div>
      </div>
      <div className="flex flex-col items-center px-4 mt-8">
        <div className="w-full max-w-4xl rounded-2xl shadow-lg bg-transparent text-white mb-8" style={{ backdropFilter: 'none' }}>
          <div className="flex justify-between mb-4">
            <button
              onClick={() => navigate('/')}
              className="py-2 px-4 bg-transparent border border-white text-white rounded-2xl hover:bg-white hover:text-black transition mr-2"
            >
              Home
            </button>
            <button
              onClick={() => navigate(-1)}
              className="py-2 px-4 bg-transparent border border-white text-white rounded-2xl hover:bg-white hover:text-black transition"
            >
              ← Back to Scorecard
            </button>
          </div>
          {/* Competition Info Section */}
          {comp && (
            <div className="text-white/90 text-base mb-4" style={{minWidth: 260, textAlign: 'left'}}>
              <span className="font-semibold">Date:</span> {comp.date ? (new Date(comp.date).toLocaleDateString('en-GB')) : '-'} <br />
              <span className="font-semibold">Type:</span> {COMP_TYPE_DISPLAY[comp.type] || comp.type || ''} <br />
              <span className="font-semibold">Course:</span> {comp.course || '-'} <br />
              <span className="font-semibold">Handicap Allowance:</span> {comp.handicapallowance && comp.handicapallowance !== 'N/A' ? comp.handicapallowance + '%' : 'N/A'} <br />
              <span className="font-semibold">Notes:</span> {comp.notes || '-'}
              {/* Good Scores section */}
              <div className="mt-4 mb-2 text-white text-base font-semibold" style={{maxWidth: '100%', textAlign: 'left'}}>
                <div style={{marginBottom: 4, marginLeft: 0, textDecoration: 'underline', textUnderlineOffset: 3}}>Good Scores</div>
                {goodScores.length === 0
                  ? <div style={{marginLeft: 0}}>No one. Everyone shit.</div>
                  : goodScores.map(p => (
                      <div key={p.name} style={{marginBottom: 2, marginLeft: 0}}>{p.name.toUpperCase()}: Net {p.dthNet}</div>
                    ))}
              </div>
            </div>
          )}
          {/* Leaderboard Table */}
          {leaderboardRows.length === 0 ? (
            <div className="text-white/80">No scores submitted yet.</div>
          ) : (
            <table className="min-w-full border text-center mb-8" style={{ fontFamily: 'Lato, Arial, sans-serif', background: '#002F5F', color: 'white', borderColor: '#FFD700' }}>
              <thead>
                <tr style={{ background: '#00204A' }}>
                  <th className="border px-2 py-0.5" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Pos</th>
                  <th className="border px-2 py-0.5" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Name</th>
                  <th className="border px-2 py-0.5" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Thru</th>
                  <th className="border px-2 py-0.5" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Gross</th>
                  <th className="border px-2 py-0.5" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Net</th>
                  <th className="border px-2 py-0.5" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>DTH Net</th>
                  <th className="border px-2 py-0.5" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Dog</th>
                  <th className="border px-2 py-0.5" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Waters</th>
                  <th className="border px-2 py-0.5" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>2 Clubs</th>
                  <th className="border px-2 py-0.5" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Fines</th>
                </tr>
              </thead>
              <tbody>
                {leaderboardRows.map((entry, idx) => (
                  <tr key={entry.name} className={idx % 2 === 0 ? 'bg-white/5' : ''}>
                    <td className="border px-2 py-0.5 font-bold">{entry.position}</td>
                    <td className="border px-2 py-0.5 text-left" style={{ textTransform: 'uppercase' }}>{entry.name.toUpperCase()}</td>
                    <td className="border px-2 py-0.5">{entry.thru}</td>
                    <td className="border px-2 py-0.5">{entry.total}</td>
                    <td className="border px-2 py-0.5">{entry.net}</td>
                    <td className="border px-2 py-0.5">{entry.dthNet}</td>
                    <td className="border px-2 py-0.5">{entry.dog ? '🐶' : ''}</td>
                    <td className="border px-2 py-0.5">{entry.waters || ''}</td>
                    <td className="border px-2 py-0.5">{entry.twoClubs || ''}</td>
                    <td className="border px-2 py-0.5">{entry.fines || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </PageBackground>
  );
}

export default MedalLeaderboard;