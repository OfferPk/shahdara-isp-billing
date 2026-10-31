/**
 * star-subscribers.js — SISP-120: Star Timely Payer recognition.
 *
 * The star is a pure, live derivation from the saved ledger. It is never
 * stored on the customer, so voiding a receipt (SISP-34), recording a late
 * completion, or breaking a Waada removes it on the next render without a
 * migration or a second balance.
 *
 * Streak rule (explicit):
 * - Only the three completed calendar months immediately before the
 *   reference month are evaluated. The current, in-progress month neither
 *   earns nor breaks the streak.
 * - Each evaluated month must have a priced bill and that bill must be
 *   fully paid under core's allocation engine (derivedBillStatus).
 * - A month is timely when the last settlement contribution the engine
 *   actually used carries a recorded date on or before the 10th of that
 *   bill month. Contributions are the engine's carry-forward credit
 *   sources (whose recorded date is the original advance/receipt date),
 *   same-month receipt and discount allocations, and — only for any
 *   remaining balance the allocation summary cannot account for — the
 *   bill's audited waiver/offset stamps and their AppliedAt dates. An
 *   advance therefore completes a later bill on the date the advance was
 *   recorded, not on the later bill's generation date.
 * - A missing bill in one of the three completed months breaks the
 *   streak, including a paused/skipped month. Months before the customer
 *   existed simply are not there yet, so a newer customer cannot have
 *   the required three completed billed months.
 * - Any positive engine balance on a completed bill month (including an
 *   older month outside the three-month window) is completed arrears and
 *   blocks the star. The in-progress month's balance is not arrears for
 *   this recognition rule.
 *
 * Broken Waadas are counted by SISP-98's computeWaadaScore
 * (waada-queue.js) — the single house definition: a non-voided payment
 * whose clearedWaada stamp was paid after the stamped promiseDate is
 * broken, plus the customer's live promise when its tier is broken,
 * judged against the total outstanding over priced bills computed
 * below. (This module originally mirrored that definition locally from
 * the recorded primitives; the SISP-120 reconciliation replaced the
 * mirror with the shared function — see brokenWaadaCount.)
 */
import { calculatePaymentAllocations, derivedBillStatus } from './core.js';
import { computeWaadaScore, getWaadaTodayString, isValidWaadaDate } from './waada-queue.js';
import { t } from './nav-language.js';

export const STAR_TIMELY_PAYER_REQUIRED_MONTHS = 3;
export const STAR_TIMELY_PAYER_DEADLINE_DAY = 10;

const validMonth = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value ?? ''));
const cents = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
};
const datePart = (value) => {
  if (typeof value !== 'string') return null;
  const date = value.trim().slice(0, 10);
  return isValidWaadaDate(date) ? date : null;
};

function referenceDateString(referenceDate = new Date()) {
  if (typeof referenceDate === 'string' && isValidWaadaDate(referenceDate.trim())) {
    return referenceDate.trim();
  }
  return getWaadaTodayString(referenceDate instanceof Date ? referenceDate : new Date());
}

function monthIndex(month) {
  const [year, mon] = String(month).split('-').map(Number);
  return year * 12 + (mon - 1);
}

