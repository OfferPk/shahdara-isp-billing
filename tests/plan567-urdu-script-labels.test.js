/**
 * plan567-urdu-script-labels.test.js — Plan 567: the Urdu-script map
 * covers the tax and A4/kist static labels (parent decisions D1–D8,
 * 2026-11-17; see ~/workspace/plan-567-prep.md).
 *
 * SCOPE (D1 (b)+(c)): the spec's 9 entries + the 6 main-receipt extras
 * the prep's sweep found + kist Planned Down Payment + the offset
 * NON-CASH banner — 17 new map entries, 93 → 110 keys. ONLY
 * receipt-script.js changes (the map table) + this file. No generator
 * change, no label-text change, no wiring (Plan 569's job).
 *
 * D2 — the kist/settlement/offset entries are INERT until Plan 569
 * wires the script option through: no Urdu-script print of those three
 * receipts exists in production today, so these entries change nothing
 * observable until 569. They are proved here at the test level only
 * (direct applyReceiptScript, the plan378 pattern — the builders take
 * no `script` parameter, T4). D3 — the split receipt's 7 labels stay
 * out (no production caller, no wiring plan). D5 — the acceptance is
 * read as "no Roman/bilingual static <dt> FIELD LABEL" (the brand
 * header, the A4 <h2> history heading and <dd> values can never be
 * reached by the map). D6 — the history heading 'Last 3 Payments /
 * پچھلی 3 ادائیگیاں' stays out and stays Roman on both layouts
 * (mapping it would translate thermal's <dt><strong> and leave A4's
 * <h2> Roman — an inconsistent half-fix). D7 — the thermal gross row
 * gets a second map key, never a generator change.
 *
 * Fixtures (synthetic data only; generic names Ahmed/Ali; pattern-fake
 * phone 03012345678 family only): the taxed receipt + hand-built
 * kist/settlement/offset fixtures are the prep's repro-567.mjs
 * fixtures, ported verbatim. No modal-drive test (the guard is a map
 * table; the mechanism is pinned by plan168).
 *
 * Groups: G1 map entries (18) + G2 generated main receipt in Urdu (8)
 * + G3 kist/settlement/offset via direct applyReceiptScript (3) +
 * G4 Roman byte-identical (2) + G5 values untouched (2) + G6 guards
 * (3) = 36 tests. Expected suite: 20,241 + 36 = 20,277/0.
 * Build dist 23. Parity 4,675/4,675 (no new i18n keys).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RECEIPT_URDU_LABELS,
  urduReceiptLabel,
  applyReceiptScript,
} from '../receipt-script.js';
import {
  generatePaymentReceiptHtml,
  buildDownPaymentKistReceiptHtml,
  generateDepositSettlementReceiptHtml,
  generateDepositOffsetReceiptHtml,
} from '../receipt.js';
import { SALES_TAX_RECEIPT_LABEL } from '../package-sales-tax.js';
import { TRANSLATIONS } from '../nav-language.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const styles = read('styles.css');
const navCss = read('nav.css');
const components = read('components.css');

function hexCount(css) {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return new Set(noComments.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) || []).size;
}

// ---- Fixture: one taxed receipt carrying every A4/thermal row 567 names ----
// (repro-567.mjs fixture, verbatim.)
const receipt = {
  customerName: 'Ahmed',
  customerId: '12',
  paymentDate: '2026-11-03',
  receiptNumber: 'R-1',
  status: 'PAID',
  package: '20 Mbps',
  area: 'Shahdara',
  paymentMethod: 'Cash',
  paidAmount: 1500,
  nominalPrice: 1500,
  totalBilled: 1695,
  salesTaxCents: 19500,
  firstMonthWaivedAmount: 500,
  servicePeriodStart: '2026-11-01',
  servicePeriodEnd: '2026-11-30',
  balanceDueCents: 0,
  verificationCode: 'AB12-CD',
  prepay: { gross: 4500, months: 3, startMonth: '2026-11', discount: 0, cashPaid: 4500 },
  remainderWaada: { promiseAmount: 200, promiseDate: '2026-11-20' },
  contributorSplit: {
    rows: [{ name: 'Ali', share: 750, paid: 750, remaining: 0 }],
    main: { name: 'Ahmed', share: 750, paid: 750, remaining: 0 },
  },
  previousPayments: [{ date: '2026-10-03', amount: 1500, method: 'Cash', receiptLabel: 'R-0' }],
};

const a4Urdu = generatePaymentReceiptHtml(receipt, { format: 'a4', script: 'urdu' });
const t58Urdu = generatePaymentReceiptHtml(receipt, { format: 'thermal-58', script: 'urdu' });
const t80Urdu = generatePaymentReceiptHtml(receipt, { format: 'thermal-80', script: 'urdu' });

/* ---------------- G1 — map entries (polish12 pattern) ---------------- */

