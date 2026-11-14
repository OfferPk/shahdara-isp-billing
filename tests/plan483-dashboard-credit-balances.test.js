import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState } from '../core.js';
import { normalizeCreditEntryList, normalizeCreditApplicationList } from '../credit-balance.js';
import {
  calculateCreditBalances,
  creditBalancesCountText,
  renderDashboardCreditBalances
} from '../dashboard-credit-balances.js';
import { TRANSLATIONS } from '../nav-language.js';

// The credit-balances total, read independently of the module
// under test: the remaining credit of every customer who still
// holds credit, in integer cents — credit in minus credit
// applied, per customer. A fully applied credit reads zero and
// never appears; an archived customer never appears; an entry
// naming no customer on record contributes nothing, never a
// guessed amount; the total has no month scope.
function ledgerCreditBalancesCents(state, entries, applications) {
  const safeEntries = normalizeCreditEntryList(entries);
  const safeApplications = normalizeCreditApplicationList(applications);
  const customers = new Map();
  for (const customer of state?.customers ?? []) {
    const id = typeof customer?.id === 'string' ? customer.id.trim() : '';
    if (!id || customers.has(id)) continue;
    customers.set(id, customer);
  }
  let cents = 0;
  let count = 0;
  const seen = new Set();
  for (const entry of safeEntries) {
    if (seen.has(entry.customerId)) continue;
    seen.add(entry.customerId);
    const customer = customers.get(entry.customerId);
    if (!customer || customer.archived) continue;
    const creditIn = safeEntries
      .filter((item) => item.customerId === entry.customerId)
      .reduce((sum, item) => sum + item.amountCents, 0);
    const applied = safeApplications
      .filter((app) => app.customerId === entry.customerId)
      .reduce((sum, app) => sum + app.amountCents, 0);
    const remaining = creditIn - applied;
    if (remaining <= 0) continue;
    cents += remaining;
    count += 1;
  }
  return { cents, count };
}

function buildFixture() {
  const state = createInitialState([
    'Credit Cust A',
    'Credit Cust B',
    'Credit Cust C',
    'Credit Cust D',
    'Credit Cust E',
    'Credit Cust G',
    'Credit Cust H'
  ]);
  const id = (index) => state.customers[index].id;
  // A: 2000 overpayment, nothing applied — +2000.
  // B: a paisa-exact 1500.50 overpayment with 500.50 applied to a
  // bill — +1000.
  // C: 800 overpayment, fully applied to a bill — reads zero,
  // never appears.
  // D: 600 approved adjustment, nothing applied — +600.
  // E: 400 overpayment — but the customer is archived, so the
  // credit never appears.
  // F: an entry naming no customer on record — contributes
  // nothing, never a guessed amount.
  // G: two entries, 300 + 250, with 100 applied — +450, and the
  // customer counts once.
  // H: no credit entries at all.
  state.customers[4].archived = true;
  const entries = [
    { id: 'cr-a', customerId: id(0), source: 'overpayment', sourcePaymentId: 'pay-a', amount: 2000, date: '2026-11-02' },
    { id: 'cr-b', customerId: id(1), source: 'overpayment', sourcePaymentId: 'pay-b', amount: 1500.5, date: '2026-11-05' },
    { id: 'cr-c', customerId: id(2), source: 'overpayment', sourcePaymentId: 'pay-c', amount: 800, date: '2026-11-04' },
    { id: 'cr-d', customerId: id(3), source: 'adjustment', amount: 600, date: '2026-11-03', note: 'Approved adjustment' },
    { id: 'cr-e', customerId: id(4), source: 'overpayment', sourcePaymentId: 'pay-e', amount: 400, date: '2026-11-05' },
    { id: 'cr-f', customerId: 'customer-missing', source: 'overpayment', sourcePaymentId: 'pay-f', amount: 900, date: '2026-11-06' },
    { id: 'cr-g1', customerId: id(5), source: 'overpayment', sourcePaymentId: 'pay-g1', amount: 300, date: '2026-11-02' },
    { id: 'cr-g2', customerId: id(5), source: 'overpayment', sourcePaymentId: 'pay-g2', amount: 250, date: '2026-11-06' },
    // A half-formed entry — an overpayment naming no source
    // payment — is refused outright and never lands in the total.
    { id: 'cr-bad', customerId: id(0), source: 'overpayment', amount: 700, date: '2026-11-07' }
  ];
  const applications = [
    { id: 'app-b', creditEntryId: 'cr-b', customerId: id(1), billId: 'bill-b-nov', amount: 500.5, date: '2026-11-06' },
    { id: 'app-c', creditEntryId: 'cr-c', customerId: id(2), billId: 'bill-c-nov', amount: 800, date: '2026-11-06' },
    { id: 'app-g', creditEntryId: 'cr-g1', customerId: id(5), billId: 'bill-g-nov', amount: 100, date: '2026-11-06' }
  ];
  return { state, entries, applications };
}

