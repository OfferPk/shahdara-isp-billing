import test from 'node:test';
import assert from 'node:assert/strict';

import {
  UNASSIGNED_COLLECTOR,
  normalizeCollectorName,
  normalizePerformanceOutcome,
  classifyPromise,
  buildCollectorPerformance,
  collectorPerformanceSummaryText,
  collectorPerformanceHtml,
  collectorPerformanceCsv,
  collectorPerformanceFilename,
} from '../collector-performance.js';

const TODAY = '2026-11-03';

const view = (overrides = {}) => buildCollectorPerformance({
  today: TODAY,
  plannedVisits: [],
  visits: [],
  payments: [],
  promises: [],
  ...overrides,
});

// ---- collector normalisation ----

test('collector names: trimmed, collapsed, blank becomes Unassigned', () => {
  assert.equal(normalizeCollectorName('  Saad  Khan '), 'Saad Khan');
  assert.equal(normalizeCollectorName(''), UNASSIGNED_COLLECTOR);
  assert.equal(normalizeCollectorName(null), UNASSIGNED_COLLECTOR);
  assert.equal(normalizeCollectorName('   '), UNASSIGNED_COLLECTOR);
});

test('collector grouping: case-insensitive, first-seen spelling kept', () => {
  const result = view({
    payments: [
      { collector: 'Saad', amount: 1000 },
      { collector: 'SAAD', amount: 500 },
      { collector: 'saad', amount: 250 },
    ],
  });
  assert.equal(result.collectors.length, 1);
  assert.equal(result.collectors[0].collector, 'Saad');
  assert.equal(result.collectors[0].cashCollected, 1750);
  assert.equal(result.collectors[0].paymentCount, 3);
});

test('records with no collector land in Unassigned, never dropped', () => {
  const result = view({
    visits: [{ customerId: 'c1', outcome: 'paid' }],
    payments: [{ amount: 700 }],
    promises: [{ customerId: 'c1', promisedDate: '2026-11-10' }],
  });
  assert.equal(result.collectors.length, 1);
  assert.equal(result.collectors[0].collector, UNASSIGNED_COLLECTOR);
  assert.equal(result.collectors[0].visitsDone, 1);
  assert.equal(result.collectors[0].cashCollected, 700);
  assert.equal(result.collectors[0].promisesMade, 1);
});

// ---- outcome classification ----

test('visit outcomes: paid/partial collected, missed outcomes visited, pending unknown not a visit', () => {
  assert.equal(normalizePerformanceOutcome('paid'), 'collected');
  assert.equal(normalizePerformanceOutcome('partial'), 'collected');
  assert.equal(normalizePerformanceOutcome('promised'), 'visited');
  assert.equal(normalizePerformanceOutcome('not_home'), 'visited');
  assert.equal(normalizePerformanceOutcome('dispute'), 'visited');
  assert.equal(normalizePerformanceOutcome('no_answer'), 'visited');
  assert.equal(normalizePerformanceOutcome('pending'), null);
  assert.equal(normalizePerformanceOutcome(''), null);
  assert.equal(normalizePerformanceOutcome('something-else'), null);
  assert.equal(normalizePerformanceOutcome(' PAID '), 'collected');
});

// ---- visits planned/done ----

test('visits planned/done: planned done, unplanned done, coverage from planned only', () => {
  const result = view({
    plannedVisits: [
      { collector: 'Saad', customerId: 'c1' },
      { collector: 'Saad', customerId: 'c2' },
      { collector: 'Saad', customerId: 'c3' },
    ],
    visits: [
      { collector: 'Saad', customerId: 'c1', outcome: 'paid' },
      { collector: 'Saad', customerId: 'c2', outcome: 'not_home' },
      { collector: 'Saad', customerId: 'c9', outcome: 'refused' },
    ],
  });
  const row = result.collectors[0];
  assert.equal(row.visitsPlanned, 3);
  assert.equal(row.visitsDone, 3);
  assert.equal(row.plannedVisitsDone, 2);
  assert.equal(row.unplannedVisitsDone, 1);
  assert.equal(row.visitCoverageRate, 67);
});

