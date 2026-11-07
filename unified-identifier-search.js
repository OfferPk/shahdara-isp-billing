/**
 * Plan 456 — One search box for any identifier.
 *
 * The operator at the counter hears one thing first — a name, half a
 * phone number, or an ID off a bill — but the Customers list search
 * made them decide which it was and pick the matching field (Name /
 * Mobile / User ID / Area / Identity) before typing, while the
 * customer waits. The fast customer search sheet already takes any
 * identifier in one box; the list search did not.
 *
 * This module is the missing piece for the list: one classifier and
 * one filter that work out which identifier the typed query is and
 * match it, with name, mohalla and phone shown for every hit by the
 * existing card/table renderers. It stores no new field and never
 * changes any customer, bill, or payment record; searching only reads.
 *
 * How a query is read (the Plan 451 exact-ID rules, reused verbatim
 * — never re-implemented here):
 * - An explicit ID — a leading "#" (the way the app itself writes a
 *   connection ID, "#102") or a dashed id with a digit in it (a UUID,
 *   "seed-001") — matches exactly that record only, case-insensitively
 *   for the record id. No exact hit means no results at all; the
 *   operator said "ID" and the box does not guess a phone instead.
 * - A bare query is tried as an ID first: a full ID ("102", "#102",
 *   "seed-001") returns that one customer alone, never look-alikes.
 *   With no exact hit it falls through to the other branches, exactly
 *   as the fast sheet does — so any digits of a phone number still
 *   find their customer ("5277" finds the phone that contains it)
 *   and a name still finds its customer.
 * - Phone digits are matched digit-normalized (Plan 352): dashes,
 *   spaces, parentheses, a leading "+" and the 0-versus-92 prefix
 *   never hide a match; fewer than three digits is never a phone
 *   search. Only the customer's own numbers match here — the
 *   landlord/guarantor phone belongs to a different person.
 * - Anything else is a name: the list's own name branch (plain
 *   contains over name, nameUrdu and landlord/guarantor name, plus
 *   the father's/reference name, search aliases and Roman-Urdu
 *   phonetic matching from SISP-165).
 *
 * A search with no match says so plainly: an ID-shaped query earns
 * the Plan 451 text ("No customer with ID #999 found. Check the ID
 * and try again."); any other empty search keeps the list's generic
 * hint. A blank query matches everyone, so the unfiltered list is
 * unchanged. Archived customers are not excluded by this helper:
 * callers filter archived/active exactly as they do for the other
 * fields.
 */

import {
  customerIdLookupMatches,
  customerIdLookupIsIdQuery,
  customerIdLookupUnknownText,
  findCustomerById,
} from './customer-id-lookup.js';
import { partialPhoneMatches } from './partial-phone-search.js';
import { customerMatchesSearchField } from './customer-search-filter.js';

/**
 * The field id for the unified box — the "Any identifier" option in
 * the Customers list field select. It is the default: the operator
 * types into one box and never has to pick a field first. The other
 * field options stay for the operator who wants to narrow to one
 * field on purpose.
 */
export const UNIFIED_IDENTIFIER_FIELD_ID = 'any';

const normalizedQuery = (query) => String(query ?? '').normalize('NFKC').trim();

/**
 * Is the typed query explicitly an ID, so only an exact match may
 * answer it? A leading "#" says "connection ID" in the app's own
 * writing, and a dashed id with a digit in it (a UUID, "seed-001")
 * is a record id. Digits with separators only ("0301-2345678") are a
 * phone number, never an ID — the compact form is all digits, so the
 * dashed-id shape does not apply to them.
 */
export function unifiedIdentifierIsExplicitId(query) {
  const needle = normalizedQuery(query);
  if (!needle) return false;
  // A lone "#" names no ID at all.
  if (needle.startsWith('#')) return needle.length > 1;
  const compact = needle.replace(/[\s()+-]/g, '');
  if (/^\d+$/.test(compact)) return false;
  return needle.length >= 4 && needle.includes('-') && /\d/.test(needle) && /^[0-9a-z-]+$/.test(needle.toLocaleLowerCase());
}

/**
 * Does one customer match the query in the unified box? An explicit
 * ID ("#102", a UUID, "seed-001") matches exactly that record only
 * (Plan 451); a bare query matches its exact-ID customer first, then
 * falls through to any digits of the phone number (Plan 352) or the
 * name branch (SISP-165). A blank query matches everyone.
 */
export function unifiedIdentifierMatches(customer, query) {
  const needle = normalizedQuery(query);
  if (!needle) return true;
  if (!customer || typeof customer !== 'object') return false;
  // An explicit ID is answered by the exact match alone — the box
  // never guesses a phone number for a query the operator marked
  // as an ID.
  if (unifiedIdentifierIsExplicitId(needle)) return customerIdLookupMatches(customer, needle);
  // A bare query is checked against the exact ID first, so #102
  // matches "102" even when its phone does not contain 102. (The
  // list filter returns an exact hit alone; this predicate only
  // answers for one customer at a time.)
  if (customerIdLookupIsIdQuery(needle) && customerIdLookupMatches(customer, needle)) return true;
  // Plan 352: digit-normalized partial phone — the typed digits
  // match any substring of the stored number, whatever the stored
  // or typed formatting. The landlord/guarantor phone is not
  // matched here; it belongs to a different person.
  if (partialPhoneMatches(customer, needle)) return true;
  // The list's own name branch: plain contains over name, nameUrdu
  // and landlord/guarantor name, plus the father's/reference name,
  // search aliases and Roman-Urdu phonetic matching (SISP-165).
  return customerMatchesSearchField(customer, 'name', needle);
}

/**
 * The unified filter over a customer list; blank query = list
 * unchanged (a new array, same order, same records). An exact-ID hit
 * is the whole answer; otherwise the fall-through branches decide.
 * The input list is never mutated and no record is changed.
 */
export function filterCustomersByUnifiedIdentifier(customers, query) {
  const list = Array.isArray(customers) ? customers : [];
  const needle = normalizedQuery(query);
  if (!needle) return list.slice();
  // An explicit ID answers exactly or not at all — the box never
  // guesses a phone number for a query the operator marked as an ID.
  if (unifiedIdentifierIsExplicitId(needle)) {
    const hit = findCustomerById(list, needle);
    return hit ? [hit] : [];
  }
  // A bare query is tried as a full ID first (Plan 451): "102"
  // returns #102 alone and never drags in #1021. With no exact hit
  // it falls through, exactly as the fast sheet does, so phone
  // digits and names still find their customer from the same box.
  if (customerIdLookupIsIdQuery(needle)) {
    const hit = findCustomerById(list, needle);
    if (hit) return [hit];
  }
  return list.filter((customer) => unifiedIdentifierMatches(customer, needle));
}

/**
 * The plain message for an empty unified search: an ID-shaped query
 * earns the Plan 451 unknown-ID text; any other query earns '' and
 * the caller keeps the list's generic hint.
 */
export function unifiedIdentifierEmptyText(query) {
  const needle = normalizedQuery(query);
  if (!needle) return '';
  return customerIdLookupIsIdQuery(needle) ? customerIdLookupUnknownText(needle) : '';
}
