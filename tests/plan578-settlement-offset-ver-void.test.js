// Plan 578 — settlement and offset receipts carry a VER code; a reversed
// offset reads as void.
//
// The two remaining secondary builders gain a `verificationCode` field
// (the same `receiptVerificationCode` helper as the kist receipt, D1(a):
// the settlement code binds `refundAmount` — the receipt's headline
// "Net Refund" figure, the money that actually moves; the offset code
// binds `entry.amount`). Each of the two HTML sheets gains one Verify
// row directly after the Status row — the last field row, the main
// receipt's position (D2(a)) — in the kist-conditional form
// `receipt.verificationCode ? … : ''` (D3(a)), so hand-built receipts
// without the field print no row and no wrong code can ever print.
// The offset sheet's `statusClass` ternary flips from
// `receipt-status-partial` to `receipt-status-void` when reversed
// (D7(a), class only — no VOID banner, no CSS change; the void rules
// already exist). The Verify-dialog lookup stays payment-only
// (D5(a)) — disclosed in the PR body, not smuggled in here.
//
// Fixtures are synthetic (copied from the prep's repro-578.mjs, which
// copies the deposit-settlement / deposit-to-bill-offset / Sharafat-47
// fixtures). No real customer names or numbers anywhere.
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
import { verifyReceiptCode, receiptCodeForReceipt } from '../receipt-verifier.js';
import { createInstallmentPlan } from '../installment-plan.js';
import { applyDepositSettlement } from '../hardware-custody.js';
import { applyActiveDepositOffset, reverseActiveDepositOffset } from '../deposit-to-bill-offset.js';
import { TRANSLATIONS } from '../nav-language.js';

const CODE_RE = /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{2}$/;
const VERIFY_ROW = '<dt>Verify / تصدیق:</dt>';
const STATUS_ROW = '<dt>Status / کیفیت:</dt>';
const PRINT_OPTS = { businessName: 'Shahdara ISP', businessPhone: '03012345678', areaName: 'Shahdara, Islamabad', receiptFooter: '' };

// ---- fixtures (synthetic, copied from repro-578.mjs) ----
const customer = {
  id: 'synthetic-customer-1', customerNumber: 42, name: 'Synthetic Customer',
  mohalla: 'Charyaa', zone: 'Zone 1',
  bills: [{ id: 'bill-2026-10', month: '2026-10', dueAmount: 3000, status: 'pending', payments: [] }]
};

const disconnected = {
  ...customer, customerNumber: 41, archived: true, archivedAt: '2026-10-05T10:00', securityDeposit: 2000,
  routerOwnership: 'isp-owned', mediaConverterOwnership: 'isp-owned',
  routerPrice: 1500, mediaConverterCost: 800,
  hardwareRecovered: { router: '2026-10-06', mediaConverter: '2026-10-06' },
  bills: [{ id: 'bill-sep', month: '2026-09', dueAmount: 1200, status: 'pending', payments: [] }]
};
const settled = applyDepositSettlement(disconnected, 1200, { date: '2026-10-29', billBalances: [{ month: '2026-09', balanceDue: 1200 }] });
const settlementReceipt = buildDepositSettlementReceipt(settled);
const settlementHtml = generateDepositSettlementReceiptHtml(settlementReceipt, PRINT_OPTS);

const partialSettled = applyDepositSettlement({ ...disconnected, securityDeposit: 500 }, 1200, { date: '2026-10-29', billBalances: [{ month: '2026-09', balanceDue: 1200 }] });
const partialReceipt = buildDepositSettlementReceipt(partialSettled);
const partialHtml = generateDepositSettlementReceiptHtml(partialReceipt, PRINT_OPTS);

const active = { ...customer, archived: false, isFreeConnection: false, securityDeposit: 5000 };
const offsetCustomer = applyActiveDepositOffset(active, 3000, { date: '2026-10-15', amount: 3000, billBalances: [{ month: '2026-10', balanceDue: 3000 }] });
const offsetReceipt = buildDepositOffsetReceipt(offsetCustomer, 'DOF-101');
const offsetHtml = generateDepositOffsetReceiptHtml(offsetReceipt, PRINT_OPTS);

const reversedCustomer = reverseActiveDepositOffset(offsetCustomer, 'DOF-101', { date: '2026-10-20' });
const reversedReceipt = buildDepositOffsetReceipt(reversedCustomer, 'DOF-101');
const reversedHtml = generateDepositOffsetReceiptHtml(reversedReceipt, PRINT_OPTS);

