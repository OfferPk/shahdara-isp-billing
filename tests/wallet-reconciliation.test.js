import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PAYMENT_METHODS,
  isDigitalPaymentMethod,
  isCashPaymentMethod,
  findDuplicatePaymentReference,
  addCustomer,
  saveBillMonth,
  addPayment,
  correctPayment,
  validatePayment,
  setPaymentWalletVerified
} from '../core.js';

import {
  normalizeTid,
  isWalletMethod,
  isDigitalWalletMethod,
  walletVerificationLabel,
  buildWalletReconciliation,
  walletReconciliationSummaryText
} from '../wallet-reconciliation.js';

function twoCustomerState() {
  let state = { customers: [] };
  state = addCustomer(state, 'Wallet Cust Alpha', new Date('2026-10-01'), { phone: '03001234567', area: 'Kala Khata' });
  state = addCustomer(state, 'Wallet Cust Beta', new Date('2026-10-01'), { phone: '03007654321', area: 'Main Bazaar' });
  const cust1 = state.customers[0];
  const cust2 = state.customers[1];
  state = saveBillMonth(state, cust1.id, { month: '2026-10', dueAmount: 5000, status: 'pending' }, new Date('2026-10-01'));
  state = saveBillMonth(state, cust2.id, { month: '2026-10', dueAmount: 5000, status: 'pending' }, new Date('2026-10-01'));
  return { state, cust1, cust2 };
}

function pay(state, customerId, fields) {
  return addPayment(state, customerId, '2026-10', fields, new Date('2026-10-20'));
}

test('SISP-21: normalizeTid strips all whitespace and lowercases', () => {
  assert.equal(normalizeTid(' 1234 5678 901 '), '12345678901');
  assert.equal(normalizeTid('TXN-AB12'), 'txn-ab12');
  assert.equal(normalizeTid(''), '');
  assert.equal(normalizeTid(null), '');
  assert.equal(isWalletMethod('Easypaisa'), true);
  assert.equal(isWalletMethod('NayaPay'), true);
  assert.equal(isWalletMethod('Bank Transfer'), true);
  assert.equal(isWalletMethod('Cash'), false);
  assert.equal(isDigitalWalletMethod('Raast'), true);
  assert.equal(isDigitalWalletMethod('Cash at Waseem Abbasi shop'), false);
});

test('SISP-21: NayaPay is a canonical digital payment method', () => {
  assert.ok(PAYMENT_METHODS.includes('NayaPay'), 'PAYMENT_METHODS should include NayaPay');
  assert.equal(isDigitalPaymentMethod('NayaPay'), true);
  assert.equal(isCashPaymentMethod('NayaPay'), false);
});

test('SISP-21 criterion: a second payment with an existing 11-digit EasyPaisa TID warns, naming the original record', () => {
  let { state, cust1 } = twoCustomerState();
  state = pay(state, cust1.id, { date: '2026-10-05', amount: 3000, method: 'Easypaisa', transactionId: '12345678901' });
  const dup = findDuplicatePaymentReference(state, '12345678901');
  assert.ok(dup, 'Should find the duplicate');
  assert.equal(dup.customerId, cust1.id);
  assert.equal(dup.customerNumber, cust1.customerNumber);
  assert.equal(dup.customerName, 'Wallet Cust Alpha');
  assert.equal(dup.date, '2026-10-05');
  assert.equal(dup.amount, 3000);
  assert.equal(dup.method, 'Easypaisa');
  assert.equal(dup.transactionId, '12345678901');
});

test('SISP-21: the guard matches spaced and mixed-case re-typings of the same TID', () => {
  let { state, cust1 } = twoCustomerState();
  state = pay(state, cust1.id, { date: '2026-10-05', amount: 3000, method: 'Easypaisa', transactionId: '12345678901' });
  assert.ok(findDuplicatePaymentReference(state, '1234 5678 901'), 'Spaced re-typing must match');
  assert.ok(findDuplicatePaymentReference(state, ' 12345678901 '), 'Padded re-typing must match');
  assert.equal(findDuplicatePaymentReference(state, '12345678902'), null, 'A different TID must not match');
  const originalId = state.customers[0].bills.find((b) => b.month === '2026-10').payments[0].id;
  assert.equal(findDuplicatePaymentReference(state, '12345678901', originalId), null, 'Self payment ID is excluded');
});

test('SISP-21: the guard covers NayaPay and Bank Transfer TIDs too', () => {
  let { state, cust1, cust2 } = twoCustomerState();
  state = pay(state, cust1.id, { date: '2026-10-06', amount: 2000, method: 'NayaPay', transactionId: 'NAYA-555' });
  state = pay(state, cust2.id, { date: '2026-10-07', amount: 1500, method: 'Bank Transfer', transactionId: 'BANK-777' });
  assert.equal(findDuplicatePaymentReference(state, 'naya-555').customerId, cust1.id);
  assert.equal(findDuplicatePaymentReference(state, 'bank-777').customerId, cust2.id);
});

