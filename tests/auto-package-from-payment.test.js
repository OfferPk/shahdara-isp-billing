/**
 * auto-package-from-payment.test.js — Owner feature (2026-10-29):
 * the package follows the fee taken for the customer's latest month.
 *
 * The owner's words: "jab kisi customer ka bill pay ho jata hai to usko
 * automatically uska package patch ho jana chahiye — kisi bande ne
 * payment ki 2000, to uska bill/package automatically 2000 ho jana
 * chahiye, na ke manual baar baar set karna pare." His concrete case is
 * customer #2 AWAIS on his Customers list: "Package not set" yet two
 * recorded receipts — payments exist, the package was never set, so
 * future bills have nothing to build on. The follow-up update: the
 * package keeps following month by month — package set to 2,000 this
 * month, next month the fee is taken at 1,000 -> the package becomes
 * 1,000 and the month after bills 1,000 with no manual change.
 *
 * The decision line is the bill's state BEFORE the payment (the
 * persisted state the operator was looking at):
 *  - month not priced yet -> the collect creates-and-settles the month
 *    at the entered amount: the fee taken for the month (receipts net
 *    of SISP-43 ticket-charge portions, advances excluded) becomes the
 *    package, and the month's bill is priced at that fee;
 *  - month already priced -> the payment is a pay-down, partial or
 *    full, and NEVER rewrites the package (partial-payment protection:
 *    bill generated at 2,000, customer pays 1,000 toward it -> bill is
 *    half-paid, package stays 2,000, remaining 1,000 still due).
 *
 * Pins: owner example 1 (package-less pays 2,000 -> package 2,000, next
 * month bills 2,000), owner example 2 (2,000 -> next month taken at
 * 1,000 -> bill and package 1,000, following month bills 1,000), the
 * partial-protection case, a same-amount month (strict no-op, no
 * churn), the fee-component rule (ticket charges stripped), a lump sum
 * on an unpriced month (the untagged collect IS the fee decision —
 * prepay belongs in Advance), advance-only (no follow), FREE (no
 * follow), a manually priced bill (fee decided by pricing, not by the
 * payment), an older-month payment (latest-month guard), a voided
 * trigger (no follow), and the storage round-trip.
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, addCustomer, updateCustomerProfile, generateMonthlyBillsThroughCurrentMonth,
  addPayment, saveBillMonth, calculatePaymentAllocations, persistState, readState,
  autoPackageFromPayment, monthFeeTakenCents, AUTO_PACKAGE_STAFF_NAME
} from '../core.js';
import { recordAdvancePayment } from '../advance-payment.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import { voidPayment } from '../payment-void-audit.js';
import { TRANSLATIONS } from '../nav-language.js';

const SEP_15 = new Date(2026, 8, 15, 12);
const SEP_20 = new Date(2026, 8, 20, 12);
const OCT_2 = new Date(2026, 9, 2, 12);
const OCT_5 = new Date(2026, 9, 5, 12);
const OCT_10 = new Date(2026, 9, 10, 12);
const OCT_29 = new Date(2026, 9, 29, 12);
const NOV_2 = new Date(2026, 10, 2, 12);
const store = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };

const customerOf = state => state.customers[0];
const billOf = (state, month) => state.customers[0].bills.find(b => b.month === month);
const balanceOf = (state, month) => calculatePaymentAllocations(state).forMonth(state.customers[0].id, month)?.balanceDueCents;

/** Package-less synthetic customer (the AWAIS shape). */
const packagelessState = () => createInitialState(['Awais Tester']);

/** Customer on a PKR 2,000 package from September, September bill priced and paid in full. */
function septemberSettledState() {
  let state = createInitialState(['Downgrade Tester']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: 2000, packageSpeed: '5Mbps / 200GB' }, SEP_15);
  state = generateMonthlyBillsThroughCurrentMonth(state, SEP_15);
  state = addPayment(state, 'seed-001', '2026-09', { date: '2026-09-20', amount: 2000, method: 'Cash' }, SEP_20);
  return state;
}

