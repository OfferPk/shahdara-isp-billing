import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, saveBillMonth, addPayment } from '../core.js';
import {
  calculateOverdueList,
  overdueListSectionHtml,
  renderOverdueList
} from '../dashboard-overdue-list.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF_DATE = new Date('2026-11-08T12:00:00Z');
const TODAY = '2026-11-08';

function buildFixture() {
  let state = createInitialState([
    'Overdue Cust A',
    'Overdue Cust B',
    'Overdue Cust C',
    'Overdue Cust D',
    'Overdue Cust E',
    'Overdue Cust F',
    'Overdue Cust G',
    'Overdue Cust H',
    'Overdue Cust I',
    'Overdue Cust J',
    'Overdue Cust K',
    'Overdue Cust L'
  ]);
  const id = (index) => state.customers[index].id;
  state.customers[0].mohalla = 'Test Mohalla';

  // A: November bill 2000 due 5 Oct, paid 1500.50 — 499.50 still
  // overdue; October bill 700 due 20 Sep, unpaid — 700 overdue.
  // Total 1199.50, oldest due 20 Sep, 49 days overdue, two bills.
  state = saveBillMonth(state, id(0), { month: '2026-11', dueAmount: 2000, status: 'pending', dueDate: '2026-10-05' }, REF_DATE);
  state = addPayment(state, id(0), '2026-11', { amount: 1500.50, date: TODAY, method: 'Cash' }, REF_DATE);
  state = saveBillMonth(state, id(0), { month: '2026-10', dueAmount: 700, status: 'pending', dueDate: '2026-09-20' }, REF_DATE);
  // B: bill 1000 due yesterday, nothing paid — 1000 overdue, 1 day.
  state = saveBillMonth(state, id(1), { month: '2026-11', dueAmount: 1000, status: 'pending', dueDate: '2026-11-07' }, REF_DATE);
  // C: bill 3000 due today — due today is not yet late.
  state = saveBillMonth(state, id(2), { month: '2026-11', dueAmount: 3000, status: 'pending', dueDate: TODAY }, REF_DATE);
  // D: bill 500 due in two days — not overdue.
  state = saveBillMonth(state, id(3), { month: '2026-11', dueAmount: 500, status: 'pending', dueDate: '2026-11-10' }, REF_DATE);
  // E: bill 800 due 10 Oct, paid in full — nothing overdue.
  state = saveBillMonth(state, id(4), { month: '2026-11', dueAmount: 800, status: 'pending', dueDate: '2026-10-10' }, REF_DATE);
  state = addPayment(state, id(4), '2026-11', { amount: 800, date: TODAY, method: 'Cash' }, REF_DATE);
  // F: bill 900 due 1 Oct, paid 400 — 500 overdue, then archived,
  // so the view never shows this customer.
  state = saveBillMonth(state, id(5), { month: '2026-11', dueAmount: 900, status: 'pending', dueDate: '2026-10-01' }, REF_DATE);
  state = addPayment(state, id(5), '2026-11', { amount: 400, date: TODAY, method: 'Cash' }, REF_DATE);
  state.customers[5].archived = true;
  // G: an unpriced bill due 15 Oct carries no amount — nothing
  // is overdue.
  state.customers[6].bills.push({
    id: 'bill-overdue-unpriced',
    month: '2026-11',
    dueAmount: null,
    status: 'pending',
    dueDate: '2026-10-15',
    payments: []
  });
  // H: a bill due 20 Oct, 250, paid 300 — overpaid, nothing due.
  state = saveBillMonth(state, id(7), { month: '2026-11', dueAmount: 250, status: 'pending', dueDate: '2026-10-20' }, REF_DATE);
  state = addPayment(state, id(7), '2026-11', { amount: 300, date: TODAY, method: 'Cash' }, REF_DATE);
  // I: a bill with no due date at all — no date is ever invented,
  // so nothing is overdue for this customer.
  state.customers[8].bills.push({
    id: 'bill-overdue-nodate',
    month: '2026-11',
    dueAmount: 1000,
    status: 'pending',
    payments: []
  });
  // J: a free connection with an overdue bill — free connections
  // never owe anything, so the view never shows this customer.
  state.customers[9].isFreeConnection = true;
  state.customers[9].bills.push({
    id: 'bill-overdue-free',
    month: '2026-11',
    dueAmount: 2000,
    status: 'pending',
    dueDate: '2026-10-02',
    payments: []
  });
  // K: a bill due 1 Nov, 1000.50 — paisa precision, 7 days overdue.
  state = saveBillMonth(state, id(10), { month: '2026-11', dueAmount: 1000.50, status: 'pending', dueDate: '2026-11-01' }, REF_DATE);
  // L: a bill due 20 Sep, 700 — the same oldest date as A, but a
  // smaller amount, so A sorts ahead of L on the tie-break.
  state = saveBillMonth(state, id(11), { month: '2026-11', dueAmount: 700, status: 'pending', dueDate: '2026-09-20' }, REF_DATE);
  return state;
}

