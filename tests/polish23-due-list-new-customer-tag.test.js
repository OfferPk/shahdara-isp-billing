// Polish #23 — Due list: batch new-customer 🔖 tag (first month free).
//
// A tag on a customer's earliest unpaid month waives the whole gross
// (dueAmount + lateFee, tax included) as audited bill fields, so the
// allocation engine reads balanceDueCents 0 and the customer drops out
// of the Pending due list by the existing totalDues > 0 rule. The bill
// itself is never rewritten, so untagging restores it in full.
//
// All fixtures use pattern-fake data only (Test Customer, 03012345678
// family) — never real customer names or numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  saveBillMonth, addPayment, calculatePaymentAllocations,
  applyFirstMonthWaiverToBill, removeFirstMonthWaiverFromBill,
  applyConcessionToBill, applyLateFeeToBill,
  generateMonthlyBillsThroughCurrentMonth, customerJoinMonth,
} from '../core.js';
import { createBillPackageSnapshot } from '../package-catalog.js';
import {
  FIRST_MONTH_WAIVER_REASON_DEFAULT,
  FIRST_MONTH_WAIVER_HISTORY_TYPE,
  FIRST_MONTH_TAG_REMOVED_HISTORY_TYPE,
  firstMonthWaiverOf, isFirstMonthWaived, taggedFirstMonths,
  tagPickerRows, applyTagBatch, untagTaggedMonth, monthLabel,
} from '../new-customer-tag.js';
import { getPendingCollectionCustomers } from '../nav-quick-collect.js';
import {
  salesTaxDashboardRows, salesTaxDashboardTotals, salesTaxReceiptLine,
} from '../package-sales-tax.js';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import { buildPngReceiptModel } from '../png-receipt.js';

// PKT — the app derives the billing month in Asia/Karachi; plain
// toISOString() (UTC) is a month behind between 00:00–05:00 PKT on the 1st.
const now = new Date();
const pkt = new Date(now.getTime() + 5 * 3600 * 1000);
const month = pkt.toISOString().slice(0, 7);
const prevMonth = (() => {
  const [y, m] = month.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
})();
const today = pkt.toISOString().slice(0, 10);
const refDate = pkt;

const fakePhone = n => `0301234567${n}`;
const customer = (id, n, extra = {}) => ({
  id, customerNumber: n, name: `Test Customer ${n}`, phone: fakePhone(n),
  area: 'Jia Musa', mohalla: 'Jia Musa', archived: false, bills: [], ...extra,
});

// A taxed PKR 1,000 package bills PKR 1,195 (PKR 195 tax at 19.5%).
function taxedBill(m, dueAmount = 1195, taxCents = 19500, extra = {}) {
  return {
    id: `bill-${m}`, month: m, dueAmount, status: 'pending', payments: [],
    packageSnapshot: createBillPackageSnapshot('3mbps-100gb'),
    salesTaxCents: taxCents, salesTaxRateBps: 1950, ...extra,
  };
}

function billOf(state, customerId, m) {
  return state.customers.find(c => c.id === customerId).bills.find(b => b.month === m);
}

function balanceDueCentsOf(state, customerId, m) {
  return calculatePaymentAllocations(state).forMonth(customerId, m).balanceDueCents;
}

// --- §1 Apply: gross waived, fields stamped, bill untouched ----------

