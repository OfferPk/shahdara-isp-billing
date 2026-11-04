import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeWorkaround,
  normalizeWorkaroundList,
  findWorkaround,
  upsertWorkaround,
  removeWorkaround,
  recordWorkaroundRemoval,
  openWorkarounds,
  overdueWorkarounds,
  workaroundSummaryText,
  workaroundOpenHtml,
  workaroundOverdueHtml,
  workaroundCsv,
  workaroundFilename,
} from '../workaround.js';

const dir = dirname(fileURLToPath(import.meta.url));

const item = (over = {}) => ({
  id: 'W-1',
  link: 'T-101',
  fittedDate: '2026-10-01',
  description: 'Jumper bypass on the road span',
  plannedRemovalDate: '2026-10-15',
  removalDate: '',
  ...over,
});

test('strict dates: real dates pass, impossible dates refused', () => {
  assert.equal(normalizeWorkaround(item({ fittedDate: '2026-08-31' })).fittedDate, '2026-08-31');
  assert.equal(normalizeWorkaround(item({ fittedDate: '2026-10-31' })).fittedDate, '2026-10-31');
  assert.equal(normalizeWorkaround(item({ fittedDate: '2026-12-31' })).fittedDate, '2026-12-31');
  assert.equal(normalizeWorkaround(item({ fittedDate: '2026-02-30' })), null);
  assert.equal(normalizeWorkaround(item({ fittedDate: '2026-04-31' })), null);
  assert.equal(normalizeWorkaround(item({ plannedRemovalDate: '2026-02-29' })), null);
  assert.equal(normalizeWorkaround(item({ fittedDate: '2024-02-29' })).fittedDate, '2024-02-29');
});

test('half-formed records refused: no link, no date, no description, no planned date', () => {
  assert.equal(normalizeWorkaround(item({ link: '  ' })), null);
  assert.equal(normalizeWorkaround(item({ fittedDate: '' })), null);
  assert.equal(normalizeWorkaround(item({ description: '' })), null);
  assert.equal(normalizeWorkaround(item({ plannedRemovalDate: '' })), null);
  assert.equal(normalizeWorkaround(item({ id: '' })), null);
  assert.equal(normalizeWorkaround(null), null);
  assert.deepEqual(normalizeWorkaroundList([item(), item({ link: '' }), item({ id: 'W-2', link: 'SEG-A' })]).map((row) => row.id), ['W-1', 'W-2']);
});

test('unknown fields dropped, so no ticket-status, bill, or payment field can creep in', () => {
  const clean = normalizeWorkaround(item({ ticketStatus: 'closed', billId: 'B-1', payment: 500, status: 'done' }));
  assert.deepEqual(Object.keys(clean).sort(), ['description', 'fittedDate', 'id', 'link', 'plannedRemovalDate', 'removalDate']);
});

test('duplicate ids never rewritten: identical re-save unchanged, different figures refused', () => {
  const base = upsertWorkaround([], item());
  assert.equal(upsertWorkaround(base, item()).length, 1);
  assert.equal(upsertWorkaround(base, item({ description: 'Different bypass' })).length, 1);
  assert.equal(upsertWorkaround(base, item({ description: 'Different bypass' }))[0].description, 'Jumper bypass on the road span');
  assert.equal(upsertWorkaround(base, item({ id: 'W-2', link: 'SEG-B' })).length, 2);
});

test('find and remove', () => {
  const list = [item(), item({ id: 'W-2', link: 'SEG-A' })];
  assert.equal(findWorkaround(list, 'W-2').link, 'SEG-A');
  assert.equal(findWorkaround(list, 'W-9'), null);
  assert.deepEqual(removeWorkaround(list, 'W-1').map((row) => row.id), ['W-2']);
  assert.equal(removeWorkaround(list, 'W-9').length, 2);
});

test('recording a removal clears the item; bad removals refused', () => {
  const list = [item()];
  const removed = recordWorkaroundRemoval(list, 'W-1', '2026-10-10');
  assert.equal(removed[0].removalDate, '2026-10-10');
  assert.equal(recordWorkaroundRemoval(list, 'W-9', '2026-10-10').length, 1);
  assert.equal(recordWorkaroundRemoval(list, 'W-9', '2026-10-10')[0].removalDate, '');
  assert.equal(recordWorkaroundRemoval(list, 'W-1', '2026-02-30')[0].removalDate, '');
  assert.equal(recordWorkaroundRemoval(list, 'W-1', '2026-09-01')[0].removalDate, '');
  assert.equal(recordWorkaroundRemoval(removed, 'W-1', '2026-10-12')[0].removalDate, '2026-10-10');
});

test('removal date before fitted date refused at normalize time', () => {
  assert.equal(normalizeWorkaround(item({ removalDate: '2026-09-15' })), null);
  assert.equal(normalizeWorkaround(item({ removalDate: '2026-10-01' })).removalDate, '2026-10-01');
});

