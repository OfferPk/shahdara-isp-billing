/**
 * plan566-receipt-card-nan-guard.test.js — Plan 566: the canonical
 * remaining figure is finite-guarded on all three Quick Collect
 * surfaces (parent decisions D1–D4, 2026-11-17; see
 * ~/workspace/plan-566-prep.md).
 *
 * HEADLINE (prep §1, re-verified): the spec's literal defect does NOT
 * reproduce — no surface can print "PKR NaN" (Plan 555's
 * formatReceiptMoneyFigure returns '—' for every non-finite figure,
 * and Plan 565's `?? 0` chain already handles MISSING fields). What
 * IS real is the finite-guard gap underneath: `??` catches missing,
 * never non-finite — a NaN/Infinity first field poisons the chain and
 * the fallbacks, so the card HIDES money owed (NaN > 0 is false), the
 * draft and PNG claim PARTIAL with a "PKR —" balance, and Infinity
 * shows a "PKR —" row on the card. The live flow cannot mint a
 * non-finite figure (V9: every input is sanitized finite; stored JSON
 * cannot carry NaN), so the guard only ever fires for hand-built/test
 * receipts — no live bug is claimed (T9).
 *
 * FIX (D1–D4): one shared helper, firstFiniteRemainingPayable
 * (receipt-money.js) — first FINITE of (payableRemaining,
 * newTotalDues, newBalanceDue), defaulting 0 — called by the card
 * (:2301), the WhatsApp draft (:1601) and the PNG slip (:1794).
 * D2 guard-to-0 (spec): T3 — this claims settled for a hand-built
 * non-finite receipt; the live flow is finite by construction, so it
 * never fires on a real receipt. D5/D6/D7: the receipt literal,
 * isSettled and the split card are untouched (the split card's raw
 * `Number(remaining)` formula at split-tender-collect.js:1007 is
 * Plan 579's job — R11 pins it as deliberately left).
 *
 * Fixtures (synthetic data only; pattern-fake 03001234567 phone):
 * hand-built receipts in the 565 Fixture-B pattern; Fixture A via
 * the REAL executeQuickCollection (PKR 1,000 bill + PKR 300 ticket
 * pending → payableRemaining 300). No modal-drive test (D8): the
 * guard is unreachable through the modal — the live flow is finite.
 *
 * Groups: R repro port (12), F guard behaviour card-only (5) +
 * draft/PNG (6), D no-regress (5), G guards (3) = 31 tests.
 * Expected suite: 20,210 + 31 = 20,241/0. Build dist 23.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState,
  updateCustomerProfile,
  generateMonthlyBillsThroughCurrentMonth,
  saveBillMonth
} from '../core.js';
import {
  executeQuickCollection,
  formatQuickCollectWhatsAppReceipt,
  renderQuickCollectReceiptCardHtml,
  generateReceiptImageBlob,
  getPakistanLocalDate
} from '../nav-quick-collect.js';
import { createTicket, resolveTicket, sanitizeTicketMaterial } from '../complaint-tickets.js';
import { formatReceiptMoney, firstFiniteRemainingPayable } from '../receipt-money.js';
import { successNextStepsFigureCents, successNextStepsFromReceipt } from '../success-next-steps.js';
import { executeSplitTenderCollection, renderSplitReceiptCardHtml } from '../split-tender-collect.js';
import { TRANSLATIONS } from '../nav-language.js';

const MONTH = getPakistanLocalDate(new Date()).slice(0, 7);
const TODAY = getPakistanLocalDate(new Date());

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const quickCollectSrc = read('nav-quick-collect.js');
const splitSrc = read('split-tender-collect.js');
const moneySrc = read('receipt-money.js');
const styles = read('styles.css');
const navCss = read('nav.css');
const components = read('components.css');

function hexCount(css) {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return new Set(noComments.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) || []).size;
}

// Hand-built receipt with NO remaining-balance fields (565 Fixture-B
// pattern); each test adds the fields its case needs.
function receiptBase(overrides = {}) {
  return {
    id: 'receipt-566', receiptNumber: 'RCPT-566-202611-01',
    customerName: 'Test Customer', customerNumber: 7,
    date: '2026-11-10', month: '2026-11', method: 'Cash',
    area: 'Test Area', amount: 1000,
    ...overrides
  };
}

// Fixture A (565): PKR 1,000 bill paid in full, PKR 300 billed ticket
// still pending — receipt.payableRemaining 300, isSettled false.
function plan565FixtureState() {
  const now = new Date();
  let state = createInitialState(['Plan565 Tester']);
  state = updateCustomerProfile(state, 'seed-001', {
    packageSpeed: '3Mbps / 100GB', monthlySellingAmount: 1000
  }, now);
  state = generateMonthlyBillsThroughCurrentMonth(state, now);
  return state;
}

function pendingTicket300() {
  const created = createTicket({
    customerId: 'seed-001', customerName: 'Plan565 Tester',
    faultPreset: 'Fiber Cut / Splice Loss', technician: 'Saad'
  }, []);
  return resolveTicket([created], created.id, {
    materialsUsed: [{ key: 'patch-cord', qty: 1, amount: 300 }],
    billingType: 'billed', referenceDate: new Date('2026-10-28T14:30:00')
  });
}

function collectFixtureA() {
  const { receipt } = executeQuickCollection(plan565FixtureState(), {
    customerId: 'seed-001', month: MONTH, amount: 1000, method: 'Cash',
    tickets: pendingTicket300()
  }, new Date());
  return receipt;
}

// The "Remaining Balance" figure on the success card, or null (565
// harness: the merged Still-owed row carries the figure when
// something remains; the row is hidden at 0 — never "PKR 0").
function cardRemainingOf(html) {
  const m = html.match(/Still owed(?: \(incl\. pending charges\))?<\/span>\s*<strong[^>]*>\s*([^<]+)/);
  return m ? m[1].trim() : null;
}

// --- Image receipt: a fake document + recording canvas (565 harness) ---

function imageFills(receipt) {
  const fills = [];
  const ctx = {
    fillStyle: '', font: '',
    fillText: (text, x, y) => fills.push({ text: String(text), x, y }),
    fillRect: () => {}, strokeRect: () => {}, beginPath: () => {},
    moveTo: () => {}, lineTo: () => {}, stroke: () => {}
  };
  const canvas = {
    width: 0, height: 0, getContext: () => ctx,
    toBlob: (cb) => cb({ type: 'image/png' })
  };
  const origDocument = globalThis.document;
  globalThis.document = { createElement: () => canvas };
  try {
    return generateReceiptImageBlob(receipt).then((blob) => ({ blob, fills }));
  } finally {
    globalThis.document = origDocument;
  }
}

const imageBalanceOf = (fills) => fills.find((f) => f.x === 420 && f.y === 375)?.text ?? null;
const imageStatusOf = (fills) => fills.find((f) => f.x === 30 && f.y === 420)?.text ?? null;

/* ---------------- R — repro port (12: V1–V12) ---------------- */

