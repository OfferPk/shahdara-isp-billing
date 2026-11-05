// Plan 247 — ONU replacement reason log.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validOnuReplacementDate,
  normalizeOnuReplacementList,
  recordOnuReplacement,
  removeOnuReplacement,
  findOnuReplacement,
  addOnuReplacementFollowUp,
  onuReplacementSorted,
  onuReplacementsForCustomer,
  onuReplacementsForReason,
  onuReplacementReasonCounts,
  repeatedOnuReplacementReasons,
  onuReplacementSummaryText,
  onuReplacementText,
  onuReplacementHtml,
  onuReplacementCsv,
  onuReplacementFilename,
} from '../onu-replacement.js';

const first = {
  id: 'ONU-1',
  customer: 'Ahmed Raza',
  oldUnit: 'ONU-A101',
  newUnit: 'ONU-B205',
  reason: 'Power damage after a surge.',
  date: '2026-11-05',
  replacedBy: 'Saad',
};

const second = {
  id: 'ONU-2',
  customer: 'ahmed raza',
  oldUnit: 'ONU-B205',
  newUnit: 'ONU-C310',
  reason: 'power damage after a surge.',
  date: '2026-11-04',
  replacedBy: 'Bilal',
};

const third = {
  id: 'ONU-3',
  customer: 'Fatima Noor',
  oldUnit: 'ONU-D400',
  newUnit: 'ONU-E512',
  reason: 'Unit stopped responding.',
  date: '2026-11-06',
  replacedBy: 'Saad',
};

test('half-formed replacement entries are refused', () => {
  assert.equal(recordOnuReplacement([], { ...first, id: '' }), null);
  assert.equal(recordOnuReplacement([], { ...first, customer: '  ' }), null);
  assert.equal(recordOnuReplacement([], { ...first, oldUnit: '' }), null);
  assert.equal(recordOnuReplacement([], { ...first, newUnit: '' }), null);
  assert.equal(recordOnuReplacement([], { ...first, reason: '' }), null);
  assert.equal(recordOnuReplacement([], { ...first, replacedBy: '' }), null);
  assert.equal(recordOnuReplacement([], { ...first, date: '2026-02-30' }), null);
  assert.equal(recordOnuReplacement([], { ...first, date: '2026-13-01' }), null);
});

test('strict dates: leap days and month lengths', () => {
  assert.equal(validOnuReplacementDate('2024-02-29'), true);
  assert.equal(validOnuReplacementDate('2025-02-29'), false);
  assert.equal(validOnuReplacementDate('2026-04-31'), false);
  assert.equal(validOnuReplacementDate('2026-08-31'), true);
  assert.equal(validOnuReplacementDate('2026-11-05'), true);
  assert.equal(validOnuReplacementDate('05-11-2026'), false);
  assert.equal(validOnuReplacementDate(''), false);
  assert.equal(validOnuReplacementDate(null), false);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const input = { ...first, surprise: 'x', followUps: 'nope' };
  const snapshot = JSON.stringify(input);
  const list = recordOnuReplacement([], input);
  assert.equal(list.length, 1);
  assert.equal('surprise' in list[0], false);
  assert.deepEqual(list[0].followUps, []);
  assert.equal(JSON.stringify(input), snapshot);
});

test('duplicate ids are never rewritten', () => {
  const list = recordOnuReplacement([first], { ...third, id: 'ONU-1' });
  assert.equal(list.length, 1);
  assert.equal(list[0].reason, first.reason);
});

test('find and remove work by id', () => {
  const list = [first, second, third];
  assert.equal(findOnuReplacement(list, 'ONU-2').newUnit, 'ONU-C310');
  assert.equal(findOnuReplacement(list, 'ONU-9'), null);
  const kept = removeOnuReplacement(list, 'ONU-2');
  assert.deepEqual(
    kept.map((item) => item.id),
    ['ONU-1', 'ONU-3'],
  );
});

test('replacements sort by date, then customer, then id', () => {
  const sorted = onuReplacementSorted([third, first, second]);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ['ONU-2', 'ONU-1', 'ONU-3'],
  );
});

test('per-customer listing is case-insensitive and in date order', () => {
  const rows = onuReplacementsForCustomer([third, first, second], 'AHMED RAZA');
  assert.deepEqual(
    rows.map((item) => item.id),
    ['ONU-2', 'ONU-1'],
  );
  assert.deepEqual(onuReplacementsForCustomer([first], ''), []);
});

test('per-reason listing is case-insensitive and in date order', () => {
  const rows = onuReplacementsForReason(
    [third, first, second],
    'POWER DAMAGE AFTER A SURGE.',
  );
  assert.deepEqual(
    rows.map((item) => item.id),
    ['ONU-2', 'ONU-1'],
  );
  assert.deepEqual(onuReplacementsForReason([first], 'other reason'), []);
});

test('reason counts group case-insensitively and keep the first spelling', () => {
  const counts = onuReplacementReasonCounts([third, first, second]);
  assert.equal(counts.length, 2);
  assert.equal(counts[0].reason, 'Power damage after a surge.');
  assert.equal(counts[0].count, 2);
  assert.equal(counts[1].reason, 'Unit stopped responding.');
  assert.equal(counts[1].count, 1);
});

