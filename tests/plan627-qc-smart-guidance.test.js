// Plan 627 — Quick Collect shows the same smart guidance as the
// profile payment form.
//
// Polish #16 Req 3 built smart field guidance — live hints under a
// field when its value looks wrong for that field, never a block —
// for the profile payment form only. Quick Collect, where most
// payments are actually typed, had none of it: a digits-only name in
// Paid By / Collected By, a digits-only sender name, or letters in
// the sender last-4-digits saved silently. The fix mirrors the
// profile form's detections onto Quick Collect by reusing Polish
// #16's pure helper and wiring helper unchanged: the four QC inputs
// carry the helper's field names in the markup and setup calls
// wirePaymentFieldGuidance(paymentForm) once.
//
// Scope (parent decision D1): only the three hint messages that HAVE
// a QC field can fire here — name digits (Paid By + Collected By),
// sender-name digits, sender-digits letters. The mohalla-phone and
// reason-digits detections have no QC field: the collection-mohalla
// input was removed by Plan 379 D13 (its absence is pinned), and
// there is no discount-reason input in QC. The acceptance reads as
// "each detection that HAS a QC field fires".
//
// Scope (parent decision D2): the spec's three example detections
// (amount mismatch, missing reference, wrong month) are NOT Polish
// #16 detections — this file tests Candidate 16's real five as the
// helper defines them, mirrored onto the four QC fields.
//
// This file is NOT a pinning file: 0 parity literals.
//
// Harness: the Plan 626 mock DOM + controller harness (mock elements
// behind getElementById, submit + Plan 382 confirm), extended with (a)
// `dataset` + `closest()` + `after()` on mock elements so
// wirePaymentFieldGuidance can insert its `.field-help` hint after an
// input, and (b) a form querySelector that resolves `[name="..."]` to
// the four QC inputs — the mock simulates the FIXED markup's name
// attributes, so the C tests isolate the wiring call; the C6 source
// test pins the markup itself. Snapshot-iteration dispatch + checkbox
// reset on innerHTML set are kept from the Plan 626 harness (its OOM
// lesson — do NOT "improve" the mock back to live iteration).
// Synthetic data only — no real customer names, no realistic phone
// numbers (pattern-fake digits only).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const {
  createInitialState, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth, calculatePaymentAllocations
} = await import(pathToFileURL(join(root, 'core.js')).href);
const { getPakistanLocalDate, setupQuickCollectModal } = await import(pathToFileURL(join(root, 'nav-quick-collect.js')).href);

const MONTH = getPakistanLocalDate(new Date()).slice(0, 7);

