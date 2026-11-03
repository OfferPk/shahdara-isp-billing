import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DAY_TARGET_STORAGE_KEY,
  normalizeDayTargetAmount,
  getDayTarget,
  setDayTarget,
  clearDayTarget,
  buildDayTargetProgress,
  dayTargetSummary,
  dayTargetHtml,
} from '../day-target.js';

import {
  buildRouteDayTarget,
} from '../nav-collection-rounds.js';

const TODAY = '2026-11-03';

const mockStorage = () => ({
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
});

const routeData = (overrides = {}) => ({
  date: TODAY,
  totalStops: 10,
  collectedStops: 4,
  pendingStops: 6,
  totalDue: 50000,
  collectedAmount: 20000,
  pendingAmount: 30000,
  completionRate: 40,
  ...overrides,
});

// ---- operator target normalisation ----

test('normalize keeps a positive target rounded to whole rupees', () => {
  assert.equal(normalizeDayTargetAmount(50000), 50000);
  assert.equal(normalizeDayTargetAmount(50000.6), 50001);
  assert.equal(normalizeDayTargetAmount('25000'), 25000);
});

test('normalize turns zero, negative, NaN and text targets into unset, never 0', () => {
  assert.equal(normalizeDayTargetAmount(0), null);
  assert.equal(normalizeDayTargetAmount(-100), null);
  assert.equal(normalizeDayTargetAmount(NaN), null);
  assert.equal(normalizeDayTargetAmount('abc'), null);
  assert.equal(normalizeDayTargetAmount(null), null);
  assert.equal(normalizeDayTargetAmount(undefined), null);
});

// ---- date-indexed storage ----

test('stored target is date-indexed and clearing returns to unset', () => {
  const store = mockStorage();
  assert.equal(getDayTarget(store, TODAY).amount, null);
  setDayTarget(store, TODAY, 40000);
  assert.equal(getDayTarget(store, TODAY).amount, 40000);
  assert.equal(getDayTarget(store, '2026-11-04').amount, null);
  clearDayTarget(store, TODAY);
  assert.equal(getDayTarget(store, TODAY).amount, null);
});

test('stored target survives under the day-target key and corrupt data reads as unset', () => {
  const store = mockStorage();
  setDayTarget(store, TODAY, 40000);
  assert.equal(store.store[DAY_TARGET_STORAGE_KEY], JSON.stringify({ date: TODAY, amount: 40000 }));
  store.store[DAY_TARGET_STORAGE_KEY] = 'not-json{';
  assert.equal(getDayTarget(store, TODAY).amount, null);
  assert.equal(getDayTarget(null, TODAY).amount, null);
});

// ---- route-verbatim visit counts ----

test('visit counts are carried verbatim from the route builder', () => {
  const p = buildDayTargetProgress({ routeData: routeData() });
  assert.equal(p.visitsPlanned, 10);
  assert.equal(p.visitsDone, 4);
  assert.equal(p.visitsRemaining, 6);
  assert.equal(p.visitCompletionRate, 40);
  assert.equal(p.visitsConsistent, true);
  assert.equal(p.pendingAmount, 30000);
  assert.equal(p.routeTotalDue, 50000);
});

test('an inconsistent route builder is flagged, not silently fixed', () => {
  const p = buildDayTargetProgress({
    routeData: routeData({ totalStops: 10, collectedStops: 4, pendingStops: 9 }),
  });
  assert.equal(p.visitsPlanned, 10);
  assert.equal(p.visitsDone, 4);
  assert.equal(p.visitsRemaining, 9);
  assert.equal(p.visitsConsistent, false);
});

test('build never mutates its route input', () => {
  const input = routeData();
  const snapshot = JSON.stringify(input);
  buildDayTargetProgress({ routeData: input, targetAmount: 30000 });
  assert.equal(JSON.stringify(input), snapshot);
});

// ---- target fallback and progress ----

test('with no operator target the route total dues are the target, marked as route-sourced', () => {
  const p = buildDayTargetProgress({ routeData: routeData() });
  assert.equal(p.targetSet, false);
  assert.equal(p.targetSource, 'route');
  assert.equal(p.targetAmount, 50000);
  assert.equal(p.remainingToTarget, 30000);
  assert.equal(p.amountProgressPct, 40);
  assert.equal(p.targetReached, false);
});

test('with an operator target, remaining and percent measure against it, not route dues', () => {
  const p = buildDayTargetProgress({ routeData: routeData(), targetAmount: 40000 });
  assert.equal(p.targetSet, true);
  assert.equal(p.targetSource, 'operator');
  assert.equal(p.targetAmount, 40000);
  assert.equal(p.remainingToTarget, 20000);
  assert.equal(p.amountProgressPct, 50);
});

