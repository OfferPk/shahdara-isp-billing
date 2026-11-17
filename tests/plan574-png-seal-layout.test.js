// Plan 574: the PNG seal sits below the financial box, clear of every
// figure. Pure-function tests on synthetic data only (stub canvas, no
// browser). Sharafat 53 put the seal over the box's bottom-right corner
// BY DESIGN ("like a real rubber stamp"); the stamp crossed Amount
// Paid, Payment Method and Remaining Balance, and its label text
// crossed wide values. Plan 574 moves it below the box (cy = box
// bottom + 168) with a 402px clearance band (was 210px): the 336px
// seal diameter, the 42px tallest first-content glyph, and 24px of
// air. These tests pin the geometry: the seal RING (not just its
// every financial value on every fixture, under BOTH measures.
//
// Fixtures + helpers are copied from the Plan 574 repro (repro-574.mjs)
// so the tests and the repro assert the same geometry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPaymentReceipt } from '../receipt.js';
import {
  PNG_RECEIPT_WIDTH,
  PNG_RECEIPT_HEIGHT,
  buildPngReceiptModel,
  computePngReceiptLayout,
  decideSeal,
} from '../png-receipt.js';

const ISSUED_AT = '2026-11-07T10:00:00.000Z';
const DEFAULT_MEASURE = (t) => t.length * 24;
const STUB_MEASURE = (t) => t.length * 20;
const SEAL_ROTATE = -0.21; // renderPngReceipt rotates the seal by -0.21 rad
const normWs = (s) => String(s).replace(/\s+/g, ' ');

