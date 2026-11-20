/**
 * plan569-urdu-script-wiring-css.test.js — Plan 569: script-option
 * wiring + CSS for the kist/settlement/offset receipts (parent
 * decisions D1–D10, 2026-11-17; see ~/workspace/plan-569-prep.md).
 *
 * SCOPE (D1(a) wiring-only + disclosed follow-up): the three HTML
 * builders in receipt.js accept a `script` option (default 'roman')
 * and pass it through applyReceiptScript, exactly as the main receipt
 * does; their three print functions in app.js accept and forward it
 * the same way; styles.css gains .receipt-urdu-script rules (print +
 * screen). ONLY receipt.js + app.js + styles.css change + this file.
 * No change to receipt-script.js (T11 — the map stays exactly 111
 * keys), no receipt-data change, no split change (T5), no header
 * change (D9), no thermal change, no new hex, no new t() keys.
 *
 * D2 — wiring shape (A): `script = 'roman'` default in each
 * builder's options object + wrap the single article return in
 * applyReceiptScript(…, script). D3 — the kist auto-print stays
 * Roman always (no choice moment; disclosed). D4 — print functions
 * take a TRAILING options object ({ script = 'roman' } = {}), never
 * a positional script parameter. D5 — CSS scope (b) print + screen.
 * D6 — column order (a) RTL-natural: the grid flip is accepted, not
 * fought (no direction:ltr pin anywhere in the new rules). D7 —
 * Naskh + line-height: the face stays the .receipt-sheet Naskh
 * stack; only line-height grows (notice 1.6 → 1.9, terms 1.8 → 2).
 * D8 — signature row (a): the RTL-natural flip is accepted
 * (Collector box right, Shahdara ISP box left). D9 — acceptance is
 * read as <dt> labels only; the brand header stays Roman. D10 —
 * this NEW file (the 567 file stays untouched).
 *
 * D1(a) DISCLOSURE — no operator can print these three receipts in
 * Urdu yet: no production caller passes 'urdu' to any of the three
 * print functions (G3 pins the three call sites passing no script,
 * and the only script:'urdu' call sites in app.js are the Plan 168
 * panel's preview + print of the MAIN receipt). The operator
 * script-choice path for kist/settlement/offset is a NAMED follow-up
 * item, not this PR. The wiring is demonstrable only in tests here —
 * the same disclosure pattern as 567 D2 / 568 T7. The kist print is
 * automatic (app.js:10000, right after a plan + payment are
 * recorded), so even a future button cannot cover it (T12).
 *
 * Fixtures (synthetic data only; generic names Ahmed/Ali; pattern-fake
 * IDs TKT-101/BST-7/MBQ-3; pattern-fake phone 03012345678 family
 * only): the kist/settlement/offset fixtures are the prep's
 * repro-569.mjs fixtures, ported verbatim. No modal-drive test (the
 * wiring is a defaulted option + one wrapped return per builder; the
 * print functions are pinned by source-text assertions, plan423
 * precedent — app.js is not imported by unit tests).
 *
 * Groups: G1 builder wiring (12) + G2 print-function forwarding (4)
 * + G3 the UI path under D1(a) (3) + G4 CSS (6) + G5 guards (5) =
 * 30 tests. Expected suite: 20,310 + 30 = 20,340/0.
 * Build dist 23. Parity 4,675/4,675 (no new i18n keys).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RECEIPT_URDU_LABELS,
  sanitizeReceiptScript,
} from '../receipt-script.js';
import {
  buildDownPaymentKistReceiptHtml,
  generateDepositSettlementReceiptHtml,
  generateDepositOffsetReceiptHtml,
} from '../receipt.js';
import { TRANSLATIONS } from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const appJs = read('app.js');
const styles = read('styles.css');
const navCss = read('nav.css');
const components = read('components.css');

function hexCount(css) {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return new Set(noComments.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) || []).size;
}

// plan423 precedent: app.js is not imported by unit tests, so the
// print functions are pinned by source text. Slice one function's
// body (from its definition to the next top-level `function `).
function fnBody(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist in app.js`);
  const rest = src.slice(start);
  const next = rest.indexOf('\nfunction ', 1);
  return next >= 0 ? rest.slice(0, next) : rest;
}

// ---- Fixtures (repro-569.mjs fixtures, verbatim) ----
const kistReceipt = {
  customerName: 'Ahmed', customerId: '12', receiptNumber: 'R-9', verificationCode: 'AB12-CD',
  paymentDate: '2026-11-03', paymentMethod: 'Cash', itemTitle: 'Router',
  totalAmount: 6000, downPayment: 2000, paidDownPayment: 2500,
  monthlyKist: 1000, totalMonths: 4, remainingAfterDownPayment: 3500,
  schedule: [{ installmentNumber: 1, totalMonths: 4, month: '2026-12', amount: 1000, status: 'remaining' }],
  urduNote: 'شکریہ!',
};
const settlementReceipt = {
  customerName: 'Ahmed', customerId: '12', settlementDate: '2026-11-15', receiptNumber: 'R-10',
  securityDeposit: 3000, arrearsOffset: 1000, unrecoveredHardwareCharge: 300, hardwareCovered: 0,
  refundAmount: 2000, arrearsRemaining: 0, hardwareOutstanding: 0,
  offsets: [{ month: '2026-11', amount: 500 }],
  hardwareCharges: [{ label: 'Tenda F3 Router', amount: 300 }],
  status: 'CLEARED', urduNote: 'شکریہ!',
};
const offsetReceipt = {
  customerName: 'Ahmed', customerId: '12', offsetId: 'OFF-1', offsetDate: '2026-11-10',
  receiptNumber: 'R-11', amount: 1000, bills: [{ month: '2026-11', amount: 1000 }],
  depositBefore: 3000, depositAfter: 2000, reversed: false, reversedAt: null,
  status: 'OFFSET APPLIED', urduNote: 'شکریہ!',
};

const kistUrdu = buildDownPaymentKistReceiptHtml(kistReceipt, { script: 'urdu' });
const kistRoman = buildDownPaymentKistReceiptHtml(kistReceipt);
const settlementUrdu = generateDepositSettlementReceiptHtml(settlementReceipt, { script: 'urdu' });
const settlementRoman = generateDepositSettlementReceiptHtml(settlementReceipt);
const offsetUrdu = generateDepositOffsetReceiptHtml(offsetReceipt, { script: 'urdu' });
const offsetRoman = generateDepositOffsetReceiptHtml(offsetReceipt);

/* ---------------- G1 — builder wiring ---------------- */

