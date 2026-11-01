// SISP-156: 1-Click Payment Method / Shop Correction Without Void.
// Pure-function tests on synthetic data only. Spec criteria pinned here:
// shop-to-shop reassignment moves the tray figures and keeps the receipt
// id/number; cash-to-shop moves drawer -> tray; shop-to-digital moves
// tray -> wallet with the strict TID rule; a shop-settled receipt (full
// OR partial) and a voided receipt are locked; only the channel changes
// (field-by-field pin); the change is auditable via
// payment.methodCorrections and survives a backup round-trip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  reassignPaymentMethod,
  paymentChannelLock,
  paymentShopSettledAmount,
  channelActionMarkup,
  channelLockText
} from '../payment-method-reassign.js';
import { correctPayment, createInitialState, createJsonBackup, previewJsonBackupMerge } from '../core.js';
import { buildShopSummaries, applySettlement } from '../shop-settlement.js';
import { collectDirectCashPayments } from '../roznamcha.js';
import { buildWalletReconciliation } from '../wallet-reconciliation.js';
import { buildPaymentReceipt } from '../receipt.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const REF = new Date('2026-10-29T00:00:00Z');
const customer = (id, number, name, bills) => ({ id, customerNumber: number, name, bills });
const bill = (month, payments, extra = {}) => ({ month, dueAmount: 3000, ...extra, payments });
const payment = (id, overrides) => ({ id, date: '2026-10-06', amount: 0, method: 'Cash', ...overrides });

const getPayment = (state, cid, month, pid) =>
  state.customers.find((c) => c.id === cid).bills.find((b) => b.month === month).payments.find((p) => p.id === pid);

const unsettledOf = (state, shop) =>
  buildShopSummaries(state, [], REF).find((s) => s.shop === shop)?.unsettled ?? 0;

test('shop-to-shop: figures move between trays, receipt id and number unchanged, reprint shows the new channel', () => {
  const state = { customers: [customer('c1', 11, 'Test Customer 11', [
    bill('2026-10', [payment('p1', { amount: 3000, method: 'Cash at Waseem Abbasi shop', receiptNumber: 'RCP-TEST-1' })])
  ])] };
  assert.equal(unsettledOf(state, 'Waseem Abbasi Shop'), 3000);
  assert.equal(unsettledOf(state, 'Hassan Balla Shop'), 0);

  const custBefore = state.customers[0];
  const receiptBefore = buildPaymentReceipt(custBefore, custBefore.bills[0], custBefore.bills[0].payments[0]);

  const next = reassignPaymentMethod(state, 'c1', '2026-10', 'p1', { method: 'Cash at Hassan shop' }, REF);
  const moved = getPayment(next, 'c1', '2026-10', 'p1');
  assert.equal(moved.id, 'p1', 'receipt id unchanged');
  assert.equal(moved.method, 'Cash at Hassan shop');
  assert.equal(unsettledOf(next, 'Waseem Abbasi Shop'), 0, 'old shop tray drops by the full amount');
  assert.equal(unsettledOf(next, 'Hassan Balla Shop'), 3000, 'new shop tray rises by the full amount');
  // Input state is never mutated.
  assert.equal(getPayment(state, 'c1', '2026-10', 'p1').method, 'Cash at Waseem Abbasi shop');

  const custAfter = next.customers[0];
  const receiptAfter = buildPaymentReceipt(custAfter, custAfter.bills[0], custAfter.bills[0].payments[0]);
  assert.equal(receiptAfter.permanentReceiptNumber, receiptBefore.permanentReceiptNumber, 'receipt number unchanged');
  assert.equal(receiptAfter.permanentReceiptNumber, 'RCP-TEST-1');
  assert.equal(receiptBefore.paymentMethod, 'Cash at Waseem Abbasi shop');
  assert.equal(receiptAfter.paymentMethod, 'Cash at Hassan shop', 'reprint derives the NEW method from the record');
});

