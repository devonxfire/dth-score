// Shared display name helper for DTH Score
// Usage: import { getDisplayName } from './displayNameHelper';

/**
 * Returns the display name for a player, handling special cases for Jon/Jason Horn and guests.
 * @param {string} name - The player's name (e.g., 'JON HORN', 'JASON HORN', 'Guest 1')
 * @param {object} [groupForPlayer] - Optional group object containing displayNames array for guests
 * @returns {string} - Formatted display name
 */
export function getDisplayName(name, groupForPlayer) {
  if (!name || typeof name !== 'string') return '';
  let guestIdx = -1;
  if (
    groupForPlayer &&
    Array.isArray(groupForPlayer.players) &&
    Array.isArray(groupForPlayer.displayNames) &&
    name.startsWith('Guest')
  ) {
    guestIdx = groupForPlayer.players.findIndex(n => n === name);
    if (guestIdx !== -1 && groupForPlayer.displayNames[guestIdx]) {
      const guestFull = groupForPlayer.displayNames[guestIdx].trim();
      const guestParts = guestFull.split(' ');
      if (guestParts.length > 1) {
        return `${guestParts[0][0]}. ${guestParts[guestParts.length - 1]}`.toUpperCase();
      } else {
        return guestFull.toUpperCase();
      }
    }
  }
  // fallback to old logic
  const fallbackGuestIdx = ['Guest 1','Guest 2','Guest 3'].indexOf(name);
  if (fallbackGuestIdx !== -1) {
    return name.toUpperCase();
  }
  const norm = name.trim().toUpperCase();
  // Match Jon 'Leak' Horn in any form
  if (/JON[^A-Z]*'[^']*LEAK[^A-Z]*HORN/.test(norm) || (norm.includes('JON') && norm.includes('HORN'))) {
    return norm.replace(/^(JON[^A-Z]*'[^']*LEAK[^A-Z]*HORN|JON[^A-Z]*HORN)/, 'J. HORN') + ' (SNR.)';
  }
  // Match Jason Horn in any form
  if (norm.includes('JASON') && norm.includes('HORN')) {
    return 'J. HORN (JNR.)';
  }
  const parts = name.trim().split(' ');
  if (parts.length > 1) {
    return (parts[0][0] + '. ' + parts[parts.length - 1]).toUpperCase();
  } else {
    return name.toUpperCase();
  }
}
