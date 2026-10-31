// SISP-37: Unidentified / Suspense Online Payment Register.
// Pure-function tests on synthetic data only. Pins the spec criterion:
// logging an unclaimed Rs. 3,000 EasyPaisa entry and linking it to a
// customer clears their Rs. 3,000 due balance and marks the suspense
// record claimed: true — verified through the REAL core allocation
// engine (saveBillMonth + calculatePaymentAllocations) and the REAL
// quick-collection executor (the same payment path every other payment
// uses). Also pins: SISP-21 normalizeTid duplicate semantics on logging
// (whitespace/case-insensitive, hyphens NOT stripped), the double-count
// guard (a TID already recorded as a customer payment cannot be
// claimed), claimed records kept for audit, and the backup safe-merge
// round-trip.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addPayment, saveBillMonth, calculatePaymentAllocations,
  createInitialState, createJsonBackup, previewJsonBackupMerge
} from '../core.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import { findPaymentsByTid, normalizeTid } from '../wallet-reconciliation.js';
import {
  SUSPENSE_PAYMENTS_KEY,
  addSuspensePayment,
  buildSuspenseFields,
  buildSuspenseReceipt,
  claimSuspensePayment,
  deleteSuspensePayment,
  findSuspenseByTid,
  formatSuspensePKR,
  loadSuspensePayments,
  nextSuspenseId,
  sanitizeSuspensePayments,
  saveSuspensePayments,
  suspenseSummary,
  unclaimedSuspense
} from '../suspense-payments.js';

const now = new Date();
const month = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 7); // PKT — the app derives the billing month in Asia/Karachi; plain toISOString() (UTC) is a month behind between 00:00–05:00 PKT on the 1st
const today = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10); // PKT

const customer = (id, n, extra = {}) => ({
  id, customerNumber: n, name: `Customer ${n}`, phone: `0300000000${n}`,
  area: 'Shahdara', archived: false, bills: [], ...extra
});

function stateWithDue3000() {
  let s = { customers: [customer('a', 1), customer('b', 2)] };
  s = saveBillMonth(s, 'a', { month, dueAmount: 3000, status: 'pending' });
  return s;
}

function balanceDueCents(state, customerId) {
  const allocations = calculatePaymentAllocations(state);
  const summary = allocations.forMonth(customerId, month);
  return summary ? summary.balanceDueCents : null;
}

const entry3000 = (overrides = {}) => addSuspensePayment([], {
  amount: 3000,
  wallet: 'Easypaisa',
  senderName: 'Unknown Sender',
  senderMobile: '03009998887',
  tid: 'TXN 9001',
  date: today,
  ...overrides
})[0];

test('PINNED: Rs. 3,000 unclaimed EasyPaisa entry, claimed & linked, clears the Rs. 3,000 due and marks claimed: true', () => {
  const entries = addSuspensePayment([], {
    amount: 3000, wallet: 'Easypaisa', senderName: 'Unknown Sender',
    senderMobile: '03009998887', tid: 'TXN 9001', date: today
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].suspenseId, 'SUS-101');
  assert.equal(entries[0].claimed, false);
  assert.equal(entries[0].amount, 3000);
  assert.equal(entries[0].wallet, 'Easypaisa');

  const state = stateWithDue3000();
  assert.equal(balanceDueCents(state, 'a'), 300000);

  const result = claimSuspensePayment(state, entries, 'SUS-101', {
    customerId: 'a', month, date: today, execute: executeQuickCollection
  });

  // The due is cleared through the real allocation engine.
  assert.equal(balanceDueCents(result.nextState, 'a'), 0);
  // The suspense record is marked claimed and KEPT (audit), not deleted.
  assert.equal(result.entries.length, 1);
  assert.equal(result.entry.claimed, true);
  assert.equal(result.entry.claimedCustomerId, 'a');
  assert.equal(result.entry.claimedMonth, month);
  assert.ok(result.entry.claimedAt);
  // The recorded payment is a normal ledger payment: wallet method + TID.
  const bill = result.nextState.customers.find((c) => c.id === 'a').bills.find((b) => b.month === month);
  assert.equal(bill.payments.length, 1);
  assert.equal(bill.payments[0].method, 'Easypaisa');
  assert.equal(bill.payments[0].amount, 3000);
  assert.equal(normalizeTid(bill.payments[0].transactionId), normalizeTid('TXN 9001'));
  // A receipt is issued for the claim.
  const receipt = buildSuspenseReceipt({
    entry: result.entry, customerName: 'Customer 1', customerNumber: 1,
    month, receiptNumber: result.paymentReceipt?.receiptNumber ?? ''
  });
  assert.match(receipt.text, /Rs\. 3,000/);
  assert.match(receipt.text, /SUS-101/);
  assert.match(receipt.whatsappText, /Rs\. 3,000/);
});

