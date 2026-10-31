// SISP-111: Cross-Customer Advance Credit Transfer (credit-transfer.js).
// Money-critical: value moves between two customers' ledgers with NO
// cash movement. Pure-function + engine/doctor/receipt/backup tests on
// synthetic data only — no real customer names.
// Spec test criterion (verbatim): "Transferring Rs. 2,000 advance
// credit from Customer A to Customer B reduces A's advanceCredit by
// Rs. 2,000, reduces B's pending due by Rs. 2,000, and leaves cash
// drawer unchanged."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CREDIT_TRANSFERS_KEY,
  availableCreditCents,
  availableCreditSources,
  creditTransferSummary,
  executeCreditTransfer,
  formatTransferPKR,
  loadCreditTransfers,
  nextCreditTransferId,
  pendingBillBalances,
  reverseCreditTransfer,
  sanitizeCreditTransfers,
  saveCreditTransfers,
  transfersForCustomer
} from '../credit-transfer.js';
import {
  buildMonthlyReport,
  calculatePaymentAllocations,
  createInitialState,
  createJsonBackup,
  derivedBillStatus,
  previewJsonBackupMerge
} from '../core.js';
import { computeLedgerBalance } from '../qa-khata-doctor.js';
import { buildRoznamchaDay, buildMonthEndCashInHand } from '../roznamcha.js';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import { creditTransferPresentation } from '../profile-ui.js';
import { TRANSLATIONS } from '../nav-language.js';
import { readFileSync } from 'node:fs';

const TRANSFER_DATE = '2026-10-29';

// Customer A: September bill 3,000, paid 5,000 cash -> 2,000 advance credit.
const sourceCustomer = (overrides = {}) => ({
  id: 'cust-a',
  customerNumber: 11,
  name: 'Source Eleven',
  monthlyPriceSchedule: [],
  serviceStatusHistory: [],
  packageHistory: [],
  relocationLog: [],
  installmentPlans: [],
  incidents: [],
  bills: [{
    id: 'bill-a-sep',
    month: '2026-09',
    dueAmount: 3000,
    status: 'pending',
    payments: [{ id: 'pay-a-1', amount: 5000, date: '2026-09-05', method: 'Cash' }]
  }],
  ...overrides
});

// Customer B: October bill 3,000, nothing paid.
const targetCustomer = (overrides = {}) => ({
  id: 'cust-b',
  customerNumber: 22,
  name: 'Target Twentytwo',
  monthlyPriceSchedule: [],
  serviceStatusHistory: [],
  packageHistory: [],
  relocationLog: [],
  installmentPlans: [],
  incidents: [],
  bills: [{
    id: 'bill-b-oct',
    month: '2026-10',
    dueAmount: 3000,
    status: 'pending',
    payments: []
  }],
  ...overrides
});

const stateOf = (...customers) => ({ customers });
const allocationsOf = (...customers) => calculatePaymentAllocations(stateOf(...customers));
const unappliedOf = (allocations, paymentId) => allocations.byPaymentId.get(paymentId)?.unappliedCreditCents;
const dueOf = (allocations, customerId, month) => allocations.forMonth(customerId, month)?.balanceDueCents;

function doTransfer({ from = sourceCustomer(), to = targetCustomer(), amount = 2000, date = TRANSFER_DATE, transfers = [] } = {}) {
  const allocations = allocationsOf(from, to);
  return executeCreditTransfer({ fromCustomer: from, toCustomer: to, allocations, transfers, amount, date });
}

