// SISP-126: Partial Payment "Remainder Waada" inline chips — integration
// tests on synthetic data only. Covers: the waada persisting WITH the
// payment through the real SISP-3 setter (executeQuickCollection's
// remainderWaadaDate option), the payment stamp, every receipt surface,
// the void rollback, the correction carry-over, the Field Mode
// pass-through, and the counter-pins (full payment / Skip / no chip ->
// no waada; receipts without a waada stay byte-identical).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  executeQuickCollection,
  renderQuickCollectReceiptCardHtml,
  formatQuickCollectWhatsAppReceipt,
  formatRemainderWaadaLine,
  getPendingCollectionCustomers
} from '../nav-quick-collect.js';
import {
  saveBillMonth,
  correctPayment,
  createJsonBackup
} from '../core.js';
import {
  REMAINDER_WAADA_NOTE,
  remainderWaadaOf,
  getWaadaTier,
  WAADA_TIERS
} from '../waada-queue.js';
import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import { buildEscPosReceipt, escPosFieldsFromPaymentReceipt } from '../thermal-printer.js';
import { buildPngReceiptModel } from '../png-receipt.js';
import { voidPayment } from '../payment-void-audit.js';
import { collectFieldModeAdvance } from '../field-mode.js';
import { TRANSLATIONS } from '../nav-language.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');

// Fixed "today": 2026-10-20 PKT. The bill is priced for 2026-10, so the
// collection math stays stable.
const REF = new Date('2026-10-20T05:00:00.000Z');
const CHIP_DATE = '2026-10-27'; // the +7 chip for a 2026-10-20 payment

function stateWithDue(due = 3000, customerExtra = {}) {
  let state = {
    customers: [{
      id: 'c1',
      customerNumber: 101,
      name: 'Synthetic Tester',
      phone: '03001234567',
      area: 'Test Area',
      archived: false,
      bills: [],
      ...customerExtra
    }]
  };
  state = saveBillMonth(state, 'c1', { month: '2026-10', dueAmount: due, dueDate: '2026-10-05', status: 'pending' }, REF);
  return state;
}

const customerOf = (state) => state.customers.find(c => c.id === 'c1');
const paymentOf = (state) => customerOf(state).bills.find(b => b.month === '2026-10').payments.at(-1);

function collectPartial(extra = {}) {
  const state = stateWithDue(3000);
  const { nextState, receipt } = executeQuickCollection(state, {
    customerId: 'c1',
    month: '2026-10',
    amount: 1000,
    date: '2026-10-20',
    method: 'Cash',
    ...extra
  }, REF);
  return { state, nextState, receipt };
}

// --- Recording: waada persists with the payment, through the SISP-3 fields ---

test('partial payment + chip: remainder waada persists with the payment (SISP-3 fields + stamp)', () => {
  const { state, nextState, receipt } = collectPartial({ remainderWaadaDate: CHIP_DATE });
  const customer = customerOf(nextState);
  // The real promise fields, written by the same setter the Waada dialog uses.
  assert.equal(customer.promiseDate, CHIP_DATE);
  assert.equal(customer.promiseAmount, 2000); // engine remainder: 3000 due - 1000 paid
  assert.equal(customer.promiseNote, REMAINDER_WAADA_NOTE);
  // The payment carries the stamp in the same saved state.
  const payment = paymentOf(nextState);
  assert.deepEqual(remainderWaadaOf(payment), { promiseDate: CHIP_DATE, promiseAmount: 2000 });
  assert.equal(payment.remainderWaada.previousWaada, undefined);
  // The receipt reports it, and the input state was never mutated.
  assert.deepEqual(receipt.remainderWaada, { promiseDate: CHIP_DATE, promiseAmount: 2000 });
  assert.equal(customerOf(state).promiseDate, undefined);
  assert.equal(paymentOf(state), undefined);
});

test('the remainder waada is an ordinary SISP-3 promise (tiers see it — SISP-98 interplay)', () => {
  const { nextState } = collectPartial({ remainderWaadaDate: CHIP_DATE });
  assert.equal(getWaadaTier(customerOf(nextState), 2000, '2026-10-21'), WAADA_TIERS.PROMISED);
});

