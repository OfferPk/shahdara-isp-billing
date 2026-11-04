import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validBillExceptionMonth,
  validBillExceptionDate,
  billExceptionAmountCents,
  normalizeExceptionBill,
  normalizeExceptionBillList,
  buildBillExceptions,
  normalizeExceptionClearance,
  applyBillExceptionClearance,
  openBillExceptions,
  clearedBillExceptions,
  billExceptionSummaryText,
  billExceptionHtml,
  billExceptionCsv,
  billExceptionFilename,
} from '../bill-exceptions.js';

const here = dirname(fileURLToPath(import.meta.url));

const bill = (overrides = {}) => ({
  id: 'BILL-1',
  customerId: 'C-76',
  customerName: 'Orient school',
  month: '2026-11',
  amountCents: 200000,
  ...overrides,
});

test('validBillExceptionMonth accepts YYYY-MM only', () => {
  assert.equal(validBillExceptionMonth('2026-11'), true);
  assert.equal(validBillExceptionMonth('2026-13'), false);
  assert.equal(validBillExceptionMonth('2026-1'), false);
  assert.equal(validBillExceptionMonth('Nov 2026'), false);
});

test('validBillExceptionDate rejects impossible dates', () => {
  assert.equal(validBillExceptionDate('2026-11-01'), true);
  assert.equal(validBillExceptionDate('2026-02-30'), false);
  assert.equal(validBillExceptionDate('2024-02-29'), true);
  assert.equal(validBillExceptionDate('2026-02-29'), false);
});

test('billExceptionAmountCents keeps cents as-is and converts rupees once', () => {
  assert.equal(billExceptionAmountCents({ amountCents: 200000 }), 200000);
  assert.equal(billExceptionAmountCents({ amount: 2000 }), 200000);
  assert.equal(billExceptionAmountCents({ amount: '2000.50' }), 200050);
  assert.equal(billExceptionAmountCents({ amountCents: 200000, amount: 1 }), 200000);
  assert.equal(billExceptionAmountCents({ amount: -5 }), null);
  assert.equal(billExceptionAmountCents({}), null);
  assert.equal(billExceptionAmountCents({ amountCents: 0 }), 0);
});

test('normalizeExceptionBill refuses unnameable bills and drops unknown fields', () => {
  assert.equal(normalizeExceptionBill(bill({ id: '' })), null);
  assert.equal(normalizeExceptionBill(bill({ customerId: '' })), null);
  assert.equal(normalizeExceptionBill(bill({ month: '2026-13' })), null);
  const clean = normalizeExceptionBill(bill({ disputeId: 'D-1', paymentAmount: 5, stray: true }));
  assert.equal(clean.disputeId, undefined);
  assert.equal(clean.paymentAmount, undefined);
  assert.equal(clean.stray, undefined);
});

test('normalizeExceptionBill keeps a bill with no usable amount so it can be flagged', () => {
  const clean = normalizeExceptionBill(bill({ amountCents: undefined, amount: undefined }));
  assert.equal(clean.amountCents, null);
  assert.equal(normalizeExceptionBillList([bill(), bill({ id: '' })]).length, 1);
});

test('zero-amount bills are flagged, positive bills are not', () => {
  const exceptions = buildBillExceptions({ bills: [bill({ amountCents: 0 }), bill({ id: 'BILL-OK', month: '2026-10' }), bill({ id: 'BILL-9', month: '2026-09', amount: undefined, amountCents: undefined })] });
  assert.deepEqual(exceptions.map((e) => `${e.billId}:${e.reason}`), ['BILL-9:zero_amount', 'BILL-1:zero_amount']);
  assert.equal(exceptions[1].customerId, 'C-76');
  assert.equal(exceptions[1].month, '2026-11');
  assert.match(exceptions[0].detail, /No usable amount/);
});

test('duplicate bills: only later copies for the same customer-month are flagged', () => {
  const exceptions = buildBillExceptions({ bills: [
    bill(),
    bill({ id: 'BILL-2' }),
    bill({ id: 'BILL-3', month: '2026-12' }),
    bill({ id: 'BILL-4', customerId: 'C-77', customerName: 'Other' }),
  ] });
  assert.deepEqual(exceptions.map((e) => `${e.billId}:${e.reason}`), ['BILL-2:duplicate_bill']);
});

test('outdated price: flagged only when both figures exist and differ', () => {
  const exceptions = buildBillExceptions({ bills: [
    bill({ id: 'BILL-A', pricedCents: 200000, expectedCents: 220000 }),
    bill({ id: 'BILL-B', month: '2026-10', pricedCents: 200000, expectedCents: 200000 }),
    bill({ id: 'BILL-C', month: '2026-09', pricedCents: 200000 }),
    bill({ id: 'BILL-D', month: '2026-08', expectedCents: 200000 }),
  ] });
  assert.deepEqual(exceptions.map((e) => `${e.billId}:${e.reason}`), ['BILL-A:outdated_price']);
  assert.match(exceptions[0].detail, /PKR 2,000\.00/);
  assert.match(exceptions[0].detail, /PKR 2,200\.00/);
});

test('suspended or exited customers are flagged once even when both apply', () => {
  const exceptions = buildBillExceptions({
    bills: [bill(), bill({ id: 'BILL-2', customerId: 'C-77', customerName: 'Other' }), bill({ id: 'BILL-3', customerId: 'C-78', customerName: 'Third' })],
    suspendedCustomerIds: ['C-76', 'C-77'],
    exitedCustomerIds: ['C-77'],
  });
  assert.deepEqual(exceptions.map((e) => `${e.billId}:${e.reason}`), ['BILL-1:suspended_or_exited', 'BILL-2:suspended_or_exited']);
  assert.match(exceptions[1].detail, /suspension/);
  assert.match(exceptions[1].detail, /exit/);
});

