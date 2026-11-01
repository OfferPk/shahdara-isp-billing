import { canonicalMohalla, DEFAULT_MOHALLAS } from './phase3.js';
import { fuzzyCustomerNameMatches } from './fuzzy-alias-search.js';

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
      if ([customer.name, customer.nameUrdu, customer.landlordOrGuarantorName]
        .some((value) => normalizedText(value).includes(needle))) return true;
      // SISP-165: the father's/reference name and the search aliases are
      // part of Name search, and Roman-Urdu spelling variants match
      // phonetically ("Fesal" finds "Faisal", "M. Aslam" finds
      // "Muhammad Aslam"). Urdu-script queries keep the plain contains
      // path inside the matcher. Mobile / User ID / Area are untouched.
      return fuzzyCustomerNameMatches(customer, rawQuery);
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

/**
 * SISP-175: the money/mix figures behind each Mohalla dashboard card —
 * the same rows, in the same order, with the same visibility rule as
 * buildMohallaUserCounts (a row exists only where users are; archived
 * excluded), extended per mohalla with:
 *
 * - unpaidPKR: LIVE total outstanding — the sum, over every bill of
 *   every non-archived, non-free customer in the mohalla, of the
 *   allocation engine's balanceDueCents (allocations.forMonth), the
 *   exact per-bill field getPendingCollectionCustomers (Quick Collect /
 *   Field Mode) sums into its totalDues. A null balance (unpriced bill)
 *   contributes 0, exactly as there. Nothing is stored; the figure is
 *   re-derived from the passed-in allocations on every render.
 * - freeCount: customers with isFreeConnection === true. FREE
 *   connections are skipped for dues entirely (owner rule 2026-10-29:
 *   a free connection never owes — bill generation never bills them,
 *   and Top Defaulters skip them explicitly; mirrored here). They DO
 *   still count in `count`, exactly as buildMohallaUserCounts counts
 *   them today — card visibility is unchanged.
 * - paidPct: of the mohalla's BILLED customers for `currentMonth`
 *   (non-archived, non-free, holding a PRICED bill for that month —
 *   the engine summary has a non-null billAmountCents), the percentage
 *   whose balance for that month is fully settled (balanceDueCents
 *   === 0, by cash and/or credit). FREE customers are neither paid nor
 *   unpaid, so they enter neither side. A customer can be "paid" for
 *   the cycle while still owing older arrears — that money shows in
 *   unpaidPKR, not here. null when nobody in the mohalla is billed
 *   for the month (nothing honest to show but a dash).
 *
 * @param {Array} customers
 * @param {{forMonth?: Function}} allocations - calculatePaymentAllocations(state)
 * @param {string} currentMonth - 'YYYY-MM'
 * @returns {Array<{key, label, stored, count, canonical, unpaidPKR: number, freeCount: number, billedCount: number, paidCount: number, paidPct: number|null}>}
 */
export function buildMohallaCardStats(customers, allocations, currentMonth) {
  const rows = buildMohallaUserCounts(customers);
  const buckets = new Map(rows.map((row) => [row.key, { unpaidCents: 0, freeCount: 0, billedCount: 0, paidCount: 0 }]));
  const month = String(currentMonth ?? '');
  const list = Array.isArray(customers) ? customers : [];
  for (const customer of list) {
    if (!customer || customer.archived) continue;
    const canon = canonicalMohalla(customer.mohalla || customer.area || '');
    if (!canon) continue;
    const bucket = buckets.get(canon.key);
    if (!bucket) continue;
    if (customer.isFreeConnection === true) {
      bucket.freeCount += 1;
      continue;
    }
    const bills = Array.isArray(customer.bills) ? customer.bills : [];
    for (const bill of bills) {
      const summary = allocations?.forMonth?.(customer.id, bill.month);
      const balance = summary?.balanceDueCents;
      if (typeof balance === 'number' && balance > 0) bucket.unpaidCents += balance;
      if (month && bill.month === month && summary && summary.billAmountCents !== null && summary.billAmountCents !== undefined) {
        bucket.billedCount += 1;
        if (balance === 0) bucket.paidCount += 1;
      }
    }
  }
  return rows.map((row) => {
    const bucket = buckets.get(row.key);
    return {
      ...row,
      unpaidPKR: Math.round(bucket.unpaidCents / 100),
      freeCount: bucket.freeCount,
      billedCount: bucket.billedCount,
      paidCount: bucket.paidCount,
      paidPct: bucket.billedCount > 0 ? Math.round((bucket.paidCount / bucket.billedCount) * 100) : null,
    };
  });
}
