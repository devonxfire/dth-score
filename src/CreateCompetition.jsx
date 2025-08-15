
import { useState } from 'react';
import PageBackground from './PageBackground';
import { useNavigate } from 'react-router-dom';
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


function CreateCompetition() {
  const [form, setForm] = useState({
    type: 'stroke',
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
    if (type === 'alliance' || type === '4bbb-stableford') {
      allowance = '85';
    } else if (type === 'medal-strokeplay' || type === 'individual-stableford') {
      allowance = '95';
    }
    setForm(prev => ({ ...prev, type, handicapAllowance: allowance }));
  }
  const [created, setCreated] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [showGroups, setShowGroups] = useState(false);
  const [groups, setGroups] = useState([]);
  const navigate = useNavigate();

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    // If fourballs entered, show group assignment
    if (form.fourballs && !showGroups) {
      setShowGroups(true);
      return;
    }
    // Otherwise, finalize comp creation
    const code = generateJoinCode();
    setJoinCode(code);
    localStorage.setItem(
      `comp_${code}`,
      JSON.stringify({ ...form, joinCode: code, code, groups })
    );
    setCreated(true);
  }

  function handleAssign(groupsData) {
    setGroups(groupsData);
    // Save comp with groups immediately
    const code = generateJoinCode();
    setJoinCode(code);
    localStorage.setItem(
      `comp_${code}`,
      JSON.stringify({ ...form, joinCode: code, code, groups: groupsData })
    );
    setCreated(true);
  }

  return (
    <PageBackground>
      <div className="flex flex-col items-center min-h-screen justify-center px-4">
        <div className="flex flex-col items-center px-4 mt-12">
          <h2 className="text-5xl font-bold text-white mb-1 drop-shadow-lg text-center">Create Competition</h2>
          <p className="text-xl text-white mb-6 drop-shadow text-center">Set up a new golf competition below.</p>
        </div>
        <div className="flex flex-col items-center px-4 mt-8 w-full">
          <div className="w-full max-w-md rounded-2xl shadow-lg bg-transparent" style={{ backdropFilter: 'none' }}>
            {created ? (
              <div className="text-white text-center p-6">
                <h3 className="text-xl font-semibold mb-2">Competition Created!</h3>
                <p className="mb-2">Type: <span className="font-medium capitalize">{form.type}</span></p>
                <p className="mb-2">Date: <span className="font-medium">{formatDate(form.date)}</span></p>
                <p className="mb-2">Club: <span className="font-medium">{form.club}</span></p>
                {form.fourballs && <p className="mb-2">4 Balls: <span className="font-medium">{form.fourballs}</span></p>}
                {form.notes && <p className="mb-2">Notes: <span className="font-medium">{form.notes}</span></p>}
                <p className="mt-4 text-green-200 font-bold">Share the join code: <span className="bg-white/20 px-2 py-1 rounded text-white">{joinCode}</span></p>
                <p className="mt-2 text-white/80">Invite others to join your competition by sending them the join code above.</p>
                <button
                  className="mt-6 py-2 px-6 bg-transparent border border-white text-white rounded-2xl font-semibold hover:bg-white hover:text-black transition"
                  onClick={() => navigate('/')}
                >
                  Back to Home
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
                    <option value="4bbb-stableford">4BBB Stableford (2 Scores to Count)</option>
                    <option value="alliance">Alliance</option>
                    <option value="medal-strokeplay">Medal Strokeplay</option>
                    <option value="individual-stableford">Individual Stableford</option>
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
                <button type="submit" className="w-full py-2 px-4 bg-transparent border border-white text-white font-semibold rounded-2xl hover:bg-white hover:text-black transition">Next: Assign 4 Balls</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </PageBackground>
  );
}
export default CreateCompetition;
