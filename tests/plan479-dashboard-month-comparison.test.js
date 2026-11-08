import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, saveBillMonth, addPayment, saveMonthlyClosing } from '../core.js';
import {
  calculateMonthComparison,
  monthComparisonDifferenceText,
  renderMonthComparison
} from '../dashboard-month-comparison.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF_DATE = new Date('2026-11-08T12:00:00Z');
const TODAY = '2026-11-08';
const MONTH = '2026-11';
const PREV_MONTH = '2026-10';

// The ledger's own monthly total, read independently of the
// module under test: non-voided payments grouped by their
// payment date, in integer cents.
function ledgerMonthCents(state, month) {
  let cents = 0;
  for (const customer of state.customers ?? []) {
    for (const bill of customer.bills ?? []) {
      for (const payment of bill.payments ?? []) {
        if (payment?.voided === true) continue;
        if (typeof payment?.date !== 'string' || payment.date.slice(0, 7) !== month) continue;
        cents += Math.round(Number(payment.amount || 0) * 100);
      }
    }
  }
  return cents;
}

function buildFixture() {
  let state = createInitialState([
    'Nov Full A',
    'Oct Full B',
    'Nov Paisa C',
    'Oct Full D',
    'Cross Month E',
    'Voided F',
    'Archived G',
    'Zero H'
  ]);
  const id = (index) => state.customers[index].id;

  // A: 3000 bill this month, paid in full this month — current +3000.
  state = saveBillMonth(state, id(0), { month: MONTH, dueAmount: 3000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(0), MONTH, { amount: 3000, date: '2026-11-02', method: 'Cash' }, REF_DATE);
  // B: 2000 bill last month, paid in full last month — previous +2000.
  state = saveBillMonth(state, id(1), { month: PREV_MONTH, dueAmount: 2000, status: 'pending', dueDate: '2026-10-05' }, REF_DATE);
  state = addPayment(state, id(1), PREV_MONTH, { amount: 2000, date: '2026-10-15', method: 'Cash' }, REF_DATE);
  // C: a paisa-exact 1500.50 bill this month, paid in full this
  // month — current +1500.50.
  state = saveBillMonth(state, id(2), { month: MONTH, dueAmount: 1500.5, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(2), MONTH, { amount: 1500.5, date: '2026-11-05', method: 'Cash' }, REF_DATE);
  // D: 1000 bill last month, paid in full last month — previous +1000.
  state = saveBillMonth(state, id(3), { month: PREV_MONTH, dueAmount: 1000, status: 'pending', dueDate: '2026-10-28' }, REF_DATE);
  state = addPayment(state, id(3), PREV_MONTH, { amount: 1000, date: '2026-10-28', method: 'Cash' }, REF_DATE);
  // E: an October bill paid in November — the payment date rules
  // the ledger's monthly total, so it counts this month, never
  // last month: current +1000.
  state = saveBillMonth(state, id(4), { month: PREV_MONTH, dueAmount: 1000, status: 'pending', dueDate: '2026-10-05' }, REF_DATE);
  state = addPayment(state, id(4), PREV_MONTH, { amount: 1000, date: '2026-11-03', method: 'Cash' }, REF_DATE);
  // F: 800 bill this month, 800 paid this month, then voided — a
  // voided receipt is history, never collected cash.
  state = saveBillMonth(state, id(5), { month: MONTH, dueAmount: 800, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(5), MONTH, { amount: 800, date: '2026-11-04', method: 'Cash' }, REF_DATE);
  state.customers[5].bills.find((b) => b.month === MONTH).payments[0].voided = true;
  // G: 700 bill last month, paid in full last month, then
  // archived — the ledger counts real cash even from a customer
  // archived since, so previous +700.
  state = saveBillMonth(state, id(6), { month: PREV_MONTH, dueAmount: 700, status: 'pending', dueDate: '2026-10-10' }, REF_DATE);
  state = addPayment(state, id(6), PREV_MONTH, { amount: 700, date: '2026-10-10', method: 'Cash' }, REF_DATE);
  state.customers[6].archived = true;
  // H: 1200 bill with a zero-amount payment record this month —
  // a zero-amount record adds nothing. (addPayment rejects a
  // zero amount, so the record is placed directly, as the
  // quiet-customers fixture does.)
  state = saveBillMonth(state, id(7), { month: MONTH, dueAmount: 1200, status: 'pending', dueDate: TODAY }, REF_DATE);
  state.customers[7].bills.find((b) => b.month === MONTH).payments.push({ id: 'pay-monthcompare-zero', date: '2026-11-05', amount: 0, method: 'Cash' });
  return state;
}

test('month comparison: both figures match the ledger\'s own monthly totals on the same fixture', () => {
  const state = buildFixture();
  const summary = calculateMonthComparison(state, REF_DATE);
  assert.equal(summary.currentMonth, MONTH);
  assert.equal(summary.previousMonth, PREV_MONTH);
  assert.equal(summary.currentCents, ledgerMonthCents(state, MONTH));
  assert.equal(summary.previousCents, ledgerMonthCents(state, PREV_MONTH));
  assert.equal(summary.currentCents, 550050);
  assert.equal(summary.previousCents, 370000);
  assert.equal(summary.differenceCents, 180050);
  assert.equal(summary.direction, 'more');
  assert.equal(monthComparisonDifferenceText(summary), 'PKR 1,800.50 more than last month');
});

test('month comparison: a voided payment and a zero-amount payment never count as collections', () => {
  let state = createInitialState(['Voided Only A', 'Zero Only B']);
  const id = (index) => state.customers[index].id;
  state = saveBillMonth(state, id(0), { month: MONTH, dueAmount: 800, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(0), MONTH, { amount: 800, date: '2026-11-04', method: 'Cash' }, REF_DATE);
  state.customers[0].bills.find((b) => b.month === MONTH).payments[0].voided = true;
  state = saveBillMonth(state, id(1), { month: MONTH, dueAmount: 1200, status: 'pending', dueDate: TODAY }, REF_DATE);
  state.customers[1].bills.find((b) => b.month === MONTH).payments.push({ id: 'pay-zero-only', date: '2026-11-05', amount: 0, method: 'Cash' });
  const summary = calculateMonthComparison(state, REF_DATE);
  assert.equal(summary.currentCents, 0);
  assert.equal(summary.previousCents, 0);
  assert.equal(summary.differenceCents, 0);
  assert.equal(summary.direction, 'same');
  assert.equal(monthComparisonDifferenceText(summary), 'Same as last month');
});

test('month comparison: the difference in words says less when last month collected more', () => {
  let state = createInitialState(['Down A', 'Down B']);
  const id = (index) => state.customers[index].id;
  state = saveBillMonth(state, id(0), { month: MONTH, dueAmount: 1000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(0), MONTH, { amount: 1000, date: '2026-11-02', method: 'Cash' }, REF_DATE);
  state = saveBillMonth(state, id(1), { month: PREV_MONTH, dueAmount: 2500, status: 'pending', dueDate: '2026-10-05' }, REF_DATE);
  state = addPayment(state, id(1), PREV_MONTH, { amount: 2500, date: '2026-10-15', method: 'Cash' }, REF_DATE);
  const summary = calculateMonthComparison(state, REF_DATE);
  assert.equal(summary.currentCents, 100000);
  assert.equal(summary.previousCents, 250000);
  assert.equal(summary.differenceCents, -150000);
  assert.equal(summary.direction, 'less');
  assert.equal(monthComparisonDifferenceText(summary), 'PKR 1,500 less than last month');
});

test('month comparison: equal months read the same, in plain words', () => {
  let state = createInitialState(['Even A', 'Even B']);
  const id = (index) => state.customers[index].id;
  state = saveBillMonth(state, id(0), { month: MONTH, dueAmount: 2000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(0), MONTH, { amount: 2000, date: '2026-11-02', method: 'Cash' }, REF_DATE);
  state = saveBillMonth(state, id(1), { month: PREV_MONTH, dueAmount: 2000, status: 'pending', dueDate: '2026-10-05' }, REF_DATE);
  state = addPayment(state, id(1), PREV_MONTH, { amount: 2000, date: '2026-10-15', method: 'Cash' }, REF_DATE);
  const summary = calculateMonthComparison(state, REF_DATE);
  assert.equal(summary.differenceCents, 0);
  assert.equal(summary.direction, 'same');
  assert.equal(monthComparisonDifferenceText(summary), 'Same as last month');
});

test('month comparison: a payment counts in the month of its date, never its bill month', () => {
  let state = createInitialState(['Cross Only A']);
  const id = (index) => state.customers[index].id;
  // An October bill paid in November: November takes it.
  state = saveBillMonth(state, id(0), { month: PREV_MONTH, dueAmount: 1000, status: 'pending', dueDate: '2026-10-05' }, REF_DATE);
  state = addPayment(state, id(0), PREV_MONTH, { amount: 1000, date: '2026-11-03', method: 'Cash' }, REF_DATE);
  const summary = calculateMonthComparison(state, REF_DATE);
  assert.equal(summary.currentCents, 100000);
  assert.equal(summary.previousCents, 0);
});

test('month comparison: January compares with last December', () => {
  const janRef = new Date('2027-01-08T12:00:00Z');
  let state = createInitialState(['Dec Cust', 'Jan Cust']);
  const id = (index) => state.customers[index].id;
  state = saveBillMonth(state, id(0), { month: '2026-12', dueAmount: 4000, status: 'pending', dueDate: '2026-12-05' }, janRef);
  state = addPayment(state, id(0), '2026-12', { amount: 4000, date: '2026-12-20', method: 'Cash' }, janRef);
  state = saveBillMonth(state, id(1), { month: '2027-01', dueAmount: 2500, status: 'pending', dueDate: '2027-01-08' }, janRef);
  state = addPayment(state, id(1), '2027-01', { amount: 2500, date: '2027-01-05', method: 'Cash' }, janRef);
  const summary = calculateMonthComparison(state, janRef);
  assert.equal(summary.currentMonth, '2027-01');
  assert.equal(summary.previousMonth, '2026-12');
  assert.equal(summary.currentCents, 250000);
  assert.equal(summary.previousCents, 400000);
  assert.equal(summary.direction, 'less');
  assert.equal(monthComparisonDifferenceText(summary), 'PKR 1,500 less than last month');
});

test('month comparison: a closed previous month reads its saved closing total', () => {
  let state = buildFixture();
  // Close October at its live total (3700), then a late October
  // payment is recorded afterwards — the closed month's official
  // total stands, while this month still reads the live ledger.
  state = saveMonthlyClosing(state, PREV_MONTH, REF_DATE);
  state.customers[1].bills.find((b) => b.month === PREV_MONTH).payments.push({
    id: 'pay-late-october', date: '2026-10-31', amount: 500, method: 'Cash'
  });
  const summary = calculateMonthComparison(state, REF_DATE);
  assert.equal(summary.previousCents, 370000);
  assert.equal(summary.currentCents, 550050);
  assert.equal(ledgerMonthCents(state, PREV_MONTH), 420000, 'the live ledger moved on, the closed total did not');
});

test('month comparison render: PKR figures, line, and difference land in the view', () => {
  const summary = calculateMonthComparison(buildFixture(), REF_DATE);
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderMonthComparison(doc, summary);
  assert.equal(els.mvcMonthTotal.textContent, 'PKR 5,500.50');
  assert.equal(els.mvcMonthLine.textContent, 'This month PKR 5,500.50 · Last month PKR 3,700');
  assert.equal(els.mvcMonthDiff.textContent, 'PKR 1,800.50 more than last month');
  // PKR only — no other currency symbol or code appears anywhere.
  for (const el of Object.values(els)) {
    assert.equal(/\$\d|€|£|USD|EUR|GBP/.test(el.textContent), false, el.textContent);
  }
});

test('month comparison render: a month with no collections reads zero and the same', () => {
  const summary = calculateMonthComparison({ customers: [] }, REF_DATE);
  assert.equal(summary.currentMonth, MONTH);
  assert.equal(summary.currentCents, 0);
  assert.equal(summary.previousCents, 0);
  assert.equal(summary.direction, 'same');
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderMonthComparison(doc, summary);
  assert.equal(els.mvcMonthTotal.textContent, 'PKR 0');
  assert.equal(els.mvcMonthLine.textContent, 'This month PKR 0 · Last month PKR 0');
  assert.equal(els.mvcMonthDiff.textContent, 'Same as last month');
});

test('month comparison: the line never changes any bill, payment, or customer record', () => {
  const state = buildFixture();
  const before = JSON.stringify(state);
  const summary = calculateMonthComparison(state, REF_DATE);
  monthComparisonDifferenceText(summary);
  const els = {};
  renderMonthComparison({ getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false }) }, summary);
  assert.equal(JSON.stringify(state), before);
});

test('month comparison wiring: the line sits on the billing dashboard after the quiet-customers view, and the dashboard renders it', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('id="monthCompareSection"'), 'comparison section exists');
  assert.ok(page.indexOf('id="monthCompareSection"') > page.indexOf('id="noPaymentSection"'), 'line follows the quiet-customers view');
  assert.ok(page.indexOf('id="monthCompareSection"') < page.indexOf('id="collectionForecastSection"'), 'line sits before the forecast section');
  assert.ok(page.includes('id="mvcMonthTotal"'), 'current total element exists');
  assert.ok(page.includes('id="mvcMonthLine"'), 'figures line element exists');
  assert.ok(page.includes('id="mvcMonthDiff"'), 'difference element exists');
  assert.ok(page.includes('data-i18n="dash_monthcompare_title"'), 'line title is translated');
  assert.ok(page.includes('data-i18n="dash_monthcompare_sub"'), 'line subtitle is translated');
  assert.ok(page.includes('This month vs last month'), 'line title reads This month vs last month');

  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './dashboard-month-comparison.js?v=1.11.0'"), 'dashboard imports the month-comparison module at the pinned version');
  assert.ok(app.includes('renderMonthComparison(document, calculateMonthComparison(state, referenceDate))'), 'renderDashboard fills the line from the state');
});

test('i18n: every dash_monthcompare_ key used exists in English and Urdu, with Urdu script in the Urdu value', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const module = readFileSync(new URL('../dashboard-month-comparison.js', import.meta.url), 'utf8');
  const used = new Set();
  for (const match of page.matchAll(/data-i18n="(dash_monthcompare_[a-z_]+)"/g)) used.add(match[1]);
  // The line and difference keys sit inside t() calls in the
  // module, not directly after t(' — so the module scan takes
  // every quoted key.
  for (const match of module.matchAll(/'(dash_monthcompare_[a-z_]+)'/g)) used.add(match[1]);
  assert.ok(used.size >= 6, `expected at least 6 month-compare keys, found ${[...used].join(', ')}`);
  for (const key of used) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `missing English key ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `missing Urdu key ${key}`);
    assert.ok(/[\u0600-\u06FF]/.test(TRANSLATIONS.ur[key]), `Urdu value of ${key} carries no Urdu script`);
  }
});

test('the new module names no fenced module file in its header and reads no storage, clock, or page', () => {
  const module = readFileSync(new URL('../dashboard-month-comparison.js', import.meta.url), 'utf8');
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
