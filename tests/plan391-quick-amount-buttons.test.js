// Plan 391 — Transaction quick amount buttons on the entry form:
// one row of buttons that fills the amount field with the figure
// the button names — full dues, the package price, Rs 500,
// Rs 1,000 — and posts nothing. A button fills only, and the
// operator can change the filled amount freely afterwards.
//
// The row already carried full balance, current month, 50%, and
// the round figures 1,000 / 1,500 / 2,000. This plan adds only
// what was missing: the package price and Rs 500.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  packagePriceForCustomer,
  resolveQuickAmount,
  packageChipLabel,
} from '../quick-amount-buttons.js';
import { BILL_PACKAGES } from '../package-catalog.js';
import {
  addPayment,
  createInitialState,
  updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth,
  calculatePaymentAllocations,
} from '../core.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const moduleSrc = fs.readFileSync(path.join(ROOT, '../quick-amount-buttons.js'), 'utf8');
const navSrc = fs.readFileSync(path.join(ROOT, '../nav-quick-collect.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(ROOT, '../index.html'), 'utf8');
const testSrc = fs.readFileSync(path.join(ROOT, 'plan391-quick-amount-buttons.test.js'), 'utf8');

const NOV_6 = new Date(2026, 10, 6, 12);
const SEP_5 = new Date(2026, 8, 5, 12);

// Three open bills at PKR 3,000 each: total dues PKR 9,000, and the
// customer is on the PKR 3,000 monthly selling amount.
function stateWithBills(referenceDate) {
  let state = createInitialState(['Customer One']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '3000' }, SEP_5);
  state.customers[0].billingStartMonth = '2026-09';
  return generateMonthlyBillsThroughCurrentMonth(state, referenceDate);
}

function totalDues(state) {
  const allocations = calculatePaymentAllocations(state);
  const customer = state.customers.find((c) => c.id === 'seed-001');
  let dues = 0;
  for (const bill of (customer.bills ?? [])) {
    const remaining = allocations.forMonth(customer.id, bill.month)?.balanceDueCents ?? 0;
    if (remaining > 0) dues += remaining;
  }
  return dues / 100;
}

// A small catalogue shaped like the real one, so the module tests
// never depend on the live catalogue prices.
const CATALOGUE = [
  { id: '3mbps-100gb', label: '3Mbps / 100GB', price: 1000 },
  { id: '5mbps-200gb', label: '5Mbps / 200GB', price: 2000 },
  { id: '15mbps-unlimited', label: '15Mbps Unlimited', price: 3000 },
];

// ---- Module units: the package price ----

test('Plan 391: the selling amount wins over the catalogue price', () => {
  const customer = { monthlySellingAmount: '2500', packageSpeed: '5Mbps / 200GB' };
  assert.equal(packagePriceForCustomer(customer, CATALOGUE), 2500);
  assert.equal(packagePriceForCustomer({ monthlySellingAmount: 1600 }, CATALOGUE), 1600);
});

test('Plan 391: without a selling amount the catalogue price of the package applies', () => {
  assert.equal(packagePriceForCustomer({ packageSpeed: '5Mbps / 200GB' }, CATALOGUE), 2000);
  assert.equal(packagePriceForCustomer({ packageSpeed: '15Mbps Unlimited' }, CATALOGUE), 3000);
  // Matched by id as well as by label, case- and space-insensitively.
  assert.equal(packagePriceForCustomer({ packageSpeed: '5mbps-200gb' }, CATALOGUE), 2000);
  assert.equal(packagePriceForCustomer({ packageSpeed: '  5Mbps/200GB ' }, CATALOGUE), 2000);
});

test('Plan 391: no selling amount and no catalogue match means no package price', () => {
  assert.equal(packagePriceForCustomer({ packageSpeed: '9Mbps / 999GB' }, CATALOGUE), null);
  assert.equal(packagePriceForCustomer({}, CATALOGUE), null);
  assert.equal(packagePriceForCustomer({ packageSpeed: '' }, CATALOGUE), null);
  assert.equal(packagePriceForCustomer(null, CATALOGUE), null);
  assert.equal(packagePriceForCustomer({ packageSpeed: '5Mbps / 200GB' }, []), null);
  assert.equal(packagePriceForCustomer({ packageSpeed: '5Mbps / 200GB' }, null), null);
});

test('Plan 391: a zero, negative, blank, or non-numeric selling amount is never a price', () => {
  for (const bad of [0, '0', -500, '', '   ', 'free', true, null, undefined]) {
    assert.equal(
      packagePriceForCustomer({ monthlySellingAmount: bad, packageSpeed: '5Mbps / 200GB' }, CATALOGUE),
      2000,
      `selling amount ${JSON.stringify(bad)} must fall through to the catalogue`,
    );
  }
  // And a bad selling amount with no catalogue match invents nothing.
  for (const bad of [0, '', 'free', true]) {
    assert.equal(packagePriceForCustomer({ monthlySellingAmount: bad }, CATALOGUE), null);
  }
});

test('Plan 391: the real catalogue prices the fixture customer at PKR 3,000', () => {
  const state = stateWithBills(NOV_6);
  const customer = state.customers.find((c) => c.id === 'seed-001');
  assert.equal(packagePriceForCustomer(customer, BILL_PACKAGES), 3000);
});

// ---- Module units: resolving a button to a fill amount ----

test('Plan 391: full resolves to the full dues', () => {
  assert.equal(resolveQuickAmount('full', { fullDues: 9000 }), 9000);
  assert.equal(resolveQuickAmount('full', { fullDues: '9000' }), 9000);
  assert.equal(resolveQuickAmount('full', { fullDues: 0 }), null);
  assert.equal(resolveQuickAmount('full', {}), null);
  assert.equal(resolveQuickAmount('full', { fullDues: -100 }), null);
});

test('Plan 391: package resolves to the package price', () => {
  assert.equal(resolveQuickAmount('package', { packagePrice: 3000 }), 3000);
  assert.equal(resolveQuickAmount('package', { packagePrice: '2000' }), 2000);
  assert.equal(resolveQuickAmount('package', { packagePrice: null }), null);
  assert.equal(resolveQuickAmount('package', {}), null);
  assert.equal(resolveQuickAmount('package', { packagePrice: 0 }), null);
});

test('Plan 391: a plain number names the round figure itself', () => {
  assert.equal(resolveQuickAmount('500', {}), 500);
  assert.equal(resolveQuickAmount('1000', {}), 1000);
  assert.equal(resolveQuickAmount('1500', {}), 1500);
  assert.equal(resolveQuickAmount('0', {}), null);
  assert.equal(resolveQuickAmount('-500', {}), null);
});

test('Plan 391: any other button type resolves to nothing', () => {
  assert.equal(resolveQuickAmount('current', { fullDues: 9000 }), null);
  assert.equal(resolveQuickAmount('half', { fullDues: 9000 }), null);
  assert.equal(resolveQuickAmount('', {}), null);
  assert.equal(resolveQuickAmount(null, {}), null);
  assert.equal(resolveQuickAmount(undefined, {}), null);
});

test('Plan 391: resolving never mutates the figures it was given', () => {
  const figures = { fullDues: 9000, packagePrice: 3000 };
  resolveQuickAmount('full', figures);
  resolveQuickAmount('package', figures);
  assert.deepEqual(figures, { fullDues: 9000, packagePrice: 3000 });
});

// ---- Module units: the package chip label ----

test('Plan 391: the package chip shows its price when known, plain words when not', () => {
  assert.equal(packageChipLabel(2000), 'Package (Rs 2,000)');
  assert.equal(packageChipLabel(3000), 'Package (Rs 3,000)');
  assert.equal(packageChipLabel('1500'), 'Package (Rs 1,500)');
  assert.equal(packageChipLabel(null), 'Package price');
  assert.equal(packageChipLabel(0), 'Package price');
  assert.equal(packageChipLabel(''), 'Package price');
});

// ---- Acceptance: each button fills the figure it names ----

test('Plan 391: acceptance — all four buttons fill their figure on the same fixture', () => {
  const state = stateWithBills(NOV_6);
  const customer = state.customers.find((c) => c.id === 'seed-001');
  const figures = {
    fullDues: totalDues(state),
    packagePrice: packagePriceForCustomer(customer, BILL_PACKAGES),
  };
  assert.equal(figures.fullDues, 9000);
  assert.equal(figures.packagePrice, 3000);
  assert.equal(resolveQuickAmount('full', figures), 9000);
  assert.equal(resolveQuickAmount('package', figures), 3000);
  assert.equal(resolveQuickAmount('500', figures), 500);
  assert.equal(resolveQuickAmount('1000', figures), 1000);
});

test('Plan 391: acceptance — a part-paid customer fills the smaller full dues, not the old total', () => {
  let state = stateWithBills(NOV_6);
  state = addPayment(state, 'seed-001', '2026-09', { amount: 3000, date: '2026-09-05', method: 'Cash' }, NOV_6);
  const customer = state.customers.find((c) => c.id === 'seed-001');
  const figures = {
    fullDues: totalDues(state),
    packagePrice: packagePriceForCustomer(customer, BILL_PACKAGES),
  };
  assert.equal(figures.fullDues, 6000);
  assert.equal(resolveQuickAmount('full', figures), 6000);
  // The package price does not move with the dues.
  assert.equal(resolveQuickAmount('package', figures), 3000);
});

test('Plan 391: acceptance — the package button fills nothing when the price is unknown', () => {
  const customer = { packageSpeed: '9Mbps / 999GB' };
  const price = packagePriceForCustomer(customer, CATALOGUE);
  assert.equal(price, null);
  assert.equal(resolveQuickAmount('package', { packagePrice: price }), null);
  assert.equal(packageChipLabel(price), 'Package price');
});

// ---- Wiring: the entry form carries the four buttons ----

test('Plan 391: the entry form carries full, package, 500, and 1,000 buttons', () => {
  const rowAt = indexSrc.indexOf('qc-quick-amount-chips');
  assert.ok(rowAt > 0, 'the quick-amount row must exist');
  const row = indexSrc.slice(rowAt, indexSrc.indexOf('</div>', rowAt));
  for (const type of ['full', 'package', '500', '1000']) {
    assert.ok(row.includes(`data-quick-amount="${type}"`), `missing ${type} button`);
  }
  // The buttons sit in the spec order: full dues, package price,
  // then the round figures — 500 before 1,000.
  const order = ['full', 'package', '500', '1000'].map((type) => row.indexOf(`data-quick-amount="${type}"`));
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'buttons must read full, package, 500, 1,000');
  // The earlier buttons are untouched: current month, 50%, 1,500, 2,000.
  for (const type of ['current', 'half', '1500', '2000']) {
    assert.ok(row.includes(`data-quick-amount="${type}"`), `existing ${type} button must stay`);
  }
});

