import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validClearanceDate,
  CLEARANCE_METHODS,
  CLEARANCE_STATUSES,
  normalizeClearance,
  normalizeClearanceList,
  findClearance,
  clearanceForPayment,
  recordClearance,
  markCleared,
  markBounced,
  pendingClearances,
  clearedClearances,
  bouncedClearances,
  billClearanceStatus,
  billSettledByClearance,
  clearanceSummaryText,
  clearanceHtml,
  clearanceCsv,
  clearanceFilename,
} from '../payment-clearance.js';

const dir = dirname(fileURLToPath(import.meta.url));

const pending = {
  id: 'C1', paymentId: 'P1', customer: 'Ahmed', billId: 'B1',
  method: 'cheque', status: 'pending', dateRecorded: '2026-11-01',
};

test('strict clearance dates: real dates pass, impossible dates fail', () => {
  assert.equal(validClearanceDate('2026-11-04'), '2026-11-04');
  assert.equal(validClearanceDate('2024-02-29'), '2024-02-29');
  assert.equal(validClearanceDate('2026-02-30'), null);
  assert.equal(validClearanceDate('2026-02-29'), null);
  assert.equal(validClearanceDate('2026-13-01'), null);
  assert.equal(validClearanceDate('04-11-2026'), null);
  assert.equal(validClearanceDate(''), null);
  assert.equal(validClearanceDate(null), null);
});

test('catalogues: only cheque and bank transfer, only three statuses', () => {
  assert.deepEqual(CLEARANCE_METHODS, ['cheque', 'bank_transfer']);
  assert.deepEqual(CLEARANCE_STATUSES, ['pending', 'cleared', 'bounced']);
});

test('half-formed records refused outright', () => {
  assert.equal(normalizeClearance({ ...pending, id: '' }), null);
  assert.equal(normalizeClearance({ ...pending, paymentId: '' }), null);
  assert.equal(normalizeClearance({ ...pending, customer: '' }), null);
  assert.equal(normalizeClearance({ ...pending, method: 'cash' }), null);
  assert.equal(normalizeClearance({ ...pending, method: 'JazzCash' }), null);
  assert.equal(normalizeClearance({ ...pending, status: 'unknown' }), null);
  assert.equal(normalizeClearance({ ...pending, dateRecorded: '2026-02-30' }), null);
  // A cleared record without its decision date is half-formed.
  assert.equal(normalizeClearance({ ...pending, status: 'cleared' }), null);
  assert.equal(normalizeClearance({ ...pending, status: 'bounced', decisionDate: '2026-11-05' }), null);
  // A pending record carrying a decision date is incoherent.
  assert.equal(normalizeClearance({ ...pending, decisionDate: '2026-11-05' }), null);
  // A bounced record without a note is half-formed.
  assert.equal(normalizeClearance({ ...pending, status: 'bounced', decisionDate: '2026-11-05', note: '' }), null);
});

test('unknown fields dropped, good records kept verbatim', () => {
  const record = normalizeClearance({ ...pending, amount: 5000, payment: { id: 'P9' }, billTotal: 9000 });
  assert.equal(record.amount, undefined);
  assert.equal(record.payment, undefined);
  assert.equal(record.billTotal, undefined);
  assert.equal(record.paymentId, 'P1');
  assert.equal(record.billId, 'B1');
  assert.equal(record.note, null);
  // No bill id at all is allowed: the record still tracks the payment.
  assert.equal(normalizeClearance({ ...pending, billId: undefined }).billId, null);
});

test('record rules: one record per payment, duplicate ids never rewritten', () => {
  const one = recordClearance([], pending);
  assert.equal(one.length, 1);
  // Same payment again, new id: refused, list unchanged.
  assert.equal(recordClearance(one, { ...pending, id: 'C2' }).length, 1);
  // Same id, different payment: refused, original untouched.
  const kept = recordClearance(one, { ...pending, paymentId: 'P2' });
  assert.equal(kept.length, 1);
  assert.equal(kept[0].paymentId, 'P1');
  // Identical re-save is simply unchanged.
  assert.equal(recordClearance(one, pending).length, 1);
  assert.equal(findClearance(one, 'C1').customer, 'Ahmed');
  assert.equal(clearanceForPayment(one, 'P1').id, 'C1');
  assert.equal(clearanceForPayment(one, 'P9'), null);
});

test('mark cleared: pending only, decision date recorded', () => {
  const one = recordClearance([], pending);
  const cleared = markCleared(one, 'P1', '2026-11-05');
  assert.equal(cleared[0].status, 'cleared');
  assert.equal(cleared[0].decisionDate, '2026-11-05');
  assert.equal(cleared[0].dateRecorded, '2026-11-01');
  assert.equal(cleared[0].paymentId, 'P1');
  // Unknown payment, bad date, or a second marking: all refused.
  assert.equal(markCleared(one, 'P9', '2026-11-05').length, 1);
  assert.equal(markCleared(one, 'P9', '2026-11-05')[0].status, 'pending');
  assert.equal(markCleared(one, 'P1', '2026-02-30')[0].status, 'pending');
  assert.equal(markCleared(cleared, 'P1', '2026-11-06')[0].decisionDate, '2026-11-05');
});

test('mark bounced: pending only, dated note mandatory', () => {
  const one = recordClearance([], pending);
  // No note, no bounce.
  assert.equal(markBounced(one, 'P1', '2026-11-05', '')[0].status, 'pending');
  assert.equal(markBounced(one, 'P1', '2026-11-05')[0].status, 'pending');
  assert.equal(markBounced(one, 'P1', '2026-02-30', 'Cheque returned')[0].status, 'pending');
  const bounced = markBounced(one, 'P1', '2026-11-05', 'Cheque returned unpaid');
  assert.equal(bounced[0].status, 'bounced');
  assert.equal(bounced[0].decisionDate, '2026-11-05');
  assert.equal(bounced[0].note, 'Cheque returned unpaid');
  // Terminal: a bounced payment can never be cleared afterwards.
  assert.equal(markCleared(bounced, 'P1', '2026-11-06')[0].status, 'bounced');
  assert.equal(markBounced(bounced, 'P1', '2026-11-07', 'Again')[0].note, 'Cheque returned unpaid');
});

