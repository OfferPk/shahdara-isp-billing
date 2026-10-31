// SISP-95: Pre-Cycle "What-If / Dry-Run" Next Month Billing Simulator.
// Pure-function tests on synthetic data only.
// Spec test criteria (verbatim): "Running Dry-Run Forecast for 2026-11
// returns exact projected totals and leaves state byte-for-byte unchanged."
//
// Pins:
//  - exact projected totals for 2026-11 on a six-customer fixture
//    (arrears rollover, one active kist, one paused skip, one FREE skip,
//    one archived skip, one advance-covered customer);
//  - the forecast IS the planner: every headline figure equals
//    planBillingCycle's own totals for the same month (no forked math);
//  - state is byte-for-byte unchanged after forecastBillingCycle,
//    forecastNextBillingMonth and the dashboard calculator — proven by
//    JSON snapshot equality AND by running against a deep-frozen state;
//  - no bills are created and repeated runs are identical (nothing is
//    consumed or persisted by a dry run);
//  - nextBillingMonth rollover incl. December -> January;
//  - dashboard seam: calculateNextMonthForecast targets next month and
//    returns null instead of throwing on broken input;
//  - i18n: every dryrun_* key used in app.js exists in BOTH en + ur,
//    and every dryrun_* dictionary key is used (mechanical audit);
//  - wiring: index.html forecast container, token-only CSS rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  forecastBillingCycle,
  forecastNextBillingMonth,
  forecastTextLines,
  nextBillingMonth,
  planBillingCycle
} from '../billing-cycle.js';
import { calculateNextMonthForecast } from '../dashboard.js';
import { TRANSLATIONS } from '../nav-language.js';

const payment = (id, overrides) => ({ id, date: '2026-09-06', amount: 0, method: 'Cash', ...overrides });
const bill = (month, overrides) => ({ id: `bill-${month}`, month, dueAmount: 3000, dueDate: `${month}-05`, status: 'pending', payments: [], generated: true, priceSnapshot: 3000, createdAt: '2026-09-01T00:00:00.000Z', amountHistory: [], ...overrides });
const customer = (id, number, name, overrides) => ({
  id, customerNumber: number, name, archived: false, billingStartMonth: null,
  monthlyPriceSchedule: [{ effectiveMonth: '2026-08', amount: 3000 }],
  bills: [], ...overrides
});

// Six-customer synthetic fixture, ledger position at end of 2026-10.
function fixtureState() {
  return {
    customers: [
      // Owes October in full: Rs. 3,000 arrears roll into November.
      customer('c1', 101, 'DRY ONE', { bills: [bill('2026-10')] }),
      // October paid; router kist 2/3 of Rs. 1,500 falls due in November.
      customer('c2', 102, 'DRY TWO', {
        monthlyPriceSchedule: [{ effectiveMonth: '2026-08', amount: 2000 }],
        bills: [bill('2026-10', { dueAmount: 2000, priceSnapshot: 2000, payments: [payment('p-c2', { date: '2026-10-06', amount: 2000 })] })],
        installmentPlans: [{
          id: 'plan-c2', itemTitle: 'Test Router', totalAmount: 4500, downPayment: 0,
          monthlyKist: 1500, totalMonths: 3, monthsBilled: 1, monthsPaid: 1,
          startDate: '2026-10-05', status: 'active'
        }]
      }),
      // On vacation hold since mid-October: November is skipped.
      customer('c3', 103, 'DRY THREE', { paused: true, pauseStartDate: '2026-10-15', autoResumeDate: null, bills: [bill('2026-10', { payments: [payment('p-c3', { date: '2026-10-06', amount: 3000 })] })] }),
      // FREE connection: never billed, ever.
      customer('c4', 104, 'DRY FOUR', { isFreeConnection: true }),
      // Archived: excluded from the cycle.
      customer('c5', 105, 'DRY FIVE', { archived: true, bills: [bill('2026-10')] }),
      // Paid Rs. 9,000 in September: Rs. 3,000 advance survives October
      // and covers November in full.
      customer('c6', 106, 'DRY SIX', {
        bills: [
          bill('2026-09', { payments: [payment('p-c6', { date: '2026-09-06', amount: 9000 })] }),
          bill('2026-10')
        ]
      })
    ]
  };
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    Object.freeze(value);
  }
  return value;
}