test('example 1 (AWAIS): package-less customer pays 2,000 -> package 2,000, bill stands at 2,000, next month bills 2,000', () => {
  const before = packagelessState();
  assert.equal(customerOf(before).monthlySellingAmount, null);
  const { nextState, receipt } = executeQuickCollection(before, {
    customerId: 'seed-001', month: '2026-10', amount: 2000, date: '2026-10-10', method: 'Cash'
  }, OCT_10);
  assert.deepEqual(receipt.packageAutoSet, { fee: 2000, packageLabel: '5Mbps / 200GB' });
  const customer = customerOf(nextState);
  assert.equal(customer.monthlySellingAmount, 2000);
  assert.equal(customer.packageSpeed, '5Mbps / 200GB');
  // The month stands at the taken fee and its receipt settles it.
  assert.equal(Number(billOf(nextState, '2026-10').dueAmount), 2000);
  assert.equal(balanceOf(nextState, '2026-10'), 0);
  // Attributable through the normal package-history record.
  const history = customer.packageHistory;
  assert.equal(history.length, 1);
  assert.equal(history[0].staffName, AUTO_PACKAGE_STAFF_NAME);
  assert.equal(history[0].oldMonthlyRate, null);
  assert.equal(history[0].newMonthlyRate, 2000);
  // Next month's bill generates at the followed fee with no manual step.
  const november = generateMonthlyBillsThroughCurrentMonth(nextState, NOV_2);
  assert.equal(Number(billOf(november, '2026-11').dueAmount), 2000);
});

test('example 2: package 2,000, next month fee taken at 1,000 -> bill and package become 1,000, following month bills 1,000', () => {
  const before = septemberSettledState();
  assert.equal(customerOf(before).monthlySellingAmount, 2000);
  assert.equal(billOf(before, '2026-10'), undefined, 'October not priced yet in the pre-payment state');
  const { nextState, receipt } = executeQuickCollection(before, {
    customerId: 'seed-001', month: '2026-10', amount: 1000, date: '2026-10-05', method: 'Cash'
  }, OCT_5);
  assert.deepEqual(receipt.packageAutoSet, { fee: 1000, packageLabel: '3Mbps / 100GB' });
  const customer = customerOf(nextState);
  assert.equal(customer.monthlySellingAmount, 1000);
  assert.equal(customer.packageSpeed, '3Mbps / 100GB');
  // October's bill stands at 1,000 and is settled by the 1,000 taken.
  assert.equal(Number(billOf(nextState, '2026-10').dueAmount), 1000);
  assert.equal(balanceOf(nextState, '2026-10'), 0);
  const last = customer.packageHistory.at(-1);
  assert.equal(last.oldMonthlyRate, 2000);
  assert.equal(last.newMonthlyRate, 1000);
  assert.equal(last.staffName, AUTO_PACKAGE_STAFF_NAME);
  // The following month bills 1,000 with no manual change.
  const november = generateMonthlyBillsThroughCurrentMonth(nextState, NOV_2);
  assert.equal(Number(billOf(november, '2026-11').dueAmount), 1000);
});

test('partial protection: 1,000 paid toward an already-generated 2,000 bill leaves the bill half-paid and the package at 2,000', () => {
  let before = septemberSettledState();
  before = generateMonthlyBillsThroughCurrentMonth(before, OCT_2);
  assert.equal(Number(billOf(before, '2026-10').dueAmount), 2000, 'October bill generated at the package price before the payment');
  const historyLength = customerOf(before).packageHistory.length;
  const { nextState, receipt } = executeQuickCollection(before, {
    customerId: 'seed-001', month: '2026-10', amount: 1000, date: '2026-10-05', method: 'Cash'
  }, OCT_5);
  assert.equal(receipt.packageAutoSet, null);
  const customer = customerOf(nextState);
  assert.equal(customer.monthlySellingAmount, 2000);
  assert.equal(customer.packageSpeed, '5Mbps / 200GB');
  assert.equal(customer.packageHistory.length, historyLength, 'no plan change recorded');
  assert.equal(Number(billOf(nextState, '2026-10').dueAmount), 2000, 'bill amount untouched');
  assert.equal(balanceOf(nextState, '2026-10'), 100000, 'remaining 1,000 still due');
});

