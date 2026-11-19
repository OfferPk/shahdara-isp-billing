/**
 * plan571-reprint-wiring.test.js — Plan 571: reprints are recorded and
 * stamped REPRINT (parent decisions D1–D12, 2026-11-18; see
 * ~/workspace/plan-571-prep.md).
 *
 * SCOPE (all D(a)): a printed-once marker store (D1(a)) distinguishes
 * first print from reprint; the record is written synchronously inside
 * printPaymentReceipt before window.print() (D2(a)); the stamp is
 * REPRINT + original number + count (D3(a)), next to the VOID stamp in
 * the header of all three layouts (D4(a)), styled by the new
 * .receipt-reprint-stamp class in amber tokens (D5(a)); VOID reprints
 * are recorded + stamped too (D6(a)); the stamp shows the count read
 * back from the saved log (D7(a)); this NEW file (D8); QC Print slip
 * + batch stay out (D9); printPaymentReceipt's signature stays
 * byte-identical (D10(a)); the panel refreshes on the next analytics
 * render (D11(a)); record ids are RR-<ms>-<random> (D12(a)).
 * Files changed: app.js + receipt.js + styles.css + this file.
 * receipt-reprints.js is UNTOUCHED (purity fence).
 *
 * D1(a) DISCLOSURE — receipts printed before 571 shipped carry no
 * marker, so their first post-571 print is an original. A cancelled
 * print dialog still counts as a print (the record is written before
 * window.print(), matching the manual panel's record-on-click
 * precedent). After a Clear All wipe the reprint log is emptied but
 * printed-once markers for wiped payments remain — they can never
 * match a live receipt, because receipt numbers are never re-issued
 * and printPaymentReceipt requires the payment to exist.
 * D7 DISCLOSURE — a PKR 0 receipt can never be recorded (the module
 * refuses amount ≤ 0) and therefore never stamps; no fake amount is
 * recorded to work around it (T4).
 *
 * T1 — plan569 pins the printPaymentReceipt signature EXACTLY; 571
 * needs no new parameter, so the line stays byte-identical.
 * T3 — the print-path id needs a random suffix: two prints in the
 * same millisecond must not collide (the manual panel's bare
 * RR-${Date.now()} id is NOT 571's to change).
 * T5 — the stamp depends on the reprint count only, never on
 * starThankYouNote (the sisp120 star-thanks equality test is the net).
 * T6 — the receipt-scripts preview calls the builder directly and
 * must stay unstamped (no reprint input there).
 * T7 — the stamp sits in the HEADER, never inside the <dl>, and
 * contains no &nbsp; (plan554 pins exactly 1 &nbsp; on A4).
 * T9 — the stamp is driven by the log count read back AFTER the
 * save, so a failed save leaves sheet and log in agreement.
 *
 * Fixtures (synthetic data only; generic name Synthetic Customer;
 * pattern-fake IDs only): copied from tests/receipt.test.js via the
 * 570 file. PAID = pay 2000 on due 2000; VOID = pay 2000 with
 * { voided: true, voidedAt, voidReason }.
 *
 * Groups: G1 builder stamp (10) + G2 print-path record shape (5) +
 * G3 wiring (6) + G4 guards (5) = 26 tests.
 * Expected suite: 20,362 + 26 = 20,388/0.
 * Build dist 23. Parity 4,675/4,675 (no new i18n keys).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildPaymentReceipt,
  generatePaymentReceiptHtml,
} from '../receipt.js';
import {
  addReceiptReprint,
  reprintsForReceipt,
  validReprintDate,
} from '../receipt-reprints.js';
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

// plan423/plan569 precedent: app.js is not imported by unit tests, so
// the print path is pinned by source text. Slice one function's body
// (from its definition to the next top-level `function `).
function fnBody(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist in app.js`);
  const rest = src.slice(start);
  const next = rest.indexOf('\nfunction ', 1);
  return next >= 0 ? rest.slice(0, next) : rest;
}

// ---- Fixtures (repro-571.mjs fixtures, verbatim) ----
function fixture({ dueAmount = 2000, payments = [], month = '2026-08' } = {}) {
  const bill = { id: `bill-${month}`, month, dueAmount, status: 'pending', payments };
  const customer = {
    id: 'synthetic-customer', customerNumber: 42, name: 'Synthetic Customer',
    packageSpeed: '5 Mbps', packageHistory: [], bills: [bill],
  };
  return { customer, bill };
}
const payment = (id, amount, date, extra = {}) => ({ id, amount, date, method: 'Cash', ...extra });

const paidPay = payment('pay-paid', 2000, '2026-08-07');
const { customer: fc, bill: fb } = fixture({ payments: [paidPay] });
const paid = buildPaymentReceipt(fc, fb, paidPay);
const voidPay = payment('pay-void', 2000, '2026-08-07', { voided: true, voidedAt: '2026-08-08', voidReason: 'Wrong entry' });
const { customer: vc, bill: vb } = fixture({ payments: [voidPay] });
const voided = buildPaymentReceipt(vc, vb, voidPay);

const NUM = paid.receiptNumber;
const html = (receipt, format, extra = {}) => generatePaymentReceiptHtml(receipt, { format, ...extra });
const stampOf = (layoutHtml) => {
  const m = layoutHtml.match(/<div class="receipt-reprint-stamp">([\s\S]*?)<\/div>/);
  return m ? m[1] : null;
};

// The print path builds the record id + date this way (D12(a)); the
// test mirrors the SHAPE. The date here is UTC-today; the print path
// uses getTodayDateString (PKT) — either way the record must carry a
// valid YYYY-MM-DD the module accepts.
const todayStr = () => new Date().toISOString().slice(0, 10);
const printPathId = () => `RR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const printPathRecord = (receipt) => ({
  id: printPathId(),
  receiptNumber: receipt.receiptNumber,
  amount: receipt.paidAmount,
  reprintDate: todayStr(),
});

/* ---------------- G1 — builder stamp ---------------- */

