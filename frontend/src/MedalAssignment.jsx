import React, { useEffect, useState } from 'react';
import PageBackground from './PageBackground';
import { useNavigate, useParams } from 'react-router-dom';

export default function MedalAssignment(props) {
  const params = useParams();
  const navigate = useNavigate();
  // Fallback logic for compId
  const compId = props.compId || params.id || props.competition?.id;
  const [comp, setComp] = useState(null);
  const [groups, setGroups] = useState([]);
  const [availablePlayers, setAvailablePlayers] = useState([]); // Will be fetched
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch comp info on mount
  useEffect(() => {
    if (!compId) return;
    fetch(`/api/competitions/${compId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setComp(data);
          setGroups(Array.isArray(data.groups) ? data.groups : []);
        }
      });
  }, [compId]);

  // Fetch real player list from backend
  useEffect(() => {
    fetch('/api/users')
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
  }

  // Helper: update a group
  function updateGroup(idx, field, value) {
    setGroups(prev => prev.map((g, i) => i === idx ? { ...g, [field]: value } : g));
  }

  // Helper: assign player to group
  function assignPlayer(groupIdx, playerIdx, playerName) {
    setGroups(prev => prev.map((g, i) => {
      if (i !== groupIdx) return g;
      const newPlayers = [...g.players];
      newPlayers[playerIdx] = playerName;
      return { ...g, players: newPlayers };
    }));
  }

  // Helper: set tee time
  function setTeeTime(groupIdx, teeTime) {
    setGroups(prev => prev.map((g, i) => i === groupIdx ? { ...g, teeTime } : g));
  }

  // Helper: remove group
  function removeGroup(idx) {
    setGroups(prev => prev.filter((_, i) => i !== idx));
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
      const res = await fetch(`/api/competitions/${compIdInt}/groups`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups })
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
     
      
  <div className="max-w-4xl w-full h-screen flex flex-col justify-start bg-[#002F5F] shadow-2xl p-8 border-4 border-[#FFD700] text-white" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>
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
                {Array.from({ length: 4 }).map((_, pIdx) => (
                  <select
                    key={pIdx}
                    className="border border-white bg-transparent text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white"
                    style={{ fontFamily: 'Lato, Arial, sans-serif', color: '#FFD700', fontWeight: 700 }}
                    value={group.players[pIdx] || ''}
                    onChange={e => assignPlayer(idx, pIdx, e.target.value)}
                    required
                  >
                    <option value="" style={{ color: '#1B3A6B', fontWeight: 700 }}>Select player</option>
                    {getUnassignedPlayers().concat(group.players[pIdx] ? [group.players[pIdx]] : []).filter((v, i, arr) => arr.indexOf(v) === i).map(p => (
                      <option key={p} value={p} style={{ color: '#1B3A6B', fontWeight: 700 }}>{p}</option>
                    ))}
                  </select>
                ))}
              </div>
              <button
                className="mt-2 px-4 py-1 rounded bg-red-700 text-white font-bold"
                onClick={() => removeGroup(idx)}
                disabled={groups.length <= 1}
              >Remove Group</button>
            </div>
          ))}
          <button
            className="w-full py-2 px-4 mt-2 rounded-2xl font-bold shadow border border-white transition text-lg"
            style={{ backgroundColor: '#FFD700', color: '#002F5F', fontFamily: 'Lato, Arial, sans-serif', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
            onClick={addGroup}
          >{groups.length === 0 ? 'Add A Tee Time' : 'Add Another Tee Time'}</button>
          <button
            className="w-full py-2 px-4 mt-4 rounded-2xl font-bold shadow border border-white transition text-lg"
            style={{ backgroundColor: '#1B3A6B', color: 'white', fontFamily: 'Lato, Arial, sans-serif', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
            onClick={handleSave}
            disabled={saving}
          >{saving ? 'Saving...' : 'Save & Continue'}</button>
        </div>
      
    </PageBackground>
  );
}
