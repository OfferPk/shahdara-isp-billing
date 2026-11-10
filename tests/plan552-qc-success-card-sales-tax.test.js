// Plan 552 — Quick Collect success card shows the sales-tax row.
//
// The operator's on-screen slip after a taxed collection showed Amount
// Collected with no tax breakdown, while the WhatsApp draft for the
// same payment did show it. The card now carries one full-width row
// reading receipt.salesTaxCents, shown only when positive, labelled
// with the shared polish #11 constant SALES_TAX_RECEIPT_LABEL — the
// same label Plan 551 reused on the PNG receipt, never a re-typed
// string. No change to the receipt object, the draft, or the share
// draft; no amount math touched.
// Pattern-fake data only: Test Customer, RCPT-12-202611-01.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  renderQuickCollectReceiptCardHtml,
  formatQuickCollectWhatsAppReceipt,
} from '../nav-quick-collect.js';
import { SALES_TAX_RECEIPT_LABEL } from '../package-sales-tax.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const stylesSrc = read('styles.css');
const quickCollectSrc = read('nav-quick-collect.js');

// A taxed 1,000-package collection: 1,000 package + 195 tax = 1,195
// collected, nothing remaining.
function taxedReceipt(overrides = {}) {
  return {
    id: 'receipt-12',
    receiptNumber: 'RCPT-12-202611-01',
    amount: 1195,
    customerName: 'Test Customer',
    customerNumber: 12,
    date: '2026-11-08',
    month: '2026-11',
    method: 'Cash',
    area: 'Sodaa',
    payableRemaining: 0,
    newTotalDues: 0,
    salesTaxCents: 19500,
    ...overrides,
  };
}

function untaxedReceipt(overrides = {}) {
  const receipt = taxedReceipt({ amount: 1000, salesTaxCents: undefined });
  delete receipt.salesTaxCents;
  return { ...receipt, ...overrides };
}

// The card row carrying the tax label, or null when the card has none.
function taxRowOf(html) {
  const at = html.indexOf(SALES_TAX_RECEIPT_LABEL);
  if (at < 0) return null;
  const rowStart = html.lastIndexOf('<div class="qc-receipt-item', at);
  const rowEnd = html.indexOf('</div>', at);
  return html.slice(rowStart, rowEnd);
}

// The PKR figure on one surface's tax line.
function taxFigureOf(text) {
  const m = text.match(/Sales tax \/ سیلز ٹیکس \(19\.5%\)[^P]*?(PKR [\d,]+(?:\.\d+)?)/);
  return m ? m[1] : null;
}

test('Plan 552 REPRO: a taxed collection\'s success card shows the tax row with the shared label and PKR 195', () => {
  const html = renderQuickCollectReceiptCardHtml(taxedReceipt());
  const row = taxRowOf(html);
  assert.ok(row, 'tax row present on a taxed receipt');
  assert.ok(row.includes('qc-receipt-item full-width'), 'tax row is full-width like the other charge rows');
  assert.equal(taxFigureOf(html), 'PKR 195', 'card tax figure is PKR 195');
  assert.ok(html.includes('PKR 1,195'), 'Amount Collected stays the tax-inclusive total');
});

test('Plan 552: the card tax figure equals the WhatsApp draft tax figure on the same fixture', () => {
  const receipt = taxedReceipt();
  const html = renderQuickCollectReceiptCardHtml(receipt);
  const draft = formatQuickCollectWhatsAppReceipt(receipt).text;
  assert.ok(draft.includes('Sales tax / سیلز ٹیکس (19.5%):* PKR 195'), 'draft carries the tax line');
  assert.equal(taxFigureOf(html), taxFigureOf(draft), 'card and draft must agree on the figure');
  assert.equal(taxFigureOf(html), 'PKR 195');

  // A fractional tax (1,500 package) reads PKR 292.50 on both surfaces.
  // Plan 555: the shared receipt format prints a fractional figure with
  // two decimals (like formatPKR) — the intent pinned here, "card and
  // draft agree on the fractional figure", is unchanged.
  const half = taxedReceipt({ amount: 1792.5, salesTaxCents: 29250 });
  const halfHtml = renderQuickCollectReceiptCardHtml(half);
  const halfDraft = formatQuickCollectWhatsAppReceipt(half).text;
  assert.equal(taxFigureOf(halfHtml), 'PKR 292.50', 'card shows the fractional figure');
  assert.equal(taxFigureOf(halfHtml), taxFigureOf(halfDraft), 'card and draft agree on the fractional figure');
});

