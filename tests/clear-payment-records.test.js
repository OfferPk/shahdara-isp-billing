// Clear All Record — pure payment wipe (Mohalla Seed, Option A).
//
// PRIVACY: every fixture below is SYNTHETIC (invented "Test ..." names,
// generic mohalla labels). The owner's real roster is never in this
// repo — the wipe is tested against invented ledgers only.
//
// Pins: the counter (N payments across M customers, net total in
// cents, bills-becoming-unpaid, satellite counts — all live
// non-voided only; voided stubs are history, never live money) and
// the wiper (payments gone, bills present-but-unpaid, customers /
// promises / settings / audit trails / receipt series untouched,
// inbox items gone, inbox settings kept, non-array stores never
// guessed, inputs never mutated).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLEAR_PAYMENT_RECORD_STORES,
  countPaymentRecords,
  clearPaymentRecords,
  readPaymentRecordStores,
  writePaymentRecordStores
} from '../clear-payment-records.js';

const pay = (id, amount) => ({ id, amount, date: '2026-11-05', method: 'cash' });
const bill = (month, dueAmount, payments = []) => ({
  id: `bill-${month}`, month, dueAmount, status: payments.length ? 'paid' : 'pending', payments
});
const customer = (id, name, mohalla, bills, extra = {}) => ({
  id, name, mohalla, bills, manualBaqaya: [], ...extra
});
const memoryStorage = (seed = {}) => {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    _map: map
  };
};

const fixtureState = () => ({
  customers: [
    customer('c-a', 'Test Alpha', 'CHARYAA', [
      bill('2026-10', 3000, [pay('p-a1', 3000)]),
      bill('2026-11', 3000, [pay('p-a2', 1500), pay('p-a3', -500)]),
      // Unpriced bill with one live payment AND one voided stub.
      bill('2026-09', null, [pay('p-a4', 2000), { ...pay('p-a5', 1000), voided: true, voidedAt: '2026-11-06', voidReason: 'Test void' }])
    ], {
      promiseDate: '2026-11-15',
      manualBaqaya: [{ id: 'mb-a1', amount: 700, date: '2026-10-20' }]
    }),
    customer('c-b', 'Test Beta', 'BARRIAN', [
      bill('2026-10', 2000, [pay('p-b1', 2000)])
    ]),
    customer('c-c', 'Test Gamma', 'SODAA', [
      bill('2026-10', 1500, []),
      // Priced bill whose ONLY payment is a voided stub — already
      // unpaid, never "becoming unpaid".
      bill('2026-09', 1500, [{ ...pay('p-c1', 1500), voided: true, voidedAt: '2026-11-06', voidReason: 'Test void' }])
    ])
  ],
  settings: { defaultCustomersImport: { doneAt: '2026-11-11T00:00:00.000Z', rosterVersion: 2, addedCount: 3 } },
  expenses: [{ id: 'e-1', amount: 500 }]
});

const fixtureStores = () => ({
  'shahdara_offline_payment_queue': [{ id: 'q-1' }, { id: 'q-2' }],
  'shahdara_payment_claims_v1': [{ id: 'cl-1' }],
  'shahdara_receipt_reprints_v1': [{ receiptNumber: 'R-1' }],
  'easypaisaInbox.items': [{ id: 'in-1' }, { id: 'in-2' }, { id: 'in-3' }],
  'shahdara_advance_allocations_v1': [],
  'shahdara_payment_clearance_v1': 'not-an-array'
});

test('registry: 14 payment-derived stores, frozen, no bare shahdara_advance key', () => {
  assert.ok(Object.isFrozen(CLEAR_PAYMENT_RECORD_STORES));
  assert.equal(CLEAR_PAYMENT_RECORD_STORES.length, 14);
  assert.ok(!CLEAR_PAYMENT_RECORD_STORES.includes('shahdara_advance'));
  assert.ok(CLEAR_PAYMENT_RECORD_STORES.includes('easypaisaInbox.items'));
  assert.ok(CLEAR_PAYMENT_RECORD_STORES.includes('shahdara_offline_payment_queue'));
});

test('counter: empty ledger counts zero everywhere', () => {
  assert.deepEqual(countPaymentRecords({ customers: [] }, {}), {
    payments: 0, customers: 0, totalCents: 0, billsBecomingUnpaid: 0, satelliteCounts: {}
  });
  assert.deepEqual(countPaymentRecords(null, null), {
    payments: 0, customers: 0, totalCents: 0, billsBecomingUnpaid: 0, satelliteCounts: {}
  });
});

test('counter: N payments across M customers, net total, bills becoming unpaid', () => {
  const counts = countPaymentRecords(fixtureState(), fixtureStores());
  assert.equal(counts.payments, 5);
  assert.equal(counts.customers, 2);
  // 3000 + 1500 - 500 (reversal) + 2000 + 2000 rupees, net, in cents.
  // The two voided stubs (1000 + 1500) are NOT in the total: voided
  // money was never collected, so it is not live money being wiped.
  assert.equal(counts.totalCents, 800000);
  // Only priced bills with a LIVE payment become unpaid: 2026-10 +
  // 2026-11 for Test Alpha, 2026-10 for Test Beta. The unpriced
  // 2026-09 bill (dueAmount null) has a payment but no due to become
  // unpaid, and Test Gamma's priced 2026-09 bill has only a voided
  // stub — it is already unpaid, never "becoming" unpaid.
  assert.equal(counts.billsBecomingUnpaid, 3);
  assert.equal(counts.satelliteCounts['shahdara_offline_payment_queue'], 2);
  assert.equal(counts.satelliteCounts['shahdara_payment_claims_v1'], 1);
  assert.equal(counts.satelliteCounts['easypaisaInbox.items'], 3);
  assert.equal(counts.satelliteCounts['shahdara_advance_allocations_v1'], 0);
  assert.equal(counts.satelliteCounts['shahdara_payment_clearance_v1'], 0);
  assert.equal('shahdara_receipt_books_v1' in counts.satelliteCounts, false);
});

