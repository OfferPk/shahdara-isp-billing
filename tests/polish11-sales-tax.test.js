/**
 * polish11-sales-tax.test.js — Polish #11 (2026-11-07): sales tax
 * 19.5% on every package + package sync on payment.
 *
 * The owner's words (voice note, 2026-11-07): tax on every package
 * (1000 -> 195 Rs confirmed); selecting a package adds its tax to
 * the bill at once, not selecting removes it; recording a payment
 * auto-updates the customer's package to the amount just entered
 * (last time 1600, this time pays 1000 -> profile becomes 1000, no
 * manual profile edit); the receipt, with all its info, must be
 * sendable to customers; a sales-tax dashboard shows monthly tax
 * per customer package; every profile shows that customer's tax.
 *
 * Pinned rules: tax in integer cents, Math.round(priceCents x 195 /
 * 1000), rate constant 1950 bps; old bills keep recorded cents,
 * history never recomputed; partial payment DOES move the package
 * (owner-stated rule — the old partial-payment protection is gone
 * by design, see the priced-month follow tests); NO tax on a bare
 * typed amount in v1; dashboard current month only in v1.
 * Synthetic data only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SALES_TAX_RATE_BPS,
  SALES_TAX_RATE_PERCENT,
  formatSalesTaxAmount,
  salesTaxCentsForPrice,
  salesTaxForPackage,
  salesTaxTable,
  customerSalesTaxCents,
  salesTaxCentsOfBill,
  salesTaxReceiptLine,
  salesTaxDashboardRows,
  salesTaxDashboardTotals,
} from '../package-sales-tax.js';
import {
  createInitialState, addCustomer, updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth, addPayment, saveBillMonth,
  calculatePaymentAllocations, autoPackageFromPayment,
  archiveCustomer, AUTO_PACKAGE_STAFF_NAME,
  addManualBaqayaEntry, manualBaqayaOutstanding,
} from '../core.js';
import { reverseCollectedPayment } from '../quick-undo-toast.js';
import { recordAdvancePayment } from '../advance-payment.js';
import { voidPayment } from '../payment-void-audit.js';
import { executeQuickCollection, getCustomerPaymentDefaults } from '../nav-quick-collect.js';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import { createBillPackageSnapshot } from '../package-catalog.js';
import { createReceiptWhatsAppDraft } from '../profile-ui.js';
import {
  receiptShareDraftFor,
  receiptShareDraftMatchesReceipt,
  receiptShareDraftHtml,
} from '../receipt-share-draft.js';
import { markReceiptShared, isReceiptShared } from '../nav-quick-profile.js';

const SEP_15 = new Date(2026, 8, 15, 12);
const SEP_20 = new Date(2026, 8, 20, 12);
const OCT_2 = new Date(2026, 9, 2, 12);
const OCT_5 = new Date(2026, 9, 5, 12);
const OCT_10 = new Date(2026, 9, 10, 12);
const OCT_29 = new Date(2026, 9, 29, 12);
const NOV_2 = new Date(2026, 10, 2, 12);
const NOV_7 = new Date(2026, 10, 7, 12);
const store = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };

const customerOf = state => state.customers[0];
const billOf = (state, month) => state.customers[0].bills.find(b => b.month === month);
const balanceOf = (state, month) => calculatePaymentAllocations(state).forMonth(state.customers[0].id, month)?.balanceDueCents;
const appSrc = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

/** Customer on a PKR 2,000 package from September, September bill priced and paid in full. */
function septemberSettledState() {
  let state = createInitialState(['Downgrade Tester']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: 2000, packageSpeed: '5Mbps / 200GB' }, SEP_15);
  state = generateMonthlyBillsThroughCurrentMonth(state, SEP_15);
  state = addPayment(state, 'seed-001', '2026-09', { date: '2026-09-20', amount: 2000, method: 'Cash' }, SEP_20);
  return state;
}

// --- §8.1 Tax table ---

test('tax table: all six catalog prices map to the owner-confirmed values, in integer cents', () => {
  assert.equal(SALES_TAX_RATE_BPS, 1950);
  assert.equal(SALES_TAX_RATE_PERCENT, 19.5);
  const expected = { 1000: 19500, 1500: 29250, 1600: 31200, 2000: 39000, 2500: 48750, 3000: 58500 };
  for (const [price, cents] of Object.entries(expected)) {
    assert.equal(salesTaxCentsForPrice(Number(price)), cents, `tax on ${price}`);
  }
  const table = salesTaxTable();
  assert.equal(table.length, 6);
  for (const row of table) {
    assert.equal(row.taxCents, expected[row.priceCents / 100], `table row ${row.label}`);
    assert.equal(salesTaxForPackage(row.packageId).taxCents, row.taxCents);
  }
  // The owner's confirmed table, in rupees: 1000->195, 1500->292.5,
  // 1600->312, 2000->390, 2500->487.5, 3000->585.
  assert.equal(formatSalesTaxAmount(19500), 'PKR 195');
  assert.equal(formatSalesTaxAmount(29250), 'PKR 292.5');
  assert.equal(formatSalesTaxAmount(31200), 'PKR 312');
  assert.equal(formatSalesTaxAmount(39000), 'PKR 390');
  assert.equal(formatSalesTaxAmount(48750), 'PKR 487.5');
  assert.equal(formatSalesTaxAmount(58500), 'PKR 585');
});

