  // Helper: get par for holes played
  function getParDiff(entry) {
    const holesPlayed = entry.scores?.filter(s => s && s !== '').length || 0;
    if (!holesPlayed) return '';
    let gross = 0;
    let par = 0;
    for (let i = 0; i < holesPlayed; i++) {
      gross += parseInt(entry.scores[i] || 0);
      par += defaultHoles[i]?.par || 0;
    }
    const diff = gross - par;
    if (holesPlayed === 0) return '';
    if (diff === 0) return 'E';
    if (diff > 0) return `+${diff}`;
    return `${diff}`;
  }
// Format date as DD/MM/YYYY
function formatDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageBackground from './PageBackground';

const COMP_TYPE_DISPLAY = {
  fourBbbStableford: '4BBB Stableford (2 Scores to Count)',
  alliance: 'Alliance',
  medalStrokeplay: 'Medal Strokeplay',
  individualStableford: 'Individual Stableford',
};
// Westlake Golf Club holes: par and stroke index
const defaultHoles = [
  { number: 1, par: 4, index: 5 },
  { number: 2, par: 4, index: 7 },
  { number: 3, par: 3, index: 17 },
  { number: 4, par: 5, index: 1 },
  { number: 5, par: 4, index: 11 },
  { number: 6, par: 3, index: 15 },
  { number: 7, par: 5, index: 3 },
  { number: 8, par: 4, index: 13 },
  { number: 9, par: 4, index: 9 },
  { number: 10, par: 4, index: 10 },
  { number: 11, par: 4, index: 4 },
  { number: 12, par: 4, index: 12 },
  { number: 13, par: 5, index: 2 },
  { number: 14, par: 4, index: 14 },
  { number: 15, par: 3, index: 18 },
  { number: 16, par: 5, index: 6 },
  { number: 17, par: 3, index: 16 },
  { number: 18, par: 4, index: 8 },
];

