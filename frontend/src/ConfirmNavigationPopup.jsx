import React from 'react';

/**
 * A styled confirmation popup matching the CH warning style.
 * Shows a warning icon, title, message, and OK/Cancel buttons.
 */
export default function ConfirmNavigationPopup({ title, message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[#002F5F] rounded-2xl shadow-2xl p-6 flex flex-col items-center border-4 border-[#FFD700] popup-jiggle max-w-sm w-full">
        <span className="text-5xl mb-3" role="img" aria-label="Warning">⚠️</span>
        <h2 className="text-2xl font-extrabold mb-2 drop-shadow-lg text-center" style={{ color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif' }}>
          {title}
        </h2>
        <div className="text-sm text-white mb-4 text-center" style={{ fontFamily: 'Lato, Arial, sans-serif' }}>
          {message}
        </div>
        <div className="flex gap-3 w-full">
          <button
            className="flex-1 px-4 py-2 rounded-2xl font-bold shadow border border-white"
            style={{ backgroundColor: '#FFD700', color: '#002F5F' }}
            onClick={onConfirm}
          >
            Yes, Discard
          </button>
          <button
            className="flex-1 px-4 py-2 rounded-2xl font-bold shadow border border-white"
            style={{ backgroundColor: '#666', color: 'white' }}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
