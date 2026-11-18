/**
 * plan576-qc-image-receipt-tax-ver-overflow.test.js — Plan 576: the Quick
 * Collect canvas image receipt shows the sales-tax row and the VER code,
 * and the name / method / paid-by fields stay inside the canvas.
 *
 * Parent decisions (2026-11-18, D1–D9 all (a)):
 *  - D1(a): both new rows in the existing whitespace, canvas stays
 *    600x540, NO row moves — tax at y=336 (the 315–350 gap), VER at
 *    y=400 (the 375–420 gap). The tax y is 336, not 338: the bilingual
 *    label's Urdu descenders hang ~4px below the baseline and the grid
 *    labels' ascenders rise to ~y341, so 336 keeps 1px clear where 338
 *    would touch.
 *  - D2(a): "ordinary short receipt is visually unchanged" is redefined
 *    as "every existing row keeps its exact text + coordinates; the
 *    ordinary receipt gains ONLY the VER row (no tax row when untaxed)".
 *  - D3(a): tax label = the bilingual SALES_TAX_RECEIPT_LABEL
 *    ('Sales tax / سیلز ٹیکس (19.5%)') — this surface already prints
 *    Urdu, so the bilingual label matches the canvas.
 *  - D4(a): VER is derived INSIDE generateReceiptImageBlob — the
 *    receipt.js:724 pattern — from the GENERATED REC-… receipt number,
 *    NOT the QC receipt's RCPT-… display number. Deriving from RCPT-…
 *    prints a code that does NOT match the profile reprint's code for
 *    the same payment (proven by probe in Plan 575's D7 correction —
 *    the reprint derives its number via generateReceiptNumber,
 *    receipt.js:329). customerId is the CUSTOMER NUMBER (T7 — the QC
 *    receipt's customerId is the internal id). A split image carries NO
 *    combined VER row — VER is per-leg (Plan 575 D6).
 *  - D5(a): TRUNCATE with ellipsis via measureText, single line each,
 *    existing y-coords kept (wrapping the name has no free slot: a
 *    second line at y≈197 collides with the account line at y=202).
 *  - D6(a): account line + Txn ID are OUT (named follow-ups, not this
 *    PR) — so the G5 width sweep EXCLUDES the account line (y202) and
 *    the Txn ID line (y442, x30) by decision, and no test asserts them.
 *  - D7(a): package line is OUT (named follow-up).
 *  - D8(a): this new file (the 551/555/566–575 pattern).
 *  - D9(a): rendered-PNG visual check required before merge (unit
 *    tests prove the clamp logic under a stub measure, not the pixels).
 *
 * Harness: the 565/566 imageFills shape (fake document + recording
 * canvas capturing every fillText(text, x, y) + the font in force),
 * PLUS a stub measureText with the repro's deterministic per-char
 * model (monospace 0.60, bold 0.58, regular/italic 0.52, non-Latin
 * 0.62 of the font size) — the real-browser widths are proven by the
 * D9 rendered check, not by the stub (prep T10).
 *
 * Fixtures (synthetic data only; pattern-fake 03012345678 phone):
 *  - ordinary: short receipt, untaxed, no VER carried — gains ONLY the
 *    VER row (D2(a)).
 *  - taxed: salesTaxCents 58500 (PKR 585) — shows the tax row.
 *  - withVer: verificationCode 'AZQV-RX' carried — prints it verbatim.
 *  - qcShaped: exactly what executeQuickCollection hands the image
 *    path (salesTaxCents yes, verificationCode NO, customerId the
 *    internal id, paymentId + month present) — prints the derived VER,
 *    equal to the profile reprint's code for the same stored payment.
 *  - split: the caller's split imageReceipt shape (spread activeReceipt
 *    + split total + joined methods + first leg's TID + splitTender
 *    combined object) — shows the COMBINED tax, no VER row.
 *  - long name / long method / long paid-by: the overflow trio.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateReceiptImageBlob } from '../nav-quick-collect.js';
import { buildPaymentReceipt } from '../receipt.js';
import { receiptCodeForReceipt, verifyReceiptCode } from '../receipt-verifier.js';
import { SALES_TAX_RECEIPT_LABEL } from '../package-sales-tax.js';

// --- Fake document + recording canvas (565/566 harness + stub measureText) ---

function estimateWidth(text, font) {
  const size = Number((/(\d+)px/.exec(font || '') || [])[1] || 13);
  const mono = /monospace/.test(font || '');
  const bold = /bold/.test(font || '');
  let w = 0;
  for (const ch of String(text)) {
    const f = ch.codePointAt(0) > 127 ? 0.62 : mono ? 0.6 : bold ? 0.58 : 0.52;
    w += size * f;
  }
  return w;
}

async function imageFills(receipt) {
  const fills = [];
  const ctx = {
    fillStyle: '', font: '',
    fillText: (text, x, y) => fills.push({ text: String(text), x, y, font: ctx.font }),
    fillRect: () => {}, strokeRect: () => {}, beginPath: () => {},
    moveTo: () => {}, lineTo: () => {}, stroke: () => {},
    measureText: (t) => ({ width: estimateWidth(t, ctx.font) }),
  };
  const canvas = {
    width: 0, height: 0, getContext: () => ctx,
    toBlob: (cb) => cb({ type: 'image/png' }),
  };
  const origDocument = globalThis.document;
  globalThis.document = { createElement: () => canvas };
  try {
    const blob = await generateReceiptImageBlob(receipt);
    return { blob, fills, width: canvas.width, height: canvas.height };
  } finally {
    globalThis.document = origDocument;
  }
}

const endX = (f) => f.x + estimateWidth(f.text, f.font);
const fillAt = (fills, x, y) => fills.find((f) => f.x === x && f.y === y);
const fillWith = (fills, re) => fills.find((f) => re.test(f.text));

// --- Fixtures (synthetic data only) ---

const ordinary = {
  id: 'receipt-576', receiptNumber: 'RCPT-576-202611-01',
  paymentId: 'pay-576-001',
  customerName: 'Synthetic Customer', customerNumber: 42,
  date: '2026-11-07', month: '2026-11', method: 'Cash',
  area: 'Charyaa', phone: '03012345678', amount: 3000,
  payableRemaining: 0, newTotalDues: 0, newBalanceDue: 0,
};
const taxed = { ...ordinary, salesTaxCents: 58500 };
const withVer = { ...ordinary, verificationCode: 'AZQV-RX' };
// QC-shaped: exactly what executeQuickCollection hands the image path —
// salesTaxCents yes, verificationCode NO, customerId the internal id.
const qcShaped = {
  ...taxed, customerId: 'synthetic-customer', transactionId: 'TXN-9876543210',
};
// Split: the caller's split imageReceipt shape — spread activeReceipt +
// split total + joined methods + first leg's TID + the combined object.
// The combined tax (117000, two taxed bills) differs from leg 2's own
// tax (58500) on purpose: the image must read the COMBINED sum.
const splitReceipt = {
  ...qcShaped,
  amount: 6000,
  method: 'Cash + JazzCash',
  transactionId: 'TXN-1111111111',
  splitTender: {
    totalReceived: 6000,
    salesTaxCents: 117000,
    legs: [
      { leg: 1, method: 'Cash', amount: 3000, transactionId: 'TXN-1111111111' },
      { leg: 2, method: 'JazzCash', amount: 3000, transactionId: 'TXN-2222222222' },
    ],
  },
};
const longName = { ...ordinary, customerName: 'Synthetic Customer With A Very Long Name That Keeps Going And Going' };
const longMethod = { ...ordinary, method: 'Cash + JazzCash + EasyPaisa' };
const longPaidBy = { ...ordinary, transactionId: 'TXN-9876543210', paidBy: 'Muhammad Ahmed Raza Khan Sherwani' };
const longPaidByAlone = { ...ordinary, paidBy: 'Muhammad Ahmed Raza Khan Sherwani' };

// The profile reprint for the same stored payment as qcShaped — the
// D4(a) acceptance is that the image VER EQUALS this code.
function reprintForQcShaped() {
  const payment = { id: qcShaped.paymentId, amount: qcShaped.amount, date: qcShaped.date };
  const bill = { id: 'bill-2026-11', month: qcShaped.month, dueAmount: 3000, status: 'pending', payments: [payment] };
  const customer = {
    id: 'c-576', customerNumber: qcShaped.customerNumber, name: 'Synthetic Customer',
    mohalla: 'Charyaa', packageSpeed: '3 Mbps / 100GB', packageHistory: [], bills: [bill],
  };
  return buildPaymentReceipt(customer, bill, payment);
}

/* ---------------- G1 — the tax row ---------------- */

