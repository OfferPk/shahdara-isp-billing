import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AGEING_BUCKETS,
  isValidBillMonth,
  billAgeMonths,
  ageingBucketForMonths,
  ageingBucketForBill,
  ageingMohallaKey,
  ageingMohallaLabel,
  buildReceivablesAgeing,
  ageingSummary,
  ageingHtml,
  ageingCsv,
  ageingFilename,
} from '../receivables-ageing.js';

const AS_OF = '2026-11';

const entry = (overrides = {}) => ({
  customerId: 'c1',
  customerName: 'Ayesha',
  mohalla: 'Bani',
  billMonth: '2026-11',
  amount: 5000,
  ...overrides,
});

// ---- month arithmetic and bucket mapping ----

test('bill age: same month is 0, older months count, year boundary works', () => {
  assert.equal(billAgeMonths('2026-11', AS_OF), 0);
  assert.equal(billAgeMonths('2026-10', AS_OF), 1);
  assert.equal(billAgeMonths('2026-09', AS_OF), 2);
  assert.equal(billAgeMonths('2026-08', AS_OF), 3);
  assert.equal(billAgeMonths('2025-12', '2026-02'), 2);
  assert.equal(billAgeMonths('2026-01', AS_OF), 10);
});

test('bill age: future bill month is negative, invalid months are null', () => {
  assert.equal(billAgeMonths('2026-12', AS_OF), -1);
  assert.equal(billAgeMonths('not-a-month', AS_OF), null);
  assert.equal(billAgeMonths('2026-11', '2026-13'), null);
  assert.equal(billAgeMonths('2026-11', ''), null);
});

test('month validation accepts YYYY-MM only with month 01-12', () => {
  assert.equal(isValidBillMonth('2026-11'), true);
  assert.equal(isValidBillMonth('2026-00'), false);
  assert.equal(isValidBillMonth('2026-13'), false);
  assert.equal(isValidBillMonth('2026-1'), false);
  assert.equal(isValidBillMonth('2026/11'), false);
  assert.equal(isValidBillMonth(null), false);
  assert.equal(isValidBillMonth(202611), false);
});

test('bucket mapping: 0 current, 1, 2, 3+; future counts as current; unknown is null', () => {
  assert.equal(ageingBucketForMonths(0), 'current');
  assert.equal(ageingBucketForMonths(1), 'one');
  assert.equal(ageingBucketForMonths(2), 'two');
  assert.equal(ageingBucketForMonths(3), 'threePlus');
  assert.equal(ageingBucketForMonths(9), 'threePlus');
  assert.equal(ageingBucketForMonths(-2), 'current');
  assert.equal(ageingBucketForMonths(null), null);
  assert.equal(ageingBucketForMonths(undefined), null);
  assert.equal(ageingBucketForBill('2026-09', AS_OF), 'two');
  assert.equal(ageingBucketForBill('garbage', AS_OF), null);
});

test('bucket definitions are exactly current / 1 month / 2 months / 3+ months', () => {
  assert.deepEqual(AGEING_BUCKETS.map((b) => b.key), ['current', 'one', 'two', 'threePlus']);
  assert.deepEqual(AGEING_BUCKETS.map((b) => b.label), ['Current', '1 month', '2 months', '3+ months']);
});

// ---- mohalla grouping ----

test('mohalla key collapses prefix and case variants, blank becomes UNASSIGNED', () => {
  assert.equal(ageingMohallaKey('Bani'), ageingMohallaKey('MOHALLA BANI'));
  assert.equal(ageingMohallaKey('bani'), ageingMohallaKey('MOHALLA  BANI'));
  assert.equal(ageingMohallaKey(''), 'UNASSIGNED');
  assert.equal(ageingMohallaKey(null), 'UNASSIGNED');
  assert.equal(ageingMohallaLabel(''), 'Unassigned');
  assert.equal(ageingMohallaLabel('  Bani  '), 'Bani');
});

test('caller-supplied mohallaKey / mohallaLabel win over derivation', () => {
  const view = buildReceivablesAgeing([
    entry({ mohalla: 'Bani', mohallaKey: 'CANON-KEY', mohallaLabel: 'Bani (canonical)' }),
  ], AS_OF);
  assert.equal(view.mohallaTotals[0].key, 'CANON-KEY');
  assert.equal(view.mohallaTotals[0].label, 'Bani (canonical)');
});

// ---- view construction and the exact-sum acceptance ----

