import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RECEIPT_TERMS_PHRASE,
  RECEIPT_SUPPORT_LINE,
  receiptTermsNoteText,
  receiptTermsNoteHtml
} from '../receipt-terms.js';
import { renderQuickCollectReceiptCardHtml, formatQuickCollectWhatsAppReceipt } from '../nav-quick-collect.js';
import {
  formatSplitTenderWhatsAppText,
  renderSplitReceiptCardHtml,
  generateSplitTenderReceiptHtml
} from '../split-tender-collect.js';
import { createReceiptWhatsAppDraft } from '../profile-ui.js';
import { buildPaymentReceipt, generatePaymentReceiptHtml, RECEIPT_URDU_NOTE } from '../receipt.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

// The exact terms phrase, pinned word for word (user's wording,
// 2026-11-06). It carries no digits, so it is safe to pin in full.
const TERMS_PHRASE =
  'شرائط و ضوابط کے تحت پانچ تاریخ تک اگر انٹرنیٹ کی فیس ادا نہ ہو تو عارضی نیٹ بند ہو گا، فیس ادا کرنے پہ نیٹ دوبارہ بحال ہو گا';
// The support line is pinned by its label + a phone-number PATTERN
// only: the real support number lives solely in receipt-terms.js
// (a disclosed exemption in the privacy ratchet) and must never be
// re-typed in a test file.
const SUPPORT_LABEL = 'ٹیکنیکل سپورٹ کے لیے سعد سے رابطہ کریں:';
const PHONE_PATTERN = /\+92 3\d{2} \d{7}/;

test('the terms phrase is pinned exactly as the user wrote it', () => {
  assert.equal(RECEIPT_TERMS_PHRASE, TERMS_PHRASE);
  assert.equal(receiptTermsNoteText().startsWith(TERMS_PHRASE), true);
});

test('the support line carries the support label and a Pakistani mobile number', () => {
  assert.equal(RECEIPT_SUPPORT_LINE.startsWith(SUPPORT_LABEL), true);
  assert.match(RECEIPT_SUPPORT_LINE, PHONE_PATTERN);
  assert.match(RECEIPT_SUPPORT_LINE, /\+92 3\d{2} \d{7}$/);
});

test('the plain-text block is the phrase, then the support line, in that order', () => {
  const text = receiptTermsNoteText();
  assert.equal(text, `${TERMS_PHRASE}\n${RECEIPT_SUPPORT_LINE}`);
  assert.ok(text.indexOf(TERMS_PHRASE) < text.indexOf(SUPPORT_LABEL));
  assert.equal(text.split('\n').length, 2);
});

test('the HTML block is an escaped RTL Urdu note in the existing receipt-note styling', () => {
  const html = receiptTermsNoteHtml();
  assert.ok(html.startsWith('<div class="receipt-urdu-notice" dir="rtl" lang="ur">'));
  assert.ok(html.includes(TERMS_PHRASE));
  assert.ok(html.includes(SUPPORT_LABEL));
  assert.match(html, PHONE_PATTERN);
  assert.equal(html.includes('<script'), false);
});

test('purity fence: the terms module imports nothing and reads no storage, clock or network', () => {
  const source = read('receipt-terms.js');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
  assert.equal(source.includes('OLT'), false);
});

test('neighbour fence: the terms module never names a caller module', () => {
  const source = read('receipt-terms.js');
  for (const name of ['nav-quick-collect', 'profile-ui', 'split-tender', 'pending-receipt', 'nav-quick-profile']) {
    assert.equal(source.includes(name), false, `module must not reference ${name}`);
  }
});

test('wiring: every receipt renderer imports the terms module and calls its helper', () => {
  const receiptJs = read('receipt.js');
  assert.ok(receiptJs.includes("from './receipt-terms.js'"));
  assert.equal((receiptJs.match(/receiptTermsNoteHtml\(\)/g) || []).length, 3, 'one call per printable layout (thermal-58, thermal-80, A4)');

  const split = read('split-tender-collect.js');
  assert.ok(split.includes("from './receipt-terms.js'"));
  // Polish 21: the split QC card site passes { contactActions: true },
  // so the bare-call form no longer appears there — the wiring intent
  // (every renderer calls the helper) is what this pins.
  assert.ok(split.includes('receiptTermsNoteHtml('));
  assert.ok(split.includes('receiptTermsNoteText()'));

  const qc = read('nav-quick-collect.js');
  assert.ok(qc.includes("from './receipt-terms.js'"));
  // Polish 21: the ordinary QC card site passes { contactActions: true }
  // too (see above).
  assert.ok(qc.includes('receiptTermsNoteHtml('));
  assert.ok(qc.includes('receiptTermsNoteText()'));

  const profileUi = read('profile-ui.js');
  assert.ok(profileUi.includes("from './receipt-terms.js'"));
  assert.ok(profileUi.includes('receiptTermsNoteText()'));

  const quickProfile = read('nav-quick-profile.js');
  assert.ok(quickProfile.includes("from './receipt-terms.js'"));
  assert.ok(quickProfile.includes('receiptTermsNoteText()'));
});