test('plan576 G1: taxed image receipt shows the tax row with the exact bilingual label at y336', async () => {
  const { fills } = await imageFills(taxed);
  const label = fillAt(fills, 30, 336);
  assert.ok(label, `no tax label fill at (30,336): ${JSON.stringify(fills)}`);
  assert.equal(label.text, SALES_TAX_RECEIPT_LABEL, 'tax label is the bilingual SALES_TAX_RECEIPT_LABEL, pinned exactly (D3(a))');
  assert.equal(SALES_TAX_RECEIPT_LABEL, 'Sales tax / سیلز ٹیکس (19.5%)', 'label value pinned, never by substring');
  const value = fillAt(fills, 420, 336);
  assert.ok(value, `no tax value fill at (420,336): ${JSON.stringify(fills)}`);
  assert.equal(value.text, 'PKR 585', 'tax figure is PKR 585 (58500 cents / 100)');
});

test('plan576 G1: untaxed image receipt shows no tax row', async () => {
  const { fills } = await imageFills(ordinary);
  assert.equal(fillWith(fills, /[Ss]ales tax/), undefined, JSON.stringify(fills));
});

test('plan576 G1: zero-tax image receipt shows no tax row (Plan 552 gate)', async () => {
  const { fills } = await imageFills({ ...ordinary, salesTaxCents: 0 });
  assert.equal(fillWith(fills, /[Ss]ales tax/), undefined, JSON.stringify(fills));
});