test('spec criterion: Dry-Run Forecast for 2026-11 returns exact projected totals', () => {
  const forecast = forecastBillingCycle(fixtureState(), '2026-11');
  assert.equal(forecast.month, '2026-11');
  assert.equal(forecast.forecast, true);
  // The four spec components.
  assert.equal(forecast.packageBilling, 8000);          // 3000 + 2000 + 3000
  assert.equal(forecast.arrearsRollover, 3000);         // DRY ONE's unpaid October
  assert.equal(forecast.activeKistAmount, 1500);        // DRY TWO's kist 2/3
  assert.equal(forecast.pausedSkippedCount, 1);         // DRY THREE on vacation hold
  assert.deepEqual(forecast.pausedSkipped.map((row) => row.customerId), ['c3']);
  assert.equal(forecast.totalExpected, 12500);          // 8000 + 3000 + 1500
  // Supporting figures.
  assert.equal(forecast.advanceAvailable, 3000);
  assert.equal(forecast.advanceApplied, 3000);          // DRY SIX's November fully covered
  assert.equal(forecast.netExpectedCollection, 9500);   // 6000 + 3500 + 0
  assert.equal(forecast.billedCount, 3);
  assert.equal(forecast.skippedCount, 3);
  assert.deepEqual(forecast.skipped.map((row) => row.reason), ['paused', 'free-connection', 'archived']);
  assert.deepEqual(forecast.defaulterBuckets, { current: 1, oneMonth: 1, twoToThreeMonths: 0, fourPlusMonths: 0 });
  // Active kist detail names the plan line due in the month.
  assert.equal(forecast.kistCustomerCount, 1);
  assert.equal(forecast.kistInstallmentCount, 1);
  assert.equal(forecast.activeKists.length, 1);
  assert.equal(forecast.activeKists[0].customerId, 'c2');
  assert.equal(forecast.activeKists[0].amount, 1500);
  assert.deepEqual(forecast.activeKists[0].labels, ['Kist 2/3: Test Router']);
});

test('no fork: forecast figures equal planBillingCycle totals for the same month', () => {
  const state = fixtureState();
  const forecast = forecastBillingCycle(state, '2026-11');
  const plan = planBillingCycle(state, '2026-11');
  assert.equal(forecast.packageBilling, plan.totals.totalBilled);
  assert.equal(forecast.arrearsRollover, plan.totals.totalArrears);
  assert.equal(forecast.activeKistAmount, plan.totals.totalKist);
  assert.equal(forecast.advanceAvailable, plan.totals.totalAdvanceAvailable);
  assert.equal(forecast.advanceApplied, plan.totals.totalAdvanceApplied);
  assert.equal(forecast.netExpectedCollection, plan.totals.netExpectedCollection);
  assert.equal(forecast.billedCount, plan.totals.billedCount);
  assert.equal(forecast.skippedCount, plan.totals.skippedCount);
  assert.deepEqual(forecast.lines, plan.lines);
  assert.deepEqual(forecast.skipped, plan.skipped);
});

test('spec criterion: state is byte-for-byte unchanged after every forecast entry point', () => {
  const state = fixtureState();
  const before = JSON.stringify(state);
  forecastBillingCycle(state, '2026-11');
  assert.equal(JSON.stringify(state), before);
  forecastNextBillingMonth(state, new Date('2026-10-20T12:00:00Z'));
  assert.equal(JSON.stringify(state), before);
  calculateNextMonthForecast(state, new Date('2026-10-20T12:00:00Z'));
  assert.equal(JSON.stringify(state), before);
  // No bills were created for the forecast month, no plan advanced.
  for (const row of state.customers) {
    assert.ok(!(row.bills ?? []).some((entry) => entry.month === '2026-11'), `${row.id} gained a November bill`);
  }
  assert.equal(state.customers[1].installmentPlans[0].monthsBilled, 1);
});

test('read-only by construction: forecast runs correctly against a deep-frozen state', () => {
  const state = deepFreeze(fixtureState());
  const forecast = forecastBillingCycle(state, '2026-11');
  assert.equal(forecast.totalExpected, 12500);
  assert.equal(forecast.netExpectedCollection, 9500);
  assert.equal(forecast.pausedSkippedCount, 1);
});

test('dry runs consume nothing: two runs for the same month are identical', () => {
  const state = fixtureState();
  const first = forecastBillingCycle(state, '2026-11');
  const second = forecastBillingCycle(state, '2026-11');
  assert.deepEqual(second, first);
});