test('tax table: a non-catalog amount rounds half-up to the paisa; missing/invalid figures are null, never zero', () => {
  assert.equal(salesTaxCentsForPrice(333), 6494, '33300 cents x 195 / 1000 = 6493.5 -> 6494');
  assert.equal(salesTaxCentsForPrice(1001), 19520, '100100 cents x 195 / 1000 = 19519.5 -> 19520');
  assert.equal(salesTaxCentsForPrice(1000.5), 19510, 'half-rupee prices keep paisa precision');
  for (const bad of [null, undefined, '', true, false, 0, -5, Number.NaN, 'abc']) {
    assert.equal(salesTaxCentsForPrice(bad), null, `expected null for ${String(bad)}`);
  }
  assert.equal(formatSalesTaxAmount(null), 'Not set');
  assert.equal(formatSalesTaxAmount(undefined), 'Not set');
  assert.equal(formatSalesTaxAmount(''), 'Not set');
  assert.equal(formatSalesTaxAmount(true), 'Not set');
  assert.equal(formatSalesTaxAmount(0), 'PKR 0', 'an explicit zero formats as zero — it is never invented as a tax');
  assert.equal(salesTaxForPackage('no-such-package'), null);
  assert.equal(salesTaxCentsOfBill(null), null);
  assert.equal(salesTaxCentsOfBill({}), null);
  assert.equal(salesTaxCentsOfBill({ salesTaxCents: 0 }), null, 'a zero recorded tax reads as no tax');
  assert.equal(salesTaxCentsOfBill({ salesTaxCents: 19500 }), 19500);
  assert.equal(salesTaxReceiptLine({}), null);
  assert.deepEqual(salesTaxReceiptLine({ salesTaxCents: 19500 }), { label: 'Sales tax / سیلز ٹیکس (19.5%)', taxCents: 19500 });
});

// --- §8.2 Req 1 toggle (saveBillMonth + wiring pins) ---

test('Req 1: package chosen + tax ticked -> bill due is price + tax and the cents are recorded; unticked -> due is the price and the tax is null', () => {
  let state = createInitialState(['Tax Toggle Tester']);
  state = saveBillMonth(state, 'seed-001', { month: '2026-11', status: 'pending', packageId: '3mbps-100gb', salesTaxCents: 19500 }, NOV_2);
  const taxed = billOf(state, '2026-11');
  assert.equal(Number(taxed.dueAmount), 1195);
  assert.equal(taxed.salesTaxCents, 19500);
  assert.equal(taxed.salesTaxRateBps, 1950);
  assert.equal(taxed.packageSnapshot.label, '3Mbps / 100GB');
  // Unticking clears the tax and the due falls back to the price.
  state = saveBillMonth(state, 'seed-001', { month: '2026-11', status: 'pending', packageId: '3mbps-100gb', salesTaxCents: null }, NOV_2);
  const untaxed = billOf(state, '2026-11');
  assert.equal(Number(untaxed.dueAmount), 1000);
  assert.equal(untaxed.salesTaxCents, undefined);
  assert.equal(untaxed.salesTaxRateBps, undefined);
});

test('Req 1: omitting the tax param leaves recorded tax untouched; a 1500 package bills 1792.5 with its tax', () => {
  let state = createInitialState(['Tax Keep Tester']);
  state = saveBillMonth(state, 'seed-001', { month: '2026-11', status: 'pending', packageId: '5mbps-150gb', salesTaxCents: 29250 }, NOV_2);
  assert.equal(Number(billOf(state, '2026-11').dueAmount), 1792.5);
  // A later save that only changes the due date keeps the tax — the
  // caller passes the due (price + tax, as the bill form does) and
  // omits the tax param.
  state = saveBillMonth(state, 'seed-001', { month: '2026-11', status: 'pending', dueAmount: 1792.5, dueDate: '2026-11-07' }, NOV_2);
  assert.equal(billOf(state, '2026-11').salesTaxCents, 29250);
  assert.equal(Number(billOf(state, '2026-11').dueAmount), 1792.5);
});

test('Req 1: mismatched tax, tax with no package, and non-positive tax are all rejected — never silently stored', () => {
  const state = createInitialState(['Tax Reject Tester']);
  assert.throws(
    () => saveBillMonth(state, 'seed-001', { month: '2026-11', status: 'pending', packageId: '3mbps-100gb', salesTaxCents: 19000 }, NOV_2),
    /does not match 19.5% of the package price/
  );
  assert.throws(
    () => saveBillMonth(state, 'seed-001', { month: '2026-11', status: 'pending', salesTaxCents: 19500 }, NOV_2),
    /no package cannot carry sales tax/
  );
  assert.throws(
    () => saveBillMonth(state, 'seed-001', { month: '2026-11', status: 'pending', packageId: '3mbps-100gb', salesTaxCents: 0 }, NOV_2),
    /positive whole-paisa/
  );
  assert.throws(
    () => saveBillMonth(state, 'seed-001', { month: '2026-11', status: 'pending', packageId: '3mbps-100gb', salesTaxCents: 195.5 }, NOV_2),
    /positive whole-paisa/
  );
  // Clearing the package clears its tax with it, even without the tax param.
  let taxed = saveBillMonth(state, 'seed-001', { month: '2026-11', status: 'pending', packageId: '3mbps-100gb', salesTaxCents: 19500 }, NOV_2);
  taxed = saveBillMonth(taxed, 'seed-001', { month: '2026-11', status: 'pending', packageId: '', clearPackageSnapshot: true }, NOV_2);
  assert.equal(billOf(taxed, '2026-11').salesTaxCents, undefined);
  assert.equal(billOf(taxed, '2026-11').packageSnapshot, undefined);
});

