// Plan 554 — A4 sheet prints each field once, and only when it has a value.
//
// The A4 `fields` array mapped every row through `val ? escapeHtml(val)
// : '&nbsp;'`, so a receipt with no transaction ID, no package duration,
// no data limit (every Unlimited package), no service-period end and no
// speed printed blank underlined rows. Thermal-58/80 already hide empty
// Txn ID and sender rows with ternaries; A4 now omits empty rows the
// same way. Two more A4 honesty fixes ride along in the same branch:
//   * `buildPaymentReceipt` sets `packageDate = servicePeriodStart`
//     (`${bill.month}-01`), and A4 printed it as "Package Date:
//     2026-11-01" — the billing-month start, not a package date. The row
//     is now "Billing Month / بل کا مہینہ" with the YYYY-MM value, the
//     same label and value thermal-80 already prints.
//   * A4 printed "Nominal Package Price" (nominalPrice, the full bill
//     due) and, whenever an arrears breakdown exists, "Mahana Package /
//     ماہانہ پیکیج" (packageAmount = dueAmount − kistAmount). On a
//     no-kist bill the two rows are the identical figure under two
//     labels, so the standalone row is dropped there and the arrears
//     block's labelled breakdown is the single package price. On a kist
//     bill both stay — they genuinely differ by the kist — and the kist
//     row says the kist is included in the Nominal Package Price, so the
//     reader can reconcile them.
// The rules pinned here:
//   * an A4 receipt prints NO blank (&nbsp;) row, except the
//     contributor header row, whose empty value is a section heading,
//     not missing data — it survives the cleanup;
//   * a Limited package still shows its Data Limit, a receipt with a
//     Txn ID still shows it, and the field order is unchanged;
//   * thermal-58/80 and the Plan 553 total rows are untouched.
// No real customer names are used anywhere in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';

function fixture({ dueAmount = 3000, month = '2026-11', payments = [], billExtra = {}, customerExtra = {} } = {}) {
  const bill = { id: `bill-${month}`, month, dueAmount, status: 'pending', payments, ...billExtra };
  const customer = {
    id: 'plan554-customer', customerNumber: 101, name: 'Plan554 Customer',
    packageSpeed: '5 Mbps', packageHistory: [], bills: [bill], ...customerExtra
  };
  return { customer, bill };
}
const payment = (id, amount, date, extra = {}) => ({ id, amount, date, method: 'Cash', ...extra });
const a4 = (receipt) => generatePaymentReceiptHtml(receipt, { format: 'a4' });
const row = (label, value) => `<dt>${label}</dt><dd class="">${value}</dd>`;
const countOccurrences = (html, needle) => html.split(needle).length - 1;

test('unlimited receipt with no txn id prints no blank rows on A4', () => {
  const paid = payment('plan554-unlimited', 3000, '2026-11-05');
  const { customer, bill } = fixture({ payments: [paid] });
  const receipt = buildPaymentReceipt(customer, bill, paid);
  assert.equal(receipt.packageType, 'Unlimited');
  assert.equal(receipt.dataLimit, '');
  assert.equal(receipt.transactionId, '');

  const html = a4(receipt);
  assert.doesNotMatch(html, /&nbsp;/, 'no blank underlined row anywhere on the sheet');
  assert.ok(!html.includes('<dt>Data Limit</dt>'), 'no Data Limit row for an Unlimited package');
  assert.ok(!html.includes('<dt>Transaction ID</dt>'), 'no Transaction ID row without a TID');
  assert.ok(!html.includes('<dt>Package Duration</dt>'), 'no Package Duration row without a duration');
  assert.ok(!html.includes('<dt>Service Period End</dt>'), 'no Service Period End row without an end date');
  // The rows that DO have values still print.
  assert.ok(html.includes(row('Internet Speed', '5 Mbps')), 'speed still prints');
  assert.ok(html.includes(row('Package Type', 'Unlimited')), 'package type still prints');
});

test('no A4 receipt prints a bare YYYY-MM-01 as "Package Date"', () => {
  const paid = payment('plan554-month', 3000, '2026-11-05');
  const { customer, bill } = fixture({ payments: [paid] });
  const receipt = buildPaymentReceipt(customer, bill, paid);
  assert.equal(receipt.packageDate, '2026-11-01');

  const html = a4(receipt);
  assert.ok(!html.includes('<dt>Package Date</dt>'), 'the misleading label is gone');
  assert.ok(html.includes(row('Billing Month / بل کا مہینہ', '2026-11')), 'the month prints as YYYY-MM');
  // The full date still prints where it belongs — the service period.
  assert.ok(html.includes(row('Service Period Start', '2026-11-01')), 'service period start keeps the full date');
});

