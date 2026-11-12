// Sharafat 3 — Quick Collect undo never restores a waada the payment auto-cleared.
//
// Recording a FULL payment auto-clears the customer's promise (SISP-3)
// and stamps it on the payment as clearedWaada (SISP-34). Only voiding
// the payment restored it — the five-second delete-undo never did, so
// undoing a full payment left the promise gone with no payment behind
// it. The delete-undo now restores the stamped promise exactly as
// voidPayment does, only while no newer promise exists; the sixty-second
// reversal undo refuses a cleared-waada payment instead (it moves money
// only, and the promise would stay cleared).
//
// Out of scope, disclosed: the host-level 10-second toast undo
// (reverseCollectedPayment in quick-undo-toast.js) still follows
// deletePayment's discipline — its own pin test asserts the cleared
// promise is never restored there. That seam is a follow-up, not
// changed here.
//
// Pattern-fake data only: Test Customer (#101).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { clearedWaadaOf, restoreClearedWaada, setCustomerWaada } from '../waada-queue.js';
import { calculatePaymentAllocations, deletePayment, saveBillMonth } from '../core.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import { executeSplitTenderCollection, splitPaymentsOf, splitTenderOf } from '../split-tender-collect.js';
import { quickCollectReversalUndoFields } from '../quick-collect-reversal-undo.js';
import { voidPayment } from '../payment-void-audit.js';

const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const moduleSrc = readFileSync(new URL('../quick-collect-reversal-undo.js', import.meta.url), 'utf8');

const REF = new Date('2026-10-15T10:00:00Z');
const MONTH = '2026-10';
const DAY = '2026-10-15';
const PROMISE = { promiseDate: '2026-10-20', promiseAmount: 3000, promiseNote: 'Friday' };

function stateWithBill(dueAmount = 3000, customerExtra = {}) {
  let state = {
    customers: [{
      id: 'cust-1',
      customerNumber: 101,
      name: 'Test Customer',
      phone: '03001234567',
      area: 'Test Area',
      archived: false,
      bills: [],
      ...customerExtra
    }]
  };
  state = saveBillMonth(state, 'cust-1', { month: MONTH, dueAmount, status: 'pending' }, REF);
  return state;
}

function balanceCents(state) {
  return calculatePaymentAllocations(state).forMonth('cust-1', MONTH)?.balanceDueCents;
}

function collect(state, args = {}) {
  return executeQuickCollection(state, {
    customerId: 'cust-1',
    month: MONTH,
    amount: 3000,
    date: DAY,
    method: 'Cash',
    ...args
  }, REF);
}

function paymentOf(state, paymentId) {
  return state.customers[0].bills.find((b) => b.month === MONTH)?.payments?.find((p) => p.id === paymentId);
}

/* ------------------------- clearedWaadaOf reader ------------------------- */

test('reader: a valid cleared-waada stamp reads back date, amount and note', () => {
  assert.deepEqual(
    clearedWaadaOf({ clearedWaada: { promiseDate: ' 2026-10-20 ', promiseAmount: 3000, promiseNote: 'Friday' } }),
    { promiseDate: '2026-10-20', promiseAmount: 3000, promiseNote: 'Friday' }
  );
  // A promise with no recorded amount still reads — voidPayment
  // restores it the same way.
  assert.deepEqual(
    clearedWaadaOf({ clearedWaada: { promiseDate: '2026-10-20', promiseAmount: null, promiseNote: '' } }),
    { promiseDate: '2026-10-20', promiseAmount: null, promiseNote: '' }
  );
});

test('reader: missing, non-object or invalid-date stamps read as null', () => {
  assert.equal(clearedWaadaOf({}), null);
  assert.equal(clearedWaadaOf({ clearedWaada: null }), null);
  assert.equal(clearedWaadaOf({ clearedWaada: '2026-10-20' }), null);
  assert.equal(clearedWaadaOf({ clearedWaada: { promiseDate: '2026-02-30', promiseAmount: 3000 } }), null);
  assert.equal(clearedWaadaOf({ clearedWaada: { promiseDate: 'not-a-date', promiseAmount: 3000 } }), null);
  assert.equal(clearedWaadaOf({ clearedWaada: { promiseAmount: 3000 } }), null);
  assert.equal(clearedWaadaOf(null), null);
  assert.equal(clearedWaadaOf(undefined), null);
});