test('Plan 552: an untaxed collection\'s card shows no tax row (never PKR 0)', () => {
  assert.equal(taxRowOf(renderQuickCollectReceiptCardHtml(untaxedReceipt())), null, 'no tax row when the receipt carries no tax');
  assert.ok(!renderQuickCollectReceiptCardHtml(untaxedReceipt()).includes(SALES_TAX_RECEIPT_LABEL), 'no tax label at all on an untaxed card');

  // An explicit zero, a null, and a negative tax are all no row.
  for (const salesTaxCents of [0, null, -100]) {
    const html = renderQuickCollectReceiptCardHtml(taxedReceipt({ salesTaxCents }));
    assert.equal(taxRowOf(html), null, `salesTaxCents ${String(salesTaxCents)} must show no row`);
  }
  // Hide-zero-remaining: the card no longer reads "PKR 0" on the
  // Remaining Balance row of a fully-paid receipt — the row is hidden
  // when nothing remains. The "never PKR 0" rule below is about the
  // tax row only, which the loop above pins; this pin now asserts
  // the row itself is gone on a fully-paid card.
  assert.ok(!renderQuickCollectReceiptCardHtml(taxedReceipt({ salesTaxCents: 0 })).includes('Remaining Balance'), 'a fully-paid card hides the Remaining Balance row');
});

test('Plan 552: the tax row sits inside the receipt grid with the other financial rows, before the terms block', () => {
  // With a waived late fee present, the tax row follows it — the
  // financial rows stay together.
  const html = renderQuickCollectReceiptCardHtml(taxedReceipt({ waivedAmount: 100 }));
  const grid = html.indexOf('qc-receipt-grid');
  const tax = html.indexOf(SALES_TAX_RECEIPT_LABEL);
  const waived = html.indexOf('Late Fee');
  const terms = html.indexOf('receipt-urdu-notice');
  assert.ok(grid >= 0 && grid < tax, 'tax row must sit inside the receipt grid');
  assert.ok(waived >= 0 && waived < tax, 'tax row must follow the waived-fee row');
  assert.ok(tax < terms, 'tax row must sit before the terms block');
  assert.ok(html.indexOf('Amount Collected') < tax, 'tax row must sit below the Amount Collected row');
});

test('Plan 552: the row uses the shared polish #11 label constant, never a re-typed string', () => {
  assert.ok(
    quickCollectSrc.includes("import { salesTaxCentsForPrice, salesTaxCentsOfBill, SALES_TAX_RECEIPT_LABEL } from './package-sales-tax.js';")
      || quickCollectSrc.includes('SALES_TAX_RECEIPT_LABEL } from \'./package-sales-tax.js\''),
    'nav-quick-collect.js must import SALES_TAX_RECEIPT_LABEL from package-sales-tax.js',
  );
  const cardStart = quickCollectSrc.indexOf('export function renderQuickCollectReceiptCardHtml');
  const cardEnd = quickCollectSrc.indexOf('export function quickCollectShopChoices');
  const cardSrc = quickCollectSrc.slice(cardStart, cardEnd);
  assert.ok(cardSrc.includes('SALES_TAX_RECEIPT_LABEL'), 'the card builder must read the shared constant');
  assert.ok(!cardSrc.includes("'Sales tax / سیلز ٹیکس (19.5%)'"), 'the card builder must not re-type the label');
  assert.equal(SALES_TAX_RECEIPT_LABEL, 'Sales tax / سیلز ٹیکس (19.5%)', 'the constant is the WhatsApp tax line label');
});