test('SISP-111 spec pin: Rs 2,000 transfer cuts A credit by 2,000, B due by 2,000, drawer unchanged', () => {
  const from = sourceCustomer();
  const to = targetCustomer();
  const stateBefore = stateOf(from, to);
  const drawerBeforeSep = buildRoznamchaDay(stateBefore, [], '2026-09-05', []);
  const drawerBeforeOct = buildRoznamchaDay(stateBefore, [], TRANSFER_DATE, []);
  const cashBefore = buildMonthEndCashInHand(stateBefore, [], '2026-10', []);

  const before = allocationsOf(from, to);
  assert.equal(availableCreditCents(before, 'cust-a', '2026-10'), 200000);
  assert.equal(dueOf(before, 'cust-b', '2026-10'), 300000);

  const { fromCustomer, toCustomer: updatedTo, transfer, transfers } = doTransfer({ from, to });
  assert.equal(transfer.transferId, 'TRF-101');
  assert.equal(transfer.status, 'active');
  assert.equal(transfer.amount, 2000);
  assert.deepEqual(transfer.consumedFrom, [{ paymentId: 'pay-a-1', month: '2026-09', amount: 2000 }]);
  assert.deepEqual(transfer.appliedTo, [{ month: '2026-10', amount: 2000 }]);
  assert.equal(transfers.length, 1);

  const after = allocationsOf(fromCustomer, updatedTo);
  // A's advance credit: 2,000 -> 0. The source payment record itself
  // is untouched (still a 5,000 cash receipt on A's September bill).
  assert.equal(unappliedOf(after, 'pay-a-1'), 0);
  assert.equal(after.byPaymentId.get('pay-a-1').creditTransferredOutCents, 200000);
  assert.equal(fromCustomer.bills[0].payments[0].amount, 5000);
  assert.equal(fromCustomer.bills[0].payments.length, 1);
  // B's pending due: 3,000 -> 1,000, satisfied by the bill stamp, and
  // NO payment record was fabricated on B's bill.
  assert.equal(dueOf(after, 'cust-b', '2026-10'), 100000);
  assert.equal(updatedTo.bills[0].creditTransferInAmount, 2000);
  assert.equal(updatedTo.bills[0].payments.length, 0);
  // Drawer neutrality: roznamcha figures byte-identical on both the
  // original payment day and the transfer day, and month-end cash.
  const stateAfter = stateOf(fromCustomer, updatedTo);
  assert.deepEqual(buildRoznamchaDay(stateAfter, [], '2026-09-05', []), drawerBeforeSep);
  assert.deepEqual(buildRoznamchaDay(stateAfter, [], TRANSFER_DATE, []), drawerBeforeOct);
  assert.deepEqual(buildMonthEndCashInHand(stateAfter, [], '2026-10', []), cashBefore);
  // Inputs were never mutated (pure executor).
  assert.equal(from.bills[0].creditTransferOut, undefined);
  assert.equal(to.bills[0].creditTransferInAmount, undefined);
});

test('SISP-111: revenue neutrality — collections and method totals do not move', () => {
  const from = sourceCustomer();
  const to = targetCustomer();
  const totals = (state, month) => buildMonthlyReport(state, { month }, new Date('2026-11-15T00:00:00Z'))
    .reduce((sum, row) => sum + (row.amountReceived || 0), 0);
  const sepBefore = totals(stateOf(from, to), '2026-09');
  const octBefore = totals(stateOf(from, to), '2026-10');
  assert.equal(sepBefore, 5000);
  assert.equal(octBefore, 0);
  const { fromCustomer, toCustomer: updatedTo } = doTransfer({ from, to });
  const stateAfter = stateOf(fromCustomer, updatedTo);
  assert.equal(totals(stateAfter, '2026-09'), sepBefore);
  assert.equal(totals(stateAfter, '2026-10'), octBefore);
  // The report's derived figures DO move exactly by the transfer:
  // B's October balance due 3,000 -> 1,000, A's pending credit 2,000 -> 0.
  const octRows = buildMonthlyReport(stateAfter, { month: '2026-10' }, new Date('2026-11-15T00:00:00Z'));
  assert.equal(octRows.find((r) => r.customerId === 'cust-b').balanceDue, 1000);
  const sepRows = buildMonthlyReport(stateAfter, { month: '2026-09' }, new Date('2026-11-15T00:00:00Z'));
  assert.equal(sepRows.find((r) => r.customerId === 'cust-a').creditPending, 0);
});

