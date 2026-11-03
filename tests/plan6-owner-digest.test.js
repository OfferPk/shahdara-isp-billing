import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DIGEST_PERIODS,
  isValidDigestDate,
  dailyDigestRange,
  weeklyDigestRange,
  buildOwnerDigest,
  digestSummary,
  digestFilename,
  digestHtml,
  digestCsv,
} from '../owner-digest.js';

const TODAY = '2026-11-03'; // a Tuesday
const WEEK_START = '2026-11-02'; // the Monday of that week
const WEEK_END = '2026-11-08'; // the Sunday of that week

const digestInput = (overrides = {}) => ({
  period: DIGEST_PERIODS.DAILY,
  startDate: TODAY,
  endDate: TODAY,
  collections: { amount: 45000, count: 12, sourceScreen: 'Analytics cash collection' },
  dues: { amount: 180000, customerCount: 34, sourceScreen: 'Analytics outstanding' },
  waadaBroken: {
    count: 2, amount: 15000, sourceScreen: 'Waada queue',
    items: [
      { customerName: 'Ayesha', promiseDate: '2026-10-28', amount: 9000 },
      { customerName: 'Bilal', promiseDate: '2026-10-30', amount: 6000 },
    ],
  },
  suspenseUnclaimed: {
    count: 1, amount: 5000, sourceScreen: 'Suspense register',
    items: [{ suspenseId: 'SUS-1', amount: 5000, ageDays: 9 }],
  },
  ...overrides,
});

// ---- date validation and ranges ----

test('valid dates pass and impossible dates fail, leap-aware', () => {
  assert.equal(isValidDigestDate('2026-11-03'), true);
  assert.equal(isValidDigestDate('2024-02-29'), true);
  assert.equal(isValidDigestDate('2026-02-29'), false);
  assert.equal(isValidDigestDate('2026-13-01'), false);
  assert.equal(isValidDigestDate('2026-11-32'), false);
  assert.equal(isValidDigestDate('03-11-2026'), false);
  assert.equal(isValidDigestDate(''), false);
  assert.equal(isValidDigestDate(null), false);
});

test('daily range is the single date itself', () => {
  assert.deepEqual(dailyDigestRange(TODAY), { valid: true, startDate: TODAY, endDate: TODAY });
  assert.deepEqual(dailyDigestRange('2026-02-30'), { valid: false, startDate: '', endDate: '' });
});

test('weekly range is Monday to Sunday containing the date', () => {
  assert.deepEqual(weeklyDigestRange(TODAY), { valid: true, startDate: WEEK_START, endDate: WEEK_END });
  // A Sunday still belongs to the week that started the previous Monday.
  assert.deepEqual(weeklyDigestRange(WEEK_END), { valid: true, startDate: WEEK_START, endDate: WEEK_END });
  // A Monday starts its own week.
  assert.deepEqual(weeklyDigestRange(WEEK_START), { valid: true, startDate: WEEK_START, endDate: WEEK_END });
});

test('weekly range crosses a month boundary correctly', () => {
  // 2026-11-01 is a Sunday; its week starts Monday 2026-10-26.
  assert.deepEqual(weeklyDigestRange('2026-11-01'), { valid: true, startDate: '2026-10-26', endDate: '2026-11-01' });
});

test('weekly range rejects an invalid date', () => {
  assert.deepEqual(weeklyDigestRange('not-a-date'), { valid: false, startDate: '', endDate: '' });
});

// ---- digest assembly: figures carried verbatim ----