test('credit balances: the total equals the sum of the individual customer credit balances', () => {
  const { state, entries, applications } = buildFixture();
  const summary = calculateCreditBalances(state, entries, applications);
  // 2000 + 1000 + 600 + 450 = 4050, over 4 customers.
  assert.equal(summary.amountCents, 405000);
  assert.equal(summary.count, 4);
  assert.deepEqual(ledgerCreditBalancesCents(state, entries, applications), { cents: 405000, count: 4 });
});

test('credit balances: a fully applied credit never counts', () => {
  const { state, entries, applications } = buildFixture();
  const onlySettled = {
    entries: entries.filter((entry) => entry.id === 'cr-c'),
    applications: applications.filter((app) => app.id === 'app-c')
  };
  assert.deepEqual(
    calculateCreditBalances(state, onlySettled.entries, onlySettled.applications),
    { amountCents: 0, count: 0 },
    'the fully applied 800 reads zero and never appears'
  );
});

test('credit balances: an entry naming no customer contributes nothing, never a guessed amount', () => {
  const { state } = buildFixture();
  const summary = calculateCreditBalances(state, [
    { id: 'cr-ghost', customerId: 'customer-ghost', source: 'overpayment', sourcePaymentId: 'pay-ghost', amount: 900, date: '2026-11-06' }
  ], []);
  assert.deepEqual(summary, { amountCents: 0, count: 0 });
});

test('credit balances: an archived customer never appears', () => {
  const { state, entries, applications } = buildFixture();
  const summary = calculateCreditBalances(state, entries, applications);
  assert.equal(summary.amountCents, 405000, 'the archived 400 never lands in the total');
});

test('credit balances: a customer with two entries counts once', () => {
  const { state, entries, applications } = buildFixture();
  const summary = calculateCreditBalances(state, entries, applications);
  assert.equal(summary.count, 4, 'the two entries for one customer add no second customer');
});

test('credit balances: credit from a previous month still counts — the total has no month scope', () => {
  const state = createInitialState(['Credit Cust Old']);
  const customerId = state.customers[0].id;
  const summary = calculateCreditBalances(state, [
    { id: 'cr-old', customerId, source: 'overpayment', sourcePaymentId: 'pay-old', amount: 250, date: '2026-10-15' }
  ], []);
  assert.deepEqual(summary, { amountCents: 25000, count: 1 }, 'the October 250 still counts in November');
});

test('credit balances: a business with no credit outstanding shows zero, not a blank', () => {
  const summary = calculateCreditBalances({ customers: [] }, [], []);
  assert.deepEqual(summary, { amountCents: 0, count: 0 });
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderDashboardCreditBalances(doc, summary);
  assert.equal(els.crbCreditTotal.textContent, 'PKR 0');
  assert.equal(els.crbCreditLine.textContent, '0 customers hold credit');
  assert.equal(els.crbCreditEmpty.hidden, false, 'empty state shows');
});

test('credit balances render: PKR figures, line, and empty state land in the view', () => {
  const { state, entries, applications } = buildFixture();
  const summary = calculateCreditBalances(state, entries, applications);
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderDashboardCreditBalances(doc, summary);
  assert.equal(els.crbCreditTotal.textContent, 'PKR 4,050');
  assert.equal(els.crbCreditLine.textContent, '4 customers hold credit');
  assert.equal(els.crbCreditEmpty.hidden, true, 'empty state hides while credit is outstanding');
});

test('credit balances: the singular count line reads one customer', () => {
  assert.equal(creditBalancesCountText({ amountCents: 200000, count: 1 }), '1 customer holds credit');
  assert.equal(creditBalancesCountText({ amountCents: 0, count: 0 }), '0 customers hold credit');
});

