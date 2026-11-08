import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, saveBillMonth, addPayment } from '../core.js';
import {
  calculateMethodStrip,
  methodStripSectionHtml,
  renderMethodStrip
} from '../dashboard-method-strip.js';
import { calculateDashboardTodayCard } from '../dashboard-today-card.js';
import { LEDGER_METHOD_FILTERS } from '../ledger-payment-method.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF_DATE = new Date('2026-11-08T12:00:00Z');
const TODAY = '2026-11-08';
const YESTERDAY = '2026-11-07';

function buildFixture() {
  let state = createInitialState([
    'Method Cust A',
    'Method Cust B',
    'Method Cust C',
    'Method Cust D',
    'Method Cust E',
    'Method Cust F',
    'Method Cust G',
    'Method Cust H'
  ]);
  const id = (index) => state.customers[index].id;

  // A: 1500 Cash + 2500.50 JazzCash, both today.
  state = saveBillMonth(state, id(0), { month: '2026-11', dueAmount: 5000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(0), '2026-11', { amount: 1500, date: TODAY, method: 'Cash' }, REF_DATE);
  state = addPayment(state, id(0), '2026-11', { amount: 2500.50, date: TODAY, method: 'JazzCash' }, REF_DATE);
  // B: 1000 at a shop today — a "Cash at … shop" variant folds to cash.
  state = saveBillMonth(state, id(1), { month: '2026-11', dueAmount: 1000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(1), '2026-11', { amount: 1000, date: TODAY, method: 'Cash at Waseem Abbasi shop' }, REF_DATE);
  // C: 2000 Raast today — Raast folds to bank transfer.
  state = saveBillMonth(state, id(2), { month: '2026-11', dueAmount: 2000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(2), '2026-11', { amount: 2000, date: TODAY, method: 'Raast' }, REF_DATE);
  // D: 750 Easypaisa + 300 NayaPay, both today.
  state = saveBillMonth(state, id(3), { month: '2026-11', dueAmount: 2000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(3), '2026-11', { amount: 750, date: TODAY, method: 'Easypaisa' }, REF_DATE);
  state = addPayment(state, id(3), '2026-11', { amount: 300, date: TODAY, method: 'NayaPay' }, REF_DATE);
  // E: 500 Bank Transfer today, plus 400 Cash yesterday — yesterday
  // never counts towards today.
  state = saveBillMonth(state, id(4), { month: '2026-11', dueAmount: 1000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(4), '2026-11', { amount: 500, date: TODAY, method: 'Bank Transfer' }, REF_DATE);
  state = addPayment(state, id(4), '2026-11', { amount: 400, date: YESTERDAY, method: 'Cash' }, REF_DATE);
  // F: 600 Cash today, then voided — voided receipts are history,
  // never collected cash.
  state = saveBillMonth(state, id(5), { month: '2026-11', dueAmount: 600, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(5), '2026-11', { amount: 600, date: TODAY, method: 'Cash' }, REF_DATE);
  state.customers[5].bills.find((b) => b.month === '2026-11').payments[0].voided = true;
  // G: 999 JazzCash today, then archived — archived customers never
  // appear.
  state = saveBillMonth(state, id(6), { month: '2026-11', dueAmount: 999, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(6), '2026-11', { amount: 999, date: TODAY, method: 'JazzCash' }, REF_DATE);
  state.customers[6].archived = true;
  // H: two hand-built payments on one bill — a cheque-labelled
  // entry from an older record (111) and an unrecognised method
  // (89) both read as other, never forced into a group they do not
  // belong to.
  state.customers[7].bills.push({
    id: 'bill-method-other',
    month: '2026-11',
    dueAmount: 500,
    status: 'pending',
    dueDate: TODAY,
    payments: [
      { id: 'pay-method-cheque', date: TODAY, amount: 111, method: 'Cheque' },
      { id: 'pay-method-barter', date: TODAY, amount: 89, method: 'Barter' }
    ]
  });
  return state;
}

test('method strip: each method figure equals the sum of today\'s payments by that method, and the strip total equals the day\'s collections', () => {
  const summary = calculateMethodStrip(buildFixture(), REF_DATE);
  assert.equal(summary.today, TODAY);
  // The six groups, in the ledger filter's own order.
  assert.deepEqual(summary.methods.map((m) => m.group), [...LEDGER_METHOD_FILTERS]);
  assert.deepEqual(summary.methods.map((m) => m.amountCents), [
    250000, // cash: 1500 Cash + 1000 at the shop
    250050, // jazzcash: 2500.50
    75000, // easypaisa: 750
    30000, // nayapay: 300
    250000, // bank_transfer: 2000 Raast + 500 Bank Transfer
    20000 // other: 111 cheque-labelled + 89 unrecognised
  ]);
  assert.deepEqual(summary.methods.map((m) => m.count), [2, 1, 1, 1, 2, 2]);
  // The strip total equals the day's collections — paisa exact.
  // Yesterday's 400, the voided 600, and the archived 999 are all
  // outside the strip.
  assert.equal(summary.totalCents, 875050);
  assert.equal(summary.totalCount, 9);
});

test('method strip: the strip total and count agree with the today card for the same day', () => {
  const state = buildFixture();
  const strip = calculateMethodStrip(state, REF_DATE);
  const card = calculateDashboardTodayCard(state, REF_DATE);
  assert.equal(strip.totalCents, card.todayCollectedCents);
  assert.equal(strip.totalCount, card.todayPaymentCount);
});

test('method strip: a day with no payments yet reads zero, never a blank', () => {
  const summary = calculateMethodStrip({ customers: [] }, REF_DATE);
  assert.deepEqual(summary, {
    today: TODAY,
    methods: [
      { group: 'cash', label: 'Cash', amountCents: 0, count: 0 },
      { group: 'jazzcash', label: 'JazzCash', amountCents: 0, count: 0 },
      { group: 'easypaisa', label: 'Easypaisa', amountCents: 0, count: 0 },
      { group: 'nayapay', label: 'NayaPay', amountCents: 0, count: 0 },
      { group: 'bank_transfer', label: 'Bank Transfer', amountCents: 0, count: 0 },
      { group: 'other', label: 'Other', amountCents: 0, count: 0 }
    ],
    totalCents: 0,
    totalCount: 0
  });
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderMethodStrip(doc, summary);
  assert.equal(els.dmsMethodTotal.textContent, 'PKR 0');
  assert.equal(els.dmsMethodLine.textContent, '0 payments today');
  assert.equal(els.dmsMethodEmpty.hidden, false);
  // Every group still reads PKR 0 with a zero count, never a blank.
  const html = els.dmsMethodRows.innerHTML;
  assert.equal(html.split('PKR 0').length - 1, 6, 'all six groups read PKR 0');
  assert.equal(html.split('0 payments').length - 1, 6, 'all six groups read 0 payments');
  assert.ok(html.includes('Cash'), 'cash row lands');
  assert.ok(html.includes('Bank Transfer'), 'bank transfer row lands');
  assert.ok(html.includes('Other'), 'other row lands');
});

test('method strip render: PKR figures, count line, and rows land in the view', () => {
  const summary = calculateMethodStrip(buildFixture(), REF_DATE);
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderMethodStrip(doc, summary);
  assert.equal(els.dmsMethodTotal.textContent, 'PKR 8,750.50');
  assert.equal(els.dmsMethodLine.textContent, '9 payments today');
  assert.equal(els.dmsMethodEmpty.hidden, true);
  const html = els.dmsMethodRows.innerHTML;
  // Rows are in the ledger filter's order: cash first, other last.
  assert.ok(html.indexOf('Cash') < html.indexOf('JazzCash'), 'cash ahead of JazzCash');
  assert.ok(html.indexOf('JazzCash') < html.indexOf('Easypaisa'), 'JazzCash ahead of Easypaisa');
  assert.ok(html.indexOf('Easypaisa') < html.indexOf('NayaPay'), 'Easypaisa ahead of NayaPay');
  assert.ok(html.indexOf('NayaPay') < html.indexOf('Bank Transfer'), 'NayaPay ahead of Bank Transfer');
  assert.ok(html.indexOf('Bank Transfer') < html.indexOf('Other'), 'Bank Transfer ahead of Other');
  // Each figure lands, paisa exact where the fixture has paisa.
  assert.ok(html.includes('PKR 2,500'), 'cash and bank transfer figures land');
  assert.ok(html.includes('PKR 2,500.50'), 'JazzCash figure lands, paisa exact');
  assert.ok(html.includes('PKR 750'), 'Easypaisa figure lands');
  assert.ok(html.includes('PKR 300'), 'NayaPay figure lands');
  assert.ok(html.includes('PKR 200'), 'other figure lands');
  // Counts land per group.
  assert.ok(html.includes('2 payments'), 'two-payment groups land');
  assert.ok(html.includes('1 payment'), 'one-payment groups land');
  // PKR only — no other currency symbol or code appears anywhere.
  for (const el of Object.values(els)) {
    assert.equal(/\$\d|€|£|USD|EUR|GBP/.test(el.textContent), false, el.textContent);
  }
  assert.equal(/\$\d|€|£|USD|EUR|GBP/.test(html), false);
});

test('method strip: one payment today reads the singular count line', () => {
  let state = createInitialState(['Method Cust One']);
  const id = state.customers[0].id;
  state = saveBillMonth(state, id, { month: '2026-11', dueAmount: 500, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id, '2026-11', { amount: 500, date: TODAY, method: 'Cash' }, REF_DATE);
  const summary = calculateMethodStrip(state, REF_DATE);
  assert.equal(summary.totalCents, 50000);
  assert.equal(summary.totalCount, 1);
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderMethodStrip(doc, summary);
  assert.equal(els.dmsMethodTotal.textContent, 'PKR 500');
  assert.equal(els.dmsMethodLine.textContent, '1 payment today');
  assert.ok(els.dmsMethodRows.innerHTML.includes('1 payment'), 'cash row reads singular');
});

test('method strip: the view never changes any bill, payment, or customer record', () => {
  const state = buildFixture();
  const before = JSON.stringify(state);
  const summary = calculateMethodStrip(state, REF_DATE);
  methodStripSectionHtml(summary);
  const els = {};
  renderMethodStrip({ getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false }) }, summary);
  assert.equal(JSON.stringify(state), before);
});

test('method strip wiring: the strip sits on the billing dashboard after the overdue list, and the dashboard renders it', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('id="methodStripSection"'), 'method strip section exists');
  assert.ok(page.indexOf('id="methodStripSection"') > page.indexOf('id="overdueListSection"'), 'strip follows the overdue list');
  assert.ok(page.indexOf('id="methodStripSection"') < page.indexOf('id="collectionForecastSection"'), 'strip sits before the forecast section');
  assert.ok(page.includes('id="dmsMethodTotal"'), 'day total element exists');
  assert.ok(page.includes('id="dmsMethodLine"'), 'count line exists');
  assert.ok(page.includes('id="dmsMethodRows"'), 'rows element exists');
  assert.ok(page.includes('id="dmsMethodEmpty"'), 'empty state exists');
  assert.ok(page.includes('data-i18n="dash_methodstrip_title"'), 'strip title is translated');
  assert.ok(page.includes('data-i18n="dash_methodstrip_sub"'), 'strip subtitle is translated');
  assert.ok(page.includes('data-i18n="dash_methodstrip_empty"'), 'empty state is translated');
  assert.ok(page.includes("Today's collections by method"), 'strip title reads Today\'s collections by method');

  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './dashboard-method-strip.js?v=1.11.0'"), 'dashboard imports the method strip module at the pinned version');
  assert.ok(app.includes('renderMethodStrip(document, calculateMethodStrip(state, referenceDate))'), 'renderDashboard fills the method strip');
});

test('i18n: every dash_methodstrip_ key used exists in English and Urdu', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const module = readFileSync(new URL('../dashboard-method-strip.js', import.meta.url), 'utf8');
  const used = new Set();
  for (const match of page.matchAll(/data-i18n="(dash_methodstrip_[a-z_]+)"/g)) used.add(match[1]);
  // The count and payments sing/plur keys sit inside ternaries in
  // the module, not directly after t(' — so the module scan takes
  // every quoted key.
  for (const match of module.matchAll(/'(dash_methodstrip_[a-z_]+)'/g)) used.add(match[1]);
  assert.ok(used.size >= 7, `expected at least 7 method-strip keys, found ${[...used].join(', ')}`);
  for (const key of used) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `missing English key ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `missing Urdu key ${key}`);
  }
});

test('the new module names no fenced module file in its header and reads no storage, clock, or page', () => {
  const module = readFileSync(new URL('../dashboard-method-strip.js', import.meta.url), 'utf8');
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
