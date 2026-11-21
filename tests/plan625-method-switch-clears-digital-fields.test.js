// Plan 625 — A method switch away from digital clears the stale
// reference, sender and override (leg 1 and leg 2), and the
// one-screen submit clears them too.
// C tests assert the FIXED state (they FAIL on the base, PASS with the fix).
// S tests are stability (PASS on base AND with the fix). B tests are behaviour.
// This file is NOT a pinning file: it contains no parity literals.
// Harness: the Plan 537 mock DOM + controller harness (mock elements
// behind getElementById, method switch via the select's change event,
// split via the toggle's change event, submit + Plan 382 confirm).
// Synthetic data only — no real customer names, no realistic phone
// numbers (pattern-fake digits only).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {
  createInitialState, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth, calculatePaymentAllocations
} = await import(pathToFileURL(join(root, 'core.js')).href);
const { getPakistanLocalDate, setupQuickCollectModal } = await import(pathToFileURL(join(root, 'nav-quick-collect.js')).href);

const MONTH = getPakistanLocalDate(new Date()).slice(0, 7);
const TID = 'TID-625-TEST-001';
const LEG2_TID = 'TID-625-TEST-002';
const SENDER = 'Test Sender';
const DIGITS = '3310';
const OVERRIDE = 'Test override reason';

