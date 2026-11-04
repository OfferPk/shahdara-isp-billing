import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeOnCallEntry,
  normalizeOnCallList,
  findOnCallEntry,
  upsertOnCallEntry,
  removeOnCallEntry,
  onCallForDate,
  findOnCallOverlaps,
  onCallSummaryText,
  onCallLookupHtml,
  onCallAllHtml,
  onCallOverlapHtml,
  onCallCsv,
  onCallFilename,
} from '../oncall-rota.js';

const dir = dirname(fileURLToPath(import.meta.url));

const entry = (over = {}) => ({
  id: 'R-1',
  person: 'Saad',
  startDate: '2026-11-02',
  endDate: '2026-11-08',
  coverage: 'weekend',
  contactNote: 'Call after 9pm only',
  ...over,
});

test('strict dates: real dates pass, impossible dates refused', () => {
  assert.equal(normalizeOnCallEntry(entry({ startDate: '2026-08-31' })).startDate, '2026-08-31');
  assert.equal(normalizeOnCallEntry(entry({ startDate: '2026-10-31', endDate: '2026-10-31' })).startDate, '2026-10-31');
  assert.equal(normalizeOnCallEntry(entry({ startDate: '2026-12-31', endDate: '2026-12-31' })).startDate, '2026-12-31');
  assert.equal(normalizeOnCallEntry(entry({ startDate: '2026-02-30' })), null);
  assert.equal(normalizeOnCallEntry(entry({ startDate: '2026-04-31' })), null);
  assert.equal(normalizeOnCallEntry(entry({ startDate: '2026-02-29' })), null);
  assert.equal(normalizeOnCallEntry(entry({ startDate: '2024-02-29', endDate: '2024-02-29' })).startDate, '2024-02-29');
});

test('half-formed refusal: no person, no dates, end before start, bad coverage', () => {
  assert.equal(normalizeOnCallEntry(entry({ person: '' })), null);
  assert.equal(normalizeOnCallEntry(entry({ person: '   ' })), null);
  assert.equal(normalizeOnCallEntry(entry({ startDate: '' })), null);
  assert.equal(normalizeOnCallEntry(entry({ endDate: '' })), null);
  assert.equal(normalizeOnCallEntry(entry({ id: '' })), null);
  assert.equal(normalizeOnCallEntry(entry({ startDate: '2026-11-08', endDate: '2026-11-02' })), null);
  assert.equal(normalizeOnCallEntry(entry({ coverage: '' })), null);
  assert.equal(normalizeOnCallEntry(entry({ coverage: 'day' })), null);
  assert.equal(normalizeOnCallEntry(entry({ coverage: 'holiday' })), null);
  assert.equal(normalizeOnCallEntry(entry({ startDate: '2026-11-02', endDate: '2026-11-02' })).endDate, '2026-11-02');
});

test('coverage normalizes case: Night becomes night', () => {
  assert.equal(normalizeOnCallEntry(entry({ coverage: 'Night' })).coverage, 'night');
  assert.equal(normalizeOnCallEntry(entry({ coverage: 'WEEKEND' })).coverage, 'weekend');
});

test('unknown fields dropped, so no message/ticket/payment field can creep in', () => {
  const clean = normalizeOnCallEntry(entry({ ticketId: 'T-9', amount: 500, sendSms: true }));
  assert.deepEqual(Object.keys(clean).sort(), ['contactNote', 'coverage', 'endDate', 'id', 'person', 'startDate']);
});

test('duplicate ids never rewritten: identical re-save unchanged, different figures refused', () => {
  const list = [entry()];
  assert.equal(upsertOnCallEntry(list, entry()).length, 1);
  assert.equal(upsertOnCallEntry(list, entry()).length, 1);
  const changed = upsertOnCallEntry(list, entry({ person: 'Ahmed' }));
  assert.equal(changed.length, 1);
  assert.equal(changed[0].person, 'Saad');
  assert.equal(upsertOnCallEntry(list, entry({ id: 'R-2' })).length, 2);
});

test('find and remove by id; unknown ids leave the list unchanged', () => {
  const list = [entry(), entry({ id: 'R-2', person: 'Ahmed', coverage: 'night', startDate: '2026-11-09', endDate: '2026-11-15' })];
  assert.equal(findOnCallEntry(list, 'R-2').person, 'Ahmed');
  assert.equal(findOnCallEntry(list, 'R-9'), null);
  assert.equal(removeOnCallEntry(list, 'R-1').length, 1);
  assert.equal(removeOnCallEntry(list, 'R-9').length, 2);
});

test('date lookup: covers the period inclusively, person A-Z, coverage filter', () => {
  const list = [
    entry(),
    entry({ id: 'R-2', person: 'Ahmed', coverage: 'night', startDate: '2026-11-02', endDate: '2026-11-08' }),
    entry({ id: 'R-3', person: 'Bilal', coverage: 'weekend', startDate: '2026-11-09', endDate: '2026-11-15' }),
  ];
  const onDate = onCallForDate(list, '2026-11-07');
  assert.deepEqual(onDate.map((item) => item.person), ['Ahmed', 'Saad']);
  assert.deepEqual(onCallForDate(list, '2026-11-07', 'weekend').map((item) => item.person), ['Saad']);
  assert.deepEqual(onCallForDate(list, '2026-11-07', 'night').map((item) => item.person), ['Ahmed']);
  assert.deepEqual(onCallForDate(list, '2026-11-02').map((item) => item.person), ['Ahmed', 'Saad']);
  assert.deepEqual(onCallForDate(list, '2026-11-08').map((item) => item.person), ['Ahmed', 'Saad']);
  assert.deepEqual(onCallForDate(list, '2026-11-16'), []);
  assert.deepEqual(onCallForDate(list, '2026-02-30'), []);
  assert.deepEqual(onCallForDate(list, 'not-a-date'), []);
  assert.deepEqual(onCallForDate(list, '2026-11-07', 'day'), []);
});

