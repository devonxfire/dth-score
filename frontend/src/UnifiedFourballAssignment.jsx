import React, { useEffect, useState } from 'react';
import { apiUrl } from './api';
import PageBackground from './PageBackground';
import { useNavigate, useParams } from 'react-router-dom';

// Reference member names from backend/seedMembers.js
const MEMBER_NAMES = [
  "Andy 'Panda' Williams",
  "Arno 'Ah No' Erasmus",
  "Brent 'Sally' Lyall",
  "Brian 'Grizzly' Galloway",
  "Byron 'Mullet' Mulholland",
  "Dave 'Big D' Alhadeff",
  "David 'Smasher' Dyer",
  "Denzil 'Takke' Burger",
  "Devon 'Radar' Haantjes",
  "Dev 'Tugger' Martindale",
  "Eddie 'Mega' Scholtz",
  "Gary 'Chips' Mulder",
  "Graeme 'Knotty' Knott",
  "Jason 'Jay-Boy' Horn",
  "Jeremy 'Garmin' Park",
  "Jon 'Leak' Horn",
  "Mike 'Jabba' Downie",
  "Nigel 'Slumpy' Martindale",
  "Hannes 'Jigsaw' Marais",
  "Paul 'Boskak' Verney",
  "Stephen 'Skollie' Kelly",
  "Stevie 'Wondie' Steenkamp",
  "Storm 'Beefy' Currie",
  "Guest 1",
  "Guest 2",
  "Guest 3"
];