test('logging validation: amount, wallet and date are required; wallet must be a digital wallet', () => {
  assert.throws(() => buildSuspenseFields({ amount: 0, wallet: 'Easypaisa', date: today }), /Amount is required/);
  assert.throws(() => buildSuspenseFields({ amount: -5, wallet: 'Easypaisa', date: today }), /Amount is required/);
  assert.throws(() => buildSuspenseFields({ amount: 100, wallet: 'Cash', date: today }), /Wallet is required/);
  assert.throws(() => buildSuspenseFields({ amount: 100, wallet: '', date: today }), /Wallet is required/);
  assert.throws(() => buildSuspenseFields({ amount: 100, wallet: 'Easypaisa', date: '' }), /Date is required/);
  assert.throws(() => buildSuspenseFields({ amount: 100, wallet: 'Easypaisa', date: '2026-02-30' }), /Date is required/);
  const fields = buildSuspenseFields({ amount: '1500.50', wallet: 'easy paisa', date: today, tid: ' X1 ' });
  assert.equal(fields.amount, 1500.5);
  assert.equal(fields.wallet, 'Easypaisa');
  assert.equal(fields.tid, 'X1');
});

test('duplicate TID on logging is refused under normalizeTid semantics; a hyphen makes a different TID', () => {
  const entries = [entry3000()];
  // Same TID with different spacing/case = same TID (SISP-21 rule).
  assert.throws(
    () => addSuspensePayment(entries, { amount: 500, wallet: 'JazzCash', tid: 'txn9001', date: today }),
    /already in the suspense register/
  );
  assert.throws(
    () => addSuspensePayment(entries, { amount: 500, wallet: 'JazzCash', tid: 'TXN9001', date: today }),
    /already in the suspense register/
  );
  // Hyphens are NOT stripped: TXN-9001 is a different TID and logs fine.
  const withHyphen = addSuspensePayment(entries, { amount: 500, wallet: 'JazzCash', tid: 'TXN-9001', date: today });
  assert.equal(withHyphen.length, 2);
  // Empty TIDs never collide.
  const noTid = addSuspensePayment(withHyphen, { amount: 100, wallet: 'Raast', tid: '', date: today });
  const noTid2 = addSuspensePayment(noTid, { amount: 200, wallet: 'Raast', tid: '', date: today });
  assert.equal(noTid2.length, 4);
  assert.equal(findSuspenseByTid(noTid2, '  txn 9001 ')?.suspenseId, 'SUS-101');
  assert.equal(findSuspenseByTid(noTid2, ''), null);
});

test('double-count guard: a TID already recorded as a customer payment cannot be claimed', () => {
  let state = stateWithDue3000();
  state = addPayment(state, 'b', month, {
    date: today, amount: 3000, method: 'Easypaisa', transactionId: 'TXN9001'
  });
  const entries = [entry3000()];
  assert.throws(
    () => claimSuspensePayment(state, entries, 'SUS-101', { customerId: 'a', month, date: today, execute: executeQuickCollection }),
    /already recorded as a payment/
  );
  // Nothing changed: entry still unclaimed, customer a still owes 3,000.
  assert.equal(entries[0].claimed, false);
  assert.equal(balanceDueCents(state, 'a'), 300000);
});

test('claim refusals: already claimed, unknown customer, archived customer', () => {
  const state = stateWithDue3000();
  const entries = [entry3000()];
  const claimed = claimSuspensePayment(state, entries, 'SUS-101', {
    customerId: 'a', month, date: today, execute: executeQuickCollection
  });
  assert.throws(
    () => claimSuspensePayment(claimed.nextState, claimed.entries, 'SUS-101', { customerId: 'b', month, date: today, execute: executeQuickCollection }),
    /already claimed/
  );
  assert.throws(
    () => claimSuspensePayment(state, entries, 'SUS-101', { customerId: 'nobody', month, date: today, execute: executeQuickCollection }),
    /Customer not found/
  );
  const archivedState = { customers: [customer('z', 9, { archived: true })] };
  assert.throws(
    () => claimSuspensePayment(archivedState, entries, 'SUS-101', { customerId: 'z', month, date: today, execute: executeQuickCollection }),
    /Archived customers/
  );
  assert.throws(
    () => claimSuspensePayment(state, entries, 'SUS-999', { customerId: 'a', month, date: today, execute: executeQuickCollection }),
    /not found/
  );
});

