/**
 * plan541-package-box-names-month.test.js — Plan 541: the package box
 * names the month it reprices.
 *
 * renderPackageBox reprices the CURRENT month, but the box showed only
 * the current package and a picker — no month anywhere. The form's
 * payment, meanwhile, targets activeDefaults.targetMonth, the earliest
 * unpaid month, which is often an older month. The operator could
 * change the package believing the new price is what they are
 * collecting, when the change touches a different month's bill.
 *
 * Pins:
 *  - the box always names the month the change applies from
 *    ("Change applies from {Month YYYY}", via the existing monthLabel
 *    helper) — except when no bill is repriced at all (billing-paused
 *    month, free connection), where the existing paused/free note
 *    already says the change applies later / never creates a bill,
 *    and naming the current month would contradict it;
 *  - when the form's target month differs from the current month, a
 *    note flags it (names the older month the payment collects);
 *  - when the form targets the current month, one month line only —
 *    no warning;
 *  - the line survives the package-change reopen, and the polish #13
 *    amount behaviour (typed amount survives) is untouched;
 *  - both new strings exist in BOTH language dictionaries with the
 *    {month} param, and the wiring is label-only (no new element id,
 *    no new CSS, no new hex).
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, addCustomer, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth, addPayment,
  calculatePaymentAllocations
} from '../core.js';
import {
  getCustomerPaymentDefaults, getPakistanLocalDate, setupQuickCollectModal
} from '../nav-quick-collect.js';
import { isBillingPaused } from '../pause-billing.js';
import { TRANSLATIONS } from '../nav-language.js';
import { monthLabel } from '../monthly-complaint-report.js';

const billOf = (state, month, id = 'seed-001') =>
  state.customers.find(c => c.id === id).bills.find(b => b.month === month);

/** Previous PKT month string for a 'YYYY-MM' month string. */
function previousMonthString(month) {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

function fill(template, params) {
  return Object.entries(params).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
}

/**
 * The polish #13 controller harness: the change-package test's mock
 * DOM, reused here. The controller works off the live clock, so every
 * fixture is built relative to today.
 */
function plan541Controller(initialState) {
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
    return el;
  };
  const getEl = (id, tag) => {
    if (!registry.has(id)) registry.set(id, createMockElement(id, tag));
    return registry.get(id);
  };
  const pkgSelect = createMockElement('quickCollectPackageSelect', 'select');
  const pkgApply = createMockElement('', 'button');
  pkgApply.disabled = true;
  const packageBox = getEl('quickCollectPackageBox');
  packageBox.querySelector = (sel) =>
    sel === '#quickCollectPackageSelect' ? pkgSelect : sel === '[data-qc-change-package]' ? pkgApply : null;
  const modal = getEl('quickCollectModal', 'dialog');

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
    getEl, pkgSelect, pkgApply, packageBox, toasts, controller,
    get state() { return state; },
    restore() { globalThis.document = origDocument; }
  };
}

