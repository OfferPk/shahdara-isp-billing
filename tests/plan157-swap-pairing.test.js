import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeSwapPairing,
  normalizeSwapPairingList,
  findSwapPairing,
  upsertSwapPairing,
  removeSwapPairing,
  customerSwaps,
  swapPairingCustomers,
  swapPairingSummaryText,
  swapPairingAllHtml,
  swapPairingCustomerHtml,
  swapPairingCsv,
  swapPairingFilename,
} from '../swap-pairing.js';

const dir = dirname(fileURLToPath(import.meta.url));

const record = (over = {}) => ({
  id: 'S-1',
  customer: 'Ahmed Khan',
  oldUnit: 'ONU-OLD-001',
  newUnit: 'ONU-NEW-002',
  date: '2026-11-04',
  reason: 'Old unit overheating',
  ...over,
});

test('strict dates: real calendar dates pass, impossible dates refused', () => {
  assert.equal(normalizeSwapPairing(record({ date: '2026-08-31' })).date, '2026-08-31');
  assert.equal(normalizeSwapPairing(record({ date: '2026-10-31' })).date, '2026-10-31');
  assert.equal(normalizeSwapPairing(record({ date: '2026-12-31' })).date, '2026-12-31');
  assert.equal(normalizeSwapPairing(record({ date: '2024-02-29' })).date, '2024-02-29');
  assert.equal(normalizeSwapPairing(record({ date: '2026-02-30' })), null);
  assert.equal(normalizeSwapPairing(record({ date: '2026-02-29' })), null);
  assert.equal(normalizeSwapPairing(record({ date: '2026-04-31' })), null);
  assert.equal(normalizeSwapPairing(record({ date: '2026-13-01' })), null);
  assert.equal(normalizeSwapPairing(record({ date: '04-11-2026' })), null);
});

test('half-formed refusal: no customer, no old, no new, no date, no id', () => {
  assert.equal(normalizeSwapPairing(record({ customer: '' })), null);
  assert.equal(normalizeSwapPairing(record({ customer: '   ' })), null);
  assert.equal(normalizeSwapPairing(record({ oldUnit: '' })), null);
  assert.equal(normalizeSwapPairing(record({ newUnit: '' })), null);
  assert.equal(normalizeSwapPairing(record({ date: '' })), null);
  assert.equal(normalizeSwapPairing(record({ id: '' })), null);
  assert.equal(normalizeSwapPairing(record({ reason: '' })).reason, '');
  assert.deepEqual(normalizeSwapPairingList([record(), record({ oldUnit: '' }), null, 'x']), [record()]);
});

test('unknown fields dropped, so a record can never grow another record type field', () => {
  const clean = normalizeSwapPairing(record({ warrantyId: 'W-9', paymentId: 'P-9', ticketId: 'T-9' }));
  assert.deepEqual(Object.keys(clean).sort(), ['customer', 'date', 'id', 'newUnit', 'oldUnit', 'reason']);
});

test('duplicate ids never rewritten', () => {
  const list = [record()];
  assert.deepEqual(upsertSwapPairing(list, record()), list);
  assert.deepEqual(upsertSwapPairing(list, record({ newUnit: 'ONU-NEW-999' })), list);
  assert.equal(upsertSwapPairing(list, record({ id: 'S-2' })).length, 2);
});

test('find and remove', () => {
  const list = [record(), record({ id: 'S-2', newUnit: 'RT-NEW-1' })];
  assert.equal(findSwapPairing(list, 'S-2').newUnit, 'RT-NEW-1');
  assert.equal(findSwapPairing(list, 'S-9'), null);
  assert.deepEqual(removeSwapPairing(list, 'S-1').map((item) => item.id), ['S-2']);
  assert.deepEqual(removeSwapPairing(list, 'S-9'), list);
});

