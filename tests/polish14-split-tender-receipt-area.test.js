// Polish #14: the split-tender combined receipt shows the customer's
// area on BOTH surfaces (WhatsApp text + printable HTML sheet).
// Render-only: the combined object already carries `area` (mohalla
// first, legacy area second, 'Unassigned' when neither is set), so the
// builder is untouched — the render sites only translate the builder's
// 'Unassigned' placeholder into the receipt convention 'Not recorded'
// (polish #12), never a blank and never a guessed mohalla.
// Synthetic data only; no real customer names or phone numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { saveBillMonth } from '../core.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import {
  executeSplitTenderCollection,
  formatSplitTenderWhatsAppText,
  generateSplitTenderReceiptHtml
} from '../split-tender-collect.js';
import { RECEIPT_URDU_LABELS } from '../receipt-script.js';

const NOW = new Date('2026-10-29T12:00:00+05:00');
const MONTH = '2026-10';
const DATE = '2026-10-29';

const customer = (id, n, extra = {}) => ({
  id, customerNumber: n, name: `Customer ${n}`, phone: `0300000000${n}`,
  archived: false, bills: [], ...extra
});

function fixture({ due = 3000, extra = {} } = {}) {
  let s = { version: 1, nextCustomerNumber: 2, customers: [customer('a', 1, extra)] };
  s = saveBillMonth(s, 'a', { month: MONTH, dueAmount: due, status: 'pending' }, NOW);
  return s;
}

const SPEC = {
  customerId: 'a', month: MONTH, date: DATE, paidBy: 'Self',
  legs: [
    { amount: 2000, method: 'Cash' },
    { amount: 1000, method: 'Easypaisa', transactionId: 'EP99887766' }
  ]
};
const run = (state, spec = SPEC) => executeSplitTenderCollection(state, spec, { execute: executeQuickCollection, referenceDate: NOW });

// Hand-built combined object (the polish #7 fixture's shape), so the
// render functions are tested directly for each area value.
const combined = (area) => ({
  splitGroupId: 'grp-test-1',
  customerId: '99',
  customerNumber: 99,
  customerName: 'Test Customer',
  customerNameUrdu: '',
  phone: '03001234567',
  ...(area === undefined ? {} : { area }),
  month: '2026-11',
  date: '2026-11-05',
  package: '5 Mbps',
  legs: [
    { leg: 1, paymentId: 'pay-a', receiptNumber: 'RCPT-1', method: 'Cash', amount: 1000, transactionId: '', date: '2026-11-05', voided: false },
    { leg: 2, paymentId: 'pay-b', receiptNumber: 'RCPT-2', method: 'Easypaisa', amount: 1000, transactionId: '58247157439', date: '2026-11-05', voided: false }
  ],
  totalReceivedCents: 200000,
  totalReceived: 2000,
  balanceDueCents: 100000,
  status: 'PARTIAL'
});

const textLines = (c) => formatSplitTenderWhatsAppText(c).split('\n');
const areaLine = (c) => textLines(c).find((line) => line.startsWith('📍'));

test('builder: mohalla wins over the legacy area field', () => {
  const { combinedReceipt } = run(fixture({ extra: { mohalla: 'Test Mohalla', area: 'Legacy Area' } }));
  assert.equal(combinedReceipt.area, 'Test Mohalla');
});

test('builder: legacy area is used when no mohalla is set', () => {
  const { combinedReceipt } = run(fixture({ extra: { area: 'Legacy Area' } }));
  assert.equal(combinedReceipt.area, 'Legacy Area');
});

test('builder: neither mohalla nor area leaves the combined value as the untouched placeholder', () => {
  const { combinedReceipt } = run(fixture());
  assert.equal(combinedReceipt.area, 'Unassigned');
});

test('WhatsApp text: the Area line sits right after the Customer line and shows the area', () => {
  const lines = textLines(combined('Shahdara'));
  const customerIdx = lines.findIndex((line) => line.startsWith('👤 *Customer:*'));
  assert.ok(customerIdx >= 0, 'Customer line present');
  assert.equal(lines[customerIdx + 1], '📍 *Area:* Shahdara');
});

test('WhatsApp text: the builder placeholder renders as Not recorded, never Unassigned', () => {
  assert.equal(areaLine(combined('Unassigned')), '📍 *Area:* Not recorded');
});

test('WhatsApp text: a missing, empty or blank area renders as Not recorded, never a blank line', () => {
  for (const value of [undefined, '', '   ']) {
    const line = areaLine(combined(value));
    assert.equal(line, '📍 *Area:* Not recorded', `area ${JSON.stringify(value)}`);
  }
});

test('HTML sheet: the Area row sits right after the Customer Name row and shows the area', () => {
  const html = generateSplitTenderReceiptHtml(combined('Shahdara'));
  const nameIdx = html.indexOf('Customer Name / صارف کا نام:');
  const areaIdx = html.indexOf('<dt>Area / علاقہ:</dt><dd>Shahdara</dd>');
  const accountIdx = html.indexOf('Account / Customer ID:');
  assert.ok(nameIdx >= 0 && areaIdx > nameIdx, 'Area row follows the Customer Name row');
  assert.ok(accountIdx > areaIdx, 'Area row precedes the Account row');
});

test('HTML sheet: the builder placeholder and a missing area both render as Not recorded', () => {
  for (const value of ['Unassigned', undefined, '']) {
    const html = generateSplitTenderReceiptHtml(combined(value));
    assert.ok(html.includes('<dt>Area / علاقہ:</dt><dd>Not recorded</dd>'), `area ${JSON.stringify(value)}`);
    assert.ok(!html.includes('<dd>Unassigned</dd>'), 'no Unassigned leaks onto the sheet');
  }
});

test('HTML sheet: the area value is escaped, never raw markup', () => {
  const html = generateSplitTenderReceiptHtml(combined('<b>Test Mohalla</b>'));
  assert.ok(html.includes('&lt;b&gt;Test Mohalla&lt;/b&gt;'));
  assert.ok(!html.includes('<b>Test Mohalla</b>'));
});

test('everything else on both surfaces is unchanged: legs, TIDs, totals and status', () => {
  const { combinedReceipt } = run(fixture({ extra: { mohalla: 'Test Mohalla' } }));
  assert.equal(combinedReceipt.totalReceived, 3000);
  assert.equal(combinedReceipt.status, 'PAID');

  const text = formatSplitTenderWhatsAppText(combinedReceipt);
  assert.match(text, /Cash/);
  assert.match(text, /Easypaisa/);
  assert.match(text, /EP99887766/);
  assert.match(text, /PKR 3,000/);
  assert.ok(text.includes(combinedReceipt.legs[0].receiptNumber));
  assert.ok(text.includes(combinedReceipt.legs[1].receiptNumber));
  assert.equal(areaLine(combinedReceipt), '📍 *Area:* Test Mohalla');

  const html = generateSplitTenderReceiptHtml(combinedReceipt);
  assert.match(html, /split-tender-receipt/);
  assert.match(html, /PKR 2,000/);
  assert.match(html, /PKR 1,000/);
  assert.match(html, /PKR 3,000/);
  assert.ok(html.includes('<dt>Area / علاقہ:</dt><dd>Test Mohalla</dd>'));
});

test('the Area label is the one the Urdu-script print map already knows (polish #12)', () => {
  assert.equal(RECEIPT_URDU_LABELS['Area / علاقہ'], 'علاقہ');
});
