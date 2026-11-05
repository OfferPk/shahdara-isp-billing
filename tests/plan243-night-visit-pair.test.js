// Plan 243 — Night-visit safety pair record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validNightVisitPairDate,
  validNightVisitPairReturnTime,
  normalizeNightVisitPairList,
  recordNightVisitPair,
  removeNightVisitPair,
  findNightVisitPair,
  addNightVisitPairAnnotation,
  recordNightVisitReturn,
  nightVisitPairSorted,
  nightVisitPairsInPeriod,
  nightVisitPairsForArea,
  nightVisitPairAreas,
  unpairedNightVisits,
  nightVisitPairSummaryText,
  unpairedNightVisitSummaryText,
  nightVisitPairText,
  nightVisitPairHtml,
  nightVisitPairCsv,
  nightVisitPairFilename,
} from '../night-visit-pair.js';

const first = {
  id: 'NV-1',
  visitRef: 'V-101',
  date: '2026-11-05',
  staffA: 'Saad',
  staffB: 'Bilal',
  area: 'Mohalla A',
  returnTime: '',
};

const second = {
  id: 'NV-2',
  visitRef: 'v-102',
  date: '2026-11-04',
  staffA: 'Saad',
  staffB: 'Hamza',
  area: 'mohalla a',
  returnTime: '23:40',
};

test('half-formed pair records are refused', () => {
  assert.equal(recordNightVisitPair([], { ...first, id: '' }), null);
  assert.equal(recordNightVisitPair([], { ...first, visitRef: '' }), null);
  assert.equal(recordNightVisitPair([], { ...first, date: '2026-02-30' }), null);
  assert.equal(recordNightVisitPair([], { ...first, staffA: '  ' }), null);
  assert.equal(recordNightVisitPair([], { ...first, staffB: '' }), null);
  assert.equal(recordNightVisitPair([], { ...first, area: '' }), null);
  // Two names are required: the same person twice is not a pair.
  assert.equal(
    recordNightVisitPair([], { ...first, staffB: ' saad ' }),
    null,
  );
});

test('strict dates use a 12-entry days-in-month table', () => {
  assert.equal(validNightVisitPairDate('2026-11-05'), true);
  assert.equal(validNightVisitPairDate('2024-02-29'), true);
  assert.equal(validNightVisitPairDate('2026-02-29'), false);
  assert.equal(validNightVisitPairDate('2026-04-31'), false);
  assert.equal(validNightVisitPairDate('2026-13-01'), false);
  assert.equal(validNightVisitPairDate('05-11-2026'), false);
  assert.equal(validNightVisitPairDate(20261105), false);
});

test('return times are clock times only', () => {
  assert.equal(validNightVisitPairReturnTime('23:40'), true);
  assert.equal(validNightVisitPairReturnTime('00:05'), true);
  assert.equal(validNightVisitPairReturnTime('24:00'), false);
  assert.equal(validNightVisitPairReturnTime('9:30'), false);
  assert.equal(validNightVisitPairReturnTime('23:60'), false);
  assert.equal(validNightVisitPairReturnTime('night'), false);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const entry = {
    ...first,
    billId: 'B-1',
    customer: 'Someone',
    staffA: ' Saad ',
    returnTime: '25:00',
  };
  const before = JSON.stringify(entry);
  const recorded = recordNightVisitPair([], entry);
  assert.equal(JSON.stringify(entry), before);
  assert.deepEqual(Object.keys(recorded[0]).sort(), [
    'annotations',
    'area',
    'date',
    'id',
    'returnTime',
    'staffA',
    'staffB',
    'visitRef',
  ]);
  assert.equal(recorded[0].staffA, 'Saad');
  // A bad return time is dropped, not stored.
  assert.equal(recorded[0].returnTime, '');
  assert.equal(recorded[0].billId, undefined);
});

test('duplicate ids are never rewritten', () => {
  const recorded = recordNightVisitPair([], first);
  const again = recordNightVisitPair(recorded, { ...first, area: 'Elsewhere' });
  assert.equal(again.length, 1);
  assert.equal(again[0].area, 'Mohalla A');
});

test('find and remove work by id', () => {
  const list = recordNightVisitPair(recordNightVisitPair([], first), second);
  assert.equal(findNightVisitPair(list, 'NV-2').visitRef, 'v-102');
  assert.equal(findNightVisitPair(list, 'NV-9'), null);
  assert.equal(removeNightVisitPair(list, 'NV-1').length, 1);
  assert.equal(removeNightVisitPair(list, 'NV-9').length, 2);
});

