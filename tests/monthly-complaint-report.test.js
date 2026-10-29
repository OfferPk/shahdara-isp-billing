// SISP-17: Monthly Complaint and Outage Report Generator.
// Pure-function tests on synthetic data only. Spec test criterion (verbatim):
// selecting any historical month filters all 4 report sections accurately
// and exports valid CSV/print layouts offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthlyComplaintReport,
  buildPrintableReportHtml,
  buildReportCsv,
  buildReportWhatsAppSummary,
  monthLabel
} from '../monthly-complaint-report.js';

const complaint = (overrides = {}) => ({
  id: 'CMP-101',
  customerId: 'c1',
  customerName: 'Test Customer 11',
  zone: 'Shahdara Town',
  issueCategory: 'Fiber Cut',
  reportedAt: '2026-10-05T10:00',
  resolvedAt: '2026-10-05T14:00',
  downtimeHours: 4,
  downtimeManual: false,
  status: 'Resolved',
  resolutionNote: 'Splice repaired',
  createdAt: '',
  ...overrides
});

// October trio (mirrors the SISP-16 spec trio) + one September row + one open row.
const LIST = [
  complaint({}),
  complaint({ id: 'CMP-102', reportedAt: '2026-10-06T09:00', resolvedAt: '2026-10-06T11:30', downtimeHours: 2.5 }),
  complaint({ id: 'CMP-103', issueCategory: 'Media Converter / Charger Off', reportedAt: '2026-10-07T08:00', resolvedAt: '2026-10-07T09:30', downtimeHours: 1.5, resolutionNote: '' }),
  complaint({ id: 'CMP-090', reportedAt: '2026-09-20T10:00', resolvedAt: '2026-09-20T12:00', downtimeHours: 2 }),
  complaint({ id: 'CMP-104', customerId: 'c2', customerName: 'Test Customer 34', zone: 'Barrian', issueCategory: 'WAPDA / Power Outage', reportedAt: '2026-10-08T18:00', resolvedAt: '', downtimeHours: null, status: 'Open', resolutionNote: '' }),
  complaint({ id: 'CMP-105', customerId: 'AREA_OUTAGE', customerName: 'AREA_OUTAGE', zone: 'Barrian', issueCategory: 'Main Uplink / NayaPay Down', reportedAt: '2026-10-09T06:00', resolvedAt: '2026-10-09T08:00', downtimeHours: 2, resolutionNote: 'Uplink restored' })
];

test('month filter: only October rows feed all 4 sections', () => {
  const report = buildMonthlyComplaintReport(LIST, '2026-10');
  assert.equal(report.month, '2026-10');
  assert.equal(report.summary.totalComplaints, 5);
  assert.equal(report.log.length, 5);
  assert.ok(report.log.every((row) => row.reportedAt.startsWith('2026-10')));
  assert.ok(!report.log.some((row) => row.id === 'CMP-090'));
  const september = buildMonthlyComplaintReport(LIST, '2026-09');
  assert.equal(september.summary.totalComplaints, 1);
  assert.equal(september.log[0].id, 'CMP-090');
});

test('summary: resolved/pending/total hours/Fiber Cut hours', () => {
  const report = buildMonthlyComplaintReport(LIST, '2026-10');
  assert.equal(report.summary.resolvedCount, 4);
  assert.equal(report.summary.pendingCount, 1);
  // 4 + 2.5 + 1.5 + 0 (open, null downtime) + 2 (area outage) = 10.0.
  assert.equal(report.summary.totalDowntime, 10);
  assert.equal(report.summary.fiberCutHours, 6.5);
});

test('per-customer: sorted by complaints then hours; status + last resolved', () => {
  const report = buildMonthlyComplaintReport(LIST, '2026-10');
  assert.equal(report.perCustomer.length, 2);
  assert.equal(report.perCustomer[0].customerName, 'Test Customer 11');
  assert.equal(report.perCustomer[0].complaintCount, 3);
  assert.equal(report.perCustomer[0].totalDowntime, 8);
  assert.equal(report.perCustomer[0].status, 'Resolved');
  assert.equal(report.perCustomer[0].lastResolvedAt, '2026-10-07T09:30');
  assert.equal(report.perCustomer[0].areaZone, 'Shahdara Town');
  assert.equal(report.perCustomer[1].customerName, 'Test Customer 34');
  assert.equal(report.perCustomer[1].status, 'Pending (1)');
  assert.equal(report.perCustomer[1].totalDowntime, 0);
  assert.equal(report.perCustomer[1].lastResolvedAt, '');
  // Area outage never becomes a customer row.
  assert.ok(!report.perCustomer.some((row) => row.customerName === 'AREA_OUTAGE'));
});

test('cause breakdown: only active causes, share % of network total', () => {
  const report = buildMonthlyComplaintReport(LIST, '2026-10');
  const fiber = report.byCause.find((row) => row.category === 'Fiber Cut');
  assert.equal(fiber.incidents, 2);
  assert.equal(fiber.totalDowntime, 6.5);
  assert.equal(fiber.sharePct, 65);
  const uplink = report.byCause.find((row) => row.category === 'Main Uplink / NayaPay Down');
  assert.equal(uplink.incidents, 1);
  assert.equal(uplink.totalDowntime, 2);
  assert.equal(uplink.sharePct, 20);
  assert.ok(!report.byCause.some((row) => row.incidents === 0));
  const totalShare = report.byCause.reduce((sum, row) => sum + row.sharePct, 0);
  assert.ok(totalShare >= 99 && totalShare <= 101);
});