test('bucket amounts sum exactly to total outstanding on a mixed fixture', () => {
  const view = buildReceivablesAgeing([
    entry({ billMonth: '2026-11', amount: 5000 }),
    entry({ customerId: 'c2', customerName: 'Bilal', billMonth: '2026-10', amount: 3000 }),
    entry({ customerId: 'c3', customerName: 'Chand', mohalla: 'Shahdara', billMonth: '2026-09', amount: 2000 }),
    entry({ customerId: 'c4', customerName: 'Dina', mohalla: 'Shahdara', billMonth: '2026-08', amount: 4000 }),
    entry({ customerId: 'c5', customerName: 'Ehsan', billMonth: '2026-06', amount: 1000 }),
  ], AS_OF);
  assert.equal(view.valid, true);
  assert.equal(view.buckets.current.amount, 5000);
  assert.equal(view.buckets.one.amount, 3000);
  assert.equal(view.buckets.two.amount, 2000);
  assert.equal(view.buckets.threePlus.amount, 5000);
  assert.equal(view.bucketTotal, 15000);
  assert.equal(view.totalOutstanding, 15000);
  assert.equal(view.billCount, 5);
  assert.equal(view.sumsMatch, true);
});

test('each bucket lists its customers and mohalla totals split by bucket', () => {
  const view = buildReceivablesAgeing([
    entry({ billMonth: '2026-11', amount: 5000 }),
    entry({ customerId: 'c2', customerName: 'Bilal', billMonth: '2026-10', amount: 3000 }),
    entry({ customerId: 'c3', customerName: 'Chand', mohalla: 'Shahdara', billMonth: '2026-09', amount: 2000 }),
    entry({ customerId: 'c4', customerName: 'Dina', mohalla: 'Shahdara', billMonth: '2026-08', amount: 4000 }),
  ], AS_OF);
  assert.equal(view.buckets.current.customers[0].customerName, 'Ayesha');
  assert.equal(view.buckets.threePlus.customers[0].customerName, 'Dina');
  const bani = view.mohallaTotals.find((row) => row.key === 'BANI');
  const shahdara = view.mohallaTotals.find((row) => row.key === 'SHAHDARA');
  assert.equal(bani.total, 8000);
  assert.equal(bani.byBucket.current, 5000);
  assert.equal(bani.byBucket.one, 3000);
  assert.equal(shahdara.total, 6000);
  assert.equal(shahdara.byBucket.two, 2000);
  assert.equal(shahdara.byBucket.threePlus, 4000);
  assert.equal(view.mohallaTotals[0].key, 'BANI'); // highest total first
});

test('same customer with two bills in one bucket aggregates into one customer row', () => {
  const view = buildReceivablesAgeing([
    entry({ billMonth: '2026-10', amount: 3000 }),
    entry({ billMonth: '2026-10', amount: 1000 }),
    entry({ customerId: 'c2', customerName: 'Bilal', billMonth: '2026-10', amount: 2000 }),
  ], AS_OF);
  const bucket = view.buckets.one;
  assert.equal(bucket.amount, 6000);
  assert.equal(bucket.billCount, 3);
  assert.equal(bucket.customerCount, 2);
  assert.equal(bucket.customers[0].customerName, 'Ayesha');
  assert.equal(bucket.customers[0].amount, 4000);
  assert.equal(bucket.customers[0].billCount, 2);
  assert.deepEqual(bucket.customers[0].billMonths, ['2026-10']);
});

test('future bill month counts as current, not as aged debt', () => {
  const view = buildReceivablesAgeing([entry({ billMonth: '2026-12', amount: 700 })], AS_OF);
  assert.equal(view.buckets.current.amount, 700);
  assert.equal(view.buckets.threePlus.amount, 0);
});

test('unparseable bill month is unaged: counted in total, in no bucket', () => {
  const view = buildReceivablesAgeing([
    entry({ billMonth: '2026-11', amount: 5000 }),
    entry({ customerId: 'c2', customerName: 'Bilal', billMonth: 'unknown', amount: 2500 }),
  ], AS_OF);
  assert.equal(view.bucketTotal, 5000);
  assert.equal(view.unagedAmount, 2500);
  assert.equal(view.totalOutstanding, 7500);
  assert.equal(view.unaged.length, 1);
  assert.equal(view.unaged[0].customerName, 'Bilal');
  assert.equal(view.sumsMatch, true);
});

test('zero and negative amounts are skipped, not counted as outstanding', () => {
  const view = buildReceivablesAgeing([
    entry({ billMonth: '2026-11', amount: 5000 }),
    entry({ customerId: 'c2', customerName: 'Bilal', amount: 0 }),
    entry({ customerId: 'c3', customerName: 'Chand', amount: -100 }),
  ], AS_OF);
  assert.equal(view.totalOutstanding, 5000);
  assert.equal(view.billCount, 1);
  assert.equal(view.skippedNonOutstanding, 2);
});

