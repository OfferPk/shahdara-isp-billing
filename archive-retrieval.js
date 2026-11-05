// Plan 321 (Plan 203-350) — Archive retrieval log.
//
// Archived material is taken out and nobody records who
// retrieved it or why, so an archive can go missing without
// a trace. This module adds only the missing piece: one
// retrieval record per archive taken out — the archive
// reference, who retrieved it, the date out, the date
// returned, and the reason — so unreturned retrievals stay
// visible on an open list by age until the item comes back.
//
// What this module is NOT, stated plainly:
//   - It is not the year-end archive index (Plan 200),
//     which indexes what is archived at year end. That
//     index already exists and is neither read nor
//     rewritten here; this module logs retrievals only.
//   - It is not the retention policy (Plan 187), which
//     says how long material is kept. That policy already
//     exists and is neither read nor rewritten here; a
//     retrieval never changes how long anything is kept.
//   - It is not the seasonal comparison view (Plan 320),
//     which compares monthly figures across seasons.
//     That view already exists and is neither read nor
//     rewritten here; retrievals carry no figures.
//   - It is not the export verification checklist
//     (Plan 315), which checks an export before it is
//     shared. That checklist already exists and is
//     neither read nor rewritten here; a retrieval is a
//     physical take-out, not an export.
//   - It is not a bill, payment, or customer change.
//     Recording or returning a retrieval never changes
//     any archived record, bill, or payment: the log
//     only notes that an archive went out and came back.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies
//     every record, and the module never reads storage,
//     the clock, or the network, and never mutates an
//     input.
//   - A record with no id, no archive reference, no
//     retriever in plain words, no strict date out, or
//     no reason is refused outright, as is a return date
//     that is not a strict date or that falls before the
//     date out. Unknown fields are dropped, so a record
//     can never grow a bill, payment, or customer field.
//   - Returning an item only sets its return date; it
//     changes nothing else about the record, and a
//     returned item can never be returned a second time.
//   - A duplicate id is never rewritten: the first
//     record stays.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validArchiveRetrievalDay(value) {
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