// --- shared fixtures (generic names only, no real customers) --------------

const QC_RECEIPT = {
  receiptNumber: 'RCPT-99-202611-01',
  customerName: 'Test Customer',
  customerNumber: 99,
  amount: 2000,
  date: '2026-11-05',
  method: 'Easypaisa',
  month: '2026-11',
  area: 'Unassigned',
  newTotalDues: 0,
  paidBy: 'Self'
};

const SPLIT_COMBINED = {
  splitGroupId: 'grp-test-1',
  customerId: '99',
  customerNumber: 99,
  customerName: 'Test Customer',
  customerNameUrdu: '',
  phone: '03001234567',
  area: 'Unassigned',
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
};

test('Quick Collect success card shows the terms phrase and the support line (so a screenshot carries them)', () => {
  const html = renderQuickCollectReceiptCardHtml({ ...QC_RECEIPT });
  assert.ok(html.includes(TERMS_PHRASE));
  assert.ok(html.includes(SUPPORT_LABEL));
  // Polish 21 (amended Req 4): the QC card shows the number in its
  // simple local form (derived from the module, never re-typed) with
  // tappable WhatsApp + call links — the international form with + and
  // spaces no longer appears as the displayed number.
  const local = `0${RECEIPT_SUPPORT_LINE.replace(/\D/g, '').slice(2)}`;
  assert.ok(html.includes(local), 'QC card must show the local form');
  assert.ok(!html.includes(RECEIPT_SUPPORT_LINE.match(/[+\d][\d ]*$/)[0]), 'QC card must not show the spaced international form');
  assert.ok(html.includes('wa.me/') && html.includes('tel:+'), 'QC card must carry both contact links');
  assert.ok(html.indexOf(TERMS_PHRASE) > html.indexOf('Remaining Balance'), 'the terms sit at the foot of the card');
  assert.ok(html.includes('qc-receipt-card'));
});

test('Quick Collect WhatsApp draft carries the terms phrase and the support line before the closing divider', () => {
  const { text } = formatQuickCollectWhatsAppReceipt({ ...QC_RECEIPT });
  assert.ok(text.includes(TERMS_PHRASE));
  assert.ok(text.includes(SUPPORT_LABEL));
  assert.match(text, PHONE_PATTERN);
  assert.ok(text.indexOf(TERMS_PHRASE) > text.indexOf('Shukriya! Thank you for your prompt payment.'));
  assert.ok(text.indexOf(TERMS_PHRASE) < text.lastIndexOf('━━━━━━━━━━━━━━━━━━━━━━━━'));
});

test('split-tender WhatsApp text carries the terms phrase and the support line', () => {
  const text = formatSplitTenderWhatsAppText(SPLIT_COMBINED);
  assert.ok(text.includes(TERMS_PHRASE));
  assert.ok(text.includes(SUPPORT_LABEL));
  assert.match(text, PHONE_PATTERN);
  assert.ok(text.indexOf(TERMS_PHRASE) > text.indexOf('Shukriya! Thank you for your prompt payment.'));
  assert.ok(text.indexOf(TERMS_PHRASE) < text.lastIndexOf('━━━━━━━━━━━━━━━━━━━━━━━━'));
});

test('split-tender card and printable sheet both show the terms phrase and the support line', () => {
  const card = renderSplitReceiptCardHtml(SPLIT_COMBINED);
  assert.ok(card.includes(TERMS_PHRASE));
  assert.ok(card.includes(SUPPORT_LABEL));
  // Polish 21 (amended Req 4): the split QC card shows the local form
  // with the contact links (derived from the module, never re-typed);
  // the printable sheet keeps the international form.
  const local = `0${RECEIPT_SUPPORT_LINE.replace(/\D/g, '').slice(2)}`;
  assert.ok(card.includes(local), 'split QC card must show the local form');
  assert.ok(card.includes('wa.me/') && card.includes('tel:+'), 'split QC card must carry both contact links');

  const sheet = generateSplitTenderReceiptHtml(SPLIT_COMBINED);
  assert.ok(sheet.includes(TERMS_PHRASE));
  assert.ok(sheet.includes(SUPPORT_LABEL));
  assert.match(sheet, PHONE_PATTERN);
});

