import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyLateFeeToBill,
  waiveLateFeeFromBill,
  applyLateFeeToEligibleBills,
  applyLateFeeToEligibleBillsWithReport
} from '../qa-discounts-late-fee.js';

// Sharafat 16: re-applying a late fee to a bill that already carries one is
// REFUSED (parent decision 2026-11-13) — never added on top, never silently
// overwritten. The refusal is surfaced: a throw from applyLateFeeToBill,
// a per-bill report from the batch path, a toast in the UI handlers.
// Fixture mirrors tests/discounts-late-fee.test.js (same module, same shape).
function createSampleState() {
  return {
    customers: [
      {
        id: 'cust-1',
        customerNumber: 101,
        name: 'Muhammad Tariq',
        phone: '03001234567',
        mohalla: 'Baradari',
        status: 'Active',
        bills: [
          {
            month: '2026-09',
            dueAmount: 1500,
            dueDate: '2026-09-05',
            payments: []
          }
        ]
      },
      {
        id: 'cust-2',
        customerNumber: 102,
        name: 'Zahid Khan',
        phone: '03217654321',
        mohalla: 'Jia Musa',
        status: 'Active',
        bills: [
          {
            month: '2026-09',
            dueAmount: 2000,
            dueDate: '2026-09-05',
            lateFee: 150,
            lateFeeAppliedAt: '2026-09-10T10:00:00Z',
            lateFeeReason: 'Overdue bill surcharge',
            payments: []
          }
        ]
      },
      {
        id: 'cust-3',
        customerNumber: 103,
        name: 'Rashid Ahmed',
        phone: '03331234567',
        mohalla: 'Baradari',
        status: 'Active',
        bills: [
          {
            month: '2026-09',
            dueAmount: 0,
            dueDate: '2026-09-05',
            firstMonthWaivedAmount: 1500,
            lateFee: 100,
            lateFeeAppliedAt: '2026-09-10T10:00:00Z',
            lateFeeReason: 'Overdue bill surcharge',
            payments: []
          }
        ]
      }
    ]
  };
}

const billOf = (state, customerId) =>
  state.customers.find(c => c.id === customerId).bills[0];

test('single apply is unchanged: a fee-free bill takes the fee', () => {
  const state = applyLateFeeToBill(createSampleState(), 'cust-1', '2026-09', { amount: 150, reason: 'Owner surcharge' });
  const bill = billOf(state, 'cust-1');
  assert.equal(bill.lateFee, 150);
  assert.equal(bill.lateFeeReason, 'Owner surcharge');
  assert.ok(bill.lateFeeAppliedAt);
  assert.equal(bill.amountHistory.length, 1);
  assert.equal(bill.amountHistory[0].type, 'late_fee_applied');
});

test('ACCEPTANCE: a second apply to a fee-carrying bill is refused, fee untouched', () => {
  let state = applyLateFeeToBill(createSampleState(), 'cust-1', '2026-09', { amount: 100, reason: 'First fee' });
  const before = billOf(state, 'cust-1');
  assert.equal(before.lateFee, 100);
  assert.equal(before.amountHistory.length, 1);

  // Sharafat 16: applying 100 then 200 must NOT leave 200 (overwrite) and
  // must NOT leave 300 (sum) — it refuses and the operator sees why.
  assert.throws(
    () => applyLateFeeToBill(state, 'cust-1', '2026-09', { amount: 200, reason: 'Second fee' }),
    /already has a late fee of PKR 100/
  );
  const after = billOf(state, 'cust-1');
  assert.equal(after.lateFee, 100, 'the first fee survives the refused re-apply');
  assert.equal(after.amountHistory.length, 1, 'no history entry is written for a refused re-apply');
  assert.equal(after.lateFeeAppliedAt, before.lateFeeAppliedAt, 'the original stamp is untouched');
  assert.equal(after.lateFeeReason, 'First fee');
});

test('ACCEPTANCE: a bill that already carries a fee refuses outright', () => {
  const state = createSampleState();
  assert.throws(
    () => applyLateFeeToBill(state, 'cust-2', '2026-09', { amount: 200, reason: 'Second fee' }),
    /already has a late fee of PKR 150/
  );
  assert.equal(billOf(state, 'cust-2').lateFee, 150, 'input state is never mutated');
});

test('waive then reapply still works: lateFee 0 is NOT an existing fee', () => {
  // Mirrors the late-fee-waiver.test.js waive→reapply pin (fee 150 → waived
  // → apply 200 → lateFee 200). The refuse guard tests Number(lateFee) > 0,
  // so a waived (0) fee never blocks a fresh apply.
  let state = applyLateFeeToBill(createSampleState(), 'cust-1', '2026-09', { amount: 150, reason: 'First fee' });
  state = waiveLateFeeFromBill(state, 'cust-1', '2026-09', { reason: 'Waived on request' });
  assert.equal(billOf(state, 'cust-1').lateFee, 0);
  state = applyLateFeeToBill(state, 'cust-1', '2026-09', { amount: 200, reason: 'Re-applied fee' });
  assert.equal(billOf(state, 'cust-1').lateFee, 200);
});

