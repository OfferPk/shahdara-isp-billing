// Mohalla Seed — "Clear All Record" (Option A: payments + payment-derived
// records only). Pure counter + wiper in clear-payment-records.js.
//
// PRIVACY: every fixture below is SYNTHETIC (invented "Customer A/B"
// names, generic mohallas). No real customer names are in this repo —
// the wipe is tested against shapes, never against the owner's roster.
//
// Pins: the preview counter (payments / customers / total / bills
// becoming unpaid / satellite counts), the wiper (payments gone, bills
// present-but-unpaid, everything else untouched, input never mutated,
// same reference when nothing to wipe), and the wipe-key list itself
// (satellites wiped wholesale; receipt books/series + settings never in
// it — receipt numbers must never be reused).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PAYMENT_RECORD_WIPE_KEYS,
  countSatelliteRecords,
  countPaymentRecords,
  clearPaymentRecords
} from '../clear-payment-records.js';
import { createInitialState, addCustomer } from '../core.js';
import { TRANSLATIONS } from '../nav-language.js';

const REF_DATE = new Date('2026-11-11T12:00:00Z');

const payment = (id, amount, overrides = {}) => ({
  id, amount, method: 'Cash', date: '2026-11-05', ...overrides
});

// Two customers, three bills, four payment entries:
//  - Customer A, Nov bill PKR 3,000 due, one live PKR 3,000 payment
//    (fully paid → becomes unpaid), one voided PKR 500 stub.
//  - Customer A, Oct bill PKR 2,000 due, one live PKR 1,500 payment
//    (partial → becomes unpaid).
//  - Customer B, Nov bill with NO priced amount (dueAmount null), one
//    live PKR 1,000 payment (derives 'not-set', never 'unpaid').
//  - Customer C has no bills at all.
const stateWithPayments = () => ({
  version: 1,
  nextCustomerNumber: 4,
  settings: { defaultCustomersImport: { doneAt: '2026-11-11T00:00:00.000Z', rosterVersion: 2, addedCount: 0 } },
  customers: [
    {
      id: 'cust-a', customerNumber: 1, name: 'Customer A', mohalla: 'Bani', phone: '',
      bills: [
        { id: 'bill-a-nov', month: '2026-11', dueAmount: 3000, status: 'pending', payments: [payment('pay-a1', 3000), payment('pay-a-void', 500, { voided: true })] },
        { id: 'bill-a-oct', month: '2026-10', dueAmount: 2000, status: 'pending', payments: [payment('pay-a2', 1500)] }
      ],
      manualBaqaya: [{ id: 'baq-1', amount: 400, date: '2026-11-01' }],
      waada: []
    },
    {
      id: 'cust-b', customerNumber: 2, name: 'Customer B', mohalla: 'Barrian', phone: '',
      bills: [
        { id: 'bill-b-nov', month: '2026-11', dueAmount: null, status: 'pending', payments: [payment('pay-b1', 1000)] }
      ],
      manualBaqaya: [],
      waada: []
    },
    { id: 'cust-c', customerNumber: 3, name: 'Customer C', mohalla: 'Bani', phone: '', bills: [], manualBaqaya: [], waada: [] }
  ]
});

test('clear-payment-records: counter on an empty state is all zeros', () => {
  const counts = countPaymentRecords({ customers: [] });
  assert.equal(counts.payments, 0);
  assert.equal(counts.customers, 0);
  assert.equal(counts.totalCents, 0);
  assert.equal(counts.billsBecomingUnpaid, 0);
  assert.equal(counts.satelliteTotal, 0);
  assert.deepEqual(Object.keys(counts.satelliteCounts).sort(), [...PAYMENT_RECORD_WIPE_KEYS].sort());
  assert.ok(Object.values(counts.satelliteCounts).every(v => v === 0));
});

