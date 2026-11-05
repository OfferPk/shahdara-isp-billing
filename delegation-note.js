// Plan 298 (Plan 203-350) — Owner task delegation note.
//
// The owner asks a staff member to do something, and later both
// remember the task differently, or it is forgotten entirely. This
// module adds only the missing piece: one dated delegation note per
// task — the task in plain words, who it was delegated to, who
// delegated it, the date, the due date, and whether it was
// acknowledged — so a dropped task can be traced back to a written
// note instead of two different memories.
//
// What this module is NOT, stated plainly:
//   - It is not a handover note. The staff handover note covers a
//     person handing over their whole role — routines, keys, and
//     open tasks passing between staff members — and the field
//     handover note covers field work passing between collectors.
//     Neither of those records is read or rewritten here; this
//     module only covers one task delegated by the owner to one
//     staff member.
//   - It is not an action on any other record. A delegation links
//     to a task by reference only: recording one never reassigns,
//     closes, or changes any task, visit, bill, payment, or
//     customer record by itself, and marking a note acknowledged
//     changes only that note's own acknowledgement.
//   - It is not proof that a task is really done. The record says
//     what the operator recorded; the module verifies format and
//     ordering, not truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every note,
//     and the module never reads storage, the clock, or the
//     network, and never mutates an input.
//   - A note with no id, no task in plain words, no delegated-to
//     person, no delegated-by person, no strict date, or no strict
//     due date is refused outright. Unknown fields are dropped, so
//     a note can never grow a bill, payment, customer, or task
//     field.
//   - A duplicate id is never rewritten: the first note stays.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validDelegationNoteDate(value) {
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

/** Acknowledgement folds from plain spellings; anything else reads as not yet acknowledged. */
function foldAcknowledged(value) {
  if (value === true) return true;
  if (typeof value === 'number') return value === 1;
  const word = text(value).toLowerCase();
  return word === 'true' || word === 'yes' || word === 'acknowledged' || word === 'ack' || word === '1';
}

/**
 * One delegation note, or null when half-formed. A note needs an
 * id, a task in plain words, a delegated-to person, a delegated-by
 * person, a strict date, and a strict due date that is not before
 * the date. Unknown fields are dropped; the input is never mutated.
 */
export function normalizeDelegationNote(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const task = text(raw.task);
  const delegatedTo = text(raw.delegatedTo);
  const delegatedBy = text(raw.delegatedBy);
  const date = text(raw.date);
  const dueDate = text(raw.dueDate);
  const acknowledged = foldAcknowledged(raw.acknowledged);
  if (!id) return null;
  if (!task) return null;
  if (!delegatedTo) return null;
  if (!delegatedBy) return null;
  if (!validDelegationNoteDate(date)) return null;
  if (!validDelegationNoteDate(dueDate)) return null;
  if (dueDate < date) return null;
  return { id, task, delegatedTo, delegatedBy, date, dueDate, acknowledged };
}

/** Normalised notes only; a duplicate id is never rewritten, the first stays. */
export function normalizeDelegationNoteList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const note = normalizeDelegationNote(raw);
    if (!note || seen.has(note.id)) continue;
    seen.add(note.id);
    out.push(note);
  }
  return out;
}

export function findDelegationNote(list, id) {
  const clean = normalizeDelegationNoteList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((note) => note.id === wanted) ?? null;
}

/**
 * Record a delegation. Refused when half-formed or when its id is
 * already recorded — the first note for an id always stays.
 */
export function recordDelegationNote(list, raw) {
  const clean = normalizeDelegationNoteList(list);
  const note = normalizeDelegationNote(raw);
  if (!note) return clean;
  if (clean.some((item) => item.id === note.id)) return clean;
  return [...clean, note];
}

export function removeDelegationNote(list, id) {
  const clean = normalizeDelegationNoteList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((note) => note.id !== wanted);
}

/**
 * Mark one note acknowledged. Only that note's own acknowledgement
 * changes; no task, visit, bill, payment, or customer record is
 * touched, and the original list is never mutated.
 */
export function markDelegationNoteAcknowledged(list, id) {
  const clean = normalizeDelegationNoteList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.map((note) => (note.id === wanted ? { ...note, acknowledged: true } : note));
}

