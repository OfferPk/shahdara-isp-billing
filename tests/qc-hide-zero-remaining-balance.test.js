// Hide-zero-remaining — the Quick Collect success card hides its
// "Remaining Balance" row when nothing remains.
//
// The user asked (2026-11-10): when fully paid (e.g. PKR 3,000 paid
// in full), "Remaining Balance: PKR 0" should not show at all. The
// row was unconditional — only the colour class varied — so a settled
// card printed a meaningless PKR 0. The settled state is already
// stated twice on the same screen (the still-owes pill "Bill dues
// fully paid" and the settle badge), plus a third time below the fold,
// so hiding the row removes no information.
//
// Scope: the two success-card builders only — the ordinary card
// (renderQuickCollectReceiptCardHtml) and the split card
// (renderSplitReceiptCardHtml). NOT changed: the WhatsApp draft (a
// customer-facing record where "Remaining Balance: PKR 0" documents
// settlement), the image receipt, the Bluetooth slip, the PNG
// receipt, or the printed HTML receipts.
//
// Hide rule: show only when the figure is > 0 (bare `>`, the
// codebase idiom, same predicate as the settle badge and the draft).
// 0 → hidden; negative (overpayment/credit) → hidden; missing/null/
// NaN → hidden, never "PKR —" / "PKR NaN"; string "1000" → shown,
// "0" → hidden (coercion parity with badge/draft).
// Pattern-fake data only: Test Customer, RCPT-12-202611-01.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  renderQuickCollectReceiptCardHtml,
  formatQuickCollectWhatsAppReceipt,
} from '../nav-quick-collect.js';
import { renderSplitReceiptCardHtml } from '../split-tender-collect.js';
import { stillOwesLineHtml } from '../quick-collect-still-owes.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const quickCollectSrc = read('nav-quick-collect.js');