test('pairs sort by date, then visit reference, then id', () => {
  const list = recordNightVisitPair(recordNightVisitPair([], first), second);
  const sorted = nightVisitPairSorted(list);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ['NV-2', 'NV-1'],
  );
});

test('period filter is inclusive on both ends', () => {
  const list = recordNightVisitPair(recordNightVisitPair([], first), second);
  assert.deepEqual(
    nightVisitPairsInPeriod(list, '2026-11-04', '2026-11-05').map(
      (item) => item.id,
    ),
    ['NV-2', 'NV-1'],
  );
  assert.deepEqual(
    nightVisitPairsInPeriod(list, '2026-11-05', '2026-11-05').map(
      (item) => item.id,
    ),
    ['NV-1'],
  );
  assert.deepEqual(nightVisitPairsInPeriod(list, '2026-11-06', ''), []);
});

test('area listing is case-insensitive and areas keep first spelling', () => {
  const list = recordNightVisitPair(recordNightVisitPair([], first), second);
  assert.deepEqual(
    nightVisitPairsForArea(list, 'MOHALLA A').map((item) => item.id),
    ['NV-2', 'NV-1'],
  );
  assert.deepEqual(nightVisitPairAreas(list), ['Mohalla A']);
  assert.deepEqual(nightVisitPairsForArea(list, 'Nowhere'), []);
});

test('unpaired night visits are listed as exceptions', () => {
  const pairs = recordNightVisitPair([], first);
  const visits = [
    { visitRef: 'V-101', date: '2026-11-05' },
    { visitRef: 'V-103', date: '2026-11-05' },
    { visitRef: 'v-104', date: '2026-11-06' },
    { visitRef: '', date: '2026-11-05' },
    { visitRef: 'V-105', date: '2026-02-30' },
  ];
  assert.deepEqual(
    unpairedNightVisits(visits, pairs, '2026-11-05', '2026-11-05').map(
      (row) => row.visitRef,
    ),
    ['V-103'],
  );
  // A pair match is case-insensitive on the visit reference.
  assert.deepEqual(
    unpairedNightVisits(
      [{ visitRef: 'v-101', date: '2026-11-05' }],
      pairs,
      '',
      '',
    ),
    [],
  );
  assert.equal(
    unpairedNightVisitSummaryText(visits, pairs, '2026-11-05', '2026-11-05'),
    '1 unpaired night visit in the period: V-103.',
  );
  assert.equal(
    unpairedNightVisitSummaryText(
      [{ visitRef: 'V-101', date: '2026-11-05' }],
      pairs,
      '',
      '',
    ),
    'No unpaired night visits in the period.',
  );
});

test('return time is recorded once, after the visit, and never overwritten', () => {
  const list = recordNightVisitPair([], first);
  const returned = recordNightVisitReturn(list, 'NV-1', '23:15', '2026-11-05');
  assert.equal(findNightVisitPair(returned, 'NV-1').returnTime, '23:15');
  assert.deepEqual(findNightVisitPair(returned, 'NV-1').annotations, [
    { date: '2026-11-05', note: 'Returned at 23:15.' },
  ]);
  // A second return time does not overwrite the first.
  const again = recordNightVisitReturn(returned, 'NV-1', '23:45', '2026-11-05');
  assert.equal(findNightVisitPair(again, 'NV-1').returnTime, '23:15');
  assert.equal(findNightVisitPair(again, 'NV-1').annotations.length, 1);
  // Bad return times and bad dates refuse and leave the list unchanged.
  assert.equal(
    recordNightVisitReturn(list, 'NV-1', '25:00', '2026-11-05'),
    list,
  );
  assert.equal(
    recordNightVisitReturn(list, 'NV-1', '23:15', '2026-02-30'),
    list,
  );
  assert.equal(
    recordNightVisitReturn(list, 'NV-9', '23:15', '2026-11-05'),
    list,
  );
});

test('annotation never rewrites the pair record', () => {
  const list = recordNightVisitPair([], first);
  const annotated = addNightVisitPairAnnotation(list, 'NV-1', {
    date: '2026-11-05',
    note: 'Both returned together.',
  });
  const item = findNightVisitPair(annotated, 'NV-1');
  assert.equal(item.visitRef, 'V-101');
  assert.equal(item.date, '2026-11-05');
  assert.equal(item.staffA, 'Saad');
  assert.equal(item.staffB, 'Bilal');
  assert.equal(item.area, 'Mohalla A');
  assert.equal(item.returnTime, '');
  assert.deepEqual(item.annotations, [
    { date: '2026-11-05', note: 'Both returned together.' },
  ]);
  // Bad annotations refuse and leave the list unchanged.
  assert.equal(
    addNightVisitPairAnnotation(list, 'NV-1', {
      date: '2026-02-30',
      note: 'Nope.',
    }),
    list,
  );
  assert.equal(
    addNightVisitPairAnnotation(list, 'NV-1', { date: '2026-11-05', note: '' }),
    list,
  );
  assert.equal(
    addNightVisitPairAnnotation(list, 'NV-9', {
      date: '2026-11-05',
      note: 'Nope.',
    }),
    list,
  );
});