test('overdue list: exactly the overdue customers, oldest due date first, with days overdue and amounts matching their bills', () => {
  const summary = calculateOverdueList(buildFixture(), REF_DATE);
  assert.equal(summary.referenceDate, TODAY);
  assert.equal(summary.totalCount, 4);
  // Order is oldest first: A and L share 20 Sep (A ahead on the
  // larger amount), then K on 1 Nov, then B on 7 Nov. C is due
  // today, D is in the future, E is paid in full, F is archived,
  // G is unpriced, H is overpaid, I has no due date, J is a free
  // connection — none of them appears.
  assert.deepEqual(summary.rows.map((row) => row.customerName), [
    'Overdue Cust A', 'Overdue Cust L', 'Overdue Cust K', 'Overdue Cust B'
  ]);
  assert.deepEqual(summary.rows.map((row) => row.amountCents), [119950, 70000, 100050, 100000]);
  assert.deepEqual(summary.rows.map((row) => row.oldestDueDate), [
    '2026-09-20', '2026-09-20', '2026-11-01', '2026-11-07'
  ]);
  assert.deepEqual(summary.rows.map((row) => row.daysOverdue), [49, 49, 7, 1]);
  assert.deepEqual(summary.rows.map((row) => row.oldestDueLabel), [
    '20 Sep 2026', '20 Sep 2026', '1 Nov 2026', '7 Nov 2026'
  ]);
  assert.deepEqual(summary.rows.map((row) => row.billCount), [2, 1, 1, 1]);
  // The total equals the sum of the listed amounts — paisa exact.
  assert.equal(summary.totalCents, 390000);
  // A carries the mohalla the fixture set; the others carry none.
  assert.equal(summary.rows[0].mohalla, 'Test Mohalla');
});

test('overdue list: a list with no overdue dues reads zero, never a blank', () => {
  const summary = calculateOverdueList({ customers: [] }, REF_DATE);
  assert.deepEqual(summary, {
    referenceDate: TODAY,
    rows: [],
    totalCents: 0,
    totalCount: 0
  });
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderOverdueList(doc, summary);
  assert.equal(els.dolOverdueTotal.textContent, 'PKR 0');
  assert.equal(els.dolOverdueLine.textContent, '0 customers');
  assert.equal(els.dolOverdueRows.innerHTML, '');
  assert.equal(els.dolOverdueEmpty.hidden, false);
});

test('overdue list render: PKR total, count line, and rows land in the view', () => {
  const summary = calculateOverdueList(buildFixture(), REF_DATE);
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderOverdueList(doc, summary);
  assert.equal(els.dolOverdueTotal.textContent, 'PKR 3,900');
  assert.equal(els.dolOverdueLine.textContent, '4 customers');
  assert.equal(els.dolOverdueEmpty.hidden, true);
  const html = els.dolOverdueRows.innerHTML;
  // Rows are in oldest-first order.
  assert.ok(html.indexOf('Overdue Cust A') < html.indexOf('Overdue Cust L'), 'A ahead of L on the tie-break');
  assert.ok(html.indexOf('Overdue Cust L') < html.indexOf('Overdue Cust K'), 'L ahead of K');
  assert.ok(html.indexOf('Overdue Cust K') < html.indexOf('Overdue Cust B'), 'K ahead of B');
  // Each row carries name, PKR amount, mohalla, days overdue, and
  // the oldest due date.
  assert.ok(html.includes('PKR 1,199.50'), 'A amount lands, paisa exact');
  assert.ok(html.includes('PKR 1,000.50'), 'K amount lands, paisa exact');
  assert.ok(html.includes('PKR 1,000'), 'B amount lands');
  assert.ok(html.includes('49 days overdue'), 'A and L days land');
  assert.ok(html.includes('7 days overdue'), 'K days land');
  assert.ok(html.includes('1 day overdue'), 'B days land, singular');
  assert.ok(html.includes('20 Sep 2026'), 'oldest due date lands');
  assert.ok(html.includes('Test Mohalla'), 'mohalla lands');
  // PKR only — no other currency symbol or code appears anywhere.
  for (const el of Object.values(els)) {
    assert.equal(/\$\d|€|£|USD|EUR|GBP/.test(el.textContent), false, el.textContent);
  }
  assert.equal(/\$\d|€|£|USD|EUR|GBP/.test(html), false);
  // Customer text is escaped, never raw HTML.
  const nasty = calculateOverdueList({
    customers: [{
      id: 'c-nasty', name: '<b>Bold</b>', mohalla: 'Test Mohalla', archived: false,
      bills: [{ id: 'b-nasty', month: '2026-11', dueAmount: 100, status: 'pending', dueDate: '2026-11-01', payments: [] }]
    }]
  }, REF_DATE);
  const nastyHtml = overdueListSectionHtml(nasty);
  assert.equal(nastyHtml.includes('<b>Bold</b>'), false);
  assert.ok(nastyHtml.includes('&lt;b&gt;Bold&lt;/b&gt;'), 'name is escaped');
});

