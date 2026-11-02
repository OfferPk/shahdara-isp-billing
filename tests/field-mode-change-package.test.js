/**
 * field-mode-change-package.test.js — FU2 (follow-up to PR #507):
 * "Change Package" inside Field Mode.
 *
 * PR #507 put Change Package in the Quick Collect payment step and left
 * Field Mode's separate collect sheet without it. This follow-up adds
 * the SAME capability to Field Mode by REUSE, not by a second
 * implementation: changeFieldModePackage() is a thin entry-shape seam
 * over changeCustomerPackage (nav-quick-collect.js), the picker markup
 * mirrors the QC row with the same qcpkg_* strings, and the sheet
 * re-renders off the host-saved state so dues are recomputed by the
 * allocation engine exactly as everywhere else.
 *
 * Pins:
 *  - the PR #507 owner cases replayed in the Field Mode context, with
 *    the collection itself completed through Field Mode's own 1-tap
 *    path (collectFieldModePayment): bill not generated -> created at
 *    the new fee, then Cash Full settles; bill generated unpaid ->
 *    repriced; paid in full at the old price -> exactly 1,000 due;
 *    downgrade -> the overpaid 500 stays as unapplied credit (the
 *    sheet's status flips to 'advance' with the credit showing);
 *  - every PR #507 guard holds through the seam: FREE never billed,
 *    billing-paused month never billed, billed kist preserved on top
 *    of the new fee, same package = strict no-op (same state
 *    reference), unknown package / missing entry throw, and the
 *    recorded payment is never rewritten;
 *  - the package box renders on BOTH sheets (collect + advance — a
 *    zero-dues customer found by search lands on the advance sheet,
 *    and the paid-in-full upgrade case starts there), with the current
 *    package shown, its catalogue option disabled, and the shared
 *    qcpkg_* strings in both dictionaries;
 *  - controller (mock DOM): select customer -> pick package -> apply
 *    arms -> one tap saves through the host, the sheet re-renders at
 *    the new dues, the success toast carries Undo, and Undo restores
 *    the exact pre-change state; the searched paid-in-full customer
 *    upgrades from the advance sheet and lands on the collect sheet
 *    facing the recomputed due.
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, addCustomer, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth, addPayment,
  calculatePaymentAllocations, derivedBillStatus
} from '../core.js';
import {
  getPendingCollectionCustomers, getPakistanLocalDate
} from '../nav-quick-collect.js';
import {
  changeFieldModePackage, collectFieldModePayment, fieldModeCustomerStatus,
  fieldModePackageBoxMarkup, setupFieldMode
} from '../field-mode.js';
import { isBillingPaused } from '../pause-billing.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const SEP_05 = new Date(2026, 8, 5, 12);
const OCT_03 = new Date(2026, 9, 3, 12);
const OCT_10 = new Date(2026, 9, 10, 12);
const OCT_12 = new Date(2026, 9, 12, 12);

const billOf = (state, month, id = 'seed-001') =>
  state.customers.find(c => c.id === id).bills.find(b => b.month === month);
const balanceOf = (state, month, id = 'seed-001') =>
  calculatePaymentAllocations(state).forMonth(id, month)?.balanceDueCents / 100;
const entryOf = (state, filter = 'all', id = 'seed-001') =>
  getPendingCollectionCustomers(state, '', filter, OCT_03).find(e => e.id === id);

/** One synthetic customer on the PKR 1,000 catalogue package from September. */
function septemberCustomer() {
  let state = createInitialState(['Package Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, SEP_05);
  return state;
}

/** September 1,000 paid in full; October not billed yet. */
function septemberPaidState() {
  let state = generateMonthlyBillsThroughCurrentMonth(septemberCustomer(), SEP_05);
  state = addPayment(state, 'seed-001', '2026-09', { date: '2026-09-05', amount: 1000, method: 'Cash' }, SEP_05);
  return state;
}

test('seam: changeFieldModePackage delegates — same package is a strict no-op, bad inputs throw', () => {
  const state = septemberCustomer();
  const entry = entryOf(state);
  assert.ok(entry, 'precondition: the customer is on the Field Mode list');

  const res = changeFieldModePackage(state, entry, '3mbps-100gb', OCT_03);
  assert.equal(res.changed, false);
  assert.equal(res.reason, 'same-package');
  assert.equal(res.nextState, state, 'state returned untouched (same reference)');

  assert.throws(() => changeFieldModePackage(state, entry, 'no-such-package', OCT_03), /available packages/);
  assert.throws(() => changeFieldModePackage(state, null, '5mbps-200gb', OCT_03), /Customer not found/);
  assert.throws(() => changeFieldModePackage(state, { id: 'missing' }, '5mbps-200gb', OCT_03), /Customer not found/);
});

test('owner case in Field Mode, bill not yet generated: October bill is created at 2,000 and Cash Full settles it', () => {
  const state = septemberPaidState();
  assert.equal(billOf(state, '2026-10'), undefined, 'precondition: no October bill yet');
  // Zero dues: the sheet this customer opens is the advance sheet — the
  // package box must be reachable from there too (markup pin below).
  const entry = entryOf(state);
  assert.equal(entry.totalDues, 0);

  const res = changeFieldModePackage(state, entry, '5mbps-200gb', OCT_03);
  assert.equal(res.changed, true);
  assert.equal(res.billCreated, true);
  assert.equal(res.billRepriced, false);
  assert.equal(Number(billOf(res.nextState, '2026-10').dueAmount), 2000);
  assert.equal(res.balanceDue, 2000);
  assert.equal(Number(billOf(res.nextState, '2026-09').dueAmount), 1000, 'last month is never repriced');

  // The audit trail is the profile's own packageHistory mechanism,
  // stamped with the shared 'Quick Collect' flow label (one seam, one
  // audit shape — no Field Mode fork).
  const audit = res.nextState.customers[0].packageHistory.at(-1);
  assert.equal(audit.oldPackage, '3Mbps / 100GB');
  assert.equal(audit.newPackage, '5Mbps / 200GB');
  assert.equal(audit.oldMonthlyRate, 1000);
  assert.equal(audit.newMonthlyRate, 2000);

  // The sheet now shows the recomputed dues, and Field Mode's own
  // 1-tap Cash Full collects at the new fee in the same flow.
  const freshEntry = entryOf(res.nextState, 'all-dues');
  assert.equal(freshEntry.totalDues, 2000);
  const collected = collectFieldModePayment(res.nextState, freshEntry, 'Cash', OCT_03);
  assert.equal(collected.receipt.amount, 2000);
  assert.equal(balanceOf(collected.nextState, '2026-10'), 0);
  assert.equal(derivedBillStatus(collected.nextState.customers[0], billOf(collected.nextState, '2026-10')), 'paid');
});

test('owner case in Field Mode, bill already generated unpaid: repriced to 2,000, Cash Full settles', () => {
  let state = septemberPaidState();
  state = generateMonthlyBillsThroughCurrentMonth(state, OCT_03);
  assert.equal(Number(billOf(state, '2026-10').dueAmount), 1000, 'precondition: October billed at the old package');

  const res = changeFieldModePackage(state, entryOf(state, 'all-dues'), '5mbps-200gb', OCT_10);
  assert.equal(res.changed, true);
  assert.equal(res.billRepriced, true);
  assert.equal(res.billCreated, false);
  const bill = billOf(res.nextState, '2026-10');
  assert.equal(Number(bill.dueAmount), 2000);
  assert.equal(bill.packageSnapshot?.packageId, '5mbps-200gb');
  assert.equal(res.balanceDue, 2000);

  const collected = collectFieldModePayment(res.nextState, entryOf(res.nextState, 'all-dues'), 'Cash', OCT_10);
  assert.equal(collected.receipt.amount, 2000);
  assert.equal(balanceOf(collected.nextState, '2026-10'), 0);
});

test('owner case in Field Mode, paid in full at the old price: change leaves exactly 1,000 due, payment untouched', () => {
  let state = septemberPaidState();
  state = generateMonthlyBillsThroughCurrentMonth(state, OCT_03);
  state = addPayment(state, 'seed-001', '2026-10', { date: '2026-10-05', amount: 1000, method: 'Cash' }, OCT_10);
  assert.equal(balanceOf(state, '2026-10'), 0, 'precondition: October fully paid at 1,000');
  assert.equal(fieldModeCustomerStatus(state, 'seed-001').key, 'paid');

  const res = changeFieldModePackage(state, entryOf(state), '5mbps-200gb', OCT_12);
  assert.equal(Number(billOf(res.nextState, '2026-10').dueAmount), 2000);
  assert.equal(res.balanceDue, 1000, 'exactly the shortfall is due — no more, no less');
  // The recorded payment stays recorded — nothing was rewritten.
  assert.equal(billOf(res.nextState, '2026-10').payments.length, 1);
  assert.equal(derivedBillStatus(res.nextState.customers[0], billOf(res.nextState, '2026-10')), 'partial');
  // The card flips GREEN -> RED with the recomputed figure.
  const status = fieldModeCustomerStatus(res.nextState, 'seed-001');
  assert.equal(status.key, 'due');
  assert.equal(status.totalDues, 1000);

  const collected = collectFieldModePayment(res.nextState, entryOf(res.nextState, 'all-dues'), 'Cash', OCT_12);
  assert.equal(collected.receipt.amount, 1000);
  assert.equal(balanceOf(collected.nextState, '2026-10'), 0);
});

test('owner case in Field Mode, downgrade: the overpaid 500 stays as unapplied advance credit', () => {
  let state = createInitialState(['Downgrade Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '5Mbps / 200GB', monthlySellingAmount: 2000
  }, SEP_05);
  // September is settled first, so the whole-customer status below
  // reads October alone (an unpaid September would rightly stay RED).
  state = generateMonthlyBillsThroughCurrentMonth(state, SEP_05);
  state = addPayment(state, 'seed-001', '2026-09', { date: '2026-09-05', amount: 2000, method: 'Cash' }, SEP_05);
  state = generateMonthlyBillsThroughCurrentMonth(state, OCT_03);
  state = addPayment(state, 'seed-001', '2026-10', { date: '2026-10-05', amount: 1500, method: 'Cash' }, OCT_10);
  assert.equal(balanceOf(state, '2026-10'), 500, 'precondition: 500 still due on the 2,000 bill');

  const res = changeFieldModePackage(state, entryOf(state, 'all-dues'), '3mbps-100gb', OCT_12);
  assert.equal(Number(billOf(res.nextState, '2026-10').dueAmount), 1000);
  assert.equal(res.balanceDue, 0);

  const allocations = calculatePaymentAllocations(res.nextState);
  const payment = billOf(res.nextState, '2026-10').payments[0];
  assert.equal(allocations.byPaymentId.get(payment.id).unappliedCreditCents, 50000,
    'the extra 500 is engine pending credit — not lost, not double-counted');
  // The Field Mode card tells the same story: no dues, credit waiting.
  const status = fieldModeCustomerStatus(res.nextState, 'seed-001');
  assert.equal(status.key, 'advance');
  assert.equal(status.advanceCredit, 500);
});

test('guards through the seam: FREE never billed, paused month never billed, kist preserved', () => {
  // FREE connection: plan change recorded, no bill, no dues.
  let free = addCustomer(createInitialState([]), 'Free Tester', SEP_05, { isFreeConnection: true });
  const freeId = free.customers[0].id;
  free = updateCustomerProfile(free, freeId, {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, SEP_05);
  free = generateMonthlyBillsThroughCurrentMonth(free, OCT_03);
  const freeEntry = getPendingCollectionCustomers(free, '', 'all', OCT_03).find(e => e.id === freeId);
  const freeRes = changeFieldModePackage(free, freeEntry, '5mbps-200gb', OCT_10);
  assert.equal(freeRes.changed, true);
  assert.equal(freeRes.billSkipped, 'free-connection');
  assert.equal(freeRes.nextState.customers[0].bills.length, 0, 'no bill was created by the package change');
  assert.equal(fieldModeCustomerStatus(freeRes.nextState, freeId).totalDues, 0);

  // Billing-paused month (SISP-8): no bill created or repriced.
  let paused = septemberPaidState();
  paused = updateCustomerProfile(paused, 'seed-001', { paused: true, pauseStartDate: '2026-10-01' }, OCT_03);
  assert.equal(isBillingPaused(paused.customers[0], '2026-10'), true, 'precondition: October is paused');
  const pausedRes = changeFieldModePackage(paused, entryOf(paused), '5mbps-200gb', OCT_10);
  assert.equal(pausedRes.billSkipped, 'paused');
  assert.equal(billOf(pausedRes.nextState, '2026-10'), undefined, 'no October bill exists');

  // Kist (SISP-4) riding the bill is preserved on top of the new fee.
  let kist = septemberPaidState();
  kist = generateMonthlyBillsThroughCurrentMonth(kist, OCT_03);
  kist = {
    ...kist,
    customers: kist.customers.map(c => ({
      ...c,
      bills: c.bills.map(b => b.month === '2026-10' ? { ...b, dueAmount: 1500, kistTotal: 500 } : b)
    }))
  };
  assert.equal(balanceOf(kist, '2026-10'), 1500, 'precondition: 1,000 package + 500 kist due');
  const kistRes = changeFieldModePackage(kist, entryOf(kist, 'all-dues'), '5mbps-200gb', OCT_10);
  assert.equal(Number(billOf(kistRes.nextState, '2026-10').dueAmount), 2500, 'new fee 2,000 + preserved kist 500');
  assert.equal(Number(billOf(kistRes.nextState, '2026-10').kistTotal), 500);
  assert.equal(kistRes.balanceDue, 2500);
});

test('markup: the package box mirrors the QC row — current package, catalogue picker, shared strings', () => {
  const customer = septemberCustomer().customers[0];
  const html = fieldModePackageBoxMarkup(customer);
  assert.ok(html.includes('field-mode-package'), 'field-mode package block class');
  assert.ok(html.includes('3Mbps / 100GB'), 'current package label rendered');
  assert.ok(html.includes(t('qcpkg_current', null, { label: '3Mbps / 100GB', amount: 'PKR 1,000' })),
    'current line uses the shared qcpkg_current string');
  assert.ok(html.includes('id="fieldModePackageSelect"'), 'picker present');
  assert.ok(html.includes('value="5mbps-200gb"'), 'catalogue options rendered');
  assert.ok(html.includes('value="3mbps-100gb" disabled'), 'the current package option is disabled');
  assert.ok(html.includes('data-field-action="change-package"'), 'apply button hook present');
  assert.ok(html.includes('disabled'), 'apply starts disabled until a pick arms it');

  assert.equal(fieldModePackageBoxMarkup(null), '', 'no customer -> no box');

  // FREE + paused notes come from the same shared strings as Quick Collect.
  const freeHtml = fieldModePackageBoxMarkup({ ...customer, isFreeConnection: true });
  assert.ok(freeHtml.includes(t('qcpkg_free_note')), 'FREE note rendered for a free connection');
  const pausedHtml = fieldModePackageBoxMarkup({
    ...customer, paused: true, pauseStartDate: `${getPakistanLocalDate().slice(0, 7)}-01`
  });
  assert.ok(pausedHtml.includes(t('qcpkg_paused_note')), 'paused note rendered for a paused month');
});

test('i18n: the Field Mode box reuses the qcpkg_* keys — all present in both dictionaries', () => {
  const keys = [
    'qcpkg_label', 'qcpkg_current', 'qcpkg_none', 'qcpkg_fee_not_set', 'qcpkg_pick',
    'qcpkg_change_btn', 'qcpkg_same', 'qcpkg_done', 'qcpkg_done_nobill',
    'qcpkg_free_note', 'qcpkg_paused_note', 'qcpkg_undo'
  ];
  const js = readFileSync(new URL('../field-mode.js', import.meta.url), 'utf8');
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
    assert.ok(js.includes(`t('${key}'`), `field-mode.js renders ${key} through t()`);
  }
});

// --- mock-DOM controller harness (the QC controller test's pattern) ---
function buildFieldModeHarness(initialState) {
  const registry = new Map();
  const createMockElement = (id, tag = 'div') => {
    const listeners = {};
    const attrs = {};
    const el = {
      id, tagName: tag.toUpperCase(), textContent: '', innerHTML: '', value: '',
      style: {}, hidden: false, disabled: false, checked: false, children: [],
      classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
      getAttribute: (n) => attrs[n] ?? null,
      setAttribute: (n, v) => { attrs[n] = v; },
      removeAttribute: (n) => { delete attrs[n]; },
      addEventListener: (type, h) => { (listeners[type] = listeners[type] || []).push(h); },
      dispatch: async (type, evt = {}) => { for (const h of (listeners[type] || [])) await h({ type, preventDefault: () => {}, ...evt }); },
      querySelector: () => null,
      querySelectorAll: () => [],
      focus: () => {},
      select: () => {}
    };
    return el;
  };
  const getEl = (id, tag) => {
    if (!registry.has(id)) registry.set(id, createMockElement(id, tag));
    return registry.get(id);
  };
  // The panel gets working package select + apply button stubs behind
  // its querySelector — exactly the two nodes the controller wires.
  const pkgSelect = createMockElement('fieldModePackageSelect', 'select');
  const pkgApply = createMockElement('', 'button');
  pkgApply.disabled = true;
  pkgApply.getAttribute = (n) => (n === 'data-field-action' ? 'change-package' : null);
  const panel = getEl('fieldModeActionPanel');
  panel.querySelector = (sel) =>
    sel === '#fieldModePackageSelect' ? pkgSelect
      : sel === '[data-field-action="change-package"]' ? pkgApply
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
  const pickAndApply = async (packageId) => {
    pkgSelect.value = packageId;
    await panel.dispatch('change', { target: pkgSelect });
    assert.equal(pkgApply.disabled, false, 'apply arms once a package is picked');
    await panel.dispatch('click', {
      target: {
        closest: (sel) => (sel === '[data-field-action]' ? pkgApply : null)
      }
    });
  };
  return {
    controller, panel, pkgSelect, pkgApply, toasts, clickCustomerCard, pickAndApply,
    getState: () => state,
    searchInput: getEl('fieldModeSearchInput'),
    restore: () => { globalThis.document = origDocument; }
  };
}

test('controller (mock DOM): collect sheet — one tap reprices, sheet re-renders at new dues, Undo restores', async () => {
  // Fixture in the real current month — the controller works off the
  // live clock, so the fixture is built relative to today.
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  let state = createInitialState(['Controller Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  assert.equal(Number(billOf(state, month).dueAmount), 1000, 'precondition: current bill at the old package');

  const h = buildFieldModeHarness(state);
  try {
    h.controller.open();
    await h.clickCustomerCard('seed-001');
    assert.ok(h.panel.innerHTML.includes('fieldModePackageSelect'), 'collect sheet renders the package picker');
    assert.ok(h.panel.innerHTML.includes('Cash Full — PKR 1,000'), 'Cash Full starts at the old dues');

    await h.pickAndApply('5mbps-200gb');
    assert.equal(Number(billOf(h.getState(), month).dueAmount), 2000, 'bill repriced via the host save');
    assert.ok(h.panel.innerHTML.includes('Cash Full — PKR 2,000'), 'sheet re-rendered at the new dues');
    const done = h.toasts.find(x => x.msg.includes('5Mbps / 200GB'));
    assert.ok(done, 'success toast names the new package');
    assert.equal(typeof done.opts?.onAction, 'function', 'toast carries the Undo action');

    done.opts.onAction();
    assert.equal(Number(billOf(h.getState(), month).dueAmount), 1000, 'undo restored the old bill');
    assert.equal(h.getState().customers[0].packageSpeed, '3Mbps / 100GB', 'undo restored the old package');
  } finally {
    h.restore();
  }
});

test('controller (mock DOM): searched paid-in-full customer upgrades from the advance sheet into the collect sheet', async () => {
  const now = new Date();
  const month = getPakistanLocalDate(now).slice(0, 7);
  const today = getPakistanLocalDate(now);
  let state = createInitialState(['Paid Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  state = addPayment(state, 'seed-001', month, { date: today, amount: 1000, method: 'Cash' }, now);
  assert.equal(balanceOf(state, month), 0, 'precondition: current month fully paid');

  const h = buildFieldModeHarness(state);
  try {
    h.controller.open();
    // The owner's flow: search finds the paid customer, his sheet is
    // the advance sheet — and the package box is there too.
    h.searchInput.value = 'Paid';
    await h.searchInput.dispatch('input');
    await h.clickCustomerCard('seed-001');
    assert.ok(h.panel.innerHTML.includes('Paid in full — no dues.'), 'advance sheet opens for the paid customer');
    assert.ok(h.panel.innerHTML.includes('fieldModePackageSelect'), 'advance sheet renders the package picker');

    await h.pickAndApply('5mbps-200gb');
    assert.equal(Number(billOf(h.getState(), month).dueAmount), 2000, 'bill repriced via the host save');
    assert.equal(balanceOf(h.getState(), month), 1000, 'exactly 1,000 now due');
    assert.ok(h.panel.innerHTML.includes('Cash Full — PKR 1,000'),
      'the sheet lands on collection facing the recomputed due');
  } finally {
    h.restore();
  }
});

test('wiring: the seam reuses changeCustomerPackage and both sheets render the box; CSS is token-only', () => {
  const js = readFileSync(new URL('../field-mode.js', import.meta.url), 'utf8');
  assert.ok(js.includes('changeCustomerPackage'), 'field-mode imports the QC pure function');
  assert.ok(js.includes('export function changeFieldModePackage'), 'the seam is exported for tests');
  assert.equal((js.match(/fieldModePackageBoxMarkup\(/g) || []).length >= 3, true,
    'box markup defined once and rendered on both sheets');
  assert.ok(js.includes("action === 'change-package'"), 'delegated click routes the apply button');
  assert.ok(js.includes("event.target?.id === 'fieldModePackageSelect'"), 'picker change arms the apply button');
  // No second repricing implementation may creep in: the core bill
  // writers stay behind changeCustomerPackage, never called from here.
  assert.ok(!js.includes('saveBillMonth('), 'field-mode never reprices bills itself');
  assert.ok(!js.includes('updateCustomerProfile('), 'field-mode never writes the plan itself');

  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length,
    'components.css braces balanced');
  for (const cls of ['.field-mode-package {', '.field-mode-package-current {', '.field-mode-package-select {']) {
    const at = css.indexOf(cls);
    assert.ok(at >= 0, `${cls} rule exists`);
    const block = css.slice(at, css.indexOf('}', at));
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), `${cls} uses theme tokens, no hex`);
  }
  const selectBlock = css.slice(css.indexOf('.field-mode-package-select {'), css.indexOf('}', css.indexOf('.field-mode-package-select {')));
  assert.ok(/min-height:\s*48px/.test(selectBlock), 'picker keeps the 48px field-mode tap target');
});
