import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validDataConflictDay,
  foldDataConflictResolution,
  normalizeDataConflict,
  normalizeDataConflictList,
  findDataConflict,
  recordDataConflict,
  resolveDataConflict,
  openDataConflicts,
  dataConflictsForRecord,
  dataConflictRecords,
  dataConflictSummaryText,
  dataConflictResolutionText,
  dataConflictNoteText,
  dataConflictNoteHtml,
  dataConflictsHtml,
  openDataConflictsHtml,
  dataConflictCsv,
  dataConflictFilename,
} from '../offline-data-conflict.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');

function note(id, overrides = {}) {
  return {
    id,
    recordRef: 'Customer CUST-12 — bill Nov 2026',
    field: 'amount',
    fieldValue: 'Rs 3000',
    shopValue: 'Rs 2500',
    resolution: 'unresolved',
    resolver: '',
    date: '2026-11-06',
    ...overrides,
  };
}

function fixture() {
  return [
    note('ODC-1', { date: '2026-11-05' }),
    note('ODC-2', { fieldValue: 'Rs 2800', date: '2026-11-06' }),
    note('ODC-3', { recordRef: 'Customer CUST-36 — package', field: 'package', fieldValue: '15 Mbps', shopValue: '5 Mbps', resolution: 'field', resolver: 'Saad', date: '2026-11-06' }),
    note('ODC-4', { recordRef: 'Customer CUST-41 — area', field: 'mohalla', fieldValue: 'Shahdara', shopValue: '', resolution: 'shop', resolver: 'Owner', date: '2026-11-04' }),
  ];
}

test('strict days accept real calendar days and reject impossible ones', () => {
  assert.equal(validDataConflictDay('2026-11-06'), true);
  assert.equal(validDataConflictDay('2028-02-29'), true);
  assert.equal(validDataConflictDay('2026-08-31'), true);
  assert.equal(validDataConflictDay('2026-02-30'), false);
  assert.equal(validDataConflictDay('2026-11-31'), false);
  assert.equal(validDataConflictDay('2027-02-29'), false);
  assert.equal(validDataConflictDay('2026-13-01'), false);
  assert.equal(validDataConflictDay('2026-11-6'), false);
  assert.equal(validDataConflictDay('06-11-2026'), false);
  assert.equal(validDataConflictDay(20261106), false);
  assert.equal(validDataConflictDay(''), false);
});

test('resolution folds to field, shop, merged, or unresolved', () => {
  assert.equal(foldDataConflictResolution('field'), 'field');
  assert.equal(foldDataConflictResolution(' SHOP '), 'shop');
  assert.equal(foldDataConflictResolution('Merged'), 'merged');
  assert.equal(foldDataConflictResolution(''), 'unresolved');
  assert.equal(foldDataConflictResolution('delete'), 'unresolved');
  assert.equal(foldDataConflictResolution(undefined), 'unresolved');
});

test('a full note normalizes and unknown fields are dropped', () => {
  const clean = normalizeDataConflict(note('ODC-1', { extraField: 'dropped', amount: 3000 }));
  assert.deepEqual(clean, note('ODC-1'));
  assert.equal('extraField' in clean, false);
  assert.equal('amount' in clean, false);
});

test('half-formed notes are refused', () => {
  assert.equal(normalizeDataConflict(note('ODC-1', { id: '' })), null);
  assert.equal(normalizeDataConflict(note('ODC-1', { recordRef: '  ' })), null);
  assert.equal(normalizeDataConflict(note('ODC-1', { field: '' })), null);
  assert.equal(normalizeDataConflict(note('ODC-1', { date: '2026-02-30' })), null);
  assert.equal(normalizeDataConflict(note('ODC-1', { fieldValue: 3000 })), null);
  assert.equal(normalizeDataConflict(note('ODC-1', { shopValue: undefined })), null);
  assert.equal(normalizeDataConflict({ id: 'ODC-1' }), null);
  assert.equal(normalizeDataConflict(null), null);
  assert.equal(normalizeDataConflict([note('ODC-1')]), null);
});

test('a note that names a winner must name who decided it', () => {
  assert.equal(normalizeDataConflict(note('ODC-1', { resolution: 'field', resolver: '' })), null);
  assert.equal(normalizeDataConflict(note('ODC-1', { resolution: 'shop', resolver: '  ' })), null);
  assert.deepEqual(normalizeDataConflict(note('ODC-1', { resolution: 'field', resolver: 'Saad' })).resolution, 'field');
  assert.deepEqual(normalizeDataConflict(note('ODC-1', { resolution: 'unresolved', resolver: '' })).resolution, 'unresolved');
});

test('a blank value is a real value, not a missing one', () => {
  const clean = normalizeDataConflict(note('ODC-1', { shopValue: '' }));
  assert.equal(clean.shopValue, '');
  assert.equal(dataConflictNoteText(clean).includes('shop "blank"'), true);
});

