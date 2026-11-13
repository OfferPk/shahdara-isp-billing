import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, saveBillMonth, addPayment } from '../core.js';
import {
  calculateFieldRecoveryToday,
  renderFieldRecoveryTodayCard,
} from '../dashboard-field-recovery.js';
import {
  calculateUpcomingDues,
  renderUpcomingDues,
} from '../dashboard-upcoming-dues.js';
import {
  calculateCreditBalances,
  renderDashboardCreditBalances,
} from '../dashboard-credit-balances.js';
import {
  calculateMethodStrip,
  renderMethodStrip,
} from '../dashboard-method-strip.js';

const REF_DATE = new Date('2026-11-08T12:00:00Z');
const TODAY = '2026-11-08';

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

// Fake storage object, same shape the day-target helpers take —
// never the real localStorage, so tests stay hermetic.
function fakeStorage() {
  const store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
  };
}

function fakeDoc() {
  const els = {};
  const make = () => ({ textContent: '', style: {}, setAttribute() {} });
  const card = { querySelector: (sel) => (els[sel] ??= make()) };
  return {
    card,
    els,
    querySelector: (sel) => (sel === '.qc5-field-recovery-card' ? card : null),
  };
}

// Fake document for the forecast cards: every element answers
// closest() with the card itself, so the compact-zero toggle can be
// observed through a Set-backed classList shim. (The production
// renderers guard with totalEl?.closest?.(...) because the plan472 /
// plan483 fakeDocs have no closest at all.)
function fakeCard() {
  const classes = new Set();
  return {
    classes,
    classList: {
      toggle: (name, force) => { if (force) classes.add(name); else classes.delete(name); },
      contains: (name) => classes.has(name),
    },
  };
}

function fakeListDoc(card) {
  const els = {};
  return {
    els,
    card,
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false, closest: () => card }),
  };
}

test('QC-5 line: the target and its source are separated by "·", never a double colon', () => {
  const page = read('index.html');
  const start = page.indexOf('class="qc5-line"');
  assert.ok(start > -1, 'QC-5 line missing');
  const line = page.slice(start, page.indexOf('</p>', start));
  // The user photographed "Day target: PKR 46,300: Today's pending
  // dues" — a double colon that does NOT exist in main (one colon in
  // the label + one in the i18n value). The fix is a '·' separator
  // between the figure and its source, pinned here so the shape can
  // never silently regress to "figure: source".
  assert.ok(line.includes('</strong> · <span class="qc5-target-source">'), line);
  assert.equal(line.includes('::'), false, 'double colon in the QC-5 line');
  assert.equal((line.match(/:/g) || []).length, 1, 'exactly one colon (the label one)');
});

test('QC-5 render: target and source land as separate elements', () => {
  let state = createInitialState(['QC5 Cust']);
  const id = state.customers[0].id;
  state = saveBillMonth(state, id, { month: '2026-11', dueAmount: 8400, status: 'pending', dueDate: TODAY }, REF_DATE);
  const doc = fakeDoc();
  renderFieldRecoveryTodayCard(doc, calculateFieldRecoveryToday(state, REF_DATE, fakeStorage()));
  assert.equal(doc.els['.qc5-target'].textContent, 'PKR 8,400');
  assert.equal(doc.els['.qc5-target-source'].textContent, "Today's pending dues");
});

test('card headers: QC-5 and QC-6 use one flex row (icon + title left, KPI right)', () => {
  const page = read('index.html');
  assert.ok(page.includes('<span class="ds-stat__icon" data-ds-icon="Target"'));
  assert.ok(page.includes('<span class="ds-stat__icon" data-ds-icon="TrendingUp"'));
  const css = read('dashboard.css');
  const at = css.indexOf('.qc5-field-recovery-card .ds-stat-head,');
  assert.ok(at > -1, 'ds-stat-head rule missing');
  const block = css.slice(at, css.indexOf('}', at));
  assert.ok(block.includes('display: flex;'), block);
  assert.ok(block.includes('justify-content: space-between;'), block);
});

test('QC-6 badge: the percent lives in a green badge that hides when empty', () => {
  const page = read('index.html');
  assert.ok(page.includes('<span class="qc6-dod-badge"></span>'), 'badge span missing');
  const css = read('dashboard.css');
  const at = css.indexOf('.qc6-dod-badge {');
  assert.ok(at > -1, 'badge rule missing');
  const block = css.slice(at, css.indexOf('}', at));
  assert.ok(block.includes('var(--ds-success-bg)'), block);
  assert.ok(block.includes('var(--radius-pill)'), block);
  assert.ok(css.includes('.qc6-dod-badge:empty {\n  display: none;\n}'), 'empty badge must hide');
});

test('zero-state: the upcoming-dues card collapses when the week is empty', () => {
  const card = fakeCard();
  const doc = fakeListDoc(card);
  renderUpcomingDues(doc, calculateUpcomingDues(createInitialState([]), REF_DATE));
  assert.equal(doc.els.dudSevenDayTotal.textContent, 'PKR 0');
  assert.equal(card.classes.has('collection-forecast-card--compact-zero'), true, 'empty week must collapse');
});

