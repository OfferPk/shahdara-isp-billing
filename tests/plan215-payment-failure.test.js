import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizePaymentFailure,
  normalizePaymentFailureList,
  findPaymentFailure,
  recordPaymentFailure,
  removePaymentFailure,
  paymentFailuresSorted,
  paymentFailuresForCustomer,
  paymentFailuresForChannel,
  paymentFailureCountsForCustomer,
  paymentFailureText,
  paymentFailureSummaryText,
  paymentFailureHtml,
  paymentFailureAllHtml,
  paymentFailureCsv,
  paymentFailureFilename,
} from '../payment-failure.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'payment-failure.js'), 'utf8');

const failureA = { id: 'PF-1', customer: 'Ahmed', channel: 'Easypaisa', date: '2026-11-04', amountAttempted: 1500, reason: 'Insufficient balance', reference: 'TXN-101' };
const failureB = { id: 'PF-2', customer: 'Ahmed', channel: 'JazzCash', date: '2026-11-02', amountAttempted: 2000, reason: 'Network timeout', reference: '' };
const failureC = { id: 'PF-3', customer: 'Bilal', channel: 'Easypaisa', date: '2026-11-04', amountAttempted: 1000, reason: '', reference: '' };

test('half-formed failure notes are refused, including no customer or no channel', () => {
  assert.equal(normalizePaymentFailure({ id: 'PF-9', channel: 'Easypaisa', date: '2026-11-04', amountAttempted: 1500 }), null);
  assert.equal(normalizePaymentFailure({ id: 'PF-9', customer: 'Ahmed', date: '2026-11-04', amountAttempted: 1500 }), null);
  assert.equal(normalizePaymentFailure({ id: 'PF-9', customer: 'Ahmed', channel: 'Easypaisa', amountAttempted: 1500 }), null);
  assert.equal(normalizePaymentFailure({ customer: 'Ahmed', channel: 'Easypaisa', date: '2026-11-04', amountAttempted: 1500 }), null);
  assert.equal(normalizePaymentFailure({ ...failureA, customer: '   ' }), null);
  assert.equal(normalizePaymentFailure({ ...failureA, channel: '' }), null);
  assert.equal(normalizePaymentFailure({ ...failureA, amountAttempted: 0 }), null);
  assert.equal(normalizePaymentFailure({ ...failureA, amountAttempted: -50 }), null);
  assert.equal(normalizePaymentFailure({ ...failureA, amountAttempted: 'lots' }), null);
});

test('strict calendar dates: 31-day months, Feb 29 leap and non-leap', () => {
  assert.equal(normalizePaymentFailure({ ...failureA, date: '2026-08-31' }).date, '2026-08-31');
  assert.equal(normalizePaymentFailure({ ...failureA, date: '2026-08-32' }), null);
  assert.equal(normalizePaymentFailure({ ...failureA, date: '2026-02-30' }), null);
  assert.equal(normalizePaymentFailure({ ...failureA, date: '2024-02-29' }).date, '2024-02-29');
  assert.equal(normalizePaymentFailure({ ...failureA, date: '2026-02-29' }), null);
  assert.equal(normalizePaymentFailure({ ...failureA, date: '2026-13-01' }), null);
  assert.equal(normalizePaymentFailure({ ...failureA, date: '2026-1-02' }), null);
});

test('unknown fields are dropped, so no bill, payment, settlement, or status field can creep in', () => {
  const clean = normalizePaymentFailure({ ...failureA, billId: 'B-1', paymentId: 'P-1', settled: true, status: 'paid', customerStatus: 'defaulter' });
  assert.deepEqual(Object.keys(clean).sort(), ['amountAttempted', 'channel', 'customer', 'date', 'id', 'reason', 'reference']);
});

test('a failure note normalizes with empty reason and reference when none are given', () => {
  assert.deepEqual(normalizePaymentFailure(failureC), { id: 'PF-3', customer: 'Bilal', channel: 'Easypaisa', date: '2026-11-04', amountAttempted: 1000, reason: '', reference: '' });
});

test('duplicate ids are never rewritten', () => {
  const base = recordPaymentFailure([], failureA);
  assert.deepEqual(recordPaymentFailure(base, { ...failureA, amountAttempted: 9999 }), base);
  assert.equal(recordPaymentFailure(base, { ...failureA, amountAttempted: 9999 }).length, 1);
});

test('find and remove work by id, and removal of an unknown id leaves the list unchanged', () => {
  const list = [failureA, failureB];
  assert.deepEqual(findPaymentFailure(list, 'PF-2'), normalizePaymentFailure(failureB));
  assert.equal(findPaymentFailure(list, 'PF-99'), null);
  assert.deepEqual(removePaymentFailure(list, 'PF-1'), [normalizePaymentFailure(failureB)]);
  assert.deepEqual(removePaymentFailure(list, 'PF-99'), normalizePaymentFailureList(list));
});

test('failures sort by date, then customer, then id', () => {
  assert.deepEqual(paymentFailuresSorted([failureA, failureB, failureC]).map((r) => r.id), ['PF-2', 'PF-1', 'PF-3']);
});

