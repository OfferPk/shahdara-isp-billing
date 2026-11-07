// Plan 436 — Quick Collect offline saved badge: after a quick payment
// saves offline, the operator cannot tell at a glance that it is safely
// stored on this device, so they tap save again and risk a duplicate.
// One saved badge on the success screen — "saved on this device", with
// the save time — shown for every offline save. It badges only: it
// syncs nothing, records nothing new, and changes no bill, payment,
// or customer record.
//
// The save time comes from the saved payment's own recorded-at stamp —
// the instant the payment was logged (not its billing date). A payment
// not yet saved has no stamp, so it shows no badge: the badge is null
// and the host stays hidden, never a guessed time. The time is read
// with pure string arithmetic from the UTC stamp, exactly the rule the
// offline queue status view already uses for its entry times: Pakistan
// is UTC+5, so only the hour shifts, and a stamp past 19:00 UTC wraps
// to the next day's early hours, which is the time the stamp itself
// means. This module never reads the clock: the caller supplies the
// stamp (or stamps), so the badge can never drift from the record.
//
// A split collection records two legs of its own in one save; the badge
// takes the later of the two stamps, so the time shown is the time the
// save finished.
const OFFLINE_SAVED_BADGE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

export function offlineSavedBadgeTime(recordedAt) {
  if (typeof recordedAt !== 'string') return '';
  const match = OFFLINE_SAVED_BADGE_TIME.exec(recordedAt.trim());
  if (!match) return '';
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return '';
  return `${String((hour + 5) % 24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function offlineSavedBadge(recordedAt) {
  const time = offlineSavedBadgeTime(recordedAt);
  if (!time) return null;
  return { time };
}

export function offlineSavedBadgeLatestTime(recordedAts) {
  if (!Array.isArray(recordedAts)) return '';
  let latest = '';
  for (const stamp of recordedAts) {
    if (typeof stamp !== 'string') continue;
    if (!offlineSavedBadgeTime(stamp)) continue;
    if (latest === '' || stamp > latest) latest = stamp;
  }
  return latest;
}

export function offlineSavedBadgeLineText(badge) {
  if (!badge || typeof badge !== 'object' || typeof badge.time !== 'string' || badge.time === '') return '';
  return `✓ Saved on this device · ${badge.time}`;
}

function escapeBadgeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function offlineSavedBadgeHtml(badge) {
  const text = offlineSavedBadgeLineText(badge);
  if (!text) return '';
  return `<p class="osb-saved-badge">${escapeBadgeText(text)}</p>`;
}
