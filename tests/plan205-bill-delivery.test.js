import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validDeliveryDate,
  dueDateForDelivery,
  BILL_DELIVERY_METHODS,
  BILL_DELIVERY_METHOD_LABELS,
  normalizeBillDeliveryBillKey,
  normalizeBillDelivery,
  normalizeBillDeliveryList,
  findBillDelivery,
  recordBillDelivery,
  removeBillDelivery,
  billDeliveriesSorted,
  billDeliveriesForCustomer,
  billDeliveriesForBill,
  billDeliveryText,
  billDeliverySummaryText,
  undeliveredBills,
  undeliveredBillsBeforeDue,
  undeliveredBillsText,
  billDeliveryHtml,
  billDeliveryCsv,
  billDeliveryFilename,
} from '../bill-delivery.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'bill-delivery.js'), 'utf8');

const deliveryA = { id: 'BD-1', billId: 'C-1 · 2026-11', customerId: 'C-1', method: 'in-person', deliveredBy: 'Saad', date: '2026-11-03' };
const deliveryB = { id: 'BD-2', billId: 'C-2 · 2026-11', customerId: 'C-2', method: 'message', deliveredBy: 'Saad', date: '2026-11-02' };
const deliveryC = { id: 'BD-3', billId: 'C-1 · 2026-10', customerId: 'C-1', method: 'paper', deliveredBy: 'Saad', date: '2026-10-28' };

test('strict dates: leap day rules and bad formats refused', () => {
  assert.equal(validDeliveryDate('2024-02-29'), true);
  assert.equal(validDeliveryDate('2026-02-29'), false);
  assert.equal(validDeliveryDate('2026-02-30'), false);
  assert.equal(validDeliveryDate('2026-13-01'), false);
  assert.equal(validDeliveryDate('2026-11'), false);
  assert.equal(validDeliveryDate(''), false);
  assert.equal(validDeliveryDate(null), false);
});

test('due date: a bill month counts as its first day, anything else is null', () => {
  assert.equal(dueDateForDelivery('2026-11-05'), '2026-11-05');
  assert.equal(dueDateForDelivery('2026-11'), '2026-11-01');
  assert.equal(dueDateForDelivery('2026-13'), null);
  assert.equal(dueDateForDelivery('soon'), null);
});

test('method catalogue is exactly the plan’s three methods', () => {
  assert.deepEqual([...BILL_DELIVERY_METHODS], ['in-person', 'message', 'paper']);
  assert.equal(BILL_DELIVERY_METHOD_LABELS['in-person'], 'Handed in person');
  assert.equal(BILL_DELIVERY_METHOD_LABELS.message, 'By message');
  assert.equal(BILL_DELIVERY_METHOD_LABELS.paper, 'Paper left at premises');
});

test('half-formed records refused: missing id, bill, customer, deliverer, or date', () => {
  assert.equal(normalizeBillDelivery({ ...deliveryA, id: '' }), null);
  assert.equal(normalizeBillDelivery({ ...deliveryA, billId: '  ' }), null);
  assert.equal(normalizeBillDelivery({ ...deliveryA, customerId: '' }), null);
  assert.equal(normalizeBillDelivery({ ...deliveryA, deliveredBy: '' }), null);
  assert.equal(normalizeBillDelivery({ ...deliveryA, date: '2026-02-30' }), null);
  assert.equal(normalizeBillDelivery({ ...deliveryA, method: 'email' }), null);
  assert.equal(normalizeBillDelivery(null), null);
});

test('unknown fields dropped, never carried forward', () => {
  const clean = normalizeBillDelivery({ ...deliveryA, receiptId: 'R-9', note: 'extra' });
  assert.deepEqual(Object.keys(clean).sort(), ['billId', 'customerId', 'date', 'deliveredBy', 'id', 'method']);
});

test('one record per bill: a second record for the same bill never rewrites the first', () => {
  const list = recordBillDelivery([deliveryA], { id: 'BD-9', billId: 'c-1 · 2026-11', customerId: 'C-1', method: 'message', deliveredBy: 'Saad', date: '2026-11-04' });
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'BD-1');
  assert.equal(list[0].method, 'in-person');
});

test('duplicate ids never stored twice', () => {
  const list = recordBillDelivery([deliveryA], { ...deliveryB, id: 'BD-1' });
  assert.equal(list.length, 1);
  assert.equal(list[0].billId, deliveryA.billId);
});

test('find and remove by bill and id', () => {
  const list = [deliveryA, deliveryB, deliveryC];
  assert.equal(findBillDelivery(list, 'c-2 · 2026-11').id, 'BD-2');
  assert.equal(findBillDelivery(list, 'C-9 · 2026-11'), null);
  assert.deepEqual(removeBillDelivery(list, 'BD-2').map((item) => item.id), ['BD-1', 'BD-3']);
  assert.equal(removeBillDelivery(list, '').length, 3);
});

test('sorted by delivery date, then bill', () => {
  assert.deepEqual(billDeliveriesSorted([deliveryA, deliveryB, deliveryC]).map((item) => item.id), ['BD-3', 'BD-2', 'BD-1']);
});