test('counter-pin: partial payment WITHOUT a chip writes no waada and no stamp (Skip / untouched)', () => {
  const { nextState, receipt } = collectPartial();
  const customer = customerOf(nextState);
  assert.equal(customer.promiseDate, undefined);
  assert.equal(paymentOf(nextState).remainderWaada, undefined);
  assert.equal(receipt.remainderWaada, null);
  // The payment itself still recorded normally.
  assert.equal(paymentOf(nextState).amount, 1000);
});

test('counter-pin: FULL payment with a chip date passed writes no waada and no stamp', () => {
  const state = stateWithDue(3000);
  const { nextState, receipt } = executeQuickCollection(state, {
    customerId: 'c1', month: '2026-10', amount: 3000, date: '2026-10-20', method: 'Cash',
    remainderWaadaDate: CHIP_DATE
  }, REF);
  assert.equal(customerOf(nextState).promiseDate, undefined);
  assert.equal(paymentOf(nextState).remainderWaada, undefined);
  assert.equal(receipt.remainderWaada, null);
  assert.equal(receipt.isSettled, true);
});

test('counter-pin: a failed recording leaves no orphan waada (input state untouched)', () => {
  const state = stateWithDue(3000);
  assert.throws(() => executeQuickCollection(state, {
    customerId: 'c1', month: '2026-10', amount: 0, date: '2026-10-20', method: 'Cash',
    remainderWaadaDate: CHIP_DATE
  }, REF));
  assert.equal(customerOf(state).promiseDate, undefined);
  assert.equal(paymentOf(state), undefined);
});

test('an invalid chip date is ignored — the payment records, no waada is written', () => {
  const { nextState, receipt } = collectPartial({ remainderWaadaDate: '2026-13-40' });
  assert.equal(customerOf(nextState).promiseDate, undefined);
  assert.equal(paymentOf(nextState).remainderWaada, undefined);
  assert.equal(receipt.remainderWaada, null);
});

test('an existing waada is replaced (house setter semantics) and kept on the stamp for restore', () => {
  const state = stateWithDue(3000, {
    promiseDate: '2026-10-25',
    promiseAmount: 3000,
    promiseNote: 'Salary day'
  });
  const { nextState } = executeQuickCollection(state, {
    customerId: 'c1', month: '2026-10', amount: 1000, date: '2026-10-20', method: 'Cash',
    remainderWaadaDate: CHIP_DATE
  }, REF);
  const customer = customerOf(nextState);
  assert.equal(customer.promiseDate, CHIP_DATE);
  assert.equal(customer.promiseAmount, 2000);
  assert.equal(customer.promiseNote, REMAINDER_WAADA_NOTE);
  assert.deepEqual(paymentOf(nextState).remainderWaada.previousWaada, {
    promiseDate: '2026-10-25', promiseAmount: 3000, promiseNote: 'Salary day'
  });
});

test('the stamp survives a JSON backup round-trip (payments are stored as-is)', () => {
  const { nextState } = collectPartial({ remainderWaadaDate: CHIP_DATE });
  const restored = JSON.parse(createJsonBackup(nextState, REF)).state;
  assert.deepEqual(remainderWaadaOf(paymentOf(restored)), { promiseDate: CHIP_DATE, promiseAmount: 2000 });
  assert.equal(customerOf(restored).promiseDate, CHIP_DATE);
});

// --- Receipts ---

test('receipt line: "Baqi Rs. X • Waada: [Date]" on the QC card and WhatsApp draft', () => {
  const { receipt } = collectPartial({ remainderWaadaDate: CHIP_DATE });
  assert.equal(formatRemainderWaadaLine(receipt), 'Baqi Rs. 2,000 • Waada: 2026-10-27');
  const card = renderQuickCollectReceiptCardHtml(receipt);
  assert.ok(card.includes('Baqi Rs. 2,000 • Waada: 2026-10-27'));
  assert.ok(card.includes('Remainder Waada'));
  const wa = formatQuickCollectWhatsAppReceipt(receipt);
  assert.ok(wa.text.includes('🤝 *Baqi Rs. 2,000 • Waada: 2026-10-27*'));
});

test('receipt counter-pin: no remainder waada -> QC card and WhatsApp stay byte-identical', () => {
  const { receipt } = collectPartial();
  assert.equal(formatRemainderWaadaLine(receipt), null);
  assert.ok(!renderQuickCollectReceiptCardHtml(receipt).includes('Baqi Rs.'));
  assert.ok(!formatQuickCollectWhatsAppReceipt(receipt).text.includes('Baqi Rs.'));
});

