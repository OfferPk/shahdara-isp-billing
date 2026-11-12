// QC success-card date format — the "Date & Method" row (and the
// WhatsApp draft, its history rows, the PNG receipt and the
// Bluetooth slip) printed the stored date verbatim as YYYY-MM-DD
// ("2026-11-08"); the operator reads DD/MM/YYYY, so every QC
// surface now prints "08/11/2026". The stored date is never
// rewritten — it stays YYYY-MM-DD on the receipt object — and the
// printed HTML receipt (receipt.js) is out of scope: Plans 567–569
// own print work.
//
// Pins (pattern-fake data only: Test Customer, RCPT-12-202611-01):
//  - BEHAVIOUR (fail on the pristine base, pass after the fix): the
//    card shows "08/11/2026 · Cash" and no "2026-11-08"; the draft
//    Date line shows "08/11/2026"; a history row shows
//    "18/09/2026"; the PNG and Bluetooth call sites pass the
//    formatted date (source pins — the canvas/slip need a device).
//  - EDGE: formatQcReceiptDate maps 2026-01-05 -> 05/01/2026,
//    2026-12-31 -> 31/12/2026, 2024-02-29 -> 29/02/2024 (leap day
//    is real); an impossible calendar date (2026-02-30) and '' are
//    returned unchanged, never reformatted or blanked.
//  - PIN (pass before and after): the receipt object still carries
//    date '2026-11-08'; the method part stays "· Cash"; the draft's
//    Billing Month stays YYYY-MM ("2026-11"); the month itself is
//    never reformatted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  renderQuickCollectReceiptCardHtml,
  formatQuickCollectWhatsAppReceipt,
  formatQcReceiptDate,
} from '../nav-quick-collect.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const quickCollectSrc = read('nav-quick-collect.js');

// Same fixture shape as tests/plan552-qc-success-card-sales-tax.test.js:
// "Test Customer", RCPT-12-202611-01, date 2026-11-08.
function baseReceipt(overrides = {}) {
  return {
    id: 'receipt-12',
    receiptNumber: 'RCPT-12-202611-01',
    amount: 1000,
    customerName: 'Test Customer',
    customerNumber: 12,
    date: '2026-11-08',
    month: '2026-11',
    method: 'Cash',
    area: 'Sodaa',
    payableRemaining: 0,
    newTotalDues: 0,
    ...overrides,
  };
}

/* ---------------- formatQcReceiptDate: edges ---------------- */

test('qc date format: valid YYYY-MM-DD dates become DD/MM/YYYY', () => {
  assert.equal(formatQcReceiptDate('2026-11-08'), '08/11/2026');
  assert.equal(formatQcReceiptDate('2026-01-05'), '05/01/2026');
  assert.equal(formatQcReceiptDate('2026-12-31'), '31/12/2026');
  assert.equal(formatQcReceiptDate('2024-02-29'), '29/02/2024');
});

test('qc date format: an impossible calendar date is returned unchanged', () => {
  assert.equal(formatQcReceiptDate('2026-02-30'), '2026-02-30');
  assert.equal(formatQcReceiptDate('2026-13-01'), '2026-13-01');
});

test('qc date format: empty and non-date values are returned unchanged', () => {
  assert.equal(formatQcReceiptDate(''), '');
  assert.equal(formatQcReceiptDate('not-a-date'), 'not-a-date');
  assert.equal(formatQcReceiptDate(undefined), '');
  assert.equal(formatQcReceiptDate(null), '');
});

/* ---------------- success card ---------------- */

test('qc date format: the card Date & Method row reads DD/MM/YYYY', () => {
  const html = renderQuickCollectReceiptCardHtml(baseReceipt());
  assert.ok(html.includes('08/11/2026 · Cash'), html);
  assert.ok(!html.includes('2026-11-08'), html);
});

test('qc date format: the stored date on the receipt object is untouched', () => {
  const receipt = baseReceipt();
  renderQuickCollectReceiptCardHtml(receipt);
  formatQuickCollectWhatsAppReceipt(receipt);
  assert.equal(receipt.date, '2026-11-08', 'display only — the stored date stays YYYY-MM-DD');
});

/* ---------------- WhatsApp draft ---------------- */

test('qc date format: the draft Date line reads DD/MM/YYYY', () => {
  const { text } = formatQuickCollectWhatsAppReceipt(baseReceipt());
  assert.ok(text.includes('08/11/2026'), text);
  assert.ok(!text.includes('2026-11-08'), text);
});

test('qc date format: the draft Billing Month stays YYYY-MM', () => {
  const { text } = formatQuickCollectWhatsAppReceipt(baseReceipt());
  assert.ok(text.includes('2026-11'), text);
});

test('qc date format: a draft history row reads DD/MM/YYYY', () => {
  const { text } = formatQuickCollectWhatsAppReceipt(baseReceipt({
    previousPayments: [{ date: '2026-09-18', amount: 3000, method: 'Cash', receiptLabel: 'RCPT-001' }],
  }));
  assert.ok(text.includes('• 18/09/2026 · PKR 3,000 · Cash · RCPT-001'), text);
  assert.ok(!text.includes('2026-09-18'), text);
});

/* ---------------- PNG receipt + Bluetooth slip (source pins) ---------------- */

test('qc date format: the PNG receipt prints the formatted date', () => {
  assert.ok(
    quickCollectSrc.includes('`Date: ${formatQcReceiptDate(receipt.date)}`'),
    'PNG Date line must call formatQcReceiptDate'
  );
  assert.ok(
    !quickCollectSrc.includes('`Date: ${receipt.date || \'\'}`'),
    'PNG Date line must not print the raw stored date'
  );
});

test('qc date format: the Bluetooth slip passes the formatted date', () => {
  assert.ok(
    quickCollectSrc.includes('dateTimeLabel: formatQcReceiptDate(activeReceipt.date),'),
    'slip dateTimeLabel must call formatQcReceiptDate'
  );
  assert.ok(
    !quickCollectSrc.includes('dateTimeLabel: activeReceipt.date ||'),
    'slip dateTimeLabel must not pass the raw stored date'
  );
});

test('qc date format: the card and draft call the helper, not a re-typed format', () => {
  assert.ok(
    quickCollectSrc.includes('${escapeHtml(formatQcReceiptDate(receipt.date))} · ${escapeHtml(receipt.method)}'),
    'card Date & Method row must call formatQcReceiptDate'
  );
  assert.ok(
    quickCollectSrc.includes('`📅 *${L.date}:* ${formatQcReceiptDate(receipt.date)}`'),
    'draft Date line must call formatQcReceiptDate'
  );
  assert.ok(
    quickCollectSrc.includes('[formatQcReceiptDate(row.date), `PKR ${formatReceiptMoneyFigure(row.amount)}`, row.method, historyRowLabel(row)]'),
    'draft history rows must call formatQcReceiptDate'
  );
});
