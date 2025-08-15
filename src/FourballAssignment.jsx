
import { useState } from 'react';
import { DTH_PLAYERS } from './dthPlayers';

export default function FourballAssignment({ fourballs, onAssign }) {
  // fourballs: number of 4balls
  // onAssign: callback with array of { players: [], teeTime: '' }
  const [groups, setGroups] = useState(
    Array.from({ length: fourballs }, () => ({ players: Array(4).fill(''), teeTime: '' }))
  );
  const [available, setAvailable] = useState(DTH_PLAYERS);
  // Track guest names for each group/player slot
  const [guestNames, setGuestNames] = useState(
    Array.from({ length: fourballs }, () => Array(4).fill(''))
  );

  function handlePlayerChange(groupIdx, playerIdx, value) {
    // If switching away from GUEST, clear guest name
    if (groups[groupIdx].players[playerIdx] === 'GUEST' && value !== 'GUEST') {
      setGuestNames(prev => {
        const updated = prev.map(arr => arr.slice());
        updated[groupIdx][playerIdx] = '';
        return updated;
      });
    }
    const newGroups = groups.map((g, i) =>
      i === groupIdx
        ? {
            ...g,
            players: g.players.map((p, j) => (j === playerIdx ? value : p)),
          }
        : g
    );
    setGroups(newGroups);
    // Remove from available if selected, add back if deselected
    const selected = newGroups.flatMap(g => g.players).filter(Boolean);
    setAvailable(DTH_PLAYERS.filter(name => !selected.includes(name)));
  }

  function handleGuestNameChange(groupIdx, playerIdx, value) {
    setGuestNames(prev => {
      const updated = prev.map(arr => arr.slice());
      updated[groupIdx][playerIdx] = value;
      return updated;
    });
    // Update the player name in groups to be 'GUEST ' + value
    setGroups(prevGroups => prevGroups.map((g, i) =>
      i === groupIdx
        ? {
            ...g,
            players: g.players.map((p, j) =>
              j === playerIdx ? (value ? `GUEST ${value}` : 'GUEST') : p
            ),
          }
        : g
    ));
  }



  function handleTeeTimeChange(groupIdx, value) {
    const newGroups = groups.map((g, i) =>
      i === groupIdx ? { ...g, teeTime: value } : g
    );
    setGroups(newGroups);
  }

  function handleSubmit(e) {
    e.preventDefault();
    onAssign(groups);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow w-full max-w-2xl mx-auto mt-8">
      <h3 className="text-xl font-bold mb-4 text-green-700">Assign Players to 4 Balls & Tee Times</h3>
      {groups.map((group, idx) => (
        <div key={idx} className="mb-6 border-b pb-4">
          <div className="mb-2 font-semibold">4 Ball {idx + 1}</div>
          <div className="mb-2">
            <label className="block mb-1 font-medium">Tee Time</label>
            <input
              type="time"
              value={group.teeTime}
              onChange={e => handleTeeTimeChange(idx, e.target.value)}
              className="border rounded px-2 py-1"
              required
            />
          </div>
          {group.players.map((player, pIdx) => (
            <div key={pIdx} className="mb-2">
              <select
                value={player.startsWith('GUEST') ? 'GUEST' : player}
                onChange={e => handlePlayerChange(idx, pIdx, e.target.value)}
                className="border rounded px-2 py-1"
                required
              >
                <option value="">Select player</option>
                {available.concat(player.startsWith('GUEST') ? 'GUEST' : player).map(
                  name => name && <option key={name} value={name}>{name}</option>
                )}
              </select>
              {player === 'GUEST' || player.startsWith('GUEST ') ? (
                <input
                  type="text"
                  className="border rounded px-2 py-1 ml-2"
                  placeholder="Enter guest name"
                  value={guestNames[idx][pIdx]}
                  onChange={e => handleGuestNameChange(idx, pIdx, e.target.value.replace(/^GUEST\s*/i, ''))}
                  required
                />
              ) : null}
            </div>
          ))}
        </div>
      ))}
      <button type="submit" className="w-full py-2 px-4 bg-green-600 text-white font-semibold rounded hover:bg-green-700 transition">Save Groups</button>
    </form>
  );
}