test('blank mohalla groups under Unassigned and is never dropped', () => {
  const view = buildReceivablesAgeing([
    entry({ mohalla: '', amount: 5000 }),
    entry({ customerId: 'c2', customerName: 'Bilal', mohalla: null, amount: 1000 }),
  ], AS_OF);
  assert.equal(view.mohallaTotals.length, 1);
  assert.equal(view.mohallaTotals[0].label, 'Unassigned');
  assert.equal(view.mohallaTotals[0].total, 6000);
  assert.equal(view.totalOutstanding, 6000);
});

test('empty input gives a valid empty view with zero totals', () => {
  const view = buildReceivablesAgeing([], AS_OF);
  assert.equal(view.valid, true);
  assert.equal(view.totalOutstanding, 0);
  assert.equal(view.billCount, 0);
  assert.equal(view.customerCount, 0);
  assert.equal(view.sumsMatch, true);
});

test('invalid as-of month gives an invalid view with zero totals', () => {
  const view = buildReceivablesAgeing([entry()], '2026-13');
  assert.equal(view.valid, false);
  assert.equal(view.totalOutstanding, 0);
  assert.equal(ageingSummary(view), null);
  assert.equal(ageingHtml(view), '');
  assert.equal(ageingCsv(view, []), '');
});

test('building a view never mutates its input entries', () => {
  const entries = [entry(), entry({ customerId: 'c2', customerName: 'Bilal', billMonth: '2026-08', amount: 4000 })];
  const snapshot = JSON.stringify(entries);
  buildReceivablesAgeing(entries, AS_OF);
  assert.equal(JSON.stringify(entries), snapshot);
});

test('no Waada field is read: a broken promise does not change a bucket', () => {
  const view = buildReceivablesAgeing([
    entry({ promiseDate: '2026-01-01', promiseBroken: true, billMonth: '2026-11', amount: 5000 }),
  ], AS_OF);
  assert.equal(view.buckets.current.amount, 5000);
  assert.equal(view.buckets.threePlus.amount, 0);
});

// ---- summary, HTML, CSV ----

test('summary reports headline figures in bucket order', () => {
  const view = buildReceivablesAgeing([
    entry({ billMonth: '2026-11', amount: 5000 }),
    entry({ customerId: 'c2', customerName: 'Bilal', billMonth: '2026-08', amount: 4000 }),
  ], AS_OF);
  const summary = ageingSummary(view);
  assert.equal(summary.totalOutstanding, 9000);
  assert.equal(summary.billCount, 2);
  assert.equal(summary.customerCount, 2);
  assert.deepEqual(summary.buckets.map((b) => b.key), ['current', 'one', 'two', 'threePlus']);
  assert.equal(summary.buckets[3].amount, 4000);
});

test('HTML shows bucket table, mohalla table and escapes customer names', () => {
  const view = buildReceivablesAgeing([
    entry({ customerName: '<script>alert(1)</script>', billMonth: '2026-11', amount: 5000 }),
  ], AS_OF);
  const html = ageingHtml(view);
  assert.match(html, /Current/);
  assert.match(html, /Rs\. 5,000/);
  assert.match(html, /Bill age only/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test('HTML states the bill-age scope and the manual-baqaya exclusion', () => {
  const html = ageingHtml(buildReceivablesAgeing([entry()], AS_OF));
  assert.match(html, /not promise age/);
  assert.match(html, /manual baqaya is not a bill/);
});

test('CSV has one row per aged bill plus mohalla totals', () => {
  const entries = [
    entry({ billMonth: '2026-11', amount: 5000 }),
    entry({ customerId: 'c2', customerName: 'Bilal', billMonth: '2026-08', amount: 4000 }),
  ];
  const view = buildReceivablesAgeing(entries, AS_OF);
  const csv = ageingCsv(view, entries);
  assert.match(csv, /^bucket,customer,mohalla,bill month,amount\n/);
  assert.match(csv, /Current,Ayesha,Bani,2026-11,5000/);
  assert.match(csv, /3\+ months,Bilal,Bani,2026-08,4000/);
  assert.match(csv, /mohalla,total,bills,current,1 month,2 months,3\+ months\nBani,9000,2,5000,0,0,4000/);
});

test('CSV escapes commas and quotes in names', () => {
  const entries = [entry({ customerName: 'Ayesha, "Boss"', amount: 1000 })];
  const view = buildReceivablesAgeing(entries, AS_OF);
  assert.match(ageingCsv(view, entries), /"Ayesha, ""Boss"""/);
});

test('filename carries the as-of month', () => {
  assert.equal(ageingFilename(buildReceivablesAgeing([], AS_OF)), 'receivables-ageing-2026-11.csv');
});
