import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validOutageTypeDate,
  normalizeOutageType,
  normalizeOutageTypeList,
  findOutageType,
  upsertOutageType,
  removeOutageType,
  outagesByType,
  outagesForMohalla,
  isMissingNotice,
  missingNoticeOutages,
  outageTypeCounts,
  outageTypeSummaryText,
  outageTypeHtml,
  outageTypeCsv,
  outageTypeFilename,
} from '../outage-type.js';

const entry = (over = {}) => ({
  id: 'OT-1',
  type: 'planned',
  mohallas: ['Barrian', 'Shahdara'],
  startDate: '2026-11-05',
  endDate: '2026-11-05',
  noticeGiven: true,
  noticeNote: 'Announced on the mohalla group.',
  ...over,
});

test('strict dates: real values pass, impossible values refused', () => {
  assert.equal(validOutageTypeDate('2026-11-05'), '2026-11-05');
  assert.equal(validOutageTypeDate('2026-08-31'), '2026-08-31');
  assert.equal(validOutageTypeDate('2026-10-31'), '2026-10-31');
  assert.equal(validOutageTypeDate('2026-12-31'), '2026-12-31');
  assert.equal(validOutageTypeDate('2024-02-29'), '2024-02-29');
  assert.equal(validOutageTypeDate('2026-02-30'), null);
  assert.equal(validOutageTypeDate('2026-04-31'), null);
  assert.equal(validOutageTypeDate('2026-09-31'), null);
  assert.equal(validOutageTypeDate('2026-11-31'), null);
  assert.equal(validOutageTypeDate('2026-13-01'), null);
  assert.equal(validOutageTypeDate('not-a-date'), null);
  assert.equal(validOutageTypeDate(20261105), null);
});

test('half-formed entries refused: bad type, no mohalla, no start, end before start', () => {
  assert.equal(normalizeOutageType(entry({ type: 'surprise' })), null);
  assert.equal(normalizeOutageType(entry({ type: '' })), null);
  assert.equal(normalizeOutageType(entry({ mohallas: [] })), null);
  assert.equal(normalizeOutageType(entry({ mohallas: ['  ', ''] })), null);
  assert.equal(normalizeOutageType(entry({ mohallas: 'Barrian' })), null);
  assert.equal(normalizeOutageType(entry({ startDate: '2026-02-30' })), null);
  assert.equal(normalizeOutageType(entry({ startDate: '' })), null);
  assert.equal(normalizeOutageType(entry({ endDate: '2026-11-04' })), null);
  assert.equal(normalizeOutageType(entry({ endDate: '2026-02-30' })), null);
  assert.equal(normalizeOutageType(entry({ id: '' })), null);
  assert.equal(normalizeOutageType(null), null);
});

test('a well-formed entry normalises: type lowercased, mohallas trimmed and deduped, unknown fields dropped', () => {
  const item = normalizeOutageType(entry({ type: 'Planned', mohallas: [' Barrian ', 'barrian', 'Shahdara'], credit: 500, bill: 100 }));
  assert.equal(item.type, 'planned');
  assert.deepEqual(item.mohallas, ['Barrian', 'Shahdara']);
  assert.equal('credit' in item, false);
  assert.equal('bill' in item, false);
});

test('end date is optional, and an open-ended outage keeps a blank end', () => {
  const item = normalizeOutageType(entry({ endDate: '' }));
  assert.equal(item.endDate, '');
  const missing = normalizeOutageType(entry({ endDate: undefined }));
  assert.equal(missing.endDate, '');
});

test('an unplanned outage never requires a notice note', () => {
  const item = normalizeOutageType(entry({ type: 'unplanned', noticeGiven: false, noticeNote: '' }));
  assert.notEqual(item, null);
  assert.equal(item.type, 'unplanned');
  assert.equal(isMissingNotice(item), false);
});

test('duplicate ids are never rewritten; identical re-save leaves the list unchanged', () => {
  const base = upsertOutageType([], entry());
  assert.equal(base.length, 1);
  const same = upsertOutageType(base, entry());
  assert.deepEqual(same, base);
  const changed = upsertOutageType(base, entry({ noticeNote: 'Different note.' }));
  assert.equal(changed.length, 1);
  assert.equal(changed[0].noticeNote, 'Announced on the mohalla group.');
});

test('removal drops only the named entry and returns a new list', () => {
  const base = upsertOutageType(upsertOutageType([], entry()), entry({ id: 'OT-2', type: 'unplanned', noticeNote: '' }));
  const next = removeOutageType(base, 'OT-1');
  assert.deepEqual(next.map((row) => row.id), ['OT-2']);
  assert.equal(base.length, 2);
  assert.deepEqual(removeOutageType(base, 'OT-9'), base);
});

test('planned and unplanned outages filter separately, newest first', () => {
  const list = [
    entry({ id: 'OT-1', type: 'planned', startDate: '2026-11-01' }),
    entry({ id: 'OT-2', type: 'unplanned', startDate: '2026-11-03', noticeNote: '' }),
    entry({ id: 'OT-3', type: 'planned', startDate: '2026-11-05' }),
  ];
  assert.deepEqual(outagesByType(list, 'planned').map((row) => row.id), ['OT-3', 'OT-1']);
  assert.deepEqual(outagesByType(list, 'unplanned').map((row) => row.id), ['OT-2']);
  assert.deepEqual(outagesByType(list, 'other'), []);
  assert.deepEqual(outagesByType(list, ''), []);
});

