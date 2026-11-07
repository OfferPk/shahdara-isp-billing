/*
 * Plan 462 — Search ledger by collector.
 *
 * When two people collect, the owner needs to see everything one
 * collector took in — but the ledger had no collector filter, so
 * one person's work had to be picked out entry by entry. This
 * module is the missing piece for the Transactions screen: one
 * collector filter over the whole ledger, listing every entry
 * recorded by that collector with date, customer, amount, and
 * method.
 *
 * The collector is the name recorded on the payment when it was
 * collected — the same name the Transactions list already shows
 * beside each entry — so the filter reads what is already there
 * and needs no new field. Matching is by name, case-insensitive:
 * choosing "saad" lists the entries recorded by "Saad", and an
 * entry with no collector recorded never belongs to any chosen
 * collector. The options on the screen come from the ledger
 * itself — every distinct collector name in the recorded entries,
 * in name order — so the owner can only choose a collector who
 * actually collected something, and a name typed with different
 * casing still finds the same person.
 *
 * Around the filter this module adds what the screen was still
 * missing: the list of collectors to choose from, a collector
 * line in the summary bar naming the collector with its count
 * and total in PKR (the generic "Filtered total" changes meaning
 * with every filter combination), and a plain message for a
 * collector with no entries — so the owner can tell a quiet
 * collector apart from another filter that matches nothing.
 *
 * The search reads entries only and changes nothing: it never
 * changes any bill, payment, or customer record, and the input
 * list and its entries are never mutated. The result keeps the
 * input order — the screen's own sort control still governs
 * display order afterwards, exactly as it does for the other
 * ledger filters. All money is PKR only, never converted. Voided
 * rows stay listed as history (they are ledger entries), so a
 * voided entry recorded by the collector appears in the results;
 * the count and total on the collector line follow the ledger's
 * own rule that voided rows are history, not collected cash, so
 * a voided entry counts towards neither.
 */

import { normalizeLedgerAmount } from './ledger-amount-range.js';

/** The collector name as chosen, trimmed — or '' when none is chosen. */
export function normalizeLedgerCollectorFilter(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

/** True when a collector is chosen. */
export function ledgerCollectorActive(value) {
  return normalizeLedgerCollectorFilter(value) !== '';
}

/** One collector name, folded for a case-insensitive comparison. */
function foldLedgerCollectorName(value) {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase() : '';
}

/** Whole rupees, formatted the way the owner types them. */
function formatLedgerCollectorRupees(rupees) {
  return `Rs ${Math.round(Number(rupees) || 0).toLocaleString('en-PK')}`;
}

/** The total, formatted the way the ledger's summary bar shows it. */
export function formatLedgerCollectorPkrTotal(rupees) {
  return `PKR ${Math.round(Number(rupees) || 0).toLocaleString('en-PK')}`;
}

/**
 * Does one ledger entry belong to the chosen collector? The
 * collector recorded on the entry must equal the chosen name,
 * case-insensitively. With no collector chosen every entry
 * belongs. An entry with no collector recorded belongs to none.
 */
export function ledgerCollectorMatches(entry, collector) {
  const chosen = normalizeLedgerCollectorFilter(collector);
  if (chosen === '') return true;
  const recorded = foldLedgerCollectorName(entry?.collectedBy);
  if (recorded === '') return false;
  return recorded === foldLedgerCollectorName(chosen);
}

/**
 * The entries one collector recorded, in the same order they
 * arrived in. With no collector chosen every entry is kept, in
 * the same order. The input list and its entries are never
 * mutated — the result is a new array.
 */
export function searchLedgerByCollector(transactions, collector) {
  const list = Array.isArray(transactions) ? transactions : [];
  const chosen = normalizeLedgerCollectorFilter(collector);
  if (chosen === '') return [...list];
  const key = foldLedgerCollectorName(chosen);
  return list.filter((entry) => foldLedgerCollectorName(entry?.collectedBy) === key);
}

/**
 * Every distinct collector name in the entries, in name order —
 * the options for the collector select. Names that differ only
 * by casing are one collector and keep the first spelling seen,
 * so "Saad" and "saad" never appear as two options. Entries with
 * no collector recorded contribute nothing. The input list and
 * its entries are never mutated.
 */
export function ledgerCollectors(transactions) {
  const list = Array.isArray(transactions) ? transactions : [];
  const seen = new Map();
  for (const entry of list) {
    const name = typeof entry?.collectedBy === 'string' ? entry.collectedBy.trim() : '';
    if (name === '') continue;
    const key = name.toLocaleLowerCase();
    if (!seen.has(key)) seen.set(key, name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * Count and total of the entries, following the ledger's own rule:
 * voided rows are history, not collected cash, so they count
 * towards neither. A non-numeric amount contributes nothing to
 * the total. The total is in rupees.
 */
export function ledgerCollectorSummary(entries) {
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
 * The collector line for the summary bar: the collector, the
 * count, and the total in PKR — "Saad: 3 entries · PKR 4,500
 * total". The count and total are over the entries passed in, so
 * on the screen they are the listed entries' own count and total.
 * With no collector chosen the line is empty.
 */
export function ledgerCollectorSummaryText(entries, collector) {
  const chosen = normalizeLedgerCollectorFilter(collector);
  if (chosen === '') return '';
  const summary = ledgerCollectorSummary(entries);
  const entriesWord = summary.count === 1 ? 'entry' : 'entries';
  return `${chosen}: ${summary.count} ${entriesWord} · ${formatLedgerCollectorPkrTotal(summary.total)} total`;
}

/** The plain message for a collector with no entries. */
export function ledgerCollectorEmptyText(collector) {
  const chosen = normalizeLedgerCollectorFilter(collector);
  if (chosen === '') return 'No recorded payments match these filters.';
  return `No entries collected by ${chosen}.`;
}

/**
 * The plain message for a collector with no entries inside the
 * amount range — the collector and the range both named, so the
 * owner can tell a quiet collector apart from a range that
 * matches nothing. The bounds parse the same way the amount-range
 * search parses them. With no usable bound it reads as the plain
 * collector message; with no collector chosen it reads as the
 * generic message.
 */
export function ledgerCollectorRangeEmptyText(collector, min, max) {
  const chosen = normalizeLedgerCollectorFilter(collector);
  if (chosen === '') return 'No recorded payments match these filters.';
  const low = normalizeLedgerAmount(min);
  const high = normalizeLedgerAmount(max);
  if (low !== null && high !== null) {
    const from = Math.min(low, high);
    const to = Math.max(low, high);
    return `No entries collected by ${chosen} between ${formatLedgerCollectorRupees(from)} and ${formatLedgerCollectorRupees(to)}.`;
  }
  if (low !== null) return `No entries collected by ${chosen} of ${formatLedgerCollectorRupees(low)} or more.`;
  if (high !== null) return `No entries collected by ${chosen} up to ${formatLedgerCollectorRupees(high)}.`;
  return `No entries collected by ${chosen}.`;
}
