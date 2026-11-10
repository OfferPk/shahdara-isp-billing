// QC success card receipt-number presentation — the success card was
// the ONLY receipt surface showing the receipt number with NO label at
// all: a bare grey monospace span, no container, dead space next to
// the shared pill. The stored number must NOT change (exact-match keys
// for reprints/search, the Plan 381 preview contract, numbers already
// on paper/PNG/drafts) — this fix is presentation-only: a labelled
// chip, reusing the Transaction ID row's .qc-txnid-code idiom.
//
// Pins:
//  - the header carries "Receipt No." immediately before a
//    byte-identical id, inside one .qc-receipt-ref wrapper;
//  - the wrapper carries margin-left: auto (moved off .qc-receipt-id,
//    whose success-open rule is now scoped to the split card's
//    direct-child title so the split header stays right-aligned);
//  - the id carries the existing .qc-txnid-code chip, whose dark
//    variant already exists — which also fixes the id's missing dark
//    rule, incidentally;
//  - the WhatsApp draft still reads "🧾 *Receipt No:*
//    RCPT-12-202611-01", and the PNG slip still reads "Receipt #:";
//  - the split card header is untouched (a title, not a number);
//  - the distinct-hex count in styles.css does not grow (zero new hex).
// Pattern-fake data only: Test Customer, RCPT-12-202611-01,
// 03012345678.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  renderQuickCollectReceiptCardHtml,
  formatQuickCollectWhatsAppReceipt,
} from '../nav-quick-collect.js';
import { renderSplitReceiptCardHtml } from '../split-tender-collect.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const stylesSrc = read('styles.css');
const pngSrc = read('png-receipt.js');

const RECEIPT_ID = 'RCPT-12-202611-01';

