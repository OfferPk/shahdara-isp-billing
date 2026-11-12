// Mohalla Numbering: every customer list in the app reads mohalla-wise
// in the fixed numbered order (1 CHARYAA … 12 HAWELI OR END POINT), with
// any mohalla outside the list after #12. Pure-function tests on
// synthetic data only — no real customer names, no real phone numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { DEFAULT_MOHALLAS } from '../phase3.js';
import {
  RECOVERY_MOHALLA_ORDER,
  recoveryMohallaRank,
  compareMohallaAreas,
  sortMohallaNamesByNumberedOrder,
} from '../phase3.js';
// The numbered order lives in phase3.js (form-validation.js needs the
// comparator without closing an import cycle — see the note there);
// owner-insights.js re-exports the same four names.
import {
  RECOVERY_MOHALLA_ORDER as RECOVERY_MOHALLA_ORDER_FROM_OWNER_INSIGHTS,
  compareMohallaAreas as compareMohallaAreasFromOwnerInsights,
} from '../owner-insights.js';
import {
  sortCustomerRoster,
  groupAreasWithCounts,
  getUniqueCustomerAreas,
} from '../form-validation.js';
import { buildMohallaUserCounts } from '../customer-search-filter.js';
import { calculateMohallaBars } from '../dashboard-mohalla-bars.js';
import {
  normalizeCoverageEstimates,
  buildCoverageRegister,
} from '../coverage-register.js';
import { buildReceivablesAgeing } from '../receivables-ageing.js';
import { buildMohallaAgeing } from '../mohalla-ageing.js';
import {
  resolveBroadcastMohallas,
  buildBroadcastMohallaOptions,
} from '../mohalla-broadcast.js';
import { groupQueueByMohalla } from '../dispatch-queue.js';
import { sequenceRouteStops } from '../route-sequencing.js';
import {
  mohallaCostEstimateSorted,
  mohallaCostEstimateMohallas,
} from '../mohalla-cost-estimate.js';
import {
  assignedMohallasForCollector,
  unassignedMohallas,
  assignmentsForOwner,
} from '../collector-assignments.js';
import { buildDaisyChainTree } from '../daisy-chain-tree-view.js';
import { quickCollectMohallaPendingCounts } from '../quick-collect-mohalla-filter.js';

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

// The numbered order, as the user fixed it: #1 on top, #12 last.
const NUMBERED_KEYS = [
  'charyaa', 'gangall', 'barrian', 'chamyaaa', 'malla', 'palaliyaa',
  'thalii', 'nakar', 'banii', 'jabbiyaa', 'sodaa', 'end point',
];
const ORDERED_DEFAULTS = sortMohallaNamesByNumberedOrder(DEFAULT_MOHALLAS);

const customer = (id, num, mohalla) => ({
  id, customerNumber: num, name: `Test ${id}`, mohalla, archived: false,
});

// ---- the order itself ----

test('order home: owner-insights.js re-exports the same order and comparator', () => {
  assert.equal(RECOVERY_MOHALLA_ORDER_FROM_OWNER_INSIGHTS, RECOVERY_MOHALLA_ORDER);
  assert.equal(compareMohallaAreasFromOwnerInsights, compareMohallaAreas);
});

