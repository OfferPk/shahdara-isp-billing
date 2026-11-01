/**
 * next-bill-projector.js — SISP-151 [P1]: Projected Next-Month Invoice
 * Preview ("اگلے مہینے کا متوقع بل").
 *
 * Pure projector: projectNextMonthInvoice(customer, context) estimates
 * the invoice the NEXT monthly cycle will generate for one customer —
 *
 *   Base Package (price schedule for the target month)
 * + Next Hardware Kist (installment schedule for the target month)
 * + Unpaid Arrears (engine balances of every earlier month)
 * − Advance Wallet (released unapplied credit that is not prepay money)
 * − Pending Credits (queued referral credit + released prepay coverage)
 * = Projected Next Due
 *
 * NO PARALLEL MATH: every figure is an output of the app's real
 * engines, composed — never recomputed here:
 *   - Base / Kist / Arrears / total net due come from the billing
 *     cycle's own planner, planCustomerCycleLine (billing-cycle.js),
 *     run for the target month — the exact function the operator-
 *     confirmed cycle uses, so a projection and the later real cycle
 *     agree by construction whenever nothing changes in between.
 *   - The planner's single advanceCredit figure is PARTITIONED here
 *     (never re-derived): the per-payment ledgers of the same scoped
 *     allocation run arrearsAndAdvance performs are walked once and
 *     each released credit is classified by its source payment —
 *     prepay payments (core's prepayTermsOf) are "Prepay Coverage",
 *     everything else is the "Advance Wallet". The two parts always
 *     sum exactly to the planner's advanceCredit (pinned by tests).
 *   - Queued referral credit is the planner's referralCreditApplied,
 *     fed by the same queuedReferralTotalFor total the cycle planner
 *     receives (the caller passes it in context — this module reads
 *     no storage).
 *
 * PENDING-CREDIT SOURCES IN THIS BASE (each counted exactly once):
 *   1. SISP-40 queued hamsaya referral credit — not yet stamped on
 *      any bill; the planner applies it to the target month's gross.
 *   2. SISP-61 prepay coverage — cash excess + upfront discount held
 *      as ONE reserved credit under the prepay's targetMonth; the
 *      engine releases it from its start month on, so for the target
 *      month it is part of the released advance pool (partitioned
 *      out of the wallet above, never added twice).
 *   3. Credits already STAMPED on a bill (SISP-30 concession,
 *      SISP-40 referral, SISP-50 deposit offset, SISP-97 feeder-host
 *      credit) — these can only exist on a bill that already exists,
 *      so they are reported by the already-billed branch below as an
 *      informational total already inside the engine balance, never
 *      subtracted a second time.
 *
 * ALREADY-BILLED TARGET MONTH: when a priced bill for the target
 * month already exists, the month is no longer a projection. The
 * result carries status 'already-billed' and projectedDue =
 * previous arrears + that bill's live engine balance
 * (calculatePaymentAllocations.forMonth) — every figure still an
 * engine output. A still-queued referral credit is NOT folded in
 * (the cycle may stamp it when it next runs; the bill as it stands
 * does not carry it).
 *
 * SPECIAL CASES (via the planner's own skip semantics):
 *   - archived            -> null (projection refused);
 *   - FREE connection     -> status 'free', projected due Rs. 0;
 *   - billing paused for the target month (SISP-8 month rule,
 *     isBillingPaused — month-granular: a hold whose pause month is
 *     the target month pauses the whole month, exactly as the cycle
 *     treats it; SISP-47's day-level hold pro-rates nothing in the
 *     cycle, so nothing is pro-rated here) -> status 'paused', Rs. 0;
 *   - billing not started by the target month, or no price on the
 *     schedule for it, or an unpriced bill already sitting in it
 *     -> null (nothing honest to project).
 *
 * The projection looks ONE cycle ahead from the recorded ledger: it
 * assumes intervening cycles run in order (a target two months out
 * would still show credit an intervening bill will consume first).
 * The profile surface only ever asks for the immediate next month.
 *
 * PURITY: this module reads the customer record and returns fresh
 * objects. It creates no bill, stamps nothing, writes no storage and
 * mutates no input (pinned byte-for-byte by tests).
 */
import { calculatePaymentAllocations, prepayTermsOf } from './core.js';
import { arrearsAndAdvance, pakistanMonthKey, planCustomerCycleLine } from './billing-cycle.js';
import { billKistTotal } from './installment-plan.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const isMonthKey = (value) => typeof value === 'string' && MONTH_RE.test(value);
const cents = (value) => Math.round(Number(value) * 100);
const rupees = (centsValue) => centsValue / 100;
const moneyOrZero = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

