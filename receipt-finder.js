/**
 * receipt-finder.js — Unpaid Cards: the Recent receipts finder.
 *
 * A dedicated search over the local ledger (listTransactions entries):
 * find any receipt by customer name, phone, or customer ID, then
 * reopen it (print) or re-send it (WhatsApp text / PNG screenshot)
 * from the finder row. With a blank box the finder shows the most
 * recent receipts instead of an empty list, so the operator's usual
 * case — "the receipt I just issued" — needs no typing at all.
 *
 * This module is PURE: it reads entries and returns rows. It writes
 * nothing, mutates nothing, and changes no bill, payment, or
 * customer record. The receipt-number match reuses the ledger's own
 * exact finder (receipt-number-search.js), so the stored number and
 * the derived number behave exactly as the Transactions screen's
 * "Find by receipt number" does. Name matching is a plain substring
 * (case-insensitive); phone matching is digits-only, so "5277"
 * finds the phone; the customer number matches as "25" or "#25";
 * the stored customer id matches as a substring, so a pasted id
 * finds its receipts.
 *
 * The search goes live at two characters, not three: a two-digit
 * customer number ("25") is a complete customer ID and must find
 * its receipts. Results are newest first (payment date, then the
 * recorded-at stamp) and capped — the recent list at 10, a search
 * at 20 — so the finder stays a quick path, not a second ledger.
 */

import { findTransactionByReceiptNumber } from './receipt-number-search.js';

/** The search goes live at two typed characters (a 2-digit customer number is a full ID). */
export const RECEIPT_FINDER_MIN_CHARS = 2;

/** How many of the most recent receipts the blank finder shows. */
export const RECEIPT_FINDER_RECENT_LIMIT = 10;

/** How many matching receipts a search shows at most. */
export const RECEIPT_FINDER_SEARCH_LIMIT = 20;

const normalizedText = (value) => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase();
const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');

/**
 * The typed finder search as { query, active }: the query is the
 * trimmed text, and the search is active once two or more characters
 * are typed. A blank box, one character, or a non-string value is
 * inactive — the recent list shows.
 */
export function normalizeReceiptFinderQuery(query) {
  if (typeof query !== 'string') return { query: '', active: false };
  const text = query.normalize('NFKC').trim();
  if (text.length < RECEIPT_FINDER_MIN_CHARS) return { query: '', active: false };
  return { query: text, active: true };
}

/** True when the typed text is a finder search (two or more characters). */
export function receiptFinderQueryActive(query) {
  return normalizeReceiptFinderQuery(query).active;
}

/** Newest first: payment date, then the recorded-at stamp; input order breaks ties (stable sort). */
function byRecency(a, b) {
  const date = String(b?.date ?? '').localeCompare(String(a?.date ?? ''));
  if (date !== 0) return date;
  return String(b?.recordedAt ?? '').localeCompare(String(a?.recordedAt ?? ''));
}

/**
 * Does one ledger entry match the finder search? A name fragment
 * (customer or payer name), a phone fragment (digits-only), the
 * customer number ("25" or "#25"), the stored customer id, or the
 * receipt number (stored, or the derived number the receipt
 * builder prints). An inactive search matches every entry.
 */
export function receiptFinderMatches(entry, query, { deriveReceiptNumber } = {}) {
  const search = normalizeReceiptFinderQuery(query);
  if (!search.active) return true;
  if (!entry || typeof entry !== 'object') return false;
  const needle = normalizedText(search.query);
  const textFields = [
    entry.customerName,
    entry.paidBy,
    entry.customerNumber,
    `#${entry.customerNumber ?? ''}`,
    entry.customerId,
    entry.receiptNumber
  ];
  if (textFields.some((value) => normalizedText(value).includes(needle))) return true;
  // A digit fragment matches the digit-stripped phone and the
  // digit-stripped customer number, so "5277" finds the phone and
  // "25" finds customer 25 even when the typed text carries a "#".
  const digits = digitsOnly(search.query);
  if (digits.length >= RECEIPT_FINDER_MIN_CHARS) {
    if (digitsOnly(entry.customerPhone).includes(digits)) return true;
    if (digitsOnly(entry.customerNumber).includes(digits)) return true;
  }
  // The receipt-number match is the ledger's own exact finder, so a
  // typed number finds exactly the transaction carrying it — stored
  // or derived — never a neighbour.
  if (typeof deriveReceiptNumber === 'function') {
    return findTransactionByReceiptNumber([entry], search.query, { deriveReceiptNumber }) !== null;
  }
  return false;
}

/**
 * The finder rows for one typed query: { mode, rows, total }.
 * Blank query -> mode 'recent', the newest entries up to
 * recentLimit. Active query -> mode 'search', the matching entries
 * newest first up to searchLimit; total is the full match count, so
 * the caller can say how many more a narrower search would show.
 * The input list and its entries are never mutated.
 */
export function findReceipts(entries, query, { recentLimit = RECEIPT_FINDER_RECENT_LIMIT, searchLimit = RECEIPT_FINDER_SEARCH_LIMIT, deriveReceiptNumber } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const search = normalizeReceiptFinderQuery(query);
  if (!search.active) {
    const rows = [...list].sort(byRecency).slice(0, recentLimit);
    return { mode: 'recent', rows, total: rows.length };
  }
  const matches = list.filter((entry) => receiptFinderMatches(entry, search.query, { deriveReceiptNumber }));
  const rows = matches.sort(byRecency).slice(0, searchLimit);
  return { mode: 'search', rows, total: matches.length };
}
