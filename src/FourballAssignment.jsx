
import { useState } from 'react';
import { DTH_PLAYERS } from './dthPlayers';
import PageBackground from './PageBackground';

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
    <PageBackground>
      <div className="flex flex-col items-center px-4 mt-12">
        <h3 className="text-3xl font-bold text-white mb-6 drop-shadow-lg text-center">Assign Players to 4 Balls & Tee Times</h3>
      </div>
      <div className="flex flex-col items-center px-4 mt-8">
        <form onSubmit={handleSubmit} className="w-full max-w-2xl rounded-2xl shadow-lg bg-transparent text-white mx-auto" style={{ backdropFilter: 'none' }}>
          {groups.map((group, idx) => (
            <div key={idx} className="mb-6 border-b border-white/30 pb-4">
              <div className="mb-2 font-semibold">4 Ball {idx + 1}</div>
              <div className="mb-2">
                <label className="block mb-1 font-medium text-white" htmlFor={`teeTime-${idx}`}>Tee Time</label>
                <input
                  id={`teeTime-${idx}`}
                  type="time"
                  value={group.teeTime}
                  onChange={e => handleTeeTimeChange(idx, e.target.value)}
                  className="border border-white bg-transparent text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white"
                  required
                />
              </div>
              {group.players.map((player, pIdx) => (
                <div key={pIdx} className="mb-2 flex items-center">
                  <select
                    value={player.startsWith('GUEST') ? 'GUEST' : player}
                    onChange={e => handlePlayerChange(idx, pIdx, e.target.value)}
                    className="border border-white bg-transparent text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white"
                    required
                  >
                    <option value="">Select player</option>
                    {available.concat(player.startsWith('GUEST') ? 'GUEST' : player).map(
                      name => name && <option key={name} value={name}>{name}</option>
                    )}
                  </select>
                  {(player === 'GUEST' || player.startsWith('GUEST ')) && (
                    <input
                      type="text"
                      className="border border-white bg-transparent text-white rounded px-2 py-1 ml-2 focus:outline-none focus:ring-2 focus:ring-white"
                      placeholder="Enter guest name"
                      value={guestNames[idx][pIdx]}
                      onChange={e => handleGuestNameChange(idx, pIdx, e.target.value.replace(/^GUEST\s*/i, ''))}
                      required
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
          <button type="submit" className="w-full py-2 px-4 bg-transparent border border-white text-white font-semibold rounded-2xl hover:bg-white hover:text-black transition">Save Groups</button>
        </form>
      </div>
    </PageBackground>
  );
}
