// Plan 559 — Combined receipt identifies each leg fully.
//
// NOTE ON THE TITLE: the design file (plan-491-to-600.md) titles this
// plan "Combined receipt identifies each leg fully". A briefing note
// for this plan described it instead as "Split reprint keeps voided
// leg visible" — that defect does NOT exist at this head: the probe
// below (and the Plan 557 void test) shows a reprint after voiding a
// leg still lists BOTH legs, the voided one marked (VOIDED), with the
// total correctly excluding it (buildSplitTenderReceipt's
// `liveLegs` filter feeds only the total, never the leg list; the
// module header states the same). So this plan implements the design
// file as written, and the voided-leg visibility is pinned here as a
// guard, not a fix.
//
// THE THREE DEFECTS (all confirmed live by probe before writing
// tests): (1) formatSplitTenderWhatsAppText prints
// `📌 *Status:* Paid in Full / مکمل ادا شدہ` for PAID but falls
// through to the raw `combined.status` otherwise — PARTIAL prints as
// bare "PARTIAL" and an all-voided split as bare "VOID", with no Urdu
// and no explanation. (2) generateSplitTenderReceiptHtml's legRows
// print each leg's Transaction ID under the identical label
// "Transaction ID:" with no leg qualifier, so when both legs are
// digital the two TID rows are indistinguishable (the WhatsApp leg
// lines and the receipt-number rows already carry the leg label).
// (3) buildSplitTenderReceipt's `legs` map keeps only leg,
// paymentId, receiptNumber, method, amount, transactionId, date,
// voided — the sender metadata (SISP-63: senderTitle/senderDigits,
// read back as `senderLabel` on the single receipt) and the payer
// name (Plan 378, `paidBy`) that executeQuickCollection stamps on
// each leg payment are dropped, so the combined receipt cannot show
// who paid a digital leg or whose account sent it, while the
// single-payment receipt and the PNG slip both show both. The per-leg
// buildPaymentReceipt calls inside the same function already compute
// them; they are just not carried onto the leg objects.
//
// THE FIX (split-tender-collect.js only): bilingual status text for
// PARTIAL and VOID, same pattern as the PAID line (hardcoded bilingual
// literals in the module — the Urdu words are the app's own dictionary
// values: status_partial 'جزوی ادا شدہ', split_voided_leg 'منسوخ');
// each HTML TID row qualified with its leg (t('split_leg_label'),
// the same pattern as the receipt-number row); senderLabel and paidBy
// carried from each leg's receipt onto the leg object and rendered on
// both combined surfaces, only when present (same conditional pattern
// as the single receipt: HTML 'Sender / بھیجنے والا' and
// 'Paid by / ادا کنندہ' rows after the TID row, payer right after
// sender; WhatsApp leg lines gain ' · Sender / بھیجنے والا: …' and
// ' · Paid by / ادا کنندہ: …' after the receipt number, so each leg
// stays one identifiable block). No change to status computation or
// leg recording. No new i18n key, hex, store key or element id.
//
// OUT OF SCOPE (recorded, not fixed): the HTML receipt-mark still
// shows the raw status code — the single receipt's HTML does the same
// (receipt.js status rows print the raw code), and the spec's scope
// is the WhatsApp pattern; the QC success-step card
// (renderSplitReceiptCardHtml) is Plan 579's job, so its leg rows
// stay untouched here.
//
// Pattern-fake data only: Test Customer, Test Payer, Hamza, EP99887766.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { saveBillMonth } from '../core.js';
import { executeQuickCollection } from '../nav-quick-collect.js';
import {
  executeSplitTenderCollection, buildSplitTenderReceipt,
  formatSplitTenderWhatsAppText, generateSplitTenderReceiptHtml
} from '../split-tender-collect.js';
import { voidPayment } from '../payment-void-audit.js';

const NOW = new Date('2026-10-29T12:00:00+05:00');
const MONTH = '2026-10';
const DATE = '2026-10-29';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const splitSrc = read('split-tender-collect.js');

