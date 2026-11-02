/**
 * advance-targeting-consumption-pin.test.js — Muse phase M17:
 * Advance Month-Targeting Consumption Pin (test-only).
 *
 * The per-feature suite (tests/advance-month-target.test.js) pins the
 * SISP-61 targeting rules one behaviour at a time: reservation against
 * a single skipped month, release at the target month, the remainder
 * flowing to ONE later bill, void of the advance before/after a single
 * consumption. What no single test composed is the full consumption
 * CHAIN across a targeted month plus TWO later bills, with an
 * already-settled earlier month in the same ledger, asserting the
 * per-month allocations to the cent at every step — and the two void
 * interactions inside that chain:
 *
 *  - voiding an ordinary payment recorded on the CONSUMING bill must
 *    restore the derivation byte-for-byte: the targeted credit is
 *    neither freed to be consumed a second time nor eaten by the void;
 *  - voiding the advance itself after it has been consumed across
 *    three months must release every month exactly once — each
 *    month's credit drops to zero and its full due returns — and a
 *    second void is refused.
 *
 * The chain under test (one synthetic customer, Rs 3,000/month):
 * September and October 2026 are billed and fully paid with ordinary
 * payments (the earlier settled months). On 29 October a Rs 7,500
 * advance is recorded TARGETED at 2026-12. The engine must:
 *  (1) serve the targeted month first — November's bill, generated
 *      before December's, receives NOTHING (the credit is reserved);
 *  (2) spill only forward — December consumes Rs 3,000, the remainder
 *      flows to January (Rs 3,000) and then February (Rs 1,500);
 *  (3) never reach backward — September/October keep zero credit and
 *      zero due at every step, and November's own unpaid due is never
 *      netted by December's money;
 *  (4) never double-consume around a void (the two pins above).
 * An untargeted advance of Rs 4,500 on the same settled base keeps
 * the plain legacy FIFO: November consumes it immediately.
 *
 * All figures below were probe-verified against the shipped engine
 * before being pinned. Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState, updateCustomerProfile, generateMonthlyBillsThroughCurrentMonth,
  addPayment, calculatePaymentAllocations
} from '../core.js';
import { recordAdvancePayment, advanceBalanceCents } from '../advance-payment.js';
import { arrearsAndAdvance } from '../billing-cycle.js';
import { voidPayment } from '../payment-void-audit.js';

const SEP_10 = new Date(2026, 8, 10, 12);
const OCT_29 = new Date(2026, 9, 29, 12);
const NOV_2 = new Date(2026, 10, 2, 12);
const DEC_2 = new Date(2026, 11, 2, 12);
const DEC_10 = new Date(2026, 11, 10, 12);
const JAN_2 = new Date(2027, 0, 2, 12);
const FEB_2 = new Date(2027, 1, 2, 12);
const ID = 'seed-001';
const MONTHS = ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02'];

/** September + October billed and fully paid with ordinary payments. */
function settledStart() {
  let state = createInitialState(['Advance Chain Tester']);
  state = updateCustomerProfile(state, ID, { monthlySellingAmount: '3000' }, SEP_10);
  state = generateMonthlyBillsThroughCurrentMonth(state, SEP_10);
  state = addPayment(state, ID, '2026-09', { date: '2026-09-06', amount: '3000', method: 'Cash' }, SEP_10);
  state = generateMonthlyBillsThroughCurrentMonth(state, OCT_29);
  state = addPayment(state, ID, '2026-10', { date: '2026-10-05', amount: '3000', method: 'Cash' }, OCT_29);
  return state;
}

/** The per-month figures this pin asserts, projected to plain data. */
function monthFigures(allocations, month) {
  const s = allocations.forMonth(ID, month);
  if (!s) return null;
  return {
    billAmountCents: s.billAmountCents,
    creditAppliedCents: s.creditAppliedCents,
    sameMonthAppliedCents: s.sameMonthAppliedCents,
    balanceDueCents: s.balanceDueCents,
    sources: s.creditSources.map(row => [row.paymentId, row.amountCents])
  };
}
const settledMonth = { billAmountCents: 300000, creditAppliedCents: 0, sameMonthAppliedCents: 300000, balanceDueCents: 0, sources: [] };
const unpaidMonth = { billAmountCents: 300000, creditAppliedCents: 0, sameMonthAppliedCents: 0, balanceDueCents: 300000, sources: [] };
const creditMonth = (paymentId, cents, dueCents) => ({
  billAmountCents: 300000, creditAppliedCents: cents, sameMonthAppliedCents: 0,
  balanceDueCents: dueCents, sources: [[paymentId, cents]]
});