test('no-kist A4 receipt shows the package price exactly once, in field order', () => {
  const paid = payment('plan554-nokist', 3000, '2026-11-05');
  const { customer, bill } = fixture({ payments: [paid] });
  const receipt = buildPaymentReceipt(customer, bill, paid);
  assert.equal(receipt.nominalPrice, 3000);
  assert.equal(receipt.arrearsBreakdown.packageAmount, 3000);
  assert.equal(receipt.arrearsBreakdown.kistAmount, 0);

  const html = a4(receipt);
  assert.equal(countOccurrences(html, '<dt>Nominal Package Price</dt>'), 0,
    'no standalone nominal row when the arrears block already prints the same figure');
  assert.equal(countOccurrences(html, '<dt>Mahana Package / ماہانہ پیکیج</dt>'), 1,
    'the arrears block is the single package price');
  assert.ok(html.includes(row('Mahana Package / ماہانہ پیکیج', 'PKR 3,000')), 'that price is PKR 3,000');
  // Field order is unchanged: package, then the arrears block, then the amount received.
  const packageAt = html.indexOf('<dt>Package / پیکیج</dt>');
  const mahanaAt = html.indexOf('<dt>Mahana Package / ماہانہ پیکیج</dt>');
  const receivedAt = html.indexOf('<dt>Amount Received / رقم موصول</dt>');
  assert.ok(packageAt > -1 && mahanaAt > packageAt && receivedAt > mahanaAt, 'package → mahana → amount received');
});

test('kist receipt keeps both package figures and the kist row explains the split', () => {
  const kistLines = [{ planId: 'plan554-router', installmentNumber: 1, totalMonths: 6, amount: 1000, itemTitle: 'Router' }];
  const paid = payment('plan554-kist', 3000, '2026-11-05');
  const { customer, bill } = fixture({ payments: [paid], billExtra: { kistLines } });
  const receipt = buildPaymentReceipt(customer, bill, paid);
  // The bill due already includes the kist: nominal 3000 = package 2000 + kist 1000.
  assert.equal(receipt.nominalPrice, 3000);
  assert.equal(receipt.arrearsBreakdown.packageAmount, 2000);
  assert.equal(receipt.arrearsBreakdown.kistAmount, 1000);

  const html = a4(receipt);
  assert.ok(html.includes(row('Nominal Package Price', 'PKR 3,000')), 'nominal price still prints on a kist bill');
  assert.ok(html.includes(row('Mahana Package / ماہانہ پیکیج', 'PKR 2,000')), 'mahana package is the net package figure');
  assert.ok(html.includes('<dt>Kist / قسط</dt><dd class="">PKR 1,000 (included in Nominal Package Price)</dd>'),
    'the kist row says the kist is inside the nominal price, so 2000 + 1000 = 3000 reconciles');
  assert.ok(html.includes(row('Kist 1/6: Router', 'PKR 1,000')), 'the kist detail line still prints');
});

test('contributor header row survives the cleanup while truly-blank rows go', () => {
  // Hand-built receipt: the contributor header row carries an empty
  // value BY DESIGN (it is a section heading, not a missing datum), so
  // it is the one blank row the cleanup must keep.
  const receipt = {
    receiptNumber: 'REC-2611-0101-TEST', customerName: 'Plan554 Customer', customerId: '101',
    area: 'Shahdara', paymentDate: '2026-11-05', package: '5 Mbps', nominalPrice: 3000,
    paidAmount: 3000, paymentMethod: 'Cash', packageDate: '2026-11-01',
    servicePeriodStart: '2026-11-01', servicePeriodEnd: '', status: 'PAID',
    totalBilled: 3000, balanceDueCents: 0,
    contributorSplit: {
      rows: [{ name: 'Plan554 Neighbour', share: 1000, paid: 1000, remaining: 0 }],
      main: { name: 'Plan554 Customer', share: 2000, paid: 2000, remaining: 0 }
    }
  };
  const html = a4(receipt);
  assert.ok(html.includes('<dt>Hamsaya Hissa Taqseem / حصہ تقسیم</dt>'), 'contributor header still prints');
  assert.ok(html.includes('Hamsaya — Plan554 Neighbour'), 'contributor rows still print under it');
  assert.ok(!html.includes('<dt>Transaction ID</dt>'), 'but the truly-blank Transaction ID row goes');
  assert.ok(!html.includes('<dt>Data Limit</dt>'), 'and the truly-blank Data Limit row goes');
  assert.ok(!html.includes('<dt>Service Period End</dt>'), 'and the truly-blank Service Period End row goes');
  assert.equal(countOccurrences(html, '&nbsp;'), 1, 'the header is the only blank row left on the sheet');
});

