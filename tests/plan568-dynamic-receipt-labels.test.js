/**
 * plan568-dynamic-receipt-labels.test.js — Plan 568: dynamic receipt
 * labels translate in Urdu script (parent decisions D1–D10,
 * 2026-11-17; see ~/workspace/plan-568-prep.md).
 *
 * SCOPE (D1 (b)+(d)): the acceptance families (ticket/boost/prepay/
 * contributor + kist main lines) + the inert builder rows (P8/P9/P10)
 * + the bare-'Kist' static key (F1). ONLY receipt-script.js changes
 * (the prefix table + one static key) + this file. No generator
 * change, no label-text change, no wiring (Plan 569's job).
 *
 * D2 — mechanism (A): a NEW exported prefix table
 * RECEIPT_URDU_PREFIXES, applied inside applyReceiptScript AFTER the
 * exact pass (mandatory, T2). Mechanism (B) was rejected.
 * D3 — Urdu values confirmed: ticket 'مرمت / سامان چارج (', arrears
 * offset 'بقایا تصفیہ — ', bill offset 'بل تصفیہ — ', unrecovered
 * 'ناقابلِ وصول ' (bytes verified against the UR bd_heading value in
 * nav-language.js — kasra U+0650 after ل — never retyped), Asal
 * Customer 'اصل گاہک — ' (not 'اصل کسٹمر — ').
 * D4 — the prepay parenthetical '(3 months · from 2026-11)' stays
 * VERBATIM (months/from stay Roman inside an otherwise-Urdu label).
 * D5 — acceptance: "the static part of each dynamic label is Urdu
 * script; the variable part (ID/date/count/name) is verbatim; Roman
 * print byte-identical" — kist/settlement/offset demonstrable only
 * via direct applyReceiptScript until 569 (disclosed).
 * D6 — the history heading stays OUT (567 D6 stands) and stays Roman.
 * D7 — history rows need NO mechanism (dates are values).
 * D8 — split stays OUT (567 D3 stands; t()-driven, no caller).
 * D9 — this NEW file (the 567 file stays untouched).
 * D10 — 568 carries the bare-'Kist' key ('Kist' → 'قسط', F1).
 *
 * Fixtures (synthetic data only; generic names Ahmed/Ali; pattern-fake
 * IDs TKT-101/BST-7/MBQ-3; pattern-fake phone 03012345678 family
 * only): the main receipt + kist/settlement/offset fixtures are the
 * prep's repro-568.mjs fixtures, ported verbatim. No modal-drive test
 * (the guard is a table + one key; the mechanism is pinned here).
 *
 * Groups: G1 prefix unit tests (12) + G2 generated main receipt (10)
 * + G3 builder-direct rows, disclosed inert (6) + G4 guards (5) =
 * 33 tests. Expected suite: 20,277 + 33 = 20,310/0.
 * Build dist 23. Parity 4,675/4,675 (no new i18n keys).
 *
 * Plan 569 note: 569 wired the script option into the three builders
 * (D2), so the G3 wiring absence-controls flipped to presence
 * controls (see that test's why-comment). The rows are no longer
 * inert — but no production caller passes 'urdu' yet (569 D1(a)).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RECEIPT_URDU_LABELS,
  RECEIPT_URDU_PREFIXES,
  urduReceiptLabel,
  applyReceiptScript,
} from '../receipt-script.js';
import {
  generatePaymentReceiptHtml,
  buildDownPaymentKistReceiptHtml,
  generateDepositSettlementReceiptHtml,
  generateDepositOffsetReceiptHtml,
} from '../receipt.js';
import { TRANSLATIONS } from '../nav-language.js';

// ---- Fixture: one receipt carrying every dynamic row 568 names ----
// (repro-568.mjs fixture, verbatim.)
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
  ticketCharges: [{ ticketId: 'TKT-101', amount: 300 }],
  addonCharges: [{ boostId: 'BST-7', amount: 200 }],
  manualBaqayaSettlements: [{ entryId: 'MBQ-3', amount: 150 }],
  arrearsBreakdown: {
    packageAmount: 1000, kistAmount: 1000,
    kistLines: [{ installmentNumber: 1, totalMonths: 3, itemTitle: 'Tenda F3 Router', amount: 1000 }],
    previousArrears: 500, totalDue: 2500, paidAmount: 1500,
  },
  previousPayments: [{ date: '2026-10-03', amount: 1500, method: 'Cash', receiptLabel: 'R-0' }],
};

const t58Urdu = generatePaymentReceiptHtml(receipt, { format: 'thermal-58', script: 'urdu' });
const t80Urdu = generatePaymentReceiptHtml(receipt, { format: 'thermal-80', script: 'urdu' });
const a4Urdu = generatePaymentReceiptHtml(receipt, { format: 'a4', script: 'urdu' });

/* ---------------- G1 — prefix unit tests (direct applyReceiptScript) ---------------- */