function plan625State(now) {
  let state = createInitialState(['Plan625 Tester']);
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

/** Plan 537's mock DOM + controller harness, without the overpayment
 *  radios (not needed here). The method switch is driven through the
 *  select's change event, the split through the toggle's change
 *  event — the same events the real UI fires. */
function mockDom() {
  const registry = new Map();
  const createMockElement = (id, tag = 'div') => {
    const listeners = {};
    const attrs = {};
    const el = {
      id, tagName: tag.toUpperCase(), textContent: '', value: '',
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
    let html = '';
    Object.defineProperty(el, 'innerHTML', {
      get: () => html,
      set: (v) => { html = String(v ?? ''); if (html === '') el.children.length = 0; }
    });
    return el;
  };
  const getEl = (id, tag) => {
    if (!registry.has(id)) registry.set(id, createMockElement(id, tag));
    return registry.get(id);
  };
  getEl('quickCollectModal', 'dialog');
  getEl('quickCollectDuplicateWarning').hidden = true;
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
    await new Promise((resolve) => setTimeout(resolve, 130));
    globalThis.document = origDocument;
  }
}

// Plan 382: the save confirmation summary is shown before the payment
// posts — a submit alone records nothing; the operator confirms the
// same figures, then the form posts.
async function submitAndConfirm(getEl, getState) {
  await getEl('quickCollectPaymentForm').dispatch('submit');
  assert.deepEqual(paymentsOf(getState(), MONTH), [],
    'Plan 382: the first submit shows the summary — nothing posts yet');
  await getEl('quickCollectConfirmSaveBtn').click();
  await getEl('quickCollectPaymentForm').dispatch('submit');
}

const errorToast = (toasts) => toasts.find((t) => t.opts?.type === 'error');

async function switchMethod(getEl, method) {
  getEl('quickCollectMethodSelect').value = method;
  await getEl('quickCollectMethodSelect').dispatch('change');
}

async function switchLeg2Method(getEl, method) {
  getEl('quickCollectSplitMethodSelect').value = method;
  await getEl('quickCollectSplitMethodSelect').dispatch('change');
}

function typeLeg1Digital(getEl, tid = TID) {
  getEl('quickCollectTransactionIdInput').value = tid;
  getEl('quickCollectSenderNameInput').value = SENDER;
  getEl('quickCollectSenderDigitsInput').value = DIGITS;
  getEl('quickCollectOverrideReasonInput').value = OVERRIDE;
}

function typeLeg2Digital(getEl, tid = LEG2_TID) {
  getEl('quickCollectSplitTransactionIdInput').value = tid;
  getEl('quickCollectSplitSenderNameInput').value = SENDER;
  getEl('quickCollectSplitSenderDigitsInput').value = DIGITS;
  getEl('quickCollectSplitOverrideReasonInput').value = OVERRIDE;
}

function leg1DigitalValues(getEl) {
  return {
    tid: getEl('quickCollectTransactionIdInput').value,
    sender: getEl('quickCollectSenderNameInput').value,
    digits: getEl('quickCollectSenderDigitsInput').value,
    override: getEl('quickCollectOverrideReasonInput').value
  };
}

function leg2DigitalValues(getEl) {
  return {
    tid: getEl('quickCollectSplitTransactionIdInput').value,
    sender: getEl('quickCollectSplitSenderNameInput').value,
    digits: getEl('quickCollectSplitSenderDigitsInput').value,
    override: getEl('quickCollectSplitOverrideReasonInput').value
  };
}

test('C1: leg-1 digital fields clear when the method leaves digital, and stay empty on switch-back', async () => {
  await withController(plan625State(new Date()), async ({ controller, getEl, toasts }) => {
    controller.open('seed-001');
    getEl('quickCollectAmountInput').value = '3000';
    await switchMethod(getEl, 'Easypaisa');
    assert.equal(getEl('quickCollectDigitalFields').hidden, false, 'precondition: digital fields show for Easypaisa');
    typeLeg1Digital(getEl);
    assert.deepEqual(leg1DigitalValues(getEl),
      { tid: TID, sender: SENDER, digits: DIGITS, override: OVERRIDE }, 'precondition: the typed values sit in the fields');

    await switchMethod(getEl, 'Cash');
    assert.equal(getEl('quickCollectDigitalFields').hidden, true, 'the digital fields hide for Cash');
    assert.deepEqual(leg1DigitalValues(getEl),
      { tid: '', sender: '', digits: '', override: '' }, 'the stale reference, sender and override are cleared on the switch');

    await switchMethod(getEl, 'Easypaisa');
    assert.equal(getEl('quickCollectDigitalFields').hidden, false, 'the digital fields show again for Easypaisa');
    assert.deepEqual(leg1DigitalValues(getEl),
      { tid: '', sender: '', digits: '', override: '' }, 'switching back shows empty fields, not yesterday\'s reference');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('C2: leg-2 digital fields clear when the leg-2 method leaves digital, and stay empty on switch-back', async () => {
  await withController(plan625State(new Date()), async ({ controller, getEl, toasts }) => {
    controller.open('seed-001');
    getEl('quickCollectAmountInput').value = '3000';
    await switchMethod(getEl, 'Cash');
    const splitToggle = getEl('quickCollectSplitToggle');
    splitToggle.checked = true;
    await splitToggle.dispatch('change');
    await switchLeg2Method(getEl, 'Easypaisa');
    assert.equal(getEl('quickCollectSplitDigitalFields').hidden, false, 'precondition: leg-2 digital fields show for Easypaisa');
    typeLeg2Digital(getEl);
    assert.deepEqual(leg2DigitalValues(getEl),
      { tid: LEG2_TID, sender: SENDER, digits: DIGITS, override: OVERRIDE }, 'precondition: the typed leg-2 values sit in the fields');

    await switchLeg2Method(getEl, 'Cash');
    assert.equal(getEl('quickCollectSplitDigitalFields').hidden, true, 'the leg-2 digital fields hide for Cash');
    assert.deepEqual(leg2DigitalValues(getEl),
      { tid: '', sender: '', digits: '', override: '' }, 'the stale leg-2 reference, sender and override are cleared on the switch');

    await switchLeg2Method(getEl, 'Easypaisa');
    assert.equal(getEl('quickCollectSplitDigitalFields').hidden, false, 'the leg-2 digital fields show again for Easypaisa');
    assert.deepEqual(leg2DigitalValues(getEl),
      { tid: '', sender: '', digits: '', override: '' }, 'switching leg 2 back shows empty fields, not the old reference');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('C3: a Cash payment after the switch carries no reference from the previous method', async () => {
  await withController(plan625State(new Date()), async ({ controller, getEl, toasts, getState }) => {
    controller.open('seed-001');
    getEl('quickCollectAmountInput').value = '3000';
    await switchMethod(getEl, 'Easypaisa');
    typeLeg1Digital(getEl);
    await switchMethod(getEl, 'Cash');
    await submitAndConfirm(getEl, getState);

    const recorded = paymentsOf(getState(), MONTH);
    assert.equal(recorded.length, 1, 'the payment recorded');
    assert.equal(recorded[0].method, 'Cash', 'the recorded method is Cash');
    assert.equal(recorded[0].transactionId ?? '', '', 'no wallet TID rides along with the Cash payment');
    assert.equal(recorded[0].reference ?? '', '', 'no reference rides along either');
    assert.equal(recorded[0].referenceOverrideReason ?? '', '', 'no override reason rides along either');
    assert.equal(balanceDueCents(getState(), MONTH), 0, 'ledger: the Rs 3,000 dues are settled');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('C4: a split whose leg 2 switched to Cash records a leg-2 payment with no reference', async () => {
  await withController(plan625State(new Date()), async ({ controller, getEl, toasts, getState }) => {
    controller.open('seed-001');
    getEl('quickCollectAmountInput').value = '1500';
    // Leg 1 is Easypaisa with its own TID: a split whose two legs
    // share one method is refused by the engine
    // (split-tender-collect.js: "Both legs use the same method"),
    // so a Cash + Cash split can never record — the leg-2 clear is
    // proved with a digital leg 1 and a Cash leg 2 instead.
    await switchMethod(getEl, 'Easypaisa');
    typeLeg1Digital(getEl);
    const splitToggle = getEl('quickCollectSplitToggle');
    splitToggle.checked = true;
    await splitToggle.dispatch('change');
    await switchLeg2Method(getEl, 'Easypaisa');
    typeLeg2Digital(getEl);
    getEl('quickCollectSplitAmountInput').value = '1500';
    await switchLeg2Method(getEl, 'Cash');
    assert.deepEqual(leg2DigitalValues(getEl),
      { tid: '', sender: '', digits: '', override: '' }, 'precondition: the leg-2 fields cleared on the switch');
    await submitAndConfirm(getEl, getState);

    const recorded = paymentsOf(getState(), MONTH);
    assert.equal(recorded.length, 2, 'both split legs recorded');
    const leg1 = recorded[0];
    assert.equal(leg1.method, 'Easypaisa', 'the leg-1 method is Easypaisa');
    assert.equal(leg1.transactionId, TID, 'the leg-1 TID records exactly as typed');
    const leg2 = recorded[1];
    assert.equal(leg2.method, 'Cash', 'the leg-2 method is Cash');
    assert.equal(leg2.amount, 1500, 'the leg-2 amount is Rs 1,500');
    assert.equal(leg2.transactionId ?? '', '', 'no wallet TID rides along with the Cash leg 2');
    assert.equal(leg2.referenceOverrideReason ?? '', '', 'no override reason rides along with the Cash leg 2');
    assert.equal(balanceDueCents(getState(), MONTH), 0, 'ledger: the Rs 3,000 dues are settled');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('C5 (source): the clear lives in the two visibility functions, with no new listeners', () => {
  const src = readFileSync(join(root, 'nav-quick-collect.js'), 'utf8');

  const digAt = src.indexOf('function updateDigitalVisibility(');
  assert.ok(digAt > -1, 'updateDigitalVisibility must be defined');
  const digFn = src.slice(digAt, src.indexOf('function syncMethodChips(', digAt));
  assert.ok(digFn.includes("if (transactionIdInput) transactionIdInput.value = '';")
    || digFn.includes('transactionIdInput.value = '), 'the TID clears inside updateDigitalVisibility');
  assert.ok(digFn.includes("senderNameInput.value = '';")
    || digFn.includes('senderNameInput.value = '), 'the sender name clears inside updateDigitalVisibility');
  assert.ok(digFn.includes("senderDigitsInput.value = '';")
    || digFn.includes('senderDigitsInput.value = '), 'the sender digits clear inside updateDigitalVisibility');
  assert.ok(digFn.includes("overrideReasonInput.value = '';")
    || digFn.includes('overrideReasonInput.value = '), 'the override reason clears inside updateDigitalVisibility');

  const splitAt = src.indexOf('function updateSplitVisibility()');
  assert.ok(splitAt > -1, 'updateSplitVisibility must be defined');
  const splitFn = src.slice(splitAt, src.indexOf("splitToggle?.addEventListener('change'", splitAt));
  assert.ok(splitFn.includes('splitTransactionIdInput.value = '), 'the leg-2 TID clears inside updateSplitVisibility');
  assert.ok(splitFn.includes('splitSenderNameInput.value = '), 'the leg-2 sender name clears inside updateSplitVisibility');
  assert.ok(splitFn.includes('splitSenderDigitsInput.value = '), 'the leg-2 sender digits clear inside updateSplitVisibility');
  assert.ok(splitFn.includes('splitOverrideReasonInput.value = '), 'the leg-2 override reason clears inside updateSplitVisibility');

  // No new listeners: the clears ride the existing visibility calls.
  // Plan 527 pins five split-toggle change listeners; the method
  // select keeps its single change listener.
  assert.equal((src.match(/splitToggle\?\.addEventListener\('change'/g) || []).length, 5,
    'split-toggle change listeners unchanged (Plan 527 pin: 5)');
  assert.equal((src.match(/methodSelect\?\.addEventListener\('change'/g) || []).length, 1,
    'method-select change listeners unchanged (1)');
});

test('S1: a digital save with a TID records it exactly as before', async () => {
  await withController(plan625State(new Date()), async ({ controller, getEl, toasts, getState }) => {
    controller.open('seed-001');
    getEl('quickCollectAmountInput').value = '3000';
    await switchMethod(getEl, 'Easypaisa');
    typeLeg1Digital(getEl);
    await submitAndConfirm(getEl, getState);

    const recorded = paymentsOf(getState(), MONTH);
    assert.equal(recorded.length, 1, 'the payment recorded');
    assert.equal(recorded[0].method, 'Easypaisa', 'the recorded method is Easypaisa');
    assert.equal(recorded[0].transactionId, TID, 'the TID records exactly as typed');
    assert.equal(recorded[0].senderTitle, SENDER, 'the sender records exactly as typed');
    assert.equal(recorded[0].senderDigits, DIGITS, 'the sender digits record exactly as typed');
    assert.equal(recorded[0].referenceOverrideReason, OVERRIDE, 'the override reason records exactly as typed');
    assert.equal(balanceDueCents(getState(), MONTH), 0, 'ledger: the Rs 3,000 dues are settled');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('B1: the hide/show wiring is unchanged', async () => {
  await withController(plan625State(new Date()), async ({ controller, getEl, toasts }) => {
    controller.open('seed-001');
    assert.equal(getEl('quickCollectDigitalFields').hidden, true, 'digital fields start hidden for the remembered default');
    await switchMethod(getEl, 'Easypaisa');
    assert.equal(getEl('quickCollectDigitalFields').hidden, false, 'digital fields show for Easypaisa');
    await switchMethod(getEl, 'JazzCash');
    assert.equal(getEl('quickCollectDigitalFields').hidden, false, 'digital fields stay shown for JazzCash');
    await switchMethod(getEl, 'Cash');
    assert.equal(getEl('quickCollectDigitalFields').hidden, true, 'digital fields hide for Cash');
    assert.equal(getEl('quickCollectMethodSelect').value, 'Cash', 'the method select still holds the picked method');

    const splitToggle = getEl('quickCollectSplitToggle');
    assert.equal(getEl('quickCollectSplitDigitalFields').hidden, true, 'leg-2 digital fields start hidden (split off)');
    splitToggle.checked = true;
    await splitToggle.dispatch('change');
    await switchLeg2Method(getEl, 'Cash');
    assert.equal(getEl('quickCollectSplitDigitalFields').hidden, true, 'leg-2 digital fields hide for a Cash leg 2');
    await switchLeg2Method(getEl, 'Easypaisa');
    assert.equal(getEl('quickCollectSplitDigitalFields').hidden, false, 'leg-2 digital fields show for an Easypaisa leg 2');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});
