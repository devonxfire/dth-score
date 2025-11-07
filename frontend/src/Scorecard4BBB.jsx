
import React from 'react';
import AllianceScorecard from './AllianceScorecard';

// Minimal wrapper: render the Alliance scorecard UI for 4BBB competitions to
// keep the look-and-feel consistent. Scoring logic is intentionally left
// in backend/other modules and can be reintroduced if needed.
export default function Scorecard4BBB(props) {
  return (
    <AllianceScorecard {...props} />
  );
}

                                        if (groupForPlayer && groupForPlayer.handicaps) {
                                          groupForPlayer.handicaps[name] = newCH;
                                        }
                                        // Optionally re-fetch competition data
                                        if (competition && competition.id) {
                                          const res = await fetch(apiUrl(`/api/competitions/${competition.id}`));
                                          if (res.ok) {
                                            const data = await res.json();
                                            setCompetition(data);
                                          }
                                        }
                                      } catch (err) {
                                        alert('Failed to update Course Handicap.');
                                      }
                                    }}
                                    className="w-14 text-center text-white bg-transparent rounded focus:outline-none font-semibold no-spinner"
                                    style={{ border: 'none', MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none' }}
                                  />
                                </td>
                                <td className="border px-2 py-1 text-center">{adjHandicap !== '' ? adjHandicap : '-'}</td>
                                {/* Waters column */}
                                <td className="border px-2 py-1 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    className="w-12 text-center text-white bg-transparent rounded focus:outline-none font-semibold no-spinner"
                                    style={{ border: 'none', MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none' }}
                                    value={miniTableStats[name]?.waters || ''}
                                    onChange={async e => {
                                      const val = e.target.value;
                                      setMiniTableStats(stats => ({
                                        ...stats,
                                        [name]: {
                                          ...stats[name],
                                          waters: val
                                        }
                                      }));
                                      // Update backend
                                      if (!groupTeamId || !competition.users) return;
                                      const user = competition.users.find(u => u.name === name);
                                      if (!user) return;
                                      const userId = user.id || user.user_id || user.userId;
                                      await fetch(apiUrl(`/api/teams/${groupTeamId}/users/${userId}`), {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ waters: val })
                                      });
                                      if (val && Number(val) > 0) {
                                        const sig = `waters:${name}:g:${groupForPlayer?.id ?? ''}:c:${competition?.id ?? ''}`;
                                        if (checkAndMark(sig)) {
                                          try { showLocalPopup({ type: 'waters', name, sig }); } catch (e) {}
                                        }
                                      }
                                    }}
                                  />
      
                                </td>
                                {/* Dog column */}
                                <td className="border px-2 py-1 text-center">
                                  <input
                                    type="checkbox"
                                    checked={!!miniTableStats[name]?.dog}
                                    onChange={async e => {
                                      // Guard: only allow edits if user can edit this player
                                      if (!canEdit(name)) return;
                                      if (!groupTeamId || !competition.users) return;
                                      const user = competition.users.find(u => u.name === name);
                                      if (!user) return;
                                      const userId = user.id || user.user_id || user.userId;
                                      if (e.target.checked) {
                                        // Unset dog for all, set for this player
                                        setMiniTableStats(stats => {
                                          const newStats = {};
                                          Object.keys(stats).forEach(playerName => {
                                            newStats[playerName] = {
                                              ...stats[playerName],
                                              dog: false
                                            };
                                          });
                                          newStats[name] = {
                                            ...newStats[name],
                                            dog: true
                                          };
                                          return newStats;
                                        });
                                        // Unset dog for all in backend, then set for this player
                                        for (const otherName of groupPlayers) {
                                          const otherUser = competition.users.find(u => u.name === otherName);
                                          if (!otherUser) continue;
                                          const otherUserId = otherUser.id || otherUser.user_id || otherUser.userId;
                                          await fetch(apiUrl(`/api/teams/${groupTeamId}/users/${otherUserId}`), {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ dog: otherName === name })
                                          });
                                        }
                                        {
                                          const sig = `dog:${name}:g:${groupForPlayer?.id ?? ''}:c:${competition?.id ?? ''}`;
                                          if (checkAndMark(sig)) {
                                            try { showLocalPopup({ type: 'dog', name, holeNumber: null, sig }); } catch (e) {}
                                          }
                                        }
                                      } else {
                                        setMiniTableStats(stats => ({
                                          ...stats,
                                          [name]: {
                                            ...stats[name],
                                            dog: false
                                          }
                                        }));
                                        await fetch(apiUrl(`/api/teams/${groupTeamId}/users/${userId}`), {
                                          method: 'PATCH',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ dog: false })
                                        });
                                      }
                                    }}
                                    disabled={!canEdit(name)}
                                  />
                                </td>
                                {/* 2 Clubs column */}
                                <td className="border px-2 py-1 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    className="w-12 text-center text-white bg-transparent rounded focus:outline-none font-semibold no-spinner"
                                    style={{ border: 'none', MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none' }}
                                    value={miniTableStats[name]?.twoClubs || ''}
                                    onChange={async e => {
                                      if (!canEdit(name)) return;
                                      const val = e.target.value;
                                      setMiniTableStats(stats => ({
                                        ...stats,
                                        [name]: {
                                          ...stats[name],
                                          twoClubs: val
                                        }
                                      }));
                                      if (!groupTeamId || !competition.users) return;
                                      const user = competition.users.find(u => u.name === name);
                                      if (!user) return;
                                      const userId = user.id || user.user_id || user.userId;
                                      await fetch(apiUrl(`/api/teams/${groupTeamId}/users/${userId}`), {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ two_clubs: val })
                                      });
                                    }}
                                    disabled={!canEdit(name)}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                 
                </div>
                {/* Action buttons stacked vertically at top right */}
                <div className="flex flex-col items-end space-y-2 ml-8 mt-2">
                  {/* Dashboard button removed */}
                  <button
                    onClick={() => {
                      if (!competition) { alert('Competition not found.'); return; }
                      const compId = competition.id || competition._id || competition.joinCode || competition.joincode;
                      const today = new Date();
                      const isOpen = competition && (competition.status === 'Open' || (competition.date && new Date(competition.date) >= new Date(today.getFullYear(), today.getMonth(), today.getDate())));
                      if (!isOpen) {
                        // Disabled when competition is not open
                        return;
                      }
                      if (compId) {
                        navigate(`/leaderboard/${compId}`, { state: { competition } });
                      } else {
                        alert('Competition ID not found.');
                      }
                    }}
                    className="py-2 px-4 w-44 bg-[#1B3A6B] text-white font-semibold rounded-2xl hover:bg-white hover:text-[#1B3A6B] border border-white transition"
                    style={{ opacity: (competition && (competition.status === 'Open' || (competition.date && new Date(competition.date) >= new Date()))) ? 1 : 0.5, pointerEvents: (competition && (competition.status === 'Open' || (competition.date && new Date(competition.date) >= new Date()))) ? 'auto' : 'none' }}
                  >
                    <TrophyIcon className="h-5 w-5 mr-1 inline-block align-text-bottom" style={{ color: '#FFD700', filter: 'drop-shadow(0 1px 2px #bfa100)' }} />
                    Leaderboard
                  </button>
                  {/* Explicit Set Tee & Handicap button (user opens modal manually) */}
                  <button
                    onClick={() => setShowTeeModal(true)}
                    className="py-2 px-4 w-44 bg-[#FFD700] text-[#1B3A6B] font-semibold rounded-2xl hover:bg-white hover:text-[#1B3A6B] border border-white transition"
                    style={{ boxShadow: '0 2px 8px 0 rgba(255,215,0,0.10)' }}
                  >
                    Set Tee & Handicap
                  </button>
                  {/* Sign Scorecard button removed */}
                  <button
                    onClick={() => setShowResetModal(true)}
                    className="py-2 px-4 w-44 text-white font-bold rounded-2xl border border-white transition flex items-center"
                    style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                    onMouseOver={e => e.currentTarget.style.backgroundColor = '#FFD700'}
                    onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
                  >
                    <ArrowPathIcon className="h-6 w-6 mr-2 inline-block" />
                    Reset Scores
                  </button>
                </div>
              </div>
              {isAlliance && (
                <div className="mb-4">
                  <div className="font-semibold mb-1">Group Members:</div>
                  <ul className="mb-2">
                    {groupPlayers.map((name, idx) => {
                      let ph = '';
                      if (name === player.name && player.handicap) {
                        ph = playingHandicap;
                      } else if (competition.groups) {
                        const group = competition.groups.find(g => g.players?.includes(name));
                        if (group && group.handicaps && group.handicaps[name] !== undefined) {
                          ph = group.handicaps[name];
                        }
                      }
                      // Guest display name logic
                      let displayName = name;
                      const group = competition.groups?.find(g => g.players?.includes(name));
                      const guestIdx = ['Guest 1','Guest 2','Guest 3'].indexOf(name);
                      let guestDisplay = null;
                      if (guestIdx !== -1 && Array.isArray(group?.displayNames) && group.displayNames[guestIdx]) {
                        guestDisplay = `GUEST - ${group.displayNames[guestIdx]}`;
                      }
                      if (guestDisplay) {
                        displayName = guestDisplay;
                      } else if (guestIdx !== -1) {
                        displayName = name;
                      } else if (name && typeof name === 'string') {
                        const parts = name.trim().split(' ');
                        if (parts.length > 1) {
                          displayName = parts[0][0] + '. ' + parts[parts.length - 1];
                        } else {
                          displayName = name;
                        }
                      }
                      return (
                        <li key={name} className="mb-1">
                          <span className="font-semibold">{displayName}</span>
                          {ph !== '' ? (
                            <span className="ml-2 text-green-200">Playing Handicap: {ph}</span>
                          ) : (
                            <span className="ml-2 text-red-200">No Handicap</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              <div className="overflow-x-auto">
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
                    {groupPlayers.map((name, pIdx) => (
                      <React.Fragment key={name + '-rows-front'}>
                        {/* Score row */}
                        <tr key={name + '-gross-front'}>
                          <td rowSpan={2} className={`border border-white px-2 py-1 font-bold text-lg text-center align-middle ${playerColors[pIdx % playerColors.length]}`} style={{ minWidth: 32, verticalAlign: 'middle' }}>
                            {String.fromCharCode(65 + pIdx)}
                          </td>
                          <td className="border px-2 py-1 text-base font-bold bg-white/10 text-center" style={{ minWidth: 40 }}>Score</td>
                          {defaultHoles.slice(0,9).map((hole, hIdx) => (
                            <td key={hIdx} className="border py-1 text-center align-middle font-bold text-base">
                              <div className="flex items-center justify-center">
                                {(() => {
                                  const row = Array.isArray(scores[pIdx]) ? scores[pIdx] : [];
                                  const val = row[hIdx];
                                  const gross = parseInt(val, 10);
                                  const isEagleOrBetter = gross > 0 && gross <= hole.par - 2;
                                  const isBirdie = gross > 0 && gross === hole.par - 1;
                                  const isBogey = gross > 0 && gross === hole.par + 1;
                                  const isDoubleBogey = gross > 0 && gross === hole.par + 2;
                                  const isTripleOrWorse = gross > 0 && gross >= hole.par + 3;
                                  let inputClass = 'w-10 h-10 text-center focus:outline-none block mx-auto font-bold text-base no-spinner px-0';
                                  if (isEagleOrBetter) inputClass += ' bg-transparent border-2 border-pink-300 text-pink-300 rounded-full';
                                  else if (isBirdie) inputClass += ' bg-transparent border-2 border-green-500 text-green-500 rounded-full';
                                  else if (isTripleOrWorse) inputClass += ' bg-transparent border-2 border-[#800000] text-[#800000]';
                                  else if (isDoubleBogey) inputClass += ' bg-transparent border-2 border-red-400 text-red-400';
                                  else if (isBogey) inputClass += ' bg-transparent border-2 border-yellow-400 text-yellow-400';
                                  else inputClass += ' text-white';
                                  return (
                                    <input
                                      type="number"
                                      min="0"
                                      max="20"
                                      value={val === undefined ? '' : val}
                                      onChange={e => { if (!canEdit(groupPlayers[pIdx])) return; handleScoreChange(hIdx, e.target.value, pIdx); }}
                                      className={inputClass}
                                      inputMode="numeric"
                                      style={{ MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}
                                      disabled={!canEdit(groupPlayers[pIdx])}
                                    />
                                  );
                                })()}
                              </div>
                            </td>
                          ))}
                          <td className="border px-2 py-1 font-bold text-base">{Array.isArray(scores[pIdx]) ? scores[pIdx].slice(0,9).reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0) : ''}</td>
                        </tr>
                        {/* Result row (no player label cell) */}
                        <tr key={name + '-net-front'}>
                          <td className="border px-2 py-1 bg-white/10 text-base font-bold text-center align-middle" style={{ minWidth: 40, verticalAlign: 'middle', height: '44px' }}>Result</td>
                          {(() => {
                            let adjHandicap = 0;
                            if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[name]) {
                              const fullHandicap = parseInt(groupForPlayer.handicaps[name], 10) || 0;
                              if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                adjHandicap = Math.round(fullHandicap * Number(competition.handicapallowance) / 100);
                              } else {
                                adjHandicap = fullHandicap;
                              }
                            }
                            let pointsTotal = 0;
                            const row = Array.isArray(scores[pIdx]) ? scores[pIdx] : [];
                            return defaultHoles.slice(0,9).map((hole, hIdx) => {
                              const strokeIdx = hole.index;
                              let strokesReceived = 0;
                              if (adjHandicap > 0) {
                                if (adjHandicap >= 18) {
                                  strokesReceived = 1;
                                  if (adjHandicap - 18 >= strokeIdx) strokesReceived = 2;
                                  else if (strokeIdx <= (adjHandicap % 18)) strokesReceived = 2;
                                } else if (strokeIdx <= adjHandicap) {
                                  strokesReceived = 1;
                                }
                              }
                              const gross = parseInt(row[hIdx], 10) || 0;
                              const net = gross ? gross - strokesReceived : null;
                              // Stableford points: 6=triple eagle, 5=double eagle, 4=eagle, 3=birdie, 2=par, 1=bogey, 0=worse
                              let pts = 0;
                              if (net !== null) {
                                if (net === hole.par - 4) pts = 6; // triple eagle
                                else if (net === hole.par - 3) pts = 5; // double eagle (albatross)
                                else if (net === hole.par - 2) pts = 4; // eagle
                                else if (net === hole.par - 1) pts = 3; // birdie
                                else if (net === hole.par) pts = 2; // par
                                else if (net === hole.par + 1) pts = 1; // bogey
                              }
                              pointsTotal += pts;
                              return (
                                <td key={hIdx} className="border px-1 py-1 bg-white/5 align-middle font-bold text-base" style={{ verticalAlign: 'middle', height: '44px' }}>
                                  {gross ? pts : ''}
                                </td>
                              );
                            });
                          })()}
                          {/* Net front 9 total */}
                          <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>
                            {(() => {
                              let adjHandicap = 0;
                              if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[name]) {
                                const fullHandicap = parseInt(groupForPlayer.handicaps[name], 10) || 0;
                                if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                  adjHandicap = Math.round(fullHandicap * Number(competition.handicapallowance) / 100);
                                } else {
                                  adjHandicap = fullHandicap;
                                }
                              }
                              let pointsTotal = 0;
                              const row = Array.isArray(scores[pIdx]) ? scores[pIdx] : [];
                              defaultHoles.slice(0,9).forEach((hole, hIdx) => {
                                const strokeIdx = hole.index;
                                let strokesReceived = 0;
                                if (adjHandicap > 0) {
                                  if (adjHandicap >= 18) {
                                    strokesReceived = 1;
                                    if (adjHandicap - 18 >= strokeIdx) strokesReceived = 2;
                                    else if (strokeIdx <= (adjHandicap % 18)) strokesReceived = 2;
                                  } else if (strokeIdx <= adjHandicap) {
                                    strokesReceived = 1;
                                  }
                                }
                                const gross = row[hIdx] !== undefined && row[hIdx] !== '' ? parseInt(row[hIdx], 10) : null;
                                const net = gross !== null && !isNaN(gross) && gross > 0 ? gross - strokesReceived : null;
                                let pts = '';
                                if (net !== null) {
                                  if (net === hole.par - 4) pts = 6;
                                  else if (net === hole.par - 3) pts = 5;
                                  else if (net === hole.par - 2) pts = 4;
                                  else if (net === hole.par - 1) pts = 3;
                                  else if (net === hole.par) pts = 2;
                                  else if (net === hole.par + 1) pts = 1;
                                  else pts = 0;
                                }
                                if (pts !== '' && gross !== null && !isNaN(gross) && gross > 0) pointsTotal += pts;
                              });
                              return pointsTotal !== 0 ? pointsTotal : '';
                            })()}
                          </td>
                        </tr>
                        {/* Insert B/B Score row after player B's Result row (pIdx === 1) */}
                        {pIdx === 1 && (
                          <tr key="bb-score-front-ab">
                            <td className="border border-white px-2 py-1" style={{ minWidth: 32 }}></td>
                            <td className="border px-2 py-1 text-base font-bold text-center" style={{ minWidth: 40 }}>B/B Score</td>
                            {defaultHoles.slice(0,9).map((hole, hIdx) => {
                              // ...existing code for A/B logic...
                              let adjHandicapA = 0;
                              if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[0]]) {
                                const fullHandicapA = parseInt(groupForPlayer.handicaps[groupPlayers[0]], 10) || 0;
                                if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                  adjHandicapA = Math.round(fullHandicapA * Number(competition.handicapallowance) / 100);
                                } else {
                                  adjHandicapA = fullHandicapA;
                                }
                              }
                              let strokesA = 0;
                              if (adjHandicapA > 0) {
                                if (adjHandicapA >= 18) {
                                  strokesA = 1;
                                  if (adjHandicapA - 18 >= hole.index) strokesA = 2;
                                  else if (hole.index <= (adjHandicapA % 18)) strokesA = 2;
                                } else if (hole.index <= adjHandicapA) {
                                  strokesA = 1;
                                }
                              }
                              const grossA = Array.isArray(scores[0]) ? parseInt(scores[0][hIdx], 10) : null;
                              const netA = grossA !== null && !isNaN(grossA) && grossA > 0 ? grossA - strokesA : null;
                              // Calculate net for B
                              let adjHandicapB = 0;
                              if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[1]]) {
                                const fullHandicapB = parseInt(groupForPlayer.handicaps[groupPlayers[1]], 10) || 0;
                                if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                  adjHandicapB = Math.round(fullHandicapB * Number(competition.handicapallowance) / 100);
                                } else {
                                  adjHandicapB = fullHandicapB;
                                }
                              }
                              let strokesB = 0;
                              if (adjHandicapB > 0) {
                                if (adjHandicapB >= 18) {
                                  strokesB = 1;
                                  if (adjHandicapB - 18 >= hole.index) strokesB = 2;
                                  else if (hole.index <= (adjHandicapB % 18)) strokesB = 2;
                                } else if (hole.index <= adjHandicapB) {
                                  strokesB = 1;
                                }
                              }
                              const grossB = Array.isArray(scores[1]) ? parseInt(scores[1][hIdx], 10) : null;
                              const netB = grossB !== null && !isNaN(grossB) && grossB > 0 ? grossB - strokesB : null;
                              function points(net, par) {
                                if (net == null) return '';
                                if (net === par - 4) return 6;
                                if (net === par - 3) return 5;
                                if (net === par - 2) return 4;
                                if (net === par - 1) return 3;
                                if (net === par) return 2;
                                if (net === par + 1) return 1;
                                return 0;
                              }
                              const ptsA = points(netA, hole.par);
                              const ptsB = points(netB, hole.par);
                              const best = ptsA === '' && ptsB === '' ? '' : Math.max(ptsA || 0, ptsB || 0);
                              const bothBlank = (grossA === null && grossB === null);
                              return (
                                <td key={hIdx} className="border border-white py-1 text-center align-middle font-bold text-base text-white" style={{ verticalAlign: 'middle', height: '44px' }}>{bothBlank ? '' : best}</td>
                              );
                            })}
                            <td className="border border-white px-2 py-1 font-bold text-base text-white" style={{ verticalAlign: 'middle', height: '44px' }}>
                              {(() => {
                                let total = 0;
                                for (let hIdx = 0; hIdx < 9; hIdx++) {
                                  const hole = defaultHoles[hIdx];
                                  // ...existing code for A/B logic...
                                  let adjHandicapA = 0;
                                  if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[0]]) {
                                    const fullHandicapA = parseInt(groupForPlayer.handicaps[groupPlayers[0]], 10) || 0;
                                    if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                      adjHandicapA = Math.round(fullHandicapA * Number(competition.handicapallowance) / 100);
                                    } else {
                                      adjHandicapA = fullHandicapA;
                                    }
                                  }
                                  let strokesA = 0;
                                  if (adjHandicapA > 0) {
                                    if (adjHandicapA >= 18) {
                                      strokesA = 1;
                                      if (adjHandicapA - 18 >= hole.index) strokesA = 2;
                                      else if (hole.index <= (adjHandicapA % 18)) strokesA = 2;
                                    } else if (hole.index <= adjHandicapA) {
                                      strokesA = 1;
                                    }
                                  }
                                  const grossA = Array.isArray(scores[0]) ? parseInt(scores[0][hIdx], 10) : null;
                                  const netA = grossA !== null && !isNaN(grossA) && grossA > 0 ? grossA - strokesA : null;
                                  // ...existing code for B...
                                  let adjHandicapB = 0;
                                  if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[1]]) {
                                    const fullHandicapB = parseInt(groupForPlayer.handicaps[groupPlayers[1]], 10) || 0;
                                    if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                      adjHandicapB = Math.round(fullHandicapB * Number(competition.handicapallowance) / 100);
                                    } else {
                                      adjHandicapB = fullHandicapB;
                                    }
                                  }
                                  let strokesB = 0;
                                  if (adjHandicapB > 0) {
                                    if (adjHandicapB >= 18) {
                                      strokesB = 1;
                                      if (adjHandicapB - 18 >= hole.index) strokesB = 2;
                                      else if (hole.index <= (adjHandicapB % 18)) strokesB = 2;
                                    } else if (hole.index <= adjHandicapB) {
                                      strokesB = 1;
                                    }
                                  }
                                  const grossB = Array.isArray(scores[1]) ? parseInt(scores[1][hIdx], 10) : null;
                                  const netB = grossB !== null && !isNaN(grossB) && grossB > 0 ? grossB - strokesB : null;
                                  function points(net, par) {
                                    if (net == null) return '';
                                    if (net === par - 4) return 6;
                                    if (net === par - 3) return 5;
                                    if (net === par - 2) return 4;
                                    if (net === par - 1) return 3;
                                    if (net === par) return 2;
                                    if (net === par + 1) return 1;
                                    return 0;
                                  }
                                  const ptsA = points(netA, hole.par);
                                  const ptsB = points(netB, hole.par);
                                  const best = ptsA === '' && ptsB === '' ? '' : Math.max(ptsA || 0, ptsB || 0);
                                  if (best !== '') total += best;
                                }
                                return total !== 0 ? total : '';
                              })()}
                            </td>
                          </tr>
                        )}
                        {pIdx === 3 && groupPlayers.length >= 4 && (
                          <tr key="bb-score-front-cd">
                            <td className="border border-white px-2 py-1" style={{ minWidth: 32 }}></td>
                            <td className="border px-2 py-1 text-base font-bold text-center" style={{ minWidth: 40 }}>B/B Score</td>
                            {defaultHoles.slice(0,9).map((hole, hIdx) => {
                              // ...existing code for C/D logic...
                              let adjHandicapC = 0;
                              if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[2]]) {
                                const fullHandicapC = parseInt(groupForPlayer.handicaps[groupPlayers[2]], 10) || 0;
                                if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                  adjHandicapC = Math.round(fullHandicapC * Number(competition.handicapallowance) / 100);
                                } else {
                                  adjHandicapC = fullHandicapC;
                                }
                              }
                              let strokesC = 0;
                              if (adjHandicapC > 0) {
                                if (adjHandicapC >= 18) {
                                  strokesC = 1;
                                  if (adjHandicapC - 18 >= hole.index) strokesC = 2;
                                  else if (hole.index <= (adjHandicapC % 18)) strokesC = 2;
                                } else if (hole.index <= adjHandicapC) {
                                  strokesC = 1;
                                }
                              }
                              const grossC = Array.isArray(scores[2]) ? parseInt(scores[2][hIdx], 10) : null;
                              const netC = grossC !== null && !isNaN(grossC) && grossC > 0 ? grossC - strokesC : null;
                              // Calculate net for D
                              let adjHandicapD = 0;
                              if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[3]]) {
                                const fullHandicapD = parseInt(groupForPlayer.handicaps[groupPlayers[3]], 10) || 0;
                                if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                  adjHandicapD = Math.round(fullHandicapD * Number(competition.handicapallowance) / 100);
                                } else {
                                  adjHandicapD = fullHandicapD;
                                }
                              }
                              let strokesD = 0;
                              if (adjHandicapD > 0) {
                                if (adjHandicapD >= 18) {
                                  strokesD = 1;
                                  if (adjHandicapD - 18 >= hole.index) strokesD = 2;
                                  else if (hole.index <= (adjHandicapD % 18)) strokesD = 2;
                                } else if (hole.index <= adjHandicapD) {
                                  strokesD = 1;
                                }
                              }
                              const grossD = Array.isArray(scores[3]) ? parseInt(scores[3][hIdx], 10) : null;
                              const netD = grossD !== null && !isNaN(grossD) && grossD > 0 ? grossD - strokesD : null;
                              function points(net, par) {
                                if (net == null) return '';
                                if (net === par - 4) return 6;
                                if (net === par - 3) return 5;
                                if (net === par - 2) return 4;
                                if (net === par - 1) return 3;
                                if (net === par) return 2;
                                if (net === par + 1) return 1;
                                return 0;
                              }
                              const ptsC = points(netC, hole.par);
                              const ptsD = points(netD, hole.par);
                              const best = ptsC === '' && ptsD === '' ? '' : Math.max(ptsC || 0, ptsD || 0);
                              const bothBlank = (grossC === null && grossD === null);
                              return (
                                <td key={hIdx} className="border border-white py-1 text-center align-middle font-bold text-base text-white" style={{ verticalAlign: 'middle', height: '44px' }}>{bothBlank ? '' : best}</td>
                              );
                            })}
                            <td className="border border-white px-2 py-1 font-bold text-base text-white" style={{ verticalAlign: 'middle', height: '44px' }}>
                              {(() => {
                                let total = 0;
                                for (let hIdx = 0; hIdx < 9; hIdx++) {
                                  const hole = defaultHoles[hIdx];
                                  // ...existing code for C/D logic...
                                  let adjHandicapC = 0;
                                  if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[2]]) {
                                    const fullHandicapC = parseInt(groupForPlayer.handicaps[groupPlayers[2]], 10) || 0;
                                    if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                      adjHandicapC = Math.round(fullHandicapC * Number(competition.handicapallowance) / 100);
                                    } else {
                                      adjHandicapC = fullHandicapC;
                                    }
                                  }
                                  let strokesC = 0;
                                  if (adjHandicapC > 0) {
                                    if (adjHandicapC >= 18) {
                                      strokesC = 1;
                                      if (adjHandicapC - 18 >= hole.index) strokesC = 2;
                                      else if (hole.index <= (adjHandicapC % 18)) strokesC = 2;
                                    } else if (hole.index <= adjHandicapC) {
                                      strokesC = 1;
                                    }
                                  }
                                  const grossC = Array.isArray(scores[2]) ? parseInt(scores[2][hIdx], 10) : null;
                                  const netC = grossC !== null && !isNaN(grossC) && grossC > 0 ? grossC - strokesC : null;
                                  // ...existing code for D...
                                  let adjHandicapD = 0;
                                  if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[3]]) {
                                    const fullHandicapD = parseInt(groupForPlayer.handicaps[groupPlayers[3]], 10) || 0;
                                    if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                      adjHandicapD = Math.round(fullHandicapD * Number(competition.handicapallowance) / 100);
                                    } else {
                                      adjHandicapD = fullHandicapD;
                                    }
                                  }
                                  let strokesD = 0;
                                  if (adjHandicapD > 0) {
                                    if (adjHandicapD >= 18) {
                                      strokesD = 1;
                                      if (adjHandicapD - 18 >= hole.index) strokesD = 2;
                                      else if (hole.index <= (adjHandicapD % 18)) strokesD = 2;
                                    } else if (hole.index <= adjHandicapD) {
                                      strokesD = 1;
                                    }
                                  }
                                  const grossD = Array.isArray(scores[3]) ? parseInt(scores[3][hIdx], 10) : null;
                                  const netD = grossD !== null && !isNaN(grossD) && grossD > 0 ? grossD - strokesD : null;
                                  function points(net, par) {
                                    if (net == null) return '';
                                    if (net === par - 4) return 6;
                                    if (net === par - 3) return 5;
                                    if (net === par - 2) return 4;
                                    if (net === par - 1) return 3;
                                    if (net === par) return 2;
                                    if (net === par + 1) return 1;
                                    return 0;
                                  }
                                  const ptsC = points(netC, hole.par);
                                  const ptsD = points(netD, hole.par);
                                  const best = ptsC === '' && ptsD === '' ? '' : Math.max(ptsC || 0, ptsD || 0);
                                  if (best !== '') total += best;
                                }
                                return total !== 0 ? total : '';
                              })()}
                            </td>
                          </tr>
                        )}
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
                      <th className="border px-2 py-1 bg-white/5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupPlayers.map((name, pIdx) => (
                      <React.Fragment key={name + '-rows-back'}>
                        {/* Gross row */}
                        <tr key={name + '-gross-back'}>
                          <td rowSpan={2} className={`border border-white px-2 py-1 font-bold text-lg text-center align-middle ${playerColors[pIdx % playerColors.length]}`} style={{ minWidth: 32, verticalAlign: 'middle' }}>
                            {String.fromCharCode(65 + pIdx)}
                          </td>
                          <td className="border px-2 py-1 text-base font-bold bg-white/10 text-center" style={{ minWidth: 40 }}>Score</td>
                          {defaultHoles.slice(9,18).map((hole, hIdx) => (
                            <td key={hIdx} className="border py-1 text-center align-middle font-bold text-base">
                              <div className="flex items-center justify-center">
                                {(() => {
                                  const row = Array.isArray(scores[pIdx]) ? scores[pIdx] : [];
                                  const val = row[hIdx+9];
                                  const gross = parseInt(val, 10);
                                  const isEagleOrBetter = gross > 0 && gross <= hole.par - 2;
                                  const isBirdie = gross > 0 && gross === hole.par - 1;
                                  const isBogey = gross > 0 && gross === hole.par + 1;
                                  const isDoubleBogey = gross > 0 && gross === hole.par + 2;
                                  const isTripleOrWorse = gross > 0 && gross >= hole.par + 3;
                                  let inputClass = 'w-10 h-10 text-center focus:outline-none block mx-auto font-bold text-base no-spinner px-0';
                                  if (isEagleOrBetter) inputClass += ' bg-pink-300 text-black rounded-full';
                                  else if (isBirdie) inputClass += ' bg-green-500 text-white rounded-full';
                                  else if (isTripleOrWorse) inputClass += ' bg-[#800000] text-white';
                                  else if (isDoubleBogey) inputClass += ' bg-red-400 text-white';
                                  else if (isBogey) inputClass += ' bg-yellow-400 text-white';
                                  else inputClass += ' text-white';
                                  return (
                                    <input
                                      type="number"
                                      min="0"
                                      max="20"
                                      value={val === undefined ? '' : val}
                                      onChange={e => handleScoreChange(hIdx+9, e.target.value, pIdx)}
                                      className={inputClass}
                                      inputMode="numeric"
                                      style={{ MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}
                                    />
                                  );
                                })()}
                              </div>
                            </td>
                          ))}

                          <td className="border px-2 py-1 font-bold text-base">{Array.isArray(scores[pIdx]) ? scores[pIdx].slice(9,18).reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0) : ''}</td>
                          <td className="border px-2 py-1 font-bold text-base">{Array.isArray(scores[pIdx]) ? scores[pIdx].reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0) : ''}</td>
                        </tr>
                        {/* Net row (no player label cell) */}
                        <tr key={name + '-net-back'}>
                          <td className="border px-2 py-1 bg-white/10 text-base font-bold text-center align-middle" style={{ minWidth: 40, verticalAlign: 'middle', height: '44px' }}>Result</td>
                          {(() => {
                            let adjHandicap = 0;
                            if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[name]) {
                              const fullHandicap = parseInt(groupForPlayer.handicaps[name], 10) || 0;
                              if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                adjHandicap = Math.round(fullHandicap * Number(competition.handicapallowance) / 100);
                              } else {
                                adjHandicap = fullHandicap;
                              }
                            }
                            let pointsTotal = 0;
                            const row = Array.isArray(scores[pIdx]) ? scores[pIdx] : [];
                            return defaultHoles.slice(9,18).map((hole, hIdx) => {
                              const strokeIdx = hole.index;
                              let strokesReceived = 0;
                              if (adjHandicap > 0) {
                                if (adjHandicap >= 18) {
                                  strokesReceived = 1;
                                  if (adjHandicap - 18 >= strokeIdx) strokesReceived = 2;
                                  else if (strokeIdx <= (adjHandicap % 18)) strokesReceived = 2;
                                } else if (strokeIdx <= adjHandicap) {
                                  strokesReceived = 1;
                                }
                              }
                              const gross = parseInt(row[hIdx+9], 10) || 0;
                              const net = gross ? gross - strokesReceived : null;
                              // Stableford points: 3=birdie, 2=par, 1=bogey, 0=worse
                              let pts = 0;
                              if (net !== null) {
                                if (net === hole.par - 1) pts = 3;
                                else if (net === hole.par) pts = 2;
                                else if (net === hole.par + 1) pts = 1;
                              }
                              pointsTotal += pts;
                              return (
                                <td key={hIdx} className="border px-1 py-1 bg-white/5 align-middle font-bold text-base" style={{ verticalAlign: 'middle', height: '44px' }}>
                                  {gross ? pts : ''}
                                </td>
                              );
                            });
                          })()}
                          {/* Net back 9 and total */}
                          <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>
                            {/* IN (back 9) points */}
                            {(() => {
                              let adjHandicap = 0;
                              if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[name]) {
                                const fullHandicap = parseInt(groupForPlayer.handicaps[name], 10) || 0;
                                if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                  adjHandicap = Math.round(fullHandicap * Number(competition.handicapallowance) / 100);
                                } else {
                                  adjHandicap = fullHandicap;
                                }
                              }
                              let pointsTotal = 0;
                              const row = Array.isArray(scores[pIdx]) ? scores[pIdx] : [];
                              defaultHoles.slice(9,18).forEach((hole, hIdx) => {
                                const strokeIdx = hole.index;
                                let strokesReceived = 0;
                                if (adjHandicap > 0) {
                                  if (adjHandicap >= 18) {
                                    strokesReceived = 1;
                                    if (adjHandicap - 18 >= strokeIdx) strokesReceived = 2;
                                    else if (strokeIdx <= (adjHandicap % 18)) strokesReceived = 2;
                                  } else if (strokeIdx <= adjHandicap) {
                                    strokesReceived = 1;
                                  }
                                }
                                const gross = row[hIdx+9] !== undefined && row[hIdx+9] !== '' ? parseInt(row[hIdx+9], 10) : null;
                                const net = gross !== null && !isNaN(gross) && gross > 0 ? gross - strokesReceived : null;
                                let pts = '';
                                if (net !== null) {
                                  if (net === hole.par - 4) pts = 6;
                                  else if (net === hole.par - 3) pts = 5;
                                  else if (net === hole.par - 2) pts = 4;
                                  else if (net === hole.par - 1) pts = 3;
                                  else if (net === hole.par) pts = 2;
                                  else if (net === hole.par + 1) pts = 1;
                                  else pts = 0;
                                }
                                if (pts !== '' && gross !== null && !isNaN(gross) && gross > 0) pointsTotal += pts;
                              });
                              return pointsTotal !== 0 ? pointsTotal : '';
                            })()}
                          </td>
                          <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>
                            {/* TOTAL = OUT + IN points */}
                            {(() => {
                              // Get OUT and IN points using same logic as OUT/IN columns
                              let outPoints = 0;
                              let inPoints = 0;
                              let adjHandicap = 0;
                              if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[name]) {
                                const fullHandicap = parseInt(groupForPlayer.handicaps[name], 10) || 0;
                                if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                  adjHandicap = Math.round(fullHandicap * Number(competition.handicapallowance) / 100);
                                } else {
                                  adjHandicap = fullHandicap;
                                }
                              }
                              const row = Array.isArray(scores[pIdx]) ? scores[pIdx] : [];
                              // OUT (front 9)
                              defaultHoles.slice(0,9).forEach((hole, hIdx) => {
                                const strokeIdx = hole.index;
                                let strokesReceived = 0;
                                if (adjHandicap > 0) {
                                  if (adjHandicap >= 18) {
                                    strokesReceived = 1;
                                    if (adjHandicap - 18 >= strokeIdx) strokesReceived = 2;
                                    else if (strokeIdx <= (adjHandicap % 18)) strokesReceived = 2;
                                  } else if (strokeIdx <= adjHandicap) {
                                    strokesReceived = 1;
                                  }
                                }
                                const gross = row[hIdx] !== undefined && row[hIdx] !== '' ? parseInt(row[hIdx], 10) : null;
                                const net = gross !== null && !isNaN(gross) && gross > 0 ? gross - strokesReceived : null;
                                let pts = '';
                                if (net !== null) {
                                  if (net === hole.par - 4) pts = 6;
                                  else if (net === hole.par - 3) pts = 5;
                                  else if (net === hole.par - 2) pts = 4;
                                  else if (net === hole.par - 1) pts = 3;
                                  else if (net === hole.par) pts = 2;
                                  else if (net === hole.par + 1) pts = 1;
                                  else pts = 0;
                                }
                                if (pts !== '' && gross !== null && !isNaN(gross) && gross > 0) outPoints += pts;
                              });
                              // IN (back 9)
                              defaultHoles.slice(9,18).forEach((hole, hIdx) => {
                                const strokeIdx = hole.index;
                                let strokesReceived = 0;
                                if (adjHandicap > 0) {
                                  if (adjHandicap >= 18) {
                                    strokesReceived = 1;
                                    if (adjHandicap - 18 >= strokeIdx) strokesReceived = 2;
                                    else if (strokeIdx <= (adjHandicap % 18)) strokesReceived = 2;
                                  } else if (strokeIdx <= adjHandicap) {
                                    strokesReceived = 1;
                                  }
                                }
                                const gross = row[hIdx+9] !== undefined && row[hIdx+9] !== '' ? parseInt(row[hIdx+9], 10) : null;
                                const net = gross !== null && !isNaN(gross) && gross > 0 ? gross - strokesReceived : null;
                                let pts = '';
                                if (net !== null) {
                                  if (net === hole.par - 4) pts = 6;
                                  else if (net === hole.par - 3) pts = 5;
                                  else if (net === hole.par - 2) pts = 4;
                                  else if (net === hole.par - 1) pts = 3;
                                  else if (net === hole.par) pts = 2;
                                  else if (net === hole.par + 1) pts = 1;
                                  else pts = 0;
                                }
                                if (pts !== '' && gross !== null && !isNaN(gross) && gross > 0) inPoints += pts;
                              });
                              const totalPoints = outPoints + inPoints;
                              return totalPoints !== 0 ? totalPoints : '';
                            })()}
                          </td>
                        </tr>
                        {/* Insert B/B Score row after player B's Result row (pIdx === 1) for back 9 */}
                        {pIdx === 1 && (
                          <tr key="bb-score-back-ab">
                            <td className="border border-white px-2 py-1" style={{ minWidth: 32 }}></td>
                            <td className="border px-2 py-1 text-base font-bold text-center" style={{ minWidth: 40 }}>B/B Score</td>
                            {defaultHoles.slice(9,18).map((hole, hIdx) => {
                              // ...existing code for A/B logic...
                              let adjHandicapA = 0;
                              if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[0]]) {
                                const fullHandicapA = parseInt(groupForPlayer.handicaps[groupPlayers[0]], 10) || 0;
                                if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                  adjHandicapA = Math.round(fullHandicapA * Number(competition.handicapallowance) / 100);
                                } else {
                                  adjHandicapA = fullHandicapA;
                                }
                              }
                              let strokesA = 0;
                              if (adjHandicapA > 0) {
                                if (adjHandicapA >= 18) {
                                  strokesA = 1;
                                  if (adjHandicapA - 18 >= hole.index) strokesA = 2;
                                  else if (hole.index <= (adjHandicapA % 18)) strokesA = 2;
                                } else if (hole.index <= adjHandicapA) {
                                  strokesA = 1;
                                }
                              }
                              const grossA = Array.isArray(scores[0]) ? parseInt(scores[0][hIdx+9], 10) : null;
                              const netA = grossA !== null && !isNaN(grossA) && grossA > 0 ? grossA - strokesA : null;
                              // Calculate net for B
                              let adjHandicapB = 0;
                              if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[1]]) {
                                const fullHandicapB = parseInt(groupForPlayer.handicaps[groupPlayers[1]], 10) || 0;
                                if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                  adjHandicapB = Math.round(fullHandicapB * Number(competition.handicapallowance) / 100);
                                } else {
                                  adjHandicapB = fullHandicapB;
                                }
                              }
                              let strokesB = 0;
                              if (adjHandicapB > 0) {
                                if (adjHandicapB >= 18) {
                                  strokesB = 1;
                                  if (adjHandicapB - 18 >= hole.index) strokesB = 2;
                                  else if (hole.index <= (adjHandicapB % 18)) strokesB = 2;
                                } else if (hole.index <= adjHandicapB) {
                                  strokesB = 1;
                                }
                              }
                              const grossB = Array.isArray(scores[1]) ? parseInt(scores[1][hIdx+9], 10) : null;
                              const netB = grossB !== null && !isNaN(grossB) && grossB > 0 ? grossB - strokesB : null;
                              function points(net, par) {
                                if (net == null) return '';
                                if (net === par - 4) return 6;
                                if (net === par - 3) return 5;
                                if (net === par - 2) return 4;
                                if (net === par - 1) return 3;
                                if (net === par) return 2;
                                if (net === par + 1) return 1;
                                return 0;
                              }
                              const ptsA = points(netA, hole.par);
                              const ptsB = points(netB, hole.par);
                              const best = ptsA === '' && ptsB === '' ? '' : Math.max(ptsA || 0, ptsB || 0);
                              const bothBlank = (grossA === null && grossB === null);
                              return (
                                <td key={hIdx} className="border border-white py-1 text-center align-middle font-bold text-base text-white" style={{ verticalAlign: 'middle', height: '44px' }}>{bothBlank ? '' : best}</td>
                              );
                            })}
                            {/* In (back 9 total) */}
                            <td className="border border-white px-2 py-1 font-bold text-base text-white" style={{ verticalAlign: 'middle', height: '44px' }}>
                              {(() => {
                                let backTotal = 0;
                                for (let hIdx = 9; hIdx < 18; hIdx++) {
                                  let adjHandicapA = 0;
                                  if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[0]]) {
                                    const fullHandicapA = parseInt(groupForPlayer.handicaps[groupPlayers[0]], 10) || 0;
                                    if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                      adjHandicapA = Math.round(fullHandicapA * Number(competition.handicapallowance) / 100);
                                    } else {
                                      adjHandicapA = fullHandicapA;
                                    }
                                  }
                                  let strokesA = 0;
                                  if (adjHandicapA > 0) {
                                    if (adjHandicapA >= 18) {
                                      strokesA = 1;
                                      if (adjHandicapA - 18 >= defaultHoles[hIdx].index) strokesA = 2;
                                      else if (defaultHoles[hIdx].index <= (adjHandicapA % 18)) strokesA = 2;
                                    } else if (defaultHoles[hIdx].index <= adjHandicapA) {
                                      strokesA = 1;
                                    }
                                  }
                                  const grossA = Array.isArray(scores[0]) ? parseInt(scores[0][hIdx], 10) : null;
                                  const netA = grossA !== null && !isNaN(grossA) && grossA > 0 ? grossA - strokesA : null;
                                  let adjHandicapB = 0;
                                  if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[1]]) {
                                    const fullHandicapB = parseInt(groupForPlayer.handicaps[groupPlayers[1]], 10) || 0;
                                    if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                      adjHandicapB = Math.round(fullHandicapB * Number(competition.handicapallowance) / 100);
                                    } else {
                                      adjHandicapB = fullHandicapB;
                                    }
                                  }
                                  let strokesB = 0;
                                  if (adjHandicapB > 0) {
                                    if (adjHandicapB >= 18) {
                                      strokesB = 1;
                                      if (adjHandicapB - 18 >= defaultHoles[hIdx].index) strokesB = 2;
                                      else if (defaultHoles[hIdx].index <= (adjHandicapB % 18)) strokesB = 2;
                                    } else if (defaultHoles[hIdx].index <= adjHandicapB) {
                                      strokesB = 1;
                                    }
                                  }
                                  const grossB = Array.isArray(scores[1]) ? parseInt(scores[1][hIdx], 10) : null;
                                  const netB = grossB !== null && !isNaN(grossB) && grossB > 0 ? grossB - strokesB : null;
                                  function points(net, par) {
                                    if (net == null) return '';
                                    if (net === par - 4) return 6;
                                    if (net === par - 3) return 5;
                                    if (net === par - 2) return 4;
                                    if (net === par - 1) return 3;
                                    if (net === par) return 2;
                                    if (net === par + 1) return 1;
                                    return 0;
                                  }
                                  const ptsA = points(netA, defaultHoles[hIdx].par);
                                  const ptsB = points(netB, defaultHoles[hIdx].par);
                                  const best = ptsA === '' && ptsB === '' ? '' : Math.max(ptsA || 0, ptsB || 0);
                                  if (best !== '') backTotal += best;
                                }
                                return backTotal !== 0 ? backTotal : '';
                              })()}
                            </td>
                            {/* TOTAL (front 9 + back 9) */}
                            <td className="border border-white px-2 py-1 font-bold text-base text-white" style={{ verticalAlign: 'middle', height: '44px' }}>
                              {(() => {
                                // Calculate OUT (front 9) and IN (back 9) using same logic as OUT/IN columns
                                let outTotal = 0;
                                for (let hIdx = 0; hIdx < 9; hIdx++) {
                                  let adjHandicapA = 0;
                                  if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[0]]) {
                                    const fullHandicapA = parseInt(groupForPlayer.handicaps[groupPlayers[0]], 10) || 0;
                                    if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                      adjHandicapA = Math.round(fullHandicapA * Number(competition.handicapallowance) / 100);
                                    } else {
                                      adjHandicapA = fullHandicapA;
                                    }
                                  }
                                  let strokesA = 0;
                                  if (adjHandicapA > 0) {
                                    if (adjHandicapA >= 18) {
                                      strokesA = 1;
                                      if (adjHandicapA - 18 >= defaultHoles[hIdx].index) strokesA = 2;
                                      else if (defaultHoles[hIdx].index <= (adjHandicapA % 18)) strokesA = 2;
                                    } else if (defaultHoles[hIdx].index <= adjHandicapA) {
                                      strokesA = 1;
                                    }
                                  }
                                  const grossA = Array.isArray(scores[0]) ? parseInt(scores[0][hIdx], 10) : null;
                                  const netA = grossA !== null && !isNaN(grossA) && grossA > 0 ? grossA - strokesA : null;
                                  let adjHandicapB = 0;
                                  if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[1]]) {
                                    const fullHandicapB = parseInt(groupForPlayer.handicaps[groupPlayers[1]], 10) || 0;
                                    if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                      adjHandicapB = Math.round(fullHandicapB * Number(competition.handicapallowance) / 100);
                                    } else {
                                      adjHandicapB = fullHandicapB;
                                    }
                                  }
                                  let strokesB = 0;
                                  if (adjHandicapB > 0) {
                                    if (adjHandicapB >= 18) {
                                      strokesB = 1;
                                      if (adjHandicapB - 18 >= defaultHoles[hIdx].index) strokesB = 2;
                                      else if (defaultHoles[hIdx].index <= (adjHandicapB % 18)) strokesB = 2;
                                    } else if (defaultHoles[hIdx].index <= adjHandicapB) {
                                      strokesB = 1;
                                    }
                                  }
                                  const grossB = Array.isArray(scores[1]) ? parseInt(scores[1][hIdx], 10) : null;
                                  const netB = grossB !== null && !isNaN(grossB) && grossB > 0 ? grossB - strokesB : null;
                                  function points(net, par) {
                                    if (net == null) return '';
                                    if (net === par - 4) return 6;
                                    if (net === par - 3) return 5;
                                    if (net === par - 2) return 4;
                                    if (net === par - 1) return 3;
                                    if (net === par) return 2;
                                    if (net === par + 1) return 1;
                                    return 0;
                                  }
                                  const ptsA = points(netA, defaultHoles[hIdx].par);
                                  const ptsB = points(netB, defaultHoles[hIdx].par);
                                  const best = ptsA === '' && ptsB === '' ? '' : Math.max(ptsA || 0, ptsB || 0);
                                  if (best !== '') outTotal += best;
                                }
                                let inTotal = 0;
                                for (let hIdx = 9; hIdx < 18; hIdx++) {
                                  let adjHandicapA = 0;
                                  if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[0]]) {
                                    const fullHandicapA = parseInt(groupForPlayer.handicaps[groupPlayers[0]], 10) || 0;
                                    if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                      adjHandicapA = Math.round(fullHandicapA * Number(competition.handicapallowance) / 100);
                                    } else {
                                      adjHandicapA = fullHandicapA;
                                    }
                                  }
                                  let strokesA = 0;
                                  if (adjHandicapA > 0) {
                                    if (adjHandicapA >= 18) {
                                      strokesA = 1;
                                      if (adjHandicapA - 18 >= defaultHoles[hIdx].index) strokesA = 2;
                                      else if (defaultHoles[hIdx].index <= (adjHandicapA % 18)) strokesA = 2;
                                    } else if (defaultHoles[hIdx].index <= adjHandicapA) {
                                      strokesA = 1;
                                    }
                                  }
                                  const grossA = Array.isArray(scores[0]) ? parseInt(scores[0][hIdx], 10) : null;
                                  const netA = grossA !== null && !isNaN(grossA) && grossA > 0 ? grossA - strokesA : null;
                                  let adjHandicapB = 0;
                                  if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[1]]) {
                                    const fullHandicapB = parseInt(groupForPlayer.handicaps[groupPlayers[1]], 10) || 0;
                                    if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                      adjHandicapB = Math.round(fullHandicapB * Number(competition.handicapallowance) / 100);
                                    } else {
                                      adjHandicapB = fullHandicapB;
                                    }
                                  }
                                  let strokesB = 0;
                                  if (adjHandicapB > 0) {
                                    if (adjHandicapB >= 18) {
                                      strokesB = 1;
                                      if (adjHandicapB - 18 >= defaultHoles[hIdx].index) strokesB = 2;
                                      else if (defaultHoles[hIdx].index <= (adjHandicapB % 18)) strokesB = 2;
                                    } else if (defaultHoles[hIdx].index <= adjHandicapB) {
                                      strokesB = 1;
                                    }
                                  }
                                  const grossB = Array.isArray(scores[1]) ? parseInt(scores[1][hIdx], 10) : null;
                                  const netB = grossB !== null && !isNaN(grossB) && grossB > 0 ? grossB - strokesB : null;
                                  function points(net, par) {
                                    if (net == null) return '';
                                    if (net === par - 4) return 6;
                                    if (net === par - 3) return 5;
                                    if (net === par - 2) return 4;
                                    if (net === par - 1) return 3;
                                    if (net === par) return 2;
                                    if (net === par + 1) return 1;
                                    return 0;
                                  }
                                  const ptsA = points(netA, defaultHoles[hIdx].par);
                                  const ptsB = points(netB, defaultHoles[hIdx].par);
                                  const best = ptsA === '' && ptsB === '' ? '' : Math.max(ptsA || 0, ptsB || 0);
                                  if (best !== '') inTotal += best;
                                }
                                const total = outTotal + inTotal;
                                return total !== 0 ? total : '';
                              })()}
                            </td>
                          </tr>
                        )}

                        {/* Insert B/B Score row after player D's Result row (pIdx === 3) for back 9 */}
                        {pIdx === 3 && groupPlayers.length >= 4 && (
                          <tr key="bb-score-back-cd">
                            <td className="border border-white px-2 py-1" style={{ minWidth: 32 }}></td>
                            <td className="border px-2 py-1 text-base font-bold text-center" style={{ minWidth: 40 }}>B/B Score</td>
                            {defaultHoles.slice(9,18).map((hole, hIdx) => {
                              // ...existing code for C/D logic...
                              let adjHandicapC = 0;
                              if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[2]]) {
                                const fullHandicapC = parseInt(groupForPlayer.handicaps[groupPlayers[2]], 10) || 0;
                                if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                  adjHandicapC = Math.round(fullHandicapC * Number(competition.handicapallowance) / 100);
                                } else {
                                  adjHandicapC = fullHandicapC;
                                }
                              }
                              let strokesC = 0;
                              if (adjHandicapC > 0) {
                                if (adjHandicapC >= 18) {
                                  strokesC = 1;
                                  if (adjHandicapC - 18 >= hole.index) strokesC = 2;
                                  else if (hole.index <= (adjHandicapC % 18)) strokesC = 2;
                                } else if (hole.index <= adjHandicapC) {
                                  strokesC = 1;
                                }
                              }
                              const grossC = Array.isArray(scores[2]) ? parseInt(scores[2][hIdx+9], 10) : null;
                              const netC = grossC !== null && !isNaN(grossC) && grossC > 0 ? grossC - strokesC : null;
                              // Calculate net for D
                              let adjHandicapD = 0;
                              if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[3]]) {
                                const fullHandicapD = parseInt(groupForPlayer.handicaps[groupPlayers[3]], 10) || 0;
                                if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                  adjHandicapD = Math.round(fullHandicapD * Number(competition.handicapallowance) / 100);
                                } else {
                                  adjHandicapD = fullHandicapD;
                                }
                              }
                              let strokesD = 0;
                              if (adjHandicapD > 0) {
                                if (adjHandicapD >= 18) {
                                  strokesD = 1;
                                  if (adjHandicapD - 18 >= hole.index) strokesD = 2;
                                  else if (hole.index <= (adjHandicapD % 18)) strokesD = 2;
                                } else if (hole.index <= adjHandicapD) {
                                  strokesD = 1;
                                }
                              }
                              const grossD = Array.isArray(scores[3]) ? parseInt(scores[3][hIdx+9], 10) : null;
                              const netD = grossD !== null && !isNaN(grossD) && grossD > 0 ? grossD - strokesD : null;
                              function points(net, par) {
                                if (net == null) return '';
                                if (net === par - 4) return 6;
                                if (net === par - 3) return 5;
                                if (net === par - 2) return 4;
                                if (net === par - 1) return 3;
                                if (net === par) return 2;
                                if (net === par + 1) return 1;
                                return 0;
                              }
                              const ptsC = points(netC, hole.par);
                              const ptsD = points(netD, hole.par);
                              const best = ptsC === '' && ptsD === '' ? '' : Math.max(ptsC || 0, ptsD || 0);
                              const bothBlank = (grossC === null && grossD === null);
                              return (
                                <td key={hIdx} className="border border-white py-1 text-center align-middle font-bold text-base text-white" style={{ verticalAlign: 'middle', height: '44px' }}>{bothBlank ? '' : best}</td>
                              );
                            })}
                            {/* In (back 9 total) */}
                            <td className="border border-white px-2 py-1 font-bold text-base text-white" style={{ verticalAlign: 'middle', height: '44px' }}>
                              {(() => {
                                let backTotal = 0;
                                for (let hIdx = 9; hIdx < 18; hIdx++) {
                                  let adjHandicapC = 0;
                                  if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[2]]) {
                                    const fullHandicapC = parseInt(groupForPlayer.handicaps[groupPlayers[2]], 10) || 0;
                                    if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                      adjHandicapC = Math.round(fullHandicapC * Number(competition.handicapallowance) / 100);
                                    } else {
                                      adjHandicapC = fullHandicapC;
                                    }
                                  }
                                  let strokesC = 0;
                                  if (adjHandicapC > 0) {
                                    if (adjHandicapC >= 18) {
                                      strokesC = 1;
                                      if (adjHandicapC - 18 >= defaultHoles[hIdx].index) strokesC = 2;
                                      else if (defaultHoles[hIdx].index <= (adjHandicapC % 18)) strokesC = 2;
                                    } else if (defaultHoles[hIdx].index <= adjHandicapC) {
                                      strokesC = 1;
                                    }
                                  }
                                  const grossC = Array.isArray(scores[2]) ? parseInt(scores[2][hIdx], 10) : null;
                                  const netC = grossC !== null && !isNaN(grossC) && grossC > 0 ? grossC - strokesC : null;
                                  let adjHandicapD = 0;
                                  if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[3]]) {
                                    const fullHandicapD = parseInt(groupForPlayer.handicaps[groupPlayers[3]], 10) || 0;
                                    if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                      adjHandicapD = Math.round(fullHandicapD * Number(competition.handicapallowance) / 100);
                                    } else {
                                      adjHandicapD = fullHandicapD;
                                    }
                                  }
                                  let strokesD = 0;
                                  if (adjHandicapD > 0) {
                                    if (adjHandicapD >= 18) {
                                      strokesD = 1;
                                      if (adjHandicapD - 18 >= defaultHoles[hIdx].index) strokesD = 2;
                                      else if (defaultHoles[hIdx].index <= (adjHandicapD % 18)) strokesD = 2;
                                    } else if (defaultHoles[hIdx].index <= adjHandicapD) {
                                      strokesD = 1;
                                    }
                                  }
                                  const grossD = Array.isArray(scores[3]) ? parseInt(scores[3][hIdx], 10) : null;
                                  const netD = grossD !== null && !isNaN(grossD) && grossD > 0 ? grossD - strokesD : null;
                                  function points(net, par) {
                                    if (net == null) return '';
                                    if (net === par - 4) return 6;
                                    if (net === par - 3) return 5;
                                    if (net === par - 2) return 4;
                                    if (net === par - 1) return 3;
                                    if (net === par) return 2;
                                    if (net === par + 1) return 1;
                                    return 0;
                                  }
                                  const ptsC = points(netC, defaultHoles[hIdx].par);
                                  const ptsD = points(netD, defaultHoles[hIdx].par);
                                  const best = ptsC === '' && ptsD === '' ? '' : Math.max(ptsC || 0, ptsD || 0);
                                  if (best !== '') backTotal += best;
                                }
                                return backTotal !== 0 ? backTotal : '';
                              })()}
                            </td>
                            {/* TOTAL (front 9 + back 9) */}
                            <td className="border border-white px-2 py-1 font-bold text-base text-white" style={{ verticalAlign: 'middle', height: '44px' }}>
                              {(() => {
                                let frontTotal = 0;
                                for (let hIdx = 0; hIdx < 9; hIdx++) {
                                  let adjHandicapC = 0;
                                  if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[2]]) {
                                    const fullHandicapC = parseInt(groupForPlayer.handicaps[groupPlayers[2]], 10) || 0;
                                    if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                      adjHandicapC = Math.round(fullHandicapC * Number(competition.handicapallowance) / 100);
                                    } else {
                                      adjHandicapC = fullHandicapC;
                                    }
                                  }
                                  let strokesC = 0;
                                  if (adjHandicapC > 0) {
                                    if (adjHandicapC >= 18) {
                                      strokesC = 1;
                                      if (adjHandicapC - 18 >= defaultHoles[hIdx].index) strokesC = 2;
                                      else if (defaultHoles[hIdx].index <= (adjHandicapC % 18)) strokesC = 2;
                                    } else if (defaultHoles[hIdx].index <= adjHandicapC) {
                                      strokesC = 1;
                                    }
                                  }
                                  const grossC = Array.isArray(scores[2]) ? parseInt(scores[2][hIdx], 10) : null;
                                  const netC = grossC !== null && !isNaN(grossC) && grossC > 0 ? grossC - strokesC : null;
                                  let adjHandicapD = 0;
                                  if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[3]]) {
                                    const fullHandicapD = parseInt(groupForPlayer.handicaps[groupPlayers[3]], 10) || 0;
                                    if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                      adjHandicapD = Math.round(fullHandicapD * Number(competition.handicapallowance) / 100);
                                    } else {
                                      adjHandicapD = fullHandicapD;
                                    }
                                  }
                                  let strokesD = 0;
                                  if (adjHandicapD > 0) {
                                    if (adjHandicapD >= 18) {
                                      strokesD = 1;
                                      if (adjHandicapD - 18 >= defaultHoles[hIdx].index) strokesD = 2;
                                      else if (defaultHoles[hIdx].index <= (adjHandicapD % 18)) strokesD = 2;
                                    } else if (defaultHoles[hIdx].index <= adjHandicapD) {
                                      strokesD = 1;
                                    }
                                  }
                                  const grossD = Array.isArray(scores[3]) ? parseInt(scores[3][hIdx], 10) : null;
                                  const netD = grossD !== null && !isNaN(grossD) && grossD > 0 ? grossD - strokesD : null;
                                  function points(net, par) {
                                    if (net == null) return '';
                                    if (net === par - 4) return 6;
                                    if (net === par - 3) return 5;
                                    if (net === par - 2) return 4;
                                    if (net === par - 1) return 3;
                                    if (net === par) return 2;
                                    if (net === par + 1) return 1;
                                    return 0;
                                  }
                                  const ptsC = points(netC, defaultHoles[hIdx].par);
                                  const ptsD = points(netD, defaultHoles[hIdx].par);
                                  const best = ptsC === '' && ptsD === '' ? '' : Math.max(ptsC || 0, ptsD || 0);
                                  if (best !== '') frontTotal += best;
                                }
                                let backTotal = 0;
                                for (let hIdx = 9; hIdx < 18; hIdx++) {
                                  let adjHandicapC = 0;
                                  if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[2]]) {
                                    const fullHandicapC = parseInt(groupForPlayer.handicaps[groupPlayers[2]], 10) || 0;
                                    if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                      adjHandicapC = Math.round(fullHandicapC * Number(competition.handicapallowance) / 100);
                                    } else {
                                      adjHandicapC = fullHandicapC;
                                    }
                                  }
                                  let strokesC = 0;
                                  if (adjHandicapC > 0) {
                                    if (adjHandicapC >= 18) {
                                      strokesC = 1;
                                      if (adjHandicapC - 18 >= defaultHoles[hIdx].index) strokesC = 2;
                                      else if (defaultHoles[hIdx].index <= (adjHandicapC % 18)) strokesC = 2;
                                    } else if (defaultHoles[hIdx].index <= adjHandicapC) {
                                      strokesC = 1;
                                    }
                                  }
                                  const grossC = Array.isArray(scores[2]) ? parseInt(scores[2][hIdx], 10) : null;
                                  const netC = grossC !== null && !isNaN(grossC) && grossC > 0 ? grossC - strokesC : null;
                                  let adjHandicapD = 0;
                                  if (groupForPlayer && groupForPlayer.handicaps && groupForPlayer.handicaps[groupPlayers[3]]) {
                                    const fullHandicapD = parseInt(groupForPlayer.handicaps[groupPlayers[3]], 10) || 0;
                                    if (competition.handicapallowance && !isNaN(Number(competition.handicapallowance))) {
                                      adjHandicapD = Math.round(fullHandicapD * Number(competition.handicapallowance) / 100);
                                    } else {
                                      adjHandicapD = fullHandicapD;
                                    }
                                  }
                                  let strokesD = 0;
                                  if (adjHandicapD > 0) {
                                    if (adjHandicapD >= 18) {
                                      strokesD = 1;
                                      if (adjHandicapD - 18 >= defaultHoles[hIdx].index) strokesD = 2;
                                      else if (defaultHoles[hIdx].index <= (adjHandicapD % 18)) strokesD = 2;
                                    } else if (defaultHoles[hIdx].index <= adjHandicapD) {
                                      strokesD = 1;
                                    }
                                  }
                                  const grossD = Array.isArray(scores[3]) ? parseInt(scores[3][hIdx], 10) : null;
                                  const netD = grossD !== null && !isNaN(grossD) && grossD > 0 ? grossD - strokesD : null;
                                  function points(net, par) {
                                    if (net == null) return '';
                                    if (net === par - 4) return 6;
                                    if (net === par - 3) return 5;
                                    if (net === par - 2) return 4;
                                    if (net === par - 1) return 3;
                                    if (net === par) return 2;
                                    if (net === par + 1) return 1;
                                    return 0;
                                  }
                                  const ptsC = points(netC, defaultHoles[hIdx].par);
                                  const ptsD = points(netD, defaultHoles[hIdx].par);
                                  const best = ptsC === '' && ptsD === '' ? '' : Math.max(ptsC || 0, ptsD || 0);
                                  if (best !== '') backTotal += best;
                                }
                                const total = frontTotal + backTotal;
                                return total !== 0 ? total : '';
                              })()}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {showResetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                  <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center border-4 border-[#FFD700]">
                    <div className="flex flex-col items-center mb-4">
                      <span className="text-5xl mb-2" role="img" aria-label="Warning">⚠️</span>
                      <h2 className="text-3xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>Reset Scorecard?</h2>
                    </div>
                    <p className="mb-6 text-white text-center text-base font-medium" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>This will <span className='font-bold' style={{ color: '#FFD700' }}>permanently clear all gross scores for all players</span> in this group.<br/>This action cannot be undone.<br/><br/>Are you sure you want to reset?</p>
                    <div className="flex gap-4 w-full justify-center">
                      <button
                        className="px-5 py-2 rounded-2xl font-bold shadow border border-white transition text-lg"
                        style={{ backgroundColor: '#888', color: 'white', fontFamily: 'Lato, Arial, sans-serif' }}
                        onClick={() => setShowResetModal(false)}
                      >
                        Cancel
                      </button>
                      <button
                        className="px-5 py-2 rounded-2xl font-bold shadow border border-white transition text-lg"
                        style={{ backgroundColor: '#FFD700', color: '#002F5F', fontFamily: 'Lato, Arial, sans-serif', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                        onMouseOver={e => e.currentTarget.style.backgroundColor = '#ffe066'}
                        onMouseOut={e => e.currentTarget.style.backgroundColor = '#FFD700'}
                        onClick={async () => {
                          await handleResetScorecard();
                          setShowResetModal(false);
                        }}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      )}
    </PageBackground>
  );
}