test('Plan 391: every quick amount button is a fill-only button, never a submit', () => {
  const rowAt = indexSrc.indexOf('qc-quick-amount-chips');
  const row = indexSrc.slice(rowAt, indexSrc.indexOf('</div>', rowAt));
  const buttons = row.match(/<button[^>]*class="quick-amount-chip"[^>]*>/g) || [];
  assert.ok(buttons.length >= 8, `expected the full row of buttons, found ${buttons.length}`);
  for (const button of buttons) {
    assert.ok(button.includes('type="button"'), `chip must be type="button": ${button}`);
  }
  assert.ok(!row.includes('type="submit"'), 'no chip may submit the form');
});

test('Plan 391: the package and 500 buttons reuse the existing chip class — no new style', () => {
  const rowAt = indexSrc.indexOf('qc-quick-amount-chips');
  const row = indexSrc.slice(rowAt, indexSrc.indexOf('</div>', rowAt));
  assert.ok(row.includes('class="quick-amount-chip" data-quick-amount="package"'));
  assert.ok(row.includes('class="quick-amount-chip" data-quick-amount="500"'));
});

// ---- Wiring: the collector wires the new buttons ----

test('Plan 391: the collector imports the module', () => {
  assert.ok(navSrc.includes("import { packagePriceForCustomer, resolveQuickAmount, packageChipLabel } from './quick-amount-buttons.js';"));
});

