import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROUTE_SEQUENCE_SORT_ID,
  routeMohallaKey,
  routeMohallaLabel,
  isRouteStopCollected,
  isWaadaBroken,
  sequenceRouteStops,
  restoreRouteOrder,
} from '../route-sequencing.js';

const TODAY = '2026-11-03';

const stop = (overrides = {}) => ({
  id: 'c1',
  name: 'Customer',
  mohalla: '',
  area: '',
  totalDue: 0,
  earliestUnpaidMonth: '',
  outcome: 'pending',
  isCollected: false,
  ...overrides,
});

// ---- mohalla grouping key (Plan T rule, mirrored) ----

test('mohalla key collapses case, spacing and the generic Mohalla prefix', () => {
  assert.equal(routeMohallaKey(stop({ mohalla: 'MOHALLA BANI' })), routeMohallaKey(stop({ mohalla: 'Bani' })));
  assert.equal(routeMohallaKey(stop({ mohalla: 'Bani' })), routeMohallaKey(stop({ mohalla: 'BANII' })));
  assert.equal(routeMohallaKey(stop({ mohalla: '  kishti ' })), routeMohallaKey(stop({ mohalla: 'KISHTII' })));
});

test('mohalla key prefers mohalla over area and never drops a blank stop', () => {
  assert.equal(routeMohallaKey(stop({ mohalla: 'Bani', area: 'Gangall' })), routeMohallaKey(stop({ mohalla: 'Bani' })));
  assert.equal(routeMohallaKey(stop({ mohalla: '', area: 'Gangall' })), routeMohallaKey(stop({ mohalla: 'Gangall' })));
  assert.equal(routeMohallaKey(stop({})), 'unassigned');
  assert.equal(routeMohallaLabel(stop({})), 'Unassigned');
});

test('different mohallas get different keys', () => {
  assert.notEqual(routeMohallaKey(stop({ mohalla: 'Bani' })), routeMohallaKey(stop({ mohalla: 'Gangall' })));
});

// ---- Waada-broken detection ----

test('a promise dated before the route date is broken', () => {
  assert.equal(isWaadaBroken(stop({ promiseDate: '2026-11-02' }), TODAY), true);
});

test('a promise dated today or in the future is not broken', () => {
  assert.equal(isWaadaBroken(stop({ promiseDate: '2026-11-03' }), TODAY), false);
  assert.equal(isWaadaBroken(stop({ promiseDate: '2026-11-10' }), TODAY), false);
});

test('a collected stop is never broken even with a past promise date', () => {
  assert.equal(isWaadaBroken(stop({ promiseDate: '2026-10-01', isCollected: true }), TODAY), false);
  assert.equal(isWaadaBroken(stop({ promiseDate: '2026-10-01', outcome: 'paid' }), TODAY), false);
});

test('an explicit broken flag or status counts, a missing date does not', () => {
  assert.equal(isWaadaBroken(stop({ waadaBroken: true }), TODAY), true);
  assert.equal(isWaadaBroken(stop({ promiseStatus: 'broken' }), TODAY), true);
  assert.equal(isWaadaBroken(stop({}), TODAY), false);
  assert.equal(isWaadaBroken(stop({ promiseDate: 'not-a-date' }), TODAY), false);
});

test('collected definition matches the route builder: paid and partial count', () => {
  assert.equal(isRouteStopCollected(stop({ outcome: 'paid' })), true);
  assert.equal(isRouteStopCollected(stop({ outcome: 'partial' })), true);
  assert.equal(isRouteStopCollected(stop({ outcome: 'pending' })), false);
  assert.equal(isRouteStopCollected(stop({ isCollected: true })), true);
});

// ---- sequencing order ----

