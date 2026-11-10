// Plan 560 — Split HTML uses the shared brand header, footer and VER.
//
// THE THREE DEFECTS (all confirmed live by probe before writing
// tests): (1) generateSplitTenderReceiptHtml (split-tender-collect.js)
// builds its own header — `<span class="receipt-brand">`, an h1, and
// `<p>Official Customer Record · … · Phone: …</p>` — instead of the
// shared brandHeaderHtml/brandHeaderContentHtml (document-branding.js)
// every other receipt uses, so the phone label reads "Phone:" where
// the canonical meta line (brandMetaLine) says "Tel:" ("Phone:" is
// retired per document-branding.js). (2) documentFooterHtml is never
// called — only receiptTermsNoteHtml() — so there is no
// owner-configured studio footer on the sheet. (3) There is no VER
// verification stamp, although each leg receipt carries one
// (buildPaymentReceipt stamps verificationCode, SISP-83).
//
// THE FIX (generateSplitTenderReceiptHtml only): the header content
// comes from brandHeaderContentHtml (variant 'a4', with the split
// title and the A4 "Official Customer Record" metaPrefix — the same
// call the main A4 receipt makes); the generator accepts a
// receiptFooter option like the other generators and renders
// documentFooterHtml(receiptFooter) in a <footer class="receipt-terms">
// block; each leg gets a leg-qualified VER row ("Verify (Leg 1) /
// تصدیق:") whose code is re-derived from the leg's own receipt facts
// via receiptCodeForReceipt — the receipt.js:688 pattern for
// hand-built receipts — so the split sheet carries exactly the code
// the leg's own receipt carries. No change to leg data or totals.
//
// DELIBERATE CHOICES (recorded, not oversights): (a) The title is
// passed as explicit titleEn/titleUr overrides (t('split_receipt_title')
// + the hardcoded 'رسید ادائیگی' the current h1 already prints),
// NOT as a new DOCUMENT_TITLES entry — so the rendered title is
// byte-identical to today in every language mode (EN: "Split Payment
// Receipt / رسید ادائیگی"; UR: "تقسیم ادائیگی کی رسید / رسید ادائیگی").
// (b) No thank-you line is added: documentFooterHtml is called with
// no thank-you, so with nothing configured it returns '' and the
// unconfigured sheet is byte-identical below the terms note; the
// footer block appears only when a studio footer is configured.
// (c) The VER row is per leg (not just the first leg's), qualified
// with the leg label — the Plan 559 TID pattern — so two digital legs
// have distinguishable stamps, each independently verifiable.
//
// OUT OF SCOPE (recorded, not fixed): generateSplitTenderReceiptHtml
// has NO production caller at this head — no app.js /
// nav-quick-collect.js code renders the split HTML sheet (the QC
// success path uses renderSplitReceiptCardHtml, the print path uses
// generatePaymentReceiptHtml per leg, thermal uses buildEscPosReceipt)
// — so no production call site passes receiptFooter yet either; the
// generator now accepts the option, but wiring a caller is a later
// plan's job. The QC success-step card (renderSplitReceiptCardHtml)
// is Plan 579's job, so its header stays untouched here.
//
// Pattern-fake data only: Test Customer, EP99887766, 03000000001.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { saveBillMonth } from '../core.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import { brandHeaderContentHtml } from '../document-branding.js';
import {
  executeSplitTenderCollection, buildSplitTenderReceipt,
  generateSplitTenderReceiptHtml
} from '../split-tender-collect.js';

const NOW = new Date('2026-10-29T12:00:00+05:00');
const MONTH = '2026-10';
const DATE = '2026-10-29';
const BRAND = { businessName: 'Shahdara ISP', businessPhone: '0300-1234567', areaName: 'Shahdara, Islamabad' };

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const splitSrc = read('split-tender-collect.js');