test('Req 1 wiring: the bill form shows each package tax, the checkbox lives beside the select (hidden/disabled with no package), and toggling updates the due live', () => {
  assert.ok(appSrc.includes('data-stx-tax'), 'the tax checkbox rides the bill form');
  assert.ok(appSrc.includes('Sales tax ${formatSalesTaxAmount(taxCents)}'), 'each package option names its tax');
  assert.ok(appSrc.includes("style=\"${savedPlan ? '' : 'display:none'}\""), 'the checkbox hides with no package selected');
  assert.ok(appSrc.includes('taxBox.disabled = true'), 'the checkbox disables with no package');
  assert.ok(appSrc.includes('amount.value = stxDueValue(plan.price, taxCents)'), 'choosing a package sets the due to price + tax at once');
  assert.ok(appSrc.includes('amount.value = stxDueValue(plan.price, box.checked ? taxCents : 0)'), 'toggling the box updates the due live, price <-> price + tax');
  assert.ok(appSrc.includes('salesTaxCentsForPrice(selectedPlan.price)'), 'the save passes the selected package tax');
  assert.ok(appSrc.includes('salesTaxCents }'), 'the save hands the tax to saveBillMonth');
  assert.ok(appSrc.includes('updateBillFormTaxLine'), 'the month summary tax line follows the form live');
});

// --- §8.3 Req 2 follow (priced month) ---

test('Req 2 priced follow: 1,600 paid toward an already-generated 2,000 bill moves the package to 1,600 from next month; the bill stays 2,000 with 400 still due', () => {
  let before = septemberSettledState();
  before = generateMonthlyBillsThroughCurrentMonth(before, OCT_2);
  assert.equal(Number(billOf(before, '2026-10').dueAmount), 2000, 'October bill generated at the package price before the payment');
  const historyLength = customerOf(before).packageHistory.length;
  const { nextState, receipt } = executeQuickCollection(before, {
    customerId: 'seed-001', month: '2026-10', amount: 1600, date: '2026-10-05', method: 'Cash'
  }, OCT_5);
  // A partial payment DOES move the package — the owner's stated rule.
  assert.deepEqual(receipt.packageAutoSet, { fee: 1600, packageLabel: '3Mbps / 300GB' });
  const customer = customerOf(nextState);
  assert.equal(customer.monthlySellingAmount, 1600);
  assert.equal(customer.packageSpeed, '3Mbps / 300GB');
  assert.equal(customer.packageHistory.length, historyLength + 1, 'one plan change recorded');
  assert.equal(customer.packageHistory.at(-1).staffName, AUTO_PACKAGE_STAFF_NAME);
  assert.equal(customer.packageHistory.at(-1).newMonthlyRate, 1600);
  assert.equal(Number(billOf(nextState, '2026-10').dueAmount), 2000, 'the priced bill is never repriced');
  assert.equal(balanceOf(nextState, '2026-10'), 40000, 'remaining 400 still due');
  const november = generateMonthlyBillsThroughCurrentMonth(nextState, NOV_2);
  assert.equal(Number(billOf(november, '2026-11').dueAmount), 1600, 'next month bills at the followed fee');
});

test('Req 2 priced follow: the owner case — 1,000 paid toward a 1,600 bill moves the package to 1,000; the bill keeps 600 due', () => {
  let before = createInitialState(['Owner Case Tester']);
  before = updateCustomerProfile(before, 'seed-001', { monthlySellingAmount: 1600, packageSpeed: '3Mbps / 300GB' }, SEP_15);
  before = generateMonthlyBillsThroughCurrentMonth(before, SEP_15);
  before = addPayment(before, 'seed-001', '2026-09', { date: '2026-09-20', amount: 1600, method: 'Cash' }, SEP_20);
  before = generateMonthlyBillsThroughCurrentMonth(before, OCT_2);
  assert.equal(Number(billOf(before, '2026-10').dueAmount), 1600);
  const { nextState, receipt } = executeQuickCollection(before, {
    customerId: 'seed-001', month: '2026-10', amount: 1000, date: '2026-10-05', method: 'Cash'
  }, OCT_5);
  assert.deepEqual(receipt.packageAutoSet, { fee: 1000, packageLabel: '3Mbps / 100GB' });
  assert.equal(customerOf(nextState).monthlySellingAmount, 1000);
  assert.equal(Number(billOf(nextState, '2026-10').dueAmount), 1600, 'the priced bill is never repriced');
  assert.equal(balanceOf(nextState, '2026-10'), 60000, 'remaining 600 still due');
  const november = generateMonthlyBillsThroughCurrentMonth(nextState, NOV_2);
  assert.equal(Number(billOf(november, '2026-11').dueAmount), 1000);
});

