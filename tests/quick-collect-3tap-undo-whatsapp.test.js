import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePakistaniWhatsAppPhone,
  formatWhatsAppUrl
} from '../form-validation.js';
import {
  getCustomerPaymentDefaults,
  executeQuickCollection,
  formatQuickCollectWhatsAppReceipt,
  generateReceiptImageBlob
} from '../nav-quick-collect.js';
import {
  saveBillMonth,
  deletePayment
} from '../core.js';

test('normalizePakistaniWhatsAppPhone normalizes various Pakistani and international phone formats', () => {
  assert.equal(normalizePakistaniWhatsAppPhone('03001234567')?.intlDigits, '923001234567');
  assert.equal(normalizePakistaniWhatsAppPhone('0300-1234567')?.intlDigits, '923001234567');
  assert.equal(normalizePakistaniWhatsAppPhone('0300 1234567')?.intlDigits, '923001234567');
  assert.equal(normalizePakistaniWhatsAppPhone('+92 300 1234567')?.intlDigits, '923001234567');
  assert.equal(normalizePakistaniWhatsAppPhone('0092 300 1234567')?.intlDigits, '923001234567');
  assert.equal(normalizePakistaniWhatsAppPhone('923001234567')?.intlDigits, '923001234567');
  assert.equal(normalizePakistaniWhatsAppPhone('(0300) 123-4567')?.intlDigits, '923001234567');
  assert.equal(normalizePakistaniWhatsAppPhone('03219876543')?.intlDigits, '923219876543');
  assert.equal(normalizePakistaniWhatsAppPhone('03451122334')?.intlDigits, '923451122334');

  // International formats
  assert.equal(normalizePakistaniWhatsAppPhone('+14155552671')?.intlDigits, '14155552671');
  assert.equal(normalizePakistaniWhatsAppPhone('+447911123456')?.intlDigits, '447911123456');

  // Invalid numbers
  assert.equal(normalizePakistaniWhatsAppPhone('')?.valid, false);
  assert.equal(normalizePakistaniWhatsAppPhone('12345')?.valid, false);
  assert.equal(normalizePakistaniWhatsAppPhone('04235881234')?.valid, false); // Landline (042)
  assert.equal(normalizePakistaniWhatsAppPhone('abc')?.valid, false);
});

test('formatWhatsAppUrl generates valid wa.me link with normalized 923xx mobile for Pakistani inputs', () => {
  const result = formatWhatsAppUrl('03001234567', 'Assalam-o-Alaikum Receipt');
  assert.equal(result.validPhone, true);
  assert.equal(result.formattedPhone, '+92 300 1234567');
  assert.match(result.url, /^https:\/\/wa\.me\/923001234567\?text=Assalam-o-Alaikum%20Receipt$/);

  const dashFormat = formatWhatsAppUrl('0300-1234567', 'Test Message');
  assert.equal(dashFormat.validPhone, true);
  assert.equal(dashFormat.formattedPhone, '+92 300 1234567');
  assert.match(dashFormat.url, /^https:\/\/wa\.me\/923001234567\?text=Test%20Message$/);
});

test('getCustomerPaymentDefaults calculates currentMonthBalance alongside totalDues', () => {
  let state = {
    customers: [{
      id: 'cust-1',
      customerNumber: 101,
      name: 'Muhammad Imran',
      phone: '03001234567',
      area: 'Main Bazaar',
      archived: false,
      bills: []
    }]
  };
  state = saveBillMonth(state, 'cust-1', { month: '2026-09', dueAmount: 1500, status: 'pending' }, new Date('2026-09-01T10:00:00Z'));
  state = saveBillMonth(state, 'cust-1', { month: '2026-10', dueAmount: 1500, status: 'pending' }, new Date('2026-10-01T10:00:00Z'));

  const defaults = getCustomerPaymentDefaults(state, 'cust-1', new Date('2026-10-15T10:00:00Z'));
  assert.equal(defaults.name, 'Muhammad Imran');
  assert.equal(defaults.phone, '03001234567');
  assert.equal(defaults.totalDues, 3000);
  assert.equal(defaults.currentMonthBalance, 1500);
});

test('formatQuickCollectWhatsAppReceipt formats bilingual receipt with normalized wa.me URL', () => {
  const receipt = {
    paymentId: 'p-1',
    receiptNumber: 'RCPT-1001-202610-01',
    customerId: 'c-1',
    customerNumber: 1001,
    customerName: 'Tariq Butt',
    phone: '0301-7654321',
    area: 'Kala Khata',
    month: '2026-10',
    date: '2026-10-19',
    amount: 1500,
    method: 'Cash',
    paidBy: 'Self',
    newTotalDues: 0,
    newBalanceDue: 0
  };

  const draft = formatQuickCollectWhatsAppReceipt(receipt);
  assert.equal(draft.validPhone, true);
  assert.equal(draft.formattedPhone, '+92 301 7654321');
  assert.match(draft.url, /^https:\/\/wa\.me\/923017654321\?text=/);
  assert.match(draft.text, /SHAHDARA FIBER NETWORK/);
  assert.match(draft.text, /Tariq Butt/);
  assert.match(draft.text, /PKR 1,500/);
  assert.match(draft.text, /مکمل ادا شدہ/);
});

test('executeQuickCollection and deletePayment provide 100% reversible collection workflow', () => {
  let state = {
    customers: [{
      id: 'cust-2',
      customerNumber: 102,
      name: 'Zahid Mahmood',
      phone: '03009988776',
      area: 'Kot Mohibbu',
      archived: false,
      bills: []
    }]
  };
  state = saveBillMonth(state, 'cust-2', { month: '2026-10', dueAmount: 1800, status: 'pending' }, new Date('2026-10-01T10:00:00Z'));

  // Collect payment
  const { nextState, receipt } = executeQuickCollection(state, {
    customerId: 'cust-2',
    month: '2026-10',
    amount: 1800,
    date: '2026-10-19',
    method: 'JazzCash'
  }, new Date('2026-10-19T10:00:00Z'));

  assert.equal(receipt.success, true);
  assert.equal(receipt.amount, 1800);
  assert.equal(receipt.method, 'JazzCash');
  assert.equal(receipt.newTotalDues, 0);

  const billWithPayment = nextState.customers[0].bills[0];
  assert.equal(billWithPayment.payments.length, 1);
  assert.equal(billWithPayment.payments[0].id, receipt.paymentId);

  // Undo / Delete payment
  const revertedState = deletePayment(nextState, 'cust-2', '2026-10', receipt.paymentId);
  const revertedBill = revertedState.customers[0].bills[0];
  assert.equal(revertedBill.payments.length, 0);
});

test('generateReceiptImageBlob returns null safely when canvas is unavailable in node', async () => {
  const blob = await generateReceiptImageBlob({
    receiptNumber: 'RCPT-101',
    customerName: 'Test Customer',
    amount: 1000
  });
  assert.equal(blob, null);
});