test('exceptions sort by customer name, then month, then bill', () => {
  const exceptions = buildBillExceptions({ bills: [
    bill({ id: 'BILL-Z', customerId: 'C-99', customerName: 'Zebra', month: '2026-12' }),
    bill({ id: 'BILL-A', amountCents: 0 }),
    bill({ id: 'BILL-B', customerId: 'C-10', customerName: 'Apple', amountCents: 0 }),
  ] });
  assert.deepEqual(exceptions.map((e) => e.billId), ['BILL-B', 'BILL-A']);
});

test('clearance gates: unknown exception, bad method, blank note, bad date, repeat all refused', () => {
  const exceptions = buildBillExceptions({ bills: [bill({ amountCents: 0 })] });
  const base = { exceptionId: exceptions[0].id, customerId: 'C-76', billId: 'BILL-1', reason: 'zero_amount', method: 'fixed', note: 'Amount corrected', date: '2026-11-02' };
  assert.equal(applyBillExceptionClearance(exceptions, [], { ...base, exceptionId: 'nope' }), null);
  assert.equal(applyBillExceptionClearance(exceptions, [], { ...base, method: 'ignored' }), null);
  assert.equal(applyBillExceptionClearance(exceptions, [], { ...base, note: '  ' }), null);
  assert.equal(applyBillExceptionClearance(exceptions, [], { ...base, date: '2026-02-30' }), null);
  assert.equal(normalizeExceptionClearance({ ...base, reason: 'duplicate_bill' }).reason, 'duplicate_bill');
  assert.equal(normalizeExceptionClearance({ ...base, extraField: 1 }).extraField, undefined);
  const cleared = applyBillExceptionClearance(exceptions, [], base);
  assert.equal(cleared.length, 1);
  assert.equal(applyBillExceptionClearance(exceptions, cleared, base), null);
  assert.equal(applyBillExceptionClearance(exceptions, cleared, { ...base, method: 'accepted', note: 'Second try' }), null);
});

test('open and cleared views split the report without touching it', () => {
  const exceptions = buildBillExceptions({ bills: [bill({ amountCents: 0 }), bill({ id: 'BILL-2', month: '2026-10' })] });
  // BILL-2 is clean, so only one exception exists; add a second via duplicate.
  const two = buildBillExceptions({ bills: [bill({ amountCents: 0 }), bill({ id: 'BILL-2', month: '2026-10' }), bill({ id: 'BILL-3' })] });
  assert.equal(two.length, 2);
  const cleared = applyBillExceptionClearance(two, [], { exceptionId: two[0].id, customerId: two[0].customerId, billId: two[0].billId, reason: two[0].reason, method: 'accepted', note: 'Verified correct', date: '2026-11-02' });
  assert.equal(openBillExceptions(two, cleared).length, 1);
  assert.equal(clearedBillExceptions(two, cleared).length, 1);
  assert.equal(clearedBillExceptions(two, cleared)[0].clearance.note, 'Verified correct');
  assert.equal(two.length, 2);
  assert.equal(exceptions.length, 1);
});

test('building the report never mutates its inputs', () => {
  const input = { bills: [bill({ amountCents: 0 }), bill({ id: 'BILL-2' })], suspendedCustomerIds: ['C-76'] };
  const before = JSON.stringify(input);
  buildBillExceptions(input);
  assert.equal(JSON.stringify(input), before);
});

test('summary text counts open exceptions by reason and notes cleared ones', () => {
  assert.equal(billExceptionSummaryText([]), 'No bill exceptions.');
  const two = buildBillExceptions({ bills: [bill({ amountCents: 0 }), bill({ id: 'BILL-2', month: '2026-10' }), bill({ id: 'BILL-3' })] });
  assert.match(billExceptionSummaryText(two), /2 open exceptions/);
  const cleared = applyBillExceptionClearance(two, [], { exceptionId: two[0].id, customerId: two[0].customerId, billId: two[0].billId, reason: two[0].reason, method: 'fixed', note: 'Fixed', date: '2026-11-02' });
  assert.match(billExceptionSummaryText(two, cleared), /1 open exception/);
  assert.match(billExceptionSummaryText(two, cleared), /1 cleared/);
  const allCleared = applyBillExceptionClearance(two, cleared, { exceptionId: two[1].id, customerId: two[1].customerId, billId: two[1].billId, reason: two[1].reason, method: 'fixed', note: 'Fixed too', date: '2026-11-02' });
  assert.match(billExceptionSummaryText(two, allCleared), /All 2 exceptions cleared/);
});

test('HTML escapes and CSV quotes, filename is fixed', () => {
  const exception = { id: 'x', customerId: 'C-1', customerName: '<b>Bad</b>', billId: 'BILL-1', month: '2026-11', reason: 'zero_amount', reasonLabel: 'Zero-amount bill', detail: 'Amount "zero", ok' };
  const html = billExceptionHtml(exception);
  assert.doesNotMatch(html, /<b>Bad<\/b>/);
  assert.match(html, /&lt;b&gt;Bad&lt;\/b&gt;/);
  const csv = billExceptionCsv([exception]);
  assert.match(csv, /"Amount ""zero"", ok"/);
  assert.equal(billExceptionFilename(), 'bill-exceptions.csv');
});

test('purity fence: no storage, DOM, network, or dispute/suspension/exit module references', () => {
  const source = readFileSync(join(here, '..', 'bill-exceptions.js'), 'utf8');
  for (const banned of ['localStorage', 'document.', 'fetch(', 'import ', 'dispute-cases', 'suspension-records', 'exit-reasons', 'priceOnDate', 'XMLHttpRequest']) {
    assert.equal(source.includes(banned), false, `module must not contain ${banned}`);
  }
});
