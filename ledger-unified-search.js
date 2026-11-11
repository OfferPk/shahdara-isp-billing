/*
 * Transactions Screen Overhaul — one smart search bar.
 *
 * The Transactions screen used to have four separate searches — live
 * search (name, phone, amount), refine, cheque/transfer reference,
 * and find-by-receipt-number — each in its own box, and the operator
 * had to guess which box a half-remembered fragment belonged in.
 * This module is the missing piece: one search over the recorded
 * payments that matches any of them, so a single typed fragment
 * finds the payment however the operator remembers it.
 *
 * A search goes live at three or more characters, the same threshold
 * the live search already uses. It matches a name fragment, a phone
 * fragment, an amount fragment, or the customer number (the live
 * search); a cheque or transfer reference (the reference search);
 * or a receipt number, exactly (the receipt-number search). The
 * receipt match is exact — a typed receipt number finds exactly
 * the transaction carrying it, never a neighbour. The result keeps
 * the input order; the screen's own sort control still governs
 * display order afterwards, exactly as it does for the other ledger
 * filters.
 *
 * The search reads entries only and changes nothing: it never
 * changes any bill, payment, or customer record, and the input list
 * and its entries are never mutated. All money is PKR only, never
 * converted. Voided rows stay listed as history (they are ledger
 * entries), so a voided entry that matches appears in the results.
 */

import { liveLedgerSearchMatches, normalizeLiveLedgerSearch } from './ledger-live-search.js';
import { ledgerReferenceSearchMatches } from './ledger-reference-search.js';
import { findTransactionByReceiptNumber } from './receipt-number-search.js';

/** The search goes live at three typed characters, like the live search it extends. */
export const UNIFIED_LEDGER_SEARCH_MIN_CHARS = 3;

/**
 * The typed unified search as { query, active }: the query is the
 * trimmed text, and the search is active once three or more
 * characters are typed. A blank box, one or two characters, or a
 * non-string value is inactive — the full ledger shows. The
 * threshold and normalization are the live search's own, so the
 * unified bar and the live search can never disagree about when a
 * search is live.
 */
export function normalizeUnifiedLedgerSearch(query) {
  return normalizeLiveLedgerSearch(query);
}

/** True when the typed text is a unified search (three or more characters). */
export function unifiedLedgerSearchActive(query) {
  return normalizeUnifiedLedgerSearch(query).active;
}

/**
 * Does one ledger entry match the unified search? A live-search
 * match (name, phone, amount, or customer number), a reference
 * match (the cheque or transfer reference the entry carries), or
 * the exact receipt number the entry carries. An inactive search
 * matches every entry. A voided entry still matches — it stays
 * listed as history; only the count and total skip voided rows.
 */
export function unifiedLedgerSearchMatches(entry, query, { deriveReceiptNumber } = {}) {
  const search = normalizeUnifiedLedgerSearch(query);
  if (!search.active) return true;
  if (!entry || typeof entry !== 'object') return false;
  if (liveLedgerSearchMatches(entry, search.query)) return true;
  if (ledgerReferenceSearchMatches(entry, search.query)) return true;
  return findTransactionByReceiptNumber([entry], search.query, { deriveReceiptNumber }) !== null;
}

/**
 * The entries matching the unified search, in the same order they
 * arrived in. With an inactive search every entry is kept, in the
 * same order. The receipt-number match is computed once over the
 * whole list (not once per entry), so a receipt lookup stays one
 * pass. The input list and its entries are never mutated — the
 * result is a new array.
 */
export function searchLedgerUnified(transactions, query, { deriveReceiptNumber } = {}) {
  const list = Array.isArray(transactions) ? transactions : [];
  const search = normalizeUnifiedLedgerSearch(query);
  if (!search.active) return [...list];
  const receiptHit = findTransactionByReceiptNumber(list, search.query, { deriveReceiptNumber });
  return list.filter((entry) => {
    if (liveLedgerSearchMatches(entry, search.query)) return true;
    if (ledgerReferenceSearchMatches(entry, search.query)) return true;
    return receiptHit !== null && (entry === receiptHit || entry?.paymentId === receiptHit.paymentId);
  });
}