test('apply stamps the whole gross, keeps dueAmount/priceSnapshot, and zeroes the engine balance', () => {
  let s = { customers: [customer('a', 1)] };
  s = saveBillMonth(s, 'a', { month, dueAmount: 1195, status: 'pending' }, refDate);
  const before = billOf(s, 'a', month);
  const next = applyFirstMonthWaiverToBill(s, 'a', month, {}, refDate);
  const bill = billOf(next, 'a', month);
  assert.equal(bill.firstMonthWaivedAmount, 1195);
  assert.equal(bill.firstMonthWaivedReason, FIRST_MONTH_WAIVER_REASON_DEFAULT);
  assert.equal(typeof bill.firstMonthWaivedAt, 'string');
  assert.equal(bill.dueAmount, 1195, 'dueAmount is never rewritten');
  assert.equal(bill.priceSnapshot, before.priceSnapshot);
  assert.equal(bill.amountHistory.length, (before.amountHistory ?? []).length + 1);
  const entry = bill.amountHistory.at(-1);
  assert.equal(entry.type, FIRST_MONTH_WAIVER_HISTORY_TYPE);
  assert.equal(entry.waivedAmount, 1195);
  assert.equal(entry.previousWaivedAmount, 0);
  assert.equal(balanceDueCentsOf(next, 'a', month), 0);
  assert.ok(isFirstMonthWaived(bill));
  assert.deepEqual(firstMonthWaiverOf(bill), {
    amount: 1195, reason: FIRST_MONTH_WAIVER_REASON_DEFAULT, at: bill.firstMonthWaivedAt,
  });
});

test('apply waives the whole gross incl. tax and a pre-stamped late fee: 1,000 package + 195 tax + 100 fee = 1,295', () => {
  let s = { customers: [customer('a', 1, { bills: [taxedBill(month)] })] };
  s = applyLateFeeToBill(s, 'a', month, { amount: 100, reason: 'Late payment surcharge' }, refDate);
  assert.equal(balanceDueCentsOf(s, 'a', month), 129500);
  const next = applyFirstMonthWaiverToBill(s, 'a', month, {}, refDate);
  const bill = billOf(next, 'a', month);
  assert.equal(bill.firstMonthWaivedAmount, 1295);
  assert.equal(balanceDueCentsOf(next, 'a', month), 0);
});

test('apply zeroes the EARLIEST unpaid month only — a later month stays due', () => {
  let s = { customers: [customer('a', 1)] };
  s = saveBillMonth(s, 'a', { month: prevMonth, dueAmount: 1195, status: 'pending' }, refDate);
  s = saveBillMonth(s, 'a', { month, dueAmount: 1195, status: 'pending' }, refDate);
  const next = applyFirstMonthWaiverToBill(s, 'a', prevMonth, {}, refDate);
  assert.equal(balanceDueCentsOf(next, 'a', prevMonth), 0);
  assert.equal(balanceDueCentsOf(next, 'a', month), 119500);
  assert.ok(isFirstMonthWaived(billOf(next, 'a', prevMonth)));
  assert.ok(!isFirstMonthWaived(billOf(next, 'a', month)));
});

test('a custom reason is stored; a blank reason falls back to the default', () => {
  let s = { customers: [customer('a', 1)] };
  s = saveBillMonth(s, 'a', { month, dueAmount: 1000, status: 'pending' }, refDate);
  const royal = applyFirstMonthWaiverToBill(s, 'a', month, { reason: 'Royal 199 — install + first month' }, refDate);
  assert.equal(billOf(royal, 'a', month).firstMonthWaivedReason, 'Royal 199 — install + first month');
  let s2 = { customers: [customer('b', 2)] };
  s2 = saveBillMonth(s2, 'b', { month, dueAmount: 1000, status: 'pending' }, refDate);
  const blank = applyFirstMonthWaiverToBill(s2, 'b', month, { reason: '   ' }, refDate);
  assert.equal(billOf(blank, 'b', month).firstMonthWaivedReason, FIRST_MONTH_WAIVER_REASON_DEFAULT);
});

// --- §2 Guards: paid / already-tagged / unpriced / missing -----------

test('apply refuses a month with any non-voided payment, naming the customer', () => {
  let s = { customers: [customer('a', 1)] };
  s = saveBillMonth(s, 'a', { month, dueAmount: 1195, status: 'pending' }, refDate);
  s = addPayment(s, 'a', month, { date: today, amount: 500, method: 'Cash' });
  assert.throws(
    () => applyFirstMonthWaiverToBill(s, 'a', month, {}, refDate),
    /already has a payment|payment/i,
  );
});

