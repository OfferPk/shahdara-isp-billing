import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PRE_DUE_WINDOW_DAYS,
  isValidPreDueDate,
  normalizePreDueWindowDays,
  addPreDueDays,
  preDueDaysBetween,
  formatPreDueAmount,
  formatPreDueDate,
  buildPreDueReminderQueue,
  buildPreDueReminderDraft,
  logReminderSent,
  reminderSentAt,
  preDueReminderSummaryText,
  preDueReminderFilename,
  preDueReminderHtml,
  preDueReminderCsv,
} from '../pre-due-reminders.js';

const TODAY = '2026-11-03';

const bill = (overrides = {}) => ({
  customerId: 'c1',
  customerName: 'Ahmed',
  mohalla: 'Bani',
  billMonth: '2026-11',
  dueDate: '2026-11-05',
  balanceDue: 1500,
  ...overrides,
});

// ---- date and window validation ----

test('valid calendar dates pass and impossible dates fail', () => {
  assert.equal(isValidPreDueDate('2026-11-03'), true);
  assert.equal(isValidPreDueDate('2024-02-29'), true);
  assert.equal(isValidPreDueDate('2026-02-29'), false);
  assert.equal(isValidPreDueDate('2026-13-01'), false);
  assert.equal(isValidPreDueDate('03-11-2026'), false);
  assert.equal(isValidPreDueDate(''), false);
  assert.equal(isValidPreDueDate(null), false);
});

test('window normalisation falls back to the default, never to zero', () => {
  assert.equal(DEFAULT_PRE_DUE_WINDOW_DAYS, 3);
  assert.equal(normalizePreDueWindowDays(5), 5);
  assert.equal(normalizePreDueWindowDays(1), 1);
  assert.equal(normalizePreDueWindowDays(0), 3);
  assert.equal(normalizePreDueWindowDays(-2), 3);
  assert.equal(normalizePreDueWindowDays('abc'), 3);
  assert.equal(normalizePreDueWindowDays(undefined), 3);
  assert.equal(normalizePreDueWindowDays(2.9), 2);
});

test('day arithmetic crosses a month boundary', () => {
  assert.equal(addPreDueDays('2026-10-30', 3), '2026-11-02');
  assert.equal(addPreDueDays('2026-11-03', 0), '2026-11-03');
  assert.equal(addPreDueDays('not-a-date', 3), null);
  assert.equal(preDueDaysBetween('2026-11-03', '2026-11-05'), 2);
  assert.equal(preDueDaysBetween('2026-11-05', '2026-11-03'), -2);
  assert.equal(preDueDaysBetween('2026-11-03', '2026-11-03'), 0);
});

test('amount and date formatting', () => {
  assert.equal(formatPreDueAmount(1500), 'PKR 1,500');
  assert.equal(formatPreDueAmount(1500.5), 'PKR 1,500.50');
  assert.equal(formatPreDueAmount('nope'), '');
  assert.equal(formatPreDueDate('2026-11-05'), '5 Nov 2026');
  assert.equal(formatPreDueDate('bad'), '');
});

// ---- window inclusion, exactly ----

test('queue includes due-today and window-end bills, excludes the day after', () => {
  const queue = buildPreDueReminderQueue({
    today: TODAY,
    windowDays: 3,
    bills: [
      bill({ customerId: 'c-today', customerName: 'Today', dueDate: '2026-11-03' }),
      bill({ customerId: 'c-end', customerName: 'End', dueDate: '2026-11-06' }),
      bill({ customerId: 'c-after', customerName: 'After', dueDate: '2026-11-07' }),
    ],
  });
  assert.equal(queue.valid, true);
  assert.equal(queue.windowEnd, '2026-11-06');
  assert.deepEqual(queue.rows.map((r) => r.customerId), ['c-today', 'c-end']);
  assert.equal(queue.counts.excludedOutsideWindow, 1);
});

test('overdue bills are excluded, not reminded as pre-due', () => {
  const queue = buildPreDueReminderQueue({
    today: TODAY,
    windowDays: 3,
    bills: [bill({ dueDate: '2026-11-02' }), bill({ dueDate: '2026-11-05' })],
  });
  assert.equal(queue.rows.length, 1);
  assert.equal(queue.counts.excludedOverdue, 1);
});

test('zero and negative balances never appear', () => {
  const queue = buildPreDueReminderQueue({
    today: TODAY,
    windowDays: 3,
    bills: [
      bill({ customerId: 'c-zero', balanceDue: 0 }),
      bill({ customerId: 'c-neg', balanceDue: -500 }),
      bill({ customerId: 'c-ok', balanceDue: 100 }),
    ],
  });
  assert.deepEqual(queue.rows.map((r) => r.customerId), ['c-ok']);
  assert.equal(queue.counts.excludedZeroBalance, 2);
});