const kistPlan = createInstallmentPlan({ itemTitle: 'Tenda F3 Router', totalAmount: 24000, downPayment: 4000, monthlyKist: 5000, totalMonths: 4, startDate: '2026-11-01' });
const kistReceipt = buildDownPaymentKistReceipt(customer, kistPlan, { amount: 4000, date: '2026-11-01', method: 'Cash', id: 'pay-4000' });
const kistHtml = buildDownPaymentKistReceiptHtml(kistReceipt, PRINT_OPTS);

// Plan-q-shaped hand-built fixtures WITHOUT a verificationCode field —
// the kist-conditional form (D3(a)) must print no Verify row for these.
const handBuiltSettlement = { receiptNumber: 'REC-2610-0041-DSET', settlementDate: '2026-10-29', customerId: '41', customerName: 'Synthetic Customer', securityDeposit: 2000, arrearsOffset: 1200, offsets: [], hardwareCharges: [], unrecoveredHardwareCharge: 0, hardwareCovered: 0, refundAmount: 800, arrearsRemaining: 0, hardwareOutstanding: 0, status: 'CLEARED', urduNote: '' };
const handBuiltOffset = { receiptNumber: 'REC-2610-0042-F101', offsetId: 'DOF-101', offsetDate: '2026-10-15', customerId: '42', customerName: 'Synthetic Customer', bills: [], depositBefore: 5000, amount: 3000, depositAfter: 2000, reversed: false, reversedAt: null, status: 'OFFSET APPLIED', urduNote: '' };

/* ---------------- G1 — the builder VER codes ---------------- */

test('plan578 G1: settlement builder returns a XXXX-XX verification code', () => {
  assert.equal(typeof settlementReceipt.verificationCode, 'string', 'settlement builder must carry a verificationCode');
  assert.ok(CODE_RE.test(settlementReceipt.verificationCode), `settlement code must match XXXX-XX, got ${settlementReceipt.verificationCode}`);
});

test('plan578 G1: offset builder returns a XXXX-XX verification code', () => {
  assert.equal(typeof offsetReceipt.verificationCode, 'string', 'offset builder must carry a verificationCode');
  assert.ok(CODE_RE.test(offsetReceipt.verificationCode), `offset code must match XXXX-XX, got ${offsetReceipt.verificationCode}`);
});

test('plan578 G1: settlement code verifies for receipt number + customer + refundAmount + settlement date (D1(a))', () => {
  assert.ok(verifyReceiptCode(settlementReceipt.verificationCode, {
    receiptId: settlementReceipt.receiptNumber, customerId: settlementReceipt.customerId,
    amountPaid: settlementReceipt.refundAmount, date: settlementReceipt.settlementDate
  }), 'settlement code must verify for its own figures — refundAmount is the bound amount (D1(a))');
});

test('plan578 G1: offset code verifies for receipt number + customer + amount + offset date', () => {
  assert.ok(verifyReceiptCode(offsetReceipt.verificationCode, {
    receiptId: offsetReceipt.receiptNumber, customerId: offsetReceipt.customerId,
    amountPaid: offsetReceipt.amount, date: offsetReceipt.offsetDate
  }), 'offset code must verify for its own figures');
});

test('plan578 G1: both builder codes are deterministic (same inputs, same code)', () => {
  const settlementAgain = buildDepositSettlementReceipt(settled);
  assert.equal(settlementAgain.verificationCode, settlementReceipt.verificationCode, 'settlement code must be deterministic');
  const offsetAgain = buildDepositOffsetReceipt(offsetCustomer, 'DOF-101');
  assert.equal(offsetAgain.verificationCode, offsetReceipt.verificationCode, 'offset code must be deterministic');
});

test('plan578 G1: settlement code is tamper-evident for the refund figure and the date', () => {
  assert.ok(!verifyReceiptCode(settlementReceipt.verificationCode, {
    receiptId: settlementReceipt.receiptNumber, customerId: settlementReceipt.customerId,
    amountPaid: settlementReceipt.refundAmount + 100, date: settlementReceipt.settlementDate
  }), 'a refund changed by 100 must fail verification');
  assert.ok(!verifyReceiptCode(settlementReceipt.verificationCode, {
    receiptId: settlementReceipt.receiptNumber, customerId: settlementReceipt.customerId,
    amountPaid: settlementReceipt.refundAmount, date: '2026-10-30'
  }), 'a settlement date changed by one day must fail verification');
});

test('plan578 G1: offset code is tamper-evident for the amount and the customer', () => {
  assert.ok(!verifyReceiptCode(offsetReceipt.verificationCode, {
    receiptId: offsetReceipt.receiptNumber, customerId: offsetReceipt.customerId,
    amountPaid: offsetReceipt.amount + 100, date: offsetReceipt.offsetDate
  }), 'an offset amount changed by 100 must fail verification');
  assert.ok(!verifyReceiptCode(offsetReceipt.verificationCode, {
    receiptId: offsetReceipt.receiptNumber, customerId: '43',
    amountPaid: offsetReceipt.amount, date: offsetReceipt.offsetDate
  }), 'a different customer must fail verification');
});

