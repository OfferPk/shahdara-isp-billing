// Sharafat 40: the mohalla card's Collected is bill-based, like the method
// chips and the summary-bar Collected — and above 100% the card shows an
// over-100% note instead of a full bar beside a contradictory raw number.
// Every fixture here is synthetic; no real customer names or phone numbers.
//
// Parent decisions (2026-11-14 ~23:50 PKT): (a) bill-based stands everywhere
// — the doc's payment-date flip is rejected as stale (Sharafat 38 made the
// chips bill-based first); (i) full bar + over-100% note text; (ii) new key
// pair, cause-neutral wording; (a) buildAreaBreakdowns is left alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMohallaAnalytics } from '../owner-insights.js';
import {
  buildMonthlyReport,
  calculateMethodTotalsForRows,
} from '../core.js';

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
const { TRANSLATIONS, t, URDU_SCRIPT_PATTERN } = await import('../nav-language.js');

// 2026-11-15 12:00 PKT: current month 2026-11, previous 2026-10.
const REF = new Date(Date.UTC(2026, 10, 15, 7));
const MONTH = '2026-11';
const bill = (overrides) => ({ payments: [], ...overrides });
const customer = (id, fields, bills) => ({
  id, customerNumber: id, name: `Customer ${id}`, archived: false,
  serviceStatus: 'active', ...fields, bills,
});

const chipsTotal = (rows, state) => calculateMethodTotalsForRows(rows, state).total;
const summaryCollected = (rows) => rows.reduce((sum, row) => sum + (row.amountReceived || 0), 0);
const cardCollected = (result) => result.areas.reduce((sum, area) => sum + area.collected, 0);

// Shared fixture for the equality tests. One mohalla's spelling variants
// (Kishti/Kishtii) fold to one card row, like the pinned reports-tab test.
// c1 partial in-month Cash 400; c2 partial with a CROSS-MONTH JazzCash 500
// (dated December, sitting on the November bill) + a VOIDED Cash 700 (never
// counts anywhere); c3 fully paid Cash 1000; c4 pending, nothing paid;
// c5 has no November bill at all (not-set row, sums 0).
const equalityState = () => ({
  customers: [
    customer('c1', { mohalla: 'Kishti' }, [
      bill({ month: MONTH, dueAmount: 1000, packageSnapshot: { label: '10 Mbps' }, payments: [{ date: '2026-11-06', amount: 400, method: 'Cash' }] }),
    ]),
    customer('c2', { mohalla: 'Kishtii', serviceStatus: 'offline' }, [
      bill({ month: MONTH, dueAmount: 2000, packageSnapshot: { label: '10 Mbps' }, payments: [
        { date: '2026-12-02', amount: 500, method: 'JazzCash' },
        { date: '2026-11-07', amount: 700, method: 'Cash', voided: true },
      ] }),
    ]),
    customer('c3', { mohalla: 'Charyaa' }, [
      bill({ month: MONTH, dueAmount: 1000, packageSnapshot: { label: '5 Mbps' }, payments: [{ date: '2026-11-06', amount: 1000, method: 'Cash' }] }),
    ]),
    customer('c4', { mohalla: 'Charyaa' }, [
      bill({ month: MONTH, dueAmount: 3000, packageSnapshot: { label: '5 Mbps' }, payments: [] }),
    ]),
    customer('c5', { mohalla: 'Barrian' }, [
      bill({ month: '2026-10', dueAmount: 1000, packageSnapshot: { label: '5 Mbps' }, payments: [{ date: '2026-10-05', amount: 1000, method: 'Cash' }] }),
    ]),
  ],
  expenses: [],
});

test('Sharafat 40: card collected == chip total == summary-bar Collected, unfiltered', () => {
  const state = equalityState();
  const card = buildMohallaAnalytics(state, MONTH, REF);
  const rows = buildMonthlyReport(state, { month: MONTH }, REF);
  // 400 (c1) + 500 cross-month (c2) + 1000 (c3); the voided 700 counts
  // nowhere and c5's October bill is not a November row.
  assert.equal(cardCollected(card), 1900);
  assert.equal(chipsTotal(rows, state), 1900);
  assert.equal(summaryCollected(rows), 1900);
  const kishtii = card.areas.find((row) => row.key === 'kishtii');
  assert.equal(kishtii.billed, 3000);
  assert.equal(kishtii.collected, 900);
  assert.equal(kishtii.collectionRate, 30);
  const charyaa = card.areas.find((row) => row.key === 'charyaa');
  assert.equal(charyaa.billed, 4000);
  assert.equal(charyaa.collected, 1000);
  assert.equal(charyaa.collectionRate, 25);
});

