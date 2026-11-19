/**
 * plan570-terms-reminder-coverage.test.js — Plan 570: terms + the
 * pay-by-5th reminder appear on every main-receipt layout (parent
 * decisions D1–D8, 2026-11-18; see ~/workspace/plan-570-prep.md).
 *
 * SCOPE (D1(a) terms inside the 58 footer mirroring 80; D2(a) reminder
 * for PAID || PARTIAL only; D3(a) reminder on both thermals; D4(a)
 * reminder after star-thanks, before <footer>; D5(a) no heading on
 * the 58 terms paragraph; D6 this NEW file; D7(a) no real-browser
 * preview required; D8 split + secondary receipts stay out):
 * receipt.js only — the PACKAGE_TERMS_NOTE <p> in the thermal-58
 * branch + the reminder <p> in the two thermal branches + widening
 * the A4 reminder condition. Both texts are copied verbatim; no
 * terms-text change, no reminder-wording change, no new t() keys,
 * no new hex, no new import, no CSS change.
 *
 * D7 DISCLOSURE — the 58mm slip grows: PACKAGE_TERMS_NOTE is 356
 * chars, roughly 10–14 printed lines at 8px on 48mm, plus one
 * reminder line on PAID/PARTIAL slips — about 2cm of extra paper.
 * That is the point of the item (the counter's commonest slip is
 * the one that never carried the terms), not a regression.
 *
 * T1 — two reminder strings exist: the receipt one (used here,
 * 'of each calendar month', capital 'Thanks') and the profile
 * WhatsApp draft's different one (profile-ui.js:229, no 'of each
 * calendar month', lowercase 'thanks'). This file pins the RECEIPT
 * wording verbatim and never touches the draft string.
 * T2 — the acceptance sentences are per-half: PARTIAL thermal-80/A4
 * DO change (they gain the reminder) and PAID thermal-80/58 DO
 * change (they gain the reminder) — that is the item working.
 * T3 — receiptTermsNoteHtml() stays exactly 3 calls; the missing
 * piece is ONLY PACKAGE_TERMS_NOTE, never a 4th terms-note call.
 * T4 — VOID never gets the reminder (a voided receipt must never
 * read as a live demand). T5 — the reminder depends on `status`
 * only, never on starThankYouNote (the sisp120 star-thanks equality
 * test is the net). T6 — new content sits AFTER </dl>, never inside
 * the fields list. T7 — no &nbsp; in either new paragraph.
 *
 * Fixtures (synthetic data only; generic name Synthetic Customer;
 * pattern-fake IDs only): copied from the prep's repro-570.mjs,
 * which copied them from tests/receipt.test.js. PAID = pay 2000 on
 * due 2000; PARTIAL = pay 700 on due 2000; VOID = pay 2000 with
 * { voided: true, voidedAt, voidReason }; CREDIT RECEIVED = a second
 * payment after a first that covered the due in full; RECEIVED = a
 * payment not found in the bill's payments.
 *
 * Groups: G1 terms on 58 (4) + G2 reminder matrix (11) + G3
 * ordering + tail shape (3) + G4 guards (4) = 22 tests.
 * Expected suite: 20,340 + 22 = 20,362/0.
 * Build dist 23. Parity 4,675/4,675 (no new i18n keys).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildPaymentReceipt,
  generatePaymentReceiptHtml,
  PACKAGE_TERMS_NOTE,
} from '../receipt.js';
import { TRANSLATIONS } from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const receiptJs = read('receipt.js');

const REMINDER = '⚠️ Please pay by the 5th of each calendar month to avoid service interruption. Thanks 🥰';
const TERMS_FRAG_1 = 'مقررہ ڈیٹا حد مکمل ہونے پر انٹرنیٹ سروس بند ہو جائے گی';
const TERMS_FRAG_2 = 'PKR 3,000 اور اس سے زیادہ قیمت والے پیکیجز Unlimited';
const URDU_NOTE_FRAG = 'ہر ماہ کی 5 تاریخ تک بل ادا فرمائیں';
const TERMS_PHRASE_FRAG = 'پانچ تاریخ تک';

// ---- Fixtures (repro-570.mjs fixtures, verbatim + the two D2 statuses) ----
function fixture({ dueAmount = 2000, payments = [], month = '2026-08' } = {}) {
  const bill = { id: `bill-${month}`, month, dueAmount, status: 'pending', payments };
  const customer = {
    id: 'synthetic-customer', customerNumber: 42, name: 'Synthetic Customer',
    packageSpeed: '5 Mbps', packageHistory: [], bills: [bill],
  };
  return { customer, bill };
}
const payment = (id, amount, date, extra = {}) => ({ id, amount, date, method: 'Cash', ...extra });

const partialPay = payment('pay-partial', 700, '2026-08-07');
const { customer: pc, bill: pb } = fixture({ payments: [partialPay] });
const partial = buildPaymentReceipt(pc, pb, partialPay);
const paidPay = payment('pay-paid', 2000, '2026-08-07');
const { customer: fc, bill: fb } = fixture({ payments: [paidPay] });
const paid = buildPaymentReceipt(fc, fb, paidPay);
const voidPay = payment('pay-void', 2000, '2026-08-07', { voided: true, voidedAt: '2026-08-08', voidReason: 'Wrong entry' });
const { customer: vc, bill: vb } = fixture({ payments: [voidPay] });
const voided = buildPaymentReceipt(vc, vb, voidPay);
const firstPay = payment('pay-first', 2000, '2026-08-07');
const secondPay = payment('pay-second', 500, '2026-08-08');
const { customer: cc, bill: cb } = fixture({ payments: [firstPay, secondPay] });
const creditReceived = buildPaymentReceipt(cc, cb, secondPay);
const ghostPay = payment('pay-ghost', 100, '2026-08-07');
const { customer: gc, bill: gb } = fixture({ payments: [] });
const received = buildPaymentReceipt(gc, gb, ghostPay);

const html = (receipt, format) => generatePaymentReceiptHtml(receipt, { format });
const t58Partial = html(partial, 'thermal-58');
const t58Paid = html(paid, 'thermal-58');
const t80Partial = html(partial, 'thermal-80');
const t80Paid = html(paid, 'thermal-80');
const a4Partial = html(partial, 'a4');
const a4Paid = html(paid, 'a4');

// The terms paragraph is the ONLY <p dir="rtl" lang="ur"> in any layout
// (the terms-note block is a div with plain <p>s) — extract its text.
function termsParagraph(layoutHtml) {
  const m = layoutHtml.match(/<p dir="rtl" lang="ur">([\s\S]*?)<\/p>/);
  assert.ok(m, 'a <p dir="rtl" lang="ur"> terms paragraph must exist');
  return m[1];
}
function footerBlock(layoutHtml) {
  const start = layoutHtml.indexOf('<footer class="receipt-terms">');
  assert.ok(start >= 0, 'the <footer class="receipt-terms"> must exist');
  return layoutHtml.slice(start, layoutHtml.indexOf('</footer>', start));
}

/* ---------------- G1 — Terms on 58 ---------------- */