test('repeat visits to one customer count once in visitsDone', () => {
  const result = view({
    plannedVisits: [{ collector: 'Saad', customerId: 'c1' }],
    visits: [
      { collector: 'Saad', customerId: 'c1', outcome: 'not_home', attempt: 1 },
      { collector: 'Saad', customerId: 'c1', outcome: 'paid', attempt: 2 },
    ],
  });
  const row = result.collectors[0];
  assert.equal(row.visitsDone, 1);
  assert.equal(row.plannedVisitsDone, 1);
});

test('duplicate planned stops count once', () => {
  const result = view({
    plannedVisits: [
      { collector: 'Saad', customerId: 'c1' },
      { collector: 'Saad', customerId: 'c1' },
    ],
  });
  assert.equal(result.collectors[0].visitsPlanned, 1);
});

test('pending and unrecognised outcomes are not visits done', () => {
  const result = view({
    plannedVisits: [{ collector: 'Saad', customerId: 'c1' }],
    visits: [
      { collector: 'Saad', customerId: 'c1', outcome: 'pending' },
      { collector: 'Saad', customerId: 'c2', outcome: 'mystery' },
    ],
  });
  assert.equal(result.collectors[0].visitsDone, 0);
  assert.equal(result.collectors[0].visitCoverageRate, 0);
});

test('coverage rate is null when nothing was planned', () => {
  const result = view({
    visits: [{ collector: 'Saad', customerId: 'c1', outcome: 'paid' }],
  });
  assert.equal(result.collectors[0].visitCoverageRate, null);
});

// ---- first-attempt collections ----

test('first-attempt: attempt 1 paid counts, attempt 2 paid does not', () => {
  const result = view({
    visits: [
      { collector: 'Saad', customerId: 'c1', outcome: 'paid', attempt: 1 },
      { collector: 'Saad', customerId: 'c2', outcome: 'not_home', attempt: 1 },
      { collector: 'Saad', customerId: 'c2', outcome: 'paid', attempt: 2 },
    ],
  });
  const row = result.collectors[0];
  assert.equal(row.firstAttemptCollections, 1);
  assert.equal(row.firstAttemptRate, 50);
});

test('first-attempt: missing attempt counts as the first attempt', () => {
  const result = view({
    visits: [{ collector: 'Saad', customerId: 'c1', outcome: 'partial' }],
  });
  assert.equal(result.collectors[0].firstAttemptCollections, 1);
  assert.equal(result.collectors[0].firstAttemptRate, 100);
});

test('first-attempt: partial counts as a collection visit, not as cash by itself', () => {
  const result = view({
    visits: [{ collector: 'Saad', customerId: 'c1', outcome: 'partial', attempt: 1 }],
    payments: [],
  });
  assert.equal(result.collectors[0].firstAttemptCollections, 1);
  assert.equal(result.collectors[0].cashCollected, 0);
});

test('first-attempt rate is null when no visits were done', () => {
  const result = view({ payments: [{ collector: 'Saad', amount: 100 }] });
  assert.equal(result.collectors[0].firstAttemptRate, null);
});

// ---- promises ----

test('promises kept: fulfilled status, fulfilledAt, and fulfilledPaymentId all count', () => {
  assert.equal(classifyPromise({ status: 'fulfilled', promisedDate: '2026-10-01' }, TODAY), 'kept');
  assert.equal(classifyPromise({ status: 'kept', promisedDate: '2026-10-01' }, TODAY), 'kept');
  assert.equal(classifyPromise({ status: 'pending', fulfilledAt: '2026-11-02', promisedDate: '2026-10-01' }, TODAY), 'kept');
  assert.equal(classifyPromise({ status: 'pending', fulfilledPaymentId: 'p1', promisedDate: '2026-10-01' }, TODAY), 'kept');
});

test('promises broken: explicit broken, and pending past its promise date', () => {
  assert.equal(classifyPromise({ status: 'broken', promisedDate: '2026-12-01' }, TODAY), 'broken');
  assert.equal(classifyPromise({ status: 'pending', promisedDate: '2026-11-02' }, TODAY), 'broken');
  assert.equal(classifyPromise({ status: 'pending', promiseDate: '2026-10-27' }, TODAY), 'broken');
});

