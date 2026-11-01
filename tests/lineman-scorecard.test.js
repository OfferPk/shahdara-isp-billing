// SISP-39: Lineman Monthly Performance, Collection & Ticket Scorecard.
// Pure-module tests on synthetic data only. Pinned spec criterion:
// recording 2 resolved complaints and Rs. 1,500 petrol expense under
// lineman "Ali" accurately populates Ali's monthly scorecard.
//
// Attribution rules under test (only real data-model fields are used):
// - tickets (SISP-12) carry `technician`; SISP-15 register complaints have
//   no lineman field and count only via a linked ticket (complaintId),
//   never double-counted with that ticket;
// - roznamcha (SISP-11) outflows carry `lineman` + `category`;
// - payments carry no lineman — cash collected is per SHOP collector
//   (SISP-1 method derivation) and voided payments (SISP-34) never count;
// - new connections started as a month total only; SISP-173 splits them
//   per installer (customer installedByLineman) with an explicit
//   unrecorded bucket, and ticket-less register complaints attribute
//   via the register's own resolvedByLineman (inert once linked).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCollectorScorecards,
  buildLinemanScorecards,
  buildMonthlyScorecard,
  countNewConnections,
  linemanNameKey,
  normalizeScorecardMonth,
  splitNewConnectionsByInstaller
} from '../lineman-scorecard.js';

const MONTH = '2026-10';

const ticket = (id, technician, status, resolvedAt, extra = {}) => ({
  id,
  customerId: 'cust-1',
  customerName: 'Synthetic Customer',
  complaintId: '',
  faultPreset: 'Fiber Cut / Splice Loss',
  technician,
  priority: 'Normal',
  status,
  createdAt: '2026-10-02T09:00',
  resolvedAt,
  note: '',
  materialsUsed: [],
  billingType: 'free',
  ...extra
});

const complaint = (id, status, resolvedAt) => ({
  id,
  customerId: 'cust-1',
  customerName: 'Synthetic Customer',
  zone: '',
  issueCategory: 'Fiber Cut',
  reportedAt: '2026-10-02T09:00',
  resolvedAt,
  downtimeHours: 2,
  status,
  resolutionNote: '',
  createdAt: '2026-10-02T09:00'
});

const day = (date, outflows) => ({ date, outflows, closed: false });
const outflow = (id, category, amount, lineman) => ({ id, category, amount, lineman, note: '' });

test('pinned: 2 resolved complaints + Rs. 1,500 petrol under "Ali" populate his scorecard', () => {
  const cards = buildLinemanScorecards({
    tickets: [
      ticket('TKT-101', 'Ali', 'Resolved', '2026-10-03T12:00'),
      ticket('TKT-102', 'Ali', 'Resolved', '2026-10-20T15:30')
    ],
    complaints: [],
    roznamchaDays: [
      day('2026-10-05', [outflow('out-1', 'Petrol / Bike Fuel', 1500, 'Ali')])
    ]
  }, MONTH);
  const ali = cards.find((c) => c.name === 'Ali');
  assert.ok(ali, 'Ali has a scorecard');
  assert.equal(ali.complaintsResolved, 2);
  assert.equal(ali.ticketsResolved, 2);
  assert.equal(ali.pettyCashSpent, 1500);
  assert.deepEqual(ali.pettyCashByCategory, [{ category: 'Petrol / Bike Fuel', amount: 1500 }]);
});

test('register complaint linked to a resolved ticket counts once, never twice', () => {
  const cards = buildLinemanScorecards({
    tickets: [ticket('TKT-110', 'Ali', 'Resolved', '2026-10-04T11:00', { complaintId: 'CMP-101' })],
    complaints: [complaint('CMP-101', 'Resolved', '2026-10-04T11:00')],
    roznamchaDays: []
  }, MONTH);
  const ali = cards.find((c) => c.name === 'Ali');
  assert.equal(ali.ticketsResolved, 1);
  assert.equal(ali.complaintsResolved, 1);
});

test('register complaint with no linked ticket is never attributed to a lineman', () => {
  const cards = buildLinemanScorecards({
    tickets: [ticket('TKT-111', 'Ali', 'Resolved', '2026-10-04T11:00')],
    complaints: [complaint('CMP-199', 'Resolved', '2026-10-06T10:00')],
    roznamchaDays: []
  }, MONTH);
  const ali = cards.find((c) => c.name === 'Ali');
  assert.equal(ali.complaintsResolved, 1);
});

