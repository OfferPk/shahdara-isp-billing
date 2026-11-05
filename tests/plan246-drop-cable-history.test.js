// Plan 246 — Drop cable replacement history per customer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validDropCableHistoryDate,
  normalizeDropCableHistoryList,
  recordDropCableReplacement,
  removeDropCableReplacement,
  findDropCableReplacement,
  addDropCableHistoryFollowUp,
  dropCableHistorySorted,
  dropCableReplacementsForCustomer,
  flaggedDropCableCustomers,
  dropCableHistorySummaryText,
  dropCableHistoryText,
  dropCableHistoryHtml,
  dropCableHistoryCsv,
  dropCableHistoryFilename,
} from '../drop-cable-history.js';

const first = {
  id: 'DCH-1',
  customer: 'Ahmed Raza',
  date: '2026-11-05',
  reason: 'Cable chafed where it crosses the roof edge.',
  cableLengthM: 25,
  replacedBy: 'Saad',
};

const second = {
  id: 'DCH-2',
  customer: 'ahmed raza',
  date: '2026-11-04',
  reason: 'Old cable sagged and snapped in the wind.',
  cableLengthM: 30,
  replacedBy: 'Bilal',
};

const third = {
  id: 'DCH-3',
  customer: 'Fatima Noor',
  date: '2026-11-06',
  reason: 'Connector corroded after the rain.',
  cableLengthM: null,
  replacedBy: 'Saad',
};

test('half-formed replacement entries are refused', () => {
  assert.equal(recordDropCableReplacement([], { ...first, id: '' }), null);
  assert.equal(recordDropCableReplacement([], { ...first, customer: '  ' }), null);
  assert.equal(recordDropCableReplacement([], { ...first, reason: '' }), null);
  assert.equal(recordDropCableReplacement([], { ...first, replacedBy: '' }), null);
  assert.equal(recordDropCableReplacement([], { ...first, date: '2026-02-30' }), null);
  assert.equal(recordDropCableReplacement([], { ...first, date: '2026-13-01' }), null);
});

test('strict dates: leap days and month lengths', () => {
  assert.equal(validDropCableHistoryDate('2024-02-29'), true);
  assert.equal(validDropCableHistoryDate('2025-02-29'), false);
  assert.equal(validDropCableHistoryDate('2026-04-31'), false);
  assert.equal(validDropCableHistoryDate('2026-08-31'), true);
  assert.equal(validDropCableHistoryDate('2026-11-05'), true);
  assert.equal(validDropCableHistoryDate('05-11-2026'), false);
  assert.equal(validDropCableHistoryDate(''), false);
  assert.equal(validDropCableHistoryDate(null), false);
});

test('cable length is kept only when known and positive', () => {
  const kept = recordDropCableReplacement([], { ...first, cableLengthM: '40' });
  assert.equal(kept[0].cableLengthM, 40);
  const unknown = recordDropCableReplacement([], { ...first, cableLengthM: '' });
  assert.equal(unknown[0].cableLengthM, null);
  const negative = recordDropCableReplacement([], { ...first, cableLengthM: -5 });
  assert.equal(negative[0].cableLengthM, null);
  const nonsense = recordDropCableReplacement([], { ...first, cableLengthM: 'long' });
  assert.equal(nonsense[0].cableLengthM, null);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const input = { ...first, surprise: 'extra', followUps: [{ date: '2026-11-07', note: 'Checked the fitting.', junk: 1 }] };
  const frozen = JSON.parse(JSON.stringify(input));
  const out = recordDropCableReplacement([], input);
  assert.equal(out[0].surprise, undefined);
  assert.equal(out[0].followUps[0].junk, undefined);
  assert.deepEqual(input, frozen);
  assert.deepEqual(normalizeDropCableHistoryList('nope'), []);
  assert.deepEqual(normalizeDropCableHistoryList(null), []);
});

test('duplicate ids are never rewritten', () => {
  const base = recordDropCableReplacement([], first);
  const again = recordDropCableReplacement(base, { ...first, reason: 'Different reason.' });
  assert.equal(again.length, 1);
  assert.equal(again[0].reason, first.reason);
});

test('find and remove work by id', () => {
  const base = recordDropCableReplacement(recordDropCableReplacement([], first), second);
  assert.equal(findDropCableReplacement(base, 'DCH-2').customer, 'ahmed raza');
  assert.equal(findDropCableReplacement(base, 'DCH-9'), null);
  assert.equal(removeDropCableReplacement(base, 'DCH-1').length, 1);
  assert.equal(removeDropCableReplacement(base, 'DCH-9').length, 2);
});

test('replacements sort by date, then customer, then id', () => {
  const base = [third, first, second];
  const sorted = dropCableHistorySorted(base);
  assert.deepEqual(sorted.map((item) => item.id), ['DCH-2', 'DCH-1', 'DCH-3']);
});

test('per-customer listing is case-insensitive and in date order', () => {
  const base = [third, first, second];
  const rows = dropCableReplacementsForCustomer(base, 'AHMED RAZA');
  assert.deepEqual(rows.map((item) => item.id), ['DCH-2', 'DCH-1']);
  assert.deepEqual(dropCableReplacementsForCustomer(base, ''), []);
  assert.deepEqual(dropCableReplacementsForCustomer(base, 'Nobody'), []);
});

