import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildZoneBandwidthYield } from '../phase3.js';
import { resolvePackageSpeedMbps } from '../mikrotik-generator.js';
import { applicablePriceForMonth } from '../billing-cycle.js';
import { TRANSLATIONS, t } from '../nav-language.js';

// SISP-129: Zone Provisioned Bandwidth & Revenue-per-Mbps Analytics.
// The builder in phase3.js groups with the SAME locationPath/areaDescriptors
// derivation as buildAreaIntelligence (row ids match one-for-one); speeds come
// only from the shipped resolvePackageSpeedMbps and revenue only from the
// shipped applicablePriceForMonth, both injected exactly as app.js injects
// them. All fixtures are synthetic.

const REF = new Date('2026-10-15T00:00:00+05:00'); // PKT month 2026-10
const RESOLVERS = { speedMbpsFor: resolvePackageSpeedMbps, priceForMonth: applicablePriceForMonth };
let seq = 0;
function cust(overrides = {}) {
  seq += 1;
  return {
    id: `syn-${seq}`, customerNumber: seq, name: `Test Customer ${String(seq).padStart(2, '0')}`,
    area: 'BARRIAN', mohalla: '', zone: '', packageSpeed: '15Mbps Unlimited',
    monthlyPriceSchedule: [{ effectiveMonth: '2026-01', amount: 3000 }],
    isFreeConnection: false, archived: false, bills: [], incidents: [],
    ...overrides,
  };
}
const areaRow = (result, label) => result.rows.find(row => row.level === 'area' && row.key === label.toLowerCase());

test('standard catalogue packages resolve and aggregate per zone', () => {
  const state = { customers: [
    cust({ packageSpeed: '15Mbps Unlimited', monthlyPriceSchedule: [{ effectiveMonth: '2026-01', amount: 3000 }] }),
    cust({ packageSpeed: '5Mbps / 200GB', monthlyPriceSchedule: [{ effectiveMonth: '2026-01', amount: 2000 }] }),
  ] };
  const result = buildZoneBandwidthYield(state, REF, RESOLVERS);
  assert.equal(result.month, '2026-10');
  const row = areaRow(result, 'BARRIAN');
  assert.equal(row.subscribers, 2);
  assert.equal(row.provisionedMbps, 20, '15 + 5 from the catalogue presets');
  assert.equal(row.avgSpeedMbps, 10);
  assert.equal(row.monthlyRevenue, 5000, 'recorded schedule prices 3000 + 2000');
  assert.equal(row.yieldPkrPerMbps, 250, '5000 / 20 Mbps, whole PKR');
  assert.equal(row.unresolvedSpeedCount, 0);
});

test('custom package names resolve only when the shipped resolver can read a speed', () => {
  const state = { customers: [
    cust({ area: 'THALII', packageSpeed: '20 Mbps Special', monthlyPriceSchedule: [{ effectiveMonth: '2026-01', amount: 4000 }] }),
    cust({ area: 'THALII', packageSpeed: 'Gold Plan', monthlyPriceSchedule: [{ effectiveMonth: '2026-01', amount: 2500 }] }),
  ] };
  // Pin the resolver's own behaviour both ways first: an explicit speed in a
  // custom label resolves; a speed-less custom label does not.
  assert.equal(resolvePackageSpeedMbps(state.customers[0]), 20);
  assert.equal(resolvePackageSpeedMbps(state.customers[1]), null);
  const row = areaRow(buildZoneBandwidthYield(state, REF, RESOLVERS), 'THALII');
  assert.equal(row.subscribers, 2);
  assert.equal(row.provisionedMbps, 20, 'only the resolvable custom package contributes');
  assert.equal(row.unresolvedSpeedCount, 1, 'the speed-less package is tallied, never guessed');
  assert.equal(row.monthlyRevenue, 6500);
  assert.equal(row.yieldPkrPerMbps, 325);
});

test('a zone whose speeds are all unresolvable shows 0 Mbps and null avg/yield, never NaN', () => {
  const state = { customers: [cust({ area: 'NAKAR', packageSpeed: 'Gold Plan', monthlyPriceSchedule: [{ effectiveMonth: '2026-01', amount: 2500 }] })] };
  const row = areaRow(buildZoneBandwidthYield(state, REF, RESOLVERS), 'NAKAR');
  assert.equal(row.provisionedMbps, 0);
  assert.equal(row.avgSpeedMbps, null);
  assert.equal(row.yieldPkrPerMbps, null, 'revenue > 0 with 0 Mbps must not divide by zero');
  assert.equal(row.monthlyRevenue, 2500);
  assert.equal(row.unresolvedSpeedCount, 1);
});

test('mohalla variants merge into one canonical zone (Bani = BANII)', () => {
  const state = { customers: [
    cust({ area: 'Mohalla Bani' }),
    cust({ area: 'BANII' }),
    cust({ area: 'Bani' }),
  ] };
  const result = buildZoneBandwidthYield(state, REF, RESOLVERS);
  const areas = result.rows.filter(row => row.level === 'area');
  assert.equal(areas.length, 1, 'all three spellings are the same canonical mohalla');
  assert.equal(areas[0].subscribers, 3);
  assert.equal(areas[0].provisionedMbps, 45);
});

