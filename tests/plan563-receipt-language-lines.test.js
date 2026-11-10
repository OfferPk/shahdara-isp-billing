/**
 * plan563-receipt-language-lines.test.js — Plan 563: Tax, boost, package
 * and advance lines respect the receipt language.
 *
 * Both WhatsApp drafts hardcode lines that SISP-91's language
 * preference should localise. The Quick Collect draft hardcodes the
 * sales-tax, boost and package-updated lines bilingual in every
 * language; the profile draft hardcodes the tax, package-updated and
 * advance-credit lines (the advance line English-only) regardless of
 * lang. So an Urdu-only customer gets an Urdu draft with English-first
 * money lines.
 *
 * Pins (synthetic data only; the +92 300 123 4567 number is the
 * pattern-fake every draft test uses, never a real number):
 *  - BEHAVIOUR (fail on the pristine base, pass after the fix): in
 *    Urdu-only mode the four lines render in Urdu script; in Roman
 *    mode in Roman Urdu; in English mode in English.
 *  - PIN (pass before and after): the Quick Collect bilingual default
 *    is byte-identical to today — its tax/boost/package lines keep
 *    their exact bilingual literals; the figures never change with
 *    the language; an untaxed receipt shows no tax line in any
 *    language.
 *  - The English profile advance line is already English-only today,
 *    so its exact shape is pinned as the guard for the new English
 *    dictionary entry.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatQuickCollectWhatsAppReceipt } from '../nav-quick-collect.js';
import { createReceiptWhatsAppDraft } from '../profile-ui.js';

// Quick Collect fixture: one receipt carrying all three QC lines — a
// taxed bill, a settled boost, and a package follow that fired.
const QC_RECEIPT_563 = {
  receiptNumber: 'RCPT-563', date: '2026-11-07', customerName: 'Synthetic Customer', customerNumber: 42,
  phone: '03001234567', area: 'Test Area', month: 'November 2026', amount: 1195, method: 'Cash',
  newTotalDues: 0, salesTaxCents: 19500,
  addonCharges: [{ boostId: 'BST-101', amount: 500 }],
  packageAutoSet: { fee: 3000, packageLabel: '3Mbps / 100GB' }
};

const qcText = (lang) => formatQuickCollectWhatsAppReceipt(
  lang === undefined ? QC_RECEIPT_563 : { ...QC_RECEIPT_563 },
  lang === undefined ? {} : { lang }
).text;

// Profile-draft fixture: same three lines on the profile side (tax,
// package follow, advance credit). No lang passed means the English
// layout, exactly like the polish #11 / advance-payment fixtures.
function profileDraft(lang) {
  const receipt = {
    customerName: 'Synthetic Customer', customerNumber: 42,
    amount: 1195, date: '2026-11-07', method: 'Cash', month: '2026-11',
    billAmount: 1000, balanceDueCents: 0, billStatus: 'paid',
    salesTaxCents: 19500,
    autoPackage: { fee: 3000, packageLabel: '3Mbps / 100GB' },
    advanceCredit: { applied: 3000, remaining: 3000 }
  };
  return createReceiptWhatsAppDraft('+92 300 123 4567', receipt, lang === undefined ? {} : { lang: lang }).message;
}

/* ---------------- Quick Collect: tax line ---------------- */

test('plan563: QC tax line renders in Urdu script in Urdu-only mode', () => {
  const text = qcText('urdu');
  assert.ok(text.includes('🧾 *سیلز ٹیکس (19.5%):* PKR 195'), text);
  assert.ok(!text.includes('Sales tax'), text);
});

test('plan563: QC tax line renders in English in English mode', () => {
  const text = qcText('english');
  assert.ok(text.includes('🧾 *Sales tax (19.5%):* PKR 195'), text);
  assert.ok(!text.includes('سیلز ٹیکس'), text);
});

test('plan563: QC tax line renders in Roman Urdu in Roman mode', () => {
  const text = qcText('roman');
  assert.ok(text.includes('🧾 *Sales tax (19.5%):* PKR 195'), text);
  assert.ok(!text.includes('سیلز ٹیکس'), text);
});

/* ---------------- Quick Collect: boost line ---------------- */

test('plan563: QC boost line renders in Urdu script in Urdu-only mode', () => {
  const text = qcText('urdu');
  assert.ok(text.includes('⚡ *سپیڈ بوسٹ (BST-101):* PKR 500'), text);
  assert.ok(!text.includes('Speed Boost'), text);
});

test('plan563: QC boost line renders in English in English mode', () => {
  const text = qcText('english');
  assert.ok(text.includes('⚡ *Speed Boost (BST-101):* PKR 500'), text);
  assert.ok(!text.includes('سپیڈ بوسٹ'), text);
});

test('plan563: QC boost line renders in Roman Urdu in Roman mode', () => {
  const text = qcText('roman');
  assert.ok(text.includes('⚡ *Speed Boost (BST-101):* PKR 500'), text);
  assert.ok(!text.includes('سپیڈ بوسٹ'), text);
});

/* ---------------- Quick Collect: package-updated line ---------------- */

test('plan563: QC package-updated line renders in Urdu script in Urdu-only mode', () => {
  const text = qcText('urdu');
  assert.ok(text.includes('📦 *پیکیج اپڈیٹ:* 3Mbps / 100GB — PKR 3,000'), text);
  assert.ok(!text.includes('Package updated'), text);
});

