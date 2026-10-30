// SISP-83: Tamper-Evident Receipt Verification Code (VER: XXXX-XX) &
// Lookup. Pure-function tests on synthetic data only.
// Spec pins:
//  - a receipt for Rs 3,000 produces a deterministic 6-char code;
//  - altering the amount to Rs 5,000 fails verification;
//  - a voided payment's code verifies as VOID.
// Plus: the code is computed at render (nothing stored on the payment),
// every receipt layout (A4 / thermal-80 / thermal-58 HTML, PNG,
// down-payment) carries the stamp, the lookup resolves by code OR by
// receipt number against the ledger (stored-ref and derived-ref
// payments alike), stamp == lookup for the same payment, and the
// dialog's i18n keys exist in English and Urdu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  VERIFICATION_ALPHABET,
  formatVerificationCode,
  lookupReceiptVerification,
  normalizeVerificationCode,
  receiptCodeForPayment,
  receiptCodeForReceipt,
  receiptRefForPayment,
  receiptVerificationCode,
  setupReceiptVerifyModal,
  verificationStampText,
  verifyReceiptCode
} from '../receipt-verifier.js';
import {
  buildDownPaymentKistReceipt,
  buildDownPaymentKistReceiptHtml,
  buildPaymentReceipt,
  generatePaymentReceiptHtml,
  generateReceiptNumber
} from '../receipt.js';
import { buildPngReceiptModel, computePngReceiptLayout } from '../png-receipt.js';
import { createInstallmentPlan } from '../installment-plan.js';
import { TRANSLATIONS } from '../nav-language.js';

const CODE_RE = /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{2}$/;
const PIN_INPUTS = { receiptId: 'REC-2601-0042-1001', customerId: '42', amountPaid: 3000, date: '2026-01-05' };

// ------------------------------------------------------------- the code

test('pin: a Rs 3,000 receipt produces a deterministic 6-char code, identical on every call', () => {
  const code = receiptVerificationCode(PIN_INPUTS);
  assert.match(code, CODE_RE);
  assert.equal(code.replace('-', '').length, 6);
  assert.equal(receiptVerificationCode(PIN_INPUTS), code);
  // Same facts in other shapes (string amount, float) → same code.
  assert.equal(receiptVerificationCode({ ...PIN_INPUTS, amountPaid: '3000' }), code);
  assert.equal(receiptVerificationCode({ ...PIN_INPUTS, amountPaid: 3000.0 }), code);
  // The alphabet never emits ambiguous characters.
  for (const ch of code.replace('-', '')) {
    assert.ok(VERIFICATION_ALPHABET.includes(ch), `char ${ch} must be in the unambiguous alphabet`);
    assert.ok(!'ILOU'.includes(ch));
  }
  assert.equal(verificationStampText(code), `VER: ${code}`);
});

test('pin: altering the amount to Rs 5,000 fails verification (as do date, customer and receipt changes)', () => {
  const code = receiptVerificationCode(PIN_INPUTS);
  assert.equal(verifyReceiptCode(code, PIN_INPUTS), true);
  assert.equal(verifyReceiptCode(code, { ...PIN_INPUTS, amountPaid: 5000 }), false);
  assert.equal(verifyReceiptCode(code, { ...PIN_INPUTS, date: '2026-01-06' }), false);
  assert.equal(verifyReceiptCode(code, { ...PIN_INPUTS, customerId: '43' }), false);
  assert.equal(verifyReceiptCode(code, { ...PIN_INPUTS, receiptId: 'REC-2601-0043-1001' }), false);
  // A code minted for Rs 5,000 does not verify the Rs 3,000 receipt either.
  const tamperedCode = receiptVerificationCode({ ...PIN_INPUTS, amountPaid: 5000 });
  assert.notEqual(tamperedCode, code);
  assert.equal(verifyReceiptCode(tamperedCode, PIN_INPUTS), false);
});