test('same-amount month: collecting the current fee on an unpriced month changes nothing and records no churn', () => {
  const before = septemberSettledState();
  // Move the fixture to a 1,000 package already settled in September is
  // overkill; instead: the October collect equals the current 2,000 fee.
  const customerBefore = customerOf(before);
  const { nextState, receipt } = executeQuickCollection(before, {
    customerId: 'seed-001', month: '2026-10', amount: 2000, date: '2026-10-05', method: 'Cash'
  }, OCT_5);
  assert.equal(receipt.packageAutoSet, null);
  const customer = customerOf(nextState);
  assert.equal(customer.monthlySellingAmount, 2000);
  assert.equal(customer.packageSpeed, customerBefore.packageSpeed);
  assert.deepEqual(customer.monthlyPriceSchedule, customerBefore.monthlyPriceSchedule);
  assert.deepEqual(customer.packageHistory, customerBefore.packageHistory);
});

test('fee component only: a combined collect carrying a SISP-43 ticket charge follows the bill portion, never the lump sum', () => {
  const before = packagelessState();
  const after = addPayment(before, 'seed-001', '2026-10', {
    date: '2026-10-10', amount: 2500, method: 'Cash',
    ticketCharges: [{ ticketId: 'TKT-101', amount: 500 }]
  }, OCT_10);
  const payment = billOf(after, '2026-10').payments[0];
  assert.equal(monthFeeTakenCents(customerOf(after), '2026-10'), 200000, 'ticket portion is not bill money');
  const { nextState, autoPackage } = autoPackageFromPayment(before, after, 'seed-001', '2026-10', payment.id, OCT_10);
  assert.equal(autoPackage.fee, 2000);
  assert.equal(customerOf(nextState).monthlySellingAmount, 2000);
  assert.equal(Number(billOf(nextState, '2026-10').dueAmount), 2000);
  assert.equal(balanceOf(nextState, '2026-10'), 0);
});

test('lump sum on an unpriced month: one untagged collect of 6,000 is the month fee decision (prepay belongs in Advance)', () => {
  const before = packagelessState();
  const { nextState, receipt } = executeQuickCollection(before, {
    customerId: 'seed-001', month: '2026-10', amount: 6000, date: '2026-10-10', method: 'Cash'
  }, OCT_10);
  assert.equal(receipt.packageAutoSet.fee, 6000);
  assert.equal(customerOf(nextState).monthlySellingAmount, 6000);
  assert.equal(receipt.packageAutoSet.packageLabel, '', 'no catalogue package at 6,000 — custom fee, label untouched');
});

test('advance-only: a tagged advance never sets a package (Quick Collect path and recordAdvancePayment)', () => {
  const before = packagelessState();
  const { nextState, receipt } = executeQuickCollection(before, {
    customerId: 'seed-001', month: '2026-10', amount: 2000, date: '2026-10-29', method: 'Cash', kind: 'advance'
  }, OCT_29);
  assert.equal(receipt.packageAutoSet, null);
  assert.equal(customerOf(nextState).monthlySellingAmount, null);
  const viaProfile = recordAdvancePayment(before, 'seed-001', { amount: 2000, date: '2026-10-29', method: 'Cash' }, OCT_29);
  assert.equal(customerOf(viaProfile.nextState).monthlySellingAmount, null);
  assert.equal((customerOf(viaProfile.nextState).packageHistory ?? []).length, 0);
});

test('FREE connection: a payment never gives a free customer a package fee', () => {
  let before = createInitialState([]);
  before = addCustomer(before, 'Free Tester', OCT_5, { isFreeConnection: true });
  const free = before.customers.find(c => c.name === 'Free Tester');
  assert.equal(free.isFreeConnection, true);
  const after = addPayment(before, free.id, '2026-10', { date: '2026-10-10', amount: 2000, method: 'Cash' }, OCT_10);
  const payment = after.customers.find(c => c.id === free.id).bills.find(b => b.month === '2026-10').payments[0];
  const { autoPackage } = autoPackageFromPayment(before, after, free.id, '2026-10', payment.id, OCT_10);
  assert.equal(autoPackage, null);
  assert.equal(after.customers.find(c => c.id === free.id).monthlySellingAmount, null);
});

