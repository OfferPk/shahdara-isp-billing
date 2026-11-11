import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, saveBillMonth, addPayment } from '../core.js';
import {
  calculateCollectorCashExpected,
  recordCashHandover
} from '../dashboard-daily-closing.js';
import {
  calculateCashInHand,
  cashInHandCountText,
  renderDashboardCashInHand
} from '../dashboard-cash-in-hand.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF_DATE = new Date('2026-11-08T12:00:00Z');
const TODAY = '2026-11-08';
const MONTH = '2026-11';

function mockStorage() {
  const store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); }
  };
}

// The cash in hand, read independently of the module under
// test: physical-cash payments (Cash and every "Cash at …
// shop" variant) on dates with no handover record, in
// integer cents. Voided and digital payments never count.
function ledgerCashInHandCents(state, handedOverDates) {
  let cents = 0;
  let count = 0;
  for (const customer of state.customers ?? []) {
    for (const bill of customer.bills ?? []) {
      for (const payment of bill.payments ?? []) {
        if (payment?.voided === true) continue;
        const date = typeof payment?.date === 'string' ? payment.date.slice(0, 10) : '';
        if (!date || date > TODAY) continue;
        if (handedOverDates.has(date)) continue;
        const method = String(payment?.method ?? '').trim().toLowerCase();
        const isDigital = method.includes('jazzcash') || method.includes('easypaisa')
          || method.includes('nayapay') || method.includes('bank') || method.includes('raast')
          || method.includes('online');
        if (isDigital) continue;
        if (!method.includes('cash') && method !== '') continue;
        cents += Math.round(Number(payment.amount || 0) * 100);
        count += 1;
      }
    }
  }
  return { cents, count };
}

