// Helper for mobile input focus scroll
function handleInputFocus(e) {
  try {
    if (typeof window !== 'undefined' && (!('ontouchstart' in window) || window.innerWidth > 700)) {
      e.currentTarget.scrollIntoView({ block: 'center' });
    }
  } catch (err) {}
}
import React, { useEffect, useState, useRef } from 'react';
import { TrophyIcon } from '@heroicons/react/24/solid';
import { apiUrl } from './api';
import socket from './socket';
import { shouldShowPopup, markShown, checkAndMark } from './popupDedupe';
import { showLocalPopup } from './popupHelpers.jsx';
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
// Default player color classes. For 4BBB we want A+B to share A's color and C+D to share C's color.
function getPlayerColorsFor(props) {
  const defaultColors = [
    'bg-blue-100 text-blue-900',
    'bg-green-100 text-green-900',
    'bg-yellow-100 text-yellow-900',
    'bg-pink-100 text-pink-900'
  ];
  try {
    const is4bbb = (props?.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('4bbb'))
      || (props?.competition && props.competition.type && props.competition.type.toLowerCase().includes('4bbb'))
      || (props?.compTypeOverride && props.compTypeOverride.toString().toLowerCase().includes('4bbb'));
    if (is4bbb) {
      // A and B use color A, C and D use a green pair (light/dark green) for better contrast
      const greenPair = ['bg-emerald-100 text-emerald-900', 'bg-emerald-100 text-emerald-900'];
      return [defaultColors[0], defaultColors[0], greenPair[0], greenPair[1]];
    }
  } catch (e) {
    // fallback to defaults on error
  }
  return defaultColors;
}

