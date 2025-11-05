import React, { useState, useEffect } from "react";
import { apiUrl } from './api';
import OpenCompModal from './OpenCompModal';
import { PlusIcon, EyeIcon, PencilSquareIcon, ScissorsIcon, XMarkIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import PageBackground from './PageBackground';
import TopMenu from './TopMenu';


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
  // All useState declarations must come first
  const [competitionList, setCompetitionList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteCompId, setDeleteCompId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [openComps, setOpenComps] = useState([]);
  const [showOpenCompModal, setShowOpenCompModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Debug: log open competitions whenever they change
  useEffect(() => {
  }, [openComps]);

    // (removed debug logging)

  // useEffect for debug logging can be removed

  // Helper to fetch competitions and update state
  async function fetchCompetitions() {
    setLoading(true);
    try {
  const res = await fetch(apiUrl('/api/competitions'));
      const data = await res.json();
      setCompetitionList(data);
    try { window.dispatchEvent(new CustomEvent('competitionsUpdated', { detail: data })); } catch (e) {}
      const open = (data || []).filter(c => c.status === 'Open');
      setOpenComps(open);
    } catch {
      setCompetitionList([]);
      setOpenComps([]);
  try { window.dispatchEvent(new CustomEvent('competitionsUpdated', { detail: [] })); } catch (e) {}
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    fetchCompetitions();
  }, []);

  // Find the comp the user is a player in (robust, like CompetitionInfo)
  let userComp = null;
  if (user && user.name && competitionList.length) {
    const today = new Date();
    function nameMatch(a, b) {
      if (!a || !b) return false;
      const normA = a.trim().toLowerCase();
      const normB = b.trim().toLowerCase();
      return normA && normB && (normA === normB || (normA.length > 1 && normB.includes(normA)) || (normB.length > 1 && normA.includes(normB)));
    }
    // Find any comp (open or closed) where user is in a group (players or displayNames)
    const compsWithUser = competitionList.filter(comp => {
      if (!Array.isArray(comp.groups)) return false;
      return comp.groups.some(g =>
        (Array.isArray(g.players) && g.players.some(p => nameMatch(p, user.name))) ||
        (Array.isArray(g.displayNames) && g.displayNames.some(p => nameMatch(p, user.name)))
      );
    });
    if (compsWithUser.length > 0) {
      // Prefer open comps, then most recent
      const openComps = compsWithUser.filter(comp => {
        if (!comp.date) return false;
        const compDate = new Date(comp.date);
        return compDate >= new Date(today.getFullYear(), today.getMonth(), today.getDate());
      });
      if (openComps.length > 0) {
        openComps.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        userComp = openComps[0];
      } else {
        compsWithUser.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        userComp = compsWithUser[0];
      }
    } else {
      userComp = competitionList.find(comp => comp.users && comp.users.some(u => nameMatch(u.name, user.name)));
    }
  }

  // Actually delete competition from DB
  async function handleDelete(id) {
    if (!id) return;
    setDeleting(true);
    try {
  // Use apiUrl helper
  const deleteUrl = apiUrl(`/api/competitions/${id}`);
      const adminSecret = import.meta.env.VITE_ADMIN_SECRET || window.REACT_APP_ADMIN_SECRET || '';
      if (!adminSecret) {
        alert('Admin secret missing. Set REACT_APP_ADMIN_SECRET in your .env file.');
        setDeleting(false);
        return;
      }
  const res = await fetch(deleteUrl, {
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
      // Immediately re-fetch competitions to update openComps
      await fetchCompetitions();
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
  // (removed duplicate navigate and location)
  return (
    <PageBackground>
      <div>
  {/* Modal for open competition block */}
  <OpenCompModal open={showOpenCompModal} onClose={() => setShowOpenCompModal(false)} messageType={showOpenCompModal === 'reopen' ? 'reopen' : 'create'} />
        {/* Top nav menu */}
  <TopMenu user={user} userComp={userComp} competitionList={competitionList} />
  <div className="flex flex-col items-center px-4 mt-12">
          <div className="mb-10">
            <h1 className="text-4xl font-extrabold drop-shadow-lg text-center mb-1 leading-tight flex items-end justify-center gap-2" style={{ color: '#002F5F', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>
              Competitions
            </h1>
            <div className="mx-auto mt-2 mb-4" style={{height: '2px', maxWidth: 340, background: 'white', opacity: 0.7, borderRadius: 2}}></div>
          </div>
          <div className="w-full max-w-4xl bg-transparent text-white mb-8 px-8" style={{ backdropFilter: 'none' }}>
            {isAdmin(user) && (
              <div className="mb-8 sm:mb-4 flex justify-center sm:justify-start">
                <button
                  className="flex flex-row items-center gap-2 py-2 px-6 border border-white text-white font-extrabold rounded-2xl transition text-lg bg-[#1B3A6B] hover:bg-white hover:text-[#1B3A6B]"
                  style={{ boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)', fontFamily: 'Merriweather, Georgia, serif' }}
                  onClick={() => {
                    if (openComps.length > 0) {
                      setShowOpenCompModal('create');
                    } else {
                      navigate('/create');
                    }
                  }}
                >
                  <PlusIcon className="h-5 w-5 mr-1" />
                  Create New Competition
                </button>
              </div>
            )}
            {/* Mobile: stacked table rows for better responsiveness (keeps table feel) */}
            <table className="w-full sm:hidden border-collapse text-base shadow-xl overflow-hidden bg-white/10" style={{ fontFamily: 'Lato, Arial, sans-serif', background: '#002F5F', color: 'white', borderColor: '#FFD700', borderRadius: 8, border: '2px solid #FFD700' }}>
              <tbody>
                {loading ? (
                  <tr><td className="px-3 py-4 text-white/80">Loading competition data...</td></tr>
                ) : competitionList.length === 0 ? (
                  <tr><td className="px-3 py-4 text-white/80">No competitions found.</td></tr>
                ) : competitionList.map((comp, idx) => {
                  const keyBase = comp.id || comp.joinCode || comp.joincode || idx;
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
                    <React.Fragment key={keyBase + '-mobile'}>
                      <tr className={`border-b border-white/20 ${status === 'Closed' ? 'bg-gray-800/60' : ''}`}>
                        <td className="px-3 py-3"><strong className="text-[#FFD700]">Date:</strong> <span className={`${status === 'Closed' ? 'text-gray-300' : 'text-white'}`}>{formatDate(comp.date)}</span></td>
                      </tr>
                      <tr className={`border-b border-white/20 ${status === 'Closed' ? 'bg-gray-800/60' : ''}`}>
                        <td className="px-3 py-3"><strong className="text-[#FFD700]">Type:</strong> <span className={`${status === 'Closed' ? 'text-gray-300' : 'text-white'}`}>{COMP_TYPE_DISPLAY[comp.type] || comp.type || ''}</span></td>
                      </tr>
                      <tr className={`border-b border-white/20 ${status === 'Closed' ? 'bg-gray-800/60' : ''}`}>
                        <td className="px-3 py-3"><strong className="text-[#FFD700]">Course:</strong> <span className={`${status === 'Closed' ? 'text-gray-300' : 'text-white'}`}>{comp.club || comp.joinCode || comp.joincode || '-'}</span></td>
                      </tr>
                      <tr className={`border-b border-white/20 ${status === 'Closed' ? 'bg-gray-800/60' : ''}`}>
                        <td className="px-3 py-3"><strong className="text-[#FFD700]">Status:</strong> <span className={`px-2 py-1 rounded ${status === 'Open' ? 'bg-[#1B3A6B] text-white' : 'text-gray-300'}`}>{status}</span></td>
                      </tr>
                      <tr className={`border-b border-white/20 ${status === 'Closed' ? 'bg-gray-800/60' : ''}`}>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-2">
                            {/* Info button: disabled when Closed */}
                            <button
                              onClick={() => { if (status !== 'Closed') navigate(`/competition/${comp.joinCode || comp.joincode || comp.id}`, { state: { comp } }); }}
                              className={status === 'Closed' ? 'w-full py-2 rounded-2xl bg-gray-700 text-gray-400 font-semibold flex items-center justify-center gap-2 cursor-not-allowed' : 'w-full py-2 rounded-2xl bg-[#FFD700] text-[#002F5F] font-semibold flex items-center justify-center gap-2'}
                              disabled={status === 'Closed'}
                            >
                              <EyeIcon className="h-5 w-5" />
                              <span>Info</span>
                            </button>
                            {isAdmin(user) && (
                              <>
                                {/* Edit button: disabled when Closed */}
                                <button
                                  onClick={() => { if (status !== 'Closed') navigate(`/competition/${comp.joinCode || comp.joincode || comp.id}/edit`, { state: { comp } }); }}
                                  className={status === 'Closed' ? 'w-full py-2 rounded-2xl bg-gray-700 text-gray-400 font-semibold flex items-center justify-center gap-2 cursor-not-allowed' : 'w-full py-2 rounded-2xl bg-[#FFD700] text-[#002F5F] font-semibold flex items-center justify-center gap-2'}
                                  disabled={status === 'Closed'}
                                >
                                  <ScissorsIcon className="h-5 w-5" />
                                  <span>Edit</span>
                                </button>
                                {/* End / Re-open button */}
                                <button
                                  onClick={async () => {
                                    if (status !== 'Open' && openComps.length > 0) { setShowOpenCompModal('reopen'); return; }
                                    const newStatus = status === 'Open' ? 'Closed' : 'Open';
                                    const patchUrl = apiUrl(`/api/competitions/${comp.id}`);
                                    const adminSecret = import.meta.env.VITE_ADMIN_SECRET || window.REACT_APP_ADMIN_SECRET || '';
                                    if (!adminSecret) { alert('Admin secret missing.'); return; }
                                    try {
                                      const res = await fetch(patchUrl, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': adminSecret }, body: JSON.stringify({ status: newStatus }) });
                                      if (!res.ok) { const txt = await res.text(); alert('Failed: ' + txt); return; }
                                      await fetchCompetitions();
                                    } catch (e) { alert('Error: ' + (e?.message || e)); }
                                  }}
                                  className={status === 'Open' ? 'w-full py-2 rounded-2xl bg-[#FFD700] text-[#002F5F] font-semibold flex items-center justify-center gap-2' : 'w-full py-2 rounded-2xl bg-[#FFD700] text-[#002F5F] font-semibold flex items-center justify-center gap-2'}
                                >
                                  {status === 'Open' ? <XMarkIcon className="h-5 w-5" /> : <ArrowPathIcon className="h-5 w-5" />}
                                  <span>{status === 'Open' ? 'End' : 'Re-open'}</span>
                                </button>
                                <button onClick={() => { setShowDeleteModal(true); setDeleteCompId(comp.id); }} className="w-full py-2 rounded-2xl bg-red-600 text-white font-semibold flex items-center justify-center gap-2">
                                  <TrashIcon className="h-5 w-5" />
                                  <span>Delete</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            {/* Desktop table (hidden on small screens) */}
            <div className="hidden sm:block">
            <table className="w-full border-collapse text-base shadow-xl overflow-hidden bg-white/10" style={{ fontFamily: 'Lato, Arial, sans-serif', background: '#002F5F', color: 'white', borderColor: '#FFD700' }}>
              <thead>
                <tr style={{ background: '#00204A' }}>
                  <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Date</th>
                  <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Type</th>
                  <th className="border px-2 py-1" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Course</th>
                  <th className="border px-2 py-1 w-[100px] text-center" style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Status</th>
                  <th className={`border border-white px-2 py-1${isAdmin(user) ? ' w-[260px]' : ''}`} style={{background:'#002F5F',color:'#FFD700', borderColor:'#FFD700', fontFamily:'Merriweather, Georgia, serif'}}>Action</th>
                </tr>
              </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="border px-2 py-4 text-white/80">Loading competition data...</td>
                </tr>
              ) : competitionList.length === 0 ? (
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
                  <tr key={keyBase + '-info'} className={`border${status === 'Closed' ? ' bg-gray-800/60' : ''}`}> 
                    <td className={`border px-2 py-1${status === 'Closed' ? ' text-gray-300' : ''}`}>{formatDate(comp.date)}</td>
                    <td className={`border px-2 py-1 whitespace-nowrap${status === 'Closed' ? ' text-gray-300' : ''}`}>{COMP_TYPE_DISPLAY[comp.type] || comp.type || ''}</td>
                    <td className={`border px-2 py-1 whitespace-nowrap${status === 'Closed' ? ' text-gray-300' : ''}`}>{comp.club || comp.joinCode || comp.joincode || '-'}</td>
                    <td className={
                      `border border-white px-2 py-1 text-center align-middle w-[100px] ${
                        status === 'Open'
                          ? 'bg-[#1B3A6B] text-white'
                          : status === 'Closed'
                            ? 'text-gray-300'
                            : ''
                      }`
                    }>
                      {status}
                    </td>
                    <td className={`border px-2 py-1${isAdmin(user) ? ' w-[260px]' : ''}`}>
                      <div className={`flex flex-row gap-2 items-center${isAdmin(user) ? ' w-full justify-between' : ' justify-center'}`}>
                        <button
                          className={`py-1 px-3 flex items-center gap-1 border font-semibold rounded-2xl transition ${status === 'Closed' ? 'bg-gray-700 border-gray-500 text-gray-400 cursor-not-allowed' : 'border-[#FFD700] text-[#002F5F] bg-[#FFD700] hover:bg-[#F5D06F] hover:text-[#002F5F]'}`}
                          style={{ boxShadow: '0 2px 8px 0 rgba(255,215,0,0.10)', fontFamily: 'Merriweather, Georgia, serif' }}
                          onClick={() => {
                            if (status !== 'Closed') navigate(`/competition/${comp.joinCode || comp.joincode || comp.id}`, { state: { comp } });
                          }}
                          disabled={status === 'Closed'}
                        >
                          <EyeIcon className="h-5 w-5 mr-1" /> Info
                        </button>
                        {isAdmin(user) && (
                          <>
                            <button
                              className={`py-1 px-3 flex items-center gap-1 border font-semibold rounded-2xl transition ${status === 'Closed' ? 'bg-gray-700 border-gray-500 text-gray-400 cursor-not-allowed' : 'border-[#FFD700] text-[#002F5F] bg-[#FFD700] hover:bg-[#F5D06F] hover:text-[#002F5F]'}`}
                              style={{ boxShadow: '0 2px 8px 0 rgba(255,215,0,0.10)', fontFamily: 'Merriweather, Georgia, serif' }}
                              onClick={() => {
                                if (status !== 'Closed') navigate(`/competition/${comp.joinCode || comp.joincode || comp.id}/edit`, { state: { comp } });
                              }}
                              disabled={status === 'Closed'}
                            >
                              <ScissorsIcon className="h-5 w-5 mr-1" /> Edit
                            </button>
                            {(() => {
                              const endBtnClass = "py-1 px-6 min-w-[115px] flex items-center gap-1 border border-[#FFD700] text-[#002F5F] font-semibold rounded-2xl transition bg-[#FFD700] hover:bg-[#F5D06F] hover:text-[#002F5F] whitespace-nowrap";
                              const reopenBtnClass = "py-1 px-3 min-w-[80px] flex items-center gap-1 border border-[#FFD700] text-[#002F5F] font-semibold rounded-2xl transition bg-[#FFD700] hover:bg-[#F5D06F] hover:text-[#002F5F] whitespace-nowrap";
                              return (
                                <button
                                  className={status === 'Open' ? endBtnClass : reopenBtnClass}
                                  style={{ boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                                  onClick={async () => {
                                    // Prevent re-opening if another competition is already open
                                    if (status !== 'Open' && openComps.length > 0) {
                                      setShowOpenCompModal('reopen');
                                      return;
                                    }
                                    // Toggle comp status between Open and Closed
                                    const newStatus = status === 'Open' ? 'Closed' : 'Open';
                                    const patchUrl = apiUrl(`/api/competitions/${comp.id}`);
                                    const adminSecret = import.meta.env.VITE_ADMIN_SECRET || window.REACT_APP_ADMIN_SECRET || '';
                                    if (!adminSecret) {
                                      alert('Admin secret missing. Set REACT_APP_ADMIN_SECRET in your .env file.');
                                      return;
                                    }
                                    try {
                                      const res = await fetch(patchUrl, {
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
                                      // After successful toggle, re-fetch competitions to update openComps
                                      await fetchCompetitions();
                                    } catch (err) {
                                      console.error('PATCH exception:', err);
                                      alert('Error updating competition status: ' + (err?.message || err));
                                    }
                                  }}
                                  disabled={deleting}
                                >
                                  {status === 'Open' ? <XMarkIcon className="h-5 w-5 mr-1" /> : <ArrowPathIcon className="h-5 w-5 mr-1" />}
                                  {status === 'Open' ? 'End' : 'Re-open'}
                                </button>
                              );
                            })()}
                            <button
                              className="py-1 px-3 flex items-center gap-1 border text-white font-semibold rounded-2xl transition"
                              style={{
                                backgroundColor: '#dc2626', // Tailwind red-600
                                borderColor: '#dc2626',
                                boxShadow: '0 2px 8px 0 rgba(220,38,38,0.10)'
                              }}
                              onMouseOver={e => {
                                e.currentTarget.style.backgroundColor = '#b91c1c'; // Tailwind red-700
                                e.currentTarget.style.borderColor = '#b91c1c';
                              }}
                              onMouseOut={e => {
                                e.currentTarget.style.backgroundColor = '#dc2626';
                                e.currentTarget.style.borderColor = '#dc2626';
                              }}
                              onClick={() => { setShowDeleteModal(true); setDeleteCompId(comp.id); }}
                              disabled={deleting}
                            >
                              <TrashIcon className="h-5 w-5 mr-1" /> Delete
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
        </div>
        {/* Delete Competition Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center border-4 border-[#FFD700]">
              <div className="flex flex-col items-center mb-4">
                <span className="text-5xl mb-2" role="img" aria-label="Warning">⚠️</span>
                <h2 className="text-3xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>Delete Competition?</h2>
              </div>
              <p className="mb-6 text-white text-center text-base font-medium" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>This will <span className='font-bold' style={{ color: '#FFD700' }}>permanently delete this competition and all its data</span>.<br/>This action cannot be undone.<br/><br/>Are you sure you want to delete?</p>
              <div className="flex gap-4 w-full justify-center">
                <button
                  className="px-5 py-2 rounded-2xl font-bold shadow border border-white transition text-lg"
                  style={{ backgroundColor: '#888', color: 'white', fontFamily: 'Lato, Arial, sans-serif' }}
                  onClick={() => { setShowDeleteModal(false); setDeleteCompId(null); }}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  className="px-5 py-2 rounded-2xl font-bold shadow border border-white transition text-lg"
                  style={{ backgroundColor: '#FFD700', color: '#002F5F', fontFamily: 'Lato, Arial, sans-serif', boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)' }}
                  onMouseOver={e => e.currentTarget.style.backgroundColor = '#ffe066'}
                  onMouseOut={e => e.currentTarget.style.backgroundColor = '#FFD700'}
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