/** One synthetic customer on the PKR 1,000 package, billed this month. */
function currentBillState(now, month) {
  let state = createInitialState(['Plan541 Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  assert.equal(Number(billOf(state, month).dueAmount), 1000, 'precondition: current bill at the old package');
  return state;
}

/** Older dues 500 (previous month, shaped down) + current bill 1,000. */
function olderDuesState(now, month) {
  const prevMonth = previousMonthString(month);
  const [y, m] = month.split('-').map(Number);
  const prevRef = new Date(y, m - 2, 5, 12);
  let state = createInitialState(['Plan541 Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, prevRef);
  state = generateMonthlyBillsThroughCurrentMonth(state, prevRef);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  // Shape the older bill down to 500: the operator's case is older dues
  // 500 plus the current bill at the old package (the kist test's
  // direct-shape precedent — the allocation engine reads dueAmount).
  state = {
    ...state,
    customers: state.customers.map(c => ({
      ...c,
      bills: c.bills.map(b => b.month === prevMonth ? { ...b, dueAmount: 500 } : b)
    }))
  };
  assert.equal(getCustomerPaymentDefaults(state, 'seed-001', now).totalDues, 1500, 'precondition: older 500 + current 1,000');
  assert.equal(getCustomerPaymentDefaults(state, 'seed-001', now).targetMonth, prevMonth, 'precondition: form targets the older month');
  return state;
}

test('plan541 (controller): form targeting an older unpaid month names the current month and flags the difference', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  const prevMonth = previousMonthString(month);
  const h = plan541Controller(olderDuesState(now, month));
  try {
    h.controller.open('seed-001');
    const box = h.packageBox.innerHTML;
    // The box states the month the change reprices.
    assert.ok(
      box.includes(fill(TRANSLATIONS.en.qcpkg_applies_from, { month: monthLabel(month) })),
      `box names the current month: ${box}`
    );
    // And flags that the payment collects a different, older month.
    assert.ok(
      box.includes(fill(TRANSLATIONS.en.qcpkg_applies_differs, { month: monthLabel(prevMonth) })),
      `box flags the older target month: ${box}`
    );
  } finally {
    h.restore();
  }
});

test('plan541 (controller): form targeting the current month shows one month line and no warning', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  const h = plan541Controller(currentBillState(now, month));
  try {
    h.controller.open('seed-001');
    const box = h.packageBox.innerHTML;
    assert.equal(
      getCustomerPaymentDefaults(h.state, 'seed-001', now).targetMonth, month,
      'precondition: form targets the current month'
    );
    assert.ok(
      box.includes(fill(TRANSLATIONS.en.qcpkg_applies_from, { month: monthLabel(month) })),
      `box names the current month: ${box}`
    );
    assert.ok(
      !box.includes(fill(TRANSLATIONS.en.qcpkg_applies_differs, { month: monthLabel(month) })),
      `no differs warning when the target is the current month: ${box}`
    );
  } finally {
    h.restore();
  }
});

test('plan541 (controller): the month line survives the package-change reopen and the typed amount still survives', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  const prevMonth = previousMonthString(month);
  const h = plan541Controller(olderDuesState(now, month));
  try {
    h.controller.open('seed-001');
    assert.ok(
      h.packageBox.innerHTML.includes(fill(TRANSLATIONS.en.qcpkg_applies_from, { month: monthLabel(month) })),
      'month line present before the change'
    );

    // Polish #13's case: the operator types 2,500 first.
    h.getEl('quickCollectAmountInput').value = '2500';
    h.pkgSelect.value = '5mbps-500gb';
    await h.pkgSelect.dispatch('change');
    await h.pkgApply.click();

    assert.equal(Number(billOf(h.state, month).dueAmount), 2500, 'bill repriced to the new package');
    assert.equal(h.getEl('quickCollectAmountInput').value, '2500', 'typed amount carried over verbatim (polish #13 untouched)');
    const box = h.packageBox.innerHTML;
    assert.ok(
      box.includes(fill(TRANSLATIONS.en.qcpkg_applies_from, { month: monthLabel(month) })),
      `month line re-rendered after the reopen: ${box}`
    );
    assert.ok(
      box.includes(fill(TRANSLATIONS.en.qcpkg_applies_differs, { month: monthLabel(prevMonth) })),
      `differs note re-rendered after the reopen: ${box}`
    );
  } finally {
    h.restore();
  }
});

test('plan541 (controller): billing-paused month shows no applies-from line — the paused note speaks instead', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  const prevMonth = previousMonthString(month);
  const [y, m] = month.split('-').map(Number);
  const prevRef = new Date(y, m - 2, 5, 12);
  let state = createInitialState(['Plan541 Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, prevRef);
  state = generateMonthlyBillsThroughCurrentMonth(state, prevRef);
  state = {
    ...state,
    customers: state.customers.map(c => ({
      ...c,
      bills: c.bills.map(b => b.month === prevMonth ? { ...b, dueAmount: 500 } : b)
    }))
  };
  // Pause the current month before it is ever billed: no current bill.
  state = updateCustomerProfile(state, 'seed-001', { paused: true, pauseStartDate: `${month}-01` }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  assert.equal(billOf(state, month), undefined, 'precondition: no current bill while paused');
  assert.equal(isBillingPaused(state.customers[0], month), true, 'precondition: current month is paused');

  const h = plan541Controller(state);
  try {
    h.controller.open('seed-001');
    const box = h.packageBox.innerHTML;
    // Naming the current month here would contradict the paused note
    // ("the new package applies from the next billed month").
    assert.ok(!box.includes('Change applies from'), `no applies-from line while paused: ${box}`);
    assert.ok(box.includes(TRANSLATIONS.en.qcpkg_paused_note), 'paused note still explains where the change applies');
  } finally {
    h.restore();
  }
});

test('plan541 (controller): free connection shows no applies-from line — the free note speaks instead', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  let state = addCustomer(createInitialState([]), 'Free Tester', now, { isFreeConnection: true });
  const id = state.customers[0].id;
  state = updateCustomerProfile(state, id, {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  assert.equal(state.customers[0].bills.length, 0, 'precondition: a free connection has no bills');

  const h = plan541Controller(state);
  try {
    h.controller.open(id);
    const box = h.packageBox.innerHTML;
    // No bill is ever repriced for a free connection, so there is no
    // month to name — the free note already covers it.
    assert.ok(!box.includes('Change applies from'), `no applies-from line for a free connection: ${box}`);
    assert.ok(box.includes(TRANSLATIONS.en.qcpkg_free_note), 'free note still explains that no bill is created');
  } finally {
    h.restore();
  }
});

test('plan541 i18n: both new keys exist in both dictionaries with the {month} param', () => {
  const keys = ['qcpkg_applies_from', 'qcpkg_applies_differs'];
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.ok(TRANSLATIONS.en[key].includes('{month}'), `en ${key} missing {month}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
    assert.ok(TRANSLATIONS.ur[key].includes('{month}'), `ur ${key} missing {month}`);
    // The Urdu value must carry Urdu script, never a bare English line.
    assert.ok(/[\u0600-\u06FF]/.test(TRANSLATIONS.ur[key]), `ur ${key} carries no Urdu script`);
  }
});

test('plan541 wiring: monthLabel import, label-only render, no new element id or CSS', () => {
  const qc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  // Month-name fix: the import now carries monthName alongside
  // monthLabel (same module, same line) — the pin's intent,
  // "monthLabel reused from the existing helper module", is unchanged.
  assert.ok(
    qc.includes("import { monthLabel, monthName } from './monthly-complaint-report.js'"),
    'monthLabel reused from the existing helper module'
  );
  assert.ok(qc.includes('qcpkg_applies_from'), 'applies-from line rendered in the package box');
  assert.ok(qc.includes('qcpkg_applies_differs'), 'differs note rendered in the package box');
  assert.ok(qc.includes('activeDefaults?.targetMonth'), 'differs check reads the form target month');
  // The lines reuse the existing note class — no new class, no new id.
  const boxBlock = qc.slice(qc.indexOf('function renderPackageBox'), qc.indexOf('function captureBackToPickDraft'));
  assert.ok(boxBlock.includes('qc-package-note'), 'lines reuse the existing qc-package-note class');
  assert.ok(!/id="qc[^"]*"/.test(boxBlock), 'no new element id in the package box');
  assert.ok(!/#[0-9a-fA-F]{3,8}/.test(boxBlock), 'no hex colour in the package box markup');
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const noteRule = css.match(/\.qc-package-note \{[^}]*\}/);
  assert.ok(noteRule, 'qc-package-note rule exists');
  assert.ok(!/#[0-9a-fA-F]{3,8}/.test(noteRule[0]), 'qc-package-note uses theme tokens, no hex');
});
