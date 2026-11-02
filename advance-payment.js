// Advance payments (owner feature, 2026-10-29): record money a customer
// pays BEFORE the bill it belongs to — the real case is a customer whose
// October bill is already Paid sending November's money on 29 October.
// The payment must be recorded NOW and stay clearly tagged as advance, so
// it adjusts against the next generated bill.
//
// This module deliberately builds NO parallel credit system. The SISP-2
// allocation engine in core.js already turns any receipt beyond a bill's
// balance into pending credit and carries it forward into later generated
// bills (calculatePaymentAllocations: excess -> pendingCreditCents ->
// carry-forward), and the billing-cycle engine reads exactly that figure
// as advanceCredit (arrearsAndAdvance in billing-cycle.js). What was
// missing was the explicit, tagged path: this module records the tagged
// payment (kind: 'advance') through the same addPayment pipeline, so
// receipts, Transactions, the SISP-33 FIFO and SISP-34 void all keep
// working on it exactly like any other payment — and the operator entry
// points (profile payment form, Quick Collect) refuse an UNTAGGED
// payment against an already-paid bill via normalPaymentBlockReason
// below, directing the operator here instead. The engine itself keeps
// its long-standing excess-recording semantics (method totals count
// actual receipts; SISP-43 settles charges after a bill is paid), so the
// guard lives at the entry points, never inside addPayment.
//
// Month targeting (2026-10-29, the SISP-61 core): the operator also
// marks WHICH month the advance is for (targetMonth on the record).
// The engine reserves a targeted credit for its month — it adjusts
// automatically the moment that month's bill exists (bills are
// generated on the 5th in the owner's routine, and allocations are
// computed live, so there is nothing extra to run or click). This is
// an offline PWA: no code runs while the app is closed, so the
// "auto-adjust on the 5th" is exactly this derived-allocation truth,
// never a scheduler.
//
// Tests use synthetic data only; no customer, bill or payment data is
// ever fabricated here.
import { addPayment, calculatePaymentAllocations, monthsForHistory, ADVANCE_PAYMENT_KIND, isAdvancePayment, advancePaymentTargetMonth, prepayTermsOf } from './core.js';

export { ADVANCE_PAYMENT_KIND, isAdvancePayment, advancePaymentTargetMonth };

