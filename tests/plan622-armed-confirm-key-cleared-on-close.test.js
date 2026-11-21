// Plan 622 — Armed confirm key is cleared when the dialog closes.
// C tests assert the FIXED state (they FAIL on the base, PASS with the fix).
// S tests are stability (PASS on base AND with the fix). B tests are behaviour.
// This file is NOT a pinning file: it contains no parity literals.
// Harness: the plan537 mock DOM + controller harness (mock document,
// setupQuickCollectModal). The mock form has no requestSubmit, so a
// Confirm click arms the key without running the submit handler —
// exactly the state a production resubmit leaves when it returns
// early BEFORE the Plan 382 clear (there are 15 early returns between
// the submit handler and the check — duplicate-TID, leg-2 and
// validation guards — any of which leaves the key armed while the
// dialog is still open). The operator then dismisses the dialog; the
// next submit for the SAME figures must demand a fresh confirm, not
// ride the stale arm.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {
  createInitialState, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth
} = await import(pathToFileURL(join(root, 'core.js')).href);
const { getPakistanLocalDate, setupQuickCollectModal } = await import(pathToFileURL(join(root, 'nav-quick-collect.js')).href);

const MONTH = getPakistanLocalDate(new Date()).slice(0, 7);

function plan622State() {
  const now = new Date();
  let state = createInitialState(['Plan622 Tester A', 'Plan622 Tester B']);
  for (const id of ['seed-001', 'seed-002']) {
    state = updateCustomerProfile(state, id, {
      packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
    }, now);
  }
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  return state;
}

const paymentsOf = (state, customerId) =>
  state.customers.find((c) => c.id === customerId)?.bills.find((b) => b.month === MONTH)?.payments ?? [];

/** plan537 mock DOM + controller harness. */
function plan622Controller(initialState) {
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

  const origDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => getEl(id),
    querySelectorAll: () => [],
    createElement: (tag) => createMockElement('', tag),
    addEventListener: () => {},
    body: { appendChild() {}, removeChild() {} },
    activeElement: null
  };
  let state = initialState;
  const toasts = [];
  const controller = setupQuickCollectModal({
    getState: () => state,
    onSaveState: (next) => { state = next; },
    onToast: (msg, opts) => toasts.push({ msg, opts }),
    onSelectCustomer: () => {},
    onEditCustomer: () => {}
  });
  return {
    getEl, toasts, controller,
    get state() { return state; },
    async restore() {
      await new Promise((resolve) => setTimeout(resolve, 130));
      globalThis.document = origDocument;
    }
  };
}

/** First submit shows the summary; nothing posts yet. */
async function submitShowsConfirm(h, customerId) {
  const before = paymentsOf(h.state, customerId).length;
  await h.getEl('quickCollectPaymentForm').dispatch('submit');
  assert.equal(paymentsOf(h.state, customerId).length, before,
    'precondition: the first submit shows the summary — nothing posts yet');
  assert.equal(h.getEl('quickCollectStepConfirm').hidden, false,
    'precondition: the confirm step is showing');
}

/** Confirm click arms the key; the mock form has no requestSubmit, so nothing posts. */
async function armOnly(h) {
  await h.getEl('quickCollectConfirmSaveBtn').click();
}

test('C1: dismissing with the x after arming leaves no armed key — the next submit for the same figures shows confirm again', async () => {
  const h = plan622Controller(plan622State());
  try {
    h.controller.open('seed-001');
    await submitShowsConfirm(h, 'seed-001');
    await armOnly(h);
    await h.getEl('closeQuickCollectModalBtn').click();
    h.controller.open('seed-001');
    await h.getEl('quickCollectPaymentForm').dispatch('submit');
    assert.equal(paymentsOf(h.state, 'seed-001').length, 0,
      'the reopened submit posted without a fresh confirm — the stale armed key was still live');
    assert.equal(h.getEl('quickCollectStepConfirm').hidden, false,
      'the confirm step never showed on the reopened submit');
  } finally { await h.restore(); }
});

test('C2: dismissing via the native close event after arming leaves no armed key either', async () => {
  const h = plan622Controller(plan622State());
  try {
    h.controller.open('seed-001');
    await submitShowsConfirm(h, 'seed-001');
    await armOnly(h);
    await h.getEl('quickCollectModal').dispatch('close');
    h.controller.open('seed-001');
    await h.getEl('quickCollectPaymentForm').dispatch('submit');
    assert.equal(paymentsOf(h.state, 'seed-001').length, 0,
      'the reopened submit posted without a fresh confirm — the close event left the key armed');
    assert.equal(h.getEl('quickCollectStepConfirm').hidden, false,
      'the confirm step never showed on the reopened submit');
  } finally { await h.restore(); }
});

test('C3: handleDialogClosed clears the armed confirm key', () => {
  const src = readFileSync(join(root, 'nav-quick-collect.js'), 'utf8');
  const start = src.indexOf('function handleDialogClosed()');
  assert.ok(start >= 0, 'handleDialogClosed exists');
  const end = src.indexOf('function closeModal()', start);
  const body = src.slice(start, end);
  assert.ok(body.includes('saveConfirmationArmedKey = null'),
    'handleDialogClosed never clears saveConfirmationArmedKey');
});

test('S1: the normal flow is unchanged — confirm arms, resubmit posts exactly once', async () => {
  const h = plan622Controller(plan622State());
  try {
    h.controller.open('seed-001');
    await submitShowsConfirm(h, 'seed-001');
    await armOnly(h);
    await h.getEl('quickCollectPaymentForm').dispatch('submit');
    assert.equal(paymentsOf(h.state, 'seed-001').length, 1, 'the confirmed payment did not post');
  } finally { await h.restore(); }
});

test('S2: a different customer after arm+close still shows the confirm step', async () => {
  const h = plan622Controller(plan622State());
  try {
    h.controller.open('seed-001');
    await submitShowsConfirm(h, 'seed-001');
    await armOnly(h);
    await h.getEl('closeQuickCollectModalBtn').click();
    h.controller.open('seed-002');
    await h.getEl('quickCollectPaymentForm').dispatch('submit');
    assert.equal(paymentsOf(h.state, 'seed-002').length, 0,
      'the second customer posted without a confirm');
    assert.equal(h.getEl('quickCollectStepConfirm').hidden, false,
      'the confirm step never showed for the second customer');
  } finally { await h.restore(); }
});

test('S3: the confirm-step Back button still disarms — resubmit after Back shows confirm again', async () => {
  const h = plan622Controller(plan622State());
  try {
    h.controller.open('seed-001');
    await submitShowsConfirm(h, 'seed-001');
    await armOnly(h);
    await h.getEl('quickCollectConfirmBackBtn').click();
    await h.getEl('quickCollectPaymentForm').dispatch('submit');
    assert.equal(paymentsOf(h.state, 'seed-001').length, 0,
      'the resubmit after Back posted without a fresh confirm');
    assert.equal(h.getEl('quickCollectStepConfirm').hidden, false,
      'the confirm step never showed on the resubmit after Back');
  } finally { await h.restore(); }
});

test('B1: the confirm-step markup is unchanged', () => {
  const page = readFileSync(join(root, 'index.html'), 'utf8');
  assert.ok(page.includes('<div id="quickCollectStepConfirm" class="qc-step" hidden>'), 'confirm step element changed');
  assert.ok(page.includes('id="quickCollectConfirmSaveBtn"'), 'confirm button missing');
  assert.ok(page.includes('id="quickCollectConfirmBackBtn"'), 'back button missing');
  assert.ok(page.includes('id="quickCollectConfirmSummary"'), 'summary host missing');
});
