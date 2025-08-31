
import { useState, useEffect } from 'react';

export default function FourballAssignment({ fourballs, onAssign, initialGroups }) {
  // fourballs: number of 4balls
  // onAssign: callback with array of { players: [], teeTime: '' }
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
        const res = await fetch('http://localhost:5050/api/users');
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

  function handleSubmit(e) {
    e.preventDefault();
    // Attach displayNames to each group for frontend use
    const groupsWithDisplay = groups.map((g, i) => ({ ...g, displayNames: guestNames[i] }));
    onAssign(groupsWithDisplay);
  }

  return (
    <>
      <div className="flex flex-col items-center mb-10 w-full">
        <h3
          className="text-4xl font-extrabold drop-shadow-lg text-center mb-1 leading-tight flex items-end justify-center gap-2"
          style={{ color: '#1B3A6B', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}
        >
          Assign Players to 4 Balls & Tee Times
        </h3>
        <div className="mx-auto mt-2 mb-4" style={{height: '2px', maxWidth: 340, width: '100%', background: 'white', opacity: 0.7, borderRadius: 2}}></div>
      </div>
      <div className="flex flex-col items-center bg-transparent">
        <form onSubmit={handleSubmit} className="w-full max-w-4xl rounded-2xl text-white mx-auto" style={{ background: 'rgba(0,47,95,0.95)' }}>
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
              {group.players.map((player, pIdx) => (
                <div key={pIdx} className="mb-2 flex items-center">
                  <select
                    value={['Guest 1','Guest 2','Guest 3'].includes(player) ? '' : player}
                    onChange={e => handlePlayerChange(idx, pIdx, e.target.value)}
                    className="border border-white bg-transparent text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white"
                    style={{ fontFamily: 'Lato, Arial, sans-serif', color: '#FFD700', fontWeight: 700 }}
                    required
                  >
                    <option value="" style={{ color: '#1B3A6B', fontWeight: 700 }}>Select player</option>
                    {/* Show all available players not already assigned elsewhere, plus the current selection */}
                    {[
                      ...available.filter(name => !groups.flatMap(g => g.players).includes(name) || name === player),
                      ...(player && !available.includes(player) && !['Guest 1','Guest 2','Guest 3'].includes(player) ? [player] : [])
                    ]
                      .filter((name, i, arr) => name && arr.indexOf(name) === i)
                      .map((name, optIdx) => (
                        <option key={`${name}-${idx}-${pIdx}-${optIdx}`} value={name} style={{ color: '#1B3A6B', fontWeight: 700 }}>{name}</option>
                      ))}
                  </select>
                  {(['Guest 1','Guest 2','Guest 3'].includes(player)) && (
                    <input
                      type="text"
                      className="border border-white bg-transparent rounded px-2 py-1 ml-2 focus:outline-none focus:ring-2 focus:ring-white"
                      style={{ fontFamily: 'Lato, Arial, sans-serif', color: '#FFD700' }}
                      placeholder="Enter guest name"
                      value={guestNames[idx][pIdx]}
                      onChange={e => handleGuestNameChange(idx, pIdx, e.target.value)}
                      required
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
          <button
            type="submit"
            className="w-full py-3 px-4 border border-white text-[#1B3A6B] font-extrabold rounded-2xl transition text-lg"
            style={{ backgroundColor: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', boxShadow: '0 2px 8px 0 rgba(255,215,0,0.10)' }}
            onMouseOver={e => e.currentTarget.style.backgroundColor = '#FFE066'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = '#FFD700'}
          >
            Save Groups
          </button>
        </form>
      </div>
    </>
  );
}
