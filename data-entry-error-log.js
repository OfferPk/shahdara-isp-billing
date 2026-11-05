// Plan 325 (Plan 203-350) — Data entry error log.
//
// Wrong entries (a mistyped amount, a wrong customer
// picked) are corrected and forgotten, so the same
// mistake repeats. This module adds only the missing
// piece: one error record per data entry error — the
// record affected, the error type, the date found, and
// the correction reference it links to — so errors list
// by type with counts over a period, and each error
// links to its correction.
//
// What this module is NOT, stated plainly:
//   - It is not the billing error correction workflow
//     (Plan 109), which is for bill errors specifically.
//     That workflow already exists and is neither read
//     nor rewritten here; this log only records that an
//     entry error happened and which correction it
//     links to, it never corrects a bill itself.
//   - It is not a print template register (Plan 324),
//     which records which template version a printout
//     uses. That register already exists and is neither
//     read nor rewritten here; an error record is about
//     a wrong entry, never about a template version.
//   - It is not a record duplication check (Plan 326),
//     which lists suspected duplicate records for
//     operator review. That check is a different plan
//     and is not implemented here; this log records
//     entry errors only, it never checks for, merges,
//     or deletes duplicates.
//   - It is not a bill, payment, or customer change.
//     Logging an error never changes any bill,
//     payment, or customer record by itself: the log
//     only lists errors and their corrections.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies
//     every record, and the module never reads storage,
//     the clock, or the network, and never mutates an
//     input.
//   - A record with no id, no record affected, no
//     strict date found, or no correction reference is
//     refused outright. Unknown fields are dropped, so
//     a record can never grow a bill, payment, or
//     customer field.
//   - A duplicate id is never rewritten: the first
//     record stays.
//   - The error type folds to a short fixed list of
//     plain words; anything unknown reads as other.
//   - Counts over a period are computed from the same
//     records they report on, and a bad period returns
//     null, never a guessed count.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const ERROR_TYPES = [
  'wrong amount',
  'wrong customer',
  'wrong date',
  'wrong package',
  'wrong mohalla',
  'other',
];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validDataEntryErrorDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const limit = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day >= 1 && day <= limit;
}

/** Fold an error type to the fixed plain-words list; anything unknown reads as other. */
export function foldDataEntryErrorType(value) {
  const clean = text(value).toLowerCase();
  return ERROR_TYPES.includes(clean) ? clean : 'other';
}

/**
 * One data entry error record, or null when
 * half-formed. A record needs an id, the record
 * affected in plain words, a strict date found, and
 * a correction reference linking it to its correction.
 * The error type folds to the fixed list (missing or
 * unknown reads as other). Who found it and a short
 * note are optional plain words. Unknown fields are
 * dropped; the input is never mutated.
 */
export function normalizeDataEntryError(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const recordAffected = text(raw.recordAffected);
  const dateFound = text(raw.dateFound);
  const correctionRef = text(raw.correctionRef);
  if (!id) return null;
  if (!recordAffected) return null;
  if (!validDataEntryErrorDay(dateFound)) return null;
  if (!correctionRef) return null;
  return {
    id,
    recordAffected,
    errorType: foldDataEntryErrorType(raw.errorType),
    dateFound,
    correctionRef,
    foundBy: text(raw.foundBy),
    note: text(raw.note),
  };
}

/** Normalised data entry error records only; a duplicate id is never rewritten, the first stays. */
export function normalizeDataEntryErrorList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const clean = normalizeDataEntryError(raw);
    if (!clean) continue;
    if (seen.has(clean.id)) continue;
    seen.add(clean.id);
    out.push(clean);
  }
  return out;
}

/** Find one record by id, or null. */
export function findDataEntryError(list, id) {
  const clean = normalizeDataEntryErrorList(list);
  return clean.find((entry) => entry.id === text(id)) ?? null;
}

