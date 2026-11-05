// Plan 267 (Plan 203-350) — Complaint reopen note.
//
// A closed complaint that comes back was handled as a new
// complaint, losing the reason it was reopened and what had
// already been tried. This module adds only the missing piece:
// one reopen note per reopened complaint — the complaint link,
// the reopen date, the reason in plain words, and the previous
// outcome noted, so the customer is heard with full context.
//
// What this module is NOT, stated plainly:
//   - It is not the post-resolution note recorded at closure.
//     That note records how the customer felt when the
//     complaint was closed, and it is neither read nor
//     rewritten here. This module records only that the
//     complaint came back, and why.
//   - It is not the reopen window rule (Plan 25). That rule
//     decides whether a complaint may still be reopened, and
//     it is neither read nor rewritten here. This module
//     records a reopening that already happened; it decides
//     nothing about whether one is allowed.
//   - It is not the follow-up after closure (Plan 259). That
//     record checks later whether the customer stayed happy
//     after closure, and it is neither read nor rewritten
//     here. A reopen note is written when the complaint
//     comes back, not when it is checked on.
//   - It never changes the original complaint history, any
//     bill, or any payment. This module holds no complaint
//     status, bill, or payment field, so there is nothing
//     here that could rewrite one. Recording a note only
//     adds the note.
//   - A complaint may reopen more than once, so one
//     complaint may have several reopen notes, listed in
//     date order. Only a duplicate id is ever refused.
//   - A reopen note is never edited, only annotated. There
//     is no edit function: only record, annotate, and
//     remove. A dated follow-up never rewrites the
//     complaint link, the reopen date, the reason, or the
//     previous outcome.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

export const COMPLAINT_REOPEN_STORE = 'shahdara_complaint_reopen_notes_v1';
export const COMPLAINT_REOPEN_FILENAME = 'complaint-reopen-notes.csv';

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validComplaintReopenDate(value) {
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
  if (!validComplaintReopenDate(date) || !note) return null;
  return { date, note };
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const complaintRef = text(raw.complaintRef);
  const reopenDate = text(raw.reopenDate);
  const reason = text(raw.reason);
  if (!id || !complaintRef || !reason) return null;
  if (!validComplaintReopenDate(reopenDate)) return null;
  const previousOutcome = text(raw.previousOutcome);
  const followups = Array.isArray(raw.followups)
    ? raw.followups.map(cleanFollowup).filter(Boolean)
    : [];
  return { id, complaintRef, reopenDate, reason, previousOutcome, followups };
}

export function normalizeComplaintReopenList(list) {
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

export function recordComplaintReopen(list, raw) {
  const clean = normalizeComplaintReopenList(list);
  const entry = normalizeEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removeComplaintReopen(list, id) {
  const clean = normalizeComplaintReopenList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findComplaintReopen(list, id) {
  const clean = normalizeComplaintReopenList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

export function addComplaintReopenNote(list, id, date, note) {
  const clean = normalizeComplaintReopenList(list);
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
  if (a.reopenDate !== b.reopenDate) return a.reopenDate < b.reopenDate ? -1 : 1;
  if (a.complaintRef !== b.complaintRef) return a.complaintRef < b.complaintRef ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function complaintReopenSorted(list) {
  return normalizeComplaintReopenList(list).sort(compareEntries);
}

export function reopenNotesForComplaint(list, complaintRef) {
  const wanted = text(complaintRef).toLowerCase();
  if (!wanted) return [];
  return complaintReopenSorted(list).filter((item) => item.complaintRef.toLowerCase() === wanted);
}

export function complaintReopenComplaints(list) {
  const seen = new Set();
  const out = [];
  for (const item of complaintReopenSorted(list)) {
    const key = item.complaintRef.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.complaintRef);
  }
  return out;
}

export function complaintReopenSummaryText(list) {
  const clean = normalizeComplaintReopenList(list);
  if (!clean.length) return 'No complaint reopen notes recorded.';
  const complaints = complaintReopenComplaints(list).length;
  return `${clean.length} complaint reopen note${clean.length === 1 ? '' : 's'} across ${complaints} complaint${complaints === 1 ? '' : 's'}.`;
}

export function complaintReopenText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'No complaint reopen note recorded.';
  const previous = clean.previousOutcome
    ? ` Previous outcome: ${clean.previousOutcome.replace(/\.+$/, '')}.`
    : '';
  const notes = clean.followups.length
    ? ` Follow-ups: ${clean.followups.map((f) => `${f.date}: ${f.note}`).join('; ')}`
    : '';
  return `Complaint ${clean.complaintRef} reopened ${clean.reopenDate}: ${clean.reason.replace(/\.+$/, '')}.${previous}${notes}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function complaintReopenHtml(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '<p>No complaint reopen note recorded.</p>';
  const previous = clean.previousOutcome
    ? `<br>Previous outcome: ${escapeHtml(clean.previousOutcome.replace(/\.+$/, ''))}.`
    : '';
  const notes = clean.followups.length
    ? `<br>Follow-ups: ${escapeHtml(clean.followups.map((f) => `${f.date}: ${f.note}`).join('; '))}`
    : '';
  return `<p>Complaint <strong>${escapeHtml(clean.complaintRef)}</strong> reopened ${escapeHtml(clean.reopenDate)}: ${escapeHtml(clean.reason.replace(/\.+$/, ''))}.${previous}${notes}</p>`;
}

export function complaintReopenAllHtml(list) {
  const sorted = complaintReopenSorted(list);
  if (!sorted.length) return '<p>No complaint reopen notes recorded.</p>';
  return `<ul>${sorted.map((entry) => `<li>${escapeHtml(complaintReopenText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function complaintReopenCsv(list) {
  const sorted = complaintReopenSorted(list);
  const header = ['id', 'complaint reference', 'reopen date', 'reason', 'previous outcome', 'follow-ups'];
  const rows = sorted.map((item) => [
    item.id,
    item.complaintRef,
    item.reopenDate,
    item.reason,
    item.previousOutcome,
    item.followups.map((f) => `${f.date}: ${f.note}`).join('; '),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function complaintReopenFilename() {
  return 'complaint-reopen-notes.csv';
}
