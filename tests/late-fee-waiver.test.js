// SISP-101: 1-Click Late-Fee Waiver (lateFeeWaived) & Audit Log in the
// Quick Collect modal. Synthetic data only.
//
// Pinned test criteria (spec): paying Rs. 3,000 principal on a Rs. 3,150
// bill (Rs. 150 late fee) with "Waive Late Fee" checked clears the
// balance to Rs. 0 and logs lateFeeWaived: true.
//
// Design pins (house rules):
//   - the deduction lands on the BILL via core's waiveLateFeeFromBill
//     (bill.lateFee -> 0, amountHistory 'late_fee_waived'); the payment
//     carries the audit pair + the reversal stamp of the pre-waiver fee;
//   - the gate is full-principal only — a partial payment refuses the
//     whole collection and records nothing;
//   - voiding the payment restores exactly the stamped fee (unless the
//     owner applied a newer fee meanwhile — never clobbered);
//   - deleting a waiver payment is refused until the fee is restored
//     (the Quick Collect undo restores it first);
//   - the waived fee is never counted as collected cash;
//   - every receipt surface prints the waived line, and every
//     non-waiver receipt renders exactly as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState, updateCustomerProfile, generateMonthlyBillsThroughCurrentMonth,
  applyLateFeeToBill, addPayment, correctPayment, deletePayment,
  calculatePaymentAllocations, validatePayment, summarizeCustomerReceipts,
  createJsonBackup, previewJsonBackupMerge
} from '../core.js';
import { executeQuickCollection, formatQuickCollectWhatsAppReceipt } from '../nav-quick-collect.js';
import { voidPayment, sanitizeVoidPayments } from '../payment-void-audit.js';
import {
  lateFeeWaiverOf, sanitizeWaivedLateFeeStamp, waivedLateFeeStampFor,
  planLateFeeWaiver, restoreWaivedLateFee
} from '../late-fee-waiver.js';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import { buildPngReceiptModel } from '../png-receipt.js';
import { buildEscPosReceipt, escPosFieldsFromPaymentReceipt } from '../thermal-printer.js';
import { createReceiptWhatsAppDraft } from '../profile-ui.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const OCT_01 = new Date(2026, 9, 1, 12);
const OCT_20 = new Date(2026, 9, 20, 12);
const MONTH = '2026-10';
const CID = 'seed-001';

const billOf = (state, month = MONTH) => state.customers.find(c => c.id === CID).bills.find(b => b.month === month);
const customerOf = (state) => state.customers.find(c => c.id === CID);
const balanceOf = (state, month = MONTH) => calculatePaymentAllocations(state).forMonth(CID, month)?.balanceDueCents / 100;

/** Synthetic customer: Rs. 3,000 October bill carrying a Rs. 150 late fee (Rs. 3,150 due). */
function feeState() {
  let state = createInitialState(['Waiver Tester']);
  state = updateCustomerProfile(state, CID, { packageSpeed: '15Mbps Unlimited', monthlySellingAmount: 3000 }, OCT_01);
  state = generateMonthlyBillsThroughCurrentMonth(state, OCT_01);
  state = applyLateFeeToBill(state, CID, MONTH, { amount: 150, reason: 'Late payment surcharge' }, OCT_01);
  return state;
}

function collect(state, options = {}, ref = OCT_20) {
  return executeQuickCollection(state, {
    customerId: CID, month: MONTH, amount: 3000, date: '2026-10-20', method: 'Cash', ...options
  }, ref);
}

