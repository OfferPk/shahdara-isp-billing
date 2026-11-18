// Plan 577 — kist, settlement and offset receipts carry the area and the
// terms line.
//
// The three secondary builders gain the `area` field (polish #12's exact
// derivation, D5(a)); each of the three HTML sheets gains one
// "Area / علاقہ" row directly after the Customer Name row (D1(a), colon
// form D2(a)) and one bare receiptTermsNoteHtml() call directly after the
// Urdu-note div, before the <footer> (D3(a), D6(a)). The two exact-3
// call-count pins (polish7:82, plan570:245–246) are re-pinned to 6 in
// their own files (D4(a)) — this file owns the secondary-sheet area +
// terms behaviour.
//
// Fixtures are synthetic (copied from the prep's repro-577.mjs). The
// support number is pinned by label + pattern only (T13, polish7
// precedent) — it is never re-typed in this file.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDownPaymentKistReceipt,
  buildDownPaymentKistReceiptHtml,
  buildDepositSettlementReceipt,
  generateDepositSettlementReceiptHtml,
  buildDepositOffsetReceipt,
  generateDepositOffsetReceiptHtml,
  buildPaymentReceipt,
  generatePaymentReceiptHtml
} from '../receipt.js';
import { RECEIPT_TERMS_PHRASE, RECEIPT_SUPPORT_LINE } from '../receipt-terms.js';
import { createInstallmentPlan } from '../installment-plan.js';
import { applyDepositSettlement } from '../hardware-custody.js';
import { applyActiveDepositOffset } from '../deposit-to-bill-offset.js';
import { TRANSLATIONS } from '../nav-language.js';

// Polish #7 precedent (tests/polish7-receipt-terms.test.js:29–30): the
// support number is pinned by label + pattern only, never re-typed.
const SUPPORT_LABEL = 'ٹیکنیکل سپورٹ کے لیے سعد سے رابطہ کریں:';
const PHONE_PATTERN = /\+92 3\d{2} \d{7}/;
const AREA_ROW = '<dt>Area / علاقہ:</dt>';
const FOOTER_OPEN = '<footer class="receipt-terms">';

// ---- fixtures (synthetic, copied from repro-577.mjs) ----
const customer = {
  id: 'synthetic-customer-1', customerNumber: 42, name: 'Synthetic Customer',
  mohalla: 'Charyaa', zone: 'Zone 1',
  bills: [{ id: 'bill-2026-10', month: '2026-10', dueAmount: 3000, status: 'pending', payments: [] }]
};
const noAreaCustomer = { ...customer, mohalla: undefined, zone: undefined };
const mohallaOnlyCustomer = { ...customer, zone: undefined };

const plan = () => createInstallmentPlan({
  itemTitle: 'Tenda F3 Router', totalAmount: 24000, downPayment: 4000,
  monthlyKist: 5000, totalMonths: 4, startDate: '2026-11-01'
});
const kistReceipt = buildDownPaymentKistReceipt(customer, plan(), { amount: 4000, date: '2026-11-01', method: 'Cash', id: 'pay-4000' });
const kistHtml = buildDownPaymentKistReceiptHtml(kistReceipt, { businessName: 'Shahdara ISP', businessPhone: '03012345678', areaName: 'Shahdara, Islamabad', receiptFooter: '' });

const disconnected = {
  ...customer, archived: true, archivedAt: '2026-10-05T10:00', securityDeposit: 2000,
  routerOwnership: 'isp-owned', mediaConverterOwnership: 'isp-owned',
  routerPrice: 1500, mediaConverterCost: 800,
  hardwareRecovered: { router: '2026-10-06', mediaConverter: '2026-10-06' },
  bills: [{ id: 'bill-sep', month: '2026-09', dueAmount: 1200, status: 'pending', payments: [] }]
};
const settled = applyDepositSettlement(disconnected, 1200, { date: '2026-10-29', billBalances: [{ month: '2026-09', balanceDue: 1200 }] });
const settlementReceipt = buildDepositSettlementReceipt(settled);
const settlementHtml = generateDepositSettlementReceiptHtml(settlementReceipt, { businessName: 'Shahdara ISP', businessPhone: '03012345678', areaName: 'Shahdara, Islamabad', receiptFooter: '' });

const active = { ...customer, archived: false, isFreeConnection: false, securityDeposit: 5000 };
const offsetCustomer = applyActiveDepositOffset(active, 3000, { date: '2026-10-15', amount: 3000, billBalances: [{ month: '2026-10', balanceDue: 3000 }] });
const offsetReceipt = buildDepositOffsetReceipt(offsetCustomer, 'DOF-101');
const offsetHtml = generateDepositOffsetReceiptHtml(offsetReceipt, { businessName: 'Shahdara ISP', businessPhone: '03012345678', areaName: 'Shahdara, Islamabad', receiptFooter: '' });

/* ---------------- G1 — the builder area field ---------------- */

