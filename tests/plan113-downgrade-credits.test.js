import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validDowngradeCreditDate,
  downgradeCreditAmountCents,
  computeDowngradeCreditCents,
  normalizeDowngradeCredit,
  normalizeDowngradeCreditList,
  findDowngradeCredit,
  upsertDowngradeCredit,
  removeDowngradeCredit,
  creditsForCustomer,
  appliedDowngradeCredits,
  unappliedDowngradeCredits,
  totalDowngradeCreditsCents,
  applyDowngradeCredit,
  clearDowngradeCreditApplication,
  downgradeCreditArithmeticText,
  downgradeCreditSummaryText,
  downgradeCreditHtml,
  downgradeCreditCsv,
  downgradeCreditFilename,
} from '../downgrade-credits.js';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'downgrade-credits.js'), 'utf8');

const credit = (overrides = {}) => ({
  id: 'DC-1',
  customerId: 'CUST-76',
  customerName: 'Orient school',
  oldPackage: '20 Mbps',
  newPackage: '10 Mbps',
  downgradeDate: '2026-11-10',
  daysUnused: 10,
  dailyRateCents: 5000,
  paidForUnusedDaysCents: 60000,
  ...overrides,
});

test('strict dates: real dates pass, impossible dates fail', () => {
  assert.equal(validDowngradeCreditDate('2026-11-10'), true);
  assert.equal(validDowngradeCreditDate('2026-02-29'), false);
  assert.equal(validDowngradeCreditDate('2026-02-30'), false);
  assert.equal(validDowngradeCreditDate('2026-13-01'), false);
  assert.equal(validDowngradeCreditDate('10-11-2026'), false);
  assert.equal(validDowngradeCreditDate(''), false);
});

test('rupees convert once, cents pass through as-is, never inflated', () => {
  assert.equal(downgradeCreditAmountCents({ dailyRateCents: 5000 }, 'dailyRateCents', 'dailyRate'), 5000);
  assert.equal(downgradeCreditAmountCents({ dailyRate: 50 }, 'dailyRateCents', 'dailyRate'), 5000);
  assert.equal(downgradeCreditAmountCents({ dailyRate: '50' }, 'dailyRateCents', 'dailyRate'), 5000);
  assert.equal(downgradeCreditAmountCents({ dailyRate: 'abc' }, 'dailyRateCents', 'dailyRate'), null);
  assert.equal(downgradeCreditAmountCents({}, 'dailyRateCents', 'dailyRate'), null);
});

test('half-formed records refused: missing fields, same package, bad numbers', () => {
  assert.equal(normalizeDowngradeCredit(credit({ id: '' })), null);
  assert.equal(normalizeDowngradeCredit(credit({ customerId: '  ' })), null);
  assert.equal(normalizeDowngradeCredit(credit({ oldPackage: '' })), null);
  assert.equal(normalizeDowngradeCredit(credit({ newPackage: '' })), null);
  assert.equal(normalizeDowngradeCredit(credit({ newPackage: '20 mbps' })), null);
  assert.equal(normalizeDowngradeCredit(credit({ downgradeDate: '2026-02-30' })), null);
  assert.equal(normalizeDowngradeCredit(credit({ daysUnused: 0 })), null);
  assert.equal(normalizeDowngradeCredit(credit({ daysUnused: 2.5 })), null);
  assert.equal(normalizeDowngradeCredit(credit({ daysUnused: -3 })), null);
  assert.equal(normalizeDowngradeCredit(credit({ dailyRateCents: 0 })), null);
  assert.equal(normalizeDowngradeCredit(credit({ dailyRateCents: -100 })), null);
  assert.equal(normalizeDowngradeCredit(credit({ paidForUnusedDaysCents: 0 })), null);
  assert.equal(normalizeDowngradeCredit(null), null);
  assert.equal(normalizeDowngradeCreditList([credit(), credit({ id: '' })]).length, 1);
});

test('unknown fields dropped so a credit never grows bill or payment fields', () => {
  const normalized = normalizeDowngradeCredit(credit({ billTotalCents: 99999, paymentId: 'PAY-1', price: 123 }));
  assert.equal(normalized.billTotalCents, undefined);
  assert.equal(normalized.paymentId, undefined);
  assert.equal(normalized.price, undefined);
  assert.equal(normalized.creditCents, 50000);
});

test('credit arithmetic: uncapped product, and cap at amount paid', () => {
  assert.equal(computeDowngradeCreditCents(10, 5000, 60000), 50000);
  assert.equal(computeDowngradeCreditCents(10, 5000, 45000), 45000);
  assert.equal(computeDowngradeCreditCents(10, 5000, 50000), 50000);
  assert.equal(computeDowngradeCreditCents(0, 5000, 60000), null);
  assert.equal(computeDowngradeCreditCents(10, 0, 60000), null);
  assert.equal(computeDowngradeCreditCents(10, 5000, 0), null);
  assert.equal(normalizeDowngradeCredit(credit({ paidForUnusedDaysCents: 45000 })).creditCents, 45000);
  assert.match(downgradeCreditArithmeticText(credit({ paidForUnusedDaysCents: 45000 })), /capped at the amount paid/);
  assert.match(downgradeCreditArithmeticText(credit()), /10 unused days x Rs\. 50\.00 per day = Rs\. 500\.00 = credit Rs\. 500\.00/);
});

test('a stored credit figure disagreeing with its inputs is refused, never corrected', () => {
  assert.equal(normalizeDowngradeCredit(credit({ creditCents: 49999 })), null);
  assert.equal(normalizeDowngradeCredit(credit({ creditAmount: 499.99 })), null);
  assert.equal(normalizeDowngradeCredit(credit({ creditCents: 50000 })).creditCents, 50000);
});

