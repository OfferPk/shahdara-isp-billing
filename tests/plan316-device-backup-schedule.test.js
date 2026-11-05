import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validDeviceBackupScheduleDay,
  foldDeviceBackupScheduleFrequency,
  deviceBackupScheduleNextDueDate,
  normalizeDeviceBackupSchedule,
  normalizeDeviceBackupScheduleList,
  findDeviceBackupSchedule,
  recordDeviceBackupSchedule,
  removeDeviceBackupSchedule,
  recordDeviceBackup,
  deviceBackupSchedulesSorted,
  deviceBackupScheduleIsOverdue,
  overdueDeviceBackupSchedules,
  deviceBackupSchedulesForDevice,
  deviceBackupScheduleDevices,
  deviceBackupScheduleSummaryText,
  deviceBackupScheduleText,
  deviceBackupScheduleHtml,
  deviceBackupScheduleAllHtml,
  overdueDeviceBackupSchedulesHtml,
  deviceBackupScheduleCsv,
  deviceBackupScheduleFilename,
} from '../device-backup-schedule.js';

const dailyShop = {
  id: 'DBS-1', device: 'Shop laptop', frequency: 'daily',
  lastBackupDate: '2026-11-04', nextBackupDue: '2026-11-05', owner: 'Owner',
};
const weeklyPhone = {
  id: 'DBS-2', device: 'Field phone', frequency: 'weekly',
  lastBackupDate: '2026-10-29', nextBackupDue: '2026-11-05', owner: 'Saad',
};
const monthlySpare = {
  id: 'DBS-3', device: 'Spare laptop', frequency: 'monthly',
  lastBackupDate: '2026-10-05', nextBackupDue: '2026-11-05', owner: 'Owner',
};
const noBackupYet = {
  id: 'DBS-4', device: 'New tablet', frequency: 'weekly',
  lastBackupDate: '', nextBackupDue: '', owner: 'Owner',
};

test('strict day accepts a real date and refuses impossible or malformed days', () => {
  assert.equal(validDeviceBackupScheduleDay('2026-11-04'), true);
  assert.equal(validDeviceBackupScheduleDay('2028-02-29'), true);
  assert.equal(validDeviceBackupScheduleDay('2027-02-29'), false);
  assert.equal(validDeviceBackupScheduleDay('2026-11-31'), false);
  assert.equal(validDeviceBackupScheduleDay('04-11-2026'), false);
  assert.equal(validDeviceBackupScheduleDay(''), false);
  assert.equal(validDeviceBackupScheduleDay(null), false);
});

test('frequency folds from plain spellings and a missing or unknown frequency reads as empty', () => {
  assert.equal(foldDeviceBackupScheduleFrequency('Daily'), 'daily');
  assert.equal(foldDeviceBackupScheduleFrequency('every day'), 'daily');
  assert.equal(foldDeviceBackupScheduleFrequency('EVERY WEEK'), 'weekly');
  assert.equal(foldDeviceBackupScheduleFrequency('each month'), 'monthly');
  assert.equal(foldDeviceBackupScheduleFrequency('fortnightly'), '');
  assert.equal(foldDeviceBackupScheduleFrequency(''), '');
  assert.equal(foldDeviceBackupScheduleFrequency(undefined), '');
});

test('next due date moves forward by the schedule: daily one day, weekly seven days', () => {
  assert.equal(deviceBackupScheduleNextDueDate('2026-11-04', 'daily'), '2026-11-05');
  assert.equal(deviceBackupScheduleNextDueDate('2026-11-30', 'daily'), '2026-12-01');
  assert.equal(deviceBackupScheduleNextDueDate('2026-12-31', 'daily'), '2027-01-01');
  assert.equal(deviceBackupScheduleNextDueDate('2026-10-29', 'weekly'), '2026-11-05');
  assert.equal(deviceBackupScheduleNextDueDate('2026-12-28', 'weekly'), '2027-01-04');
  assert.equal(deviceBackupScheduleNextDueDate('2028-02-28', 'daily'), '2028-02-29');
  assert.equal(deviceBackupScheduleNextDueDate('2027-02-28', 'daily'), '2027-03-01');
});

test('next due date for monthly adds one calendar month and clamps to a shorter month', () => {
  assert.equal(deviceBackupScheduleNextDueDate('2026-10-05', 'monthly'), '2026-11-05');
  assert.equal(deviceBackupScheduleNextDueDate('2026-12-15', 'monthly'), '2027-01-15');
  assert.equal(deviceBackupScheduleNextDueDate('2026-01-31', 'monthly'), '2026-02-28');
  assert.equal(deviceBackupScheduleNextDueDate('2028-01-31', 'monthly'), '2028-02-29');
  assert.equal(deviceBackupScheduleNextDueDate('2026-03-31', 'monthly'), '2026-04-30');
});