test('plan569 G1 kist static: Down Payment Received + Planned translate with script=urdu, article marked (T3)', () => {
  assert.ok(!kistUrdu.includes('Down Payment Received / موصولہ پیشگی'), 'kist down-payment label still Roman');
  assert.ok(!kistUrdu.includes('Planned Down Payment / منصوبہ شدہ پیشگی'), 'kist planned label still Roman');
  assert.ok(kistUrdu.includes('<dt><strong>موصولہ پیشگی:</strong></dt>'), 'kist down-payment row must read <strong>موصولہ پیشگی:</strong>');
  assert.ok(kistUrdu.includes('<dt>منصوبہ شدہ پیشگی:</dt>'), 'kist planned row must read منصوبہ شدہ پیشگی:');
  assert.ok(kistUrdu.includes('<article dir="rtl" lang="ur" class="receipt-sheet receipt-urdu-script" data-receipt-format="down-payment-kist">'), 'kist article must be marked dir=rtl lang=ur receipt-urdu-script (no a4-receipt — T3)');
});

test('plan569 G1 kist dynamic: schedule row translates with script=urdu (568 P5)', () => {
  assert.ok(!kistUrdu.includes('Kist 1/4 · 2026-12'), 'kist schedule label still Roman');
  assert.ok(kistUrdu.includes('<dt>قسط 1/4 · 2026-12:</dt>'), 'kist schedule row must read قسط 1/4 · 2026-12:');
});

