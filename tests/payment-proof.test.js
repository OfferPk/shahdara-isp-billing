/**
 * payment-proof.test.js — Owner feature (2026-10-29): Payment proof
 * screenshot. Adjacent to queued SISP-63 (Payment Sender Proof
 * Metadata): the owner asked for the actual IMAGE — the wallet
 * screenshot a customer sends — saved on the payment and viewable from
 * the customer's profile payment history.
 *
 * Storage reality this feature is built around: the whole ledger lives
 * in localStorage under the PR #459 storage-safety layer (quota guard
 * warns at SAVE_SIZE_WARN_BYTES = 4 MB), so a raw 1-4 MB phone
 * screenshot can never be stored as picked. Pins:
 *  - the compression cap ladder (pure plan + injected-fake pipeline):
 *    longest side <= 1024 px, JPEG quality steps down, then dimension
 *    steps down, and the stored data URL is <= 200,000 chars — or the
 *    pick is refused with a 'proof-too-large' coded error;
 *  - validatePayment keeps a well-formed proof verbatim, drops a
 *    malformed one (wrong type / not an image data URL) without
 *    throwing, and a payment with no proof keeps the exact legacy
 *    record shape (no screenshot key);
 *  - attach at save time through BOTH named entry points (profile
 *    payment form path = addPayment, Quick Collect =
 *    executeQuickCollection) and the receipt carries it;
 *  - backup round-trip: createJsonBackup -> previewJsonBackupMerge
 *    keeps the proof byte-identical; a backup whose proof field is a
 *    number imports fine with the proof dropped by sanitize;
 *  - SISP-34 void interplay: a voided payment keeps its proof, and the
 *    proof never moves money totals;
 *  - correction preserves the proof (the correction form has no proof
 *    picker — the walletVerified carry-over rule);
 *  - quota-guard interplay: one worst-case proof adds at most the cap
 *    to the serialized ledger, and a ledger pushed across the guard
 *    threshold by proofs trips assessSaveSize (the existing guard's
 *    warn path — the save itself never corrupts state);
 *  - every new UI string exists in BOTH language dictionaries, and the
 *    static wiring (form field, viewer dialog, row buttons + bindings,
 *    Quick Collect compression, styles) is present.
 * Synthetic data only — proof strings are generated filler, never a
 * real customer screenshot.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, updateCustomerProfile, generateMonthlyBillsThroughCurrentMonth,
  addPayment, validatePayment, correctPayment, calculateMethodCollectionTotals,
  createJsonBackup, previewJsonBackupMerge, persistState, readState
} from '../core.js';
import {
  executeQuickCollection, compressPaymentProofImage, planPaymentProofSize,
  isPaymentProofDataUrl, PAYMENT_PROOF_MAX_DIMENSION, PAYMENT_PROOF_MAX_DATA_URL_LENGTH,
  PAYMENT_PROOF_DIMENSION_STEPS, PAYMENT_PROOF_QUALITY_STEPS
} from '../nav-quick-collect.js';
import { voidPayment } from '../payment-void-audit.js';
import { assessSaveSize, SAVE_SIZE_WARN_BYTES } from '../storage-safety.js';
import { TRANSLATIONS } from '../nav-language.js';

const OCT_29 = new Date(2026, 9, 29, 12);
const DATA_URL_PREFIX = 'data:image/jpeg;base64,';
/** A synthetic "proof": valid shape, filler body of the given length. */
const proofOfLength = (chars) => DATA_URL_PREFIX + 'A'.repeat(Math.max(0, chars - DATA_URL_PREFIX.length));
const PROOF = proofOfLength(1_500);
const MAX_PROOF = proofOfLength(PAYMENT_PROOF_MAX_DATA_URL_LENGTH);

function octoberState() {
  let state = createInitialState(['Proof Tester']);
  state = updateCustomerProfile(state, 'seed-001', { monthlySellingAmount: '3000' }, OCT_29);
  state = generateMonthlyBillsThroughCurrentMonth(state, OCT_29);
  return state;
}
const octoberBill = (state) => state.customers[0].bills.find(b => b.month === '2026-10');
const utf8Length = (text) => new TextEncoder().encode(text).byteLength;

// ------------------------------------------------------------- the cap ----
test('proof size plan caps the longest side at 1024 and never upscales', () => {
  assert.equal(PAYMENT_PROOF_MAX_DIMENSION, 1024);
  assert.deepEqual(planPaymentProofSize(4000, 3000), { width: 1024, height: 768 });
  assert.deepEqual(planPaymentProofSize(1080, 2400), { width: 461, height: 1024 });
  assert.deepEqual(planPaymentProofSize(800, 600), { width: 800, height: 600 });
  assert.deepEqual(planPaymentProofSize(3000, 4000, 512), { width: 384, height: 512 });
  assert.equal(planPaymentProofSize(0, 100), null);
  assert.equal(planPaymentProofSize('wide', 100), null);
});