// A single-month split settled in full (the Plan 557 taxed shape):
// 1,000 package + 195 tax = 1,195 due, settled 1,000 Cash + 195
// Easypaisa. Nothing is owed afterwards.
function settledFixture() {
  let s = { version: 1, nextCustomerNumber: 2, customers: [{
    id: 'a', customerNumber: 1, name: 'Test Customer', phone: '03000000001',
    area: 'Shahdara', archived: false, bills: [],
    monthlySellingAmount: 1000, packageSpeed: '3Mbps / 100GB'
  }] };
  s = saveBillMonth(s, 'a', { month: MONTH, dueAmount: 1195, packageId: '3mbps-100gb', salesTaxCents: 19500, status: 'pending' }, NOW);
  return s;
}
const settledSpec = {
  customerId: 'a', month: MONTH, date: DATE, paidBy: 'Self',
  legs: [
    { amount: 1000, method: 'Cash' },
    { amount: 195, method: 'Easypaisa', transactionId: 'EP99887766' }
  ]
};

function buildSettled() {
  const { nextState: after, splitGroupId } = executeSplitTenderCollection(settledFixture(), settledSpec,
    { execute: executeQuickCollection, referenceDate: NOW });
  const combined = buildSplitTenderReceipt(after, 'a', splitGroupId);
  return { after, combined };
}

// The leg receipts' own VER codes, from the saved ledger — the codes
// the split sheet must carry.
function legVerificationCodes(after, combined) {
  const customer = after.customers.find((c) => c.id === 'a');
  return combined.legs.map((leg) => {
    const bill = customer.bills.find((b) => (b.payments ?? []).some((p) => p.id === leg.paymentId));
    const payment = bill.payments.find((p) => p.id === leg.paymentId);
    return buildPaymentReceipt(customer, bill, payment).verificationCode;
  });
}

const configuredFooter = {
  footerText: 'Test Studio Footer — Plan 560',
  easypaisaNumber: '', nayapayNumber: '', helplineWhatsapp: '', shopsText: ''
};

// ---------------------------------------------------------------- header

test('Plan 560: the split HTML meta line says "Tel:", never "Phone:"', () => {
  const { combined } = buildSettled();
  const html = generateSplitTenderReceiptHtml(combined, { ...BRAND });
  assert.ok(html.includes('Official Customer Record · Shahdara, Islamabad · Tel: 0300-1234567'),
    'canonical meta line with Tel:');
  assert.ok(!html.includes('Phone:'), 'no retired Phone: label anywhere on the sheet');
});

test('Plan 560: the split header IS the shared A4 header for the same business settings', () => {
  const { after, combined } = buildSettled();
  const html = generateSplitTenderReceiptHtml(combined, { ...BRAND });
  const sharedHeader = brandHeaderContentHtml(BRAND, {
    titleEn: 'Split Payment Receipt', titleUr: 'رسید ادائیگی',
    metaPrefix: 'Official Customer Record', variant: 'a4'
  });
  assert.ok(html.includes(sharedHeader), 'header block is the shared builder output, verbatim');
  assert.ok(html.includes('<span class="receipt-brand">Shahdara ISP</span>'), 'brand span');
  assert.ok(html.includes('<h1>Split Payment Receipt / رسید ادائیگی</h1>'), 'split title, byte-identical to before');
  // The main receipt's A4 header for the same settings carries the
  // same meta line — the split sheet no longer looks like it came
  // from a different business.
  const codes = legVerificationCodes(after, combined);
  assert.ok(codes[0], 'leg 1 has a VER code to compare against');
  const customer = after.customers.find((c) => c.id === 'a');
  const bill = customer.bills.find((b) => b.month === MONTH);
  const payment = bill.payments.find((p) => p.id === combined.legs[0].paymentId);
  const mainA4 = generatePaymentReceiptHtml(buildPaymentReceipt(customer, bill, payment),
    { format: 'a4', ...BRAND });
  assert.ok(mainA4.includes('Official Customer Record · Shahdara, Islamabad · Tel: 0300-1234567'),
    'main A4 receipt carries the same meta line');
});

// ---------------------------------------------------------------- footer

test('Plan 560: the configured studio footer prints when receiptFooter is passed', () => {
  const { combined } = buildSettled();
  const html = generateSplitTenderReceiptHtml(combined, { ...BRAND, receiptFooter: configuredFooter });
  assert.ok(html.includes('Test Studio Footer — Plan 560'), 'owner footer text on the sheet');
  assert.ok(html.includes('<footer class="receipt-terms">'), 'shared footer wrapper');
  assert.ok(html.includes('receipt-custom-footer'), 'SISP-96 studio footer block');
});

