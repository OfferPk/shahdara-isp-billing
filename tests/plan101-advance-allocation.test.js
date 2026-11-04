import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validAdvanceDate,
  validAdvanceMonth,
  normalizeAdvanceAllocation,
  normalizeAdvanceAllocationList,
  upsertAdvanceAllocation,
  removeAdvanceAllocation,
  findAdvanceAllocation,
  normalizeAllocationBill,
  allocateAdvance,
  advanceWithAllocation,
  advancesForCustomer,
  billsMarkedCovered,
  advanceSummaryText,
  advanceHtml,
  advanceCsv,
  advanceFilename,
} from '../advance-allocation.js';

const advance = (overrides = {}) => ({
  id: 'ADV-1',
  customer: 'C-76',
  customerName: 'Orient school',
  date: '2026-11-04',
  amountCents: 400000,
  monthsCovered: ['2026-12', '2027-01'],
  ...overrides,
});

const bill = (overrides = {}) => ({
  id: 'B-1',
  month: '2026-12',
  amountCents: 200000,
  ...overrides,
});

test('strict dates and months: impossible dates and bad months refused', () => {
  assert.equal(validAdvanceDate('2026-02-30'), false);
  assert.equal(validAdvanceDate('2026-02-29'), false);
  assert.equal(validAdvanceDate('2024-02-29'), true);
  assert.equal(validAdvanceDate('2026-13-01'), false);
  assert.equal(validAdvanceDate('2026-11-4'), false);
  assert.equal(validAdvanceDate('not-a-date'), false);
  assert.equal(validAdvanceMonth('2026-10'), true);
  assert.equal(validAdvanceMonth('2026-11'), true);
  assert.equal(validAdvanceMonth('2026-12'), true);
  assert.equal(validAdvanceMonth('2026-13'), false);
  assert.equal(validAdvanceMonth('2026-1'), false);
  assert.equal(validAdvanceMonth('2026-00'), false);
});

test('half-formed advances refused, unknown fields dropped', () => {
  assert.equal(normalizeAdvanceAllocation(null), null);
  assert.equal(normalizeAdvanceAllocation(advance({ id: '' })), null);
  assert.equal(normalizeAdvanceAllocation(advance({ customer: '  ' })), null);
  assert.equal(normalizeAdvanceAllocation(advance({ amountCents: 0 })), null);
  assert.equal(normalizeAdvanceAllocation(advance({ amountCents: -500 })), null);
  assert.equal(normalizeAdvanceAllocation(advance({ amountCents: 10.5 })), null);
  assert.equal(normalizeAdvanceAllocation(advance({ date: '2026-02-30' })), null);
  assert.equal(normalizeAdvanceAllocation(advance({ monthsCovered: [] })), null);
  assert.equal(normalizeAdvanceAllocation(advance({ monthsCovered: ['2026-12', '2027-13'] })), null);
  assert.deepEqual(Object.keys(normalizeAdvanceAllocation(advance({ surprise: 'x', billId: 'B-9' })) ?? {}), ['id', 'customer', 'customerName', 'date', 'amountCents', 'monthsCovered']);
});

test('rupees convert to cents exactly once; integer cents used as-is', () => {
  assert.equal(normalizeAdvanceAllocation(advance({ amountCents: undefined, amount: 2000 })).amountCents, 200000);
  assert.equal(normalizeAdvanceAllocation(advance({ amountCents: 200000, amount: 9999 })).amountCents, 200000);
  assert.equal(normalizeAdvanceAllocation(advance({ amountCents: undefined, amount: 0 })), null);
});

test('months covered keep operator order, duplicates dropped', () => {
  const row = normalizeAdvanceAllocation(advance({ monthsCovered: ['2027-01', '2026-12', '2027-01'] }));
  assert.deepEqual(row.monthsCovered, ['2027-01', '2026-12']);
  const fromText = normalizeAdvanceAllocation(advance({ monthsCovered: '2026-12, 2027-01' }));
  assert.deepEqual(fromText.monthsCovered, ['2026-12', '2027-01']);
});

test('upsert replaces by id, half-formed upsert leaves list unchanged, remove/find', () => {
  const base = [advance()];
  assert.equal(upsertAdvanceAllocation(base, advance({ amountCents: 600000 }))[0].amountCents, 600000);
  assert.equal(upsertAdvanceAllocation(base, advance({ amountCents: 600000 })).length, 1);
  assert.deepEqual(upsertAdvanceAllocation(base, advance({ amountCents: 0 })), base);
  assert.equal(removeAdvanceAllocation(base, 'ADV-1').length, 0);
  assert.equal(findAdvanceAllocation(base, 'ADV-1').customer, 'C-76');
  assert.equal(findAdvanceAllocation(base, 'nope'), null);
  assert.deepEqual(normalizeAdvanceAllocationList([advance(), advance({ amountCents: 0 })]).length, 1);
});

test('allocation consumes oldest covered month first, even when bills arrive out of order', () => {
  const bills = [bill({ id: 'B-2', month: '2027-01', amountCents: 200000 }), bill({ id: 'B-1', month: '2026-12', amountCents: 200000 })];
  const result = allocateAdvance(advance(), bills);
  assert.deepEqual(result.allocations.map((row) => row.billId), ['B-1', 'B-2']);
  assert.equal(result.consumedCents, 400000);
  assert.equal(result.remainingCents, 0);
  assert.equal(result.consumedCents + result.remainingCents, 400000);
});