test('plan576 G1: split image receipt shows the COMBINED tax, never one leg\'s figure', async () => {
  const { fills } = await imageFills(splitReceipt);
  const value = fillAt(fills, 420, 336);
  assert.ok(value, `no tax value fill at (420,336): ${JSON.stringify(fills)}`);
  // The combined distinct-bill sum is 117000 (PKR 1,170); leg 2's own
  // figure is 58500 (PKR 585) — reading the leg would understate it.
  assert.equal(value.text, 'PKR 1,170', 'split tax is the combined distinct-bill sum (Plan 557)');
});

/* ---------------- G2 — the VER row ---------------- */

test('plan576 G2: receipt carrying verificationCode prints it verbatim at y400', async () => {
  const { fills } = await imageFills(withVer);
  const ver = fillAt(fills, 30, 400);
  assert.ok(ver, `no VER fill at (30,400): ${JSON.stringify(fills)}`);
  assert.equal(ver.text, 'VER: AZQV-RX', 'carried code prints verbatim');
});

test('plan576 G2: QC-shaped receipt prints the derived VER, equal to the profile reprint\'s code', async () => {
  const { fills } = await imageFills(qcShaped);
  const ver = fillAt(fills, 30, 400);
  assert.ok(ver, `no VER fill at (30,400): ${JSON.stringify(fills)}`);
  const reprint = reprintForQcShaped();
  assert.equal(ver.text, `VER: ${reprint.verificationCode}`,
    `image VER must equal the profile reprint's code for the same payment (D4(a)) — printed ${ver.text}, reprint VER: ${reprint.verificationCode}`);
  const code = (ver.text.match(/[A-Z0-9]{4}-[A-Z0-9]{2}/) || [])[0];
  assert.ok(code, 'VER fill carries a code');
  assert.ok(verifyReceiptCode(code, {
    receiptId: reprint.receiptNumber, customerId: String(qcShaped.customerNumber),
    amountPaid: qcShaped.amount, date: qcShaped.date,
  }), 'printed code verifies against the reprint\'s own facts');
});

test('plan576 G2: the printed VER is NOT the code derived from the RCPT-… display number (575 D7 trap)', async () => {
  const { fills } = await imageFills(qcShaped);
  const ver = fillAt(fills, 30, 400);
  assert.ok(ver, `no VER fill at (30,400): ${JSON.stringify(fills)}`);
  // Deriving from the QC receipt's RCPT-… display number prints a code
  // that does NOT match the reprint (575's probe: RCPT derivation
  // Z1SJ-Y0 vs reprint XZ2R-TP). The image must derive from the
  // generated REC-… number instead.
  const rcptDerived = receiptCodeForReceipt({
    receiptNumber: qcShaped.receiptNumber, customerId: String(qcShaped.customerNumber),
    paidAmount: qcShaped.amount, paymentDate: qcShaped.date,
  });
  assert.notEqual(ver.text, `VER: ${rcptDerived}`,
    'image VER must differ from the RCPT-derived code — that code fails verification against the reprint');
});