/* ------------------------ restoreClearedWaada ---------------------------- */

test('restore: puts the stamped promise back on a promise-less customer, input untouched', () => {
  const customer = { id: 'cust-1', name: 'Test Customer', bills: [] };
  const restored = restoreClearedWaada(customer, { promiseDate: '2026-10-20', promiseAmount: 3000, promiseNote: 'Friday' });
  assert.equal(restored.promiseDate, '2026-10-20');
  assert.equal(restored.promiseAmount, 3000);
  assert.equal(restored.promiseNote, 'Friday');
  assert.equal(restored.bills, customer.bills);
  // Pure: the input keeps no promise.
  assert.equal(customer.promiseDate, undefined);
  assert.notEqual(restored, customer);
});

test('restore: mirrors voidPayment — no amount or note is invented when the stamp carries none', () => {
  const restored = restoreClearedWaada(
    { id: 'cust-1', bills: [] },
    { promiseDate: '2026-10-20', promiseAmount: null, promiseNote: '' }
  );
  assert.equal(restored.promiseDate, '2026-10-20');
  assert.equal('promiseAmount' in restored, false);
  assert.equal('promiseNote' in restored, false);
});

test('restore: a newer promise is never clobbered — null, customer untouched', () => {
  const customer = { id: 'cust-1', promiseDate: '2026-10-25', promiseAmount: 1500, promiseNote: 'New promise', bills: [] };
  assert.equal(
    restoreClearedWaada(customer, { promiseDate: '2026-10-20', promiseAmount: 3000, promiseNote: 'Friday' }),
    null
  );
  assert.equal(customer.promiseDate, '2026-10-25');
});

test('restore: null for a damaged stamp or a missing customer', () => {
  const customer = { id: 'cust-1', bills: [] };
  assert.equal(restoreClearedWaada(customer, { promiseDate: '2026-02-30', promiseAmount: 3000 }), null);
  assert.equal(restoreClearedWaada(customer, null), null);
  assert.equal(restoreClearedWaada(customer, '2026-10-20'), null);
  assert.equal(restoreClearedWaada(null, { promiseDate: '2026-10-20', promiseAmount: 3000 }), null);
});

/* ------------------- delete-undo seam: single payment -------------------- */

test('undo seam: a full payment that clears a waada, undone, leaves the original promise back', () => {
  const before = stateWithBill(3000, { ...PROMISE });
  const { nextState, receipt } = collect(before);
  // The full payment cleared the promise and stamped the payment.
  assert.equal(nextState.customers[0].promiseDate, undefined);
  assert.equal(balanceCents(nextState), 0);
  const stamped = paymentOf(nextState, receipt.paymentId);
  assert.equal(stamped.clearedWaada?.promiseDate, '2026-10-20');

  // The delete-undo's own steps, in order: capture the stamp BEFORE
  // the delete, delete the payment, restore the stamped promise.
  const undoClearedWaada = clearedWaadaOf(stamped);
  assert.ok(undoClearedWaada);
  const deleted = deletePayment(nextState, 'cust-1', MONTH, receipt.paymentId, REF);
  assert.equal(balanceCents(deleted), 300000);
  const custAfter = deleted.customers.find((c) => c.id === 'cust-1');
  const restored = restoreClearedWaada(custAfter, undoClearedWaada);
  assert.ok(restored);
  assert.equal(restored.promiseDate, PROMISE.promiseDate);
  assert.equal(restored.promiseAmount, PROMISE.promiseAmount);
  assert.equal(restored.promiseNote, PROMISE.promiseNote);
});

test('undo seam: a newer promise set after the payment is never clobbered by the undo', () => {
  const before = stateWithBill(3000, { ...PROMISE });
  const { nextState, receipt } = collect(before);
  const stamped = paymentOf(nextState, receipt.paymentId);
  const undoClearedWaada = clearedWaadaOf(stamped);
  assert.ok(undoClearedWaada);

  // The operator re-promised after the collection, before undoing it.
  const rePromised = {
    ...nextState,
    customers: nextState.customers.map((c) => (c.id === 'cust-1'
      ? setCustomerWaada(c, { promiseDate: '2026-10-25', promiseAmount: 1500, promiseNote: 'New promise' })
      : c))
  };
  const deleted = deletePayment(rePromised, 'cust-1', MONTH, receipt.paymentId, REF);
  const custAfter = deleted.customers.find((c) => c.id === 'cust-1');
  assert.equal(restoreClearedWaada(custAfter, undoClearedWaada), null);
  assert.equal(custAfter.promiseDate, '2026-10-25');
  assert.equal(custAfter.promiseAmount, 1500);
  assert.equal(custAfter.promiseNote, 'New promise');
  assert.equal(balanceCents(deleted), 300000);
});

