import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  RECEIPT_SCRIPTS,
  sanitizeReceiptScript,
  receiptScriptLabel,
  urduReceiptLabel,
  applyReceiptScript,
} from '../receipt-script.js';
import { generatePaymentReceiptHtml } from '../receipt.js';

const dir = dirname(fileURLToPath(import.meta.url));

const thermal58Sample = `<article class="receipt-sheet thermal-receipt thermal-58" data-receipt-format="thermal-58">
  <dl class="receipt-fields">
    <div class="receipt-field"><dt>Date / تاریخ:</dt><dd>2026-11-03</dd></div>
    <div class="receipt-field"><dt>Cust ID / کھاتہ:</dt><dd>#12</dd></div>
    <div class="receipt-field"><dt>Name / صارف:</dt><dd>Ahmed</dd></div>
    <div class="receipt-field"><dt>Month / بل ماہ:</dt><dd>2026-11</dd></div>
    <div class="receipt-field receipt-paid-field"><dt><strong>PAID / موصولہ:</strong></dt><dd><strong>PKR 1,500</strong></dd></div>
    <div class="receipt-field receipt-balance-field"><dt><strong>Balance / بقایا:</strong></dt><dd><strong>PKR 0</strong></dd></div>
    <div class="receipt-field"><dt>Status / کیفیت:</dt><dd>PAID</dd></div>
    <div class="receipt-field"><dt>Verify / تصدیق:</dt><dd><strong>VER: AB12-CD</strong></dd></div>
    <div class="receipt-field"><dt>Something Else:</dt><dd>kept</dd></div>
  </dl>
</article>`;

const a4Sample = `<article class="receipt-sheet a4-receipt" data-receipt-format="a4">
  <dl class="receipt-fields">
    <div class="receipt-field"><dt>Receipt Number / رسید نمبر</dt><dd>R-1</dd></div>
    <div class="receipt-field"><dt>Customer Name / صارف کا نام</dt><dd>Ahmed</dd></div>
    <div class="receipt-field"><dt>Payment Date / تاریخ ادائیگی</dt><dd>2026-11-03</dd></div>
  </dl>
</article>`;

const receipt = {
  customerName: 'Ahmed',
  customerId: '12',
  paymentDate: '2026-11-03',
  receiptNumber: 'R-1',
  status: 'PAID',
  package: '20 Mbps',
  paymentMethod: 'Cash',
  paidAmount: 1500,
  nominalPrice: 1500,
  servicePeriodStart: '2026-11-01',
  balanceDueCents: 0,
  verificationCode: 'AB12-CD',
};

test('script choices are exactly roman and urdu', () => {
  assert.deepEqual([...RECEIPT_SCRIPTS].sort(), ['roman', 'urdu']);
});

test('sanitizeReceiptScript accepts roman and urdu, trims and lowercases', () => {
  assert.equal(sanitizeReceiptScript('urdu'), 'urdu');
  assert.equal(sanitizeReceiptScript('roman'), 'roman');
  assert.equal(sanitizeReceiptScript(' Urdu '), 'urdu');
  assert.equal(sanitizeReceiptScript('ROMAN'), 'roman');
});

test('sanitizeReceiptScript rejects anything else with null', () => {
  assert.equal(sanitizeReceiptScript('english'), null);
  assert.equal(sanitizeReceiptScript(''), null);
  assert.equal(sanitizeReceiptScript(null), null);
  assert.equal(sanitizeReceiptScript(undefined), null);
  assert.equal(sanitizeReceiptScript(42), null);
});

test('receiptScriptLabel names both scripts', () => {
  assert.equal(receiptScriptLabel('urdu'), 'Urdu script');
  assert.equal(receiptScriptLabel('roman'), 'Roman Urdu');
  assert.equal(receiptScriptLabel(null), 'Roman Urdu');
});

test('urduReceiptLabel maps known labels and nothing else', () => {
  assert.equal(urduReceiptLabel('Date / تاریخ'), 'تاریخ');
  assert.equal(urduReceiptLabel('Customer Name / صارف کا نام'), 'صارف کا نام');
  assert.equal(urduReceiptLabel('PAID / موصولہ'), 'موصولہ');
  assert.equal(urduReceiptLabel('Something Else'), null);
  assert.equal(urduReceiptLabel(null), null);
  assert.equal(urduReceiptLabel(42), null);
});

test('non-urdu scripts return the input string unchanged', () => {
  assert.equal(applyReceiptScript(thermal58Sample, 'roman'), thermal58Sample);
  assert.equal(applyReceiptScript(thermal58Sample, null), thermal58Sample);
  assert.equal(applyReceiptScript(thermal58Sample, undefined), thermal58Sample);
  assert.equal(applyReceiptScript(thermal58Sample, 'english'), thermal58Sample);
  assert.equal(applyReceiptScript(thermal58Sample, ''), thermal58Sample);
});

test('non-string and empty inputs pass through untouched', () => {
  assert.equal(applyReceiptScript('', 'urdu'), '');
  assert.equal(applyReceiptScript(null, 'urdu'), null);
  assert.equal(applyReceiptScript(42, 'urdu'), 42);
});

