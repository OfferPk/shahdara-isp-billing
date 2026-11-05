import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validStaffLeaveDate,
  validStaffLeaveMonth,
  foldStaffLeaveStatus,
  staffLeaveDaysBetween,
  normalizeStaffLeave,
  normalizeStaffLeaveList,
  findStaffLeave,
  recordStaffLeave,
  removeStaffLeave,
  staffLeaveDays,
  staffLeaveSorted,
  staffLeaveForStaff,
  staffLeaveStaffList,
  staffLeaveForMonth,
  staffLeaveTotalDays,
  staffLeaveSummaryText,
  staffLeaveEntryText,
  staffLeaveEntryHtml,
  staffLeaveStaffHtml,
  staffLeaveMonthHtml,
  staffLeaveAllHtml,
  staffLeaveCsv,
  staffLeaveFilename,
} from '../staff-leave.js';

const first = {
  id: 'LV-1',
  staffMember: 'Saad',
  startDate: '2026-11-02',
  endDate: '2026-11-04',
  leaveType: 'Annual leave',
  approver: 'Aqib',
  status: 'approved',
};
const second = {
  id: 'LV-2',
  staffMember: 'Saad',
  startDate: '2026-11-20',
  endDate: '2026-11-20',
  leaveType: 'Sick leave',
  approver: 'Aqib',
  status: 'taken',
};
const third = {
  id: 'LV-3',
  staffMember: 'Bilal',
  startDate: '2026-10-30',
  endDate: '2026-11-02',
  leaveType: 'Family leave',
  approver: 'Aqib',
  status: 'pending',
};
const fourth = {
  id: 'LV-4',
  staffMember: 'saad',
  startDate: '2026-12-01',
  endDate: '2026-12-03',
  leaveType: 'Annual leave',
  approver: 'Aqib',
  status: 'approved',
};
const fixture = [third, first, fourth, second];

test('half-formed entries are refused, and a missing status reads as pending', () => {
  assert.equal(normalizeStaffLeave(null), null);
  assert.equal(normalizeStaffLeave('nope'), null);
  assert.equal(normalizeStaffLeave({ ...first, id: '' }), null);
  assert.equal(normalizeStaffLeave({ ...first, staffMember: '' }), null);
  assert.equal(normalizeStaffLeave({ ...first, startDate: '' }), null);
  assert.equal(normalizeStaffLeave({ ...first, startDate: '2026-11-32' }), null);
  assert.equal(normalizeStaffLeave({ ...first, endDate: '' }), null);
  assert.equal(normalizeStaffLeave({ ...first, endDate: '2026-11-01' }), null);
  assert.equal(normalizeStaffLeave({ ...first, leaveType: '' }), null);
  assert.equal(normalizeStaffLeave({ ...first, leaveType: '   ' }), null);
  assert.equal(normalizeStaffLeave({ ...first, approver: '' }), null);
  const minimal = normalizeStaffLeave({ id: 'LV-9', staffMember: 'Saad', startDate: '2026-11-05', endDate: '2026-11-06', leaveType: 'Annual leave', approver: 'Aqib' });
  assert.deepEqual(minimal, { id: 'LV-9', staffMember: 'Saad', startDate: '2026-11-05', endDate: '2026-11-06', leaveType: 'Annual leave', approver: 'Aqib', status: 'pending' });
  assert.deepEqual(normalizeStaffLeave(first), first);
});

test('strict dates: only real calendar dates pass', () => {
  assert.equal(validStaffLeaveDate('2026-11-01'), true);
  assert.equal(validStaffLeaveDate('2024-02-29'), true);
  assert.equal(validStaffLeaveDate('2026-02-29'), false);
  assert.equal(validStaffLeaveDate('2026-04-31'), false);
  assert.equal(validStaffLeaveDate('2026-13-01'), false);
  assert.equal(validStaffLeaveDate('2026-00-10'), false);
  assert.equal(validStaffLeaveDate('2026-11-00'), false);
  assert.equal(validStaffLeaveDate('01-11-2026'), false);
  assert.equal(validStaffLeaveDate('2026/11/01'), false);
  assert.equal(validStaffLeaveDate(20261101), false);
  assert.equal(validStaffLeaveDate(''), false);
});