// --- §8.4 Req 2 follow (unpriced month, regression) ---

test('Req 2 unpriced regression: package-less customer pays 2,000 -> package 2,000, bill stands at 2,000, next month bills 2,000', () => {
  const before = createInitialState(['Unpriced Tester']);
  const { nextState, receipt } = executeQuickCollection(before, {
    customerId: 'seed-001', month: '2026-10', amount: 2000, date: '2026-10-10', method: 'Cash'
  }, OCT_10);
  assert.deepEqual(receipt.packageAutoSet, { fee: 2000, packageLabel: '5Mbps / 200GB' });
  assert.equal(customerOf(nextState).monthlySellingAmount, 2000);
  assert.equal(Number(billOf(nextState, '2026-10').dueAmount), 2000);
  assert.equal(balanceOf(nextState, '2026-10'), 0);
  const november = generateMonthlyBillsThroughCurrentMonth(nextState, NOV_2);
  assert.equal(Number(billOf(november, '2026-11').dueAmount), 2000);
});

// --- §8.5 Req 2 guards ---

test('Req 2 guards: advance, voided, older-month, archived and free payments never move the package', () => {
  // Advance (Quick Collect advance path) on a priced month.
  let priced = septemberSettledState();
  priced = generateMonthlyBillsThroughCurrentMonth(priced, OCT_2);
  const advanced = executeQuickCollection(priced, {
    customerId: 'seed-001', month: '2026-10', amount: 2000, date: '2026-10-29', method: 'Cash', kind: 'advance'
  }, OCT_29);
  assert.equal(advanced.receipt.packageAutoSet, null);
  assert.equal(customerOf(advanced.nextState).monthlySellingAmount, 2000);
  // Advance via the profile record path.
  const viaProfile = recordAdvancePayment(priced, 'seed-001', { amount: 2000, date: '2026-10-29', method: 'Cash' }, OCT_29);
  const { autoPackage: advanceFollow } = autoPackageFromPayment(priced, viaProfile.nextState, 'seed-001', '2026-10', viaProfile.payment.id, OCT_29);
  assert.equal(advanceFollow, null);
  // Voided trigger.
  let packageless = createInitialState(['Guard Tester']);
  const after = addPayment(packageless, 'seed-001', '2026-10', { date: '2026-10-10', amount: 2000, method: 'Cash' }, OCT_10);
  const payment = billOf(after, '2026-10').payments[0];
  const { state: voided } = voidPayment(after, 'seed-001', '2026-10', payment.id, { voidReason: 'Test void' });
  const { autoPackage: voidFollow } = autoPackageFromPayment(packageless, voided, 'seed-001', '2026-10', payment.id, OCT_10);
  assert.equal(voidFollow, null);
  assert.equal(customerOf(voided).monthlySellingAmount, null);
  // Older-month payment.
  let older = createInitialState(['Guard Tester']);
  older = addPayment(older, 'seed-001', '2026-09', { date: '2026-09-10', amount: 1000, method: 'Cash' }, SEP_15);
  older = addPayment(older, 'seed-001', '2026-10', { date: '2026-10-03', amount: 1000, method: 'Cash' }, OCT_5);
  const olderAfter = addPayment(older, 'seed-001', '2026-09', { date: '2026-10-06', amount: 500, method: 'Cash' }, OCT_10);
  const olderPayment = billOf(olderAfter, '2026-09').payments.at(-1);
  const { autoPackage: olderFollow } = autoPackageFromPayment(older, olderAfter, 'seed-001', '2026-09', olderPayment.id, OCT_10);
  assert.equal(olderFollow, null);
  // Archived customer: addPayment refuses archived customers, so the
  // after-state is built by hand — even if a payment somehow exists
  // on an archived customer, the follow must never fire.
  let archived = septemberSettledState();
  archived = generateMonthlyBillsThroughCurrentMonth(archived, OCT_2);
  archived = archiveCustomer(archived, 'seed-001', OCT_2);
  const archivedAfter = {
    ...archived,
    customers: archived.customers.map(c => c.id !== 'seed-001' ? c : {
      ...c,
      bills: c.bills.map(b => b.month !== '2026-10' ? b : {
        ...b,
        payments: [...(b.payments ?? []), { id: 'archived-pay-1', amount: 1000, date: '2026-10-05', method: 'Cash' }],
      }),
    }),
  };
  const { autoPackage: archivedFollow } = autoPackageFromPayment(archived, archivedAfter, 'seed-001', '2026-10', 'archived-pay-1', OCT_5);
  assert.equal(archivedFollow, null);
  // Free connection.
  let freeState = createInitialState([]);
  freeState = addCustomer(freeState, 'Free Tester', OCT_5, { isFreeConnection: true });
  const free = freeState.customers.find(c => c.name === 'Free Tester');
  const freeAfter = addPayment(freeState, free.id, '2026-10', { date: '2026-10-10', amount: 2000, method: 'Cash' }, OCT_10);
  const freePayment = freeAfter.customers.find(c => c.id === free.id).bills.find(b => b.month === '2026-10').payments[0];
  const { autoPackage: freeFollow } = autoPackageFromPayment(freeState, freeAfter, free.id, '2026-10', freePayment.id, OCT_10);
  assert.equal(freeFollow, null);
});