/** The month key after a 'YYYY-MM' month (null for invalid input). */
export function nextMonthKey(month) {
  if (!isMonthKey(month)) return null;
  const [year, mon] = month.split('-').map(Number);
  const total = year * 12 + mon; // mon is 1-based; +1 month lands on total
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/**
 * Partition the advance credit the engine releases for `month` into
 * prepay coverage vs plain wallet money. Mirrors arrearsAndAdvance's
 * release rule exactly (same scoped customer, same ledger walk), so
 * walletCents + prepayCents === arrearsAndAdvance(customer, month)
 * .advanceCredit in cents — pinned by tests.
 */
export function splitAdvanceCredit(customer, month) {
  const bills = Array.isArray(customer?.bills) ? customer.bills : [];
  const scoped = { ...customer, bills: bills.filter((bill) => bill && bill.month < month) };
  const allocations = calculatePaymentAllocations({ customers: [scoped] });
  const paymentsById = new Map();
  for (const bill of scoped.bills) {
    for (const payment of Array.isArray(bill?.payments) ? bill.payments : []) {
      if (payment?.id) paymentsById.set(payment.id, payment);
    }
  }
  let walletCents = 0;
  let prepayCents = 0;
  for (const ledger of allocations.byPaymentId.values()) {
    if (ledger.customerId !== customer.id) continue;
    if (!(ledger.unappliedCreditCents > 0)) continue;
    if (ledger.targetMonth && ledger.targetMonth > month) continue;
    const payment = paymentsById.get(ledger.paymentId);
    if (payment && prepayTermsOf(payment)) prepayCents += ledger.unappliedCreditCents;
    else walletCents += ledger.unappliedCreditCents;
  }
  return { walletCents, prepayCents };
}

const zeroProjection = (customer, targetMonth, currentMonth, status) => ({
  customerId: customer?.id ?? null,
  customerNumber: customer?.customerNumber ?? null,
  status,
  currentMonth,
  targetMonth,
  basePackage: 0,
  kist: 0,
  kistLines: [],
  previousArrears: 0,
  advanceWallet: 0,
  prepayCoverage: 0,
  referralCredit: 0,
  pendingCredits: 0,
  advanceCredit: 0,
  advanceApplied: 0,
  remainingAdvance: 0,
  billBalanceDue: null,
  stampedCredits: 0,
  projectedDue: 0
});

/**
 * Project the next billing cycle's invoice for one customer.
 * context: { currentMonth?, targetMonth?, today?, referralQueued? }
 *   - currentMonth defaults to the Pakistan month of `today`
 *     (default: now); targetMonth defaults to currentMonth + 1.
 *   - referralQueued is the customer's queued SISP-40 referral total
 *     (queuedReferralTotalFor) — the same input the cycle planner
 *     receives; omit it and no referral credit is projected.
 * Returns the projection object, or null when no honest projection
 * exists (archived, billing not started, no price, unpriced bill).
 */
export function projectNextMonthInvoice(customer, context = {}) {
  if (!customer || customer.archived) return null;
  const today = context?.today instanceof Date ? context.today : new Date();
  const currentMonth = isMonthKey(context?.currentMonth) ? context.currentMonth : pakistanMonthKey(today);
  const targetMonth = isMonthKey(context?.targetMonth) ? context.targetMonth : nextMonthKey(currentMonth);
  if (!isMonthKey(targetMonth)) return null;
  const referralQueued = Number(context?.referralQueued) || 0;

  const bills = Array.isArray(customer.bills) ? customer.bills : [];
  const existing = bills.find((bill) => bill?.month === targetMonth) ?? null;

  // Already-billed branch: a priced bill for the target month exists,
  // so report its live engine balance instead of a projection.
  if (existing && Number(existing.dueAmount) > 0) {
    const allocations = calculatePaymentAllocations({ customers: [customer] });
    const summary = allocations.forMonth(customer.id, targetMonth);
    if (!summary || summary.balanceDueCents === null || summary.balanceDueCents === undefined) return null;
    const { previousArrears } = arrearsAndAdvance(customer, targetMonth);
    const kist = billKistTotal(existing);
    const billBalanceDue = rupees(summary.balanceDueCents);
    const stampedCredits = rupees(
      cents(moneyOrZero(existing.referralCreditAmount))
      + cents(moneyOrZero(existing.concessionAmount))
      + cents(moneyOrZero(existing.feederHostCreditAmount))
      + cents(moneyOrZero(existing.depositOffsetAmount))
    );
    return {
      ...zeroProjection(customer, targetMonth, currentMonth, 'already-billed'),
      basePackage: Math.max(0, rupees(cents(Number(existing.dueAmount)) - cents(kist))),
      kist,
      previousArrears,
      billBalanceDue,
      stampedCredits,
      projectedDue: rupees(cents(previousArrears) + cents(billBalanceDue))
    };
  }

  const line = planCustomerCycleLine(customer, targetMonth, referralQueued);
  if (line.skipped) {
    if (line.reason === 'free-connection') return zeroProjection(customer, targetMonth, currentMonth, 'free');
    if (line.reason === 'paused') return zeroProjection(customer, targetMonth, currentMonth, 'paused');
    return null; // billing-not-started / no-price / unpriced-bill
  }

  const { walletCents, prepayCents } = splitAdvanceCredit(customer, targetMonth);
  const referralCredit = line.referralCreditApplied;
  return {
    customerId: customer.id ?? null,
    customerNumber: customer.customerNumber ?? null,
    status: 'projected',
    currentMonth,
    targetMonth,
    basePackage: line.currentMonthBill,
    kist: line.kistAmount,
    kistLines: line.kistLines,
    previousArrears: line.previousArrears,
    advanceWallet: rupees(walletCents),
    prepayCoverage: rupees(prepayCents),
    referralCredit,
    pendingCredits: rupees(cents(referralCredit) + prepayCents),
    advanceCredit: line.advanceCredit,
    advanceApplied: line.advanceApplied,
    remainingAdvance: line.remainingAdvance,
    billBalanceDue: null,
    stampedCredits: 0,
    projectedDue: line.netDue
  };
}