export default function MedalScorecard(props) {
    // State for CH warning popup (must be top-level to avoid closure bugs)
    const [showCHWarning, setShowCHWarning] = useState(false);
    // State for incomplete scores warning popup
    const [showIncompleteScoresWarning, setShowIncompleteScoresWarning] = useState(false);
    const [hideIncompleteScoresWarning, setHideIncompleteScoresWarning] = useState(() => {
      try {
        return localStorage.getItem('hideIncompleteScoresWarning') === 'true';
      } catch (e) {
        return false;
      }
    });

    // Helper: true if all players have a non-empty CH
    function allPlayersHaveCH() {
      // Consider only active player slots (non-empty names)
      const activePlayers = Array.isArray(players) ? players.filter(Boolean) : [];
      if (typeof window !== 'undefined') {
        console.log('[CH CHECK] playerData:', playerData);
        activePlayers.forEach(pName => {
          const ch = playerData?.[pName]?.handicap;
          console.log(`[CH CHECK] ${pName}:`, ch, '| valid:', ch !== undefined && ch !== null && String(ch).trim() !== '' && !isNaN(Number(ch)));
        });
      }
      return activePlayers.length > 0 && activePlayers.every(pName => {
        const ch = playerData?.[pName]?.handicap;
        return ch !== undefined && ch !== null && String(ch).trim() !== '' && !isNaN(Number(ch));
      });
    }
  // Compute Playing Handicap (PH) given a course handicap and comp allowance
  function computePH(courseHandicap) {
    if (!comp || !comp.handicapallowance || isNaN(Number(comp.handicapallowance))) {
      return Number(courseHandicap) || 0;
    }
    return Math.round(Number(courseHandicap || 0) * Number(comp.handicapallowance) / 100);
  }
  // Per-cell saving spinner state: { [name:idx]: true }
  const [cellSaving, setCellSaving] = useState({});
  // Helper: true if any cell is saving
  const anyCellSaving = Object.values(cellSaving).some(Boolean);
  // Compute player colors based on competition type or overrideTitle
  const playerColors = getPlayerColorsFor(props);
  // Render numeric inputs as native picker selects on touch/narrow viewports
  const [useMobilePicker, setUseMobilePicker] = useState(false);
  // Save button status: 'idle' | 'saving' | 'saved'
  const [saveStatus, setSaveStatus] = useState('idle');
  const saveStatusTimeoutRef = useRef(null);
  useEffect(() => {
    function update() {
      try {
        const isTouch = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));
        const isNarrow = typeof window !== 'undefined' && window.innerWidth <= 768;
        setUseMobilePicker(Boolean(isTouch && isNarrow));
      } catch (e) { setUseMobilePicker(false); }
    }
    update();
    try { window.addEventListener('resize', update); } catch (e) {}
    return () => { try { window.removeEventListener('resize', update); } catch (e) {} };
  }, []);

  // --- Local helpers for MedalScorecard ---
  // Compute Playing Handicap (PH) using comp.handicapallowance logic
  function computePH(ch) {
    const allowanceRaw = comp?.handicapallowance ?? comp?.handicapAllowance ?? 100;
    const allowance = parseFloat(allowanceRaw) || 100;
    return Math.round((parseFloat(ch) || 0) * (allowance / 100));
  }

  // Stableford points logic (matches AllianceLeaderboard)
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

  // Compute per-player stableford totals (front/back/total) and per-hole points array
  const computePlayerStablefordTotals = (name) => {
    const perHole = Array(18).fill(null);
    let front = 0;
    let back = 0;
    let total = 0;
    const playingHandicap = computePH(playerData[name]?.handicap) || 0;
    holesArr.forEach((hole, idx) => {
      const raw = playerData[name]?.scores?.[idx];
      const gross = raw === '' || raw == null ? NaN : parseInt(raw, 10);
      if (!Number.isFinite(gross)) {
        perHole[idx] = null;
        return;
      }
      // compute strokes received using same logic as medal net
      let strokesReceived = 0;
      if (playingHandicap > 0) {
        const idxVal = hole.index || hole.index === 0 ? Number(hole.index) : undefined;
        if (playingHandicap >= 18) {
          strokesReceived = 1;
          if (playingHandicap - 18 >= idxVal) strokesReceived = 2;
          else if (idxVal <= (playingHandicap % 18)) strokesReceived = 2;
        } else if (idxVal <= playingHandicap) {
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
      // If the viewer is a member of the current 4-ball (players list), allow edits
      // for any row in this scorecard. Otherwise only allow editing own row.
      if (Array.isArray(players) && players.some(p => (p || '').trim().toLowerCase() === normViewer)) return true;
      return (playerName || '').trim().toLowerCase() === normViewer;
    } catch (e) {
      return false;
    }
  };
  const [comp, setComp] = useState(null);
  const [groups, setGroups] = useState([]);
  const [groupIdx, setGroupIdx] = useState(0);
  const [players, setPlayers] = useState([]);
  const [displayNames, setDisplayNames] = useState([]);
  const autoSetGroupIdxDone = React.useRef(false);
  const [playerData, setPlayerData] = useState({});
  
  // Helper to get display name for a player (uses custom guest name if set)
  const getDisplayName = (playerName, index) => {
    if (!playerName) return '';
    // If player starts with "Guest" and we have a custom display name, use it
    if (playerName.startsWith('Guest') && displayNames[index] && displayNames[index].trim()) {
      return displayNames[index];
    }
    return playerName;
  };
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
  // guard against double-touch/click causing immediate increment after activation
  const placeholderActivateRef = useRef({});
  // keep a very short-lived cache of the last action value per cell so rapid clicks
  // use a reliable immediate source instead of relying on React state/refs that
  // may not be synchronously updated on fast successive taps.
  const lastActionValueRef = useRef({});

  // Apply a +1 or -1 delta to a named player's hole index.
  // Behavior: if the cell is empty (placeholder), the first action "activates"
  // the placeholder to par (no movement). Subsequent actions use the most
  // recent value recorded in lastActionValueRef (if recent) or the current
  // playerDataRef value and then add the delta.
  function applyDeltaToHole(name, idx, delta) {
    if (!canEdit(name)) return;
    const key = `${name}:${idx}`;
    const hole = holesArr[idx] || {};
    // Prefer very recent action value to avoid staleness between rapid clicks
    const recent = lastActionValueRef.current[key];
    let parsed = null;
    if (recent && (Date.now() - (recent.ts || 0) < 1200) && Number.isFinite(parseInt(recent.value, 10))) {
      parsed = parseInt(recent.value, 10);
    } else {
      const raw = (playerDataRef.current && playerDataRef.current[name] && Array.isArray(playerDataRef.current[name].scores) && playerDataRef.current[name].scores[idx]) || '';
      parsed = Number.isFinite(parseInt(raw, 10)) ? parseInt(raw, 10) : null;
    }
    const base = (parsed !== null) ? parsed : (hole.par || 0);
    let next;
    if (parsed === null) {
      // first action from placeholder: activate to par (no +/-)
      next = base;
      // set activation guard to avoid duplicate immediate events
      placeholderActivateRef.current[key] = Date.now();
      setTimeout(() => { try { delete placeholderActivateRef.current[key]; } catch (e) {} }, 500);
    } else {
      next = Math.max(0, parsed + delta);
    }
    // Record last action immediately so rapid next clicks read this value
    try {
      lastActionValueRef.current[key] = { value: String(next), ts: Date.now() };
      setTimeout(() => { try { if (lastActionValueRef.current[key] && (Date.now() - (lastActionValueRef.current[key].ts || 0) > 1200)) delete lastActionValueRef.current[key]; } catch (e) {} }, 1500);
    } catch (e) {}
    handleScoreChange(name, idx, String(next));
  }
  
  // --- Per-group selected hole state for desktop/tablet navigation ---
  // selectedHoleByGroup: { [groupKey]: holeNumber }
  const [selectedHoleByGroup, setSelectedHoleByGroup] = useState({});
  // Helper: get current group key (robust fallback)
  const group = groups[groupIdx] || {};
  const groupKey = group.id || group.group_id || group.groupId || group.name || group.label || String(groupIdx);
  // Get selected hole for current group, fallback to 1
  const selectedHole = selectedHoleByGroup[groupKey] || 1;

  // Handler for hole navigation (prev/next/select) -- per group
  const handleHoleChange = (holeNum) => {
    if (!groupKey) return;
    setSelectedHoleByGroup((prev) => ({
      ...prev,
      [groupKey]: holeNum,
    }));
  };

  // When group changes, if no hole is set for this group, default to 1
  useEffect(() => {
    if (!groupKey) return;
    setSelectedHoleByGroup((prev) => {
      if (prev[groupKey]) return prev;
      return { ...prev, [groupKey]: 1 };
    });
  }, [groupKey]);
  // Mobile selected player for compact score entry
  const [mobileSelectedPlayer, setMobileSelectedPlayer] = useState('');
  // --- Per-group mobile selected hole state ---
  // mobileSelectedHoleByGroup: { [groupKey]: holeNumber }
  const [mobileSelectedHoleByGroup, setMobileSelectedHoleByGroup] = useState(() => {
    // Try to load from localStorage (per comp, per group)
    const obj = {};
    try {
      if (compId && groups && groups.length) {
        groups.forEach((g, idx) => {
          const gk = g?.id || g?.group_id || g?.groupId || g?.name || g?.label || String(idx);
          const raw = localStorage.getItem(`dth:mobileSelectedHole:${compId}:${gk}`);
          const n = raw ? parseInt(raw, 10) : NaN;
          obj[gk] = (Number.isFinite(n) && n >= 1 && n <= 18) ? n : 1;
        });
      }
    } catch (e) {}
    return obj;
  });
  // Helper: get current group key (robust fallback)
  // (reuse groupKey from above)
  const mobileSelectedHole = mobileSelectedHoleByGroup[groupKey] || 1;
  const setMobileSelectedHole = (holeNumOrUpdater) => {
    setMobileSelectedHoleByGroup(prev => {
      const val = typeof holeNumOrUpdater === 'function' ? holeNumOrUpdater(prev[groupKey] || 1) : holeNumOrUpdater;
      // Persist to localStorage
      try { if (compId && groupKey) localStorage.setItem(`dth:mobileSelectedHole:${compId}:${groupKey}`, String(val)); } catch (e) {}
      return { ...prev, [groupKey]: val };
    });
  };

  // Ref to the mobile hole entry container so we can scroll it into view when returning
  const mobileHoleRef = useRef(null);
  
  // Flag to suppress mobile hole auto-advance during batch operations (like Generate Data)
  const suppressMobileAdvanceRef = useRef(false);
  
  // Track which holes have already triggered auto-navigation (per competition)
  const autoNavigatedHolesRef = useRef(new Set());
  const autoNavTimerRef = useRef(null);

  // When group or comp changes, if no hole is set for this group, default to 1
  useEffect(() => {
    if (!groupKey) return;
    setMobileSelectedHoleByGroup(prev => {
      if (prev[groupKey]) return prev;
      // Persist to localStorage
      try { if (compId && groupKey) localStorage.setItem(`dth:mobileSelectedHole:${compId}:${groupKey}`, '1'); } catch (e) {}
      return { ...prev, [groupKey]: 1 };
    });
  }, [groupKey, compId]);

  // Generate dummy test data (admin only)
  const generateDummyData = async () => {
    if (!isAdmin) return;
    if (!compId || !groups.length) {
      toast.error('No competition loaded');
      return;
    }
    
    // Suppress mobile hole auto-advance during batch generation
    suppressMobileAdvanceRef.current = true;
    
    const newPlayerData = { ...playerDataRef.current };
    const newMiniTableStats = { ...miniTableStats };
    
    players.forEach(playerName => {
      if (!newPlayerData[playerName]) {
        newPlayerData[playerName] = { scores: Array(18).fill(''), handicap: '' };
      }
      
      // Generate random course handicap (0-36)
      newPlayerData[playerName].handicap = String(Math.floor(Math.random() * 37));
      
      // Generate random scores for each hole (par -2 to par +4)
      newPlayerData[playerName].scores = holesArr.map(hole => {
        const par = hole.par || 4;
        const variance = Math.floor(Math.random() * 7) - 2; // -2 to +4
        return String(Math.max(1, par + variance));
      });
      
      // Random extras (stored separately in miniTableStats)
      newMiniTableStats[playerName] = {
        waters: String(Math.floor(Math.random() * 4)), // 0-3
        dog: Math.random() < 0.1, // 10% chance
        twoClubs: String(Math.floor(Math.random() * 3)) // 0-2
      };
    });
    
    setPlayerData(newPlayerData);
    playerDataRef.current = newPlayerData;
    setMiniTableStats(newMiniTableStats);
    
    // Auto-save the dummy data
    try {
      console.log('Saving all dummy data for', players.length, 'players...');
      
      // Save sequentially to avoid race conditions on the backend
      // (backend saves entire groups array, concurrent requests overwrite each other)
      let successCount = 0;
      let failCount = 0;
      
      for (const name of players) {
        const patchBody = {
          scores: newPlayerData[name].scores,
          handicap: newPlayerData[name].handicap,
          waters: newMiniTableStats[name].waters,
          dog: newMiniTableStats[name].dog,
          two_clubs: newMiniTableStats[name].twoClubs
        };
        console.log('Saving for', name, ':', patchBody);
        
        try {
          const res = await fetch(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patchBody)
          });
          console.log('Response for', name, ':', res.status);
          if (res.ok) {
            successCount++;
          } else {
            failCount++;
            console.error('Failed to save', name, ':', res.status, res.statusText);
          }
        } catch (err) {
          failCount++;
          console.error('Error saving for', name, ':', err);
        }
      }
      
      console.log('Dummy data save complete:', successCount, 'success,', failCount, 'failed');
      
      // Re-fetch to sync server state
      try {
        const res = await fetch(apiUrl(`/api/competitions/${compId}`));
        if (res.ok) {
          const data = await res.json();
          setComp(data);
          setGroups(Array.isArray(data.groups) ? data.groups : []);
        }
      } catch (e) {
        console.error('Error re-fetching competition:', e);
      }
    } catch (err) {
      console.error('Failed to save dummy data:', err);
    } finally {
      // Re-enable mobile hole auto-advance after batch operation completes
      suppressMobileAdvanceRef.current = false;
    }
  };


  // When mobileSelectedHole changes (or on initial mount when restored from localStorage)
  // and we're on a mobile viewport, scroll the hole entry container into view so the user
  // sees the active hole rather than the top of the page.
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const isMobile = window.matchMedia('(max-width: 640px)').matches;
      if (!isMobile) return;

      // On physical mobile devices the viewport can change (address bar, keyboard)
      // and programmatic scrolling can race the layout. Do repeated attempts with
      // increasing delays, prefer the VisualViewport API when available, and try
      // to focus a nearby interactive element using preventScroll so the keyboard
      // (if it opens) doesn't fight the scroll.
      let cancelled = false;
      const maxAttempts = 6;
      const delays = [150, 300, 600, 1200, 2000, 3500];
      let attempt = 0;

      const doScrollOnce = () => {
        if (cancelled) return true;
        try {
          const el = (mobileHoleRef && mobileHoleRef.current) ? mobileHoleRef.current : document.querySelector('[data-mobile-hole]');
          if (!el) return false;

          // Center using visualViewport when available (avoids page-level scroll conflicts)
          if (typeof window.visualViewport !== 'undefined' && window.visualViewport) {
            try {
              const rect = el.getBoundingClientRect();
              const vv = window.visualViewport;
              const targetTop = (vv.offsetTop || 0) + rect.top + (rect.height / 2) - (vv.height / 2);
              // Use scrollTo on visualViewport for better centering when browser UI is present
              if (typeof vv.scrollTo === 'function') vv.scrollTo({ left: vv.offsetLeft || 0, top: Math.max(0, targetTop), behavior: 'smooth' });
              else el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch (e) {
              try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (er) {}
            }
          } else {
            try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
          }

          // Try to focus an input/select/button within the container without scrolling
          try {
            const focusable = el.querySelector && el.querySelector('input,select,button,textarea');
            if (focusable && typeof focusable.focus === 'function') {
              try { focusable.focus({ preventScroll: true }); } catch (e) { focusable.focus(); }
            }
          } catch (e) {}

          return true;
        } catch (e) {
          return false;
        }
      };

      const scheduleAttempt = () => {
        if (cancelled) return;
        const ok = doScrollOnce();
        attempt += 1;
        if (!ok && attempt < maxAttempts) {
          const d = delays[Math.min(attempt, delays.length - 1)];
          setTimeout(scheduleAttempt, d);
        }
      };

      // Start attempts with a short initial delay
      const initial = setTimeout(scheduleAttempt, delays[0]);
      return () => { cancelled = true; clearTimeout(initial); };
    } catch (e) {}
  }, [mobileSelectedHole]);

  // Auto-navigate to next hole when all players have entered scores is fully disabled.

  // Use holes from the competition payload when available (map stroke_index -> index),
  // otherwise fall back to the defaultHoles constant.
  const holesArr = (comp && Array.isArray(comp.holes) && comp.holes.length === 18)
    ? comp.holes.map(h => ({ number: h.number, par: Number(h.par), index: (h.stroke_index != null ? Number(h.stroke_index) : (h.index != null ? Number(h.index) : undefined)) }))
    : (props && props.competition && Array.isArray(props.competition.holes) && props.competition.holes.length === 18)
      ? props.competition.holes.map(h => ({ number: h.number, par: Number(h.par), index: (h.stroke_index != null ? Number(h.stroke_index) : (h.index != null ? Number(h.index) : undefined)) }))
      : defaultHoles;

  // Per-cell styling for gross score inputs: eagle (<= par-2) => pink, birdie (par-1) => green,
  // blowup (>= par+3) => maroon. Returns an inline style object to merge into the input's style.
  function scoreCellStyle(name, idx) {
    try {
      const raw = playerData?.[name]?.scores?.[idx];
      const gross = raw === '' || raw == null ? NaN : parseInt(raw, 10);
  const hole = holesArr[idx];
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
  const hole = holesArr[idx];
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
            setDisplayNames(data.groups[groupIdx]?.displayNames || []);
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
    // Only auto-select the viewer's own group once on initial load. If the viewer
    // explicitly picks another group via the selector, do not override that choice.
    if (autoSetGroupIdxDone.current) return;
    const foundIdx = groups.findIndex(g => Array.isArray(g.players) && g.players.some(p => normalize(p) === normalize(resolvedName)));
    if (foundIdx >= 0 && foundIdx !== groupIdx) {
      setGroupIdx(foundIdx);
    }
    autoSetGroupIdxDone.current = true;
  }, [groups, resolvedName, isAdmin, groupIdx]);

  // Reset auto-select flag when competition changes so user's group is re-selected
  useEffect(() => {
    console.log('[Group Auto-Select] Resetting flag for compId:', compId);
    autoSetGroupIdxDone.current = false;
  }, [compId]);

  // Real-time: join competition room and listen for updates
  useEffect(() => {
    if (!compId) return;
    const compNum = Number(compId);
    try { socket.emit('join', { competitionId: compNum }); } catch (e) {}

    // Handler for group/score updates (existing logic)
    const handler = (msg) => {
      // ...existing code for group/score updates...
    };
    socket.on('scores-updated', handler);
    socket.on('medal-player-updated', handler);
    socket.on('team-user-updated', handler);
    socket.on('fines-updated', handler);

    // --- NEW: Listen for popup-event and show popups globally ---
    const popupHandler = (event) => {
      try {
        if (!event || Number(event.competitionId) !== compNum) return;
        // Always pass competitionId to showLocalPopup for correct rebroadcast and dedupe
        showLocalPopup({
          type: event.type,
          name: event.playerName,
          holeNumber: event.holeNumber,
          sig: event.signature,
          competitionId: event.competitionId
        });
      } catch (e) { /* ignore */ }
    };
    socket.on('popup-event', popupHandler);

    return () => {
      try { socket.emit('leave', { competitionId: compNum }); } catch (e) {}
      socket.off('scores-updated', handler);
      socket.off('medal-player-updated', handler);
      socket.off('team-user-updated', handler);
      socket.off('fines-updated', handler);
      socket.off('popup-event', popupHandler);
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
        setDisplayNames(group.displayNames || []);
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
      // Fetch latest backend scores for this player
      let backendScores = Array(18).fill('');
      try {
        const res = await fetch(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`));
        if (res.ok) {
          const d = await res.json();
          backendScores = Array.isArray(d.scores) ? d.scores.map(v => v == null ? '' : v) : Array(18).fill('');
        }
      } catch {}
      // Merge local changes into backend scores
      const localScores = Array.isArray(data.scores) ? data.scores : Array(18).fill('');
      const mergedScores = localScores.map((local, i) => {
        if (local !== '' && local != null) return local;
        return backendScores[i] !== '' && backendScores[i] != null ? backendScores[i] : '';
      });
      const res = await fetch(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teebox: data.teebox,
          handicap: data.handicap,
          scores: mergedScores,
          waters: mini.waters ?? '',
          dog: mini.dog ?? false,
          two_clubs: mini.twoClubs ?? ''
        })
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error('Save failed:', errText);
        throw new Error('Failed to save: ' + errText);
      }
      try {
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
    // Only apply anti-jump/saving logic for teebox and handicap (CH)
    if (field === 'teebox' || field === 'handicap') {
      setCellSaving(prev => ({ ...prev, [`mini:${name}:${field}`]: true }));
      const pendingKey = `mini:${name}:${field}`;
      const ts = Date.now();
      if (!window.dthPendingMiniSaves) window.dthPendingMiniSaves = {};
      window.dthPendingMiniSaves[pendingKey] = { value, ts };
      setTimeout(() => {
        if (window.dthPendingMiniSaves[pendingKey] && window.dthPendingMiniSaves[pendingKey].ts === ts) {
          delete window.dthPendingMiniSaves[pendingKey];
        }
      }, 5000);
      setPlayerData(prev => ({
        ...prev,
        [name]: {
          ...prev[name],
          [field]: value
        }
      }));
      if (!compId || !groups.length) {
        setCellSaving(prev => { const next = { ...prev }; delete next[pendingKey]; return next; });
        return;
      }
      const patchBody = {};
      if (field === 'teebox') patchBody.teebox = value;
      if (field === 'handicap') patchBody.handicap = value;
      if (Object.keys(patchBody).length > 0) {
        fetch(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchBody)
        })
          .then(async () => {
            // Optionally re-fetch for sync
            const res = await fetch(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`));
            if (res.ok) {
              const data = await res.json();
              setPlayerData(prev => ({
                ...prev,
                [name]: {
                  ...prev[name],
                  teebox: data.teebox ?? prev[name]?.teebox ?? '',
                  handicap: data.handicap ?? prev[name]?.handicap ?? ''
                }
              }));
            }
          })
          .finally(() => {
            setCellSaving(prev => { const next = { ...prev }; delete next[pendingKey]; return next; });
          });
      } else {
        setCellSaving(prev => { const next = { ...prev }; delete next[pendingKey]; return next; });
      }
      return;
    }
    // Default: no anti-jump for other fields
    setPlayerData(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        [field]: value
      }
    }));
    if (!compId || !groups.length) return;
    const patchBody = {};
    if (field === 'teebox') patchBody.teebox = value;
    if (field === 'handicap') patchBody.handicap = value;
    if (Object.keys(patchBody).length > 0) {
      fetch(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody)
      }).catch(() => {});
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

  async function handleScoreChange(name, idx, value, skipMobileAdvance = false) {
      // Set per-cell saving spinner for this cell
      setCellSaving(prev => ({ ...prev, [`${name}:${idx}`]: true }));
    if (!canEdit(name)) return;
    // No auto-advance on score change. Only advance on explicit Save button click.
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
    // Synchronously update both state and the ref copy so subsequent
    // synchronous reads (from other handlers or scheduled callbacks)
    // see the freshest value and avoid brief UI jumps on fast input.
    try {
      const prevData = playerDataRef.current || {};
      const existing = Array.isArray(prevData[name]?.scores) ? prevData[name].scores : Array.from({ length: 18 }, () => '');
      const updatedScores = existing.map((v, i) => i === idx ? value : v);
      const newData = {
        ...prevData,
        [name]: {
          ...(prevData[name] || {}),
          scores: updatedScores
        }
      };
      // update ref immediately
      playerDataRef.current = newData;
      // update React state
      setPlayerData(newData);
    } catch (e) {
      // fallback to previous approach if anything goes wrong
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
    }
    // Record immediate last-action value to help rapid +/- and server-echo guards
    try { lastActionValueRef.current[`${name}:${idx}`] = { value: String(value), ts: Date.now() }; } catch (e) {}
    // Birdie/Eagle/Blowup detection logic
    const gross = parseInt(value, 10);
    const hole = holesArr[idx];
    if (gross > 0 && hole) {
      // Eagle (2 under)
            if (gross === hole.par - 2) {
        if (eagleShowDelayRef.current) clearTimeout(eagleShowDelayRef.current);
        eagleShowDelayRef.current = setTimeout(() => {
          const latest = parseInt(playerDataRef.current?.[name]?.scores?.[idx], 10);
          if (latest === gross) {
            const sig = `eagle:${name}:${hole.number}:${compId}`;
            if (checkAndMark(sig)) {
                      console.log('[MedalScorecard] Eagle popup signature:', sig, { name, hole: hole.number, compId });
                      showLocalPopup({ type: 'eagle', name, holeNumber: hole.number, sig, competitionId: compId });
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
                    console.log('[MedalScorecard] Birdie popup signature:', sig, { name, hole: hole.number, compId });
                    showLocalPopup({ type: 'birdie', name, holeNumber: hole.number, sig, competitionId: compId });
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
                      console.log('[MedalScorecard] Blowup popup signature:', sig, { name, hole: hole.number, compId });
                      showLocalPopup({ type: 'blowup', name, holeNumber: hole.number, sig, competitionId: compId });
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
          const res = await fetch(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scores: newScores })
          });
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
          // Clear per-cell saving spinner for this cell
          setCellSaving(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }
  }, 500);
    } catch (err) {
      console.error('Error scheduling debounced save', err);
    }
  }

  // Flush any pending debounced saves and immediately persist all players' scores.
  async function flushAndSaveAll() {
    if (!compId || !groups.length) return;
    try {
      setSaveStatus('saving');
      if (saveStatusTimeoutRef.current) { try { clearTimeout(saveStatusTimeoutRef.current); } catch (e) {} }
    } catch (e) {}
    // Clear any scheduled debounced saves
    try {
      for (const k of Object.keys(saveTimeoutsRef.current)) {
        try { clearTimeout(saveTimeoutsRef.current[k]); } catch (e) {}
        try { delete saveTimeoutsRef.current[k]; } catch (e) {}
      }
    } catch (e) {}

    const saves = [];
    const now = Date.now();
    try {
      // Step 1: Fetch latest backend scores for all players
      const latestBackendData = {};
      for (const name of players) {
        try {
          const res = await fetch(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`));
          if (res.ok) {
            const data = await res.json();
            latestBackendData[name] = Array.isArray(data.scores) ? data.scores.map(v => v == null ? '' : v) : Array(18).fill('');
          } else {
            latestBackendData[name] = Array(18).fill('');
          }
        } catch {
          latestBackendData[name] = Array(18).fill('');
        }
      }
      // Step 2: Merge local changes into latest backend scores
      for (const name of players) {
        const localScores = (playerDataRef.current && playerDataRef.current[name] && Array.isArray(playerDataRef.current[name].scores)) ? playerDataRef.current[name].scores : Array(18).fill('');
        const mergedScores = localScores.map((local, i) => {
          if (local !== '' && local != null) return local;
          return latestBackendData[name][i] !== '' && latestBackendData[name][i] != null ? latestBackendData[name][i] : '';
        });
        // mark as pending to avoid reacting to immediate server echoes
        for (let i = 0; i < mergedScores.length; i++) {
          try { pendingLocalSavesRef.current[`${name}:${i}`] = { value: String(mergedScores[i] ?? ''), ts: now }; } catch (e) {}
          setTimeout(((key, ts) => () => {
            try { if (pendingLocalSavesRef.current[key] && pendingLocalSavesRef.current[key].ts === ts) delete pendingLocalSavesRef.current[key]; } catch (e) {}
          })(`${name}:${i}`, now), 5000);
        }
        const p = fetch(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scores: mergedScores })
        });
        saves.push(p);
      }
      const results = await Promise.allSettled(saves);
      // Ask server to rebroadcast this saved medal update so other clients see it
      try {
        const payload = { competitionId: Number(compId), groupId: Number(groupIdx), group: groups[groupIdx], _clientBroadcast: true };
        try { socket.emit && socket.emit('client-medal-saved', payload); } catch (e) {}
      } catch (e) {}
      // update inline status: show saved briefly
      try { setSaveStatus('saved'); } catch (e) {}
      try { if (saveStatusTimeoutRef.current) clearTimeout(saveStatusTimeoutRef.current); } catch (e) {}
      try { saveStatusTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 2000); } catch (e) {}
      // After saving, re-fetch the competition to sync any server-side aggregates
      try {
        const res = await fetch(apiUrl(`/api/competitions/${compId}`));
        if (res.ok) {
          const data = await res.json();
          setComp(data);
          setGroups(Array.isArray(data.groups) ? data.groups : []);
          // update playerData from the returned group scores
          if (Array.isArray(data.groups) && data.groups[groupIdx] && data.groups[groupIdx].scores) {
            setPlayerData(prev => {
              const copy = { ...(prev || {}) };
              const names = data.groups[groupIdx].players || [];
              for (const nm of names) {
                const s = data.groups[groupIdx].scores?.[nm];
                if (Array.isArray(s)) copy[nm] = { ...(copy[nm] || {}), scores: s.map(v => v == null ? '' : String(v)) };
              }
              return copy;
            });
          }
        }
      } catch (e) {}
    } catch (err) {
      setError('Failed to flush saves: ' + (err.message || err));
    }
    
    // Auto-navigation after saving is fully disabled. Only advance on explicit user action.
  }

  // ...existing code...

  async function handleMiniTableChange(name, field, value) {
    if (!canEdit(name)) return;
    // Set per-field saving spinner
    setCellSaving(prev => ({ ...prev, [`mini:${name}:${field}`]: true }));
    // Mark this field as a recent local save
    const pendingKey = `mini:${name}:${field}`;
    const ts = Date.now();
    if (!window.dthPendingMiniSaves) window.dthPendingMiniSaves = {};
    window.dthPendingMiniSaves[pendingKey] = { value: value, ts };
    setTimeout(() => {
      if (window.dthPendingMiniSaves[pendingKey] && window.dthPendingMiniSaves[pendingKey].ts === ts) {
        delete window.dthPendingMiniSaves[pendingKey];
      }
    }, 5000);

    if (field === 'dog' && value) {
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
      if (!compId || !groups.length) {
        setCellSaving(prev => { const next = { ...prev }; delete next[pendingKey]; return next; });
        return;
      }
      try {
        for (const player of players) {
          const patchBody = { dog: player === name };
          await fetch(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(player)}`), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patchBody)
          });
        }
      } catch (err) {
        setError('Failed to save dog for group: ' + (err.message || err));
      }
      setCellSaving(prev => { const next = { ...prev }; delete next[pendingKey]; return next; });
      const sig = `dog:${name}:g:${groupIdx ?? ''}:c:${compId}`;
      if (checkAndMark(sig)) {
        try {
          console.log('[MedalScorecard] Dog popup signature:', sig, { name, groupIdx, compId });
          showLocalPopup({ type: 'dog', name, sig, competitionId: compId });
        } catch (e) {}
      }
      return;
    }
    setMiniTableStats(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        [field]: value
      }
    }));
    if (!compId || !groups.length) {
      setCellSaving(prev => { const next = { ...prev }; delete next[pendingKey]; return next; });
      return;
    }
    try {
      const patchBody = {};
      if (field === 'waters') patchBody.waters = value;
      if (field === 'twoClubs') patchBody.two_clubs = value;
      await fetch(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody)
      });
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
    setCellSaving(prev => { const next = { ...prev }; delete next[pendingKey]; return next; });
    if (field === 'waters' && value && Number(value) > 0) {
      const sig = `waters:${name}:g:${groupIdx ?? ''}:c:${compId}`;
      if (checkAndMark(sig)) {
        try {
          console.log('[MedalScorecard] Waters popup signature:', sig, { name, groupIdx, compId });
          showLocalPopup({ type: 'waters', name, sig, competitionId: compId });
        } catch (e) {}
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
        await fetch(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scores: Array(18).fill(null) })
        });
      }
    } catch (err) {
      console.error('Failed to persist cleared scores', err);
      setError('Failed to persist cleared scores: ' + (err.message || err));
    }
  }

  return (
    <>
      {/* Global Saving Overlay and Blur */}
      {anyCellSaving && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-[3px] transition-all duration-200" style={{ pointerEvents: 'auto' }}>
          <div className="flex flex-col items-center">
            <svg className="animate-spin h-12 w-12 text-yellow-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <div className="text-2xl font-extrabold text-yellow-300 drop-shadow-lg" style={{ fontFamily: 'Merriweather, Georgia, serif' }}>Saving entry...</div>
          </div>
        </div>
      )}
      {/* CH warning popup (top level - applies to all comp types) */}
      {showCHWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-6 flex flex-col items-center border-4 border-[#FFD700] popup-jiggle max-w-sm w-full">
            <span className="text-5xl mb-3" role="img" aria-label="Warning">⚠️</span>
            <h2 className="text-2xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif' }}>Enter CH for all players</h2>
            <div className="text-sm text-white mb-4 text-center" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>You must enter a Course Handicap (CH) for every player before moving to the next hole.</div>
            <button
              className="px-6 py-2 rounded-2xl font-bold shadow border border-white"
              style={{ backgroundColor: '#FFD700', color: '#002F5F' }}
              onClick={() => setShowCHWarning(false)}
            >OK</button>
          </div>
        </div>
      )}
      {/* Incomplete scores warning popup */}
      {showIncompleteScoresWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-6 flex flex-col items-center border-4 border-[#FFD700] popup-jiggle max-w-sm w-full">
            <span className="text-5xl mb-3" role="img" aria-label="Warning">⚠️</span>
            <h2 className="text-2xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif' }}>Not all scores entered</h2>
            <div className="text-sm text-white mb-4 text-center" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>
              Not all 4 players have entered their scores for this hole. Click Ignore if you're playing with less than 4 players.
            </div>
            <div className="flex gap-3 w-full">
              <button
                className="flex-1 px-4 py-2 rounded-2xl font-bold shadow border border-white"
                style={{ backgroundColor: '#FFD700', color: '#002F5F' }}
                onClick={() => setShowIncompleteScoresWarning(false)}
              >OK</button>
              <button
                className="flex-1 px-4 py-2 rounded-2xl font-bold shadow border border-white"
                style={{ backgroundColor: '#666', color: 'white' }}
                onClick={() => {
                  try {
                    localStorage.setItem('hideIncompleteScoresWarning', 'true');
                  } catch (e) {}
                  setHideIncompleteScoresWarning(true);
                  setShowIncompleteScoresWarning(false);
                }}
              >Ignore & Don't Show Again</button>
            </div>
          </div>
        </div>
      )}
      <PageBackground>
        <TopMenu {...props} userComp={comp} competitionList={comp ? [comp] : []} />
        <div className={`flex flex-col items-center px-4 mt-12 transition-all duration-200 ${anyCellSaving ? 'blur-[3px] pointer-events-none select-none' : ''}`} style={anyCellSaving ? { filter: 'blur(3px)', pointerEvents: 'none', userSelect: 'none' } : {}}>
        <h1 className="text-4xl font-extrabold drop-shadow-lg text-center mb-4" style={{ color: '#0e3764', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>
          {props.overrideTitle || 'Medal Competition: Scorecard'}
        </h1>
        {/* Comp Info Section */}
  <div className="max-w-4xl w-full mb-4 p-4 rounded-xl border-2 border-[#FFD700] text-white" style={{ fontFamily: 'Lato, Arial, sans-serif', background: 'rgba(14,55,100,0.95)' }}>
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

        

  <div className="max-w-4xl w-full bg-[#0e3764] rounded-2xl shadow-2xl p-8 border-4 border-[#FFD700] text-white" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>
          {/* Group buttons removed above mini table */}
          {/* Mini Table for Waters, Dog, 2 Clubs, etc. */}
          <div className="flex flex-col items-start mb-6" style={{ gap: '1rem' }}>
            {/* Tee Time selector: admin-visible, placed immediately above the Handicaps table */}
            <div className="w-full flex items-center justify-center mb-2">
              <div className="text-sm text-white mr-3">Tee Time:</div>
              {groups && groups.length > 1 ? (
                <select
                  value={groupIdx}
                  onChange={e => setGroupIdx(Number(e.target.value))}
                  className="inline-block bg-transparent text-white font-bold rounded px-3 py-1 h-8 align-middle"
                  style={{ border: '1px solid #FFD700', lineHeight: '1.5' }}
                >
                  {groups.map((g, i) => (
                    <option key={i} value={i} style={{ color: '#0e3764' }}>{g.teeTime ? `${g.teeTime} — 4 Ball ${i + 1}` : `4 Ball ${i + 1}`}</option>
                  ))}
                </select>
              ) : (
                <div className="font-bold" style={{ color: '#FFD700' }}>{groups[groupIdx]?.teeTime || '-'}</div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
              <h3 className="text-sm font-semibold text-white mb-2 text-center">Handicaps and Tees</h3>
              <div className="overflow-x-auto">
              <table className="w-full min-w-0 border text-white text-xs sm:text-sm rounded" style={{ fontFamily: 'Lato, Arial, sans-serif', background: '#0e3764', color: 'white', borderColor: '#FFD700' }}>
            <thead>
                <tr>
                <th className="border px-2 py-1" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}></th>
                <th className="border px-2 py-1" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Name</th>
                <th className="border px-2 py-1" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Tee</th>
                <th className="border px-2 py-1" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>CH</th>
                <th className="border px-2 py-1" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>PH</th>
                <th className="hidden sm:table-cell border px-2 py-1" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Waters</th>
                <th className="hidden sm:table-cell border px-2 py-1" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Dog</th>
                <th className="hidden sm:table-cell border px-2 py-1" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>2 Clubs</th>
              </tr>
            </thead>
            <tbody>
                {players.map((name, idx) => {
                  const displayName = getDisplayName(name, idx);
                  return (
                  <tr key={name}>
                    <td className={`border border-white px-2 py-1 font-bold text-center align-middle ${playerColors[idx % playerColors.length]}`} style={{ minWidth: 32 }}>{String.fromCharCode(65 + idx)}</td>
                    <td className={`border border-white px-2 py-1 font-semibold text-left ${playerColors[idx % playerColors.length]}`}>
                      {/* Mobile: show Initial + Surname only. Desktop: full name */}
                      <span className="block sm:hidden truncate whitespace-nowrap" title={displayName}>
                        {(() => {
                          try {
                            const parts = (displayName || '').trim().split(/\s+/).filter(Boolean);
                            if (parts.length === 0) return '';
                            if (parts.length === 1) return parts[0];
                            // remove nickname tokens wrapped in quotes or parentheses from initial detection
                            const first = parts[0].replace(/^["'\(]+|["'\)]+$/g, '');
                            const surname = parts[parts.length - 1].replace(/^["'\(]+|["'\)]+$/g, '');
                            const initial = (first && first[0]) ? first[0].toUpperCase() : '';
                            return initial ? `${initial}. ${surname}` : surname;
                          } catch (e) {
                            return displayName;
                          }
                        })()}
                      </span>
                      <span className="hidden sm:block truncate whitespace-nowrap" title={displayName}>{displayName}</span>
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
                        <option value="White" style={{ color: '#FFFFFF', background: '#0e3764' }}>White</option>
                        <option value="Red" style={{ color: '#FF4B4B', background: '#0e3764' }}>Red</option>
                      </select>
                    </td>
                    <td className="border px-2 py-1 text-center">
                      {useMobilePicker ? (
                        <select
                          className="w-12 sm:w-16 text-center bg-transparent rounded focus:outline-none font-semibold"
                          style={{ border: 'none', color: '#FFD700' }}
                          value={playerData[name]?.handicap ?? ''}
                          onChange={e => handleChange(name, 'handicap', e.target.value)}
                        >
                          <option value="">-</option>
                          {Array.from({ length: 55 }).map((_, i) => (
                            <option key={i} value={String(i)}>{i}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="number"
                          min="0"
                          className="w-12 sm:w-16 text-center bg-transparent rounded focus:outline-none font-semibold no-spinner"
                          style={{ border: 'none', color: '#FFD700' }}
                          value={playerData[name]?.handicap || ''}
                          onChange={e => handleChange(name, 'handicap', e.target.value)}
                        />
                      )}
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
                );
                })}
              </tbody>
            
              </table>
              </div>
            </div>
            {/* Extras mobile table: quick access to Waters/Dog/2 Clubs */}
            <div className="sm:hidden w-full mb-3 mt-2">
              <h3 className="text-sm font-semibold text-white mb-2 text-center">Extras</h3>
              <div className="overflow-x-auto">
                <table className="w-full border text-white text-xs rounded" style={{ fontFamily: 'Lato, Arial, sans-serif', background: '#0e3764', borderColor: '#FFD700' }}>
                  <thead>
                    <tr>
                      <th className="border px-2 py-1" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700'}}></th>
                      <th className="border px-2 py-1 text-left" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700'}}>Name</th>
                      <th className="border px-2 py-1 text-center" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700'}}>Waters</th>
                      <th className="border px-2 py-1 text-center" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700'}}>Dog</th>
                      <th className="border px-2 py-1 text-center" style={{background:'#0e3764',color:'#FFD700', borderColor:'#FFD700'}}>2 Clubs</th>
                    </tr>
                    {/* Removed erroneous insertion here; pair Score rows are rendered inside the main front/back tables after the appropriate player rows. */}
                  </thead>
                  <tbody>
                    {players.map((name, idx) => {
                      const displayName = getDisplayName(name, idx);
                      return (
                      <tr key={'extras-' + name}>
                        <td className={`border border-white px-2 py-1 font-bold text-center align-middle ${playerColors[idx % playerColors.length]}`} style={{ minWidth: 32 }}>{String.fromCharCode(65 + idx)}</td>
                        <td className={`border border-white px-2 py-1 font-semibold text-left ${playerColors[idx % playerColors.length]}`}>
                          <span className="truncate whitespace-nowrap" title={displayName}>
                            {(() => {
                              try {
                                const parts = (displayName || '').trim().split(/\s+/).filter(Boolean);
                                if (parts.length === 0) return '';
                                if (parts.length === 1) return parts[0];
                                const first = parts[0].replace(/^["'\(]+|["'\)]+$/g, '');
                                const surname = parts[parts.length - 1].replace(/^["'\(]+|["'\)]+$/g, '');
                                const initial = (first && first[0]) ? first[0].toUpperCase() : '';
                                return initial ? `${initial}. ${surname}` : surname;
                              } catch (e) {
                                return displayName;
                              }
                            })()}
                          </span>
                        </td>
                        <td className="border px-2 py-1 text-center">
                          <select className="w-12 text-center text-white bg-transparent rounded focus:outline-none font-semibold" style={{ border: 'none', background: '#002F5F' }} value={miniTableStats[name]?.waters || ''} onChange={e => { if (!canEdit(name)) return; handleMiniTableChange(name, 'waters', e.target.value); }} disabled={!canEdit(name)}>
                            <option value="">0</option>
                            {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </td>
                        <td className="border px-2 py-1 text-center">
                          <input type="checkbox" checked={!!miniTableStats[name]?.dog} onChange={e => handleMiniTableChange(name, 'dog', e.target.checked)} />
                        </td>
                        <td className="border px-2 py-1 text-center">
                          <select className="w-12 text-center text-white bg-transparent rounded focus:outline-none font-semibold" style={{ border: 'none', background: '#002F5F' }} value={miniTableStats[name]?.twoClubs || ''} onChange={e => handleMiniTableChange(name, 'twoClubs', e.target.value)}>
                            <option value="">0</option>
                            {[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="w-full sm:w-auto mt-3">
              {(() => {
                const normalize = s => (s || '').toString().trim().toLowerCase();
                const viewerInGroup = resolvedName && Array.isArray(players) && players.some(p => normalize(p) === normalize(resolvedName));
                const disabled = !(isAdmin || viewerInGroup);
                return (
                  <>
                    <button
                      className="w-full sm:w-auto py-2 px-4 rounded-2xl font-semibold transition shadow border border-white"
                      style={{ backgroundColor: disabled ? '#666' : '#FFD700', color: disabled ? '#ddd' : '#002F5F', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                      onMouseOver={e => { if (!disabled) e.currentTarget.style.backgroundColor = '#ffe066'; }}
                      onMouseOut={e => { if (!disabled) e.currentTarget.style.backgroundColor = '#FFD700'; }}
                      onClick={() => { if (!disabled) setShowResetModal(true); }}
                      disabled={disabled}
                      aria-disabled={disabled}
                      title={disabled ? 'You cannot reset this scorecard' : 'Reset Scores'}
                    >
                      Reset Scores
                    </button>
                    {isAdmin && (
                      <button
                        className="w-full sm:w-auto py-2 px-4 rounded-2xl font-semibold transition shadow border border-white sm:ml-2 mt-2 sm:mt-0"
                        style={{ backgroundColor: '#4A90E2', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                        onMouseOver={e => { e.currentTarget.style.backgroundColor = '#357ABD'; }}
                        onMouseOut={e => { e.currentTarget.style.backgroundColor = '#4A90E2'; }}
                        onClick={generateDummyData}
                        title="Generate random test data for all players"
                      >
                        Generate Test Data
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
          {/* Scorecard Table UI: Front 9 and Back 9, PAR/STROKE/HOLE headings, gross/net rows, Medal logic */}
          {/* Mobile-only per-hole entry (compact cards for mobile) */}
          <div className="sm:hidden w-full mt-4">
            {/* Decide mobile rendering mode */}
            {(() => {
              const isAlliance = (props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('alliance')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('alliance'));
              const is4bbb = (props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('4bbb')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('4bbb')) || (props.compTypeOverride && props.compTypeOverride.toString().toLowerCase().includes('4bbb'));
              const is4bbbBonus = is4bbb && ((props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('bonus')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('bonus')) || (props.compTypeOverride && props.compTypeOverride.toString().toLowerCase().includes('bonus')));
              const isMedalMobile = (props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('medal')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('medal'));
              const isIndividual = (props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('individual')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('individual')) || (props.compTypeOverride && props.compTypeOverride.toString().toLowerCase().includes('individual'));
              // Treat Individual Stableford as the same mobile entry mode as Alliance/4BBB
              if (isAlliance || is4bbb || isIndividual) {
                const group = groups[groupIdx] || { players: [] };
                const best = computeGroupBestTwoTotals(group);
                const hole = holesArr[mobileSelectedHole - 1];

                const PairHeader = () => {
                  // For Alliance comps show the Alliance Score header. For 4BBB show team AB/CD BB scores.
                  if (isAlliance && !is4bbb) return (
                    <div className="w-full p-3 rounded border-2 text-center mb-3" style={{ borderColor: '#FFD700', background: '#002F5F' }}>
                      <div className="font-extrabold text-2xl text-white">Alliance Score: <span style={{ color: '#FFD700' }}>{best.total}</span></div>
                    </div>
                  );

                  // For Individual stableford we don't show the Alliance header; fall through to per-player cards.
                  if (isIndividual && !is4bbb && !isAlliance) return null;

                  const pairTotals = (start) => {
                    const nameA = (players && players[start]) || '';
                    const nameB = (players && players[start + 1]) || '';
                    const stabA = computePlayerStablefordTotals(nameA) || { perHole: Array(18).fill(0), front: 0, back: 0, total: 0 };
                    const stabB = computePlayerStablefordTotals(nameB) || { perHole: Array(18).fill(0), front: 0, back: 0, total: 0 };
                    const perHole = holesArr.map((_, i) => {
                      const a = stabA.perHole?.[i];
                      const b = stabB.perHole?.[i];
                      if (a == null && b == null) return null;
                      let bb = Math.max(Number(a || 0), Number(b || 0));
                      if (is4bbbBonus) {
                        const sum = Number(a || 0) + Number(b || 0);
                        if (sum >= 6) bb += 1;
                      }
                      return bb;
                    });
                    const front = perHole.slice(0, 9).reduce((s, v) => s + (v != null ? v : 0), 0);
                    const back = perHole.slice(9, 18).reduce((s, v) => s + (v != null ? v : 0), 0);
                    const total = front + back;
                    const hasAny = perHole.some(v => v != null);
                    return { perHole, front, back, total: hasAny ? total : null };
                  };

                  const ab = pairTotals(0);
                  const cd = pairTotals(2);
                  return (
                    <div className="grid grid-cols-1 gap-2 mb-3">
                      <div className="w-full p-3 rounded border-2 text-center" style={{ borderColor: '#FFD700', background: '#002F5F' }}>
                        <div className="font-extrabold text-2xl text-white">Team AB | BB Score: <span style={{ color: '#FFD700' }}>{Number.isFinite(ab.total) ? ab.total : ''}</span></div>
                      </div>
                      <div className="w-full p-3 rounded border-2 text-center" style={{ borderColor: '#FFD700', background: '#002F5F' }}>
                        <div className="font-extrabold text-2xl text-white">Team CD | BB Score: <span style={{ color: '#FFD700' }}>{Number.isFinite(cd.total) ? cd.total : ''}</span></div>
                      </div>
                    </div>
                  );
                };

                return (
                  <div>
                    <PairHeader />

                    <div ref={mobileHoleRef} data-mobile-hole className="mb-4 p-3 rounded border text-white" style={{ background: '#002F5F', borderColor: '#FFD700' }}>
                      <div className="flex items-center justify-center mb-3">
                        <button
                          className="px-3 py-2 rounded text-lg mr-4"
                          style={{ background: 'rgba(255,215,0,0.12)', color: '#FFD700' }}
                          onClick={() => {
                            // Check if all active players have scores before checking CH
                            const activePlayers = Array.isArray(players) ? players.filter(Boolean) : [];
                            const allHaveScores = activePlayers.length > 0 && activePlayers.every(pName => {
                              const scores = playerData?.[pName]?.scores;
                              if (!Array.isArray(scores)) return false;
                              const score = scores[mobileSelectedHole - 1];
                              return score !== '' && score != null;
                            });
                            // Only check CH if all scores are entered
                            if (allHaveScores && !allPlayersHaveCH()) {
                              setShowCHWarning(true);
                              return;
                            }
                            setMobileSelectedHole(h => (h === 1 ? 18 : h - 1));
                          }}
                        >◀</button>
                        <div className="flex-1 text-base font-bold text-white text-center truncate" style={{ whiteSpace: 'nowrap' }}>Hole {hole?.number || mobileSelectedHole} • Par {hole?.par || '-'} • SI {hole?.index ?? '-'}</div>
                        <button
                          className="px-3 py-2 rounded text-lg ml-4"
                          style={{ background: 'rgba(255,215,0,0.12)', color: '#FFD700' }}
                          onClick={() => {
                            const valid = allPlayersHaveCH();
                            if (!valid) {
                              setShowCHWarning(true);
                              return;
                            }
                            // Check if all scores are entered
                            const activePlayers = Array.isArray(players) ? players.filter(Boolean) : [];
                            const allHaveScores = activePlayers.length > 0 && activePlayers.every(pName => {
                              const scores = playerData?.[pName]?.scores;
                              if (!Array.isArray(scores)) return false;
                              const score = scores[mobileSelectedHole - 1];
                              return score !== '' && score != null;
                            });
                            // Show warning if not all scores entered (unless user disabled it)
                            if (!allHaveScores && !hideIncompleteScoresWarning) {
                              setShowIncompleteScoresWarning(true);
                              return;
                            }
                            setMobileSelectedHole(h => (h === 18 ? 1 : h + 1));
                          }}
                        >▶</button>

                      </div>

                      <div className="space-y-4">
                        {players.map((pName, idx) => {
                          const displayName = getDisplayName(pName, idx);
                          const stable = computePlayerStablefordTotals(pName);
                          const grossArr = Array.isArray(playerData[pName]?.scores) ? playerData[pName].scores : Array(18).fill('');
                          const curVal = grossArr[mobileSelectedHole - 1] || '';
                          const grossTotal = grossArr.reduce((s, v) => s + (parseInt(v, 10) || 0), 0);
                          // par label
                          let parSumPlayer = 0; let anyScorePlayer = false;
                          for (let i = 0; i < grossArr.length; i++) { const v = parseInt(grossArr[i], 10); if (Number.isFinite(v)) { parSumPlayer += (holesArr[i]?.par || 0); anyScorePlayer = true; } }
                          const diffPlayer = grossTotal - parSumPlayer;
                          const parLabelPlayer = anyScorePlayer ? (diffPlayer === 0 ? ' (E)' : ` (${diffPlayer > 0 ? '+' : ''}${diffPlayer})`) : '';
                          const initialLabel = (() => { try { const parts = (displayName || '').trim().split(/\s+/).filter(Boolean); if (!parts.length) return displayName; const first = parts[0].replace(/^['"\(]+|['"\)]+$/g, ''); const surname = parts[parts.length - 1].replace(/^['"\(]+|['"\)]+$/g, ''); const initial = (first && first[0]) ? first[0].toUpperCase() : ''; return initial ? `${initial}. ${surname}` : surname; } catch (e) { return displayName; } })();

                          return (
                            <div key={`mob-wrap-${pName}`}>
                              <div key={`mob-${pName}`} className="p-4 rounded border border-white/10 relative" style={{ minHeight: '180px' }}>
                                <div className="flex items-center justify-between mb-2 pr-32">
                                  <div className="font-semibold text-base">{initialLabel}</div>
                                </div>
                                <div className="text-xs font-semibold" style={{ color: '#FFD700' }}>PH {computePH(playerData[pName]?.handicap)}</div>

                                <div className="grid grid-cols-2 gap-2 text-sm mt-16">
                                  {(() => {
                                    const grossArrLocal = Array.isArray(playerData[pName]?.scores) ? playerData[pName].scores : Array(18).fill('');
                                    const grossFront = grossArrLocal.slice(0,9).reduce((s, v) => s + (parseInt(v, 10) || 0), 0);
                                    const grossBack = grossArrLocal.slice(9,18).reduce((s, v) => s + (parseInt(v, 10) || 0), 0);
                                    return (
                                      <>
                                        <div>Out: <span className="font-bold">{grossFront}</span></div>
                                        <div className="text-right">In: <span className="font-bold">{grossBack}</span></div>
                                        <div>Total: <span className="font-bold">{grossTotal}{parLabelPlayer}</span></div>
                                        <div className="text-right">Points: <span className="font-bold">{
                                          (typeof stable.total === 'number' && Number.isFinite(stable.total))
                                            ? stable.total
                                            : ''
                                        }</span></div>
                                      </>
                                    );
                                  })()}
                                </div>

                                <div className="absolute right-3 top-10 flex flex-col items-end gap-1">
                                  {(() => {
                                    // Individual Stableford: use dropdown select on mobile to avoid increment/decrement bugs
                                    if (isIndividual) {
                                      const selectVal = curVal !== '' ? String(curVal) : '';
                                      const hasScore = curVal !== '';
                                      const displayPar = hole?.par ?? '';
                                      
                                      // Color coding based on score relative to par
                                      let labelColor = '#ffffff';
                                      let bgColor = '#6B7280';
                                      let textColor = '#ffffff';
                                      let borderColor = 'none';
                                      
                                      if (hasScore) {
                                        const scoreNum = parseInt(curVal, 10);
                                        const par = hole?.par || 0;
                                        if (scoreNum <= par - 2) {
                                          // Eagle or better - pink
                                          labelColor = '#FFC0CB';
                                          bgColor = '#1B3A6B';
                                          textColor = '#FFC0CB';
                                          borderColor = '2px solid #FFC0CB';
                                        } else if (scoreNum === par - 1) {
                                          // Birdie - green
                                          labelColor = '#16a34a';
                                          bgColor = '#1B3A6B';
                                          textColor = '#16a34a';
                                          borderColor = '2px solid #16a34a';
                                        } else if (scoreNum >= par + 3) {
                                          // Triple bogey or worse - red
                                          labelColor = '#ef4444';
                                          bgColor = '#1B3A6B';
                                          textColor = '#ef4444';
                                          borderColor = '2px solid #ef4444';
                                        } else {
                                          // Par through double bogey - gold
                                          labelColor = '#FFD700';
                                          bgColor = '#1B3A6B';
                                          textColor = '#FFD700';
                                          borderColor = '2px solid #FFD700';
                                        }
                                      }
                                      
                                      return (
                                        <>
                                          <span 
                                            className="text-xs font-semibold whitespace-nowrap"
                                            style={{ color: labelColor }}
                                          >
                                            {hasScore ? 'SCORE ENTERED' : 'ENTER SCORE'}
                                          </span>
                                          <select
                                            aria-label={`score-select-${pName}`}
                                            className="px-3 py-2 rounded text-xl font-bold text-center mt-1"
                                            style={{ 
                                              background: hasScore ? bgColor : '#6B7280',
                                              color: textColor,
                                              border: borderColor,
                                              minWidth: '75px',
                                              width: '75px'
                                            }}
                                            value={selectVal}
                                            onChange={(e) => {
                                              if (!canEdit(pName)) return;
                                              // If user selects par, treat as not played (empty string)
                                              const val = e.target.value;
                                              if (val === String(hole?.par)) {
                                                handleScoreChange(pName, mobileSelectedHole - 1, '');
                                              } else {
                                                handleScoreChange(pName, mobileSelectedHole - 1, val);
                                              }
                                            }}
                                            disabled={!canEdit(pName)}
                                          >
                                            <option value="" disabled>{displayPar}</option>
                                            {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(num => (
                                              <option key={num} value={num}>{num}</option>
                                            ))}
                                          </select>
                                        </>
                                      );
                                    }
                                    
                                    // Alliance/4BBB: use dropdown select (same as Individual Stableford)
                                    const selectVal = curVal !== '' ? String(curVal) : '';
                                    const hasScore = curVal !== '';
                                    const displayPar = hole?.par ?? '';
                                    
                                    // Color coding based on score relative to par
                                    let labelColor = '#ffffff';
                                    let bgColor = '#6B7280';
                                    let textColor = '#ffffff';
                                    let borderColor = 'none';
                                    
                                    if (hasScore) {
                                      const scoreNum = parseInt(curVal, 10);
                                      const par = hole?.par || 0;
                                      if (scoreNum <= par - 2) {
                                        // Eagle or better - pink
                                        labelColor = '#FFC0CB';
                                        bgColor = '#1B3A6B';
                                        textColor = '#FFC0CB';
                                        borderColor = '2px solid #FFC0CB';
                                      } else if (scoreNum === par - 1) {
                                        // Birdie - green
                                        labelColor = '#16a34a';
                                        bgColor = '#1B3A6B';
                                        textColor = '#16a34a';
                                        borderColor = '2px solid #16a34a';
                                      } else if (scoreNum >= par + 3) {
                                        // Triple bogey or worse - red
                                        labelColor = '#ef4444';
                                        bgColor = '#1B3A6B';
                                        textColor = '#ef4444';
                                        borderColor = '2px solid #ef4444';
                                      } else {
                                        // Par through double bogey - gold
                                        labelColor = '#FFD700';
                                        bgColor = '#1B3A6B';
                                        textColor = '#FFD700';
                                        borderColor = '2px solid #FFD700';
                                      }
                                    }
                                    
                                    return (
                                      <>
                                        <span 
                                          className="text-xs font-semibold whitespace-nowrap"
                                          style={{ color: labelColor }}
                                        >
                                          {hasScore ? 'SCORE ENTERED' : 'ENTER SCORE'}
                                        </span>
                                        <div style={{ position: 'relative', display: 'inline-block' }}>
                                          <select
                                            aria-label={`score-select-${pName}`}
                                            className="px-3 py-2 rounded text-xl font-bold text-center mt-1"
                                            style={{ 
                                              background: hasScore ? bgColor : '#6B7280',
                                              color: textColor,
                                              border: borderColor,
                                              minWidth: '75px',
                                              width: '75px'
                                            }}
                                            value={selectVal}
                                            onChange={(e) => {
                                              if (!canEdit(pName)) return;
                                              handleScoreChange(pName, mobileSelectedHole - 1, e.target.value);
                                            }}
                                            disabled={!canEdit(pName)}
                                          >
                                            <option value="" disabled>{hole?.par ?? ''}</option>
                                            {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(num => (
                                              <option key={num} value={num}>{num}</option>
                                            ))}
                                          </select>
                                          {/* Spinner removed: now global overlay */}
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>

                              {is4bbb && idx === 3 && (
                                <div className="mt-3 text-center">
                                  <button
                                    className="w-full sm:w-auto py-2 px-4 rounded-2xl font-semibold transition shadow border border-white"
                                    style={{ backgroundColor: '#FFD700', color: '#002F5F', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                                    onClick={async () => {
                                      console.log('[MedalScorecard] [4BBB] Save button clicked. Current hole:', mobileSelectedHole);
                                      if (!Array.isArray(players) || players.length !== 4) {
                                        console.log('[MedalScorecard] [4BBB] Not advancing: players array is not length 4:', players);
                                        return;
                                      }
                                      const activePlayers = Array.isArray(players) ? players.filter(Boolean) : [];
                                      const allHaveScores = activePlayers.length > 0 && activePlayers.every(pName => {
                                        const scores = playerData?.[pName]?.scores;
                                        if (!Array.isArray(scores)) return false;
                                        const score = scores[mobileSelectedHole - 1];
                                        return score !== '' && score != null;
                                      });
                                      // Only check CH if we're going to advance to next hole
                                      if (allHaveScores && mobileSelectedHole < 18 && !allPlayersHaveCH()) {
                                        setShowCHWarning(true);
                                        console.log('[MedalScorecard] [4BBB] Not advancing: not all CH present for all players.');
                                        return;
                                      }
                                      console.log('[MedalScorecard] [4BBB] allHaveScores:', allHaveScores, 'playerData:', playerData, 'players:', players, 'current hole:', mobileSelectedHole);
                                      setSaveStatus('saving');
                                      await flushAndSaveAll();
                                      if (allHaveScores && mobileSelectedHole < 18) {
                                        console.log('[MedalScorecard] [4BBB] Advancing to next hole:', mobileSelectedHole + 1);
                                        setMobileSelectedHole(h => {
                                          console.log('[MedalScorecard] [4BBB] setMobileSelectedHole called. Previous:', h, 'Next:', h + 1);
                                          return h + 1;
                                        });
                                      } else {
                                        if (!allHaveScores) {
                                          console.log('[MedalScorecard] [4BBB] Not advancing: not all scores present for this hole.');
                                        } else if (mobileSelectedHole >= 18) {
                                          console.log('[MedalScorecard] [4BBB] Not advancing: already at last hole.');
                                        }
                                      }
                                    }}
                                    disabled={saveStatus === 'saving'}
                                  >
                                    {saveStatus === 'saving'
                                      ? (() => {
                                          const activePlayers = Array.isArray(players) ? players.filter(Boolean) : [];
                                          const allHaveScores = activePlayers.length > 0 && activePlayers.every(pName => {
                                            const scores = playerData?.[pName]?.scores;
                                            if (!Array.isArray(scores)) return false;
                                            const score = scores[mobileSelectedHole - 1];
                                            return score !== '' && score != null;
                                          });
                                          if (allHaveScores && mobileSelectedHole < 18) {
                                            return 'Saving scores and going to next hole...';
                                          }
                                          return 'Saving scores...';
                                        })()
                                      : (saveStatus === 'saved'
                                        ? 'Scores Saved!'
                                        : (() => {
                                            const allHaveScores = players.length === 4 && players.every(pName => {
                                              const scores = playerData?.[pName]?.scores;
                                              if (!Array.isArray(scores)) return false;
                                              const score = scores[mobileSelectedHole - 1];
                                              return score !== '' && score != null;
                                            });
                                            if (allHaveScores && mobileSelectedHole < 18) {
                                              return `Save and Go to Hole ${mobileSelectedHole + 1}`;
                                            }
                                            return 'Save';
                                          })()
                                        )}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* also keep a general mobile Save button (visible for alliance mobile view) */}
                        {!is4bbb && (
                          <div className="mt-3 text-center">
                            <button
                              className="w-full sm:w-auto py-2 px-4 rounded-2xl font-semibold transition shadow border border-white"
                              style={{ backgroundColor: '#FFD700', color: '#002F5F', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                              onClick={async () => {
                                console.log('[MedalScorecard] [ALLIANCE/4BBB] Save button clicked. Current hole:', mobileSelectedHole);
                                console.log('[MedalScorecard] [ALLIANCE/4BBB] DEBUG: players:', players, 'playerData:', playerData, 'mobileSelectedHole:', mobileSelectedHole, 'groupKey:', groupKey, 'groupIdx:', groupIdx);
                                if (!Array.isArray(players) || players.length !== 4) {
                                  console.log('[MedalScorecard] [ALLIANCE/4BBB] Not advancing: players array is not length 4:', players);
                                  return;
                                }
                                const allHaveScores = players.length === 4 && players.every(pName => {
                                  const scores = playerData?.[pName]?.scores;
                                  if (!Array.isArray(scores)) return false;
                                  const score = scores[mobileSelectedHole - 1];
                                  return score !== '' && score != null;
                                });
                                // Only check CH if we're going to advance to next hole
                                if (allHaveScores && mobileSelectedHole < 18 && !allPlayersHaveCH()) {
                                  setShowCHWarning(true);
                                  console.log('[MedalScorecard] [ALLIANCE/4BBB] Not advancing: not all CH present for all players.');
                                  return;
                                }
                                console.log('[MedalScorecard] [ALLIANCE/4BBB] allHaveScores:', allHaveScores, 'playerData:', playerData, 'players:', players, 'current hole:', mobileSelectedHole);
                                setSaveStatus('saving');
                                await flushAndSaveAll();
                                if (allHaveScores && mobileSelectedHole < 18) {
                                  console.log('[MedalScorecard] [ALLIANCE/4BBB] Advancing to next hole:', mobileSelectedHole + 1);
                                  setMobileSelectedHole(h => {
                                    console.log('[MedalScorecard] [ALLIANCE/4BBB] setMobileSelectedHole called. Previous:', h, 'Next:', h + 1);
                                    return h + 1;
                                  });
                                } else {
                                  if (!allHaveScores) {
                                    console.log('[MedalScorecard] [ALLIANCE/4BBB] Not advancing: not all scores present for this hole.');
                                  } else if (mobileSelectedHole >= 18) {
                                    console.log('[MedalScorecard] [ALLIANCE/4BBB] Not advancing: already at last hole.');
                                  }
                                }
                              }}
                              disabled={saveStatus === 'saving'}
                            >
                              {saveStatus === 'saving'
                                ? (() => {
                                    const activePlayers = Array.isArray(players) ? players.filter(Boolean) : [];
                                    const allHaveScores = activePlayers.length > 0 && activePlayers.every(pName => {
                                      const scores = playerData?.[pName]?.scores;
                                      if (!Array.isArray(scores)) return false;
                                      const score = scores[mobileSelectedHole - 1];
                                      return score !== '' && score != null;
                                    });
                                    if (allHaveScores && mobileSelectedHole < 18) {
                                      return 'Saving scores and going to next hole...';
                                    }
                                    return 'Saving scores...';
                                  })()
                                : (saveStatus === 'saved'
                                  ? 'Scores Saved!'
                                  : (() => {
                                      const activePlayers = Array.isArray(players) ? players.filter(Boolean) : [];
                                      const allHaveScores = activePlayers.length > 0 && activePlayers.every(pName => {
                                        const scores = playerData?.[pName]?.scores;
                                        if (!Array.isArray(scores)) return false;
                                        const score = scores[mobileSelectedHole - 1];
                                        return score !== '' && score != null;
                                      });
                                      if (allHaveScores && mobileSelectedHole < 18) {
                                        return `Save and Go to Hole ${mobileSelectedHole + 1}`;
                                      }
                                      return 'Save';
                                    })()
                                  )}
                            </button>
                          </div>
                        )}
                        {/* Mobile Leaderboard button for alliance/4BBB mobile view */}
                        <div className="sm:hidden mt-3 text-center">
                          {(() => {
                            const today = new Date();
                            const isOpenComp = comp && (comp.status === 'Open' || (comp.date && new Date(comp.date) >= new Date(today.getFullYear(), today.getMonth(), today.getDate())));
                            return (
                              <button
                                className="w-full py-2 rounded-2xl bg-[#1B3A6B] text-white font-semibold flex items-center justify-center gap-2 border border-white"
                                style={{ opacity: isOpenComp ? 1 : 0.5, pointerEvents: isOpenComp ? 'auto' : 'none' }}
                                onClick={() => { if (!isOpenComp) return; try { const id = comp.id || comp._id || comp.joinCode || comp.joincode; navigate(`/leaderboard/${id}`, { state: { competition: comp } }); } catch (e) {} }}
                              >
                                <TrophyIcon className="h-5 w-5 mr-1" style={{ color: '#FFD700' }} />
                                Leaderboard
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              if (isMedalMobile) {
                const hole = holesArr[mobileSelectedHole - 1];
                return (
                  <div ref={mobileHoleRef} data-mobile-hole className="mb-4 p-3 rounded border text-white" style={{ background: '#002F5F', borderColor: '#FFD700' }}>
                    <div className="flex items-center justify-center mb-3">
                      <button
                        className="px-3 py-2 rounded text-lg mr-4"
                        style={{ background: 'rgba(255,215,0,0.12)', color: '#FFD700' }}
                        onClick={() => {
                          // Check if all active players have scores before checking CH
                          const activePlayers = Array.isArray(players) ? players.filter(Boolean) : [];
                          const allHaveScores = activePlayers.length > 0 && activePlayers.every(pName => {
                            const scores = playerData?.[pName]?.scores;
                            if (!Array.isArray(scores)) return false;
                            const score = scores[mobileSelectedHole - 1];
                            return score !== '' && score != null;
                          });
                          // Only check CH if all scores are entered
                          if (allHaveScores && !allPlayersHaveCH()) {
                            setShowCHWarning(true);
                            return;
                          }
                          setMobileSelectedHole(h => (h === 1 ? 18 : h - 1));
                        }}
                      >◀</button>
                      <div className="flex-1 text-base font-bold text-white text-center truncate" style={{ whiteSpace: 'nowrap' }}>Hole {hole?.number || mobileSelectedHole} • Par {hole?.par || '-'} • SI {hole?.index ?? '-'}</div>
                      <button
                        className="px-3 py-2 rounded text-lg ml-4"
                        style={{ background: 'rgba(255,215,0,0.12)', color: '#FFD700' }}
                        onClick={() => {
                          const valid = allPlayersHaveCH();
                          if (!valid) {
                            setShowCHWarning(true);
                            return;
                          }
                          // Check if all scores are entered
                                            const activePlayers = Array.isArray(players) ? players.filter(Boolean) : [];
                                            const allHaveScores = activePlayers.length > 0 && activePlayers.every(pName => {
                            const scores = playerData?.[pName]?.scores;
                            if (!Array.isArray(scores)) return false;
                            const score = scores[mobileSelectedHole - 1];
                            return score !== '' && score != null;
                          });
                          // Show warning if not all scores entered (unless user disabled it)
                          if (!allHaveScores && !hideIncompleteScoresWarning) {
                            setShowIncompleteScoresWarning(true);
                            return;
                          }
                          setMobileSelectedHole(h => (h === 18 ? 1 : h + 1));
                        }}
                      >▶</button>
                    </div>
                    <div className="space-y-3">
                      {players.map((pName, pIdx) => {
                        const displayName = getDisplayName(pName, pIdx);
                        const grossArr = Array.isArray(playerData[pName]?.scores) ? playerData[pName].scores : Array(18).fill('');
                        const curVal = grossArr[mobileSelectedHole - 1] || '';
                        const grossTotal = grossArr.reduce((s, v) => s + (parseInt(v, 10) || 0), 0);
                        const playingHandicap = computePH(playerData[pName]?.handicap) || 0;
                        let netFront = 0; let netBack = 0;
                        holesArr.forEach((h, idx) => {
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
                        for (let i = 0; i < grossArr.length; i++) { const v = parseInt(grossArr[i], 10); if (Number.isFinite(v)) { parSumPlayer += (holesArr[i]?.par || 0); anyScorePlayer = true; } }
                        const diffPlayer = grossTotal - parSumPlayer;
                        const parLabelPlayer = anyScorePlayer ? (diffPlayer === 0 ? ' (E)' : ` (${diffPlayer > 0 ? '+' : ''}${diffPlayer})`) : '';
                        const initialLabel = (() => { try { const parts = (displayName || '').trim().split(/\s+/).filter(Boolean); if (!parts.length) return displayName; const first = parts[0].replace(/^['"\(]+|['"\)]+$/g, ''); const surname = parts[parts.length - 1].replace(/^['"\(]+|['"\)]+$/g, ''); const initial = (first && first[0]) ? first[0].toUpperCase() : ''; return initial ? `${initial}. ${surname}` : surname; } catch (e) { return displayName; } })();

                        return (
                          <div key={`mob-medal-${pName}`} className="p-2 rounded border border-white/10 relative">
                            <div className="flex items-center justify-between">
                              <div className="font-semibold">{initialLabel}</div>
                            </div>
                            <div className="text-xs font-semibold mt-1" style={{ color: '#FFD700' }}>PH {computePH(playerData[pName]?.handicap)}</div>

                                <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                                  {(() => {
                                    // show gross front/back on mobile for medal view as well
                                    const grossArrLocal = Array.isArray(playerData[pName]?.scores) ? playerData[pName].scores : Array(18).fill('');
                                    const grossFront = grossArrLocal.slice(0,9).reduce((s, v) => s + (parseInt(v, 10) || 0), 0);
                                    const grossBack = grossArrLocal.slice(9,18).reduce((s, v) => s + (parseInt(v, 10) || 0), 0);
                                    return (
                                      <>
                                        <div>Out: <span className="font-bold">{grossFront}</span></div>
                                        <div className="text-right">In: <span className="font-bold">{grossBack}</span></div>
                                        <div>Total: <span className="font-bold">{grossTotal}{parLabelPlayer}</span></div>
                                        <div className="text-right">Net: <span className="font-bold">{totalNet}</span></div>
                                      </>
                                    );
                                  })()}
                                </div>

                            <div className="absolute right-3 top-3 flex items-center gap-3">
                              {(() => {
                                // Medal: use dropdown select (same as Individual Stableford)
                                const selectVal = curVal !== '' ? String(curVal) : '';
                                const hasScore = curVal !== '';
                                    const displayPar = hole?.par ?? '';
                                
                                // Color coding based on score relative to par
                                let labelColor = '#ffffff';
                                let bgColor = '#6B7280';
                                let textColor = '#ffffff';
                                let borderColor = 'none';
                                
                                    if (hasScore) {
                                      const scoreNum = parseInt(curVal, 10);
                                      const par = hole?.par || 0;
                                      if (scoreNum <= par - 2) {
                                        // Eagle or better - pink
                                        labelColor = '#FFC0CB';
                                        bgColor = '#1B3A6B';
                                        textColor = '#FFC0CB';
                                        borderColor = '2px solid #FFC0CB';
                                      } else if (scoreNum === par - 1) {
                                        // Birdie - green
                                        labelColor = '#16a34a';
                                        bgColor = '#1B3A6B';
                                        textColor = '#16a34a';
                                        borderColor = '2px solid #16a34a';
                                      } else if (scoreNum >= par + 3) {
                                        // Triple bogey or worse - red
                                        labelColor = '#ef4444';
                                        bgColor = '#1B3A6B';
                                        textColor = '#ef4444';
                                        borderColor = '2px solid #ef4444';
                                      } else {
                                        // Par through double bogey - gold
                                        labelColor = '#FFD700';
                                        bgColor = '#1B3A6B';
                                        textColor = '#FFD700';
                                        borderColor = '2px solid #FFD700';
                                      }
                                    }
                                
                                return (
                                  <div className="flex items-center gap-2">
                                    <span 
                                      className="text-xs font-semibold"
                                      style={{ color: labelColor }}
                                    >
                                      {hasScore ? 'SCORE ENTERED' : 'ENTER SCORE'}
                                    </span>
                                    <select
                                      aria-label={`score-select-${pName}`}
                                      className="px-3 py-2 rounded text-lg font-bold text-center"
                                      style={{ 
                                        background: hasScore ? bgColor : '#6B7280',
                                        color: textColor,
                                        border: borderColor,
                                        minWidth: '70px' 
                                      }}
                                            value={selectVal === '' ? '' : selectVal}
                                            onChange={(e) => {
                                              if (!canEdit(pName)) return;
                                              const val = e.target.value;
                                              handleScoreChange(pName, mobileSelectedHole - 1, val);
                                            }}
                                            disabled={!canEdit(pName)}
                                          >
                                            <option value="" disabled>{displayPar}</option>
                                            {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(num => (
                                              <option key={num} value={num}>{num}</option>
                                            ))}
                                    </select>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      })}
                        {/* Save Scores button for medal mobile view: flush debounced saves and force immediate persistence */}
                        <div className="mt-3 text-center">
                          <button
                            className="w-full sm:w-auto py-2 px-4 rounded-2xl font-semibold transition shadow border border-white"
                            style={{ backgroundColor: '#FFD700', color: '#002F5F', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                            disabled={saveStatus === 'saving'}
                            onClick={async () => {
                              console.log('[MedalScorecard] [MEDAL] Save button clicked. Current hole:', mobileSelectedHole);
                              console.log('[MedalScorecard] [MEDAL] DEBUG: players:', players, 'playerData:', playerData, 'mobileSelectedHole:', mobileSelectedHole, 'groupKey:', groupKey, 'groupIdx:', groupIdx);
                              if (!Array.isArray(players) || players.length !== 4) {
                                console.log('[MedalScorecard] [MEDAL] Not advancing: players array is not length 4:', players);
                                return;
                              }
                              const activePlayers = Array.isArray(players) ? players.filter(Boolean) : [];
                              const allHaveScores = activePlayers.length > 0 && activePlayers.every(pName => {
                                const scores = playerData?.[pName]?.scores;
                                if (!Array.isArray(scores)) return false;
                                const score = scores[mobileSelectedHole - 1];
                                return score !== '' && score != null;
                              });
                              // Only check CH if we're going to advance to next hole
                              if (allHaveScores && mobileSelectedHole < 18 && !allPlayersHaveCH()) {
                                setShowCHWarning(true);
                                console.log('[MedalScorecard] [MEDAL] Not advancing: not all CH present for all players.');
                                return;
                              }
                              console.log('[MedalScorecard] allHaveScores:', allHaveScores, 'playerData:', playerData, 'players:', players, 'current hole:', mobileSelectedHole);
                              setSaveStatus('saving');
                              await flushAndSaveAll();
                              if (allHaveScores && mobileSelectedHole < 18) {
                                console.log('[MedalScorecard] Advancing to next hole:', mobileSelectedHole + 1);
                                setMobileSelectedHole(h => {
                                  console.log('[MedalScorecard] setMobileSelectedHole called. Previous:', h, 'Next:', h + 1);
                                  return h + 1;
                                });
                              } else {
                                if (!allHaveScores) {
                                  console.log('[MedalScorecard] Not advancing: not all scores present for this hole.');
                                } else if (mobileSelectedHole >= 18) {
                                  console.log('[MedalScorecard] Not advancing: already at last hole.');
                                }
                              }
                            }}
                          >
                            {saveStatus === 'saving'
                              ? (() => {
                                  const activePlayers = Array.isArray(players) ? players.filter(Boolean) : [];
                                  const allHaveScores = activePlayers.length > 0 && activePlayers.every(pName => {
                                    const scores = playerData?.[pName]?.scores;
                                    if (!Array.isArray(scores)) return false;
                                    const score = scores[mobileSelectedHole - 1];
                                    return score !== '' && score != null;
                                  });
                                  if (allHaveScores && mobileSelectedHole < 18) {
                                    return 'Saving scores and going to next hole...';
                                  }
                                  return 'Saving scores...';
                                })()
                              : (saveStatus === 'saved'
                                ? 'Scores Saved!'
                                : (() => {
                                    const activePlayers = Array.isArray(players) ? players.filter(Boolean) : [];
                                    const allHaveScores = activePlayers.length > 0 && activePlayers.every(pName => {
                                      const scores = playerData?.[pName]?.scores;
                                      if (!Array.isArray(scores)) return false;
                                      const score = scores[mobileSelectedHole - 1];
                                      return score !== '' && score != null;
                                    });
                                    if (allHaveScores && mobileSelectedHole < 18) {
                                      return `Save and Go to Hole ${mobileSelectedHole + 1}`;
                                    }
                                    return 'Save';
                                  })()
                                )}
                          </button>
                        </div>
                        {/* Mobile Leaderboard button for medal/alliance/4bbb mobile view */}
                        <div className="sm:hidden mt-3 text-center">
                          {(() => {
                            const today = new Date();
                            const isOpenComp = comp && (comp.status === 'Open' || (comp.date && new Date(comp.date) >= new Date(today.getFullYear(), today.getMonth(), today.getDate())));
                            return (
                              <button
                                className="w-full py-2 rounded-2xl bg-[#1B3A6B] text-white font-semibold flex items-center justify-center gap-2 border border-white"
                                style={{ opacity: isOpenComp ? 1 : 0.5, pointerEvents: isOpenComp ? 'auto' : 'none' }}
                                onClick={() => { if (!isOpenComp) return; try { const id = comp.id || comp._id || comp.joinCode || comp.joincode; navigate(`/leaderboard/${id}`, { state: { competition: comp } }); } catch (e) {} }}
                              >
                                <TrophyIcon className="h-5 w-5 mr-1" style={{ color: '#FFD700' }} />
                                Leaderboard
                              </button>
                            );
                          })()}
                        </div>
                        {/* duplicate mobile leaderboard button removed from medal branch */}
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
                          {holesArr.map((hole, hIdx) => (
                            <div key={hole.number} className="flex items-center justify-between py-2">
                              <div className="w-20">
                                <div className="text-sm font-bold">Hole {hole.number}</div>
                                <div className="text-xs text-white/80">Par {hole.par} • S{hole.index}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button aria-label={`decrement-hole-${hole.number}-${name}`} className="px-2 py-1 rounded bg-white/10" onClick={() => { applyDeltaToHole(name, hIdx, -1); }} disabled={!canEdit(name)}>−</button>
                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                  <input
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    className="w-14 text-center bg-transparent text-lg font-bold focus:outline-none placeholder-gray-400"
                                    placeholder={hole?.par ?? ''}
                                    value={playerData[name]?.scores?.[hIdx] ?? ''}
                                    onChange={e => {
                                      if (!canEdit(name)) return;
                                      handleScoreChange(name, hIdx, e.target.value);
                                    }}
                                  />
                                  {/* Spinner removed: now global overlay */}
                                </div>
                                <button aria-label={`increment-hole-${hole.number}-${name}`} className="px-2 py-1 rounded bg-white/10" onClick={() => { applyDeltaToHole(name, hIdx, +1); }} disabled={!canEdit(name)}>+</button>
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
                  {/* Mobile Leaderboard button for per-player mobile cards (all comp types) */}
                  <div className="sm:hidden mt-3 text-center">
                    {(() => {
                      const today = new Date();
                      const isOpenComp = comp && (comp.status === 'Open' || (comp.date && new Date(comp.date) >= new Date(today.getFullYear(), today.getMonth(), today.getDate())));
                      return (
                        <button
                          className="w-full py-2 rounded-2xl bg-[#1B3A6B] text-white font-semibold flex items-center justify-center gap-2 border border-white"
                          style={{ opacity: isOpenComp ? 1 : 0.5, pointerEvents: isOpenComp ? 'auto' : 'none' }}
                          onClick={() => { if (!isOpenComp) return; try { const id = comp.id || comp._id || comp.joinCode || comp.joincode; navigate(`/leaderboard/${id}`, { state: { competition: comp } }); } catch (e) {} }}
                        >
                          <TrophyIcon className="h-5 w-5 mr-1" style={{ color: '#FFD700' }} />
                          Leaderboard
                        </button>
                      );
                    })()}
                  </div>
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
                      {holesArr.slice(0,9).map(hole => (
                    <th key={hole.number} className="border px-2 py-1 bg-white/5">{hole.number}</th>
                  ))}
                  <th className="border px-2 py-1 bg-white/5 font-bold">Out</th>
                </tr>
                <tr className="bg-blue-900/90">
                  <th className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}></th>
                  <th className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}>PAR</th>
                      {holesArr.slice(0,9).map(hole => (
                    <th key={hole.number} className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}>{hole.par}</th>
                  ))}
                  <th className="border px-2 py-1 font-bold" style={{background:'#1B3A6B',color:'white'}}>36</th>
                </tr>
                <tr className="bg-gray-900/90">
                  <th className="border px-2 py-1 bg-white/5"></th>
                  <th className="border px-2 py-1 bg-white/5">STROKE</th>
                      {holesArr.slice(0,9).map(hole => (
                    <th key={hole.number} className="border px-2 py-1 bg-white/5">{hole.index}</th>
                  ))}
                  <th className="border px-2 py-1 bg-white/5"></th>
                </tr>
              </thead>
              <tbody>
                  {players.map((name, pIdx) => {
                  const isAlliance = (props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('alliance')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('alliance'));
                  const is4bbb = (props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('4bbb')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('4bbb')) || (props.compTypeOverride && props.compTypeOverride.toString().toLowerCase().includes('4bbb'));
                  const isIndividual = (props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('individual')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('individual')) || (props.compTypeOverride && props.compTypeOverride.toString().toLowerCase().includes('individual'));
                  const resultLabel = (isAlliance || is4bbb || isIndividual) ? 'Points' : 'Net';
                  // For Alliance, 4BBB and Individual Stableford we want per-hole stableford points for the player
                  const stable = (isAlliance || is4bbb || isIndividual) ? computePlayerStablefordTotals(name) : null;
                  // Return an array: the player's rows, and optionally the pair 'Score' row immediately after player B (pIdx===1) and player D (pIdx===3)
                  return [
                  <React.Fragment key={name + '-rows-front'}>
                    {/* Gross row */}
                    <tr key={name + '-gross-front'}>
                      <td rowSpan={2} className={`border border-white px-2 py-1 font-bold text-lg text-center align-middle ${playerColors[pIdx % playerColors.length]}`} style={{ minWidth: 32, verticalAlign: 'middle' }}>
                        <span className="hidden sm:inline">{String.fromCharCode(65 + pIdx)}</span>
                      </td>
                      <td className="border px-2 py-1 text-base font-bold bg-white/10 text-center" style={{ minWidth: 40 }}>Gross</td>
                      {holesArr.slice(0,9).map((hole, hIdx) => (
                        <td key={hIdx} className="border py-1 text-center align-middle font-bold text-base">
                          <div className="flex items-center justify-center">
                            {useMobilePicker ? (
                              <select
                                value={playerData[name]?.scores?.[hIdx] ?? ''}
                                onChange={e => { if (!canEdit(name)) return; handleScoreChange(name, hIdx, e.target.value); }}
                                disabled={!canEdit(name)}
                                className={`w-10 h-10 text-center focus:outline-none block mx-auto font-bold text-base px-0 ${scoreCellClass(name, hIdx)}`}
                                style={{ border: 'none', color: '#FFFFFF', background: 'transparent', ...scoreCellStyle(name, hIdx) }}
                              >
                                <option value="">-</option>
                                {Array.from({ length: 21 }).map((_, i) => (
                                  <option key={i} value={String(i)}>{i}</option>
                                ))}
                              </select>
                            ) : (
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
                            )}
                          </div>
                        </td>
                      ))}
                      <td className="border px-2 py-1 font-bold text-base">{
                        (() => {
                          if (!Array.isArray(playerData[name]?.scores)) return '';
                          const total = playerData[name].scores.slice(0,9).reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0);
                          return Number.isFinite(total) && typeof total === 'number' ? total : '';
                        })()
                      }</td>
                    </tr>
                    {/* Net row (no player label cell) */}
                    <tr key={name + '-net-front'}>
                      <td className="border px-2 py-1 bg-white/10 text-base font-bold text-center align-middle" style={{ minWidth: 40, verticalAlign: 'middle', height: '44px' }}>{resultLabel}</td>
                      {holesArr.slice(0,9).map((hole, hIdx) => {
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
                        if ((props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('alliance')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('alliance')) || is4bbb || ((props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('individual')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('individual')) || (props.compTypeOverride && props.compTypeOverride.toString().toLowerCase().includes('individual')))) {
                          // For Alliance and 4BBB show stableford points per hole (computed using PH inside computePlayerStablefordTotals)
                          const pts = stable ? (stable.perHole ? stable.perHole[hIdx] : stablefordPoints(net, hole.par)) : stablefordPoints(net, hole.par);
                          return (
                            <td key={hIdx} className="border px-1 py-1 bg-white/5 align-middle font-bold text-base" style={{ verticalAlign: 'middle', height: '44px' }}>
                              {pts != null ? pts : ''}
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
                          if (isAlliance || is4bbb || isIndividual) {
                            // sum stableford points for front 9
                            const pts = computePlayerStablefordTotals(name);
                            return pts.front;
                          }
                          const playingHandicap = computePH(playerData[name]?.handicap) || 0;
                          let netFrontTotal = 0;
                          holesArr.slice(0,9).forEach((hole, hIdx) => {
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
                  </React.Fragment>,
                  (is4bbb && (pIdx === 1 || pIdx === 3)) ? (() => {
                    const pairStart = pIdx === 1 ? 0 : 2;
                    const nameA = players[pairStart];
                    const nameB = players[pairStart + 1];
                    const stabA = computePlayerStablefordTotals(nameA) || { perHole: Array(18).fill(0) };
                    const stabB = computePlayerStablefordTotals(nameB) || { perHole: Array(18).fill(0) };
                    const is4bbbBonus = ((props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('bonus')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('bonus')) || (props.compTypeOverride && props.compTypeOverride.toString().toLowerCase().includes('bonus')));
                    const perHoleFront = holesArr.slice(0, 9).map((_, idx) => {
                      const holeIdx = idx;
                      const a = stabA.perHole?.[holeIdx];
                      const b = stabB.perHole?.[holeIdx];
                      if (a == null && b == null) return null;
                      let bb = Math.max(Number(a || 0), Number(b || 0));
                      if (is4bbbBonus) {
                        const sum = Number(a || 0) + Number(b || 0);
                        if (sum >= 6) bb += 1;
                      }
                      return bb;
                    });
                    const frontSum = perHoleFront.reduce((s, v) => s + (v != null ? v : 0), 0);
                    return (
                      <tr key={`pair-score-front-${pairStart}`}>
                        <td className="border px-2 py-1 bg-white/5" />
                        <td className="border px-2 py-1 bg-white/10 text-base font-bold text-center align-middle" style={{ minWidth: 40, verticalAlign: 'middle', height: '44px' }}>BB Score</td>
                        {perHoleFront.map((val, hIdx) => (
                          <td key={hIdx} className="border px-1 py-1 bg-white/5 align-middle font-bold text-base" style={{ verticalAlign: 'middle', height: '44px' }}>
                            {val != null ? val : ''}
                          </td>
                        ))}
                        {(() => {
                          const frontCount = perHoleFront.filter(v => v != null).length;
                          return (
                            <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>{frontCount ? frontSum : ''}</td>
                          );
                        })()}
                      </tr>
                    );
                  })() : null
                  ];
                })}
                {/* For 4BBB, render pair 'Score' rows after player B and player D (pairs A+B and C+D). */}
                
                {/* Alliance team 'Score' row: sum of best two stableford totals (only for alliance comps, not 4BBB) */}
                {((props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('alliance')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('alliance'))) && !((props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('4bbb')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('4bbb'))) && (
                  (() => {
                    const group = groups[groupIdx] || { players: [] };
                    const best = computeGroupBestTwoTotals(group);
                    return (
                      <tr key={`group-score-front-${groupIdx}`}>
                        <td className="border px-2 py-1 bg-white/5" />
                        <td className="border px-2 py-1 bg-white/10 text-base font-bold text-center align-middle" style={{ minWidth: 40, verticalAlign: 'middle', height: '44px' }}>Score</td>
                        {holesArr.slice(0,9).map((_, hIdx) => {
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
                  {holesArr.slice(9,18).map(hole => (
                    <th key={hole.number} className="border px-2 py-1 bg-white/5">{hole.number}</th>
                  ))}
                  <th className="border px-2 py-1 bg-white/5 font-bold">In</th>
                  <th className="border px-2 py-1 bg-white/5 font-bold">TOTAL</th>
                </tr>
                <tr className="bg-blue-900/90">
                  <th className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}></th>
                  <th className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}>PAR</th>
                  {holesArr.slice(9,18).map(hole => (
                    <th key={hole.number} className="border px-2 py-1" style={{background:'#1B3A6B',color:'white'}}>{hole.par}</th>
                  ))}
                  <th className="border px-2 py-1 font-bold" style={{background:'#1B3A6B',color:'white'}}>36</th>
                  <th className="border px-2 py-1 font-bold" style={{background:'#1B3A6B',color:'white'}}>72</th>
                </tr>
                <tr className="bg-gray-900/90">
                  <th className="border px-2 py-1 bg-white/5"></th>
                  <th className="border px-2 py-1 bg-white/5">STROKE</th>
                  {holesArr.slice(9,18).map(hole => (
                    <th key={hole.number} className="border px-2 py-1 bg-white/5">{hole.index}</th>
                  ))}
                  <th className="border px-2 py-1 bg-white/5 border-r"></th>
                  <th className="border px-2 py-1 bg-white/5 border-r"></th>
                </tr>
              </thead>
              <tbody>
                {/* Render Back 9 in pairs: A+B, C+D */}
                {[0, 2].map(pairStart => {
                  const nameA = players[pairStart];
                  const nameB = players[pairStart + 1];
                  const stableA = computePlayerStablefordTotals(nameA);
                  const stableB = computePlayerStablefordTotals(nameB);
                  return (
                    <React.Fragment key={`back9-pair-${pairStart}`}>
                      {/* Gross row for A and B */}
                      <tr>
                        <td rowSpan={2} className={`border border-white px-2 py-1 font-bold text-lg text-center align-middle ${playerColors[pairStart % playerColors.length]}`} style={{ minWidth: 32, verticalAlign: 'middle' }}>
                          <span className="hidden sm:inline">{String.fromCharCode(65 + pairStart)}</span>
                        </td>
                        <td className="border px-2 py-1 text-base font-bold bg-white/10 text-center" style={{ minWidth: 40 }}>Gross</td>
                        {holesArr.slice(9,18).map((hole, hIdx) => (
                          <td key={hIdx} className="border py-1 text-center align-middle font-bold text-base">
                            <div className="flex items-center justify-center">
                              {useMobilePicker ? (
                                <select
                                  value={playerData[nameA]?.scores?.[hIdx+9] ?? ''}
                                  onChange={e => { if (!canEdit(nameA)) return; handleScoreChange(nameA, hIdx+9, e.target.value); }}
                                  disabled={!canEdit(nameA)}
                                  className={`w-10 h-10 text-center focus:outline-none block mx-auto font-bold text-base px-0 ${scoreCellClass(nameA, hIdx+9)}`}
                                  style={{ border: 'none', color: '#FFFFFF', background: 'transparent', ...scoreCellStyle(nameA, hIdx+9) }}
                                >
                                  <option value="">-</option>
                                  {Array.from({ length: 21 }).map((_, i) => (
                                    <option key={i} value={String(i)}>{i}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  max="20"
                                  value={playerData[nameA]?.scores?.[hIdx+9] || ''}
                                  onChange={e => { if (!canEdit(nameA)) return; handleScoreChange(nameA, hIdx+9, e.target.value); }}
                                  disabled={!canEdit(nameA)}
                                  className={`w-10 h-10 text-center focus:outline-none block mx-auto font-bold text-base no-spinner px-0 ${scoreCellClass(nameA, hIdx+9)}`}
                                  inputMode="numeric"
                                  style={{ MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none', paddingLeft: '0.5rem', paddingRight: '0.5rem', ...scoreCellStyle(nameA, hIdx+9) }}
                                />
                              )}
                            </div>
                          </td>
                        ))}
                        <td className="border px-2 py-1 font-bold text-base">{
                          (() => {
                            if (!Array.isArray(playerData[nameA]?.scores)) return '';
                            const total = playerData[nameA].scores.slice(9,18).reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0);
                            return Number.isFinite(total) && typeof total === 'number' ? total : '';
                          })()
                        }</td>
                        <td className="border px-2 py-1 font-bold text-base">{
                          (() => {
                            if (!Array.isArray(playerData[nameA]?.scores)) return '';
                            const total = playerData[nameA].scores.reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0);
                            return Number.isFinite(total) && typeof total === 'number' ? total : '';
                          })()
                        }</td>
                      </tr>
                      {/* Points row for A */}
                      <tr>
                        <td className="border px-2 py-1 bg-white/10 text-base font-bold text-center align-middle" style={{ minWidth: 40, verticalAlign: 'middle', height: '44px' }}>Points</td>
                        {holesArr.slice(9,18).map((hole, hIdx) => {
                          const pts = stableA && stableA.perHole ? stableA.perHole[hIdx+9] : '';
                          return (
                            <td key={hIdx} className="border px-1 py-1 bg-white/5 align-middle font-bold text-base" style={{ verticalAlign: 'middle', height: '44px' }}>{Number.isFinite(pts) ? pts : ''}</td>
                          );
                        })}
                        <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>{Number.isFinite(stableA?.back) ? stableA.back : ''}</td>
                        <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>{Number.isFinite(stableA?.total) ? stableA.total : ''}</td>
                      </tr>
                      {/* Gross row for B */}
                      <tr>
                        <td rowSpan={2} className={`border border-white px-2 py-1 font-bold text-lg text-center align-middle ${playerColors[(pairStart+1) % playerColors.length]}`} style={{ minWidth: 32, verticalAlign: 'middle' }}>
                          <span className="hidden sm:inline">{String.fromCharCode(65 + pairStart + 1)}</span>
                        </td>
                        <td className="border px-2 py-1 text-base font-bold bg-white/10 text-center" style={{ minWidth: 40 }}>Gross</td>
                        {holesArr.slice(9,18).map((hole, hIdx) => (
                          <td key={hIdx} className="border py-1 text-center align-middle font-bold text-base">
                            <div className="flex items-center justify-center">
                              {useMobilePicker ? (
                                <select
                                  value={playerData[nameB]?.scores?.[hIdx+9] ?? ''}
                                  onChange={e => { if (!canEdit(nameB)) return; handleScoreChange(nameB, hIdx+9, e.target.value); }}
                                  disabled={!canEdit(nameB)}
                                  className={`w-10 h-10 text-center focus:outline-none block mx-auto font-bold text-base px-0 ${scoreCellClass(nameB, hIdx+9)}`}
                                  style={{ border: 'none', color: '#FFFFFF', background: 'transparent', ...scoreCellStyle(nameB, hIdx+9) }}
                                >
                                  <option value="">-</option>
                                  {Array.from({ length: 21 }).map((_, i) => (
                                    <option key={i} value={String(i)}>{i}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  max="20"
                                  value={playerData[nameB]?.scores?.[hIdx+9] || ''}
                                  onChange={e => { if (!canEdit(nameB)) return; handleScoreChange(nameB, hIdx+9, e.target.value); }}
                                  disabled={!canEdit(nameB)}
                                  className={`w-10 h-10 text-center focus:outline-none block mx-auto font-bold text-base no-spinner px-0 ${scoreCellClass(nameB, hIdx+9)}`}
                                  inputMode="numeric"
                                  style={{ MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none', paddingLeft: '0.5rem', paddingRight: '0.5rem', ...scoreCellStyle(nameB, hIdx+9) }}
                                />
                              )}
                            </div>
                          </td>
                        ))}
                        <td className="border px-2 py-1 font-bold text-base">{
                          (() => {
                            if (!Array.isArray(playerData[nameB]?.scores)) return '';
                            const total = playerData[nameB].scores.slice(9,18).reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0);
                            return Number.isFinite(total) && typeof total === 'number' ? total : '';
                          })()
                        }</td>
                        <td className="border px-2 py-1 font-bold text-base">{
                          (() => {
                            if (!Array.isArray(playerData[nameB]?.scores)) return '';
                            const total = playerData[nameB].scores.reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0);
                            return Number.isFinite(total) && typeof total === 'number' ? total : '';
                          })()
                        }</td>
                      </tr>
                      {/* Points row for B */}
                      <tr>
                        <td className="border px-2 py-1 bg-white/10 text-base font-bold text-center align-middle" style={{ minWidth: 40, verticalAlign: 'middle', height: '44px' }}>Points</td>
                        {holesArr.slice(9,18).map((hole, hIdx) => {
                          const pts = stableB && stableB.perHole ? stableB.perHole[hIdx+9] : '';
                          return (
                            <td key={hIdx} className="border px-1 py-1 bg-white/5 align-middle font-bold text-base" style={{ verticalAlign: 'middle', height: '44px' }}>{Number.isFinite(pts) ? pts : ''}</td>
                          );
                        })}
                        <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>{Number.isFinite(stableB?.back) ? stableB.back : ''}</td>
                        <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>{Number.isFinite(stableB?.total) ? stableB.total : ''}</td>
                      </tr>
                      {/* BB Score row for back 9 under AB pair (4BBB only) */}
                      {(((props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('4bbb')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('4bbb'))) && !((props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('alliance')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('alliance')))) && (
                        (() => {
                          const is4bbbBonus = ((props.overrideTitle && props.overrideTitle.toString().toLowerCase().includes('bonus')) || (comp && comp.type && comp.type.toString().toLowerCase().includes('bonus')) || (props.compTypeOverride && props.compTypeOverride.toString().toLowerCase().includes('bonus')));
                          const perHoleBack = holesArr.slice(9, 18).map((_, idx) => {
                            const holeIdx = 9 + idx;
                            const a = stableA && stableA.perHole ? stableA.perHole[holeIdx] : 0;
                            const b = stableB && stableB.perHole ? stableB.perHole[holeIdx] : 0;
                            if (a == null && b == null) return null;
                            let bb = Math.max(Number(a || 0), Number(b || 0));
                            if (is4bbbBonus) {
                              const sum = Number(a || 0) + Number(b || 0);
                              if (sum >= 6) bb += 1;
                            }
                            return bb;
                          });
                          const backSum = perHoleBack.reduce((s, v) => s + (v != null ? v : 0), 0);
                          const backCount = perHoleBack.filter(v => v != null).length;
                          // Compute front 9 BB total with bonus for grand total column
                          const perHoleFront = holesArr.slice(0, 9).map((_, idx) => {
                            const holeIdx = idx;
                            const a = stableA && stableA.perHole ? stableA.perHole[holeIdx] : 0;
                            const b = stableB && stableB.perHole ? stableB.perHole[holeIdx] : 0;
                            if (a == null && b == null) return null;
                            let bb = Math.max(Number(a || 0), Number(b || 0));
                            if (is4bbbBonus) {
                              const sum = Number(a || 0) + Number(b || 0);
                              if (sum >= 6) bb += 1;
                            }
                            return bb;
                          });
                          const frontSum = perHoleFront.reduce((s, v) => s + (v != null ? v : 0), 0);
                          const grandTotal = frontSum + backSum;
                          return (
                            <tr key={`pair-score-back-${pairStart}`}>
                              <td className="border px-2 py-1 bg-white/5" />
                              <td className="border px-2 py-1 bg-white/10 text-base font-bold text-center align-middle" style={{ minWidth: 40, verticalAlign: 'middle', height: '44px' }}>BB Score</td>
                              {perHoleBack.map((val, hIdx) => (
                                <td key={hIdx} className="border px-1 py-1 bg-white/5 align-middle font-bold text-base" style={{ verticalAlign: 'middle', height: '44px' }}>
                                  {val != null ? val : ''}
                                </td>
                              ))}
                              <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>{backCount ? backSum : ''}</td>
                              <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>{backCount ? grandTotal : ''}</td>
                            </tr>
                          );
                        })()
                      )}
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
                              {val != null ? val : ''}
                            </td>
                          );
                        })}
                        <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>{best.back}</td>
                        <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>{best.total}</td>
                      </tr>
                    );
                  })()
                )}
                {/* Back 9 BB rows are inserted inline under each pair above; no extra rows below. */}
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
    </>
  );
}