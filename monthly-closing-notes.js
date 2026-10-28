/**
 * monthly-closing-notes.js — SISP-20
 * Owner's permanent per-month closing notes for the Monthly Owner Khata
 * Closing Report.
 *
 * A note is plain text the owner writes when closing a month (e.g. "NayaPay
 * bill paid late, Rs. 2,000 fine waived"). Notes live outside the ledger
 * state under their own localStorage key (same pattern as the SISP-1 shop
 * settlements and the SISP-15 complaint register), and travel inside JSON
 * backups as an optional `settings.monthlyClosingNotes` section under the
 * SISP-15 safe-merge rule (adopt only when this device has none, else a
 * conflict is reported and nothing is overwritten).
 *
 * This module imports nothing, on purpose: core.js imports
 * sanitizeMonthlyClosingNotes from here for backup restore, and a core
 * import here would be a cycle.
 */

export const MONTHLY_CLOSING_NOTES_KEY = 'sisp_monthly_closing_notes_v1';

const MONTH_RE = /^\d{4}-\d{2}$/;

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Normalizes a raw notes value into { [YYYY-MM]: { note, savedAt } }.
 * Corrupt entries are dropped, never thrown on. savedAt must be a string;
 * anything else becomes ''.
 */
export function sanitizeMonthlyClosingNotes(value) {
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [month, entry] of Object.entries(value)) {
    if (!MONTH_RE.test(month)) continue;
    if (!entry || typeof entry !== 'object') continue;
    const note = cleanText(entry.note);
    if (!note) continue;
    out[month] = {
      note,
      savedAt: typeof entry.savedAt === 'string' ? entry.savedAt : ''
    };
  }
  return out;
}

/** Reads saved closing notes; {} on missing/corrupt storage. */
export function loadMonthlyClosingNotes(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return {};
    const raw = store.getItem(MONTHLY_CLOSING_NOTES_KEY);
    if (!raw) return {};
    return sanitizeMonthlyClosingNotes(JSON.parse(raw));
  } catch {
    return {};
  }
}

/** Persists closing notes; never throws. Returns true on success. */
export function saveMonthlyClosingNotes(notes, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(MONTHLY_CLOSING_NOTES_KEY, JSON.stringify(sanitizeMonthlyClosingNotes(notes)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Pure: returns a NEW notes map with `month` set to `note` (savedAt stamped
 * from `referenceDate`). An empty note deletes the month's entry. The input
 * map is never mutated.
 */
export function setMonthlyClosingNote(notes, month, note, referenceDate = new Date()) {
  const clean = sanitizeMonthlyClosingNotes(notes);
  if (!MONTH_RE.test(String(month || ''))) return clean;
  const text = cleanText(note);
  if (!text) {
    delete clean[month];
    return clean;
  }
  const stamp = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
    ? referenceDate.toISOString()
    : new Date().toISOString();
  return { ...clean, [month]: { note: text, savedAt: stamp } };
}

/** Returns the saved note text for a month, or '' when none exists. */
export function getMonthlyClosingNote(notes, month) {
  const clean = sanitizeMonthlyClosingNotes(notes);
  return clean[month]?.note ?? '';
}
