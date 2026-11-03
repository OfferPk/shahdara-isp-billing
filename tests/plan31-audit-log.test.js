import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AUDIT_ACTIONS,
  auditActionLabel,
  validAuditDate,
  validAuditTimestamp,
  normalizeAuditEntry,
  normalizeAuditLog,
  appendAuditEntry,
  filterAuditEntries,
  auditSummary,
  auditSummaryText,
  auditHtml,
  auditCsv,
  auditFilename,
} from '../audit-log.js';

const entry = (overrides = {}) => ({
  id: 'a1',
  timestamp: '2026-11-03T10:15:00.000Z',
  action: 'payment_recorded',
  recordRef: 'cust-1/2026-11/pay-1',
  customerId: 'cust-1',
  customerName: 'Ahmed',
  detail: 'PKR 1000 · Cash',
  by: 'Saad',
  ...overrides,
});

test('Plan 31: audit catalogue covers exactly the seven plan actions', () => {
  assert.equal(AUDIT_ACTIONS.length, 7);
  assert.deepEqual(AUDIT_ACTIONS.map((a) => a.value), [
    'payment_recorded',
    'payment_voided',
    'payment_corrected',
    'customer_archived',
    'customer_unarchived',
    'waada_set',
    'concession_applied',
  ]);
  assert.equal(auditActionLabel('payment_voided'), 'Payment voided');
  assert.equal(auditActionLabel('waada_set'), 'Waada set');
  assert.equal(auditActionLabel('nope'), null);
});

test('Plan 31: date validation accepts real dates and rejects 2026-02-30', () => {
  assert.equal(validAuditDate('2026-11-03'), true);
  assert.equal(validAuditDate('2024-02-29'), true);
  assert.equal(validAuditDate('2026-02-30'), false);
  assert.equal(validAuditDate('2026-02-29'), false);
  assert.equal(validAuditDate('2026-13-01'), false);
  assert.equal(validAuditDate('03-11-2026'), false);
  assert.equal(validAuditDate(''), false);
  assert.equal(validAuditDate(null), false);
});

test('Plan 31: timestamp validation accepts ISO with millis and Z, rejects bad clock', () => {
  assert.equal(validAuditTimestamp('2026-11-03T10:15:00.000Z'), true);
  assert.equal(validAuditTimestamp('2026-11-03T10:15'), true);
  assert.equal(validAuditTimestamp('2026-11-03T10:15:30'), true);
  assert.equal(validAuditTimestamp('2026-11-03T25:15'), false);
  assert.equal(validAuditTimestamp('2026-11-03T10:60'), false);
  assert.equal(validAuditTimestamp('2026-02-30T10:15'), false);
  assert.equal(validAuditTimestamp('2026-11-03 10:15'), false);
  assert.equal(validAuditTimestamp('2026-11-03'), false);
});

test('Plan 31: normalisation derives date and time from the timestamp and trims', () => {
  const row = normalizeAuditEntry(entry({ recordRef: '  cust-1/2026-11/pay-1  ', detail: '  Cash  ' }));
  assert.equal(row.date, '2026-11-03');
  assert.equal(row.time, '10:15');
  assert.equal(row.recordRef, 'cust-1/2026-11/pay-1');
  assert.equal(row.detail, 'Cash');
  assert.equal(row.action, 'payment_recorded');
});

test('Plan 31: normalisation rejects unknown action, blank record, bad timestamp', () => {
  assert.equal(normalizeAuditEntry(entry({ action: 'bill_deleted' })), null);
  assert.equal(normalizeAuditEntry(entry({ recordRef: '   ' })), null);
  assert.equal(normalizeAuditEntry(entry({ timestamp: '2026-02-30T10:15' })), null);
  assert.equal(normalizeAuditEntry(entry({ timestamp: '' })), null);
  assert.equal(normalizeAuditEntry(null), null);
  assert.equal(normalizeAuditEntry('x'), null);
});

test('Plan 31: missing operator stays null-ish, never an invented name', () => {
  const row = normalizeAuditEntry(entry({ by: undefined }));
  assert.equal(row.by, '');
  const row2 = normalizeAuditEntry({ ...entry(), by: '  ' });
  assert.equal(row2.by, '');
});

test('Plan 31: append adds a new array and never mutates the input', () => {
  const base = [entry({ id: 'a1' })];
  const next = appendAuditEntry(base, entry({ id: 'a2', action: 'payment_voided' }));
  assert.equal(base.length, 1);
  assert.equal(next.length, 2);
  assert.equal(next[1].id, 'a2');
  assert.notEqual(next, base);
  assert.equal(base[0].action, 'payment_recorded');
});

test('Plan 31: append of a rejected entry leaves the list unchanged', () => {
  const base = [entry({ id: 'a1' })];
  assert.equal(appendAuditEntry(base, entry({ action: 'unknown' })), base);
  assert.equal(appendAuditEntry(base, entry({ recordRef: '' })), base);
  assert.equal(appendAuditEntry(base, null), base);
});

test('Plan 31: append to a non-array starts a fresh list', () => {
  assert.deepEqual(appendAuditEntry(null, entry()).map((r) => r.id), ['a1']);
  assert.deepEqual(appendAuditEntry(undefined, entry()).length, 1);
});

