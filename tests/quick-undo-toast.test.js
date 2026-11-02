// SISP-141: 10-Second [↩ Undo Payment] Toast After 1-Tap Collection.
// Pure-function + controller tests on synthetic data only.
//
// Pins:
//  - the reversal reuses the Quick Collect undo's exact core seam
//    (reopen SISP-43 ticket charges -> core deletePayment), so state
//    after an undo deep-equals state before the collection: payments,
//    engine balances, Roznamcha day figures and shop unsettled cash;
//  - the waada case matches deletePayment's own discipline exactly
//    (the existing undo never restores a cleared promise — void does);
//  - expiry at 10s (undo unavailable, payment + balances intact),
//    replacement (a second collection retires the first offer),
//    double-tap safety, and graceful routing when the payment was
//    already deleted (gone) or voided (honest failure) elsewhere;
//  - the receipt ref is the payment's stored receiptNumber ->
//    permanentReceiptNumber, never fabricated;
//  - every t() key the module uses resolves in en + ur.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  QUICK_UNDO_GONE,
  QUICK_UNDO_WINDOW_MS,
  buildQuickUndoMessage,
  createQuickUndoController,
  findCollectedPayment,
  quickUndoCountdownLabel,
  quickUndoReceiptRef,
  reverseCollectedPayment
} from '../quick-undo-toast.js';
import {
  calculatePaymentAllocations,
  deletePayment,
  formatPKR,
  saveBillMonth
} from '../core.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import { buildRoznamchaDay } from '../roznamcha.js';
import { buildShopSummaries } from '../shop-settlement.js';
import { voidPayment } from '../payment-void-audit.js';
import {
  billedTicketChargesPending,
  createTicket,
  resolveTicket
} from '../complaint-tickets.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF = new Date('2026-10-15T10:00:00Z');
const MONTH = '2026-10';
const DAY = '2026-10-15';

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