// Two bills: an older September bill (PKR 2,000, unpaid) and the
// current October bill (1,000 package + 195 tax = 1,195 due). The
// split settles October in full: 1,000 Cash + 195 Easypaisa — but
// September is still owed, so the combined status is PARTIAL.
function multiMonthFixture() {
  let s = { version: 1, nextCustomerNumber: 2, customers: [{
    id: 'a', customerNumber: 1, name: 'Test Customer', phone: '03000000001',
    area: 'Shahdara', archived: false, bills: [],
    monthlySellingAmount: 1000, packageSpeed: '3Mbps / 100GB'
  }] };
  s = saveBillMonth(s, 'a', { month: '2026-09', dueAmount: 2000, status: 'pending' }, NOW);
  s = saveBillMonth(s, 'a', { month: MONTH, dueAmount: 1195, packageId: '3mbps-100gb', salesTaxCents: 19500, status: 'pending' }, NOW);
  return s;
}
const multiMonthSpec = {
  customerId: 'a', month: MONTH, date: DATE, paidBy: 'Self',
  legs: [
    { amount: 1000, method: 'Cash' },
    { amount: 195, method: 'Easypaisa', transactionId: 'EP99887766' }
  ]
};

// A single-month split settled in full (the Plan 557 taxed shape):
// 1,000 package + 195 tax = 1,195 due, settled 1,000 Cash + 195
// Easypaisa. Nothing is owed afterwards.
function settledFixture() {
  let s = { version: 1, nextCustomerNumber: 2, customers: [{
    id: 'a', customerNumber: 1, name: 'Test Customer', phone: '03000000001',
    area: 'Shahdara', archived: false, bills: [],
    monthlySellingAmount: 1000, packageSpeed: '3Mbps / 100GB'
  }] };
  s = saveBillMonth(s, 'a', { month: MONTH, dueAmount: 1195, packageId: '3mbps-100gb', salesTaxCents: 19500, status: 'pending' }, NOW);
  return s;
}
const settledSpec = multiMonthSpec;

// An untaxed, unpackaged split (the SISP-121 shape): 3,000 due,
// settled 2,000 Cash + 1,000 Easypaisa. No sender, no payer.
function untaxedFixture() {
  let s = { version: 1, nextCustomerNumber: 2, customers: [{
    id: 'a', customerNumber: 1, name: 'Test Customer', phone: '03000000001',
    area: 'Shahdara', archived: false, bills: []
  }] };
  s = saveBillMonth(s, 'a', { month: MONTH, dueAmount: 3000, status: 'pending' }, NOW);
  return s;
}
const untaxedSpec = {
  customerId: 'a', month: MONTH, date: DATE,
  legs: [
    { amount: 2000, method: 'Cash' },
    { amount: 1000, method: 'Easypaisa', transactionId: 'EP99887766' }
  ]
};

// Two digital legs on one bill (2,000 due): Easypaisa + JazzCash,
// each with its own TID — the HTML TID rows must say which is which.
function twoDigitalFixture() {
  let s = { version: 1, nextCustomerNumber: 2, customers: [{
    id: 'a', customerNumber: 1, name: 'Test Customer', phone: '03000000001',
    area: 'Shahdara', archived: false, bills: []
  }] };
  s = saveBillMonth(s, 'a', { month: MONTH, dueAmount: 2000, status: 'pending' }, NOW);
  return s;
}
const twoDigitalSpec = {
  customerId: 'a', month: MONTH, date: DATE,
  legs: [
    { amount: 1000, method: 'Easypaisa', transactionId: 'EP11111111' },
    { amount: 1000, method: 'JazzCash', transactionId: 'JC22222222' }
  ]
};