test('a list normalizes, dedupes by id, and drops invalid entries', () => {
  const list = normalizeDataConflictList([note('ODC-1'), note('ODC-1', { date: '2026-11-07' }), note('ODC-2', { date: 'bad' }), note('ODC-3')]);
  assert.deepEqual(list.map((entry) => entry.id), ['ODC-1', 'ODC-3']);
  assert.equal(list[0].date, '2026-11-06');
  assert.deepEqual(normalizeDataConflictList('not a list'), []);
  assert.deepEqual(normalizeDataConflictList(null), []);
});

test('find returns the note or null', () => {
  assert.equal(findDataConflict(fixture(), 'ODC-3').field, 'package');
  assert.equal(findDataConflict(fixture(), 'ODC-9'), null);
  assert.equal(findDataConflict(fixture(), ''), null);
});

test('recording adds a note and never rewrites a duplicate id', () => {
  const first = recordDataConflict([], note('ODC-1'));
  assert.equal(first.length, 1);
  const again = recordDataConflict(first, note('ODC-1', { fieldValue: 'Rs 9999' }));
  assert.deepEqual(again, first);
  assert.equal(again[0].fieldValue, 'Rs 3000');
  assert.deepEqual(recordDataConflict(first, note('ODC-2', { date: 'bad' })), first);
});

test('resolving sets the resolution and resolver on only that note', () => {
  const resolved = resolveDataConflict(fixture(), 'ODC-1', 'shop', 'Owner');
  const target = findDataConflict(resolved, 'ODC-1');
  assert.equal(target.resolution, 'shop');
  assert.equal(target.resolver, 'Owner');
  assert.equal(findDataConflict(resolved, 'ODC-2').resolution, 'unresolved');
  assert.equal(findDataConflict(resolved, 'ODC-3').resolution, 'field');
  assert.equal(resolved.length, 4);
});

test('resolving refuses a missing note, a bad resolution, no resolver, or an already-resolved note', () => {
  const list = fixture();
  assert.deepEqual(resolveDataConflict(list, 'ODC-9', 'field', 'Saad'), normalizeDataConflictList(list));
  assert.deepEqual(resolveDataConflict(list, 'ODC-1', 'delete', 'Saad'), normalizeDataConflictList(list));
  assert.deepEqual(resolveDataConflict(list, 'ODC-1', 'unresolved', 'Saad'), normalizeDataConflictList(list));
  assert.deepEqual(resolveDataConflict(list, 'ODC-1', 'field', ''), normalizeDataConflictList(list));
  assert.deepEqual(resolveDataConflict(list, 'ODC-1', 'field', '  '), normalizeDataConflictList(list));
  assert.deepEqual(resolveDataConflict(list, 'ODC-3', 'shop', 'Owner'), normalizeDataConflictList(list));
  assert.deepEqual(resolveDataConflict(list, 'ODC-4', 'merged', 'Owner'), normalizeDataConflictList(list));
});

test('the open list holds unresolved notes oldest first', () => {
  assert.deepEqual(openDataConflicts(fixture()).map((entry) => entry.id), ['ODC-1', 'ODC-2']);
  const resolved = resolveDataConflict(fixture(), 'ODC-1', 'field', 'Saad');
  assert.deepEqual(openDataConflicts(resolved).map((entry) => entry.id), ['ODC-2']);
  assert.deepEqual(openDataConflicts([]), []);
});

test('notes for one record match case-insensitively and list newest first', () => {
  const list = fixture();
  assert.deepEqual(dataConflictsForRecord(list, 'customer cust-12 — bill nov 2026').map((entry) => entry.id), ['ODC-2', 'ODC-1']);
  assert.deepEqual(dataConflictsForRecord(list, 'Customer CUST-99'), []);
  assert.deepEqual(dataConflictsForRecord(list, ''), []);
});

test('record refs list A to Z keeping the first spelling', () => {
  const list = normalizeDataConflictList([
    note('ODC-1', { recordRef: 'customer cust-12 — bill Nov 2026' }),
    note('ODC-2', { recordRef: 'Customer CUST-36 — package' }),
    note('ODC-3', { recordRef: 'Customer CUST-12 — Bill Nov 2026' }),
  ]);
  assert.deepEqual(dataConflictRecords(list), ['customer cust-12 — bill Nov 2026', 'Customer CUST-36 — package']);
});

test('the summary counts open notes and resolutions', () => {
  assert.equal(dataConflictSummaryText([]), 'No offline data conflicts recorded.');
  assert.equal(
    dataConflictSummaryText(fixture()),
    '4 offline data conflict notes; 2 open. Resolved: field copy kept 1, shop copy kept 1, merged 0.',
  );
  assert.equal(
    dataConflictSummaryText([note('ODC-1')]),
    '1 offline data conflict note; 1 open. Resolved: field copy kept 0, shop copy kept 0, merged 0.',
  );
});

