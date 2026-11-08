/*
 * Plan 469 — Find customers by dues band.
 *
 * The owner wants the customers who owe a lot — everyone over
 * Rs 2,000, say — but the customer list could not be filtered by
 * how much is owed, so the big dues had to be found by opening
 * profiles one by one. This module is the missing piece: one
 * dues-band filter with four bands that lists every customer whose
 * dues fall inside the chosen band, with name, mohalla, and dues.
 *
 * The four bands, in plain words, with the boundary in exact cents
 * so a half-rupee never lands in the wrong band:
 *
 * - none: owes nothing (dues are zero).
 * - up-to-1000: owes up to Rs 1,000 (more than zero, at most
 *   Rs 1,000 — a customer owing exactly Rs 1,000 sits here).
 * - 1001-2000: owes Rs 1,001 to Rs 2,000 (more than Rs 1,000, at
 *   most Rs 2,000 — a customer owing exactly Rs 2,000 sits here).
 * - over-2000: owes more than Rs 2,000.
 *
 * The dues figure is the sheet's own figure — the allocation
 * engine's positive bill balances summed over the customer's bills,
 * read through the Plan 452 status filter's dues helper, never
 * re-derived here. A manual baqaya is a separate record the sheet
 * does not display, so it is not part of this figure; the card and
 * the band agree exactly, the same rule the status filter uses.
 * The band total is the sum of the listed customers' dues, in
 * cents, so the sheet's total and this module's total agree.
 *
 * The module is pure and reads only: it takes customer records and
 * the context the sheet already computes (the allocation engine)
 * and returns the band, the match, or the total. It never changes
 * any customer, bill, or payment record, adds no new field, and
 * keeps no store.
 */

// The dues figure the sheet shows, reused from the Plan 452 status
// filter — the allocation engine's positive balanceDueCents summed
// over the customer's bills.
import { customerStatusDuesCents } from './customer-status-filter.js';

// Plan 469: the four bands, in the order the sheet shows them.
export const DUES_BAND_FILTERS = Object.freeze([
  'none',
  'up-to-1000',
  '1001-2000',
  'over-2000',
]);

// Band edges in exact integer cents — a half-rupee due (Rs 1,000.50)
// sits above Rs 1,000, never in the up-to-1000 band.
const UP_TO_1000_MAX_CENTS = 100000;
const BAND_2000_MAX_CENTS = 200000;

/** Unknown, blank, or missing values fall back to the full list. */
export function normalizeDuesBandFilter(value) {
  const id = String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase();
  return DUES_BAND_FILTERS.includes(id) ? id : 'all';
}

/** The label the sheet shows for one band. */
export function duesBandFilterLabel(filter) {
  switch (normalizeDuesBandFilter(filter)) {
    case 'none': return 'Owes nothing';
    case 'up-to-1000': return 'Up to Rs 1,000';
    case '1001-2000': return 'Rs 1,001–2,000';
    case 'over-2000': return 'Over Rs 2,000';
    default: return 'All';
  }
}

/**
 * Which band does one dues figure fall in? The figure is in cents;
 * a missing or unusable figure is nothing owed. Zero (or less)
 * is the nothing band; the edges are inclusive at the top, so
 * exactly Rs 1,000 is up-to-1000 and exactly Rs 2,000 is
 * 1001-2000.
 */
export function duesBandForCents(duesCents) {
  const cents = typeof duesCents === 'number' && Number.isFinite(duesCents) ? duesCents : 0;
  if (cents <= 0) return 'none';
  if (cents <= UP_TO_1000_MAX_CENTS) return 'up-to-1000';
  if (cents <= BAND_2000_MAX_CENTS) return '1001-2000';
  return 'over-2000';
}

/**
 * Does one customer belong to the chosen band? The context carries
 * what the sheet already computes: the allocation engine — never a
 * clock or storage. An unknown filter is the full list.
 */
export function duesBandFilterMatches(customer, filter, context = {}) {
  const wanted = normalizeDuesBandFilter(filter);
  if (wanted === 'all') return true;
  if (!customer || typeof customer !== 'object') return false;
  const duesCents = customerStatusDuesCents(customer, context?.allocations ?? null);
  return duesBandForCents(duesCents) === wanted;
}

/** The customers in the chosen band, in list order; a non-list is empty. */
export function filterCustomersByDuesBand(customers, filter, context = {}) {
  const list = Array.isArray(customers) ? customers : [];
  const wanted = normalizeDuesBandFilter(filter);
  if (wanted === 'all') return list.slice();
  return list.filter((customer) => duesBandFilterMatches(customer, wanted, context));
}

/**
 * The band total: the sum of the listed customers' dues, in cents.
 * The total of a band equals the sum of the dues of exactly the
 * customers the band lists — a band with nobody in it totals zero,
 * never a blank.
 */
export function duesBandTotalCents(customers, filter, context = {}) {
  const listed = filterCustomersByDuesBand(customers, filter, context);
  let total = 0;
  for (const customer of listed) {
    total += customerStatusDuesCents(customer, context?.allocations ?? null);
  }
  return total;
}
