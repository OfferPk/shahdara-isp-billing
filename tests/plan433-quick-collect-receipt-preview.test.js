// Plan 433 — Quick Collect receipt preview before saving: one receipt
// preview on the Quick Collect screen — the receipt exactly as it will
// print (customer, amount in digits and words, method, receipt number,
// date), shown on the confirm step before saving. It previews only and
// issues nothing until saved.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeReceiptPreview,
  receiptPreviewFor,
  receiptPreviewLineText,
  receiptPreviewHtml,
  receiptPreviewMatchesReceipt,
  receiptPreviewIsStrictDate,
  receiptPreviewFigureCents,
  formatReceiptPreviewAmount,
} from '../receipt-preview.js';
import { amountInWords } from '../amount-in-words.js';
import { nextReceiptNumberFor } from '../next-receipt-number.js';
import { buildPaymentReceipt } from '../receipt.js';

const moduleSrc = readFileSync(new URL('../receipt-preview.js', import.meta.url), 'utf8');
const wiringSrc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
const stylesSrc = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const pageSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// The same fixture the acceptance uses: Customer One (#41) pays
// PKR 3,000 in cash for November 2026, on 2026-11-07.
const goodInput = () => ({
  customerName: 'Customer One',
  customerNumber: 41,
  amount: 3000,
  amountWords: 'Three thousand',
  method: 'Cash',
  receiptNumber: 'RCPT-41-202611-01',
  date: '2026-11-07',
});

const preSaveCustomer = () => ({
  id: 'c1',
  customerNumber: 41,
  name: 'Customer One',
  packageSpeed: '5 Mbps',
  monthlyPriceSchedule: [],
  bills: [{ id: 'bill-2026-11', month: '2026-11', dueAmount: 3000, status: 'pending', payments: [], amountHistory: [] }],
  incidents: [],
});

const savedPayment = () => ({
  id: 'PAY-1',
  amount: 3000,
  method: 'Cash',
  date: '2026-11-07',
  receiptNumber: 'RCPT-41-202611-01',
});

test('normalize: a full entry previews every receipt field', () => {
  const preview = normalizeReceiptPreview(goodInput());
  assert.deepEqual(preview, {
    customerName: 'Customer One',
    customerNumber: '41',
    amountCents: 300000,
    amountText: 'PKR 3,000',
    amountWords: 'Three thousand',
    method: 'Cash',
    receiptNumber: 'RCPT-41-202611-01',
    date: '2026-11-07',
  });
});

test('normalize: the amount parses commas, spaces, and paisa', () => {
  assert.equal(normalizeReceiptPreview({ ...goodInput(), amount: '3,000' }).amountCents, 300000);
  assert.equal(normalizeReceiptPreview({ ...goodInput(), amount: ' 3000 ' }).amountCents, 300000);
  assert.equal(normalizeReceiptPreview({ ...goodInput(), amount: 1500.5 }).amountCents, 150050);
  assert.equal(normalizeReceiptPreview({ ...goodInput(), amount: 1500.5 }).amountText, 'PKR 1,500.5');
});

test('normalize: a missing figure is not a number, never zero', () => {
  for (const amount of [null, undefined, '', true, 'abc']) {
    assert.equal(normalizeReceiptPreview({ ...goodInput(), amount }), null, `amount ${String(amount)}`);
  }
  assert.equal(normalizeReceiptPreview({ ...goodInput(), amount: 0 }), null);
  assert.equal(normalizeReceiptPreview({ ...goodInput(), amount: -3000 }), null);
});

test('normalize: no usable name, no receipt number, no preview', () => {
  assert.equal(normalizeReceiptPreview({ ...goodInput(), customerName: '' }), null);
  assert.equal(normalizeReceiptPreview({ ...goodInput(), customerName: '   ' }), null);
  assert.equal(normalizeReceiptPreview({ ...goodInput(), receiptNumber: '' }), null);
  assert.equal(normalizeReceiptPreview({ ...goodInput(), receiptNumber: '  ' }), null);
  assert.equal(normalizeReceiptPreview(null), null);
  assert.equal(normalizeReceiptPreview('nope'), null);
});

