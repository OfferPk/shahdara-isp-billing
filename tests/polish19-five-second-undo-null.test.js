// Polish #19 — the five-second delete undo never worked.
//
// Found by the Plan 532 implementer while reading, recorded in PR
// #1265's body ("Found while reading — NOT fixed here"), parent-
// verified in the merged code: executeUndo() in nav-quick-collect.js
// destructures its context and then sets activeUndoContext = null —
// and then, inside the try, reads activeUndoContext.splitLegs. The
// read dereferences null on EVERY five-second undo, so the catch
// toasts "Could not undo payment: Cannot read properties of null
// (reading 'splitLegs')" BEFORE any deletePayment runs: the payment
// is never deleted and the operator sees only the error.
//
// Pins:
//  - a plain (non-split) payment's undo deletes the payment and
//    restores the ledger, with a success toast and no error toast
//    (REPRO: fails on the pristine head with the splitLegs error);
//  - a split collection's undo removes BOTH legs, newest first,
//    with their ticket-charge reopens (SISP-121), same success;
//  - the guard still returns silently when no undo is armed;
//  - the repair itself: the :5111 read goes through the nulled
//    context safely, exactly like the :4969 sibling.
// Synthetic data only: one pattern-fake customer, PKR 1,000 dues.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  calculatePaymentAllocations,
  createInitialState,
  generateMonthlyBillsThroughCurrentMonth,
  updateCustomerProfile
} from '../core.js';
import { getPakistanLocalDate, setupQuickCollectModal } from '../nav-quick-collect.js';

const MONTH = getPakistanLocalDate(new Date()).slice(0, 7);

