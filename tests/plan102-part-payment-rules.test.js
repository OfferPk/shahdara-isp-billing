import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validPartPaymentDate,
  validPartPaymentMonth,
  partPaymentAmountCents,
  normalizeAllocationBill,
  normalizeAllocationInstalment,
  normalizePartPayment,
  defaultAllocationOrder,
  allocatePartPayment,
  normalizePartPaymentAllocation,
  normalizePartPaymentAllocationList,
  upsertPartPaymentAllocation,
  removePartPaymentAllocation,
  findPartPaymentAllocation,
  partPaymentsForCustomer,
  formatPartPaymentCents,
  partPaymentSummaryText,
  partPaymentHtml,
  partPaymentCsv,
  partPaymentFilename,
} from '../part-payment-rules.js';

const payment = (overrides = {}) => ({
  id: 'PAY-1',
  customer: 'C-76',
  customerName: 'Orient school',
  date: '2026-11-04',
  amountCents: 150000,
  ...overrides,
});

const bill = (overrides = {}) => ({
  id: 'B-1',
  month: '2026-09',
  amountCents: 200000,
  ...overrides,
});

const instalment = (overrides = {}) => ({
  id: 'I-1',
  dueDate: '2026-11-10',
  amountCents: 50000,
  ...overrides,
});

test('strict dates and months: impossible dates and bad months refused', () => {
  assert.equal(validPartPaymentDate('2026-02-30'), false);
  assert.equal(validPartPaymentDate('2026-02-29'), false);
  assert.equal(validPartPaymentDate('2024-02-29'), true);
  assert.equal(validPartPaymentDate('2026-13-01'), false);
  assert.equal(validPartPaymentDate('2026-11-4'), false);
  assert.equal(validPartPaymentDate('not-a-date'), false);
  assert.equal(validPartPaymentMonth('2026-10'), true);
  assert.equal(validPartPaymentMonth('2026-13'), false);
  assert.equal(validPartPaymentMonth('2026-1'), false);
  assert.equal(validPartPaymentMonth('2026-00'), false);
});

test('half-formed payments, bills, and instalments refused; unknown fields dropped', () => {
  assert.equal(normalizePartPayment(null), null);
  assert.equal(normalizePartPayment(payment({ id: '' })), null);
  assert.equal(normalizePartPayment(payment({ customer: '  ' })), null);
  assert.equal(normalizePartPayment(payment({ date: '2026-02-30' })), null);
  assert.equal(normalizePartPayment(payment({ amountCents: 0 })), null);
  assert.equal(normalizePartPayment(payment({ amountCents: -100 })), null);
  assert.equal(normalizePartPayment(payment({ amountCents: 10.5 })), null);
  assert.deepEqual(Object.keys(normalizePartPayment(payment({ surprise: 'x', billTotal: 999 })) ?? {}), ['id', 'customer', 'customerName', 'date', 'amountCents']);
  assert.equal(normalizeAllocationBill(bill({ id: '' })), null);
  assert.equal(normalizeAllocationBill(bill({ month: '2026-13' })), null);
  assert.equal(normalizeAllocationBill(bill({ amountCents: 0 })), null);
  assert.equal(normalizeAllocationInstalment(instalment({ id: '' })), null);
  assert.equal(normalizeAllocationInstalment(instalment({ amountCents: 0 })), null);
});

test('rupees convert to cents exactly once; integer cents used as-is', () => {
  assert.equal(partPaymentAmountCents({ amountCents: 200000, amount: 9999 }), 200000);
  assert.equal(partPaymentAmountCents({ amount: 2000 }), 200000);
  assert.equal(partPaymentAmountCents({ amount: '1500' }), 150000);
  assert.equal(partPaymentAmountCents({}), null);
  assert.equal(normalizePartPayment(payment({ amountCents: undefined, amount: 1500 })).amountCents, 150000);
});

test('outstanding comes from paid figures, clamped, never negative or above the bill', () => {
  assert.equal(normalizeAllocationBill(bill({ paidCents: 50000 })).outstandingCents, 150000);
  assert.equal(normalizeAllocationBill(bill({ paidCents: 999999 })).outstandingCents, 0);
  assert.equal(normalizeAllocationBill(bill({ outstandingCents: 30000 })).outstandingCents, 30000);
  assert.equal(normalizeAllocationBill(bill({ outstandingCents: 999999 })).outstandingCents, 200000);
  assert.equal(normalizeAllocationInstalment(instalment({ paidAmount: 200 })).outstandingCents, 30000);
});

