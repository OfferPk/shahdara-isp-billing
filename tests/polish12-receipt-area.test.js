// Polish #12 — receipt area and profile Area at the top.
//
// Part 1: the profile edit form carries Area (mohalla) + Zone directly
// after Customer name, so the operator fills it before the rest.
// Part 2: the main payment receipt shows the customer's own area —
// mohalla first, zone after — exactly the PNG receipt's derivation,
// 'Not recorded' when neither is set, never a blank or a guess.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPaymentReceipt, generatePaymentReceiptHtml } from '../receipt.js';
import { buildPngReceiptModel } from '../png-receipt.js';
import { urduReceiptLabel } from '../receipt-script.js';
import { createReceiptWhatsAppDraft } from '../profile-ui.js';
import { PROFILE_FIELD_SAVE_MAP, profileFieldSaveEntry } from '../profile-field-save.js';
import { countProfileCompletion } from '../profile-completion.js';

const dir = dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');

function fixture({ mohalla, zone } = {}) {
  const bill = { id: 'bill-2026-09', month: '2026-09', dueAmount: 2000, status: 'pending', payments: [] };
  const customer = {
    id: 'polish12-customer', customerNumber: 7, name: 'Polish Twelve Customer',
    packageSpeed: '5 Mbps', bills: [bill],
    ...(mohalla === undefined ? {} : { mohalla }),
    ...(zone === undefined ? {} : { zone }),
  };
  const payment = { id: 'p12-pay', amount: 2000, date: '2026-09-05', method: 'Cash' };
  bill.payments = [payment];
  return { customer, bill, payment };
}

function orderOf(id) {
  const at = indexHtml.indexOf(`id="${id}"`);
  assert.ok(at > -1, `${id} exists in the edit form`);
  return at;
}

test('edit form: Area and Zone sit directly after Customer name, before the Urdu name', () => {
  const order = [
    orderOf('profileNameInput'),
    orderOf('mohallaInput'),
    orderOf('zoneInput'),
    orderOf('nameUrduInput'),
    orderOf('fatherOrReferenceNameInput'),
    orderOf('searchAliasesInput'),
  ];
  const sorted = [...order].sort((a, b) => a - b);
  assert.deepEqual(order, sorted, 'Name -> Area -> Zone -> Urdu name -> Father -> Aliases');
  // Same input, same datalist, same Optional note — only the position moved.
  assert.match(indexHtml, /id="mohallaInput"[^>]*list="mohallaOptions"/);
  assert.ok(indexHtml.includes('id="mohallaOptions"'), 'the mohalla datalist still exists');
  assert.match(indexHtml, /for="mohallaInput"[^]*?Optional/);
  assert.equal((indexHtml.match(/id="mohallaInput"/g) || []).length, 1, 'one Area input');
  assert.equal((indexHtml.match(/id="zoneInput"/g) || []).length, 1, 'one Zone input');
});

function receiptFor(area) {
  const { customer, bill, payment } = fixture(area);
  return buildPaymentReceipt(customer, bill, payment);
}

test('receipt area: mohalla only, zone only, both joined, neither reads Not recorded', () => {
  assert.equal(receiptFor({ mohalla: 'CHARYAA' }).area, 'CHARYAA');
  assert.equal(receiptFor({ zone: 'Zone 2' }).area, 'Zone 2');
  assert.equal(receiptFor({ mohalla: 'CHARYAA', zone: 'Zone 2' }).area, 'CHARYAA, Zone 2');
  assert.equal(receiptFor({}).area, 'Not recorded');
  assert.equal(receiptFor({ mohalla: '', zone: '   ' }).area, 'Not recorded');
});

test('receipt area matches the PNG receipt derivation exactly', () => {
  for (const area of [{ mohalla: 'CHARYAA', zone: 'Zone 2' }, { mohalla: 'GANGALL' }, { zone: 'Zone 2' }, {}]) {
    const { customer, bill, payment } = fixture(area);
    const receipt = buildPaymentReceipt(customer, bill, payment);
    const model = buildPngReceiptModel(receipt, customer);
    assert.equal(receipt.area, model.areaZone, `area agrees with the PNG receipt for ${JSON.stringify(area)}`);
  }
});