test('strict months: only real calendar months pass', () => {
  assert.equal(validStaffLeaveMonth('2026-11'), true);
  assert.equal(validStaffLeaveMonth('2026-02'), true);
  assert.equal(validStaffLeaveMonth('2026-13'), false);
  assert.equal(validStaffLeaveMonth('2026-00'), false);
  assert.equal(validStaffLeaveMonth('2026-1'), false);
  assert.equal(validStaffLeaveMonth('2026-11-01'), false);
  assert.equal(validStaffLeaveMonth(''), false);
  assert.equal(validStaffLeaveMonth(null), false);
});

test('status folds from plain spellings, unclear reads as pending', () => {
  assert.equal(foldStaffLeaveStatus('approved'), 'approved');
  assert.equal(foldStaffLeaveStatus('approve'), 'approved');
  assert.equal(foldStaffLeaveStatus('YES'), 'approved');
  assert.equal(foldStaffLeaveStatus('true'), 'approved');
  assert.equal(foldStaffLeaveStatus('taken'), 'taken');
  assert.equal(foldStaffLeaveStatus('declined'), 'declined');
  assert.equal(foldStaffLeaveStatus('decline'), 'declined');
  assert.equal(foldStaffLeaveStatus('rejected'), 'declined');
  assert.equal(foldStaffLeaveStatus('no'), 'declined');
  assert.equal(foldStaffLeaveStatus('pending'), 'pending');
  assert.equal(foldStaffLeaveStatus('requested'), 'pending');
  assert.equal(foldStaffLeaveStatus('awaiting'), 'pending');
  assert.equal(foldStaffLeaveStatus('maybe'), 'pending');
  assert.equal(foldStaffLeaveStatus(''), 'pending');
  assert.equal(foldStaffLeaveStatus(undefined), 'pending');
});

test('days between: inclusive whole days, leap-year crossing, end before start is null', () => {
  assert.equal(staffLeaveDaysBetween('2026-11-02', '2026-11-02'), 1);
  assert.equal(staffLeaveDaysBetween('2026-11-02', '2026-11-04'), 3);
  assert.equal(staffLeaveDaysBetween('2024-02-28', '2024-03-01'), 3);
  assert.equal(staffLeaveDaysBetween('2026-02-28', '2026-03-01'), 2);
  assert.equal(staffLeaveDaysBetween('2026-10-30', '2026-11-02'), 4);
  assert.equal(staffLeaveDaysBetween('2026-11-04', '2026-11-02'), null);
  assert.equal(staffLeaveDaysBetween('2026-11-32', '2026-11-04'), null);
  assert.equal(staffLeaveDaysBetween('2026-11-02', ''), null);
  assert.equal(staffLeaveDays(first), 3);
  assert.equal(staffLeaveDays(second), 1);
  assert.equal(staffLeaveDays({ ...first, endDate: '2026-11-01' }), null);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, bill: 'B-1', payment: 1000, customer: 'C-1', rota: 'R-1', extra: 'x' };
  const out = normalizeStaffLeave(raw);
  assert.deepEqual(out, first);
  assert.equal(raw.bill, 'B-1');
  assert.equal(raw.payment, 1000);
  assert.deepEqual(normalizeStaffLeave(raw), first);
  const list = [first];
  recordStaffLeave(list, second);
  assert.deepEqual(list, [first]);
});

test('duplicate ids are never rewritten', () => {
  const out = recordStaffLeave([first], { ...first, leaveType: 'Sick leave' });
  assert.deepEqual(out, [first]);
  assert.equal(out[0].leaveType, 'Annual leave');
  assert.equal(recordStaffLeave([first], { ...first, id: 'LV-2' }).length, 2);
});