/** Notes by due date, then delegated-to person, then id, so the same list always reads the same way. */
export function delegationNoteSorted(list) {
  const clean = normalizeDelegationNoteList(list);
  return [...clean].sort((a, b) => {
    if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    const aTo = a.delegatedTo.toLowerCase();
    const bTo = b.delegatedTo.toLowerCase();
    if (aTo !== bTo) return aTo < bTo ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Delegations for one staff member, in due-date order. */
export function delegationNotesForStaff(list, staff) {
  const clean = normalizeDelegationNoteList(list);
  const wanted = text(staff).toLowerCase();
  if (!wanted) return [];
  return delegationNoteSorted(clean.filter((note) => note.delegatedTo.toLowerCase() === wanted));
}

/** Staff members with delegations, first spelling kept, A-Z. */
export function delegationNoteStaff(list) {
  const clean = normalizeDelegationNoteList(list);
  const seen = new Map();
  for (const note of clean) {
    const key = note.delegatedTo.toLowerCase();
    if (!seen.has(key)) seen.set(key, note.delegatedTo);
  }
  return [...seen.values()].sort((a, b) => {
    const lowerA = a.toLowerCase();
    const lowerB = b.toLowerCase();
    return lowerA < lowerB ? -1 : lowerA > lowerB ? 1 : 0;
  });
}

/** Not-yet-acknowledged notes whose due date is before the caller-supplied as-of date. */
export function delegationNotesOverdue(list, asOf) {
  const clean = normalizeDelegationNoteList(list);
  const day = text(asOf);
  if (!validDelegationNoteDate(day)) return [];
  return delegationNoteSorted(
    clean.filter((note) => !note.acknowledged && note.dueDate < day),
  );
}

/** The next unacknowledged note by due date, or null when none is outstanding. */
export function delegationNoteNextDue(list) {
  const clean = normalizeDelegationNoteList(list);
  const open = delegationNoteSorted(clean.filter((note) => !note.acknowledged));
  return open.length ? open[0] : null;
}

export function delegationNoteSummaryText(list) {
  const clean = normalizeDelegationNoteList(list);
  if (clean.length === 0) return 'No delegation notes recorded.';
  const word = clean.length === 1 ? 'note' : 'notes';
  const open = clean.filter((note) => !note.acknowledged).length;
  const next = delegationNoteNextDue(clean);
  const nextText = next
    ? ` Next due on ${next.dueDate}: ${next.task}, delegated to ${next.delegatedTo}.`
    : ' Nothing outstanding.';
  return `${clean.length} delegation ${word} recorded. ${open} not yet acknowledged.${nextText}`;
}

/** Plain-words text for one note: date, task, people, due date, and acknowledgement. */
export function delegationNoteEntryText(note) {
  const clean = normalizeDelegationNote(note);
  if (!clean) return 'No delegation note recorded.';
  const ack = clean.acknowledged ? 'acknowledged' : 'not yet acknowledged';
  return `${clean.date} — ${clean.task}, delegated to ${clean.delegatedTo} by ${clean.delegatedBy}, due ${clean.dueDate}, ${ack}.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function delegationNoteEntryHtml(note) {
  const clean = normalizeDelegationNote(note);
  if (!clean) return '<p>No delegation note recorded.</p>';
  return `<p>${escapeHtml(delegationNoteEntryText(clean))}</p>`;
}

export function delegationNoteAllHtml(list) {
  const rows = delegationNoteSorted(list);
  if (!rows.length) return '<p>No delegation notes recorded.</p>';
  return `<ul>${rows.map((note) => `<li>${escapeHtml(delegationNoteEntryText(note))}</li>`).join('')}</ul>`;
}

export function delegationNotesForStaffHtml(list, staff) {
  const rows = delegationNotesForStaff(list, staff);
  if (!text(staff)) return '<p>Type a staff member name to see their delegations.</p>';
  if (!rows.length) return '<p>No delegations for that staff member.</p>';
  return `<ul>${rows.map((note) => `<li>${escapeHtml(delegationNoteEntryText(note))}</li>`).join('')}</ul>`;
}

export function delegationNotesOverdueHtml(list, asOf) {
  const rows = delegationNotesOverdue(list, asOf);
  if (!validDelegationNoteDate(text(asOf))) return '<p>Give a real date to see overdue delegations.</p>';
  if (!rows.length) return '<p>No overdue delegations.</p>';
  return `<ul>${rows.map((note) => `<li>${escapeHtml(delegationNoteEntryText(note))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function delegationNoteCsv(list) {
  const rows = delegationNoteSorted(list);
  const lines = ['"id","date","task","delegated to","delegated by","due date","acknowledged"'];
  for (const note of rows) {
    lines.push([
      csvCell(note.id),
      csvCell(note.date),
      csvCell(note.task),
      csvCell(note.delegatedTo),
      csvCell(note.delegatedBy),
      csvCell(note.dueDate),
      csvCell(note.acknowledged ? 'yes' : 'no'),
    ].join(','));
  }
  return lines.join('\n');
}

export function delegationNoteFilename() {
  return 'delegation-notes.csv';
}
