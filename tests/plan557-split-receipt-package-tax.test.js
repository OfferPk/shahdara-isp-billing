// Plan 557 — Split combined receipt shows the package and the tax.
//
// buildSplitTenderReceipt already carries `package` (firstReceipt.package)
// on the combined object, and each leg's own buildPaymentReceipt carries
// that bill's salesTaxCents — but neither formatSplitTenderWhatsAppText
// nor generateSplitTenderReceiptHtml rendered either, so a split payment
// for a taxed 1,000 package produced a combined receipt with a total
// received and a balance but no package and no tax line, while the two
// individual leg receipts (which the customer does not get in the
// combined flow) do show them.
//
// THE DOUBLE-COUNT TRAP (why the combined tax is NOT the sum across
// legs): both legs of a normal split settle the SAME bill, so each leg
// receipt carries the SAME salesTaxCents — the bill's tax (PKR 195 on
// a 1,000 package). A naive sum across legs would print PKR 390, double
// the tax the bill actually charged. The combined tax is therefore the
// sum over the DISTINCT bills the legs settled (one bill in the normal
// case: exactly the bill's tax, once), read off the legs' own receipts
// and never recomputed. Pinned by the "tax once" test below.
//
// The package line shows the package label the legs settled (the same
// label each leg receipt shows); an unpackaged split shows no package
// line, and an untaxed split shows no tax line, never PKR 0. Both new
// lines use the Plan 555 shared money format (receipt-money.js), so
// PKR 292.50 prints identically on the combined surfaces and the
// single receipt. Scope is split-tender-collect.js only — the on-screen
// split card (renderSplitReceiptCardHtml) is Plan 579's job, not this
// plan's, and the combined builder's area handling (polish #14) is
// untouched.
//
// Pattern-fake data only: Test Customer, EP99887766.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { saveBillMonth } from '../core.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import {
  executeSplitTenderCollection, splitPaymentsOf, buildSplitTenderReceipt,
  formatSplitTenderWhatsAppText, generateSplitTenderReceiptHtml
} from '../split-tender-collect.js';
import { buildPaymentReceipt } from '../receipt.js';
import { voidPayment } from '../payment-void-audit.js';
import { SALES_TAX_RECEIPT_LABEL } from '../package-sales-tax.js';

const NOW = new Date('2026-10-29T12:00:00+05:00');
const MONTH = '2026-10';
const DATE = '2026-10-29';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const splitSrc = read('split-tender-collect.js');

// A taxed 1,000-package split: 1,000 package + 195 tax = 1,195 due,
// settled 1,000 Cash + 195 Easypaisa.
function taxedFixture() {
  let s = { version: 1, nextCustomerNumber: 2, customers: [{
    id: 'a', customerNumber: 1, name: 'Test Customer', phone: '03000000001',
    area: 'Shahdara', archived: false, bills: [],
    monthlySellingAmount: 1000, packageSpeed: '3Mbps / 100GB'
  }] };
  s = saveBillMonth(s, 'a', { month: MONTH, dueAmount: 1195, packageId: '3mbps-100gb', salesTaxCents: 19500, status: 'pending' }, NOW);
  return s;
}
const taxedSpec = {
  customerId: 'a', month: MONTH, date: DATE, paidBy: 'Self',
  legs: [
    { amount: 1000, method: 'Cash' },
    { amount: 195, method: 'Easypaisa', transactionId: 'EP99887766' }
  ]
};

// An untaxed, unpackaged split (the SISP-121 shape): 3,000 due,
// settled 2,000 Cash + 1,000 Easypaisa.
function untaxedFixture() {
  let s = { version: 1, nextCustomerNumber: 2, customers: [{
    id: 'a', customerNumber: 1, name: 'Test Customer', phone: '03000000001',
    area: 'Shahdara', archived: false, bills: []
  }] };
  s = saveBillMonth(s, 'a', { month: MONTH, dueAmount: 3000, status: 'pending' }, NOW);
  return s;
}
const untaxedSpec = {
  customerId: 'a', month: MONTH, date: DATE, paidBy: 'Self',
  legs: [
    { amount: 2000, method: 'Cash' },
    { amount: 1000, method: 'Easypaisa', transactionId: 'EP99887766' }
  ]
};

// A taxed 1,500-package split: 1,500 package + 292.50 tax = 1,792.50
// due, settled 1,500 Cash + 292.50 Easypaisa — the fractional tax
// pins the Plan 555 shared format (292.50, never 292.5).
function fractionalFixture() {
  let s = { version: 1, nextCustomerNumber: 2, customers: [{
    id: 'a', customerNumber: 1, name: 'Test Customer', phone: '03000000001',
    area: 'Shahdara', archived: false, bills: [],
    monthlySellingAmount: 1500, packageSpeed: '5Mbps / 150GB'
  }] };
  s = saveBillMonth(s, 'a', { month: MONTH, dueAmount: 1792.5, packageId: '5mbps-150gb', salesTaxCents: 29250, status: 'pending' }, NOW);
  return s;
}
const fractionalSpec = {
  customerId: 'a', month: MONTH, date: DATE, paidBy: 'Self',
  legs: [
    { amount: 1500, method: 'Cash' },
    { amount: 292.5, method: 'Easypaisa', transactionId: 'EP99887766' }
  ]
};

