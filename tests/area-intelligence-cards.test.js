import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createInitialState, updateCustomerProfile } from '../core.js';
import { buildAreaIntelligence, groupAreaIntelligenceCards } from '../phase3.js';

// Area-intelligence card layout: the wide 10-column table overflows phone
// screens (amounts cut mid-number, e.g. "PKR 37,00"), so at <=700px the same
// rows render as one card per root area. These tests cover the grouping the
// cards are built from: no "Zone not set" section is ever rendered, the
// hierarchy stays nested, and every table column survives on the card.

const METRIC_KEYS = ['totalCustomers', 'activeCustomers', 'billedAmount', 'collectedAmount', 'outstanding', 'collectionRate', 'averageCustomerValue', 'expenses', 'estimatedProfit'];
function row(overrides) {
  return { totalCustomers: 0, activeCustomers: null, billedAmount: null, collectedAmount: null, outstanding: null, collectionRate: null, averageCustomerValue: null, expenses: null, estimatedProfit: null, activeCustomerSource: '', expensesSource: '', estimatedProfitBasis: '', ...overrides };
}
function syntheticRows() {
  return [
    row({ area: 'Area: Gangall', key: 'gangall', rootArea: 'Area: Gangall', level: 'area', parentArea: '', depth: 0, totalCustomers: 3, billedAmount: 9000, collectedAmount: 8000, outstanding: 1000, collectionRate: 88.9, averageCustomerValue: 3000, expenses: 500, estimatedProfit: 7500 }),
    row({ area: 'Zone not set', key: '__zone_not_set__', rootArea: 'Area: Gangall', level: 'zone', parentArea: 'Area: Gangall', depth: 1, totalCustomers: 2, billedAmount: 6000 }),
    row({ area: 'Zone: East', key: 'east', rootArea: 'Area: Gangall', level: 'zone', parentArea: 'Area: Gangall', depth: 1, totalCustomers: 1, billedAmount: 3000 }),
    row({ area: 'Area: Kishti', key: 'kishti', rootArea: 'Area: Kishti', level: 'area', parentArea: '', depth: 0, totalCustomers: 15, billedAmount: 37000 }),
    row({ area: 'Mohalla: Kishti Town', key: 'kishti-town', rootArea: 'Area: Kishti', level: 'mohalla', parentArea: 'Area: Kishti', depth: 1, totalCustomers: 15, billedAmount: 37000 }),
    row({ area: 'Zone: North', key: 'north', rootArea: 'Area: Kishti', level: 'zone', parentArea: 'Mohalla: Kishti Town', depth: 2, totalCustomers: 10, billedAmount: 25000 }),
    row({ area: 'Zone not set', key: '__zone_not_set__', rootArea: 'Area: Kishti', level: 'zone', parentArea: 'Mohalla: Kishti Town', depth: 2, totalCustomers: 5, billedAmount: 12000 }),
    row({ area: 'Area not set', key: '__area_not_set__', rootArea: 'Area not set', level: 'unassigned', parentArea: '', depth: 0, totalCustomers: 2 }),
  ];
}
function walkSections(groups, visit) {
  for (const group of groups) {
    if (group.root) { visit(group.root); (function walk(section) { for (const child of section.children) { visit(child); walk(child); } })(group.root); }
    for (const section of group.children) { visit(section); (function walk(s) { for (const child of s.children) { visit(child); walk(child); } })(section); }
  }
}

test('card groups never render a Zone not set section and fold its customers into the parent', () => {
  const groups = groupAreaIntelligenceCards(syntheticRows());
  walkSections(groups, section => assert.notEqual(section.label, 'Zone not set', 'no Zone not set section may render'));
  const gangall = groups.find(group => group.rootArea === 'Area: Gangall');
  assert.equal(gangall.root.withoutZoneCustomers, 2, 'zoneless Gangall customers fold into the area card');
  const kishtiTown = groups.find(group => group.rootArea === 'Area: Kishti').children.find(section => section.level === 'mohalla');
  assert.equal(kishtiTown.withoutZoneCustomers, 5, 'zoneless mohalla customers fold into the mohalla section');
});