test('Req 2 guards: same-amount is a strict no-op, and the helper never throws on a missing payment', () => {
  const before = septemberSettledState();
  const { nextState, receipt } = executeQuickCollection(before, {
    customerId: 'seed-001', month: '2026-10', amount: 2000, date: '2026-10-05', method: 'Cash'
  }, OCT_5);
  assert.equal(receipt.packageAutoSet, null);
  assert.deepEqual(customerOf(nextState).packageHistory, customerOf(before).packageHistory);
  assert.deepEqual(customerOf(nextState).monthlyPriceSchedule, customerOf(before).monthlyPriceSchedule);
  const { autoPackage, nextState: missingNext } = autoPackageFromPayment(before, before, 'seed-001', '2026-10', 'no-such-payment', OCT_10);
  assert.equal(autoPackage, null);
  assert.equal(missingNext, before, 'no change when there is nothing to follow');
});

// --- §8.6 Req 2 "fetch" repro ---

test('Req 2 fetch repro: bill priced 1,600 + last payment 1,000 -> the payment screen shows 1,600 (the current bill), never 1,000', () => {
  let state = createInitialState(['Fetch Tester']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: 1000, packageSpeed: '3Mbps / 100GB' }, SEP_15);
  state = generateMonthlyBillsThroughCurrentMonth(state, SEP_15);
  state = addPayment(state, 'seed-001', '2026-09', { date: '2026-09-20', amount: 1000, method: 'Cash' }, SEP_20);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: 1600, packageSpeed: '3Mbps / 300GB' }, OCT_2);
  state = generateMonthlyBillsThroughCurrentMonth(state, OCT_2);
  const defaults = getCustomerPaymentDefaults(state, 'seed-001', OCT_5);
  assert.equal(defaults.targetMonth, '2026-10');
  assert.equal(defaults.balanceDue, 1600, 'the offered bill figure is the current 1,600 bill, not the last 1,000 payment');
  assert.equal(defaults.suggestedAmount, 1600);
  assert.equal(defaults.prefill.month, '2026-10');
  assert.equal(defaults.prefill.amount, 1600);
  assert.notEqual(defaults.suggestedAmount, 1000, 'the last payment amount never leaks into the default');
  // And after recording a 1,000 payment the profile package is 1,000.
  const { nextState } = executeQuickCollection(state, {
    customerId: 'seed-001', month: '2026-10', amount: 1000, date: '2026-10-05', method: 'Cash'
  }, OCT_5);
  assert.equal(customerOf(nextState).monthlySellingAmount, 1000);
  assert.equal(customerOf(nextState).packageSpeed, '3Mbps / 100GB');
});

// --- §8.7 Req 3 receipt ---

function taxedReceiptFixture() {
  const bill = {
    id: 'bill-2026-11', month: '2026-11', dueAmount: 1195, status: 'pending', payments: [],
    packageSnapshot: createBillPackageSnapshot('3mbps-100gb'),
    salesTaxCents: 19500, salesTaxRateBps: 1950,
  };
  const payment = { id: 'pay-1', amount: 1195, date: '2026-11-07', method: 'Cash' };
  bill.payments = [payment];
  const customer = {
    id: 'synthetic-customer', customerNumber: 42, name: 'Synthetic Customer',
    packageSpeed: '3Mbps / 100GB', packageHistory: [], bills: [bill],
  };
  return { customer, bill, payment };
}

test('Req 3 receipt: a taxed 1,000 receipt shows the tax line and total 1,195 in the receipt object, the HTML receipt, and the WhatsApp text', () => {
  const { customer, bill, payment } = taxedReceiptFixture();
  const receipt = buildPaymentReceipt(customer, bill, payment);
  assert.equal(receipt.salesTaxCents, 19500);
  assert.equal(receipt.totalBilled, 1195);
  assert.equal(receipt.status, 'PAID');
  const a4 = generatePaymentReceiptHtml(receipt, { format: 'a4' });
  assert.match(a4, /Sales tax \/ سیلز ٹیکس \(19\.5%\)/);
  assert.ok(a4.includes('+PKR 195'), 'the A4 receipt shows the tax as +PKR 195');
  const thermal80 = generatePaymentReceiptHtml(receipt, { format: 'thermal-80' });
  assert.match(thermal80, /Sales tax \/ سیلز ٹیکس \(19\.5%\)/);
  const thermal58 = generatePaymentReceiptHtml(receipt, { format: 'thermal-58' });
  assert.match(thermal58, /Sales tax \/ سیلز ٹیکس \(19\.5%\)/);
  const draft = createReceiptWhatsAppDraft('+92 300 123 4567', {
    customerName: customer.name,
    customerNumber: customer.customerNumber,
    amount: payment.amount,
    date: payment.date,
    method: payment.method,
    month: bill.month,
    billAmount: receipt.nominalPrice,
    balanceDueCents: receipt.balanceDueCents,
    billStatus: 'paid',
    salesTaxCents: receipt.salesTaxCents,
  });
  assert.ok(draft);
  assert.match(draft.message, /🧾 Sales tax \/ سیلز ٹیکس \(19\.5%\): PKR 195/);
});

