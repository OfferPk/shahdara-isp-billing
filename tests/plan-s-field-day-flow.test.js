import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FIELD_DAY_FLOW_FIGURES_NOTE,
  buildFieldDayFlow,
  preserveFieldDayView,
  restoreFieldDayView,
  fieldDayFlowStripHtml
} from '../field-day-flow.js';

function routeData(overrides = {}) {
  return {
    date: '2026-11-03',
    totalStops: 10,
    totalDue: 50000,
    collectedStops: 4,
    collectedAmount: 20000,
    pendingStops: 6,
    pendingAmount: 30000,
    completionRate: 40,
    roundStatus: 'IN_PROGRESS',
    stops: [
      { id: 'c1', outcome: 'paid', totalDue: 5000 },
      { id: 'c2', outcome: 'promised', promiseAmount: 3000, totalDue: 3000 },
      { id: 'c3', outcome: 'promised', promiseAmount: 4500, totalDue: 4500 },
      { id: 'c4', outcome: 'promised', totalDue: 2000 },
      { id: 'c5', outcome: 'not_home', totalDue: 4000 },
      { id: 'c6', outcome: 'pending', totalDue: 6000 }
    ],
    ...overrides
  };
}

function handover(overrides = {}) {
  return {
    date: '2026-11-03',
    collectorName: 'Saad',
    expectedCash: 18500,
    receiptCount: 7,
    ...overrides
  };
}

test('Plan S - empty inputs give a safe NOT_STARTED flow', () => {
  const flow = buildFieldDayFlow();
  assert.equal(flow.route.totalStops, 0);
  assert.equal(flow.route.collectedAmount, 0);
  assert.equal(flow.promised.stops, 0);
  assert.equal(flow.promised.amount, 0);
  assert.equal(flow.handover.expectedCash, 0);
  assert.equal(flow.handoverRecorded, false);
  assert.equal(flow.nextAction, 'Continue the route');
  assert.deepEqual(flow.steps.map((s) => s.state), ['current', 'todo', 'todo']);
  assert.equal(flow.agreement.routeFiguresMatch, true);
  assert.equal(flow.agreement.handoverFiguresMatch, true);
});

test('Plan S - route and handover figures are carried verbatim', () => {
  const route = routeData();
  const hand = handover();
  const flow = buildFieldDayFlow({ routeData: route, handover: hand });
  assert.equal(flow.route.totalStops, 10);
  assert.equal(flow.route.totalDue, 50000);
  assert.equal(flow.route.collectedAmount, 20000);
  assert.equal(flow.route.pendingAmount, 30000);
  assert.equal(flow.route.completionRate, 40);
  assert.equal(flow.route.roundStatus, 'IN_PROGRESS');
  assert.equal(flow.handover.expectedCash, 18500);
  assert.equal(flow.handover.receiptCount, 7);
  assert.equal(flow.handover.collectorName, 'Saad');
  assert.equal(flow.agreement.routeFiguresMatch, true);
  assert.equal(flow.agreement.handoverFiguresMatch, true);
  assert.equal(flow.date, '2026-11-03');
});

test('Plan S - promised counts stops and sums only recorded promise amounts', () => {
  const flow = buildFieldDayFlow({ routeData: routeData(), handover: handover() });
  // Three promised stops; one carries no promiseAmount, so it counts
  // as a stop but adds nothing to the amount.
  assert.equal(flow.promised.stops, 3);
  assert.equal(flow.promised.amount, 7500);
  assert.equal(flow.promised.withAmount, 2);
});

test('Plan S - promised ignores paid, partial, not-home and refused stops', () => {
  const flow = buildFieldDayFlow({
    routeData: routeData({
      stops: [
        { id: 'a', outcome: 'paid', promiseAmount: 9999 },
        { id: 'b', outcome: 'partial', promiseAmount: 9999 },
        { id: 'c', outcome: 'refused', promiseAmount: 9999 },
        { id: 'd', outcome: 'promised', promiseAmount: 1000 }
      ]
    }),
    handover: handover()
  });
  assert.equal(flow.promised.stops, 1);
  assert.equal(flow.promised.amount, 1000);
});

test('Plan S - promised amount ignores non-finite promise amounts', () => {
  const flow = buildFieldDayFlow({
    routeData: routeData({
      stops: [
        { id: 'a', outcome: 'promised', promiseAmount: 'not-a-number' },
        { id: 'b', outcome: 'promised', promiseAmount: 2500 }
      ]
    }),
    handover: handover()
  });
  assert.equal(flow.promised.stops, 2);
  assert.equal(flow.promised.amount, 2500);
  assert.equal(flow.promised.withAmount, 1);
});

test('Plan S - steps: completed route moves handover to current', () => {
  const flow = buildFieldDayFlow({
    routeData: routeData({ roundStatus: 'COMPLETED', completionRate: 100 }),
    handover: handover()
  });
  assert.deepEqual(flow.steps.map((s) => s.state), ['done', 'current', 'todo']);
  assert.equal(flow.nextAction, 'Open cash handover');
});

test('Plan S - steps: recorded handover reconciles the day', () => {
  const flow = buildFieldDayFlow({
    routeData: routeData({ roundStatus: 'COMPLETED', completionRate: 100 }),
    handover: handover(),
    handoverRecorded: true
  });
  assert.deepEqual(flow.steps.map((s) => s.state), ['done', 'done', 'done']);
  assert.equal(flow.nextAction, 'Day reconciled');
});