// The taxed split, but the digital leg carries sender proof
// (SISP-63: Hamza, last-4 3310) and the split names its payer.
const senderSpec = {
  customerId: 'a', month: MONTH, date: DATE, paidBy: 'Test Payer',
  legs: [
    { amount: 1000, method: 'Cash' },
    { amount: 195, method: 'Easypaisa', transactionId: 'EP99887766', senderTitle: 'Hamza', senderDigits: '3310' }
  ]
};

const run = (state, spec) => executeSplitTenderCollection(state, spec, { execute: executeQuickCollection, referenceDate: NOW });

test('Plan 559 REPRO: a partial split\'s WhatsApp text reads a bilingual status', () => {
  const { combinedReceipt } = run(multiMonthFixture(), multiMonthSpec);
  assert.equal(combinedReceipt.status, 'PARTIAL', 'fixture is partial: September is still owed');
  const text = formatSplitTenderWhatsAppText(combinedReceipt);
  assert.ok(text.includes('📌 *Status:* Partially Paid / جزوی ادا شدہ'), 'partial status reads in both languages');
  assert.ok(!text.includes('📌 *Status:* PARTIAL'), 'the bare English code never reaches the customer');
});

test('Plan 559 REPRO: an all-voided split reads as voided in both languages', () => {
  const { nextState, combinedReceipt, splitGroupId } = run(settledFixture(), settledSpec);
  // Void BOTH legs, then rebuild the combined receipt from the ledger.
  let state = nextState;
  for (const leg of combinedReceipt.legs) {
    ({ state } = voidPayment(state, 'a', MONTH, leg.paymentId, { voidReason: 'Wrong wallet' }));
  }
  const rebuilt = buildSplitTenderReceipt(state, 'a', splitGroupId);
  assert.equal(rebuilt.status, 'VOID', 'both legs voided');
  const text = formatSplitTenderWhatsAppText(rebuilt);
  assert.ok(text.includes('📌 *Status:* Void / منسوخ'), 'voided status reads in both languages');
  assert.ok(!text.includes('📌 *Status:* VOID'), 'the bare English code never reaches the customer');
});

test('Plan 559: the PAID status line is unchanged', () => {
  const { combinedReceipt } = run(settledFixture(), settledSpec);
  assert.equal(combinedReceipt.status, 'PAID', 'fixture is fully paid');
  const text = formatSplitTenderWhatsAppText(combinedReceipt);
  assert.ok(text.includes('📌 *Status:* Paid in Full / مکمل ادا شدہ'), 'the existing bilingual PAID line is byte-identical');
});

test('Plan 559 REPRO: a two-digital-leg HTML receipt shows which TID belongs to which leg', () => {
  const { combinedReceipt } = run(twoDigitalFixture(), twoDigitalSpec);
  const html = generateSplitTenderReceiptHtml(combinedReceipt);
  const leg1Tid = html.indexOf('Transaction ID (Leg 1):');
  const leg2Tid = html.indexOf('Transaction ID (Leg 2):');
  assert.ok(leg1Tid > -1, 'leg 1 TID row carries its leg');
  assert.ok(leg2Tid > -1, 'leg 2 TID row carries its leg');
  assert.ok(html.indexOf('EP11111111', leg1Tid) > -1 && html.indexOf('EP11111111', leg1Tid) < leg2Tid, 'leg 1 TID follows the leg 1 label');
  assert.ok(html.indexOf('JC22222222', leg2Tid) > -1, 'leg 2 TID follows the leg 2 label');
  assert.ok(!html.includes('<dt>Transaction ID:</dt>'), 'no unqualified TID row remains');
  // The WhatsApp leg lines already carried the leg label — pin that.
  const text = formatSplitTenderWhatsAppText(combinedReceipt);
  assert.ok(text.includes('Leg 1: Easypaisa — PKR 1,000 · TID EP11111111'), 'WhatsApp leg 1 line keeps its TID');
  assert.ok(text.includes('Leg 2: JazzCash — PKR 1,000 · TID JC22222222'), 'WhatsApp leg 2 line keeps its TID');
});