test('card groups preserve the area -> mohalla -> zone hierarchy instead of flattening it', () => {
  const groups = groupAreaIntelligenceCards(syntheticRows());
  const kishti = groups.find(group => group.rootArea === 'Area: Kishti');
  assert.equal(kishti.children.length, 1, 'only the mohalla is a top-level child of the area card');
  assert.equal(kishti.children[0].level, 'mohalla');
  assert.equal(kishti.children[0].children.length, 1, 'the zone nests under its mohalla, not under the area');
  assert.equal(kishti.children[0].children[0].label, 'Zone: North');
  const gangall = groups.find(group => group.rootArea === 'Area: Gangall');
  assert.equal(gangall.root.children.length, 1, 'a direct zone nests under its area card');
  assert.equal(gangall.root.children[0].label, 'Zone: East');
});

test('card grouping is independent of row order, so table sorting cannot break nesting', () => {
  const rows = syntheticRows();
  const shuffled = [rows[5], rows[0], rows[6], rows[3], rows[2], rows[4], rows[1], rows[7]];
  const groups = groupAreaIntelligenceCards(shuffled);
  assert.deepEqual(groups.map(group => group.rootArea), ['Area: Kishti', 'Area: Gangall', 'Area not set'], 'card order follows first appearance of each root area');
  const kishti = groups[0];
  assert.equal(kishti.children[0].children[0].label, 'Zone: North', 'zone still nests under its mohalla when it arrives first');
  assert.equal(kishti.children[0].withoutZoneCustomers, 5);
});

test('every table column survives on the card rows with full, untruncated amounts', () => {
  const groups = groupAreaIntelligenceCards(syntheticRows());
  walkSections(groups, section => {
    for (const key of METRIC_KEYS) assert.ok(key in section.row, `${key} survives on card row ${section.label}`);
  });
  const gangall = groups.find(group => group.rootArea === 'Area: Gangall');
  assert.equal(gangall.root.row.billedAmount, 9000, 'full billed amount is kept, never cut mid-number');
  const kishti = groups.find(group => group.rootArea === 'Area: Kishti');
  assert.equal(kishti.root.row.billedAmount, 37000, 'PKR 37,000 stays whole on the card');
});

test('unassigned profiles get their own card group', () => {
  const groups = groupAreaIntelligenceCards(syntheticRows());
  const unassigned = groups.find(group => group.rootArea === 'Area not set');
  assert.ok(unassigned.root, 'unassigned group has a root section');
  assert.equal(unassigned.root.level, 'unassigned');
  assert.equal(unassigned.root.row.totalCustomers, 2);
});

test('real builder output groups into cards with no Zone not set section', () => {
  const referenceDate = new Date('2026-10-07T12:00:00+05:00');
  let state = createInitialState(['Ali', 'Bilal']);
  state = updateCustomerProfile(state, 'seed-001', { mohalla: 'MOHALLA CHARYAA', zone: 'East', serviceStatus: 'active', packageSpeed: '5 Mbps', monthlySellingAmount: 1000, connectionDate: '2026-08-01' }, referenceDate);
  state = updateCustomerProfile(state, 'seed-002', { mohalla: 'MOHALLA CHARYAA', serviceStatus: 'offline', packageSpeed: '10 Mbps', monthlySellingAmount: 1500, connectionDate: '2026-09-01' }, referenceDate);
  const result = buildAreaIntelligence(state, { startDate: '2026-09-01', endDate: '2026-09-30' }, referenceDate);
  assert.ok(result.rows.some(r => r.area === 'Zone not set'), 'fixture has a Zone not set row in the flat table');
  const beforeRows = JSON.stringify(result.rows);
  const groups = groupAreaIntelligenceCards(result.rows);
  assert.equal(JSON.stringify(result.rows), beforeRows, 'grouping never mutates its input rows');
  walkSections(groups, section => assert.notEqual(section.label, 'Zone not set'));
  const charyaa = groups.find(group => group.rootArea === 'Area: Mohalla Charyaa');
  assert.ok(charyaa, 'area card exists');
  assert.equal(charyaa.root.withoutZoneCustomers, 1, 'the zoneless customer folds into the area card');
});

test('cards container exists in markup and the stylesheet switches to cards at narrow widths', () => {
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const styles = fs.readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.ok(index.includes('id="areaIntelligenceCards"'), 'cards container exists');
  assert.ok(styles.includes('.area-intelligence-cards{display:none}'), 'cards stay hidden on desktop');
  assert.ok(styles.includes('.area-intelligence-card .table-scroll{display:none}'), 'wide table hides at narrow widths');
  assert.ok(styles.includes('.area-intelligence-cards{display:grid'), 'cards show at narrow widths');
});