test('SPEC PIN: pay Rs. 3,000 principal on a Rs. 3,150 bill with the waiver ticked -> balance Rs. 0, lateFeeWaived logged', () => {
  const state = feeState();
  assert.equal(balanceOf(state), 3150, 'precondition: 3,000 principal + 150 late fee due');
  const stampBefore = waivedLateFeeStampFor(billOf(state));
  assert.equal(stampBefore.lateFee, 150);

  const { nextState, receipt } = collect(state, { waiveLateFee: true });

  // Receipt outcome.
  assert.equal(receipt.lateFeeWaived, true);
  assert.equal(receipt.waivedAmount, 150);
  assert.equal(receipt.newBalanceDue, 0);
  assert.equal(receipt.newTotalDues, 0);
  assert.equal(receipt.isSettled, true);

  // The deduction landed on the bill, through the shipped waiver path.
  const bill = billOf(nextState);
  assert.equal(bill.lateFee, 0);
  assert.equal(bill.lateFeeAppliedAt, null);
  assert.equal(bill.lateFeeReason, 'Late fee waived on full payment (Quick Collect)');
  const waivedEntry = bill.amountHistory.filter(h => h.type === 'late_fee_waived');
  assert.equal(waivedEntry.length, 1);
  assert.equal(waivedEntry[0].previousLateFee, 150);

  // The payment carries the audit pair + the exact reversal stamp.
  assert.equal(bill.payments.length, 1);
  const payment = bill.payments[0];
  assert.equal(payment.amount, 3000, 'the payment stays the cash actually received');
  assert.equal(payment.lateFeeWaived, true);
  assert.equal(payment.waivedAmount, 150);
  assert.deepEqual(payment.waivedLateFee, stampBefore);
  assert.equal(lateFeeWaiverOf(payment).waivedAmount, 150);

  // The engine agrees: nothing due, and cash totals count Rs. 3,000 only.
  assert.equal(balanceOf(nextState), 0);
  const summary = summarizeCustomerReceipts(customerOf(nextState));
  assert.equal(summary.total, 3000);
  assert.equal(summary.receiptCount, 1);

  // Input state untouched (the whole flow is pure).
  assert.equal(billOf(state).lateFee, 150);
  assert.equal(billOf(state).payments.length, 0);
});

test('waiver + full settlement still clears the Waada promise (waive lands before the payment)', () => {
  let state = feeState();
  state = {
    ...state,
    customers: state.customers.map(c => c.id === CID ? { ...c, promiseDate: '2026-10-25', promiseAmount: 3150, promiseNote: 'Synthetic promise' } : c)
  };
  const { nextState } = collect(state, { waiveLateFee: true });
  const customer = customerOf(nextState);
  assert.equal(customer.promiseDate, undefined, 'full settlement cleared the promise');
  const payment = billOf(nextState).payments[0];
  assert.equal(payment.clearedWaada?.promiseDate, '2026-10-25', 'the SISP-34 waada stamp rides the same payment');
  assert.equal(payment.lateFeeWaived, true);
});

test('gate: a partial payment with the waiver ticked refuses the whole collection and records nothing', () => {
  const state = feeState();
  assert.throws(() => collect(state, { amount: 2000, waiveLateFee: true }), /full principal/);
  assert.equal(billOf(state).payments.length, 0);
  assert.equal(billOf(state).lateFee, 150);
  assert.equal(balanceOf(state), 3150);
});

test('gate: no late fee, unpriced bill and advance collections all refuse the waiver', () => {
  let plain = createInitialState(['Waiver Tester']);
  plain = updateCustomerProfile(plain, CID, { packageSpeed: '15Mbps Unlimited', monthlySellingAmount: 3000 }, OCT_01);
  plain = generateMonthlyBillsThroughCurrentMonth(plain, OCT_01);
  assert.throws(() => collect(plain, { waiveLateFee: true }), /no late fee/i);

  const state = feeState();
  assert.throws(() => collect(state, { waiveLateFee: true, kind: 'advance', advanceTargetMonth: '2026-11' }), /advance/);
  assert.throws(() => collect(state, { amount: 3150, waiveLateFee: true, month: '2026-09' }), /saved bill/);
});

test('overpay: paying the full Rs. 3,150 with the waiver ticked leaves the extra Rs. 150 as ordinary advance credit', () => {
  const state = feeState();
  const { nextState, receipt } = collect(state, { amount: 3150, waiveLateFee: true });
  assert.equal(receipt.waivedAmount, 150);
  assert.equal(balanceOf(nextState), 0);
  const summary = calculatePaymentAllocations(nextState).forMonth(CID, MONTH);
  assert.equal(summary.pendingCreditCents, 15000, 'the cash paid toward the waived fee becomes pending credit, never lost');
});

