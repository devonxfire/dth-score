import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import socket from './socket';
import { apiUrl } from './api';
import './popupJiggle.css';
import { checkAndMark, shouldShowPopup, markShown } from './popupDedupe';
import { toast } from './simpleToast';

export default function GlobalPopups() {
  const [showBirdie, setShowBirdie] = useState(false);
  const [birdiePlayer, setBirdiePlayer] = useState('');
  const [birdieHole, setBirdieHole] = useState(null);

  const [showEagle, setShowEagle] = useState(false);
  const [eaglePlayer, setEaglePlayer] = useState('');
  const [eagleHole, setEagleHole] = useState(null);

  const [showBlowup, setShowBlowup] = useState(false);
  const [blowupPlayer, setBlowupPlayer] = useState('');
  const [blowupHole, setBlowupHole] = useState(null);

  const [showWaters, setShowWaters] = useState(false);
  const [watersPlayer, setWatersPlayer] = useState('');

  const [showDog, setShowDog] = useState(false);
  const [dogPlayer, setDogPlayer] = useState('');

  const birdieTimeout = useRef(null);
  const eagleTimeout = useRef(null);
  const blowupTimeout = useRef(null);
  const watersTimeout = useRef(null);
  const dogTimeout = useRef(null);
  const lastMiniRef = useRef(new Map()); // key -> { waters, dog }
  const verifyTimeouts = useRef(new Map()); // key -> timeoutId for delayed verification
  // track last shown popup per player+hole to avoid showing lower-priority
  // popups after a higher-priority one (e.g. birdie then immediate eagle)
  const lastShown = useRef(new Map()); // key -> { type, ts }
  const POPUP_PRIORITY = { eagle: 3, birdie: 2, blowup: 1 };

  // Join all competitions so we receive their realtime events regardless of UI route.
  useEffect(() => {
    // mounted; joining competitions below
    let cancelled = false;
    let joined = [];
    (async () => {
      try {
        const res = await fetch(apiUrl('/api/competitions'));
  if (!res.ok) { return; }
        const data = await res.json();
  // fetched competitions
        if (cancelled) return;
        const comps = (data || []);

        // Seed lastMiniRef with any existing waters/dog state so we don't fire
        // mini-stat popups for already-present values on initial load.
        try {
          for (const c of comps) {
            try {
              const id = Number(c.id || c._id);
              if (!Number.isFinite(id)) continue;
              // fetch full competition detail to inspect groups
              const detailRes = await fetch(apiUrl(`/api/competitions/${id}`));
              if (!detailRes.ok) continue;
              const detail = await detailRes.json();
              const groups = Array.isArray(detail.groups) ? detail.groups : [];
              for (const g of groups) {
                const groupId = g.id ?? g.groupId ?? null;
                const waters = g.waters || {};
                const dog = g.dog || {};
                const players = Array.isArray(g.players) ? g.players : [];
                for (const name of players) {
                  try {
                    const key = `${groupId ?? ''}:${name}:c:${id}`;
                    lastMiniRef.current.set(key, { waters: !!waters[name], dog: !!dog[name] });
                  } catch (e) { /* ignore per-name errors */ }
                }
              }
            } catch (e) { /* ignore per-competition errors */ }
          }
        } catch (e) {
          /* seeding mini-state failed; ignore */
        }

        const doJoin = () => {
          for (const c of comps) {
            try {
              const id = Number(c.id || c._id);
              socket.emit('join', { competitionId: id });
              joined.push(id);
            } catch (e) { /* ignore */ }
          }
          /* joined competitions (best-effort) */
        };

        if (socket && socket.connected) {
          doJoin();
        } else if (socket) {
          socket.once('connect', doJoin);
        }
      } catch (e) { }
    })();
    return () => {
      cancelled = true;
      try {
        // leave joined competitions
        // best-effort: leave any joined rooms
        if (socket && socket.connected) {
          // fetch current competitions to compute ids as well
          fetch(apiUrl('/api/competitions')).then(r => r.ok ? r.json() : null).then(data => {
            const comps = data || [];
            for (const c of comps) {
              try { socket.emit('leave', { competitionId: Number(c.id || c._id) }); } catch (e) { }
            }
          }).catch(() => {});
        }
      } catch (e) {}
    };
  }, []);

  useEffect(() => {
    function scheduleHide(ref, setter, ms = 15000) {
      if (ref.current) clearTimeout(ref.current);
      ref.current = setTimeout(() => setter(false), ms);
    }

    // scheduleVerifiedPopup: wait briefly then fetch the saved player score to
    // verify the update persisted before showing a global popup. This mirrors
    // the delayed verification used in `MedalScorecard` and prevents false
    // positives when clients are rapidly editing values.
    function scheduleVerifiedPopup({ type, name, holeIdx, holeNumber, strokes, compId = null, group = null }) {
      try {
        const key = `${type}:${name}:h:${holeIdx}:c:${compId ?? 'x'}:g:${(group && group.id != null) ? group.id : 'x'}`;
        // clear any existing verify timer for this key
        const existing = verifyTimeouts.current.get(key);
        if (existing) clearTimeout(existing);

  // scheduling verify popup (delayed verification)
        const tid = setTimeout(async () => {
          try {
            // If competition id is available, fetch the competition to find the group index
            let groupIdx = null;
            if (compId) {
              try {
                const compRes = await fetch(apiUrl(`/api/competitions/${compId}`));
                if (compRes.ok) {
                  const compJson = await compRes.json();
                  if (Array.isArray(compJson.groups)) {
                    // find the group index containing this player name
                    for (let gi = 0; gi < compJson.groups.length; gi++) {
                      const g = compJson.groups[gi];
                      if (Array.isArray(g.players) && g.players.some(p => (p || '').toString().trim() === (name || '').toString().trim())) { groupIdx = gi; break; }
                    }
                  }
                }
              } catch (e) { /* ignore fetch errors */ }
            }

            // If we resolved a group index, fetch the player's saved scores for that group
            let currentMatches = false;
            if (compId && groupIdx != null) {
              try {
                const playerRes = await fetch(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`));
                if (playerRes.ok) {
                  const playerJson = await playerRes.json();
                  const arr = Array.isArray(playerJson.scores) ? playerJson.scores : [];
                  const val = arr[holeIdx];
                  // compare loosely (string/number)
                  if ((val != null && String(val) === String(strokes)) || (Number(val) === Number(strokes))) currentMatches = true;
                }
              } catch (e) { /* ignore */ }
            } else if (!compId) {
              // fallback: no comp id — assume mapped value is authoritative and show immediately
              currentMatches = true;
            }

            // verification result: currentMatches
            if (currentMatches) {
              // Use the same signature format as local scorecards so dedupe matches
              // (e.g. `eagle:Bob:12:123`). Fall back to 'x' for missing compId.
              const sig = `${type}:${name}:${holeNumber}:${compId ?? 'x'}`;
              if (checkAndMark(sig)) {
                // trigger UI and schedule hide like local scorecard
                if (type === 'eagle') { setEaglePlayer(name); setEagleHole(holeNumber); setShowEagle(true); if (navigator.vibrate) navigator.vibrate([200,100,200,100,200]); scheduleHide(eagleTimeout, setShowEagle, 30000); }
                if (type === 'birdie') { setBirdiePlayer(name); setBirdieHole(holeNumber); setShowBirdie(true); if (navigator.vibrate) navigator.vibrate([100,50,100]); scheduleHide(birdieTimeout, setShowBirdie, 30000); }
                if (type === 'blowup') { setBlowupPlayer(name); setBlowupHole(holeNumber); setShowBlowup(true); if (navigator.vibrate) navigator.vibrate([400,100,400]); scheduleHide(blowupTimeout, setShowBlowup, 30000); }
              }
            } else {
              // verification failed for saved score; ignoring
            }
          } catch (e) {}
          try { verifyTimeouts.current.delete(key); } catch (e) {}
        }, 2000);

        verifyTimeouts.current.set(key, tid);
      } catch (e) {}
    }

  const handler = (msg) => {
    // handler received message
      try {
        if (!msg) return;
        // Support mappedScores arrays (scores-updated) and group updates (medal-player-updated)
        const mapped = msg.mappedScores || [];
        // mappedScores may be emitted by the server for score updates. Score-based
        // celebration popups (birdie/eagle/blowup) are now server-driven via
        // `popup-event`. We keep a debug log here but avoid showing popups from
        // raw mappedScores to prevent duplication and race conditions.
        if (Array.isArray(mapped) && mapped.length > 0) {
          /* mappedScores received; relying on popup-event for score popups */
        }

        // Mini-stat changes (waters/dog) are now server-driven via canonical
        // `popup-event` messages. To avoid duplicate/incorrect mini-stat popups
        // we no longer show popups directly from `medal-player-updated` group
        // updates. Instead, update our seeded state so initial-load values are
        // remembered and rely on `popup-event` for any UI popups.
        if (msg.group && (msg.group.waters || msg.group.dog)) {
          /* group mini-stats present: update local seed only */
          const waters = msg.group.waters || {};
          const dog = msg.group.dog || {};
          const groupId = msg.groupId ?? msg.group?.id ?? '';
          const compId = msg.competitionId ?? msg.competition ?? '';
          for (const name of Array.from(new Set([...Object.keys(waters), ...Object.keys(dog)]))) {
            try {
              const key = `${groupId ?? ''}:${name}:c:${compId}`;
              lastMiniRef.current.set(key, { waters: !!(waters[name]), dog: !!(dog[name]) });
            } catch (e) { /* ignore per-name */ }
          }
        }

        // If a group object contains scores, schedule per-player popup checks similar to local scorecards
        // If a group object contains scores, we log it. Score popups are handled
        // exclusively via server `popup-event` messages to avoid duplication.
        if (msg.group && msg.group.scores) {
          /* group.scores present (handled by popup-event) */
        }
      } catch (e) { }
    };

    // Server-driven popup-event: canonical events emitted after DB commits
    const popupEventHandler = (event) => {
      try {
        if (!event || !event.eventId) return;
        // If this event originated from this client's socket, ignore it to avoid echoing
        try {
          if (event.originSocketId && socket && socket.id && event.originSocketId === socket.id) {
            return; // ignore echo from same socket
          }
        } catch (e) { /* ignore origin checks */ }
        // Prefer deduping by server-provided signature (if present) so that
        // clients which showed an optimistic local popup (using the same
        // signature) will suppress the server rebroadcast. Fall back to
        // deduping by eventId when no signature exists.
  const dedupeKey = event.signature || event.eventId;
  try { if (typeof window !== 'undefined') window.__lastPopupEvent = event; } catch (e) {}
  if (!checkAndMark(dedupeKey)) { return; }
  const { type, playerName, holeNumber } = event;
        // suppress lower-priority popups for same player+hole when a higher
        // priority popup has been shown recently. e.g. birdie then eagle.
        try {
          if (holeNumber && playerName) {
            const pkey = `${String(playerName)}:h:${String(holeNumber)}`;
            const prev = lastShown.current.get(pkey);
            const now = Date.now();
              if (prev && (now - prev.ts) < 10000) {
                const prevPri = POPUP_PRIORITY[prev.type] || 0;
                const newPri = POPUP_PRIORITY[type] || 0;
                if (newPri < prevPri) {
                  // ignore lower-priority event
                  return;
                }
                if (newPri > prevPri) {
                  // hide previous popup UI and continue to show new
                  if (prev.type === 'birdie') { setShowBirdie(false); }
                  if (prev.type === 'eagle') { setShowEagle(false); }
                  if (prev.type === 'blowup') { setShowBlowup(false); }
                }
              }
          }
        } catch (e) { /* ignore suppression errors */ }

        // Use toast for all clients. We still track lastShown to avoid
        // quick lower-priority replacements logic but rendering is via toasts.
        try {
          let emoji = '🎉';
          let title = 'Nice!';
          let body = playerName || '';
          // default 5s autoClose for global popups
          let autoClose = 5000;
          if (type === 'eagle') { emoji = '🦅'; title = 'Eagle!'; body = `For ${playerName || ''} — Hole ${holeNumber || ''}`; if (navigator.vibrate) navigator.vibrate([200,100,200]); }
          else if (type === 'birdie') { emoji = '🕊️'; title = 'Birdie!'; body = `For ${playerName || ''} — Hole ${holeNumber || ''}`; if (navigator.vibrate) navigator.vibrate([100,50,100]); }
          else if (type === 'blowup') { emoji = '💥'; title = "How Embarrassing!"; body = `${playerName || ''} just blew up on Hole ${holeNumber || ''}`; if (navigator.vibrate) navigator.vibrate([400,100,400]); }
          else if (type === 'waters') { emoji = '💧'; title = 'Splash!'; body = `${playerName || ''} has earned a water`; }
          else if (type === 'dog') { emoji = '🐶'; title = 'Woof!'; body = `${playerName || ''} got the dog`; }

          // prevent lower-priority replacement for same player+hole shortly after
          try {
            if (holeNumber && playerName) {
              const pkey = `${String(playerName)}:h:${String(holeNumber)}`;
              const prev = lastShown.current.get(pkey);
              const now = Date.now();
              if (prev && (now - prev.ts) < 10000) {
                const prevPri = POPUP_PRIORITY[prev.type] || 0;
                const newPri = POPUP_PRIORITY[type] || 0;
                if (newPri < prevPri) {
                  return;
                }
                if (newPri > prevPri) {
                  // replacing previous popup with higher-priority
                }
              }
              lastShown.current.set(pkey, { type, ts: now });
              setTimeout(() => { try { const cur = lastShown.current.get(pkey); if (cur && (Date.now() - cur.ts) > 10000) lastShown.current.delete(pkey); } catch (e) {} }, 11000);
            }
          } catch (e) {}

          const content = (
            <div className="flex flex-col items-center popup-jiggle" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: 8 }}>{emoji}</div>
              <div style={{ fontWeight: 800, color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', fontSize: '1.4rem' }}>{title}</div>
              <div style={{ color: 'white', fontFamily: 'Lato, Arial, sans-serif', fontSize: '1.05rem' }}>{body}</div>
            </div>
          );

          try {
            toast(content, { toastId: dedupeKey, autoClose, position: 'top-center', closeOnClick: true });
          } catch (e) { console.error('toast error', e); }
        } catch (e) { console.error('popup-event render error', e); }
      } catch (e) { console.error('popupEventHandler error', e); }
    };

    // initial-mini-stats seeds: server sends this only to joining socket to avoid
    // rendering popups for pre-existing mini-stats
    const initialMiniHandler = (payload) => {
    try {
      if (!payload || !Array.isArray(payload.groups)) return;
        for (const g of payload.groups) {
          const groupId = g.groupId;
          const waters = g.waters || {};
          const dog = g.dog || {};
          const compId = payload.competitionId ?? '';
          const players = Array.from(new Set([...Object.keys(waters || {}), ...Object.keys(dog || {})]));
          for (const name of players) {
            try {
              const key = `${groupId ?? ''}:${name}:c:${compId}`;
              lastMiniRef.current.set(key, { waters: !!waters[name], dog: !!dog[name] });
            } catch (e) {}
          }
        }
      } catch (e) { console.error('initialMiniHandler error', e); }
    };

    socket.on('scores-updated', handler);
    socket.on('medal-player-updated', handler);
    socket.on('team-user-updated', handler);
    socket.on('fines-updated', handler);
  socket.on('popup-event', popupEventHandler);
  socket.on('initial-mini-stats', initialMiniHandler);

    return () => {
      socket.off('scores-updated', handler);
      socket.off('medal-player-updated', handler);
      socket.off('team-user-updated', handler);
      socket.off('fines-updated', handler);
  socket.off('popup-event', popupEventHandler);
  socket.off('initial-mini-stats', initialMiniHandler);
      try { if (birdieTimeout.current) clearTimeout(birdieTimeout.current); } catch (e) {}
      try {
        for (const t of verifyTimeouts.current.values()) { clearTimeout(t); }
        verifyTimeouts.current.clear();
      } catch (e) {}
    };
  }, []);

    // We no longer render the legacy full-screen modal popups here. Toasts are
    // used instead for reliability and cross-route visibility. The old modal
    // JSX is intentionally left commented below in case we want to restore it.
    /*
    const popupNodes = ( ...legacy modal JSX... );
    return createPortal(popupNodes, document.body);
    */
    return null;
}