test('findPaymentsByTid (SISP-21 helper): normalizeTid match, voided payments ignored, empty TID matches nothing', () => {
  let state = stateWithDue3000();
  state = addPayment(state, 'a', month, {
    date: today, amount: 1200, method: 'JazzCash', transactionId: 'JC 555'
  });
  const found = findPaymentsByTid(state.customers, 'jc555');
  assert.equal(found.length, 1);
  assert.equal(found[0].customerName, 'Customer 1');
  assert.equal(found[0].amount, 1200);
  assert.equal(findPaymentsByTid(state.customers, '').length, 0);
  assert.equal(findPaymentsByTid(state.customers, 'JC-555').length, 0); // hyphen = different TID
  const voided = JSON.parse(JSON.stringify(state));
  voided.customers[0].bills[0].payments[0].voided = true;
  assert.equal(findPaymentsByTid(voided.customers, 'JC555').length, 0);
});

test('delete: unclaimed entries can be removed, claimed entries are audit history', () => {
  const entries = addSuspensePayment([entry3000()], { amount: 700, wallet: 'Raast', tid: 'R1', date: today });
  assert.equal(entries[1].suspenseId, 'SUS-102');
  const afterDelete = deleteSuspensePayment(entries, 'SUS-102');
  assert.equal(afterDelete.length, 1);
  const state = stateWithDue3000();
  const claimed = claimSuspensePayment(state, entries, 'SUS-101', {
    customerId: 'a', month, date: today, execute: executeQuickCollection
  });
  assert.throws(() => deleteSuspensePayment(claimed.entries, 'SUS-101'), /kept for audit/);
});

test('sanitize: malformed rows dropped, ids filled from SUS-101, summary + unclaimed views', () => {
  const clean = sanitizeSuspensePayments([
    { amount: 3000, wallet: 'Easypaisa', date: today, tid: 'A1' },
    { amount: -1, wallet: 'Easypaisa', date: today },
    { amount: 100, wallet: 'Cash', date: today },
    { amount: 100, wallet: 'Raast', date: 'not-a-date' },
    null,
    { amount: 250, wallet: 'JazzCash', date: today, claimed: true, claimedCustomerId: 'a' }
  ]);
  assert.equal(clean.length, 2);
  assert.equal(clean[0].suspenseId, 'SUS-101');
  assert.equal(clean[1].suspenseId, 'SUS-102');
  assert.equal(nextSuspenseId(clean), 'SUS-103');
  const summary = suspenseSummary(clean);
  assert.deepEqual(summary, { totalCount: 2, unclaimedCount: 1, unclaimedAmount: 3000, claimedCount: 1, claimedAmount: 250 });
  assert.equal(unclaimedSuspense(clean).length, 1);
  assert.equal(formatSuspensePKR(3000), 'Rs. 3,000');
  assert.equal(formatSuspensePKR(1500.5), 'Rs. 1,500.50');
});

test('storage round-trip under sisp_suspense_payments_v1', () => {
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v))
  };
  const entries = [entry3000()];
  assert.equal(saveSuspensePayments(entries, storage), true);
  assert.ok(store.has(SUSPENSE_PAYMENTS_KEY));
  const loaded = loadSuspensePayments(storage);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].tid, 'TXN 9001');
  assert.deepEqual(loadSuspensePayments({ getItem: () => '{broken', setItem: () => {} }), []);
});

test('backup safe-merge: suspense entries travel in settings.suspensePayments and restore only onto an empty device', () => {
  const entries = [entry3000()];
  const backupText = createJsonBackup(createInitialState(), new Date('2026-10-31T12:00:00+05:00'), { suspensePayments: entries });
  const parsed = JSON.parse(backupText);
  assert.equal(parsed.settings.suspensePayments.length, 1);
  assert.equal(parsed.settings.suspensePayments[0].suspenseId, 'SUS-101');

  const preview = previewJsonBackupMerge(createInitialState(), backupText);
  assert.equal(preview.suspensePayments.length, 1);
  assert.equal(preview.suspensePayments[0].amount, 3000);

  const other = [addSuspensePayment([], { amount: 900, wallet: 'Raast', tid: 'ZZ9', date: today })[0]];
  const clash = previewJsonBackupMerge(createInitialState(), backupText, { currentSuspensePayments: other, currentSuspensePaymentsStored: true });
  assert.equal(clash.suspensePayments, null);
  assert.ok(clash.conflicts.some((c) => c.field === 'Suspense payment records differ from this device'));

  const identical = previewJsonBackupMerge(createInitialState(), backupText, { currentSuspensePayments: entries, currentSuspensePaymentsStored: true });
  assert.equal(identical.suspensePayments, null);
  assert.equal(identical.conflicts.filter((c) => c.field.startsWith('Suspense')).length, 0);
});
