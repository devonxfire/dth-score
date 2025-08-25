import { useState, useEffect } from "react";
import OpenCompModal from './OpenCompModal';
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import PageBackground from './PageBackground';


// Format date as DD/MM/YYYY
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// Helper: check if user is admin
function isAdmin(user) {
  return user && (user.role === 'admin' || user.isAdmin || user.isadmin);
}

function RecentCompetitions({ user = {}, comps = [] }) {
  // Helper to fetch competitions and update state
  async function fetchCompetitions() {
    try {
      const res = await fetch('/api/competitions');
      const data = await res.json();
      setCompetitionList(data);
      const open = (data || []).filter(c => c.status === 'Open');
      setOpenComps(open);
    } catch {
      setCompetitionList([]);
      setOpenComps([]);
    }
  }
  const [competitionList, setCompetitionList] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteCompId, setDeleteCompId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [openComps, setOpenComps] = useState([]);
  const [showOpenCompModal, setShowOpenCompModal] = useState(false);
  useEffect(() => {
  fetchCompetitions();
  }, []);

  // Actually delete competition from DB
  async function handleDelete(id) {
    if (!id) return;
    setDeleting(true);
    try {
  // Always use relative URL so Vite proxy works in dev
  const apiUrl = `/api/competitions/${id}`;
  // IMPORTANT: Set REACT_APP_ADMIN_SECRET in your .env file (must start with REACT_APP_)
  // and restart the frontend. Vite exposes these as import.meta.env.VITE_*
  const adminSecret = import.meta.env.VITE_ADMIN_SECRET || window.REACT_APP_ADMIN_SECRET || '';
      if (!adminSecret) {
        alert('Admin secret missing. Set REACT_APP_ADMIN_SECRET in your .env file.');
        setDeleting(false);
        return;
      }
      const res = await fetch(apiUrl, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Secret': adminSecret
        }
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error('Delete error:', errText);
        alert('Failed to delete competition: ' + errText);
        setDeleting(false);
        return;
      }
      setCompetitionList(prev => prev.filter(c => c.id !== id));
      setShowDeleteModal(false);
      setDeleteCompId(null);
    } catch (err) {
      alert('Error deleting competition: ' + (err?.message || err));
    } finally {
      setDeleting(false);
    }
  }
  // User-friendly display names for competition types
  const COMP_TYPE_DISPLAY = {
    fourBbbStableford: '4BBB Stableford',
    alliance: 'Alliance',
    medalStrokeplay: 'Medal Strokeplay',
    medal_strokeplay: 'Medal Strokeplay',
    individualStableford: 'Individual Stableford',
    individual_stableford: 'Individual Stableford',
    ...((typeof window !== 'undefined' && window.COMP_TYPE_DISPLAY) || {})
  };
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <PageBackground>
      <div>
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
            Welcome, {(user?.name?.split(' ')[0]) || 'Player'}!
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
        <div className="flex flex-col items-center px-4 mt-8">
          {isAdmin(user) && (
            <>
              <button
                className="mb-6 py-2 px-6 border border-white text-white font-semibold rounded-2xl transition text-lg bg-[#1B3A6B] hover:bg-white hover:text-[#1B3A6B]"
                style={{ boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                onClick={() => {
                  if (openComps.length > 0) {
                    setShowOpenCompModal(true);
                  } else {
                    navigate('/create');
                  }
                }}
              >
                Add New Competition
              </button>
              <OpenCompModal open={showOpenCompModal} onClose={() => setShowOpenCompModal(false)} />
            </>
          )}
          <h1 className="text-3xl font-bold mb-6 text-white drop-shadow-lg">Recent Competitions</h1>
        <div className="w-full max-w-4xl bg-transparent text-white mb-8 px-8" style={{ backdropFilter: 'none' }}>
          <table className="min-w-full border text-center mb-6">
            <thead>
              <tr className="bg-white/10">
                <th className="border px-2 py-1">Date</th>
                <th className="border px-2 py-1">Type</th>
                <th className="border px-2 py-1">Course</th>
                <th className="border px-2 py-1">Status</th>
                {isAdmin(user) && <th className="border px-2 py-1">Action</th>}
              </tr>
            </thead>
            <tbody>
              {competitionList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border px-2 py-4 text-white/80">No competitions found.</td>
                </tr>
              ) : competitionList.map((comp, idx) => {
                const keyBase = comp.id || comp.joinCode || comp.joincode || idx;
                // Use status from DB if present, otherwise fallback to old logic
                let status = comp.status;
                if (!status) {
                  status = 'Open';
                  if (comp._forceClosed) {
                    status = 'Closed';
                  } else if (comp.date) {
                    const today = new Date();
                    const compDate = new Date(comp.date);
                    if (compDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
                      status = 'Closed';
                    }
                  }
                }
                return (
                  <tr key={keyBase + '-info'} className="border">
                    <td className="border px-2 py-1">{formatDate(comp.date)}</td>
                    <td className="border px-2 py-1">{COMP_TYPE_DISPLAY[comp.type] || comp.type || ''}</td>
                    <td className="border px-2 py-1">{comp.club || comp.joinCode || comp.joincode || '-'}</td>
                    <td className="border px-2 py-1">{status}</td>
                    <td className="border px-2 py-1">
                      <div className="flex flex-row gap-2 justify-center items-center">
                        <button
                          className="py-1 px-3 border border-white text-white font-semibold rounded-2xl transition bg-[#1B3A6B] hover:bg-white hover:text-[#1B3A6B]"
                          style={{ boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                          onClick={() => navigate(`/competition/${comp.joinCode || comp.joincode || comp.id}`, { state: { comp } })}
                        >
                          Info
                        </button>
                        {isAdmin(user) && (
                          <>
                            <button
                              className="py-1 px-3 border border-blue-400 text-blue-900 font-semibold rounded-2xl transition bg-blue-100 hover:bg-blue-200"
                              style={{ boxShadow: '0 2px 8px 0 rgba(33,150,243,0.10)' }}
                              onClick={() => navigate(`/competition/${comp.joinCode || comp.joincode || comp.id}/edit`, { state: { comp } })}
                            >
                              Edit
                            </button>
                            {isAdmin(user) && (
                              <button
                                className="py-1 px-3 bg-yellow-400 text-[#1B3A6B] font-bold rounded-2xl border border-white transition hover:bg-yellow-500 shadow"
                                style={{ boxShadow: '0 2px 8px 0 rgba(255,193,7,0.10)' }}
                                onClick={async () => {
                                  // Toggle comp status between Open and Closed
                                  const newStatus = status === 'Open' ? 'Closed' : 'Open';
                                  const apiUrl = `/api/competitions/${comp.id}`;
                                  const adminSecret = import.meta.env.VITE_ADMIN_SECRET || window.REACT_APP_ADMIN_SECRET || '';
                                  if (!adminSecret) {
                                    alert('Admin secret missing. Set REACT_APP_ADMIN_SECRET in your .env file.');
                                    return;
                                  }
                                  try {
                                    const res = await fetch(apiUrl, {
                                      method: 'PATCH',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        'X-Admin-Secret': adminSecret
                                      },
                                      body: JSON.stringify({ status: newStatus })
                                    });
                                    const responseText = await res.text();
                                    if (!res.ok) {
                                      console.error('PATCH error:', res.status, responseText);
                                      alert(`Failed to update competition status: [${res.status}] ${responseText}`);
                                      return;
                                    }
                                    let updated;
                                    try {
                                      updated = JSON.parse(responseText);
                                    } catch (e) {
                                      updated = null;
                                    }
                                    console.log('PATCH success:', updated);
                                    // After successful toggle, re-fetch competitions to update openComps
                                    await fetchCompetitions();
                                  } catch (err) {
                                    console.error('PATCH exception:', err);
                                    alert('Error updating competition status: ' + (err?.message || err));
                                  }
                                }}
                                disabled={deleting}
                              >
                                {status === 'Open' ? 'End Comp' : 'Reopen'}
                              </button>
                            )}
                            <button
                              className="py-1 px-3 bg-red-600 text-white font-bold rounded-2xl border border-white transition hover:bg-red-700 shadow"
                              style={{ boxShadow: '0 2px 8px 0 rgba(255,0,0,0.10)' }}
                              onClick={() => { setShowDeleteModal(true); setDeleteCompId(comp.id); }}
                              disabled={deleting}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Delete Competition Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center border border-red-200">
              <div className="flex flex-col items-center mb-4">
                <span className="text-5xl mb-2" role="img" aria-label="Warning">⚠️</span>
                <h2 className="text-2xl font-extrabold mb-2 drop-shadow" style={{ color: '#1B3A6B' }}>Delete Competition?</h2>
              </div>
              <p className="mb-6 text-gray-700 text-center text-base font-medium">This will <span className='font-bold' style={{ color: '#1B3A6B' }}>permanently delete this competition and all its data</span>.<br/>This action cannot be undone.<br/><br/>Are you sure you want to delete?</p>
              <div className="flex gap-4 w-full justify-center">
                <button
                  className="px-5 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold shadow"
                  onClick={() => { setShowDeleteModal(false); setDeleteCompId(null); }}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  className="px-5 py-2 rounded-2xl font-bold shadow border border-white transition text-lg"
                  style={{ backgroundColor: '#1B3A6B', color: 'white', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                  onMouseOver={e => e.currentTarget.style.backgroundColor = '#22457F'}
                  onMouseOut={e => e.currentTarget.style.backgroundColor = '#1B3A6B'}
                  onClick={() => handleDelete(deleteCompId)}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </PageBackground>
  );
}

export default RecentCompetitions;