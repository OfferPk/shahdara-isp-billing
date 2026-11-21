// Plan 620 — Field Mode advance sheet keeps the typed amount across a
// package change (polish #13's rule, advance-sheet shape).
// C tests assert the FIXED state: a typed advance amount survives the
// package-change re-render and the Undo re-render. S tests are
// stability (they pass on base too). B1 pins the input markup.
//
// Mock-DOM model: a real browser rebuilds the panel on every render()
// (panelEl.innerHTML = ...), so the advance amount input is destroyed
// and recreated EMPTY. The harness models that rebuild with an
// innerHTML setter that resets the mock advance input's value to ''
// on every set — exactly what the browser does. A plain mock whose
// input value persisted across renders would pass on base and prove
// nothing. The harness is a local copy (modelled on
// buildFieldModeHarness in field-mode-change-package.test.js); it is
// not exported from that file.
//
// NOT a pinning file: this file contains no parity total in any form.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const {
  createInitialState, addCustomer, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth, addPayment,
  calculatePaymentAllocations
} = await import(new URL('../core.js', import.meta.url).href);
const { getPakistanLocalDate } = await import(new URL('../nav-quick-collect.js', import.meta.url).href);
const {
  setupFieldMode, collectFieldModeAdvance, fieldModeCustomerStatus
} = await import(new URL('../field-mode.js', import.meta.url).href);
const fm = readFileSync(new URL('../field-mode.js', import.meta.url), 'utf8');

function buildHarness(initialState) {
  const registry = new Map();
  const createMockElement = (id, tag = 'div') => {
    const listeners = {};
    const attrs = {};
    const el = {
      id, tagName: tag.toUpperCase(), textContent: '', value: '',
      style: {}, hidden: false, disabled: false, checked: false, children: [],
      classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
      getAttribute: (n) => attrs[n] ?? null,
      setAttribute: (n, v) => { attrs[n] = v; },
      removeAttribute: (n) => { delete attrs[n]; },
      addEventListener: (type, h) => { (listeners[type] = listeners[type] || []).push(h); },
      dispatch: async (type, evt = {}) => { for (const h of (listeners[type] || [])) await h({ type, preventDefault: () => {}, ...evt }); },
      querySelector: () => null,
      querySelectorAll: () => [],
      focus: () => {}, select: () => {}
    };
    return el;
  };
  const getEl = (id, tag) => {
    if (!registry.has(id)) registry.set(id, createMockElement(id, tag));
    return registry.get(id);
  };
  const pkgSelect = createMockElement('fieldModePackageSelect', 'select');
  const pkgApply = createMockElement('', 'button');
  pkgApply.disabled = true;
  pkgApply.getAttribute = (n) => (n === 'data-field-action' ? 'change-package' : null);
  const advanceInput = createMockElement('fieldModeAdvanceAmount', 'input');
  const advanceBtn = createMockElement('', 'button');
  advanceBtn.getAttribute = (n) => (n === 'data-field-action' ? 'advance' : null);
  const panel = getEl('fieldModeActionPanel');
  // A render() rebuilds the sheet: the browser destroys the amount
  // input and recreates it empty. Model that by resetting the mock
  // input's value on every innerHTML set.
  let panelHtml = '';
  Object.defineProperty(panel, 'innerHTML', {
    get: () => panelHtml,
    set: (v) => { panelHtml = String(v); advanceInput.value = ''; },
    configurable: true
  });
  panel.querySelector = (sel) =>
    sel === '#fieldModePackageSelect' ? pkgSelect
      : sel === '[data-field-action="change-package"]' ? pkgApply
        : sel === '#fieldModeAdvanceAmount' ? advanceInput
          : null;
  getEl('fieldModeView');
  getEl('fieldModeToggleBtn', 'button');

  let state = initialState;
  const toasts = [];
  const origDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => getEl(id),
    querySelectorAll: () => [],
    createElement: (tag) => createMockElement('', tag),
    addEventListener: () => {},
    body: { classList: { add: () => {}, remove: () => {} }, appendChild() {}, removeChild() {} },
    activeElement: null
  };
  const controller = setupFieldMode({
    getState: () => state,
    onSaveState: (next) => { state = next; },
    onToast: (msg, opts) => toasts.push({ msg, opts })
  });
  const clickCustomerCard = async (id) => {
    await getEl('fieldModeCustomerList').dispatch('click', {
      target: { closest: (sel) => (sel === '[data-field-customer-id]' ? { getAttribute: () => id } : null) }
    });
  };
  const clickPanelAction = async (action) => {
    const btn = createMockElement('', 'button');
    btn.getAttribute = (n) => (n === 'data-field-action' ? action : null);
    await panel.dispatch('click', {
      target: { closest: (sel) => (sel === '[data-field-action]' ? btn : null) }
    });
  };
  const pickAndApply = async (packageId) => {
    pkgSelect.value = packageId;
    await panel.dispatch('change', { target: pkgSelect });
    assert.equal(pkgApply.disabled, false, 'apply arms once a package is picked');
    await panel.dispatch('click', {
      target: { closest: (sel) => (sel === '[data-field-action]' ? pkgApply : null) }
    });
  };
  return {
    controller, panel, pkgSelect, pkgApply, advanceInput, toasts,
    clickCustomerCard, clickPanelAction, pickAndApply,
    getState: () => state,
    searchInput: getEl('fieldModeSearchInput'),
    restore: () => { globalThis.document = origDocument; }
  };
}

