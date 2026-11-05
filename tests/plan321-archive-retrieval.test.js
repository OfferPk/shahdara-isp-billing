import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validArchiveRetrievalDay,
  normalizeArchiveRetrieval,
  normalizeArchiveRetrievalList,
  findArchiveRetrieval,
  recordArchiveRetrieval,
  removeArchiveRetrieval,
  returnArchiveItem,
  archiveRetrievalDaysOut,
  archiveRetrievalOpen,
  archiveRetrievalReturned,
  archiveRetrievalsForRef,
  archiveRetrievalSummaryText,
  archiveRetrievalEntryText,
  archiveRetrievalEntryHtml,
  archiveRetrievalOpenHtml,
  archiveRetrievalAllHtml,
  archiveRetrievalCsv,
  archiveRetrievalFilename,
} from '../archive-retrieval.js';

const first = {
  id: 'AR-1',
  archiveRef: 'ARCH-2024-014',
  retrievedBy: 'Saad',
  dateOut: '2026-10-20',
  dateReturned: '',
  reason: 'Customer asked about an old balance',
};
const second = {
  id: 'AR-2',
  archiveRef: 'ARCH-2025-003',
  retrievedBy: 'Owner',
  dateOut: '2026-11-02',
  dateReturned: '',
  reason: 'Year-end check',
};
const returned = {
  id: 'AR-3',
  archiveRef: 'ARCH-2024-014',
  retrievedBy: 'Saad',
  dateOut: '2026-09-10',
  dateReturned: '2026-09-25',
  reason: 'Old bill copy for a customer',
};

test('strict dates: real calendar days pass, impossible days and wrong shapes fail', () => {
  assert.equal(validArchiveRetrievalDay('2026-11-05'), true);
  assert.equal(validArchiveRetrievalDay('2024-02-29'), true);
  assert.equal(validArchiveRetrievalDay('2026-02-29'), false);
  assert.equal(validArchiveRetrievalDay('2026-04-31'), false);
  assert.equal(validArchiveRetrievalDay('2026-13-01'), false);
  assert.equal(validArchiveRetrievalDay('2026-11-5'), false);
  assert.equal(validArchiveRetrievalDay('05-11-2026'), false);
  assert.equal(validArchiveRetrievalDay(''), false);
  assert.equal(validArchiveRetrievalDay(null), false);
});

test('a record with no archive reference is refused', () => {
  assert.equal(normalizeArchiveRetrieval({ ...first, archiveRef: '' }), null);
  assert.equal(normalizeArchiveRetrieval({ ...first, archiveRef: '   ' }), null);
  assert.equal(normalizeArchiveRetrieval({ ...first, archiveRef: undefined }), null);
});

test('a record with no retriever is refused', () => {
  assert.equal(normalizeArchiveRetrieval({ ...first, retrievedBy: '' }), null);
  assert.equal(normalizeArchiveRetrieval({ ...first, retrievedBy: '   ' }), null);
  assert.equal(normalizeArchiveRetrieval({ ...first, retrievedBy: undefined }), null);
});

test('a record with no id, no reason, or no strict date out is refused', () => {
  assert.equal(normalizeArchiveRetrieval({ ...first, id: '' }), null);
  assert.equal(normalizeArchiveRetrieval({ ...first, reason: '' }), null);
  assert.equal(normalizeArchiveRetrieval({ ...first, dateOut: '2026-02-30' }), null);
  assert.equal(normalizeArchiveRetrieval({ ...first, dateOut: 'tomorrow' }), null);
  assert.equal(normalizeArchiveRetrieval(null), null);
  assert.equal(normalizeArchiveRetrieval([]), null);
});

