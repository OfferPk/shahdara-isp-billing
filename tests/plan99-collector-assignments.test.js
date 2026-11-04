import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  canonicalCollectorMohalla,
  normalizeAssignment,
  normalizeAssignmentList,
  upsertAssignment,
  removeAssignment,
  findAssignment,
  collectorForMohalla,
  assignedMohallasForCollector,
  collectorsList,
  unassignedMohallas,
  itemMohalla,
  filterForCollector,
  filterRouteForCollector,
  filterVisitQueueForCollector,
  filterDispatchForCollector,
  assignmentsForOwner,
  collectorPreview,
  assignmentSummaryText,
  assignmentHtml,
  assignmentCsv,
  assignmentFilename,
} from '../collector-assignments.js';

const A1 = { id: 'A1', mohalla: 'BANII', collector: 'Saad' };
const A2 = { id: 'A2', mohalla: 'KISHTII', collector: 'Saad' };
const A3 = { id: 'A3', mohalla: 'GANGALL', collector: 'Bilal' };

test('canonical mohalla folds case, space, prefix, and aliases', () => {
  assert.equal(canonicalCollectorMohalla('bani'), 'BANII');
  assert.equal(canonicalCollectorMohalla('  Mohalla  Kishti  '), 'KISHTII');
  assert.equal(canonicalCollectorMohalla('chamyaa'), 'CHAMYAAA');
  assert.equal(canonicalCollectorMohalla('gangall'), 'GANGALL');
  assert.equal(canonicalCollectorMohalla(''), null);
  assert.equal(canonicalCollectorMohalla(null), null);
});

test('half-formed records are refused and unknown fields are dropped', () => {
  assert.equal(normalizeAssignment({ id: '', mohalla: 'BANII', collector: 'Saad' }), null);
  assert.equal(normalizeAssignment({ id: 'A1', mohalla: '  ', collector: 'Saad' }), null);
  assert.equal(normalizeAssignment({ id: 'A1', mohalla: 'BANII', collector: '' }), null);
  assert.equal(normalizeAssignment({ id: 'A1', mohalla: 'BANII' }), null);
  assert.equal(normalizeAssignment(null), null);
  assert.deepEqual(normalizeAssignment({ ...A1, note: 'extra', rate: 5 }), A1);
  assert.deepEqual(normalizeAssignmentList([A1, { id: 'X', mohalla: 'BANII' }, A2]), [A1, A2]);
});

test('one assignment per mohalla: a second assignment replaces the first', () => {
  const list = upsertAssignment([A1], { id: 'A9', mohalla: 'bani', collector: 'Bilal' });
  assert.equal(list.length, 1);
  assert.equal(list[0].collector, 'Bilal');
  assert.equal(list[0].id, 'A9');
  assert.equal(collectorForMohalla(list, 'BANII'), 'Bilal');
});

test('half-formed upsert leaves the list unchanged', () => {
  const before = [A1];
  const after = upsertAssignment(before, { id: 'X', mohalla: 'GANGALL', collector: '' });
  assert.deepEqual(after, before);
  assert.notEqual(after, before);
});

test('remove by mohalla or by id, and find by mohalla', () => {
  assert.deepEqual(removeAssignment([A1, A2], 'bani'), [A2]);
  assert.deepEqual(removeAssignment([A1, A2], 'A2'), [A1]);
  assert.deepEqual(removeAssignment([A1], 'GANGALL'), [A1]);
  assert.deepEqual(findAssignment([A1, A2], 'Kishti'), A2);
  assert.equal(findAssignment([A1], 'GANGALL'), null);
  assert.equal(collectorForMohalla([A1], 'BANII'), 'Saad');
  assert.equal(collectorForMohalla([A1], 'GANGALL'), null);
});

test('collector mohalla lists are sorted and collector-matched case-insensitively', () => {
  const list = [A2, A1, A3];
  assert.deepEqual(assignedMohallasForCollector(list, 'saad'), ['BANII', 'KISHTII']);
  assert.deepEqual(assignedMohallasForCollector(list, '  Bilal '), ['GANGALL']);
  assert.deepEqual(assignedMohallasForCollector(list, ''), []);
  assert.deepEqual(collectorsList(list), ['Bilal', 'Saad']);
});

test('unassigned mohallas stay listed and owner view shows all together', () => {
  const all = ['BANII', 'KISHTII', 'GANGALL', 'bani', 'MALLA'];
  assert.deepEqual(unassignedMohallas(all, [A1, A2]), ['GANGALL', 'MALLA']);
  assert.deepEqual(unassignedMohallas(all, []), ['BANII', 'GANGALL', 'KISHTII', 'MALLA']);
  assert.deepEqual(assignmentsForOwner([A3, A1]), [A1, A3]);
});

test('item mohalla reads mohalla, area, then customer mohalla', () => {
  assert.equal(itemMohalla({ mohalla: 'BANII' }), 'BANII');
  assert.equal(itemMohalla({ area: 'GANGALL' }), 'GANGALL');
  assert.equal(itemMohalla({ customerMohalla: 'KISHTII' }), 'KISHTII');
  assert.equal(itemMohalla({}), '');
  assert.equal(itemMohalla(null), '');
});