// One assertion per prefix rule (P1–P10), plain <dt> form, plus the
// <strong> variant covered once (G1 strong) — the variable part
// re-attaches verbatim in every case.

test('plan568 G1 P1 prepay: prefix translates, parenthetical re-attaches verbatim (D4)', () => {
  const out = applyReceiptScript('<dt>Prepay Coverage / پیشگی کوریج (3 months · from 2026-11):</dt>', 'urdu');
  assert.equal(out, '<dt>پیشگی کوریج (3 months · from 2026-11):</dt>');
});

test('plan568 G1 P2 ticket: prefix translates, ticket ID re-attaches verbatim', () => {
  const out = applyReceiptScript('<dt>Murammat / Material Charge (TKT-101):</dt>', 'urdu');
  assert.equal(out, '<dt>مرمت / سامان چارج (TKT-101):</dt>');
});

test('plan568 G1 P3 boost: prefix translates, boost ID re-attaches verbatim', () => {
  const out = applyReceiptScript('<dt>Speed Boost / سپیڈ بوسٹ (BST-7):</dt>', 'urdu');
  assert.equal(out, '<dt>سپیڈ بوسٹ (BST-7):</dt>');
});

test('plan568 G1 P4 manual baqaya: prefix translates, entry ID re-attaches verbatim', () => {
  const out = applyReceiptScript('<dt>Manual Baqaya / دستی بقایا (MBQ-3):</dt>', 'urdu');
  assert.equal(out, '<dt>دستی بقایا (MBQ-3):</dt>');
});

test('plan568 G1 P5 kist line: prefix translates, count + title re-attach (two colons, T3)', () => {
  const out = applyReceiptScript('<dt>Kist 1/3: Tenda F3 Router:</dt>', 'urdu');
  assert.equal(out, '<dt>قسط 1/3: Tenda F3 Router:</dt>');
});

test('plan568 G1 P5 kist schedule: same prefix translates the schedule shape too', () => {
  const out = applyReceiptScript('<dt>Kist 1/4 · 2026-12:</dt>', 'urdu');
  assert.equal(out, '<dt>قسط 1/4 · 2026-12:</dt>');
});

test('plan568 G1 P6 Hamsaya: prefix translates, contributor name re-attaches verbatim', () => {
  const out = applyReceiptScript('<dt>Hamsaya — Ali:</dt>', 'urdu');
  assert.equal(out, '<dt>ہمسایہ — Ali:</dt>');
});

test('plan568 G1 P7 Asal Customer: prefix translates to اصل گاہک (D3, not اصل کسٹمر)', () => {
  const out = applyReceiptScript('<dt>Asal Customer — Ahmed:</dt>', 'urdu');
  assert.equal(out, '<dt>اصل گاہک — Ahmed:</dt>');
});

test('plan568 G1 P8 arrears offset: prefix translates, month re-attaches verbatim', () => {
  const out = applyReceiptScript('<dt>Arrears offset — 2026-11:</dt>', 'urdu');
  assert.equal(out, '<dt>بقایا تصفیہ — 2026-11:</dt>');
});