test('customer filter is case-insensitive and matches a substring', () => {
  assert.deepEqual(paymentFailuresForCustomer([failureA, failureB, failureC], 'ahmed').map((r) => r.id), ['PF-2', 'PF-1']);
  assert.deepEqual(paymentFailuresForCustomer([failureA, failureB, failureC], 'AHM').map((r) => r.id), ['PF-2', 'PF-1']);
  assert.deepEqual(paymentFailuresForCustomer([failureA, failureB, failureC], 'nope'), []);
  assert.deepEqual(paymentFailuresForCustomer([failureA, failureB, failureC], ''), []);
});

test('channel filter is case-insensitive and exact', () => {
  assert.deepEqual(paymentFailuresForChannel([failureA, failureB, failureC], 'easypaisa').map((r) => r.id), ['PF-1', 'PF-3']);
  assert.deepEqual(paymentFailuresForChannel([failureA, failureB, failureC], 'cash'), []);
});

test('per-customer counts total failures and break them down by channel', () => {
  assert.deepEqual(paymentFailureCountsForCustomer([failureA, failureB, failureC], 'Ahmed'), { total: 2, byChannel: { Easypaisa: 1, JazzCash: 1 } });
  assert.deepEqual(paymentFailureCountsForCustomer([failureA, failureB, failureC], 'Bilal'), { total: 1, byChannel: { Easypaisa: 1 } });
});

test('text rendering shows reason and reference, with plain fallbacks when absent', () => {
  assert.equal(paymentFailureText(failureA), 'Ahmed: Rs 1500 attempted via Easypaisa on 2026-11-04 — failed. Insufficient balance. Reference: TXN-101.');
  assert.equal(paymentFailureText(failureC), 'Bilal: Rs 1000 attempted via Easypaisa on 2026-11-04 — failed. No reason noted. No reference given.');
  assert.equal(paymentFailureText({ ...failureA, reason: '' }), 'Ahmed: Rs 1500 attempted via Easypaisa on 2026-11-04 — failed. No reason noted. Reference: TXN-101.');
  assert.equal(paymentFailureText(null), '');
});

test('summary text counts failures plainly', () => {
  assert.equal(paymentFailureSummaryText([]), 'No failed payment attempts recorded.');
  assert.equal(paymentFailureSummaryText([failureA]), '1 failed payment attempt recorded.');
  assert.equal(paymentFailureSummaryText([failureA, failureB]), '2 failed payment attempts recorded.');
});

test('html rendering escapes markup in customer, channel, reason, and reference', () => {
  const nasty = { ...failureA, customer: '<b>Ahmed</b>', reason: 'a & b <script>' };
  const html = paymentFailureHtml(nasty);
  assert.doesNotMatch(html, /<b>Ahmed<\/b>|<script>/);
  assert.match(html, /&lt;b&gt;Ahmed&lt;\/b&gt;/);
  assert.match(html, /a &amp; b &lt;script&gt;/);
  assert.equal(paymentFailureHtml(null), '');
  assert.match(paymentFailureAllHtml([failureB, failureA]), /Ahmed/);
});

test('csv export is date-ordered with the right header and filename', () => {
  assert.equal(
    paymentFailureCsv([failureA, failureB]),
    'id,customer,channel,date,amount_attempted,reason,reference\nPF-2,Ahmed,JazzCash,2026-11-02,2000,Network timeout,\nPF-1,Ahmed,Easypaisa,2026-11-04,1500,Insufficient balance,TXN-101',
  );
  assert.equal(paymentFailureFilename(), 'payment-failures.csv');
});

test('inputs are never mutated', () => {
  const input = [failureA, failureB];
  const snapshot = JSON.stringify(input);
  recordPaymentFailure(input, failureC);
  removePaymentFailure(input, 'PF-1');
  paymentFailuresSorted(input);
  assert.equal(JSON.stringify(input), snapshot);
});

test('list normalization drops bad entries and later duplicates', () => {
  assert.deepEqual(normalizePaymentFailureList(null), []);
  assert.deepEqual(normalizePaymentFailureList([null, failureA, { ...failureA, amountAttempted: 9999 }, failureB]), [normalizePaymentFailure(failureA), failureB]);
});

test('purity fence: the module is import-free and touches no storage, clock, or network', () => {
  assert.doesNotMatch(moduleSrc, /^import\s/m);
  assert.doesNotMatch(moduleSrc, /localStorage|fetch\(|Date\.now|new Date\(/);
});

test('purity fence: the module never names a bill, payment, or settlement store', () => {
  assert.doesNotMatch(moduleSrc, /shahdara_(bills|payments|collection|receipts|customers)/);
});

test('panel element ids are present in index.html', () => {
  for (const id of ['pfSummary', 'pfExportBtn', 'pfCustomer', 'pfChannel', 'pfDate', 'pfAmount', 'pfReason', 'pfReference', 'pfSaveBtn', 'pfRemoveId', 'pfRemoveBtn', 'pfCustomerFilter', 'pfCountsBody', 'pfBody']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring mentions the payment-failure store and render function', () => {
  assert.match(appJs, /shahdara_payment_failures_v1/);
  assert.match(appJs, /renderPaymentFailures\(\)/);
  assert.match(appJs, /payment-failure\.js/);
});

test('deployment guard: no standalone OLT word added to app.js by this plan', () => {
  const matches = appJs.match(/(?<![A-Z])OLT(?![A-Z])/g) || [];
  assert.equal(matches.length, 0);
});