test('undo seam: the restored promise matches voidPayment field for field', () => {
  const before = stateWithBill(3000, { ...PROMISE });
  const { nextState, receipt } = collect(before);
  const stamped = paymentOf(nextState, receipt.paymentId);

  const viaUndo = restoreClearedWaada(
    deletePayment(nextState, 'cust-1', MONTH, receipt.paymentId, REF).customers[0],
    clearedWaadaOf(stamped)
  );
  const viaVoid = voidPayment(nextState, 'cust-1', MONTH, receipt.paymentId, {
    voidReason: 'Test void',
    voidedAt: '2026-10-15T11:00:00.000Z'
  }).state.customers[0];
  assert.equal(viaUndo.promiseDate, viaVoid.promiseDate);
  assert.equal(viaUndo.promiseAmount, viaVoid.promiseAmount);
  assert.equal(viaUndo.promiseNote, viaVoid.promiseNote);
});

/* --------------------- delete-undo seam: split legs ---------------------- */

test('undo seam: a split that fully pays stamps one leg, and undoing both legs restores the promise', () => {
  const NOW = new Date('2026-10-29T12:00:00+05:00');
  let state = {
    version: 1,
    nextCustomerNumber: 2,
    customers: [{
      id: 'a', customerNumber: 1, name: 'Customer 1', phone: '03000000001',
      area: 'Shahdara', archived: false, bills: [], ...PROMISE
    }]
  };
  state = saveBillMonth(state, 'a', { month: MONTH, dueAmount: 3000, status: 'pending' }, NOW);
  const { nextState, receipts } = executeSplitTenderCollection(state, {
    customerId: 'a', month: MONTH, date: '2026-10-29', paidBy: 'Self',
    legs: [
      { amount: 2000, method: 'Cash' },
      { amount: 1000, method: 'Easypaisa', transactionId: 'EP99887766' }
    ]
  }, { execute: executeQuickCollection, referenceDate: NOW });
  assert.equal(nextState.customers[0].promiseDate, undefined);
  assert.equal(calculatePaymentAllocations(nextState).forMonth('a', MONTH).balanceDueCents, 0);

  // Exactly one leg carries the cleared-waada stamp — the leg that
  // completed the payment.
  const groupId = splitTenderOf(nextState.customers[0].bills[0].payments[0]).groupId;
  const legs = splitPaymentsOf(nextState, 'a', groupId);
  assert.equal(legs.length, 2);
  const stampedLegs = legs.filter((leg) => clearedWaadaOf(leg.payment) !== null);
  assert.equal(stampedLegs.length, 1);
  assert.equal(clearedWaadaOf(stampedLegs[0].payment).promiseDate, '2026-10-20');

  // The split-undo's own steps, in order: capture the stamp BEFORE
  // either leg is deleted, delete both legs newest first, restore.
  const splitClearedWaada = legs.map((leg) => clearedWaadaOf(leg.payment)).find((s) => s !== null) ?? null;
  assert.ok(splitClearedWaada);
  let working = nextState;
  for (const leg of [...legs].reverse()) {
    working = deletePayment(working, 'a', MONTH, leg.payment.id, NOW);
  }
  assert.equal(calculatePaymentAllocations(working).forMonth('a', MONTH).balanceDueCents, 300000);
  const restored = restoreClearedWaada(working.customers[0], splitClearedWaada);
  assert.ok(restored);
  assert.equal(restored.promiseDate, PROMISE.promiseDate);
  assert.equal(restored.promiseAmount, PROMISE.promiseAmount);
  assert.equal(restored.promiseNote, PROMISE.promiseNote);
  assert.equal(receipts.length, 2);
});

/* ------------------- reversal undo refuses the stamp --------------------- */