test('plan566 R1 V1 guard: no-fields receipt still renders settled-looking on the card (the ?? 0 chain already handled missing fields)', () => {
  const html = renderQuickCollectReceiptCardHtml(receiptBase());
  assert.equal(cardRemainingOf(html), null, html);
  assert.ok(!html.includes('NaN'), 'no NaN text anywhere on the card');
});

test('plan566 R2 V2: card with NaN payableRemaining + finite newTotalDues 500 shows PKR 500 (the 500 must not be hidden)', () => {
  const html = renderQuickCollectReceiptCardHtml(receiptBase({ payableRemaining: NaN, newTotalDues: 500 }));
  assert.equal(cardRemainingOf(html), 'PKR 500', html);
});

test('plan566 R3 V3: draft with NaN payableRemaining reads PAID IN FULL with PKR 0, never PARTIAL-with-"—"', () => {
  const text = formatQuickCollectWhatsAppReceipt(receiptBase({ payableRemaining: NaN })).text;
  assert.ok(text.includes('⚖️ *Remaining Balance:* PKR 0'), text);
  assert.ok(text.includes('PAID IN FULL'), text);
  assert.ok(!text.includes('PARTIAL'), text);
});

test('plan566 R4 V4: PNG with NaN payableRemaining reads PKR 0 and settled, never Partial + "PKR —"', async () => {
  const { fills } = await imageFills(receiptBase({ payableRemaining: NaN }));
  assert.equal(imageBalanceOf(fills), 'PKR 0', JSON.stringify(fills));
  assert.match(imageStatusOf(fills), /Bill settled in full/, JSON.stringify(fills));
});

