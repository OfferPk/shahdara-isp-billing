import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getInboxSettings,
  saveInboxSettings,
  loadInboxItems,
  saveInboxItems,
  calculateInboxTotals,
  matchCustomerByPhone,
  findCandidateBillMonth,
  mergeInboxItems,
  filterInboxItems,
  recordInboxPayment,
  INBOX_SETTINGS_KEY,
  INBOX_STORAGE_KEY
} from '../payments-inbox.js';

// Setup Mock LocalStorage for Node test environment
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = new MockLocalStorage();
}

test('issue #305 (Inbox): settings management loads defaults and normalizes owner number', () => {
  localStorage.clear();

  const defaults = getInboxSettings();
  assert.equal(defaults.sheetUrl, '');
  // Hardening (lane:muse on #305): no real person's number ships as a
  // default — the owner enters their own number in Settings.
  assert.equal(defaults.ownerNumber, '');
  assert.equal(defaults.autoMatchPhone, true);

  const updated = saveInboxSettings({
    sheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSample/pub?output=csv',
    ownerNumber: '+92 333 5001667'
  });

  assert.equal(updated.sheetUrl, 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSample/pub?output=csv');
  assert.equal(updated.ownerNumber, '03335001667');

  const reloaded = getInboxSettings();
  assert.equal(reloaded.sheetUrl, updated.sheetUrl);
  assert.equal(reloaded.ownerNumber, '03335001667');
});

test('issue #305 (Inbox): load and save inbox items preserves list in storage', () => {
  localStorage.clear();

  assert.deepEqual(loadInboxItems(), []);

  const sampleItems = [
    { txnId: '57255283608', amount: 5000, direction: 'Sent', date: '2026-10-13' },
    { txnId: '57255283610', amount: 3500, direction: 'Received', date: '2026-10-13' }
  ];

  saveInboxItems(sampleItems);
  const loaded = loadInboxItems();
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].txnId, '57255283608');
  assert.equal(loaded[1].txnId, '57255283610');
});

test('issue #305 (Inbox): calculateInboxTotals computes Today and This Month Sent vs Received', () => {
  const refDate = new Date('2026-10-20T12:00:00Z');
  const items = [
    // Today Received
    { txnId: 'T1', amount: 2500, direction: 'Received', date: '2026-10-20', recorded: false },
    { txnId: 'T2', amount: 1500, direction: 'Received', date: '2026-10-20', recorded: true },
    // Today Sent
    { txnId: 'T3', amount: 1000, direction: 'Sent', date: '2026-10-20' },
    // Earlier this month
    { txnId: 'T4', amount: 5000, direction: 'Received', date: '2026-10-15', recorded: true },
    { txnId: 'T5', amount: 3000, direction: 'Sent', date: '2026-10-14' },
    // Previous month
    { txnId: 'T6', amount: 4000, direction: 'Received', date: '2026-09-28', recorded: false },
    // Needs review
    { txnId: 'T7', amount: null, direction: 'Unknown', status: 'Needs review', date: '2026-10-20' }
  ];

  const totals = calculateInboxTotals(items, refDate);

  // Today
  assert.equal(totals.today.received, 4000); // 2500 + 1500
  assert.equal(totals.today.receivedCount, 2);
  assert.equal(totals.today.sent, 1000);
  assert.equal(totals.today.sentCount, 1);

  // This Month (October)
  assert.equal(totals.month.received, 9000); // 2500 + 1500 + 5000
  assert.equal(totals.month.receivedCount, 3);
  assert.equal(totals.month.sent, 4000); // 1000 + 3000
  assert.equal(totals.month.sentCount, 2);

  // Overall totals
  assert.equal(totals.total.received, 13000); // 9000 + 4000
  assert.equal(totals.total.sent, 4000);
  assert.equal(totals.total.unrecordedCount, 2); // T1 and T6
  assert.equal(totals.total.needsReviewCount, 1); // T7
  assert.equal(totals.total.totalCount, 7);
});

test('issue #305 (Inbox): matchCustomerByPhone matches customers across phone formats', () => {
  const customers = [
    { id: 'c1', customerNumber: '101', name: 'Aqib Ejaz', phone: '03055669955', archived: false },
    { id: 'c2', customerNumber: '102', name: 'Hamza Riaz', phone: '0312-3456789', archived: false },
    { id: 'c3', customerNumber: '103', name: 'Archived User', phone: '03001122334', archived: true }
  ];

  // Standard match
  assert.equal(matchCustomerByPhone('03055669955', customers)?.id, 'c1');

  // Country code +92 match
  assert.equal(matchCustomerByPhone('+92 312 3456789', customers)?.id, 'c2');
  assert.equal(matchCustomerByPhone('923123456789', customers)?.id, 'c2');

  // Urdu numerals match
  assert.equal(matchCustomerByPhone('۰۳۰۵۵۶۶۹۹۵۵', customers)?.id, 'c1');

  // Unmatched & archived
  assert.equal(matchCustomerByPhone('03009999999', customers), null);
  assert.equal(matchCustomerByPhone('03001122334', customers), null); // archived
});