test('plan569 G1 kist Roman: no-script ≡ script=roman (byte-identical)', () => {
  assert.equal(buildDownPaymentKistReceiptHtml(kistReceipt, { script: 'roman' }), kistRoman, 'Roman kist must be byte-identical to no-script');
});

test('plan569 G1 kist values: monthly-kist + schedule values stay verbatim in the Urdu output (T4)', () => {
  assert.ok(kistUrdu.includes('PKR 1,000 × 4 months'), 'monthly-kist value must stay "PKR 1,000 × 4 months"');
  assert.ok(kistUrdu.includes('PKR 1,000 (remaining)'), 'schedule value must stay "PKR 1,000 (remaining)"');
  assert.ok(kistUrdu.includes('Router'), 'kist item title must stay verbatim');
});

test('plan569 G1 settlement static: Net Refund translates with script=urdu, article marked (T3)', () => {
  assert.ok(!settlementUrdu.includes('Net Refund to Customer / قابل واپسی رقم'), 'settlement net-refund label still Roman');
  assert.ok(settlementUrdu.includes('<dt><strong>قابل واپسی رقم:</strong></dt>'), 'settlement net-refund row must read <strong>قابل واپسی رقم:</strong>');
  assert.ok(settlementUrdu.includes('<article dir="rtl" lang="ur" class="receipt-sheet receipt-urdu-script a4-receipt" data-receipt-format="deposit-settlement">'), 'settlement article must be marked dir=rtl lang=ur receipt-urdu-script a4-receipt');
});

test('plan569 G1 settlement dynamic: arrears offset + unrecovered rows translate with script=urdu (568 P8/P10)', () => {
  assert.ok(!settlementUrdu.includes('Arrears offset — 2026-11'), 'settlement arrears-offset label still Roman');
  assert.ok(!settlementUrdu.includes('Unrecovered Tenda F3 Router'), 'settlement unrecovered label still Roman');
  assert.ok(settlementUrdu.includes('<dt>بقایا تصفیہ — 2026-11:</dt>'), 'settlement arrears-offset row must read بقایا تصفیہ — 2026-11:');
  assert.ok(settlementUrdu.includes('<dt>ناقابلِ وصول Tenda F3 Router:</dt>'), 'settlement unrecovered row must read ناقابلِ وصول Tenda F3 Router:');
});

test('plan569 G1 settlement Roman: no-script ≡ script=roman (byte-identical)', () => {
  assert.equal(generateDepositSettlementReceiptHtml(settlementReceipt, { script: 'roman' }), settlementRoman, 'Roman settlement must be byte-identical to no-script');
});

test('plan569 G1 settlement values: amounts + hardware label stay verbatim in the Urdu output (T4)', () => {
  assert.ok(settlementUrdu.includes('PKR 2,000'), 'settlement refund amount must stay "PKR 2,000"');
  assert.ok(settlementUrdu.includes('PKR 3,000'), 'settlement deposit-held amount must stay "PKR 3,000"');
  assert.ok(settlementUrdu.includes('Tenda F3 Router'), 'settlement hardware label must stay verbatim');
});

test('plan569 G1 offset static: Offset Applied + NON-CASH banner translate with script=urdu, article marked (T3)', () => {
  assert.ok(!offsetUrdu.includes('Offset Applied to Bill / بل میں تصفیہ'), 'offset applied label still Roman');
  assert.ok(!offsetUrdu.includes('NON-CASH ADJUSTMENT — no cash received / غیر نقد ایڈجسٹمنٹ — کوئی نقد رقم وصول نہیں ہوئی'), 'offset NON-CASH banner still Roman');
  assert.ok(offsetUrdu.includes('<dt><strong>بل میں تصفیہ:</strong></dt>'), 'offset row must read <strong>بل میں تصفیہ:</strong>');
  assert.ok(offsetUrdu.includes('<dt><strong>غیر نقد ایڈجسٹمنٹ — کوئی نقد رقم وصول نہیں ہوئی</strong></dt>'), 'NON-CASH banner must read the Urdu banner (no-colon <strong> form)');
  assert.ok(offsetUrdu.includes('<article dir="rtl" lang="ur" class="receipt-sheet receipt-urdu-script a4-receipt" data-receipt-format="deposit-offset">'), 'offset article must be marked dir=rtl lang=ur receipt-urdu-script a4-receipt');
});

