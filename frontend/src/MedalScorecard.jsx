import React, { useEffect, useState, useRef } from 'react';
import PageBackground from './PageBackground';
import TopMenu from './TopMenu';
import { useParams, useNavigate } from 'react-router-dom';

const defaultHoles = [
  { number: 1, par: 4, index: 5 }, { number: 2, par: 4, index: 7 }, { number: 3, par: 3, index: 17 }, { number: 4, par: 5, index: 1 }, { number: 5, par: 4, index: 11 },
  { number: 6, par: 3, index: 15 }, { number: 7, par: 5, index: 3 }, { number: 8, par: 4, index: 13 }, { number: 9, par: 4, index: 9 }, { number: 10, par: 4, index: 10 },
  { number: 11, par: 4, index: 4 }, { number: 12, par: 4, index: 12 }, { number: 13, par: 5, index: 2 }, { number: 14, par: 4, index: 14 }, { number: 15, par: 3, index: 18 },
  { number: 16, par: 5, index: 6 }, { number: 17, par: 3, index: 16 }, { number: 18, par: 4, index: 8 }
];
const playerColors = [
  'bg-blue-100 text-blue-900',
  'bg-green-100 text-green-900',
  'bg-yellow-100 text-yellow-900',
  'bg-pink-100 text-pink-900'
];

