import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validBillingAddressDate,
  normalizeBillingAddressList,
  recordBillingAddress,
  removeBillingAddress,
  findBillingAddress,
  billingAddressesSorted,
  billingAddressesForCustomer,
  deliveryAddressFor,
  billingAddressDiffers,
  billingAddressSideBySideText,
  billingAddressText,
  billingAddressSummaryText,
  billingAddressEntryHtml,
  billingAddressHtml,
  billingAddressCsv,
  billingAddressFilename,
} from '../billing-address.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'billing-address.js'), 'utf8');
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');

const a1 = { id: 'BA-1', customer: 'Ahmed', billingAddress: 'Shop 4, Main Bazaar', dateEffective: '2026-01-01', note: 'Lives at the connected house; pays from the shop.' };
const a2 = { id: 'BA-2', customer: 'Bilal', billingAddress: 'House 9, Street 2', dateEffective: '2026-03-01', note: '' };

test('half-formed refusal, including no customer', () => {
  assert.equal(recordBillingAddress([], { id: 'BA-x', billingAddress: 'Somewhere', dateEffective: '2026-01-01' }), null);
  assert.equal(recordBillingAddress([], { id: 'BA-x', customer: 'Ahmed', dateEffective: '2026-01-01' }), null);
  assert.equal(recordBillingAddress([], { id: 'BA-x', customer: 'Ahmed', billingAddress: 'Somewhere' }), null);
  assert.equal(recordBillingAddress([], { customer: 'Ahmed', billingAddress: 'Somewhere', dateEffective: '2026-01-01' }), null);
});

test('strict dates', () => {
  assert.equal(validBillingAddressDate('2026-02-30'), false);
  assert.equal(validBillingAddressDate('2024-02-29'), true);
  assert.equal(validBillingAddressDate('2026-02-29'), false);
  assert.equal(validBillingAddressDate('2026-13-01'), false);
  assert.equal(recordBillingAddress([], { ...a1, dateEffective: '2026-02-30' }), null);
});

test('unknown-field drop and non-mutation', () => {
  const input = { ...a1, serviceAddress: 'House 1', moved: true };
  const next = recordBillingAddress([], input);
  assert.equal(next.length, 1);
  assert.equal('serviceAddress' in next[0], false);
  assert.equal('moved' in next[0], false);
  assert.equal(input.serviceAddress, 'House 1');
  assert.equal(next[0].note, a1.note);
});

test('duplicate-id and one-record-per-customer rules', () => {
  assert.equal(recordBillingAddress([a1], { ...a2, id: 'BA-1' }), null);
  assert.equal(recordBillingAddress([a1], { ...a2, customer: 'ahmed' }), null);
  assert.equal(recordBillingAddress([a1], a2).length, 2);
});

test('find and remove', () => {
  assert.equal(findBillingAddress([a1, a2], 'AHMED').id, 'BA-1');
  assert.equal(findBillingAddress([a1, a2], 'Noor'), null);
  assert.equal(removeBillingAddress([a1, a2], 'BA-1').length, 1);
  assert.equal(removeBillingAddress([a1, a2], 'BA-9').length, 2);
  assert.equal(removeBillingAddress([a1, a2], '').length, 2);
});

test('sorting and customer filter', () => {
  const sorted = billingAddressesSorted([a2, a1]);
  assert.deepEqual(sorted.map((item) => item.id), ['BA-1', 'BA-2']);
  assert.equal(billingAddressesForCustomer([a1, a2], 'ahm').length, 1);
  assert.equal(billingAddressesForCustomer([a1, a2], '').length, 2);
});

test('delivery address uses billing address where set', () => {
  assert.equal(deliveryAddressFor([a1, a2], 'Ahmed', 'House 1, Street 1'), 'Shop 4, Main Bazaar');
  assert.equal(deliveryAddressFor([a1, a2], 'Noor', 'House 5, Street 3'), 'House 5, Street 3');
  assert.equal(deliveryAddressFor([], 'Ahmed', 'House 1, Street 1'), 'House 1, Street 1');
});