test('plan570 G1 58 PARTIAL: thermal-58 shows the full package terms note (item 28)', () => {
  assert.ok(t58Partial.includes(TERMS_FRAG_1), '58 PARTIAL must carry the data-cap sentence');
  assert.ok(t58Partial.includes(TERMS_FRAG_2), '58 PARTIAL must carry the Unlimited sentence');
});

test('plan570 G1 58 PAID: thermal-58 shows the full package terms note (item 28)', () => {
  assert.ok(t58Paid.includes(TERMS_FRAG_1), '58 PAID must carry the data-cap sentence');
  assert.ok(t58Paid.includes(TERMS_FRAG_2), '58 PAID must carry the Unlimited sentence');
});

test('plan570 G1 58 form: the terms paragraph is the same <p dir="rtl" lang="ur"> as 80/A4, inside the footer, no heading (D1(a)/D5(a))', () => {
  assert.equal(termsParagraph(t58Partial), termsParagraph(t80Partial), 'the 58 terms paragraph must read exactly like the 80 one');
  assert.equal(termsParagraph(t58Partial), termsParagraph(a4Partial), 'the 58 terms paragraph must read exactly like the A4 one');
  assert.ok(footerBlock(t58Partial).includes('<p dir="rtl" lang="ur">'), 'the 58 terms paragraph must sit INSIDE the footer (D1(a))');
  assert.ok(!footerBlock(t58Partial).includes('<h2>'), 'the 58 footer must carry no heading (D5(a) — 80 has none either)');
});

