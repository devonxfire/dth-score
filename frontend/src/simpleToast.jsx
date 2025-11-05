import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

let listeners = [];
export function toast(content, opts = {}) {
  try {
    if (typeof window !== 'undefined') {
      window.__simpleToastShowCount = (window.__simpleToastShowCount || 0) + 1;
    }
  } catch (e) {}
  for (const l of listeners) {
    try { l({ content, opts }); } catch (e) { /* ignore listener errors */ }
  }
}

export function SimpleToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    try { if (typeof window !== 'undefined') window.__simpleToastMounted = true; } catch (e) {}
    const sub = (t) => {
      const id = t.opts && t.opts.toastId ? t.opts.toastId : `${Date.now()}-${Math.random()}`;
      setToasts(prev => { if (prev.some(x => x.id === id)) return prev; return [...prev, { id, ...t }]; });

      // autoClose default: 5000ms (5 seconds). If opts.autoClose === false, do not auto remove.
      if (t.opts?.autoClose !== false) {
        const ms = typeof t.opts?.autoClose === 'number' ? t.opts.autoClose : 5000;
        setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), ms);
      }
    };
    listeners.push(sub);
    return () => { listeners = listeners.filter(l => l !== sub); };
  }, []);

  const dismiss = (id) => {
    setToasts(prev => prev.filter(x => x.id !== id));
  };

  if (typeof document === 'undefined') return null;

  // Use a very large z-index to ensure toast is above app overlays.
  const nodes = (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2147483647, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ width: 'auto', maxWidth: 'min(90vw, 760px)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto', marginBottom: 12, background: '#002F5F', color: 'white', borderRadius: 16, padding: '1rem 1.25rem', boxShadow: '0 10px 30px rgba(0,0,0,0.30)', border: '4px solid #FFD700', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'Lato, Arial, sans-serif', position: 'relative', textAlign: 'center', minWidth: 360, maxWidth: 'min(90vw, 760px)' }} className="popup-jiggle">
            <button aria-label="Dismiss" onClick={() => dismiss(t.id)} style={{ position: 'absolute', right: 12, top: 12, background: 'transparent', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>{typeof t.content === 'string' ? <div style={{ textAlign: 'center', fontSize: '1.25rem' }}>{t.content}</div> : t.content}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return createPortal(nodes, document.body);
}

export default { toast, SimpleToastContainer };

// Install a small in-browser helper for manual testing. Call from the
// browser console on any route:
// window.__emitTestPopup({ type: 'eagle'|'birdie'|'blowup'|'waters'|'dog', playerName: 'Name', holeNumber: 7, autoClose: 5000 })
export function installTestHelper() {
  if (typeof window === 'undefined') return;
  // Prefer Vite's import.meta.env if available, fall back to process.env
  let isProd = false;
  try { if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') isProd = true; } catch (e) {}
  try { if (import.meta && import.meta.env && import.meta.env.MODE === 'production') isProd = true; } catch (e) {}
  if (isProd) return; // dev-only helper

  window.__emitTestPopup = (opts = {}) => {
    try {
      const type = opts.type || 'eagle';
      const name = opts.playerName || opts.name || 'Test Player';
      const holeNumber = opts.holeNumber || 1;
      const emitToServer = !!opts.emitToServer;
      const compId = opts.competitionId || opts.competition || null;
      let emoji = '🎉';
      let title = 'Nice!';
      let body = `For ${name} — Hole ${holeNumber}`;
      if (type === 'eagle') { emoji = '🦅'; title = 'Eagle!'; body = `For ${name} — Hole ${holeNumber}`; }
      else if (type === 'birdie') { emoji = '🕊️'; title = 'Birdie!'; body = `For ${name} — Hole ${holeNumber}`; }
      else if (type === 'blowup') { emoji = '💥'; title = 'How Embarrassing!'; body = `${name} just blew up on Hole ${holeNumber}`; }
      else if (type === 'waters') { emoji = '💧'; title = 'Splash!'; body = `${name} has earned a water`; }
      else if (type === 'dog') { emoji = '🐶'; title = 'Woof!'; body = `${name} got the dog`; }

      const content = (
        <div className="flex flex-col items-center popup-jiggle" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: 8 }}>{emoji}</div>
          <div style={{ fontWeight: 800, color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', fontSize: '1.4rem' }}>{title}</div>
          <div style={{ color: 'white', fontFamily: 'Lato, Arial, sans-serif', fontSize: '1.05rem' }}>{body}</div>
        </div>
      );

      const autoClose = (typeof opts.autoClose === 'number') ? opts.autoClose : 5000;
      toast(content, { toastId: `dev-test:${Date.now()}:${Math.random()}`, autoClose, position: 'center', closeOnClick: true });

      // Optionally emit to server to test multi-client rebroadcast
      if (emitToServer && socket) {
        try {
          socket.emit('client-popup', { competitionId: compId ? Number(compId) : undefined, type, playerName: name, holeNumber: holeNumber || null, signature: opts.signature || `${type}:${name}:${holeNumber}:${compId ?? 'x'}` });
        } catch (e) { /* ignore socket errors */ }
      }
    } catch (e) { /* ignore */ }
  };
}

// Auto-install test helper so it's immediately available in dev console
try { installTestHelper(); } catch (e) { /* ignore */ }
