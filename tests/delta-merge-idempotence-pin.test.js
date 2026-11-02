/**
 * M14 — Delta-Merge Idempotence & Double-Apply Pin (test-only).
 *
 * M5 extended DELTA_MERGE_FAMILIES to all 38 record families a backup
 * can carry. This pin proves, FOR EVERY registered family, that the
 * delta merge is safe to run twice and safe across devices:
 *
 *   1. Idempotence: plan + apply device A's delta onto device B's
 *      sections, snapshot the merged family contents, then plan +
 *      apply the SAME delta again — the second plan must add nothing
 *      and the family contents must be identical to the snapshot. A
 *      double-apply is a complete no-op, deduped by each family's
 *      natural key. 36 families are pinned byte-identical; the two
 *      families whose shipped sanitizers SORT their output
 *      (roznamchaDays, deadPorts) are pinned in canonical (sanitized)
 *      form plus exact raw record-set equality instead — see
 *      "Resolution (a)" below for why raw byte order is not their
 *      invariant.
 *
 *   2. Cross-device convergence: device A's backup applied onto device
 *      B's sections yields exactly A∪B by natural key — every A-only
 *      record joins with A's content, every B-only record survives
 *      untouched, every shared-identical record stays as-is, and the
 *      one shared key whose contents differ keeps B's (local) copy,
 *      per the module's documented keep-local default. No duplicates,
 *      no losses.
 *
 * Families are enumerated FROM the module's own registry
 * (DELTA_MERGE_FAMILIES), never from a hardcoded list: a completeness
 * pin below fails loudly if a future family is registered without a
 * fixture here. Fixture shapes are copied from the shipped SISP-102 /
 * M5 delta-merge tests (each family's real record shape); all data is
 * synthetic. Expected plan counts (added / conflicts / unchanged) are
 * DERIVED from the sanitized fixture records through the registry's
 * own sanitize + keyOf, so the pins assert behaviour, not fixtures.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState, addCustomer, saveBillMonth, createJsonBackup
} from '../core.js';
import {
  DELTA_MERGE_FAMILIES, planDeltaMergeSections, applyDeltaMergeSections
} from '../delta-merge-sync.js';
import { canonicalize } from '../backup-health.js';

const REF = new Date('2026-10-15T12:00:00+05:00');
const clone = (value) => JSON.parse(JSON.stringify(value));

function baseState() {
  let state = createInitialState([]);
  state = addCustomer(state, 'Test Customer 01', REF);
  const customerId = state.customers[0].id;
  state = saveBillMonth(state, customerId, { month: '2026-10', dueAmount: 3000, status: 'pending' }, REF);
  return state;
}

// ---------------------------------------------------------------------------
// Fixtures: for every family, device A's section and device B's section.
// Each side carries three keyed records: one byte-identical SHARED record,
// one record ONLY that side holds, and one record under a SHARED KEY whose
// contents DIFFER (the conflict record — local must win). Object-shaped
// families (closing notes, overheads, storm runs, the three keyed maps)
// carry the same three-way split in their native shape; overheads adds a
// second identical shared record (its template).
// ---------------------------------------------------------------------------

const complaintRow = (overrides = {}) => ({
  id: 'CMP-201', customerId: null, customerName: 'Test Customer 01', zone: '',
  issueCategory: 'Other', reportedAt: '2026-10-12T09:30', resolvedAt: '',
  downtimeHours: null, downtimeManual: false, status: 'Open', resolutionNote: '',
  resolvedViaTicketId: '', syncReopenGuard: '', createdAt: '2026-10-12T09:30',
  ...overrides
});

const voidRow = (paymentId, id, voidReason = 'Duplicate entry on PC') => ({
  id, customerId: 'cust-fixture', customerNumber: 1, customerName: 'Test Customer 01',
  billMonth: '2026-10', paymentId, paymentDate: '2026-10-10', amount: 1000,
  method: 'Cash', shop: '', voidReason, voidedAt: '2026-10-14T09:00',
  promiseRestored: false, restoredPromiseDate: '', createdAt: '2026-10-14T09:00'
});

const partnerSettlementRow = (month, revenue, expenses, profit, share) => ({
  id: `partner-settle-${month}`, month, revenue, expenses, profit,
  perPartner: [{ partner: 'Nasir', share, drawings: 0, capital: 0, netPayout: share }],
  note: '', status: 'confirmed', confirmedAt: '', reopenedAt: '', createdAt: ''
});

const overheadPosting = (id, amount) => ({
  id, templateId: 'upstream-bandwidth', month: '2026-10', expenseId: '',
  amount, date: '2026-10-01', note: ''
});

const FIXTURES = {
  shopSettlements: {
    a: [
      { id: 'shop-settle-1', shop: 'Test Shop', amount: 500, date: '2026-10-05', note: '', allocations: [], createdAt: '' },
      { id: 'shop-settle-2', shop: 'Test Shop', amount: 600, date: '2026-10-05', note: '', allocations: [], createdAt: '' },
      { id: 'shop-settle-x', shop: 'Test Shop', amount: 500, date: '2026-10-05', note: '', allocations: [], createdAt: '' }
    ],
    b: [
      { id: 'shop-settle-1', shop: 'Test Shop', amount: 500, date: '2026-10-05', note: '', allocations: [], createdAt: '' },
      { id: 'shop-settle-3', shop: 'Test Shop', amount: 700, date: '2026-10-05', note: '', allocations: [], createdAt: '' },
      { id: 'shop-settle-x', shop: 'Test Shop', amount: 900, date: '2026-10-05', note: '', allocations: [], createdAt: '' }
    ]
  },
  complaints: {
    a: [complaintRow(), complaintRow({ id: 'CMP-202' }), complaintRow({ id: 'CMP-204' })],
    b: [
      complaintRow(), complaintRow({ id: 'CMP-203' }),
      complaintRow({ id: 'CMP-204', status: 'Resolved', resolvedAt: '2026-10-13T10:00', resolutionNote: 'Fixed on device B' })
    ]
  },
  tickets: {
    a: [
      { id: 'TKT-101', customerId: 'cust-x', customerName: 'Test Customer 01', customFault: 'Fiber cut', status: 'Open', createdAt: '2026-10-12T09:00' },
      { id: 'TKT-102', customerId: 'cust-x', customerName: 'Test Customer 01', customFault: 'Fiber cut', status: 'Open', createdAt: '2026-10-12T09:00' },
      { id: 'TKT-104', customerId: 'cust-x', customerName: 'Test Customer 01', customFault: 'Fiber cut', status: 'Open', createdAt: '2026-10-12T09:00' }
    ],
    b: [
      { id: 'TKT-101', customerId: 'cust-x', customerName: 'Test Customer 01', customFault: 'Fiber cut', status: 'Open', createdAt: '2026-10-12T09:00' },
      { id: 'TKT-103', customerId: 'cust-x', customerName: 'Test Customer 01', customFault: 'Fiber cut', status: 'Open', createdAt: '2026-10-12T09:00' },
      { id: 'TKT-104', customerId: 'cust-x', customerName: 'Test Customer 01', customFault: 'ONT drop wire', status: 'Open', createdAt: '2026-10-12T09:00' }
    ]
  },
  roznamchaDays: {
    a: [
      { date: '2026-10-05', outflows: [], closed: false },
      { date: '2026-10-06', outflows: [], closed: false },
      { date: '2026-10-08', outflows: [], closed: false }
    ],
    b: [
      { date: '2026-10-05', outflows: [], closed: false },
      { date: '2026-10-07', outflows: [], closed: false },
      { date: '2026-10-08', outflows: [{ id: 'out-1', category: 'Petrol / Bike Fuel', amount: 200, lineman: '', note: '' }], closed: false }
    ]
  },
  inventory: {
    a: [
      { id: 'STK-101', itemId: 'router', kind: 'in', qty: 2, date: '2026-10-05', customerName: '', note: '', createdAt: '' },
      { id: 'STK-102', itemId: 'router', kind: 'in', qty: 2, date: '2026-10-05', customerName: '', note: '', createdAt: '' },
      { id: 'STK-104', itemId: 'router', kind: 'in', qty: 2, date: '2026-10-05', customerName: '', note: '', createdAt: '' }
    ],
    b: [
      { id: 'STK-101', itemId: 'router', kind: 'in', qty: 2, date: '2026-10-05', customerName: '', note: '', createdAt: '' },
      { id: 'STK-103', itemId: 'router', kind: 'in', qty: 2, date: '2026-10-05', customerName: '', note: '', createdAt: '' },
      { id: 'STK-104', itemId: 'router', kind: 'in', qty: 5, date: '2026-10-05', customerName: '', note: '', createdAt: '' }
    ]
  },
  homeBudget: {
    a: [
      { id: 'HB-1', date: '2026-10-05', category: 'Groceries', amount: 1500, notes: '' },
      { id: 'HB-2', date: '2026-10-05', category: 'Groceries', amount: 1500, notes: '' },
      { id: 'HB-4', date: '2026-10-05', category: 'Groceries', amount: 1500, notes: '' }
    ],
    b: [
      { id: 'HB-1', date: '2026-10-05', category: 'Groceries', amount: 1500, notes: '' },
      { id: 'HB-3', date: '2026-10-05', category: 'Groceries', amount: 1500, notes: '' },
      { id: 'HB-4', date: '2026-10-05', category: 'Groceries', amount: 1800, notes: '' }
    ]
  },
  loans: {
    a: [
      { id: 'loan-1', person: 'Test Person', phone: '', direction: 'dena', kind: 'loan', amount: 1000, date: '2026-10-01', note: '', createdAt: '' },
      { id: 'loan-2', person: 'Test Person', phone: '', direction: 'dena', kind: 'loan', amount: 1000, date: '2026-10-01', note: '', createdAt: '' },
      { id: 'loan-4', person: 'Test Person', phone: '', direction: 'dena', kind: 'loan', amount: 1000, date: '2026-10-01', note: '', createdAt: '' }
    ],
    b: [
      { id: 'loan-1', person: 'Test Person', phone: '', direction: 'dena', kind: 'loan', amount: 1000, date: '2026-10-01', note: '', createdAt: '' },
      { id: 'loan-3', person: 'Test Person', phone: '', direction: 'dena', kind: 'loan', amount: 1000, date: '2026-10-01', note: '', createdAt: '' },
      { id: 'loan-4', person: 'Test Person', phone: '', direction: 'dena', kind: 'loan', amount: 1200, date: '2026-10-01', note: '', createdAt: '' }
    ]
  },
  waTemplates: {
    a: [
      { id: 'billGenerated', roman: 'Shared roman', urdu: 'Test urdu template' },
      { id: 'politeReminder', roman: 'A reminder roman', urdu: 'Test urdu template' },
      { id: 'outageNotice', roman: 'A outage roman', urdu: 'Test urdu template' }
    ],
    b: [
      { id: 'billGenerated', roman: 'Shared roman', urdu: 'Test urdu template' },
      { id: 'paymentReceived', roman: 'B received roman', urdu: 'Test urdu template' },
      { id: 'outageNotice', roman: 'B outage roman', urdu: 'Test urdu template' }
    ]
  },
  saadVisits: {
    a: [
      { id: 'visit-1', date: '2026-10-03', type: 'splicing', hoursWorked: 2 },
      { id: 'visit-2', date: '2026-10-03', type: 'splicing', hoursWorked: 2 },
      { id: 'visit-4', date: '2026-10-03', type: 'splicing', hoursWorked: 2 }
    ],
    b: [
      { id: 'visit-1', date: '2026-10-03', type: 'splicing', hoursWorked: 2 },
      { id: 'visit-3', date: '2026-10-03', type: 'splicing', hoursWorked: 2 },
      { id: 'visit-4', date: '2026-10-03', type: 'splicing', hoursWorked: 3 }
    ]
  },
  saadPayments: {
    a: [
      { id: 'saad-pay-1', date: '2026-10-03', type: 'salary', amount: 5000, note: '', paidFromDrawer: false, createdAt: '' },
      { id: 'saad-pay-2', date: '2026-10-03', type: 'salary', amount: 5000, note: '', paidFromDrawer: false, createdAt: '' },
      { id: 'saad-pay-4', date: '2026-10-03', type: 'salary', amount: 5000, note: '', paidFromDrawer: false, createdAt: '' }
    ],
    b: [
      { id: 'saad-pay-1', date: '2026-10-03', type: 'salary', amount: 5000, note: '', paidFromDrawer: false, createdAt: '' },
      { id: 'saad-pay-3', date: '2026-10-03', type: 'salary', amount: 5000, note: '', paidFromDrawer: false, createdAt: '' },
      { id: 'saad-pay-4', date: '2026-10-03', type: 'salary', amount: 5500, note: '', paidFromDrawer: false, createdAt: '' }
    ]
  },
  installRequests: {
    a: [
      { id: 'inst-1', requesterName: 'Test Person', requestDate: '2026-10-02', amountPaid: 0, payMethod: 'cash' },
      { id: 'inst-2', requesterName: 'Test Person', requestDate: '2026-10-02', amountPaid: 0, payMethod: 'cash' },
      { id: 'inst-4', requesterName: 'Test Person', requestDate: '2026-10-02', amountPaid: 0, payMethod: 'cash' }
    ],
    b: [
      { id: 'inst-1', requesterName: 'Test Person', requestDate: '2026-10-02', amountPaid: 0, payMethod: 'cash' },
      { id: 'inst-3', requesterName: 'Test Person', requestDate: '2026-10-02', amountPaid: 0, payMethod: 'cash' },
      { id: 'inst-4', requesterName: 'Test Person', requestDate: '2026-10-02', amountPaid: 500, payMethod: 'cash' }
    ]
  },
  pendingWorks: {
    a: [
      { id: 'work-1', note: 'Fix pole drop wire', source: '', threshold: null, status: 'pending', createdAt: '' },
      { id: 'work-2', note: 'Fix pole drop wire', source: '', threshold: null, status: 'pending', createdAt: '' },
      { id: 'work-4', note: 'Fix pole drop wire', source: '', threshold: null, status: 'pending', createdAt: '' }
    ],
    b: [
      { id: 'work-1', note: 'Fix pole drop wire', source: '', threshold: null, status: 'pending', createdAt: '' },
      { id: 'work-3', note: 'Fix pole drop wire', source: '', threshold: null, status: 'pending', createdAt: '' },
      { id: 'work-4', note: 'Replace splitter at pole 9', source: '', threshold: null, status: 'pending', createdAt: '' }
    ]
  },
  billingGroups: {
    a: [
      { billingGroupId: 'GRP-101', groupTitle: 'Test Group', memberIds: ['cust-x'], createdAt: '' },
      { billingGroupId: 'GRP-102', groupTitle: 'Test Group', memberIds: ['cust-x'], createdAt: '' },
      { billingGroupId: 'GRP-104', groupTitle: 'Test Group', memberIds: ['cust-x'], createdAt: '' }
    ],
    b: [
      { billingGroupId: 'GRP-101', groupTitle: 'Test Group', memberIds: ['cust-x'], createdAt: '' },
      { billingGroupId: 'GRP-103', groupTitle: 'Test Group', memberIds: ['cust-x'], createdAt: '' },
      { billingGroupId: 'GRP-104', groupTitle: 'Test Group', memberIds: ['cust-x', 'cust-y'], createdAt: '' }
    ]
  },
  suspensePayments: {
    a: [
      { suspenseId: 'SUS-101', amount: 2000, wallet: 'Easypaisa', senderName: 'Test Sender', senderMobile: '', tid: 'TID-TEST-1', date: '2026-10-06', claimed: false, claimedCustomerId: '', claimedCustomerName: '', claimedAt: '', claimedMonth: '', createdAt: '' },
      { suspenseId: 'SUS-102', amount: 2000, wallet: 'Easypaisa', senderName: 'Test Sender', senderMobile: '', tid: 'TID-TEST-2', date: '2026-10-06', claimed: false, claimedCustomerId: '', claimedCustomerName: '', claimedAt: '', claimedMonth: '', createdAt: '' },
      { suspenseId: 'SUS-104', amount: 2000, wallet: 'Easypaisa', senderName: 'Test Sender', senderMobile: '', tid: 'TID-TEST-4', date: '2026-10-06', claimed: false, claimedCustomerId: '', claimedCustomerName: '', claimedAt: '', claimedMonth: '', createdAt: '' }
    ],
    b: [
      { suspenseId: 'SUS-101', amount: 2000, wallet: 'Easypaisa', senderName: 'Test Sender', senderMobile: '', tid: 'TID-TEST-1', date: '2026-10-06', claimed: false, claimedCustomerId: '', claimedCustomerName: '', claimedAt: '', claimedMonth: '', createdAt: '' },
      { suspenseId: 'SUS-103', amount: 2000, wallet: 'Easypaisa', senderName: 'Test Sender', senderMobile: '', tid: 'TID-TEST-3', date: '2026-10-06', claimed: false, claimedCustomerId: '', claimedCustomerName: '', claimedAt: '', claimedMonth: '', createdAt: '' },
      { suspenseId: 'SUS-104', amount: 2500, wallet: 'Easypaisa', senderName: 'Test Sender', senderMobile: '', tid: 'TID-TEST-4', date: '2026-10-06', claimed: false, claimedCustomerId: '', claimedCustomerName: '', claimedAt: '', claimedMonth: '', createdAt: '' }
    ]
  },
  // sanitizeReferralCredits keeps ONE credit per referredCustomerId, so
  // each fixture record names a distinct referred customer.
  referralCredits: {
    a: [
      { referralId: 'REF-101', referrerCustomerId: 'cust-a', referredCustomerId: 'cust-b', amount: 500, applications: [] },
      { referralId: 'REF-102', referrerCustomerId: 'cust-a', referredCustomerId: 'cust-c', amount: 500, applications: [] },
      { referralId: 'REF-104', referrerCustomerId: 'cust-a', referredCustomerId: 'cust-e', amount: 500, applications: [] }
    ],
    b: [
      { referralId: 'REF-101', referrerCustomerId: 'cust-a', referredCustomerId: 'cust-b', amount: 500, applications: [] },
      { referralId: 'REF-103', referrerCustomerId: 'cust-a', referredCustomerId: 'cust-d', amount: 500, applications: [] },
      { referralId: 'REF-104', referrerCustomerId: 'cust-a', referredCustomerId: 'cust-e', amount: 600, applications: [] }
    ]
  },
  partnerLedger: {
    a: [
      { id: 'pl-1', partner: 'Nasir', type: 'drawing', amount: 3000, date: '2026-10-07', note: '', createdAt: '' },
      { id: 'pl-2', partner: 'Nasir', type: 'drawing', amount: 3000, date: '2026-10-07', note: '', createdAt: '' },
      { id: 'pl-4', partner: 'Nasir', type: 'drawing', amount: 3000, date: '2026-10-07', note: '', createdAt: '' }
    ],
    b: [
      { id: 'pl-1', partner: 'Nasir', type: 'drawing', amount: 3000, date: '2026-10-07', note: '', createdAt: '' },
      { id: 'pl-3', partner: 'Nasir', type: 'drawing', amount: 3000, date: '2026-10-07', note: '', createdAt: '' },
      { id: 'pl-4', partner: 'Nasir', type: 'drawing', amount: 3200, date: '2026-10-07', note: '', createdAt: '' }
    ]
  },
  partnerSettlements: {
    a: [
      partnerSettlementRow('2026-09', 10000, 4000, 6000, 3000),
      partnerSettlementRow('2026-08', 9000, 3000, 6000, 3000),
      partnerSettlementRow('2026-06', 10000, 4000, 6000, 3000)
    ],
    b: [
      partnerSettlementRow('2026-09', 10000, 4000, 6000, 3000),
      partnerSettlementRow('2026-07', 8000, 3000, 5000, 2500),
      partnerSettlementRow('2026-06', 11000, 4000, 7000, 3500)
    ]
  },
  voidPayments: {
    a: [voidRow('RCP-501', 'void-fixture-1'), voidRow('RCP-502', 'void-fixture-2'), voidRow('RCP-504', 'void-fixture-4')],
    b: [voidRow('RCP-501', 'void-fixture-1'), voidRow('RCP-503', 'void-fixture-3'), voidRow('RCP-504', 'void-fixture-4', 'Wrong amount recorded')]
  },
  monthlyClosingNotes: {
    a: {
      '2026-09': { note: 'Shared note', savedAt: '2026-10-01T09:00' },
      '2026-08': { note: 'A only month', savedAt: '2026-09-01T09:00' },
      '2026-07': { note: 'A version', savedAt: '2026-08-02T09:00' }
    },
    b: {
      '2026-09': { note: 'Shared note', savedAt: '2026-10-01T09:00' },
      '2026-06': { note: 'B only month', savedAt: '2026-07-01T09:00' },
      '2026-07': { note: 'B version', savedAt: '2026-08-02T09:00' }
    }
  },
  overheads: {
    a: {
      templates: [{ id: 'upstream-bandwidth', defaultAmount: 30000 }],
      postings: [overheadPosting('oh-shared', 30000), overheadPosting('oh-a', 1000), overheadPosting('oh-x', 1111)]
    },
    b: {
      templates: [{ id: 'upstream-bandwidth', defaultAmount: 30000 }],
      postings: [overheadPosting('oh-shared', 30000), overheadPosting('oh-b', 2000), overheadPosting('oh-x', 2222)]
    }
  },
  converterSides: {
    a: [
      { id: 'WDM-101', side: 'A', kind: 'in', qty: 2, date: '2026-10-05', note: '', createdAt: '2026-10-05T09:00' },
      { id: 'WDM-102', side: 'A', kind: 'in', qty: 2, date: '2026-10-05', note: '', createdAt: '2026-10-05T09:00' },
      { id: 'WDM-104', side: 'A', kind: 'in', qty: 2, date: '2026-10-05', note: '', createdAt: '2026-10-05T09:00' }
    ],
    b: [
      { id: 'WDM-101', side: 'A', kind: 'in', qty: 2, date: '2026-10-05', note: '', createdAt: '2026-10-05T09:00' },
      { id: 'WDM-103', side: 'A', kind: 'in', qty: 2, date: '2026-10-05', note: '', createdAt: '2026-10-05T09:00' },
      { id: 'WDM-104', side: 'A', kind: 'in', qty: 3, date: '2026-10-05', note: '', createdAt: '2026-10-05T09:00' }
    ]
  },
  linemanPayouts: {
    a: [
      { linemanName: 'Test Lineman', month: '2026-09', baseSalary: 15000, paidDate: '2026-09-30', note: '', createdAt: '2026-09-30T10:00' },
      { linemanName: 'Test Lineman', month: '2026-08', baseSalary: 15000, paidDate: '2026-08-31', note: '', createdAt: '2026-08-31T10:00' },
      { linemanName: 'Test Lineman', month: '2026-06', baseSalary: 15000, paidDate: '2026-06-30', note: 'A note', createdAt: '2026-06-30T10:00' }
    ],
    b: [
      { linemanName: 'Test Lineman', month: '2026-09', baseSalary: 15000, paidDate: '2026-09-30', note: '', createdAt: '2026-09-30T10:00' },
      { linemanName: 'Test Lineman', month: '2026-07', baseSalary: 15000, paidDate: '2026-07-31', note: '', createdAt: '2026-07-31T10:00' },
      { linemanName: 'Test Lineman', month: '2026-06', baseSalary: 15000, paidDate: '2026-06-30', note: 'B note', createdAt: '2026-06-30T10:00' }
    ]
  },
  deadPorts: {
    a: [
      { boxId: 'BOX-101', port: 3, lockedAt: '2026-10-01T09:00', note: 'Burnt port' },
      { boxId: 'BOX-102', port: 1, lockedAt: '2026-10-01T09:00', note: 'A lock' },
      { boxId: 'BOX-104', port: 5, lockedAt: '2026-10-01T09:00', note: 'A note' }
    ],
    b: [
      { boxId: 'BOX-101', port: 3, lockedAt: '2026-10-01T09:00', note: 'Burnt port' },
      { boxId: 'BOX-103', port: 2, lockedAt: '2026-10-01T09:00', note: 'B lock' },
      { boxId: 'BOX-104', port: 5, lockedAt: '2026-10-01T09:00', note: 'B note' }
    ]
  },
  fieldBagMovements: {
    a: [
      { id: 'BAG-101', itemId: 'router', kind: 'in', qty: 1, date: '2026-10-05', ticketId: '', note: '', createdAt: '2026-10-05T09:00' },
      { id: 'BAG-102', itemId: 'router', kind: 'in', qty: 1, date: '2026-10-05', ticketId: '', note: '', createdAt: '2026-10-05T09:00' },
      { id: 'BAG-104', itemId: 'router', kind: 'in', qty: 1, date: '2026-10-05', ticketId: '', note: '', createdAt: '2026-10-05T09:00' }
    ],
    b: [
      { id: 'BAG-101', itemId: 'router', kind: 'in', qty: 1, date: '2026-10-05', ticketId: '', note: '', createdAt: '2026-10-05T09:00' },
      { id: 'BAG-103', itemId: 'router', kind: 'in', qty: 1, date: '2026-10-05', ticketId: '', note: '', createdAt: '2026-10-05T09:00' },
      { id: 'BAG-104', itemId: 'router', kind: 'in', qty: 2, date: '2026-10-05', ticketId: '', note: '', createdAt: '2026-10-05T09:00' }
    ]
  },
  polesRegistry: {
    a: [
      { poleId: 'POLE-101', label: 'Test pole', zone: '', type: 'wapda', landmark: '', notes: '', inventoryItemId: '', dropCustomerIds: [], splitterBoxIds: [], createdAt: '2026-10-01T09:00' },
      { poleId: 'POLE-102', label: 'Test pole', zone: '', type: 'wapda', landmark: '', notes: '', inventoryItemId: '', dropCustomerIds: [], splitterBoxIds: [], createdAt: '2026-10-01T09:00' },
      { poleId: 'POLE-104', label: 'Test pole', zone: '', type: 'wapda', landmark: '', notes: '', inventoryItemId: '', dropCustomerIds: [], splitterBoxIds: [], createdAt: '2026-10-01T09:00' }
    ],
    b: [
      { poleId: 'POLE-101', label: 'Test pole', zone: '', type: 'wapda', landmark: '', notes: '', inventoryItemId: '', dropCustomerIds: [], splitterBoxIds: [], createdAt: '2026-10-01T09:00' },
      { poleId: 'POLE-103', label: 'Test pole', zone: '', type: 'wapda', landmark: '', notes: '', inventoryItemId: '', dropCustomerIds: [], splitterBoxIds: [], createdAt: '2026-10-01T09:00' },
      { poleId: 'POLE-104', label: 'B side pole', zone: '', type: 'wapda', landmark: '', notes: '', inventoryItemId: '', dropCustomerIds: [], splitterBoxIds: [], createdAt: '2026-10-01T09:00' }
    ]
  },
  fiberDrums: {
    a: [
      { drumId: 'DRUM-101', label: 'Test drum', initialLength: 1000, startJacketMark: 0, cuts: [], createdAt: '2026-10-01T09:00' },
      { drumId: 'DRUM-102', label: 'A drum', initialLength: 1000, startJacketMark: 0, cuts: [], createdAt: '2026-10-01T09:00' },
      { drumId: 'DRUM-104', label: 'Drum X (A)', initialLength: 1000, startJacketMark: 0, cuts: [], createdAt: '2026-10-01T09:00' }
    ],
    b: [
      { drumId: 'DRUM-101', label: 'Test drum', initialLength: 1000, startJacketMark: 0, cuts: [], createdAt: '2026-10-01T09:00' },
      { drumId: 'DRUM-103', label: 'B drum', initialLength: 1000, startJacketMark: 0, cuts: [], createdAt: '2026-10-01T09:00' },
      { drumId: 'DRUM-104', label: 'Drum X (B)', initialLength: 1000, startJacketMark: 0, cuts: [], createdAt: '2026-10-01T09:00' }
    ]
  },
  stormInspections: {
    a: {
      runs: [
        { date: '2026-10-14', startedAt: '2026-10-14T08:00', checks: {} },
        { date: '2026-10-13', startedAt: '2026-10-13T08:00', checks: {} },
        { date: '2026-10-11', startedAt: '2026-10-11T08:00', checks: {} }
      ]
    },
    b: {
      runs: [
        { date: '2026-10-14', startedAt: '2026-10-14T08:00', checks: {} },
        { date: '2026-10-12', startedAt: '2026-10-12T08:00', checks: {} },
        { date: '2026-10-11', startedAt: '2026-10-11T09:30', checks: {} }
      ]
    }
  },
  supplierKhata: {
    a: [
      { purchaseId: 'SUP-101', supplierName: 'Test Supplier', itemId: 'router', qty: 2, totalBillPKR: 4000, date: '2026-10-04', note: '', stockMovementId: '', payments: [], createdAt: '2026-10-04T09:00' },
      { purchaseId: 'SUP-102', supplierName: 'Test Supplier', itemId: 'router', qty: 2, totalBillPKR: 4000, date: '2026-10-04', note: '', stockMovementId: '', payments: [], createdAt: '2026-10-04T09:00' },
      { purchaseId: 'SUP-104', supplierName: 'Test Supplier', itemId: 'router', qty: 2, totalBillPKR: 4000, date: '2026-10-04', note: '', stockMovementId: '', payments: [], createdAt: '2026-10-04T09:00' }
    ],
    b: [
      { purchaseId: 'SUP-101', supplierName: 'Test Supplier', itemId: 'router', qty: 2, totalBillPKR: 4000, date: '2026-10-04', note: '', stockMovementId: '', payments: [], createdAt: '2026-10-04T09:00' },
      { purchaseId: 'SUP-103', supplierName: 'Test Supplier', itemId: 'router', qty: 2, totalBillPKR: 4000, date: '2026-10-04', note: '', stockMovementId: '', payments: [], createdAt: '2026-10-04T09:00' },
      { purchaseId: 'SUP-104', supplierName: 'Test Supplier', itemId: 'router', qty: 2, totalBillPKR: 4500, date: '2026-10-04', note: '', stockMovementId: '', payments: [], createdAt: '2026-10-04T09:00' }
    ]
  },
  commissionRules: {
    a: [
      { kind: 'field', label: 'Shared Collector', mode: 'perReceipt', perReceiptFixed: 50, percentageOfCollection: 0 },
      { kind: 'field', label: 'A Collector', mode: 'perReceipt', perReceiptFixed: 60, percentageOfCollection: 0 },
      { kind: 'field', label: 'Conflict Collector', mode: 'perReceipt', perReceiptFixed: 50, percentageOfCollection: 0 }
    ],
    b: [
      { kind: 'field', label: 'Shared Collector', mode: 'perReceipt', perReceiptFixed: 50, percentageOfCollection: 0 },
      { kind: 'field', label: 'B Collector', mode: 'perReceipt', perReceiptFixed: 70, percentageOfCollection: 0 },
      { kind: 'field', label: 'Conflict Collector', mode: 'perReceipt', perReceiptFixed: 80, percentageOfCollection: 0 }
    ]
  },
  upsNodes: {
    a: [
      { nodeId: 'UPS-101', name: 'Test UPS', ratedBatteryHours: 4, fedZones: [], history: [], createdAt: '2026-10-01T09:00' },
      { nodeId: 'UPS-102', name: 'Test UPS', ratedBatteryHours: 4, fedZones: [], history: [], createdAt: '2026-10-01T09:00' },
      { nodeId: 'UPS-104', name: 'Test UPS', ratedBatteryHours: 4, fedZones: [], history: [], createdAt: '2026-10-01T09:00' }
    ],
    b: [
      { nodeId: 'UPS-101', name: 'Test UPS', ratedBatteryHours: 4, fedZones: [], history: [], createdAt: '2026-10-01T09:00' },
      { nodeId: 'UPS-103', name: 'Test UPS', ratedBatteryHours: 4, fedZones: [], history: [], createdAt: '2026-10-01T09:00' },
      { nodeId: 'UPS-104', name: 'Test UPS', ratedBatteryHours: 6, fedZones: [], history: [], createdAt: '2026-10-01T09:00' }
    ]
  },
  feederCables: {
    a: [
      { cableId: 'FC-101', label: 'Test feeder', coreCount: 12, cores: [], history: [] },
      { cableId: 'FC-102', label: 'Test feeder', coreCount: 12, cores: [], history: [] },
      { cableId: 'FC-104', label: 'Feeder X (A)', coreCount: 12, cores: [], history: [] }
    ],
    b: [
      { cableId: 'FC-101', label: 'Test feeder', coreCount: 12, cores: [], history: [] },
      { cableId: 'FC-103', label: 'Test feeder', coreCount: 12, cores: [], history: [] },
      { cableId: 'FC-104', label: 'Feeder X (B)', coreCount: 12, cores: [], history: [] }
    ]
  },
  creditTransfers: {
    a: [
      { transferId: 'TRF-101', fromCustomerId: 'cust-a', fromCustomerNumber: 1, fromCustomerName: 'Test A', toCustomerId: 'cust-b', toCustomerNumber: 2, toCustomerName: 'Test B', amount: 500, date: '2026-10-05', note: '', status: 'active', consumedFrom: [{ paymentId: 'RCP-501', month: '2026-09', amount: 500 }], appliedTo: [{ month: '2026-10', amount: 500 }], createdAt: '2026-10-05T09:00' },
      { transferId: 'TRF-102', fromCustomerId: 'cust-a', fromCustomerNumber: 1, fromCustomerName: 'Test A', toCustomerId: 'cust-b', toCustomerNumber: 2, toCustomerName: 'Test B', amount: 500, date: '2026-10-05', note: '', status: 'active', consumedFrom: [{ paymentId: 'RCP-501', month: '2026-09', amount: 500 }], appliedTo: [{ month: '2026-10', amount: 500 }], createdAt: '2026-10-05T09:00' },
      { transferId: 'TRF-104', fromCustomerId: 'cust-a', fromCustomerNumber: 1, fromCustomerName: 'Test A', toCustomerId: 'cust-b', toCustomerNumber: 2, toCustomerName: 'Test B', amount: 500, date: '2026-10-05', note: '', status: 'active', consumedFrom: [{ paymentId: 'RCP-501', month: '2026-09', amount: 500 }], appliedTo: [{ month: '2026-10', amount: 500 }], createdAt: '2026-10-05T09:00' }
    ],
    b: [
      { transferId: 'TRF-101', fromCustomerId: 'cust-a', fromCustomerNumber: 1, fromCustomerName: 'Test A', toCustomerId: 'cust-b', toCustomerNumber: 2, toCustomerName: 'Test B', amount: 500, date: '2026-10-05', note: '', status: 'active', consumedFrom: [{ paymentId: 'RCP-501', month: '2026-09', amount: 500 }], appliedTo: [{ month: '2026-10', amount: 500 }], createdAt: '2026-10-05T09:00' },
      { transferId: 'TRF-103', fromCustomerId: 'cust-a', fromCustomerNumber: 1, fromCustomerName: 'Test A', toCustomerId: 'cust-b', toCustomerNumber: 2, toCustomerName: 'Test B', amount: 500, date: '2026-10-05', note: '', status: 'active', consumedFrom: [{ paymentId: 'RCP-501', month: '2026-09', amount: 500 }], appliedTo: [{ month: '2026-10', amount: 500 }], createdAt: '2026-10-05T09:00' },
      { transferId: 'TRF-104', fromCustomerId: 'cust-a', fromCustomerNumber: 1, fromCustomerName: 'Test A', toCustomerId: 'cust-b', toCustomerNumber: 2, toCustomerName: 'Test B', amount: 700, date: '2026-10-05', note: '', status: 'active', consumedFrom: [{ paymentId: 'RCP-501', month: '2026-09', amount: 700 }], appliedTo: [{ month: '2026-10', amount: 700 }], createdAt: '2026-10-05T09:00' }
    ]
  },
  fieldTools: {
    a: [
      { toolId: 'TOOL-101', type: 'fusion-splicer', name: 'Test Splicer', serial: '', assignedToLineman: '', condition: 'good', history: [], createdAt: '2026-10-01T09:00' },
      { toolId: 'TOOL-102', type: 'fusion-splicer', name: 'Test Splicer', serial: '', assignedToLineman: '', condition: 'good', history: [], createdAt: '2026-10-01T09:00' },
      { toolId: 'TOOL-104', type: 'fusion-splicer', name: 'Splicer X (A)', serial: '', assignedToLineman: '', condition: 'good', history: [], createdAt: '2026-10-01T09:00' }
    ],
    b: [
      { toolId: 'TOOL-101', type: 'fusion-splicer', name: 'Test Splicer', serial: '', assignedToLineman: '', condition: 'good', history: [], createdAt: '2026-10-01T09:00' },
      { toolId: 'TOOL-103', type: 'fusion-splicer', name: 'Test Splicer', serial: '', assignedToLineman: '', condition: 'good', history: [], createdAt: '2026-10-01T09:00' },
      { toolId: 'TOOL-104', type: 'fusion-splicer', name: 'Splicer X (B)', serial: '', assignedToLineman: '', condition: 'good', history: [], createdAt: '2026-10-01T09:00' }
    ]
  },
  spliceClosures: {
    a: [
      { closureId: 'JC-01', name: 'Test closure', landmark: '', cores: [], createdAt: '2026-10-01T09:00', updatedAt: '' },
      { closureId: 'JC-02', name: 'Test closure', landmark: '', cores: [], createdAt: '2026-10-01T09:00', updatedAt: '' },
      { closureId: 'JC-04', name: 'Closure X (A)', landmark: '', cores: [], createdAt: '2026-10-01T09:00', updatedAt: '' }
    ],
    b: [
      { closureId: 'JC-01', name: 'Test closure', landmark: '', cores: [], createdAt: '2026-10-01T09:00', updatedAt: '' },
      { closureId: 'JC-03', name: 'Test closure', landmark: '', cores: [], createdAt: '2026-10-01T09:00', updatedAt: '' },
      { closureId: 'JC-04', name: 'Closure X (B)', landmark: '', cores: [], createdAt: '2026-10-01T09:00', updatedAt: '' }
    ]
  },
  // sanitizeBadDebts keeps ONE written-off record per customerId, so
  // each fixture record names a distinct customer.
  badDebts: {
    a: [
      { badDebtId: 'BD-101', customerId: 'cust-x', customerNumber: 7, amount: 1500, bills: [], writeOffDate: '2026-10-01', writeOffReason: 'Test write-off', status: 'written-off', restoredAt: '' },
      { badDebtId: 'BD-102', customerId: 'cust-y', customerNumber: 8, amount: 1500, bills: [], writeOffDate: '2026-10-01', writeOffReason: 'Test write-off', status: 'written-off', restoredAt: '' },
      { badDebtId: 'BD-104', customerId: 'cust-w', customerNumber: 9, amount: 1500, bills: [], writeOffDate: '2026-10-01', writeOffReason: 'Test write-off', status: 'written-off', restoredAt: '' }
    ],
    b: [
      { badDebtId: 'BD-101', customerId: 'cust-x', customerNumber: 7, amount: 1500, bills: [], writeOffDate: '2026-10-01', writeOffReason: 'Test write-off', status: 'written-off', restoredAt: '' },
      { badDebtId: 'BD-103', customerId: 'cust-z', customerNumber: 10, amount: 1500, bills: [], writeOffDate: '2026-10-01', writeOffReason: 'Test write-off', status: 'written-off', restoredAt: '' },
      { badDebtId: 'BD-104', customerId: 'cust-w', customerNumber: 9, amount: 1700, bills: [], writeOffDate: '2026-10-01', writeOffReason: 'Test write-off', status: 'written-off', restoredAt: '' }
    ]
  },
  splitterPolish: {
    a: { 'BOX-101': 'APC', 'BOX-102': 'UPC', 'BOX-104': 'UPC' },
    b: { 'BOX-101': 'APC', 'BOX-103': 'APC', 'BOX-104': 'APC' }
  },
  splitterBoxGps: {
    a: { 'BOX-101': { lat: 33.7, lng: 73.1 }, 'BOX-102': { lat: 33.8, lng: 73.2 }, 'BOX-104': { lat: 33.1, lng: 73.0 } },
    b: { 'BOX-101': { lat: 33.7, lng: 73.1 }, 'BOX-103': { lat: 33.9, lng: 73.3 }, 'BOX-104': { lat: 33.2, lng: 73.05 } }
  },
  expenseBudgets: {
    a: { Cable: 5000, ONU: 9000, Electricity: 20000 },
    b: { Cable: 5000, Tools: 4000, Electricity: 21000 }
  }
};

// ---------------------------------------------------------------------------
// Registry-driven helpers: the same sanitize + adapt + keyOf pipeline the
// module itself applies (delta-merge-sync.js familyRecords), rebuilt here
// only from the registry's exported family definitions.
// ---------------------------------------------------------------------------

const familyByKey = new Map(DELTA_MERGE_FAMILIES.map((family) => [family.key, family]));

function recordsOf(family, sectionValue) {
  const sanitized = family.sanitize(sectionValue);
  return family.toRecords ? family.toRecords(sanitized) : (Array.isArray(sanitized) ? sanitized : []);
}

// natural key -> canonical record bytes, for one side of one family.
function keyedRecords(family, sectionValue) {
  const map = new Map();
  for (const record of recordsOf(family, sectionValue)) {
    const key = family.keyOf(record);
    assert.ok(key, `${family.key}: every fixture record must carry a usable natural key`);
    assert.ok(!map.has(key), `${family.key}: fixture keys must be distinct within one side (${key})`);
    map.set(key, canonicalize(record));
  }
  return map;
}

// ---------------------------------------------------------------------------
// Resolution (a) — the two SORTING families: roznamchaDays + deadPorts.
//
// A double-apply of these two families is a no-op in RECORD SET, not in
// raw byte ORDER, and that is a property of their shipped sanitizers,
// not of the merge:
//   * sanitizeRoznamchaDays (roznamcha.js) sorts its output by date.
//   * sanitizeDeadPorts (splitter-port-swap.js) sorts by boxId|port.
// applyDeltaMergeSections builds a merged section as the local records
// in local order with the plan's additions appended in backup order,
// and for plain-array families (no toRecords adapter) returns that list
// un-resorted. Feeding that raw output back as the next currentSections
// therefore re-enters through the sanitizer when the second plan reads
// it, which sorts — an addition that sorts before the local tail moves.
// No record is duplicated, altered or lost: the second plan adds 0 and
// the record set is exactly the same.
//
// Raw byte order is not the invariant for these two families because it
// is not the order any reader ever sees: the app's loaders
// (loadRoznamchaDays / loadDeadPorts, used by currentDeltaSections in
// app.js) sanitize — and therefore sort — on every read, and backups
// are exported from loader output, so a production second merge
// receives sorted input and lands on the loader-visible order directly.
// The churn exists only at the raw apply→apply level pinned here.
//
// So for these two families ONLY, the double-apply pins below assert
// idempotence in the family's canonical form — both states passed
// through the family's OWN shipped sanitizer — PLUS exact equality of
// the raw record sets (same natural keys, same per-record canonical
// bytes), so no duplication or loss can hide behind the normalization.
// The other 36 families keep the strict byte-identical assertions.
// ---------------------------------------------------------------------------

const SORTED_FAMILIES = new Set(['roznamchaDays', 'deadPorts']);

// Canonical form of one family's section value: the value passed
// through the family's own shipped sanitizer (the order every loader
// shows).
const canonicalSection = (family, value) => family.sanitize(clone(value));

// Exact record-set equality on the RAW section values: same natural
// keys, same per-record canonical bytes. Record ORDER is the only
// difference this helper cannot see — and order is pinned separately
// by the canonical-form comparison in assertCanonicalIdempotent.
function assertSameRecordSet(family, leftValue, rightValue, label) {
  const left = keyedRecords(family, leftValue);
  const right = keyedRecords(family, rightValue);
  assert.deepEqual([...left.keys()].sort(), [...right.keys()].sort(),
    `${family.key}: ${label} — natural-key sets must be identical (no duplication, no loss)`);
  for (const [key, bytes] of left) {
    assert.equal(right.get(key), bytes,
      `${family.key}: ${label} — record ${key} must be byte-identical`);
  }
}

function assertCanonicalIdempotent(family, secondValue, snapshotValue, label) {
  assert.deepEqual(canonicalSection(family, secondValue), canonicalSection(family, snapshotValue),
    `${family.key}: ${label} — contents identical in canonical (sanitizer) form`);
  assert.equal(canonicalize(canonicalSection(family, secondValue)), canonicalize(canonicalSection(family, snapshotValue)),
    `${family.key}: ${label} — contents byte-identical in canonical form`);
  assertSameRecordSet(family, secondValue, snapshotValue, label);
}

// Derive the expected three-way split for one family's fixtures and check
// the fixtures really exercise all of it (fails loudly on a bad fixture,
// never silently weakens the pin).
function expectedSplit(family) {
  const fixture = FIXTURES[family.key];
  assert.ok(fixture, `${family.key}: M14 fixture missing for a registered family`);
  const a = keyedRecords(family, fixture.a);
  const b = keyedRecords(family, fixture.b);
  const aOnly = [...a.keys()].filter((key) => !b.has(key));
  const bOnly = [...b.keys()].filter((key) => !a.has(key));
  const shared = [...a.keys()].filter((key) => b.has(key));
  const identical = shared.filter((key) => a.get(key) === b.get(key));
  const differing = shared.filter((key) => a.get(key) !== b.get(key));
  assert.equal(aOnly.length, 1, `${family.key}: fixture must hold exactly one A-only record`);
  assert.equal(bOnly.length, 1, `${family.key}: fixture must hold exactly one B-only record`);
  assert.equal(differing.length, 1, `${family.key}: fixture must hold exactly one conflicting shared key`);
  assert.ok(identical.length >= 1, `${family.key}: fixture must hold at least one identical shared record`);
  return { a, b, aOnly, bOnly, identical, differing };
}

test('M14 completeness: every registered delta family has an M14 fixture (registry-driven)', () => {
  assert.deepEqual(
    Object.keys(FIXTURES).sort(),
    DELTA_MERGE_FAMILIES.map((family) => family.key).sort(),
    'a family added to DELTA_MERGE_FAMILIES without an M14 fixture fails here first'
  );
  assert.equal(DELTA_MERGE_FAMILIES.length, 38, 'the M5 registry covers 38 record families');
  // Every fixture exercises the full three-way split (shared-identical,
  // side-only, shared-conflicting) under the family's own sanitizer.
  for (const family of DELTA_MERGE_FAMILIES) expectedSplit(family);
});

for (const family of DELTA_MERGE_FAMILIES) {
  test(`M14 ${family.key}: cross-device merge converges to A∪B by natural key`, () => {
    const { a, b, aOnly, differing } = expectedSplit(family);
    const fixture = FIXTURES[family.key];
    const backupText = createJsonBackup(baseState(), REF, { [family.key]: clone(fixture.a) });
    const currentSections = { [family.key]: clone(fixture.b) };

    const plan = planDeltaMergeSections({ backupText, currentSections });
    assert.equal(plan.ok, true, `${family.key}: device A backup passes the delta gate`);
    const familyPlan = plan.families[family.key];
    assert.ok(familyPlan, `${family.key}: the delta plan covers this family`);
    assert.equal(familyPlan.added.length, aOnly.length, `${family.key}: only the A-only record is an addition`);
    assert.equal(familyPlan.conflicts.length, differing.length, `${family.key}: the differing shared record conflicts`);
    assert.equal(familyPlan.unchanged, a.size - aOnly.length - differing.length,
      `${family.key}: identical shared records count as unchanged`);
    assert.equal(familyPlan.skippedUnkeyed, 0, `${family.key}: no fixture record is unkeyed`);
    assert.equal(familyPlan.skippedDuplicates, 0, `${family.key}: no fixture record duplicates inside the backup`);

    const { sections } = applyDeltaMergeSections({ currentSections, plan });
    const merged = keyedRecords(family, sections[family.key]);
    assert.deepEqual(
      [...merged.keys()].sort(),
      [...new Set([...a.keys(), ...b.keys()])].sort(),
      `${family.key}: merged key set is exactly A∪B — no duplicates, no losses`
    );
    for (const [key, bytes] of merged) {
      if (b.has(key)) {
        assert.equal(bytes, b.get(key),
          `${family.key}: key ${key} keeps device B's copy (local record / local-wins conflict)`);
      } else {
        assert.equal(bytes, a.get(key),
          `${family.key}: key ${key} joins with device A's content`);
      }
    }
  });

  test(`M14 ${family.key}: applying the same delta twice is a ${SORTED_FAMILIES.has(family.key) ? 'canonical-form' : 'byte-identical'} no-op`, () => {
    const fixture = FIXTURES[family.key];
    const backupText = createJsonBackup(baseState(), REF, { [family.key]: clone(fixture.a) });
    const base = { [family.key]: clone(fixture.b) };

    const firstPlan = planDeltaMergeSections({ backupText, currentSections: base });
    assert.equal(firstPlan.ok, true, `${family.key}: first plan verifies`);
    const first = applyDeltaMergeSections({ currentSections: base, plan: firstPlan });
    const snapshot = clone(first.sections[family.key]);
    assert.ok(snapshot !== undefined, `${family.key}: first apply produced the family section`);

    const secondPlan = planDeltaMergeSections({ backupText, currentSections: first.sections });
    assert.equal(secondPlan.ok, true, `${family.key}: second plan verifies`);
    assert.ok(secondPlan.families[family.key], `${family.key}: second plan still covers the family`);
    assert.equal(secondPlan.families[family.key].added.length, 0,
      `${family.key}: re-planning the same delta adds nothing`);
    const second = applyDeltaMergeSections({ currentSections: first.sections, plan: secondPlan });
    if (SORTED_FAMILIES.has(family.key)) {
      // Resolution (a): canonical-form idempotence + raw record-set
      // equality (see the block above) — for this family the order is
      // the sanitizer's invariant, not the merge's.
      assertCanonicalIdempotent(family, second.sections[family.key], snapshot, 'second apply');
      const normalize = (sections) => ({ ...sections, [family.key]: canonicalSection(family, sections[family.key]) });
      assert.deepEqual(normalize(second.sections), normalize(first.sections),
        `${family.key}: the whole sections object is unchanged by the double-apply (this family in canonical form)`);
    } else {
      assert.deepEqual(second.sections[family.key], snapshot,
        `${family.key}: second apply leaves the family contents deep-identical`);
      assert.equal(canonicalize(second.sections[family.key]), canonicalize(snapshot),
        `${family.key}: second apply leaves the family contents byte-identical (canonical form)`);
      assert.deepEqual(second.sections, first.sections,
        `${family.key}: the whole sections object is unchanged by the double-apply`);
    }
  });
}

test('M14: one kitchen-sink delta carrying all 38 families is idempotent as a whole', () => {
  const state = baseState();
  const allA = {};
  const allB = {};
  for (const family of DELTA_MERGE_FAMILIES) {
    allA[family.key] = clone(FIXTURES[family.key].a);
    allB[family.key] = clone(FIXTURES[family.key].b);
  }
  const backupText = createJsonBackup(state, REF, allA);
  const firstPlan = planDeltaMergeSections({ backupText, currentSections: allB });
  assert.equal(firstPlan.ok, true);
  assert.deepEqual(
    Object.keys(firstPlan.families).sort(),
    DELTA_MERGE_FAMILIES.map((family) => family.key).sort(),
    'the combined plan covers every registered family'
  );
  // Each family contributes exactly one addition (its A-only record) and
  // one kept-local conflict to the combined merge.
  assert.equal(firstPlan.totals.added, DELTA_MERGE_FAMILIES.length);
  assert.equal(firstPlan.totals.conflicts, DELTA_MERGE_FAMILIES.length);

  const first = applyDeltaMergeSections({ currentSections: allB, plan: firstPlan });
  const secondPlan = planDeltaMergeSections({ backupText, currentSections: first.sections });
  assert.equal(secondPlan.totals.added, 0, 're-planning the combined delta adds nothing anywhere');
  const second = applyDeltaMergeSections({ currentSections: first.sections, plan: secondPlan });
  // Byte-identical for 36 families; the two sorting families
  // (roznamchaDays, deadPorts) are compared in canonical form + raw
  // record-set equality — resolution (a), see the block above.
  assert.deepEqual(Object.keys(second.sections).sort(), Object.keys(first.sections).sort(),
    'applying the combined 38-family delta twice changes no section set');
  for (const family of DELTA_MERGE_FAMILIES) {
    if (SORTED_FAMILIES.has(family.key)) {
      assertCanonicalIdempotent(family, second.sections[family.key], first.sections[family.key],
        'combined double-apply');
    } else {
      assert.deepEqual(second.sections[family.key], first.sections[family.key],
        `${family.key}: combined double-apply leaves the family deep-identical`);
      assert.equal(canonicalize(second.sections[family.key]), canonicalize(first.sections[family.key]),
        `${family.key}: combined double-apply leaves the family byte-identical`);
    }
  }
});