test('month boundaries: September work does not leak into the October scorecard', () => {
  const cards = buildLinemanScorecards({
    tickets: [
      ticket('TKT-120', 'Ali', 'Resolved', '2026-09-30T23:30'),
      ticket('TKT-121', 'Ali', 'Resolved', '2026-10-01T00:30')
    ],
    complaints: [],
    roznamchaDays: [
      day('2026-09-30', [outflow('out-2', 'Petrol / Bike Fuel', 900, 'Ali')]),
      day('2026-10-01', [outflow('out-3', 'Petrol / Bike Fuel', 100, 'Ali')])
    ]
  }, MONTH);
  const ali = cards.find((c) => c.name === 'Ali');
  assert.equal(ali.complaintsResolved, 1);
  assert.equal(ali.pettyCashSpent, 100);
});

test('zero activity: a known lineman with nothing this month gets a zero card', () => {
  const cards = buildLinemanScorecards({
    tickets: [ticket('TKT-130', 'Bilal', 'Resolved', '2026-09-10T10:00')],
    complaints: [],
    roznamchaDays: [day('2026-09-10', [outflow('out-4', 'Other', 250, 'Bilal')])]
  }, MONTH);
  const bilal = cards.find((c) => c.name === 'Bilal');
  assert.ok(bilal, 'Bilal still appears');
  assert.equal(bilal.complaintsResolved, 0);
  assert.equal(bilal.ticketsResolved, 0);
  assert.equal(bilal.pettyCashSpent, 0);
  assert.deepEqual(bilal.pettyCashByCategory, []);
});

test('unattributed and other-lineman expenses never land on Ali', () => {
  const cards = buildLinemanScorecards({
    tickets: [],
    complaints: [],
    roznamchaDays: [
      day('2026-10-07', [
        outflow('out-5', 'Petrol / Bike Fuel', 700, ''),
        outflow('out-6', 'Petrol / Bike Fuel', 800, 'Bilal'),
        outflow('out-7', 'Lineman Allowance', 300, 'Ali')
      ])
    ]
  }, MONTH);
  const ali = cards.find((c) => c.name === 'Ali');
  const bilal = cards.find((c) => c.name === 'Bilal');
  assert.equal(ali.pettyCashSpent, 300);
  assert.equal(bilal.pettyCashSpent, 800);
  assert.equal(cards.length, 2, 'blank-lineman outflow creates no person');
});

test('name grouping is case/space-insensitive; open tickets are counted separately', () => {
  const cards = buildLinemanScorecards({
    tickets: [
      ticket('TKT-140', 'ali', 'Resolved', '2026-10-08T09:00'),
      ticket('TKT-141', ' ALI ', 'Open', ''),
      ticket('TKT-142', 'Ali', 'In Progress', '')
    ],
    complaints: [],
    roznamchaDays: [day('2026-10-08', [outflow('out-8', 'Other', 50, 'aLi')])]
  }, MONTH);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].complaintsResolved, 1);
  assert.equal(cards[0].ticketsOpen, 2);
  assert.equal(cards[0].pettyCashSpent, 50);
  assert.equal(linemanNameKey('  Ali   Raza '), 'ali raza');
});

test('collectors: shop cash collected per collector; voided and non-shop payments excluded', () => {
  const pay = (id, date, amount, method, extra = {}) => ({ id, date, amount, method, paidBy: '', ...extra });
  const state = {
    customers: [{
      id: 'cust-1',
      name: 'Synthetic Customer',
      bills: [{
        month: MONTH,
        payments: [
          pay('p1', '2026-10-03', 2000, 'Cash at Waseem Abbasi shop'),
          pay('p2', '2026-10-04', 5000, 'Cash at Waseem Abbasi shop', { voided: true }),
          pay('p3', '2026-10-05', 1500, 'Cash at Hassan shop'),
          pay('p4', '2026-10-06', 9999, 'Cash'),
          pay('p5', '2026-09-30', 777, 'Cash at Hassan shop')
        ]
      }]
    }]
  };
  const collectors = buildCollectorScorecards(state, MONTH);
  assert.equal(collectors.length, 2);
  const waseem = collectors.find((c) => c.name === 'Waseem Abbasi Shop');
  // OWNER-CASH-SHOP: the Hassan-method receipts score under the ONE
  // canonical collector name (the scorecard reads resolveShopCollector).
  const hassan = collectors.find((c) => c.name === 'Hassan Balla Shop');
  assert.equal(waseem.cashCollected, 2000, 'voided Rs. 5,000 never counts');
  assert.equal(waseem.paymentCount, 1);
  assert.equal(hassan.cashCollected, 1500, 'September payment stays out of October');
  assert.equal(hassan.paymentCount, 1);
});