test('typed codes normalize: case, separators and Crockford confusables are forgiven', () => {
  const code = receiptVerificationCode(PIN_INPUTS);
  const raw = code.replace('-', '');
  assert.equal(formatVerificationCode(raw.toLowerCase()), code);
  assert.equal(formatVerificationCode(` ${raw.slice(0, 3)} ${raw.slice(3)} `), code);
  assert.equal(verifyReceiptCode(raw.toLowerCase(), PIN_INPUTS), true);
  assert.equal(normalizeVerificationCode(''), '');
  assert.equal(normalizeVerificationCode('AB3'), '');
  assert.equal(normalizeVerificationCode('AB3F-9KXX'), '');
  assert.equal(verificationStampText(''), '');
  assert.equal(verifyReceiptCode('', PIN_INPUTS), false);
});

// ------------------------------------------------------- receipt stamps

function paymentFixture() {
  const savedPayment = { id: 'pay-3000', amount: 3000, date: '2026-08-05', method: 'Cash' };
  const bill = { id: 'bill-2026-08', month: '2026-08', dueAmount: 3000, status: 'pending', payments: [savedPayment] };
  const customer = { id: 'synthetic-customer', customerNumber: 42, name: 'Synthetic Customer', packageSpeed: '15 Mbps', bills: [bill] };
  return { customer, bill, savedPayment };
}

test('buildPaymentReceipt stamps verificationCode, computed at render — the ledger is never mutated', () => {
  const { customer, bill, savedPayment } = paymentFixture();
  const before = JSON.stringify({ customer, bill, savedPayment });
  const receipt = buildPaymentReceipt(customer, bill, savedPayment);
  assert.match(receipt.verificationCode, CODE_RE);
  assert.equal(receipt.verificationCode, receiptVerificationCode({
    receiptId: receipt.receiptNumber, customerId: '42', amountPaid: 3000, date: '2026-08-05'
  }));
  assert.equal(receiptCodeForReceipt(receipt), receipt.verificationCode);
  assert.equal(JSON.stringify({ customer, bill, savedPayment }), before, 'no code is stored on the payment');
  assert.ok(!('verificationCode' in savedPayment));
});

test('every HTML layout (A4, thermal-80, thermal-58) prints the VER stamp', () => {
  const { customer, bill, savedPayment } = paymentFixture();
  const receipt = buildPaymentReceipt(customer, bill, savedPayment);
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const html = generatePaymentReceiptHtml(receipt, { format });
    assert.ok(html.includes(`VER: ${receipt.verificationCode}`), `${format} must carry the VER stamp`);
  }
  // A receipt object missing the field still gets stamped (re-derived).
  const bare = { ...receipt };
  delete bare.verificationCode;
  assert.ok(generatePaymentReceiptHtml(bare, { format: 'a4' }).includes(`VER: ${receipt.verificationCode}`));
});

test('the PNG receipt model + layout carry the VER stamp inside the canvas', () => {
  const { customer, bill, savedPayment } = paymentFixture();
  const receipt = buildPaymentReceipt(customer, bill, savedPayment);
  const model = buildPngReceiptModel(receipt, customer);
  assert.equal(model.verificationCode, receipt.verificationCode);
  const layout = computePngReceiptLayout(model);
  const stamp = layout.commands.find((cmd) => cmd.type === 'text' && cmd.text.includes(`VER: ${receipt.verificationCode}`));
  assert.ok(stamp, 'layout must draw the VER line');
  assert.ok(layout.footerY <= layout.height, 'footer stays inside the canvas');
  for (const cmd of layout.commands) {
    if (cmd.type === 'text') {
      assert.ok(cmd.x >= 0 && cmd.x <= layout.width && cmd.y >= 0 && cmd.y <= layout.height, 'text within bounds');
    }
  }
});

