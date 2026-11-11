import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, saveBillMonth, addPayment, calculateDashboard } from '../core.js';
import { calculateDashboardTodayCard, renderDashboardTodayCard } from '../dashboard-today-card.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF_DATE = new Date('2026-11-08T12:00:00Z');
const TODAY = '2026-11-08';

function buildFixture() {
  let state = createInitialState([
    'Today Cust A',
    'Today Cust B',
    'Today Cust C',
    'Today Cust D',
    'Today Cust E',
    'Today Cust F',
    'Today Cust G',
    'Today Cust H'
  ]);
  const id = (index) => state.customers[index].id;

  // A: bill 2000 due today, paid 1500.50 today — 499.50 still due today.
  state = saveBillMonth(state, id(0), { month: '2026-11', dueAmount: 2000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(0), '2026-11', { amount: 1500.50, date: TODAY, method: 'Cash' }, REF_DATE);
  // B: bill 1000 due today, nothing paid — 1000 due today.
  state = saveBillMonth(state, id(1), { month: '2026-11', dueAmount: 1000, status: 'pending', dueDate: TODAY }, REF_DATE);
  // C: bill 3000 due yesterday — not due today.
  state = saveBillMonth(state, id(2), { month: '2026-11', dueAmount: 3000, status: 'pending', dueDate: '2026-11-07' }, REF_DATE);
  // D: bill 500 due today, paid in full today — nothing due, payment counts.
  state = saveBillMonth(state, id(3), { month: '2026-11', dueAmount: 500, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(3), '2026-11', { amount: 500, date: TODAY, method: 'Cash' }, REF_DATE);
  // E: bill 800 due tomorrow, paid 700 yesterday — neither today figure.
  state = saveBillMonth(state, id(4), { month: '2026-11', dueAmount: 800, status: 'pending', dueDate: '2026-11-09' }, REF_DATE);
  state = addPayment(state, id(4), '2026-11', { amount: 700, date: '2026-11-07', method: 'Cash' }, REF_DATE);
  // F: bill 1200 due 6 Nov, paid 200 today then voided — voided is
  // history, never collected cash (SISP-34).
  state = saveBillMonth(state, id(5), { month: '2026-11', dueAmount: 1200, status: 'pending', dueDate: '2026-11-06' }, REF_DATE);
  state = addPayment(state, id(5), '2026-11', { amount: 200, date: TODAY, method: 'Cash' }, REF_DATE);
  state.customers[5].bills.find((b) => b.month === '2026-11').payments[0].voided = true;
  // G: bill 900 due today, paid 400 today — then archived, so the card
  // never shows this customer (the daily closing rule, which this card
  // follows, skips archived customers).
  state = saveBillMonth(state, id(6), { month: '2026-11', dueAmount: 900, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(6), '2026-11', { amount: 400, date: TODAY, method: 'Cash' }, REF_DATE);
  state.customers[6].archived = true;
  // H: an unpriced bill due today carries no amount — nothing is due.
  state.customers[7].bills.push({
    id: 'bill-today-unpriced',
    month: '2026-11',
    dueAmount: null,
    status: 'pending',
    dueDate: TODAY,
    payments: []
  });
  return state;
}

test('today card: collections, payment count and dues due today match the ledger records', () => {
  const summary = calculateDashboardTodayCard(buildFixture(), REF_DATE);
  assert.equal(summary.today, TODAY);
  // Collected today: A 1500.50 + D 500 — paisa exact. F is voided,
  // G is archived, E paid yesterday.
  assert.equal(summary.todayCollectedCents, 200050);
  assert.equal(summary.todayPaymentCount, 2);
  // Due today: A 499.50 + B 1000. D is paid in full, C was due
  // yesterday, E is due tomorrow, H is unpriced, G is archived.
  assert.equal(summary.duesDueTodayCents, 149950);
  assert.equal(summary.duesDueTodayCount, 2);
});

test('today card: a day with no payments yet shows zero, not a blank', () => {
  const summary = calculateDashboardTodayCard({ customers: [] }, REF_DATE);
  assert.deepEqual(summary, {
    today: TODAY,
    todayCollectedCents: 0,
    todayPaymentCount: 0,
    duesDueTodayCents: 0,
    duesDueTodayCount: 0
  });
  const els = {};
  const doc = { getElementById: (id) => (els[id] ??= { textContent: '' }) };
  renderDashboardTodayCard(doc, summary);
  assert.equal(els.dtcTodayCollected.textContent, 'PKR 0');
  assert.equal(els.dtcTodayCount.textContent, '0');
  assert.equal(els.dtcDuesDueToday.textContent, 'PKR 0');
  assert.equal(els.dtcTodayPeriod.textContent, 'Payments dated 2026-11-08');
});

test('today card render: PKR figures, count and date land in the card elements', () => {
  const summary = calculateDashboardTodayCard(buildFixture(), REF_DATE);
  const els = {};
  const doc = { getElementById: (id) => (els[id] ??= { textContent: '' }) };
  renderDashboardTodayCard(doc, summary);
  assert.equal(els.dtcTodayCollected.textContent, 'PKR 2,000.50');
  assert.equal(els.dtcTodayCount.textContent, '2');
  assert.equal(els.dtcDuesDueToday.textContent, 'PKR 1,499.50');
  assert.equal(els.dtcTodayPeriod.textContent, 'Payments dated 2026-11-08');
  // PKR only — no other currency symbol or code appears anywhere.
  for (const el of Object.values(els)) {
    assert.equal(/\$|€|£|USD|EUR|GBP/.test(el.textContent), false, el.textContent);
  }
});

test('today card: a bill due today paid in part counts only its remainder', () => {
  let state = createInitialState(['Today Cust Part']);
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-11', dueAmount: 3000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, state.customers[0].id, '2026-11', { amount: 1200, date: TODAY, method: 'JazzCash' }, REF_DATE);
  const summary = calculateDashboardTodayCard(state, REF_DATE);
  assert.equal(summary.todayCollectedCents, 120000);
  assert.equal(summary.todayPaymentCount, 1);
  assert.equal(summary.duesDueTodayCents, 180000);
  assert.equal(summary.duesDueTodayCount, 1);
});

test('today card: a bill with no due date is never due today', () => {
  let state = createInitialState(['Today Cust Nodate']);
  state = saveBillMonth(state, state.customers[0].id, { month: '2026-11', dueAmount: 2500, status: 'pending' }, REF_DATE);
  // saveBillMonth defaults an unset due date to the 5th of the month.
  assert.equal(state.customers[0].bills[0].dueDate, '2026-11-05');
  const summary = calculateDashboardTodayCard(state, REF_DATE);
  assert.equal(summary.duesDueTodayCents, 0);
  assert.equal(summary.duesDueTodayCount, 0);
});

test('today card: the card never changes any bill, payment, or customer record', () => {
  const state = buildFixture();
  const before = JSON.stringify(state);
  calculateDashboardTodayCard(state, REF_DATE);
  const els = {};
  renderDashboardTodayCard({ getElementById: (id) => (els[id] ??= { textContent: '' }) }, calculateDashboardTodayCard(state, REF_DATE));
  assert.equal(JSON.stringify(state), before);
});

test('today card wiring: the card is deleted from Home and the dashboard no longer renders it', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  // Home Dashboard overhaul: the today card was a duplicate of
  // the KPI strip (Today Collected) and the home-today section —
  // the grid card is DELETED. Its figures live in the KPI strip
  // and the Top 3 preview. The module stays for its own unit
  // tests; renderDashboard no longer imports or calls it.
  assert.ok(!page.includes('summary-today-card'), 'today card is gone from the grid');
  assert.ok(!page.includes('id="dtcTodayCollected"'), 'collected figure element is gone');
  assert.ok(!page.includes('id="dtcTodayCount"'), 'payment count element is gone');
  assert.ok(!page.includes('id="dtcDuesDueToday"'), 'dues due today element is gone');
  assert.ok(!page.includes('id="dtcTodayPeriod"'), 'period line is gone');

  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(!app.includes("from './dashboard-today-card.js?v=1.11.0'"), 'dashboard no longer imports the today card module');
  assert.ok(!app.includes('renderDashboardTodayCard(document, calculateDashboardTodayCard(state, referenceDate))'), 'renderDashboard no longer fills the deleted card');
});

test('i18n: every dash_todaycard_ key used exists in English and Urdu', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const module = readFileSync(new URL('../dashboard-today-card.js', import.meta.url), 'utf8');
  const used = new Set();
  for (const match of page.matchAll(/data-i18n="(dash_todaycard_[a-z_]+)"/g)) used.add(match[1]);
  for (const match of module.matchAll(/t\('(dash_todaycard_[a-z_]+)'/g)) used.add(match[1]);
  // Home Dashboard overhaul: the card's title/payments/due keys
  // left the page with the deleted card — only the period key the
  // module itself renders remains to pin.
  assert.ok(used.size >= 1, `expected at least 1 today-card key, found ${[...used].join(', ')}`);
  for (const key of used) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `missing English key ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `missing Urdu key ${key}`);
  }
});

test('the new module names no fenced module file in its header and reads no storage, clock, or page', () => {
  const module = readFileSync(new URL('../dashboard-today-card.js', import.meta.url), 'utf8');
  const header = module.slice(0, module.indexOf('*/'));
  assert.equal(header.includes('.js'), false, 'header names no module file');
  assert.equal(module.includes('full-history-list.js'), false);
  assert.equal(module.includes('localStorage'), false);
  assert.equal(module.includes('document'), false);
  assert.equal(module.includes('window'), false);
  // Plan 248: the clock check is `new Date(` / `Date.now(` — a bare
  // `Date(` also matches a pure function call, not a clock read.
  assert.equal(module.includes('new Date('), false);
  assert.equal(module.includes('Date.now'), false);
  // The header is a /* */ block, never // line comments.
  assert.ok(module.startsWith('/*'), 'header is a block comment');
  // PKR only — no other currency symbol or code in the module source.
  assert.equal(/\$|€|£|USD|EUR|GBP/.test(module), false);
});