test('the note text shows both values and the resolution', () => {
  assert.equal(
    dataConflictNoteText(note('ODC-1')),
    'Customer CUST-12 — bill Nov 2026 — amount: field "Rs 3000" vs shop "Rs 2500" — Unresolved (2026-11-06)',
  );
  assert.equal(
    dataConflictNoteText(note('ODC-3', { resolution: 'field', resolver: 'Saad' })),
    'Customer CUST-12 — bill Nov 2026 — amount: field "Rs 3000" vs shop "Rs 2500" — Field copy kept by Saad (2026-11-06)',
  );
  assert.equal(dataConflictResolutionText('field'), 'Field copy kept');
  assert.equal(dataConflictResolutionText('shop'), 'Shop copy kept');
  assert.equal(dataConflictResolutionText('merged'), 'Merged by hand');
  assert.equal(dataConflictResolutionText('anything else'), 'Unresolved');
  assert.equal(dataConflictNoteText({ id: 'ODC-1' }), '');
});

test('the note html escapes user text and names both values and the resolution', () => {
  const html = dataConflictNoteHtml(note('ODC-1', { recordRef: '<script>alert(1)</script>', fieldValue: 'Rs <3000>' }));
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(html.includes('Field: Rs &lt;3000&gt;'), true);
  assert.equal(html.includes('Shop: Rs 2500'), true);
  assert.equal(html.includes('Resolution: Unresolved'), true);
  assert.equal(dataConflictNoteHtml({ id: 'ODC-1' }), '');
});

test('grouped html lists records A to Z with notes newest first', () => {
  const html = dataConflictsHtml(fixture());
  assert.ok(html.indexOf('Customer CUST-12') < html.indexOf('Customer CUST-36'));
  assert.ok(html.indexOf('Customer CUST-36') < html.indexOf('Customer CUST-41'));
  assert.ok(html.indexOf('ODC-2') === -1);
  assert.ok(html.includes('field &quot;Rs 2800&quot; vs shop &quot;Rs 2500&quot;'));
  assert.equal(dataConflictsHtml([]), '<p>No offline data conflicts recorded.</p>');
});

test('open html lists only unresolved notes', () => {
  const html = openDataConflictsHtml(fixture());
  assert.ok(html.includes('field &quot;Rs 3000&quot; vs shop &quot;Rs 2500&quot;'));
  assert.ok(html.includes('field &quot;Rs 2800&quot; vs shop &quot;Rs 2500&quot;'));
  assert.equal(html.includes('15 Mbps'), false);
  assert.equal(openDataConflictsHtml([]), '<p>No unresolved conflicts.</p>');
});

test('the csv carries every field and the filename is stable', () => {
  const csv = dataConflictCsv(fixture());
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,record,field,field value,shop value,resolution,resolver,date');
  assert.equal(lines.length, 5);
  assert.equal(lines[1].includes('ODC-1'), true);
  assert.equal(lines[4].includes('Customer CUST-41 — area,mohalla,Shahdara,,shop,Owner,2026-11-04'), true);
  assert.equal(dataConflictFilename(), 'offline-data-conflicts.csv');
});

test('the module never mutates its input', () => {
  const frozen = Object.freeze(fixture().map((entry) => Object.freeze({ ...entry })));
  assert.doesNotThrow(() => {
    recordDataConflict(frozen, note('ODC-9'));
    resolveDataConflict(frozen, 'ODC-1', 'field', 'Saad');
    openDataConflicts(frozen);
    dataConflictsForRecord(frozen, 'Customer CUST-12 — bill Nov 2026');
    dataConflictCsv(frozen);
  });
  assert.equal(frozen[0].resolution, 'unresolved');
});

test('the module is pure: it reads no storage, clock, or network', () => {
  const source = readFileSync(new URL('../offline-data-conflict.js', import.meta.url), 'utf8');
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('XMLHttpRequest'), false);
  assert.equal(source.includes('document.'), false);
});

test('the module keeps its fences: no fenced file, no OLT', () => {
  const source = readFileSync(new URL('../offline-data-conflict.js', import.meta.url), 'utf8');
  for (const fenced of ['transfer-pack']) {
    assert.equal(source.includes(fenced), false, `module must not name the fenced module ${fenced}`);
  }
  assert.equal(source.includes('OLT'), false);
});

test('panel ids are present in index.html', () => {
  for (const id of ['odcBody', 'odcSummary', 'odcOpenBody', 'odcExportBtn', 'odcRecordRef', 'odcField', 'odcFieldValue', 'odcShopValue', 'odcDate', 'odcRecordBtn', 'odcResolveId', 'odcResolveChoice', 'odcResolveBy', 'odcResolveBtn']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing ${id}`);
  }
});

test('app.js wiring is present', () => {
  assert.ok(appJs.includes("from './offline-data-conflict.js'"));
  assert.ok(appJs.includes('shahdara_odc_notes_v1'));
  assert.ok(appJs.includes('renderDataConflicts()'));
  assert.ok(appJs.includes('odcExportBtn'));
});

test('deployment guard: no standalone OLT word added to app.js by this plan', () => {
  const mine = appJs.match(/offline-data-conflict|DataConflict|DATA_CONFLICT/g) || [];
  assert.ok(mine.length > 0);
});
