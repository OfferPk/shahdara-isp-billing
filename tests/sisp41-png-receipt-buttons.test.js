// SISP-41: PNG Receipt (png-receipt.js) Button Integration in Customer
// Profile & Field Mode Cards.
// Spec test criterion (verbatim): Clicking [🖼️ PNG Receipt] from either
// Customer Profile or Field Mode generates the stamped PNG receipt for
// that customer.
// The generator itself is SISP-6 (generateReceiptPNG + shareOrDownloadPng,
// tested in tests/png-receipt.test.js) — this phase only wires the buttons
// to that EXISTING path, so these tests pin the wiring: the profile helper
// markup, the field-mode receipt-card actions (never a dead button), and
// the app.js host bindings. Pure helpers + source assertions on synthetic
// data only. The DOM half (button visible on the field receipt card and on
// a profile history row at 360px) is asserted by
// tests/e2e/sisp41-png-receipt-buttons.spec.mjs in CI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pngReceiptButtonMarkup } from '../profile-ui.js';
import { fieldModeReceiptActionMarkup } from '../field-mode.js';
import { t } from '../nav-language.js';

const root = new URL('..', import.meta.url);
const read = (name) => readFileSync(new URL(name, root), 'utf8');
const app = read('app.js');
const fieldMode = read('field-mode.js');
const profileUi = read('profile-ui.js');

// Pinned: the profile PNG button carries the saved payment's identity in
// data attributes, the shared receipt-button classes, and the i18n label.
test('SISP-41 profile PNG button markup carries customer/month/payment identity', () => {
  const markup = pngReceiptButtonMarkup('cust-7', '2026-10', 'pay-9', 12);
  assert.match(markup, /class="print-receipt-button png-receipt-button"/);
  assert.match(markup, /data-png-receipt/);
  assert.match(markup, /data-customer-id="cust-7"/);
  assert.match(markup, /data-month="2026-10"/);
  assert.match(markup, /data-payment-id="pay-9"/);
  assert.ok(markup.includes(t('prof_hist_png_receipt')));
  assert.ok(markup.includes(t('prof_hist_png_receipt_aria', null, { number: 12 })));
});

test('SISP-41 profile PNG button escapes hostile ids (same set as app.js)', () => {
  const markup = pngReceiptButtonMarkup('a"&<>b', '2026-10', "p'1", 3);
  assert.match(markup, /data-customer-id="a&quot;&amp;&lt;&gt;b"/);
  assert.match(markup, /data-payment-id="p&#39;1"/);
  assert.doesNotMatch(markup, /data-customer-id="a"&/);
});

// Pinned: neither field-mode receipt button can ever be dead — each renders
// only when its host callback exists, in card order (58mm, then PNG).
test('SISP-41 field receipt actions render both buttons only when wired', () => {
  const both = fieldModeReceiptActionMarkup({ hasPrint58: true, hasPngReceipt: true });
  assert.ok(both.includes('data-field-action="print58"'));
  assert.ok(both.includes('data-field-action="pngReceipt"'));
  assert.ok(both.includes('🖼️ PNG Receipt'));
  assert.ok(both.indexOf('print58') < both.indexOf('pngReceipt'));

  const pngOnly = fieldModeReceiptActionMarkup({ hasPrint58: false, hasPngReceipt: true });
  assert.ok(pngOnly.includes('data-field-action="pngReceipt"'));
  assert.doesNotMatch(pngOnly, /print58/);

  const slipOnly = fieldModeReceiptActionMarkup({ hasPrint58: true, hasPngReceipt: false });
  assert.ok(slipOnly.includes('data-field-action="print58"'));
  assert.doesNotMatch(slipOnly, /pngReceipt/);

  assert.equal(fieldModeReceiptActionMarkup({}), '');
  assert.equal(fieldModeReceiptActionMarkup(), '');
});

test('SISP-41 app.js wires the profile history rows through the profile helper', () => {
  assert.ok(app.includes("pngReceiptButtonMarkup } from './profile-ui.js"));
  assert.ok(app.includes('pngReceiptButtonMarkup(customer.id, month, payment.id, customer.customerNumber)'));
  assert.ok(app.includes("querySelectorAll('[data-png-receipt]')"));
});

test('SISP-41 app.js wires the field-mode receipt card to the SISP-6 PNG path', () => {
  assert.ok(app.includes('onPngReceipt: (receipt) => downloadPngReceipt(receipt.customerId, receipt.month, receipt.paymentId)'));
});

// Pinned: no saved payment -> no receipt at all. The profile renders the
// button only on real saved-payment rows, field mode only on the receipt
// card of a real collection, and the shared host path refuses cleanly
// (toast + return) when the payment no longer exists — never a fake PNG.
test('SISP-41 no-payment path stays clean: host refuses without generating', () => {
  assert.ok(app.includes("if (!customer || !bill || !payment) { toast('This saved payment receipt is no longer available.'); return; }"));
  assert.equal(fieldModeReceiptActionMarkup({ hasPrint58: true, hasPngReceipt: false }).includes('pngReceipt'), false);
});

test('SISP-41 field-mode handles the pngReceipt action through the host callback', () => {
  assert.ok(fieldMode.includes("action === 'pngReceipt'"));
  assert.ok(fieldMode.includes('onPngReceipt(lastReceipt.receipt)'));
  assert.ok(profileUi.includes('export function pngReceiptButtonMarkup'));
  assert.ok(fieldMode.includes('export function fieldModeReceiptActionMarkup'));
});
