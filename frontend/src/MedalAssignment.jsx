import React, { useEffect, useState } from 'react';
import { apiUrl } from './api';
import PageBackground from './PageBackground';
import { useNavigate, useParams } from 'react-router-dom';

export default function MedalAssignment(props) {
  const params = useParams();
  const navigate = useNavigate();
  // Fallback logic for compId
  const compId = props.compId || params.id || props.competition?.id;
  const [comp, setComp] = useState(null);
  // Default to one 4 ball group loaded
  const [groups, setGroups] = useState(() => {
    // If initialGroups provided (editing), use those
    if (props.initialGroups && props.initialGroups.length > 0) {
      return props.initialGroups;
    }
    // Otherwise, start with one empty group
    return [{ players: [], teeTime: '', displayNames: ['', '', '', ''] }];
  });
  const [availablePlayers, setAvailablePlayers] = useState([]); // Will be fetched
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Track guest display names for each group/player slot
  const [guestNames, setGuestNames] = useState(() => {
    if (props.initialGroups && props.initialGroups.length > 0) {
      return props.initialGroups.map(g =>
        Array.isArray(g.displayNames)
          ? g.displayNames.slice(0, 4).concat(Array(4).fill('')).slice(0, 4)
          : Array(4).fill('')
      );
    }
    return [Array(4).fill('')];
  });

  // Fetch comp info on mount
  useEffect(() => {
    if (!compId) return;
    fetch(apiUrl(`/api/competitions/${compId}`))
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setComp(data);
          // If backend returns no groups, always load one default 4 ball
          if (Array.isArray(data.groups) && data.groups.length > 0) {
            setGroups(data.groups);
          } else {
            setGroups([{ players: [], teeTime: '', displayNames: ['', '', '', ''] }]);
          }
        }
      });
  }, [compId]);

  // Fetch real player list from backend
  useEffect(() => {
    fetch(apiUrl('/api/users'))
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          setAvailablePlayers(data.map(u => u.name));
        }
      });
  }, []);

  // Helper: add a new group
  function addGroup() {
    setGroups(prev => [...prev, { players: [], teeTime: '', displayNames: ['', '', '', ''] }]);
    setGuestNames(prev => [...prev, Array(4).fill('')]);
  }

  // Helper: update a group
  function updateGroup(idx, field, value) {
    setGroups(prev => prev.map((g, i) => i === idx ? { ...g, [field]: value } : g));
  }

  // Helper: assign player to group
  function assignPlayer(groupIdx, playerIdx, playerName) {
    // If switching away from GUEST, clear guest name
    const currentPlayer = groups[groupIdx]?.players[playerIdx];
    if (currentPlayer && currentPlayer.startsWith('Guest') && !playerName.startsWith('Guest')) {
      setGuestNames(prev => {
        const updated = prev.map(arr => arr.slice());
        if (updated[groupIdx]) updated[groupIdx][playerIdx] = '';
        return updated;
      });
    }
    // If selecting GUEST, assign Guest 1/2/3 based on first available
    let assignedValue = playerName;
    if (['GUEST', 'GUEST - Burt Reds'].includes(playerName)) {
      const allAssigned = groups.flatMap(g => g.players);
      const guestOptions = ['Guest 1', 'Guest 2', 'Guest 3'];
      assignedValue = guestOptions.find(g => !allAssigned.includes(g)) || 'Guest 1';
    }
    setGroups(prev => prev.map((g, i) => {
      if (i !== groupIdx) return g;
      const newPlayers = [...(g.players || [])];
      while (newPlayers.length < 4) newPlayers.push('');
      newPlayers[playerIdx] = assignedValue;
      return { ...g, players: newPlayers };
    }));
  }
  
  function handleGuestNameChange(groupIdx, playerIdx, value) {
    setGuestNames(prev => {
      const updated = prev.map(arr => arr.slice());
      if (!updated[groupIdx]) updated[groupIdx] = Array(4).fill('');
      updated[groupIdx][playerIdx] = value;
      return updated;
    });
  }

  // Helper: set tee time
  function setTeeTime(groupIdx, teeTime) {
    setGroups(prev => prev.map((g, i) => i === groupIdx ? { ...g, teeTime } : g));
  }

  // Helper: remove group
  function removeGroup(idx) {
    setGroups(prev => prev.filter((_, i) => i !== idx));
    setGuestNames(prev => prev.filter((_, i) => i !== idx));
  }

  // Helper: random tee time between 07:00 and 16:50 in 10-minute steps
  function getRandomTeeTime() {
    const hour = Math.floor(Math.random() * (16 - 7 + 1)) + 7; // 7..16
    const mins = [0,10,20,30,40,50][Math.floor(Math.random() * 6)];
    const hh = String(hour).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  async function randomizeGroup(idx) {
    try {
      const res = await fetch(apiUrl('/api/users'));
      if (!res.ok) throw new Error('failed');
      const users = await res.json();
      const allNames = users.map(u => u.name || u.username || u.id).filter(Boolean).filter(n => !/^guest/i.test(n));
      const otherAssigned = groups.flatMap((g, i) => i === idx ? [] : (Array.isArray(g.players) ? g.players : [])).filter(Boolean);
      let candidates = allNames.filter(n => !otherAssigned.includes(n));
      if (candidates.length < 4) candidates = allNames.slice();
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      const chosen = candidates.slice(0, Math.min(4, candidates.length));
      while (chosen.length < 4) chosen.push('');
      const newGroups = groups.map((g, i) => i === idx ? { ...g, players: chosen, teeTime: getRandomTeeTime() } : g);
      setGroups(newGroups);
      setGuestNames(prev => prev.map((arr, i) => i === idx ? Array(4).fill('') : arr));
      const selected = newGroups.flatMap(g => g.players).filter(Boolean);
      setAvailablePlayers(allNames.filter(n => !selected.includes(n)));
    } catch (e) {
      // fallback: use availablePlayers
      try {
        const pool = Array.from(new Set([...availablePlayers, ...groups[idx].players.filter(Boolean)]));
        if (pool.length === 0) return;
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const chosen = pool.slice(0, 4);
        const newGroups = groups.map((g, i) => i === idx ? { ...g, players: chosen, teeTime: getRandomTeeTime() } : g);
        setGroups(newGroups);
        setGuestNames(prev => prev.map((arr, i) => i === idx ? Array(4).fill('') : arr));
        const selected = newGroups.flatMap(g => g.players).filter(Boolean);
        setAvailablePlayers(prev => prev.filter(n => !selected.includes(n)));
      } catch (err) {}
    }
  }

  // Save groups to backend
  async function handleSave() {
    setError('');
    setSaving(true);
    // Validate: all groups must have 4 players and a tee time
    for (const g of groups) {
      if (!Array.isArray(g.players) || g.players.length !== 4 || g.players.some(p => !p)) {
        setError('Each group must have 4 players assigned.');
        setSaving(false);
        return;
      }
      if (!g.teeTime) {
        setError('Each group must have a tee time.');
        setSaving(false);
        return;
      }
    }
    const compIdInt = Number(compId);
    if (!compIdInt || isNaN(compIdInt)) {
      setError('Competition ID is missing or invalid.');
      setSaving(false);
      return;
    }
    try {
      const res = await fetch(apiUrl(`/api/competitions/${compIdInt}/groups`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups: groupsWithDisplay })
      });
      if (!res.ok) {
        const errText = await res.text();
        setError('Failed to save groups: ' + errText);
        setSaving(false);
        return;
      }
      navigate(`/scorecard-medal/${compIdInt}`);
    } catch (e) {
      setError('Failed to save groups: ' + (e.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  }

  // Get list of unassigned players
  function getUnassignedPlayers() {
    const assigned = groups.flatMap(g => g.players);
    return availablePlayers.filter(p => !assigned.includes(p));
  }

  return (
  <PageBackground hideFooter>
  <div className="max-w-4xl w-full min-h-screen flex flex-col justify-start bg-[#002F5F] p-8 text-white" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>
          <h1 className="text-4xl font-extrabold drop-shadow-lg text-center mb-4" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>
            Medal Competition: 4 Ball Assignment
          </h1>
          <div className="mx-auto mt-2 mb-4" style={{height: '2px', maxWidth: 340, width: '100%', background: 'white', opacity: 0.7, borderRadius: 2}}></div>
         
          {error && <div className="text-red-300 mb-2 font-semibold">{error}</div>}
          {groups.map((group, idx) => (
            <div key={idx} className="mb-6 border-b border-white/30 pb-4">
              <div className="mb-2 font-extrabold" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', fontSize: '1.2rem' }}>4 Ball {idx + 1}</div>
              <div className="mb-2">
                <label className="block mb-1 font-bold" htmlFor={`teeTime-${idx}`} style={{ color: '#FFD700', fontFamily: 'Lato, Arial, sans-serif' }}>Tee Time</label>
                <div className="relative flex items-center">
                  <input
                    id={`teeTime-${idx}`}
                    type="time"
                    value={group.teeTime}
                    onChange={e => setTeeTime(idx, e.target.value)}
                    className="border border-white bg-transparent rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white"
                    style={{ fontFamily: 'Lato, Arial, sans-serif', color: '#FFD700' }}
                    required
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 mt-2">
                {Array.from({ length: 4 }).map((_, pIdx) => {
                  const player = group.players[pIdx] || '';
                  return (
                    <div key={pIdx} className="flex flex-col gap-1">
                      <select
                        className="border border-white bg-transparent text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white"
                        style={{ fontFamily: 'Lato, Arial, sans-serif', color: '#FFD700', fontWeight: 700 }}
                        value={player}
                        onChange={e => assignPlayer(idx, pIdx, e.target.value)}
                        required
                      >
                        <option value="" style={{ color: '#1B3A6B', fontWeight: 700 }}>Select player</option>
                        <option value="GUEST" style={{ color: '#1B3A6B', fontWeight: 700 }}>Guest</option>
                        {getUnassignedPlayers().concat(player ? [player] : []).filter((v, i, arr) => arr.indexOf(v) === i).map(p => (
                          <option key={p} value={p} style={{ color: '#1B3A6B', fontWeight: 700 }}>{p}</option>
                        ))}
                      </select>
                      {player && player.startsWith('Guest') && (
                        <input
                          type="text"
                          placeholder="Enter guest name"
                          value={guestNames[idx]?.[pIdx] || ''}
                          onChange={e => handleGuestNameChange(idx, pIdx, e.target.value)}
                          className="border border-white bg-transparent text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white"
                          style={{ fontFamily: 'Lato, Arial, sans-serif', color: '#FFD700', fontWeight: 400, fontSize: '0.9rem' }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                className="mt-2 px-4 py-2 rounded bg-red-700 text-white font-bold"
                onClick={() => removeGroup(idx)}
                disabled={groups.length <= 1}
              >Remove Group</button>
              <button
                className="mt-2 ml-2 px-4 py-2 rounded bg-blue-600 text-white font-bold"
                onClick={() => randomizeGroup(idx)}
              >Randomise</button>
            </div>
          ))}
          <button
            className="w-full py-3 px-4 mt-2 rounded-2xl font-bold shadow border border-white transition text-lg"
            style={{ backgroundColor: '#FFD700', color: '#002F5F', fontFamily: 'Lato, Arial, sans-serif', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
            onClick={addGroup}
          >{groups.length === 0 ? 'Add A Tee Time' : 'Add Another Tee Time'}</button>
          <button
            className="w-full py-3 px-4 mt-4 rounded-2xl font-bold shadow border border-white transition text-lg"
            style={{ backgroundColor: '#1B3A6B', color: 'white', fontFamily: 'Lato, Arial, sans-serif', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
            onClick={handleSave}
            disabled={saving}
          >{saving ? 'Saving...' : 'Save & Continue'}</button>
        </div>
      
    </PageBackground>
  );
}