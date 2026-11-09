// Plan 534 — Leg-2 duplicate TID gets the same card as leg 1.
//
// Problem: a duplicate Transaction ID on leg 1 opens the in-app
// duplicate card with the earlier payment's details, a required
// reason field, "Save anyway" and "Cancel & Edit ID". The same
// duplicate on leg 2 was only a toast — and toasts hide behind the
// sheet (Plan 296) — with no reason/bypass path at all, so a
// genuinely re-used leg-2 reference could only be worked around by
// changing the ID.
//
// Pins:
//  - a leg-2 TID already recorded shows the duplicate card beside
//    the leg-2 TID field (not only a toast) with the earlier
//    payment's date, customer and amount, and returns to the form
//    step so the card is visible (the check runs before confirm —
//    Plan 536 — so the card shows on the first submit);
//    nothing is recorded yet (REPRO: fails on the pristine head,
//    which toasts only);
//  - the card's "Save anyway" needs a reason, then records both
//    legs with the reason stored as leg 2's reference override
//    reason; "Cancel & Edit ID" hides the card and clears the
//    bypass, so resubmitting the same TID shows the card again;
//  - leg-1 behaviour is unchanged: a leg-1 duplicate still shows
//    the leg-1 card, and the leg-2 card stays hidden;
//  - a fresh leg-2 TID records both legs with no card and no error;
//  - the wiring: the card carries no id (found by class through
//    the split fields block), detection is untouched
//    (findDuplicatePaymentReference), the fallback toast wording
//    is unchanged, and the polish #19 undo capture still stands.
// Synthetic data only: one pattern-fake customer, PKR 3,000 dues.
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
const TODAY = getPakistanLocalDate(new Date());
const DUP_TID = 'DUP-TID-001';
const LEG1_TID = 'DUP-LEG1-001';
const REASON = 'Combined receipt — customer paid both legs on one transfer';

