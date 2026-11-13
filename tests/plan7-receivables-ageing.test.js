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

// Sharafat 14: entry amounts are integer CENTS (5000 rupees = 500000
// cents). The module carries cents end-to-end and rounds only at
// display; every fixture and amount assertion below is in cents, and
// the CSV pins exact decimal rupees ("5000.00", never "500000").
const entry = (overrides = {}) => ({
  customerId: 'c1',
  customerName: 'Ayesha',
  mohalla: 'Bani',
  billMonth: '2026-11',
  amount: 500000,
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
    entry({ billMonth: '2026-11', amount: 500000 }),
    entry({ customerId: 'c2', customerName: 'Bilal', billMonth: '2026-10', amount: 300000 }),
    entry({ customerId: 'c3', customerName: 'Chand', mohalla: 'Shahdara', billMonth: '2026-09', amount: 200000 }),
    entry({ customerId: 'c4', customerName: 'Dina', mohalla: 'Shahdara', billMonth: '2026-08', amount: 400000 }),
    entry({ customerId: 'c5', customerName: 'Ehsan', billMonth: '2026-06', amount: 100000 }),
  ], AS_OF);
  assert.equal(view.valid, true);
  assert.equal(view.buckets.current.amount, 500000);
  assert.equal(view.buckets.one.amount, 300000);
  assert.equal(view.buckets.two.amount, 200000);
  assert.equal(view.buckets.threePlus.amount, 500000);
  assert.equal(view.bucketTotal, 1500000);
  assert.equal(view.totalOutstanding, 1500000);
  assert.equal(view.billCount, 5);
  assert.equal(view.sumsMatch, true);
});

test('each bucket lists its customers and mohalla totals split by bucket', () => {
  const view = buildReceivablesAgeing([
    entry({ billMonth: '2026-11', amount: 500000 }),
    entry({ customerId: 'c2', customerName: 'Bilal', billMonth: '2026-10', amount: 300000 }),
    entry({ customerId: 'c3', customerName: 'Chand', mohalla: 'Shahdara', billMonth: '2026-09', amount: 200000 }),
    entry({ customerId: 'c4', customerName: 'Dina', mohalla: 'Shahdara', billMonth: '2026-08', amount: 400000 }),
  ], AS_OF);
  assert.equal(view.buckets.current.customers[0].customerName, 'Ayesha');
  assert.equal(view.buckets.threePlus.customers[0].customerName, 'Dina');
  const bani = view.mohallaTotals.find((row) => row.key === 'BANI');
  const shahdara = view.mohallaTotals.find((row) => row.key === 'SHAHDARA');
  assert.equal(bani.total, 800000);
  assert.equal(bani.byBucket.current, 500000);
  assert.equal(bani.byBucket.one, 300000);
  assert.equal(shahdara.total, 600000);
  assert.equal(shahdara.byBucket.two, 200000);
  assert.equal(shahdara.byBucket.threePlus, 400000);
  assert.equal(view.mohallaTotals[0].key, 'BANI'); // highest total first
});

test('same customer with two bills in one bucket aggregates into one customer row', () => {
  const view = buildReceivablesAgeing([
    entry({ billMonth: '2026-10', amount: 300000 }),
    entry({ billMonth: '2026-10', amount: 100000 }),
    entry({ customerId: 'c2', customerName: 'Bilal', billMonth: '2026-10', amount: 200000 }),
  ], AS_OF);
  const bucket = view.buckets.one;
  assert.equal(bucket.amount, 600000);
  assert.equal(bucket.billCount, 3);
  assert.equal(bucket.customerCount, 2);
  assert.equal(bucket.customers[0].customerName, 'Ayesha');
  assert.equal(bucket.customers[0].amount, 400000);
  assert.equal(bucket.customers[0].billCount, 2);
  assert.deepEqual(bucket.customers[0].billMonths, ['2026-10']);
});

test('future bill month counts as current, not as aged debt', () => {
  const view = buildReceivablesAgeing([entry({ billMonth: '2026-12', amount: 70000 })], AS_OF);
  assert.equal(view.buckets.current.amount, 70000);
  assert.equal(view.buckets.threePlus.amount, 0);
});

test('unparseable bill month is unaged: counted in total, in no bucket', () => {
  const view = buildReceivablesAgeing([
    entry({ billMonth: '2026-11', amount: 500000 }),
    entry({ customerId: 'c2', customerName: 'Bilal', billMonth: 'unknown', amount: 250000 }),
  ], AS_OF);
  assert.equal(view.bucketTotal, 500000);
  assert.equal(view.unagedAmount, 250000);
  assert.equal(view.totalOutstanding, 750000);
  assert.equal(view.unaged.length, 1);
  assert.equal(view.unaged[0].customerName, 'Bilal');
  assert.equal(view.sumsMatch, true);
});