test('a customer with two or more replacements is flagged', () => {
  const base = [third, first, second];
  const flagged = flaggedDropCableCustomers(base);
  assert.equal(flagged.length, 1);
  assert.equal(flagged[0].customer, 'Ahmed Raza');
  assert.equal(flagged[0].count, 2);
  assert.deepEqual(flaggedDropCableCustomers([third]), []);
  const twoMore = recordDropCableReplacement(
    recordDropCableReplacement(base, { ...third, id: 'DCH-4', date: '2026-11-07' }),
    { id: 'DCH-5', customer: 'fatima noor', date: '2026-11-08', reason: 'Cable cut by a falling branch.', cableLengthM: 20, replacedBy: 'Saad' },
  );
  const ranked = flaggedDropCableCustomers(twoMore);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].customer, 'Fatima Noor');
  assert.equal(ranked[0].count, 3);
});

test('follow-up notes never rewrite the original entry', () => {
  const base = recordDropCableReplacement([], first);
  const next = addDropCableHistoryFollowUp(base, 'DCH-1', { date: '2026-11-07', note: 'Fitting tightened so it does not chafe again.' });
  assert.equal(next[0].reason, first.reason);
  assert.equal(next[0].date, first.date);
  assert.equal(next[0].cableLengthM, 25);
  assert.equal(next[0].followUps.length, 1);
  assert.equal(next[0].followUps[0].note, 'Fitting tightened so it does not chafe again.');
  assert.equal(addDropCableHistoryFollowUp(base, 'DCH-1', { date: '2026-02-30', note: 'Bad date.' }), base);
  assert.equal(addDropCableHistoryFollowUp(base, 'DCH-1', { date: '2026-11-07', note: '' }), base);
  assert.equal(addDropCableHistoryFollowUp(base, 'DCH-9', { date: '2026-11-07', note: 'Unknown id.' }), base);
});

test('summary text names the flagged customers', () => {
  const base = [third, first, second];
  const summary = dropCableHistorySummaryText(base);
  assert.match(summary, /3 drop cable replacements for 2 customers/);
  assert.match(summary, /Ahmed Raza \(2\)/);
  assert.match(dropCableHistorySummaryText([third]), /No customer has two or more replacements/);
  assert.match(dropCableHistorySummaryText([]), /0 drop cable replacements for 0 customers/);
});

test('entry text states reason, length, and follow-up state', () => {
  const text = dropCableHistoryText(first);
  assert.match(text, /Ahmed Raza/);
  assert.match(text, /2026-11-05/);
  assert.match(text, /Saad/);
  assert.match(text, /25 m of cable used/);
  assert.match(text, /No follow-up notes yet/);
  assert.match(dropCableHistoryText(third), /Cable length not recorded/);
  assert.equal(dropCableHistoryText({ ...first, date: '2026-02-30' }), '');
});

test('HTML escapes user text', () => {
  const base = recordDropCableReplacement([], { ...first, reason: '<b>bad</b> & "quoted"' });
  const html = dropCableHistoryHtml(base);
  assert.doesNotMatch(html, /<b>bad<\/b>/);
  assert.match(html, /&lt;b&gt;bad&lt;\/b&gt;/);
  assert.equal(dropCableHistoryHtml([]), '<p>No drop cable replacements recorded.</p>');
});

test('CSV export has the right filename and columns', () => {
  const base = [third, first, second];
  const csv = dropCableHistoryCsv(base);
  const lines = csv.split('\n');
  assert.equal(lines.length, 4);
  assert.match(lines[0], /"customer","date","reason","cable length \(m\)","replaced by"/);
  assert.match(lines[1], /"ahmed raza","2026-11-04"/);
  assert.equal(dropCableHistoryFilename(), 'drop-cable-histories.csv');
});

test('list normalisation drops bad rows and duplicate ids', () => {
  const mixed = [first, { ...first, reason: 'Duplicate id.' }, { ...second, date: 'bad' }, null, 'nope', third];
  const clean = normalizeDropCableHistoryList(mixed);
  assert.deepEqual(clean.map((item) => item.id), ['DCH-1', 'DCH-3']);
});

test('purity fence: no storage, clock, network, page, or imports', () => {
  const source = readFileSync(
    new URL('../drop-cable-history.js', import.meta.url),
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

test('neighbour-module fence: drop cable condition record is untouched', () => {
  const source = readFileSync(
    new URL('../drop-cable-history.js', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /drop-cable\.js/);
  assert.equal(existsSync(new URL('../drop-cable.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of [
    'dchHeading',
    'dchSummary',
    'dchCustomer',
    'dchDate',
    'dchReason',
    'dchLength',
    'dchReplacedBy',
    'dchRecordBtn',
    'dchFollowUpId',
    'dchFollowUpDate',
    'dchFollowUpNote',
    'dchFollowUpBtn',
    'dchRemoveId',
    'dchRemoveBtn',
    'dchFilterCustomer',
    'dchCustomerBtn',
    'dchCustomerBody',
    'dchFlaggedBody',
    'dchList',
    'dchExportBtn',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wires the drop cable history panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(source, /drop-cable-history\.js/);
  assert.match(source, /renderDropCableHistories/);
  assert.match(source, /dchRecordBtn/);
});

test('deployment guard: no standalone OLT word in app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /(?<![A-Za-z])OLT(?![A-Za-z])/);
});