test('open list: only unremoved, planned removal date first then id', () => {
  const list = [
    item({ id: 'W-3', plannedRemovalDate: '2026-10-20' }),
    item({ id: 'W-1', plannedRemovalDate: '2026-10-10' }),
    item({ id: 'W-2', plannedRemovalDate: '2026-10-10', removalDate: '2026-10-05' }),
    item({ id: 'W-4', plannedRemovalDate: '2026-10-10' }),
  ];
  assert.deepEqual(openWorkarounds(list).map((row) => row.id), ['W-1', 'W-4', 'W-3']);
});

test('overdue list: open and planned before reference, earliest first; invalid reference empty', () => {
  const list = [
    item({ id: 'W-1', plannedRemovalDate: '2026-10-05' }),
    item({ id: 'W-2', plannedRemovalDate: '2026-10-12' }),
    item({ id: 'W-3', plannedRemovalDate: '2026-10-01', removalDate: '2026-10-02' }),
    item({ id: 'W-4', plannedRemovalDate: '2026-10-20' }),
  ];
  assert.deepEqual(overdueWorkarounds(list, '2026-10-15').map((row) => row.id), ['W-1', 'W-2']);
  assert.deepEqual(overdueWorkarounds(list, '2026-10-05'), []);
  assert.deepEqual(overdueWorkarounds(list, 'not-a-date'), []);
  assert.deepEqual(overdueWorkarounds(list, ''), []);
});

test('summary text counts open, overdue, removed', () => {
  const list = [
    item({ id: 'W-1', plannedRemovalDate: '2026-10-05' }),
    item({ id: 'W-2', plannedRemovalDate: '2026-10-20' }),
    item({ id: 'W-3', removalDate: '2026-10-02' }),
  ];
  assert.equal(workaroundSummaryText(list, '2026-10-15'), '3 workarounds recorded; 2 still open, 1 overdue, 1 removed.');
  assert.equal(workaroundSummaryText([], '2026-10-15'), '0 workarounds recorded; 0 still open, 0 overdue, 0 removed.');
});

test('open HTML flags overdue rows and says plainly when empty', () => {
  const list = [item({ id: 'W-1', plannedRemovalDate: '2026-10-05' }), item({ id: 'W-2', plannedRemovalDate: '2026-10-20' })];
  const html = workaroundOpenHtml(list, '2026-10-15');
  assert.match(html, /OVERDUE/);
  assert.match(html, /W-2/);
  assert.match(workaroundOpenHtml([], '2026-10-15'), /No open temporary workarounds/);
});

test('overdue HTML lists overdue only, newest-first rule does not apply here', () => {
  const list = [
    item({ id: 'W-1', plannedRemovalDate: '2026-10-05' }),
    item({ id: 'W-2', plannedRemovalDate: '2026-10-03' }),
    item({ id: 'W-3', plannedRemovalDate: '2026-10-20' }),
  ];
  const html = workaroundOverdueHtml(list, '2026-10-15');
  assert.ok(html.indexOf('W-2') < html.indexOf('W-1'));
  assert.doesNotMatch(html, /W-3/);
  assert.match(workaroundOverdueHtml([], '2026-10-15'), /No overdue temporary workarounds/);
});

test('HTML escaping: markup in description is escaped, not rendered', () => {
  const html = workaroundOpenHtml([item({ description: '<script>alert(1)</script>' })], '2026-10-15');
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('CSV and filename', () => {
  const csv = workaroundCsv([item(), item({ id: 'W-2', link: 'SEG-A', description: 'Fix, with "quotes"' })]);
  assert.ok(csv.startsWith('id,link,fittedDate,description,plannedRemovalDate,removalDate\n'));
  assert.match(csv, /"Fix, with ""quotes"""/);
  assert.equal(workaroundFilename(), 'temporary-workarounds.csv');
});

test('inputs never mutated', () => {
  const record = item();
  const before = JSON.stringify(record);
  upsertWorkaround([], record);
  recordWorkaroundRemoval([record], 'W-1', '2026-10-10');
  removeWorkaround([record], 'W-1');
  assert.equal(JSON.stringify(record), before);
});

test('purity fence: module reads no storage, clock, network, or other module', () => {
  const source = readFileSync(join(dir, '..', 'workaround.js'), 'utf8');
  assert.doesNotMatch(source, /localStorage|sessionStorage|Date\.now|fetch\(|require\(|from '\.\//);
  assert.doesNotMatch(source, /ticketStatus|billId|payment:/);
});

test('panel ids present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of [
    'workaroundLink', 'workaroundFittedDate', 'workaroundDescription', 'workaroundPlannedDate',
    'workaroundSaveBtn', 'workaroundRemovalId', 'workaroundRemovalDate', 'workaroundRemovalBtn',
    'workaroundRemoveId', 'workaroundRemoveBtn', 'workaroundOpenBody', 'workaroundOverdueBody',
    'workaroundSummary', 'workaroundExportBtn', 'workaroundReferenceDate',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
