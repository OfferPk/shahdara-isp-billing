/**
 * sharafat-11-corrupt-payment-amount.test.js — Sharafat 11 of the
 * Sharafat 1–100 polish batch (Billing, Ledger & History).
 *
 * The operator's case: one payment amount imported via backup/CSV is
 * not a number ("abc"). moneyCents("abc") is NaN, and a single NaN
 * used to poison that customer's whole allocation summary —
 * actualReceiptsCents NaN, balanceDueCents NaN, the bill reading
 * 'pending' with the full due even though cash was received.
 *
 * The fix: inside calculatePaymentAllocations only, every amount read
 * is treated as 0 when it is not finite, so the bad row stays but its
 * amount can never propagate NaN — and it is skipped from credit
 * generation. moneyCents itself is NOT hardened (~50 callers), and
 * the row is NOT dropped (Sharafat 10's skip-the-record rule is a
 * different surface — the picker pool, not the ledger).
 *
 * Pins:
 *  - acceptance: a priced bill with one "abc" payment + one healthy
 *    payment computes the healthy figures only; the bad row generates
 *    no credit; every figure is finite; the other customer is
 *    unaffected;
 *  - the same guard on the unpriced branch (bad row generates no
 *    credit there either), on an overpayment (only the healthy
 *    excess becomes credit), on a non-numeric lateFee and on a
 *    non-numeric concession offset (both used to NaN
 *    balanceDueCents the same way);
 *  - a non-numeric discount applies no discount and stays finite;
 *  - a corrupt ticket-charge line amount reads as a 0 charge — the
 *    line sanitizer already throws and the *LinesOf wrapper catches
 *    it, so the charge helpers needed no change here (pin of
 *    pre-existing behaviour, not of this fix);
 *  - the bad payment row STAYS in byPaymentId (it is not dropped);
 *    its ledger amount is left as Number("abc") = NaN for the
 *    Plan 566 display guards — only the engine sums are guarded.
 *
 * Synthetic data only — no real customer names, no realistic phone
 * numbers (pattern-fake digits only).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePaymentAllocations } from '../core.js';

const customer = (overrides = {}) => ({
  id: 'cust-11-1',
  customerNumber: 11,
  name: 'Test Customer 11',
  bills: [
    {
      id: 'bill-2026-11',
      month: '2026-11',
      dueAmount: 3000,
      payments: [
        { id: 'pay-healthy', date: '2026-11-05', amount: 2000, method: 'Cash' },
        { id: 'pay-bad', date: '2026-11-06', amount: 'abc', method: 'Cash' },
      ],
    },
  ],
  ...overrides,
});

const healthyCustomer = () => ({
  id: 'cust-11-2',
  customerNumber: 12,
  name: 'Test Customer 12',
  bills: [
    {
      id: 'bill-2026-11-b',
      month: '2026-11',
      dueAmount: 1000,
      payments: [{ id: 'pay-b-1', date: '2026-11-05', amount: 1000, method: 'Cash' }],
    },
  ],
});

test('acceptance: one "abc" payment + one healthy payment — healthy figures only, bad row generates no credit', () => {
  const allocations = calculatePaymentAllocations({ customers: [customer()] });
  const summary = allocations.forMonth('cust-11-1', '2026-11');
  assert.equal(summary.actualReceiptsCents, 200000, 'receipts count the healthy payment only');
  assert.equal(summary.balanceDueCents, 100000, 'due is the bill minus the healthy payment');
  assert.equal(summary.excessGeneratedCents, 0, 'the bad row generates no credit');
  assert.equal(summary.pendingCreditCents, 0, 'no pending credit from the bad row');
  for (const value of [summary.actualReceiptsCents, summary.balanceDueCents, summary.billAmountCents, summary.excessGeneratedCents, summary.pendingCreditCents]) {
    assert.ok(Number.isFinite(value), 'every figure is finite');
  }
});

test('acceptance: the bad row stays in byPaymentId — it is not dropped, only its amount is treated as 0', () => {
  const allocations = calculatePaymentAllocations({ customers: [customer()] });
  const ledger = allocations.byPaymentId.get('pay-bad');
  assert.ok(ledger, 'the bad payment still has a ledger entry');
  assert.equal(ledger.allocations.length, 0, 'nothing was applied from the bad payment');
  // Deliberate: the ledger amount is left as Number("abc") = NaN for
  // the Plan 566 display guards — only the engine sums are guarded.
  assert.ok(Number.isNaN(ledger.amount), 'ledger amount is left untouched (display guards own it)');
});

test('acceptance: the other customer in the same state is unaffected', () => {
  const allocations = calculatePaymentAllocations({ customers: [customer(), healthyCustomer()] });
  const other = allocations.forMonth('cust-11-2', '2026-11');
  assert.equal(other.actualReceiptsCents, 100000, 'other customer receipts intact');
  assert.equal(other.balanceDueCents, 0, 'other customer fully paid');
  const bad = allocations.forMonth('cust-11-1', '2026-11');
  assert.equal(bad.balanceDueCents, 100000, 'bad customer still computes correctly');
});

test('unpriced bill: the "abc" payment generates no credit — only the healthy receipt becomes credit', () => {
  const state = {
    customers: [{
      id: 'cust-11-3',
      customerNumber: 13,
      name: 'Test Customer 13',
      bills: [{
        id: 'bill-unpriced',
        month: '2026-11',
        dueAmount: null,
        payments: [
          { id: 'pay-u-1', date: '2026-11-05', amount: 1000, method: 'Cash' },
          { id: 'pay-u-bad', date: '2026-11-06', amount: 'abc', method: 'Cash' },
        ],
      }],
    }],
  };
  const allocations = calculatePaymentAllocations(state);
  const summary = allocations.forMonth('cust-11-3', '2026-11');
  assert.equal(summary.actualReceiptsCents, 100000, 'receipts count the healthy payment only');
  assert.equal(summary.excessGeneratedCents, 100000, 'only the healthy receipt becomes credit');
  assert.equal(summary.pendingCreditCents, 100000, 'only the healthy credit is pending');
});

test('overpay: only the healthy excess becomes credit — the "abc" row adds nothing', () => {
  const state = {
    customers: [{
      id: 'cust-11-4',
      customerNumber: 14,
      name: 'Test Customer 14',
      bills: [{
        id: 'bill-overpay',
        month: '2026-11',
        dueAmount: 2000,
        payments: [
          { id: 'pay-o-1', date: '2026-11-05', amount: 3000, method: 'Cash' },
          { id: 'pay-o-bad', date: '2026-11-06', amount: 'abc', method: 'Cash' },
        ],
      }],
    }],
  };
  const allocations = calculatePaymentAllocations(state);
  const summary = allocations.forMonth('cust-11-4', '2026-11');
  assert.equal(summary.actualReceiptsCents, 300000, 'receipts count the healthy payment only');
  assert.equal(summary.balanceDueCents, 0, 'bill fully settled');
  assert.equal(summary.excessGeneratedCents, 100000, 'only the healthy excess becomes credit');
});

test('non-numeric lateFee is treated as 0 — it used to NaN balanceDueCents the same way', () => {
  const state = {
    customers: [{
      id: 'cust-11-5',
      customerNumber: 15,
      name: 'Test Customer 15',
      bills: [{
        id: 'bill-latefee',
        month: '2026-11',
        dueAmount: 3000,
        lateFee: 'abc',
        payments: [{ id: 'pay-l-1', date: '2026-11-05', amount: 2000, method: 'Cash' }],
      }],
    }],
  };
  const allocations = calculatePaymentAllocations(state);
  const summary = allocations.forMonth('cust-11-5', '2026-11');
  assert.equal(summary.lateFeeCents, 0, 'corrupt late fee reads as 0');
  assert.equal(summary.billAmountCents, 300000, 'bill amount is the base amount only');
  assert.equal(summary.balanceDueCents, 100000, 'due is finite and correct');
});

test('non-numeric concession offset is treated as 0 — it used to NaN balanceDueCents the same way', () => {
  const state = {
    customers: [{
      id: 'cust-11-6',
      customerNumber: 16,
      name: 'Test Customer 16',
      bills: [{
        id: 'bill-concession',
        month: '2026-11',
        dueAmount: 3000,
        concessionAmount: 'abc',
        payments: [{ id: 'pay-c-1', date: '2026-11-05', amount: 2000, method: 'Cash' }],
      }],
    }],
  };
  const allocations = calculatePaymentAllocations(state);
  const summary = allocations.forMonth('cust-11-6', '2026-11');
  assert.equal(summary.balanceDueCents, 100000, 'due is finite and correct with a corrupt offset');
});

test('non-numeric discount applies no discount and stays finite', () => {
  const state = {
    customers: [{
      id: 'cust-11-7',
      customerNumber: 17,
      name: 'Test Customer 17',
      bills: [{
        id: 'bill-discount',
        month: '2026-11',
        dueAmount: 3000,
        payments: [{ id: 'pay-d-1', date: '2026-11-05', amount: 2000, method: 'Cash', discount: 'abc' }],
      }],
    }],
  };
  const allocations = calculatePaymentAllocations(state);
  const summary = allocations.forMonth('cust-11-7', '2026-11');
  assert.equal(summary.discountAppliedCents, 0, 'corrupt discount applies nothing');
  assert.equal(summary.balanceDueCents, 100000, 'due is finite and correct');
});

test('corrupt ticket-charge line amount reads as a 0 charge — the line sanitizer already drops it (pre-existing behaviour)', () => {
  const state = {
    customers: [{
      id: 'cust-11-8',
      customerNumber: 18,
      name: 'Test Customer 18',
      bills: [{
        id: 'bill-ticket',
        month: '2026-11',
        dueAmount: 3000,
        payments: [{
          id: 'pay-t-1',
          date: '2026-11-05',
          amount: 2000,
          method: 'Cash',
          ticketCharges: [{ ticketId: 'TKT-101', amount: 'abc' }],
        }],
      }],
    }],
  };
  const allocations = calculatePaymentAllocations(state);
  const summary = allocations.forMonth('cust-11-8', '2026-11');
  assert.equal(summary.actualReceiptsCents, 200000, 'receipts count the payment in full');
  assert.equal(summary.balanceDueCents, 100000, 'the corrupt charge line consumes nothing');
});

test('Infinity amount is treated as 0, not as infinite receipts', () => {
  const state = {
    customers: [{
      id: 'cust-11-9',
      customerNumber: 19,
      name: 'Test Customer 19',
      bills: [{
        id: 'bill-inf',
        month: '2026-11',
        dueAmount: 3000,
        payments: [
          { id: 'pay-i-1', date: '2026-11-05', amount: 2000, method: 'Cash' },
          { id: 'pay-i-inf', date: '2026-11-06', amount: Infinity, method: 'Cash' },
        ],
      }],
    }],
  };
  const allocations = calculatePaymentAllocations(state);
  const summary = allocations.forMonth('cust-11-9', '2026-11');
  assert.equal(summary.actualReceiptsCents, 200000, 'infinite amount counts as 0');
  assert.equal(summary.balanceDueCents, 100000, 'due stays finite');
});