const run = (state, spec) => executeSplitTenderCollection(state, spec, { execute: executeQuickCollection, referenceDate: NOW });

// The PKR figure on one surface's tax line.
function taxFigureOf(text) {
  const m = text.match(/Sales tax \/ سیلز ٹیکس \(19\.5%\)[^P]*?(PKR [\d,]+(?:\.\d+)?)/);
  return m ? m[1] : null;
}

test('Plan 557 REPRO: a taxed split\'s combined WhatsApp text shows the package and the tax', () => {
  const { combinedReceipt } = run(taxedFixture(), taxedSpec);
  assert.equal(combinedReceipt.package, '3Mbps / 100GB', 'builder already carries the package label');
  assert.equal(combinedReceipt.salesTaxCents, 19500, 'builder carries the bill tax in cents');
  const text = formatSplitTenderWhatsAppText(combinedReceipt);
  assert.ok(text.includes('📦 *Package / پیکیج:* 3Mbps / 100GB'), 'package line with the settled package label');
  assert.ok(text.includes(`🧾 *${SALES_TAX_RECEIPT_LABEL}:* PKR 195`), 'tax line with the shared polish #11 label');
  assert.equal(taxFigureOf(text), 'PKR 195', 'tax figure is the bill tax');
  // The combined builder's area handling (polish #14) is untouched.
  assert.ok(text.includes('📍 *Area:* Shahdara'), 'area line unchanged');
});

test('Plan 557 REPRO: a taxed split\'s combined HTML shows the package row and the tax row', () => {
  const { combinedReceipt } = run(taxedFixture(), taxedSpec);
  const html = generateSplitTenderReceiptHtml(combinedReceipt);
  assert.ok(html.includes('<dt>Package / پیکیج:</dt><dd>3Mbps / 100GB</dd>'), 'package row, same label as the single receipt');
  assert.ok(html.includes(`<dt>${SALES_TAX_RECEIPT_LABEL}:</dt><dd>+PKR 195</dd>`), 'tax row with the shared label and the + prefix, like the single receipt');
  assert.equal(taxFigureOf(html), 'PKR 195', 'tax figure is the bill tax');
});

test('Plan 557: the combined tax is the bill tax ONCE, not the sum across legs', () => {
  const { nextState, splitGroupId, combinedReceipt } = run(taxedFixture(), taxedSpec);
  // Each leg receipt carries the SAME bill's tax — the double-count
  // trap: a naive sum across legs would print PKR 390.
  const customer = nextState.customers[0];
  const legTaxes = splitPaymentsOf(nextState, 'a', splitGroupId)
    .map(({ payment, bill }) => buildPaymentReceipt(customer, bill, payment).salesTaxCents);
  assert.deepEqual(legTaxes, [19500, 19500], 'both leg receipts carry the bill tax');
  assert.equal(combinedReceipt.salesTaxCents, 19500, 'combined tax is the bill tax once');
  const text = formatSplitTenderWhatsAppText(combinedReceipt);
  const html = generateSplitTenderReceiptHtml(combinedReceipt);
  assert.ok(!text.includes('PKR 390'), 'WhatsApp never prints the doubled tax');
  assert.ok(!html.includes('PKR 390'), 'HTML never prints the doubled tax');
  assert.equal(taxFigureOf(text), taxFigureOf(html), 'both surfaces agree on the figure');
});

test('Plan 557: the package line comes from the legs\' receipts, never recomputed', () => {
  const { nextState, splitGroupId, combinedReceipt } = run(taxedFixture(), taxedSpec);
  const customer = nextState.customers[0];
  const legPackages = splitPaymentsOf(nextState, 'a', splitGroupId)
    .map(({ payment, bill }) => buildPaymentReceipt(customer, bill, payment).package);
  assert.deepEqual(legPackages, ['3Mbps / 100GB', '3Mbps / 100GB'], 'both leg receipts show the same package');
  assert.equal(combinedReceipt.package, legPackages[0], 'combined package is the legs\' package');
});

test('Plan 557: an untaxed, unpackaged split shows no tax line and no package line on either surface', () => {
  const { combinedReceipt } = run(untaxedFixture(), untaxedSpec);
  assert.equal(combinedReceipt.salesTaxCents, null, 'untaxed bill carries no tax');
  assert.equal(combinedReceipt.package, '', 'unpackaged bill carries no package label');
  const text = formatSplitTenderWhatsAppText(combinedReceipt);
  const html = generateSplitTenderReceiptHtml(combinedReceipt);
  assert.ok(!text.includes('Sales tax'), 'WhatsApp shows no tax line, never PKR 0');
  assert.ok(!html.includes('Sales tax'), 'HTML shows no tax line, never PKR 0');
  assert.ok(!text.includes('Package / پیکیج'), 'WhatsApp shows no package line for an unpackaged split');
  assert.ok(!html.includes('Package / پیکیج'), 'HTML shows no package row for an unpackaged split');
  assert.equal(taxFigureOf(text), null);
  assert.equal(taxFigureOf(html), null);
});

