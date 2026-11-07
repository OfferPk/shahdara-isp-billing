/*
 * Plan 464 — no-result help with nearest names.
 *
 * A search with no match used to show only "nothing found", so the
 * operator could not tell a misspelt name from a mistyped number or
 * a customer who truly does not exist, and the search simply died.
 * This module answers the one question that panel could not: which
 * names are closest to what was typed, by spelling closeness, so a
 * misspelt name at the counter becomes a one-tap correction instead
 * of a dead end — plus the plain advice for when nothing is close.
 *
 * Closeness is Damerau-Levenshtein distance over the canonical keys
 * the Roman-Urdu phonetic matcher already produces, so a typo that
 * survives the phonetic folds ("Fasil" for "Faisal", "Ahmad" for
 * "Ahmed", a swapped pair of letters) still reads as close, while a
 * genuinely different name reads as far away. The score is the best
 * similarity over the whole name key and over each name token, so a
 * mistyped surname still finds its customer through the first name
 * and a mistyped first name still finds them through the surname.
 * A suggestion needs a similarity of 0.6 or better and the typed
 * text needs at least two characters — a single letter never
 * suggests a name. At most three suggestions come back, closest
 * first, ties in name order with the customer number as tiebreak,
 * the same order the name-prefix lookup uses.
 *
 * The module is pure and reads only: it takes the candidate
 * customers and the query and returns plain suggestion data. It
 * never changes any customer, bill, or payment record, adds no
 * customer, and keeps no store. The candidates are the customers
 * the sheet itself could have shown — unarchived, in the chosen
 * mohalla — so a suggestion never contradicts the search that
 * just ran. The status chips do not narrow the suggestions: a
 * suggestion is about the spelling, not the account state, and
 * tapping one opens that customer's profile.
 */

import { romanUrduNameKey, fuzzySearchFieldTexts } from './fuzzy-alias-search.js';

/** A suggestion needs at least this spelling similarity (0–1). */
export const NO_RESULT_HELP_MIN_SIMILARITY = 0.6;

/** At most this many nearest names are offered. */
export const NO_RESULT_HELP_MAX_SUGGESTIONS = 3;

/** Shorter typed text never suggests a name. */
export const NO_RESULT_HELP_MIN_QUERY_LENGTH = 2;

/** The plain advice shown with the panel, whether names are close or not. */
export const NO_RESULT_HELP_ADVICE = 'Check the spelling, try the phone number, or try the mohalla filter.';

/** The plain line shown when no name is close enough to suggest. */
export const NO_RESULT_HELP_NO_CLOSE_TEXT = 'No close matches.';

/** Escapes HTML characters for safe template string interpolation. */
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

/**
 * Damerau-Levenshtein distance between two strings: insertions,
 * deletions, substitutions, and a swapped pair of adjacent letters
 * each cost one — a transposed pair ("Fiasal" for "Faisal") is one
 * slip of the finger, not two. Returns 0 for identical strings.
 */
export function noResultSpellingDistance(a, b) {
  const s = String(a ?? '');
  const t = String(b ?? '');
  if (s === t) return 0;
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prevPrev = new Array(n + 1);
  let prev = new Array(n + 1);
  let cur = new Array(n + 1);
  for (let j = 0; j <= n; j += 1) prev[j] = j;
  for (let i = 1; i <= m; i += 1) {
    cur[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      let best = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        best = Math.min(best, prevPrev[j - 2] + 1);
      }
      cur[j] = best;
    }
    const tmp = prevPrev;
    prevPrev = prev;
    prev = cur;
    cur = tmp;
  }
  return prev[n];
}

/** Spelling similarity between two strings, 0 (nothing alike) to 1 (identical). */
function spellingSimilarity(a, b) {
  const longer = Math.max(String(a ?? '').length, String(b ?? '').length);
  if (longer === 0) return 1;
  return 1 - noResultSpellingDistance(a, b) / longer;
}