test('plan568 G1 P9 bill offset: prefix translates, month re-attaches verbatim', () => {
  const out = applyReceiptScript('<dt>Bill offset — 2026-11:</dt>', 'urdu');
  assert.equal(out, '<dt>بل تصفیہ — 2026-11:</dt>');
});

test('plan568 G1 P10 unrecovered: prefix translates, hardware label re-attaches verbatim', () => {
  const out = applyReceiptScript('<dt>Unrecovered Tenda F3 Router:</dt>', 'urdu');
  assert.equal(out, '<dt>ناقابلِ وصول Tenda F3 Router:</dt>');
});

test('plan568 G1 strong: the <strong> variant translates for ticket, kist and arrears offset', () => {
  assert.equal(
    applyReceiptScript('<dt><strong>Murammat / Material Charge (TKT-101):</strong></dt>', 'urdu'),
    '<dt><strong>مرمت / سامان چارج (TKT-101):</strong></dt>',
  );
  assert.equal(
    applyReceiptScript('<dt><strong>Kist 1/3: Tenda F3 Router:</strong></dt>', 'urdu'),
    '<dt><strong>قسط 1/3: Tenda F3 Router:</strong></dt>',
  );
  assert.equal(
    applyReceiptScript('<dt><strong>Arrears offset — 2026-11:</strong></dt>', 'urdu'),
    '<dt><strong>بقایا تصفیہ — 2026-11:</strong></dt>',
  );
});

/* ---------------- G2 — generated main receipt in Urdu ---------------- */

test('plan568 G2 prepay: thermal rows translate, parenthetical stays verbatim (D4, T5)', () => {
  // A4 prepay is STATIC (567's entry) — the thermal row is 568's.
  assert.ok(!t58Urdu.includes('Prepay Coverage / پیشگی کوریج (3 months'), 'prepay label still Roman on thermal-58');
  assert.ok(t58Urdu.includes('<dt>پیشگی کوریج (3 months · from 2026-11):</dt>'), 'thermal-58 prepay row must read پیشگی کوریج (3 months · from 2026-11):');
  assert.ok(t80Urdu.includes('<dt>پیشگی کوریج (3 months · from 2026-11):</dt>'), 'thermal-80 prepay row must read پیشگی کوریج (3 months · from 2026-11):');
  assert.ok(a4Urdu.includes('<dt>پیشگی کوریج</dt>'), 'A4 prepay label stays the static 567 entry');
});

test('plan568 G2 ticket: Murammat row translates on thermal-58 + A4', () => {
  assert.ok(!t58Urdu.includes('Murammat / Material Charge (TKT-101)'), 'ticket label still Roman on thermal-58');
  assert.ok(!a4Urdu.includes('Murammat / Material Charge (TKT-101)'), 'ticket label still Roman on A4');
  assert.ok(t58Urdu.includes('<dt>مرمت / سامان چارج (TKT-101):</dt>'), 'thermal-58 ticket row must read مرمت / سامان چارج (TKT-101):');
  assert.ok(a4Urdu.includes('<dt>مرمت / سامان چارج (TKT-101)</dt>'), 'A4 ticket row must read مرمت / سامان چارج (TKT-101)');
});

test('plan568 G2 boost: Speed Boost row translates on thermal-58 + A4', () => {
  assert.ok(!t58Urdu.includes('Speed Boost / سپیڈ بوسٹ (BST-7)'), 'boost label still Roman on thermal-58');
  assert.ok(!a4Urdu.includes('Speed Boost / سپیڈ بوسٹ (BST-7)'), 'boost label still Roman on A4');
  assert.ok(t58Urdu.includes('<dt>سپیڈ بوسٹ (BST-7):</dt>'), 'thermal-58 boost row must read سپیڈ بوسٹ (BST-7):');
  assert.ok(a4Urdu.includes('<dt>سپیڈ بوسٹ (BST-7)</dt>'), 'A4 boost row must read سپیڈ بوسٹ (BST-7)');
});