export default function MedalScorecard(props) {
  // ...existing code...
  // Tee Box/Handicap modal bypass: always show scorecard, modal logic enforced
  // Modal logic removed: always render scorecard UI
  const params = useParams();
  const navigate = useNavigate();
  const compId = params.id;
  const [comp, setComp] = useState(null);
  const [groups, setGroups] = useState([]);
  const [groupIdx, setGroupIdx] = useState(0);
  const [players, setPlayers] = useState([]);
  const [playerData, setPlayerData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState({});
  const [miniTableStats, setMiniTableStats] = useState({});
  const watersTimeoutRef = useRef(null);
  const [showWatersPopup, setShowWatersPopup] = useState(false);
  const [watersPlayer, setWatersPlayer] = useState(null);
  const [showDogPopup, setShowDogPopup] = useState(false);
  const [dogPlayer, setDogPlayer] = useState(null);

  // Fetch comp info and groups
  useEffect(() => {
    if (!compId) return;
    setLoading(true);
    fetch(`/api/competitions/${compId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setComp(data);
          setGroups(Array.isArray(data.groups) ? data.groups : []);
          if (Array.isArray(data.groups) && data.groups.length > 0) {
            setPlayers(data.groups[groupIdx]?.players || []);
          }
        }
        setLoading(false);
      });
  }, [compId, groupIdx]);

  // Fetch player data for current group (always trust backend)
  useEffect(() => {
    if (!compId || !groups.length) return;
    let cancelled = false;
    async function fetchAllScores() {
      const group = groups[groupIdx];
      if (!group || !Array.isArray(group.players)) return;
      const newData = {};
      const newMiniStats = {};
      for (const name of group.players) {
        const res = await fetch(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`);
        if (res.ok) {
          const data = await res.json();
          newData[name] = {
            teebox: data.teebox ?? '',
            handicap: data.handicap ?? '',
            scores: Array.isArray(data.scores) ? data.scores.map(v => v == null ? '' : v) : Array(18).fill('')
          };
          newMiniStats[name] = {
            waters: data.waters ?? '',
            dog: !!data.dog,
            twoClubs: data.two_clubs ?? ''
          };
        } else {
          newData[name] = { teebox: '', handicap: '', scores: Array(18).fill('') };
          newMiniStats[name] = { waters: '', dog: false, twoClubs: '' };
        }
      }
      if (!cancelled) {
        setPlayers(group.players);
        setPlayerData(newData);
        setMiniTableStats(newMiniStats);
      }
    }
    fetchAllScores();
    return () => { cancelled = true; };
  }, [compId, groups, groupIdx]);

  // Fetch mini table stats for all players
  useEffect(() => {
    async function fetchStats() {
      if (!players.length) return;
      const stats = {};
      for (const name of players) {
        try {
          const res = await fetch(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`);
          if (res.ok) {
            const data = await res.json();
            stats[name] = {
              waters: data.waters ?? '',
              dog: !!data.dog,
              twoClubs: data.two_clubs ?? ''
            };
          } else {
            stats[name] = { waters: '', dog: false, twoClubs: '' };
          }
        } catch {
          stats[name] = { waters: '', dog: false, twoClubs: '' };
        }
      }
      setMiniTableStats(stats);
    }
    fetchStats();
  }, [players, compId, groupIdx]);

  // Save player data
  async function handleSavePlayer(name) {
    setSaving(prev => ({ ...prev, [name]: true }));
    setError('');
    const data = playerData[name];
    const mini = miniTableStats[name] || {};
    try {
      console.log('Saving player:', name, { teebox: data.teebox, handicap: data.handicap, scores: data.scores, waters: mini.waters, dog: mini.dog, two_clubs: mini.twoClubs });
      const res = await fetch(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teebox: data.teebox,
          handicap: data.handicap,
          scores: data.scores,
          waters: mini.waters ?? '',
          dog: mini.dog ?? false,
          two_clubs: mini.twoClubs ?? ''
        })
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error('Save failed:', errText);
        throw new Error('Failed to save: ' + errText);
      }
      console.log('Save successful for', name);
    } catch (e) {
      setError('Failed to save for ' + name + ': ' + (e.message || e));
      console.error('Save error:', e);
    } finally {
      setSaving(prev => ({ ...prev, [name]: false }));
    }
  }

  function handleChange(name, field, value) {
    setPlayerData(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        [field]: value
      }
    }));
  }

  // Birdie/Eagle/Blowup popup state
  const [showBirdie, setShowBirdie] = useState(false);
  const [birdieHole, setBirdieHole] = useState(null);
  const [birdiePlayer, setBirdiePlayer] = useState(null);
  const birdieTimeoutRef = useRef(null);
  const [showEagle, setShowEagle] = useState(false);
  const [eagleHole, setEagleHole] = useState(null);
  const [eaglePlayer, setEaglePlayer] = useState(null);
  const eagleTimeoutRef = useRef(null);
  const [showBlowup, setShowBlowup] = useState(false);
  const [blowupHole, setBlowupHole] = useState(null);
  const [blowupPlayer, setBlowupPlayer] = useState(null);
  const blowupTimeoutRef = useRef(null);

  async function handleScoreChange(name, idx, value) {
    setPlayerData(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        scores: prev[name].scores.map((v, i) => i === idx ? value : v)
      }
    }));
    // Birdie/Eagle/Blowup detection logic
    const gross = parseInt(value, 10);
    const hole = defaultHoles[idx];
    if (gross > 0 && hole) {
      if (gross === hole.par - 2) {
        setEagleHole(hole.number);
        setEaglePlayer(name);
        setShowEagle(true);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
        if (eagleTimeoutRef.current) clearTimeout(eagleTimeoutRef.current);
        eagleTimeoutRef.current = setTimeout(() => setShowEagle(false), 30000);
      } else if (gross === hole.par - 1) {
        setBirdieHole(hole.number);
        setBirdiePlayer(name);
        setShowBirdie(true);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        if (birdieTimeoutRef.current) clearTimeout(birdieTimeoutRef.current);
        birdieTimeoutRef.current = setTimeout(() => setShowBirdie(false), 30000);
      } else if (gross >= hole.par + 3) {
        setBlowupHole(hole.number);
        setBlowupPlayer(name);
        setShowBlowup(true);
        if (navigator.vibrate) navigator.vibrate([400, 100, 400]);
        if (blowupTimeoutRef.current) clearTimeout(blowupTimeoutRef.current);
        blowupTimeoutRef.current = setTimeout(() => setShowBlowup(false), 30000);
      }
    }
    // Save scores for this player immediately
    if (!compId || !groups.length) return;
    const group = groups[groupIdx];
    if (!group || !Array.isArray(group.players)) return;
    try {
      const res = await fetch(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scores: playerData[name].scores.map((v, i) => i === idx ? value : v)
        })
      });
      if (!res.ok) {
        const errText = await res.text();
        setError('Failed to save for ' + name + ': ' + errText);
      }
    } catch (err) {
      setError('Failed to save for ' + name + ': ' + (err.message || err));
    }
  }

  // ...existing code...

  async function handleMiniTableChange(name, field, value) {
    if (field === 'dog' && value) {
      // Only allow one player to have the dog
      setMiniTableStats(prev => {
        const updated = { ...prev };
        for (const player of players) {
          updated[player] = {
            ...updated[player],
            dog: player === name
          };
        }
        return updated;
      });
      // Persist dog=false for all others, dog=true for selected
      if (!compId || !groups.length) return;
      try {
        for (const player of players) {
          const patchBody = { dog: player === name };
          await fetch(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(player)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patchBody)
          });
        }
      } catch (err) {
        setError('Failed to save dog for group: ' + (err.message || err));
      }
      setDogPlayer(name);
      setShowDogPopup(true);
      if (watersTimeoutRef.current) clearTimeout(watersTimeoutRef.current);
      watersTimeoutRef.current = setTimeout(() => setShowDogPopup(false), 30000);
      return;
    }
    // Normal update for other fields
    setMiniTableStats(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        [field]: value
      }
    }));
    // Persist mini table field to backend
    if (!compId || !groups.length) return;
    try {
      const patchBody = {};
      if (field === 'waters') patchBody.waters = value;
      if (field === 'twoClubs') patchBody.two_clubs = value;
      await fetch(`/api/competitions/${compId}/groups/${groupIdx}/player/${encodeURIComponent(name)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody)
      });
    } catch (err) {
      setError('Failed to save mini table for ' + name + ': ' + (err.message || err));
    }
    // Show popups for Waters
    if (field === 'waters' && value && Number(value) > 0) {
      setWatersPlayer(name);
      setShowWatersPopup(true);
      if (watersTimeoutRef.current) clearTimeout(watersTimeoutRef.current);
      watersTimeoutRef.current = setTimeout(() => setShowWatersPopup(false), 30000);
    }
  }

  if (loading) return <PageBackground><TopMenu {...props} /><div className="p-8 text-white">Loading...</div></PageBackground>;
  if (!groups.length) return <PageBackground><TopMenu {...props} /><div className="p-8 text-white">No groups found.</div></PageBackground>;

  return (
    <PageBackground>
      <TopMenu {...props} />
      <div className="flex flex-col items-center px-4 mt-12">
        <h1 className="text-4xl font-extrabold drop-shadow-lg text-center mb-4" style={{ color: '#002F5F', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>
          Medal Competition: Scorecard
        </h1>
        {/* Comp Info Section */}
        <div className="max-w-4xl w-full mb-4 p-4 rounded-xl border-2 border-[#FFD700] text-white flex flex-col gap-2" style={{ fontFamily: 'Lato, Arial, sans-serif', background: 'rgba(0,47,95,0.95)' }}>
          <div className="flex flex-nowrap justify-between gap-x-6 text-sm font-normal w-full overflow-x-auto">
            <div className="flex-1 min-w-[140px] whitespace-nowrap">Date: <span className="font-bold" style={{ color: '#FFD700' }}>{comp?.date ? (new Date(comp.date).toLocaleDateString()) : '-'}</span></div>
            <div className="flex-1 min-w-[140px] whitespace-nowrap">Club: <span className="font-bold" style={{ color: '#FFD700' }}>{comp?.club || '-'}</span></div>
            <div className="flex-1 min-w-[140px] whitespace-nowrap">Tee Time: <span className="font-bold" style={{ color: '#FFD700' }}>{groups[groupIdx]?.teeTime || '-'}</span></div>
            <div className="flex-1 min-w-[180px] whitespace-nowrap">Allowance: <span className="font-bold" style={{ color: '#FFD700' }}>{comp?.handicapallowance ? comp.handicapallowance + '%' : '-'}</span></div>
          </div>
        </div>
        <div className="max-w-4xl w-full bg-[#002F5F] rounded-2xl shadow-2xl p-8 border-4 border-[#FFD700] text-white" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>
          {/* Group buttons removed above mini table */}
          {/* Mini Table for Waters, Dog, 2 Clubs, etc. */}
          <table className="min-w-[300px] border text-white text-sm rounded mb-6" style={{ fontFamily: 'Lato, Arial, sans-serif', background: '#002F5F', color: 'white', borderColor: '#FFD700' }}>
            <thead>
              <tr>
                <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}></th>
                <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Name</th>
                <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Tee</th>
                <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>CH</th>
                <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>PH</th>
                <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Waters</th>
                <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Dog</th>
                <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>2 Clubs</th>
              </tr>
            </thead>
            <tbody>
                {players.map((name, idx) => (
                  <tr key={name}>
                    <td className={`border border-white px-2 py-1 font-bold text-center align-middle ${playerColors[idx % playerColors.length]}`} style={{ minWidth: 32 }}>{String.fromCharCode(65 + idx)}</td>
                    <td className={`border border-white px-2 py-1 font-semibold text-left ${playerColors[idx % playerColors.length]}`}>{name}</td>
                    <td className="border px-2 py-1 text-center">
                      <select
                        value={playerData[name]?.teebox || ''}
                        onChange={e => handleChange(name, 'teebox', e.target.value)}
                        className="w-24 text-center bg-transparent rounded focus:outline-none font-semibold"
                        style={{
                          border: 'none',
                          color:
                            playerData[name]?.teebox === 'Red' ? '#FF4B4B' :
                            playerData[name]?.teebox === 'White' ? '#FFFFFF' :
                            '#FFD700'
                        }}
                      >
                        <option value="" style={{ color: '#FFD700' }}>Select</option>
                        <option value="Yellow" style={{ color: '#FFD700' }}>Yellow</option>
                        <option value="White" style={{ color: '#FFFFFF', background: '#002F5F' }}>White</option>
                        <option value="Red" style={{ color: '#FF4B4B', background: '#002F5F' }}>Red</option>
                      </select>
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <input
                        type="number"
                        min="0"
                        className="w-16 text-center bg-transparent rounded focus:outline-none font-semibold no-spinner"
                        style={{
                          border: 'none',
                          color: '#FFD700'
                        }}
                        value={playerData[name]?.handicap || ''}
                        onChange={e => handleChange(name, 'handicap', e.target.value)}
                      />
                    </td>
                    <td className="border border-white px-2 py-1 text-center font-bold" style={{ color: '#FFD700' }}>
                      {(() => {
                        const ch = parseFloat(playerData[name]?.handicap) || 0;
                        const allowance = comp?.handicapAllowance ? parseFloat(comp.handicapAllowance) : 100;
                        return Math.round(ch * (allowance / 100));
                      })()}
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <input type="number" min="0" className="w-12 text-center text-white bg-transparent rounded focus:outline-none font-semibold no-spinner" style={{ border: 'none', MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none' }} value={miniTableStats[name]?.waters || ''} onChange={e => handleMiniTableChange(name, 'waters', e.target.value)} />
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <input type="checkbox" checked={!!miniTableStats[name]?.dog} onChange={e => handleMiniTableChange(name, 'dog', e.target.checked)} />
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <input type="number" min="0" className="w-12 text-center text-white bg-transparent rounded focus:outline-none font-semibold no-spinner" style={{ border: 'none', MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none' }} value={miniTableStats[name]?.twoClubs || ''} onChange={e => handleMiniTableChange(name, 'twoClubs', e.target.value)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            
          </table>
          {/* Scorecard Table UI: Front 9 and Back 9, PAR/STROKE/HOLE headings, gross/net rows, Medal logic */}
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
                {players.map((name, pIdx) => (
                  <React.Fragment key={name + '-rows-front'}>
                    {/* Gross row */}
                    <tr key={name + '-gross-front'}>
                      <td rowSpan={2} className={`border border-white px-2 py-1 font-bold text-lg text-center align-middle ${playerColors[pIdx % playerColors.length]}`} style={{ minWidth: 32, verticalAlign: 'middle' }}>
                        {String.fromCharCode(65 + pIdx)}
                      </td>
                      <td className="border px-2 py-1 text-base font-bold bg-white/10 text-center" style={{ minWidth: 40 }}>Gross</td>
                      {defaultHoles.slice(0,9).map((hole, hIdx) => (
                        <td key={hIdx} className="border py-1 text-center align-middle font-bold text-base">
                          <div className="flex items-center justify-center">
                            <input
                              type="number"
                              min="0"
                              max="20"
                              value={playerData[name]?.scores?.[hIdx] || ''}
                              onChange={e => handleScoreChange(name, hIdx, e.target.value)}
                              className="w-10 h-10 text-center focus:outline-none block mx-auto font-bold text-base no-spinner px-0 text-white"
                              inputMode="numeric"
                              style={{ MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}
                            />
                          </div>
                        </td>
                      ))}
                      <td className="border px-2 py-1 font-bold text-base">{Array.isArray(playerData[name]?.scores) ? playerData[name].scores.slice(0,9).reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0) : ''}</td>
                    </tr>
                    {/* Net row (no player label cell) */}
                    <tr key={name + '-net-front'}>
                      <td className="border px-2 py-1 bg-white/10 text-base font-bold text-center align-middle" style={{ minWidth: 40, verticalAlign: 'middle', height: '44px' }}>Net</td>
                      {defaultHoles.slice(0,9).map((hole, hIdx) => {
                        // Medal net calculation: gross - strokes received
                        let adjHandicap = parseInt(playerData[name]?.handicap, 10) || 0;
                        let strokesReceived = 0;
                        if (adjHandicap > 0) {
                          if (adjHandicap >= 18) {
                            strokesReceived = 1;
                            if (adjHandicap - 18 >= hole.index) strokesReceived = 2;
                            else if (hole.index <= (adjHandicap % 18)) strokesReceived = 2;
                          } else if (hole.index <= adjHandicap) {
                            strokesReceived = 1;
                          }
                        }
                        const gross = parseInt(playerData[name]?.scores?.[hIdx], 10) || 0;
                        const net = gross ? gross - strokesReceived : '';
                        return (
                          <td key={hIdx} className="border px-1 py-1 bg-white/5 align-middle font-bold text-base" style={{ verticalAlign: 'middle', height: '44px' }}>
                            {gross ? net : ''}
                          </td>
                        );
                      })}
                      {/* Net front 9 total */}
                      <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>
                        {(() => {
                          let adjHandicap = parseInt(playerData[name]?.handicap, 10) || 0;
                          let netFrontTotal = 0;
                          defaultHoles.slice(0,9).forEach((hole, hIdx) => {
                            let strokesReceived = 0;
                            if (adjHandicap > 0) {
                              if (adjHandicap >= 18) {
                                strokesReceived = 1;
                                if (adjHandicap - 18 >= hole.index) strokesReceived = 2;
                                else if (hole.index <= (adjHandicap % 18)) strokesReceived = 2;
                              } else if (hole.index <= adjHandicap) {
                                strokesReceived = 1;
                              }
                            }
                            const gross = parseInt(playerData[name]?.scores?.[hIdx], 10) || 0;
                            const net = gross ? gross - strokesReceived : 0;
                            if (typeof net === 'number') netFrontTotal += net;
                          });
                          return netFrontTotal;
                        })()}
                      </td>
                    </tr>
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
                  <th className="border px-2 py-1 bg-white/5 border-r"></th>
                  <th className="border px-2 py-1 bg-white/5 border-r"></th>
                </tr>
              </thead>
              <tbody>
                {players.map((name, pIdx) => (
                  <React.Fragment key={name + '-rows-back'}>
                    {/* Gross row */}
                    <tr key={name + '-gross-back'}>
                      <td rowSpan={2} className={`border border-white px-2 py-1 font-bold text-lg text-center align-middle ${playerColors[pIdx % playerColors.length]}`} style={{ minWidth: 32, verticalAlign: 'middle' }}>
                        {String.fromCharCode(65 + pIdx)}
                      </td>
                      <td className="border px-2 py-1 text-base font-bold bg-white/10 text-center" style={{ minWidth: 40 }}>Gross</td>
                      {defaultHoles.slice(9,18).map((hole, hIdx) => (
                        <td key={hIdx} className="border py-1 text-center align-middle font-bold text-base">
                          <div className="flex items-center justify-center">
                            <input
                              type="number"
                              min="0"
                              max="20"
                              value={playerData[name]?.scores?.[hIdx+9] || ''}
                              onChange={e => handleScoreChange(name, hIdx+9, e.target.value)}
                              className="w-10 h-10 text-center focus:outline-none block mx-auto font-bold text-base no-spinner px-0 text-white"
                              inputMode="numeric"
                              style={{ MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}
                            />
                          </div>
                        </td>
                      ))}
                      <td className="border px-2 py-1 font-bold text-base">{
                        Array.isArray(playerData[name]?.scores) ? playerData[name].scores.slice(9,18).reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0) : ''
                      }</td>
                      <td className="border px-2 py-1 font-bold text-base">{
                        Array.isArray(playerData[name]?.scores) ? playerData[name].scores.reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0) : ''
                      }</td>
                    </tr>
                    {/* Net row (no player label cell) */}
                    <tr key={name + '-net-back'}>
                      <td className="border px-2 py-1 bg-white/10 text-base font-bold text-center align-middle" style={{ minWidth: 40, verticalAlign: 'middle', height: '44px' }}>Net</td>
                      {defaultHoles.slice(9,18).map((hole, hIdx) => {
                        let adjHandicap = parseInt(playerData[name]?.handicap, 10) || 0;
                        let strokesReceived = 0;
                        if (adjHandicap > 0) {
                          if (adjHandicap >= 18) {
                            strokesReceived = 1;
                            if (adjHandicap - 18 >= hole.index) strokesReceived = 2;
                            else if (hole.index <= (adjHandicap % 18)) strokesReceived = 2;
                          } else if (hole.index <= adjHandicap) {
                            strokesReceived = 1;
                          }
                        }
                        const gross = parseInt(playerData[name]?.scores?.[hIdx+9], 10) || 0;
                        const net = gross ? gross - strokesReceived : '';
                        return (
                          <td key={hIdx} className="border px-1 py-1 bg-white/5 align-middle font-bold text-base" style={{ verticalAlign: 'middle', height: '44px' }}>
                            {gross ? net : ''}
                          </td>
                        );
                      })}
                      {/* Net back 9 and total */}
                      <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>
                        {(() => {
                          let adjHandicap = parseInt(playerData[name]?.handicap, 10) || 0;
                          let netBackTotal = 0;
                          defaultHoles.slice(9,18).forEach((hole, hIdx) => {
                            let strokesReceived = 0;
                            if (adjHandicap > 0) {
                              if (adjHandicap >= 18) {
                                strokesReceived = 1;
                                if (adjHandicap - 18 >= hole.index) strokesReceived = 2;
                                else if (hole.index <= (adjHandicap % 18)) strokesReceived = 2;
                              } else if (hole.index <= adjHandicap) {
                                strokesReceived = 1;
                              }
                            }
                            const gross = parseInt(playerData[name]?.scores?.[hIdx+9], 10) || 0;
                            const net = gross ? gross - strokesReceived : 0;
                            if (typeof net === 'number') netBackTotal += net;
                          });
                          return netBackTotal;
                        })()}
                      </td>
                      <td className="border px-2 py-1 bg-white/5 align-middle text-base font-bold" style={{ verticalAlign: 'middle', height: '44px' }}>
                        {(() => {
                          let adjHandicap = parseInt(playerData[name]?.handicap, 10) || 0;
                          let netTotal = 0;
                          defaultHoles.forEach((hole, hIdx) => {
                            let strokesReceived = 0;
                            if (adjHandicap > 0) {
                              if (adjHandicap >= 18) {
                                strokesReceived = 1;
                                if (adjHandicap - 18 >= hole.index) strokesReceived = 2;
                                else if (hole.index <= (adjHandicap % 18)) strokesReceived = 2;
                              } else if (hole.index <= adjHandicap) {
                                strokesReceived = 1;
                              }
                            }
                            const gross = parseInt(playerData[name]?.scores?.[hIdx], 10) || 0;
                            const net = gross ? gross - strokesReceived : 0;
                            if (typeof net === 'number') netTotal += net;
                          });
                          return netTotal;
                        })()}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {error && <div className="text-red-300 mt-4 font-semibold">{error}</div>}
        </div>
      </div>
      {/* Birdie Popup */}
      {showBirdie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-8 flex flex-col items-center border-4 border-[#FFD700] popup-jiggle">
            <span className="text-6xl mb-2" role="img" aria-label="Birdie">🕊️</span>
            <h2 className="text-3xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>Birdie!</h2>
            <div className="text-lg font-semibold text-white mb-1" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>For {birdiePlayer} on Hole {birdieHole}</div>
            <button className="mt-2 px-6 py-2 rounded-2xl font-bold shadow border border-white transition text-lg" style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'} onClick={() => { setShowBirdie(false); if (birdieTimeoutRef.current) clearTimeout(birdieTimeoutRef.current); }}>Dismiss</button>
          </div>
        </div>
      )}
      {/* Eagle Popup */}
      {showEagle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-8 flex flex-col items-center border-4 border-[#FFD700] popup-jiggle">
            <span className="text-6xl mb-2" role="img" aria-label="Eagle">🦅</span>
            <h2 className="text-3xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>Eagle!</h2>
            <div className="text-lg font-semibold text-white mb-1" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>For {eaglePlayer} on Hole {eagleHole}</div>
            <button className="mt-2 px-6 py-2 rounded-2xl font-bold shadow border border-white transition text-lg" style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'} onClick={() => { setShowEagle(false); if (eagleTimeoutRef.current) clearTimeout(eagleTimeoutRef.current); }}>Dismiss</button>
          </div>
        </div>
      )}
      {/* Blowup Popup */}
      {showBlowup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-8 flex flex-col items-center border-4 border-[#FFD700] popup-jiggle">
            <span className="text-6xl mb-2" role="img" aria-label="Explosion">💥</span>
            <h2 className="text-3xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>How embarrassing.</h2>
            <div className="text-lg font-semibold text-white mb-1" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>{blowupPlayer} just blew up on Hole {blowupHole}.</div>
            <button className="mt-2 px-6 py-2 rounded-2xl font-bold shadow border border-white transition text-lg" style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'} onClick={() => { setShowBlowup(false); if (blowupTimeoutRef.current) clearTimeout(blowupTimeoutRef.current); }}>Dismiss</button>
          </div>
        </div>
      )}
      {/* Waters Popup */}
      {showWatersPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-8 flex flex-col items-center border-4 border-[#FFD700]">
            <span className="text-6xl mb-2" role="img" aria-label="Splash">💧</span>
            <h2 className="text-3xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>Splash!</h2>
            <div className="text-lg font-semibold text-white mb-1" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>{watersPlayer} has just earned a water</div>
            <button className="mt-2 px-6 py-2 rounded-2xl font-bold shadow border border-white transition text-lg" style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'} onClick={() => { setShowWatersPopup(false); if (watersTimeoutRef.current) clearTimeout(watersTimeoutRef.current); }}>Dismiss</button>
          </div>
        </div>
      )}
      {/* Dog Popup */}
      {showDogPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-8 flex flex-col items-center border-4 border-[#FFD700]">
            <span className="text-6xl mb-2" role="img" aria-label="Dog">🐶</span>
            <h2 className="text-3xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>Woof!</h2>
            <div className="text-lg font-semibold text-white mb-1" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>{dogPlayer} has just gotten the dog</div>
            <button className="mt-2 px-6 py-2 rounded-2xl font-bold shadow border border-white transition text-lg" style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'} onClick={() => { setShowDogPopup(false); if (watersTimeoutRef.current) clearTimeout(watersTimeoutRef.current); }}>Dismiss</button>
          </div>
        </div>
      )}
    </PageBackground>
  );
}
