// M16: Void & Reversal Audit Completeness Pin (test-only).
//
// Every money-reversal path in the app must (a) restore dues EXACTLY —
// to the cent — (b) leave a COMPLETE audit record whose fields are the
// ones the shipped code actually writes, and (c) refuse or no-op a
// second reversal of the same record. Per-feature suites pin each path
// in isolation; this file pins the four paths side by side against the
// same three-part discipline, composing the richest stamp stacks:
//
//   1. SISP-34 void (payment-void-audit.js voidPayment) on a payment
//      carrying BOTH a cleared-Waada stamp and a waived-late-fee stamp.
//   2. SISP-141 ten-second undo (quick-undo-toast.js
//      reverseCollectedPayment) on a Quick Collect payment carrying a
//      waived late fee AND a SISP-126 remainder waada that replaced a
//      live promise — the fee is restored through late-fee-waiver.js
//      restoreWaivedLateFee and the promise returns to its exact
//      pre-payment state.
//   3. SISP-111 credit transfer (credit-transfer.js): the reversal
//      restores both customers exactly and flips the register status;
//      voiding the SOURCE funding payment afterwards does NOT unwind a
//      completed transfer (pinned as designed — the transfer stands,
//      the funding side's dues return).
//   4. Deposit paths are DIFFERENT paths (SISP-166 active offset vs
//      SISP-50 settlement + SISP-195 Roznamcha refund bridge): the
//      active offset reverses exactly and refuses a second reversal;
//      the settlement is terminal, its refund leaves the drawer exactly
//      once through the convergent bridge, and neither flow can ever
//      move the same deposit twice.
//
// Synthetic data only — no real customer names or numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyLateFeeToBill,
  calculatePaymentAllocations,
  saveBillMonth
} from '../core.js';
import {
  isVoidedPayment,
  sanitizeVoidPayments,
  voidPayment
} from '../payment-void-audit.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import {
  QUICK_UNDO_GONE,
  findCollectedPayment,
  reverseCollectedPayment
} from '../quick-undo-toast.js';
import {
  lateFeeWaiverOf,
  restoreWaivedLateFee,
  waivedLateFeeStampFor
} from '../late-fee-waiver.js';
import {
  availableCreditCents,
  executeCreditTransfer,
  reverseCreditTransfer,
  sanitizeCreditTransfers
} from '../credit-transfer.js';
import {
  ACTIVE_DEPOSIT_OFFSET_REASON,
  applyActiveDepositOffset,
  depositOffsetEntryOf,
  depositOffsetsOf,
  reverseActiveDepositOffset
} from '../deposit-to-bill-offset.js';
import {
  DEPOSIT_OFFSET_REASON,
  DEPOSIT_REFUND_ROZNAMCHA_CATEGORY,
  applyDepositSettlement,
  depositSettlementOf,
  syncDepositRefundRoznamcha,
  syncedDepositRefundOutflowId
} from '../hardware-custody.js';
import {
  buildMonthEndCashInHand,
  buildRoznamchaDay,
  syncRoznamchaExpenses
} from '../roznamcha.js';
import { buildShopSummaries } from '../shop-settlement.js';

const REF = new Date('2026-10-15T10:00:00Z');
const MONTH = '2026-10';
const DAY = '2026-10-15';

const dueCents = (state, customerId, month) =>
  calculatePaymentAllocations(state).forMonth(customerId, month)?.balanceDueCents;
const totalDueCents = (state, customerId) => {
  const allocations = calculatePaymentAllocations(state);
  const customer = state.customers.find((c) => c.id === customerId);
  let total = 0;
  for (const bill of customer?.bills ?? []) {
    const summary = allocations.forMonth(customerId, bill.month);
    if (summary && typeof summary.balanceDueCents === 'number') total += summary.balanceDueCents;
  }
  return total;
};

