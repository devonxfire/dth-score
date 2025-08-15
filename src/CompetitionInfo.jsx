import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PageBackground from './PageBackground';

export default function CompetitionInfo() {
  const location = useLocation();
  const navigate = useNavigate();
  const comp = location.state?.comp;

  if (!comp) {
    return (
      <PageBackground>
        <div className="flex flex-col items-center min-h-screen justify-center px-4">
          <div className="flex flex-col items-center px-4 mt-12">
            <h2 className="text-5xl font-bold text-white mb-1 drop-shadow-lg text-center">Competition Info</h2>
            <p className="text-xl text-white mb-6 drop-shadow text-center">No competition data found.</p>
          </div>
          <div className="flex flex-col items-center px-4 mt-8 w-full">
            <div className="w-full max-w-md rounded-2xl shadow-lg bg-transparent text-white mb-8 p-6 text-center" style={{ backdropFilter: 'none' }}>
              <div className="text-red-400 mb-4">No competition data found.</div>
              <button className="py-2 px-4 bg-transparent border border-white text-white rounded-2xl hover:bg-white hover:text-black transition" onClick={() => navigate(-1)}>
                Back
              </button>
            </div>
          </div>
        </div>
      </PageBackground>
    );
  }

  return (
    <PageBackground>
      <div className="flex flex-col items-center min-h-screen justify-center px-4">
        <div className="flex flex-col items-center px-4 mt-12">
          <h2 className="text-5xl font-bold text-white mb-1 drop-shadow-lg text-center">Competition Info</h2>
          <p className="text-xl text-white mb-6 drop-shadow text-center">Details for this golf competition.</p>
        </div>
        <div className="flex flex-col items-center px-4 mt-8 w-full">
          <div className="w-full max-w-md rounded-2xl shadow-lg bg-transparent text-white mb-8 p-6" style={{ backdropFilter: 'none' }}>
            <div className="mb-4">
              <div><span className="font-semibold">Date:</span> {comp.date}</div>
              <div><span className="font-semibold">Type:</span> {comp.type}</div>
              <div><span className="font-semibold">Join Code:</span> {comp.joinCode}</div>
              {comp.teeBox && <div><span className="font-semibold">Tee Box:</span> {comp.teeBox}</div>}
            </div>
            {comp.groups && Array.isArray(comp.groups) && (
              <div className="mb-4">
                <h3 className="font-semibold mb-2">Groups / Teams</h3>
                <table className="min-w-full border text-center mb-2">
                  <thead>
                    <tr className="bg-white/10">
                      <th className="border px-2 py-1">Group</th>
                      <th className="border px-2 py-1">Tee Time</th>
                      <th className="border px-2 py-1">Players</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comp.groups.map((group, idx) => (
                      <tr key={idx}>
                        <td className="border px-2 py-1">{group.name || idx + 1}</td>
                        <td className="border px-2 py-1">{group.teeTime || "-"}</td>
                        <td className="border px-2 py-1">{group.players?.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button className="py-2 px-4 bg-transparent border border-white text-white rounded-2xl hover:bg-white hover:text-black transition" onClick={() => navigate(-1)}>
              Back
            </button>
          </div>
        </div>
      </div>
    </PageBackground>
  );
}