test('archived customers never count; an all-archived zone produces no row', () => {
  const state = { customers: [
    cust({ area: 'SODAA', archived: true }),
    cust({ area: 'SODAA', archived: true }),
    cust({ area: 'BARRIAN' }),
    cust({ area: 'BARRIAN', archived: true }),
  ] };
  const result = buildZoneBandwidthYield(state, REF, RESOLVERS);
  assert.equal(areaRow(result, 'SODAA'), undefined, 'zero active subscribers = no bandwidth row');
  assert.equal(areaRow(result, 'BARRIAN').subscribers, 1, 'only the non-archived subscriber counts');
});

test('FREE connections contribute Rs 0 revenue but their speed still provisions', () => {
  const state = { customers: [
    cust({ area: 'PALALIYAA', isFreeConnection: true }),
    cust({ area: 'PALALIYAA' }),
  ] };
  const row = areaRow(buildZoneBandwidthYield(state, REF, RESOLVERS), 'PALALIYAA');
  assert.equal(row.subscribers, 2);
  assert.equal(row.provisionedMbps, 30, 'the FREE line still consumes bandwidth');
  assert.equal(row.monthlyRevenue, 3000, 'only the paying subscriber contributes revenue');
  assert.equal(row.yieldPkrPerMbps, 100);
});

test('parent area row includes its zone child rows (rollup, same group ids as Area Intelligence)', () => {
  const state = { customers: [
    cust({ area: 'GANGALL', zone: 'East' }),
    cust({ area: 'GANGALL', zone: 'East', packageSpeed: '5Mbps / 200GB', monthlyPriceSchedule: [{ effectiveMonth: '2026-01', amount: 2000 }] }),
    cust({ area: 'GANGALL' }),
  ] };
  const result = buildZoneBandwidthYield(state, REF, RESOLVERS);
  const area = areaRow(result, 'GANGALL');
  const zone = result.rows.find(row => row.level === 'zone' && row.area === 'Zone: East');
  assert.equal(zone.subscribers, 2);
  assert.equal(zone.provisionedMbps, 20);
  assert.equal(area.subscribers, 3, 'area rollup includes zoned and unzoned subscribers');
  assert.equal(area.provisionedMbps, 35);
  assert.equal(result.byId.get(area.id), area, 'byId is keyed by the Area Intelligence group id');
});

test('rounding: avg speed to 1 decimal, yield to whole PKR', () => {
  const state = { customers: [
    cust({ packageSpeed: '5Mbps / 200GB', monthlyPriceSchedule: [{ effectiveMonth: '2026-01', amount: 2000 }] }),
    cust({}),
    cust({ monthlyPriceSchedule: [{ effectiveMonth: '2026-01', amount: 2500 }] }),
  ] };
  const row = areaRow(buildZoneBandwidthYield(state, REF, RESOLVERS), 'BARRIAN');
  assert.equal(row.provisionedMbps, 35);
  assert.equal(row.avgSpeedMbps, 11.7, '35 / 3 = 11.666… -> 11.7');
  assert.equal(row.monthlyRevenue, 7500);
  assert.equal(row.yieldPkrPerMbps, 214, '7500 / 35 = 214.28… -> 214');
});

test('zero-subscriber edge: empty roster yields no rows at all', () => {
  const result = buildZoneBandwidthYield({ customers: [] }, REF, RESOLVERS);
  assert.deepEqual(result.rows, []);
  assert.equal(result.byId.size, 0);
});

test('the derivation is read-only: state is byte-for-byte unchanged', () => {
  const state = { customers: [cust({}), cust({ area: 'THALII', packageSpeed: 'Gold Plan' })] };
  const before = JSON.stringify(state);
  buildZoneBandwidthYield(state, REF, RESOLVERS);
  assert.equal(JSON.stringify(state), before);
});

test('i18n: every zby_ key used in app.js / index.html exists in both dictionaries and never renders raw', () => {
  const appJs = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const used = new Set([...(appJs + indexHtml).matchAll(/zby_[a-z_]+/g)].map(match => match[0]));
  assert.ok(used.size >= 6, `expected at least 6 zby_ keys in use, found ${used.size}`);
  for (const key of used) {
    assert.ok(TRANSLATIONS.en[key], `en dictionary is missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `ur dictionary is missing ${key}`);
    assert.notEqual(t(key, 'en'), key, `${key} renders raw in en`);
    assert.notEqual(t(key, 'ur'), key, `${key} renders raw in ur`);
  }
  assert.ok(t('zby_unresolved_title', 'en', { count: 2 }).includes('2'), 'count interpolates');
});

test('wiring: app.js merges the yield rows and index.html carries the sortable headers', () => {
  const appJs = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(appJs.includes('buildZoneBandwidthYield(state, referenceDate, { speedMbpsFor: resolvePackageSpeedMbps, priceForMonth: applicablePriceForMonth })'), 'render merges with the shipped resolvers injected');
  for (const key of ['provisionedMbps', 'avgSpeedMbps', 'yieldPkrPerMbps']) {
    assert.ok(indexHtml.includes(`data-sort-area="${key}"`), `sortable header for ${key}`);
    assert.ok(appJs.includes(`areaSortKey === '${key}'`), `sort branch for ${key}`);
  }
});