test('hand-built receipt without a status still shows its status row', () => {
  // generatePaymentReceiptHtml already defaults a missing status to
  // 'RECEIVED' (thermal prints that const); A4 read receipt.status
  // directly, so a hand-built receipt lost the row entirely once empty
  // rows were omitted. A4 now reads the same defaulted const.
  const receipt = {
    receiptNumber: 'REC-2611-0101-TEST', customerName: 'Plan554 Customer', customerId: '101',
    area: 'Shahdara', paymentDate: '2026-11-05', package: '5 Mbps', nominalPrice: 3000,
    paidAmount: 3000, paymentMethod: 'Cash', packageDate: '2026-11-01',
    servicePeriodStart: '2026-11-01', servicePeriodEnd: '2026-11-30',
    totalBilled: 3000, balanceDueCents: 0
  };
  const html = a4(receipt);
  assert.ok(html.includes(row('Receipt Status / کیفیت', 'RECEIVED')), 'status row shows the defaulted RECEIVED');
});

test('limited package still shows its Data Limit', () => {
  const paid = payment('plan554-limited', 2000, '2026-11-05');
  const { customer, bill } = fixture({ dueAmount: 2000, payments: [paid], billExtra: { packageDataLimit: '500 GB' } });
  const receipt = buildPaymentReceipt(customer, bill, paid);
  assert.equal(receipt.packageType, 'Limited');
  assert.equal(receipt.dataLimit, '500 GB');

  const html = a4(receipt);
  assert.ok(html.includes(row('Data Limit', '500 GB')), 'limited package keeps its Data Limit row');
  assert.ok(html.includes(row('Package Type', 'Limited')), 'package type still prints');
});

test('receipt with a txn id still shows it', () => {
  const paid = payment('plan554-tid', 3000, '2026-11-05', { transactionId: 'TXN554123' });
  const { customer, bill } = fixture({ payments: [paid] });
  const receipt = buildPaymentReceipt(customer, bill, paid);
  assert.equal(receipt.transactionId, 'TXN554123');

  const html = a4(receipt);
  assert.ok(html.includes(row('Transaction ID', 'TXN554123')), 'txn id still prints when present');
});

test('thermal layouts are untouched by the A4 cleanup', () => {
  const paid = payment('plan554-thermal', 3000, '2026-11-05');
  const { customer, bill } = fixture({ payments: [paid] });
  const receipt = buildPaymentReceipt(customer, bill, paid);

  const t80 = generatePaymentReceiptHtml(receipt, { format: 'thermal-80' });
  const t58 = generatePaymentReceiptHtml(receipt, { format: 'thermal-58' });
  assert.ok(t80.includes('<dt>Monthly Fee / ماہانہ واجبات:</dt><dd>PKR 3,000</dd>'), 'thermal-80 keeps its monthly fee row');
  assert.ok(t80.includes('<dt>Mahana Package / ماہانہ پیکیج:</dt><dd>PKR 3,000</dd>'), 'thermal-80 keeps its arrears package row');
  assert.ok(t80.includes('<dt>Billing Month / بل کا مہینہ:</dt><dd>2026-11</dd>'), 'thermal-80 keeps its billing month row');
  assert.ok(t58.includes('<dt>Billed / بل رقم:</dt><dd>PKR 3,000</dd>'), 'thermal-58 keeps its billed row');
  assert.ok(t58.includes('<dt>Mahana Package:</dt><dd>PKR 3,000</dd>'), 'thermal-58 keeps its arrears package row');
});

test('Plan 553 total rows still print on A4', () => {
  const paid = payment('plan554-taxed', 1195, '2026-11-05');
  const { customer, bill } = fixture({ dueAmount: 1000, payments: [paid] });
  bill.salesTaxCents = 19500;
  const receipt = buildPaymentReceipt(customer, bill, paid);
  assert.equal(receipt.totalBilled, 1195);

  const html = a4(receipt);
  assert.ok(html.includes(row('Total Gross Payable', 'PKR 1,195')), 'taxed A4 still shows the PKR 1195 gross total');
  assert.ok(html.includes('+PKR 195'), 'tax row still prints');
});
