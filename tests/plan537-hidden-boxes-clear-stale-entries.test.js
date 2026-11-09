// Plan 537 — Hidden boxes clear their stale entries.
//
// Problem: renderCashChange hides the cash-change box when the
// method leaves the cash family or when split is toggled on, but
// the cash-received field was never cleared on hiding — it was
// only cleared on a fresh form open. Untick split (or switch back
// to Cash) and the stale cash figure reappeared, re-computing
// change against money the customer never handed over. The same
// pattern held for the overpayment radios: renderOverpaymentChoice
// only toggled the box's hidden state and never cleared a checked
// radio, so a choice made for one amount could ride along with a
// different amount — the submit handler reads the checked radio
// regardless of whether the box is currently shown.
//
// Pins:
//  - cash: type cash received, toggle split on then off — the cash
//    field is empty and no change line shows until re-typed
//    (REPRO: fails on the pristine head, where the stale figure
//    reappears and the change re-computes);
//  - cash: switching the method away from cash and back clears
//    the field the same way;
//  - overpayment: choose "advance", tick Advance, untick it — no
//    radio is pre-selected, and the payment records no choice
//    (REPRO: fails on the pristine head, where the old radio is
//    still selected and the submit records it);
//  - overpayment: lowering the amount to the dues hides the box
//    and clears the radio the same way;
//  - re-choosing after a clear records normally, and the normal
//    cash flow is unchanged;
//  - the wiring: the clear lives in the two render functions, the
//    call-site counts are unchanged, and the change arithmetic,
//    the choice options, and how a visible choice is recorded are
//    untouched.
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

function plan537FixtureState() {
  const now = new Date();
  let state = createInitialState(['Plan537 Tester']);
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
 *  overpayment choice box carrying its two radios (advance / credit),
 *  neither pre-ticked — the box's querySelector answers the submit
 *  handler's ':checked' read, like the real DOM; other selectors
 *  fall back to the class walk. */
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
  // The overpayment choice box, as it sits in the real page: a
  // fieldset with the two radios, neither pre-ticked (Plan 386).
  const overpaymentBox = getEl('quickCollectOverpaymentChoice');
  const advanceRadio = createMockElement('', 'input', '');
  advanceRadio.name = 'quickCollectOverpaymentChoice';
  advanceRadio.value = 'advance';
  const creditRadio = createMockElement('', 'input', '');
  creditRadio.name = 'quickCollectOverpaymentChoice';
  creditRadio.value = 'credit';
  overpaymentBox.appendChild(advanceRadio);
  overpaymentBox.appendChild(creditRadio);
  const boxQuerySelector = overpaymentBox.querySelector;
  overpaymentBox.querySelector = (sel) => {
    if (sel === 'input[name="quickCollectOverpaymentChoice"]:checked') {
      return overpaymentBox.children.find((c) => c.checked) ?? null;
    }
    return boxQuerySelector(sel);
  };
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
  return { getEl, documentStub, advanceRadio, creditRadio };
}

