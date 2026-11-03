// Issue #361: Analytics ISP insights (collection rate this vs last month,
// overdue trend, new/lost customers) computed from saved data only, plus
// plain-language "what unlocks this" guidance on unavailable health factors.
import test from 'node:test';
import assert from 'node:assert/strict';
import { addCustomer, addPayment, createInitialState, saveBillMonth } from '../core.js';
import { buildBusinessHealthScore, buildIspInsights } from '../owner-insights.js';

const today = new Date('2026-10-07T12:00:00+05:00');
const customerId = 'seed-001';
const bill = (state, month, amount = 1000) => saveBillMonth(state, customerId, { month, dueAmount: String(amount), status: 'pending' }, today);
const payment = (state, month, date, amount) => addPayment(state, customerId, month, { date, amount: String(amount), method: 'Cash' }, today);

function insightsFixture() {
  let state = createInitialState(['Ali']);
  state = { ...state, customers: state.customers.map(c => ({ ...c, addedOn: '2026-01-01' })) };
  state = bill(state, '2026-09', 1000); state = payment(state, '2026-09', '2026-09-10', 1000);
  state = bill(state, '2026-10', 1000); state = payment(state, '2026-10', '2026-10-06', 250);
  return state;
}

test('361 insights: collection rate this month vs last month with delta', () => {
  const r = buildIspInsights(insightsFixture(), today);
  assert.equal(r.currentMonth, '2026-10');
  assert.equal(r.lastMonth, '2026-09');
  assert.equal(r.collection.lastMonth.rate, 100);
  assert.equal(r.collection.thisMonth.rate, 25);
  assert.equal(r.collection.deltaPoints, -75);
  assert.equal(r.collection.thisMonth.collected, 250);
  assert.equal(r.collection.thisMonth.billed, 1000);
});

test('361 insights: overdue trend covers the last four months, oldest first', () => {
  const r = buildIspInsights(insightsFixture(), today);
  assert.deepEqual(r.overdueTrend.map(row => row.month), ['2026-07', '2026-08', '2026-09', '2026-10']);
  assert.deepEqual(r.overdueTrend.map(row => row.outstanding), [0, 0, 0, 750]);
  assert.ok(r.overdueTrend.every(row => typeof row.source === 'string' && row.source.length > 0));
});

test('361 insights: new and lost customers this month from dated records', () => {
  let state = insightsFixture();
  state = addCustomer(state, 'Bilal', today, { mohalla: 'Shahdara' });
  const bilal = state.customers.find(c => c.name === 'Bilal');
  state = { ...state, customers: state.customers.map(c => c.id === bilal.id ? { ...c, cancellationDate: '2026-10-05' } : c) };
  // One archived record exists (last month), so the archive field is part of
  // the saved history and this month's archive count is a real 0, not null.
  state = { ...state, customers: [...state.customers, { ...state.customers[0], id: 'old-archived', customerNumber: 99, name: 'Old', archived: true, archivedAt: '2026-08-15T10:00', cancellationDate: null }] };
  const r = buildIspInsights(state, today);
  assert.equal(r.newThisMonth, 1);
  assert.equal(r.disconnectedThisMonth, 1);
  assert.equal(r.archivedThisMonth, 0);
  assert.equal(r.lostThisMonth, 1);
});

test('361 insights: no saved data -> rates stay null, never fabricated zeros', () => {
  const r = buildIspInsights(createInitialState(), today);
  assert.equal(r.collection.thisMonth.rate, null);
  assert.equal(r.collection.lastMonth.rate, null);
  assert.equal(r.collection.deltaPoints, null);
  assert.equal(r.newThisMonth, null);
  assert.equal(r.lostThisMonth, null);
  assert.deepEqual(r.overdueTrend.map(row => row.outstanding), [0, 0, 0, 0]);
});

test('361 health: every unavailable factor carries a plain next step', () => {
  let state = createInitialState(['Ali']);
  state = { ...state, customers: state.customers.map(c => ({ ...c, addedOn: '2026-01-01' })) };
  const result = buildBusinessHealthScore(state, today);
  assert.ok(result.unavailableFactors.length >= 4);
  for (const factor of result.unavailableFactors) {
    assert.ok(factor.nextStep && factor.nextStep.startsWith('What unlocks this:'), `${factor.id} must explain what unlocks it`);
  }
});


test('361 health: unavailable factors provide a direct screen route and action label', () => {
  let state = createInitialState(['Ali']);
  state = { ...state, customers: state.customers.map(c => ({ ...c, addedOn: '2026-01-01' })) };
  const result = buildBusinessHealthScore(state, today);
  assert.ok(result.unavailableFactors.length >= 4);
  for (const factor of result.unavailableFactors) {
    assert.ok(factor.actionRoute && factor.actionRoute.startsWith('#/'), `${factor.id} must provide a hash route`);
    assert.ok(factor.actionLabel && factor.actionLabel.length > 0, `${factor.id} must provide an action label`);
  }
});

test('361 insights: pure function — state is not mutated', () => {
  const state = insightsFixture();
  const before = JSON.stringify(state);
  buildIspInsights(state, today);
  assert.equal(JSON.stringify(state), before);
});