test('plan576 G2: split image receipt carries NO combined VER row', async () => {
  const { fills } = await imageFills(splitReceipt);
  assert.equal(fillWith(fills, /VER:/), undefined,
    'VER is per-leg on a split (the Bluetooth slip carries the per-leg stamps, Plan 575 D6); the split amount is the combined total, so no single leg\'s code verifies the receipt as shown');
});

/* ---------------- G3 — the overflow clamps ---------------- */

test('plan576 G3: long customer name is truncated with an ellipsis inside x=570', async () => {
  const { fills } = await imageFills(longName);
  const name = fillAt(fills, 30, 175);
  assert.ok(name, `no name fill at (30,175): ${JSON.stringify(fills)}`);
  assert.ok(endX(name) <= 570, `long name ends x≈${Math.round(endX(name))}, past the edge: ${JSON.stringify(name)}`);
  assert.ok(name.text.endsWith('…'), `truncation must end with an ellipsis, not a silent cut: ${JSON.stringify(name.text)}`);
  assert.ok(name.text.startsWith('Synthetic Customer With A Very Long'), 'truncation keeps the start of the name');
});

test('plan576 G3: long joined method is truncated with an ellipsis before the Month column', async () => {
  const { fills } = await imageFills(longMethod);
  const method = fillAt(fills, 30, 375);
  assert.ok(method, `no method fill at (30,375): ${JSON.stringify(fills)}`);
  assert.ok(endX(method) < 230, `long method ends x≈${Math.round(endX(method))}, into the Month column at 230: ${JSON.stringify(method)}`);
  assert.ok(method.text.endsWith('…'), `truncation must end with an ellipsis: ${JSON.stringify(method.text)}`);
});

test('plan576 G3: long paid-by is truncated with an ellipsis inside x=570, with and without a TID', async () => {
  const withTid = await imageFills(longPaidBy);
  const paidBy = fillWith(withTid.fills, /Paid by:/);
  assert.ok(paidBy, `no Paid by fill: ${JSON.stringify(withTid.fills)}`);
  assert.equal(paidBy.x, 320, 'paid-by sits at x=320 when a TID exists');
  assert.ok(endX(paidBy) <= 570, `long paid-by ends x≈${Math.round(endX(paidBy))}, past the edge: ${JSON.stringify(paidBy)}`);
  assert.ok(paidBy.text.endsWith('…'), `truncation must end with an ellipsis: ${JSON.stringify(paidBy.text)}`);
  // The same name WITHOUT a TID sits at x=30 with a 540px budget, so it
  // fits untruncated (284px) — no ellipsis is the CORRECT behaviour
  // there; the alone-branch clamp is proven by the very long name below.
  const alone = await imageFills(longPaidByAlone);
  const paidByAlone = fillWith(alone.fills, /Paid by:/);
  assert.ok(paidByAlone, `no Paid by fill without a TID: ${JSON.stringify(alone.fills)}`);
  assert.equal(paidByAlone.x, 30, 'paid-by alone sits at x=30');
  assert.equal(paidByAlone.text, 'Paid by: Muhammad Ahmed Raza Khan Sherwani', 'a name that fits is NOT truncated');
  assert.ok(endX(paidByAlone) <= 570, `paid-by alone ends x≈${Math.round(endX(paidByAlone))}: ${JSON.stringify(paidByAlone)}`);
  const veryLongAlone = await imageFills({ ...ordinary, paidBy: 'Muhammad Ahmed Raza Khan Sherwani Abbasi Chaudhry Raja Faisal Mehmood Khan' });
  const paidByVeryLong = fillWith(veryLongAlone.fills, /Paid by:/);
  assert.ok(paidByVeryLong, `no Paid by fill for the very long name: ${JSON.stringify(veryLongAlone.fills)}`);
  assert.equal(paidByVeryLong.x, 30, 'very long paid-by alone sits at x=30');
  assert.ok(endX(paidByVeryLong) <= 570, `very long paid-by alone ends x≈${Math.round(endX(paidByVeryLong))}: ${JSON.stringify(paidByVeryLong)}`);
  assert.ok(paidByVeryLong.text.endsWith('…'), `very long paid-by alone must truncate with an ellipsis: ${JSON.stringify(paidByVeryLong.text)}`);
});

