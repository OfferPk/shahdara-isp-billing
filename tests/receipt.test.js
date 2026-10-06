import test from 'node:test';
import assert from 'node:assert/strict';
import { PACKAGE_TERMS_NOTE, buildPaymentReceipt } from '../receipt.js';
import { createBillPackageSnapshot } from '../package-catalog.js';
import { createReceiptWhatsAppDraft } from '../profile-ui.js';

function fixture({ dueAmount = 2000, packageSpeed = '5 Mbps', payments = [], month = '2026-08', packageHistory = [], priceSnapshot } = {}) {
  const bill = { id:`bill-${month}`, month, dueAmount, status:'pending', payments, ...(priceSnapshot === undefined ? {} : { priceSnapshot }) };
  const customer = {
    id:'synthetic-customer', customerNumber:42, name:'Synthetic Customer', packageSpeed,
    packageHistory, bills:[bill]
  };
  return { customer, bill, payments };
}
const payment = (id, amount, date, extra = {}) => ({ id, amount, date, method:'Cash', ...extra });

test('receipt uses recorded profile and payment fields; its first bill-month date is not the received date', () => {
  const savedPayment = payment('internal-record-1', 700, '2026-08-07');
  const { customer, bill } = fixture({ dueAmount:2000, payments:[savedPayment] });
  const receipt = buildPaymentReceipt(customer, bill, savedPayment);
  assert.equal(receipt.customerName, 'Synthetic Customer');
  assert.equal(receipt.customerId, '42');
  assert.equal(receipt.paymentDate, '2026-08-07');
  assert.equal(receipt.transactionId, '', 'an internal payment record ID is not presented as an external transaction reference');
  assert.equal(receipt.package, '5 Mbps');
  assert.equal(receipt.speedMbps, '5');
  assert.equal(receipt.packageDuration, '');
  assert.equal(receipt.packageDate, '2026-08-01');
  assert.equal(receipt.servicePeriodStart, '2026-08-01');
  assert.equal(receipt.servicePeriodEnd, '');
  assert.equal(receipt.paidAmount, 700);
  assert.equal(receipt.paymentMethod, 'Cash');
  assert.equal(receipt.packageType, 'Limited');
  assert.equal(receipt.status, 'PARTIAL');
  assert.equal(receipt.balanceDueCents, 130000);
});

test('a partial receipt stays PARTIAL with its balance even when a later receipt settles the bill', () => {
  const first = payment('receipt-a', 700, '2026-08-05');
  const second = payment('receipt-b', 1300, '2026-08-09');
  const { customer, bill } = fixture({ dueAmount:2000, payments:[first, second] });
  const firstReceipt = buildPaymentReceipt(customer, bill, first);
  const secondReceipt = buildPaymentReceipt(customer, bill, second);
  assert.equal(firstReceipt.status, 'PARTIAL');
  assert.equal(firstReceipt.balanceDueCents, 130000);
  assert.equal(secondReceipt.status, 'PAID');
  assert.equal(secondReceipt.balanceDueCents, 0);
});

test('same-day receipts retain saved row order because the ledger stores no time-of-day', () => {
  const first = payment('z-first-row', 700, '2026-08-05');
  const second = payment('a-second-row', 1300, '2026-08-05');
  const { customer, bill } = fixture({ dueAmount:2000, payments:[first, second] });
  assert.equal(buildPaymentReceipt(customer, bill, first).status, 'PARTIAL');
  assert.equal(buildPaymentReceipt(customer, bill, first).balanceDueCents, 130000);
  assert.equal(buildPaymentReceipt(customer, bill, second).status, 'PAID');
});

test('WhatsApp draft for an earlier installment remains PARTIAL after a later payment settles the bill', () => {
  const first = payment('whatsapp-first', 700, '2026-08-05');
  const second = payment('whatsapp-second', 1300, '2026-08-09');
  const { customer, bill } = fixture({ dueAmount:2000, payments:[first, second] });
  const receipt = buildPaymentReceipt(customer, bill, first);
  const draft = createReceiptWhatsAppDraft('+92 300 123 4567', {
    customerName:customer.name,
    customerNumber:customer.customerNumber,
    amount:first.amount,
    date:first.date,
    method:first.method,
    month:bill.month,
    billAmount:receipt.nominalPrice,
    balanceDueCents:receipt.balanceDueCents,
    billStatus:receipt.status === 'PAID' ? 'paid' : receipt.status === 'PARTIAL' ? 'partial' : null
  });
  assert.ok(draft);
  assert.match(draft.message, /Status: PARTIAL/);
  assert.match(draft.message, /Outstanding: PKR 1,300/);
  assert.doesNotMatch(draft.message, /Status: PAID|Outstanding: PKR 0|Next Bill Due:/);
});