test('plan567 G1 tax: urduReceiptLabel(SALES_TAX_RECEIPT_LABEL) is سیلز ٹیکس', () => {
  assert.equal(urduReceiptLabel(SALES_TAX_RECEIPT_LABEL), 'سیلز ٹیکس');
});

test('plan567 G1 A4 payment method: urduReceiptLabel is ذریعہ ادائیگی', () => {
  assert.equal(urduReceiptLabel('Payment Method / ذریعہ ادائیگی'), 'ذریعہ ادائیگی');
});

test('plan567 G1 A4 receipt status: urduReceiptLabel is کیفیت', () => {
  assert.equal(urduReceiptLabel('Receipt Status / کیفیت'), 'کیفیت');
});

test('plan567 G1 A4 verification code: urduReceiptLabel is تصدیقی کوڈ', () => {
  assert.equal(urduReceiptLabel('Verification Code / تصدیقی کوڈ'), 'تصدیقی کوڈ');
});

test('plan567 G1 A4 balance due after payment: urduReceiptLabel is باقی واجبات', () => {
  assert.equal(urduReceiptLabel('Balance Due After Payment / باقی واجبات'), 'باقی واجبات');
});

test('plan567 G1 A4 prepay coverage: urduReceiptLabel is پیشگی کوریج', () => {
  assert.equal(urduReceiptLabel('Prepay Coverage'), 'پیشگی کوریج');
});

test('plan567 G1 kist down payment received: urduReceiptLabel is موصولہ پیشگی', () => {
  assert.equal(urduReceiptLabel('Down Payment Received / موصولہ پیشگی'), 'موصولہ پیشگی');
});

test('plan567 G1 settlement net refund: urduReceiptLabel is قابل واپسی رقم', () => {
  assert.equal(urduReceiptLabel('Net Refund to Customer / قابل واپسی رقم'), 'قابل واپسی رقم');
});

test('plan567 G1 offset applied: urduReceiptLabel is بل میں تصفیہ', () => {
  assert.equal(urduReceiptLabel('Offset Applied to Bill / بل میں تصفیہ'), 'بل میں تصفیہ');
});

test('plan567 G1 first month included: urduReceiptLabel is پہلا مہینہ شامل ہے', () => {
  assert.equal(urduReceiptLabel('First month included / پہلا مہینہ شامل ہے'), 'پہلا مہینہ شامل ہے');
});

test('plan567 G1 hamsaya hissa taqseem: urduReceiptLabel is حصہ تقسیم', () => {
  assert.equal(urduReceiptLabel('Hamsaya Hissa Taqseem / حصہ تقسیم'), 'حصہ تقسیم');
});

test('plan567 G1 baqi: urduReceiptLabel is باقی رقم', () => {
  assert.equal(urduReceiptLabel('Baqi / باقی رقم'), 'باقی رقم');
});

test('plan567 G1 service period start: urduReceiptLabel is سروس مدت کا آغاز (D4)', () => {
  assert.equal(urduReceiptLabel('Service Period Start'), 'سروس مدت کا آغاز');
});

test('plan567 G1 service period end: urduReceiptLabel is سروس مدت کا اختتام (D4)', () => {
  assert.equal(urduReceiptLabel('Service Period End'), 'سروس مدت کا اختتام');
});

