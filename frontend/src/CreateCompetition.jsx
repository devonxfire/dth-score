// Helper: check if user is admin
function isAdmin(user) {
  return user && (user.role === 'admin' || user.isAdmin || user.isadmin);
}
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import React, { useState, useEffect } from 'react';
import PageBackground from './PageBackground';
import OpenCompModal from './OpenCompModal';
import { useNavigate, useLocation } from 'react-router-dom';
import FourballAssignment from './FourballAssignment';

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


// Format date as DD/MM/YYYY
function formatDate(dateVal) {
  if (!dateVal) return '';
  if (dateVal instanceof Date) {
    const day = String(dateVal.getDate()).padStart(2, '0');
    const month = String(dateVal.getMonth() + 1).padStart(2, '0');
    const year = dateVal.getFullYear();
    return `${day}/${month}/${year}`;
  }
  if (typeof dateVal === 'string') {
    const [year, month, day] = dateVal.split('-');
    return `${day}/${month}/${year}`;
  }
  return '';
}

function generateJoinCode() {
  // Simple 6-character alphanumeric code
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}


function CreateCompetition({ user }) {
  // Today's date for minDate
  const today = new Date();
  const location = useLocation();
  const [form, setForm] = useState({
    type: 'fourBbbStableford',
    date: null,
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
  const [openComps, setOpenComps] = useState([]);
  const [showOpenCompModal, setShowOpenCompModal] = useState(false);
  const navigate = useNavigate();

  // Fetch open competitions on mount
  useEffect(() => {
    fetch('/api/competitions')
      .then(res => res.json())
      .then(data => {
        // Open = status is 'Open'
        const open = (data || []).filter(c => c.status === 'Open');
        setOpenComps(open);
      })
      .catch(() => setOpenComps([]));
  }, []);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    // Only admins/captains are blocked
    if (isAdmin(user) && openComps.length > 0) {
      setShowOpenCompModal(true);
      return;
    }
    // If fourballs entered, create comp in backend and then show group assignment
    if (form.fourballs && !showGroups) {
      try {
        const res = await fetch('/api/competitions', {
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
      const res = await fetch('/api/competitions', {
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
      const res = await fetch(`/api/competitions/${compId}/groups`, {
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

  if (created) {
    return (
      <PageBackground>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center border border-green-200">
            <div className="flex flex-col items-center mb-4">
              <span className="text-5xl mb-2" role="img" aria-label="Success">✅</span>
              <h2 className="text-2xl font-extrabold mb-2 drop-shadow" style={{ color: '#1B3A6B' }}>Competition Created!</h2>
            </div>
            <div className="mb-4 text-gray-700 text-center text-base font-medium">
              <p className="mb-1">Type: <span className="font-bold" style={{ color: '#1B3A6B' }}>{COMP_TYPE_DISPLAY[form.type] || form.type}</span></p>
              <p className="mb-1">Date: <span className="font-bold" style={{ color: '#1B3A6B' }}>{formatDate(form.date)}</span></p>
              <p className="mb-1">Club: <span className="font-bold" style={{ color: '#1B3A6B' }}>{form.club}</span></p>
              {form.fourballs && <p className="mb-1">4 Balls: <span className="font-bold" style={{ color: '#1B3A6B' }}>{form.fourballs}</span></p>}
              {form.notes && <p className="mb-1">Notes: <span className="font-bold" style={{ color: '#1B3A6B' }}>{form.notes}</span></p>}
            </div>
            <div className="flex gap-4 mt-6">
              <button
                className="px-5 py-2 rounded-2xl bg-[#1B3A6B] hover:bg-[#22457F] text-white font-semibold shadow transition"
                onClick={() => navigate('/dashboard')}
              >
                Dashboard
              </button>
              {compId && (
                <button
                  className="px-5 py-2 rounded-2xl bg-[#1B3A6B] hover:bg-[#22457F] text-white font-semibold shadow transition"
                  onClick={() => navigate(`/competition/${compId}`)}
                >
                  View Competition
                </button>
              )}
            </div>
          </div>
        </div>
      </PageBackground>
    );
  }

  return (
    <PageBackground>
      <OpenCompModal open={showOpenCompModal} onClose={() => setShowOpenCompModal(false)} />
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
        <div className="w-full max-w-4xl rounded-2xl p-8 flex flex-col gap-6 px-8" style={{ background: 'none', boxShadow: 'none' }}>
          {showGroups ? (
            <FourballAssignment
              fourballs={parseInt(form.fourballs) || 1}
              onAssign={handleAssign}
            />
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
              <div className="mb-4">
                <label className="block mb-1 font-medium text-white" htmlFor="date">Date</label>
                <div className="relative">
                  <DatePicker
                    id="date"
                    name="date"
                    selected={form.date}
                    onChange={date => setForm(f => ({ ...f, date }))}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="dd/mm/yyyy"
                    className="w-full border border-white bg-transparent text-white rounded px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-white placeholder-white/90"
                    calendarClassName="bg-[#18181b] text-white border border-white"
                    dayClassName={() => 'text-white'}
                    wrapperClassName="w-full"
                    minDate={today}
                    required
                  />
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none"
                    width="22" height="22" fill="white" viewBox="0 0 24 24"
                  >
                    <path d="M7 10h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z"/>
                    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zm0-13H5V6h14v1z"/>
                  </svg>
                  <style>{`
                    .react-datepicker__input-container input::placeholder {
                      color: rgba(255,255,255,0.9);
                      opacity: 1;
                    }
                    .react-datepicker__input-container input {
                      color: #fff;
                    }
                    .react-datepicker__header, .react-datepicker__current-month, .react-datepicker__day-name {
                      background: #18181b;
                      color: #fff;
                      border-bottom: 1px solid #fff;
                    }
                    .react-datepicker__day--selected, .react-datepicker__day--keyboard-selected {
                      background: #fff;
                      color: #18181b;
                    }
                  `}</style>
                </div>
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
            </form>
          )}
        </div>
      </div>
    </PageBackground>
  );
}
export default CreateCompetition;