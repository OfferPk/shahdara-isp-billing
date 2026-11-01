// SISP-148: Do-Not-Suspend Exam / Emergency Shield.
//
// Pure helpers for the suspension shield. This module imports nothing,
// so core.js, mikrotik-generator.js, dashboard-top-defaulters.js and
// profile-ui.js can all use it without a cycle (the pause-billing.js
// precedent).
//
// Model (flat fields on the customer record, backward compatible):
//   doNotSuspendUntil  'YYYY-MM-DD' | null — the last day the shield
//                      holds (the shield is active THROUGH this date)
//   doNotSuspendReason stable enum key | '' — one of
//                      SUSPENSION_SHIELD_REASONS. The display text
//                      lives in nav-language.js (shield_reason_* keys);
//                      the spec's English phrases ("Student Exams",
//                      "Medical / Family Emergency", "Owner Approved")
//                      are labels, never stored free text.
//
// A shield is ACTIVE only when BOTH halves are valid AND the until
// date is today or later. A date without a valid reason (or a reason
// without a valid date) is inert: it excludes nobody and renders no
// badge. Expired values may stay on the record but are equally inert
// everywhere. Unknown or corrupt values sanitize to the absent
// defaults (null / ''), so old saves load exactly as before.
//
// BOUNDARY (deliberate, and it matters): the shield guards SUSPENSION
// actions only — the MikroTik bulk lock script, the Lock Due (15th+)
// suspension script, and the Top Defaulters surface that feeds them.
// It never touches billing: a shielded defaulter still owes, still
// accrues dues, and still appears in defaulter lists, reminders and
// waada flows exactly as before. Only the suspension sweep skips them.

export const SUSPENSION_SHIELD_REASONS = Object.freeze([
  'student_exams',
  'medical_emergency',
  'owner_approved'
]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRealCalendarDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

/** True only for a real YYYY-MM-DD calendar date (leap-aware). */
export function isValidShieldDate(value) {
  return isRealCalendarDate(typeof value === 'string' ? value.trim() : '');
}

/**
 * Sanitize the until date: a real calendar date survives (trimmed);
 * anything else — empty, malformed, impossible (2026-02-30), or not a
 * string — becomes null (absent). Never throws: a corrupt saved value
 * must not break a profile save or a state load.
 */
export function sanitizeDoNotSuspendUntil(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return isRealCalendarDate(text) ? text : null;
}

/**
 * Sanitize the reason: only the stable enum keys survive; anything
 * else (including the spec's display phrases typed as free text)
 * becomes '' (absent).
 */
export function sanitizeDoNotSuspendReason(value) {
  return SUSPENSION_SHIELD_REASONS.includes(value) ? value : '';
}

/** Normalize the shield pair from any stored shape. */
export function sanitizeShieldFields(customer) {
  const record = customer && typeof customer === 'object' ? customer : {};
  return {
    doNotSuspendUntil: sanitizeDoNotSuspendUntil(record.doNotSuspendUntil),
    doNotSuspendReason: sanitizeDoNotSuspendReason(record.doNotSuspendReason)
  };
}

/**
 * The one shield derivation every surface shares. Active means: a
 * valid until date AND a valid reason AND until >= today (the shield
 * holds through its until date; it expires the day after). An
 * unparseable `todayStr` fails open (not shielded) — the same rule
 * the generator's future-Waada guard uses — so a broken clock input
 * can never silently protect or expose anyone by accident.
 */
export function isShielded(customer, todayStr) {
  const today = typeof todayStr === 'string' ? todayStr.trim() : '';
  if (!isRealCalendarDate(today)) return false;
  const { doNotSuspendUntil, doNotSuspendReason } = sanitizeShieldFields(customer);
  if (doNotSuspendUntil === null || doNotSuspendReason === '') return false;
  return doNotSuspendUntil >= today;
}
