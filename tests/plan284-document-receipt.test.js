import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validDocumentReceiptDate,
  normalizeDocumentReceipt,
  normalizeDocumentReceiptList,
  findDocumentReceipt,
  recordDocumentReceipt,
  removeDocumentReceipt,
  documentReceiptSorted,
  documentReceiptsForCustomer,
  documentReceiptCustomers,
  documentReceiptSummaryText,
  documentReceiptText,
  documentReceiptHtml,
  documentReceiptAllHtml,
  documentReceiptCsv,
  documentReceiptFilename,
} from '../document-receipt.js';

const first = { id: 'DR-1', customer: 'Ahmed Raza', documentType: 'CNIC copy', dateReceived: '2026-11-02', receivedBy: 'Saad' };
const second = { id: 'DR-2', customer: 'Ahmed Raza', documentType: 'Connection form', dateReceived: '2026-11-05', receivedBy: 'Saad' };
const third = { id: 'DR-3', customer: 'Bilal Khan', documentType: 'CNIC copy', dateReceived: '2026-11-03', receivedBy: 'Aqib' };

test('half-formed receipt notes are refused', () => {
  assert.deepEqual(recordDocumentReceipt([], { ...first, id: '' }), []);
  assert.deepEqual(recordDocumentReceipt([], { ...first, customer: '  ' }), []);
  assert.deepEqual(recordDocumentReceipt([], { ...first, documentType: '' }), []);
  assert.deepEqual(recordDocumentReceipt([], { ...first, documentType: '   ' }), []);
  assert.deepEqual(recordDocumentReceipt([], { ...first, receivedBy: '' }), []);
  assert.deepEqual(recordDocumentReceipt([], { ...first, dateReceived: '' }), []);
  assert.deepEqual(recordDocumentReceipt([], { ...first, dateReceived: '2026-02-30' }), []);
  const recorded = recordDocumentReceipt([], first);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].documentType, 'CNIC copy');
  assert.equal(recorded[0].receivedBy, 'Saad');
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validDocumentReceiptDate('2026-08-31'), true);
  assert.equal(validDocumentReceiptDate('2026-10-31'), true);
  assert.equal(validDocumentReceiptDate('2026-12-31'), true);
  assert.equal(validDocumentReceiptDate('2026-02-29'), false);
  assert.equal(validDocumentReceiptDate('2028-02-29'), true);
  assert.equal(validDocumentReceiptDate('2026-04-31'), false);
  assert.equal(validDocumentReceiptDate('2026-13-01'), false);
  assert.equal(validDocumentReceiptDate('10-11-2026'), false);
  assert.equal(validDocumentReceiptDate(''), false);
  assert.equal(validDocumentReceiptDate(null), false);
  assert.deepEqual(recordDocumentReceipt([], { ...first, dateReceived: '2026-02-30' }), []);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, billAmount: 1500, customerStatus: 'active', documentImage: 'data:image/png;base64,AAA', surprise: 'x' };
  const recorded = recordDocumentReceipt([], raw);
  assert.equal(recorded.length, 1);
  assert.equal('billAmount' in recorded[0], false);
  assert.equal('customerStatus' in recorded[0], false);
  assert.equal('documentImage' in recorded[0], false);
  assert.equal('surprise' in recorded[0], false);
  assert.equal(raw.billAmount, 1500);
  assert.deepEqual(Object.keys(raw).sort(), ['billAmount', 'customer', 'customerStatus', 'dateReceived', 'documentImage', 'documentType', 'id', 'receivedBy', 'surprise']);
});

test('duplicate ids are never rewritten', () => {
  const list = recordDocumentReceipt([], first);
  assert.deepEqual(recordDocumentReceipt(list, { ...first, documentType: 'Changed.' }), list);
  assert.deepEqual(recordDocumentReceipt(list, { ...second, id: 'DR-1' }), list);
});

test('find and remove', () => {
  const list = [first, second, third].reduce((acc, item) => recordDocumentReceipt(acc, item), []);
  assert.equal(findDocumentReceipt(list, 'DR-2').documentType, 'Connection form');
  assert.equal(findDocumentReceipt(list, 'DR-9'), null);
  assert.equal(findDocumentReceipt(list, ''), null);
  assert.deepEqual(removeDocumentReceipt(list, 'DR-2').map((item) => item.id), ['DR-1', 'DR-3']);
  assert.deepEqual(removeDocumentReceipt(list, ''), list);
});

test('sorting is by date received, then customer, then id', () => {
  const list = [second, third, first].reduce((acc, item) => recordDocumentReceipt(acc, item), []);
  assert.deepEqual(documentReceiptSorted(list).map((item) => item.id), ['DR-1', 'DR-3', 'DR-2']);
});