test('plan568 G2 baqaya: Manual Baqaya row translates on thermal-58 + A4', () => {
  assert.ok(!t58Urdu.includes('Manual Baqaya / دستی بقایا (MBQ-3)'), 'baqaya label still Roman on thermal-58');
  assert.ok(!a4Urdu.includes('Manual Baqaya / دستی بقایا (MBQ-3)'), 'baqaya label still Roman on A4');
  assert.ok(t58Urdu.includes('<dt>دستی بقایا (MBQ-3):</dt>'), 'thermal-58 baqaya row must read دستی بقایا (MBQ-3):');
  assert.ok(a4Urdu.includes('<dt>دستی بقایا (MBQ-3)</dt>'), 'A4 baqaya row must read دستی بقایا (MBQ-3)');
});

test('plan568 G2 kist line: Kist 1/3 row translates on thermal-58 + A4 (two colons, T3)', () => {
  assert.ok(!t58Urdu.includes('Kist 1/3: Tenda F3 Router'), 'kist line still Roman on thermal-58');
  assert.ok(!a4Urdu.includes('Kist 1/3: Tenda F3 Router'), 'kist line still Roman on A4');
  assert.ok(t58Urdu.includes('<dt>قسط 1/3: Tenda F3 Router:</dt>'), 'thermal-58 kist line must read قسط 1/3: Tenda F3 Router:');
  assert.ok(a4Urdu.includes('<dt>قسط 1/3: Tenda F3 Router</dt>'), 'A4 kist line must read قسط 1/3: Tenda F3 Router');
});

test('plan568 G2 Hamsaya: contributor row translates on thermal-58 + A4', () => {
  assert.ok(!t58Urdu.includes('Hamsaya — Ali'), 'Hamsaya label still Roman on thermal-58');
  assert.ok(!a4Urdu.includes('Hamsaya — Ali'), 'Hamsaya label still Roman on A4');
  assert.ok(t58Urdu.includes('<dt>ہمسایہ — Ali:</dt>'), 'thermal-58 Hamsaya row must read ہمسایہ — Ali:');
  assert.ok(a4Urdu.includes('<dt>ہمسایہ — Ali</dt>'), 'A4 Hamsaya row must read ہمسایہ — Ali');
});

test('plan568 G2 Asal Customer: main-holder row translates on thermal-58 + A4', () => {
  assert.ok(!t58Urdu.includes('Asal Customer — Ahmed'), 'Asal Customer label still Roman on thermal-58');
  assert.ok(!a4Urdu.includes('Asal Customer — Ahmed'), 'Asal Customer label still Roman on A4');
  assert.ok(t58Urdu.includes('<dt>اصل گاہک — Ahmed:</dt>'), 'thermal-58 Asal row must read اصل گاہک — Ahmed:');
  assert.ok(a4Urdu.includes('<dt>اصل گاہک — Ahmed</dt>'), 'A4 Asal row must read اصل گاہک — Ahmed');
});

test('plan568 G2 F1: bare Kist arrears row translates on thermal-58 (D10)', () => {
  // Thermal-58 passes the BARE label 'Kist' (receipt.js:794); the
  // 'Kist ' prefix rule cannot fix it (T10) — the exact key does.
  assert.ok(!t58Urdu.includes('<dt>Kist:</dt>'), 'bare Kist still Roman on thermal-58');
  assert.ok(t58Urdu.includes('<dt>قسط:</dt>'), 'thermal-58 arrears row must read قسط:');
  assert.ok(t80Urdu.includes('<dt>قسط:</dt>'), 'thermal-80 arrears row must read قسط: (via Kist / قسط)');
  assert.equal(urduReceiptLabel('Kist'), 'قسط');
});

