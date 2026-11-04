/**
 * plan90-cash-in-hand.test.js — Plan 90: collector cash-in-hand
 * limit with a handover prompt.
 * Pins:
 * - the held-cash figure matches the day's unhanded cash receipts
 *   on the same fixture, in integer cents;
 * - the prompt appears exactly when the limit is reached (equal
 *   counts) and a collector below the limit sees no prompt;
 * - the prompt clears when a handover is recorded;
 * - an unset, zero, negative, or non-numeric limit means no limit
 *   is set, so no prompt ever shows;
 * - changing the limit never rewrites a payment, handover, or
 *   denomination count (inputs are never mutated);
 * - voided, explicitly non-cash, and unusable rows are dropped,
 *   never counted on a guessed figure;
 * - the module imports nothing and names no store.
 * Synthetic data only; the prompt advises only, it never locks
 * collection, blocks a payment, or changes any total.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validCashDate,
  formatCashCents,
  normalizeCashReceipt,
  normalizeCashReceipts,
  normalizeCashLimitSettings,
  sumCashInHand,
  buildCashInHandStatus,
  cashInHandSummaryText,
  cashInHandPromptHtml,
  cashInHandReceiptsHtml,
  cashInHandCsv,
  cashInHandFilename,
} from '../cash-in-hand.js';

// Fixture: 5000 + 2500.50 + 1000.25 = 8500.75 exactly, 3 receipts.
const receipts = [
  { date: '2026-01-05', customerId: 'c1', customerName: 'Ayesha', collectorName: 'Saad', amount: 5000, isCash: true },
  { date: '2026-01-05', customerId: 'c2', customerName: 'Bilal', collectorName: 'Saad', amount: 2500.50, method: 'cash' },
  { date: '2026-01-05', customerId: 'c3', customerName: 'Chanda', collectorName: 'Saad', amountCents: 100025 },
];

test('strict dates: 2026-02-30 and malformed dates are invalid, real dates pass', () => {
  assert.equal(validCashDate('2026-02-30'), false);
  assert.equal(validCashDate('2026-13-01'), false);
  assert.equal(validCashDate('2026-02-29'), false);
  assert.equal(validCashDate('2024-02-29'), true);
  assert.equal(validCashDate('2026-01-05'), true);
});

test('cash rows normalise: voided, non-cash, and unusable rows are dropped', () => {
  const rows = normalizeCashReceipts([
    ...receipts,
    { date: '2026-01-05', customerId: 'c9', amount: 100, voided: true },
    { date: '2026-01-05', customerId: 'c9', amount: 100, isCash: false },
    { date: '2026-01-05', customerId: 'c9', amount: 100, method: 'Easypaisa' },
    { date: '2026-02-30', customerId: 'c9', amount: 100 },
    { date: '2026-01-05', customerId: 'c9', amount: 0 },
    { date: '2026-01-05', customerId: 'c9', amount: -50 },
    { date: '2026-01-05', customerId: 'c9' },
    null,
    'not a row',
  ]);
  assert.equal(rows.length, receipts.length);
});

test('cents used as-is, rupees convert once, re-read never inflates', () => {
  const row = normalizeCashReceipt({ date: '2026-01-05', customerId: 'c1', amountCents: 100025 });
  assert.equal(row.amountCents, 100025);
  const rupeeRow = normalizeCashReceipt({ date: '2026-01-05', customerId: 'c1', amount: 2500.50 });
  assert.equal(rupeeRow.amountCents, 250050);
  const reread = normalizeCashReceipt({ ...rupeeRow, amount: undefined });
  assert.equal(reread.amountCents, 250050);
});

test('held-cash figure matches the fixture exactly', () => {
  const sum = sumCashInHand(receipts, { date: '2026-01-05' });
  assert.equal(sum.heldCents, 850075);
  assert.equal(sum.receiptCount, 3);
  assert.equal(formatCashCents(sum.heldCents), 'Rs. 8500.75');
});

test('prompt appears exactly when the limit is reached', () => {
  const at = buildCashInHandStatus({ receipts, settings: { limitCents: 850075 }, date: '2026-01-05' });
  assert.equal(at.prompt, true);
  assert.equal(at.overByCents, 0);
  const above = buildCashInHandStatus({ receipts, settings: { limitCents: 100 }, date: '2026-01-05' });
  assert.equal(above.prompt, true);
  assert.equal(above.overByCents, 850075 - 100);
});

test('a collector below the limit sees no prompt', () => {
  const below = buildCashInHandStatus({ receipts, settings: { limitCents: 850076 }, date: '2026-01-05' });
  assert.equal(below.prompt, false);
  assert.equal(below.overByCents, 0);
  assert.match(cashInHandPromptHtml(below), /^$/);
});

test('prompt clears when a handover is recorded', () => {
  const status = buildCashInHandStatus({ receipts, settings: { limitCents: 100 }, date: '2026-01-05', handoverRecorded: true });
  assert.equal(status.prompt, false);
  assert.equal(status.heldCents, 0);
  assert.equal(status.receiptCount, 0);
  assert.equal(status.handedOver, true);
  assert.equal(cashInHandSummaryText(status), 'Cash handed over — nothing held.');
  assert.equal(cashInHandPromptHtml(status), '');
});

test('unset, zero, negative, or non-numeric limit means no limit and no prompt', () => {
  for (const settings of [{}, { limitCents: 0 }, { limitCents: -5000 }, { limitCents: 'lots' }, { limitCents: NaN }]) {
    const status = buildCashInHandStatus({ receipts, settings, date: '2026-01-05' });
    assert.equal(status.limitSet, false);
    assert.equal(status.limitCents, null);
    assert.equal(status.prompt, false);
  }
  const rupeeLimit = buildCashInHandStatus({ receipts, settings: { limit: 8500.75 }, date: '2026-01-05' });
  assert.equal(rupeeLimit.limitCents, 850075);
  assert.equal(rupeeLimit.prompt, true);
});

test('date and collector filters narrow the sum', () => {
  const otherDay = sumCashInHand([...receipts, { date: '2026-01-06', customerId: 'c4', amount: 999 }], { date: '2026-01-05' });
  assert.equal(otherDay.heldCents, 850075);
  const otherCollector = sumCashInHand([...receipts, { date: '2026-01-05', customerId: 'c4', collectorName: 'Other', amount: 999 }], { date: '2026-01-05', collector: 'Saad' });
  assert.equal(otherCollector.heldCents, 850075);
  const all = sumCashInHand(receipts, { date: '2026-01-05', collector: 'all' });
  assert.equal(all.heldCents, 850075);
});

test('changing the limit never rewrites a receipt', () => {
  const before = JSON.parse(JSON.stringify(receipts));
  const low = buildCashInHandStatus({ receipts, settings: { limitCents: 100 }, date: '2026-01-05' });
  const high = buildCashInHandStatus({ receipts, settings: { limitCents: 99999999 }, date: '2026-01-05' });
  assert.equal(low.prompt, true);
  assert.equal(high.prompt, false);
  assert.equal(low.heldCents, high.heldCents);
  assert.deepEqual(receipts, before);
});

test('summary text covers handed-over, unset, prompt, and below-limit cases', () => {
  const unset = buildCashInHandStatus({ receipts, settings: {}, date: '2026-01-05' });
  assert.match(cashInHandSummaryText(unset), /No cash-in-hand limit set yet/);
  const prompt = buildCashInHandStatus({ receipts, settings: { limitCents: 100 }, date: '2026-01-05' });
  assert.match(cashInHandSummaryText(prompt), /Hand over cash now/);
  const below = buildCashInHandStatus({ receipts, settings: { limitCents: 850076 }, date: '2026-01-05' });
  assert.match(cashInHandSummaryText(below), /below the Rs\. 8500\.76 limit/);
});

test('prompt html names the amount and the handover route, and escapes input', () => {
  const prompt = buildCashInHandStatus({ receipts, settings: { limitCents: 100 }, date: '2026-01-05' });
  const html = cashInHandPromptHtml(prompt);
  assert.match(html, /Hand over cash now/);
  assert.match(html, /Rs\. 8500\.75/);
  assert.match(html, /Hand over cash/);
  const receiptsHtml = cashInHandReceiptsHtml([
    { date: '2026-01-05', customerName: '<script>alert(1)</script>', collectorName: 'Saad', amount: 100 },
  ]);
  assert.equal(receiptsHtml.includes('<script>'), false);
  assert.match(receiptsHtml, /&lt;script&gt;/);
  assert.match(cashInHandReceiptsHtml([]), /No unhanded-over cash receipts/);
});

test('csv quoting and filename', () => {
  const csv = cashInHandCsv([
    { date: '2026-01-05', customerName: 'Ayesha, "Boss"', collectorName: 'Saad', amount: 100 },
  ]);
  assert.equal(csv.split('\n')[0], 'date,customer,collector,amount');
  assert.match(csv, /"Ayesha, ""Boss"""/);
  assert.equal(cashInHandFilename(), 'cash-in-hand.csv');
});

test('purity fence: the module imports nothing and names no store', () => {
  const source = readFileSync(new URL('../cash-in-hand.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('shahdara_'), false);
});