test('next due date refuses a bad day or an unknown frequency', () => {
  assert.equal(deviceBackupScheduleNextDueDate('2026-11-31', 'daily'), '');
  assert.equal(deviceBackupScheduleNextDueDate('not a date', 'daily'), '');
  assert.equal(deviceBackupScheduleNextDueDate('2026-11-04', 'fortnightly'), '');
  assert.equal(deviceBackupScheduleNextDueDate('2026-11-04', ''), '');
});

test('normalising trims fields, folds the frequency, and drops unknown fields', () => {
  const schedule = normalizeDeviceBackupSchedule({
    ...dailyShop, device: '  Shop laptop  ', frequency: 'Every day', billId: 'B-1', customerId: 'C-1', amount: 5000,
  });
  assert.deepEqual(schedule, dailyShop);
});

test('normalising refuses a schedule missing an id, a device, or a frequency', () => {
  assert.equal(normalizeDeviceBackupSchedule({ ...dailyShop, id: '' }), null);
  assert.equal(normalizeDeviceBackupSchedule({ ...dailyShop, device: '   ' }), null);
  assert.equal(normalizeDeviceBackupSchedule({ ...dailyShop, frequency: '' }), null);
  assert.equal(normalizeDeviceBackupSchedule({ ...dailyShop, frequency: 'fortnightly' }), null);
  assert.equal(normalizeDeviceBackupSchedule({ ...dailyShop, lastBackupDate: '2026-11-31' }), null);
  assert.equal(normalizeDeviceBackupSchedule({ ...dailyShop, nextBackupDue: '2026-13-01' }), null);
  assert.equal(normalizeDeviceBackupSchedule(null), null);
  assert.equal(normalizeDeviceBackupSchedule([dailyShop]), null);
});

test('a next due date before the last backup date is refused', () => {
  assert.equal(normalizeDeviceBackupSchedule({ ...dailyShop, nextBackupDue: '2026-11-03' }), null);
  assert.notEqual(normalizeDeviceBackupSchedule({ ...dailyShop, nextBackupDue: '2026-11-04' }), null);
});

test('a missing next due date is worked out from the last backup date and the frequency', () => {
  assert.deepEqual(
    normalizeDeviceBackupSchedule({ id: 'DBS-9', device: 'Spare phone', frequency: 'weekly', lastBackupDate: '2026-10-29', owner: 'Saad' }),
    { id: 'DBS-9', device: 'Spare phone', frequency: 'weekly', lastBackupDate: '2026-10-29', nextBackupDue: '2026-11-05', owner: 'Saad' },
  );
  assert.deepEqual(
    normalizeDeviceBackupSchedule({ id: 'DBS-10', device: 'Old tablet', frequency: 'monthly', owner: '' }),
    { id: 'DBS-10', device: 'Old tablet', frequency: 'monthly', lastBackupDate: '', nextBackupDue: '', owner: '' },
  );
});

test('recording adds a schedule and refuses a duplicate id, a duplicate device, or a bad schedule', () => {
  const after = recordDeviceBackupSchedule([dailyShop], weeklyPhone);
  assert.equal(after.length, 2);
  assert.equal(recordDeviceBackupSchedule(after, { ...weeklyPhone, owner: 'Owner' }).length, 2);
  assert.equal(recordDeviceBackupSchedule(after, { ...monthlySpare, device: 'shop LAPTOP' }).length, 2);
  assert.equal(recordDeviceBackupSchedule([dailyShop], { ...weeklyPhone, device: '' }).length, 1);
});

test('removing takes out only that schedule and an unknown id changes nothing', () => {
  assert.deepEqual(removeDeviceBackupSchedule([dailyShop, weeklyPhone], 'DBS-1'), [weeklyPhone]);
  assert.deepEqual(removeDeviceBackupSchedule([dailyShop], 'DBS-9'), [dailyShop]);
});

test('finding returns the schedule or null', () => {
  assert.deepEqual(findDeviceBackupSchedule([dailyShop, weeklyPhone], 'DBS-2'), weeklyPhone);
  assert.equal(findDeviceBackupSchedule([dailyShop], 'DBS-9'), null);
});

test('recording a backup moves the next due date forward by the schedule', () => {
  const after = recordDeviceBackup([dailyShop, weeklyPhone], 'DBS-1', '2026-11-05');
  assert.deepEqual(after[0], { ...dailyShop, lastBackupDate: '2026-11-05', nextBackupDue: '2026-11-06' });
  assert.deepEqual(after[1], weeklyPhone);
  const monthly = recordDeviceBackup([monthlySpare], 'DBS-3', '2026-11-05');
  assert.equal(monthly[0].nextBackupDue, '2026-12-05');
  const first = recordDeviceBackup([noBackupYet], 'DBS-4', '2026-11-05');
  assert.deepEqual(first[0], { ...noBackupYet, lastBackupDate: '2026-11-05', nextBackupDue: '2026-11-12' });
});