test('promises open: future, today, and dateless pending promises stay open', () => {
  assert.equal(classifyPromise({ status: 'pending', promisedDate: '2026-11-10' }, TODAY), 'open');
  assert.equal(classifyPromise({ status: 'pending', promisedDate: TODAY }, TODAY), 'open');
  assert.equal(classifyPromise({ status: 'pending' }, TODAY), 'open');
  assert.equal(classifyPromise({ status: 'pending', promisedDate: 'not-a-date' }, TODAY), 'open');
});

test('promises made/kept/broken/open counts and kept rate', () => {
  const result = view({
    promises: [
      { collector: 'Saad', customerId: 'c1', promisedDate: '2026-10-20', status: 'fulfilled' },
      { collector: 'Saad', customerId: 'c2', promisedDate: '2026-10-20', status: 'pending' },
      { collector: 'Saad', customerId: 'c3', promisedDate: '2026-11-10', status: 'pending' },
      { collector: 'Saad', customerId: 'c4', promisedDate: '2026-11-02', status: 'broken' },
    ],
  });
  const row = result.collectors[0];
  assert.equal(row.promisesMade, 4);
  assert.equal(row.promisesKept, 1);
  assert.equal(row.promisesBroken, 2);
  assert.equal(row.promisesOpen, 1);
  assert.equal(row.promiseKeptRate, 25);
});

test('kept rate is null when no promises were made', () => {
  const result = view({ visits: [{ collector: 'Saad', customerId: 'c1', outcome: 'paid' }] });
  assert.equal(result.collectors[0].promiseKeptRate, null);
});

test('invalid today: view invalid, date-based broken falls back to open', () => {
  const result = buildCollectorPerformance({
    today: 'not-a-date',
    promises: [{ collector: 'Saad', customerId: 'c1', promisedDate: '2026-10-01', status: 'pending' }],
  });
  assert.equal(result.valid, false);
  assert.equal(result.collectors[0].promisesBroken, 0);
  assert.equal(result.collectors[0].promisesOpen, 1);
  assert.equal(collectorPerformanceSummaryText(result), 'Collector performance unavailable — the view needs a valid today date.');
  assert.equal(collectorPerformanceHtml(result), '');
  assert.equal(collectorPerformanceCsv(result), '');
});

// ---- cash ----

test('cash: verbatim sum, voided payments skipped, invalid amounts count as zero', () => {
  const result = view({
    payments: [
      { collector: 'Saad', amount: 1500 },
      { collector: 'Saad', amount: '2500' },
      { collector: 'Saad', amount: 9000, voided: true },
      { collector: 'Saad', amount: 'not-a-number' },
      { collector: 'Saad', amount: -500 },
    ],
  });
  const row = result.collectors[0];
  assert.equal(row.cashCollected, 4000);
  assert.equal(row.paymentCount, 4);
});

// ---- multi-collector, totals, non-mutation ----

test('multi-collector: sorted by cash desc then name, totals sum exactly', () => {
  const result = view({
    plannedVisits: [
      { collector: 'Saad', customerId: 'c1' },
      { collector: 'Ayesha', customerId: 'c2' },
    ],
    visits: [
      { collector: 'Saad', customerId: 'c1', outcome: 'paid', attempt: 1 },
      { collector: 'Ayesha', customerId: 'c2', outcome: 'not_home', attempt: 1 },
    ],
    payments: [
      { collector: 'Saad', amount: 1000 },
      { collector: 'Ayesha', amount: 5000 },
    ],
    promises: [
      { collector: 'Saad', customerId: 'c1', promisedDate: '2026-10-01', status: 'fulfilled' },
      { collector: 'Ayesha', customerId: 'c2', promisedDate: '2026-10-01', status: 'pending' },
    ],
  });
  assert.deepEqual(result.collectors.map((row) => row.collector), ['Ayesha', 'Saad']);
  assert.equal(result.totals.visitsPlanned, 2);
  assert.equal(result.totals.visitsDone, 2);
  assert.equal(result.totals.firstAttemptCollections, 1);
  assert.equal(result.totals.promisesMade, 2);
  assert.equal(result.totals.promisesKept, 1);
  assert.equal(result.totals.promisesBroken, 1);
  assert.equal(result.totals.cashCollected, 6000);
  assert.equal(result.totals.paymentCount, 2);
  assert.equal(result.totals.visitCoverageRate, 100);
  assert.equal(result.totals.firstAttemptRate, 50);
  assert.equal(result.totals.promiseKeptRate, 50);
});