test('partial cover: advance smaller than the bill leaves a partial row and exact remainder', () => {
  const result = allocateAdvance(advance({ amountCents: 150000 }), [bill()]);
  assert.deepEqual(result.allocations, [{ billId: 'B-1', month: '2026-12', amountCents: 150000, fullyCovered: false }]);
  assert.equal(result.consumedCents, 150000);
  assert.equal(result.remainingCents, 0);
});

test('advance larger than the covered bills leaves the rest remaining, never overspent', () => {
  const result = allocateAdvance(advance({ amountCents: 900000 }), [bill(), bill({ id: 'B-2', month: '2027-01', amountCents: 200000 })]);
  assert.equal(result.consumedCents, 400000);
  assert.equal(result.remainingCents, 500000);
  assert.equal(result.consumedCents + result.remainingCents, 900000);
});

test('an advance is never applied to an already-paid bill, and bills outside covered months are untouched', () => {
  const bills = [
    bill({ id: 'B-paid', month: '2026-12', paid: true }),
    bill({ id: 'B-next', month: '2027-01', amountCents: 200000 }),
    bill({ id: 'B-out', month: '2027-02', amountCents: 200000 }),
  ];
  const result = allocateAdvance(advance({ amountCents: 200000 }), bills);
  assert.deepEqual(result.allocations.map((row) => row.billId), ['B-next']);
  assert.equal(result.remainingCents, 0);
});

test('paid by status string also skipped; unusable bills skipped, never zero-filled', () => {
  const bills = [
    bill({ id: 'B-s', month: '2026-12', status: 'paid' }),
    bill({ id: 'B-bad', month: '2027-01', amountCents: 0 }),
    bill({ id: 'B-ok', month: '2027-01', amountCents: 100000 }),
  ];
  const result = allocateAdvance(advance({ amountCents: 100000 }), bills);
  assert.deepEqual(result.allocations.map((row) => row.billId), ['B-ok']);
  assert.equal(normalizeAllocationBill(bill({ status: 'paid' })), null);
  assert.equal(normalizeAllocationBill(bill({ amountCents: -1 })), null);
  assert.equal(normalizeAllocationBill(bill({ month: 'bad' })), null);
});

test('allocation never mutates the advance or the bills', () => {
  const input = advance();
  const bills = [bill(), bill({ id: 'B-2', month: '2027-01' })];
  const snapshot = JSON.stringify({ input, bills });
  allocateAdvance(input, bills);
  billsMarkedCovered(input, bills);
  assert.equal(JSON.stringify({ input, bills }), snapshot);
});

test('bills marked covered: covered, partial, open, and paid marks; originals keep full amounts', () => {
  const bills = [
    bill(),
    bill({ id: 'B-2', month: '2027-01', amountCents: 300000 }),
    bill({ id: 'B-3', month: '2027-02', amountCents: 100000 }),
    bill({ id: 'B-4', month: '2026-11', amountCents: 100000, paid: true }),
  ];
  const marked = billsMarkedCovered(advance({ amountCents: 250000 }), bills);
  assert.equal(marked[0].coverStatus, 'covered');
  assert.equal(marked[0].coveredByAdvance, true);
  assert.equal(marked[0].amountCents, 200000);
  assert.equal(marked[1].coverStatus, 'partial');
  assert.equal(marked[1].coveredAmountCents, 50000);
  assert.equal(marked[2].coverStatus, 'open');
  assert.equal(marked[2].coveredAmountCents, 0);
  assert.equal(marked[3].coverStatus, 'paid');
  assert.equal(bills[0].coveredByAdvance, undefined);
});

test('advances for one customer, and summary text sums exactly', () => {
  const list = [advance(), advance({ id: 'ADV-2', customer: 'C-9' })];
  assert.equal(advancesForCustomer(list, 'C-76').length, 1);
  assert.equal(advancesForCustomer(list, '').length, 0);
  const views = [advanceWithAllocation(advance(), [bill()]), advanceWithAllocation(advance({ id: 'ADV-2', customer: 'C-9', amountCents: 100000 }), [])];
  const summary = advanceSummaryText(views);
  assert.match(summary, /2 advances/);
  assert.match(summary, /PKR 5,000\.00/);
  assert.match(summary, /PKR 2,000\.00/);
  assert.match(summary, /PKR 3,000\.00/);
  assert.equal(advanceWithAllocation(advance({ amountCents: 0 }), []), null);
});

test('HTML escapes names and CSV quotes fields; filename fixed', () => {
  const view = advanceWithAllocation(advance({ customerName: '<b>Acme & Sons</b>' }), [bill()]);
  assert.doesNotMatch(advanceHtml([view]), /<b>Acme/);
  assert.match(advanceHtml([view]), /Acme &amp; Sons/);
  assert.match(advanceHtml([]), /No advances recorded yet/);
  const csv = advanceCsv([advanceWithAllocation(advance({ customerName: 'Acme, Ltd' }), [])]);
  assert.match(csv, /"Acme, Ltd"/);
  assert.equal(advanceFilename(), 'advance-allocations.csv');
});

test('purity fence: module imports nothing and names no outside record system', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, '..', 'advance-allocation.js'), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /localStorage|document\./);
  assert.doesNotMatch(source, /repayment-plan|normalizeRepaymentPlan/);
  assert.doesNotMatch(source, /discount/i);
});