test('batch report: a mixed batch applies the fresh bill and reports the fee-carrying skip', () => {
  const report = applyLateFeeToEligibleBillsWithReport(createSampleState(), [
    { customerId: 'cust-2', month: '2026-09' },
    { customerId: 'cust-1', month: '2026-09' }
  ], { amount: 100, reason: 'Batch fee' });
  assert.equal(report.applied.length, 1);
  assert.deepEqual(report.applied[0], { customerId: 'cust-1', month: '2026-09' });
  assert.equal(report.skipped.length, 1);
  assert.equal(report.skipped[0].code, 'already-has-fee');
  assert.equal(report.skipped[0].existingFee, 150);
  assert.match(report.skipped[0].reason, /already has a late fee of PKR 150/);
  assert.equal(billOf(report.state, 'cust-1').lateFee, 100, 'the fresh bill got its fee');
  assert.equal(billOf(report.state, 'cust-2').lateFee, 150, 'the fee-carrying bill is untouched');
});

test('batch report: when every selected bill already has a fee, nothing is applied', () => {
  const report = applyLateFeeToEligibleBillsWithReport(createSampleState(), [
    { customerId: 'cust-2', month: '2026-09' }
  ], { amount: 100, reason: 'Batch fee' });
  assert.equal(report.applied.length, 0);
  assert.equal(report.skipped.length, 1);
  assert.equal(report.skipped[0].code, 'already-has-fee');
  assert.equal(billOf(report.state, 'cust-2').lateFee, 150);
});

test('batch report: a duplicate key in one batch cannot double-apply', () => {
  const report = applyLateFeeToEligibleBillsWithReport(createSampleState(), [
    { customerId: 'cust-1', month: '2026-09' },
    { customerId: 'cust-1', month: '2026-09' }
  ], { amount: 100, reason: 'Batch fee' });
  assert.equal(report.applied.length, 1);
  assert.equal(report.skipped.length, 1);
  assert.equal(report.skipped[0].code, 'already-has-fee');
  assert.equal(billOf(report.state, 'cust-1').lateFee, 100, 'the second occurrence sees the fee the first one applied');
});

test('batch report: a missing bill is reported as a skip, never swallowed', () => {
  const report = applyLateFeeToEligibleBillsWithReport(createSampleState(), [
    { customerId: 'cust-1', month: '2026-10' }
  ], { amount: 100, reason: 'Batch fee' });
  assert.equal(report.applied.length, 0);
  assert.equal(report.skipped.length, 1);
  assert.equal(report.skipped[0].code, 'other');
  assert.match(report.skipped[0].reason, /not found/);
});

test('batch report: an invalid key is reported, and empty input returns an empty report', () => {
  const bad = applyLateFeeToEligibleBillsWithReport(createSampleState(), [
    { customerId: 'cust-1' }
  ], { amount: 100, reason: 'Batch fee' });
  assert.equal(bad.applied.length, 0);
  assert.equal(bad.skipped.length, 1);
  assert.equal(bad.skipped[0].code, 'invalid-key');

  const state = createSampleState();
  const empty = applyLateFeeToEligibleBillsWithReport(state, [], { amount: 100, reason: 'Batch fee' });
  assert.equal(empty.state, state, 'empty input returns the input state untouched');
  assert.deepEqual(empty.applied, []);
  assert.deepEqual(empty.skipped, []);
});

test('batch wrapper still returns state only (existing callers and tests unchanged)', () => {
  const state = applyLateFeeToEligibleBills(createSampleState(), [
    { customerId: 'cust-2', month: '2026-09' },
    { customerId: 'cust-1', month: '2026-09' }
  ], { amount: 100, reason: 'Batch fee' });
  assert.equal(typeof state, 'object');
  assert.equal('applied' in state, false, 'the wrapper returns state, not a report');
  assert.equal(billOf(state, 'cust-1').lateFee, 100);
  assert.equal(billOf(state, 'cust-2').lateFee, 150);
});

test('guard order: the tagged first-month refusal still takes precedence over the re-apply refusal', () => {
  // Polish #23: a tagged month cannot take a late fee at all. The tagged
  // check runs before the Sharafat 16 guard, so a tagged bill that somehow
  // still carries a fee reports the tagged-month error, not the re-apply one.
  assert.throws(
    () => applyLateFeeToBill(createSampleState(), 'cust-3', '2026-09', { amount: 200, reason: 'Second fee' }),
    /tagged as the first month free/
  );
});

test('a string-stored fee still counts as an existing fee', () => {
  const state = createSampleState();
  billOf(state, 'cust-1').lateFee = '150';
  assert.throws(
    () => applyLateFeeToBill(state, 'cust-1', '2026-09', { amount: 200, reason: 'Second fee' }),
    /already has a late fee of PKR 150/
  );
});