test('duplicate id: identical re-save unchanged, different figures refused', () => {
  const list = upsertDowngradeCredit([], credit());
  assert.equal(upsertDowngradeCredit(list, credit()).length, 1);
  assert.deepEqual(upsertDowngradeCredit(list, credit()), list);
  assert.deepEqual(upsertDowngradeCredit(list, credit({ daysUnused: 9 })), list);
  assert.deepEqual(upsertDowngradeCredit(list, credit({ newPackage: '5 Mbps' })), list);
  assert.equal(findDowngradeCredit(list, 'DC-1').daysUnused, 10);
});

test('apply gates: unknown credit, blank bill, and already-applied refused', () => {
  const list = upsertDowngradeCredit([], credit());
  assert.deepEqual(applyDowngradeCredit(list, 'DC-1', ''), list);
  assert.deepEqual(applyDowngradeCredit(list, 'DC-9', 'BILL-1'), list);
  const applied = applyDowngradeCredit(list, 'DC-1', 'BILL-2026-11');
  assert.equal(applied[0].appliedBillId, 'BILL-2026-11');
  assert.deepEqual(applyDowngradeCredit(applied, 'DC-1', 'BILL-2026-12'), applied);
  assert.equal(appliedDowngradeCredits(applied).length, 1);
  assert.equal(unappliedDowngradeCredits(applied).length, 0);
  assert.equal(unappliedDowngradeCredits(list).length, 1);
});

test('clearing an application clears only the bill link', () => {
  const applied = applyDowngradeCredit(upsertDowngradeCredit([], credit()), 'DC-1', 'BILL-2026-11');
  const cleared = clearDowngradeCreditApplication(applied, 'DC-1');
  assert.equal(cleared[0].appliedBillId, '');
  assert.equal(cleared[0].creditCents, 50000);
  assert.equal(cleared[0].daysUnused, 10);
});

test('remove: unapplied removed, applied stays while linked to a bill', () => {
  const list = upsertDowngradeCredit([], credit());
  assert.equal(removeDowngradeCredit(list, 'DC-1').length, 0);
  const applied = applyDowngradeCredit(list, 'DC-1', 'BILL-2026-11');
  assert.deepEqual(removeDowngradeCredit(applied, 'DC-1'), applied);
  assert.equal(removeDowngradeCredit(list, 'DC-9').length, 1);
});

test('filters and totals per customer', () => {
  const list = upsertDowngradeCredit(upsertDowngradeCredit([], credit()), credit({ id: 'DC-2', customerId: 'CUST-9', daysUnused: 5, paidForUnusedDaysCents: 60000 }));
  assert.equal(creditsForCustomer(list, 'CUST-76').length, 1);
  assert.equal(creditsForCustomer(list, 'CUST-9').length, 1);
  assert.equal(totalDowngradeCreditsCents(list), 75000);
  assert.equal(downgradeCreditSummaryText(list), '2 downgrade credits totalling Rs. 750.00; 0 applied to a bill, 2 unapplied.');
  assert.equal(downgradeCreditSummaryText([]), 'No downgrade credits recorded yet.');
});

test('inputs never mutated by any operation', () => {
  const original = credit();
  const snapshot = JSON.stringify(original);
  const list = upsertDowngradeCredit([], original);
  applyDowngradeCredit(list, 'DC-1', 'BILL-2026-11');
  removeDowngradeCredit(list, 'DC-1');
  assert.equal(JSON.stringify(original), snapshot);
  assert.equal(list[0].appliedBillId, '');
});

test('summary, HTML escaping, and CSV quoting', () => {
  const html = downgradeCreditHtml(credit({ customerName: '<b>Test</b>', note: 'a "quoted" note' }));
  assert.doesNotMatch(html, /<b>Test<\/b>/);
  assert.match(html, /&lt;b&gt;Test&lt;\/b&gt;/);
  assert.match(html, /Not yet applied to any bill/);
  const appliedHtml = downgradeCreditHtml({ ...credit(), appliedBillId: 'BILL-2026-11' });
  assert.match(appliedHtml, /Applied to bill BILL-2026-11/);
  const csv = downgradeCreditCsv([credit({ note: 'says "hi", thanks' })]);
  assert.match(csv, /^id,customer,old package,new package/);
  assert.match(csv, /"says ""hi"", thanks"/);
  assert.equal(downgradeCreditFilename(), 'downgrade-credits.csv');
});

test('purity fence: no imports, no storage/DOM/network, no goodwill or promo module', () => {
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /localStorage|document\.|window\.|fetch\(|XMLHttpRequest/);
  assert.doesNotMatch(source, /outage-credits|promo-offers|credit-balance/);
  assert.doesNotMatch(source, /suspension-records|approval-limits/);
});

test('wiring: panel element ids present in index.html', () => {
  const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
  for (const id of [
    'downgradeCreditBody', 'downgradeCreditSummary', 'downgradeCreditCustomer',
    'downgradeCreditFilterCustomer', 'downgradeCreditOld', 'downgradeCreditNew',
    'downgradeCreditDate', 'downgradeCreditDays', 'downgradeCreditRate',
    'downgradeCreditPaid', 'downgradeCreditNote', 'downgradeCreditSaveBtn',
    'downgradeCreditApplyCredit', 'downgradeCreditApplyBill', 'downgradeCreditApplyBtn',
    'downgradeCreditExportBtn',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
