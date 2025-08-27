import './pdfExportPlain.css';
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
// Helper: check if user is admin
function isAdmin(user) {
  return user && (user.role === 'admin' || user.isAdmin || user.isadmin);
}
import PageBackground from './PageBackground';
import TopMenu from './TopMenu';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Medal Results Page UI (fetches real data)
export default function ResultsMedal() {
  const { id } = useParams();
  // Modal state for email PDF
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");

  // Email PDF handler
  const handleEmailPDF = async () => {
    setEmailError("");
    setEmailSuccess("");
    setEmailSending(true);
    if (!plainExportRef.current) {
      setEmailError("PDF export ref not set");
      setEmailSending(false);
      return;
    }
    const element = plainExportRef.current;
    element.style.display = 'block';
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#fff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgWidth = pageWidth - 40;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 20, 20, imgWidth, imgHeight);
      const pdfBlob = pdf.output('blob');
      const formData = new FormData();
      formData.append('email', emailAddress);
      formData.append('pdf', pdfBlob, 'results.pdf');
      const res = await fetch('/api/email-pdf', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Failed to send email');
      setEmailSuccess('Email sent successfully!');
      setShowEmailModal(false);
    } catch (err) {
      setEmailError('Error sending email: ' + err.message);
    } finally {
      element.style.display = 'none';
      setEmailSending(false);
    }
  };
  const navigate = useNavigate();
  const location = useLocation();
  const [competition, setCompetition] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Get current user from localStorage
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    if (stored) try { return JSON.parse(stored); } catch (e) { return null; }
    return null;
  });
  // Fines state: { [playerName]: number }
  const [fines, setFines] = useState({});

  useEffect(() => {
    async function fetchResults() {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch competition data
        const res = await fetch(`/api/competitions/${id}`);
        if (!res.ok) throw new Error('Competition not found');
        const comp = await res.json();
        setCompetition(comp);
        // 2. Gather all players from all groups
        let playerRows = [];
        if (comp.groups && comp.users) {
          for (const group of comp.groups) {
            if (!Array.isArray(group.players) || !group.teamId) continue;
            for (const playerName of group.players) {
              const user = comp.users.find(u => u.name === playerName);
              if (!user) continue;
              // 3. Fetch scores for this player
              const scoreRes = await fetch(`/api/teams/${group.teamId}/users/${user.id}/scores?competitionId=${comp.id}`);
              let scores = [];
              if (scoreRes.ok) {
                const scoreData = await scoreRes.json();
                scores = Array.isArray(scoreData.scores) ? scoreData.scores : [];
              }
              // Fetch Waters, Dog, 2 Clubs for this player
              let waters = '';
              let dog = false;
              let twoClubs = '';
              try {
                const statRes = await fetch(`/api/teams/${group.teamId}/users/${user.id}`);
                if (statRes.ok) {
                  const statData = await statRes.json();
                  waters = statData.waters ?? '';
                  dog = !!statData.dog;
                  twoClubs = statData.two_clubs ?? '';
                }
              } catch {}
              // 4. Compute gross (sum of all entered scores)
              const gross = scores.reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
              // 5. Get PH (Playing Handicap) with allowance, and CH (Course Handicap)
              let ph = 0;
              let ch = 0;
              if (group.handicaps && group.handicaps[playerName]) {
                const fullHandicap = parseInt(group.handicaps[playerName], 10) || 0;
                ch = fullHandicap;
                if (comp.handicapallowance && !isNaN(Number(comp.handicapallowance))) {
                  ph = Math.round(fullHandicap * Number(comp.handicapallowance) / 100);
                } else {
                  ph = fullHandicap;
                }
              } else if (user.handicap) {
                ph = user.handicap;
                ch = user.handicap;
              }
              // 6. Net = Gross - PH, DTH Net = Gross - CH
              const net = gross - ph;
              const dthNet = gross - ch;
              // Calculate 'Thru' as the number of holes with a non-empty score
              let thru = scores.filter(v => v !== null && v !== '' && !isNaN(v)).length;
              // If completed all 18 holes, show 'F' for Finished
              if (thru === 18) {
                thru = 'F';
              } else if (thru === 0 && group.teeTime) {
                thru = group.teeTime; // e.g., '8:10 AM'
              }
              playerRows.push({
                name: playerName,
                gross,
                net,
                dthNet,
                ph,
                ch,
                scores,
                thru,
                waters,
                dog,
                twoClubs
              });
            }
          }
        }
        // 7. Sort: players with scores (thru is number) by holes completed (desc), then net (asc), then those with no scores (thru is string/teeTime) at bottom
        playerRows.sort((a, b) => {
          // Convert 'F' to 18 for sorting, teeTime/other string to -1
          const getThruNum = (p) => p.thru === 'F' ? 18 : (typeof p.thru === 'number' ? p.thru : -1);
          const aThru = getThruNum(a);
          const bThru = getThruNum(b);
          if (aThru !== bThru) return bThru - aThru; // more holes completed first, 'F' (18) is highest
          return a.net - b.net; // then by net
        });
        playerRows.forEach((p, i) => (p.position = i + 1));
        setPlayers(playerRows);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchResults();
  }, [id]);

  // Ref for the section to export
  const exportRef = useRef();
  const plainExportRef = useRef();

  // Export to PDF handler
  const handleExportPDF = async () => {
    if (!plainExportRef.current) {
      setError('Plain export ref not set');
      return;
    }
    const element = plainExportRef.current;
    element.style.display = 'block'; // Show for export
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#fff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgWidth = pageWidth - 40;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 20, 20, imgWidth, imgHeight);
      // Build filename: YYYY-MM-DD_<type>_results.pdf
      let dateStr = '';
      let typeStr = 'results';
      if (competition) {
        if (competition.date) {
          const d = new Date(competition.date);
          if (!isNaN(d)) {
            dateStr = d.toISOString().slice(0,10); // YYYY-MM-DD
          }
        }
        if (competition.type) {
          typeStr = competition.type
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/[_\-]+/g, ' ')
            .toLowerCase()
            .replace(/\s+/g, '_');
        }
      }
      const filename = `${dateStr ? dateStr + '_' : ''}${typeStr}_results.pdf`;
      pdf.save(filename);
    } catch (err) {
      setError('Error generating PDF: ' + err.message);
    } finally {
      element.style.display = 'none'; // Hide after export
    }
  {/* Error Modal for PDF Export */}
  {error && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center border border-blue-200">
        <div className="flex flex-col items-center mb-4">
          <span className="text-5xl mb-2" role="img" aria-label="Error">❌</span>
          <h2 className="text-2xl font-extrabold mb-2 drop-shadow" style={{ color: '#1B3A6B' }}>PDF Export Error</h2>
        </div>
        <p className="mb-6 text-gray-700 text-center text-base font-medium">{error}</p>
        <button
          className="py-2 px-6 bg-[#1B3A6B] text-white font-semibold rounded-2xl border border-white transition hover:bg-white hover:text-[#1B3A6B]"
          onClick={() => setError("")}
        >
          Close
        </button>
      </div>
    </div>
  )}
  };

  // Determine if user is a player in this competition
  const isPlayerInComp = competition && user && competition.groups && competition.groups.some(g => Array.isArray(g.players) && g.players.includes(user.name));
  return (
    <PageBackground>
      {/* Top nav menu for UI consistency */}
      <TopMenu user={user} userComp={isPlayerInComp ? competition : null} />
      <div className="flex flex-col items-center px-4 w-full">
  <div className="w-full max-w-4xl" ref={exportRef} id="export-section">
        {/* Hidden plain export table for PDF generation only */}
        <div
          ref={plainExportRef}
          style={{ display: 'none', background: '#fff', color: '#111', padding: 24, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', borderRadius: 8 }}
        >
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 28, marginBottom: 8 }}>Medal Results</div>
          {competition && (
            <div style={{ marginBottom: 18, fontSize: 16 }}>
              <span style={{ fontWeight: 'bold' }}>Competition Type:</span> {competition.type ? (competition.type.replace(/(^|_|-)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase()).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/-/g, ' ')) : '-'}<br />
              <span style={{ fontWeight: 'bold' }}>Date:</span> {competition.date ? (new Date(competition.date).toLocaleDateString('en-GB')) : '-'}<br />
              <span style={{ fontWeight: 'bold' }}>Handicap Allowance:</span> {competition.handicapallowance && competition.handicapallowance !== 'N/A' ? competition.handicapallowance + '%' : 'N/A'}
            </div>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
            <thead>
              <tr style={{ background: '#eee' }}>
                <th style={{ border: '1px solid #222', padding: 4 }}>Pos</th>
                <th style={{ border: '1px solid #222', padding: 4 }}>Name</th>
                <th style={{ border: '1px solid #222', padding: 4 }}>Thru</th>
                <th style={{ border: '1px solid #222', padding: 4 }}>Gross</th>
                <th style={{ border: '1px solid #222', padding: 4 }}>Net</th>
                <th style={{ border: '1px solid #222', padding: 4 }}>DTH Net</th>
                <th style={{ border: '1px solid #222', padding: 4 }}>Dog</th>
                <th style={{ border: '1px solid #222', padding: 4 }}>Waters</th>
                <th style={{ border: '1px solid #222', padding: 4 }}>2 Clubs</th>
                <th style={{ border: '1px solid #222', padding: 4 }}>Fines</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, idx) => (
                <tr key={p.name} style={{ background: idx % 2 === 0 ? '#f7f7f7' : '#fff' }}>
                  <td style={{ border: '1px solid #222', padding: 4, fontWeight: 'bold', textAlign: 'center' }}>{p.position}</td>
                  <td style={{ border: '1px solid #222', padding: 4 }}>{p.name}</td>
                  <td style={{ border: '1px solid #222', padding: 4 }}>{p.thru}</td>
                  <td style={{ border: '1px solid #222', padding: 4 }}>{p.gross}</td>
                  <td style={{ border: '1px solid #222', padding: 4 }}>{p.net}</td>
                  <td style={{ border: '1px solid #222', padding: 4 }}>{p.dthNet}</td>
                  <td style={{ border: '1px solid #222', padding: 4 }}>{p.dog ? '🐶' : ''}</td>
                  <td style={{ border: '1px solid #222', padding: 4 }}>{p.waters || ''}</td>
                  <td style={{ border: '1px solid #222', padding: 4 }}>{p.twoClubs || ''}</td>
                  <td style={{ border: '1px solid #222', padding: 4 }}>{p.fines || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Good Scores for PDF export */}
          {(() => {
            const goodScores = players.filter(p => typeof p.dthNet === 'number' && p.dthNet < 70 && p.thru === 'F');
            return (
              <div style={{marginTop: 18, fontWeight: 'bold', fontSize: 16, textAlign: 'left'}}>
                <div style={{textDecoration: 'underline', textUnderlineOffset: 3, marginBottom: 4}}>Good Scores</div>
                {goodScores.length === 0
                  ? <div>No one. Everyone shit.</div>
                  : goodScores.map(p => (
                      <div key={p.name}>{p.name}: Net {p.dthNet}</div>
                    ))}
              </div>
            );
          })()}
        </div>
          <div className="mb-6 mt-12">
            <h1 className="text-4xl font-extrabold text-white drop-shadow-lg text-center mb-2 leading-tight">Medal Results</h1>
            <div className="mx-auto mt-2" style={{height: '2px', maxWidth: 340, background: 'white', opacity: 0.7, borderRadius: 2}}></div>
          {/* ...existing code... */}
          <div className="flex flex-row items-start mt-4 justify-between">
            {/* Competition info section */}
            {competition && (
              <div className="text-white/90 text-base" style={{minWidth: 260, textAlign: 'left'}}>
                <span className="font-semibold">Competition Type:</span> {competition.type ? (competition.type.replace(/(^|_|-)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase()).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/-/g, ' ')) : '-'} <br />
                <span className="font-semibold">Date:</span> {competition.date ? (new Date(competition.date).toLocaleDateString('en-GB')) : '-'} <br />
                <span className="font-semibold">Handicap Allowance:</span> {competition.handicapallowance && competition.handicapallowance !== 'N/A' ? competition.handicapallowance + '%' : 'N/A'}
              </div>
            )}
            <div className="flex flex-col items-end space-y-2 ml-8" style={{alignItems:'flex-end', marginTop: 0}}>
              <button
                onClick={() => {
                  const compId = competition?.id || competition?._id || competition?.joinCode || competition?.joincode || id;
                  navigate(`/scorecard/${compId}`, { state: { competition } });
                }}
                className="py-2 px-4 w-44 bg-green-600 text-white font-semibold rounded-2xl hover:bg-green-700 border border-white transition"
              >
                Back to Scorecard
              </button>
              <button
                onClick={handleExportPDF}
                className="py-2 px-4 w-44 bg-[#1B3A6B] text-white font-semibold rounded-2xl border border-white transition hover:bg-white hover:text-[#1B3A6B] mt-2"
                title="Download this page as PDF"
              >
                Download PDF
              </button>
              <button
                onClick={() => setShowEmailModal(true)}
                className="py-2 px-4 w-44 bg-[#1B3A6B] text-white font-semibold rounded-2xl border border-white transition hover:bg-white hover:text-[#1B3A6B] mt-2"
                title="Email this page as PDF"
              >
                Email PDF
              </button>

            {/* Email PDF Modal */}
            {showEmailModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center border border-blue-200">
                  <div className="flex flex-col items-center mb-4">
                    <span className="text-5xl mb-2" role="img" aria-label="Email">📧</span>
                    <h2 className="text-2xl font-extrabold mb-2 drop-shadow" style={{ color: '#1B3A6B' }}>Email PDF</h2>
                  </div>
                  <p className="mb-6 text-gray-700 text-center text-base font-medium">
                    Enter the email address to send the PDF results to.<br/>
                    The PDF will be generated and emailed as an attachment.
                  </p>
                  <input
                    type="email"
                    className="w-full mb-4 p-2 border border-gray-300 rounded focus:outline-none"
                    placeholder="Enter recipient's email address"
                    value={emailAddress}
                    onChange={e => setEmailAddress(e.target.value)}
                    disabled={emailSending}
                  />
                  {emailError && <div className="text-red-500 mb-2 font-semibold">{emailError}</div>}
                  {emailSuccess && <div className="text-green-600 mb-2 font-semibold">{emailSuccess}</div>}
                  <div className="flex gap-4 w-full justify-center">
                    <button
                      className="px-5 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold shadow"
                      onClick={() => setShowEmailModal(false)}
                      disabled={emailSending}
                    >
                      Cancel
                    </button>
                    <button
                      className="px-5 py-2 rounded-2xl font-bold shadow border border-white transition text-lg"
                      style={{ backgroundColor: '#1B3A6B', color: 'white' }}
                      onClick={handleEmailPDF}
                      disabled={emailSending || !emailAddress}
                    >
                      {emailSending ? 'Sending...' : 'Send Email'}
                    </button>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
          <div className="flex flex-col mt-12">
            <div className="w-full rounded-2xl shadow-lg bg-transparent text-white mb-8" style={{ backdropFilter: 'none' }}>
              {loading ? (
                <div className="text-center text-white py-8">Loading results...</div>
              ) : error ? (
                <div className="text-center text-red-400 py-8">{error}</div>
              ) : (
                <React.Fragment>
                  <table className="min-w-full border text-center mb-8">
                    <thead>
                      <tr className="bg-blue-900/90">
                        <th className="border px-2 py-0.5" style={{background:'#1B3A6B',color:'white'}}>Pos</th>
                        <th className="border px-2 py-0.5" style={{background:'#1B3A6B',color:'white'}}>Name</th>
                        <th className="border px-2 py-0.5" style={{background:'#1B3A6B',color:'white'}}>Thru</th>
                        <th className="border px-2 py-0.5" style={{background:'#1B3A6B',color:'white'}}>Gross</th>
                        <th className="border px-2 py-0.5" style={{background:'#1B3A6B',color:'white'}}>Net</th>
                        <th className="border px-2 py-0.5" style={{background:'#1B3A6B',color:'white'}}>DTH Net</th>
                        <th className="border px-2 py-0.5" style={{background:'#1B3A6B',color:'white'}}>Dog</th>
                        <th className="border px-2 py-0.5" style={{background:'#1B3A6B',color:'white'}}>Waters</th>
                        <th className="border px-2 py-0.5" style={{background:'#1B3A6B',color:'white'}}>2 Clubs</th>
                        <th className="border px-2 py-0.5" style={{background:'#1B3A6B',color:'white'}}>Fines</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.map((p, idx) => (
                        <tr key={p.name} className={idx % 2 === 0 ? 'bg-white/5' : ''}>
                          <td className="border px-2 py-0.5 font-bold">{p.position}</td>
                          <td className="border px-2 py-0.5 text-left">{p.name}</td>
                          <td className="border px-2 py-0.5">{p.thru}</td>
                          <td className="border px-2 py-0.5">{p.gross}</td>
                          <td className="border px-2 py-0.5">{p.net}</td>
                          <td className="border px-2 py-0.5">{p.dthNet}</td>
                          <td className="border px-2 py-0.5">{p.dog ? '🐶' : ''}</td>
                          <td className="border px-2 py-0.5">{p.waters || ''}</td>
                          <td className="border px-2 py-0.5">{p.twoClubs || ''}</td>
                          <td className="border px-2 py-0.5">
                            {isAdmin(user) ? (
                              <input
                                type="number"
                                min="0"
                                className="w-14 h-8 text-center text-white bg-transparent rounded mx-auto block font-bold text-base no-spinner px-0"
                                value={fines[p.name] || ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  setFines(f => ({ ...f, [p.name]: val === '' ? '' : Math.max(0, parseInt(val, 10) || 0) }));
                                }}
                                placeholder="0"
                                inputMode="numeric"
                                style={{ color: 'white', MozAppearance: 'textfield', appearance: 'textfield', WebkitAppearance: 'none', paddingLeft: '0.5rem', paddingRight: '0.5rem' }}
                              />
                            ) : (
                              fines[p.name] || ''
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Good Scores section - directly below the results table */}
                  {(() => {
                    const goodScores = players.filter(p => typeof p.dthNet === 'number' && p.dthNet < 70 && p.thru === 'F');
                    return (
                      <div className="mt-2 mb-8 text-white text-base font-semibold" style={{maxWidth: '100%', textAlign: 'left'}}>
                        <div style={{marginBottom: 4, marginLeft: 0, textDecoration: 'underline', textUnderlineOffset: 3}}>Good Scores</div>
                        {goodScores.length === 0
                          ? <div style={{marginLeft: 0}}>No one. Everyone shit.</div>
                          : goodScores.map(p => (
                              <div key={p.name} style={{marginBottom: 2, marginLeft: 0}}>{p.name}: Net {p.dthNet}</div>
                            ))}
                      </div>
                    );
                  })()}
                </React.Fragment>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  </PageBackground>
  );
}