test('plan567 G1 thermal gross row: urduReceiptLabel is کل واجب الادا (D7 second key)', () => {
  assert.equal(urduReceiptLabel('Total Gross Payable / کل واجب الادا (gross)'), 'کل واجب الادا');
});

test('plan567 G1 kist planned down payment: urduReceiptLabel is منصوبہ شدہ پیشگی', () => {
  assert.equal(urduReceiptLabel('Planned Down Payment / منصوبہ شدہ پیشگی'), 'منصوبہ شدہ پیشگی');
});

test('plan567 G1 offset NON-CASH banner: urduReceiptLabel is the Urdu banner text', () => {
  assert.equal(
    urduReceiptLabel('NON-CASH ADJUSTMENT — no cash received / غیر نقد ایڈجسٹمنٹ — کوئی نقد رقم وصول نہیں ہوئی'),
    'غیر نقد ایڈجسٹمنٹ — کوئی نقد رقم وصول نہیں ہوئی',
  );
});

test('plan567 G1 map size: 93 → 110 keys + 1 bare-Kist key (Plan 568 D10, F1)', () => {
  // Plan 568 (D10, F1) adds ONE more key — the bare 'Kist' — so the
  // count is 111 on a post-568 base. The intent of this pin is
  // unchanged: the map holds exactly the 93 old + 17 plan-567 keys +
  // 1 plan-568 key, and no existing value changed.
  assert.equal(Object.keys(RECEIPT_URDU_LABELS).length, 111, 'the map must hold exactly the 93 old + 17 new keys + 1 bare-Kist key (Plan 568 D10)');
  // Spot-check the values the new entries sit next to (the map's rule:
  // value = the Urdu half of the bilingual label).
  assert.equal(RECEIPT_URDU_LABELS['Area / علاقہ'], 'علاقہ');
  assert.equal(RECEIPT_URDU_LABELS['Total Gross Payable'], 'کل واجب الادا');
  assert.equal(RECEIPT_URDU_LABELS['Late Fee Waived / تاخیری فیس معاف'], 'تاخیری فیس معاف');
});

/* ---------------- G2 — generated main receipt in Urdu ---------------- */

test('plan567 G2 tax: taxed A4 in Urdu shows <dt>سیلز ٹیکس</dt>, never the bilingual label', () => {
  assert.ok(!a4Urdu.includes(SALES_TAX_RECEIPT_LABEL), 'tax label still Roman on A4');
  assert.ok(a4Urdu.includes('<dt>سیلز ٹیکس</dt>'), 'A4 tax row must read سیلز ٹیکس (plain <dt>, no colon)');
});

test('plan567 G2 tax: taxed thermal-58 in Urdu shows <dt>سیلز ٹیکس:</dt>', () => {
  assert.ok(!t58Urdu.includes(SALES_TAX_RECEIPT_LABEL), 'tax label still Roman on thermal-58');
  assert.ok(t58Urdu.includes('<dt>سیلز ٹیکس:</dt>'), 'thermal tax row must read سیلز ٹیکس: (plain <dt> with colon)');
});

test('plan567 G2 tax: taxed thermal-80 in Urdu shows <dt>سیلز ٹیکس:</dt>', () => {
  assert.ok(!t80Urdu.includes(SALES_TAX_RECEIPT_LABEL), 'tax label still Roman on thermal-80');
  assert.ok(t80Urdu.includes('<dt>سیلز ٹیکس:</dt>'), 'thermal tax row must read سیلز ٹیکس: (plain <dt> with colon)');
});