test('Req 3 receipt: an untaxed receipt shows no tax line anywhere', () => {
  const { customer, bill, payment } = taxedReceiptFixture();
  delete bill.salesTaxCents;
  delete bill.salesTaxRateBps;
  bill.dueAmount = 1000;
  payment.amount = 1000;
  const receipt = buildPaymentReceipt(customer, bill, payment);
  assert.equal(receipt.salesTaxCents, null);
  assert.equal(receipt.totalBilled, 1000);
  const a4 = generatePaymentReceiptHtml(receipt, { format: 'a4' });
  assert.doesNotMatch(a4, /Sales tax/);
  const draft = createReceiptWhatsAppDraft('+92 300 123 4567', {
    customerName: customer.name,
    customerNumber: customer.customerNumber,
    amount: payment.amount,
    date: payment.date,
    method: payment.method,
    month: bill.month,
    billAmount: receipt.nominalPrice,
    balanceDueCents: receipt.balanceDueCents,
    billStatus: 'paid',
  });
  assert.ok(draft);
  assert.doesNotMatch(draft.message, /Sales tax/);
  // The tax line is absent; the "Outstanding: PKR 0" line of a PAID
  // receipt is the balance, never a tax figure.
  assert.doesNotMatch(draft.message, /Sales tax.*PKR 0/);
});

test('Req 3 share draft: the tax figure rides the draft and the match check — a tampered or missing tax fails the match', () => {
  const { customer, bill, payment } = taxedReceiptFixture();
  const receipt = buildPaymentReceipt(customer, bill, payment);
  const draftInput = {
    receiptNumber: receipt.receiptNumber,
    amount: payment.amount,
    method: payment.method,
    date: payment.date,
    month: bill.month,
    customerName: customer.name,
    customerNumber: customer.customerNumber,
    phone: '03012345678',
    salesTaxCents: receipt.salesTaxCents,
  };
  const draft = receiptShareDraftFor(draftInput, 'PAYMENT RECEIPT\nTax: PKR 195');
  assert.ok(draft);
  assert.equal(draft.salesTaxCents, 19500);
  assert.equal(receiptShareDraftMatchesReceipt(draft, draftInput), true);
  assert.equal(receiptShareDraftMatchesReceipt(draft, { ...draftInput, salesTaxCents: 29250 }), false, 'a tampered tax fails the match');
  assert.equal(receiptShareDraftMatchesReceipt(draft, { ...draftInput, salesTaxCents: null }), false, 'a draft whose tax the receipt does not carry fails the match');
  const untaxed = receiptShareDraftFor({ ...draftInput, salesTaxCents: null }, 'PAYMENT RECEIPT');
  assert.ok(untaxed);
  assert.equal(untaxed.salesTaxCents, null);
  assert.equal(receiptShareDraftMatchesReceipt(untaxed, { ...draftInput, salesTaxCents: null }), true);
  const html = receiptShareDraftHtml(draft);
  assert.ok(html.includes('data-rsd-send'), 'the draft offers Send');
  assert.ok(html.includes('data-rsd-dismiss'), 'the draft offers Dismiss');
  assert.ok(html.includes('Receipt share draft'));
});

test('Req 3 share draft: sending is logged via markReceiptShared, and the profile payment path arms the draft', () => {
  const storage = store();
  assert.equal(isReceiptShared('pay-1', storage), null);
  const record = markReceiptShared('pay-1', { method: 'whatsapp', phone: '03012345678', customerId: 'synthetic-customer', customerNumber: 42, amount: 1195 }, storage);
  assert.equal(record.shared, true);
  assert.equal(record.method, 'whatsapp');
  assert.equal(isReceiptShared('pay-1', storage)?.shared, true);
  // The profile payment form's success path arms the draft (wiring pin).
  assert.ok(appSrc.includes('profileShareDraftTarget = { customerId, month: payMonth, paymentId: added.id'), 'onPaymentSubmit arms the share draft for the just-recorded payment');
  assert.ok(appSrc.includes('renderProfileShareDraft()'), 'the draft renders on the profile success view');
  assert.ok(appSrc.includes('executeReceiptWhatsAppShare(liveCustomer, profileShareDraftReceiptInput'), 'Send routes through the existing WhatsApp dispatch');
  assert.ok(appSrc.includes("isReceiptShared(target.paymentId)"), 'an already-shared receipt never re-shows its draft');
  assert.ok(pageSrc.includes('id="stxProfileShareDraft"'), 'the profile carries the share-draft host');
});

// --- §8.8 Req 4 dashboard ---