test('isPaymentProofDataUrl accepts only image data URLs within the cap', () => {
  assert.equal(isPaymentProofDataUrl(PROOF), true);
  assert.equal(isPaymentProofDataUrl(MAX_PROOF), true);
  assert.equal(isPaymentProofDataUrl(proofOfLength(PAYMENT_PROOF_MAX_DATA_URL_LENGTH + 1)), false);
  assert.equal(isPaymentProofDataUrl('data:text/html;base64,AAAA'), false);
  assert.equal(isPaymentProofDataUrl('https://example.com/receipt.png'), false);
  assert.equal(isPaymentProofDataUrl(12345), false);
  assert.equal(isPaymentProofDataUrl(null), false);
});

test('compression ladder steps quality then dimension until the data URL fits the cap', async () => {
  const attempts = [];
  const deps = {
    decodeImage: async () => ({ width: 3000, height: 4000 }),
    drawCanvas: (image, width, height) => ({ width, height }),
    // Fake encoder: output length grows with area x quality, tuned so the
    // 1024 step never fits but the 832 step fits at the lowest quality.
    encodeJpeg: async (canvas, quality) => {
      attempts.push({ width: canvas.width, height: canvas.height, quality });
      return proofOfLength(Math.floor(canvas.width * canvas.height * quality) + DATA_URL_PREFIX.length);
    }
  };
  const result = await compressPaymentProofImage({ name: 'wallet.png' }, deps);
  assert.equal(isPaymentProofDataUrl(result), true);
  assert.ok(result.length <= PAYMENT_PROOF_MAX_DATA_URL_LENGTH);
  // First attempts are the full-size step (768x1024 for a 3000x4000 pick)…
  assert.deepEqual(attempts[0], { width: 768, height: 1024, quality: PAYMENT_PROOF_QUALITY_STEPS[0] });
  // …quality is exhausted at that size before the dimension steps down.
  const firstStepAttempts = attempts.filter(a => a.width === 768);
  assert.equal(firstStepAttempts.length, PAYMENT_PROOF_QUALITY_STEPS.length);
  assert.equal(attempts[attempts.length - 1].width, planPaymentProofSize(3000, 4000, PAYMENT_PROOF_DIMENSION_STEPS[1]).width);
});

test('compression resolves at the first fitting step for an ordinary screenshot', async () => {
  let calls = 0;
  const deps = {
    decodeImage: async () => ({ width: 1080, height: 2400 }),
    drawCanvas: (image, width, height) => ({ width, height }),
    encodeJpeg: async (canvas, quality) => { calls++; return proofOfLength(Math.floor(canvas.width * canvas.height * quality / 8) + DATA_URL_PREFIX.length); }
  };
  const result = await compressPaymentProofImage({ name: 'easypaisa.jpg' }, deps);
  assert.equal(calls, 1);
  assert.ok(result.length <= PAYMENT_PROOF_MAX_DATA_URL_LENGTH);
});

test('compression refuses with a proof-too-large coded error when nothing fits', async () => {
  const deps = {
    decodeImage: async () => ({ width: 3000, height: 4000 }),
    drawCanvas: (image, width, height) => ({ width, height }),
    encodeJpeg: async () => proofOfLength(PAYMENT_PROOF_MAX_DATA_URL_LENGTH + 50_000)
  };
  await assert.rejects(
    () => compressPaymentProofImage({ name: 'huge.tiff' }, deps),
    (error) => error.code === 'proof-too-large'
  );
});

// ------------------------------------------------------- record keeping ----
test('validatePayment keeps a well-formed proof verbatim and drops malformed ones', () => {
  const base = { date: '2026-10-29', amount: '3000', method: 'Easypaisa' };
  const kept = validatePayment({ ...base, screenshot: MAX_PROOF }, OCT_29);
  assert.equal(kept.screenshot, MAX_PROOF);
  for (const bad of [12345, { img: true }, 'https://example.com/x.png', 'data:text/html;base64,AAAA', '']) {
    const cleaned = validatePayment({ ...base, screenshot: bad }, OCT_29);
    assert.equal('screenshot' in cleaned, false, `malformed proof ${String(bad).slice(0, 24)} must be dropped`);
  }
  // No proof picked -> the record shape is byte-identical to legacy.
  const plain = validatePayment(base, OCT_29);
  assert.equal('screenshot' in plain, false);
  assert.deepEqual(Object.keys(plain).sort(), ['amount', 'date', 'method']);
});