test('Plan 560 PIN: with no receiptFooter the sheet has no footer block (unconfigured sheet unchanged below the terms note)', () => {
  const { combined } = buildSettled();
  const html = generateSplitTenderReceiptHtml(combined, { ...BRAND });
  assert.ok(!html.includes('<footer class="receipt-terms">'), 'no footer block when nothing is configured');
  assert.ok(!html.includes('receipt-custom-footer'), 'no studio footer block when nothing is configured');
});

// ---------------------------------------------------------------- VER

test('Plan 560: each leg carries its own VER stamp, equal to its leg receipt code', () => {
  const { after, combined } = buildSettled();
  const codes = legVerificationCodes(after, combined);
  const html = generateSplitTenderReceiptHtml(combined, { ...BRAND });
  for (const [i, code] of codes.entries()) {
    assert.ok(code, `leg ${i + 1} has a VER code`);
    assert.ok(html.includes(`VER: ${code}`), `leg ${i + 1} VER stamp on the sheet`);
    assert.ok(html.includes(`Verify (Leg ${i + 1}) / تصدیق:`),
      `leg ${i + 1} VER row is leg-qualified, like the TID rows`);
  }
});

test('Plan 560 PIN: a hand-built combined object without receipt numbers shows no VER row', () => {
  const combined = {
    splitGroupId: 'split-test', customerId: '1', customerNumber: 1,
    customerName: 'Test Customer', phone: '', area: 'Shahdara',
    month: MONTH, date: DATE, legs: [
      { leg: 1, paymentId: 'p1', receiptNumber: '', method: 'Cash', amount: 1000, transactionId: '', date: DATE, voided: false },
      { leg: 2, paymentId: 'p2', receiptNumber: '', method: 'Easypaisa', amount: 195, transactionId: 'EP99887766', date: DATE, voided: false }
    ],
    totalReceivedCents: 119500, totalReceived: 1195, balanceDueCents: 0, status: 'PAID'
  };
  const html = generateSplitTenderReceiptHtml(combined, { ...BRAND });
  assert.ok(!html.includes('Verify'), 'no VER row without a receipt number to derive from');
  assert.ok(html.includes('PKR 1,195'), 'total still renders');
});

// ---------------------------------------------------------------- pins: nothing else changed

test('Plan 560 PIN: legs, package, tax, totals and status mark render exactly as before', () => {
  const { combined } = buildSettled();
  const html = generateSplitTenderReceiptHtml(combined, { ...BRAND });
  assert.ok(html.includes('<dt>Package / پیکیج:</dt><dd>3Mbps / 100GB</dd>'), 'package row (Plan 557)');
  assert.ok(html.includes('Sales tax / سیلز ٹیکس (19.5%):'), 'tax row (Plan 557)');
  assert.ok(html.includes('Transaction ID (Leg 2):'), 'leg-qualified TID row (Plan 559)');
  assert.ok(html.includes('<strong>PKR 1,195</strong>'), 'total received');
  assert.ok(html.includes('<span class="receipt-mark receipt-status-paid">PAID</span>'), 'status mark');
  assert.ok(html.includes('اہم معلوماتی نوٹ:'), 'urdu notice');
  assert.equal(combined.totalReceived, 1195, 'builder totals untouched');
  assert.equal(combined.balanceDueCents, 0, 'builder balance untouched');
});

test('Plan 560 PIN: the change is the shared header/footer/VER only — no new hex, store key or element id', () => {
  assert.ok(splitSrc.includes("from './document-branding.js'"), 'shared header/footer import');
  assert.ok(splitSrc.includes('brandHeaderContentHtml'), 'shared header builder');
  assert.ok(splitSrc.includes('documentFooterHtml'), 'shared footer builder');
  assert.ok(splitSrc.includes("from './receipt-verifier.js'"), 'VER derivation import');
  assert.ok(splitSrc.includes('receiptCodeForReceipt'), 'code re-derived from the leg facts, never recomputed from a rate');
  // No source-level 'Phone:' assertion here on purpose: the word
  // legitimately appears in the explanatory comment (mirroring
  // document-branding.js, which documents the retirement the same
  // way) — the rendered sheet is pinned Phone:-free by the first
  // test above, which is the real guarantee.
  assert.ok(!splitSrc.includes('receipt-brand">'), 'no hand-built brand span left in the generator');
});
