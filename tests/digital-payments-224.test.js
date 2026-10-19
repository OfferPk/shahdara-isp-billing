import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PAYMENT_METHODS,
  isDigitalPaymentMethod,
  isCashPaymentMethod,
  findDuplicatePaymentReference,
  calculateMethodCollectionTotals,
  addCustomer,
  saveBillMonth,
  addPayment,
  validatePayment
} from '../core.js';

import {
  getDefaultDigitalPaymentsSettings,
  getDigitalPaymentsSettings,
  saveDigitalPaymentsSettings,
  hasConfiguredDigitalPayments,
  formatDigitalPaymentWhatsAppText,
  formatDigitalPaymentReceiptNote,
  DIGITAL_PAYMENTS_SETTINGS_KEY
} from '../digital-payments-settings.js';

import {
  executeQuickCollection,
  formatQuickCollectWhatsAppReceipt,
  renderQuickCollectReceiptCardHtml
} from '../nav-quick-collect.js';

test('Digital Payments (Issue #224): PAYMENT_METHODS includes Raast and helper discriminators work', () => {
  assert.ok(PAYMENT_METHODS.includes('Raast'), 'PAYMENT_METHODS should include Raast');
  assert.ok(PAYMENT_METHODS.includes('JazzCash'), 'PAYMENT_METHODS should include JazzCash');
  assert.ok(PAYMENT_METHODS.includes('Easypaisa'), 'PAYMENT_METHODS should include Easypaisa');
  assert.ok(PAYMENT_METHODS.includes('Bank Transfer'), 'PAYMENT_METHODS should include Bank Transfer');

  assert.equal(isDigitalPaymentMethod('JazzCash'), true);
  assert.equal(isDigitalPaymentMethod('Easypaisa'), true);
  assert.equal(isDigitalPaymentMethod('Raast'), true);
  assert.equal(isDigitalPaymentMethod('Bank Transfer'), true);
  assert.equal(isDigitalPaymentMethod('Bank'), true);
  assert.equal(isDigitalPaymentMethod('Cash'), false);

  assert.equal(isCashPaymentMethod('Cash'), true);
  assert.equal(isCashPaymentMethod('JazzCash'), false);
  assert.equal(isCashPaymentMethod('Raast'), false);
});

test('Digital Payments (Issue #224): findDuplicatePaymentReference detects duplicate transaction IDs across customers', () => {
  let state = { customers: [] };
  state = addCustomer(state, 'Unique Cust Alpha', new Date('2026-10-01'), { phone: '03001234567', area: 'Kala Khata' });
  state = addCustomer(state, 'Unique Cust Beta', new Date('2026-10-01'), { phone: '03007654321', area: 'Main Bazaar' });
  const cust1 = state.customers[0];
  const cust2 = state.customers[1];

  state = saveBillMonth(state, cust1.id, { month: '2026-10', dueAmount: 2000, status: 'pending' }, new Date('2026-10-01'));
  state = saveBillMonth(state, cust2.id, { month: '2026-10', dueAmount: 2000, status: 'pending' }, new Date('2026-10-01'));

  state = addPayment(state, cust1.id, '2026-10', {
    date: '2026-10-15',
    amount: 2000,
    method: 'JazzCash',
    transactionId: 'TXN-987654321'
  }, new Date('2026-10-20'));

  const dupCheck1 = findDuplicatePaymentReference(state, 'TXN-987654321');
  assert.ok(dupCheck1, 'Should find duplicate for TXN-987654321');
  assert.equal(dupCheck1.customerId, cust1.id);
  assert.equal(dupCheck1.customerName, cust1.name);
  assert.equal(dupCheck1.amount, 2000);

  // Case-insensitive / whitespace-trimmed check
  const dupCheckTrimmed = findDuplicatePaymentReference(state, '  txn-987654321  ');
  assert.ok(dupCheckTrimmed, 'Should detect duplicate case-insensitively');

  // Different ID should not trigger duplicate
  const noDup = findDuplicatePaymentReference(state, 'TXN-000000000');
  assert.equal(noDup, null, 'Unused transaction ID should return null');

  // Exclude current payment during correction
  const cust1Payment = state.customers[0].bills[0].payments[0];
  const dupCheckExcluded = findDuplicatePaymentReference(state, 'TXN-987654321', cust1Payment.id);
  assert.equal(dupCheckExcluded, null, 'Self payment ID should be excluded from duplicate search');
});

