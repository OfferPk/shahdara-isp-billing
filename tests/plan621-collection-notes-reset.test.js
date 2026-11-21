/**
 * plan621-collection-notes-reset.test.js — Plan 621 of the Plans 591–690
 * programme: the collection-note fields reset between customers.
 *
 * The operator's case: the Quick Collect form is one reused set of
 * inputs. The operator opens it for customer A, types Collected-by
 * "Saad" and an Urdu note, saves — and opens it for customer B, where
 * the two note fields still hold A's values, because nothing in the
 * open ever cleared them. The submit reads them unconditionally, so
 * B's payment (and B's receipt) carried A's note. The fix clears both
 * fields to empty on every fresh open, and adds collectedBy to the
 * concession capture/restore so a concession reopen does not wipe a
 * collector typed before Apply/Remove.
 *
 * Only TWO note fields exist on this form — Collected-by and the Urdu
 * note. "Collected at" was never an operator field (the record
 * auto-stamps it at save) and "Collected in mohalla" was removed by
 * the QC polish D13, so there is nothing else to reset.
 *
 * Pins:
 *  - C1: Collected-by is empty when the form opens for the second
 *    customer.
 *  - C2: the Urdu note is empty when the form opens for the second
 *    customer.
 *  - C3: the payment saved for the second customer carries no note
 *    from the first.
 *  - C4 (behavioural): a concession Apply — and the Remove after it —
 *    keeps the collector (and the note) the operator typed before
 *    applying, driven through the real handlers with a seeded
 *    complaint, plan538 harness shape.
 *  - S1: notes typed for the second customer record on the second
 *    payment (the save path is unchanged).
 *  - S2: a package-change reopen for the SAME customer keeps the
 *    typed notes (mid-payment re-render, not a fresh open — the fix
 *    skips the reset when amountOverride is present; Plan 623
 *    formalizes the capture).
 *  - S3: an untouched form opens with empty note fields (the reset
 *    invents nothing).
 *  - S4: the amount + method + date defaults are unchanged by the
 *    fix.
 *  - S5: the concession restore still returns the Urdu note.
 *  - B1: the note inputs' markup is unchanged (ids, labels,
 *    placeholders, maxlengths; no place/mohalla field reappears).
 *
 * Harness: the plan537 mock DOM + controller harness, extended with
 * the polish #13 package box (for S2) and the plan538 concession box
 * (a mock localStorage seeded with one 72h outage complaint, and a
 * concession box whose innerHTML rebuilds real Apply/Remove button
 * mocks, for C4). Synthetic data only — no real customer names, no
 * realistic phone numbers.
 *
 * NOT a pinning file: it contains no parity literal in any form.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth, calculatePaymentAllocations
} from '../core.js';
import {
  getPakistanLocalDate, setupQuickCollectModal
} from '../nav-quick-collect.js';
import { COMPLAINTS_KEY } from '../complaint-register.js';

const MONTH = getPakistanLocalDate(new Date()).slice(0, 7);
const COLLECTOR = 'Saad';
const NOTE = 'اگلے مہینے ادا کریں گے';

function plan621State() {
  const now = new Date();
  let state = createInitialState(['Plan621 Tester A', 'Plan621 Tester B']);
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

const billOf = (state, id = 'seed-001') =>
  state.customers.find((c) => c.id === id).bills.find((b) => b.month === MONTH);

/**
 * Plan 621 controller harness: the plan537 mock DOM + controller
 * harness, plus the polish #13 package box (pkgSelect/pkgApply) so S2
 * can drive a package change, and the plan538 concession box (mock
 * localStorage seeded with one 72h outage complaint in the bill's
 * month, so the concession box renders an eligible suggestion, and a
 * concession box whose innerHTML write rebuilds the Apply/Remove
 * button mocks, like the real DOM) so C4 can drive a concession
 * Apply/Remove. The mock elements persist across opens — exactly like
 * the real page, where the form is one set of inputs reused for every
 * customer. That persistence is what makes C1–C3 fail without the
 * fix: nothing in the open ever clears the two note inputs.
 */
