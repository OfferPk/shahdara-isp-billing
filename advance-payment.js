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
// Tests use synthetic data only; no customer, bill or payment data is
// ever fabricated here.
import { addPayment, calculatePaymentAllocations, monthsForHistory, ADVANCE_PAYMENT_KIND, isAdvancePayment } from './core.js';

export { ADVANCE_PAYMENT_KIND, isAdvancePayment };

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
 *           referenceOverrideReason?, screenshot? } — validated by core's
 * validatePayment via addPayment, with the advance tag forced here so a
 * caller can never record an "advance" that lands untagged.
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