test('plan569 G1 offset dynamic: bill row translates with script=urdu (568 P9)', () => {
  assert.ok(!offsetUrdu.includes('Bill offset — 2026-11'), 'offset bill label still Roman');
  assert.ok(offsetUrdu.includes('<dt>بل تصفیہ — 2026-11:</dt>'), 'offset bill row must read بل تصفیہ — 2026-11:');
});

test('plan569 G1 offset Roman: no-script ≡ script=roman (byte-identical)', () => {
  assert.equal(generateDepositOffsetReceiptHtml(offsetReceipt, { script: 'roman' }), offsetRoman, 'Roman offset must be byte-identical to no-script');
});

test('plan569 G1 offset values: amounts + offset id stay verbatim in the Urdu output (T4)', () => {
  assert.ok(offsetUrdu.includes('PKR 1,000'), 'offset amount must stay "PKR 1,000"');
  assert.ok(offsetUrdu.includes('PKR 3,000'), 'offset deposit-before must stay "PKR 3,000"');
  assert.ok(offsetUrdu.includes('PKR 2,000'), 'offset deposit-after must stay "PKR 2,000"');
  assert.ok(offsetUrdu.includes('OFF-1'), 'offset id must stay verbatim');
});

/* ---------------- G2 — print-function forwarding ---------------- */

test('plan569 G2 kist print: printDownPaymentKistReceipt takes a trailing script option and forwards it (D4)', () => {
  assert.ok(appJs.includes("function printDownPaymentKistReceipt(customerForReceipt, plan, payment, { script = 'roman' } = {})"), 'kist print function must take a trailing { script = \'roman\' } options object');
  const body = fnBody(appJs, 'printDownPaymentKistReceipt');
  assert.ok(body.includes('buildDownPaymentKistReceiptHtml(receipt, {'), 'kist print must call its builder');
  assert.ok(/receiptFooter: getReceiptFooter\(\),\s*\n\s*\/\/ Plan 569[\s\S]*?\n\s*script\n\s*\}\);/.test(body), 'kist print must forward script to its builder call');
});

test('plan569 G2 settlement print: printDepositSettlementReceipt takes a trailing script option and forwards it (D4)', () => {
  assert.ok(appJs.includes("function printDepositSettlementReceipt(customerId, { script = 'roman' } = {})"), 'settlement print function must take a trailing { script = \'roman\' } options object');
  const body = fnBody(appJs, 'printDepositSettlementReceipt');
  assert.ok(body.includes('generateDepositSettlementReceiptHtml(receipt, {'), 'settlement print must call its builder');
  assert.ok(/receiptFooter: getReceiptFooter\(\),\s*\n\s*\/\/ Plan 569[\s\S]*?\n\s*script\n\s*\}\);/.test(body), 'settlement print must forward script to its builder call');
});

test('plan569 G2 offset print: printDepositOffsetReceipt takes a trailing script option and forwards it (D4)', () => {
  assert.ok(appJs.includes("function printDepositOffsetReceipt(customerId, offsetId, { script = 'roman' } = {})"), 'offset print function must take a trailing { script = \'roman\' } options object');
  const body = fnBody(appJs, 'printDepositOffsetReceipt');
  assert.ok(body.includes('generateDepositOffsetReceiptHtml(receipt, {'), 'offset print must call its builder');
  assert.ok(/receiptFooter: getReceiptFooter\(\),\s*\n\s*\/\/ Plan 569[\s\S]*?\n\s*script\n\s*\}\);/.test(body), 'offset print must forward script to its builder call');
});

