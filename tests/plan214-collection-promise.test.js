import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeCollectionPromise,
  normalizeCollectionPromiseList,
  findCollectionPromise,
  recordCollectionPromise,
  removeCollectionPromise,
  recordCollectionPromisePayment,
  collectionPromisesSorted,
  collectionPromisesForCustomer,
  collectionPromiseStatus,
  collectionPromiseCountsForCustomer,
  collectionPromiseText,
  collectionPromiseSummaryText,
  collectionPromiseHtml,
  collectionPromiseAllHtml,
  collectionPromiseCsv,
  collectionPromiseFilename,
} from '../collection-promise.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'collection-promise.js'), 'utf8');

const promiseA = { id: 'CP-1', customer: 'Ahmed', amountPromised: 1500, promisedDate: '2026-11-06', collector: 'Saad' };
const promiseB = { id: 'CP-2', customer: 'Ahmed', amountPromised: 2000, promisedDate: '2026-11-03', paidDate: '2026-11-03', amountPaid: 2000, collector: 'Saad' };
const promiseC = { id: 'CP-3', customer: 'Bilal', amountPromised: 1000, promisedDate: '2026-11-10', collector: 'Saad' };

test('half-formed promises are refused', () => {
  assert.equal(normalizeCollectionPromise({ id: 'CP-9', amountPromised: 1500, promisedDate: '2026-11-06' }), null);
  assert.equal(normalizeCollectionPromise({ id: 'CP-9', customer: 'Ahmed', promisedDate: '2026-11-06' }), null);
  assert.equal(normalizeCollectionPromise({ id: 'CP-9', customer: 'Ahmed', amountPromised: 1500 }), null);
  assert.equal(normalizeCollectionPromise({ customer: 'Ahmed', amountPromised: 1500, promisedDate: '2026-11-06' }), null);
  assert.equal(normalizeCollectionPromise({ ...promiseA, amountPromised: 0 }), null);
  assert.equal(normalizeCollectionPromise({ ...promiseA, amountPromised: -50 }), null);
  assert.equal(normalizeCollectionPromise({ ...promiseA, amountPromised: 'lots' }), null);
});

test('strict calendar dates: 31-day months, Feb 29 leap and non-leap', () => {
  assert.equal(normalizeCollectionPromise({ ...promiseA, promisedDate: '2026-08-31' }).promisedDate, '2026-08-31');
  assert.equal(normalizeCollectionPromise({ ...promiseA, promisedDate: '2026-08-32' }), null);
  assert.equal(normalizeCollectionPromise({ ...promiseA, promisedDate: '2026-02-30' }), null);
  assert.equal(normalizeCollectionPromise({ ...promiseA, promisedDate: '2024-02-29' }).promisedDate, '2024-02-29');
  assert.equal(normalizeCollectionPromise({ ...promiseA, promisedDate: '2026-02-29' }), null);
  assert.equal(normalizeCollectionPromise({ ...promiseA, promisedDate: '2026-13-01' }), null);
  assert.equal(normalizeCollectionPromise({ ...promiseA, promisedDate: '2026-1-02' }), null);
});

test('unknown fields are dropped, so no bill, payment, due-date, or status field can creep in', () => {
  const clean = normalizeCollectionPromise({ ...promiseA, billId: 'B-1', dueDate: '2026-11-20', waadaId: 'W-1', sendsMessage: true });
  assert.deepEqual(Object.keys(clean).sort(), ['amountPaid', 'amountPromised', 'collector', 'customer', 'id', 'paidDate', 'promisedDate']);
});

test('an unpaid promise normalizes with empty paid date and null paid amount', () => {
  assert.deepEqual(normalizeCollectionPromise(promiseA), { ...promiseA, paidDate: '', amountPaid: null });
});

test('a bad paid date is dropped, and a paid date without a valid amount keeps amount null', () => {
  assert.equal(normalizeCollectionPromise({ ...promiseB, paidDate: '2026-13-03' }).paidDate, '');
  assert.equal(normalizeCollectionPromise({ ...promiseB, paidDate: '2026-13-03' }).amountPaid, null);
  assert.equal(normalizeCollectionPromise({ ...promiseB, amountPaid: 'lots' }).amountPaid, null);
});