test('daily digest carries every source figure verbatim with one date range', () => {
  const digest = buildOwnerDigest(digestInput());
  assert.equal(digest.valid, true);
  assert.equal(digest.period, 'daily');
  assert.equal(digest.periodLabel, 'Daily digest');
  assert.equal(digest.startDate, TODAY);
  assert.equal(digest.endDate, TODAY);
  assert.equal(digest.dateRangeLabel, TODAY);
  assert.deepEqual(digest.collections, { amount: 45000, count: 12, sourceScreen: 'Analytics cash collection' });
  assert.deepEqual(digest.dues, { amount: 180000, customerCount: 34, sourceScreen: 'Analytics outstanding' });
  assert.equal(digest.waadaBroken.count, 2);
  assert.equal(digest.waadaBroken.amount, 15000);
  assert.equal(digest.suspenseUnclaimed.count, 1);
  assert.equal(digest.suspenseUnclaimed.amount, 5000);
});

test('weekly digest carries the week range and the same figure shape', () => {
  const digest = buildOwnerDigest(digestInput({
    period: DIGEST_PERIODS.WEEKLY, startDate: WEEK_START, endDate: WEEK_END,
  }));
  assert.equal(digest.valid, true);
  assert.equal(digest.periodLabel, 'Weekly digest');
  assert.equal(digest.dateRangeLabel, `${WEEK_START} to ${WEEK_END}`);
  assert.equal(digest.collections.amount, 45000);
});

test('every figure traces to its source screen in the sources list', () => {
  const digest = buildOwnerDigest(digestInput());
  assert.deepEqual(digest.sources, [
    'Analytics cash collection', 'Analytics outstanding', 'Waada queue', 'Suspense register',
  ]);
});

test('duplicate source screens appear only once in the sources list', () => {
  const digest = buildOwnerDigest(digestInput({
    collections: { amount: 100, count: 1, sourceScreen: 'Analytics' },
    dues: { amount: 200, customerCount: 2, sourceScreen: 'Analytics' },
    waadaBroken: { count: 0, amount: 0, items: [], sourceScreen: 'Analytics' },
    suspenseUnclaimed: { count: 0, amount: 0, items: [], sourceScreen: 'Analytics' },
  }));
  assert.deepEqual(digest.sources, ['Analytics']);
});

test('missing source screens fall back to their home-screen defaults', () => {
  const digest = buildOwnerDigest(digestInput({
    collections: { amount: 100, count: 1 },
    dues: { amount: 200, customerCount: 2 },
    waadaBroken: { count: 0, amount: 0, items: [] },
    suspenseUnclaimed: { count: 0, amount: 0, items: [] },
  }));
  assert.equal(digest.collections.sourceScreen, 'Analytics');
  assert.equal(digest.dues.sourceScreen, 'Analytics');
  assert.equal(digest.waadaBroken.sourceScreen, 'Waada queue');
  assert.equal(digest.suspenseUnclaimed.sourceScreen, 'Suspense register');
});

// ---- invalid digests ----

test('unknown period is invalid', () => {
  assert.equal(buildOwnerDigest(digestInput({ period: 'monthly' })).valid, false);
  assert.equal(buildOwnerDigest(digestInput({ period: '' })).valid, false);
});

test('invalid dates and a reversed range are invalid', () => {
  assert.equal(buildOwnerDigest(digestInput({ startDate: '2026-02-30' })).valid, false);
  assert.equal(buildOwnerDigest(digestInput({ startDate: WEEK_END, endDate: WEEK_START })).valid, false);
});

test('a daily digest spanning more than one day is invalid', () => {
  assert.equal(buildOwnerDigest(digestInput({ startDate: WEEK_START, endDate: WEEK_END })).valid, false);
});

test('an invalid digest has an empty summary', () => {
  assert.equal(digestSummary(buildOwnerDigest(digestInput({ period: 'monthly' }))), '');
});

// ---- normalisation and consistency ----

