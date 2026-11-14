import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculatePrintSummary, renderPrintSummary } from '../dashboard-print-summary.js';
import { calculateDashboardTodayCard } from '../dashboard-today-card.js';
import { calculateMonthComparison } from '../dashboard-month-comparison.js';
import { calculateDashboard } from '../core.js';
import { calculateOverdueList } from '../dashboard-overdue-list.js';
import { calculateCashInHand } from '../dashboard-cash-in-hand.js';
import { TRANSLATIONS } from '../nav-language.js';

// The fixture, read through the same helpers the live dashboard
// sections already use, so every expected figure below is the
// live dashboard's own figure on the same fixture — the printed
// page can never disagree with the screen.
//
// 2026-11-08 12:00 PKT — the dashboard's own day in November.
//   cust-a: Nov bill 2000 (due 5 Nov), 500 cash paid today, 700
//     cash voided today; Oct bill 1000 unpaid.
//   cust-b: Nov bill 1500.50 (due today), paid in full by JazzCash
//     on 3 Nov; Oct bill 1000, 400 cash on 20 Oct, 250.25 with no
//     method recorded on 25 Oct.
//   cust-c: archived — Nov bill 3000 (due 5 Nov), 1000 cash paid
//     today.
//   cust-d: free connection — Nov bill 1000 (due 5 Nov), unpaid.
function buildFixture() {
  const state = {
    customers: [
      {
        id: 'cust-a', customerNumber: 1, name: 'Customer A', mohalla: 'Mohalla One',
        bills: [
          { month: '2026-11', dueAmount: 2000, dueDate: '2026-11-05', payments: [
            { id: 'pay-a1', amount: 500, date: '2026-11-08', method: 'cash' },
            { id: 'pay-a2', amount: 700, date: '2026-11-08', method: 'cash', voided: true }
          ] },
          { month: '2026-10', dueAmount: 1000, dueDate: '2026-10-05', payments: [] }
        ]
      },
      {
        id: 'cust-b', customerNumber: 2, name: 'Customer B', mohalla: 'Mohalla Two',
        bills: [
          { month: '2026-11', dueAmount: 1500.50, dueDate: '2026-11-08', payments: [
            { id: 'pay-b1', amount: 1500.50, date: '2026-11-03', method: 'JazzCash' }
          ] },
          { month: '2026-10', dueAmount: 1000, dueDate: '2026-10-05', payments: [
            { id: 'pay-b2', amount: 400, date: '2026-10-20', method: 'cash' },
            { id: 'pay-b3', amount: 250.25, date: '2026-10-25' }
          ] }
        ]
      },
      {
        id: 'cust-c', customerNumber: 3, name: 'Customer C', mohalla: 'Mohalla Three', archived: true,
        bills: [
          { month: '2026-11', dueAmount: 3000, dueDate: '2026-11-05', payments: [
            { id: 'pay-c1', amount: 1000, date: '2026-11-08', method: 'cash' }
          ] }
        ]
      },
      {
        id: 'cust-d', customerNumber: 4, name: 'Customer D', mohalla: 'Mohalla Four', isFreeConnection: true,
        bills: [
          { month: '2026-11', dueAmount: 1000, dueDate: '2026-11-05', payments: [] }
        ]
      }
    ]
  };
  return { state, referenceDate: new Date('2026-11-08T07:00:00Z') };
}

test('print summary: the five figures match the live dashboard\'s own figures on the same fixture', () => {
  const { state, referenceDate } = buildFixture();
  const summary = calculatePrintSummary(state, referenceDate, null);
  // Today's collections: only the 500 cash paid today — the voided
  // 700 is history and the archived 1000 never appears.
  assert.equal(summary.todayCollectedCents, calculateDashboardTodayCard(state, referenceDate).todayCollectedCents);
  assert.equal(summary.todayCollectedCents, 50000);
  // This month's collections: 500 + 1500.50 + the archived 1000 —
  // the monthly snapshot counts every recorded payment by its
  // date, exactly as the monthly report counts it.
  assert.equal(summary.monthCollectedCents, calculateMonthComparison(state, referenceDate).currentCents);
  assert.equal(summary.monthCollectedCents, 300050);
  // Total dues: the dashboard's own total-due figure — 1500 + 1000
  // (cust-a) + 349.75 (cust-b) + 2000 (archived cust-c) + 1000
  // (free cust-d) = 5849.75.
  assert.equal(summary.totalDuesCents, Math.round(calculateDashboard(state, referenceDate).totalDue * 100));
  assert.equal(summary.totalDuesCents, 584975);
  // Overdue total: 2500 (cust-a) + 349.75 (cust-b) — archived and
  // free connections never appear.
  assert.equal(summary.overdueTotalCents, calculateOverdueList(state, referenceDate).totalCents);
  assert.equal(summary.overdueTotalCents, 284975);
  // Cash in hand: 500 + 400 + 250.25 (no method reads as cash) —
  // the voided 700 and the archived 1000 never count.
  assert.equal(summary.cashInHandCents, calculateCashInHand(state, referenceDate, null).amountCents);
  assert.equal(summary.cashInHandCents, 115025);
  assert.equal(summary.today, '2026-11-08');
  assert.equal(summary.month, '2026-11');
});