test('differs check', () => {
  assert.equal(billingAddressDiffers('Shop 4, Main Bazaar', 'House 1, Street 1'), true);
  assert.equal(billingAddressDiffers('House 1, Street 1', 'house 1, street 1'), false);
  assert.equal(billingAddressDiffers('Shop 4', ''), true);
  assert.equal(billingAddressDiffers('', 'House 1'), false);
});

test('side-by-side text, with and without a billing address', () => {
  const withRecord = billingAddressSideBySideText('House 1, Street 1', a1);
  assert.match(withRecord, /Service address: House 1, Street 1/);
  assert.match(withRecord, /Billing address \(from 2026-01-01\): Shop 4, Main Bazaar/);
  assert.match(withRecord, /Differs from the service address/);
  assert.match(withRecord, /Lives at the connected house/);
  const without = billingAddressSideBySideText('House 5, Street 3', null);
  assert.match(without, /Billing address: none set/);
  assert.match(without, /bills go to the service address/);
  const same = billingAddressSideBySideText('Shop 4, Main Bazaar', a1);
  assert.match(same, /Same as the service address/);
});

test('summary and record text', () => {
  assert.equal(billingAddressSummaryText([]), 'No billing addresses recorded.');
  assert.equal(billingAddressSummaryText([a1]), '1 customer has a separate billing address.');
  assert.equal(billingAddressSummaryText([a1, a2]), '2 customers have separate billing addresses.');
  assert.match(billingAddressText(a1), /Ahmed — bills to Shop 4, Main Bazaar/);
});

test('HTML escaping', () => {
  const nasty = { ...a1, billingAddress: '<script>alert(1)</script>', note: 'A & B' };
  const html = billingAddressEntryHtml(nasty, 'House 1');
  assert.equal(html.includes('<script>'), false);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /A &amp; B/);
  assert.match(billingAddressHtml([a1]), /Ahmed/);
});

test('CSV and filename', () => {
  const csv = billingAddressCsv([a2, a1]);
  assert.equal(csv.split('\n')[0], 'id,customer,billing_address,date_effective,note');
  assert.match(csv, /BA-1,Ahmed/);
  assert.equal(billingAddressFilename(), 'billing-addresses.csv');
});

test('list normalisation drops bad and duplicate entries', () => {
  const clean = normalizeBillingAddressList([a1, { ...a2, id: 'BA-1' }, null, { customer: 'Noor' }, a2]);
  assert.deepEqual(clean.map((item) => item.id), ['BA-1', 'BA-2']);
  assert.deepEqual(normalizeBillingAddressList('not a list'), []);
});

test('purity fence: no storage, clock, or network in the module', () => {
  assert.equal(/localStorage|sessionStorage/.test(moduleSrc), false);
  assert.equal(/new Date\(|Date\.now\(/.test(moduleSrc), false);
  assert.equal(/fetch\(|XMLHttpRequest/.test(moduleSrc), false);
});

test('neighbour-module fence: move and delivery modules are not read or rewritten', () => {
  assert.equal(/move-transfers|bill-delivery/.test(moduleSrc), false);
  assert.equal(/import /.test(moduleSrc), false);
});

test('panel ids present in index.html', () => {
  for (const id of ['baBody', 'baSummary', 'baCustomer', 'baAddress', 'baDateEffective', 'baNote', 'baSaveBtn', 'baRemoveId', 'baRemoveBtn', 'baCustomerFilter', 'baServiceAddress', 'baShowBtn', 'baSideBySide', 'baExportBtn']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing index.html id ${id}`);
  }
});

test('app.js wiring', () => {
  assert.ok(appJs.includes("from './billing-address.js'"));
  assert.ok(appJs.includes('renderBillingAddresses()'));
  assert.ok(appJs.includes('shahdara_billing_addresses_v1'));
});

test('deployment guard: no standalone OLT word added to app.js', () => {
  const standalone = appJs.match(/(?<![A-Za-z])OLT(?![A-Za-z])/g) || [];
  assert.equal(standalone.length, 0);
});
