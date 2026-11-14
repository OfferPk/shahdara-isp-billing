import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, saveBillMonth, addPayment } from '../core.js';
import { calculateDashboardTodayCard } from '../dashboard-today-card.js';
import { calculateDailyClosingSummary } from '../dashboard-daily-closing.js';
import { calculateAreaWiseCollections } from '../dashboard-area-collections.js';
import { calculateFieldRecoveryToday } from '../dashboard-field-recovery.js';
import { TRANSLATIONS } from '../nav-language.js';
import {
  calculateCollectionInsights,
  renderCollectionInsightsCard,
} from '../dashboard-collection-insights.js';

const REF_DATE = new Date('2026-11-08T12:00:00Z');
const TODAY = '2026-11-08';
const YESTERDAY = '2026-11-07';

// Same fixture shape as the QC-5 today-card fixture, so the three
// figures can be pinned against the same receipts: A pays 1500.50
// today, B pays 400 + 200 today (two bills, one customer), D pays
// 500 today, E paid 700 yesterday, F's 200 today is voided, G is
// archived, H is unpriced. Billed this month (Nov, non-archived,
// priced): 2000 + 1000 + 3000 + 500 + 800 + 1200 = 8500.
// Collected this month: 1500.50 + 400 + 200 + 500 + 700 = 3300.50,
// which the area-collections summary rounds to whole rupees (3301).
function buildFixture() {
  let state = createInitialState([
    'Today Cust A',
    'Today Cust B',
    'Today Cust C',
    'Today Cust D',
    'Today Cust E',
    'Today Cust F',
    'Today Cust G',
    'Today Cust H',
  ]);
  const id = (index) => state.customers[index].id;

  // A: bill 2000 due today, paid 1500.50 today — 499.50 still due.
  state = saveBillMonth(state, id(0), { month: '2026-11', dueAmount: 2000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(0), '2026-11', { amount: 1500.50, date: TODAY, method: 'Cash' }, REF_DATE);
  // B: bill 1000 due today paid 400 today + bill 600 (Oct) paid 200
  // today — two receipts, one visited customer, 1000 still due.
  state = saveBillMonth(state, id(1), { month: '2026-11', dueAmount: 1000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = saveBillMonth(state, id(1), { month: '2026-10', dueAmount: 600, status: 'pending', dueDate: '2026-10-05' }, REF_DATE);
  state = addPayment(state, id(1), '2026-11', { amount: 400, date: TODAY, method: 'Cash' }, REF_DATE);
  state = addPayment(state, id(1), '2026-10', { amount: 200, date: TODAY, method: 'Cash' }, REF_DATE);
  // C: bill 3000 due today, nothing paid — 3000 still due.
  state = saveBillMonth(state, id(2), { month: '2026-11', dueAmount: 3000, status: 'pending', dueDate: TODAY }, REF_DATE);
  // D: bill 500 due today, paid in full today — visited, nothing due.
  state = saveBillMonth(state, id(3), { month: '2026-11', dueAmount: 500, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id(3), '2026-11', { amount: 500, date: TODAY, method: 'Cash' }, REF_DATE);
  // E: bill 800 due tomorrow, paid 700 yesterday — counts for
  // yesterday's day-over-day figure, never for today.
  state = saveBillMonth(state, id(4), { month: '2026-11', dueAmount: 800, status: 'pending', dueDate: '2026-11-09' }, REF_DATE);
  state = addPayment(state, id(4), '2026-11', { amount: 700, date: YESTERDAY, method: 'Cash' }, REF_DATE);
  // F: bill 1200 due 6 Nov, paid 200 today then voided — voided is
  // history, never collected cash, and the 1200 stays due.
  state = saveBillMonth(state, id(5), { month: '2026-11', dueAmount: 1200, status: 'pending', dueDate: '2026-11-06' }, REF_DATE);
  state = addPayment(state, id(5), '2026-11', { amount: 200, date: TODAY, method: 'Cash' }, REF_DATE);
  state.customers[5].bills.find((b) => b.month === '2026-11').payments[0].voided = true;
  // G: bill 900 due today, paid 400 today — then archived, so the
  // card never shows this customer.
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
    payments: [],
  });
  return state;
}

// Minimal fake document for the render function: the card is found
// by class, its fields by class — no element ids are introduced.
function fakeDoc() {
  const els = {};
  const make = () => ({ textContent: '', style: {}, setAttribute() {} });
  const card = { querySelector: (sel) => (els[sel] ??= make()) };
  return {
    card,
    els,
    querySelector: (sel) => (sel === '.qc6-collection-insights-card' ? card : null),
  };
}

test('QC-6: collection success rate is collected ÷ billed for the current month', () => {
  const state = buildFixture();
  const summary = calculateCollectionInsights(state, REF_DATE);
  assert.equal(summary.today, TODAY);
  assert.equal(summary.month, '2026-11');
  // Billed Nov 8500, collected Nov 3301 (whole rupees, per the
  // area-collections summary) → round(3301/8500*100) = 39.
  assert.equal(summary.monthBilledCents, 850000);
  assert.equal(summary.monthCollectedCents, 330100);
  assert.equal(summary.successRatePct, 39);
});

test('QC-6: success rate is the area-collections overall rate — one definition, one place', () => {
  const state = buildFixture();
  const summary = calculateCollectionInsights(state, REF_DATE);
  const area = calculateAreaWiseCollections(state, { month: '2026-11', referenceDate: REF_DATE });
  assert.equal(summary.monthBilledCents, Math.round((area.summary.totalBilled ?? 0) * 100));
  assert.equal(summary.monthCollectedCents, Math.round((area.summary.totalCollected ?? 0) * 100));
  assert.equal(summary.successRatePct, area.summary.overallCollectionRate);
});

test('QC-6: old-balance receipts can push the rate over 100% — shown honestly, never capped', () => {
  let state = createInitialState(['Old Balance Cust']);
  const id = state.customers[0].id;
  state = saveBillMonth(state, id, { month: '2026-10', dueAmount: 600, status: 'pending', dueDate: '2026-10-05' }, REF_DATE);
  state = saveBillMonth(state, id, { month: '2026-11', dueAmount: 1000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id, '2026-10', { amount: 600, date: TODAY, method: 'Cash' }, REF_DATE);
  state = addPayment(state, id, '2026-11', { amount: 1000, date: TODAY, method: 'Cash' }, REF_DATE);
  const summary = calculateCollectionInsights(state, REF_DATE);
  // Billed Nov 1000, collected Nov 1600 → 160%.
  assert.equal(summary.monthBilledCents, 100000);
  assert.equal(summary.monthCollectedCents, 160000);
  assert.equal(summary.successRatePct, 160);
});

test('QC-6: no billing and no collections this month shows no rate, never a guessed 0% or 100%', () => {
  const state = createInitialState(['Empty Cust']);
  const summary = calculateCollectionInsights(state, REF_DATE);
  assert.equal(summary.monthBilledCents, 0);
  assert.equal(summary.monthCollectedCents, 0);
  assert.equal(summary.successRatePct, null);
});

test('QC-6: collections with no billing this month follow the existing area-collections rule (100%)', () => {
  let state = createInitialState(['Prior Month Cust']);
  const id = state.customers[0].id;
  state = saveBillMonth(state, id, { month: '2026-10', dueAmount: 600, status: 'pending', dueDate: '2026-10-05' }, REF_DATE);
  state = addPayment(state, id, '2026-10', { amount: 600, date: TODAY, method: 'Cash' }, REF_DATE);
  const summary = calculateCollectionInsights(state, REF_DATE);
  assert.equal(summary.monthBilledCents, 0);
  assert.equal(summary.monthCollectedCents, 60000);
  assert.equal(summary.successRatePct, 100);
});

test('QC-6: average per visit is today collected ÷ distinct customers visited today', () => {
  const state = buildFixture();
  const summary = calculateCollectionInsights(state, REF_DATE);
  const todayCard = calculateDashboardTodayCard(state, REF_DATE);
  const field = calculateFieldRecoveryToday(state, REF_DATE, null);
  // Same receipts source as the today card and the QC-5 card: the
  // collected figure and the visited count must agree with both.
  assert.equal(summary.todayCollectedCents, 260050);
  assert.equal(summary.todayCollectedCents, todayCard.todayCollectedCents);
  assert.equal(summary.customersVisitedCount, 3);
  assert.equal(summary.customersVisitedCount, field.customersVisitedCount);
  // 2600.50 ÷ 3 customers = 866.83 (B's two receipts count once).
  assert.equal(summary.todayPaymentCount, 4);
  assert.equal(summary.avgPerVisitCents, 86683);
});

test('QC-6: average per visit is null on a day with no visits, never a guessed zero', () => {
  const state = createInitialState(['Empty Cust']);
  const summary = calculateCollectionInsights(state, REF_DATE);
  assert.equal(summary.todayCollectedCents, 0);
  assert.equal(summary.customersVisitedCount, 0);
  assert.equal(summary.avgPerVisitCents, null);
});

test('QC-6: day-over-day is today vs yesterday from the same daily-closing source', () => {
  const state = buildFixture();
  const summary = calculateCollectionInsights(state, REF_DATE);
  const yesterday = calculateDailyClosingSummary(state, new Date('2026-11-07T12:00:00Z'), { selectedDate: YESTERDAY });
  assert.equal(summary.yesterday, YESTERDAY);
  assert.equal(summary.yesterdayCollectedCents, 70000);
  assert.equal(summary.yesterdayPaymentCount, 1);
  assert.equal(summary.yesterdayCollectedCents, Math.round((yesterday.todayCollected ?? 0) * 100));
  assert.equal(summary.hasYesterdayData, true);
  // Today 2600.50 − yesterday 700 = +1900.50, +272% (271.5 rounds up).
  assert.equal(summary.dayOverDayChangeCents, 190050);
  assert.equal(summary.dayOverDayChangePct, 272);
});

test('QC-6: a day with no receipts yesterday shows missing, never a zero-filled comparison', () => {
  let state = createInitialState(['Only Today Cust']);
  const id = state.customers[0].id;
  state = saveBillMonth(state, id, { month: '2026-11', dueAmount: 1000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id, '2026-11', { amount: 1000, date: TODAY, method: 'Cash' }, REF_DATE);
  const summary = calculateCollectionInsights(state, REF_DATE);
  assert.equal(summary.todayCollectedCents, 100000);
  assert.equal(summary.yesterdayCollectedCents, 0);
  assert.equal(summary.yesterdayPaymentCount, 0);
  assert.equal(summary.hasYesterdayData, false);
  assert.equal(summary.dayOverDayChangeCents, null);
  assert.equal(summary.dayOverDayChangePct, null);
});

test('QC-6: an empty today against a collected yesterday is a real −100%, not missing', () => {
  let state = createInitialState(['Only Yesterday Cust']);
  const id = state.customers[0].id;
  state = saveBillMonth(state, id, { month: '2026-11', dueAmount: 1000, status: 'pending', dueDate: TODAY }, REF_DATE);
  state = addPayment(state, id, '2026-11', { amount: 400, date: YESTERDAY, method: 'Cash' }, REF_DATE);
  const summary = calculateCollectionInsights(state, REF_DATE);
  assert.equal(summary.todayCollectedCents, 0);
  assert.equal(summary.yesterdayCollectedCents, 40000);
  assert.equal(summary.hasYesterdayData, true);
  assert.equal(summary.dayOverDayChangeCents, -40000);
  assert.equal(summary.dayOverDayChangePct, -100);
});

test('QC-6: voided payments and archived customers never count anywhere', () => {
  const state = buildFixture();
  const summary = calculateCollectionInsights(state, REF_DATE);
  // F's voided 200 today and G's archived 400 today are in neither
  // the month collected (3301, not 3901) nor today's 2600.50.
  assert.equal(summary.monthCollectedCents, 330100);
  assert.equal(summary.todayCollectedCents, 260050);
  assert.equal(summary.customersVisitedCount, 3);
});

test('QC-6: render fills the rate, the definition line, the average and the day-over-day', () => {
  const doc = fakeDoc();
  const summary = calculateCollectionInsights(buildFixture(), REF_DATE);
  renderCollectionInsightsCard(doc, summary);
  assert.equal(doc.els['.qc6-rate'].textContent, '39%');
  assert.equal(doc.els['.qc6-rate-detail'].textContent, 'Collected PKR 3,301 of PKR 8,500 billed');
  assert.equal(doc.els['.qc6-avg'].textContent, 'PKR 866.83');
  assert.equal(doc.els['.qc6-avg-sub'].textContent, '3 customers visited today');
  // Collect Tab polish: the percent leaves the nowrap value (it
  // clipped to "(+18...") and becomes a compact green badge under
  // it — the value is PKR only, the badge carries the percent.
  assert.equal(doc.els['.qc6-dod'].textContent, 'PKR 1,900.50');
  assert.equal(doc.els['.qc6-dod-badge'].textContent, '+272%');
  assert.equal(doc.els['.qc6-dod-sub'].textContent, 'Today PKR 2,600.50 · Yesterday PKR 700');
});

test('QC-6: render says plainly when there is no rate, no visits and no yesterday', () => {
  const doc = fakeDoc();
  const state = createInitialState(['Empty Cust']);
  renderCollectionInsightsCard(doc, calculateCollectionInsights(state, REF_DATE));
  assert.equal(doc.els['.qc6-rate'].textContent, '—');
  assert.match(doc.els['.qc6-rate-detail'].textContent, /No billing this month/);
  assert.equal(doc.els['.qc6-avg'].textContent, '—');
  assert.match(doc.els['.qc6-avg-sub'].textContent, /No visits yet/);
  assert.equal(doc.els['.qc6-dod'].textContent, '—');
  // Collect Tab polish: with no yesterday the badge clears (its
  // :empty rule hides it) instead of keeping a stale percent.
  assert.equal(doc.els['.qc6-dod-badge'].textContent, '');
  assert.match(doc.els['.qc6-dod-sub'].textContent, /No collections yesterday/);
});

test('QC-6: render tolerates a missing card and a missing summary', () => {
  assert.doesNotThrow(() => renderCollectionInsightsCard({ querySelector: () => null }, calculateCollectionInsights(buildFixture(), REF_DATE)));
  assert.doesNotThrow(() => renderCollectionInsightsCard(fakeDoc(), null));
  assert.doesNotThrow(() => renderCollectionInsightsCard(null, null));
});

test('QC-6 pin: the card markup sits in the summary grid right after the QC-5 card', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(page.includes('qc6-collection-insights-card'), 'insights card article missing');
  assert.ok(page.indexOf('qc5-field-recovery-card') < page.indexOf('qc6-collection-insights-card'), 'card must sit after the QC-5 card');
  for (const key of ['qc6_card_title', 'qc6_rate_period', 'qc6_avg_label', 'qc6_dod_label']) {
    assert.ok(page.includes(`data-i18n="${key}"`), `label ${key} missing`);
  }
});

test('QC-6 pin: app wires the new module at the pinned version next to the QC-5 card', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './dashboard-collection-insights.js?v=1.11.0'"), 'module import missing or unpinned');
  assert.ok(app.includes('calculateCollectionInsights'), 'calculate import missing');
  assert.ok(app.includes('renderCollectionInsightsCard'), 'render import missing');
  assert.ok(app.includes('renderCollectionInsightsCard(document, calculateCollectionInsights(state, referenceDate))'), 'render call missing');
});

test('QC-6 pin: every qc6_ key exists in EN and UR, and the UR values carry Urdu script', () => {
  const keys = [
    'qc6_card_title', 'qc6_rate_period', 'qc6_rate_detail', 'qc6_no_rate',
    'qc6_avg_label', 'qc6_avg_sub', 'qc6_no_visits',
    'qc6_dod_label', 'qc6_dod_sub', 'qc6_no_yesterday',
  ];
  for (const key of keys) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `en.${key} missing`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `ur.${key} missing`);
    assert.match(TRANSLATIONS.ur[key], /[\u0600-\u06FF]/, `ur.${key} must carry Urdu script`);
  }
});