test('a repeated reason is listed, most first', () => {
  const repeated = repeatedOnuReplacementReasons([third, first, second]);
  assert.deepEqual(repeated, [
    { reason: 'Power damage after a surge.', count: 2 },
  ]);
  assert.deepEqual(repeatedOnuReplacementReasons([third]), []);
});

test('follow-up notes never rewrite the original entry', () => {
  const withNote = addOnuReplacementFollowUp([first], 'ONU-1', {
    date: '2026-11-07',
    note: 'New unit checked, signal steady.',
  });
  assert.equal(withNote[0].oldUnit, 'ONU-A101');
  assert.equal(withNote[0].newUnit, 'ONU-B205');
  assert.equal(withNote[0].reason, first.reason);
  assert.equal(withNote[0].followUps.length, 1);
  assert.equal(withNote[0].followUps[0].date, '2026-11-07');
  // A bad follow-up leaves the list untouched.
  assert.deepEqual(
    addOnuReplacementFollowUp([first], 'ONU-1', { date: '2026-02-30', note: 'x' }),
    [first],
  );
  assert.deepEqual(
    addOnuReplacementFollowUp([first], 'ONU-9', {
      date: '2026-11-07',
      note: 'x',
    }),
    [first],
  );
});

test('summary text names the repeated reasons', () => {
  assert.equal(
    onuReplacementSummaryText([third, first, second]),
    '3 ONU replacements for 2 customers. 1 reason repeats: Power damage after a surge. (2).',
  );
  assert.equal(
    onuReplacementSummaryText([third]),
    '1 ONU replacement for 1 customer. No reason repeats.',
  );
  assert.equal(
    onuReplacementSummaryText([]),
    '0 ONU replacements for 0 customers. No reason repeats.',
  );
});

test('entry text names both units and the follow-up state', () => {
  assert.equal(
    onuReplacementText(first),
    'Ahmed Raza — ONU ONU-A101 replaced by ONU-B205 on 2026-11-05 by Saad: Power damage after a surge. No follow-up notes yet.',
  );
  const withNote = addOnuReplacementFollowUp([first], 'ONU-1', {
    date: '2026-11-07',
    note: 'Checked, signal steady.',
  });
  assert.match(onuReplacementText(withNote[0]), /1 dated follow-up note, latest 2026-11-07\./);
  assert.equal(onuReplacementText({ ...first, reason: '' }), '');
});

test('HTML escapes user text', () => {
  const html = onuReplacementHtml([
    { ...first, reason: '<b>bad</b> & "quoted"' },
  ]);
  assert.doesNotMatch(html, /<b>bad<\/b>/);
  assert.match(html, /&lt;b&gt;bad&lt;\/b&gt; &amp; &quot;quoted&quot;/);
  assert.equal(
    onuReplacementHtml([]),
    '<p>No ONU replacements recorded.</p>',
  );
});

test('CSV export has the right filename and columns', () => {
  assert.equal(onuReplacementFilename(), 'onu-replacements.csv');
  const csv = onuReplacementCsv([first, third]);
  const lines = csv.split('\n');
  assert.equal(
    lines[0],
    '"id","customer","old unit","new unit","reason","date","replaced by","follow-up notes"',
  );
  assert.equal(lines.length, 3);
  assert.match(lines[1], /"ONU-A101","ONU-B205"/);
  assert.match(lines[2], /"ONU-D400","ONU-E512"/);
});

test('list normalisation drops bad rows and duplicate ids', () => {
  const list = normalizeOnuReplacementList([
    first,
    { ...second, id: 'ONU-1' },
    { ...third, date: 'not-a-date' },
    null,
    'junk',
  ]);
  assert.deepEqual(
    list.map((item) => item.id),
    ['ONU-1'],
  );
  assert.deepEqual(normalizeOnuReplacementList('nope'), []);
});

test('purity fence: no storage, clock, network, page, or imports', () => {
  const source = readFileSync(
    new URL('../onu-replacement.js', import.meta.url),
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

test('neighbour-module fence: premises equipment check and swap pairing are untouched', () => {
  const source = readFileSync(
    new URL('../onu-replacement.js', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /premises-check\.js/);
  assert.doesNotMatch(source, /swap-pairing\.js/);
  assert.equal(existsSync(new URL('../premises-check.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../swap-pairing.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of [
    'orHeading',
    'orSummary',
    'orCustomer',
    'orOldUnit',
    'orNewUnit',
    'orReason',
    'orDate',
    'orReplacedBy',
    'orRecordBtn',
    'orFollowUpId',
    'orFollowUpDate',
    'orFollowUpNote',
    'orFollowUpBtn',
    'orRemoveId',
    'orRemoveBtn',
    'orFilterCustomer',
    'orCustomerBtn',
    'orCustomerBody',
    'orFilterReason',
    'orReasonBtn',
    'orReasonBody',
    'orRepeatBody',
    'orList',
    'orExportBtn',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wires the ONU replacement panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(source, /onu-replacement\.js/);
  assert.match(source, /renderOnuReplacements/);
  assert.match(source, /orRecordBtn/);
});

test('deployment guard: no standalone OLT word in app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /(?<![A-Za-z])OLT(?![A-Za-z])/);
});