async function withController(state, fn) {
  const { getEl, documentStub, ...radios } = mockDom();
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
    await fn({ controller, getEl, toasts, getState: () => current, ...radios });
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

const errorToast = (toasts) => toasts.find((t) => t.opts?.type === 'error');

// Type a cash payment of Rs 3,000 in Cash and hand over a Rs 5,000
// note, so the change line reads Rs 2,000.
async function typeCashPayment(getEl) {
  getEl('quickCollectAmountInput').value = '3000';
  getEl('quickCollectMethodSelect').value = 'Cash';
  await getEl('quickCollectMethodSelect').dispatch('change');
  getEl('quickCollectCashReceivedInput').value = '5000';
  await getEl('quickCollectCashReceivedInput').dispatch('input');
  assert.equal(getEl('quickCollectCashChangeLine').textContent, 'Change due: PKR 2,000',
    'precondition: the change line shows Rs 2,000 for a Rs 5,000 note');
}

test('REPRO (Plan 537): split on then off — the cash field is empty, no change line until re-typed', async () => {
  await withController(plan537FixtureState(), async ({ controller, getEl, toasts, getState }) => {
    controller.open('seed-001');
    await typeCashPayment(getEl);

    const splitToggle = getEl('quickCollectSplitToggle');
    splitToggle.checked = true;
    await splitToggle.dispatch('change');
    assert.equal(getEl('quickCollectCashChangeBox').hidden, true, 'the box hides while split is on');
    assert.equal(getEl('quickCollectCashReceivedInput').value, '', 'the cash figure clears with the box');
    assert.equal(getEl('quickCollectCashChangeLine').textContent, '', 'no change line while split is on');

    splitToggle.checked = false;
    await splitToggle.dispatch('change');
    assert.equal(getEl('quickCollectCashChangeBox').hidden, false, 'the box shows again when split is off');
    // The bug: on the pristine head the stale Rs 5,000 is still in
    // the field, so the change re-computes against money the
    // customer never handed over in this payment.
    assert.equal(getEl('quickCollectCashReceivedInput').value, '', 'the stale cash figure does not come back');
    assert.equal(getEl('quickCollectCashChangeLine').textContent, '', 'no change line until the cash is re-typed');

    getEl('quickCollectCashReceivedInput').value = '5000';
    await getEl('quickCollectCashReceivedInput').dispatch('input');
    assert.equal(getEl('quickCollectCashChangeLine').textContent, 'Change due: PKR 2,000',
      're-typing the cash shows the change again');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('cash: switching the method away from cash and back clears the field the same way', async () => {
  await withController(plan537FixtureState(), async ({ controller, getEl, toasts, getState }) => {
    controller.open('seed-001');
    await typeCashPayment(getEl);

    getEl('quickCollectMethodSelect').value = 'Easypaisa';
    await getEl('quickCollectMethodSelect').dispatch('change');
    assert.equal(getEl('quickCollectCashChangeBox').hidden, true, 'the box hides for a digital method');
    assert.equal(getEl('quickCollectCashReceivedInput').value, '', 'the cash figure clears with the box');
    assert.equal(getEl('quickCollectCashChangeLine').textContent, '', 'no change line for a digital method');

    getEl('quickCollectMethodSelect').value = 'Cash';
    await getEl('quickCollectMethodSelect').dispatch('change');
    assert.equal(getEl('quickCollectCashChangeBox').hidden, false, 'the box shows again for Cash');
    assert.equal(getEl('quickCollectCashReceivedInput').value, '', 'the stale cash figure does not come back');
    assert.equal(getEl('quickCollectCashChangeLine').textContent, '', 'no change line until the cash is re-typed');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('REPRO (Plan 537): choose "advance", tick Advance, untick it — no radio pre-selected, nothing recorded', async () => {
  await withController(plan537FixtureState(), async ({ controller, getEl, toasts, getState, advanceRadio, creditRadio }) => {
    controller.open('seed-001');
    getEl('quickCollectAmountInput').value = '3500';
    await getEl('quickCollectAmountInput').dispatch('input');
    assert.equal(getEl('quickCollectOverpaymentChoice').hidden, false,
      'precondition: the choice box shows for Rs 3,500 against Rs 3,000 dues');
    assert.equal(getEl('quickCollectOverpaymentExtra').textContent, 'PKR 500',
      'precondition: the extra is Rs 500');

    advanceRadio.checked = true;
    const advanceCheckbox = getEl('quickCollectAdvanceCheckbox');
    advanceCheckbox.checked = true;
    await advanceCheckbox.dispatch('change');
    assert.equal(getEl('quickCollectOverpaymentChoice').hidden, true, 'the box hides while Advance is ticked');
    assert.equal(advanceRadio.checked, false, 'the advance radio clears with the box');
    assert.equal(creditRadio.checked, false, 'no radio is left selected');

    advanceCheckbox.checked = false;
    await advanceCheckbox.dispatch('change');
    assert.equal(getEl('quickCollectOverpaymentChoice').hidden, false, 'the box shows again when Advance is unticked');
    // The bug: on the pristine head the old radio is still
    // selected, and the submit handler reads it regardless of
    // whether the box was shown when it was picked.
    assert.equal(advanceRadio.checked, false, 'no radio is pre-selected after unticking');
    assert.equal(creditRadio.checked, false, 'no radio is pre-selected after unticking');

    await submitAndConfirm(getEl, getState);
    const recorded = paymentsOf(getState(), MONTH);
    assert.equal(recorded.length, 1, 'the payment recorded');
    assert.equal(recorded[0].overpaymentChoice ?? null, null, 'no stale choice rides along with the payment');
    assert.equal(balanceDueCents(getState(), MONTH), 0, 'ledger: the Rs 3,000 dues are settled');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('overpayment: lowering the amount to the dues hides the box and clears the radio', async () => {
  await withController(plan537FixtureState(), async ({ controller, getEl, toasts, getState, advanceRadio, creditRadio }) => {
    controller.open('seed-001');
    getEl('quickCollectAmountInput').value = '3500';
    await getEl('quickCollectAmountInput').dispatch('input');
    assert.equal(getEl('quickCollectOverpaymentChoice').hidden, false, 'precondition: the box shows for Rs 3,500');

    advanceRadio.checked = true;
    getEl('quickCollectAmountInput').value = '3000';
    await getEl('quickCollectAmountInput').dispatch('input');
    assert.equal(getEl('quickCollectOverpaymentChoice').hidden, true, 'the box hides once the amount no longer exceeds the dues');
    assert.equal(advanceRadio.checked, false, 'the radio clears with the box');
    assert.equal(creditRadio.checked, false, 'no radio is left selected');

    getEl('quickCollectAmountInput').value = '3500';
    await getEl('quickCollectAmountInput').dispatch('input');
    assert.equal(getEl('quickCollectOverpaymentChoice').hidden, false, 'the box shows again when the amount exceeds the dues');
    assert.equal(advanceRadio.checked, false, 'no radio is pre-selected on re-offer');
    assert.equal(creditRadio.checked, false, 'no radio is pre-selected on re-offer');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('re-choosing after a clear records normally', async () => {
  await withController(plan537FixtureState(), async ({ controller, getEl, toasts, getState, advanceRadio, creditRadio }) => {
    controller.open('seed-001');
    getEl('quickCollectAmountInput').value = '3500';
    await getEl('quickCollectAmountInput').dispatch('input');
    advanceRadio.checked = true;
    const advanceCheckbox = getEl('quickCollectAdvanceCheckbox');
    advanceCheckbox.checked = true;
    await advanceCheckbox.dispatch('change');
    advanceCheckbox.checked = false;
    await advanceCheckbox.dispatch('change');
    assert.equal(advanceRadio.checked, false, 'precondition: the clear happened');

    creditRadio.checked = true;
    await submitAndConfirm(getEl, getState);
    const recorded = paymentsOf(getState(), MONTH);
    assert.equal(recorded.length, 1, 'the payment recorded');
    assert.deepEqual(recorded[0].overpaymentChoice, { choice: 'credit', extraCents: 50000 },
      'the re-chosen credit disposition records exactly as before');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('normal cash flow unchanged: cash received still computes change and the payment records', async () => {
  await withController(plan537FixtureState(), async ({ controller, getEl, toasts, getState }) => {
    controller.open('seed-001');
    await typeCashPayment(getEl);
    await submitAndConfirm(getEl, getState);

    const recorded = paymentsOf(getState(), MONTH);
    assert.equal(recorded.length, 1, 'the single payment recorded');
    assert.equal(recorded[0].amount, 3000, 'the recorded amount is Rs 3,000');
    assert.equal(recorded[0].method, 'Cash', 'the recorded method is Cash');
    assert.equal(balanceDueCents(getState(), MONTH), 0, 'ledger: the Rs 3,000 dues are settled');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('wiring: the clear lives in the two render functions and the call-site counts are unchanged', () => {
  const src = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');

  const cashAt = src.indexOf('function renderCashChange()');
  assert.ok(cashAt > -1, 'renderCashChange must be defined');
  const cashFn = src.slice(cashAt, src.indexOf('function renderNextReceiptLine()', cashAt));
  assert.ok(cashFn.includes('cashChangeBox.hidden = !show;'), 'the box still hides on the same rule');
  assert.ok(cashFn.includes("if (!show && cashReceivedInput) cashReceivedInput.value = '';"),
    'the cash field clears whenever the box hides');
  assert.ok(cashFn.includes('cashChangeLineText(cashReceivedInput?.value, amountInput?.value)'),
    'the change arithmetic is untouched');

  const choiceAt = src.indexOf('function renderOverpaymentChoice()');
  assert.ok(choiceAt > -1, 'renderOverpaymentChoice must be defined');
  const choiceFn = src.slice(choiceAt, src.indexOf('function renderUnderpaymentWarning()', choiceAt));
  assert.ok(choiceFn.includes('overpaymentChoiceBox.hidden = extraCents <= 0;'), 'the box still hides on no extra');
  assert.ok(choiceFn.includes('overpaymentChoiceBox.querySelector(\'input[name="quickCollectOverpaymentChoice"]:checked\')'),
    'the clear reads the checked radio through the box, like the submit handler');
  assert.ok(choiceFn.includes('picked.checked = false;'), 'the checked radio is cleared when the box hides');
  assert.ok(choiceFn.includes('excessCashPurposeSelect.disabled = !overpaymentChoiceBox.hidden;'),
    'the Plan 529 select disable is untouched');

  // No new refresh sites: the clears ride the existing renders.
  assert.equal((src.match(/renderCashChange\(\)/g) || []).length, 12,
    'renderCashChange call sites unchanged (11 sites + definition)');
  assert.equal((src.match(/renderOverpaymentChoice\(\)/g) || []).length, 10,
    'renderOverpaymentChoice call sites unchanged (9 sites + definition)');
  // The submit handler still reads the checked radio the same way —
  // the clear only changes what is checked, never how it is read.
  assert.ok(src.includes("overpaymentChoiceBox?.querySelector('input[name=\"quickCollectOverpaymentChoice\"]:checked')"),
    'the submit read is untouched');
});