test('log: chronological order, area outage labelled, notes carried', () => {
  const report = buildMonthlyComplaintReport(LIST, '2026-10');
  assert.deepEqual(
    report.log.map((row) => row.id),
    ['CMP-101', 'CMP-102', 'CMP-103', 'CMP-104', 'CMP-105']
  );
  assert.equal(report.log[4].customer, 'Area outage · Barrian');
  assert.equal(report.log[0].resolutionNote, 'Splice repaired');
  assert.equal(report.log[3].status, 'Pending');
  assert.equal(report.log[3].downtimeHours, 0);
});

test('invalid month yields a zeroed report', () => {
  const report = buildMonthlyComplaintReport(LIST, 'not-a-month');
  assert.equal(report.month, '');
  assert.equal(report.summary.totalComplaints, 0);
  assert.equal(report.perCustomer.length, 0);
  assert.equal(report.byCause.length, 0);
  assert.equal(report.log.length, 0);
});

test('empty list yields a zeroed report', () => {
  const report = buildMonthlyComplaintReport([], '2026-10');
  assert.equal(report.summary.totalComplaints, 0);
  assert.equal(report.summary.totalDowntime, 0);
  assert.equal(report.summary.fiberCutHours, 0);
});

test('CSV: summary lines + all 3 tables, comma values quoted', () => {
  const tricky = buildMonthlyComplaintReport([
    complaint({ customerName: 'ALI, SON OF BILAL', resolutionNote: 'Fixed, tested ok' })
  ], '2026-10');
  const csv = buildReportCsv(tricky);
  assert.ok(csv.includes('Monthly Complaint Report,October 2026'));
  assert.ok(csv.includes('Total Complaints Logged,1'));
  assert.ok(csv.includes('Customer,Area/Zone,Complaints,Total Hours Off,Last Resolved,Status'));
  assert.ok(csv.includes('Issue Cause,Incidents,Total Hours Off,Share %'));
  assert.ok(csv.includes('Ticket ID,Customer,Issue,Complaint Date/Time,Resolved Date/Time,Hours Off,Resolution Note,Status'));
  assert.ok(csv.includes('"ALI, SON OF BILAL"'));
  assert.ok(csv.includes('"Fixed, tested ok"'));
});

test('WhatsApp summary: Roman and Urdu carry the same totals', () => {
  const report = buildMonthlyComplaintReport(LIST, '2026-10');
  const roman = buildReportWhatsAppSummary(report, 'roman');
  assert.ok(roman.includes('Kul 5 shikayat'));
  assert.ok(roman.includes('4 hal, 1 pending'));
  assert.ok(roman.includes('10 ghante'));
  assert.ok(roman.includes('Test Customer 11'));
  const urdu = buildReportWhatsAppSummary(report, 'urdu');
  assert.ok(urdu.includes('کل 5 شکایات'));
  assert.ok(urdu.includes('4 حل، 1 زیر التواء'));
  assert.ok(urdu.includes('10 گھنٹے'));
  const empty = buildMonthlyComplaintReport([], '2026-10');
  assert.ok(buildReportWhatsAppSummary(empty, 'roman').includes('koi shikayat darj nahi hui'));
  assert.ok(buildReportWhatsAppSummary(empty, 'urdu').includes('کوئی شکایت درج نہیں ہوئی'));
});

test('printable HTML: all 4 sections, values escaped', () => {
  const report = buildMonthlyComplaintReport([
    complaint({ customerName: '<script>alert(1)</script>' })
  ], '2026-10');
  const html = buildPrintableReportHtml(report);
  assert.ok(html.includes('Monthly Complaint Report'));
  assert.ok(html.includes('Customer complaint frequency'));
  assert.ok(html.includes('Cause-wise outage breakdown'));
  assert.ok(html.includes('Full chronological complaint log'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('monthLabel formats YYYY-MM in English month names', () => {
  assert.equal(monthLabel('2026-10'), 'October 2026');
  assert.equal(monthLabel('2026-01'), 'January 2026');
  assert.equal(monthLabel('bogus'), 'bogus');
});

test('missing fields degrade safely (no zone, no name, unknown status)', () => {
  const report = buildMonthlyComplaintReport([
    { id: 'CMP-200', customerId: null, customerName: '', zone: '', issueCategory: 'Other', reportedAt: '2026-10-01T09:00', resolvedAt: '', downtimeHours: null, status: 'Weird', resolutionNote: '' }
  ], '2026-10');
  assert.equal(report.perCustomer[0].customerName, 'Unknown customer');
  assert.equal(report.perCustomer[0].areaZone, '');
  assert.equal(report.perCustomer[0].status, 'Pending (1)');
  assert.equal(report.summary.pendingCount, 1);
});