test('customer filter is a case-insensitive substring', () => {
  assert.deepEqual(billDeliveriesForCustomer([deliveryA, deliveryB, deliveryC], 'c-1').map((item) => item.id), ['BD-3', 'BD-1']);
  assert.equal(billDeliveriesForCustomer([deliveryA, deliveryB], '').length, 2);
});

test('bill filter is a case-insensitive substring', () => {
  assert.deepEqual(billDeliveriesForBill([deliveryA, deliveryB, deliveryC], '2026-10').map((item) => item.id), ['BD-3']);
});

test('bill text shows method, deliverer, and date — or plainly Undelivered', () => {
  assert.equal(billDeliveryText(deliveryA), 'Handed in person by Saad on 2026-11-03');
  assert.equal(billDeliveryText(null), 'Undelivered');
  assert.equal(billDeliveryText({ ...deliveryA, method: 'email' }), 'Undelivered');
});

test('summary text counts deliveries by method', () => {
  assert.equal(billDeliverySummaryText([]), 'No bill deliveries recorded.');
  assert.equal(billDeliverySummaryText([deliveryA, deliveryB, deliveryC]), '3 bill deliveries recorded (1 handed in person, 1 by message, 1 paper left at premises).');
});

test('undelivered bills: delivered bills excluded, sorted by due date', () => {
  const bills = [
    { billId: 'C-3 · 2026-11', dueDate: '2026-11-05' },
    { billId: 'C-1 · 2026-11', dueDate: '2026-11-05' },
    { billId: 'C-4 · 2026-11', dueDate: '2026-11' },
  ];
  assert.deepEqual(undeliveredBills([deliveryA], bills).map((bill) => bill.billId), ['C-4 · 2026-11', 'C-3 · 2026-11']);
  assert.deepEqual(undeliveredBills([], null), []);
});

test('chase list: only undelivered bills whose due date is still ahead', () => {
  const bills = [
    { billId: 'C-3 · 2026-11', dueDate: '2026-11-05' },
    { billId: 'C-4 · 2026-11', dueDate: '2026-11-02' },
    { billId: 'C-5 · 2026-11', dueDate: '' },
  ];
  assert.deepEqual(undeliveredBillsBeforeDue([], bills, '2026-11-03').map((bill) => bill.billId), ['C-3 · 2026-11']);
  assert.deepEqual(undeliveredBillsBeforeDue([], bills, 'not-a-date'), []);
  assert.equal(undeliveredBillsText([], bills, '2026-11-03'), 'C-3 · 2026-11 (due 2026-11-05)');
  assert.equal(undeliveredBillsText([], bills, '2026-11-30'), 'No undelivered bills before their due date.');
});

test('HTML escapes values, CSV and filename are stable', () => {
  const tricky = { ...deliveryA, deliveredBy: '<Saad & Co>' };
  assert.match(billDeliveryHtml([tricky]), /&lt;Saad &amp; Co&gt;/);
  assert.equal(billDeliveryHtml([]), '');
  const csv = billDeliveryCsv([deliveryA]);
  assert.ok(csv.startsWith('bill,customer,method,delivered by,date,record id'));
  assert.match(csv, /Handed in person/);
  assert.equal(billDeliveryFilename(), 'bill-deliveries.csv');
});

test('inputs never mutated by record, remove, or sort', () => {
  const before = [deliveryA, deliveryB];
  const snapshot = JSON.stringify(before);
  recordBillDelivery(before, deliveryC);
  removeBillDelivery(before, 'BD-1');
  billDeliveriesSorted(before);
  assert.equal(JSON.stringify(before), snapshot);
  assert.equal(JSON.stringify(deliveryA), JSON.stringify({ id: 'BD-1', billId: 'C-1 · 2026-11', customerId: 'C-1', method: 'in-person', deliveredBy: 'Saad', date: '2026-11-03' }));
});

test('purity fence: no storage, clock, network, or neighbouring-module import', () => {
  assert.doesNotMatch(moduleSrc, /localStorage|new Date\(|fetch\(|import /);
  assert.doesNotMatch(moduleSrc, /from '\.\/receipt-delivery\.js'|from '\.\/statement-draft\.js'/);
});

test('panel ids present in index.html and wiring present in app.js', () => {
  for (const id of ['bdHeading', 'bdSummary', 'bdBill', 'bdCustomer', 'bdMethod', 'bdDeliverer', 'bdDate', 'bdSaveBtn', 'bdRemoveId', 'bdRemoveBtn', 'bdBody', 'bdCustomerFilter', 'bdBillFilter', 'bdUndeliveredBody', 'bdReferenceDate', 'bdExportBtn']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
  assert.match(appJs, /shahdara_bill_deliveries_v1/);
  assert.match(appJs, /renderBillDeliveries\(\)/);
  assert.match(appJs, /bill-delivery\.js/);
});

test('deployment guard: no standalone OLT word added to app.js by this plan', () => {
  const matches = appJs.match(/(?<![A-Z])OLT(?![A-Z])/g) || [];
  assert.equal(matches.length, 0);
});