function polish19FixtureState() {
  const now = new Date();
  let state = createInitialState(['Polish19 Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  return state;
}

const paymentsOf = (state, month) =>
  state.customers[0].bills.find((b) => b.month === month)?.payments ?? [];

const balanceDueCents = (state, month) =>
  calculatePaymentAllocations(state).forMonth('seed-001', month)?.balanceDueCents;

/** The owner-cash-shop test's mock DOM + controller harness. */
function mockDom() {
  const registry = new Map();
  const createMockElement = (id, tag = 'div') => {
    const listeners = {};
    const attrs = {};
    const el = {
      id, tagName: tag.toUpperCase(), textContent: '', innerHTML: '', value: '',
      style: {}, hidden: false, disabled: false, checked: false, options: [], children: [],
      classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
      getAttribute: (n) => attrs[n] ?? null,
      setAttribute: (n, v) => { attrs[n] = v; },
      removeAttribute: (n) => { delete attrs[n]; },
      addEventListener: (type, h) => { (listeners[type] = listeners[type] || []).push(h); },
      dispatch: async (type, evt = {}) => { for (const h of (listeners[type] || [])) await h({ type, target: el, preventDefault: () => {}, ...evt }); },
      click: async () => el.dispatch('click'),
      querySelector: () => null,
      querySelectorAll: () => [],
      appendChild: (child) => { el.children.push(child); return child; },
      removeChild: () => {},
      focus: () => {},
      select: () => {},
      showModal: () => { el.opened = true; el.open = true; },
      close: () => { el.open = false; },
      opened: false,
      open: false
    };
    // innerHTML assignment replaces children, like the real DOM — the
    // list renderer clears its host this way before re-rendering.
    let html = '';
    Object.defineProperty(el, 'innerHTML', {
      get: () => html,
      set: (v) => { html = String(v); if (html === '') el.children.length = 0; }
    });
    return el;
  };
  const getEl = (id, tag) => {
    if (!registry.has(id)) registry.set(id, createMockElement(id, tag));
    return registry.get(id);
  };
  getEl('quickCollectModal', 'dialog');
  const documentStub = {
    getElementById: (id) => getEl(id),
    querySelectorAll: () => [],
    createElement: (tag) => createMockElement('', tag),
    addEventListener: () => {},
    body: { appendChild() {}, removeChild() {} },
    activeElement: null
  };
  return { getEl, documentStub };
}

async function withController(state, fn) {
  const { getEl, documentStub } = mockDom();
  const origDocument = globalThis.document;
  globalThis.document = documentStub;
  try {
    let current = state;
    const toasts = [];
    const controller = setupQuickCollectModal({
      getState: () => current,
      onSaveState: (next) => { current = next; },
      onToast: (msg, opts) => toasts.push({ msg, opts }),
      onSelectCustomer: () => {},
      onEditCustomer: () => {}
    });
    await fn({ controller, getEl, toasts, getState: () => current });
  } finally {
    // The submit path schedules a ~60ms focus timer against `document`;
    // let it fire while the stub is still installed.
    await new Promise((resolve) => setTimeout(resolve, 130));
    globalThis.document = origDocument;
  }
}

// Plan 382: the save confirmation summary is shown before the payment
// posts — a submit alone records nothing; the operator confirms the
// same figures, then the form posts. The mock form has no native
// requestSubmit, so the test resubmits after confirming, exactly as
// the real form's requestSubmit re-entry would.
async function submitAndConfirm(getEl, getState) {
  await getEl('quickCollectPaymentForm').dispatch('submit');
  assert.deepEqual(paymentsOf(getState(), MONTH), [],
    'Plan 382: the first submit shows the summary — nothing posts yet');
  await getEl('quickCollectConfirmSaveBtn').click();
  await getEl('quickCollectPaymentForm').dispatch('submit');
}

test('REPRO (polish #19): the five-second undo deletes a plain payment instead of erroring on splitLegs', async () => {
  await withController(polish19FixtureState(), async ({ controller, getEl, toasts, getState }) => {
    controller.open('seed-001');
    assert.equal(getEl('quickCollectAmountInput').value, '1000.00', 'precondition: amount starts at full dues');

    await submitAndConfirm(getEl, getState);
    assert.equal(paymentsOf(getState(), MONTH).length, 1, 'precondition: one payment recorded');
    assert.equal(balanceDueCents(getState(), MONTH), 0, 'precondition: dues settled');
    assert.equal(getEl('quickCollectUndoBtn').hidden, false, 'precondition: the undo is offered');

    // The bug: on the pristine head this toasts "Could not undo
    // payment: Cannot read properties of null (reading 'splitLegs')"
    // and the payment stays recorded.
    await getEl('quickCollectUndoBtn').click();

    assert.deepEqual(paymentsOf(getState(), MONTH), [], 'undo deletes the payment');
    assert.equal(balanceDueCents(getState(), MONTH), 100000, 'ledger restored: full dues open again');
    const errorToast = toasts.find((t) => t.opts?.type === 'error');
    assert.equal(errorToast, undefined, `no error toast — got: ${errorToast?.msg}`);
    const done = toasts.find((t) => t.msg.includes('undone. Ledger restored.'));
    assert.ok(done, 'success toast confirms the undo');
    assert.equal(done.opts?.type, 'success');
    assert.match(done.msg, /PKR 1,000 for Polish19 Tester/);
  });
});

test('split undo (SISP-121): undoing a split collection removes BOTH legs, newest first', async () => {
  await withController(polish19FixtureState(), async ({ controller, getEl, toasts, getState }) => {
    controller.open('seed-001');
    // Leg 1 Cash 600 + leg 2 Easypaisa 400 = the Rs 1,000 dues exactly,
    // so no overpayment choice is in play. The legs must use different
    // methods (a same-method split is refused with an error toast),
    // and a digital leg 2 needs its transaction id.
    getEl('quickCollectAmountInput').value = '600';
    const splitToggle = getEl('quickCollectSplitToggle');
    splitToggle.checked = true;
    await splitToggle.dispatch('change');
    getEl('quickCollectSplitAmountInput').value = '400';
    getEl('quickCollectSplitMethodSelect').value = 'Easypaisa';
    getEl('quickCollectSplitTransactionIdInput').value = 'SPLIT-TEST-001';

    await submitAndConfirm(getEl, getState);
    const recorded = paymentsOf(getState(), MONTH);
    assert.equal(recorded.length, 2, 'precondition: both split legs recorded');
    assert.deepEqual(recorded.map((p) => p.amount).sort((a, b) => a - b), [400, 600], 'precondition: leg amounts 600 + 400');
    assert.deepEqual(recorded.map((p) => p.method).sort(), ['Cash', 'Easypaisa'], 'precondition: legs on different methods');
    assert.equal(balanceDueCents(getState(), MONTH), 0, 'precondition: dues settled');

    // The same null dereference fires here on the pristine head: the
    // split branch is never reached because the splitLegs read throws
    // first.
    await getEl('quickCollectUndoBtn').click();

    assert.deepEqual(paymentsOf(getState(), MONTH), [], 'undo removes both legs');
    assert.equal(balanceDueCents(getState(), MONTH), 100000, 'ledger restored: full dues open again');
    // The undo must not roll the package back to the mid-split state:
    // leg 1's follow moved the package to 600 and leg 2's moved it back
    // to 1,000, so a correct split undo leaves the package at 1,000.
    // (An optional-chain read of the already-nulled context would take
    // the plain path here and leave the package at 600.)
    assert.equal(getState().customers[0].monthlySellingAmount, 1000, 'package untouched by the split undo');
    const errorToast = toasts.find((t) => t.opts?.type === 'error');
    assert.equal(errorToast, undefined, `no error toast — got: ${errorToast?.msg}`);
    const done = toasts.find((t) => t.msg.includes('undone. Ledger restored.'));
    assert.ok(done, 'success toast confirms the undo');
  });
});

test('guard: clicking undo with no collection armed does nothing — no toast, no error', async () => {
  await withController(polish19FixtureState(), async ({ controller, getEl, toasts }) => {
    controller.open('seed-001');
    const before = toasts.length;
    await getEl('quickCollectUndoBtn').click();
    assert.equal(toasts.length, before, 'the :5082 guard returns silently with no context');
  });
});

test('wiring: executeUndo captures splitLegs BEFORE the context is nulled — the only repair that works', () => {
  const src = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  const undoAt = src.indexOf('function executeUndo()');
  assert.ok(undoAt > 0, 'executeUndo found');
  const undoSrc = src.slice(undoAt, undoAt + 9000);
  // The context is nulled at :5084, BEFORE the :5111 read — so an
  // optional chain on the context itself (activeUndoContext?.splitLegs,
  // the :4969 sibling's form) would read undefined there and the undo
  // would silently take the plain path: only leg 2 deleted, package
  // rolled back to the mid-split state. The legs must be captured
  // with everything else the function needs, in the :5083 snapshot.
  const destructureAt = undoSrc.indexOf('splitLegs: undoSplitLegs');
  assert.ok(destructureAt > 0, 'splitLegs is captured in the :5083 destructure');
  assert.ok(destructureAt < undoSrc.indexOf('activeUndoContext = null;'),
    'the capture happens before the nulling');
  assert.match(undoSrc, /const splitLegs = Array\.isArray\(undoSplitLegs\) \? undoSplitLegs : null;/,
    'the :5111 read uses the captured legs');
  assert.doesNotMatch(undoSrc, /activeUndoContext\?\.splitLegs/,
    'no optional-chain read of the already-nulled context');
  assert.doesNotMatch(undoSrc, /activeUndoContext\.splitLegs/,
    'no bare dereference of the nulled context remains in executeUndo');
  // The nulling itself is untouched: the context is still cleared up
  // front so a double-tap can never undo twice.
  assert.match(undoSrc, /activeUndoContext = null;/);
  // The effect is unchanged: the undo still deletes, it never reverses.
  assert.match(undoSrc, /deletePayment\(/);
  // The sibling read keeps its own form — it never nulls the context
  // first, so the optional chain is correct there.
  assert.match(src, /const splitLegs = Array\.isArray\(activeUndoContext\?\.splitLegs\) \? activeUndoContext\.splitLegs : \[\];/);
});
