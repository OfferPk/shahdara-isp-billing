// QC SUCCESS ROWS PILL (user, 2026-11-21): on the Quick Collect Cash
// "Payment Recorded Successfully" screen the six detail fields
// (Customer, Mobile Number, Date & Method, Month, Area / Location,
// Next due date) look like the Receipt No. / Amount Collected pill
// rows — same soft rounded pill style, slightly more compact
// (0.875rem values; the hero rows stay 1.3rem). Customer and Mobile
// Number each get their own full-width row (a long name never crowds
// the phone); the Change link sits INLINE next to the phone number
// inside the Mobile Number row; the Area selector stays inline
// inside the Area / Location pill row.
// Synthetic data only — no real customer names, no realistic phone
// numbers (pattern-fake digits only: 03012345678 family).
// NOT a pinning file: no parity literals in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderQuickCollectReceiptCardHtml } from '../nav-quick-collect.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const stylesSrc = read('styles.css');

const FAKE_PHONE = '03012345678';

function baseReceipt(overrides = {}) {
  return {
    customerName: 'Test Customer',
    customerNumber: 42,
    customerId: 'seed-001',
    phone: FAKE_PHONE,
    amount: 1000,
    month: '2026-11',
    area: 'Charyaa',
    date: '2026-11-21',
    method: 'Cash',
    receiptSequence: 246,
    payableRemaining: 0,
    newTotalDues: 0,
    ...overrides,
  };
}

function cardHtml(receipt = baseReceipt(), opts = {}) {
  return renderQuickCollectReceiptCardHtml(receipt, {
    whatsappPhone: FAKE_PHONE,
    nextDueDateText: '05/12/2026',
    ...opts,
  });
}

/** The enclosing <div> around a label's first occurrence. */
function rowOf(html, label) {
  const at = html.indexOf(label);
  if (at < 0) return '';
  const start = html.lastIndexOf('<div', at);
  const end = html.indexOf('</div>', at);
  if (start < 0 || end < 0) return '';
  return html.slice(start, end);
}

function pillCount(html) {
  return (html.match(/qc-amount-pill/g) || []).length;
}

test('C1: Customer renders as a compact pill row on its own full-width row', () => {
  const html = cardHtml();
  const row = rowOf(html, '>Customer<');
  assert.ok(row, 'card must carry a Customer row');
  assert.ok(row.includes('Test Customer'), 'row must show the customer name');
  assert.ok(row.includes('qc-amount-pill'), 'Customer row must reuse the pill classes');
  assert.ok(!row.includes('qc-receipt-item'), 'Customer row must leave the grid (own full-width row, Req 2)');
  assert.ok(!row.includes('class="qc-receipt-amount"'), 'Customer value must be compact text-sm, not the 1.3rem hero size (Req 1)');
});

test('C2: Mobile Number renders as a compact pill row, Change inline next to the number', () => {
  const html = cardHtml();
  const row = rowOf(html, 'Mobile Number');
  assert.ok(row, 'card must carry a Mobile Number row');
  assert.ok(row.includes(FAKE_PHONE), 'row must show the saved number');
  assert.ok(row.includes('qc-amount-pill'), 'Mobile Number row must reuse the pill classes');
  assert.ok(!row.includes('qc-receipt-item'), 'Mobile Number row must leave the grid (own full-width row, Req 2)');
  assert.ok(!row.includes('class="qc-receipt-amount"'), 'phone value must be compact text-sm, not the hero size (Req 1)');
  assert.ok(row.includes('data-qc-edit-phone'), 'Change button must survive the restyle');
  assert.ok(row.includes('qc-phone-saved'), 'saved number must stay green');
  // Inline, not on its own line: the Change button lives INSIDE the
  // phone value strong, right after the number.
  assert.ok(row.indexOf(FAKE_PHONE) < row.indexOf('data-qc-edit-phone'), 'Change must come after the number');
  assert.ok(row.indexOf('data-qc-edit-phone') < row.indexOf('</strong>'), 'Change must sit inside the phone value, not on its own line');
});

test('C3: Date & Method renders as a compact pill row', () => {
  const html = cardHtml();
  const row = rowOf(html, 'Date &amp; Method');
  assert.ok(row, 'card must carry a Date & Method row');
  assert.ok(row.includes('21/11/2026'), 'row must show the date');
  assert.ok(row.includes('Cash'), 'row must show the method');
  assert.ok(row.includes('qc-amount-pill'), 'Date & Method row must reuse the pill classes');
  assert.ok(!row.includes('qc-receipt-item'), 'Date & Method row must leave the grid');
  assert.ok(!row.includes('class="qc-receipt-amount"'), 'value must be compact text-sm, not the hero size (Req 1)');
});

test('C4: Month renders as a compact pill row', () => {
  const html = cardHtml();
  const row = rowOf(html, '>Month<');
  assert.ok(row, 'card must carry a Month row');
  assert.ok(row.includes('November'), 'row must show the month name');
  assert.ok(row.includes('qc-amount-pill'), 'Month row must reuse the pill classes');
  assert.ok(!row.includes('qc-receipt-item'), 'Month row must leave the grid');
  assert.ok(!row.includes('class="qc-receipt-amount"'), 'value must be compact text-sm, not the hero size (Req 1)');
});

test('C5: Area / Location renders as a compact pill row, select kept working', () => {
  const html = cardHtml();
  const row = rowOf(html, 'Area / Location');
  assert.ok(row, 'card must carry an Area / Location row');
  assert.ok(row.includes('quickCollectAreaSelect'), 'row must keep the area select');
  assert.ok(row.includes('qc-amount-pill'), 'Area row must reuse the pill classes');
  assert.ok(!row.includes('qc-receipt-item'), 'Area row must leave the grid');
});

