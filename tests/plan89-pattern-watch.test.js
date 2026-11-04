/**
 * plan89-pattern-watch.test.js — Plan 89: void and correction pattern
 * watch (review list, not a block).
 * Pins:
 * - counts grouped by day, by operator, and by customer match the
 *   supplied events on the same fixture;
 * - a concentration strictly above the operator-set threshold appears
 *   as a review item with its figures; a group at exactly the
 *   threshold never appears, so normal single voids and corrections
 *   never appear as patterns;
 * - invalid thresholds fall back to the defaults, never to zero;
 * - reviewing an item records who reviewed it and why without
 *   altering any underlying record, and restoring returns it;
 * - unusable events (unknown kind, impossible date, missing
 *   customer) are dropped, never counted on a guessed figure;
 * - inputs are never mutated; the module imports nothing and names
 *   no payment, bill, or audit store.
 * Synthetic data only; the view accuses nobody, blocks nothing, and
 * changes no void, correction, or payment record.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PATTERN_DEFAULTS,
  validPatternDate,
  patternMohallaKey,
  normalizePatternEvents,
  groupPatternCounts,
  normalizePatternSettings,
  buildReviewItems,
  filterReviewItems,
  buildPatternSummary,
  patternSummaryText,
  normalizeReviewList,
  markReviewed,
  removeReviewed,
  reviewHtml,
  reviewedHtml,
  patternCsv,
  patternFilename,
} from '../pattern-watch.js';

const events = [
  { date: '2026-01-05', kind: 'void', customerId: 'c1', customerName: 'Ayesha', mohalla: 'Bani', by: 'Owner' },
  { date: '2026-01-05', kind: 'void', customerId: 'c2', customerName: 'Bilal', mohalla: 'Bani', by: 'Owner' },
  { date: '2026-01-05', kind: 'correction', customerId: 'c1', customerName: 'Ayesha', mohalla: 'Bani', by: 'Owner' },
  { date: '2026-01-06', kind: 'void', customerId: 'c1', customerName: 'Ayesha', mohalla: 'Bani', by: 'Collector' },
  { date: '2026-01-06', kind: 'correction', customerId: 'c3', customerName: 'Chanda', mohalla: '', by: 'Collector' },
];

test('strict dates: 2026-02-30 and malformed dates are invalid, real dates pass', () => {
  assert.equal(validPatternDate('2026-02-30'), false);
  assert.equal(validPatternDate('2026-13-01'), false);
  assert.equal(validPatternDate('2026-02-29'), false);
  assert.equal(validPatternDate('2024-02-29'), true);
  assert.equal(validPatternDate('2026-01-05'), true);
});

test('mohalla keys: prefix stripped and lowercased, blank stays unassigned', () => {
  assert.equal(patternMohallaKey('Mohalla Bani'), 'bani');
  assert.equal(patternMohallaKey('bani'), 'bani');
  assert.equal(patternMohallaKey(''), '__unassigned__');
  assert.equal(patternMohallaKey('  '), '__unassigned__');
});

test('unusable events are dropped, never counted', () => {
  const rows = normalizePatternEvents([
    ...events,
    { date: '2026-02-30', kind: 'void', customerId: 'c9' },
    { date: '2026-01-07', kind: 'refund', customerId: 'c9' },
    { date: '2026-01-07', kind: 'void', customerId: '' },
    null,
    'not an event',
  ]);
  assert.equal(rows.length, events.length);
});

test('group counts match the fixture exactly, by day, operator, and customer', () => {
  const groups = groupPatternCounts(events);
  assert.deepEqual(groups.byDay.map((g) => [g.key, g.voids, g.corrections, g.total]), [
    ['2026-01-05', 2, 1, 3],
    ['2026-01-06', 1, 1, 2],
  ]);
  assert.deepEqual(groups.byOperator.map((g) => [g.key, g.voids, g.corrections, g.total]), [
    ['Owner', 2, 1, 3],
    ['Collector', 1, 1, 2],
  ]);
  assert.deepEqual(groups.byCustomer.map((g) => [g.key, g.voids, g.corrections, g.total]), [
    ['c1', 2, 1, 3],
    ['c2', 1, 0, 1],
    ['c3', 0, 1, 1],
  ]);
});

test('review items appear only strictly above the threshold', () => {
  const items = buildReviewItems({ events, settings: { dayThreshold: 2, operatorThreshold: 2, customerThreshold: 2 } });
  // All three groups total 3, so items sort by key ascending.
  assert.deepEqual(items.map((i) => i.key), ['customer:c1', 'day:2026-01-05', 'operator:Owner']);
  const day = items.find((i) => i.dimension === 'day');
  assert.equal(day.total, 3);
  assert.equal(day.voids, 2);
  assert.equal(day.corrections, 1);
  assert.equal(day.threshold, 2);
});

test('a group at exactly the threshold never appears', () => {
  const items = buildReviewItems({ events, settings: { dayThreshold: 3, operatorThreshold: 3, customerThreshold: 3 } });
  assert.equal(items.length, 0);
});

test('single voids and corrections never appear as patterns', () => {
  const items = buildReviewItems({
    events: [{ date: '2026-01-05', kind: 'void', customerId: 'c1', by: 'Owner' }],
    settings: PATTERN_DEFAULTS,
  });
  assert.equal(items.length, 0);
});

test('invalid thresholds fall back to defaults, never to zero', () => {
  const settings = normalizePatternSettings({ dayThreshold: 0, operatorThreshold: -5, customerThreshold: 'many' });
  assert.deepEqual(settings, PATTERN_DEFAULTS);
  assert.deepEqual(normalizePatternSettings(null), PATTERN_DEFAULTS);
});

test('reviewed items leave the open list and can be restored', () => {
  const items = buildReviewItems({ events, settings: PATTERN_DEFAULTS });
  const reviewed = markReviewed([], items[0], { reviewedBy: 'Owner', outcome: 'Checked, explained', reviewedAt: '2026-01-07' });
  assert.equal(reviewed.length, 1);
  assert.equal(reviewed[0].reviewedBy, 'Owner');
  assert.equal(reviewed[0].outcome, 'Checked, explained');
  const open = buildReviewItems({ events, settings: PATTERN_DEFAULTS, reviewedKeys: reviewed.map((e) => e.key) });
  assert.equal(open.some((i) => i.key === items[0].key), false);
  assert.equal(removeReviewed(reviewed, items[0].key).length, 0);
});

test('review without an outcome is refused, and reviewer defaults to Owner', () => {
  const items = buildReviewItems({ events, settings: PATTERN_DEFAULTS });
  assert.deepEqual(markReviewed([], items[0], { outcome: '   ' }), []);
  const reviewed = markReviewed([], items[0], { outcome: 'Fine' });
  assert.equal(reviewed[0].reviewedBy, 'Owner');
});

test('filters by dimension and mohalla, unassigned never dropped', () => {
  const items = buildReviewItems({ events, settings: PATTERN_DEFAULTS });
  assert.equal(filterReviewItems(items, { dimension: 'customer' }).length, 1);
  // Only the customer item carries a mohalla; day and operator items
  // sit in the unassigned group and are never dropped by the filter.
  assert.equal(filterReviewItems(items, { mohalla: 'Bani' }).length, 1);
  assert.equal(filterReviewItems(items, { mohalla: 'bani' }).length, 1);
  assert.equal(filterReviewItems(items, { mohalla: '__unassigned__' }).length, 2);
});

test('summary totals match the fixture', () => {
  const summary = buildPatternSummary(events);
  assert.deepEqual(summary, { events: 5, voids: 3, corrections: 2, dayGroups: 2, operatorGroups: 2, customerGroups: 3 });
  assert.match(patternSummaryText(summary), /5 events \(3 voids, 2 corrections\)/);
});

test('inputs are never mutated', () => {
  const snapshot = JSON.stringify(events);
  groupPatternCounts(events);
  buildReviewItems({ events, settings: PATTERN_DEFAULTS });
  assert.equal(JSON.stringify(events), snapshot);
});

test('HTML escapes names and CSV quotes fields, filename is fixed', () => {
  const items = buildReviewItems({
    events: [
      { date: '2026-01-05', kind: 'void', customerId: 'c1', customerName: '<b>Ayesha</b>', mohalla: 'Bani, West', by: 'Owner' },
      { date: '2026-01-05', kind: 'void', customerId: 'c1', customerName: 'Ayesha', mohalla: 'Bani', by: 'Owner' },
      { date: '2026-01-05', kind: 'void', customerId: 'c1', customerName: 'Ayesha', mohalla: 'Bani', by: 'Owner' },
    ],
    settings: PATTERN_DEFAULTS,
  });
  assert.equal(items.length, 3);
  const html = reviewHtml(items);
  assert.equal(html.includes('<b>Ayesha</b>'), false);
  assert.match(html, /&lt;b&gt;Ayesha&lt;\/b&gt;/);
  const csv = patternCsv(items);
  assert.match(csv, /"Bani, West"/);
  assert.equal(patternFilename(), 'pattern-watch.csv');
  const reviewed = markReviewed([], items[0], { outcome: 'Checked' });
  assert.match(reviewedHtml(reviewed), /Checked/);
  assert.equal(reviewedHtml([]), '');
});

test('purity fence: the module imports nothing and names no payment, bill, or audit store', () => {
  const source = readFileSync(new URL('../pattern-watch.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('shahdara_operator_audit_log'), false);
  assert.equal(source.includes('correctionHistory'), false);
  assert.equal(source.includes('localStorage'), false);
});
