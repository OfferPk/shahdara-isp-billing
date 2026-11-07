/*
 * Plan 461 — Search ledger by bill month.
 *
 * The owner wants every ledger entry that belongs to one bill month
 * — for example all of March's bills and payments together — but the
 * ledger could only be filtered by calendar dates, so one bill month
 * had to be rebuilt from two date edges. This module is the missing
 * piece for the Transactions screen: one bill-month search over the
 * recorded payments, one month in YYYY-MM.
 *
 * An entry belongs to the month when the bill month recorded on it
 * equals the chosen month exactly, the same strict match the
 * Transactions list already uses for its bill month, so no
 * neighbouring month ever leaks in. An advance payment reads by the
 * bill month it was recorded on, not by the month its advance is
 * headed for: the advance target is where the money is allocated,
 * while the entry itself belongs to the bill it was recorded on —
 * the same rule the monthly report uses. The payment date is a
 * different question and already has its own filter; a payment made
 * in March on February's bill is a February entry, and a payment
 * made in April on March's bill is a March entry.
 *
 * The search reads entries only and changes nothing: it never
 * changes any bill, payment, or customer record, and the input list
 * and its entries are never mutated. The result keeps the input
 * order — the screen's own sort control still governs display order
 * afterwards, exactly as it does for the other ledger filters. All
 * money is PKR only, never converted. Voided rows stay listed as
 * history (they are ledger entries), so a voided entry in the month
 * appears in the results; the count and total on the month line
 * follow the ledger's own rule that voided rows are history, not
 * collected cash, so a voided entry counts towards neither.
 */

import { normalizeLedgerAmount } from './ledger-amount-range.js';

const LEDGER_BILL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Whole rupees, formatted the way the owner types them. */
function formatLedgerBillMonthRupees(rupees) {
  return `Rs ${Math.round(Number(rupees) || 0).toLocaleString('en-PK')}`;
}

/** The total, formatted the way the ledger's summary bar shows it. */
function formatLedgerBillMonthPkrTotal(rupees) {
  return `PKR ${Math.round(Number(rupees) || 0).toLocaleString('en-PK')}`;
}

const STRICT_BILL_MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/**
 * One strict bill month (YYYY-MM) as the month input gives it, or
 * null when the value is blank, malformed, or not a real month. No
 * Date object is built — the check is pure text, so a month of 00
 * or 13 never slips through.
 */
export function normalizeLedgerBillMonth(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!STRICT_BILL_MONTH.test(text)) return null;
  return text;
}

/** True when the value is one usable strict bill month. */
export function ledgerBillMonthActive(value) {
  return normalizeLedgerBillMonth(value) !== null;
}

/**
 * The month as the screen shows it — "March 2026", the same shape
 * the app's own month display uses — or '' when the value is not a
 * usable month.
 */
export function formatLedgerBillMonth(value) {
  const month = normalizeLedgerBillMonth(value);
  if (!month) return '';
  const parts = month.split('-');
  const name = LEDGER_BILL_MONTH_NAMES[Number(parts[1]) - 1] || parts[1];
  return `${name} ${parts[0]}`;
}

/**
 * Does one ledger entry belong to the bill month? The bill month
 * recorded on the entry must equal it exactly. With no usable month
 * nothing matches.
 */
export function ledgerBillMonthMatches(entry, month) {
  const target = normalizeLedgerBillMonth(month);
  if (!target) return false;
  return String(entry?.month ?? '') === target;
}

/**
 * The entries of one bill month, in the same order they arrived in.
 * With no usable month every entry is kept, in the same order. The
 * input list and its entries are never mutated — the result is a
 * new array.
 */
export function searchLedgerByBillMonth(transactions, month) {
  const list = Array.isArray(transactions) ? transactions : [];
  const target = normalizeLedgerBillMonth(month);
  if (!target) return [...list];
  return list.filter((entry) => ledgerBillMonthMatches(entry, target));
}

/**
 * Count and total of the entries, following the ledger's own rule:
 * voided rows are history, not collected cash, so they count
 * towards neither. A non-numeric amount contributes nothing to the
 * total. The total is in rupees.
 */
export function ledgerBillMonthSummary(entries) {
  const list = Array.isArray(entries) ? entries : [];
  let count = 0;
  let total = 0;
  for (const entry of list) {
    if (entry?.voided === true) continue;
    count += 1;
    total += Number(entry?.amount) || 0;
  }
  return { count, total };
}

/**
 * The month line for the summary bar: the month, the count, and
 * the total in PKR — "March 2026: 3 entries · PKR 4,500 total".
 * The count and total are over the entries passed in, so on the
 * screen they are the listed entries' own count and total. With no
 * usable month the line is empty.
 */
export function ledgerBillMonthSummaryText(entries, month) {
  const label = formatLedgerBillMonth(month);
  if (!label) return '';
  const summary = ledgerBillMonthSummary(entries);
  const entriesWord = summary.count === 1 ? 'entry' : 'entries';
  return `${label}: ${summary.count} ${entriesWord} · ${formatLedgerBillMonthPkrTotal(summary.total)} total`;
}

/** The plain message for a bill month that has no entries. */
export function ledgerBillMonthEmptyText(month) {
  const label = formatLedgerBillMonth(month);
  if (!label) return 'No recorded payments match these filters.';
  return `No entries for ${label}.`;
}

/**
 * The plain message for a bill month that has no entries inside the
 * amount range — the month and the range both named, so the owner
 * can tell a quiet month apart from a range that matches nothing.
 * The bounds parse the same way the amount-range search parses
 * them. With no usable bound it reads as the plain month message;
 * with no usable month it reads as the generic message.
 */
export function ledgerBillMonthRangeEmptyText(month, min, max) {
  const label = formatLedgerBillMonth(month);
  if (!label) return 'No recorded payments match these filters.';
  const low = normalizeLedgerAmount(min);
  const high = normalizeLedgerAmount(max);
  if (low !== null && high !== null) {
    const from = Math.min(low, high);
    const to = Math.max(low, high);
    return `No entries for ${label} between ${formatLedgerBillMonthRupees(from)} and ${formatLedgerBillMonthRupees(to)}.`;
  }
  if (low !== null) return `No entries for ${label} of ${formatLedgerBillMonthRupees(low)} or more.`;
  if (high !== null) return `No entries for ${label} up to ${formatLedgerBillMonthRupees(high)}.`;
  return `No entries for ${label}.`;
}
