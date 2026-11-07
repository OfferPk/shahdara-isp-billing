/**
 * Plan 455 — Search ledger by payment method.
 *
 * The owner wants to see all JazzCash payments, or all cash
 * payments, across the whole ledger — to reconcile the JazzCash
 * account or count the cash drawer from one clean list instead of
 * reading every entry to find the matching method. A method filter
 * already sat on the Transactions screen, but it was an
 * exact-match filter over five options, and that left real
 * payments unreachable: "Cash" matched only the plain Cash label,
 * never the "Cash at … shop" variants; "Bank Transfer" matched
 * only Bank Transfer, never Raast; and NayaPay matched nothing at
 * all, so a NayaPay entry could only be seen under "All methods".
 *
 * This module is the missing piece. It folds each recorded method
 * label into one of six groups — the same grouping the app's own
 * reconciliation view and the per-customer history method filter
 * already use, so the ledger, the history, and the reconciliation
 * all agree about what "cash" means:
 * - Cash: Cash and every "Cash at … shop" variant.
 * - JazzCash, Easypaisa, NayaPay: each its own group, so the
 *   owner can still list one wallet alone.
 * - Bank transfer: Bank Transfer and Raast.
 * - Other: anything else, or an entry with no method at all, so
 *   the six options always partition the full list and every
 *   entry is reachable through exactly one option.
 *
 * Cheque is not one of the options on purpose: the app's payment
 * validation rejects 'Cheque' as a payment method (a cheque or a
 * bank transfer is tracked for clearance, not recorded as a
 * payment method), so no cheque entry can ever be recorded. A
 * cheque-labelled entry, if one ever appears in the ledger from
 * an older or imported record, reads as Other — it is never
 * forced into a group it does not belong to.
 *
 * Around the filter this module adds what the screen was still
 * missing: a method line in the summary bar naming the method
 * with its count and total in PKR (the generic "Filtered total"
 * changes meaning with every filter combination), and a plain
 * message for a method with no entries — composed with the day
 * and the amount range when those filters are active too, so the
 * owner can tell a quiet method apart from a day or a range that
 * matches nothing.
 *
 * The search reads entries only and changes nothing: it never
 * changes any bill, payment, or customer record, and the input
 * list and its entries are never mutated. All money is PKR only
 * (Rs bounds, PKR total), never converted. The method line's
 * count and total follow the ledger's own rule that voided rows
 * are history, not collected cash, so a voided entry stays listed
 * but counts towards neither — the same rule the range line and
 * the day line already use, so the three lines agree with each
 * other and with the sum of the listed non-voided entries.
 */

export const LEDGER_METHOD_FILTER_ALL = 'all';

export const LEDGER_METHOD_FILTERS = Object.freeze([
  'cash',
  'jazzcash',
  'easypaisa',
  'nayapay',
  'bank_transfer',
  'other',
]);

export const LEDGER_METHOD_LABELS = Object.freeze({
  cash: 'Cash',
  jazzcash: 'JazzCash',
  easypaisa: 'Easypaisa',
  nayapay: 'NayaPay',
  bank_transfer: 'Bank Transfer',
  other: 'Other',
});

const LEDGER_METHOD_CASH_ALIASES = new Set(['cash']);
const LEDGER_METHOD_BANK_ALIASES = new Set(['bank transfer', 'banktransfer', 'bank_transfer', 'raast']);

/** Whole rupees, formatted the way the owner types them. */
export function formatLedgerMethodRupees(rupees) {
  return `Rs ${Math.round(Number(rupees) || 0).toLocaleString('en-PK')}`;
}

/** The total, formatted the way the ledger's summary bar shows it. */
export function formatLedgerMethodPkrTotal(rupees) {
  return `PKR ${Math.round(Number(rupees) || 0).toLocaleString('en-PK')}`;
}

/**
 * One recorded method label, folded the way the app's own
 * reconciliation already folds it: lowercased, spaces and hyphens
 * collapsed to one space. A non-string reads as ''.
 */
function foldLedgerMethodLabel(value) {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/[\s-]+/g, ' ').trim() : '';
}

/**
 * The method group for one recorded method label. Cash (and every
 * "Cash at … shop" variant) reads as cash; Bank Transfer and Raast
 * read as bank transfer; JazzCash, Easypaisa, and NayaPay each read
 * as their own group. Anything else — an unrecognised method, or
 * an entry with no method at all, such as a charge or a credit —
 * reads as other.
 */
export function ledgerMethodGroup(method) {
  const key = foldLedgerMethodLabel(method);
  if (key === '') return 'other';
  if (LEDGER_METHOD_CASH_ALIASES.has(key) || key.startsWith('cash at ')) return 'cash';
  if (LEDGER_METHOD_BANK_ALIASES.has(key)) return 'bank_transfer';
  if (key === 'jazzcash') return 'jazzcash';
  if (key === 'easypaisa') return 'easypaisa';
  if (key === 'nayapay') return 'nayapay';
  return 'other';
}

/** True for 'all' or one of the six method groups. */
export function isLedgerMethodFilter(value) {
  const folded = foldLedgerMethodLabel(value);
  if (folded === LEDGER_METHOD_FILTER_ALL) return true;
  if (folded === 'bank transfer' || folded === 'banktransfer') return true;
  return LEDGER_METHOD_FILTERS.includes(folded);
}

