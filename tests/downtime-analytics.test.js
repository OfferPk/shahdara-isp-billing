// SISP-16: Customer-Wise and Network-Wide Downtime Hours Analytics.
// Pure-function tests on synthetic data only. Spec test criterion (verbatim):
// logging 2 Fiber Cut events (4h and 2.5h) and 1 Charger Off event (1.5h)
// for a customer accurately reports 3 complaints, 8.0 total customer
// offline hours, and 6.5 hours due to Fiber Cut in the monthly breakdown.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AREA_OUTAGE_CUSTOMER_ID,
  COMPLAINT_CATEGORIES
} from '../complaint-register.js';
import {
  buildCustomerDowntimeSummary,
  buildMonthlyDowntimeAnalytics,
  primaryIssueTag
} from '../downtime-analytics.js';

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
  resolutionNote: '',
  createdAt: '',
  ...overrides
});

test('spec criterion verbatim: 2 Fiber Cut (4h + 2.5h) + 1 Charger Off (1.5h) = 3 complaints, 8.0h total, 6.5h Fiber Cut', () => {
  const list = [
    complaint({ id: 'CMP-101', downtimeHours: 4, issueCategory: 'Fiber Cut' }),
    complaint({ id: 'CMP-102', downtimeHours: 2.5, issueCategory: 'Fiber Cut', reportedAt: '2026-10-06T09:00', resolvedAt: '2026-10-06T11:30' }),
    complaint({ id: 'CMP-103', downtimeHours: 1.5, issueCategory: 'Media Converter / Charger Off', reportedAt: '2026-10-07T08:00', resolvedAt: '2026-10-07T09:30' })
  ];
  const analytics = buildMonthlyDowntimeAnalytics(list, '2026-10');
  assert.equal(analytics.totalComplaints, 3);
  assert.equal(analytics.totalDowntime, 8);
  const fiberCut = analytics.byCause.find((row) => row.category === 'Fiber Cut');
  assert.equal(fiberCut.incidents, 2);
  assert.equal(fiberCut.totalDowntime, 6.5);
  const charger = analytics.byCause.find((row) => row.category === 'Media Converter / Charger Off');
  assert.equal(charger.incidents, 1);
  assert.equal(charger.totalDowntime, 1.5);
  assert.equal(analytics.perCustomer.length, 1);
  assert.equal(analytics.perCustomer[0].complaintCount, 3);
  assert.equal(analytics.perCustomer[0].totalDowntime, 8);
  assert.equal(analytics.perCustomer[0].primaryIssueTag, 'Fiber Cut');
});

test('month filtering: other months and unresolved complaints handled', () => {
  const list = [
    complaint({ id: 'CMP-101', downtimeHours: 4 }),
    complaint({ id: 'CMP-102', reportedAt: '2026-09-05T10:00', resolvedAt: '2026-09-05T12:00', downtimeHours: 2 }),
    complaint({ id: 'CMP-103', status: 'Open', resolvedAt: '', downtimeHours: null, reportedAt: '2026-10-10T10:00' })
  ];
  const oct = buildMonthlyDowntimeAnalytics(list, '2026-10');
  assert.equal(oct.totalComplaints, 2);
  assert.equal(oct.totalDowntime, 4); // unresolved contributes 0 hours
  const sep = buildMonthlyDowntimeAnalytics(list, '2026-09');
  assert.equal(sep.totalComplaints, 1);
  assert.equal(sep.totalDowntime, 2);
});

test('primary issue tag: tie breaks by category order, empty yields blank', () => {
  assert.equal(primaryIssueTag({}), '');
  assert.equal(primaryIssueTag({ 'Media Converter / Charger Off': 1, 'Fiber Cut': 1 }), 'Fiber Cut');
  assert.equal(primaryIssueTag({ Other: 3, 'WAPDA / Power Outage': 1 }), 'Other');
});

