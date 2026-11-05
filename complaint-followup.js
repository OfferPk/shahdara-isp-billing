// Plan 259 (Plan 203-350) — Complaint satisfaction follow-up after closure.
//
// A complaint is closed and marked satisfied at closure, but nobody
// checks later whether the customer stayed satisfied, so a fix that
// failed again looks like a success. This module adds only the
// missing piece: one follow-up record per closed complaint — the
// complaint link, the follow-up due date, whether the customer is
// still satisfied, and a note in plain words.
//
// What this module is NOT, stated plainly:
//   - It is not the post-resolution note recorded at closure. That
//     note records how the customer felt when the complaint was
//     closed, and it is neither read nor rewritten here. This
//     module is the second check afterwards: it asks again, later,
//     whether the customer stayed satisfied.
//   - It is not visit feedback, which records how satisfied the
//     customer was after a visit. That record is neither read nor
//     rewritten here, and this module imports nothing. A complaint
//     follow-up is about a closed complaint, not about a visit.
//   - It never reopens a complaint. A "not satisfied" follow-up
//     puts the complaint back on the follow-up list, so the owner
//     sees it again — the complaint record itself is never touched,
//     and this module holds no complaint status, bill, or payment
//     field, so there is nothing here that could rewrite one.
//   - Each closed complaint shows at most one open follow-up due
//     date: one record per complaint, and a second record for the
//     same complaint is refused.
//   - A follow-up is never edited, only completed once and then
//     annotated. There is no edit function: only record, complete,
//     annotate, and remove. Completing records the outcome once and
//     a dated follow-up never rewrites the complaint link, the due
//     date, the outcome, or the note.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

export const COMPLAINT_FOLLOWUP_STORE = 'shahdara_complaint_followups_v1';
export const COMPLAINT_FOLLOWUP_FILENAME = 'complaint-followups.csv';

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validComplaintFollowupDate(value) {
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

function cleanStillSatisfied(raw) {
  if (raw === true) return true;
  if (raw === false) return false;
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'string') {
    const value = raw.trim().toLowerCase();
    if (value === 'yes') return true;
    if (value === 'no') return false;
  }
  return undefined;
}

function cleanFollowup(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const date = text(raw.date);
  const note = text(raw.note);
  if (!validComplaintFollowupDate(date) || !note) return null;
  return { date, note };
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const complaintRef = text(raw.complaintRef);
  const dueDate = text(raw.dueDate);
  const note = text(raw.note);
  if (!id || !complaintRef || !note) return null;
  if (!validComplaintFollowupDate(dueDate)) return null;
  const stillSatisfied = cleanStillSatisfied(raw.stillSatisfied);
  if (stillSatisfied === undefined) return null;
  const followups = Array.isArray(raw.followups)
    ? raw.followups.map(cleanFollowup).filter(Boolean)
    : [];
  return { id, complaintRef, dueDate, stillSatisfied, note, followups };
}

export function normalizeComplaintFollowupList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenComplaints = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeEntry(raw);
    if (!entry) continue;
    if (seenIds.has(entry.id)) continue;
    const key = entry.complaintRef.toLowerCase();
    if (seenComplaints.has(key)) continue;
    seenIds.add(entry.id);
    seenComplaints.add(key);
    out.push(entry);
  }
  return out;
}

export function recordComplaintFollowup(list, raw) {
  const clean = normalizeComplaintFollowupList(list);
  const entry = normalizeEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  if (clean.some((item) => item.complaintRef.toLowerCase() === entry.complaintRef.toLowerCase())) return clean;
  return [...clean, entry];
}

