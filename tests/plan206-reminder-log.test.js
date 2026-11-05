import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validReminderDate,
  REMINDER_CHANNELS,
  REMINDER_CHANNEL_LABELS,
  normalizeReminderBillKey,
  normalizeReminder,
  normalizeReminderList,
  recordReminder,
  removeReminder,
  remindersSorted,
  remindersForCustomer,
  remindersForBill,
  reminderCountForBill,
  remindersForChannel,
  reminderText,
  reminderSummaryText,
  reminderHtml,
  reminderCsv,
  reminderFilename,
} from '../reminder-log.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'reminder-log.js'), 'utf8');

const reminderA = { id: 'PR-1', customerId: 'C-1', billId: 'C-1 · 2026-11', date: '2026-11-03', channel: 'whatsapp', draftRef: 'DUE-REMINDER' };
const reminderB = { id: 'PR-2', customerId: 'C-2', billId: 'C-2 · 2026-11', date: '2026-11-02', channel: 'sms', draftRef: '' };
const reminderC = { id: 'PR-3', customerId: 'C-1', billId: 'C-1 · 2026-11', date: '2026-11-05', channel: 'in-person', draftRef: 'VISIT-NOTE' };

test('strict dates: leap day rules and bad formats refused', () => {
  assert.equal(validReminderDate('2024-02-29'), true);
  assert.equal(validReminderDate('2026-02-29'), false);
  assert.equal(validReminderDate('2026-02-30'), false);
  assert.equal(validReminderDate('2026-13-01'), false);
  assert.equal(validReminderDate('2026-11'), false);
  assert.equal(validReminderDate(''), false);
  assert.equal(validReminderDate(null), false);
});

test('channel catalogue is exactly the plan’s four channels', () => {
  assert.deepEqual([...REMINDER_CHANNELS], ['whatsapp', 'sms', 'in-person', 'phone']);
  assert.equal(REMINDER_CHANNEL_LABELS.whatsapp, 'WhatsApp');
  assert.equal(REMINDER_CHANNEL_LABELS.sms, 'SMS');
  assert.equal(REMINDER_CHANNEL_LABELS['in-person'], 'In person');
  assert.equal(REMINDER_CHANNEL_LABELS.phone, 'Phone call');
});

test('normalization: unknown fields dropped, draft optional, bad records refused', () => {
  assert.deepEqual(normalizeReminder({ ...reminderA, surprise: 'x' }), reminderA);
  assert.deepEqual(normalizeReminder(reminderB), { ...reminderB, draftRef: '' });
  assert.equal(normalizeReminder({ ...reminderA, channel: 'pigeon' }), null);
  assert.equal(normalizeReminder({ ...reminderA, date: '2026-02-30' }), null);
  assert.equal(normalizeReminder({ ...reminderA, customerId: '  ' }), null);
  assert.equal(normalizeReminder({ ...reminderA, billId: '' }), null);
  assert.equal(normalizeReminder({ ...reminderA, id: '' }), null);
  assert.equal(normalizeReminder(null), null);
  assert.equal(normalizeReminder('nope'), null);
});

test('bill key normalization collapses whitespace and case', () => {
  assert.equal(normalizeReminderBillKey('  C-1   ·   2026-11 '), 'c-1 · 2026-11');
  assert.equal(normalizeReminderBillKey(''), '');
});

test('duplicate ids never stored twice, but several reminders per bill are expected', () => {
  const list = normalizeReminderList([reminderA, reminderC, { ...reminderA, date: '2026-11-04' }]);
  assert.equal(list.length, 2);
  assert.deepEqual(recordReminder([reminderA], reminderC).length, 2);
  assert.deepEqual(recordReminder([reminderA], { ...reminderA, channel: 'sms' }).length, 1);
});

test('refused records leave the list unchanged', () => {
  assert.deepEqual(recordReminder([reminderA], { ...reminderB, channel: 'smoke-signal' }), [reminderA]);
  assert.deepEqual(recordReminder([reminderA], { ...reminderB, date: 'not-a-date' }), [reminderA]);
});

test('remove by id, unknown id leaves the list unchanged', () => {
  assert.deepEqual(removeReminder([reminderA, reminderB], 'PR-1'), [reminderB]);
  assert.deepEqual(removeReminder([reminderA], 'PR-9'), [reminderA]);
  assert.deepEqual(removeReminder([reminderA], ''), [reminderA]);
});

test('sorted by date, then bill, then customer, then id', () => {
  assert.deepEqual(remindersSorted([reminderC, reminderA, reminderB]).map((r) => r.id), ['PR-2', 'PR-1', 'PR-3']);
});

test('customer filter is a case-insensitive substring in date order', () => {
  assert.deepEqual(remindersForCustomer([reminderC, reminderA, reminderB], 'c-1').map((r) => r.id), ['PR-1', 'PR-3']);
  assert.deepEqual(remindersForCustomer([reminderA, reminderB], ''), [reminderB, reminderA]);
});

