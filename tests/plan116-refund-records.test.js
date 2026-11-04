import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validRefundDate,
  refundAmountCents,
  normalizeRefund,
  normalizeRefundList,
  findRefund,
  refundsForCustomer,
  refundsForSource,
  totalRefundedForSource,
  sourceRemaining,
  checkRefundApproval,
  upsertRefund,
  refundSummaryText,
  refundSourceText,
  refundHtml,
  refundCsv,
  refundFilename,
} from '../refund-records.js';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'refund-records.js'), 'utf8');
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');

const record = (overrides = {}) => ({
  id: 'REF-1',
  customerId: 'CUST-76',
  customerName: 'Orient school',
  sourceKind: 'overpayment',
  sourceId: 'PAY-9',
  sourceAmountCents: 200000,
  amountCents: 150000,
  reason: 'Customer overpaid, balance returned on exit',
  method: 'cash',
  approvalId: '',
  refundDate: '2026-10-31',
  ...overrides,
});

test('plan116: strict dates — real dates pass, impossible dates refused', () => {
  assert.equal(validRefundDate('2026-10-31'), true);
  assert.equal(validRefundDate('2024-02-29'), true);
  assert.equal(validRefundDate('2026-02-30'), false);
  assert.equal(validRefundDate('2026-11-31'), false);
  assert.equal(validRefundDate('31-10-2026'), false);
  assert.equal(validRefundDate(''), false);
  assert.equal(validRefundDate(null), false);
});

test('plan116: rupees convert exactly once, *Cents used as-is', () => {
  assert.equal(refundAmountCents({ amount: 1500 }, 'amountCents', 'amount'), 150000);
  assert.equal(refundAmountCents({ amountCents: 150000 }, 'amountCents', 'amount'), 150000);
  assert.equal(refundAmountCents({ amount: '1500.50' }, 'amountCents', 'amount'), 150050);
  assert.equal(refundAmountCents({}, 'amountCents', 'amount'), null);
  assert.equal(refundAmountCents({ amount: 'not a number' }, 'amountCents', 'amount'), null);
});

test('plan116: half-formed refund refused', () => {
  assert.equal(normalizeRefund(record({ id: '' })), null);
  assert.equal(normalizeRefund(record({ customerId: '' })), null);
  assert.equal(normalizeRefund(record({ sourceKind: '' })), null);
  assert.equal(normalizeRefund(record({ sourceKind: 'bill' })), null);
  assert.equal(normalizeRefund(record({ sourceId: '' })), null);
  assert.equal(normalizeRefund(record({ reason: '   ' })), null);
  assert.equal(normalizeRefund(record({ method: 'barter' })), null);
  assert.equal(normalizeRefund(record({ refundDate: '2026-02-30' })), null);
  assert.equal(normalizeRefund(record({ amountCents: 0 })), null);
  assert.equal(normalizeRefund(record({ amountCents: -100 })), null);
  assert.equal(normalizeRefund(record({ sourceAmountCents: 0 })), null);
  assert.equal(normalizeRefund(record({ amountCents: 200001 })), null);
  assert.equal(normalizeRefund(null), null);
  assert.equal(normalizeRefund('refund'), null);
});

test('plan116: unknown fields dropped, known fields kept', () => {
  const normalized = normalizeRefund(record({ paymentId: 'PAY-9', billTotal: 999999, price: 500 }));
  assert.equal(normalized.paymentId, undefined);
  assert.equal(normalized.billTotal, undefined);
  assert.equal(normalized.price, undefined);
  assert.equal(normalized.amountCents, 150000);
  assert.deepEqual(Object.keys(normalized).sort(), [
    'amountCents', 'approvalId', 'customerId', 'customerName', 'id',
    'method', 'reason', 'refundDate', 'sourceAmountCents', 'sourceId', 'sourceKind',
  ].sort());
});

test('plan116: duplicate id never rewritten — identical re-save unchanged, different figures refused', () => {
  const list = upsertRefund([], record());
  assert.equal(list.length, 1);
  const same = upsertRefund(list, record());
  assert.equal(same.length, 1);
  assert.deepEqual(same, list);
  const different = upsertRefund(list, record({ amountCents: 100000 }));
  assert.equal(different.length, 1);
  assert.deepEqual(different, list);
});

test('plan116: one source, one worth — disagreeing source amount refused', () => {
  const list = upsertRefund([], record());
  const disagreeing = upsertRefund(list, record({ id: 'REF-2', sourceAmountCents: 250000, amountCents: 100000 }));
  assert.equal(disagreeing.length, 1);
});

test('plan116: amounts match — refunds against one source never exceed it', () => {
  const list = upsertRefund([], record());
  const second = upsertRefund(list, record({ id: 'REF-2', amountCents: 50000 }));
  assert.equal(second.length, 2);
  assert.equal(totalRefundedForSource(second, 'overpayment', 'PAY-9'), 200000);
  assert.equal(sourceRemaining(second, 'overpayment', 'PAY-9'), 0);
  // Source fully refunded: no further refund, however small.
  const third = upsertRefund(second, record({ id: 'REF-3', amountCents: 1 }));
  assert.equal(third.length, 2);
  // A single refund above the source amount is refused on its own.
  assert.equal(upsertRefund([], record({ amountCents: 200001 })).length, 0);
  assert.equal(sourceRemaining([], 'overpayment', 'PAY-9'), null);
});

