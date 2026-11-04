import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  CORRECTION_ERROR_KINDS,
  validCorrectionDate,
  normalizeBillingCorrection,
  normalizeBillingCorrectionList,
  addBillingCorrection,
  findBillingCorrection,
  correctionsForCustomer,
  correctionsForBill,
  correctionTriple,
  correctionNet,
  correctionSummaryText,
  correctionHtml,
  correctionCsv,
  correctionFilename,
} from '../billing-corrections.js';

const here = dirname(fileURLToPath(import.meta.url));

const corr = (overrides = {}) => ({
  id: 'CORR-1',
  customerId: 'CUST-76',
  customerName: 'Orient school',
  originalBillId: 'BILL-2026-11',
  errorKind: 'wrong_amount',
  originalAmountCents: 250000,
  correctedAmountCents: 200000,
  reason: 'Wrong package price applied',
  approver: 'Owner',
  date: '2026-11-04',
  lockedSheetRef: '',
  ...overrides,
});

test('validCorrectionDate rejects impossible dates', () => {
  assert.equal(validCorrectionDate('2026-11-04'), true);
  assert.equal(validCorrectionDate('2026-02-30'), false);
  assert.equal(validCorrectionDate('2024-02-29'), true);
  assert.equal(validCorrectionDate('2026-02-29'), false);
  assert.equal(validCorrectionDate('2026-13-01'), false);
  assert.equal(validCorrectionDate('04-11-2026'), false);
});

test('error kind catalogue has exactly the four operator-error kinds', () => {
  assert.deepEqual(CORRECTION_ERROR_KINDS, ['wrong_package', 'wrong_amount', 'wrong_date', 'other']);
});

test('normalizeBillingCorrection refuses half-formed records and drops unknown fields', () => {
  assert.equal(normalizeBillingCorrection(corr({ id: '' })), null);
  assert.equal(normalizeBillingCorrection(corr({ customerId: '' })), null);
  assert.equal(normalizeBillingCorrection(corr({ originalBillId: '' })), null);
  assert.equal(normalizeBillingCorrection(corr({ reason: '  ' })), null);
  assert.equal(normalizeBillingCorrection(corr({ approver: '' })), null);
  assert.equal(normalizeBillingCorrection(corr({ date: '2026-02-30' })), null);
  assert.equal(normalizeBillingCorrection(corr({ errorKind: 'customer_complaint' })), null);
  assert.equal(normalizeBillingCorrection(corr({ originalAmountCents: 0 })), null);
  assert.equal(normalizeBillingCorrection(corr({ originalAmountCents: -100 })), null);
  assert.equal(normalizeBillingCorrection(corr({ correctedAmountCents: -1 })), null);
  const clean = normalizeBillingCorrection(corr({ billTotal: 9999, paymentId: 'PAY-1' }));
  assert.equal(clean.billTotal, undefined);
  assert.equal(clean.paymentId, undefined);
  assert.equal(clean.originalAmountCents, 250000);
});

test('corrected amount of zero is allowed (a bill that should not have existed)', () => {
  const clean = normalizeBillingCorrection(corr({ correctedAmountCents: 0 }));
  assert.equal(clean.correctedAmountCents, 0);
});

test('rupees convert to cents exactly once; cents pass through as-is', () => {
  const fromRupees = normalizeBillingCorrection(corr({ originalAmountCents: undefined, originalAmount: 2500, correctedAmountCents: undefined, correctedAmount: 2000 }));
  assert.equal(fromRupees.originalAmountCents, 250000);
  assert.equal(fromRupees.correctedAmountCents, 200000);
  const centsWin = normalizeBillingCorrection(corr({ originalAmountCents: 250000, originalAmount: 9999 }));
  assert.equal(centsWin.originalAmountCents, 250000);
});

test('addBillingCorrection refuses a duplicate id and never overwrites', () => {
  const once = addBillingCorrection([], corr());
  assert.equal(once.length, 1);
  assert.equal(addBillingCorrection(once, corr({ correctedAmountCents: 150000 })), null);
  assert.equal(addBillingCorrection(once, corr()), null);
  assert.equal(once[0].correctedAmountCents, 200000);
  assert.equal(addBillingCorrection([], corr({ reason: '' })), null);
});