test('Sharafat 40: chips follow the filter, the card does not (intended, not a bug)', () => {
  const state = equalityState();
  const card = buildMohallaAnalytics(state, MONTH, REF);
  assert.equal(cardCollected(card), 1900);
  // Status filter 'paid' keeps only the fully-paid c3 row on screen.
  const paidRows = buildMonthlyReport(state, { month: MONTH, statusFilter: 'paid' }, REF);
  assert.equal(paidRows.length, 1);
  assert.equal(chipsTotal(paidRows, state), 1000);
  assert.equal(summaryCollected(paidRows), 1000);
  // The card sums ALL customers with a priced bill, filter or not.
  assert.equal(cardCollected(card), 1900);
});

test('Sharafat 40: overpaying bill rates 114.3 on the card; 100% and 50% stay exact', () => {
  const state = {
    customers: [
      customer('c1', { mohalla: 'Barrian' }, [
        bill({ month: MONTH, dueAmount: 700, packageSnapshot: { label: '10 Mbps' }, payments: [{ date: '2026-11-06', amount: 800, method: 'Cash' }] }),
      ]),
      customer('c2', { mohalla: 'Charyaa' }, [
        bill({ month: MONTH, dueAmount: 1000, packageSnapshot: { label: '5 Mbps' }, payments: [{ date: '2026-11-06', amount: 1000, method: 'Cash' }] }),
      ]),
      customer('c3', { mohalla: 'Malla' }, [
        bill({ month: MONTH, dueAmount: 1000, packageSnapshot: { label: '5 Mbps' }, payments: [{ date: '2026-11-06', amount: 500, method: 'Cash' }] }),
      ]),
    ],
    expenses: [],
  };
  const card = buildMohallaAnalytics(state, MONTH, REF);
  const barrian = card.areas.find((row) => row.key === 'barrian');
  assert.equal(barrian.billed, 700);
  assert.equal(barrian.collected, 800);
  assert.equal(barrian.collectionRate, 114.3);
  assert.equal(card.areas.find((row) => row.key === 'charyaa').collectionRate, 100);
  assert.equal(card.areas.find((row) => row.key === 'malla').collectionRate, 50);
});

test('Sharafat 40: negative payment subtracts in the card, like the chips and the summary bar', () => {
  // PROOF OF THE FIX: before 40 the card filtered payments to `amount > 0`,
  // so a -500 correction was EXCLUDED from the card while the chips
  // (totalsFromPayments: `Number(amount) || 0`) SUBTRACTED it — the card
  // said 1000 while chips + summary bar said 500. Decision 1(a) authorises
  // fixing a residual inclusion-rule divergence when one proves out; this
  // fixture proves it, and the card now uses the same bill-based shape.
  const state = {
    customers: [
      customer('c1', { mohalla: 'Kishti' }, [
        bill({ month: MONTH, dueAmount: 2000, packageSnapshot: { label: '10 Mbps' }, payments: [
          { date: '2026-11-06', amount: 1000, method: 'Cash' },
          { date: '2026-11-08', amount: -500, method: 'Cash' },
        ] }),
      ]),
    ],
    expenses: [],
  };
  const card = buildMohallaAnalytics(state, MONTH, REF);
  const rows = buildMonthlyReport(state, { month: MONTH }, REF);
  assert.equal(cardCollected(card), 500);
  assert.equal(chipsTotal(rows, state), 500);
  assert.equal(summaryCollected(rows), 500);
});

test('Sharafat 40: dateless payment counts in the card and in the chips', () => {
  // buildMonthlyReport is NOT called here: it sorts each bill's payments by
  // date and throws on a dateless one (pre-existing Sharafat 10 scope gap,
  // also disclosed in PR #1427) — so the dateless case is pinned at the
  // helper level with fabricated rows, the same technique Sharafat 38 used.
  const state = {
    customers: [
      customer('c1', { mohalla: 'Kishti' }, [
        bill({ month: MONTH, dueAmount: 1000, packageSnapshot: { label: '10 Mbps' }, payments: [{ amount: 600, method: 'Cash' }] }),
      ]),
    ],
    expenses: [],
  };
  const card = buildMohallaAnalytics(state, MONTH, REF);
  assert.equal(cardCollected(card), 600);
  const rows = [{ customerId: 'c1', month: MONTH }];
  assert.equal(calculateMethodTotalsForRows(rows, state).total, 600);
});