test('print summary: a voided receipt counts towards no figure', () => {
  const state = {
    customers: [{
      id: 'cust-a', customerNumber: 1, name: 'Customer A', mohalla: 'Mohalla One',
      bills: [{ month: '2026-11', dueAmount: 2000, dueDate: '2026-11-05', payments: [
        { id: 'pay-a1', amount: 700, date: '2026-11-08', method: 'cash', voided: true }
      ] }]
    }]
  };
  const summary = calculatePrintSummary(state, new Date('2026-11-08T07:00:00Z'), null);
  assert.equal(summary.todayCollectedCents, 0, 'a voided receipt is history, never collected cash');
  assert.equal(summary.monthCollectedCents, 0, 'a voided receipt never lands in the month total');
  assert.equal(summary.cashInHandCents, 0, 'a voided receipt is never cash in hand');
  assert.equal(summary.totalDuesCents, 200000, 'the voided payment leaves the bill unpaid');
  assert.equal(summary.overdueTotalCents, 200000, 'the unpaid bill is overdue');
});

test('print summary: an archived customer\'s payment counts in the month total but never in today\'s collections', () => {
  const state = {
    customers: [{
      id: 'cust-c', customerNumber: 3, name: 'Customer C', mohalla: 'Mohalla Three', archived: true,
      bills: [{ month: '2026-11', dueAmount: 3000, dueDate: '2026-11-05', payments: [
        { id: 'pay-c1', amount: 1000, date: '2026-11-08', method: 'cash' }
      ] }]
    }]
  };
  const summary = calculatePrintSummary(state, new Date('2026-11-08T07:00:00Z'), null);
  assert.equal(summary.todayCollectedCents, 0, 'archived customers never appear in today\'s collections');
  assert.equal(summary.monthCollectedCents, 100000, 'the monthly snapshot counts every recorded payment by its date');
  assert.equal(summary.totalDuesCents, 200000, 'the archived bill stays in the dashboard\'s own total-due figure');
  assert.equal(summary.overdueTotalCents, 0, 'archived customers never appear in the overdue total');
  assert.equal(summary.cashInHandCents, 0, 'archived customers never hold cash in hand');
});

test('print summary: total dues follows the dashboard\'s own total-due figure, free connections included', () => {
  const state = {
    customers: [{
      id: 'cust-d', customerNumber: 4, name: 'Customer D', mohalla: 'Mohalla Four', isFreeConnection: true,
      bills: [{ month: '2026-11', dueAmount: 1000, dueDate: '2026-11-05', payments: [] }]
    }]
  };
  const summary = calculatePrintSummary(state, new Date('2026-11-08T07:00:00Z'), null);
  assert.equal(summary.totalDuesCents, Math.round(calculateDashboard(state, new Date('2026-11-08T07:00:00Z')).totalDue * 100));
  assert.equal(summary.totalDuesCents, 100000, 'the free connection\'s bill stays in the dashboard\'s own total-due figure');
  assert.equal(summary.overdueTotalCents, 0, 'free connections never owe anything');
});

test('print summary: a payment with no method reads as cash in hand', () => {
  const state = {
    customers: [{
      id: 'cust-b', customerNumber: 2, name: 'Customer B', mohalla: 'Mohalla Two',
      bills: [{ month: '2026-10', dueAmount: 1000, dueDate: '2026-10-05', payments: [
        { id: 'pay-b3', amount: 250.25, date: '2026-10-25' }
      ] }]
    }]
  };
  const summary = calculatePrintSummary(state, new Date('2026-11-08T07:00:00Z'), null);
  assert.equal(summary.cashInHandCents, 25025, 'a payment with no method reads as cash, exactly as the closing register reads it');
});

test('print summary: an empty business reads zero, never a blank', () => {
  const summary = calculatePrintSummary({ customers: [] }, new Date('2026-11-08T07:00:00Z'), null);
  assert.deepEqual(summary, {
    today: '2026-11-08', month: '2026-11',
    todayCollectedCents: 0, monthCollectedCents: 0, totalDuesCents: 0,
    overdueTotalCents: 0, cashInHandCents: 0
  });
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderPrintSummary(doc, summary);
  assert.equal(els.ppsTodayCollected.textContent, 'PKR 0');
  assert.equal(els.ppsMonthCollected.textContent, 'PKR 0');
  assert.equal(els.ppsTotalDues.textContent, 'PKR 0');
  assert.equal(els.ppsOverdueTotal.textContent, 'PKR 0');
  assert.equal(els.ppsCashInHand.textContent, 'PKR 0');
  assert.equal(els.ppsPrintDate.textContent, 'Printed 2026-11-08');
});