// --- Fit budget: what the new row costs ---
// The row is a stacked full-width grid item (label above value —
// .qc-receipt-item is flex-direction: column), so its height is the
// label line + the value line + one success grid gap:
//   label 0.72rem x body line-height 1.5 = 17.28px
//   value (grid font-size) 0.82rem x 1.5 = 19.68px
//   success grid gap = 6px
//   total = 42.96px, rounded to 43px.
// The polish #21 computed total is 681px (baseline 745 − savings 64).
// A taxed receipt therefore computes to 681 + 43 = 724px — 24px OVER
// the 700px gate. This test RECORDS that overage; it does not bless
// it. The untaxed total is unchanged at 681px. The phone screenshot
// is the authority for the true total, and the polish #21 reserve
// knobs (banner padding 10→8, card gap 8→6, terms 11px, tick 28→24,
// then status gap, card padding, amount, message) recover the 24px
// if the user wants the taxed card back under 700 — none of them is
// applied here, per the plan: nothing else is silently shrunk to
// compensate. Upper bound if the long label wraps to two lines:
// one more label line (17.28px) → ~741px.
// Month-name fix: the taxed fixture already carries month '2026-11',
// so it now also renders the Month row — the row fills the
// lone-Remaining half-width row (5 → 6 half-width items, still 3
// rows), so the taxed total stays 724px in this arithmetic (pinned by
// the test below). Why the 681 baseline still stands here: it predates
// the BUT HOUSE phone row — the polish17 fit test owns the live total
// (736px); this test pins the tax-row delta only.
function ruleBlock(css, selectorWithBrace) {
  const start = css.indexOf(selectorWithBrace);
  assert.ok(start >= 0, `missing rule ${selectorWithBrace}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

function remSize(block) {
  const m = block.match(/font-size:\s*([\d.]+)rem/);
  assert.ok(m, `missing font-size in rem in "${block.trim()}"`);
  return parseFloat(m[1]);
}

test('Plan 552 fit budget: the tax row costs ~43px; a taxed receipt computes to 724px, 24px over the 700px gate', () => {  const labelBlock = ruleBlock(stylesSrc, '.qc-meta-label {');
  const gridBlock = ruleBlock(stylesSrc, '.qc-receipt-grid {');
  const successGrid = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-grid {');
  const bodyBlock = ruleBlock(stylesSrc, 'body {');
  const lineHeight = parseFloat(bodyBlock.match(/line-height:\s*([\d.]+)/)[1]);
  assert.equal(lineHeight, 1.5, 'body line-height must be 1.5');
  const labelPx = remSize(labelBlock) * 16 * lineHeight;
  const valuePx = remSize(gridBlock) * 16 * lineHeight;
  const gapPx = parseFloat(successGrid.match(/gap:\s*([\d.]+)px/)[1]);
  assert.equal(gapPx, 6, 'success grid gap must be 6px');
  const rowCostPx = Math.round(labelPx + valuePx + gapPx);
  assert.equal(rowCostPx, 43, `tax row cost must be 43px (label ${labelPx}px + value ${valuePx}px + gap ${gapPx}px)`);
  const POLISH_21_COMPUTED_TOTAL_PX = 681;
  const taxedTotalPx = POLISH_21_COMPUTED_TOTAL_PX + rowCostPx;
  assert.equal(taxedTotalPx, 724, 'taxed receipt computed total must be 724px');
  assert.ok(taxedTotalPx > 700, 'the taxed total is 24px OVER the 700px gate — recorded here, to be confirmed by the phone screenshot');
});

test('Plan 552: the Month row renders on the taxed card and now adds the third row (the Remaining row is hidden)', () => {
  // Month-name fix: the taxed fixture already carries month '2026-11',
  // so the card now renders a Month / November row between Date &
  // Method and Area. Hide-zero-remaining changed what it costs: the
  // taxed fixture is fully paid, so the Remaining Balance row is
  // hidden — the grid goes from 4 half-width items (2 rows) without
  // the Month row to 5 (3 rows) with it, so the Month row ADDS the
  // third row (43px). The 681 baseline predates the phone row; the
  // polish17 fit test owns the live total (736px), and re-baselining
  // this test's 724px arithmetic is a separate small item, not folded
  // in here.
  const html = renderQuickCollectReceiptCardHtml(taxedReceipt());
  const at = html.indexOf('>Month<');
  assert.ok(at >= 0, 'taxed card must carry the Month row');
  assert.ok(html.includes('>November<'), 'Month row must read November');
  const rowStart = html.lastIndexOf('<div class="qc-receipt-item', at);
  const rowTag = html.slice(rowStart, html.indexOf('>', rowStart) + 1);
  assert.ok(!rowTag.includes('full-width'), 'Month row must be a half-width grid item');
  assert.ok(html.indexOf('Date &amp; Method') < at, 'Month row must sit after Date & Method');
  assert.ok(at < html.indexOf('Area / Location'), 'Month row must sit before Area / Location');
  // (The phone row carries a data-qc-receipt-phone attribute, so the
  // half-width count matches the class prefix and subtracts full-width
  // rows instead of matching the bare `>` form.)
  const halfWidth = (h) => {
    const all = (h.match(/<div class="qc-receipt-item/g) || []).length;
    const full = (h.match(/<div class="qc-receipt-item full-width/g) || []).length;
    return all - full;
  };
  const noMonth = taxedReceipt();
  delete noMonth.month;
  assert.equal(halfWidth(html), 5, 'five half-width items with the Month row (Remaining hidden on a fully-paid card)');
  assert.equal(Math.ceil(halfWidth(html) / 2), 3, '3 half-width rows with the Month row');
  assert.equal(Math.ceil(halfWidth(renderQuickCollectReceiptCardHtml(noMonth)) / 2), 2, '2 half-width rows without the Month row — the Month row adds the third row, cost 43px');
});
