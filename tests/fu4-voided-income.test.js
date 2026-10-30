/**
 * tests/fu4-voided-income.test.js
 * FU4: the P&L family counted SISP-34 VOIDED payments as income.
 *
 * Proven on pristine main 8df7bad9 with the fixture below: P&L income
 * was 13,000 (not 10,000), partner revenue 13,000 / profit 9,000 /
 * share 4,500 (not 10,000 / 6,000 / 3,000), Owner Khata collected
 * 13,000 with pendingArrears 0 (not 3,000), the monthly closing
 * collection was 13,000, Daily Closing showed the voided Rs 3,000 on
 * its own date, and a receipt printed after a voided sibling showed
 * balance 1,000 where the engine says 4,000.
 *
 * SISP-34's rule is "voided payments are skipped everywhere" — the
 * allocation engine, Khata Doctor, shop settlement and roznamcha
 * already honoured it. FU4 fixes the enumerations that did not:
 * phase3 paymentEntries (shared source for partner shares, Owner
 * Khata, phase-3 analytics, area intelligence), phase3
 * outstandingAtMonthEnd, dashboard-pnl calculatePnlAnalytics, core
 * calculateDashboard + monthlyClosingMetrics, dashboard-daily-closing,
 * receipt buildPaymentReceipt and billing-cycle allocateFifoForBill,
 * plus the collected-cash loops in the dashboard widget family
 * (area collections, package revenue, charts, staff performance,
 * dashboard.js LTV / realized revenue).
 *
 * Synthetic data only.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { calculatePnlAnalytics } from '../dashboard-pnl.js';
import {
  paymentEntries,
  buildPartnerShareReport,
  buildPhase3Analytics,
  buildAreaIntelligence,
  outstandingAtMonthEnd,
} from '../phase3.js';
import { buildOwnerKhataReport } from '../owner-khata.js';
import { calculateDashboard, buildMonthlyClosingSnapshot } from '../core.js';
import { calculateDailyClosingSummary } from '../dashboard-daily-closing.js';
import { buildPaymentReceipt } from '../receipt.js';
import { allocateFifoForBill, fifoAllocationForPayment, fifoRemainingForBill } from '../billing-cycle.js';

const REF = new Date('2026-10-30T12:00:00+05:00');

// Oct-2026 bill Rs 13,000; valid payment Rs 10,000 (Oct 5); VOIDED
// payment Rs 3,000 (Oct 6); one expense Rs 4,000 (Oct 10).
function fixtureState() {
  return {
    customers: [{
      id: 'cust-fu4-1', customerNumber: 9901, name: 'FU4 Fixture One', phone: '03000000000',
      area: 'BARRIAN', packageSpeed: '15Mbps Unlimited', monthlySellingAmount: 13000,
      connectionDate: '2026-09-01', serviceStatus: 'active',
      bills: [{ id: 'bill-oct', month: '2026-10', dueAmount: 13000, dueDate: '2026-10-05', payments: [
        { id: 'pay-ok', date: '2026-10-05', amount: 10000, method: 'Cash' },
        { id: 'pay-void', date: '2026-10-06', amount: 3000, method: 'Cash', voided: true, voidedAt: '2026-10-07T00:00:00.000Z', voidReason: 'duplicate entry' },
      ] }],
    }],
    expenses: [{ id: 'exp-1', date: '2026-10-10', amount: 4000, category: 'Other expenses', notes: 'fu4 fixture expense' }],
  };
}

test('FU4 P&L: voided payment is not income (10,000 not 13,000); expenses untouched', () => {
  const pnl = calculatePnlAnalytics(fixtureState(), { selectedMonth: '2026-10', windowMonths: 6, referenceDate: REF });
  const oct = pnl.monthlyData.find((m) => m.month === '2026-10');
  assert.equal(oct.income, 10000);
  assert.equal(oct.incomeCount, 1);
  assert.equal(oct.expenses, 4000);
  assert.equal(oct.netProfit, 6000);
  assert.equal(pnl.summary.totalIncome, 10000);
  assert.equal(pnl.summary.totalNetProfit, 6000);
});

test('FU4 paymentEntries: the shared source excludes the voided record whole', () => {
  const entries = paymentEntries(fixtureState());
  assert.equal(entries.length, 1);
  assert.equal(entries[0].payment.id, 'pay-ok');
  assert.equal(entries.reduce((sum, row) => sum + Number(row.payment.amount || 0), 0), 10000);
});

test('FU4 partner shares: computed on corrected profit (share 3,000, was 4,500)', () => {
  const report = buildPartnerShareReport(fixtureState(), '2026-10', REF);
  assert.equal(report.summary.revenue, 10000);
  assert.equal(report.summary.expenses, 4000);
  assert.equal(report.summary.profit, 6000);
  assert.equal(report.summary.share, 3000);
  assert.equal(report.summary.receiptCount, 1);
  assert.equal(report.allTime.revenue, 10000);
  assert.equal(report.allTime.share, 3000);
});

test('FU4 phase-3 analytics + area intelligence: collections exclude the voided receipt', () => {
  const p3 = buildPhase3Analytics(fixtureState(), REF);
  assert.equal(p3.incomeExpense.find((r) => r.month === '2026-10').income, 10000);
  assert.equal(p3.revenueCollection.find((r) => r.month === '2026-10').cashCollection, 10000);
  assert.equal(p3.totalPayments, 1);
  const ai = buildAreaIntelligence(fixtureState(), { startDate: '2026-10-01', endDate: '2026-10-30' }, REF);
  const areaRow = ai.rows.find((r) => r.area === 'Area: Barrian');
  assert.equal(areaRow.collectedAmount, 10000);
  assert.equal(areaRow.receiptCount, 1);
});

test('FU4 outstandingAtMonthEnd: a voided payment restores the balance it pretended to settle', () => {
  const ose = outstandingAtMonthEnd(fixtureState(), '2026-10', REF);
  assert.equal(ose.total, 3000);
});

test('FU4 Owner Khata: collected, shares, channels and arrears all follow the corrected basis', () => {
  const report = buildOwnerKhataReport(fixtureState(), '2026-10', { referenceDate: REF });
  assert.equal(report.collected, 10000);
  assert.equal(report.receiptCount, 1);
  assert.equal(report.profit, 6000);
  assert.equal(report.nasirShare, 3000);
  assert.equal(report.aqibShare, 3000);
  assert.equal(report.pendingArrears, 3000);
  assert.equal(report.collectionChannels.reduce((sum, row) => sum + row.amount, 0), report.collected);
  assert.equal(report.collectionChannels.reduce((sum, row) => sum + row.count, 0), report.receiptCount);
});

test('FU4 core dashboard totals + monthly closing: collections exclude the voided receipt', () => {
  const dash = calculateDashboard(fixtureState(), REF);
  assert.equal(dash.totalCollection, 10000);
  const snap = buildMonthlyClosingSnapshot(fixtureState(), '2026-10', REF);
  assert.equal(snap.collection, 10000);
  assert.equal(snap.paymentCount, 1);
  assert.equal(snap.profit, 6000);
});

test('FU4 Daily Closing: the voided receipt does not appear on its own date', () => {
  const voidedDay = calculateDailyClosingSummary(fixtureState(), new Date('2026-10-06T12:00:00+05:00'));
  assert.equal(voidedDay.todayCollected, 0);
  assert.equal(voidedDay.todayCount, 0);
  const validDay = calculateDailyClosingSummary(fixtureState(), new Date('2026-10-05T12:00:00+05:00'));
  assert.equal(validDay.todayCollected, 10000);
  assert.equal(validDay.todayCount, 1);
});

test('FU4 receipt: a voided sibling (amount + discount) never reduces the printed balance', () => {
  const customer = {
    id: 'cust-fu4-3', customerNumber: 9903, name: 'FU4 Fixture Three',
    bills: [{ id: 'b3', month: '2026-10', dueAmount: 13000, payments: [
      { id: 'r1', date: '2026-10-05', amount: 5000, method: 'Cash' },
      { id: 'r2', date: '2026-10-06', amount: 3000, method: 'Cash', discount: 2000, voided: true, voidReason: 'duplicate' },
      { id: 'r3', date: '2026-10-08', amount: 4000, method: 'Cash' },
    ] }],
  };
  const receipt = buildPaymentReceipt(customer, customer.bills[0], customer.bills[0].payments[2]);
  assert.equal(receipt.status, 'PARTIAL');
  assert.equal(receipt.balanceDueCents, 400000); // 13,000 − 5,000 − 4,000; the voided 3,000 + its 2,000 discount settle nothing.
  // The voided payment's own receipt also contributes nothing itself:
  // balance reflects only the valid Rs 5,000 received before it.
  const voidedReceipt = buildPaymentReceipt(customer, customer.bills[0], customer.bills[0].payments[1]);
  assert.equal(voidedReceipt.balanceDueCents, 800000);
});

test('FU4 FIFO: a voided payment consumes no bucket and leaves no split entry', () => {
  const customer = {
    id: 'cust-fu4-4', customerNumber: 9904, name: 'FU4 Fixture Four',
    bills: [
      { id: 'b-sep', month: '2026-09', dueAmount: 2000, payments: [] },
      { id: 'b-oct', month: '2026-10', dueAmount: 3000, payments: [
        { id: 'fifo-void', date: '2026-10-03', amount: 2000, method: 'Cash', voided: true, voidReason: 'wrong customer' },
        { id: 'fifo-ok', date: '2026-10-04', amount: 1000, method: 'Cash' },
      ] },
    ],
  };
  const derived = allocateFifoForBill(customer, customer.bills[1]);
  assert.equal(derived.payments.length, 1);
  assert.equal(derived.payments[0].paymentId, 'fifo-ok');
  assert.equal(derived.payments[0].toArrears, 1000);
  assert.equal(fifoAllocationForPayment(customer, customer.bills[1], 'fifo-void'), null);
  assert.equal(fifoRemainingForBill(customer, customer.bills[1]).remainingTotal, 4000);
});

test('FU4 clean fixture: removing the voided record changes nothing (it now contributes exactly zero)', () => {
  const withVoided = fixtureState();
  const clean = fixtureState();
  clean.customers[0].bills[0].payments = clean.customers[0].bills[0].payments.filter((p) => p.id !== 'pay-void');
  const pnlA = calculatePnlAnalytics(withVoided, { selectedMonth: '2026-10', windowMonths: 6, referenceDate: REF });
  const pnlB = calculatePnlAnalytics(clean, { selectedMonth: '2026-10', windowMonths: 6, referenceDate: REF });
  assert.deepEqual(pnlA.monthlyData, pnlB.monthlyData);
  assert.deepEqual(pnlA.summary, pnlB.summary);
  const psrA = buildPartnerShareReport(withVoided, '2026-10', REF);
  const psrB = buildPartnerShareReport(clean, '2026-10', REF);
  assert.deepEqual(psrA.summary, psrB.summary);
});