test('clear-payment-records: counter counts every entry, live and voided', () => {
  const counts = countPaymentRecords(stateWithPayments());
  assert.equal(counts.payments, 4);
  assert.equal(counts.customers, 2);
  assert.equal(counts.totalCents, 600000);
  // Only the two priced bills with a live payment flip to unpaid: the
  // voided-only arithmetic and the unpriced bill do not count.
  assert.equal(counts.billsBecomingUnpaid, 2);
});

test('clear-payment-records: counter counts only priced bills with a live payment as becoming unpaid', () => {
  const state = {
    customers: [
      { id: 'c1', bills: [{ month: '2026-11', dueAmount: 1000, payments: [payment('p1', 100, { voided: true })] }] },
      { id: 'c2', bills: [{ month: '2026-11', dueAmount: 0, payments: [payment('p2', 500)] }] },
      { id: 'c3', bills: [{ month: '2026-11', dueAmount: 1000, payments: [] }] }
    ]
  };
  const counts = countPaymentRecords(state);
  assert.equal(counts.payments, 2);
  assert.equal(counts.billsBecomingUnpaid, 0);
});

test('clear-payment-records: satellite counts handle arrays, objects and missing keys', () => {
  assert.equal(countSatelliteRecords(['a', 'b']), 2);
  assert.equal(countSatelliteRecords({ x: 1, y: 2, z: 3 }), 3);
  assert.equal(countSatelliteRecords(undefined), 0);
  assert.equal(countSatelliteRecords(null), 0);
  assert.equal(countSatelliteRecords('not-a-store'), 0);
  const counts = countPaymentRecords({ customers: [] }, {
    'shahdara_advance': [{ id: 'adv-1' }, { id: 'adv-2' }],
    'shahdara_offline_payment_queue': [{ id: 'q-1' }],
    'easypaisaInbox.items': { a: 1, b: 2 }
  });
  assert.equal(counts.satelliteCounts['shahdara_advance'], 2);
  assert.equal(counts.satelliteCounts['shahdara_offline_payment_queue'], 1);
  assert.equal(counts.satelliteCounts['easypaisaInbox.items'], 2);
  assert.equal(counts.satelliteTotal, 5);
});

test('clear-payment-records: wiper empties every payments array and nothing else', () => {
  const before = stateWithPayments();
  const snapshot = JSON.parse(JSON.stringify(before));
  const next = clearPaymentRecords(before);
  // Input never mutated.
  assert.deepEqual(before, snapshot);
  // Every bill keeps its amount and identity; only payments are gone.
  for (const customer of next.customers) {
    for (const bill of customer.bills) {
      assert.deepEqual(bill.payments, []);
      assert.ok(bill.dueAmount === null || bill.dueAmount > 0);
    }
  }
  assert.equal(next.customers[0].bills.length, 2);
  assert.equal(next.customers[0].bills[0].dueAmount, 3000);
  assert.equal(next.customers[0].bills[1].dueAmount, 2000);
  // Customers, dues, promises, settings and the import marker survive.
  assert.equal(next.customers.length, 3);
  assert.deepEqual(next.customers[0].manualBaqaya, [{ id: 'baq-1', amount: 400, date: '2026-11-01' }]);
  assert.deepEqual(next.settings, before.settings);
  assert.equal(next.nextCustomerNumber, 4);
  // The counter on the wiped state is zero — and the bills that flipped
  // are exactly the two the preview promised.
  const after = countPaymentRecords(next);
  assert.equal(after.payments, 0);
  assert.equal(after.billsBecomingUnpaid, 0);
});

test('clear-payment-records: a customer with no payments keeps the same reference', () => {
  const before = stateWithPayments();
  const next = clearPaymentRecords(before);
  assert.strictEqual(next.customers[2], before.customers[2]);
  assert.notStrictEqual(next.customers[0], before.customers[0]);
});