function Leaderboard() {
  const [entries, setEntries] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();
  const filterDate = location.state?.date;
  const filterType = location.state?.type;

  useEffect(() => {
    let saved = JSON.parse(localStorage.getItem('scores') || '[]');
    if (filterDate && filterType) {
      saved = saved.filter(e => e.date === filterDate && e.competitionType === filterType);
    }
    setEntries(saved);
  }, [filterDate, filterType]);

  // Get competition and date from first entry (filtered)
  // Normalize comp key to match COMP_TYPE_DISPLAY keys
  let compRaw = entries[0]?.competitionType || '';
  let compKey = compRaw
    .replace(/\s+/g, '')
    .replace(/\(.*\)/, '')
    .replace(/[^a-zA-Z]/g, '')
    .replace(/^[0-9]+/, '')
    .replace(/^[A-Z]/, m => m.toLowerCase())
    .replace(/(\w)([A-Z])/g, (m, p1, p2) => p1 + p2.toLowerCase());
  if (compKey === '4bbbstableford') compKey = 'fourBbbStableford';
  if (compKey === 'medalstrokeplay') compKey = 'medalStrokeplay';
  if (compKey === 'individualstableford') compKey = 'individualStableford';
  if (compKey === 'alliance') compKey = 'alliance';
  const date = entries[0]?.date || '';
  // Determine comp type
  const isMedal = comp.toLowerCase().includes('medal');
  const isStableford = comp.toLowerCase().includes('stableford');
  const isAlliance = comp.toLowerCase().includes('alliance');
  // Alliance (2 scores to count) team logic
  const [groups, setGroups] = useState([]);
  const [compId, setCompId] = useState(null);

  // Fetch latest comp groups from backend
  useEffect(() => {
    // Try to get compId from entries
    const joinCode = entries[0]?.player?.joinCode || entries[0]?.player?.joincode;
    if (!joinCode) return;
    // Fetch all competitions, find matching joinCode
    fetch('/api/competitions')
      .then(res => res.json())
      .then(data => {
        const comp = data.find(c => c.joincode === joinCode || c.joinCode === joinCode);
        if (comp) {
          setCompId(comp.id);
          fetch(`/api/competitions/${comp.id}`)
            .then(res => res.json())
            .then(cdata => setGroups(cdata.groups || []));
        }
      });
  }, [entries]);

  function getAllianceTeams() {
    // Use latest groups from backend
    return groups.map((group, idx) => {
      // Find player entries for this group (case-insensitive, trimmed match, support guest display names)
      const groupEntries = (group.players || []).map((name, i) => {
        if (["Guest 1","Guest 2","Guest 3"].includes(name) && Array.isArray(group.displayNames) && group.displayNames[i]) {
          // Try to match guest by display name
          const guestName = group.displayNames[i].trim().toLowerCase();
          return entries.find(e => e.player?.name?.trim().toLowerCase() === guestName);
        } else if (typeof name === 'string') {
          const norm = name.trim().toLowerCase();
          return entries.find(e => e.player?.name?.trim().toLowerCase() === norm);
        } else {
          return undefined;
        }
      }).filter(Boolean);
      // For each hole, get best 2 stableford points
      const holes = 18;
      let teamPoints = 0;
      let thru = 0;
      for (let h = 0; h < holes; h++) {
        // Get points for each player for this hole
        const pts = groupEntries.map(e => {
          // Calculate points for this hole only
          const ph = getPlayingHandicap(e);
          const gross = parseInt(e.scores?.[h] || 0);
          if (!gross) return 0;
          const hole = defaultHoles[h];
          let shots = 0;
          if (ph > 0) {
            shots = Math.floor(ph / 18);
            if (hole.index <= (ph % 18)) shots += 1;
          }
          const net = gross - shots;
          const par = hole.par;
          if (net === par - 2) return 4;
          if (net === par - 1) return 3;
          if (net === par) return 2;
          if (net === par + 1) return 1;
          return 0;
        });
        // Best 2 scores to count
        const best2 = pts.sort((a, b) => b - a).slice(0, 2);
        if (best2.some(p => p > 0)) thru = h + 1;
        teamPoints += best2.reduce((a, b) => a + b, 0);
      }
      // Propagate guest display names for UI
      let displayPlayers = (group.players || []).map((name, i) => {
        const guestIdx = ['Guest 1','Guest 2','Guest 3'].indexOf(name);
        if (guestIdx !== -1 && Array.isArray(group.displayNames) && group.displayNames[guestIdx]) {
          return `GUEST - ${group.displayNames[guestIdx]}`;
        } else if (guestIdx !== -1) {
          return name;
        } else if (typeof name === 'string') {
          const parts = name.trim().split(' ');
          if (parts.length > 1) {
            return parts[0][0] + '. ' + parts[parts.length - 1];
          } else {
            return name;
          }
        } else {
          return '';
        }
      });
      return {
        groupNum: idx + 1,
        teeTime: group.teeTime,
        players: displayPlayers,
        teamPoints,
        thru,
      };
    });
  }

  // Helper: calculate net and points
  function getPlayingHandicap(entry) {
    const full = parseFloat(entry.player?.handicap || 0);
    return Math.round(full * 0.95);
  }
  function getNet(entry) {
    return entry.total - getPlayingHandicap(entry);
  }
  function getStablefordPoints(entry) {
    // Allocate shots per hole using stroke index
    const ph = getPlayingHandicap(entry);
    let points = 0;
    for (let i = 0; i < (entry.scores?.length || 0); i++) {
      const gross = parseInt(entry.scores[i] || 0);
      if (!gross) continue;
      const hole = defaultHoles[i];
      // Calculate shots for this hole
      let shots = 0;
      if (ph > 0) {
        shots = Math.floor(ph / 18);
        // Extra shots for lowest indexes
        if (hole.index <= (ph % 18)) shots += 1;
      }
      const net = gross - shots;
      const par = hole.par;
      if (net === par - 2) points += 4; // eagle
      else if (net === par - 1) points += 3; // birdie
      else if (net === par) points += 2; // par
      else if (net === par + 1) points += 1; // bogey
      // else 0
    }
    return points;
  }

  // Determine if any player has played less than 18 holes
  const showThru = entries.some(e => (e.scores?.filter(s => s && s !== '').length || 0) < 18);

  return (
    <PageBackground>
      <div className="flex flex-col items-center px-4 mt-12">
        <h2 className="text-3xl font-bold text-white mb-6 drop-shadow-lg text-center">Leaderboard</h2>
      </div>
      <div className="flex flex-col items-center px-4 mt-8">
        <div className="w-full max-w-3xl rounded-2xl shadow-lg bg-transparent text-white mb-8" style={{ backdropFilter: 'none' }}>
          <div className="flex justify-between mb-4">
            <button
              onClick={() => navigate('/')}
              className="py-2 px-4 bg-transparent border border-white text-white rounded-2xl hover:bg-white hover:text-black transition mr-2"
            >
              Home
            </button>
            <button
              onClick={() => navigate(-1)}
              className="py-2 px-4 bg-transparent border border-white text-white rounded-2xl hover:bg-white hover:text-black transition"
            >
              ← Back to Scorecard
            </button>
          </div>
          {comp && <div className="text-lg font-semibold text-white/90 mb-1"><span>Type: </span>{COMP_TYPE_DISPLAY[comp] || comp?.replace(/(^|\s|_)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase()).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/-/g, ' ')}</div>}
          {compRaw && COMP_TYPE_DISPLAY[compKey] &&
            <div className="text-lg font-semibold text-white/90 mb-1">
              <span>Type: </span>{COMP_TYPE_DISPLAY[compKey]}
            </div>
          }
          {date && <div className="text-md text-white/70 mb-1">{formatDate(date)}</div>}
          {(entries[0]?.player?.joinCode || entries[0]?.player?.joincode) && (
            <div className="text-xs text-white/60 mb-4">Invite Code: <span className="font-mono">{entries[0].player.joinCode || entries[0].player.joincode}</span></div>
          )}
          {isAlliance ? (
            <table className="min-w-full border text-center">
              {/* ...existing code... */}
            </table>
          ) : entries.length === 0 ? (
            <div className="text-white/80">No scores submitted yet.</div>
          ) : (
            <table className="min-w-full border text-center">
              {/* ...existing code... */}
            </table>
          )}
          {/* Captain's Log Section */}
          <div className="mt-10">
            <h3 className="text-2xl font-bold text-white mb-2 drop-shadow text-center">Captain's Log</h3>
            <textarea
              className="w-full min-h-[100px] rounded-lg p-3 bg-white/90 text-black text-lg font-medium border border-[#FFD700] focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
              placeholder="Enter notes here..."
              style={{ resize: 'vertical', fontFamily: 'Lato, Arial, sans-serif' }}
            />
          </div>
        </div>
      </div>
    </PageBackground>
  );
}

export default Leaderboard;
