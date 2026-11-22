// Collect button (user, 2026-11-21): tapping Collect on a due customer's
// card did nothing — the button was wired and called the right function,
// but openCustomerCollectionForm filled the form behind a CLOSED dialog
// and never showed it. The guarded show at the tail of that function
// opens the sheet for every selectAndOpen entry point.
// C tests assert the FIXED state (they FAIL on the base, PASS with the fix).
// S tests are stability (PASS on base AND with the fix). B tests are behaviour.
// This file is NOT a pinning file: it contains no parity literals.
// Harness: the Plan 626 mock DOM + controller harness (mock elements
// behind getElementById, submit + Plan 382 confirm); the mock dialog
// carries showModal/close stubs that flip `open`. Snapshot-iteration
// dispatch + checkbox reset on innerHTML set are kept from the Plan 626
// harness (its OOM lesson — do NOT "improve" the mock back to live
// iteration).
// Synthetic data only — no real customer names, no realistic phone
// numbers (pattern-fake digits only).
import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {
  createInitialState, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth
} = await import(pathToFileURL(join(root, 'core.js')).href);
const { getPakistanLocalDate, setupQuickCollectModal } = await import(pathToFileURL(join(root, 'nav-quick-collect.js')).href);

const MONTH = getPakistanLocalDate(new Date()).slice(0, 7);
const REF = new Date();

// Two due customers on different packages (so a re-pick is observable
// in the prefilled amount) + one archived customer for the error path.
function collectState(now) {
  let state = createInitialState(['Collect Tester One', 'Collect Tester Two', 'Collect Tester Archived']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 3000
  }, now);
  state = updateCustomerProfile(state, 'seed-002', {
    packageSpeed: '5Mbps / 200GB', monthlySellingAmount: 2000
  }, now);
  state = updateCustomerProfile(state, 'seed-003', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 3000
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  state.customers.find((c) => c.id === 'seed-003').archived = true;
  return state;
}

const paymentsOf = (state, month) =>
  state.customers[0].bills.find((b) => b.month === month)?.payments ?? [];

/** Plan 626 mock DOM + controller harness, unchanged in shape. */
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
      dispatch: async (type, evt = {}) => { for (const h of [...(listeners[type] || [])]) await h({ type, target: el, preventDefault: () => {}, ...evt }); },
      click: async () => el.dispatch('click'),
      querySelector: (sel) => {
        if (String(sel || '').includes('data-qc-waive-late-fee')) {
          if (!el._waiverCheckbox) el._waiverCheckbox = createMockElement(`${id}-waiver-checkbox`, 'input');
          return el._waiverCheckbox;
        }
        return null;
      },
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
      set: (v) => { html = String(v ?? ''); el.children.length = 0; el._waiverCheckbox = undefined; }
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

async function submitAndConfirm(getEl, getState) {
  await getEl('quickCollectPaymentForm').dispatch('submit');
  assert.deepEqual(paymentsOf(getState(), MONTH), [],
    'Plan 382: the first submit shows the summary — nothing posts yet');
  await getEl('quickCollectConfirmSaveBtn').click();
  await getEl('quickCollectPaymentForm').dispatch('submit');
}

test('C1: selectAndOpen on a due customer OPENS the Quick Collect dialog', async () => {
  await withController(collectState(REF), async ({ controller, getEl }) => {
    const modal = getEl('quickCollectModal');
    assert.equal(modal.open, false, 'precondition: the dialog starts closed');
    controller.selectAndOpen('seed-001');
    assert.equal(modal.open, true, 'the dialog opens for the picked due customer');
  });
});

test('C2: selectAndOpen shows the form for that customer — prefilled amount + open dialog', async () => {
  await withController(collectState(REF), async ({ controller, getEl }) => {
    controller.selectAndOpen('seed-001');
    assert.equal(getEl('quickCollectAmountInput').value, '3000',
      'the form is prefilled with the picked customer full dues');
    assert.equal(getEl('quickCollectModal').open, true, 'the dialog is open');
    assert.equal(getEl('quickCollectStepForm').hidden, false, 'the form step is shown');
  });
});

test('C3: closing then selectAndOpen again re-opens the dialog', async () => {
  await withController(collectState(REF), async ({ controller, getEl }) => {
    const modal = getEl('quickCollectModal');
    controller.selectAndOpen('seed-001');
    modal.close();
    assert.equal(modal.open, false, 'precondition: the dialog closed');
    controller.selectAndOpen('seed-002');
    assert.equal(modal.open, true, 'the dialog re-opens for the next customer');
    assert.equal(getEl('quickCollectAmountInput').value, '2000',
      'the form is refilled for the second customer');
  });
});

test('S1: selectAndOpen on an archived customer keeps the dialog closed and toasts', async () => {
  await withController(collectState(REF), async ({ controller, getEl, toasts }) => {
    controller.selectAndOpen('seed-003');
    assert.equal(getEl('quickCollectModal').open, false,
      'the dialog must NOT open for an archived customer');
    assert.ok(toasts.some((t) => String(t.msg).includes('Archived')),
      'the archived refusal is toasted, not silent');
  });
});

test('S2: in-modal re-pick (dialog already open) keeps it open and refills', async () => {
  await withController(collectState(REF), async ({ controller, getEl }) => {
    const modal = getEl('quickCollectModal');
    controller.open();
    assert.equal(modal.open, true, 'precondition: open() shows the picker');
    controller.selectAndOpen('seed-002');
    assert.equal(modal.open, true, 'the dialog stays open on a re-pick');
    assert.equal(getEl('quickCollectAmountInput').value, '2000',
      'the form is refilled for the re-picked customer');
  });
});

test('S3: controller.open() still shows the picker (the working path is unchanged)', async () => {
  await withController(collectState(REF), async ({ controller, getEl }) => {
    controller.open();
    assert.equal(getEl('quickCollectModal').open, true, 'open() shows the dialog');
    assert.equal(getEl('quickCollectStepPick').hidden, false, 'open() shows the picker step');
  });
});

test('B1: a plain payment still records through the normal submit + confirm flow', async () => {
  await withController(collectState(REF), async ({ controller, getEl, getState }) => {
    controller.selectAndOpen('seed-001');
    await submitAndConfirm(getEl, getState);
    assert.equal(paymentsOf(getState(), MONTH).length, 1, 'one payment recorded');
    assert.equal(paymentsOf(getState(), MONTH)[0].amount, 3000, 'the recorded amount is the full dues');
  });
});