test('receipt.js: the line prints on A4 + thermal-80 + thermal-58; absent stamp renders byte-identical', () => {
  const { nextState } = collectPartial({ remainderWaadaDate: CHIP_DATE });
  const customer = customerOf(nextState);
  const bill = customer.bills.find(b => b.month === '2026-10');
  const snapshot = buildPaymentReceipt(customer, bill, paymentOf(nextState));
  assert.deepEqual(snapshot.remainderWaada, { promiseDate: CHIP_DATE, promiseAmount: 2000 });
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    const html = generatePaymentReceiptHtml(snapshot, { format });
    // Label and value are separate receipt fields; the value carries the
    // spec line's money + date ("Baqi Rs. X • Waada: [Date]").
    assert.ok(html.includes('Rs. 2,000 • Waada: 2026-10-27'), format);
    assert.ok(html.includes('Baqi / باقی رقم'), format);
  }
  // Byte-identical pin: a receipt whose payment set no waada produces
  // exactly the markup the generator makes when the field is absent.
  const plain = collectPartial();
  const plainCustomer = customerOf(plain.nextState);
  const plainBill = plainCustomer.bills.find(b => b.month === '2026-10');
  const plainSnapshot = buildPaymentReceipt(plainCustomer, plainBill, paymentOf(plain.nextState));
  assert.equal(plainSnapshot.remainderWaada, null);
  const { remainderWaada, ...withoutField } = plainSnapshot;
  for (const format of ['a4', 'thermal-80', 'thermal-58']) {
    assert.equal(
      generatePaymentReceiptHtml(plainSnapshot, { format }),
      generatePaymentReceiptHtml(withoutField, { format }),
      format
    );
    assert.ok(!generatePaymentReceiptHtml(plainSnapshot, { format }).includes('Waada:'));
  }
});

test('thermal ESC/POS + PNG model carry the line only when a waada was set', () => {
  const { nextState } = collectPartial({ remainderWaadaDate: CHIP_DATE });
  const customer = customerOf(nextState);
  const bill = customer.bills.find(b => b.month === '2026-10');
  const snapshot = buildPaymentReceipt(customer, bill, paymentOf(nextState));
  const esc = buildEscPosReceipt(escPosFieldsFromPaymentReceipt(snapshot));
  assert.ok(esc.text.includes('Baqi Rs. 2,000'));
  // The 32-char slip wraps the line, so the date lands on the next row.
  assert.ok(esc.text.includes('Waada:'));
  assert.ok(esc.text.includes('2026-10-27'));
  const model = buildPngReceiptModel(snapshot, customer);
  const row = model.financial.find(r => r.label.includes('Remainder Waada'));
  assert.ok(row);
  assert.ok(row.value.includes('2,000'));
  assert.ok(row.value.includes(CHIP_DATE));

  const plain = collectPartial();
  const plainCustomer = customerOf(plain.nextState);
  const plainBill = plainCustomer.bills.find(b => b.month === '2026-10');
  const plainSnapshot = buildPaymentReceipt(plainCustomer, plainBill, paymentOf(plain.nextState));
  const plainEsc = buildEscPosReceipt(escPosFieldsFromPaymentReceipt(plainSnapshot));
  assert.ok(!plainEsc.text.includes('Baqi Rs.'));
  const plainModel = buildPngReceiptModel(plainSnapshot, plainCustomer);
  assert.ok(!plainModel.financial.some(r => r.label.includes('Remainder Waada')));
});

// --- Rollback paths ---

test('voiding the partial payment reverts its remainder waada (and restores a replaced promise)', () => {
  // No previous promise: the waada is cleared.
  const { nextState, receipt } = collectPartial({ remainderWaadaDate: CHIP_DATE });
  const { state: voided, voidRecord } = voidPayment(nextState, 'c1', '2026-10', receipt.paymentId, { voidReason: 'wrong amount' });
  assert.equal(voidRecord.remainderWaadaReverted, true);
  assert.equal(customerOf(voided).promiseDate, undefined);
  assert.equal(paymentOf(voided).voided, true);

  // With a previous promise: it comes back exactly.
  const state = stateWithDue(3000, { promiseDate: '2026-10-25', promiseAmount: 3000, promiseNote: 'Salary day' });
  const recorded = executeQuickCollection(state, {
    customerId: 'c1', month: '2026-10', amount: 1000, date: '2026-10-20', method: 'Cash',
    remainderWaadaDate: CHIP_DATE
  }, REF);
  const undone = voidPayment(recorded.nextState, 'c1', '2026-10', recorded.receipt.paymentId, { voidReason: 'duplicate' });
  assert.equal(undone.voidRecord.remainderWaadaReverted, true);
  assert.equal(customerOf(undone.state).promiseDate, '2026-10-25');
  assert.equal(customerOf(undone.state).promiseAmount, 3000);
  assert.equal(customerOf(undone.state).promiseNote, 'Salary day');
});