// --- Fixtures (synthetic data only, real buildPaymentReceipt path) ---
function digitalFixture() {
  const payment = {
    id: 'pay-long', amount: 3000, date: '2026-11-07', method: 'JazzCash',
    transactionId: 'TXN-98765432109876543210',
    senderTitle: 'Muhammad Ahmed Khan Abbasi',
    senderDigits: '03001234567',
    paidBy: 'Raja Muhammad Shafique Ahmed Khan',
  };
  const bill = { id: 'bill-2026-11', month: '2026-11', dueAmount: 3000, status: 'pending', payments: [payment] };
  const customer = {
    id: 'c-long', customerNumber: 42, name: 'Synthetic Customer', nameUrdu: 'راجہ فیصل',
    mohalla: 'Shahdara Town', zone: 'Barrian', packageSpeed: '10 Mbps',
    packageHistory: [], bills: [bill],
  };
  return { customer, bill, payment };
}
const LONG_SENDER = 'Muhammad Ahmed Khan Abbasi Chaudhry Malik Gondal Bhatti Rajpoot Awan Sheikh Mughal Syed Shah Gilani Qureshi';
const LONG_PAYER = 'Raja Muhammad Shafique Ahmed Khan Abbasi Chaudhry Malik Gondal Bhatti Rajpoot Awan Sheikh Mughal Syed Shah';
function capLengthFixture() {
  const f = digitalFixture();
  f.payment = {
    id: 'pay-cap', amount: 4000, date: '2026-11-07', method: 'Easypaisa',
    transactionId: 'TXN-12345678901234567890',
    senderTitle: LONG_SENDER, senderDigits: '03001234567', paidBy: LONG_PAYER,
  };
  f.bill = { id: 'bill-2026-11', month: '2026-11', dueAmount: 4000, status: 'pending', payments: [f.payment] };
  f.customer.bills = [f.bill];
  return f;
}
function cashFixture() {
  const payment = { id: 'pay-full', amount: 3000, date: '2026-10-05', method: 'Cash' };
  const bill = { id: 'bill-2026-10', month: '2026-10', dueAmount: 3000, status: 'pending', payments: [payment] };
  const customer = {
    id: 'synthetic-customer', customerNumber: 42, name: 'Test Customer 34', nameUrdu: 'راجہ فیصل',
    mohalla: 'Shahdara Town', zone: 'Barrian', packageSpeed: '10 Mbps',
    packageHistory: [], bills: [bill],
  };
  return { customer, bill, payment };
}
function wideRemainingFixture() {
  const payment = { id: 'pay-part', amount: 2500, date: '2026-11-07', method: 'Cash' };
  const bill = { id: 'bill-2026-11', month: '2026-11', dueAmount: 15000, status: 'pending', payments: [payment] };
  const customer = {
    id: 'c-wide', customerNumber: 42, name: 'Test Customer 34', nameUrdu: 'راجہ فیصل',
    mohalla: 'Shahdara Town', zone: 'Barrian', packageSpeed: '10 Mbps',
    packageHistory: [], bills: [bill],
  };
  return { customer, bill, payment };
}
const FOOTER = {
  footerText: 'شکریہ! بل ہر مہینے کی 5 تاریخ تک ادا کریں۔\nDuaon mai yaad rakhain.',
  easypaisaNumber: '03450001122', nayapayNumber: '03450003344',
  helplineWhatsapp: '03001112233',
  shopsText: 'Synthetic Shop A — Main Bazaar\nSynthetic Shop B — Station Road',
};
function maximalFixture() {
  const augPay = { id: 'pay-aug', amount: 3000, date: '2026-08-05', method: 'Cash', receiptNumber: 'SIP-101' };
  const sepPay = { id: 'pay-sep', amount: 500, date: '2026-09-05', method: 'Cash', receiptNumber: 'SIP-102' };
  const payment = {
    id: 'pay-max', amount: 4000, date: '2026-11-07', method: 'Easypaisa',
    transactionId: 'TXN-12345678901234567890',
    senderTitle: 'Muhammad Ahmed Khan Abbasi', senderDigits: '03001234567',
    paidBy: 'Raja Muhammad Shafique Ahmed Khan',
    ticketCharges: [{ ticketId: 'TKT-101', amount: 500 }],
    addonCharges: [{ boostId: 'BST-101', amount: 300 }],
    manualBaqayaSettlements: [{ entryId: 'MBQ-101', amount: 200 }],
  };
  const bill = {
    id: 'bill-2026-11', month: '2026-11', dueAmount: 4000, status: 'pending',
    payments: [payment],
    kistLines: [{ planId: 'plan-1', installmentNumber: 1, totalMonths: 3, amount: 1000, itemTitle: 'Tenda F3 Router' }],
  };
  const customer = {
    id: 'c-max', customerNumber: 7, name: 'Synthetic Customer', nameUrdu: 'راجہ فیصل',
    mohalla: 'Palaliya', zone: '', packageSpeed: '10 Mbps', packageHistory: [],
    bills: [
      { id: 'bill-2026-08', month: '2026-08', dueAmount: 3000, status: 'paid', payments: [augPay] },
      { id: 'bill-2026-09', month: '2026-09', dueAmount: 500, status: 'pending', payments: [sepPay] },
      bill,
    ],
  };
  const receipt = buildPaymentReceipt(customer, bill, payment);
  receipt.advanceCredit = { applied: 1000, remaining: 500 };
  receipt.remainderWaada = { promiseAmount: 500, promiseDate: '2026-11-20' };
  return { customer, bill, payment, receipt };
}
function buildModel(fixture, options = {}) {
  const receipt = fixture.receipt ?? buildPaymentReceipt(fixture.customer, fixture.bill, fixture.payment);
  return buildPngReceiptModel(receipt, fixture.customer, { issuedAt: ISSUED_AT, ...options });
}

