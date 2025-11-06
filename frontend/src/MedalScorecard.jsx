import React, { useEffect, useState, useRef } from 'react';
import { apiUrl } from './api';
import socket from './socket';
import { shouldShowPopup, markShown, checkAndMark } from './popupDedupe';
import { toast } from './simpleToast';
import PageBackground from './PageBackground';
import TopMenu from './TopMenu';
import { useParams, useNavigate } from 'react-router-dom';

const defaultHoles = [
  { number: 1, par: 4, index: 5 }, { number: 2, par: 4, index: 7 }, { number: 3, par: 3, index: 17 }, { number: 4, par: 5, index: 1 }, { number: 5, par: 4, index: 11 },
  { number: 6, par: 3, index: 15 }, { number: 7, par: 5, index: 3 }, { number: 8, par: 4, index: 13 }, { number: 9, par: 4, index: 9 }, { number: 10, par: 4, index: 10 },
  { number: 11, par: 4, index: 4 }, { number: 12, par: 4, index: 12 }, { number: 13, par: 5, index: 2 }, { number: 14, par: 4, index: 14 }, { number: 15, par: 3, index: 18 },
  { number: 16, par: 5, index: 6 }, { number: 17, par: 3, index: 16 }, { number: 18, par: 4, index: 8 }
];
const playerColors = [
  'bg-blue-100 text-blue-900',
  'bg-green-100 text-green-900',
  'bg-yellow-100 text-yellow-900',
  'bg-pink-100 text-pink-900'
];