test('bill filter is a case-insensitive substring', () => {
  assert.deepEqual(remindersForBill([reminderA, reminderB, reminderC], 'C-1 · 2026-11').map((r) => r.id), ['PR-1', 'PR-3']);
  assert.deepEqual(remindersForBill([reminderA, reminderB], ''), [reminderB, reminderA]);
});

test('bill count is an exact bill match, never a substring count', () => {
  assert.equal(reminderCountForBill([reminderA, reminderB, reminderC], 'C-1 · 2026-11'), 2);
  assert.equal(reminderCountForBill([reminderA, reminderB, reminderC], 'C-1'), 0);
  assert.equal(reminderCountForBill([reminderA], ''), 0);
});

test('channel filter returns only that channel in date order', () => {
  assert.deepEqual(remindersForChannel([reminderA, reminderB, reminderC], 'sms').map((r) => r.id), ['PR-2']);
  assert.deepEqual(remindersForChannel([reminderA, reminderB], ''), [reminderB, reminderA]);
  assert.deepEqual(remindersForChannel([reminderA], 'phone'), []);
});

test('reminder text shows channel, bill, date, draft — or plainly No draft noted.', () => {
  assert.equal(reminderText(reminderA), 'WhatsApp reminder for bill C-1 · 2026-11 on 2026-11-03 (draft: DUE-REMINDER)');
  assert.equal(reminderText(reminderB), 'SMS reminder for bill C-2 · 2026-11 on 2026-11-02 (No draft noted.)');
  assert.equal(reminderText(null), 'No reminder recorded.');
  assert.equal(reminderText({ ...reminderA, channel: 'nope' }), 'No reminder recorded.');
});

test('summary text counts reminders by channel', () => {
  assert.equal(reminderSummaryText([]), 'No payment reminders recorded.');
  assert.equal(reminderSummaryText([reminderA]), '1 payment reminder recorded (1 whatsapp).');
  assert.equal(reminderSummaryText([reminderA, reminderB, reminderC]), '3 payment reminders recorded (1 whatsapp, 1 sms, 1 in person).');
});

test('HTML escapes values, CSV and filename are stable', () => {
  const nasty = { id: 'PR-9', customerId: 'C-<b>', billId: 'B-&', date: '2026-11-03', channel: 'phone', draftRef: '"quoted"' };
  const html = reminderHtml([nasty]);
  assert.match(html, /C-&lt;b&gt;/);
  assert.match(html, /B-&amp;/);
  assert.doesNotMatch(html, /<b>/);
  const csv = reminderCsv([reminderA, reminderB]);
  assert.equal(csv.split('\n')[0], 'customer,bill,date,channel,draft used,record id');
  assert.match(csv, /No draft noted\./);
  assert.equal(reminderFilename(), 'payment-reminders.csv');
  assert.equal(reminderHtml([]), '');
});

test('inputs never mutated by record, remove, or sort', () => {
  const before = [reminderA, reminderB];
  const snapshot = JSON.stringify(before);
  recordReminder(before, reminderC);
  removeReminder(before, 'PR-1');
  remindersSorted(before);
  assert.equal(JSON.stringify(before), snapshot);
  assert.equal(JSON.stringify(reminderA), JSON.stringify({ id: 'PR-1', customerId: 'C-1', billId: 'C-1 · 2026-11', date: '2026-11-03', channel: 'whatsapp', draftRef: 'DUE-REMINDER' }));
});

test('purity fence: no storage, clock, network, or neighbouring-module import', () => {
  assert.doesNotMatch(moduleSrc, /localStorage|new Date\(|fetch\(|import /);
  assert.doesNotMatch(moduleSrc, /from '\.\/pre-due-reminders\.js'|from '\.\/whatsapp-templates\.js'|from '\.\/reminder-queue\.js'|from '\.\/contact-preferences\.js'/);
});

test('panel ids present in index.html and wiring present in app.js', () => {
  for (const id of ['prHeading', 'prSummary', 'prBill', 'prCustomer', 'prDate', 'prChannel', 'prDraft', 'prSaveBtn', 'prRemoveId', 'prRemoveBtn', 'prBody', 'prCustomerFilter', 'prBillFilter', 'prChannelFilter', 'prBillCount', 'prBillCountBtn', 'prExportBtn']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
  assert.match(appJs, /shahdara_reminder_log_v1/);
  assert.match(appJs, /renderPaymentReminders\(\)/);
  assert.match(appJs, /reminder-log\.js/);
});

test('deployment guard: no standalone OLT word added to app.js by this plan', () => {
  const matches = appJs.match(/(?<![A-Z])OLT(?![A-Z])/g) || [];
  assert.equal(matches.length, 0);
});
