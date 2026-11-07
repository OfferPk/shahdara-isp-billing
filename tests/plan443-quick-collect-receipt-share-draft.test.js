// Plan 443 — Quick Collect receipt share draft right after payment:
// one visible draft of the receipt's share text on the success
// screen, read first, with Send and Dismiss. The draft's figures
// must match the saved payment and its receipt on the same fixture;
// preparing it changes no bill, payment, receipt, or customer
// record, and it never touches the confirmation draft.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RECEIPT_SHARE_DRAFT_HEADING_TEXT,
  RECEIPT_SHARE_DRAFT_SEND_TEXT,
  RECEIPT_SHARE_DRAFT_DISMISS_TEXT,
  RECEIPT_SHARE_DRAFT_NO_RECEIPT_TEXT,
  receiptShareDraftFigureCents,
  receiptShareDraftIsStrictDate,
  receiptShareDraftIsStrictMonth,
  formatReceiptShareDraftAmount,
  receiptShareDraftFor,
  receiptShareDraftMatchesReceipt,
  receiptShareDraftText,
  receiptShareDraftLineText,
  receiptShareDraftHtml,
} from '../receipt-share-draft.js';

const moduleSrc = readFileSync(new URL('../receipt-share-draft.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// Generic fixture receipt: one ordinary single payment, November 2026.
function receipt(extra = {}) {
  return {
    id: 'rcpt-1',
    receiptNumber: 'RCPT-41-202611-01',
    customerName: 'Customer One',
    customerNumber: 41,
    amount: 3000,
    method: 'Cash',
    date: '2026-11-07',
    month: '2026-11',
    phone: '03012345678',
    ...extra,
  };
}

// Generic fixture share text: the receipt's own figures in plain words.
const SHARE_TEXT = [
  'PAYMENT RECEIPT',
  'Receipt No: RCPT-41-202611-01',
  'Customer: Customer One (#41)',
  'Amount Received: PKR 3,000',
  'Payment Method: Cash',
  'Date: 2026-11-07',
].join('\n');

// Generic fixture split receipt: two legs, one combined total.
function splitReceipt() {
  return {
    id: 'rcpt-2',
    receiptNumber: 'RCPT-41-202611-02',
    customerName: 'Customer One',
    customerNumber: 41,
    amount: 5000,
    method: 'Cash',
    date: '2026-11-07',
    month: '2026-11',
    phone: '03012345678',
    splitTender: {
      legs: [
        { leg: 1, receiptNumber: 'RCPT-41-202611-01', method: 'Cash', amount: 3000 },
        { leg: 2, receiptNumber: 'RCPT-41-202611-02', method: 'JazzCash', amount: 2000 },
      ],
      totalReceivedCents: 500000,
      totalReceived: 5000,
      date: '2026-11-07',
      month: '2026-11',
    },
  };
}

const SPLIT_SHARE_TEXT = [
  'COMBINED RECEIPT',
  'Leg 1: Cash — PKR 3,000 · Receipt No: RCPT-41-202611-01',
  'Leg 2: JazzCash — PKR 2,000 · Receipt No: RCPT-41-202611-02',
  'Total Received: PKR 5,000',
].join('\n');

// --- Figure cents: a missing figure is "not a number", never zero ---

test('figure cents: missing, boolean or blank is null, never zero', () => {
  for (const bad of [null, undefined, '', true, false, Number.NaN, 'abc']) {
    assert.equal(receiptShareDraftFigureCents(bad), null, `expected null for ${String(bad)}`);
  }
  assert.equal(receiptShareDraftFigureCents(3000), 300000);
  assert.equal(receiptShareDraftFigureCents(1500.5), 150050);
  assert.equal(receiptShareDraftFigureCents('3000'), 300000);
  assert.equal(receiptShareDraftFigureCents(0), 0);
});

// --- Amount formatting: min-0 decimals ---

test('amount: min-0 decimals, grouped like the other live lines', () => {
  assert.equal(formatReceiptShareDraftAmount(300000), '3,000');
  assert.equal(formatReceiptShareDraftAmount(150050), '1,500.5');
  assert.equal(formatReceiptShareDraftAmount(0), '0');
  assert.equal(formatReceiptShareDraftAmount(null), '0');
});

// --- Strict date and month ---

test('date: strict YYYY-MM-DD only, leap-aware', () => {
  assert.equal(receiptShareDraftIsStrictDate('2026-11-07'), true);
  assert.equal(receiptShareDraftIsStrictDate('2024-02-29'), true);
  assert.equal(receiptShareDraftIsStrictDate('2000-02-29'), true);
  assert.equal(receiptShareDraftIsStrictDate('2023-02-29'), false);
  assert.equal(receiptShareDraftIsStrictDate('2026-02-29'), false);
  assert.equal(receiptShareDraftIsStrictDate('1900-02-29'), false);
  assert.equal(receiptShareDraftIsStrictDate('2026-13-01'), false);
  assert.equal(receiptShareDraftIsStrictDate('2026-11-7'), false);
  assert.equal(receiptShareDraftIsStrictDate('07-11-2026'), false);
  assert.equal(receiptShareDraftIsStrictDate(null), false);
  assert.equal(receiptShareDraftIsStrictDate(''), false);
});

test('month: strict YYYY-MM only', () => {
  assert.equal(receiptShareDraftIsStrictMonth('2026-11'), true);
  assert.equal(receiptShareDraftIsStrictMonth('2026-13'), false);
  assert.equal(receiptShareDraftIsStrictMonth('2026-1'), false);
  assert.equal(receiptShareDraftIsStrictMonth('Nov 2026'), false);
  assert.equal(receiptShareDraftIsStrictMonth(null), false);
});

// --- Draft preparation: single payment ---

test('draft: a single payment yields every figure beside the text', () => {
  const draft = receiptShareDraftFor(receipt(), SHARE_TEXT);
  assert.ok(draft);
  assert.equal(draft.receiptNumber, 'RCPT-41-202611-01');
  assert.deepEqual(draft.receiptNumbers, []);
  assert.equal(draft.customerName, 'Customer One');
  assert.equal(draft.customerNumber, '41');
  assert.equal(draft.amountCents, 300000);
  assert.equal(draft.method, 'Cash');
  assert.equal(draft.date, '2026-11-07');
  assert.equal(draft.month, '2026-11');
  assert.equal(draft.phone, '03012345678');
  assert.equal(draft.text, SHARE_TEXT);
});

test('draft: the share text is carried verbatim, never rebuilt', () => {
  const draft = receiptShareDraftFor(receipt(), SHARE_TEXT);
  assert.equal(receiptShareDraftText(draft), SHARE_TEXT);
  assert.equal(receiptShareDraftText(null), '');
  assert.equal(receiptShareDraftText({}), '');
});

test('draft: no draft without a receipt, text, number, amount, method, date, month, or name', () => {
  assert.equal(receiptShareDraftFor(null, SHARE_TEXT), null);
  assert.equal(receiptShareDraftFor(receipt(), ''), null);
  assert.equal(receiptShareDraftFor(receipt(), '   '), null);
  assert.equal(receiptShareDraftFor(receipt({ receiptNumber: '' }), SHARE_TEXT), null);
  assert.equal(receiptShareDraftFor(receipt({ receiptNumber: '   ' }), SHARE_TEXT), null);
  assert.equal(receiptShareDraftFor(receipt({ amount: null }), SHARE_TEXT), null);
  assert.equal(receiptShareDraftFor(receipt({ amount: true }), SHARE_TEXT), null);
  assert.equal(receiptShareDraftFor(receipt({ amount: '' }), SHARE_TEXT), null);
  assert.equal(receiptShareDraftFor(receipt({ method: '' }), SHARE_TEXT), null);
  assert.equal(receiptShareDraftFor(receipt({ date: '2026-11-7' }), SHARE_TEXT), null);
  assert.equal(receiptShareDraftFor(receipt({ date: '2023-02-29' }), SHARE_TEXT), null);
  assert.equal(receiptShareDraftFor(receipt({ month: '2026-13' }), SHARE_TEXT), null);
  assert.equal(receiptShareDraftFor(receipt({ month: '' }), SHARE_TEXT), null);
  assert.equal(receiptShareDraftFor(receipt({ customerName: '' }), SHARE_TEXT), null);
  assert.equal(receiptShareDraftFor(receipt({ customerName: '   ' }), SHARE_TEXT), null);
});

test('draft: a missing phone still drafts — Send falls back the way the button does', () => {
  const draft = receiptShareDraftFor(receipt({ phone: '' }), SHARE_TEXT);
  assert.ok(draft);
  assert.equal(draft.phone, '');
});

test('draft: the input receipt is never mutated', () => {
  const input = receipt();
  const before = JSON.stringify(input);
  receiptShareDraftFor(input, SHARE_TEXT);
  assert.equal(JSON.stringify(input), before);
});

// --- Draft preparation: split collection ---

test('draft: a split collection carries both leg numbers and the combined total', () => {
  const draft = receiptShareDraftFor(splitReceipt(), SPLIT_SHARE_TEXT);
  assert.ok(draft);
  assert.equal(draft.receiptNumber, '');
  assert.deepEqual(draft.receiptNumbers, ['RCPT-41-202611-01', 'RCPT-41-202611-02']);
  assert.equal(draft.amountCents, 500000);
  assert.equal(draft.method, 'Cash + JazzCash');
  assert.equal(draft.date, '2026-11-07');
  assert.equal(draft.month, '2026-11');
  assert.equal(draft.text, SPLIT_SHARE_TEXT);
});

test('draft: a split with no leg numbers yields no draft — none is fabricated', () => {
  const split = splitReceipt();
  split.splitTender.legs = [
    { leg: 1, receiptNumber: '', method: 'Cash', amount: 3000 },
    { leg: 2, receiptNumber: '   ', method: 'JazzCash', amount: 2000 },
  ];
  assert.equal(receiptShareDraftFor(split, SPLIT_SHARE_TEXT), null);
});

test('draft: a split total falls back to the rupee total when the cents total is unusable', () => {
  const split = splitReceipt();
  split.splitTender.totalReceivedCents = null;
  const draft = receiptShareDraftFor(split, SPLIT_SHARE_TEXT);
  assert.ok(draft);
  assert.equal(draft.amountCents, 500000);
});

// --- Match check: the acceptance ---

test('match: the draft matches its own receipt', () => {
  const draft = receiptShareDraftFor(receipt(), SHARE_TEXT);
  assert.equal(receiptShareDraftMatchesReceipt(draft, receipt()), true);
});

test('match: the split draft matches its own combined receipt', () => {
  const draft = receiptShareDraftFor(splitReceipt(), SPLIT_SHARE_TEXT);
  assert.equal(receiptShareDraftMatchesReceipt(draft, splitReceipt()), true);
});

test('match: any tampered figure fails the match', () => {
  const base = receiptShareDraftFor(receipt(), SHARE_TEXT);
  const tampered = (patch) => receiptShareDraftMatchesReceipt({ ...base, ...patch }, receipt());
  assert.equal(tampered({ amountCents: 300001 }), false);
  assert.equal(tampered({ method: 'JazzCash' }), false);
  assert.equal(tampered({ date: '2026-11-08' }), false);
  assert.equal(tampered({ month: '2026-10' }), false);
  assert.equal(tampered({ customerName: 'Customer Two' }), false);
  assert.equal(tampered({ customerNumber: '42' }), false);
  assert.equal(tampered({ receiptNumber: 'RCPT-41-202611-99' }), false);
  assert.equal(tampered({ text: '' }), false);
  assert.equal(receiptShareDraftMatchesReceipt(null, receipt()), false);
  assert.equal(receiptShareDraftMatchesReceipt(base, null), false);
});

test('match: a tampered split leg number fails the match', () => {
  const draft = receiptShareDraftFor(splitReceipt(), SPLIT_SHARE_TEXT);
  const tampered = { ...draft, receiptNumbers: ['RCPT-41-202611-01', 'RCPT-41-202611-99'] };
  assert.equal(receiptShareDraftMatchesReceipt(tampered, splitReceipt()), false);
});

// --- Line text and HTML ---

test('line: one plain line naming number, customer, amount, method, date', () => {
  const draft = receiptShareDraftFor(receipt(), SHARE_TEXT);
  assert.equal(
    receiptShareDraftLineText(draft),
    'Receipt RCPT-41-202611-01 · Customer One (#41) · PKR 3,000 · Cash · 2026-11-07',
  );
  assert.equal(receiptShareDraftLineText(null), '');
});

test('line: a split names both receipt numbers', () => {
  const draft = receiptShareDraftFor(splitReceipt(), SPLIT_SHARE_TEXT);
  assert.equal(
    receiptShareDraftLineText(draft),
    'Receipts RCPT-41-202611-01, RCPT-41-202611-02 · Customer One (#41) · PKR 5,000 · Cash + JazzCash · 2026-11-07',
  );
});

test('html: heading, line, text as shown, Send and Dismiss — buttons never submit', () => {
  const draft = receiptShareDraftFor(receipt(), SHARE_TEXT);
  const html = receiptShareDraftHtml(draft);
  assert.ok(html.includes(RECEIPT_SHARE_DRAFT_HEADING_TEXT), 'missing heading');
  assert.ok(html.includes('Receipt RCPT-41-202611-01'), 'missing line');
  assert.ok(html.includes('Amount Received: PKR 3,000'), 'missing share text');
  assert.ok(html.includes('data-rsd-send'), 'missing Send hook');
  assert.ok(html.includes(RECEIPT_SHARE_DRAFT_SEND_TEXT), 'missing Send label');
  assert.ok(html.includes('data-rsd-dismiss'), 'missing Dismiss hook');
  assert.ok(html.includes(RECEIPT_SHARE_DRAFT_DISMISS_TEXT), 'missing Dismiss label');
  assert.ok(html.includes('type="button"'), 'buttons must be plain buttons');
  assert.ok(!html.includes('type="submit"'), 'no button may submit the form');
  assert.equal(receiptShareDraftHtml(null), '');
});

test('html: user text is escaped before it reaches the page', () => {
  const nasty = receipt({ customerName: 'A <script>alert(1)</script> B' });
  const textWithName = SHARE_TEXT.replace('Customer One', 'A <script>alert(1)</script> B');
  const draft = receiptShareDraftFor(nasty, textWithName);
  const html = receiptShareDraftHtml(draft);
  assert.ok(!html.includes('<script>alert(1)</script>'), 'raw script must not reach the page');
  assert.ok(html.includes('&lt;script&gt;'), 'script must be escaped');
});

// --- Purity and fences ---

test('purity: the module reads no storage, clock, or page and takes no other module', () => {
  assert.doesNotMatch(moduleSrc, /localStorage/);
  assert.doesNotMatch(moduleSrc, /sessionStorage/);
  assert.doesNotMatch(moduleSrc, /fetch\(/);
  assert.doesNotMatch(moduleSrc, /new Date\(/);
  assert.doesNotMatch(moduleSrc, /Date\.now\(/);
  assert.doesNotMatch(moduleSrc, /document\./);
  assert.doesNotMatch(moduleSrc, /^import /m);
  assert.doesNotMatch(moduleSrc, /window\./);
});

test('fences: the header names no fenced module file literally', () => {
  const header = moduleSrc.slice(0, moduleSrc.indexOf('const RECEIPT_SHARE_DRAFT_DATE_RE'));
  for (const fenced of [
    'payment-confirmation.js',
    'statement-draft.js',
    'history-share-summary.js',
    'receipt-preview.js',
    'success-next-steps.js',
    'receipt-delivery.js',
    'save-confirmation-summary.js',
    'split-tender-collect.js',
    'nav-quick-profile.js',
  ]) {
    assert.ok(!header.includes(fenced), `header must not name ${fenced}`);
  }
});

test('fences: the closest drafts never carry a share-draft name', () => {
  for (const file of [
    'payment-confirmation.js',
    'statement-draft.js',
    'history-share-summary.js',
    'receipt-preview.js',
    'success-next-steps.js',
  ]) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.ok(!src.includes('receiptShareDraft'), `${file} must not reference the share draft`);
    assert.ok(!src.includes('rsdReceiptShareDraft'), `${file} must not reference the share-draft host`);
  }
});

// --- Wiring ---

test('wiring: the Quick Collect controller imports the share draft', () => {
  assert.ok(wiringSrc.includes("from './receipt-share-draft.js'"), 'missing module import');
  assert.ok(wiringSrc.includes('receiptShareDraftFor, receiptShareDraftHtml'), 'missing draft imports');
});

test('wiring: the share-draft host is read on the success step', () => {
  assert.ok(wiringSrc.includes("getElementById('rsdReceiptShareDraft')"), 'missing host lookup');
});

test('wiring: the render prepares the draft from the saved receipt and its dispatch text', () => {
  assert.ok(wiringSrc.includes('function renderReceiptShareDraft()'), 'missing render function');
  assert.ok(
    wiringSrc.includes('receiptShareDraftFor(activeReceipt,'),
    'render must prepare the draft from the active receipt',
  );
  assert.ok(
    wiringSrc.includes('formatQuickCollectWhatsAppReceipt(activeReceipt,'),
    'render must read the single-payment dispatch text',
  );
  assert.ok(
    wiringSrc.includes('formatSplitTenderWhatsAppText(activeReceipt.splitTender)'),
    'render must read the combined-receipt text for a split',
  );
});

test('wiring: Send routes through the existing messaging dispatch, Dismiss hides the draft', () => {
  assert.ok(wiringSrc.includes("data-rsd-send"), 'missing Send hook handling');
  assert.ok(wiringSrc.includes('whatsAppBtn?.click()'), 'Send must reuse the existing dispatch button');
  assert.ok(wiringSrc.includes("data-rsd-dismiss"), 'missing Dismiss hook handling');
  assert.ok(wiringSrc.includes('shareDraftDismissedFor'), 'Dismiss must remember the dismissed receipt');
});

test('wiring: the draft renders on both success paths and refreshes with the receipt card', () => {
  const calls = wiringSrc.match(/renderReceiptShareDraft\(\);/g) || [];
  // Plan 449: the second-connection record is a third success path, so
  // the draft renders there too — split save, single save, card re-render,
  // second-connection record.
  assert.equal(calls.length, 4, `expected 4 render calls (split save, single save, card re-render, second-connection record), got ${calls.length}`);
  const cardFn = wiringSrc.slice(
    wiringSrc.indexOf('function renderActiveReceiptCard()'),
    wiringSrc.indexOf('function renderSuccessNextSteps()'),
  );
  assert.ok(cardFn.includes('renderReceiptShareDraft();'), 'card re-render must refresh the draft');
});

test('wiring: the draft hides once the receipt is already shared or dismissed', () => {
  const start = wiringSrc.indexOf('function renderReceiptShareDraft()');
  assert.ok(start !== -1, 'missing render function');
  const nextFn = wiringSrc.indexOf('\n  function ', start + 10);
  const fn = nextFn === -1 ? wiringSrc.slice(start) : wiringSrc.slice(start, nextFn);
  assert.ok(fn.includes('isReceiptShared(activeReceipt.id)'), 'shared receipts must hide the draft');
  assert.ok(fn.includes('shareDraftDismissedFor === activeReceipt.id'), 'dismissed receipts must stay hidden');
});

test('page: the share-draft host sits on the success step, after the next-steps host', () => {
  const stepAt = pageSrc.indexOf('id="quickCollectStepSuccess"');
  const hostAt = pageSrc.indexOf('id="rsdReceiptShareDraft"');
  const actionsAt = pageSrc.indexOf('qc-success-actions', stepAt);
  const nextStepsAt = pageSrc.indexOf('id="snsSuccessNextSteps"');
  assert.ok(stepAt !== -1 && hostAt > stepAt, 'host must be inside the success step');
  assert.ok(hostAt > nextStepsAt, 'host must sit after the next-steps host');
  assert.ok(hostAt < actionsAt, 'host must sit before the success actions');
  assert.ok(pageSrc.includes('id="rsdReceiptShareDraft" hidden'), 'host starts hidden');
});

test('styles: the draft reuses existing button classes — no new rule, no new colour', () => {
  assert.ok(!stylesSrc.includes('rsd-'), 'no share-draft rule belongs in styles.css');
});

test('constants: the draft texts are plain words', () => {
  assert.equal(RECEIPT_SHARE_DRAFT_HEADING_TEXT, 'Receipt share draft');
  assert.equal(RECEIPT_SHARE_DRAFT_SEND_TEXT, 'Send on WhatsApp');
  assert.equal(RECEIPT_SHARE_DRAFT_DISMISS_TEXT, 'Dismiss');
  assert.equal(RECEIPT_SHARE_DRAFT_NO_RECEIPT_TEXT, 'No receipt to share.');
});