test('recording a backup refuses a bad date, an earlier date, or an unknown schedule', () => {
  assert.deepEqual(recordDeviceBackup([dailyShop], 'DBS-1', '2026-11-31'), [dailyShop]);
  assert.deepEqual(recordDeviceBackup([dailyShop], 'DBS-1', '2026-11-03'), [dailyShop]);
  assert.deepEqual(recordDeviceBackup([dailyShop], 'DBS-9', '2026-11-05'), [dailyShop]);
  assert.deepEqual(recordDeviceBackup([dailyShop], 'DBS-1', '2026-11-04'), [{ ...dailyShop, lastBackupDate: '2026-11-04', nextBackupDue: '2026-11-05' }]);
});

test('schedules sort by earliest next due date first, with no due date yet last', () => {
  assert.deepEqual(
    deviceBackupSchedulesSorted([noBackupYet, monthlySpare, dailyShop]).map((item) => item.id),
    ['DBS-1', 'DBS-3', 'DBS-4'],
  );
});

test('overdue means the next due date is before the as-of day, and the due list is dated and ordered', () => {
  assert.equal(deviceBackupScheduleIsOverdue(dailyShop, '2026-11-06'), true);
  assert.equal(deviceBackupScheduleIsOverdue(dailyShop, '2026-11-05'), false);
  assert.equal(deviceBackupScheduleIsOverdue(noBackupYet, '2026-12-31'), false);
  assert.equal(deviceBackupScheduleIsOverdue(dailyShop, 'not a date'), false);
  assert.deepEqual(
    overdueDeviceBackupSchedules([monthlySpare, dailyShop, weeklyPhone, noBackupYet], '2026-11-06').map((item) => item.id),
    ['DBS-2', 'DBS-1', 'DBS-3'],
  );
  assert.deepEqual(overdueDeviceBackupSchedules([dailyShop, weeklyPhone], '2026-11-05'), []);
  assert.deepEqual(overdueDeviceBackupSchedules([dailyShop], 'not a date'), []);
});

test('schedules for one device match regardless of capital letters', () => {
  assert.deepEqual(
    deviceBackupSchedulesForDevice([dailyShop, weeklyPhone], 'SHOP laptop').map((item) => item.id),
    ['DBS-1'],
  );
  assert.deepEqual(deviceBackupSchedulesForDevice([dailyShop], 'Field phone'), []);
  assert.deepEqual(deviceBackupSchedulesForDevice([dailyShop], ''), []);
});

test('devices list is distinct in first-recorded order', () => {
  assert.deepEqual(
    deviceBackupScheduleDevices([dailyShop, weeklyPhone, monthlySpare]),
    ['Shop laptop', 'Field phone', 'Spare laptop'],
  );
  assert.deepEqual(deviceBackupScheduleDevices([]), []);
});

test('summary text counts schedules and overdue devices in plain words', () => {
  assert.equal(deviceBackupScheduleSummaryText([]), 'No device backup schedules recorded.');
  assert.equal(deviceBackupScheduleSummaryText([dailyShop], '2026-11-05'), '1 backup schedule: 0 devices are overdue.');
  assert.equal(
    deviceBackupScheduleSummaryText([dailyShop, weeklyPhone, noBackupYet], '2026-11-06'),
    '3 backup schedules: 2 devices are overdue.',
  );
});

test('one schedule reads as a plain-words line with due date, state, and owner visible', () => {
  assert.equal(
    deviceBackupScheduleText(dailyShop, '2026-11-05'),
    'Shop laptop — daily — last backup 2026-11-04 — next backup due 2026-11-05 — on track — owner Owner.',
  );
  assert.equal(
    deviceBackupScheduleText(dailyShop, '2026-11-06'),
    'Shop laptop — daily — last backup 2026-11-04 — next backup due 2026-11-05 — overdue — owner Owner.',
  );
  assert.equal(
    deviceBackupScheduleText(noBackupYet, '2026-11-05'),
    'New tablet — weekly — no backup recorded yet — no due date yet — on track — owner Owner.',
  );
  assert.equal(deviceBackupScheduleText({ ...dailyShop, lastBackupDate: 'bad' }, '2026-11-05'), '');
});

test('html escapes user text so a schedule cannot break the page', () => {
  const html = deviceBackupScheduleHtml({ ...dailyShop, device: 'Shop <b>laptop</b> & phone', owner: 'Owner <script>' });
  assert.match(html, /Shop &lt;b&gt;laptop&lt;\/b&gt; &amp; phone/);
  assert.equal(html.includes('<b>'), false);
  assert.equal(html.includes('<script>'), false);
});