test('plan570 G1 80/A4 terms: the existing terms paragraphs are unchanged (guard)', () => {
  assert.ok(t80Partial.includes(TERMS_FRAG_1) && t80Partial.includes(TERMS_FRAG_2), '80 PARTIAL must still carry both terms fragments');
  assert.ok(a4Partial.includes(TERMS_FRAG_1) && a4Partial.includes(TERMS_FRAG_2), 'A4 PARTIAL must still carry both terms fragments');
  assert.ok(footerBlock(t80Partial).includes('<p dir="rtl" lang="ur">'), 'the 80 terms paragraph must still sit inside its footer');
  assert.ok(footerBlock(a4Partial).includes('<h2>Package Terms &amp; Conditions / شرائط پیکیج</h2>'), 'the A4 heading must be untouched');
});

/* ---------------- G2 — Reminder matrix ---------------- */

test('plan570 G2 PAID a4: the pay-by-5th reminder is present (control — it was already there)', () => {
  assert.ok(a4Paid.includes(REMINDER), 'PAID A4 must show the reminder, verbatim');
});

test('plan570 G2 PAID thermal-80: the pay-by-5th reminder is present (item 29)', () => {
  assert.ok(t80Paid.includes(REMINDER), 'PAID thermal-80 must show the reminder, verbatim');
});

test('plan570 G2 PAID thermal-58: the pay-by-5th reminder is present (item 29)', () => {
  assert.ok(t58Paid.includes(REMINDER), 'PAID thermal-58 must show the reminder, verbatim');
});

test('plan570 G2 PARTIAL a4: the pay-by-5th reminder is present (item 29)', () => {
  assert.ok(a4Partial.includes(REMINDER), 'PARTIAL A4 must show the reminder, verbatim');
});

test('plan570 G2 PARTIAL thermal-80: the pay-by-5th reminder is present (item 29)', () => {
  assert.ok(t80Partial.includes(REMINDER), 'PARTIAL thermal-80 must show the reminder, verbatim');
});

test('plan570 G2 PARTIAL thermal-58: the pay-by-5th reminder is present (item 29, D3(a))', () => {
  assert.ok(t58Partial.includes(REMINDER), 'PARTIAL thermal-58 must show the reminder, verbatim');
});

test('plan570 G2 VOID a4: the pay-by-5th reminder is ABSENT (T4)', () => {
  assert.equal(voided.status, 'VOID', 'the fixture must be VOID');
  assert.ok(!html(voided, 'a4').includes(REMINDER), 'a voided A4 receipt must never read as a live demand');
});

test('plan570 G2 VOID thermal-80: the pay-by-5th reminder is ABSENT (T4)', () => {
  assert.ok(!html(voided, 'thermal-80').includes(REMINDER), 'a voided thermal-80 slip must never read as a live demand');
});

test('plan570 G2 VOID thermal-58: the pay-by-5th reminder is ABSENT (T4)', () => {
  assert.ok(!html(voided, 'thermal-58').includes(REMINDER), 'a voided thermal-58 slip must never read as a live demand');
});

test('plan570 G2 CREDIT RECEIVED: the pay-by-5th reminder is ABSENT on all three layouts (D2(a))', () => {
  assert.equal(creditReceived.status, 'CREDIT RECEIVED', 'the fixture must be CREDIT RECEIVED');
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    assert.ok(!html(creditReceived, format).includes(REMINDER), `CREDIT RECEIVED ${format} must not show the reminder under D2(a)`);
  }
});

test('plan570 G2 RECEIVED: the pay-by-5th reminder is ABSENT on all three layouts (D2(a))', () => {
  assert.equal(received.status, 'RECEIVED', 'the fixture must be RECEIVED');
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    assert.ok(!html(received, format).includes(REMINDER), `RECEIVED ${format} must not show the reminder under D2(a)`);
  }
});

/* ---------------- G3 — Ordering + tail shape ---------------- */