test('SISP-111: full coverage settles B as paid; Khata Doctor agrees with the engine on both sides', () => {
  const from = sourceCustomer();
  const to = targetCustomer({
    bills: [{ id: 'bill-b-oct', month: '2026-10', dueAmount: 2000, status: 'pending', payments: [] }]
  });
  const { fromCustomer, toCustomer: updatedTo } = doTransfer({ from, to });
  const after = allocationsOf(fromCustomer, updatedTo);
  assert.equal(dueOf(after, 'cust-b', '2026-10'), 0);
  assert.equal(derivedBillStatus(updatedTo, updatedTo.bills[0], after), 'paid');
  // Doctor: B's balance dropped by exactly the transfer; A's balance
  // is unchanged (0) while its carried credit fell by the transfer.
  const doctorB = computeLedgerBalance(updatedTo);
  assert.equal(doctorB.balanceCents, 0);
  assert.equal(doctorB.creditTransfersInCents, 200000);
  const doctorA = computeLedgerBalance(fromCustomer);
  assert.equal(doctorA.balanceCents, 0);
  assert.equal(doctorA.creditCents, 0);
  assert.equal(doctorA.creditTransfersOutCents, 200000);
  assert.equal(doctorA.paymentsCents, 500000);
});

test('SISP-111: partial coverage keeps the exact remainder due (house offset-status rule)', () => {
  const { toCustomer: updatedTo } = doTransfer({});
  const after = allocationsOf(sourceCustomer(), updatedTo);
  assert.equal(dueOf(after, 'cust-b', '2026-10'), 100000);
  // Same rule as the SISP-50 deposit offset: the balance is exact,
  // and the derived label stays 'pending' until cash or carried
  // credit also applies — 'paid' the moment the balance reaches 0.
  assert.equal(derivedBillStatus(updatedTo, updatedTo.bills[0], after), 'pending');
  assert.equal(computeLedgerBalance(updatedTo).balanceCents, 100000);
});