/** The name-order key: NFKC, trimmed, single-spaced, lowercased. */
function normalizeName(value) {
  return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function customerNumberOrZero(customer) {
  const number = Number(customer?.customerNumber);
  return Number.isFinite(number) ? number : 0;
}

/**
 * The best spelling similarity between the typed text and one
 * customer: the highest score over the whole canonical key and
 * over every query-token / name-token pair, across the name, the
 * father / reference name, and the search aliases — the same
 * texts the fuzzy matcher searches. A customer is still one
 * suggestion even when several of their texts are close.
 */
function bestSimilarityForCustomer(customer, queryKey, queryTokens) {
  let best = 0;
  for (const text of fuzzySearchFieldTexts(customer)) {
    const key = romanUrduNameKey(text);
    if (!key) continue;
    best = Math.max(best, spellingSimilarity(queryKey, key));
    for (const queryToken of queryTokens) {
      for (const candidateToken of key.split(' ')) {
        best = Math.max(best, spellingSimilarity(queryToken, candidateToken));
      }
    }
  }
  return best;
}

/**
 * The nearest customer names to the typed text, closest first.
 * Each suggestion is plain data — the id, the customer number,
 * and the name the operator taps to open that customer. Returns
 * an empty list when the typed text is too short, when nothing
 * is close enough, or when there is nothing to search.
 *
 * @param {Array<Object>} customers - Candidate customers
 * @param {string} query - The typed search text
 * @param {number} [limit=3] - At most this many suggestions
 * @returns {Array<{id: string, customerNumber: number, name: string}>}
 */
export function nearestCustomerNames(customers, query, limit = NO_RESULT_HELP_MAX_SUGGESTIONS) {
  if (!Array.isArray(customers)) return [];
  const typed = String(query ?? '').normalize('NFKC').trim();
  if (typed.length < NO_RESULT_HELP_MIN_QUERY_LENGTH) return [];
  const queryKey = romanUrduNameKey(typed);
  if (!queryKey) return [];
  const queryTokens = queryKey.split(' ').filter(Boolean);
  if (queryTokens.length === 0) return [];

  const scored = [];
  for (const customer of customers) {
    if (!customer || typeof customer !== 'object') continue;
    if (customer.archived) continue;
    const name = String(customer.name ?? '').trim();
    if (!name) continue;
    const similarity = bestSimilarityForCustomer(customer, queryKey, queryTokens);
    if (similarity < NO_RESULT_HELP_MIN_SIMILARITY) continue;
    scored.push({ customer, similarity });
  }

  scored.sort((a, b) => {
    if (b.similarity !== a.similarity) return b.similarity - a.similarity;
    const nameA = normalizeName(a.customer.name);
    const nameB = normalizeName(b.customer.name);
    if (nameA !== nameB) return nameA < nameB ? -1 : 1;
    return customerNumberOrZero(a.customer) - customerNumberOrZero(b.customer);
  });

  const max = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : NO_RESULT_HELP_MAX_SUGGESTIONS;
  return scored.slice(0, max).map(({ customer }) => ({
    id: customer.id,
    customerNumber: customer.customerNumber,
    name: customer.name,
  }));
}

/**
 * The no-result panel HTML: the nearest names as tappable chips,
 * then the plain advice. A chip carries the profile action and the
 * customer id, so the sheet's own click delegation opens that
 * customer — the same tap as a result row. With no suggestions the
 * panel says plainly that nothing is close, and still shows the
 * advice. Returns '' when there is no list to render.
 *
 * @param {Array<{id: string, customerNumber: number, name: string}>} suggestions
 * @returns {string}
 */
export function noResultHelpPanelHtml(suggestions) {
  if (!Array.isArray(suggestions)) return '';
  const chips = suggestions.map((suggestion) => `
    <button type="button"
            class="fcs-status-chip"
            data-fcs-action="profile"
            data-customer-id="${escapeHtml(suggestion.id)}"
            title="Open ${escapeHtml(suggestion.name)}">
      #${escapeHtml(String(suggestion.customerNumber))} ${escapeHtml(suggestion.name)}
    </button>`).join('');
  return `
    <div class="fcs-no-result-help" role="status">
      ${suggestions.length > 0
        ? `<p>Did you mean:</p><div class="fcs-filter-row">${chips}</div>`
        : `<p>${escapeHtml(NO_RESULT_HELP_NO_CLOSE_TEXT)}</p>`}
      <p>${escapeHtml(NO_RESULT_HELP_ADVICE)}</p>
    </div>
  `;
}
