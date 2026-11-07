/*
 * Plan 460 — Live ledger search as you type.
 *
 * Searching the ledger used to need a full term typed somewhere else
 * (the header search) or a receipt number plus the Find button, so
 * checking a half-remembered name or amount took several tries and
 * the operator could not see the list narrowing as they typed. This
 * module is the missing piece for the Transactions screen: one live
 * search over the recorded payments, updating on every keystroke.
 *
 * A search goes live at three or more characters. It matches a name
 * fragment (the customer name or the payer name, case-insensitive,
 * plus the phonetic matcher for Roman-Urdu spelling variants, so a
 * typed "Fesal" still finds a "Faisal"), a phone fragment (digits
 * only, so "5277" finds the customer and "0301-234" works too), or
 * an amount fragment ("1000" finds a 1000 payment and a 10000 one;
 * "1,000" reads the same). The customer number matches too ("102"
 * finds #102, "#102" the same). The method, date, month, and status
 * are not searched here — each already has its own filter on the
 * screen — and the receipt-number search is left alone.
 *
 * The search reads entries only and changes nothing: it never
 * changes any bill, payment, or customer record, and the input list
 * and its entries are never mutated. The result keeps the input
 * order — the screen's own sort control still governs display order
 * afterwards, exactly as it does for the other ledger filters. All
 * money is PKR only, never converted. Voided rows stay listed as
 * history (they are ledger entries), so a voided entry that matches
 * appears in the results; the count and total on the live line
 * follow the ledger's own rule that voided rows are history, not
 * collected cash, so a voided entry counts towards neither.
 */

import { fuzzyCustomerNameMatches } from './fuzzy-alias-search.js';

/** The search goes live at three typed characters. */
export const LIVE_LEDGER_SEARCH_MIN_CHARS = 3;

/** The total, formatted the way the ledger's summary bar shows it. */
function formatLiveLedgerPkrTotal(rupees) {
  return `PKR ${Math.round(Number(rupees) || 0).toLocaleString('en-PK')}`;
}

/** One amount as the ledger shows it, commas and all. */
function formatLiveLedgerAmount(amount) {
  return `PKR ${Math.round(Number(amount) || 0).toLocaleString('en-PK')}`;
}

const normalizedText = (value) => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase();

const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');

/**
 * The typed live search as { query, active }: the query is the
 * trimmed text, and the search is active once three or more
 * characters are typed. A blank box, one or two characters, or a
 * non-string value is inactive — the full ledger shows.
 */
export function normalizeLiveLedgerSearch(query) {
  if (typeof query !== 'string') return { query: '', active: false };
  const text = query.normalize('NFKC').trim();
  if (text.length < LIVE_LEDGER_SEARCH_MIN_CHARS) return { query: '', active: false };
  return { query: text, active: true };
}

/** True when the typed text is a live search (three or more characters). */
export function liveLedgerSearchActive(query) {
  return normalizeLiveLedgerSearch(query).active;
}

/**
 * Does one ledger entry match the live search? A name fragment
 * (customer or payer name, substring or phonetic variant), a phone
 * fragment, an amount fragment, or the customer number. An inactive
 * search matches every entry. A voided entry still matches — it
 * stays listed as history; only the count and total skip voided
 * rows.
 */
export function liveLedgerSearchMatches(entry, query) {
  const search = normalizeLiveLedgerSearch(query);
  if (!search.active) return true;
  if (!entry || typeof entry !== 'object') return false;
  const needle = normalizedText(search.query);
  const textFields = [
    entry.customerName,
    entry.paidBy,
    entry.customerNumber,
    `#${entry.customerNumber ?? ''}`,
    entry.customerPhone,
    entry.amount === null || entry.amount === undefined || entry.amount === '' ? '' : String(entry.amount),
    Number.isFinite(Number(entry?.amount)) ? formatLiveLedgerAmount(entry.amount) : '',
  ];
  if (textFields.some((value) => normalizedText(value).includes(needle))) return true;
  // A digit fragment matches the digit-stripped phone and amount,
  // so "1,000" reads the same as "1000" and "5277" finds the phone.
  const digits = digitsOnly(search.query);
  if (digits.length >= LIVE_LEDGER_SEARCH_MIN_CHARS) {
    if (digitsOnly(entry.customerPhone).includes(digits)) return true;
    if (Number.isFinite(Number(entry?.amount)) && digitsOnly(String(entry.amount)).includes(digits)) return true;
  }
  // The phonetic matcher for Roman-Urdu spelling variants, the same
  // one the ledger's own search already uses for names.
  if (fuzzyCustomerNameMatches({ name: entry.customerName }, search.query)) return true;
  if (entry.paidBy && fuzzyCustomerNameMatches({ name: entry.paidBy }, search.query)) return true;
  return false;
}

/**
 * The entries matching the live search, in the same order they
 * arrived in. With an inactive search every entry is kept, in the
 * same order. The input list and its entries are never mutated —
 * the result is a new array.
 */
export function searchLedgerLive(transactions, query) {
  const list = Array.isArray(transactions) ? transactions : [];
  const search = normalizeLiveLedgerSearch(query);
  if (!search.active) return [...list];
  return list.filter((entry) => liveLedgerSearchMatches(entry, search.query));
}

/**
 * Count and total of the matched entries, following the ledger's own
 * rule: voided rows are history, not collected cash, so they count
 * towards neither. A non-numeric amount contributes nothing to the
 * total. The total is in rupees.
 */
export function ledgerLiveSearchSummary(entries) {
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
 * The live line for the summary bar: the typed text, the count, and
 * the total in PKR — '"raj": 3 entries · PKR 4,500 total'.
 */
export function ledgerLiveSearchSummaryText(entries, query) {
  const summary = ledgerLiveSearchSummary(entries);
  const search = normalizeLiveLedgerSearch(query);
  const entriesWord = summary.count === 1 ? 'entry' : 'entries';
  return `"${search.query}": ${summary.count} ${entriesWord} · ${formatLiveLedgerPkrTotal(summary.total)} total`;
}

/** The plain message for a live search that matches nothing. */
export function ledgerLiveSearchEmptyText(query) {
  const search = normalizeLiveLedgerSearch(query);
  if (!search.active) return 'No recorded payments match these filters.';
  return `No entries match "${search.query}".`;
}