test('plan567 G2 A4-only: all 7 A4-only labels translate (plain <dt>, no colon)', () => {
  const roman = [
    'Payment Method / ذریعہ ادائیگی',
    'Receipt Status / کیفیت',
    'Verification Code / تصدیقی کوڈ',
    'Balance Due After Payment / باقی واجبات',
    'Prepay Coverage',
    'Service Period Start',
    'Service Period End',
  ];
  for (const label of roman) assert.ok(!a4Urdu.includes(label), `${label} still Roman on A4`);
  assert.ok(a4Urdu.includes('<dt>ذریعہ ادائیگی</dt>'), 'payment method must read ذریعہ ادائیگی');
  assert.ok(a4Urdu.includes('<dt>کیفیت</dt>'), 'receipt status must read کیفیت');
  assert.ok(a4Urdu.includes('<dt>تصدیقی کوڈ</dt>'), 'verification code must read تصدیقی کوڈ');
  assert.ok(a4Urdu.includes('<dt>باقی واجبات</dt>'), 'balance due after payment must read باقی واجبات');
  assert.ok(a4Urdu.includes('<dt>پیشگی کوریج</dt>'), 'prepay coverage must read پیشگی کوریج');
  assert.ok(a4Urdu.includes('<dt>سروس مدت کا آغاز</dt>'), 'service period start must read سروس مدت کا آغاز');
  assert.ok(a4Urdu.includes('<dt>سروس مدت کا اختتام</dt>'), 'service period end must read سروس مدت کا اختتام');
});

test('plan567 G2 shared extras: First month, Hamsaya Hissa, Baqi translate on A4 + thermal-58', () => {
  for (const label of [
    'First month included / پہلا مہینہ شامل ہے',
    'Hamsaya Hissa Taqseem / حصہ تقسیم',
    'Baqi / باقی رقم',
  ]) {
    assert.ok(!a4Urdu.includes(label), `${label} still Roman on A4`);
    assert.ok(!t58Urdu.includes(label), `${label} still Roman on thermal-58`);
  }
  // Exact rendered forms (T3): A4 plain no-colon; thermal plain with
  // colon — except the Hamsaya header row, which is <strong> with colon.
  assert.ok(a4Urdu.includes('<dt>پہلا مہینہ شامل ہے</dt>'), 'A4 first-month row must read پہلا مہینہ شامل ہے');
  assert.ok(a4Urdu.includes('<dt>حصہ تقسیم</dt>'), 'A4 hamsaya row must read حصہ تقسیم');
  assert.ok(a4Urdu.includes('<dt>باقی رقم</dt>'), 'A4 baqi row must read باقی رقم');
  assert.ok(t58Urdu.includes('<dt>پہلا مہینہ شامل ہے:</dt>'), 'thermal first-month row must read پہلا مہینہ شامل ہے:');
  assert.ok(t58Urdu.includes('<dt><strong>حصہ تقسیم:</strong></dt>'), 'thermal hamsaya header must read <strong>حصہ تقسیم:</strong>');
  assert.ok(t58Urdu.includes('<dt>باقی رقم:</dt>'), 'thermal baqi row must read باقی رقم:');
});

test('plan567 G2 thermal gross: the (gross) variant translates on both thermal layouts', () => {
  const roman = 'Total Gross Payable / کل واجب الادا (gross)';
  assert.ok(!t58Urdu.includes(roman), 'gross row still Roman on thermal-58');
  assert.ok(!t80Urdu.includes(roman), 'gross row still Roman on thermal-80');
  assert.ok(t58Urdu.includes('<dt>کل واجب الادا:</dt>'), 'thermal-58 gross row must read کل واجب الادا:');
  assert.ok(t80Urdu.includes('<dt>کل واجب الادا:</dt>'), 'thermal-80 gross row must read کل واجب الادا:');
});

test('plan567 G2 sweep: no in-scope Roman/bilingual static <dt> label survives in the Urdu A4', () => {
  // The acceptance, read as D5 states it: no Roman/bilingual static
  // <dt> FIELD LABEL. Header text, the A4 <h2> history heading and
  // <dd> values are out of the map's reach by construction (T8/T9)
  // and are NOT asserted here.
  const romanForms = [
    SALES_TAX_RECEIPT_LABEL,
    'Payment Method / ذریعہ ادائیگی',
    'Receipt Status / کیفیت',
    'Verification Code / تصدیقی کوڈ',
    'Balance Due After Payment / باقی واجبات',
    'Prepay Coverage',
    'Service Period Start',
    'Service Period End',
    'First month included / پہلا مہینہ شامل ہے',
    'Hamsaya Hissa Taqseem / حصہ تقسیم',
    'Baqi / باقی رقم',
  ];
  for (const label of romanForms) {
    assert.ok(!a4Urdu.includes(`<dt>${label}</dt>`), `<dt>${label}</dt> still Roman on A4`);
  }
});

