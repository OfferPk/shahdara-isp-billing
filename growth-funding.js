// Plan 305 (Plan 203-350) — Growth funding note.
//
// Money set aside toward the second unit has no separate record,
// so it blends into general cash and the growth fund is spent
// without noticing. This module adds only the missing piece:
// one dated set-aside note per saving — the date, the amount set
// aside in whole rupees, the source in plain words, and the
// running set-aside total entered by the operator — so each
// set-aside and the running total are visible, and the notes
// reconcile on the same fixture.
//
// What this module is NOT, stated plainly:
//   - It is not the growth milestone tracker (Plan 191), which
//     tracks milestones toward growth. That tracker already
//     exists and is neither read nor rewritten here; this module
//     only records money set aside.
//   - It is not the replacement reserve tracker (Plan 197),
//     which is for replacing ageing equipment. That tracker
//     already exists and is neither read nor rewritten here;
//     growth savings and equipment replacement stay separate.
//   - It is not a bill, payment, or ledger change. Recording
//     a note never changes any bill, payment, or ledger total
//     by itself, and moving money still goes through its own
//     existing flow; this note only records that money was
//     set aside.
//   - It is not a live record. A note, once written, is never
//     silently edited: there is no edit function, only record,
//     find, and remove; a wrong note is removed and recorded
//     again.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     note, and the module never reads storage, the clock,
//     or the network, and never mutates an input.
//   - A note with no id, no strict date, no whole-rupee
//     amount of at least one rupee, no source in plain words,
//     or no whole-rupee running total is refused outright.
//     Unknown fields are dropped, so a note can never grow
//     a bill, payment, or ledger field.
//   - A duplicate id is never rewritten: the first note stays.
//   - The running total is entered by the operator, never
//     computed from live data — but the notes reconcile when
//     each entered running total equals the sum of the
//     set-aside amounts up to and including that note, in
//     date order.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validGrowthFundingDate(value) {
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

/** Whole rupees only: a number that is an integer, or a string of digits, or null. */
function wholeRupees(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

/**
 * One growth funding note, or null when half-formed. A note
 * needs an id, a strict date, a whole-rupee amount of at
 * least one rupee, a source in plain words, and a whole-rupee
 * running total of zero or more entered by the operator.
 * Unknown fields are dropped; the input is never mutated.
 */
export function normalizeGrowthFundingNote(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const date = text(raw.date);
  const amount = wholeRupees(raw.amount);
  const source = text(raw.source);
  const runningTotal = wholeRupees(raw.runningTotal);
  if (!id) return null;
  if (!validGrowthFundingDate(date)) return null;
  if (amount === null || amount < 1) return null;
  if (!source) return null;
  if (runningTotal === null || runningTotal < 0) return null;
  return {
    id,
    date,
    amount,
    source,
    runningTotal,
  };
}

/** Normalised funding notes only; a duplicate id is never rewritten, the first stays. */
export function normalizeGrowthFundingList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const note = normalizeGrowthFundingNote(raw);
    if (!note || seen.has(note.id)) continue;
    seen.add(note.id);
    out.push(note);
  }
  return out;
}

export function findGrowthFundingNote(list, id) {
  const clean = normalizeGrowthFundingList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((note) => note.id === wanted) ?? null;
}

/**
 * Record a funding note. Refused when half-formed or when its
 * id is already recorded — the first note for an id always stays.
 */
export function recordGrowthFundingNote(list, raw) {
  const clean = normalizeGrowthFundingList(list);
  const note = normalizeGrowthFundingNote(raw);
  if (!note) return clean;
  if (clean.some((item) => item.id === note.id)) return clean;
  return [...clean, note];
}

export function removeGrowthFundingNote(list, id) {
  const clean = normalizeGrowthFundingList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((note) => note.id !== wanted);
}

