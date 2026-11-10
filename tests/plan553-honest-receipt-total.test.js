// Plan 553 — Every layout shows an honest total.
//
// The receipt's totalBilled is a GROSS figure (nominal price + late fee +
// tax) — it never subtracts the printed deductions — so a plain taxed
// receipt (1000 + 195 tax) showed Billed PKR 1000 and tax PKR 195 on
// every layout and never showed the PKR 1195 total, and thermal-80
// labelled that gross figure "Total Payable" even when a concession
// made it the wrong payable.
//
// The rule pinned here:
//   * a total row appears on all three layouts whenever ANY adjustment
//     exists (tax, late fee, waiver, discount, concession, referral,
//     deposit offset, credit transfer, feeder-host credit), using the
//     existing totalBilled as the gross;
//   * the gross row is labelled "Total Gross Payable" (thermal layouts
//     add " / کل واجب الادا (gross)"), never "Total Payable";
//   * a net row, labelled "Total Payable / کل واجب الادا", appears
//     alongside it only when a deduction exists, and equals gross
//     minus every printed deduction;
//   * an untaxed, unadjusted receipt shows NO total row at all —
//     the plain Billed figure already is the total.
// The late-fee waiver is deliberately NOT a net deduction: SISP-101
// zeroes the bill's lateFee when a waiver exists, so the waived late
// fee was never inside the gross — subtracting it would double-count.
// No real customer names are used anywhere in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';

function fixture({ dueAmount = 1000, month = '2026-08', payments = [] } = {}) {
  const bill = { id: `bill-${month}`, month, dueAmount, status: 'pending', payments };
  const customer = {
    id: 'plan553-customer', customerNumber: 101, name: 'Plan553 Customer',
    packageSpeed: '5 Mbps', packageHistory: [], bills: [bill]
  };
  return { customer, bill };
}
const payment = (id, amount, date, extra = {}) => ({ id, amount, date, method: 'Cash', ...extra });
const layouts = (receipt) => ({
  a4: generatePaymentReceiptHtml(receipt, { format: 'a4' }),
  t80: generatePaymentReceiptHtml(receipt, { format: 'thermal-80' }),
  t58: generatePaymentReceiptHtml(receipt, { format: 'thermal-58' })
});
const GROSS_THERMAL = (figure) => `<dt>Total Gross Payable / کل واجب الادا (gross):</dt><dd>${figure}</dd>`;
const NET_THERMAL = (figure) => `<dt>Total Payable / کل واجب الادا:</dt><dd>${figure}</dd>`;
const GROSS_A4 = (figure) => `<dt>Total Gross Payable</dt><dd class="">${figure}</dd>`;
const NET_A4 = (figure) => `<dt>Total Payable / کل واجب الادا</dt><dd class="">${figure}</dd>`;

test('taxed-only receipt shows a PKR 1195 gross total on all three layouts, and no net row', () => {
  const paid = payment('plan553-taxed', 1195, '2026-08-10');
  const { customer, bill } = fixture({ dueAmount: 1000, payments: [paid] });
  bill.salesTaxCents = 19500;
  const receipt = buildPaymentReceipt(customer, bill, paid);
  assert.equal(receipt.totalBilled, 1195);
  assert.equal(receipt.salesTaxCents, 19500);

  const { a4, t80, t58 } = layouts(receipt);
  assert.ok(a4.includes('+PKR 195'), 'a4: tax row present');
  assert.ok(t80.includes('+PKR 195'), 'thermal-80: tax row present');
  assert.ok(t58.includes('+PKR 195'), 'thermal-58: tax row present');
  assert.ok(a4.includes(GROSS_A4('PKR 1,195')), 'a4: gross total is PKR 1,195');
  assert.ok(t80.includes(GROSS_THERMAL('PKR 1,195')), 'thermal-80: gross total is PKR 1,195');
  assert.ok(t58.includes(GROSS_THERMAL('PKR 1,195')), 'thermal-58: gross total is PKR 1,195');
  for (const [name, html] of Object.entries({ a4, t80, t58 })) {
    assert.doesNotMatch(html, /Total Payable \/ کل واجب الادا/, `${name}: no net row when nothing was deducted`);
  }
});