test('customer swaps in date order, case-insensitive match', () => {
  const list = [
    record({ id: 'S-3', date: '2026-11-10' }),
    record({ id: 'S-1', date: '2026-11-04' }),
    record({ id: 'S-2', date: '2026-11-04' }),
    record({ id: 'S-4', customer: 'Bilal Ahmed', date: '2026-11-01' }),
  ];
  assert.deepEqual(customerSwaps(list, 'ahmed khan').map((item) => item.id), ['S-1', 'S-2', 'S-3']);
  assert.deepEqual(customerSwaps(list, 'AHMED KHAN').map((item) => item.id), ['S-1', 'S-2', 'S-3']);
  assert.deepEqual(customerSwaps(list, ''), []);
  assert.deepEqual(customerSwaps(list, 'nobody'), []);
});

test('customers list A-Z, first spelling kept', () => {
  const list = [
    record({ customer: 'bilal ahmed' }),
    record({ customer: 'Ahmed Khan' }),
    record({ customer: 'Bilal Ahmed' }),
  ];
  assert.deepEqual(swapPairingCustomers(list), ['Ahmed Khan', 'bilal ahmed']);
});

test('summary text', () => {
  assert.equal(swapPairingSummaryText([]), '0 swap pairs across 0 customers.');
  assert.equal(swapPairingSummaryText([record()]), '1 swap pair across 1 customer.');
  assert.equal(swapPairingSummaryText([record(), record({ id: 'S-2', customer: 'Bilal' })]), '2 swap pairs across 2 customers.');
});

test('customer HTML: pairs in date order, plain empty states', () => {
  const list = [record({ id: 'S-2', date: '2026-11-10' }), record({ id: 'S-1', date: '2026-11-04' })];
  const html = swapPairingCustomerHtml(list, 'Ahmed Khan');
  assert.match(html, /Swap pairs for Ahmed Khan, in date order/);
  assert.match(html, /ONU-NEW-002/);
  assert.match(swapPairingCustomerHtml(list, 'nobody'), /No equipment swap recorded for nobody/);
  assert.match(swapPairingCustomerHtml(list, ''), /Pick a customer/);
});

test('all HTML in date order', () => {
  const list = [record({ id: 'S-2', date: '2026-11-10' }), record({ id: 'S-1', date: '2026-11-04' })];
  const html = swapPairingAllHtml(list);
  assert.match(html, /All equipment swap pairings, in date order/);
  assert.ok(html.indexOf('2026-11-04') < html.indexOf('2026-11-10'));
  assert.match(swapPairingAllHtml([]), /No equipment swaps recorded yet/);
});

test('HTML escaping: markup in fields never renders as markup', () => {
  const list = [record({ customer: '<b>Ahmed</b>', oldUnit: 'A & B' })];
  const html = swapPairingAllHtml(list);
  assert.doesNotMatch(html, /<b>Ahmed<\/b>/);
  assert.match(html, /&lt;b&gt;Ahmed&lt;\/b&gt;/);
  assert.match(html, /A &amp; B/);
});

test('CSV and filename', () => {
  const list = [record({ customer: 'Ahmed, "senior"', reason: 'Faulty, replaced' })];
  const csv = swapPairingCsv(list);
  assert.match(csv, /^id,customer,oldUnit,newUnit,date,reason\n/);
  assert.match(csv, /"Ahmed, ""senior"""/);
  assert.equal(swapPairingFilename(), 'swap-pairings.csv');
});

test('inputs never mutated', () => {
  const input = record({ extra: 'x' });
  const snapshot = JSON.stringify(input);
  const list = [input];
  upsertSwapPairing(list, record({ id: 'S-2' }));
  removeSwapPairing(list, 'S-1');
  customerSwaps(list, 'Ahmed Khan');
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(JSON.stringify(list), JSON.stringify([input]));
});

test('purity fence: module never reads storage, the clock, or the network, and never imports', () => {
  const source = readFileSync(join(dir, '..', 'swap-pairing.js'), 'utf8');
  assert.doesNotMatch(source, /localStorage|sessionStorage|Date\.now|new Date\(|fetch\(|XMLHttpRequest/);
  assert.doesNotMatch(source, /^import /m);
});

test('panel ids present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of [
    'swapBody', 'swapCustomerBody', 'swapSummary',
    'swapCustomer', 'swapOldUnit', 'swapNewUnit', 'swapDate', 'swapReason',
    'swapSaveBtn', 'swapRemoveId', 'swapRemoveBtn',
    'swapFilter', 'swapExportBtn',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