/** Record one error; a half-formed record or a duplicate id leaves the list unchanged. */
export function recordDataEntryError(list, raw) {
  const clean = normalizeDataEntryErrorList(list);
  const entry = normalizeDataEntryError(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

/** Remove one record by id; removing a missing id leaves the list unchanged. */
export function removeDataEntryError(list, id) {
  const clean = normalizeDataEntryErrorList(list);
  const wanted = text(id);
  if (!clean.some((entry) => entry.id === wanted)) return clean;
  return clean.filter((entry) => entry.id !== wanted);
}

/** Errors of one type, folded first, newest date found first, then id A-Z. */
export function dataEntryErrorsForType(list, type) {
  const wanted = foldDataEntryErrorType(type);
  return normalizeDataEntryErrorList(list)
    .filter((entry) => entry.errorType === wanted)
    .sort((a, b) => (a.dateFound < b.dateFound ? 1 : a.dateFound > b.dateFound ? -1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Error types present in the list, A-Z. */
export function dataEntryErrorTypes(list) {
  return [...new Set(normalizeDataEntryErrorList(list).map((entry) => entry.errorType))].sort();
}

/**
 * Counts by error type over a period, inclusive of both
 * ends. Returns null for a bad period (a date that is
 * not a strict calendar date, or a start after the
 * end), never a guessed count. Types with no error in
 * the period are left out.
 */
export function dataEntryErrorCountsByType(list, from, to) {
  if (!validDataEntryErrorDay(from) || !validDataEntryErrorDay(to)) return null;
  if (from > to) return null;
  const counts = {};
  for (const entry of normalizeDataEntryErrorList(list)) {
    if (entry.dateFound < from || entry.dateFound > to) continue;
    counts[entry.errorType] = (counts[entry.errorType] ?? 0) + 1;
  }
  return Object.keys(counts)
    .sort()
    .map((errorType) => ({ errorType, count: counts[errorType] }));
}

/** Plain-words summary of the whole log. */
export function dataEntryErrorSummaryText(list) {
  const clean = normalizeDataEntryErrorList(list);
  if (!clean.length) return 'No data entry errors logged.';
  const counts = dataEntryErrorCountsByType(list, '0001-01-01', '9999-12-31') ?? [];
  const parts = counts.map((row) => `${row.count} ${row.errorType}`);
  const noun = clean.length === 1 ? 'data entry error' : 'data entry errors';
  return `${clean.length} ${noun} logged: ${parts.join(', ')}.`;
}

/** One error as one plain-words line, naming its correction link. */
export function dataEntryErrorEntryText(entry) {
  const clean = normalizeDataEntryError(entry);
  if (!clean) return '';
  const who = clean.foundBy ? `, found by ${clean.foundBy}` : '';
  const note = clean.note ? ` — ${clean.note}` : '';
  return `${clean.dateFound}: ${clean.errorType} on ${clean.recordAffected} (correction ${clean.correctionRef})${who}${note}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/** One error as one HTML list item, with user text escaped. */
export function dataEntryErrorEntryHtml(entry) {
  const clean = normalizeDataEntryError(entry);
  if (!clean) return '';
  return `<li>${escapeHtml(dataEntryErrorEntryText(clean))}</li>`;
}

/** Errors grouped by type A-Z, each group a heading with its errors newest first. */
export function dataEntryErrorsByTypeHtml(list) {
  const clean = normalizeDataEntryErrorList(list);
  if (!clean.length) return '<p>No data entry errors logged.</p>';
  return dataEntryErrorTypes(clean)
    .map((errorType) => {
      const items = dataEntryErrorsForType(clean, errorType)
        .map((entry) => dataEntryErrorEntryHtml(entry))
        .join('');
      return `<h4>${escapeHtml(errorType)}</h4><ul>${items}</ul>`;
    })
    .join('');
}

/** The whole log as HTML: summary plus errors grouped by type. */
export function dataEntryErrorAllHtml(list) {
  const clean = normalizeDataEntryErrorList(list);
  return `<p>${escapeHtml(dataEntryErrorSummaryText(clean))}</p>${dataEntryErrorsByTypeHtml(clean)}`;
}

function csvCell(value) {
  const clean = String(value ?? '');
  return /[",\n]/.test(clean) ? `"${clean.replace(/"/g, '""')}"` : clean;
}

/** The whole log as CSV text, one row per error. */
export function dataEntryErrorCsv(list) {
  const clean = normalizeDataEntryErrorList(list);
  const header = 'id,record affected,error type,date found,correction reference,found by,note';
  const rows = clean.map((entry) =>
    [
      entry.id,
      entry.recordAffected,
      entry.errorType,
      entry.dateFound,
      entry.correctionRef,
      entry.foundBy,
      entry.note,
    ]
      .map(csvCell)
      .join(','),
  );
  return [header, ...rows].join('\n');
}

/** CSV filename for the log. */
export function dataEntryErrorFilename() {
  return 'data-entry-errors.csv';
}