test('fractional tax: a taxed 1500-package receipt totals PKR 1,792.50 on all three layouts', () => {
  const paid = payment('plan553-taxed-frac', 1792.5, '2026-08-10');
  const { customer, bill } = fixture({ dueAmount: 1500, payments: [paid] });
  bill.salesTaxCents = 29250;
  const receipt = buildPaymentReceipt(customer, bill, paid);
  assert.equal(receipt.totalBilled, 1792.5);

  const { a4, t80, t58 } = layouts(receipt);
  // Plan 555: the shared receipt format prints a fractional figure with
  // two decimals (PKR 1,792.50, like formatPKR) — the intent pinned
  // here, "the same gross total on all three layouts", is unchanged.
  assert.ok(a4.includes(GROSS_A4('PKR 1,792.50')), 'a4: gross total is PKR 1,792.50');
  assert.ok(t80.includes(GROSS_THERMAL('PKR 1,792.50')), 'thermal-80: gross total is PKR 1,792.50');
  assert.ok(t58.includes(GROSS_THERMAL('PKR 1,792.50')), 'thermal-58: gross total is PKR 1,792.50');
});

test('untaxed, unadjusted receipt shows no total row on any layout', () => {
  const paid = payment('plan553-plain', 1000, '2026-08-10');
  const { customer, bill } = fixture({ dueAmount: 1000, payments: [paid] });
  const receipt = buildPaymentReceipt(customer, bill, paid);
  assert.equal(receipt.totalBilled, 1000);

  for (const [name, html] of Object.entries(layouts(receipt))) {
    assert.doesNotMatch(html, /Total Gross Payable/, `${name}: no gross row on a plain receipt`);
    assert.doesNotMatch(html, /Total Payable \/ کل واجب الادا/, `${name}: no net row on a plain receipt`);
  }
});

test('PKR 200 concession: the gross is labelled gross on all three layouts and the net PKR 800 is the payable figure', () => {
  const paid = payment('plan553-concession', 800, '2026-08-10');
  const { customer, bill } = fixture({ dueAmount: 1000, payments: [paid] });
  bill.concessionAmount = 200;
  bill.concessionReason = 'Outage Reaayat: 72h offline';
  const receipt = buildPaymentReceipt(customer, bill, paid);
  assert.equal(receipt.totalBilled, 1000);
  assert.equal(receipt.concessionAmount, 200);

  const { a4, t80, t58 } = layouts(receipt);
  assert.ok(a4.includes('-PKR 200'), 'a4: concession row present');
  assert.ok(a4.includes(GROSS_A4('PKR 1,000')), 'a4: gross total is PKR 1,000');
  assert.ok(a4.includes(NET_A4('PKR 800')), 'a4: net payable is PKR 800');
  assert.ok(t80.includes(GROSS_THERMAL('PKR 1,000')), 'thermal-80: gross total is PKR 1,000');
  assert.ok(t80.includes(NET_THERMAL('PKR 800')), 'thermal-80: net payable is PKR 800');
  assert.ok(t58.includes(GROSS_THERMAL('PKR 1,000')), 'thermal-58: gross total is PKR 1,000');
  assert.ok(t58.includes(NET_THERMAL('PKR 800')), 'thermal-58: net payable is PKR 800');
  // The old mislabelling: thermal-80 paired the payable label with the
  // gross figure. That exact row must be gone on every layout.
  assert.ok(!t80.includes(NET_THERMAL('PKR 1,000')), 'thermal-80: the payable label no longer carries the gross figure');
  assert.ok(!t58.includes(NET_THERMAL('PKR 1,000')), 'thermal-58: the payable label no longer carries the gross figure');
  assert.ok(!a4.includes(NET_A4('PKR 1,000')), 'a4: the payable label no longer carries the gross figure');
});

test('net payable equals gross minus every printed deduction on all three layouts', () => {
  const paid = payment('plan553-all-deductions', 1600, '2026-08-10', { discount: 100 });
  const { customer, bill } = fixture({ dueAmount: 2000, payments: [paid] });
  bill.concessionAmount = 200;
  bill.referralCreditAmount = 50;
  bill.depositOffsetAmount = 25;
  bill.creditTransferInAmount = 10;
  bill.feederHostCreditAmount = 15;
  const receipt = buildPaymentReceipt(customer, bill, paid);
  assert.equal(receipt.totalBilled, 2000);
  // 100 discount + 200 concession + 50 referral + 25 deposit + 10
  // transfer + 15 feeder-host = 400 deducted; net is 1600.
  const { a4, t80, t58 } = layouts(receipt);
  for (const [name, html] of Object.entries({ a4, t80, t58 })) {
    assert.ok(html.includes('-PKR 100</dd>'), `${name}: discount row present`);
    assert.ok(html.includes('-PKR 200</dd>'), `${name}: concession row present`);
    assert.ok(html.includes('-PKR 50</dd>'), `${name}: referral credit row present`);
    assert.ok(html.includes('-PKR 25</dd>'), `${name}: deposit offset row present`);
    assert.ok(html.includes('-PKR 10</dd>'), `${name}: credit transfer row present`);
    assert.ok(html.includes('-PKR 15</dd>'), `${name}: feeder-host credit row present`);
    assert.ok(html.includes('PKR 2,000'), `${name}: gross total is PKR 2,000`);
    assert.ok(html.includes('PKR 1,600'), `${name}: net payable is PKR 1,600`);
  }
  assert.ok(a4.includes(GROSS_A4('PKR 2,000')), 'a4: gross row labelled gross');
  assert.ok(a4.includes(NET_A4('PKR 1,600')), 'a4: net row labelled payable');
  assert.ok(t80.includes(GROSS_THERMAL('PKR 2,000')), 'thermal-80: gross row labelled gross');
  assert.ok(t80.includes(NET_THERMAL('PKR 1,600')), 'thermal-80: net row labelled payable');
  assert.ok(t58.includes(GROSS_THERMAL('PKR 2,000')), 'thermal-58: gross row labelled gross');
  assert.ok(t58.includes(NET_THERMAL('PKR 1,600')), 'thermal-58: net row labelled payable');
});