test('SISP-21: walletVerified rides validatePayment, addPayment, corrections and backup-style revalidation', () => {
  assert.equal(validatePayment({ date: '2026-10-05', amount: 1000, method: 'JazzCash', walletVerified: true }).walletVerified, true);
  assert.equal(validatePayment({ date: '2026-10-05', amount: 1000, method: 'JazzCash', walletVerified: false }).walletVerified, undefined);
  assert.equal(validatePayment({ date: '2026-10-05', amount: 1000, method: 'JazzCash' }).walletVerified, undefined);

  let { state, cust1 } = twoCustomerState();
  state = pay(state, cust1.id, { date: '2026-10-05', amount: 3000, method: 'JazzCash', transactionId: 'JC-1' });
  const paymentId = state.customers[0].bills.find((b) => b.month === '2026-10').payments[0].id;
  state = setPaymentWalletVerified(state, cust1.id, '2026-10', paymentId, true);
  let payment = state.customers[0].bills.find((b) => b.month === '2026-10').payments[0];
  assert.equal(payment.walletVerified, true);
  assert.equal(walletVerificationLabel(payment), 'Verified in Statement');
  // A correction that carries no verification field must not drop it.
  state = correctPayment(state, cust1.id, '2026-10', paymentId, { date: '2026-10-05', amount: 3100, method: 'JazzCash', transactionId: 'JC-1' }, new Date('2026-10-20'));
  payment = state.customers[0].bills.find((b) => b.month === '2026-10').payments[0];
  assert.equal(payment.walletVerified, true);
  // Toggling back removes the field entirely (absent === pending, never verified).
  state = setPaymentWalletVerified(state, cust1.id, '2026-10', paymentId, false);
  payment = state.customers[0].bills.find((b) => b.month === '2026-10').payments[0];
  assert.equal(payment.walletVerified, undefined);
  assert.equal(walletVerificationLabel(payment), 'Pending Screenshot Verification');
  assert.throws(() => setPaymentWalletVerified(state, cust1.id, '2026-10', 'no-such-payment', true), /Payment not found/);
});

test('SISP-21: monthly wallet breakdown separates wallets, cash and shop handovers', () => {
  let { state, cust1, cust2 } = twoCustomerState();
  state = pay(state, cust1.id, { date: '2026-10-05', amount: 3000, method: 'Easypaisa', transactionId: 'EP-1' });
  state = pay(state, cust1.id, { date: '2026-10-06', amount: 2000, method: 'JazzCash', transactionId: 'JC-1' });
  state = pay(state, cust2.id, { date: '2026-10-07', amount: 2500, method: 'NayaPay', transactionId: 'NP-1' });
  state = pay(state, cust2.id, { date: '2026-10-08', amount: 1500, method: 'Bank Transfer', transactionId: 'BT-1' });
  state = pay(state, cust1.id, { date: '2026-10-09', amount: 4000, method: 'Cash' });
  state = pay(state, cust2.id, { date: '2026-10-10', amount: 1000, method: 'Cash at Waseem Abbasi shop' });
  state = pay(state, cust1.id, { date: '2026-09-30', amount: 9999, method: 'Easypaisa', transactionId: 'EP-OLD' });
  const epPaymentId = state.customers[0].bills.find((b) => b.month === '2026-10').payments.find((p) => p.transactionId === 'EP-1').id;
  state = setPaymentWalletVerified(state, cust1.id, '2026-10', epPaymentId, true);

  const settlements = [
    { shop: 'Waseem Abbasi Shop', amount: 1000, date: '2026-10-12' },
    { shop: 'Hassan Shop', amount: 500, date: '2026-09-28' }
  ];
  const report = buildWalletReconciliation(state.customers, '2026-10', settlements);
  assert.equal(report.byWallet.Easypaisa.amount, 3000);
  assert.equal(report.byWallet.Easypaisa.verifiedCount, 1);
  assert.equal(report.byWallet.Easypaisa.pendingCount, 0);
  assert.equal(report.byWallet.JazzCash.amount, 2000);
  assert.equal(report.byWallet.JazzCash.pendingCount, 1);
  assert.equal(report.byWallet.NayaPay.amount, 2500);
  assert.equal(report.byWallet['Bank Transfer'].amount, 1500);
  assert.equal(report.cash.amount, 4000);
  assert.equal(report.shopPayments.amount, 1000);
  assert.equal(report.shopHandovers.amount, 1000);
  assert.equal(report.shopHandovers.count, 1);
  assert.equal(report.shopHandovers.perShop['Waseem Abbasi Shop'].amount, 1000);
  assert.equal(report.digitalTotal, 9000);
  assert.equal(report.pendingVerification.length, 3);
});

test('SISP-21: duplicate TID groups are flagged in the monthly reconciliation', () => {
  let { state, cust1, cust2 } = twoCustomerState();
  state = pay(state, cust1.id, { date: '2026-10-05', amount: 3000, method: 'Easypaisa', transactionId: 'DUP 999' });
  state = pay(state, cust2.id, { date: '2026-10-06', amount: 3000, method: 'Easypaisa', transactionId: 'dup999' });
  state = pay(state, cust1.id, { date: '2026-10-07', amount: 1000, method: 'JazzCash', transactionId: 'UNIQUE-1' });
  const report = buildWalletReconciliation(state.customers, '2026-10', []);
  assert.equal(report.duplicateGroups.length, 1);
  assert.equal(report.duplicateGroups[0].normalizedTid, 'dup999');
  assert.equal(report.duplicateGroups[0].payments.length, 2);
  assert.deepEqual(report.duplicateGroups[0].payments.map((p) => p.customerName).sort(), ['Wallet Cust Alpha', 'Wallet Cust Beta']);
  const text = walletReconciliationSummaryText(report);
  assert.match(text, /Duplicate TIDs: 1/);
  assert.match(text, /Easypaisa: PKR 6000/);
});