test('plan569 G2 main print: printPaymentReceipt forwarding is unchanged (D4 contrast)', () => {
  assert.ok(appJs.includes("function printPaymentReceipt(customerId, month, paymentId, { isThermal = false, format = isThermal ? 'thermal-80' : 'a4', script = 'roman' } = {})"), 'printPaymentReceipt signature must be unchanged');
  const body = fnBody(appJs, 'printPaymentReceipt');
  assert.ok(body.includes('generatePaymentReceiptHtml(receipt, {'), 'printPaymentReceipt must still call its builder');
  // Plan 571: the builder call now forwards reprintCount after script
  // (the 571 stamp input), so script is no longer the last property —
  // the regex pins script still forwarded AND reprintCount after it.
  assert.ok(/\/\/ Plan 168[\s\S]*?\n\s*script,\n\s*\/\/ Plan 571[\s\S]*?\n\s*reprintCount\n\s*}\);/.test(body), 'printPaymentReceipt must still forward script to its builder call');
});

/* ---------------- G3 — the UI path under D1(a) ---------------- */

test('plan569 G3 call sites: the three production callers still pass no script (D1(a) disclosed)', () => {
  // The absence is the point: no operator path can pass 'urdu' yet.
  // These exact call strings pin it — if a caller ever gains an
  // options argument, this test fails loudly and the follow-up owns it.
  assert.ok(appJs.includes('printDownPaymentKistReceipt(paidCustomer, plan, added)'), 'kist auto-print call site must still pass no options object');
  assert.ok(appJs.includes('printDepositSettlementReceipt(customer.id)'), 'settlement profile-button call site must still pass no options object');
  assert.ok(appJs.includes("printDepositOffsetReceipt(customer.id, btn.getAttribute('data-profile-deposit-offset-receipt'))"), 'offset profile-button call site must still pass no options object');
});

test('plan569 G3 only Urdu path: the only script:\'urdu\' call sites in app.js are the Plan 168 panel (D1(a) disclosed)', () => {
  const hits = appJs.match(/script: 'urdu'/g) || [];
  assert.equal(hits.length, 2, 'exactly two script:\'urdu\' sites must exist in app.js (the panel preview + print)');
  assert.ok(appJs.includes("printPaymentReceipt(customer.id, bill.month, payment.id, { format: chosenFormat(), script: 'urdu' })"), 'the panel print must still pass script:\'urdu\' to printPaymentReceipt only');
});

test('plan569 G3 kist auto-print: the kist print fires automatically with no choice moment (D3, T12)', () => {
  // The call sits inside the installment-plan-add flow, right after
  // addPayment + save() + renderDetail() — there is no moment where
  // the operator could choose a script for it.
  const body = fnBody(appJs, 'printDownPaymentKistReceipt');
  assert.ok(!body.includes("script: 'urdu'"), 'the kist print function itself must never hard-code urdu');
  assert.ok(appJs.includes('if (added) printDownPaymentKistReceipt(paidCustomer, plan, added);'), 'the kist print must still fire automatically from the plan-add flow');
});

/* ---------------- G4 — CSS ---------------- */

test('plan569 G4 screen rules: .receipt-urdu-script right-aligns labels and values (D5(b))', () => {
  assert.ok(styles.includes('.receipt-urdu-script .receipt-field dt{text-align:right}'), 'Urdu dt rule must exist');
  assert.ok(styles.includes('.receipt-urdu-script .receipt-field dd{text-align:right}'), 'Urdu dd rule must exist');
});

test('plan569 G4 line-height: notice 1.6 → 1.9, terms 1.8 → 2 under .receipt-urdu-script (D7(a) Naskh)', () => {
  assert.ok(styles.includes('.receipt-urdu-script .receipt-urdu-notice{line-height:1.9}'), 'Urdu notice line-height must be 1.9');
  assert.ok(styles.includes('.receipt-urdu-script .receipt-terms p{line-height:2}'), 'Urdu terms line-height must be 2');
  // Naskh only: the new rules must not name Noto Nastaliq Urdu (T9 —
  // the face is not loaded in Roman language mode, so naming it would
  // silently fall back to Naskh). The face IS named on other surfaces
  // (Polish 17, Plan 487), so this check is scoped to the new block.
  const start = styles.indexOf('/* Plan 569: Urdu-script receipt rules');
  assert.ok(start >= 0, 'the Plan 569 CSS comment must exist');
  const block = styles.slice(start, styles.indexOf('@media print{', start));
  assert.ok(!block.includes('Noto Nastaliq Urdu'), 'no new rule may name Noto Nastaliq Urdu');
});