test('correction triple links original, reversing, and corrected bills', () => {
  const triple = correctionTriple(corr());
  assert.equal(triple.length, 3);
  assert.deepEqual(triple.map((row) => row.key), ['original', 'reversing', 'corrected']);
  assert.equal(triple[0].billId, 'BILL-2026-11');
  assert.equal(triple[1].billId, 'BILL-2026-11-REV');
  assert.equal(triple[2].billId, 'BILL-2026-11-CORR');
  assert.equal(triple[1].amountCents, -250000);
  assert.equal(correctionTriple(corr({ reason: '' })).length, 0);
});

test('the triple nets exactly to the corrected amount', () => {
  const net = correctionNet(corr());
  assert.equal(net.originalAmountCents, 250000);
  assert.equal(net.reversingAmountCents, -250000);
  assert.equal(net.correctedAmountCents, 200000);
  assert.equal(net.netAmountCents, 200000);
  const zeroNet = correctionNet(corr({ correctedAmountCents: 0 }));
  assert.equal(zeroNet.netAmountCents, 0);
  assert.equal(correctionNet(corr({ reason: '' })), null);
});

test('find and filters select by customer and by original bill', () => {
  const list = [corr(), corr({ id: 'CORR-2', customerId: 'CUST-77', originalBillId: 'BILL-2026-12' })];
  assert.equal(findBillingCorrection(list, 'CORR-2').customerId, 'CUST-77');
  assert.equal(findBillingCorrection(list, 'NOPE'), null);
  assert.equal(correctionsForCustomer(list, 'CUST-76').length, 1);
  assert.equal(correctionsForBill(list, 'BILL-2026-12').length, 1);
  assert.deepEqual(correctionsForCustomer(list, ''), []);
});

test('addBillingCorrection never mutates its input list', () => {
  const base = [corr()];
  const frozen = JSON.stringify(base);
  const next = addBillingCorrection(base, corr({ id: 'CORR-2' }));
  assert.equal(next.length, 2);
  assert.equal(JSON.stringify(base), frozen);
});

test('summary text counts corrections and totals the corrected bills', () => {
  assert.equal(correctionSummaryText([]), 'No billing corrections recorded.');
  const text = correctionSummaryText([corr(), corr({ id: 'CORR-2', correctedAmountCents: 100000 })]);
  assert.match(text, /2 billing corrections/);
  assert.match(text, /PKR 3,000/);
  assert.match(text, /never edited/);
});

test('correctionHtml shows all three rows, the net, and escapes input', () => {
  const html = correctionHtml(corr({ reason: '<b>oops</b>', approver: 'Owner & Son' }));
  assert.match(html, /Original bill/);
  assert.match(html, /Reversing entry/);
  assert.match(html, /Corrected bill/);
  assert.match(html, /PKR 2,500/);
  assert.match(html, /-PKR 2,500/);
  assert.match(html, /PKR 2,000/);
  assert.match(html, /&lt;b&gt;oops&lt;\/b&gt;/);
  assert.match(html, /Owner &amp; Son/);
  assert.equal(correctionHtml(corr({ reason: '' })), '');
});

test('correctionHtml names a locked sheet reference without touching it', () => {
  const html = correctionHtml(corr({ lockedSheetRef: 'PS-2026-11' }));
  assert.match(html, /PS-2026-11/);
  assert.match(html, /reference only/);
});

test('correctionCsv quotes fields and carries the net column', () => {
  const csv = correctionCsv([corr({ reason: 'Wrong "price", fixed' })]);
  const lines = csv.split('\n');
  assert.match(lines[0], /netAmountCents$/);
  assert.match(lines[1], /"Wrong ""price"", fixed"/);
  assert.match(lines[1], /,200000,/);
  assert.equal(correctionFilename(), 'billing-corrections.csv');
});

test('module is pure: no imports, no storage, no DOM, no customer-case workflow', () => {
  const source = readFileSync(join(here, '..', 'billing-corrections.js'), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /localStorage/);
  assert.doesNotMatch(source, /document\./);
  assert.doesNotMatch(source, /dispute/i);
  assert.doesNotMatch(source, /fetch\(/);
});
