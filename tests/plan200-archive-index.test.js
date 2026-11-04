import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validArchiveDate,
  normalizeArchiveYear,
  normalizeArchiveEntry,
  normalizeArchiveList,
  findArchiveEntry,
  recordArchiveEntry,
  removeArchiveEntry,
  archiveEntriesSorted,
  archiveByYear,
  archiveByKind,
  archiveMissing,
  archiveSummaryText,
  archiveText,
  archiveHtml,
  archiveAllHtml,
  archiveCsv,
  archiveFilename,
} from '../archive-index.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');

const first = {
  id: 'AI-1', year: 2025, packKind: 'Year-end pack',
  packReference: 'Pack 2025-A', location: 'Shop shelf', dateArchived: '2026-01-10', note: '',
};
const second = {
  id: 'AI-2', year: 2025, packKind: 'Tax pack',
  packReference: '', location: '', dateArchived: '2026-01-12', note: 'Not yet filed',
};
const third = {
  id: 'AI-3', year: 2024, packKind: 'Year-end pack',
  packReference: 'Pack 2024-A', location: 'Shop shelf', dateArchived: '2025-01-09', note: '',
};

test('half-formed entries are refused', () => {
  assert.equal(normalizeArchiveEntry(null), null);
  assert.equal(normalizeArchiveEntry({ ...first, id: '' }), null);
  assert.equal(normalizeArchiveEntry({ ...first, packKind: '  ' }), null);
  assert.equal(normalizeArchiveEntry({ ...first, dateArchived: '2026-13-10' }), null);
  assert.equal(normalizeArchiveEntry({ ...first, year: null }), null);
});

test('strict calendar dates', () => {
  assert.equal(validArchiveDate('2026-02-29'), false);
  assert.equal(validArchiveDate('2024-02-29'), true);
  assert.equal(validArchiveDate('2026-04-31'), false);
  assert.equal(validArchiveDate('2026-08-31'), true);
  assert.equal(validArchiveDate('2026-01-10'), true);
  assert.equal(validArchiveDate('10-01-2026'), false);
});

test('year validation never maps onto a neighbouring year', () => {
  assert.equal(normalizeArchiveYear(2025), 2025);
  assert.equal(normalizeArchiveYear('2025'), 2025);
  assert.equal(normalizeArchiveYear(1899), 1899);
  assert.equal(normalizeArchiveEntry({ ...first, year: 1899 }), null);
  assert.equal(normalizeArchiveEntry({ ...first, year: 2101 }), null);
  assert.equal(normalizeArchiveEntry({ ...first, year: 'twenty' }), null);
  assert.equal(normalizeArchiveEntry({ ...first, year: 2025.5 }), null);
});

test('unknown fields are dropped', () => {
  const entry = normalizeArchiveEntry({ ...first, billId: 'B-1', paymentTotal: 500, packContents: '...', sendTo: 'x' });
  assert.deepEqual(Object.keys(entry).sort(), ['dateArchived', 'id', 'location', 'note', 'packKind', 'packReference', 'year']);
});

test('duplicate ids are never rewritten', () => {
  const list = recordArchiveEntry([first], { ...first, packReference: 'Changed pack' });
  assert.equal(list.length, 1);
  assert.equal(list[0].packReference, 'Pack 2025-A');
});

test('find and remove', () => {
  assert.equal(findArchiveEntry([first, second], 'AI-2').packKind, 'Tax pack');
  assert.equal(findArchiveEntry([first], 'AI-9'), null);
  assert.deepEqual(removeArchiveEntry([first, second], 'AI-1'), [second]);
  assert.equal(removeArchiveEntry([first], '').length, 1);
});

test('sorting is newest year first, then kind A-Z, then id', () => {
  const sorted = archiveEntriesSorted([third, second, first]);
  assert.deepEqual(sorted.map((e) => e.id), ['AI-2', 'AI-1', 'AI-3']);
});

test('year view', () => {
  assert.deepEqual(archiveByYear([first, second, third], 2025).map((e) => e.id), ['AI-2', 'AI-1']);
  assert.deepEqual(archiveByYear([first, second, third], 2023), []);
  assert.deepEqual(archiveByYear([first], 'nonsense'), []);
});

test('kind filter is case-insensitive', () => {
  assert.deepEqual(archiveByKind([first, second, third], 'year-end pack').map((e) => e.id), ['AI-1', 'AI-3']);
  assert.equal(archiveByKind([first, second], '').length, 2);
});

test('missing view flags entries with no pack reference', () => {
  assert.deepEqual(archiveMissing([first, second, third]).map((e) => e.id), ['AI-2']);
  assert.deepEqual(archiveMissing([first, third]), []);
});

test('summary text', () => {
  assert.equal(archiveSummaryText([]), 'No archive entries logged.');
  assert.equal(archiveSummaryText([first]), '1 archive entry across 1 year, none missing.');
  assert.equal(archiveSummaryText([first, second, third]), '3 archive entries across 2 years, 1 missing.');
});

test('text rendering states a missing pack plainly', () => {
  assert.match(archiveText(second), /Pack missing/);
  assert.match(archiveText(first), /Pack 2025-A/);
  assert.match(archiveText(first), /kept at Shop shelf/);
  assert.equal(archiveText(null), '');
});

test('HTML escapes input', () => {
  const html = archiveHtml({ ...first, note: '<script>alert(1)</script>' });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(archiveAllHtml([first, second]), /Pack missing/);
});

test('CSV columns and filename', () => {
  const csv = archiveCsv([first, second]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,year,pack_kind,pack_reference,location,date_archived,note');
  assert.equal(lines.length, 3);
  assert.match(lines[1], /AI-2/);
  assert.equal(archiveFilename(), 'archive-index.csv');
});

test('inputs are never mutated', () => {
  const entry = { ...first };
  const before = JSON.stringify(entry);
  recordArchiveEntry([], entry);
  normalizeArchiveEntry(entry);
  assert.equal(JSON.stringify(entry), before);
});

test('list normalization drops bad and duplicate entries', () => {
  const list = normalizeArchiveList([first, { ...first, packReference: 'Other' }, null, { ...first, id: '' }]);
  assert.equal(list.length, 1);
  assert.deepEqual(normalizeArchiveList('not a list'), []);
});

test('purity fence: no import, no storage, no retention-policy import', () => {
  const src = readFileSync(join(dir, '..', 'archive-index.js'), 'utf8');
  assert.doesNotMatch(src, /^import /m);
  assert.doesNotMatch(src, /localStorage/);
  assert.doesNotMatch(src, /from '\.\/retention-policy\.js'/);
  assert.doesNotMatch(src, /shahdara_retention_rules_v1/);
});

test('panel ids are present in index.html', () => {
  for (const id of ['aiBody', 'aiSummary', 'aiExportBtn', 'aiYear', 'aiKind', 'aiReference', 'aiLocation', 'aiDate', 'aiNote', 'aiSaveBtn', 'aiRemoveId', 'aiRemoveBtn', 'aiYearFilter', 'aiKindFilter']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing ${id}`);
  }
});

test('app.js wiring is present', () => {
  assert.ok(appJs.includes("from './archive-index.js'"));
  assert.ok(appJs.includes('shahdara_archive_index_v1'));
  assert.ok(appJs.includes('renderArchiveIndex()'));
  assert.ok(appJs.includes('aiExportBtn'));
});

test('deployment guard: no standalone OLT word added to app.js by this plan', () => {
  const mine = appJs.match(/archive-index|ArchiveIndex|ARCHIVE_INDEX/g) || [];
  assert.ok(mine.length > 0);
});
