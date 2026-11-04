import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validCombinedMonth,
  validCombinedDate,
  combinedDuesAmountCents,
  normalizeConnectionDues,
  normalizeConnectionDuesList,
  connectionsForCustomer,
  defaultConnectionOrder,
  buildCombinedDuesView,
  allocateCombinedPayment,
  formatCombinedCents,
  combinedDuesSummaryText,
  combinedDuesHtml,
  combinedDuesCsv,
  combinedDuesFilename,
} from '../combined-dues.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

function house(over = {}) {
  return { id: 'C-HOUSE', customer: 'CUST-1', label: 'House', month: '2026-09', amount: 1500, ...over };
}

function shop(over = {}) {
  return { id: 'C-SHOP', customer: 'CUST-1', label: 'Shop', month: '2026-10', amount: 2000, ...over };
}

test('months and dates: strict calendar rules', () => {
  assert.equal(validCombinedMonth('2026-09'), true);
  assert.equal(validCombinedMonth('2026-13'), false);
  assert.equal(validCombinedMonth('2026-9'), false);
  assert.equal(validCombinedDate('2026-02-28'), true);
  assert.equal(validCombinedDate('2026-02-30'), false);
  assert.equal(validCombinedDate('2026-13-01'), false);
});

test('amounts: rupees convert once, cents pass through, double conversion guarded', () => {
  assert.equal(combinedDuesAmountCents({ amount: 1500 }), 150000);
  assert.equal(combinedDuesAmountCents({ amountCents: 150000 }), 150000);
  assert.equal(combinedDuesAmountCents({ amountCents: 150000, amount: 1500 }), 150000);
  assert.equal(combinedDuesAmountCents({ amount: '250.50' }), 25050);
  assert.equal(combinedDuesAmountCents({ amount: 'abc' }), null);
  assert.equal(combinedDuesAmountCents({}), null);
});

test('half-formed rows refused, unknown fields dropped, zero dues kept', () => {
  assert.equal(normalizeConnectionDues({ customer: 'CUST-1', amount: 100 }), null);
  assert.equal(normalizeConnectionDues({ id: 'C-1', amount: 100 }), null);
  assert.equal(normalizeConnectionDues({ id: 'C-1', customer: 'CUST-1', amount: -5 }), null);
  assert.equal(normalizeConnectionDues({ id: 'C-1', customer: 'CUST-1' }), null);
  const zero = normalizeConnectionDues({ id: 'C-1', customer: 'CUST-1', label: 'Spare', amount: 0, extraBill: 'B-9' });
  assert.equal(zero.outstandingCents, 0);
  assert.equal('extraBill' in zero, false);
  const row = normalizeConnectionDues({ id: ' C-1 ', customer: ' CUST-1 ', label: ' House ', month: '2026-13', amount: 1500, outstandingCents: 999999 });
  assert.equal(row.id, 'C-1');
  assert.equal(row.month, '');
  assert.equal(row.outstandingCents, 150000);
});

test('customer filter and list normalisation', () => {
  const rows = normalizeConnectionDuesList([house(), shop(), { id: 'C-X', customer: 'CUST-2', amount: 500 }, null, 'nope']);
  assert.equal(rows.length, 3);
  assert.equal(connectionsForCustomer(rows, 'CUST-1').length, 2);
  assert.deepEqual(connectionsForCustomer(rows, '  '), []);
});

test('combined total equals the sum of per-connection dues, exactly', () => {
  const view = buildCombinedDuesView('CUST-1', [shop(), house({ outstandingCents: 100000 })]);
  assert.equal(view.connectionCount, 2);
  assert.equal(view.totalAmountCents, 350000);
  assert.equal(view.totalOutstandingCents, 300000);
  assert.equal(view.connections.reduce((sum, row) => sum + row.outstandingCents, 0), view.totalOutstandingCents);
  assert.equal(buildCombinedDuesView('CUST-1', []), null);
  assert.equal(buildCombinedDuesView('', [house()]), null);
});

test('default order: oldest month first, undated last, ties by connection id', () => {
  const rows = [shop(), house(), { id: 'C-OLD', customer: 'CUST-1', label: 'Old', month: '2026-09', amount: 100 }, { id: 'C-NODATE', customer: 'CUST-1', label: 'New', amount: 100 }];
  assert.deepEqual(defaultConnectionOrder(rows), ['C-HOUSE', 'C-OLD', 'C-SHOP', 'C-NODATE']);
  const settled = [house({ outstandingCents: 0 }), shop()];
  assert.deepEqual(defaultConnectionOrder(settled), ['C-SHOP']);
});

