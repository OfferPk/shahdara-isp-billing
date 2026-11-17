/**
 * plan573-png-total-due.test.js — Plan 573: PNG slip shows the Total Due row
 * (parent decisions D1–D10, 2026-11-18; see ~/workspace/plan-573-prep.md).
 *
 * SCOPE (all D(a) except D6(b)): one financial row — `Total Due /
 * Kul Qabil-e-Ada` (D1(a)), `strong: true` (D2(a)), gated on `if
 * (breakdown)` (D3(a)) — inserted between the last charge row and Amount
 * Paid; this NEW file (D4(a)); the six existing pins updated in place
 * with why-comments (D5(a)); the T6 disclosure pinned where it holds
 * AND where it does not (D6(b)); tallReceipt gains totalDue (D7(a));
 * layout grows by exactly one finPitch (D8(a)); e2e left alone (D9(a));
 * model.height stays 2000 (D10(a)).
 * Files changed: png-receipt.js + this file + png-receipt.test.js +
 * sharafat-53-png-row-wrap.test.js + advance-payment.test.js +
 * receipt-mini-history.test.js (fixture only).
 *
 * D6 DISCLOSURE — Paid + Remaining = Total does NOT hold on arrears
 * fixtures, on the PNG or on the HTML (Paid 3,000 + Remaining 0 = 3,000
 * against Total Due 3,500 on the arrears fixture, because Remaining is
 * the receipt's per-bill net balance while Total Due spans arrears +
 * current bill). The acceptance is equality with the HTML figure, not
 * the identity — nothing is recomputed to force it (T6).
 * T1 — the row sits after the manual-baqaya loop, immediately before
 * Amount Paid; not after Previous Balance, not after Remaining Balance.
 * T5 — the value is breakdown.totalDue verbatim through money(); never
 * a sum of the displayed rows, never net of the waivers.
 * T7 — hand-made breakdowns without a totalDue key render '—'; the
 * real builder always sets it (the tallReceipt fixture gains it, D7(a)).
 * T8 — one row = one finPitch (74px) of layout growth; model.height
 * stays 2000 (footer lines only). Plan 574 owns model-height questions.
 * T11 — SISP-91 collapse is identical for Roman labels (english ->
 * Latin half, urdu -> whole label).
 *
 * Fixtures (synthetic data only; generic name Synthetic Customer;
 * pattern-fake IDs only): copied from repro-573.mjs, verbatim.
 * F1 arrears: Sep bill PKR 500 unpaid + Oct bill PKR 3,000 paid in full
 * -> breakdown totalDue 3500, paidAmount 3000, balanceDueCents 0.
 * F2 charges: kist + ticket + addon + manual baqaya (placement).
 * F3 no-breakdown: unpriced bill (dueAmount 0) -> breakdown null.
 * F4 single-bill: one priced bill, no arrears, no waivers (D6 identity).
 * F5 fractional arrears: Sep bill PKR 500.50 unpaid (fractional total).
 *
 * Groups: G1 row exists (3) + G2 HTML equality, looped over 3 layouts
 * (1) + G3 placement (2) + G4 canvas consequence (3) + G5 language +
 * money (2) + G6 identity where it holds / exception where it does
 * not (2) = 13 tests.
 * Expected suite: 20,402 + 13 = 20,415/0.
 * Build dist 23. Parity 4,675/4,675 (no new i18n keys).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import {
  buildPngReceiptModel,
  computePngReceiptLayout,
  PNG_RECEIPT_HEIGHT,
  PNG_RECEIPT_WIDTH,
} from '../png-receipt.js';

const TOTAL_DUE_LABEL = 'Total Due / Kul Qabil-e-Ada';
const totalDueRowOf = (model) => model.financial.find((row) => row.label === TOTAL_DUE_LABEL);
const rowValueOf = (model, labelStart) => {
  const row = model.financial.find((r) => r.label.startsWith(labelStart));
  return row ? row.value : undefined;
};
// Row values read 'PKR 3,500' — strip to a plain number for arithmetic.
const numOf = (value) => Number(String(value ?? '').replace(/[^0-9.]/g, ''));
const kulOf = (html) => {
  const m = html.match(/Kul Qabil-e-Ada[^<]*<\/dt><dd[^>]*>([^<]*)<\/dd>/);
  return m ? m[1] : null;
};

// ---- Fixtures (repro-573.mjs, verbatim) ----
// F1: arrears — Sep bill 500 unpaid, Oct bill 3000 paid in full.
const sepBill = { id: 'bill-2026-09', month: '2026-09', dueAmount: 500, status: 'pending', payments: [] };
const paymentF1 = { id: 'pay-oct', amount: 3000, date: '2026-10-05', method: 'Cash' };
const billF1 = { id: 'bill-2026-10', month: '2026-10', dueAmount: 3000, status: 'pending', payments: [paymentF1] };
const customerF1 = { id: 'c1', customerNumber: 42, name: 'Synthetic Customer', packageSpeed: '10 Mbps', packageHistory: [], bills: [sepBill, billF1] };
const receiptF1 = buildPaymentReceipt(customerF1, billF1, paymentF1);
const modelF1 = buildPngReceiptModel(receiptF1, customerF1);

// F2: charges — kist + ticket + addon + manual baqaya (placement).
const paymentF2 = {
  id: 'pay-max', amount: 4000, date: '2026-11-07', method: 'Easypaisa',
  transactionId: 'TXN-12345678901234567890',
  ticketCharges: [{ ticketId: 'TKT-101', amount: 500 }],
  addonCharges: [{ boostId: 'BST-101', amount: 300 }],
  manualBaqayaSettlements: [{ entryId: 'MBQ-101', amount: 200 }],
};
const billF2 = {
  id: 'bill-2026-11', month: '2026-11', dueAmount: 4000, status: 'pending', payments: [paymentF2],
  kistLines: [{ planId: 'plan-1', installmentNumber: 1, totalMonths: 3, amount: 1000, itemTitle: 'Tenda F3 Router' }],
};
const customerF2 = { id: 'c-max', customerNumber: 7, name: 'Synthetic Customer', mohalla: 'Palaliya', zone: '', packageSpeed: '10 Mbps', packageHistory: [], bills: [billF2] };
const receiptF2 = buildPaymentReceipt(customerF2, billF2, paymentF2);
const modelF2 = buildPngReceiptModel(receiptF2, customerF2);

// F3: no-breakdown control — unpriced bill => arrearsBreakdown null.
const paymentF3 = { id: 'pay-0', amount: 3000, date: '2026-10-05', method: 'Cash' };
const billF3 = { id: 'bill-2026-10', month: '2026-10', dueAmount: 0, status: 'pending', payments: [paymentF3] };
const customerF3 = { id: 'c1', customerNumber: 42, name: 'Synthetic Customer', packageSpeed: '10 Mbps', packageHistory: [], bills: [billF3] };
const receiptF3 = buildPaymentReceipt(customerF3, billF3, paymentF3);
const modelF3 = buildPngReceiptModel(receiptF3, customerF3);

// F4: waiver-free single bill — the one shape where Paid + Remaining = Total.
const paymentF4 = { id: 'pay-single', amount: 3000, date: '2026-10-05', method: 'Cash' };
const billF4 = { id: 'bill-2026-10', month: '2026-10', dueAmount: 3000, status: 'pending', payments: [paymentF4] };
const customerF4 = { id: 'c1', customerNumber: 42, name: 'Synthetic Customer', packageSpeed: '10 Mbps', packageHistory: [], bills: [billF4] };
const receiptF4 = buildPaymentReceipt(customerF4, billF4, paymentF4);
const modelF4 = buildPngReceiptModel(receiptF4, customerF4);

// F5: fractional arrears — Sep bill PKR 500.50 unpaid => totalDue 3500.50.
const sepBillF5 = { id: 'bill-2026-09', month: '2026-09', dueAmount: 500.50, status: 'pending', payments: [] };
const paymentF5 = { id: 'pay-oct', amount: 3000, date: '2026-10-05', method: 'Cash' };
const billF5 = { id: 'bill-2026-10', month: '2026-10', dueAmount: 3000, status: 'pending', payments: [paymentF5] };
const customerF5 = { id: 'c1', customerNumber: 42, name: 'Synthetic Customer', packageSpeed: '10 Mbps', packageHistory: [], bills: [sepBillF5, billF5] };
const receiptF5 = buildPaymentReceipt(customerF5, billF5, paymentF5);
const modelF5 = buildPngReceiptModel(receiptF5, customerF5);

// Kist fixture (repro-573.mjs group D1) — the +74 layout-growth witness.
const kistPayment = { id: 'pay-kist', amount: 4000, date: '2026-10-05', method: 'EasyPaisa', transactionId: 'TID123456' };
const kistBill = { id: 'bill-2026-10', month: '2026-10', dueAmount: 4000, status: 'pending', payments: [kistPayment],
  kistLines: [{ planId: 'plan-1', installmentNumber: 1, totalMonths: 3, amount: 1000, itemTitle: 'Tenda F3 Router' }] };
const kistCustomer = { id: 'synthetic-customer', customerNumber: 7, name: 'AHMED KHAN', mohalla: 'Palaliya', zone: '', packageSpeed: '10 Mbps', packageHistory: [], bills: [kistBill] };
const kistModel = buildPngReceiptModel(buildPaymentReceipt(kistCustomer, kistBill, kistPayment), kistCustomer);
const kistLayout = computePngReceiptLayout(kistModel);

/* ---------------- G1 — the row exists and reads the breakdown ---------------- */

