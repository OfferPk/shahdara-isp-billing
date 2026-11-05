// Plan 294 (Plan 203-350) — Cash safe count log.
//
// Cash kept in the shop safe is counted informally, so a
// shortage is discovered late and nobody can say when it
// appeared. This module adds only the missing piece: one
// dated count of the shop safe — the date, who counted it,
// the amount counted, the amount expected, and a variance
// note in plain words — so Saad and the owner share one
// checkable figure.
//
// What this module is NOT, stated plainly:
//   - It is not a bill, payment, or ledger change. Logging
//     a count never changes any bill, payment, or ledger
//     total by itself; it only records what was in the safe
//     on that date.
//   - It is not the denomination handover count, the petty
//     cash log, the cash-in-hand limit, or the collector
//     settlement statement. Each of those records already
//     exists and is neither read nor rewritten here; this
//     module only covers the shop safe count.
//   - It is not a live record. A count entry, once written,
//     is never silently edited: there is no edit function,
//     only record, find, and remove, so a wrong count is
//     removed and recorded again.
//   - A variance is never left unexplained: when the counted
//     amount differs from the expected amount, the count is
//     refused unless a variance note in plain words says why.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     count, and the module never reads storage, the clock,
//     or the network, and never mutates an input.
//   - A count with no id, no strict date, no counter, or
//     no whole-rupee counted or expected amount is refused
//     outright. Unknown fields are dropped, so a count can
//     never grow a bill, payment, or ledger field.
//   - A duplicate id is never rewritten: the first count stays.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validSafeCountDate(value) {
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
 * One shop safe count, or null when half-formed. A count needs
 * an id, a strict date, a counter, a whole-rupee counted amount
 * of zero or more, and a whole-rupee expected amount of zero or
 * more. When the counted amount differs from the expected
 * amount, a variance note in plain words is required. Unknown
 * fields are dropped; the input is never mutated.
 */
export function normalizeSafeCount(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const date = text(raw.date);
  const countedBy = text(raw.countedBy);
  const countedAmount = wholeRupees(raw.countedAmount);
  const expectedAmount = wholeRupees(raw.expectedAmount);
  const varianceNote = text(raw.varianceNote);
  if (!id) return null;
  if (!validSafeCountDate(date)) return null;
  if (!countedBy) return null;
  if (countedAmount === null || countedAmount < 0) return null;
  if (expectedAmount === null || expectedAmount < 0) return null;
  if (countedAmount !== expectedAmount && !varianceNote) return null;
  return {
    id,
    date,
    countedBy,
    countedAmount,
    expectedAmount,
    varianceNote,
  };
}

/** Normalised counts only; a duplicate id is never rewritten, the first stays. */
export function normalizeSafeCountList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const count = normalizeSafeCount(raw);
    if (!count || seen.has(count.id)) continue;
    seen.add(count.id);
    out.push(count);
  }
  return out;
}

export function findSafeCount(list, id) {
  const clean = normalizeSafeCountList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((count) => count.id === wanted) ?? null;
}

/**
 * Record a count. Refused when half-formed or when its id is
 * already recorded — the first count for an id always stays.
 */
export function recordSafeCount(list, raw) {
  const clean = normalizeSafeCountList(list);
  const count = normalizeSafeCount(raw);
  if (!count) return clean;
  if (clean.some((item) => item.id === count.id)) return clean;
  return [...clean, count];
}

export function removeSafeCount(list, id) {
  const clean = normalizeSafeCountList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((count) => count.id !== wanted);
}

/** Counted minus expected, in whole rupees: negative when short, positive when over. */
export function safeCountVariance(count) {
  const clean = normalizeSafeCount(count);
  if (!clean) return null;
  return clean.countedAmount - clean.expectedAmount;
}

/** Plain-words variance: 'exact', 'short', or 'over'. */
export function safeCountVarianceWord(count) {
  const variance = safeCountVariance(count);
  if (variance === null) return '';
  if (variance === 0) return 'exact';
  return variance < 0 ? 'short' : 'over';
}

/** Counts by date, then id, so the same list always reads the same way. */
export function safeCountSorted(list) {
  const clean = normalizeSafeCountList(list);
  return [...clean].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** The newest safe count, or null when none is recorded. */
export function safeCountLatest(list) {
  const sorted = safeCountSorted(list);
  return sorted.length ? sorted[sorted.length - 1] : null;
}

/** Counts whose variance is not zero, in date order. */
export function safeCountVariances(list) {
  return safeCountSorted(list).filter((count) => count.countedAmount !== count.expectedAmount);
}

export function safeCountSummaryText(list) {
  const clean = normalizeSafeCountList(list);
  if (clean.length === 0) return 'No safe counts recorded.';
  const word = clean.length === 1 ? 'count' : 'counts';
  const latest = safeCountLatest(clean);
  const variance = safeCountVariance(latest);
  const varianceWord = safeCountVarianceWord(latest);
  const varianceText = variance === 0
    ? 'exact'
    : `${varianceWord} by Rs ${Math.abs(variance)}`;
  return `${clean.length} safe ${word} recorded. Latest count on ${latest.date}: counted Rs ${latest.countedAmount} against Rs ${latest.expectedAmount} expected, ${varianceText}.`;
}

/** Plain-words text for one count: counted versus expected, with any variance explained. */
export function safeCountEntryText(count) {
  const clean = normalizeSafeCount(count);
  if (!clean) return 'No safe count recorded.';
  const variance = clean.countedAmount - clean.expectedAmount;
  const varianceWord = safeCountVarianceWord(clean);
  const varianceText = variance === 0
    ? 'exact'
    : `${varianceWord} by Rs ${Math.abs(variance)}`;
  const note = clean.varianceNote ? ` — Variance: ${clean.varianceNote}` : '';
  return `${clean.date} — counted Rs ${clean.countedAmount}, expected Rs ${clean.expectedAmount}, ${varianceText}. Counted by ${clean.countedBy}${note}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function safeCountEntryHtml(count) {
  const clean = normalizeSafeCount(count);
  if (!clean) return '<p>No safe count recorded.</p>';
  return `<p>${escapeHtml(safeCountEntryText(clean))}</p>`;
}

export function safeCountAllHtml(list) {
  const rows = safeCountSorted(list);
  if (!rows.length) return '<p>No safe counts recorded.</p>';
  return `<ul>${rows.map((count) => `<li>${escapeHtml(safeCountEntryText(count))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function safeCountCsv(list) {
  const rows = safeCountSorted(list);
  const lines = ['"id","date","counted by","counted amount","expected amount","variance","variance note"'];
  for (const count of rows) {
    lines.push([
      csvCell(count.id),
      csvCell(count.date),
      csvCell(count.countedBy),
      csvCell(count.countedAmount),
      csvCell(count.expectedAmount),
      csvCell(count.countedAmount - count.expectedAmount),
      csvCell(count.varianceNote),
    ].join(','));
  }
  return lines.join('\n');
}

export function safeCountFilename() {
  return 'safe-counts.csv';
}