test('plan116: credit source tracked separately from overpayment source', () => {
  const list = upsertRefund([], record());
  const withCredit = upsertRefund(list, record({ id: 'REF-2', sourceKind: 'credit', sourceId: 'CRED-1', sourceAmountCents: 100000, amountCents: 100000 }));
  assert.equal(withCredit.length, 2);
  assert.equal(refundsForSource(withCredit, 'credit', 'CRED-1').length, 1);
  assert.equal(refundsForSource(withCredit, 'overpayment', 'PAY-9').length, 1);
  // Same source id under a different kind is a different source.
  const sameIdOtherKind = upsertRefund(withCredit, record({ id: 'REF-3', sourceKind: 'credit', sourceId: 'PAY-9', sourceAmountCents: 50000, amountCents: 50000 }));
  assert.equal(sameIdOtherKind.length, 3);
});

test('plan116: tier gate — at or below passes, above needs approval id, no tier means no gate', () => {
  assert.deepEqual(checkRefundApproval(50000, 100000, ''), { allowed: true, reason: 'Within the operator tier.' });
  assert.deepEqual(checkRefundApproval(100000, 100000, ''), { allowed: true, reason: 'Within the operator tier.' });
  assert.equal(checkRefundApproval(100001, 100000, '').allowed, false);
  assert.equal(checkRefundApproval(100001, 100000, 'APPR-7').allowed, true);
  assert.equal(checkRefundApproval(999999, null, '').allowed, true);
  assert.equal(checkRefundApproval(999999, undefined, '').allowed, true);
  assert.equal(checkRefundApproval(999999, 0, '').allowed, true);
  assert.equal(checkRefundApproval(0, 100000, '').allowed, false);
  // The gate is enforced on the way in, not just as an answer.
  assert.equal(upsertRefund([], record({ amountCents: 200000 }), 100000).length, 0);
  assert.equal(upsertRefund([], record({ amountCents: 200000, approvalId: 'APPR-7' }), 100000).length, 1);
  assert.equal(upsertRefund([], record({ amountCents: 200000 }), null).length, 1);
});

test('plan116: find and customer filters', () => {
  const list = upsertRefund(upsertRefund([], record()), record({ id: 'REF-2', customerId: 'CUST-77', amountCents: 50000 }));
  assert.equal(findRefund(list, 'REF-1').customerId, 'CUST-76');
  assert.equal(findRefund(list, 'REF-9'), null);
  assert.equal(findRefund(list, ''), null);
  assert.equal(refundsForCustomer(list, 'CUST-76').length, 1);
  assert.equal(refundsForCustomer(list, 'CUST-77').length, 1);
  assert.equal(refundsForCustomer(list, 'CUST-99').length, 0);
  assert.deepEqual(normalizeRefundList(null), []);
  assert.deepEqual(normalizeRefundList([record(), null, record({ id: '' })]).length, 1);
});

test('plan116: non-mutation — inputs never changed', () => {
  const input = record();
  const snapshot = JSON.stringify(input);
  const list = [record()];
  const listSnapshot = JSON.stringify(list);
  upsertRefund(list, input);
  normalizeRefund(input);
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(JSON.stringify(list), listSnapshot);
});

test('plan116: summary and source text', () => {
  assert.equal(refundSummaryText([]), 'No refunds recorded yet.');
  const list = upsertRefund([], record());
  assert.match(refundSummaryText(list), /1 refund/);
  assert.match(refundSummaryText(list), /Rs\. 1500\.00/);
  assert.match(refundSourceText(list, 'overpayment', 'PAY-9'), /Rs\. 2000\.00 in total, Rs\. 1500\.00 refunded, Rs\. 500\.00 remaining/);
  assert.equal(refundSourceText(list, 'credit', 'CRED-9'), 'No refund recorded against this source yet.');
});

test('plan116: HTML escaping and CSV quoting', () => {
  const htmlOut = refundHtml(record({ customerName: '<b>Bad</b> & "Co"', reason: 'a < b' }));
  assert.ok(!htmlOut.includes('<b>Bad</b>'));
  assert.ok(htmlOut.includes('&lt;b&gt;Bad&lt;/b&gt;'));
  assert.equal(refundHtml(record({ id: '' })), '<p>Refund not recorded: its inputs are incomplete.</p>');
  const csv = refundCsv([record({ reason: 'He said, "keep it"' })]);
  assert.ok(csv.startsWith('id,customer,source kind,source id,source amount (Rs),refund amount (Rs),reason,method,owner approval id,date'));
  assert.ok(csv.includes('"He said, ""keep it"""'));
  assert.equal(refundFilename(), 'refund-records.csv');
});

test('plan116: purity fence — no imports, storage, DOM, network, or Plan 103/110 module identifiers', () => {
  assert.ok(!source.includes('import '));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('document.'));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('credit-balance'));
  assert.ok(!source.includes('approval-limits'));
  assert.ok(!source.includes('XMLHttpRequest'));
});

test('plan116: panel element ids present in index.html', () => {
  for (const id of [
    'refundBody', 'refundCustomer', 'refundFilterCustomer', 'refundSourceKind',
    'refundSourceId', 'refundSourceAmount', 'refundAmount', 'refundReason',
    'refundMethod', 'refundApproval', 'refundDate', 'refundTierLimit',
    'refundSaveBtn', 'refundSummary', 'refundExportBtn',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
