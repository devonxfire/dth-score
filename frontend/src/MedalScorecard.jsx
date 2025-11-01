import React, { useEffect, useState, useRef } from 'react';
import { apiUrl } from './api';
import socket from './socket';
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
  // Helper: compute Playing Handicap (PH) from Course Handicap (CH) using competition allowance
  const computePH = (ch) => {
    const allowance = comp?.handicapallowance ?? comp?.handicapAllowance ?? 100;
    const parsedCh = parseFloat(ch) || 0;
    return Math.round(parsedCh * (parseFloat(allowance) / 100));
  };
  // ...existing code...
  // ...existing code...
  // Tee Box/Handicap modal bypass: always show scorecard, modal logic enforced
  // Modal logic removed: always render scorecard UI
  const params = useParams();
  const navigate = useNavigate();
  const compId = params.id;
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

  useEffect(() => {
    if (!mobileSelectedPlayer && players && players.length) setMobileSelectedPlayer(players[0]);
  }, [players, mobileSelectedPlayer]);

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
          const gidx = Number(msg.groupId);
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
                arr[holeIdx] = strokes == null ? '' : String(strokes);
                copy[name] = { ...pd, scores: arr };
              }
              return copy;
            } catch (e) { console.error('Error applying mappedScores to playerData', e); return prev; }
          });
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
    setSaving(prev => ({ ...prev, [name]: true }));
    setError('');
    const data = playerData[name];
    const mini = miniTableStats[name] || {};
    try {
      console.log('Saving player:', name, { teebox: data.teebox, handicap: data.handicap, scores: data.scores, waters: mini.waters, dog: mini.dog, two_clubs: mini.twoClubs });
      const res = await fetch(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teebox: data.teebox,
          handicap: data.handicap,
          scores: data.scores,
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
      console.log('Save successful for', name);
    } catch (e) {
      setError('Failed to save for ' + name + ': ' + (e.message || e));
      console.error('Save error:', e);
    } finally {
      setSaving(prev => ({ ...prev, [name]: false }));
    }
  }

  function handleChange(name, field, value) {
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

  async function handleScoreChange(name, idx, value) {
    setPlayerData(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        scores: prev[name].scores.map((v, i) => i === idx ? value : v)
      }
    }));
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
            setEagleHole(hole.number);
            setEaglePlayer(name);
            setShowEagle(true);
            if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
            if (eagleTimeoutRef.current) clearTimeout(eagleTimeoutRef.current);
            eagleTimeoutRef.current = setTimeout(() => setShowEagle(false), 30000);
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
            setBirdieHole(hole.number);
            setBirdiePlayer(name);
            setShowBirdie(true);
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            if (birdieTimeoutRef.current) clearTimeout(birdieTimeoutRef.current);
            birdieTimeoutRef.current = setTimeout(() => setShowBirdie(false), 30000);
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
            setBlowupHole(hole.number);
            setBlowupPlayer(name);
            setShowBlowup(true);
            if (navigator.vibrate) navigator.vibrate([400, 100, 400]);
            if (blowupTimeoutRef.current) clearTimeout(blowupTimeoutRef.current);
            blowupTimeoutRef.current = setTimeout(() => setShowBlowup(false), 30000);
          }
        }, 2000);
      } else {
        if (blowupShowDelayRef.current) { clearTimeout(blowupShowDelayRef.current); blowupShowDelayRef.current = null; }
      }
    }
    // Save scores for this player immediately
    if (!compId || !groups.length) return;
    const group = groups[groupIdx];
    if (!group || !Array.isArray(group.players)) return;
    try {
      const res = await fetch(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scores: playerData[name].scores.map((v, i) => i === idx ? value : v)
        })
      });
      if (!res.ok) {
        const errText = await res.text();
        setError('Failed to save for ' + name + ': ' + errText);
      }
    } catch (err) {
      setError('Failed to save for ' + name + ': ' + (err.message || err));
    }
  }

  // ...existing code...

  async function handleMiniTableChange(name, field, value) {
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
          await fetch(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(player)}`), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patchBody)
          });
        }
      } catch (err) {
        setError('Failed to save dog for group: ' + (err.message || err));
      }
      setDogPlayer(name);
      setShowDogPopup(true);
      if (watersTimeoutRef.current) clearTimeout(watersTimeoutRef.current);
      watersTimeoutRef.current = setTimeout(() => setShowDogPopup(false), 30000);
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
      await fetch(apiUrl(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody)
      });
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
      setWatersPlayer(name);
      setShowWatersPopup(true);
      if (watersTimeoutRef.current) clearTimeout(watersTimeoutRef.current);
      watersTimeoutRef.current = setTimeout(() => setShowWatersPopup(false), 30000);
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
    <PageBackground>
      <TopMenu {...props} userComp={comp} competitionList={comp ? [comp] : []} />
      <div className="flex flex-col items-center px-4 mt-12">
        <h1 className="text-4xl font-extrabold drop-shadow-lg text-center mb-4" style={{ color: '#002F5F', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>
          Medal Competition: Scorecard
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
              <div className="whitespace-normal">Tee Time: <span className="font-bold" style={{ color: '#FFD700' }}>{groups[groupIdx]?.teeTime || '-'}</span></div>
              <div className="whitespace-normal">Allowance: <span className="font-bold" style={{ color: '#FFD700' }}>{comp?.handicapallowance ? comp.handicapallowance + '%' : '-'}</span></div>
            </div>
          </div>
          {/* Desktop/tablet: single-line row with four items (hidden on xs, visible on sm+) */}
          <div className="hidden sm:flex w-full text-sm font-normal justify-between">
            <div className="flex-1 min-w-[140px]">Date: <span className="font-bold" style={{ color: '#FFD700' }}>{comp?.date ? (new Date(comp.date).toLocaleDateString()) : '-'}</span></div>
            <div className="flex-1 min-w-[140px]">Club: <span className="font-bold" style={{ color: '#FFD700' }}>{comp?.club || '-'}</span></div>
            <div className="flex-1 min-w-[140px]">Tee Time: <span className="font-bold" style={{ color: '#FFD700' }}>{groups[groupIdx]?.teeTime || '-'}</span></div>
            <div className="flex-1 min-w-[180px]">Allowance: <span className="font-bold" style={{ color: '#FFD700' }}>{comp?.handicapallowance ? comp.handicapallowance + '%' : '-'}</span></div>
          </div>
        </div>
        <div className="max-w-4xl w-full bg-[#002F5F] rounded-2xl shadow-2xl p-8 border-4 border-[#FFD700] text-white" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>
          {/* Group buttons removed above mini table */}
          {/* Mini Table for Waters, Dog, 2 Clubs, etc. */}
          <div className="flex flex-col items-start mb-6" style={{ gap: '1rem' }}>
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
                      <input type="number" min="0" className="w-12 text-center text-white bg-transparent rounded focus:outline-none font-semibold no-spinner" style={{ border: 'none', MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none' }} value={miniTableStats[name]?.waters || ''} onChange={e => handleMiniTableChange(name, 'waters', e.target.value)} />
                    </td>
                    <td className="hidden sm:table-cell border px-2 py-1 text-center">
                      <input type="checkbox" checked={!!miniTableStats[name]?.dog} onChange={e => handleMiniTableChange(name, 'dog', e.target.checked)} />
                    </td>
                    <td className="hidden sm:table-cell border px-2 py-1 text-center">
                      <input type="number" min="0" className="w-12 text-center text-white bg-transparent rounded focus:outline-none font-semibold no-spinner" style={{ border: 'none', MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none' }} value={miniTableStats[name]?.twoClubs || ''} onChange={e => handleMiniTableChange(name, 'twoClubs', e.target.value)} />
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
                          <input type="number" min="0" className="w-12 text-center text-white bg-transparent rounded focus:outline-none font-semibold no-spinner" style={{ border: 'none' }} value={miniTableStats[name]?.waters || ''} onChange={e => handleMiniTableChange(name, 'waters', e.target.value)} />
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
          {/* Mobile-only per-hole entry (select a player, then show their holes) */}
          <div className="sm:hidden w-full mt-4">
            <div className="mb-3">
              <label className="sr-only">Select player</label>
              <select
                aria-label="Select player"
                className={`w-full p-2 rounded ${players.indexOf(mobileSelectedPlayer) >= 0 ? playerColors[players.indexOf(mobileSelectedPlayer) % playerColors.length] : 'bg-white/10 text-white'}`}
                value={mobileSelectedPlayer}
                onChange={e => setMobileSelectedPlayer(e.target.value)}
              >
                {players.map((name, idx) => (
                  <option key={name} value={name}>{`PLAYER ${String.fromCharCode(65 + idx)}: ${name}`}</option>
                ))}
              </select>
              <div className="text-xs text-white/70 mt-1">(Click to select different player)</div>
            </div>
            {mobileSelectedPlayer && (() => {
              const name = mobileSelectedPlayer;
              const pIdx = players.indexOf(name);
              return (
                <div key={`mobile-${name}`} className="mb-4 p-3 rounded border text-white" style={{ background: '#002F5F', borderColor: '#FFD700' }}>
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
                          <button
                            aria-label={`decrement-hole-${hole.number}-${name}`}
                            className="px-2 py-1 rounded bg-white/10"
                            onClick={() => {
                              const cur = parseInt(playerData[name]?.scores?.[hIdx] || '0', 10) || 0;
                              const next = Math.max(0, cur - 1);
                              handleScoreChange(name, hIdx, String(next));
                            }}
                          >−</button>
                          <input
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="w-14 text-center bg-transparent text-lg font-bold focus:outline-none"
                            value={playerData[name]?.scores?.[hIdx] ?? ''}
                            onChange={e => {
                              const v = (e.target.value || '').replace(/[^0-9]/g, '');
                              handleScoreChange(name, hIdx, v);
                            }}
                            onFocus={e => e.currentTarget.scrollIntoView({ block: 'center' })}
                          />
                          <button
                            aria-label={`increment-hole-${hole.number}-${name}`}
                            className="px-2 py-1 rounded bg-white/10"
                            onClick={() => {
                              const cur = parseInt(playerData[name]?.scores?.[hIdx] || '0', 10) || 0;
                              const next = cur + 1;
                              handleScoreChange(name, hIdx, String(next));
                            }}
                          >+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {(function() {
                    // Sum only holes where a gross score has been entered (non-empty)
                    const outTotal = defaultHoles.slice(0,9).reduce((s, hole, i) => {
                      const raw = playerData[name]?.scores?.[i];
                      const val = raw === '' || raw == null ? NaN : parseInt(raw, 10);
                      return s + (Number.isFinite(val) ? val : 0);
                    }, 0);
                    const inTotal = defaultHoles.slice(9,18).reduce((s, hole, i) => {
                      const raw = playerData[name]?.scores?.[i + 9];
                      const val = raw === '' || raw == null ? NaN : parseInt(raw, 10);
                      return s + (Number.isFinite(val) ? val : 0);
                    }, 0);
                    const grossTotal = outTotal + inTotal;

                    // Net: only include holes with entered gross values
                    const playingHandicap = computePH(playerData[name]?.handicap) || 0;
                    let netTotal = 0;
                    let holesWithScore = 0;
                    defaultHoles.forEach((hole, idx) => {
                      const raw = playerData[name]?.scores?.[idx];
                      const gross = raw === '' || raw == null ? NaN : parseInt(raw, 10);
                      if (!Number.isFinite(gross)) return;
                      holesWithScore++;
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
                      if (typeof net === 'number') netTotal += net;
                    });

                    // Score to par: sum of (gross - par) for played holes only
                    let scoreToPar = 0;
                    let anyScore = false;
                    defaultHoles.forEach((hole, idx) => {
                      const raw = playerData[name]?.scores?.[idx];
                      const gross = raw === '' || raw == null ? NaN : parseInt(raw, 10);
                      if (!Number.isFinite(gross)) return;
                      anyScore = true;
                      scoreToPar += (gross - hole.par);
                    });
                    let scoreToParLabel = '';
                    if (!anyScore || scoreToPar === 0) {
                      scoreToParLabel = 'E';
                    } else {
                      scoreToParLabel = `${scoreToPar >= 0 ? '+' + scoreToPar : String(scoreToPar)}`;
                    }

                    return (
                      <div className="mt-3 text-sm font-bold">
                        <div className="flex justify-between">
                          <div>Out: {outTotal}</div>
                          <div>In: {inTotal}</div>
                        </div>
                        <div className="flex justify-between mt-1">
                          <div>Total: {grossTotal}</div>
                          <div>Net: {holesWithScore ? netTotal : ''}</div>
                        </div>

                        <div className="flex justify-center mt-4">
                          <div className="text-center px-6 py-3 rounded-2xl border-4 font-extrabold text-2xl" style={{ borderColor: '#FFD700', background: '#1B3A6B', color: 'white' }}>
                            Score: <span className="ml-2">{scoreToParLabel}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
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
                {players.map((name, pIdx) => (
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
                              onChange={e => handleScoreChange(name, hIdx, e.target.value)}
                              className="w-10 h-10 text-center focus:outline-none block mx-auto font-bold text-base no-spinner px-0 text-white"
                              inputMode="numeric"
                              style={{ MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}
                            />
                          </div>
                        </td>
                      ))}
                      <td className="border px-2 py-1 font-bold text-base">{Array.isArray(playerData[name]?.scores) ? playerData[name].scores.slice(0,9).reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0) : ''}</td>
                    </tr>
                    {/* Net row (no player label cell) */}
                    <tr key={name + '-net-front'}>
                      <td className="border px-2 py-1 bg-white/10 text-base font-bold text-center align-middle" style={{ minWidth: 40, verticalAlign: 'middle', height: '44px' }}>Net</td>
                      {defaultHoles.slice(0,9).map((hole, hIdx) => {
                        // Medal net calculation: gross - strokes received
                        // Use playing handicap (PH) for strokes allocation
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
                        const gross = parseInt(playerData[name]?.scores?.[hIdx], 10) || 0;
                        const net = gross ? gross - strokesReceived : '';
                        return (
                          <td key={hIdx} className="border px-1 py-1 bg-white/5 align-middle font-bold text-base" style={{ verticalAlign: 'middle', height: '44px' }}>
                            {gross ? net : ''}
                          </td>
                        );
                      })}
                      {/* Net front 9 total */}
                      <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>
                        {(() => {
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
                ))}
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
                {players.map((name, pIdx) => (
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
                              onChange={e => handleScoreChange(name, hIdx+9, e.target.value)}
                              className="w-10 h-10 text-center focus:outline-none block mx-auto font-bold text-base no-spinner px-0 text-white"
                              inputMode="numeric"
                              style={{ MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}
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
                      <td className="border px-2 py-1 bg-white/10 text-base font-bold text-center align-middle" style={{ minWidth: 40, verticalAlign: 'middle', height: '44px' }}>Net</td>
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
                        const gross = parseInt(playerData[name]?.scores?.[hIdx+9], 10) || 0;
                        const net = gross ? gross - strokesReceived : '';
                        return (
                          <td key={hIdx} className="border px-1 py-1 bg-white/5 align-middle font-bold text-base" style={{ verticalAlign: 'middle', height: '44px' }}>
                            {gross ? net : ''}
                          </td>
                        );
                      })}
                      {/* Net back 9 and total */}
                      <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>
                        {(() => {
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
                ))}
              </tbody>
            </table>
          </div>
          {error && <div className="text-red-300 mt-4 font-semibold">{error}</div>}
        </div>
      </div>
      {/* Birdie Popup */}
      {showBirdie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-8 flex flex-col items-center border-4 border-[#FFD700] popup-jiggle">
            <span className="text-6xl mb-2" role="img" aria-label="Birdie">🕊️</span>
            <h2 className="text-3xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>Birdie!</h2>
            <div className="text-lg font-semibold text-white mb-1" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>For {birdiePlayer} on Hole {birdieHole}</div>
            <button className="mt-2 px-6 py-2 rounded-2xl font-bold shadow border border-white transition text-lg" style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'} onClick={() => { setShowBirdie(false); if (birdieTimeoutRef.current) clearTimeout(birdieTimeoutRef.current); }}>Dismiss</button>
          </div>
        </div>
      )}
      {/* Eagle Popup */}
      {showEagle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-8 flex flex-col items-center border-4 border-[#FFD700] popup-jiggle">
            <span className="text-6xl mb-2" role="img" aria-label="Eagle">🦅</span>
            <h2 className="text-3xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>Eagle!</h2>
            <div className="text-lg font-semibold text-white mb-1" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>For {eaglePlayer} on Hole {eagleHole}</div>
            <button className="mt-2 px-6 py-2 rounded-2xl font-bold shadow border border-white transition text-lg" style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'} onClick={() => { setShowEagle(false); if (eagleTimeoutRef.current) clearTimeout(eagleTimeoutRef.current); }}>Dismiss</button>
          </div>
        </div>
      )}
      {/* Blowup Popup */}
      {showBlowup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-8 flex flex-col items-center border-4 border-[#FFD700] popup-jiggle">
            <span className="text-6xl mb-2" role="img" aria-label="Explosion">💥</span>
            <h2 className="text-3xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>How embarrassing.</h2>
            <div className="text-lg font-semibold text-white mb-1" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>{blowupPlayer} just blew up on Hole {blowupHole}.</div>
            <button className="mt-2 px-6 py-2 rounded-2xl font-bold shadow border border-white transition text-lg" style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'} onClick={() => { setShowBlowup(false); if (blowupTimeoutRef.current) clearTimeout(blowupTimeoutRef.current); }}>Dismiss</button>
          </div>
        </div>
      )}
      {/* Waters Popup */}
      {showWatersPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-8 flex flex-col items-center border-4 border-[#FFD700] popup-jiggle">
            <span className="text-6xl mb-2" role="img" aria-label="Splash">💧</span>
            <h2 className="text-3xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>Splash!</h2>
            <div className="text-lg font-semibold text-white mb-1" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>{watersPlayer} has just earned a water</div>
            <button className="mt-2 px-6 py-2 rounded-2xl font-bold shadow border border-white transition text-lg" style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'} onClick={() => { setShowWatersPopup(false); if (watersTimeoutRef.current) clearTimeout(watersTimeoutRef.current); }}>Dismiss</button>
          </div>
        </div>
      )}
      {/* Dog Popup */}
      {showDogPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-8 flex flex-col items-center border-4 border-[#FFD700] popup-jiggle">
            <span className="text-6xl mb-2" role="img" aria-label="Dog">🐶</span>
            <h2 className="text-3xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>Woof!</h2>
            <div className="text-lg font-semibold text-white mb-1" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>{dogPlayer} has just gotten the dog</div>
            <button className="mt-2 px-6 py-2 rounded-2xl font-bold shadow border border-white transition text-lg" style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'} onClick={() => { setShowDogPopup(false); if (watersTimeoutRef.current) clearTimeout(watersTimeoutRef.current); }}>Dismiss</button>
          </div>
        </div>
      )}
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