test('undated and unparseable bills are excluded and counted, never invented', () => {
  const queue = buildPreDueReminderQueue({
    today: TODAY,
    windowDays: 3,
    bills: [
      bill({ customerId: 'c-undated', dueDate: '' }),
      bill({ customerId: 'c-null', dueDate: null }),
      bill({ customerId: 'c-bad', dueDate: '2026-02-30' }),
      bill({ customerId: 'c-ok', dueDate: '2026-11-04' }),
    ],
  });
  assert.deepEqual(queue.rows.map((r) => r.customerId), ['c-ok']);
  assert.equal(queue.counts.excludedUndated, 2);
  assert.equal(queue.counts.excludedUnparseable, 1);
});

test('bills without a customer id are excluded and counted', () => {
  const queue = buildPreDueReminderQueue({
    today: TODAY,
    windowDays: 3,
    bills: [bill({ customerId: '' }), bill({ customerId: 'c-ok' })],
  });
  assert.equal(queue.rows.length, 1);
  assert.equal(queue.counts.excludedInvalid, 1);
});

test('an invalid today date makes the whole queue invalid', () => {
  const queue = buildPreDueReminderQueue({ today: 'bad', windowDays: 3, bills: [bill()] });
  assert.equal(queue.valid, false);
  assert.equal(queue.rows.length, 0);
  assert.equal(queue.windowEnd, null);
});

// ---- per-customer aggregation and sorting ----

test('one row per customer sums only in-window bills, earliest due date wins', () => {
  const queue = buildPreDueReminderQueue({
    today: TODAY,
    windowDays: 3,
    bills: [
      bill({ customerId: 'c1', billMonth: '2026-10', dueDate: '2026-11-06', balanceDue: 1000 }),
      bill({ customerId: 'c1', billMonth: '2026-11', dueDate: '2026-11-04', balanceDue: 500 }),
      bill({ customerId: 'c1', billMonth: '2026-09', dueDate: '2026-11-20', balanceDue: 9999 }),
    ],
  });
  assert.equal(queue.rows.length, 1);
  assert.equal(queue.rows[0].amount, 1500);
  assert.equal(queue.rows[0].dueDate, '2026-11-04');
  assert.equal(queue.rows[0].daysLeft, 1);
  assert.equal(queue.rows[0].billCount, 2);
  assert.equal(queue.counts.excludedOutsideWindow, 1);
});

test('rows sort by due date, then name, then id', () => {
  const queue = buildPreDueReminderQueue({
    today: TODAY,
    windowDays: 3,
    bills: [
      bill({ customerId: 'c-late', customerName: 'Zaid', dueDate: '2026-11-06' }),
      bill({ customerId: 'c-early-b', customerName: 'Bilal', dueDate: '2026-11-04' }),
      bill({ customerId: 'c-early-a', customerName: 'Ahmed', dueDate: '2026-11-04' }),
    ],
  });
  assert.deepEqual(queue.rows.map((r) => r.customerId), ['c-early-a', 'c-early-b', 'c-late']);
});

test('queue total sums exactly the listed rows', () => {
  const queue = buildPreDueReminderQueue({
    today: TODAY,
    windowDays: 3,
    bills: [
      bill({ customerId: 'c1', balanceDue: 1000 }),
      bill({ customerId: 'c2', customerName: 'Bilal', balanceDue: 250 }),
    ],
  });
  assert.equal(queue.totalAmount, 1250);
  assert.equal(queue.rows.reduce((s, r) => s + r.amount, 0), queue.totalAmount);
});

test('building the queue never mutates its input bills', () => {
  const bills = [bill(), bill({ customerId: 'c2', customerName: 'Bilal' })];
  const snapshot = JSON.stringify(bills);
  buildPreDueReminderQueue({ today: TODAY, windowDays: 3, bills });
  assert.equal(JSON.stringify(bills), snapshot);
});

test('operator window of 1 day lists only today and tomorrow', () => {
  const queue = buildPreDueReminderQueue({
    today: TODAY,
    windowDays: 1,
    bills: [
      bill({ customerId: 'c1', dueDate: '2026-11-04' }),
      bill({ customerId: 'c2', customerName: 'Bilal', dueDate: '2026-11-05' }),
    ],
  });
  assert.deepEqual(queue.rows.map((r) => r.customerId), ['c1']);
});

// ---- drafts ----

test('roman draft carries name, amount and due date', () => {
  const queue = buildPreDueReminderQueue({ today: TODAY, windowDays: 3, bills: [bill()] });
  const draft = buildPreDueReminderDraft(queue.rows[0]);
  assert.equal(draft.variant, 'roman');
  assert.match(draft.text, /Ahmed/);
  assert.match(draft.text, /PKR 1,500/);
  assert.match(draft.text, /5 Nov 2026/);
});

test('urdu draft carries the same name, amount and due date', () => {
  const queue = buildPreDueReminderQueue({ today: TODAY, windowDays: 3, bills: [bill()] });
  const draft = buildPreDueReminderDraft(queue.rows[0], 'urdu');
  assert.equal(draft.variant, 'urdu');
  assert.match(draft.text, /Ahmed/);
  assert.match(draft.text, /PKR 1,500/);
  assert.match(draft.text, /5 Nov 2026/);
  assert.match(draft.text, /شاہدرہ فائبر نیٹ/);
});

