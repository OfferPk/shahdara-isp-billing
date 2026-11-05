// Plan 307 (Plan 203-350) — New-mohalla cost estimate sheet.
//
// Expanding into a new mohalla is discussed without figures, so
// the cost of cable, equipment, and labour is guessed at
// decision time. This module adds only the missing piece: one
// cost estimate sheet per candidate mohalla — the mohalla, the
// line items with estimated amounts, the total, the date, and
// the estimator — so each sheet shows its line items and a
// total that sums exactly to them.
//
// What this module is NOT, stated plainly:
//   - It is not the new-mohalla expansion readiness checklist
//     (Plan 29), which checks readiness steps for a launch.
//     That checklist already exists and is neither read nor
//     rewritten here; this module estimates cost only and
//     never says a mohalla is ready.
//   - It is not the growth milestone tracker (Plan 191),
//     which tracks milestones toward growth. That tracker
//     already exists and is neither read nor rewritten here;
//     an estimate is a cost sheet, not a milestone.
//   - It is not the replacement reserve tracker (Plan 197),
//     which is for replacing ageing equipment. That tracker
//     already exists and is neither read nor rewritten here;
//     new-mohalla cost and equipment replacement stay
//     separate.
//   - It is not a bill, payment, or customer change.
//     Completing a sheet never changes any bill, payment,
//     or customer record by itself, and no expansion is
//     triggered by the sheet: the sheet only puts figures
//     on paper before a decision is made.
//   - It is not a live record. A sheet, once written, is
//     never silently edited: there is no edit function,
//     only record, find, and remove; a wrong sheet is
//     removed and recorded again.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     sheet, and the module never reads storage, the clock,
//     or the network, and never mutates an input.
//   - A sheet with no id, no mohalla, no strict date, no
//     estimator in plain words, or no line item is refused
//     outright, as is any line item with no label or no
//     whole-rupee amount of at least one rupee. Unknown
//     fields are dropped, so a sheet can never grow a bill,
//     payment, or customer field.
//   - The total is always computed from the line items by
//     integer arithmetic only, so it can never drift from
//     them: the operator enters the items, never the total.
//   - A duplicate id is never rewritten: the first sheet
//     stays.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validMohallaCostEstimateDay(value) {
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
 * One estimate line item, or null when half-formed. An item
 * needs a label in plain words and a whole-rupee amount of
 * at least one rupee. Unknown fields are dropped; the input
 * is never mutated.
 */
export function normalizeMohallaCostEstimateItem(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const label = text(raw.label);
  const amount = wholeRupees(raw.amount);
  if (!label) return null;
  if (amount === null || amount < 1) return null;
  return { label, amount };
}

/**
 * One cost estimate sheet, or null when half-formed. A sheet
 * needs an id, a mohalla, a strict date, an estimator in plain
 * words, and at least one line item. Unknown fields are
 * dropped; the input is never mutated.
 */
export function normalizeMohallaCostEstimateSheet(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const mohalla = text(raw.mohalla);
  const date = text(raw.date);
  const estimator = text(raw.estimator);
  if (!id) return null;
  if (!mohalla) return null;
  if (!validMohallaCostEstimateDay(date)) return null;
  if (!estimator) return null;
  if (!Array.isArray(raw.items) || raw.items.length === 0) return null;
  const items = raw.items.map((item) => normalizeMohallaCostEstimateItem(item));
  if (items.some((item) => item === null)) return null;
  return { id, mohalla, date, estimator, items };
}

/** Normalised estimate sheets only; a duplicate id is never rewritten, the first stays. */
export function normalizeMohallaCostEstimateList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const sheet = normalizeMohallaCostEstimateSheet(raw);
    if (!sheet || seen.has(sheet.id)) continue;
    seen.add(sheet.id);
    out.push(sheet);
  }
  return out;
}

export function findMohallaCostEstimateSheet(list, id) {
  const clean = normalizeMohallaCostEstimateList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((sheet) => sheet.id === wanted) ?? null;
}

/**
 * Record an estimate sheet. Refused when half-formed or when
 * its id is already recorded — the first sheet for an id
 * always stays.
 */
export function recordMohallaCostEstimateSheet(list, raw) {
  const clean = normalizeMohallaCostEstimateList(list);
  const sheet = normalizeMohallaCostEstimateSheet(raw);
  if (!sheet) return clean;
  if (clean.some((item) => item.id === sheet.id)) return clean;
  return [...clean, sheet];
}

export function removeMohallaCostEstimateSheet(list, id) {
  const clean = normalizeMohallaCostEstimateList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((sheet) => sheet.id !== wanted);
}

