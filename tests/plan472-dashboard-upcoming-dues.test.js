import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, saveBillMonth, addPayment } from '../core.js';
import {
  UPCOMING_DUES_WINDOW_DAYS,
  addDaysYmd,
  formatDayLabel,
  calculateUpcomingDues,
  upcomingDuesSectionHtml,
  renderUpcomingDues
} from '../dashboard-upcoming-dues.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF_DATE = new Date('2026-11-08T12:00:00Z');
const TODAY = '2026-11-08';
const LAST_DAY = '2026-11-14';

function buildFixture() {
  let state = createInitialState([
    'Week Cust A',
    'Week Cust B',
    'Week Cust C',
    'Week Cust D',
    'Week Cust E',
    'Week Cust F',
    'Week Cust G',
    'Week Cust H',
    'Week Cust I',
    'Week Cust J',
    'Week Cust K'
  ]);
  const id = (index) => state.customers[index].id;

  // A: bill 2000 due today, paid 1500.50 — 499.50 still due today.
  state = saveBillMonth(state, id(0), { month: '2026-11', dueAmount: 2000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(0), '2026-11', { amount: 1500.50, date: TODAY, method: 'Cash' }, REF_DATE);
  // A again: a second bill, October's, 700 due tomorrow — a second
  // row for the same customer, on the next day.
  state = saveBillMonth(state, id(0), { month: '2026-10', dueAmount: 700, status: 'pending', dueDate: '2026-11-09' }, REF_DATE);
  // B: bill 1000 due tomorrow, nothing paid — 1000 due tomorrow.
  state = saveBillMonth(state, id(1), { month: '2026-11', dueAmount: 1000, status: 'pending', dueDate: '2026-11-09' }, REF_DATE);
  // C: bill 3000 due yesterday — already overdue, never in the week.
  state = saveBillMonth(state, id(2), { month: '2026-11', dueAmount: 3000, status: 'pending', dueDate: '2026-11-07' }, REF_DATE);
  // D: bill 500 due in two days, paid in full — nothing due.
  state = saveBillMonth(state, id(3), { month: '2026-11', dueAmount: 500, status: 'pending', dueDate: '2026-11-10' }, REF_DATE);
  state = addPayment(state, id(3), '2026-11', { amount: 500, date: TODAY, method: 'Cash' }, REF_DATE);
  // E: bill 800 due on the last day of the window, paid 700 — 100
  // still due on the last day.
  state = saveBillMonth(state, id(4), { month: '2026-11', dueAmount: 800, status: 'pending', dueDate: LAST_DAY }, REF_DATE);
  state = addPayment(state, id(4), '2026-11', { amount: 700, date: TODAY, method: 'Cash' }, REF_DATE);
  // F: bill 1200 due one day past the window — never in the week.
  state = saveBillMonth(state, id(5), { month: '2026-11', dueAmount: 1200, status: 'pending', dueDate: '2026-11-15' }, REF_DATE);
  // G: bill 900 due in three days, paid 400 — then archived, so the
  // view never shows this customer.
  state = saveBillMonth(state, id(6), { month: '2026-11', dueAmount: 900, status: 'pending', dueDate: '2026-11-11' }, REF_DATE);
  state = addPayment(state, id(6), '2026-11', { amount: 400, date: TODAY, method: 'Cash' }, REF_DATE);
  state.customers[6].archived = true;
  // H: an unpriced bill due in four days carries no amount — nothing
  // is due.
  state.customers[7].bills.push({
    id: 'bill-week-unpriced',
    month: '2026-11',
    dueAmount: null,
    status: 'pending',
    dueDate: '2026-11-12',
    payments: []
  });
  // I: a bill due in five days, 1000.50 — paisa precision in the week.
  state = saveBillMonth(state, id(8), { month: '2026-11', dueAmount: 1000.50, status: 'pending', dueDate: '2026-11-13' }, REF_DATE);
  // J: a bill due in six days, 250, paid 300 — overpaid, nothing due.
  state = saveBillMonth(state, id(9), { month: '2026-11', dueAmount: 250, status: 'pending', dueDate: LAST_DAY }, REF_DATE);
  state = addPayment(state, id(9), '2026-11', { amount: 300, date: TODAY, method: 'Cash' }, REF_DATE);
  // K: a bill with no due date set — the month's 5th is the stored
  // default, outside the window, so nothing is due this week.
  state = saveBillMonth(state, id(10), { month: '2026-11', dueAmount: 2500, status: 'pending' }, REF_DATE);
  assert.equal(state.customers[10].bills[0].dueDate, '2026-11-05');
  return state;
}

test('upcoming dues: the seven-day window holds exactly the bills due inside it, split per day', () => {
  const summary = calculateUpcomingDues(buildFixture(), REF_DATE);
  assert.equal(summary.startDate, TODAY);
  assert.equal(summary.endDate, LAST_DAY);
  assert.equal(summary.days.length, UPCOMING_DUES_WINDOW_DAYS);
  assert.equal(UPCOMING_DUES_WINDOW_DAYS, 7);
  // Day totals, in window order: today 499.50 (A), tomorrow 1700
  // (B 1000 + A October 700), then 0, 0, 0, 1000.50 (I), 100 (E).
  // C was due yesterday, F is one day past the window, D is paid in
  // full, G is archived, H is unpriced, J is overpaid, K defaults to
  // the 5th.
  assert.deepEqual(summary.days.map((day) => day.dayTotalCents), [49950, 170000, 0, 0, 0, 100050, 10000]);
  assert.deepEqual(summary.days.map((day) => day.dayCount), [1, 2, 0, 0, 0, 1, 1]);
  assert.deepEqual(summary.days.map((day) => day.date), [
    '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11',
    '2026-11-12', '2026-11-13', '2026-11-14'
  ]);
  // The total equals the sum of the listed dues — paisa exact.
  assert.equal(summary.totalCents, 330000);
  assert.equal(summary.totalCount, 5);
  // Tomorrow's rows are the two bills, in state order.
  assert.deepEqual(summary.days[1].bills.map((bill) => bill.customerName), ['Week Cust A', 'Week Cust B']);
  assert.deepEqual(summary.days[1].bills.map((bill) => bill.amountCents), [70000, 100000]);
  assert.equal(summary.days[1].bills[0].month, '2026-10');
});

test('upcoming dues: a window crossing the month end still holds seven days', () => {
  const summary = calculateUpcomingDues({ customers: [] }, new Date('2026-11-28T12:00:00Z'));
  assert.equal(summary.startDate, '2026-11-28');
  assert.equal(summary.endDate, '2026-12-04');
  assert.deepEqual(summary.days.map((day) => day.date), [
    '2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01',
    '2026-12-02', '2026-12-03', '2026-12-04'
  ]);
  assert.equal(summary.totalCents, 0);
  assert.equal(summary.totalCount, 0);
});

test('addDaysYmd: month ends, year ends, and the leap day are pure calendar arithmetic', () => {
  assert.equal(addDaysYmd('2026-11-30', 1), '2026-12-01');
  assert.equal(addDaysYmd('2026-12-31', 1), '2027-01-01');
  assert.equal(addDaysYmd('2028-02-28', 1), '2028-02-29');
  assert.equal(addDaysYmd('2028-02-29', 1), '2028-03-01');
  assert.equal(addDaysYmd('2026-03-01', -1), '2026-02-28');
  assert.equal(addDaysYmd('2026-11-08', 6), '2026-11-14');
  assert.equal(addDaysYmd('2026-11-08', 0), '2026-11-08');
  assert.equal(addDaysYmd('not-a-date', 3), '');
  assert.equal(addDaysYmd('2026-13-01', 3), '');
  assert.equal(addDaysYmd('2026-02-30', 3), '');
  assert.equal(formatDayLabel('2026-11-08'), '8 Nov 2026');
  assert.equal(formatDayLabel('2026-02-29'), '');
  assert.equal(formatDayLabel('garbage'), '');
});

test('upcoming dues: an empty week reads zero, never a blank, and every day still shows', () => {
  const summary = calculateUpcomingDues({ customers: [] }, REF_DATE);
  assert.deepEqual(summary, {
    startDate: TODAY,
    endDate: LAST_DAY,
    days: [
      { date: '2026-11-08', label: '8 Nov 2026', bills: [], dayTotalCents: 0, dayCount: 0 },
      { date: '2026-11-09', label: '9 Nov 2026', bills: [], dayTotalCents: 0, dayCount: 0 },
      { date: '2026-11-10', label: '10 Nov 2026', bills: [], dayTotalCents: 0, dayCount: 0 },
      { date: '2026-11-11', label: '11 Nov 2026', bills: [], dayTotalCents: 0, dayCount: 0 },
      { date: '2026-11-12', label: '12 Nov 2026', bills: [], dayTotalCents: 0, dayCount: 0 },
      { date: '2026-11-13', label: '13 Nov 2026', bills: [], dayTotalCents: 0, dayCount: 0 },
      { date: '2026-11-14', label: '14 Nov 2026', bills: [], dayTotalCents: 0, dayCount: 0 }
    ],
    totalCents: 0,
    totalCount: 0
  });
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderUpcomingDues(doc, summary);
  assert.equal(els.dudSevenDayTotal.textContent, 'PKR 0');
  assert.equal(els.dudSevenDayLine.textContent, '8 Nov 2026 – 14 Nov 2026');
  assert.equal(els.dudUpcomingDays.innerHTML, '');
  assert.equal(els.dudUpcomingEmpty.hidden, false);
});

test('upcoming dues render: PKR total, window line, per-day groups and bill rows land in the view', () => {
  const summary = calculateUpcomingDues(buildFixture(), REF_DATE);
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderUpcomingDues(doc, summary);
  assert.equal(els.dudSevenDayTotal.textContent, 'PKR 3,300');
  assert.equal(els.dudSevenDayLine.textContent, '8 Nov 2026 – 14 Nov 2026');
  assert.equal(els.dudUpcomingEmpty.hidden, true);
  const html = els.dudUpcomingDays.innerHTML;
  // Every day of the week shows, in order, with its own total.
  assert.ok(html.indexOf('8 Nov 2026') < html.indexOf('9 Nov 2026'), 'days in window order');
  assert.ok(html.includes('PKR 499.50'), 'today total lands');
  assert.ok(html.includes('PKR 1,700'), 'tomorrow total lands');
  assert.ok(html.includes('PKR 1,000.50'), 'paisa-exact day total lands');
  assert.ok(html.includes('PKR 100'), 'last-day total lands');
  // Bill rows carry name, amount, mohalla and bill month; the
  // October bill of the same customer is its own row.
  assert.ok(html.includes('Week Cust A'), 'customer name lands');
  assert.ok(html.includes('2026-10'), 'second bill month lands');
  // A day with no dues reads plainly, never a blank.
  assert.ok(html.includes('No dues'), 'empty day reads plainly');
  // PKR only — no other currency symbol or code appears anywhere.
  for (const el of Object.values(els)) {
    assert.equal(/\$\d|€|£|USD|EUR|GBP/.test(el.textContent), false, el.textContent);
  }
  assert.equal(/\$\d|€|£|USD|EUR|GBP/.test(html), false);
  // Customer text is escaped, never raw HTML.
  const nasty = calculateUpcomingDues({
    customers: [{
      id: 'c-nasty', name: '<b>Bold</b>', mohalla: 'Test Mohalla', archived: false,
      bills: [{ id: 'b-nasty', month: '2026-11', dueAmount: 100, status: 'pending', dueDate: TODAY, payments: [] }]
    }]
  }, REF_DATE);
  const nastyHtml = upcomingDuesSectionHtml(nasty);
  assert.equal(nastyHtml.includes('<b>Bold</b>'), false);
  assert.ok(nastyHtml.includes('&lt;b&gt;Bold&lt;/b&gt;'), 'name is escaped');
});

test('upcoming dues: the view never changes any bill, payment, or customer record', () => {
  const state = buildFixture();
  const before = JSON.stringify(state);
  const summary = calculateUpcomingDues(state, REF_DATE);
  upcomingDuesSectionHtml(summary);
  const els = {};
  renderUpcomingDues({ getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false }) }, summary);
  assert.equal(JSON.stringify(state), before);
});

