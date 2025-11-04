// Simple in-memory dedupe for popups. Prevents duplicate popups across
// GlobalPopups and local scorecard components by tracking recent signatures.
const recent = new Map();
const TTL = 10 * 1000; // 10 seconds

function now() { return Date.now(); }

export function shouldShowPopup(signature) {
  if (!signature) return true;
  const ts = recent.get(signature);
  if (!ts) return true;
  if (now() - ts > TTL) {
    recent.delete(signature);
    return true;
  }
  return false;
}

export function markShown(signature) {
  if (!signature) return;
  recent.set(signature, now());
}

// Optional helper: combine shouldShow & mark in one call
export function checkAndMark(signature) {
  if (shouldShowPopup(signature)) {
    markShown(signature);
    return true;
  }
  return false;
}

// Clean up periodically
setInterval(() => {
  const cutoff = now() - TTL;
  for (const [k, v] of recent.entries()) {
    if (v < cutoff) recent.delete(k);
  }
}, TTL).unref?.();

export default { shouldShowPopup, markShown, checkAndMark };
