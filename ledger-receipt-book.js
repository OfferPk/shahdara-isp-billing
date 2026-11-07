/*
 * Plan 466 — Search ledger by receipt book or series.
 *
 * A collector's receipt book holds one run of receipts, but the
 * ledger could only be searched by one receipt number at a time,
 * so checking a whole finished book meant searching receipt by
 * receipt. This module is the missing piece for the Transactions
 * screen: one receipt-book filter over the whole ledger, listing
 * every entry issued from that book with receipt number, date,
 * customer, and amount, plus the book's own total in PKR.
 *
 * A book is a recorded receipt series — a collector with a run
 * of plain-integer receipt numbers — so the operator picks it in
 * plain words from the series already recorded: "Saad — numbers
 * 1 to 50". The series themselves are recorded elsewhere (a
 * series assigns a number range to a collector and refuses a
 * range that overlaps one already recorded, so one number can
 * never belong to two books); this module only reads them.
 *
 * An entry belongs to a book when the receipt number stored on
 * it is a plain integer inside that book's range. The number is
 * read the way the receipt gap audit reads it: only a reference
 * that is exactly digits counts, so a generated reference (the
 * REC-YYMM-CCCC-XXXX kind the app derives when nothing is
 * stored) is never mistaken for a book number, and an entry
 * with no stored number, or a number in no recorded range,
 * belongs to no book. A stored number kept as a number rather
 * than text reads as no number — the ledger projection already
 * stores it as text, so that case does not arise on the screen.
 *
 * Around the filter this module adds what the screen was still
 * missing: the list of books to choose from, a book line in the
 * summary bar naming the book with its count and total in PKR
 * (the generic "Filtered total" changes meaning with every
 * filter combination), and a plain message for a book with no
 * entries — so the owner can tell a finished book with nothing
 * in it apart from another filter that matches nothing.
 *
 * The search reads entries only and changes nothing: it never
 * changes any bill, payment, or customer record, and the input
 * list and its entries are never mutated. The result keeps the
 * input order — the screen's own sort control still governs
 * display order afterwards, exactly as it does for the other
 * ledger filters. All money is PKR only, never converted. Voided
 * rows stay listed as history (they are ledger entries), so a
 * voided entry issued from the book appears in the results;
 * the count and total on the book line follow the ledger's own
 * rule that voided rows are history, not collected cash, so a
 * voided entry counts towards neither.
 */

import { seriesForNumber, findReceiptSeries, normalizeReceiptSeriesList } from './receipt-series.js';
import { receiptNumberFromReference } from './receipt-gap-audit.js';
import { normalizeLedgerAmount } from './ledger-amount-range.js';