function plan627State(now) {
  let state = createInitialState(['Plan627 Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 3000
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  return state;
}

const paymentsOf = (state, month) =>
  state.customers[0].bills.find((b) => b.month === month)?.payments ?? [];

/** Plan 626 mock DOM, extended for guidance wiring: mock elements gain
 *  `dataset`, `closest()` (null — the QC inputs sit in .qc-field-group,
 *  not .form-cell, so the hint anchors on the input itself) and
 *  `after()` (records the inserted hint beside the input); the QC
 *  payment form's querySelector resolves `[name="..."]` to the four
 *  guided inputs, simulating the fixed markup's name attributes. */
function mockDom() {
  const registry = new Map();
  const createMockElement = (id, tag = 'div') => {
    const listeners = {};
    const attrs = {};
    const el = {
      id, tagName: tag.toUpperCase(), textContent: '', value: '',
      style: {}, hidden: false, disabled: false, checked: false, options: [], children: [],
      dataset: {},
      _afterSiblings: [],
      classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
      getAttribute: (n) => attrs[n] ?? null,
      setAttribute: (n, v) => { attrs[n] = v; },
      removeAttribute: (n) => { delete attrs[n]; },
      addEventListener: (type, h) => { (listeners[type] = listeners[type] || []).push(h); },
      dispatch: async (type, evt = {}) => { for (const h of [...(listeners[type] || [])]) await h({ type, target: el, preventDefault: () => {}, ...evt }); },
      click: async () => el.dispatch('click'),
      closest: () => null,
      after: (node) => { el._afterSiblings.push(node); return el; },
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
  // The fixed markup names the four guided QC inputs; the wire helper
  // binds by [name="..."] inside the passed form.
  const nameMap = {
    paidBy: 'quickCollectPaidByInput',
    collectedBy: 'quickCollectCollectedByInput',
    senderTitle: 'quickCollectSenderNameInput',
    senderDigits: 'quickCollectSenderDigitsInput'
  };
  form.querySelector = (sel) => {
    const m = /\[name="([^"]+)"\]/.exec(String(sel || ''));
    if (m && nameMap[m[1]]) return getEl(nameMap[m[1]], 'input');
    return null;
  };
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

async function typeText(getEl, id, value) {
  getEl(id).value = value;
  await getEl(id).dispatch('input');
}

// The hint wirePaymentFieldGuidance inserts after the input, tagged
// with data-payment-guidance="<field>".
const hintFor = (getEl, inputId, field) =>
  getEl(inputId)._afterSiblings.find((s) => s.dataset?.paymentGuidance === field) ?? null;

const hintText = (getEl, inputId, field) => {
  const hint = hintFor(getEl, inputId, field);
  return hint && !hint.hidden ? hint.textContent : '';
};

test('C1: a digits-only Paid By shows the name hint under the QC field', async () => {
  await withController(plan627State(new Date()), async ({ controller, getEl, toasts }) => {
    controller.open('seed-001');
    await typeText(getEl, 'quickCollectPaidByInput', '123456');
    assert.equal(hintText(getEl, 'quickCollectPaidByInput', 'paidBy'),
      'Yahan naam likhein — number nahi.',
      'digits-only Paid By gets the profile form\u2019s name hint');
    await typeText(getEl, 'quickCollectPaidByInput', 'Ali Raza');
    assert.equal(hintText(getEl, 'quickCollectPaidByInput', 'paidBy'), '',
      'a clean name clears the hint');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('C2: a digits-only Collected By shows the name hint under the QC field', async () => {
  await withController(plan627State(new Date()), async ({ controller, getEl, toasts }) => {
    controller.open('seed-001');
    await typeText(getEl, 'quickCollectCollectedByInput', '987654321');
    assert.equal(hintText(getEl, 'quickCollectCollectedByInput', 'collectedBy'),
      'Yahan naam likhein — number nahi.',
      'digits-only Collected By gets the profile form\u2019s name hint');
    await typeText(getEl, 'quickCollectCollectedByInput', 'Saad');
    assert.equal(hintText(getEl, 'quickCollectCollectedByInput', 'collectedBy'), '',
      'a clean name clears the hint');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('C3: a digits-only sender name shows its own hint under the QC field', async () => {
  await withController(plan627State(new Date()), async ({ controller, getEl, toasts }) => {
    controller.open('seed-001');
    await typeText(getEl, 'quickCollectSenderNameInput', '112233');
    assert.equal(hintText(getEl, 'quickCollectSenderNameInput', 'senderTitle'),
      'Yahan sender ka naam likhein.',
      'digits-only sender name gets the profile form\u2019s sender hint');
    await typeText(getEl, 'quickCollectSenderNameInput', 'Hamza');
    assert.equal(hintText(getEl, 'quickCollectSenderNameInput', 'senderTitle'), '',
      'a clean sender name clears the hint');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('C4: letters in the sender last-4-digits show the digits hint under the QC field', async () => {
  await withController(plan627State(new Date()), async ({ controller, getEl, toasts }) => {
    controller.open('seed-001');
    await typeText(getEl, 'quickCollectSenderDigitsInput', '33A0');
    assert.equal(hintText(getEl, 'quickCollectSenderDigitsInput', 'senderDigits'),
      'Sirf aakhri 4 digits likhein (sirf number).',
      'letters in the last-4-digits get the profile form\u2019s digits hint');
    await typeText(getEl, 'quickCollectSenderDigitsInput', '3310');
    assert.equal(hintText(getEl, 'quickCollectSenderDigitsInput', 'senderDigits'), '',
      'clean digits clear the hint');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('C5: a showing hint never blocks a save', async () => {
  await withController(plan627State(new Date()), async ({ controller, getEl, toasts, getState }) => {
    controller.open('seed-001');
    await typeText(getEl, 'quickCollectPaidByInput', '123456');
    assert.equal(hintText(getEl, 'quickCollectPaidByInput', 'paidBy'),
      'Yahan naam likhein — number nahi.',
      'precondition: the hint is showing');
    await submitAndConfirm(getEl, getState);
    const recorded = paymentsOf(getState(), MONTH);
    assert.equal(recorded.length, 1, 'the payment still records with the hint showing');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('C6 (source): the QC form wires the guidance onto its four fields', () => {
  const qc = readFileSync(join(root, 'nav-quick-collect.js'), 'utf8');
  const page = readFileSync(join(root, 'index.html'), 'utf8');
  const formValidation = readFileSync(join(root, 'form-validation.js'), 'utf8');

  // The helper and its field list stay exactly as Polish #16 shipped
  // them — the mirror reuses them, it does not extend them.
  assert.match(formValidation, /const PAYMENT_GUIDANCE_FIELDS = \['collectionMohalla', 'paidBy', 'collectedBy', 'senderTitle', 'senderDigits', 'discountReason'\];/);
  assert.match(formValidation, /hint\.className = 'field-help';/);

  // Shape A (preferred): the four QC inputs carry the helper's field
  // names and the QC form is wired with the shared helper.
  const shapeA = page.includes('id="quickCollectPaidByInput"')
    && /id="quickCollectPaidByInput"[^>]*name="paidBy"/.test(page)
    && /id="quickCollectCollectedByInput"[^>]*name="collectedBy"/.test(page)
    && /id="quickCollectSenderNameInput"[^>]*name="senderTitle"/.test(page)
    && /id="quickCollectSenderDigitsInput"[^>]*name="senderDigits"/.test(page)
    && qc.includes('wirePaymentFieldGuidance(');
  // Shape B: per-input calls to the pure helper, no name attributes.
  const shapeB = qc.includes('paymentFieldGuidance(')
    && qc.includes('quickCollectPaidByInput')
    && qc.includes('quickCollectSenderDigitsInput');
  assert.ok(shapeA || shapeB,
    'the QC form wires the guidance — either the shared helper on the named inputs (shape A) or per-input helper calls (shape B)');
});

test('S1: clean values show no hint on any QC field', async () => {
  await withController(plan627State(new Date()), async ({ controller, getEl, toasts }) => {
    controller.open('seed-001');
    await typeText(getEl, 'quickCollectPaidByInput', 'Self');
    await typeText(getEl, 'quickCollectCollectedByInput', 'Saad');
    await typeText(getEl, 'quickCollectSenderNameInput', 'Hamza');
    await typeText(getEl, 'quickCollectSenderDigitsInput', '3310');
    assert.equal(hintText(getEl, 'quickCollectPaidByInput', 'paidBy'), '', 'clean Paid By: no hint');
    assert.equal(hintText(getEl, 'quickCollectCollectedByInput', 'collectedBy'), '', 'clean Collected By: no hint');
    assert.equal(hintText(getEl, 'quickCollectSenderNameInput', 'senderTitle'), '', 'clean sender name: no hint');
    assert.equal(hintText(getEl, 'quickCollectSenderDigitsInput', 'senderDigits'), '', 'clean digits: no hint');
    await typeText(getEl, 'quickCollectPaidByInput', '');
    assert.equal(hintText(getEl, 'quickCollectPaidByInput', 'paidBy'), '', 'empty is fine: no hint');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});

test('B1: the QC form wiring is unchanged — a plain payment still records', async () => {
  await withController(plan627State(new Date()), async ({ controller, getEl, toasts, getState }) => {
    controller.open('seed-001');
    await submitAndConfirm(getEl, getState);
    const recorded = paymentsOf(getState(), MONTH);
    assert.equal(recorded.length, 1, 'the payment records with the note fields untouched');
    assert.equal(recorded[0].method, 'Cash', 'the recorded method is Cash');
    assert.equal(errorToast(toasts), undefined, `no error toast — got: ${errorToast(toasts)?.msg}`);
  });
});
