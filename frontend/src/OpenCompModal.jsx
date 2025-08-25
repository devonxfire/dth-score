import React from "react";

export default function OpenCompModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center border border-red-200">
        <div className="flex flex-col items-center mb-4">
          <span className="text-5xl mb-2" role="img" aria-label="Warning">⚠️</span>
          <h2 className="text-2xl font-extrabold mb-2 drop-shadow" style={{ color: '#1B3A6B' }}>Cannot Create Competition</h2>
        </div>
        <p className="mb-6 text-gray-700 text-center text-base font-medium">
          There is already an open competition.<br/>
          <span className='font-bold' style={{ color: '#1B3A6B' }}>Please end the currently open competition before creating a new one.</span>
        </p>
        <button
          className="px-5 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold shadow"
          onClick={onClose}
        >
          OK
        </button>
      </div>
    </div>
  );
}