test('the down-payment kist receipt is stamped too', () => {
  const plan = createInstallmentPlan({ itemTitle: 'ONU', totalAmount: 5000, downPayment: 2000, totalMonths: 3 });
  const customer = { id: 'synthetic-customer', customerNumber: 42, name: 'Synthetic Customer', bills: [] };
  const payment = { id: 'down-1', amount: 2000, date: '2026-08-05', method: 'Cash' };
  const receipt = buildDownPaymentKistReceipt(customer, plan, payment);
  assert.match(receipt.verificationCode, CODE_RE);
  assert.ok(buildDownPaymentKistReceiptHtml(receipt).includes(`VER: ${receipt.verificationCode}`));
});

// -------------------------------------------------------------- lookup

function ledgerFixture() {
  const storedRefPayment = {
    id: 'pay-stored', amount: 3000, date: '2026-08-05', method: 'Cash',
    receiptNumber: 'REC-2608-0042-AB12'
  };
  const derivedRefPayment = { id: 'pay-derived', amount: 1500, date: '2026-08-09', method: 'JazzCash' };
  const bill = { id: 'bill-2026-08', month: '2026-08', dueAmount: 4500, status: 'pending', payments: [storedRefPayment, derivedRefPayment] };
  const customer = { id: 'cust-42', customerNumber: 42, name: 'Synthetic Customer', packageSpeed: '15 Mbps', bills: [bill] };
  const other = { id: 'cust-7', customerNumber: 7, name: 'Other Synthetic', bills: [] };
  return { customers: [customer, other], customer, bill, storedRefPayment, derivedRefPayment };
}
const derive = { deriveReceiptNumber: generateReceiptNumber };

test('lookup by VER code resolves the saved payment with the LEDGER facts', () => {
  const { customers, bill, storedRefPayment } = ledgerFixture();
  const code = receiptCodeForPayment(customers[0], bill, storedRefPayment, derive);
  assert.match(code, CODE_RE);
  const result = lookupReceiptVerification(customers, code.toLowerCase(), derive);
  assert.equal(result.status, 'verified');
  assert.equal(result.matchedBy, 'code');
  assert.equal(result.amountPaid, 3000);
  assert.equal(result.paymentDate, '2026-08-05');
  assert.equal(result.customerName, 'Synthetic Customer');
  assert.equal(result.customerNumber, '42');
  assert.equal(result.receiptRef, 'REC-2608-0042-AB12');
  assert.equal(result.voided, false);
});

test('lookup by full receipt number resolves too (case-insensitive)', () => {
  const { customers } = ledgerFixture();
  const result = lookupReceiptVerification(customers, 'rec-2608-0042-ab12', derive);
  assert.equal(result.status, 'verified');
  assert.equal(result.matchedBy, 'receipt');
  assert.equal(result.amountPaid, 3000);
});

test('stamp == lookup: a payment without a stored receipt number verifies via the derived ref', () => {
  const { customers, customer, bill, derivedRefPayment } = ledgerFixture();
  // The ref buildPaymentReceipt would print for this payment:
  const printed = buildPaymentReceipt(customer, bill, derivedRefPayment);
  assert.equal(receiptRefForPayment(customer, bill, derivedRefPayment, generateReceiptNumber), printed.receiptNumber);
  const result = lookupReceiptVerification(customers, printed.verificationCode, derive);
  assert.equal(result.status, 'verified');
  assert.equal(result.paymentId, 'pay-derived');
  assert.equal(result.amountPaid, 1500);
  // And the code computed straight from the payment equals the stamp.
  assert.equal(receiptCodeForPayment(customer, bill, derivedRefPayment, derive), printed.verificationCode);
});

test('pin: a VOIDED payment\u2019s code verifies as VOID, never as genuine', () => {
  const { customers, customer, bill, storedRefPayment } = ledgerFixture();
  const code = receiptCodeForPayment(customer, bill, storedRefPayment, derive);
  storedRefPayment.voided = true;
  storedRefPayment.voidedAt = '2026-08-10T09:00:00.000Z';
  storedRefPayment.voidReason = 'Duplicate entry';
  const result = lookupReceiptVerification(customers, code, derive);
  assert.equal(result.status, 'void');
  assert.equal(result.voided, true);
  assert.equal(result.voidReason, 'Duplicate entry');
  assert.equal(result.amountPaid, 3000, 'the ledger facts still show for the voided payment');
});