/** One customer, one October bill of `dueAmount`, optionally fee'd. */
function billState({ dueAmount = 3000, lateFee = 0, customerExtra = {} } = {}) {
  let state = {
    customers: [{
      id: 'cust-1',
      customerNumber: 101,
      name: 'Reversal Tester',
      phone: '03001234567',
      area: 'Test Area',
      archived: false,
      bills: [],
      ...customerExtra
    }]
  };
  state = saveBillMonth(state, 'cust-1', { month: MONTH, dueAmount, status: 'pending' }, REF);
  if (lateFee > 0) {
    state = applyLateFeeToBill(state, 'cust-1', MONTH, { amount: lateFee, reason: 'Late payment surcharge' }, REF);
  }
  return state;
}

const billOf = (state, month = MONTH) =>
  state.customers.find((c) => c.id === 'cust-1').bills.find((b) => b.month === month);
const customerOf = (state) => state.customers.find((c) => c.id === 'cust-1');

/* ------------------------------------------------------------------ */
/* Path 1 — SISP-34 void: cleared waada + waived late fee composition */
/* ------------------------------------------------------------------ */

test('M16 path 1 (SISP-34 void): dues restored to the cent, void record complete, promise + fee restored, second void refused', () => {
  const before = billState({
    lateFee: 150,
    customerExtra: { promiseDate: '2026-10-25', promiseAmount: 3150, promiseNote: 'Synthetic promise' }
  });
  const duesBefore = dueCents(before, 'cust-1', MONTH);
  assert.equal(duesBefore, 315000);

  // Full-principal collection with the waiver ticked at a shop: the
  // payment clears the promise (clearedWaada stamp) and waives the fee
  // (lateFeeWaived + reversal stamp).
  const { nextState, receipt } = executeQuickCollection(before, {
    customerId: 'cust-1', month: MONTH, amount: 3000, date: DAY,
    method: 'Cash at Waseem Abbasi shop', waiveLateFee: true
  }, REF);
  assert.equal(dueCents(nextState, 'cust-1', MONTH), 0);
  assert.equal(customerOf(nextState).promiseDate, undefined);
  const collected = findCollectedPayment(nextState, 'cust-1', receipt.paymentId).payment;
  assert.equal(collected.clearedWaada?.promiseDate, '2026-10-25');
  assert.ok(lateFeeWaiverOf(collected));
  const waseemUnsettled = (st) =>
    buildShopSummaries(st, []).find((s) => s.shop === 'Waseem Abbasi Shop')?.unsettled ?? 0;
  assert.equal(waseemUnsettled(nextState), 3000);

  const { state: voided, voidRecord } = voidPayment(nextState, 'cust-1', MONTH, receipt.paymentId, {
    voidReason: 'Duplicate entry',
    voidedAt: '2026-10-15T11:30:00.000Z'
  });

  // (a) Dues restored exactly — the voided receipt settles nothing.
  assert.equal(dueCents(voided, 'cust-1', MONTH), duesBefore);
  assert.equal(waseemUnsettled(voided), 0);

  // The original row is preserved and marked — never deleted.
  const row = billOf(voided).payments.find((p) => p.id === receipt.paymentId);
  assert.ok(row);
  assert.equal(billOf(voided).payments.length, 1);
  assert.equal(isVoidedPayment(row), true);
  assert.equal(row.voidedAt, '2026-10-15T11:30:00.000Z');
  assert.equal(row.voidReason, 'Duplicate entry');

  // Cross-ledger legs rolled back: promise and fee return exactly.
  assert.equal(customerOf(voided).promiseDate, '2026-10-25');
  assert.equal(customerOf(voided).promiseAmount, 3150);
  assert.equal(customerOf(voided).promiseNote, 'Synthetic promise');
  assert.equal(billOf(voided).lateFee, 150);
  const restoredEntry = billOf(voided).amountHistory.filter((h) => h.type === 'late_fee_restored');
  assert.equal(restoredEntry.length, 1);
  assert.equal(restoredEntry[0].lateFee, 150);
  assert.equal(restoredEntry[0].previousLateFee, 0);

  // (b) The void record is COMPLETE — every field the shipped audit
  // record carries, including BOTH conditional restoration fields
  // (this void restored a promise and a fee), and no others.
  assert.match(voidRecord.id, /^void-/);
  assert.equal(voidRecord.customerId, 'cust-1');
  assert.equal(voidRecord.customerNumber, 101);
  assert.equal(voidRecord.customerName, 'Reversal Tester');
  assert.equal(voidRecord.billMonth, MONTH);
  assert.equal(voidRecord.paymentId, receipt.paymentId);
  assert.equal(voidRecord.paymentDate, DAY);
  assert.equal(voidRecord.amount, 3000);
  assert.equal(voidRecord.method, 'Cash at Waseem Abbasi shop');
  assert.equal(voidRecord.shop, 'Waseem Abbasi Shop');
  assert.equal(voidRecord.voidReason, 'Duplicate entry');
  assert.equal(voidRecord.voidedAt, '2026-10-15T11:30:00.000Z');
  assert.equal(voidRecord.promiseRestored, true);
  assert.equal(voidRecord.restoredPromiseDate, '2026-10-25');
  assert.equal(voidRecord.lateFeeRestored, true);
  assert.equal(voidRecord.restoredLateFeeAmount, 150);
  assert.equal(voidRecord.createdAt, '2026-10-15T11:30:00.000Z');
  assert.deepEqual(Object.keys(voidRecord).sort(), [
    'amount', 'billMonth', 'createdAt', 'customerId', 'customerName',
    'customerNumber', 'id', 'lateFeeRestored', 'method', 'paymentDate',
    'paymentId', 'promiseRestored', 'restoredLateFeeAmount',
    'restoredPromiseDate', 'shop', 'voidReason', 'voidedAt'
  ]);
  // The record survives the backup sanitizer byte-for-byte.
  assert.deepEqual(sanitizeVoidPayments([voidRecord]), [voidRecord]);

  // (c) A second void of the same payment is refused, changing nothing.
  assert.throws(
    () => voidPayment(voided, 'cust-1', MONTH, receipt.paymentId, { voidReason: 'again' }),
    /already voided/
  );
  assert.equal(dueCents(voided, 'cust-1', MONTH), duesBefore);
  // Input purity: the pre-void state still shows an un-voided payment.
  assert.equal(findCollectedPayment(nextState, 'cust-1', receipt.paymentId).payment.voided, undefined);
});