const now = new Date();
const month = getPakistanLocalDate(now).slice(0, 7);
const today = getPakistanLocalDate(now);

// FREE customer: no bill is ever created, totalDues stays 0, so the
// advance sheet is re-shown after the package change.
function freeState() {
  let s = addCustomer(createInitialState([]), 'Free Tester', now, { isFreeConnection: true });
  const id = s.customers[0].id;
  s = updateCustomerProfile(s, id, { packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000 }, now);
  s = generateMonthlyBillsThroughCurrentMonth(s, now);
  return { state: s, id };
}

// Paid-in-full customer: current month paid at the old price.
function paidState() {
  let s = createInitialState(['Paid Tester']);
  const id = 'seed-001';
  s = updateCustomerProfile(s, id, { packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000 }, now);
  s = generateMonthlyBillsThroughCurrentMonth(s, now);
  s = addPayment(s, id, month, { date: today, amount: 1000, method: 'Cash' }, now);
  return { state: s, id };
}

// Customer owing 1,000 on a 2,000 bill (paid 1,000 of 2,000).
function owingState() {
  let s = createInitialState(['Owing Tester']);
  const id = 'seed-001';
  s = updateCustomerProfile(s, id, { packageSpeed: '5Mbps / 200GB', monthlySellingAmount: 2000 }, now);
  s = generateMonthlyBillsThroughCurrentMonth(s, now);
  s = addPayment(s, id, month, { date: today, amount: 1000, method: 'Cash' }, now);
  return { state: s, id };
}

async function openAdvanceSheet(h, id, name) {
  h.controller.open();
  h.searchInput.value = name;
  await h.searchInput.dispatch('input');
  await h.clickCustomerCard(id);
  assert.ok(h.panel.innerHTML.includes('Paid in full — no dues.') || h.panel.innerHTML.includes('fieldModeAdvanceAmount'),
    'advance sheet is showing');
}

test('C1: typed advance amount survives a package change that keeps the customer on the advance sheet', async () => {
  const { state, id } = freeState();
  const h = buildHarness(state);
  try {
    await openAdvanceSheet(h, id, 'Free');
    h.advanceInput.value = '1500';
    await h.pickAndApply('5mbps-200gb');
    assert.equal(h.getState().customers[0].packageSpeed, '5Mbps / 200GB', 'package changed');
    assert.equal(h.getState().customers[0].bills.length, 0, 'FREE: no bill was created');
    assert.equal(h.advanceInput.value, '1500', 'the typed amount is still in place after the re-render');
  } finally {
    h.restore();
  }
});

test('C2: typed advance amount survives the Undo render too', async () => {
  const { state, id } = freeState();
  const h = buildHarness(state);
  try {
    await openAdvanceSheet(h, id, 'Free');
    h.advanceInput.value = '1500';
    await h.pickAndApply('5mbps-200gb');
    const done = h.toasts.find((x) => typeof x.opts?.onAction === 'function');
    assert.ok(done, 'success toast carries the Undo action');
    done.opts.onAction();
    assert.equal(h.getState().customers[0].packageSpeed, '3Mbps / 100GB', 'undo restored the old package');
    assert.equal(h.advanceInput.value, '1500', 'the typed amount is still in place after the Undo re-render');
  } finally {
    h.restore();
  }
});

test('C3: a typed figure equal to the old pending dues survives a downgrade that clears the dues', async () => {
  const { state, id } = owingState();
  const h = buildHarness(state);
  try {
    h.controller.open();
    h.searchInput.value = 'Owing';
    await h.searchInput.dispatch('input');
    await h.clickCustomerCard(id);
    assert.ok(h.panel.innerHTML.includes('Cash Full — PKR 1,000'), 'collect sheet opens facing the 1,000 due');
    // Operator taps "Advance payment", types exactly the pending 1,000.
    await h.clickPanelAction('advance');
    assert.ok(h.panel.innerHTML.includes('fieldModeAdvanceAmount'), 'advance sheet is showing');
    h.advanceInput.value = '1000';
    await h.pickAndApply('3mbps-100gb');
    assert.equal(Number(h.getState().customers[0].bills.find((b) => b.month === month).dueAmount), 1000, 'bill repriced to the new fee');
    assert.equal(calculatePaymentAllocations(h.getState()).forMonth(id, month)?.balanceDueCents, 0, 'dues cleared by the downgrade');
    assert.equal(h.advanceInput.value, '1000', 'the typed 1,000 survives — it was the operator’s figure, not the old prefill');
  } finally {
    h.restore();
  }
});