test('default order: oldest bill first, then current bill, then instalments, then newer bills', () => {
  const bills = [
    bill({ id: 'B-NEW', month: '2026-12' }),
    bill({ id: 'B-CUR', month: '2026-11' }),
    bill({ id: 'B-OLD', month: '2026-09' }),
    bill({ id: 'B-MID', month: '2026-10' }),
  ];
  const instalments = [
    instalment({ id: 'I-LATE', dueDate: '2026-12-01' }),
    instalment({ id: 'I-EARLY', dueDate: '2026-11-05' }),
  ];
  assert.deepEqual(defaultAllocationOrder(bills, instalments, 'B-CUR'), ['B-OLD', 'B-MID', 'B-CUR', 'I-EARLY', 'I-LATE', 'B-NEW']);
  assert.deepEqual(defaultAllocationOrder(bills, instalments), ['B-OLD', 'B-MID', 'B-CUR', 'B-NEW', 'I-EARLY', 'I-LATE']);
  assert.deepEqual(defaultAllocationOrder(bills, instalments, 'B-SETTLED'), ['B-OLD', 'B-MID', 'B-CUR', 'B-NEW', 'I-EARLY', 'I-LATE']);
});

test('settled targets never enter the order; undated instalments sort last', () => {
  const bills = [bill({ id: 'B-PAID', month: '2026-08', paidCents: 200000 })];
  const instalments = [instalment({ id: 'I-NODATE', dueDate: 'bad-date' }), instalment({ id: 'I-DATED', dueDate: '2026-11-05' })];
  assert.deepEqual(defaultAllocationOrder(bills, instalments), ['I-DATED', 'I-NODATE']);
});

test('allocation settles bill by bill and sums exactly to the payment', () => {
  const result = allocatePartPayment(
    payment({ amountCents: 250000 }),
    [bill({ id: 'B-SEP', month: '2026-09', amountCents: 200000 }), bill({ id: 'B-OCT', month: '2026-10', amountCents: 200000 })],
    [instalment({ amountCents: 50000 })],
  );
  assert.equal(result.allocatedTotalCents + result.unallocatedCents, 250000);
  assert.equal(result.allocatedTotalCents, 250000);
  assert.equal(result.unallocatedCents, 0);
  assert.equal(result.lines[0].targetId, 'B-SEP');
  assert.equal(result.lines[0].allocatedCents, 200000);
  assert.equal(result.lines[0].remainingCents, 0);
  assert.equal(result.lines[1].allocatedCents, 50000);
  assert.equal(result.lines[1].remainingCents, 150000);
  assert.equal(result.lines[2].allocatedCents, 0);
  assert.equal(result.lines[2].remainingCents, 50000);
});

test('part-payment smaller than the oldest bill settles only that bill, partly', () => {
  const result = allocatePartPayment(
    payment({ amountCents: 50000 }),
    [bill({ amountCents: 200000 })],
    [],
  );
  assert.deepEqual(result.lines.map((line) => [line.allocatedCents, line.remainingCents]), [[50000, 150000]]);
  assert.equal(result.unallocatedCents, 0);
});

test('overpayment beyond every outstanding target is unallocated, never forced onto a bill', () => {
  const result = allocatePartPayment(
    payment({ amountCents: 500000 }),
    [bill({ amountCents: 200000 })],
    [instalment({ amountCents: 50000 })],
  );
  assert.equal(result.allocatedTotalCents, 250000);
  assert.equal(result.unallocatedCents, 250000);
  assert.ok(result.lines.every((line) => line.allocatedCents <= line.amountCents));
});

test('a custom order without a reason is refused outright', () => {
  const bills = [bill({ id: 'B-A', month: '2026-09' }), bill({ id: 'B-B', month: '2026-10' })];
  assert.equal(allocatePartPayment(payment(), bills, [], { order: ['B-B', 'B-A'] }), null);
  assert.equal(allocatePartPayment(payment(), bills, [], { order: 'B-B, B-A', orderReason: '  ' }), null);
  const changed = allocatePartPayment(payment(), bills, [], { order: ['B-B', 'B-A'], orderReason: 'Customer asked October first' });
  assert.deepEqual(changed.orderUsed, ['B-B', 'B-A']);
  assert.equal(changed.orderReason, 'Customer asked October first');
  assert.equal(changed.lines[0].targetId, 'B-B');
});

