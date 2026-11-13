// History filter by payment method (Plan 404): a customer who always
// pays by JazzCash cannot see just their wallet payments, because
// cash and transfers sit in the same list. One method filter on the
// customer history — cash, bank transfer, mobile wallet, other —
// showing only the transactions of that method, with a subtotal. It
// filters only and changes nothing: it reads the entries the full
// history list already composed and returns the ones paid by the
// chosen method, in the same order, with the running balance each
// entry already carries. It sits alongside the type filter and the
// date-range filter on the same list; no filter changes another's
// behaviour, and all three choices live only while the profile is
// open. No store: the filter is a view over existing entries. Pure
// and import-free: no storage, no DOM, no network, no other module.
// Inputs are never mutated.
//
// Method folding, pinned by the tests below: the fold follows the
// same grouping the per-method reconciliation view already uses —
// cash (Cash and every "Cash at … shop" variant), bank transfer
// (Bank Transfer, Raast), mobile wallet (JazzCash, Easypaisa,
// NayaPay). Anything else — an unrecognised method, or an entry
// with no method at all, such as a charge or a credit — reads as
// 'other', so the four options always partition the full list and
// every entry is reachable through exactly one option.

export const HISTORY_METHOD_FILTER_ALL = 'all';

export const HISTORY_METHOD_FILTER_METHODS = Object.freeze([
  'cash',
  'bank_transfer',
  'mobile_wallet',
  'other',
]);

export const HISTORY_METHOD_FILTER_LABELS = Object.freeze({
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  mobile_wallet: 'Mobile wallet',
  other: 'Other',
});

export const HISTORY_METHOD_FILTER_EMPTY_TEXT = 'No transactions yet';

const HISTORY_METHOD_TYPE_LABELS = Object.freeze({
  charge: 'Charge',
  payment: 'Payment',
  advance: 'Advance',
  credit: 'Credit',
  refund: 'Refund',
  adjustment: 'Adjustment',
  info: 'Info',
});

const METHOD_CASH_ALIASES = new Set(['cash']);
const METHOD_BANK_ALIASES = new Set(['bank transfer', 'banktransfer', 'bank_transfer', 'raast']);
const METHOD_WALLET_ALIASES = new Set([
  'jazzcash',
  'easypaisa',
  'nayapay',
  'mobile wallet',
  'mobilewallet',
  'mobile_wallet',
  'wallet',
]);

const METHOD_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapMethodYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isStrictMethodDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const lastDay = month === 2 && isLeapMethodYear(year) ? 29 : METHOD_DAYS_IN_MONTH[month - 1];
  return day <= lastDay;
}

function normalizeMethodDateRange(from, to) {
  return {
    from: isStrictMethodDate(from) ? from : '',
    to: isStrictMethodDate(to) ? to : '',
  };
}

function foldMethodLabel(value) {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/[\s-]+/g, ' ').trim() : '';
}

/**
 * The method group for one recorded method label. Cash (and every
 * "Cash at … shop" variant) reads as cash; Bank Transfer and Raast
 * read as bank transfer; JazzCash, Easypaisa, NayaPay and mobile
 * wallet read as mobile wallet. Anything else — an unrecognised
 * method, or no method at all — reads as other.
 */
export function historyMethodGroup(method) {
  const key = foldMethodLabel(method);
  if (key === '') return 'other';
  if (METHOD_CASH_ALIASES.has(key) || key.startsWith('cash at ')) return 'cash';
  if (METHOD_BANK_ALIASES.has(key)) return 'bank_transfer';
  if (METHOD_WALLET_ALIASES.has(key)) return 'mobile_wallet';
  return 'other';
}