test('new connections: month total via connectionDate first, then addedOn', () => {
  const customers = [
    { id: 'c1', connectionDate: '2026-10-11', addedOn: '2026-10-11' },
    { id: 'c2', connectionDate: null, addedOn: '2026-10-20' },
    { id: 'c3', connectionDate: '2026-09-01', addedOn: '2026-10-02' },
    { id: 'c4', connectionDate: null, addedOn: '2026-09-15' },
    { id: 'c5', connectionDate: null, addedOn: null }
  ];
  assert.equal(countNewConnections(customers, MONTH), 2);
});

test('buildMonthlyScorecard bundles linemen, collectors and the connections total', () => {
  const bundle = buildMonthlyScorecard({
    state: { customers: [{ id: 'c1', connectionDate: '2026-10-11', addedOn: null, bills: [] }] },
    tickets: [ticket('TKT-150', 'Ali', 'Resolved', '2026-10-09T10:00')],
    complaints: [],
    roznamchaDays: [day('2026-10-09', [outflow('out-9', 'Petrol / Bike Fuel', 1500, 'Ali')])]
  }, MONTH);
  assert.equal(bundle.month, MONTH);
  assert.equal(bundle.linemen[0].complaintsResolved, 1);
  assert.equal(bundle.linemen[0].pettyCashSpent, 1500);
  assert.equal(bundle.newConnections, 1);
  assert.deepEqual(bundle.collectors, []);
});

test('SISP-173: new connections split per installer, unrecorded bucket conserves the team total', () => {
  const customers = [
    { id: 'c1', connectionDate: '2026-10-03', addedOn: '2026-10-03', installedByLineman: 'Lineman A' },
    { id: 'c2', connectionDate: '2026-10-11', addedOn: '2026-10-11', installedByLineman: 'lineman a' },
    { id: 'c3', connectionDate: null, addedOn: '2026-10-20', installedByLineman: '  Lineman   A ' },
    { id: 'c4', connectionDate: '2026-10-05', addedOn: '2026-10-05', installedByLineman: 'Lineman B' },
    { id: 'c5', connectionDate: '2026-10-07', addedOn: '2026-10-07' },
    { id: 'c6', connectionDate: null, addedOn: '2026-10-09', installedByLineman: '   ' },
    { id: 'c7', connectionDate: '2026-09-30', addedOn: '2026-10-02', installedByLineman: 'Lineman A' }
  ];
  const split = splitNewConnectionsByInstaller(customers, MONTH);
  assert.equal(split.total, countNewConnections(customers, MONTH), 'split total is the team total');
  assert.equal(split.total, 6, 'connectionDate wins over addedOn, so c7 is a September join');
  assert.deepEqual(split.byInstaller.map((e) => [e.name, e.count]), [['Lineman A', 3], ['Lineman B', 1]]);
  assert.equal(split.unrecorded, 2, 'missing and blank installer both land in the bucket');
  assert.equal(
    split.byInstaller.reduce((sum, e) => sum + e.count, 0) + split.unrecorded,
    split.total,
    'conservation: per-installer counts + unrecorded === previous team total'
  );

  const cards = buildLinemanScorecards({ tickets: [], complaints: [], roznamchaDays: [], customers }, MONTH);
  assert.equal(cards.length, 2, 'installers are discovered from customers alone');
  assert.equal(cards.find((c) => c.key === 'lineman a').newConnections, 3);
  assert.equal(cards.find((c) => c.key === 'lineman b').newConnections, 1);
  assert.equal(
    cards.reduce((sum, c) => sum + c.newConnections, 0) + split.unrecorded,
    split.total,
    'card counts conserve the same total'
  );
});