test('find and remove', () => {
  assert.deepEqual(findStaffLeave(fixture, 'LV-2'), second);
  assert.equal(findStaffLeave(fixture, 'LV-9'), null);
  assert.equal(findStaffLeave(fixture, ''), null);
  assert.deepEqual(removeStaffLeave(fixture, 'LV-1').map((entry) => entry.id), ['LV-3', 'LV-4', 'LV-2']);
  assert.deepEqual(removeStaffLeave(fixture, 'LV-9'), fixture);
});

test('sorting: start date, then staff member A-Z, then id', () => {
  assert.deepEqual(staffLeaveSorted(fixture).map((entry) => entry.id), ['LV-3', 'LV-1', 'LV-2', 'LV-4']);
  const sameDay = [
    { ...second, id: 'LV-8', staffMember: 'Bilal' },
    { ...second, id: 'LV-7', staffMember: 'Bilal' },
    { ...second, id: 'LV-6', staffMember: 'Aqib' },
  ];
  assert.deepEqual(staffLeaveSorted(sameDay).map((entry) => entry.id), ['LV-6', 'LV-7', 'LV-8']);
});

test('leave per staff member: case-insensitive, date order, first spelling kept', () => {
  assert.deepEqual(staffLeaveForStaff(fixture, 'saad').map((entry) => entry.id), ['LV-1', 'LV-2', 'LV-4']);
  assert.deepEqual(staffLeaveForStaff(fixture, 'SAAD').map((entry) => entry.id), ['LV-1', 'LV-2', 'LV-4']);
  assert.deepEqual(staffLeaveForStaff(fixture, 'Bilal').map((entry) => entry.id), ['LV-3']);
  assert.deepEqual(staffLeaveForStaff(fixture, ''), []);
  assert.deepEqual(staffLeaveStaffList(fixture), ['Bilal', 'Saad']);
  assert.deepEqual(staffLeaveStaffList([]), []);
});

test('leave per month: an entry counts in every month it overlaps', () => {
  assert.deepEqual(staffLeaveForMonth(fixture, '2026-11').map((entry) => entry.id), ['LV-3', 'LV-1', 'LV-2']);
  assert.deepEqual(staffLeaveForMonth(fixture, '2026-10').map((entry) => entry.id), ['LV-3']);
  assert.deepEqual(staffLeaveForMonth(fixture, '2026-12').map((entry) => entry.id), ['LV-4']);
  assert.deepEqual(staffLeaveForMonth(fixture, '2026-09'), []);
  assert.deepEqual(staffLeaveForMonth(fixture, '2026-13'), []);
  assert.deepEqual(staffLeaveForMonth(fixture, '2026-1'), []);
  assert.deepEqual(staffLeaveForMonth(fixture, ''), []);
});

test('total leave days per staff member', () => {
  assert.equal(staffLeaveTotalDays(fixture, 'Saad'), 7);
  assert.equal(staffLeaveTotalDays(fixture, 'Bilal'), 4);
  assert.equal(staffLeaveTotalDays(fixture, 'Nobody'), 0);
});

test('summary and entry text name dates, approver, and status', () => {
  assert.equal(staffLeaveSummaryText([]), 'No staff leave recorded.');
  assert.equal(staffLeaveSummaryText(fixture), '4 staff leave entries recorded. Latest leave starts 2026-12-01.');
  assert.equal(staffLeaveSummaryText([first]), '1 staff leave entry recorded. Latest leave starts 2026-11-02.');
  assert.equal(staffLeaveEntryText(first), 'Saad — 2026-11-02 to 2026-11-04 (3 days), Annual leave — approved by Aqib — approved');
  assert.equal(staffLeaveEntryText(second), 'Saad — 2026-11-20 (1 day), Sick leave — approved by Aqib — taken');
  assert.equal(staffLeaveEntryText(null), 'No staff leave recorded.');
});