/** The chosen series id, trimmed — or '' when no book is chosen. */
export function normalizeLedgerReceiptBookFilter(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

/** True when a receipt book is chosen. */
export function ledgerReceiptBookActive(value) {
  return normalizeLedgerReceiptBookFilter(value) !== '';
}

/**
 * One book in plain words — "Saad — numbers 1 to 50", the same
 * shape the series screen shows a series in. An unknown id reads
 * as the id itself, so a chosen book never silently loses its
 * name; with no book chosen the label is empty.
 */
export function ledgerReceiptBookLabel(seriesList, seriesId) {
  const chosen = normalizeLedgerReceiptBookFilter(seriesId);
  if (chosen === '') return '';
  const series = findReceiptSeries(seriesList, chosen);
  if (!series) return chosen;
  return `${series.collector} — numbers ${series.startNumber} to ${series.endNumber}`;
}

/**
 * The books to choose from, in the order they were recorded —
 * one { id, label } per recorded series. The input list is never
 * mutated.
 */
export function ledgerReceiptBookOptions(seriesList) {
  return normalizeReceiptSeriesList(seriesList).map((series) => ({
    id: series.id,
    label: ledgerReceiptBookLabel(seriesList, series.id),
  }));
}

/**
 * The book one ledger entry was issued from, or null. The
 * receipt number stored on the entry must be a plain integer
 * inside a recorded book's range. With no stored number, a
 * generated reference, or a number in no recorded range, the
 * entry belongs to no book.
 */
export function ledgerReceiptBookOfEntry(entry, seriesList) {
  const reference = entry?.receiptNumber ?? entry?.permanentReceiptNumber ?? '';
  const number = receiptNumberFromReference(reference);
  if (number === null) return null;
  return seriesForNumber(seriesList, number);
}

/**
 * Does one ledger entry belong to the chosen book? With no book
 * chosen every entry belongs. An entry with no book belongs to
 * none.
 */
export function ledgerReceiptBookMatches(entry, seriesList, seriesId) {
  const chosen = normalizeLedgerReceiptBookFilter(seriesId);
  if (chosen === '') return true;
  const series = ledgerReceiptBookOfEntry(entry, seriesList);
  return series !== null && series.id === chosen;
}

/**
 * The entries issued from one receipt book, in the same order
 * they arrived in. With no book chosen every entry is kept, in
 * the same order. The input list and its entries are never
 * mutated — the result is a new array.
 */
export function searchLedgerByReceiptBook(transactions, seriesList, seriesId) {
  const list = Array.isArray(transactions) ? transactions : [];
  const chosen = normalizeLedgerReceiptBookFilter(seriesId);
  if (chosen === '') return [...list];
  return list.filter((entry) => ledgerReceiptBookMatches(entry, seriesList, chosen));
}

/**
 * Count and total of the entries, following the ledger's own rule:
 * voided rows are history, not collected cash, so they count
 * towards neither. A non-numeric amount contributes nothing to
 * the total. The total is in rupees.
 */
export function ledgerReceiptBookSummary(entries) {
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

/** Whole rupees, formatted the way the owner types them. */
function formatLedgerReceiptBookRupees(rupees) {
  return `Rs ${Math.round(Number(rupees) || 0).toLocaleString('en-PK')}`;
}

/** The total, formatted the way the ledger's summary bar shows it. */
export function formatLedgerReceiptBookPkrTotal(rupees) {
  return `PKR ${Math.round(Number(rupees) || 0).toLocaleString('en-PK')}`;
}

/**
 * The book line for the summary bar: the book, the count, and
 * the total in PKR — "Saad — numbers 1 to 50: 3 entries ·
 * PKR 4,500 total". The count and total are over the entries
 * passed in, so on the screen they are the listed entries' own
 * count and total. With no book chosen the line is empty.
 */
export function ledgerReceiptBookSummaryText(entries, seriesList, seriesId) {
  const chosen = normalizeLedgerReceiptBookFilter(seriesId);
  if (chosen === '') return '';
  const summary = ledgerReceiptBookSummary(entries);
  const entriesWord = summary.count === 1 ? 'entry' : 'entries';
  return `${ledgerReceiptBookLabel(seriesList, chosen)}: ${summary.count} ${entriesWord} · ${formatLedgerReceiptBookPkrTotal(summary.total)} total`;
}

/** The plain message for a book with no entries. */
export function ledgerReceiptBookEmptyText(seriesList, seriesId) {
  const chosen = normalizeLedgerReceiptBookFilter(seriesId);
  if (chosen === '') return 'No recorded payments match these filters.';
  return `No entries from book ${ledgerReceiptBookLabel(seriesList, chosen)}.`;
}

/**
 * The plain message for a book with no entries inside the
 * amount range — the book and the range both named, so the
 * owner can tell a finished book with nothing in the range
 * apart from a range that matches nothing. The bounds parse
 * the same way the amount-range search parses them. With no
 * usable bound it reads as the plain book message; with no
 * book chosen it reads as the generic message.
 */
export function ledgerReceiptBookRangeEmptyText(seriesList, seriesId, min, max) {
  const chosen = normalizeLedgerReceiptBookFilter(seriesId);
  if (chosen === '') return 'No recorded payments match these filters.';
  const label = ledgerReceiptBookLabel(seriesList, chosen);
  const low = normalizeLedgerAmount(min);
  const high = normalizeLedgerAmount(max);
  if (low !== null && high !== null) {
    const from = Math.min(low, high);
    const to = Math.max(low, high);
    return `No entries from book ${label} between ${formatLedgerReceiptBookRupees(from)} and ${formatLedgerReceiptBookRupees(to)}.`;
  }
  if (low !== null) return `No entries from book ${label} of ${formatLedgerReceiptBookRupees(low)} or more.`;
  if (high !== null) return `No entries from book ${label} up to ${formatLedgerReceiptBookRupees(high)}.`;
  return `No entries from book ${label}.`;
}