test('edge: fee partly covered by an earlier payment — principal already settled, the waiver zeroes the whole fee field', () => {
  // Pay Rs. 3,100 without a waiver first: balance Rs. 50, the bill still
  // carries its Rs. 150 fee field. The remaining principal is Rs. 0, so
  // any further payment with the tick waives; the Rs. 100 of fee the
  // customer already paid converts to advance credit (the engine's
  // ordinary overpayment rule) — pinned so the semantics never drift.
  let state = feeState();
  state = addPayment(state, CID, MONTH, { date: '2026-10-10', amount: 3100, method: 'Cash' }, OCT_20);
  assert.equal(balanceOf(state), 50);
  const { nextState, receipt } = collect(state, { amount: 50, waiveLateFee: true });
  assert.equal(receipt.waivedAmount, 150);
  assert.equal(billOf(nextState).lateFee, 0);
  assert.equal(balanceOf(nextState), 0);
  const summary = calculatePaymentAllocations(nextState).forMonth(CID, MONTH);
  assert.equal(summary.pendingCreditCents, 15000);
  assert.equal(summarizeCustomerReceipts(customerOf(nextState)).total, 3150, 'cash totals still count every rupee actually received');
});

test('no tick, no waiver: paying the principal alone leaves the Rs. 150 fee due (feature is inert by default)', () => {
  const state = feeState();
  const { nextState, receipt } = collect(state, {});
  assert.equal(receipt.lateFeeWaived, false);
  assert.equal(receipt.waivedAmount, 0);
  assert.equal(billOf(nextState).lateFee, 150);
  assert.equal(balanceOf(nextState), 150);
  const payment = billOf(nextState).payments[0];
  assert.equal('lateFeeWaived' in payment, false, 'ordinary payments stay byte-identical to before');
});

test('receipts: every layout prints "Late Fee Waived: -PKR 150" for the waiver payment', () => {
  const { nextState } = collect(feeState(), { waiveLateFee: true });
  const customer = customerOf(nextState);
  const bill = billOf(nextState);
  const payment = bill.payments[0];
  const receipt = buildPaymentReceipt(customer, bill, payment);
  assert.equal(receipt.lateFeeWaived, true);
  assert.equal(receipt.waivedAmount, 150);
  assert.equal(receipt.status, 'PAID');
  assert.equal(receipt.balanceDueCents, 0);
  assert.equal(receipt.paidAmount, 3000);

  const a4 = generatePaymentReceiptHtml(receipt, { format: 'a4' });
  assert.match(a4, /Late Fee Waived/);
  assert.match(a4, /-PKR 150/);
  const t80 = generatePaymentReceiptHtml(receipt, { format: 'thermal-80' });
  assert.match(t80, /Late Fee Waived \/ تاخیری فیس معاف/);
  assert.match(t80, /-PKR 150/);
  const t58 = generatePaymentReceiptHtml(receipt, { format: 'thermal-58' });
  assert.match(t58, /Late Fee Waived:/);
  assert.match(t58, /-PKR 150/);

  const png = buildPngReceiptModel(receipt, customer);
  assert.ok(png.financial.some(row => row.label === 'Late Fee Waived' && row.value === '-PKR 150'));
  assert.ok(png.financial.some(row => row.label === 'Remaining Balance / Baqi Rehta' && row.value === 'PKR 0'));

  const fields = escPosFieldsFromPaymentReceipt(receipt);
  assert.equal(fields.lateFeeWaived, 'PKR 150');
  assert.match(buildEscPosReceipt(fields).text, /Late fee waived/);

  const qcWhatsApp = formatQuickCollectWhatsAppReceipt(collect(feeState(), { waiveLateFee: true }).receipt);
  assert.match(qcWhatsApp.text, /Late Fee Waived: -PKR 150/);

  const draft = createReceiptWhatsAppDraft('+923001234567', {
    customerName: customer.name, customerNumber: customer.customerNumber, amount: 3000,
    date: '2026-10-20', month: MONTH, method: 'Cash', waivedAmount: 150
  });
  assert.match(draft.message, /Late Fee Waived: -PKR 150/);
});