test('plan566 R5 V5: draft with NaN first field falls back to finite newTotalDues 500', () => {
  const text = formatQuickCollectWhatsAppReceipt(receiptBase({ payableRemaining: NaN, newTotalDues: 500 })).text;
  assert.ok(text.includes('⚖️ *Remaining Balance:* PKR 500'), text);
});

test('plan566 R6 V6: draft with NaN second field falls back to finite newBalanceDue 500', () => {
  const text = formatQuickCollectWhatsAppReceipt(receiptBase({ newTotalDues: NaN, newBalanceDue: 500 })).text;
  assert.ok(text.includes('⚖️ *Remaining Balance:* PKR 500'), text);
});

test('plan566 R7 V7: card with Infinity payableRemaining hides the row (no "PKR —" row)', () => {
  const html = renderQuickCollectReceiptCardHtml(receiptBase({ payableRemaining: Infinity }));
  assert.equal(cardRemainingOf(html), null, html);
  assert.ok(!html.includes('PKR —'), 'no em-dash row on the card');
});

test('plan566 R8 V8 guard: no surface prints the literal "PKR NaN" for any NaN fixture (the formatter guards the print)', async () => {
  const nan = receiptBase({ payableRemaining: NaN });
  const html = renderQuickCollectReceiptCardHtml(nan);
  const draft = formatQuickCollectWhatsAppReceipt(nan).text;
  const { fills } = await imageFills(nan);
  const pngText = fills.map((f) => f.text).join(' ');
  assert.ok(!html.includes('PKR NaN'), 'card must never print PKR NaN');
  assert.ok(!draft.includes('PKR NaN'), 'draft must never print PKR NaN');
  assert.ok(!pngText.includes('PKR NaN'), 'PNG must never print PKR NaN');
});

test('plan566 R9 V9 guard: malformed ticket material amount "abc" sanitizes to 0 (the live flow stays finite)', () => {
  const line = sanitizeTicketMaterial({ key: 'patch-cord', qty: 1, amount: 'abc' });
  assert.ok(line !== null, 'the line is kept');
  assert.equal(line.amount, 0, 'a non-finite material amount sanitizes to 0');
});

test('plan566 R10 V10 guard: successNextStepsFromReceipt(NaN) is null (the house never-guess pattern is untouched)', () => {
  const steps = successNextStepsFromReceipt(receiptBase({ payableRemaining: NaN, amount: 1000 }), '2026-12-05');
  assert.equal(steps, null, 'a panel with a guessed figure is worse than no panel');
});

test('plan566 R11 (Plan 579): split card reads the still-owed figure through a finite-cents guard — Infinity/NaN never reach the row', () => {
  // Plan 579 (D7(b), 566's R11 hand-off): the raw
  // `PKR ${Number(remaining).toLocaleString('en-PK')}` formula is
  // gone — the cents read falls through to the next FINITE field,
  // defaulting to 0, and the render uses formatReceiptMoneyFigure
  // (the 566 single-card pattern, firstFiniteRemainingPayable, in
  // cents). Whole-rupee figures print byte-identically; only the
  // non-finite path changes (Infinity → hidden row, never "PKR ∞").
  assert.ok(
    !splitSrc.includes("PKR ${Number(remaining).toLocaleString('en-PK')}"),
    'split card no longer carries the raw formula (579 fixed it)'
  );
  assert.ok(
    splitSrc.includes('Number.isFinite(combined.balanceDueCents)'),
    'split card guards the balanceDueCents fallback as finite (579)'
  );
  assert.ok(
    splitSrc.includes('PKR ${formatReceiptMoneyFigure(remaining)}'),
    'split card renders the guarded figure through the canonical formatter (579)'
  );
});

