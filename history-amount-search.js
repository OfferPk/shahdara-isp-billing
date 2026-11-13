// History search by exact amount (Plan 405): a customer remembers
// the amount they paid — "Rs 2,000" — but not the date, and the
// history offers no way to search by amount. One amount search on
// the customer history — an exact whole-rupee amount, listing every
// transaction of that amount with dates. It searches only and changes
// nothing: it reads the entries the full history list already
// composed and returns the ones whose listed amount is exactly the
// searched amount, in the same date order, with the running balance
// each entry already carries. It sits alongside the type filter, the
// date-range filter and the method filter on the same list; no
// filter changes another's behaviour, and the typed amount lives
// only while the profile is open. No store: the search is a view
// over existing entries. Pure and import-free: no storage, no DOM,
// no network, no other module. Inputs are never mutated.
//
// The receipt-number search already exists and is left alone; it
// finds one transaction by its receipt number, while this search
// lists every transaction of one amount. An amount with paisa
// (PKR 1,500.5) is never exactly a whole-rupee amount, so it never
// matches a whole-rupee search.

export const HISTORY_AMOUNT_SEARCH_EMPTY_TEXT = 'No transactions of this amount';

const HISTORY_AMOUNT_TYPE_LABELS = Object.freeze({
  charge: 'Charge',
  payment: 'Payment',
  advance: 'Advance',
  credit: 'Credit',
  refund: 'Refund',
  adjustment: 'Adjustment',
  info: 'Info',
});

const HISTORY_AMOUNT_METHOD_LABELS = Object.freeze({
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  mobile_wallet: 'Mobile wallet',
  other: 'Other',
});

const AMOUNT_SEARCH_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapAmountSearchYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isStrictAmountSearchDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const lastDay = month === 2 && isLeapAmountSearchYear(year) ? 29 : AMOUNT_SEARCH_DAYS_IN_MONTH[month - 1];
  return day <= lastDay;
}

function normalizeAmountSearchDateRange(from, to) {
  return {
    from: isStrictAmountSearchDate(from) ? from : '',
    to: isStrictAmountSearchDate(to) ? to : '',
  };
}

/**
 * Normalize a typed amount to whole rupees, or null when there is
 * no search. Digits with commas and spaces fold away, and a leading
 * "Rs" or "PKR" is tolerated, so "Rs 2,000", "2000" and " 2000 "
 * all read as 2000. Anything else — empty, missing, a boolean, a
 * zero or negative amount, a fraction, or letters — reads as no
 * search, so a damaged search never drops entries from the list.
 * A null, undefined, empty or boolean figure is "not a number",
 * never zero.
 */
export function normalizeHistoryAmountSearch(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) return null;
    return value;
  }
  if (typeof value !== 'string') return null;
  let text = value.trim().toLowerCase();
  if (text === '') return null;
  text = text.replace(/^(rs\.?|pkr)\s*/, '');
  text = text.replace(/[,\s]/g, '');
  if (!/^\d+$/.test(text)) return null;
  const rupees = Number(text);
  if (!Number.isSafeInteger(rupees) || rupees <= 0) return null;
  return rupees;
}

/** True when a valid whole-rupee amount is searched for. */
export function historyAmountSearchActive(value) {
  return normalizeHistoryAmountSearch(value) !== null;
}

/**
 * Search full-history entries by exact amount. With no valid
 * amount every entry is kept, in the same order; with an amount,
 * exactly the entries whose listed amount equals that amount are
 * kept, in the same order, each with the running balance it already
 * carries. The input list and its entries are never mutated — the
 * result is a new array.
 */
export function searchHistoryEntriesByAmount(entries, amount) {
  const list = Array.isArray(entries) ? entries : [];
  const rupees = normalizeHistoryAmountSearch(amount);
  if (rupees === null) return [...list];
  const cents = rupees * 100;
  return list.filter((entry) => Number(entry?.amountCents) === cents);
}