test('urdu script re-labels thermal-58 fields and marks the article', () => {
  const out = applyReceiptScript(thermal58Sample, 'urdu');
  assert.match(out, /<dt>تاریخ:<\/dt>/);
  assert.match(out, /<dt>کھاتہ:<\/dt>/);
  assert.match(out, /<dt>صارف:<\/dt>/);
  assert.match(out, /<dt>بل ماہ:<\/dt>/);
  assert.match(out, /<dt><strong>موصولہ:<\/strong><\/dt>/);
  assert.match(out, /<dt><strong>بقایا:<\/strong><\/dt>/);
  assert.match(out, /<dt>کیفیت:<\/dt>/);
  assert.match(out, /<dt>تصدیق:<\/dt>/);
  assert.match(out, /<article dir="rtl" lang="ur" class="receipt-sheet receipt-urdu-script/);
  assert.doesNotMatch(out, /Date \/ تاریخ/);
  assert.doesNotMatch(out, /Cust ID \/ کھاتہ/);
  assert.doesNotMatch(out, /PAID \/ موصولہ/);
});

test('urdu script leaves values and unmapped labels untouched', () => {
  const out = applyReceiptScript(thermal58Sample, 'urdu');
  assert.match(out, /<dd>2026-11-03<\/dd>/);
  assert.match(out, /<dd>#12<\/dd>/);
  assert.match(out, /<dd>Ahmed<\/dd>/);
  assert.match(out, /<dd>2026-11<\/dd>/);
  assert.match(out, /PKR 1,500/);
  assert.match(out, /VER: AB12-CD/);
  assert.match(out, /<dt>Something Else:<\/dt>/);
  // The input itself is unchanged: rendering never mutates its input.
  assert.match(thermal58Sample, /<dt>Date \/ تاریخ:<\/dt>/);
});

test('urdu script re-labels plain A4 labels without colons', () => {
  const out = applyReceiptScript(a4Sample, 'urdu');
  assert.match(out, /<dt>رسید نمبر<\/dt>/);
  assert.match(out, /<dt>صارف کا نام<\/dt>/);
  assert.match(out, /<dt>تاریخ ادائیگی<\/dt>/);
  assert.doesNotMatch(out, /Receipt Number \/ رسید نمبر/);
  assert.match(out, /<dd>R-1<\/dd>/);
  assert.match(out, /<dd>Ahmed<\/dd>/);
});

test('generated A4 receipt: urdu keeps amount, date, and month identical', () => {
  const roman = generatePaymentReceiptHtml(receipt, { format: 'a4' });
  const urdu = generatePaymentReceiptHtml(receipt, { format: 'a4', script: 'urdu' });
  for (const value of ['PKR 1,500', '2026-11-03', '2026-11', 'Ahmed', 'R-1']) {
    assert.match(roman, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(urdu, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(urdu, /تاریخ ادائیگی/);
  assert.match(urdu, /صارف کا نام/);
  assert.match(urdu, /رسید نمبر/);
  assert.doesNotMatch(urdu, /Payment Date \/ تاریخ ادائیگی/);
  assert.match(urdu, /dir="rtl" lang="ur"/);
});

test('generated receipt without a script choice prints as before', () => {
  const plain = generatePaymentReceiptHtml(receipt, { format: 'a4' });
  assert.equal(generatePaymentReceiptHtml(receipt, { format: 'a4', script: 'roman' }), plain);
  assert.equal(generatePaymentReceiptHtml(receipt, { format: 'a4', script: 'english' }), plain);
  assert.equal(generatePaymentReceiptHtml(receipt, { format: 'a4', script: null }), plain);
  assert.match(plain, /Payment Date \/ تاریخ ادائیگی/);
  assert.doesNotMatch(plain, /receipt-urdu-script/);
});

test('generated thermal-58 receipt renders in Urdu script too', () => {
  const urdu = generatePaymentReceiptHtml(receipt, { format: 'thermal-58', script: 'urdu' });
  assert.match(urdu, /<dt>تاریخ:<\/dt>/);
  assert.match(urdu, /<dt>کھاتہ:<\/dt>/);
  assert.match(urdu, /PKR 1,500/);
  assert.match(urdu, /2026-11-03/);
  assert.match(urdu, /2026-11/);
});

test('generated thermal-80 receipt renders in Urdu script too', () => {
  const urdu = generatePaymentReceiptHtml(receipt, { format: 'thermal-80', script: 'urdu' });
  assert.match(urdu, /تاریخ ادائیگی/);
  assert.match(urdu, /کھاتہ نمبر/);
  assert.match(urdu, /PKR 1,500/);
  assert.match(urdu, /2026-11-03/);
});

test('panel element ids are present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['rsCustomer', 'rsMonth', 'rsPaymentId', 'rsFormat', 'rsPreviewBtn', 'rsPrintBtn', 'rsPreview', 'rsHeading']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
