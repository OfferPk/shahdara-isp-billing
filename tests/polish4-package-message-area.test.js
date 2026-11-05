import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  DEFAULT_SUCCESS_MESSAGE,
  PACKAGE_SUCCESS_MESSAGES,
  packageSuccessMessage,
  packageSuccessMessageOrDefault
} from '../package-success-message.js';
import { BILL_PACKAGES } from '../package-catalog.js';
import { DEFAULT_MOHALLAS } from '../phase3.js';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

const MESSAGES = {
  1000: 'آپ کا ایک ہزار والا پیکج لگ گیا ہے، ڈیٹا سو جی بی ہے، ختم ہونے کی صورت میں دوبارہ کروانا ہو گا۔ پیکج کی مدت تیس دن ہوتی ہے۔',
  1500: 'آپ کا پندرہ سو والا پیکج لگ گیا ہے، ڈیٹا ڈیڑھ سو جی بی ہے، ختم ہونے کی صورت میں دوبارہ کروانا ہو گا۔ پیکج کی مدت تیس دن ہوتی ہے۔',
  1600: 'آپ کا سولہ سو والا پیکج لگ گیا ہے، ڈیٹا تین سو جی بی ہے، ختم ہونے کی صورت میں دوبارہ کروانا ہو گا۔ پیکج کی مدت تیس دن ہوتی ہے۔',
  2000: 'آپ کا دو ہزار والا پیکج لگ گیا ہے، ڈیٹا دو سو جی بی ہے، ختم ہونے پہ پیکج دوبارہ کروانا پڑ سکتا ہے۔ پیکج کی مدت تیس دن ہوتی ہے۔',
  2500: 'آپ کا پچیس سو والا پیکج لگ گیا ہے، ڈیٹا پانچ سو جی بی ہے، ختم ہونے کی صورت میں دوبارہ کروانا ہو گا۔ پیکج کی مدت تیس دن ہوتی ہے۔',
  3000: 'آپ کا تین ہزار والا پیکج لگ گیا ہے — جتنا چاہیں انٹرنیٹ استعمال کریں۔ پیکج کی مدت تیس دن ہوتی ہے۔'
};

test('every package price maps to its exact Urdu message', () => {
  assert.equal(PACKAGE_SUCCESS_MESSAGES.length, 6);
  for (const [price, message] of Object.entries(MESSAGES)) {
    assert.equal(packageSuccessMessage(Number(price)), message, `Rs ${price}`);
  }
});

test('numeric strings and whole-number floats match; nothing else does', () => {
  assert.equal(packageSuccessMessage('2000'), MESSAGES[2000]);
  assert.equal(packageSuccessMessage(1000.00), MESSAGES[1000]);
  assert.equal(packageSuccessMessage(500), null);
  assert.equal(packageSuccessMessage(0), null);
  assert.equal(packageSuccessMessage(-100), null);
  assert.equal(packageSuccessMessage(2000.5), null);
  assert.equal(packageSuccessMessage(NaN), null);
  assert.equal(packageSuccessMessage(null), null);
  assert.equal(packageSuccessMessage(undefined), null);
  assert.equal(packageSuccessMessage(''), null);
  assert.equal(packageSuccessMessage('abc'), null);
});

test('the default is the existing English success line', () => {
  assert.equal(DEFAULT_SUCCESS_MESSAGE, 'The transaction is saved locally and ledger balances are updated.');
  assert.equal(packageSuccessMessageOrDefault(2000), MESSAGES[2000]);
  assert.equal(packageSuccessMessageOrDefault(500), DEFAULT_SUCCESS_MESSAGE);
  assert.equal(packageSuccessMessageOrDefault('nope'), DEFAULT_SUCCESS_MESSAGE);
});

