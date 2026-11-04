import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeInfoSheet,
  normalizeInfoSheetList,
  findInfoSheet,
  upsertInfoSheet,
  removeInfoSheet,
  infoSheetForCustomer,
  infoSheetCustomers,
  infoSheetSummaryText,
  infoSheetHtml,
  infoSheetAllHtml,
  infoSheetCustomerHtml,
  infoSheetCsv,
  infoSheetFilename,
} from '../info-sheet.js';

const dir = dirname(fileURLToPath(import.meta.url));

const sheet = (over = {}) => ({
  id: 'IS-1',
  customer: 'Ahmed',
  packageName: '20 Mbps',
  monthlyRate: 1500,
  mohalla: 'Mohalla A',
  contactRoute: 'Shop, main bazaar',
  printedDate: '2026-11-04',
  ...over,
});

test('plan165: strict dates (31-day months, Feb 29 leap/non-leap, impossible dates)', () => {
  assert.ok(normalizeInfoSheet(sheet({ printedDate: '2026-08-31' })));
  assert.ok(normalizeInfoSheet(sheet({ printedDate: '2026-10-31' })));
  assert.ok(normalizeInfoSheet(sheet({ printedDate: '2026-12-31' })));
  assert.ok(normalizeInfoSheet(sheet({ printedDate: '2024-02-29' })));
  assert.equal(normalizeInfoSheet(sheet({ printedDate: '2026-02-29' })), null);
  assert.equal(normalizeInfoSheet(sheet({ printedDate: '2026-02-30' })), null);
  assert.equal(normalizeInfoSheet(sheet({ printedDate: '2026-04-31' })), null);
  assert.equal(normalizeInfoSheet(sheet({ printedDate: '2026-13-01' })), null);
  assert.equal(normalizeInfoSheet(sheet({ printedDate: '04-11-2026' })), null);
});

test('plan165: half-formed sheet refused (no id, customer, package, rate, or date)', () => {
  assert.equal(normalizeInfoSheet(sheet({ id: '  ' })), null);
  assert.equal(normalizeInfoSheet(sheet({ customer: '' })), null);
  assert.equal(normalizeInfoSheet(sheet({ packageName: '  ' })), null);
  assert.equal(normalizeInfoSheet(sheet({ monthlyRate: undefined })), null);
  assert.equal(normalizeInfoSheet(sheet({ monthlyRate: -50 })), null);
  assert.equal(normalizeInfoSheet(sheet({ monthlyRate: 'free' })), null);
  assert.equal(normalizeInfoSheet(sheet({ printedDate: '' })), null);
  assert.equal(normalizeInfoSheet(null), null);
});

test('plan165: monthly rate accepts numeric strings, zero is a usable rate', () => {
  assert.equal(normalizeInfoSheet(sheet({ monthlyRate: '1500' })).monthlyRate, 1500);
  assert.equal(normalizeInfoSheet(sheet({ monthlyRate: 0 })).monthlyRate, 0);
});

test('plan165: unknown fields dropped — no bill history or payment field can creep in', () => {
  const clean = normalizeInfoSheet(sheet({
    billHistory: [{ month: '2026-10', amount: 1500 }],
    payments: [{ amount: 1500 }],
    dueDate: '2026-11-05',
    balance: 3000,
    status: 'active',
  }));
  assert.ok(clean);
  assert.equal(clean.billHistory, undefined);
  assert.equal(clean.payments, undefined);
  assert.equal(clean.dueDate, undefined);
  assert.equal(clean.balance, undefined);
  assert.equal(clean.status, undefined);
  assert.deepEqual(Object.keys(clean).sort(), ['contactRoute', 'customer', 'id', 'mohalla', 'monthlyRate', 'packageName', 'printedDate']);
});

test('plan165: duplicate ids never rewritten', () => {
  const base = upsertInfoSheet([], sheet());
  assert.equal(upsertInfoSheet(base, sheet()).length, 1);
  assert.equal(upsertInfoSheet(base, sheet({ monthlyRate: 2000 })).length, 1);
  assert.equal(upsertInfoSheet(base, sheet({ monthlyRate: 2000 }))[0].monthlyRate, 1500);
});

test('plan165: one sheet per customer, case-insensitive', () => {
  const base = upsertInfoSheet([], sheet());
  assert.equal(upsertInfoSheet(base, sheet({ id: 'IS-2', customer: 'ahmed' })).length, 1);
  assert.equal(upsertInfoSheet(base, sheet({ id: 'IS-2', customer: 'Bilal' })).length, 2);
});

