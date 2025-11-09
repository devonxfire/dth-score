import React, { useEffect, useState, useRef } from 'react';
import { apiUrl } from './api';
import PageBackground from './PageBackground';
import TopMenu from './TopMenu';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const COMP_TYPE_DISPLAY = {
  alliance: 'Alliance',
};

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
  { number: 18, par: 4, index: 8 }
];

// Helper: when competition provides holes, use those (map stroke_index -> index). Otherwise fall back to defaultHoles.

function getPlayingHandicap(entry, comp) {
  const ch = parseFloat(entry.handicap || 0);
  const allowanceRaw = comp?.handicapallowance ?? comp?.handicapAllowance ?? 100;
  const allowance = parseFloat(allowanceRaw) || 100;
  return Math.round(ch * (allowance / 100));
}

    function stablefordPoints(net, par) {
      if (net == null || Number.isNaN(net)) return 0;
      if (net <= par - 4) return 6;
      if (net === par - 3) return 5;
      if (net === par - 2) return 4;
      if (net === par - 1) return 3;
      if (net === par) return 2;
      if (net === par + 1) return 1;
      return 0;
    }

    export default function AllianceLeaderboard() {
      const [comp, setComp] = useState(null);
      const [groups, setGroups] = useState([]);
      const [entries, setEntries] = useState([]);
      const [backendTeamPointsMap, setBackendTeamPointsMap] = useState({});
      const exportRef = useRef(null);
      const [loading, setLoading] = useState(true);
      const [currentUser, setCurrentUser] = useState(null);
      const [editingNotes, setEditingNotes] = useState(false);
      const [notesDraft, setNotesDraft] = useState('');

      useEffect(() => {
        try { const raw = localStorage.getItem('user'); if (raw) setCurrentUser(JSON.parse(raw)); } catch (e) {}
        const id = window.location.pathname.split('/').pop();
        setLoading(true);
        fetch(apiUrl(`/api/competitions/${id}`))
          .then(res => res.ok ? res.json() : null)
          .then(async data => {
            if (!data) return setLoading(false);
            setComp(data);
            setGroups(Array.isArray(data.groups) ? data.groups : []);
            const usersList = Array.isArray(data.users) ? data.users : [];
            const built = [];
            if (Array.isArray(data.groups)) {
              data.groups.forEach((group, groupIdx) => {
                if (Array.isArray(group.players)) {
                  group.players.forEach((name, i) => {
                    const scores = group.scores?.[name] || Array(18).fill('');
                    const handicap = group.handicaps?.[name] ?? '';
                    const gross = scores.reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0);
                    const matchedUser = usersList.find(u => typeof u.name === 'string' && u.name.trim().toLowerCase() === (name || '').trim().toLowerCase());
                    const userId = matchedUser?.id || null;
                    const displayNameFromUser = matchedUser?.displayName || matchedUser?.display_name || matchedUser?.displayname || '';
                    const nickFromUser = matchedUser?.nick || matchedUser?.nickname || '';
                    const waters = group.waters?.[name] ?? '';
                    const dog = group.dog?.[name] ?? false;
                    const twoClubs = group.two_clubs?.[name] ?? group.twoClubs?.[name] ?? '';
                    const fines = group.fines?.[name] ?? '';
                    const teamId = group.teamId || group.id || group.team_id || group.group_id || null;
                    built.push({ name, scores, total: gross || 0, handicap, groupIdx, userId, displayName: displayNameFromUser, nick: nickFromUser, waters, dog, twoClubs, fines, teamId });
                  });
                }
              });
            }
            setEntries(built);

            // Gather all underlying team ids. For 4BBB groups the API may return group.teamIds (array of two team ids) so
            // include those as well.
            const teamIds = Array.from(new Set([].concat(...(data.groups || []).map(g => {
              if (!g) return [];
              if (Array.isArray(g.teamIds) && g.teamIds.length > 0) return g.teamIds.filter(Boolean);
              const t = (g.teamId || g.id || g.team_id || g.group_id);
              return t ? [t] : [];
            }))));
            if (teamIds.length > 0) {
              // Try fetching all teams for this competition in one request (server exposes /api/teams?competitionId=...)
              fetch(apiUrl(`/api/teams?competitionId=${data.id}`))
                .then(res => res.ok ? res.json() : null)
                .then(allTeams => {
                  if (allTeams && Array.isArray(allTeams)) {
                    const map = {};
                    (allTeams || []).forEach(t => {
                      if (t && t.id != null) map[t.id] = t.team_points ?? t.teamPoints ?? null;
                    });
                    setBackendTeamPointsMap(map);
                    return;
                  }
                  // Fallback: fetch individual team rows (older servers may not support the query)
                  return Promise.all(teamIds.map(tid => fetch(apiUrl(`/api/teams/${tid}`)).then(r => r.ok ? r.json() : null).then(t => [tid, t ? (t.team_points ?? (t.team_points === 0 ? t.team_points : (t.team_points || t.teamPoints || null))) : null]).catch(() => [tid, null])));
                })
                .then(results => {
                  if (!results) return;
                  const map = {};
                  results.forEach(([tid, pts]) => { if (tid) map[tid] = pts; });
                  setBackendTeamPointsMap(map);
                })
                .catch(() => {
                  // Network error: attempt individual fetches as a last resort
                  Promise.all(teamIds.map(tid => fetch(apiUrl(`/api/teams/${tid}`)).then(r => r.ok ? r.json() : null).then(t => [tid, t ? (t.team_points ?? (t.team_points === 0 ? t.team_points : (t.team_points || t.teamPoints || null))) : null]).catch(() => [tid, null])))
                    .then(results => {
                      const map = {};
                      results.forEach(([tid, pts]) => { if (tid) map[tid] = pts; });
                      setBackendTeamPointsMap(map);
                    })
                    .catch(() => {});
                });
            }
            setLoading(false);
          })
          .catch(() => setLoading(false));
      }, []);

      // Use holes from competition payload when available, otherwise defaultHoles
      const holesArr = (comp && Array.isArray(comp.holes) && comp.holes.length === 18)
        ? comp.holes.map(h => ({ number: h.number, par: Number(h.par), index: (h.stroke_index != null ? Number(h.stroke_index) : (h.index != null ? Number(h.index) : undefined)) }))
        : defaultHoles;

          // when comp is loaded, seed notesDraft
          useEffect(() => {
            setNotesDraft(comp?.notes || '');
          }, [comp]);

          function isCaptain(user, competition) {
            if (!user || !competition) return false;
            // support several possible captain conventions
            const capNames = [competition.captain, competition.captainName, competition.captain_name].filter(Boolean).map(s => String(s).trim().toLowerCase());
            if (capNames.length === 0) return false;
            const username = (user.username || user.name || '').toString().trim().toLowerCase();
            if (!username) return false;
            return capNames.includes(username);
          }

          function canEditNotes(user, competition) {
            return isAdmin(user) || isCaptain(user, competition);
          }

          async function saveNotes() {
            if (!comp || !comp.id) return;
            const url = apiUrl(`/api/competitions/${comp.id}`);
            try {
              const adminSecret = import.meta.env.VITE_ADMIN_SECRET || window.REACT_APP_ADMIN_SECRET || '';
              const res = await fetch(url, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  ...(adminSecret ? { 'X-Admin-Secret': adminSecret } : {})
                },
                body: JSON.stringify({ notes: notesDraft })
              });
              if (!res.ok) {
                const txt = await res.text();
                alert('Failed to save notes: ' + res.status + ' ' + txt);
                return;
              }
              const updated = await res.json();
              setComp(prev => ({ ...prev, notes: updated.notes ?? notesDraft }));
              setEditingNotes(false);
            } catch (err) {
              console.error('saveNotes error', err);
              alert('Failed to save notes: ' + (err.message || err));
            }
          }

      function playerStableford(entry) {
        const ph = getPlayingHandicap(entry, comp);
        const perHole = Array(18).fill(null);
        let total = 0;
        for (let i = 0; i < 18; i++) {
          const raw = entry.scores?.[i];
          const gross = raw === '' || raw == null ? NaN : parseInt(raw, 10);
          if (!Number.isFinite(gross)) { perHole[i] = null; continue; }
          let strokesReceived = 0;
          const hole = holesArr[i];
          const idxVal = hole && (hole.index != null) ? Number(hole.index) : undefined;
          if (ph > 0) {
            if (ph >= 18) {
              strokesReceived = 1;
              if ((ph - 18) >= idxVal) strokesReceived = 2;
              else if (idxVal <= (ph % 18)) strokesReceived = 2;
            } else if (idxVal <= ph) {
              strokesReceived = 1;
            }
          }
          const net = gross - strokesReceived;
          const pts = stablefordPoints(net, hole ? hole.par : defaultHoles[i].par);
          perHole[i] = pts;
          total += pts;
        }
        return { perHole, total };
      }

      function compactDisplayName(entry) {
        if (!entry) return '';
        if (entry.displayName && entry.displayName.trim()) return entry.displayName.trim();
        if (entry.nick && entry.nick.trim()) return entry.nick.trim();
        if (entry.name && typeof entry.name === 'string') {
          const m = entry.name.match(/\(([^)]+)\)/);
          if (m && m[1]) return m[1].trim();
          const q = entry.name.match(/"([^\"]+)"/);
          if (q && q[1]) return q[1].trim();
          const s = entry.name.match(/'([^']+)'/);
          if (s && s[1]) return s[1].trim();
          return '';
        }
        return '';
      }

      function isAdmin(user) {
        return user && (user.role === 'admin' || user.isAdmin || user.isadmin || (user.username && ['devon','arno','arno_cap'].includes(user.username.toLowerCase())) );
      }

      async function saveFines(teamId, userId, fines, playerName, compId) {
        try {
          if (teamId && userId) {
            const adminSecret = import.meta.env.VITE_ADMIN_SECRET || window.REACT_APP_ADMIN_SECRET || '';
            const url = apiUrl(`/api/teams/${teamId}/users/${userId}`);
            const body = { fines: fines !== '' && fines != null ? Number(fines) : null };
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
              alert('Failed to save fines: ' + res.status + ' ' + text);
              return;
            }
            const data = await res.json();
            setEntries(es => es.map(e => (e.teamId === teamId && e.userId === userId) ? { ...e, fines: data.fines ?? (fines !== '' ? fines : '') } : e));
            return;
          }
          if (!compId || !playerName) {
            alert('Cannot save fines: missing team/user and insufficient fallback data');
            return;
          }
          const url = apiUrl(`/api/competitions/${compId}/players/${encodeURIComponent(playerName)}/fines`);
          const body = { fines: fines !== '' && fines != null ? Number(fines) : null };
          const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          if (!res.ok) {
            const text = await res.text();
            alert('Fallback save failed: ' + res.status + ' ' + text);
            return;
          }
          const data = await res.json();
          setEntries(es => es.map(e => (e.name === playerName ? { ...e, fines: data.fines ?? (fines !== '' ? fines : '') } : e)));
        } catch (err) {
          console.error('Failed to save fines', err);
          alert('Failed to save fines: ' + (err.message || err));
        }
      }

      function buildTeams() {
        const compTypeStr = (comp && String(comp.type || '').toLowerCase()) || '';
        const compNameStr = (comp && String(comp.name || comp.title || '').toLowerCase()) || '';
        const isFourBbbComp = comp && (
          compTypeStr.includes('4bbb') || compTypeStr.includes('fourbbb') || compTypeStr.includes('fourball') || compTypeStr.includes('4bb') || compTypeStr.includes('4-ball') || !!comp.fourballs ||
          compNameStr.includes('4bbb') || compNameStr.includes('fourbbb') || compNameStr.includes('fourball') || compNameStr.includes('4bb') || compNameStr.includes('4-ball') || compNameStr.includes('four-ball')
        );

        const teams = [];
        (groups || []).forEach((group, idx) => {
          const groupPlayers = (group.players || []).map((name, i) => {
            let ent = entries.find(e => (e.name || '').trim().toLowerCase() === (name || '').trim().toLowerCase());
            if (!ent && Array.isArray(group.displayNames) && group.displayNames[i]) {
              const guestName = group.displayNames[i].trim().toLowerCase();
              ent = entries.find(e => (e.name || '').trim().toLowerCase() === guestName);
            }
            if (!ent) {
              const scores = group.scores?.[name] || Array(18).fill('');
              const handicap = group.handicaps?.[name] ?? '';
              const gross = scores.reduce((s, v) => s + (parseInt(v, 10) || 0), 0);
              ent = { name, scores, total: gross, handicap, groupIdx: idx };
            }
            const ch = ent.handicap !== '' ? parseFloat(ent.handicap) || 0 : 0;
            const ph = getPlayingHandicap(ent, comp);
            const dthNet = (ent.total || 0) - ch;
            const stable = playerStableford(ent);
            return {
              name: ent.name,
              displayName: ent.displayName || '',
              userId: ent.userId || null,
              teamId: ent.teamId || null,
              waters: ent.waters || '',
              dog: ent.dog || false,
              twoClubs: ent.twoClubs || '',
              fines: ent.fines || '',
              scores: ent.scores || Array(18).fill(''),
              gross: ent.total || 0,
              ph,
              ch,
              net: (ent.total || 0) - ph,
              dthNet,
              points: stable.total,
              perHole: stable.perHole
            };
          });
          // If this is a 4BBB competition (or a 4-player group with explicit teamIds) split into two 2-player teams (A+B and C+D)
          if ((isFourBbbComp || (Array.isArray(group.teamIds) && group.teamIds.length >= 2)) && Array.isArray(groupPlayers) && groupPlayers.length === 4) {
            const pairA = [groupPlayers[0], groupPlayers[1]];
            const pairB = [groupPlayers[2], groupPlayers[3]];

            const computeTeamPointsForPlayers = (playersArr) => {
              // For a 2-player pair (4BBB), team points are the better ball per hole (max of the two players).
              // For larger groups (e.g., Alliance), the team points are the sum of the best two players per hole.
              const perHole = Array(18).fill(0).map((_, hIdx) => {
                const vals = playersArr.map(p => (p.perHole && Number.isFinite(p.perHole[hIdx]) ? p.perHole[hIdx] : 0));
                vals.sort((a,b) => b - a);
                if (playersArr.length === 2) {
                  return vals[0] || 0; // best-one (better ball)
                }
                // sum top two for groups larger than 2
                return (vals[0] || 0) + (vals[1] || 0);
              });
              const front = perHole.slice(0,9).reduce((s, v) => s + (v || 0), 0);
              const back = perHole.slice(9,18).reduce((s, v) => s + (v || 0), 0);
              return front + back;
            };

            // backend team ids may be provided as group.teamIds (array)
            const teamIdA = Array.isArray(group.teamIds) && group.teamIds.length > 0 ? group.teamIds[0] : (group.teamId || group.id || group.team_id || null);
            const teamIdB = Array.isArray(group.teamIds) && group.teamIds.length > 1 ? group.teamIds[1] : null;

            const backendA = teamIdA ? backendTeamPointsMap[teamIdA] : null;
            const backendB = teamIdB ? backendTeamPointsMap[teamIdB] : null;
            const computedA = computeTeamPointsForPlayers(pairA);
            const computedB = computeTeamPointsForPlayers(pairB);

            // Prefer the computed BB score for display when there's a mismatch with DB for 2-player pairs
            const chosenA = (typeof backendA === 'number' && backendA === computedA) ? backendA : computedA;
            const chosenB = (typeof backendB === 'number' && backendB === computedB) ? backendB : computedB;

            // Build debug per-hole arrays (max per-hole for pair)
            const perHoleBestA = Array(18).fill(0).map((_, i) => Math.max((pairA[0].perHole?.[i] || 0), (pairA[1].perHole?.[i] || 0)));
            const perHoleBestB = Array(18).fill(0).map((_, i) => Math.max((pairB[0].perHole?.[i] || 0), (pairB[1].perHole?.[i] || 0)));
            teams.push({ groupIdx: idx, players: pairA, teamPoints: chosenA, computedTeamPoints: computedA, backendTeamPoints: (typeof backendA === 'number' ? backendA : undefined), teeTime: group.teeTime || '', teamId: teamIdA, debug: { perHoleBest: perHoleBestA, playersPerHole: [(pairA[0].perHole || []), (pairA[1].perHole || [])] } });
            teams.push({ groupIdx: idx, players: pairB, teamPoints: chosenB, computedTeamPoints: computedB, backendTeamPoints: (typeof backendB === 'number' ? backendB : undefined), teeTime: group.teeTime || '', teamId: teamIdB, debug: { perHoleBest: perHoleBestB, playersPerHole: [(pairB[0].perHole || []), (pairB[1].perHole || [])] } });
          } else {
            const perHoleBestTwo = Array(18).fill(0).map((_, hIdx) => {
              const vals = groupPlayers.map(p => (p.perHole && Number.isFinite(p.perHole[hIdx]) ? p.perHole[hIdx] : 0));
              vals.sort((a,b) => b - a);
              return (vals[0] || 0) + (vals[1] || 0);
            });
            const front = perHoleBestTwo.slice(0,9).reduce((s, v) => s + (v || 0), 0);
            const back = perHoleBestTwo.slice(9,18).reduce((s, v) => s + (v || 0), 0);
            const teamPoints = front + back;
            const backendPoints = (group && (group.teamId || group.id || group.team_id || group.group_id)) ? backendTeamPointsMap[(group.teamId || group.id || group.team_id || group.group_id)] : null;
            teams.push({ groupIdx: idx, players: groupPlayers, teamPoints: (typeof backendPoints === 'number' ? backendPoints : teamPoints), computedTeamPoints: teamPoints, teeTime: group.teeTime || '', teamId: (group.teamId || group.id || group.team_id || group.group_id) });
          }
        });
        teams.sort((a,b) => b.teamPoints - a.teamPoints);
        let lastPoints = null;
        let lastPos = 0;
        const ranked = teams.map((t, i) => {
          if (i === 0) { lastPos = 1; lastPoints = t.teamPoints; return { ...t, pos: 1 }; }
          if (t.teamPoints === lastPoints) return { ...t, pos: lastPos };
          lastPos = lastPos + 1; lastPoints = t.teamPoints; return { ...t, pos: lastPos };
        });
        return ranked;
      }

      if (loading) return <PageBackground><TopMenu userComp={comp} competitionList={comp ? [comp] : []} /><div className="p-8 text-white">Loading leaderboard...</div></PageBackground>;

      const teams = buildTeams();
      // DEBUG: expose the teams array the UI is rendering and backend team points map so we can inspect them in the browser console.
      // Remove this after verification.
      try {
        if (typeof window !== 'undefined') {
          window.__dth_ui_teams = teams;
          window.__dth_backendTeamPointsMap = backendTeamPointsMap || {};
          // eslint-disable-next-line no-console
          console.log('AllianceLeaderboard: UI teams', teams, 'backendTeamPointsMap', window.__dth_backendTeamPointsMap);
        }
      } catch (e) { /* ignore */ }

      async function exportToPDF() {
        try {
          const element = exportRef.current;
          if (!element) { alert('Export area not found'); return; }
          const canvas = await html2canvas(element, { scale: 2, useCORS: true });
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          try {
            const d = comp?.date ? new Date(comp.date) : new Date();
            const y = String(d.getFullYear());
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const datePart = `${y}${m}${dd}`;
            const compTypeDisplay = (COMP_TYPE_DISPLAY[comp?.type] || comp?.type || '').toString().toUpperCase();
            const typePart = compTypeDisplay.replace(/[^A-Z0-9 ]/g, '').trim().replace(/\s+/g, '_') || 'COMPETITION';
            const filename = `${datePart}_DTH_LEADERBOARD_${typePart}.pdf`;
            pdf.save(filename);
          } catch (e) {
            pdf.save(`${(comp?.name || 'results').replace(/[^a-z0-9_-]/gi, '_')}_leaderboard.pdf`);
          }
        } catch (err) {
          console.error('Export to PDF failed', err);
          try { exportPlainPDF(); return; } catch (e) { console.error('Fallback export failed', e); }
          alert('Failed to export PDF. Try using the browser Print -> Save as PDF.');
        }
      }

      function exportPlainPDF() {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const margin = 10; const lineHeight = 7;
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        let y = margin;
        pdf.setFontSize(12); pdf.setTextColor(0,0,0);
        pdf.text(`${(comp?.name) || 'Competition'} - Leaderboard`, margin, y); y += lineHeight;
        pdf.setFontSize(10);
        let formattedDate = '-';
        if (comp?.date) {
          try { const d = new Date(comp.date); if (!isNaN(d.getTime())) { const dd = String(d.getDate()).padStart(2,'0'); const mm = String(d.getMonth()+1).padStart(2,'0'); const yyyy = d.getFullYear(); formattedDate = `${dd}/${mm}/${yyyy}`; } } catch (e) { formattedDate = comp?.date || '-'; }
        }
        pdf.text(`Date: ${formattedDate}`, margin, y); y += lineHeight * 1.2;
        const allowanceText = comp?.handicapallowance && comp.handicapallowance !== 'N/A' ? `${comp.handicapallowance}%` : (comp?.handicapallowance === 'N/A' ? 'N/A' : '100%');
        const courseText = comp?.club || comp?.course || '-';
        pdf.text(`Course: ${courseText}`, margin, y); pdf.text(`Handicap Allowance: ${allowanceText}`, margin + 80, y); y += lineHeight * 1.2;
        pdf.text(`Notes: ${comp?.notes || '-'}`, margin, y); y += lineHeight * 1.2;

  const rows = [];
  teams.forEach(team => { team.players.forEach(p => { const holesPlayed = (p.perHole && p.perHole.filter(v => v != null).length) || (p.scores && p.scores.filter(s => s && s !== '').length) || 0; const thru = holesPlayed === 18 ? 'F' : holesPlayed; rows.push({ pos: team.pos, teamPoints: team.teamPoints, teeTime: team.teeTime, name: p.name, displayName: p.displayName || '', userId: p.userId || null, teamId: team.teamId || null, dog: p.dog || false, waters: p.waters || '', twoClubs: p.twoClubs || '', fines: p.fines || '', gross: p.gross, net: p.net, dthNet: p.dthNet, points: p.points, thru }); }); });

        const goodScores = rows.filter(r => typeof r.dthNet === 'number' && r.dthNet < 70 && r.thru === 'F');
        pdf.setFont(undefined, 'bold'); pdf.text('Good Scores', margin, y); y += lineHeight; pdf.setFont(undefined, 'normal');
        if (goodScores && goodScores.length > 0) { goodScores.forEach(p => { if (y > pageHeight - margin - lineHeight) { pdf.addPage(); y = margin; } const displayName = (p.displayName || p.name || '').toUpperCase(); pdf.text(`${displayName}: Net ${p.dthNet}`, margin, y); y += lineHeight; }); } else { pdf.text('No one. Everyone shit.', margin, y); y += lineHeight; }
        y += lineHeight * 0.5;

        const headers = ['Pos','Name','Thru','Score','Gross','Net','DTH Net','Dog','Waters','2Clubs','Fines'];
        const colWidths = [12,60,12,18,18,18,18,10,18,18,18];
        let x = margin; pdf.setFont(undefined,'bold'); headers.forEach((h,i)=>{ pdf.text(h, x, y); x += colWidths[i] || 20; }); pdf.setFont(undefined,'normal'); y += lineHeight;

        rows.forEach(r => { if (y > pageHeight - margin - lineHeight) { pdf.addPage(); y = margin; } let x = margin; const display = (r.displayName || r.name || '').toUpperCase(); const rowValues = [r.pos, display, String(r.thru), String(r.teamPoints), String(r.gross || ''), String(r.net || ''), String(r.dthNet || ''), r.dog ? 'Y' : '', r.waters || '', r.twoClubs || '', r.fines || '']; rowValues.forEach((val,i)=>{ let text = String(val || ''); if (i === 1 && text.length > 24) text = text.slice(0,21) + '...'; pdf.text(text, x, y); x += colWidths[i] || 20; }); y += lineHeight; });

        try {
          const d = comp?.date ? new Date(comp.date) : new Date();
          const y = String(d.getFullYear());
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          const datePart = `${y}${m}${dd}`;
          const compTypeDisplay = (COMP_TYPE_DISPLAY[comp?.type] || comp?.type || '').toString().toUpperCase();
          const typePart = compTypeDisplay.replace(/[^A-Z0-9 ]/g, '').trim().replace(/\s+/g, '_') || 'COMPETITION';
          const filename = `${datePart}_DTH_LEADERBOARD_${typePart}.pdf`;
          pdf.save(filename);
        } catch (e) {
          pdf.save(`${(comp?.name || 'results').replace(/[^a-z0-9_-]/gi, '_')}_leaderboard.pdf`);
        }
      }

  const rowsForUI = [];
  // Build per-player rows, but for team competitions (4BBB) show the team's BB score in the Score column
  teams.forEach(team => {
    (team.players || []).forEach(p => {
      const holesPlayed = (p.perHole && p.perHole.filter(v => v != null).length) || (p.scores && p.scores.filter(s => s && s !== '').length) || 0;
      const thru = holesPlayed === 18 ? 'F' : holesPlayed;
      // Use the team's teamPoints for the Score column so both teammates display the same BB Score
      rowsForUI.push({
        pos: team.pos,
        teamPoints: team.teamPoints,
        computedTeamPoints: team.computedTeamPoints ?? null,
        teeTime: team.teeTime,
        name: p.name,
        displayName: p.displayName || '',
        userId: p.userId || null,
        teamId: team.teamId || null,
        dog: p.dog || false,
        waters: p.waters || '',
        twoClubs: p.twoClubs || '',
        fines: p.fines || '',
        gross: p.gross,
        net: p.net,
        dthNet: p.dthNet,
        points: p.points,
        thru
      });
    });
  });

  // rowsForUI is built by iterating `teams` (already sorted by teamPoints and assigned positions).
  // Avoid re-sorting by individual player points here because that can separate teammates
  // who should appear together under the same team position. Keep the teams' order so
  // paired players remain adjacent and share the same Pos and Score (teamPoints).

      const goodScores = rowsForUI.filter(r => typeof r.dthNet === 'number' && r.dthNet < 70 && r.thru === 'F');

      return (
        <PageBackground>
          <TopMenu userComp={comp} competitionList={comp ? [comp] : []} />
          <div className="flex flex-col items-center px-4 mt-12" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>
            <h1 className="text-4xl font-extrabold drop-shadow-lg text-center mb-1 leading-tight flex items-end justify-center gap-2" style={{ color: '#0e3764', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
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
                <button onClick={() => exportToPDF()} className="py-2 px-4 bg-[#0e3764] text-[#FFD700] border border-[#FFD700] rounded-2xl hover:bg-[#FFD700] hover:text-[#0e3764] transition" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>Export Results</button>
              </div>

              {comp && (
                <div className="text-white/90 text-base mb-4" style={{minWidth: 260, textAlign: 'left'}}>
                  <span className="font-semibold">Date:</span> {comp.date ? (new Date(comp.date).toLocaleDateString('en-GB')) : '-'} <br />
                  <span className="font-semibold">Type:</span> {COMP_TYPE_DISPLAY[comp?.type] || (comp?.type ? comp.type.replace(/(^|\s|_)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase()).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/-/g, ' ').replace(/(Four\s+Bbb)/i, '4BBB') : '')} <br />
                  <span className="font-semibold">Course:</span> {comp?.club || comp?.course || '-'} <br />
                  <span className="font-semibold">Handicap Allowance:</span> {comp.handicapallowance && comp.handicapallowance !== 'N/A' ? comp.handicapallowance + '%' : 'N/A'} <br />

                  <div style={{ marginTop: 8, marginBottom: 6, textDecoration: 'underline', textUnderlineOffset: 3 }} className="font-semibold">Notes:</div>
                  {canEditNotes(currentUser, comp) ? (
                    editingNotes ? (
                      <div className="mt-2">
                        <textarea
                          value={notesDraft}
                          onChange={e => setNotesDraft(e.target.value)}
                          placeholder={notesDraft ? '' : 'Captain, click to add more notes...'}
                          className="w-full bg-white/5 text-white p-2 rounded resize-y h-24 focus:outline-none"
                        />
                        <div className="flex gap-2 mt-2">
                          <button onClick={saveNotes} className="py-1 px-3 bg-[#FFD700] text-[#002F5F] rounded font-semibold">Save</button>
                          <button onClick={() => { setNotesDraft(comp?.notes || ''); setEditingNotes(false); }} className="py-1 px-3 bg-transparent border border-white/20 rounded">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 cursor-text" onClick={() => setEditingNotes(true)}>
                        <div className="whitespace-pre-wrap">{comp.notes}</div>
                        <div className="text-white/60 italic mt-2">Captain, click to add more notes...</div>
                      </div>
                    )
                  ) : (
                    <div className="mt-2">{comp.notes || '-'}</div>
                  )}
                  <div className="mt-4 mb-2 text-white text-base font-semibold" style={{maxWidth: '100%', textAlign: 'left'}}>
                    <div style={{marginBottom: 4, marginLeft: 0, textDecoration: 'underline', textUnderlineOffset: 3}}>Good Scores</div>
                    {goodScores.length === 0 ? <div style={{marginLeft: 0}}>No one. Everyone shit.</div> : goodScores.map(p => (<div key={p.name} style={{marginBottom: 2, marginLeft: 0}}>{(p.displayName || p.name).toUpperCase()}: Net {p.dthNet}</div>))}
                  </div>
                </div>
              )}

              {rowsForUI.length === 0 ? (
                <div className="text-white/80">No scores submitted yet.</div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="min-w-full border text-center mb-8 text-[10px] sm:text-base" style={{ fontFamily: 'Lato, Arial, sans-serif', background: '#0e3764', color: 'white', borderColor: '#FFD700' }}>
                    <thead>
                      <tr style={{ background: '#00204A' }}>
                        <th className="border px-0.5 sm:px-2 py-0.5" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Pos</th>
                        <th className="border px-0.5 sm:px-2 py-0.5 text-left" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Name</th>
                        <th className="border px-0.5 sm:px-2 py-0.5" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Thru</th>
                        <th className="border px-0.5 sm:px-2 py-0.5" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Score</th>
                        <th className="border px-0.5 sm:px-2 py-0.5" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Gross</th>
                        <th className="border px-0.5 sm:px-2 py-0.5" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Net</th>
                        <th className="border px-0.5 sm:px-2 py-0.5" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>DTH Net</th>
                        <th className="border px-0.5 sm:px-2 py-0.5" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Dog</th>
                        <th className="border px-0.5 sm:px-2 py-0.5" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Waters</th>
                        <th className="border px-0.5 sm:px-2 py-0.5" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>2 Clubs</th>
                        <th className="border px-0.5 sm:px-2 py-0.5" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Fines</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowsForUI.map((entry, idx) => (
                        <tr key={`${entry.name}-${idx}`} className={idx % 2 === 0 ? 'bg-white/5' : ''}>
                          <td className="border px-0.5 sm:px-2 py-0.5 font-bold">{entry.pos}</td>
                          <td className="border px-0.5 sm:px-2 py-0.5 text-left" style={{ textTransform: 'uppercase' }}>
                            <div className="max-w-[8ch] sm:max-w-none truncate">{(compactDisplayName(entry) || entry.displayName || entry.name).toUpperCase()}</div>
                          </td>
                          <td className="border px-0.5 sm:px-2 py-0.5">{entry.thru}</td>
                          <td className="border px-0.5 sm:px-2 py-0.5">{entry.teamPoints}{(entry.backendTeamPoints !== undefined && entry.backendTeamPoints !== entry.teamPoints) ? ` (db ${entry.backendTeamPoints})` : (entry.computedTeamPoints != null && entry.computedTeamPoints !== entry.teamPoints ? ` (calc ${entry.computedTeamPoints})` : '')}</td>
                          <td className="border px-0.5 sm:px-2 py-0.5">{entry.gross}</td>
                          <td className="border px-0.5 sm:px-2 py-0.5">{entry.net}</td>
                          <td className="border px-0.5 sm:px-2 py-0.5">{entry.dthNet}</td>
                          <td className="border px-0.5 sm:px-2 py-0.5">{entry.dog ? '🐶' : ''}</td>
                          <td className="border px-0.5 sm:px-2 py-0.5">{entry.waters || ''}</td>
                          <td className="border px-0.5 sm:px-2 py-0.5">{entry.twoClubs || ''}</td>
                          <td className="border px-0.5 sm:px-2 py-0.5">
                            {isAdmin(currentUser) ? (
                              <input
                                type="number"
                                min="0"
                                value={entry.fines || ''}
                                onChange={e => {
                                  const v = e.target.value;
                                  setEntries(es => es.map(x => x.name === entry.name ? { ...x, fines: v } : x));
                                  saveFines(entry.teamId, entry.userId, v, entry.name, comp?.id || null);
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
                </div>
              )}

            </div>
          </div>
        </PageBackground>
      );
    }