function plan621Controller(initialState) {
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
      configurable: true,
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
  // Polish #13 package box: the select + apply button the change
  // handler reads through the box's own querySelector.
  const pkgSelect = createMockElement('quickCollectPackageSelect', 'select');
  const pkgApply = createMockElement('', 'button');
  pkgApply.disabled = true;
  const packageBox = getEl('quickCollectPackageBox');
  packageBox.querySelector = (sel) =>
    sel === '#quickCollectPackageSelect' ? pkgSelect : sel === '[data-qc-change-package]' ? pkgApply : null;

  // Plan 538 concession box: innerHTML writes rebuild the button
  // mocks, exactly like the real DOM destroying the old nodes on
  // re-render.
  const concessionBox = getEl('quickCollectConcessionBox');
  let boxHtml = '';
  let applyBtn = createMockElement('', 'button');
  let removeBtn = createMockElement('', 'button');
  Object.defineProperty(concessionBox, 'innerHTML', {
    get: () => boxHtml,
    set: (v) => {
      boxHtml = String(v ?? '');
      applyBtn = createMockElement('', 'button');
      removeBtn = createMockElement('', 'button');
    }
  });
  concessionBox.querySelector = (sel) => {
    if (sel === '[data-qc-apply-concession]') return boxHtml.includes('data-qc-apply-concession') ? applyBtn : null;
    if (sel === '[data-qc-remove-concession]') return boxHtml.includes('data-qc-remove-concession') ? removeBtn : null;
    return null;
  };
  concessionBox.querySelectorAll = () => [];

  // Plan 538: one 72h outage complaint in the bill's month, so the
  // concession box renders an eligible suggestion (72h >= 12h
  // threshold; suggested = round((1,000 / 720) * 72) = 100).
  const complaint = {
    id: 'CMP-621', customerId: 'seed-001', customerName: 'Plan621 Tester A',
    zone: 'Shahdara Town', issueCategory: 'Fiber Cut',
    reportedAt: `${MONTH}-05T10:00`, resolvedAt: `${MONTH}-05T14:00`,
    downtimeHours: 72, downtimeManual: false, status: 'Resolved',
    resolutionNote: '', createdAt: ''
  };
  const origLocalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => (key === COMPLAINTS_KEY ? JSON.stringify([complaint]) : null),
    setItem: () => {},
    removeItem: () => {}
  };

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
    getEl, pkgSelect, pkgApply, toasts, controller,
    applyBtn: () => concessionBox.querySelector('[data-qc-apply-concession]'),
    removeBtn: () => concessionBox.querySelector('[data-qc-remove-concession]'),
    get state() { return state; },
    async restore() {
      await new Promise((resolve) => setTimeout(resolve, 130));
      globalThis.document = origDocument;
      globalThis.localStorage = origLocalStorage;
    }
  };
}

/** Plan 382: submit shows the summary first; confirm, then submit again to post. */
async function submitAndConfirm(h) {
  const before = paymentsOf(h.state, 'seed-001').length + paymentsOf(h.state, 'seed-002').length;
  await h.getEl('quickCollectPaymentForm').dispatch('submit');
  assert.equal(paymentsOf(h.state, 'seed-001').length + paymentsOf(h.state, 'seed-002').length, before,
    'precondition: the first submit shows the summary — nothing posts yet');
  await h.getEl('quickCollectConfirmSaveBtn').click();
  await h.getEl('quickCollectPaymentForm').dispatch('submit');
}

test('C1: Collected-by is empty when the form opens for the second customer', async () => {
  const h = plan621Controller(plan621State());
  try {
    h.controller.open('seed-001');
    h.getEl('quickCollectCollectedByInput').value = COLLECTOR;
    h.controller.open('seed-002');
    assert.equal(h.getEl('quickCollectCollectedByInput').value, '',
      `Collected-by still holds customer A's collector: ${h.getEl('quickCollectCollectedByInput').value}`);
  } finally { await h.restore(); }
});