test('html escapes markup and names the staff member, month, and totals', () => {
  assert.equal(staffLeaveEntryHtml({ ...first, staffMember: '<b>Saad</b>' }), '<p>&lt;b&gt;Saad&lt;/b&gt; — 2026-11-02 to 2026-11-04 (3 days), Annual leave — approved by Aqib — approved</p>');
  assert.equal(staffLeaveEntryHtml(null), '<p>No staff leave recorded.</p>');
  const staffHtml = staffLeaveStaffHtml(fixture, 'Saad');
  assert.equal(staffHtml.includes('Saad — 7 days of leave recorded.'), true);
  assert.equal(staffHtml.includes('2026-11-02 to 2026-11-04'), true);
  assert.equal(staffLeaveStaffHtml(fixture, 'Nobody'), '<p>No leave recorded for Nobody.</p>');
  const monthHtml = staffLeaveMonthHtml(fixture, '2026-11');
  assert.equal(monthHtml.includes('Leave in 2026-11:'), true);
  assert.equal(monthHtml.includes('approved by Aqib'), true);
  assert.equal(staffLeaveMonthHtml(fixture, '2026-09'), '<p>No leave recorded for 2026-09.</p>');
  assert.equal(staffLeaveMonthHtml(fixture, '2026-13'), '<p>No leave recorded for this month.</p>');
  assert.equal(staffLeaveAllHtml([]), '<p>No staff leave recorded.</p>');
  assert.equal(staffLeaveAllHtml(fixture).includes('Bilal — 2026-10-30 to 2026-11-02'), true);
});

test('csv export and filename', () => {
  const csv = staffLeaveCsv(fixture);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","staff member","start date","end date","days","leave type","approver","status"');
  assert.equal(lines.length, 5);
  assert.equal(lines[1].includes('"LV-3"'), true);
  assert.equal(lines[1].includes('"4"'), true);
  assert.equal(lines[1].includes('"Family leave"'), true);
  assert.equal(lines[2].includes('"LV-1"'), true);
  assert.equal(lines[2].includes('"3"'), true);
  assert.equal(lines[2].includes('"approved"'), true);
  assert.equal(lines[3].includes('"LV-2"'), true);
  assert.equal(lines[3].includes('"taken"'), true);
  assert.equal(lines[4].includes('"LV-4"'), true);
  assert.equal(staffLeaveCsv([]), '"id","staff member","start date","end date","days","leave type","approver","status"');
  assert.equal(staffLeaveFilename(), 'staff-leave.csv');
});

test('list normalisation drops bad entries and keeps the first duplicate', () => {
  const bad = { ...first, id: '' };
  const out = normalizeStaffLeaveList([bad, first, { ...first, leaveType: 'Sick leave' }, second, 'nope', null]);
  assert.deepEqual(out.map((entry) => entry.id), ['LV-1', 'LV-2']);
  assert.equal(out[0].leaveType, 'Annual leave');
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../staff-leave.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the on-call rota is untouched', () => {
  const source = readFileSync(new URL('../staff-leave.js', import.meta.url), 'utf8');
  assert.equal(source.includes('oncall-rota.js'), false, 'module must not reference the on-call rota module');
  assert.equal(existsSync(new URL('../oncall-rota.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'slvHeading', 'slvSummary', 'slvExportBtn', 'slvStaffMember', 'slvStartDate',
    'slvEndDate', 'slvLeaveType', 'slvApprover', 'slvStatus', 'slvRecordBtn',
    'slvRemoveId', 'slvRemoveBtn', 'slvStaffFilter', 'slvStaffBtn', 'slvStaffBody',
    'slvMonthFilter', 'slvMonthBtn', 'slvMonthBody', 'slvBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the staff leave panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './staff-leave.js'"), true);
  assert.equal(source.includes('renderStaffLeave()'), true);
  assert.equal(source.includes('loadStaffLeave()'), true);
  assert.equal(source.includes('shahdara_staff_leave_v1'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
