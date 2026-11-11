import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, saveBillMonth, addPayment } from '../core.js';
import {
  calculateCollectorCard,
  collectorCardSectionHtml,
  renderCollectorCard
} from '../dashboard-collector-card.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF_DATE = new Date('2026-11-08T12:00:00Z');
const TODAY = '2026-11-08';
const MONTH = '2026-11';

// Rounds: Adeel Raza collects CHARYAA + GANGALL, Noman Tariq
// collects KISHTII + CHAMYAAA, Usman Ghani collects BARRIAN.
// Bilal Ahmed holds no round at all.
const ASSIGNMENTS = [
  { id: 'asg-476-1', mohalla: 'CHARYAA', collector: 'Adeel Raza' },
  { id: 'asg-476-2', mohalla: 'GANGALL', collector: 'Adeel Raza' },
  { id: 'asg-476-3', mohalla: 'KISHTII', collector: 'Noman Tariq' },
  { id: 'asg-476-4', mohalla: 'CHAMYAAA', collector: 'Noman Tariq' },
  { id: 'asg-476-5', mohalla: 'BARRIAN', collector: 'Usman Ghani' }
];

function buildFixture() {
  let state = createInitialState([
    'Collector Cust A',
    'Collector Cust B',
    'Collector Cust C',
    'Collector Cust D',
    'Collector Cust E',
    'Collector Cust F',
    'Collector Cust G',
    'Collector Cust H',
    'Collector Cust I',
    'Collector Cust J'
  ]);
  const id = (index) => state.customers[index].id;

  // A (CHARYAA): 3000 bill, 1000 paid today by Adeel Raza —
  // Adeel today: 1000, 1 payment; round still owes 2000.
  state.customers[0].mohalla = 'CHARYAA';
  state = saveBillMonth(state, id(0), { month: MONTH, dueAmount: 3000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(0), MONTH, { amount: 1000, date: TODAY, method: 'Cash', collectedBy: 'Adeel Raza' }, REF_DATE);
  // B (CHARYAA): 1500 bill from last month, never paid — still
  // due 1500. Adeel's round totals: still due 3500.
  state.customers[1].mohalla = 'CHARYAA';
  state = saveBillMonth(state, id(1), { month: '2026-10', dueAmount: 1500, status: 'pending', dueDate: '2026-10-05' }, REF_DATE);
  // C (GANGALL): 2000 bill, paid in full today by 'adeel raza'
  // in lower case — the same collector, first spelling kept.
  // Adeel today: 3000, 2 payments; GANGALL owes nothing more.
  state.customers[2].mohalla = 'GANGALL';
  state = saveBillMonth(state, id(2), { month: MONTH, dueAmount: 2000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(2), MONTH, { amount: 2000, date: TODAY, method: 'Cash', collectedBy: 'adeel raza' }, REF_DATE);
  // D (KISHTII): 1000 bill, 400 paid today by Noman Tariq —
  // Noman today: 400, 1 payment; round still owes 600.
  state.customers[3].mohalla = 'KISHTII';
  state = saveBillMonth(state, id(3), { month: MONTH, dueAmount: 1000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(3), MONTH, { amount: 400, date: TODAY, method: 'Cash', collectedBy: 'Noman Tariq' }, REF_DATE);
  // E (KISHTII): 800 bill, 800 paid yesterday by Noman Tariq —
  // not today's money, and the bill is paid in full, so it
  // counts nowhere on the card.
  state.customers[4].mohalla = 'KISHTII';
  state.customers[4].bills.push({
    id: 'bill-collector-yesterday-payment',
    month: MONTH,
    dueAmount: 800,
    status: 'pending',
    dueDate: TODAY,
    payments: [{ id: 'pay-collector-yesterday', date: '2026-11-07', amount: 800, method: 'Cash', collectedBy: 'Noman Tariq' }]
  });
  // F (BARRIAN): 1200 bill, 500 paid today with NO collector
  // recorded — the 500 counts in the day total but under no
  // collector. Usman's round still owes 700.
  state.customers[5].mohalla = 'BARRIAN';
  state = saveBillMonth(state, id(5), { month: MONTH, dueAmount: 1200, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(5), MONTH, { amount: 500, date: TODAY, method: 'Cash' }, REF_DATE);
  // G (KISHTII): 900 bill, 900 paid today by Noman Tariq, then
  // voided — voided receipts are history, never collected cash,
  // and the bill still owes 900. Noman's round totals: still
  // due 1500.
  state.customers[6].mohalla = 'KISHTII';
  state = saveBillMonth(state, id(6), { month: MONTH, dueAmount: 900, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(6), MONTH, { amount: 900, date: TODAY, method: 'Cash', collectedBy: 'Noman Tariq' }, REF_DATE);
  state.customers[6].bills.find((b) => b.month === MONTH).payments[0].voided = true;
  // H (THALII): 700 bill, 700 paid today by Bilal Ahmed, who
  // holds no round — his open dues read PKR 0.
  state.customers[7].mohalla = 'THALII';
  state = saveBillMonth(state, id(7), { month: MONTH, dueAmount: 700, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(7), MONTH, { amount: 700, date: TODAY, method: 'Cash', collectedBy: 'Bilal Ahmed' }, REF_DATE);
  // I (CHARYAA): 5000 bill, 5000 paid today by Adeel Raza —
  // then archived, so the customer never appears and the 5000
  // counts nowhere, not even in Adeel's today figures.
  state.customers[8].mohalla = 'CHARYAA';
  state = saveBillMonth(state, id(8), { month: MONTH, dueAmount: 5000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(8), MONTH, { amount: 5000, date: TODAY, method: 'Cash', collectedBy: 'Adeel Raza' }, REF_DATE);
  state.customers[8].archived = true;
  // J (CHAMYAAA): a free connection with a 1000 bill — a free
  // connection never owes anything, so its bill never counts
  // as due on Noman's round.
  state.customers[9].mohalla = 'CHAMYAAA';
  state.customers[9].isFreeConnection = true;
  state.customers[9].bills.push({
    id: 'bill-collector-free-connection',
    month: MONTH,
    dueAmount: 1000,
    status: 'pending',
    dueDate: TODAY,
    payments: []
  });
  return state;
}

const rowByName = (summary, name) => summary.collectors.find((row) => row.name === name);

test('collector card: each collector\'s figures match that collector\'s own payments for today', () => {
  const summary = calculateCollectorCard(buildFixture(), REF_DATE, ASSIGNMENTS);
  assert.equal(summary.today, TODAY);
  assert.equal(summary.totalCents, 460000);
  assert.equal(summary.totalCount, 5);
  assert.equal(summary.collectorCount, 4);
  assert.deepEqual(rowByName(summary, 'Adeel Raza'), {
    name: 'Adeel Raza',
    collectedCents: 300000,
    paymentCount: 2,
    openDuesCents: 350000,
    openDuesCount: 2,
    roundMohallas: ['CHARYAA', 'GANGALL']
  });
  assert.deepEqual(rowByName(summary, 'Bilal Ahmed'), {
    name: 'Bilal Ahmed',
    collectedCents: 70000,
    paymentCount: 1,
    openDuesCents: 0,
    openDuesCount: 0,
    roundMohallas: []
  });
  assert.deepEqual(rowByName(summary, 'Noman Tariq'), {
    name: 'Noman Tariq',
    collectedCents: 40000,
    paymentCount: 1,
    openDuesCents: 150000,
    openDuesCount: 2,
    roundMohallas: ['CHAMYAAA', 'KISHTII']
  });
  // Usman Ghani holds a round but collected nothing today — he
  // still shows, at zero, never a blank.
  assert.deepEqual(rowByName(summary, 'Usman Ghani'), {
    name: 'Usman Ghani',
    collectedCents: 0,
    paymentCount: 0,
    openDuesCents: 70000,
    openDuesCount: 1,
    roundMohallas: ['BARRIAN']
  });
  // The archived customer and the free connection count nowhere.
  assert.equal(summary.collectors.reduce((sum, row) => sum + row.collectedCents, 0), 410000);
});

test('collector card: rows are ordered by today\'s collections, most first, then name A–Z', () => {
  const summary = calculateCollectorCard(buildFixture(), REF_DATE, ASSIGNMENTS);
  assert.deepEqual(
    summary.collectors.map((row) => row.name),
    ['Adeel Raza', 'Bilal Ahmed', 'Noman Tariq', 'Usman Ghani']
  );
});

test('collector card: a payment with no collector recorded counts in the day total but under no collector', () => {
  const summary = calculateCollectorCard(buildFixture(), REF_DATE, ASSIGNMENTS);
  // The day total holds the 500 with no collector; the rows hold
  // 4100 of it, and no row is unnamed.
  assert.equal(summary.totalCents, 460000);
  assert.equal(summary.collectors.reduce((sum, row) => sum + row.collectedCents, 0), 410000);
  assert.equal(summary.totalCount, 5);
  assert.equal(summary.collectors.reduce((sum, row) => sum + row.paymentCount, 0), 4);
  for (const row of summary.collectors) {
    assert.ok(row.name.length > 0, 'every row names its collector');
  }
});

test('collector card: a business with no customers and no assignments shows no collectors, at zero', () => {
  const summary = calculateCollectorCard({ customers: [] }, REF_DATE, []);
  assert.equal(summary.today, TODAY);
  assert.deepEqual(summary.collectors, []);
  assert.equal(summary.totalCents, 0);
  assert.equal(summary.totalCount, 0);
  assert.equal(summary.collectorCount, 0);
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderCollectorCard(doc, summary);
  assert.equal(els.clcCollectorTotal.textContent, 'PKR 0');
  assert.equal(els.clcCollectorLine.textContent, '0 payments today');
  assert.equal(els.clcCollectorRows.innerHTML, '');
  assert.equal(els.clcCollectorEmpty.hidden, false, 'empty state shows');
});

test('collector card render: PKR figures, line, and round mohallas land in the view', () => {
  const summary = calculateCollectorCard(buildFixture(), REF_DATE, ASSIGNMENTS);
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderCollectorCard(doc, summary);
  assert.equal(els.clcCollectorTotal.textContent, 'PKR 4,600');
  assert.equal(els.clcCollectorLine.textContent, '5 payments today');
  assert.equal(els.clcCollectorEmpty.hidden, true, 'empty state hides while collectors exist');
  const html = els.clcCollectorRows.innerHTML;
  assert.ok(html.includes('Adeel Raza'), 'Adeel row lands');
  assert.ok(html.includes('2 payments · Still due PKR 3,500 · CHARYAA, GANGALL'), 'Adeel figures and round land');
  assert.ok(html.includes('Bilal Ahmed'), 'Bilal row lands');
  assert.ok(html.includes('1 payment · Still due PKR 0 · No mohallas assigned'), 'Bilal figures and no-round land');
  assert.ok(html.includes('Noman Tariq'), 'Noman row lands');
  assert.ok(html.includes('1 payment · Still due PKR 1,500 · CHAMYAAA, KISHTII'), 'Noman figures and round land');
  assert.ok(html.includes('Usman Ghani'), 'Usman row lands');
  assert.ok(html.includes('0 payments · Still due PKR 700 · BARRIAN'), 'Usman zero-day figures land');
  // Rows sit most-collected first.
  assert.ok(html.indexOf('Adeel Raza') < html.indexOf('Bilal Ahmed'), 'Adeel before Bilal');
  assert.ok(html.indexOf('Bilal Ahmed') < html.indexOf('Noman Tariq'), 'Bilal before Noman');
  assert.ok(html.indexOf('Noman Tariq') < html.indexOf('Usman Ghani'), 'Noman before Usman');
  // PKR only — no other currency symbol or code appears anywhere.
  for (const el of Object.values(els)) {
    assert.equal(/\$\d|€|£|USD|EUR|GBP/.test(el.textContent), false, el.textContent);
  }
  assert.equal(/\$\d|€|£|USD|EUR|GBP/.test(html), false);
});

test('collector card: the view never changes any bill, payment, or customer record', () => {
  const state = buildFixture();
  const before = JSON.stringify(state);
  const summary = calculateCollectorCard(state, REF_DATE, ASSIGNMENTS);
  collectorCardSectionHtml(summary);
  const els = {};
  renderCollectorCard({ getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false }) }, summary);
  assert.equal(JSON.stringify(state), before);
});

test('collector card wiring: the card sits on the billing dashboard after the mohalla bars, and the dashboard renders it', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('id="collectorCardSection"'), 'collector card section exists');
  assert.ok(page.indexOf('id="collectorCardSection"') > page.indexOf('id="mohallaBarsSection"'), 'card follows the mohalla bars');
  assert.ok(page.indexOf('id="collectorCardSection"') < page.indexOf('id="collectionForecastSection"'), 'card sits before the forecast section');
  assert.ok(page.includes('id="clcCollectorTotal"'), 'day total element exists');
  assert.ok(page.includes('id="clcCollectorLine"'), 'count line exists');
  assert.ok(page.includes('id="clcCollectorRows"'), 'rows element exists');
  assert.ok(page.includes('id="clcCollectorEmpty"'), 'empty state exists');
  assert.ok(page.includes('data-i18n="dash_collectorcard_title"'), 'card title is translated');
  assert.ok(page.includes('data-i18n="dash_collectorcard_sub"'), 'card subtitle is translated');
  assert.ok(page.includes('data-i18n="dash_collectorcard_empty"'), 'empty state is translated');
  assert.ok(page.includes('Collections by collector today'), 'card title reads Collections by collector today');

  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './dashboard-collector-card.js?v=1.11.0'"), 'dashboard imports the collector card module at the pinned version');
  assert.ok(app.includes('renderCollectorCard(document, calculateCollectorCard(state, referenceDate, loadCollectorAssignments()))'), 'renderDashboard fills the collector card from the assignment list');
});

test('i18n: every dash_collectorcard_ key used exists in English and Urdu', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const module = readFileSync(new URL('../dashboard-collector-card.js', import.meta.url), 'utf8');
  const used = new Set();
  for (const match of page.matchAll(/data-i18n="(dash_collectorcard_[a-z_]+)"/g)) used.add(match[1]);
  // The count, payment, label, and no-round keys sit inside t()
  // calls in the module, not directly after t(' — so the module
  // scan takes every quoted key.
  for (const match of module.matchAll(/'(dash_collectorcard_[a-z_]+)'/g)) used.add(match[1]);
  assert.ok(used.size >= 9, `expected at least 9 collector-card keys, found ${[...used].join(', ')}`);
  for (const key of used) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `missing English key ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `missing Urdu key ${key}`);
  }
});

test('the new module names no fenced module file in its header and reads no storage, clock, or page', () => {
  const module = readFileSync(new URL('../dashboard-collector-card.js', import.meta.url), 'utf8');
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

test('collector card: the unassigned remainder is an explicit row, and rows reconcile to the header total', () => {
  // Home Dashboard overhaul, Part 1: the header said PKR 1,500
  // (1 payment) while the only row read "Cash home: PKR 0" —
  // payments with no collector counted in the total but under no
  // row. The remainder is now an explicit "No collector recorded"
  // row, so rows + remainder always equal the header.
  const summary = calculateCollectorCard(buildFixture(), REF_DATE, ASSIGNMENTS);
  assert.equal(summary.totalCents, 460000);
  assert.equal(summary.totalCount, 5);
  assert.equal(summary.unassignedCents, 50000, 'the 500 with no collector is the remainder');
  assert.equal(summary.unassignedCount, 1);
  assert.equal(
    summary.collectors.reduce((sum, row) => sum + row.collectedCents, 0) + summary.unassignedCents,
    summary.totalCents,
    'rows plus remainder reconcile to the header total'
  );
  assert.equal(
    summary.collectors.reduce((sum, row) => sum + row.paymentCount, 0) + summary.unassignedCount,
    summary.totalCount,
    'row counts plus remainder reconcile to the header count'
  );
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderCollectorCard(doc, summary);
  const html = els.clcCollectorRows.innerHTML;
  assert.ok(html.includes('No collector recorded'), 'unassigned row lands with its label');
  assert.ok(html.includes('PKR 500'), 'unassigned row carries the remainder amount');
  assert.ok(html.includes('1 payment'), 'unassigned row carries its count');
  assert.ok(html.indexOf('Usman Ghani') < html.indexOf('No collector recorded'), 'unassigned row sits last, after the named collectors');
});