test('attach at save: addPayment (profile form path) stores the proof on the payment', () => {
  const state = addPayment(octoberState(), 'seed-001', '2026-10', {
    date: '2026-10-29', amount: '3000', method: 'Easypaisa', screenshot: PROOF
  }, OCT_29);
  const payment = octoberBill(state).payments[0];
  assert.equal(payment.screenshot, PROOF);
  // …and it survives the storage round-trip untouched.
  const store = new Map();
  const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  persistState(state, storage);
  const reloaded = readState(storage);
  assert.equal(reloaded.customers[0].bills.find(b => b.month === '2026-10').payments[0].screenshot, PROOF);
});

test('attach at save: Quick Collect stores the proof and the receipt carries it', () => {
  const { nextState, receipt } = executeQuickCollection(octoberState(), {
    customerId: 'seed-001', month: '2026-10', amount: 3000, date: '2026-10-29', method: 'JazzCash', screenshot: PROOF
  }, OCT_29);
  assert.equal(receipt.screenshot, PROOF);
  const payment = octoberBill(nextState).payments.find(p => p.id === receipt.paymentId);
  assert.equal(payment.screenshot, PROOF);
  // A non-image value is ignored by the same path, never stored.
  const bogus = executeQuickCollection(octoberState(), {
    customerId: 'seed-001', month: '2026-10', amount: 100, date: '2026-10-29', method: 'Cash', screenshot: 'not-a-data-url'
  }, OCT_29);
  const bogusPayment = octoberBill(bogus.nextState).payments.find(p => p.id === bogus.receipt.paymentId);
  assert.equal('screenshot' in bogusPayment, false);
});

// --------------------------------------------------------- backup path ----
test('backup round-trip: export -> import keeps the proof byte-identical', () => {
  const state = addPayment(octoberState(), 'seed-001', '2026-10', {
    date: '2026-10-29', amount: '3000', method: 'Easypaisa', screenshot: MAX_PROOF
  }, OCT_29);
  const backupText = createJsonBackup(state, OCT_29);
  const preview = previewJsonBackupMerge(createInitialState([]), backupText);
  assert.equal(preview.canApply, true);
  const imported = preview.state.customers[0].bills.find(b => b.month === '2026-10').payments[0];
  assert.equal(imported.screenshot, MAX_PROOF);
});

test('backup sanitize: a malformed proof in a backup is dropped, the payment imports fine', () => {
  // Build a backup whose stored payment carries a numeric "proof" by
  // writing it straight into a raw state before export (validatePayment
  // on import is the sanitizer under test).
  const raw = octoberState();
  raw.customers[0].bills.find(b => b.month === '2026-10').payments.push({
    id: 'pay-proof-bad', date: '2026-10-29', amount: 3000, method: 'Easypaisa', screenshot: 12345
  });
  const preview = previewJsonBackupMerge(createInitialState([]), createJsonBackup(raw, OCT_29));
  assert.equal(preview.canApply, true);
  const imported = preview.state.customers[0].bills.find(b => b.month === '2026-10').payments.find(p => p.id === 'pay-proof-bad');
  assert.ok(imported, 'payment itself must import');
  assert.equal('screenshot' in imported, false);
});

test('backup sanitize ceiling: an oversized legacy proof is clipped to the 350k outer bound, never crashes', () => {
  const raw = octoberState();
  raw.customers[0].bills.find(b => b.month === '2026-10').payments.push({
    id: 'pay-proof-big', date: '2026-10-29', amount: 3000, method: 'Cash', screenshot: proofOfLength(400_000)
  });
  const preview = previewJsonBackupMerge(createInitialState([]), createJsonBackup(raw, OCT_29));
  assert.equal(preview.canApply, true);
  const imported = preview.state.customers[0].bills.find(b => b.month === '2026-10').payments.find(p => p.id === 'pay-proof-big');
  assert.equal(imported.screenshot.length, 350_000);
  assert.ok(imported.screenshot.startsWith('data:image/'));
});

// ------------------------------------------------- void + money totals ----
test('voided payment keeps its proof and the proof never moves money totals', () => {
  const withProof = addPayment(octoberState(), 'seed-001', '2026-10', {
    date: '2026-10-29', amount: '3000', method: 'Easypaisa', screenshot: PROOF
  }, OCT_29);
  const withoutProof = addPayment(octoberState(), 'seed-001', '2026-10', {
    date: '2026-10-29', amount: '3000', method: 'Easypaisa'
  }, OCT_29);
  assert.deepEqual(calculateMethodCollectionTotals(withProof, '2026-10'), calculateMethodCollectionTotals(withoutProof, '2026-10'));

  const payment = octoberBill(withProof).payments[0];
  const { state: voided } = voidPayment(withProof, 'seed-001', '2026-10', payment.id, { voidReason: 'Customer sent the wrong screenshot' });
  const voidedPayment = octoberBill(voided).payments.find(p => p.id === payment.id);
  assert.equal(voidedPayment.voided, true);
  assert.equal(voidedPayment.screenshot, PROOF);
});

