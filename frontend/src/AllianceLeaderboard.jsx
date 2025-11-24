import React, { useEffect, useState, useRef } from 'react';
import { apiUrl } from './api';
import socket from './socket';
import PageBackground from './PageBackground';
import TopMenu from './TopMenu';
import { useNavigate } from 'react-router-dom';
import { SignalIcon, TrophyIcon } from '@heroicons/react/24/solid';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const COMP_TYPE_DISPLAY = {
  fourBbbStableford: '4 Ball Better Ball',
  alliance: 'Alliance',
  medalStrokeplay: 'Medal Strokeplay',
  individualStableford: 'Individual Stableford',
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

    export default function AllianceLeaderboard({ initialComp = null }) {
      const [comp, setComp] = useState(initialComp);
      const [groups, setGroups] = useState([]);
      const [entries, setEntries] = useState([]);
      const [backendTeamPointsMap, setBackendTeamPointsMap] = useState({});
      const exportRef = useRef(null);
      const [loading, setLoading] = useState(true);
      const [currentUser, setCurrentUser] = useState(null);
      const [editingNotes, setEditingNotes] = useState(false);
      const [notesDraft, setNotesDraft] = useState('');
  const navigate = useNavigate();
  const [showExtras, setShowExtras] = useState(false);
  const [showHandicaps, setShowHandicaps] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState({});

      // Centralized processing of a competition payload (used both for fresh fetch and for initialComp fallback)
      async function processCompetitionPayload(data) {
        if (!data) return;
        setComp(data);
        setGroups(Array.isArray(data.groups) ? data.groups : []);
        const usersList = Array.isArray(data.users) ? data.users : [];
        const built = [];
        if (Array.isArray(data.groups)) {
          data.groups.forEach((group, groupIdx) => {
                if (Array.isArray(group.players)) {
              group.players.forEach((name, i) => {
                const scores = group.scores?.[name] || Array(18).fill('');
                const handicap = getHandicapFromGroup(group, name) ?? '';
                const gross = scores.reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0);
                const matchedUser = usersList.find(u => typeof u.name === 'string' && u.name.trim().toLowerCase() === (name || '').trim().toLowerCase());
                const userId = matchedUser?.id || null;
                const displayNameFromUser = matchedUser?.displayName || matchedUser?.display_name || matchedUser?.displayname || '';
                const nickFromUser = matchedUser?.nick || matchedUser?.nickname || '';
                const waters = group.waters?.[name] ?? '';
                const dog = group.dog?.[name] ?? false;
                const twoClubs = group.two_clubs?.[name] ?? group.twoClubs?.[name] ?? '';
                const fines = group.fines?.[name] ?? '';
                let teamId = group.teamId || group.id || group.team_id || group.group_id || null;
                // include any underlying teamIds for 4BBB groups so we can try fetching teams_users rows
                const groupTeamIds = Array.isArray(group.teamIds) && group.teamIds.length > 0 ? group.teamIds.filter(Boolean) : [];
                
                // For 4BBB: try to find the specific team this player belongs to
                // This is important for fines and other per-player operations
                if (groupTeamIds.length > 0 && userId) {
                  // Try to match player to one of the team IDs by checking backend
                  // We'll do this asynchronously after building entries
                  teamId = teamId; // Keep default for now, will be refined in async fetch below
                }
                
                built.push({ name, scores, total: gross || 0, handicap, groupIdx, userId, displayName: displayNameFromUser, nick: nickFromUser, waters, dog, twoClubs, fines, teamId, groupTeamIds });
              });
            }
          });
        }
        setEntries(built);
        // If some entries lack handicaps, attempt to fetch their teams_users rows directly
        try {
          const fetchPromises = (built || []).map(async (entry) => {
            try {
              if (!entry) return;
              if (!entry.userId) return;
              // prioritize explicit teamId, then try groupTeamIds (4BBB)
              const tryTeamIds = [];
              if (entry.teamId) tryTeamIds.push(entry.teamId);
              if (Array.isArray(entry.groupTeamIds) && entry.groupTeamIds.length > 0) entry.groupTeamIds.forEach(t => { if (t && !tryTeamIds.includes(t)) tryTeamIds.push(t); });
              for (const tId of tryTeamIds) {
                try {
                  const res = await fetch(apiUrl(`/api/teams/${tId}/users/${entry.userId}`));
                  if (!res.ok) continue;
                  const data = await res.json();
                  // If we found a matching team, update the entry's teamId to the correct one
                  if (data && data.team_id) {
                    entry.teamId = data.team_id;
                  }
                  const ch = data?.course_handicap ?? data?.handicap ?? data?.courseHandicap ?? data?.course_handicap;
                  if (ch !== undefined && ch !== null && ch !== '') {
                    entry.handicap = ch;
                  }
                  // Also load fines from teams_users
                  if (data?.fines !== undefined && data?.fines !== null) {
                    entry.fines = data.fines;
                  }
                  // Found a match, stop looking
                  if (data && (data.team_id || ch !== undefined)) break;
                } catch (e) { /* ignore per-team errors */ }
              }
            } catch (e) { /* per-entry ignore */ }
          });
          await Promise.all(fetchPromises);
          // push updated entries into state so UI picks up refreshed handicaps and teamIds
          setEntries(Array.isArray(built) ? built.slice() : built);
            // If some entries still lack CH, ask the server to compute an authoritative
            // leaderboard (this will use competitions.groups + teams_users + scores).
            // Do this for any competition when we detect missing CH so clients converge on
            // the authoritative course_handicap on initial load.
            try {
              const needsCh = (built || []).some(e => e && (e.handicap === undefined || e.handicap === ''));
              if (needsCh && data && data.id) {
              try {
                const res = await fetch(apiUrl(`/api/competitions/${data.id}/leaderboard-4bbb`));
                if (res.ok) {
                  const json = await res.json();
                  if (json && Array.isArray(json.teams)) {
                    // map player name -> ch from server result using multiple strategies:
                    // 1) by userId (most reliable), 2) by normalized name/displayName/nick,
                    // 3) fallback last-name heuristic
                    const chMap = {};
                    const chMapById = {};
                    const makeKey = (n) => normalizeName(n || '');
                    json.teams.forEach(t => {
                      (t.players || []).forEach(p => {
                        if (!p) return;
                        const val = (p.ch !== undefined && p.ch !== null) ? String(p.ch) : undefined;
                        if (p.userId != null) chMapById[String(p.userId)] = val;
                        const keys = [];
                        if (p.name) keys.push(makeKey(p.name));
                        if (p.displayName) keys.push(makeKey(p.displayName));
                        if (p.nick) keys.push(makeKey(p.nick));
                        // also try compact display variants
                        try { const comp = compactDisplayName(p); if (comp) keys.push(makeKey(comp)); } catch (e) {}
                        keys.forEach(k => { if (k && val !== undefined) chMap[k] = val; });
                      });
                    });
                    let updated = false;
                    const newEntries = (built || []).map(en => {
                      if (!en) return en;
                      // skip entries that already have an explicit handicap
                      if (en.handicap !== undefined && en.handicap !== '') return en;
                      // 1) try userId match
                      if (en.userId != null) {
                        const byId = chMapById[String(en.userId)];
                        if (byId !== undefined) { updated = true; return { ...en, handicap: byId }; }
                      }
                      // 2) try normalized name/display/nick/compact variants
                      const tryKeys = [en.name, en.displayName, compactDisplayName(en), en.nick].filter(Boolean).map(k => makeKey(k));
                      for (const k of tryKeys) {
                        if (k && chMap[k] !== undefined) {
                          updated = true;
                          return { ...en, handicap: chMap[k] };
                        }
                      }
                      // 3) last-name heuristic: try to find any chMap key containing the last token of the entry name
                      try {
                        const parts = (en.name || '').split(' ').filter(Boolean);
                        const last = parts.length > 0 ? makeKey(parts[parts.length - 1]) : '';
                        if (last) {
                          for (const k of Object.keys(chMap)) {
                            if (!k) continue;
                            if (k.includes(last) || last.includes(k)) {
                              updated = true;
                              return { ...en, handicap: chMap[k] };
                            }
                          }
                        }
                      } catch (e) {}
                      return en;
                    });
                    if (updated) setEntries(newEntries.slice());
                  }
                }
              } catch (e) { /* ignore server errors */ }
            }
          } catch (e) {}
        } catch (e) { /* ignore overall fetch errors */ }
        try {
          console.log('AllianceLeaderboard: processCompetitionPayload', { compId: data?.id, groups: data?.groups, built });
        } catch (e) {}

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
          try {
            const res = await fetch(apiUrl(`/api/teams?competitionId=${data.id}`));
            const allTeams = res.ok ? await res.json() : null;
            if (allTeams && Array.isArray(allTeams)) {
              const map = {};
              (allTeams || []).forEach(t => {
                if (t && t.id != null) map[t.id] = t.team_points ?? t.teamPoints ?? null;
              });
              setBackendTeamPointsMap(map);
              try { console.log('AllianceLeaderboard: fetched backend teams', { compId: data?.id, teamIds, backendTeamPointsMap: map }); } catch (e) {}
            } else {
              // Fallback: fetch individual team rows
              const results = await Promise.all(teamIds.map(tid => fetch(apiUrl(`/api/teams/${tid}`)).then(r => r.ok ? r.json() : null).then(t => [tid, t ? (t.team_points ?? (t.team_points === 0 ? t.team_points : (t.team_points || t.teamPoints || null))) : null]).catch(() => [tid, null])));
              const map = {};
              results.forEach(([tid, pts]) => { if (tid) map[tid] = pts; });
              setBackendTeamPointsMap(map);
              try { console.log('AllianceLeaderboard: fetched individual teams (initial fallback)', { compId: data?.id, teamIds, backendTeamPointsMap: map }); } catch (e) {}
            }
          } catch (e) {
            // Network / other error: best-effort attempt individual fetches
            try {
              const results = await Promise.all(teamIds.map(tid => fetch(apiUrl(`/api/teams/${tid}`)).then(r => r.ok ? r.json() : null).then(t => [tid, t ? (t.team_points ?? (t.team_points === 0 ? t.team_points : (t.team_points || t.teamPoints || null))) : null]).catch(() => [tid, null])));
              const map = {};
              results.forEach(([tid, pts]) => { if (tid) map[tid] = pts; });
              setBackendTeamPointsMap(map);
              try { console.log('AllianceLeaderboard: fetched individual teams (catch fallback)', { compId: data?.id, teamIds, backendTeamPointsMap: map }); } catch (e) {}
            } catch (_) {}
          }
        }
        setLoading(false);
      }

      useEffect(() => {
        try { const raw = localStorage.getItem('user'); if (raw) setCurrentUser(JSON.parse(raw)); } catch (e) {}
        const id = window.location.pathname.split('/').pop();
        // If an initialComp prop was supplied by a wrapper (e.g. Leaderboard4BBB), use it and skip fetching
        if (initialComp) {
          processCompetitionPayload(initialComp);
          return;
        }
        setLoading(true);
        fetch(apiUrl(`/api/competitions/${id}`))
          .then(res => res.ok ? res.json() : null)
          .then(async data => {
            if (!data) return setLoading(false);
            await processCompetitionPayload(data);
          })
          .catch(() => setLoading(false));
      }, [initialComp]);

      // Real-time: join competition room and refresh leaderboard when relevant socket events arrive
      useEffect(() => {
        if (!comp || !comp.id) return;
        const compId = Number(comp.id);
        try { socket.emit('join', { competitionId: compId }); } catch (e) {}
        const handler = async (msg) => {
          try {
            if (!msg || Number(msg.competitionId) !== compId) return;
            // Ignore rebroadcasts that originated from this client to prevent double-processing
            if (msg.originSocketId && socket && socket.id && msg.originSocketId === socket.id) return;
            // If the server sent a full updated group object, merge it locally first
            // so clients can update immediately without waiting for a fresh HTTP fetch.
            if (msg.group && (msg.groupId != null)) {
              try {
                // Build a shallow merged competition payload and re-run processing
                const merged = { ...(comp || {}), groups: Array.isArray(comp?.groups) ? comp.groups.slice() : [] };
                merged.groups[msg.groupId] = msg.group;
                // Process the merged payload to update entries and backend maps
                await processCompetitionPayload(merged);
                return;
              } catch (e) {
                // fall through to fetching the authoritative competition
              }
            }
            // Re-fetch competition and backend teams when no group payload was provided
            fetch(apiUrl(`/api/competitions/${compId}`))
              .then(res => res.ok ? res.json() : null)
              .then(async data => {
                if (!data) return;
                await processCompetitionPayload(data);
              })
              .catch(() => {});
          } catch (e) {}
        };
        const draftHandler = async (msg) => {
          try {
            if (!msg || Number(msg.competitionId) !== compId) return;
            // Ignore rebroadcasts that originated from this client to prevent double-processing
            if (msg.originSocketId && socket && socket.id && msg.originSocketId === socket.id) return;
            // Update entries state locally so leaderboard reflects CH changes instantly
            setEntries(prev => {
              if (!Array.isArray(prev)) return prev;
              const updated = prev.map(e => {
                try {
                  // match by userId primarily
                  if (msg.userId && e.userId && Number(e.userId) === Number(msg.userId)) {
                    return { ...e, handicap: (msg.course_handicap ?? msg.handicap ?? e.handicap) };
                  }
                  // match by teamId inside groupTeamIds (4BBB split teams)
                  if (msg.teamId && Array.isArray(e.groupTeamIds) && e.groupTeamIds.includes(msg.teamId) && msg.userId && e.userId && Number(e.userId) === Number(msg.userId)) {
                    return { ...e, handicap: (msg.course_handicap ?? msg.handicap ?? e.handicap) };
                  }
                  // fallback: match by name
                  if (msg.playerName && e.name && String(e.name) === String(msg.playerName)) {
                    return { ...e, handicap: (msg.course_handicap ?? msg.handicap ?? e.handicap) };
                  }
                } catch (err) { /* ignore per-entry errors */ }
                return e;
              });
              return updated;
            });

            // If payload lacked an authoritative course_handicap but included user/team ids
            // attempt to fetch the teams_users row to ensure all clients converge on the
            // authoritative CH value (helps if some clients missed previous updates).
            if ((msg.userId || msg.teamId) && (msg.course_handicap === undefined || msg.course_handicap === null)) {
              try {
                if (msg.teamId && msg.userId) {
                  const res = await fetch(apiUrl(`/api/teams/${msg.teamId}/users/${msg.userId}`));
                  if (res.ok) {
                    const data = await res.json();
                    const ch = data?.course_handicap ?? data?.handicap ?? data?.courseHandicap ?? data?.handicap;
                    if (ch !== undefined && ch !== null) {
                      setEntries(prev => {
                        if (!Array.isArray(prev)) return prev;
                        return prev.map(e => {
                          try {
                            if (e.userId != null && msg.userId != null && Number(e.userId) === Number(msg.userId)) {
                              return { ...e, handicap: String(ch) };
                            }
                          } catch (err) {}
                          return e;
                        });
                      });
                    }
                  }
                }
              } catch (e) {
                // ignore network errors here; we only attempt to reconcile
              }
            }
          } catch (e) {}
        };
        const draftScoreHandler = (msg) => {
          try {
            if (!msg || Number(msg.competitionId) !== compId) return;
            // Ignore rebroadcasts that originated from this client to prevent double-processing
            if (msg.originSocketId && socket && socket.id && msg.originSocketId === socket.id) return;
            setEntries(prev => {
              if (!Array.isArray(prev)) return prev;
              const updated = prev.map(e => {
                try {
                  // match by userId primarily
                  if (msg.userId && e.userId && Number(e.userId) === Number(msg.userId)) {
                    const newScores = Array.isArray(e.scores) ? e.scores.slice() : Array(18).fill('');
                    if (msg.holeIndex != null) {
                      newScores[msg.holeIndex] = msg.strokes == null ? '' : msg.strokes;
                    } else if (Array.isArray(msg.scores)) {
                      // adopt any provided full scores array
                      const incoming = msg.scores.map(v => (v == null ? '' : v));
                      for (let i = 0; i < Math.min(18, incoming.length); i++) newScores[i] = incoming[i];
                    }
                    const gross = newScores.reduce((s, v) => s + (parseInt(v, 10) || 0), 0);
                    return { ...e, scores: newScores, total: gross };
                  }
                  // match by teamId inside groupTeamIds (4BBB split teams)
                  if (msg.teamId && Array.isArray(e.groupTeamIds) && e.groupTeamIds.includes(msg.teamId) && msg.userId && e.userId && Number(e.userId) === Number(msg.userId)) {
                    const newScores = Array.isArray(e.scores) ? e.scores.slice() : Array(18).fill('');
                    if (msg.holeIndex != null) newScores[msg.holeIndex] = msg.strokes == null ? '' : msg.strokes;
                    const gross = newScores.reduce((s, v) => s + (parseInt(v, 10) || 0), 0);
                    return { ...e, scores: newScores, total: gross };
                  }
                  // fallback: match by name
                  if (msg.playerName && e.name && String(e.name) === String(msg.playerName)) {
                    const newScores = Array.isArray(e.scores) ? e.scores.slice() : Array(18).fill('');
                    if (msg.holeIndex != null) newScores[msg.holeIndex] = msg.strokes == null ? '' : msg.strokes;
                    else if (Array.isArray(msg.scores)) {
                      const incoming = msg.scores.map(v => (v == null ? '' : v));
                      for (let i = 0; i < Math.min(18, incoming.length); i++) newScores[i] = incoming[i];
                    }
                    const gross = newScores.reduce((s, v) => s + (parseInt(v, 10) || 0), 0);
                    return { ...e, scores: newScores, total: gross };
                  }
                } catch (err) { /* ignore per-entry errors */ }
                return e;
              });
              return updated;
            });
          } catch (e) {}
        };
        try {
          socket.on('scores-updated', handler);
          socket.on('medal-player-updated', handler);
          socket.on('team-user-updated', handler);
          socket.on('client-team-user-updated', draftHandler);
          socket.on('score-draft-updated', draftScoreHandler);
        } catch (e) {}
        return () => {
          try { socket.emit('leave', { competitionId: compId }); } catch (e) {}
          try { socket.off('scores-updated', handler); socket.off('medal-player-updated', handler); socket.off('team-user-updated', handler); socket.off('client-team-user-updated', draftHandler); socket.off('score-draft-updated', draftScoreHandler); } catch (e) {}
        };
      }, [comp]);

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
  // Normalize a player name for tolerant matching (strip curly quotes, extra punctuation,
  // collapse whitespace, lower-case). Used when matching `group.handicaps` keys to
  // group player names which may differ in punctuation/quotes.
  function normalizeName(s) {
    if (!s && s !== 0) return '';
    try {
      return String(s)
        .normalize('NFKD')
        // replace smart quotes
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        // remove double single-quotes used in some exports
        .replace(/''/g, "'")
        // remove parentheses and double quotes
        .replace(/["()\[\]{}]/g, '')
        // remove any remaining punctuation except letters, numbers, spaces, hyphen and apostrophe
        .replace(/[^\w\s\-']/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    } catch (e) {
      return String(s || '').trim().toLowerCase();
    }
  }

  function getHandicapFromGroup(group, playerName) {
      if (!group) return undefined;
      const hand = group.handicaps || {};
      if (!hand || Object.keys(hand).length === 0) return undefined;

      // 1) exact key
      if (hand[playerName] != null) return hand[playerName];

      // 2) normalized exact key
      const normMap = {};
      Object.keys(hand).forEach(k => { normMap[normalizeName(k)] = hand[k]; });
      const n = normalizeName(playerName);
      if (n && normMap[n] != null) return normMap[n];

      // 3) try compact display variants (nick/displayName inside quotes/parentheses)
      const compact = compactDisplayName({ name: playerName, displayName: '', nick: '' });
      if (compact) {
        const nc = normalizeName(compact);
        if (nc && normMap[nc] != null) return normMap[nc];
      }

      // 4) fuzzy contains / substring match (both directions) and last-name heuristic
      for (const key of Object.keys(hand)) {
        const nk = normalizeName(key);
        if (!nk) continue;
        try {
          if (n && (nk.includes(n) || n.includes(nk))) {
            console.debug && console.debug('getHandicapFromGroup: matched by contains', { playerName, key, nk, n, handicap: hand[key] });
            return hand[key];
          }
          // last-name heuristic: check if normalized last token of playerName appears in key
          const parts = (n || '').split(' ').filter(Boolean);
          const last = parts.length > 0 ? parts[parts.length - 1] : '';
          if (last && nk.includes(last)) {
            console.debug && console.debug('getHandicapFromGroup: matched by last-name', { playerName, key, nk, last, handicap: hand[key] });
            return hand[key];
          }
        } catch (e) {
          // ignore and continue
        }
      }

      return undefined;
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
        console.log('[saveFines] Called with:', { teamId, userId, fines, playerName, compId });
        try {
          if (teamId && userId) {
            console.log('[saveFines] Using direct team/user endpoint');
            const adminSecret = import.meta.env.VITE_ADMIN_SECRET || window.REACT_APP_ADMIN_SECRET || '';
            const url = apiUrl(`/api/teams/${teamId}/users/${userId}`);
            const body = { fines: fines !== '' && fines != null ? Number(fines) : null };
            console.log('[saveFines] Request:', url, body);
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
              console.error('[saveFines] Direct save failed:', res.status, text);
              alert('Failed to save fines: ' + res.status + ' ' + text);
              return;
            }
            const data = await res.json();
            console.log('[saveFines] Direct save succeeded:', data);
            setEntries(es => es.map(e => (e.teamId === teamId && e.userId === userId) ? { ...e, fines: data.fines ?? (fines !== '' ? fines : '') } : e));
            return;
          }
          if (!compId || !playerName) {
            console.error('[saveFines] Missing compId or playerName');
            alert('Cannot save fines: missing team/user and insufficient fallback data');
            return;
          }
          console.log('[saveFines] Using fallback competition/player endpoint');
          const url = apiUrl(`/api/competitions/${compId}/players/${encodeURIComponent(playerName)}/fines`);
          const body = { fines: fines !== '' && fines != null ? Number(fines) : null };
          console.log('[saveFines] Fallback request:', url, body);
          const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          if (!res.ok) {
            const text = await res.text();
            console.error('[saveFines] Fallback save failed:', res.status, text);
            alert('Fallback save failed: ' + res.status + ' ' + text);
            return;
          }
          const data = await res.json();
          console.log('[saveFines] Fallback save succeeded:', data);
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
        const compTypeStrLocal = (comp && String(comp.type || '').toLowerCase()) || '';
        const compNameStrLocal = (comp && String(comp.name || comp.title || '').toLowerCase()) || '';
        const isIndividualComp = comp && ((compTypeStrLocal.includes('individual') && compTypeStrLocal.includes('stableford')) || (compNameStrLocal.includes('individual') && compNameStrLocal.includes('stableford')));

        // If this is an Individual Stableford competition, treat each player as their
        // own team so they are ranked by their individual Stableford points.
        if (isIndividualComp) {
          (groups || []).forEach((group, idx) => {
            (group.players || []).forEach((name, i) => {
              let ent = entries.find(e => (e.name || '').trim().toLowerCase() === (name || '').trim().toLowerCase());
              // Check if there's a custom displayName for this guest
              let customDisplayName = '';
              if (Array.isArray(group.displayNames) && group.displayNames[i] && group.displayNames[i].trim()) {
                customDisplayName = group.displayNames[i].trim();
              }
              if (!ent && customDisplayName) {
                const guestName = customDisplayName.toLowerCase();
                ent = entries.find(e => (e.name || '').trim().toLowerCase() === guestName);
              }
              if (!ent) {
                const scores = group.scores?.[name] || Array(18).fill('');
                const handicap = getHandicapFromGroup(group, name) ?? '';
                const gross = scores.reduce((s, v) => s + (parseInt(v, 10) || 0), 0);
                ent = { name, scores, total: gross, handicap, groupIdx: idx };
              }
              const stable = playerStableford(ent);
              const playerObj = {
                name: ent.name,
                displayName: customDisplayName || ent.displayName || '',
                userId: ent.userId || null,
                teamId: ent.teamId || null,
                waters: ent.waters || '',
                dog: ent.dog || false,
                twoClubs: ent.twoClubs || '',
                fines: ent.fines || '',
                scores: ent.scores || Array(18).fill(''),
                gross: ent.total || 0,
                // preserve the original handicap field for correctness in helpers
                handicap: ent.handicap !== undefined ? ent.handicap : '',
                ph: getPlayingHandicap(ent, comp),
                ch: ent.handicap !== '' ? parseFloat(ent.handicap) || 0 : 0,
                net: (ent.total || 0) - getPlayingHandicap(ent, comp),
                dthNet: (ent.total || 0) - (ent.handicap !== '' ? parseFloat(ent.handicap) || 0 : 0),
                points: stable.total,
                perHole: stable.perHole
              };
              // Calculate back 9 points (holes 10-18, indices 9-17)
              const back9Points = (stable.perHole || []).slice(9, 18).reduce((sum, val) => sum + (val || 0), 0);
              teams.push({ groupIdx: idx, players: [playerObj], teamPoints: Number(stable.total || 0), computedTeamPoints: Number(stable.total || 0), back9Points, teeTime: group.teeTime || '', teamId: ent.teamId || null });
            });
          });
          // sort/assign positions and return early for Individual Stableford comps
          try {
            console.log('AllianceLeaderboard: teams pre-sort debug (individual)', teams.map(t => ({ teamId: t.teamId, teamPoints: t.teamPoints, players: (t.players || []).map(p => ({ name: p.name, points: p.points, perHole: p.perHole })) })));
          } catch (e) {}
          teams.sort((a,b) => b.teamPoints - a.teamPoints);
          let lastPoints = null;
          let lastPos = 0;
          const rankedInd = teams.map((t, i) => {
            if (i === 0) { lastPos = 1; lastPoints = t.teamPoints; return { ...t, pos: 1 }; }
            if (t.teamPoints === lastPoints) return { ...t, pos: lastPos };
            lastPos = lastPos + 1; lastPoints = t.teamPoints; return { ...t, pos: lastPos };
          });
          return rankedInd;
        }

        (groups || []).forEach((group, idx) => {
          const groupPlayers = (group.players || []).map((name, i) => {
            let ent = entries.find(e => (e.name || '').trim().toLowerCase() === (name || '').trim().toLowerCase());
            // Check if there's a custom displayName for this guest
            let customDisplayName = '';
            if (Array.isArray(group.displayNames) && group.displayNames[i] && group.displayNames[i].trim()) {
              customDisplayName = group.displayNames[i].trim();
            }
            if (!ent && customDisplayName) {
              const guestName = customDisplayName.toLowerCase();
              ent = entries.find(e => (e.name || '').trim().toLowerCase() === guestName);
            }
            if (!ent) {
              const scores = group.scores?.[name] || Array(18).fill('');
              const handicap = getHandicapFromGroup(group, name) ?? '';
              const gross = scores.reduce((s, v) => s + (parseInt(v, 10) || 0), 0);
              ent = { name, scores, total: gross, handicap, groupIdx: idx };
            }
            const ch = ent.handicap !== '' ? parseFloat(ent.handicap) || 0 : 0;
            const ph = getPlayingHandicap(ent, comp);
            const dthNet = (ent.total || 0) - ch;
            const stable = playerStableford(ent);
            return {
              name: ent.name,
              displayName: customDisplayName || ent.displayName || '',
              userId: ent.userId || null,
              teamId: ent.teamId || null,
              waters: ent.waters || '',
              dog: ent.dog || false,
              twoClubs: ent.twoClubs || '',
              fines: ent.fines || '',
              scores: ent.scores || Array(18).fill(''),
              gross: ent.total || 0,
              handicap: ent.handicap !== undefined ? ent.handicap : '',
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

            try {
              console.log('AllianceLeaderboard: 4BBB compute', {
                groupIdx: idx,
                teamIdA,
                teamIdB,
                pairA: pairA.map(p => ({ name: p.name, ch: p.ch, scores: p.scores, perHole: p.perHole, points: p.points })),
                pairB: pairB.map(p => ({ name: p.name, ch: p.ch, scores: p.scores, perHole: p.perHole, points: p.points })),
                computedA,
                computedB,
                backendA,
                backendB
              });
            } catch (e) {}

            // Prefer the computed BB score for display when there's a mismatch with DB for 2-player pairs
            const chosenA = (typeof backendA === 'number' && backendA === computedA) ? backendA : computedA;
            const chosenB = (typeof backendB === 'number' && backendB === computedB) ? backendB : computedB;

            // Build debug per-hole arrays (max per-hole for pair)
            const perHoleBestA = Array(18).fill(0).map((_, i) => Math.max((pairA[0].perHole?.[i] || 0), (pairA[1].perHole?.[i] || 0)));
            const perHoleBestB = Array(18).fill(0).map((_, i) => Math.max((pairB[0].perHole?.[i] || 0), (pairB[1].perHole?.[i] || 0)));
            const back9A = perHoleBestA.slice(9, 18).reduce((s, v) => s + (v || 0), 0);
            const back9B = perHoleBestB.slice(9, 18).reduce((s, v) => s + (v || 0), 0);
            teams.push({ groupIdx: idx, players: pairA, teamPoints: chosenA, computedTeamPoints: computedA, backendTeamPoints: (typeof backendA === 'number' ? backendA : undefined), back9Points: back9A, teeTime: group.teeTime || '', teamId: teamIdA, debug: { perHoleBest: perHoleBestA, playersPerHole: [(pairA[0].perHole || []), (pairA[1].perHole || [])] } });
            teams.push({ groupIdx: idx, players: pairB, teamPoints: chosenB, computedTeamPoints: computedB, backendTeamPoints: (typeof backendB === 'number' ? backendB : undefined), back9Points: back9B, teeTime: group.teeTime || '', teamId: teamIdB, debug: { perHoleBest: perHoleBestB, playersPerHole: [(pairB[0].perHole || []), (pairB[1].perHole || [])] } });
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
            teams.push({ groupIdx: idx, players: groupPlayers, teamPoints: (typeof backendPoints === 'number' ? backendPoints : teamPoints), computedTeamPoints: teamPoints, back9Points: back, teeTime: group.teeTime || '', teamId: (group.teamId || group.id || group.team_id || group.group_id) });
          }
        });
        try {
          // Debug: print per-team computed vs backend values and per-player stats (include per-hole arrays)
          console.log('AllianceLeaderboard: teams pre-sort debug', teams.map(t => ({
            teamId: t.teamId,
            teamPoints: t.teamPoints,
            computedTeamPoints: t.computedTeamPoints,
            backendTeamPoints: (t.teamId != null ? backendTeamPointsMap[t.teamId] : undefined),
            perHoleBest: t.debug?.perHoleBest,
            players: (t.players || []).map(p => ({ name: p.name, ch: p.ch, ph: p.ph, gross: p.gross, points: p.points, perHole: p.perHole }))
          })));
        } catch (e) {}
        try { console.log('AllianceLeaderboard: teams ranked (post-sort)', teams.map(t => ({ teamId: t.teamId, teamPoints: t.teamPoints }))); } catch (e) {}
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
  const compTypeStrRender = (comp && String(comp.type || '').toLowerCase()) || '';
  const compNameStrRender = (comp && String(comp.name || comp.title || '').toLowerCase()) || '';
  const isIndividualRender = comp && ((compTypeStrRender.includes('individual') && compTypeStrRender.includes('stableford')) || (compNameStrRender.includes('individual') && compNameStrRender.includes('stableford')));
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
          const pdf = new jsPDF('l', 'mm', 'a4');
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
        const pdf = new jsPDF('l', 'mm', 'a4');
        const margin = 10; const lineHeight = 7;
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        let y = margin;
        pdf.setFontSize(12); pdf.setTextColor(0,0,0);
        const titleCompType = COMP_TYPE_DISPLAY[comp?.type] || comp?.type || 'Competition';
        pdf.text(`${(comp?.name) || 'Competition'} - ${titleCompType}`, margin, y); y += lineHeight;
        pdf.setFontSize(10);
        let formattedDate = '-';
        if (comp?.date) {
          try { const d = new Date(comp.date); if (!isNaN(d.getTime())) { const dd = String(d.getDate()).padStart(2,'0'); const mm = String(d.getMonth()+1).padStart(2,'0'); const yyyy = d.getFullYear(); formattedDate = `${dd}/${mm}/${yyyy}`; } } catch (e) { formattedDate = comp?.date || '-'; }
        }
        pdf.text(`Date: ${formattedDate}`, margin, y); y += lineHeight * 1.2;
        const allowanceText = comp?.handicapallowance && comp.handicapallowance !== 'N/A' ? `${comp.handicapallowance}%` : (comp?.handicapallowance === 'N/A' ? 'N/A' : '100%');
        const courseText = comp?.club || comp?.course || '-';
        pdf.text(`Course: ${courseText}`, margin, y); pdf.text(`Handicap Allowance: ${allowanceText}`, margin + 80, y); y += lineHeight * 1.2;
        y += lineHeight * 0.3;
        const guests = []; (comp.groups || []).forEach(g => { (g.players || []).forEach((name, i) => { if (name && name.startsWith('Guest') && g.displayNames && g.displayNames[i] && g.displayNames[i].trim()) { guests.push(g.displayNames[i].trim()); } }); });
        pdf.text(`Guests: ${guests.length > 0 ? guests.join(', ') : 'None'}`, margin, y); y += lineHeight * 1.2;
        pdf.text(`Notes: ${comp?.notes || '-'}`, margin, y); y += lineHeight * 1.2;

  const rows = [];
  teams.forEach(team => { team.players.forEach(p => { const holesPlayed = (p.perHole && p.perHole.filter(v => v != null).length) || (p.scores && p.scores.filter(s => s && s !== '').length) || 0; const thru = holesPlayed === 18 ? 'F' : holesPlayed; rows.push({ pos: team.pos, teamPoints: team.teamPoints, back9Points: team.back9Points ?? 0, teeTime: team.teeTime, name: p.name, displayName: p.displayName || '', userId: p.userId || null, teamId: team.teamId || null, handicap: p.handicap ?? '', dog: p.dog || false, waters: p.waters || '', twoClubs: p.twoClubs || '', fines: p.fines || '', gross: p.gross, net: p.net, dthNet: p.dthNet, points: p.points, thru }); }); });

        const goodScores = rows.filter(r => typeof r.dthNet === 'number' && r.dthNet < 70 && r.thru === 'F');
        pdf.setFont(undefined, 'bold'); pdf.text('Good Scores', margin, y); y += lineHeight; pdf.setFont(undefined, 'normal');
        if (goodScores && goodScores.length > 0) { goodScores.forEach(p => { if (y > pageHeight - margin - lineHeight) { pdf.addPage(); y = margin; } const displayName = (p.displayName || p.name || '').toUpperCase(); pdf.text(`${displayName}: Net ${p.dthNet}`, margin, y); y += lineHeight; }); } else { pdf.text('No one.', margin, y); y += lineHeight; }
        y += lineHeight * 0.5;

  const scoreLabel = (comp && ((String(comp.type || '').toLowerCase().includes('individual') && String(comp.type || '').toLowerCase().includes('stableford')) || (String(comp.name || comp.title || '').toLowerCase().includes('individual') && String(comp.name || comp.title || '').toLowerCase().includes('stableford')))) ? 'Points' : 'Score';
  const headers = ['Pos','Name','Thru',scoreLabel,'Gross','Full H/Cap','CH Net','PH Net','Back 9','Dog','Waters','2Clubs','Fines'];
        const colWidths = [12,48,12,18,18,22,18,18,18,10,18,18,18];
        const tableStartY = y;
        // Draw header row with grid
        let x = margin; 
        pdf.setFont(undefined,'bold'); 
        pdf.setDrawColor(0);
        pdf.setLineWidth(0.1);
        headers.forEach((h,i)=>{ 
          pdf.rect(x, y - lineHeight + 2, colWidths[i], lineHeight);
          if (i === 1) { 
            pdf.text(h, x + 1, y); 
          } else { 
            pdf.text(h, x + (colWidths[i] || 20) / 2, y, { align: 'center' }); 
          } 
          x += colWidths[i] || 20; 
        }); 
        pdf.setFont(undefined,'normal'); 
        y += lineHeight;

        rows.forEach(r => { 
          let x = margin;
          if (y > pageHeight - margin - lineHeight) { 
            pdf.addPage(); 
            y = margin;
            // Redraw header on new page
            x = margin;
            pdf.setFont(undefined,'bold');
            headers.forEach((h,i)=>{ 
              pdf.rect(x, y - lineHeight + 2, colWidths[i], lineHeight);
              if (i === 1) { 
                pdf.text(h, x + 1, y); 
              } else { 
                pdf.text(h, x + (colWidths[i] || 20) / 2, y, { align: 'center' }); 
              } 
              x += colWidths[i] || 20; 
            }); 
            pdf.setFont(undefined,'normal');
            y += lineHeight;
            x = margin; // Reset x after header
          } 
          const display = (r.displayName || r.name || '').toUpperCase();
          const displayWithCH = display + (r.handicap ? ` (${r.handicap})` : '');
          const rowValues = [r.pos, displayWithCH, String(r.thru), String(r.teamPoints), String(r.gross || ''), String(r.handicap ?? ''), String(r.dthNet || ''), String(r.net || ''), String(r.back9Points || ''), r.dog ? 'Y' : '', r.waters || '', r.twoClubs || '', r.fines || '']; 
          rowValues.forEach((val,i)=>{ 
            pdf.rect(x, y - lineHeight + 2, colWidths[i], lineHeight);
            let text = String(val || ''); 
            if (i === 1 && text.length > 20) text = text.slice(0,17) + '...'; 
            if (i === 1) { 
              pdf.text(text, x + 1, y); 
            } else { 
              pdf.text(text, x + (colWidths[i] || 20) / 2, y, { align: 'center' }); 
            } 
            x += colWidths[i] || 20; 
          }); 
          y += lineHeight; 
        });

        try {
          const d = comp?.date ? new Date(comp.date) : new Date();
          const yr = String(d.getFullYear());
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          const datePart = `${yr}${m}${dd}`;
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
  teams.forEach((team, teamIndex) => {
    // Sort players within the team so non-guests appear first
    const sortedPlayers = (team.players || []).slice().sort((a, b) => {
      const aIsGuest = (a.name || '').startsWith('Guest');
      const bIsGuest = (b.name || '').startsWith('Guest');
      if (aIsGuest && !bIsGuest) return 1; // a after b
      if (!aIsGuest && bIsGuest) return -1; // a before b
      return 0; // keep original order
    });
    
    sortedPlayers.forEach(p => {
      const holesPlayed = (p.perHole && p.perHole.filter(v => v != null).length) || (p.scores && p.scores.filter(s => s && s !== '').length) || 0;
      const thru = holesPlayed === 18 ? 'F' : holesPlayed;
      // Use the team's teamPoints for the Score column so both teammates display the same BB Score
      rowsForUI.push({
        pos: team.pos,
        teamPoints: team.teamPoints,
        computedTeamPoints: team.computedTeamPoints ?? null,
        back9Points: team.back9Points ?? 0,
        teeTime: team.teeTime,
        name: p.name,
        displayName: p.displayName || '',
        userId: p.userId || null,
        teamId: team.teamId || null,
        teamIndex: teamIndex,
        dog: p.dog || false,
        waters: p.waters || '',
        twoClubs: p.twoClubs || '',
        fines: p.fines || '',
        handicap: p.handicap || p.ch || '',
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

  // compute user visibility for My Scorecard

  const today = new Date();
  const isOpenComp = comp && (comp.status === 'Open' || (comp.date && new Date(comp.date) >= new Date(today.getFullYear(), today.getMonth(), today.getDate())));
  const isPlayerInComp = currentUser && comp && comp.groups && Array.isArray(comp.groups) && comp.groups.some(g => Array.isArray(g.players) && g.players.includes(currentUser.name));
  const showMyScorecard = Boolean((isAdmin && isAdmin(currentUser)) || isPlayerInComp);

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
                <div className="flex justify-center gap-3 mb-4">
                {showMyScorecard && (
                  <button
                    onClick={() => {
                      if (!isAdmin(currentUser) && !isPlayerInComp) return;
                      // alliance comps aren't medal-type, route to generic scorecard
                      const cid = comp?.id || window.location.pathname.split('/').pop();
                      navigate(`/scorecard/${cid}`);
                    }}
                    className="py-2 px-4 rounded-2xl font-extrabold transition flex items-center justify-center gap-2"
                    style={ (isAdmin(currentUser) || isOpenComp) ? { backgroundColor: '#FFD700', color: '#002F5F', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)', fontFamily: 'Lato, Arial, sans-serif' } : { backgroundColor: '#FFD700', color: '#002F5F', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)', opacity: 0.5, pointerEvents: 'none', fontFamily: 'Lato, Arial, sans-serif' } }
                    onMouseOver={e => { if (isAdmin(currentUser) || isOpenComp) e.currentTarget.style.backgroundColor = '#ffe066'; }}
                    onMouseOut={e => { if (isAdmin(currentUser) || isOpenComp) e.currentTarget.style.backgroundColor = '#FFD700'; }}
                  >
                    <SignalIcon className="h-5 w-5" style={{ color: '#002F5F' }} />
                    <span>My Scorecard</span>
                  </button>
                )}
                <button onClick={() => exportToPDF()} className="py-2 px-4 bg-[#0e3764] text-[#FFD700] border border-[#FFD700] rounded-2xl hover:bg-[#FFD700] hover:text-[#0e3764] transition" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>Export Results</button>
              </div>

              {comp && (
                <div className="text-white/90 text-base mb-4" style={{minWidth: 260, textAlign: 'left'}}>
                  <span className="font-semibold">Date:</span> {comp.date ? (new Date(comp.date).toLocaleDateString('en-GB')) : '-'} <br />
                  <span className="font-semibold">Type:</span> {COMP_TYPE_DISPLAY[comp?.type] || (comp?.type ? comp.type.replace(/(^|\s|_)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase()).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/-/g, ' ').replace(/(Four\s+Bbb)/i, '4BBB') : '')} <br />
                  <span className="font-semibold">Course:</span> {comp?.club || comp?.course || '-'} <br />
                  <span className="font-semibold">Handicap Allowance:</span> {comp.handicapallowance && comp.handicapallowance !== 'N/A' ? comp.handicapallowance + '%' : 'N/A'} <br />
                  <span className="font-semibold" style={{ marginTop: '0.5rem', display: 'inline-block' }}>Guests:</span> {(() => {
                    const guests = [];
                    (comp.groups || []).forEach(g => {
                      (g.players || []).forEach((name, i) => {
                        if (name && name.startsWith('Guest') && g.displayNames && g.displayNames[i] && g.displayNames[i].trim()) {
                          guests.push(g.displayNames[i].trim());
                        }
                      });
                    });
                    return guests.length > 0 ? guests.join(', ') : 'None';
                  })()} <br />

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
                    {goodScores.length === 0 ? <div style={{marginLeft: 0}}>No one.</div> : goodScores.map(p => (<div key={p.name} style={{marginBottom: 2, marginLeft: 0}}>{(p.displayName || p.name).toUpperCase()}: Net {p.dthNet}</div>))}
                  </div>
                </div>
              )}

              {rowsForUI.length === 0 ? (
                <div className="text-white/80">No scores submitted yet.</div>
              ) : (
                <div className={"w-full overflow-x-auto " + (showExtras ? 'show-extras' : '')}>
                  <div className="flex justify-end mb-2">
                    <button
                      className="extras-toggle ml-2 text-xs px-2 py-0.5 rounded font-semibold"
                      onClick={() => setShowExtras(s => !s)}
                      title={showExtras ? 'Hide extras' : 'View extras'}
                      style={{ background: '#0e3764', color: '#FFD700', border: '1px solid #FFD700' }}
                    >
                      {showExtras ? '- Hide Extras' : '+ View Extras'}
                    </button>
                    {isAdmin(currentUser) && (
                      <button
                        className="handicap-debug ml-2 text-xs px-2 py-0.5 rounded font-semibold"
                        onClick={() => setShowHandicaps(s => !s)}
                        title={showHandicaps ? 'Hide group handicaps' : 'Show group handicaps'}
                        style={{ background: showHandicaps ? '#FFD700' : '#0e3764', color: showHandicaps ? '#002F5F' : '#FFD700', border: '1px solid #FFD700' }}
                      >
                        {showHandicaps ? 'Hide Handicaps' : 'Show Handicaps'}
                      </button>
                    )}
                  </div>
                  {showHandicaps && (
                    <div className="mb-3 p-3 bg-white/5 rounded text-left text-[12px]" style={{ maxHeight: 220, overflow: 'auto' }}>
                      <div className="font-semibold mb-2">Group handicaps (raw from comp payload)</div>
                      {(groups || []).map((g, gi) => (
                        <div key={`gh-${gi}`} style={{ marginBottom: 8 }}>
                          <div style={{ fontWeight: 700 }}>Group {gi} (teamId: {g?.teamId ?? g?.id ?? '-'})</div>
                          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{JSON.stringify(g?.handicaps || {}, null, 2)}</pre>
                        </div>
                      ))}
                      <div className="font-semibold mt-2">Resolved entry handicaps (entries state)</div>
                      <pre style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{JSON.stringify((entries || []).map(e => ({ name: e.name, handicap: e.handicap })), null, 2)}</pre>
                    </div>
                  )}
                  <table className="min-w-full border text-center mb-8 text-[10px] sm:text-base" style={{ fontFamily: 'Lato, Arial, sans-serif', background: '#0e3764', color: 'white', borderColor: '#FFD700' }}>
                    <thead>
                      <tr style={{ background: '#00204A' }}>
                        <th className="border px-0.5 sm:px-2 py-0.5" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Pos</th>
                        <th className="border px-0.5 sm:px-2 py-0.5 text-left" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Name</th>
                        <th className="border px-0.5 sm:px-2 py-0.5" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Thru</th>
                        <th className="border px-0.5 sm:px-2 py-0.5" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>{isIndividualRender ? 'Points' : 'Score'}</th>
                        <th className="border px-0.5 sm:px-2 py-0.5" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Gross</th>
                        <th className="border px-0.5 sm:px-2 py-0.5" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>CH Net</th>
                        <th className="border px-0.5 sm:px-2 py-0.5" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>PH Net</th>
                        <th className={"border px-0.5 sm:px-2 py-0.5 hide-on-portrait" + (showExtras ? ' show-extras' : '')} style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Back 9</th>
                        <th className="border px-0.5 sm:px-2 py-0.5 hide-on-portrait" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Dog</th>
                        <th className="border px-0.5 sm:px-2 py-0.5 hide-on-portrait" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Waters</th>
                        <th className="border px-0.5 sm:px-2 py-0.5 hide-on-portrait" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>2 Clubs</th>
                        <th className="border px-0.5 sm:px-2 py-0.5 hide-on-portrait" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Fines</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowsForUI.map((entry, idx) => {
                        // Cycle through 5 very distinct colors alternating blues, grays, and teals
                        const colorShades = [
                          'rgba(20, 60, 110, 0.85)',   // deep navy blue
                          'rgba(70, 80, 90, 0.8)',     // dark slate gray
                          'rgba(30, 100, 140, 0.8)',   // ocean blue
                          'rgba(90, 100, 110, 0.75)',  // lighter blue-gray
                          'rgba(40, 80, 100, 0.85)'    // dark teal-blue
                        ];
                        const bgColor = colorShades[entry.teamIndex % 5];
                        
                        // Find all players in this team
                        const teamPlayers = rowsForUI.filter(r => r.teamIndex === entry.teamIndex);
                        const isFirstInTeam = teamPlayers[0] === entry;
                        const isExpanded = expandedTeams[entry.teamIndex];
                        
                        // Only show first player, or all if expanded
                        if (!isFirstInTeam && !isExpanded) return null;
                        
                        return (
                        <tr key={`${entry.name}-${idx}`} style={{ background: bgColor }}>
                          <td className="border px-0.5 sm:px-2 py-0.5 font-bold">
                            {isFirstInTeam && teamPlayers.length > 1 && (
                              <button
                                onClick={() => setExpandedTeams(prev => ({ ...prev, [entry.teamIndex]: !prev[entry.teamIndex] }))}
                                className="mr-1 text-[#FFD700] hover:text-white transition"
                                style={{ fontSize: '14px', fontWeight: 'bold' }}
                              >
                                {isExpanded ? '−' : '+'}
                              </button>
                            )}
                            {entry.pos}
                          </td>
                          <td className="border px-0.5 sm:px-2 py-0.5 text-left" style={{ textTransform: 'uppercase' }}>
                            <div className="max-w-none truncate">
                              {isFirstInTeam && !isExpanded && teamPlayers.length > 1 ? (
                                `${(compactDisplayName(entry) || entry.displayName || entry.name).toUpperCase()}'S TEAM`
                              ) : (
                                `${(compactDisplayName(entry) || entry.displayName || entry.name).toUpperCase()}${entry.handicap ? ` (${entry.handicap})` : ''}`
                              )}
                            </div>
                          </td>
                          <td className="border px-0.5 sm:px-2 py-0.5">{entry.thru}</td>
                          <td className="border px-0.5 sm:px-2 py-0.5">{entry.teamPoints}{(entry.backendTeamPoints !== undefined && entry.backendTeamPoints !== entry.teamPoints) ? ` (db ${entry.backendTeamPoints})` : (entry.computedTeamPoints != null && entry.computedTeamPoints !== entry.teamPoints ? ` (calc ${entry.computedTeamPoints})` : '')}</td>
                          <td className="border px-0.5 sm:px-2 py-0.5">{entry.gross}</td>
                          <td className={"border px-0.5 sm:px-2 py-0.5" + (showExtras ? ' show-extras' : '')}>{entry.dthNet}</td>
                          <td className="border px-0.5 sm:px-2 py-0.5">{entry.net}</td>
                          <td className={"border px-0.5 sm:px-2 py-0.5 hide-on-portrait" + (showExtras ? ' show-extras' : '')}>{entry.back9Points}</td>
                          <td className="border px-0.5 sm:px-2 py-0.5 hide-on-portrait">{entry.dog ? '🐶' : ''}</td>
                          <td className="border px-0.5 sm:px-2 py-0.5 hide-on-portrait">{entry.waters || ''}</td>
                          <td className="border px-0.5 sm:px-2 py-0.5 hide-on-portrait">{entry.twoClubs || ''}</td>
                          <td className="border px-0.5 sm:px-2 py-0.5 hide-on-portrait">
                            {isAdmin(currentUser) || isCaptain(currentUser, comp) ? (
                              <select
                                value={entry.fines || ''}
                                onChange={e => {
                                  const v = e.target.value;
                                  setEntries(es => es.map(x => x.name === entry.name ? { ...x, fines: v } : x));
                                  saveFines(entry.teamId, entry.userId, v, entry.name, comp?.id || null);
                                }}
                                className="w-12 text-center rounded focus:outline-none font-semibold"
                                style={{ border: 'none', backgroundColor: 'transparent', color: '#ffffff' }}
                              >
                                <option value="">0</option>
                                {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                              </select>
                            ) : (
                              entry.fines || ''
                            )}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          </div>
        </PageBackground>
      );
    }