test('a voided payment is not a payment: the tag still applies to that month', () => {
  // A voided payment settles nothing (SISP-34); the month is still unpaid.
  const bill = {
    id: 'bill-1', month, dueAmount: 1000, status: 'pending',
    payments: [{ id: 'pay-1', amount: 1000, date: today, method: 'Cash', voided: true, voidReason: 'Test void' }],
  };
  const s = { customers: [customer('a', 1, { bills: [bill] })] };
  assert.equal(balanceDueCentsOf(s, 'a', month), 100000, 'voided payment settles nothing');
  const next = applyFirstMonthWaiverToBill(s, 'a', month, {}, refDate);
  assert.equal(billOf(next, 'a', month).firstMonthWaivedAmount, 1000);
  assert.equal(balanceDueCentsOf(next, 'a', month), 0);
});

test('apply refuses an already-tagged month and never stacks', () => {
  let s = { customers: [customer('a', 1)] };
  s = saveBillMonth(s, 'a', { month, dueAmount: 1000, status: 'pending' }, refDate);
  const once = applyFirstMonthWaiverToBill(s, 'a', month, {}, refDate);
  assert.throws(
    () => applyFirstMonthWaiverToBill(once, 'a', month, {}, refDate),
    /already tagged|already waived/i,
  );
  assert.equal(billOf(once, 'a', month).firstMonthWaivedAmount, 1000);
  assert.equal(billOf(once, 'a', month).amountHistory.length, 1);
});

test('apply refuses an unpriced bill and a missing bill', () => {
  let s = { customers: [customer('a', 1)] };
  s = saveBillMonth(s, 'a', { month, dueAmount: 1000, status: 'pending' }, refDate);
  // Unpriced: a bill with no positive gross (dueAmount 0 is unreachable
  // through saveBillMonth, so stamp one directly, as a legacy record).
  const unpriced = { ...s, customers: [{ ...s.customers[0], bills: [{ id: 'bill-x', month, dueAmount: 0, lateFee: 0, status: 'pending', payments: [] }] }] };
  assert.throws(
    () => applyFirstMonthWaiverToBill(unpriced, 'a', month, {}, refDate),
    /unpriced|no amount|greater than zero/i,
  );
  assert.throws(
    () => applyFirstMonthWaiverToBill(s, 'a', prevMonth, {}, refDate),
    /not found/i,
  );
});

// --- §3 Remove: full restore ------------------------------------------

test('remove clears the fields, records the audit entry, and restores the full bill', () => {
  let s = { customers: [customer('a', 1, { bills: [taxedBill(month)] })] };
  const tagged = applyFirstMonthWaiverToBill(s, 'a', month, {}, refDate);
  assert.equal(balanceDueCentsOf(tagged, 'a', month), 0);
  const next = removeFirstMonthWaiverFromBill(tagged, 'a', month, {}, refDate);
  const bill = billOf(next, 'a', month);
  assert.equal(bill.firstMonthWaivedAmount, 0);
  assert.equal(bill.firstMonthWaivedReason, 'Tag removed by owner');
  assert.equal(bill.firstMonthWaivedAt, null);
  assert.equal(bill.dueAmount, 1195);
  assert.equal(bill.salesTaxCents, 19500);
  assert.equal(balanceDueCentsOf(next, 'a', month), 119500);
  const entry = bill.amountHistory.at(-1);
  assert.equal(entry.type, FIRST_MONTH_TAG_REMOVED_HISTORY_TYPE);
  assert.equal(entry.previousWaivedAmount, 1195);
  assert.equal(entry.waivedAmount, 0);
  assert.ok(!isFirstMonthWaived(bill));
});

test('remove is a no-op (same state) on an untagged bill', () => {
  let s = { customers: [customer('a', 1)] };
  s = saveBillMonth(s, 'a', { month, dueAmount: 1000, status: 'pending' }, refDate);
  assert.equal(removeFirstMonthWaiverFromBill(s, 'a', month, {}, refDate), s);
});