test('allocation: oldest first, allocated plus unallocated equals the payment', () => {
  const rows = [shop(), house({ outstandingCents: 100000 })];
  const alloc = allocateCombinedPayment({ id: 'P-1', customer: 'CUST-1', amount: 2500 }, rows);
  assert.equal(alloc.allocatedTotalCents + alloc.unallocatedCents, 250000);
  assert.deepEqual(alloc.orderUsed, ['C-HOUSE', 'C-SHOP']);
  assert.equal(alloc.lines.find((line) => line.connectionId === 'C-HOUSE').allocatedCents, 100000);
  assert.equal(alloc.lines.find((line) => line.connectionId === 'C-SHOP').allocatedCents, 150000);
  assert.equal(alloc.lines.find((line) => line.connectionId === 'C-SHOP').remainingCents, 50000);
});

test('allocation: overpayment stays unallocated, never forced onto a connection', () => {
  const alloc = allocateCombinedPayment({ customer: 'CUST-1', amount: 9999 }, [house()]);
  assert.equal(alloc.allocatedTotalCents, 150000);
  assert.equal(alloc.unallocatedCents, 999900 - 150000);
  assert.equal(alloc.lines[0].remainingCents, 0);
});

test('allocation: settled connections show 0 allocated and 0 remaining', () => {
  const alloc = allocateCombinedPayment({ customer: 'CUST-1', amount: 100 }, [house({ outstandingCents: 0 }), shop()]);
  const settled = alloc.lines.find((line) => line.connectionId === 'C-HOUSE');
  assert.equal(settled.allocatedCents, 0);
  assert.equal(settled.remainingCents, 0);
  assert.equal(alloc.lines.find((line) => line.connectionId === 'C-SHOP').allocatedCents, 10000);
});

test('allocation: custom order needs a reason, unnamed connections still follow in default order', () => {
  const rows = [house(), shop()];
  assert.equal(allocateCombinedPayment({ customer: 'CUST-1', amount: 100 }, rows, { order: ['C-SHOP'] }), null);
  const alloc = allocateCombinedPayment({ customer: 'CUST-1', amount: 100 }, rows, { order: ['C-SHOP'], orderReason: 'Shop first this visit' });
  assert.deepEqual(alloc.orderUsed, ['C-SHOP', 'C-HOUSE']);
  assert.equal(alloc.orderReason, 'Shop first this visit');
  const partial = allocateCombinedPayment({ customer: 'CUST-1', amount: 100 }, rows, { order: ['C-NOPE', 'C-SHOP'], orderReason: 'Shop first' });
  assert.deepEqual(partial.orderUsed, ['C-SHOP', 'C-HOUSE']);
});

test('allocation: half-formed payments refused', () => {
  assert.equal(allocateCombinedPayment({ customer: 'CUST-1', amount: 0 }, [house()]), null);
  assert.equal(allocateCombinedPayment({ customer: '', amount: 100 }, [house()]), null);
  assert.equal(allocateCombinedPayment({ customer: 'CUST-1', amount: -10 }, [house()]), null);
  assert.equal(allocateCombinedPayment(null, [house()]), null);
});

test('inputs are never mutated', () => {
  const rows = [house(), shop()];
  const snapshot = JSON.stringify(rows);
  const payment = { customer: 'CUST-1', amount: 500 };
  buildCombinedDuesView('CUST-1', rows);
  allocateCombinedPayment(payment, rows);
  assert.equal(JSON.stringify(rows), snapshot);
  assert.equal(JSON.stringify(payment), JSON.stringify({ customer: 'CUST-1', amount: 500 }));
});

test('summary, HTML escaping, CSV quoting, filename', () => {
  const view = buildCombinedDuesView('CUST-1', [house({ label: '<House> & "Shop"' })]);
  assert.match(combinedDuesSummaryText(view), /1 connection/);
  assert.match(combinedDuesSummaryText(view), /Rs\. 1500\.00/);
  const html = combinedDuesHtml(view);
  assert.doesNotMatch(html, /<House>/);
  assert.match(html, /&lt;House&gt;/);
  const csv = combinedDuesCsv(view);
  assert.match(csv, /COMBINED TOTAL/);
  assert.match(csv, /"<House> & ""Shop"""/);
  assert.equal(combinedDuesFilename(), 'combined-dues.csv');
  assert.equal(formatCombinedCents(150050), 'Rs. 1500.50');
  assert.equal(formatCombinedCents(-5000), '-Rs. 50.00');
  assert.equal(combinedDuesSummaryText(null), 'No combined dues view.');
});

test('purity fence: no imports, storage, DOM, network, or other-module references', () => {
  const source = readFileSync(join(root, 'combined-dues.js'), 'utf8');
  assert.doesNotMatch(source, /^import |from '\.\//m);
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.|window\.|fetch\(/);
  assert.doesNotMatch(source, /part-payment-rules|due-date-shift|closed-period-posting/);
});

test('panel ids present in index.html', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  for (const id of ['combinedCustomer', 'combinedLines', 'combinedBuildBtn', 'combinedBody', 'combinedSummary', 'combinedPayment', 'combinedOrder', 'combinedOrderReason', 'combinedAllocateBtn', 'combinedAllocBody', 'combinedExportBtn']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
