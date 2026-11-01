// SISP-139: Power Outage & Charger-Off Downtime Correlation Report.
// Pure-function tests on synthetic data only. Spec test criteria:
// root-cause grouping over closed register complaints + standalone
// tickets (synced SISP-44 pairs counted once, duration-less closed
// incidents excluded and counted) and Top-5 upstream root-house ranking
// by downstream customer-minutes of outage caused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AREA_OUTAGE_CUSTOMER_ID } from '../complaint-register.js';
import {
  ROOT_CAUSE_CATEGORY_BUCKETS,
  ROOT_CAUSE_PRESET_BUCKETS,
  buildPowerOutageCorrelation
} from '../downtime-analytics.js';

const complaint = (overrides = {}) => ({
  id: 'CMP-101',
  customerId: 'c-leaf-1',
  customerName: 'Test Customer 11',
  zone: 'BARRIAN',
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

const ticket = (overrides = {}) => ({
  id: 'TKT-101',
  customerId: 'c-leaf-1',
  customerName: 'Test Customer 11',
  complaintId: '',
  faultPreset: 'Fiber Cut / Splice Loss',
  customFault: '',
  technician: 'Test Technician',
  priority: 'Normal',
  status: 'Resolved',
  createdAt: '2026-10-05T10:00',
  resolvedAt: '2026-10-05T12:00',
  note: '',
  materialsUsed: [],
  billingType: 'free',
  billedAmount: 0,
  chargePaid: false,
  chargePaidAt: '',
  chargePaymentId: '',
  resolvedViaComplaintId: '',
  stockDeductions: [],
  stockDeducted: false,
  ...overrides
});

const customer = (overrides = {}) => ({
  id: 'c-1',
  customerNumber: 1,
  name: 'Test Customer 1',
  archived: false,
  upstreamCustomerId: '',
  ...overrides
});

const bucket = (report, key) => report.buckets.find((row) => row.key === key);

test('bucket mapping tables cover exactly the stated real categories and presets', () => {
  assert.deepEqual(ROOT_CAUSE_CATEGORY_BUCKETS, {
    'WAPDA / Power Outage': 'power',
    'Media Converter / Charger Off': 'power',
    'Fiber Cut': 'fiber',
    'Fiber Splice Loss': 'fiber'
  });
  assert.deepEqual(ROOT_CAUSE_PRESET_BUCKETS, {
    'Media Converter Power/Charger': 'power',
    'Fiber Cut / Splice Loss': 'fiber'
  });
});

test('root-cause grouping: exact bucket minutes and shares across power, fiber and other', () => {
  const complaints = [
    complaint({ id: 'CMP-101', issueCategory: 'WAPDA / Power Outage', downtimeHours: 2 }),
    complaint({ id: 'CMP-102', issueCategory: 'Media Converter / Charger Off', downtimeHours: 1.5 }),
    complaint({ id: 'CMP-103', issueCategory: 'Fiber Cut', downtimeHours: 4 }),
    complaint({ id: 'CMP-104', issueCategory: 'Fiber Splice Loss', downtimeHours: 2.5 }),
    complaint({ id: 'CMP-105', issueCategory: 'Router / Wi-Fi Config', downtimeHours: 1 }),
    complaint({ id: 'CMP-106', issueCategory: 'Main Uplink / NayaPay Down', downtimeHours: 0.5 }),
    // Unrecognized/future category folds into Other, never dropped.
    complaint({ id: 'CMP-107', issueCategory: 'Alien Interference', downtimeHours: 0.5 })
  ];
  const report = buildPowerOutageCorrelation({ complaints, tickets: [], customers: [] }, '2026-10');
  assert.equal(report.closedIncidents, 7);
  assert.equal(report.measurableIncidents, 7);
  assert.equal(report.unmeasurableIncidents, 0);
  assert.equal(report.totalMinutes, 720);
  // power: 120 + 90 = 210 -> 210/720 = 29.2%
  assert.equal(bucket(report, 'power').minutes, 210);
  assert.equal(bucket(report, 'power').incidents, 2);
  assert.equal(bucket(report, 'power').sharePct, 29.2);
  // fiber: 240 + 150 = 390 -> 54.2%
  assert.equal(bucket(report, 'fiber').minutes, 390);
  assert.equal(bucket(report, 'fiber').incidents, 2);
  assert.equal(bucket(report, 'fiber').sharePct, 54.2);
  // other: 60 + 30 + 30 = 120 -> 16.7%
  assert.equal(bucket(report, 'other').minutes, 120);
  assert.equal(bucket(report, 'other').incidents, 3);
  assert.equal(bucket(report, 'other').sharePct, 16.7);
});

test('standalone closed tickets join the shares through the preset mapping', () => {
  const tickets = [
    ticket({ id: 'TKT-101', faultPreset: 'Media Converter Power/Charger', createdAt: '2026-10-08T10:00', resolvedAt: '2026-10-08T12:00' }), // 120 power
    ticket({ id: 'TKT-102', faultPreset: 'Fiber Cut / Splice Loss', createdAt: '2026-10-09T10:00', resolvedAt: '2026-10-09T11:00' }), // 60 fiber
    ticket({ id: 'TKT-103', faultPreset: '', customFault: 'Loose patch cord at pole', createdAt: '2026-10-10T09:00', resolvedAt: '2026-10-10T09:30' }) // 30 other
  ];
  const report = buildPowerOutageCorrelation({ complaints: [], tickets, customers: [] }, '2026-10');
  assert.equal(report.closedIncidents, 3);
  assert.equal(report.totalMinutes, 210);
  assert.equal(bucket(report, 'power').minutes, 120);
  assert.equal(bucket(report, 'fiber').minutes, 60);
  assert.equal(bucket(report, 'other').minutes, 30);
});

test('a synced complaint+ticket pair (SISP-44) counts once, through the complaint', () => {
  const complaints = [
    complaint({ id: 'CMP-201', issueCategory: 'Fiber Cut', downtimeHours: 3 })
  ];
  const tickets = [
    // Same job, longer span on the ticket side: must NOT add minutes.
    ticket({ id: 'TKT-201', complaintId: 'CMP-201', createdAt: '2026-10-05T08:00', resolvedAt: '2026-10-05T18:00' })
  ];
  const report = buildPowerOutageCorrelation({ complaints, tickets, customers: [] }, '2026-10');
  assert.equal(report.closedIncidents, 1);
  assert.equal(report.totalMinutes, 180);
  assert.equal(bucket(report, 'fiber').minutes, 180);
  assert.equal(bucket(report, 'fiber').incidents, 1);
});

test('a linked ticket counts on its own when its complaint is not closed in the month', () => {
  const complaints = [
    complaint({ id: 'CMP-202', status: 'Open', resolvedAt: '', downtimeHours: null })
  ];
  const tickets = [
    ticket({ id: 'TKT-202', complaintId: 'CMP-202', faultPreset: 'Media Converter Power/Charger', createdAt: '2026-10-06T10:00', resolvedAt: '2026-10-06T11:00' })
  ];
  const report = buildPowerOutageCorrelation({ complaints, tickets, customers: [] }, '2026-10');
  assert.equal(report.closedIncidents, 1);
  assert.equal(bucket(report, 'power').minutes, 60);
});

test('duration-less closed incidents are excluded from the math and honestly counted', () => {
  const complaints = [
    // In-month (valid reportedAt) but no stored downtime and no usable resolvedAt: unmeasurable.
    complaint({ id: 'CMP-301', reportedAt: '2026-10-05T10:00', resolvedAt: '', downtimeHours: null }),
    // No stored downtime but valid endpoints: SISP-16 derivation applies (2.5h).
    complaint({ id: 'CMP-302', reportedAt: '2026-10-05T10:00', resolvedAt: '2026-10-05T12:30', downtimeHours: null })
  ];
  const tickets = [
    // In-month createdAt but no resolvedAt: unmeasurable.
    ticket({ id: 'TKT-301', createdAt: '2026-10-05T10:00', resolvedAt: '' })
  ];
  const report = buildPowerOutageCorrelation({ complaints, tickets, customers: [] }, '2026-10');
  assert.equal(report.closedIncidents, 3);
  assert.equal(report.measurableIncidents, 1);
  assert.equal(report.unmeasurableIncidents, 2);
  assert.equal(report.totalMinutes, 150);
  assert.equal(bucket(report, 'fiber').minutes, 150);
});

test('open incidents and other months are ignored; zero total yields null shares, never NaN', () => {
  const complaints = [
    complaint({ id: 'CMP-401', status: 'Open', resolvedAt: '', downtimeHours: null }),
    complaint({ id: 'CMP-402', reportedAt: '2026-09-05T10:00', resolvedAt: '2026-09-05T12:00', downtimeHours: 2 })
  ];
  const tickets = [
    ticket({ id: 'TKT-401', createdAt: '2026-09-05T10:00', resolvedAt: '2026-09-05T12:00' })
  ];
  const report = buildPowerOutageCorrelation({ complaints, tickets, customers: [] }, '2026-10');
  assert.equal(report.closedIncidents, 0);
  assert.equal(report.totalMinutes, 0);
  for (const row of report.buckets) assert.equal(row.sharePct, null);
  assert.deepEqual(report.topRootHouses, []);
  const bogus = buildPowerOutageCorrelation({ complaints, tickets, customers: [] }, 'bogus');
  assert.equal(bogus.month, '');
  assert.equal(bogus.closedIncidents, 0);
});

test('AREA_OUTAGE minutes enter the cause shares but never anchor a root house', () => {
  const complaints = [
    complaint({ id: 'CMP-501', customerId: AREA_OUTAGE_CUSTOMER_ID, customerName: AREA_OUTAGE_CUSTOMER_ID, issueCategory: 'WAPDA / Power Outage', downtimeHours: 5 })
  ];
  const customers = [
    customer({ id: 'c-root', customerNumber: 1, name: 'Root House' }),
    customer({ id: 'c-down', customerNumber: 2, name: 'Downstream House', upstreamCustomerId: 'c-root' })
  ];
  const report = buildPowerOutageCorrelation({ complaints, tickets: [], customers }, '2026-10');
  assert.equal(bucket(report, 'power').minutes, 300);
  assert.deepEqual(report.topRootHouses, []);
});

test('top 5 root houses: impact = minutes x active downstream, archived traversed through, leaf never ranks', () => {
  const customers = [
    customer({ id: 'cA', customerNumber: 1, name: 'Root House Alpha' }),
    customer({ id: 'cB', customerNumber: 2, name: 'House Beta', upstreamCustomerId: 'cA' }),
    customer({ id: 'cC', customerNumber: 3, name: 'House Gamma', upstreamCustomerId: 'cA' }),
    customer({ id: 'cM', customerNumber: 4, name: 'House Mid', upstreamCustomerId: 'cA', archived: true }),
    customer({ id: 'cN', customerNumber: 5, name: 'House November', upstreamCustomerId: 'cM' }),
    customer({ id: 'cE', customerNumber: 6, name: 'Root House Echo' }),
    customer({ id: 'cF', customerNumber: 7, name: 'House Foxtrot', upstreamCustomerId: 'cE' }),
    customer({ id: 'cG', customerNumber: 8, name: 'House Golf', upstreamCustomerId: 'cE' }),
    customer({ id: 'cL', customerNumber: 9, name: 'Leaf House', upstreamCustomerId: 'cB' })
  ];
  // Downstream (active, transitive): A -> B, C, L (via B), N (via archived M) = 4; E -> F, G = 2; B -> L = 1; L -> 0.
  const complaints = [
    complaint({ id: 'CMP-601', customerId: 'cA', customerName: 'Root House Alpha', issueCategory: 'Fiber Cut', downtimeHours: 2 }),
    complaint({ id: 'CMP-602', customerId: 'cA', customerName: 'Root House Alpha', issueCategory: 'WAPDA / Power Outage', downtimeHours: 1 }),
    complaint({ id: 'CMP-603', customerId: 'cE', customerName: 'Root House Echo', issueCategory: 'Fiber Cut', downtimeHours: 3 }),
    complaint({ id: 'CMP-604', customerId: 'cB', customerName: 'House Beta', issueCategory: 'Fiber Cut', downtimeHours: 5 }),
    complaint({ id: 'CMP-605', customerId: 'cL', customerName: 'Leaf House', issueCategory: 'Fiber Cut', downtimeHours: 10 })
  ];
  const report = buildPowerOutageCorrelation({ complaints, tickets: [], customers }, '2026-10');
  assert.equal(report.topRootHouses.length, 3);
  const [a, e, b] = report.topRootHouses;
  // A: (120 + 60) min x 4 downstream = 720, 2 incidents.
  assert.equal(a.customerId, 'cA');
  assert.equal(a.customerNumber, 1);
  assert.equal(a.downstreamCount, 4);
  assert.equal(a.incidents, 2);
  assert.equal(a.impactCustomerMinutes, 720);
  // E: 180 x 2 = 360, 1 incident.
  assert.equal(e.customerId, 'cE');
  assert.equal(e.impactCustomerMinutes, 360);
  // B: 300 x 1 = 300.
  assert.equal(b.customerId, 'cB');
  assert.equal(b.impactCustomerMinutes, 300);
  // The leaf's own 10h outage never ranks (no downstream).
  assert.ok(!report.topRootHouses.some((row) => row.customerId === 'cL'));
});

test('root-house ties break by incident count, then by customer number', () => {
  const customers = [
    customer({ id: 'cP', customerNumber: 10, name: 'House Papa' }),
    customer({ id: 'cQ', customerNumber: 13, name: 'House Quebec', upstreamCustomerId: 'cP' }),
    customer({ id: 'cR', customerNumber: 11, name: 'House Romeo' }),
    customer({ id: 'cS', customerNumber: 14, name: 'House Sierra', upstreamCustomerId: 'cR' }),
    customer({ id: 'cT', customerNumber: 12, name: 'House Tango' }),
    customer({ id: 'cU', customerNumber: 15, name: 'House Uniform', upstreamCustomerId: 'cT' })
  ];
  const complaints = [
    complaint({ id: 'CMP-701', customerId: 'cP', downtimeHours: 1 }),
    complaint({ id: 'CMP-702', customerId: 'cP', downtimeHours: 1, reportedAt: '2026-10-06T10:00', resolvedAt: '2026-10-06T11:00' }),
    complaint({ id: 'CMP-703', customerId: 'cR', downtimeHours: 2 }),
    complaint({ id: 'CMP-704', customerId: 'cT', downtimeHours: 2 })
  ];
  const report = buildPowerOutageCorrelation({ complaints, tickets: [], customers }, '2026-10');
  // All three houses: impact 120 customer-minutes. P has 2 incidents; R (#11) precedes T (#12).
  assert.deepEqual(report.topRootHouses.map((row) => row.customerId), ['cP', 'cR', 'cT']);
});

test('ranking is capped at 5 houses', () => {
  const customers = [];
  const complaints = [];
  for (let i = 1; i <= 7; i += 1) {
    customers.push(customer({ id: `cR${i}`, customerNumber: i, name: `Root ${i}` }));
    customers.push(customer({ id: `cD${i}`, customerNumber: 100 + i, name: `Down ${i}`, upstreamCustomerId: `cR${i}` }));
    complaints.push(complaint({ id: `CMP-80${i}`, customerId: `cR${i}`, downtimeHours: i }));
  }
  const report = buildPowerOutageCorrelation({ complaints, tickets: [], customers }, '2026-10');
  assert.equal(report.topRootHouses.length, 5);
  assert.equal(report.topRootHouses[0].customerId, 'cR7');
  assert.equal(report.topRootHouses[4].customerId, 'cR3');
});

test('builder is pure: inputs are byte-identical after the call', () => {
  const sources = {
    complaints: [complaint({})],
    tickets: [ticket({})],
    customers: [customer({}), customer({ id: 'c-2', customerNumber: 2, upstreamCustomerId: 'c-1' })]
  };
  const before = JSON.stringify(sources);
  buildPowerOutageCorrelation(sources, '2026-10');
  assert.equal(JSON.stringify(sources), before);
});

test('wiring: the downtime modal renders the correlation into its own sections', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="downtimeAnalyticsCorrelationList"'));
  assert.ok(html.includes('id="downtimeAnalyticsRootHouses"'));
  const moduleSource = readFileSync(new URL('../downtime-analytics.js', import.meta.url), 'utf8');
  assert.ok(moduleSource.includes('buildPowerOutageCorrelation'));
  assert.ok(moduleSource.includes('loadTickets()'));
});