test('Req 4 dashboard: rows for 1,000 / 1,600 / 3,000 packages read 195 / 312 / 585, totals sum, and a no-package customer shows no tax', () => {
  const customers = [
    { id: 'c1', name: 'Customer One', customerNumber: 1, monthlySellingAmount: 1000, bills: [{ month: '2026-11', salesTaxCents: 19500, dueAmount: 1195, payments: [] }] },
    { id: 'c2', name: 'Customer Two', customerNumber: 2, monthlySellingAmount: 1600, bills: [{ month: '2026-11', salesTaxCents: 31200, dueAmount: 1912, payments: [] }] },
    { id: 'c3', name: 'Customer Three', customerNumber: 3, monthlySellingAmount: 3000, bills: [{ month: '2026-11', salesTaxCents: 58500, dueAmount: 3585, payments: [] }] },
    { id: 'c4', name: 'Customer Four', customerNumber: 4, monthlySellingAmount: null, bills: [] },
  ];
  const rows = salesTaxDashboardRows(customers, '2026-11');
  assert.equal(rows.length, 4);
  const byName = Object.fromEntries(rows.map(row => [row.customerName, row]));
  assert.equal(byName['Customer One'].taxCents, 19500);
  assert.equal(byName['Customer Two'].taxCents, 31200);
  assert.equal(byName['Customer Three'].taxCents, 58500);
  assert.equal(byName['Customer Four'].taxCents, null);
  assert.equal(byName['Customer Four'].hasPackage, false);
  assert.equal(formatSalesTaxAmount(byName['Customer Four'].taxCents), 'Not set');
  const totals = salesTaxDashboardTotals(rows);
  assert.equal(totals.derivedTotalCents, 19500 + 31200 + 58500);
  assert.equal(totals.chargedTotalCents, 19500 + 31200 + 58500);
  assert.equal(totals.taxedCustomerCount, 3);
  assert.equal(totals.noPackageCount, 1);
  assert.equal(totals.customerCount, 4);
  // Rows sort by name, then customer number.
  assert.deepEqual(rows.map(row => row.customerName), ['Customer Four', 'Customer One', 'Customer Three', 'Customer Two']);
});

test('Req 4 dashboard: the charged line sums recorded bill tax only — a voided payment never changes it — archived customers are excluded, and the dashboard changes no record', () => {
  let state = createInitialState(['Dashboard Tester']);
  state = saveBillMonth(state, 'seed-001', { month: '2026-11', status: 'pending', packageId: '3mbps-100gb', salesTaxCents: 19500 }, NOV_2);
  state = addPayment(state, 'seed-001', '2026-11', { date: '2026-11-07', amount: 1195, method: 'Cash' }, NOV_7);
  const beforeJson = JSON.stringify(state);
  const rowsBefore = salesTaxDashboardRows(state.customers, '2026-11');
  assert.equal(rowsBefore[0].billTaxCents, 19500);
  assert.equal(salesTaxDashboardTotals(rowsBefore).chargedTotalCents, 19500);
  assert.equal(JSON.stringify(state), beforeJson, 'reading the dashboard changes no record');
  // Void the payment: the bill still carries its tax.
  const payment = billOf(state, '2026-11').payments[0];
  const { state: voided } = voidPayment(state, 'seed-001', '2026-11', payment.id, { voidReason: 'Test void' });
  const rowsAfter = salesTaxDashboardRows(voided.customers, '2026-11');
  assert.equal(rowsAfter[0].billTaxCents, 19500, 'tax is on the bill, not the payment');
  assert.equal(salesTaxDashboardTotals(rowsAfter).chargedTotalCents, 19500);
  // Archived customers never appear.
  const archived = archiveCustomer(voided, 'seed-001', NOV_2);
  assert.equal(salesTaxDashboardRows(archived.customers, '2026-11').length, 0);
});

test('Req 4 wiring: the dashboard rides the monthly billing report and follows its month', () => {
  assert.ok(appSrc.includes('renderSalesTaxDashboard(state, month)'), 'the monthly report renders the tax dashboard');
  assert.ok(appSrc.includes('salesTaxDashboardRows(state.customers, month)'), 'rows come from the pure helper');
  assert.ok(pageSrc.includes('id="stxTaxDashboard"'), 'the reports view carries the dashboard host');
});

// --- §8.9 Req 5 profile ---
test('Req 5 profile: 1,000 -> PKR 195, 1,500 -> PKR 292.5, no package -> Not set; after a follow the line updates with no manual edit', () => {
  assert.equal(formatSalesTaxAmount(customerSalesTaxCents({ monthlySellingAmount: 1000 })), 'PKR 195');
  assert.equal(formatSalesTaxAmount(customerSalesTaxCents({ monthlySellingAmount: 1500 })), 'PKR 292.5');
  assert.equal(formatSalesTaxAmount(customerSalesTaxCents({ monthlySellingAmount: 1600 })), 'PKR 312');
  assert.equal(formatSalesTaxAmount(customerSalesTaxCents({ monthlySellingAmount: 2000 })), 'PKR 390');
  assert.equal(formatSalesTaxAmount(customerSalesTaxCents({ monthlySellingAmount: 2500 })), 'PKR 487.5');
  assert.equal(formatSalesTaxAmount(customerSalesTaxCents({ monthlySellingAmount: 3000 })), 'PKR 585');
  assert.equal(formatSalesTaxAmount(customerSalesTaxCents({})), 'Not set');
  assert.equal(formatSalesTaxAmount(customerSalesTaxCents(null)), 'Not set');
  // A catalog label wins over the selling amount when both are present.
  assert.equal(customerSalesTaxCents({ packageSpeed: '5Mbps / 200GB', monthlySellingAmount: 1000 }), 39000);
  // After a Req 2 follow the line updates with no manual edit.
  let before = septemberSettledState();
  assert.equal(formatSalesTaxAmount(customerSalesTaxCents(customerOf(before))), 'PKR 390');
  before = generateMonthlyBillsThroughCurrentMonth(before, OCT_2);
  const { nextState } = executeQuickCollection(before, {
    customerId: 'seed-001', month: '2026-10', amount: 1000, date: '2026-10-05', method: 'Cash'
  }, OCT_5);
  assert.equal(customerOf(nextState).monthlySellingAmount, 1000);
  assert.equal(formatSalesTaxAmount(customerSalesTaxCents(customerOf(nextState))), 'PKR 195');
  // Wiring pin: the profile Service group carries the line.
  // Plan 504: the literal label became the i18n key prof_field_sales_tax
  // (EN reads exactly as before, UR reads in Urdu) — the pin now checks
  // the key is used, not the literal.
  assert.ok(appSrc.includes("[t('prof_field_sales_tax'), formatSalesTaxAmount(customerSalesTaxCents(customer))]"), 'the Service group shows the customer tax');
});

