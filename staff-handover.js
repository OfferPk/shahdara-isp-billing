// Plan 183 (Plan 101-202) — Staff Handover Notes.
//
// When a staff member changes role or leaves, what they knew about
// shop routines, keys, and open tasks walks out with them. This
// module is the written handover: one note per handover with the
// person handing over, the person receiving, a date, a routine, an
// open task, and a note. A handover can be recorded, listed by
// person and date, and marked received.
//
// What this module is NOT, stated plainly:
//   - It is not a second copy of Plan 160's field handover note.
//     Plan 160 records field work passing between collectors
//     (open jobs with their status, plus warnings). This module
//     records staff handovers: shop routines, keys, and open
//     tasks passing between staff members. Neither module is
//     read or written here, and neither rewrites the other.
//   - It is not an action on any other record. A handover links
//     to a task by reference only: recording one never
//     reassigns or closes any task, and never changes any bill,
//     payment, customer record, or past visit by itself.
//   - It is not proof that a task is really open. The record
//     says what the operator recorded; the module verifies
//     format and ordering, not truth.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     record, and the module never reads storage, the clock,
//     or the network, and never touches another record type.
//   - Unknown fields are dropped, so no bill, payment, task,
//     visit, or sending field can ever creep into a note.
//   - A bad date is refused outright, never stored as a
//     neighbouring date.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function lower(value) {
  return text(value).toLowerCase();
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return DAYS_IN_MONTH[month - 1];
}

function parseStrictDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function isStrictDate(value) {
  return parseStrictDate(value) !== null;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeCsv(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function normalizeStaffHandover(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const id = text(value.id);
  const fromPerson = text(value.fromPerson);
  const toPerson = text(value.toPerson);
  const date = text(value.date);
  const routine = text(value.routine);
  if (!id || !fromPerson || !toPerson || !routine) return null;
  if (!parseStrictDate(date)) return null;
  const received = value.received === true;
  let receivedDate = '';
  if (received) {
    receivedDate = text(value.receivedDate);
    if (!parseStrictDate(receivedDate)) return null;
  }
  return {
    id,
    fromPerson,
    toPerson,
    date,
    routine,
    openTask: text(value.openTask),
    note: text(value.note),
    received,
    receivedDate,
  };
}

export function normalizeStaffHandoverList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const item of value) {
    const note = normalizeStaffHandover(item);
    if (!note || seen.has(note.id)) continue;
    seen.add(note.id);
    out.push(note);
  }
  return out;
}

export function findStaffHandover(list, id) {
  const notes = normalizeStaffHandoverList(list);
  const wanted = text(id);
  return notes.find((note) => note.id === wanted) || null;
}

export function recordStaffHandover(list, value) {
  const notes = normalizeStaffHandoverList(list);
  const note = normalizeStaffHandover(value);
  if (!note) return notes;
  const existing = notes.find((item) => item.id === note.id);
  if (existing) {
    if (JSON.stringify(existing) === JSON.stringify(note)) return notes;
    return notes;
  }
  return [...notes, note];
}

export function removeStaffHandover(list, id) {
  const notes = normalizeStaffHandoverList(list);
  const wanted = text(id);
  return notes.filter((note) => note.id !== wanted);
}

export function markStaffHandoverReceived(list, id, receivedDate) {
  const notes = normalizeStaffHandoverList(list);
  const wanted = text(id);
  const date = text(receivedDate);
  if (!parseStrictDate(date)) return notes;
  return notes.map((note) =>
    note.id === wanted ? { ...note, received: true, receivedDate: date } : note,
  );
}

export function markStaffHandoverNotReceived(list, id) {
  const notes = normalizeStaffHandoverList(list);
  const wanted = text(id);
  return notes.map((note) =>
    note.id === wanted ? { ...note, received: false, receivedDate: '' } : note,
  );
}

function compareDateDesc(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function staffHandoversSorted(list) {
  return normalizeStaffHandoverList(list).sort(compareDateDesc);
}

export function staffHandoversForPerson(list, person) {
  const wanted = lower(person);
  if (!wanted) return [];
  return staffHandoversSorted(list).filter(
    (note) => lower(note.fromPerson) === wanted || lower(note.toPerson) === wanted,
  );
}

export function staffHandoversReceived(list) {
  return staffHandoversSorted(list).filter((note) => note.received);
}

export function staffHandoversNotReceived(list) {
  return staffHandoversSorted(list).filter((note) => !note.received);
}

export function staffHandoverPersons(list) {
  const first = new Map();
  for (const note of normalizeStaffHandoverList(list)) {
    for (const person of [note.fromPerson, note.toPerson]) {
      const key = lower(person);
      if (!first.has(key)) first.set(key, person);
    }
  }
  return [...first.values()].sort((a, b) => (lower(a) < lower(b) ? -1 : lower(a) > lower(b) ? 1 : 0));
}

export function staffHandoverText(note) {
  const item = normalizeStaffHandover(note);
  if (!item) return '';
  const task = item.openTask ? ` Open task: ${item.openTask}.` : '';
  const extra = item.note ? ` Note: ${item.note}.` : '';
  const state = item.received ? ` Received on ${item.receivedDate}.` : ' Not yet received.';
  return `Handover on ${item.date}: ${item.fromPerson} to ${item.toPerson} — routine: ${item.routine}.${task}${extra}${state}`;
}

export function staffHandoverSummaryText(list) {
  const notes = normalizeStaffHandoverList(list);
  const received = notes.filter((note) => note.received).length;
  return `${notes.length} staff handover notes, ${received} received, ${notes.length - received} not yet received`;
}

export function staffHandoverHtml(note) {
  const item = normalizeStaffHandover(note);
  if (!item) return '';
  return `<p>${escapeHtml(staffHandoverText(item))}</p>`;
}

export function staffHandoverAllHtml(list) {
  return staffHandoversSorted(list).map((note) => staffHandoverHtml(note)).join('');
}

export function staffHandoverCsv(list) {
  const header = ['id', 'from', 'to', 'date', 'routine', 'open task', 'note', 'received', 'received date'];
  const rows = staffHandoversSorted(list).map((note) => [
    note.id,
    note.fromPerson,
    note.toPerson,
    note.date,
    note.routine,
    note.openTask,
    note.note,
    note.received ? 'yes' : 'no',
    note.receivedDate,
  ].map(escapeCsv).join(','));
  return [header.map(escapeCsv).join(','), ...rows].join('\n');
}

export function staffHandoverFilename() {
  return 'staff-handovers.csv';
}