test('profile WhatsApp draft carries the terms phrase and the support line after the 5th-date reminder', () => {
  const draft = createReceiptWhatsAppDraft('+92 300 123 4567', {
    customerName: 'Test Customer', customerNumber: 3, amount: 2000, date: '2026-10-05', method: 'Cash', month: '2026-10',
    billStatus: 'paid', billAmount: 2000, balanceDueCents: 0, billDueDate: '2026-10-05'
  });
  assert.ok(draft);
  assert.ok(draft.message.includes(TERMS_PHRASE));
  assert.ok(draft.message.includes(SUPPORT_LABEL));
  assert.match(draft.message, PHONE_PATTERN);
  assert.ok(draft.message.indexOf(TERMS_PHRASE) > draft.message.indexOf('Please pay by the 5th'));
});

test('clipboard fallback (no phone saved) carries the terms phrase and the support line', async () => {
  const { executeReceiptWhatsAppShare } = await import('../nav-quick-profile.js');
  const mockStorage = {
    store: {},
    getItem(k) { return this.store[k] ?? null; },
    setItem(k, v) { this.store[k] = String(v); },
    removeItem(k) { delete this.store[k]; }
  };
  let copied = '';
  const mockClipboard = { async writeText(text) { copied = text; } };
  const result = await executeReceiptWhatsAppShare(
    { id: 'synthetic-customer-1', name: 'Test Customer', customerNumber: 99, phone: '' },
    { id: 'pay-fallback-1', customerId: 'synthetic-customer-1', amount: 2000, date: '2026-11-05', method: 'Cash', month: '2026-11' },
    { storage: mockStorage, windowObj: {}, clipboardObj: mockClipboard }
  );
  assert.equal(result.method, 'clipboard');
  assert.ok(result.message.includes(TERMS_PHRASE));
  assert.ok(result.message.includes(SUPPORT_LABEL));
  assert.match(result.message, PHONE_PATTERN);
  assert.equal(copied, result.message, 'the same text reaches the clipboard');
});

test('printed receipt (A4, thermal-80, thermal-58) shows the terms phrase and the support line', () => {
  const bill = { id: 'bill-2026-08', month: '2026-08', dueAmount: 2000, status: 'pending', payments: [] };
  const payment = { id: 'pay-print-1', amount: 2000, date: '2026-08-07', method: 'Cash' };
  bill.payments = [payment];
  const customer = { id: 'synthetic-customer', customerNumber: 42, name: 'Synthetic Customer', packageSpeed: '5 Mbps', packageHistory: [], bills: [bill] };
  const receipt = buildPaymentReceipt(customer, bill, payment);
  assert.equal(receipt.urduNote, RECEIPT_URDU_NOTE, 'the stored note is untouched — the terms render beside it');

  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const html = generatePaymentReceiptHtml(receipt, { format, businessName: 'Shahdara Fiber Net' });
    assert.ok(html.includes(TERMS_PHRASE), `${format} carries the terms phrase`);
    assert.ok(html.includes(SUPPORT_LABEL), `${format} carries the support line`);
    assert.match(html, PHONE_PATTERN, `${format} carries the support number`);
    assert.ok(html.indexOf(TERMS_PHRASE) > html.indexOf(RECEIPT_URDU_NOTE), `${format} shows the terms after the existing note`);
  }
});

test('building a draft never changes any bill, payment, or customer record', () => {
  const receipt = {
    customerName: 'Test Customer', customerNumber: 3, amount: 2000, date: '2026-10-05', method: 'Cash', month: '2026-10',
    billStatus: 'paid', billAmount: 2000, balanceDueCents: 0, billDueDate: '2026-10-05'
  };
  const before = JSON.stringify(receipt);
  const draft = createReceiptWhatsAppDraft('+92 300 123 4567', receipt);
  assert.ok(draft);
  assert.equal(JSON.stringify(receipt), before, 'the draft is display text only');
  const qcBefore = JSON.stringify(QC_RECEIPT);
  formatQuickCollectWhatsAppReceipt({ ...QC_RECEIPT });
  assert.equal(JSON.stringify(QC_RECEIPT), qcBefore);
});
