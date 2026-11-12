// Sharafat 4 — Split 5-second undo fails when a leg settled a speed-boost charge.
//
// deletePayment refuses any payment that settled addon charges unless
// addonChargesReverted: true (core.js, SISP-106). The single-payment
// undo passes that flag after reopening the boosts, but the split-undo
// branch passed only ticketChargesReverted and stored only ticketCharges
// per leg in activeUndoContext — addon lines were never captured or
// reopened. A split that settled a boost failed undo with a toast error
// and the payment stayed. The split undo now captures each leg's
// addonCharges in the context, reopens them before deleting each leg
// (mirroring the ticket path), and passes addonChargesReverted: true.
//
// Pattern-fake data only: Test Customer (#101).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { calculatePaymentAllocations, createInitialState, deletePayment, saveBillMonth } from '../core.js';
import { addSpeedBoost, addonChargesPending, speedBoostsOf, unsettleAddonChargesForPayment } from '../speed-addon.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import { executeSplitTenderCollection } from '../split-tender-collect.js';

const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');

const REF = new Date('2026-10-15T10:00:00Z');
const MONTH = '2026-10';
const BOOST = { boostMbps: 15, durationDays: 10, addonFeePKR: 500, startDate: '2026-10-05' };

function stateWithBill(dueAmount = 2000) {
  const state = createInitialState([]);
  state.customers.push({
    id: 'cust-1',
    customerNumber: 101,
    name: 'Test Customer',
    phone: '03001234567',
    area: 'Test Area',
    archived: false,
    packageSpeed: '5 Mbps',
    monthlySellingAmount: dueAmount,
    bills: []
  });
  return saveBillMonth(state, 'cust-1', { month: MONTH, dueAmount, status: 'pending' }, REF);
}

function stateWithBoost(dueAmount = 2000) {
  return addSpeedBoost(stateWithBill(dueAmount), 'cust-1', BOOST, REF).state;
}

function balanceCents(state) {
  return calculatePaymentAllocations(state).forMonth('cust-1', MONTH)?.balanceDueCents;
}

function collectSplit(state, legs) {
  return executeSplitTenderCollection(state, {
    customerId: 'cust-1',
    month: MONTH,
    date: '2026-10-15',
    paidBy: 'Self',
    tickets: [],
    legs
  }, { execute: executeQuickCollection, referenceDate: REF });
}

// The split-undo's own steps, in order, exactly as executeUndo runs
// them: newest leg first, reopen the leg's settled lines, then delete
// the leg with the matching reverted flag.
function undoSplitLegs(state, splitLegs) {
  let workingState = state;
  for (const leg of [...splitLegs].reverse()) {
    const legLines = Array.isArray(leg.ticketCharges) ? leg.ticketCharges : [];
    const legAddonLines = Array.isArray(leg.addonCharges) ? leg.addonCharges : [];
    if (legAddonLines.length > 0) {
      const cust = workingState.customers.find((c) => c.id === 'cust-1');
      const { customer: reopenedCustomer } = unsettleAddonChargesForPayment(cust, { id: leg.paymentId, addonCharges: legAddonLines });
      workingState = { ...workingState, customers: workingState.customers.map((c) => (c.id === 'cust-1' ? reopenedCustomer : c)) };
    }
    workingState = deletePayment(workingState, 'cust-1', MONTH, leg.paymentId, REF, {
      ...(legLines.length > 0 ? { ticketChargesReverted: true } : {}),
      ...(legAddonLines.length > 0 ? { addonChargesReverted: true } : {})
    });
  }
  return workingState;
}

/* ------------------- undo seam: leg settles a boost ---------------------- */

test('undo seam: a split whose leg 2 settles a boost undoes cleanly — boost pending again, both legs deleted', () => {
  const before = stateWithBoost();
  assert.equal(addonChargesPending(before.customers[0]), 500);

  const { nextState, receipts } = collectSplit(before, [
    { amount: 2000, method: 'Cash' },
    { amount: 500, method: 'Easypaisa', transactionId: 'EP99887766' }
  ]);
  // Leg 1 pays the bill; leg 2 settles the boost.
  assert.deepEqual(receipts[0].addonCharges, []);
  assert.deepEqual(receipts[1].addonCharges, [{ boostId: 'BST-101', amount: 500 }]);
  const settled = nextState.customers[0];
  assert.equal(speedBoostsOf(settled)[0].chargePaid, true);
  assert.equal(speedBoostsOf(settled)[0].chargePaymentId, receipts[1].paymentId);
  assert.equal(addonChargesPending(settled), 0);
  assert.equal(balanceCents(nextState), 0);

  // The split-undo context, built exactly as the submit builds it.
  const splitLegs = [
    { paymentId: receipts[0].paymentId, ticketCharges: receipts[0].ticketCharges ?? [], addonCharges: receipts[0].addonCharges ?? [] },
    { paymentId: receipts[1].paymentId, ticketCharges: receipts[1].ticketCharges ?? [], addonCharges: receipts[1].addonCharges ?? [] }
  ];
  const undone = undoSplitLegs(nextState, splitLegs);

  const custAfter = undone.customers[0];
  assert.equal(custAfter.bills.find((b) => b.month === MONTH).payments.length, 0);
  assert.equal(speedBoostsOf(custAfter)[0].chargePaid, false);
  assert.equal(speedBoostsOf(custAfter)[0].chargePaymentId, '');
  assert.equal(addonChargesPending(custAfter), 500);
  assert.equal(balanceCents(undone), 200000);
});