test('strict date: leap-aware, a day is never guessed', () => {
  assert.equal(receiptPreviewIsStrictDate('2024-02-29'), true);
  assert.equal(receiptPreviewIsStrictDate('2023-02-29'), false);
  assert.equal(receiptPreviewIsStrictDate('2026-11-31'), false);
  assert.equal(receiptPreviewIsStrictDate('2026-13-01'), false);
  assert.equal(receiptPreviewIsStrictDate('07-11-2026'), false);
  assert.equal(receiptPreviewIsStrictDate('2026-11-7'), false);
  assert.equal(receiptPreviewIsStrictDate(''), false);
  assert.equal(normalizeReceiptPreview({ ...goodInput(), date: '2023-02-29' }), null);
  assert.equal(normalizeReceiptPreview({ ...goodInput(), date: '2024-02-29' }).date, '2024-02-29');
});

test('normalize: a blank method reads as Cash, exactly as the save records it', () => {
  assert.equal(normalizeReceiptPreview({ ...goodInput(), method: '' }).method, 'Cash');
  assert.equal(normalizeReceiptPreview({ ...goodInput(), method: '  ' }).method, 'Cash');
  assert.equal(normalizeReceiptPreview({ ...goodInput(), method: 'JazzCash' }).method, 'JazzCash');
});

test('normalize: a split entry previews nothing — no single receipt to preview', () => {
  assert.equal(normalizeReceiptPreview({ ...goodInput(), split: true }), null);
  assert.ok(normalizeReceiptPreview({ ...goodInput(), split: false }));
});

test('normalize: the input is never mutated', () => {
  const input = goodInput();
  const before = JSON.stringify(input);
  normalizeReceiptPreview(input);
  assert.equal(JSON.stringify(input), before);
});

test('normalize: a digits-only customer number is kept exactly, anything else stays blank', () => {
  assert.equal(normalizeReceiptPreview({ ...goodInput(), customerNumber: '041' }).customerNumber, '041');
  assert.equal(normalizeReceiptPreview({ ...goodInput(), customerNumber: 0 }).customerNumber, '');
  assert.equal(normalizeReceiptPreview({ ...goodInput(), customerNumber: 'abc' }).customerNumber, '');
  assert.equal(normalizeReceiptPreview({ ...goodInput(), customerNumber: undefined }).customerNumber, '');
});

test('previewFor: built from a customer record, or from plain fields when there is none', () => {
  const fromRecord = receiptPreviewFor({
    customer: preSaveCustomer(),
    amount: 3000,
    amountWords: 'Three thousand',
    method: 'Cash',
    receiptNumber: 'RCPT-41-202611-01',
    date: '2026-11-07',
    split: false,
  });
  assert.equal(fromRecord.customerName, 'Customer One');
  assert.equal(fromRecord.customerNumber, '41');
  const fromFields = receiptPreviewFor({ ...goodInput(), customer: null });
  assert.equal(fromFields.customerName, 'Customer One');
  assert.equal(receiptPreviewFor(null), null);
  assert.equal(receiptPreviewFor({ customer: preSaveCustomer(), amount: 3000, split: true }), null);
});

test('format: money in the app min-0 style', () => {
  assert.equal(formatReceiptPreviewAmount(300000), 'PKR 3,000');
  assert.equal(formatReceiptPreviewAmount(150050), 'PKR 1,500.5');
  assert.equal(formatReceiptPreviewAmount(50), 'PKR 0.5');
  assert.equal(formatReceiptPreviewAmount(NaN), '');
  assert.equal(receiptPreviewFigureCents(null), null);
  assert.equal(receiptPreviewFigureCents(true), null);
  assert.equal(receiptPreviewFigureCents(''), null);
});

test('line text: the preview reads in the order the receipt prints it', () => {
  assert.equal(
    receiptPreviewLineText(normalizeReceiptPreview(goodInput())),
    'Receipt: RCPT-41-202611-01\nDate: 2026-11-07\nCustomer: Customer One (#41)\nAmount: PKR 3,000\nAmount in words: Three thousand\nMethod: Cash',
  );
  const noWords = normalizeReceiptPreview({ ...goodInput(), amountWords: '' });
  assert.ok(!receiptPreviewLineText(noWords).includes('Amount in words'));
  assert.equal(receiptPreviewLineText(null), '');
});

