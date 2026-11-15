// Sharafat 60: the inbox match dropdown must never offer an archived
// customer, and the record path must refuse an archived id with the
// archived-specific message instead of the generic "Selected customer
// not found." — at the API layer (recordInboxPayment) as well as in the
// Record-button handler. Pattern-fake data only (Test Customer #101 /
// Archived Customer #102, 03012345678 family, TESTTXN* ids) — no real
// customer data.
import test from 'node:test';
import assert from 'node:assert/strict';

import { saveBillMonth } from '../core.js';
import {
  recordInboxPayment,
  PaymentsInboxController
} from '../payments-inbox.js';

// renderTransactionRow calls the app shell's ambient escapeHtml global;
// stub the same escaping here so the row markup can be tested in Node.
if (typeof globalThis.escapeHtml === 'undefined') {
  globalThis.escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const MONTH = '2026-10';
const DAY = '2026-10-15';
const REF = new Date('2026-10-15T10:00:00Z');
const PHONE = '03012345678';
const OTHER_PHONE = '03012345679';
const ARCHIVED_MESSAGE = 'Archived customers cannot receive payments. Unarchive the customer first.';

const ACTIVE = { id: 'cust-1', customerNumber: 101, name: 'Test Customer', phone: PHONE, area: 'Test Area', archived: false, bills: [] };
const ARCHIVED = { id: 'cust-2', customerNumber: 102, name: 'Archived Customer', phone: OTHER_PHONE, area: 'Test Area', archived: true, bills: [] };

function stateWithBill(dueAmount = 3000) {
  const state = { customers: [{ ...ACTIVE, bills: [] }] };
  return saveBillMonth(state, 'cust-1', { month: MONTH, dueAmount, status: 'pending' }, REF);
}

// saveBillMonth refuses archived customers, so an archived customer's
// pre-existing bill is hand-built — that is precisely the S3
// configuration (a customer archived after their bills were raised).
function stateWithArchivedBill() {
  return {
    customers: [{
      ...ARCHIVED,
      bills: [{ id: 'bill-1', month: MONTH, dueAmount: 3000, status: 'pending', payments: [] }]
    }]
  };
}

function txn(id, overrides = {}) {
  return {
    txnId: id,
    direction: 'Received',
    amount: 3000,
    date: DAY,
    senderName: 'Test Customer',
    senderNumber: PHONE,
    ...overrides
  };
}

function renderRow(item, customers, state, inbox) {
  return (inbox || new PaymentsInboxController()).renderTransactionRow(item, customers, state);
}

// Drives the real Record-button click handler on a fake container and
// captures every toast (57's harness pattern).
function makeInbox(initialState) {
  let state = initialState;
  const toasts = [];
  globalThis.window = { toast: (message, opts = {}) => toasts.push({ message, opts }) };
  const container = {
    innerHTML: '',
    listeners: {},
    addEventListener(type, fn) {
      (this.listeners[type] ||= []).push(fn);
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };
  const inbox = new PaymentsInboxController({
    getState: () => state,
    onSaveState: (next) => {
      state = next;
    }
  });
  inbox.confirm = async () => true;
  inbox.container = container;
  inbox.bindEvents();
  return {
    inbox,
    container,
    toasts,
    get state() {
      return state;
    },
    setState(next) {
      state = next;
    }
  };
}

async function clickRecord(harness, txnId) {
  const btn = {
    dataset: { recordTxn: txnId },
    disabled: false,
    textContent: 'Record Payment',
    closest: () => null
  };
  const event = {
    target: {
      closest: (sel) => (sel === '[data-record-txn]' ? btn : null)
    }
  };
  await harness.container.listeners.click[0](event);
  return btn;
}

// --- Dropdown options (D4): the filter lives in the row function ---

test('sharafat 60: dropdown options exclude archived customers, list active ones', () => {
  const html = renderRow(txn('TESTTXN0001'), [{ ...ACTIVE }], { customers: [{ ...ACTIVE }] });
  assert.ok(!html.includes('#102 Archived Customer'), 'no archived option');
  assert.ok(html.includes('#101 Test Customer'), 'active customer listed');
});

test('sharafat 60: dropdown options exclude archived customers even when fed the raw roster', () => {
  const html = renderRow(
    txn('TESTTXN0001'),
    [{ ...ACTIVE }, { ...ARCHIVED }],
    { customers: [{ ...ACTIVE }, { ...ARCHIVED }] }
  );
  assert.ok(!html.includes('#102 Archived Customer'), 'archived customer never an option');
  assert.ok(html.includes('#101 Test Customer'), 'active customer still listed');
});

// --- Record path (D1/D5): archived-specific message, nothing recorded ---

test('sharafat 60: stale pick of a now-archived customer names the archived case', () => {
  const harness = makeInbox(stateWithBill());
  harness.inbox.items = [txn('TESTTXN0001')];
  harness.inbox.selectedCustomerMatches.set('TESTTXN0001', 'cust-1');
  // The customer is archived after the pick — the stale pick must not
  // produce the generic "Selected customer not found."
  harness.setState({
    customers: [{ ...harness.state.customers[0], archived: true }]
  });
  return clickRecord(harness, 'TESTTXN0001').then(() => {
    assert.ok(harness.toasts.some((t) => t.message === ARCHIVED_MESSAGE), 'archived message shown');
    assert.ok(!harness.toasts.some((t) => t.message === 'Selected customer not found.'), 'no generic error');
    assert.equal(harness.state.customers[0].bills[0].payments.length, 0, 'nothing recorded');
  });
});

test('sharafat 60: recordInboxPayment refuses an archived id with a pre-existing bill', () => {
  const state = stateWithArchivedBill();
  assert.throws(
    () => recordInboxPayment({ state, txn: txn('TESTTXN0001'), customerId: 'cust-2' }),
    (err) => err.message === ARCHIVED_MESSAGE
  );
  assert.equal(state.customers[0].bills[0].payments.length, 0, 'nothing recorded');
});

test('sharafat 60: recordInboxPayment refuses an archived id with no bill either', () => {
  const state = { customers: [{ ...ARCHIVED, bills: [] }] };
  assert.throws(
    () => recordInboxPayment({ state, txn: txn('TESTTXN0001'), customerId: 'cust-2' }),
    (err) => err.message === ARCHIVED_MESSAGE
  );
});

test('sharafat 60: recordInboxPayment still records an active customer', () => {
  const state = stateWithBill();
  const res = recordInboxPayment({ state, txn: txn('TESTTXN0001'), customerId: 'cust-1' });
  assert.equal(res.txn.recorded, true);
  assert.equal(res.txn.recordedCustomerId, 'cust-1');
  assert.equal(res.nextState.customers[0].bills[0].payments.length, 1);
});

// --- Recorded badge (D3): history stays readable after archiving ---

test('sharafat 60: recorded row for a later-archived customer still shows the badge', () => {
  const recorded = txn('TESTTXN0001', { recorded: true, recordedCustomerId: 'cust-2', recordedMonth: MONTH });
  const html = renderRow(
    recorded,
    [{ ...ACTIVE }],
    { customers: [{ ...ACTIVE }, { ...ARCHIVED }] }
  );
  assert.ok(html.includes('✓ #102 Archived Customer (2026-10)'), 'badge names the archived customer');
});

// --- Stale picks (D2): pruned on render, row falls back to auto-match ---

test('sharafat 60: pruneStaleCustomerMatches drops an archived pick and keeps an active one', () => {
  const inbox = new PaymentsInboxController();
  inbox.selectedCustomerMatches.set('TESTTXN0001', 'cust-2');
  inbox.selectedCustomerMatches.set('TESTTXN0002', 'cust-1');
  inbox.pruneStaleCustomerMatches([{ ...ACTIVE }]);
  assert.equal(inbox.selectedCustomerMatches.has('TESTTXN0001'), false, 'archived pick pruned');
  assert.equal(inbox.selectedCustomerMatches.get('TESTTXN0002'), 'cust-1', 'active pick kept');
});

test('sharafat 60: updateListOnly prunes a stale pick before re-rendering', () => {
  const harness = makeInbox(stateWithBill());
  harness.inbox.items = [txn('TESTTXN0001')];
  harness.inbox.selectedCustomerMatches.set('TESTTXN0001', 'cust-1');
  harness.setState({
    customers: [{ ...harness.state.customers[0], archived: true }]
  });
  harness.inbox.updateListOnly();
  assert.equal(harness.inbox.selectedCustomerMatches.has('TESTTXN0001'), false, 'stale pick pruned on list update');
});