test('custom order names only some targets: the rest follow in default order', () => {
  const result = allocatePartPayment(
    payment({ amountCents: 100000 }),
    [bill({ id: 'B-A', month: '2026-09' }), bill({ id: 'B-B', month: '2026-10' })],
    [instalment({ id: 'I-1' })],
    { order: ['I-1'], orderReason: 'Arrears first this time' },
  );
  assert.deepEqual(result.orderUsed, ['I-1', 'B-A', 'B-B']);
});

test('allocation never mutates its inputs', () => {
  const bills = [bill({ amountCents: 200000 })];
  const instalments = [instalment()];
  const snapshot = JSON.stringify({ bills, instalments });
  allocatePartPayment(payment(), bills, instalments);
  assert.equal(JSON.stringify({ bills, instalments }), snapshot);
});

test('stored record: half-formed refused, custom order without reason refused, over-claim refused', () => {
  const good = {
    ...payment(),
    order: [],
    orderReason: '',
    lines: [{ targetId: 'B-1', kind: 'bill', month: '2026-09', amountCents: 200000, allocatedCents: 150000, remainingCents: 50000 }],
  };
  assert.equal(normalizePartPaymentAllocation(good).allocatedTotalCents, 150000);
  assert.equal(normalizePartPaymentAllocation(good).unallocatedCents, 0);
  assert.equal(normalizePartPaymentAllocation({ ...good, order: ['B-1'] }), null);
  assert.equal(normalizePartPaymentAllocation({ ...good, lines: [{ targetId: 'B-1', kind: 'bill', month: '2026-09', amountCents: 200000, allocatedCents: 200001, remainingCents: 0 }] }), null);
  assert.equal(normalizePartPaymentAllocation({ ...good, lines: 'not-a-list' }), null);
});

test('upsert, remove, find, and per-customer filtering', () => {
  const record = {
    ...payment(),
    order: [],
    orderReason: '',
    lines: [{ targetId: 'B-1', kind: 'bill', month: '2026-09', amountCents: 200000, allocatedCents: 150000, remainingCents: 50000 }],
  };
  const list = upsertPartPaymentAllocation([], record);
  assert.equal(list.length, 1);
  assert.equal(findPartPaymentAllocation(list, 'PAY-1').customer, 'C-76');
  assert.equal(upsertPartPaymentAllocation(list, record).length, 1);
  assert.equal(upsertPartPaymentAllocation(list, { ...record, date: '2026-02-30' }).length, 1);
  assert.equal(partPaymentsForCustomer(list, 'C-76').length, 1);
  assert.equal(partPaymentsForCustomer(list, 'C-99').length, 0);
  assert.equal(removePartPaymentAllocation(list, 'PAY-1').length, 0);
  assert.equal(normalizePartPaymentAllocationList([record, null, { ...record, id: '' }]).length, 1);
});

test('summary, HTML, and CSV show the bill-by-bill breakdown', () => {
  const record = {
    ...payment(),
    order: [],
    orderReason: '',
    lines: [
      { targetId: 'B-1', kind: 'bill', month: '2026-09', amountCents: 200000, allocatedCents: 150000, remainingCents: 50000 },
      { targetId: 'I-1', kind: 'instalment', dueDate: '2026-11-10', amountCents: 50000, allocatedCents: 0, remainingCents: 50000 },
    ],
  };
  assert.match(partPaymentSummaryText([record]), /PKR 1,500/);
  assert.match(partPaymentSummaryText([]), /No part-payments/);
  const html = partPaymentHtml([record]);
  assert.match(html, /2026-09/);
  assert.match(html, /still open/);
  assert.match(html, /PKR 500/);
  const csv = partPaymentCsv([record]);
  assert.match(csv, /Payment id,Customer,Date/);
  assert.match(csv, /2026-09,bill,2000,1500,500/);
  assert.equal(partPaymentFilename(), 'part-payment-allocations.csv');
  assert.match(partPaymentHtml([]), /No part-payments/);
});

test('money formatting uses integer cents exactly', () => {
  assert.equal(formatPartPaymentCents(200000), 'PKR 2,000');
  assert.equal(formatPartPaymentCents(150050), 'PKR 1,500.50');
  assert.equal(formatPartPaymentCents(0), 'PKR 0');
});

test('purity fence: module reads no store, no DOM, and no other plan record', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, '..', 'part-payment-rules.js'), 'utf8');
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('document.'));
  assert.ok(!source.includes('advance-allocation'));
  assert.ok(!source.includes('repayment-plan'));
  assert.ok(!source.includes('shahdara_advance'));
  assert.ok(!source.includes('shahdara_repayment'));
});
