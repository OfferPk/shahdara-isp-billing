// Sharafat 8 — the duplicate-TID bypass is keyed by customer +
// TID + amount + method, and clears when a new customer form opens.
//
// Problem: duplicateBypassedForTxn held the raw TID, set on "Save
// anyway" and cleared only on modal close or a manual edit of the
// TID field. Opening the next customer cleared the field
// programmatically (no `input` event), so the bypass stayed armed:
// the same TID could then be recorded for a different customer in
// the same session with no warning at all.
//
// Pins:
//  - REPRO (cross-customer): bypassing TID X for customer A never
//    silences the warning for customer B in the same session —
//    B's submit with the same TID, amount and method shows the
//    leg-1 card again (on the pristine head it sails to the
//    confirm summary, card hidden);
//  - REPRO (open clears): bypassing TID X for A, then opening A's
//    form again and submitting the SAME TID, amount and method
//    shows the card again — the bypass does not survive a fresh
//    customer form (on the pristine head the raw TID stays armed
//    and no card shows);
//  - a different amount for the same customer + TID warns again;
//  - a different method for the same customer + TID warns again;
//  - no regression: the bypass still works within one opening —
//    the bypassed payment records with the typed reason stored as
//    its reference override reason;
//  - leg 2 is keyed the same way: a leg-2 bypass for A never
//    silences the leg-2 card for B;
//  - the wiring: the leg-1 check compares the keyed bypass, and
//    the customer-form reset clears both bypass keys.
// Synthetic data only: two pattern-fake customers, PKR 3,000 dues
// each. The bypassed leg-1 payment is Rs 500 (not the first
// payment's Rs 1,000) so the 5-minute double-tap guard (SISP-146,
// same customer + amount + method) never fires on the resubmit
// after "Save anyway" — exactly the amount split plan534 uses to
// keep its leg-2 bypass test clear of that guard.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  calculatePaymentAllocations,
  createInitialState,
  generateMonthlyBillsThroughCurrentMonth,
  saveBillMonth,
  updateCustomerProfile
} from '../core.js';
import { getPakistanLocalDate, setupQuickCollectModal } from '../nav-quick-collect.js';

const MONTH = getPakistanLocalDate(new Date()).slice(0, 7);
const TODAY = getPakistanLocalDate(new Date());
const DUP_TID = 'SH8-TID-001';
const REASON = 'Same transfer receipt — customer paid twice on one slip';

function sharafat8FixtureState() {
  const now = new Date();
  let state = createInitialState(['Sharafat Eight A', 'Sharafat Eight B']);
  // Both packages are 1,000 and both bills are hand-priced at 3,000:
  // the setup payment (1,000) equals the package, so the auto-package
  // follow is a no-op (current fee === taken fee) and the bill keeps
  // its price — a 2,000 remainder survives for the bypass-key
  // scenarios. A direct single collection that moved the package would
  // reprice the bill and leave no remainder (user decision 2026-11-12).
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, now);
  state = updateCustomerProfile(state, 'seed-002', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  state = saveBillMonth(state, 'seed-001', { month: MONTH, dueAmount: 3000, status: 'pending' }, now);
  state = saveBillMonth(state, 'seed-002', { month: MONTH, dueAmount: 3000, status: 'pending' }, now);
  return state;
}

const paymentsOfCustomer = (state, customerId, month) =>
  state.customers.find((c) => c.id === customerId)?.bills.find((b) => b.month === month)?.payments ?? [];

const balanceDueCents = (state, customerId, month) =>
  calculatePaymentAllocations(state).forMonth(customerId, month)?.balanceDueCents;