test('reversal: fields are null for a payment that cleared a waada — the money-only reversal cannot take it', () => {
  const options = { date: DAY, reason: 'Wrong amount entered' };
  assert.equal(
    quickCollectReversalUndoFields(
      { id: 'P-ORIG', amount: 3000, method: 'Cash', clearedWaada: { ...PROMISE } },
      options
    ),
    null
  );
  // A damaged stamp holds no restorable promise, so it never blocks
  // a reversal — mirroring voidPayment, which restores only a stamp
  // with a usable date.
  assert.ok(quickCollectReversalUndoFields(
    { id: 'P-ORIG', amount: 3000, method: 'Cash', clearedWaada: { promiseDate: '2026-02-30', promiseAmount: 3000 } },
    options
  ));
  assert.ok(quickCollectReversalUndoFields(
    { id: 'P-ORIG', amount: 3000, method: 'Cash', clearedWaada: '2026-10-20' },
    options
  ));
  assert.ok(quickCollectReversalUndoFields(
    { id: 'P-ORIG', amount: 3000, method: 'Cash' },
    options
  ));
});

/* ------------------------------ wiring ----------------------------------- */

test('wiring: executeUndo captures the cleared-waada stamp before the delete and restores it after', () => {
  const start = wiringSrc.indexOf('function executeUndo()');
  assert.ok(start > 0, 'delete-undo function found');
  // Sharafat 4: the window grew from 9000 — the split branch above
  // gained the per-leg addon reopen, so the single-payment restore
  // now sits further down. The pin is unchanged: the stamp is still
  // captured before the delete and restored after it.
  const slice = wiringSrc.slice(start, start + 11000);
  assert.match(slice, /const undoClearedWaada = clearedWaadaOf\(doomedPayment\);/);
  assert.match(slice, /restoreClearedWaada\(custAfter, undoClearedWaada\)/);
  assert.ok(
    slice.indexOf('const undoClearedWaada = clearedWaadaOf(doomedPayment);')
      < slice.indexOf('restoreClearedWaada(custAfter, undoClearedWaada)'),
    'the stamp is captured before the delete and restored after it'
  );
  // The restore sits beside the remainder-waada restore, not in it:
  // a full payment never carries a remainder waada, so the two
  // restorations are mutually exclusive by construction.
  assert.match(slice, /if \(undoClearedWaada\) \{/);
});

test('wiring: the split-undo branch captures each leg’s stamp before deleting and restores after both legs are gone', () => {
  const start = wiringSrc.indexOf('function executeUndo()');
  const slice = wiringSrc.slice(start, start + 9000);
  assert.match(slice, /const splitClearedWaada = splitLegs/);
  assert.match(slice, /clearedWaadaOf\(state\?\./);
  assert.match(slice, /restoreClearedWaada\(custAfterSplit, splitClearedWaada\)/);
  assert.ok(
    slice.indexOf('const splitClearedWaada = splitLegs')
      < slice.indexOf('restoreClearedWaada(custAfterSplit, splitClearedWaada)'),
    'the leg stamp is captured before the leg loop and restored after it'
  );
  // The split restore lands before the branch persists the state.
  assert.ok(
    slice.indexOf('restoreClearedWaada(custAfterSplit, splitClearedWaada)')
      < slice.indexOf('onSaveState(workingState)'),
    'the promise is back before the split undo is saved'
  );
});

test('wiring: armReversalUndo counts a cleared waada as a touched promise, so the reversal is never offered', () => {
  const start = wiringSrc.indexOf('function armReversalUndo(');
  assert.ok(start > 0, 'arm function found');
  const slice = wiringSrc.slice(start, start + 1400);
  assert.match(slice, /hasWaadaStamp: !!remainderWaadaOf\(savedPayment\) \|\| !!clearedWaadaOf\(savedPayment\)/);
  // The Plan 532 note already explains the refusal in plain words —
  // it fires for any non-plain payment, cleared waada included.
  assert.match(slice, /if \(reversalUndoNote\) reversalUndoNote\.hidden = false;/);
});

test('wiring: the reversal module refuses a cleared-waada payment at the build site too', () => {
  assert.match(moduleSrc, /payment\.clearedWaada/);
  assert.match(moduleSrc, /quickCollectReversalUndoIsStrictDate\(clearedStamp\.promiseDate\.trim\(\)\)/);
  // The module stays import-free: the stamp is read inline, never
  // through another module.
  assert.equal(moduleSrc.includes('import '), false);
});