test('receipt area shows on all three HTML layouts and never guesses', () => {
  const { customer, bill, payment } = fixture({ mohalla: 'CHARYAA', zone: 'Zone 2' });
  const receipt = buildPaymentReceipt(customer, bill, payment);
  for (const format of ['thermal-58', 'thermal-80', 'a4']) {
    const html = generatePaymentReceiptHtml(receipt, { format });
    assert.match(html, /Area \/ علاقہ/, `${format} carries the Area row`);
    assert.ok(html.includes('CHARYAA, Zone 2'), `${format} shows mohalla and zone joined`);
  }
  const blank = receiptFor({});
  for (const format of ['thermal-58', 'thermal-80', 'a4']) {
    const html = generatePaymentReceiptHtml(blank, { format });
    // A4 labels carry no trailing colon; the thermal slips do.
    assert.match(html, /<dt>Area \/ علاقہ:?<\/dt><dd[^>]*>Not recorded<\/dd>/, `${format} reads Not recorded, never blank`);
  }
});

test('receipt area does not touch amounts, tax, or the brand header area', () => {
  const { customer, bill, payment } = fixture({ mohalla: 'CHARYAA' });
  const receipt = buildPaymentReceipt(customer, bill, payment);
  assert.equal(receipt.paidAmount, 2000);
  assert.equal(receipt.status, 'PAID');
  const html = generatePaymentReceiptHtml(receipt, { format: 'a4' });
  assert.ok(html.includes('Shahdara, Islamabad'), 'brand header area unchanged');
});

test('WhatsApp draft carries the area after the customer number, in all three languages', () => {
  const base = {
    customerName: 'Polish Twelve Customer', customerNumber: 7, amount: 2000,
    date: '2026-09-05', method: 'Cash', month: '2026-09',
    billStatus: 'paid', billAmount: 2000, balanceDueCents: 0,
  };
  const withArea = createReceiptWhatsAppDraft('+92 300 123 4567', { ...base, area: 'CHARYAA, Zone 2' });
  assert.ok(withArea.message.includes('📍 Area: CHARYAA, Zone 2'));
  assert.ok(withArea.message.indexOf('📍 Area:') > withArea.message.indexOf('🆔 Customer #: 7'));

  const withoutArea = createReceiptWhatsAppDraft('+92 300 123 4567', base);
  assert.ok(withoutArea.message.includes('📍 Area: Not recorded'), 'no area reads Not recorded, never blank');

  const urdu = createReceiptWhatsAppDraft('+92 300 123 4567', { ...base, area: 'CHARYAA' }, { lang: 'urdu' });
  assert.ok(urdu.message.includes('📍 علاقہ: CHARYAA'));
  const roman = createReceiptWhatsAppDraft('+92 300 123 4567', { ...base, area: 'CHARYAA' }, { lang: 'roman' });
  assert.ok(roman.message.includes('📍 Ilaqa: CHARYAA'));
});

test('Urdu-script printing re-labels the new Area row', () => {
  assert.equal(urduReceiptLabel('Area / علاقہ'), 'علاقہ');
  assert.equal(urduReceiptLabel('Customer Name / صارف کا نام'), 'صارف کا نام', 'existing labels unchanged');
});

test('save path unchanged: Area still saves to customer.mohalla, counter still counts 69 fields', () => {
  assert.deepEqual(profileFieldSaveEntry('mohallaInput', { type: 'text', value: 'CHARYAA' }), { key: 'mohalla', value: 'CHARYAA' });
  assert.deepEqual(profileFieldSaveEntry('zoneInput', { type: 'text', value: 'Zone 2' }), { key: 'zone', value: 'Zone 2' });
  assert.equal(Object.keys(PROFILE_FIELD_SAVE_MAP).length, 69, 'the field set is unchanged — only the order moved');
  const counted = countProfileCompletion({ mohalla: 'CHARYAA', zone: 'Zone 2' });
  assert.equal(counted.total, 69);
  assert.equal(counted.filled, 2);
  assert.equal(counted.text, '2/69 fields filled');
});