test('plan571 G1 original a4: reprintCount absent/0 → NO REPRINT text', () => {
  assert.ok(!html(paid, 'a4').includes('REPRINT'), 'the original A4 sheet must carry no REPRINT text');
  assert.ok(!html(paid, 'a4', { reprintCount: 0 }).includes('REPRINT'), 'reprintCount 0 must render exactly like the original');
});

test('plan571 G1 original thermal-80: reprintCount absent/0 → NO REPRINT text', () => {
  assert.ok(!html(paid, 'thermal-80').includes('REPRINT'), 'the original thermal-80 slip must carry no REPRINT text');
  assert.ok(!html(paid, 'thermal-80', { reprintCount: 0 }).includes('REPRINT'), 'reprintCount 0 must render exactly like the original');
});

test('plan571 G1 original thermal-58: reprintCount absent/0 → NO REPRINT text', () => {
  assert.ok(!html(paid, 'thermal-58').includes('REPRINT'), 'the original thermal-58 slip must carry no REPRINT text');
  assert.ok(!html(paid, 'thermal-58', { reprintCount: 0 }).includes('REPRINT'), 'reprintCount 0 must render exactly like the original');
});

test('plan571 G1 reprint a4: reprintCount 1 stamps REPRINT with the original number (D3(a))', () => {
  const stamp = stampOf(html(paid, 'a4', { reprintCount: 1 }));
  assert.ok(stamp, 'the second A4 sheet must carry the stamp');
  assert.equal(stamp, `REPRINT ×1 — Receipt #: ${NUM}`, 'the stamp must read REPRINT ×1 with the original receipt number');
});

test('plan571 G1 reprint thermal-80: reprintCount 1 stamps REPRINT with the original number (D3(a))', () => {
  const stamp = stampOf(html(paid, 'thermal-80', { reprintCount: 1 }));
  assert.ok(stamp, 'the second thermal-80 slip must carry the stamp');
  assert.equal(stamp, `REPRINT ×1 — Receipt #: ${NUM}`, 'the stamp must read REPRINT ×1 with the original receipt number');
});

test('plan571 G1 reprint thermal-58: reprintCount 1 stamps REPRINT with the original number (D3(a))', () => {
  const stamp = stampOf(html(paid, 'thermal-58', { reprintCount: 1 }));
  assert.ok(stamp, 'the second thermal-58 slip must carry the stamp');
  assert.equal(stamp, `REPRINT ×1 — Receipt #: ${NUM}`, 'the stamp must read REPRINT ×1 with the original receipt number');
});