test('plan567 G2 values + marker: facts byte-identical, article marked rtl/ur', () => {
  // Service Period Start/End are A4-only fields — the thermal
  // layouts never render them, so their dates are asserted on A4 only.
  for (const fact of ['Ahmed', '2026-11-03', 'AB12-CD', 'PKR 1,500', 'PKR 1,695']) {
    assert.ok(a4Urdu.includes(fact), `Urdu A4 must still carry ${fact}`);
    assert.ok(t58Urdu.includes(fact), `Urdu thermal-58 must still carry ${fact}`);
  }
  for (const fact of ['2026-11-01', '2026-11-30']) {
    assert.ok(a4Urdu.includes(fact), `Urdu A4 must still carry service-period ${fact}`);
  }
  assert.ok(a4Urdu.includes('<article dir="rtl" lang="ur" class="receipt-sheet receipt-urdu-script'), 'A4 article must be marked dir=rtl lang=ur');
  assert.ok(t58Urdu.includes('<article dir="rtl" lang="ur" class="receipt-sheet receipt-urdu-script'), 'thermal article must be marked dir=rtl lang=ur');
});

/* ---------------- G3 — kist / settlement / offset (direct apply) ---------------- */

test('plan567 G3 kist: Down Payment Received + Planned translate via direct applyReceiptScript', () => {
  // plan378 pattern (T4): the builder takes no script option, so the
  // test applies the function directly. Paid 2500 ≠ planned 2000, so
  // the Planned row renders (Sharafat 47).
  const html = buildDownPaymentKistReceiptHtml({
    customerName: 'Ahmed', customerId: '12', receiptNumber: 'R-9', verificationCode: 'AB12-CD',
    paymentDate: '2026-11-03', paymentMethod: 'Cash', itemTitle: 'Router',
    totalAmount: 6000, downPayment: 2000, paidDownPayment: 2500,
    monthlyKist: 1000, totalMonths: 4, remainingAfterDownPayment: 3500,
    schedule: [{ installmentNumber: 1, totalMonths: 4, month: '2026-12', amount: 1000, status: 'remaining' }],
    urduNote: 'شکریہ!',
  });
  const urdu = applyReceiptScript(html, 'urdu');
  assert.ok(!urdu.includes('Down Payment Received / موصولہ پیشگی'), 'kist down-payment label still Roman');
  assert.ok(!urdu.includes('Planned Down Payment / منصوبہ شدہ پیشگی'), 'kist planned label still Roman');
  assert.ok(urdu.includes('<dt><strong>موصولہ پیشگی:</strong></dt>'), 'kist down-payment row must read <strong>موصولہ پیشگی:</strong>');
  assert.ok(urdu.includes('<dt>منصوبہ شدہ پیشگی:</dt>'), 'kist planned row must read منصوبہ شدہ پیشگی: (plain <dt>, colon outside)');
});

test('plan567 G3 settlement: Net Refund to Customer translates via direct applyReceiptScript', () => {
  const html = generateDepositSettlementReceiptHtml({
    customerName: 'Ahmed', customerId: '12', settlementDate: '2026-11-15', receiptNumber: 'R-10',
    securityDeposit: 3000, arrearsOffset: 1000, unrecoveredHardwareCharge: 0, hardwareCovered: 0,
    refundAmount: 2000, arrearsRemaining: 0, hardwareOutstanding: 0,
    offsets: [], hardwareCharges: [], status: 'CLEARED', urduNote: 'شکریہ!',
  });
  const urdu = applyReceiptScript(html, 'urdu');
  assert.ok(!urdu.includes('Net Refund to Customer / قابل واپسی رقم'), 'settlement net-refund label still Roman');
  assert.ok(urdu.includes('<dt><strong>قابل واپسی رقم:</strong></dt>'), 'settlement net-refund row must read <strong>قابل واپسی رقم:</strong>');
});