export default function UnifiedFourballAssignment(props) {
  const params = useParams();
  const navigate = useNavigate();
  
  // Fallback logic for compId and competitionType
  const compId = props.compId || params.id || props.competition?.id;
  const competitionType = props.competitionType || props.competition?.type || 'fourball';
  
  const [comp, setComp] = useState(null);
  const [groups, setGroups] = useState(() => {
    if (props.initialGroups && props.initialGroups.length > 0) {
      return props.initialGroups;
    }
    return [{ players: Array(4).fill(''), teeTime: '', displayNames: Array(4).fill('') }];
  });
  const [availablePlayers, setAvailablePlayers] = useState([]);
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

  const [showOCR, setShowOCR] = useState(false);

  // Handler for names extracted from OCR
  const MANUAL_ALIASES = {
    dad: "Nigel 'Slumpy' Martindale",
    arno: "Arno 'Ah No' Erasmus",
    teapot: "Arno 'Ah No' Erasmus",
    panda: "Andy 'Panda' Williams",
    andy: "Andy 'Panda' Williams",
    "brett m": "Brent 'Sally' Lyall",
    brett: "Brent 'Sally' Lyall",
    gary: "Gary 'Chips' Mulder",
    ed: "Eddie 'Mega' Scholtz",
    eddie: "Eddie 'Mega' Scholtz",
  };

  function stripEmojisAndSpecial(str) {
    // Remove emojis and most non-letter chars
    return str.replace(/[^\p{L}\s'-]/gu, '').trim();
  }

  function findAlias(cleaned) {
    // Try full cleaned string, then each word
    const norm = s => s.toLowerCase().replace(/[^a-z]/g, '');
    const cleanedNorm = norm(cleaned);
    if (MANUAL_ALIASES[cleanedNorm]) return MANUAL_ALIASES[cleanedNorm];
    const words = cleaned.split(/\s+/);
    for (const word of words) {
      const wNorm = norm(word);
      if (MANUAL_ALIASES[wNorm]) return MANUAL_ALIASES[wNorm];
    }
    return null;
  }

  function findClosestName(input, candidates = MEMBER_NAMES) {
    if (!input || !candidates || !candidates.length) return input;
    let cleaned = stripEmojisAndSpecial(input);
    let alias = findAlias(cleaned);
    if (alias) return alias;
    // Try again with lowercased
    alias = findAlias(cleaned.toLowerCase());
    if (alias) return alias;

    // Try unique first-name match
    const norm = s => s.toLowerCase().replace(/[^a-z]/g, '');
    const inputNorm = norm(cleaned);
    const inputFirst = inputNorm.split(/[^a-z]/)[0];
    if (inputFirst) {
      // Find all members whose first name matches
      const matches = candidates.filter(cand => {
        const candFirst = norm(cand).split(/[^a-z]/)[0];
        return candFirst === inputFirst;
      });
      if (matches.length === 1) return matches[0];
    }

    // Fallback: fuzzy match
    let best = candidates[0];
    let bestScore = 0;
    for (const cand of candidates) {
      const candNorm = norm(cand);
      let score = 0;
      if (candNorm === inputNorm) score += 100;
      if (candNorm.includes(inputNorm) || inputNorm.includes(candNorm)) score += 50;
      // Allow first-name-only match
      const candFirst = candNorm.split(/[^a-z]/)[0];
      if (candFirst && inputNorm && candFirst === inputNorm) score += 40;
      // Count matching chars
      for (let i = 0; i < Math.min(inputNorm.length, candNorm.length); i++) {
        if (inputNorm[i] === candNorm[i]) score++;
      }
      if (score > bestScore) {
        best = cand;
        bestScore = score;
      }
    }
    // Only return if some reasonable match
    return bestScore > 0 ? best : input;
  }

  function handleNamesFromOCR(names) {
    setShowOCR(false);
    if (!Array.isArray(names) || !names.length) return;
    // Track assigned members to avoid duplicates
    const assigned = new Set();
    function matchName(nm) {
      // Remove all special characters, keep only letters and spaces
      let cleaned = (nm || '').replace(/[^a-zA-Z\s]/g, '').trim();
      if (!cleaned) return '';
      // Try alias first
      let alias = findAlias(cleaned) || findAlias(cleaned.toLowerCase());
      if (alias && MEMBER_NAMES.includes(alias) && !assigned.has(alias)) {
        assigned.add(alias);
        return alias;
      }
      // Extract first word (first name)
      const firstName = cleaned.split(/\s+/)[0].toLowerCase();
      if (!firstName) return '';
      // Find all members whose first name matches
      const norm = s => s.toLowerCase().replace(/[^a-z]/g, '');
      const matches = MEMBER_NAMES.filter(cand => {
        const candFirst = norm(cand).split(/[^a-z]/)[0];
        return candFirst === firstName;
      });
      if (matches.length === 1 && !assigned.has(matches[0])) {
        assigned.add(matches[0]);
        return matches[0];
      }
      // If not unique, leave blank
      return '';
    }
    const groupsFromOCR = [];
    for (let i = 0; i < names.length; i += 4) {
      const groupNames = names.slice(i, i + 4).map(matchName);
      groupsFromOCR.push({ players: groupNames, teeTime: '', displayNames: Array(4).fill('') });
    }
    setGroups(groupsFromOCR);
    setGuestNames(groupsFromOCR.map(() => Array(4).fill('')));
  }

  // Fetch comp info on mount
  useEffect(() => {
    if (!compId) return;
    fetch(apiUrl(`/api/competitions/${compId}`))
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setComp(data);
          if (Array.isArray(data.groups) && data.groups.length > 0) {
            setGroups(data.groups.map(g => ({
              ...g,
              players: (g.players || []).concat(Array(4).fill('')).slice(0, 4)
            })));
          }
        }
      });
  }, [compId]);

  // Fetch available players
  useEffect(() => {
    fetch(apiUrl('/api/users'))
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          setAvailablePlayers(data.map(u => u.name));
        }
      });
  }, []);

  function addGroup() {
    setGroups(prev => [...prev, { players: Array(4).fill(''), teeTime: '', displayNames: Array(4).fill('') }]);
    setGuestNames(prev => [...prev, Array(4).fill('')]);
  }

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
      const allAssigned = groups.flatMap(g => g.players).filter(Boolean);
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

  function setTeeTime(groupIdx, teeTime) {
    setGroups(prev => prev.map((g, i) => i === groupIdx ? { ...g, teeTime } : g));
  }

  function removeGroup(idx) {
    setGroups(prev => prev.filter((_, i) => i !== idx));
    setGuestNames(prev => prev.filter((_, i) => i !== idx));
  }

  function getRandomTeeTime() {
    const hour = Math.floor(Math.random() * (16 - 7 + 1)) + 7;
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
      const allNames = users
        .filter(u => !u.isadmin)
        .map(u => u.name || u.username || u.id)
        .filter(Boolean)
        .filter(n => !/^guest/i.test(n));
      const otherAssigned = groups.flatMap((g, i) => i === idx ? [] : (Array.isArray(g.players) ? g.players : [])).filter(Boolean);
      let candidates = allNames.filter(n => !otherAssigned.includes(n));
      if (candidates.length < 4) candidates = allNames.slice();
      
      // Shuffle
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
      console.error('Randomize failed:', e);
    }
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    
    // Attach displayNames to each group
    const groupsWithDisplay = groups.map((g, i) => ({ 
      ...g, 
      displayNames: guestNames[i] || [],
      players: (g.players || []).filter(Boolean) // Remove empty slots for validation
    }));
    
    // Validation
    for (const g of groupsWithDisplay) {
      if (!Array.isArray(g.players) || g.players.length !== 4) {
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
    
    // Re-add empty slots for consistent array structure
    const groupsToSave = groupsWithDisplay.map(g => ({
      ...g,
      players: g.players.concat(Array(4).fill('')).slice(0, 4)
    }));
    
    try {
      // If using callback pattern (for legacy Fourball), call onAssign
      if (props.onAssign && typeof props.onAssign === 'function') {
        props.onAssign(groupsToSave);
        setSaving(false);
        return;
      }
      
      // Otherwise, save directly to backend - need valid compId
      const compIdInt = Number(compId);
      if (!compIdInt || isNaN(compIdInt)) {
        setError('Competition ID is missing or invalid.');
        setSaving(false);
        return;
      }
      
      const res = await fetch(apiUrl(`/api/competitions/${compIdInt}/groups`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups: groupsToSave })
      });
      
      if (!res.ok) {
        const errText = await res.text();
        setError('Failed to save groups: ' + errText);
        setSaving(false);
        return;
      }
      
      // Navigate based on competition type
      const normalizedType = (competitionType || '').toLowerCase().replace(/[_\s-]+/g, '');
      if (normalizedType.includes('alliance')) {
        navigate(`/scorecard-alliance/${compIdInt}`);
      } else if (normalizedType.includes('medal')) {
        navigate(`/scorecard-medal/${compIdInt}`);
      } else {
        // Default to fourball
        navigate(`/scorecard-fourball/${compIdInt}`);
      }
    } catch (e) {
      setError('Failed to save groups: ' + (e.message || 'Unknown error'));
      setSaving(false);
    }
  }

  function getUnassignedPlayers() {
    const assigned = groups.flatMap(g => g.players).filter(Boolean);
    return availablePlayers.filter(p => !assigned.includes(p));
  }

  // Get title based on competition type
  const getTitle = () => {
    const normalizedType = (competitionType || '').toLowerCase().replace(/[_\s-]+/g, '');
    if (normalizedType.includes('alliance')) return 'Alliance Competition: 4 Ball Assignment';
    if (normalizedType.includes('medal')) return 'Medal Competition: 4 Ball Assignment';
    return '4 Ball Assignment';
  };

  const content = (
    <div className="w-full mx-auto" style={{ maxWidth: props.nested ? '100%' : '1024px' }}>
      <div className="w-full rounded-2xl shadow-lg p-8 flex flex-col gap-6 border-4 border-[#FFD700] text-white" style={{ fontFamily: 'Lato, Arial, sans-serif', background: 'rgba(0,47,95,0.95)', boxShadow: '0 2px 8px 0 rgba(0,47,95,0.10)' }}>
        <h1 className="text-2xl md:text-4xl font-extrabold drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>
          {getTitle()}
        </h1>
        <div className="mx-auto" style={{height: '2px', maxWidth: 340, width: '100%', background: 'white', opacity: 0.7, borderRadius: 2}}></div>

        {error && <div className="text-red-300 mb-2 font-semibold">{error}</div>}
        
        {groups.map((group, idx) => (
          <div key={idx} className="mb-6 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.3)' }}>
            <div className="mb-2 font-extrabold" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', fontSize: '1.2rem' }}>4 Ball {idx + 1}</div>
            <div className="mb-2">
              <label className="block mb-1 font-bold" htmlFor={`teeTime-${idx}`} style={{ color: '#FFD700', fontFamily: 'Lato, Arial, sans-serif' }}>Tee Time</label>
              <input
                id={`teeTime-${idx}`}
                type="time"
                value={group.teeTime || ''}
                onChange={e => setTeeTime(idx, e.target.value)}
                className="border border-white bg-transparent rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white"
                style={{ fontFamily: 'Lato, Arial, sans-serif', color: '#FFD700' }}
                required
              />
            </div>
            <div className="flex flex-col gap-2 mt-2">
              {Array.from({ length: 4 }).map((_, pIdx) => {
                const player = group.players[pIdx] || '';
                return (
                  <div key={pIdx} className="flex flex-col gap-1">
                    <select
                      className="border border-white text-white rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white"
                      style={{ fontFamily: 'Lato, Arial, sans-serif', color: '#FFD700', fontWeight: 700, background: '#0e3764' }}
                      value={player}
                      onChange={e => assignPlayer(idx, pIdx, e.target.value)}
                      required
                    >
                      <option value="" style={{ color: '#1B3A6B', fontWeight: 700, background: '#fff' }}>Select player</option>
                      <option value="GUEST" style={{ color: '#1B3A6B', fontWeight: 700, background: '#fff' }}>Guest</option>
                      {getUnassignedPlayers().concat(player ? [player] : []).filter((v, i, arr) => arr.indexOf(v) === i).map(p => (
                        <option key={p} value={p} style={{ color: '#1B3A6B', fontWeight: 700, background: '#fff' }}>{p}</option>
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
            <div className="flex gap-2 mt-2">
              <button
                className="px-4 py-2 rounded bg-red-700 text-white font-bold"
                onClick={() => removeGroup(idx)}
                disabled={groups.length <= 1}
              >
                Remove Group
              </button>
              <button
                className="px-4 py-2 rounded bg-gray-600 text-white font-bold"
                onClick={() => {
                  setGroups(prev => prev.map((g, i) => {
                    if (i !== idx) return g;
                    const shuffled = [...(g.players || [])];
                    for (let j = shuffled.length - 1; j > 0; j--) {
                      const k = Math.floor(Math.random() * (j + 1));
                      [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
                    }
                    return { ...g, players: shuffled };
                  }));
                }}
              >
                Shuffle
              </button>
              <button
                className="px-4 py-2 rounded bg-blue-600 text-white font-bold"
                onClick={() => randomizeGroup(idx)}
              >
                Randomise
              </button>
            </div>
          </div>
        ))}
        
        {/* ...existing code... */}
        <button
          className="w-full py-3 px-4 mt-2 rounded-2xl font-bold shadow border border-white transition text-lg"
          style={{ backgroundColor: '#FFD700', color: '#002F5F', fontFamily: 'Lato, Arial, sans-serif', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
          onClick={addGroup}
        >
          {groups.length === 0 ? 'Add A Tee Time' : 'Add Another Tee Time'}
        </button>
        <button
          className="w-full py-3 px-4 mt-4 rounded-2xl font-bold shadow border border-white transition text-lg"
          style={{ backgroundColor: '#1B3A6B', color: 'white', fontFamily: 'Lato, Arial, sans-serif', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save & Continue'}
        </button>
        <button
          className="w-full py-3 px-4 mt-4 rounded-2xl font-bold shadow border border-white transition text-lg"
          style={{ backgroundColor: '#2563eb', color: 'white', fontFamily: 'Lato, Arial, sans-serif', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
          onClick={() => {
            setGroups([{ players: Array(4).fill(''), teeTime: '', displayNames: Array(4).fill('') }]);
            setGuestNames([Array(4).fill('')]);
          }}
        >
          Reset All
        </button>
      </div>
    </div>
  );

  return props.nested ? content : <PageBackground hideFooter>{content}</PageBackground>;
}
