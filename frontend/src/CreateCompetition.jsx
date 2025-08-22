// Display mapping for all comp types
const COMP_TYPE_DISPLAY = {
  fourBbbStableford: '4BBB Stableford (2 Scores to Count)',
  '4bbb stableford': '4BBB Stableford (2 Scores to Count)',
  alliance: 'Alliance',
  medalStrokeplay: 'Medal Strokeplay',
  'medal strokeplay': 'Medal Strokeplay',
  stroke: 'Medal Strokeplay',
  individualStableford: 'Individual Stableford',
  'individual stableford': 'Individual Stableford',
};

import { useState } from 'react';
import PageBackground from './PageBackground';
import { useNavigate, useLocation } from 'react-router-dom';
import FourballAssignment from './FourballAssignment';

// Format date as DD/MM/YYYY
function formatDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function generateJoinCode() {
  // Simple 6-character alphanumeric code
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}


function CreateCompetition({ user }) {
  const location = useLocation();
  const [form, setForm] = useState({
    type: 'fourBbbStableford',
    date: '',
    club: 'Westlake Golf Club',
    handicapAllowance: '95',
    fourballs: '',
    notes: '',
  });

  // Set default allowance based on comp type
  function handleTypeChange(e) {
    const type = e.target.value;
    let allowance = '95';
    if (type === 'alliance' || type === 'fourBbbStableford') {
      allowance = '85';
    } else if (type === 'medal-strokeplay' || type === 'individual-stableford') {
      allowance = '95'; 
    }
    setForm(prev => ({ ...prev, type, handicapAllowance: allowance }));
  }
  const [created, setCreated] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [compId, setCompId] = useState(null);
  const [showGroups, setShowGroups] = useState(false);
  const [groups, setGroups] = useState([]);
  const navigate = useNavigate();

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    // If fourballs entered, create comp in backend and then show group assignment
    if (form.fourballs && !showGroups) {
      try {
        const res = await fetch('http://localhost:5050/api/competitions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form })
        });
        if (!res.ok) throw new Error('Failed to create competition');
        const data = await res.json();
        // Store backend id and joinCode
        if (data.competition) {
          setCompId(data.competition.id);
          setJoinCode(data.competition.joinCode || data.competition.joincode || '');
        }
        setShowGroups(true);
      } catch (err) {
        alert('Error creating competition: ' + err.message);
      }
      return;
    }
    // Otherwise, finalize comp creation (no fourballs)
    try {
      const res = await fetch('http://localhost:5050/api/competitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form })
      });
      if (!res.ok) throw new Error('Failed to create competition');
      const data = await res.json();
      if (data.competition) {
        setCompId(data.competition.id);
        setJoinCode(data.competition.joinCode || data.competition.joincode || '');
      }
      setCreated(true);
    } catch (err) {
      alert('Error creating competition: ' + err.message);
    }
  }

  async function handleAssign(groupsData) {
    setGroups(groupsData);
    // Save comp with groups to backend using numeric id
    if (!compId) {
      alert('Competition join code not found. Please create the competition first.');
      return;
    }
    try {
      const res = await fetch(`http://localhost:5050/api/competitions/${compId}/groups`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups: groupsData })
      });
      if (!res.ok) throw new Error('Failed to save groups');
      setCreated(true);
    } catch (err) {
      alert('Error saving groups: ' + err.message);
    }
  }

  return (
    <PageBackground>
      {/* Top nav menu */}
      <div className="flex flex-wrap justify-between items-center mt-8 mb-4 w-full max-w-2xl mx-auto px-8">
        <button
          className={`text-sm text-white font-semibold opacity-80 hover:opacity-100 hover:underline focus:underline bg-transparent border-none outline-none px-2 py-1 cursor-pointer ${location.pathname === '/dashboard' ? 'border-b-4' : ''}`}
          style={location.pathname === '/dashboard' ? { borderColor: '#1B3A6B', borderBottomWidth: 2, background: 'none', borderStyle: 'solid', boxShadow: 'none' } : { background: 'none', border: 'none', boxShadow: 'none' }}
          onClick={() => navigate('/dashboard')}
        >
          Dashboard
        </button>
        <button
          className={`text-sm text-white font-semibold opacity-80 hover:opacity-100 hover:underline focus:underline bg-transparent border-none outline-none px-2 py-1 cursor-pointer ${location.pathname === '/recent' ? 'border-b-4' : ''}`}
          style={location.pathname === '/recent' ? { borderColor: '#1B3A6B', borderBottomWidth: 2, background: 'none', borderStyle: 'solid', boxShadow: 'none' } : { background: 'none', border: 'none', boxShadow: 'none' }}
          onClick={() => navigate('/recent')}
        >
          Competitions
        </button>
        <span
          className="text-sm text-white font-semibold opacity-80 bg-transparent border-none outline-none px-2 py-1 cursor-default select-none"
          style={{ background: 'none', border: 'none', boxShadow: 'none', lineHeight: '2.25rem' }}
        >
          Welcome, {(user?.name?.split(' ')[0]) || 'Player'}
        </span>
        <button
          className="text-sm text-white font-semibold opacity-80 hover:opacity-100 hover:underline focus:underline bg-transparent border-none outline-none px-2 py-1 cursor-pointer"
          style={{ background: 'none', border: 'none', boxShadow: 'none' }}
          onClick={() => {
            if (typeof window.onSignOut === 'function') window.onSignOut();
            else if (typeof window.signOut === 'function') window.signOut();
          }}
        >
          Sign Out
        </button>
      </div>
      {(!showGroups) && (
        <div className="flex flex-col items-center px-4 mt-12">
          <h2 className="text-3xl font-bold text-white mb-2 drop-shadow-lg text-center">Create Competition</h2>
        </div>
      )}
  <div className="relative z-10 flex flex-col items-center px-4 mt-8">
  {/* Home button moved to bottom of form */}
  <div className="w-full max-w-4xl rounded-2xl p-8 flex flex-col gap-6 px-8" style={{ background: 'none', boxShadow: 'none' }}>
          {created ? (
            <div className="text-white text-center p-6">
              <h3 className="text-xl font-semibold mb-2">Competition Created!</h3>
              <p className="mb-2">Type: <span className="font-medium">{
                COMP_TYPE_DISPLAY[form.type] || form.type
              }</span></p>
              <p className="mb-2">Date: <span className="font-medium">{formatDate(form.date)}</span></p>
              <p className="mb-2">Club: <span className="font-medium">{form.club}</span></p>
              {form.fourballs && <p className="mb-2">4 Balls: <span className="font-medium">{form.fourballs}</span></p>}
              {form.notes && <p className="mb-2">Notes: <span className="font-medium">{form.notes}</span></p>}
              <p className="mb-2">Join Code: <span className="font-medium">{joinCode || '-'}</span></p>
              <p className="mt-4 text-green-200 font-bold">Share the join code: <span className="bg-white/20 px-2 py-1 rounded text-white">{joinCode || '-'}</span></p>
              <p className="mt-2 text-white/80">Invite others to join your competition by sending them the join code above.</p>
              <button
                className="mt-6 py-2 px-6 border border-white text-white font-semibold rounded-2xl transition text-lg"
                style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                onClick={() => navigate('/dashboard')}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
              >
                Home
              </button>
            </div>
          ) : showGroups ? (
            <FourballAssignment
              fourballs={parseInt(form.fourballs) || 1}
              onAssign={handleAssign}
            />
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
              <div className="mb-4">
                <label className="block mb-1 font-medium text-white" htmlFor="date">Date</label>
                <input
                  id="date"
                  name="date"
                  type="date"
                  required
                  value={form.date}
                  onChange={handleChange}
                  className="w-full border border-white bg-transparent text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white placeholder-white/70"
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1 font-medium text-white" htmlFor="club">Club</label>
                <input
                  id="club"
                  name="club"
                  type="text"
                  value={form.club}
                  onChange={handleChange}
                  className="w-full border border-white bg-transparent text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white placeholder-white/70"
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1 font-medium text-white" htmlFor="type">Competition Type</label>
                <select
                  id="type"
                  name="type"
                  value={form.type}
                  onChange={handleTypeChange}
                  className="w-full border border-white bg-transparent text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white"
                >
              <option value="fourBbbStableford">4BBB Stableford (2 Scores to Count)</option>
              <option value="alliance">Alliance</option>
              <option value="medalStrokeplay">Medal Strokeplay</option>
              <option value="individualStableford">Individual Stableford</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block mb-1 font-medium text-white" htmlFor="handicapAllowance">Competition Handicap Allowance</label>
                <select
                  id="handicapAllowance"
                  name="handicapAllowance"
                  value={form.handicapAllowance}
                  onChange={handleChange}
                  className="w-full border border-white bg-transparent text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white"
                >
                  <option value="85">85%</option>
                  <option value="90">90%</option>
                  <option value="95">95%</option>
                  <option value="100">100%</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block mb-1 font-medium text-white" htmlFor="fourballs">How many 4 Balls are playing today?</label>
                <input
                  id="fourballs"
                  name="fourballs"
                  type="number"
                  min="1"
                  required
                  value={form.fourballs}
                  onChange={handleChange}
                  className="w-full border border-white bg-transparent text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white placeholder-white/70"
                  placeholder="e.g. 3"
                />
              </div>
              <div className="mb-6">
                <label className="block mb-1 font-medium text-white" htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  value={form.notes}
                  onChange={handleChange}
                  className="w-full border border-white bg-transparent text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white placeholder-white/70"
                  placeholder="Optional notes (e.g. special rules, sponsor etc.)"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 px-4 border border-white text-white font-semibold rounded-2xl transition text-lg"
                style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
              >
                Next: Assign 4 Balls
              </button>
              {/* Footer menu removed, now at top */}
            </form>
          )}
        </div>
      </div>
    </PageBackground>
  );
}
export default CreateCompetition;