test('plan573 G1 row exists: a breakdown model carries the Total Due row, strong, with the breakdown value (D1(a)/D2(a)/D3(a))', () => {
  const row = totalDueRowOf(modelF1);
  assert.ok(row, 'the PNG financial box must carry a Total Due row when a breakdown exists');
  assert.equal(row.label, TOTAL_DUE_LABEL, 'the row label must be Total Due / Kul Qabil-e-Ada');
  assert.equal(row.value, 'PKR 3,500', 'the row value must read breakdown.totalDue verbatim through money()');
  assert.equal(row.strong, true, 'the total row must be strong, like Amount Paid and Remaining Balance');
  assert.equal(receiptF1.arrearsBreakdown.totalDue, 3500, 'the fixture must carry totalDue 3500 (3000 + 500)');
});

test('plan573 G1 value is verbatim: the row reads breakdown.totalDue, never a recomputation (T5)', () => {
  assert.equal(totalDueRowOf(modelF1).value, 'PKR 3,500');
  assert.equal(totalDueRowOf(modelF2).value, 'PKR 4,000', 'the charges fixture totalDue is its own dueAmount (4000) + zero arrears');
  assert.equal(receiptF2.arrearsBreakdown.totalDue, 4000, 'the fixture must carry totalDue 4000');
});