test('Plan 559 REPRO: a digital leg carrying sender proof shows the sender on both combined surfaces', () => {
  const { combinedReceipt } = run(settledFixture(), senderSpec);
  assert.equal(combinedReceipt.legs[1].senderLabel, 'Hamza (…3310)', 'the leg carries the SISP-63 sender label from its own receipt');
  assert.equal(combinedReceipt.legs[0].senderLabel, '', 'the cash leg carries no sender');
  const text = formatSplitTenderWhatsAppText(combinedReceipt);
  assert.ok(text.includes('Sender / بھیجنے والا: Hamza (…3310)'), 'WhatsApp shows the sender');
  assert.equal(text.split('Sender / بھیجنے والا').length - 1, 1, 'the sender shows once — on the leg that has it');
  const html = generateSplitTenderReceiptHtml(combinedReceipt);
  assert.ok(html.includes('<dt>Sender / بھیجنے والا:</dt><dd>Hamza (…3310)</dd>'), 'HTML shows the sender row');
  assert.equal(html.split('<dt>Sender / بھیجنے والا:</dt>').length - 1, 1, 'the sender row shows once');
});

test('Plan 559 REPRO: a split with a payer name shows it on both combined surfaces', () => {
  const { combinedReceipt } = run(settledFixture(), senderSpec);
  assert.equal(combinedReceipt.legs[0].paidBy, 'Test Payer', 'leg 1 carries the Plan 378 payer name');
  assert.equal(combinedReceipt.legs[1].paidBy, 'Test Payer', 'leg 2 carries the Plan 378 payer name');
  const text = formatSplitTenderWhatsAppText(combinedReceipt);
  assert.ok(text.includes('Paid by / ادا کنندہ: Test Payer'), 'WhatsApp shows the payer');
  const html = generateSplitTenderReceiptHtml(combinedReceipt);
  assert.ok(html.includes('<dt>Paid by / ادا کنندہ:</dt><dd>Test Payer</dd>'), 'HTML shows the payer row');
  // The payer row sits right after the sender row WITHIN a leg, like
  // the single receipt's transactionPayerReceiptField (after the
  // sender entry). Leg 1 has a payer but no sender, so its payer row
  // correctly precedes leg 2's sender row — the ordering rule is
  // per-leg, so check it inside leg 2's block.
  const leg2Block = html.slice(html.indexOf('Leg 2 —'));
  assert.ok(leg2Block.indexOf('<dt>Sender / بھیجنے والا:</dt>') > -1, 'leg 2 shows its sender row');
  assert.ok(leg2Block.indexOf('<dt>Paid by / ادا کنندہ:</dt>') > leg2Block.indexOf('<dt>Sender / بھیجنے والا:</dt>'), 'within leg 2, the payer row follows the sender row');
});

test('Plan 559: a split with neither sender nor payer shows neither (no blank rows)', () => {
  const { combinedReceipt } = run(untaxedFixture(), untaxedSpec);
  assert.equal(combinedReceipt.legs[0].senderLabel, '', 'cash leg: no sender');
  assert.equal(combinedReceipt.legs[1].senderLabel, '', 'digital leg without proof: no sender');
  assert.equal(combinedReceipt.legs[0].paidBy, '', 'no payer name recorded');
  assert.equal(combinedReceipt.legs[1].paidBy, '', 'no payer name recorded');
  const text = formatSplitTenderWhatsAppText(combinedReceipt);
  assert.ok(!text.includes('Sender'), 'WhatsApp shows no sender line');
  assert.ok(!text.includes('Paid by'), 'WhatsApp shows no payer line');
  assert.ok(text.includes('Leg 1: Cash — PKR 2,000 · Receipt No:'), 'leg 1 line reads exactly as before');
  assert.ok(text.includes('Leg 2: Easypaisa — PKR 1,000 · TID EP99887766 · Receipt No:'), 'leg 2 line reads exactly as before');
  const html = generateSplitTenderReceiptHtml(combinedReceipt);
  assert.ok(!html.includes('Sender / بھیجنے والا'), 'HTML shows no sender row');
  assert.ok(!html.includes('Paid by / ادا کنندہ'), 'HTML shows no payer row');
});

