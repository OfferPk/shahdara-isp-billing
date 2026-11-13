import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { renderQuickCollectReceiptCardHtml } from '../nav-quick-collect.js';
import { renderSplitReceiptCardHtml } from '../split-tender-collect.js';
import { shortReceiptNumber } from '../receipt.js';
import { receiptShareDraftFor } from '../receipt-share-draft.js';

// QC SUCCESS CARD POLISH (2026-11-13, user spec 2026-11-12 ~15:46 PKT):
// (1) "Amount Collected" is one GREEN pill with the amount inside;
// (2) receipt numbers show as simple sequential RCPT-1, RCPT-2… on the
// card (DISPLAY-ONLY — the stored number is unchanged);
// (3) customer number plain "25" (no "#"), name GOLDEN with a KING 👑;
// (4) "Still owed" is HIDDEN entirely when fully paid;
// (5) the account's last 4 digits are a separate small pill beside the
// Sender name. Single + split cards, same rules where the split card
// has the row at all (it has no sender row, so item (5) is single-card
// only — documented in the PR body).

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const stylesSrc = read('styles.css');
const quickCollectSrc = read('nav-quick-collect.js');
const splitSrc = read('split-tender-collect.js');

function ruleBlock(src, selector) {
  const at = src.indexOf(selector);
  if (at < 0) return '';
  const open = src.indexOf('{', at);
  const close = src.indexOf('}', open);
  return src.slice(open + 1, close);
}

function baseReceipt(overrides = {}) {
  return {
    id: 'receipt-12',
    receiptNumber: 'RCPT-12-202611-01',
    amount: 3000,
    customerId: 'cust-37',
    customerName: 'Test Customer',
    customerNumber: 37,
    date: '2026-11-08',
    month: '2026-11',
    method: 'Cash',
    area: 'Sodaa',
    payableRemaining: 0,
    newTotalDues: 0,
    phone: '',
    ...overrides,
  };
}

function baseSplit(overrides = {}) {
  return {
    customerName: 'Test Customer',
    customerNumber: 37,
    area: 'Sodaa',
    totalReceived: 3000,
    balanceDueCents: 0,
    payableRemainingCents: 0,
    legs: [
      { leg: 1, method: 'Cash', amount: 2000, receiptNumber: 'RCPT-12-202611-01' },
      { leg: 2, method: 'Easypaisa', amount: 1000, receiptNumber: 'RCPT-12-202611-02' },
    ],
    ...overrides,
  };
}

// The amount pill div, or '' when the card has none.
function amountPillOf(html) {
  const at = html.indexOf('qc-amount-pill');
  if (at < 0) return '';
  const start = html.lastIndexOf('<div', at);
  const end = html.indexOf('</div>', at);
  return html.slice(start, end);
}

// --- (2) shortReceiptNumber: the display-only short form ---

test('shortReceiptNumber: RCPT-<cust>-<YYYYMM>-<seq> collapses to RCPT-<seq>', () => {
  assert.equal(shortReceiptNumber('RCPT-12-202611-01'), 'RCPT-1');
  assert.equal(shortReceiptNumber('RCPT-12-202611-03'), 'RCPT-3');
  assert.equal(shortReceiptNumber('RCPT-12-202611-12'), 'RCPT-12');
  assert.equal(shortReceiptNumber('RCPT-37-202611-01'), 'RCPT-1');
});

test('shortReceiptNumber: anything outside the RCPT pattern is returned as-is', () => {
  // The REC- fallback and plain book integers are not RCPT numbers —
  // the helper must never mangle them.
  assert.equal(shortReceiptNumber('REC-2611-0012-1001'), 'REC-2611-0012-1001');
  assert.equal(shortReceiptNumber('42'), '42');
  assert.equal(shortReceiptNumber(''), '');
  assert.equal(shortReceiptNumber(null), '');
  assert.equal(shortReceiptNumber(undefined), '');
  assert.equal(shortReceiptNumber('<script>alert(1)</script>'), '<script>alert(1)</script>');
});

// --- (1) Amount Collected: one green pill, amount inside ---

test('amount: the Amount row is one green pill with the label and amount inside it', () => {
  const html = renderQuickCollectReceiptCardHtml(baseReceipt());
  const pill = amountPillOf(html);
  assert.ok(pill, 'card must carry an amount pill');
  assert.ok(pill.includes('Amount Collected'), 'pill must carry the label');
  assert.ok(pill.includes('PKR 3,000'), 'pill must carry the amount inside it');
  assert.equal((html.match(/Amount Collected/g) || []).length, 1, 'Amount Collected must appear once');
});

