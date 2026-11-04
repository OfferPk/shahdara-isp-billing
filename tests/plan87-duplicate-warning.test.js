/**
 * plan87-duplicate-warning.test.js — Plan 87: near-duplicate
 * payment warning at entry time.
 * Pins:
 * - a genuinely duplicate entry (same customer, amount, channel,
 *   within window, or same wallet reference) surfaces the earlier
 *   payment with its date, amount, channel, and reference;
 * - a legitimate second payment of a different amount, a
 *   different channel, outside the window, or for a different
 *   bill does not warn;
 * - voided rows never warn (Plan K voided-TID guard outcome,
 *   reached independently — Plan V matching and Plan K handling
 *   are neither read nor rewritten);
 * - saving after a warning needs a recorded reason; the warning
 *   itself never blocks, merges, deletes, or alters any bill,
 *   payment, or balance;
 * - amounts in integer cents, cents used as-is on re-read;
 * - impossible dates (2026-02-30) never match.
 * Synthetic data only; no bill, payment, or balance is ever
 * changed by this plan.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DUPLICATE_WARNING_DEFAULT_WINDOW_DAYS,
  normalizePaymentRow,
  normalizeDuplicateWarningSettings,
  findNearDuplicates,
  checkNewPayment,
  formatCents,
  warningHtml,
  warningCsv,
  warningFilename,
  normalizeAckList,
  upsertAck,
  removeAck,
  ackHtml,
} from '../duplicate-warning.js';

const earlier = {
  paymentId: 'P-1', customerId: 'C-1', customerName: 'Test Customer',
  billMonth: '2026-10', date: '2026-10-05', amountCents: 150000,
  channel: 'JazzCash', reference: 'TID-100',
};
const candidate = {
  customerId: 'C-1', date: '2026-10-05', amountCents: 150000,
  channel: 'JazzCash', reference: '',
};

test('settings: default window is same day; invalid windows fall back to 0', () => {
  assert.equal(DUPLICATE_WARNING_DEFAULT_WINDOW_DAYS, 0);
  assert.deepEqual(normalizeDuplicateWarningSettings({}), { windowDays: 0 });
  assert.deepEqual(normalizeDuplicateWarningSettings({ windowDays: -3 }), { windowDays: 0 });
  assert.deepEqual(normalizeDuplicateWarningSettings({ windowDays: 'x' }), { windowDays: 0 });
  assert.deepEqual(normalizeDuplicateWarningSettings({ windowDays: 3.9 }), { windowDays: 3 });
  assert.deepEqual(normalizeDuplicateWarningSettings({ windowDays: 7 }), { windowDays: 7 });
});

test('same customer, amount, channel, same day warns with full earlier-payment detail', () => {
  const found = findNearDuplicates({ payments: [earlier], candidate, settings: {} });
  assert.equal(found.candidateValid, true);
  assert.equal(found.matches.length, 1);
  const m = found.matches[0];
  assert.equal(m.paymentId, 'P-1');
  assert.equal(m.date, '2026-10-05');
  assert.equal(m.amountCents, 150000);
  assert.equal(m.channel, 'JazzCash');
  assert.equal(m.reference, 'TID-100');
  assert.equal(m.reason, 'same-amount-channel-date');
});

test('same wallet reference warns even across bills and outside the window', () => {
  const found = findNearDuplicates({
    payments: [{ ...earlier, billMonth: '2026-09', date: '2026-09-01' }],
    candidate: { ...candidate, reference: ' tid-100 ', date: '2026-10-05' },
    settings: { windowDays: 0 },
  });
  assert.equal(found.matches.length, 1);
  assert.equal(found.matches[0].reason, 'same-reference');
});

test('legitimate second payments do not warn: different amount, channel, window, or bill', () => {
  const base = { payments: [earlier], settings: { windowDays: 0 } };
  assert.equal(findNearDuplicates({ ...base, candidate: { ...candidate, amountCents: 150001 } }).matches.length, 0);
  assert.equal(findNearDuplicates({ ...base, candidate: { ...candidate, channel: 'Easypaisa' } }).matches.length, 0);
  assert.equal(findNearDuplicates({ ...base, candidate: { ...candidate, date: '2026-10-06' } }).matches.length, 0);
  assert.equal(findNearDuplicates({ ...base, candidate: { ...candidate, billMonth: '2026-11' } }).matches.length, 0);
  assert.equal(findNearDuplicates({ payments: [{ ...earlier, customerId: 'C-2' }], candidate, settings: {} }).matches.length, 0);
});

test('window is inclusive: inside warns, one day past does not', () => {
  const settings = { windowDays: 7 };
  assert.equal(findNearDuplicates({ payments: [earlier], candidate: { ...candidate, date: '2026-10-12' }, settings }).matches.length, 1);
  assert.equal(findNearDuplicates({ payments: [earlier], candidate: { ...candidate, date: '2026-10-13' }, settings }).matches.length, 0);
});

test('voided rows never warn, and blank channels never amount-match', () => {
  assert.equal(findNearDuplicates({ payments: [{ ...earlier, voided: true }], candidate, settings: {} }).matches.length, 0);
  assert.equal(findNearDuplicates({ payments: [{ ...earlier, channel: '' }], candidate, settings: {} }).matches.length, 0);
  assert.equal(findNearDuplicates({ payments: [earlier], candidate: { ...candidate, channel: '' }, settings: {} }).matches.length, 0);
});

test('impossible dates and half-formed rows never match; candidate must be complete', () => {
  assert.equal(findNearDuplicates({ payments: [{ ...earlier, date: '2026-02-30' }], candidate, settings: {} }).matches.length, 0);
  assert.equal(findNearDuplicates({ payments: [{ ...earlier, customerId: '' }], candidate, settings: {} }).matches.length, 0);
  assert.equal(findNearDuplicates({ payments: [earlier], candidate: { ...candidate, date: '2026-02-30' }, settings: {} }).candidateValid, false);
  assert.equal(findNearDuplicates({ payments: [earlier], candidate: { ...candidate, customerId: '' }, settings: {} }).candidateValid, false);
  assert.equal(findNearDuplicates({ payments: [earlier], candidate: { ...candidate, amountCents: null, amount: undefined }, settings: {} }).candidateValid, false);
});

test('rupee amounts convert once; cents rows are used as-is on re-read', () => {
  const fromRupees = normalizePaymentRow({ customerId: 'C-1', date: '2026-10-05', amount: 1500 });
  assert.equal(fromRupees.amountCents, 150000);
  const fromCents = normalizePaymentRow({ customerId: 'C-1', date: '2026-10-05', amountCents: 150000, amount: 1500 });
  assert.equal(fromCents.amountCents, 150000);
  const reread = normalizePaymentRow({ ...fromCents, amount: undefined });
  assert.equal(reread.amountCents, 150000);
  assert.equal(formatCents(150000), 'Rs. 1500.00');
});

test('check: no warning saves freely; warning needs a reason, then may save', () => {
  const clear = checkNewPayment({ payments: [], candidate, settings: {} });
  assert.equal(clear.canSave, true);
  assert.equal(clear.requiresReason, false);
  const warned = checkNewPayment({ payments: [earlier], candidate, settings: {} });
  assert.equal(warned.requiresReason, true);
  assert.equal(warned.canSave, false);
  assert.match(warned.message, /reason/);
  const withReason = checkNewPayment({ payments: [earlier], candidate, settings: {}, overrideReason: 'Customer paid two months together, confirmed on call' });
  assert.equal(withReason.canSave, true);
  assert.equal(withReason.warnings.length, 1);
});

test('inputs are never mutated and matches carry no decision about the candidate', () => {
  const payments = [earlier];
  const snapshot = JSON.stringify(payments);
  const found = findNearDuplicates({ payments, candidate, settings: {} });
  assert.equal(JSON.stringify(payments), snapshot);
  assert.equal(JSON.stringify(candidate), JSON.stringify({ ...candidate }));
  assert.ok(!('canSave' in found));
});

test('ack log: half-formed refused, upsert/remove keep only valid records', () => {
  assert.deepEqual(normalizeAckList([{ id: '', customerId: 'C-1', reason: 'x', matchedPaymentIds: ['P-1'] }]), []);
  assert.deepEqual(normalizeAckList([{ id: 'A-1', customerId: 'C-1', reason: '', matchedPaymentIds: ['P-1'] }]), []);
  assert.deepEqual(normalizeAckList([{ id: 'A-1', customerId: 'C-1', reason: 'x', matchedPaymentIds: [] }]), []);
  const ack = { id: 'A-1', customerId: 'C-1', candidateDate: '2026-10-05', candidateAmountCents: 150000, candidateChannel: 'JazzCash', matchedPaymentIds: ['P-1'], reason: 'Confirmed second payment', date: '2026-10-05' };
  const list = upsertAck([], ack);
  assert.equal(list.length, 1);
  assert.equal(upsertAck(list, { ...ack, reason: 'Updated reason' }).length, 1);
  assert.equal(upsertAck(list, { ...ack, reason: 'Updated reason' })[0].reason, 'Updated reason');
  assert.equal(removeAck(list, 'A-1').length, 0);
  assert.equal(removeAck(list, 'nope').length, 1);
});

test('html escapes, csv quotes, filename is stable', () => {
  const nasty = { ...earlier, customerName: '<b>&"x"</b>', reference: 'a,b"c' };
  const html = warningHtml([{ ...normalizePaymentRow(nasty), reason: 'same-reference' }]);
  assert.ok(!html.includes('<b>'));
  assert.ok(html.includes('&lt;b&gt;'));
  const csv = warningCsv([{ ...normalizePaymentRow(nasty), reason: 'same-reference' }]);
  assert.ok(csv.includes('"a,b""c"'));
  assert.equal(warningFilename(), 'duplicate-payment-warnings.csv');
  assert.ok(ackHtml([]).includes('No save-after-warning'));
  const ack = { id: 'A-1', customerId: 'C-1', candidateDate: '2026-10-05', candidateAmountCents: 150000, candidateChannel: 'JazzCash', matchedPaymentIds: ['P-1'], reason: 'ok', date: '2026-10-05' };
  assert.ok(ackHtml([ack]).includes('Rs. 1500.00'));
});

test('fence: module stays pure — no storage, no wallet/void imports, no mutation helpers', () => {
  const src = readFileSync(new URL('../duplicate-warning.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('localStorage'));
  // The header comment names the module whose reference rule is
  // mirrored; the fence is that nothing is imported from it.
  assert.ok(!src.includes('from \'./wallet-reconciliation'));
  assert.ok(!src.includes('from \'./wallet-recon-view'));
  assert.ok(!src.includes('from \'./payment-void-audit'));
  assert.ok(!src.includes('from "./'));
});