test('tampered and unknown codes find nothing; empty input is invalid; lookup is read-only', () => {
  const { customers, customer, bill, storedRefPayment } = ledgerFixture();
  const before = JSON.stringify(customers);
  const tampered = receiptVerificationCode({
    receiptId: 'REC-2608-0042-AB12', customerId: '42', amountPaid: 5000, date: '2026-08-05'
  });
  assert.equal(lookupReceiptVerification(customers, tampered, derive).status, 'not_found');
  assert.equal(lookupReceiptVerification(customers, 'ZZZZ-ZZ', derive).status, 'not_found');
  assert.equal(lookupReceiptVerification(customers, 'REC-9999-9999-XXXX', derive).status, 'not_found');
  assert.equal(lookupReceiptVerification(customers, '', derive).status, 'invalid');
  assert.equal(lookupReceiptVerification(customers, '   ', derive).status, 'invalid');
  assert.equal(lookupReceiptVerification([], 'AB3F-9K', derive).status, 'not_found');
  assert.equal(JSON.stringify(customers), before, 'lookup never mutates the ledger');
  void customer; void bill;
});

// ------------------------------------------------------ i18n + wiring

test('every rverify_ key used by the dialog and the dashboard card exists in English and Urdu', () => {
  const moduleSource = fs.readFileSync(new URL('../receipt-verifier.js', import.meta.url), 'utf8');
  const indexSource = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const keys = new Set();
  for (const m of moduleSource.matchAll(/\bt\('(rverify_[a-z_]+)'\)/g)) keys.add(m[1]);
  for (const m of indexSource.matchAll(/data-i18n(?:-placeholder)?="(rverify_[a-z_]+)"/g)) keys.add(m[1]);
  assert.ok(keys.size >= 15, `expected the full rverify_ surface, got ${keys.size}`);
  for (const key of keys) {
    assert.ok(typeof TRANSLATIONS.en[key] === 'string' && TRANSLATIONS.en[key].length > 0, `en missing ${key}`);
    assert.ok(typeof TRANSLATIONS.ur[key] === 'string' && TRANSLATIONS.ur[key].length > 0, `ur missing ${key}`);
  }
});

test('wiring: app.js sets up the modal, index.html carries the dialog + dashboard button, CSS uses tokens only', () => {
  const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const indexSource = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const cssSource = fs.readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  assert.ok(appSource.includes("import { setupReceiptVerifyModal } from './receipt-verifier.js';"));
  assert.ok(appSource.includes('setupReceiptVerifyModal(() => state'));
  assert.ok(appSource.includes("$('#openReceiptVerifyModalBtn')"));
  assert.ok(indexSource.includes('id="receiptVerifyModal"'));
  assert.ok(indexSource.includes('id="receiptVerifyForm"'));
  assert.ok(indexSource.includes('id="receiptVerifyInput"'));
  assert.ok(indexSource.includes('id="receiptVerifyResult"'));
  assert.ok(indexSource.includes('id="openReceiptVerifyModalBtn"'));
  // The dialog surface comes from the shared billing-modal rule.
  assert.ok(indexSource.includes('class="billing-modal receipt-verify-modal"'));
  const block = cssSource.slice(cssSource.indexOf('SISP-83: receipt verification dialog'), cssSource.indexOf('.receipt-verify-facts dd'));
  assert.ok(block.includes('var(--color-paid)') && block.includes('var(--color-overdue)'));
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'no hardcoded colours in the SISP-83 CSS block');
  const opens = (cssSource.match(/\{/g) || []).length;
  const closes = (cssSource.match(/\}/g) || []).length;
  assert.equal(opens, closes, 'components.css braces stay balanced');
});

test('setupReceiptVerifyModal is a safe no-op without a document (headless)', () => {
  assert.equal(setupReceiptVerifyModal(() => ({ customers: [] }), {}), null);
});
