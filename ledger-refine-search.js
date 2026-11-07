/*
 * Plan 465 — Refine within search results.
 *
 * A broad search returns a long list — every "Ahmed" in the ledger,
 * say — and the only way to narrow it used to be a brand-new search,
 * losing the first result set entirely. This module is the missing
 * piece for the Transactions screen: one refine box inside the
 * search results that filters the already-found list by a second
 * term, without re-running the first search.
 *
 * A refine term is a second name word, a mohalla, or a method. One
 * box, one term: an entry matches when the term matches its
 * customer or payer name (substring, plus the phonetic matcher for
 * Roman-Urdu spelling variants, so a typed "Fesal" still finds a
 * "Faisal"), the mohalla the payment was collected in, or its
 * method. A method term matches whole words of the recorded label
 * or the folded group label — "bank" finds both a Bank Transfer
 * and a Raast entry, "raast" finds the Raast entry itself, and
 * "cash" finds Cash and "Cash at … shop" but never JazzCash. The
 * refine goes live at three or more characters, the same threshold
 * as the live search on this screen; a blank box, or one or two
 * characters, is inactive and the full first list shows.
 *
 * Refining narrows only the list it is given and never adds entries
 * from outside it; clearing the box brings back the full first
 * list. It reads entries only and changes nothing: it never changes
 * any customer, bill, or payment record, and the input list and its
 * entries are never mutated. The result keeps the input order — the
 * screen's own sort control still governs display order afterwards,
 * exactly as it does for the other ledger filters. All money is PKR
 * only, never converted. Voided rows stay listed as history (they
 * are ledger entries), so a voided entry that matches appears in
 * the results; the count and total on the refine line follow the
 * ledger's own rule that voided rows are history, not collected
 * cash, so a voided entry counts towards neither.
 */

import { fuzzyCustomerNameMatches } from './fuzzy-alias-search.js';
import { ledgerMethodGroup, LEDGER_METHOD_LABELS } from './ledger-payment-method.js';

/** The refine goes live at three typed characters. */
export const LEDGER_REFINE_MIN_CHARS = 3;

/** The total, formatted the way the ledger's summary bar shows it. */
function formatLedgerRefinePkrTotal(rupees) {
  return `PKR ${Math.round(Number(rupees) || 0).toLocaleString('en-PK')}`;
}

const normalizedText = (value) => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase();

/**
 * The typed refine term as { query, active }: the query is the
 * trimmed text, and the refine is active once three or more
 * characters are typed. A blank box, one or two characters, or a
 * non-string value is inactive — the full first list shows.
 */
export function normalizeLedgerRefine(term) {
  if (typeof term !== 'string') return { query: '', active: false };
  const text = term.normalize('NFKC').trim();
  if (text.length < LEDGER_REFINE_MIN_CHARS) return { query: '', active: false };
  return { query: text, active: true };
}

/** True when the typed text is a refine term (three or more characters). */
export function ledgerRefineActive(term) {
  return normalizeLedgerRefine(term).active;
}

/**
 * Does one ledger entry match the refine term? A second name word
 * (customer or payer name, substring or phonetic variant), the
 * mohalla the payment was collected in, or the method (the recorded
 * label or the folded group label). An inactive refine matches every
 * entry. A voided entry still matches — it stays listed as history;
 * only the count and total skip voided rows.
 */
export function ledgerRefineMatches(entry, term) {
  const refine = normalizeLedgerRefine(term);
  if (!refine.active) return true;
  if (!entry || typeof entry !== 'object') return false;
  const needle = normalizedText(refine.query);
  // A name word: the customer name or the payer name, substring or
  // phonetic variant — the same matchers the ledger's own live
  // search already uses for names.
  if (normalizedText(entry.customerName).includes(needle)) return true;
  if (normalizedText(entry.paidBy).includes(needle)) return true;
  if (fuzzyCustomerNameMatches({ name: entry.customerName }, refine.query)) return true;
  if (entry.paidBy && fuzzyCustomerNameMatches({ name: entry.paidBy }, refine.query)) return true;
  // A mohalla: the mohalla the payment was collected in.
  if (normalizedText(entry.collectionMohalla).includes(needle)) return true;
  // A method: whole words of the recorded label ("Raast", "Cash
  // at Ahmed shop") or the folded group label ("Bank Transfer",
  // "Cash"). Word-prefix matching, so "cash" finds Cash and "Cash
  // at … shop" but never JazzCash, and "bank" finds both a Bank
  // Transfer and a Raast entry. Every word of a multi-word term
  // must match a word of the label.
  const methodWords = normalizedText(entry.method).split(/[^a-z0-9]+/).filter(Boolean);
  const groupLabel = LEDGER_METHOD_LABELS[ledgerMethodGroup(entry.method)] ?? '';
  const groupWords = normalizedText(groupLabel).split(/[^a-z0-9]+/).filter(Boolean);
  const methodTokens = [...methodWords, ...groupWords];
  const termWords = needle.split(/\s+/).filter(Boolean);
  if (termWords.length > 0 && termWords.every((word) => methodTokens.some((token) => token.startsWith(word)))) return true;
  return false;
}

/**
 * The entries matching the refine term, in the same order they
 * arrived in. With an inactive refine every entry is kept, in the
 * same order — clearing the box brings back the full first list.
 * The input list and its entries are never mutated — the result is
 * a new array. No entry from outside the given list is ever added.
 */
export function searchLedgerByRefine(transactions, term) {
  const list = Array.isArray(transactions) ? transactions : [];
  const refine = normalizeLedgerRefine(term);
  if (!refine.active) return [...list];
  return list.filter((entry) => ledgerRefineMatches(entry, refine.query));
}

/**
 * Count and total of the matched entries, following the ledger's own
 * rule: voided rows are history, not collected cash, so they count
 * towards neither. A non-numeric amount contributes nothing to the
 * total. The total is in rupees.
 */
export function ledgerRefineSummary(entries) {
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
 * The refine line for the summary bar: the typed term, the count,
 * and the total in PKR — '"Raza": 3 entries · PKR 4,500 total'.
 */
export function ledgerRefineSummaryText(entries, term) {
  const summary = ledgerRefineSummary(entries);
  const refine = normalizeLedgerRefine(term);
  const entriesWord = summary.count === 1 ? 'entry' : 'entries';
  return `"${refine.query}": ${summary.count} ${entriesWord} · ${formatLedgerRefinePkrTotal(summary.total)} total`;
}

/** The plain message for a refine term that matches nothing. */
export function ledgerRefineEmptyText(term) {
  const refine = normalizeLedgerRefine(term);
  if (!refine.active) return 'No recorded payments match these filters.';
  return `No entries match "${refine.query}".`;
}