test('untagTaggedMonth restores the earliest tagged month for a customer', () => {
  let s = { customers: [customer('a', 1)] };
  s = saveBillMonth(s, 'a', { month, dueAmount: 1000, status: 'pending' }, refDate);
  const tagged = applyFirstMonthWaiverToBill(s, 'a', month, {}, refDate);
  const next = untagTaggedMonth(tagged, 'a', month, {}, refDate);
  assert.equal(balanceDueCentsOf(next, 'a', month), 100000);
});

// --- §4 Due list: tagged customers drop out, baqaya stays -------------

test('a tagged customer drops out of Pending (and High Dues) and returns on untag', () => {
  let s = { customers: [customer('a', 1), customer('b', 2)] };
  s = saveBillMonth(s, 'a', { month, dueAmount: 2500, status: 'pending' }, refDate);
  s = saveBillMonth(s, 'b', { month, dueAmount: 2500, status: 'pending' }, refDate);
  assert.deepEqual(getPendingCollectionCustomers(s, '', 'all-dues').map(r => r.id), ['a', 'b']);
  assert.deepEqual(getPendingCollectionCustomers(s, '', 'high-dues').map(r => r.id), ['a', 'b']);
  const tagged = applyFirstMonthWaiverToBill(s, 'a', month, {}, refDate);
  assert.deepEqual(getPendingCollectionCustomers(tagged, '', 'all-dues').map(r => r.id), ['b']);
  assert.deepEqual(getPendingCollectionCustomers(tagged, '', 'high-dues').map(r => r.id), ['b']);
  assert.ok(getPendingCollectionCustomers(tagged, '', 'all').some(r => r.id === 'a'), 'All still lists the tagged customer as settled');
  const untagged = removeFirstMonthWaiverFromBill(tagged, 'a', month, {}, refDate);
  assert.deepEqual(getPendingCollectionCustomers(untagged, '', 'all-dues').map(r => r.id), ['a', 'b']);
});

test('a tagged customer with a manual baqaya still shows with only the baqaya figure', () => {
  const withBaqaya = customer('a', 1, {
    manualBaqaya: [{ id: 'MBQ-1', amount: 500, note: 'Test baqaya', date: today, createdAt: today }],
  });
  let s = { customers: [withBaqaya] };
  s = saveBillMonth(s, 'a', { month, dueAmount: 1195, status: 'pending' }, refDate);
  assert.equal(getPendingCollectionCustomers(s, '', 'all-dues')[0].totalDues, 1695);
  const tagged = applyFirstMonthWaiverToBill(s, 'a', month, {}, refDate);
  const rows = getPendingCollectionCustomers(tagged, '', 'all-dues');
  assert.equal(rows.length, 1, 'baqaya alone keeps the customer in Pending');
  assert.equal(rows[0].totalDues, 500, 'only the baqaya remains — the bill is 0');
  assert.equal(rows[0].billDues, 0);
});

test('tagging one month never touches another month or another customer', () => {
  let s = { customers: [customer('a', 1), customer('b', 2)] };
  s = saveBillMonth(s, 'a', { month: prevMonth, dueAmount: 1000, status: 'pending' }, refDate);
  s = saveBillMonth(s, 'a', { month, dueAmount: 1000, status: 'pending' }, refDate);
  s = saveBillMonth(s, 'b', { month, dueAmount: 1000, status: 'pending' }, refDate);
  const next = applyFirstMonthWaiverToBill(s, 'a', prevMonth, {}, refDate);
  assert.equal(balanceDueCentsOf(next, 'a', month), 100000);
  assert.equal(balanceDueCentsOf(next, 'b', month), 100000);
});

// --- §5 Batch: picker rows, sort, all-or-nothing ----------------------