/* ------------------------------------------------------------------ */
/* Path 2 — SISP-141 undo: waived fee + remainder waada composition   */
/* ------------------------------------------------------------------ */

test('M16 path 2 (SISP-141 undo): payment vanishes, waived fee restored via restoreWaivedLateFee, waada returns to its pre-payment state, second undo is gone', () => {
  // Two priced bills: September Rs. 1,000 unpaid + October Rs. 3,000
  // with a Rs. 150 late fee; a live promise covers the whole Rs. 4,150.
  let before = billState({
    lateFee: 150,
    customerExtra: { promiseDate: '2026-10-20', promiseAmount: 4150, promiseNote: 'Synthetic promise' }
  });
  before = saveBillMonth(before, 'cust-1', { month: '2026-09', dueAmount: 1000, status: 'pending' }, REF);
  const duesBeforeTotal = totalDueCents(before, 'cust-1');
  assert.equal(duesBeforeTotal, 415000);
  assert.equal(dueCents(before, 'cust-1', MONTH), 315000);
  const stampBefore = waivedLateFeeStampFor(billOf(before));

  // Collect October's principal with the waiver ticked and a remainder
  // waada chip for the September remainder: one payment carrying the
  // lateFeeWaived audit pair + reversal stamp AND a remainderWaada
  // stamp that remembers the promise it replaced.
  const { nextState, receipt } = executeQuickCollection(before, {
    customerId: 'cust-1', month: MONTH, amount: 3000, date: DAY, method: 'Cash',
    waiveLateFee: true, remainderWaadaDate: '2026-10-28'
  }, REF);
  const collected = findCollectedPayment(nextState, 'cust-1', receipt.paymentId).payment;
  assert.equal(receipt.waivedAmount, 150);
  assert.equal(collected.lateFeeWaived, true);
  assert.equal(collected.waivedAmount, 150);
  assert.deepEqual(collected.waivedLateFee, stampBefore);
  assert.deepEqual(collected.remainderWaada, {
    promiseDate: '2026-10-28',
    promiseAmount: 1000,
    previousWaada: { promiseDate: '2026-10-20', promiseAmount: 4150, promiseNote: 'Synthetic promise' }
  });
  assert.equal(customerOf(nextState).promiseDate, '2026-10-28');
  assert.equal(customerOf(nextState).promiseAmount, 1000);
  assert.equal(billOf(nextState).lateFee, 0);
  assert.equal(dueCents(nextState, 'cust-1', MONTH), 0);

  const out = reverseCollectedPayment({
    state: nextState, tickets: [], customerId: 'cust-1', paymentId: receipt.paymentId, referenceDate: REF
  });
  const undone = out.nextState;

  // The payment vanishes as if never made.
  assert.equal(findCollectedPayment(undone, 'cust-1', receipt.paymentId), null);
  assert.equal(billOf(undone).payments.length, 0);
  // The waived fee is restored exactly (through restoreWaivedLateFee,
  // whose amountHistory audit entry the undo seam leaves behind).
  assert.equal(billOf(undone).lateFee, 150);
  assert.equal(billOf(undone).lateFeeAppliedAt, stampBefore.lateFeeAppliedAt);
  assert.equal(billOf(undone).lateFeeReason, stampBefore.lateFeeReason);
  const historyTypes = billOf(undone).amountHistory.map((h) => h.type);
  assert.deepEqual(historyTypes, ['late_fee_applied', 'late_fee_waived', 'late_fee_restored']);
  // The waada returns to its exact pre-payment state.
  assert.equal(customerOf(undone).promiseDate, '2026-10-20');
  assert.equal(customerOf(undone).promiseAmount, 4150);
  assert.equal(customerOf(undone).promiseNote, 'Synthetic promise');
  // (a) Dues restored to the cent, per month and in total.
  assert.equal(dueCents(undone, 'cust-1', MONTH), 315000);
  assert.equal(dueCents(undone, 'cust-1', '2026-09'), 100000);
  assert.equal(totalDueCents(undone, 'cust-1'), duesBeforeTotal);
  // Input purity: the collected state is untouched by the undo.
  assert.equal(dueCents(nextState, 'cust-1', MONTH), 0);

  // (c) A second undo of the same payment reports it gone, and a
  // direct second fee restoration is a pure no-op (same reference).
  assert.throws(
    () => reverseCollectedPayment({ state: undone, tickets: [], customerId: 'cust-1', paymentId: receipt.paymentId, referenceDate: REF }),
    (err) => err.code === QUICK_UNDO_GONE
  );
  const again = restoreWaivedLateFee(undone, 'cust-1', collected);
  assert.equal(again.restored, false);
  assert.equal(again.state, undone);
});