test('cash-to-shop: the payment leaves the Roznamcha drawer count and joins the shop tray', () => {
  const state = { customers: [customer('c1', 12, 'Test Customer 12', [
    bill('2026-10', [payment('p1', { date: '2026-10-06', amount: 2000, method: 'Cash' })])
  ])] };
  const drawerTotal = (s) => collectDirectCashPayments(s, '2026-10-06').reduce((sum, row) => sum + row.amount, 0);
  assert.equal(drawerTotal(state), 2000);
  assert.equal(unsettledOf(state, 'Hassan Balla Shop'), 0);

  const next = reassignPaymentMethod(state, 'c1', '2026-10', 'p1', { method: 'Cash at Balla shop' }, REF);
  assert.equal(drawerTotal(next), 0, 'no longer direct drawer cash');
  assert.equal(unsettledOf(next, 'Hassan Balla Shop'), 2000, 'now sits in the Balla tray');
});

test('shop-to-digital: tray -> wallet, and the strict TID rule is enforced exactly like a fresh recording', () => {
  const state = { customers: [customer('c1', 13, 'Test Customer 13', [
    bill('2026-10', [payment('p1', { amount: 1500, method: 'Cash at Hassan shop' })])
  ])] };
  const walletOf = (s) => buildWalletReconciliation(s.customers, '2026-10').byWallet.Easypaisa.amount;
  assert.equal(walletOf(state), 0);
  assert.equal(unsettledOf(state, 'Hassan Balla Shop'), 1500);

  // No TID and no override reason -> refused, record untouched.
  assert.throws(
    () => reassignPaymentMethod(state, 'c1', '2026-10', 'p1', { method: 'Easypaisa' }, REF),
    /Transaction ID/
  );
  assert.equal(getPayment(state, 'c1', '2026-10', 'p1').method, 'Cash at Hassan shop');

  // Operator-entered TID -> succeeds; money moves tray -> wallet.
  const withTid = reassignPaymentMethod(state, 'c1', '2026-10', 'p1', { method: 'Easypaisa', transactionId: 'EP-778899' }, REF);
  const moved = getPayment(withTid, 'c1', '2026-10', 'p1');
  assert.equal(moved.method, 'Easypaisa');
  assert.equal(moved.transactionId, 'EP-778899');
  assert.equal(moved.reference, 'EP-778899');
  assert.equal(unsettledOf(withTid, 'Hassan Balla Shop'), 0);
  assert.equal(walletOf(withTid), 1500);

  // Override reason instead of a TID -> also succeeds (same escape hatch
  // a fresh recording has).
  const withOverride = reassignPaymentMethod(state, 'c1', '2026-10', 'p1', { method: 'Easypaisa', referenceOverrideReason: 'Customer confirms transfer, no TID shared' }, REF);
  assert.equal(getPayment(withOverride, 'c1', '2026-10', 'p1').referenceOverrideReason, 'Customer confirms transfer, no TID shared');
});

test('digital-to-cash keeps the old TID on the record as arrival history; digital-to-digital keeps it without re-entry', () => {
  const state = { customers: [customer('c1', 14, 'Test Customer 14', [
    bill('2026-10', [payment('p1', { amount: 1500, method: 'JazzCash', transactionId: 'JC-112233', reference: 'JC-112233' })])
  ])] };
  const toCash = reassignPaymentMethod(state, 'c1', '2026-10', 'p1', { method: 'Cash' }, REF);
  const cashPayment = getPayment(toCash, 'c1', '2026-10', 'p1');
  assert.equal(cashPayment.method, 'Cash');
  assert.equal(cashPayment.transactionId, 'JC-112233', 'audit data is never silently lost');
  // ...and the kept TID counts nowhere: wallet reconciliation keys off method.
  assert.equal(buildWalletReconciliation(toCash.customers, '2026-10').byWallet.JazzCash.amount, 0);
  assert.equal(buildWalletReconciliation(toCash.customers, '2026-10').cash.amount, 1500);

  const toEasypaisa = reassignPaymentMethod(state, 'c1', '2026-10', 'p1', { method: 'Easypaisa' }, REF);
  assert.equal(getPayment(toEasypaisa, 'c1', '2026-10', 'p1').transactionId, 'JC-112233', 'existing TID satisfies the strict rule');
});