/** The plan534 mock DOM + controller harness, unchanged. */
function mockDom() {
  const registry = new Map();
  const createMockElement = (id, tag = 'div', className = '') => {
    const listeners = {};
    const attrs = {};
    const el = {
      id, tagName: tag.toUpperCase(), className, textContent: '', value: '',
      style: {}, hidden: false, disabled: false, checked: false, options: [], children: [],
      classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
      getAttribute: (n) => attrs[n] ?? null,
      setAttribute: (n, v) => { attrs[n] = v; },
      removeAttribute: (n) => { delete attrs[n]; },
      addEventListener: (type, h) => { (listeners[type] = listeners[type] || []).push(h); },
      dispatch: async (type, evt = {}) => { for (const h of (listeners[type] || [])) await h({ type, target: el, preventDefault: () => {}, ...evt }); },
      click: async () => el.dispatch('click'),
      querySelector: (sel) => {
        if (typeof sel !== 'string' || !sel.startsWith('.')) return null;
        const wanted = sel.slice(1);
        const walk = (node) => {
          for (const child of (node.children || [])) {
            if (String(child.className || '').split(' ').includes(wanted)) return child;
            const found = walk(child);
            if (found) return found;
          }
          return null;
        };
        return walk(el);
      },
      querySelectorAll: () => [],
      appendChild: (child) => { el.children.push(child); return child; },
      removeChild: () => {},
      focus: () => {},
      select: () => {},
      scrollIntoView: () => { el.scrolledIntoView = true; },
      showModal: () => { el.opened = true; el.open = true; },
      close: () => { el.open = false; },
      opened: false,
      open: false,
      scrolledIntoView: false
    };
    let html = '';
    Object.defineProperty(el, 'innerHTML', {
      get: () => html,
      set: (v) => { html = String(v); if (html === '') el.children.length = 0; }
    });
    return el;
  };
  const getEl = (id, tag, className) => {
    if (!registry.has(id)) registry.set(id, createMockElement(id, tag, className));
    return registry.get(id);
  };
  getEl('quickCollectModal', 'dialog');
  getEl('quickCollectDuplicateWarning').hidden = true;
  const splitFields = getEl('quickCollectSplitFields');
  const leg2Card = createMockElement('', 'div', 'qc-duplicate-card qc-split-duplicate-card');
  leg2Card.hidden = true;
  const leg2Msg = createMockElement('', 'p', 'qc-duplicate-msg qc-split-duplicate-msg');
  const leg2Reason = createMockElement('', 'input', 'qc-input qc-split-duplicate-reason');
  const leg2Proceed = createMockElement('', 'button', 'primary-button qc-split-duplicate-proceed');
  const leg2Cancel = createMockElement('', 'button', 'secondary-button qc-split-duplicate-cancel');
  leg2Card.appendChild(leg2Msg);
  leg2Card.appendChild(leg2Reason);
  leg2Card.appendChild(leg2Proceed);
  leg2Card.appendChild(leg2Cancel);
  splitFields.appendChild(leg2Card);
  const form = getEl('quickCollectPaymentForm', 'form');
  form.dispatchEvent = (evt) => form.dispatch(evt.type, evt);
  const documentStub = {
    getElementById: (id) => getEl(id),
    querySelectorAll: () => [],
    createElement: (tag) => createMockElement('', tag),
    addEventListener: () => {},
    body: { appendChild() {}, removeChild() {} },
    activeElement: null
  };
  return { getEl, documentStub, leg2Card, leg2Msg, leg2Reason, leg2Proceed, leg2Cancel };
}

async function withController(state, fn) {
  const { getEl, documentStub, ...card } = mockDom();
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
    await fn({ controller, getEl, toasts, getState: () => current, ...card });
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 130));
    globalThis.document = origDocument;
  }
}

// Plan 382: the save confirmation summary is shown before the payment
// posts — a submit alone records nothing; the operator confirms the
// same figures, then the form posts.
async function submitAndConfirm(getEl, getState, customerId) {
  await getEl('quickCollectPaymentForm').dispatch('submit');
  assert.deepEqual(paymentsOfCustomer(getState(), customerId, MONTH), [],
    'Plan 382: the first submit shows the summary — nothing posts yet');
  await getEl('quickCollectConfirmSaveBtn').click();
  await getEl('quickCollectPaymentForm').dispatch('submit');
}

// Record one Easypaisa payment carrying the given TID, so a later
// entry can duplicate it. Dues are Rs 3,000; this pays Rs 1,000 of
// them, leaving the sheet usable afterwards.
async function recordFirstPayment(getEl, getState, customerId, tid) {
  getEl('quickCollectAmountInput').value = '1000';
  getEl('quickCollectMethodSelect').value = 'Easypaisa';
  await getEl('quickCollectMethodSelect').dispatch('change');
  getEl('quickCollectTransactionIdInput').value = tid;
  await submitAndConfirm(getEl, getState, customerId);
  assert.equal(paymentsOfCustomer(getState(), customerId, MONTH).length, 1, 'precondition: first payment recorded');
  assert.equal(paymentsOfCustomer(getState(), customerId, MONTH)[0].transactionId, tid, 'precondition: first payment carries the TID');
  assert.equal(balanceDueCents(getState(), customerId, MONTH), 200000, 'precondition: Rs 2,000 still due');
}