function foldHistoryMethodFilter(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/** True for 'all' or one of the four method groups. */
export function isHistoryMethodFilter(value) {
  const folded = foldHistoryMethodFilter(value);
  return folded === HISTORY_METHOD_FILTER_ALL || HISTORY_METHOD_FILTER_METHODS.includes(folded);
}

/**
 * Normalize a filter choice. A valid group stays itself; 'all', a
 * missing choice and anything unknown read as 'all', so a damaged
 * choice never drops entries from the list.
 */
export function normalizeHistoryMethodFilter(value) {
  const folded = foldHistoryMethodFilter(value);
  if (folded === HISTORY_METHOD_FILTER_ALL || HISTORY_METHOD_FILTER_METHODS.includes(folded)) return folded;
  return HISTORY_METHOD_FILTER_ALL;
}

/**
 * Filter full-history entries by payment method. 'all' (or a missing
 * or unknown filter) keeps every entry, in the same order; any other
 * group keeps exactly the entries paid by that method. The input
 * list and its entries are never mutated — the result is a new
 * array.
 */
export function filterHistoryEntriesByMethod(entries, method) {
  const list = Array.isArray(entries) ? entries : [];
  const filter = normalizeHistoryMethodFilter(method);
  if (filter === HISTORY_METHOD_FILTER_ALL) return [...list];
  return list.filter((entry) => historyMethodGroup(entry?.method) === filter);
}

/**
 * Counts per method group over the full list, plus the total. The
 * per-group counts always sum to the total, so every entry is
 * reachable through exactly one filter option.
 */
export function historyMethodCounts(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const counts = { total: list.length };
  for (const method of HISTORY_METHOD_FILTER_METHODS) counts[method] = 0;
  for (const entry of list) {
    counts[historyMethodGroup(entry?.method)] += 1;
  }
  return counts;
}

/** Filter options with live counts: 'all' first, then one per group. */
export function historyMethodFilterOptions(entries) {
  const counts = historyMethodCounts(entries);
  const options = [{ value: HISTORY_METHOD_FILTER_ALL, label: 'All methods', count: counts.total }];
  for (const method of HISTORY_METHOD_FILTER_METHODS) {
    options.push({ value: method, label: HISTORY_METHOD_FILTER_LABELS[method], count: counts[method] });
  }
  return options;
}

/**
 * Subtotal of the shown entries: the sum of their listed amounts.
 * Each entry carries its listed amount, so the subtotal always
 * matches exactly the entries shown.
 */
export function historyMethodSubtotalCents(entries) {
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
export function formatMethodAmount(cents) {
  const amount = Number(cents);
  if (!Number.isFinite(amount)) return 'PKR 0';
  const sign = amount < 0 ? '-' : '';
  const text = (Math.abs(amount) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${sign}PKR ${text}`;
}

function escapeHistoryMethodFilterHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The filter select markup: one option per method group with its
 * live count, e.g. 'Mobile wallet (2)'. The chosen option is marked
 * selected.
 */
export function historyMethodFilterSelectMarkup(entries, selected) {
  const choice = normalizeHistoryMethodFilter(selected);
  const options = historyMethodFilterOptions(entries)
    .map((option) => `<option value="${escapeHistoryMethodFilterHtml(option.value)}"${option.value === choice ? ' selected' : ''}>${escapeHistoryMethodFilterHtml(option.label)} (${option.count})</option>`)
    .join('');
  return `<label class="field-label" for="hmfHistoryMethodFilter">Method</label><select id="hmfHistoryMethodFilter" class="hmf-filter">${options}</select>`;
}

/**
 * Empty-list line: 'No mobile wallet entries' for one group. With
 * no group chosen it returns '' so the caller keeps whatever empty
 * line the type filter already shows.
 */
export function historyMethodFilterEmptyText(method) {
  const filter = normalizeHistoryMethodFilter(method);
  if (filter === HISTORY_METHOD_FILTER_ALL) return '';
  return `No ${HISTORY_METHOD_FILTER_LABELS[filter].toLowerCase()} entries`;
}

/**
 * Summary line for the shown list while a method is chosen:
 * '3 of 12 entries · Mobile wallet only · Subtotal PKR 4,500',
 * with the date span added when a range is active too ('in
 * 2026-09-01 – 2026-09-30', 'from 2026-09-01' or 'up to
 * 2026-09-30') and ' · Refund only' when a type is chosen too.
 * With no method chosen it returns '' so the caller keeps the
 * summary the type and date-range filters already show.
 */
export function historyMethodFilterSummaryText(shown, entries, method, from, to, type) {
  const filter = normalizeHistoryMethodFilter(method);
  if (filter === HISTORY_METHOD_FILTER_ALL) return '';
  const shownList = Array.isArray(shown) ? shown : [];
  const fullList = Array.isArray(entries) ? entries : [];
  const count = shownList.length === 1
    ? `1 entry of ${fullList.length}`
    : `${shownList.length} of ${fullList.length} entries`;
  const range = normalizeMethodDateRange(from, to);
  const span = range.from !== '' && range.to !== ''
    ? ` in ${range.from} – ${range.to}`
    : range.from !== ''
      ? ` from ${range.from}`
      : range.to !== ''
        ? ` up to ${range.to}`
        : '';
  const foldedType = typeof type === 'string' ? type.trim().toLowerCase() : '';
  const typePart = foldedType !== '' && foldedType !== 'all' && HISTORY_METHOD_TYPE_LABELS[foldedType]
    ? ` · ${HISTORY_METHOD_TYPE_LABELS[foldedType]} only`
    : '';
  const subtotal = formatMethodAmount(historyMethodSubtotalCents(shownList));
  return `${count} · ${HISTORY_METHOD_FILTER_LABELS[filter]} only${span}${typePart} · Subtotal ${subtotal}`;
}