test('settled lock: a fully settled receipt cannot change channel; a partial settlement locks it too', () => {
  const base = { customers: [customer('c1', 15, 'Test Customer 15', [
    bill('2026-10', [payment('p1', { amount: 3000, method: 'Cash at Waseem Abbasi shop' })])
  ])] };
  const full = applySettlement(base, 'Waseem Abbasi Shop', 3000, '2026-10-20').state;
  assert.equal(paymentShopSettledAmount(getPayment(full, 'c1', '2026-10', 'p1')), 3000);
  assert.deepEqual(paymentChannelLock(getPayment(full, 'c1', '2026-10', 'p1')), { reason: 'shop-settled', settledAmount: 3000 });
  assert.throws(
    () => reassignPaymentMethod(full, 'c1', '2026-10', 'p1', { method: 'Cash' }, REF),
    /already handed over from the shop/
  );
  // The lock lives in correctPayment itself, so the plain correction
  // form cannot move a settled receipt's channel either.
  assert.throws(
    () => correctPayment(full, 'c1', '2026-10', 'p1', { method: 'Cash' }, REF),
    /already handed over from the shop/
  );
  assert.match(channelActionMarkup(getPayment(full, 'c1', '2026-10', 'p1'), { customerId: 'c1', month: '2026-10' }), /channel-lock-note/, 'locked rows show the lock, never a dead button');
  assert.match(channelLockText(paymentChannelLock(getPayment(full, 'c1', '2026-10', 'p1'))), /handed over/);

  const partial = applySettlement(base, 'Waseem Abbasi Shop', 1000, '2026-10-20').state;
  assert.equal(paymentShopSettledAmount(getPayment(partial, 'c1', '2026-10', 'p1')), 1000);
  assert.equal(paymentChannelLock(getPayment(partial, 'c1', '2026-10', 'p1'))?.reason, 'shop-settled', 'even a partial handover locks the channel');
  assert.throws(
    () => reassignPaymentMethod(partial, 'c1', '2026-10', 'p1', { method: 'Cash at Hassan shop' }, REF),
    /already handed over from the shop/
  );
});

test('settled receipt: non-channel corrections stay allowed and the settlement stamps survive them', () => {
  const base = { customers: [customer('c1', 16, 'Test Customer 16', [
    bill('2026-10', [payment('p1', { amount: 3000, method: 'Cash at Waseem Abbasi shop' })])
  ])] };
  const settled = applySettlement(base, 'Waseem Abbasi Shop', 1000, '2026-10-20').state;
  const before = getPayment(settled, 'c1', '2026-10', 'p1');
  const corrected = correctPayment(settled, 'c1', '2026-10', 'p1', { date: '2026-10-07', amount: 3000, method: 'Cash at Waseem Abbasi shop' }, REF);
  const after = getPayment(corrected, 'c1', '2026-10', 'p1');
  assert.equal(after.date, '2026-10-07');
  assert.equal(after.shopSettledAmount, 1000, 'settled amount stamp carried, not dropped by validatePayment');
  assert.equal(after.shopSettled, before.shopSettled);
  assert.deepEqual(after.settlementIds, before.settlementIds);
  assert.equal(unsettledOf(corrected, 'Waseem Abbasi Shop'), 2000, 'tray still nets the handover');
});

