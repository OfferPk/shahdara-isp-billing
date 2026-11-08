/*
 * Plan 467 — Search ledger by cheque or transfer reference number.
 *
 * A bank transfer or cheque arrives with only a reference number,
 * but the ledger could not be searched by that reference, so
 * matching the money to the customer meant reading through
 * pending-clearance entries by eye. This module is the missing
 * piece for the Transactions screen: one reference-number search
 * over the whole ledger, listing every entry carrying that
 * reference with date, customer, amount, and clearance state.
 *
 * The reference is read the way the ledger already reads it: the
 * payment's own method-detail reference — the transaction id
 * first, the older reference field second — exactly as given, so
 * a search for a fragment of the reference the operator was told
 * finds the payment that carries it. The clearance state is read
 * the way the clearance screen reads it: the clearance record for
 * the payment, if one exists — pending, cleared, or bounced — so
 * the operator sees at once whether the matched money has settled
 * or is still waiting. An entry with no clearance record carries
 * no clearance state at all — cash and wallet payments are never
 * tracked — never a guessed one.
 *
 * The search goes live at three or more characters, the same
 * threshold as the live search and the refine box on this screen;
 * a blank box, or one or two characters, is inactive and the full
 * ledger shows. It matches a case-insensitive substring of the
 * reference, so a typed fragment finds the entry and no other.
 *
 * The search reads entries only and changes nothing: it never
 * changes any bill, payment, or customer record, and the input
 * list and its entries are never mutated. The result keeps the
 * input order — the screen's own sort control still governs
 * display order afterwards, exactly as it does for the other
 * ledger filters. All money is PKR only, never converted. Voided
 * rows stay listed as history (they are ledger entries), so a
 * voided entry that matches appears in the results; the count
 * and total on the reference line follow the ledger's own rule
 * that voided rows are history, not collected cash, so a voided
 * entry counts towards neither.
 */

import { paymentMethodReferenceOf } from './payment-method-detail.js';
import { clearanceForPayment } from './payment-clearance.js';

/** The search goes live at three typed characters. */
export const LEDGER_REFERENCE_SEARCH_MIN_CHARS = 3;

/** The total, formatted the way the ledger's summary bar shows it. */
function formatLedgerReferencePkrTotal(rupees) {
  return `PKR ${Math.round(Number(rupees) || 0).toLocaleString('en-PK')}`;
}

const normalizedText = (value) => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase();

/**
 * The typed reference search as { query, active }: the query is
 * the trimmed text, and the search is active once three or more
 * characters are typed. A blank box, one or two characters, or a
 * non-string value is inactive — the full ledger shows.
 */
export function normalizeLedgerReferenceSearch(query) {
  if (typeof query !== 'string') return { query: '', active: false };
  const text = query.normalize('NFKC').trim();
  if (text.length < LEDGER_REFERENCE_SEARCH_MIN_CHARS) return { query: '', active: false };
  return { query: text, active: true };
}

/** True when the typed text is a reference search (three or more characters). */
export function ledgerReferenceSearchActive(query) {
  return normalizeLedgerReferenceSearch(query).active;
}

/**
 * Does one ledger entry carry the typed reference? A
 * case-insensitive substring of the payment's own reference —
 * the transaction id first, the older reference field second.
 * An inactive search matches every entry. An entry with no
 * reference never matches an active search — the reference is
 * never invented. A voided entry still matches — it stays listed
 * as history; only the count and total skip voided rows.
 */
export function ledgerReferenceSearchMatches(entry, query) {
  const search = normalizeLedgerReferenceSearch(query);
  if (!search.active) return true;
  if (!entry || typeof entry !== 'object') return false;
  const reference = paymentMethodReferenceOf(entry);
  if (!reference) return false;
  return normalizedText(reference).includes(normalizedText(search.query));
}

/**
 * The entries carrying the typed reference, in the same order
 * they arrived in. With an inactive search every entry is kept,
 * in the same order. The input list and its entries are never
 * mutated — the result is a new array.
 */
export function searchLedgerByReference(transactions, query) {
  const list = Array.isArray(transactions) ? transactions : [];
  const search = normalizeLedgerReferenceSearch(query);
  if (!search.active) return [...list];
  return list.filter((entry) => ledgerReferenceSearchMatches(entry, search.query));
}

/**
 * Count and total of the matched entries, following the ledger's
 * own rule: voided rows are history, not collected cash, so they
 * count towards neither. A non-numeric amount contributes
 * nothing to the total. The total is in rupees.
 */
export function ledgerReferenceSearchSummary(entries) {
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
 * The reference line for the summary bar: the typed reference,
 * the count, and the total in PKR — '"TRF123": 2 entries ·
 * PKR 3,000 total'.
 */
export function ledgerReferenceSearchSummaryText(entries, query) {
  const summary = ledgerReferenceSearchSummary(entries);
  const search = normalizeLedgerReferenceSearch(query);
  const entriesWord = summary.count === 1 ? 'entry' : 'entries';
  return `"${search.query}": ${summary.count} ${entriesWord} · ${formatLedgerReferencePkrTotal(summary.total)} total`;
}

/** The plain message for a reference that matches nothing. */
export function ledgerReferenceSearchEmptyText(query) {
  const search = normalizeLedgerReferenceSearch(query);
  if (!search.active) return 'No recorded payments match these filters.';
  return `No entries with reference "${search.query}".`;
}

/**
 * The clearance state of one ledger entry, in plain words —
 * 'Pending clearance', 'Cleared', or 'Bounced' — from the
 * clearance record for the payment, if one exists. An entry with
 * no clearance record has no clearance state: '' — never a
 * guessed state.
 */
export function ledgerReferenceClearanceLabel(clearanceList, paymentId) {
  const record = clearanceForPayment(clearanceList, paymentId);
  if (!record) return '';
  if (record.status === 'pending') return 'Pending clearance';
  if (record.status === 'cleared') return 'Cleared';
  if (record.status === 'bounced') return 'Bounced';
  return '';
}

/**
 * The clearance state as it appears on a matched row: a ' · …'
 * suffix for the payment-meta line, or '' when the entry has no
 * clearance record, so an entry without one shows only its
 * reference. The label is plain words; the caller escapes it
 * with the rest of the row, as the row's own markup does.
 */
export function ledgerReferenceClearanceSuffix(clearanceList, paymentId) {
  const label = ledgerReferenceClearanceLabel(clearanceList, paymentId);
  return label ? ` · Clearance: ${label}` : '';
}