test('receipts: an ordinary payment prints no waived line anywhere', () => {
  const { nextState } = collect(feeState(), {});
  const customer = customerOf(nextState);
  const bill = billOf(nextState);
  const receipt = buildPaymentReceipt(customer, bill, bill.payments[0]);
  assert.equal(receipt.lateFeeWaived, false);
  assert.equal(receipt.waivedAmount, 0);
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    assert.doesNotMatch(generatePaymentReceiptHtml(receipt, { format }), /Late Fee Waived/);
  }
  const png = buildPngReceiptModel(receipt, customer);
  assert.equal(png.financial.some(row => row.label === 'Late Fee Waived'), false);
  assert.equal(escPosFieldsFromPaymentReceipt(receipt).lateFeeWaived, '');
});

test('VOID: voiding the waiver payment restores the exact stamped fee and the full Rs. 3,150 balance', () => {
  const { nextState } = collect(feeState(), { waiveLateFee: true });
  const payment = billOf(nextState).payments[0];
  const { state: voided, voidRecord } = voidPayment(nextState, CID, MONTH, payment.id, {
    voidReason: 'Entered twice', voidedAt: '2026-10-21T10:00:00.000Z'
  });
  assert.equal(voidRecord.lateFeeRestored, true);
  assert.equal(voidRecord.restoredLateFeeAmount, 150);
  const bill = billOf(voided);
  assert.equal(bill.lateFee, 150);
  assert.equal(bill.lateFeeReason, 'Late payment surcharge');
  assert.equal(bill.lateFeeAppliedAt, billOf(feeState()).lateFeeAppliedAt, 'the original applied-at stamp is restored');
  const restored = bill.amountHistory.filter(h => h.type === 'late_fee_restored');
  assert.equal(restored.length, 1);
  assert.match(restored[0].changedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'history timestamps keep the backup-valid local minute format');
  assert.equal(bill.payments[0].voided, true);
  assert.equal(balanceOf(voided), 3150, 'voided cash no longer counts and the fee is back — full balance restored, never double-charged');
  assert.equal(summarizeCustomerReceipts(customerOf(voided)).total, 0);

  // The void log keeps the new fields through its sanitizer.
  const [clean] = sanitizeVoidPayments([voidRecord]);
  assert.equal(clean.lateFeeRestored, true);
  assert.equal(clean.restoredLateFeeAmount, 150);
});

test('VOID guard: a newer late fee applied after the waiver is never clobbered by voiding the waiver payment', () => {
  const { nextState } = collect(feeState(), { waiveLateFee: true });
  const payment = billOf(nextState).payments[0];
  const refeed = applyLateFeeToBill(nextState, CID, MONTH, { amount: 200, reason: 'Second late fee' }, OCT_20);
  assert.equal(billOf(refeed).lateFee, 200);
  const { state: voided, voidRecord } = voidPayment(refeed, CID, MONTH, payment.id, { voidReason: 'Wrong customer' });
  assert.notEqual(voidRecord.lateFeeRestored, true, 'no restoration is claimed when a newer fee blocks it');
  assert.equal('restoredLateFeeAmount' in voidRecord, false, 'ordinary void records keep their pre-SISP-101 shape');
  assert.equal(billOf(voided).lateFee, 200, 'the newer fee survives the void untouched');
});

test('DELETE guard: a waiver payment cannot be deleted until its fee is restored (the undo path)', () => {
  const { nextState } = collect(feeState(), { waiveLateFee: true });
  const payment = billOf(nextState).payments[0];
  assert.throws(() => deletePayment(nextState, CID, MONTH, payment.id), /waived a late fee/);

  const before = JSON.stringify(nextState);
  const { state: restoredState, restored } = restoreWaivedLateFee(nextState, CID, payment, { note: 'Late fee restored (payment undone)' });
  assert.equal(restored, true);
  assert.equal(JSON.stringify(nextState), before, 'restore is pure — the input state is never mutated');
  assert.equal(billOf(restoredState).lateFee, 150);

  // Restoring twice is a no-op (the fee is already back).
  const again = restoreWaivedLateFee(restoredState, CID, billOf(restoredState).payments[0]);
  assert.equal(again.restored, false);

  const deleted = deletePayment(restoredState, CID, MONTH, payment.id, new Date(), { lateFeeWaiverReverted: true });
  assert.equal(billOf(deleted).payments.length, 0);
  assert.equal(balanceOf(deleted), 3150);
});

