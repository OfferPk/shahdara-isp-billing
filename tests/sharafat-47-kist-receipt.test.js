// Sharafat 47: Down-payment kist receipt — "Remaining" is total minus the
// amount ACTUALLY paid (not the planned down payment), and every schedule
// row names the month it falls due (plan start month + offset).
// Pure-function tests on synthetic data only. The acceptance fixture is
// one builder call + one HTML render; the remaining is asserted on the
// RECEIPT MODEL (remainingAfterDownPayment), never on an HTML substring
// (PKR 5,000 already appears in the schedule rows, so a substring check
// would false-pass on the unfixed tree).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInstallmentPlan, kistSchedule } from '../installment-plan.js';
import {
  buildDownPaymentKistReceipt,
  buildDownPaymentKistReceiptHtml
} from '../receipt.js';

const customer = { name: 'Test Customer', customerNumber: 12 };
const plan = () => createInstallmentPlan({
  itemTitle: 'Tenda F3 Router', totalAmount: 24000, downPayment: 4000,
  monthlyKist: 5000, totalMonths: 4, startDate: '2026-11-01'
});
const receiptFor = (paid, date = '2026-11-01') => buildDownPaymentKistReceipt(
  customer, plan(), { amount: paid, date, method: 'Cash', id: `pay-${paid}` }
);
const htmlFor = (receipt) => buildDownPaymentKistReceiptHtml(receipt, {
  businessName: 'Shahdara ISP', businessPhone: '03012345678',
  areaName: 'Shahdara, Islamabad', receiptFooter: ''
});

test('Sharafat 47: over-paid down payment lowers the remaining and shows the 1,000 difference', () => {
  const receipt = receiptFor(5000);
  assert.equal(receipt.paidDownPayment, 5000);
  assert.equal(receipt.downPayment, 4000);
  assert.equal(receipt.remainingAfterDownPayment, 19000);
  const html = htmlFor(receipt);
  assert.match(html, /Planned Down Payment \/ منصوبہ شدہ پیشگی:/);
  assert.match(html, /PKR 4,000 · Paid \/ ادا شدہ PKR 5,000 \(PKR 1,000 extra \/ اضافی\)/);
});

test('Sharafat 47: under-paid down payment raises the remaining and shows the shortfall', () => {
  const receipt = receiptFor(3000);
  assert.equal(receipt.remainingAfterDownPayment, 21000);
  const html = htmlFor(receipt);
  assert.match(html, /PKR 4,000 · Paid \/ ادا شدہ PKR 3,000 \(PKR 1,000 short \/ کم\)/);
});

test('Sharafat 47: exact down payment keeps the old remaining and shows no planned-vs-paid line', () => {
  const receipt = receiptFor(4000);
  assert.equal(receipt.remainingAfterDownPayment, 20000);
  assert.doesNotMatch(htmlFor(receipt), /Planned Down Payment/);
});

test('Sharafat 47: a payment at or above the total clamps the remaining at zero, never negative', () => {
  assert.equal(receiptFor(24000).remainingAfterDownPayment, 0);
  assert.equal(receiptFor(25000).remainingAfterDownPayment, 0);
});

test('Sharafat 47: every schedule row names its due month, across the year boundary', () => {
  const receipt = receiptFor(4000);
  assert.deepEqual(receipt.schedule.map((row) => row.month), ['2026-11', '2026-12', '2027-01', '2027-02']);
  const html = htmlFor(receipt);
  assert.match(html, /Kist 1\/4 · 2026-11:/);
  assert.match(html, /Kist 2\/4 · 2026-12:/);
  assert.match(html, /Kist 3\/4 · 2027-01:/);
  assert.match(html, /Kist 4\/4 · 2027-02:/);
  // A December-start plan rolls into the next year the same way.
  const dec = buildDownPaymentKistReceipt(customer, createInstallmentPlan({
    itemTitle: 'Tenda F3 Router', totalAmount: 24000, downPayment: 4000,
    monthlyKist: 5000, totalMonths: 4, startDate: '2026-12-15'
  }), { amount: 4000, date: '2026-12-15', method: 'Cash', id: 'pay-dec' });
  assert.deepEqual(dec.schedule.map((row) => row.month), ['2026-12', '2027-01', '2027-02', '2027-03']);
});

test('Sharafat 47: a plan with no startDate carries no month on its rows, exactly as before', () => {
  const noStart = createInstallmentPlan({
    itemTitle: 'Tenda F3 Router', totalAmount: 5000, downPayment: 2000, totalMonths: 3
  });
  assert.deepEqual(kistSchedule(noStart).map((row) => row.month), [null, null, null]);
  const receipt = buildDownPaymentKistReceipt(customer, noStart, {
    amount: 2000, date: '2026-10-20', method: 'Cash', id: 'pay-nostart'
  });
  assert.equal(receipt.remainingAfterDownPayment, 3000);
  const html = htmlFor(receipt);
  assert.match(html, /Kist 1\/3:/);
  assert.match(html, /Kist 3\/3:/);
  assert.doesNotMatch(html, /Kist \d\/3 · \d{4}-\d{2}:/);
});

test('Sharafat 47: the billed/remaining markers survive alongside the months', () => {
  const billed = {
    ...createInstallmentPlan({
      itemTitle: 'Tenda F3 Router', totalAmount: 24000, downPayment: 4000,
      monthlyKist: 5000, totalMonths: 4, startDate: '2026-11-01'
    }),
    monthsBilled: 1
  };
  const receipt = buildDownPaymentKistReceipt(customer, billed, {
    amount: 4000, date: '2026-11-01', method: 'Cash', id: 'pay-billed'
  });
  assert.deepEqual(receipt.schedule.map((row) => [row.month, row.status]), [
    ['2026-11', 'billed'], ['2026-12', 'remaining'], ['2027-01', 'remaining'], ['2027-02', 'remaining']
  ]);
  const html = htmlFor(receipt);
  assert.match(html, /Kist 1\/4 · 2026-11:<\/dt><dd>PKR 5,000 \(billed\)<\/dd>/);
  assert.match(html, /Kist 2\/4 · 2026-12:<\/dt><dd>PKR 5,000 \(remaining\)<\/dd>/);
});

test('Sharafat 47: the SISP-29 fixture (paid == planned) is unchanged by the fix', () => {
  const sisp29 = createInstallmentPlan({
    itemTitle: 'Tenda F3 Router', totalAmount: 5000, downPayment: 2000, totalMonths: 3
  });
  const receipt = buildDownPaymentKistReceipt(
    { name: 'Test Customer 11', customerNumber: 11 }, sisp29,
    { id: 'pay-1', amount: 2000, date: '2026-10-20', method: 'Cash' }
  );
  assert.equal(receipt.remainingAfterDownPayment, 3000);
  assert.equal(receipt.schedule.length, 3);
  const html = htmlFor(receipt);
  assert.match(html, /Kist 1\/3/);
  assert.match(html, /Kist 3\/3/);
  assert.doesNotMatch(html, /Planned Down Payment/);
});
