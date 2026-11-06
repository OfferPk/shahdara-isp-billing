import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validInactiveRecordArchiveDay,
  normalizeInactiveRecordArchive,
  normalizeInactiveRecordArchiveList,
  recordInactiveRecordArchive,
  inactiveRecordArchiveFor,
  inactiveRecordArchiveRetrievable,
  inactiveRecordArchives,
  inactiveRecordArchiveLiveRecords,
  inactiveRecordArchiveHistory,
  inactiveRecordArchiveCountsAll,
  inactiveRecordArchiveSummaryText,
  inactiveRecordArchiveText,
  inactiveRecordArchivesHtml,
  inactiveRecordArchiveLiveHtml,
  inactiveRecordArchiveCsv,
  inactiveRecordArchiveFilename,
} from '../inactive-record-archive.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'inactive-record-archive.js'), 'utf8');

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function baseNote(overrides = {}) {
  return {
    id: 'IRA-1',
    recordRef: 'CUST-9',
    reasonInactive: 'Customer moved away',
    archiveDate: '2026-11-01',
    archiver: 'Owner',
    retrievalRef: 'ARCH-2026-11-001',
    ...overrides,
  };
}

test('strict date: leap day 2028-02-29 is valid, 2027-02-29 is not', () => {
  assert.equal(validInactiveRecordArchiveDay('2028-02-29'), true);
  assert.equal(validInactiveRecordArchiveDay('2027-02-29'), false);
  assert.equal(validInactiveRecordArchiveDay('2026-11-06'), true);
});

test('strict date: impossible and malformed dates are refused', () => {
  assert.equal(validInactiveRecordArchiveDay('2026-11-31'), false);
  assert.equal(validInactiveRecordArchiveDay('2026-13-01'), false);
  assert.equal(validInactiveRecordArchiveDay('2026-00-10'), false);
  assert.equal(validInactiveRecordArchiveDay('2026-11-6'), false);
  assert.equal(validInactiveRecordArchiveDay('06-11-2026'), false);
  assert.equal(validInactiveRecordArchiveDay(''), false);
  assert.equal(validInactiveRecordArchiveDay(20261106), false);
  assert.equal(validInactiveRecordArchiveDay(null), false);
});

test('normalize: a full note is accepted and unknown fields are dropped', () => {
  const clean = normalizeInactiveRecordArchive({ ...baseNote(), billTotal: 3000, customerName: 'Someone' });
  assert.deepEqual(clean, {
    id: 'IRA-1',
    recordRef: 'CUST-9',
    reasonInactive: 'Customer moved away',
    archiveDate: '2026-11-01',
    archiver: 'Owner',
    retrievalRef: 'ARCH-2026-11-001',
  });
});

test('normalize: retrieval reference is optional and defaults to empty', () => {
  const clean = normalizeInactiveRecordArchive(baseNote({ retrievalRef: undefined }));
  assert.equal(clean.retrievalRef, '');
  const clean2 = normalizeInactiveRecordArchive({ ...baseNote(), retrievalRef: '  ' });
  assert.equal(clean2.retrievalRef, '');
});

test('normalize: half-formed notes are refused', () => {
  assert.equal(normalizeInactiveRecordArchive(baseNote({ id: '' })), null);
  assert.equal(normalizeInactiveRecordArchive(baseNote({ recordRef: '   ' })), null);
  assert.equal(normalizeInactiveRecordArchive(baseNote({ reasonInactive: '' })), null);
  assert.equal(normalizeInactiveRecordArchive(baseNote({ archiveDate: '2026-02-30' })), null);
  assert.equal(normalizeInactiveRecordArchive(baseNote({ archiver: '' })), null);
  assert.equal(normalizeInactiveRecordArchive(null), null);
  assert.equal(normalizeInactiveRecordArchive('IRA-1'), null);
});

test('normalize list: only valid notes survive', () => {
  const out = normalizeInactiveRecordArchiveList([baseNote(), baseNote({ id: '' }), 'nope', null, baseNote({ id: 'IRA-2', recordRef: 'CUST-10' })]);
  assert.deepEqual(out.map((item) => item.id), ['IRA-1', 'IRA-2']);
  assert.deepEqual(normalizeInactiveRecordArchiveList('not a list'), []);
});

test('record: a valid note is added', () => {
  const next = recordInactiveRecordArchive([], baseNote());
  assert.equal(next.length, 1);
  assert.equal(next[0].recordRef, 'CUST-9');
});

test('record: a duplicate id is never rewritten', () => {
  const before = [baseNote()];
  const next = recordInactiveRecordArchive(before, baseNote({ reasonInactive: 'Different reason' }));
  assert.equal(next.length, 1);
  assert.equal(next[0].reasonInactive, 'Customer moved away');
});

test('record: a second note for the same record is refused, case-insensitively', () => {
  const before = [baseNote()];
  const next = recordInactiveRecordArchive(before, baseNote({ id: 'IRA-2', recordRef: 'cust-9', reasonInactive: 'Closed matter' }));
  assert.equal(next.length, 1);
  assert.equal(next[0].id, 'IRA-1');
});