test('package tier comes from the recorded nominal bill price, never the partial amount', () => {
  const partial = payment('small-receipt', 75, '2026-08-06');
  const limitedFixture = fixture({ dueAmount:2999, payments:[partial] });
  assert.equal(buildPaymentReceipt(limitedFixture.customer, limitedFixture.bill, partial).packageType, 'Limited');
  const unlimitedFixture = fixture({ dueAmount:3000, payments:[partial] });
  const receipt = buildPaymentReceipt(unlimitedFixture.customer, unlimitedFixture.bill, partial);
  assert.equal(receipt.packageType, 'Unlimited');
  assert.equal(receipt.paidAmount, 75);
  assert.equal(receipt.status, 'PARTIAL');
});

test('missing billing and package details remain blank and do not become PAID or a zero balance', () => {
  const savedPayment = payment('only-internal-id', 100, '2026-08-12');
  const { customer, bill } = fixture({ dueAmount:null, packageSpeed:'', payments:[savedPayment] });
  const receipt = buildPaymentReceipt(customer, bill, savedPayment);
  assert.equal(receipt.package, '');
  assert.equal(receipt.speedMbps, '');
  assert.equal(receipt.packageType, '');
  assert.equal(receipt.dataLimit, '');
  assert.equal(receipt.packageDuration, '');
  assert.equal(receipt.transactionId, '');
  assert.equal(receipt.servicePeriodEnd, '');
  assert.equal(receipt.status, 'RECEIVED');
  assert.equal(receipt.balanceDueCents, null);
});

test('a recorded price snapshot can classify a package without inventing bill balance', () => {
  const savedPayment = payment('snapshot-only-price', 250, '2026-08-12');
  const { customer, bill } = fixture({ dueAmount:null, priceSnapshot:3000, packageSpeed:'10 Mbps', payments:[savedPayment] });
  const receipt = buildPaymentReceipt(customer, bill, savedPayment);
  assert.equal(receipt.packageType, 'Unlimited');
  assert.equal(receipt.nominalPrice, 3000);
  assert.equal(receipt.balanceDueCents, null);
  assert.equal(receipt.status, 'RECEIVED');
});

test('package history selects the package recorded for the first day of the selected bill month', () => {
  const savedPayment = payment('history-receipt', 50, '2026-09-11');
  const changes = [{ date:'2026-09-10', oldPackage:'5 Mbps', newPackage:'10 Mbps', recordedAt:'2026-09-10T12:00' }];
  const current = fixture({ dueAmount:2500, packageSpeed:'10 Mbps', payments:[savedPayment], month:'2026-09', packageHistory:changes });
  const september = buildPaymentReceipt(current.customer, current.bill, savedPayment);
  assert.equal(september.package, '5 Mbps', 'a mid-month change is not backdated to day one');
  assert.equal(september.speedMbps, '5');
  const octoberPayment = payment('october-receipt', 50, '2026-10-11');
  const october = fixture({ dueAmount:2500, packageSpeed:'10 Mbps', payments:[octoberPayment], month:'2026-10', packageHistory:changes });
  assert.equal(buildPaymentReceipt(october.customer, october.bill, octoberPayment).package, '10 Mbps');
});

test('carry-forward credit is included in the exact balance after the selected partial payment', () => {
  const priorPayment = payment('prior-credit', 1500, '2026-07-12');
  const currentPayment = payment('current-partial', 300, '2026-08-13');
  const priorBill = { id:'bill-2026-07', month:'2026-07', dueAmount:1000, status:'pending', payments:[priorPayment] };
  const bill = { id:'bill-2026-08', month:'2026-08', dueAmount:1000, status:'pending', payments:[currentPayment] };
  const customer = { id:'synthetic-customer', customerNumber:9, name:'Synthetic Credit Customer', packageSpeed:'10 Mbps', packageHistory:[], bills:[priorBill, bill] };
  const receipt = buildPaymentReceipt(customer, bill, currentPayment);
  assert.equal(receipt.status, 'PARTIAL');
  assert.equal(receipt.balanceDueCents, 20000, 'PKR 500 carry-in plus PKR 300 received leaves PKR 200 due');
});