test('Plan 31: filter by action type', () => {
  const log = [
    entry({ id: 'a1', action: 'payment_recorded' }),
    entry({ id: 'a2', action: 'payment_voided', timestamp: '2026-11-04T09:00:00.000Z' }),
    entry({ id: 'a3', action: 'payment_recorded', timestamp: '2026-11-05T09:00:00.000Z' }),
  ];
  assert.deepEqual(filterAuditEntries(log, { action: 'payment_voided' }).map((r) => r.id), ['a2']);
  assert.deepEqual(filterAuditEntries(log, { action: '' }).map((r) => r.id), ['a1', 'a2', 'a3']);
  assert.deepEqual(filterAuditEntries(log, { action: 'bill_deleted' }), []);
});

test('Plan 31: filter by exact date', () => {
  const log = [
    entry({ id: 'a1' }),
    entry({ id: 'a2', timestamp: '2026-11-04T09:00:00.000Z' }),
  ];
  assert.deepEqual(filterAuditEntries(log, { date: '2026-11-04' }).map((r) => r.id), ['a2']);
  assert.deepEqual(filterAuditEntries(log, { date: '2026-11-09' }), []);
});

test('Plan 31: date range filter is inclusive at both ends', () => {
  const log = [
    entry({ id: 'a1', timestamp: '2026-11-03T10:15:00.000Z' }),
    entry({ id: 'a2', timestamp: '2026-11-04T09:00:00.000Z' }),
    entry({ id: 'a3', timestamp: '2026-11-05T09:00:00.000Z' }),
  ];
  assert.deepEqual(
    filterAuditEntries(log, { fromDate: '2026-11-03', toDate: '2026-11-04' }).map((r) => r.id),
    ['a1', 'a2'],
  );
});

test('Plan 31: an invalid date filter is ignored rather than hiding the log', () => {
  const log = [entry({ id: 'a1' })];
  assert.deepEqual(filterAuditEntries(log, { date: '2026-02-30' }).map((r) => r.id), ['a1']);
  assert.deepEqual(filterAuditEntries(log, { fromDate: 'junk' }).map((r) => r.id), ['a1']);
});

test('Plan 31: filter drops invalid rows and never mutates the input', () => {
  const log = [entry({ id: 'a1' }), entry({ id: 'bad', action: 'unknown' })];
  const out = filterAuditEntries(log, {});
  assert.deepEqual(out.map((r) => r.id), ['a1']);
  assert.equal(log.length, 2);
});

test('Plan 31: summary counts per action and total', () => {
  const log = [
    entry({ id: 'a1', action: 'payment_recorded' }),
    entry({ id: 'a2', action: 'payment_recorded', timestamp: '2026-11-04T09:00:00.000Z' }),
    entry({ id: 'a3', action: 'waada_set', timestamp: '2026-11-05T09:00:00.000Z' }),
  ];
  const summary = auditSummary(log);
  assert.equal(summary.total, 3);
  assert.equal(summary.byAction.payment_recorded, 2);
  assert.equal(summary.byAction.waada_set, 1);
  assert.equal(summary.byAction.payment_voided, 0);
});

test('Plan 31: summary text for empty and non-empty logs', () => {
  assert.equal(auditSummaryText(auditSummary([])), 'No operator actions logged yet.');
  const text = auditSummaryText(auditSummary([entry({ id: 'a1' })]));
  assert.match(text, /1 action logged/);
  assert.match(text, /Payment recorded: 1/);
});

test('Plan 31: log order is insertion order, newest action last', () => {
  const log = appendAuditEntry(
    appendAuditEntry([], entry({ id: 'a1' })),
    entry({ id: 'a2', action: 'payment_voided', timestamp: '2026-11-04T09:00:00.000Z' }),
  );
  assert.deepEqual(log.map((r) => r.id), ['a1', 'a2']);
});

test('Plan 31: HTML escapes markup in detail and names', () => {
  const html = auditHtml([entry({ detail: '<script>alert(1)</script>', customerName: 'A & B' })]);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /A &amp; B/);
  assert.match(html, /Payment recorded/);
  assert.match(html, /2026-11-03/);
  assert.match(html, /10:15/);
});

test('Plan 31: HTML shows Not recorded for a missing operator', () => {
  const html = auditHtml([entry({ by: '' })]);
  assert.match(html, /Not recorded/);
});

test('Plan 31: HTML empty state for no matching entries', () => {
  assert.match(auditHtml([]), /No operator actions match/);
});

test('Plan 31: CSV header, rows, and quoting', () => {
  const csv = auditCsv([
    entry({ detail: 'Cash, "quoted"' }),
    entry({ id: 'a2', action: 'waada_set', timestamp: '2026-11-04T09:00:00.000Z', detail: '' }),
  ]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'date,time,action,record,detail,by');
  assert.match(lines[1], /"Cash, ""quoted"""/);
  assert.match(lines[1], /Payment recorded/);
  assert.match(lines[2], /Waada set/);
});

test('Plan 31: CSV filename', () => {
  assert.equal(auditFilename(), 'operator-audit-log.csv');
});

test('Plan 31: an audit entry carries no money total field', () => {
  const row = normalizeAuditEntry(entry());
  assert.equal('amount' in row, false);
  assert.equal('balance' in row, false);
  assert.equal('total' in row, false);
});

test('Plan 31: normalizeAuditLog drops invalid rows from a stored list', () => {
  const rows = normalizeAuditLog([entry({ id: 'a1' }), entry({ id: 'bad', action: 'x' }), null]);
  assert.deepEqual(rows.map((r) => r.id), ['a1']);
  assert.deepEqual(normalizeAuditLog(null), []);
  assert.deepEqual(normalizeAuditLog('x'), []);
});
