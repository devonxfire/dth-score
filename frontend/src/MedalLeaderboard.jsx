import React, { useEffect, useState, useRef } from 'react';
import { useBackendTeams } from './hooks/useBackendTeams';
import { useLocation, useNavigate } from 'react-router-dom';
import PageBackground from './PageBackground';
import TopMenu from './TopMenu';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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

function MedalLeaderboard() {
  const [entries, setEntries] = useState([]);
  const [comp, setComp] = useState(null);
  const [groups, setGroups] = useState([]);
  const [compId, setCompId] = useState(null);
  const exportRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  // Get comp id from URL if using react-router
  const id = location.pathname.split('/').pop();

  useEffect(() => {
    // Load current user from localStorage if present
    try {
      const raw = localStorage.getItem('user');
      if (raw) setCurrentUser(JSON.parse(raw));
    } catch (e) {}
    // Fetch competition and scores for this comp
    fetch(`/api/competitions/${id}`)
      .then(res => res.json())
      .then(data => {
        setComp(data);
        setGroups(Array.isArray(data.groups) ? data.groups : []);
        // Flatten all players in all groups into leaderboard entries
        const entries = [];
  const usersList = Array.isArray(data.users) ? data.users : [];
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
    // find matching user id if available
    const matchedUser = usersList.find(u => typeof u.name === 'string' && u.name.trim().toLowerCase() === (name || '').trim().toLowerCase());
    const userId = matchedUser?.id || null;
    const teamId = group.teamId || group.id || group.team_id || group.group_id || null;
                entries.push({
                  name,
                  scores,
                  total: gross || '',
                  waters,
                  dog,
                  twoClubs,
                  fines,
                  handicap,
                  teebox,
      teamId,
      userId,
                  groupIdx
                });
              });
            }
          });
        }
  console.debug('Built leaderboard entries (name -> teamId,userId):', entries.map(e => ({ name: e.name, teamId: e.teamId, userId: e.userId })));
  setEntries(entries);
        // If we have teamId/userId for entries, fetch their persisted fines from the teams API
        (async () => {
          try {
            const updated = await Promise.all(entries.map(async ent => {
              if (!ent.teamId || !ent.userId) return ent;
              try {
                const res = await fetch(`/api/teams/${ent.teamId}/users/${ent.userId}`);
                if (!res.ok) return ent;
                const data = await res.json();
                return { ...ent, fines: data.fines ?? ent.fines };
              } catch (e) {
                return ent;
              }
            }));
            setEntries(updated);
          } catch (e) {
            console.error('Failed to fetch persisted fines for entries', e);
          }
        })();
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
  // Use entry.handicap and comp.handicapallowance for correct PH
  const ch = parseFloat(entry.handicap || 0);
  const allowance = comp?.handicapallowance ? parseFloat(comp.handicapallowance) : 100;
  return Math.round(ch * (allowance / 100));
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

  // Export visible leaderboard area to PDF
  async function exportToPDF() {
    try {
      const element = exportRef.current;
      if (!element) {
        alert('Export area not found');
        return;
      }
      // Use html2canvas to render the element
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${(comp?.name || 'results').replace(/[^a-z0-9_-]/gi, '_')}_leaderboard.pdf`);
    } catch (err) {
      console.error('Export to PDF failed', err);
      console.warn('Falling back to text-only PDF export');
      try {
        exportPlainPDF();
        return;
      } catch (e) {
        console.error('Fallback export failed', e);
      }
      alert('Failed to export PDF. Try using the browser Print -> Save as PDF.');
    }
  }

  // Fallback: generate a simple text PDF using jsPDF (no images/styles)
  function exportPlainPDF() {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const margin = 10;
    const lineHeight = 7;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let y = margin;
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`${(comp?.name) || 'Competition'} - Leaderboard`, margin, y);
    y += lineHeight;
    pdf.setFontSize(10);
    // Robust date formatting to DD/MM/YYYY
    let formattedDate = '-';
    if (comp?.date) {
      try {
        const d = new Date(comp.date);
        if (!isNaN(d.getTime())) {
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const yyyy = d.getFullYear();
          formattedDate = `${dd}/${mm}/${yyyy}`;
        }
      } catch (e) {
        formattedDate = formatDate(comp?.date);
      }
    }
    pdf.text(`Date: ${formattedDate}`, margin, y);
    // Include competition type (friendly display if available)
    const compTypeDisplay = COMP_TYPE_DISPLAY[comp?.type] || comp?.type || '';
    if (compTypeDisplay) {
      pdf.text(`Type: ${compTypeDisplay}`, margin + 80, y);
    }
    y += lineHeight * 1.2;

    // Course, Handicap Allowance, Notes
  const courseText = comp?.club || comp?.course || '-';
    const allowanceText = comp?.handicapallowance && comp.handicapallowance !== 'N/A' ? `${comp.handicapallowance}%` : (comp?.handicapallowance === 'N/A' ? 'N/A' : '100%');
    const notesText = comp?.notes || '-';
    pdf.text(`Course: ${courseText}`, margin, y);
    pdf.text(`Handicap Allowance: ${allowanceText}`, margin + 80, y);
    y += lineHeight * 1.2;
    pdf.text(`Notes: ${notesText}`, margin, y);
    y += lineHeight * 1.2;

    // Good Scores header
    pdf.setFont(undefined, 'bold');
    pdf.text('Good Scores', margin, y);
    y += lineHeight;
    pdf.setFont(undefined, 'normal');
    // Print good scores (use leaderboardRows filtered earlier)
    if (goodScores && goodScores.length > 0) {
      goodScores.forEach(p => {
        if (y > pageHeight - margin - lineHeight) {
          pdf.addPage();
          y = margin;
        }
        const line = `${p.name.toUpperCase()}: Net ${p.dthNet}`;
        pdf.text(line, margin, y);
        y += lineHeight;
      });
    } else {
      pdf.text('No one. Everyone shit.', margin, y);
      y += lineHeight;
    }
    y += lineHeight * 0.5;

    // Table header
    const headers = ['Pos', 'Name', 'Thru', 'Gross', 'Net', 'DTH Net', 'Dog', 'Waters', '2Clubs', 'Fines'];
    const colWidths = [12, 60, 12, 18, 18, 18, 10, 18, 18, 18];
    let x = margin;
    pdf.setFont(undefined, 'bold');
    headers.forEach((h, i) => {
      pdf.text(h, x, y);
      x += colWidths[i] || 20;
    });
    pdf.setFont(undefined, 'normal');
    y += lineHeight;

    // Rows
    leaderboardRows.forEach(r => {
      if (y > pageHeight - margin - lineHeight) {
        pdf.addPage();
        y = margin;
      }
      let x = margin;
      const rowValues = [r.position, r.name, String(r.thru), String(r.total), String(r.net), String(r.dthNet), r.dog ? 'Y' : '', r.waters || '', r.twoClubs || '', r.fines || ''];
      rowValues.forEach((val, i) => {
        // truncate long names
        let text = String(val || '');
        if (i === 1 && text.length > 24) text = text.slice(0, 21) + '...';
        pdf.text(text, x, y);
        x += colWidths[i] || 20;
      });
      y += lineHeight;
    });

    pdf.save(`${(comp?.name || 'results').replace(/[^a-z0-9_-]/gi, '_')}_leaderboard_text.pdf`);
  }

  // Determine if any player has played less than 18 holes
  const showThru = entries.some(e => (e.scores?.filter(s => s && s !== '').length || 0) < 18);

  function isAdmin(user) {
    return user && (user.role === 'admin' || user.isAdmin || user.isadmin || (user.username && ['devon','arno','arno_cap'].includes(user.username.toLowerCase())) );
  }
  async function saveFines(teamId, userId, fines, playerName, compId) {
    try {
      if (teamId && userId) {
        const adminSecret = import.meta.env.VITE_ADMIN_SECRET || window.REACT_APP_ADMIN_SECRET || '';
        const url = `/api/teams/${teamId}/users/${userId}`;
        const body = { fines: fines !== '' && fines != null ? Number(fines) : null };
        console.log('Saving fines', { url, body });
        const res = await fetch(url, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(adminSecret ? { 'X-Admin-Secret': adminSecret } : {})
          },
          body: JSON.stringify(body)
        });
        if (!res.ok) {
          const text = await res.text();
          console.error('Failed to save fines, response not ok', res.status, text);
          alert('Failed to save fines: ' + res.status + ' ' + text);
          return;
        }
        const data = await res.json();
        console.log('Saved fines response', data);
        setEntries(es => es.map(e => (e.teamId === teamId && e.userId === userId) ? { ...e, fines: data.fines ?? (fines !== '' ? fines : '') } : e));
        return;
      }
      // fallback
      if (!compId || !playerName) {
        console.warn('Fallback saveFines missing compId or playerName', { compId, playerName });
        alert('Cannot save fines: missing team/user and insufficient fallback data');
        return;
      }
      const url = `/api/competitions/${compId}/players/${encodeURIComponent(playerName)}/fines`;
      const body = { fines: fines !== '' && fines != null ? Number(fines) : null };
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const text = await res.text();
        console.error('Fallback save failed', res.status, text);
        alert('Fallback save failed: ' + res.status + ' ' + text);
        return;
      }
      const data = await res.json();
      console.log('Fallback saved fines', data);
      setEntries(es => es.map(e => (e.name === playerName ? { ...e, fines: data.fines ?? (fines !== '' ? fines : '') } : e)));
    } catch (err) {
      console.error('Failed to save fines', err);
      alert('Failed to save fines: ' + (err.message || err));
    }
  }

  // Compute leaderboard rows with position, thru, dthNet, etc.
  const leaderboardRows = entries.map(entry => {
    const holesPlayed = entry.scores?.filter(s => s && s !== '').length || 0;
    let thru = holesPlayed === 18 ? 'F' : holesPlayed;
  // Course Handicap (CH) entered manually
  const ch = entry.handicap !== '' ? parseFloat(entry.handicap) || 0 : 0;
  // Playing Handicap (PH) = CH * allowance%
  const allowance = comp?.handicapallowance ? parseFloat(comp.handicapallowance) : 100;
  const ph = Math.round(ch * (allowance / 100));
    // DTH Net = Gross - CH
    const dthNet = entry.total - ch;
  // Net = gross total minus playing handicap (PH). For full rounds this equals sum(gross - strokesReceived).
  const totalGross = parseInt(entry.total || 0);
  const net = totalGross - ph;
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
  <div className="flex flex-col items-center px-4 mt-12" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>
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
        <div ref={exportRef} className="w-full max-w-4xl rounded-2xl shadow-lg bg-transparent text-white mb-8" style={{ backdropFilter: 'none' }}>
          <div className="flex justify-center mb-4">
            <button
              onClick={() => { exportToPDF(); }}
              className="py-2 px-4 bg-[#002F5F] text-[#FFD700] border border-[#FFD700] rounded-2xl hover:bg-[#FFD700] hover:text-[#002F5F] transition"
              style={{ fontFamily: 'Lato, Arial, sans-serif' }}
            >
              Export Results
            </button>
          </div>
          {/* Competition Info Section */}
          {comp && (
            <div className="text-white/90 text-base mb-4" style={{minWidth: 260, textAlign: 'left'}}>
              <span className="font-semibold">Date:</span> {comp.date ? (new Date(comp.date).toLocaleDateString('en-GB')) : '-'} <br />
              <span className="font-semibold">Type:</span> {COMP_TYPE_DISPLAY[comp.type] || comp.type || ''} <br />
              <span className="font-semibold">Course:</span> {comp?.club || comp?.course || '-'} <br />
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
                    <td className="border px-2 py-0.5">
                      {isAdmin(currentUser) ? (
                        <input
                          type="number"
                          min="0"
                          value={entry.fines || ''}
                          onChange={e => {
                            const v = e.target.value;
                            // optimistic UI
                            setEntries(es => es.map(x => x.name === entry.name ? { ...x, fines: v } : x));
                            // save immediately; pass player name and comp id for fallback when team/user ids are missing
                            saveFines(entry.teamId, entry.userId, v, entry.name, comp?.id || id);
                          }}
                          className="w-12 text-center text-white bg-transparent rounded focus:outline-none font-semibold no-spinner"
                          style={{ border: 'none', MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none' }}
                        />
                      ) : (
                        entry.fines || ''
                      )}
                    </td>
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