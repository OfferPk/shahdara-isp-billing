// FU1b: engine waiver-credit fix. calculatePaymentAllocations used to
// subtract the SISP-50 deposit offset but NEVER bill.referralCreditAmount
// (SISP-40) or bill.concessionAmount (SISP-30) — both are stamped onto the
// bill WITHOUT rewriting dueAmount (billing-cycle.js withReferralCredit,
// core.js applyConcessionToBill), and receipts + the Khata Doctor already
// subtracted them. The engine therefore kept a credit-settled bill
// 'partial' and arrearsAndAdvance carried the waived amount into the next
// cycle as phantom arrears (the customer was billed again for money
// already waived). These pins lock the invariant:
//   engine balance == receipt balance == Doctor balance
// for both waiver shapes, plus the partial and stacked-waiver guards.
// Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePaymentAllocations, derivedBillStatus } from '../core.js';
import { arrearsAndAdvance } from '../billing-cycle.js';
import { computeLedgerBalance, repairKhataDoctor, runKhataDoctor } from '../qa-khata-doctor.js';

const bill = (overrides = {}, payments = []) => ({
  id: 'bill-2026-10', month: '2026-10', dueAmount: 3000, dueDate: '2026-10-05',
  status: 'pending', generated: true, priceSnapshot: 3000, amountHistory: [],
  payments, ...overrides
});
const payment = (amount) => ({ id: 'p1', date: '2026-10-06', amount, method: 'Cash' });
const customer = (id, billRow) => ({ id, customerNumber: 1, name: `Synthetic ${id}`, bills: [billRow] });

function engineSummary(cust) {
  const allocations = calculatePaymentAllocations({ customers: [cust] });
  return { allocations, summary: allocations.forMonth(cust.id, '2026-10') };
}

test('referral scenario: credit 500 + cash 2,500 on a 3,000 bill settles in engine, status and Doctor', () => {
  const cust = customer('c-ref', bill({ referralCreditAmount: 500, referralCreditReason: 'Hamsaya Referral Credit' }, [payment(2500)]));
  const { allocations, summary } = engineSummary(cust);
  assert.equal(summary.balanceDueCents, 0);
  assert.equal(derivedBillStatus(cust, cust.bills[0], allocations), 'paid');
  // No phantom arrears leak into the next cycle.
  assert.equal(arrearsAndAdvance(cust, '2026-11').previousArrears, 0);
  const doctor = computeLedgerBalance(cust);
  assert.equal(doctor.balanceCents, 0);
  assert.equal(doctor.referralCreditsCents, 50000);
});

test('concession scenario: concession 300 + cash 2,700 on a 3,000 bill settles in engine, status and Doctor', () => {
  const cust = customer('c-con', bill({ concessionAmount: 300, concessionReason: 'Outage Reaayat' }, [payment(2700)]));
  const { allocations, summary } = engineSummary(cust);
  assert.equal(summary.balanceDueCents, 0);
  assert.equal(derivedBillStatus(cust, cust.bills[0], allocations), 'paid');
  assert.equal(arrearsAndAdvance(cust, '2026-11').previousArrears, 0);
  const doctor = computeLedgerBalance(cust);
  assert.equal(doctor.balanceCents, 0);
  assert.equal(doctor.concessionsCents, 30000);
});

test('Doctor Auto-Repair never touches a waiver-settled customer ledger', () => {
  const ref = customer('c-ref', bill({ referralCreditAmount: 500 }, [payment(2500)]));
  const con = customer('c-con', bill({ concessionAmount: 300 }, [payment(2700)]));
  const state = { customers: [ref, con] };
  const before = JSON.stringify(state);
  const report = runKhataDoctor(state, {});
  for (const id of ['c-ref', 'c-con']) {
    const row = report.customers.find((entry) => entry.customerId === id);
    assert.equal(row.ledgerBalanceCents, 0);
    assert.equal(row.issues.filter((entry) => entry.severity === 'error' || entry.severity === 'warning').length, 0);
  }
  const repaired = repairKhataDoctor(state, {});
  // Repair may only baseline the cache — the ledger rows stay byte-identical.
  assert.equal(JSON.stringify(repaired.state), before);
});

test('partial stays partial: credit 500 + cash 2,000 on a 3,000 bill leaves exactly 500 due everywhere', () => {
  const cust = customer('c-part', bill({ referralCreditAmount: 500 }, [payment(2000)]));
  const { allocations, summary } = engineSummary(cust);
  assert.equal(summary.balanceDueCents, 50000);
  assert.equal(derivedBillStatus(cust, cust.bills[0], allocations), 'partial');
  assert.equal(arrearsAndAdvance(cust, '2026-11').previousArrears, 500);
  assert.equal(computeLedgerBalance(cust).balanceCents, 50000);
});

test('stacked waivers never over-credit: full deposit offset + referral + cash leaves exactly the cash as credit', () => {
  const cust = customer('c-stack', bill({ depositOffsetAmount: 3000, referralCreditAmount: 500 }, [payment(2500)]));
  const { summary } = engineSummary(cust);
  assert.equal(summary.balanceDueCents, 0);
  assert.equal(summary.excessGeneratedCents, 250000);
  assert.equal(summary.pendingCreditCents, 250000);
  assert.equal(computeLedgerBalance(cust).balanceCents, 0);
});

test('feeder scenario (SISP-97 folded into the FU1b merge): credit 300 + cash 2,700 on a 3,000 bill settles in engine, status and Doctor', () => {
  const cust = customer('c-feed', bill({ feederHostCreditAmount: 300, feederHostCreditReason: 'Feeder Host Bijli Credit' }, [payment(2700)]));
  const { allocations, summary } = engineSummary(cust);
  assert.equal(summary.balanceDueCents, 0);
  assert.equal(derivedBillStatus(cust, cust.bills[0], allocations), 'paid');
  // No phantom arrears leak into the next cycle.
  assert.equal(arrearsAndAdvance(cust, '2026-11').previousArrears, 0);
  const doctor = computeLedgerBalance(cust);
  assert.equal(doctor.balanceCents, 0);
  assert.equal(doctor.feederHostCreditsCents, 30000);
});

test('voided payment never settles a waiver bill (SISP-34 still excluded)', () => {
  const voided = { ...payment(2500), voided: true };
  const cust = customer('c-void', bill({ referralCreditAmount: 500 }, [voided]));
  const { allocations, summary } = engineSummary(cust);
  assert.equal(summary.balanceDueCents, 250000);
  assert.equal(derivedBillStatus(cust, cust.bills[0], allocations), 'pending');
  assert.equal(computeLedgerBalance(cust).balanceCents, 250000);
});