test('C2: the Urdu note is empty when the form opens for the second customer', async () => {
  const h = plan621Controller(plan621State());
  try {
    h.controller.open('seed-001');
    h.getEl('quickCollectUrduNoteInput').value = NOTE;
    h.controller.open('seed-002');
    assert.equal(h.getEl('quickCollectUrduNoteInput').value, '',
      `Urdu note still holds customer A's note: ${h.getEl('quickCollectUrduNoteInput').value}`);
  } finally { await h.restore(); }
});

test('C3: the payment saved for the second customer carries no note from the first', async () => {
  const h = plan621Controller(plan621State());
  try {
    h.controller.open('seed-001');
    h.getEl('quickCollectCollectedByInput').value = COLLECTOR;
    h.getEl('quickCollectUrduNoteInput').value = NOTE;
    await submitAndConfirm(h);
    const paidA = paymentsOf(h.state, 'seed-001');
    assert.equal(paidA.length, 1, 'precondition: A paid once');
    assert.equal(paidA[0].collectedBy, COLLECTOR, 'precondition: A recorded the collector');
    assert.equal(paidA[0].urduNote, NOTE, 'precondition: A recorded the note');

    h.controller.open('seed-002');
    await submitAndConfirm(h);
    const paidB = paymentsOf(h.state, 'seed-002');
    assert.equal(paidB.length, 1, 'precondition: B paid once');
    assert.equal(paidB[0].collectedBy, undefined,
      `B's payment carries A's collector: ${paidB[0].collectedBy}`);
    assert.equal(paidB[0].urduNote, undefined,
      `B's payment carries A's note: ${paidB[0].urduNote}`);
  } finally { await h.restore(); }
});

test('C4: a concession Apply (and the Remove after it) keeps the collector the operator typed', async () => {
  const h = plan621Controller(plan621State());
  try {
    h.controller.open('seed-001');
    assert.ok(h.applyBtn(), 'precondition: Apply button rendered for the eligible suggestion');
    h.getEl('quickCollectCollectedByInput').value = COLLECTOR;
    h.getEl('quickCollectUrduNoteInput').value = NOTE;
    await h.applyBtn().click();

    // The concession itself: exactly the suggestion, bill untouched.
    assert.equal(Number(billOf(h.state).concessionAmount), 100, 'concession stamped at the suggested 100');
    assert.equal(Number(billOf(h.state).dueAmount), 1000, 'bill amount never rewritten');
    assert.equal(h.getEl('quickCollectAmountInput').value, '900', 'amount at the net due (1,000 − 100)');
    // The reopen inside Apply resets the form — the collector typed
    // before Apply survives only because the concession capture
    // carries it (and the restore returns it), exactly like the note.
    assert.equal(h.getEl('quickCollectCollectedByInput').value, COLLECTOR,
      'Apply wiped the collector typed before it');
    assert.equal(h.getEl('quickCollectUrduNoteInput').value, NOTE,
      'Apply wiped the note typed before it');
    assert.ok(h.removeBtn(), 'box now offers Remove for the applied concession');

    // The operator re-types nothing between Apply and Remove — the
    // entries Apply restored are the ones Remove must keep.
    await h.removeBtn().click();
    assert.equal(Number(billOf(h.state).concessionAmount || 0), 0, 'concession cleared');
    assert.equal(h.getEl('quickCollectAmountInput').value, '1000', 'amount back to the full dues');
    assert.equal(h.getEl('quickCollectCollectedByInput').value, COLLECTOR,
      'Remove wiped the collector');
    assert.equal(h.getEl('quickCollectUrduNoteInput').value, NOTE,
      'Remove wiped the note');
    assert.ok(h.applyBtn(), 'box offers Apply again once the concession is gone');
  } finally { await h.restore(); }
});

