// Plan 310 (Plan 203-350) — Daily shop diary.
//
// What happened in the shop each day — visitors, faults,
// cash notes, decisions — scatters across memory, so the
// week cannot be reconstructed later. This module adds only
// the missing piece: one diary entry per day — the date,
// the day's lines in plain words, and who entered them —
// so a question about "what happened that day" has an
// answer in seconds.
//
// What this module is NOT, stated plainly:
//   - It is not the Plan 6 owner collection digest, which
//     sums up collections. That digest already exists and
//     is neither read nor rewritten here; a diary entry
//     only writes down what happened, it composes no
//     digest of anything.
//   - It is not the Plan 184 owner decision log, which
//     records decisions. That log already exists and is
//     neither read nor rewritten here; a diary line may
//     mention a decision was made, but it records no
//     decision of its own.
//   - It is not the Plan 293 weekly review note, which
//     reviews a whole week. That note already exists and
//     is neither read nor rewritten here; a diary entry
//     covers one day only and never looks back over a
//     week.
//   - It is not the Plan 297 shop visitor log, which
//     records who visited. That log already exists and is
//     neither read nor rewritten here; a diary line may
//     mention a visitor, but it records no visit of its
//     own.
//   - It is not the Plan 309 absence handover checklist,
//     which lists work for a cover period. That checklist
//     already exists and is neither read nor rewritten
//     here; a diary entry is a record of the day, not a
//     list of jobs to do.
//   - It is not a bill, payment, customer, or staff
//     change. Writing a diary entry never changes any
//     bill, payment, customer, or staff record by itself.
//   - It is not an editable record. A past entry is never
//     silently edited: there is no edit function, only
//     record, find, and remove; a wrong entry is removed
//     and recorded again.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies
//     every entry, and the module never reads storage,
//     the clock, or the network, and never mutates an
//     input.
//   - An entry with no id, no strict date, no line in
//     plain words, or no entered-by name is refused
//     outright, as is any line with no words. Unknown
//     fields are dropped, so an entry can never grow a
//     bill, payment, customer, or staff field.
//   - One entry per date: a second entry for a date that
//     already has one is never written over the first;
//     the first entry for that date stays.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validShopDiaryDay(value) {
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
 * One diary line in plain words, or null when it has no
 * words. Unknown fields cannot ride along: a line is a
 * plain string only, and the input is never mutated.
 */
export function normalizeShopDiaryEntryLine(raw) {
  const line = text(raw);
  return line || null;
}

/**
 * One daily diary entry, or null when half-formed. An entry
 * needs an id, a strict date, at least one line in plain
 * words, and an entered-by name. Unknown fields are
 * dropped; the input is never mutated.
 */
export function normalizeShopDiaryEntry(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const date = text(raw.date);
  const enteredBy = text(raw.enteredBy);
  if (!id) return null;
  if (!validShopDiaryDay(date)) return null;
  if (!enteredBy) return null;
  if (!Array.isArray(raw.entries) || raw.entries.length === 0) return null;
  const entries = raw.entries.map((line) => normalizeShopDiaryEntryLine(line));
  if (entries.some((line) => line === null)) return null;
  return { id, date, entries, enteredBy };
}

/** Normalised diary entries only; a duplicate id is never rewritten, the first stays. */
export function normalizeShopDiaryEntryList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizeShopDiaryEntry(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function findShopDiaryEntry(list, id) {
  const clean = normalizeShopDiaryEntryList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((entry) => entry.id === wanted) ?? null;
}

/** The diary entry for one date, or null when that day has none. */
export function findShopDiaryEntryByDate(list, date) {
  const clean = normalizeShopDiaryEntryList(list);
  const wanted = text(date);
  if (!wanted) return null;
  return clean.find((entry) => entry.date === wanted) ?? null;
}

/**
 * Record a daily diary entry. Refused when half-formed, when
 * its id is already recorded, or when its date already has
 * an entry — the first entry for a date always stays.
 */
export function recordShopDiaryEntry(list, raw) {
  const clean = normalizeShopDiaryEntryList(list);
  const entry = normalizeShopDiaryEntry(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  if (clean.some((item) => item.date === entry.date)) return clean;
  return [...clean, entry];
}

export function removeShopDiaryEntry(list, id) {
  const clean = normalizeShopDiaryEntryList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((entry) => entry.id !== wanted);
}

/** Diary entries by date, newest first, then id, so the same list always reads the same way. */
export function shopDiaryEntriesSorted(list) {
  const clean = normalizeShopDiaryEntryList(list);
  return [...clean].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Diary entries for one person, newest first; the person match is case-insensitive. */
export function shopDiaryEntriesForPerson(list, person) {
  const wanted = text(person).toLowerCase();
  if (!wanted) return [];
  return shopDiaryEntriesSorted(list).filter(
    (entry) => entry.enteredBy.toLowerCase() === wanted,
  );
}

/**
 * People who entered diary entries, in A-Z order, keeping
 * the first spelling seen, so "Saad" and "saad" never list
 * as two people.
 */
export function shopDiaryEnteredByPeople(list) {
  const clean = normalizeShopDiaryEntryList(list);
  const byLower = new Map();
  for (const entry of clean) {
    const key = entry.enteredBy.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, entry.enteredBy);
  }
  return [...byLower.values()].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
}

/** Plain-words summary: the count, the dates covered, and the latest day. */
export function shopDiarySummaryText(list) {
  const clean = normalizeShopDiaryEntryList(list);
  if (!clean.length) return 'No daily shop diary entries recorded.';
  const sorted = shopDiaryEntriesSorted(clean);
  const countWord = clean.length === 1 ? '1 diary entry' : `${clean.length} diary entries`;
  const latest = sorted[0];
  const earliest = sorted[sorted.length - 1];
  const span = clean.length === 1
    ? `for ${latest.date}`
    : `from ${earliest.date} to ${latest.date}`;
  return `${countWord} ${span}. Latest day: ${latest.date}, entered by ${latest.enteredBy}.`;
}

/** One line naming a diary entry, with its lines, for lists and messages. */
export function shopDiaryEntryText(entry) {
  const clean = normalizeShopDiaryEntry(entry);
  if (!clean) return '';
  return `${clean.date} — entered by ${clean.enteredBy}: ${clean.entries.join('; ')}.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function shopDiaryEntryHtml(entry) {
  const clean = normalizeShopDiaryEntry(entry);
  if (!clean) return '';
  return `<li>${escapeHtml(shopDiaryEntryText(clean))}</li>`;
}

export function shopDiaryAllHtml(list) {
  const sorted = shopDiaryEntriesSorted(list);
  if (!sorted.length) return '<p>No daily shop diary entries recorded.</p>';
  return `<ul>${sorted.map((entry) => shopDiaryEntryHtml(entry)).join('')}</ul>`;
}

export function shopDiaryEntriesForPersonHtml(list, person) {
  const entries = shopDiaryEntriesForPerson(list, person);
  if (!entries.length) return '<p>No diary entries by that person.</p>';
  return `<ul>${entries.map((entry) => shopDiaryEntryHtml(entry)).join('')}</ul>`;
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function shopDiaryCsv(list) {
  const sorted = shopDiaryEntriesSorted(list);
  const header = ['id', 'date', 'entries', 'enteredBy'].join(',');
  const rows = sorted.map((entry) => [entry.id, entry.date, entry.entries.join('; '), entry.enteredBy].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function shopDiaryFilename() {
  return 'shop-diary.csv';
}