function plan534FixtureState() {
  const now = new Date();
  let state = createInitialState(['Plan534 Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 3000
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  return state;
}

const paymentsOf = (state, month) =>
  state.customers[0].bills.find((b) => b.month === month)?.payments ?? [];

const balanceDueCents = (state, month) =>
  calculatePaymentAllocations(state).forMonth('seed-001', month)?.balanceDueCents;

/** The owner-cash-shop test's mock DOM + controller harness, with the
 *  Plan 534 additions: a real querySelector over descendants (so the
 *  class-found leg-2 card is reachable), scrollIntoView, and a
 *  dispatchEvent on the form (the card's Proceed fallback path). */
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
    // innerHTML assignment replaces children, like the real DOM — the
    // list renderer clears its host this way before re-rendering.
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
  // The leg-1 card starts hidden in the real markup; the mock must
  // match, or "leg-1 card stays hidden" would assert nothing.
  getEl('quickCollectDuplicateWarning').hidden = true;
  // The Plan 534 leg-2 card, as it sits in the real page: inside the
  // split fields block, hidden, with its message, reason input and
  // buttons found by class — no ids anywhere on it.
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
  // The form's Proceed fallback calls dispatchEvent (no requestSubmit
  // in this harness, exactly like the polish #19 mock).
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

// Record one Easypaisa payment carrying the given TID, so a later
// leg-2 entry can duplicate it. Dues are Rs 3,000; this pays
// Rs 1,000 of them, leaving the sheet usable afterwards.
async function recordFirstPayment(getEl, getState, tid) {
  getEl('quickCollectAmountInput').value = '1000';
  getEl('quickCollectMethodSelect').value = 'Easypaisa';
  await getEl('quickCollectMethodSelect').dispatch('change');
  getEl('quickCollectTransactionIdInput').value = tid;
  await submitAndConfirm(getEl, getState);
  assert.equal(paymentsOf(getState(), MONTH).length, 1, 'precondition: first payment recorded');
  assert.equal(paymentsOf(getState(), MONTH)[0].transactionId, tid, 'precondition: first payment carries the TID');
  assert.equal(balanceDueCents(getState(), MONTH), 200000, 'precondition: Rs 2,000 still due');
}

// Arm a split whose leg 2 re-uses the given TID: leg 1 Cash Rs 600,
// leg 2 Easypaisa Rs 400. One submit only — Plan 536 moved the
// leg-2 duplicate check before the confirm step, so the card shows
// on the first submit, with no confirm round-trip (exactly like the
// leg-1 check below).
async function submitSplitWithLeg2Tid(getEl, tid) {
  getEl('quickCollectAmountInput').value = '600';
  // Leg 1 is Cash: the method is remembered per customer (Plan 431),
  // so after the Easypaisa first payment the form could otherwise
  // default leg 1 to Easypaisa — digital with no TID — and the
  // leg-1 TID guard would refuse before the split checks run.
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

test('REPRO (Plan 534): a leg-2 duplicate TID shows the card beside the field, not only a toast', async () => {
  await withController(plan534FixtureState(), async ({ controller, getEl, toasts, getState, leg2Card, leg2Msg }) => {
    controller.open('seed-001');
    await recordFirstPayment(getEl, getState, DUP_TID);

    controller.open('seed-001');
    await submitSplitWithLeg2Tid(getEl, DUP_TID);

    // The bug: on the pristine head this is only the toast — the
    // card never appears and the operator misses it behind the sheet.
    assert.equal(leg2Card.hidden, false, 'the leg-2 duplicate card is visible');
    assert.match(leg2Msg.textContent, new RegExp(DUP_TID), 'the card names the duplicated TID');
    assert.match(leg2Msg.textContent, new RegExp(TODAY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'the card names the earlier payment date');
    assert.match(leg2Msg.textContent, /Plan534 Tester/, 'the card names the earlier payment customer');
    assert.match(leg2Msg.textContent, /PKR 1,000/, 'the card names the earlier payment amount');
    assert.equal(getEl('quickCollectStepForm').hidden, false, 'back on the form step so the card is seen');
    assert.equal(getEl('quickCollectStepConfirm').hidden, true, 'the confirm step is gone');
    assert.equal(leg2Card.scrolledIntoView, true, 'the card scrolls into view');
    assert.equal(getEl('quickCollectDuplicateWarning').hidden, true, 'the leg-1 card stays hidden');
    assert.equal(paymentsOf(getState(), MONTH).length, 1, 'nothing recorded yet');
    const errorToast = toasts.find((t) => t.opts?.type === 'error');
    assert.equal(errorToast, undefined, `no error toast — got: ${errorToast?.msg}`);
  });
});

test('bypass: Save anyway needs a reason, then records both legs with the reason on leg 2', async () => {
  await withController(plan534FixtureState(), async ({ controller, getEl, toasts, getState, leg2Card, leg2Reason, leg2Proceed }) => {
    controller.open('seed-001');
    await recordFirstPayment(getEl, getState, DUP_TID);

    controller.open('seed-001');
    await submitSplitWithLeg2Tid(getEl, DUP_TID);
    assert.equal(leg2Card.hidden, false, 'precondition: the card is showing');

    assert.equal(leg2Proceed.disabled, true, 'Save anyway is disabled until a reason is typed');
    leg2Reason.value = REASON;
    await leg2Reason.dispatch('input');
    assert.equal(leg2Proceed.disabled, false, 'a reason enables Save anyway');

    await leg2Proceed.click();
    // Proceed resubmits: the confirm summary is shown for the
    // first time here (the card came before any confirm — Plan
    // 536), so confirm once to post.
    assert.equal(getEl('quickCollectStepConfirm').hidden, false, 'the summary is shown after proceeding');
    await getEl('quickCollectConfirmSaveBtn').click();
    await getEl('quickCollectPaymentForm').dispatch('submit');

    const recorded = paymentsOf(getState(), MONTH);
    assert.equal(recorded.length, 3, 'both split legs recorded alongside the first payment');
    const leg2 = recorded.find((p) => p.transactionId === DUP_TID && p.amount === 400);
    assert.ok(leg2, 'leg 2 recorded with the duplicated TID');
    assert.match(leg2.referenceOverrideReason || '', /Combined receipt/, 'the reason is stored as leg 2’s reference override reason');
    assert.equal(balanceDueCents(getState(), MONTH), 100000, 'ledger: Rs 1,000 still due after 600 + 400');
    const errorToast = toasts.find((t) => t.opts?.type === 'error');
    assert.equal(errorToast, undefined, `no error toast — got: ${errorToast?.msg}`);
  });
});

test('cancel: Cancel & Edit ID hides the card and clears the bypass, so the same TID shows it again', async () => {
  await withController(plan534FixtureState(), async ({ controller, getEl, toasts, getState, leg2Card, leg2Cancel }) => {
    controller.open('seed-001');
    await recordFirstPayment(getEl, getState, DUP_TID);

    controller.open('seed-001');
    await submitSplitWithLeg2Tid(getEl, DUP_TID);
    assert.equal(leg2Card.hidden, false, 'precondition: the card is showing');

    await leg2Cancel.click();
    assert.equal(leg2Card.hidden, true, 'cancel hides the card');
    assert.equal(paymentsOf(getState(), MONTH).length, 1, 'nothing recorded after cancel');

    // The bypass was cleared: resubmitting the same TID shows the
    // card again instead of sailing through.
    await submitSplitWithLeg2Tid(getEl, DUP_TID);
    assert.equal(leg2Card.hidden, false, 'the same TID shows the card again after cancel');
    assert.equal(paymentsOf(getState(), MONTH).length, 1, 'still nothing recorded');
    const errorToast = toasts.find((t) => t.opts?.type === 'error');
    assert.equal(errorToast, undefined, `no error toast — got: ${errorToast?.msg}`);
  });
});

test('leg-1 behaviour unchanged: a leg-1 duplicate still shows the leg-1 card, leg-2 card stays hidden', async () => {
  await withController(plan534FixtureState(), async ({ controller, getEl, toasts, getState, leg2Card }) => {
    controller.open('seed-001');
    await recordFirstPayment(getEl, getState, LEG1_TID);

    controller.open('seed-001');
    getEl('quickCollectAmountInput').value = '1000';
    getEl('quickCollectMethodSelect').value = 'Easypaisa';
    await getEl('quickCollectMethodSelect').dispatch('change');
    getEl('quickCollectTransactionIdInput').value = LEG1_TID;
    await getEl('quickCollectPaymentForm').dispatch('submit');

    // The leg-1 check runs before the confirm step, so the card
    // shows on the first submit — no confirm round-trip.
    const leg1Card = getEl('quickCollectDuplicateWarning');
    assert.equal(leg1Card.hidden, false, 'the leg-1 duplicate card is visible');
    const leg1Msg = getEl('quickCollectDuplicateMsg');
    assert.match(leg1Msg.textContent, new RegExp(LEG1_TID), 'the leg-1 card names the duplicated TID');
    assert.match(leg1Msg.textContent, /Plan534 Tester/, 'the leg-1 card names the earlier payment customer');
    assert.match(leg1Msg.textContent, /PKR 1,000/, 'the leg-1 card names the earlier payment amount');
    assert.equal(leg2Card.hidden, true, 'the leg-2 card stays hidden');
    assert.equal(paymentsOf(getState(), MONTH).length, 1, 'nothing recorded yet');
    const errorToast = toasts.find((t) => t.opts?.type === 'error');
    assert.equal(errorToast, undefined, `no error toast — got: ${errorToast?.msg}`);
  });
});

test('fresh leg-2 TID records both legs with no card and no error', async () => {
  await withController(plan534FixtureState(), async ({ controller, getEl, toasts, getState, leg2Card }) => {
    controller.open('seed-001');
    getEl('quickCollectAmountInput').value = '600';
    const splitToggle = getEl('quickCollectSplitToggle');
    splitToggle.checked = true;
    await splitToggle.dispatch('change');
    getEl('quickCollectSplitAmountInput').value = '400';
    getEl('quickCollectSplitMethodSelect').value = 'Easypaisa';
    getEl('quickCollectSplitTransactionIdInput').value = 'FRESH-TID-001';
    await submitAndConfirm(getEl, getState);

    const recorded = paymentsOf(getState(), MONTH);
    assert.equal(recorded.length, 2, 'both split legs recorded');
    assert.deepEqual(recorded.map((p) => p.amount).sort((a, b) => a - b), [400, 600], 'leg amounts 600 + 400');
    assert.equal(leg2Card.hidden, true, 'the leg-2 card never shows for a fresh TID');
    const errorToast = toasts.find((t) => t.opts?.type === 'error');
    assert.equal(errorToast, undefined, `no error toast — got: ${errorToast?.msg}`);
  });
});

test('wiring: the leg-2 card carries no id, is found by class, and detection is untouched', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const src = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');

  // The card sits inside the split digital fields, directly after
  // the leg-2 TID field group and before the sender-name group.
  const digitalAt = html.indexOf('id="quickCollectSplitDigitalFields"');
  assert.ok(digitalAt > 0, 'split digital fields block found');
  const cardAt = html.indexOf('qc-split-duplicate-card', digitalAt);
  assert.ok(cardAt > digitalAt, 'the leg-2 card is inside the split digital fields');
  const tidAt = html.indexOf('id="quickCollectSplitTransactionIdInput"', digitalAt);
  const senderAt = html.indexOf('id="quickCollectSplitSenderNameInput"', digitalAt);
  assert.ok(tidAt > 0 && senderAt > 0, 'leg-2 TID and sender fields found');
  assert.ok(cardAt > tidAt && cardAt < senderAt, 'the card sits right after the leg-2 TID field');
  // No id anywhere on the card or its children — the five class
  // hooks are the only way the wiring reaches it, so no new
  // element-id prefix is consumed.
  const cardHtml = html.slice(cardAt, html.indexOf('</div>', html.indexOf('qc-split-duplicate-cancel', cardAt)));
  assert.doesNotMatch(cardHtml, /id="/, 'no id on the leg-2 card or its children');
  for (const cls of ['qc-split-duplicate-card', 'qc-split-duplicate-msg', 'qc-split-duplicate-reason', 'qc-split-duplicate-proceed', 'qc-split-duplicate-cancel']) {
    assert.ok(html.includes(cls), `page carries .${cls}`);
    assert.ok(src.includes(cls), `wiring finds .${cls}`);
  }
  // The leg-1 card is byte-unchanged.
  assert.ok(html.includes('id="quickCollectDuplicateWarning"'), 'the leg-1 card is still in the page');
  assert.ok(html.includes('id="quickCollectDuplicateReasonInput"'), 'the leg-1 reason input is still in the page');

  // The wiring: the card is found by class through the split fields
  // block, guarded for stub documents without querySelector.
  assert.match(src, /splitFields && typeof splitFields\.querySelector === 'function'\s*\n\s*\? splitFields\.querySelector\('\.qc-split-duplicate-card'\)/,
    'the card is found by class through the split fields block');
  assert.match(src, /let duplicateBypassedForLeg2Txn = null;/, 'the leg-2 bypass state exists');
  assert.match(src, /if \(dup2 && duplicateBypassedForLeg2Txn !== leg2Txn\) \{/,
    'the leg-2 check skips a bypassed TID');
  assert.match(src, /showStep\('form'\);\s*\n\s*leg2DupCard\.hidden = false;/,
    'the card shows on the form step, so it is visible');
  assert.match(src, /syncLeg2DupProceed\(\);/, 'the proceed button syncs to the reason');
  // Detection itself is untouched: the same shared lookup, and the
  // fallback toast keeps its exact pre-plan wording.
  assert.match(src, /const dup2 = findDuplicatePaymentReference\(state, leg2Txn\);/,
    'duplicate detection is the same shared lookup');
  assert.ok(src.includes('Give leg 2 its own Transaction ID.'), 'the fallback toast wording is unchanged');
  // The reason lands on leg 2 exactly like leg 1's reason lands on
  // leg 1 — and the leg-1 flow is untouched.
  assert.match(src, /const leg2Reference = \(duplicateBypassedForLeg2Txn && leg2Txn === duplicateBypassedForLeg2Txn/,
    'leg 2’s reference mirrors leg 1’s');
  assert.match(src, /referenceOverrideReason: leg2Reference/, 'leg 2 records the reference');
  assert.match(src, /duplicateBypassedForTxn !== txnIdVal/, 'the leg-1 bypass check is untouched');
  // Polish #19 still stands: the undo captures the legs before
  // nulling the context.
  assert.match(src, /splitLegs: undoSplitLegs/, 'the polish #19 undo capture still stands');
  // No new storage, clock or id lookups in the new wiring — the
  // capture block is only the five class lookups below (the slice
  // stops before the pre-existing getElementById captures that
  // follow it in the file).
  const captureAt = src.indexOf('const leg2DupCard =');
  assert.ok(captureAt > 0, 'the Plan 534 capture block found');
  const captureEnd = src.indexOf("leg2DupEl('.qc-split-duplicate-cancel');", captureAt)
    + "leg2DupEl('.qc-split-duplicate-cancel');".length;
  const captureBlock = src.slice(captureAt, captureEnd);
  assert.doesNotMatch(captureBlock, /localStorage/, 'no storage in the new wiring');
  assert.doesNotMatch(captureBlock, /getElementById/, 'no bare-document id lookup in the new wiring');
  assert.doesNotMatch(captureBlock, /new Date\(|Date\.now\(/, 'no clock in the new wiring');
});