function baseReceipt(overrides = {}) {
  return {
    id: 'receipt-12',
    receiptNumber: 'RCPT-12-202611-01',
    amount: 3000,
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

function splitCombined(overrides = {}) {
  return {
    splitGroupId: 'grp-test-1',
    customerId: '99',
    customerNumber: 99,
    customerName: 'Test Customer',
    area: 'Unassigned',
    month: '2026-11',
    date: '2026-11-05',
    legs: [
      { leg: 1, paymentId: 'pay-a', receiptNumber: 'RCPT-1', method: 'Cash', amount: 2000, transactionId: '', date: '2026-11-05', voided: false },
    ],
    totalReceived: 2000,
    balanceDueCents: 0,
    status: 'PAID',
    ...overrides,
  };
}

/* ---------------- Ordinary card ---------------- */

test('hide-zero-remaining: a fully-paid card shows no Remaining Balance row', () => {
  const html = renderQuickCollectReceiptCardHtml(baseReceipt());
  assert.ok(!html.includes('Remaining Balance'), 'fully paid (PKR 0 remaining) must hide the row entirely');
  assert.ok(!html.includes('PKR 0'), 'no PKR 0 figure from the hidden row');
});

test('hide-zero-remaining: a receipt with no remaining-balance fields hides the row', () => {
  const receipt = baseReceipt();
  delete receipt.payableRemaining;
  delete receipt.newTotalDues;
  delete receipt.newBalanceDue;
  const html = renderQuickCollectReceiptCardHtml(receipt);
  assert.ok(!html.includes('Remaining Balance'), 'missing fields must hide the row, never print PKR —');
  assert.ok(!html.includes('PKR —'), 'no em-dash figure from a field-less receipt');
});

test('hide-zero-remaining: a partial payment still shows the row with its figure', () => {
  const html = renderQuickCollectReceiptCardHtml(baseReceipt({ payableRemaining: 1000, newTotalDues: 1000 }));
  // QC receipt-modal overhaul (decision (j)): the Remaining Balance row
  // is the merged Still-owed row now — same figure, always shown.
  assert.ok(!html.includes('Remaining Balance'), 'no Remaining Balance row may remain');
  assert.ok(html.includes('Still owed'), 'partial must keep the row as Still owed');
  assert.ok(html.includes('PKR 1,000'), 'partial must keep the figure');
  // The row keeps its place: after the Area row, before the terms.
  assert.ok(html.indexOf('Area / Location') < html.indexOf('Still owed'), 'row still sits after Area');
  assert.ok(html.indexOf('Still owed') < html.indexOf('receipt-urdu-notice'), 'row still sits before the terms');
});

test('hide-zero-remaining: a negative remainder (overpayment/credit) hides the row', () => {
  const html = renderQuickCollectReceiptCardHtml(baseReceipt({ payableRemaining: -50, newTotalDues: -50 }));
  assert.ok(!html.includes('Remaining Balance'), 'a negative remainder is not a balance to show');
});

test('hide-zero-remaining: a NaN remainder hides the row, never PKR NaN', () => {
  const html = renderQuickCollectReceiptCardHtml(baseReceipt({ payableRemaining: Number.NaN, newTotalDues: 0 }));
  assert.ok(!html.includes('Remaining Balance'), 'NaN must hide the row');
  assert.ok(!html.includes('PKR NaN'), 'never PKR NaN on the card');
  assert.ok(!html.includes('NaN'), 'no NaN text anywhere on the card');
});

test('hide-zero-remaining: string figures follow the badge/draft coercion — "1000" shows a figure, "0" reads Fully paid', () => {
  const shown = renderQuickCollectReceiptCardHtml(baseReceipt({ payableRemaining: '1000' }));
  assert.ok(shown.includes('Still owed'), 'string "1000" is > 0, so the row shows');
  assert.ok(shown.includes('PKR 1,000'), 'string "1000" prints its figure');
  // QC receipt-modal overhaul (decision (j)): the merged row is ALWAYS
  // shown — string "0" reads "Fully paid", never hides, never "PKR 0".
  const settled = renderQuickCollectReceiptCardHtml(baseReceipt({ payableRemaining: '0' }));
  assert.ok(settled.includes('Still owed'), 'string "0" still shows the merged row');
  assert.ok(settled.includes('Fully paid'), 'string "0" reads Fully paid');
  assert.ok(!settled.includes('PKR 0'), 'no PKR 0 text');
});

test('hide-zero-remaining: the WhatsApp draft still documents settlement with PKR 0', () => {
  // The draft is a customer-facing record — the card hides the row,
  // the draft keeps "Remaining Balance: PKR 0" on a fully-paid receipt.
  const { text } = formatQuickCollectWhatsAppReceipt(baseReceipt());
  assert.ok(text.includes('⚖️ *Remaining Balance:* PKR 0'), text);
  assert.ok(text.includes('PAID IN FULL'), text);
});

test('hide-zero-remaining: the settled state is still stated by the still-owes pill and the merged row', () => {
  // The pill: a fully-paid line still reads "✓ Bill dues fully paid".
  const pill = stillOwesLineHtml({ stillOwed: 0, fullyPaid: true });
  assert.ok(pill.includes('✓ Bill dues fully paid'), pill);
  // QC receipt-modal overhaul: the settle badge is gone (deduped) — the
  // merged Still-owed row states the settled state instead ("Fully paid").
  assert.ok(!quickCollectSrc.includes('function renderSettleStatusBadge()'), 'badge render must be gone');
  assert.ok(!quickCollectSrc.includes("settled ? '✓ Settle in Full' : '⏳ Partial Payment'"), 'badge texts must be gone');
  const html = renderQuickCollectReceiptCardHtml(baseReceipt());
  assert.ok(html.includes('Still owed') && html.includes('Fully paid'), 'merged row must state the settled state');
});

/* ---------------- Split card ---------------- */

test('hide-zero-remaining: a fully-paid split card shows no Remaining Balance row', () => {
  const html = renderSplitReceiptCardHtml(splitCombined({ balanceDueCents: 0, status: 'PAID' }));
  assert.ok(!html.includes('Remaining Balance'), 'fully-paid split must hide the row');
  assert.ok(!html.includes('PKR 0'), 'no PKR 0 figure from the hidden row');
});

test('hide-zero-remaining: a partial split still shows the row with its figure', () => {
  const html = renderSplitReceiptCardHtml(splitCombined({ balanceDueCents: 100000, status: 'PARTIAL' }));
  // QC receipt-modal overhaul (decision (j)): the merged Still-owed row.
  assert.ok(!html.includes('Remaining Balance'), 'no Remaining Balance row may remain');
  assert.ok(html.includes('Still owed'), 'partial split must keep the row as Still owed');
  assert.ok(html.includes('PKR 1,000'), 'partial split must keep the figure');
});

test('hide-zero-remaining: a split with no balanceDueCents hides the row, never PKR NaN', () => {
  const combined = splitCombined();
  delete combined.balanceDueCents;
  const html = renderSplitReceiptCardHtml(combined);
  assert.ok(!html.includes('Remaining Balance'), 'missing balanceDueCents must hide the row');
  assert.ok(!html.includes('PKR NaN'), 'never PKR NaN on the split card');
});

test('hide-zero-remaining: a negative split remainder hides the row', () => {
  const html = renderSplitReceiptCardHtml(splitCombined({ balanceDueCents: -5000 }));
  assert.ok(!html.includes('Remaining Balance'), 'a negative split remainder is not a balance to show');
});