/* ---------------- G2 — the HTML VER rows ---------------- */

test('plan578 G2: settlement sheet prints a Verify row with its own code', () => {
  assert.ok(settlementHtml.includes(VERIFY_ROW), 'settlement sheet must carry the Verify row');
  assert.ok(settlementHtml.includes(`VER: ${settlementReceipt.verificationCode}`), 'settlement Verify row must carry the builder code');
});

test('plan578 G2: offset sheet prints a Verify row with its own code', () => {
  assert.ok(offsetHtml.includes(VERIFY_ROW), 'offset sheet must carry the Verify row');
  assert.ok(offsetHtml.includes(`VER: ${offsetReceipt.verificationCode}`), 'offset Verify row must carry the builder code');
});

test('plan578 G2: settlement VER row sits AFTER the Status row (main-receipt position)', () => {
  assert.ok(settlementHtml.includes(STATUS_ROW), 'settlement sheet must carry the Status row');
  assert.ok(settlementHtml.indexOf(VERIFY_ROW) > settlementHtml.indexOf(STATUS_ROW), 'VER row must be the last field row, after Status (D2(a))');
});

test('plan578 G2: offset VER row sits AFTER the Status row (main-receipt position)', () => {
  assert.ok(offsetHtml.includes(STATUS_ROW), 'offset sheet must carry the Status row');
  assert.ok(offsetHtml.indexOf(VERIFY_ROW) > offsetHtml.indexOf(STATUS_ROW), 'VER row must be the last field row, after Status (D2(a))');
});

test('plan578 G2: hand-built receipts without a verificationCode print NO Verify row (D3(a))', () => {
  // The kist-conditional form prints nothing for hand-built sheets, so
  // no wrong code can ever print (the T3 trap: the main pattern would
  // derive 4J4N-13 over empty amount/date here).
  const settlementHandBuilt = generateDepositSettlementReceiptHtml(handBuiltSettlement, PRINT_OPTS);
  assert.ok(!settlementHandBuilt.includes(VERIFY_ROW), 'hand-built settlement without a code must print no Verify row');
  assert.ok(!settlementHandBuilt.includes('VER:'), 'hand-built settlement must print no VER text at all');
  const offsetHandBuilt = generateDepositOffsetReceiptHtml(handBuiltOffset, PRINT_OPTS);
  assert.ok(!offsetHandBuilt.includes(VERIFY_ROW), 'hand-built offset without a code must print no Verify row');
  assert.ok(!offsetHandBuilt.includes('VER:'), 'hand-built offset must print no VER text at all');
});

test('plan578 G2: Urdu-script mode renders the settlement Verify row as تصدیق (T9)', () => {
  const urdu = generateDepositSettlementReceiptHtml(settlementReceipt, { ...PRINT_OPTS, script: 'urdu' });
  assert.ok(urdu.includes('<dt>تصدیق:</dt>'), 'Urdu mode must relabel the Verify row via the existing map key (receipt-script.js:98)');
  assert.ok(urdu.includes(`VER: ${settlementReceipt.verificationCode}`), 'Urdu mode must keep the code itself');
});

/* ---------------- G3 — the void class ---------------- */

test('plan578 G3: reversed offset header mark is void REVERSED', () => {
  assert.ok(reversedHtml.includes('<span class="receipt-mark receipt-status-void">REVERSED</span>'), 'reversed offset header mark must be void, not partial');
});

test('plan578 G3: reversed offset Status row carries receipt-status-void', () => {
  const statusAt = reversedHtml.indexOf(STATUS_ROW);
  assert.ok(statusAt !== -1, 'reversed sheet must carry the Status row');
  const row = reversedHtml.slice(statusAt, statusAt + 200);
  assert.ok(row.includes('receipt-status-void'), `Status row must carry receipt-status-void, got ${row}`);
});

test('plan578 G3: reversed offset sheet contains NO receipt-status-partial anywhere', () => {
  assert.ok(!reversedHtml.includes('receipt-status-partial'), 'a reversed offset must read as void, never as a genuine partial');
});

test('plan578 G3: reversed offset still prints its VER row (D6(a))', () => {
  assert.ok(reversedHtml.includes(VERIFY_ROW), 'reversed offset must still print its Verify row');
  assert.ok(reversedHtml.includes(`VER: ${reversedReceipt.verificationCode}`), 'reversed offset Verify row must carry the builder code');
  assert.equal(reversedReceipt.verificationCode, offsetReceipt.verificationCode, 'the code is computed from the same entry facts before and after reversal');
});