/* ------------------------------------------------------------------ */
/* Path 3 — SISP-111 credit transfer reversal + void interaction      */
/* ------------------------------------------------------------------ */

// Customer A: September bill 3,000, paid 5,000 cash -> 2,000 advance credit.
// (Fixture shape copied from tests/credit-transfer.test.js.)
const sourceCustomer = (overrides = {}) => ({
  id: 'cust-a',
  customerNumber: 11,
  name: 'Source Eleven',
  monthlyPriceSchedule: [],
  serviceStatusHistory: [],
  packageHistory: [],
  relocationLog: [],
  installmentPlans: [],
  incidents: [],
  bills: [{
    id: 'bill-a-sep',
    month: '2026-09',
    dueAmount: 3000,
    status: 'pending',
    payments: [{ id: 'pay-a-1', amount: 5000, date: '2026-09-05', method: 'Cash' }]
  }],
  ...overrides
});

// Customer B: October bill 3,000, nothing paid.
const targetCustomer = (overrides = {}) => ({
  id: 'cust-b',
  customerNumber: 22,
  name: 'Target Twentytwo',
  monthlyPriceSchedule: [],
  serviceStatusHistory: [],
  packageHistory: [],
  relocationLog: [],
  installmentPlans: [],
  incidents: [],
  bills: [{
    id: 'bill-b-oct',
    month: '2026-10',
    dueAmount: 3000,
    status: 'pending',
    payments: []
  }],
  ...overrides
});