test('waived late fee shows the gross total but no net row — the waiver is never subtracted twice', () => {
  // SISP-101: the bill's lateFee is already zeroed when a waiver exists,
  // so the waived late fee was never inside totalBilled. The gross row
  // appears (a waiver is an adjustment), but there is no net row to
  // subtract it a second time.
  const stamp = { month: '2026-08', lateFee: 200, lateFeeAppliedAt: '2026-08-06T09:30', lateFeeReason: 'Late payment surcharge' };
  const paid = payment('plan553-waived', 1000, '2026-08-10', { lateFeeWaived: true, waivedAmount: 200, waivedLateFee: stamp });
  const { customer, bill } = fixture({ dueAmount: 1000, payments: [paid] });
  const receipt = buildPaymentReceipt(customer, bill, paid);
  assert.equal(receipt.lateFee, 0, 'the bill carries no late fee after the waiver');
  assert.equal(receipt.waivedAmount, 200);
  assert.equal(receipt.totalBilled, 1000);

  const { a4, t80, t58 } = layouts(receipt);
  for (const [name, html] of Object.entries({ a4, t80, t58 })) {
    assert.ok(html.includes('-PKR 200'), `${name}: waived row present`);
    assert.ok(html.includes('PKR 1,000'), `${name}: gross total is PKR 1,000`);
    assert.doesNotMatch(html, /Total Payable \/ کل واجب الادا/, `${name}: no net row — the waiver is not subtracted again`);
  }
  assert.ok(a4.includes(GROSS_A4('PKR 1,000')), 'a4: gross row labelled gross');
  assert.ok(t80.includes(GROSS_THERMAL('PKR 1,000')), 'thermal-80: gross row labelled gross');
  assert.ok(t58.includes(GROSS_THERMAL('PKR 1,000')), 'thermal-58: gross row labelled gross');
});

test('late-fee-only receipt keeps its total, with the thermal label corrected to gross', () => {
  const paid = payment('plan553-late-fee', 2200, '2026-08-10');
  const { customer, bill } = fixture({ dueAmount: 2000, payments: [paid] });
  bill.lateFee = 200;
  bill.lateFeeReason = '5th overdue fine';
  const receipt = buildPaymentReceipt(customer, bill, paid);
  assert.equal(receipt.totalBilled, 2200);

  const { a4, t80, t58 } = layouts(receipt);
  // A4 already labelled this figure "Total Gross Payable" — unchanged.
  assert.ok(a4.includes(GROSS_A4('PKR 2,200')), 'a4: gross total is PKR 2,200');
  // Thermal-80 used to label the same figure "Total Payable" — renamed.
  assert.ok(t80.includes(GROSS_THERMAL('PKR 2,200')), 'thermal-80: gross total is PKR 2,200');
  assert.ok(t58.includes(GROSS_THERMAL('PKR 2,200')), 'thermal-58: gross total is PKR 2,200');
  assert.ok(!t80.includes(NET_THERMAL('PKR 2,200')), 'thermal-80: the old payable label is gone from the gross row');
  assert.ok(!t58.includes(NET_THERMAL('PKR 2,200')), 'thermal-58: the old payable label is gone from the gross row');
  for (const [name, html] of Object.entries({ a4, t80, t58 })) {
    assert.doesNotMatch(html, /Total Payable \/ کل واجب الادا/, `${name}: no net row when nothing was deducted`);
  }
});