test('AREA_OUTAGE counts toward network breakdown, never toward a customer', () => {
  const list = [
    complaint({ id: 'CMP-101', downtimeHours: 4 }),
    complaint({
      id: 'CMP-102', customerId: AREA_OUTAGE_CUSTOMER_ID, customerName: AREA_OUTAGE_CUSTOMER_ID,
      zone: 'Barrian', issueCategory: 'WAPDA / Power Outage', reportedAt: '2026-10-06T10:00',
      resolvedAt: '2026-10-06T13:00', downtimeHours: 3
    })
  ];
  const analytics = buildMonthlyDowntimeAnalytics(list, '2026-10');
  assert.equal(analytics.totalComplaints, 2);
  assert.equal(analytics.totalDowntime, 7);
  assert.equal(analytics.areaOutageComplaints, 1);
  assert.equal(analytics.areaOutageDowntime, 3);
  assert.equal(analytics.perCustomer.length, 1);
  assert.equal(analytics.perCustomer[0].customerName, 'Test Customer 11');
  const wapda = analytics.byCause.find((row) => row.category === 'WAPDA / Power Outage');
  assert.equal(wapda.incidents, 1);
  assert.equal(wapda.totalDowntime, 3);
});

test('zero-complaint months and invalid months yield zeroed analytics', () => {
  const analytics = buildMonthlyDowntimeAnalytics([complaint()], '2026-11');
  assert.equal(analytics.totalComplaints, 0);
  assert.equal(analytics.totalDowntime, 0);
  assert.deepEqual(analytics.perCustomer, []);
  assert.equal(analytics.byCause.length, COMPLAINT_CATEGORIES.length);
  assert.ok(analytics.byCause.every((row) => row.incidents === 0 && row.totalDowntime === 0));
  const invalid = buildMonthlyDowntimeAnalytics([complaint()], 'not-a-month');
  assert.equal(invalid.month, '');
  assert.equal(invalid.totalComplaints, 0);
});

test('per-customer ordering: highest downtime first, then complaint count', () => {
  const list = [
    complaint({ id: 'CMP-101', customerId: 'c1', customerName: 'AAA', downtimeHours: 2 }),
    complaint({ id: 'CMP-102', customerId: 'c2', customerName: 'BBB', downtimeHours: 9 }),
    complaint({ id: 'CMP-103', customerId: 'c3', customerName: 'CCC', downtimeHours: 2 }),
    complaint({ id: 'CMP-104', customerId: 'c3', customerName: 'CCC', downtimeHours: 1, reportedAt: '2026-10-06T10:00', resolvedAt: '2026-10-06T11:00' })
  ];
  const analytics = buildMonthlyDowntimeAnalytics(list, '2026-10');
  assert.deepEqual(analytics.perCustomer.map((c) => c.customerName), ['BBB', 'CCC', 'AAA']);
  assert.equal(analytics.perCustomer[1].complaintCount, 2);
  assert.equal(analytics.perCustomer[1].totalDowntime, 3);
});

test('customer summary: month scope, all-time scope, and unknown customer', () => {
  const list = [
    complaint({ id: 'CMP-101', downtimeHours: 4 }),
    complaint({ id: 'CMP-102', reportedAt: '2026-09-05T10:00', resolvedAt: '2026-09-05T11:00', downtimeHours: 1 })
  ];
  const oct = buildCustomerDowntimeSummary(list, 'c1', '2026-10');
  assert.equal(oct.complaintCount, 1);
  assert.equal(oct.totalDowntime, 4);
  assert.equal(oct.primaryIssueTag, 'Fiber Cut');
  const all = buildCustomerDowntimeSummary(list, 'c1', '');
  assert.equal(all.complaintCount, 2);
  assert.equal(all.totalDowntime, 5);
  const none = buildCustomerDowntimeSummary(list, 'nobody', '2026-10');
  assert.equal(none.complaintCount, 0);
  assert.equal(none.totalDowntime, 0);
  assert.equal(none.primaryIssueTag, '');
});

test('unknown categories fall back to Other in the breakdown', () => {
  const list = [complaint({ id: 'CMP-101', issueCategory: 'Mystery Fault', downtimeHours: 2 })];
  const analytics = buildMonthlyDowntimeAnalytics(list, '2026-10');
  const other = analytics.byCause.find((row) => row.category === 'Other');
  assert.equal(other.incidents, 1);
  assert.equal(other.totalDowntime, 2);
});