test('a customer page lists receipt notes by date with type and receiver named', () => {
  const list = [second, first, third].reduce((acc, item) => recordDocumentReceipt(acc, item), []);
  assert.deepEqual(documentReceiptsForCustomer(list, 'ahmed raza').map((item) => item.id), ['DR-1', 'DR-2']);
  assert.deepEqual(documentReceiptsForCustomer(list, 'Bilal Khan').map((item) => item.id), ['DR-3']);
  assert.deepEqual(documentReceiptsForCustomer(list, ''), []);
  assert.deepEqual(documentReceiptsForCustomer(list, 'Nobody'), []);
  const text = documentReceiptText(first);
  assert.equal(text.includes('CNIC copy'), true);
  assert.equal(text.includes('Saad'), true);
  assert.equal(text.includes('2026-11-02'), true);
});

test('customer list keeps the first spelling', () => {
  const list = [
    { id: 'DR-1', customer: 'Ahmed Raza', documentType: 'CNIC copy', dateReceived: '2026-11-02', receivedBy: 'Saad' },
    { id: 'DR-2', customer: 'AHMED RAZA', documentType: 'Connection form', dateReceived: '2026-11-05', receivedBy: 'Saad' },
    { id: 'DR-3', customer: 'Bilal Khan', documentType: 'CNIC copy', dateReceived: '2026-11-03', receivedBy: 'Aqib' },
  ].reduce((acc, item) => recordDocumentReceipt(acc, item), []);
  assert.deepEqual(documentReceiptCustomers(list), ['Ahmed Raza', 'Bilal Khan']);
});

test('summary and entry text name the customer, type, date, and receiver plainly', () => {
  assert.equal(documentReceiptSummaryText([]), 'No document receipts recorded.');
  assert.equal(documentReceiptSummaryText([first, second]), '2 document receipts recorded.');
  assert.equal(documentReceiptSummaryText([first]), '1 document receipt recorded.');
  const text = documentReceiptText(first);
  assert.equal(text.includes('Ahmed Raza'), true);
  assert.equal(text.includes('CNIC copy'), true);
  assert.equal(text.includes('2026-11-02'), true);
  assert.equal(text.includes('Saad'), true);
  assert.equal(documentReceiptText(null), 'No document receipt recorded.');
});

test('html escapes input', () => {
  const evil = { ...first, documentType: '<script>alert(1)</script>' };
  const html = documentReceiptHtml(evil);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(documentReceiptHtml(null), '<p>No document receipt recorded.</p>');
  assert.equal(documentReceiptAllHtml([]), '<p>No document receipts recorded.</p>');
  assert.equal(documentReceiptAllHtml([first]).includes('<ul>'), true);
});

test('csv export and filename', () => {
  const csv = documentReceiptCsv([second, first]);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","customer","document type","date received","received by"');
  assert.equal(lines.length, 3);
  assert.equal(lines[1].includes('DR-1'), true);
  assert.equal(lines[1].includes('CNIC copy'), true);
  assert.equal(documentReceiptFilename(), 'document-receipts.csv');
});

test('list normalisation drops bad rows and keeps the first duplicate', () => {
  const bad = { id: 'DR-9', customer: '', documentType: 'CNIC copy', dateReceived: '2026-11-10', receivedBy: 'Saad' };
  const out = normalizeDocumentReceiptList([bad, first, { ...first, documentType: 'Changed.' }, second, 'nope', null]);
  assert.deepEqual(out.map((item) => item.id), ['DR-1', 'DR-2']);
  assert.equal(out[0].documentType, 'CNIC copy');
  assert.deepEqual(normalizeDocumentReceiptList('nope'), []);
  assert.deepEqual(normalizeDocumentReceiptList(null), []);
  assert.equal(normalizeDocumentReceipt(null), null);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../document-receipt.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
  assert.equal(source.includes('FileReader'), false);
  assert.equal(source.includes('readAsDataURL'), false);
  assert.equal(source.includes('toDataURL'), false);
});

test('neighbour-module fence: the terms acknowledgement record is untouched', () => {
  const source = readFileSync(new URL('../document-receipt.js', import.meta.url), 'utf8');
  assert.equal(source.includes('terms-ack.js'), false, 'module must not reference the terms acknowledgement module');
  assert.equal(source.includes('termsAck'), false, 'module must not reference the terms acknowledgement record');
  assert.equal(existsSync(new URL('../terms-ack.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'docHeading', 'docSummary', 'docList', 'docExportBtn',
    'docCustomer', 'docType', 'docDate', 'docReceivedBy', 'docRecordBtn',
    'docRemoveId', 'docRemoveBtn',
    'docFilterCustomer', 'docFilterBtn', 'docCustomerBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the document receipt panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './document-receipt.js'"), true);
  assert.equal(source.includes('renderDocumentReceipts()'), true);
  assert.equal(source.includes('DOCUMENT_RECEIPT_KEY'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