test('duplicate ids are never rewritten', () => {
  const list = [promiseA];
  assert.deepEqual(recordCollectionPromise(list, { ...promiseA, amountPromised: 9999 }), [normalizeCollectionPromise(promiseA)]);
  assert.equal(recordCollectionPromise(list, { ...promiseA, id: 'CP-2' }).length, 2);
});

test('find and remove by id', () => {
  const list = [promiseA, promiseB];
  assert.equal(findCollectionPromise(list, 'CP-2').customer, 'Ahmed');
  assert.equal(findCollectionPromise(list, 'CP-9'), null);
  assert.equal(findCollectionPromise(list, ''), null);
  assert.deepEqual(removeCollectionPromise(list, 'CP-1'), [promiseB]);
  assert.deepEqual(removeCollectionPromise(list, ''), [normalizeCollectionPromise(promiseA), promiseB]);
});

test('recording a payment fills date and amount only for an unpaid promise', () => {
  const paid = recordCollectionPromisePayment([promiseA], 'CP-1', '2026-11-05', 1500);
  assert.equal(paid[0].paidDate, '2026-11-05');
  assert.equal(paid[0].amountPaid, 1500);
  assert.deepEqual(recordCollectionPromisePayment([promiseA], 'CP-1', '2026-13-05', 1500), [normalizeCollectionPromise(promiseA)]);
  assert.deepEqual(recordCollectionPromisePayment([promiseA], 'CP-1', '2026-11-05', 0), [normalizeCollectionPromise(promiseA)]);
  assert.deepEqual(recordCollectionPromisePayment([promiseB], 'CP-2', '2026-11-04', 2000), [promiseB]);
  assert.deepEqual(recordCollectionPromisePayment([promiseA], 'CP-9', '2026-11-05', 1500), [normalizeCollectionPromise(promiseA)]);
});

test('promises sort by promised date, then customer, then id', () => {
  const sorted = collectionPromisesSorted([promiseC, promiseB, promiseA]);
  assert.deepEqual(sorted.map((record) => record.id), ['CP-2', 'CP-1', 'CP-3']);
});

test('promises for one customer match case-insensitively and ignore other customers', () => {
  assert.deepEqual(collectionPromisesForCustomer([promiseA, promiseB, promiseC], 'ahmed').map((record) => record.id), ['CP-2', 'CP-1']);
  assert.deepEqual(collectionPromisesForCustomer([promiseA, promiseB, promiseC], 'Bilal').map((record) => record.id), ['CP-3']);
  assert.deepEqual(collectionPromisesForCustomer([promiseA, promiseB, promiseC], ''), []);
});

test('status: paid, unkept once the date passes, open otherwise', () => {
  assert.equal(collectionPromiseStatus(promiseB, '2026-11-05'), 'paid');
  assert.equal(collectionPromiseStatus(promiseA, '2026-11-05'), 'open');
  assert.equal(collectionPromiseStatus(promiseA, '2026-11-06'), 'open');
  assert.equal(collectionPromiseStatus(promiseA, '2026-11-07'), 'unkept');
  assert.equal(collectionPromiseStatus(promiseC, '2026-11-07'), 'open');
  assert.equal(collectionPromiseStatus({ ...promiseB, paidDate: '2026-11-04' }, '2026-11-05'), 'paid');
});

test('kept and unkept counts per customer', () => {
  assert.deepEqual(collectionPromiseCountsForCustomer([promiseA, promiseB, promiseC], 'Ahmed', '2026-11-07'), { kept: 1, unkept: 1, open: 0, total: 2 });
  assert.deepEqual(collectionPromiseCountsForCustomer([promiseA, promiseB, promiseC], 'Bilal', '2026-11-07'), { kept: 0, unkept: 0, open: 1, total: 1 });
  assert.deepEqual(collectionPromiseCountsForCustomer([promiseA, promiseB, promiseC], 'Nobody', '2026-11-07'), { kept: 0, unkept: 0, open: 0, total: 0 });
});