test('credit balances: calculating and rendering never mutate the state or the credit lists', () => {
  const { state, entries, applications } = buildFixture();
  const beforeState = JSON.stringify(state);
  const beforeEntries = JSON.stringify(entries);
  const beforeApplications = JSON.stringify(applications);
  const summary = calculateCreditBalances(state, entries, applications);
  creditBalancesCountText(summary);
  const els = {};
  renderDashboardCreditBalances({ getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false }) }, summary);
  assert.equal(JSON.stringify(state), beforeState);
  assert.equal(JSON.stringify(entries), beforeEntries);
  assert.equal(JSON.stringify(applications), beforeApplications);
});

test('credit balances wiring: the total sits on the billing dashboard after the pending-clearance total, and the dashboard renders it', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('id="creditBalancesSection"'), 'credit-balances section exists');
  assert.ok(page.indexOf('id="creditBalancesSection"') > page.indexOf('id="pendingClearanceSection"'), 'total follows the pending-clearance total');
  assert.ok(page.indexOf('id="creditBalancesSection"') < page.indexOf('id="multiMonthMatrixSection"'), 'total sits before the matrix section');
  assert.ok(page.includes('id="crbCreditTotal"'), 'credit total element exists');
  assert.ok(page.includes('id="crbCreditLine"'), 'count line element exists');
  assert.ok(page.includes('id="crbCreditEmpty"'), 'empty state element exists');
  assert.ok(page.includes('data-i18n="dash_creditbal_title"'), 'total title is translated');
  assert.ok(page.includes('data-i18n="dash_creditbal_sub"'), 'total subtitle is translated');
  assert.ok(page.includes('Credit balances'), 'total title reads Credit balances');

  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './dashboard-credit-balances.js?v=1.11.0'"), 'dashboard imports the credit-balances module at the pinned version');
  assert.ok(app.includes('renderDashboardCreditBalances(document, calculateCreditBalances(state, loadCreditEntries(), loadCreditApplications()))'), 'renderDashboard fills the total from the state and the saved credit records');
});

test('i18n: every dash_creditbal_ key used exists in English and Urdu, with Urdu script in the Urdu value', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const module = readFileSync(new URL('../dashboard-credit-balances.js', import.meta.url), 'utf8');
  const used = new Set();
  for (const match of page.matchAll(/data-i18n="(dash_creditbal_[a-z_]+)"/g)) used.add(match[1]);
  // The count keys sit inside t() calls in the module, not directly
  // after t(' — so the module scan takes every quoted key.
  for (const match of module.matchAll(/'(dash_creditbal_[a-z_]+)'/g)) used.add(match[1]);
  assert.ok(used.size >= 5, `expected at least 5 credit-balances keys, found ${[...used].join(', ')}`);
  for (const key of used) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `missing English key ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `missing Urdu key ${key}`);
    assert.ok(/[\u0600-\u06FF]/.test(TRANSLATIONS.ur[key]), `Urdu value of ${key} carries no Urdu script`);
  }
});

test('the new module names no fenced module file in its header and reads no storage, clock, or page', () => {
  const module = readFileSync(new URL('../dashboard-credit-balances.js', import.meta.url), 'utf8');
  const header = module.slice(0, module.indexOf('*/'));
  assert.equal(header.includes('.js'), false, 'header names no module file');
  assert.equal(module.includes('full-history-list.js'), false);
  assert.equal(module.includes('localStorage'), false);
  assert.equal(module.includes('document'), false);
  assert.equal(/\bwindow\s*[.([]/.test(module), false, 'module touches the window global');
  // Plan 248: the clock check is `new Date(` / `Date.now(` — a bare
  // `Date(` also matches a pure function call, not a clock read.
  assert.equal(module.includes('new Date('), false);
  assert.equal(module.includes('Date.now'), false);
  // The header is a /* */ block, never // line comments.
  assert.ok(module.startsWith('/*'), 'header is a block comment');
  // PKR only — no other currency symbol or code in the module source
  // (a dollar followed by a digit would be money; `${` template
  // placeholders are not).
  assert.equal(/\$\d|€|£|USD|EUR|GBP/.test(module), false);
});