test('issue #305 (Inbox): findCandidateBillMonth selects earliest unpaid bill month', () => {
  const refDate = new Date('2026-10-20T12:00:00Z');

  const customerWithDues = {
    id: 'c1',
    bills: [
      { month: '2026-10', dueAmount: 2000, payments: [], status: 'pending' },
      { month: '2026-09', dueAmount: 2000, payments: [], status: 'pending' },
      { month: '2026-08', dueAmount: 2000, payments: [{ amount: 2000 }], status: 'paid' }
    ]
  };

  // Earliest unpaid is 2026-09
  assert.equal(findCandidateBillMonth(customerWithDues, '2026-10-20', refDate), '2026-09');

  const fullyPaidCustomer = {
    id: 'c2',
    bills: [
      { month: '2026-10', dueAmount: 2000, payments: [{ amount: 2000 }], status: 'paid' }
    ]
  };

  // Fallback to transaction date's month
  assert.equal(findCandidateBillMonth(fullyPaidCustomer, '2026-10-20', refDate), '2026-10');
});

test('issue #305 (Inbox): mergeInboxItems de-duplicates by txnId and preserves recorded state', () => {
  const existing = [
    { txnId: 'TXN100', amount: 1500, direction: 'Received', recorded: true, recordedPaymentId: 'pay-1', recordedMonth: '2026-10' },
    { txnId: 'TXN101', amount: 2000, direction: 'Received', recorded: false }
  ];

  const incoming = [
    // Duplicate of TXN100 (e.g. from fresh sheet sync)
    { txnId: 'TXN100', amount: 1500, direction: 'Received' },
    // New transaction
    { txnId: 'TXN102', amount: 3000, direction: 'Received', date: '2026-10-20' }
  ];

  const merged = mergeInboxItems(existing, incoming);
  assert.equal(merged.length, 3);

  const txn100 = merged.find(i => i.txnId === 'TXN100');
  assert.equal(txn100.recorded, true, 'recorded flag must be preserved');
  assert.equal(txn100.recordedPaymentId, 'pay-1');

  const txn102 = merged.find(i => i.txnId === 'TXN102');
  assert.ok(txn102);
  assert.equal(txn102.amount, 3000);
});

test('issue #305 (Inbox): filterInboxItems applies query, direction, status and date filters', () => {
  const refDate = new Date('2026-10-20T12:00:00Z');
  const items = [
    { txnId: 'TXN01', senderName: 'Aqib Ejaz', senderNumber: '03055669955', amount: 2500, direction: 'Received', date: '2026-10-20', recorded: false },
    { txnId: 'TXN02', senderName: 'Hamza Riaz', senderNumber: '03123456789', amount: 1500, direction: 'Received', date: '2026-10-20', recorded: true },
    { txnId: 'TXN03', receiverName: 'Vendor Nayatel', receiverNumber: '03001234567', amount: 5000, direction: 'Sent', date: '2026-10-18', recorded: false },
    { txnId: 'TXN04', amount: null, direction: 'Unknown', status: 'Needs review', date: '2026-10-10' }
  ];

  // Search by sender name
  const resSearch = filterInboxItems(items, { query: 'Hamza' }, null, refDate);
  assert.equal(resSearch.length, 1);
  assert.equal(resSearch[0].txnId, 'TXN02');

  // Direction Sent
  const resSent = filterInboxItems(items, { direction: 'Sent' }, null, refDate);
  assert.equal(resSent.length, 1);
  assert.equal(resSent[0].txnId, 'TXN03');

  // Status Unrecorded
  const resUnrecorded = filterInboxItems(items, { status: 'unrecorded' }, null, refDate);
  assert.equal(resUnrecorded.length, 1);
  assert.equal(resUnrecorded[0].txnId, 'TXN01');

  // Status Review
  const resReview = filterInboxItems(items, { status: 'review' }, null, refDate);
  assert.equal(resReview.length, 1);
  assert.equal(resReview[0].txnId, 'TXN04');

  // Date Today
  const resToday = filterInboxItems(items, { dateRange: 'today' }, null, refDate);
  assert.equal(resToday.length, 2);
});

test('issue #305 (Inbox): recordInboxPayment saves payment with txnId and prevents duplicate recording', () => {
  const refDate = new Date('2026-10-20T12:00:00Z');

  let state = {
    customers: [
      {
        id: 'cust-1',
        customerNumber: '101',
        name: 'Aqib Ejaz',
        phone: '03055669955',
        archived: false,
        bills: [
          {
            id: 'b-oct',
            month: '2026-10',
            dueAmount: 2000,
            dueDate: '2026-10-05',
            status: 'pending',
            payments: [],
            amountHistory: []
          }
        ]
      }
    ]
  };

  const txn = {
    txnId: '57255283699',
    amount: 2000,
    date: '2026-10-20',
    direction: 'Received',
    senderName: 'Aqib Ejaz',
    senderNumber: '03055669955'
  };

  // 1. Record payment
  const res = recordInboxPayment({
    state,
    txn,
    customerId: 'cust-1',
    month: '2026-10',
    referenceDate: refDate
  });

  assert.ok(res.nextState);
  assert.equal(res.txn.recorded, true);
  assert.equal(res.txn.recordedMonth, '2026-10');
  assert.ok(res.payment);
  assert.equal(res.payment.amount, 2000);
  assert.equal(res.payment.method, 'Easypaisa');
  assert.equal(res.payment.transactionId, '57255283699');

  // Verify payment exists on customer bill
  const updatedCustomer = res.nextState.customers.find(c => c.id === 'cust-1');
  const octBill = updatedCustomer.bills.find(b => b.month === '2026-10');
  assert.equal(octBill.payments.length, 1);
  assert.equal(octBill.payments[0].transactionId, '57255283699');

  // 2. Duplicate prevention test: attempting to record again with same txnId must throw
  assert.throws(() => {
    recordInboxPayment({
      state: res.nextState,
      txn,
      customerId: 'cust-1',
      month: '2026-10',
      referenceDate: refDate
    });
  }, /already recorded/);
});
