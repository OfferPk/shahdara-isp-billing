// History filter by date range (Plan 403): a customer asks about
// "last three months" and the operator must scroll a years-long
// history to find it. One date-range filter on the customer history
// — a from date and a to date, both strict dates — showing only the
// transactions dated in that range, with a subtotal. It filters only
// and changes nothing: it reads the entries the full history list
// already composed and returns the ones dated in the range, in the
// same order, with the running balance each entry already carries.
// It sits alongside the type filter on the same list; neither filter
// changes the other's behaviour, and both choices live only while
// the profile is open. No store: the filter is a view over existing
// entries. Pure and import-free: no storage, no DOM, no network, no
// other module. Inputs are never mutated.
//
// Date rules, pinned by the tests below: a bound that is not a
// strict YYYY-MM-DD date reads as no bound, so a damaged choice
// never drops entries; a month-only entry date (YYYY-MM) counts as
// the first of that month, the same rule the list already uses for
// ordering; an entry with no date at all cannot fall in any range
// and is left out while a bound is set, but stays when no bound is
// set; a from date after the to date matches nothing, and the empty
// line says so plainly. The subtotal is the sum of the listed
// amounts of the shown entries.

export const HISTORY_DATE_RANGE_EMPTY_TEXT = 'No transactions in this date range';

const HISTORY_DATE_RANGE_TYPE_LABELS = Object.freeze({
  charge: 'Charge',
  payment: 'Payment',
  advance: 'Advance',
  credit: 'Credit',
  refund: 'Refund',
  adjustment: 'Adjustment',
});

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapRangeYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** True for a strict YYYY-MM-DD calendar date, leap years included. */
export function isStrictRangeDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const lastDay = month === 2 && isLeapRangeYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  return day <= lastDay;
}

function isStrictRangeMonth(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

/**
 * Normalize a date-range choice. Each bound stays itself when it is
 * a strict date and reads as blank otherwise, so a damaged bound
 * opens that side of the range instead of dropping entries.
 */
export function normalizeHistoryDateRange(from, to) {
  return {
    from: isStrictRangeDate(from) ? from : '',
    to: isStrictRangeDate(to) ? to : '',
  };
}

/** True when at least one bound of the range is set. */
export function historyDateRangeActive(from, to) {
  const range = normalizeHistoryDateRange(from, to);
  return range.from !== '' || range.to !== '';
}

// The comparable date for one entry: a strict date as-is, a
// month-only date as the first of that month (the same rule the
// list uses for ordering), and no date at all as blank.
function entryRangeDate(entry) {
  const date = entry?.date;
  if (isStrictRangeDate(date)) return date;
  if (isStrictRangeMonth(date)) return `${date}-01`;
  return '';
}

/**
 * Filter full-history entries by date range. With no bound set every
 * entry stays, in the same order; a set bound keeps only the entries
 * dated on or after the from date and on or before the to date. An
 * entry with no date cannot fall in any range, so it is left out
 * while a bound is set. The input list and its entries are never
 * mutated — the result is a new array.
 */
export function filterHistoryEntriesByDateRange(entries, from, to) {
  const list = Array.isArray(entries) ? entries : [];
  const range = normalizeHistoryDateRange(from, to);
  if (range.from === '' && range.to === '') return [...list];
  return list.filter((entry) => {
    const date = entryRangeDate(entry);
    if (date === '') return false;
    if (range.from !== '' && date < range.from) return false;
    if (range.to !== '' && date > range.to) return false;
    return true;
  });
}

/**
 * Subtotal of the shown entries: the sum of their listed amounts.
 * Each entry carries its listed amount, so the subtotal always
 * matches exactly the entries shown.
 */
export function historyDateRangeSubtotalCents(entries) {
  const list = Array.isArray(entries) ? entries : [];
  let total = 0;
  for (const entry of list) {
    const amount = Number(entry?.amountCents);
    if (Number.isFinite(amount)) total += Math.round(amount);
  }
  return total;
}

// Amounts print with no decimals for whole rupees (PKR 1,500) and
// one decimal for a paisa remainder (PKR 1,500.5), the same shape
// the entry-screen formatters use.
export function formatDateRangeAmount(cents) {
  const amount = Number(cents);
  if (!Number.isFinite(amount)) return 'PKR 0';
  const sign = amount < 0 ? '-' : '';
  const text = (Math.abs(amount) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${sign}PKR ${text}`;
}

function escapeHistoryDateRangeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The date-range filter markup: a from date input, a to date input
 * and a Clear button that empties both. The chosen dates are marked
 * in the inputs.
 */
export function historyDateRangeFilterMarkup(from, to) {
  const range = normalizeHistoryDateRange(from, to);
  return `<label class="field-label" for="hdrHistoryDateFrom">From</label><input type="date" id="hdrHistoryDateFrom" class="hdr-filter" value="${escapeHistoryDateRangeHtml(range.from)}"><label class="field-label" for="hdrHistoryDateTo">To</label><input type="date" id="hdrHistoryDateTo" class="hdr-filter" value="${escapeHistoryDateRangeHtml(range.to)}"><button id="hdrHistoryDateRangeClear" class="secondary-button" type="button">Clear dates</button>`;
}

/**
 * Empty-list line for an active range: 'No transactions in this
 * date range'. With no range active it returns '' so the caller
 * keeps whatever empty line the type filter already shows.
 */
export function historyDateRangeEmptyText(from, to) {
  if (!historyDateRangeActive(from, to)) return '';
  return HISTORY_DATE_RANGE_EMPTY_TEXT;
}

/**
 * Summary line for the shown list while a range is active:
 * '3 entries in 2026-09-01 – 2026-09-30 · Subtotal PKR 4,500',
 * with ' · Refund only' added when a type is chosen too, and
 * 'from 2026-09-01' or 'up to 2026-09-30' when only one bound is
 * set. With no range active it returns '' so the caller keeps the
 * summary the type filter already shows.
 */
export function historyDateRangeSummaryText(shown, from, to, type) {
  const range = normalizeHistoryDateRange(from, to);
  if (range.from === '' && range.to === '') return '';
  const shownList = Array.isArray(shown) ? shown : [];
  const count = shownList.length === 1 ? '1 entry' : `${shownList.length} entries`;
  const span = range.from !== '' && range.to !== ''
    ? `in ${range.from} – ${range.to}`
    : range.from !== ''
      ? `from ${range.from}`
      : `up to ${range.to}`;
  const foldedType = typeof type === 'string' ? type.trim().toLowerCase() : '';
  const typePart = foldedType !== '' && foldedType !== 'all' && HISTORY_DATE_RANGE_TYPE_LABELS[foldedType]
    ? ` · ${HISTORY_DATE_RANGE_TYPE_LABELS[foldedType]} only`
    : '';
  const subtotal = formatDateRangeAmount(historyDateRangeSubtotalCents(shownList));
  return `${count} ${span}${typePart} · Subtotal ${subtotal}`;
}
