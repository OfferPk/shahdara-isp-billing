// Plan 249 — Pole ownership and permission note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validPolePermissionDate,
  normalizePolePermissionList,
  recordPolePermission,
  removePolePermission,
  findPolePermission,
  updatePolePermission,
  polePermissionsSorted,
  polesByPermission,
  polePermissionStatuses,
  polesWithoutPermission,
  polePermissionSummaryText,
  polePermissionText,
  polePermissionHtml,
  polePermissionCsv,
  polePermissionFilename,
} from '../pole-permission.js';

const first = {
  id: 'PP-1',
  pole: 'P-101',
  segment: 'Barrian Road',
  owner: 'WAPDA',
  permission: 'granted',
  date: '2026-11-05',
  note: 'Permission confirmed by phone.',
};

const second = {
  id: 'PP-2',
  pole: 'P-102',
  segment: 'Barrian Road',
  owner: 'Cantonment Board',
  permission: 'pending',
  date: '2026-11-04',
  note: 'Letter sent, reply awaited.',
};

const third = {
  id: 'PP-3',
  pole: 'p-101',
  segment: 'Main Bazaar',
  owner: 'Private',
  permission: 'refused',
  date: '2026-11-06',
  note: 'Owner refused access.',
};

const other = {
  id: 'PP-4',
  pole: 'P-201',
  segment: 'Main Bazaar',
  owner: 'Municipal Committee',
  permission: 'no idea',
  date: '2026-11-03',
  note: 'No one could say who owns this pole.',
};

test('half-formed pole notes are refused', () => {
  assert.equal(recordPolePermission([], { ...first, id: '' }), null);
  assert.equal(recordPolePermission([], { ...first, pole: '  ' }), null);
  assert.equal(recordPolePermission([], { ...first, segment: '' }), null);
  assert.equal(recordPolePermission([], { ...first, owner: '' }), null);
  assert.equal(recordPolePermission([], { ...first, note: '' }), null);
  assert.equal(recordPolePermission([], { ...first, date: '2026-02-30' }), null);
  assert.equal(recordPolePermission([], { ...first, date: '2026-13-01' }), null);
  assert.equal(recordPolePermission([], { ...first, date: '05-11-2026' }), null);
});

test('strict dates accept leap-day years and reject the rest', () => {
  assert.equal(validPolePermissionDate('2024-02-29'), true);
  assert.equal(validPolePermissionDate('2025-02-29'), false);
  assert.equal(validPolePermissionDate('2026-04-31'), false);
  assert.equal(validPolePermissionDate('2026-11-05'), true);
  assert.equal(validPolePermissionDate('2026-11-5'), false);
  assert.equal(validPolePermissionDate(20261105), false);
  assert.equal(validPolePermissionDate(''), false);
});

test('an unknown permission falls back to not recorded', () => {
  const list = recordPolePermission([], other);
  assert.equal(list.length, 1);
  assert.equal(list[0].permission, 'not recorded');
  assert.equal(recordPolePermission([], { ...first, permission: 'GRANTED' })[0].permission, 'granted');
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const input = { ...first, surprise: 'extra', ownerCode: 7 };
  const snapshot = JSON.stringify(input);
  const list = recordPolePermission([], input);
  assert.equal(list.length, 1);
  assert.equal('surprise' in list[0], false);
  assert.equal('ownerCode' in list[0], false);
  assert.deepEqual(list[0].updates, []);
  assert.equal(JSON.stringify(input), snapshot);
});

test('duplicate ids are never rewritten', () => {
  const list = recordPolePermission([first], { ...second, id: 'PP-1' });
  assert.equal(list.length, 1);
  assert.equal(list[0].pole, 'P-101');
});

test('one note per pole: the same pole twice is refused', () => {
  const list = recordPolePermission([first], third);
  assert.equal(list.length, 1);
  assert.equal(list[0].pole, 'P-101');
  assert.equal(list[0].permission, 'granted');
});

test('find and remove work by id', () => {
  const list = [first, second, other];
  assert.equal(findPolePermission(list, 'PP-2').pole, 'P-102');
  assert.equal(findPolePermission(list, 'PP-9'), null);
  const kept = removePolePermission(list, 'PP-2');
  assert.equal(kept.length, 2);
  assert.equal(kept.some((item) => item.id === 'PP-2'), false);
  assert.deepEqual(
    removePolePermission(list, '  PP-1 ').map((item) => item.id),
    ['PP-2', 'PP-4'],
  );
});

test('notes sort by pole, then id', () => {
  const sorted = polePermissionsSorted([other, second, first]);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ['PP-1', 'PP-2', 'PP-4'],
  );
});

test('poles list by permission status, case-insensitively', () => {
  const list = [first, second, other];
  assert.deepEqual(
    polesByPermission(list, 'GRANTED').map((item) => item.id),
    ['PP-1'],
  );
  assert.deepEqual(
    polesByPermission(list, 'pending').map((item) => item.id),
    ['PP-2'],
  );
  assert.deepEqual(
    polesByPermission(list, 'not recorded').map((item) => item.id),
    ['PP-4'],
  );
  assert.deepEqual(polesByPermission(list, 'refused'), []);
});

test('permission statuses list the statuses actually present', () => {
  assert.deepEqual(polePermissionStatuses([first, second, other]), [
    'granted',
    'pending',
    'not recorded',
  ]);
  assert.deepEqual(polePermissionStatuses([]), []);
});

test('poles without a recorded permission are flagged', () => {
  const flagged = polesWithoutPermission([first, second, other]);
  assert.deepEqual(
    flagged.map((item) => item.id),
    ['PP-4'],
  );
  assert.deepEqual(polesWithoutPermission([first, second]), []);
});