test('plan571 G1 count: reprintCount 2 reads ×2, the way the history button does (D3(a))', () => {
  const stamp = stampOf(html(paid, 'a4', { reprintCount: 2 }));
  assert.equal(stamp, `REPRINT ×2 — Receipt #: ${NUM}`, 'the third sheet must read REPRINT ×2');
});

test('plan571 G1 position: the stamp sits in/after the header, before </dl> on every layout (D4(a), T7)', () => {
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const h = html(paid, format, { reprintCount: 1 });
    const stampIdx = h.indexOf('receipt-reprint-stamp');
    const dlClose = h.indexOf('</dl>');
    assert.ok(stampIdx >= 0, `the stamp must exist on ${format}`);
    assert.ok(stampIdx < dlClose, `the stamp must sit before </dl> on ${format}`);
    if (format === 'a4') {
      assert.ok(stampIdx > h.indexOf('</header>'), 'the A4 stamp must sit after </header>');
    } else {
      assert.ok(stampIdx > h.indexOf('<header'), `the ${format} stamp must sit inside the header`);
      assert.ok(stampIdx < h.indexOf('</header>'), `the ${format} stamp must sit inside the header`);
    }
  }
});

test('plan571 G1 VOID+reprint: both stamps render, VOID first (D6(a))', () => {
  const h = html(voided, 'a4', { reprintCount: 1 });
  assert.equal(voided.status, 'VOID', 'the fixture must be VOID');
  assert.ok(h.includes('receipt-void-stamp'), 'the VOID stamp must still render');
  assert.equal(stampOf(h), `REPRINT ×1 — Receipt #: ${voided.receiptNumber}`, 'the reprint stamp must also render on a voided receipt');
  assert.ok(h.indexOf('receipt-void-stamp') < h.indexOf('receipt-reprint-stamp'), 'the VOID stamp must come before the REPRINT stamp');
});

test('plan571 G1 Urdu: script=urdu carries the IDENTICAL stamp (applyReceiptScript touches only <dt>)', () => {
  const roman = stampOf(html(paid, 'a4', { reprintCount: 1 }));
  const urdu = stampOf(html(paid, 'a4', { script: 'urdu', reprintCount: 1 }));
  assert.equal(urdu, roman, 'the Urdu-script sheet must carry the identical stamp');
  assert.equal(urdu, `REPRINT ×1 — Receipt #: ${NUM}`, 'the Urdu stamp must read REPRINT ×1 with the original number');
});

/* ---------------- G2 — print-path record shape ---------------- */

test('plan571 G2 record shape: the print-path record normalizes with the original number, amount in cents once, and a valid date', () => {
  const list = addReceiptReprint([], printPathRecord(paid));
  assert.equal(list.length, 1, 'the record must be accepted by the module');
  assert.equal(list[0].receiptNumber, paid.receiptNumber, 'the record must carry the original receipt number');
  assert.equal(list[0].amountCents, paid.paidAmount * 100, 'rupees must convert to cents exactly once');
  assert.equal(paid.paidAmount, 2000, 'the fixture must have paid PKR 2,000');
  assert.equal(list[0].reprintDate, todayStr(), 'the record must carry today as a valid YYYY-MM-DD date');
  assert.ok(validReprintDate(list[0].reprintDate), 'the reprint date must pass the module date check');
  assert.match(list[0].id, /^RR-\d+-[a-z0-9]{6}$/, 'the id must be RR-<ms>-<6 random chars> (D12(a))');
});

test('plan571 G2 record id: two ids built in the same millisecond do not collide (D12(a), T3)', () => {
  const idA = printPathId();
  const idB = printPathId();
  assert.notEqual(idA, idB, 'two print-path ids built back-to-back must differ');
  const two = addReceiptReprint(
    addReceiptReprint([], { id: idA, receiptNumber: paid.receiptNumber, amount: paid.paidAmount, reprintDate: todayStr() }),
    { id: idB, receiptNumber: paid.receiptNumber, amount: paid.paidAmount, reprintDate: todayStr() },
  );
  assert.equal(two.length, 2, 'both records must land — the second is not dropped as a duplicate id');
  assert.equal(reprintsForReceipt(two, paid.receiptNumber).length, 2, 'the log count for the receipt must be 2 after two prints');
});