test('route filter lists exactly the collector assigned mohallas customers', () => {
  const stops = [
    { id: 'C1', mohalla: 'BANII' },
    { id: 'C2', mohalla: 'KISHTII' },
    { id: 'C3', mohalla: 'GANGALL' },
    { id: 'C4', mohalla: 'bani' },
    { id: 'C5', mohalla: '' },
  ];
  const filtered = filterRouteForCollector(stops, 'Saad', [A1, A2, A3]);
  assert.deepEqual(filtered.map((s) => s.id), ['C1', 'C2', 'C4']);
  assert.equal(stops.length, 5);
});

test('visit queue and dispatch queue share the same assignment rule', () => {
  const visits = [{ id: 'V1', area: 'GANGALL' }, { id: 'V2', area: 'BANII' }];
  const jobs = [{ id: 'D1', customerMohalla: 'KISHTII' }, { id: 'D2', customerMohalla: 'MALLA' }];
  assert.deepEqual(filterVisitQueueForCollector(visits, 'Bilal', [A1, A2, A3]).map((v) => v.id), ['V1']);
  assert.deepEqual(filterDispatchForCollector(jobs, 'Saad', [A1, A2, A3]).map((j) => j.id), ['D1']);
  assert.deepEqual(filterForCollector(visits, 'Nobody', [A1, A2, A3]), []);
});

test('blank collector is the owner view: every entry shown', () => {
  const items = [{ id: 'C1', mohalla: 'BANII' }, { id: 'C2', mohalla: 'MALLA' }, { id: 'C3', mohalla: '' }];
  assert.deepEqual(filterForCollector(items, '', [A1]).map((i) => i.id), ['C1', 'C2', 'C3']);
  assert.deepEqual(filterForCollector(items, null, [A1]).map((i) => i.id), ['C1', 'C2', 'C3']);
});

test('reassigning moves future views only; inputs are never mutated', () => {
  const before = [A1];
  const after = upsertAssignment(before, { id: 'A9', mohalla: 'BANII', collector: 'Bilal' });
  assert.deepEqual(before, [A1]);
  const stops = [{ id: 'C1', mohalla: 'BANII' }];
  assert.deepEqual(filterRouteForCollector(stops, 'Saad', before).map((s) => s.id), ['C1']);
  assert.deepEqual(filterRouteForCollector(stops, 'Saad', after), []);
  assert.deepEqual(filterRouteForCollector(stops, 'Bilal', after).map((s) => s.id), ['C1']);
  assert.deepEqual(stops, [{ id: 'C1', mohalla: 'BANII' }]);
});

test('collector preview counts filtered entries and owner preview shows all', () => {
  const items = [{ id: 'C1', mohalla: 'BANII' }, { id: 'C2', mohalla: 'GANGALL' }];
  const preview = collectorPreview([A1, A3], 'Saad', items);
  assert.deepEqual(preview.mohallas, ['BANII']);
  assert.equal(preview.total, 2);
  assert.equal(preview.filteredCount, 1);
  assert.deepEqual(preview.filtered.map((i) => i.id), ['C1']);
  const owner = collectorPreview([A1, A3], '', items);
  assert.equal(owner.filteredCount, 2);
});

test('summary text states assigned, collector, and unassigned counts', () => {
  assert.equal(
    assignmentSummaryText([A1, A2, A3], ['BANII', 'KISHTII', 'GANGALL', 'MALLA']),
    '3 mohallas assigned to 2 collectors; 1 mohalla unassigned and still visible to the owner.',
  );
  assert.equal(
    assignmentSummaryText([], ['BANII']),
    '0 mohallas assigned to 0 collectors; 1 mohalla unassigned and still visible to the owner.',
  );
});

test('HTML escapes names and empty list says so plainly', () => {
  const html = assignmentHtml([{ id: 'A1', mohalla: 'BANII', collector: '<Saad & Co>' }]);
  assert.match(html, /&lt;Saad &amp; Co&gt;/);
  assert.match(html, /BANII/);
  assert.match(assignmentHtml([]), /No mohalla is assigned/);
});

test('CSV quotes commas and filename is stable', () => {
  const csv = assignmentCsv([{ id: 'A1', mohalla: 'BANII', collector: 'Saad, Jr' }]);
  assert.equal(csv, 'id,mohalla,collector\nA1,BANII,"Saad, Jr"');
  assert.equal(assignmentFilename(), 'collector-assignments.csv');
});

test('purity fence: module reads no storage, DOM, or network and names no outside record field', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, '..', 'collector-assignments.js'), 'utf8');
  for (const forbidden of ['localStorage', 'document.', 'fetch(', 'payment', 'commission', 'billAmount']) {
    assert.ok(!source.includes(forbidden), `module must not contain ${forbidden}`);
  }
  assert.ok(!source.includes('import '), 'module must stay import-free');
});