test('plan566 R12 V12: all three canonical sites call the finite-guard helper, and no bare ?? chain remains at them', () => {
  // D4: the guard is the shared helper (receipt-money.js), not an
  // inline Number.isFinite wrap — the three sites call it, and the
  // helper itself guards per field with Number.isFinite.
  const calls = (quickCollectSrc.match(/firstFiniteRemainingPayable\(receipt\)/g) || []).length;
  assert.equal(calls, 3, `expected 3 helper call sites (draft, PNG, card), found ${calls}`);
  assert.ok(
    !quickCollectSrc.includes('receipt.payableRemaining ?? receipt.newTotalDues ?? receipt.newBalanceDue ?? 0'),
    'no bare ?? chain may remain at the three canonical sites (the Bluetooth slip keeps its own variant — D1)'
  );
  assert.ok(moneySrc.includes('Number.isFinite(value)'), 'helper must guard each field with Number.isFinite');
});

/* ---------------- F — guard behaviour, card-only (5) ---------------- */

test('plan566 F1: card with NaN payableRemaining reads settled (row hidden, no "—" row)', () => {
  const html = renderQuickCollectReceiptCardHtml(receiptBase({ payableRemaining: NaN }));
  assert.equal(cardRemainingOf(html), null, html);
  assert.ok(!html.includes('PKR —'), 'no em-dash row on the card');
});

test('plan566 F2: card with Infinity payableRemaining reads settled (row hidden)', () => {
  const html = renderQuickCollectReceiptCardHtml(receiptBase({ payableRemaining: Infinity }));
  assert.equal(cardRemainingOf(html), null, html);
});

test('plan566 F3: card with NaN payableRemaining + finite newTotalDues 500 shows PKR 500', () => {
  const html = renderQuickCollectReceiptCardHtml(receiptBase({ payableRemaining: NaN, newTotalDues: 500 }));
  assert.equal(cardRemainingOf(html), 'PKR 500', html);
});

test('plan566 F4: card with no remaining-balance fields still reads settled (regression — the ?? 0 discipline survives the helper)', () => {
  const html = renderQuickCollectReceiptCardHtml(receiptBase());
  assert.equal(cardRemainingOf(html), null, html);
});

test('plan566 F5: card with finite payableRemaining 300 (565 Fixture A) still shows PKR 300', () => {
  const html = renderQuickCollectReceiptCardHtml({ ...collectFixtureA(), id: 'receipt-a' });
  assert.equal(cardRemainingOf(html), 'PKR 300', html);
});

/* ---------------- F — guard behaviour, draft + PNG (6) ---------------- */

test('plan566 F6: draft with NaN payableRemaining reads "Remaining Balance: PKR 0" + PAID IN FULL', () => {
  const text = formatQuickCollectWhatsAppReceipt(receiptBase({ payableRemaining: NaN })).text;
  assert.ok(text.includes('⚖️ *Remaining Balance:* PKR 0'), text);
  assert.ok(text.includes('PAID IN FULL'), text);
  assert.ok(!text.includes('PARTIAL'), text);
});

test('plan566 F7: draft with Infinity payableRemaining reads "Remaining Balance: PKR 0" + PAID IN FULL', () => {
  const text = formatQuickCollectWhatsAppReceipt(receiptBase({ payableRemaining: Infinity })).text;
  assert.ok(text.includes('⚖️ *Remaining Balance:* PKR 0'), text);
  assert.ok(text.includes('PAID IN FULL'), text);
  assert.ok(!text.includes('PARTIAL'), text);
});

test('plan566 F8: draft with NaN payableRemaining + finite newTotalDues 500 reads PKR 500', () => {
  const text = formatQuickCollectWhatsAppReceipt(receiptBase({ payableRemaining: NaN, newTotalDues: 500 })).text;
  assert.ok(text.includes('⚖️ *Remaining Balance:* PKR 500'), text);
  assert.ok(text.includes('PARTIAL'), text);
});