test('explicit transaction reference, duration, data cap and service-period end are used only when recorded', () => {
  const savedPayment = payment('internal-id', 1000, '2026-08-12', { transactionId:'TX-REAL-123' });
  const { customer, bill } = fixture({ dueAmount:1000, packageSpeed:'15 Mbps', payments:[savedPayment] });
  customer.packageDuration = '30 days';
  customer.packageDataLimit = '500 GB';
  bill.servicePeriodEnd = '2026-08-31';
  const receipt = buildPaymentReceipt(customer, bill, savedPayment);
  assert.equal(receipt.transactionId, 'TX-REAL-123');
  assert.equal(receipt.packageDuration, '30 days');
  assert.equal(receipt.dataLimit, '500 GB');
  assert.equal(receipt.servicePeriodEnd, '2026-08-31');
  assert.equal(receipt.status, 'PAID');
});

test('preset Limited receipt displays its actual package cap and a paid receipt uses the listed nominal price', () => {
  const savedPayment = payment('paid-package', 1600, '2026-08-12');
  const { customer, bill } = fixture({ dueAmount:1600, packageSpeed:'3Mbps / 300GB', payments:[savedPayment] });
  bill.packageSnapshot = createBillPackageSnapshot('3mbps-300gb');
  const receipt = buildPaymentReceipt(customer, bill, savedPayment);
  assert.equal(receipt.package, '3Mbps / 300GB');
  assert.equal(receipt.nominalPrice, 1600);
  assert.equal(receipt.paidAmount, 1600);
  assert.equal(receipt.packageType, 'Limited');
  assert.equal(receipt.dataLimit, '300 GB');
  assert.equal(receipt.status, 'PAID');
});

test('Unlimited packages never show a saved or inferred data cap', () => {
  const partial = payment('unlimited-partial', 500, '2026-08-12');
  const { customer, bill } = fixture({ dueAmount:3000, packageSpeed:'15Mbps Unlimited', payments:[partial] });
  bill.packageSnapshot = createBillPackageSnapshot('15mbps-unlimited');
  customer.packageDataLimit = '2000 GB';
  bill.packageDataLimit = '2000 GB';
  const receipt = buildPaymentReceipt(customer, bill, partial);
  assert.equal(receipt.packageType, 'Unlimited');
  assert.equal(receipt.dataLimit, '');
  assert.equal(receipt.nominalPrice, 3000);
  assert.equal(receipt.paidAmount, 500);
  assert.equal(receipt.status, 'PARTIAL');
});

test('unknown legacy package labels and saved caps remain compatible', () => {
  const savedPayment = payment('legacy-cap', 300, '2026-08-12');
  const { customer, bill } = fixture({ dueAmount:1500, packageSpeed:'Legacy custom 10 Mbps', payments:[savedPayment] });
  customer.packageDataLimit = '120 GB';
  const receipt = buildPaymentReceipt(customer, bill, savedPayment);
  assert.equal(receipt.package, 'Legacy custom 10 Mbps');
  assert.equal(receipt.packageType, 'Limited');
  assert.equal(receipt.dataLimit, '120 GB');
  customer.packageDataLimit = '';
  assert.equal(buildPaymentReceipt(customer, bill, savedPayment).dataLimit, '');
  customer.packageSpeed = 'Legacy custom 10 Mbps / 300GB';
  assert.equal(buildPaymentReceipt(customer, bill, savedPayment).dataLimit, '', 'an old label alone does not invent a saved cap');
});

test('printed package terms retain the agreed Limited/Unlimited threshold and cap rules', () => {
  assert.match(PACKAGE_TERMS_NOTE, /PKR 3,000 سے کم قیمت والے تمام پیکیجز محدود/);
  assert.match(PACKAGE_TERMS_NOTE, /PKR 3,000 اور اس سے زیادہ قیمت والے پیکیجز Unlimited/);
  assert.match(PACKAGE_TERMS_NOTE, /مقررہ ڈیٹا حد لاگو نہیں ہوتی/);
});
