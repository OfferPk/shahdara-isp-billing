/**
 * revenue-leak-detector.test.js — SISP-85: Monthly Unbilled /
 * Zero-Rate / Expired-Pause Revenue Leak Detector.
 *
 * FLAG RULES (pinned here):
 *   - zero-rate: an ACTIVE, non-archived, non-FREE customer whose
 *     recorded package price (packagePrice, else monthlySellingAmount)
 *     is exactly Rs 0. An unset price is not zero. FREE connections
 *     (isFreeConnection) are Rs 0 by design and are NEVER flagged.
 *   - expired-pause: a customer still recorded as paused whose
 *     autoResumeDate is strictly before today. Flag only — the scan
 *     never resumes or edits the record.
 *   - missing-current-bill: an ACTIVE, non-paused, non-FREE customer
 *     with no bill record for the current month, whose billing has
 *     already started.
 * Estimates come only from recorded data: the applicable scheduled
 * rate for the month, or the customer's own last priced bill. When
 * neither exists the estimate is null — never an invented rate.
 *
 * SPEC PIN: an active customer with packagePrice 0 (non-FREE) AND a
 * customer with an expired autoResumeDate are both flagged in the
 * Revenue Leak Audit list; a FREE customer with price 0 is NOT.
 *
 * All data is synthetic.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  REVENUE_LEAK_EXPIRED_PAUSE, REVENUE_LEAK_MISSING_BILL, REVENUE_LEAK_ZERO_RATE,
  buildRevenueLeakAudit, buildRevenueLeakSummary, lastPricedBillBefore,
  recordedPackagePrice, revenueLeaksForCustomer, scanRevenueLeaks
} from '../revenue-leak-detector.js';
import { TRANSLATIONS } from '../nav-language.js';

const TODAY = '2026-10-29'; // current month 2026-10

function customer(overrides = {}) {
  return {
    id: 'c1', customerNumber: 1, name: 'Test Customer', mohalla: 'BARRIAN',
    serviceStatus: 'active', archived: false, isFreeConnection: false,
    packagePrice: 3000, monthlySellingAmount: 3000,
    monthlyPriceSchedule: [{ effectiveMonth: '2026-01', amount: 3000 }],
    billingStartMonth: '2026-01',
    paused: false, pauseStartDate: null, autoResumeDate: null, pauseSkippedMonths: [],
    bills: [{ month: '2026-10', dueAmount: 3000, priceSnapshot: 3000, payments: [] }],
    ...overrides
  };
}

function zeroRateCustomer(overrides = {}) {
  return customer({
    id: 'zero', customerNumber: 2, name: 'Zero Rate Customer',
    packagePrice: 0, monthlySellingAmount: 0,
    monthlyPriceSchedule: [{ effectiveMonth: '2026-01', amount: 0 }],
    bills: [
      { month: '2026-09', dueAmount: 3000, priceSnapshot: 3000, payments: [] },
      { month: '2026-10', dueAmount: 0, payments: [] }
    ],
    ...overrides
  });
}

function expiredPauseCustomer(overrides = {}) {
  return customer({
    id: 'expired', customerNumber: 3, name: 'Expired Pause Customer',
    packagePrice: 2500, monthlySellingAmount: 2500,
    monthlyPriceSchedule: [{ effectiveMonth: '2026-01', amount: 2500 }],
    paused: true, pauseStartDate: '2026-09-01', autoResumeDate: '2026-10-15',
    bills: [{ month: '2026-09', dueAmount: 2500, priceSnapshot: 2500, payments: [] }],
    ...overrides
  });
}

test('spec pin: zero-rate and expired-pause customers are flagged; a FREE zero-price customer is not', () => {
  const state = {
    customers: [
      zeroRateCustomer(),
      expiredPauseCustomer(),
      customer({ id: 'free', customerNumber: 4, name: 'Free Line', isFreeConnection: true, packagePrice: 0, monthlySellingAmount: 0, bills: [] })
    ]
  };
  const rows = buildRevenueLeakAudit(state, TODAY);
  const zero = rows.find((row) => row.customerId === 'zero');
  assert.ok(zero, 'zero-rate customer is in the Revenue Leak Audit list');
  assert.equal(zero.flag, REVENUE_LEAK_ZERO_RATE);
  assert.equal(zero.estimatedMonthlyLeakage, 3000, 'estimate is the customer\'s own last priced bill');
  assert.equal(zero.estimateSource, 'last-priced-bill');
  const expired = rows.find((row) => row.customerId === 'expired');
  assert.ok(expired, 'expired-pause customer is in the Revenue Leak Audit list');
  assert.equal(expired.flag, REVENUE_LEAK_EXPIRED_PAUSE);
  assert.equal(expired.autoResumeDate, '2026-10-15');
  assert.equal(expired.estimatedMonthlyLeakage, 2500);
  assert.equal(rows.some((row) => row.customerId === 'free'), false, 'FREE connections are never flagged');
});

test('scanRevenueLeaks is the audit builder alias', () => {
  const state = { customers: [zeroRateCustomer()] };
  assert.deepEqual(scanRevenueLeaks(state, TODAY), buildRevenueLeakAudit(state, TODAY));
});

test('zero-rate: canonical monthlySellingAmount 0 flags when packagePrice is absent', () => {
  const record = zeroRateCustomer();
  delete record.packagePrice;
  const rows = buildRevenueLeakAudit({ customers: [record] }, TODAY);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].flag, REVENUE_LEAK_ZERO_RATE);
  assert.equal(recordedPackagePrice(record), 0);
});

test('zero-rate: an unset price is not zero and is never flagged as zero-rate', () => {
  const record = customer({ packagePrice: null, monthlySellingAmount: null, monthlyPriceSchedule: [] });
  delete record.packagePrice;
  const rows = buildRevenueLeakAudit({ customers: [record] }, TODAY);
  assert.equal(rows.some((row) => row.flag === REVENUE_LEAK_ZERO_RATE), false);
  assert.equal(recordedPackagePrice(record), null);
});

test('zero-rate: archived and non-active customers are excluded', () => {
  assert.deepEqual(buildRevenueLeakAudit({ customers: [zeroRateCustomer({ archived: true })] }, TODAY), []);
  assert.deepEqual(buildRevenueLeakAudit({ customers: [zeroRateCustomer({ serviceStatus: 'offline' })] }, TODAY), []);
});

test('zero-rate: no prior priced bill means a flag with no invented estimate', () => {
  const rows = buildRevenueLeakAudit({ customers: [zeroRateCustomer({ bills: [] })] }, TODAY);
  const zero = rows.find((row) => row.flag === REVENUE_LEAK_ZERO_RATE);
  assert.ok(zero);
  assert.equal(zero.estimatedMonthlyLeakage, null);
  assert.equal(zero.estimateSource, null);
});

test('expired-pause: the auto-resume day itself is not yet expired (strictly before today)', () => {
  assert.deepEqual(buildRevenueLeakAudit({ customers: [expiredPauseCustomer({ autoResumeDate: TODAY })] }, TODAY), []);
  const rows = buildRevenueLeakAudit({ customers: [expiredPauseCustomer({ autoResumeDate: '2026-10-28' })] }, TODAY);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].flag, REVENUE_LEAK_EXPIRED_PAUSE);
});

test('expired-pause: a paused record without an auto-resume date is not an expired pause', () => {
  assert.deepEqual(buildRevenueLeakAudit({ customers: [expiredPauseCustomer({ autoResumeDate: null })] }, TODAY), []);
});

test('expired-pause: a FREE customer is never flagged, even with an expired hold', () => {
  assert.deepEqual(buildRevenueLeakAudit({ customers: [expiredPauseCustomer({ isFreeConnection: true })] }, TODAY), []);
});

test('expired-pause: a priced current bill leaves the flag without an estimate', () => {
  const rows = buildRevenueLeakAudit({
    customers: [expiredPauseCustomer({ bills: [{ month: '2026-10', dueAmount: 2500, priceSnapshot: 2500, payments: [] }] })]
  }, TODAY);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].flag, REVENUE_LEAK_EXPIRED_PAUSE);
  assert.equal(rows[0].estimatedMonthlyLeakage, null);
});

test('missing-current-bill: active customer with no current bill is flagged at the scheduled rate', () => {
  const record = customer({ bills: [{ month: '2026-09', dueAmount: 3000, priceSnapshot: 3000, payments: [] }] });
  const rows = buildRevenueLeakAudit({ customers: [record] }, TODAY);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].flag, REVENUE_LEAK_MISSING_BILL);
  assert.equal(rows[0].currentMonth, '2026-10');
  assert.equal(rows[0].estimatedMonthlyLeakage, 3000);
  assert.equal(rows[0].estimateSource, 'scheduled-rate');
});

test('missing-current-bill: without a schedule the estimate falls back to the last priced bill', () => {
  const record = customer({
    packagePrice: null, monthlySellingAmount: null, monthlyPriceSchedule: [],
    bills: [{ month: '2026-08', dueAmount: 2000, priceSnapshot: 2000, payments: [] }]
  });
  delete record.packagePrice;
  const rows = buildRevenueLeakAudit({ customers: [record] }, TODAY);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].flag, REVENUE_LEAK_MISSING_BILL);
  assert.equal(rows[0].estimatedMonthlyLeakage, 2000);
  assert.equal(rows[0].estimateSource, 'last-priced-bill');
  assert.equal(rows[0].estimateBillMonth, '2026-08');
});

test('missing-current-bill: no recorded rate anywhere means a flag with a null estimate', () => {
  const record = customer({ packagePrice: null, monthlySellingAmount: null, monthlyPriceSchedule: [], bills: [] });
  delete record.packagePrice;
  const rows = buildRevenueLeakAudit({ customers: [record] }, TODAY);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].flag, REVENUE_LEAK_MISSING_BILL);
  assert.equal(rows[0].estimatedMonthlyLeakage, null);
});

test('missing-current-bill: not flagged when billing has not started, the month is paused, or a bill exists', () => {
  const noBills = [{ month: '2026-09', dueAmount: 3000, priceSnapshot: 3000, payments: [] }];
  assert.deepEqual(buildRevenueLeakAudit({ customers: [customer({ billingStartMonth: '2026-11', bills: [] })] }, TODAY), [], 'future billingStartMonth');
  assert.deepEqual(buildRevenueLeakAudit({ customers: [customer({ paused: true, pauseStartDate: '2026-10-01', autoResumeDate: null, bills: noBills })] }, TODAY), [], 'actively paused');
  assert.deepEqual(buildRevenueLeakAudit({ customers: [customer({ pauseSkippedMonths: ['2026-10'], bills: noBills })] }, TODAY), [], 'recorded skipped month');
  assert.deepEqual(buildRevenueLeakAudit({ customers: [customer()] }, TODAY), [], 'current bill exists');
  assert.deepEqual(buildRevenueLeakAudit({ customers: [customer({ bills: [{ month: '2026-10', dueAmount: null, payments: [] }] })] }, TODAY), [], 'an unpriced bill record still counts as a bill');
});

test('missing-current-bill: FREE and archived customers are never flagged', () => {
  assert.deepEqual(buildRevenueLeakAudit({ customers: [customer({ isFreeConnection: true, bills: [] })] }, TODAY), []);
  assert.deepEqual(buildRevenueLeakAudit({ customers: [customer({ archived: true, bills: [] })] }, TODAY), []);
});

test('one customer can carry two flags; the summary total counts the monthly leak once', () => {
  const record = zeroRateCustomer({ bills: [{ month: '2026-09', dueAmount: 3000, priceSnapshot: 3000, payments: [] }] });
  const rows = buildRevenueLeakAudit({ customers: [record] }, TODAY);
  assert.deepEqual(rows.map((row) => row.flag).sort(), [REVENUE_LEAK_MISSING_BILL, REVENUE_LEAK_ZERO_RATE].sort());
  const summary = buildRevenueLeakSummary(rows);
  assert.equal(summary.count, 2);
  assert.equal(summary.flaggedCustomers, 1);
  assert.equal(summary.zeroRateCount, 1);
  assert.equal(summary.missingBillCount, 1);
  assert.equal(summary.totalEstimatedMonthlyLeakage, 3000, 'same connection, same month — counted once, not twice');
});

test('summary: counts by flag and totals across customers', () => {
  const state = { customers: [zeroRateCustomer(), expiredPauseCustomer()] };
  const summary = buildRevenueLeakSummary(buildRevenueLeakAudit(state, TODAY));
  assert.equal(summary.zeroRateCount, 1);
  assert.equal(summary.expiredPauseCount, 1);
  assert.equal(summary.missingBillCount, 0);
  assert.equal(summary.flaggedCustomers, 2);
  assert.equal(summary.totalEstimatedMonthlyLeakage, 5500);
  assert.deepEqual(buildRevenueLeakSummary([]), {
    count: 0, flaggedCustomers: 0,
    counts: { 'zero-rate': 0, 'expired-pause': 0, 'missing-current-bill': 0 },
    zeroRateCount: 0, expiredPauseCount: 0, missingBillCount: 0,
    totalEstimatedMonthlyLeakage: 0, totalEstimatedLeakage: 0
  });
});

test('sort: largest known estimate first, flags without an estimate last', () => {
  const small = customer({ id: 'small', customerNumber: 1, packagePrice: 1500, monthlySellingAmount: 1500, monthlyPriceSchedule: [{ effectiveMonth: '2026-01', amount: 1500 }], bills: [] });
  const big = customer({ id: 'big', customerNumber: 2, packagePrice: 4000, monthlySellingAmount: 4000, monthlyPriceSchedule: [{ effectiveMonth: '2026-01', amount: 4000 }], bills: [] });
  const unknown = customer({ id: 'unknown', customerNumber: 3, packagePrice: null, monthlySellingAmount: null, monthlyPriceSchedule: [], bills: [] });
  delete unknown.packagePrice;
  const rows = buildRevenueLeakAudit({ customers: [small, big, unknown] }, TODAY);
  assert.deepEqual(rows.map((row) => row.customerId), ['big', 'small', 'unknown']);
});

test('revenueLeaksForCustomer mirrors the audit for a single customer', () => {
  assert.deepEqual(revenueLeaksForCustomer(zeroRateCustomer(), TODAY).map((row) => row.flag), [REVENUE_LEAK_ZERO_RATE]);
  assert.deepEqual(revenueLeaksForCustomer(customer(), TODAY), []);
  assert.deepEqual(revenueLeaksForCustomer(null, TODAY), []);
});

test('lastPricedBillBefore reads priceSnapshot first and ignores unpriced bills', () => {
  const record = customer({
    bills: [
      { month: '2026-07', dueAmount: 1800, payments: [] },
      { month: '2026-08', dueAmount: 9999, priceSnapshot: 2200, payments: [] },
      { month: '2026-09', dueAmount: null, payments: [] },
      { month: '2026-10', dueAmount: 3000, priceSnapshot: 3000, payments: [] }
    ]
  });
  assert.deepEqual(lastPricedBillBefore(record, '2026-10'), { month: '2026-08', amount: 2200 });
  assert.equal(lastPricedBillBefore(record, '2026-07'), null);
});

test('read-only: the scan mutates nothing and never resumes an expired hold', () => {
  const state = { customers: [zeroRateCustomer(), expiredPauseCustomer(), customer({ bills: [] })] };
  const before = JSON.stringify(state);
  buildRevenueLeakAudit(state, TODAY);
  revenueLeaksForCustomer(state.customers[1], TODAY);
  assert.equal(JSON.stringify(state), before);
  assert.equal(state.customers[1].paused, true, 'the hold record is untouched — resuming is an operator action');
});

test('robustness: malformed inputs yield no flags, never a throw', () => {
  assert.deepEqual(buildRevenueLeakAudit(null, TODAY), []);
  assert.deepEqual(buildRevenueLeakAudit({}, TODAY), []);
  assert.deepEqual(buildRevenueLeakAudit({ customers: [null, 42, 'x', {}] }, TODAY), []);
  assert.deepEqual(buildRevenueLeakAudit({ customers: [customer({ bills: 'junk' })] }, TODAY).length, 1, 'a non-array bills field reads as no bills');
});

const REVLEAK_KEYS = [
  'revleak_title', 'revleak_sub', 'revleak_empty', 'revleak_total',
  'revleak_estimate', 'revleak_no_estimate', 'revleak_flag_zero',
  'revleak_flag_expired', 'revleak_flag_missing', 'revleak_zero_line',
  'revleak_expired_line', 'revleak_missing_line'
];

test('i18n: every revleak key exists in both dictionaries', () => {
  for (const lang of ['en', 'ur']) {
    for (const key of REVLEAK_KEYS) {
      assert.equal(typeof TRANSLATIONS[lang][key], 'string', `${lang}:${key}`);
      assert.notEqual(TRANSLATIONS[lang][key], key);
      assert.ok(TRANSLATIONS[lang][key].length > 0, `${lang}:${key} empty`);
    }
  }
});

test('i18n audit: every revleak key used via t() in app.js is defined', () => {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const used = new Set();
  // Direct t('revleak_…') calls plus the flag-key lookup map values,
  // which are also passed to t() (via leakFlagKeys[row.flag]).
  for (const match of app.matchAll(/'(revleak_[a-z_]+)'/g)) used.add(match[1]);
  assert.ok(used.size >= 10, `expected the dashboard wiring to use the revleak keys, got ${used.size}`);
  for (const key of used) {
    assert.ok(REVLEAK_KEYS.includes(key), `unexpected key ${key}`);
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en:${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur:${key}`);
  }
});

test('wiring: dashboard section, app render and token-only styles', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="revenueLeakList"'), 'dashboard list');
  assert.ok(html.includes('data-i18n="revleak_title"'), 'panel title i18n');
  assert.ok(html.includes('data-i18n="revleak_sub"'), 'panel sub i18n');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './revenue-leak-detector.js'"), 'app imports the detector module');
  assert.ok(app.includes('buildRevenueLeakAudit(state'), 'dashboard render call');
  assert.ok(app.includes('data-revleak-customer-id'), 'rows open the profile');
  const css = readFileSync(new URL('../dashboard.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('/* SISP-85'), css.indexOf('/* Owner feature 2026-10-29: Dashboard Advance Held'));
  assert.ok(block.includes('.revleak-card'), 'panel styles present');
  assert.ok(block.includes('var(--surface)'), 'token surface');
  assert.ok(block.includes('var(--color-overdue)'), 'token danger colour');
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'no hardcoded hex colours in the revleak styles');
});