test('Plan 557: a fractional tax prints identically on both surfaces (PKR 292.50, never 292.5)', () => {
  const { combinedReceipt } = run(fractionalFixture(), fractionalSpec);
  assert.equal(combinedReceipt.salesTaxCents, 29250, '1,500 package carries 292.50 tax');
  const text = formatSplitTenderWhatsAppText(combinedReceipt);
  const html = generateSplitTenderReceiptHtml(combinedReceipt);
  assert.equal(taxFigureOf(text), 'PKR 292.50', 'WhatsApp keeps the trailing zero (Plan 555 format)');
  assert.equal(taxFigureOf(html), 'PKR 292.50', 'HTML keeps the trailing zero (Plan 555 format)');
  assert.ok(text.includes('📦 *Package / پیکیج:* 5Mbps / 150GB'), 'fractional fixture package line');
  assert.ok(html.includes('<dt>Package / پیکیج:</dt><dd>5Mbps / 150GB</dd>'), 'fractional fixture package row');
});

test('Plan 557: a voided leg keeps the bill\'s package and tax; the total excludes the voided leg', () => {
  const { nextState, splitGroupId } = run(taxedFixture(), taxedSpec);
  const leg2 = nextState.customers[0].bills.find(b => b.month === MONTH).payments[1];
  const { state: afterVoid } = voidPayment(nextState, 'a', MONTH, leg2.id, { voidReason: 'Wrong wallet' });
  const rebuilt = buildSplitTenderReceipt(afterVoid, 'a', splitGroupId);
  assert.equal(rebuilt.status, 'PARTIAL');
  assert.equal(rebuilt.totalReceived, 1000, 'voided leg excluded from the total');
  assert.equal(rebuilt.salesTaxCents, 19500, 'tax still describes the bill, like the package');
  assert.equal(rebuilt.package, '3Mbps / 100GB');
  const text = formatSplitTenderWhatsAppText(rebuilt);
  const html = generateSplitTenderReceiptHtml(rebuilt);
  assert.ok(text.includes('📦 *Package / پیکیج:* 3Mbps / 100GB'), 'package line survives the void');
  assert.ok(text.includes('PKR 195'), 'tax line survives the void');
  assert.ok(html.includes('<dt>Package / پیکیج:</dt><dd>3Mbps / 100GB</dd>'), 'HTML package row survives the void');
  assert.equal(taxFigureOf(html), 'PKR 195', 'HTML tax figure survives the void');
  assert.match(text, /VOIDED/);
  assert.match(html, /VOIDED/);
});

test('Plan 557 PIN: a hand-built combined object without package/tax renders exactly as before (no crash, no lines)', () => {
  const combined = {
    splitGroupId: 'split-test', customerId: '1', customerNumber: 1,
    customerName: 'Test Customer', phone: '', area: 'Shahdara',
    month: MONTH, date: DATE, legs: [
      { leg: 1, paymentId: 'p1', receiptNumber: 'REC-1', method: 'Cash', amount: 1000, transactionId: '', date: DATE, voided: false },
      { leg: 2, paymentId: 'p2', receiptNumber: 'REC-2', method: 'Easypaisa', amount: 195, transactionId: 'EP99887766', date: DATE, voided: false }
    ],
    totalReceivedCents: 119500, totalReceived: 1195, balanceDueCents: 0, status: 'PAID'
  };
  const text = formatSplitTenderWhatsAppText(combined);
  const html = generateSplitTenderReceiptHtml(combined);
  assert.ok(!text.includes('Package / پیکیج'), 'no package line without a package');
  assert.ok(!text.includes('Sales tax'), 'no tax line without tax cents');
  assert.ok(!html.includes('Package / پیکیج'), 'no package row without a package');
  assert.ok(!html.includes('Sales tax'), 'no tax row without tax cents');
  assert.ok(text.includes('PKR 1,195'), 'total still renders');
  assert.ok(html.includes('PKR 1,195'), 'HTML total still renders');
});

test('Plan 557 PIN: the tax is derived from the legs\' receipts, never recomputed in this module', () => {
  assert.ok(!splitSrc.includes('salesTaxCentsForPrice'), 'no rate-based recompute in split-tender-collect.js');
  assert.ok(!splitSrc.includes('salesTaxForPackage'), 'no catalog-based recompute in split-tender-collect.js');
  assert.ok(splitSrc.includes('SALES_TAX_RECEIPT_LABEL'), 'the shared polish #11 label, never a re-typed string');
});