test('validatePayment: the waiver triple is kept only whole and sane — anything partial is dropped', () => {
  const stamp = { month: MONTH, lateFee: 150, lateFeeAppliedAt: '2026-10-06T09:30', lateFeeReason: 'Late payment surcharge' };
  const kept = validatePayment({ date: '2026-10-20', amount: 3000, method: 'Cash', lateFeeWaived: true, waivedAmount: 150, waivedLateFee: stamp }, OCT_20);
  assert.equal(kept.lateFeeWaived, true);
  assert.equal(kept.waivedAmount, 150);
  assert.deepEqual(kept.waivedLateFee, stamp);

  const dropped = [
    { lateFeeWaived: true, waivedAmount: 150 },                                        // no stamp
    { lateFeeWaived: true, waivedLateFee: stamp },                                     // no amount
    { lateFeeWaived: 'yes', waivedAmount: 150, waivedLateFee: stamp },                 // flag not === true
    { lateFeeWaived: true, waivedAmount: -5, waivedLateFee: stamp },                   // bad amount
    { lateFeeWaived: true, waivedAmount: 150, waivedLateFee: { ...stamp, month: '10-2026' } }, // bad stamp month
    { waivedAmount: 150, waivedLateFee: stamp }                                        // no flag
  ];
  for (const extra of dropped) {
    const clean = validatePayment({ date: '2026-10-20', amount: 3000, method: 'Cash', ...extra }, OCT_20);
    assert.equal('lateFeeWaived' in clean, false, JSON.stringify(extra));
    assert.equal('waivedAmount' in clean, false);
    assert.equal('waivedLateFee' in clean, false);
  }

  // The strict reader agrees: damaged records read as ordinary payments.
  assert.equal(lateFeeWaiverOf({ lateFeeWaived: true, waivedAmount: 150 }), null);
  assert.equal(lateFeeWaiverOf({ lateFeeWaived: true, waivedAmount: 150, waivedLateFee: { month: MONTH, lateFee: 0 } }), null);
  assert.equal(sanitizeWaivedLateFeeStamp({ month: '2026-13', lateFee: 150 }), null);
});

test('correctPayment: correcting a waiver receipt never strips its audit pair or stamp', () => {
  const { nextState } = collect(feeState(), { waiveLateFee: true });
  const payment = billOf(nextState).payments[0];
  const corrected = correctPayment(nextState, CID, MONTH, payment.id, {
    date: '2026-10-20', amount: 3000, method: 'Cash', paidBy: 'Counter Boy'
  }, OCT_20);
  const fixed = billOf(corrected).payments[0];
  assert.equal(fixed.paidBy, 'Counter Boy');
  assert.equal(lateFeeWaiverOf(fixed).waivedAmount, 150);
  assert.equal(billOf(corrected).lateFee, 0, 'the bill stays waived — correction and waiver remain consistent');
});

test('backup round-trip: waiver fields, the zeroed fee and restored-fee history survive a JSON backup merge', () => {
  const { nextState } = collect(feeState(), { waiveLateFee: true });
  const payment = billOf(nextState).payments[0];

  const backupText = createJsonBackup(nextState, new Date('2026-10-21T09:00:00.000Z'));
  const parsed = JSON.parse(backupText);
  const backedPayment = parsed.state.customers.find(c => c.id === CID).bills.find(b => b.month === MONTH).payments[0];
  assert.equal(backedPayment.lateFeeWaived, true);
  assert.equal(backedPayment.waivedAmount, 150);
  assert.equal(backedPayment.waivedLateFee.lateFee, 150);

  const preview = previewJsonBackupMerge(createInitialState([]), backupText);
  assert.equal(preview.canApply, true);
  const restoredCustomer = preview.state.customers.find(c => c.id === CID);
  const restoredBill = restoredCustomer.bills.find(b => b.month === MONTH);
  assert.equal(restoredBill.lateFee, 0);
  assert.equal(lateFeeWaiverOf(restoredBill.payments[0]).waivedAmount, 150);
  assert.equal(restoredBill.payments[0].id, payment.id);

  // After a VOID (fee restored + 'late_fee_restored' history entry), the
  // backup still validates and merges — the entry's timestamp keeps the
  // strict local-minute shape core's backup validation requires.
  const { state: voided } = voidPayment(nextState, CID, MONTH, payment.id, { voidReason: 'Duplicate' });
  const voidBackup = createJsonBackup(voided, new Date('2026-10-22T09:00:00.000Z'));
  const voidPreview = previewJsonBackupMerge(createInitialState([]), voidBackup);
  assert.equal(voidPreview.canApply, true);
  const voidBill = voidPreview.state.customers.find(c => c.id === CID).bills.find(b => b.month === MONTH);
  assert.equal(voidBill.lateFee, 150);
});

