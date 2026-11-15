import test from 'node:test';
import assert from 'node:assert/strict';

import {
  saveBillMonth,
  applyLateFeeToBill,
  waiveLateFeeFromBill,
  correctPayment
} from '../core.js';
import {
  recordInboxPayment,
  mergeInboxItems,
  PaymentsInboxController
} from '../payments-inbox.js';
import { loadVoidPayments } from '../payment-void-audit.js';
import { waivedLateFeeStampFor } from '../late-fee-waiver.js';

// Sharafat 57 — inbox "Undo" deletes instead of voiding, and leaves
// stale recorded fields behind. The undo now voids the payment (reason
// "Inbox recording undone"), restores an auto-cleared waada / waived
// late fee, persists the void record with rollback, and clears all four
// recorded fields. Pattern-fake data only (Test Customer #101,
// 03012345678 family, TESTTXN* ids) — no realistic numbers, no real
// customer names.

const MONTH = '2026-10';
const DAY = '2026-10-15';
const REF = new Date('2026-10-15T10:00:00Z');
const PHONE = '03012345678';
const OTHER_PHONE = '03012345679'; // pattern-fake; no customer holds it

// Mock localStorage (same pattern as tests/easypaisa-inbox.test.js),
// with a failSets switch so the void-log rollback can be pinned.
class MockLocalStorage {
  constructor() {
    this.store = new Map();
    this.failSets = false;
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    if (this.failSets) throw new Error('QuotaExceededError');
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = new MockLocalStorage();
}

function stateWithBill(dueAmount = 3000, extra = {}) {
  let state = { customers: [{ id: 'cust-1', customerNumber: 101, name: 'Test Customer', phone: PHONE, area: 'Test Area', archived: false, bills: [], ...extra }] };
  return saveBillMonth(state, 'cust-1', { month: MONTH, dueAmount, status: 'pending' }, REF);
}

function txn(id, overrides = {}) {
  return {
    txnId: id,
    direction: 'Received',
    amount: 3000,
    date: DAY,
    senderName: 'Test Customer',
    senderNumber: PHONE,
    ...overrides
  };
}

function paymentOf(state, id) {
  return state.customers[0].bills.find((b) => b.month === MONTH)?.payments?.find((p) => p.id === id);
}

function billOf(state) {
  return state.customers[0].bills.find((b) => b.month === MONTH);
}

// Drives the real Record-button click handler on a fake container and
// captures every toast, so the test can invoke the toast's Undo action
// exactly as the operator would.
function makeInbox(initialState) {
  let state = initialState;
  const toasts = [];
  globalThis.window = { toast: (message, opts = {}) => toasts.push({ message, opts }) };
  const container = {
    innerHTML: '',
    listeners: {},
    addEventListener(type, fn) {
      (this.listeners[type] ||= []).push(fn);
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };
  const inbox = new PaymentsInboxController({
    getState: () => state,
    onSaveState: (next) => {
      state = next;
    }
  });
  inbox.confirm = async () => true;
  inbox.container = container;
  inbox.bindEvents();
  return {
    inbox,
    container,
    toasts,
    get state() {
      return state;
    },
    setState(next) {
      state = next;
    }
  };
}

async function clickRecord(harness, txnId) {
  const btn = {
    dataset: { recordTxn: txnId },
    disabled: false,
    textContent: 'Record Payment',
    closest: () => null
  };
  const event = {
    target: {
      closest: (sel) => (sel === '[data-record-txn]' ? btn : null)
    }
  };
  await harness.container.listeners.click[0](event);
  return btn;
}

function recordedToast(harness) {
  return harness.toasts.find((t) => t.opts && t.opts.title === 'Payment Recorded');
}

function undoActionOf(harness) {
  const toast = recordedToast(harness);
  assert.ok(toast, 'expected a "Payment Recorded" toast carrying the Undo action');
  assert.equal(toast.opts.actions?.length, 1);
  assert.equal(toast.opts.actions[0].label, 'Undo');
  return toast.opts.actions[0].onAction;
}

test('sharafat 57: undo of a waada-clearing payment restores the waada', () => {
  localStorage.clear();
  const harness = makeInbox(stateWithBill(3000, { promiseDate: '2026-10-20', promiseAmount: 3000, promiseNote: 'Friday' }));
  harness.inbox.items = [txn('TESTTXN0001')];
  return clickRecord(harness, 'TESTTXN0001').then(() => {
    // The full payment auto-cleared the waada at record time.
    assert.equal(harness.state.customers[0].promiseDate, undefined);
    const paymentId = harness.state.customers[0].bills[0].payments[0].id;
    assert.equal(paymentOf(harness.state, paymentId)?.clearedWaada?.promiseDate, '2026-10-20');

    undoActionOf(harness)();

    // The payment is voided history, not deleted — and the waada is
    // back field-for-field.
    const payment = paymentOf(harness.state, paymentId);
    assert.equal(payment?.voided, true);
    assert.equal(payment?.voidReason, 'Inbox recording undone');
    assert.equal(harness.state.customers[0].promiseDate, '2026-10-20');
    assert.equal(harness.state.customers[0].promiseAmount, 3000);
    assert.equal(harness.state.customers[0].promiseNote, 'Friday');
    // The void record is persisted, and the toast says what happened.
    const log = loadVoidPayments();
    assert.equal(log.length, 1);
    assert.equal(log[0].voidReason, 'Inbox recording undone');
    assert.equal(log[0].promiseRestored, true);
    assert.ok(harness.toasts.some((t) => t.message === 'Payment voided. Ledger restored.'));
  });
});

test('sharafat 57: undo clears all four recorded fields, and the row stops pre-selecting', () => {
  localStorage.clear();
  const harness = makeInbox(stateWithBill());
  // The sender number matches nobody, so the operator picks the
  // customer — the stale-field render consequence is only visible
  // when the auto-match cannot supply the same customer.
  const item = txn('TESTTXN0020', { senderNumber: OTHER_PHONE });
  harness.inbox.items = [item];
  harness.inbox.selectedCustomerMatches.set('TESTTXN0020', 'cust-1');
  return clickRecord(harness, 'TESTTXN0020').then(() => {
    const recorded = harness.inbox.items[0];
    assert.equal(recorded.recorded, true);
    assert.ok(recorded.recordedPaymentId);
    assert.equal(recorded.recordedMonth, MONTH);
    assert.equal(recorded.recordedCustomerId, 'cust-1');

    undoActionOf(harness)();

    const undone = harness.inbox.items[0];
    assert.equal(undone.recorded, false);
    assert.equal(undone.recordedPaymentId, null);
    assert.equal(undone.recordedMonth, null);
    assert.equal(undone.recordedCustomerId, null);
    // The cleared fields do not come back on re-import either.
    const merged = mergeInboxItems([undone], [{ txnId: 'TESTTXN0020', direction: 'Received', amount: 3000, date: DAY, senderNumber: OTHER_PHONE }]);
    assert.equal(merged[0].recordedMonth, null);
    assert.equal(merged[0].recordedCustomerId, null);
    // And the row no longer pre-selects the customer: the operator's
    // own pick is cleared too (it was only needed to record), so the
    // render must fall through to the auto-match, which has no holder
    // for this sender number.
    harness.inbox.selectedCustomerMatches.delete('TESTTXN0020');
    const html = harness.inbox.renderTransactionRow(undone, harness.state.customers, harness.state);
    assert.ok(html.includes('-- Link to Customer --'));
    assert.ok(!html.includes('✓ Matched: #101 Test Customer'));
  });
});

test('sharafat 57: void log persisted for an ordinary undo (no waada, no fee)', () => {
  localStorage.clear();
  const harness = makeInbox(stateWithBill());
  harness.inbox.items = [txn('TESTTXN0030')];
  return clickRecord(harness, 'TESTTXN0030').then(() => {
    undoActionOf(harness)();
    const log = loadVoidPayments();
    assert.equal(log.length, 1);
    assert.equal(log[0].voidReason, 'Inbox recording undone');
    assert.equal(log[0].paymentId, harness.state.customers[0].bills[0].payments[0].id);
    assert.equal(log[0].promiseRestored, false);
    assert.equal(log[0].billMonth, MONTH);
  });
});

test('sharafat 57: the undone payment can be re-recorded (CP-01)', () => {
  localStorage.clear();
  const harness = makeInbox(stateWithBill());
  harness.inbox.items = [txn('TESTTXN0040')];
  return clickRecord(harness, 'TESTTXN0040').then(() => {
    undoActionOf(harness)();
    // The voided payment's TID no longer blocks a fresh recording.
    const res = recordInboxPayment({
      state: harness.state,
      txn: txn('TESTTXN0040'),
      customerId: 'cust-1',
      month: MONTH,
      referenceDate: REF
    });
    assert.ok(res.payment.id);
    // A second payment with the same TID now sits in the bill, and
    // one of the two is live (not voided).
    const reRecordedBill = res.nextState.customers[0].bills.find((b) => b.month === MONTH);
    const sameTid = reRecordedBill.payments.filter((p) => p.transactionId === 'TESTTXN0040');
    assert.equal(sameTid.length, 2);
    assert.ok(sameTid.some((p) => p.voided !== true));
  });
});

test('sharafat 57: undo of a fee-waiving payment restores the waived late fee', () => {
  localStorage.clear();
  let s = stateWithBill();
  s = applyLateFeeToBill(s, 'cust-1', MONTH, { amount: 100 }, REF);
  const harness = makeInbox(s);
  harness.inbox.items = [txn('TESTTXN0012')];
  return clickRecord(harness, 'TESTTXN0012').then(() => {
    const paymentId = harness.state.customers[0].bills[0].payments[0].id;
    // A correction inside the toast window adds the waiver (complete
    // triple: lateFeeWaived + waivedAmount > 0 + stamp — a partial
    // triple is dropped whole by validatePayment).
    const stamp = waivedLateFeeStampFor(billOf(harness.state));
    let corrected = correctPayment(harness.state, 'cust-1', MONTH, paymentId, {
      date: DAY, amount: 3000, method: 'Easypaisa', paidBy: 'Test Customer',
      transactionId: 'TESTTXN0012', lateFeeWaived: true, waivedAmount: 100, waivedLateFee: stamp
    }, REF);
    corrected = waiveLateFeeFromBill(corrected, 'cust-1', MONTH, { reason: 'Late fee waived by owner' }, REF);
    assert.equal(billOf(corrected).lateFee, 0);
    harness.setState(corrected);

    undoActionOf(harness)();

    // The void restores the fee; the undo is not refused for a waiver.
    assert.equal(billOf(harness.state).lateFee, 100);
    assert.equal(loadVoidPayments()[0].lateFeeRestored, true);
    assert.equal(paymentOf(harness.state, paymentId)?.voided, true);
    assert.ok(!harness.toasts.some((t) => t.message.includes('void it from the profile')));
  });
});

test('sharafat 57: undo refuses a ticket-settling payment with a plain message', () => {
  localStorage.clear();
  const harness = makeInbox(stateWithBill());
  harness.inbox.items = [txn('TESTTXN0010')];
  return clickRecord(harness, 'TESTTXN0010').then(() => {
    const paymentId = harness.state.customers[0].bills[0].payments[0].id;
    // A correction inside the toast window stamps the ticket charge —
    // a fresh inbox payment never carries one, so this stands in for
    // that (unreachable in this flow) correction.
    paymentOf(harness.state, paymentId).ticketCharges = [{ ticketId: 'TKT-101', amount: 500 }];

    undoActionOf(harness)();

    assert.ok(harness.toasts.some((t) => t.message === 'This payment settled a ticket charge — void it from the profile instead.'));
    // The refusal leaves the payment recorded and untouched.
    assert.equal(paymentOf(harness.state, paymentId)?.voided, undefined);
    assert.equal(harness.inbox.items[0].recorded, true);
    assert.equal(loadVoidPayments().length, 0);
  });
});

test('sharafat 57: undo refuses an addon-settling payment with a plain message', () => {
  localStorage.clear();
  const harness = makeInbox(stateWithBill());
  harness.inbox.items = [txn('TESTTXN0011')];
  return clickRecord(harness, 'TESTTXN0011').then(() => {
    const paymentId = harness.state.customers[0].bills[0].payments[0].id;
    paymentOf(harness.state, paymentId).addonCharges = [{ boostId: 'BST-101', amount: 200 }];

    undoActionOf(harness)();

    assert.ok(harness.toasts.some((t) => t.message === 'This payment settled a ticket charge — void it from the profile instead.'));
    assert.equal(paymentOf(harness.state, paymentId)?.voided, undefined);
    assert.equal(harness.inbox.items[0].recorded, true);
    assert.equal(loadVoidPayments().length, 0);
  });
});

test('sharafat 57: undo of a shop-settled payment surfaces the void refusal, never deletes', () => {
  localStorage.clear();
  const harness = makeInbox(stateWithBill());
  harness.inbox.items = [txn('TESTTXN0031')];
  return clickRecord(harness, 'TESTTXN0031').then(() => {
    const paymentId = harness.state.customers[0].bills[0].payments[0].id;
    // A shop handover inside the toast window stamps the payment.
    paymentOf(harness.state, paymentId).shopSettled = true;

    undoActionOf(harness)();

    assert.ok(harness.toasts.some((t) => t.message.startsWith('Undo failed: This payment was already handed over from the shop')));
    // The payment is still there, still recorded — the undo never
    // falls back to delete for a shop-settled payment.
    assert.ok(paymentOf(harness.state, paymentId));
    assert.equal(paymentOf(harness.state, paymentId)?.voided, undefined);
    assert.equal(harness.inbox.items[0].recorded, true);
    assert.equal(loadVoidPayments().length, 0);
  });
});

test('sharafat 57: a void-log save failure rolls the undo back, changing nothing', () => {
  localStorage.clear();
  const harness = makeInbox(stateWithBill());
  harness.inbox.items = [txn('TESTTXN0050')];
  return clickRecord(harness, 'TESTTXN0050').then(() => {
    const paymentId = harness.state.customers[0].bills[0].payments[0].id;
    // The next localStorage write (the void-log save) throws.
    globalThis.localStorage.failSets = true;
    try {
      undoActionOf(harness)();
    } finally {
      globalThis.localStorage.failSets = false;
    }
    assert.ok(harness.toasts.some((t) => t.message === 'Void log could not be saved — nothing was changed. Check storage and try again.'));
    // State, log and row are all exactly as before the undo attempt.
    assert.ok(paymentOf(harness.state, paymentId));
    assert.equal(paymentOf(harness.state, paymentId)?.voided, undefined);
    assert.equal(loadVoidPayments().length, 0);
    assert.equal(harness.inbox.items[0].recorded, true);
    assert.equal(harness.inbox.items[0].recordedPaymentId, paymentId);
  });
});