test('Plan 391: the chip labels refresh with the package price on open', () => {
  const labelBlock = navSrc.slice(navSrc.indexOf('// Update quick amount chips dynamic amounts'));
  assert.ok(labelBlock.includes('packagePriceForCustomer(activeDefaults.customer, BILL_PACKAGES)'));
  assert.ok(labelBlock.includes("chip.textContent = packageChipLabel(packagePrice);"));
});

test('Plan 391: the chip tap fills the package price, and fills nothing when it is unknown', () => {
  const handler = navSrc.slice(navSrc.indexOf('// Wire quick amount helper chips'));
  assert.ok(handler.includes("} else if (type === 'package') {"));
  assert.ok(handler.includes("resolveQuickAmount('package', { packagePrice: packagePriceForCustomer(activeDefaults.customer, BILL_PACKAGES) })"));
  assert.ok(handler.includes('if (price !== null) {'));
  assert.ok(handler.includes('amountInput.value = price.toFixed(2);'));
});

test('Plan 391: the 500 button needs no new branch — the numeric branch already fills it', () => {
  const handler = navSrc.slice(navSrc.indexOf('// Wire quick amount helper chips'));
  assert.ok(handler.includes('const val = Number(type);'));
  assert.ok(handler.includes('amountInput.value = val.toFixed(2);'));
  assert.equal(resolveQuickAmount('500', {}), 500);
});

