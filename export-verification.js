// Plan 315 (Plan 203-350) — Data export verification checklist.
//
// An export handed to the accountant or kept as a copy is
// trusted without a check, so a missing month or a truncated
// file is found only when it is needed. This module adds only
// the missing piece: one verification checklist per export —
// the export reference, the record counts expected and found,
// the date range covered, the checker, and the result — so a
// verified export shows expected versus found counts that
// match, or a named mismatch, and an unverified export is
// flagged as unchecked.
//
// What this module is NOT, stated plainly:
//   - It is not the export itself. The export pack already
//     exists and is neither read nor rewritten here; a
//     checklist checks an export made under that pack only,
//     it never makes an export of its own.
//   - It is not the export custody log, which records that
//     an export was taken, by whom, and for what purpose.
//     That log already exists and is neither read nor
//     rewritten here; verifying a copy never logs a new
//     custody entry.
//   - It is not the year-end archive index, which lists
//     what was archived at year end. That index already
//     exists and is neither read nor rewritten here; a
//     checklist never archives anything.
//   - It is not the backup restore drill record, which
//     records a restore rehearsal. That record already
//     exists and is neither read nor rewritten here; a
//     checklist never restores anything.
//   - It is not the backup verification module, which checks
//     a backup file. That module already exists and is
//     neither read nor rewritten here; this checklist checks
//     an export copy, not a backup.
//   - It is not a bill, payment, customer, or staff record
//     change. Recording a checklist never changes any bill,
//     payment, customer, or staff record by itself.
//   - It is not an editable record. A past checklist is
//     never silently edited: there is no edit function,
//     only record, find, and remove; a wrong checklist is
//     removed and recorded again.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     checklist, and the module never reads storage, the
//     clock, or the network, and never mutates an input.
//   - A checklist with no id, no export reference, no whole
//     record count expected or found, no strict start or end
//     date, an end date before its start date, or no checker
//     is refused outright. Unknown fields are dropped, so a
//     checklist can never grow a bill, payment, customer, or
//     staff field.
//   - The result folds from plain spellings, and a missing
//     result reads as unchecked: nothing is ever called
//     verified by guesswork. A checklist that claims a
//     match while its counts differ is reported as a
//     mismatch, with the gap named in plain words.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function refKey(value) {
  return text(value).toLowerCase();
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar day: YYYY-MM-DD that really exists, or false. */
export function validExportVerificationDay(value) {
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

/** A whole record count of zero or more, from a number or a digit string, or null. */
function wholeCount(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

/** A result folded to match, mismatch, or unchecked; anything missing or unknown reads as unchecked. */
export function foldExportVerificationResult(value) {
  const folded = text(value).toLowerCase();
  if (folded === 'match' || folded === 'matched' || folded === 'ok') return 'match';
  if (folded === 'mismatch' || folded === 'mismatched' || folded === 'different') return 'mismatch';
  return 'unchecked';
}

/**
 * One checklist in canonical form, or null when the raw
 * checklist is missing an id, an export reference, a whole
 * expected or found count, a strict start or end date, an end
 * date before its start date, or a checker. Unknown fields
 * are dropped, and a missing result reads as unchecked.
 */
export function normalizeExportVerificationChecklist(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const exportRef = text(raw.exportRef);
  const expectedCount = wholeCount(raw.expectedCount);
  const foundCount = wholeCount(raw.foundCount);
  const dateFrom = text(raw.dateFrom);
  const dateTo = text(raw.dateTo);
  const checker = text(raw.checker);
  if (!id || !exportRef || expectedCount === null || foundCount === null) return null;
  if (!validExportVerificationDay(dateFrom) || !validExportVerificationDay(dateTo)) return null;
  if (dateTo < dateFrom) return null;
  if (!checker) return null;
  return { id, exportRef, expectedCount, foundCount, dateFrom, dateTo, checker, result: foldExportVerificationResult(raw.result) };
}

/** A list of checklists in canonical form; bad entries and later duplicate ids are dropped. */
export function normalizeExportVerificationChecklistList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const checklist = normalizeExportVerificationChecklist(raw);
    if (!checklist || seen.has(checklist.id)) continue;
    seen.add(checklist.id);
    out.push(checklist);
  }
  return out;
}

