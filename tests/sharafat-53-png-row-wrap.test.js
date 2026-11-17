// Sharafat 53: PNG slip financial rows wrap instead of colliding.
// Pure-function tests on synthetic data only (stub canvas, no browser).
// The layout draws every financial label left-aligned and its value
// right-aligned at fixed x with no wrap — a long method value (Txn +
// sender + payer) ran 1,644px off the left edge, and a long label
// collided with its own value. The fix pre-passes every financial row
// through wrapText (measuring BOTH sides) and grows the row — and the
// canvas — by the wrapped line count.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildPaymentReceipt } from '../receipt.js';
import {
  PNG_RECEIPT_WIDTH,
  PNG_RECEIPT_HEIGHT,
  buildPngReceiptModel,
  computePngReceiptLayout,
} from '../png-receipt.js';

// Fixed issuedAt: the Issued line carries the current minute, so a
// commands hash is only reproducible with a fixed timestamp.
const ISSUED_AT = '2026-11-07T10:00:00.000Z';
const DEFAULT_MEASURE = (t) => t.length * 24;
const STUB_MEASURE = (t) => t.length * 20;

// Bounds under a measure fn: left-aligned text spans [x, x+w],
// right-aligned [x-w, x], centred [x-w/2, x+w/2]. Text commands only —
// the seal sits below the financial box (Plan 574 moved it there from
// the Sharafat-53 BY-DESIGN overlap), so seal commands are never part
// of the no-overlap assertion here; the seal-vs-value checks live in
// tests/plan574-png-seal-layout.test.js.
function textBounds(cmd, measure) {
  const w = measure(cmd.text);
  if (cmd.align === 'right') return [cmd.x - w, cmd.x];
  if (cmd.align === 'center') return [cmd.x - w / 2, cmd.x + w / 2];
  return [cmd.x, cmd.x + w];
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
          `${tag}: overlap at y=${y}: ${JSON.stringify(row[i].text.slice(0, 30))} [${Math.round(aLo)}, ${Math.round(aHi)}] vs ${JSON.stringify(row[j].text.slice(0, 30))} [${Math.round(bLo)}, ${Math.round(bHi)}]`);
      }
    }
  }
  assert.ok(layout.footerY <= layout.height, `${tag}: footerY ${layout.footerY} past layout height ${layout.height}`);
}

// wrapText splits on whitespace runs, so a wrapped value normalizes
// runs of spaces to one — the sender label can carry a double space
// (the 100-char sender cap slices the title mid-word, leaving a
// trailing space before ' (…4567)'). Compare whitespace-normalized:
// every word must still be present, in order.
const normWs = (s) => String(s).replace(/\s+/g, ' ');

// Row-boundary helper: the y of the NEXT financial row's label, found
// from the model (the next row's first label line is a prefix of its
// label). A wrapped row's own continuation lines share its y-range, so
// the boundary must come from the model, not from "the next text below".
function nextRowLabelY(layout, model, labelStart) {
  const texts = layout.commands.filter((c) => c.type === 'text');
  const idx = model.financial.findIndex((r) => r.label.startsWith(labelStart));
  assert.ok(idx >= 0, `row ${labelStart} not found`);
  const labelCmd = texts.find((c) => c.text.startsWith(labelStart));
  assert.ok(labelCmd, `label ${labelStart} not found`);
  const next = model.financial[idx + 1];
  if (!next) return Infinity;
  const candidates = texts.filter((c) =>
    c.align === 'left' && c.x === 124 && c.y > labelCmd.y
    && next.label.startsWith(c.text) && c.text.length > 0);
  assert.ok(candidates.length, `next row label ${next.label.slice(0, 20)} not found`);
  return Math.min(...candidates.map((c) => c.y));
}

// The wrapped label lines of the row whose label starts with `labelStart`:
// left-aligned texts at x=124 between this row's label y and the next
// financial row's label y. Joining them with ' ' must reproduce the
// model's label whole.
function wrappedLabelLines(layout, model, labelStart) {
  const texts = layout.commands.filter((c) => c.type === 'text');
  const labelCmd = texts.find((c) => c.text.startsWith(labelStart));
  assert.ok(labelCmd, `label ${labelStart} not found`);
  const labelY = labelCmd.y;
  const nextLabelY = nextRowLabelY(layout, model, labelStart);
  return texts
    .filter((c) => c.align === 'left' && c.x === 124 && c.y >= labelY && c.y < nextLabelY)
    .sort((a, b) => a.y - b.y)
    .map((c) => c.text);
}

