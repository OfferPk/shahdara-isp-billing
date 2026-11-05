import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DUTY_ROSTER_DAYS,
  validDutyRosterWeek,
  validDutyRosterDay,
  normalizeDutyRosterEntry,
  normalizeDutyRosterEntryList,
  findDutyRosterEntry,
  findDutyRosterEntryForWeekDay,
  recordDutyRosterEntry,
  removeDutyRosterEntry,
  dutyRosterEntriesForWeek,
  dutyRosterWeeks,
  dutyRosterWeekCoverage,
  dutyRosterEntriesForStaff,
  dutyRosterStaff,
  dutyRosterSummaryText,
  dutyRosterEntryText,
  dutyRosterEntryHtml,
  dutyRosterWeekHtml,
  dutyRosterAllHtml,
  dutyRosterEntriesForStaffHtml,
  dutyRosterCsv,
  dutyRosterFilename,
} from '../duty-roster.js';

const first = {
  id: 'DR-1', week: '2026-11-09', day: 'Monday', staff: 'Saad', duty: 'Shop counter and field visits', postedBy: 'Owner',
};
const second = {
  id: 'DR-2', week: '2026-11-09', day: 'Wednesday', staff: 'Saad', duty: 'Field collection round', postedBy: 'Owner',
};
const third = {
  id: 'DR-3', week: '2026-11-09', day: 'Tuesday', staff: 'Bilal', duty: 'Shop counter', postedBy: 'owner',
};

test('strict week values: real calendar days only', () => {
  assert.equal(validDutyRosterWeek('2026-11-09'), true);
  assert.equal(validDutyRosterWeek('2024-02-29'), true);
  assert.equal(validDutyRosterWeek('2026-02-29'), false);
  assert.equal(validDutyRosterWeek('2026-04-31'), false);
  assert.equal(validDutyRosterWeek('2026-13-01'), false);
  assert.equal(validDutyRosterWeek('2026-11-9'), false);
  assert.equal(validDutyRosterWeek('next week'), false);
});