test('overlaps flagged only for the same coverage with a shared day', () => {
  const list = [
    entry(),
    entry({ id: 'R-2', person: 'Ahmed', coverage: 'weekend', startDate: '2026-11-07', endDate: '2026-11-14' }),
    entry({ id: 'R-3', person: 'Bilal', coverage: 'night', startDate: '2026-11-07', endDate: '2026-11-14' }),
    entry({ id: 'R-4', person: 'Usman', coverage: 'weekend', startDate: '2026-11-16', endDate: '2026-11-22' }),
  ];
  const pairs = findOnCallOverlaps(list);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].first.id, 'R-1');
  assert.equal(pairs[0].second.id, 'R-2');
  assert.equal(findOnCallOverlaps([entry()]).length, 0);
  assert.equal(findOnCallOverlaps([]).length, 0);
});

test('touching periods share a day and are flagged; abutting periods are not', () => {
  const touching = [
    entry({ startDate: '2026-11-02', endDate: '2026-11-08' }),
    entry({ id: 'R-2', person: 'Ahmed', startDate: '2026-11-08', endDate: '2026-11-14' }),
  ];
  assert.equal(findOnCallOverlaps(touching).length, 1);
  const abutting = [
    entry({ startDate: '2026-11-02', endDate: '2026-11-08' }),
    entry({ id: 'R-2', person: 'Ahmed', startDate: '2026-11-09', endDate: '2026-11-15' }),
  ];
  assert.equal(findOnCallOverlaps(abutting).length, 0);
});

test('summary text counts entries, people, and flagged overlaps', () => {
  const list = [
    entry(),
    entry({ id: 'R-2', person: 'Ahmed', coverage: 'weekend', startDate: '2026-11-07', endDate: '2026-11-14' }),
    entry({ id: 'R-3', person: 'Saad', coverage: 'night', startDate: '2026-11-02', endDate: '2026-11-08' }),
  ];
  assert.equal(onCallSummaryText(list), '3 rota entries for 2 persons, 1 overlapping pair flagged.');
  assert.equal(onCallSummaryText([]), '0 rota entries for 0 persons, 0 overlapping pairs flagged.');
});

test('lookup HTML names the person on call, and says so plainly when nobody is', () => {
  const html = onCallLookupHtml([entry()], '2026-11-07', 'weekend');
  assert.ok(html.includes('Saad'));
  assert.ok(html.includes('2026-11-02'));
  assert.ok(onCallLookupHtml([entry()], '2026-11-16').includes('Nobody is on call'));
});

test('full rota HTML earliest first; overlap HTML flags pairs and clears when clean', () => {
  const list = [
    entry({ id: 'R-2', person: 'Ahmed', startDate: '2026-11-09', endDate: '2026-11-15' }),
    entry(),
  ];
  const all = onCallAllHtml(list);
  assert.ok(all.indexOf('Saad') < all.indexOf('Ahmed'));
  assert.ok(onCallAllHtml([]).includes('No rota entries'));
  const overlap = onCallOverlapHtml(list);
  assert.ok(overlap.includes('No overlapping entries'));
  const flagged = onCallOverlapHtml([
    entry(),
    entry({ id: 'R-2', person: 'Ahmed', startDate: '2026-11-07', endDate: '2026-11-14' }),
  ]);
  assert.ok(flagged.includes('R-1'));
  assert.ok(flagged.includes('R-2'));
});

test('HTML escaping: a person name with markup is shown as text, not run', () => {
  const html = onCallLookupHtml([entry({ person: '<script>alert(1)</script>' })], '2026-11-07');
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('CSV export and filename', () => {
  const csv = onCallCsv([entry(), entry({ id: 'R-2', person: 'Ahmed, Jr', contactNote: 'Say "hello"' })]);
  assert.ok(csv.startsWith('id,person,startDate,endDate,coverage,contactNote\n'));
  assert.ok(csv.includes('"Ahmed, Jr"'));
  assert.ok(csv.includes('"Say ""hello"""'));
  assert.equal(onCallFilename(), 'on-call-rota.csv');
});

test('inputs never mutated', () => {
  const raw = entry({ extra: 'drop me' });
  const snapshot = JSON.stringify(raw);
  normalizeOnCallList([raw]);
  upsertOnCallEntry([raw], entry({ id: 'R-2' }));
  onCallForDate([raw], '2026-11-07');
  findOnCallOverlaps([raw]);
  assert.equal(JSON.stringify(raw), snapshot);
});

test('purity fence: module never imports, reads storage, or touches the clock', () => {
  const src = readFileSync(join(dir, '..', 'oncall-rota.js'), 'utf8');
  assert.ok(!/^import /m.test(src));
  assert.ok(!src.includes('localStorage'));
  assert.ok(!src.includes('Date.now'));
  assert.ok(!src.includes('fetch('));
});

test('panel ids present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['onCallPerson', 'onCallStart', 'onCallEnd', 'onCallCoverage', 'onCallContact', 'onCallSaveBtn', 'onCallRemoveId', 'onCallRemoveBtn', 'onCallLookupDate', 'onCallLookupCoverage', 'onCallLookupBody', 'onCallOverlapBody', 'onCallBody', 'onCallSummary', 'onCallExportBtn']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