test('plan573 G1 absent without a breakdown: an unpriced bill carries no Total Due row (D3(a), T13)', () => {
  assert.equal(receiptF3.arrearsBreakdown, null, 'the unpriced bill must yield no breakdown');
  assert.equal(totalDueRowOf(modelF3), undefined, 'a no-breakdown slip must carry no Total Due row');
  assert.deepEqual(modelF3.financial.map((row) => row.label), [
    'Current Month Bill / Mahana Package', 'Amount Paid / Wusool Paya',
    'Payment Method / طریقہ', 'Remaining Balance / Baqi Rehta',
  ], 'the no-breakdown slip rows are exactly the four known rows, unchanged');
});

/* ---------------- G2 — equality with the HTML receipt ---------------- */

test('plan573 G2 HTML equality: the PNG Total Due equals Kul Qabil-e-Ada on all three layouts (repro A2)', () => {
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const html = generatePaymentReceiptHtml(receiptF1, { format });
    assert.equal(kulOf(html), 'PKR 3,500', `the ${format} receipt must print Kul Qabil-e-Ada PKR 3,500`);
    assert.equal(totalDueRowOf(modelF1).value, kulOf(html),
      `the PNG Total Due must equal the ${format} Kul Qabil-e-Ada on the same fixture`);
  }
});