// --- Regression: the priced-month follow must not invent a next-month bill ---

test('Req 2 priced follow: collecting September in October does not invent October\'s bill — payable-remaining stays 0', () => {
  // Manual-baqaya pin 1b shape: September bill 3,000 + hand-written
  // baqaya 1,500, collected in full (4,500) in October. The follow
  // sets the package to 3,000 for the next month, but it must not
  // generate October's bill mid-collection — the receipt's
  // payable-remaining would otherwise read 3,000 for a bill the
  // operator never saw.
  let state = { version: 1, nextCustomerNumber: 102, customers: [{ id: 'cust-1', customerNumber: 101, name: 'Synthetic Subscriber', phone: '03001234567', area: 'Test Area', archived: false, isFreeConnection: false, monthlyPriceSchedule: [], relocationLog: [], pauseSkippedMonths: [], bills: [], incidents: [], installmentPlans: [] }] };
  state = saveBillMonth(state, 'cust-1', { month: '2026-09', dueAmount: 3000, status: 'pending' }, new Date('2026-10-15T10:00:00Z'));
  state = addManualBaqayaEntry(state, 'cust-1', { amount: 1500, date: '2026-09-10', note: 'Last month balance' }, new Date('2026-10-15T10:00:00Z'));
  const { nextState, receipt } = executeQuickCollection(state, {
    customerId: 'cust-1', month: '2026-09', amount: 4500, date: '2026-10-15', method: 'Cash'
  }, new Date('2026-10-15T10:00:00Z'));
  assert.equal(receipt.manualBaqayaSettledTotal, 1500);
  assert.equal(receipt.payableRemaining, 0);
  assert.equal(manualBaqayaOutstanding(nextState.customers[0]), 0);
  assert.equal(calculatePaymentAllocations(nextState).forMonth('cust-1', '2026-09').balanceDueCents, 0);
  // The package still followed for the next month — only the
  // mid-collection bill generation is gone.
  assert.equal(nextState.customers[0].monthlySellingAmount, 3000);
  assert.equal(nextState.customers[0].bills.find(b => b.month === '2026-10'), undefined, 'no October bill is invented by the follow');
});

// --- Regression: undo puts the profile back exactly after a follow ---

test('Req 2 undo: reversing a collection that moved the package restores the exact pre-collection customer', () => {
  let before = createInitialState(['Undo Tester']);
  before = saveBillMonth(before, 'seed-001', { month: '2026-10', dueAmount: 3000, status: 'pending' }, OCT_2);
  const { nextState, receipt } = executeQuickCollection(before, {
    customerId: 'seed-001', month: '2026-10', amount: 3000, date: '2026-10-10', method: 'Cash'
  }, OCT_10);
  assert.equal(customerOf(nextState).monthlySellingAmount, 3000, 'the follow moved the package');
  assert.deepEqual(receipt.packageAutoSet, { fee: 3000, packageLabel: '15Mbps Unlimited' });
  const out = reverseCollectedPayment({
    state: nextState, tickets: [], customerId: 'seed-001', paymentId: receipt.paymentId, referenceDate: OCT_10
  });
  assert.deepEqual(out.nextState.customers, before.customers, 'undo restores the exact pre-collection state, package included');
  assert.equal(balanceOf(out.nextState, '2026-10'), 300000);
});

test('Req 2 undo: a newer package change is never clobbered by undoing the older collection', () => {
  let before = createInitialState(['Undo Guard Tester']);
  before = saveBillMonth(before, 'seed-001', { month: '2026-10', dueAmount: 3000, status: 'pending' }, OCT_2);
  const { nextState, receipt } = executeQuickCollection(before, {
    customerId: 'seed-001', month: '2026-10', amount: 3000, date: '2026-10-10', method: 'Cash'
  }, OCT_10);
  // The operator changes the package again after the collection.
  const changed = updateCustomerProfile(nextState, 'seed-001', { monthlySellingAmount: 1500, packageSpeed: '5Mbps / 150GB' }, OCT_10);
  assert.equal(customerOf(changed).monthlySellingAmount, 1500);
  const out = reverseCollectedPayment({
    state: changed, tickets: [], customerId: 'seed-001', paymentId: receipt.paymentId, referenceDate: OCT_10
  });
  assert.equal(customerOf(out.nextState).monthlySellingAmount, 1500, 'the newer package change survives the undo');
  assert.equal(balanceOf(out.nextState, '2026-10'), 300000, 'the payment itself is still undone');
});