test('voided payments are frozen: reassignment refused, no row action rendered', () => {
  const state = { customers: [customer('c1', 17, 'Test Customer 17', [
    bill('2026-10', [payment('p1', { amount: 1000, method: 'Cash', voided: true, voidedAt: '2026-10-10T00:00:00.000Z', voidReason: 'Duplicate entry' })])
  ])] };
  assert.deepEqual(paymentChannelLock(getPayment(state, 'c1', '2026-10', 'p1')), { reason: 'voided' });
  assert.throws(
    () => reassignPaymentMethod(state, 'c1', '2026-10', 'p1', { method: 'JazzCash', transactionId: 'JC-1' }, REF),
    /voided/
  );
  assert.equal(channelActionMarkup(getPayment(state, 'c1', '2026-10', 'p1'), { customerId: 'c1', month: '2026-10' }), '');
});

test('only the channel changes: every other field is pinned identical, stamps included', () => {
  const rich = payment('p9', {
    date: '2026-10-05',
    amount: 2500,
    method: 'Cash',
    discount: 200,
    discountReason: 'Loyalty discount',
    note: 'Paid at the door',
    paidBy: 'Test Payer',
    kind: 'advance',
    targetMonth: '2026-11',
    walletVerified: true,
    ticketCharges: [{ ticketId: 'TKT-101', amount: 300 }],
    clearedWaada: { promiseDate: '2026-10-15' },
    receiptNumber: 'RCP-TEST-9'
  });
  const state = { customers: [customer('c1', 18, 'Test Customer 18', [bill('2026-10', [rich])])] };
  const next = reassignPaymentMethod(state, 'c1', '2026-10', 'p9', { method: 'JazzCash', transactionId: 'JC-445566' }, REF);
  const after = getPayment(next, 'c1', '2026-10', 'p9');

  const strip = (p) => {
    const { method, transactionId, reference, methodCorrections, ...rest } = p;
    return rest;
  };
  assert.deepEqual(strip(after), strip(rich), 'amount, date, discount, note, paidBy, kind/targetMonth, ticket charges, waada stamp, receipt number — all untouched');
  assert.equal(after.method, 'JazzCash');
  assert.equal(after.transactionId, 'JC-445566');
  assert.equal(after.id, 'p9');
});

test('audit: every channel change appends a methodCorrections entry; history is carried, never reset', () => {
  const state = { customers: [customer('c1', 19, 'Test Customer 19', [
    bill('2026-10', [payment('p1', { amount: 1200, method: 'Cash' })])
  ])] };
  const step1 = reassignPaymentMethod(state, 'c1', '2026-10', 'p1', { method: 'Cash at Hassan shop' }, REF);
  const entries1 = getPayment(step1, 'c1', '2026-10', 'p1').methodCorrections;
  assert.deepEqual(entries1, [{ fromMethod: 'Cash', toMethod: 'Cash at Hassan shop', correctedAt: REF.toISOString() }]);

  const step2 = reassignPaymentMethod(step1, 'c1', '2026-10', 'p1', { method: 'Easypaisa', transactionId: 'EP-1' }, REF);
  const entries2 = getPayment(step2, 'c1', '2026-10', 'p1').methodCorrections;
  assert.equal(entries2.length, 2);
  assert.deepEqual(entries2[0], entries1[0], 'first entry intact after the second change');
  assert.deepEqual(entries2[1], { fromMethod: 'Cash at Hassan shop', toMethod: 'Easypaisa', correctedAt: REF.toISOString() });

  // A plain correction-form method change is audited the same way (the
  // stamp lives in correctPayment, not in this module's wrapper).
  const viaForm = correctPayment(state, 'c1', '2026-10', 'p1', { date: '2026-10-06', amount: 1200, method: 'Cash at Balla shop' }, REF);
  assert.deepEqual(getPayment(viaForm, 'c1', '2026-10', 'p1').methodCorrections, [
    { fromMethod: 'Cash', toMethod: 'Cash at Balla shop', correctedAt: REF.toISOString() }
  ]);
  // A non-channel correction adds no entry. (correctPayment's contract
  // is the correction form's full field set: date + amount + method.)
  const dateOnly = correctPayment(step1, 'c1', '2026-10', 'p1', { date: '2026-10-08', amount: 1200, method: 'Cash at Hassan shop' }, REF);
  assert.equal(getPayment(dateOnly, 'c1', '2026-10', 'p1').methodCorrections.length, 1);
});