/**
 * Subtotal of the shown entries: the sum of their listed amounts.
 * Each entry carries its listed amount, so the subtotal always
 * matches exactly the entries shown.
 */
export function historyAmountSearchSubtotalCents(entries) {
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
export function formatAmountSearchAmount(cents) {
  const amount = Number(cents);
  if (!Number.isFinite(amount)) return 'PKR 0';
  const sign = amount < 0 ? '-' : '';
  const text = (Math.abs(amount) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${sign}PKR ${text}`;
}

function escapeAmountSearchHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The amount search markup: a label, a text input holding the
 * searched amount, and a Clear button. The input keeps the
 * normalized amount, so a damaged search shows empty rather than
 * the damaged text.
 */
export function historyAmountSearchMarkup(amount) {
  const rupees = normalizeHistoryAmountSearch(amount);
  const value = rupees === null ? '' : String(rupees);
  return `<label class="field-label" for="amtHistoryAmountSearch">Amount</label><input id="amtHistoryAmountSearch" class="amt-search" type="text" inputmode="numeric" autocomplete="off" placeholder="e.g. 2000" value="${escapeAmountSearchHtml(value)}"><button type="button" id="amtHistoryAmountSearchClear" class="amt-clear">Clear</button>`;
}

/**
 * Empty-list line: 'No transactions of PKR 2,000' for one amount.
 * With no amount searched it returns '' so the caller keeps
 * whatever empty line the other filters already show.
 */
export function historyAmountSearchEmptyText(amount) {
  const rupees = normalizeHistoryAmountSearch(amount);
  if (rupees === null) return '';
  return `No transactions of ${formatAmountSearchAmount(rupees * 100)}`;
}

/**
 * Summary line for the shown list while an amount is searched:
 * '2 of 10 entries · PKR 2,000 only · Subtotal PKR 4,000', with
 * the date span added when a range is active too ('in
 * 2026-09-01 – 2026-09-30', 'from 2026-09-01' or 'up to
 * 2026-09-30'), ' · Refund only' when a type is chosen too, and
 * ' · Mobile wallet only' when a method is chosen too. With no
 * amount searched it returns '' so the caller keeps the summary
 * the other filters already show.
 */
export function historyAmountSearchSummaryText(shown, entries, amount, from, to, type, method) {
  const rupees = normalizeHistoryAmountSearch(amount);
  if (rupees === null) return '';
  const shownList = Array.isArray(shown) ? shown : [];
  const fullList = Array.isArray(entries) ? entries : [];
  const count = shownList.length === 1
    ? `1 entry of ${fullList.length}`
    : `${shownList.length} of ${fullList.length} entries`;
  const range = normalizeAmountSearchDateRange(from, to);
  const span = range.from !== '' && range.to !== ''
    ? ` in ${range.from} – ${range.to}`
    : range.from !== ''
      ? ` from ${range.from}`
      : range.to !== ''
        ? ` up to ${range.to}`
        : '';
  const foldedType = typeof type === 'string' ? type.trim().toLowerCase() : '';
  const typePart = foldedType !== '' && foldedType !== 'all' && HISTORY_AMOUNT_TYPE_LABELS[foldedType]
    ? ` · ${HISTORY_AMOUNT_TYPE_LABELS[foldedType]} only`
    : '';
  const foldedMethod = typeof method === 'string' ? method.trim().toLowerCase() : '';
  const methodPart = foldedMethod !== '' && foldedMethod !== 'all' && HISTORY_AMOUNT_METHOD_LABELS[foldedMethod]
    ? ` · ${HISTORY_AMOUNT_METHOD_LABELS[foldedMethod]} only`
    : '';
  const subtotal = formatAmountSearchAmount(historyAmountSearchSubtotalCents(shownList));
  return `${count} · ${formatAmountSearchAmount(rupees * 100)} only${span}${typePart}${methodPart} · Subtotal ${subtotal}`;
}
