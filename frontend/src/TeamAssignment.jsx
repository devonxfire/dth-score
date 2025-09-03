import { useState, useEffect } from 'react';

// numFourballs: number of 4 Balls
// Each 4 Ball has 2 teams, each team has 2 players
export default function TeamAssignment({ numTeams, onAssign, initialTeams }) {
  const numFourballs = Math.ceil((numTeams || 2) / 2);
  // Structure: [{ teeTime: '', teams: [[p1,p2],[p3,p4]] }]
  const [fourballs, setFourballs] = useState(() => {
    if (initialTeams && Array.isArray(initialTeams) && initialTeams.length > 0) {
      // Try to convert flat teams to fourballs structure
      const fbArr = [];
      for (let i = 0; i < numFourballs; i++) {
        const t1 = initialTeams[i*2]?.players?.slice(0,2) || [ '', '' ];
        const t2 = initialTeams[i*2+1]?.players?.slice(0,2) || [ '', '' ];
        fbArr.push({
          teeTime: initialTeams[i*2]?.teeTime || '',
          teams: [t1, t2]
        });
      }
      while (fbArr.length < numFourballs) {
        fbArr.push({ teeTime: '', teams: [ [ '', '' ], [ '', '' ] ] });
      }
      return fbArr;
    }
    return Array.from({ length: numFourballs }, () => ({ teeTime: '', teams: [ [ '', '' ], [ '', '' ] ] }));
  });
  const [available, setAvailable] = useState([]);
  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch('http://localhost:5050/api/users');
        if (!res.ok) throw new Error('Failed to fetch users');
        const users = await res.json();
        const names = users.map(u => u.name || u.username || u.id);
        setAvailable([...names]);
      } catch (err) {
        setAvailable([]);
      }
    }
    fetchUsers();
  }, [numFourballs]);

  function handlePlayerChange(fbIdx, teamIdx, playerIdx, value) {
    setFourballs(prev => prev.map((fb, i) =>
      i === fbIdx
        ? {
            ...fb,
            teams: fb.teams.map((team, tIdx) =>
              tIdx === teamIdx
                ? team.map((p, pIdx) => pIdx === playerIdx ? value : p)
                : team
            )
          }
        : fb
    ));
  }

  function handleTeeTimeChange(fbIdx, value) {
    setFourballs(prev => prev.map((fb, i) =>
      i === fbIdx ? { ...fb, teeTime: value } : fb
    ));
  }

  function handleSubmit(e) {
    e.preventDefault();
    // For Medal/4-ball UI: each 4-ball group of 4 players
    const fourballGroups = fourballs.map((fb, fbIdx) => ({
      players: [...fb.teams[0], ...fb.teams[1]],
      teeTime: fb.teeTime,
      fourball: fbIdx + 1
    }));

    // For backend/leaderboard: each 2-man team as a group
    const teamGroups = fourballs.flatMap((fb, fbIdx) => [
      { players: fb.teams[0], teeTime: fb.teeTime, fourball: fbIdx + 1 },
      { players: fb.teams[1], teeTime: fb.teeTime, fourball: fbIdx + 1 }
    ]);

    // Example: send teamGroups to backend for 4BBB, but keep fourballGroups for Medal/other UI
    // You may want to pass both to onAssign, or choose based on comp type
    // onAssign({ teamGroups, fourballGroups });
    // For now, default to teamGroups for backend
    onAssign(teamGroups);
  }

  // Get all assigned players to filter selects
  const assigned = fourballs.flatMap(fb => fb.teams.flat());

  return (
    <>
      <div className="flex flex-col items-center mb-10 w-full">
        <h3
          className="text-4xl font-extrabold drop-shadow-lg text-center mb-1 leading-tight flex items-end justify-center gap-2"
          style={{ color: '#1B3A6B', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}
        >
          Assign Players to 4 Balls (4BBB)
        </h3>
        <div className="mx-auto mt-2 mb-4" style={{height: '2px', maxWidth: 340, width: '100%', background: 'white', opacity: 0.7, borderRadius: 2}}></div>
      </div>
      <div className="flex flex-col items-center bg-transparent">
        <form onSubmit={handleSubmit} className="w-full max-w-3xl rounded-2xl text-white mx-auto" style={{ background: 'rgba(0,47,95,0.95)' }}>
          {fourballs.map((fb, fbIdx) => (
            <div key={fbIdx} className="mb-8 border-b border-white/30 pb-4">
              <div className="mb-2 font-extrabold" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', fontSize: '1.2rem' }}>4 Ball {fbIdx + 1}</div>
              <div className="mb-2">
                <label className="block mb-1 font-bold" htmlFor={`teeTime-${fbIdx}`} style={{ color: '#FFD700', fontFamily: 'Lato, Arial, sans-serif' }}>Tee Time</label>
                <input
                  id={`teeTime-${fbIdx}`}
                  type="time"
                  value={fb.teeTime}
                  onChange={e => handleTeeTimeChange(fbIdx, e.target.value)}
                  className="border border-white bg-transparent rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white"
                  style={{ fontFamily: 'Lato, Arial, sans-serif', color: '#FFD700' }}
                  required
                />
              </div>
              {[0,1].map(teamIdx => (
                <div key={teamIdx} className="mb-4 ml-4">
                  <div className="mb-1 font-bold" style={{ color: '#FFD700', fontFamily: 'Lato, Arial, sans-serif' }}>Team {teamIdx+1}</div>
                  <div className="flex flex-col gap-2">
                    {fb.teams[teamIdx].map((player, pIdx) => (
                      <select
                        key={pIdx}
                        value={player}
                        onChange={e => handlePlayerChange(fbIdx, teamIdx, pIdx, e.target.value)}
                        className="border border-white bg-transparent text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white mb-1"
                        style={{ fontFamily: 'Lato, Arial, sans-serif', color: '#FFD700', fontWeight: 700 }}
                        required
                      >
                        <option value="" style={{ color: '#1B3A6B', fontWeight: 700 }}>Select player</option>
                        {available
                          .filter(name => !assigned.includes(name) || name === player)
                          .filter((name, i, arr) => name && arr.indexOf(name) === i)
                          .map((name, optIdx) => (
                            <option key={`${name}-${fbIdx}-${teamIdx}-${pIdx}-${optIdx}`} value={name} style={{ color: '#1B3A6B', fontWeight: 700 }}>{name}</option>
                          ))}
                      </select>
                    ))}
                  </div>
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
            Save Teams
          </button>
        </form>
      </div>
    </>
  );
}