test('Plan 559 PIN: the legs map keeps its existing fields; a hand-built combined object renders as before', () => {
  const { combinedReceipt } = run(settledFixture(), settledSpec);
  assert.deepEqual(
    Object.keys(combinedReceipt.legs[0]).sort(),
    ['amount', 'date', 'leg', 'method', 'paidBy', 'paymentId', 'receiptNumber', 'senderLabel', 'transactionId', 'voided'],
    'the legs map gains exactly senderLabel + paidBy, nothing else'
  );
  // A hand-built combined object without either new field (the Plan
  // 557 pin shape) renders exactly as before — no sender/payer lines.
  const handBuilt = {
    splitGroupId: 'split-test', customerId: '1', customerNumber: 1, customerName: 'Test Customer',
    customerNameUrdu: '', phone: '03000000001', area: 'Shahdara', month: MONTH, date: DATE,
    package: '3Mbps / 100GB', salesTaxCents: 19500,
    legs: [
      { leg: 1, paymentId: 'p1', receiptNumber: 'REC-1', method: 'Cash', amount: 1000, transactionId: '', date: DATE, voided: false },
      { leg: 2, paymentId: 'p2', receiptNumber: 'REC-2', method: 'Easypaisa', amount: 195, transactionId: 'EP99887766', date: DATE, voided: false }
    ],
    totalReceivedCents: 119500, totalReceived: 1195, balanceDueCents: 0, status: 'PAID'
  };
  const text = formatSplitTenderWhatsAppText(handBuilt);
  assert.ok(text.includes('📌 *Status:* Paid in Full / مکمل ادا شدہ'), 'hand-built PAID object keeps its status line');
  assert.ok(!text.includes('Sender'), 'hand-built object shows no sender line');
  assert.ok(!text.includes('Paid by'), 'hand-built object shows no payer line');
  const html = generateSplitTenderReceiptHtml(handBuilt);
  assert.ok(!html.includes('Sender / بھیجنے والا'), 'hand-built HTML shows no sender row');
  assert.ok(!html.includes('Paid by / ادا کنندہ'), 'hand-built HTML shows no payer row');
  assert.ok(html.includes('<dt>Transaction ID (Leg 2):</dt><dd>EP99887766</dd>'), 'hand-built HTML qualifies the TID row too');
});

test('Plan 559 PIN: a voided leg keeps its sender line; the total still excludes it', () => {
  // The briefing's "voided leg dropped from the reprint" defect does
  // not exist at this head — this test pins the behaviour that IS
  // there, so the sender work cannot regress it.
  const { nextState, combinedReceipt, splitGroupId } = run(settledFixture(), senderSpec);
  const { state: afterVoid } = voidPayment(nextState, 'a', MONTH, combinedReceipt.legs[1].paymentId, { voidReason: 'Wrong wallet' });
  const rebuilt = buildSplitTenderReceipt(afterVoid, 'a', splitGroupId);
  assert.equal(rebuilt.legs.length, 2, 'no leg is dropped from the reprint');
  assert.equal(rebuilt.legs[1].voided, true, 'leg 2 is marked voided');
  assert.equal(rebuilt.legs[1].senderLabel, 'Hamza (…3310)', 'the voided leg keeps its sender');
  assert.equal(rebuilt.totalReceived, 1000, 'the total still excludes the voided leg');
  const text = formatSplitTenderWhatsAppText(rebuilt);
  assert.ok(text.includes('(VOIDED)'), 'the voided leg is marked on the reprint');
  assert.ok(text.includes('Sender / بھیجنے والا: Hamza (…3310)'), 'the voided leg keeps its sender line');
  assert.ok(text.includes('📌 *Status:* Partially Paid / جزوی ادا شدہ'), 'voiding reopens the leg amount, so the split reads partial');
});