test('plan568 G2 Roman: no-script ≡ script=roman on all three layouts (T13)', () => {
  for (const format of ['a4', 'thermal-58', 'thermal-80']) {
    const plain = generatePaymentReceiptHtml(receipt, { format });
    const roman = generatePaymentReceiptHtml(receipt, { format, script: 'roman' });
    assert.equal(roman, plain, `Roman ${format} must be byte-identical to no-script`);
  }
});

test('plan568 G2 values: IDs/dates/names + prepay parenthetical stay verbatim in Urdu output (T9, D4)', () => {
  for (const fact of ['TKT-101', 'BST-7', 'MBQ-3', '2026-11', 'Ali', 'Ahmed']) {
    assert.ok(t58Urdu.includes(fact), `Urdu thermal-58 must still carry ${fact}`);
    assert.ok(a4Urdu.includes(fact), `Urdu A4 must still carry ${fact}`);
  }
  assert.ok(t58Urdu.includes('(3 months · from 2026-11)'), 'prepay parenthetical must stay verbatim');
  assert.ok(a4Urdu.includes('PKR 4,500 (3 months from 2026-11)'), 'A4 prepay value must stay "PKR 4,500 (3 months from 2026-11)"');
  assert.ok(t58Urdu.includes('Hissa PKR 750 · Ada PKR 750 · Baqi PKR 0'), 'thermal contributor value must stay "Hissa PKR 750 · Ada PKR 750 · Baqi PKR 0"');
});

/* ---------------- G3 — kist / settlement / offset (direct apply, disclosed inert) ---------------- */
// plan378 pattern (T7): the builders take no script option, so the test
// applies the function directly. These prefix rules change NOTHING
// observable in production until Plan 569 wires the option — the PR
// body discloses this exactly as 567 disclosed D2.

test('plan568 G3 kist schedule: Kist 1/4 row translates via direct applyReceiptScript', () => {
  // Paid 2500 ≠ planned 2000, so the Planned row renders (Sharafat 47).
  const html = buildDownPaymentKistReceiptHtml({
    customerName: 'Ahmed', customerId: '12', receiptNumber: 'R-9', verificationCode: 'AB12-CD',
    paymentDate: '2026-11-03', paymentMethod: 'Cash', itemTitle: 'Router',
    totalAmount: 6000, downPayment: 2000, paidDownPayment: 2500,
    monthlyKist: 1000, totalMonths: 4, remainingAfterDownPayment: 3500,
    schedule: [{ installmentNumber: 1, totalMonths: 4, month: '2026-12', amount: 1000, status: 'remaining' }],
    urduNote: 'شکریہ!',
  });
  const urdu = applyReceiptScript(html, 'urdu');
  assert.ok(!urdu.includes('Kist 1/4 · 2026-12'), 'kist schedule label still Roman');
  assert.ok(urdu.includes('<dt>قسط 1/4 · 2026-12:</dt>'), 'kist schedule row must read قسط 1/4 · 2026-12:');
});

test('plan568 G3 settlement arrears offset: row translates via direct applyReceiptScript', () => {
  const html = generateDepositSettlementReceiptHtml({
    customerName: 'Ahmed', customerId: '12', settlementDate: '2026-11-15', receiptNumber: 'R-10',
    securityDeposit: 3000, arrearsOffset: 1000, unrecoveredHardwareCharge: 300, hardwareCovered: 0,
    refundAmount: 2000, arrearsRemaining: 0, hardwareOutstanding: 0,
    offsets: [{ month: '2026-11', amount: 500 }],
    hardwareCharges: [{ label: 'Tenda F3 Router', amount: 300 }],
    status: 'CLEARED', urduNote: 'شکریہ!',
  });
  const urdu = applyReceiptScript(html, 'urdu');
  assert.ok(!urdu.includes('Arrears offset — 2026-11'), 'settlement arrears-offset label still Roman');
  assert.ok(urdu.includes('<dt>بقایا تصفیہ — 2026-11:</dt>'), 'settlement arrears-offset row must read بقایا تصفیہ — 2026-11:');
});