test('plan578 G3: live offset still renders receipt-status-paid', () => {
  assert.ok(offsetHtml.includes('receipt-status-paid'), 'live offset must stay paid');
  assert.ok(!offsetHtml.includes('receipt-status-partial'), 'live offset must not read partial');
  assert.ok(!offsetHtml.includes('receipt-status-void'), 'live offset must not read void');
});

test('plan578 G3: CLEARED settlement stays paid and PARTIALLY CLEARED stays partial (genuine partial, T8)', () => {
  assert.ok(settlementHtml.includes('receipt-status-paid'), 'CLEARED settlement must stay paid');
  assert.ok(!settlementHtml.includes('receipt-status-void'), 'CLEARED settlement must not read void');
  assert.ok(partialHtml.includes('receipt-status-partial'), 'PARTIALLY CLEARED is a genuine partial — money still outstanding, not a void');
  assert.ok(!partialHtml.includes('receipt-status-void'), 'PARTIALLY CLEARED must not read void');
});

/* ---------------- G4 — guards ---------------- */

test('plan578 G4: kist builder + HTML unchanged (code + row identical)', () => {
  assert.ok(CODE_RE.test(kistReceipt.verificationCode ?? ''), 'kist builder must keep its VER code');
  assert.ok(kistHtml.includes(VERIFY_ROW) && kistHtml.includes(`VER: ${kistReceipt.verificationCode}`), 'kist sheet must keep its VER row');
});

test('plan578 G4: main A4 receipt still prints its VER stamp', () => {
  const bill = { id: 'bill-2026-08', month: '2026-08', dueAmount: 2000, status: 'pending', payments: [] };
  const payment = { id: 'pay-print-1', amount: 2000, date: '2026-08-07', method: 'Cash' };
  bill.payments = [payment];
  const mainCustomer = { id: 'synthetic-customer', customerNumber: 42, name: 'Synthetic Customer', mohalla: 'Charyaa', zone: 'Zone 1', packageSpeed: '5 Mbps', packageHistory: [], bills: [bill] };
  const mainReceipt = buildPaymentReceipt(mainCustomer, bill, payment);
  const mainA4 = generatePaymentReceiptHtml(mainReceipt, { format: 'a4', businessName: 'Shahdara Fiber Net' });
  assert.ok(mainA4.includes(`VER: ${mainReceipt.verificationCode}`), 'main A4 receipt must keep its VER stamp');
});

test('plan578 G4: receiptCodeForReceipt on a payment receipt still equals its verificationCode', () => {
  const bill = { id: 'bill-2026-08', month: '2026-08', dueAmount: 2000, status: 'pending', payments: [] };
  const payment = { id: 'pay-print-1', amount: 2000, date: '2026-08-07', method: 'Cash' };
  bill.payments = [payment];
  const mainCustomer = { id: 'synthetic-customer', customerNumber: 42, name: 'Synthetic Customer', mohalla: 'Charyaa', zone: 'Zone 1', packageSpeed: '5 Mbps', packageHistory: [], bills: [bill] };
  const mainReceipt = buildPaymentReceipt(mainCustomer, bill, payment);
  assert.equal(receiptCodeForReceipt(mainReceipt), mainReceipt.verificationCode, 'the payment-receipt derivation is untouched (receipt-verifier.test.js:104 pin, restated)');
});

test('plan578 G4: all settlement/offset figures unchanged (one display field added, no figure moves)', () => {
  assert.equal(settlementReceipt.refundAmount, 800, 'refund figure must not move');
  assert.equal(settlementReceipt.securityDeposit, 2000, 'deposit figure must not move');
  assert.equal(settlementReceipt.arrearsOffset, 1200, 'arrears-offset figure must not move');
  assert.equal(offsetReceipt.amount, 3000, 'offset amount must not move');
  assert.equal(offsetReceipt.depositBefore, 5000, 'deposit-before must not move');
  assert.equal(offsetReceipt.depositAfter, 2000, 'deposit-after must not move');
});

test('plan578 G4: EN/UR parity stays 4,669/4,669 — no new i18n keys', () => {
  // Plan 582 (D1(b)): re-pinned 4,675 → 4,669 — six orphan
  // dash_tile_collect_*/dash_tile_closing_* keys deleted.
  // Plan 584: +38 ledger_filter_* keys — parity 4,669 → 4,707/4,707.
  // Plan 585: +16 global_search_* keys — parity 4,707 → 4,723/4,723.
  // Plan 586: drawer_settings deleted (dead key) — parity 4,723 → 4,722/4,722.
  assert.equal(Object.keys(TRANSLATIONS.en).length, 5228, 'EN key count moved');
  assert.equal(Object.keys(TRANSLATIONS.ur).length, 5228, 'UR key count moved');
});