function doTransfer() {
  const from = sourceCustomer();
  const to = targetCustomer();
  const allocations = calculatePaymentAllocations({ customers: [from, to] });
  return executeCreditTransfer({ fromCustomer: from, toCustomer: to, allocations, transfers: [], amount: 2000, date: '2026-10-29' });
}

test('M16 path 3a (SISP-111 reversal): register record complete, both customers restored to the cent, second reversal refused', () => {
  const { fromCustomer, toCustomer, transfers, transfer } = doTransfer();

  // (b) The register record is COMPLETE — every field the shipped
  // record carries — and survives its backup sanitizer unchanged.
  assert.equal(transfer.transferId, 'TRF-101');
  assert.equal(transfer.fromCustomerId, 'cust-a');
  assert.equal(transfer.fromCustomerNumber, 11);
  assert.equal(transfer.fromCustomerName, 'Source Eleven');
  assert.equal(transfer.toCustomerId, 'cust-b');
  assert.equal(transfer.toCustomerNumber, 22);
  assert.equal(transfer.toCustomerName, 'Target Twentytwo');
  assert.equal(transfer.amount, 2000);
  assert.equal(transfer.date, '2026-10-29');
  assert.equal(transfer.status, 'active');
  assert.deepEqual(transfer.consumedFrom, [{ paymentId: 'pay-a-1', month: '2026-09', amount: 2000 }]);
  assert.deepEqual(transfer.appliedTo, [{ month: '2026-10', amount: 2000 }]);
  assert.equal(transfer.reversedAt, '');
  assert.equal(transfer.reversalNote, '');
  assert.equal(typeof transfer.createdAt, 'string');
  assert.ok(transfer.createdAt.length > 0);
  assert.deepEqual(sanitizeCreditTransfers(transfers), transfers);

  // Post-transfer position: A's credit fully consumed, B owes 1,000.
  const midState = { customers: [fromCustomer, toCustomer] };
  assert.equal(availableCreditCents(calculatePaymentAllocations(midState), 'cust-a', '2026-10'), 0);
  assert.equal(dueCents(midState, 'cust-b', '2026-10'), 100000);

  const reversed = reverseCreditTransfer({
    transfers, transferId: 'TRF-101', fromCustomer, toCustomer, date: '2026-10-30', note: 'Recorded against the wrong relative.'
  });

  // The record is flipped, never deleted, and the flip is audited.
  assert.equal(reversed.transfers.length, 1);
  assert.equal(reversed.transfer.status, 'reversed');
  assert.equal(reversed.transfer.reversedAt, '2026-10-30');
  assert.equal(reversed.transfer.reversalNote, 'Recorded against the wrong relative.');
  assert.equal(reversed.fromCustomer.bills[0].amountHistory.at(-1).type, 'credit_transfer_reversed_out');
  assert.equal(reversed.toCustomer.bills[0].amountHistory.at(-1).type, 'credit_transfer_reversed_in');

  // (a) Both customers derive EXACTLY as before the transfer.
  const afterState = { customers: [reversed.fromCustomer, reversed.toCustomer] };
  const afterAlloc = calculatePaymentAllocations(afterState);
  assert.equal(afterAlloc.byPaymentId.get('pay-a-1')?.unappliedCreditCents, 200000);
  assert.equal(availableCreditCents(afterAlloc, 'cust-a', '2026-10'), 200000);
  assert.equal(dueCents(afterState, 'cust-b', '2026-10'), 300000);
  assert.equal(reversed.fromCustomer.bills[0].creditTransferOut, undefined);
  assert.equal(reversed.toCustomer.bills[0].creditTransferInAmount, undefined);

  // (c) A second reversal of the same record is refused.
  assert.throws(() => reverseCreditTransfer({
    transfers: reversed.transfers, transferId: 'TRF-101',
    fromCustomer: reversed.fromCustomer, toCustomer: reversed.toCustomer, date: '2026-10-31'
  }), /already reversed/);
});