// One leg-1 submit with the given figures — the duplicate card, if
// any, shows on this first submit (the check runs before confirm).
async function submitLeg1(getEl, { amount, method, tid }) {
  getEl('quickCollectAmountInput').value = String(amount);
  getEl('quickCollectMethodSelect').value = method;
  await getEl('quickCollectMethodSelect').dispatch('change');
  getEl('quickCollectTransactionIdInput').value = tid;
  await getEl('quickCollectPaymentForm').dispatch('submit');
}

// Submit a duplicate leg-1 TID, type the reason, "Save anyway",
// confirm the summary and post — the bypassed payment records.
async function bypassLeg1(getEl, getState, customerId, { amount, method, tid }) {
  await submitLeg1(getEl, { amount, method, tid });
  const card = getEl('quickCollectDuplicateWarning');
  assert.equal(card.hidden, false, 'precondition: the leg-1 duplicate card is showing');
  const reasonInput = getEl('quickCollectDuplicateReasonInput');
  const proceedBtn = getEl('quickCollectDuplicateProceedBtn');
  assert.equal(proceedBtn.disabled, true, 'precondition: Save anyway is disabled until a reason is typed');
  reasonInput.value = REASON;
  await reasonInput.dispatch('input');
  assert.equal(proceedBtn.disabled, false, 'precondition: a reason enables Save anyway');
  await proceedBtn.click();
  assert.equal(getEl('quickCollectStepConfirm').hidden, false, 'the summary is shown after proceeding');
  await getEl('quickCollectConfirmSaveBtn').click();
  await getEl('quickCollectPaymentForm').dispatch('submit');
  const recorded = paymentsOfCustomer(getState(), customerId, MONTH);
  const bypassed = recorded.find((p) => p.transactionId === tid && p.amount === amount);
  assert.ok(bypassed, 'precondition: the bypassed payment recorded');
  return bypassed;
}

// Arm a split whose leg 2 re-uses the given TID: leg 1 Cash Rs 600,
// leg 2 Easypaisa Rs 400 (plan534's figures — neither leg matches
// the first payment's Rs 1,000, so the 5-minute guard stays out).
async function submitSplitWithLeg2Tid(getEl, tid) {
  getEl('quickCollectAmountInput').value = '600';
  getEl('quickCollectMethodSelect').value = 'Cash';
  await getEl('quickCollectMethodSelect').dispatch('change');
  const splitToggle = getEl('quickCollectSplitToggle');
  splitToggle.checked = true;
  await splitToggle.dispatch('change');
  getEl('quickCollectSplitAmountInput').value = '400';
  getEl('quickCollectSplitMethodSelect').value = 'Easypaisa';
  getEl('quickCollectSplitTransactionIdInput').value = tid;
  await getEl('quickCollectPaymentForm').dispatch('submit');
}