test('plan566 F9: PNG with NaN payableRemaining reads PKR 0 and settled', async () => {
  const { fills } = await imageFills(receiptBase({ payableRemaining: NaN }));
  assert.equal(imageBalanceOf(fills), 'PKR 0', JSON.stringify(fills));
  assert.match(imageStatusOf(fills), /Bill settled in full/, JSON.stringify(fills));
});

test('plan566 F10: PNG with Infinity payableRemaining reads PKR 0 and settled', async () => {
  const { fills } = await imageFills(receiptBase({ payableRemaining: Infinity }));
  assert.equal(imageBalanceOf(fills), 'PKR 0', JSON.stringify(fills));
  assert.match(imageStatusOf(fills), /Bill settled in full/, JSON.stringify(fills));
});

test('plan566 F11: PNG with NaN payableRemaining + finite newTotalDues 500 reads PKR 500 and Partial', async () => {
  const { fills } = await imageFills(receiptBase({ payableRemaining: NaN, newTotalDues: 500 }));
  assert.equal(imageBalanceOf(fills), 'PKR 500', JSON.stringify(fills));
  assert.match(imageStatusOf(fills), /Partial payment recorded/, JSON.stringify(fills));
});

/* ---------------- D — no-regress (5) ---------------- */

test('plan566 D1: formatReceiptMoney(NaN) is still "—" (Plan 555 — the formatter is untouched)', () => {
  assert.equal(formatReceiptMoney(NaN), '—', 'the formatter guards non-finite to an em dash, never PKR 0');
  assert.equal(formatReceiptMoney(Infinity), '—', 'Infinity too');
});

test('plan566 D2: successNextStepsFigureCents(NaN) is still null (Plan 434 — the never-guess helper is untouched)', () => {
  assert.equal(successNextStepsFigureCents(NaN), null, 'non-finite figures never guess a panel');
  assert.equal(successNextStepsFigureCents(Infinity), null, 'Infinity too');
});

test('plan566 D3: 565 Fixture A still reads PKR 300 PARTIAL on draft + card + PNG', async () => {
  const receipt = collectFixtureA();
  const draft = formatQuickCollectWhatsAppReceipt(receipt).text;
  assert.ok(draft.includes('⚖️ *Remaining Balance:* PKR 300'), draft);
  assert.ok(draft.includes('PARTIAL'), draft);
  const html = renderQuickCollectReceiptCardHtml({ ...receipt, id: 'receipt-a' });
  assert.equal(cardRemainingOf(html), 'PKR 300', html);
  const { fills } = await imageFills(receipt);
  assert.equal(imageBalanceOf(fills), 'PKR 300', JSON.stringify(fills));
  assert.match(imageStatusOf(fills), /Partial payment recorded/, JSON.stringify(fills));
});

