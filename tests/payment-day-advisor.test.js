/**
 * payment-day-advisor.test.js — SISP-79: Habitual Payment Day-of-Month
 * Analyzer & Field Mode Filter.
 *
 * Pins (synthetic data only):
 *  - SPEC PIN: payments on 2026-07-11, 2026-08-10 and 2026-09-12 give
 *    a median habitual pay day of 11, usual window 10–12.
 *  - INCLUSION RULE: a payment counts iff it is a non-voided receipt
 *    with a finite amount > 0 and a valid YYYY-MM-DD date. ALL kinds
 *    count (normal + kind 'advance' alike — each recorded payment is
 *    one day the customer handed over money; a prepay is ONE event on
 *    its recorded date). Voided, zero-amount and bad-date rows never
 *    count.
 *  - Minimum evidence: fewer than 2 qualifying payments -> no habit
 *    (null), never a fabricated day.
 *  - Median: middle sample (odd); Math.round of the two middles'
 *    average (even). Window = median ± 1 clamped to 1..31.
 *  - Likely-to-pay: window containment; Field Mode entry filter +
 *    stable surface-first sort.
 *  - Read-only: deriving a habit mutates nothing and stores nothing
 *    on the customer record.
 *  - Profile presentation + i18n: prof_payday_* / prof_field_payday
 *    keys exist in en + ur; the profile label renders the window.
 *  - Wiring: app.js renders the profile field; field-mode.js renders
 *    the 🎯 toggle and consumes the advisor.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MIN_HABIT_PAYMENTS,
  paymentDayOfMonth,
  qualifyingPaymentDays,
  paymentDayHabit,
  typicalPaymentDayOfMonth,
  habitCoversDay,
  isLikelyToPayOn,
  filterLikelyToPayEntries,
  sortLikelyToPayFirst
} from '../payment-day-advisor.js';
import { paymentHabitPresentation } from '../profile-ui.js';
import { TRANSLATIONS, t } from '../nav-language.js';

function pay(id, date, amount = 3000, extra = {}) {
  return { id, date, amount, method: 'Cash', ...extra };
}
function bill(month, payments = []) {
  return { id: `b-${month}`, month, dueAmount: 3000, status: 'pending', payments };
}
function customer(overrides = {}) {
  return {
    id: 'c1', customerNumber: 1, name: 'Habit Test', phone: '03001234567',
    mohalla: 'BARRIAN', serviceStatus: 'active', archived: false, bills: [],
    ...overrides
  };
}
/** Customer whose payments sit on the given 'YYYY-MM-DD' dates (one bill per month). */
function payer(dates) {
  const byMonth = new Map();
  dates.forEach((date, i) => {
    const month = date.slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month).push(pay(`p${i}`, date));
  });
  return customer({ bills: [...byMonth.entries()].map(([month, payments]) => bill(month, payments)) });
}

test('spec pin: payments 2026-07-11, 2026-08-10, 2026-09-12 -> median habitual pay day 11, window 10-12', () => {
  const cust = payer(['2026-07-11', '2026-08-10', '2026-09-12']);
  assert.deepEqual(qualifyingPaymentDays(cust), [10, 11, 12]);
  assert.equal(typicalPaymentDayOfMonth(cust), 11);
  const habit = paymentDayHabit(cust);
  assert.equal(habit.medianDay, 11);
  assert.equal(habit.windowStart, 10);
  assert.equal(habit.windowEnd, 12);
  assert.equal(habit.paymentCount, 3);
});

test('inclusion rule: voided, zero-amount, negative and bad-date payments never count', () => {
  const cust = customer({
    bills: [bill('2026-07', [
      pay('ok1', '2026-07-11'),
      pay('ok2', '2026-07-12'),
      pay('voided', '2026-07-25', 3000, { voided: true }),
      pay('zero', '2026-07-03', 0),
      pay('neg', '2026-07-04', -500),
      pay('bad-date', '25/07/2026'),
      pay('impossible', '2026-02-31'),
      pay('no-date', null),
      { id: 'no-amount', date: '2026-07-09', method: 'Cash' }
    ])]
  });
  assert.deepEqual(qualifyingPaymentDays(cust), [11, 12]);
  assert.equal(typicalPaymentDayOfMonth(cust), 12); // Math.round((11+12)/2) = 12
});