test('record: a half-formed note leaves the list exactly as it was', () => {
  const before = [baseNote()];
  const next = recordInactiveRecordArchive(before, baseNote({ id: 'IRA-2', archiver: '' }));
  assert.deepEqual(next, before);
});

test('lookup: an archived record is found case-insensitively', () => {
  const list = [baseNote(), baseNote({ id: 'IRA-2', recordRef: 'CUST-11', archiveDate: '2026-11-02' })];
  assert.equal(inactiveRecordArchiveFor(list, 'cust-9').id, 'IRA-1');
  assert.equal(inactiveRecordArchiveFor(list, 'CUST-11').id, 'IRA-2');
  assert.equal(inactiveRecordArchiveFor(list, 'CUST-99'), null);
  assert.equal(inactiveRecordArchiveFor(list, ''), null);
});

test('retrievable: an archived record stays retrievable by reference', () => {
  const list = [baseNote()];
  assert.equal(inactiveRecordArchiveRetrievable(list, 'CUST-9').id, 'IRA-1');
  assert.equal(inactiveRecordArchiveRetrievable(list, 'cust-9').id, 'IRA-1');
  assert.equal(inactiveRecordArchiveRetrievable(list, 'CUST-99'), null);
});

test('archived list: oldest archive date first, id breaks ties', () => {
  const list = [
    baseNote({ id: 'IRA-3', recordRef: 'CUST-12', archiveDate: '2026-11-03' }),
    baseNote({ id: 'IRA-1', recordRef: 'CUST-9', archiveDate: '2026-11-01' }),
    baseNote({ id: 'IRA-2', recordRef: 'CUST-10', archiveDate: '2026-11-01' }),
  ];
  assert.deepEqual(inactiveRecordArchives(list).map((item) => item.id), ['IRA-1', 'IRA-2', 'IRA-3']);
});

test('live list: archived records leave live lists, others stay in order', () => {
  const list = [baseNote(), baseNote({ id: 'IRA-2', recordRef: 'CUST-11', archiveDate: '2026-11-02' })];
  assert.deepEqual(
    inactiveRecordArchiveLiveRecords(list, ['CUST-8', 'CUST-9', 'CUST-10', 'cust-11', 'CUST-12']),
    ['CUST-8', 'CUST-10', 'CUST-12'],
  );
});

test('live list: with no archive notes every record stays live', () => {
  assert.deepEqual(inactiveRecordArchiveLiveRecords([], ['CUST-1', 'CUST-2']), ['CUST-1', 'CUST-2']);
});

test('live list: repeated references collapse to the first spelling', () => {
  assert.deepEqual(
    inactiveRecordArchiveLiveRecords([], ['CUST-1', 'cust-1', 'CUST-2', '  ', 'CUST-2']),
    ['CUST-1', 'CUST-2'],
  );
});

test('history: an archived record history stays intact and visible, date ordered', () => {
  const records = [
    { reference: 'CUST-9', history: [{ date: '2026-10-05', text: 'Paid Rs 3000' }, { date: '2026-09-01', text: 'Bill Rs 3000' }] },
    { reference: 'CUST-10', history: [{ date: '2026-10-01', text: 'Bill Rs 1000' }] },
  ];
  const got = inactiveRecordArchiveHistory(baseNote(), records);
  assert.equal(got.recordRef, 'CUST-9');
  assert.equal(got.reasonInactive, 'Customer moved away');
  assert.equal(got.retrievalRef, 'ARCH-2026-11-001');
  assert.deepEqual(got.history, [
    { date: '2026-09-01', text: 'Bill Rs 3000' },
    { date: '2026-10-05', text: 'Paid Rs 3000' },
  ]);
});

test('history: null when the record is not supplied or the note is bad', () => {
  const records = [{ reference: 'CUST-10', history: [] }];
  assert.equal(inactiveRecordArchiveHistory(baseNote(), records), null);
  assert.equal(inactiveRecordArchiveHistory(baseNote({ id: '' }), [{ reference: 'CUST-9', history: [] }]), null);
  assert.equal(inactiveRecordArchiveHistory(baseNote(), 'not a list'), null);
});

test('counts reconcile: notes equal archived records, one note per record', () => {
  const list = [baseNote(), baseNote({ id: 'IRA-2', recordRef: 'CUST-11' })];
  const counts = inactiveRecordArchiveCountsAll(list);
  assert.deepEqual(counts, { notes: 2, archived: 2 });
  assert.equal(counts.notes, counts.archived);
  assert.deepEqual(inactiveRecordArchiveCountsAll([]), { notes: 0, archived: 0 });
});

test('summary text: empty, one, and many', () => {
  assert.equal(inactiveRecordArchiveSummaryText([]), 'No inactive records archived.');
  assert.equal(
    inactiveRecordArchiveSummaryText([baseNote()]),
    '1 archive note recorded, 1 record archived, none deleted.',
  );
  assert.equal(
    inactiveRecordArchiveSummaryText([baseNote(), baseNote({ id: 'IRA-2', recordRef: 'CUST-11' })]),
    '2 archive notes recorded, 2 records archived, none deleted.',
  );
});