/* ---------------- G3 — placement ---------------- */

test('plan573 G3 placement on the charges fixture: the row sits after the last charge and immediately before Amount Paid (T1)', () => {
  const labels = modelF2.financial.map((row) => row.label);
  const totalIdx = labels.indexOf(TOTAL_DUE_LABEL);
  const paidIdx = labels.findIndex((l) => l.startsWith('Amount Paid'));
  const lastChargeIdx = Math.max(
    labels.findIndex((l) => l.includes('MBQ-101')),
    labels.findIndex((l) => l.includes('BST-101')),
    labels.findIndex((l) => l.includes('TKT-101')),
  );
  assert.ok(totalIdx >= 0, 'the charges fixture must carry the Total Due row');
  assert.equal(totalIdx, lastChargeIdx + 1, 'the row must sit immediately after the last charge row');
  assert.equal(totalIdx, paidIdx - 1, 'the row must sit immediately before Amount Paid');
});

test('plan573 G3 placement on the plain arrears fixture: the row sits immediately before Amount Paid', () => {
  const labels = modelF1.financial.map((row) => row.label);
  const totalIdx = labels.indexOf(TOTAL_DUE_LABEL);
  const paidIdx = labels.findIndex((l) => l.startsWith('Amount Paid'));
  assert.equal(totalIdx, paidIdx - 1, 'the row must sit immediately before Amount Paid');
  assert.ok(labels.indexOf('Previous Balance / Sabiqa Baqaya') < totalIdx,
    'the row must sit below Previous Balance, not above the rows it summarises');
});

/* ---------------- G4 — canvas consequence (the Plan 574 boundary) ---------------- */

test('plan573 G4 layout grows by exactly one finPitch: footerY +74, height follows, footer inside (D8(a)/T8)', () => {
  // Pre-fix the kist fixture pinned height 2024 / footerY 2000
  // (png-receipt.test.js); one extra financial row is one finPitch
  // (74px), so post-fix the footer sits 74px lower and the layout
  // height follows it exactly.
  // Plan 574: the seal clearance band grows the layout by a further
  // 192px (402px band, was 210px) — the kist footer sits at 2266 and
  // the layout at 2290. The +74 row growth is unchanged; the band is
  // the only new growth, and the footer still stays inside the canvas.
  assert.equal(kistLayout.footerY, 2266, 'the kist footerY must grow by exactly one finPitch (2000 + 74) plus the Plan 574 seal band (192)');
  assert.equal(kistLayout.height, 2290, 'the kist layout height must grow by exactly one finPitch (2024 + 74) plus the Plan 574 seal band (192)');
  assert.ok(kistLayout.footerY <= kistLayout.height, 'the footer must stay inside the grown canvas');
  for (const cmd of kistLayout.commands) {
    if (cmd.type === 'text') {
      assert.ok(cmd.y >= 0 && cmd.y <= kistLayout.height, 'every text command must stay inside the grown canvas');
    }
  }
});

test('plan573 G4 model height stays 2000 for an ordinary breakdown receipt (D10(a))', () => {
  assert.equal(modelF1.height, 2000, 'the row grows the LAYOUT, not the model — model.height stays 2000');
  assert.equal(modelF4.height, 2000, 'the single-bill model height stays 2000 too');
});

test('plan573 G4 no-breakdown layout keeps the exact 1600x2000 canvas', () => {
  const layoutF3 = computePngReceiptLayout(modelF3);
  assert.equal(layoutF3.width, PNG_RECEIPT_WIDTH, 'the no-breakdown layout keeps width 1600');
  assert.equal(layoutF3.height, PNG_RECEIPT_HEIGHT, 'the no-breakdown layout keeps height 2000');
  assert.ok(layoutF3.footerY <= PNG_RECEIPT_HEIGHT, 'the no-breakdown footer stays inside the canvas');
});

/* ---------------- G5 — language + money guards ---------------- */

