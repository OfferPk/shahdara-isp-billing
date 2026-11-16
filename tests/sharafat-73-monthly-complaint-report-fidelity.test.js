// Sharafat 73 — the monthly complaint report lost detail: the CSV had
// no UTF-8 BOM and joined with '\n' (Urdu/customer names mojibake in
// Excel), the log collapsed every non-Resolved status to 'Pending', and
// the per-customer row kept only the first zone seen. Tests on synthetic
// data only: no real customer names, no phone numbers anywhere in this
// file. The Urdu fixture uses 'احمد' (Ahmed — the established generic
// placeholder family).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthlyComplaintReport,
  buildReportCsv
} from '../monthly-complaint-report.js';

const complaint = (overrides = {}) => ({
  id: 'CMP-101',
  customerId: 'c1',
  customerName: 'Test Customer 11',
  zone: 'Palaliya',
  issueCategory: 'Fiber Cut',
  reportedAt: '2026-10-05T10:00',
  resolvedAt: '2026-10-05T14:00',
  downtimeHours: 4,
  status: 'Resolved',
  resolutionNote: 'Splice repaired',
  ...overrides
});

test('CSV: starts with a UTF-8 BOM and uses CRLF line breaks only', () => {
  const csv = buildReportCsv(buildMonthlyComplaintReport([complaint({})], '2026-10'));
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.ok(!/(?<!\r)\n/.test(csv), 'every line break is CRLF, no bare LF');
  assert.ok(csv.includes('\r\n'));
});

test('CSV: the empty-month report is BOM\'d too', () => {
  const csv = buildReportCsv(buildMonthlyComplaintReport([], '2026-10'));
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.ok(!/(?<!\r)\n/.test(csv));
  assert.ok(csv.includes('Total Complaints Logged'));
});

test('CSV: a two-zone customer reads as one quoted Area/Zone cell', () => {
  const list = [
    complaint({ id: 'CMP-101', zone: 'Palaliya' }),
    complaint({ id: 'CMP-102', zone: 'Barrian', reportedAt: '2026-10-06T09:00', resolvedAt: '2026-10-06T11:30', downtimeHours: 2 })
  ];
  const csv = buildReportCsv(buildMonthlyComplaintReport(list, '2026-10'));
  // csvEscape quotes on ',' — the joined zones stay one CSV cell.
  assert.ok(csv.includes('"Palaliya, Barrian"'));
});

test('CSV: an Urdu customer name is present verbatim', () => {
  const csv = buildReportCsv(buildMonthlyComplaintReport(
    [complaint({ customerName: 'احمد' })], '2026-10'
  ));
  assert.ok(csv.includes('احمد'));
});

test('log: Open, In Progress and Resolved each print their real status', () => {
  const list = [
    complaint({ id: 'CMP-101', status: 'Resolved' }),
    complaint({ id: 'CMP-102', status: 'Open', resolvedAt: '', reportedAt: '2026-10-06T09:00', downtimeHours: 0 }),
    complaint({ id: 'CMP-103', status: 'In Progress', resolvedAt: '', reportedAt: '2026-10-07T08:00', downtimeHours: 1 })
  ];
  const report = buildMonthlyComplaintReport(list, '2026-10');
  assert.equal(report.log[0].status, 'Resolved');
  assert.equal(report.log[1].status, 'Open');
  assert.equal(report.log[2].status, 'In Progress');
});

test('log: an unknown status degrades to Pending, never a raw string', () => {
  const report = buildMonthlyComplaintReport(
    [complaint({ id: 'CMP-101', status: 'Weird' })], '2026-10'
  );
  assert.equal(report.log[0].status, 'Pending');
});

test('log: chronological order is unchanged by the status fix', () => {
  const list = [
    complaint({ id: 'CMP-103', reportedAt: '2026-10-07T08:00' }),
    complaint({ id: 'CMP-101', reportedAt: '2026-10-05T10:00' }),
    complaint({ id: 'CMP-102', reportedAt: '2026-10-06T09:00' })
  ];
  const report = buildMonthlyComplaintReport(list, '2026-10');
  assert.deepEqual(report.log.map((row) => row.id), ['CMP-101', 'CMP-102', 'CMP-103']);
});

test('zones: a two-zone customer shows both zones, first-seen order', () => {
  const list = [
    complaint({ id: 'CMP-101', zone: 'Palaliya' }),
    complaint({ id: 'CMP-102', zone: 'Barrian', reportedAt: '2026-10-06T09:00', resolvedAt: '2026-10-06T11:30', downtimeHours: 2 }),
    complaint({ id: 'CMP-103', zone: 'Palaliya', reportedAt: '2026-10-07T08:00', resolvedAt: '2026-10-07T09:30', downtimeHours: 1 })
  ];
  const report = buildMonthlyComplaintReport(list, '2026-10');
  assert.equal(report.perCustomer.length, 1);
  assert.equal(report.perCustomer[0].areaZone, 'Palaliya, Barrian');
});

test('zones: the same zone twice appears once; a single zone is unchanged', () => {
  const same = buildMonthlyComplaintReport([
    complaint({ id: 'CMP-101', zone: 'Barrian' }),
    complaint({ id: 'CMP-102', zone: 'Barrian', reportedAt: '2026-10-06T09:00', resolvedAt: '2026-10-06T11:30', downtimeHours: 2 })
  ], '2026-10');
  assert.equal(same.perCustomer[0].areaZone, 'Barrian');
  const single = buildMonthlyComplaintReport([complaint({})], '2026-10');
  assert.equal(single.perCustomer[0].areaZone, 'Palaliya');
});

test('zones: blank zones are ignored; a zone-less customer shows no zone', () => {
  const report = buildMonthlyComplaintReport([
    complaint({ id: 'CMP-101', zone: 'Barrian' }),
    complaint({ id: 'CMP-102', zone: '   ', reportedAt: '2026-10-06T09:00', resolvedAt: '2026-10-06T11:30', downtimeHours: 2 }),
    complaint({ id: 'CMP-103', zone: '', reportedAt: '2026-10-07T08:00', resolvedAt: '2026-10-07T09:30', downtimeHours: 1 })
  ], '2026-10');
  assert.equal(report.perCustomer[0].areaZone, 'Barrian');
  const none = buildMonthlyComplaintReport([complaint({ zone: '' })], '2026-10');
  assert.equal(none.perCustomer[0].areaZone, '');
});

test('zones: variant spellings of one mohalla stay as stored (Sharafat 73 discloses, does not fold)', () => {
  const report = buildMonthlyComplaintReport([
    complaint({ id: 'CMP-101', zone: 'Palaliya' }),
    complaint({ id: 'CMP-102', zone: 'PALALIYAA', reportedAt: '2026-10-06T09:00', resolvedAt: '2026-10-06T11:30', downtimeHours: 2 })
  ], '2026-10');
  // Fidelity surface: the report prints what the ledger holds.
  // Canonical folding in the report is a follow-up, not this item.
  assert.equal(report.perCustomer[0].areaZone, 'Palaliya, PALALIYAA');
});

test('guards: In Progress still counts toward pendingCount and the per-customer aggregate', () => {
  const report = buildMonthlyComplaintReport([
    complaint({ id: 'CMP-101', status: 'Resolved' }),
    complaint({ id: 'CMP-102', status: 'In Progress', resolvedAt: '', reportedAt: '2026-10-06T09:00', downtimeHours: 0 })
  ], '2026-10');
  assert.equal(report.summary.pendingCount, 1);
  assert.equal(report.perCustomer[0].status, 'Pending (1)');
});