/**
 * Normalize a filter choice. A valid group stays itself; 'all', a
 * missing choice and anything unknown read as 'all', so a damaged
 * choice never drops entries from the list. The screen's select
 * values are accepted as written — 'Bank Transfer' reads as the
 * bank transfer group, 'EasyPaisa' as the Easypaisa group.
 */
export function normalizeLedgerMethodFilter(value) {
  const folded = foldLedgerMethodLabel(value);
  if (folded === LEDGER_METHOD_FILTER_ALL) return LEDGER_METHOD_FILTER_ALL;
  if (folded === 'bank transfer' || folded === 'banktransfer') return 'bank_transfer';
  if (LEDGER_METHOD_FILTERS.includes(folded)) return folded;
  return LEDGER_METHOD_FILTER_ALL;
}

/**
 * Does one ledger entry belong to the chosen method? With 'all'
 * (or a missing or unknown filter) every entry belongs. The input
 * entry is never mutated.
 */
export function ledgerMethodMatches(entry, filter) {
  const choice = normalizeLedgerMethodFilter(filter);
  if (choice === LEDGER_METHOD_FILTER_ALL) return true;
  return ledgerMethodGroup(entry?.method) === choice;
}

/**
 * The entries paid by one method, in the same order. 'all' (or a
 * missing or unknown filter) keeps every entry. The input list and
 * its entries are never mutated — the result is a new array.
 */
export function searchLedgerByMethod(transactions, filter) {
  const list = Array.isArray(transactions) ? transactions : [];
  const choice = normalizeLedgerMethodFilter(filter);
  if (choice === LEDGER_METHOD_FILTER_ALL) return [...list];
  return list.filter((entry) => ledgerMethodGroup(entry?.method) === choice);
}

/**
 * Counts per method group over the full list, plus the total. The
 * per-group counts always sum to the total, so every entry is
 * reachable through exactly one filter option. Voided rows are
 * history, not collected cash, so they are counted apart: the
 * counts here are over listed rows only when the caller passes
 * the listed rows, and a voided row is never hidden from the
 * list itself.
 */
export function ledgerMethodCounts(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const counts = { total: list.length };
  for (const method of LEDGER_METHOD_FILTERS) counts[method] = 0;
  for (const entry of list) {
    counts[ledgerMethodGroup(entry?.method)] += 1;
  }
  return counts;
}

/**
 * Count and total of the entries, following the ledger's own rule:
 * voided rows are history, not collected cash, so they count
 * towards neither. A non-numeric amount contributes nothing to the
 * total. The total is in rupees.
 */
export function ledgerMethodSummary(entries) {
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
 * The method line for the summary bar: the method, the count, and
 * the total in PKR — "JazzCash: 3 entries · PKR 4,500 total". The
 * count and total are over the entries passed in, so on the screen
 * they are the listed entries' own count and total. With no method
 * chosen the line is empty.
 */
export function ledgerMethodSummaryText(entries, filter) {
  const choice = normalizeLedgerMethodFilter(filter);
  if (choice === LEDGER_METHOD_FILTER_ALL) return '';
  const summary = ledgerMethodSummary(entries);
  const entriesWord = summary.count === 1 ? 'entry' : 'entries';
  return `${LEDGER_METHOD_LABELS[choice]}: ${summary.count} ${entriesWord} · ${formatLedgerMethodPkrTotal(summary.total)} total`;
}

/** The plain message for a method that has no entries. */
export function ledgerMethodEmptyText(filter) {
  const choice = normalizeLedgerMethodFilter(filter);
  if (choice === LEDGER_METHOD_FILTER_ALL) return '';
  return `No ${LEDGER_METHOD_LABELS[choice]} entries.`;
}

/**
 * One bound of an amount range, parsed the same way the range
 * search parses its bounds: a whole-rupee amount, or null when the
 * side is blank or unusable. A number input must be a positive
 * safe integer; a string may carry an Rs/PKR prefix, commas, and
 * spaces. Zero or less is null.
 */
function normalizeLedgerMethodRangeBound(value) {
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

/**
 * The plain message for a method with no entries, composed with
 * the day and the amount range when those filters are active too —
 * the day arrives already formatted ("5 Nov 2026") or '' when no
 * day is chosen, so this module needs no date logic of its own.
 * With no method chosen it returns '' so the caller keeps the
 * message the day and range filters already show.
 */
export function ledgerMethodDayRangeEmptyText(filter, dayLabel, min, max) {
  const choice = normalizeLedgerMethodFilter(filter);
  if (choice === LEDGER_METHOD_FILTER_ALL) return '';
  const label = LEDGER_METHOD_LABELS[choice];
  let text = `No ${label} entries`;
  const day = typeof dayLabel === 'string' ? dayLabel.trim() : '';
  if (day !== '') text += ` on ${day}`;
  const low = normalizeLedgerMethodRangeBound(min);
  const high = normalizeLedgerMethodRangeBound(max);
  if (low !== null && high !== null) {
    const from = Math.min(low, high);
    const to = Math.max(low, high);
    text += ` between ${formatLedgerMethodRupees(from)} and ${formatLedgerMethodRupees(to)}`;
  } else if (low !== null) {
    text += ` of ${formatLedgerMethodRupees(low)} or more`;
  } else if (high !== null) {
    text += ` up to ${formatLedgerMethodRupees(high)}`;
  }
  return `${text}.`;
}