test('a return date before the date out is refused; on or after is kept', () => {
  assert.equal(normalizeArchiveRetrieval({ ...first, dateReturned: '2026-10-19' }), null);
  assert.equal(normalizeArchiveRetrieval({ ...first, dateReturned: '2026-10-20' }).dateReturned, '2026-10-20');
  assert.equal(normalizeArchiveRetrieval({ ...first, dateReturned: '2026-11-01' }).dateReturned, '2026-11-01');
  assert.equal(normalizeArchiveRetrieval({ ...first, dateReturned: 'not a date' }), null);
});

test('a record still out keeps an empty return date, and unknown fields are dropped', () => {
  const clean = normalizeArchiveRetrieval({ ...first, billAmount: 3000, customerName: 'Someone' });
  assert.equal(clean.dateReturned, '');
  assert.equal('billAmount' in clean, false);
  assert.equal('customerName' in clean, false);
  assert.equal(clean.archiveRef, 'ARCH-2024-014');
});

test('the input is never mutated by normalising', () => {
  const raw = { ...first };
  normalizeArchiveRetrieval(raw);
  assert.deepEqual(raw, first);
});

test('list normalising drops half-formed records and keeps the first record per id', () => {
  const list = normalizeArchiveRetrievalList([first, { ...first, reason: 'A second try' }, second, { ...first, id: '' }]);
  assert.equal(list.length, 2);
  assert.equal(list[0].reason, 'Customer asked about an old balance');
  assert.equal(normalizeArchiveRetrievalList('nope').length, 0);
});

test('recording adds a record; a duplicate id or a half-formed record changes nothing', () => {
  const one = recordArchiveRetrieval([], first);
  assert.equal(one.length, 1);
  assert.equal(recordArchiveRetrieval(one, { ...first, reason: 'Changed' }).length, 1);
  assert.equal(recordArchiveRetrieval(one, { ...first, reason: 'Changed' })[0].reason, 'Customer asked about an old balance');
  assert.equal(recordArchiveRetrieval(one, { ...second, archiveRef: '' }).length, 1);
});

test('find returns the record or null, and remove drops only that record', () => {
  const list = [first, second, returned];
  assert.equal(findArchiveRetrieval(list, 'AR-2').archiveRef, 'ARCH-2025-003');
  assert.equal(findArchiveRetrieval(list, 'AR-9'), null);
  assert.equal(findArchiveRetrieval(list, ''), null);
  assert.equal(removeArchiveRetrieval(list, 'AR-2').length, 2);
  assert.equal(removeArchiveRetrieval(list, 'AR-9').length, 3);
});

test('unreturned retrievals appear on the open list oldest out first', () => {
  const open = archiveRetrievalOpen([second, returned, first]);
  assert.deepEqual(open.map((record) => record.id), ['AR-1', 'AR-2']);
});

test('returning an item clears it from the open list and changes nothing else', () => {
  const list = [first, second];
  const next = returnArchiveItem(list, 'AR-1', '2026-11-05');
  assert.deepEqual(archiveRetrievalOpen(next).map((record) => record.id), ['AR-2']);
  assert.equal(findArchiveRetrieval(next, 'AR-1').dateReturned, '2026-11-05');
  assert.equal(findArchiveRetrieval(next, 'AR-1').reason, 'Customer asked about an old balance');
  assert.equal(findArchiveRetrieval(next, 'AR-2').dateReturned, '');
});

test('returning is refused for a missing record, a bad date, a date before the date out, or an already-returned item', () => {
  const list = [first, returned];
  assert.deepEqual(returnArchiveItem(list, 'AR-9', '2026-11-05'), normalizeArchiveRetrievalList(list));
  assert.deepEqual(returnArchiveItem(list, 'AR-1', 'not a date'), normalizeArchiveRetrievalList(list));
  assert.deepEqual(returnArchiveItem(list, 'AR-1', '2026-10-19'), normalizeArchiveRetrievalList(list));
  assert.deepEqual(returnArchiveItem(list, 'AR-3', '2026-10-01'), normalizeArchiveRetrievalList(list));
  assert.equal(findArchiveRetrieval(returnArchiveItem(list, 'AR-3', '2026-10-01'), 'AR-3').dateReturned, '2026-09-25');
});