test('manually priced bill: a full payment of a hand-priced bill does not drag the package (the fee was decided by pricing)', () => {
  let before = packagelessState();
  before = saveBillMonth(before, 'seed-001', { month: '2026-10', dueAmount: 1500, status: 'pending' }, OCT_2);
  const { nextState, receipt } = executeQuickCollection(before, {
    customerId: 'seed-001', month: '2026-10', amount: 1500, date: '2026-10-10', method: 'Cash'
  }, OCT_10);
  assert.equal(receipt.packageAutoSet, null);
  assert.equal(customerOf(nextState).monthlySellingAmount, null);
  assert.equal(balanceOf(nextState, '2026-10'), 0, 'the hand-priced bill itself settles normally');
});

test('latest-month guard: paying an older unpriced month never rewrites the package', () => {
  let before = packagelessState();
  before = addPayment(before, 'seed-001', '2026-09', { date: '2026-09-10', amount: 1000, method: 'Cash' }, SEP_15);
  before = addPayment(before, 'seed-001', '2026-10', { date: '2026-10-03', amount: 1000, method: 'Cash' }, OCT_5);
  const after = addPayment(before, 'seed-001', '2026-09', { date: '2026-10-06', amount: 500, method: 'Cash' }, OCT_10);
  const payment = billOf(after, '2026-09').payments.at(-1);
  const { autoPackage } = autoPackageFromPayment(before, after, 'seed-001', '2026-09', payment.id, OCT_10);
  assert.equal(autoPackage, null);
  assert.equal(customerOf(after).monthlySellingAmount, null);
});

test('voided trigger: a voided payment cannot move the package', () => {
  let before = packagelessState();
  const after = addPayment(before, 'seed-001', '2026-10', { date: '2026-10-10', amount: 2000, method: 'Cash' }, OCT_10);
  const payment = billOf(after, '2026-10').payments[0];
  const { state: voided } = voidPayment(after, 'seed-001', '2026-10', payment.id, { voidReason: 'Test void' });
  const { autoPackage } = autoPackageFromPayment(before, voided, 'seed-001', '2026-10', payment.id, OCT_10);
  assert.equal(autoPackage, null);
  assert.equal(customerOf(voided).monthlySellingAmount, null);
});

test('storage round-trip: the auto-set package, label, schedule and history survive save/load', () => {
  const before = packagelessState();
  const { nextState } = executeQuickCollection(before, {
    customerId: 'seed-001', month: '2026-10', amount: 2000, date: '2026-10-10', method: 'Cash'
  }, OCT_10);
  const storage = store();
  persistState(nextState, storage);
  const loaded = readState(storage);
  const customer = customerOf(loaded);
  assert.equal(customer.monthlySellingAmount, 2000);
  assert.equal(customer.packageSpeed, '5Mbps / 200GB');
  assert.equal(customer.packageHistory.length, 1);
  assert.equal(customer.packageHistory[0].staffName, AUTO_PACKAGE_STAFF_NAME);
  assert.ok(customer.monthlyPriceSchedule.some(e => Number(e.amount) === 2000));
  assert.equal(Number(billOf(loaded, '2026-10').dueAmount), 2000);
});

test('i18n + wiring: the auto-set note exists in both dictionaries and both entry points call the follow', () => {
  for (const lang of ['en', 'ur']) {
    assert.equal(typeof TRANSLATIONS[lang].pkg_auto_set_note, 'string', `${lang} missing pkg_auto_set_note`);
    assert.ok(TRANSLATIONS[lang].pkg_auto_set_note.includes('{amount}'), `${lang} note keeps the amount placeholder`);
  }
  const qc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.ok(qc.includes('autoPackageFromPayment(state, nextState'), 'Quick Collect (and Field Mode / Bulk / Group through it) applies the follow');
  assert.ok(qc.includes("t('pkg_auto_set_note'"), 'the receipt card prints the note through t()');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes('autoPackageFromPayment(stateBeforePayment, state'), 'the profile payment form applies the follow from its pre-payment state');
});