test('plan568 G3 settlement unrecovered: row translates via direct applyReceiptScript', () => {
  const html = generateDepositSettlementReceiptHtml({
    customerName: 'Ahmed', customerId: '12', settlementDate: '2026-11-15', receiptNumber: 'R-10',
    securityDeposit: 3000, arrearsOffset: 1000, unrecoveredHardwareCharge: 300, hardwareCovered: 0,
    refundAmount: 2000, arrearsRemaining: 0, hardwareOutstanding: 0,
    offsets: [{ month: '2026-11', amount: 500 }],
    hardwareCharges: [{ label: 'Tenda F3 Router', amount: 300 }],
    status: 'CLEARED', urduNote: 'شکریہ!',
  });
  const urdu = applyReceiptScript(html, 'urdu');
  assert.ok(!urdu.includes('Unrecovered Tenda F3 Router'), 'settlement unrecovered label still Roman');
  assert.ok(urdu.includes('<dt>ناقابلِ وصول Tenda F3 Router:</dt>'), 'settlement unrecovered row must read ناقابلِ وصول Tenda F3 Router:');
});

test('plan568 G3 offset bill: row translates via direct applyReceiptScript', () => {
  const html = generateDepositOffsetReceiptHtml({
    customerName: 'Ahmed', customerId: '12', offsetId: 'OFF-1', offsetDate: '2026-11-10',
    receiptNumber: 'R-11', amount: 1000, bills: [{ month: '2026-11', amount: 1000 }],
    depositBefore: 3000, depositAfter: 2000, reversed: false, reversedAt: null,
    status: 'OFFSET APPLIED', urduNote: 'شکریہ!',
  });
  const urdu = applyReceiptScript(html, 'urdu');
  assert.ok(!urdu.includes('Bill offset — 2026-11'), 'offset bill label still Roman');
  assert.ok(urdu.includes('<dt>بل تصفیہ — 2026-11:</dt>'), 'offset bill row must read بل تصفیہ — 2026-11:');
});

test('plan568 G3 wiring: the three builders now call applyReceiptScript (wired by Plan 569)', () => {
  // Plan 569 wired the script option into all three builders (D2):
  // the absence-controls above flip to presence-controls here. The
  // intent is unchanged — the wiring belongs to 569, not 568 — and
  // 569's own file owns the behaviour pins (G1). The generated HTML
  // WITHOUT a script option is still Roman (the default is 'roman').
  assert.ok(buildDownPaymentKistReceiptHtml.toString().includes('applyReceiptScript'), 'kist builder must call applyReceiptScript (Plan 569)');
  assert.ok(generateDepositSettlementReceiptHtml.toString().includes('applyReceiptScript'), 'settlement builder must call applyReceiptScript (Plan 569)');
  assert.ok(generateDepositOffsetReceiptHtml.toString().includes('applyReceiptScript'), 'offset builder must call applyReceiptScript (Plan 569)');
  const kist = buildDownPaymentKistReceiptHtml({
    customerName: 'Ahmed', customerId: '12', receiptNumber: 'R-9', verificationCode: 'AB12-CD',
    paymentDate: '2026-11-03', paymentMethod: 'Cash', itemTitle: 'Router',
    totalAmount: 6000, downPayment: 2000, paidDownPayment: 2500,
    monthlyKist: 1000, totalMonths: 4, remainingAfterDownPayment: 3500,
    schedule: [{ installmentNumber: 1, totalMonths: 4, month: '2026-12', amount: 1000, status: 'remaining' }],
    urduNote: 'شکریہ!',
  });
  assert.ok(kist.includes('Kist 1/4 · 2026-12'), 'generated kist HTML still Roman without a script option — the default is roman');
});

