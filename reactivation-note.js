// Plan 275 (Plan 203-350) — Dormant customer reactivation note.
//
// A dormant customer who comes back had no reactivation note, so what
// brought them back — and what they need now — was lost. This module
// adds only the missing piece: one reactivation note per dormant
// customer who returns — the customer, the return date, the reason
// for the return in plain words, and the package resumed.
//
// What this module is NOT, stated plainly:
//   - It is not the dormant-but-paid check-in list from Plan 172.
//     That list checks in on customers who are still dormant and
//     paying; it is neither read nor rewritten here, and this
//     module imports nothing. A reactivation note only records a
//     return that already happened.
//   - It is not the winback queue from Plan 59. That queue lists
//     former customers to revisit; it is neither read nor rewritten
//     here. This module records returns only and never queues or
//     schedules a step.
//   - It never reactivates anyone and never changes any customer,
//     bill, or payment record. A reactivation note only says a
//     customer came back, when, why, and on which package. The
//     reactivated customer simply leaves the dormant list shown
//     here; the customer record itself is untouched, and this
//     module holds no customer status, bill, or payment field, so
//     there is nothing here that could rewrite one.
//   - A note is never edited, only annotated. There is no edit
//     function: only record, annotate, and remove. A dated
//     follow-up never rewrites the customer, the return date, the
//     reason, or the package resumed.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

export const REACTIVATION_NOTE_STORE = 'shahdara_reactivation_notes_v1';
export const REACTIVATION_NOTE_FILENAME = 'reactivation-notes.csv';

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validReactivationNoteDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  let limit = DAYS_IN_MONTH[month - 1];
  if (month === 2 && isLeapYear(year)) limit = 29;
  return day <= limit;
}

function cleanFollowup(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const date = text(raw.date);
  const note = text(raw.note);
  if (!validReactivationNoteDate(date) || !note) return null;
  return { date, note };
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customer = text(raw.customer);
  const returnDate = text(raw.returnDate);
  const reason = text(raw.reason);
  const packageResumed = text(raw.packageResumed);
  if (!id || !customer || !reason) return null;
  if (!validReactivationNoteDate(returnDate)) return null;
  const followups = Array.isArray(raw.followups)
    ? raw.followups.map(cleanFollowup).filter(Boolean)
    : [];
  return { id, customer, returnDate, reason, packageResumed, followups };
}

export function normalizeReactivationNoteList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeEntry(raw);
    if (!entry) continue;
    if (seenIds.has(entry.id)) continue;
    seenIds.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function recordReactivationNote(list, raw) {
  const clean = normalizeReactivationNoteList(list);
  const entry = normalizeEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removeReactivationNote(list, id) {
  const clean = normalizeReactivationNoteList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findReactivationNote(list, id) {
  const clean = normalizeReactivationNoteList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

export function addReactivationNoteFollowup(list, id, date, note) {
  const clean = normalizeReactivationNoteList(list);
  const wanted = text(id);
  const followup = cleanFollowup({ date, note });
  if (!wanted || !followup) return clean;
  let changed = false;
  const out = clean.map((item) => {
    if (item.id !== wanted) return item;
    changed = true;
    return { ...item, followups: [...item.followups, followup] };
  });
  return changed ? out : clean;
}

function compareEntries(a, b) {
  if (a.returnDate !== b.returnDate) return a.returnDate < b.returnDate ? -1 : 1;
  if (a.customer !== b.customer) return a.customer < b.customer ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function reactivationNoteSorted(list) {
  return normalizeReactivationNoteList(list).sort(compareEntries);
}

export function reactivationNotesForCustomer(list, customer) {
  const wanted = text(customer).toLowerCase();
  if (!wanted) return [];
  return reactivationNoteSorted(list).filter((item) => item.customer.toLowerCase() === wanted);
}

export function reactivationNoteCustomers(list) {
  const seen = new Set();
  const out = [];
  for (const item of reactivationNoteSorted(list)) {
    const key = item.customer.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.customer);
  }
  return out;
}

// The latest reactivation note for one customer: the note with the
// latest return date, or null when the customer has no note recorded.
export function latestReactivationNote(list, customer) {
  const notes = reactivationNotesForCustomer(list, customer);
  return notes.length ? notes[notes.length - 1] : null;
}

// Reactivated customers leave the dormant list: given the
// caller-supplied dormant-customer references, return the ones with
// no recorded reactivation note. Blank references are dropped,
// duplicates are listed once, and the first spelling is kept.
export function stillDormantCustomers(list, customers) {
  if (!Array.isArray(customers)) return [];
  const clean = normalizeReactivationNoteList(list);
  const reactivated = new Set();
  for (const item of clean) {
    reactivated.add(item.customer.toLowerCase());
  }
  const seen = new Set();
  const out = [];
  for (const raw of customers) {
    const customer = text(raw);
    if (!customer) continue;
    const key = customer.toLowerCase();
    if (seen.has(key) || reactivated.has(key)) continue;
    seen.add(key);
    out.push(customer);
  }
  return out;
}

export function reactivationNoteSummaryText(list) {
  const clean = normalizeReactivationNoteList(list);
  if (!clean.length) return 'No reactivation notes recorded.';
  const withPackage = clean.filter((item) => item.packageResumed).length;
  return `${clean.length} reactivation note${clean.length === 1 ? '' : 's'} recorded, ${withPackage} with a package resumed.`;
}

export function reactivationNoteText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'No reactivation note recorded.';
  const packagePart = clean.packageResumed ? ` Package resumed: ${clean.packageResumed}.` : '';
  const notes = clean.followups.length
    ? ` Follow-ups: ${clean.followups.map((f) => `${f.date}: ${f.note}`).join('; ')}`
    : '';
  return `Customer ${clean.customer} returned ${clean.returnDate}: ${clean.reason.replace(/\.+$/, '')}.${packagePart}${notes}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function reactivationNoteHtml(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '<p>No reactivation note recorded.</p>';
  return `<p>${escapeHtml(reactivationNoteText(entry))}</p>`;
}

export function reactivationNoteAllHtml(list) {
  const sorted = reactivationNoteSorted(list);
  if (!sorted.length) return '<p>No reactivation notes recorded.</p>';
  return `<ul>${sorted.map((entry) => `<li>${escapeHtml(reactivationNoteText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function reactivationNoteCsv(list) {
  const sorted = reactivationNoteSorted(list);
  const header = ['id', 'customer', 'return date', 'reason', 'package resumed', 'follow-ups'];
  const rows = sorted.map((item) => [
    item.id,
    item.customer,
    item.returnDate,
    item.reason,
    item.packageResumed,
    item.followups.map((f) => `${f.date}: ${f.note}`).join('; '),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function reactivationNoteFilename() {
  return REACTIVATION_NOTE_FILENAME;
}
