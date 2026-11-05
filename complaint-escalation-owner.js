// Plan 312 (Plan 203-350) — Complaint escalation to owner note.
//
// A complaint that field staff cannot settle has no clear
// path to the owner, so it stalls or is handled differently
// each time. This module adds only the missing piece: one
// escalation note per stuck complaint — the complaint
// reference, who escalated it, the date, the reason in plain
// words, the owner response, and the outcome — so a stuck
// complaint reaches the owner quickly and the owner answer
// is on record, not passed along by word of mouth.
//
// What this module is NOT, stated plainly:
//   - It is not the billing dispute follow-up queue, which
//     tracks billing disputes. That queue already exists
//     and is neither read nor rewritten here; this note
//     links to a complaint by reference only and says
//     nothing about any bill or balance.
//   - It is not the fault ticket ageing timer, which ages
//     open fault tickets. That timer already exists and is
//     neither read nor rewritten here; an escalation note
//     never opens, ages, or closes a ticket by itself.
//   - It is not the staff duty roster, which posts who is
//     on duty each day. That roster already exists and is
//     neither read nor rewritten here; an escalation note
//     names who escalated a complaint, never who is on duty.
//   - It is not the owner decision log, which records
//     owner decisions. That log already exists and is
//     neither read nor rewritten here; an owner response
//     written here is the answer to one complaint, and it
//     is not copied into any decision log.
//   - It is not a bill, payment, customer, or ticket
//     change. Recording an escalation never changes any
//     bill, payment, customer record, or ticket by itself.
//   - It is not an editable record. A past note is never
//     silently edited: there is no edit function, only
//     record, find, remove, and answering by the owner;
//     a wrong note is removed and recorded again.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies
//     every note, and the module never reads storage,
//     the clock, or the network, and never mutates an
//     input.
//   - A note with no id, no complaint reference, no
//     escalated-by name, no strict date, or no reason in
//     plain words is refused outright. Unknown fields are
//     dropped, so a note can never grow a bill, payment,
//     customer, or ticket field.
//   - The owner response and the outcome start empty and
//     open; the owner answers one note at a time, and
//     answering changes only that note.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const COMPLAINT_ESCALATION_OWNER_OUTCOMES = [
  'open',
  'resolved',
  'closed',
  'referred back',
];

const OUTCOME_ALIASES = {
  open: 'open',
  pending: 'open',
  awaiting: 'open',
  resolved: 'resolved',
  settled: 'resolved',
  done: 'resolved',
  closed: 'closed',
  'referred back': 'referred back',
  'referred-back': 'referred back',
  referred: 'referred back',
};

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar day: YYYY-MM-DD that really exists, or false. */
export function validComplaintEscalationOwnerDay(value) {
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

/**
 * One outcome in canonical form — open, resolved, closed,
 * or referred back — or null when the value names none of
 * them. A missing outcome reads as open.
 */
export function foldComplaintEscalationOwnerOutcome(value) {
  const key = text(value).toLowerCase();
  if (!key) return 'open';
  return OUTCOME_ALIASES[key] ?? null;
}

/**
 * One escalation note, or null when half-formed. A note
 * needs an id, a complaint reference, an escalated-by
 * name, a strict date, and a reason in plain words. The
 * owner response starts empty and the outcome starts
 * open; unknown fields are dropped and the input is
 * never mutated.
 */
export function normalizeComplaintEscalationOwnerNote(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const complaintRef = text(raw.complaintRef);
  const escalatedBy = text(raw.escalatedBy);
  const date = text(raw.date);
  const reason = text(raw.reason);
  const ownerResponse = text(raw.ownerResponse);
  const outcome = foldComplaintEscalationOwnerOutcome(raw.outcome);
  if (!id) return null;
  if (!complaintRef) return null;
  if (!escalatedBy) return null;
  if (!validComplaintEscalationOwnerDay(date)) return null;
  if (!reason) return null;
  if (outcome === null) return null;
  return { id, complaintRef, escalatedBy, date, reason, ownerResponse, outcome };
}

/** Normalised escalation notes only; a duplicate id is never rewritten, the first stays. */
export function normalizeComplaintEscalationOwnerNoteList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const note = normalizeComplaintEscalationOwnerNote(raw);
    if (!note || seen.has(note.id)) continue;
    seen.add(note.id);
    out.push(note);
  }
  return out;
}

export function findComplaintEscalationOwnerNote(list, id) {
  const clean = normalizeComplaintEscalationOwnerNoteList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((note) => note.id === wanted) ?? null;
}

/**
 * Record an escalation note. Refused when half-formed or
 * when its id is already recorded — the first note with
 * an id always stays.
 */
export function recordComplaintEscalationOwnerNote(list, raw) {
  const clean = normalizeComplaintEscalationOwnerNoteList(list);
  const note = normalizeComplaintEscalationOwnerNote(raw);
  if (!note) return clean;
  if (clean.some((item) => item.id === note.id)) return clean;
  return [...clean, note];
}

