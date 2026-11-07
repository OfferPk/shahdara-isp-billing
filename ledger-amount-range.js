/**
 * Plan 453 — Search ledger by amount range.
 *
 * The owner wants every ledger entry between two amounts — for
 * example all payments between Rs 1,000 and Rs 2,000 — but the
 * whole-ledger list could only be narrowed by one exact amount on a
 * single customer's history, so the range had to be checked entry by
 * entry. This module is the missing piece for the whole ledger: one
 * amount-range search over the recorded payments, minimum and
 * maximum in whole rupees, both inclusive, listing every matching
 * entry with date, customer, and method.
 *
 * The search reads entries only and changes nothing: it never
 * changes any bill, payment, or customer record, and the input list
 * and its entries are never mutated. All money is PKR only (Rs),
 * never converted — the bounds are shown as Rs and the total as PKR,
 * the same currency the ledger itself shows.
 *
 * Bounds are whole rupees, parsed the same way the per-customer
 * exact-amount search parses its amount: an optional Rs/PKR prefix,
 * commas and spaces stripped, digits only. A blank side is open
 * (no lower or no upper bound); a typed range with the small end
 * after the big end is read as the interval between the two values.
 * An amount with paisa is still inside a range that covers it — the
 * range compares numbers, it does not require a whole-rupee amount.
 *
 * Order is date order, oldest first; an entry with no usable date
 * sorts after the dated ones and keeps its place among them. The
 * screen's own sort control still governs display order afterwards,
 * exactly as it does for the other ledger filters.
 *
 * Voided rows stay listed as history (they are ledger entries), so
 * a voided entry in the range appears in the results; the count and
 * total on the range line follow the ledger's own rule that voided
 * rows are history, not collected cash, so a voided entry counts
 * neither towards the count nor towards the total there.
 */

/** Whole rupees, formatted the way the owner types them. */
export function formatLedgerRupees(rupees) {
  return `Rs ${Math.round(Number(rupees) || 0).toLocaleString('en-PK')}`;
}

/** The total, formatted the way the ledger's summary bar shows it. */
export function formatLedgerPkrTotal(rupees) {
  return `PKR ${Math.round(Number(rupees) || 0).toLocaleString('en-PK')}`;
}

/**
 * Parse one bound: a whole-rupee amount, or null when the side is
 * blank or unusable. A number input must be a positive safe integer;
 * a string may carry an Rs/PKR prefix, commas, and spaces. Zero or
 * less is null — a zero bound is the same as no bound, since no
 * recorded payment is Rs 0.
 */
export function normalizeLedgerAmount(value) {
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
 * The typed range as { min, max, active }: each bound a whole-rupee
 * amount or null when blank or unusable. A range typed backwards is
 * read as the interval between the two values. The search is active
 * when at least one side parses.
 */
export function normalizeLedgerAmountRange(min, max) {
  let low = normalizeLedgerAmount(min);
  let high = normalizeLedgerAmount(max);
  if (low !== null && high !== null && low > high) {
    const swap = low;
    low = high;
    high = swap;
  }
  return { min: low, max: high, active: low !== null || high !== null };
}

/** True when at least one bound is a usable whole-rupee amount. */
export function ledgerAmountRangeActive(min, max) {
  return normalizeLedgerAmountRange(min, max).active;
}

/**
 * Does one ledger entry fall inside the range, both ends inclusive?
 * A blank side is open. An entry with no numeric amount never
 * matches. A voided entry still matches — it stays listed as
 * history; only the count and total skip voided rows.
 */
export function ledgerAmountRangeMatches(entry, min, max) {
  const range = normalizeLedgerAmountRange(min, max);
  if (!range.active) return true;
  const amount = Number(entry?.amount);
  if (!Number.isFinite(amount)) return false;
  if (range.min !== null && amount < range.min) return false;
  if (range.max !== null && amount > range.max) return false;
  return true;
}

/**
 * The entries whose amount falls inside the range, in date order
 * (oldest first; undated entries last, in list order). With no
 * usable bound every entry is kept, in the same order. The input
 * list and its entries are never mutated — the result is a new
 * array.
 */
export function searchLedgerByAmountRange(transactions, min, max) {
  const list = Array.isArray(transactions) ? transactions : [];
  const range = normalizeLedgerAmountRange(min, max);
  if (!range.active) return [...list];
  const matched = list.filter((entry) => ledgerAmountRangeMatches(entry, range.min, range.max));
  const dated = (entry) => {
    const date = String(entry?.date ?? '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  };
  return matched.sort((a, b) => {
    const dateA = dated(a);
    const dateB = dated(b);
    if (dateA === null && dateB === null) return 0;
    if (dateA === null) return 1;
    if (dateB === null) return -1;
    return dateA < dateB ? -1 : dateA > dateB ? 1 : 0;
  });
}

/**
 * Count and total of the matched entries, following the ledger's own
 * rule: voided rows are history, not collected cash, so they count
 * towards neither. A non-numeric amount contributes nothing to the
 * total. The total is in rupees.
 */
export function ledgerAmountRangeSummary(entries) {
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

/** The range as the screen shows it: both bounds, or one open side. */
export function ledgerAmountRangeText(min, max) {
  const range = normalizeLedgerAmountRange(min, max);
  if (range.min !== null && range.max !== null) {
    return `${formatLedgerRupees(range.min)} – ${formatLedgerRupees(range.max)}`;
  }
  if (range.min !== null) return `${formatLedgerRupees(range.min)} and above`;
  if (range.max !== null) return `Up to ${formatLedgerRupees(range.max)}`;
  return '';
}

/**
 * The range line for the summary bar: the range, the count, and the
 * total in PKR — "Rs 1,000 – Rs 2,000: 3 entries · PKR 4,500 total".
 */
export function ledgerAmountRangeSummaryText(entries, min, max) {
  const summary = ledgerAmountRangeSummary(entries);
  const rangeText = ledgerAmountRangeText(min, max);
  const entriesWord = summary.count === 1 ? 'entry' : 'entries';
  return `${rangeText}: ${summary.count} ${entriesWord} · ${formatLedgerPkrTotal(summary.total)} total`;
}

/** The plain message for a range that matches nothing. */
export function ledgerAmountRangeEmptyText(min, max) {
  const range = normalizeLedgerAmountRange(min, max);
  if (range.min !== null && range.max !== null) {
    return `No entries between ${formatLedgerRupees(range.min)} and ${formatLedgerRupees(range.max)}.`;
  }
  if (range.min !== null) {
    return `No entries of ${formatLedgerRupees(range.min)} or more.`;
  }
  if (range.max !== null) {
    return `No entries up to ${formatLedgerRupees(range.max)}.`;
  }
  return 'No recorded payments match these filters.';
}
