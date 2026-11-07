/**
 * Plan 451 — Search customer by customer ID or connection ID.
 *
 * A customer quotes their ID from a bill or a receipt — the record ID
 * (the full displayed id, e.g. "seed-001" or a UUID) or the connection
 * ID (the customer number shown as #102) — but the fast customer
 * search sheet only accepted names and phone numbers for finding a
 * customer: it matched a typed number only as a substring, so "102"
 * dragged in #102, #1021 and #2102 together, and it never matched the
 * record id at all. The field-scoped Customers list search does have
 * an exact User ID field, but the counter sheet — where an ID is
 * actually quoted — had no exact-ID path.
 *
 * This module is the missing piece for that sheet: one exact ID lookup
 * that accepts a customer ID or a connection ID and returns that one
 * customer and no other. A connection ID is the customer number
 * (the same number the bulk import reads from a "connectionid" column
 * and the billing links store as a connectionId), a customer ID is the
 * record id. The lookup reads IDs only and stores no new field; it
 * never changes any customer, bill, or payment record, and searching
 * never changes any record.
 *
 * Matching is exact on purpose: a numeric query matches only the
 * customer whose number equals it ("#102", "102" and " 102 " all mean
 * 102, and #102 never drags in #1021), and a record-id query matches
 * only the record whose id equals it, case-insensitively. Anything
 * without an exact hit falls through to the sheet's existing partial
 * matching unchanged — an exact hit only ever narrows results, never
 * widens them.
 *
 * An unknown ID says so plainly: a query shaped like an ID (a short
 * number, or a dashed id such as a UUID or "seed-001") that matches
 * nobody earns the plain "No customer with ID … found" text instead
 * of the generic empty state. A full phone number is not an ID query,
 * so a phone lookup that finds nobody keeps the generic hint.
 */

// Plan 451: one leading "#" (with optional spaces after it) is the
// way the app itself writes a connection ID, so "#102" and "102"
// mean the same lookup.
export function normalizeCustomerIdQuery(query) {
  return String(query ?? '').normalize('NFKC').trim().replace(/^#\s*/, '').trim().toLocaleLowerCase();
}

/** A query that is only digits, after the "#" is stripped, is a
 *  connection-ID query: the customer number it names. */
export function customerIdLookupIsConnectionId(query) {
  const needle = normalizeCustomerIdQuery(query);
  return needle !== '' && /^\d+$/.test(needle);
}

/**
 * Does one customer exactly match the typed ID? A numeric query
 * matches only the customer whose number equals it; any other query
 * matches only the record whose id equals it, case-insensitively.
 * A blank query, a missing record, or a record with no usable id or
 * number never matches.
 */
export function customerIdLookupMatches(customer, query) {
  const needle = normalizeCustomerIdQuery(query);
  if (!needle || !customer || typeof customer !== 'object') return false;
  if (/^\d+$/.test(needle)) {
    const stored = customer.customerNumber;
    if (stored === null || stored === undefined || String(stored).trim() === '') return false;
    return Number(stored) === Number(needle);
  }
  const storedId = String(customer.id ?? '').normalize('NFKC').trim().toLocaleLowerCase();
  return storedId !== '' && storedId === needle;
}

/**
 * The one customer whose ID exactly matches the query, or null when
 * the query is blank, unknown, or not a list. The first exact match
 * wins; IDs are unique, so there is never a second one.
 */
export function findCustomerById(customers, query) {
  const list = Array.isArray(customers) ? customers : [];
  if (!normalizeCustomerIdQuery(query)) return null;
  return list.find((customer) => customerIdLookupMatches(customer, query)) ?? null;
}

/**
 * Is the typed query shaped like an ID at all? A short number is a
 * connection ID; a dashed id with a digit in it (a UUID, "seed-001")
 * is a record ID. A full phone number (ten or more digits, with or
 * without dashes) is not an ID query, and neither is a name — those
 * keep the sheet's generic empty text.
 */
export function customerIdLookupIsIdQuery(query) {
  const needle = normalizeCustomerIdQuery(query);
  if (!needle) return false;
  if (/^\d+$/.test(needle)) return needle.length <= 6;
  // A full phone number is digits with separators only (ten or more
  // digits, no letters) — not an ID query. A UUID carries letters
  // too, so it is not caught by this guard.
  const compact = needle.replace(/[\s()+-]/g, '');
  if (/^\d+$/.test(compact) && compact.length >= 10) return false;
  return needle.length >= 4 && needle.includes('-') && /\d/.test(needle) && /^[0-9a-z-]+$/.test(needle);
}

/** The plain message for an unknown ID: the ID as typed, with the
 *  "#" the app itself uses for a connection ID. */
export function customerIdLookupUnknownText(query) {
  const needle = normalizeCustomerIdQuery(query);
  const display = /^\d+$/.test(needle) ? `#${needle}` : needle;
  return `No customer with ID ${display} found. Check the ID and try again.`;
}

/**
 * Enter on an exact-ID lookup opens the matching customer directly:
 * exactly one result, and that result is the exact ID match. Any
 * other single result keeps the sheet's usual Enter action.
 */
export function customerIdLookupOpensProfileDirectly(query, results) {
  if (!Array.isArray(results) || results.length !== 1) return false;
  return customerIdLookupMatches(results[0], query);
}