test('summary and pair text name both staff and the return state', () => {
  const list = recordNightVisitPair(recordNightVisitPair([], first), second);
  assert.equal(
    nightVisitPairSummaryText(list),
    '2 night visit pair records for 1 area. 1 with a return time recorded.',
  );
  assert.equal(
    nightVisitPairText(first),
    'Night visit V-101 — 2026-11-05 — Mohalla A — paired: Saad and Bilal. Return time not yet recorded.',
  );
  assert.equal(
    nightVisitPairText(second),
    'Night visit v-102 — 2026-11-04 — mohalla a — paired: Saad and Hamza. Returned at 23:40.',
  );
  assert.equal(nightVisitPairText({ ...first, staffB: 'Saad' }), '');
});

test('html is escaped and csv has the right filename', () => {
  const list = recordNightVisitPair([], {
    ...first,
    staffA: '<b>Saad</b>',
  });
  const html = nightVisitPairHtml(list);
  assert.doesNotMatch(html, /<b>Saad<\/b>/);
  assert.match(html, /&lt;b&gt;Saad&lt;\/b&gt;/);
  assert.equal(nightVisitPairHtml([]), '<p>No night visit pair records.</p>');
  const csv = nightVisitPairCsv(list);
  assert.match(csv, /"id","visit reference","date","staff a","staff b","area","return time"/);
  assert.match(csv, /"NV-1","V-101","2026-11-05"/);
  assert.equal(nightVisitPairFilename(), 'night-visit-pairs.csv');
});

test('list normalisation drops bad rows and keeps the first id', () => {
  const list = normalizeNightVisitPairList([
    first,
    { ...first, area: 'Elsewhere' },
    { ...first, id: 'NV-3', staffB: 'Saad' },
    null,
    'not a record',
  ]);
  assert.deepEqual(
    list.map((item) => item.id),
    ['NV-1'],
  );
  assert.deepEqual(normalizeNightVisitPairList('nope'), []);
});

test('purity fence: no storage, clock, network, page, or imports', () => {
  const source = readFileSync(
    new URL('../night-visit-pair.js', import.meta.url),
    'utf8',
  );
  for (const banned of [
    'localStorage',
    'sessionStorage',
    'new Date(',
    'Date.now(',
    'fetch(',
    'XMLHttpRequest',
    'document.',
  ]) {
    assert.doesNotMatch(source, new RegExp(banned.replace(/[().]/g, '\\$&')));
  }
  assert.doesNotMatch(source, /import\s/);
});

test('neighbour-module fence: safety note and on-call rota are untouched', () => {
  const source = readFileSync(
    new URL('../night-visit-pair.js', import.meta.url),
    'utf8',
  );
  for (const name of ['safety-note', 'oncall-rota']) {
    assert.doesNotMatch(source, new RegExp(name));
  }
  assert.equal(existsSync(new URL('../safety-note.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../oncall-rota.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of [
    'nvpHeading',
    'nvpSummary',
    'nvpExceptions',
    'nvpVisitRef',
    'nvpDate',
    'nvpStaffA',
    'nvpStaffB',
    'nvpArea',
    'nvpRecordBtn',
    'nvpReturnId',
    'nvpReturnTime',
    'nvpReturnDate',
    'nvpReturnBtn',
    'nvpAnnotateId',
    'nvpAnnotateDate',
    'nvpAnnotateNote',
    'nvpAnnotateBtn',
    'nvpRemoveId',
    'nvpRemoveBtn',
    'nvpFilterArea',
    'nvpFilterBtn',
    'nvpPeriodFrom',
    'nvpPeriodTo',
    'nvpExceptionsBtn',
    'nvpList',
    'nvpExportBtn',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wires the night visit pair panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(source, /night-visit-pair\.js/);
  assert.match(source, /renderNightVisitPairs/);
  assert.match(source, /nvpRecordBtn/);
});

test('deployment guard: no standalone OLT word in app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /(?<![A-Za-z])OLT(?![A-Za-z])/);
});