test('an update is a dated entry, never a silent overwrite', () => {
  const list = [first];
  const next = updatePolePermission(list, 'PP-1', {
    date: '2026-11-07',
    permission: 'refused',
    note: 'Owner changed mind after a complaint.',
  });
  assert.notEqual(next, list);
  assert.equal(next[0].permission, 'refused');
  assert.equal(next[0].date, '2026-11-07');
  assert.equal(next[0].note, 'Owner changed mind after a complaint.');
  assert.equal(next[0].updates.length, 1);
  assert.deepEqual(next[0].updates[0], {
    date: '2026-11-07',
    permission: 'refused',
    note: 'Owner changed mind after a complaint.',
  });
  // The original note fields survive only in the history, not as the
  // current permission: a second update keeps both entries.
  const again = updatePolePermission(next, 'PP-1', {
    date: '2026-11-08',
    permission: 'granted',
    note: '',
  });
  assert.equal(again[0].permission, 'granted');
  assert.equal(again[0].note, 'Owner changed mind after a complaint.');
  assert.equal(again[0].updates.length, 2);
});

test('bad updates are refused and leave the list untouched', () => {
  const list = [first];
  assert.equal(updatePolePermission(list, 'PP-1', { date: '2026-02-30', permission: 'granted', note: 'x' }), list);
  assert.equal(updatePolePermission(list, 'PP-9', { date: '2026-11-07', permission: 'granted', note: 'x' }), list);
  assert.equal(updatePolePermission(list, 'PP-1', null), list);
  assert.equal(updatePolePermission(list, 'PP-1', { permission: 'granted', note: 'x' }), list);
});

test('summary text counts by status and names unrecorded poles', () => {
  assert.equal(
    polePermissionSummaryText([first, second, other]),
    '3 poles: 1 granted, 1 pending, 0 refused. 1 pole without a recorded permission.',
  );
  assert.equal(
    polePermissionSummaryText([first]),
    '1 pole: 1 granted, 0 pending, 0 refused. Every pole has a recorded permission.',
  );
  assert.equal(
    polePermissionSummaryText([]),
    '0 poles: 0 granted, 0 pending, 0 refused. Every pole has a recorded permission.',
  );
});

test('note text names the pole, owner, permission, and date', () => {
  assert.equal(
    polePermissionText(first),
    'Pole P-101 (Barrian Road): owned by WAPDA, permission granted, noted 2026-11-05. Permission confirmed by phone. No dated updates yet.',
  );
  assert.equal(polePermissionText({ ...first, date: '2026-02-30' }), '');
});

test('HTML escapes owner and note text', () => {
  const html = polePermissionHtml([
    { ...first, owner: 'A & B <Owners>', note: 'Said "yes" <today>.' },
  ]);
  assert.equal(html.includes('A &amp; B &lt;Owners&gt;'), true);
  assert.equal(html.includes('Said &quot;yes&quot; &lt;today&gt;.'), true);
  assert.equal(html.includes('<Owners>'), false);
  assert.equal(polePermissionHtml([]), '<p>No pole permission notes recorded.</p>');
});

test('CSV export uses the pole-permissions filename', () => {
  const csv = polePermissionCsv([first, second]);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","pole","segment","owner","permission","date noted","note","dated updates"');
  assert.equal(lines.length, 3);
  assert.equal(lines[1].includes('"P-101"'), true);
  assert.equal(lines[1].includes('"granted"'), true);
  assert.equal(polePermissionFilename(), 'pole-permissions.csv');
});

test('list normalisation drops bad rows and duplicate poles', () => {
  const dirty = [
    first,
    { ...second, pole: 'P-101' },
    { ...second, date: '2026-02-30' },
    { ...first, id: 'PP-1' },
    null,
    'nope',
  ];
  const clean = normalizePolePermissionList(dirty);
  assert.equal(clean.length, 1);
  assert.equal(clean[0].id, 'PP-1');
  assert.deepEqual(normalizePolePermissionList('nope'), []);
  assert.deepEqual(normalizePolePermissionList(null), []);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(
    new URL('../pole-permission.js', import.meta.url),
    'utf8',
  );
  assert.equal(source.includes('import '), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('document.'), false);
});

test('neighbour-module fence: inspection round, asset tracker, and landmark book are untouched', () => {
  const source = readFileSync(
    new URL('../pole-permission.js', import.meta.url),
    'utf8',
  );
  assert.equal(source.includes('pole-inspection'), false);
  assert.equal(source.includes('pole-asset-tracker'), false);
  assert.equal(source.includes('pole-landmark-book'), false);
  assert.equal(existsSync(new URL('../pole-inspection.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../pole-asset-tracker.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../pole-landmark-book.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(
    new URL('../index.html', import.meta.url),
    'utf8',
  );
  for (const id of [
    'ppList',
    'ppSummary',
    'ppPole',
    'ppSegment',
    'ppOwner',
    'ppPermission',
    'ppDate',
    'ppNote',
    'ppRecordBtn',
    'ppUpdateId',
    'ppUpdateDate',
    'ppUpdatePermission',
    'ppUpdateNote',
    'ppUpdateBtn',
    'ppRemoveId',
    'ppRemoveBtn',
    'ppFilterStatus',
    'ppStatusBtn',
    'ppStatusBody',
    'ppFlaggedBody',
    'ppExportBtn',
  ]) {
    assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
  }
});

test('app.js wires the pole permission panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './pole-permission.js'"), true);
  assert.equal(source.includes('renderPolePermissions()'), true);
  assert.equal(source.includes('POLE_PERMISSION_KEY'), true);
  assert.equal(source.includes('polePermissionsSorted'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