// --- Geometry helpers (same shapes as sharafat-53-png-row-wrap.test.js) ---
function textBounds(cmd, measure) {
  const w = measure(cmd.text);
  if (cmd.align === 'right') return [cmd.x - w, cmd.x];
  if (cmd.align === 'center') return [cmd.x - w / 2, cmd.x + w / 2];
  return [cmd.x, cmd.x + w];
}
// Text vertical box: alphabetic baseline at cmd.y; font size parsed from cmd.font.
function textBox(cmd, measure) {
  const [lo, hi] = textBounds(cmd, measure);
  const size = parseInt(/(\d+)px/.exec(cmd.font)?.[1] ?? '42', 10);
  return { x0: lo, x1: hi, y0: cmd.y - size, y1: cmd.y };
}
function circleRectOverlap(cx, cy, r, box) {
  const nx = Math.max(box.x0, Math.min(cx, box.x1));
  const ny = Math.max(box.y0, Math.min(cy, box.y1));
  return Math.hypot(cx - nx, cy - ny) < r;
}
function rectsIntersect(a, b) {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}
// All value-line commands of one financial row (a wrapped row has several
// right-aligned lines stacked below the label's first line).
function valueCmdsOf(layout, model, labelStart) {
  const texts = layout.commands.filter((c) => c.type === 'text');
  const labelCmd = texts.find((c) => c.text.startsWith(labelStart));
  if (!labelCmd) return [];
  const idx = model.financial.findIndex((r) => r.label.startsWith(labelStart));
  const next = model.financial[idx + 1];
  const nextY = next
    ? Math.min(...texts.filter((c) => c.align === 'left' && c.x === 124 && c.y > labelCmd.y && next.label.startsWith(c.text)).map((c) => c.y))
    : Infinity;
  return texts
    .filter((c) => c.align === 'right' && c.x === PNG_RECEIPT_WIDTH - 80 - 44 && c.y >= labelCmd.y && c.y < nextY)
    .sort((a, b) => a.y - b.y);
}
// The financial box rect: the only rect below the header accent bar.
function finBoxOf(layout) {
  return layout.commands.filter((c) => c.type === 'rect').reduce((a, b) => (b.y > a.y ? b : a));
}
// Seal label/urdu/sub text boxes as axis-aligned boxes around the ROTATED
// text (renderPngReceipt draws the seal rotated -0.21 rad about its
// centre): rotate each corner, then take min/max. Widths use the passed
// measure fn (a proxy for the real canvas measure, same as the 53 tests);
// heights are the render font sizes (label 52px, urdu 56px, sub 34px).
function sealTextBoxes(seal, measure) {
  const cos = Math.cos(SEAL_ROTATE);
  const sin = Math.sin(SEAL_ROTATE);
  const parts = [
    { text: seal.label, y: seal.urdu ? -18 : 18, size: 52 },
    ...(seal.urdu ? [{ text: seal.urdu, y: 52, size: 56 }] : []),
    { text: seal.sub, y: seal.urdu ? 104 : 72, size: 34 },
  ];
  return parts.map(({ text, y, size }) => {
    const w = measure(text);
    const corners = [
      [-w / 2, y - size], [w / 2, y - size],
      [-w / 2, y], [w / 2, y],
    ].map(([dx, dy]) => ({
      x: seal.cx + dx * cos - dy * sin,
      y: seal.cy + dx * sin + dy * cos,
    }));
    return {
      text,
      x0: Math.min(...corners.map((p) => p.x)),
      x1: Math.max(...corners.map((p) => p.x)),
      y0: Math.min(...corners.map((p) => p.y)),
      y1: Math.max(...corners.map((p) => p.y)),
    };
  });
}
function assertNoOverlapOrOffCanvas(layout, measure, tag) {
  const texts = layout.commands.filter((c) => c.type === 'text');
  for (const cmd of texts) {
    const [lo, hi] = textBounds(cmd, measure);
    assert.ok(lo >= 0 && hi <= PNG_RECEIPT_WIDTH,
      `${tag}: off-canvas text ${JSON.stringify(cmd.text.slice(0, 40))} [${Math.round(lo)}, ${Math.round(hi)}]`);
  }
  const byY = new Map();
  for (const cmd of texts) {
    if (!byY.has(cmd.y)) byY.set(cmd.y, []);
    byY.get(cmd.y).push(cmd);
  }
  for (const [y, row] of byY) {
    for (let i = 0; i < row.length; i++) {
      for (let j = i + 1; j < row.length; j++) {
        const [aLo, aHi] = textBounds(row[i], measure);
        const [bLo, bHi] = textBounds(row[j], measure);
        assert.ok(!(aLo < bHi && bLo < aHi),
          `${tag}: overlap at y=${y}: ${JSON.stringify(row[i].text.slice(0, 30))} vs ${JSON.stringify(row[j].text.slice(0, 30))}`);
      }
    }
  }
  assert.ok(layout.footerY <= layout.height, `${tag}: footerY ${layout.footerY} past height ${layout.height}`);
}