test('html: every field shows, user text is escaped, nothing when there is no preview', () => {
  const html = receiptPreviewHtml(normalizeReceiptPreview(goodInput()));
  assert.match(html, /Receipt preview/);
  assert.match(html, /RCPT-41-202611-01/);
  assert.match(html, /2026-11-07/);
  assert.match(html, /Customer One \(#41\)/);
  assert.match(html, /PKR 3,000/);
  assert.match(html, /Three thousand/);
  assert.match(html, /Cash/);
  assert.match(html, /nothing is saved yet/);
  assert.equal(receiptPreviewHtml(null), '');
  const tricky = receiptPreviewHtml(normalizeReceiptPreview({ ...goodInput(), customerName: '<script>alert(1)</script>' }));
  assert.ok(!tricky.includes('<script>'), 'no raw script tag');
  assert.match(tricky, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('acceptance: the previewed receipt matches the issued receipt on the same fixture', () => {
  const receiptNumber = nextReceiptNumberFor(preSaveCustomer(), '2026-11');
  assert.equal(receiptNumber, 'RCPT-41-202611-01');
  const preview = receiptPreviewFor({
    customer: preSaveCustomer(),
    amount: 3000,
    amountWords: amountInWords(3000),
    method: 'Cash',
    receiptNumber,
    date: '2026-11-07',
    split: false,
  });
  assert.equal(preview.amountWords, 'Three thousand');
  const postSave = preSaveCustomer();
  postSave.bills[0].payments = [savedPayment()];
  const receipt = buildPaymentReceipt(postSave, postSave.bills[0], savedPayment());
  assert.equal(receipt.receiptNumber, 'RCPT-41-202611-01');
  assert.equal(receipt.customerName, 'Customer One');
  assert.equal(receipt.customerId, '41');
  assert.equal(receipt.paidAmount, 3000);
  assert.equal(receipt.paymentMethod, 'Cash');
  assert.equal(receipt.paymentDate, '2026-11-07');
  assert.equal(receiptPreviewMatchesReceipt(preview, receipt), true);
});

test('match: any field differing breaks the match', () => {
  const postSave = preSaveCustomer();
  postSave.bills[0].payments = [savedPayment()];
  const receipt = buildPaymentReceipt(postSave, postSave.bills[0], savedPayment());
  const preview = normalizeReceiptPreview(goodInput());
  assert.equal(receiptPreviewMatchesReceipt(preview, receipt), true);
  assert.equal(receiptPreviewMatchesReceipt({ ...preview, amountCents: 250000 }, receipt), false);
  assert.equal(receiptPreviewMatchesReceipt({ ...preview, method: 'JazzCash' }, receipt), false);
  assert.equal(receiptPreviewMatchesReceipt({ ...preview, receiptNumber: 'RCPT-41-202611-02' }, receipt), false);
  assert.equal(receiptPreviewMatchesReceipt({ ...preview, date: '2026-11-08' }, receipt), false);
  assert.equal(receiptPreviewMatchesReceipt({ ...preview, customerName: 'Customer Two' }, receipt), false);
  assert.equal(receiptPreviewMatchesReceipt({ ...preview, customerNumber: '42' }, receipt), false);
  assert.equal(receiptPreviewMatchesReceipt(null, receipt), false);
  assert.equal(receiptPreviewMatchesReceipt(preview, null), false);
  assert.equal(receiptPreviewMatchesReceipt(preview, { ...receipt, paidAmount: null }), false);
});

test('purity: the module is pure and standalone, with no store and no live handles', () => {
  assert.ok(!moduleSrc.includes('localStorage'), 'no store');
  assert.ok(!moduleSrc.includes('shahdara_'), 'no store key');
  assert.ok(!moduleSrc.includes('new Date('), 'no Date');
  assert.ok(!moduleSrc.includes('Date.now('), 'no Date.now');
  assert.ok(!moduleSrc.includes('document.'), 'no document');
  assert.ok(!moduleSrc.includes('fetch('), 'no fetch');
  assert.ok(!moduleSrc.includes('window.'), 'no window');
  assert.ok(!moduleSrc.includes('import '), 'no imports');
  assert.ok(!moduleSrc.includes('addPayment'), 'never posts');
  assert.ok(!moduleSrc.includes('executeQuickCollection'), 'never posts');
});

test('fences: the module header never names a fenced module literally', () => {
  // Fragment-built, so this test's own assertion list never carries
  // the fenced names literally either.
  const fenced = [
    'cash-change-' + 'calculator',
    'remembered-' + 'method',
    'dues-amount-' + 'default',
    'quick-collect-' + 'one-screen',
    'name-prefix-' + 'lookup',
    'recent-quick-' + 'pick',
    'one-screen-quick-' + 'amounts',
    'save-confirmation-' + 'summary',
    'next-receipt-' + 'number',
    'transaction-payer-' + 'name',
    'full-history-' + 'list',
    'balance-' + 'rollforward',
    'quick-amount-' + 'buttons',
  ];
  for (const name of fenced) {
    assert.ok(!moduleSrc.includes(name), `module must not name ${name}`);
  }
});

test('styles: no new hex colour in the receipt preview rules', () => {
  assert.ok(stylesSrc.includes('.rpv-preview-box'));
  assert.ok(stylesSrc.includes('.rpv-preview-heading'));
  assert.ok(stylesSrc.includes('.rpv-preview-note'));
  const rules = stylesSrc.match(/\.rpv-[^{]+\{[^}]*\}/g) || [];
  assert.ok(rules.length >= 3, `expected receipt preview rules, found ${rules.length}`);
  const baseline = stylesSrc.replace(/\.rpv-[^{]+\{[^}]*\}/g, '');
  const baselineHexes = new Set((baseline.match(/#[0-9a-fA-F]{3,8}/g) || []).map((h) => h.toLowerCase()));
  for (const rule of rules) {
    const hexes = rule.match(/#[0-9a-fA-F]{3,8}/g) || [];
    for (const hex of hexes) {
      assert.ok(baselineHexes.has(hex.toLowerCase()), `new hex colour ${hex} in rule ${rule.slice(0, 60)}`);
    }
  }
});

test('wiring: the controller imports the receipt preview module and the next receipt number', () => {
  assert.match(wiringSrc, /receipt-preview\.js/);
  assert.match(wiringSrc, /receiptPreviewFor/);
  assert.match(wiringSrc, /receiptPreviewHtml/);
  // QC Modal Overhaul 2 (Part 2.3): the six explanation lines condensed
  // into ONE muted subtitle, so nextReceiptNumberLineText is no longer
  // imported — the subtitle (renderFormSubtitle) renders the next
  // receipt number directly from nextReceiptNumberFor, and the confirm
  // preview still uses it too. The module's own tests still pass.
  assert.match(wiringSrc, /import \{ nextReceiptNumberFor \} from '\.\/next-receipt-number\.js';/);
  assert.doesNotMatch(wiringSrc, /nextReceiptNumberLineText/);
});

test('wiring: the preview builder reads the same figures the save posts with', () => {
  assert.match(wiringSrc, /function buildReceiptPreview\(\)/);
  const start = wiringSrc.indexOf('function buildReceiptPreview()');
  const slice = wiringSrc.slice(start, start + 1200);
  assert.match(slice, /nextReceiptNumberFor\(customer, month\)/);
  assert.match(slice, /amountInWords\(amountVal\)/);
  assert.match(slice, /dateInput\?\.value \|\| getPakistanLocalDate\(\)/);
  assert.match(slice, /split: !!splitToggle\?\.checked/);
});

test('wiring: the confirm step renders the preview beside the summary and hides it when there is none', () => {
  assert.match(wiringSrc, /const receiptPreviewBox = /);
  assert.match(wiringSrc, /document\.getElementById\('rpvReceiptPreview'\)/);
  const start = wiringSrc.indexOf('const pendingSummary = buildSaveConfirmationSummary();');
  const slice = wiringSrc.slice(start, start + 1200);
  assert.match(slice, /receiptPreviewHtml\(buildReceiptPreview\(\)\)/);
  assert.match(slice, /receiptPreviewBox\.hidden = previewHtml === ''/);
});

test('wiring: the preview host sits on the confirm step after the summary, before the save button', () => {
  assert.ok(pageSrc.includes('id="rpvReceiptPreview"'));
  assert.ok(pageSrc.includes('class="rpv-preview-box"'));
  const summaryAt = pageSrc.indexOf('quickCollectConfirmSummary');
  const previewAt = pageSrc.indexOf('rpvReceiptPreview');
  const saveAt = pageSrc.indexOf('quickCollectConfirmSaveBtn');
  const backAt = pageSrc.indexOf('quickCollectConfirmBackBtn');
  assert.ok(summaryAt > 0 && previewAt > summaryAt, 'preview host follows the summary box');
  assert.ok(saveAt > previewAt, 'save button follows the preview host');
  assert.ok(backAt > previewAt, 'back button follows the preview host');
});