test('plan567 G3 offset: Offset Applied + NON-CASH banner translate via direct applyReceiptScript', () => {
  const html = generateDepositOffsetReceiptHtml({
    customerName: 'Ahmed', customerId: '12', offsetId: 'OFF-1', offsetDate: '2026-11-10',
    receiptNumber: 'R-11', amount: 1000, bills: [{ month: '2026-11', amount: 1000 }],
    depositBefore: 3000, depositAfter: 2000, reversed: false, reversedAt: null,
    status: 'OFFSET APPLIED', urduNote: 'شکریہ!',
  });
  const urdu = applyReceiptScript(html, 'urdu');
  assert.ok(!urdu.includes('Offset Applied to Bill / بل میں تصفیہ'), 'offset applied label still Roman');
  assert.ok(!urdu.includes('NON-CASH ADJUSTMENT — no cash received / غیر نقد ایڈجسٹمنٹ — کوئی نقد رقم وصول نہیں ہوئی'), 'offset NON-CASH banner still Roman');
  assert.ok(urdu.includes('<dt><strong>بل میں تصفیہ:</strong></dt>'), 'offset row must read <strong>بل میں تصفیہ:</strong>');
  assert.ok(urdu.includes('<dt><strong>غیر نقد ایڈجسٹمنٹ — کوئی نقد رقم وصول نہیں ہوئی</strong></dt>'), 'NON-CASH banner must read the Urdu banner (no-colon <strong> form)');
});

/* ---------------- G4 — Roman byte-identical ---------------- */

test('plan567 G4 main: no-script ≡ script=roman on all three layouts', () => {
  for (const format of ['a4', 'thermal-58', 'thermal-80']) {
    const plain = generatePaymentReceiptHtml(receipt, { format });
    const roman = generatePaymentReceiptHtml(receipt, { format, script: 'roman' });
    assert.equal(roman, plain, `Roman ${format} must be byte-identical to no-script`);
  }
});

test('plan567 G4 builders: applyReceiptScript(html, roman) ≡ input for kist/settlement/offset', () => {
  const kist = buildDownPaymentKistReceiptHtml({
    customerName: 'Ahmed', customerId: '12', receiptNumber: 'R-9', verificationCode: 'AB12-CD',
    paymentDate: '2026-11-03', paymentMethod: 'Cash', itemTitle: 'Router',
    totalAmount: 6000, downPayment: 2000, paidDownPayment: 2000,
    monthlyKist: 1000, totalMonths: 4, remainingAfterDownPayment: 4000,
    schedule: [{ installmentNumber: 1, totalMonths: 4, month: '2026-12', amount: 1000, status: 'remaining' }],
    urduNote: 'شکریہ!',
  });
  const settlement = generateDepositSettlementReceiptHtml({
    customerName: 'Ahmed', customerId: '12', settlementDate: '2026-11-15', receiptNumber: 'R-10',
    securityDeposit: 3000, arrearsOffset: 1000, unrecoveredHardwareCharge: 0, hardwareCovered: 0,
    refundAmount: 2000, arrearsRemaining: 0, hardwareOutstanding: 0,
    offsets: [], hardwareCharges: [], status: 'CLEARED', urduNote: 'شکریہ!',
  });
  const offset = generateDepositOffsetReceiptHtml({
    customerName: 'Ahmed', customerId: '12', offsetId: 'OFF-1', offsetDate: '2026-11-10',
    receiptNumber: 'R-11', amount: 1000, bills: [{ month: '2026-11', amount: 1000 }],
    depositBefore: 3000, depositAfter: 2000, reversed: false, reversedAt: null,
    status: 'OFFSET APPLIED', urduNote: 'شکریہ!',
  });
  for (const [name, html] of [['kist', kist], ['settlement', settlement], ['offset', offset]]) {
    assert.equal(applyReceiptScript(html, 'roman'), html, `${name} Roman render must be unchanged by the map addition`);
    assert.equal(applyReceiptScript(html), html, `${name} no-script render must be unchanged by the map addition`);
  }
});

