/**
 * revenue-leak-detector.js — SISP-85: Monthly Unbilled / Zero-Rate /
 * Expired-Pause Revenue Leak Detector.
 *
 * A strictly read-only audit of the live ledger. It flags non-archived,
 * non-FREE customers in exactly three situations:
 *
 *   1. zero-rate — an active customer whose recorded package price is
 *      exactly Rs 0. The shipped price fields are honoured in the
 *      app's own order: an explicit `packagePrice` when one is stored,
 *      otherwise the canonical `monthlySellingAmount`. An unset price
 *      (null / missing) is NOT zero and is never flagged by this rule.
 *      FREE connections (isFreeConnection) are Rs 0 by design and are
 *      excluded from the whole audit — they never receive a bill.
 *   2. expired-pause — a customer still recorded as paused whose
 *      autoResumeDate is strictly before today. The detector only
 *      flags the stale hold; it never resumes, edits or bills anyone
 *      (resuming stays the explicit operator action of SISP-8/47).
 *   3. missing-current-bill — an active, non-paused customer with no
 *      bill record for the current month's cycle. Customers whose
 *      billing has not started yet (billingStartMonth in the future),
 *      customers paused for the month (including a recorded skipped
 *      month) and FREE connections are not leaks and stay unflagged.
 *
 * Estimated monthly leakage is DATA-HONEST: it is only ever the
 * customer's own recorded money —
 *   - the applicable scheduled rate for the month
 *     (applicablePriceForMonth, the billing cycle's own rule, or the
 *     customer's recorded current rate when no schedule entry exists),
 *     or
 *   - the amount of the customer's own last priced bill before the
 *     current month (priceSnapshot first, then dueAmount).
 * When neither exists the flag is reported with a null estimate — a
 * rate is never invented from the package catalogue, a label, or
 * another customer's bill. A zero-rate flag is estimated from the last
 * priced bill only: the recorded current rate is zero, and an older
 * schedule entry must not silently override that fact.
 *
 * Amounts are PKR rupees. Tests use synthetic data only.
 */

import { applicablePriceForMonth, isBillingCycleMonth } from './billing-cycle.js';
import { isBillingPaused, isValidPauseDate, sanitizePauseFields } from './pause-billing.js';

export const REVENUE_LEAK_ZERO_RATE = 'zero-rate';
export const REVENUE_LEAK_EXPIRED_PAUSE = 'expired-pause';
export const REVENUE_LEAK_MISSING_BILL = 'missing-current-bill';

const FLAG_ORDER = {
  [REVENUE_LEAK_MISSING_BILL]: 0,
  [REVENUE_LEAK_EXPIRED_PAUSE]: 1,
  [REVENUE_LEAK_ZERO_RATE]: 2
};

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function amountOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100) / 100;
}

function positiveAmountOrNull(value) {
  const amount = amountOrNull(value);
  return amount !== null && amount > 0 ? amount : null;
}