test('tagPickerRows lists the Pending population with target month + waived figure, new-this-month first, none pre-selected', () => {
  const joinedThisMonth = customer('a', 1, { addedOn: today, bills: [taxedBill(month)] });
  const joinedEarlier = customer('b', 2, { addedOn: '2026-09-15', bills: [taxedBill(month)] });
  const paidUp = customer('c', 3, { addedOn: today, bills: [taxedBill(month)] });
  let s = { customers: [joinedEarlier, paidUp, joinedThisMonth] };
  s = addPayment(s, 'c', month, { date: today, amount: 1195, method: 'Cash' });
  const rows = tagPickerRows(s, '', refDate);
  // Paid-up customers never appear in the Pending population.
  assert.deepEqual(rows.map(r => r.customerId), ['a', 'b']);
  const [first, second] = rows;
  assert.equal(first.customerId, 'a');
  assert.equal(first.isNewThisMonth, true, 'joined this month');
  assert.equal(first.selected, false, 'never pre-selected');
  assert.equal(first.targetMonth, month);
  assert.equal(first.waivedAmount, 1195);
  assert.equal(first.monthLabel, monthLabel(month));
  assert.equal(second.isNewThisMonth, false);
  assert.equal(second.selected, false);
});

test('tagPickerRows search matches name, phone, area and customer number', () => {
  let s = { customers: [customer('a', 1), customer('b', 2)] };
  s = saveBillMonth(s, 'a', { month, dueAmount: 1000, status: 'pending' }, refDate);
  s = saveBillMonth(s, 'b', { month, dueAmount: 1000, status: 'pending' }, refDate);
  assert.deepEqual(tagPickerRows(s, 'customer 2', refDate).map(r => r.customerId), ['b']);
  assert.deepEqual(tagPickerRows(s, '03012345671', refDate).map(r => r.customerId), ['a']);
  assert.deepEqual(tagPickerRows(s, '#2', refDate).map(r => r.customerId), ['b']);
  assert.deepEqual(tagPickerRows(s, 'jia musa', refDate).map(r => r.customerId), ['a', 'b']);
});

test('tagPickerRows flags a partially-paid target month as untaggable, and excludes already-tagged months', () => {
  let s = { customers: [customer('a', 1), customer('b', 2)] };
  s = saveBillMonth(s, 'a', { month, dueAmount: 1000, status: 'pending' }, refDate);
  s = saveBillMonth(s, 'b', { month, dueAmount: 1000, status: 'pending' }, refDate);
  s = addPayment(s, 'a', month, { date: today, amount: 400, method: 'Cash' });
  const rows = tagPickerRows(s, '', refDate);
  const partial = rows.find(r => r.customerId === 'a');
  assert.equal(partial.canTag, false);
  assert.match(partial.cannotTagReason, /payment/i);
  assert.equal(rows.find(r => r.customerId === 'b').canTag, true);
  const tagged = applyFirstMonthWaiverToBill(s, 'b', month, {}, refDate);
  assert.deepEqual(tagPickerRows(tagged, '', refDate).map(r => r.customerId), ['a'], 'tagged month leaves the picker');
});

test('applyTagBatch tags every selected customer and reports each waived figure', () => {
  let s = { customers: [customer('a', 1), customer('b', 2)] };
  s = saveBillMonth(s, 'a', { month, dueAmount: 1195, status: 'pending' }, refDate);
  s = saveBillMonth(s, 'b', { month, dueAmount: 1000, status: 'pending' }, refDate);
  const { nextState, applied } = applyTagBatch(s, ['a', 'b'], {}, refDate);
  assert.equal(applied.length, 2);
  assert.deepEqual(applied.map(a => a.waivedAmount), [1195, 1000]);
  assert.deepEqual(applied.map(a => a.month), [month, month]);
  assert.equal(balanceDueCentsOf(nextState, 'a', month), 0);
  assert.equal(balanceDueCentsOf(nextState, 'b', month), 0);
  assert.deepEqual(getPendingCollectionCustomers(nextState, '', 'all-dues'), []);
});

test('applyTagBatch is all-or-nothing: one un-taggable customer rolls the whole batch back, naming them', () => {
  let s = { customers: [customer('a', 1), customer('b', 2)] };
  s = saveBillMonth(s, 'a', { month, dueAmount: 1000, status: 'pending' }, refDate);
  s = saveBillMonth(s, 'b', { month, dueAmount: 1000, status: 'pending' }, refDate);
  s = addPayment(s, 'b', month, { date: today, amount: 1000, method: 'Cash' });
  assert.throws(
    () => applyTagBatch(s, ['a', 'b'], {}, refDate),
    /Test Customer 2/i,
  );
  // Nothing was applied: 'a' still owes in the ORIGINAL state.
  assert.equal(balanceDueCentsOf(s, 'a', month), 100000);
  assert.equal(billOf(s, 'a', month).firstMonthWaivedAmount, undefined);
});

