// Simple in-memory dedupe for popups. Prevents duplicate popups across
// GlobalPopups and local scorecard components by tracking recent signatures.
// Normalize signatures so small differences in punctuation/quotes/casing
// don't cause duplicate popups (common with nicknames like "Brian 'Grizzly'").
const recent = new Map();
const TTL = 10 * 1000; // 10 seconds

function now() { return Date.now(); }

function normalizeSignature(sig) {
  if (!sig && sig !== 0) return String(sig);
  try {
    let s = String(sig);
    // Replace smart apostrophes/quotes with straight ones
    s = s.replace(/[’‘”“]/g, "'");
    s = s.replace(/[“”]/g, '"');
    // Remove any single or double quote characters used for nicknames
    s = s.replace(/["']/g, '');
    // Normalize whitespace and lower-case for stable comparison
    s = s.replace(/\s+/g, ' ').trim().toLowerCase();
    return s;
  } catch (e) {
    return String(sig);
  }
}

export function shouldShowPopup(signature) {
  if (signature == null) return true;
  const key = normalizeSignature(signature);
  const ts = recent.get(key);
  if (!ts) return true;
  if (now() - ts > TTL) {
    recent.delete(key);
    return true;
  }
  return false;
}

export function markShown(signature) {
  if (signature == null) return;
  const key = normalizeSignature(signature);
  recent.set(key, now());
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