test('Digital Payments (Issue #224): calculateMethodCollectionTotals breaks down payments accurately', () => {
  let state = { customers: [] };
  state = addCustomer(state, 'Customer Method A', new Date('2026-10-01'), { phone: '03001111111', area: 'Rehman Pura' });
  state = addCustomer(state, 'Customer Method B', new Date('2026-10-01'), { phone: '03002222222', area: 'Rehman Pura' });
  state = addCustomer(state, 'Customer Method C', new Date('2026-10-01'), { phone: '03003333333', area: 'Main' });
  state = addCustomer(state, 'Customer Method D', new Date('2026-10-01'), { phone: '03004444444', area: 'Main' });

  const c1 = state.customers[0].id;
  const c2 = state.customers[1].id;
  const c3 = state.customers[2].id;
  const c4 = state.customers[3].id;

  state = saveBillMonth(state, c1, { month: '2026-10', dueAmount: 1000, status: 'pending' }, new Date('2026-10-01'));
  state = saveBillMonth(state, c2, { month: '2026-10', dueAmount: 1500, status: 'pending' }, new Date('2026-10-01'));
  state = saveBillMonth(state, c3, { month: '2026-10', dueAmount: 2000, status: 'pending' }, new Date('2026-10-01'));
  state = saveBillMonth(state, c4, { month: '2026-10', dueAmount: 2500, status: 'pending' }, new Date('2026-10-01'));

  state = addPayment(state, c1, '2026-10', { date: '2026-10-10', amount: 1000, method: 'Cash' }, new Date('2026-10-20'));
  state = addPayment(state, c2, '2026-10', { date: '2026-10-11', amount: 1500, method: 'JazzCash', transactionId: 'JC123' }, new Date('2026-10-20'));
  state = addPayment(state, c3, '2026-10', { date: '2026-10-12', amount: 2000, method: 'Raast', transactionId: 'RAAST99' }, new Date('2026-10-20'));
  state = addPayment(state, c4, '2026-10', { date: '2026-10-13', amount: 2500, method: 'Easypaisa', transactionId: 'EP555' }, new Date('2026-10-20'));

  const breakdown = calculateMethodCollectionTotals(state, '2026-10');
  assert.equal(breakdown.Cash, 1000);
  assert.equal(breakdown.JazzCash, 1500);
  assert.equal(breakdown.Raast, 2000);
  assert.equal(breakdown.Easypaisa, 2500);
  assert.equal(breakdown.Bank, 0);
  assert.equal(breakdown.total, 7000);
});

test('Digital Payments (Issue #224): validatePayment with strictDigitalReference option', () => {
  const refDate = new Date('2026-10-20');

  // Digital payment with no txn ID and no override should throw under strictDigitalReference
  assert.throws(() => {
    validatePayment({
      date: '2026-10-15',
      amount: 1500,
      method: 'JazzCash'
    }, refDate, { strictDigitalReference: true });
  }, /Transaction ID \/ last 6 digits is required for digital payments/);

  // Digital payment with txn ID passes
  const validTxn = validatePayment({
    date: '2026-10-15',
    amount: 1500,
    method: 'JazzCash',
    transactionId: 'TXN-789'
  }, refDate, { strictDigitalReference: true });
  assert.equal(validTxn.transactionId, 'TXN-789');

  // Digital payment with override reason passes
  const validOverride = validatePayment({
    date: '2026-10-15',
    amount: 1500,
    method: 'Raast',
    referenceOverrideReason: 'Collector verified via WhatsApp screenshot'
  }, refDate, { strictDigitalReference: true });
  assert.equal(validOverride.referenceOverrideReason, 'Collector verified via WhatsApp screenshot');

  // Cash payment never requires txn ID even with strictDigitalReference
  const validCash = validatePayment({
    date: '2026-10-15',
    amount: 1500,
    method: 'Cash'
  }, refDate, { strictDigitalReference: true });
  assert.equal(validCash.method, 'Cash');
});

