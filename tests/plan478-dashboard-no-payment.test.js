import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, saveBillMonth, addPayment } from '../core.js';
import {
  calculateNoPaymentCustomers,
  noPaymentSectionHtml,
  renderNoPayment
} from '../dashboard-no-payment.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF_DATE = new Date('2026-11-08T12:00:00Z');
const TODAY = '2026-11-08';
const MONTH = '2026-11';

function buildFixture() {
  let state = createInitialState([
    'Quiet Cust A',
    'Quiet Cust B',
    'Paid Cust C',
    'Part Cust D',
    'Last Month Cust E',
    'Voided Cust F',
    'Free Cust G',
    'Archived Cust H',
    'No Bill Cust I',
    'Zero Pay Cust J',
    'Paisa Cust K',
    'Quiet Cust L & Sons'
  ]);
  const id = (index) => state.customers[index].id;

  // A (CHARYAA): 3000 bill this month, no payment — listed, owes 3000.
  state.customers[0].mohalla = 'CHARYAA';
  state = saveBillMonth(state, id(0), { month: MONTH, dueAmount: 3000, status: 'pending', dueDate: TODAY }, REF_DATE);
  // B (GANGALL): 1500 bill from last month, never paid — listed,
  // still owes 1500; an old bill still counts as outstanding.
  state.customers[1].mohalla = 'GANGALL';
  state = saveBillMonth(state, id(1), { month: '2026-10', dueAmount: 1500, status: 'pending', dueDate: '2026-10-05' }, REF_DATE);
  // C (GANGALL): 2000 bill, paid in full this month — NOT listed.
  state.customers[2].mohalla = 'GANGALL';
  state = saveBillMonth(state, id(2), { month: MONTH, dueAmount: 2000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(2), MONTH, { amount: 2000, date: '2026-11-02', method: 'Cash' }, REF_DATE);
  // D (KISHTII): 500 bill, 200 paid this month — NOT listed, even
  // though 300 is still due: a payment was recorded this month.
  state.customers[3].mohalla = 'KISHTII';
  state = saveBillMonth(state, id(3), { month: MONTH, dueAmount: 500, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(3), MONTH, { amount: 200, date: '2026-11-03', method: 'Cash' }, REF_DATE);
  // E (KISHTII): 1000 bill, 400 paid — but dated last month, so
  // the payment never rescues this month; listed, owes 600.
  state.customers[4].mohalla = 'KISHTII';
  state.customers[4].bills.push({
    id: 'bill-quiet-last-month-payment',
    month: MONTH,
    dueAmount: 1000,
    status: 'pending',
    dueDate: TODAY,
    payments: [{ id: 'pay-quiet-last-month', date: '2026-10-31', amount: 400, method: 'Cash' }]
  });
  // F (BARRIAN): 800 bill, 800 paid this month, then voided — a
  // voided receipt is history, never a payment; listed, owes 800.
  state.customers[5].mohalla = 'BARRIAN';
  state = saveBillMonth(state, id(5), { month: MONTH, dueAmount: 800, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(5), MONTH, { amount: 800, date: '2026-11-04', method: 'Cash' }, REF_DATE);
  state.customers[5].bills.find((b) => b.month === MONTH).payments[0].voided = true;
  // G (CHAMYAAA): a free connection with a 1000 bill — it never
  // owes anything, so it is listed with PKR 0, never a guessed
  // figure, and the operator reads the dues before reminding.
  state.customers[6].mohalla = 'CHAMYAAA';
  state.customers[6].isFreeConnection = true;
  state.customers[6].bills.push({
    id: 'bill-quiet-free-connection',
    month: MONTH,
    dueAmount: 1000,
    status: 'pending',
    dueDate: TODAY,
    payments: []
  });
  // H (THALII): 900 bill, no payment — then archived, so the
  // customer never appears.
  state.customers[7].mohalla = 'THALII';
  state = saveBillMonth(state, id(7), { month: MONTH, dueAmount: 900, status: 'pending', dueDate: TODAY }, REF_DATE);
  state.customers[7].archived = true;
  // I (no mohalla recorded): no bills at all and no payment —
  // listed with PKR 0 and Unassigned.
  state.customers[8].mohalla = '';
  // J (CHARYAA): 1200 bill with a zero-amount payment record this
  // month — a zero-amount record pays nothing; listed, owes 1200.
  state.customers[9].mohalla = 'CHARYAA';
  state.customers[9].bills.push({
    id: 'bill-quiet-zero-payment',
    month: MONTH,
    dueAmount: 1200,
    status: 'pending',
    dueDate: TODAY,
    payments: [{ id: 'pay-quiet-zero', date: '2026-11-05', amount: 0, method: 'Cash' }]
  });
  // K (KISHTII): a paisa-exact 1500.50 bill, no payment — listed.
  state.customers[10].mohalla = 'KISHTII';
  state = saveBillMonth(state, id(10), { month: MONTH, dueAmount: 1500.5, status: 'pending', dueDate: TODAY }, REF_DATE);
  // L (GANGALL): 700 bill, no payment — listed, and the name
  // carries an & so the render test can check escaping.
  state.customers[11].mohalla = 'GANGALL';
  state = saveBillMonth(state, id(11), { month: MONTH, dueAmount: 700, status: 'pending', dueDate: TODAY }, REF_DATE);
  return state;
}

test('no payment this month: lists exactly the customers with no payment recorded this month, with their own outstanding dues', () => {
  const summary = calculateNoPaymentCustomers(buildFixture(), REF_DATE);
  assert.equal(summary.month, MONTH);
  assert.equal(summary.customerCount, 9);
  assert.deepEqual(summary.customers, [
    // Owner 5-part fix: stored 'CHARYAA' is its own mohalla —
    // the fixture keeps the stored variant, the label is 'Charyaa'.
    { name: 'Quiet Cust A', mohalla: 'Charyaa', duesCents: 300000 },
    { name: 'Paisa Cust K', mohalla: 'Kishtii', duesCents: 150050 },
    { name: 'Quiet Cust B', mohalla: 'Gangall', duesCents: 150000 },
    { name: 'Zero Pay Cust J', mohalla: 'Charyaa', duesCents: 120000 },
    { name: 'Voided Cust F', mohalla: 'Barrian', duesCents: 80000 },
    { name: 'Quiet Cust L & Sons', mohalla: 'Gangall', duesCents: 70000 },
    { name: 'Last Month Cust E', mohalla: 'Kishtii', duesCents: 60000 },
    { name: 'Free Cust G', mohalla: 'Chamyaaa', duesCents: 0 },
    { name: 'No Bill Cust I', mohalla: 'Unassigned', duesCents: 0 }
  ]);
});

test('no payment this month: the total equals the sum of the listed dues', () => {
  const summary = calculateNoPaymentCustomers(buildFixture(), REF_DATE);
  assert.equal(summary.totalDueCents, 930050);
  assert.equal(
    summary.customers.reduce((sum, row) => sum + row.duesCents, 0),
    summary.totalDueCents
  );
});

test('no payment this month: rows are ordered largest dues first, then name A–Z', () => {
  const summary = calculateNoPaymentCustomers(buildFixture(), REF_DATE);
  assert.deepEqual(
    summary.customers.map((row) => row.name),
    ['Quiet Cust A', 'Paisa Cust K', 'Quiet Cust B', 'Zero Pay Cust J', 'Voided Cust F', 'Quiet Cust L & Sons', 'Last Month Cust E', 'Free Cust G', 'No Bill Cust I']
  );
});

test('no payment this month: a business with no customers shows no one, at zero', () => {
  const summary = calculateNoPaymentCustomers({ customers: [] }, REF_DATE);
  assert.equal(summary.month, MONTH);
  assert.deepEqual(summary.customers, []);
  assert.equal(summary.customerCount, 0);
  assert.equal(summary.totalDueCents, 0);
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderNoPayment(doc, summary);
  assert.equal(els.nqpNoPaymentTotal.textContent, 'PKR 0');
  assert.equal(els.nqpNoPaymentLine.textContent, '0 customers with no payment this month');
  assert.equal(els.nqpNoPaymentRows.innerHTML, '');
  assert.equal(els.nqpNoPaymentEmpty.hidden, false, 'empty state shows');
});

test('no payment this month render: PKR figures, line, and rows land in the view', () => {
  const summary = calculateNoPaymentCustomers(buildFixture(), REF_DATE);
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderNoPayment(doc, summary);
  assert.equal(els.nqpNoPaymentTotal.textContent, 'PKR 9,300.50');
  assert.equal(els.nqpNoPaymentLine.textContent, '9 customers with no payment this month');
  assert.equal(els.nqpNoPaymentEmpty.hidden, true, 'empty state hides while quiet customers exist');
  const html = els.nqpNoPaymentRows.innerHTML;
  assert.ok(html.includes('Quiet Cust A'), 'A row lands');
  assert.ok(html.includes('PKR 3,000'), 'A dues figure lands');
  // Stored 'CHARYAA' renders under its own 'Charyaa' label
  // (Owner 5-part fix — no fold into Chamyaaa).
  assert.ok(html.includes('Charyaa'), 'A mohalla lands under its own label');
  assert.ok(html.includes('Paisa Cust K'), 'paisa row lands');
  assert.ok(html.includes('PKR 1,500.50'), 'paisa-exact dues keep their paisa');
  assert.ok(html.includes('Quiet Cust L &amp; Sons'), 'names are escaped');
  assert.ok(html.includes('Free Cust G'), 'free connection row lands');
  assert.ok(html.includes('PKR 0'), 'a customer who owes nothing reads PKR 0');
  assert.ok(html.includes('No Bill Cust I'), 'no-bill row lands');
  assert.ok(html.includes('Unassigned'), 'no mohalla reads Unassigned');
  assert.ok(!html.includes('Paid Cust C'), 'a customer who paid this month never appears');
  assert.ok(!html.includes('Part Cust D'), 'a customer who paid anything this month never appears');
  assert.ok(!html.includes('Archived Cust H'), 'an archived customer never appears');
  // Rows sit largest dues first.
  assert.ok(html.indexOf('Quiet Cust A') < html.indexOf('Paisa Cust K'), 'A before K');
  assert.ok(html.indexOf('Paisa Cust K') < html.indexOf('Quiet Cust B'), 'K before B');
  assert.ok(html.indexOf('Quiet Cust B') < html.indexOf('Zero Pay Cust J'), 'B before J');
  assert.ok(html.indexOf('Zero Pay Cust J') < html.indexOf('Voided Cust F'), 'J before F');
  assert.ok(html.indexOf('Voided Cust F') < html.indexOf('Quiet Cust L'), 'F before L');
  assert.ok(html.indexOf('Quiet Cust L') < html.indexOf('Last Month Cust E'), 'L before E');
  assert.ok(html.indexOf('Last Month Cust E') < html.indexOf('Free Cust G'), 'E before G');
  assert.ok(html.indexOf('Free Cust G') < html.indexOf('No Bill Cust I'), 'G before I');
  // PKR only — no other currency symbol or code appears anywhere.
  for (const el of Object.values(els)) {
    assert.equal(/\$\d|€|£|USD|EUR|GBP/.test(el.textContent), false, el.textContent);
  }
  assert.equal(/\$\d|€|£|USD|EUR|GBP/.test(html), false);
});

test('no payment this month render: one quiet customer reads the singular line', () => {
  const state = buildFixture();
  state.customers = [state.customers[0]];
  const summary = calculateNoPaymentCustomers(state, REF_DATE);
  assert.equal(summary.customerCount, 1);
  assert.equal(summary.totalDueCents, 300000);
  const els = {};
  renderNoPayment(
    { getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false }) },
    summary
  );
  assert.equal(els.nqpNoPaymentTotal.textContent, 'PKR 3,000');
  assert.equal(els.nqpNoPaymentLine.textContent, '1 customer with no payment this month');
  assert.equal(els.nqpNoPaymentEmpty.hidden, true);
});

test('no payment this month: the view never changes any bill, payment, or customer record', () => {
  const state = buildFixture();
  const before = JSON.stringify(state);
  const summary = calculateNoPaymentCustomers(state, REF_DATE);
  noPaymentSectionHtml(summary);
  const els = {};
  renderNoPayment({ getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false }) }, summary);
  assert.equal(JSON.stringify(state), before);
});

