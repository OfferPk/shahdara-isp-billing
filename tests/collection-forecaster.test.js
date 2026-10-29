/**
 * collection-forecaster.test.js — SISP-54 [P1]: Monthly Collection
 * Target Thermometer & Area-Wise Daily Run-Rate Forecaster.
 *
 * Spec criterion (read-latest.txt, SISP-54): "With Rs. 150,000
 * collected out of Rs. 210,000 billed and 10 days remaining in the
 * month, the forecaster reports 71.4% progress and Rs. 6,000/day
 * required run-rate."
 *
 * Pins:
 *  - the spec scenario exactly (billed 210,000, recovered 150,000,
 *    Oct 21 → 10 days remaining → 71.4% and Rs. 6,000/day);
 *  - target = billed + arrears AT THE START of the month: arrears
 *    settled before the month reduce it, cash paid this month toward
 *    old arrears does NOT shrink it (it raises collected instead);
 *  - a voided receipt never recovers anything (engine excludes it);
 *  - advance credit from last month consumed by this month's bill
 *    counts as recovered; still-unapplied advance cash does not;
 *  - a SISP-50 deposit offset reduces the arrears it settled;
 *  - partial months: past month is final (run-rate 0), future month
 *    plans over the whole month, the month's last day makes the whole
 *    remainder today's run-rate;
 *  - areas group by canonicalMohalla (variants merge, non-canonical
 *    names keep their own bar, no-activity areas hidden, customers
 *    without a mohalla count in totals only), sorted by remaining;
 *  - empty / malformed states return zeros, never throw;
 *  - end-to-end through the real bill pipeline (generated bills +
 *    a recorded advance) — the owner's November case;
 *  - i18n: every fcst_* key exists in BOTH dictionaries; wiring:
 *    section markup, app.js render call, CSS tokens, and the module
 *    is reachable in the build's runtime graph (perf budget #219).
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth, addPayment
} from '../core.js';
import { recordAdvancePayment } from '../advance-payment.js';
import { buildCollectionForecast } from '../collection-forecaster.js';
import { collectRuntimeFiles } from '../build.mjs';
import { TRANSLATIONS } from '../nav-language.js';

let seq = 0;
const nid = prefix => `${prefix}${String(++seq).padStart(4, '0')}`;
const pay = (date, amount, extra = {}) => ({ id: nid('p'), date, amount, method: 'Cash', ...extra });
const bill = (month, dueAmount, payments = [], extra = {}) => ({ month, dueAmount, payments, ...extra });
const cust = (name, mohalla, bills, extra = {}) => ({ id: nid('c'), customerNumber: seq, name, mohalla, bills, ...extra });

// Midday UTC == 17:00 PKT the same day, so PKT day/month are stable.
const OCT_21 = new Date(Date.UTC(2026, 9, 21, 12));
const OCT_31 = new Date(Date.UTC(2026, 9, 31, 12));
const NOV_15 = new Date(Date.UTC(2026, 10, 15, 12));

test('spec criterion: 150,000 of 210,000 billed with 10 days remaining → 71.4% and Rs. 6,000/day', () => {
  const state = {
    customers: [cust('Spec User', 'BARRIAN', [
      bill('2026-10', 210000, [pay('2026-10-05', 100000), pay('2026-10-12', 50000)])
    ])]
  };
  const f = buildCollectionForecast(state, '2026-10', OCT_21);
  assert.equal(f.month, '2026-10');
  assert.equal(f.billedCents, 21000000);
  assert.equal(f.arrearsCents, 0);
  assert.equal(f.targetCents, 21000000);
  assert.equal(f.collectedCents, 15000000);
  assert.equal(f.outstandingCents, 6000000);
  assert.equal(f.remainingCents, 6000000);
  assert.equal(f.progressPercent, 71.4);
  assert.equal(f.daysInMonth, 31);
  assert.equal(f.currentDay, 21);
  assert.equal(f.daysElapsed, 21);
  assert.equal(f.daysRemaining, 10);
  assert.equal(f.requiredDailyRunRateCents, 600000, 'Rs. 6,000/day exactly');
  assert.equal(f.actualDailyPaceCents, Math.round(15000000 / 21));
  assert.equal(f.projectedMonthEndCents, 15000000 + Math.round(15000000 / 21) * 10);
  assert.equal(f.isCurrentMonth, true);
  assert.equal(f.hasTarget, true);
  assert.equal(f.areas.length, 1);
  assert.equal(f.areas[0].targetCents, 21000000);
  assert.equal(f.areas[0].progressPercent, 71.4);
});

test('arrears carried in join the target; this month\'s recovery of them raises collected', () => {
  const state = {
    customers: [cust('Arrears User', 'BARRIAN', [
      bill('2026-09', 50000),
      bill('2026-10', 210000, [pay('2026-10-05', 100000), pay('2026-10-12', 50000)])
    ])]
  };
  const f = buildCollectionForecast(state, '2026-10', OCT_21);
  assert.equal(f.arrearsCents, 5000000);
  assert.equal(f.targetCents, 26000000);
  assert.equal(f.collectedCents, 15000000);
  assert.equal(f.remainingCents, 11000000);
  assert.equal(f.progressPercent, 57.7);
  assert.equal(f.requiredDailyRunRateCents, 1100000);
});

test('arrears settled BEFORE the month reduce the target; unpaid October bill stays fully remaining', () => {
  const state = {
    customers: [cust('Early Settler', 'BARRIAN', [
      bill('2026-09', 50000, [pay('2026-09-10', 20000)]),
      bill('2026-10', 100000)
    ])]
  };
  const f = buildCollectionForecast(state, '2026-10', OCT_21);
  assert.equal(f.arrearsCents, 3000000);
  assert.equal(f.targetCents, 13000000);
  assert.equal(f.collectedCents, 0, 'the September settlement belonged to September\'s pool, not October\'s');
  assert.equal(f.remainingCents, 13000000);
});

test('cash paid this month toward old arrears does not shrink the target', () => {
  const state = {
    customers: [cust('Late Payer', 'BARRIAN', [
      bill('2026-09', 50000, [pay('2026-10-03', 50000)]),
      bill('2026-10', 100000)
    ])]
  };
  const f = buildCollectionForecast(state, '2026-10', OCT_21);
  assert.equal(f.arrearsCents, 5000000, 'arrears are measured at the start of October');
  assert.equal(f.targetCents, 15000000);
  assert.equal(f.collectedCents, 5000000);
  assert.equal(f.remainingCents, 10000000);
  assert.equal(f.progressPercent, 33.3);
});

test('a voided receipt never recovers anything', () => {
  const state = {
    customers: [cust('Voided Vic', 'BARRIAN', [
      bill('2026-10', 10000, [pay('2026-10-05', 6000), pay('2026-10-06', 4000, { voided: true })])
    ])]
  };
  const f = buildCollectionForecast(state, '2026-10', OCT_21);
  assert.equal(f.collectedCents, 600000);
  assert.equal(f.outstandingCents, 400000);
  assert.equal(f.progressPercent, 60);
});

test('advance credit consumed by this month\'s bill counts as recovered; unapplied advance does not inflate', () => {
  const consumed = {
    customers: [cust('Advance Annie', 'BARRIAN', [
      bill('2026-09', 3000, [pay('2026-09-05', 3000), pay('2026-09-28', 4500)]),
      bill('2026-10', 3000)
    ])]
  };
  const f1 = buildCollectionForecast(consumed, '2026-10', OCT_21);
  assert.equal(f1.billedCents, 300000);
  assert.equal(f1.arrearsCents, 0);
  assert.equal(f1.collectedCents, 300000, 'October bill settled by September credit');
  assert.equal(f1.progressPercent, 100);
  assert.equal(f1.remainingCents, 0);

  const unapplied = {
    customers: [cust('Advance Andy', 'BARRIAN', [
      bill('2026-10', 3000, [pay('2026-10-05', 3000), pay('2026-10-29', 2000)])
    ])]
  };
  const f2 = buildCollectionForecast(unapplied, '2026-10', OCT_21);
  assert.equal(f2.collectedCents, 300000, 'the pending 2,000 advance belongs to a future pool');
  assert.equal(f2.progressPercent, 100);
});

test('a SISP-50 deposit offset reduces the arrears it settled', () => {
  const state = {
    customers: [cust('Departed Dan', 'BARRIAN', [
      bill('2026-09', 40000, [], { depositOffsetAmount: 15000 })
    ], { archived: true })]
  };
  const f = buildCollectionForecast(state, '2026-10', OCT_21);
  assert.equal(f.arrearsCents, 2500000);
  assert.equal(f.targetCents, 2500000);
  assert.equal(f.remainingCents, 2500000);
  assert.equal(f.collectedCents, 0);
});

test('partial months: past month is final, future month plans over the whole month, last day is all due today', () => {
  const state = {
    customers: [cust('Partial Pam', 'BARRIAN', [
      bill('2026-09', 90000, [pay('2026-09-10', 45000)]),
      bill('2026-11', 62000)
    ])]
  };
  const past = buildCollectionForecast(state, '2026-09', NOV_15);
  assert.equal(past.isPastMonth, true);
  assert.equal(past.daysRemaining, 0);
  assert.equal(past.currentDay, 30);
  assert.equal(past.progressPercent, 50);
  assert.equal(past.requiredDailyRunRateCents, 0, 'the run is over');
  assert.equal(past.projectedMonthEndCents, past.collectedCents);

  const future = buildCollectionForecast(state, '2026-11', OCT_21);
  assert.equal(future.isFutureMonth, true);
  assert.equal(future.daysElapsed, 0);
  assert.equal(future.daysRemaining, 30);
  assert.equal(future.actualDailyPaceCents, 0);
  assert.equal(future.targetCents, 10700000, 'November target = its bills + September arrears still unpaid');
  assert.equal(future.requiredDailyRunRateCents, Math.ceil(10700000 / 30));

  const lastDayState = {
    customers: [cust('Last Day Lou', 'BARRIAN', [
      bill('2026-10', 31000, [pay('2026-10-30', 11000)])
    ])]
  };
  const lastDay = buildCollectionForecast(lastDayState, '2026-10', OCT_31);
  assert.equal(lastDay.isCurrentMonth, true);
  assert.equal(lastDay.daysRemaining, 0);
  assert.equal(lastDay.requiredDailyRunRateCents, 2000000, 'the whole remainder is due today');
});

test('areas: canonical grouping, variants merge, no-activity areas hidden, sorted by remaining', () => {
  const state = {
    customers: [
      cust('A One', 'BARRIAN', [bill('2026-10', 100000, [pay('2026-10-05', 100000)])]),
      cust('B Two', 'Mohalla Barrian', [bill('2026-10', 50000, [pay('2026-10-05', 10000)])]),
      cust('C Three', 'PALALIYAA', [bill('2026-10', 80000)]),
      cust('D Four', 'HAVELI', [bill('2026-10', 20000, [pay('2026-10-05', 5000)])]),
      cust('E Five', '', [bill('2026-10', 30000)]),
      cust('F Six', 'SODAA', [])
    ]
  };
  const f = buildCollectionForecast(state, '2026-10', OCT_21);
  assert.equal(f.billedCents, 28000000, 'totals include the mohalla-less customer');
  assert.equal(f.areas.length, 3, 'PALALIYAA + merged BARRIAN + HAVELI; SODAA has no activity');
  assert.equal(f.areas[0].remainingCents, 8000000);
  assert.match(f.areas[0].label, /palaliyaa/i);
  assert.equal(f.areas[1].remainingCents, 4000000);
  assert.match(f.areas[1].label, /barrian/i);
  assert.equal(f.areas[1].billedCents, 15000000, 'BARRIAN and "Mohalla Barrian" are one area');
  assert.equal(f.areas[1].collectedCents, 11000000);
  assert.equal(f.areas[1].progressPercent, 73.3);
  assert.equal(f.areas[2].targetCents, 2000000, 'non-canonical HAVELI keeps its own bar');
  assert.equal(f.areas[2].remainingCents, 1500000);
});

test('empty and malformed states return zeros and never throw', () => {
  const empty = buildCollectionForecast({}, '2026-10', OCT_21);
  assert.equal(empty.targetCents, 0);
  assert.equal(empty.progressPercent, null);
  assert.equal(empty.hasTarget, false);
  assert.deepEqual(empty.areas, []);

  const fallback = buildCollectionForecast(null, 'nonsense', OCT_21);
  assert.equal(fallback.month, '2026-10', 'invalid month falls back to the reference PKT month');

  const unpriced = buildCollectionForecast({
    customers: [cust('Unpriced Uma', 'BARRIAN', [bill('2026-10', null, [pay('2026-10-05', 1000)])])]
  }, '2026-10', OCT_21);
  assert.equal(unpriced.hasTarget, false, 'an unpriced bill creates no target');
  assert.equal(unpriced.progressPercent, null);
});

test('end-to-end: generated bills + a recorded advance — the owner\'s November case reads 100%', () => {
  const OCT_29 = new Date(2026, 9, 29, 12);
  const NOV_2 = new Date(2026, 10, 2, 12);
  let state = createInitialState(['Pipeline Pat']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '3000' }, OCT_29);
  state = generateMonthlyBillsThroughCurrentMonth(state, OCT_29);
  state = addPayment(state, 'seed-001', '2026-10', { date: '2026-10-05', amount: '3000', method: 'Cash' }, OCT_29);
  state = recordAdvancePayment(state, 'seed-001', { amount: 3000, date: '2026-10-29', method: 'Cash' }, OCT_29).nextState;
  state = generateMonthlyBillsThroughCurrentMonth(state, NOV_2);

  const november = buildCollectionForecast(state, '2026-11', NOV_2);
  assert.equal(november.billedCents, 300000);
  assert.equal(november.arrearsCents, 0);
  assert.equal(november.collectedCents, 300000, 'November bill recovered by the October advance');
  assert.equal(november.progressPercent, 100);
  assert.equal(november.remainingCents, 0);
});

test('i18n: every fcst_* key exists in both dictionaries with the same shape', () => {
  const enKeys = Object.keys(TRANSLATIONS.en).filter(k => k.startsWith('fcst_')).sort();
  const urKeys = Object.keys(TRANSLATIONS.ur).filter(k => k.startsWith('fcst_')).sort();
  assert.ok(enKeys.length >= 10, `expected the SISP-54 keys, got ${enKeys.length}`);
  assert.deepEqual(urKeys, enKeys);
  for (const key of enKeys) {
    const placeholders = value => [...String(value).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `${key} placeholders differ`);
  }
});

test('wiring: dashboard section, render call, token-only styles, and build-graph reachability', async () => {
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['collectionForecastSection', 'collectionForecastPct', 'collectionForecastFill', 'collectionForecastCollected', 'collectionForecastAreas']) {
    assert.ok(index.includes(`id="${id}"`), `index.html carries #${id}`);
  }
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './collection-forecaster.js'"), 'app.js imports the forecaster');
  assert.ok(app.includes('buildCollectionForecast(state, totals.currentMonth, referenceDate)'), 'renderDashboard renders the current month');

  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('SISP-54'));
  assert.ok(block.includes('.fcst-thermo-fill'), 'thermometer styles shipped');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'SISP-54 styles use theme tokens only, no hex');

  const { files, missing } = await collectRuntimeFiles(new URL('..', import.meta.url).pathname);
  assert.deepEqual(missing, []);
  assert.ok(files.includes('collection-forecaster.js'), 'forecaster is in the runtime graph');
});