test('package prices match the billing package catalogue (drift guard)', () => {
  const catalogPrices = BILL_PACKAGES.map((p) => p.price).sort((a, b) => a - b);
  const messagePrices = PACKAGE_SUCCESS_MESSAGES.map((e) => e.price).sort((a, b) => a - b);
  assert.deepEqual(messagePrices, catalogPrices);
});

test('purity fence: the message module imports nothing and reads no storage', () => {
  const source = read('package-success-message.js');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the message module stays import-free', () => {
  const source = read('package-success-message.js');
  assert.equal(source.includes('package-catalog'), false, 'module must not reference the catalogue');
  assert.equal(source.includes('phase3'), false, 'module must not reference the mohalla module');
  assert.equal(existsSync(new URL('../package-catalog.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../phase3.js', import.meta.url)), true);
});

test('success screen receipt card renders the Area select', async () => {
  const { renderQuickCollectReceiptCardHtml } = await import('../nav-quick-collect.js');
  const base = {
    receiptNumber: 'RCPT-61-202611-01',
    customerName: 'MOBEEN SHAH',
    customerNumber: 61,
    amount: 2000,
    date: '2026-11-05',
    method: 'Easypaisa',
    newTotalDues: 0,
    paidBy: 'Self'
  };

  const unassigned = renderQuickCollectReceiptCardHtml({ ...base, area: 'Unassigned' });
  assert.ok(unassigned.includes('id="quickCollectAreaSelect"'));
  assert.ok(unassigned.includes('data-qc-area-select'));
  assert.ok(unassigned.includes('<option value="" selected>Unassigned</option>'));
  assert.ok(unassigned.includes('<option value="BANII">Banii</option>'));
  assert.ok(unassigned.includes('<option value="CHARYAA">Charyaa</option>'));
  assert.equal((unassigned.match(/<option/g) || []).length, 1 + DEFAULT_MOHALLAS.length);

  const custom = renderQuickCollectReceiptCardHtml({ ...base, area: 'Begum Kot' });
  assert.ok(custom.includes('<option value="Begum Kot" selected>Begum Kot</option>'));
  assert.equal((custom.match(/<option/g) || []).length, 1 + 1 + DEFAULT_MOHALLAS.length);

  const variant = renderQuickCollectReceiptCardHtml({ ...base, area: 'bani' });
  assert.ok(variant.includes('<option value="BANII" selected>Banii</option>'));
  assert.equal(variant.includes('value="bani"'), false, 'a spelling variant must fold into the canonical spelling');
});

test('Quick Collect wires the package message and the area save', () => {
  const source = read('nav-quick-collect.js');
  assert.equal(source.includes("from './package-success-message.js'"), true);
  assert.equal(source.includes('packageSuccessMessageOrDefault(amount)'), true);
  assert.equal(source.includes('applyPackageSuccessMessage(totalCollected)'), true);
  assert.equal(source.includes('applyPackageSuccessMessage(receipt.amount)'), true);
  assert.equal(source.includes("document.getElementById('quickCollectSuccessMessage')"), true);
  assert.equal(source.includes('quickCollectAreaSelectHtml(receipt.area)'), true);
  assert.equal(source.includes('[data-qc-area-select]'), true);
  assert.equal(source.includes('updateCustomerProfile(getState(), activeCustomerId, { mohalla: stored })'), true);
  assert.equal(source.includes("area: customer.mohalla || customer.area || 'Unassigned'"), true);
  const split = read('split-tender-collect.js');
  assert.equal(split.includes("area: customer.mohalla || customer.area || 'Unassigned'"), true);
});

test('success message element keeps the default English line in index.html', () => {
  const html = read('index.html');
  assert.equal(html.includes('id="quickCollectSuccessMessage"'), true);
  assert.equal(html.includes('The transaction is saved locally and ledger balances are updated.'), true);
});

test('styles.css styles the area select', () => {
  const styles = read('styles.css');
  assert.equal(styles.includes('.qc-area-select'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = read('app.js');
  assert.equal(/\bOLT\b/.test(source), false);
});