test('SISP-173: installer names group with ticket technicians into one card', () => {
  const cards = buildLinemanScorecards({
    tickets: [ticket('TKT-160', 'Lineman A', 'Resolved', '2026-10-06T10:00')],
    complaints: [],
    roznamchaDays: [],
    customers: [{ id: 'c1', connectionDate: '2026-10-06', addedOn: '2026-10-06', installedByLineman: '  LINEMAN   A ' }]
  }, MONTH);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].ticketsResolved, 1);
  assert.equal(cards[0].newConnections, 1);
});

test('SISP-173: ticket-less register complaint attributes via resolvedByLineman', () => {
  const direct = { ...complaint('CMP-301', 'Resolved', '2026-10-06T10:00'), resolvedByLineman: 'Lineman A' };
  const cards = buildLinemanScorecards({ tickets: [], complaints: [direct], roznamchaDays: [] }, MONTH);
  assert.equal(cards.length, 1, 'the resolver is discovered from the register entry alone');
  assert.equal(cards[0].name, 'Lineman A');
  assert.equal(cards[0].complaintsResolved, 1);
  assert.equal(cards[0].directComplaintsResolved, 1);
  assert.equal(cards[0].ticketsResolved, 0);
});

test('SISP-173: linked pair counts once via the ticket — the register name is inert', () => {
  const linked = { ...complaint('CMP-302', 'Resolved', '2026-10-04T11:00'), resolvedByLineman: 'Lineman A' };
  const cards = buildLinemanScorecards({
    tickets: [ticket('TKT-170', 'Lineman B', 'Resolved', '2026-10-04T11:00', { complaintId: 'CMP-302' })],
    complaints: [linked],
    roznamchaDays: []
  }, MONTH);
  assert.equal(cards.length, 1, 'the inert register name discovers no second person');
  assert.equal(cards[0].name, 'Lineman B');
  assert.equal(cards[0].complaintsResolved, 1, 'the pair is one job');
  assert.equal(cards[0].ticketsResolved, 1);
  assert.equal(cards[0].directComplaintsResolved, 0);
});

test('SISP-173: direct attribution honours month and resolved status', () => {
  const september = { ...complaint('CMP-303', 'Resolved', '2026-09-30T23:00'), resolvedByLineman: 'Lineman A' };
  const stillOpen = { ...complaint('CMP-304', 'Open', ''), resolvedByLineman: 'Lineman A' };
  const cards = buildLinemanScorecards({
    tickets: [ticket('TKT-171', 'Lineman A', 'Resolved', '2026-10-02T09:00')],
    complaints: [september, stillOpen],
    roznamchaDays: []
  }, MONTH);
  const a = cards.find((c) => c.name === 'Lineman A');
  assert.equal(a.complaintsResolved, 1, 'only his October ticket counts');
  assert.equal(a.directComplaintsResolved, 0);
});

test('SISP-173: bundle carries the installer split that sums to the total', () => {
  const bundle = buildMonthlyScorecard({
    state: {
      customers: [
        { id: 'c1', connectionDate: '2026-10-11', addedOn: null, installedByLineman: 'Lineman A', bills: [] },
        { id: 'c2', connectionDate: '2026-10-12', addedOn: null, bills: [] }
      ]
    },
    tickets: [],
    complaints: [],
    roznamchaDays: []
  }, MONTH);
  assert.equal(bundle.newConnections, 2);
  assert.equal(bundle.newConnectionsSplit.total, 2);
  assert.equal(bundle.newConnectionsSplit.unrecorded, 1);
  assert.deepEqual(bundle.newConnectionsSplit.byInstaller.map((e) => [e.name, e.count]), [['Lineman A', 1]]);
  assert.equal(bundle.linemen.length, 1);
  assert.equal(bundle.linemen[0].newConnections, 1);
});

test('normalizeScorecardMonth falls back to the current PKT month on bad input', () => {
  assert.equal(normalizeScorecardMonth('2026-10'), '2026-10');
  assert.equal(normalizeScorecardMonth('garbage', new Date('2026-10-15T00:00:00Z')), '2026-10');
  assert.equal(normalizeScorecardMonth('', new Date('2026-01-15T00:00:00Z')), '2026-01');
});