test('promise text shows promised against actual, or plainly as unkept', () => {
  assert.match(collectionPromiseText(promiseB, '2026-11-05'), /promised by 2026-11-03/);
  assert.match(collectionPromiseText(promiseB, '2026-11-05'), /paid on 2026-11-03/);
  assert.match(collectionPromiseText(promiseA, '2026-11-07'), /unkept, still unpaid/);
  assert.match(collectionPromiseText(promiseA, '2026-11-05'), /still open/);
  assert.match(collectionPromiseText({ ...promiseB, paidDate: '2026-11-04' }, '2026-11-05'), /paid late/);
  assert.equal(collectionPromiseText(null, '2026-11-05'), '');
});

test('summary text counts kept, unkept, and open across all promises', () => {
  assert.equal(collectionPromiseSummaryText([], '2026-11-07'), 'No collection promises recorded.');
  assert.equal(collectionPromiseSummaryText([promiseA, promiseB, promiseC], '2026-11-07'), '3 collection promise(s): 1 kept, 1 unkept, 1 still open.');
});

test('html escapes customer and collector names', () => {
  const html = collectionPromiseHtml({ ...promiseA, customer: '<b>Ahmed</b>', collector: '<i>Saad</i>' }, '2026-11-05');
  assert.doesNotMatch(html, /<b>Ahmed<\/b>/);
  assert.match(html, /&lt;b&gt;Ahmed&lt;\/b&gt;/);
  assert.match(html, /status: open/);
  assert.match(collectionPromiseAllHtml([promiseA], '2026-11-05'), /Ahmed/);
});

test('csv export and filename', () => {
  const csv = collectionPromiseCsv([promiseA, promiseB], '2026-11-07');
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,customer,amount_promised,promised_date,paid_date,amount_paid,collector,status');
  assert.match(lines[1], /CP-2,Ahmed,2000,2026-11-03,2026-11-03,2000,Saad,paid/);
  assert.match(lines[2], /CP-1,Ahmed,1500,2026-11-06,,,Saad,unkept/);
  assert.equal(collectionPromiseFilename(), 'collection-promises.csv');
});

test('inputs are never mutated', () => {
  const input = [promiseA, promiseB];
  const snapshot = JSON.stringify(input);
  recordCollectionPromise(input, promiseC);
  removeCollectionPromise(input, 'CP-1');
  recordCollectionPromisePayment(input, 'CP-1', '2026-11-05', 1500);
  collectionPromisesSorted(input);
  collectionPromiseCountsForCustomer(input, 'Ahmed', '2026-11-07');
  assert.equal(JSON.stringify(input), snapshot);
});

test('list normalization drops bad entries and later duplicates', () => {
  assert.deepEqual(normalizeCollectionPromiseList(null), []);
  assert.deepEqual(normalizeCollectionPromiseList([null, promiseA, { ...promiseA, amountPromised: 9999 }, promiseB]), [normalizeCollectionPromise(promiseA), promiseB]);
});

test('purity fence: the module is import-free and touches no storage, clock, or network', () => {
  assert.doesNotMatch(moduleSrc, /^import\s/m);
  assert.doesNotMatch(moduleSrc, /localStorage|fetch\(|Date\.now|new Date\(/);
});

test('panel element ids are present in index.html', () => {
  for (const id of ['cpSummary', 'cpExportBtn', 'cpCustomer', 'cpAmount', 'cpPromisedDate', 'cpCollector', 'cpSaveBtn', 'cpPayId', 'cpPaidDate', 'cpPaidAmount', 'cpPayBtn', 'cpRemoveId', 'cpRemoveBtn', 'cpCustomerFilter', 'cpBody']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring mentions the collection-promise store and render function', () => {
  assert.match(appJs, /shahdara_collection_promises_v2/);
  assert.match(appJs, /renderCollectionPromises\(\)/);
  assert.match(appJs, /collection-promise\.js/);
});

test('deployment guard: no standalone OLT word added to app.js by this plan', () => {
  const matches = appJs.match(/(?<![A-Z])OLT(?![A-Z])/g) || [];
  assert.equal(matches.length, 0);
});