test('M16 path 3b (SISP-111 as designed): voiding the funding payment does NOT unwind the transfer — the transfer stands, the funding side\u2019s dues return', () => {
  const { fromCustomer, toCustomer, transfers } = doTransfer();
  const state = { customers: [fromCustomer, toCustomer] };
  assert.equal(dueCents(state, 'cust-a', '2026-09'), 0);
  assert.equal(dueCents(state, 'cust-b', '2026-10'), 100000);

  // Void A's Rs. 5,000 funding payment (the receipt that generated the
  // transferred credit) for an unrelated recording error.
  const { state: voided, voidRecord } = voidPayment(state, 'cust-a', '2026-09', 'pay-a-1', {
    voidReason: 'Wrong amount recorded',
    voidedAt: '2026-10-30T09:00:00.000Z'
  });

  // The funding side's dues return in full: the voided receipt no
  // longer settles A's September bill.
  assert.equal(dueCents(voided, 'cust-a', '2026-09'), 300000);
  assert.equal(availableCreditCents(calculatePaymentAllocations(voided), 'cust-a', '2026-10'), 0);

  // The transfer STANDS: B keeps the transferred credit exactly, A's
  // bill keeps its transfer-out stamp, and the register record (held
  // outside the ledger) is untouched by the void — still 'active'.
  assert.equal(dueCents(voided, 'cust-b', '2026-10'), 100000);
  const bBill = voided.customers.find((c) => c.id === 'cust-b').bills[0];
  assert.equal(bBill.creditTransferInAmount, 2000);
  const aBill = voided.customers.find((c) => c.id === 'cust-a').bills[0];
  assert.deepEqual(aBill.creditTransferOut, [{
    transferId: 'TRF-101', paymentId: 'pay-a-1', amount: 2000, date: '2026-10-29', toCustomerId: 'cust-b'
  }]);
  assert.equal(transfers[0].status, 'active');

  // The void itself is an ordinary, complete SISP-34 record — no
  // restoration legs ran, so no conditional fields are present.
  assert.equal(voidRecord.amount, 5000);
  assert.equal(voidRecord.promiseRestored, false);
  assert.equal(voidRecord.restoredPromiseDate, '');
  assert.equal('lateFeeRestored' in voidRecord, false);
  assert.equal('remainderWaadaReverted' in voidRecord, false);
  assert.deepEqual(sanitizeVoidPayments([voidRecord]), [voidRecord]);
});

/* ------------------------------------------------------------------ */
/* Path 4 — deposit: active offset reversal vs settlement refund      */
/* ------------------------------------------------------------------ */

// Engine pending balance + per-bill balances, as app.js computes them.
// (Shape copied from tests/deposit-to-bill-offset.test.js.)
function enginePending(customer) {
  const allocations = calculatePaymentAllocations({ customers: [customer] });
  let cents = 0;
  const billBalances = [];
  for (const bill of customer.bills ?? []) {
    const summary = allocations.forMonth(customer.id, bill.month);
    if (summary && typeof summary.balanceDueCents === 'number' && summary.balanceDueCents > 0) {
      cents += summary.balanceDueCents;
      billBalances.push({ month: bill.month, balanceDue: summary.balanceDueCents / 100 });
    }
  }
  return { pending: cents / 100, billBalances };
}

const activeOffsetCustomer = (overrides = {}) => ({
  id: 'cust-off-1',
  customerNumber: 51,
  name: 'Test Customer 51',
  archived: false,
  isFreeConnection: false,
  securityDeposit: 5000,
  bills: [{ id: 'bill-oct', month: '2026-10', dueAmount: 3000, status: 'pending', payments: [] }],
  ...overrides
});