test('plan577 G1: kist builder returns the customer area (mohalla + zone)', () => {
  assert.equal(kistReceipt.area, 'Charyaa, Zone 1');
});

test('plan577 G1: settlement builder returns the customer area (mohalla + zone)', () => {
  assert.equal(settlementReceipt.area, 'Charyaa, Zone 1');
});

test('plan577 G1: offset builder returns the customer area (mohalla + zone)', () => {
  assert.equal(offsetReceipt.area, 'Charyaa, Zone 1');
});

test('plan577 G1: kist builder stores Not recorded when neither mohalla nor zone is set', () => {
  const receipt = buildDownPaymentKistReceipt(noAreaCustomer, plan(), { amount: 4000, date: '2026-11-01', method: 'Cash', id: 'pay-4000b' });
  assert.equal(receipt.area, 'Not recorded');
});

test('plan577 G1: settlement builder stores Not recorded when neither mohalla nor zone is set', () => {
  // The same one-liner as the kist builder — pinned on a second builder
  // so the copy is proven, not assumed. The fixture spreads `settled`
  // (the stamped customer), not `disconnected` — the builder returns
  // null without a depositSettlement stamp.
  const receipt = buildDepositSettlementReceipt({ ...settled, mohalla: undefined, zone: undefined });
  assert.equal(receipt.area, 'Not recorded');
});

test('plan577 G1: kist builder returns the mohalla alone when no zone is set', () => {
  const receipt = buildDownPaymentKistReceipt(mohallaOnlyCustomer, plan(), { amount: 4000, date: '2026-11-01', method: 'Cash', id: 'pay-4000c' });
  assert.equal(receipt.area, 'Charyaa');
});

/* ---------------- G2 — the HTML Area row ---------------- */

test('plan577 G2: kist sheet shows the Area row with the value, directly after the Name row', () => {
  assert.ok(kistHtml.includes(AREA_ROW), 'kist sheet must carry the Area row');
  assert.ok(kistHtml.includes('Charyaa, Zone 1'), 'kist Area row must carry the value');
  assert.ok(kistHtml.indexOf(AREA_ROW) > kistHtml.indexOf('Customer Name / صارف کا نام:'), 'Area row must sit after the Name row');
  assert.ok(kistHtml.indexOf(AREA_ROW) < kistHtml.indexOf('Item / چیز:'), 'Area row must sit before the Item row');
});

test('plan577 G2: settlement sheet shows the Area row with the value, directly after the Name row', () => {
  assert.ok(settlementHtml.includes(AREA_ROW), 'settlement sheet must carry the Area row');
  assert.ok(settlementHtml.includes('Charyaa, Zone 1'), 'settlement Area row must carry the value');
  assert.ok(settlementHtml.indexOf(AREA_ROW) > settlementHtml.indexOf('Customer Name / صارف کا نام:'), 'Area row must sit after the Name row');
});

test('plan577 G2: offset sheet shows the Area row with the value, directly after the Name row', () => {
  assert.ok(offsetHtml.includes(AREA_ROW), 'offset sheet must carry the Area row');
  assert.ok(offsetHtml.includes('Charyaa, Zone 1'), 'offset Area row must carry the value');
  assert.ok(offsetHtml.indexOf(AREA_ROW) > offsetHtml.indexOf('Customer Name / صارف کا نام:'), 'Area row must sit after the Name row');
  assert.ok(offsetHtml.indexOf(AREA_ROW) < offsetHtml.indexOf('Method / طریقہ:'), 'Area row must sit before the Method row');
});

test('plan577 G2: hand-built kist HTML without an area field shows the Not recorded row', () => {
  // Plan-q fixture shape: a receipt built by hand, with no `area` key.
  const html = buildDownPaymentKistReceiptHtml({ receiptNumber: 'R1', paymentDate: '2026-10-17', customerId: '42', customerName: 'C', itemTitle: 'Router', paymentMethod: 'Cash', totalAmount: 12000, paidDownPayment: 4000, monthlyKist: 2000, totalMonths: 4, remainingAfterDownPayment: 8000, urduNote: '', schedule: [] });
  assert.ok(html.includes(AREA_ROW), 'hand-built kist sheet must still carry the Area row');
  assert.ok(html.includes('Not recorded'), 'hand-built kist Area row must fall back to Not recorded');
});

/* ---------------- G3 — the terms block ---------------- */

test('plan577 G3: kist sheet carries the terms phrase', () => {
  assert.ok(kistHtml.includes(RECEIPT_TERMS_PHRASE), 'kist sheet must carry the terms phrase');
});

test('plan577 G3: settlement sheet carries the terms phrase', () => {
  assert.ok(settlementHtml.includes(RECEIPT_TERMS_PHRASE), 'settlement sheet must carry the terms phrase');
});

test('plan577 G3: offset sheet carries the terms phrase', () => {
  assert.ok(offsetHtml.includes(RECEIPT_TERMS_PHRASE), 'offset sheet must carry the terms phrase');
});

