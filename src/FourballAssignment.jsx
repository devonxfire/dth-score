import { useState } from 'react';
import { DTH_PLAYERS } from './dthPlayers';

export default function FourballAssignment({ fourballs, onAssign }) {
  // fourballs: number of 4balls
  // onAssign: callback with array of { players: [], teeTime: '' }
  const [groups, setGroups] = useState(
    Array.from({ length: fourballs }, () => ({ players: [], teeTime: '' }))
  );
  const [available, setAvailable] = useState(DTH_PLAYERS);

  function handlePlayerChange(groupIdx, playerIdx, value) {
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

  function handleAddPlayer(groupIdx) {
    const newGroups = groups.map((g, i) =>
      i === groupIdx ? { ...g, players: [...g.players, ''] } : g
    );
    setGroups(newGroups);
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
                value={player}
                onChange={e => handlePlayerChange(idx, pIdx, e.target.value)}
                className="border rounded px-2 py-1"
                required
              >
                <option value="">Select player</option>
                {available.concat(player).map(
                  name => name && <option key={name} value={name}>{name}</option>
                )}
              </select>
            </div>
          ))}
          {group.players.length < 4 && (
            <button
              type="button"
              className="py-1 px-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              onClick={() => handleAddPlayer(idx)}
            >
              Add Player
            </button>
          )}
        </div>
      ))}
      <button type="submit" className="w-full py-2 px-4 bg-green-600 text-white font-semibold rounded hover:bg-green-700 transition">Save Groups</button>
    </form>
  );
}
