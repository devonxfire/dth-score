// Helper: check if user is admin
function isAdmin(user) {
  return user && (user.role === 'admin' || user.isAdmin || user.isadmin);
}
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import React, { useState, useEffect } from 'react';
import { apiUrl } from './api';
import PageBackground from './PageBackground';
import OpenCompModal from './OpenCompModal';
import { useNavigate, useLocation } from 'react-router-dom';
import TopMenu from './TopMenu';
import UnifiedFourballAssignment from './UnifiedFourballAssignment';

// Display mapping for all comp types
const COMP_TYPE_DISPLAY = {
  fourBbbStableford: '4BBB Stableford',
  '4bbb stableford': '4BBB Stableford',
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


function CreateCompetition({ user, onSignOut }) {
  // Today's date for minDate
  const today = new Date();
  const location = useLocation();
  const navigate = useNavigate();
  // Detect if editing
  const editingComp = location.state?.comp;
  const [form, setForm] = useState(() => {
    if (editingComp) {
      return {
        type: editingComp.type || 'fourBbbStableford',
        date: editingComp.date ? new Date(editingComp.date) : null,
        club: editingComp.club || 'Westlake Golf Club',
        // Support both casing variants coming from backend: handicapallowance or handicapAllowance
        handicapAllowance: (editingComp.handicapallowance ?? editingComp.handicapAllowance) || '95',
        notes: editingComp.notes || '',
      };
    }
    return {
      type: 'fourBbbStableford',
      // default the date to today for convenience
      date: today,
      club: 'Westlake Golf Club',
      // default allowance for 4BBB should be 85%
      handicapAllowance: '85',
      notes: '',
    };
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
  const [joinCode, setJoinCode] = useState(editingComp?.joinCode || editingComp?.joincode || '');
  const [compId, setCompId] = useState(editingComp?.id || null);
  const [showGroups, setShowGroups] = useState(false);
  // Preload groups if editing
  const [groups, setGroups] = useState(editingComp?.groups || []);
  const [openComps, setOpenComps] = useState([]);
  const [showOpenCompModal, setShowOpenCompModal] = useState(false);

  // Fetch open competitions on mount
  useEffect(() => {
    fetch(apiUrl('/api/competitions'))
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
    // Only block for new comp creation, not editing
    if (!editingComp && isAdmin(user) && openComps.length > 0) {
      setShowOpenCompModal(true);
      return;
    }
    // If editing, PATCH the competition immediately
    if (editingComp) {
      try {
        const adminSecret = import.meta.env.VITE_ADMIN_SECRET || window.REACT_APP_ADMIN_SECRET || '';
        // Only include defined fields and always send date as string
        const updateData = {};
        if (form.type) updateData.type = form.type;
        if (form.date) {
          updateData.date = (form.date instanceof Date)
            ? form.date.toISOString()
            : form.date;
        }
        if (form.club) updateData.club = form.club;
        if (form.handicapAllowance) updateData.handicapAllowance = form.handicapAllowance;
        if (form.notes) updateData.notes = form.notes;
  const res = await fetch(apiUrl(`/api/competitions/${editingComp.id}`), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Secret': adminSecret
          },
          body: JSON.stringify(updateData)
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error('Failed to update competition: ' + errText);
        }
        // Fetch updated comp from backend
  const updatedRes = await fetch(apiUrl(`/api/competitions/${editingComp.id}`));
        let updatedComp = editingComp;
        if (updatedRes.ok) {
          updatedComp = await updatedRes.json();
        }
        // Update form state with latest comp info
        setForm(f => ({ ...f, 
          type: updatedComp.type,
          date: updatedComp.date ? new Date(updatedComp.date) : null,
          club: updatedComp.club,
          // backend may return either casing -- prefer provided value
          handicapAllowance: (updatedComp.handicapallowance ?? updatedComp.handicapAllowance),
          notes: updatedComp.notes
        }));
        // Overwrite editingComp for popup
  editingComp.type = updatedComp.type;
  editingComp.date = updatedComp.date;
  editingComp.club = updatedComp.club;
  // mirror backend casing when overwriting editingComp so further navigations/readers see the correct value
  editingComp.handicapallowance = updatedComp.handicapallowance ?? updatedComp.handicapAllowance;
  editingComp.handicapAllowance = updatedComp.handicapallowance ?? updatedComp.handicapAllowance;
  editingComp.notes = updatedComp.notes;
        // Now move to group assignment if fourballs entered
        if (form.fourballs && !showGroups) {
          setShowGroups(true);
          return;
        }
        setCreated(true);
      } catch (err) {
        alert('Error updating competition: ' + err.message);
      }
      return;
    }
    // Always show group assignment after creating comp
    try {
  const res = await fetch(apiUrl('/api/competitions'), {
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
  }

  async function handleAssign(groupsData) {
    setGroups(groupsData);
    const idToUse = compId || editingComp?.id;
    if (!idToUse) {
      alert('Competition id not found. Please create the competition first.');
      return;
    }
    try {
      // Always PATCH groups endpoint so teams table is updated
      const adminSecret = import.meta.env.VITE_ADMIN_SECRET || window.REACT_APP_ADMIN_SECRET || '';
  const res = await fetch(apiUrl(`/api/competitions/${idToUse}/groups`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Secret': adminSecret
        },
        body: JSON.stringify({ groups: groupsData })
      });
      if (!res.ok) throw new Error('Failed to save groups');
      setCreated(true);
    } catch (err) {
      alert('Error saving groups: ' + err.message);
    }
  }

  if (created) {
    const isEdit = !!editingComp;
    return (
      <PageBackground>
        <TopMenu user={user} onSignOut={onSignOut} />
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-jiggle">
          <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center border border-[#FFD700]">
            <div className="flex flex-col items-center mb-4">
              <svg className="mb-2" width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="24" cy="24" r="24" fill="#FFD700"/>
                <path d="M16 25.5L22 31.5L33 18.5" stroke="#002F5F" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2 className="text-2xl font-extrabold mb-2 drop-shadow text-center whitespace-nowrap" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif' }}>{isEdit ? 'Competition Updated!' : 'Competition Created!'}</h2>
            </div>
            <div className="mb-4 text-white text-center text-base font-medium" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>
              <p className="mb-1">Type: <span className="font-bold" style={{ color: '#FFD700' }}>{COMP_TYPE_DISPLAY[form.type] || form.type}</span></p>
              <p className="mb-1">Date: <span className="font-bold" style={{ color: '#FFD700' }}>{formatDate(form.date)}</span></p>
              <p className="mb-1">Club: <span className="font-bold" style={{ color: '#FFD700' }}>{form.club}</span></p>
              {form.fourballs && <p className="mb-1">4 Balls: <span className="font-bold" style={{ color: '#FFD700' }}>{form.fourballs}</span></p>}
              {form.notes && <p className="mb-1">Notes: <span className="font-bold" style={{ color: '#FFD700' }}>{form.notes}</span></p>}
            </div>
            <div className="flex gap-4 mt-6">
              <button
                className="px-5 py-2 rounded-lg bg-[#FFD700] hover:bg-[#F5D06F] text-[#002F5F] font-extrabold shadow"
                style={{ fontFamily: 'Merriweather, Georgia, serif' }}
                onClick={() => navigate('/dashboard')}
              >
                Dashboard
              </button>
              {compId && (
                <button
                  className="px-5 py-2 rounded-lg bg-[#FFD700] hover:bg-[#F5D06F] text-[#002F5F] font-extrabold shadow border border-[#002F5F] whitespace-nowrap"
                  style={{ fontFamily: 'Merriweather, Georgia, serif', whiteSpace: 'nowrap' }}
                  onClick={() => navigate(`/competition/${compId}`)}
                >
                  {isEdit ? 'View Competition' : 'View Competition'}
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
      <TopMenu user={user} onSignOut={onSignOut} />
      <OpenCompModal open={showOpenCompModal} onClose={() => setShowOpenCompModal(false)} />
      {(!showGroups) && (
        <div className="flex flex-col items-center px-4 mt-12">
          <div className="mb-10 w-full flex flex-col items-center">
            <h1
              className="text-4xl font-extrabold drop-shadow-lg text-center mb-1 leading-tight flex items-end justify-center gap-2"
              style={{ color: '#1B3A6B', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}
            >
              {editingComp ? 'Edit Competition' : 'Create Competition'}
            </h1>
            <div className="mx-auto mt-2 mb-4" style={{height: '2px', maxWidth: 340, width: '100%', background: 'white', opacity: 0.7, borderRadius: 2}}></div>
          </div>
          {/** Update 4 Balls button moved into the form and styled to match the Update Competition button. */}
        </div>
      )}
  <div className="relative z-10 flex flex-col items-center px-4 mt-2">
  <div className="w-full max-w-2xl rounded-2xl shadow-lg p-8 flex flex-col gap-6 border-4 border-[#FFD700]" style={{ background: 'rgba(0,47,95,0.95)', boxShadow: '0 2px 8px 0 rgba(0,47,95,0.10)' }}>
              {showGroups ? (
                // Add padding around the 4-ball assignment UI so content isn't flush to the blue container
                <div className="w-full p-6">
              {((form.type && ['medalStrokeplay', 'medal strokeplay', 'stroke', 'alliance'].includes((form.type || '').replace(/\s+/g, ''))) ? (
                ((form.type || '').toString().toLowerCase().includes('alliance')) ? (
                  <UnifiedFourballAssignment
                    compId={compId}
                    initialGroups={groups && groups.length > 0 ? groups : (editingComp?.groups || [])}
                    user={user}
                    onSignOut={onSignOut}
                    onAssign={handleAssign}
                    competitionType="alliance"
                    nested={true}
                  />
                ) : (
                  <UnifiedFourballAssignment
                    compId={compId}
                    initialGroups={groups && groups.length > 0 ? groups : (editingComp?.groups || [])}
                    user={user}
                    onSignOut={onSignOut}
                    onAssign={handleAssign}
                    competitionType="medal"
                    nested={true}
                  />
                )
              ) : (
                <UnifiedFourballAssignment
                  fourballs={1}
                  onAssign={handleAssign}
                  initialGroups={groups && groups.length > 0 ? groups : (editingComp?.groups || [])}
                  competitionType="fourball"
                  nested={true}
                />
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
              <div className="mb-4">
                <label className="block mb-1 font-bold" htmlFor="date" style={{ fontFamily: 'Lato, Arial, sans-serif', color: '#FFD700' }}>Date</label>
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
                      background: #FFD700;
                      color: #18181b;
                    }
                  `}</style>
                </div>
              </div>
              <div className="mb-4">
                <label className="block mb-1 font-bold" htmlFor="club" style={{ fontFamily: 'Lato, Arial, sans-serif', color: '#FFD700' }}>Club</label>
                <input
                  id="club"
                  name="club"
                  type="text"
                  value={form.club}
                  onChange={handleChange}
                  className="w-full border border-white bg-transparent text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white placeholder-white/70"
                  style={{ fontFamily: 'Lato, Arial, sans-serif' }}
                />
              </div>
              <div className="mb-4">
                <label className="block mb-1 font-bold" htmlFor="type" style={{ fontFamily: 'Lato, Arial, sans-serif', color: '#FFD700' }}>Competition Type</label>
                <select
                  id="type"
                  name="type"
                  value={form.type}
                  onChange={handleTypeChange}
                  className="w-full border border-white bg-transparent text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white"
                  style={{ fontFamily: 'Lato, Arial, sans-serif' }}
                >
                  <option value="fourBbbStableford">4BBB Stableford</option>
                  <option value="alliance">Alliance</option>
                  <option value="medalStrokeplay">Medal Strokeplay</option>
                  <option value="individualStableford">Individual Stableford</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block mb-1 font-bold" htmlFor="handicapAllowance" style={{ fontFamily: 'Lato, Arial, sans-serif', color: '#FFD700' }}>Competition Handicap Allowance</label>
                <select
                  id="handicapAllowance"
                  name="handicapAllowance"
                  value={form.handicapAllowance}
                  onChange={handleChange}
                  className="w-full border border-white bg-transparent text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white"
                  style={{ fontFamily: 'Lato, Arial, sans-serif' }}
                >
                  <option value="85">85%</option>
                  <option value="90">90%</option>
                  <option value="95">95%</option>
                  <option value="100">100%</option>
                </select>
              </div>
              <div className="mb-6">
                <label className="block mb-1 font-bold" htmlFor="notes" style={{ fontFamily: 'Lato, Arial, sans-serif', color: '#FFD700' }}>Notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  value={form.notes}
                  onChange={handleChange}
                  className="w-full border border-white bg-transparent text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white placeholder-white/70"
                  style={{ fontFamily: 'Lato, Arial, sans-serif' }}
                  placeholder="Optional notes (e.g. special rules, sponsor etc.)"
                />
              </div>
              {editingComp && (user && (user.role === 'admin' || user.isAdmin || user.isadmin || user.role === 'captain' || user.isCaptain)) && (
                <div className="w-full max-w-2xl mb-2 px-0">
                  <button
                    type="button"
                    onClick={() => {
                      // Navigate to assign page with current groups preloaded
                      navigate(`/assign-4balls/${editingComp.id}`, { state: { initialGroups: editingComp.groups || [] } });
                    }}
                    className="w-full py-3 px-4 border border-white text-[#1B3A6B] font-extrabold rounded-2xl transition text-lg"
                    style={{ backgroundColor: '#FFD700', boxShadow: '0 2px 8px 0 rgba(255,215,0,0.10)', fontFamily: 'Merriweather, Georgia, serif' }}
                    onMouseOver={e => e.currentTarget.style.backgroundColor = '#FFE066'}
                    onMouseOut={e => e.currentTarget.style.backgroundColor = '#FFD700'}
                  >
                    Update 4 Balls
                  </button>
                </div>
              )}
              <button
                type="submit"
                className="w-full py-3 px-4 border border-white text-white font-extrabold rounded-2xl transition text-lg"
                style={{ backgroundColor: '#FFD700', color: '#1B3A6B', boxShadow: '0 2px 8px 0 rgba(255,215,0,0.10)', fontFamily: 'Merriweather, Georgia, serif' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#FFE066'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = '#FFD700'}
              >
                {editingComp ? 'Update Competition' : 'Next: Assign 4 Balls'}
              </button>
            </form>
          )}
        </div>
      </div>
    </PageBackground>
  );
}
export default CreateCompetition;