// The wrapped value lines of the row whose label starts with `labelStart`:
// right-aligned texts at x=1476 between this row's label y and the next
// financial row's label y. Joining them with ' ' must reproduce the
// model's value whole — the wrap never truncates.
function wrappedValueLines(layout, model, labelStart) {
  const texts = layout.commands.filter((c) => c.type === 'text');
  const labelCmd = texts.find((c) => c.text.startsWith(labelStart));
  assert.ok(labelCmd, `label ${labelStart} not found`);
  const labelY = labelCmd.y;
  const nextLabelY = nextRowLabelY(layout, model, labelStart);
  return texts
    .filter((c) => c.align === 'right' && c.x === PNG_RECEIPT_WIDTH - 80 - 44 && c.y >= labelY && c.y < nextLabelY)
    .sort((a, b) => a.y - b.y)
    .map((c) => c.text);
}

function modelHash(model, layout) {
  return createHash('sha256')
    .update(JSON.stringify({ financial: model.financial, commands: layout.commands, height: layout.height }))
    .digest('hex');
}

function paidFixture() {
  const payment = { id: 'pay-full', amount: 3000, date: '2026-10-05', method: 'Cash' };
  const bill = { id: 'bill-2026-10', month: '2026-10', dueAmount: 3000, status: 'pending', payments: [payment] };
  const customer = {
    id: 'synthetic-customer', customerNumber: 42, name: 'Test Customer 34', nameUrdu: 'راجہ فیصل',
    mohalla: 'Shahdara Town', zone: 'Barrian', packageSpeed: '10 Mbps',
    packageHistory: [], bills: [bill],
  };
  return { customer, bill, payment };
}

// The doc's acceptance case: JazzCash + 26-char Txn + 27-char sender +
// 36-char payer = a 130-char method value.
function longMethodFixture() {
  const payment = {
    id: 'pay-long', amount: 3000, date: '2026-11-07', method: 'JazzCash',
    transactionId: 'TXN-98765432109876543210',
    senderTitle: 'Muhammad Ahmed Khan Abbasi',
    senderDigits: '03001234567',
    paidBy: 'Raja Muhammad Shafique Ahmed Khan',
  };
  const bill = { id: 'bill-2026-11', month: '2026-11', dueAmount: 3000, status: 'pending', payments: [payment] };
  const customer = {
    id: 'c-long', customerNumber: 42, name: 'Test Customer 34', nameUrdu: 'راجہ فیصل',
    mohalla: 'Shahdara Town', zone: 'Barrian', packageSpeed: '10 Mbps',
    packageHistory: [], bills: [bill],
  };
  return { customer, bill, payment };
}

// Cap-length names: sender and payer both 100 chars (the caps in
// core.js:2571 / transaction-payer-name.js) — the worst case the
// layout must survive, ~250 chars of method value.
const LONG_SENDER = 'Muhammad Ahmed Khan Abbasi Chaudhry Malik Gondal Bhatti Rajpoot Awan Sheikh Mughal Syed Shah Gilani Qureshi';
const LONG_PAYER = 'Raja Muhammad Shafique Ahmed Khan Abbasi Chaudhry Malik Gondal Bhatti Rajpoot Awan Sheikh Mughal Syed Shah';

function capLengthFixture() {
  const payment = {
    id: 'pay-cap', amount: 4000, date: '2026-11-07', method: 'Easypaisa',
    transactionId: 'TXN-12345678901234567890',
    senderTitle: LONG_SENDER,
    senderDigits: '03001234567',
    paidBy: LONG_PAYER,
  };
  const bill = { id: 'bill-2026-11', month: '2026-11', dueAmount: 4000, status: 'pending', payments: [payment] };
  const customer = {
    id: 'c-cap', customerNumber: 7, name: 'Test Customer 34', nameUrdu: 'راجہ فیصل',
    mohalla: 'Shahdara Town', zone: 'Barrian', packageSpeed: '10 Mbps',
    packageHistory: [], bills: [bill],
  };
  return { customer, bill, payment };
}

function buildModel(fixture, options = {}) {
  const receipt = buildPaymentReceipt(fixture.customer, fixture.bill, fixture.payment);
  return buildPngReceiptModel(receipt, fixture.customer, { issuedAt: ISSUED_AT, ...options });
}