export function removeComplaintEscalationOwnerNote(list, id) {
  const clean = normalizeComplaintEscalationOwnerNoteList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((note) => note.id !== wanted);
}

/**
 * The owner answers one escalation note: the response in
 * plain words and the outcome it leaves the complaint in.
 * Refused when the note is missing, the response is empty,
 * or the outcome names nothing known — answering changes
 * only that one note, never any bill, payment, customer
 * record, or ticket.
 */
export function answerComplaintEscalationOwnerNote(list, id, ownerResponse, outcome) {
  const clean = normalizeComplaintEscalationOwnerNoteList(list);
  const wanted = text(id);
  const response = text(ownerResponse);
  const folded = foldComplaintEscalationOwnerOutcome(outcome);
  if (!wanted || !response || folded === null) return clean;
  return clean.map((note) => (
    note.id === wanted ? { ...note, ownerResponse: response, outcome: folded } : note
  ));
}

function dateOrder(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.id < b.id ? -1 : 1;
}

/** Escalation notes, earliest date first, so the oldest stuck complaint reads first. */
export function complaintEscalationOwnerNotesSorted(list) {
  return normalizeComplaintEscalationOwnerNoteList(list).sort(dateOrder);
}

/** Escalation notes for one complaint reference, earliest first. */
export function complaintEscalationOwnerNotesForComplaint(list, complaintRef) {
  const wanted = text(complaintRef).toLowerCase();
  if (!wanted) return [];
  return complaintEscalationOwnerNotesSorted(list)
    .filter((note) => note.complaintRef.toLowerCase() === wanted);
}

/** Escalations still open — waiting on the owner answer. */
export function complaintEscalationOwnerOpenNotes(list) {
  return complaintEscalationOwnerNotesSorted(list)
    .filter((note) => note.outcome === 'open');
}

/** Complaint references that have been escalated, in A-Z order, keeping the first spelling seen. */
export function complaintEscalationOwnerComplaintRefs(list) {
  const clean = normalizeComplaintEscalationOwnerNoteList(list);
  const byLower = new Map();
  for (const note of clean) {
    const key = note.complaintRef.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, note.complaintRef);
  }
  return [...byLower.values()].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
}

/** Plain-words summary: the count, how many are still open, and the oldest open one. */
export function complaintEscalationOwnerSummaryText(list) {
  const clean = normalizeComplaintEscalationOwnerNoteList(list);
  if (!clean.length) return 'No complaint escalations to the owner recorded.';
  const open = clean.filter((note) => note.outcome === 'open');
  const countWord = clean.length === 1 ? '1 escalation' : `${clean.length} escalations`;
  if (!open.length) return `${countWord}, all answered.`;
  const oldest = complaintEscalationOwnerNotesSorted(open)[0];
  const openWord = open.length === 1 ? '1 still open' : `${open.length} still open`;
  return `${countWord}, ${openWord}. Oldest open: ${oldest.complaintRef} from ${oldest.date} — ${oldest.reason}.`;
}

/** One line naming an escalation, with reason, owner response, and outcome visible. */
export function complaintEscalationOwnerNoteText(note) {
  const clean = normalizeComplaintEscalationOwnerNote(note);
  if (!clean) return '';
  const response = clean.ownerResponse ? clean.ownerResponse : 'No owner response yet.';
  return `${clean.date} — ${clean.complaintRef} escalated by ${clean.escalatedBy}: ${clean.reason} Owner response: ${response} Outcome: ${clean.outcome}.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function complaintEscalationOwnerNoteHtml(note) {
  const clean = normalizeComplaintEscalationOwnerNote(note);
  if (!clean) return '';
  return `<li>${escapeHtml(complaintEscalationOwnerNoteText(clean))}</li>`;
}

export function complaintEscalationOwnerAllHtml(list) {
  const sorted = complaintEscalationOwnerNotesSorted(list);
  if (!sorted.length) return '<p>No complaint escalations to the owner recorded.</p>';
  return `<ul>${sorted.map((note) => complaintEscalationOwnerNoteHtml(note)).join('')}</ul>`;
}

export function complaintEscalationOwnerNotesForComplaintHtml(list, complaintRef) {
  const notes = complaintEscalationOwnerNotesForComplaint(list, complaintRef);
  if (!notes.length) return '<p>No escalations for that complaint reference.</p>';
  return `<ul>${notes.map((note) => complaintEscalationOwnerNoteHtml(note)).join('')}</ul>`;
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function complaintEscalationOwnerCsv(list) {
  const sorted = complaintEscalationOwnerNotesSorted(list);
  const header = ['id', 'complaintRef', 'escalatedBy', 'date', 'reason', 'ownerResponse', 'outcome'].join(',');
  const rows = sorted.map((note) => [note.id, note.complaintRef, note.escalatedBy, note.date, note.reason, note.ownerResponse, note.outcome].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function complaintEscalationOwnerFilename() {
  return 'complaint-escalations-to-owner.csv';
}