test('REPRO (Sharafat 8): bypassing TID X for customer A never silences the warning for customer B', async () => {
  await withController(sharafat8FixtureState(), async ({ controller, getEl, toasts, getState }) => {
    controller.open('seed-001');
    await recordFirstPayment(getEl, getState, 'seed-001', DUP_TID);

    // Arm the bypass for A: same TID, Rs 500, Easypaisa.
    controller.open('seed-001');
    await bypassLeg1(getEl, getState, 'seed-001', { amount: 500, method: 'Easypaisa', tid: DUP_TID });
    assert.equal(paymentsOfCustomer(getState(), 'seed-001', MONTH).length, 2, 'precondition: A has two payments');

    // The same TID for B, same amount as A's first payment and
    // same method, in the same session: the warning must fire
    // again. On the pristine head the raw-TID bypass is still
    // armed, so this sails to the confirm summary with no card.
    controller.open('seed-002');
    await submitLeg1(getEl, { amount: 1000, method: 'Easypaisa', tid: DUP_TID });

    const card = getEl('quickCollectDuplicateWarning');
    assert.equal(card.hidden, false, 'the leg-1 duplicate card shows for customer B');
    assert.match(getEl('quickCollectDuplicateMsg').textContent, new RegExp(DUP_TID), 'the card names the duplicated TID');
    assert.match(getEl('quickCollectDuplicateMsg').textContent, new RegExp(TODAY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'the card names the earlier payment date');
    assert.equal(getEl('quickCollectStepConfirm').hidden, true, 'no confirm summary — nothing posts yet');
    assert.equal(paymentsOfCustomer(getState(), 'seed-002', MONTH).length, 0, 'nothing recorded for B');
    const errorToast = toasts.find((t) => t.opts?.type === 'error');
    assert.equal(errorToast, undefined, `no error toast — got: ${errorToast?.msg}`);
  });
});

test('REPRO (Sharafat 8): opening a customer form again clears the bypass, so the same figures warn again', async () => {
  await withController(sharafat8FixtureState(), async ({ controller, getEl, toasts, getState }) => {
    controller.open('seed-001');
    await recordFirstPayment(getEl, getState, 'seed-001', DUP_TID);

    controller.open('seed-001');
    await bypassLeg1(getEl, getState, 'seed-001', { amount: 500, method: 'Easypaisa', tid: DUP_TID });

    // A fresh form for the same customer, same TID, same amount,
    // same method: the bypass armed in the earlier opening must
    // not carry over. On the pristine head the programmatic field
    // clear fires no `input` event, so the raw-TID bypass stays
    // armed and no card shows.
    controller.open('seed-001');
    await submitLeg1(getEl, { amount: 500, method: 'Easypaisa', tid: DUP_TID });

    assert.equal(getEl('quickCollectDuplicateWarning').hidden, false, 'the leg-1 duplicate card shows again after reopening');
    assert.equal(getEl('quickCollectStepConfirm').hidden, true, 'no confirm summary — nothing posts yet');
    assert.equal(paymentsOfCustomer(getState(), 'seed-001', MONTH).length, 2, 'nothing recorded yet');
    const errorToast = toasts.find((t) => t.opts?.type === 'error');
    assert.equal(errorToast, undefined, `no error toast — got: ${errorToast?.msg}`);
  });
});

test('Sharafat 8: a different amount for the same customer + TID warns again', async () => {
  await withController(sharafat8FixtureState(), async ({ controller, getEl, getState }) => {
    controller.open('seed-001');
    await recordFirstPayment(getEl, getState, 'seed-001', DUP_TID);

    controller.open('seed-001');
    await bypassLeg1(getEl, getState, 'seed-001', { amount: 500, method: 'Easypaisa', tid: DUP_TID });
    // Rs 1,500 still due after 1,000 + 500, so this is a plain
    // in-dues payment — only the amount differs from the bypass.
    controller.open('seed-001');
    await submitLeg1(getEl, { amount: 1500, method: 'Easypaisa', tid: DUP_TID });

    assert.equal(getEl('quickCollectDuplicateWarning').hidden, false, 'the leg-1 duplicate card shows for the different amount');
    assert.equal(paymentsOfCustomer(getState(), 'seed-001', MONTH).length, 2, 'nothing recorded yet');
  });
});

test('Sharafat 8: a different method for the same customer + TID warns again', async () => {
  await withController(sharafat8FixtureState(), async ({ controller, getEl, getState }) => {
    controller.open('seed-001');
    await recordFirstPayment(getEl, getState, 'seed-001', DUP_TID);

    controller.open('seed-001');
    await bypassLeg1(getEl, getState, 'seed-001', { amount: 500, method: 'Easypaisa', tid: DUP_TID });

    controller.open('seed-001');
    await submitLeg1(getEl, { amount: 500, method: 'JazzCash', tid: DUP_TID });

    assert.equal(getEl('quickCollectDuplicateWarning').hidden, false, 'the leg-1 duplicate card shows for the different method');
    assert.equal(paymentsOfCustomer(getState(), 'seed-001', MONTH).length, 2, 'nothing recorded yet');
  });
});

test('Sharafat 8: no regression — the bypass still works within one opening, with the reason stored', async () => {
  await withController(sharafat8FixtureState(), async ({ controller, getEl, toasts, getState }) => {
    controller.open('seed-001');
    await recordFirstPayment(getEl, getState, 'seed-001', DUP_TID);

    controller.open('seed-001');
    const bypassed = await bypassLeg1(getEl, getState, 'seed-001', { amount: 500, method: 'Easypaisa', tid: DUP_TID });
    assert.match(bypassed.referenceOverrideReason || '', /Same transfer receipt/, 'the reason is stored as the reference override reason');
    // User decision 2026-11-12: the bypassed 500 is a single
    // collection, so the package moves to the total taken (1,500) and
    // the bill is repriced to it — the month is fully paid, no 1,500
    // remainder.
    assert.equal(balanceDueCents(getState(), 'seed-001', MONTH), 0, 'ledger: month fully paid after 1,000 + 500');
    const errorToast = toasts.find((t) => t.opts?.type === 'error');
    assert.equal(errorToast, undefined, `no error toast — got: ${errorToast?.msg}`);
  });
});

test('Sharafat 8: leg 2 is keyed the same way — a leg-2 bypass for A never silences the leg-2 card for B', async () => {
  await withController(sharafat8FixtureState(), async ({ controller, getEl, toasts, getState, leg2Card, leg2Reason, leg2Proceed }) => {
    controller.open('seed-001');
    await recordFirstPayment(getEl, getState, 'seed-001', DUP_TID);

    // Arm the leg-2 bypass for A.
    controller.open('seed-001');
    await submitSplitWithLeg2Tid(getEl, DUP_TID);
    assert.equal(leg2Card.hidden, false, 'precondition: the leg-2 duplicate card is showing for A');
    leg2Reason.value = REASON;
    await leg2Reason.dispatch('input');
    await leg2Proceed.click();
    assert.equal(getEl('quickCollectStepConfirm').hidden, false, 'the summary is shown after proceeding');
    await getEl('quickCollectConfirmSaveBtn').click();
    await getEl('quickCollectPaymentForm').dispatch('submit');
    assert.equal(paymentsOfCustomer(getState(), 'seed-001', MONTH).length, 3, 'precondition: both split legs recorded for A');

    // The same leg-2 TID for B: the leg-2 card must fire again.
    // On the pristine head the raw leg-2 TID bypass is still
    // armed, so this sails to the confirm summary with no card.
    controller.open('seed-002');
    await submitSplitWithLeg2Tid(getEl, DUP_TID);

    assert.equal(leg2Card.hidden, false, 'the leg-2 duplicate card shows for customer B');
    assert.equal(getEl('quickCollectStepConfirm').hidden, true, 'no confirm summary — nothing posts yet');
    assert.equal(paymentsOfCustomer(getState(), 'seed-002', MONTH).length, 0, 'nothing recorded for B');
    const errorToast = toasts.find((t) => t.opts?.type === 'error');
    assert.equal(errorToast, undefined, `no error toast — got: ${errorToast?.msg}`);
  });
});

test('wiring (Sharafat 8): the leg-1 check compares the keyed bypass, and the customer-form reset clears both bypass keys', () => {
  const src = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.match(src, /duplicateBypassedForTxnKey !== duplicateTidBypassKey\(activeCustomerId, txnIdVal, amountVal, methodVal\)/,
    'the leg-1 bypass check compares the customer+TID+amount+method key');
  assert.match(src, /duplicateBypassedForLeg2TxnKey !== duplicateTidBypassKey\(activeCustomerId, leg2Txn, leg2Amount, leg2Method\)/,
    'the leg-2 bypass check compares the customer+TID+amount+method key');
  // The clear lives in openCustomerCollectionForm's reset block:
  // after the form opener, before the modal-close handler.
  const openAt = src.indexOf('function openCustomerCollectionForm');
  assert.ok(openAt > 0, 'the customer-form opener exists');
  const clearAt = src.indexOf('// Sharafat 8: the duplicate-TID bypasses are cleared with the');
  assert.ok(clearAt > openAt, 'the bypass clear sits inside the customer-form opener');
  const clearBlock = src.slice(clearAt, clearAt + 1200);
  assert.match(clearBlock, /duplicateBypassedForTxnKey = null;/, 'opening a customer form clears the leg-1 bypass key');
  assert.match(clearBlock, /duplicateBypassedForLeg2TxnKey = null;/, 'opening a customer form clears the leg-2 bypass key');
  const guardSrc = readFileSync(new URL('../duplicate-payment-guard.js', import.meta.url), 'utf8');
  assert.match(guardSrc, /export function duplicateTidBypassKey\(customerId, txnId, amount, method\)/,
    'the TID bypass key helper is exported from the duplicate-payment guard');
});