test('clear-payment-records: nothing to wipe returns the same state reference', () => {
  const before = { customers: [{ id: 'c1', bills: [] }] };
  assert.strictEqual(clearPaymentRecords(before), before);
  const empty = { customers: [] };
  assert.strictEqual(clearPaymentRecords(empty), empty);
  assert.strictEqual(clearPaymentRecords(null), null);
  assert.strictEqual(clearPaymentRecords(undefined), undefined);
});

test('clear-payment-records: wiper works on a real addCustomer record shape', () => {
  let state = addCustomer(createInitialState([]), 'Customer A', REF_DATE, { mohalla: 'Bani' });
  state = {
    ...state,
    customers: state.customers.map(customer => ({
      ...customer,
      bills: [{ id: 'bill-1', month: '2026-11', dueAmount: 3000, status: 'pending', payments: [payment('pay-1', 3000)] }]
    }))
  };
  const counts = countPaymentRecords(state);
  assert.equal(counts.payments, 1);
  assert.equal(counts.billsBecomingUnpaid, 1);
  const next = clearPaymentRecords(state);
  assert.deepEqual(next.customers[0].bills[0].payments, []);
  assert.equal(next.customers[0].name, 'Customer A');
  assert.equal(next.customers[0].nameUrdu, '');
});

test('clear-payment-records: wipe keys cover every satellite store and never a kept store', () => {
  assert.ok(Object.isFrozen(PAYMENT_RECORD_WIPE_KEYS));
  for (const key of [
    'shahdara_advance', 'shahdara_advance_allocations_v1', 'shahdara_advance_expiry_v1',
    'shahdara_offline_payment_queue', 'shahdara_orphan_payments_v1', 'shahdara_payment_claims_v1',
    'shahdara_payment_clearance_v1', 'shahdara_part_payment_allocations_v1',
    'shahdara_part_payment_receipt_notes_v1', 'shahdara_receipts_shared_v1',
    'shahdara_receipt_reprints_v1', 'shahdara_split_receipts_v1', 'shahdara_document_receipts_v1',
    'shahdara_receipt_gap_explanations_v1', 'easypaisaInbox.items'
  ]) assert.ok(PAYMENT_RECORD_WIPE_KEYS.includes(key), key);
  for (const kept of [
    'shahdara_receipt_books_v1', 'shahdara_receipt_series_v1', 'shahdara_receipt_series_reissues_v1',
    'shahdara_bill_reissues_v1', 'shahdara_wada_records_v1', 'shahdara_collection_promises_v1',
    'shahdara_collector_settlements_v1', 'shahdara_daily_cash_handovers_v1',
    'shahdara_coverage_estimates_v1', 'shahdara_operator_audit_log_v1', 'easypaisaInbox.settings'
  ]) assert.ok(!PAYMENT_RECORD_WIPE_KEYS.includes(kept), kept);
});

// ---------- i18n audit (every clr_ key the dialog + app.js wiring use, en + ur) ----------

test('i18n: every clr_ key used by the dialog and the app.js wiring exists in en and ur with matching placeholders', () => {
  const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const used = new Set();
  for (const match of appSource.matchAll(/t\('(clr_[a-z0-9_]+)'/g)) used.add(match[1]);
  for (const match of html.matchAll(/data-i18n(?:-[a-z-]+)?="(clr_[a-z0-9_]+)"/g)) used.add(match[1]);
  assert.ok(used.size >= 10, `expected the dialog's clr_ keys, got ${used.size}`);
  const placeholders = text => [...String(text).matchAll(/\{([a-zA-Z]+)\}/g)].map(m => m[1]).sort();
  for (const key of used) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `placeholder parity ${key}`);
  }
  const enKeys = Object.keys(TRANSLATIONS.en).filter(k => k.startsWith('clr_')).sort();
  const urKeys = Object.keys(TRANSLATIONS.ur).filter(k => k.startsWith('clr_')).sort();
  assert.deepEqual(urKeys, enKeys, 'clr_ key sets identical in en and ur');
});