/** The checklist with this id, or null when there is none. */
export function findExportVerificationChecklist(list, id) {
  const checklists = normalizeExportVerificationChecklistList(list);
  const wanted = text(id);
  return checklists.find((checklist) => checklist.id === wanted) ?? null;
}

/**
 * Record one checklist. A checklist that is refused, or whose
 * id is already recorded, leaves the list exactly as it was.
 */
export function recordExportVerificationChecklist(list, raw) {
  const checklists = normalizeExportVerificationChecklistList(list);
  const checklist = normalizeExportVerificationChecklist(raw);
  if (!checklist) return checklists;
  if (checklists.some((entry) => entry.id === checklist.id)) return checklists;
  return [...checklists, checklist];
}

/** Remove the checklist with this id; removing an unknown id changes nothing. */
export function removeExportVerificationChecklist(list, id) {
  const checklists = normalizeExportVerificationChecklistList(list);
  const wanted = text(id);
  return checklists.filter((checklist) => checklist.id !== wanted);
}

/**
 * The verdict for one checklist: unchecked when it was never
 * checked, match when it claims a match and its counts agree,
 * mismatch otherwise — including a claimed match whose counts
 * differ, so a gap is never hidden behind a good word.
 */
export function exportVerificationVerdict(checklist) {
  const clean = normalizeExportVerificationChecklist(checklist);
  if (!clean) return 'unchecked';
  if (clean.result === 'unchecked') return 'unchecked';
  if (clean.result === 'match' && clean.expectedCount === clean.foundCount) return 'match';
  return 'mismatch';
}

/** The named gap for a checklist whose counts differ, or an empty string when they agree. */
export function exportVerificationMismatchText(checklist) {
  const clean = normalizeExportVerificationChecklist(checklist);
  if (!clean) return '';
  const gap = clean.expectedCount - clean.foundCount;
  if (gap === 0) return '';
  if (gap > 0) {
    return `expected ${clean.expectedCount} records, found ${clean.foundCount} records — ${gap} missing`;
  }
  return `expected ${clean.expectedCount} records, found ${clean.foundCount} records — ${-gap} extra`;
}