// --- G1: the seal ring clears every financial value (both measures) ---
// The outer ring (r=168) contains the inner ring (r=146), so clearing
// the outer ring clears the whole stamp. Labels are left-aligned and
// end at x<=844, far left of the seal's x-span [1092,1428] — the ring
// can only reach the right-aligned values, which is what this pins.
for (const [name, fixture] of [
  ['ordinary cash', cashFixture()],
  ['digital long-method', digitalFixture()],
  ['cap-length method', capLengthFixture()],
  ['wide Remaining', wideRemainingFixture()],
  ['maximal', maximalFixture()],
]) {
  test(`plan574 G1 seal ring clears every financial value: ${name}`, () => {
    const model = name === 'maximal'
      ? buildModel(fixture, { receiptFooter: FOOTER })
      : buildModel(fixture);
    for (const measure of [DEFAULT_MEASURE, STUB_MEASURE]) {
      const layout = computePngReceiptLayout(model, measure);
      const seal = layout.commands.find((c) => c.type === 'seal');
      assert.ok(seal, 'seal command present');
      for (const row of model.financial) {
        for (const cmd of valueCmdsOf(layout, model, row.label.slice(0, 12))) {
          const box = textBox(cmd, measure);
          assert.ok(!circleRectOverlap(seal.cx, seal.cy, seal.r, box),
            `${name}: seal ring crosses ${row.label} value ${JSON.stringify(cmd.text)} box x[${Math.round(box.x0)},${Math.round(box.x1)}] y[${Math.round(box.y0)},${Math.round(box.y1)}]`);
        }
      }
      // Stronger: no text command at all sits under the ring.
      for (const cmd of layout.commands.filter((c) => c.type === 'text')) {
        assert.ok(!circleRectOverlap(seal.cx, seal.cy, seal.r, textBox(cmd, measure)),
          `${name}: seal ring crosses text ${JSON.stringify(cmd.text.slice(0, 40))}`);
      }
    }
  });
}

// --- G2: the seal's label/urdu/sub text clears every value ---
// Pre-fix the 'PARTIAL PAID' label text itself crossed a wide Remaining
// value (repro C5); the ring alone is not the whole stamp.
for (const [name, fixture] of [
  ['ordinary cash (PAID label)', cashFixture()],
  ['wide Remaining (PARTIAL PAID label)', wideRemainingFixture()],
]) {
  test(`plan574 G2 seal label text clears every financial value: ${name}`, () => {
    const model = buildModel(fixture);
    for (const measure of [DEFAULT_MEASURE, STUB_MEASURE]) {
      const layout = computePngReceiptLayout(model, measure);
      const seal = layout.commands.find((c) => c.type === 'seal');
      const boxes = sealTextBoxes(seal, measure);
      for (const row of model.financial) {
        for (const cmd of valueCmdsOf(layout, model, row.label.slice(0, 12))) {
          const valueBox = textBox(cmd, measure);
          for (const sealBox of boxes) {
            assert.ok(!rectsIntersect(sealBox, valueBox),
              `${name}: seal ${JSON.stringify(sealBox.text)} text crosses ${row.label} value ${JSON.stringify(cmd.text)}`);
          }
        }
      }
    }
  });
}

// --- G3: the seal is still visible and still the seal ---
test('plan574 G3 seal present, kind/label/color unchanged, inside the canvas, below the box', () => {
  for (const [name, fixture, kind, color] of [
    ['cash', cashFixture(), 'PAID', '#1a7a3c'],
    ['wide Remaining', wideRemainingFixture(), 'PARTIAL', '#b7791f'],
  ]) {
    const model = buildModel(fixture);
    const layout = computePngReceiptLayout(model);
    const seal = layout.commands.find((c) => c.type === 'seal');
    assert.ok(seal, `${name}: seal command present`);
    assert.equal(seal.label, kind === 'PAID' ? 'PAID' : 'PARTIAL PAID', `${name}: label`);
    assert.equal(seal.color, color, `${name}: color`);
    assert.equal(seal.r, 168, `${name}: radius unchanged`);
    assert.ok(seal.cx - seal.r >= 0 && seal.cx + seal.r <= PNG_RECEIPT_WIDTH, `${name}: seal inside the width`);
    assert.ok(seal.cy - seal.r >= 0 && seal.cy + seal.r <= layout.height, `${name}: seal inside the height`);
    const boxBottom = finBoxOf(layout).y + finBoxOf(layout).h;
    assert.equal(seal.cy, boxBottom + 168, `${name}: seal centre is one radius below the box bottom`);
    assert.equal(seal.cy - seal.r, boxBottom, `${name}: seal top edge sits exactly on the box bottom`);
    // The model agrees: decideSeal picks the same kind for this receipt.
    const receipt = fixture.receipt ?? buildPaymentReceipt(fixture.customer, fixture.bill, fixture.payment);
    assert.equal(decideSeal(receipt).kind, kind, `${name}: decideSeal kind`);
  }
  // VOID maps red through decideSeal (no layout needed — the kind mapping is the pin).
  assert.deepEqual(
    decideSeal({ status: 'VOID', balanceDueCents: 0 }),
    { kind: 'VOID', label: 'VOID', urdu: '', sub: 'Shahdara ISP', color: '#a11d1d' });
});

