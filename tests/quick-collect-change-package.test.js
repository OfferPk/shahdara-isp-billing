/**
 * quick-collect-change-package.test.js — Owner feature (2026-10-29):
 * "Change Package" inside the Quick Collect payment step.
 *
 * The owner's case, given while looking at the Quick Collect Cash
 * screen: the customer was on the PKR 1,000 package last month and
 * takes the PKR 2,000 package this month — from the collect sheet you
 * change the package, this month's bill is (re)made at the new package
 * automatically, and you collect, without leaving the screen.
 *
 * Pins:
 *  - the change rides the EXISTING paths only: updateCustomerProfile
 *    (package fields + packageHistory audit + price schedule),
 *    generateMonthlyBillsThroughCurrentMonth for a missing bill, and
 *    saveBillMonth (profile bill editor's write, amountHistory) for an
 *    existing one. calculatePaymentAllocations stays the only dues
 *    truth — no parallel recompute;
 *  - his exact example both ways: bill not yet generated (created at
 *    2,000) and bill already generated unpaid (repriced to 2,000);
 *    last month's bill is NEVER repriced, and next month bills at the
 *    new package too;
 *  - already-paid: paid 1,000 on the 1,000 bill, change to 2,000 ->
 *    exactly 1,000 due, collect settles;
 *  - downgrade: paid 1,500 on the 2,000 bill, change to 1,000 -> bill
 *    1,000, balance 0, the extra 500 stays as engine pending credit;
 *  - kist (SISP-4) riding the bill is preserved on top of the new fee;
 *  - a FREE connection records the plan change but gets NO bill/dues;
 *  - a billing-paused month (SISP-8) gets no bill — the package applies
 *    from the next billed month;
 *  - same package (label AND fee) is a strict no-op; archived customers
 *    and unknown package ids throw;
 *  - every new UI string exists in BOTH language dictionaries and the
 *    static wiring (host div, controller render/handler, CSS) is in
 *    place. Synthetic data only.
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
  changeCustomerPackage, executeQuickCollection, getCustomerPaymentDefaults,
  getPakistanLocalDate, setupQuickCollectModal
} from '../nav-quick-collect.js';
import { isBillingPaused } from '../pause-billing.js';
import { TRANSLATIONS } from '../nav-language.js';

const SEP_05 = new Date(2026, 8, 5, 12);
const OCT_03 = new Date(2026, 9, 3, 12);
const OCT_10 = new Date(2026, 9, 10, 12);
const OCT_12 = new Date(2026, 9, 12, 12);
const NOV_02 = new Date(2026, 10, 2, 12);

const billOf = (state, month, id = 'seed-001') =>
  state.customers.find(c => c.id === id).bills.find(b => b.month === month);
const balanceOf = (state, month, id = 'seed-001') =>
  calculatePaymentAllocations(state).forMonth(id, month)?.balanceDueCents / 100;

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

test('owner example, bill not yet generated: October bill is created at the new 2,000 package and collects to settled', () => {
  const state = septemberPaidState();
  assert.equal(billOf(state, '2026-10'), undefined, 'precondition: no October bill yet');

  const res = changeCustomerPackage(state, 'seed-001', '5mbps-200gb', OCT_03);
  assert.equal(res.changed, true);
  assert.equal(res.billCreated, true);
  assert.equal(res.billRepriced, false);
  assert.equal(res.month, '2026-10');

  const customer = res.nextState.customers[0];
  assert.equal(customer.packageSpeed, '5Mbps / 200GB');
  assert.equal(customer.monthlySellingAmount, 2000);
  assert.equal(Number(billOf(res.nextState, '2026-10').dueAmount), 2000);
  assert.equal(res.balanceDue, 2000);

  // Last month is history: its bill is never repriced.
  assert.equal(Number(billOf(res.nextState, '2026-09').dueAmount), 1000);
  assert.equal(balanceOf(res.nextState, '2026-09'), 0);

  // The audit trail is the profile's own packageHistory mechanism.
  const entry = customer.packageHistory.at(-1);
  assert.equal(entry.oldPackage, '3Mbps / 100GB');
  assert.equal(entry.newPackage, '5Mbps / 200GB');
  assert.equal(entry.oldMonthlyRate, 1000);
  assert.equal(entry.newMonthlyRate, 2000);
  assert.equal(entry.staffName, 'Quick Collect');

  // The collect form's defaults reflect the new dues without a reload.
  const defaults = getCustomerPaymentDefaults(res.nextState, 'seed-001', OCT_03);
  assert.equal(defaults.totalDues, 2000);
  assert.equal(defaults.suggestedAmount, 2000);

  // Collect 2,000 in the same flow -> settled.
  const collected = executeQuickCollection(res.nextState, {
    customerId: 'seed-001', month: '2026-10', amount: 2000, date: '2026-10-03', method: 'Cash'
  }, OCT_03);
  assert.equal(balanceOf(collected.nextState, '2026-10'), 0);
  assert.equal(derivedBillStatus(collected.nextState.customers[0], billOf(collected.nextState, '2026-10')), 'paid');

  // And the new package carries forward: November bills at 2,000 too.
  const november = generateMonthlyBillsThroughCurrentMonth(collected.nextState, NOV_02);
  assert.equal(Number(billOf(november, '2026-11').dueAmount), 2000);
});

test('owner example, bill already generated unpaid: October bill is repriced to 2,000 with an amountHistory audit', () => {
  let state = septemberPaidState();
  state = generateMonthlyBillsThroughCurrentMonth(state, OCT_03);
  const before = billOf(state, '2026-10');
  assert.equal(Number(before.dueAmount), 1000, 'precondition: October billed at the old package');
  const historyLength = (before.amountHistory ?? []).length;

  const res = changeCustomerPackage(state, 'seed-001', '5mbps-200gb', OCT_10);
  assert.equal(res.changed, true);
  assert.equal(res.billRepriced, true);
  assert.equal(res.billCreated, false);

  const bill = billOf(res.nextState, '2026-10');
  assert.equal(Number(bill.dueAmount), 2000);
  assert.equal(res.balanceDue, 2000);
  // The bill now carries the new package snapshot, and the reprice is
  // audited in the bill's own amountHistory (saveBillMonth's shape).
  assert.equal(bill.packageSnapshot?.packageId, '5mbps-200gb');
  assert.equal(bill.amountHistory.length, historyLength + 1);
  const audit = bill.amountHistory.at(-1);
  assert.equal(Number(audit.previousAmount), 1000);
  assert.equal(Number(audit.newAmount), 2000);
});

test('already paid in full at the old price: change to 2,000 leaves exactly 1,000 due, then collects to settled', () => {
  let state = septemberPaidState();
  state = generateMonthlyBillsThroughCurrentMonth(state, OCT_03);
  state = addPayment(state, 'seed-001', '2026-10', { date: '2026-10-05', amount: 1000, method: 'Cash' }, OCT_10);
  assert.equal(balanceOf(state, '2026-10'), 0, 'precondition: October fully paid at 1,000');

  const res = changeCustomerPackage(state, 'seed-001', '5mbps-200gb', OCT_12);
  assert.equal(Number(billOf(res.nextState, '2026-10').dueAmount), 2000);
  assert.equal(res.balanceDue, 1000);
  // The recorded payment stays recorded — nothing was rewritten.
  assert.equal(billOf(res.nextState, '2026-10').payments.length, 1);
  assert.equal(derivedBillStatus(res.nextState.customers[0], billOf(res.nextState, '2026-10')), 'partial');

  const collected = executeQuickCollection(res.nextState, {
    customerId: 'seed-001', month: '2026-10', amount: 1000, date: '2026-10-12', method: 'Cash'
  }, OCT_12);
  assert.equal(balanceOf(collected.nextState, '2026-10'), 0);
  assert.equal(derivedBillStatus(collected.nextState.customers[0], billOf(collected.nextState, '2026-10')), 'paid');
});

test('downgrade after partial payment: bill drops to 1,000 and the overpaid 500 stays as pending credit', () => {
  let state = createInitialState(['Downgrade Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '5Mbps / 200GB', monthlySellingAmount: 2000
  }, SEP_05);
  state = generateMonthlyBillsThroughCurrentMonth(state, OCT_03);
  state = addPayment(state, 'seed-001', '2026-10', { date: '2026-10-05', amount: 1500, method: 'Cash' }, OCT_10);
  assert.equal(balanceOf(state, '2026-10'), 500, 'precondition: 500 still due on the 2,000 bill');

  const res = changeCustomerPackage(state, 'seed-001', '3mbps-100gb', OCT_12);
  assert.equal(Number(billOf(res.nextState, '2026-10').dueAmount), 1000);
  assert.equal(res.balanceDue, 0);

  // Engine truth: the 1,500 receipt applied 1,000 to the smaller bill,
  // and the remaining 500 is unapplied pending credit — not lost, not
  // double-counted.
  const allocations = calculatePaymentAllocations(res.nextState);
  const payment = billOf(res.nextState, '2026-10').payments[0];
  const ledger = allocations.byPaymentId.get(payment.id);
  assert.equal(ledger.unappliedCreditCents, 50000);
  assert.equal(derivedBillStatus(res.nextState.customers[0], billOf(res.nextState, '2026-10')), 'paid');
});

test('kist already billed into the month is preserved on top of the new package fee', () => {
  let state = septemberPaidState();
  state = generateMonthlyBillsThroughCurrentMonth(state, OCT_03);
  // Shape the October bill the way the SISP-2 cycle leaves it when a
  // 500 kist rides it: dueAmount = package 1,000 + kist 500.
  state = {
    ...state,
    customers: state.customers.map(c => ({
      ...c,
      bills: c.bills.map(b => b.month === '2026-10' ? { ...b, dueAmount: 1500, kistTotal: 500 } : b)
    }))
  };
  assert.equal(balanceOf(state, '2026-10'), 1500, 'precondition: 1,000 package + 500 kist due');

  const res = changeCustomerPackage(state, 'seed-001', '5mbps-200gb', OCT_10);
  assert.equal(Number(billOf(res.nextState, '2026-10').dueAmount), 2500, 'new fee 2,000 + preserved kist 500');
  assert.equal(Number(billOf(res.nextState, '2026-10').kistTotal), 500);
  assert.equal(res.balanceDue, 2500);
});

test('FREE connection: the plan change is recorded but no bill and no dues are ever created', () => {
  let state = addCustomer(createInitialState([]), 'Free Tester', SEP_05, { isFreeConnection: true });
  const id = state.customers[0].id;
  state = updateCustomerProfile(state, id, {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, SEP_05);
  state = generateMonthlyBillsThroughCurrentMonth(state, OCT_03);
  assert.equal(state.customers[0].bills.length, 0, 'precondition: a free connection has no bills');

  const res = changeCustomerPackage(state, id, '5mbps-200gb', OCT_10);
  assert.equal(res.changed, true);
  assert.equal(res.billSkipped, 'free-connection');
  const customer = res.nextState.customers[0];
  assert.equal(customer.packageSpeed, '5Mbps / 200GB');
  assert.equal(customer.bills.length, 0, 'no bill was created by the package change');
  assert.equal(getCustomerPaymentDefaults(res.nextState, id, OCT_10).totalDues, 0);
  assert.ok(customer.packageHistory.length >= 1, 'the plan change is still audited');
});

test('billing-paused month stays at zero: no bill is created or repriced while paused', () => {
  let state = septemberPaidState();
  state = updateCustomerProfile(state, 'seed-001', { paused: true, pauseStartDate: '2026-10-01' }, OCT_03);
  assert.equal(isBillingPaused(state.customers[0], '2026-10'), true, 'precondition: October is a paused month');

  const res = changeCustomerPackage(state, 'seed-001', '5mbps-200gb', OCT_10);
  assert.equal(res.changed, true);
  assert.equal(res.billSkipped, 'paused');
  assert.equal(billOf(res.nextState, '2026-10'), undefined, 'no October bill exists');
  assert.equal(res.balanceDue, null);

  // Even the regular auto-generator afterwards leaves October unbilled.
  const after = generateMonthlyBillsThroughCurrentMonth(res.nextState, OCT_10);
  assert.equal(billOf(after, '2026-10'), undefined);
  assert.equal(getCustomerPaymentDefaults(after, 'seed-001', OCT_10).totalDues, 0);
});

test('same package is a strict no-op; unknown package and archived customer throw', () => {
  const state = septemberCustomer();
  const historyLength = state.customers[0].packageHistory.length;
  const res = changeCustomerPackage(state, 'seed-001', '3mbps-100gb', OCT_03);
  assert.equal(res.changed, false);
  assert.equal(res.reason, 'same-package');
  assert.equal(res.nextState, state, 'state returned untouched (same reference)');
  assert.equal(res.nextState.customers[0].packageHistory.length, historyLength, 'no duplicate audit entry');

  assert.throws(() => changeCustomerPackage(state, 'seed-001', 'no-such-package', OCT_03), /available packages/);
  assert.throws(() => changeCustomerPackage(state, 'missing-id', '5mbps-200gb', OCT_03), /Customer not found/);

  const archived = {
    ...state,
    customers: state.customers.map(c => ({ ...c, archived: true }))
  };
  assert.throws(() => changeCustomerPackage(archived, 'seed-001', '5mbps-200gb', OCT_03), /Archived customers cannot change package/);
});

test('i18n: every Change Package string exists in both dictionaries with its params', () => {
  const keys = [
    'qcpkg_label', 'qcpkg_current', 'qcpkg_none', 'qcpkg_fee_not_set', 'qcpkg_pick',
    'qcpkg_change_btn', 'qcpkg_same', 'qcpkg_done', 'qcpkg_done_nobill',
    'qcpkg_free_note', 'qcpkg_paused_note', 'qcpkg_undo'
  ];
  for (const key of keys) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
  }
  for (const param of ['{label}', '{amount}']) {
    assert.ok(TRANSLATIONS.en.qcpkg_current.includes(param), `en qcpkg_current missing ${param}`);
    assert.ok(TRANSLATIONS.ur.qcpkg_current.includes(param), `ur qcpkg_current missing ${param}`);
  }
  for (const param of ['{label}', '{month}', '{amount}', '{due}']) {
    assert.ok(TRANSLATIONS.en.qcpkg_done.includes(param), `en qcpkg_done missing ${param}`);
    assert.ok(TRANSLATIONS.ur.qcpkg_done.includes(param), `ur qcpkg_done missing ${param}`);
  }
});

test('controller (mock DOM): the payment step renders the package row, one tap reprices and re-renders, Undo restores', async () => {
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

  // --- minimal DOM stub (the daily-closing redesign test's pattern) ---
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
  // The package box gets a working select + apply button behind its
  // querySelector, exactly the two nodes renderPackageBox wires.
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
  try {
    const toasts = [];
    const controller = setupQuickCollectModal({
      getState: () => state,
      onSaveState: (next) => { state = next; },
      onToast: (msg, opts) => toasts.push({ msg, opts }),
      onSelectCustomer: () => {},
      onEditCustomer: () => {}
    });
    controller.open('seed-001');

    // The form re-rendered around the package row: current package is
    // shown and every catalogue package is offered.
    assert.ok(packageBox.innerHTML.includes('3Mbps / 100GB'), 'current package label rendered');
    assert.ok(packageBox.innerHTML.includes('5mbps-200gb'), 'catalogue options rendered');
    assert.equal(getEl('quickCollectAmountInput').value, '1000.00', 'amount starts at the old dues');

    // Pick the 2,000 package -> the apply button arms.
    pkgSelect.value = '5mbps-200gb';
    await pkgSelect.dispatch('change');
    assert.equal(pkgApply.disabled, false, 'apply arms once a different package is picked');

    // One tap: state saved through the host, the bill repriced, and the
    // still-open form now shows the new dues.
    await pkgApply.click();
    assert.equal(Number(billOf(state, month).dueAmount), 2000, 'bill repriced via the host save');
    assert.equal(getEl('quickCollectAmountInput').value, '2000.00', 'amount re-rendered at the new dues');
    const done = toasts.find(t => t.msg.includes('5Mbps / 200GB'));
    assert.ok(done, 'success toast names the new package');
    assert.equal(typeof done.opts?.onAction, 'function', 'toast carries the Undo action');

    // Undo restores the exact pre-change state.
    done.opts.onAction();
    assert.equal(Number(billOf(state, month).dueAmount), 1000, 'undo restored the old bill');
    assert.equal(state.customers[0].packageSpeed, '3Mbps / 100GB', 'undo restored the old package');
  } finally {
    globalThis.document = origDocument;
  }
});

test('wiring: host div, controller render + handler, and token CSS are in place', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="quickCollectPackageBox"'), 'host div exists in the Quick Collect form step');
  const qc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.ok(qc.includes('export function changeCustomerPackage'), 'pure change function exported');
  assert.ok(qc.includes('renderPackageBox(customerId)'), 'form render calls the package box');
  assert.ok(qc.includes("getElementById('quickCollectPackageBox')"), 'controller grabs the host');
  assert.ok(qc.includes('data-qc-change-package'), 'apply button hook present');
  assert.ok(qc.includes("packageChangeStaffName: 'Quick Collect'"), 'audit staff label recorded');
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const boxRule = css.match(/\.qc-package-box \{[^}]*\}/);
  assert.ok(boxRule, 'qc-package-box rule exists');
  assert.ok(!/#[0-9a-fA-F]{3,8}/.test(boxRule[0]), 'qc-package-box uses theme tokens, no hex');
});