test('zero-state: the upcoming-dues card stays full when dues exist', () => {
  let state = createInitialState(['Week Cust']);
  const id = state.customers[0].id;
  state = saveBillMonth(state, id, { month: '2026-11', dueAmount: 1000, status: 'pending', dueDate: '2026-11-09' }, REF_DATE);
  const card = fakeCard();
  const doc = fakeListDoc(card);
  renderUpcomingDues(doc, calculateUpcomingDues(state, REF_DATE));
  assert.equal(doc.els.dudSevenDayTotal.textContent, 'PKR 1,000');
  assert.equal(card.classes.has('collection-forecast-card--compact-zero'), false, 'dues present must not collapse');
});

test('zero-state: the credit-balances card collapses at zero credit', () => {
  const card = fakeCard();
  const doc = fakeListDoc(card);
  renderDashboardCreditBalances(doc, calculateCreditBalances({ customers: [] }, [], []));
  assert.equal(doc.els.crbCreditTotal.textContent, 'PKR 0');
  assert.equal(card.classes.has('collection-forecast-card--compact-zero'), true, 'zero credit must collapse');
});

test('zero-state: the credit-balances card stays full while credit is outstanding', () => {
  const state = createInitialState(['Credit Cust']);
  const id = state.customers[0].id;
  const entries = [{ id: 'cr-a', customerId: id, source: 'overpayment', sourcePaymentId: 'pay-a', amount: 2000, date: '2026-11-02' }];
  const card = fakeCard();
  const doc = fakeListDoc(card);
  renderDashboardCreditBalances(doc, calculateCreditBalances(state, entries, []));
  assert.equal(doc.els.crbCreditTotal.textContent, 'PKR 2,000');
  assert.equal(card.classes.has('collection-forecast-card--compact-zero'), false, 'credit outstanding must not collapse');
});