// --- G4: the Sharafat-53 wrap + canvas growth survive the seal move ---
test('plan574 G4 long-method and cap-length values still wrap whole with no overlap', () => {
  for (const [name, fixture] of [
    ['digital long-method', digitalFixture()],
    ['cap-length method', capLengthFixture()],
  ]) {
    const model = buildModel(fixture);
    const row = model.financial.find((r) => r.label.startsWith('Payment Method'));
    for (const measure of [DEFAULT_MEASURE, STUB_MEASURE]) {
      const layout = computePngReceiptLayout(model, measure);
      assertNoOverlapOrOffCanvas(layout, measure, `${name}`);
      const lines = valueCmdsOf(layout, model, 'Payment Method').map((c) => c.text);
      assert.ok(lines.length > 1, `${name}: method value should wrap, got ${lines.length} line(s)`);
      assert.equal(normWs(lines.join(' ')), normWs(row.value), `${name}: wrapped lines join back to the model value`);
    }
  }
});
test('plan574 G4 no-history maximal still renders its Issued line inside the canvas', () => {
  const f = maximalFixture();
  f.receipt.previousPayments = [];
  const model = buildModel(f);
  assert.equal(model.history.length, 0);
  const layout = computePngReceiptLayout(model);
  const issued = layout.commands.find((c) => c.type === 'text' && c.text.startsWith('Issued:'));
  assert.ok(issued, 'Issued line drawn');
  assert.ok(issued.y + 24 <= layout.height && layout.footerY <= layout.height,
    `Issued y=${issued.y} inside canvas height=${layout.height}`);
  assert.ok(layout.height > PNG_RECEIPT_HEIGHT, `canvas grew past 2000, got ${layout.height}`);
});

// --- G5: the height consequence of the below-box placement ---
test('plan574 G5 ordinary receipt grows by the seal band: footerY +192, height 2142, footer inside', () => {
  const model = buildModel(cashFixture());
  const layout = computePngReceiptLayout(model);
  // footerY is y-based, so it grows by exactly the band (1926 -> 2118).
  assert.equal(layout.footerY, 2118);
  // The height is max(model.height, y + 24): the 2000px model height
  // absorbs most of the band, so only 142px shows (2142, not 2192).
  // The model height itself is unchanged (Plan 574 is layout-only).
  assert.equal(model.height, PNG_RECEIPT_HEIGHT);
  assert.equal(layout.height, 2142);
  assert.ok(layout.footerY <= layout.height, `footerY ${layout.footerY} inside canvas`);
  // The band is 402px: the 336px seal diameter, the 42px tallest
  // first-content glyph (the footer note is 42px), and 24px of air.
  // The seal top sits exactly on the box bottom, the seal bottom is
  // 336px below it, and the first content's baseline lands 402px
  // below the box bottom — its glyph tops 24px below the seal's
  // bottom edge, so no text after the box begins above the seal.
  const boxBottom = finBoxOf(layout).y + finBoxOf(layout).h;
  const seal = layout.commands.find((c) => c.type === 'seal');
  assert.equal(seal.cy - seal.r, boxBottom);
  assert.equal(seal.cy + seal.r, boxBottom + 336);
  const afterBox = layout.commands.filter((c) => c.type === 'text' && c.y > boxBottom);
  assert.ok(afterBox.length > 0, 'content follows the seal band');
  assert.equal(Math.min(...afterBox.map((c) => c.y)), boxBottom + 402,
    'first content baseline is exactly one 402px seal band below the box');
  assert.ok(Math.min(...afterBox.map((c) => c.y)) - 42 >= seal.cy + seal.r,
    'first content glyph tops clear the seal bottom edge');
});