test('days out is whole days by integer arithmetic, across months and a leap day', () => {
  assert.equal(archiveRetrievalDaysOut(first, '2026-11-05'), 16);
  assert.equal(archiveRetrievalDaysOut(first, '2026-10-20'), 0);
  assert.equal(archiveRetrievalDaysOut({ ...first, dateOut: '2024-02-28' }, '2024-03-01'), 2);
  assert.equal(archiveRetrievalDaysOut(first, '2026-10-19'), null);
  assert.equal(archiveRetrievalDaysOut(first, 'not a date'), null);
  assert.equal(archiveRetrievalDaysOut({ ...first, dateOut: 'bad' }, '2026-11-05'), null);
});

test('returned list is most recently returned first; records for one reference match case-insensitively', () => {
  const later = { ...returned, id: 'AR-4', dateReturned: '2026-10-02' };
  assert.deepEqual(archiveRetrievalReturned([returned, later]).map((record) => record.id), ['AR-4', 'AR-3']);
  assert.deepEqual(archiveRetrievalsForRef([first, second, returned], 'arch-2024-014').map((record) => record.id), ['AR-3', 'AR-1']);
  assert.deepEqual(archiveRetrievalsForRef([first], ''), []);
});

test('summary text counts still-out and returned in plain words', () => {
  assert.equal(archiveRetrievalSummaryText([]), 'No archive retrievals recorded.');
  assert.equal(
    archiveRetrievalSummaryText([first, second, returned]),
    '3 archive retrievals recorded: 2 retrievals still out, 1 returned.',
  );
  assert.equal(
    archiveRetrievalSummaryText([first]),
    '1 archive retrieval recorded: 1 retrieval still out, 0 returned.',
  );
});

test('entry text names the archive, the retriever, and the status', () => {
  assert.equal(
    archiveRetrievalEntryText(first),
    '2026-10-20 — ARCH-2024-014 taken out by Saad (Customer asked about an old balance), still out.',
  );
  assert.equal(
    archiveRetrievalEntryText(returned),
    '2026-09-10 — ARCH-2024-014 taken out by Saad (Old bill copy for a customer), returned 2026-09-25.',
  );
  assert.equal(archiveRetrievalEntryText({ ...first, archiveRef: '' }), '');
});

test('entry html escapes user text and shows days out when an as-of date is given', () => {
  const html = archiveRetrievalEntryHtml({ ...first, reason: '<script>alert(1)</script>' }, '2026-11-05');
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(html.includes('out 16 days'), true);
  assert.equal(archiveRetrievalEntryHtml({ ...first, reason: '' }), '');
});

test('open html lists only unreturned retrievals; all html and empty states say so plainly', () => {
  assert.equal(archiveRetrievalOpenHtml([returned], '2026-11-05'), '<p>No archive retrievals are still out.</p>');
  assert.equal(archiveRetrievalOpenHtml([first, second, returned], '2026-11-05').includes('ARCH-2025-003'), true);
  assert.equal(archiveRetrievalOpenHtml([first, second, returned], '2026-11-05').includes('2026-09-10'), false);
  assert.equal(archiveRetrievalAllHtml([], '2026-11-05'), '<p>No archive retrievals recorded.</p>');
});

test('csv has one row per record in date-out order with the filename', () => {
  const csv = archiveRetrievalCsv([second, first, returned]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,archive_ref,retrieved_by,date_out,date_returned,reason');
  assert.equal(lines.length, 4);
  assert.equal(lines[1].startsWith('AR-3,ARCH-2024-014,Saad,2026-09-10,2026-09-25,'), true);
  assert.equal(lines[2].startsWith('AR-1,ARCH-2024-014,Saad,2026-10-20,,'), true);
  assert.equal(archiveRetrievalFilename(), 'archive-retrievals.csv');
});