test('method strip: rows render as .ds-stat-box cells in a 2-column grid', () => {
  let state = createInitialState(['Method Cust A', 'Method Cust B']);
  const id = (index) => state.customers[index].id;
  state = saveBillMonth(state, id(0), { month: '2026-11', dueAmount: 2000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(0), '2026-11', { amount: 1000, date: TODAY, method: 'Cash' }, REF_DATE);
  state = addPayment(state, id(0), '2026-11', { amount: 500, date: TODAY, method: 'Cash' }, REF_DATE);
  state = saveBillMonth(state, id(1), { month: '2026-11', dueAmount: 1000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(1), '2026-11', { amount: 750, date: TODAY, method: 'JazzCash' }, REF_DATE);
  const els = {};
  const doc = { getElementById: (elId) => (els[elId] ??= { textContent: '', innerHTML: '', hidden: false }) };
  renderMethodStrip(doc, calculateMethodStrip(state, REF_DATE));
  const html = els.dmsMethodRows.innerHTML;
  assert.ok(html.includes('<li class="ds-stat-box">'), html);
  assert.ok(html.includes('class="ds-stat-box__label"'), html);
  assert.ok(html.includes('class="ds-stat-box__value"'), html);
  assert.ok(html.includes('class="ds-stat-box__meta"'), html);
  assert.ok(html.includes('PKR 1,500'), 'cash figure lands');
  assert.ok(html.includes('PKR 750'), 'JazzCash figure lands');
  assert.ok(html.includes('2 payments'), 'two-payment count lands');
  assert.ok(html.includes('1 payment'), 'one-payment count lands');
  const css = read('components.css');
  const at = css.indexOf('#dmsMethodRows {');
  assert.ok(at > -1, 'method grid rule missing');
  assert.ok(css.slice(at, css.indexOf('}', at)).includes('grid-template-columns: repeat(2, minmax(0, 1fr));'));
});

test('mohalla card: name nowrap+ellipsis, count row, primary Bike collect, compact area view', () => {
  const app = read('app.js');
  assert.ok(app.includes('mohalla-card-count-row'), 'count row wrapper missing');
  assert.ok(app.includes('mohalla-card-collect--primary'), 'primary collect modifier missing');
  assert.ok(app.includes("dsIcon('Bike', 16)"), 'Bike icon missing');
  assert.ok(app.includes('mohalla-card-collect--compact'), 'compact area-view modifier missing');
  const css = read('components.css');
  assert.ok(css.includes('white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'), 'name must ellipsize on one line');
  assert.ok(css.includes('.mohalla-card-collect--compact { min-height: 32px; padding: 5px 8px; }'), 'area view must be 32px');
});

test('dispatch board: Briefcase title icon, Plug type icon, pill total', () => {
  const page = read('index.html');
  assert.ok(page.includes('<span data-ds-icon="Briefcase"'), 'dispatch title icon missing');
  const app = read('app.js');
  assert.ok(app.includes("dsIcon('Plug', 16)"), 'installation Plug icon missing');
  const css = read('components.css');
  const at = css.indexOf('.field-dispatch-total {');
  assert.ok(at > -1, 'dispatch total rule missing');
  const block = css.slice(at, css.indexOf('}', at));
  assert.ok(block.includes('border-radius: var(--radius-pill)'), block);
  assert.ok(block.includes('var(--ds-success-bg)'), block);
  assert.ok(css.includes('.field-dispatch-total:empty { display: none; }'), 'empty total must hide');
});

test('pagination: feed arrows are 36x36 squares with Chevron SVGs, scoped to this nav only', () => {
  const css = read('styles.css');
  assert.ok(css.includes('#transactionPagination .pagination-btn {\n  width: 36px;\n  height: 36px;'), 'scoped square rule missing');
  assert.equal(css.includes('#customerPagination .pagination-btn {\n  width: 36px;'), false, 'other paginations must not become squares');
  const page = read('index.html');
  assert.ok(page.includes('aria-label="Previous transactions page"><span data-ds-icon="ChevronLeft"'));
  assert.ok(page.includes('aria-label="Next transactions page"><span data-ds-icon="ChevronRight"'));
});

test('feed accordion: Yesterday collapsed, Today open, header text unchanged', () => {
  const app = read('app.js');
  assert.ok(app.includes('[...groupByDay(paged.items).entries()]'), 'feed must group by day first');
  assert.ok(app.includes("<details${date === todayKey ? ' open' : ''}>"), 'only Today opens by default');
  assert.ok(app.includes('<summary class="tx-day-header">'), 'header becomes the summary');
  assert.ok(app.includes('<ul class="tx-day-rows">'), 'rows sit in their own list');
  assert.ok(app.includes('dayHeaderText(date, dayGroups.get(date) || [], todayKey)'), 'header text source unchanged');
  const css = read('payments-list.css');
  assert.equal(css.includes('#transactionsList >'), false, 'no direct-child selector may survive the accordion wrapper');
  assert.ok(css.includes('.tx-day-group { list-style: none; }'), 'group wrapper must not bullet');
  assert.ok(css.includes('summary.tx-day-header::-webkit-details-marker { display: none; }'), 'summary marker must hide');
});

test('shop pill: the reminder link is a pill button with the same wa.me href, modal button unchanged', () => {
  const app = read('app.js');
  assert.ok(app.includes('shop-aging-remind-link shop-aging-remind-pill'), 'pill class missing on the card anchor');
  assert.ok(app.includes("t('shopage_remind_pill')"), 'pill label key missing');
  assert.ok(app.includes('shopSettlementWhatsAppUrl(buildShopAgingReminderText(state, aging))'), 'wa.me draft href must be unchanged');
  // The modal button lives in shop-settlement.js, not app.js — it
  // keeps the shared key, untouched by this item.
  const settlement = read('shop-settlement.js');
  assert.ok(settlement.includes("t('shopage_remind_btn')"), 'the modal button keeps the shared key');
  assert.equal(settlement.includes('shopage_remind_pill'), false, 'the pill key must not leak into the modal');
  const css = read('components.css');
  const at = css.indexOf('.shop-aging-remind-pill {');
  assert.ok(at > -1, 'pill rule missing');
  assert.ok(css.slice(at, css.indexOf('}', at)).includes('border-radius: var(--radius-pill)'));
});

test('icons: all ten new ds-icons hooks land in the Collect markup', () => {
  const page = read('index.html');
  for (const name of ['Target', 'TrendingUp', 'Landmark', 'Store', 'Coins', 'Wifi', 'Briefcase', 'ChevronLeft', 'ChevronRight']) {
    assert.ok(page.includes(`data-ds-icon="${name}"`), `${name} hook missing`);
  }
  const app = read('app.js');
  assert.ok(app.includes("dsIcon('Plug', 16)"), 'Plug hook missing');
  assert.ok(app.includes("dsIcon('Bike', 16)"), 'Bike hook missing');
});

test('i18n: the three new keys exist in both dictionaries', () => {
  const nav = read('nav-language.js');
  for (const key of ['dash_upcoming_zero_badge', 'dash_creditbal_zero_badge', 'shopage_remind_pill']) {
    assert.equal(nav.split(key).length - 1, 2, `${key} must appear in EN and UR`);
  }
  assert.ok(nav.includes("dash_upcoming_zero_badge: 'PKR 0 · None due'"), 'upcoming zero badge EN text');
  assert.ok(nav.includes("dash_creditbal_zero_badge: 'PKR 0 · No credit'"), 'credit zero badge EN text');
});

test('compact-zero: the class hides the tall parts and shows the one-line zero row', () => {
  const css = read('components.css');
  assert.ok(css.includes('.collection-forecast-card--compact-zero .collection-forecast-zero {'), 'zero row rule missing');
  const at = css.indexOf('.collection-forecast-card--compact-zero .collection-forecast-header,');
  assert.ok(at > -1, 'compact-zero hide rule missing');
  assert.ok(css.slice(at, css.indexOf('}', at)).includes('display: none;'), 'tall parts must hide');
  const page = read('index.html');
  assert.ok(page.includes('data-i18n="dash_upcoming_zero_badge"'), 'upcoming zero row missing');
  assert.ok(page.includes('data-i18n="dash_creditbal_zero_badge"'), 'credit zero row missing');
});