test('upcoming dues wiring: the view sits in the Collect tab (transactionsView), and the dashboard renders it', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('id="upcomingDuesSection"'), 'upcoming dues section exists');
  // Home Dashboard overhaul: the section moved from Home to the
  // Collect tab — the old "follows the summary grid" pin is gone
  // with the deleted grid. It now sits inside transactionsView
  // (before Reports) and still before the forecast section.
  assert.ok(page.indexOf('id="upcomingDuesSection"') > page.indexOf('id="transactionsView"'), 'view sits inside the Collect tab');
  assert.ok(page.indexOf('id="upcomingDuesSection"') < page.indexOf('id="billingReportsView"'), 'view sits before the Reports tab');
  assert.ok(page.indexOf('id="upcomingDuesSection"') < page.indexOf('id="multiMonthMatrixSection"'), 'view sits before the matrix section');
  assert.ok(page.includes('id="dudSevenDayTotal"'), 'seven-day total element exists');
  assert.ok(page.includes('id="dudSevenDayLine"'), 'window line exists');
  assert.ok(page.includes('id="dudUpcomingDays"'), 'per-day list element exists');
  assert.ok(page.includes('id="dudUpcomingEmpty"'), 'empty state exists');
  assert.ok(page.includes('data-i18n="dash_upcoming_title"'), 'view title is translated');
  assert.ok(page.includes('data-i18n="dash_upcoming_sub"'), 'view subtitle is translated');
  assert.ok(page.includes('data-i18n="dash_upcoming_empty"'), 'empty state is translated');
  assert.ok(page.includes('Due in the next seven days'), 'view title reads Due in the next seven days');

  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './dashboard-upcoming-dues.js?v=1.11.0'"), 'dashboard imports the upcoming dues module at the pinned version');
  assert.ok(app.includes('renderUpcomingDues(document, calculateUpcomingDues(state, referenceDate))'), 'renderDashboard fills the upcoming dues view');
});