test('Plan S - steps: handover recorded mid-route still marks route current', () => {
  const flow = buildFieldDayFlow({
    routeData: routeData(),
    handover: handover(),
    handoverRecorded: true
  });
  assert.deepEqual(flow.steps.map((s) => s.state), ['current', 'done', 'done']);
});

test('Plan S - route collected and handover expected are explained, not equated', () => {
  const flow = buildFieldDayFlow({ routeData: routeData(), handover: handover() });
  assert.equal(flow.figuresNote, FIELD_DAY_FLOW_FIGURES_NOTE);
  assert.match(flow.figuresNote, /different things|reconciliation/);
  // Deliberately different measures on the same fixture: 20000 route
  // collected vs 18500 cash receipts — the summary must not force
  // them equal or hide the difference.
  assert.notEqual(flow.route.collectedAmount, flow.handover.expectedCash);
});

test('Plan S - build does not mutate its inputs', () => {
  const route = routeData();
  const hand = handover();
  const beforeRoute = JSON.stringify(route);
  const beforeHand = JSON.stringify(hand);
  buildFieldDayFlow({ routeData: route, handover: hand });
  assert.equal(JSON.stringify(route), beforeRoute);
  assert.equal(JSON.stringify(hand), beforeHand);
});

test('Plan S - null routeData and handover are treated as empty', () => {
  const flow = buildFieldDayFlow({ routeData: null, handover: null });
  assert.equal(flow.route.totalStops, 0);
  assert.equal(flow.handover.expectedCash, 0);
  assert.equal(flow.promised.stops, 0);
});

test('Plan S - preserve keeps a valid view unchanged', () => {
  assert.deepEqual(preserveFieldDayView({
    sector: 'Shahdara - Bani',
    sortBy: 'due-high',
    query: '  tariq ',
    filterTab: 'promised'
  }), {
    sector: 'Shahdara - Bani',
    sortBy: 'due-high',
    query: 'tariq',
    filterTab: 'promised'
  });
});

test('Plan S - preserve falls back on unknown sort and tab', () => {
  assert.deepEqual(preserveFieldDayView({
    sector: 'All',
    sortBy: 'bogus-sort',
    query: '',
    filterTab: 'bogus-tab'
  }), { sector: 'All', sortBy: 'priority', query: '', filterTab: 'all' });
});

test('Plan S - preserve trims long sector and query values', () => {
  const view = preserveFieldDayView({
    sector: `  ${'x'.repeat(200)}  `,
    sortBy: 'name',
    query: 'y'.repeat(500),
    filterTab: 'all'
  });
  assert.equal(view.sector.length, 120);
  assert.equal(view.query.length, 200);
});

test('Plan S - restore keeps a sector that still exists', () => {
  const restored = restoreFieldDayView(
    { sector: 'Shahdara - Bani', sortBy: 'area', query: '', filterTab: 'pending' },
    ['All', 'Shahdara - Bani', 'Shahdara - Main']
  );
  assert.equal(restored.sector, 'Shahdara - Bani');
  assert.equal(restored.sortBy, 'area');
});

test('Plan S - restore drops a sector that no longer exists', () => {
  const restored = restoreFieldDayView(
    { sector: 'Old Sector', sortBy: 'priority', query: 'ali', filterTab: 'all' },
    ['All', 'Shahdara - Bani']
  );
  assert.equal(restored.sector, 'All');
  assert.equal(restored.query, 'ali');
});

test('Plan S - restore of an empty saved view gives route defaults', () => {
  assert.deepEqual(restoreFieldDayView(null, []), {
    sector: 'All',
    sortBy: 'priority',
    query: '',
    filterTab: 'all'
  });
});

test('Plan S - strip HTML carries promised, handover and steps', () => {
  const flow = buildFieldDayFlow({ routeData: routeData(), handover: handover() });
  const html = fieldDayFlowStripHtml(flow);
  assert.match(html, /7,500/);
  assert.match(html, /18,500/);
  assert.match(html, /Saad/);
  assert.match(html, /Continue the route/);
  assert.match(html, /Work the route/);
  assert.match(html, /Hand over cash/);
  assert.match(html, /Day reconciled/);
});

test('Plan S - strip HTML escapes a hostile collector name', () => {
  const flow = buildFieldDayFlow({
    routeData: routeData(),
    handover: handover({ collectorName: '<script>alert(1)</script>' })
  });
  const html = fieldDayFlowStripHtml(flow);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test('Plan S - strip HTML on an empty flow does not throw', () => {
  const html = fieldDayFlowStripHtml(buildFieldDayFlow());
  assert.match(html, /Rs\. 0/);
  assert.match(html, /Continue the route/);
});

test('Plan S - route-to-handover agreement on one shared fixture', () => {
  // The acceptance: the route view and the handover strip render
  // from the SAME flow object, so their figures cannot drift.
  const route = routeData();
  const hand = handover();
  const flow = buildFieldDayFlow({ routeData: route, handover: hand });
  assert.equal(flow.route.collectedAmount, route.collectedAmount);
  assert.equal(flow.route.pendingAmount, route.pendingAmount);
  assert.equal(flow.route.totalDue, route.totalDue);
  assert.equal(flow.handover.expectedCash, hand.expectedCash);
  assert.equal(flow.handover.receiptCount, hand.receiptCount);
  assert.equal(flow.agreement.routeFiguresMatch, true);
  assert.equal(flow.agreement.handoverFiguresMatch, true);
});