test('Digital Payments Settings (Issue #224): save and get settings from mock storage', () => {
  const mockStorage = {
    data: {},
    getItem(key) { return this.data[key] ?? null; },
    setItem(key, val) { this.data[key] = String(val); }
  };

  const initial = getDigitalPaymentsSettings(mockStorage);
  assert.equal(hasConfiguredDigitalPayments(initial), false);
  assert.equal(formatDigitalPaymentWhatsAppText(initial), '');

  const saved = saveDigitalPaymentsSettings({
    ownerRaastId: '03009999888',
    ownerTillId: 'TILL-12345',
    ownerAccountTitle: 'Shahdara Broadband NOC',
    ownerBankName: 'Meezan Bank',
    ownerAccountNumber: '01010101010101',
    instructions: 'Send screenshot with your customer number'
  }, mockStorage);

  assert.equal(saved.ownerRaastId, '03009999888');
  assert.equal(saved.ownerTillId, 'TILL-12345');
  assert.equal(hasConfiguredDigitalPayments(saved), true);

  const loaded = getDigitalPaymentsSettings(mockStorage);
  assert.equal(loaded.ownerRaastId, '03009999888');
  assert.equal(loaded.ownerBankName, 'Meezan Bank');

  const waText = formatDigitalPaymentWhatsAppText(loaded);
  assert.ok(waText.includes('Raast ID: 03009999888'), 'Should include Raast in WhatsApp reminder text');
  assert.ok(waText.includes('Till ID'), 'Should include Till in WhatsApp reminder text');
  assert.ok(waText.includes('Meezan Bank'), 'Should include bank info');

  const receiptNote = formatDigitalPaymentReceiptNote(loaded);
  assert.ok(receiptNote.includes('Raast: 03009999888'), 'Receipt note should format compact summary');
  assert.ok(receiptNote.includes('Till: TILL-12345'));
});

test('Digital Payments Quick Collect (Issue #224): executeQuickCollection handles transaction ID and formats receipts', () => {
  let state = { customers: [] };
  state = addCustomer(state, 'Zahid Khan Special', new Date('2026-10-01'), { phone: '03129876543', area: 'Baradari Road' });
  const cid = state.customers[0].id;
  state = saveBillMonth(state, cid, { month: '2026-10', dueAmount: 1800, status: 'pending' }, new Date('2026-10-01'));

  // Missing transaction ID throws when strictDigitalReference: true is set
  assert.throws(() => {
    executeQuickCollection(state, {
      customerId: cid,
      month: '2026-10',
      amount: 1800,
      date: '2026-10-18',
      method: 'Raast',
      strictDigitalReference: true
    }, new Date('2026-10-20'));
  }, /Transaction ID \/ last 6 digits is required/);

  // Digital collection with transaction ID succeeds
  const { nextState, receipt } = executeQuickCollection(state, {
    customerId: cid,
    month: '2026-10',
    amount: 1800,
    date: '2026-10-18',
    method: 'Raast',
    transactionId: 'RAAST-88776655'
  }, new Date('2026-10-20'));

  assert.equal(receipt.transactionId, 'RAAST-88776655');
  assert.equal(receipt.method, 'Raast');
  assert.equal(receipt.isDigital, true);

  const storedPayment = nextState.customers[0].bills[0].payments[0];
  assert.equal(storedPayment.transactionId, 'RAAST-88776655');

  // WhatsApp receipt draft includes Transaction ID
  const wa = formatQuickCollectWhatsAppReceipt(receipt);
  assert.ok(wa.text.includes('Transaction ID / Ref:* RAAST-88776655'));

  // Receipt HTML card includes transaction ID badge
  const cardHtml = renderQuickCollectReceiptCardHtml(receipt);
  assert.ok(cardHtml.includes('RAAST-88776655'));
  assert.ok(cardHtml.includes('qc-txnid-code'));
});