test('plan569 G4 no new hex: the new rules set no colour, and the hex pins hold (T6)', () => {
  const start = styles.indexOf('/* Plan 569: Urdu-script receipt rules');
  assert.ok(start >= 0, 'the Plan 569 CSS comment must exist');
  const block = styles.slice(start, styles.indexOf('@media(max-width:620px)', start));
  assert.ok(!/#[0-9a-fA-F]/.test(block), 'the new CSS block must contain no hex colour');
  // 613 → 608 with Plan 589 (one focus-ring colour): the two dead
  // baselines' #16745a/#0b624b deleted, #6caa91/#97d7bd/#1a5845
  // re-tokened to var(--green). Five distinct hex leave, none added.
  assert.equal(hexCount(styles), 608, `styles.css hex count moved (${hexCount(styles)})`);
  // Plan 588 D5(b) re-pins nav.css 164 -> 163: .btn-primary:hover #094338
  // (its only occurrence) is re-tokened to var(--color-brand-700).
  assert.equal(hexCount(navCss), 163, `nav.css hex count moved (${hexCount(navCss)})`);
  assert.equal(hexCount(components), 0, `components.css hex count moved (${hexCount(components)})`);
});

test('plan569 G4 shared rules untouched: the Roman receipt rules are byte-identical (T7)', () => {
  assert.ok(styles.includes('.receipt-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 22px;margin:24px 0 18px}'), '.receipt-fields rule must be unchanged');
  assert.ok(styles.includes('.receipt-field dt{margin-bottom:5px;color:#64776d;font-size:10px;font-weight:700;letter-spacing:.2px}'), '.receipt-field dt rule must be unchanged');
  assert.ok(styles.includes('.receipt-field dd{min-height:27px;margin:0;padding:3px 0 5px;border-bottom:1px solid #aebdb4;color:#182c24;font-size:13px;font-weight:600;overflow-wrap:anywhere}'), '.receipt-field dd rule must be unchanged');
  assert.ok(styles.includes('.receipt-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:20px;border-bottom:2px solid #155b49}'), '.receipt-head rule must be unchanged');
  assert.ok(styles.includes('.receipt-urdu-notice {\n  margin: 16px 0;\n  padding: 10px 14px;'), '.receipt-urdu-notice base rule must be unchanged');
});

test('plan569 G4 RTL-natural: no direction:ltr pin in the new rules (D6(a) — the flip is accepted)', () => {
  const start = styles.indexOf('/* Plan 569: Urdu-script receipt rules');
  assert.ok(start >= 0, 'the Plan 569 CSS comment must exist');
  // Slice the RULES only (after the comment's close): the comment
  // itself discusses the direction pin in prose.
  const rulesStart = styles.indexOf('*/', start) + 2;
  const block = styles.slice(rulesStart, styles.indexOf('@media print{', start));
  assert.ok(!/direction\s*:\s*ltr/.test(block), 'the new rules must not pin the Roman column order with direction:ltr');
});

test('plan569 G4 print block: the receipt @media print block contains the Urdu case (T8)', () => {
  const start = styles.indexOf('@media print{');
  assert.ok(start >= 0, 'the receipt @media print block must exist');
  const end = styles.indexOf('}\n\n\n/* Owner Command Center', start);
  assert.ok(end > start, 'the receipt print block must end before the Owner Command Center section');
  const block = styles.slice(start, end);
  assert.ok(block.includes('.receipt-urdu-script'), 'the receipt print block must mention .receipt-urdu-script');
  assert.ok(block.includes('body.printing-receipt .receipt-urdu-script .receipt-urdu-notice{break-inside:avoid}'), 'the Urdu notice must not split across a printed page');
});

/* ---------------- G5 — guards ---------------- */

test('plan569 G5 map size: exactly 111 keys — 569 must not touch the script module (T11)', () => {
  assert.equal(Object.keys(RECEIPT_URDU_LABELS).length, 111, 'the map must hold exactly the 111 keys (567 + 568 bare-Kist)');
  assert.equal(RECEIPT_URDU_LABELS.Kist, 'قسط', 'the bare Kist key (568 F1) must still map to قسط');
});

test('plan569 G5 parity: EN/UR stays 4,669/4,669 — no new i18n keys (T6)', () => {
  // Plan 582 (D1(b)): re-pinned 4,675 → 4,669 — six orphan
  // dash_tile_collect_*/dash_tile_closing_* keys deleted.
  // Plan 584: +38 ledger_filter_* keys — parity 4,669 → 4,707/4,707.
  // Plan 585: +16 global_search_* keys — parity 4,707 → 4,723/4,723.
  // Plan 586: drawer_settings deleted (dead key) — parity 4,723 → 4,722/4,722.
  assert.equal(Object.keys(TRANSLATIONS.en).length, 5212, 'EN key count moved');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 5212, 'UR key count moved');
  const en = Object.keys(TRANSLATIONS.en).sort();
  const ur = Object.keys(TRANSLATIONS.ur).sort();
  assert.deepEqual(en, ur, 'the two languages must carry exactly the same keys');
});

