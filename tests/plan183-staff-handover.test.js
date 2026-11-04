import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeStaffHandover,
  normalizeStaffHandoverList,
  findStaffHandover,
  recordStaffHandover,
  removeStaffHandover,
  markStaffHandoverReceived,
  markStaffHandoverNotReceived,
  staffHandoversSorted,
  staffHandoversForPerson,
  staffHandoversReceived,
  staffHandoversNotReceived,
  staffHandoverPersons,
  staffHandoverText,
  staffHandoverSummaryText,
  staffHandoverHtml,
  staffHandoverAllHtml,
  staffHandoverCsv,
  staffHandoverFilename,
} from '../staff-handover.js';

const dir = dirname(fileURLToPath(import.meta.url));

const note = (over = {}) => ({
  id: 'SH-1',
  fromPerson: 'Saad',
  toPerson: 'Bilal',
  date: '2026-11-01',
  routine: 'Open the shop and count the cash box',
  openTask: 'Collect from Mohalla A',
  note: 'Keys are in the top drawer',
  ...over,
});

test('half-formed handover is refused', () => {
  assert.equal(normalizeStaffHandover(note({ fromPerson: '' })), null);
  assert.equal(normalizeStaffHandover(note({ toPerson: '' })), null);
  assert.equal(normalizeStaffHandover(note({ routine: '' })), null);
  assert.equal(normalizeStaffHandover(note({ id: '' })), null);
  assert.equal(normalizeStaffHandover(note({ date: '' })), null);
  assert.equal(recordStaffHandover([], note({ fromPerson: '' })).length, 0);
});

test('strict dates only, including 31-day months and Feb 29', () => {
  assert.ok(normalizeStaffHandover(note({ date: '2026-08-31' })));
  assert.ok(normalizeStaffHandover(note({ date: '2024-02-29' })));
  assert.equal(normalizeStaffHandover(note({ date: '2026-02-29' })), null);
  assert.equal(normalizeStaffHandover(note({ date: '2026-02-30' })), null);
  assert.equal(normalizeStaffHandover(note({ date: '2026-13-01' })), null);
  assert.equal(normalizeStaffHandover(note({ date: '01-11-2026' })), null);
});

test('received note needs a strict received date', () => {
  assert.ok(normalizeStaffHandover(note({ received: true, receivedDate: '2026-11-02' })));
  assert.equal(normalizeStaffHandover(note({ received: true, receivedDate: '' })), null);
  assert.equal(normalizeStaffHandover(note({ received: true, receivedDate: '2026-02-30' })), null);
  const plain = normalizeStaffHandover(note());
  assert.equal(plain.received, false);
  assert.equal(plain.receivedDate, '');
});

test('unknown fields are dropped', () => {
  const item = normalizeStaffHandover(note({ billId: 'B-1', payment: 500, taskClosed: true }));
  assert.equal(item.billId, undefined);
  assert.equal(item.payment, undefined);
  assert.equal(item.taskClosed, undefined);
});

test('duplicate ids are never rewritten', () => {
  const one = recordStaffHandover([], note());
  assert.equal(recordStaffHandover(one, note()).length, 1);
  assert.equal(recordStaffHandover(one, note({ routine: 'Different routine' })).length, 1);
  assert.equal(recordStaffHandover(one, note())[0].routine, 'Open the shop and count the cash box');
});

test('find and remove', () => {
  const list = recordStaffHandover([], note());
  assert.equal(findStaffHandover(list, 'SH-1').toPerson, 'Bilal');
  assert.equal(findStaffHandover(list, 'SH-9'), null);
  assert.equal(removeStaffHandover(list, 'SH-1').length, 0);
  assert.equal(removeStaffHandover(list, 'SH-9').length, 1);
});

test('mark received needs a strict date and leaves bad dates unchanged', () => {
  const list = recordStaffHandover([], note());
  const received = markStaffHandoverReceived(list, 'SH-1', '2026-11-03');
  assert.equal(received[0].received, true);
  assert.equal(received[0].receivedDate, '2026-11-03');
  assert.equal(markStaffHandoverReceived(list, 'SH-1', '2026-02-30')[0].received, false);
  assert.equal(markStaffHandoverReceived(list, 'SH-9', '2026-11-03').length, 1);
  const cleared = markStaffHandoverNotReceived(received, 'SH-1');
  assert.equal(cleared[0].received, false);
  assert.equal(cleared[0].receivedDate, '');
});

test('sorted newest first, then id A-Z', () => {
  const list = [note({ id: 'SH-2', date: '2026-11-01' }), note({ id: 'SH-1', date: '2026-11-05' }), note({ id: 'SH-3', date: '2026-11-01' })];
  assert.deepEqual(staffHandoversSorted(list).map((item) => item.id), ['SH-1', 'SH-2', 'SH-3']);
});

