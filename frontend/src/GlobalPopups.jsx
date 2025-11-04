import React, { useEffect, useRef, useState } from 'react';
import socket from './socket';
import { apiUrl } from './api';
import './popupJiggle.css';
import { checkAndMark, shouldShowPopup, markShown } from './popupDedupe';

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

  // Join all competitions so we receive their realtime events regardless of UI route.
  useEffect(() => {
    console.log('[global-popups] mounted, socket connected?', !!(socket && socket.connected));
    let cancelled = false;
    let joined = [];
    (async () => {
      try {
        const res = await fetch(apiUrl('/api/competitions'));
        if (!res.ok) { console.log('[global-popups] fetch /api/competitions failed', res.status); return; }
        const data = await res.json();
        console.log('[global-popups] fetched competitions count', Array.isArray(data) ? data.length : 0);
        if (cancelled) return;
        const comps = (data || []);

        const doJoin = () => {
          for (const c of comps) {
            try {
              const id = Number(c.id || c._id);
              socket.emit('join', { competitionId: id });
              joined.push(id);
            } catch (e) { /* ignore */ }
          }
          console.log('[global-popups] joined competitions', joined);
        };

        if (socket && socket.connected) {
          console.log('[global-popups] socket already connected, joining now');
          doJoin();
        } else if (socket) {
          console.log('[global-popups] socket not connected yet, will join on connect');
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

        console.log('[global-popups] scheduling verify popup', { type, name, holeIdx, holeNumber, strokes, compId, key });
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

            console.log('[global-popups] verification result', { key, currentMatches });
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
              // debug: didn't match saved score
              console.log('[global-popups] verification failed for', { key, type, name, holeIdx, strokes, compId, groupIdx });
            }
          } catch (e) {}
          try { verifyTimeouts.current.delete(key); } catch (e) {}
        }, 2000);

        verifyTimeouts.current.set(key, tid);
      } catch (e) {}
    }

    const handler = (msg) => {
      console.log('[global-popups] handler received', msg && (msg.mappedScores ? 'mappedScores' : msg.group ? 'group' : Object.keys(msg)));
      try {
        if (!msg) return;
        // Support mappedScores arrays (scores-updated) and group updates (medal-player-updated)
        const mapped = msg.mappedScores || [];
        if (Array.isArray(mapped) && mapped.length > 0) {
          for (const s of mapped) {
            const strokes = parseInt(s.strokes ?? s.value ?? s.strokes_received ?? s.strokesReceived, 10);
            const holeIdx = s.holeIndex ?? s.hole_index ?? s.hole;
            const playerName = s.playerName || s.name || s.userName || s.user || s.userId || s.user_id;
            const hole = (msg.holes && msg.holes[holeIdx]) || null;
            // best-effort: if hole data present use its par
            const par = hole?.par ?? null;
            if (!Number.isFinite(strokes) || par == null) continue;
            const holeNumber = hole?.number ?? holeIdx + 1;
            // Instead of showing immediately, schedule a brief verification (like MedalScorecard)
            // to ensure the saved score persisted before showing a global popup.
            const compId = msg.competitionId ?? msg.competition ?? null;
            if (msg._clientBroadcast) {
              // client-initiated broadcast: show immediately (still deduped)
              if (strokes === par - 2) {
                const sig = `eagle:${playerName}:${holeNumber}:${compId ?? 'x'}`;
                if (checkAndMark(sig)) { setEaglePlayer(playerName); setEagleHole(holeNumber); setShowEagle(true); scheduleHide(eagleTimeout, setShowEagle, 30000); }
              } else if (strokes === par - 1) {
                const sig = `birdie:${playerName}:${holeNumber}:${compId ?? 'x'}`;
                if (checkAndMark(sig)) { setBirdiePlayer(playerName); setBirdieHole(holeNumber); setShowBirdie(true); scheduleHide(birdieTimeout, setShowBirdie, 30000); }
              } else if (strokes >= par + 3) {
                const sig = `blowup:${playerName}:${holeNumber}:${compId ?? 'x'}`;
                if (checkAndMark(sig)) { setBlowupPlayer(playerName); setBlowupHole(holeNumber); setShowBlowup(true); scheduleHide(blowupTimeout, setShowBlowup, 30000); }
              }
            } else {
              if (strokes === par - 2) {
                scheduleVerifiedPopup({ type: 'eagle', name: playerName, holeIdx: Number(holeIdx), holeNumber, strokes, compId });
              } else if (strokes === par - 1) {
                scheduleVerifiedPopup({ type: 'birdie', name: playerName, holeIdx: Number(holeIdx), holeNumber, strokes, compId });
              } else if (strokes >= par + 3) {
                scheduleVerifiedPopup({ type: 'blowup', name: playerName, holeIdx: Number(holeIdx), holeNumber, strokes, compId });
              }
            }
          }
        }

        // Mini-stat changes: waters/dog — show only when value actually changes to true
        if (msg.group && (msg.group.waters || msg.group.dog)) {
          console.log('[global-popups] group mini-stats present', { groupId: msg.groupId, comp: msg.competitionId, waters: msg.group.waters, dog: msg.group.dog });
          const waters = msg.group.waters || {};
          const dog = msg.group.dog || {};
          const groupId = msg.groupId ?? msg.group?.id ?? '';
          const compId = msg.competitionId ?? msg.competition ?? '';
          for (const name of Array.from(new Set([...Object.keys(waters), ...Object.keys(dog)]))) {
            const newWaters = !!(waters[name]);
            const newDog = !!(dog[name]);
            console.log('[global-popups] mini-stat change for', { name, newWaters, newDog, groupId, compId });
            const key = `${groupId}:${name}:c:${compId}`;
            const prev = lastMiniRef.current.get(key) || { waters: false, dog: false };
            // show waters only if it changed from false -> true
            if (newWaters && !prev.waters) {
              const sig = `waters:${name}:g:${groupId}:c:${compId}`;
              if (checkAndMark(sig)) { setWatersPlayer(name); setShowWaters(true); scheduleHide(watersTimeout, setShowWaters, 15000); }
            }
            // show dog only if it changed from false -> true
            if (newDog && !prev.dog) {
              const sig = `dog:${name}:g:${groupId}:c:${compId}`;
              if (checkAndMark(sig)) { setDogPlayer(name); setShowDog(true); scheduleHide(dogTimeout, setShowDog, 15000); }
            }
            lastMiniRef.current.set(key, { waters: newWaters, dog: newDog });
          }
        }

        // If a group object contains scores, schedule per-player popup checks similar to local scorecards
        if (msg.group && msg.group.scores) {
          try {
            const names = msg.group.players || [];
            for (const name of names) {
              const arr = msg.group.scores?.[name];
              if (!Array.isArray(arr)) continue;
                for (let i = 0; i < arr.length; i++) {
                const strokes = arr[i];
                const hole = msg.holes?.[i] || null;
                const par = hole?.par ?? null;
                const holeNumber = hole?.number ?? i + 1;
                const gross = parseInt(strokes, 10);
                if (!Number.isFinite(gross) || par == null) continue;
                if (msg._clientBroadcast) {
                  const compIdLocal = msg.competitionId ?? msg.competition ?? null;
                  if (gross === par - 2) {
                    const sig = `eagle:${name}:${holeNumber}:${compIdLocal ?? 'x'}`;
                    if (checkAndMark(sig)) { setEaglePlayer(name); setEagleHole(holeNumber); setShowEagle(true); scheduleHide(eagleTimeout, setShowEagle, 30000); }
                  } else if (gross === par - 1) {
                    const sig = `birdie:${name}:${holeNumber}:${compIdLocal ?? 'x'}`;
                    if (checkAndMark(sig)) { setBirdiePlayer(name); setBirdieHole(holeNumber); setShowBirdie(true); scheduleHide(birdieTimeout, setShowBirdie, 30000); }
                  } else if (gross >= par + 3) {
                    const sig = `blowup:${name}:${holeNumber}:${compIdLocal ?? 'x'}`;
                    if (checkAndMark(sig)) { setBlowupPlayer(name); setBlowupHole(holeNumber); setShowBlowup(true); scheduleHide(blowupTimeout, setShowBlowup, 30000); }
                  }
                } else {
                  scheduleVerifiedPopup({ type: 'eagle', name, holeIdx: i, holeNumber, strokes: gross, compId: msg.competitionId ?? msg.competition ?? null, group: msg.group });
                }
              }
            }
          } catch (e) {}
        }
      } catch (e) { }
    };

    socket.on('scores-updated', handler);
    socket.on('medal-player-updated', handler);
    socket.on('team-user-updated', handler);
    socket.on('fines-updated', handler);

    return () => {
      socket.off('scores-updated', handler);
      socket.off('medal-player-updated', handler);
      socket.off('team-user-updated', handler);
      socket.off('fines-updated', handler);
      try { if (birdieTimeout.current) clearTimeout(birdieTimeout.current); } catch (e) {}
      try {
        for (const t of verifyTimeouts.current.values()) { clearTimeout(t); }
        verifyTimeouts.current.clear();
      } catch (e) {}
    };
  }, []);

  // Simple popup markup (matches existing app styling)
  return (
    <>
      {showBirdie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-8 flex flex-col items-center border-4 border-[#FFD700] popup-jiggle">
            <span className="text-6xl mb-2" role="img" aria-label="Birdie">🕊️</span>
            <h2 className="text-3xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>Birdie!</h2>
            <div className="text-lg font-semibold text-white mb-1" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>{birdiePlayer} — Hole {birdieHole}</div>
            <button className="mt-2 px-6 py-2 rounded-2xl font-bold shadow border border-white transition text-lg" style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'} onClick={() => { setShowBirdie(false); if (birdieTimeout.current) clearTimeout(birdieTimeout.current); }}>Dismiss</button>
          </div>
        </div>
      )}
      {showEagle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-8 flex flex-col items-center border-4 border-[#FFD700] popup-jiggle">
            <span className="text-6xl mb-2" role="img" aria-label="Eagle">🦅</span>
            <h2 className="text-3xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>Eagle!</h2>
            <div className="text-lg font-semibold text-white mb-1" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>{eaglePlayer} — Hole {eagleHole}</div>
            <button className="mt-2 px-6 py-2 rounded-2xl font-bold shadow border border-white transition text-lg" style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'} onClick={() => { setShowEagle(false); if (eagleTimeout.current) clearTimeout(eagleTimeout.current); }}>Dismiss</button>
          </div>
        </div>
      )}
      {showBlowup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-8 flex flex-col items-center border-4 border-[#FFD700] popup-jiggle">
            <span className="text-6xl mb-2" role="img" aria-label="Blowup">💥</span>
            <h2 className="text-3xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>How embarrassing.</h2>
            <div className="text-lg font-semibold text-white mb-1" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>{blowupPlayer} — Hole {blowupHole}</div>
            <button className="mt-2 px-6 py-2 rounded-2xl font-bold shadow border border-white transition text-lg" style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'} onClick={() => { setShowBlowup(false); if (blowupTimeout.current) clearTimeout(blowupTimeout.current); }}>Dismiss</button>
          </div>
        </div>
      )}
      {showWaters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-8 flex flex-col items-center border-4 border-[#FFD700] popup-jiggle">
            <span className="text-6xl mb-2" role="img" aria-label="Splash">💧</span>
            <h2 className="text-3xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>Splash!</h2>
            <div className="text-lg font-semibold text-white mb-1" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>{watersPlayer} has earned a water</div>
            <button className="mt-2 px-6 py-2 rounded-2xl font-bold shadow border border-white transition text-lg" style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'} onClick={() => { setShowWaters(false); if (watersTimeout.current) clearTimeout(watersTimeout.current); }}>Dismiss</button>
          </div>
        </div>
      )}
      {showDog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-8 flex flex-col items-center border-4 border-[#FFD700] popup-jiggle">
            <span className="text-6xl mb-2" role="img" aria-label="Dog">🐶</span>
            <h2 className="text-3xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>Woof!</h2>
            <div className="text-lg font-semibold text-white mb-1" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>{dogPlayer} got the dog</div>
            <button className="mt-2 px-6 py-2 rounded-2xl font-bold shadow border border-white transition text-lg" style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'} onClick={() => { setShowDog(false); if (dogTimeout.current) clearTimeout(dogTimeout.current); }}>Dismiss</button>
          </div>
        </div>
      )}
    </>
  );
}