test('weekdays fold to canonical names', () => {
  assert.equal(validDutyRosterDay('Monday'), 'Monday');
  assert.equal(validDutyRosterDay('mon'), 'Monday');
  assert.equal(validDutyRosterDay('TUESDAY'), 'Tuesday');
  assert.equal(validDutyRosterDay('tues'), 'Tuesday');
  assert.equal(validDutyRosterDay('thur'), 'Thursday');
  assert.equal(validDutyRosterDay('Fri'), 'Friday');
  assert.equal(validDutyRosterDay('Sat'), 'Saturday');
  assert.equal(validDutyRosterDay('sun'), 'Sunday');
  assert.equal(validDutyRosterDay('Funday'), null);
  assert.equal(validDutyRosterDay(''), null);
  assert.equal(validDutyRosterDay(3), null);
  assert.deepEqual(DUTY_ROSTER_DAYS, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
});

test('half-formed entries are refused and unknown fields dropped', () => {
  assert.equal(normalizeDutyRosterEntry({ ...first, id: '' }), null);
  assert.equal(normalizeDutyRosterEntry({ ...first, week: '2026-11-31' }), null);
  assert.equal(normalizeDutyRosterEntry({ ...first, day: 'Funday' }), null);
  assert.equal(normalizeDutyRosterEntry({ ...first, staff: '  ' }), null);
  assert.equal(normalizeDutyRosterEntry({ ...first, duty: '' }), null);
  assert.equal(normalizeDutyRosterEntry({ ...first, postedBy: '' }), null);
  assert.equal(normalizeDutyRosterEntry(null), null);
  assert.equal(normalizeDutyRosterEntry([first]), null);
  const clean = normalizeDutyRosterEntry({ ...first, billAmount: 3000, customerId: 'C-1', leaveDays: 2 });
  assert.deepEqual(clean, first);
  assert.deepEqual(normalizeDutyRosterEntry({ ...first, day: 'wed' }), { ...first, day: 'Wednesday' });
});

test('normalising a list drops bad entries and keeps the first id', () => {
  assert.deepEqual(normalizeDutyRosterEntryList('nope'), []);
  assert.deepEqual(normalizeDutyRosterEntryList([first, { ...second, id: 'DR-1' }, null]), [first]);
  assert.deepEqual(normalizeDutyRosterEntryList([first, second]), [first, second]);
});

test('recording refuses a duplicate id and a duplicate week and day', () => {
  const list = [first];
  assert.deepEqual(recordDutyRosterEntry(list, { ...second, id: 'DR-1' }), [first]);
  assert.deepEqual(recordDutyRosterEntry(list, { ...first, id: 'DR-9' }), [first]);
  assert.deepEqual(recordDutyRosterEntry(list, { ...first, id: 'DR-9', day: 'Tuesday' }), [first, { ...first, id: 'DR-9', day: 'Tuesday' }]);
  assert.deepEqual(recordDutyRosterEntry(list, { ...first, id: '' }), [first]);
});

test('find by id and by week and day', () => {
  const list = [first, second, third];
  assert.deepEqual(findDutyRosterEntry(list, 'DR-2'), second);
  assert.equal(findDutyRosterEntry(list, 'DR-9'), null);
  assert.equal(findDutyRosterEntry(list, ''), null);
  assert.deepEqual(findDutyRosterEntryForWeekDay(list, '2026-11-09', 'wed'), second);
  assert.equal(findDutyRosterEntryForWeekDay(list, '2026-11-09', 'Friday'), null);
  assert.equal(findDutyRosterEntryForWeekDay(list, '2026-11-09', 'Funday'), null);
});

test('removing drops only that entry', () => {
  const list = [first, second, third];
  assert.deepEqual(removeDutyRosterEntry(list, 'DR-2'), [first, third]);
  assert.deepEqual(removeDutyRosterEntry(list, 'DR-9'), list);
  assert.deepEqual(removeDutyRosterEntry(list, ''), list);
});

test('entries for a week read Monday first', () => {
  const list = [second, first, third];
  assert.deepEqual(dutyRosterEntriesForWeek(list, '2026-11-09'), [first, third, second]);
  assert.deepEqual(dutyRosterEntriesForWeek(list, '2026-11-16'), []);
  assert.deepEqual(dutyRosterEntriesForWeek(list, ''), []);
});

test('weeks list earliest first', () => {
  const list = [first, { ...first, id: 'DR-4', week: '2026-11-02', day: 'Friday' }];
  assert.deepEqual(dutyRosterWeeks(list), ['2026-11-02', '2026-11-09']);
  assert.deepEqual(dutyRosterWeeks([]), []);
});

test('week coverage names the uncovered days', () => {
  const list = [first, second, third];
  assert.deepEqual(dutyRosterWeekCoverage(list, '2026-11-09'), {
    week: '2026-11-09',
    covered: ['Monday', 'Tuesday', 'Wednesday'],
    missing: ['Thursday', 'Friday', 'Saturday', 'Sunday'],
  });
  const full = DUTY_ROSTER_DAYS.map((day, index) => ({ ...first, id: `DR-F${index}`, day }));
  assert.deepEqual(dutyRosterWeekCoverage(full, '2026-11-09').missing, []);
  assert.deepEqual(dutyRosterWeekCoverage([], '2026-11-09').covered, []);
  assert.deepEqual(dutyRosterWeekCoverage([], '2026-11-09').missing, DUTY_ROSTER_DAYS);
});

test('entries for one staff member, case-insensitive, week then day order', () => {
  const later = { ...first, id: 'DR-5', week: '2026-11-16', day: 'Friday' };
  const list = [second, later, first];
  assert.deepEqual(dutyRosterEntriesForStaff(list, 'saad'), [first, second, later]);
  assert.deepEqual(dutyRosterEntriesForStaff(list, 'Bilal'), []);
  assert.deepEqual(dutyRosterEntriesForStaff(list, ''), []);
});

test('staff list keeps first spelling and reads A-Z', () => {
  const list = [first, { ...third, staff: 'saad' }, { ...second, staff: 'Bilal' }];
  assert.deepEqual(dutyRosterStaff(list), ['Bilal', 'Saad']);
  assert.deepEqual(dutyRosterStaff([]), []);
});

test('summary names count, weeks, and the gaps in the latest week', () => {
  assert.equal(dutyRosterSummaryText([]), 'No staff duty roster entries recorded.');
  assert.equal(
    dutyRosterSummaryText([first, second, third]),
    '3 roster entries across 1 week. Latest week: 2026-11-09, 4 days still uncovered (Thursday, Friday, Saturday, Sunday).',
  );
  const full = DUTY_ROSTER_DAYS.map((day, index) => ({ ...first, id: `DR-G${index}`, day }));
  assert.equal(
    dutyRosterSummaryText(full),
    '7 roster entries across 1 week. Latest week: 2026-11-09, every day covered.',
  );
});

test('entry text names week, day, staff, duty, and poster', () => {
  assert.equal(
    dutyRosterEntryText(first),
    '2026-11-09 Monday — Saad on duty: Shop counter and field visits (posted by Owner).',
  );
  assert.equal(dutyRosterEntryText({ ...first, id: '' }), '');
});

test('week html shows every day with staff visible and gaps named', () => {
  const html = dutyRosterWeekHtml([first, second, third], '2026-11-09');
  assert.match(html, /Monday — Saad on duty: Shop counter and field visits/);
  assert.match(html, /Tuesday — Bilal on duty: Shop counter/);
  assert.match(html, /Thursday — No one posted yet\./);
  assert.match(html, /Sunday — No one posted yet\./);
  assert.equal(dutyRosterWeekHtml([], '2026-11-09').match(/No one posted yet/g).length, 7);
  assert.equal(dutyRosterWeekHtml([first], 'pick a week'), '<p>Pick a week to see its duty roster.</p>');
});

test('entry html escapes user text', () => {
  const nasty = { ...first, staff: '<b>Saad</b>', duty: 'Shop & field <work>' };
  assert.equal(dutyRosterEntryHtml(nasty), '<li>2026-11-09 Monday — &lt;b&gt;Saad&lt;/b&gt; on duty: Shop &amp; field &lt;work&gt; (posted by Owner).</li>');
  assert.equal(dutyRosterEntryHtml({ ...first, id: '' }), '');
});

test('all html groups by week and staff html lists only that person', () => {
  assert.equal(dutyRosterAllHtml([]), '<p>No staff duty roster entries recorded.</p>');
  const html = dutyRosterAllHtml([first, { ...first, id: 'DR-6', week: '2026-11-16', day: 'Friday' }]);
  assert.match(html, /Week of 2026-11-09/);
  assert.match(html, /Week of 2026-11-16/);
  assert.match(html, /Friday — Saad on duty/);
  assert.match(dutyRosterEntriesForStaffHtml([first, second, third], 'bilal'), /Tuesday — Bilal on duty/);
  assert.doesNotMatch(dutyRosterEntriesForStaffHtml([first, second, third], 'bilal'), /Monday — Saad/);
  assert.equal(dutyRosterEntriesForStaffHtml([first], 'Nobody'), '<p>No roster entries for that staff member.</p>');
});

test('csv sorts by week then day and quotes tricky cells', () => {
  const tricky = { id: 'DR-7', week: '2026-11-09', day: 'Friday', staff: 'Saad', duty: 'Shop, "counter" duty', postedBy: 'Owner' };
  const csv = dutyRosterCsv([second, first, tricky]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,week,day,staff,duty,postedBy');
  assert.equal(lines[1], 'DR-1,2026-11-09,Monday,Saad,Shop counter and field visits,Owner');
  assert.equal(lines[2], 'DR-2,2026-11-09,Wednesday,Saad,Field collection round,Owner');
  assert.equal(lines[3], 'DR-7,2026-11-09,Friday,Saad,"Shop, ""counter"" duty",Owner');
  assert.equal(dutyRosterCsv([]), 'id,week,day,staff,duty,postedBy');
  assert.equal(dutyRosterFilename(), 'duty-roster.csv');
});

test('inputs are never mutated', () => {
  const raw = { ...first, extra: 'drop me' };
  const snapshot = JSON.stringify(raw);
  normalizeDutyRosterEntry(raw);
  recordDutyRosterEntry([], raw);
  assert.equal(JSON.stringify(raw), snapshot);
});