test('paidBy that names a shop is channel data: cleared on a move elsewhere, flagged in the audit entry', () => {
  const state = { customers: [customer('c1', 20, 'Test Customer 20', [
    bill('2026-10', [payment('p1', { amount: 1800, method: 'Cash', paidBy: 'Hassan' })])
  ])] };
  // Legacy attribution: method Cash + paidBy "Hassan" already sits in the
  // Hassan tray today.
  assert.equal(unsettledOf(state, 'Hassan Balla Shop'), 1800);
  const next = reassignPaymentMethod(state, 'c1', '2026-10', 'p1', { method: 'JazzCash', transactionId: 'JC-9' }, REF);
  const moved = getPayment(next, 'c1', '2026-10', 'p1');
  assert.equal(moved.paidBy, undefined, 'shop-naming payer text cleared so the move takes effect');
  assert.equal(unsettledOf(next, 'Hassan Balla Shop'), 0);
  assert.equal(buildWalletReconciliation(next.customers, '2026-10').byWallet.JazzCash.amount, 1800);
  assert.equal(moved.methodCorrections[0].paidByCleared, true);

  // A payer text naming no shop is a person and is never touched.
  const person = { customers: [customer('c1', 21, 'Test Customer 21', [
    bill('2026-10', [payment('p1', { amount: 900, method: 'Cash', paidBy: 'Test Payer' })])
  ])] };
  const movedPerson = getPayment(reassignPaymentMethod(person, 'c1', '2026-10', 'p1', { method: 'Cash at Balla shop' }, REF), 'c1', '2026-10', 'p1');
  assert.equal(movedPerson.paidBy, 'Test Payer');
  assert.equal(movedPerson.methodCorrections[0].paidByCleared, undefined);
});

test('same channel and unknown channel are refused; clearedWaada survives a plain correction', () => {
  const state = { customers: [customer('c1', 22, 'Test Customer 22', [
    bill('2026-10', [payment('p1', { amount: 1000, method: 'Cash', clearedWaada: { promiseDate: '2026-10-15' } })])
  ])] };
  assert.throws(() => reassignPaymentMethod(state, 'c1', '2026-10', 'p1', { method: 'Cash' }, REF), /already recorded on that channel/);
  assert.throws(() => reassignPaymentMethod(state, 'c1', '2026-10', 'p1', { method: 'Carrier Pigeon' }, REF), /valid payment method/);
  const corrected = correctPayment(state, 'c1', '2026-10', 'p1', { date: '2026-10-09', amount: 1000, method: 'Cash' }, REF);
  assert.deepEqual(getPayment(corrected, 'c1', '2026-10', 'p1').clearedWaada, { promiseDate: '2026-10-15' }, 'a later void can still restore the promise');
});