/* ---------------- G5 — values untouched (T8) ---------------- */

test('plan567 G5 main values: prepay + contributor values stay verbatim in the Urdu output', () => {
  assert.ok(a4Urdu.includes('PKR 4,500 (3 months from 2026-11)'), 'A4 prepay value must stay "PKR 4,500 (3 months from 2026-11)"');
  assert.ok(t58Urdu.includes('Hissa PKR 750 · Ada PKR 750 · Baqi PKR 0'), 'thermal contributor value must stay "Hissa PKR 750 · Ada PKR 750 · Baqi PKR 0"');
});

test('plan567 G5 kist values: monthly-kist + schedule values stay verbatim in the Urdu output', () => {
  const html = buildDownPaymentKistReceiptHtml({
    customerName: 'Ahmed', customerId: '12', receiptNumber: 'R-9', verificationCode: 'AB12-CD',
    paymentDate: '2026-11-03', paymentMethod: 'Cash', itemTitle: 'Router',
    totalAmount: 6000, downPayment: 2000, paidDownPayment: 2000,
    monthlyKist: 1000, totalMonths: 4, remainingAfterDownPayment: 4000,
    schedule: [{ installmentNumber: 1, totalMonths: 4, month: '2026-12', amount: 1000, status: 'remaining' }],
    urduNote: 'شکریہ!',
  });
  const urdu = applyReceiptScript(html, 'urdu');
  assert.ok(urdu.includes('PKR 1,000 × 4 months'), 'monthly-kist value must stay "PKR 1,000 × 4 months"');
  assert.ok(urdu.includes('PKR 1,000 (remaining)'), 'schedule value must stay "PKR 1,000 (remaining)"');
});

/* ---------------- G6 — guards ---------------- */

test('plan567 G6: EN/UR parity stays 4,669/4,669 — the map adds no i18n keys', () => {
  // Plan 582 (D1(b)): re-pinned 4,675 → 4,669 — six orphan
  // dash_tile_collect_*/dash_tile_closing_* keys deleted.
  // Plan 584: +38 ledger_filter_* keys — parity 4,669 → 4,707/4,707.
  // Plan 585: +16 global_search_* keys — parity 4,707 → 4,723/4,723.
  // Plan 586: drawer_settings deleted (dead key) — parity 4,723 → 4,722/4,722.
  assert.equal(Object.keys(TRANSLATIONS.en).length, 4767, 'EN key count moved');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 4767, 'UR key count moved');
});

// Plan 588 D5(b) re-pins nav.css 164 -> 163: .btn-primary:hover #094338
// (its only occurrence) is re-tokened to var(--color-brand-700).
// Title + assert move together (Plan 586 rule).
test('plan567 G6: hex pins hold (styles.css 608 / nav.css 163 / components.css 0, no new hex)', () => {
  // 613 → 608 with Plan 589 (one focus-ring colour): the two dead
  // baselines' #16745a/#0b624b deleted, #6caa91/#97d7bd/#1a5845
  // re-tokened to var(--green). Five distinct hex leave, none added.
  assert.equal(hexCount(styles), 608, `styles.css hex count moved (${hexCount(styles)})`);
  assert.equal(hexCount(navCss), 163, `nav.css hex count moved (${hexCount(navCss)})`);
  assert.equal(hexCount(components), 0, `components.css hex count moved (${hexCount(components)})`);
});

test('plan567 G6: EN and UR key sets are identical (no key added in one language only)', () => {
  const en = Object.keys(TRANSLATIONS.en).sort();
  const ur = Object.keys(TRANSLATIONS.ur).sort();
  assert.deepEqual(en, ur, 'the two languages must carry exactly the same keys');
});