function waseemUnsettled(state) {
  const found = buildShopSummaries(state, []).find((s) => s.shop === 'Waseem Abbasi Shop');
  return found ? found.unsettled : 0;
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

/* ------------------------- receipt ref + message ------------------------- */

test('receipt ref: stored receiptNumber wins, permanentReceiptNumber is the fallback, neither -> empty', () => {
  assert.equal(quickUndoReceiptRef({ receiptNumber: 'RCP-101' }), 'RCP-101');
  assert.equal(quickUndoReceiptRef({ permanentReceiptNumber: 'PR-7' }), 'PR-7');
  assert.equal(quickUndoReceiptRef({ receiptNumber: '  ', permanentReceiptNumber: 'PR-7' }), 'PR-7');
  assert.equal(quickUndoReceiptRef({ receiptNumber: ' RCP-9 ' }), 'RCP-9');
  assert.equal(quickUndoReceiptRef({}), '');
  assert.equal(quickUndoReceiptRef(null), '');
  assert.equal(quickUndoReceiptRef(undefined), '');
});

test('toast message: amount + name, ref in parens only when one exists', () => {
  assert.equal(
    buildQuickUndoMessage({ amount: 3000, customerName: 'Test Customer', receiptRef: 'RCP-101' }),
    `✅ ${formatPKR(3000)} collected from Test Customer (RCP-101)`
  );
  assert.equal(
    buildQuickUndoMessage({ amount: 3000, customerName: 'Test Customer', receiptRef: '' }),
    `✅ ${formatPKR(3000)} collected from Test Customer`
  );
  assert.equal(quickUndoCountdownLabel(10), '↩ Undo (10s)');
  assert.equal(quickUndoCountdownLabel(1), '↩ Undo (1s)');
  assert.equal(QUICK_UNDO_WINDOW_MS, 10000);
});

test('findCollectedPayment locates the payment and its bill month', () => {
  const before = stateWithBill();
  const { nextState, receipt } = collect(before);
  const found = findCollectedPayment(nextState, 'cust-1', receipt.paymentId);
  assert.equal(found.month, MONTH);
  assert.equal(found.payment.id, receipt.paymentId);
  assert.equal(findCollectedPayment(nextState, 'cust-1', 'missing'), null);
  assert.equal(findCollectedPayment(nextState, 'nobody', receipt.paymentId), null);
});

/* ------------------------------ reversal -------------------------------- */

test('PIN: undo within the window restores the exact pre-collection state (cash)', () => {
  const before = stateWithBill();
  const { nextState, receipt } = collect(before);
  assert.equal(balanceCents(nextState), 0);
  assert.equal(buildRoznamchaDay(nextState, [], DAY, []).cashIn, 3000);

  const out = reverseCollectedPayment({
    state: nextState, tickets: [], customerId: 'cust-1', paymentId: receipt.paymentId, referenceDate: REF
  });

  // Payments, balances and derived day figures are all back.
  assert.deepEqual(out.nextState.customers, before.customers);
  assert.equal(balanceCents(out.nextState), 300000);
  assert.equal(buildRoznamchaDay(out.nextState, [], DAY, []).cashIn, 0);
  assert.equal(out.nextTickets, null);
  assert.equal(out.month, MONTH);
  // Input untouched (pure).
  assert.equal(balanceCents(nextState), 0);
});

test('PIN: undo restores shop unsettled cash for a shop collection', () => {
  const before = stateWithBill();
  const { nextState, receipt } = collect(before, { method: 'Cash at Waseem Abbasi shop' });
  assert.equal(waseemUnsettled(nextState), 3000);
  assert.equal(balanceCents(nextState), 0);

  const out = reverseCollectedPayment({
    state: nextState, tickets: [], customerId: 'cust-1', paymentId: receipt.paymentId, referenceDate: REF
  });
  assert.equal(waseemUnsettled(out.nextState), 0);
  assert.equal(balanceCents(out.nextState), 300000);
  assert.deepEqual(out.nextState.customers, before.customers);
});

test('PIN: undo reopens SISP-43 ticket charges the collection settled, then deletes the payment', () => {
  const before = stateWithBill();
  const created = createTicket({
    customerId: 'cust-1',
    customerName: 'Test Customer',
    faultPreset: 'Fiber Cut / Splice Loss',
    technician: 'Test Lineman'
  }, []);
  const tickets = resolveTicket([created], created.id, {
    materialsUsed: [{ key: 'patch-cord', qty: 1, amount: 500 }],
    billingType: 'billed',
    referenceDate: REF
  });
  assert.equal(billedTicketChargesPending(tickets, 'cust-1'), 500);

  const { nextState, receipt, nextTickets } = collect(before, { amount: 3500, tickets });
  assert.deepEqual(receipt.ticketCharges, [{ ticketId: 'TKT-101', amount: 500 }]);
  assert.equal(nextTickets[0].chargePaid, true);
  assert.equal(balanceCents(nextState), 0);

  const out = reverseCollectedPayment({
    state: nextState, tickets: nextTickets, customerId: 'cust-1', paymentId: receipt.paymentId, referenceDate: REF
  });
  assert.equal(out.nextTickets[0].chargePaid, false);
  assert.equal(out.nextTickets[0].chargePaymentId, '');
  assert.equal(billedTicketChargesPending(out.nextTickets, 'cust-1'), 500);
  assert.equal(balanceCents(out.nextState), 300000);
  assert.deepEqual(out.nextState.customers, before.customers);
});

test('PIN: waada case — undo outcome is identical to the existing deletePayment undo', () => {
  const before = stateWithBill(3000, { promiseDate: '2026-10-20', promiseAmount: 3000, promiseNote: 'Friday' });
  const { nextState, receipt } = collect(before);
  // The full payment cleared the promise and stamped the payment.
  const afterCollect = nextState.customers[0];
  assert.equal(afterCollect.promiseDate, undefined);
  const stamped = findCollectedPayment(nextState, 'cust-1', receipt.paymentId);
  assert.equal(stamped.payment.clearedWaada?.promiseDate, '2026-10-20');

  const viaSeam = reverseCollectedPayment({
    state: nextState, tickets: [], customerId: 'cust-1', paymentId: receipt.paymentId, referenceDate: REF
  }).nextState;
  const viaDelete = deletePayment(nextState, 'cust-1', MONTH, receipt.paymentId, REF);
  assert.deepEqual(viaSeam, viaDelete);
  assert.equal(balanceCents(viaSeam), 300000);
});

test('undo of an already-deleted payment raises the gone code and changes nothing', () => {
  const before = stateWithBill();
  assert.throws(
    () => reverseCollectedPayment({ state: before, tickets: [], customerId: 'cust-1', paymentId: 'nope', referenceDate: REF }),
    (err) => err.code === QUICK_UNDO_GONE
  );
  assert.equal(balanceCents(before), 300000);
});

test('undo of a voided payment is refused with core\'s honest void message (never a silent delete)', () => {
  const before = stateWithBill();
  const { nextState, receipt } = collect(before);
  const { state: voidedState } = voidPayment(nextState, 'cust-1', MONTH, receipt.paymentId, {
    voidReason: 'Duplicate entry',
    voidedAt: '2026-10-15T11:00:00.000Z'
  });
  assert.throws(
    () => reverseCollectedPayment({ state: voidedState, tickets: [], customerId: 'cust-1', paymentId: receipt.paymentId, referenceDate: REF }),
    (err) => err.code !== QUICK_UNDO_GONE && /voided/i.test(err.message)
  );
  // The voided receipt is still there, untouched.
  assert.equal(findCollectedPayment(voidedState, 'cust-1', receipt.paymentId).payment.voided, true);
});

/* ------------------------------ controller ------------------------------ */

function fakeClock(start = 1_000_000) {
  let nowVal = start;
  const intervals = new Map();
  let nextId = 1;
  return {
    now: () => nowVal,
    setIntervalFn: (fn) => { const id = nextId++; intervals.set(id, fn); return id; },
    clearIntervalFn: (id) => { intervals.delete(id); },
    advance: (ms) => { nowVal += ms; for (const fn of [...intervals.values()]) fn(); },
    intervalCount: () => intervals.size
  };
}

function fakePresent() {
  const calls = [];
  const present = (model) => {
    const handle = {
      model,
      dismissed: false,
      labels: [model.undoLabel],
      dismiss() { this.dismissed = true; },
      setUndoLabel(text) { this.labels.push(text); }
    };
    calls.push(handle);
    return handle;
  };
  return { present, calls };
}

function makeController(overrides = {}) {
  const clock = fakeClock();
  const presenter = fakePresent();
  const calls = { reverse: [], reversed: [], gone: [], failure: [] };
  const controller = createQuickUndoController({
    present: presenter.present,
    reverse: (entry) => { calls.reverse.push(entry); },
    onReversed: (entry) => { calls.reversed.push(entry); },
    onGone: (entry) => { calls.gone.push(entry); },
    onFailure: (entry, err) => { calls.failure.push({ entry, err }); },
    now: clock.now,
    setIntervalFn: clock.setIntervalFn,
    clearIntervalFn: clock.clearIntervalFn,
    ...overrides
  });
  return { controller, clock, presenter, calls };
}

const ENTRY_A = { customerId: 'cust-1', paymentId: 'pay-a', amount: 3000, customerName: 'Test Customer', receiptRef: '' };
const ENTRY_B = { customerId: 'cust-1', paymentId: 'pay-b', amount: 1500, customerName: 'Test Customer', receiptRef: '' };

test('controller: offer presents the toast and the countdown ticks 10 -> 1', () => {
  const { controller, clock, presenter } = makeController();
  assert.equal(controller.offer(ENTRY_A), true);
  assert.equal(presenter.calls.length, 1);
  assert.equal(presenter.calls[0].model.message, `✅ ${formatPKR(3000)} collected from Test Customer`);
  assert.equal(presenter.calls[0].model.undoLabel, '↩ Undo (10s)');
  clock.advance(1000);
  assert.equal(presenter.calls[0].labels.at(-1), '↩ Undo (9s)');
  clock.advance(8000);
  assert.equal(presenter.calls[0].labels.at(-1), '↩ Undo (1s)');
  assert.equal(controller.pending()?.paymentId, 'pay-a');
});

test('PIN: expiry after 10s — undo unavailable, toast dismissed, payment never reversed', () => {
  const { controller, clock, presenter, calls } = makeController();
  controller.offer(ENTRY_A);
  clock.advance(9999);
  assert.notEqual(controller.pending(), null);
  clock.advance(1);
  assert.equal(controller.pending(), null);
  assert.equal(presenter.calls[0].dismissed, true);
  assert.equal(clock.intervalCount(), 0);
  assert.equal(controller.undo(), false);
  assert.equal(calls.reverse.length, 0);
});

test('PIN: a second collection replaces the pending offer — only the latest is undoable', () => {
  const { controller, presenter, calls } = makeController();
  controller.offer(ENTRY_A);
  controller.offer(ENTRY_B);
  assert.equal(presenter.calls.length, 2);
  assert.equal(presenter.calls[0].dismissed, true);
  assert.equal(presenter.calls[1].dismissed, false);
  assert.equal(controller.pending()?.paymentId, 'pay-b');
  assert.equal(controller.undo(), true);
  assert.deepEqual(calls.reverse.map(e => e.paymentId), ['pay-b']);
  assert.deepEqual(calls.reversed.map(e => e.paymentId), ['pay-b']);
});

test('PIN: double-tap on Undo reverses at most once', () => {
  const { controller, presenter, calls } = makeController();
  controller.offer(ENTRY_A);
  // The toast system's action wiring and a direct call race each other.
  presenter.calls[0].model.onUndo();
  presenter.calls[0].model.onUndo();
  assert.equal(controller.undo(), false);
  assert.equal(calls.reverse.length, 1);
  assert.equal(calls.reversed.length, 1);
});

test('controller: undo routes gone vs failure honestly', () => {
  const goneErr = new Error('gone'); goneErr.code = QUICK_UNDO_GONE;
  const a = makeController({ reverse: () => { throw goneErr; } });
  a.controller.offer(ENTRY_A);
  assert.equal(a.controller.undo(), true);
  assert.equal(a.calls.gone.length, 1);
  assert.equal(a.calls.failure.length, 0);
  assert.equal(a.calls.reversed.length, 0);

  const b = makeController({ reverse: () => { throw new Error('Cannot delete a voided payment.'); } });
  b.controller.offer(ENTRY_A);
  assert.equal(b.controller.undo(), true);
  assert.equal(b.calls.failure.length, 1);
  assert.match(b.calls.failure[0].err.message, /voided/);
  assert.equal(b.calls.gone.length, 0);
});

test('controller integration: undo inside the window restores the ledger; after expiry the payment stands', () => {
  const before = stateWithBill();
  const { nextState, receipt } = collect(before);
  let liveState = nextState;
  const clock = fakeClock();
  const presenter = fakePresent();
  const controller = createQuickUndoController({
    present: presenter.present,
    reverse: (entry) => {
      const out = reverseCollectedPayment({
        state: liveState, tickets: [], customerId: entry.customerId, paymentId: entry.paymentId, referenceDate: REF
      });
      liveState = out.nextState;
    },
    now: clock.now,
    setIntervalFn: clock.setIntervalFn,
    clearIntervalFn: clock.clearIntervalFn
  });

  controller.offer({ customerId: 'cust-1', paymentId: receipt.paymentId, amount: 3000, customerName: 'Test Customer', receiptRef: '' });
  clock.advance(3000);
  assert.equal(controller.undo(), true);
  assert.equal(balanceCents(liveState), 300000);
  assert.deepEqual(liveState.customers, before.customers);

  // A fresh collection whose window lapses simply stands.
  const again = collect(liveState);
  liveState = again.nextState;
  controller.offer({ customerId: 'cust-1', paymentId: again.receipt.paymentId, amount: 3000, customerName: 'Test Customer', receiptRef: '' });
  clock.advance(10000);
  assert.equal(controller.undo(), false);
  assert.equal(balanceCents(liveState), 0);
  assert.notEqual(findCollectedPayment(liveState, 'cust-1', again.receipt.paymentId), null);
});

test('controller: a malformed offer is refused without presenting', () => {
  const { controller, presenter } = makeController();
  assert.equal(controller.offer({ customerId: 'cust-1' }), false);
  assert.equal(controller.offer(null), false);
  assert.equal(presenter.calls.length, 0);
  assert.equal(controller.pending(), null);
});

/* --------------------------- i18n + wiring ------------------------------ */

test('i18n: every t() key used by quick-undo-toast.js and the app.js presenter resolves in en + ur; qundo_ parity holds', () => {
  const moduleSource = readFileSync(new URL('../quick-undo-toast.js', import.meta.url), 'utf8');
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const moduleKeys = [...moduleSource.matchAll(/\bt\(\s*'([a-z0-9_]+)'/g)].map(m => m[1]);
  const presenterKeys = [...appSource.matchAll(/\bt\(\s*'(qundo_[a-z0-9_]+)'/g)].map(m => m[1]);
  const keys = [...new Set([...moduleKeys, ...presenterKeys])];
  assert.ok(keys.length >= 7, `expected the full qundo_ key set, found ${keys.join(',')}`);
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
  }
  const enQ = Object.keys(TRANSLATIONS.en).filter(k => k.startsWith('qundo_')).sort();
  const urQ = Object.keys(TRANSLATIONS.ur).filter(k => k.startsWith('qundo_')).sort();
  assert.deepEqual(enQ, urQ);
  assert.ok(enQ.length >= 7);
});

test('wiring: app.js hosts the presenter for both setups; the module stays out of ENTRY_FILES', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appSource.includes("from './quick-undo-toast.js'"));
  assert.ok(appSource.includes('createQuickUndoController'));
  // Field Mode wires the presenter directly. Quick Collect wires it
  // through the SISP-187 composed handler (the presenter plus the QR
  // scanner's saved-payment note share the one host hook), so the bare
  // literal survives exactly once — the presenter is still hosted for
  // both setups, and the composition still calls it for Quick Collect.
  assert.equal(appSource.split('onCollected: offerCollectedUndo').length - 1, 1);
  assert.ok(appSource.includes('offerCollectedUndo(info)'));
  const buildSource = readFileSync(new URL('../build.mjs', import.meta.url), 'utf8');
  const entryLine = buildSource.split('\n').find(line => line.includes('ENTRY_FILES'));
  assert.ok(entryLine && !entryLine.includes('quick-undo-toast.js'));
});