test('backup round-trip keeps the audit trail and settlement stamps on the payment', () => {
  const base = { customers: [customer('c1', 23, 'Test Customer 23', [
    bill('2026-10', [payment('p1', { amount: 3000, method: 'Cash at Waseem Abbasi shop' })], { id: 'bill-c1', status: 'received' })
  ])] };
  const settled = applySettlement(base, 'Waseem Abbasi Shop', 1000, '2026-10-20').state;
  const corrected = correctPayment(settled, 'c1', '2026-10', 'p1', { date: '2026-10-07', amount: 3000, method: 'Cash at Waseem Abbasi shop' }, REF);
  const movedBase = { customers: [customer('c2', 24, 'Test Customer 24', [
    bill('2026-10', [payment('p2', { amount: 700, method: 'Cash' })], { id: 'bill-c2', status: 'received' })
  ])] };
  const moved = reassignPaymentMethod(movedBase, 'c2', '2026-10', 'p2', { method: 'Cash at Balla shop' }, REF);
  const combined = { ...createInitialState(), customers: [...corrected.customers, ...moved.customers] };

  const backupText = createJsonBackup(combined, REF);
  const restored = previewJsonBackupMerge(createInitialState(), backupText).state;
  const restoredSettled = getPayment(restored, 'c1', '2026-10', 'p1');
  assert.equal(restoredSettled.shopSettledAmount, 1000);
  assert.equal(restoredSettled.settlementIds.length, 1);
  const restoredMoved = getPayment(restored, 'c2', '2026-10', 'p2');
  assert.equal(restoredMoved.method, 'Cash at Balla shop');
  assert.deepEqual(restoredMoved.methodCorrections, [{ fromMethod: 'Cash', toMethod: 'Cash at Balla shop', correctedAt: REF.toISOString() }]);
});

test('row action markup: unlocked payments get the channel button wired with ids', () => {
  const markup = channelActionMarkup(payment('p1', { amount: 500, method: 'Cash' }), { customerId: 'c1', month: '2026-10' });
  assert.match(markup, /data-reassign-channel="p1"/);
  assert.match(markup, /data-customer-id="c1"/);
  assert.match(markup, /data-month="2026-10"/);
  assert.match(markup, new RegExp(t('reassign_btn').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('i18n: every reassign_* key exists in en + ur with matching placeholders, and no t() call renders a raw key', () => {
  const moduleSource = read('payment-method-reassign.js');
  const html = read('index.html');
  const keys = new Set();
  for (const m of moduleSource.matchAll(/t\('(reassign_[a-z_]+)'/g)) keys.add(m[1]);
  for (const m of html.matchAll(/data-i18n="(reassign_[a-z_]+)"/g)) keys.add(m[1]);
  assert.ok(keys.size >= 12, `expected the full reassign_* key set, found ${[...keys].join(', ')}`);
  const placeholders = (s) => [...String(s).matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]).sort();
  for (const key of keys) {
    assert.ok(TRANSLATIONS.en[key], `missing en key ${key}`);
    assert.ok(TRANSLATIONS.ur[key], `missing ur key ${key}`);
    assert.deepEqual(placeholders(TRANSLATIONS.ur[key]), placeholders(TRANSLATIONS.en[key]), `placeholder parity for ${key}`);
    assert.notEqual(t(key, 'en'), key, `${key} must not render as a raw key`);
    assert.notEqual(t(key, 'ur'), key, `${key} must not render as a raw key (ur)`);
  }
});

test('wiring: app.js imports the module only there, both surfaces bind the action, dialog exists on the billing-modal shell', () => {
  const app = read('app.js');
  assert.match(app, /from '\.\/payment-method-reassign\.js'/);
  assert.ok((app.match(/data-reassign-channel/g) || []).length >= 2, 'click bindings on both surfaces');
  assert.ok((app.match(/channelActionMarkup\(/g) || []).length >= 2, 'row markup on both surfaces');
  assert.match(app, /setupPaymentMethodReassignModal\(\(\) => state/);
  const html = read('index.html');
  const dialog = html.match(/<dialog id="paymentMethodReassignDialog"[^>]*>/);
  assert.ok(dialog, 'dialog exists');
  assert.match(dialog[0], /billing-modal/, 'dialog rides the shared billing-modal shell (theme surface)');
  for (const id of ['paymentReassignMethodSelect', 'paymentReassignTidInput', 'paymentReassignConfirmBtn', 'paymentReassignCloseBtn']) {
    assert.ok(html.includes(`id="${id}"`), `dialog control #${id} present`);
  }
  assert.match(html, /id="paymentReassignCloseBtn" class="modal-close"[^>]*>↩<\/button>/, 'shared red-circle close design');
});