test('plan: the full-principal gate matrix', () => {
  const bill = { month: MONTH, lateFee: 150 };
  assert.deepEqual(planLateFeeWaiver({ bill: null, balanceDueCents: 315000, lateFeeCents: 15000, paymentAmountCents: 300000 }).reason, 'no-bill');
  assert.equal(planLateFeeWaiver({ bill, balanceDueCents: 315000, lateFeeCents: 0, paymentAmountCents: 300000 }).reason, 'no-late-fee');
  assert.equal(planLateFeeWaiver({ bill, balanceDueCents: null, lateFeeCents: 15000, paymentAmountCents: 300000 }).reason, 'nothing-due');
  assert.equal(planLateFeeWaiver({ bill, balanceDueCents: 0, lateFeeCents: 15000, paymentAmountCents: 300000 }).reason, 'nothing-due');
  const partial = planLateFeeWaiver({ bill, balanceDueCents: 315000, lateFeeCents: 15000, paymentAmountCents: 200000 });
  assert.equal(partial.eligible, false);
  assert.equal(partial.reason, 'partial-principal');
  assert.equal(partial.principalDueCents, 300000);
  const exact = planLateFeeWaiver({ bill, balanceDueCents: 315000, lateFeeCents: 15000, paymentAmountCents: 300000 });
  assert.equal(exact.eligible, true);
  assert.equal(exact.waivedAmountCents, 15000);
  assert.equal(exact.outstandingFeeCents, 15000);
});

test('i18n + wiring: every lfw_ string exists in both dictionaries, every t() call resolves, surfaces are wired', () => {
  const enKeys = Object.keys(TRANSLATIONS.en).filter(k => k.startsWith('lfw_')).sort();
  const urKeys = Object.keys(TRANSLATIONS.ur).filter(k => k.startsWith('lfw_')).sort();
  assert.deepEqual(enKeys, urKeys, 'lfw_ key parity en/ur');
  assert.ok(enKeys.length >= 6);

  const sources = ['nav-quick-collect.js', 'app.js', 'profile-ui.js']
    .map(f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')).join('\n');
  const used = new Set([...sources.matchAll(/t\('(lfw_[a-z_]+)'/g)].map(m => m[1]));
  assert.ok(used.size >= 5, 'the modal, receipt card, WhatsApp and profile surfaces all read lfw_ strings');
  for (const key of used) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.notEqual(t(key, 'en', { amount: 'PKR 150' }), key, `t('${key}','en') must not return the raw key`);
    assert.notEqual(t(key, 'ur', { amount: 'PKR 150' }), key, `t('${key}','ur') must not return the raw key`);
  }

  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="quickCollectLateFeeWaiverBox"/);
  const qc = readFileSync(new URL('../nav-quick-collect.js', import.meta.url), 'utf8');
  assert.match(qc, /quickCollectLateFeeWaiverBox/);
  assert.match(qc, /data-qc-waive-late-fee/);
  const css = readFileSync(new URL('../components.css', import.meta.url), 'utf8');
  const block = css.slice(css.indexOf('.qc-late-fee-waiver-box'), css.indexOf('.qc-late-fee-waiver-note') + 200);
  assert.match(block, /var\(--/, 'waiver box CSS uses theme tokens');
  assert.doesNotMatch(block, /#[0-9a-fA-F]{3,8}\b/, 'waiver box CSS has no hardcoded colours (dark-mode rule)');

  const build = readFileSync(new URL('../build.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(build, /'late-fee-waiver\.js'/, 'the module is bundled via imports, never a dist entry (25-file budget)');
});