test('forecastNextBillingMonth targets the month after the PKT reference month', () => {
  const state = fixtureState();
  const october = forecastNextBillingMonth(state, new Date('2026-10-20T12:00:00Z'));
  assert.equal(october.month, '2026-11');
  assert.equal(october.totalExpected, 12500);
  const december = forecastNextBillingMonth(state, new Date('2026-12-10T12:00:00Z'));
  assert.equal(december.month, '2027-01');
});

test('nextBillingMonth: rollover and validation', () => {
  assert.equal(nextBillingMonth('2026-10'), '2026-11');
  assert.equal(nextBillingMonth('2026-12'), '2027-01');
  assert.equal(nextBillingMonth('2026-01'), '2026-02');
  assert.throws(() => nextBillingMonth('2026-13'), /valid billing month/);
  assert.throws(() => nextBillingMonth('soon'), /valid billing month/);
});

test('invalid month and empty state: forecast throws like the planner, empty ledger forecasts zeros', () => {
  assert.throws(() => forecastBillingCycle(fixtureState(), '2026-13'), /valid billing month/);
  assert.throws(() => forecastBillingCycle(fixtureState(), ''), /valid billing month/);
  const empty = forecastBillingCycle({ customers: [] }, '2026-11');
  assert.equal(empty.packageBilling, 0);
  assert.equal(empty.arrearsRollover, 0);
  assert.equal(empty.activeKistAmount, 0);
  assert.equal(empty.totalExpected, 0);
  assert.equal(empty.netExpectedCollection, 0);
  assert.equal(empty.billedCount, 0);
  assert.equal(empty.pausedSkippedCount, 0);
  const noState = forecastBillingCycle(null, '2026-11');
  assert.equal(noState.totalExpected, 0);
});

test('dashboard seam: calculateNextMonthForecast forecasts next month and never throws', () => {
  const forecast = calculateNextMonthForecast(fixtureState(), new Date('2026-10-20T12:00:00Z'));
  assert.equal(forecast.month, '2026-11');
  assert.equal(forecast.totalExpected, 12500);
  assert.equal(calculateNextMonthForecast(undefined, new Date('2026-10-20T12:00:00Z')).totalExpected, 0);
});

test('forecast text lines are labelled a projection and carry the totals', () => {
  const lines = forecastTextLines(forecastBillingCycle(fixtureState(), '2026-11'));
  assert.match(lines[0], /Dry-Run Forecast 2026-11/);
  assert.match(lines[0], /no bills created/);
  assert.ok(lines.some((line) => /Total Expected/.test(line) && /12,500/.test(line)));
  assert.ok(lines.some((line) => /Net Expected Collection/.test(line) && /9,500/.test(line)));
  assert.ok(lines.some((line) => /Arrears/.test(line) && /3,000/.test(line)));
  assert.ok(lines.some((line) => /Paused/.test(line) && /: 1$/.test(line)));
  assert.deepEqual(forecastTextLines(null), []);
});

const DRYRUN_KEYS = [
  'dryrun_heading', 'dryrun_month', 'dryrun_package', 'dryrun_arrears',
  'dryrun_kist', 'dryrun_kist_detail', 'dryrun_total', 'dryrun_advance',
  'dryrun_net', 'dryrun_paused', 'dryrun_note'
];

test('i18n: every dryrun_* key exists in both en and ur dictionaries', () => {
  for (const key of DRYRUN_KEYS) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0 && TRANSLATIONS.ur[key].length > 0, `${key} empty`);
  }
});

test('i18n mechanical audit: the dryrun_* keys app.js renders are exactly the dictionary keys', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const used = [...new Set([...appSource.matchAll(/t\('(dryrun_[a-z_]+)'/g)].map((match) => match[1]))].sort();
  assert.deepEqual(used, [...DRYRUN_KEYS].sort());
});

test('wiring: forecast container in the billing cycle card, token-only CSS', () => {
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(indexHtml.includes('id="billingCycleForecast"'), 'index.html missing the forecast container');
  assert.ok(indexHtml.includes('id="billingCycleSummary"'), 'index.html lost the cycle summary container');
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const rule = css.match(/\.billing-cycle-forecast\s*\{[^}]*\}/);
  assert.ok(rule, 'components.css missing .billing-cycle-forecast');
  assert.ok(rule[0].includes('var(--'), 'forecast CSS must use theme tokens');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(rule[0]), 'forecast CSS must not hardcode colours');
  const dashboardSource = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
  assert.ok(dashboardSource.includes('forecastNextBillingMonth'), 'dashboard.js must build on the billing-cycle forecast');
});