test('zero and negative amounts are skipped, not counted as outstanding', () => {
  const view = buildReceivablesAgeing([
    entry({ billMonth: '2026-11', amount: 500000 }),
    entry({ customerId: 'c2', customerName: 'Bilal', amount: 0 }),
    entry({ customerId: 'c3', customerName: 'Chand', amount: -10000 }),
  ], AS_OF);
  assert.equal(view.totalOutstanding, 500000);
  assert.equal(view.billCount, 1);
  assert.equal(view.skippedNonOutstanding, 2);
});

test('blank mohalla groups under Unassigned and is never dropped', () => {
  const view = buildReceivablesAgeing([
    entry({ mohalla: '', amount: 500000 }),
    entry({ customerId: 'c2', customerName: 'Bilal', mohalla: null, amount: 100000 }),
  ], AS_OF);
  assert.equal(view.mohallaTotals.length, 1);
  assert.equal(view.mohallaTotals[0].label, 'Unassigned');
  assert.equal(view.mohallaTotals[0].total, 600000);
  assert.equal(view.totalOutstanding, 600000);
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
    entry({ promiseDate: '2026-01-01', promiseBroken: true, billMonth: '2026-11', amount: 500000 }),
  ], AS_OF);
  assert.equal(view.buckets.current.amount, 500000);
  assert.equal(view.buckets.threePlus.amount, 0);
});

// ---- summary, HTML, CSV ----

test('summary reports headline figures in bucket order', () => {
  const view = buildReceivablesAgeing([
    entry({ billMonth: '2026-11', amount: 500000 }),
    entry({ customerId: 'c2', customerName: 'Bilal', billMonth: '2026-08', amount: 400000 }),
  ], AS_OF);
  const summary = ageingSummary(view);
  assert.equal(summary.totalOutstanding, 900000);
  assert.equal(summary.billCount, 2);
  assert.equal(summary.customerCount, 2);
  assert.deepEqual(summary.buckets.map((b) => b.key), ['current', 'one', 'two', 'threePlus']);
  assert.equal(summary.buckets[3].amount, 400000);
});

test('HTML shows bucket table, mohalla table and escapes customer names', () => {
  const view = buildReceivablesAgeing([
    entry({ customerName: '<script>alert(1)</script>', billMonth: '2026-11', amount: 500000 }),
  ], AS_OF);
  const html = ageingHtml(view);
  assert.match(html, /Current/);
  // Sharafat 14: display is unchanged in shape — 500000 cents still
  // prints "Rs. 5,000"; only the unit behind the figure changed.
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
    entry({ billMonth: '2026-11', amount: 500000 }),
    entry({ customerId: 'c2', customerName: 'Bilal', billMonth: '2026-08', amount: 400000 }),
  ];
  const view = buildReceivablesAgeing(entries, AS_OF);
  const csv = ageingCsv(view, entries);
  assert.match(csv, /^bucket,customer,mohalla,bill month,amount\n/);
  // Sharafat 14 (parent decision 2026-11-13): the CSV writes exact
  // decimal rupees — "5000.00", never integer cents "500000".
  assert.match(csv, /Current,Ayesha,Bani,2026-11,5000\.00/);
  assert.match(csv, /3\+ months,Bilal,Bani,2026-08,4000\.00/);
  assert.match(csv, /mohalla,total,bills,current,1 month,2 months,3\+ months\nBani,9000\.00,2,5000\.00,0\.00,0\.00,4000\.00/);
});

test('CSV escapes commas and quotes in names', () => {
  const entries = [entry({ customerName: 'Ayesha, "Boss"', amount: 100000 })];
  const view = buildReceivablesAgeing(entries, AS_OF);
  assert.match(ageingCsv(view, entries), /"Ayesha, ""Boss"""/);
});

// ---- Sharafat 15: unaged rows in the CSV ----
// Sharafat 15 (parent decision 2026-11-13): unaged rows print under
// the 'Unaged' bucket label instead of being dropped. All amounts in
// these tests are integer CENTS (Sharafat 14) and the CSV pins exact
// decimal rupees ("2500.00", never "250000").

