/**
 * plan52-dependency-register.test.js — Plan 52: single-point-of-failure
 * and blast-radius register.
 * Pins:
 * - the five dependency types, with typed spellings folded to keys
 *   and anything outside refused;
 * - one dependency per id, with mohalla links canonicalised the
 *   Plan T way (prefix stripped, bani -> BANII) and segment/unit
 *   links de-duplicated case-insensitively;
 * - a blast radius listing exactly the customers in the linked
 *   mohallas, segments, or units on the same fixture — archived
 *   customers listed separately and never counted, and a customer
 *   with no mohalla and no connection record never assigned;
 * - a dependency with no links shows as unmapped, never as safe;
 * - editing a link never changes a customer, bill, payment, or
 *   ticket record, and inputs are never mutated.
 * Synthetic data only; no ledger figure is ever changed by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEPENDENCY_TYPES,
  DEPENDENCY_TYPE_LABELS,
  DEPENDENCY_TYPE_OPTIONS,
  canonicalDependencyMohalla,
  normalizeDependencyType,
  normalizeDependency,
  normalizeDependencyList,
  findDependency,
  upsertDependency,
  removeDependency,
  buildBlastRadius,
  buildDependencyBlastRadii,
  dependencySummaryText,
  dependencyRegisterHtml,
  dependencyBlastRadiusHtml,
  dependencyCsv,
  dependencyFilename,
} from '../dependency-register.js';

const customers = [
  { id: 'c1', name: 'Ahmed', mohalla: 'Bani' },
  { id: 'c2', name: 'Bilal', mohalla: 'Kishti' },
  { id: 'c3', name: 'Chanda', mohalla: 'Bani' },
  { id: 'c4', name: 'Daniyal', mohalla: 'Sodaa', archived: true },
  { id: 'c5', name: 'Emaan' },
  { id: 'c6', name: 'Farah' },
];
const records = [
  { customerId: 'c1', splitter: 'Splitter A', oltId: 'Unit-1' },
  { customerId: 'c2', splitter: 'Splitter B', oltId: 'Unit-1' },
  { customerId: 'c4', splitter: 'Splitter A', oltId: 'Unit-2' },
  { customerId: 'c5', splitter: 'Splitter A', oltId: 'Unit-1' },
];
const context = { customers, connectionRecords: records };

test('dependency types fold typed spellings and refuse unknown types', () => {
  assert.equal(normalizeDependencyType('Upstream'), 'upstream');
  assert.equal(normalizeDependencyType('OLT'), 'olt');
  assert.equal(normalizeDependencyType('power feed'), null);
  assert.equal(normalizeDependencyType('power'), 'power');
  assert.equal(DEPENDENCY_TYPE_LABELS.olt, 'OLT');
  assert.equal(DEPENDENCY_TYPE_OPTIONS.length, 5);
  assert.deepEqual(Object.values(DEPENDENCY_TYPES).sort(), ['olt', 'power', 'router', 'splitter', 'upstream']);
});

test('canonical mohalla strips the prefix and collapses aliases', () => {
  assert.equal(canonicalDependencyMohalla('MOHALLA BANI').key, 'banii');
  assert.equal(canonicalDependencyMohalla('bani').stored, 'BANII');
  assert.equal(canonicalDependencyMohalla('Kishti').stored, 'KISHTII');
  assert.equal(canonicalDependencyMohalla('  '), null);
  assert.equal(canonicalDependencyMohalla(''), null);
});

test('a dependency without id, name, or a known type is refused', () => {
  assert.equal(normalizeDependency({ name: 'Upstream', type: 'upstream' }), null);
  assert.equal(normalizeDependency({ id: 'd1', type: 'upstream' }), null);
  assert.equal(normalizeDependency({ id: 'd1', name: 'Upstream', type: 'magic' }), null);
  assert.equal(normalizeDependency(null), null);
  assert.equal(normalizeDependency({ id: 'd1', name: 'Upstream', type: 'upstream', note: '  ' }).note, '');
});

test('mohalla, segment, and unit links de-duplicate case-insensitively', () => {
  const dep = normalizeDependency({
    id: 'd1', name: 'Upstream', type: 'upstream',
    mohallas: ['Bani', 'MOHALLA BANI', 'bani', 'Kishti'],
    segments: ['Splitter A', 'splitter a', 'Splitter B'],
    units: ['Unit-1', 'unit-1'],
  });
  assert.deepEqual(dep.mohallas.map((m) => m.label), ['Banii', 'Kishtii']);
  assert.deepEqual(dep.segments.map((s) => s.label), ['Splitter A', 'Splitter B']);
  assert.deepEqual(dep.units.map((u) => u.label), ['Unit-1']);
});

test('upsert replaces the earlier links and remove drops one id', () => {
  const first = upsertDependency([], { id: 'd1', name: 'Upstream', type: 'upstream', mohallas: ['Bani'] });
  const second = upsertDependency(first, { id: 'd1', name: 'Upstream', type: 'upstream', mohallas: ['Kishti'] });
  assert.equal(second.length, 1);
  assert.deepEqual(second[0].mohallas.map((m) => m.label), ['Kishtii']);
  assert.equal(upsertDependency(first, { id: 'd2', name: '', type: 'upstream' }).length, 1);
  assert.equal(removeDependency(second, 'd1').length, 0);
  assert.equal(findDependency(second, 'd1').name, 'Upstream');
});

test('blast radius lists exactly the customers in linked mohallas or segments', () => {
  const radius = buildBlastRadius(
    { id: 'd1', name: 'Upstream link', type: 'upstream', mohallas: ['Bani'], segments: ['Splitter A'] },
    context,
  );
  assert.equal(radius.mapped, true);
  assert.equal(radius.customerCount, 3);
  assert.deepEqual(radius.affected.map((c) => c.name), ['Ahmed', 'Chanda', 'Emaan']);
  assert.deepEqual(radius.affected.find((c) => c.name === 'Ahmed').matchedBy, ['mohalla', 'segment']);
  assert.deepEqual(radius.affected.find((c) => c.name === 'Chanda').matchedBy, ['mohalla']);
  assert.deepEqual(radius.affected.find((c) => c.name === 'Emaan').matchedBy, ['segment']);
  assert.equal(radius.archivedCount, 1);
  assert.deepEqual(radius.archived.map((c) => c.name), ['Daniyal']);
});

test('a unit link reaches customers through the connection register', () => {
  const radius = buildBlastRadius(
    { id: 'd2', name: 'Main unit', type: 'olt', units: ['unit-1'] },
    context,
  );
  assert.deepEqual(radius.affected.map((c) => c.name), ['Ahmed', 'Bilal', 'Emaan']);
  assert.deepEqual(radius.affected.find((c) => c.name === 'Bilal').matchedBy, ['unit']);
});

test('a dependency with no links is unmapped, never safe', () => {
  const radius = buildBlastRadius({ id: 'd3', name: 'Spare router', type: 'router' }, context);
  assert.equal(radius.mapped, false);
  assert.equal(radius.customerCount, 0);
  assert.equal(buildBlastRadius({ id: 'd3', name: 'Spare router', type: 'router' }, { customers: [] }).mapped, false);
  assert.equal(buildBlastRadius(null, context), null);
});

test('a customer with no mohalla and no record is never assigned', () => {
  const radius = buildBlastRadius(
    { id: 'd1', name: 'Upstream link', type: 'upstream', mohallas: ['Bani'], segments: ['Splitter A'], units: ['Unit-1'] },
    context,
  );
  assert.ok(!radius.affected.some((c) => c.name === 'Farah'));
  assert.ok(!radius.archived.some((c) => c.name === 'Farah'));
});

test('the last connection record per customer wins', () => {
  const moved = buildBlastRadius(
    { id: 'd1', name: 'Upstream link', type: 'upstream', segments: ['Splitter A'] },
    { customers, connectionRecords: [...records, { customerId: 'c1', splitter: 'Splitter B', oltId: 'Unit-1' }] },
  );
  assert.ok(!moved.affected.some((c) => c.name === 'Ahmed'));
  assert.deepEqual(moved.affected.map((c) => c.name), ['Emaan']);
});

test('radii sort by dependency name and the summary counts mapped versus unmapped', () => {
  const radii = buildDependencyBlastRadii([
    { id: 'd2', name: 'Zebra power', type: 'power' },
    { id: 'd1', name: 'Alpha upstream', type: 'upstream', mohallas: ['Bani'] },
  ], context);
  assert.deepEqual(radii.map((r) => r.dependency.name), ['Alpha upstream', 'Zebra power']);
  assert.match(dependencySummaryText([], []), /No dependencies/);
  const deps = [
    { id: 'd2', name: 'Zebra power', type: 'power' },
    { id: 'd1', name: 'Alpha upstream', type: 'upstream', mohallas: ['Bani'] },
  ];
  assert.match(dependencySummaryText(deps, radii), /2 dependencies recorded \(1 mapped, 1 unmapped\)/);
  assert.match(dependencySummaryText(deps, radii), /cover 2 customers/);
  assert.match(dependencySummaryText(deps, radii), /gap in the register/);
});

test('a dependency record holds no bill, payment, ticket, or customer field', () => {
  const dep = normalizeDependency({ id: 'd1', name: 'Upstream', type: 'upstream', mohallas: ['Bani'] });
  assert.deepEqual(Object.keys(dep).sort(), ['id', 'mohallas', 'name', 'note', 'segments', 'type', 'units']);
});

test('inputs are never mutated', () => {
  const depInput = { id: 'd1', name: 'Upstream', type: 'upstream', mohallas: ['Bani'] };
  const before = JSON.stringify({ depInput, customers, records });
  buildBlastRadius(depInput, context);
  upsertDependency([{ id: 'd1', name: 'Old', type: 'upstream' }], depInput);
  assert.equal(JSON.stringify({ depInput, customers, records }), before);
});

test('register and blast-radius HTML escape names and state the unmapped warning', () => {
  const radii = buildDependencyBlastRadii([
    { id: 'd1', name: '<Up> & "Co"', type: 'upstream', mohallas: ['Bani'] },
    { id: 'd2', name: 'Spare', type: 'router' },
  ], context);
  const html = dependencyRegisterHtml([{ id: 'd1', name: '<Up> & "Co"', type: 'upstream', mohallas: ['Bani'] }], radii);
  assert.ok(!html.includes('<Up>'));
  assert.ok(html.includes('&lt;Up&gt;'));
  assert.match(dependencyBlastRadiusHtml(radii[1]), /unmapped/);
  assert.match(dependencyBlastRadiusHtml(radii[0]), /go dark/);
  assert.equal(dependencyBlastRadiusHtml(null), '<p>Select a dependency to see its blast radius.</p>');
});

test('CSV quotes commas and the filename is date-safe', () => {
  const csv = dependencyCsv(
    [{ id: 'd1', name: 'Upstream', type: 'upstream', mohallas: ['Bani'], note: 'renegotiate, soon' }],
    buildDependencyBlastRadii([{ id: 'd1', name: 'Upstream', type: 'upstream', mohallas: ['Bani'] }], context),
  );
  assert.ok(csv.includes('"renegotiate, soon"'));
  assert.match(csv, /^Dependency,Type,Mohallas,Segments,Units,Status,Customers in blast radius,Note\n/);
  assert.equal(dependencyFilename('2026-11-04'), 'dependency-register-2026-11-04.csv');
  assert.equal(dependencyFilename(''), 'dependency-register.csv');
});