test('plan571 G2 PKR 0: a zero-amount receipt record is refused by the module (D7 disclosed edge, T4)', () => {
  const zero = addReceiptReprint([], {
    id: printPathId(), receiptNumber: paid.receiptNumber, amount: 0, reprintDate: todayStr(),
  });
  assert.equal(zero.length, 0, 'the module must refuse a PKR 0 record — no fake amount is recorded');
});

test('plan571 G2 same id: a second addReceiptReprint with the same id does not duplicate', () => {
  const id = printPathId();
  const once = addReceiptReprint([], { id, receiptNumber: paid.receiptNumber, amount: paid.paidAmount, reprintDate: todayStr() });
  const twice = addReceiptReprint(once, { id, receiptNumber: paid.receiptNumber, amount: paid.paidAmount, reprintDate: todayStr() });
  assert.equal(twice.length, 1, 'an identical re-save must leave the list unchanged');
});

test('plan571 G2 count: the log count grows 0 → 1 → 2 across prints — the count the stamp reads (D7(a))', () => {
  assert.equal(reprintsForReceipt([], paid.receiptNumber).length, 0, 'a never-printed receipt has count 0');
  const one = addReceiptReprint([], printPathRecord(paid));
  assert.equal(reprintsForReceipt(one, paid.receiptNumber).length, 1, 'the second sheet reads count 1');
  const two = addReceiptReprint(one, printPathRecord(paid));
  assert.equal(reprintsForReceipt(two, paid.receiptNumber).length, 2, 'the third sheet reads count 2');
});

/* ---------------- G3 — wiring ---------------- */

test('plan571 G3 record calls: printPaymentReceipt loads the marker, records a reprint, and saves the marker (D1(a)/D2(a))', () => {
  const body = fnBody(appJs, 'printPaymentReceipt');
  assert.ok(body.includes('loadPrintedReceiptNumbers()'), 'the print path must load the printed-once markers');
  assert.ok(body.includes('recordReceiptReprint(receipt)'), 'the print path must record a reprint when the marker exists');
  assert.ok(body.includes('savePrintedReceiptNumbers('), 'the print path must save the marker on a first print');
  const recorder = fnBody(appJs, 'recordReceiptReprint');
  assert.ok(recorder.includes('loadReceiptReprints()'), 'the recorder must load the reprint log');
  assert.ok(recorder.includes('addReceiptReprint('), 'the recorder must add the reprint record');
  assert.ok(recorder.includes('saveReceiptReprints('), 'the recorder must save the reprint log');
  assert.ok(recorder.includes('reprintsForReceipt(loadReceiptReprints()'), 'the recorder must read the count back from the saved log (D7(a))');
});

test('plan571 G3 builder input: printPaymentReceipt passes reprintCount to generatePaymentReceiptHtml', () => {
  const body = fnBody(appJs, 'printPaymentReceipt');
  assert.ok(body.includes('generatePaymentReceiptHtml(receipt, {'), 'the print path must still call its builder');
  assert.ok(body.includes('reprintCount'), 'the print path must pass the reprint count to the builder');
});

test('plan571 G3 signature: printPaymentReceipt keeps the exact 569-pinned signature (D10(a), T1)', () => {
  assert.ok(appJs.includes("function printPaymentReceipt(customerId, month, paymentId, { isThermal = false, format = isThermal ? 'thermal-80' : 'a4', script = 'roman' } = {})"), 'printPaymentReceipt signature must be unchanged');
});