test('stops group by mohalla, heaviest pending mohalla first', () => {
  const { stops, groups } = sequenceRouteStops([
    stop({ id: 'a', mohalla: 'Gangall', totalDue: 100 }),
    stop({ id: 'b', mohalla: 'Bani', totalDue: 900 }),
    stop({ id: 'c', mohalla: 'Gangall', totalDue: 200 }),
  ], { todayStr: TODAY });
  assert.deepEqual(groups.map((g) => g.label), ['Banii', 'Gangall']);
  assert.deepEqual(stops.map((s) => s.id), ['b', 'c', 'a']);
});

test('group ties break by mohalla label A-Z', () => {
  const { stops } = sequenceRouteStops([
    stop({ id: 'a', mohalla: 'Gangall', totalDue: 100 }),
    stop({ id: 'b', mohalla: 'Bani', totalDue: 100 }),
  ], { todayStr: TODAY });
  assert.deepEqual(stops.map((s) => s.id), ['b', 'a']);
});

test('Waada-broken stops surface first inside their mohalla', () => {
  const { stops } = sequenceRouteStops([
    stop({ id: 'rich', mohalla: 'Bani', totalDue: 5000 }),
    stop({ id: 'broken', mohalla: 'Bani', totalDue: 100, promiseDate: '2026-10-01' }),
    stop({ id: 'future', mohalla: 'Bani', totalDue: 4000, promiseDate: '2026-11-20' }),
  ], { todayStr: TODAY });
  assert.deepEqual(stops.map((s) => s.id), ['broken', 'rich', 'future']);
});

test('inside a mohalla, largest due comes before smaller due', () => {
  const { stops } = sequenceRouteStops([
    stop({ id: 'small', mohalla: 'Bani', totalDue: 100 }),
    stop({ id: 'big', mohalla: 'Bani', totalDue: 900 }),
  ], { todayStr: TODAY });
  assert.deepEqual(stops.map((s) => s.id), ['big', 'small']);
});

test('equal dues order by oldest unpaid month first', () => {
  const { stops } = sequenceRouteStops([
    stop({ id: 'new', mohalla: 'Bani', totalDue: 500, earliestUnpaidMonth: '2026-10' }),
    stop({ id: 'old', mohalla: 'Bani', totalDue: 500, earliestUnpaidMonth: '2026-07' }),
    stop({ id: 'nodate', mohalla: 'Bani', totalDue: 500 }),
  ], { todayStr: TODAY });
  assert.deepEqual(stops.map((s) => s.id), ['old', 'new', 'nodate']);
});

test('collected stops sit after pending stops inside their mohalla', () => {
  const { stops } = sequenceRouteStops([
    stop({ id: 'done', mohalla: 'Bani', totalDue: 9000, isCollected: true }),
    stop({ id: 'todo', mohalla: 'Bani', totalDue: 100 }),
  ], { todayStr: TODAY });
  assert.deepEqual(stops.map((s) => s.id), ['todo', 'done']);
});

test('sequence numbers are 1-based in sequenced order', () => {
  const { stops } = sequenceRouteStops([
    stop({ id: 'a', mohalla: 'Gangall', totalDue: 100 }),
    stop({ id: 'b', mohalla: 'Bani', totalDue: 100 }),
  ], { todayStr: TODAY });
  assert.deepEqual(stops.map((s) => [s.id, s.sequenceIndex]), [['b', 1], ['a', 2]]);
});

// ---- totals, non-mutation, original-order fallback ----

test('group totals sum exactly over the group stops', () => {
  const { groups } = sequenceRouteStops([
    stop({ id: 'a', mohalla: 'Bani', totalDue: 300 }),
    stop({ id: 'b', mohalla: 'Bani', totalDue: 200, isCollected: true }),
    stop({ id: 'c', mohalla: 'Gangall', totalDue: 50 }),
  ], { todayStr: TODAY });
  const bani = groups.find((g) => g.label === 'Banii');
  assert.equal(bani.totalStops, 2);
  assert.equal(bani.totalDue, 500);
  assert.equal(bani.pendingStops, 1);
  assert.equal(bani.pendingDue, 300);
});

