import { useState, useEffect } from "react";
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteCompId, setDeleteCompId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [openComps, setOpenComps] = useState([]);
  const [showOpenCompModal, setShowOpenCompModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Debug: log open competitions whenever they change
  useEffect(() => {
    console.log('Open competitions:', openComps);
  }, [openComps]);

    // Debug: log open competitions whenever they change
    useEffect(() => {
      console.log('Open competitions:', openComps);
    }, [openComps]);

  // useEffect for debug logging can be removed

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
  useEffect(() => {
    fetchCompetitions();
  }, []);

  // Check if user is a player in any competition (must be after competitionList is declared)
  const isPlayerInComp = competitionList.some(comp => {
    if (!user?.name || !comp?.users) return false;
    return comp.users.some(u => u.name === user.name);
  });

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
  // (removed duplicate navigate and location)
  return (
    <PageBackground>
      <div>
  {/* Modal for open competition block */}
  <OpenCompModal open={showOpenCompModal} onClose={() => setShowOpenCompModal(false)} />
        {/* Top nav menu */}
        <TopMenu user={user} isPlayerInComp={isPlayerInComp} competitionList={competitionList} />
  <div className="flex flex-col items-center px-4 mt-12">
          <div className="mb-10">
            <h1 className="text-4xl font-extrabold drop-shadow-lg text-center mb-1 leading-tight flex items-end justify-center gap-2" style={{ color: '#002F5F', fontFamily: 'Merriweather, Georgia, serif', letterSpacing: '1px' }}>
              Competitions
            </h1>
            <div className="mx-auto mt-2 mb-4" style={{height: '2px', maxWidth: 340, background: 'white', opacity: 0.7, borderRadius: 2}}></div>
          </div>
          <div className="w-full max-w-4xl bg-transparent text-white mb-8 px-8" style={{ backdropFilter: 'none' }}>
            {isAdmin(user) && (
              <div className="mb-4">
                <button
                  className="flex flex-row items-center gap-2 py-2 px-6 border border-white text-white font-extrabold rounded-2xl transition text-lg bg-[#1B3A6B] hover:bg-white hover:text-[#1B3A6B]"
                  style={{ boxShadow: '0 2px 8px 0 rgba(27,58,107,0.10)', fontFamily: 'Merriweather, Georgia, serif' }}
                  onClick={() => {
                    console.log('Create New Competition clicked. openComps:', openComps);
                    if (openComps.length > 0) {
                      setShowOpenCompModal(true);
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