/** The total of one sheet: the sum of its line items, by integer arithmetic only. */
export function mohallaCostEstimateSheetTotal(sheet) {
  const clean = normalizeMohallaCostEstimateSheet(sheet);
  if (!clean) return null;
  return clean.items.reduce((sum, item) => sum + item.amount, 0);
}

/** Estimate sheets by date, then mohalla, then id, so the same list always reads the same way. */
export function mohallaCostEstimateSorted(list) {
  const clean = normalizeMohallaCostEstimateList(list);
  return [...clean].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.mohalla.toLowerCase() !== b.mohalla.toLowerCase()) return a.mohalla.toLowerCase() < b.mohalla.toLowerCase() ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Estimate sheets for one mohalla, in date order; the mohalla match is case-insensitive. */
export function mohallaCostEstimatesForMohalla(list, mohalla) {
  const wanted = text(mohalla).toLowerCase();
  if (!wanted) return [];
  return mohallaCostEstimateSorted(list).filter((sheet) => sheet.mohalla.toLowerCase() === wanted);
}

/**
 * Mohallas in A-Z order, keeping the first spelling seen, so
 * "Mohalla A" and "mohalla a" never list as two mohallas.
 */
export function mohallaCostEstimateMohallas(list) {
  const clean = normalizeMohallaCostEstimateList(list);
  const byLower = new Map();
  for (const sheet of clean) {
    const key = sheet.mohalla.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, sheet.mohalla);
  }
  return [...byLower.values()].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
}

/** The total estimated across all sheets, by integer arithmetic only. */
export function mohallaCostEstimateTotalEstimated(list) {
  return normalizeMohallaCostEstimateList(list).reduce(
    (sum, sheet) => sum + mohallaCostEstimateSheetTotal(sheet),
    0,
  );
}

/** Plain-words summary: the count, the total estimated, and the latest sheet with its total. */
export function mohallaCostEstimateSummaryText(list) {
  const clean = normalizeMohallaCostEstimateList(list);
  if (!clean.length) return 'No mohalla cost estimate sheets recorded.';
  const sorted = mohallaCostEstimateSorted(clean);
  const total = mohallaCostEstimateTotalEstimated(clean);
  const latest = sorted[sorted.length - 1];
  const countWord = clean.length === 1 ? '1 estimate sheet' : `${clean.length} estimate sheets`;
  return `${countWord}, Rs ${total} estimated in total. Latest: ${latest.mohalla} on ${latest.date}, Rs ${mohallaCostEstimateSheetTotal(latest)}.`;
}

/** One line naming a sheet, for lists and messages. */
export function mohallaCostEstimateEntryText(sheet) {
  const clean = normalizeMohallaCostEstimateSheet(sheet);
  if (!clean) return '';
  const items = clean.items.map((item) => `${item.label} Rs ${item.amount}`).join('; ');
  return `${clean.date} — ${clean.mohalla} estimate by ${clean.estimator}: ${items} — total Rs ${mohallaCostEstimateSheetTotal(clean)}.`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function mohallaCostEstimateEntryHtml(sheet) {
  const clean = normalizeMohallaCostEstimateSheet(sheet);
  if (!clean) return '';
  return `<li>${escapeHtml(mohallaCostEstimateEntryText(clean))}</li>`;
}

export function mohallaCostEstimateAllHtml(list) {
  const sorted = mohallaCostEstimateSorted(list);
  if (!sorted.length) return '<p>No mohalla cost estimate sheets recorded.</p>';
  return `<ul>${sorted.map((sheet) => mohallaCostEstimateEntryHtml(sheet)).join('')}</ul>`;
}

export function mohallaCostEstimatesForMohallaHtml(list, mohalla) {
  const sheets = mohallaCostEstimatesForMohalla(list, mohalla);
  if (!sheets.length) return '<p>No cost estimate sheets for that mohalla.</p>';
  return `<ul>${sheets.map((sheet) => mohallaCostEstimateEntryHtml(sheet)).join('')}</ul>`;
}

function csvCell(value) {
  const cell = String(value ?? '');
  return /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function mohallaCostEstimateCsv(list) {
  const sorted = mohallaCostEstimateSorted(list);
  const header = ['id', 'date', 'mohalla', 'estimator', 'items', 'total'].join(',');
  const rows = sorted.map((sheet) => {
    const items = sheet.items.map((item) => `${item.label}:${item.amount}`).join('; ');
    return [sheet.id, sheet.date, sheet.mohalla, sheet.estimator, items, mohallaCostEstimateSheetTotal(sheet)].map(csvCell).join(',');
  });
  return [header, ...rows].join('\n');
}

export function mohallaCostEstimateFilename() {
  return 'mohalla-cost-estimates.csv';
}