export function removeComplaintFollowup(list, id) {
  const clean = normalizeComplaintFollowupList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findComplaintFollowup(list, id) {
  const clean = normalizeComplaintFollowupList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

export function addComplaintFollowupNote(list, id, date, note) {
  const clean = normalizeComplaintFollowupList(list);
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

// Completing records the outcome once: still satisfied yes or no,
// with a dated note of what the customer said. A completed
// follow-up cannot be completed again, and completing never
// rewrites the complaint link, the due date, or the note.
export function completeComplaintFollowup(list, id, stillSatisfied, date, note) {
  const clean = normalizeComplaintFollowupList(list);
  const wanted = text(id);
  const answer = cleanStillSatisfied(stillSatisfied);
  const followup = cleanFollowup({ date, note });
  if (!wanted || answer === undefined || answer === null || !followup) return clean;
  let changed = false;
  const out = clean.map((item) => {
    if (item.id !== wanted) return item;
    if (item.stillSatisfied !== null) return item;
    changed = true;
    return { ...item, stillSatisfied: answer, followups: [...item.followups, followup] };
  });
  return changed ? out : clean;
}

function compareEntries(a, b) {
  if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  if (a.complaintRef !== b.complaintRef) return a.complaintRef < b.complaintRef ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function complaintFollowupSorted(list) {
  return normalizeComplaintFollowupList(list).sort(compareEntries);
}

export function followupsForComplaint(list, complaintRef) {
  const wanted = text(complaintRef).toLowerCase();
  if (!wanted) return [];
  return complaintFollowupSorted(list).filter((item) => item.complaintRef.toLowerCase() === wanted);
}

export function complaintFollowupComplaints(list) {
  const seen = new Set();
  const out = [];
  for (const item of complaintFollowupSorted(list)) {
    const key = item.complaintRef.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.complaintRef);
  }
  return out;
}

// At most one open follow-up due date per closed complaint: the
// open record for that complaint, or null when there is none.
export function complaintFollowupDue(list, complaintRef) {
  const wanted = text(complaintRef);
  if (!wanted) return null;
  const clean = normalizeComplaintFollowupList(list);
  return clean.find((item) => item.complaintRef.toLowerCase() === wanted.toLowerCase() && item.stillSatisfied === null) || null;
}

// The open follow-up list: follow-ups not yet done, plus the ones
// answered "not satisfied", which reopen the follow-up list —
// never the complaint itself. Sorted by due date.
export function openComplaintFollowups(list) {
  return complaintFollowupSorted(list).filter((item) => item.stillSatisfied !== true);
}

export function complaintFollowupSummaryText(list) {
  const clean = normalizeComplaintFollowupList(list);
  if (!clean.length) return 'No complaint follow-ups recorded.';
  const open = clean.filter((item) => item.stillSatisfied === null).length;
  const satisfied = clean.filter((item) => item.stillSatisfied === true).length;
  const notSatisfied = clean.filter((item) => item.stillSatisfied === false).length;
  return `${clean.length} complaint follow-up${clean.length === 1 ? '' : 's'}: ${open} open, ${satisfied} still satisfied, ${notSatisfied} not satisfied.`;
}

export function complaintFollowupText(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return 'No complaint follow-up recorded.';
  const outcome = clean.stillSatisfied === null
    ? 'open, due'
    : clean.stillSatisfied ? 'still satisfied' : 'not satisfied';
  const notes = clean.followups.length
    ? ` Follow-ups: ${clean.followups.map((f) => `${f.date}: ${f.note}`).join('; ')}`
    : '';
  return `Complaint ${clean.complaintRef} (due ${clean.dueDate}): ${outcome} — ${clean.note.replace(/\.+$/, '')}.${notes}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function complaintFollowupHtml(entry) {
  const clean = normalizeEntry(entry);
  if (!clean) return '<p>No complaint follow-up recorded.</p>';
  const outcome = clean.stillSatisfied === null
    ? 'open, due'
    : clean.stillSatisfied ? 'still satisfied' : 'not satisfied';
  const notes = clean.followups.length
    ? `<br>Follow-ups: ${escapeHtml(clean.followups.map((f) => `${f.date}: ${f.note}`).join('; '))}`
    : '';
  return `<p>Complaint <strong>${escapeHtml(clean.complaintRef)}</strong> (due ${escapeHtml(clean.dueDate)}): ${outcome} — ${escapeHtml(clean.note.replace(/\.+$/, ''))}.${notes}</p>`;
}

export function complaintFollowupAllHtml(list) {
  const sorted = complaintFollowupSorted(list);
  if (!sorted.length) return '<p>No complaint follow-ups recorded.</p>';
  return `<ul>${sorted.map((entry) => `<li>${escapeHtml(complaintFollowupText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function complaintFollowupCsv(list) {
  const sorted = complaintFollowupSorted(list);
  const header = ['id', 'complaint reference', 'due date', 'still satisfied', 'note', 'follow-ups'];
  const rows = sorted.map((item) => [
    item.id,
    item.complaintRef,
    item.dueDate,
    item.stillSatisfied === null ? 'open' : item.stillSatisfied ? 'yes' : 'no',
    item.note,
    item.followups.map((f) => `${f.date}: ${f.note}`).join('; '),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function complaintFollowupFilename() {
  return 'complaint-followups.csv';
}