test('ordinary cash receipt is byte-identical (fixed issuedAt)', (t) => {
  const model = buildModel(paidFixture());
  const layout = computePngReceiptLayout(model);
  assert.equal(layout.width, PNG_RECEIPT_WIDTH);
  // Plan 574: the seal clearance band grows the layout — the height is
  // max(model.height, y + 24), so only 142px of the 192px band shows
  // past the 2000px model height on this receipt (2142, not 2192),
  // and the footer sits 192px lower (1926 -> 2118). Measured.
  assert.equal(layout.height, 2142);
  // Plan 573: the new Total Due row adds one finPitch (74px) below the
  // financial box, so the footer sits 74px lower (1852 -> 1926) and the
  // box carries six rows instead of five; the canvas height stays 2000
  // because the grown footer (1926 + 24) still fits the old foot.
  assert.equal(layout.footerY, 2118);
  assert.equal(model.financial.length, 6);
  // The hash is pinned with a FIXED issuedAt: the Issued line carries the
  // current minute, so the repro's live hash changes every minute and
  // cannot be pinned as-is (the prep's fe1c233c… was one minute's value).
  // Plan 573: any model change re-pins the hash — Sharafat 53 did the
  // same when it first pinned it; the new value is the post-fix model.
  // Plan 574: the seal move re-pins the hash again — the seal command
  // is part of layout.commands, so ANY seal move changes it. The
  // acceptance is redefined (D2(a)): all commands EXCEPT the seal are
  // byte-identical (height, footerY, length and the hash shape are all
  // pinned here; the seal's own position is pinned in
  // tests/plan574-png-seal-layout.test.js). The hash pin stays, never
  // deleted — the new value is the post-fix model.
  assert.equal(
    modelHash(model, layout),
    '170698a6f87de9ec726ad8493e6666fc7bb0158147e425a64a86a03a2c24d8c6');
  assertNoOverlapOrOffCanvas(layout, DEFAULT_MEASURE, 'ordinary/default');
  const stubLayout = computePngReceiptLayout(model, STUB_MEASURE);
  // Plan 574: the stub layout grows by the same seal band — but the
  // stub wraps the note to 2 lines (3 under the default), so its y is
  // one 62px pitch lower: height 2080, not the default's 2142.
  // Measured, not derived.
  assert.equal(stubLayout.height, 2080);
  // The Urdu note wraps to 2 lines under the narrower stub measure
  // (3 under the default), so the stub footer sits one line higher.
  // Plan 573: the Total Due row adds one finPitch (74px) here too —
  // 1790 -> 1864, the same +74 as the default measure.
  // Plan 574: the seal band adds 192px here too — 1864 -> 2056.
  assert.equal(stubLayout.footerY, 2056);
  assertNoOverlapOrOffCanvas(stubLayout, STUB_MEASURE, 'ordinary/stub');
});

test('long method value wraps whole with no overlap (default measure)', (t) => {
  const model = buildModel(longMethodFixture());
  const methodRow = model.financial.find((r) => r.label.startsWith('Payment Method'));
  assert.equal(methodRow.value.length, 130);
  const layout = computePngReceiptLayout(model);
  assertNoOverlapOrOffCanvas(layout, DEFAULT_MEASURE, 'long-method/default');
  const lines = wrappedValueLines(layout, model, 'Payment Method');
  assert.ok(lines.length > 1, `method value should wrap, got ${lines.length} line(s)`);
  assert.equal(normWs(lines.join(' ')), normWs(methodRow.value));
  // The row grew, so the canvas grew with it — the footer stays inside.
  assert.ok(layout.height > PNG_RECEIPT_HEIGHT, `height should grow past 2000, got ${layout.height}`);
});

test('long method value wraps whole with no overlap (stub measure)', (t) => {
  const model = buildModel(longMethodFixture());
  const methodRow = model.financial.find((r) => r.label.startsWith('Payment Method'));
  const layout = computePngReceiptLayout(model, STUB_MEASURE);
  assertNoOverlapOrOffCanvas(layout, STUB_MEASURE, 'long-method/stub');
  const lines = wrappedValueLines(layout, model, 'Payment Method');
  assert.ok(lines.length > 1, `method value should wrap, got ${lines.length} line(s)`);
  assert.equal(normWs(lines.join(' ')), normWs(methodRow.value));
});

