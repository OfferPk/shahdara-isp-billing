// Plan 245 — Customer premises access difficulty note.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validAccessDifficultyDate,
  normalizeAccessDifficultyType,
  accessDifficultyTypeLabel,
  normalizeAccessDifficultyList,
  recordAccessDifficulty,
  removeAccessDifficulty,
  findAccessDifficulty,
  addAccessDifficultyUpdate,
  accessDifficultySorted,
  accessDifficultiesForCustomer,
  accessDifficultiesByType,
  accessDifficultyTypes,
  accessDifficultySummaryText,
  accessDifficultyText,
  accessDifficultyHtml,
  accessDifficultyCsv,
  accessDifficultyFilename,
} from '../access-difficulty.js';

const first = {
  id: 'AD-1',
  customer: 'Ahmed Raza',
  type: 'locked-gate',
  difficulty: 'Main gate is locked after 6pm, guard has the key.',
  whatToDo: 'Call the guard before the visit.',
  date: '2026-11-05',
  notedBy: 'Saad',
};

const second = {
  id: 'AD-2',
  customer: 'ahmed raza',
  type: 'dog',
  difficulty: 'A large dog roams the front yard.',
  whatToDo: 'Knock and wait for the owner to hold the dog.',
  date: '2026-11-04',
  notedBy: 'Bilal',
};

const third = {
  id: 'AD-3',
  customer: 'Fatima Noor',
  type: 'narrow-lane',
  difficulty: 'Lane is too narrow for the van, park at the corner.',
  whatToDo: 'Walk the last 100 metres with the kit.',
  date: '2026-11-06',
  notedBy: 'Saad',
};

test('half-formed difficulty notes are refused', () => {
  assert.equal(recordAccessDifficulty([], { ...first, id: '' }), null);
  assert.equal(recordAccessDifficulty([], { ...first, customer: '  ' }), null);
  assert.equal(recordAccessDifficulty([], { ...first, difficulty: '' }), null);
  assert.equal(recordAccessDifficulty([], { ...first, whatToDo: '' }), null);
  assert.equal(recordAccessDifficulty([], { ...first, date: '2026-02-30' }), null);
  assert.equal(recordAccessDifficulty([], { ...first, date: '05-11-2026' }), null);
  assert.equal(recordAccessDifficulty([], { ...first, notedBy: '' }), null);
});

test('strict dates: days-in-month table and leap years', () => {
  assert.equal(validAccessDifficultyDate('2026-01-31'), true);
  assert.equal(validAccessDifficultyDate('2026-04-31'), false);
  assert.equal(validAccessDifficultyDate('2024-02-29'), true);
  assert.equal(validAccessDifficultyDate('2025-02-29'), false);
  assert.equal(validAccessDifficultyDate('2026-13-01'), false);
  assert.equal(validAccessDifficultyDate('2026-11-00'), false);
  assert.equal(validAccessDifficultyDate(20261105), false);
  assert.equal(validAccessDifficultyDate(''), false);
});

test('unknown difficulty type falls back to other', () => {
  assert.equal(normalizeAccessDifficultyType('locked-gate'), 'locked-gate');
  assert.equal(normalizeAccessDifficultyType('  DOG '), 'dog');
  assert.equal(normalizeAccessDifficultyType('flooding'), 'other');
  assert.equal(normalizeAccessDifficultyType(''), 'other');
  assert.equal(normalizeAccessDifficultyType(null), 'other');
  assert.equal(accessDifficultyTypeLabel('locked-gate'), 'locked gate');
  assert.equal(accessDifficultyTypeLabel('restricted-hours'), 'restricted hours');
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const entry = { ...first, extra: 'drop me', amount: 500 };
  const frozen = Object.freeze({ ...entry });
  const recorded = recordAccessDifficulty([], frozen);
  assert.equal(recorded.length, 1);
  assert.equal('extra' in recorded[0], false);
  assert.equal('amount' in recorded[0], false);
  assert.deepEqual(Object.keys(recorded[0]).sort(), [
    'customer',
    'date',
    'difficulty',
    'id',
    'notedBy',
    'type',
    'updates',
    'whatToDo',
  ]);
  assert.deepEqual(frozen.extra, 'drop me');
});

test('duplicate ids are never rewritten', () => {
  const list = recordAccessDifficulty([], first);
  const again = recordAccessDifficulty(list, { ...first, difficulty: 'Changed.' });
  assert.deepEqual(again, list);
  assert.equal(again[0].difficulty, first.difficulty);
});

test('find and remove', () => {
  const list = [first, second, third].reduce(
    (acc, item) => recordAccessDifficulty(acc, item),
    [],
  );
  assert.equal(findAccessDifficulty(list, 'AD-2').customer, 'ahmed raza');
  assert.equal(findAccessDifficulty(list, 'AD-9'), null);
  assert.equal(findAccessDifficulty(list, '  AD-1 ').id, 'AD-1');
  const removed = removeAccessDifficulty(list, 'AD-2');
  assert.deepEqual(
    removed.map((item) => item.id),
    ['AD-1', 'AD-3'],
  );
  assert.equal(removeAccessDifficulty(list, 'AD-9').length, 3);
});

test('sorting is by date, then customer, then id', () => {
  const list = normalizeAccessDifficultyList([third, first, second]);
  assert.deepEqual(
    accessDifficultySorted(list).map((item) => item.id),
    ['AD-2', 'AD-1', 'AD-3'],
  );
});