test('S1: an untouched field stays empty after the change (no phantom prefill)', async () => {
  const { state, id } = freeState();
  const h = buildHarness(state);
  try {
    await openAdvanceSheet(h, id, 'Free');
    assert.equal(h.advanceInput.value, '', 'precondition: the input starts empty');
    await h.pickAndApply('5mbps-200gb');
    assert.equal(h.advanceInput.value, '', 'untouched field stays empty — the advance sheet has no prefill to follow');
  } finally {
    h.restore();
  }
});

test('S2: a paid-in-full upgrade still lands on the collect sheet facing the recomputed due', async () => {
  const { state, id } = paidState();
  const h = buildHarness(state);
  try {
    await openAdvanceSheet(h, id, 'Paid');
    await h.pickAndApply('5mbps-200gb');
    assert.equal(calculatePaymentAllocations(h.getState()).forMonth(id, month)?.balanceDueCents, 100000, 'exactly 1,000 now due');
    assert.ok(h.panel.innerHTML.includes('Cash Full — PKR 1,000'), 'the sheet lands on collection facing the recomputed due');
  } finally {
    h.restore();
  }
});

test('S3: the package change itself is unchanged (FREE skips the bill, upgrade reprices it)', async () => {
  const { state: free, id: freeId } = freeState();
  const h = buildHarness(free);
  try {
    await openAdvanceSheet(h, freeId, 'Free');
    await h.pickAndApply('5mbps-200gb');
    assert.equal(h.getState().customers[0].packageSpeed, '5Mbps / 200GB', 'FREE package recorded');
    assert.equal(h.getState().customers[0].bills.length, 0, 'FREE: still no bill');
    assert.equal(fieldModeCustomerStatus(h.getState(), freeId).totalDues, 0, 'FREE: still zero dues');
  } finally {
    h.restore();
  }
  const { state: paid, id: paidId } = paidState();
  const h2 = buildHarness(paid);
  try {
    await openAdvanceSheet(h2, paidId, 'Paid');
    await h2.pickAndApply('5mbps-200gb');
    assert.equal(Number(h2.getState().customers[0].bills.find((b) => b.month === month).dueAmount), 2000, 'upgrade repriced the bill');
  } finally {
    h2.restore();
  }
});

test('S4: the recorder still refuses empty/zero at record time', () => {
  const { state, id } = freeState();
  const entry = { id, totalDues: 0, targetMonth: month };
  assert.throws(
    () => collectFieldModeAdvance(state, entry, { amount: 0, method: 'Cash' }),
    /greater than zero/
  );
  assert.throws(
    () => collectFieldModeAdvance(state, entry, { amount: NaN, method: 'Cash' }),
    /greater than zero/
  );
});

test('S5: the package box still renders on both sheets', async () => {
  // Collect sheet: the owing customer opens on collection.
  const { state: owing, id: owingId } = owingState();
  const h = buildHarness(owing);
  try {
    h.controller.open();
    h.searchInput.value = 'Owing';
    await h.searchInput.dispatch('input');
    await h.clickCustomerCard(owingId);
    assert.ok(h.panel.innerHTML.includes('Cash Full — PKR 1,000'), 'collect sheet is showing');
    assert.ok(h.panel.innerHTML.includes('fieldModePackageSelect'), 'collect sheet renders the package picker');
  } finally {
    h.restore();
  }
  // Advance sheet: the paid customer opens on advance.
  const { state: paid, id: paidId } = paidState();
  const h2 = buildHarness(paid);
  try {
    await openAdvanceSheet(h2, paidId, 'Paid');
    assert.ok(h2.panel.innerHTML.includes('fieldModePackageSelect'), 'advance sheet renders the package picker');
  } finally {
    h2.restore();
  }
});

test('B1: the advance input markup is unchanged (no value attribute added)', () => {
  const line = fm.split('\n').find((l) => l.includes('id="fieldModeAdvanceAmount"'));
  assert.ok(line, 'the advance amount input exists');
  assert.ok(line.includes('class="field-mode-advance-amount"'), 'same class');
  assert.ok(line.includes('type="number"'), 'same type');
  assert.ok(line.includes('placeholder="Advance amount (PKR)"'), 'same placeholder');
  assert.ok(line.includes('aria-label="Advance amount (PKR)"'), 'same aria-label');
  assert.ok(!line.includes('value='), 'no value attribute — the restore is programmatic, not a prefill');
});