function monthAtIndex(index) {
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

function resolveCustomer(state, customerInput) {
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  if (typeof customerInput === 'string') {
    return customers.find((customer) => customer?.id === customerInput) ?? null;
  }
  if (!customerInput || typeof customerInput !== 'object') return null;
  return customers.find((customer) => customer === customerInput)
    ?? (customerInput.id ? customers.find((customer) => customer?.id === customerInput.id) : null)
    ?? (Number.isSafeInteger(customerInput.customerNumber)
      ? customers.find((customer) => customer?.customerNumber === customerInput.customerNumber)
      : null)
    ?? customerInput;
}

function waiverStampContributions(bill, remainingCents) {
  const stamps = [
    { amount: bill?.depositOffsetAmount, date: bill?.depositOffsetAppliedAt },
    { amount: bill?.concessionAmount, date: bill?.concessionAppliedAt },
    { amount: bill?.referralCreditAmount, date: bill?.referralCreditAppliedAt }
  ];
  const contributions = [];
  let remaining = Math.max(0, remainingCents);
  for (const stamp of stamps) {
    if (remaining <= 0) break;
    const appliedCents = Math.min(Math.max(0, cents(stamp.amount)), remaining);
    if (appliedCents <= 0) continue;
    contributions.push({ amountCents: appliedCents, date: datePart(stamp.date), kind: 'bill-stamp' });
    remaining -= appliedCents;
  }
  return contributions;
}

/**
 * Settlement detail for one bill under an already-computed allocation
 * result. completionDate is the latest recorded date among the settlement
 * contributions the engine actually used; it is null when a paid bill's
 * provenance is incomplete, in which case timely is honestly false.
 */
export function starBillSettlement(customer, bill, allocations) {
  if (!customer || !bill || !validMonth(bill.month)) {
    return {
      month: validMonth(bill?.month) ? bill.month : null,
      billPresent: Boolean(bill),
      priced: false,
      status: 'not-set',
      completionDate: null,
      timely: false
    };
  }

  const summary = allocations?.forMonth?.(customer.id, bill.month) ?? null;
  const status = derivedBillStatus(customer, bill, allocations);
  const priced = Boolean(summary && summary.billAmountCents !== null && summary.billAmountCents !== undefined);
  if (!priced || status !== 'paid') {
    return { month: bill.month, billPresent: true, priced, status, completionDate: null, timely: false };
  }

  const contributions = [];
  let allocatedCents = 0;

  for (const source of Array.isArray(summary.creditSources) ? summary.creditSources : []) {
    const amountCents = Math.max(0, Number(source?.amountCents) || 0);
    if (amountCents <= 0) continue;
    allocatedCents += amountCents;
    contributions.push({ amountCents, date: datePart(source.paymentDate), kind: 'carry-forward-credit' });
  }

  const payments = [...(Array.isArray(bill.payments) ? bill.payments : [])]
    .filter((payment) => payment?.voided !== true)
    .sort((a, b) => String(a?.date ?? '').localeCompare(String(b?.date ?? '')) || String(a?.id ?? '').localeCompare(String(b?.id ?? '')));
  for (const payment of payments) {
    const ledger = allocations?.byPaymentId?.get?.(payment.id);
    if (!ledger || ledger.customerId !== customer.id) continue;
    for (const allocation of Array.isArray(ledger.allocations) ? ledger.allocations : []) {
      if (allocation?.month !== bill.month) continue;
      if (allocation.kind !== 'same-month' && allocation.kind !== 'discount') continue;
      const amountCents = Math.max(0, Number(allocation.amountCents) || 0);
      if (amountCents <= 0) continue;
      allocatedCents += amountCents;
      contributions.push({ amountCents, date: datePart(payment.date), kind: allocation.kind });
    }
  }

  const unaccountedCents = Math.max(0, Number(summary.billAmountCents) - allocatedCents);
  if (unaccountedCents > 0) contributions.push(...waiverStampContributions(bill, unaccountedCents));

  const accountedCents = contributions.reduce((sum, item) => sum + item.amountCents, 0);
  const completionDate = accountedCents >= Number(summary.billAmountCents)
    && contributions.length > 0
    && contributions.every((item) => item.date)
    ? contributions.map((item) => item.date).sort().at(-1)
    : null;

  return {
    month: bill.month,
    billPresent: true,
    priced: true,
    status,
    completionDate,
    timely: Boolean(completionDate && completionDate <= `${bill.month}-${String(STAR_TIMELY_PAYER_DEADLINE_DAY).padStart(2, '0')}`)
  };
}

function brokenWaadaCount(customer, allocations, todayStr) {
  let totalOutstandingCents = 0;
  for (const bill of Array.isArray(customer?.bills) ? customer.bills : []) {
    if (!validMonth(bill?.month)) continue;
    const summary = allocations?.forMonth?.(customer.id, bill.month);
    if (summary?.billAmountCents !== null && summary?.billAmountCents !== undefined
      && Number.isFinite(Number(summary?.balanceDueCents))) {
      totalOutstandingCents += Math.max(0, Number(summary.balanceDueCents));
    }
  }
  // SISP-98 swap (SISP-120 reconciliation): the broken count is
  // computeWaadaScore's `broken` — stamped payments paid after their
  // promise date (voided payments skipped) plus the live broken tier —
  // fed with the same total outstanding (the allocation sum over priced
  // bills) this function used to pass to getWaadaTier directly. The
  // engine clamps balanceDueCents at 0 on priced bills and reports null
  // for unpriced ones, so this sum is the canonical outstanding both
  // merged SISP-98 call sites use.
  return computeWaadaScore(customer, totalOutstandingCents / 100, todayStr).broken;
}

/** Count broken Waadas via SISP-98's computeWaadaScore (SISP-34 stamps + live tier). */
export function countBrokenWaadas(state, customerInput, referenceDate = new Date()) {
  const sourceState = state && Array.isArray(state.customers)
    ? state
    : { customers: customerInput && typeof customerInput === 'object' ? [customerInput] : [] };
  const customer = resolveCustomer(sourceState, customerInput);
  if (!customer) return 0;
  const todayStr = referenceDateString(referenceDate);
  return brokenWaadaCount(customer, calculatePaymentAllocations(sourceState), todayStr);
}

/**
 * Evaluate the SISP-120 star for one customer. `customerInput` may be a
 * customer object or id; `referenceDate` may be a Date or YYYY-MM-DD and
 * is injectable for tests. The input state is never mutated.
 */
export function evaluateStarTimelyPayer(state, customerInput, referenceDate = new Date()) {
  const sourceState = state && Array.isArray(state.customers)
    ? state
    : { customers: customerInput && typeof customerInput === 'object' ? [customerInput] : [] };
  const customer = resolveCustomer(sourceState, customerInput);
  const todayStr = referenceDateString(referenceDate);
  const currentMonth = todayStr.slice(0, 7);
  const empty = {
    starred: false,
    customerId: customer?.id ?? null,
    today: todayStr,
    currentMonth,
    requiredMonths: [],
    months: [],
    brokenWaadaCount: 0,
    completedOutstandingCents: 0,
    completedOutstanding: 0,
    reason: 'customer-not-found'
  };
  if (!customer) return empty;

  const allocations = calculatePaymentAllocations(sourceState);
  const billsByMonth = new Map();
  for (const bill of Array.isArray(customer.bills) ? customer.bills : []) {
    if (validMonth(bill?.month) && !billsByMonth.has(bill.month)) billsByMonth.set(bill.month, bill);
  }

  const currentIndex = monthIndex(currentMonth);
  const requiredMonths = [currentIndex - 3, currentIndex - 2, currentIndex - 1].map(monthAtIndex);
  const months = requiredMonths.map((month) => {
    const bill = billsByMonth.get(month) ?? null;
    if (!bill) {
      return { month, billPresent: false, priced: false, status: 'not-set', completionDate: null, timely: false };
    }
    return starBillSettlement(customer, bill, allocations);
  });

  let completedOutstandingCents = 0;
  for (const [month, bill] of billsByMonth.entries()) {
    if (month >= currentMonth) continue;
    const summary = allocations?.forMonth?.(customer.id, bill.month);
    if (summary?.billAmountCents !== null && summary?.billAmountCents !== undefined
      && Number.isFinite(Number(summary?.balanceDueCents))) {
      completedOutstandingCents += Math.max(0, Number(summary.balanceDueCents));
    }
  }

  const brokenWaadas = brokenWaadaCount(customer, allocations, todayStr);
  let reason = 'starred';
  if (customer.archived === true) reason = 'archived';
  else if (customer.isFreeConnection === true) reason = 'free-connection';
  else if (completedOutstandingCents > 0) reason = 'completed-arrears';
  else if (months.some((item) => !item.billPresent || !item.priced)) reason = 'missing-billed-month';
  else if (months.some((item) => item.status !== 'paid')) reason = 'unpaid-completed-month';
  else if (months.some((item) => !item.timely)) reason = 'late-completion';
  else if (brokenWaadas > 0) reason = 'broken-waada';

  return {
    starred: reason === 'starred',
    customerId: customer.id ?? null,
    today: todayStr,
    currentMonth,
    requiredMonths,
    months,
    brokenWaadaCount: brokenWaadas,
    completedOutstandingCents,
    completedOutstanding: completedOutstandingCents / 100,
    reason
  };
}

export function isStarTimelyPayer(state, customerInput, referenceDate = new Date()) {
  return evaluateStarTimelyPayer(state, customerInput, referenceDate).starred;
}

/** The fixed receipt thank-you line in the active app language. */
export function starReceiptThankYouNote(lang = null) {
  return t('star_receipt_thanks', lang);
}