test('visit view: notes for one customer, case-insensitive', () => {
  const list = [first, second, third].reduce(
    (acc, item) => recordAccessDifficulty(acc, item),
    [],
  );
  const found = accessDifficultiesForCustomer(list, 'AHMED RAZA');
  assert.deepEqual(
    found.map((item) => item.id),
    ['AD-2', 'AD-1'],
  );
  assert.deepEqual(accessDifficultiesForCustomer(list, 'Nobody'), []);
  assert.deepEqual(accessDifficultiesForCustomer(list, ''), []);
});

test('notes list by difficulty type', () => {
  const list = [first, second, third].reduce(
    (acc, item) => recordAccessDifficulty(acc, item),
    [],
  );
  assert.deepEqual(
    accessDifficultiesByType(list, 'dog').map((item) => item.id),
    ['AD-2'],
  );
  assert.deepEqual(
    accessDifficultiesByType(list, 'LOCKED-GATE').map((item) => item.id),
    ['AD-1'],
  );
  assert.deepEqual(accessDifficultiesByType(list, 'flooding'), []);
  assert.deepEqual(accessDifficultyTypes(list), [
    'dog',
    'locked-gate',
    'narrow-lane',
  ]);
});

test('a note is never edited, only followed by a dated update', () => {
  const list = recordAccessDifficulty([], first);
  const updated = addAccessDifficultyUpdate(list, 'AD-1', {
    date: '2026-11-06',
    note: 'Guard now keeps the key at the shop next door.',
  });
  assert.equal(updated[0].difficulty, first.difficulty);
  assert.equal(updated[0].whatToDo, first.whatToDo);
  assert.equal(updated[0].date, first.date);
  assert.equal(updated[0].notedBy, first.notedBy);
  assert.equal(updated[0].updates.length, 1);
  assert.equal(updated[0].updates[0].note, 'Guard now keeps the key at the shop next door.');
  // A bad update changes nothing.
  assert.deepEqual(
    addAccessDifficultyUpdate(updated, 'AD-1', { date: '2026-02-30', note: 'Bad.' }),
    updated,
  );
  assert.deepEqual(
    addAccessDifficultyUpdate(updated, 'AD-1', { date: '2026-11-07', note: '  ' }),
    updated,
  );
  assert.deepEqual(addAccessDifficultyUpdate(updated, 'AD-9', { date: '2026-11-07', note: 'No.' }), updated);
});

test('summary and note text', () => {
  const list = [first, second, third].reduce(
    (acc, item) => recordAccessDifficulty(acc, item),
    [],
  );
  assert.equal(
    accessDifficultySummaryText(list),
    '3 access difficulty notes for 2 customer premises. dog, locked gate, narrow lane',
  );
  assert.equal(accessDifficultySummaryText([]), '0 access difficulty notes for 0 customer premises. No difficulty types recorded yet.');
  assert.equal(
    accessDifficultyText(first),
    'Ahmed Raza — locked gate: Main gate is locked after 6pm, guard has the key. — Do this: Call the guard before the visit. — noted 2026-11-05 by Saad. No updates yet.',
  );
  assert.equal(accessDifficultyText({ ...first, date: '2026-02-30' }), '');
});

test('HTML is escaped', () => {
  const nasty = {
    ...first,
    difficulty: '<script>alert("x")</script>',
    whatToDo: 'Use & wait.',
  };
  const html = accessDifficultyHtml([nasty]);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Use &amp; wait\./);
  assert.equal(accessDifficultyHtml([]), '<p>No access difficulty notes.</p>');
});

test('CSV export and filename', () => {
  const list = [first, second].reduce(
    (acc, item) => recordAccessDifficulty(acc, item),
    [],
  );
  const csv = accessDifficultyCsv(list);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","customer","difficulty type","difficulty","what to do","date noted","noted by","updates"');
  assert.equal(lines.length, 3);
  assert.match(lines[1], /"AD-2","ahmed raza","dog"/);
  assert.equal(accessDifficultyFilename(), 'access-difficulties.csv');
});

test('list normalisation drops bad rows and keeps the first id', () => {
  const list = normalizeAccessDifficultyList([
    first,
    { ...first, difficulty: 'Changed.' },
    { ...first, id: 'AD-9', date: '2026-02-30' },
    'not an object',
    null,
  ]);
  assert.deepEqual(
    list.map((item) => item.id),
    ['AD-1'],
  );
  assert.deepEqual(normalizeAccessDifficultyList('nope'), []);
  assert.deepEqual(normalizeAccessDifficultyList(null), []);
});

test('purity fence: no storage, clock, network, page, or imports', () => {
  const source = readFileSync(
    new URL('../access-difficulty.js', import.meta.url),
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

test('neighbour-module fence: site access permission record is untouched', () => {
  const source = readFileSync(
    new URL('../access-difficulty.js', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /site-access/);
  assert.equal(existsSync(new URL('../site-access.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of [
    'adHeading',
    'adSummary',
    'adCustomer',
    'adType',
    'adDifficulty',
    'adWhatToDo',
    'adDate',
    'adNotedBy',
    'adRecordBtn',
    'adUpdateId',
    'adUpdateDate',
    'adUpdateNote',
    'adUpdateBtn',
    'adRemoveId',
    'adRemoveBtn',
    'adFilterCustomer',
    'adVisitBtn',
    'adVisitBody',
    'adFilterType',
    'adTypeBtn',
    'adTypeBody',
    'adList',
    'adExportBtn',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wires the access difficulty panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(source, /access-difficulty\.js/);
  assert.match(source, /renderAccessDifficulties/);
  assert.match(source, /adRecordBtn/);
});

test('deployment guard: no standalone OLT word in app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /(?<![A-Za-z])OLT(?![A-Za-z])/);
});
