// Plan 314 (Plan 203-350) — Staff recognition note.
//
// Good work by staff is thanked in passing and forgotten, so
// nobody has a record of who went beyond their duty and when.
// This module adds only the missing piece: one recognition
// note per staff member — the staff member, the achievement
// in plain words, the date, and who recognised them — so the
// notes can be listed per staff member by date with the
// achievement and the recogniser visible.
//
// What this module is NOT, stated plainly:
//   - It is not the long-standing customer recognition list,
//     which recognises customers. That list already exists
//     and is neither read nor rewritten here; a note here
//     recognises staff only, never a customer.
//   - It is not the annual leave planner, which plans leave
//     across the year. That planner already exists and is
//     neither read nor rewritten here; recognising someone
//     never plans, grants, or changes any leave.
//   - It is not the staff duty roster, which posts who is on
//     duty each day. That roster already exists and is
//     neither read nor rewritten here; a note never puts
//     anyone on or off duty by itself.
//   - It is not the staff performance note, which records a
//     qualitative review of a staff member. That note
//     already exists and is neither read nor rewritten here;
//     a thank-you is not a review, and it changes no
//     performance record.
//   - It is not a bill, payment, customer record, or staff
//     record change. Recording a note never changes any
//     bill, payment, customer record, or staff record by
//     itself, and it grants no payment or bonus on its own.
//   - It is not an editable record. A past note is never
//     silently edited: there is no edit function, only
//     record, find, and remove; a wrong note is removed and
//     recorded again.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     note, and the module never reads storage, the clock,
//     or the network, and never mutates an input.
//   - A note with no id, no staff member, no achievement in
//     plain words, no strict date, or no recogniser is
//     refused outright. Unknown fields are dropped, so a
//     note can never grow a bill, payment, customer, bonus,
//     or roster field.
//   - Staff members match without caring about capital
//     letters, so "Saad" and "saad" are the same person in
//     a listing, while the name as first recorded is what
//     is shown.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function staffKey(value) {
  return text(value).toLowerCase();
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar day: YYYY-MM-DD that really exists, or false. */
export function validStaffRecognitionDay(value) {
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
 * One note in canonical form, or null when the raw note is
 * missing an id, a staff member, an achievement, a strict
 * date, or a recogniser. Unknown fields are dropped.
 */
export function normalizeStaffRecognitionNote(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const staffMember = text(raw.staffMember);
  const achievement = text(raw.achievement);
  const date = text(raw.date);
  const recognisedBy = text(raw.recognisedBy);
  if (!id || !staffMember || !achievement || !validStaffRecognitionDay(date) || !recognisedBy) return null;
  return { id, staffMember, achievement, date, recognisedBy };
}

/** A list of notes in canonical form; bad entries and later duplicate ids are dropped. */
export function normalizeStaffRecognitionNoteList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const note = normalizeStaffRecognitionNote(raw);
    if (!note || seen.has(note.id)) continue;
    seen.add(note.id);
    out.push(note);
  }
  return out;
}

/** The note with this id, or null when there is none. */
export function findStaffRecognitionNote(list, id) {
  const notes = normalizeStaffRecognitionNoteList(list);
  const wanted = text(id);
  return notes.find((note) => note.id === wanted) ?? null;
}

/**
 * Record one note. A note that is refused, or whose id is
 * already recorded, leaves the list exactly as it was.
 */
export function recordStaffRecognitionNote(list, raw) {
  const notes = normalizeStaffRecognitionNoteList(list);
  const note = normalizeStaffRecognitionNote(raw);
  if (!note) return notes;
  if (notes.some((entry) => entry.id === note.id)) return notes;
  return [...notes, note];
}

/** Remove the note with this id; removing an unknown id changes nothing. */
export function removeStaffRecognitionNote(list, id) {
  const notes = normalizeStaffRecognitionNoteList(list);
  const wanted = text(id);
  return notes.filter((note) => note.id !== wanted);
}

function noteOrder(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** All notes, earliest date first. */
export function staffRecognitionNotesSorted(list) {
  return normalizeStaffRecognitionNoteList(list).sort(noteOrder);
}

/** Notes for one staff member, earliest date first; capital letters do not matter. */
export function staffRecognitionNotesForStaff(list, staffMember) {
  const wanted = staffKey(staffMember);
  if (!wanted) return [];
  return staffRecognitionNotesSorted(list).filter((note) => staffKey(note.staffMember) === wanted);
}

/** Staff members with at least one note, in the order first recorded. */
export function staffRecognitionStaffMembers(list) {
  const seen = new Set();
  const out = [];
  for (const note of normalizeStaffRecognitionNoteList(list)) {
    const key = staffKey(note.staffMember);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(note.staffMember);
  }
  return out;
}

/** Plain-words summary: how many notes, for how many staff members. */
export function staffRecognitionSummaryText(list) {
  const notes = normalizeStaffRecognitionNoteList(list);
  if (!notes.length) return 'No staff recognition notes recorded.';
  const members = staffRecognitionStaffMembers(list);
  const noteWord = notes.length === 1 ? 'note' : 'notes';
  const memberWord = members.length === 1 ? 'staff member' : 'staff members';
  return `${notes.length} recognition ${noteWord} for ${members.length} ${memberWord}.`;
}

/** One note as one plain-words line. */
export function staffRecognitionNoteText(note) {
  const clean = normalizeStaffRecognitionNote(note);
  if (!clean) return '';
  return `${clean.staffMember} — ${clean.achievement} — ${clean.date} — recognised by ${clean.recognisedBy}.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** One note as one list item, with user text escaped. */
export function staffRecognitionNoteHtml(note) {
  const clean = normalizeStaffRecognitionNote(note);
  if (!clean) return '';
  return `<li>${escapeHtml(clean.staffMember)} — ${escapeHtml(clean.achievement)} — ${escapeHtml(clean.date)} — recognised by ${escapeHtml(clean.recognisedBy)}.</li>`;
}

/** All notes grouped by staff member, each group earliest date first. */
export function staffRecognitionAllHtml(list) {
  const notes = normalizeStaffRecognitionNoteList(list);
  if (!notes.length) return '<p>No staff recognition notes recorded.</p>';
  return staffRecognitionStaffMembers(list).map((member) => {
    const memberNotes = staffRecognitionNotesForStaff(list, member);
    return `<h4>${escapeHtml(member)}</h4><ul>${memberNotes.map((note) => staffRecognitionNoteHtml(note)).join('')}</ul>`;
  }).join('');
}

/** Notes for one staff member as a list, earliest date first. */
export function staffRecognitionNotesForStaffHtml(list, staffMember) {
  const notes = staffRecognitionNotesForStaff(list, staffMember);
  if (!notes.length) return '<p>No recognition notes for that staff member.</p>';
  return `<ul>${notes.map((note) => staffRecognitionNoteHtml(note)).join('')}</ul>`;
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/** Notes as CSV, earliest date first, with a fixed header. */
export function staffRecognitionCsv(list) {
  const lines = ['id,staffMember,achievement,date,recognisedBy'];
  for (const note of staffRecognitionNotesSorted(list)) {
    lines.push([note.id, note.staffMember, note.achievement, note.date, note.recognisedBy].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** Fixed filename for the CSV export. */
export function staffRecognitionFilename() {
  return 'staff-recognition-notes.csv';
}