/** Day number for a strict date, by integer arithmetic only. */
function dayNumber(value) {
  const parts = value.split('-').map(Number);
  let year = parts[0];
  const month = parts[1];
  const day = parts[2];
  year -= month <= 2 ? 1 : 0;
  const era = Math.floor(year / 400);
  const yearOfEra = year - era * 400;
  const monthShifted = month > 2 ? month - 3 : month + 9;
  const dayOfYear = Math.floor((153 * monthShifted + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

/**
 * One archive retrieval record, or null when half-formed.
 * A record needs an id, an archive reference, a retriever
 * in plain words, a strict date out, and a reason. The
 * return date is empty while the item is still out; when
 * present it must be a strict date on or after the date
 * out. Unknown fields are dropped; the input is never
 * mutated.
 */
export function normalizeArchiveRetrieval(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const archiveRef = text(raw.archiveRef);
  const retrievedBy = text(raw.retrievedBy);
  const dateOut = text(raw.dateOut);
  const reason = text(raw.reason);
  if (!id) return null;
  if (!archiveRef) return null;
  if (!retrievedBy) return null;
  if (!validArchiveRetrievalDay(dateOut)) return null;
  if (!reason) return null;
  const dateReturned = text(raw.dateReturned);
  if (dateReturned) {
    if (!validArchiveRetrievalDay(dateReturned)) return null;
    if (dayNumber(dateReturned) < dayNumber(dateOut)) return null;
  }
  return { id, archiveRef, retrievedBy, dateOut, dateReturned, reason };
}

/** Normalised retrieval records only; a duplicate id is never rewritten, the first stays. */
export function normalizeArchiveRetrievalList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const record = normalizeArchiveRetrieval(raw);
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    out.push(record);
  }
  return out;
}

export function findArchiveRetrieval(list, id) {
  const clean = normalizeArchiveRetrievalList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((record) => record.id === wanted) ?? null;
}

/**
 * Record a retrieval. Refused when half-formed or when its
 * id is already recorded — the first record for an id
 * always stays.
 */
export function recordArchiveRetrieval(list, raw) {
  const clean = normalizeArchiveRetrievalList(list);
  const record = normalizeArchiveRetrieval(raw);
  if (!record) return clean;
  if (clean.some((item) => item.id === record.id)) return clean;
  return [...clean, record];
}

export function removeArchiveRetrieval(list, id) {
  const clean = normalizeArchiveRetrievalList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((record) => record.id !== wanted);
}

/**
 * Mark a retrieval returned on a strict date. Refused when
 * the record is missing, already returned, or the return
 * date is not a strict date on or after the date out.
 * Returning changes only the return date of that record.
 */
export function returnArchiveItem(list, id, dateReturned) {
  const clean = normalizeArchiveRetrievalList(list);
  const wanted = text(id);
  const returnedOn = text(dateReturned);
  if (!wanted) return clean;
  if (!validArchiveRetrievalDay(returnedOn)) return clean;
  return clean.map((record) => {
    if (record.id !== wanted) return record;
    if (record.dateReturned) return record;
    if (dayNumber(returnedOn) < dayNumber(record.dateOut)) return record;
    return { ...record, dateReturned: returnedOn };
  });
}

/** Whole days between the date out and a strict as-of date, or null when either date is not strict. */
export function archiveRetrievalDaysOut(record, asOf) {
  const clean = normalizeArchiveRetrieval(record);
  if (!clean) return null;
  const asOfDay = text(asOf);
  if (!validArchiveRetrievalDay(asOfDay)) return null;
  const days = dayNumber(asOfDay) - dayNumber(clean.dateOut);
  return days < 0 ? null : days;
}

/** Unreturned retrievals, oldest out first, so the longest-out item is at the top. */
export function archiveRetrievalOpen(list) {
  const clean = normalizeArchiveRetrievalList(list);
  return clean
    .filter((record) => !record.dateReturned)
    .sort((a, b) => {
      if (a.dateOut !== b.dateOut) return a.dateOut < b.dateOut ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

/** Returned retrievals, most recently returned first. */
export function archiveRetrievalReturned(list) {
  const clean = normalizeArchiveRetrievalList(list);
  return clean
    .filter((record) => record.dateReturned)
    .sort((a, b) => {
      if (a.dateReturned !== b.dateReturned) return a.dateReturned < b.dateReturned ? 1 : -1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

/** Retrieval records for one archive reference, in date-out order; the match is case-insensitive. */
export function archiveRetrievalsForRef(list, archiveRef) {
  const wanted = text(archiveRef).toLowerCase();
  if (!wanted) return [];
  return normalizeArchiveRetrievalList(list)
    .filter((record) => record.archiveRef.toLowerCase() === wanted)
    .sort((a, b) => {
      if (a.dateOut !== b.dateOut) return a.dateOut < b.dateOut ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

/** Plain-words summary: how many are still out and how many have come back. */
export function archiveRetrievalSummaryText(list) {
  const clean = normalizeArchiveRetrievalList(list);
  if (!clean.length) return 'No archive retrievals recorded.';
  const open = archiveRetrievalOpen(clean);
  const totalWord = clean.length === 1 ? '1 archive retrieval recorded' : `${clean.length} archive retrievals recorded`;
  const openWord = open.length === 1 ? '1 retrieval still out' : `${open.length} retrievals still out`;
  const backWord =
    clean.length - open.length === 1 ? '1 returned' : `${clean.length - open.length} returned`;
  return `${totalWord}: ${openWord}, ${backWord}.`;
}

/** One line naming a retrieval, for lists and messages. */
export function archiveRetrievalEntryText(record) {
  const clean = normalizeArchiveRetrieval(record);
  if (!clean) return '';
  const status = clean.dateReturned
    ? `returned ${clean.dateReturned}`
    : 'still out';
  return `${clean.dateOut} — ${clean.archiveRef} taken out by ${clean.retrievedBy} (${clean.reason}), ${status}.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function archiveRetrievalEntryHtml(record, asOf) {
  const clean = normalizeArchiveRetrieval(record);
  if (!clean) return '';
  const days = archiveRetrievalDaysOut(clean, asOf);
  const age = days === null ? '' : ` — out ${days} day${days === 1 ? '' : 's'}`;
  return `<li>${escapeHtml(archiveRetrievalEntryText(clean))}${escapeHtml(age)}</li>`;
}

/** The open list by age, oldest out first; an empty list says so plainly. */
export function archiveRetrievalOpenHtml(list, asOf) {
  const open = archiveRetrievalOpen(list);
  if (!open.length) return '<p>No archive retrievals are still out.</p>';
  return `<ul>${open.map((record) => archiveRetrievalEntryHtml(record, asOf)).join('')}</ul>`;
}

export function archiveRetrievalAllHtml(list, asOf) {
  const clean = normalizeArchiveRetrievalList(list);
  if (!clean.length) return '<p>No archive retrievals recorded.</p>';
  const sorted = [...clean].sort((a, b) => {
    if (a.dateOut !== b.dateOut) return a.dateOut < b.dateOut ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return `<ul>${sorted.map((record) => archiveRetrievalEntryHtml(record, asOf)).join('')}</ul>`;
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function archiveRetrievalCsv(list) {
  const clean = normalizeArchiveRetrievalList(list);
  const sorted = [...clean].sort((a, b) => {
    if (a.dateOut !== b.dateOut) return a.dateOut < b.dateOut ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const header = ['id', 'archive_ref', 'retrieved_by', 'date_out', 'date_returned', 'reason'].join(',');
  const rows = sorted.map((record) =>
    [record.id, record.archiveRef, record.retrievedBy, record.dateOut, record.dateReturned, record.reason]
      .map(csvCell)
      .join(','),
  );
  return [header, ...rows].join('\n');
}

export function archiveRetrievalFilename() {
  return 'archive-retrievals.csv';
}