test('applyTagBatch refuses an archived customer and an empty selection', () => {
  // saveBillMonth refuses archived customers, so the archived fixture
  // carries its bill literally (the bill exists; the customer is archived).
  const s = { customers: [customer('a', 1, { archived: true, bills: [{ id: 'bill-1', month, dueAmount: 1000, status: 'pending', payments: [] }] })] };
  assert.throws(() => applyTagBatch(s, ['a'], {}, refDate), /archived/i);
  let s2 = { customers: [customer('b', 2)] };
  assert.throws(() => applyTagBatch(s2, [], {}, refDate), /at least one/i);
});

test('applyTagBatch generates the missing target bill first (customer added today, no bill yet)', () => {
  const fresh = customer('a', 1, {
    addedOn: today, billingStartMonth: month,
    monthlyPriceSchedule: [{ effectiveMonth: month, amount: 1195 }],
  });
  const s = { customers: [fresh] };
  assert.equal(billOf(s, 'a', month), undefined);
  const { nextState, applied } = applyTagBatch(s, ['a'], {}, refDate);
  assert.equal(applied.length, 1);
  assert.equal(applied[0].waivedAmount, 1195);
  assert.equal(billOf(nextState, 'a', month).dueAmount, 1195);
  assert.equal(balanceDueCentsOf(nextState, 'a', month), 0);
});

// --- §6 Tax: dashboard excludes tagged months -------------------------

test('sales-tax dashboard charged total excludes tagged months; derived total is unchanged', () => {
  const customers = [
    { id: 'c1', name: 'Customer One', customerNumber: 1, monthlySellingAmount: 1000, bills: [{ month, salesTaxCents: 19500, dueAmount: 1195, payments: [] }] },
    { id: 'c2', name: 'Customer Two', customerNumber: 2, monthlySellingAmount: 1000, bills: [{ month, salesTaxCents: 19500, dueAmount: 1195, payments: [] }] },
  ];
  let rows = salesTaxDashboardRows(customers, month);
  assert.equal(salesTaxDashboardTotals(rows).chargedTotalCents, 39000);
  const taggedCustomers = customers.map((c, i) => (i === 0 ? {
    ...c,
    bills: [{ ...c.bills[0], firstMonthWaivedAmount: 1195, firstMonthWaivedReason: FIRST_MONTH_WAIVER_REASON_DEFAULT, firstMonthWaivedAt: `${today}T00:00` }],
  } : c));
  rows = salesTaxDashboardRows(taggedCustomers, month);
  const byName = Object.fromEntries(rows.map(row => [row.customerName, row]));
  assert.equal(byName['Customer One'].billTaxCents, 0, 'tagged month charges no tax');
  assert.equal(byName['Customer One'].firstMonthWaived, true);
  assert.equal(byName['Customer Two'].billTaxCents, 19500);
  const totals = salesTaxDashboardTotals(rows);
  assert.equal(totals.chargedTotalCents, 19500);
  assert.equal(totals.derivedTotalCents, 39000, 'derived "tax on the books" is unchanged');
});

test('salesTaxReceiptLine is null on a tagged bill, so no receipt carries a tax line for it', () => {
  const bill = taxedBill(month);
  assert.deepEqual(salesTaxReceiptLine(bill), { label: 'Sales tax / سیلز ٹیکس (19.5%)', taxCents: 19500 });
  const tagged = { ...bill, firstMonthWaivedAmount: 1195 };
  assert.equal(salesTaxReceiptLine(tagged), null);
});

// --- §7 Receipts: waived line, PKR 0 reads Paid ------------------------