test('counter: a ledger of only voided stubs counts zero — but the wiper still removes the stubs', () => {
  const state = {
    customers: [customer('c-v', 'Test Void Only', 'CHARYAA', [
      bill('2026-10', 3000, [{ ...pay('p-v1', 3000), voided: true, voidedAt: '2026-11-06', voidReason: 'Test void' }])
    ])]
  };
  assert.deepEqual(countPaymentRecords(state, {}), {
    payments: 0, customers: 0, totalCents: 0, billsBecomingUnpaid: 0, satelliteCounts: {}
  });
  const { nextState, result } = clearPaymentRecords(state, {});
  assert.equal(result.payments, 0);
  // The stub itself is a payment record in the bill's array, so the
  // wipe removes it — the void audit trail lives in
  // sisp_voided_payments_v1 + the audit log, neither of which is
  // in the wipe list.
  assert.deepEqual(nextState.customers[0].bills[0].payments, []);
});

test('wiper: payments gone, bills present-but-unpaid, everything else kept', () => {
  const state = fixtureState();
  const stores = fixtureStores();
  const before = JSON.stringify({ state, stores });
  const { nextState, nextStores, result } = clearPaymentRecords(state, stores);
  assert.equal(result.payments, 5);
  assert.equal(result.billsBecomingUnpaid, 3);
  // Every bill survives with an empty payments array.
  assert.equal(nextState.customers.length, 3);
  for (const c of nextState.customers) {
    for (const b of c.bills) assert.deepEqual(b.payments, []);
  }
  assert.equal(nextState.customers[0].bills.length, 3);
  // Kept: promises, manual baqaya dues, settings marker, expenses.
  assert.equal(nextState.customers[0].promiseDate, '2026-11-15');
  assert.deepEqual(nextState.customers[0].manualBaqaya, [{ id: 'mb-a1', amount: 700, date: '2026-10-20' }]);
  assert.deepEqual(nextState.settings.defaultCustomersImport, { doneAt: '2026-11-11T00:00:00.000Z', rosterVersion: 2, addedCount: 3 });
  assert.deepEqual(nextState.expenses, [{ id: 'e-1', amount: 500 }]);
  // Satellite stores: array stores emptied, non-array left untouched.
  assert.deepEqual(nextStores['shahdara_offline_payment_queue'], []);
  assert.deepEqual(nextStores['shahdara_payment_claims_v1'], []);
  assert.deepEqual(nextStores['shahdara_receipt_reprints_v1'], []);
  assert.deepEqual(nextStores['easypaisaInbox.items'], []);
  assert.equal(nextStores['shahdara_payment_clearance_v1'], 'not-an-array');
  // Inputs never mutated.
  assert.equal(JSON.stringify({ state, stores }), before);
  // A second wipe is a no-op.
  assert.deepEqual(countPaymentRecords(nextState, nextStores).payments, 0);
});

test('wiper: receipt books/series and other unlisted keys pass through untouched', () => {
  const stores = {
    'shahdara_receipt_books_v1': [{ id: 'book-1' }],
    'shahdara_receipt_series_v1': [{ id: 'series-1' }],
    'easypaisaInbox.settings': { till: 'T-1' },
    'shahdara_wada_records_v1': [{ customer: 'c-a' }]
  };
  const { nextStores } = clearPaymentRecords(fixtureState(), stores);
  assert.deepEqual(nextStores, stores);
});

test('storage wrappers: read parses present keys, write empties only non-empty arrays', () => {
  const storage = memoryStorage({
    'shahdara_offline_payment_queue': JSON.stringify([{ id: 'q-1' }]),
    'shahdara_payment_claims_v1': JSON.stringify([]),
    'shahdara_receipt_reprints_v1': 'broken-json{{{',
    'easypaisaInbox.settings': JSON.stringify({ till: 'T-1' })
  });
  const read = readPaymentRecordStores(storage);
  assert.deepEqual(read['shahdara_offline_payment_queue'], [{ id: 'q-1' }]);
  assert.deepEqual(read['shahdara_payment_claims_v1'], []);
  assert.equal('shahdara_receipt_reprints_v1' in read, false);
  assert.equal('easypaisaInbox.settings' in read, false);
  const { nextStores } = clearPaymentRecords(fixtureState(), read);
  const written = writePaymentRecordStores(storage, read, nextStores);
  assert.deepEqual(written, ['shahdara_offline_payment_queue']);
  assert.equal(storage._map.get('shahdara_offline_payment_queue'), '[]');
  assert.equal(storage._map.get('shahdara_payment_claims_v1'), '[]');
  assert.equal(storage._map.get('shahdara_receipt_reprints_v1'), 'broken-json{{{');
});
