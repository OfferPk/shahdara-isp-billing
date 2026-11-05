// Plan 289 (Plan 203-350) — Price review worksheet.
//
// Package prices are reviewed in conversation, so the figures
// compared and the reasons discussed leave no record for the next
// review. This module adds only the missing piece: one worksheet
// per price review — the package, its current price, the figure
// it was compared against, a cost or margin note in plain words,
// the review date, who reviewed it, and a conclusion in plain
// words. A worksheet shows its inputs and its conclusion, so the
// owner can explain why a price moved instead of reconstructing
// a conversation months later.
//
// What this module is NOT, stated plainly:
//   - It is not a price change. Completing a worksheet never
//     changes any package price, bill, or customer record by
//     itself; a price change still goes through its own existing
//     flow, and this module holds no price-change function.
//   - It is not the price revision history. That history holds
//     the prices that actually changed; this module only holds
//     review worksheets, and the history is neither read nor
//     rewritten here.
//   - It is not the price-change notice draft. That draft is the
//     message sent to customers; this module only records the
//     review itself, and the draft is neither read nor rewritten
//     here.
//   - It is not a live record. A past worksheet is read-only:
//     there is no edit function, only record, find, and remove,
//     so a wrong worksheet is removed and recorded again.
//
// How the module keeps those fences:
//   - It is pure and import-free: the caller supplies every
//     worksheet, and the module never reads storage, the clock,
//     or the network, and never mutates an input.
//   - A worksheet with no id, no package, no whole-rupee current
//     price, no whole-rupee compared figure, no strict review
//     date, or no reviewer is refused outright. Unknown fields
//     are dropped, so a worksheet can never grow a price-change,
//     bill, payment, or customer field.
//   - A duplicate id is never rewritten.
//   - Prices are whole rupees only: a current price must be at
//     least one rupee, and a compared figure must be a whole
//     number of rupees, never a fraction and never negative.

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Strict calendar date: YYYY-MM-DD that really exists, or false. */
export function validPriceReviewDate(value) {
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

function wholeRupees(value) {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

/**
 * One price review worksheet, or null when half-formed. A worksheet
 * needs an id, a package, a whole-rupee current price of at least
 * one rupee, a whole-rupee compared figure, a strict review date,
 * and a reviewer. The cost or margin note and the conclusion are
 * plain words and optional; unknown fields are dropped and the
 * input is never mutated.
 */
export function normalizePriceReviewWorksheet(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = text(raw.id);
  const packageName = text(raw.package);
  const currentPrice = wholeRupees(raw.currentPrice);
  const comparedFigure = wholeRupees(raw.comparedFigure);
  const reviewDate = text(raw.reviewDate);
  const reviewer = text(raw.reviewer);
  if (!id || !packageName || !reviewer) return null;
  if (currentPrice === null || currentPrice < 1) return null;
  if (comparedFigure === null || comparedFigure < 0) return null;
  if (!validPriceReviewDate(reviewDate)) return null;
  return {
    id,
    package: packageName,
    currentPrice,
    comparedFigure,
    costNote: text(raw.costNote),
    reviewDate,
    reviewer,
    conclusion: text(raw.conclusion),
  };
}

/** Normalised worksheets only; a duplicate id is never rewritten, the first stays. */
export function normalizePriceReviewList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const entry = normalizePriceReviewWorksheet(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function findPriceReviewWorksheet(list, id) {
  const clean = normalizePriceReviewList(list);
  const wanted = text(id);
  if (!wanted) return null;
  return clean.find((entry) => entry.id === wanted) ?? null;
}

export function recordPriceReviewWorksheet(list, raw) {
  const clean = normalizePriceReviewList(list);
  const entry = normalizePriceReviewWorksheet(raw);
  if (!entry) return clean;
  if (clean.some((item) => item.id === entry.id)) return clean;
  return [...clean, entry];
}

export function removePriceReviewWorksheet(list, id) {
  const clean = normalizePriceReviewList(list);
  const wanted = text(id);
  if (!wanted) return clean;
  return clean.filter((entry) => entry.id !== wanted);
}

/** Worksheets in review-date order, then package, then id, so the same list always reads the same way. */
export function priceReviewSorted(list) {
  const clean = normalizePriceReviewList(list);
  return [...clean].sort((a, b) => {
    if (a.reviewDate !== b.reviewDate) return a.reviewDate < b.reviewDate ? -1 : 1;
    const aPackage = a.package.toLowerCase();
    const bPackage = b.package.toLowerCase();
    if (aPackage !== bPackage) return aPackage < bPackage ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * How the compared figure stands against the current price:
 * 'above' when it is higher, 'below' when it is lower, 'same'
 * when it matches — plain words, never a computed score.
 */
export function priceReviewComparison(entry) {
  const clean = normalizePriceReviewWorksheet(entry);
  if (!clean) return null;
  if (clean.comparedFigure > clean.currentPrice) return 'above';
  if (clean.comparedFigure < clean.currentPrice) return 'below';
  return 'same';
}

/** Worksheets for one package, case-insensitive, in review-date order. */
export function priceReviewsForPackage(list, packageName) {
  const wanted = text(packageName).toLowerCase();
  if (!wanted) return [];
  return priceReviewSorted(list).filter((entry) => entry.package.toLowerCase() === wanted);
}

/** Package names in first-seen order, keeping the first spelling. */
export function priceReviewPackages(list) {
  const clean = normalizePriceReviewList(list);
  const seen = new Map();
  for (const entry of clean) {
    const key = entry.package.toLowerCase();
    if (!seen.has(key)) seen.set(key, entry.package);
  }
  return [...seen.values()];
}

export function priceReviewSummaryText(list) {
  const clean = normalizePriceReviewList(list);
  if (clean.length === 0) return 'No price review worksheets recorded.';
  const word = clean.length === 1 ? 'worksheet' : 'worksheets';
  const latest = priceReviewSorted(clean).at(-1);
  return `${clean.length} price review ${word} recorded. Latest review: ${latest.package} on ${latest.reviewDate}.`;
}

/** Plain-words text for one worksheet: its inputs and its conclusion. */
export function priceReviewText(entry) {
  const clean = normalizePriceReviewWorksheet(entry);
  if (!clean) return 'No price review worksheet recorded.';
  const comparison = priceReviewComparison(clean);
  const compared =
    comparison === 'above'
      ? 'compared figure is above the current price'
      : comparison === 'below'
        ? 'compared figure is below the current price'
        : 'compared figure matches the current price';
  const costNote = clean.costNote ? ` — cost or margin: ${clean.costNote}` : ' — cost or margin: not noted';
  const conclusion = clean.conclusion ? ` — conclusion: ${clean.conclusion}` : ' — conclusion: not recorded yet';
  return `${clean.package} — current price Rs ${clean.currentPrice}, compared figure Rs ${clean.comparedFigure} — ${compared}${costNote} — reviewed ${clean.reviewDate} by ${clean.reviewer}${conclusion}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function priceReviewHtml(entry) {
  const clean = normalizePriceReviewWorksheet(entry);
  if (!clean) return '<p>No price review worksheet recorded.</p>';
  return `<p>${escapeHtml(priceReviewText(clean))}</p>`;
}

export function priceReviewAllHtml(list) {
  const rows = priceReviewSorted(list);
  if (!rows.length) return '<p>No price review worksheets recorded.</p>';
  return `<ul>${rows.map((entry) => `<li>${escapeHtml(priceReviewText(entry))}</li>`).join('')}</ul>`;
}

export function priceReviewsForPackageHtml(list, packageName) {
  const rows = priceReviewsForPackage(list, packageName);
  if (!rows.length) return '<p>No price review worksheets for this package.</p>';
  return `<ul>${rows.map((entry) => `<li>${escapeHtml(priceReviewText(entry))}</li>`).join('')}</ul>`;
}

function csvCell(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function priceReviewCsv(list) {
  const rows = priceReviewSorted(list);
  const lines = ['"id","package","current price","compared figure","comparison","cost or margin note","review date","reviewer","conclusion"'];
  for (const entry of rows) {
    lines.push([
      csvCell(entry.id),
      csvCell(entry.package),
      csvCell(entry.currentPrice),
      csvCell(entry.comparedFigure),
      csvCell(priceReviewComparison(entry)),
      csvCell(entry.costNote),
      csvCell(entry.reviewDate),
      csvCell(entry.reviewer),
      csvCell(entry.conclusion),
    ].join(','));
  }
  return lines.join('\n');
}

export function priceReviewFilename() {
  return 'price-reviews.csv';
}