test('inclusion rule: advance-kind payments count (money handed over on its recorded date)', () => {
  const cust = customer({
    bills: [
      bill('2026-07', [pay('n1', '2026-07-05')]),
      bill('2026-08', [pay('a1', '2026-08-07', 3000, { kind: 'advance', targetMonth: '2026-09' })])
    ]
  });
  assert.deepEqual(qualifyingPaymentDays(cust), [5, 7]);
  assert.equal(typicalPaymentDayOfMonth(cust), 6);
});

test('minimum evidence: 0 or 1 qualifying payments -> no habit, never fabricated', () => {
  assert.equal(MIN_HABIT_PAYMENTS, 2);
  assert.equal(paymentDayHabit(customer()), null);
  assert.equal(typicalPaymentDayOfMonth(customer()), null);
  assert.equal(paymentDayHabit(payer(['2026-07-11'])), null);
  assert.equal(typicalPaymentDayOfMonth(payer(['2026-07-11'])), null);
  // A voided second payment does not manufacture evidence either.
  const oneRealOneVoided = customer({
    bills: [bill('2026-07', [pay('r', '2026-07-11'), pay('v', '2026-07-12', 3000, { voided: true })])]
  });
  assert.equal(paymentDayHabit(oneRealOneVoided), null);
});

test('median: even counts round the average of the two middle samples; duplicates count individually', () => {
  assert.equal(typicalPaymentDayOfMonth(payer(['2026-07-10', '2026-08-12'])), 11);
  assert.equal(typicalPaymentDayOfMonth(payer(['2026-07-09', '2026-08-10', '2026-09-11', '2026-10-20'])), 11); // (10+11)/2 = 10.5 -> 11
  assert.deepEqual(qualifyingPaymentDays(payer(['2026-07-11', '2026-08-11', '2026-09-20'])), [11, 11, 20]);
  assert.equal(typicalPaymentDayOfMonth(payer(['2026-07-11', '2026-08-11', '2026-09-20'])), 11);
});

test('window clamps to 1..31 at the month edges', () => {
  const first = paymentDayHabit(payer(['2026-07-01', '2026-08-01']));
  assert.equal(first.medianDay, 1);
  assert.equal(first.windowStart, 1);
  assert.equal(first.windowEnd, 2);
  const last = paymentDayHabit(payer(['2026-07-31', '2026-08-31']));
  assert.equal(last.medianDay, 31);
  assert.equal(last.windowStart, 30);
  assert.equal(last.windowEnd, 31);
});

test('paymentDayOfMonth validates real calendar dates', () => {
  assert.equal(paymentDayOfMonth('2026-07-11'), 11);
  assert.equal(paymentDayOfMonth('2024-02-29'), 29); // leap year
  assert.equal(paymentDayOfMonth('2026-02-29'), null); // not a leap year
  assert.equal(paymentDayOfMonth('2026-13-01'), null);
  assert.equal(paymentDayOfMonth('11-07-2026'), null);
  assert.equal(paymentDayOfMonth(''), null);
  assert.equal(paymentDayOfMonth(undefined), null);
});

test('likely-to-pay: the usual window contains the day, the edges count, outside does not', () => {
  const cust = payer(['2026-07-11', '2026-08-10', '2026-09-12']); // window 10-12
  assert.equal(isLikelyToPayOn(cust, 10), true);
  assert.equal(isLikelyToPayOn(cust, 11), true);
  assert.equal(isLikelyToPayOn(cust, 12), true);
  assert.equal(isLikelyToPayOn(cust, 9), false);
  assert.equal(isLikelyToPayOn(cust, 13), false);
  assert.equal(isLikelyToPayOn(payer(['2026-07-11']), 11), false); // no habit
  assert.equal(habitCoversDay(null, 11), false);
  assert.equal(habitCoversDay(paymentDayHabit(cust), 0), false);
  assert.equal(habitCoversDay(paymentDayHabit(cust), 32), false);
});