test('numbered order: the twelve mohallas read 1 to 12, labels fixed', () => {
  assert.deepEqual(
    RECOVERY_MOHALLA_ORDER.map((entry) => entry.label),
    [
      'CHARYAA', 'GANGALL', 'BARRIAN', 'CHAMYAA', 'MALLA', 'PALALIYAA',
      'THALI', 'NAKAR', 'BANI', 'JABBIYAA', 'SODAA', 'HAWELI OR END POINT',
    ],
  );
  assert.deepEqual(RECOVERY_MOHALLA_ORDER.map((entry) => entry.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test('rank: every spelling of a mohalla resolves to its number, Haweli and End Point share #12', () => {
  assert.equal(recoveryMohallaRank('MOHALLA CHARYAA').number, 1);
  assert.equal(recoveryMohallaRank('CHAMYAAA').number, 4);
  assert.equal(recoveryMohallaRank('THALII').number, 7);
  assert.equal(recoveryMohallaRank('BANII').number, 9);
  assert.equal(recoveryMohallaRank('HAWELI').number, 12);
  assert.equal(recoveryMohallaRank('END POINT').number, 12);
  assert.equal(recoveryMohallaRank('ENDPOINT').number, 12);
  // Haweli and End Point share #12, so both sort before any mohalla
  // outside the list, whatever their spelling.
  assert.equal(compareMohallaAreas('HAWELI', 'KISHTII') < 0, true);
  assert.equal(compareMohallaAreas('END POINT', 'KISHTII') < 0, true);
});

test('compare: numbered first in order, unlisted after #12 A-Z, blank last', () => {
  const names = ['SODAA', 'KISHTII', 'CHARYAA', '', 'BANI', 'MOHALLA end side farm house', 'GANGALL'];
  assert.deepEqual(
    [...names].sort(compareMohallaAreas),
    ['CHARYAA', 'GANGALL', 'BANI', 'SODAA', 'KISHTII', 'MOHALLA end side farm house', ''],
  );
  assert.equal(recoveryMohallaRank('MOHALLA end side farm house'), null);
  assert.equal(recoveryMohallaRank('KISHTII'), null);
  assert.equal(compareMohallaAreas('END POINT', 'HAWELI') < 0, true);
  assert.equal(compareMohallaAreas('END POINT', 'CHARYAA') > 0, true);
});

test('sort helper: stable, keeps the caller spellings, never mutates the input', () => {
  const input = ['SODAA', 'MOHALLA BANI', 'CHARYAA', 'KISHTII'];
  const before = [...input];
  assert.deepEqual(sortMohallaNamesByNumberedOrder(input), ['CHARYAA', 'MOHALLA BANI', 'SODAA', 'KISHTII']);
  assert.deepEqual(input, before);
});

// Sharafat 76: End Point is the 16th mohalla and belongs in the
// default list; "MOHALLA end side farm house" stays separate.
test('default mohallas: 16 entries, End Point included, end side farm house separate', () => {
  assert.equal(DEFAULT_MOHALLAS.length, 16);
  assert.ok(DEFAULT_MOHALLAS.includes('END POINT'));
  assert.ok(DEFAULT_MOHALLAS.includes('MOHALLA end side farm house'));
  assert.deepEqual(ORDERED_DEFAULTS.slice(0, 12).map((name) => name.toUpperCase().replace(/^MOHALLA /, '')), [
    'CHARYAA', 'GANGALL', 'BARRIAN', 'CHAMYAAA', 'MALLA', 'PALALIYAA',
    'THALII', 'NAKAR', 'BANII', 'JABBIYAA', 'SODAA', 'END POINT',
  ]);
});

// ---- the customers directory ----

test('roster sort: mohalla-asc groups 1 to 12, customer number breaks ties inside a mohalla', () => {
  const rows = sortCustomerRoster([
    customer('c5', 5, 'SODAA'),
    customer('c2', 2, 'BANI'),
    customer('c1', 1, 'CHARYAA'),
    customer('c9', 9, 'CHARYAA'),
    customer('c3', 3, 'GANGALL'),
    customer('c7', 7, 'KISHTII'),
  ], { sortBy: 'mohalla-asc' });
  assert.deepEqual(rows.map((c) => c.id), ['c1', 'c9', 'c3', 'c2', 'c5', 'c7']);
});

test('roster sort: mohalla-desc is the exact mirror of mohalla-asc', () => {
  const pool = [
    customer('c5', 5, 'SODAA'),
    customer('c2', 2, 'BANI'),
    customer('c1', 1, 'CHARYAA'),
  ];
  assert.deepEqual(
    sortCustomerRoster(pool, { sortBy: 'mohalla-desc' }).map((c) => c.id),
    [...sortCustomerRoster(pool, { sortBy: 'mohalla-asc' })].reverse().map((c) => c.id),
  );
});

test('area counts and unique areas read in the numbered order', () => {
  const pool = [
    customer('c1', 1, 'SODAA'), customer('c2', 2, 'CHARYAA'),
    customer('c3', 3, 'BANI'), customer('c4', 4, 'KISHTII'),
  ];
  assert.deepEqual(
    groupAreasWithCounts(pool).map((row) => row.value),
    ['CHARYAA', 'BANI', 'SODAA', 'KISHTII'],
  );
  assert.deepEqual(getUniqueCustomerAreas(pool), ['CHARYAA', 'BANI', 'SODAA', 'KISHTII']);
});

// ---- search counts, dashboard bars, coverage ----

test('search counts: numbered mohallas first, extras after by count', () => {
  const counts = buildMohallaUserCounts([
    customer('c1', 1, 'SODAA'), customer('c2', 2, 'SODAA'),
    customer('c3', 3, 'CHARYAA'), customer('c4', 4, 'KISHTII'),
  ]);
  assert.deepEqual(counts.map((row) => row.key), ['charyaa', 'sodaa', 'kishtii']);
});

test('dashboard bars: rows read 1 to 12, then the unlisted mohallas, Unassigned last', () => {
  const { rows } = calculateMohallaBars({
    customers: [customer('c9', 9, '')],
  }, new Date('2026-11-05T00:00:00Z'));
  const keys = rows.map((row) => row.key);
  assert.deepEqual(keys.slice(0, 12), NUMBERED_KEYS);
  assert.equal(keys[keys.length - 1], '__unassigned__');
  assert.ok(keys.indexOf('kishtii') > 11);
  assert.ok(keys.indexOf('end side farm house') > 11);
});

test('coverage register: rows read in the numbered order when the comparator is passed', () => {
  const reg = buildCoverageRegister({
    customers: [
      { id: 'c1', name: 'Test 1', mohalla: 'Bani', archived: false },
      { id: 'c2', name: 'Test 2', mohalla: 'Charyaa', archived: false },
    ],
    estimates: [
      { mohalla: 'Bani', premises: 100, date: '2026-03-01', basis: 'walk' },
      { mohalla: 'Charyaa', premises: 50, date: '2026-03-01', basis: 'walk' },
    ],
    compareAreas: compareMohallaAreas,
  });
  const keys = reg.rows.map((row) => row.key);
  assert.ok(keys.indexOf('charyaa') < keys.indexOf('banii'));
  // Without the comparator the register keeps its old behaviour.
  const plain = normalizeCoverageEstimates([
    { mohalla: 'Bani', premises: 100, date: '2026-03-01', basis: 'walk' },
    { mohalla: 'Charyaa', premises: 50, date: '2026-03-01', basis: 'walk' },
  ]);
  assert.deepEqual(plain.map((row) => row.key), ['banii', 'charyaa']);
});

// ---- ageing views ----

test('receivables ageing: equal totals break by the numbered order, not A-Z', () => {
  const entries = [
    { customerId: 'c1', customerName: 'Test 1', mohalla: 'Bani', billMonth: '2026-11', amount: 5000 },
    { customerId: 'c2', customerName: 'Test 2', mohalla: 'Charyaa', billMonth: '2026-11', amount: 5000 },
  ];
  const numbered = buildReceivablesAgeing(entries, '2026-11', compareMohallaAreas);
  assert.deepEqual(numbered.mohallaTotals.map((row) => row.key), ['CHARYAA', 'BANI']);
  const plain = buildReceivablesAgeing(entries, '2026-11');
  assert.deepEqual(plain.mohallaTotals.map((row) => row.key), ['BANI', 'CHARYAA']);
});

test('mohalla ageing: rows read in the numbered order when the comparator is passed', () => {
  const view = {
    valid: true,
    asOfMonth: '2026-11',
    mohallaTotals: [
      { key: 'banii', label: 'Banii', total: 100, byBucket: { current: 100, one: 0, two: 0, threePlus: 0 }, billCount: 1 },
      { key: 'charyaa', label: 'Charyaa', total: 100, byBucket: { current: 100, one: 0, two: 0, threePlus: 0 }, billCount: 1 },
    ],
    unaged: [],
  };
  const mohallas = [{ key: 'banii', label: 'Banii' }, { key: 'charyaa', label: 'Charyaa' }];
  const numbered = buildMohallaAgeing(view, mohallas, compareMohallaAreas);
  assert.deepEqual(numbered.rows.map((row) => row.key), ['charyaa', 'banii']);
  const plain = buildMohallaAgeing(view, mohallas);
  assert.deepEqual(plain.rows.map((row) => row.key), ['banii', 'charyaa']);
});

// ---- broadcast, dispatch, route ----

test('broadcast: an all-mohallas draft addresses the numbered order', () => {
  const resolved = resolveBroadcastMohallas('all', { allMohallas: ORDERED_DEFAULTS });
  assert.deepEqual(resolved.mohallas.slice(0, 12).map((entry) => entry.label.toUpperCase()), [
    'CHARYAA', 'GANGALL', 'BARRIAN', 'CHAMYAAA', 'MALLA', 'PALALIYAA',
    'THALII', 'NAKAR', 'BANII', 'JABBIYAA', 'SODAA', 'END POINT',
  ]);
});

test('broadcast options: found mohallas first, the rest of the list in its given order', () => {
  const options = buildBroadcastMohallaOptions({
    customers: [{ mohalla: 'SODAA' }],
    standardMohallas: ORDERED_DEFAULTS,
  });
  assert.equal(options.length, 16);
  assert.deepEqual(options.map((opt) => opt.key), [
    'sodaa', 'charyaa', 'gangall', 'barrian', 'chamyaaa', 'malla',
    'palaliyaa', 'thalii', 'nakar', 'banii', 'jabbiyaa', 'end point',
    'kishtii', 'pull side', 'chudriyaa', 'end side farm house',
  ]);
});

test('dispatch queue: groups read in the numbered order, Unassigned last', () => {
  const groups = groupQueueByMohalla([
    { id: 'j1', mohalla: 'SODAA' },
    { id: 'j2', mohalla: 'CHARYAA' },
    { id: 'j3', mohalla: '' },
    { id: 'j4', mohalla: 'BANI' },
  ], compareMohallaAreas);
  assert.deepEqual(groups.map((group) => group.key), ['charyaa', 'bani', 'sodaa', '__unassigned__']);
});

test('route sequencing: group ties break by the numbered order when the comparator is passed', () => {
  const stop = (overrides = {}) => ({
    id: 'c1', name: 'Customer', mohalla: '', area: '', totalDue: 0,
    earliestUnpaidMonth: '', outcome: 'pending', isCollected: false, ...overrides,
  });
  const { stops } = sequenceRouteStops([
    stop({ id: 'a', mohalla: 'Gangall', totalDue: 100 }),
    stop({ id: 'b', mohalla: 'Bani', totalDue: 100 }),
  ], { todayStr: '2026-11-03', compareAreas: compareMohallaAreas });
  assert.deepEqual(stops.map((s) => s.id), ['a', 'b']);
  const plain = sequenceRouteStops([
    stop({ id: 'a', mohalla: 'Gangall', totalDue: 100 }),
    stop({ id: 'b', mohalla: 'Bani', totalDue: 100 }),
  ], { todayStr: '2026-11-03' });
  assert.deepEqual(plain.stops.map((s) => s.id), ['b', 'a']);
});

// ---- cost estimates, collector assignments, daisy chain, QC filter ----

test('cost estimates: same-date sheets and the mohalla list read in the numbered order', () => {
  const sheet = (id, mohalla) => ({
    id, mohalla, date: '2026-11-05', estimator: 'Owner',
    items: [{ label: 'Cable', amount: 1000 }],
  });
  const sorted = mohallaCostEstimateSorted([sheet('MCE-2', 'SODAA'), sheet('MCE-1', 'CHARYAA')], compareMohallaAreas);
  assert.deepEqual(sorted.map((s) => s.id), ['MCE-1', 'MCE-2']);
  assert.deepEqual(
    mohallaCostEstimateMohallas([sheet('MCE-2', 'SODAA'), sheet('MCE-1', 'CHARYAA'), sheet('MCE-3', 'KISHTII')], compareMohallaAreas),
    ['CHARYAA', 'SODAA', 'KISHTII'],
  );
});

test('collector assignments: assigned, unassigned and owner views read in the numbered order', () => {
  const list = [
    { id: 'a1', collector: 'Test Collector', mohalla: 'SODAA' },
    { id: 'a2', collector: 'Test Collector', mohalla: 'CHARYAA' },
    { id: 'a3', collector: 'Test Collector', mohalla: 'BANI' },
  ];
  assert.deepEqual(
    assignedMohallasForCollector(list, 'Test Collector', compareMohallaAreas),
    ['CHARYAA', 'BANII', 'SODAA'],
  );
  assert.deepEqual(
    unassignedMohallas(['SODAA', 'CHARYAA', 'BANI'], list, compareMohallaAreas),
    [],
  );
  assert.deepEqual(
    unassignedMohallas(['SODAA', 'CHARYAA', 'BANI', 'GANGALL'], list, compareMohallaAreas),
    ['GANGALL'],
  );
  assert.deepEqual(
    assignmentsForOwner(list, compareMohallaAreas).map((row) => row.mohalla),
    ['CHARYAA', 'BANII', 'SODAA'],
  );
});

test('daisy chain: zones read in the numbered order', () => {
  const tree = buildDaisyChainTree({
    customers: [
      { id: 'r1', customerNumber: 1, name: 'Test Root One', mohalla: 'SODAA', area: '', splitterBoxId: '', splitterPort: null, upstreamCustomerId: '', archived: false },
      { id: 'r2', customerNumber: 2, name: 'Test Root Two', mohalla: 'CHARYAA', area: '', splitterBoxId: '', splitterPort: null, upstreamCustomerId: '', archived: false },
    ],
  });
  assert.deepEqual(tree.zones.map((zone) => zone.zoneKey), ['charyaa', 'sodaa']);
});

test('QC filter counts: the mohalla filter rows read in the numbered order', () => {
  const pool = [
    { id: 'c1', name: 'Test 1', totalDues: 1000, mohalla: 'SODAA' },
    { id: 'c2', name: 'Test 2', totalDues: 2000, mohalla: 'CHARYAA' },
    { id: 'c3', name: 'Test 3', totalDues: 3000, mohalla: 'KISHTII' },
  ];
  const { rows } = quickCollectMohallaPendingCounts(pool, ORDERED_DEFAULTS);
  const keys = rows.map((row) => row.key);
  assert.ok(keys.indexOf('charyaa') < keys.indexOf('sodaa'));
  assert.ok(keys.indexOf('sodaa') < keys.indexOf('kishtii'));
  assert.equal(rows.find((row) => row.key === 'charyaa').count, 1);
  assert.equal(rows.find((row) => row.key === 'charyaa').pendingPkr, 2000);
});

// ---- the app defaults (source pins) ----

test('app defaults: the roster opens mohalla-wise, the sort label reads 1 to 12', () => {
  assert.ok(read('app.js').includes("let customerSortBy = 'mohalla-asc';"));
  assert.ok(read('index.html').includes('<option value="mohalla-asc" selected data-i18n="cust_sort_mohalla_asc">Area (1 → 12)</option>'));
  assert.ok(read('nav-language.js').includes("cust_sort_mohalla_asc: 'Area (1 → 12)',"));
  assert.ok(read('nav-language.js').includes("cust_sort_mohalla_asc: 'علاقہ (1 → 12)',"));
});
