/*
 * Plan 457 — relevance ranking for customer search results.
 *
 * A name search used to return every partial match in the order the
 * caller happened to sort it — dues first on the fast sheet, the
 * roster sort on the Customers list — so the exact customer the
 * operator wants could sit below several look-alikes and had to be
 * picked out by eye. This module ranks a matched list by how well
 * each name answers the typed text, best first:
 *
 *   exact name, then a name starting with the typed text, then a
 *   name containing it, then a nickname match (a father / reference
 *   name or a search alias), then anything that matched by another
 *   field (phone, number, area, address, identity), which keeps the
 *   order it arrived in.
 *
 * The ranking is pure and reads only: it takes the matched customers
 * and the query and returns a new array of the same records in
 * ranked order. It never changes any customer, bill, or payment
 * record, adds no new field, and keeps no store. Ties inside the
 * name tiers fall back to name order with the customer number as
 * the tiebreak, the same order the name-prefix lookup uses. A blank
 * query returns the list unchanged — there is nothing to rank.
 *
 * The tiers reuse the existing phonetic matcher for the spelling
 * variants it already knows: a typed "Fesal" still finds a "Faisal",
 * but only as a name match (never as an exact match — a literal
 * "Fesal" on the list always outranks it). The formal name is
 * checked on its own first, so a match that only arrives through
 * the father / reference name or an alias lands in the nickname
 * tier even when the query also brushes the formal name.
 */

import { fuzzyCustomerNameMatches } from './fuzzy-alias-search.js';

/** The relevance tiers, best first. */
export const SEARCH_RESULT_RANK_EXACT = 0;
export const SEARCH_RESULT_RANK_PREFIX = 1;
export const SEARCH_RESULT_RANK_CONTAINS = 2;
export const SEARCH_RESULT_RANK_NICKNAME = 3;
export const SEARCH_RESULT_RANK_OTHER = 4;

const normalizedText = (value) => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase();

const collapseSpaces = (value) => normalizedText(value).replace(/\s+/g, ' ');

/** The Plan 427 name-order key: NFKC, trimmed, single-spaced, lowercased. */
const normalizeName = (value) => collapseSpaces(value);

function customerNumberOrZero(customer) {
  const number = Number(customer?.customerNumber);
  return Number.isFinite(number) ? number : 0;
}

/** The alias texts as a list, whatever shape the record stores them in. */
function aliasTexts(customer) {
  const aliases = customer?.searchAliases;
  if (Array.isArray(aliases)) return aliases;
  if (typeof aliases === 'string') return aliases.split(',');
  return [];
}

/** The formal name texts, in display order: the name, then the Urdu name. */
function formalNameTexts(customer) {
  return [customer?.name, customer?.nameUrdu]
    .map((value) => collapseSpaces(value))
    .filter(Boolean);
}

/**
 * How well one customer answers the typed text, best first:
 * exact formal name, formal name starting with the text, formal
 * name containing it (or matching it phonetically — the spelling
 * variants the phonetic matcher already knows), a nickname match
 * through the father / reference name, a search alias, or the
 * landlord / guarantor name, and finally anything that matched by
 * another field, which carries no name relevance at all. A blank
 * query or a missing record has no relevance.
 */
export function customerSearchRank(customer, query) {
  const needle = collapseSpaces(query);
  if (!needle || !customer || typeof customer !== 'object') return SEARCH_RESULT_RANK_OTHER;
  const names = formalNameTexts(customer);
  if (names.some((name) => name === needle)) return SEARCH_RESULT_RANK_EXACT;
  if (names.some((name) => name.startsWith(needle))) return SEARCH_RESULT_RANK_PREFIX;
  if (names.some((name) => name.includes(needle))) return SEARCH_RESULT_RANK_CONTAINS;
  // The formal name matched phonetically but not literally ("Fesal"
  // finds "Faisal", "M. Aslam" finds "Muhammad Aslam"): a name
  // match, ranked below every literal contains.
  if (fuzzyCustomerNameMatches({ name: customer.name, nameUrdu: customer.nameUrdu }, query)) {
    return SEARCH_RESULT_RANK_CONTAINS;
  }
  // The match arrived through the father / reference name or a search
  // alias — the pooled matcher finds it — or through the landlord /
  // guarantor name, which the list's name branch matches by plain
  // contains. Either way it is a nickname match, never a name match.
  if (fuzzyCustomerNameMatches(customer, query)) return SEARCH_RESULT_RANK_NICKNAME;
  const nicknameTexts = [
    customer?.fatherOrReferenceName,
    ...aliasTexts(customer),
    customer?.landlordOrGuarantorName,
  ];
  if (nicknameTexts.some((value) => normalizedText(value).includes(needle))) {
    return SEARCH_RESULT_RANK_NICKNAME;
  }
  return SEARCH_RESULT_RANK_OTHER;
}

/**
 * Rank a matched customer list by relevance to the typed query.
 * The input list is never mutated and no record is changed: the
 * returned array holds the same record references in ranked order.
 * Ties inside the name tiers fall back to name order (same name
 * twice lists both, the lower customer number first); results with
 * no name relevance keep the order they arrived in, so a caller's
 * own ordering (dues first, the roster sort) still governs them.
 * A blank query returns the list unchanged.
 */
export function rankCustomerSearchResults(customers, query) {
  const list = Array.isArray(customers) ? customers.slice() : [];
  if (!collapseSpaces(query)) return list;
  const decorated = list.map((customer, index) => ({
    customer,
    index,
    rank: customerSearchRank(customer, query),
  }));
  decorated.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.rank === SEARCH_RESULT_RANK_OTHER) return a.index - b.index;
    const byName = normalizeName(a.customer?.name).localeCompare(normalizeName(b.customer?.name), 'en');
    if (byName !== 0) return byName;
    return customerNumberOrZero(a.customer) - customerNumberOrZero(b.customer);
  });
  return decorated.map((entry) => entry.customer);
}