test('plan573 G5 SISP-91: the Roman label collapses like Previous Balance (T11)', () => {
  // The finder must match by the Latin half: under 'english' the label
  // collapses to 'Total Due', so the exact bilingual label is gone.
  const byLatinHalf = (model) => model.financial.find((row) => row.label.startsWith('Total Due'));
  const urduModel = buildPngReceiptModel(receiptF1, { ...customerF1, preferredReceiptLang: 'urdu' });
  assert.equal(byLatinHalf(urduModel).label, TOTAL_DUE_LABEL,
    'Urdu preference keeps the whole Roman label (no Arabic-script segment to keep)');
  const englishModel = buildPngReceiptModel(receiptF1, { ...customerF1, preferredReceiptLang: 'english' });
  assert.equal(byLatinHalf(englishModel).label, 'Total Due',
    'English preference collapses to the Latin half, like Previous Balance');
  assert.equal(byLatinHalf(englishModel).value, 'PKR 3,500', 'the figure is unchanged by language');
});

test('plan573 G5 fractional: a fractional totalDue reads with two decimals through the shared formatter', () => {
  assert.equal(receiptF5.arrearsBreakdown.totalDue, 3500.50, 'the fractional fixture must carry totalDue 3500.50');
  assert.equal(totalDueRowOf(modelF5).value, 'PKR 3,500.50',
    'the row value must read PKR 3,500.50 — the shared min-0/max-2 format, never a rounded PKR 3,501');
  const a4 = generatePaymentReceiptHtml(receiptF5, { format: 'a4' });
  assert.equal(kulOf(a4), 'PKR 3,500.50', 'the HTML receipt shows the same fractional figure');
});

/* ---------------- G6 — the D6 identity, where it holds and where it does not ---------------- */

test('plan573 G6 identity holds: on a waiver-free single bill, Paid + Remaining = Total Due (D6(b))', () => {
  assert.equal(receiptF4.arrearsBreakdown.previousArrears, 0, 'the fixture must carry no arrears');
  assert.equal(receiptF4.arrearsBreakdown.totalDue, 3000, 'the fixture totalDue must be 3000');
  const paid = numOf(rowValueOf(modelF4, 'Amount Paid'));
  const remaining = numOf(rowValueOf(modelF4, 'Remaining Balance'));
  const total = numOf(totalDueRowOf(modelF4).value);
  assert.equal(paid, 3000, 'Paid must be 3000');
  assert.equal(remaining, 0, 'Remaining must be 0 on a fully paid bill');
  assert.equal(paid + remaining, total, 'Paid + Remaining must equal Total Due on a waiver-free single bill');
});

test('plan573 G6 arrears exception: on the arrears fixture the identity does NOT hold — and the HTML prints the same three figures (D6(b)/T6)', () => {
  const paid = numOf(rowValueOf(modelF1, 'Amount Paid'));
  const remaining = numOf(rowValueOf(modelF1, 'Remaining Balance'));
  const total = numOf(totalDueRowOf(modelF1).value);
  assert.equal(paid, 3000, 'Paid must be 3000');
  assert.equal(remaining, 0, 'Remaining must be 0 — the per-bill net balance, this bill is settled');
  assert.equal(total, 3500, 'Total Due must be 3500 — arrears + current bill');
  assert.notEqual(paid + remaining, total,
    'Paid + Remaining (3000) must NOT equal Total Due (3500): Remaining is the per-bill net balance, Total spans arrears + current bill');
  // The HTML prints the same three figures, so the identity fails there
  // too — the acceptance is equality with the HTML figure, not the identity.
  const a4 = generatePaymentReceiptHtml(receiptF1, { format: 'a4' });
  assert.equal(kulOf(a4), 'PKR 3,500', 'the HTML Kul Qabil-e-Ada is the same 3500');
  assert.ok(a4.includes('PKR 3,000'), 'the HTML Wusool Paya is the same 3000');
  assert.ok(a4.includes('PKR 0'), 'the HTML Baqi Rehta is the same 0');
});
