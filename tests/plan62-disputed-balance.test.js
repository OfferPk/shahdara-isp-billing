/**
 * plan62-disputed-balance.test.js — Plan 62: disputed amount shown
 * separately, undisputed balance still due.
 * Pins:
 * - total, disputed, and undisputed figures sum correctly on the
 *   same fixture, in integer cents (no float drift);
 * - only an OPEN Plan 61 case counts — a resolved case is excluded,
 *   so closing a case restores the ordinary full-balance view;
 * - a case for another customer or another bill never contributes;
 * - a disputed amount above the bill total leaves undisputed at 0
 *   (never negative) with the excess reported, so figures still
 *   reconcile;
 * - a reminder draft for a disputed bill carries the undisputed
 *   amount and notes that a dispute is open, in both variants, and
 *   never asks for the disputed amount; no draft when there is no
 *   open dispute or when nothing undisputed remains;
 * - ladder adjustment chases only the undisputed portion, drops a
 *   fully disputed bill to 0, and never mutates the caller's bills;
 * - no bill, payment, or Waada field is ever carried or changed.
 * Synthetic data only; no ledger figure is ever changed by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DISPUTED_BALANCE_OPEN_STATUSES,
  openCasesForBill,
  splitBillBalance,
  splitBillList,
  adjustLadderBills,
  disputeTotalsForCustomer,
  buildDisputedReminderDraft,
  disputedBalanceSummaryText,
  disputedBalanceHtml,
  disputedBalanceCsv,
  disputedBalanceFilename,
} from '../disputed-balance.js';

function openCase(overrides = {}) {
  return {
    id: 'd1',
    customerId: 'c1',
    customerName: 'Ayesha',
    billId: 'b-2026-10-c1',
    billMonth: '2026-10',
    disputedAmount: 300,
    reason: 'wrong_amount',
    status: 'open',
    ...overrides,
  };
}

test('split sums exactly on the same fixture, in integer cents', () => {
  const split = splitBillBalance({
    total: 1000,
    cases: [openCase({ disputedAmount: 333.33 }), openCase({ id: 'd2', disputedAmount: 166.67 })],
    customerId: 'c1',
    billId: 'b-2026-10-c1',
  });
  assert.equal(split.total, 1000);
  assert.equal(split.disputed, 500);
  assert.equal(split.undisputed, 500);
  assert.equal(split.reconciles, true);
  assert.equal(split.hasOpenDispute, true);
  assert.equal(split.caseCount, 2);
});

test('only open cases count; a resolved case restores the full-balance view', () => {
  const open = splitBillBalance({
    total: 1000, cases: [openCase()], customerId: 'c1', billId: 'b-2026-10-c1',
  });
  assert.equal(open.undisputed, 700);
  const closed = splitBillBalance({
    total: 1000,
    cases: [openCase({ status: 'resolved', outcome: 'Corrected' })],
    customerId: 'c1',
    billId: 'b-2026-10-c1',
  });
  assert.equal(closed.hasOpenDispute, false);
  assert.equal(closed.disputed, 0);
  assert.equal(closed.undisputed, 1000);
  // Investigating and escalated cases are still open.
  const escalated = splitBillBalance({
    total: 1000, cases: [openCase({ status: 'escalated' })], customerId: 'c1', billId: 'b-2026-10-c1',
  });
  assert.equal(escalated.undisputed, 700);
  assert.deepEqual(DISPUTED_BALANCE_OPEN_STATUSES, ['open', 'investigating', 'escalated']);
});

test('a case for another customer or another bill never contributes', () => {
  const split = splitBillBalance({
    total: 1000,
    cases: [
      openCase({ customerId: 'c2' }),
      openCase({ id: 'd3', billId: 'b-2026-09-c1', billMonth: '2026-09' }),
    ],
    customerId: 'c1',
    billId: 'b-2026-10-c1',
  });
  assert.equal(split.hasOpenDispute, false);
  assert.equal(split.undisputed, 1000);
  // Month fallback only when the caller supplies no bill id.
  const byMonth = openCasesForBill([openCase({ billId: '' })], { customerId: 'c1', billMonth: '2026-10' });
  assert.equal(byMonth.length, 1);
});

test('disputed above the total leaves undisputed at 0 with excess reported', () => {
  const split = splitBillBalance({
    total: 1000, cases: [openCase({ disputedAmount: 1200 })], customerId: 'c1', billId: 'b-2026-10-c1',
  });
  assert.equal(split.disputed, 1200);
  assert.equal(split.undisputed, 0);
  assert.equal(split.excess, 200);
  assert.equal(split.fullyDisputed, true);
  assert.equal(split.reconciles, true);
});

test('invalid totals and unusable amounts are never zero-filled or guessed', () => {
  assert.equal(splitBillBalance({ total: 0, cases: [openCase()], customerId: 'c1', billId: 'b1' }), null);
  assert.equal(splitBillBalance({ total: 'abc', cases: [], customerId: 'c1', billId: 'b1' }), null);
  const split = splitBillBalance({
    total: 1000, cases: [openCase({ disputedAmount: null })], customerId: 'c1', billId: 'b-2026-10-c1',
  });
  assert.equal(split.disputed, 0);
  assert.equal(split.unusableCaseCount, 1);
  assert.equal(split.undisputed, 1000);
});

test('split list shows only bills with an open dispute, with exact totals', () => {
  const result = splitBillList([
    { customerId: 'c1', customerName: 'Ayesha', billId: 'b-2026-10-c1', billMonth: '2026-10', total: 1000 },
    { customerId: 'c2', customerName: 'Bilal', billId: 'b-2026-10-c2', billMonth: '2026-10', total: 800 },
  ], [openCase()]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].customerName, 'Ayesha');
  assert.equal(result.summary.total, 1000);
  assert.equal(result.summary.disputed, 300);
  assert.equal(result.summary.undisputed, 700);
  assert.equal(disputedBalanceSummaryText(result).includes('undisputed still due Rs. 700'), true);
  assert.equal(disputedBalanceSummaryText({ rows: [], summary: { billCount: 0 } }).includes('ordinary full balance'), true);
});

test('ladder adjustment chases only the undisputed portion and never mutates', () => {
  const bills = [
    { customerId: 'c1', billId: 'b-2026-10-c1', billMonth: '2026-10', balanceDue: 1000, dueDate: '2026-10-05' },
    { customerId: 'c2', billId: 'b-2026-10-c2', billMonth: '2026-10', balanceDue: 500, dueDate: '2026-10-05' },
  ];
  const adjusted = adjustLadderBills(bills, [
    openCase(),
    openCase({ id: 'd9', customerId: 'c2', billId: 'b-2026-10-c2', disputedAmount: 500 }),
  ]);
  assert.equal(adjusted.bills[0].balanceDue, 700);
  assert.equal(adjusted.bills[1].balanceDue, 0);
  assert.equal(adjusted.adjustedCount, 2);
  assert.equal(adjusted.fullyDisputedCount, 1);
  assert.equal(adjusted.totalDisputedCents, 80000);
  assert.equal(bills[0].balanceDue, 1000);
  assert.equal(bills[1].balanceDue, 500);
  assert.equal('disputeNote' in bills[0], false);
});

test('disputed reminder draft carries the undisputed amount and notes the open dispute', () => {
  const split = splitBillBalance({
    total: 1000, cases: [openCase()], customerId: 'c1', billId: 'b-2026-10-c1',
  });
  const roman = buildDisputedReminderDraft({
    customerName: 'Ayesha', step: 'firm', dueDate: '2026-10-05', daysOverdue: 10, split,
  });
  assert.equal(roman.text.includes('Rs. 700'), true);
  assert.equal(roman.text.includes('dispute open'), true);
  assert.equal(roman.text.includes('Rs. 300'), true);
  const urdu = buildDisputedReminderDraft({
    customerName: 'Ayesha', step: 'firm', dueDate: '2026-10-05', daysOverdue: 10, split,
  }, 'urdu');
  assert.equal(urdu.text.includes('Rs. 700'), true);
  assert.equal(urdu.text.includes('تنازعہ'), true);
  // No draft without an open dispute, or when nothing undisputed remains.
  assert.equal(buildDisputedReminderDraft({
    customerName: 'Ayesha', step: 'gentle', dueDate: '2026-10-05', daysOverdue: 2,
    split: splitBillBalance({ total: 1000, cases: [], customerId: 'c1', billId: 'b1' }),
  }), null);
  const fully = splitBillBalance({
    total: 300, cases: [openCase()], customerId: 'c1', billId: 'b-2026-10-c1',
  });
  assert.equal(buildDisputedReminderDraft({
    customerName: 'Ayesha', step: 'gentle', dueDate: '2026-10-05', daysOverdue: 2, split: fully,
  }), null);
});

test('per-customer dispute totals combine that customer’s disputed bills only', () => {
  const totals = disputeTotalsForCustomer([
    { customerId: 'c1', billId: 'b-2026-10-c1', balanceDue: 1000 },
    { customerId: 'c1', billId: 'b-2026-09-c1', balanceDue: 900 },
    { customerId: 'c2', billId: 'b-2026-10-c2', balanceDue: 500 },
  ], [
    openCase(),
    openCase({ id: 'd4', billId: 'b-2026-09-c1', billMonth: '2026-09', disputedAmount: 100 }),
  ], 'c1');
  assert.equal(totals.disputed, 400);
  assert.equal(totals.undisputed, 1500);
  assert.equal(totals.caseCount, 2);
  assert.equal(disputeTotalsForCustomer([], [], 'c1'), null);
});

test('no bill, payment, or Waada field is ever carried', () => {
  const split = splitBillBalance({
    total: 1000, cases: [openCase()], customerId: 'c1', billId: 'b-2026-10-c1',
  });
  for (const key of Object.keys(split)) {
    assert.equal(['waada', 'payment', 'paid', 'receipt'].some((word) => key.toLowerCase().includes(word)), false);
  }
});

test('HTML escapes, CSV quotes, and filename are safe', () => {
  const result = splitBillList([
    { customerId: 'c1', customerName: 'Ayesha <&>', billId: 'b1', billMonth: '2026-10', total: 1000 },
  ], [openCase({ billId: 'b1', customerName: 'Ayesha <&>' })]);
  const html = disputedBalanceHtml(result);
  assert.equal(html.includes('Ayesha &lt;&amp;&gt;'), true);
  assert.equal(html.includes('Ayesha <&>'), false);
  const csv = disputedBalanceCsv(splitBillList([
    { customerId: 'c1', customerName: 'Ayesha, Jr', billId: 'b1', billMonth: '2026-10', total: 1000 },
  ], [openCase({ billId: 'b1' })]));
  assert.equal(csv.includes('"Ayesha, Jr"'), true);
  assert.equal(disputedBalanceFilename(), 'disputed-balances.csv');
});