test('SISP-111: refusals — over-credit, over-due, zero/negative, same customer, archived, FREE, no due', () => {
  const from = sourceCustomer();
  const to = targetCustomer();
  const attempt = (patch) => () => doTransfer({ from, to, ...patch });
  assert.throws(attempt({ amount: 2001 }), /exceeds the available advance credit/);
  assert.throws(attempt({ amount: 0 }), /greater than zero/);
  assert.throws(attempt({ amount: -500 }), /greater than zero/);
  assert.throws(attempt({ amount: 'abc' }), /greater than zero/);
  assert.throws(attempt({ date: '2026-13-40' }), /valid transfer date/);
  // Over the target's due but within A's credit: A with 5,000 credit.
  const richFrom = sourceCustomer({
    bills: [{ id: 'bill-a-sep', month: '2026-09', dueAmount: 3000, status: 'pending', payments: [{ id: 'pay-a-1', amount: 8000, date: '2026-09-05', method: 'Cash' }] }]
  });
  assert.throws(() => doTransfer({ from: richFrom, to, amount: 3001 }), /exceeds the target's pending due/);
  // Same customer.
  assert.throws(() => doTransfer({ from, to: from }), /different customers/);
  // Archived on either side.
  assert.throws(() => doTransfer({ from: sourceCustomer({ archived: true }), to }), /Archived customers hold no transferable credit/);
  assert.throws(() => doTransfer({ from, to: targetCustomer({ archived: true }) }), /Archived customers cannot receive/);
  // FREE on either side.
  assert.throws(() => doTransfer({ from: sourceCustomer({ isFreeConnection: true }), to }), /Free connections hold no advance credit/);
  assert.throws(() => doTransfer({ from, to: targetCustomer({ isFreeConnection: true }) }), /Free connections never carry a pending bill/);
  // Target with no pending due (already fully paid in cash).
  const paidTo = targetCustomer({
    bills: [{ id: 'bill-b-oct', month: '2026-10', dueAmount: 3000, status: 'pending', payments: [{ id: 'pay-b-1', amount: 3000, date: '2026-10-03', method: 'Cash' }] }]
  });
  assert.throws(() => doTransfer({ from, to: paidTo }), /no pending bill to settle/);
});

test('SISP-111: multi-bill distribution — target oldest first, source drawn across payments oldest first', () => {
  const from = sourceCustomer({
    bills: [
      { id: 'bill-a-aug', month: '2026-08', dueAmount: 3000, status: 'pending', payments: [{ id: 'pay-a-0', amount: 4000, date: '2026-08-05', method: 'Cash' }] },
      { id: 'bill-a-sep', month: '2026-09', dueAmount: 3000, status: 'pending', payments: [{ id: 'pay-a-1', amount: 4500, date: '2026-09-05', method: 'Cash' }] }
    ]
  });
  // A credit: Aug payment leaves 1,000, applied to Sep bill; Sep
  // payment 4,500 covers Sep's remaining 2,000 -> 2,500 unapplied.
  const to = targetCustomer({
    bills: [
      { id: 'bill-b-sep', month: '2026-09', dueAmount: 1500, status: 'pending', payments: [] },
      { id: 'bill-b-oct', month: '2026-10', dueAmount: 3000, status: 'pending', payments: [] }
    ]
  });
  const before = allocationsOf(from, to);
  assert.equal(availableCreditCents(before, 'cust-a', '2026-10'), 250000);
  const { fromCustomer, toCustomer: updatedTo, transfer } = doTransfer({ from, to, amount: 2000 });
  assert.deepEqual(transfer.consumedFrom, [{ paymentId: 'pay-a-1', month: '2026-09', amount: 2000 }]);
  assert.deepEqual(transfer.appliedTo, [{ month: '2026-09', amount: 1500 }, { month: '2026-10', amount: 500 }]);
  const after = allocationsOf(fromCustomer, updatedTo);
  assert.equal(unappliedOf(after, 'pay-a-1'), 50000);
  assert.equal(dueOf(after, 'cust-b', '2026-09'), 0);
  assert.equal(dueOf(after, 'cust-b', '2026-10'), 250000);
  assert.equal(computeLedgerBalance(updatedTo).balanceCents, 250000);
  assert.equal(computeLedgerBalance(fromCustomer).creditCents, 50000);
});

test('SISP-111: transferred credit cannot be spent twice — a later source bill only sees what is left', () => {
  const { fromCustomer } = doTransfer({});
  // November bill arrives for A after the transfer: no phantom
  // credit may cover it.
  const withNovember = {
    ...fromCustomer,
    bills: [...fromCustomer.bills, { id: 'bill-a-nov', month: '2026-11', dueAmount: 3000, status: 'pending', payments: [] }]
  };
  const after = allocationsOf(withNovember);
  assert.equal(dueOf(after, 'cust-a', '2026-11'), 300000);
  assert.equal(computeLedgerBalance(withNovember).balanceCents, 300000);
  assert.equal(computeLedgerBalance(withNovember).creditCents, 0);
});

test('SISP-111: credit reserved for a future month (advance targeting) cannot transfer early', () => {
  const from = sourceCustomer({
    bills: [{
      id: 'bill-a-sep',
      month: '2026-09',
      dueAmount: 3000,
      status: 'pending',
      payments: [{ id: 'pay-a-1', amount: 5000, date: '2026-09-05', method: 'Cash', kind: 'advance', targetMonth: '2026-12' }]
    }]
  });
  const to = targetCustomer();
  const allocations = allocationsOf(from, to);
  // The raw ledger holds the credit, but it is reserved for December.
  assert.equal(unappliedOf(allocations, 'pay-a-1'), 200000);
  assert.equal(availableCreditCents(allocations, 'cust-a', '2026-10'), 0);
  assert.throws(() => doTransfer({ from, to, date: '2026-10-29' }), /exceeds the available advance credit/);
  // Once December arrives the same credit transfers normally.
  const decemberTo = targetCustomer({
    bills: [{ id: 'bill-b-dec', month: '2026-12', dueAmount: 3000, status: 'pending', payments: [] }]
  });
  const result = executeCreditTransfer({
    fromCustomer: from,
    toCustomer: decemberTo,
    allocations: allocationsOf(from, decemberTo),
    transfers: [],
    amount: 2000,
    date: '2026-12-05'
  });
  assert.equal(result.transfer.status, 'active');
});

test('SISP-111: reversal restores both customers exactly and flips the register status', () => {
  const from = sourceCustomer();
  const to = targetCustomer();
  const { fromCustomer, toCustomer: updatedTo, transfers } = doTransfer({ from, to });
  const reversed = reverseCreditTransfer({
    transfers,
    transferId: 'TRF-101',
    fromCustomer,
    toCustomer: updatedTo,
    date: '2026-10-30',
    note: 'Recorded against the wrong relative.'
  });
  assert.equal(reversed.transfer.status, 'reversed');
  assert.equal(reversed.transfer.reversedAt, '2026-10-30');
  assert.equal(reversed.transfer.reversalNote, 'Recorded against the wrong relative.');
  // Register keeps the record (never deleted).
  assert.equal(reversed.transfers.length, 1);
  // Both sides derive exactly as before the transfer.
  const after = allocationsOf(reversed.fromCustomer, reversed.toCustomer);
  assert.equal(unappliedOf(after, 'pay-a-1'), 200000);
  assert.equal(after.byPaymentId.get('pay-a-1').creditTransferredOutCents, undefined);
  assert.equal(dueOf(after, 'cust-b', '2026-10'), 300000);
  // Stamps are gone; the audit trail remains in amountHistory.
  assert.equal(reversed.fromCustomer.bills[0].creditTransferOut, undefined);
  assert.equal(reversed.toCustomer.bills[0].creditTransferInAmount, undefined);
  assert.equal(reversed.fromCustomer.bills[0].amountHistory.at(-1).type, 'credit_transfer_reversed_out');
  assert.equal(reversed.toCustomer.bills[0].amountHistory.at(-1).type, 'credit_transfer_reversed_in');
  assert.equal(computeLedgerBalance(reversed.fromCustomer).creditCents, 200000);
  assert.equal(computeLedgerBalance(reversed.toCustomer).balanceCents, 300000);
  // A second reversal of the same record is refused.
  assert.throws(() => reverseCreditTransfer({
    transfers: reversed.transfers,
    transferId: 'TRF-101',
    fromCustomer: reversed.fromCustomer,
    toCustomer: reversed.toCustomer,
    date: '2026-10-31'
  }), /already reversed/);
});

test('SISP-111: reversal refuses when a stamp no longer matches the register (ledger changed)', () => {
  const { fromCustomer, toCustomer: updatedTo, transfers } = doTransfer({});
  // Tamper with the target stamp.
  const tamperedTo = {
    ...updatedTo,
    bills: updatedTo.bills.map((bill) => ({ ...bill, creditTransferInAmount: 500 }))
  };
  assert.throws(() => reverseCreditTransfer({
    transfers, transferId: 'TRF-101', fromCustomer, toCustomer: tamperedTo, date: '2026-10-30'
  }), /no longer covers the recorded share/);
  // Remove the source stamp list.
  const tamperedFrom = {
    ...fromCustomer,
    bills: fromCustomer.bills.map((bill) => ({ ...bill, creditTransferOut: [] }))
  };
  assert.throws(() => reverseCreditTransfer({
    transfers, transferId: 'TRF-101', fromCustomer: tamperedFrom, toCustomer: updatedTo, date: '2026-10-30'
  }), /no longer recorded exactly/);
  // Archived customer blocks reversal until unarchived.
  assert.throws(() => reverseCreditTransfer({
    transfers, transferId: 'TRF-101', fromCustomer, toCustomer: { ...updatedTo, archived: true }, date: '2026-10-30'
  }), /archived customer cannot be reversed/);
});

test('SISP-111: register ids, sanitize, storage round trip, summary', () => {
  assert.equal(nextCreditTransferId([]), 'TRF-101');
  const { transfers } = doTransfer({});
  assert.equal(nextCreditTransferId(transfers), 'TRF-102');
  // Malformed rows are dropped; a valid row survives with defaults.
  const dirty = sanitizeCreditTransfers([
    null,
    { amount: -5 },
    { transferId: 'TRF-109', fromCustomerId: 'x', toCustomerId: 'x', amount: 100, date: '2026-10-01', consumedFrom: [{ paymentId: 'p', month: '2026-09', amount: 100 }], appliedTo: [{ month: '2026-10', amount: 100 }] },
    { transferId: 'TRF-107', fromCustomerId: 'x', toCustomerId: 'y', amount: 100, date: '2026-10-01', consumedFrom: [{ paymentId: 'p', month: '2026-09', amount: 100 }], appliedTo: [{ month: '2026-10', amount: 100 }] },
    transfers[0],
    { fromCustomerId: 'a', toCustomerId: 'b', amount: 700, date: '2026-10-02', consumedFrom: [{ paymentId: 'p9', month: '2026-09', amount: 700 }], appliedTo: [{ month: '2026-10', amount: 700 }] }
  ]);
  // Dropped: the null row, the negative row, and the same-customer row.
  assert.equal(dirty.length, 3);
  assert.equal(dirty[0].transferId, 'TRF-107');
  assert.equal(dirty[1].transferId, 'TRF-101');
  assert.equal(dirty[1].status, 'active');
  // The id-less row is filled with the first free id in stored order.
  assert.equal(dirty[2].transferId, 'TRF-102');
  // Storage round trip through a fake store.
  const backing = new Map();
  const fakeStorage = {
    getItem: (k) => (backing.has(k) ? backing.get(k) : null),
    setItem: (k, v) => backing.set(k, String(v))
  };
  assert.equal(saveCreditTransfers(transfers, fakeStorage), true);
  assert.ok(backing.has(CREDIT_TRANSFERS_KEY));
  assert.deepEqual(loadCreditTransfers(fakeStorage), sanitizeCreditTransfers(transfers));
  // Summary + per-customer history.
  const summary = creditTransferSummary(transfers);
  assert.deepEqual(summary, { totalCount: 1, activeCount: 1, activeAmount: 2000, reversedCount: 0, reversedAmount: 0 });
  assert.equal(transfersForCustomer(transfers, 'cust-a').length, 1);
  assert.equal(transfersForCustomer(transfers, 'cust-b').length, 1);
  assert.equal(transfersForCustomer(transfers, 'cust-other').length, 0);
});

test('SISP-111: backup carries the register (house sibling safe-merge)', () => {
  const from = sourceCustomer();
  const to = targetCustomer();
  const { fromCustomer, toCustomer: updatedTo, transfers } = doTransfer({ from, to });
  const state = { ...createInitialState(), customers: [fromCustomer, updatedTo] };
  const backupText = createJsonBackup(state, new Date('2026-10-29T12:00:00Z'), { creditTransfers: transfers });
  const backup = backupText;
  assert.deepEqual(JSON.parse(backupText).settings.creditTransfers, sanitizeCreditTransfers(transfers));
  // Adopted when the device holds none.
  const adopted = previewJsonBackupMerge(state, backup, { currentCreditTransfers: [], currentCreditTransfersStored: false });
  assert.deepEqual(adopted.creditTransfers, sanitizeCreditTransfers(transfers));
  assert.equal(adopted.counts.creditTransfersRestored, 1);
  // Identical on both sides: nothing to restore, no conflict.
  const identical = previewJsonBackupMerge(state, backup, { currentCreditTransfers: transfers, currentCreditTransfersStored: true });
  assert.equal(identical.creditTransfers, null);
  assert.equal(identical.conflicts.some((c) => /Credit transfer/.test(c.field)), false);
  // Different entries on both sides: keep local + conflict.
  const other = [{ ...transfers[0], transferId: 'TRF-140', amount: 900 }];
  const conflicted = previewJsonBackupMerge(state, backup, { currentCreditTransfers: other, currentCreditTransfersStored: true });
  assert.equal(conflicted.creditTransfers, null);
  assert.equal(conflicted.conflicts.some((c) => /Credit transfer/.test(c.field)), true);
  // Bill stamps travel with the customers and are not conflicts when
  // only the backup has them (the merge adopts non-empty fields).
  const bareState = { ...createInitialState(), customers: [sourceCustomer(), targetCustomer()] };
  const merged = previewJsonBackupMerge(bareState, backup, { currentCreditTransfers: [], currentCreditTransfersStored: false });
  const mergedB = merged.state.customers.find((c) => c.id === 'cust-b');
  assert.equal(mergedB.bills[0].creditTransferInAmount, 2000);
  const mergedA = merged.state.customers.find((c) => c.id === 'cust-a');
  assert.equal(mergedA.bills[0].creditTransferOut.length, 1);
});

test('SISP-111: B receipt prints the transfer-in as its own line, never as a payment', () => {
  const to = targetCustomer({
    bills: [{
      id: 'bill-b-oct',
      month: '2026-10',
      dueAmount: 3000,
      status: 'pending',
      payments: [{ id: 'pay-b-1', amount: 1000, date: '2026-10-20', method: 'Cash' }]
    }]
  });
  const from = sourceCustomer();
  const { toCustomer: updatedTo } = doTransfer({ from, to });
  const bill = updatedTo.bills[0];
  const receipt = buildPaymentReceipt(updatedTo, bill, bill.payments[0]);
  assert.equal(receipt.creditTransferInAmount, 2000);
  assert.equal(receipt.paidAmount, 1000);
  // Balance: 3,000 - 2,000 transfer - 1,000 cash = 0 -> PAID seal.
  assert.equal(receipt.balanceDueCents, 0);
  assert.equal(receipt.status, 'PAID');
  const html = generatePaymentReceiptHtml(receipt);
  assert.match(html, /Advance Credit Transfer/);
  assert.match(html, /ایڈوانس کریڈٹ ٹرانسفر/);
});

test('SISP-111: profile presentation labels both directions and gates the transfer button', () => {
  const { fromCustomer, toCustomer: updatedTo, transfers } = doTransfer({});
  const sourceView = creditTransferPresentation(fromCustomer, transfers, 0);
  assert.equal(sourceView.visible, true);
  assert.equal(sourceView.canTransfer, false); // credit fully consumed
  assert.equal(sourceView.rows.length, 1);
  assert.equal(sourceView.rows[0].outgoing, true);
  assert.match(sourceView.rows[0].label, /Target Twentytwo/);
  const targetView = creditTransferPresentation(updatedTo, transfers, 0);
  assert.equal(targetView.rows[0].outgoing, false);
  assert.match(targetView.rows[0].label, /Source Eleven/);
  // A fresh source with live credit can transfer.
  const ready = creditTransferPresentation(sourceCustomer(), [], 2000);
  assert.equal(ready.canTransfer, true);
  assert.equal(ready.visible, true);
  // FREE / archived customers never see the action.
  assert.equal(creditTransferPresentation(sourceCustomer({ isFreeConnection: true }), [], 2000).canTransfer, false);
  assert.equal(creditTransferPresentation(sourceCustomer({ archived: true }), [], 2000).canTransfer, false);
  // Nothing to show and nothing to offer: section hidden.
  assert.equal(creditTransferPresentation(targetCustomer(), [], 0).visible, false);
});

test('SISP-111: every trf_ key used in code exists in BOTH language dictionaries', () => {
  const sources = ['credit-transfer.js', 'profile-ui.js', 'app.js']
    .map((file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'))
    .join('\n');
  const used = new Set([...sources.matchAll(/t\('(trf_[a-z_]+)'/g)].map((m) => m[1]));
  assert.ok(used.size >= 10, `expected at least 10 trf_ keys in use, found ${used.size}`);
  for (const key of used) {
    assert.ok(TRANSLATIONS.en[key], `missing en translation: ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `missing ur translation: ${key}`);
  }
  // The dialog's static labels use data-i18n with the same key set.
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const dialogKeys = new Set([...html.matchAll(/data-i18n="(trf_[a-z_]+)"/g)].map((m) => m[1]));
  assert.ok(dialogKeys.size >= 5);
  for (const key of dialogKeys) {
    assert.ok(TRANSLATIONS.en[key], `missing en translation: ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `missing ur translation: ${key}`);
  }
  assert.equal(formatTransferPKR(2000), 'Rs. 2,000');
  // Sanity: pendingBillBalances is the same source the modal lists.
  assert.deepEqual(pendingBillBalances(allocationsOf(targetCustomer()), targetCustomer()), [{ month: '2026-10', balanceDueCents: 300000 }]);
  assert.deepEqual(availableCreditSources(allocationsOf(sourceCustomer()), 'cust-a', '2026-10').map((s) => s.amountCents), [200000]);
});