test('long label wraps instead of colliding with its value', (t) => {
  // 'Change Kept as Advance Credit / بقایا ایڈوانس کریڈٹ' (51 chars)
  // collided with its own short value by 112px under the default
  // measure — the fix must measure the label side too.
  const fixture = longMethodFixture();
  fixture.payment.amount = 6000; // 3000 over the 3000 bill -> khula paisa
  const model = buildModel(fixture);
  const row = model.financial.find((r) => r.label.startsWith('Change Kept'));
  assert.ok(row, 'loose-change row expected');
  assert.equal(row.value, '+PKR 3,000');
  const layout = computePngReceiptLayout(model);
  assertNoOverlapOrOffCanvas(layout, DEFAULT_MEASURE, 'long-label/default');
  const labelLines = wrappedLabelLines(layout, model, 'Change Kept');
  assert.ok(labelLines.length > 1, `label should wrap, got ${labelLines.length} line(s)`);
  assert.equal(normWs(labelLines.join(' ')), normWs(row.label));
  const valueLines = wrappedValueLines(layout, model, 'Change Kept');
  assert.deepEqual(valueLines, [row.value]);
  const stubLayout = computePngReceiptLayout(model, STUB_MEASURE);
  assertNoOverlapOrOffCanvas(stubLayout, STUB_MEASURE, 'long-label/stub');
});

test('cap-length sender + payer wrap whole with no overlap (both measures)', (t) => {
  const model = buildModel(capLengthFixture());
  const methodRow = model.financial.find((r) => r.label.startsWith('Payment Method'));
  assert.ok(methodRow.value.length > 200, `method value should be cap-length, got ${methodRow.value.length}`);
  for (const [tag, measure, layout] of [
    ['cap-length/default', DEFAULT_MEASURE, computePngReceiptLayout(model)],
    ['cap-length/stub', STUB_MEASURE, computePngReceiptLayout(model, STUB_MEASURE)],
  ]) {
    assertNoOverlapOrOffCanvas(layout, measure, tag);
    const lines = wrappedValueLines(layout, model, 'Payment Method');
    assert.ok(lines.length > 1, `${tag}: method value should wrap, got ${lines.length} line(s)`);
    assert.equal(normWs(lines.join(' ')), normWs(methodRow.value), `${tag}: method value must read whole`);
  }
});

test('single-word 100-char payer splits by characters, never off-canvas', (t) => {
  // wrapText never splits a single word — a 100-char unbroken payer
  // name would still run off the canvas without the character split.
  const fixture = capLengthFixture();
  fixture.payment.paidBy = 'A'.repeat(100);
  const model = buildModel(fixture);
  const methodRow = model.financial.find((r) => r.label.startsWith('Payment Method'));
  assert.ok(methodRow.value.includes('A'.repeat(100)), 'cap-length single word expected in the method value');
  const layout = computePngReceiptLayout(model);
  assertNoOverlapOrOffCanvas(layout, DEFAULT_MEASURE, 'single-word/default');
  const lines = wrappedValueLines(layout, model, 'Payment Method');
  assert.ok(lines.length > 1, `method value should wrap, got ${lines.length} line(s)`);
  // The character split has no word boundary, so the 100-char word is
  // contiguous when the lines are joined without a separator.
  assert.ok(lines.join('').includes('A'.repeat(100)), '100-char word must read whole');
});

test('no-history maximal receipt grows the canvas so the footer fits', (t) => {
  // Kist + arrears + ticket + addon + baqaya, no history: before the
  // fix the footer ran ~390px past the model's own height and clipped
  // (the height grew only when a history block was drawn).
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
    id: 'c-max', customerNumber: 7, name: 'Test Customer 34', nameUrdu: 'راجہ فیصل',
    mohalla: 'Palaliya', zone: '', packageSpeed: '10 Mbps',
    packageHistory: [], bills: [bill],
  };
  const model = buildModel({ customer, bill, payment });
  assert.equal(model.history.length, 0);
  // Plan 573: the new Total Due row is the eleventh financial row on
  // the maximal receipt (was ten); the height assertion below is
  // relative (> 2000), so it holds unchanged.
  assert.equal(model.financial.length, 11);
  const layout = computePngReceiptLayout(model);
  assert.ok(layout.height > PNG_RECEIPT_HEIGHT, `height should grow past 2000, got ${layout.height}`);
  assertNoOverlapOrOffCanvas(layout, DEFAULT_MEASURE, 'no-history-maximal/default');
});