test('plan577 G3: the terms phrase sits AFTER the sheet’s own Urdu note on all three sheets', () => {
  for (const [html, receipt, name] of [[kistHtml, kistReceipt, 'kist'], [settlementHtml, settlementReceipt, 'settlement'], [offsetHtml, offsetReceipt, 'offset']]) {
    assert.ok(html.indexOf(RECEIPT_TERMS_PHRASE) > html.indexOf(receipt.urduNote), `terms phrase must sit after the Urdu note on the ${name} sheet`);
  }
});

test('plan577 G3: the terms block sits BEFORE the footer on all three sheets', () => {
  // On the settlement sheet the footer holds the signature boxes — the
  // terms must print before them, not after (T5).
  for (const [html, name] of [[kistHtml, 'kist'], [settlementHtml, 'settlement'], [offsetHtml, 'offset']]) {
    assert.ok(html.indexOf(RECEIPT_TERMS_PHRASE) < html.indexOf(FOOTER_OPEN), `terms block must sit before the footer on the ${name} sheet`);
  }
});

test('plan577 G3: the support line sits on all three sheets (label + number pattern only)', () => {
  for (const [html, name] of [[kistHtml, 'kist'], [settlementHtml, 'settlement'], [offsetHtml, 'offset']]) {
    assert.ok(html.includes(SUPPORT_LABEL), `support label missing on the ${name} sheet`);
    assert.match(html, PHONE_PATTERN, `support number pattern missing on the ${name} sheet`);
  }
  // The support-line constant itself starts with the label (polish7).
  assert.equal(RECEIPT_SUPPORT_LINE.startsWith(SUPPORT_LABEL), true);
});

/* ---------------- G4 — guards ---------------- */

test('plan577 G4: the main A4 receipt still shows area + terms, unchanged', () => {
  const bill = { id: 'bill-2026-08', month: '2026-08', dueAmount: 2000, status: 'pending', payments: [] };
  const payment = { id: 'pay-print-1', amount: 2000, date: '2026-08-07', method: 'Cash' };
  bill.payments = [payment];
  const mainCustomer = { id: 'synthetic-customer', customerNumber: 42, name: 'Synthetic Customer', mohalla: 'Charyaa', zone: 'Zone 1', packageSpeed: '5 Mbps', packageHistory: [], bills: [bill] };
  const mainReceipt = buildPaymentReceipt(mainCustomer, bill, payment);
  const mainA4 = generatePaymentReceiptHtml(mainReceipt, { format: 'a4', businessName: 'Shahdara Fiber Net' });
  assert.ok(mainA4.includes('<dt>Area / علاقہ</dt>'), 'main A4 must keep its Area row');
  assert.ok(mainA4.includes('Charyaa, Zone 1'), 'main A4 Area row must keep the value');
  assert.ok(mainA4.includes(RECEIPT_TERMS_PHRASE), 'main A4 must keep its terms phrase');
});

test('plan577 G4: the kist sheet still shows its VER row (578 boundary)', () => {
  assert.ok(kistHtml.includes(`VER: ${kistReceipt.verificationCode}`), 'kist VER row must survive 577');
});

test('plan577 G4: a reversed offset renders receipt-status-void (Plan 578 flips this guard)', () => {
  // Plan 578: the G4 guard this test file pinned as partial (577 owned
  // the void change) flips to void — a reversed offset reads as void,
  // never as a genuine partial payment.
  const reversed = buildDepositOffsetReceipt({ ...offsetCustomer, depositOffsets: offsetCustomer.depositOffsets.map((e) => ({ ...e, reversedAt: '2026-10-20' })) }, 'DOF-101');
  const html = generateDepositOffsetReceiptHtml(reversed, { businessName: 'Shahdara ISP', businessPhone: '03012345678', areaName: 'Shahdara, Islamabad', receiptFooter: '' });
  assert.ok(html.includes('receipt-status-void'), 'reversed offset must render receipt-status-void (Plan 578)');
  assert.ok(!html.includes('receipt-status-partial'), 'reversed offset must not read partial anymore');
  assert.ok(html.includes('REVERSED'), 'reversed offset must still read REVERSED');
});

test('plan577 G4: EN/UR parity stays 4,675/4,675 — no new i18n keys', () => {
  assert.equal(Object.keys(TRANSLATIONS.en).length, 4675, 'EN key count moved');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 4675, 'UR key count moved');
});

test('plan577 G4: Urdu-script mode relabels the new Area row on the kist sheet (map already covers it)', () => {
  const urdu = buildDownPaymentKistReceiptHtml(kistReceipt, { script: 'urdu' });
  assert.ok(urdu.includes('<dt>علاقہ:</dt>'), 'Urdu-mode kist sheet must read علاقہ:');
  assert.ok(!urdu.includes('Area / علاقہ:'), 'Urdu-mode kist sheet must not keep the Roman Area label');
});