test('plan563: QC package-updated line renders in English in English mode', () => {
  const text = qcText('english');
  assert.ok(text.includes('📦 *Package updated:* 3Mbps / 100GB — PKR 3,000'), text);
  assert.ok(!text.includes('پیکیج اپڈیٹ'), text);
});

/* ---------------- Profile draft: tax line ---------------- */

test('plan563: profile tax line renders in Urdu script in Urdu-only mode', () => {
  const text = profileDraft('urdu');
  assert.ok(text.includes('🧾 سیلز ٹیکس (19.5%): PKR 195'), text);
  assert.ok(!text.includes('Sales tax'), text);
});

test('plan563: profile tax line renders in English in English mode', () => {
  const text = profileDraft('english');
  assert.ok(text.includes('🧾 Sales tax (19.5%): PKR 195'), text);
  assert.ok(!text.includes('سیلز ٹیکس'), text);
});

test('plan563: profile tax line renders in Roman Urdu in Roman mode', () => {
  const text = profileDraft('roman');
  assert.ok(text.includes('🧾 Sales tax (19.5%): PKR 195'), text);
  assert.ok(!text.includes('سیلز ٹیکس'), text);
});

/* ---------------- Profile draft: package-updated line ---------------- */

test('plan563: profile package-updated line renders in Urdu script in Urdu-only mode', () => {
  const text = profileDraft('urdu');
  assert.ok(text.includes('📦 پیکیج اپڈیٹ: 3Mbps / 100GB — PKR 3,000'), text);
  assert.ok(!text.includes('Package updated'), text);
});

test('plan563: profile package-updated line renders in English in English mode', () => {
  const text = profileDraft('english');
  assert.ok(text.includes('📦 Package updated: 3Mbps / 100GB — PKR 3,000'), text);
  assert.ok(!text.includes('پیکیج اپڈیٹ'), text);
});

/* ---------------- Profile draft: advance-credit line ---------------- */

test('plan563: profile advance-credit line renders in Urdu script in Urdu-only mode', () => {
  const text = profileDraft('urdu');
  assert.ok(text.includes('💎 پیشگی کریڈٹ: PKR 3,000 • باقی پیشگی بیلنس: PKR 3,000'), text);
  assert.ok(!text.includes('Advance Credit Applied'), text);
});

test('plan563: profile advance-credit line renders in Roman Urdu in Roman mode', () => {
  const text = profileDraft('roman');
  assert.ok(text.includes('💎 Advance Credit Istemal Hua: PKR 3,000 • Baqi Advance Balance: PKR 3,000'), text);
  assert.ok(!text.includes('پیشگی'), text);
});

/* ---------------- Pins: bilingual default byte-identical, figures fixed ---------------- */

test('plan563 PIN: the QC bilingual default keeps its exact bilingual tax/boost/package lines', () => {
  const text = qcText(undefined);
  assert.ok(text.includes('🧾 *Sales tax / سیلز ٹیکس (19.5%):* PKR 195'), text);
  assert.ok(text.includes('⚡ *Speed Boost / سپیڈ بوسٹ (BST-101):* PKR 500'), text);
  assert.ok(text.includes('📦 *Package updated / پیکیج اپڈیٹ:* 3Mbps / 100GB — PKR 3,000'), text);
});

test('plan563 PIN: the figures never change with the language', () => {
  for (const lang of ['urdu', 'roman', 'english', undefined]) {
    const text = qcText(lang);
    assert.ok(text.includes('PKR 195'), `tax figure in ${lang ?? 'bilingual'}`);
    assert.ok(text.includes('PKR 500'), `boost figure in ${lang ?? 'bilingual'}`);
    assert.ok(text.includes('PKR 3,000'), `package figure in ${lang ?? 'bilingual'}`);
    const draft = profileDraft(lang);
    assert.ok(draft.includes('PKR 195'), `profile tax figure in ${lang ?? 'english'}`);
    assert.ok(draft.includes('PKR 3,000'), `profile figures in ${lang ?? 'english'}`);
  }
});

test('plan563 PIN: the English profile advance line keeps its exact shape', () => {
  const text = profileDraft('english');
  assert.ok(text.includes('💎 Advance Credit Applied: PKR 3,000 • Remaining Advance Balance: PKR 3,000'), text);
});

test('plan563 PIN: an untaxed receipt shows no tax line in any language', () => {
  const untaxed = { ...QC_RECEIPT_563 };
  delete untaxed.salesTaxCents;
  for (const lang of ['urdu', 'roman', 'english', undefined]) {
    const text = formatQuickCollectWhatsAppReceipt(untaxed, lang === undefined ? {} : { lang }).text;
    assert.ok(!text.includes('Sales tax'), `QC no tax in ${lang ?? 'bilingual'}`);
    assert.ok(!text.includes('سیلز ٹیکس'), `QC no tax in ${lang ?? 'bilingual'}`);
  }
  const profileReceipt = {
    customerName: 'Synthetic Customer', customerNumber: 42,
    amount: 1000, date: '2026-11-07', method: 'Cash', month: '2026-11',
    billAmount: 1000, balanceDueCents: 0, billStatus: 'paid'
  };
  for (const lang of ['urdu', 'roman', 'english']) {
    const text = createReceiptWhatsAppDraft('+92 300 123 4567', profileReceipt, { lang }).message;
    assert.ok(!text.includes('Sales tax'), `profile no tax in ${lang}`);
    assert.ok(!text.includes('سیلز ٹیکس'), `profile no tax in ${lang}`);
  }
});