test('correction preserves the proof (the correction form has no proof picker)', () => {
  const state = addPayment(octoberState(), 'seed-001', '2026-10', {
    date: '2026-10-29', amount: '3000', method: 'Easypaisa', screenshot: PROOF
  }, OCT_29);
  const payment = octoberBill(state).payments[0];
  const corrected = correctPayment(state, 'seed-001', '2026-10', payment.id, {
    date: '2026-10-29', amount: '2500', method: 'Easypaisa'
  }, OCT_29);
  const after = octoberBill(corrected).payments.find(p => p.id === payment.id);
  assert.equal(after.amount, 2500);
  assert.equal(after.screenshot, PROOF);
});

// ------------------------------------------------------- quota interplay ----
test('quota guard: proofs are bounded by the cap and a proof-filled ledger trips the guard', () => {
  const oneProof = addPayment(octoberState(), 'seed-001', '2026-10', {
    date: '2026-10-29', amount: '3000', method: 'Cash', screenshot: MAX_PROOF
  }, OCT_29);
  const noProof = addPayment(octoberState(), 'seed-001', '2026-10', {
    date: '2026-10-29', amount: '3000', method: 'Cash'
  }, OCT_29);
  const growth = utf8Length(JSON.stringify(oneProof)) - utf8Length(JSON.stringify(noProof));
  assert.ok(growth <= PAYMENT_PROOF_MAX_DATA_URL_LENGTH + 64, `one proof grew the ledger by ${growth}`);
  // A single proof stays far below the guard — no warning.
  assert.equal(assessSaveSize(utf8Length(JSON.stringify(oneProof))).warn, false);
  // Enough worst-case proofs DO cross the guard threshold, which is
  // exactly when the existing save path shows its storage warning and
  // (on a real quota failure) the emergency fallback — simulated here
  // through the same pure assessor save() uses.
  let big = createInitialState(Array.from({ length: 21 }, (_, i) => `Proof Bulk ${i + 1}`));
  big = generateMonthlyBillsThroughCurrentMonth(big, OCT_29);
  for (const customer of big.customers) {
    big = addPayment(big, customer.id, '2026-10', {
      date: '2026-10-29', amount: '3000', method: 'Cash', screenshot: MAX_PROOF
    }, OCT_29);
  }
  const bigBytes = utf8Length(JSON.stringify(big));
  assert.ok(bigBytes >= SAVE_SIZE_WARN_BYTES, `expected the proof-filled ledger (${bigBytes}) to reach the guard (${SAVE_SIZE_WARN_BYTES})`);
  const assessment = assessSaveSize(bigBytes);
  assert.equal(assessment.warn, true);
  assert.equal(assessment.reason, 'ledger-size');
});

// ------------------------------------------------------------ i18n + UI ----
test('every new proof string exists in both language dictionaries', () => {
  for (const key of ['proof_attach_label', 'proof_view', 'proof_dialog_title', 'proof_too_large']) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.ok(TRANSLATIONS.en[key].length > 0, `en empty ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(TRANSLATIONS.ur[key].length > 0, `ur empty ${key}`);
  }
});

test('static wiring: form field, viewer dialog, row buttons and compression are in place', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="paymentProofDialog"'), 'proof viewer dialog missing');
  assert.ok(html.includes('id="paymentProofImage"'), 'proof viewer image missing');
  assert.ok(html.includes('data-i18n="proof_dialog_title"'), 'proof dialog title not localized');

  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes('name="proofScreenshot"'), 'profile payment form has no proof file field');
  assert.ok(app.includes('compressPaymentProofImage(proofFile)'), 'profile submit does not compress the proof');
  assert.ok(app.includes('function paymentProofButtonMarkup'), 'proof thumbnail button builder missing');
  assert.ok(app.includes('function openPaymentProofDialog'), 'proof viewer controller missing');
  assert.ok(app.includes("historyContainer.querySelectorAll('[data-view-proof]')"), 'history proof binding missing');
  assert.ok(app.includes("transactionList.querySelectorAll('[data-view-proof]')"), 'transactions proof binding missing');

  const qc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.ok(qc.includes('compressPaymentProofImage(file)'), 'Quick Collect pick is not compressed');
  assert.ok(!qc.includes('Screenshot image must be under 1 MB.'), 'the old raw-size rejection must be gone');

  const css = readFileSync(new URL('../profile-ui.css', import.meta.url), 'utf8');
  assert.ok(css.includes('.payment-proof-thumb'), 'proof thumbnail styles missing');
  assert.ok(css.includes('.payment-proof-full'), 'proof full-view styles missing');
});