test('targeted chain: a December advance skips November, serves December first, spills forward only', () => {
  let state = settledStart();
  const { nextState, payment } = recordAdvancePayment(state, ID, { amount: 7500, date: '2026-10-29', method: 'Cash', targetMonth: '2026-12' }, OCT_29);
  state = nextState;
  const advId = payment.id;
  assert.equal(payment.targetMonth, '2026-12');

  // Step A — recorded: both settled months untouched, the full
  // Rs 7,500 held, and the billing cycle sees the money ONLY as
  // December's advance credit (never November's).
  let allocations = calculatePaymentAllocations(state);
  assert.deepEqual(monthFigures(allocations, '2026-09'), settledMonth);
  assert.deepEqual(monthFigures(allocations, '2026-10'), settledMonth);
  assert.equal(advanceBalanceCents(state, ID), 750000);
  let ledger = allocations.byPaymentId.get(advId);
  assert.equal(ledger.excessCents, 750000);
  assert.equal(ledger.unappliedCreditCents, 750000);
  assert.deepEqual(ledger.allocations, []);
  assert.equal(arrearsAndAdvance(state.customers[0], '2026-11').advanceCredit, 0);
  assert.equal(arrearsAndAdvance(state.customers[0], '2026-12').advanceCredit, 7500);

  // Step B — November's bill generated: the reserved credit skips it
  // entirely. November owes its full Rs 3,000; nothing is held back.
  state = generateMonthlyBillsThroughCurrentMonth(state, NOV_2);
  allocations = calculatePaymentAllocations(state);
  assert.deepEqual(monthFigures(allocations, '2026-11'), unpaidMonth);
  assert.deepEqual(monthFigures(allocations, '2026-09'), settledMonth);
  assert.deepEqual(monthFigures(allocations, '2026-10'), settledMonth);
  assert.equal(advanceBalanceCents(state, ID), 750000);
  assert.deepEqual(allocations.byPaymentId.get(advId).allocations, []);

  // Step C — December's bill generated: the reservation releases and
  // the targeted month is served first, in full.
  state = generateMonthlyBillsThroughCurrentMonth(state, DEC_2);
  allocations = calculatePaymentAllocations(state);
  assert.deepEqual(monthFigures(allocations, '2026-12'), creditMonth(advId, 300000, 0));
  assert.deepEqual(monthFigures(allocations, '2026-11'), unpaidMonth);
  assert.equal(advanceBalanceCents(state, ID), 450000);
  assert.deepEqual(allocations.byPaymentId.get(advId).allocations, [
    { month: '2026-12', amountCents: 300000, kind: 'carry-forward' }
  ]);

  // Step D — January: the remainder spills FORWARD, in order.
  state = generateMonthlyBillsThroughCurrentMonth(state, JAN_2);
  allocations = calculatePaymentAllocations(state);
  assert.deepEqual(monthFigures(allocations, '2027-01'), creditMonth(advId, 300000, 0));
  assert.deepEqual(monthFigures(allocations, '2026-12'), creditMonth(advId, 300000, 0));
  assert.equal(advanceBalanceCents(state, ID), 150000);

  // Step E — February consumes the last Rs 1,500 and keeps a Rs 1,500
  // due; the settled earlier months were never reached backward, and
  // November's due was never netted by December's money.
  state = generateMonthlyBillsThroughCurrentMonth(state, FEB_2);
  allocations = calculatePaymentAllocations(state);
  assert.deepEqual(monthFigures(allocations, '2027-02'), creditMonth(advId, 150000, 150000));
  assert.deepEqual(monthFigures(allocations, '2026-09'), settledMonth);
  assert.deepEqual(monthFigures(allocations, '2026-10'), settledMonth);
  assert.deepEqual(monthFigures(allocations, '2026-11'), unpaidMonth);
  assert.equal(advanceBalanceCents(state, ID), 0);
  ledger = allocations.byPaymentId.get(advId);
  assert.deepEqual(ledger.allocations, [
    { month: '2026-12', amountCents: 300000, kind: 'carry-forward' },
    { month: '2027-01', amountCents: 300000, kind: 'carry-forward' },
    { month: '2027-02', amountCents: 150000, kind: 'carry-forward' }
  ]);
  assert.equal(ledger.unappliedCreditCents, 0);
});