function baseReceipt(overrides = {}) {
  return {
    id: 'receipt-12',
    receiptNumber: RECEIPT_ID,
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

const SPLIT_COMBINED = {
  splitGroupId: 'grp-1',
  customerId: '12',
  customerNumber: 12,
  customerName: 'Test Customer',
  customerNameUrdu: '',
  phone: '03012345678',
  area: 'Sodaa',
  month: '2026-11',
  date: '2026-11-08',
  package: '5 Mbps',
  legs: [
    { leg: 1, paymentId: 'pay-a', receiptNumber: 'RCPT-12-202611-01', method: 'Cash', amount: 500, transactionId: '', date: '2026-11-08', voided: false },
    { leg: 2, paymentId: 'pay-b', receiptNumber: 'RCPT-12-202611-02', method: 'Easypaisa', amount: 500, transactionId: 'TID-000001', date: '2026-11-08', voided: false },
  ],
  totalReceivedCents: 100000,
  totalReceived: 1000,
  balanceDueCents: 0,
  status: 'PAID',
};

// The card header, from its opening tag to its closing </div>.
function headerOf(html) {
  const start = html.indexOf('qc-receipt-header');
  assert.ok(start >= 0, 'card must carry a receipt header');
  const open = html.lastIndexOf('<div', start);
  const end = html.indexOf('</div>', start);
  return html.slice(open, end);
}

function ruleBlock(css, selectorWithBrace) {
  const start = css.indexOf(selectorWithBrace);
  assert.ok(start >= 0, `missing rule ${selectorWithBrace}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

test('REPRO: the header carries a "Receipt No." label immediately before a byte-identical id', () => {
  const header = headerOf(renderQuickCollectReceiptCardHtml(baseReceipt()));
  assert.ok(header.includes('Receipt No.'), 'header must label the number');
  // The id is never decomposed, respaced or regrouped: the operator
  // copies it into receipt search, and normalizeReceiptNumber strips
  // whitespace but NOT '·' separators, so a respaced display would
  // fail search and mismatch paper.
  assert.ok(header.includes(`>${RECEIPT_ID}<`), 'id must be byte-identical');
  assert.ok(!header.includes('RCPT-12 · 202611 · 01'), 'id must never be respaced or regrouped');
  const labelAt = header.indexOf('Receipt No.');
  const idAt = header.indexOf(RECEIPT_ID);
  assert.ok(labelAt >= 0 && idAt > labelAt, 'label must sit immediately before the id');
  assert.ok(
    header.includes(`>Receipt No.</span> <span class="qc-receipt-id qc-txnid-code">${RECEIPT_ID}</span>`),
    'label and id must be adjacent spans, label first, id in the chip class',
  );
});

test('the label and id live inside one .qc-receipt-ref wrapper', () => {
  const header = headerOf(renderQuickCollectReceiptCardHtml(baseReceipt()));
  const wrapAt = header.indexOf('class="qc-receipt-ref"');
  assert.ok(wrapAt >= 0, 'header must carry a .qc-receipt-ref wrapper');
  assert.equal(header.match(/qc-receipt-ref/g).length, 1, 'exactly one ref wrapper in the header');
  // Match the label SPAN, not the bare words — the header comment above
  // the badge also mentions "Receipt No.".
  const labelAt = header.indexOf('>Receipt No.</span>');
  const idAt = header.indexOf(RECEIPT_ID);
  assert.ok(wrapAt < labelAt && wrapAt < idAt, 'wrapper must open before the label and the id');
});

test('the wrapper carries margin-left: auto and lays the group out in one row', () => {
  const ref = ruleBlock(stylesSrc, '.qc-receipt-ref {');
  assert.ok(ref.includes('display: inline-flex'), 'wrapper must lay label + id out in one row');
  assert.ok(ref.includes('align-items: center'), 'wrapper must centre the label against the chip');
  assert.ok(ref.includes('gap: 6px'), 'wrapper gap must be 6px');
  assert.ok(ref.includes('white-space: nowrap'), 'wrapper must not wrap mid-number');
  assert.ok(ref.includes('margin-left: auto'), 'wrapper must right-align the group');
  // The success-open .qc-receipt-id rule is scoped to the split
  // card's direct-child title (the ordinary id is nested inside the
  // wrapper now, so the rule must not reach it — an auto margin on
  // the inner id would split the label and the chip apart).
  const idOverride = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-header > .qc-receipt-id {');
  assert.ok(idOverride.includes('white-space: nowrap'), 'split title must still not wrap on success');
  assert.ok(idOverride.includes('margin-left: auto'), 'split title must stay right-aligned on success');
  assert.ok(!stylesSrc.includes('#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-id { white-space: nowrap; margin-left: auto; }'), 'the unscoped id rule must be gone — it would reach the wrapped id');
});

test('the id chip has a dark variant rule (the id had none of its own)', () => {
  const dark = ruleBlock(stylesSrc, '[data-theme="dark"] .qc-txnid-code {');
  assert.ok(dark.includes('background: #334155'), 'dark chip background must exist');
  assert.ok(dark.includes('color: #f8fafc'), 'dark chip text must exist');
});

test('the receipt id is HTML-escaped — a hostile stored value cannot break the header', () => {
  const header = headerOf(renderQuickCollectReceiptCardHtml(baseReceipt({ receiptNumber: '<script>alert(1)</script>' })));
  assert.ok(!header.includes('<script>alert(1)</script>'), 'raw markup must never reach the header');
  assert.ok(header.includes('&lt;script&gt;'), 'id must be escaped');
});

test('the WhatsApp draft still reads the labelled receipt number, byte-identical', () => {
  const { text } = formatQuickCollectWhatsAppReceipt(baseReceipt());
  assert.ok(text.includes(`🧾 *Receipt No:* ${RECEIPT_ID}`), 'draft must keep its labelled number');
});

test('the PNG slip still reads "Receipt #:" — the chip is card-only', () => {
  assert.ok(pngSrc.includes('Receipt #:'), 'PNG slip must keep its own label');
});

test('the split card header is untouched — it shows a title, not a number', () => {
  const split = renderSplitReceiptCardHtml(SPLIT_COMBINED);
  assert.ok(!split.includes('qc-receipt-ref'), 'split header must not gain the ordinary-card wrapper');
  assert.ok(!split.includes('Receipt No.'), 'split header must not gain the label');
  assert.ok(split.includes('qc-receipt-id'), 'split header must keep its id');
  assert.ok(split.includes('RCPT-12-202611-01'), 'split leg rows must keep their numbers inline');
});

test('the distinct-hex count in styles.css does not grow — zero new hex', () => {
  // Recorded baseline in tests/design-tokens-230.test.js: 621.
  // Counted exactly the ratchet's way: comments stripped, 6- or
  // 3-digit hex only.
  const distinct = new Set(stylesSrc.replace(/\/\*[\s\S]*?\*\//g, '').match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []);
  assert.ok(distinct.size <= 621, `styles.css has ${distinct.size} distinct hex colours, baseline is 621`);
});