test('field filter: only evidence-backed likely customers surface; sort is stable likely-first', () => {
  const early = { ...payer(['2026-07-05', '2026-08-06']), id: 'early', customerNumber: 2, name: 'Early Payer' };
  const mid = { ...payer(['2026-07-11', '2026-08-10', '2026-09-12']), id: 'mid', customerNumber: 3, name: 'Mid Payer' };
  const noHabit = { ...payer(['2026-07-11']), id: 'new', customerNumber: 4, name: 'New Customer' };
  const customers = [early, mid, noHabit];
  const entries = [
    { id: 'early', customerNumber: 2, name: 'Early Payer', totalDues: 3000 },
    { id: 'mid', customerNumber: 3, name: 'Mid Payer', totalDues: 3000 },
    { id: 'new', customerNumber: 4, name: 'New Customer', totalDues: 3000 },
    { id: 'ghost', customerNumber: 5, name: 'Ghost', totalDues: 3000 }
  ];
  // Day 11 sits in mid's window (10-12) only.
  assert.deepEqual(filterLikelyToPayEntries(entries, customers, 11).map(e => e.id), ['mid']);
  assert.deepEqual(filterLikelyToPayEntries(entries, new Map(customers.map(c => [c.id, c])), 11).map(e => e.id), ['mid']);
  // Sort: likely first, original relative order preserved in both groups.
  assert.deepEqual(sortLikelyToPayFirst(entries, customers, 11).map(e => e.id), ['mid', 'early', 'new', 'ghost']);
  // Day 5: early's window (5-7 via median 6? days 5,6 -> median 6, window 5-7) contains it.
  assert.deepEqual(filterLikelyToPayEntries(entries, customers, 5).map(e => e.id), ['early']);
  assert.deepEqual(filterLikelyToPayEntries(null, customers, 11), []);
});

test('read-only: deriving a habit mutates nothing and stores nothing on the record', () => {
  const cust = payer(['2026-07-11', '2026-08-10', '2026-09-12']);
  const before = JSON.stringify(cust);
  paymentDayHabit(cust);
  typicalPaymentDayOfMonth(cust);
  isLikelyToPayOn(cust, 11);
  paymentHabitPresentation(cust);
  assert.equal(JSON.stringify(cust), before);
  assert.equal('typicalPaymentDayOfMonth' in cust, false);
});

test('profile presentation: window label with ordinals; honest empty state below 2 payments', () => {
  const cust = payer(['2026-07-11', '2026-08-10', '2026-09-12']);
  const shown = paymentHabitPresentation(cust);
  assert.equal(shown.visible, true);
  assert.equal(shown.medianDay, 11);
  assert.equal(shown.windowStart, 10);
  assert.equal(shown.windowEnd, 12);
  assert.equal(shown.paymentCount, 3);
  assert.equal(shown.label, 'Usually pays around 10th–12th');
  const none = paymentHabitPresentation(payer(['2026-07-11']));
  assert.equal(none.visible, false);
  assert.equal(none.label, 'Not enough payments yet');
});

test('i18n: every SISP-79 key exists in en + ur and interpolates', () => {
  for (const key of ['prof_field_payday', 'prof_payday_usually', 'prof_payday_none']) {
    assert.ok(TRANSLATIONS.en[key], `en missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `ur missing ${key}`);
  }
  assert.equal(t('prof_payday_usually', 'en', { range: '10th–12th' }), 'Usually pays around 10th–12th');
  assert.ok(t('prof_payday_usually', 'ur', { range: '10–12' }).includes('10–12'));
});

test('wiring: profile field in app.js; field-mode toggle + advisor import; advisor is DOM-free', () => {
  const appJs = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(appJs.includes('paymentHabitPresentation'), 'app.js must use paymentHabitPresentation');
  assert.ok(appJs.includes("t('prof_field_payday')"), 'app.js must render the prof_field_payday row');
  assert.ok(appJs.includes('paydaySummary.label'), 'app.js must render the payday label');
  const fieldJs = readFileSync(new URL('../field-mode.js', import.meta.url), 'utf8');
  assert.ok(fieldJs.includes("from './payment-day-advisor.js'"), 'field-mode.js must import the advisor');
  assert.ok(fieldJs.includes('data-field-likely="toggle"'), 'field-mode.js must render the Likely toggle chip');
  assert.ok(fieldJs.includes('filterLikelyToPayEntries'), 'field-mode.js must apply the habit filter');
  assert.ok(fieldJs.includes('🎯 Likely today'), 'field-mode.js must mark likely cards');
  const advisor = readFileSync(new URL('../payment-day-advisor.js', import.meta.url), 'utf8');
  const advisorCode = advisor.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/\bdocument\s*[.[]|\bwindow\s*[.[]|\blocalStorage\b/.test(advisorCode), 'advisor must stay DOM-free');
});