test('overdue list: one customer with one overdue bill reads the singular count line', () => {
  const summary = calculateOverdueList({
    customers: [{
      id: 'c-one', customerNumber: 1, name: 'Overdue Cust One', mohalla: '', archived: false,
      bills: [{ id: 'b-one', month: '2026-11', dueAmount: 500, status: 'pending', dueDate: '2026-11-05', payments: [] }]
    }]
  }, REF_DATE);
  assert.equal(summary.totalCount, 1);
  assert.equal(summary.rows[0].daysOverdue, 3);
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderOverdueList(doc, summary);
  assert.equal(els.dolOverdueTotal.textContent, 'PKR 500');
  assert.equal(els.dolOverdueLine.textContent, '1 customer');
});

test('overdue list: the view never changes any bill, payment, or customer record', () => {
  const state = buildFixture();
  const before = JSON.stringify(state);
  const summary = calculateOverdueList(state, REF_DATE);
  overdueListSectionHtml(summary);
  const els = {};
  renderOverdueList({ getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false }) }, summary);
  assert.equal(JSON.stringify(state), before);
});

test('overdue list wiring: the view sits on the billing dashboard after the upcoming dues view, and the dashboard renders it', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('id="overdueListSection"'), 'overdue list section exists');
  assert.ok(page.indexOf('id="overdueListSection"') > page.indexOf('id="upcomingDuesSection"'), 'view follows the upcoming dues view');
  assert.ok(page.indexOf('id="overdueListSection"') < page.indexOf('id="multiMonthMatrixSection"'), 'view sits before the matrix section');
  assert.ok(page.includes('id="dolOverdueTotal"'), 'total overdue element exists');
  assert.ok(page.includes('id="dolOverdueLine"'), 'count line exists');
  assert.ok(page.includes('id="dolOverdueRows"'), 'list element exists');
  assert.ok(page.includes('id="dolOverdueEmpty"'), 'empty state exists');
  assert.ok(page.includes('data-i18n="dash_overdue_title"'), 'view title is translated');
  assert.ok(page.includes('data-i18n="dash_overdue_sub"'), 'view subtitle is translated');
  assert.ok(page.includes('data-i18n="dash_overdue_empty"'), 'empty state is translated');
  assert.ok(page.includes('Overdue, oldest first'), 'view title reads Overdue, oldest first');

  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './dashboard-overdue-list.js?v=1.11.0'"), 'dashboard imports the overdue list module at the pinned version');
  assert.ok(app.includes('renderOverdueList(document, calculateOverdueList(state, referenceDate))'), 'renderDashboard fills the overdue list');
});

test('i18n: every dash_overdue_ key used exists in English and Urdu', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const module = readFileSync(new URL('../dashboard-overdue-list.js', import.meta.url), 'utf8');
  const used = new Set();
  for (const match of page.matchAll(/data-i18n="(dash_overdue_[a-z_]+)"/g)) used.add(match[1]);
  // The days and customers sing/plur keys sit inside ternaries in
  // the module, not directly after t(' — so the module scan takes
  // every quoted key.
  for (const match of module.matchAll(/'(dash_overdue_[a-z_]+)'/g)) used.add(match[1]);
  assert.ok(used.size >= 7, `expected at least 7 overdue-list keys, found ${[...used].join(', ')}`);
  for (const key of used) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `missing English key ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `missing Urdu key ${key}`);
  }
});

test('the new module names no fenced module file in its header and reads no storage, clock, or page', () => {
  const module = readFileSync(new URL('../dashboard-overdue-list.js', import.meta.url), 'utf8');
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