test('person view matches from or to, case-insensitively', () => {
  const list = [note(), note({ id: 'SH-2', fromPerson: 'Bilal', toPerson: 'Usman', date: '2026-11-02' })];
  assert.deepEqual(staffHandoversForPerson(list, 'bilal').map((item) => item.id), ['SH-2', 'SH-1']);
  assert.deepEqual(staffHandoversForPerson(list, 'SAAD').map((item) => item.id), ['SH-1']);
  assert.deepEqual(staffHandoversForPerson(list, 'Nobody'), []);
});

test('received and not-received lists split cleanly', () => {
  const list = [note(), note({ id: 'SH-2', received: true, receivedDate: '2026-11-02' })];
  assert.deepEqual(staffHandoversReceived(list).map((item) => item.id), ['SH-2']);
  assert.deepEqual(staffHandoversNotReceived(list).map((item) => item.id), ['SH-1']);
});

test('persons list keeps first spelling, sorted A-Z', () => {
  const list = [note(), note({ id: 'SH-2', fromPerson: 'saad', toPerson: 'Zain' })];
  assert.deepEqual(staffHandoverPersons(list), ['Bilal', 'Saad', 'Zain']);
});

test('handover text states routine, task, note, and received state', () => {
  assert.equal(
    staffHandoverText(note()),
    'Handover on 2026-11-01: Saad to Bilal — routine: Open the shop and count the cash box. Open task: Collect from Mohalla A. Note: Keys are in the top drawer. Not yet received.',
  );
  assert.match(staffHandoverText(note({ received: true, receivedDate: '2026-11-02' })), /Received on 2026-11-02\./);
  assert.equal(staffHandoverText(null), '');
});

test('summary counts received and not yet received', () => {
  const list = [note(), note({ id: 'SH-2', received: true, receivedDate: '2026-11-02' })];
  assert.equal(staffHandoverSummaryText(list), '2 staff handover notes, 1 received, 1 not yet received');
  assert.equal(staffHandoverSummaryText([]), '0 staff handover notes, 0 received, 0 not yet received');
});

test('html escapes and all-html lists newest first', () => {
  const html = staffHandoverHtml(note({ routine: '<script>alert(1)</script>' }));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  const all = staffHandoverAllHtml([note(), note({ id: 'SH-2', date: '2026-11-05' })]);
  assert.ok(all.indexOf('2026-11-05') < all.indexOf('2026-11-01'));
});

test('csv and filename', () => {
  const csv = staffHandoverCsv([note()]);
  assert.ok(csv.startsWith('"id","from","to","date","routine","open task","note","received","received date"'));
  assert.ok(csv.includes('"SH-1","Saad","Bilal","2026-11-01"'));
  assert.equal(staffHandoverFilename(), 'staff-handovers.csv');
});

test('inputs are never mutated', () => {
  const input = note();
  const snapshot = JSON.stringify(input);
  recordStaffHandover([], input);
  normalizeStaffHandover(input);
  assert.equal(JSON.stringify(input), snapshot);
});

test('list normalization drops bad entries and duplicate ids', () => {
  const list = normalizeStaffHandoverList([note(), note({ routine: '' }), null, note(), 'nope']);
  assert.equal(list.length, 1);
  assert.equal(normalizeStaffHandoverList('nope').length, 0);
  assert.equal(normalizeStaffHandoverList(null).length, 0);
});

test('purity fence: module reads no storage, clock, or network', () => {
  const source = readFileSync(join(dir, '..', 'staff-handover.js'), 'utf8');
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('new Date('));
  assert.ok(!source.includes('Date.now('));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('import '));
});

test('panel element ids are present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  const ids = [
    'shHeading', 'shSummary', 'shExportBtn',
    'shFrom', 'shTo', 'shDate', 'shRoutine', 'shTask', 'shNote', 'shSaveBtn',
    'shReceivedId', 'shReceivedDate', 'shReceivedBtn',
    'shUnreceivedId', 'shUnreceivedBtn',
    'shRemoveId', 'shRemoveBtn',
    'shFilter', 'shBody',
  ];
  for (const id of ids) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wires the staff handover panel and render loop', () => {
  const app = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.ok(app.includes('staff-handover.js'));
  assert.ok(app.includes('renderStaffHandover'));
  assert.ok(app.includes('shahdara_staff_handovers_v1'));
  assert.doesNotMatch(app, /\b(?:suspendService|restoreService|RouterOS|RADIUS|OLT)\b/);
});
