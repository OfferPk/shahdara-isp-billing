import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, saveBillMonth, addPayment } from '../core.js';
import {
  calculateMohallaBars,
  mohallaBarsSectionHtml,
  renderMohallaBars
} from '../dashboard-mohalla-bars.js';
import { DEFAULT_MOHALLAS, canonicalMohalla } from '../phase3.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF_DATE = new Date('2026-11-08T12:00:00Z');
const TODAY = '2026-11-08';
const MONTH = '2026-11';

const mohallaLabel = (name) => canonicalMohalla(name).label;

function buildFixture() {
  let state = createInitialState([
    'Mohalla Cust A',
    'Mohalla Cust B',
    'Mohalla Cust C',
    'Mohalla Cust D',
    'Mohalla Cust E',
    'Mohalla Cust F',
    'Mohalla Cust G',
    'Mohalla Cust H',
    'Mohalla Cust I',
    'Mohalla Cust J'
  ]);
  const id = (index) => state.customers[index].id;

  // A (CHARYAA): 3000 bill, 1000 paid this month — collected 1000,
  // still due 2000.
  state.customers[0].mohalla = 'CHARYAA';
  state = saveBillMonth(state, id(0), { month: MONTH, dueAmount: 3000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(0), MONTH, { amount: 1000, date: '2026-11-05', method: 'Cash' }, REF_DATE);
  // B (CHARYAA): 1500 bill from last month, never paid — still due
  // 1500. CHARYAA totals: collected 1000, due 3500.
  state.customers[1].mohalla = 'CHARYAA';
  state = saveBillMonth(state, id(1), { month: '2026-10', dueAmount: 1500, status: 'pending', dueDate: '2026-10-05' }, REF_DATE);
  // C (GANGALL): 2000 bill, paid in full this month — collected
  // 2000, due 0.
  state.customers[2].mohalla = 'GANGALL';
  state = saveBillMonth(state, id(2), { month: MONTH, dueAmount: 2000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(2), MONTH, { amount: 2000, date: '2026-11-02', method: 'Cash' }, REF_DATE);
  // D (GANGALL): 500 bill, 600 paid this month — an overpayment is
  // collected cash, and the bill owes nothing more. GANGALL
  // totals: collected 2600, due 0.
  state.customers[3].mohalla = 'GANGALL';
  state = saveBillMonth(state, id(3), { month: MONTH, dueAmount: 500, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(3), MONTH, { amount: 600, date: '2026-11-03', method: 'Cash' }, REF_DATE);
  // E (KISHTII): 1000 bill, 400 paid — but dated last month, so the
  // payment is not this month's collected, while the bill still
  // owes 600.
  state.customers[4].mohalla = 'KISHTII';
  state.customers[4].bills.push({
    id: 'bill-mohalla-last-month-payment',
    month: MONTH,
    dueAmount: 1000,
    status: 'pending',
    dueDate: TODAY,
    payments: [{ id: 'pay-mohalla-last-month', date: '2026-10-31', amount: 400, method: 'Cash' }]
  });
  // F (KISHTII): 800 bill, 800 paid this month, then voided —
  // voided receipts are history, never collected cash, and the
  // bill still owes 800. KISHTII totals: collected 0, due 1400.
  state.customers[5].mohalla = 'KISHTII';
  state = saveBillMonth(state, id(5), { month: MONTH, dueAmount: 800, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(5), MONTH, { amount: 800, date: '2026-11-04', method: 'Cash' }, REF_DATE);
  state.customers[5].bills.find((b) => b.month === MONTH).payments[0].voided = true;
  // G (BARRIAN): a bill with no usable month — no month is ever
  // invented, so it contributes nothing. BARRIAN reads zero.
  state.customers[6].mohalla = 'BARRIAN';
  state.customers[6].bills.push({
    id: 'bill-mohalla-no-month',
    month: '',
    dueAmount: 999,
    status: 'pending',
    dueDate: TODAY,
    payments: []
  });
  // H (NOWHERE — no mohalla on the canonical list): 700 bill, 200
  // paid this month — lands in the unassigned row.
  state.customers[7].mohalla = 'NOWHERE';
  state = saveBillMonth(state, id(7), { month: MONTH, dueAmount: 700, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(7), MONTH, { amount: 200, date: '2026-11-06', method: 'Cash' }, REF_DATE);
  // I (THALII): 900 bill, paid in full — then archived, so the
  // customer never appears and the 900 counts nowhere.
  state.customers[8].mohalla = 'THALII';
  state = saveBillMonth(state, id(8), { month: MONTH, dueAmount: 900, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(8), MONTH, { amount: 900, date: '2026-11-02', method: 'Cash' }, REF_DATE);
  state.customers[8].archived = true;
  // J (CHAMYAAA): a free connection with a 1000 bill — a free
  // connection never owes anything, so its bill never counts
  // as due.
  state.customers[9].mohalla = 'CHAMYAAA';
  state.customers[9].isFreeConnection = true;
  state.customers[9].bills.push({
    id: 'bill-mohalla-free-connection',
    month: MONTH,
    dueAmount: 1000,
    status: 'pending',
    dueDate: TODAY,
    payments: []
  });
  return state;
}

const rowByLabel = (summary, label) => summary.rows.find((row) => row.label === label);

test('mohalla bars: each mohalla\'s two figures match that mohalla\'s own records', () => {
  const summary = calculateMohallaBars(buildFixture(), REF_DATE);
  assert.equal(summary.month, MONTH);
  assert.deepEqual(rowByLabel(summary, mohallaLabel('CHARYAA')), {
    key: canonicalMohalla('CHARYAA').key,
    label: mohallaLabel('CHARYAA'),
    collectedCents: 100000,
    dueCents: 350000,
    collectedPercent: 22
  });
  assert.deepEqual(rowByLabel(summary, mohallaLabel('GANGALL')), {
    key: canonicalMohalla('GANGALL').key,
    label: mohallaLabel('GANGALL'),
    collectedCents: 260000,
    dueCents: 0,
    collectedPercent: 100
  });
  assert.deepEqual(rowByLabel(summary, mohallaLabel('KISHTII')), {
    key: canonicalMohalla('KISHTII').key,
    label: mohallaLabel('KISHTII'),
    collectedCents: 0,
    dueCents: 140000,
    collectedPercent: 0
  });
  assert.deepEqual(rowByLabel(summary, mohallaLabel('BARRIAN')), {
    key: canonicalMohalla('BARRIAN').key,
    label: mohallaLabel('BARRIAN'),
    collectedCents: 0,
    dueCents: 0,
    collectedPercent: 0
  });
  // The unmapped mohalla lands in the unassigned row, last.
  assert.deepEqual(rowByLabel(summary, 'Unassigned'), {
    key: '__unassigned__',
    label: 'Unassigned',
    collectedCents: 20000,
    dueCents: 50000,
    collectedPercent: 29
  });
  // The archived customer and the free connection count nowhere.
  assert.equal(rowByLabel(summary, mohallaLabel('THALII')).collectedCents, 0);
  assert.equal(rowByLabel(summary, mohallaLabel('THALII')).dueCents, 0);
  assert.equal(rowByLabel(summary, mohallaLabel('CHAMYAAA')).collectedCents, 0);
  assert.equal(rowByLabel(summary, mohallaLabel('CHAMYAAA')).dueCents, 0);
});

test('mohalla bars: rows follow the canonical list in order with unassigned last, and the totals equal the sums', () => {
  const summary = calculateMohallaBars(buildFixture(), REF_DATE);
  assert.deepEqual(
    summary.rows.map((row) => row.label),
    [...DEFAULT_MOHALLAS.map((name) => mohallaLabel(name)), 'Unassigned']
  );
  assert.equal(summary.mohallaCount, DEFAULT_MOHALLAS.length + 1);
  assert.equal(summary.totalCollectedCents, 380000);
  assert.equal(summary.totalDueCents, 540000);
  assert.equal(
    summary.rows.reduce((sum, row) => sum + row.collectedCents, 0),
    summary.totalCollectedCents
  );
  assert.equal(
    summary.rows.reduce((sum, row) => sum + row.dueCents, 0),
    summary.totalDueCents
  );
});

test('mohalla bars: a business with no customers still shows every mohalla at zero, never a blank', () => {
  const summary = calculateMohallaBars({ customers: [] }, REF_DATE);
  assert.equal(summary.month, MONTH);
  assert.equal(summary.rows.length, DEFAULT_MOHALLAS.length);
  assert.equal(summary.mohallaCount, DEFAULT_MOHALLAS.length);
  assert.equal(summary.totalCollectedCents, 0);
  assert.equal(summary.totalDueCents, 0);
  for (const row of summary.rows) {
    assert.equal(row.collectedCents, 0);
    assert.equal(row.dueCents, 0);
    assert.equal(row.collectedPercent, 0);
  }
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderMohallaBars(doc, summary);
  assert.equal(els.mdbMohallaTotal.textContent, 'PKR 0');
  assert.ok(els.mdbMohallaLine.textContent.includes('PKR 0'), 'line reads PKR 0 collected');
  const html = els.mdbMohallaRows.innerHTML;
  assert.equal(html.split('PKR 0').length - 1, DEFAULT_MOHALLAS.length * 2, 'every mohalla reads PKR 0 twice');
  assert.equal(html.split('width: 0%').length - 1, DEFAULT_MOHALLAS.length, 'every bar is empty');
});

test('mohalla bars render: PKR figures, line, and bar widths land in the view', () => {
  const summary = calculateMohallaBars(buildFixture(), REF_DATE);
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderMohallaBars(doc, summary);
  assert.equal(els.mdbMohallaTotal.textContent, 'PKR 5,400');
  assert.equal(els.mdbMohallaLine.textContent, 'PKR 3,800 collected this month · 16 mohallas');
  const html = els.mdbMohallaRows.innerHTML;
  assert.ok(html.includes(mohallaLabel('CHARYAA')), 'Charyaa row lands');
  assert.ok(html.includes('Collected PKR 1,000 · Still due PKR 3,500'), 'Charyaa figures land');
  assert.ok(html.includes('aria-valuenow="22"'), 'Charyaa bar is 22%');
  assert.ok(html.includes('Collected PKR 2,600 · Still due PKR 0'), 'Gangall figures land');
  assert.ok(html.includes('aria-valuenow="100"'), 'Gangall bar is full');
  assert.ok(html.includes('Collected PKR 0 · Still due PKR 1,400'), 'Kishtii figures land');
  assert.ok(html.includes('Unassigned'), 'unassigned row lands');
  assert.ok(html.includes('Collected PKR 200 · Still due PKR 500'), 'unassigned figures land');
  // PKR only — no other currency symbol or code appears anywhere.
  for (const el of Object.values(els)) {
    assert.equal(/\$\d|€|£|USD|EUR|GBP/.test(el.textContent), false, el.textContent);
  }
  assert.equal(/\$\d|€|£|USD|EUR|GBP/.test(html), false);
});

test('mohalla bars: the view never changes any bill, payment, or customer record', () => {
  const state = buildFixture();
  const before = JSON.stringify(state);
  const summary = calculateMohallaBars(state, REF_DATE);
  mohallaBarsSectionHtml(summary);
  const els = {};
  renderMohallaBars({ getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false }) }, summary);
  assert.equal(JSON.stringify(state), before);
});

test('mohalla bars wiring: the bars sit on the billing dashboard after the method strip, and the dashboard renders them', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('id="mohallaBarsSection"'), 'mohalla bars section exists');
  assert.ok(page.indexOf('id="mohallaBarsSection"') > page.indexOf('id="methodStripSection"'), 'bars follow the method strip');
  assert.ok(page.indexOf('id="mohallaBarsSection"') < page.indexOf('id="collectionForecastSection"'), 'bars sit before the forecast section');
  assert.ok(page.includes('id="mdbMohallaTotal"'), 'still-due total element exists');
  assert.ok(page.includes('id="mdbMohallaLine"'), 'collected line exists');
  assert.ok(page.includes('id="mdbMohallaRows"'), 'rows element exists');
  assert.ok(page.includes('data-i18n="dash_mohallabars_title"'), 'bars title is translated');
  assert.ok(page.includes('data-i18n="dash_mohallabars_sub"'), 'bars subtitle is translated');
  assert.ok(page.includes('Dues by mohalla'), 'bars title reads Dues by mohalla');

  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './dashboard-mohalla-bars.js?v=1.11.0'"), 'dashboard imports the mohalla bars module at the pinned version');
  assert.ok(app.includes('renderMohallaBars(document, calculateMohallaBars(state, referenceDate))'), 'renderDashboard fills the mohalla bars');
});

test('i18n: every dash_mohallabars_ key used exists in English and Urdu', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const module = readFileSync(new URL('../dashboard-mohalla-bars.js', import.meta.url), 'utf8');
  const used = new Set();
  for (const match of page.matchAll(/data-i18n="(dash_mohallabars_[a-z_]+)"/g)) used.add(match[1]);
  // The label and line keys sit inside template literals and t()
  // calls in the module, not directly after t(' — so the module
  // scan takes every quoted key.
  for (const match of module.matchAll(/'(dash_mohallabars_[a-z_]+)'/g)) used.add(match[1]);
  assert.ok(used.size >= 5, `expected at least 5 mohalla-bars keys, found ${[...used].join(', ')}`);
  for (const key of used) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `missing English key ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `missing Urdu key ${key}`);
  }
});

test('the new module names no fenced module file in its header and reads no storage, clock, or page', () => {
  const module = readFileSync(new URL('../dashboard-mohalla-bars.js', import.meta.url), 'utf8');
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