test('plan165: find and remove', () => {
  const base = upsertInfoSheet([], sheet());
  assert.equal(findInfoSheet(base, 'IS-1').customer, 'Ahmed');
  assert.equal(findInfoSheet(base, 'IS-9'), null);
  assert.equal(removeInfoSheet(base, 'IS-1').length, 0);
  assert.equal(removeInfoSheet(base, '').length, 1);
});

test('plan165: customer view is case-insensitive, customers list A-Z', () => {
  const list = upsertInfoSheet(upsertInfoSheet([], sheet()), sheet({ id: 'IS-2', customer: 'bilal', packageName: '10 Mbps' }));
  assert.equal(infoSheetForCustomer(list, 'AHMED').packageName, '20 Mbps');
  assert.equal(infoSheetForCustomer(list, 'nobody'), null);
  assert.deepEqual(infoSheetCustomers(list), ['Ahmed', 'bilal']);
});

test('plan165: summary text', () => {
  assert.equal(infoSheetSummaryText([]), '0 info sheets for 0 customers');
  assert.equal(infoSheetSummaryText(upsertInfoSheet([], sheet())), '1 info sheet for 1 customer');
});

test('plan165: sheet HTML shows exactly the stored details, printed date, and a blank note space', () => {
  const html = infoSheetHtml(sheet());
  assert.ok(html.includes('Ahmed'));
  assert.ok(html.includes('20 Mbps'));
  assert.ok(html.includes('Rs 1500'));
  assert.ok(html.includes('Mohalla A'));
  assert.ok(html.includes('Shop, main bazaar'));
  assert.ok(html.includes('2026-11-04'));
  assert.ok(html.includes('Handwritten note'));
  assert.ok(!html.includes('bill history'));
  assert.ok(!html.includes('payment'));
  assert.ok(!html.includes('due date'));
  assert.equal(infoSheetHtml(sheet({ customer: '' })), '<p>No info sheet to show.</p>');
});

test('plan165: sheet HTML escapes customer text', () => {
  const html = infoSheetHtml(sheet({ customer: '<script>alert(1)</script>' }));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('plan165: all and customer HTML, empty states', () => {
  assert.equal(infoSheetAllHtml([]), '<p>No info sheets recorded yet.</p>');
  const list = upsertInfoSheet([], sheet());
  assert.ok(infoSheetAllHtml(list).includes('Customer Info Sheet'));
  assert.ok(infoSheetCustomerHtml(list, 'Ahmed').includes('20 Mbps'));
  assert.ok(infoSheetCustomerHtml(list, 'Nobody').includes('No info sheet recorded for Nobody.'));
});

test('plan165: CSV and filename carry only sheet fields', () => {
  const base = upsertInfoSheet([], sheet({ customer: 'Ahmed, Jr' }));
  const csv = infoSheetCsv(base);
  assert.ok(csv.startsWith('id,customer,package,monthly_rate,mohalla,contact_route,printed_date'));
  assert.ok(csv.includes('IS-1,"Ahmed, Jr",20 Mbps,1500,Mohalla A,"Shop, main bazaar",2026-11-04'));
  assert.ok(!csv.includes('bill'));
  assert.equal(infoSheetFilename(), 'shahdara-info-sheets.csv');
});

test('plan165: inputs never mutated', () => {
  const raw = sheet();
  const snapshot = JSON.stringify(raw);
  upsertInfoSheet([], raw);
  normalizeInfoSheetList([raw]);
  assert.equal(JSON.stringify(raw), snapshot);
});

test('plan165: normalize list drops invalid, duplicate-id, and same-customer entries', () => {
  const list = normalizeInfoSheetList([
    sheet(),
    sheet({ id: 'IS-1', monthlyRate: 2000 }),
    sheet({ id: 'IS-2', customer: 'AHMED' }),
    sheet({ id: 'IS-3', customer: 'Bilal' }),
    sheet({ printedDate: '2026-02-30' }),
    null,
  ]);
  assert.equal(list.length, 2);
  assert.equal(list[0].monthlyRate, 1500);
  assert.deepEqual(normalizeInfoSheetList('nope'), []);
});

test('plan165: module stays pure — no storage, clock, or network reads', () => {
  const src = readFileSync(join(dir, '..', 'info-sheet.js'), 'utf8');
  assert.ok(!src.includes('localStorage'));
  assert.ok(!src.includes('fetch('));
  assert.ok(!src.includes('XMLHttpRequest'));
  assert.ok(!src.includes('new Date('));
});

test('plan165: panel element ids present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['isCustomer', 'isPackage', 'isRate', 'isMohalla', 'isContact', 'isPrintedDate',
    'isSaveBtn', 'isRemoveId', 'isRemoveBtn', 'isFilter', 'isPrintBtn', 'isSheetBody',
    'isBody', 'isSummary', 'isExportBtn']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
