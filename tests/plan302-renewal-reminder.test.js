import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  isStrictDate,
  normalizeTrackerEntry,
  normalizeTrackerEntryList,
  reminderStatus,
  daysUntilRenewal,
  normalizeSeenList,
  isReminderSeen,
  markReminderSeen,
  buildReminder,
  renewalReminderQueue,
  upcomingReminders,
  overdueReminders,
  unseenReminders,
  renewalReminderText,
  renewalReminderSummaryText,
  renewalReminderHtml,
  renewalReminderQueueHtml,
  renewalReminderCsv,
  renewalReminderFilename,
} from '../renewal-reminder.js';

const today = '2026-11-05';
const first = {
  id: 'LC-1',
  toolName: 'Billing Tool',
  provider: 'Vendor A',
  renewalDate: '2026-11-20',
  cost: 'Rs 5000',
  renewalNote: 'Renew before the 20th',
  status: 'active',
};
const second = {
  id: 'LC-2',
  toolName: 'Antivirus',
  provider: 'Vendor B',
  renewalDate: '2026-10-30',
  status: 'active',
};
const third = {
  id: 'LC-3',
  toolName: 'Cloud Backup',
  provider: '',
  renewalDate: '2026-11-05',
  status: 'renewed',
  renewedDate: '2026-11-01',
};
const fourth = {
  id: 'LC-4',
  toolName: 'Domain',
  provider: 'Vendor C',
  renewalDate: '2026-12-01',
  status: 'active',
};
const fixture = [first, second, third, fourth];

test('half-formed tracker entries are refused', () => {
  assert.equal(normalizeTrackerEntry(null), null);
  assert.equal(normalizeTrackerEntry({}), null);
  assert.equal(normalizeTrackerEntry({ ...first, id: '' }), null);
  assert.equal(normalizeTrackerEntry({ ...first, toolName: '' }), null);
  assert.equal(normalizeTrackerEntry({ ...first, renewalDate: '2026-13-01' }), null);
  assert.equal(normalizeTrackerEntry({ ...first, renewalDate: '2026-02-29' }), null);
  assert.equal(normalizeTrackerEntry({ ...first, renewalDate: '20-11-2026' }), null);
  assert.equal(normalizeTrackerEntry({ ...first, status: 'renewed', renewedDate: '2026-02-30' }), null);
  assert.deepEqual(normalizeTrackerEntry({ ...first, toolName: '  Billing Tool  ' }), { id: 'LC-1', toolName: 'Billing Tool', provider: 'Vendor A', renewalDate: '2026-11-20', status: 'active', renewedDate: '' });
  assert.equal(isStrictDate('2024-02-29'), true);
  assert.equal(isStrictDate('2026-02-29'), false);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, billAmount: 5000, paymentId: 'P-1', sendSms: true };
  const entry = normalizeTrackerEntry(raw);
  assert.equal('billAmount' in entry, false);
  assert.equal('paymentId' in entry, false);
  assert.equal('sendSms' in entry, false);
  assert.deepEqual(raw, { ...first, billAmount: 5000, paymentId: 'P-1', sendSms: true });
  const before = JSON.stringify(fixture);
  normalizeTrackerEntryList(fixture);
  renewalReminderQueue(fixture, today, []);
  assert.equal(JSON.stringify(fixture), before);
});

test('duplicate tracker ids are never rewritten', () => {
  const list = normalizeTrackerEntryList([first, { ...first, toolName: 'Other Tool' }, second]);
  assert.equal(list.length, 2);
  assert.equal(list[0].toolName, 'Billing Tool');
});

test('reminder status is overdue, upcoming, or renewed', () => {
  assert.equal(reminderStatus(second, today), 'overdue');
  assert.equal(reminderStatus(first, today), 'upcoming');
  assert.equal(reminderStatus(third, today), 'renewed');
  assert.equal(reminderStatus({ ...fourth, renewalDate: '2026-11-05' }, today), 'upcoming');
  assert.equal(reminderStatus(first, 'not-a-date'), '');
  assert.equal(reminderStatus(null, today), '');
});

test('days until renewal counts whole days by integer arithmetic', () => {
  assert.equal(daysUntilRenewal(first, today), 15);
  assert.equal(daysUntilRenewal(second, today), -6);
  assert.equal(daysUntilRenewal({ ...fourth, renewalDate: '2026-11-05' }, today), 0);
  assert.equal(daysUntilRenewal({ ...first, renewalDate: '2028-02-29' }, '2028-02-28'), 1);
  assert.equal(daysUntilRenewal(first, 'not-a-date'), null);
  assert.equal(daysUntilRenewal(null, today), null);
});

test('queue lists renewals in date order with the tracker entry linked', () => {
  const queue = renewalReminderQueue(fixture, today, []);
  assert.deepEqual(queue.map((reminder) => reminder.licenceId), ['LC-2', 'LC-3', 'LC-1', 'LC-4']);
  assert.deepEqual(queue.map((reminder) => reminder.status), ['overdue', 'renewed', 'upcoming', 'upcoming']);
  assert.equal(queue[0].toolName, 'Antivirus');
  assert.equal(queue[0].daysUntil, -6);
  assert.equal(queue[2].daysUntil, 15);
  assert.equal(queue.every((reminder) => reminder.seen === false), true);
  const shuffled = renewalReminderQueue([fourth, first, third, second], today, []);
  assert.deepEqual(shuffled.map((reminder) => reminder.licenceId), ['LC-2', 'LC-3', 'LC-1', 'LC-4']);
});