/** Funding notes by date, then source, then id, so the same list always reads the same way. */
export function growthFundingSorted(list) {
  const clean = normalizeGrowthFundingList(list);
  return [...clean].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.source.toLowerCase() !== b.source.toLowerCase()) return a.source.toLowerCase() < b.source.toLowerCase() ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Funding notes for one source, in date order; the source match is case-insensitive. */
export function growthFundingNotesForSource(list, source) {
  const wanted = text(source).toLowerCase();
  if (!wanted) return [];
  return growthFundingSorted(list).filter((note) => note.source.toLowerCase() === wanted);
}

/**
 * Sources in A-Z order, keeping the first spelling seen, so
 * "Shop cash" and "shop cash" never list as two sources.
 */
export function growthFundingSources(list) {
  const clean = normalizeGrowthFundingList(list);
  const byLower = new Map();
  for (const note of clean) {
    const key = note.source.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, note.source);
  }
  return [...byLower.values()].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
}

/** The total set aside across all notes, by integer arithmetic only. */
export function growthFundingTotalSetAside(list) {
  return normalizeGrowthFundingList(list).reduce((sum, note) => sum + note.amount, 0);
}

/**
 * The notes reconcile when every entered running total equals
 * the sum of the set-aside amounts up to and including that
 * note, in date order. A list with nothing to contradict
 * reconciles.
 */
export function growthFundingReconciles(list) {
  const sorted = growthFundingSorted(list);
  let running = 0;
  for (const note of sorted) {
    running += note.amount;
    if (note.runningTotal !== running) return false;
  }
  return true;
}

/** Plain-words summary: the count, the total set aside, the latest running total, and whether it reconciles. */
export function growthFundingSummaryText(list) {
  const clean = normalizeGrowthFundingList(list);
  if (!clean.length) return 'No growth funding notes recorded.';
  const sorted = growthFundingSorted(clean);
  const total = growthFundingTotalSetAside(clean);
  const latest = sorted[sorted.length - 1];
  const reconciles = growthFundingReconciles(clean);
  const countWord = clean.length === 1 ? '1 set-aside' : `${clean.length} set-asides`;
  const reconcileWord = reconciles
    ? 'the running total reconciles with the set-asides'
    : 'the running total does not reconcile with the set-asides — check the entered totals';
  return `${countWord}, Rs ${total} set aside in total. Latest running total Rs ${latest.runningTotal} on ${latest.date}; ${reconcileWord}.`;
}

/** One line naming a note, for lists and messages. */
export function growthFundingEntryText(note) {
  const clean = normalizeGrowthFundingNote(note);
  if (!clean) return '';
  return `${clean.date} — Rs ${clean.amount} set aside from ${clean.source}; running total Rs ${clean.runningTotal}.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function growthFundingEntryHtml(note) {
  const clean = normalizeGrowthFundingNote(note);
  if (!clean) return '';
  return `<li>${escapeHtml(growthFundingEntryText(clean))}</li>`;
}

export function growthFundingAllHtml(list) {
  const sorted = growthFundingSorted(list);
  if (!sorted.length) return '<p>No growth funding notes recorded.</p>';
  return `<ul>${sorted.map((note) => growthFundingEntryHtml(note)).join('')}</ul>`;
}

export function growthFundingNotesForSourceHtml(list, source) {
  const notes = growthFundingNotesForSource(list, source);
  if (!notes.length) return '<p>No growth funding notes from that source.</p>';
  return `<ul>${notes.map((note) => growthFundingEntryHtml(note)).join('')}</ul>`;
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function growthFundingCsv(list) {
  const sorted = growthFundingSorted(list);
  const header = ['id', 'date', 'amount', 'source', 'running_total'].join(',');
  const rows = sorted.map((note) => [note.id, note.date, note.amount, note.source, note.runningTotal].map(csvCell).join(','));
  return [header, ...rows].join('\n');
}

export function growthFundingFilename() {
  return 'growth-funding-notes.csv';
}
