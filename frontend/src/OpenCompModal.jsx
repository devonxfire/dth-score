import React from "react";

export default function OpenCompModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center border border-[#FFD700]">
        <div className="flex flex-col items-center mb-4">
          <span className="text-5xl mb-2" role="img" aria-label="Warning">⚠️</span>
          <h2 className="text-2xl font-extrabold mb-2 drop-shadow text-center whitespace-nowrap" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif' }}>Cannot Create Competition</h2>
        </div>
        <p className="mb-6 text-white text-center text-base font-medium" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>
          There is already an open competition.<br/>
          <span className='font-bold' style={{ color: '#FFD700' }}>Please end the currently open competition before creating a new one.</span>
        </p>
        <button
          className="px-5 py-2 rounded-lg bg-[#FFD700] hover:bg-[#F5D06F] text-[#002F5F] font-extrabold shadow"
          style={{ fontFamily: 'Merriweather, Georgia, serif' }}
          onClick={onClose}
        >
          OK
        </button>
      </div>
    </div>
  );
}