function checklistOrder(a, b) {
  if (a.dateFrom !== b.dateFrom) return a.dateFrom < b.dateFrom ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** All checklists, earliest covered start date first. */
export function exportVerificationChecklistsSorted(list) {
  return normalizeExportVerificationChecklistList(list).sort(checklistOrder);
}

/** Checklists for one export reference, earliest covered start date first; capital letters do not matter. */
export function exportVerificationChecklistsForExport(list, exportRef) {
  const wanted = refKey(exportRef);
  if (!wanted) return [];
  return exportVerificationChecklistsSorted(list).filter((checklist) => refKey(checklist.exportRef) === wanted);
}

/** Checklists that were never checked, earliest covered start date first. */
export function uncheckedExportVerificationChecklists(list) {
  return exportVerificationChecklistsSorted(list).filter((checklist) => exportVerificationVerdict(checklist) === 'unchecked');
}

/** Checklists whose counts do not agree, earliest covered start date first. */
export function mismatchedExportVerificationChecklists(list) {
  return exportVerificationChecklistsSorted(list).filter((checklist) => exportVerificationVerdict(checklist) === 'mismatch');
}

/** Export references with at least one checklist, in the order first recorded. */
export function exportVerificationExportRefs(list) {
  const seen = new Set();
  const out = [];
  for (const checklist of normalizeExportVerificationChecklistList(list)) {
    const key = refKey(checklist.exportRef);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(checklist.exportRef);
  }
  return out;
}

/** Plain-words summary: how many checklists, and how many matched, mismatched, and unchecked. */
export function exportVerificationSummaryText(list) {
  const checklists = normalizeExportVerificationChecklistList(list);
  if (!checklists.length) return 'No export verification checklists recorded.';
  const matched = checklists.filter((checklist) => exportVerificationVerdict(checklist) === 'match').length;
  const mismatched = checklists.filter((checklist) => exportVerificationVerdict(checklist) === 'mismatch').length;
  const unchecked = checklists.length - matched - mismatched;
  const totalWord = checklists.length === 1 ? 'checklist' : 'checklists';
  return `${checklists.length} verification ${totalWord}: ${matched} matched, ${mismatched} mismatched, ${unchecked} unchecked.`;
}

/** One checklist as one plain-words line. */
export function exportVerificationChecklistText(checklist) {
  const clean = normalizeExportVerificationChecklist(checklist);
  if (!clean) return '';
  const verdict = exportVerificationVerdict(clean);
  const gap = exportVerificationMismatchText(clean);
  const tail = verdict === 'mismatch' && gap ? ` — ${gap}` : '';
  return `${clean.exportRef} — ${clean.dateFrom} to ${clean.dateTo} — expected ${clean.expectedCount} records, found ${clean.foundCount} records — ${verdict} — checked by ${clean.checker}.${tail}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** One checklist as one list item, with user text escaped. */
export function exportVerificationChecklistHtml(checklist) {
  const clean = normalizeExportVerificationChecklist(checklist);
  if (!clean) return '';
  const gap = exportVerificationMismatchText(clean);
  const tail = exportVerificationVerdict(clean) === 'mismatch' && gap ? ` — ${escapeHtml(gap)}` : '';
  return `<li>${escapeHtml(clean.exportRef)} — ${escapeHtml(clean.dateFrom)} to ${escapeHtml(clean.dateTo)} — expected ${clean.expectedCount} records, found ${clean.foundCount} records — ${exportVerificationVerdict(clean)} — checked by ${escapeHtml(clean.checker)}.${tail}</li>`;
}

/** All checklists grouped by verdict: matched, then mismatched, then unchecked. */
export function exportVerificationAllHtml(list) {
  const checklists = normalizeExportVerificationChecklistList(list);
  if (!checklists.length) return '<p>No export verification checklists recorded.</p>';
  const groups = [
    ['Matched', checklists.filter((checklist) => exportVerificationVerdict(checklist) === 'match')],
    ['Mismatched', checklists.filter((checklist) => exportVerificationVerdict(checklist) === 'mismatch')],
    ['Unchecked', checklists.filter((checklist) => exportVerificationVerdict(checklist) === 'unchecked')],
  ];
  return groups
    .filter(([, items]) => items.length)
    .map(([heading, items]) => `<h4>${heading}</h4><ul>${items.map((checklist) => exportVerificationChecklistHtml(checklist)).join('')}</ul>`)
    .join('');
}

/** Checklists for one export reference as a list, earliest covered start date first. */
export function exportVerificationChecklistsForExportHtml(list, exportRef) {
  const checklists = exportVerificationChecklistsForExport(list, exportRef);
  if (!checklists.length) return '<p>No verification checklists for that export.</p>';
  return `<ul>${checklists.map((checklist) => exportVerificationChecklistHtml(checklist)).join('')}</ul>`;
}

/** Unchecked checklists as a list, earliest covered start date first. */
export function uncheckedExportVerificationChecklistsHtml(list) {
  const checklists = uncheckedExportVerificationChecklists(list);
  if (!checklists.length) return '<p>No unchecked exports.</p>';
  return `<ul>${checklists.map((checklist) => exportVerificationChecklistHtml(checklist)).join('')}</ul>`;
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/** Checklists as CSV, earliest covered start date first, with a fixed header. */
export function exportVerificationCsv(list) {
  const lines = ['id,exportRef,expectedCount,foundCount,dateFrom,dateTo,checker,result'];
  for (const checklist of exportVerificationChecklistsSorted(list)) {
    lines.push([checklist.id, checklist.exportRef, checklist.expectedCount, checklist.foundCount, checklist.dateFrom, checklist.dateTo, checklist.checker, checklist.result].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** Fixed filename for the CSV export. */
export function exportVerificationFilename() {
  return 'export-verification-checklists.csv';
}