test('mohalla filter is case-insensitive and newest first', () => {
  const list = [
    entry({ id: 'OT-1', mohallas: ['Barrian'], startDate: '2026-11-01' }),
    entry({ id: 'OT-2', mohallas: ['Shahdara'], startDate: '2026-11-03' }),
    entry({ id: 'OT-3', mohallas: ['barrian', 'Shahdara'], startDate: '2026-11-05' }),
  ];
  assert.deepEqual(outagesForMohalla(list, 'BARRIAN').map((row) => row.id), ['OT-3', 'OT-1']);
  assert.deepEqual(outagesForMohalla(list, ''), []);
});

test('a planned outage without a notice note is flagged; a planned outage with one is not', () => {
  const flagged = entry({ id: 'OT-1', noticeGiven: true, noticeNote: '   ' });
  const noted = entry({ id: 'OT-2', noticeNote: 'Posted on the group.' });
  const notGivenButNoted = entry({ id: 'OT-3', noticeGiven: false, noticeNote: 'Notice could not be delivered.' });
  assert.equal(isMissingNotice(flagged), true);
  assert.equal(isMissingNotice(noted), false);
  assert.equal(isMissingNotice(notGivenButNoted), false);
  const list = [flagged, noted, notGivenButNoted, entry({ id: 'OT-4', type: 'unplanned', noticeNote: '' })];
  assert.deepEqual(missingNoticeOutages(list).map((row) => row.id), ['OT-1']);
});

test('counts and summary name both kinds and the missing-notice flag', () => {
  assert.deepEqual(outageTypeCounts([]), { planned: 0, unplanned: 0, total: 0, missingNotice: 0 });
  assert.equal(outageTypeSummaryText([]), 'No outage recorded yet.');
  const list = [
    entry({ id: 'OT-1' }),
    entry({ id: 'OT-2', type: 'unplanned', noticeNote: '' }),
    entry({ id: 'OT-3', noticeNote: '' }),
  ];
  assert.deepEqual(outageTypeCounts(list), { planned: 2, unplanned: 1, total: 3, missingNotice: 1 });
  assert.equal(outageTypeSummaryText(list), '3 outages: 2 planned, 1 unplanned; 1 planned outage missing its notice note.');
  const clean = [entry({ id: 'OT-1' }), entry({ id: 'OT-2', type: 'unplanned', noticeNote: '' })];
  assert.equal(outageTypeSummaryText(clean), '2 outages: 1 planned, 1 unplanned; no planned outage missing its notice note.');
});

test('html shows one type with the flag column, and an unknown type asks for a pick', () => {
  const list = [entry({ id: 'OT-1' }), entry({ id: 'OT-2', type: 'unplanned', noticeNote: '' })];
  const planned = outageTypeHtml(list, 'planned');
  assert.match(planned, /OT-1/);
  assert.match(planned, /Barrian, Shahdara/);
  assert.match(planned, /Announced on the mohalla group/);
  assert.doesNotMatch(planned, /OT-2/);
  assert.match(outageTypeHtml(list, 'unplanned'), /OT-2/);
  assert.match(outageTypeHtml([], 'planned'), /No planned outage recorded yet/);
  assert.match(outageTypeHtml(list, 'other'), /Pick planned or unplanned/);
});

test('html escapes user text', () => {
  const list = [entry({ noticeNote: '<script>alert(1)</script>' })];
  assert.doesNotMatch(outageTypeHtml(list, 'planned'), /<script>alert/);
  assert.match(outageTypeHtml(list, 'planned'), /&lt;script&gt;/);
});

test('csv round-trips the fields with mohallas joined, and the filename is stable', () => {
  const list = [entry(), entry({ id: 'OT-2', type: 'unplanned', noticeGiven: false, noticeNote: '' })];
  const csv = outageTypeCsv(list);
  assert.match(csv, /^id,type,mohallas,start_date,end_date,notice_given,notice_note\n/);
  assert.match(csv, /OT-1,planned,Barrian; Shahdara,2026-11-05,2026-11-05,yes,Announced on the mohalla group\./);
  assert.match(csv, /OT-2,unplanned,Barrian; Shahdara,2026-11-05,2026-11-05,no,/);
  assert.equal(outageTypeFilename(), 'outage-type-record.csv');
});

test('csv quotes a note containing a comma', () => {
  const list = [entry({ noticeNote: 'Posted, and pinned.' })];
  assert.match(outageTypeCsv(list), /"Posted, and pinned\."/);
});

test('normalising a list drops half-formed entries and keeps the first of a duplicate id', () => {
  const list = normalizeOutageTypeList([entry(), entry({ id: 'OT-1', noticeNote: 'Changed.' }), entry({ id: 'OT-2', type: 'bad' }), null]);
  assert.deepEqual(list.map((row) => row.id), ['OT-1']);
  assert.equal(list[0].noticeNote, 'Announced on the mohalla group.');
});

test('inputs are never mutated', () => {
  const record = entry();
  const before = JSON.stringify(record);
  const list = [record];
  upsertOutageType(list, entry({ id: 'OT-2' }));
  removeOutageType(list, 'OT-1');
  outagesByType(list, 'planned');
  assert.equal(JSON.stringify(record), before);
  assert.equal(list.length, 1);
});