function shiftMonthKey(month, delta) {
  const [year, number] = String(month).split('-').map(Number);
  const index = year * 12 + number - 1 + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/**
 * The month an advance recorded today is FOR, by default: the month
 * after the current one — the owner's case (paying on 29 October, the
 * money is November's). 'YYYY-MM' in the app's own month convention
 * (monthsForHistory's first entry is the current billing month).
 */
export function defaultAdvanceTargetMonth(referenceDate = new Date()) {
  return shiftMonthKey(monthsForHistory(referenceDate)[0], 1);
}

/**
 * The target months the advance entry points offer: the current month
 * first, then the following months (spanMonths entries in total). The
 * operator can always move the pre-selected default (next month) to
 * the current month or a later one; past months are never offered —
 * money cannot be marked for a month that has already closed.
 *
 * @returns {string[]} ascending 'YYYY-MM' month keys.
 */
export function advanceTargetMonthOptions(referenceDate = new Date(), spanMonths = 6) {
  const current = monthsForHistory(referenceDate)[0];
  const span = Number.isFinite(Number(spanMonths)) ? Math.max(1, Math.min(12, Math.trunc(Number(spanMonths)))) : 6;
  return Array.from({ length: span }, (_, i) => shiftMonthKey(current, i));
}

/**
 * The customer's current advance balance, in cents: the unapplied credit
 * the allocation engine is holding for future bills. This is the single
 * source for the profile "Unused advance credit" figure — the same sum
 * the billing cycle will consume as advanceCredit on the next cycle.
 */
export function advanceBalanceCents(state, customerId, allocations = null) {
  if (!state || !Array.isArray(state.customers)) return 0;
  const allocs = allocations ?? calculatePaymentAllocations(state);
  let total = 0;
  for (const row of allocs.byPaymentId.values()) {
    if (row.customerId === customerId) total += row.unappliedCreditCents ?? 0;
  }
  return total;
}

/** The customer's current advance balance in rupees (see above). */
export function advanceBalance(state, customerId) {
  return advanceBalanceCents(state, customerId) / 100;
}

/**
 * SISP-194: the advance-credit figures ONE payment receipt must print —
 * "Advance Credit Applied: X • Remaining Advance Balance: Y" — or null
 * when the receipt involves no advance money at all (the caller then
 * renders nothing, so ordinary receipts stay byte-identical).
 *
 * Which receipts qualify (the trigger): the payment is itself an
 * advance-tagged payment (PR #488 lineage — recorded with this
 * payment), OR advance credit was applied to the bill this payment
 * settles (consumed by this bill). Two exclusions, both deliberate:
 *  - SISP-61 prepay payments: a prepay IS an advance-kind record (its
 *    terms ride a targeted advance), but its receipt already prints its
 *    own gross / discount / cash lines — the advance line must never
 *    double-print there. A later bill that spends pool credit a prepay
 *    funded still shows the line (see "applied" below): the pool is
 *    one engine pool, the same one advanceBalanceCents reports.
 *  - Voided payments (SISP-34): the engine excludes them from
 *    allocations entirely, so a voided advance contributes nothing and
 *    its receipt shows no credit line.
 *
 * The figures are the engine's own, never a parallel computation:
 *  - applied: when the bill consumed credit, the bill summary's
 *    creditAppliedCents — the allocation engine's attribution of
 *    pending credit to this bill (the same figure buildPaymentReceipt
 *    already reads as the receipt's carry-in). When the bill consumed
 *    none and the payment is advance-tagged, the credit THIS payment
 *    generated: its allocation ledger's excessCents (the bill portion
 *    left after same-month settlement, forwarded into the pool).
 *  - remaining: the advance balance still held for the customer AFTER
 *    this payment, point-in-time — NOT today's balance when an old
 *    receipt is reprinted. Derived the honest way: a scoped re-run of
 *    the allocation engine over a truncated ledger (bills before this
 *    bill's month whole; this bill's payments cut at this payment in
 *    the engine's own date/id processing order; later bills dropped),
 *    read back through advanceBalanceCents, so the figure can never
 *    disagree with the engine or with the profile advance balance as
 *    it stood at that moment.
 *
 * Amounts are returned in cents (exact) and rupees (receipt-model
 * convention). Pure: the customer record is never mutated.
 */
export function advanceCreditForReceipt(customer, bill, payment) {
  if (!customer || !bill || !payment) return null;
  if (payment.voided === true) return null;
  if (prepayTermsOf(payment)) return null;
  const allocations = calculatePaymentAllocations({ customers: [customer] });
  const summary = allocations.forMonth(customer.id, bill.month);
  const creditAppliedCents = Math.max(0, Number(summary?.creditAppliedCents) || 0);
  if (!isAdvancePayment(payment) && creditAppliedCents <= 0) return null;

  const bills = Array.isArray(customer.bills) ? customer.bills : [];
  const matchingBill = bills.find(row => row === bill || (row?.id && bill.id && row.id === bill.id)) ?? bill;
  const engineOrder = (a, b) => String(a?.date ?? '').localeCompare(String(b?.date ?? ''))
    || String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
  const livePayments = (Array.isArray(matchingBill.payments) ? matchingBill.payments : [])
    .filter(row => row?.voided !== true)
    .sort(engineOrder);
  const selectedIndex = livePayments.findIndex(row => row === payment
    || (row?.id && payment.id && row.id === payment.id));
  const scopedBill = selectedIndex >= 0
    ? { ...matchingBill, payments: livePayments.slice(0, selectedIndex + 1) }
    : matchingBill;
  const scopedCustomer = {
    ...customer,
    bills: [...bills.filter(row => String(row?.month ?? '') < String(bill.month ?? '')), scopedBill]
  };
  const scopedAllocations = calculatePaymentAllocations({ customers: [scopedCustomer] });
  const remainingCents = advanceBalanceCents({ customers: [scopedCustomer] }, customer.id, scopedAllocations);
  const ledger = scopedAllocations.byPaymentId.get(payment.id);
  const generatedCents = Math.max(0, Number(ledger?.excessCents) || 0);
  const appliedCents = creditAppliedCents > 0 ? creditAppliedCents : generatedCents;
  const toAmount = (value) => Number((value / 100).toFixed(2));
  return {
    appliedCents,
    remainingCents,
    applied: toAmount(appliedCents),
    remaining: toAmount(remainingCents)
  };
}

/**
 * The owner-rule guard for the NORMAL payment paths: returns 'fully-paid'
 * when recording an ordinary (untagged) payment for `month` would
 * double-record against a bill that is already fully paid — its priced
 * allocation balance is zero — and null when the payment may proceed.
 * Unpriced bills (balance unknown: the receipt is held as credit, the
 * long-standing advance-before-pricing behaviour) and months with no
 * bill yet are never blocked. The tagged advance path is the explicit
 * exception and never consults this guard. Pure; shared by the profile
 * payment form and the Quick Collect sheet so both enforce one rule.
 */
export function normalPaymentBlockReason(state, customerId, month) {
  const customer = state?.customers?.find(c => c.id === customerId);
  if (!customer) return null;
  const bill = (customer.bills ?? []).find(b => b.month === month);
  if (!bill) return null;
  const summary = calculatePaymentAllocations(state).forMonth(customerId, month);
  if (summary && typeof summary.balanceDueCents === 'number' && summary.balanceDueCents <= 0) return 'fully-paid';
  return null;
}

/**
 * Records an advance payment for a customer through the existing payment
 * pipeline. The payment is attached to the CURRENT billing month (the
 * month shown in the profile's Current Billing section): the engine first
 * settles any balance still due on that month, and the remainder becomes
 * advance credit for the next generated bill — the engine's real FIFO
 * semantics, pinned by tests.
 *
 * fields: { amount, date, method, paidBy?, note?, transactionId?,
 *           referenceOverrideReason?, screenshot?, targetMonth? } —
 * validated by core's validatePayment via addPayment, with the advance
 * tag forced here so a caller can never record an "advance" that lands
 * untagged. targetMonth is the month the money is FOR (advance month
 * targeting): validatePayment keeps it only as a strictly valid
 * 'YYYY-MM' on the tagged record, and the allocation engine reserves
 * the credit for that month (see advancePaymentTargetMonth in core).
 *
 * @returns {{ nextState: Object, payment: Object, month: string }}
 */
export function recordAdvancePayment(state, customerId, fields = {}, referenceDate = new Date()) {
  const month = monthsForHistory(referenceDate)[0];
  const before = state?.customers?.find(c => c.id === customerId);
  const beforeIds = new Set((before?.bills?.find(b => b.month === month)?.payments ?? []).map(p => p.id));
  const nextState = addPayment(state, customerId, month, { ...fields, kind: ADVANCE_PAYMENT_KIND }, referenceDate);
  const customer = nextState.customers.find(c => c.id === customerId);
  const bill = customer?.bills?.find(b => b.month === month);
  const payment = (bill?.payments ?? []).find(p => !beforeIds.has(p.id)) ?? null;
  if (!payment) throw new Error('Advance payment was not recorded.');
  return { nextState, payment, month };
}
