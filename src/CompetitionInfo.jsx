import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function CompetitionInfo() {
  const location = useLocation();
  const navigate = useNavigate();
  const comp = location.state?.comp;

  if (!comp) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Competition Info</h2>
        <div className="text-red-500">No competition data found.</div>
        <button className="mt-4 py-2 px-4 bg-gray-200 rounded" onClick={() => navigate(-1)}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Competition Info</h2>
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
              <tr className="bg-gray-100">
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
      <button className="py-2 px-4 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition" onClick={() => navigate(-1)}>
        Back
      </button>
    </div>
  );
}