test('empty input: valid view, no collectors, zero totals', () => {
  const result = view({});
  assert.equal(result.valid, true);
  assert.deepEqual(result.collectors, []);
  assert.equal(result.totals.visitsPlanned, 0);
  assert.equal(result.totals.cashCollected, 0);
  assert.equal(result.totals.visitCoverageRate, null);
});

test('inputs are not mutated', () => {
  const planned = [{ collector: 'Saad', customerId: 'c1' }];
  const visits = [{ collector: 'Saad', customerId: 'c1', outcome: 'paid', attempt: 1 }];
  const payments = [{ collector: 'Saad', amount: 1000 }];
  const promises = [{ collector: 'Saad', customerId: 'c1', promisedDate: '2026-10-01', status: 'pending' }];
  const snapshot = JSON.stringify({ planned, visits, payments, promises });
  buildCollectorPerformance({ today: TODAY, plannedVisits: planned, visits, payments, promises });
  assert.equal(JSON.stringify({ planned, visits, payments, promises }), snapshot);
});

// ---- summary, HTML, CSV ----

test('summary text: single collector wording and figures', () => {
  const result = view({
    plannedVisits: [{ collector: 'Saad', customerId: 'c1' }],
    visits: [{ collector: 'Saad', customerId: 'c1', outcome: 'paid', attempt: 1 }],
    payments: [{ collector: 'Saad', amount: 1200 }],
    promises: [{ collector: 'Saad', customerId: 'c1', promisedDate: '2026-10-01', status: 'fulfilled' }],
  });
  assert.equal(
    collectorPerformanceSummaryText(result),
    '1 collector · 1 of 1 planned visits done (100% coverage) · 1 first-attempt collections (100%) · 1 of 1 promises kept (100%) · Rs. 1200 collected.',
  );
});

test('HTML: escaped collector name, totals row, no commission figure', () => {
  const result = view({
    payments: [{ collector: '<b>Saad</b>', amount: 1000 }],
  });
  const html = collectorPerformanceHtml(result);
  assert.ok(html.includes('&lt;b&gt;Saad&lt;/b&gt;'));
  assert.ok(!html.includes('<b>Saad</b>'));
  assert.ok(html.includes('Total'));
  assert.ok(html.includes('commission rules are untouched'));
});

test('CSV: header, collector row, totals row, filename', () => {
  const result = view({
    plannedVisits: [{ collector: 'Saad', customerId: 'c1' }],
    visits: [{ collector: 'Saad', customerId: 'c1', outcome: 'paid', attempt: 1 }],
    payments: [{ collector: 'Saad', amount: 1000 }],
  });
  const csv = collectorPerformanceCsv(result);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'Collector,Planned,Done,Planned done,Unplanned done,Coverage %,First-attempt collections,First-attempt %,Promises made,Kept,Broken,Open,Kept %,Cash collected,Payments');
  assert.ok(lines[1].startsWith('Saad,1,1,1,0,100,1,100,0,0,0,0,,1000,1'));
  assert.ok(lines[2].startsWith('Total,1,1,1,0,100,1,100,0,0,0,0,,1000,1'));
  assert.equal(collectorPerformanceFilename(result), 'collector-performance-2026-11-03.csv');
});

test('CSV: collector name with a comma is quoted', () => {
  const result = view({
    payments: [{ collector: 'Saad, Jr', amount: 100 }],
  });
  assert.ok(collectorPerformanceCsv(result).includes('"Saad, Jr"'));
});