test('i18n: every dash_upcoming_ key used exists in English and Urdu', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const module = readFileSync(new URL('../dashboard-upcoming-dues.js', import.meta.url), 'utf8');
  const used = new Set();
  for (const match of page.matchAll(/data-i18n="(dash_upcoming_[a-z_]+)"/g)) used.add(match[1]);
  // The bills sing/plur keys sit inside a ternary in the module, not
  // directly after t(' — so the module scan takes every quoted key.
  for (const match of module.matchAll(/'(dash_upcoming_[a-z_]+)'/g)) used.add(match[1]);
  assert.ok(used.size >= 6, `expected at least 6 upcoming-dues keys, found ${[...used].join(', ')}`);
  for (const key of used) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `missing English key ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `missing Urdu key ${key}`);
  }
});

test('the new module names no fenced module file in its header and reads no storage, clock, or page', () => {
  const module = readFileSync(new URL('../dashboard-upcoming-dues.js', import.meta.url), 'utf8');
  const header = module.slice(0, module.indexOf('*/'));
  assert.equal(header.includes('.js'), false, 'header names no module file');
  assert.equal(module.includes('full-history-list.js'), false);
  assert.equal(module.includes('localStorage'), false);
  assert.equal(module.includes('document'), false);
  // The bare word "window" is this plan's own domain term for the
  // seven-day span (the spec calls it the window), so the check
  // targets the browser global — window used as an object — never
  // the word itself.
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