/* ---------------- G4 — the ordinary receipt (D2(a)) ---------------- */

test('plan576 G4: ordinary short receipt keeps every existing row at its exact text + coordinates', async () => {
  const { fills, width, height } = await imageFills(ordinary);
  assert.equal(width, 600, 'canvas stays 600 wide');
  assert.equal(height, 540, 'canvas stays 540 tall');
  assert.equal(fillAt(fills, 420, 375)?.text, 'PKR 0', 'balance stays at (420,375)');
  assert.match(fillAt(fills, 30, 420)?.text || '', /Bill settled in full/, 'status stays at (30,420)');
  assert.equal(fillAt(fills, 30, 175)?.text, 'Synthetic Customer', 'name stays at (30,175)');
  assert.equal(fillAt(fills, 30, 375)?.text, 'Cash', 'method stays at (30,375)');
  assert.equal(fillAt(fills, 230, 375)?.text, '2026-11', 'month stays at (230,375)');
  assert.equal(fillWith(fills, /[Ss]ales tax/), undefined, 'no tax fill when untaxed');
});

test('plan576 G4: ordinary short receipt gains ONLY the VER row', async () => {
  const { fills } = await imageFills(ordinary);
  // The base renders 16 fills; the ordinary receipt gains exactly one —
  // the VER row at y400 — and nothing else moves or appears.
  assert.equal(fills.length, 17, `ordinary receipt must gain exactly one fill (the VER row): ${JSON.stringify(fills)}`);
  const ver = fillAt(fills, 30, 400);
  assert.ok(ver, `the one new fill is the VER row at (30,400): ${JSON.stringify(fills)}`);
  assert.match(ver.text, /^VER: [A-Z0-9]{4}-[A-Z0-9]{2}$/, 'VER stamp format');
});

/* ---------------- G5 — row placement + width ---------------- */

test('plan576 G5: the new rows sit in the decided slots (tax y336, VER y400)', async () => {
  const { fills } = await imageFills(taxed);
  assert.ok(fillAt(fills, 30, 336), `tax label at y336 (the 315–350 gap): ${JSON.stringify(fills)}`);
  assert.ok(fillAt(fills, 420, 336), `tax value at y336: ${JSON.stringify(fills)}`);
  assert.ok(fillAt(fills, 30, 400), `VER stamp at y400 (the 375–420 gap): ${JSON.stringify(fills)}`);
  // No existing row moved: the grid labels are still y350, the values
  // y375, the status y420, the Txn line y442, the footer y495.
  assert.ok(fillAt(fills, 30, 350), 'grid labels still at y350');
  assert.ok(fillAt(fills, 30, 375), 'grid values still at y375');
  assert.ok(fillAt(fills, 30, 420), 'status still at y420');
  assert.ok(fillAt(fills, 30, 495), 'footer still at y495');
});

test('plan576 G5: every fill on every fixture ends inside x=570 — except the D6(a) follow-ups', async () => {
  const fixtures = [ordinary, taxed, withVer, qcShaped, splitReceipt, longName, longMethod, longPaidBy, longPaidByAlone];
  for (const receipt of fixtures) {
    const { fills } = await imageFills(receipt);
    for (const f of fills) {
      // D6(a): the account line (y202) and the Txn ID line (y442, x30)
      // are OUT of this PR as named follow-ups — they are the only two
      // fills allowed past the edge, and only on absurd fixtures.
      if (f.y === 202 || (f.y === 442 && f.x === 30 && f.text.startsWith('Txn ID:'))) continue;
      assert.ok(endX(f) <= 570,
        `fill past the edge on ${receipt.customerName || receipt.method}: [${f.x},${f.y}] ${JSON.stringify(f.text)} ends x≈${Math.round(endX(f))}`);
    }
  }
});