test('plan566 D4: split combined status still derives from payableRemainingCents (PAID in full, PARTIAL with PKR 1,000 remaining)', () => {
  // Full split through the REAL split recorder: Rs 3,000 bill,
  // Rs 2,000 Cash + Rs 1,000 Easypaisa → PAID, nothing remaining.
  let s = { version: 1, nextCustomerNumber: 2, customers: [{ id: 'a', customerNumber: 1, name: 'Customer 1', phone: '03000000001', area: 'Shahdara', archived: false, bills: [] }] };
  s = saveBillMonth(s, 'a', { month: '2026-10', dueAmount: 3000, status: 'pending' }, new Date('2026-10-29T12:00:00+05:00'));
  const { combinedReceipt } = executeSplitTenderCollection(s, {
    customerId: 'a', month: '2026-10', date: '2026-10-29', paidBy: 'Self',
    legs: [
      { amount: 2000, method: 'Cash' },
      { amount: 1000, method: 'Easypaisa', transactionId: 'EP99887766' }
    ]
  }, { execute: executeQuickCollection, referenceDate: new Date('2026-10-29T12:00:00+05:00') });
  assert.equal(combinedReceipt.status, 'PAID', 'the full split is PAID');
  assert.equal(combinedReceipt.balanceDueCents, 0, 'nothing remains on the full split');
  // Partial combined, hand-built: the remaining comes from
  // payableRemainingCents (100000 → PKR 1,000), NOT balanceDueCents
  // (50000) — the split card's own finite guard, untouched by 566.
  const partial = {
    splitGroupId: 'grp-1', customerId: '12', customerNumber: 12,
    customerName: 'Test Customer', customerNameUrdu: '', phone: '03012345678',
    area: 'Sodaa', month: '2026-11', date: '2026-11-08', package: '5 Mbps',
    legs: [
      { leg: 1, paymentId: 'pay-a', receiptNumber: 'RCPT-12-202611-01', method: 'Cash', amount: 2000, transactionId: '', date: '2026-11-08', voided: false }
    ],
    totalReceivedCents: 200000, totalReceived: 2000,
    payableRemainingCents: 100000, balanceDueCents: 50000, status: 'PARTIAL'
  };
  const html = renderSplitReceiptCardHtml(partial);
  assert.ok(html.includes('PKR 1,000'), `split card shows the payableRemainingCents remainder:\n${html}`);
});

test('plan566 D5: executeQuickCollection still stamps finite remaining fields on a real receipt', () => {
  const receipt = collectFixtureA();
  assert.ok(Number.isFinite(receipt.payableRemaining), 'payableRemaining is finite');
  assert.ok(Number.isFinite(receipt.newTotalDues), 'newTotalDues is finite');
  assert.ok(Number.isFinite(receipt.newBalanceDue), 'newBalanceDue is finite');
  assert.equal(receipt.payableRemaining, 300, 'the stamped figure is the pending ticket alone');
  assert.equal(receipt.isSettled, false, 'not settled while a charge is pending');
});

/* ---------------- G — guards (3) ---------------- */

test('plan566 G1: EN/UR parity stays 4,669/4,669 — the guard adds no i18n keys', () => {
  // D2 picked guard-to-0 (spec), not "unclear" — so no new UI text
  // and no new keys: the count does not move.
  // Plan 582 (D1(b)): re-pinned 4,675 → 4,669 — six orphan
  // dash_tile_collect_*/dash_tile_closing_* keys deleted.
  // Plan 584: +38 ledger_filter_* keys — parity 4,669 → 4,707/4,707.
  // Plan 585: +16 global_search_* keys — parity 4,707 → 4,723/4,723.
  // Plan 586: drawer_settings deleted (dead key) — parity 4,723 → 4,722/4,722.
  assert.equal(Object.keys(TRANSLATIONS.en).length, 4766, 'EN key count moved');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 4766, 'UR key count moved');
});

// Plan 588 D5(b) re-pins nav.css 164 -> 163: .btn-primary:hover #094338
// (its only occurrence) is re-tokened to var(--color-brand-700).
// Title + assert move together (Plan 586 rule).
test('plan566 G2: hex pins hold (styles.css 608 / nav.css 163 / components.css 0, no new hex)', () => {
  // 613 → 608 with Plan 589 (one focus-ring colour): the two dead
  // baselines' #16745a/#0b624b deleted, #6caa91/#97d7bd/#1a5845
  // re-tokened to var(--green). Five distinct hex leave, none added.
  assert.equal(hexCount(styles), 608, `styles.css hex count moved (${hexCount(styles)})`);
  assert.equal(hexCount(navCss), 163, `nav.css hex count moved (${hexCount(navCss)})`);
  assert.equal(hexCount(components), 0, `components.css hex count moved (${hexCount(components)})`);
});

test('plan566 G3: EN and UR key sets are identical (no key added in one language only)', () => {
  const en = Object.keys(TRANSLATIONS.en).sort();
  const ur = Object.keys(TRANSLATIONS.ur).sort();
  assert.deepEqual(en, ur, 'the two languages must carry exactly the same keys');
});