test('collected past the target leaves remaining at zero, caps percent, and records the excess', () => {
  const p = buildDayTargetProgress({
    routeData: routeData({ collectedAmount: 45000 }),
    targetAmount: 40000,
  });
  assert.equal(p.remainingToTarget, 0);
  assert.equal(p.overTarget, 5000);
  assert.equal(p.amountProgressPct, 100);
  assert.equal(p.targetReached, true);
  assert.equal(p.status, 'target_reached');
  assert.equal(p.statusLabel, 'Target reached');
});

// ---- statuses ----

test('all visits done is complete even before the amount target is reached', () => {
  const p = buildDayTargetProgress({
    routeData: routeData({ totalStops: 3, collectedStops: 3, pendingStops: 0, collectedAmount: 1000 }),
    targetAmount: 50000,
  });
  assert.equal(p.status, 'complete');
  assert.equal(p.statusLabel, 'Day complete');
});

test('any visit done or any rupee collected is in progress', () => {
  assert.equal(buildDayTargetProgress({ routeData: routeData() }).status, 'in_progress');
  assert.equal(buildDayTargetProgress({
    routeData: routeData({ collectedStops: 0, pendingStops: 5, collectedAmount: 500 }),
  }).status, 'in_progress');
});

test('an empty, untouched day is not started with zero percent and no false target-reached', () => {
  const p = buildDayTargetProgress({ routeData: routeData({
    totalStops: 0, collectedStops: 0, pendingStops: 0, totalDue: 0,
    collectedAmount: 0, pendingAmount: 0, completionRate: 0,
  }) });
  assert.equal(p.status, 'not_started');
  assert.equal(p.amountProgressPct, 0);
  assert.equal(p.targetReached, false);
  assert.equal(p.targetAmount, 0);
});

// ---- cash versus route collected ----

test('cash receipts, when supplied, are the progress basis and both figures stay visible', () => {
  const p = buildDayTargetProgress({ routeData: routeData(), cashCollected: 15000, targetAmount: 40000 });
  assert.equal(p.collectedSource, 'cash');
  assert.equal(p.collectedAmount, 15000);
  assert.equal(p.cashCollected, 15000);
  assert.equal(p.routeCollectedAmount, 20000);
  assert.equal(p.remainingToTarget, 25000);
});

test('without cash receipts the route collected figure is the basis and cash stays null', () => {
  const p = buildDayTargetProgress({ routeData: routeData() });
  assert.equal(p.collectedSource, 'route');
  assert.equal(p.collectedAmount, 20000);
  assert.equal(p.cashCollected, null);
  assert.equal(p.routeCollectedAmount, 20000);
});

test('a zero cash figure is a real figure, not a missing one', () => {
  const p = buildDayTargetProgress({ routeData: routeData(), cashCollected: 0 });
  assert.equal(p.collectedSource, 'cash');
  assert.equal(p.collectedAmount, 0);
});

// ---- visit completion rounding ----

test('visit completion rate rounds like the route builder', () => {
  const p = buildDayTargetProgress({
    routeData: routeData({ totalStops: 3, collectedStops: 1, pendingStops: 2 }),
  });
  assert.equal(p.visitCompletionRate, 33);
});

// ---- summary and html ----

test('summary line carries target, collected, remaining and visits', () => {
  const summary = dayTargetSummary(buildDayTargetProgress({ routeData: routeData(), targetAmount: 40000 }));
  assert.match(summary, /Rs\. 40,000/);
  assert.match(summary, /Rs\. 20,000/);
  assert.match(summary, /4\/10/);
  assert.match(summary, /6 remaining/);
});

test('html strip carries the figures and the progress width, and escapes labels', () => {
  const p = buildDayTargetProgress({ routeData: routeData(), targetAmount: 40000 });
  const html = dayTargetHtml({ ...p, statusLabel: '<script>alert(1)</script>' });
  assert.match(html, /Rs\. 40,000/);
  assert.match(html, /Rs\. 20,000/);
  assert.match(html, /width: 50%/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test('html strip states the route-target fallback plainly when no target is set', () => {
  const html = dayTargetHtml(buildDayTargetProgress({ routeData: routeData() }));
  assert.match(html, /No operator target set/);
});

// ---- route-sheet wiring helper ----

test('buildRouteDayTarget reads the stored target for the route date', () => {
  const store = mockStorage();
  setDayTarget(store, TODAY, 30000);
  const p = buildRouteDayTarget(routeData(), store);
  assert.equal(p.targetAmount, 30000);
  assert.equal(p.targetSet, true);
  assert.equal(p.visitsDone, 4);
  assert.equal(p.remainingToTarget, 10000);
});

test('buildRouteDayTarget falls back to route dues when no target is stored for that date', () => {
  const store = mockStorage();
  setDayTarget(store, '2026-11-04', 30000);
  const p = buildRouteDayTarget(routeData(), store);
  assert.equal(p.targetAmount, 50000);
  assert.equal(p.targetSet, false);
});