export default function MedalScorecard(props) {
  // Helper to send PATCH requests with an X-Origin-Socket header when possible
  async function patchWithOrigin(url, body) {
    const headers = { 'Content-Type': 'application/json' };
    try { if (socket && socket.id) headers['X-Origin-Socket'] = socket.id; } catch (e) {}
    return fetch(url, { method: 'PATCH', headers, body: JSON.stringify(body) });
  }
  // Helper: compute Playing Handicap (PH) from Course Handicap (CH) using competition allowance
  const computePH = (ch) => {
    const allowance = comp?.handicapallowance ?? comp?.handicapAllowance ?? 100;
    const parsedCh = parseFloat(ch) || 0;
    return Math.round(parsedCh * (parseFloat(allowance) / 100));
  };
  // Stableford mapping: given net (strokes relative to par) and par, return points
  const stablefordPoints = (net, par) => {
    if (net == null || Number.isNaN(net)) return 0;
    if (net <= par - 4) return 6;
    if (net === par - 3) return 5;
    if (net === par - 2) return 4;
    if (net === par - 1) return 3;
    if (net === par) return 2;
    if (net === par + 1) return 1;
    return 0;
  };

  // Show a local toast and emit client-popup for other clients.
  function showLocalPopup({ type, name, holeNumber, sig }) {
    try {
  let emoji = '🎉';
  let title = 'Nice!';
  let body = name || '';
  // Use 5s autoClose for all toasts unless explicitly disabled
  let autoClose = 5000;
  if (type === 'eagle') { emoji = '🦅'; title = 'Eagle!'; body = `For ${name || ''} — Hole ${holeNumber || ''}`; if (navigator.vibrate) navigator.vibrate([200,100,200]); }
  else if (type === 'birdie') { emoji = '🕊️'; title = 'Birdie!'; body = `For ${name || ''} — Hole ${holeNumber || ''}`; if (navigator.vibrate) navigator.vibrate([100,50,100]); }
  else if (type === 'blowup') { emoji = '💥'; title = 'How Embarrassing!'; body = `${name || ''} just blew up on Hole ${holeNumber || ''}`; if (navigator.vibrate) navigator.vibrate([400,100,400]); }
  else if (type === 'waters') { emoji = '💧'; title = 'Splash!'; body = `${name || ''} has earned a water`; }
  else if (type === 'dog') { emoji = '🐶'; title = 'Woof!'; body = `${name || ''} got the dog`; }

      const content = (
        <div className="flex flex-col items-center" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: 8 }}>{emoji}</div>
          <div style={{ fontWeight: 800, color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', fontSize: '1.4rem' }}>{title}</div>
          <div style={{ color: 'white', fontFamily: 'Lato, Arial, sans-serif', fontSize: '1.05rem' }}>{body}</div>
        </div>
      );
  try { toast(content, { toastId: sig || `${type}:${name}:${holeNumber}:${compId}`, autoClose, position: 'top-center', closeOnClick: true }); } catch (e) {}
  // mark as shown locally so dedupe prevents the server rebroadcast from hiding the optimistic toast
  try { if (sig) markShown(sig); } catch (e) {}
      // Inform server to rebroadcast to other clients (server will dedupe and attach originSocketId)
      try { socket.emit('client-popup', { competitionId: Number(compId), type, playerName: name, holeNumber: holeNumber || null, signature: sig }); } catch (e) {}
    } catch (e) {}
  }

  // Compute per-player stableford totals (front/back/total) and per-hole points array
  const computePlayerStablefordTotals = (name) => {
    const perHole = Array(18).fill(null);
    let front = 0;
    let back = 0;
    let total = 0;
    const playingHandicap = computePH(playerData[name]?.handicap) || 0;
    defaultHoles.forEach((hole, idx) => {
      const raw = playerData[name]?.scores?.[idx];
      const gross = raw === '' || raw == null ? NaN : parseInt(raw, 10);
      if (!Number.isFinite(gross)) {
        perHole[idx] = null;
        return;
      }
      // compute strokes received using same logic as medal net
      let strokesReceived = 0;
      if (playingHandicap > 0) {
        if (playingHandicap >= 18) {
          strokesReceived = 1;
          if (playingHandicap - 18 >= hole.index) strokesReceived = 2;
          else if (hole.index <= (playingHandicap % 18)) strokesReceived = 2;
        } else if (hole.index <= playingHandicap) {
          strokesReceived = 1;
        }
      }
      const net = gross - strokesReceived;
      const pts = stablefordPoints(net, hole.par);
      perHole[idx] = pts;
      if (idx < 9) front += pts;
      else back += pts;
      total += pts;
    });
    return { perHole, front, back, total };
  };
  // Compute group/team best-two stableford totals (sum of the best two players)
  const computeGroupBestTwoTotals = (group) => {
    // Return per-hole best-two sums as well as front/back/total sums.
    if (!group || !Array.isArray(group.players)) return { perHole: Array(18).fill(0), front: 0, back: 0, total: 0 };
    const playerTotals = group.players.map(name => computePlayerStablefordTotals(name) || { perHole: Array(18).fill(null), front: 0, back: 0, total: 0 });
    // Build per-hole best-two sums
    const perHole = Array(18).fill(0).map((_, idx) => {
      const vals = playerTotals.map(t => (t.perHole && Number.isFinite(t.perHole[idx]) ? t.perHole[idx] : 0));
      vals.sort((a,b) => b - a);
      // sum top two
      return (vals[0] || 0) + (vals[1] || 0);
    });
    const front = perHole.slice(0,9).reduce((s,v) => s + (v || 0), 0);
    const back = perHole.slice(9,18).reduce((s,v) => s + (v || 0), 0);
    const total = front + back;
    return { perHole, front, back, total };
  };
  // ...existing code...
  // ...existing code...
  // Tee Box/Handicap modal bypass: always show scorecard, modal logic enforced
  // Modal logic removed: always render scorecard UI
  const params = useParams();
  const navigate = useNavigate();
  const compId = params.id;
  // Resolve current user (try props.user then localStorage) and admin flag
  let resolvedUser = props.user;
  if (!resolvedUser) {
    try { resolvedUser = JSON.parse(localStorage.getItem('user')); } catch (e) { resolvedUser = null; }
  }
  const resolvedName = (resolvedUser && (resolvedUser.name || resolvedUser.displayName || (resolvedUser.firstName ? `${resolvedUser.firstName} ${resolvedUser.lastName || ''}` : null))) || null;
  const isAdmin = !!(resolvedUser && (resolvedUser.role === 'admin' || resolvedUser.isAdmin || resolvedUser.isadmin));
  const isCaptain = !!(resolvedUser && (resolvedUser.role === 'captain' || resolvedUser.isCaptain || resolvedUser.iscaptain));
  // Allow edits when:
  // - viewer is admin
  // - OR viewer is a member of the current 4-ball (they can edit any player's data)
  const canEdit = (playerName) => {
    if (isAdmin) return true;
    if (!resolvedName) return false;
    try {
      const normViewer = resolvedName.trim().toLowerCase();
      // if viewer is in the current players list, allow edits for anyone in that group
      if (Array.isArray(players) && players.some(p => (p || '').trim().toLowerCase() === normViewer)) return true;
      // otherwise only allow editing own row (fallback)
      return (playerName || '').trim().toLowerCase() === normViewer;
    } catch (e) {
      return false;
    }
  };
  const [comp, setComp] = useState(null);
  const [groups, setGroups] = useState([]);
  const [groupIdx, setGroupIdx] = useState(0);
  const [players, setPlayers] = useState([]);
  const [playerData, setPlayerData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState({});
  const [miniTableStats, setMiniTableStats] = useState({});
  const watersTimeoutRef = useRef(null);
  const [showWatersPopup, setShowWatersPopup] = useState(false);
  const [watersPlayer, setWatersPlayer] = useState(null);
  const [showDogPopup, setShowDogPopup] = useState(false);
  const [dogPlayer, setDogPlayer] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  // Mobile selected player for compact score entry
  const [mobileSelectedPlayer, setMobileSelectedPlayer] = useState('');
  // Persist mobile-selected hole per-competition so refresh/navigation restores last-edited hole.
  const storageKey = compId ? `dth:mobileSelectedHole:${compId}` : 'dth:mobileSelectedHole:unknown';
  const [mobileSelectedHole, setMobileSelectedHole] = useState(() => {
    try {
      const raw = compId ? localStorage.getItem(`dth:mobileSelectedHole:${compId}`) : null;
      const n = raw ? parseInt(raw, 10) : NaN;
      if (Number.isFinite(n) && n >= 1 && n <= 18) return n;
    } catch (e) {}
    return 1;
  });

  // Keep localStorage in sync when compId changes (switching competitions) — load saved hole for new comp.
  useEffect(() => {
    try {
      if (!compId) return;
      const raw = localStorage.getItem(`dth:mobileSelectedHole:${compId}`);
      const n = raw ? parseInt(raw, 10) : NaN;
      if (Number.isFinite(n) && n >= 1 && n <= 18) {
        setMobileSelectedHole(n);
      } else {
        setMobileSelectedHole(1);
      }
    } catch (e) {}
  }, [compId]);

  // Persist whenever mobileSelectedHole changes
  useEffect(() => {
    try {
      if (!compId) return;
      localStorage.setItem(`dth:mobileSelectedHole:${compId}`, String(mobileSelectedHole));
    } catch (e) {}
  }, [compId, mobileSelectedHole]);

  // Per-cell styling for gross score inputs: eagle (<= par-2) => pink, birdie (par-1) => green,
  // blowup (>= par+3) => maroon. Returns an inline style object to merge into the input's style.
  function scoreCellStyle(name, idx) {
    try {
      const raw = playerData?.[name]?.scores?.[idx];
      const gross = raw === '' || raw == null ? NaN : parseInt(raw, 10);
      const hole = defaultHoles[idx];
  if (!Number.isFinite(gross) || !hole) return {};
  // Outline-only styles: transparent background, colored 2px border and matching text color
  if (gross <= hole.par - 2) return { background: 'transparent', border: '2px solid #FFC0CB', color: '#FFC0CB', boxSizing: 'border-box' }; // pink outline
  if (gross === hole.par - 1) return { background: 'transparent', border: '2px solid #16a34a', color: '#16a34a', boxSizing: 'border-box' }; // green outline
  if (gross >= hole.par + 3) return { background: 'transparent', border: '2px solid #ef4444', color: '#ef4444', boxSizing: 'border-box' }; // brighter red outline
    } catch (e) {
      return {};
    }
    return {};
  }

  // Return extra class names for score cells (used to make eagle/birdie circular)
  function scoreCellClass(name, idx) {
    try {
      const raw = playerData?.[name]?.scores?.[idx];
      const gross = raw === '' || raw == null ? NaN : parseInt(raw, 10);
      const hole = defaultHoles[idx];
      if (!Number.isFinite(gross) || !hole) return '';
      // circle for eagle or birdie
      if (gross <= hole.par - 2) return 'rounded-full';
      if (gross === hole.par - 1) return 'rounded-full';
    } catch (e) {
      return '';
    }
    return '';
  }

  useEffect(() => {
    if (!players || !players.length) return;
    if (mobileSelectedPlayer) return;
    // If viewer is admin or captain, keep default as Player A (players[0])
    if (isAdmin || isCaptain) {
      setMobileSelectedPlayer(players[0]);
      return;
    }
    // Prefer selecting the logged-in player when present in the group
    if (resolvedName) {
      const normalize = s => (s || '').toString().toLowerCase().replace(/["'()]/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
      const viewerNorm = normalize(resolvedName);
      let match = null;
      for (const p of players) {
        const pNorm = normalize(p);
        // exact match
        if (pNorm === viewerNorm) { match = p; break; }
        // viewer name contained in player name (handles nicknames removed)
        if (pNorm.includes(viewerNorm) || viewerNorm.includes(pNorm)) { match = p; break; }
        // match by last name token
        const pParts = pNorm.split(' ').filter(Boolean);
        const vParts = viewerNorm.split(' ').filter(Boolean);
        if (pParts.length && vParts.length && pParts[pParts.length - 1] === vParts[vParts.length - 1]) { match = p; break; }
      }
      setMobileSelectedPlayer(match || players[0]);
    } else {
      setMobileSelectedPlayer(players[0]);
    }
  }, [players, mobileSelectedPlayer, resolvedName, isAdmin, isCaptain]);

  // Fetch comp info and groups
  useEffect(() => {
    if (!compId) return;
    setLoading(true);
    fetch(apiUrl(`/api/competitions/${compId}`))
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setComp(data);
          setGroups(Array.isArray(data.groups) ? data.groups : []);
          if (Array.isArray(data.groups) && data.groups.length > 0) {
            setPlayers(data.groups[groupIdx]?.players || []);
          }
        }
        setLoading(false);
      });
  }, [compId, groupIdx]);

  // Default non-admin viewers to the group they are playing in (admins keep current selection)
  useEffect(() => {
    if (!groups || !groups.length) return;
    if (isAdmin) return; // admins can pick any group
    if (!resolvedName) return;
    const normalize = (s) => (s || '').toString().trim().toLowerCase();
    const foundIdx = groups.findIndex(g => Array.isArray(g.players) && g.players.some(p => normalize(p) === normalize(resolvedName)));
    if (foundIdx >= 0 && foundIdx !== groupIdx) {
      setGroupIdx(foundIdx);
    }
  }, [groups, resolvedName, isAdmin]);

  // Real-time: join competition room and listen for updates
  useEffect(() => {
    if (!compId) return;
    const compNum = Number(compId);
    try { socket.emit('join', { competitionId: compNum }); } catch (e) {}

    const handler = (msg) => {
      try {
        if (!msg || Number(msg.competitionId) !== compNum) return;

        

        // If a full group object is included (medal-player-updated), merge into groups
        if (msg.group && (msg.groupId != null)) {
          console.debug && console.debug('[socket-debug] medal-player-updated received', { groupId: msg.groupId, group: msg.group });
          // Log current local playerData snapshot for debugging
          try { console.debug && console.debug('[socket-debug] local playerData snapshot before merge', playerDataRef.current); } catch (e) {}
          const gidx = Number(msg.groupId);
          // Capture prior local scores snapshot from playerDataRef so we can detect changes
          const prevScores = {};
          try {
            const pd = playerDataRef.current || {};
            for (const nm of msg.group.players || []) {
              prevScores[nm] = Array.isArray(pd[nm]?.scores) ? pd[nm].scores.slice() : Array(18).fill('');
            }
          } catch (e) { /* ignore */ }

          setGroups(prev => {
            try {
              const copy = Array.isArray(prev) ? [...prev] : [];
              copy[gidx] = msg.group;
              return copy;
            } catch (e) { return prev; }
          });
          // Update playerData and miniTableStats if scores/waters present in payload
          if (msg.group.scores) {
            setPlayerData(prev => {
              try {
                const copy = { ...(prev || {}) };
                const names = msg.group.players || [];
                for (const name of names) {
                  const s = msg.group.scores?.[name];
                  if (Array.isArray(s)) {
                    copy[name] = { ...(copy[name] || {}), scores: s.map(v => v == null ? '' : String(v)) };
                  }
                }
                return copy;
              } catch (e) { return prev; }
            });
            // schedule popup checks for any changed scores compared to prior local snapshot
            try {
              const names = msg.group.players || [];
              for (const name of names) {
                const newArr = msg.group.scores?.[name];
                const oldArr = Array.isArray(prevScores[name]) ? prevScores[name] : Array(18).fill('');
                if (!Array.isArray(newArr)) continue;
                for (let i = 0; i < newArr.length; i++) {
                  const oldVal = oldArr[i] == null ? '' : String(oldArr[i]);
                  const newVal = newArr[i] == null ? '' : String(newArr[i]);
                  if (oldVal !== newVal) {
                    schedulePopupCheck(name, i, newArr[i]);
                  }
                }
              }
            } catch (e) {}
          }
          if (msg.group.waters || msg.group.dog) {
            setMiniTableStats(prev => {
              try {
                const copy = { ...(prev || {}) };
                const names = msg.group.players || [];
                for (const name of names) {
                  copy[name] = {
                    waters: msg.group.waters?.[name] ?? copy[name]?.waters ?? '',
                    dog: msg.group.dog?.[name] ?? copy[name]?.dog ?? false,
                    twoClubs: msg.group.two_clubs?.[name] ?? copy[name]?.twoClubs ?? ''
                  };
                }
                return copy;
              } catch (e) { return prev; }
            });
          }
          return;
        }

        // If server sent mappedScores delta, apply to playerData
        if (Array.isArray(msg.mappedScores) && msg.mappedScores.length > 0 && comp) {
          // helper: schedule the same delayed popup checks we use for local edits
          function schedulePopupCheck(name, idx, strokes) {
            try {
              const gross = parseInt(strokes, 10);
              const hole = defaultHoles[idx];
              if (!gross || !hole) return;
              if (gross === hole.par - 2) {
                if (eagleShowDelayRef.current) clearTimeout(eagleShowDelayRef.current);
                eagleShowDelayRef.current = setTimeout(() => {
                  const latest = parseInt(playerDataRef.current?.[name]?.scores?.[idx], 10);
                  if (latest === gross) {
                  const sig = `eagle:${name}:${hole.number}:${compId}`;
                            showLocalPopup({ type: 'eagle', name, holeNumber: hole.number, sig });
                }
                }, 2000);
              } else {
                if (eagleShowDelayRef.current) { clearTimeout(eagleShowDelayRef.current); eagleShowDelayRef.current = null; }
              }
              if (gross === hole.par - 1) {
                if (birdieShowDelayRef.current) clearTimeout(birdieShowDelayRef.current);
                birdieShowDelayRef.current = setTimeout(() => {
                  const latest = parseInt(playerDataRef.current?.[name]?.scores?.[idx], 10);
            if (latest === gross) {
            const sig = `birdie:${name}:${hole.number}:${compId}`;
              showLocalPopup({ type: 'birdie', name, holeNumber: hole.number, sig });
          }
                }, 2000);
              } else {
                if (birdieShowDelayRef.current) { clearTimeout(birdieShowDelayRef.current); birdieShowDelayRef.current = null; }
              }
              if (gross >= hole.par + 3) {
                if (blowupShowDelayRef.current) clearTimeout(blowupShowDelayRef.current);
                blowupShowDelayRef.current = setTimeout(() => {
                  const latest = parseInt(playerDataRef.current?.[name]?.scores?.[idx], 10);
                  if (latest === gross) {
                    const sig = `blowup:${name}:${hole.number}:${compId}`;
                    if (checkAndMark(sig)) {
                      try { showLocalPopup({ type: 'blowup', name, holeNumber: hole.number, sig }); } catch (e) {}
                    }
                  }
                }, 2000);
              } else {
                if (blowupShowDelayRef.current) { clearTimeout(blowupShowDelayRef.current); blowupShowDelayRef.current = null; }
              }
            } catch (e) {}
          }

          setPlayerData(prev => {
            try {
              const copy = { ...(prev || {}) };
              for (const ms of msg.mappedScores) {
                const userId = ms.userId ?? ms.user_id ?? ms.user;
                const holeIdx = ms.holeIndex ?? ms.hole_index ?? ms.hole;
                const strokes = ms.strokes ?? ms.value ?? '';
                if (userId == null || holeIdx == null) continue;
                const u = comp.users?.find(u => Number(u.id) === Number(userId));
                const name = u?.name;
                if (!name) continue;
                const pd = copy[name] || { scores: Array(18).fill(''), teebox: '', handicap: '' };
                const arr = Array.isArray(pd.scores) ? [...pd.scores] : Array(18).fill('');
                try {
                  const key = `${name}:${holeIdx}`;
                  const pending = pendingLocalSavesRef.current[key];
                  const strokeStr = strokes == null ? '' : String(strokes);
                  if (pending) {
                    const age = Date.now() - (pending.ts || 0);
                    // If server confirms our pending value, clear pending and skip (local already set)
                    if (String(pending.value) === strokeStr) {
                      try { debugLog('mappedScores: server confirms pending', { key, strokeStr, age }); } catch (e) {}
                      delete pendingLocalSavesRef.current[key];
                      continue;
                    }
                    // If we have a very recent local save, ignore the server update to avoid
                    // overwriting our newer local edit with a stale/late-arriving value.
                    if (age < 5000) {
                      try { debugLog('mappedScores: skipping server update due to recent local pending', { key, strokeStr, age, pending: pending.value }); } catch (e) {}
                      continue;
                    }
                  }
                } catch (e) {}
                arr[holeIdx] = strokes == null ? '' : String(strokes);
                copy[name] = { ...pd, scores: arr };
              }
              return copy;
            } catch (e) { console.error('Error applying mappedScores to playerData', e); return prev; }
          });

          // schedule popup checks after playerData is updated (use the provided mappedScores)
          try {
            for (const ms of msg.mappedScores) {
              const userId = ms.userId ?? ms.user_id ?? ms.user;
              const holeIdx = ms.holeIndex ?? ms.hole_index ?? ms.hole;
              const strokes = ms.strokes ?? ms.value ?? '';
              if (userId == null || holeIdx == null) continue;
              const u = comp.users?.find(u => Number(u.id) === Number(userId));
              const name = u?.name;
              if (!name) continue;
              schedulePopupCheck(name, Number(holeIdx), strokes);
            }
          } catch (e) {}

          return;
        }

        // Fallback: refetch full competition data
        fetch(apiUrl(`/api/competitions/${compNum}`))
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (data) { setComp(data); setGroups(Array.isArray(data.groups) ? data.groups : []); } })
          .catch(() => {});
      } catch (e) { console.error('Socket handler error', e); }
    };

    socket.on('scores-updated', handler);
    socket.on('medal-player-updated', handler);
    socket.on('team-user-updated', handler);
    socket.on('fines-updated', handler);

    return () => {
      try { socket.emit('leave', { competitionId: compNum }); } catch (e) {}
      socket.off('scores-updated', handler);
      socket.off('medal-player-updated', handler);
      socket.off('team-user-updated', handler);
      socket.off('fines-updated', handler);
    };
  }, [compId]);

  // Fetch player data for current group (always trust backend)
  useEffect(() => {
    if (!compId || !groups.length) return;
    let cancelled = false;
    async function fetchAllScores() {
      const group = groups[groupIdx];
      if (!group || !Array.isArray(group.players)) return;
      const newData = {};
      const newMiniStats = {};
      for (const name of group.players) {
        const res = await fetch(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`));
        if (res.ok) {
          const data = await res.json();
          newData[name] = {
            teebox: data.teebox ?? '',
            handicap: data.handicap ?? '',
            scores: Array.isArray(data.scores) ? data.scores.map(v => v == null ? '' : v) : Array(18).fill('')
          };
          newMiniStats[name] = {
            waters: data.waters ?? '',
            dog: !!data.dog,
            twoClubs: data.two_clubs ?? ''
          };
        } else {
          newData[name] = { teebox: '', handicap: '', scores: Array(18).fill('') };
          newMiniStats[name] = { waters: '', dog: false, twoClubs: '' };
        }
      }
      if (!cancelled) {
        setPlayers(group.players);
        setPlayerData(newData);
        setMiniTableStats(newMiniStats);
      }
    }
    fetchAllScores();
    return () => { cancelled = true; };
  }, [compId, groups, groupIdx]);

  // Fetch mini table stats for all players
  useEffect(() => {
    async function fetchStats() {
      if (!players.length) return;
      const stats = {};
      for (const name of players) {
        try {
          const res = await fetch(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`));
          if (res.ok) {
            const data = await res.json();
            stats[name] = {
              waters: data.waters ?? '',
              dog: !!data.dog,
              twoClubs: data.two_clubs ?? ''
            };
          } else {
            stats[name] = { waters: '', dog: false, twoClubs: '' };
          }
        } catch {
          stats[name] = { waters: '', dog: false, twoClubs: '' };
        }
      }
      setMiniTableStats(stats);
    }
    fetchStats();
  }, [players, compId, groupIdx]);

  // Save player data
  async function handleSavePlayer(name) {
    if (!canEdit(name)) return;
    setSaving(prev => ({ ...prev, [name]: true }));
    setError('');
    const data = playerData[name];
    const mini = miniTableStats[name] || {};
  try {
      const res = await patchWithOrigin(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`), {
        teebox: data.teebox,
        handicap: data.handicap,
        scores: data.scores,
        waters: mini.waters ?? '',
        dog: mini.dog ?? false,
        two_clubs: mini.twoClubs ?? ''
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error('Save failed:', errText);
        throw new Error('Failed to save: ' + errText);
      }
      
      try {
        // Immediately notify server to rebroadcast this saved medal update so other
        // clients see popups instantly (optimistic global popups). The server will
        // rebroadcast this as `medal-player-updated` to the competition room.
  const payload = { competitionId: Number(compId), groupId: Number(groupIdx), playerName: name, group: groups[groupIdx], _clientBroadcast: true };
        try { socket.emit('client-medal-saved', payload); } catch (e) { /* ignore socket emit errors */ }
      } catch (e) { }
    } catch (e) {
      setError('Failed to save for ' + name + ': ' + (e.message || e));
      console.error('Save error:', e);
    } finally {
      setSaving(prev => ({ ...prev, [name]: false }));
    }
  }

  function handleChange(name, field, value) {
    if (!canEdit(name)) return;
    setPlayerData(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        [field]: value
      }
    }));
    // Persist teebox or handicap change immediately
    if (!compId || !groups.length) return;
    const patchBody = {};
    if (field === 'teebox') patchBody.teebox = value;
    if (field === 'handicap') patchBody.handicap = value;
    if (Object.keys(patchBody).length > 0) {
      patchWithOrigin(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`), patchBody).catch(() => {});
    }
  }

  // Birdie/Eagle/Blowup popup state
  const [showBirdie, setShowBirdie] = useState(false);
  const [birdieHole, setBirdieHole] = useState(null);
  const [birdiePlayer, setBirdiePlayer] = useState(null);
  const birdieTimeoutRef = useRef(null);
  const [showEagle, setShowEagle] = useState(false);
  const [eagleHole, setEagleHole] = useState(null);
  const [eaglePlayer, setEaglePlayer] = useState(null);
  const eagleTimeoutRef = useRef(null);
  const [showBlowup, setShowBlowup] = useState(false);
  const [blowupHole, setBlowupHole] = useState(null);
  const [blowupPlayer, setBlowupPlayer] = useState(null);
  const blowupTimeoutRef = useRef(null);
  // Delayed-show refs to avoid showing popups while user is rapidly changing values
  const birdieShowDelayRef = useRef(null);
  const eagleShowDelayRef = useRef(null);
  const blowupShowDelayRef = useRef(null);
  // Keep a ref copy of playerData so delayed callbacks can read latest values
  const playerDataRef = useRef(playerData);
  useEffect(() => { playerDataRef.current = playerData; }, [playerData]);
  // Track recent local per-hole saves so we can ignore short-lived server echoes
  // that might arrive out-of-order and overwrite a newer local edit.
  const pendingLocalSavesRef = useRef({});
  // Debounced save timers per player:hole to batch rapid clicks and avoid request reordering
  const saveTimeoutsRef = useRef({});
  // debug helper (enable by setting localStorage.setItem('dth:debug','1') in the browser)
  const debugLog = (...args) => {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem && localStorage.getItem('dth:debug') === '1') {
        // eslint-disable-next-line no-console
        console.debug('[dth-debug]', ...args);
      }
    } catch (e) {}
  };

  async function handleScoreChange(name, idx, value) {
    if (!canEdit(name)) return;
    // remember last-edited hole for this competition (so refresh/navigation returns here)
    try { setMobileSelectedHole(idx + 1); localStorage.setItem(`dth:mobileSelectedHole:${compId}`, String(idx + 1)); } catch (e) {}
    // mark this hole as a recent local save so we can ignore immediate server echoes
    try {
      const key = `${name}:${idx}`;
      const ts = Date.now();
      pendingLocalSavesRef.current[key] = { value: String(value), ts };
      // expire after 5s
      setTimeout(() => {
        try {
          if (pendingLocalSavesRef.current[key] && pendingLocalSavesRef.current[key].ts === ts) {
            delete pendingLocalSavesRef.current[key];
          }
        } catch (e) {}
      }, 5000);
    } catch (e) {}
    setPlayerData(prev => {
      const existing = Array.isArray(prev[name]?.scores) ? prev[name].scores : Array.from({ length: 18 }, () => '');
      const updatedScores = existing.map((v, i) => i === idx ? value : v);
      return {
        ...prev,
        [name]: {
          ...prev[name],
          scores: updatedScores
        }
      };
    });
    // Birdie/Eagle/Blowup detection logic
    const gross = parseInt(value, 10);
    const hole = defaultHoles[idx];
    if (gross > 0 && hole) {
      // Eagle (2 under)
            if (gross === hole.par - 2) {
        if (eagleShowDelayRef.current) clearTimeout(eagleShowDelayRef.current);
        eagleShowDelayRef.current = setTimeout(() => {
          const latest = parseInt(playerDataRef.current?.[name]?.scores?.[idx], 10);
          if (latest === gross) {
            const sig = `eagle:${name}:${hole.number}:${compId}`;
            if (checkAndMark(sig)) {
                      showLocalPopup({ type: 'eagle', name, holeNumber: hole.number, sig });
            }
          }
        }, 2000);
      } else {
        if (eagleShowDelayRef.current) { clearTimeout(eagleShowDelayRef.current); eagleShowDelayRef.current = null; }
      }

      // Birdie (1 under)
            if (gross === hole.par - 1) {
        if (birdieShowDelayRef.current) clearTimeout(birdieShowDelayRef.current);
        birdieShowDelayRef.current = setTimeout(() => {
          const latest = parseInt(playerDataRef.current?.[name]?.scores?.[idx], 10);
          if (latest === gross) {
            const sig = `birdie:${name}:${hole.number}:${compId}`;
            if (checkAndMark(sig)) {
                    showLocalPopup({ type: 'birdie', name, holeNumber: hole.number, sig });
            }
          }
        }, 2000);
      } else {
        if (birdieShowDelayRef.current) { clearTimeout(birdieShowDelayRef.current); birdieShowDelayRef.current = null; }
      }

      // Blowup (>= par + 3)
      if (gross >= hole.par + 3) {
        if (blowupShowDelayRef.current) clearTimeout(blowupShowDelayRef.current);
        blowupShowDelayRef.current = setTimeout(() => {
          const latest = parseInt(playerDataRef.current?.[name]?.scores?.[idx], 10);
                  if (latest === gross) {
            const sig = `blowup:${name}:${hole.number}:${compId}`;
                      showLocalPopup({ type: 'blowup', name, holeNumber: hole.number, sig });
          }
        }, 2000);
      } else {
        if (blowupShowDelayRef.current) { clearTimeout(blowupShowDelayRef.current); blowupShowDelayRef.current = null; }
      }
    }
    // Debounced save: schedule a small delay to batch rapid clicks and avoid request reordering.
    try {
      if (!compId || !groups.length) return;
      const key = `${name}:${idx}`;
      if (saveTimeoutsRef.current[key]) clearTimeout(saveTimeoutsRef.current[key]);
      debugLog('scheduling debounced save', { key, value, compId, groupIdx });
      saveTimeoutsRef.current[key] = setTimeout(async () => {
        try {
          debugLog('debounced save firing', { key, compId, groupIdx });
          // Read latest scores from ref (reflects any rapid local changes)
          const latestScores = playerDataRef.current?.[name]?.scores || Array.from({ length: 18 }, () => '');
          const newScores = Array.isArray(latestScores) ? latestScores.map(v => (v == null ? '' : v)) : Array(18).fill('');
          const res = await patchWithOrigin(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`), { scores: newScores });
          debugLog('server save result', { key, status: res && res.status });
          if (!res.ok) {
            const errText = await res.text();
            setError('Failed to save for ' + name + ': ' + errText);
          } else {
            // If server persisted the same value we had pending for this hole, clear pending marker
            try {
              const strokeStr = String(newScores[idx] ?? '');
              const pendingKey = `${name}:${idx}`;
              const pending = pendingLocalSavesRef.current[pendingKey];
              if (pending && String(pending.value) === strokeStr) delete pendingLocalSavesRef.current[pendingKey];
            } catch (e) {}
          }
        } catch (err) {
          setError('Failed to save for ' + name + ': ' + (err.message || err));
        } finally {
          try { delete saveTimeoutsRef.current[key]; } catch (e) {}
        }
  }, 500);
    } catch (err) {
      console.error('Error scheduling debounced save', err);
    }
  }

  // ...existing code...

  async function handleMiniTableChange(name, field, value) {
    if (!canEdit(name)) return;
    if (field === 'dog' && value) {
      // Only allow one player to have the dog
      setMiniTableStats(prev => {
        const updated = { ...prev };
        for (const player of players) {
          updated[player] = {
            ...updated[player],
            dog: player === name
          };
        }
        return updated;
      });
      // Persist dog=false for all others, dog=true for selected
      if (!compId || !groups.length) return;
      try {
        for (const player of players) {
          const patchBody = { dog: player === name };
          await patchWithOrigin(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(player)}`), patchBody);
        }
      } catch (err) {
        setError('Failed to save dog for group: ' + (err.message || err));
      }
    const sig = `dog:${name}:g:${groupIdx ?? ''}:c:${compId}`;
    if (checkAndMark(sig)) {
      // Show a local toast and ask server to rebroadcast to other clients
      try { showLocalPopup({ type: 'dog', name, sig }); } catch (e) {}
    }
      return;
    }
    // Normal update for other fields
    setMiniTableStats(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        [field]: value
      }
    }));
    // Persist mini table field to backend
    if (!compId || !groups.length) return;
    try {
      const patchBody = {};
      if (field === 'waters') patchBody.waters = value;
      if (field === 'twoClubs') patchBody.two_clubs = value;
      await patchWithOrigin(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`), patchBody);
      // Re-fetch latest mini table data for sync
      const res = await fetch(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`));
      if (res.ok) {
        const data = await res.json();
        setMiniTableStats(prev => ({
          ...prev,
          [name]: {
            waters: data.waters ?? '',
            dog: !!data.dog,
            twoClubs: data.two_clubs ?? ''
          }
        }));
      }
    } catch (err) {
      setError('Failed to save mini table for ' + name + ': ' + (err.message || err));
    }
    // Show popups for Waters
    if (field === 'waters' && value && Number(value) > 0) {
    const sig = `waters:${name}:g:${groupIdx ?? ''}:c:${compId}`;
        if (checkAndMark(sig)) {
          try { showLocalPopup({ type: 'waters', name, sig }); } catch (e) {}
        }
      }
  }

  // Cleanup any pending timeouts on unmount
  useEffect(() => {
    return () => {
      [watersTimeoutRef, birdieTimeoutRef, eagleTimeoutRef, blowupTimeoutRef, birdieShowDelayRef, eagleShowDelayRef, blowupShowDelayRef].forEach(ref => {
        try { if (ref && ref.current) clearTimeout(ref.current); } catch (e) { /* ignore */ }
      });
    };
  }, []);

  if (loading) return <PageBackground><TopMenu {...props} /><div className="p-8 text-white">Loading...</div></PageBackground>;
  if (!groups.length) return <PageBackground><TopMenu {...props} /><div className="p-8 text-white">No groups found.</div></PageBackground>;

  async function handleConfirmReset() {
    // Clear gross scores for all players locally and persist to backend
    const cleared = {};
    for (const name of players) {
      cleared[name] = {
        ...playerData[name],
        scores: Array(18).fill('')
      };
    }
    setPlayerData(prev => ({ ...prev, ...cleared }));
    setShowResetModal(false);
    // Persist clears to backend (PATCH per player)
    try {
      for (const name of players) {
        await patchWithOrigin(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`), { scores: Array(18).fill(null) });
      }
    } catch (err) {
      console.error('Failed to persist cleared scores', err);
      setError('Failed to persist cleared scores: ' + (err.message || err));
    }
  }

  return (
    <PageBackground>
      <TopMenu {...props} userComp={comp} competitionList={comp ? [comp] : []} />
      <div className="flex flex-col items-center px-4 mt-12">
        <h1 className="text-4xl font-extrabold drop-shadow-lg text-center mb-4" style={{ color: '#002F5F', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>
          {props.overrideTitle || 'Medal Competition: Scorecard'}
        </h1>
        {/* Comp Info Section */}
        <div className="max-w-4xl w-full mb-4 p-4 rounded-xl border-2 border-[#FFD700] text-white" style={{ fontFamily: 'Lato, Arial, sans-serif', background: 'rgba(0,47,95,0.95)' }}>
          {/* Mobile: two columns each with two lines (visible on xs, hidden on sm+) */}
          <div className="flex w-full sm:hidden text-xs font-normal">
            <div className="w-1/2 pr-2">
              <div className="whitespace-normal">Date: <span className="font-bold" style={{ color: '#FFD700' }}>{comp?.date ? (new Date(comp.date).toLocaleDateString()) : '-'}</span></div>
              <div className="whitespace-normal">Club: <span className="font-bold" style={{ color: '#FFD700' }}>{comp?.club || '-'}</span></div>
            </div>
            <div className="w-1/2 pl-2">
              <div className="whitespace-normal">Allowance: <span className="font-bold" style={{ color: '#FFD700' }}>{comp?.handicapallowance ? comp.handicapallowance + '%' : '-'}</span></div>
            </div>
          </div>
          {/* Desktop/tablet: single-line row with three equal columns (hidden on xs, visible on sm+) */}
          <div className="hidden sm:flex w-full text-sm font-normal">
            <div className="flex-1 min-w-0 text-center">Date: <span className="font-bold" style={{ color: '#FFD700' }}>{comp?.date ? (new Date(comp.date).toLocaleDateString()) : '-'}</span></div>
            <div className="flex-1 min-w-0 text-center">Club: <span className="font-bold" style={{ color: '#FFD700' }}>{comp?.club || '-'}</span></div>
            <div className="flex-1 min-w-0 text-center">Allowance: <span className="font-bold" style={{ color: '#FFD700' }}>{comp?.handicapallowance ? comp.handicapallowance + '%' : '-'}</span></div>
          </div>
        </div>

        

        <div className="max-w-4xl w-full bg-[#002F5F] rounded-2xl shadow-2xl p-8 border-4 border-[#FFD700] text-white" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>
          {/* Group buttons removed above mini table */}
          {/* Mini Table for Waters, Dog, 2 Clubs, etc. */}
          <div className="flex flex-col items-start mb-6" style={{ gap: '1rem' }}>
            {/* Tee Time selector: admin-visible, placed immediately above the Handicaps table */}
            <div className="w-full flex items-center justify-center mb-2">
              <div className="text-sm text-white mr-3">Tee Time:</div>
              {isAdmin && groups && groups.length > 1 ? (
                <select
                  value={groupIdx}
                  onChange={e => setGroupIdx(Number(e.target.value))}
                  className="inline-block bg-transparent text-white font-bold rounded px-3 py-1 h-8 align-middle"
                  style={{ border: '1px solid #FFD700', lineHeight: '1.5' }}
                >
                  {groups.map((g, i) => (
                    <option key={i} value={i} style={{ color: '#002F5F' }}>{g.teeTime ? `${g.teeTime} — 4 Ball ${i + 1}` : `4 Ball ${i + 1}`}</option>
                  ))}
                </select>
              ) : (
                <div className="font-bold" style={{ color: '#FFD700' }}>{groups[groupIdx]?.teeTime || '-'}</div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
              <h3 className="text-sm font-semibold text-white mb-2 text-center">Handicaps and Tees</h3>
              <table className="w-full min-w-[300px] border text-white text-xs sm:text-sm rounded" style={{ fontFamily: 'Lato, Arial, sans-serif', background: '#002F5F', color: 'white', borderColor: '#FFD700' }}>
            <thead>
                <tr>
                <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}></th>
                <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Name</th>
                <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Tee</th>
                <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>CH</th>
                <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>PH</th>
                <th className="hidden sm:table-cell border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Waters</th>
                <th className="hidden sm:table-cell border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Dog</th>
                <th className="hidden sm:table-cell border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>2 Clubs</th>
              </tr>
            </thead>
            <tbody>
                {players.map((name, idx) => (
                  <tr key={name}>
                    <td className={`border border-white px-2 py-1 font-bold text-center align-middle ${playerColors[idx % playerColors.length]}`} style={{ minWidth: 32 }}>{String.fromCharCode(65 + idx)}</td>
                    <td className={`border border-white px-2 py-1 font-semibold text-left ${playerColors[idx % playerColors.length]}`}>
                      {/* Mobile: show Initial + Surname only. Desktop: full name */}
                      <span className="block sm:hidden truncate whitespace-nowrap" title={name}>
                        {(() => {
                          try {
                            const parts = (name || '').trim().split(/\s+/).filter(Boolean);
                            if (parts.length === 0) return '';
                            if (parts.length === 1) return parts[0];
                            // remove nickname tokens wrapped in quotes or parentheses from initial detection
                            const first = parts[0].replace(/^["'\(]+|["'\)]+$/g, '');
                            const surname = parts[parts.length - 1].replace(/^["'\(]+|["'\)]+$/g, '');
                            const initial = (first && first[0]) ? first[0].toUpperCase() : '';
                            return initial ? `${initial}. ${surname}` : surname;
                          } catch (e) {
                            return name;
                          }
                        })()}
                      </span>
                      <span className="hidden sm:block truncate whitespace-nowrap" title={name}>{name}</span>
                    </td>
                      <td className="border px-2 py-1 text-center">
                      <select
                        value={playerData[name]?.teebox || ''}
                        onChange={e => handleChange(name, 'teebox', e.target.value)}
                        className="w-16 sm:w-24 text-center bg-transparent rounded focus:outline-none font-semibold"
                        style={{
                          border: 'none',
                          color:
                            playerData[name]?.teebox === 'Red' ? '#FF4B4B' :
                            playerData[name]?.teebox === 'White' ? '#FFFFFF' :
                            '#FFD700'
                        }}
                      >
                        <option value="" style={{ color: '#FFD700' }}>Select</option>
                        <option value="Yellow" style={{ color: '#FFD700' }}>Yellow</option>
                        <option value="White" style={{ color: '#FFFFFF', background: '#002F5F' }}>White</option>
                        <option value="Red" style={{ color: '#FF4B4B', background: '#002F5F' }}>Red</option>
                      </select>
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <input
                        type="number"
                        min="0"
                        className="w-12 sm:w-16 text-center bg-transparent rounded focus:outline-none font-semibold no-spinner"
                        style={{
                          border: 'none',
                          color: '#FFD700'
                        }}
                        value={playerData[name]?.handicap || ''}
                        onChange={e => handleChange(name, 'handicap', e.target.value)}
                      />
                    </td>
                    <td className="border border-white px-2 py-1 text-center font-bold" style={{ color: '#FFD700' }}>
                      {computePH(playerData[name]?.handicap)}
                    </td>
                    <td className="hidden sm:table-cell border px-2 py-1 text-center">
                      <input type="number" min="0" className="w-12 text-center text-white bg-transparent rounded focus:outline-none font-semibold no-spinner" style={{ border: 'none', MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none' }} value={miniTableStats[name]?.waters || ''} onChange={e => { if (!canEdit(name)) return; handleMiniTableChange(name, 'waters', e.target.value); }} disabled={!canEdit(name)} />
                    </td>
                    <td className="hidden sm:table-cell border px-2 py-1 text-center">
                      <input type="checkbox" checked={!!miniTableStats[name]?.dog} onChange={e => { if (!canEdit(name)) return; handleMiniTableChange(name, 'dog', e.target.checked); }} disabled={!canEdit(name)} />
                    </td>
                    <td className="hidden sm:table-cell border px-2 py-1 text-center">
                      <input type="number" min="0" className="w-12 text-center text-white bg-transparent rounded focus:outline-none font-semibold no-spinner" style={{ border: 'none', MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none' }} value={miniTableStats[name]?.twoClubs || ''} onChange={e => { if (!canEdit(name)) return; handleMiniTableChange(name, 'twoClubs', e.target.value); }} disabled={!canEdit(name)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            
              </table>
            </div>
            {/* Extras mobile table: quick access to Waters/Dog/2 Clubs */}
            <div className="sm:hidden w-full mb-3 mt-2">
              <h3 className="text-sm font-semibold text-white mb-2 text-center">Extras</h3>
              <div className="overflow-x-auto">
                <table className="w-full border text-white text-xs rounded" style={{ fontFamily: 'Lato, Arial, sans-serif', background: '#002F5F', borderColor: '#FFD700' }}>
                  <thead>
                    <tr>
                      <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700'}}></th>
                      <th className="border px-2 py-1 text-left" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700'}}>Name</th>
                      <th className="border px-2 py-1 text-center" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700'}}>Waters</th>
                      <th className="border px-2 py-1 text-center" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700'}}>Dog</th>
                      <th className="border px-2 py-1 text-center" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700'}}>2 Clubs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((name, idx) => (
                      <tr key={'extras-' + name}>
                        <td className={`border border-white px-2 py-1 font-bold text-center align-middle ${playerColors[idx % playerColors.length]}`} style={{ minWidth: 32 }}>{String.fromCharCode(65 + idx)}</td>
                        <td className={`border border-white px-2 py-1 font-semibold text-left ${playerColors[idx % playerColors.length]}`}>
                          <span className="truncate whitespace-nowrap" title={name}>
                            {(() => {
                              try {
                                const parts = (name || '').trim().split(/\s+/).filter(Boolean);
                                if (parts.length === 0) return '';
                                if (parts.length === 1) return parts[0];
                                const first = parts[0].replace(/^["'\(]+|["'\)]+$/g, '');
                                const surname = parts[parts.length - 1].replace(/^["'\(]+|["'\)]+$/g, '');
                                const initial = (first && first[0]) ? first[0].toUpperCase() : '';
                                return initial ? `${initial}. ${surname}` : surname;
                              } catch (e) {
                                return name;
                              }
                            })()}
                          </span>
                        </td>
                        <td className="border px-2 py-1 text-center">
                          <input type="number" min="0" className="w-12 text-center text-white bg-transparent rounded focus:outline-none font-semibold no-spinner" style={{ border: 'none' }} value={miniTableStats[name]?.waters || ''} onChange={e => { if (!canEdit(name)) return; handleMiniTableChange(name, 'waters', e.target.value); }} disabled={!canEdit(name)} />
                        </td>
                        <td className="border px-2 py-1 text-center">
                          <input type="checkbox" checked={!!miniTableStats[name]?.dog} onChange={e => handleMiniTableChange(name, 'dog', e.target.checked)} />
                        </td>
                        <td className="border px-2 py-1 text-center">
                          <input type="number" min="0" className="w-12 text-center text-white bg-transparent rounded focus:outline-none font-semibold no-spinner" style={{ border: 'none' }} value={miniTableStats[name]?.twoClubs || ''} onChange={e => handleMiniTableChange(name, 'twoClubs', e.target.value)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="w-full sm:w-auto mt-3">
              <button
                className="w-full sm:w-auto py-2 px-4 rounded-2xl font-semibold transition shadow border border-white"
                style={{ backgroundColor: '#FFD700', color: '#002F5F', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#ffe066'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = '#FFD700'}
                onClick={() => setShowResetModal(true)}
              >
                Reset Scores
              </button>
            </div>
          </div>
          {/* Scorecard Table UI: Front 9 and Back 9, PAR/STROKE/HOLE headings, gross/net rows, Medal logic */}
          {/* Mobile-only per-hole entry (compact cards for mobile) */}
          <div className="sm:hidden w-full mt-4">
            {/* Decide mobile rendering mode */}
            {(() => {
              const isAlliance = (props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('alliance')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('alliance'));
              const isMedalMobile = (props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('medal')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('medal'));
              if (isAlliance) {
                const group = groups[groupIdx] || { players: [] };
                const best = computeGroupBestTwoTotals(group);
                const hole = defaultHoles[mobileSelectedHole - 1];
                return (
                  <div>
                    <div className="w-full p-3 rounded border-2 text-center mb-3" style={{ borderColor: '#FFD700', background: '#002F5F' }}>
                      <div className="font-extrabold text-2xl text-white">Alliance Score: <span style={{ color: '#FFD700' }}>{best.total}</span></div>
                    </div>

                    <div className="mb-4 p-3 rounded border text-white" style={{ background: '#002F5F', borderColor: '#FFD700' }}>
                      <div className="flex items-center justify-center mb-3">
                        <button className="px-3 py-2 rounded text-lg mr-4" style={{ background: 'rgba(255,215,0,0.12)', color: '#FFD700' }} onClick={() => setMobileSelectedHole(h => Math.max(1, h - 1))}>◀</button>
                        <div className="flex-1 text-base font-bold text-white text-center truncate" style={{ whiteSpace: 'nowrap' }}>Hole {hole?.number || mobileSelectedHole} • Par {hole?.par || '-'} • SI {hole?.index ?? '-'}</div>
                        <button className="px-3 py-2 rounded text-lg ml-4" style={{ background: 'rgba(255,215,0,0.12)', color: '#FFD700' }} onClick={() => setMobileSelectedHole(h => Math.min(18, h + 1))}>▶</button>
                      </div>
                      <div className="space-y-3">
                        {players.map((pName) => {
                          const stable = computePlayerStablefordTotals(pName);
                          const grossArr = Array.isArray(playerData[pName]?.scores) ? playerData[pName].scores : Array(18).fill('');
                          const curVal = grossArr[mobileSelectedHole - 1] || '';
                          const grossTotal = grossArr.reduce((s, v) => s + (parseInt(v, 10) || 0), 0);
                          // par label
                          let parSumPlayer = 0; let anyScorePlayer = false;
                          for (let i = 0; i < grossArr.length; i++) { const v = parseInt(grossArr[i], 10); if (Number.isFinite(v)) { parSumPlayer += (defaultHoles[i]?.par || 0); anyScorePlayer = true; } }
                          const diffPlayer = grossTotal - parSumPlayer;
                          const parLabelPlayer = anyScorePlayer ? (diffPlayer === 0 ? ' (E)' : ` (${diffPlayer > 0 ? '+' : ''}${diffPlayer})`) : '';
                          const initialLabel = (() => { try { const parts = (pName || '').trim().split(/\s+/).filter(Boolean); if (!parts.length) return pName; const first = parts[0].replace(/^['"\(]+|['"\)]+$/g, ''); const surname = parts[parts.length - 1].replace(/^['"\(]+|['"\)]+$/g, ''); const initial = (first && first[0]) ? first[0].toUpperCase() : ''; return initial ? `${initial}. ${surname}` : surname; } catch (e) { return pName; } })();

                          return (
                            <div key={`mob-${pName}`} className="p-2 rounded border border-white/10 relative">
                              <div className="flex items-center justify-between">
                                <div className="font-semibold">{initialLabel}</div>
                              </div>
                              <div className="text-xs font-semibold mt-1" style={{ color: '#FFD700' }}>PH {computePH(playerData[pName]?.handicap)}</div>

                              <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                                <div>Out: <span className="font-bold">{stable.front}</span></div>
                                <div className="text-right">In: <span className="font-bold">{stable.back}</span></div>
                                <div>Total: <span className="font-bold">{grossTotal}{parLabelPlayer}</span></div>
                                <div className="text-right">Points: <span className="font-bold">{stable.total}</span></div>
                              </div>

                              <div className="absolute right-3 top-3 flex items-center gap-3">
                                <button aria-label={`big-dec-${pName}`} className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ background: '#6B7280', color: '#ffffff' }} onClick={() => { if (!canEdit(pName)) return; const cur = parseInt(curVal || '0', 10) || 0; handleScoreChange(pName, mobileSelectedHole - 1, String(Math.max(0, cur - 1))); }}>−</button>
                                <div className="mx-1 text-lg font-extrabold" style={{ minWidth: 28, textAlign: 'center' }}>{curVal || '-'}</div>
                                <button aria-label={`big-inc-${pName}`} className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ background: '#6B7280', color: '#ffffff' }} onClick={() => { if (!canEdit(pName)) return; const cur = parseInt(curVal || '0', 10) || 0; handleScoreChange(pName, mobileSelectedHole - 1, String(cur + 1)); }}>+</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              }

              if (isMedalMobile) {
                const hole = defaultHoles[mobileSelectedHole - 1];
                return (
                  <div className="mb-4 p-3 rounded border text-white" style={{ background: '#002F5F', borderColor: '#FFD700' }}>
                    <div className="flex items-center justify-center mb-3">
                      <button className="px-3 py-2 rounded text-lg mr-4" style={{ background: 'rgba(255,215,0,0.12)', color: '#FFD700' }} onClick={() => setMobileSelectedHole(h => Math.max(1, h - 1))}>◀</button>
                      <div className="flex-1 text-base font-bold text-white text-center truncate" style={{ whiteSpace: 'nowrap' }}>Hole {hole?.number || mobileSelectedHole} • Par {hole?.par || '-'} • SI {hole?.index ?? '-'}</div>
                      <button className="px-3 py-2 rounded text-lg ml-4" style={{ background: 'rgba(255,215,0,0.12)', color: '#FFD700' }} onClick={() => setMobileSelectedHole(h => Math.min(18, h + 1))}>▶</button>
                    </div>
                    <div className="space-y-3">
                      {players.map((pName) => {
                        const grossArr = Array.isArray(playerData[pName]?.scores) ? playerData[pName].scores : Array(18).fill('');
                        const curVal = grossArr[mobileSelectedHole - 1] || '';
                        const grossTotal = grossArr.reduce((s, v) => s + (parseInt(v, 10) || 0), 0);
                        const playingHandicap = computePH(playerData[pName]?.handicap) || 0;
                        let netFront = 0; let netBack = 0;
                        defaultHoles.forEach((h, idx) => {
                          const raw = grossArr[idx];
                          const gross = raw === '' || raw == null ? NaN : parseInt(raw, 10);
                          let strokesReceived = 0;
                          if (playingHandicap > 0) {
                            if (playingHandicap >= 18) {
                              strokesReceived = 1;
                              if (playingHandicap - 18 >= h.index) strokesReceived = 2;
                              else if (h.index <= (playingHandicap % 18)) strokesReceived = 2;
                            } else if (h.index <= playingHandicap) strokesReceived = 1;
                          }
                          const net = Number.isFinite(gross) ? (gross - strokesReceived) : 0;
                          if (idx < 9) netFront += net; else netBack += net;
                        });
                        const totalNet = netFront + netBack;
                        // par label for totals
                        let parSumPlayer = 0; let anyScorePlayer = false;
                        for (let i = 0; i < grossArr.length; i++) { const v = parseInt(grossArr[i], 10); if (Number.isFinite(v)) { parSumPlayer += (defaultHoles[i]?.par || 0); anyScorePlayer = true; } }
                        const diffPlayer = grossTotal - parSumPlayer;
                        const parLabelPlayer = anyScorePlayer ? (diffPlayer === 0 ? ' (E)' : ` (${diffPlayer > 0 ? '+' : ''}${diffPlayer})`) : '';
                        const initialLabel = (() => { try { const parts = (pName || '').trim().split(/\s+/).filter(Boolean); if (!parts.length) return pName; const first = parts[0].replace(/^['"\(]+|['"\)]+$/g, ''); const surname = parts[parts.length - 1].replace(/^['"\(]+|['"\)]+$/g, ''); const initial = (first && first[0]) ? first[0].toUpperCase() : ''; return initial ? `${initial}. ${surname}` : surname; } catch (e) { return pName; } })();

                        return (
                          <div key={`mob-medal-${pName}`} className="p-2 rounded border border-white/10 relative">
                            <div className="flex items-center justify-between">
                              <div className="font-semibold">{initialLabel}</div>
                            </div>
                            <div className="text-xs font-semibold mt-1" style={{ color: '#FFD700' }}>PH {computePH(playerData[pName]?.handicap)}</div>

                            <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                              <div>Out: <span className="font-bold">{netFront}</span></div>
                              <div className="text-right">In: <span className="font-bold">{netBack}</span></div>
                              <div>Total: <span className="font-bold">{grossTotal}{parLabelPlayer}</span></div>
                              <div className="text-right">Net: <span className="font-bold">{totalNet}</span></div>
                            </div>

                            <div className="absolute right-3 top-3 flex items-center gap-3">
                              <button aria-label={`big-dec-medal-${pName}`} className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ background: '#6B7280', color: '#ffffff' }} onClick={() => { if (!canEdit(pName)) return; const cur = parseInt(curVal || '0', 10) || 0; handleScoreChange(pName, mobileSelectedHole - 1, String(Math.max(0, cur - 1))); }}>−</button>
                              <div className="mx-1 text-lg font-extrabold" style={{ minWidth: 28, textAlign: 'center' }}>{curVal || '-'}</div>
                              <button aria-label={`big-inc-medal-${pName}`} className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ background: '#6B7280', color: '#ffffff' }} onClick={() => { if (!canEdit(pName)) return; const cur = parseInt(curVal || '0', 10) || 0; handleScoreChange(pName, mobileSelectedHole - 1, String(cur + 1)); }}>+</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // Default: per-player cards
              return (
                <>
                  {players.map((name) => {
                    const pIdx = players.indexOf(name);
                    return (
                      <div key={`mobile-${name}`} className="mb-4 p-3 rounded border text-white relative pb-16" style={{ background: '#002F5F', borderColor: '#FFD700' }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className={`font-bold ${playerColors[pIdx % playerColors.length]} truncate`} style={{ minWidth: 0 }}></div>
                          <div className="text-xs font-semibold" style={{ color: '#FFD700' }}>PH {computePH(playerData[name]?.handicap)}</div>
                        </div>
                        <div className="divide-y divide-white/10">
                          {defaultHoles.map((hole, hIdx) => (
                            <div key={hole.number} className="flex items-center justify-between py-2">
                              <div className="w-20">
                                <div className="text-sm font-bold">Hole {hole.number}</div>
                                <div className="text-xs text-white/80">Par {hole.par} • S{hole.index}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button aria-label={`decrement-hole-${hole.number}-${name}`} className="px-2 py-1 rounded bg-white/10" onClick={() => { if (!canEdit(name)) return; const cur = parseInt(playerData[name]?.scores?.[hIdx] || '0', 10) || 0; const next = Math.max(0, cur - 1); handleScoreChange(name, hIdx, String(next)); }} disabled={!canEdit(name)}>−</button>
                                <input inputMode="numeric" pattern="[0-9]*" className="w-14 text-center bg-transparent text-lg font-bold focus:outline-none" value={playerData[name]?.scores?.[hIdx] ?? ''} onChange={e => { if (!canEdit(name)) return; const v = (e.target.value || '').replace(/[^0-9]/g, ''); handleScoreChange(name, hIdx, v); }} disabled={!canEdit(name)} onFocus={e => e.currentTarget.scrollIntoView({ block: 'center' })} />
                                <button aria-label={`increment-hole-${hole.number}-${name}`} className="px-2 py-1 rounded bg-white/10" onClick={() => { if (!canEdit(name)) return; const cur = parseInt(playerData[name]?.scores?.[hIdx] || '0', 10) || 0; const next = cur + 1; handleScoreChange(name, hIdx, String(next)); }} disabled={!canEdit(name)}>+</button>
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* per-player summary simplified */}
                        <div className="mt-3 text-sm font-bold">
                          <div className="flex justify-between"><div>Out: </div><div>In: </div></div>
                          <div className="absolute left-1/2 transform -translate-x-1/2 bottom-4"><div className="text-center px-6 py-3 rounded-2xl border-4 font-extrabold text-2xl" style={{ borderColor: '#FFD700', background: '#1B3A6B', color: 'white' }}>Score</div></div>
                        </div>
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>
          <div className="hidden sm:block overflow-x-auto">
            {/* Front 9 Table */}
            <h3 className="text-lg font-bold text-center mb-2 text-white">Front 9</h3>
            <table className="min-w-full border text-center mb-8">
              <thead>
                <tr className="bg-gray-800/90">
                  <th className="border px-2 py-1 bg-white/5"></th>
                  <th className="border px-2 py-1 bg-white/5">HOLE</th>
                  {defaultHoles.slice(0,9).map(hole => (
                    <th key={hole.number} className="border px-2 py-1 bg-white/5">{hole.number}</th>
                  ))}
                  <th className="border px-2 py-1 bg-white/5 font-bold">Out</th>
                </tr>
                <tr className="bg-blue-900/90">
                  <th className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}></th>
                  <th className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}>PAR</th>
                  {defaultHoles.slice(0,9).map(hole => (
                    <th key={hole.number} className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}>{hole.par}</th>
                  ))}
                  <th className="border px-2 py-1 font-bold" style={{background:'#1B3A6B',color:'white'}}>36</th>
                </tr>
                <tr className="bg-gray-900/90">
                  <th className="border px-2 py-1 bg-white/5"></th>
                  <th className="border px-2 py-1 bg-white/5">STROKE</th>
                  {defaultHoles.slice(0,9).map(hole => (
                    <th key={hole.number} className="border px-2 py-1 bg-white/5">{hole.index}</th>
                  ))}
                  <th className="border px-2 py-1 bg-white/5"></th>
                </tr>
              </thead>
              <tbody>
                  {players.map((name, pIdx) => {
                  const isAlliance = (props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('alliance')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('alliance'));
                  const resultLabel = isAlliance ? 'Points' : 'Net';
                  const stable = isAlliance ? computePlayerStablefordTotals(name) : null;
                  return (
                  <React.Fragment key={name + '-rows-front'}>
                    {/* Gross row */}
                    <tr key={name + '-gross-front'}>
                      <td rowSpan={2} className={`border border-white px-2 py-1 font-bold text-lg text-center align-middle ${playerColors[pIdx % playerColors.length]}`} style={{ minWidth: 32, verticalAlign: 'middle' }}>
                        <span className="hidden sm:inline">{String.fromCharCode(65 + pIdx)}</span>
                      </td>
                      <td className="border px-2 py-1 text-base font-bold bg-white/10 text-center" style={{ minWidth: 40 }}>Gross</td>
                      {defaultHoles.slice(0,9).map((hole, hIdx) => (
                        <td key={hIdx} className="border py-1 text-center align-middle font-bold text-base">
                          <div className="flex items-center justify-center">
                            <input
                              type="number"
                              min="0"
                              max="20"
                              value={playerData[name]?.scores?.[hIdx] || ''}
                              onChange={e => { if (!canEdit(name)) return; handleScoreChange(name, hIdx, e.target.value); }}
                              disabled={!canEdit(name)}
                              className={`w-10 h-10 text-center focus:outline-none block mx-auto font-bold text-base no-spinner px-0 ${scoreCellClass(name, hIdx)}`}
                              inputMode="numeric"
                              style={{ MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none', paddingLeft: '0.5rem', paddingRight: '0.5rem', ...scoreCellStyle(name, hIdx) }}
                            />
                          </div>
                        </td>
                      ))}
                      <td className="border px-2 py-1 font-bold text-base">{Array.isArray(playerData[name]?.scores) ? playerData[name].scores.slice(0,9).reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0) : ''}</td>
                    </tr>
                    {/* Net row (no player label cell) */}
                    <tr key={name + '-net-front'}>
                      <td className="border px-2 py-1 bg-white/10 text-base font-bold text-center align-middle" style={{ minWidth: 40, verticalAlign: 'middle', height: '44px' }}>{resultLabel}</td>
                      {defaultHoles.slice(0,9).map((hole, hIdx) => {
                        // For Medal: show net (gross - strokesReceived). For Alliance: show stableford points.
                        const playingHandicap = computePH(playerData[name]?.handicap) || 0;
                        let strokesReceived = 0;
                        if (playingHandicap > 0) {
                          if (playingHandicap >= 18) {
                            strokesReceived = 1;
                            if (playingHandicap - 18 >= hole.index) strokesReceived = 2;
                            else if (hole.index <= (playingHandicap % 18)) strokesReceived = 2;
                          } else if (hole.index <= playingHandicap) {
                            strokesReceived = 1;
                          }
                        }
                        const rawGross = playerData[name]?.scores?.[hIdx];
                        const gross = rawGross === '' || rawGross == null ? NaN : parseInt(rawGross, 10);
                        if (!Number.isFinite(gross)) {
                          return <td key={hIdx} className="border px-1 py-1 bg-white/5 align-middle font-bold text-base" style={{ verticalAlign: 'middle', height: '44px' }}></td>;
                        }
                        const net = gross - strokesReceived;
                        if ((props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('alliance')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('alliance'))) {
                          const pts = stablefordPoints(net, hole.par);
                          return (
                            <td key={hIdx} className="border px-1 py-1 bg-white/5 align-middle font-bold text-base" style={{ verticalAlign: 'middle', height: '44px' }}>
                              {pts}
                            </td>
                          );
                        }
                        return (
                          <td key={hIdx} className="border px-1 py-1 bg-white/5 align-middle font-bold text-base" style={{ verticalAlign: 'middle', height: '44px' }}>
                            {net}
                          </td>
                        );
                      })}
                      {/* Net front 9 total */}
                      <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>
                        {(() => {
                          const isAlliance = (props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('alliance')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('alliance'));
                          if (isAlliance) {
                            // sum stableford points for front 9
                            const pts = computePlayerStablefordTotals(name);
                            return pts.front;
                          }
                          const playingHandicap = computePH(playerData[name]?.handicap) || 0;
                          let netFrontTotal = 0;
                          defaultHoles.slice(0,9).forEach((hole, hIdx) => {
                            let strokesReceived = 0;
                            if (playingHandicap > 0) {
                              if (playingHandicap >= 18) {
                                strokesReceived = 1;
                                if (playingHandicap - 18 >= hole.index) strokesReceived = 2;
                                else if (hole.index <= (playingHandicap % 18)) strokesReceived = 2;
                              } else if (hole.index <= playingHandicap) {
                                strokesReceived = 1;
                              }
                            }
                            const gross = parseInt(playerData[name]?.scores?.[hIdx], 10) || 0;
                            const net = gross ? gross - strokesReceived : 0;
                            if (typeof net === 'number') netFrontTotal += net;
                          });
                          return netFrontTotal;
                        })()}
                      </td>
                    </tr>
                  </React.Fragment>
                  );
                })}
                {/* Alliance team 'Score' row: sum of best two stableford totals */}
                {((props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('alliance')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('alliance'))) && (
                  (() => {
                    const group = groups[groupIdx] || { players: [] };
                    const best = computeGroupBestTwoTotals(group);
                    return (
                      <tr key={`group-score-front-${groupIdx}`}>
                        <td className="border px-2 py-1 bg-white/5" />
                        <td className="border px-2 py-1 bg-white/10 text-base font-bold text-center align-middle" style={{ minWidth: 40, verticalAlign: 'middle', height: '44px' }}>Score</td>
                        {defaultHoles.slice(0,9).map((_, hIdx) => {
                          const val = best.perHole ? best.perHole[hIdx] : 0;
                          return (
                            <td key={hIdx} className="border px-1 py-1 bg-white/5 align-middle font-bold text-base" style={{ verticalAlign: 'middle', height: '44px' }}>
                              {val != null ? val : 0}
                            </td>
                          );
                        })}
                        <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>{best.front}</td>
                      </tr>
                    );
                  })()
                )}
              </tbody>
            </table>
            {/* Back 9 Table */}
            <h3 className="text-lg font-bold text-center mb-2 text-white">Back 9</h3>
            <table className="min-w-full border text-center">
              <thead>
                <tr className="bg-gray-800/90">
                  <th className="border px-2 py-1 bg-white/5"></th>
                  <th className="border px-2 py-1 bg-white/5">HOLE</th>
                  {defaultHoles.slice(9,18).map(hole => (
                    <th key={hole.number} className="border px-2 py-1 bg-white/5">{hole.number}</th>
                  ))}
                  <th className="border px-2 py-1 bg-white/5 font-bold">In</th>
                  <th className="border px-2 py-1 bg-white/5 font-bold">TOTAL</th>
                </tr>
                <tr className="bg-blue-900/90">
                  <th className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}></th>
                  <th className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}>PAR</th>
                  {defaultHoles.slice(9,18).map(hole => (
                    <th key={hole.number} className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}>{hole.par}</th>
                  ))}
                  <th className="border px-2 py-1 font-bold" style={{background:'#1B3A6B',color:'white'}}>36</th>
                  <th className="border px-2 py-1 font-bold" style={{background:'#1B3A6B',color:'white'}}>72</th>
                </tr>
                <tr className="bg-gray-900/90">
                  <th className="border px-2 py-1 bg-white/5"></th>
                  <th className="border px-2 py-1 bg-white/5">STROKE</th>
                  {defaultHoles.slice(9,18).map(hole => (
                    <th key={hole.number} className="border px-2 py-1 bg-white/5">{hole.index}</th>
                  ))}
                  <th className="border px-2 py-1 bg-white/5 border-r"></th>
                  <th className="border px-2 py-1 bg-white/5 border-r"></th>
                </tr>
              </thead>
              <tbody>
                {players.map((name, pIdx) => {
                  const isAlliance = (props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('alliance')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('alliance'));
                          const resultLabel = isAlliance ? 'Points' : 'Net';
                  const stable = isAlliance ? computePlayerStablefordTotals(name) : null;
                  return (
                  <React.Fragment key={name + '-rows-back'}>
                    {/* Gross row */}
                    <tr key={name + '-gross-back'}>
                      <td rowSpan={2} className={`border border-white px-2 py-1 font-bold text-lg text-center align-middle ${playerColors[pIdx % playerColors.length]}`} style={{ minWidth: 32, verticalAlign: 'middle' }}>
                        <span className="hidden sm:inline">{String.fromCharCode(65 + pIdx)}</span>
                      </td>
                      <td className="border px-2 py-1 text-base font-bold bg-white/10 text-center" style={{ minWidth: 40 }}>Gross</td>
                      {defaultHoles.slice(9,18).map((hole, hIdx) => (
                        <td key={hIdx} className="border py-1 text-center align-middle font-bold text-base">
                          <div className="flex items-center justify-center">
                            <input
                              type="number"
                              min="0"
                              max="20"
                              value={playerData[name]?.scores?.[hIdx+9] || ''}
                              onChange={e => { if (!canEdit(name)) return; handleScoreChange(name, hIdx+9, e.target.value); }}
                              disabled={!canEdit(name)}
                              className={`w-10 h-10 text-center focus:outline-none block mx-auto font-bold text-base no-spinner px-0 ${scoreCellClass(name, hIdx+9)}`}
                              inputMode="numeric"
                              style={{ MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none', paddingLeft: '0.5rem', paddingRight: '0.5rem', ...scoreCellStyle(name, hIdx+9) }}
                            />
                          </div>
                        </td>
                      ))}
                      <td className="border px-2 py-1 font-bold text-base">{
                        Array.isArray(playerData[name]?.scores) ? playerData[name].scores.slice(9,18).reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0) : ''
                      }</td>
                      <td className="border px-2 py-1 font-bold text-base">{
                        Array.isArray(playerData[name]?.scores) ? playerData[name].scores.reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0) : ''
                      }</td>
                    </tr>
                    {/* Net row (no player label cell) */}
                    <tr key={name + '-net-back'}>
                      <td className="border px-2 py-1 bg-white/10 text-base font-bold text-center align-middle" style={{ minWidth: 40, verticalAlign: 'middle', height: '44px' }}>{resultLabel}</td>
                      {defaultHoles.slice(9,18).map((hole, hIdx) => {
                        const playingHandicap = computePH(playerData[name]?.handicap) || 0;
                        let strokesReceived = 0;
                        if (playingHandicap > 0) {
                          if (playingHandicap >= 18) {
                            strokesReceived = 1;
                            if (playingHandicap - 18 >= hole.index) strokesReceived = 2;
                            else if (hole.index <= (playingHandicap % 18)) strokesReceived = 2;
                          } else if (hole.index <= playingHandicap) {
                            strokesReceived = 1;
                          }
                        }
                        const rawGross = playerData[name]?.scores?.[hIdx+9];
                        const gross = rawGross === '' || rawGross == null ? NaN : parseInt(rawGross, 10);
                        if (!Number.isFinite(gross)) {
                          return <td key={hIdx} className="border px-1 py-1 bg-white/5 align-middle font-bold text-base" style={{ verticalAlign: 'middle', height: '44px' }}></td>;
                        }
                        const net = gross - strokesReceived;
                        if ((props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('alliance')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('alliance'))) {
                          const pts = stablefordPoints(net, hole.par);
                          return (
                            <td key={hIdx} className="border px-1 py-1 bg-white/5 align-middle font-bold text-base" style={{ verticalAlign: 'middle', height: '44px' }}>
                              {pts}
                            </td>
                          );
                        }
                        return (
                          <td key={hIdx} className="border px-1 py-1 bg-white/5 align-middle font-bold text-base" style={{ verticalAlign: 'middle', height: '44px' }}>
                            {net}
                          </td>
                        );
                      })}
                      {/* Net back 9 and total */}
                      <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>
                        {(() => {
                          const isAlliance = (props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('alliance')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('alliance'));
                          if (isAlliance) {
                            const pts = stable ? stable.back : computePlayerStablefordTotals(name).back;
                            return pts;
                          }
                          const playingHandicap = computePH(playerData[name]?.handicap) || 0;
                          let netBackTotal = 0;
                          defaultHoles.slice(9,18).forEach((hole, hIdx) => {
                            let strokesReceived = 0;
                            if (playingHandicap > 0) {
                              if (playingHandicap >= 18) {
                                strokesReceived = 1;
                                if (playingHandicap - 18 >= hole.index) strokesReceived = 2;
                                else if (hole.index <= (playingHandicap % 18)) strokesReceived = 2;
                              } else if (hole.index <= playingHandicap) {
                                strokesReceived = 1;
                              }
                            }
                            const gross = parseInt(playerData[name]?.scores?.[hIdx+9], 10) || 0;
                            const net = gross ? gross - strokesReceived : 0;
                            if (typeof net === 'number') netBackTotal += net;
                          });
                          return netBackTotal;
                        })()}
                      </td>
                      <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>
                        {(() => {
                          const isAlliance = (props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('alliance')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('alliance'));
                          if (isAlliance) {
                            const pts = stable ? stable.total : computePlayerStablefordTotals(name).total;
                            return pts;
                          }
                          const playingHandicap = computePH(playerData[name]?.handicap) || 0;
                          let netTotal = 0;
                          defaultHoles.forEach((hole, hIdx) => {
                            let strokesReceived = 0;
                            if (playingHandicap > 0) {
                              if (playingHandicap >= 18) {
                                strokesReceived = 1;
                                if (playingHandicap - 18 >= hole.index) strokesReceived = 2;
                                else if (hole.index <= (playingHandicap % 18)) strokesReceived = 2;
                              } else if (hole.index <= playingHandicap) {
                                strokesReceived = 1;
                              }
                            }
                            const gross = parseInt(playerData[name]?.scores?.[hIdx], 10) || 0;
                            const net = gross ? gross - strokesReceived : 0;
                            if (typeof net === 'number') netTotal += net;
                          });
                          return netTotal;
                        })()}
                      </td>
                    </tr>
                  </React.Fragment>
                  );
                })}
                {/* Alliance team 'Score' row for Back 9: show best-two back and total */}
                {((props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('alliance')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('alliance'))) && (
                  (() => {
                    const group = groups[groupIdx] || { players: [] };
                    const best = computeGroupBestTwoTotals(group);
                    return (
                      <tr key={`group-score-back-${groupIdx}`}>
                        <td className="border px-2 py-1 bg-white/5" />
                        <td className="border px-2 py-1 bg-white/10 text-base font-bold text-center align-middle" style={{ minWidth: 40, verticalAlign: 'middle', height: '44px' }}>Score</td>
                        {defaultHoles.slice(9,18).map((_, hIdx) => {
                          const idx = 9 + hIdx;
                          const val = best.perHole ? best.perHole[idx] : 0;
                          return (
                            <td key={hIdx} className="border px-1 py-1 bg-white/5 align-middle font-bold text-base" style={{ verticalAlign: 'middle', height: '44px' }}>
                              {val != null ? val : 0}
                            </td>
                          );
                        })}
                        <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>{best.back}</td>
                        <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>{best.total}</td>
                      </tr>
                    );
                  })()
                )}
              </tbody>
            </table>
          </div>
          {error && <div className="text-red-300 mt-4 font-semibold">{error}</div>}
        </div>
      </div>
      
      {/* Reset Scores Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-6 flex flex-col items-center border-4 border-[#FFD700] popup-jiggle">
            <h2 className="text-2xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif' }}>Clear all gross scores?</h2>
            <div className="text-sm text-white mb-4 text-center" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>This will clear only the gross score input row for every player. Net calculations and running totals will update accordingly. This action cannot be undone.</div>
            <div className="flex gap-3">
              <button className="px-4 py-2 rounded-2xl font-bold shadow border border-white" style={{ backgroundColor: '#1B3A6B', color: 'white' }} onClick={() => { setShowResetModal(false); }}>Cancel</button>
              <button className="px-4 py-2 rounded-2xl font-bold shadow border border-white" style={{ backgroundColor: '#FF4B4B', color: 'white' }} onClick={handleConfirmReset}>Yes, clear scores</button>
            </div>
          </div>
        </div>
      )}
    </PageBackground>
  );
}