test('QC-6 pin: dashboard.css carries the card rules with tokens only — no new hex, no hard-coded scale sizes', () => {
  const css = readFileSync(new URL('../dashboard.css', import.meta.url), 'utf8');
  const start = css.indexOf('.qc6-collection-insights-card');
  assert.ok(start >= 0, 'card CSS missing');
  const block = css.slice(start);
  assert.ok(!/#[0-9a-fA-F]{3,6}\b/.test(block), 'new card CSS must not introduce hex colours');
  assert.ok(!/font-size:\s*(10|12|14|16|20|24|32)px/.test(block), 'new card CSS must use type tokens, not hard-coded sizes');
  const distinct = new Set(css.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  assert.ok(distinct.size <= 87, `dashboard.css has ${distinct.size} distinct hex colours, Plan A cap is 87`);
});

test('QC-6 pin: the module is pure — no clock read, no storage access, no new store key', () => {
  const raw = readFileSync(new URL('../dashboard-collection-insights.js', import.meta.url), 'utf8');
  // Comments describe the design (they name localStorage as the
  // caller's storage); the pin applies to code, so strip them first.
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
  // Yesterday is computed by shifting the caller's reference date —
  // `new Date(referenceDate)` — never by reading the clock, so only
  // the no-argument form and Date.now are forbidden here.
  assert.doesNotMatch(src, /new Date\(\s*\)/, 'module must not read the clock');
  assert.doesNotMatch(src, /Date\.now\(/, 'module must not read the clock');
  assert.doesNotMatch(src, /localStorage/, 'storage arrives as a parameter, never read directly');
  assert.doesNotMatch(src, /setItem\(/, 'module never writes storage');
  assert.doesNotMatch(src, /shahdara_/, 'no new store key — the day-target module owns its key');
});