// Disconnected customer: deposit 2000, arrears 1200, hardware recovered.
// (Fixture shape copied from tests/deposit-settlement-roznamcha.test.js.)
const disconnectedCustomer = (overrides = {}) => ({
  id: 'cust-dep-1',
  customerNumber: 41,
  name: 'Test Customer 41',
  archived: true,
  archivedAt: '2026-10-05T10:00',
  securityDeposit: 2000,
  routerOwnership: 'isp-owned',
  mediaConverterOwnership: 'isp-owned',
  routerPrice: 1500,
  mediaConverterCost: 800,
  hardwareRecovered: { router: '2026-10-06', mediaConverter: '2026-10-06' },
  bills: [{ id: 'bill-sep', month: '2026-09', dueAmount: 1200, status: 'pending', payments: [] }],
  ...overrides
});

test('M16 path 4a (SISP-166 active offset reversal): entry complete, deposit + dues restored to the cent, second reversal refused', () => {
  const customer = activeOffsetCustomer();
  const { pending, billBalances } = enginePending(customer);
  assert.equal(pending, 3000);
  const duesBeforeCents = 300000;

  const offset = applyActiveDepositOffset(customer, pending, { date: '2026-10-15', amount: 3000, billBalances });
  assert.equal(enginePending(offset).pending, 0);
  assert.equal(offset.securityDeposit, 2000);
  // An active offset stamps NO disconnection settlement — the two
  // deposit paths stay distinct by construction.
  assert.equal(depositSettlementOf(offset), null);

  // (b) The append-only audit entry is COMPLETE.
  const entry = depositOffsetEntryOf(offset, 'DOF-101');
  assert.deepEqual(entry, {
    id: 'DOF-101',
    date: '2026-10-15',
    amount: 3000,
    bills: [{ month: '2026-10', amount: 3000 }],
    depositBefore: 5000,
    depositAfter: 2000,
    reversedAt: null
  });
  assert.equal(offset.bills[0].depositOffsetAmount, 3000);
  assert.equal(offset.bills[0].depositOffsetReason, ACTIVE_DEPOSIT_OFFSET_REASON);
  assert.equal(offset.bills[0].amountHistory.at(-1).type, 'deposit_offset_active_applied');
  assert.equal(offset.bills[0].amountHistory.at(-1).offsetId, 'DOF-101');

  const reversed = reverseActiveDepositOffset(offset, 'DOF-101', { date: '2026-10-20' });

  // (a) Deposit and dues restored EXACTLY; no payment was ever created.
  assert.equal(reversed.securityDeposit, 5000);
  assert.equal(enginePending(reversed).pending * 100, duesBeforeCents);
  assert.equal(reversed.bills[0].depositOffsetAmount, 0);
  assert.equal(reversed.bills[0].payments.length, 0);
  // The entry stays in the log, stamped — audit is never deleted.
  assert.equal(depositOffsetsOf(reversed).length, 1);
  assert.equal(depositOffsetEntryOf(reversed, 'DOF-101').reversedAt, '2026-10-20');
  assert.equal(reversed.bills[0].amountHistory.at(-1).type, 'deposit_offset_active_reversed');
  assert.equal(reversed.bills[0].amountHistory.at(-1).offsetId, 'DOF-101');

  // (c) A second reversal of the same entry is refused.
  assert.throws(
    () => reverseActiveDepositOffset(reversed, 'DOF-101', { date: '2026-10-21' }),
    /already reversed/
  );
  assert.equal(enginePending(reversed).pending * 100, duesBeforeCents);
});