test('pending listed separately from cleared collections', () => {
  const list = recordClearance([], pending);
  const withMore = recordClearance(
    recordClearance(list, { ...pending, id: 'C2', paymentId: 'P2', method: 'bank_transfer' }),
    { ...pending, id: 'C3', paymentId: 'P3', billId: 'B2' },
  );
  const moved = markCleared(markBounced(withMore, 'P3', '2026-11-06', 'Transfer reversed'), 'P2', '2026-11-05');
  assert.deepEqual(pendingClearances(moved).map((item) => item.paymentId), ['P1']);
  assert.deepEqual(clearedClearances(moved).map((item) => item.paymentId), ['P2']);
  assert.deepEqual(bouncedClearances(moved).map((item) => item.paymentId), ['P3']);
});

test('bill status: bounced beats pending beats cleared, none is null', () => {
  assert.equal(billClearanceStatus([], 'B1'), null);
  assert.equal(billClearanceStatus([pending], 'B9'), null);
  const one = recordClearance([], pending);
  assert.equal(billClearanceStatus(one, 'B1'), 'pending');
  assert.equal(billClearanceStatus(markCleared(one, 'P1', '2026-11-05'), 'B1'), 'cleared');
  assert.equal(billClearanceStatus(markBounced(one, 'P1', '2026-11-05', 'Cheque returned'), 'B1'), 'bounced');
  // Two payments on one bill: one bounced puts the whole bill back.
  const two = recordClearance(one, { ...pending, id: 'C2', paymentId: 'P2', method: 'bank_transfer' });
  const mixed = markBounced(markCleared(two, 'P1', '2026-11-05'), 'P2', '2026-11-06', 'Transfer reversed');
  assert.equal(billClearanceStatus(mixed, 'B1'), 'bounced');
  const half = markCleared(two, 'P1', '2026-11-05');
  assert.equal(billClearanceStatus(half, 'B1'), 'pending');
});

test('a bill settles only when every tracked payment is cleared', () => {
  const one = recordClearance([], pending);
  assert.equal(billSettledByClearance(one, 'B1'), false);
  assert.equal(billSettledByClearance(markCleared(one, 'P1', '2026-11-05'), 'B1'), true);
  assert.equal(billSettledByClearance(markBounced(one, 'P1', '2026-11-05', 'Cheque returned'), 'B1'), false);
  assert.equal(billSettledByClearance(one, 'B9'), false);
  const two = recordClearance(one, { ...pending, id: 'C2', paymentId: 'P2', method: 'bank_transfer' });
  assert.equal(billSettledByClearance(markCleared(two, 'P1', '2026-11-05'), 'B1'), false);
  assert.equal(billSettledByClearance(markCleared(markCleared(two, 'P1', '2026-11-05'), 'P2', '2026-11-06'), 'B1'), true);
});

test('non-mutation: inputs never change', () => {
  const list = [pending];
  const snapshot = JSON.stringify(list);
  recordClearance(list, { ...pending, id: 'C2', paymentId: 'P2' });
  markCleared(list, 'P1', '2026-11-05');
  markBounced(list, 'P1', '2026-11-05', 'Cheque returned');
  assert.equal(JSON.stringify(list), snapshot);
});

test('summary, HTML escaping, CSV, filename', () => {
  const list = recordClearance(
    recordClearance([], pending),
    { ...pending, id: 'C2', paymentId: 'P2', method: 'bank_transfer', customer: 'Bilal' },
  );
  const moved = markCleared(list, 'P2', '2026-11-05');
  assert.equal(clearanceSummaryText(moved), '2 payments tracked, 1 pending, 1 cleared, 0 bounced.');
  const html = clearanceHtml({ ...pending, customer: '<b>Ahmed</b>' });
  assert.ok(!html.includes('<b>Ahmed</b>'));
  assert.ok(html.includes('&lt;b&gt;Ahmed&lt;/b&gt;'));
  assert.ok(html.includes('Cheque'));
  const csv = clearanceCsv(moved);
  assert.ok(csv.includes('C1,P1,Ahmed,B1,cheque,pending,2026-11-01,,'));
  assert.ok(csv.includes('C2,P2,Bilal,B1,bank_transfer,cleared,2026-11-01,2026-11-05,'));
  assert.equal(clearanceFilename(), 'payment-clearance.csv');
});

test('purity fence: no imports, no storage, DOM, network, or payment identifiers', () => {
  const source = readFileSync(join(dir, '..', 'payment-clearance.js'), 'utf8');
  assert.ok(!source.includes('import '));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('document.'));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('payment-history'));
  assert.ok(!source.includes('paymentHistory'));
  assert.ok(!source.includes('allocation'));
});

test('panel ids present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['clearanceSummary', 'clearancePaymentId', 'clearanceCustomer', 'clearanceBillId', 'clearanceMethod', 'clearanceDate', 'clearanceSaveBtn', 'clearanceBody', 'clearancePendingBody', 'clearanceClearedBody', 'clearanceMarkPaymentId', 'clearanceMarkDate', 'clearanceMarkNote', 'clearanceMarkClearedBtn', 'clearanceMarkBouncedBtn', 'clearanceBillLookup', 'clearanceBillResult', 'clearanceExportBtn']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