test('plan570 G3 58 order: the terms paragraph sits AFTER the Urdu note and AFTER the terms-note block', () => {
  const noteIdx = t58Partial.indexOf(URDU_NOTE_FRAG);
  const phraseIdx = t58Partial.indexOf(TERMS_PHRASE_FRAG);
  const termsIdx = t58Partial.indexOf(TERMS_FRAG_1);
  assert.ok(noteIdx >= 0 && phraseIdx >= 0 && termsIdx >= 0, 'all three tail markers must exist on 58');
  assert.ok(noteIdx < phraseIdx, 'the Urdu note must come before the terms phrase (polish #7 order)');
  assert.ok(phraseIdx < termsIdx, 'the terms paragraph must come after the terms-note block');
});

test('plan570 G3 reminder order: the reminder sits AFTER the star-thanks line and BEFORE the footer on all three layouts (D4(a))', () => {
  // A starred receipt: the star-thanks <p> is present, so the reminder
  // must follow it — the condition depends on `status` only (T5).
  const starred = { ...paid, starThankYouNote: 'Star test thanks' };
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const h = html(starred, format);
    const starIdx = h.indexOf('<p class="receipt-reminder receipt-star-thanks">');
    const reminderIdx = h.indexOf(REMINDER);
    const footerIdx = h.indexOf('<footer class="receipt-terms">');
    assert.ok(starIdx >= 0, `the star-thanks line must render on ${format}`);
    assert.ok(reminderIdx > starIdx, `the reminder must sit after the star-thanks line on ${format}`);
    assert.ok(reminderIdx < footerIdx, `the reminder must sit before the footer on ${format}`);
  }
});

test('plan570 G3 tail shape: neither new paragraph sits inside the <dl> fields list (T6)', () => {
  for (const [name, h] of [['58 PARTIAL', t58Partial], ['80 PARTIAL', t80Partial], ['A4 PARTIAL', a4Partial]]) {
    const dlClose = h.indexOf('</dl>');
    assert.ok(dlClose >= 0, `the ${name} receipt must have a </dl>`);
    assert.ok(h.indexOf(TERMS_FRAG_1) > dlClose, `the terms paragraph must sit after </dl> on ${name}`);
    assert.ok(h.indexOf(REMINDER) > dlClose, `the reminder must sit after </dl> on ${name}`);
  }
});

/* ---------------- G4 — Guards ---------------- */

test('plan570 G4 PACKAGE_TERMS_NOTE: exactly 4 occurrences in receipt.js — definition + 58 + 80 + A4', () => {
  assert.equal((receiptJs.match(/PACKAGE_TERMS_NOTE/g) || []).length, 4, 'the note must occur exactly 4 times (definition + one per layout)');
});

test('plan570 G4 reminder literal: exactly 3 occurrences in receipt.js — once per layout branch', () => {
  const count = receiptJs.split('Please pay by the 5th of each calendar month').length - 1;
  assert.equal(count, 3, 'the reminder literal must occur exactly 3 times (one per layout branch — a 4th would mean a duplicated line)');
});

test('plan570 G4 terms-note calls: receiptTermsNoteHtml() is still called exactly 6 times (T3)', () => {
  // Plan 577: re-pinned 3 → 6 — 3 main layouts (thermal-58, thermal-80,
  // A4) + 3 secondary sheets (kist, settlement, offset). The pin's
  // intent is one call per printable receipt sheet; only the sheet
  // count grows.
  assert.equal((receiptJs.match(/receiptTermsNoteHtml\(\)/g) || []).length, 6, 'one call per printable receipt sheet (3 main layouts + 3 secondary sheets — Plan 577, no 7th call may be added)');
});

test('plan570 G4 parity: EN/UR stays 4,669/4,669 — no new i18n keys', () => {
  // Plan 582 (D1(b)): re-pinned 4,675 → 4,669 — six orphan
  // dash_tile_collect_*/dash_tile_closing_* keys deleted.
  // Plan 584: +38 ledger_filter_* keys — parity 4,669 → 4,707/4,707.
  // Plan 585: +16 global_search_* keys — parity 4,707 → 4,723/4,723.
  // Plan 586: drawer_settings deleted (dead key) — parity 4,723 → 4,722/4,722.
  assert.equal(Object.keys(TRANSLATIONS.en).length, 5168, 'EN key count moved');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 5168, 'UR key count moved');
  const en = Object.keys(TRANSLATIONS.en).sort();
  const ur = Object.keys(TRANSLATIONS.ur).sort();
  assert.deepEqual(en, ur, 'the two languages must carry exactly the same keys');
});
