import { toast } from './simpleToast';
import { markShown } from './popupDedupe';
import socket from './socket';

/**
 * Show a local popup (toast) and ask the server to rebroadcast to other clients.
 * @param {Object} opts
 * @param {'eagle'|'birdie'|'blowup'|'waters'|'dog'} opts.type
 * @param {string} opts.name
 * @param {number} [opts.holeNumber]
 * @param {string} [opts.sig]
 * @param {number|string} [opts.competitionId]
 */
export function showLocalPopup({ type, name, holeNumber, sig, competitionId }) {
  try {
    let emoji = '🎉';
    let title = 'Nice!';
    let body = name || '';
    let autoClose = 60000;
    if (type === 'eagle') { emoji = '🦅'; title = 'Eagle!'; body = `For ${name || ''} — Hole ${holeNumber || ''}`; if (navigator.vibrate) navigator.vibrate([200,100,200]); }
    else if (type === 'birdie') { emoji = '🕊️'; title = 'Birdie!'; body = `For ${name || ''} — Hole ${holeNumber || ''}`; if (navigator.vibrate) navigator.vibrate([100,50,100]); }
    else if (type === 'blowup') { emoji = '💥'; title = 'How Embarrassing!'; body = `${name || ''} just blew up on Hole ${holeNumber || ''}`; if (navigator.vibrate) navigator.vibrate([400,100,400]); }
    else if (type === 'waters') { emoji = '💧'; title = 'Splash!'; body = `${name || ''} has earned a water`; }
    else if (type === 'dog') { emoji = '🐶'; title = 'Woof!'; body = `${name || ''} got the dog`; }

    const content = (
      <div className="flex flex-col items-center" style={{ padding: '0.75rem 1rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: 8 }}>{emoji}</div>
        <div style={{ fontWeight: 800, color: '#FFD700', fontFamily: 'Merriweather, Georgia, serif', fontSize: '1.4rem' }}>{title}</div>
        <div style={{ color: 'white', fontFamily: 'Lato, Arial, sans-serif', fontSize: '1.05rem' }}>{body}</div>
      </div>
    );
    try { toast(content, { toastId: sig || `${type}:${name}:${holeNumber}:${competitionId || ''}`, autoClose, position: 'top-center', closeOnClick: true }); } catch (e) {}
    try { if (sig) markShown(sig); } catch (e) {}
    try { socket.emit('client-popup', { competitionId: Number(competitionId), type, playerName: name, holeNumber: holeNumber || null, signature: sig }); } catch (e) {}
  } catch (e) {}
}