test('non-finite amounts become 0 and negative counts become 0, never NaN', () => {
  const digest = buildOwnerDigest(digestInput({
    collections: { amount: NaN, count: -3, sourceScreen: 'Analytics' },
    dues: { amount: 'abc', customerCount: -1, sourceScreen: 'Analytics' },
    waadaBroken: { count: 0, amount: 0, items: [], sourceScreen: 'Waada queue' },
    suspenseUnclaimed: { count: 0, amount: 0, items: [], sourceScreen: 'Suspense register' },
  }));
  assert.equal(digest.valid, true);
  assert.equal(digest.collections.amount, 0);
  assert.equal(digest.collections.count, 0);
  assert.equal(digest.dues.amount, 0);
  assert.equal(digest.dues.customerCount, 0);
});

test('amounts are rounded to whole rupees', () => {
  const digest = buildOwnerDigest(digestInput({
    collections: { amount: 45000.6, count: 1, sourceScreen: 'Analytics' },
  }));
  assert.equal(digest.collections.amount, 45001);
});

test('matching Waada items are consistent and their sum is exposed', () => {
  const digest = buildOwnerDigest(digestInput());
  assert.equal(digest.waadaBroken.consistent, true);
  assert.equal(digest.waadaBroken.itemsTotal, 15000);
  assert.equal(digest.suspenseUnclaimed.consistent, true);
  assert.equal(digest.suspenseUnclaimed.itemsTotal, 5000);
});

test('mismatching Waada items are reported, never silently fixed', () => {
  const digest = buildOwnerDigest(digestInput({
    waadaBroken: {
      count: 2, amount: 20000, sourceScreen: 'Waada queue',
      items: [{ customerName: 'Ayesha', promiseDate: '2026-10-28', amount: 9000 }],
    },
  }));
  assert.equal(digest.waadaBroken.consistent, false);
  assert.equal(digest.waadaBroken.amount, 20000);
  assert.equal(digest.waadaBroken.itemsTotal, 9000);
});

test('mismatching suspense items are reported the same way', () => {
  const digest = buildOwnerDigest(digestInput({
    suspenseUnclaimed: {
      count: 2, amount: 8000, sourceScreen: 'Suspense register',
      items: [{ suspenseId: 'SUS-1', amount: 5000 }],
    },
  }));
  assert.equal(digest.suspenseUnclaimed.consistent, false);
  assert.equal(digest.suspenseUnclaimed.itemsTotal, 5000);
});

test('no item list means nothing to check against, so consistent is true', () => {
  const digest = buildOwnerDigest(digestInput({
    waadaBroken: { count: 3, amount: 21000, sourceScreen: 'Waada queue' },
    suspenseUnclaimed: { count: 2, amount: 7000, sourceScreen: 'Suspense register' },
  }));
  assert.equal(digest.waadaBroken.consistent, true);
  assert.equal(digest.suspenseUnclaimed.consistent, true);
  assert.deepEqual(digest.waadaBroken.items, []);
});

test('building a digest never mutates its input', () => {
  const input = digestInput();
  const before = JSON.stringify(input);
  buildOwnerDigest(input);
  assert.equal(JSON.stringify(input), before);
});

test('an empty digest still assembles with zero figures', () => {
  const digest = buildOwnerDigest(digestInput({
    collections: { amount: 0, count: 0, sourceScreen: 'Analytics' },
    dues: { amount: 0, customerCount: 0, sourceScreen: 'Analytics' },
    waadaBroken: { count: 0, amount: 0, items: [], sourceScreen: 'Waada queue' },
    suspenseUnclaimed: { count: 0, amount: 0, items: [], sourceScreen: 'Suspense register' },
  }));
  assert.equal(digest.valid, true);
  assert.equal(digest.collections.amount, 0);
  assert.equal(digest.waadaBroken.count, 0);
});

// ---- summary, filename, HTML, CSV ----

test('summary states period, range, and every headline figure', () => {
  const digest = buildOwnerDigest(digestInput());
  assert.equal(
    digestSummary(digest),
    'Daily digest 2026-11-03: collected Rs. 45,000 (12 payments) · dues Rs. 180,000 · Waada broken 2 · suspense unclaimed Rs. 5,000 (1 items).',
  );
  assert.equal(digest.summary, digestSummary(digest));
});