test('print summary render: the five PKR figures and the date land in the view', () => {
  const { state, referenceDate } = buildFixture();
  const summary = calculatePrintSummary(state, referenceDate, null);
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderPrintSummary(doc, summary);
  assert.equal(els.ppsTodayCollected.textContent, 'PKR 500');
  assert.equal(els.ppsMonthCollected.textContent, 'PKR 3,000.50');
  assert.equal(els.ppsTotalDues.textContent, 'PKR 5,849.75');
  assert.equal(els.ppsOverdueTotal.textContent, 'PKR 2,849.75');
  assert.equal(els.ppsCashInHand.textContent, 'PKR 1,150.25');
  assert.equal(els.ppsPrintDate.textContent, 'Printed 2026-11-08');
});

test('print summary: calculating and rendering never mutate the state', () => {
  const { state, referenceDate } = buildFixture();
  const before = JSON.stringify(state);
  const summary = calculatePrintSummary(state, referenceDate, null);
  const els = {};
  renderPrintSummary({ getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false }) }, summary);
  assert.equal(JSON.stringify(state), before, 'printing never changes any bill, payment, or customer record');
});

test('print summary wiring: the section sits on the billing dashboard after the refunds strip, and the dashboard renders it', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('id="printSummarySection"'), 'print summary section exists');
  assert.ok(page.indexOf('id="printSummarySection"') > page.indexOf('id="refundsSection"'), 'summary follows the refunds strip');
  assert.ok(page.indexOf('id="printSummarySection"') < page.indexOf('id="multiMonthMatrixSection"'), 'summary sits before the matrix section');
  assert.ok(page.includes('id="ppsPrintBtn"'), 'print action exists');
  assert.ok(page.includes('id="ppsPrintDate"'), 'date line element exists');
  assert.ok(page.includes('id="ppsTodayCollected"'), 'today figure element exists');
  assert.ok(page.includes('id="ppsMonthCollected"'), 'month figure element exists');
  assert.ok(page.includes('id="ppsTotalDues"'), 'total dues element exists');
  assert.ok(page.includes('id="ppsOverdueTotal"'), 'overdue figure element exists');
  assert.ok(page.includes('id="ppsCashInHand"'), 'cash figure element exists');
  assert.ok(page.includes('data-i18n="dash_printsummary_title"'), 'summary title is translated');
  assert.ok(page.includes('data-i18n="dash_printsummary_sub"'), 'summary subtitle is translated');
  assert.ok(page.includes('data-i18n="dash_printsummary_print"'), 'print action is translated');
  // One page, five rows only — no lists, no extra panels.
  assert.equal((page.match(/<li><span data-i18n="dash_printsummary_/g) || []).length, 5, 'the printed page carries exactly five figure rows');

  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './dashboard-print-summary.js?v=1.11.0'"), 'dashboard imports the print summary module at the pinned version');
  assert.ok(app.includes('renderPrintSummary(document, calculatePrintSummary(state, referenceDate, storageAvailable ? localStorage : null))'), 'renderPrintSummary fills the section from the live state');
  assert.ok(app.includes("$('#ppsPrintBtn')?.addEventListener('click'"), 'the print action is wired');
  assert.ok(app.includes("document.body.classList.add('printing-dashboard-summary')"), 'printing adds the print-only class');
  assert.ok(app.includes("document.body.classList.remove('printing-dashboard-summary')"), 'the print-only class comes off again');
});

test('print summary print rules: the print stylesheet shows only the summary section', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.ok(css.includes('body.printing-dashboard-summary *{visibility:hidden!important}'), 'everything hides on paper');
  assert.ok(css.includes('body.printing-dashboard-summary #printSummarySection,body.printing-dashboard-summary #printSummarySection *{visibility:visible!important}'), 'only the summary shows on paper');
  assert.ok(css.includes('body.printing-dashboard-summary #printSummarySection{display:block!important;position:fixed;inset:0'), 'the summary pulls to the top of the page');
  assert.ok(css.includes('body.printing-dashboard-summary #ppsPrintBtn{display:none!important}'), 'the print button never reaches the paper');
  assert.ok(css.includes('body.printing-dashboard-summary #printSummarySection .provider-cost-list li{break-inside:avoid}'), 'a figure row never splits across pages');
});

test('i18n: every dash_printsummary_ key used exists in English and Urdu, with Urdu script in the Urdu value', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const module = readFileSync(new URL('../dashboard-print-summary.js', import.meta.url), 'utf8');
  const used = new Set();
  for (const match of page.matchAll(/data-i18n="(dash_printsummary_[a-z_]+)"/g)) used.add(match[1]);
  // The date key sits inside a t() call in the module, not directly
  // after t(' — so the module scan takes every quoted key.
  for (const match of module.matchAll(/'(dash_printsummary_[a-z_]+)'/g)) used.add(match[1]);
  assert.ok(used.size >= 9, `expected at least 9 print summary keys, found ${[...used].join(', ')}`);
  for (const key of used) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `missing English key ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `missing Urdu key ${key}`);
    assert.ok(/[\u0600-\u06FF]/.test(TRANSLATIONS.ur[key]), `Urdu value of ${key} carries no Urdu script`);
  }
});

test('the new module names no fenced module file in its header and reads no storage, clock, or page', () => {
  const module = readFileSync(new URL('../dashboard-print-summary.js', import.meta.url), 'utf8');
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