test('CSV includes unaged rows under the Unaged label (Sharafat 15)', () => {
  const entries = [
    entry({ billMonth: '2026-11', amount: 500000 }),
    entry({ customerId: 'c2', customerName: 'Bilal', billMonth: 'unknown', amount: 250000 }),
  ];
  const view = buildReceivablesAgeing(entries, AS_OF);
  const csv = ageingCsv(view, entries);
  assert.match(csv, /Unaged,Bilal,Bani,unknown,2500\.00/);
  assert.match(csv, /Current,Ayesha,Bani,2026-11,5000\.00/);
});

test('CSV row section and mohalla-totals section reconcile (Sharafat 15)', () => {
  const entries = [
    entry({ billMonth: '2026-11', amount: 500000 }),
    entry({ customerId: 'c2', customerName: 'Bilal', billMonth: '2026-10', amount: 300000 }),
    entry({ customerId: 'c3', customerName: 'Chand', mohalla: 'Shahdara', billMonth: 'unknown', amount: 250000 }),
    entry({ customerId: 'c4', customerName: 'Dina', mohalla: 'Shahdara', billMonth: '2026-13', amount: 150000 }),
  ];
  const view = buildReceivablesAgeing(entries, AS_OF);
  const csv = ageingCsv(view, entries);
  const lines = csv.split('\n');
  const blank = lines.indexOf('');
  const rowLines = lines.slice(1, blank);
  const totalLines = lines.slice(blank + 2);
  assert.match(csv, /Unaged,Chand,Shahdara,unknown,2500\.00/);
  assert.match(csv, /Unaged,Dina,Shahdara,2026-13,1500\.00/);
  // Fixture names carry no commas/quotes, so a plain split is exact.
  const rowSum = rowLines.reduce((sum, line) => sum + Number(line.split(',').at(-1)), 0);
  const totalsSum = totalLines.reduce((sum, line) => sum + Number(line.split(',')[1]), 0);
  assert.equal(rowSum, 12000);
  assert.equal(totalsSum, 12000);
  assert.equal(view.totalOutstanding, 1200000);
  assert.equal(Math.round(rowSum * 100), view.totalOutstanding);
});

test('CSV with an all-unaged roster has only Unaged rows (Sharafat 15)', () => {
  const entries = [
    entry({ billMonth: 'unknown', amount: 500000 }),
    entry({ customerId: 'c2', customerName: 'Bilal', mohalla: 'Shahdara', billMonth: '', amount: 250000 }),
  ];
  const view = buildReceivablesAgeing(entries, AS_OF);
  const csv = ageingCsv(view, entries);
  const lines = csv.split('\n');
  const blank = lines.indexOf('');
  const rowLines = lines.slice(1, blank);
  assert.equal(rowLines.length, 2);
  assert.match(rowLines[0], /^Unaged,Ayesha,Bani,unknown,5000\.00$/);
  assert.match(rowLines[1], /^Unaged,Bilal,Shahdara,—,2500\.00$/);
  assert.equal(view.totalOutstanding, 750000);
});

test('CSV with no unaged entries has no Unaged rows (Sharafat 15)', () => {
  const entries = [
    entry({ billMonth: '2026-11', amount: 500000 }),
    entry({ customerId: 'c2', customerName: 'Bilal', billMonth: '2026-08', amount: 400000 }),
  ];
  const view = buildReceivablesAgeing(entries, AS_OF);
  const csv = ageingCsv(view, entries);
  assert.doesNotMatch(csv, /Unaged/);
  // Aged rows are byte-identical to before this change.
  assert.match(csv, /Current,Ayesha,Bani,2026-11,5000\.00/);
  assert.match(csv, /3\+ months,Bilal,Bani,2026-08,4000\.00/);
});

test('CSV escapes commas and quotes in unaged rows too (Sharafat 15)', () => {
  const entries = [entry({ customerName: 'Ayesha, "Boss"', billMonth: 'unknown', amount: 100000 })];
  const view = buildReceivablesAgeing(entries, AS_OF);
  assert.match(ageingCsv(view, entries), /Unaged,"Ayesha, ""Boss""",Bani,unknown,1000\.00/);
});

test('blank bill month prints a dash in the unaged row (Sharafat 15)', () => {
  const entries = [entry({ billMonth: '', amount: 250000 })];
  const view = buildReceivablesAgeing(entries, AS_OF);
  assert.match(ageingCsv(view, entries), /Unaged,Ayesha,Bani,—,2500\.00/);
});

test('filename carries the as-of month', () => {
  assert.equal(ageingFilename(buildReceivablesAgeing([], AS_OF)), 'receivables-ageing-2026-11.csv');
});