test('amount: the split card total is the same green pill', () => {
  const html = renderSplitReceiptCardHtml(baseSplit());
  const pill = amountPillOf(html);
  assert.ok(pill, 'split card must carry an amount pill');
  assert.ok(pill.includes('PKR 3,000'), 'pill must carry the total inside it');
});

test('amount: pill CSS — mint palette, pill radius, emerald label, no new hex', () => {
  const pill = ruleBlock(stylesSrc, '.qc-receipt-amount-row.qc-amount-pill {');
  assert.ok(pill.includes('background: var(--qc-mint-bg)'), 'pill must use the mint background token');
  assert.ok(pill.includes('border: 1px solid var(--qc-mint-border)'), 'pill must use the mint border token');
  assert.ok(pill.includes('border-radius: 999px'), 'pill must be fully rounded');
  assert.ok(pill.includes('padding: 2px 14px'), 'pill padding must stay 2px vertical (C4 compactness)');
  assert.ok(!/#[0-9a-fA-F]{3,8}/.test(pill), 'pill rule must carry no hex (tokens only)');
  const label = ruleBlock(stylesSrc, '.qc-receipt-amount-row.qc-amount-pill .qc-receipt-label {');
  assert.ok(label.includes('color: var(--qc-emerald-text)'), 'pill label must be emerald');
  assert.ok(label.includes('font-weight: 700'), 'pill label must be bold');
  const success = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-amount-row.qc-amount-pill {');
  assert.ok(success.includes('padding: 2px 14px'), 'success-open must pin the pill padding, not the plain row');
  const amount = ruleBlock(stylesSrc, '#quickCollectModal.qc-success-open .qc-receipt-card .qc-receipt-amount {');
  assert.ok(amount.includes('font-size: 1.3rem'), 'amount must stay 1.3rem on success-open');
});

// --- (3) Customer: plain number, golden name, crown ---

test('customer: golden crown name + plain number, no "#" and no parens — single card', () => {
  const html = renderQuickCollectReceiptCardHtml(baseReceipt());
  assert.ok(html.includes('👑 Test Customer 37'), 'card must show crown + name + plain number');
  assert.ok(!html.includes('(#37)'), 'card must not show the old (#N) form');
  assert.ok(!html.includes('#37'), 'card must not show a # before the number');
  assert.ok(html.includes('qc-customer-golden'), 'name must carry the golden class');
});

test('customer: golden crown name + plain number — split card', () => {
  const html = renderSplitReceiptCardHtml(baseSplit());
  assert.ok(html.includes('👑 Test Customer 37'), 'split card must show crown + name + plain number');
  assert.ok(!html.includes('(#37)'), 'split card must not show the old (#N) form');
});

test('customer: golden CSS reuses the ID-pill gold — no new hex', () => {
  const golden = ruleBlock(stylesSrc, '.qc-customer-golden {');
  assert.ok(golden.includes('color: #704600'), 'golden name must use the existing ID-pill gold');
  const hexes = golden.match(/#[0-9a-fA-F]{3,8}/g) || [];
  assert.deepEqual(hexes, ['#704600'], 'golden rule must carry no hex beyond the existing gold');
});

// --- (4) Still owed: hidden when fully paid, shown when anything is owed ---

test('still owed: the row is HIDDEN entirely on a fully-paid single card', () => {
  const html = renderQuickCollectReceiptCardHtml(baseReceipt({ payableRemaining: 0 }));
  assert.ok(!html.includes('Still owed'), 'fully-paid card must not carry a Still owed row');
  assert.ok(!html.includes('Fully paid'), 'fully-paid card must not carry a Fully paid row either — the settled state lives in the still-owes pill');
  assert.ok(!html.includes('PKR 0'), 'no PKR 0 text may appear');
});

test('still owed: the row is HIDDEN entirely on a fully-paid split card', () => {
  const html = renderSplitReceiptCardHtml(baseSplit({ payableRemainingCents: 0, balanceDueCents: 0 }));
  assert.ok(!html.includes('Still owed'), 'fully-paid split card must not carry a Still owed row');
  assert.ok(!html.includes('Fully paid'), 'fully-paid split card must not carry a Fully paid row either');
});

test('still owed: the row is SHOWN with the figure when anything is still owed', () => {
  const html = renderQuickCollectReceiptCardHtml(baseReceipt({ payableRemaining: 1000, newTotalDues: 1000 }));
  assert.ok(html.includes('Still owed'), 'partial card must keep the Still owed row');
  assert.ok(html.includes('PKR 1,000'), 'partial card must show the owed figure');
  const split = renderSplitReceiptCardHtml(baseSplit({ payableRemainingCents: 100000, balanceDueCents: 100000 }));
  assert.ok(split.includes('Still owed'), 'partial split card must keep the Still owed row');
  assert.ok(split.includes('PKR 1,000'), 'partial split card must show the owed figure');
});

test('still owed: charges pending keeps the charged label when the figure is > 0', () => {
  // Sharafat 2: a split that settles every bill while a charge is
  // pending still reads "Still owed" — the hide rule keys on the
  // canonical payable remainder, not on the bill dues alone.
  const html = renderQuickCollectReceiptCardHtml({ ...baseReceipt(), payableRemaining: 300, newTotalDues: 300, ticketChargesPending: 300 });
  assert.ok(html.includes('Still owed (incl. pending charges)'), 'charged label must appear when charges remain');
  assert.ok(html.includes('PKR 300'), 'charged figure must show');
});

// --- (2) Receipt number on the card: short form visible, full number kept ---

test('receipt number: the card header shows the SHORT form; the full number stays in title + data attr', () => {
  const html = renderQuickCollectReceiptCardHtml(baseReceipt());
  assert.ok(html.includes('>RCPT-1<'), 'header must show the short form RCPT-1');
  assert.ok(html.includes('title="RCPT-12-202611-01"'), 'full number must stay in the title');
  assert.ok(html.includes('data-full-receipt-number="RCPT-12-202611-01"'), 'full number must stay in the data attribute');
  assert.ok(!html.includes('>RCPT-12-202611-01<'), 'the full number must not be the visible text');
});

test('receipt number: split legs show the short form', () => {
  const html = renderSplitReceiptCardHtml(baseSplit());
  assert.ok(html.includes('RCPT-1'), 'leg 1 must show RCPT-1');
  assert.ok(html.includes('RCPT-2'), 'leg 2 must show RCPT-2');
  assert.ok(!html.includes('RCPT-12-202611-01'), 'split legs must not show the full stored number');
  assert.ok(!html.includes('RCPT-12-202611-02'), 'split legs must not show the full stored number');
});

test('receipt number: the stored number is UNCHANGED — the draft still carries the full number', () => {
  // The card is display-only: the payment's identity (search,
  // jump-to-receipt, reversal links, gap audit, reprints, offline
  // queue, WhatsApp drafts) keeps the full stored number. The draft
  // is the proof — it is built from the same receipt object, and its
  // receiptNumber is the stored one, not the card's short form.
  const draft = receiptShareDraftFor(baseReceipt(), 'share text');
  assert.ok(draft, 'draft must build from the receipt');
  assert.equal(draft.receiptNumber, 'RCPT-12-202611-01', 'draft must carry the full stored number');
});

// --- (5) Sender: last 4 digits as their own small pill ---

test('sender: title + digits pill beside the name; the bracketed form is gone', () => {
  const html = renderQuickCollectReceiptCardHtml(baseReceipt({
    senderTitle: 'Hamza',
    senderDigits: '3310',
    senderLabel: 'Hamza (…3310)',
  }));
  assert.ok(html.includes('Hamza'), 'sender name must show');
  assert.ok(html.includes('<span class="qc-sender-digits-pill">…3310</span>'), 'last 4 must be their own pill');
  assert.ok(!html.includes('Hamza (…3310)'), 'the bracketed combined label must not appear on the card');
  assert.ok(html.includes('data-qc-receipt-sender'), 'sender row must be present');
});

test('sender: title-only shows no pill; digits-only shows the pill alone', () => {
  const titleOnly = renderQuickCollectReceiptCardHtml(baseReceipt({ senderTitle: 'Hamza', senderDigits: '' }));
  assert.ok(titleOnly.includes('Hamza'), 'title-only must show the name');
  assert.ok(!titleOnly.includes('qc-sender-digits-pill'), 'title-only must carry no digits pill');
  const digitsOnly = renderQuickCollectReceiptCardHtml(baseReceipt({ senderTitle: '', senderDigits: '3310' }));
  assert.ok(digitsOnly.includes('<span class="qc-sender-digits-pill">…3310</span>'), 'digits-only must show the pill');
  assert.ok(digitsOnly.includes('data-qc-receipt-sender'), 'digits-only must still show the row');
});

test('sender: a receipt with only the combined label falls back to it, pill-less', () => {
  // Older receipts carry senderLabel only — the row must still show
  // the name, with no pill and no duplication.
  const html = renderQuickCollectReceiptCardHtml(baseReceipt({ senderLabel: 'Hamza (…3310)' }));
  assert.ok(html.includes('Hamza (…3310)'), 'combined label must show as the fallback');
  assert.ok(!html.includes('qc-sender-digits-pill'), 'fallback must carry no digits pill');
});

test('sender: no sender at all hides the row', () => {
  const html = renderQuickCollectReceiptCardHtml(baseReceipt());
  assert.ok(!html.includes('data-qc-receipt-sender'), 'no sender must mean no sender row');
});

test('sender: digits pill CSS — mint palette, small, no new hex', () => {
  const pill = ruleBlock(stylesSrc, '.qc-sender-digits-pill {');
  assert.ok(pill.includes('background: var(--qc-mint-bg)'), 'digits pill must use the mint background token');
  assert.ok(pill.includes('border: 1px solid var(--qc-mint-border)'), 'digits pill must use the mint border token');
  assert.ok(pill.includes('color: var(--qc-emerald-text)'), 'digits pill text must be emerald');
  assert.ok(pill.includes('border-radius: 999px'), 'digits pill must be fully rounded');
  assert.ok(pill.includes('font-size: 0.72rem'), 'digits pill must be small');
  assert.ok(!/#[0-9a-fA-F]{3,8}/.test(pill), 'digits pill rule must carry no hex (tokens only)');
});

// --- Wiring + fit arithmetic basis ---

test('wiring: both card builders use the short-number helper and the new classes', () => {
  assert.ok(quickCollectSrc.includes('shortReceiptNumber'), 'single-card file must import the helper');
  assert.ok(quickCollectSrc.includes("shortReceiptNumber(receipt.receiptNumber)"), 'single card must shorten the header number');
  assert.ok(quickCollectSrc.includes('paymentSenderTitle'), 'single-card file must split the sender title');
  assert.ok(quickCollectSrc.includes('paymentSenderDigits'), 'single-card file must split the sender digits');
  assert.ok(quickCollectSrc.includes('qc-amount-pill'), 'single card must carry the pill class');
  assert.ok(quickCollectSrc.includes('qc-customer-golden'), 'single card must carry the golden class');
  assert.ok(quickCollectSrc.includes('qc-sender-digits-pill'), 'single card must carry the digits pill');
  assert.ok(splitSrc.includes('shortReceiptNumber'), 'split-card file must import the helper');
  assert.ok(splitSrc.includes('shortReceiptNumber(leg.receiptNumber)'), 'split legs must shorten their numbers');
  assert.ok(splitSrc.includes('qc-amount-pill'), 'split card must carry the pill class');
  assert.ok(splitSrc.includes('qc-customer-golden'), 'split card must carry the golden class');
  // The settled state left the card row: neither builder may reference
  // the FULLY_PAID text any more — the still-owes pill states it.
  assert.ok(!quickCollectSrc.includes('SUCCESS_NEXT_STEPS_FULLY_PAID_TEXT'), 'single-card file must not reference the Fully paid text');
  assert.ok(!splitSrc.includes('SUCCESS_NEXT_STEPS_FULLY_PAID_TEXT'), 'split-card file must not reference the Fully paid text');
});

test('fit basis: a fully-paid TAXED card has 6 half-width items in 3 rows', () => {
  // The hidden Still-owed row gives back one 43px grid row; the pill
  // border adds 2px to the amount row. The plan552 + polish17 fit
  // tests pin the derived totals; this test pins the structure they
  // derive from: Customer, Mobile, Date & Method, Month, Area,
  // Next due = 6 half-width items → 3 rows (was 7 items / 4 rows).
  const html = renderQuickCollectReceiptCardHtml(baseReceipt({ salesTaxCents: 4300 }));
  // Same counting as the plan552/polish17 fit tests: every
  // .qc-receipt-item minus the full-width ones (the tax row here).
  const all = (html.match(/<div class="qc-receipt-item/g) || []).length;
  const full = (html.match(/<div class="qc-receipt-item full-width/g) || []).length;
  const halfWidth = all - full;
  assert.equal(halfWidth, 6, 'fully-paid taxed card must have 6 half-width items');
  assert.equal(Math.ceil(halfWidth / 2), 3, 'fully-paid taxed card must lay out in 3 grid rows');
});