test('plain text: names the record, archiver, reason, and retrieval reference', () => {
  assert.equal(
    inactiveRecordArchiveText(baseNote()),
    '2026-11-01 — CUST-9 archived by Owner, reason: Customer moved away, retrieval reference: ARCH-2026-11-001.',
  );
  assert.equal(
    inactiveRecordArchiveText(baseNote({ retrievalRef: '' })),
    '2026-11-01 — CUST-9 archived by Owner, reason: Customer moved away, no retrieval reference recorded.',
  );
  assert.equal(inactiveRecordArchiveText(baseNote({ id: '' })), '');
});

test('HTML: user text is escaped, archived note says never deleted', () => {
  const list = [baseNote({ reasonInactive: '<script>alert(1)</script>' })];
  const html = inactiveRecordArchivesHtml(list);
  assert.ok(!html.includes('<script>'), 'raw script tag must not appear');
  assert.ok(html.includes('&lt;script&gt;'), 'escaped script tag appears');
  assert.ok(html.includes('never deleted'), 'archived note says never deleted');
});

test('live HTML: archived records are absent, live records are escaped', () => {
  const list = [baseNote()];
  const html = inactiveRecordArchiveLiveHtml(list, ['CUST-8', 'CUST-9', 'CUST-<b>10</b>']);
  assert.ok(html.includes('CUST-8'));
  assert.ok(!html.includes('CUST-9'));
  assert.ok(!html.includes('<b>10</b>'));
  assert.ok(html.includes('CUST-&lt;b&gt;10&lt;/b&gt;'));
});

test('CSV: header and rows, with quoting for commas and quotes', () => {
  const list = [baseNote({ reasonInactive: 'Moved, "left town"' })];
  const csv = inactiveRecordArchiveCsv(list);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,recordRef,reasonInactive,archiveDate,archiver,retrievalRef');
  assert.equal(lines[1], 'IRA-1,CUST-9,"Moved, ""left town""",2026-11-01,Owner,ARCH-2026-11-001');
});

test('filename: the export filename is fixed', () => {
  assert.equal(inactiveRecordArchiveFilename(), 'inactive-record-archive-notes.csv');
});

test('inputs are never mutated, including on a deep-frozen fixture', () => {
  const frozen = deepFreeze([baseNote()]);
  const frozenRecords = deepFreeze([{ reference: 'CUST-9', history: [{ date: '2026-10-05', text: 'Paid Rs 3000' }] }]);
  const before = JSON.stringify(frozen);
  const next = recordInactiveRecordArchive(frozen, baseNote({ id: 'IRA-2', recordRef: 'CUST-11' }));
  assert.equal(next.length, 2);
  assert.equal(JSON.stringify(frozen), before);
  const history = inactiveRecordArchiveHistory(frozen[0], frozenRecords);
  assert.equal(history.history.length, 1);
  assert.equal(JSON.stringify(frozenRecords), '[{"reference":"CUST-9","history":[{"date":"2026-10-05","text":"Paid Rs 3000"}]}]');
});

test('fences: module never names the fenced files literally', () => {
  assert.ok(!moduleSrc.includes('retention-policy'), 'must not contain the retention policy filename');
  assert.ok(!moduleSrc.includes('archive-retrieval'), 'must not contain the archive retrieval filename');
});

test('purity: no storage, clock, network, page, or standalone OLT use', () => {
  assert.ok(!moduleSrc.includes('document.'), 'no document access');
  assert.ok(!moduleSrc.includes('localStorage'), 'no localStorage');
  assert.ok(!moduleSrc.includes('new Date('), 'no new Date(');
  assert.ok(!moduleSrc.includes('Date.now('), 'no Date.now(');
  assert.ok(!moduleSrc.includes('fetch('), 'no fetch');
  assert.ok(!moduleSrc.includes('window.'), 'no window');
  assert.ok(!moduleSrc.includes('import '), 'no imports');
  assert.ok(!/\bOLT\b/.test(moduleSrc), 'no standalone OLT word');
});

test('wiring: app.js imports the module, renders it, and stores it', () => {
  assert.ok(appJs.includes("from './inactive-record-archive.js'"), 'app.js imports the module');
  assert.ok(appJs.includes('renderInactiveRecordArchives()'), 'app.js calls the render function');
  assert.ok(appJs.includes("shahdara_ira_notes_v1"), 'app.js uses the ira store key');
  assert.ok(appJs.includes('loadInactiveRecordArchives'), 'app.js has a load helper');
  assert.ok(appJs.includes('saveInactiveRecordArchives'), 'app.js has a save helper');
});

test('wiring: index.html carries the ira panel', () => {
  assert.ok(indexHtml.includes('id="iraHeading"'), 'panel heading present');
  assert.ok(indexHtml.includes('id="iraBody"'), 'panel body present');
  assert.ok(indexHtml.includes('id="iraSummary"'), 'panel summary present');
  assert.ok(indexHtml.includes('id="iraSaveBtn"'), 'panel save button present');
  assert.ok(indexHtml.includes('id="iraExportBtn"'), 'panel export button present');
});