test('Sharafat 40: archived customer is included in the card and in the chips', () => {
  const state = {
    customers: [
      customer('c1', { mohalla: 'Kishti', archived: true }, [
        bill({ month: MONTH, dueAmount: 1000, packageSnapshot: { label: '10 Mbps' }, payments: [{ date: '2026-11-06', amount: 1000, method: 'Cash' }] }),
      ]),
    ],
    expenses: [],
  };
  const card = buildMohallaAnalytics(state, MONTH, REF);
  const rows = buildMonthlyReport(state, { month: MONTH }, REF);
  // Sharafat 40 stands: the mohalla CARD still includes archived customers.
  assert.equal(cardCollected(card), 1000);
  // Sharafat 45 changed the REPORT side: the monthly report excludes
  // archived customers by default, so its rows / chips / summary are 0
  // here — the chips and the summary bar follow the same filtered rows
  // (Sharafat 38). The toggle-ON path keeps the old inclusion.
  assert.equal(chipsTotal(rows, state), 0);
  assert.equal(summaryCollected(rows), 0);
  const included = buildMonthlyReport(state, { month: MONTH, includeArchived: true }, REF);
  assert.equal(chipsTotal(included, state), 1000);
  assert.equal(summaryCollected(included), 1000);
});

test('Sharafat 40: over-100% shows the note in text + aria-label, never the raw number', () => {
  // app.js cannot be imported in Node (it executes DOM code at import time;
  // no repo test imports it), so the render is pinned by source assertions,
  // the same technique tests/sharafat-38-method-chips.test.js uses.
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const start = app.indexOf('function renderMohallaAnalytics(month) {');
  const end = app.indexOf('function getMonthlyReportScreenRows()', start);
  assert.ok(start > 0 && end > start, 'renderMohallaAnalytics body must be extractable');
  const body = app.slice(start, end);
  // The branch keys off the RAW collectionRate, never the `?? 0` value — so
  // a null rate (billed 0) can never take the over-100% branch. (In practice
  // validPrice requires dueAmount > 0, so a formed group always has a rate;
  // the `?? 0` is a defensive render guard only.)
  assert.ok(body.includes('(area.collectionRate ?? 0) > 100'), 'over-100% branch must key off the raw collectionRate');
  assert.ok(body.includes("t('mohalla_card_rate_over')"), 'over-100% branch must use the note key');
  // The raw rate text survives exactly once — the else branch of the
  // rateText ternary. Both the bar aria-label and the visible text render
  // rateText, so above 100% neither prints the raw number.
  assert.equal(body.split("t('mohalla_card_rate', null, { rate })").length - 1, 1);
  assert.equal(body.split('escapeHtml(rateText)').length - 1, 2);
  // The bar itself is still clamped — full at 100%+, never wider.
  assert.ok(body.includes('Math.max(0, Math.min(100, rate))'), 'bar width must stay clamped to 100%');
});

test('Sharafat 40: over-100% note key exists in both dicts and resolves cleanly', () => {
  assert.equal(TRANSLATIONS.en.mohalla_card_rate_over, 'Over 100% — collected more than billed');
  assert.equal(TRANSLATIONS.ur.mohalla_card_rate_over, '100 فیصد سے زیادہ — بل سے زیادہ وصول شدہ');
  assert.ok(URDU_SCRIPT_PATTERN.test(TRANSLATIONS.ur.mohalla_card_rate_over), 'Urdu note must contain Urdu script');
  assert.equal(t('mohalla_card_rate_over'), 'Over 100% — collected more than billed');
  assert.equal(t('mohalla_card_rate_over', 'ur'), '100 فیصد سے زیادہ — بل سے زیادہ وصول شدہ');
  assert.ok(!t('mohalla_card_rate_over').includes('{'), 'note must carry no leftover {param}');
  assert.ok(!t('mohalla_card_rate_over', 'ur').includes('{'), 'Urdu note must carry no leftover {param}');
  // The old rate key is untouched in both dicts.
  assert.equal(t('mohalla_card_rate', null, { rate: 50 }), '50% collected');
  assert.equal(t('mohalla_card_rate', 'ur', { rate: 50 }), '50% وصول شدہ');
});