test('S1: notes typed for the second customer record on the second payment', async () => {
  const h = plan621Controller(plan621State());
  try {
    h.controller.open('seed-001');
    h.getEl('quickCollectCollectedByInput').value = COLLECTOR;
    h.getEl('quickCollectUrduNoteInput').value = NOTE;
    await submitAndConfirm(h);
    h.controller.open('seed-002');
    h.getEl('quickCollectCollectedByInput').value = 'Umair';
    h.getEl('quickCollectUrduNoteInput').value = 'شکریہ';
    await submitAndConfirm(h);
    const paidB = paymentsOf(h.state, 'seed-002');
    assert.equal(paidB.length, 1, 'B paid once');
    assert.equal(paidB[0].collectedBy, 'Umair', 'B recorded its own collector');
    assert.equal(paidB[0].urduNote, 'شکریہ', 'B recorded its own note');
  } finally { await h.restore(); }
});

test('S2: a package-change reopen for the same customer keeps the typed notes', async () => {
  const h = plan621Controller(plan621State());
  try {
    h.controller.open('seed-001');
    h.getEl('quickCollectCollectedByInput').value = COLLECTOR;
    h.getEl('quickCollectUrduNoteInput').value = NOTE;
    h.pkgSelect.value = '5mbps-500gb';
    await h.pkgSelect.dispatch('change');
    await h.pkgApply.click();
    assert.equal(Number(h.state.customers.find((c) => c.id === 'seed-001').bills.find((b) => b.month === MONTH).dueAmount), 2500,
      'precondition: bill repriced to the new package');
    assert.equal(h.getEl('quickCollectCollectedByInput').value, COLLECTOR,
      'package change wiped the collector mid-payment');
    assert.equal(h.getEl('quickCollectUrduNoteInput').value, NOTE,
      'package change wiped the note mid-payment');
  } finally { await h.restore(); }
});

test('S3: an untouched form opens with empty note fields (the reset invents nothing)', async () => {
  const h = plan621Controller(plan621State());
  try {
    h.controller.open('seed-001');
    assert.equal(h.getEl('quickCollectCollectedByInput').value, '', 'no collector invented');
    assert.equal(h.getEl('quickCollectUrduNoteInput').value, '', 'no note invented');
    h.controller.open('seed-002');
    assert.equal(h.getEl('quickCollectCollectedByInput').value, '', 'still no collector invented');
    assert.equal(h.getEl('quickCollectUrduNoteInput').value, '', 'still no note invented');
  } finally { await h.restore(); }
});

test('S4: the amount + method defaults are unchanged by the fix', async () => {
  const h = plan621Controller(plan621State());
  try {
    h.controller.open('seed-001');
    assert.equal(h.getEl('quickCollectAmountInput').value, '1000', 'amount still prefills at the full dues');
    assert.equal(h.getEl('quickCollectMethodSelect').value, '', 'no method invented (no past payment remembers one)');
    assert.equal(h.getEl('quickCollectDateInput').value, getPakistanLocalDate(new Date()), 'date still defaults to today');
  } finally { await h.restore(); }
});

test('S5: the concession restore still returns the Urdu note', () => {
  const src = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  const start = src.indexOf('function restoreConcessionFormEntries(entries)');
  assert.ok(start >= 0, 'restoreConcessionFormEntries exists');
  const body = src.slice(start, src.indexOf('function renderConcessionBox', start));
  assert.ok(body.includes('urduNoteInput.value = entries.urduNote'),
    'concession restore no longer returns the Urdu note');
});

test('B1: the note inputs markup is unchanged (ids, labels, placeholders, maxlengths)', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('id="quickCollectCollectedByInput"'), 'Collected-by input missing');
  assert.ok(page.includes('id="quickCollectUrduNoteInput"'), 'Urdu note input missing');
  assert.ok(page.includes('Collected by (optional)'), 'Collected-by label changed');
  assert.ok(page.includes('Note in Urdu'), 'Urdu note label changed');
  assert.ok(page.includes('maxlength="100"'), 'Collected-by maxlength changed');
  assert.ok(page.includes('maxlength="200"'), 'Urdu note maxlength changed');
  assert.ok(!page.includes('quickCollectCollectionPlaceSelect'), 'place field reappeared — D13 removed it');
  assert.ok(!page.includes('quickCollectCollectionMohallaInput'), 'mohalla field reappeared — D13 removed it');
});