test('C6: Next due date renders as a compact pill row', () => {
  const html = cardHtml();
  const row = rowOf(html, 'Next due date');
  assert.ok(row, 'card must carry a Next due date row');
  assert.ok(row.includes('05/12/2026'), 'row must show the next due date');
  assert.ok(row.includes('qc-amount-pill'), 'Next due date row must reuse the pill classes');
  assert.ok(!row.includes('qc-receipt-item'), 'Next due date row must leave the grid');
  assert.ok(!row.includes('class="qc-receipt-amount"'), 'value must be compact text-sm, not the hero size (Req 1)');
});

test('C7: the card carries 8 pill rows (2 existing + 6 restyled)', () => {
  const html = cardHtml();
  assert.equal(pillCount(html), 8, 'Receipt No. + Amount + six detail rows must all be pills');
});

test('C8 (Req 2): Customer and Mobile Number are on SEPARATE full-width pill rows — a long name never crowds the phone', () => {
  const html = cardHtml();
  const customerRow = rowOf(html, '>Customer<');
  const phoneRow = rowOf(html, 'Mobile Number');
  assert.ok(customerRow && phoneRow, 'both rows present');
  assert.ok(customerRow !== phoneRow, 'Customer and Mobile Number must be different rows');
  assert.ok(customerRow.includes('qc-amount-pill'), 'Customer must be its own pill row');
  assert.ok(phoneRow.includes('qc-amount-pill'), 'Mobile Number must be its own pill row');
  assert.ok(!customerRow.includes(FAKE_PHONE), 'Customer row must not contain the phone number');
  assert.ok(!phoneRow.includes('Test Customer'), 'Mobile row must not contain the customer name');
  // Long-name fixture: a very long customer name still renders in
  // its own pill row and the phone row stays separate — the row must
  // wrap, not overflow (node has no layout engine, so the wrap
  // guards are pinned in CSS: the detail value shrinks and breaks).
  const longName = 'Test Customer With A Very Long Name That Keeps Going';
  const longHtml = cardHtml(baseReceipt({ customerName: longName }));
  const longCustomerRow = rowOf(longHtml, '>Customer<');
  const longPhoneRow = rowOf(longHtml, 'Mobile Number');
  assert.ok(longCustomerRow.includes(longName), 'long name must render in full in its own pill row');
  assert.ok(longCustomerRow.includes('qc-amount-pill'), 'long-name Customer row must stay a pill row');
  assert.ok(longCustomerRow !== longPhoneRow, 'long name must not crowd the phone row');
  assert.ok(!longPhoneRow.includes(longName), 'phone row must not contain the long name');
  const valueRuleAt = stylesSrc.indexOf('.qc-receipt-amount-row.qc-amount-pill.qc-receipt-detail-row .qc-meta-val {');
  assert.ok(valueRuleAt >= 0, 'compact detail-value rule must exist');
  const valueRule = stylesSrc.slice(valueRuleAt, stylesSrc.indexOf('}', valueRuleAt));
  assert.ok(valueRule.includes('font-size: 0.875rem'), 'detail value must be compact 0.875rem');
  assert.ok(valueRule.includes('min-width: 0'), 'detail value must shrink inside the space-between flex row');
  assert.ok(valueRule.includes('overflow-wrap: anywhere'), 'detail value must break one long token instead of overflowing');
});

test('C9 (Req 3): the Area select sits INLINE inside its pill row, chevron kept', () => {
  const html = cardHtml();
  const row = rowOf(html, 'Area / Location');
  assert.ok(row, 'card must carry an Area / Location row');
  assert.ok(row.includes('<select id="quickCollectAreaSelect"'), 'select element must be inside the pill row');
  assert.ok(row.includes('qc-area-chevron'), 'select chevron must survive');
  assert.ok(row.includes('qc-amount-pill'), 'Area row must reuse the pill classes');
});

test('S1: Receipt No. and Amount Collected pill rows are unchanged', () => {
  const html = cardHtml();
  assert.ok(html.includes('qc-receipt-amount-row qc-amount-pill qc-receipt-number-row'), 'Receipt No. pill row unchanged');
  assert.ok(html.includes('Amount Collected'), 'Amount Collected row still present');
  assert.ok(html.includes('PKR 1,000'), 'Amount Collected still shows the amount');
});

test('S2: the phone inline editor still renders input + Save / Cancel', () => {
  const html = cardHtml(baseReceipt(), { editingPhone: true, phoneEditValue: FAKE_PHONE });
  assert.ok(html.includes('data-qc-phone-input'), 'editor input present');
  assert.ok(html.includes('data-qc-phone-save'), 'editor Save present');
  assert.ok(html.includes('data-qc-phone-cancel'), 'editor Cancel present');
});

test('B1: the Area select still offers the mohallas with the current area selected', () => {
  const html = cardHtml();
  assert.ok(html.includes('<select id="quickCollectAreaSelect"'), 'area select present');
  assert.ok(html.includes('value="CHARYAA" selected'), 'current area stays selected (canonical stored form is uppercase)');
  assert.ok(html.includes('Unassigned'), 'Unassigned option still offered');
});

test('B2: a partial receipt still shows the Still-owed row', () => {
  const html = cardHtml(baseReceipt({ payableRemaining: 500, newTotalDues: 500 }));
  assert.ok(html.includes('PKR 500'), 'Still-owed figure shown');
});