function buildFixture() {
  let state = createInitialState([
    'Cash Hand A',
    'Cash Hand B',
    'Cash Hand C',
    'Cash Hand D',
    'Cash Hand E',
    'Cash Hand F'
  ]);
  const id = (index) => state.customers[index].id;

  // A: 3000 cash on 2026-11-02, no handover — +3000.
  state = saveBillMonth(state, id(0), { month: MONTH, dueAmount: 3000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(0), MONTH, { amount: 3000, date: '2026-11-02', method: 'Cash' }, REF_DATE);
  // B: a paisa-exact 1500.50 cash on 2026-11-05, no handover
  // — +1500.50.
  state = saveBillMonth(state, id(1), { month: MONTH, dueAmount: 1500.5, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(1), MONTH, { amount: 1500.5, date: '2026-11-05', method: 'Cash' }, REF_DATE);
  // C: 800 cash on 2026-11-04, handed over that day — never
  // in hand.
  state = saveBillMonth(state, id(2), { month: MONTH, dueAmount: 800, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(2), MONTH, { amount: 800, date: '2026-11-04', method: 'Cash' }, REF_DATE);
  // D: 1000 JazzCash on 2026-11-03 — digital, never cash.
  state = saveBillMonth(state, id(3), { month: '2026-10', dueAmount: 1000, status: 'pending', dueDate: '2026-10-05' }, REF_DATE);
  state = addPayment(state, id(3), '2026-10', { amount: 1000, date: '2026-11-03', method: 'JazzCash' }, REF_DATE);
  // E: 700 cash on 2026-11-06, then voided — a voided
  // receipt is history, never collected cash.
  state = saveBillMonth(state, id(4), { month: MONTH, dueAmount: 700, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(4), MONTH, { amount: 700, date: '2026-11-06', method: 'Cash' }, REF_DATE);
  state.customers[4].bills.find((b) => b.month === MONTH).payments[0].voided = true;
  // F: 400 "Cash at Waseem Abbasi shop" on 2026-11-07 — a
  // cash variant, still physical cash — +400.
  state = saveBillMonth(state, id(5), { month: MONTH, dueAmount: 400, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(5), MONTH, { amount: 400, date: '2026-11-07', method: 'Cash at Waseem Abbasi shop' }, REF_DATE);

  const storage = mockStorage();
  const recorded = recordCashHandover({
    date: '2026-11-04',
    collectorName: 'All Physical Cash / General Till',
    expectedCash: 800,
    countedCash: 800
  }, storage);
  assert.equal(recorded.success, true, 'handover fixture must record');
  return { state, storage };
}

test('cash in hand: the figure equals the sum of cash payments not yet handed over', () => {
  const { state, storage } = buildFixture();
  const summary = calculateCashInHand(state, REF_DATE, storage);
  assert.equal(summary.today, TODAY);
  assert.equal(summary.amountCents, ledgerCashInHandCents(state, new Set(['2026-11-04'])).cents);
  assert.equal(summary.amountCents, 490050);
  assert.equal(summary.count, ledgerCashInHandCents(state, new Set(['2026-11-04'])).count);
  assert.equal(summary.count, 3);
  assert.equal(cashInHandCountText(summary), '3 payments in hand');
});

test('cash in hand: the figure agrees with the daily closing summary for a day with no handover', () => {
  let state = createInitialState(['Cash Agree A']);
  const id = (index) => state.customers[index].id;
  state = saveBillMonth(state, id(0), { month: MONTH, dueAmount: 2500, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(0), MONTH, { amount: 2500, date: TODAY, method: 'Cash' }, REF_DATE);
  const storage = mockStorage();
  const summary = calculateCashInHand(state, REF_DATE, storage);
  // The daily closing summary's own expected-cash figure for
  // the same day, in rupees, matches the dashboard figure.
  const expected = calculateCollectorCashExpected(state, TODAY, 'all');
  assert.equal(expected.expectedCash, 2500);
  assert.equal(summary.amountCents, expected.expectedCash * 100);
  assert.equal(summary.count, expected.receiptCount);
  assert.equal(summary.count, 1);
  assert.equal(cashInHandCountText(summary), '1 payment in hand');
});

test('cash in hand: a handover recorded for the day covers that day\'s cash in full', () => {
  let state = createInitialState(['Cash Covered A']);
  const id = (index) => state.customers[index].id;
  state = saveBillMonth(state, id(0), { month: MONTH, dueAmount: 1800, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(0), MONTH, { amount: 1000, date: '2026-11-02', method: 'Cash' }, REF_DATE);
  state = addPayment(state, id(0), MONTH, { amount: 800, date: '2026-11-02', method: 'Cash' }, REF_DATE);
  const storage = mockStorage();
  const recorded = recordCashHandover({
    date: '2026-11-02',
    collectorName: 'All Physical Cash / General Till',
    expectedCash: 1800,
    countedCash: 1800
  }, storage);
  assert.equal(recorded.success, true);
  const summary = calculateCashInHand(state, REF_DATE, storage);
  assert.equal(summary.amountCents, 0);
  assert.equal(summary.count, 0);
});

test('cash in hand: a voided payment never counts as cash in hand', () => {
  let state = createInitialState(['Cash Voided A']);
  const id = (index) => state.customers[index].id;
  state = saveBillMonth(state, id(0), { month: MONTH, dueAmount: 800, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(0), MONTH, { amount: 800, date: '2026-11-04', method: 'Cash' }, REF_DATE);
  state.customers[0].bills.find((b) => b.month === MONTH).payments[0].voided = true;
  const summary = calculateCashInHand(state, REF_DATE, mockStorage());
  assert.equal(summary.amountCents, 0);
  assert.equal(summary.count, 0);
});

test('cash in hand: digital payments never count as cash in hand', () => {
  let state = createInitialState(['Cash Digital A', 'Cash Digital B']);
  const id = (index) => state.customers[index].id;
  state = saveBillMonth(state, id(0), { month: MONTH, dueAmount: 1000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(0), MONTH, { amount: 1000, date: '2026-11-03', method: 'JazzCash' }, REF_DATE);
  state = saveBillMonth(state, id(1), { month: MONTH, dueAmount: 2000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(1), MONTH, { amount: 2000, date: '2026-11-03', method: 'Bank Transfer' }, REF_DATE);
  const summary = calculateCashInHand(state, REF_DATE, mockStorage());
  assert.equal(summary.amountCents, 0);
  assert.equal(summary.count, 0);
});

test('cash in hand: cash dated after the dashboard day is not in hand yet', () => {
  let state = createInitialState(['Cash Future A']);
  const id = (index) => state.customers[index].id;
  state = saveBillMonth(state, id(0), { month: MONTH, dueAmount: 900, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(0), MONTH, { amount: 900, date: TODAY, method: 'Cash' }, REF_DATE);
  // The validator refuses a future payment date, so the
  // future-dated record is placed the way the voided fixture
  // places its record: by hand on the stored payment.
  state.customers[0].bills.find((b) => b.month === MONTH).payments[0].date = '2026-11-09';
  const summary = calculateCashInHand(state, REF_DATE, mockStorage());
  assert.equal(summary.amountCents, 0);
  assert.equal(summary.count, 0);
});

test('cash in hand: a day with no cash in hand shows zero, not a blank', () => {
  const summary = calculateCashInHand({ customers: [] }, REF_DATE, mockStorage());
  assert.equal(summary.today, TODAY);
  assert.equal(summary.amountCents, 0);
  assert.equal(summary.count, 0);
  assert.equal(cashInHandCountText(summary), '0 payments in hand');
});

test('cash in hand render: the figure, the count, and the empty state land in the view', () => {
  const { state, storage } = buildFixture();
  const summary = calculateCashInHand(state, REF_DATE, storage);
  const els = {};
  const doc = {
    getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderDashboardCashInHand(doc, summary);
  assert.equal(els.cihCashTotal.textContent, 'PKR 4,900.50');
  assert.equal(els.cihCashLine.textContent, '3 payments in hand');
  assert.equal(els.cihCashEmpty.hidden, true);
  // PKR only — no other currency symbol or code appears anywhere.
  for (const el of Object.values(els)) {
    assert.equal(/\$\d|€|£|USD|EUR|GBP/.test(el.textContent), false, el.textContent);
  }

  const empty = calculateCashInHand({ customers: [] }, REF_DATE, mockStorage());
  const emptyEls = {};
  const emptyDoc = {
    getElementById: (id) => (emptyEls[id] ??= { textContent: '', innerHTML: '', hidden: false })
  };
  renderDashboardCashInHand(emptyDoc, empty);
  assert.equal(emptyEls.cihCashTotal.textContent, 'PKR 0');
  assert.equal(emptyEls.cihCashLine.textContent, '0 payments in hand');
  assert.equal(emptyEls.cihCashEmpty.hidden, false);
});

test('cash in hand: the figure never changes any bill, payment, or customer record', () => {
  const { state, storage } = buildFixture();
  const before = JSON.stringify(state);
  const summary = calculateCashInHand(state, REF_DATE, storage);
  cashInHandCountText(summary);
  const els = {};
  renderDashboardCashInHand({ getElementById: (id) => (els[id] ??= { textContent: '', innerHTML: '', hidden: false }) }, summary);
  assert.equal(JSON.stringify(state), before);
});

test('cash in hand wiring: the figure sits in the Home KPI strip (Cash in Hand card), and the dashboard renders it', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  // Home Dashboard overhaul: the standalone Cash in Hand section is
  // DELETED — its ids moved into the KPI strip's Cash in Hand card,
  // so the section would have duplicated them. The empty-state
  // element is gone too; the renderer guards it.
  assert.ok(!page.includes('id="cashInHandSection"'), 'standalone section is gone');
  assert.ok(!page.includes('id="cihCashEmpty"'), 'empty state element is gone (renderer guards it)');
  assert.ok(page.includes('id="cihCashTotal"'), 'cash total element exists');
  assert.ok(page.includes('id="cihCashLine"'), 'count line element exists');
  const stripStart = page.indexOf('id="homeKpiStrip"');
  assert.ok(stripStart >= 0, 'KPI strip exists');
  assert.ok(page.indexOf('id="cihCashTotal"') > stripStart, 'cash total sits inside the KPI strip');
  assert.ok(page.indexOf('id="cihCashTotal"') < page.indexOf('id="homePrimaryActions"'), 'cash total sits before the quick actions');
  assert.ok(page.includes('data-i18n="dash_cashinhand_title"'), 'figure title is translated');
  // No static subtitle in the strip: the sub-line is the
  // JS-written count line (count_sing/plur keys, pinned by the
  // i18n test below) — the deleted section's dash_cashinhand_sub
  // went with it.
  assert.ok(page.includes('Cash in hand now'), 'figure title reads Cash in hand now');

  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './dashboard-cash-in-hand.js?v=1.11.0'"), 'dashboard imports the cash-in-hand module at the pinned version');
  assert.ok(app.includes('renderDashboardCashInHand(document, calculateCashInHand(state, referenceDate, storageAvailable ? localStorage : null))'), 'renderDashboard fills the figure from the state and the saved handover records');
});

test('i18n: every dash_cashinhand_ key used exists in English and Urdu, with Urdu script in the Urdu value', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const module = readFileSync(new URL('../dashboard-cash-in-hand.js', import.meta.url), 'utf8');
  const used = new Set();
  for (const match of page.matchAll(/data-i18n="(dash_cashinhand_[a-z_]+)"/g)) used.add(match[1]);
  // The count keys sit inside t() calls in the module, not
  // directly after t(' — so the module scan takes every quoted
  // key.
  for (const match of module.matchAll(/'(dash_cashinhand_[a-z_]+)'/g)) used.add(match[1]);
  // Home Dashboard overhaul: the deleted section's
  // dash_cashinhand_sub key left the page — the 3 keys that remain
  // (title + count_sing/plur) are still pinned.
  assert.ok(used.size >= 3, `expected at least 3 cash-in-hand keys, found ${[...used].join(', ')}`);
  for (const key of used) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `missing English key ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `missing Urdu key ${key}`);
    assert.ok(/[\u0600-\u06FF]/.test(TRANSLATIONS.ur[key]), `Urdu value of ${key} carries no Urdu script`);
  }
});

test('the new module names no fenced module file in its header and reads no storage, clock, or page', () => {
  const module = readFileSync(new URL('../dashboard-cash-in-hand.js', import.meta.url), 'utf8');
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
