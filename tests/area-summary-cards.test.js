import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAreaSummaryCards } from '../phase3.js';

// Area-summary phone cards: the wide 10-column table overflows phone screens,
// so at <=700px the same rows render as one card per area/mohalla/zone row,
// reusing the Area Intelligence card pattern. These tests cover the card data
// the cards are built from: one card per row in table order, the first column
// as the card header, the other nine columns as labeled lines in table order,
// and every value identical to the table's display string (same fallbacks,
// same formatter), so a card can never disagree with its table row.
// One exception: a 'Zone not set' child card is dropped when its area has no
// named zones — the roll-up already includes the unzoned subset (insights 8a).

const pkr = value => `PKR ${value}`;
function row(overrides) {
  return { area: 'Area: Shahdara', level: 'area', parentArea: '', depth: 0, customerCount: 4, activeCustomers: 3, billedRevenue: 37000, outstanding: 5000, hasBilledRevenue: true, hasBillHistory: true, excludedSubscriptions: 1, online: 2, onlineDenominator: 3, onlinePercent: 66.7, complaints: 2, newConnections: 1, arpu: 12333, ...overrides };
}
const METRIC_LABELS = ['Profiles', 'Active configured subscriptions', 'Service-month billed', 'Outstanding', 'Excluded from ARPU', 'Online % (n/N)', 'Incidents', 'New connections', 'ARPU · billed / active'];

test('one card per row in table order, with the area column as header and nine labeled lines', () => {
  const cards = buildAreaSummaryCards([
    row({}),
    row({ area: 'Mohalla: Kishti Town', level: 'mohalla', parentArea: 'Area: Shahdara', depth: 1 }),
    row({ area: 'Zone: North', level: 'zone', parentArea: 'Mohalla: Kishti Town', depth: 2 }),
  ], true, pkr);
  assert.equal(cards.length, 3);
  assert.deepEqual(cards.map(card => card.level), ['Area', 'Mohalla', 'Zone']);
  assert.deepEqual(cards.map(card => card.label), ['Shahdara', 'Kishti Town', 'North']);
  for (const card of cards) assert.deepEqual(card.metrics.map(metric => metric.label), METRIC_LABELS);
});

test('card values match the table display strings, including money formatting', () => {
  const [card] = buildAreaSummaryCards([row({})], true, pkr);
  assert.deepEqual(Object.fromEntries(card.metrics.map(metric => [metric.label, metric.value])), {
    'Profiles': '4',
    'Active configured subscriptions': '3',
    'Service-month billed': 'PKR 37000',
    'Outstanding': 'PKR 5000',
    'Excluded from ARPU': '1',
    'Online % (n/N)': '66.7% (2/3)',
    'Incidents': '2',
    'New connections': '1',
    'ARPU · billed / active': 'PKR 12333',
  });
});

test('fallbacks match the table: no bill snapshots, no bill entries, unset online and ARPU', () => {
  const [card] = buildAreaSummaryCards([row({ hasBilledRevenue: false, hasBillHistory: false, onlinePercent: null, arpu: null })], true, pkr);
  const values = Object.fromEntries(card.metrics.map(metric => [metric.label, metric.value]));
  assert.equal(values['Service-month billed'], 'No bill snapshots');
  assert.equal(values['Outstanding'], 'No bill entries');
  assert.equal(values['Online % (n/N)'], 'Not set (2/3)');
  assert.equal(values['ARPU · billed / active'], 'Not set');
});

test('new connections show Not set when no connection dates are recorded', () => {
  const [dated, undated] = buildAreaSummaryCards([row({}), row({})], false, pkr);
  assert.equal(dated.metrics.find(metric => metric.label === 'New connections').value, 'Not set');
  assert.equal(undated.metrics.find(metric => metric.label === 'New connections').value, 'Not set');
});

test('Zone not set becomes Not set when the area HAS named zones (the child is a genuine subset)', () => {
  const [area, zone, zoneless] = buildAreaSummaryCards([
    row({}),
    row({ area: 'Zone: North', level: 'zone', parentArea: 'Area: Shahdara', depth: 1 }),
    row({ area: 'Zone not set', level: 'zone', parentArea: 'Area: Shahdara', depth: 1 }),
  ], true, pkr);
  assert.equal(area.label, 'Shahdara');
  assert.equal(zone.label, 'North');
  assert.equal(zoneless.label, 'Not set');
  assert.equal(zoneless.context, 'Within Shahdara');
  assert.equal(area.context, 'Area roll-up');
});

test('Zone not set card is dropped when the area has NO named zones (the roll-up already includes it)', () => {
  const cards = buildAreaSummaryCards([
    row({}),
    row({ area: 'Zone not set', level: 'zone', parentArea: 'Area: Shahdara', depth: 1 }),
  ], true, pkr);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].label, 'Shahdara');
  assert.ok(!cards.some(card => card.label === 'Not set'));
});

test('empty input builds no cards and input rows are never mutated', () => {
  assert.deepEqual(buildAreaSummaryCards([], true, pkr), []);
  assert.deepEqual(buildAreaSummaryCards(null, true, pkr), []);
  const input = row({ billedRevenue: 37000 });
  const before = JSON.stringify(input);
  buildAreaSummaryCards([input], true, pkr);
  assert.equal(JSON.stringify(input), before);
});