test('upcoming and overdue lists exclude renewed entries', () => {
  assert.deepEqual(upcomingReminders(fixture, today, []).map((reminder) => reminder.licenceId), ['LC-1', 'LC-4']);
  assert.deepEqual(overdueReminders(fixture, today, []).map((reminder) => reminder.licenceId), ['LC-2']);
  assert.deepEqual(overdueReminders([first, fourth], today, []), []);
});

test('marking a reminder seen never changes any tracker entry', () => {
  const seen = markReminderSeen([], 'LC-2');
  assert.deepEqual(seen, ['LC-2']);
  assert.deepEqual(markReminderSeen(seen, 'LC-2'), ['LC-2']);
  assert.deepEqual(markReminderSeen(seen, 'LC-1'), ['LC-2', 'LC-1']);
  assert.deepEqual(markReminderSeen(seen, ''), ['LC-2']);
  assert.deepEqual(seen, ['LC-2']);
  assert.equal(isReminderSeen(seen, 'LC-2'), true);
  assert.equal(isReminderSeen(seen, 'LC-1'), false);
  assert.deepEqual(normalizeSeenList(['LC-1', ' LC-1 ', '', 'LC-2', 42, null]), ['LC-1', 'LC-2']);
  const queue = renewalReminderQueue(fixture, today, ['LC-2']);
  assert.equal(queue[0].seen, true);
  assert.equal(queue[1].seen, false);
  assert.deepEqual(unseenReminders(queue).map((reminder) => reminder.licenceId), ['LC-3', 'LC-1', 'LC-4']);
  const before = JSON.stringify(fixture);
  renewalReminderQueue(fixture, today, ['LC-2']);
  assert.equal(JSON.stringify(fixture), before);
});

test('reminder text names the status and the seen state in plain words', () => {
  const queue = renewalReminderQueue(fixture, today, ['LC-2']);
  assert.equal(renewalReminderText(queue[0]), 'Antivirus — provider Vendor B — renews 2026-10-30 — OVERDUE by 6 days — seen');
  assert.equal(renewalReminderText(queue[1]), 'Cloud Backup — renews 2026-11-05 — renewed — unseen');
  assert.equal(renewalReminderText(queue[2]), 'Billing Tool — provider Vendor A — renews 2026-11-20 — due in 15 days — unseen');
  assert.equal(renewalReminderText(buildReminder({ ...fourth, renewalDate: '2026-11-05' }, today, [])), 'Domain — provider Vendor C — renews 2026-11-05 — due today — unseen');
  assert.equal(renewalReminderText(null), '');
  assert.equal(renewalReminderText({ licenceId: 'LC-9', toolName: 'X', renewalDate: 'bad', status: 'upcoming' }), '');
});

test('summary text names the counts', () => {
  const queue = renewalReminderQueue(fixture, today, ['LC-2']);
  assert.equal(renewalReminderSummaryText(queue), '4 renewals in queue: 1 overdue, 2 upcoming, 1 renewed, 3 unseen');
  assert.equal(renewalReminderSummaryText([]), '0 renewals in queue: 0 overdue, 0 upcoming, 0 renewed, 0 unseen');
  assert.equal(renewalReminderSummaryText(renewalReminderQueue([first], today, [])), '1 renewal in queue: 0 overdue, 1 upcoming, 0 renewed, 1 unseen');
});

test('html escapes tool and provider names', () => {
  const evil = buildReminder({ id: 'LC-9', toolName: '<b>Tool</b>', provider: 'A & B', renewalDate: '2026-11-20', status: 'active' }, today, []);
  const html = renewalReminderHtml(evil);
  assert.equal(html.includes('<b>Tool</b>'), false);
  assert.equal(html.includes('&lt;b&gt;Tool&lt;/b&gt;'), true);
  assert.equal(html.includes('A &amp; B'), true);
  assert.equal(html.includes('LC-9'), true);
  assert.equal(renewalReminderHtml(null), '');
  assert.equal(renewalReminderQueueHtml(renewalReminderQueue(fixture, today, [])).includes('Billing Tool'), true);
});

test('csv export and filename', () => {
  const csv = renewalReminderCsv(renewalReminderQueue(fixture, today, ['LC-2']));
  const lines = csv.split('\n');
  assert.equal(lines[0], '"licenceId","toolName","provider","renewalDate","status","daysUntil","seen"');
  assert.equal(lines[1], '"LC-2","Antivirus","Vendor B","2026-10-30","overdue","-6","yes"');
  assert.equal(lines[2], '"LC-3","Cloud Backup","","2026-11-05","renewed","0","no"');
  assert.equal(renewalReminderFilename(), 'renewal-reminders.csv');
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../renewal-reminder.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the licence tracker is only read through caller entries', () => {
  const source = readFileSync(new URL('../renewal-reminder.js', import.meta.url), 'utf8');
  assert.equal(source.includes('licence-tracker.js'), false, 'module must not reference the tracker file');
  assert.equal(source.includes('LICENCES_KEY'), false, 'module must not touch the tracker store');
  assert.equal(source.includes('loadLicences'), false, 'module must not load the tracker itself');
  assert.equal(source.includes('recordLicence'), false, 'module must never record a licence');
  assert.equal(source.includes('markLicenceRenewed'), false, 'module must never renew a licence');
  assert.equal(existsSync(new URL('../licence-tracker.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'rrHeading', 'rrSummary', 'rrExportBtn', 'rrSeenId', 'rrSeenBtn',
    'rrOverdueBtn', 'rrAllBtn', 'rrOverdueBody', 'rrBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the renewal reminder queue panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './renewal-reminder.js'"), true);
  assert.equal(source.includes('renderRenewalReminders()'), true);
  assert.equal(source.includes('RENEWAL_REMINDER_SEEN_KEY'), true);
  assert.equal(source.includes('loadLicences()'), true);
});

test('deployment guard: no standalone OLT word in app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
