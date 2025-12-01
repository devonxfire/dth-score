
import { useState, useEffect } from 'react';
import { apiUrl } from './api';
import PageBackground from './PageBackground';
import { useNavigate, useParams } from 'react-router-dom';

export default function FourballAssignment({ fourballs, onAssign, initialGroups }) {
  // fourballs: number of 4balls
  // onAssign: callback with array of { players: [], teeTime: '' }
  const navigate = useNavigate();
  const params = useParams();
  const [groups, setGroups] = useState(() => {
    if (initialGroups && Array.isArray(initialGroups) && initialGroups.length > 0) {
      // Pad or trim to match fourballs count
      const filled = initialGroups.slice(0, fourballs).map(g => ({
        players: Array.isArray(g.players) ? g.players.slice(0, 4).concat(Array(4).fill('')).slice(0, 4) : Array(4).fill(''),
        teeTime: g.teeTime || ''
      }));
      while (filled.length < fourballs) {
        filled.push({ players: Array(4).fill(''), teeTime: '' });
      }
      return filled;
    }
    return Array.from({ length: fourballs }, () => ({ players: Array(4).fill(''), teeTime: '' }));
  });
  const [available, setAvailable] = useState([]);
  useEffect(() => {
    async function fetchUsers() {
      try {
  const res = await fetch(apiUrl('/api/users'));
        if (!res.ok) throw new Error('Failed to fetch users');
        const users = await res.json();
        // Use username or name field, fallback to id if needed
        const names = users.map(u => u.name || u.username || u.id);
  setAvailable([...names]); // Remove 'GUEST' from available list
      } catch (err) {
  setAvailable([]); // fallback to empty if error
      }
    }
    fetchUsers();
  }, []);
  // Track guest display names for each group/player slot
  const [guestNames, setGuestNames] = useState(() => {
    if (initialGroups && Array.isArray(initialGroups) && initialGroups.length > 0) {
      // Extract guest display names from initialGroups if present
      return initialGroups.slice(0, fourballs).map(g =>
        Array.isArray(g.displayNames)
          ? g.displayNames.slice(0, 4).concat(Array(4).fill('')).slice(0, 4)
          : Array(4).fill('')
      ).concat(Array(Math.max(0, fourballs - initialGroups.length)).fill(Array(4).fill('')));
    }
    return Array.from({ length: fourballs }, () => Array(4).fill(''));
  });

  function handlePlayerChange(groupIdx, playerIdx, value) {
    // If switching away from GUEST, clear guest name
    if (groups[groupIdx].players[playerIdx] && groups[groupIdx].players[playerIdx].startsWith('Guest') && !value.startsWith('Guest')) {
      setGuestNames(prev => {
        const updated = prev.map(arr => arr.slice());
        updated[groupIdx][playerIdx] = '';
        return updated;
      });
    }
    // If selecting a guest, assign Guest 1/2/3 based on first available
    let assignedValue = value;
  if (['GUEST', 'GUEST - Burt Reds'].includes(value)) {
      // Find which GuestX is not already used in this comp
      const allAssigned = groups.flatMap(g => g.players);
  const guestOptions = ['Guest 1', 'Guest 2', 'Guest 3']; // Only allow Guest 1/2/3
      assignedValue = guestOptions.find(g => !allAssigned.includes(g)) || 'Guest 1';
    }
    const newGroups = groups.map((g, i) =>
      i === groupIdx
        ? {
            ...g,
            players: g.players.map((p, j) => (j === playerIdx ? assignedValue : p)),
          }
        : g
    );
    setGroups(newGroups);
    // Remove from available if selected, add back if deselected
    const selected = newGroups.flatMap(g => g.players).filter(Boolean);
    setAvailable(prevAvailable => prevAvailable.filter(name => !selected.includes(name)));
  }

  function handleGuestNameChange(groupIdx, playerIdx, value) {
    setGuestNames(prev => {
      const updated = prev.map(arr => arr.slice());
      updated[groupIdx][playerIdx] = value;
      return updated;
    });
    // Do NOT update the player name, just store display name
  }



  function handleTeeTimeChange(groupIdx, value) {
    const newGroups = groups.map((g, i) =>
      i === groupIdx ? { ...g, teeTime: value } : g
    );
    setGroups(newGroups);
  }

  function addGroup() {
    setGroups(prev => [...prev, { players: Array(4).fill(''), teeTime: '' }]);
    setGuestNames(prev => [...prev, Array(4).fill('')]);
  }

  // Helper: random tee time between 07:00 and 16:50 in 10-minute steps
  function getRandomTeeTime() {
    const hour = Math.floor(Math.random() * (16 - 7 + 1)) + 7; // 7..16
    const mins = [0,10,20,30,40,50][Math.floor(Math.random() * 6)];
    const hh = String(hour).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  // Randomise a group: pick 4 random players (avoid players already assigned to other groups when possible)
  async function randomizeGroup(groupIdx) {
    try {
      const res = await fetch(apiUrl('/api/users'));
      if (!res.ok) throw new Error('failed');
      const users = await res.json();
      const allNames = users
        .filter(u => !u.isadmin)
        .map(u => u.name || u.username || u.id)
        .filter(Boolean)
        .filter(n => !/^guest/i.test(n));
      // gather names currently assigned to other groups (exclude this group's current players)
      const otherAssigned = groups.flatMap((g, i) => i === groupIdx ? [] : (Array.isArray(g.players) ? g.players : [])).filter(Boolean);
      // candidates exclude otherAssigned so we don't pick already-assigned players when possible
      let candidates = allNames.filter(n => !otherAssigned.includes(n));
      // If insufficient unique candidates, fall back to allNames
      if (candidates.length < 4) candidates = allNames.slice();
      // Shuffle candidates
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      const chosen = candidates.slice(0, Math.min(4, candidates.length));
      // If still less than 4 (very small user list), fill with empty strings
      while (chosen.length < 4) chosen.push('');
      const newGroups = groups.map((g, i) => i === groupIdx ? { ...g, players: chosen, teeTime: getRandomTeeTime() } : g);
      setGroups(newGroups);
      setGuestNames(prev => prev.map((arr, i) => i === groupIdx ? Array(4).fill('') : arr));
      // Recompute available: allNames minus selected in newGroups
      const selected = newGroups.flatMap(g => g.players).filter(Boolean);
      setAvailable(allNames.filter(n => !selected.includes(n)));
    } catch (e) {
      // fallback: if fetch failed, try to use current available pool
      try {
        const pool = Array.from(new Set([...available, ...groups[groupIdx].players.filter(Boolean)]));
        if (pool.length === 0) return;
        // shuffle
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const chosen = pool.slice(0, 4);
        const newGroups = groups.map((g, i) => i === groupIdx ? { ...g, players: chosen, teeTime: getRandomTeeTime() } : g);
        setGroups(newGroups);
        setGuestNames(prev => prev.map((arr, i) => i === groupIdx ? Array(4).fill('') : arr));
        const selected = newGroups.flatMap(g => g.players).filter(Boolean);
        setAvailable(prev => prev.filter(n => !selected.includes(n)));
      } catch (err) {}
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    // Attach displayNames to each group for frontend use
    const groupsWithDisplay = groups.map((g, i) => ({ ...g, displayNames: guestNames[i] }));
    // Split each 4-ball group into two 2-man teams for 4BBB
    function splitFourballsToTeams(groups) {
      const teams = [];
      groups.forEach((group, idx) => {
        if (Array.isArray(group.players) && group.players.length === 4) {
          // Team 1: players 0 and 1
          teams.push({
            players: [group.players[0], group.players[1]],
            teeTime: group.teeTime,
            groupIndex: idx,
            displayNames: [guestNames[idx][0], guestNames[idx][1]]
          });
          // Team 2: players 2 and 3
          teams.push({
            players: [group.players[2], group.players[3]],
            teeTime: group.teeTime,
            groupIndex: idx,
            displayNames: [guestNames[idx][2], guestNames[idx][3]]
          });
        }
      });
      return teams;
    }
    // Pass the full 4-player groups back to the caller so the competition keeps 4-ball units.
    onAssign(groupsWithDisplay);
  }
  return (
    <PageBackground hideFooter>
      <div className="max-w-4xl w-full min-h-screen flex flex-col justify-start bg-[#002F5F] p-8 text-white" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>
        <h1 className="text-4xl font-extrabold drop-shadow-lg text-center mb-4" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>
          4 Ball Assignment
        </h1>
        <div className="mx-auto mt-2 mb-4" style={{height: '2px', maxWidth: 340, width: '100%', background: 'white', opacity: 0.7, borderRadius: 2}}></div>

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
                  onChange={e => handleTeeTimeChange(idx, e.target.value)}
                  className="border border-white bg-transparent rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white"
                  style={{ fontFamily: 'Lato, Arial, sans-serif', color: '#FFD700' }}
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              {group.players.map((player, pIdx) => (
                <div key={pIdx} className="flex flex-col gap-1">
                  <select
                    className="border border-white bg-transparent text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white"
                    style={{ fontFamily: 'Lato, Arial, sans-serif', color: '#FFD700', fontWeight: 700 }}
                    value={player}
                    onChange={e => handlePlayerChange(idx, pIdx, e.target.value)}
                    required
                  >
                    <option value="" style={{ color: '#1B3A6B', fontWeight: 700 }}>Select player</option>
                    <option value="GUEST" style={{ color: '#1B3A6B', fontWeight: 700 }}>Guest</option>
                    {[...available.filter(name => !groups.flatMap(g => g.players).includes(name) || name === player), ...(player && !available.includes(player) ? [player] : [])]
                      .filter((name, i, arr) => name && arr.indexOf(name) === i)
                      .map((name, optIdx) => (
                        <option key={`${name}-${idx}-${pIdx}-${optIdx}`} value={name} style={{ color: '#1B3A6B', fontWeight: 700 }}>{name}</option>
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
              ))}
            </div>
            <button
              className="mt-2 px-4 py-2 rounded bg-red-700 text-white font-bold"
              onClick={() => {
                // remove group
                const newGroups = groups.filter((_, i) => i !== idx);
                setGroups(newGroups);
                setGuestNames(prev => prev.filter((_, i) => i !== idx));
              }}
              disabled={groups.length <= 1}
            >Remove Group</button>
            <button
              className="mt-2 ml-2 px-4 py-2 rounded bg-blue-600 text-white font-bold"
              onClick={() => { randomizeGroup(idx); }}
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
          onClick={handleSubmit}
        >Save & Continue</button>
      </div>
    </PageBackground>
  );
}