test('plan568 G3 values: schedule values + hardware label stay verbatim in the Urdu direct-apply output (T9)', () => {
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

/* ---------------- G4 — guards ---------------- */

test('plan568 G4 exact-first: Kist / قسط and Kist Schedule survive the prefix pass (T2)', () => {
  // The exact pass must run first: both start with 'Kist ' and would
  // be mangled into 'قسط / قسط' / 'قسط Schedule …' if the prefix pass
  // ran first. Regression test — REQUIRED, not optional.
  const out = applyReceiptScript('<dt>Kist / قسط:</dt><dt>Kist Schedule / قسطوں کی تفصیل:</dt>', 'urdu');
  assert.ok(out.includes('<dt>قسط:</dt>'), 'Kist / قسط must translate to قسط:');
  assert.ok(out.includes('<dt>قسطوں کی تفصیل:</dt>'), 'Kist Schedule must translate to قسطوں کی تفصیل:');
  assert.ok(!out.includes('قسط / قسط'), 'prefix pass must not mangle Kist / قسط');
  assert.ok(!out.includes('قسط Schedule'), 'prefix pass must not mangle Kist Schedule');
});

test('plan568 G4 history: date rows unchanged, heading stays Roman (D6, D7)', () => {
  assert.ok(a4Urdu.includes('<dt>2026-10-03:</dt>'), 'A4 history date must stay "2026-10-03:"');
  assert.ok(t58Urdu.includes('<dt>2026-10-03:</dt>'), 'thermal history date must stay "2026-10-03:"');
  assert.ok(t58Urdu.includes('<dt><strong>Last 3 Payments / پچھلی 3 ادائیگیاں</strong></dt>'), 'history heading stays Roman (left out by 567 D6, still out by 568 D6)');
});

test('plan568 G4 static: the exact-match mechanism still translates static labels (A10 controls)', () => {
  assert.ok(a4Urdu.includes('<dt>علاقہ</dt>'), 'A4 Area must still translate');
  assert.ok(!a4Urdu.includes('Area / علاقہ'), 'A4 Area must not stay Roman');
  assert.ok(a4Urdu.includes('<dt>تاریخ</dt>'), 'A4 history-head Date must still translate');
  assert.ok(t80Urdu.includes('قسط'), 'thermal-80 arrears Kist / قسط must still translate');
});

test('plan568 G4 parity: EN/UR stays 4,669/4,669 — the prefix table adds no i18n keys', () => {
  // Plan 582 (D1(b)): re-pinned 4,675 → 4,669 — six orphan
  // dash_tile_collect_*/dash_tile_closing_* keys deleted.
  // Plan 584: +38 ledger_filter_* keys — parity 4,669 → 4,707/4,707.
  // Plan 585: +16 global_search_* keys — parity 4,707 → 4,723/4,723.
  // Plan 586: drawer_settings deleted (dead key) — parity 4,723 → 4,722/4,722.
  assert.equal(Object.keys(TRANSLATIONS.en).length, 5195, 'EN key count moved');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 5195, 'UR key count moved');
  const en = Object.keys(TRANSLATIONS.en).sort();
  const ur = Object.keys(TRANSLATIONS.ur).sort();
  assert.deepEqual(en, ur, 'the two languages must carry exactly the same keys');
});

test('plan568 G4 sizes: map 110 → 111 keys (F1 only), prefix table 10 pairs longest-first', () => {
  assert.equal(Object.keys(RECEIPT_URDU_LABELS).length, 111, 'the map must hold exactly the 110 old + 1 new (bare Kist) keys');
  assert.equal(RECEIPT_URDU_LABELS.Kist, 'قسط', 'the bare Kist key must map to قسط');
  assert.equal(RECEIPT_URDU_PREFIXES.length, 10, 'the prefix table must hold exactly 10 pairs');
  for (const [prefix, urdu] of RECEIPT_URDU_PREFIXES) {
    assert.equal(typeof prefix, 'string');
    assert.equal(typeof urdu, 'string');
    assert.ok(prefix.length > 0 && urdu.length > 0);
  }
  const lengths = RECEIPT_URDU_PREFIXES.map(([prefix]) => prefix.length);
  const sorted = [...lengths].sort((a, b) => b - a);
  assert.deepEqual(lengths, sorted, 'the prefix table must be ordered longest-first');
});
