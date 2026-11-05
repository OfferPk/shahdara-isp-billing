// Plan 272 (Plan 203-350) — Payment difficulty conversation note.
//
// A customer who is struggling to pay talks to the collector, but
// the conversation was not recorded, so the next visit started
// with no memory of what was agreed informally. This module adds
// only the missing piece: one conversation note per payment
// difficulty talk — the customer, the date, the difficulty
// described in plain words, the next step agreed, and a follow-up
// date — so the next visit starts from what was already agreed.
//
// What this module is NOT, stated plainly:
//   - It is not the arrears repayment plan, the bill extension,
//     or the retention offer. Those are formal arrangements, and
//     they are neither read nor rewritten here. This module
//     records only a conversation; recording a note never
//     changes any bill, payment, or plan, and never grants any
//     discount or extension by itself.
//   - It never changes any bill, payment, or plan record.
//     This module holds no bill, payment, plan, discount, or
//     extension field, so there is nothing here that could
//     rewrite one. A note only adds the conversation record.
//   - Notes are never edited. There is no edit function:
//     only record, find, and remove. A wrong note is removed
//     and recorded again.
//   - A note with no customer, no date, or no difficulty is
//     refused, and a follow-up date that is not a real date
//     is refused too.
//   - Inputs are never mutated, and the module never reads
//     storage, the clock, the network, or the page.

export const PAYMENT_DIFFICULTY_STORE = 'shahdara_payment_difficulty_notes_v1';
export const PAYMENT_DIFFICULTY_FILENAME = 'payment-difficulty-notes.csv';

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validDifficultyNoteDate(value) {
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

function normalizeNote(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = text(raw.id);
  const customer = text(raw.customer);
  const date = text(raw.date);
  const difficulty = text(raw.difficulty);
  if (!id || !customer || !difficulty) return null;
  if (!validDifficultyNoteDate(date)) return null;
  const nextStep = text(raw.nextStep);
  const followUpDate = text(raw.followUpDate);
  if (followUpDate && !validDifficultyNoteDate(followUpDate)) return null;
  return { id, customer, date, difficulty, nextStep, followUpDate };
}

export function normalizeDifficultyNoteList(list) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const out = [];
  for (const raw of list) {
    const note = normalizeNote(raw);
    if (!note) continue;
    if (seenIds.has(note.id)) continue;
    seenIds.add(note.id);
    out.push(note);
  }
  return out;
}

export function recordDifficultyNote(list, raw) {
  const clean = normalizeDifficultyNoteList(list);
  const note = normalizeNote(raw);
  if (!note) return clean;
  if (clean.some((item) => item.id === note.id)) return clean;
  return [...clean, note];
}

export function removeDifficultyNote(list, id) {
  const clean = normalizeDifficultyNoteList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((item) => item.id !== wanted);
}

export function findDifficultyNote(list, id) {
  const clean = normalizeDifficultyNoteList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((item) => item.id === wanted) || null;
}

function compareNotes(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function difficultyNoteSorted(list) {
  return normalizeDifficultyNoteList(list).sort(compareNotes);
}

export function difficultyNotesForCustomer(list, customer) {
  const wanted = text(customer).toLowerCase();
  if (!wanted) return [];
  return difficultyNoteSorted(list).filter((item) => item.customer.toLowerCase() === wanted);
}

function compareFollowups(a, b) {
  if (a.followUpDate !== b.followUpDate) return a.followUpDate < b.followUpDate ? -1 : 1;
  return compareNotes(a, b);
}

export function overdueDifficultyFollowups(list, asOf) {
  const reference = text(asOf);
  if (!validDifficultyNoteDate(reference)) return [];
  return normalizeDifficultyNoteList(list)
    .filter((item) => item.followUpDate && item.followUpDate < reference)
    .sort(compareFollowups);
}

export function difficultyNoteCustomers(list) {
  const seen = new Set();
  const out = [];
  for (const item of difficultyNoteSorted(list)) {
    const key = item.customer.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.customer);
  }
  return out;
}

export function difficultyNoteSummaryText(list) {
  const clean = normalizeDifficultyNoteList(list);
  if (!clean.length) return 'No payment difficulty notes recorded.';
  const customers = difficultyNoteCustomers(list).length;
  return `${clean.length} payment difficulty note${clean.length === 1 ? '' : 's'} for ${customers} customer${customers === 1 ? '' : 's'}.`;
}

export function difficultyNoteText(note) {
  const clean = normalizeNote(note);
  if (!clean) return 'No payment difficulty note recorded.';
  const step = clean.nextStep ? ` Next step: ${clean.nextStep.replace(/\.+$/, '')}.` : '';
  const follow = clean.followUpDate ? ` Follow up by ${clean.followUpDate}.` : '';
  return `${clean.date}: ${clean.customer} — ${clean.difficulty.replace(/\.+$/, '')}.${step}${follow}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function difficultyNoteHtml(note) {
  const clean = normalizeNote(note);
  if (!clean) return '<p>No payment difficulty note recorded.</p>';
  return `<p>${escapeHtml(difficultyNoteText(note))}</p>`;
}

export function difficultyNoteAllHtml(list) {
  const sorted = difficultyNoteSorted(list);
  if (!sorted.length) return '<p>No payment difficulty notes recorded.</p>';
  return `<ul>${sorted.map((note) => `<li>${escapeHtml(difficultyNoteText(note))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function difficultyNoteCsv(list) {
  const sorted = difficultyNoteSorted(list);
  const header = ['id', 'customer', 'date', 'difficulty', 'nextStep', 'followUpDate'];
  const rows = sorted.map((item) => [
    item.id,
    item.customer,
    item.date,
    item.difficulty,
    item.nextStep,
    item.followUpDate,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function difficultyNoteFilename() {
  return 'payment-difficulty-notes.csv';
}