test('void never clobbers a promise set after the remainder waada', () => {
  const { nextState, receipt } = collectPartial({ remainderWaadaDate: CHIP_DATE });
  const newer = {
    ...nextState,
    customers: nextState.customers.map(c => c.id === 'c1'
      ? { ...c, promiseDate: '2026-11-02', promiseAmount: 2000, promiseNote: 'New promise' }
      : c)
  };
  const { state: voided, voidRecord } = voidPayment(newer, 'c1', '2026-10', receipt.paymentId, { voidReason: 'wrong amount' });
  assert.equal(voidRecord.remainderWaadaReverted, undefined);
  assert.equal(customerOf(voided).promiseDate, '2026-11-02');
  assert.equal(customerOf(voided).promiseNote, 'New promise');
});

test('correctPayment carries the remainder waada stamp over verbatim', () => {
  const { nextState, receipt } = collectPartial({ remainderWaadaDate: CHIP_DATE });
  const corrected = correctPayment(nextState, 'c1', '2026-10', receipt.paymentId, {
    date: '2026-10-20', amount: 1200, method: 'Cash'
  }, REF);
  assert.deepEqual(remainderWaadaOf(paymentOf(corrected)), { promiseDate: CHIP_DATE, promiseAmount: 2000 });
});

// --- Field Mode: the same recorder option through the sheet's collect flow ---

test('Field Mode: collectFieldModeAdvance forwards the chip date — one recorder, one remainder', () => {
  const state = stateWithDue(3000);
  const entry = getPendingCollectionCustomers(state, '', 'all').find(e => e.id === 'c1');
  const { nextState, receipt, whatsapp } = collectFieldModeAdvance(state, entry, {
    amount: 1000, method: 'Cash', remainderWaadaDate: CHIP_DATE
  }, REF);
  assert.equal(customerOf(nextState).promiseDate, CHIP_DATE);
  assert.equal(customerOf(nextState).promiseAmount, 2000);
  assert.deepEqual(receipt.remainderWaada, { promiseDate: CHIP_DATE, promiseAmount: 2000 });
  assert.ok(whatsapp.text.includes('Baqi Rs. 2,000 • Waada: 2026-10-27'));

  const noChip = collectFieldModeAdvance(state, entry, { amount: 1000, method: 'Cash' }, REF);
  assert.equal(customerOf(noChip.nextState).promiseDate, undefined);
  assert.equal(noChip.receipt.remainderWaada, null);
});

// --- i18n: every remwaada_* key the QC module asks for exists in en + ur ---

test('i18n: every remwaada_* t() call in nav-quick-collect.js resolves in both dictionaries', () => {
  const source = read('nav-quick-collect.js');
  const used = new Set();
  for (const m of source.matchAll(/t\('(remwaada_[a-z0-9_]+)'/g)) used.add(m[1]);
  assert.ok(used.size >= 9, `expected the remainder row's keys, found ${used.size}`);
  for (const key of used) {
    assert.equal(typeof TRANSLATIONS.en[key], 'string', `en missing ${key}`);
    assert.equal(typeof TRANSLATIONS.ur[key], 'string', `ur missing ${key}`);
    assert.ok(!TRANSLATIONS.en[key].includes(key), `en ${key} looks unresolved`);
    assert.ok(!TRANSLATIONS.ur[key].includes(key), `ur ${key} looks unresolved`);
  }
  // The row label carries the Baqi amount placeholder in both languages.
  assert.ok(TRANSLATIONS.en.remwaada_row_label.includes('{amount}'));
  assert.ok(TRANSLATIONS.ur.remwaada_row_label.includes('{amount}'));
  assert.ok(TRANSLATIONS.ur.remwaada_row_label.includes('باقی'));
});