test('M16 path 4b (SISP-50 settlement + SISP-195 refund bridge): settlement record complete, refund leaves the drawer exactly once, paths never double-move a deposit', () => {
  const customer = disconnectedCustomer();
  const { pending, billBalances } = enginePending(customer);
  assert.equal(pending, 1200);

  const settled = applyDepositSettlement(customer, pending, {
    date: '2026-10-29', billBalances, recordRoznamchaRefund: true
  });

  // (b) The settlement record is COMPLETE — every field the shipped
  // record carries, incl. the SISP-195 bridge stamp — and the deposit
  // is fully consumed exactly once (1200 arrears offset + 800 refund).
  assert.deepEqual(depositSettlementOf(settled), {
    settledAt: '2026-10-29',
    securityDeposit: 2000,
    arrearsOffset: 1200,
    unrecoveredHardwareCharge: 0,
    hardwareCovered: 0,
    refundAmount: 800,
    arrearsRemaining: 0,
    hardwareOutstanding: 0,
    receiptNumber: '',
    offsets: [{ month: '2026-09', amount: 1200 }],
    hardwareCharges: [],
    roznamchaRefund: true
  });
  assert.equal(settled.securityDeposit, 0);
  // The arrears were covered by the settlement's OWN bill stamps —
  // the refund bridge must not (and does not) touch dues again.
  assert.equal(settled.bills[0].depositOffsetAmount, 1200);
  assert.equal(settled.bills[0].depositOffsetReason, DEPOSIT_OFFSET_REASON);
  assert.equal(settled.bills[0].amountHistory.at(-1).type, 'deposit_offset_applied');
  assert.equal(enginePending(settled).pending, 0);

  // The refund leaves the drawer exactly once, through the bridge.
  const customersJsonBefore = JSON.stringify([settled]);
  const first = syncDepositRefundRoznamcha([], [settled]);
  assert.equal(JSON.stringify([settled]), customersJsonBefore, 'the bridge never mutates customer records');
  assert.equal(first.added, 1);
  assert.equal(first.days.length, 1);
  assert.equal(first.days[0].date, '2026-10-29');
  assert.equal(first.days[0].outflows.length, 1);
  const outflow = first.days[0].outflows[0];
  assert.equal(outflow.id, syncedDepositRefundOutflowId('cust-dep-1'));
  assert.equal(outflow.amount, 800);
  assert.equal(outflow.category, DEPOSIT_REFUND_ROZNAMCHA_CATEGORY);

  // Drawer truth: expected closing and month-end cash in hand drop by
  // exactly the refund — once.
  const state = { customers: [settled] };
  const baselineDay = buildRoznamchaDay(state, [], '2026-10-29', []);
  const bridgedDay = buildRoznamchaDay(state, first.days, '2026-10-29', []);
  assert.equal(baselineDay.expectedClosing - bridgedDay.expectedClosing, 800);
  const baselineCash = buildMonthEndCashInHand(state, [], '2026-10', []);
  const bridgedCash = buildMonthEndCashInHand(state, first.days, '2026-10', []);
  assert.equal(baselineCash.balance - bridgedCash.balance, 800);
  // The refund is not an expense and never reaches the Expenses ledger.
  const expenseSync = syncRoznamchaExpenses([], first.days, new Date('2026-10-29T00:00:00Z'));
  assert.equal(expenseSync.changed, false);
  assert.equal(expenseSync.expenses.length, 0);

  // (c) Re-running the convergent bridge is a no-op — the refund can
  // never be recorded (or leave the drawer) twice.
  const second = syncDepositRefundRoznamcha(first.days, [settled]);
  assert.equal(second.changed, false);
  assert.equal(second.days, first.days);
  assert.equal(second.days[0].outflows.length, 1);

  // The two deposit flows can never both move the same deposit: a
  // settled deposit refuses the active offset AND its reversal path,
  // and a settlement can never run twice.
  assert.throws(
    () => applyActiveDepositOffset(settled, 0, { date: '2026-10-30', amount: 100, billBalances: [] }),
    /archived|already settled/i
  );
  assert.throws(
    () => reverseActiveDepositOffset(settled, 'DOF-101', { date: '2026-10-30' }),
    /archived/
  );
  assert.throws(
    () => applyDepositSettlement(settled, 0, { date: '2026-10-30', billBalances: [] }),
    /already settled/
  );
  // ...and offset money never leaks into the refund bridge: an active
  // offset customer produces no bridge outflow at all.
  const active = activeOffsetCustomer();
  const { pending: activePending, billBalances: activeBalances } = enginePending(active);
  const offsetOnly = applyActiveDepositOffset(active, activePending, { date: '2026-10-15', amount: 3000, billBalances: activeBalances });
  const bridgeOverOffset = syncDepositRefundRoznamcha([], [offsetOnly]);
  assert.equal(bridgeOverOffset.changed, false);
  assert.deepEqual(bridgeOverOffset.days, []);
});