test('no payment this month wiring: the view sits in the Collect tab after the collector card, and the dashboard renders it', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('id="noPaymentSection"'), 'quiet-customers section exists');
  // Home Dashboard overhaul: the view moved from Home to the
  // Collect tab — the old "follows the new-customers strip" pin is
  // gone (new customers moved to Reports). It now follows the
  // collector card inside transactionsView.
  assert.ok(page.indexOf('id="noPaymentSection"') > page.indexOf('id="collectorCardSection"'), 'view follows the collector card');
  assert.ok(page.indexOf('id="noPaymentSection"') > page.indexOf('id="transactionsView"'), 'view sits inside the Collect tab');
  assert.ok(page.indexOf('id="noPaymentSection"') < page.indexOf('id="collectionForecastSection"'), 'view sits before the forecast section');
  assert.ok(page.includes('id="nqpNoPaymentTotal"'), 'total element exists');
  assert.ok(page.includes('id="nqpNoPaymentLine"'), 'count line exists');
  assert.ok(page.includes('id="nqpNoPaymentRows"'), 'rows element exists');
  assert.ok(page.includes('id="nqpNoPaymentEmpty"'), 'empty state exists');
  assert.ok(page.includes('data-i18n="dash_nopayment_title"'), 'view title is translated');
  assert.ok(page.includes('data-i18n="dash_nopayment_sub"'), 'view subtitle is translated');
  assert.ok(page.includes('data-i18n="dash_nopayment_empty"'), 'empty state is translated');
  assert.ok(page.includes('No payment this month yet'), 'view title reads No payment this month yet');

  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './dashboard-no-payment.js?v=1.11.0'"), 'dashboard imports the no-payment module at the pinned version');
  assert.ok(app.includes('renderNoPayment(document, calculateNoPaymentCustomers(state, referenceDate))'), 'renderDashboard fills the view from the state');
});

test('i18n: every dash_nopayment_ key used exists in English and Urdu', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const module = readFileSync(new URL('../dashboard-no-payment.js', import.meta.url), 'utf8');
  const used = new Set();
  for (const match of page.matchAll(/data-i18n="(dash_nopayment_[a-z_]+)"/g)) used.add(match[1]);
  // The count keys sit inside t() calls in the module, not directly
  // after t(' — so the module scan takes every quoted key.
  for (const match of module.matchAll(/'(dash_nopayment_[a-z_]+)'/g)) used.add(match[1]);
  assert.ok(used.size >= 5, `expected at least 5 no-payment keys, found ${[...used].join(', ')}`);
  for (const key of used) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `missing English key ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `missing Urdu key ${key}`);
  }
});

test('the new module names no fenced module file in its header and reads no storage, clock, or page', () => {
  const module = readFileSync(new URL('../dashboard-no-payment.js', import.meta.url), 'utf8');
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
