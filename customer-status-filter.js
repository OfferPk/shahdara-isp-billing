// The due date and the day count are the app's own rules, reused
// from the dues-aging module — never re-derived here.
import { parseBillDueDate, calculateDaysOverdue } from './dashboard-dues-aging.js';

/**
 * Plan 452 — Search customers by status.
 *
 * The operator often needs all the customers in one state — everyone
 * overdue, everyone paid up, everyone suspended, everyone new — but
 * the fast customer search sheet only filtered by the current month's
 * billing chips (Pending / Partial / Paid), so each list had to be
 * built by eye. This module is the missing piece: one status filter
 * with five states that lists every customer in the chosen state with
 * name, mohalla, and dues.
 *
 * The five states, all read from the app's own existing rules — no
 * status is invented here and no status rule is changed:
 *
 * - paid up: nothing owed. The customer owes nothing on any open bill
 *   balance — the same dues figure the search card itself shows (the
 *   allocation engine's balanceDueCents summed over bills). A manual
 *   baqaya is a separate record the sheet does not display, so it is
 *   not part of this figure; the card and the filter agree exactly.
 * - due: owes money, but no bill is past its due date yet.
 * - overdue: at least one bill still owes money past its due date.
 *   The due date is the app's own rule (the dues-aging module):
 *   the bill's explicit dueDate, else the 10th of the bill month, and
 *   a bill is overdue only once that calendar day has passed in
 *   Pakistan time. A bill due today is due, not overdue.
 * - suspended: the customer holds an OPEN suspension record (Plan 83)
 *   — a closed suspension does not count. The
 *   open suspension ids are caller-supplied, exactly like Plan 449's
 *   caller-supplied billing links: this module reads no storage and
 *   never opens, closes, or changes any suspension.
 * - new: the customer was added in the current month (the record's
 *   addedOn date falls in the reference month) — the same "new
 *   customers this month" meaning the programme uses elsewhere.
 *   A record with no addedOn is never new.
 *
 * The states are not all mutually exclusive, and the filter does not
 * pretend they are: paid up / due / overdue are one dues state each
 * (overdue wins over due when a customer owes both a past-due bill
 * and a not-yet-due one), while suspended and new are independent —
 * a suspended customer who also owes past-due money appears under
 * both "suspended" and "overdue", and a new customer who already owes
 * appears under both "new" and "due". Choosing one state lists
 * exactly the customers in that state and no others; clearing the
 * filter ("all") returns the full list. The filter never changes any
 * customer, bill, payment, or suspension record.
 */

// Plan 452: the five states, in the order the sheet shows them.
export const CUSTOMER_STATUS_FILTERS = Object.freeze([
  'paid-up',
  'due',
  'overdue',
  'suspended',
  'new',
]);

/** Unknown, blank, or missing values fall back to the full list. */
export function normalizeCustomerStatusFilter(value) {
  const id = String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase();
  return CUSTOMER_STATUS_FILTERS.includes(id) ? id : 'all';
}

/** The label the sheet shows for one state. */
export function customerStatusFilterLabel(filter) {
  switch (normalizeCustomerStatusFilter(filter)) {
    case 'paid-up': return 'Paid up';
    case 'due': return 'Due';
    case 'overdue': return 'Overdue';
    case 'suspended': return 'Suspended';
    case 'new': return 'New';
    default: return 'All';
  }
}

/**
 * The dues figure the search card shows for one customer: the sum of
 * the allocation engine's positive balanceDueCents over the
 * customer's bills. A null balance (an unpriced bill) contributes
 * nothing, exactly as the sheet computes it today.
 */
export function customerStatusDuesCents(customer, allocations) {
  if (!customer || typeof customer !== 'object') return 0;
  const bills = Array.isArray(customer.bills) ? customer.bills : [];
  let total = 0;
  for (const bill of bills) {
    const summary = allocations?.forMonth?.(customer.id, bill.month);
    const balance = summary?.balanceDueCents;
    if (typeof balance === 'number' && balance > 0) total += balance;
  }
  return total;
}

/**
 * Does the customer still owe money on a bill past its due date?
 * The due date and the day count are the app's own rules, reused
 * from the dues-aging module — never re-derived here.
 */
export function customerHasOverdueBill(customer, allocations, referenceDate) {
  if (!customer || typeof customer !== 'object') return false;
  const bills = Array.isArray(customer.bills) ? customer.bills : [];
  for (const bill of bills) {
    const summary = allocations?.forMonth?.(customer.id, bill.month);
    const balance = summary?.balanceDueCents;
    if (typeof balance !== 'number' || balance <= 0) continue;
    if (calculateDaysOverdue(parseBillDueDate(bill), referenceDate) > 0) return true;
  }
  return false;
}

/**
 * Does the customer hold an open suspension? The caller supplies the
 * ids of customers with an open suspension record (Plan 83); a list,
 * a Set, or anything else is accepted, and anything unusable means
 * nobody is suspended. Closed suspensions never reach this module.
 */
export function customerIsSuspended(customer, suspendedCustomerIds) {
  if (!customer || typeof customer !== 'object') return false;
  if (Array.isArray(suspendedCustomerIds)) return suspendedCustomerIds.includes(customer.id);
  if (suspendedCustomerIds instanceof Set) return suspendedCustomerIds.has(customer.id);
  return false;
}

/**
 * Was the customer added in the current month? The record's addedOn
 * date (set when the customer is added) falls in the reference month
 * given as 'YYYY-MM'. A record with no usable addedOn is never new.
 */
export function customerIsNew(customer, currentMonth) {
  if (!customer || typeof customer !== 'object') return false;
  const month = String(currentMonth ?? '').trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return false;
  const addedOn = String(customer.addedOn ?? '').trim();
  if (addedOn.length < 7) return false;
  return addedOn.slice(0, 7) === month;
}

/**
 * Does one customer belong to the chosen state? The context carries
 * what the sheet already computes: the allocation engine, the open
 * suspension ids, and the current month — never a clock or storage.
 * An unknown filter is the full list.
 */
export function customerStatusFilterMatches(customer, filter, context = {}) {
  const wanted = normalizeCustomerStatusFilter(filter);
  if (wanted === 'all') return true;
  if (!customer || typeof customer !== 'object') return false;
  const allocations = context?.allocations ?? null;
  const referenceDate = context?.referenceDate;
  if (wanted === 'suspended') return customerIsSuspended(customer, context?.suspendedCustomerIds);
  if (wanted === 'new') return customerIsNew(customer, context?.currentMonth);
  if (wanted === 'overdue') return customerHasOverdueBill(customer, allocations, referenceDate);
  const duesCents = customerStatusDuesCents(customer, allocations);
  if (wanted === 'paid-up') return duesCents === 0;
  // 'due': owes money, but no bill is past its due date — an overdue
  // bill puts the customer under 'overdue' instead.
  return duesCents > 0 && !customerHasOverdueBill(customer, allocations, referenceDate);
}

/** The customers in the chosen state, in list order; a non-list is empty. */
export function filterCustomersByStatus(customers, filter, context = {}) {
  const list = Array.isArray(customers) ? customers : [];
  const wanted = normalizeCustomerStatusFilter(filter);
  if (wanted === 'all') return list.slice();
  return list.filter((customer) => customerStatusFilterMatches(customer, wanted, context));
}