test('all html groups schedules overdue first, then on track, then no due date yet', () => {
  const onTrack = { id: 'DBS-5', device: 'Office laptop', frequency: 'monthly', lastBackupDate: '2026-11-05', nextBackupDue: '2026-12-05', owner: 'Owner' };
  const html = deviceBackupScheduleAllHtml([noBackupYet, onTrack, weeklyPhone, dailyShop], '2026-11-06');
  assert.match(html, /<h4>Overdue<\/h4>/);
  assert.match(html, /<h4>On track<\/h4>/);
  assert.match(html, /<h4>No due date yet<\/h4>/);
  assert.ok(html.indexOf('<h4>Overdue</h4>') < html.indexOf('<h4>On track</h4>'));
  assert.ok(html.indexOf('<h4>On track</h4>') < html.indexOf('<h4>No due date yet</h4>'));
  assert.equal(deviceBackupScheduleAllHtml([], '2026-11-05'), '<p>No device backup schedules recorded.</p>');
});

test('overdue html is a dated due list and says so when nothing is overdue', () => {
  const html = overdueDeviceBackupSchedulesHtml([dailyShop, weeklyPhone], '2026-11-06');
  assert.match(html, /next backup due 2026-11-05/);
  assert.equal(
    overdueDeviceBackupSchedulesHtml([dailyShop], '2026-11-05'),
    '<p>No devices overdue for backup.</p>',
  );
});

test('csv lists schedules earliest due first with a header and the fixed filename', () => {
  const csv = deviceBackupScheduleCsv([noBackupYet, weeklyPhone, dailyShop]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,device,frequency,lastBackupDate,nextBackupDue,owner');
  assert.match(lines[1], /^DBS-2,Field phone,weekly,2026-10-29,2026-11-05,Saad$/);
  assert.match(lines[2], /^DBS-1,Shop laptop,daily,2026-11-04,2026-11-05,Owner$/);
  assert.match(lines[3], /^DBS-4,New tablet,weekly,,,Owner$/);
  assert.equal(deviceBackupScheduleFilename(), 'device-backup-schedules.csv');
});

test('csv quotes a device name that contains a comma', () => {
  const csv = deviceBackupScheduleCsv([{ ...dailyShop, device: 'Shop laptop, main' }]);
  assert.match(csv, /"Shop laptop, main"/);
});

test('recording a schedule or a backup leaves the input list untouched', () => {
  const before = [dailyShop];
  const after = recordDeviceBackupSchedule(before, weeklyPhone);
  assert.equal(before.length, 1);
  assert.equal(after.length, 2);
  const backedUp = recordDeviceBackup(before, 'DBS-1', '2026-11-05');
  assert.equal(before[0].lastBackupDate, '2026-11-04');
  assert.equal(backedUp[0].lastBackupDate, '2026-11-05');
});

test('a schedule changes nothing else: no amount, bill, payment, or customer field survives', () => {
  const schedule = normalizeDeviceBackupSchedule({
    ...dailyShop, amount: 5000, billId: 'B-1', paymentId: 'P-1', customerId: 'C-1', backupFile: 'backup.zip',
  });
  assert.deepEqual(Object.keys(schedule).sort(), ['device', 'frequency', 'id', 'lastBackupDate', 'nextBackupDue', 'owner']);
});

test('module is pure and import-free', () => {
  const source = readFileSync(new URL('../device-backup-schedule.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: backup verification, restore drill, device inventory, and export verification are untouched', () => {
  const source = readFileSync(new URL('../device-backup-schedule.js', import.meta.url), 'utf8');
  assert.equal(source.includes('backup-verification'), false, 'module must not reference the backup verification module');
  assert.equal(source.includes('restore-drill'), false, 'module must not reference the restore drill record module');
  assert.equal(source.includes('export-verification'), false, 'module must not reference the export verification module');
  assert.equal(source.includes('business-device'), false, 'module must not reference the business device inventory module');
  assert.equal(existsSync(new URL('../backup-verification.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../restore-drill.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../business-device.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../export-verification.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'dbsHeading', 'dbsSummary', 'dbsBody', 'dbsExportBtn',
    'dbsId', 'dbsDevice', 'dbsFrequency', 'dbsLastBackup', 'dbsNextDue', 'dbsOwner', 'dbsRecordBtn',
    'dbsBackupId', 'dbsBackupDate', 'dbsBackupBtn',
    'dbsRemoveId', 'dbsRemoveBtn',
    'dbsDeviceSelect', 'dbsDeviceBody', 'dbsOverdueBody',
  ];
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), `index.html is missing ${id}`);
});