test('void of an ordinary payment on the consuming bill restores the exact pre-payment derivation', () => {
  let state = settledStart();
  const { nextState, payment } = recordAdvancePayment(state, ID, { amount: 7500, date: '2026-10-29', method: 'Cash', targetMonth: '2026-12' }, OCT_29);
  state = generateMonthlyBillsThroughCurrentMonth(nextState, DEC_2);
  const advId = payment.id;
  const before = calculatePaymentAllocations(state);
  const snapshot = Object.fromEntries(MONTHS.slice(0, 4).map(m => [m, monthFigures(before, m)]));
  assert.equal(advanceBalanceCents(state, ID), 450000);

  // An ordinary Rs 3,000 payment is ALSO recorded on December's bill.
  // Credit applies before same-month money in the engine, so the
  // advance still serves December and the payment becomes pure excess.
  state = addPayment(state, ID, '2026-12', { date: '2026-12-10', amount: '3000', method: 'Cash' }, DEC_10);
  const extra = state.customers[0].bills.find(b => b.month === '2026-12').payments[0];
  let allocations = calculatePaymentAllocations(state);
  assert.deepEqual(monthFigures(allocations, '2026-12'), creditMonth(advId, 300000, 0));
  const extraLedger = allocations.byPaymentId.get(extra.id);
  assert.deepEqual(extraLedger.allocations, []);
  assert.equal(extraLedger.excessCents, 300000);
  assert.equal(extraLedger.unappliedCreditCents, 300000);
  assert.equal(advanceBalanceCents(state, ID), 750000);

  // Voiding that payment releases its excess exactly once: the whole
  // derivation — every month, the advance's own ledger, the held
  // balance — is identical to the pre-payment derivation. The advance
  // is consumed exactly once (December, Rs 3,000), not twice, not zero.
  const { state: voided } = voidPayment(state, ID, '2026-12', extra.id, { voidReason: 'Recorded twice' });
  allocations = calculatePaymentAllocations(voided);
  for (const month of MONTHS.slice(0, 4)) {
    assert.deepEqual(monthFigures(allocations, month), snapshot[month], `${month} must match the pre-payment derivation`);
  }
  assert.deepEqual(allocations.byPaymentId.get(advId).allocations, [
    { month: '2026-12', amountCents: 300000, kind: 'carry-forward' }
  ]);
  assert.equal(allocations.byPaymentId.get(advId).unappliedCreditCents, 450000);
  assert.equal(advanceBalanceCents(voided, ID), 450000);
});

test('void of the advance after the full chain releases every month exactly once; a second void is refused', () => {
  let state = settledStart();
  const { nextState, payment } = recordAdvancePayment(state, ID, { amount: 7500, date: '2026-10-29', method: 'Cash', targetMonth: '2026-12' }, OCT_29);
  state = generateMonthlyBillsThroughCurrentMonth(nextState, FEB_2);
  const advId = payment.id;
  assert.equal(calculatePaymentAllocations(state).forMonth(ID, '2027-02').creditAppliedCents, 150000);
  assert.equal(advanceBalanceCents(state, ID), 0);

  const { state: voided } = voidPayment(state, ID, '2026-10', advId, { voidReason: 'Advance refunded to customer' });
  const allocations = calculatePaymentAllocations(voided);
  // Every consuming month reopens at its FULL due — the Rs 7,500 of
  // consumption is released exactly once across the chain, and no
  // month keeps a phantom credit or a doubled release.
  assert.deepEqual(monthFigures(allocations, '2026-12'), unpaidMonth);
  assert.deepEqual(monthFigures(allocations, '2027-01'), unpaidMonth);
  assert.deepEqual(monthFigures(allocations, '2027-02'), unpaidMonth);
  // The months the advance never touched are byte-identical in figure.
  assert.deepEqual(monthFigures(allocations, '2026-09'), settledMonth);
  assert.deepEqual(monthFigures(allocations, '2026-10'), settledMonth);
  assert.deepEqual(monthFigures(allocations, '2026-11'), unpaidMonth);
  assert.equal(advanceBalanceCents(voided, ID), 0);
  // The voided advance is excluded from allocations entirely.
  assert.equal(allocations.byPaymentId.has(advId), false);
  // A second void of the same record is refused, never a silent no-op
  // that could mask a double release.
  assert.throws(
    () => voidPayment(voided, ID, '2026-10', advId, { voidReason: 'Void it again' }),
    /already voided/
  );
});

test('untargeted advance on the same settled base keeps plain FIFO across two months', () => {
  let state = settledStart();
  const { nextState, payment } = recordAdvancePayment(state, ID, { amount: 4500, date: '2026-10-29', method: 'Cash' }, OCT_29);
  state = nextState;
  // No target is stored — the targeting must not disturb this shape.
  assert.equal('targetMonth' in payment, false);

  // FIFO serves the FIRST bill that exists: November consumes in full
  // (contrast the targeted chain, where November received nothing).
  state = generateMonthlyBillsThroughCurrentMonth(state, NOV_2);
  let allocations = calculatePaymentAllocations(state);
  assert.deepEqual(monthFigures(allocations, '2026-11'), creditMonth(payment.id, 300000, 0));
  assert.equal(advanceBalanceCents(state, ID), 150000);

  state = generateMonthlyBillsThroughCurrentMonth(state, DEC_2);
  allocations = calculatePaymentAllocations(state);
  assert.deepEqual(monthFigures(allocations, '2026-12'), creditMonth(payment.id, 150000, 150000));
  assert.equal(advanceBalanceCents(state, ID), 0);
  assert.deepEqual(allocations.byPaymentId.get(payment.id).allocations, [
    { month: '2026-11', amountCents: 300000, kind: 'carry-forward' },
    { month: '2026-12', amountCents: 150000, kind: 'carry-forward' }
  ]);
});