test('plan571 G3 first-print sites: the four toast Receipt actions still pass no options object', () => {
  // The absence is the point: no caller flag exists (D1(a) — the
  // marker store decides, not the call site). If a caller ever gains
  // an options argument, this test fails loudly and the follow-up owns it.
  assert.ok(appJs.includes("{ label:'Receipt', onAction: () => printPaymentReceipt(customerId, payMonth, added.id) }"), 'profile payment-recorded toast must still pass no options object');
  assert.ok(appJs.includes("{ label: 'Receipt', onAction: () => printPaymentReceipt(customer.id, receipt.month, receipt.paymentId) }"), 'dues-cleared toast must still pass no options object');
  assert.ok(appJs.includes("{ label: 'Receipt', onAction: () => printPaymentReceipt(customerId, month, payment.id) }"), 'advance/prepay toasts must still pass no options object');
});

test('plan571 G3 history jump: the saved-receipt call site string is unchanged (T2)', () => {
  assert.ok(appJs.includes('printPaymentReceipt(customer.id, target.month, target.paymentId);'), 'the history-jump call site must still pass no options object');
});

test('plan571 G3 preview + Plan 423 block: no reprint input reaches the preview, and the 423 block stays write-free (T2/T6)', () => {
  const renderScripts = fnBody(appJs, 'renderReceiptScripts');
  assert.ok(!renderScripts.includes('reprintCount'), 'the receipt-scripts panel (preview + print button) must pass no reprint input — a preview is not a print');
  const blockStart = appJs.indexOf('// Plan 423');
  const blockEnd = appJs.indexOf('// Plan 406', blockStart);
  assert.ok(blockStart >= 0 && blockEnd > blockStart, 'the Plan 423 … Plan 406 block must exist');
  const block = appJs.slice(blockStart, blockEnd);
  for (const forbidden of ['addReceiptReprint', 'saveReceiptReprints', 'localStorage', 'window.print']) {
    assert.ok(!block.includes(forbidden), `the Plan 423 block must not contain ${forbidden}`);
  }
});

/* ---------------- G4 — guards ---------------- */

test('plan571 G4 stable number: the receipt number is identical before/after the print-path logic', () => {
  const again = buildPaymentReceipt(fc, fb, paidPay);
  assert.equal(again.receiptNumber, paid.receiptNumber, 'two builds of the same receipt must carry the same number — no new number is ever created');
});

test('plan571 G4 Roman identical: no-script/roman output is byte-identical with reprintCount absent vs 0', () => {
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    assert.equal(html(paid, format, { reprintCount: 0 }), html(paid, format), `the ${format} original must be byte-identical with reprintCount 0 vs absent`);
  }
});

test('plan571 G4 VOID wiring: the print path has no VOID exclusion on the recording path (D6(a))', () => {
  const body = fnBody(appJs, 'printPaymentReceipt');
  assert.ok(!body.includes('VOID'), 'the print path must not exclude VOID receipts from reprint recording');
});

test('plan571 G4 no money in the stamp: the stamp carries no Rs. and no PKR figure (Sharafat 49 pattern)', () => {
  const stamp = stampOf(html(paid, 'a4', { reprintCount: 1 }));
  assert.ok(stamp, 'the stamp must exist');
  assert.ok(!stamp.includes('Rs'), 'the stamp must not carry an Rs. figure');
  assert.ok(!stamp.includes('PKR'), 'the stamp must not carry a money figure at all');
});

test('plan571 G4 parity + hex + nbsp: no new i18n keys, no new hex, and the stamp adds no &nbsp; (T7/T13)', () => {
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
  // 613 → 608 with Plan 589 (one focus-ring colour): the two dead
  // baselines' #16745a/#0b624b deleted, #6caa91/#97d7bd/#1a5845
  // re-tokened to var(--green). Five distinct hex leave, none added.
  assert.equal(hexCount(styles), 608, `styles.css hex count moved (${hexCount(styles)})`);
  // Plan 588 D5(b) re-pins nav.css 164 -> 163: .btn-primary:hover #094338
  // (its only occurrence) is re-tokened to var(--color-brand-700).
  assert.equal(hexCount(navCss), 163, `nav.css hex count moved (${hexCount(navCss)})`);
  assert.equal(hexCount(components), 0, `components.css hex count moved (${hexCount(components)})`);
  const nbsp = (s) => (s.match(/&nbsp;/g) || []).length;
  assert.equal(nbsp(html(paid, 'a4', { reprintCount: 1 })), nbsp(html(paid, 'a4')), 'the reprint stamp must add no &nbsp; to the A4 sheet');
});
