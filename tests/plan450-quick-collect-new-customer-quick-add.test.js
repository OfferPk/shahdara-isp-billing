// Plan 450 — Quick Collect new-customer quick add: a brand-new
// customer who walks in ready to pay is added from the picker
// itself — name, phone number, mohalla, package — and the payment
// form opens for them straight away. The quick-add creates the
// customer only: it never opens, reads, or changes the full
// onboarding checklist, and it never changes any bill, payment,
// or other customer record by itself. A quick-add with no name,
// no number, or no mohalla is refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  QUICK_ADD_FIELD_IDS,
  formatQuickAddAmount,
  validateQuickAddCustomer,
  quickAddCustomer,
  quickAddCustomerSummaryText,
  quickAddFormFieldsHtml,
} from '../quick-collect-new-customer-quick-add.js';
import {
  createInitialState,
  updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth,
  calculatePaymentAllocations,
} from '../core.js';
import { BILL_PACKAGES } from '../package-catalog.js';
import {
  executeQuickCollection,
  getPendingCollectionCustomers,
} from '../nav-quick-collect.js';

const moduleSrc = readFileSync(new URL('../quick-collect-new-customer-quick-add.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const NOV_7 = new Date(2026, 10, 7, 12);
// Pattern-fake number only (the PII ratchet's allowed family).
const FAKE_PHONE = '03012345678';

function input(overrides = {}) {
  return {
    name: 'New Counter Customer',
    phone: FAKE_PHONE,
    mohalla: 'CHARYAA',
    packageId: '5mbps-150gb',
    ...overrides,
  };
}

function emptyState() {
  return createInitialState([]);
}

/** One existing customer with a PKR 2,000 bill for November 2026. */
function existingCustomerState() {
  let state = createInitialState(['Existing Customer']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: 2000 }, NOV_7);
  state = generateMonthlyBillsThroughCurrentMonth(state, NOV_7);
  return state;
}

// --- Validation: name ---

test('name: empty, whitespace-only, one character, or over 100 characters is refused', () => {
  for (const bad of ['', '   ', 'A', 'x'.repeat(101)]) {
    const { errors } = validateQuickAddCustomer(input({ name: bad }));
    assert.ok(errors.name, `name ${JSON.stringify(bad)} must be refused`);
  }
});

test('name: surrounding and repeated spaces are cleaned to one', () => {
  const { values, errors } = validateQuickAddCustomer(input({ name: '  Bilal   Ahmed  ' }));
  assert.deepEqual(errors, {});
  assert.equal(values.name, 'Bilal Ahmed');
});

// --- Validation: phone ---

test('phone: missing number is refused', () => {
  for (const bad of ['', '   ']) {
    const { errors } = validateQuickAddCustomer(input({ phone: bad }));
    assert.equal(errors.phone, 'Phone number is required.');
  }
});

test('phone: an incomplete number is refused, not warned through', () => {
  // The validator returns a tip-only result for '03012' and the
  // full form lets tips through — the quick-add does not, because
  // a half-typed number can never receive a receipt or a follow-up.
  const { errors } = validateQuickAddCustomer(input({ phone: '03012' }));
  assert.ok(errors.phone, 'an incomplete number must be refused');
});

test('phone: letters are refused; local and international Pakistani numbers pass', () => {
  assert.ok(validateQuickAddCustomer(input({ phone: '03012abc' })).errors.phone);
  assert.deepEqual(validateQuickAddCustomer(input({ phone: '03012345678' })).errors, {});
  assert.deepEqual(validateQuickAddCustomer(input({ phone: '+923012345678' })).errors, {});
});

test('phone: over 40 characters is refused', () => {
  const { errors } = validateQuickAddCustomer(input({ phone: '+92 301 1234567 89012345678901234567890' }));
  assert.ok(errors.phone);
});

// --- Validation: mohalla ---

test('mohalla: missing mohalla is refused', () => {
  for (const bad of ['', '   ']) {
    const { errors } = validateQuickAddCustomer(input({ mohalla: bad }));
    assert.equal(errors.mohalla, 'Mohalla is required.');
  }
});

test('mohalla: over 100 characters is refused', () => {
  const { errors } = validateQuickAddCustomer(input({ mohalla: 'x'.repeat(101) }));
  assert.ok(errors.mohalla);
});

test('mohalla: a known mohalla is stored canonical, an unknown one as typed', () => {
  // Home Dashboard Part 4: 'charyaa' is a stored variant of the
  // same mohalla as CHAMYAAA, so the canonical stored spelling is
  // CHAMYAAA now — the alias fold, not the raw default-list match.
  assert.equal(validateQuickAddCustomer(input({ mohalla: 'charyaa' })).values.mohalla, 'CHAMYAAA');
  assert.equal(validateQuickAddCustomer(input({ mohalla: 'New Area' })).values.mohalla, 'New Area');
});

// --- Validation: package ---

test('package: blank means no package yet; an unknown id is refused', () => {
  const blank = validateQuickAddCustomer(input({ packageId: '' }));
  assert.deepEqual(blank.errors, {});
  assert.equal(blank.values.package, null);
  assert.equal(validateQuickAddCustomer(input({ packageId: 'no-such-package' })).errors.package, 'Choose one of the available packages.');
});

test('package: a catalogue id resolves to its label and price', () => {
  const { values, errors } = validateQuickAddCustomer(input({ packageId: '15mbps-unlimited' }));
  assert.deepEqual(errors, {});
  assert.equal(values.package.label, '15Mbps Unlimited');
  assert.equal(values.package.price, 3000);
});

// --- Creation: with a package ---

test('create: all four fields make the customer with exactly those details and this month bill', () => {
  const before = emptyState();
  const result = quickAddCustomer(before, input(), NOV_7);
  assert.equal(result.ok, true);
  assert.equal(result.package.label, '5Mbps / 150GB');
  const customer = result.customer;
  assert.equal(customer.name, 'New Counter Customer');
  assert.equal(customer.phone, FAKE_PHONE);
  assert.equal(customer.mohalla, 'CHAMYAAA', 'input CHARYAA stores canonical');
  assert.equal(customer.customerNumber, 1);
  assert.equal(customer.packageSpeed, '5Mbps / 150GB');
  assert.equal(customer.monthlySellingAmount, 1500);
  assert.equal(customer.bills.length, 1);
  assert.equal(customer.bills[0].month, '2026-11');
  assert.equal(customer.bills[0].dueAmount, 1500);
  assert.equal(customer.bills[0].status, 'pending');
  assert.equal(result.billed, customer.bills[0]);
  // The input state is untouched: the creation returns a new state.
  assert.equal(before.customers.length, 0);
  assert.equal(result.nextState.customers.length, 1);
});

test('create: the new customer appears in the picker with their dues', () => {
  const result = quickAddCustomer(emptyState(), input(), NOV_7);
  const listed = getPendingCollectionCustomers(result.nextState, '', 'all-dues');
  assert.equal(listed.length, 1);
  assert.equal(listed[0].name, 'New Counter Customer');
  assert.equal(listed[0].area, 'CHAMYAAA', 'picker shows the canonical mohalla');
  assert.equal(listed[0].phone, FAKE_PHONE);
  assert.equal(listed[0].totalDues, 1500);
  const byName = getPendingCollectionCustomers(result.nextState, 'New Counter', 'all');
  assert.equal(byName.length, 1);
  assert.equal(byName[0].id, result.customer.id);
});

test('create: the payment records against the quick-added customer normally', () => {
  const added = quickAddCustomer(emptyState(), input(), NOV_7);
  const paid = executeQuickCollection(added.nextState, {
    customerId: added.customer.id, month: '2026-11', amount: 1500, date: '2026-11-07', method: 'Cash',
  }, NOV_7);
  assert.equal(paid.receipt.amount, 1500);
  assert.equal(paid.receipt.customerId, added.customer.id);
  const allocations = calculatePaymentAllocations(paid.nextState);
  assert.equal(allocations.forMonth(added.customer.id, '2026-11').balanceDueCents, 0);
});

// --- Creation: without a package ---

test('create: no package means no bill and no fee — the operator types the amount', () => {
  const result = quickAddCustomer(emptyState(), input({ packageId: '' }), NOV_7);
  assert.equal(result.ok, true);
  assert.equal(result.package, null);
  assert.equal(result.billed, null);
  assert.equal(result.customer.packageSpeed, '');
  assert.equal(result.customer.monthlySellingAmount, null);
  assert.deepEqual(result.customer.bills, []);
});

// --- Refusals create nothing ---

test('refusal: no name, no number, or no mohalla creates nothing', () => {
  for (const bad of [{ name: '' }, { phone: '' }, { mohalla: '' }]) {
    const before = emptyState();
    const result = quickAddCustomer(before, input(bad), NOV_7);
    assert.equal(result.ok, false);
    assert.equal(result.nextState, undefined);
    assert.equal(before.customers.length, 0);
  }
});

test('refusal: a name that already exists is refused so the operator picks the existing customer', () => {
  const before = existingCustomerState();
  const result = quickAddCustomer(before, input({ name: 'Existing Customer', packageId: '' }), NOV_7);
  assert.equal(result.ok, false);
  assert.match(result.errors.name, /already in the list/);
  assert.equal(before.customers.length, 1);
});

// --- Other records are never touched ---

test('create: no bill, payment, or other customer record ever changes', () => {
  const before = existingCustomerState();
  const beforeJson = JSON.stringify(before.customers[0]);
  const result = quickAddCustomer(before, input(), NOV_7);
  assert.equal(result.ok, true);
  assert.equal(result.nextState.customers.length, 2);
  assert.equal(JSON.stringify(result.nextState.customers[0]), beforeJson);
  assert.equal(result.nextState.customers[0].bills.length, 1);
  assert.equal(result.nextState.customers[0].bills[0].dueAmount, 2000);
});

test('create: a shared family phone is not blocked', () => {
  const before = existingCustomerState();
  const withPhone = updateCustomerProfile(before, 'seed-001', { phone: FAKE_PHONE }, NOV_7);
  const result = quickAddCustomer(withPhone, input({ packageId: '' }), NOV_7);
  assert.equal(result.ok, true);
  assert.equal(result.customer.phone, FAKE_PHONE);
});

// --- Summary text and money format ---

test('summary: with package and bill it names the customer, package, fee, and bill', () => {
  const result = quickAddCustomer(emptyState(), input(), NOV_7);
  const text = quickAddCustomerSummaryText(result);
  assert.match(text, /New customer #1 New Counter Customer \(CHAMYAAA\) added/);
  assert.match(text, /5Mbps \/ 150GB — PKR 1,500\/month/);
  assert.match(text, /This month's bill PKR 1,500/);
});

test('summary: without a package it says so plainly', () => {
  const result = quickAddCustomer(emptyState(), input({ packageId: '' }), NOV_7);
  assert.match(quickAddCustomerSummaryText(result), /No package yet — type the amount/);
  assert.equal(quickAddCustomerSummaryText(null), '');
  assert.equal(quickAddCustomerSummaryText({ ok: false, errors: { name: 'x' } }), '');
});

test('money: min-0 decimals, and a non-number is never zero', () => {
  assert.equal(formatQuickAddAmount(1500), 'PKR 1,500');
  assert.equal(formatQuickAddAmount(1500.5), 'PKR 1,500.5');
  assert.equal(formatQuickAddAmount(null), 'Not set');
  assert.equal(formatQuickAddAmount('1500'), 'Not set');
});

// --- Form markup ---

test('form: all four fields, the error line, and both buttons, on the nca ids', () => {
  const html = quickAddFormFieldsHtml();
  for (const id of Object.values(QUICK_ADD_FIELD_IDS)) {
    if (id === QUICK_ADD_FIELD_IDS.form || id === QUICK_ADD_FIELD_IDS.button) continue;
    assert.ok(html.includes(`id="${id}"`), `form must carry id ${id}`);
  }
  assert.ok(html.includes('list="mohallaOptions"'), 'mohalla reuses the app mohalla list');
  assert.ok(html.includes('class="field-error"'), 'the error line reuses the fully-red field error');
  assert.ok(html.includes('role="alert"'), 'the error line announces');
  assert.ok(html.includes('Add &amp; continue to payment'), 'the add button names the next step');
  for (const plan of BILL_PACKAGES) {
    assert.ok(html.includes(plan.label), `package select must list ${plan.label}`);
  }
});

// --- Fences and wiring guards ---

test('fence: the module never names, reads, or rewrites the onboarding checklist', () => {
  assert.ok(!moduleSrc.includes('onboarding-checklist'), 'the fenced filename must never appear in the module');
  assert.ok(!moduleSrc.includes('saveNewCustomer'), 'the full add-customer form is never used here');
  assert.ok(!moduleSrc.includes('localStorage'), 'the module reads no storage');
});

test('fence: Plan 390’s inert standing-instruction line is untouched', () => {
  assert.ok(!moduleSrc.includes('loadStandingInstructionNotes'));
});

test('purity: the module takes its date from the caller and never builds one', () => {
  assert.ok(!moduleSrc.includes('new Date('), 'no new Date( in the module');
  assert.ok(!moduleSrc.includes('Date.now('), 'no Date.now( in the module');
});

test('wiring: the picker button, form host, and submit path are all connected', () => {
  assert.ok(wiringSrc.includes("from './quick-collect-new-customer-quick-add.js'"), 'nav-quick-collect must import the module');
  assert.ok(wiringSrc.includes('ncaNewCustomerButton'), 'the picker button must be wired');
  assert.ok(wiringSrc.includes('submitNewCustomerQuickAdd'), 'the submit handler must exist');
  assert.ok(wiringSrc.includes('quickAddCustomer(getState()'), 'the submit must create through the module');
  assert.ok(wiringSrc.includes('openCustomerCollectionForm(result.customer.id)'), 'success must open the payment form for the new customer');
  assert.ok(pageSrc.includes('id="ncaNewCustomerButton"'), 'index must carry the button');
  assert.ok(pageSrc.includes('id="ncaQuickAddForm"'), 'index must carry the form host');
  assert.ok(pageSrc.indexOf('ncaNewCustomerButton') < pageSrc.indexOf('id="quickCollectCustomerList"'), 'the button sits on the picker step, before the list');
  assert.ok(!stylesSrc.includes('.nca'), 'no new CSS classes: the form reuses qc-form, field-label, field-error, and the buttons');
});