test('a receipt for a tagged bill shows the First month included line, nets to PKR 0 and reads Paid', () => {
  const bill = taxedBill(month);
  const payment = { id: 'pay-1', amount: 0, date: today, method: 'Cash' };
  // A tagged month carries no payment in the real flow; build the receipt
  // the way a later itemisation would — a zero-amount record on the bill
  // — so the waived line and the PKR 0 balance are pinned, never PKR 0 (Due).
  const taggedBill = { ...bill, payments: [payment], firstMonthWaivedAmount: 1195, firstMonthWaivedReason: FIRST_MONTH_WAIVER_REASON_DEFAULT, firstMonthWaivedAt: `${today}T00:00` };
  const customerObj = { id: 'a', customerNumber: 1, name: 'Test Customer 1', bills: [taggedBill] };
  const receipt = buildPaymentReceipt(customerObj, taggedBill, payment);
  assert.equal(receipt.firstMonthWaivedAmount, 1195);
  assert.equal(receipt.salesTaxCents, null, 'no tax line on a tagged month');
  assert.equal(receipt.balanceDueCents, 0);
  assert.equal(receipt.status, 'PAID');
  const html = generatePaymentReceiptHtml(receipt, { format: 'thermal-80' });
  assert.match(html, /First month included/);
  assert.match(html, /-PKR 1,195/);
  assert.match(html, /PKR 0 \(.*Paid\)/);
  assert.doesNotMatch(html, /PKR 0 \(.*Due\)/);
  const png = buildPngReceiptModel(receipt, customerObj);
  const waivedLine = png.financial.find(line => /First month included/.test(line.label));
  assert.ok(waivedLine, 'PNG slip carries the waived line');
  assert.match(waivedLine.value, /1,195/);
});

// --- §8 Late fee + concession guards on a tagged month -----------------

test('no late fee accrues on a tagged month: applyLateFeeToBill refuses it', () => {
  let s = { customers: [customer('a', 1)] };
  s = saveBillMonth(s, 'a', { month, dueAmount: 1000, status: 'pending' }, refDate);
  const tagged = applyFirstMonthWaiverToBill(s, 'a', month, {}, refDate);
  assert.throws(
    () => applyLateFeeToBill(tagged, 'a', month, { amount: 100 }, refDate),
    /tagged|first month/i,
  );
  assert.equal(billOf(tagged, 'a', month).lateFee ?? 0, 0);
});

test('a concession cannot be applied to an already-tagged month', () => {
  let s = { customers: [customer('a', 1)] };
  s = saveBillMonth(s, 'a', { month, dueAmount: 1000, status: 'pending' }, refDate);
  const tagged = applyFirstMonthWaiverToBill(s, 'a', month, {}, refDate);
  assert.throws(
    () => applyConcessionToBill(tagged, 'a', month, { amount: 100, reason: 'Outage Reaayat' }, refDate),
    /tagged|first month/i,
  );
});

test('a concession applied BEFORE the tag stays honest: the tag waives the gross, the engine clamps, balance is 0', () => {
  let s = { customers: [customer('a', 1)] };
  s = saveBillMonth(s, 'a', { month, dueAmount: 1000, status: 'pending' }, refDate);
  s = applyConcessionToBill(s, 'a', month, { amount: 100, reason: 'Outage Reaayat' }, refDate);
  assert.equal(balanceDueCentsOf(s, 'a', month), 90000);
  const tagged = applyFirstMonthWaiverToBill(s, 'a', month, {}, refDate);
  assert.equal(billOf(tagged, 'a', month).firstMonthWaivedAmount, 1000);
  assert.equal(balanceDueCentsOf(tagged, 'a', month), 0, 'stacked waivers clamp, never go negative');
});

// --- §9 Badge data: tagged months + join month -------------------------