test('guard: deletePayment refuses a boost-settling leg without the flag — the failure the old undo hit', () => {
  const before = stateWithBoost();
  const { nextState, receipts } = collectSplit(before, [
    { amount: 2000, method: 'Cash' },
    { amount: 500, method: 'Easypaisa', transactionId: 'EP99887766' }
  ]);
  const leg2 = receipts[1].paymentId;
  assert.throws(
    () => deletePayment(nextState, 'cust-1', MONTH, leg2, REF),
    /speed boost charge/
  );
  // With the flag — the reopened boost behind it — the delete lands.
  const cust = nextState.customers[0];
  const { customer: reopened } = unsettleAddonChargesForPayment(cust, { id: leg2, addonCharges: receipts[1].addonCharges });
  const reopenedState = { ...nextState, customers: nextState.customers.map((c) => (c.id === 'cust-1' ? reopened : c)) };
  const deleted = deletePayment(reopenedState, 'cust-1', MONTH, leg2, REF, { addonChargesReverted: true });
  assert.equal(deleted.customers[0].bills.find((b) => b.month === MONTH).payments.length, 1);
});

test('undo seam: a split that settled nothing still undoes — both legs deleted, dues back', () => {
  const before = stateWithBill(3000);
  const { nextState, receipts } = collectSplit(before, [
    { amount: 2000, method: 'Cash' },
    { amount: 1000, method: 'Easypaisa', transactionId: 'EP99887766' }
  ]);
  assert.equal(balanceCents(nextState), 0);
  assert.deepEqual(receipts[0].addonCharges, []);
  assert.deepEqual(receipts[1].addonCharges, []);

  const splitLegs = [
    { paymentId: receipts[0].paymentId, ticketCharges: receipts[0].ticketCharges ?? [], addonCharges: receipts[0].addonCharges ?? [] },
    { paymentId: receipts[1].paymentId, ticketCharges: receipts[1].ticketCharges ?? [], addonCharges: receipts[1].addonCharges ?? [] }
  ];
  const undone = undoSplitLegs(nextState, splitLegs);
  assert.equal(undone.customers[0].bills.find((b) => b.month === MONTH).payments.length, 0);
  assert.equal(balanceCents(undone), 300000);
});

/* ------------------------------ wiring ----------------------------------- */

test('wiring: the split-undo context captures each leg’s addonCharges', () => {
  const start = wiringSrc.indexOf('splitLegs: [');
  assert.ok(start > 0, 'split undo context found');
  const slice = wiringSrc.slice(start, start + 900);
  assert.match(slice, /addonCharges: legReceipt1\.addonCharges \?\? \[\]/);
  assert.match(slice, /addonCharges: legReceipt2\.addonCharges \?\? \[\]/);
  // Both ride the same per-leg entries as the ticket lines.
  assert.ok(
    slice.indexOf('ticketCharges: legReceipt1.ticketCharges') < slice.indexOf('addonCharges: legReceipt1.addonCharges'),
    'leg 1 carries its addon lines beside its ticket lines'
  );
  assert.ok(
    slice.indexOf('ticketCharges: legReceipt2.ticketCharges') < slice.indexOf('addonCharges: legReceipt2.addonCharges'),
    'leg 2 carries its addon lines beside its ticket lines'
  );
});

test('wiring: the split-undo loop reopens each leg’s addon lines before the delete and passes addonChargesReverted', () => {
  const start = wiringSrc.indexOf('function executeUndo()');
  assert.ok(start > 0, 'delete-undo function found');
  const slice = wiringSrc.slice(start, start + 9000);
  assert.match(slice, /const legAddonLines = Array\.isArray\(leg\.addonCharges\) \? leg\.addonCharges : \[\];/);
  assert.match(slice, /unsettleAddonChargesForPayment\(cust, \{ id: leg\.paymentId, addonCharges: legAddonLines \}\)/);
  assert.match(slice, /addonChargesReverted: true/);
  // The reopen lands before the leg's delete, and the flag rides that
  // same delete — the guard's contract, mirroring the ticket path.
  const reopenAt = slice.indexOf('unsettleAddonChargesForPayment(cust, { id: leg.paymentId, addonCharges: legAddonLines })');
  const deleteAt = slice.indexOf('deletePayment(workingState, customerId, month, leg.paymentId');
  assert.ok(reopenAt > 0 && deleteAt > 0 && reopenAt < deleteAt, 'addon lines reopen before the leg is deleted');
  assert.ok(
    slice.indexOf('addonChargesReverted: true') > deleteAt,
    'the flag rides the leg delete'
  );
});
