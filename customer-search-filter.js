import { canonicalMohalla, DEFAULT_MOHALLAS } from './phase3.js';

/**
 * Owner feature (2026-10-29): field-scoped search for the Customers list and
 * the Mohalla dashboard headcounts.
 *
 * The customers list search box gains a field selector — Name / Mobile /
 * User ID / Area — and the typed query is matched against ONLY the chosen
 * field. All area matching and counting goes through canonicalMohalla
 * (phase3.js, PR #428) so spelling variants such as "Bani" and "BANII"
 * resolve to the same mohalla everywhere.
 */

export const CUSTOMER_SEARCH_FIELDS = Object.freeze([
  { id: 'name', label: 'Name' },
  { id: 'mobile', label: 'Mobile' },
  { id: 'userid', label: 'User ID' },
  { id: 'area', label: 'Area' },
]);

/** Unknown or blank field ids fall back to the historical default: name. */
export function normalizeCustomerSearchField(field) {
  const id = String(field ?? '').trim().toLowerCase();
  return CUSTOMER_SEARCH_FIELDS.some((entry) => entry.id === id) ? id : 'name';
}

/** Digits only — spaces, dashes, parentheses and "+" are all stripped so a
 *  stored "0341-527 7081" and a typed "0341 5277" compare cleanly. */
export function normalizePhoneDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

const normalizedText = (value) => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase();

/**
 * Does one customer match the query under the chosen field only?
 * An empty query matches everyone (the unfiltered list).
 */
export function customerMatchesSearchField(customer, field, query) {
  const rawQuery = String(query ?? '').normalize('NFKC').trim();
  if (!rawQuery) return true;
  if (!customer || typeof customer !== 'object') return false;
  switch (normalizeCustomerSearchField(field)) {
    case 'mobile': {
      const digits = normalizePhoneDigits(rawQuery);
      if (!digits) return false;
      // SISP-143: the landlord/guarantor phone matches here too, under
      // the same digit-normalized partial rule as the customer's own.
      return [customer.phone, customer.customerPhone, customer.landlordPhone]
        .some((value) => normalizePhoneDigits(value).includes(digits));
    }
    case 'userid': {
      // "#102", "102" and "102" all mean customer number 102 — an exact
      // numeric match, so #3 never drags in #13 or #30. Anything else is
      // matched against the record id (e.g. the full displayed id).
      const noHash = rawQuery.replace(/^#\s*/, '').trim();
      if (/^\d+$/.test(noHash)) return Number(customer.customerNumber) === Number(noHash);
      const needle = normalizedText(rawQuery);
      return normalizedText(customer.id).includes(needle)
        || normalizedText(customer.customerNumber) === normalizedText(noHash);
    }
    case 'area': {
      const customerMohalla = canonicalMohalla(customer.mohalla || customer.area || '');
      if (!customerMohalla) return false;
      const queryMohalla = canonicalMohalla(rawQuery);
      if (queryMohalla && customerMohalla.key === queryMohalla.key) return true;
      // Partial typing ("barr") still finds the mohalla by its readable
      // label / canonical spelling even before it resolves canonically.
      const needle = normalizedText(rawQuery);
      return normalizedText(customerMohalla.label).includes(needle)
        || normalizedText(customerMohalla.stored).includes(needle);
    }
    case 'name':
    default: {
      const needle = normalizedText(rawQuery);
      // SISP-143: a Name search also matches the landlord/guarantor
      // name recorded on the tenant's record.
      return [customer.name, customer.nameUrdu, customer.landlordOrGuarantorName]
        .some((value) => normalizedText(value).includes(needle));
    }
  }
}

/** Field-scoped filter over a customer list; blank query = list unchanged. */
export function filterCustomersBySearchField(customers, field, query) {
  const list = Array.isArray(customers) ? customers : [];
  if (!String(query ?? '').trim()) return list.slice();
  return list.filter((customer) => customerMatchesSearchField(customer, field, query));
}

const CANONICAL_ORDER = new Map(DEFAULT_MOHALLAS.map((name, index) => [canonicalMohalla(name)?.key, index]));

/**
 * Mohalla dashboard headcounts: one entry per mohalla that actually has
 * users. Non-archived customers are grouped by canonicalMohalla(mohalla ||
 * area), so variant spellings merge into a single count. A mohalla with
 * zero users produces NO entry (and therefore no card). Customers with no
 * mohalla/area set are counted nowhere — they belong to no mohalla.
 * Non-canonical areas (e.g. HAVELI) still earn their own card under their
 * stored name, because the owner's rule is "cards only where users are".
 * Order: the 15 canonical mohallas in the owner's list order first, then
 * any extra areas by count (desc) and name.
 *
 * @returns {Array<{key: string, label: string, stored: string, count: number, canonical: boolean}>}
 */
export function buildMohallaUserCounts(customers) {
  const list = Array.isArray(customers) ? customers : [];
  const groups = new Map();
  for (const customer of list) {
    if (!customer || customer.archived) continue;
    const canon = canonicalMohalla(customer.mohalla || customer.area || '');
    if (!canon) continue;
    const existing = groups.get(canon.key);
    if (existing) existing.count += 1;
    else groups.set(canon.key, { key: canon.key, label: canon.label, stored: canon.stored, count: 1, canonical: CANONICAL_ORDER.has(canon.key) });
  }
  return [...groups.values()].sort((a, b) => {
    const aOrder = CANONICAL_ORDER.has(a.key) ? CANONICAL_ORDER.get(a.key) : Number.POSITIVE_INFINITY;
    const bOrder = CANONICAL_ORDER.has(b.key) ? CANONICAL_ORDER.get(b.key) : Number.POSITIVE_INFINITY;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return b.count - a.count || a.label.localeCompare(b.label);
  });
}