test('taggedFirstMonths lists every tagged month, newest first, with amount + reason', () => {
  let s = { customers: [customer('a', 1)] };
  s = saveBillMonth(s, 'a', { month: prevMonth, dueAmount: 1000, status: 'pending' }, refDate);
  s = saveBillMonth(s, 'a', { month, dueAmount: 1000, status: 'pending' }, refDate);
  const tagged = applyFirstMonthWaiverToBill(s, 'a', prevMonth, {}, refDate);
  assert.deepEqual(taggedFirstMonths(tagged.customers[0]), [
    { month: prevMonth, amount: 1000, reason: FIRST_MONTH_WAIVER_REASON_DEFAULT },
  ]);
  assert.deepEqual(taggedFirstMonths(customer('b', 2)), []);
});

test('customerJoinMonth: addedOn wins, and a join-this-month customer is flagged', () => {
  assert.equal(customerJoinMonth(customer('a', 1, { addedOn: today })), month);
  assert.equal(customerJoinMonth(customer('b', 2, { addedOn: '2026-09-15' })), '2026-09');
  assert.equal(monthLabel(month), pkt.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }));
  assert.match(monthLabel(month), /^[A-Z][a-z]{2} \d{4}$/);
});

// --- §10 Pins: existing waiver behaviour is untouched ------------------

test('pin: outage concession, referral credit and feeder-host credit still subtract exactly as before', () => {
  let s = { customers: [customer('a', 1)] };
  s = saveBillMonth(s, 'a', { month, dueAmount: 1000, status: 'pending' }, refDate);
  s = applyConcessionToBill(s, 'a', month, { amount: 100, reason: 'Outage Reaayat' }, refDate);
  assert.equal(balanceDueCentsOf(s, 'a', month), 90000);
  assert.ok(!isFirstMonthWaived(billOf(s, 'a', month)), 'a concession is not a first-month tag');
});

test('pin: an untagged taxed bill still shows its tax on the dashboard and the receipt', () => {
  const bill = taxedBill(month);
  const rows = salesTaxDashboardRows(
    [{ id: 'c1', name: 'Customer One', customerNumber: 1, monthlySellingAmount: 1000, bills: [bill] }],
    month,
  );
  assert.equal(rows[0].billTaxCents, 19500);
  assert.equal(rows[0].firstMonthWaived, false);
  assert.equal(salesTaxReceiptLine(bill).taxCents, 19500);
});

// --- §11 Wiring pins: the sheet is mounted once, from app.js ---------

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = f => readFileSync(join(root, f), 'utf8');

test('wiring: app.js imports the tag sheet once (the app.js-only seam), and the sheet inserts ONE button at the top of the picker', () => {
  const app = read('app.js');
  assert.equal(app.split("'./new-customer-tag-sheet.js'").length - 1, 1, 'app.js imports the sheet exactly once');
  const sheet = read('new-customer-tag-sheet.js');
  assert.ok(sheet.includes("btn.id = 'nctTagNewCustomersBtn'"), 'the button carries the nct id');
  assert.ok(sheet.includes('pick.insertBefore(btn, pick.firstElementChild)'), 'the button goes first in the picker step');
  assert.ok(sheet.includes("!doc.getElementById('nctTagNewCustomersBtn')"), 'the button is inserted once');
  assert.ok(sheet.includes('applyTagBatch('), 'Apply stamps through the all-or-nothing batch');
  assert.ok(sheet.includes('untagTaggedMonth('), 'the Tagged view untags through the core remove');
  assert.ok(sheet.includes('commitState(nextState)') || sheet.includes('controller.commitState'), 'the sheet saves through the Quick Collect controller');
});

test('wiring: the sheet stylesheet is linked, and the profile renders the badge + the Remove tag action', () => {
  const html = read('index.html');
  assert.ok(html.includes('new-customer-tag.css'), 'index.html links the tag stylesheet');
  const app = read('app.js');
  assert.ok(app.includes('taggedFirstMonths(customer)'), 'profile heading + list card read the tagged months');
  assert.ok(app.includes('data-remove-first-month-waiver'), 'the bill view carries the Remove tag action');
  assert.ok(app.includes("t('prof_first_month_free')"), 'the badge uses the i18n key, not a hardcoded label');
  const css = read('new-customer-tag.css');
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-fA-F]{3,6}\b/, 'the new stylesheet uses tokens only, no hex');
});