test('plan569 G5 unknown script: sanitize rejects it, and a builder with an unknown script prints Roman (T4)', () => {
  assert.equal(sanitizeReceiptScript('french'), null, 'an unknown script must sanitize to null');
  assert.equal(sanitizeReceiptScript('URDU'), 'urdu', 'the sanitizer still trims/lowercases');
  assert.equal(sanitizeReceiptScript('roman'), 'roman', 'roman still sanitizes to roman');
  assert.equal(buildDownPaymentKistReceiptHtml(kistReceipt, { script: 'nonsense' }), kistRoman, 'an unknown script on the kist builder must print Roman, never crash');
  assert.equal(generateDepositSettlementReceiptHtml(settlementReceipt, { script: 'nonsense' }), settlementRoman, 'an unknown script on the settlement builder must print Roman, never crash');
  assert.equal(generateDepositOffsetReceiptHtml(offsetReceipt, { script: 'nonsense' }), offsetRoman, 'an unknown script on the offset builder must print Roman, never crash');
});

test('plan569 G5 kist article: no a4-receipt class, still gets marked (T3)', () => {
  assert.ok(!kistRoman.includes('a4-receipt'), 'the kist article must not carry a4-receipt in Roman');
  assert.ok(!kistUrdu.includes('a4-receipt'), 'the kist article must not carry a4-receipt in Urdu either');
  assert.ok(kistUrdu.includes('receipt-urdu-script'), 'the kist article must still be marked receipt-urdu-script');
  assert.ok(settlementUrdu.includes('a4-receipt'), 'the settlement article keeps its a4-receipt class');
});

test('plan569 G5 signatures: the settlement signature row renders two boxes in both scripts (D8(a))', () => {
  const count = (html) => (html.match(/receipt-sig-box/g) || []).length;
  assert.equal(count(settlementRoman), 2, 'Roman settlement must render two signature boxes');
  assert.equal(count(settlementUrdu), 2, 'Urdu settlement must render two signature boxes');
  assert.ok(settlementUrdu.includes('Collector'), 'the Collector box must survive in Urdu');
  assert.ok(settlementUrdu.includes('Shahdara ISP'), 'the Shahdara ISP box must survive in Urdu');
  assert.equal(count(kistRoman), 0, 'the kist receipt has no signature row');
  assert.equal(count(offsetRoman), 0, 'the offset receipt has no signature row');
});