test('unknown draft variant falls back to roman', () => {
  const queue = buildPreDueReminderQueue({ today: TODAY, windowDays: 3, bills: [bill()] });
  assert.equal(buildPreDueReminderDraft(queue.rows[0], 'french').variant, 'roman');
});

// ---- send log ----

test('logging a send appends without mutating the old log', () => {
  const log = [];
  const next = logReminderSent(log, { customerId: 'c1', sentAt: '2026-11-03T10:00:00.000Z', channel: 'whatsapp' });
  assert.equal(log.length, 0);
  assert.equal(next.length, 1);
  assert.deepEqual(next[0], { customerId: 'c1', sentAt: '2026-11-03T10:00:00.000Z', channel: 'whatsapp' });
});

test('log entries without a customer or a send time are not recorded', () => {
  const log = logReminderSent([], { customerId: '', sentAt: '2026-11-03T10:00:00.000Z' });
  assert.equal(logReminderSent(log, { customerId: 'c1', sentAt: '' }).length, 0);
  assert.equal(logReminderSent(log, { customerId: 'c1' }).length, 0);
});

test('log defaults a blank channel to whatsapp', () => {
  const next = logReminderSent([], { customerId: 'c1', sentAt: '2026-11-03T10:00:00.000Z', channel: '' });
  assert.equal(next[0].channel, 'whatsapp');
});

test('reminderSentAt returns the latest send time, or null', () => {
  const log = [
    { customerId: 'c1', sentAt: '2026-11-02T09:00:00.000Z', channel: 'whatsapp' },
    { customerId: 'c1', sentAt: '2026-11-03T10:00:00.000Z', channel: 'whatsapp' },
    { customerId: 'c2', sentAt: '2026-11-03T11:00:00.000Z', channel: 'whatsapp' },
  ];
  assert.equal(reminderSentAt(log, 'c1'), '2026-11-03T10:00:00.000Z');
  assert.equal(reminderSentAt(log, 'c9'), null);
  assert.equal(reminderSentAt([], 'c1'), null);
});

test('logging a send never alters a payment or promise record', () => {
  const payment = { id: 'p1', amount: 1500 };
  const promise = { customerId: 'c1', promiseDate: '2026-11-05' };
  const before = JSON.stringify([payment, promise]);
  logReminderSent([], { customerId: 'c1', sentAt: '2026-11-03T10:00:00.000Z' });
  assert.equal(JSON.stringify([payment, promise]), before);
});

// ---- summary, filename, html, csv ----

test('summary text covers empty, single and multiple queues', () => {
  const empty = buildPreDueReminderQueue({ today: TODAY, windowDays: 3, bills: [] });
  assert.match(preDueReminderSummaryText(empty), /No bills fall due in the next 3 days/);
  const one = buildPreDueReminderQueue({ today: TODAY, windowDays: 3, bills: [bill()] });
  assert.match(preDueReminderSummaryText(one), /1 customer due within 3 days/);
  assert.match(preDueReminderSummaryText(one), /PKR 1,500/);
  const bad = buildPreDueReminderQueue({ today: 'bad', windowDays: 3, bills: [] });
  assert.match(preDueReminderSummaryText(bad), /unavailable/);
});

test('filename carries the today date and window', () => {
  const queue = buildPreDueReminderQueue({ today: TODAY, windowDays: 3, bills: [] });
  assert.equal(preDueReminderFilename(queue), 'pre-due-reminders-2026-11-03-3d.csv');
});

test('html escapes names and shows sent state and drafts', () => {
  const queue = buildPreDueReminderQueue({
    today: TODAY,
    windowDays: 3,
    bills: [bill({ customerName: '<b>Ahmed</b>' })],
  });
  const html = preDueReminderHtml(queue, [{ customerId: 'c1', sentAt: '2026-11-03T10:00:00.000Z', channel: 'whatsapp' }]);
  assert.doesNotMatch(html, /<b>Ahmed<\/b>/);
  assert.match(html, /&lt;b&gt;Ahmed&lt;\/b&gt;/);
  assert.match(html, /Send via WhatsApp/);
  assert.match(html, /Sent 2026-11-03 10:00 UTC/);
  assert.match(html, /Urdu draft/);
  assert.match(preDueReminderHtml(buildPreDueReminderQueue({ today: TODAY, windowDays: 3, bills: [] })), /No bills fall due/);
});

test('csv rows carry sent state and escape commas', () => {
  const queue = buildPreDueReminderQueue({
    today: TODAY,
    windowDays: 3,
    bills: [bill({ customerName: 'Ahmed, Jr' })],
  });
  const csv = preDueReminderCsv(queue, [{ customerId: 'c1', sentAt: '2026-11-03T10:00:00.000Z', channel: 'whatsapp' }]);
  assert.match(csv, /^Customer, Mohalla, Amount due \(PKR\), Due date, Days left, Bills, Sent at, Channel$/m);
  assert.match(csv, /"Ahmed, Jr",Bani,1500,2026-11-05,2,1,2026-11-03T10:00:00\.000Z,whatsapp/);
});
