/**
 * plan88-unusual-payment-flags.test.js — Plan 88: unusual payment
 * flag for review (amount far from the bill).
 * Pins:
 * - a payment differing from its bill by more than the tolerance
 *   is flagged with the payment, the bill, and the rule;
 * - a payment inside tolerance never appears;
 * - a bill-less payment above the threshold is flagged, at or
 *   below it is not;
 * - several payments for one customer on one day are flagged
 *   together; fewer are not;
 * - clearing a flag records who reviewed it and why, without
 *   touching the payment record, and the cleared payment stays
 *   out of the open list;
 * - flags are filterable by reason and mohalla (Plan T keys,
 *   __unassigned__ never dropped);
 * - voided and unusable rows never appear; amounts in integer
 *   cents, cents used as-is on re-read; impossible dates never
 *   match; inputs never mutated.
 * Synthetic data only; flagging never blocks, changes, or
 * creates any bill, payment, suspense item, or dispute case.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  UNUSUAL_FLAG_DEFAULTS,
  normalizeUnusualFlagSettings,
  normalizePaymentRow,
  buildUnusualFlags,
  flagsFiltered,
  buildFlagSummary,
  flagSummaryText,
  normalizeClearedList,
  clearFlag,
  removeCleared,
  mohallaKey,
  formatCents,
  flagsHtml,
  flagsCsv,
  flagsFilename,
} from '../unusual-payment-flags.js';

const bills = [
  { billId: 'B-1', customerId: 'C-1', billAmountCents: 150000 },
  { billId: 'B-2', customerId: 'C-2', billAmountCents: 200000 },
];
const base = (over = {}) => ({
  paymentId: 'P-1', customerId: 'C-1', customerName: 'Test Customer',
  mohalla: 'Bani', billId: 'B-1', date: '2026-10-05',
  amountCents: 150000, channel: 'JazzCash', reference: 'TID-1',
  ...over,
});

test('settings: defaults are 10% tolerance, Rs. 500 no-bill threshold, 3 same-day; invalid falls back', () => {
  assert.deepEqual(UNUSUAL_FLAG_DEFAULTS, { tolerancePercent: 10, noBillThresholdCents: 50000, sameDayThreshold: 3 });
  assert.deepEqual(normalizeUnusualFlagSettings({}), UNUSUAL_FLAG_DEFAULTS);
  assert.deepEqual(normalizeUnusualFlagSettings({ tolerancePercent: -5, noBillThresholdCents: 'x', sameDayThreshold: 1 }), UNUSUAL_FLAG_DEFAULTS);
  assert.deepEqual(normalizeUnusualFlagSettings({ tolerancePercent: 25, noBillThresholdCents: 10000, sameDayThreshold: 2 }), { tolerancePercent: 25, noBillThresholdCents: 10000, sameDayThreshold: 2 });
});

test('payment inside tolerance never appears; just over tolerance is flagged with bill and rule', () => {
  // 10% of 150000 is 15000: 165000 is exactly at tolerance (not flagged), 165001 is over.
  assert.deepEqual(buildUnusualFlags({ payments: [base({ amountCents: 165000 })], bills }), []);
  const flags = buildUnusualFlags({ payments: [base({ amountCents: 165001 })], bills });
  assert.equal(flags.length, 1);
  assert.deepEqual(flags[0].reasons, ['amount_differs']);
  assert.equal(flags[0].billId, 'B-1');
  assert.equal(flags[0].billAmountCents, 150000);
  assert.equal(flags[0].amountCents, 165001);
  assert.match(flags[0].reasonText, /Rs\. 1650\.01 vs bill Rs\. 1500\.00/);
});

test('payment far below the bill is flagged too', () => {
  const flags = buildUnusualFlags({ payments: [base({ amountCents: 100000 })], bills });
  assert.equal(flags.length, 1);
  assert.deepEqual(flags[0].reasons, ['amount_differs']);
});

test('bill-less payment above the threshold flagged; at or below it not flagged', () => {
  assert.deepEqual(buildUnusualFlags({ payments: [base({ billId: '', amountCents: 50000 })], bills }), []);
  assert.deepEqual(buildUnusualFlags({ payments: [base({ billId: '', amountCents: 40000 })], bills }), []);
  const flags = buildUnusualFlags({ payments: [base({ billId: '', amountCents: 50001 })], bills });
  assert.equal(flags.length, 1);
  assert.deepEqual(flags[0].reasons, ['no_bill']);
  assert.equal(flags[0].billId, null);
  assert.equal(flags[0].billAmountCents, null);
});

test('several payments on one day flagged together; two are not', () => {
  const two = [base({ paymentId: 'P-1' }), base({ paymentId: 'P-2' })];
  assert.deepEqual(buildUnusualFlags({ payments: two, bills }), []);
  const three = [...two, base({ paymentId: 'P-3' })];
  const flags = buildUnusualFlags({ payments: three, bills });
  assert.equal(flags.length, 3);
  assert.ok(flags.every((f) => f.reasons.includes('several_same_day')));
  assert.ok(flags.every((f) => f.sameDayCount === 3));
  // A different customer's same-day payments do not join the group.
  const mixed = [...three, base({ paymentId: 'P-4', customerId: 'C-2', billId: 'B-2', amountCents: 200000 })];
  assert.equal(buildUnusualFlags({ payments: mixed, bills }).length, 3);
});

test('a payment can carry two reasons at once', () => {
  const payments = [
    base({ paymentId: 'P-1', amountCents: 100000 }),
    base({ paymentId: 'P-2', amountCents: 150000 }),
    base({ paymentId: 'P-3', amountCents: 150000 }),
  ];
  const flags = buildUnusualFlags({ payments, bills });
  const first = flags.find((f) => f.paymentId === 'P-1');
  assert.deepEqual(first.reasons, ['amount_differs', 'several_same_day']);
});

test('voided, unusable, and impossible-date rows never appear', () => {
  const payments = [
    base({ paymentId: 'P-v', voided: true, amountCents: 999900 }),
    base({ paymentId: 'P-nc', customerId: '', amountCents: 999900 }),
    base({ paymentId: 'P-nd', date: '2026-02-30', amountCents: 999900 }),
    base({ paymentId: 'P-na', amountCents: 0 }),
  ];
  assert.deepEqual(buildUnusualFlags({ payments, bills }), []);
  assert.equal(normalizePaymentRow(base({ voided: true })), null);
  assert.equal(normalizePaymentRow(base({ date: '2026-02-30' })), null);
});

test('rupee amounts convert once; cents used as-is on re-read', () => {
  const fromRupees = normalizePaymentRow({ customerId: 'C-1', date: '2026-10-05', amount: 1500 });
  assert.equal(fromRupees.amountCents, 150000);
  const fromCents = normalizePaymentRow({ customerId: 'C-1', date: '2026-10-05', amountCents: 150000 });
  assert.equal(fromCents.amountCents, 150000);
  // A stored cents row re-read through the normaliser never inflates a hundredfold.
  const reread = normalizePaymentRow({ ...fromCents });
  assert.equal(reread.amountCents, 150000);
});

test('flags are filterable by reason and mohalla with Plan T keys', () => {
  const payments = [
    base({ paymentId: 'P-1', amountCents: 100000, mohalla: 'Bani' }),
    base({ paymentId: 'P-2', billId: '', amountCents: 90000, mohalla: '' }),
  ];
  const flags = buildUnusualFlags({ payments, bills });
  assert.equal(flags.length, 2);
  assert.equal(flagsFiltered(flags, { reason: 'amount_differs' }).length, 1);
  assert.equal(flagsFiltered(flags, { reason: 'no_bill' }).length, 1);
  assert.equal(flagsFiltered(flags, { mohalla: 'Mohalla Bani' }).length, 1);
  assert.equal(flagsFiltered(flags, { mohalla: '__unassigned__' }).length, 1);
  assert.equal(mohallaKey('Mohalla Bani'), 'bani');
  assert.equal(mohallaKey(''), '__unassigned__');
});

test('clearing a flag records reviewer and reason, hides it from the open list, never touches the payment', () => {
  const payments = [base({ amountCents: 100000 })];
  const flags = buildUnusualFlags({ payments, bills });
  assert.equal(flags.length, 1);
  const paymentBefore = JSON.stringify(payments);
  const cleared = clearFlag([], {
    paymentId: 'P-1', customerId: 'C-1', customerName: 'Test Customer',
    date: '2026-10-05', amountCents: 100000, reviewedBy: 'Owner', reason: 'Part-payment agreed', clearedAt: '2026-10-06',
  });
  assert.equal(cleared.length, 1);
  assert.equal(cleared[0].reviewedBy, 'Owner');
  assert.equal(cleared[0].reason, 'Part-payment agreed');
  const reopened = buildUnusualFlags({ payments, bills, clearedPaymentIds: cleared.map((e) => e.paymentId) });
  assert.deepEqual(reopened, []);
  assert.equal(JSON.stringify(payments), paymentBefore);
  assert.equal(removeCleared(cleared, 'P-1').length, 0);
  assert.deepEqual(normalizeClearedList([{ paymentId: '' }, null, 'x']), []);
  assert.deepEqual(clearFlag([], { paymentId: '' }), []);
});

test('summary counts by reason and reads plainly', () => {
  const payments = [
    base({ paymentId: 'P-1', amountCents: 100000 }),
    base({ paymentId: 'P-2', billId: '', amountCents: 90000 }),
  ];
  const summary = buildFlagSummary(buildUnusualFlags({ payments, bills }));
  assert.equal(summary.total, 2);
  assert.equal(summary.byReason.amount_differs, 1);
  assert.equal(summary.byReason.no_bill, 1);
  assert.equal(summary.byReason.several_same_day, 0);
  assert.match(flagSummaryText(summary), /2 flagged payments/);
});

test('inputs are never mutated', () => {
  const payments = [base({ amountCents: 100000 })];
  const before = JSON.stringify({ payments, bills });
  buildUnusualFlags({ payments, bills });
  assert.equal(JSON.stringify({ payments, bills }), before);
});

test('HTML escapes, CSV quotes, filename is stable', () => {
  const flags = buildUnusualFlags({ payments: [base({ amountCents: 100000, customerName: '<b>&"' })], bills });
  const html = flagsHtml(flags);
  assert.ok(html.includes('&lt;b&gt;&amp;&quot;'));
  assert.ok(!html.includes('<b>'));
  const csv = flagsCsv(flags);
  assert.ok(csv.startsWith('date,customer,mohalla,payment_amount_rs,bill_id,bill_amount_rs,rule,why'));
  assert.ok(csv.includes('1000.00'));
  assert.equal(flagsFilename(), 'unusual-payment-flags.csv');
  assert.ok(flagsHtml([]).includes('No unusual payments'));
  assert.equal(formatCents(null), '—');
  assert.equal(formatCents(150000), 'Rs. 1500.00');
});

test('fence: the module creates nothing and writes no bill, payment, or balance field', () => {
  const src = readFileSync(new URL('../unusual-payment-flags.js', import.meta.url), 'utf8');
  assert.ok(!/localStorage|fetch\(|XMLHttpRequest/.test(src), 'pure module touches no storage or network');
  assert.ok(!/shahdara_suspense|shahdara_dispute/.test(src), 'no suspense or dispute store is ever named');
  const flag = buildUnusualFlags({ payments: [base({ amountCents: 100000 })], bills })[0];
  assert.deepEqual(Object.keys(flag).sort(), ['amountCents', 'billAmountCents', 'billId', 'billMonth', 'channel', 'customerId', 'customerName', 'date', 'mohalla', 'paymentId', 'reasonText', 'reasons', 'reference', 'sameDayCount'].sort());
});