test('wiring: Field Mode offers the toast for collects only — never for advances', () => {
  const source = readFileSync(new URL('../field-mode.js', import.meta.url), 'utf8');
  assert.ok(source.includes('onCollected'));
  assert.ok(/onCollected\(\{\s*customerId: receipt\.customerId/.test(source));
  const advanceBody = source.slice(source.indexOf('function collectAdvance'), source.indexOf('function applyWaada'));
  assert.ok(advanceBody.length > 0);
  assert.ok(!advanceBody.includes('onCollected'));
});

test('wiring: Quick Collect delegates to onCollected when the host provides it, legacy toast intact otherwise', () => {
  const source = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.ok(source.includes('onCollected'));
  assert.ok(source.includes("typeof onCollected === 'function'"));
  // The pre-SISP-141 behaviour survives for hosts without the hook.
  assert.ok(source.includes('Payment of PKR ${amountVal.toLocaleString()} recorded.'));
  assert.ok(source.includes('executeUndo'));
});

test('CSS: the countdown action styling exists and is token-only (no raw hex)', () => {
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const start = css.indexOf('.toast-action-btn.qundo-undo-btn');
  assert.ok(start > -1);
  const block = css.slice(css.lastIndexOf('/*', start), css.indexOf('}', start));
  assert.ok(block.includes('qundo-undo-btn'));
  assert.ok(!block.includes('#'), `undo toast CSS must be token-only: ${block}`);
});