test('sequencing never mutates its input or the stop objects', () => {
  const input = [
    stop({ id: 'a', mohalla: 'Gangall', totalDue: 100 }),
    stop({ id: 'b', mohalla: 'Bani', totalDue: 900 }),
  ];
  const before = JSON.stringify(input);
  const { stops } = sequenceRouteStops(input, { todayStr: TODAY });
  assert.equal(JSON.stringify(input), before);
  assert.equal(input[0].sequenceIndex, undefined);
  assert.equal(input[0].mohallaKey, undefined);
  assert.notEqual(stops[0], input[0]);
});

test('restoreRouteOrder returns the original list order', () => {
  const { stops } = sequenceRouteStops([
    stop({ id: 'a', mohalla: 'Gangall', totalDue: 100 }),
    stop({ id: 'b', mohalla: 'Bani', totalDue: 900 }),
    stop({ id: 'c', mohalla: 'Bani', totalDue: 800, promiseDate: '2026-10-01' }),
  ], { todayStr: TODAY });
  assert.deepEqual(restoreRouteOrder(stops).map((s) => s.id), ['a', 'b', 'c']);
  assert.deepEqual(restoreRouteOrder([]), []);
});

// ---- wiring: the route sheet's 'sequenced' sort option ----

test('calculateFieldCollectionRoutes with sortBy sequenced groups by mohalla and surfaces Waada-broken first', async () => {
  const { calculateFieldCollectionRoutes, FIELD_ROUTE_OUTCOMES_KEY } = await import('../nav-collection-rounds.js');
  const storage = {
    getItem(key) {
      if (key === FIELD_ROUTE_OUTCOMES_KEY) {
        return JSON.stringify({
          date: TODAY,
          outcomes: {
            broken1: { outcome: 'promised', promiseDate: '2026-10-01', promiseAmount: 100 },
          },
        });
      }
      return null;
    },
  };
  const customer = (id, mohalla, due, month) => ({
    id, name: id, mohalla, area: mohalla,
    bills: [{ dueAmount: due, status: 'unpaid', month }],
  });
  const state = {
    customers: [
      customer('rich', 'Bani', 5000, '2026-11'),
      customer('broken1', 'Bani', 100, '2026-10'),
      customer('other', 'Gangall', 900, '2026-11'),
    ],
  };
  const route = calculateFieldCollectionRoutes(state, { sortBy: 'sequenced', dateStr: TODAY, storage });
  // Gangall's pending due (900) is below Bani's (5100), so Bani's group
  // walks first, broken promise first inside it, then the rich stop.
  assert.deepEqual(route.stops.map((s) => s.id), ['broken1', 'rich', 'other']);
  assert.deepEqual(route.stops.map((s) => s.stopNumber), [1, 2, 3]);
  // Amounts are untouched by reordering: the route totals still match.
  assert.equal(route.totalDue, 6000);
  assert.equal(route.totalStops, 3);
});

test('calculateFieldCollectionRoutes keeps its existing priority order untouched', async () => {
  const { calculateFieldCollectionRoutes } = await import('../nav-collection-rounds.js');
  const customer = (id, mohalla, due) => ({
    id, name: id, mohalla, area: mohalla,
    bills: [{ dueAmount: due, status: 'unpaid', month: '2026-11' }],
  });
  const state = { customers: [customer('small', 'Bani', 100), customer('big', 'Gangall', 900)] };
  const route = calculateFieldCollectionRoutes(state, { sortBy: 'due-high', dateStr: TODAY });
  assert.deepEqual(route.stops.map((s) => s.id), ['big', 'small']);
});

test('empty and non-array inputs sequence to empty', () => {
  assert.deepEqual(sequenceRouteStops([]).stops, []);
  assert.deepEqual(sequenceRouteStops(null).groups, []);
  assert.equal(ROUTE_SEQUENCE_SORT_ID, 'sequenced');
});