test('filenames encode period and start date', () => {
  assert.equal(digestFilename(buildOwnerDigest(digestInput())), 'owner-digest-daily-2026-11-03.csv');
  assert.equal(
    digestFilename(buildOwnerDigest(digestInput({ period: 'weekly', startDate: WEEK_START, endDate: WEEK_END }))),
    'owner-digest-weekly-2026-11-02.csv',
  );
  assert.equal(digestFilename(buildOwnerDigest(digestInput({ period: 'monthly' }))), 'owner-digest.csv');
});

test('HTML carries the range, formatted figures, and source labels', () => {
  const html = digestHtml(buildOwnerDigest(digestInput()));
  assert.match(html, /Daily digest · 2026-11-03/);
  assert.match(html, /Rs\. 45,000/);
  assert.match(html, /Rs\. 180,000/);
  assert.match(html, /Source: Analytics cash collection/);
  assert.match(html, /Source: Waada queue/);
  assert.match(html, /Ayesha/);
  assert.match(html, /SUS-1/);
});

test('HTML escapes customer names instead of injecting markup', () => {
  const digest = buildOwnerDigest(digestInput({
    waadaBroken: {
      count: 1, amount: 100, sourceScreen: 'Waada queue',
      items: [{ customerName: '<script>alert(1)</script>', promiseDate: '2026-10-28', amount: 100 }],
    },
  }));
  const html = digestHtml(digest);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test('HTML flags an inconsistent list instead of hiding it', () => {
  const digest = buildOwnerDigest(digestInput({
    waadaBroken: {
      count: 1, amount: 20000, sourceScreen: 'Waada queue',
      items: [{ customerName: 'Ayesha', promiseDate: '2026-10-28', amount: 9000 }],
    },
  }));
  assert.match(digestHtml(digest), /listed items do not sum to the stated total/);
});

test('HTML caps long item lists at 10 with a more-items note', () => {
  const items = Array.from({ length: 12 }, (_, i) => ({ customerName: `Customer ${i}`, promiseDate: '2026-10-28', amount: 100 }));
  const digest = buildOwnerDigest(digestInput({
    waadaBroken: { count: 12, amount: 1200, sourceScreen: 'Waada queue', items },
  }));
  const html = digestHtml(digest);
  assert.match(html, /Customer 9/);
  assert.doesNotMatch(html, /Customer 10/);
  assert.match(html, /Plus 2 more item/);
});

test('HTML of an invalid digest is empty', () => {
  assert.equal(digestHtml(buildOwnerDigest(digestInput({ period: 'monthly' }))), '');
});

test('CSV carries headlines, item rows, and source labels', () => {
  const csv = digestCsv(buildOwnerDigest(digestInput()));
  assert.match(csv, /^Owner digest,Daily digest,2026-11-03$/m);
  assert.match(csv, /^Collections,Amount,45000,Analytics cash collection$/m);
  assert.match(csv, /^Dues,Outstanding amount,180000,Analytics outstanding$/m);
  assert.match(csv, /^Waada broken item,Ayesha,9000,promised 2026-10-28$/m);
  assert.match(csv, /^Suspense unclaimed item,SUS-1,5000,age 9 days$/m);
});

test('CSV escapes commas and quotes in names', () => {
  const digest = buildOwnerDigest(digestInput({
    waadaBroken: {
      count: 1, amount: 100, sourceScreen: 'Waada queue',
      items: [{ customerName: 'Ayesha, "Boss"', promiseDate: '2026-10-28', amount: 100 }],
    },
  }));
  assert.match(digestCsv(digest), /"Ayesha, ""Boss"""/);
});

test('CSV of an invalid digest is empty', () => {
  assert.equal(digestCsv(buildOwnerDigest(digestInput({ period: 'monthly' }))), '');
});