test('Plan 391: a chip tap never posts the payment', () => {
  const handler = navSrc.slice(
    navSrc.indexOf('// Wire quick amount helper chips'),
    navSrc.indexOf('// SISP-116: a loose-change chip tap'),
  );
  for (const banned of ['executeQuickCollection', 'requestSubmit', '.submit(', 'addPayment(', 'correctPayment(']) {
    assert.ok(!handler.includes(banned), `chip handler must not contain ${banned}`);
  }
  // The tap only writes the amount field, then refreshes the live
  // lines — the same lines a typed amount refreshes.
  assert.ok(handler.includes('amountInput.value ='));
  assert.ok(handler.includes('renderAmountWordsLine();'));
  assert.ok(handler.includes('renderSettlementPreview();'));
  assert.ok(handler.includes('renderOverpaymentChoice();'));
  assert.ok(handler.includes('renderUnderpaymentWarning();'));
});

test('Plan 391: the filled amount stays editable — the tap never locks the field', () => {
  const handler = navSrc.slice(
    navSrc.indexOf('// Wire quick amount helper chips'),
    navSrc.indexOf('// SISP-116: a loose-change chip tap'),
  );
  assert.ok(!handler.includes('amountInput.readOnly'), 'chip tap must not lock the amount field');
  assert.ok(!handler.includes('amountInput.disabled'), 'chip tap must not disable the amount field');
  assert.ok(handler.includes('amountInput.focus();'), 'the field keeps focus so the operator can edit it');
});

test('Plan 391: the package tap refreshes the live lines like any other chip tap', () => {
  const handler = navSrc.slice(navSrc.indexOf('// Wire quick amount helper chips'));
  const packageAt = handler.indexOf("} else if (type === 'package') {");
  assert.ok(packageAt > 0, 'package branch must exist');
  const tail = handler.slice(packageAt);
  assert.ok(tail.indexOf('renderAmountWordsLine();') > 0, 'words refresh after the package fill');
  assert.ok(tail.indexOf('renderSettlementPreview();') > 0, 'preview refreshes after the package fill');
  assert.ok(tail.indexOf('renderUnderpaymentWarning();') > 0, 'warning refreshes after the package fill');
});

// ---- Guards ----

test('Plan 391: the module is pure — no page, storage, clock, network, or store', () => {
  for (const banned of ['document.', 'localStorage', 'new Date(', 'Date.now(', 'fetch(', 'import ', 'shahdara_', 'window.']) {
    assert.ok(!moduleSrc.includes(banned), `module must not contain ${banned}`);
  }
  assert.ok(!/\bOLT\b/.test(moduleSrc), 'module must not contain the standalone word OLT');
  // Exactly the three intended exports, no more.
  const exports = moduleSrc.match(/^export function \w+/gm) || [];
  assert.deepEqual(exports, [
    'export function packagePriceForCustomer',
    'export function resolveQuickAmount',
    'export function packageChipLabel',
  ]);
});

test('Plan 391: the module never names a fenced neighbour', () => {
  // Fragment-built so this test itself never spells the fenced names.
  const fenced = [
    'loose-change-' + 'credit.js',
    'package-' + 'catalog.js',
    'amount-in-' + 'words.js',
    'partial-settlement-' + 'preview.js',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
  }
});

test('Plan 391: fixtures are generic — no real customer name in the module or test', () => {
  // Fragment-built so this test itself never spells the real names.
  const real = ['Ki' + 'ran', 'Bi' + 'lal', 'Hai' + 'der', 'Shu' + 'naid', 'Kha' + 'zer', 'Moh' + 'sin', 'Shar' + 'jell', 'No' + 'mi', 'Sa' + 'ad'];
  for (const name of real) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
    assert.ok(!testSrc.includes(name), `test must not name ${name}`);
  }
});