/** YYYY-MM-DD for a Date in Pakistan time (the app's wall clock). */
export function pakistanDateKey(referenceDate = new Date()) {
  const date = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function resolveContext(referenceDate, options) {
  const opts = options && typeof options === 'object' ? options : {};
  let reference = referenceDate;
  if (reference && typeof reference === 'object' && !(reference instanceof Date)) {
    Object.assign(opts, reference);
    reference = new Date();
  }
  let today = null;
  if (isValidPauseDate(opts.today)) today = opts.today;
  else if (typeof reference === 'string' && isValidPauseDate(reference.slice(0, 10))) today = reference.slice(0, 10);
  else today = pakistanDateKey(reference instanceof Date ? reference : new Date());
  const month = isBillingCycleMonth(opts.month) ? opts.month : today.slice(0, 7);
  return { today, month };
}

function normalizedStatus(customer) {
  const raw = typeof customer?.serviceStatus === 'string'
    ? customer.serviceStatus
    : (typeof customer?.status === 'string' ? customer.status : '');
  return raw.trim().toLocaleLowerCase();
}

/** True when the record reads as an active subscriber. */
export function isActiveRevenueCustomer(customer) {
  if (!customer || typeof customer !== 'object') return false;
  return normalizedStatus(customer) === 'active';
}

function isPausedRecord(customer, pause) {
  return pause.paused === true || normalizedStatus(customer) === 'paused';
}

/**
 * The customer's recorded package price: an explicit `packagePrice`
 * when one is stored, otherwise the canonical `monthlySellingAmount`.
 * Null when no price is recorded at all (unset is not zero).
 */
export function recordedPackagePrice(customer) {
  if (!customer || typeof customer !== 'object') return null;
  const explicit = amountOrNull(customer.packagePrice);
  if (explicit !== null) return explicit;
  return amountOrNull(customer.monthlySellingAmount);
}

function billsOf(customer) {
  return (Array.isArray(customer?.bills) ? customer.bills : [])
    .filter((bill) => bill && typeof bill === 'object' && isBillingCycleMonth(bill.month));
}

function billRecordedAmount(bill) {
  return positiveAmountOrNull(bill?.priceSnapshot) ?? positiveAmountOrNull(bill?.dueAmount);
}

/** The customer's own last priced bill before `month`, or null. */
export function lastPricedBillBefore(customer, month) {
  let best = null;
  for (const bill of billsOf(customer)) {
    if (bill.month >= month) continue;
    const amount = billRecordedAmount(bill);
    if (amount === null) continue;
    if (!best || bill.month > best.month) best = { month: bill.month, amount };
  }
  return best;
}

function scheduledRate(customer, month) {
  const scheduled = positiveAmountOrNull(applicablePriceForMonth(customer, month));
  if (scheduled !== null) return { amount: scheduled, source: 'scheduled-rate' };
  const recorded = positiveAmountOrNull(recordedPackagePrice(customer));
  if (recorded !== null) return { amount: recorded, source: 'scheduled-rate' };
  return null;
}

function rateOrLastBill(customer, month) {
  return scheduledRate(customer, month)
    ?? (() => {
      const last = lastPricedBillBefore(customer, month);
      return last ? { amount: last.amount, source: 'last-priced-bill', billMonth: last.month } : null;
    })();
}

function evaluateCustomer(customer, { today, month }) {
  if (!customer || typeof customer !== 'object') return [];
  if (customer.archived === true) return [];
  // Owner rule: FREE connections are Rs 0 by design and never billed —
  // no state they can be in is a revenue leak.
  if (customer.isFreeConnection === true) return [];

  const pause = sanitizePauseFields(customer);
  const pausedRecord = isPausedRecord(customer, pause);
  const active = isActiveRevenueCustomer(customer);
  const bills = billsOf(customer);
  const currentBill = bills.find((bill) => bill.month === month) ?? null;
  const hasCurrentBill = currentBill !== null;
  const hasPricedCurrentBill = currentBill !== null && billRecordedAmount(currentBill) !== null;
  const packagePrice = recordedPackagePrice(customer);

  const base = {
    customerId: customer.id ?? null,
    customerNumber: customer.customerNumber ?? null,
    customerName: text(customer.name),
    mohalla: text(customer.mohalla),
    currentMonth: month,
    today,
    packagePrice,
    autoResumeDate: pause.autoResumeDate,
    hasCurrentBill
  };
  const rows = [];
  const push = (flag, estimate) => rows.push({
    ...base,
    flag,
    reason: flag,
    estimatedMonthlyLeakage: estimate ? estimate.amount : null,
    estimateSource: estimate ? estimate.source : null,
    estimateBillMonth: estimate?.billMonth ?? null
  });

  // (1) Zero-rate: active + a recorded price of exactly Rs 0. The
  // estimate can only come from the customer's own last priced bill —
  // the current recorded rate is zero by definition of the flag.
  if (active && packagePrice === 0) {
    const last = lastPricedBillBefore(customer, month);
    push(REVENUE_LEAK_ZERO_RATE, last ? { amount: last.amount, source: 'last-priced-bill', billMonth: last.month } : null);
  }

  // (2) Expired pause: still recorded as paused, auto-resume day
  // strictly before today. Flag only — never resume or edit. When the
  // current month is already priced there is no missing month to
  // price, so the flag carries no estimate.
  if (pausedRecord && pause.autoResumeDate && pause.autoResumeDate < today) {
    push(REVENUE_LEAK_EXPIRED_PAUSE, hasPricedCurrentBill ? null : rateOrLastBill(customer, month));
  }

  // (3) Missing current bill: active, not paused for this month
  // (recorded hold or a recorded skipped month), billing already
  // started, and no bill record for the current month at all.
  const billingNotStarted = isBillingCycleMonth(customer.billingStartMonth) && customer.billingStartMonth > month;
  if (active && !hasCurrentBill && !billingNotStarted
    && !pausedRecord && !isBillingPaused(customer, month)) {
    push(REVENUE_LEAK_MISSING_BILL, rateOrLastBill(customer, month));
  }

  return rows;
}

/**
 * All revenue-leak flags in the ledger for the current month, largest
 * known estimate first (flags without an honest estimate last), then
 * by flag severity and customer number. Pure and read-only.
 */
export function buildRevenueLeakAudit(state, referenceDate = new Date(), options = {}) {
  const context = resolveContext(referenceDate, options);
  const customers = state && Array.isArray(state.customers) ? state.customers : [];
  const rows = [];
  for (const customer of customers) rows.push(...evaluateCustomer(customer, context));
  rows.sort((a, b) => ((b.estimatedMonthlyLeakage ?? -1) - (a.estimatedMonthlyLeakage ?? -1))
    || ((FLAG_ORDER[a.flag] ?? 9) - (FLAG_ORDER[b.flag] ?? 9))
    || (Number(a.customerNumber ?? 0) - Number(b.customerNumber ?? 0)));
  return rows;
}

/** Alias matching the detector naming used by the dashboard wiring. */
export const scanRevenueLeaks = buildRevenueLeakAudit;

/** One customer's flags (possibly empty), in audit order. */
export function revenueLeaksForCustomer(customer, referenceDate = new Date(), options = {}) {
  const context = resolveContext(referenceDate, options);
  return evaluateCustomer(customer, context)
    .sort((a, b) => ((b.estimatedMonthlyLeakage ?? -1) - (a.estimatedMonthlyLeakage ?? -1))
      || ((FLAG_ORDER[a.flag] ?? 9) - (FLAG_ORDER[b.flag] ?? 9)));
}

/**
 * Headline figures for the dashboard card. The total never double
 * counts a customer: a connection flagged twice for the same month
 * (e.g. zero-rate AND missing bill) leaks one monthly amount, so the
 * total takes the largest known estimate per customer.
 */
export function buildRevenueLeakSummary(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const counts = {
    [REVENUE_LEAK_ZERO_RATE]: 0,
    [REVENUE_LEAK_EXPIRED_PAUSE]: 0,
    [REVENUE_LEAK_MISSING_BILL]: 0
  };
  const largestByCustomer = new Map();
  for (const row of list) {
    if (row && Object.hasOwn(counts, row.flag)) counts[row.flag] += 1;
    if (!row || row.estimatedMonthlyLeakage === null || row.estimatedMonthlyLeakage === undefined) continue;
    const key = row.customerId ?? row.customerNumber;
    if (key === null || key === undefined) continue;
    const amount = Number(row.estimatedMonthlyLeakage) || 0;
    if (amount > (largestByCustomer.get(key) ?? 0)) largestByCustomer.set(key, amount);
  }
  const totalEstimatedMonthlyLeakage = Math.round(
    [...largestByCustomer.values()].reduce((sum, amount) => sum + amount, 0) * 100
  ) / 100;
  return {
    count: list.length,
    flaggedCustomers: new Set(list.map((row) => row?.customerId ?? row?.customerNumber).filter((id) => id !== null && id !== undefined)).size,
    counts,
    zeroRateCount: counts[REVENUE_LEAK_ZERO_RATE],
    expiredPauseCount: counts[REVENUE_LEAK_EXPIRED_PAUSE],
    missingBillCount: counts[REVENUE_LEAK_MISSING_BILL],
    totalEstimatedMonthlyLeakage,
    totalEstimatedLeakage: totalEstimatedMonthlyLeakage
  };
}
