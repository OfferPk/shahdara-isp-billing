// Plan 40 (Plan 1-100) — Preferred payment channel with matching
// payment instructions. Fixtures are synthetic; no real customer
// data is used.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PAYMENT_CHANNELS,
  normalizePaymentChannel,
  normalizePaymentChannelRecord,
  normalizePaymentChannelRecords,
  findPaymentChannel,
  findPaymentChannelRecord,
  upsertPaymentChannel,
  removePaymentChannel,
  paymentChannelInstructions,
  withPaymentInstructions,
  tailorDraftWithPaymentChannel,
  paymentChannelSummaryText,
  paymentChannelHtml,
  paymentChannelCsv,
  paymentChannelFilename,
} from '../payment-channel.js';

const cash = (overrides = {}) => ({ customerId: 'c1', customerName: 'Ayesha', channel: 'cash', ...overrides });
const wallet = (overrides = {}) => ({ customerId: 'c2', customerName: 'Bilal', channel: 'easypaisa', ...overrides });

test('channel normalisation maps aliases and never guesses an unknown value', () => {
  assert.equal(normalizePaymentChannel('cash'), 'cash');
  assert.equal(normalizePaymentChannel('collector'), 'cash');
  assert.equal(normalizePaymentChannel('cash_via_collector'), 'cash');
  assert.equal(normalizePaymentChannel('wallet'), 'wallet');
  assert.equal(normalizePaymentChannel('Easypaisa'), 'wallet');
  assert.equal(normalizePaymentChannel('easypaisa_wallet'), 'wallet');
  assert.equal(normalizePaymentChannel('bank'), null);
  assert.equal(normalizePaymentChannel(''), null);
  assert.equal(normalizePaymentChannel(null), null);
  assert.equal(normalizePaymentChannel(42), null);
});

test('record normalisation rejects rows without a customer or a known channel', () => {
  assert.equal(normalizePaymentChannelRecord(null), null);
  assert.equal(normalizePaymentChannelRecord({ channel: 'cash' }), null);
  assert.equal(normalizePaymentChannelRecord({ customerId: 'c1', channel: 'bank' }), null);
  assert.equal(normalizePaymentChannelRecord({ customerId: 'c1', channel: '' }), null);
  assert.deepEqual(normalizePaymentChannelRecord(cash()), {
    customerId: 'c1', customerName: 'Ayesha', channel: 'cash', note: '',
  });
  assert.deepEqual(normalizePaymentChannelRecord({ id: 'c9', name: 'Zain', channel: 'wallet', note: 'prefers wallet' }), {
    customerId: 'c9', customerName: 'Zain', channel: 'wallet', note: 'prefers wallet',
  });
});

test('list normalisation keeps one record per customer, last wins', () => {
  const list = normalizePaymentChannelRecords([cash(), cash({ channel: 'wallet' }), wallet()]);
  assert.equal(list.length, 2);
  assert.equal(list.find((r) => r.customerId === 'c1').channel, 'wallet');
});

test('find returns the channel or null, never a guessed channel', () => {
  const list = [cash(), wallet()];
  assert.equal(findPaymentChannel(list, 'c1'), 'cash');
  assert.equal(findPaymentChannel(list, 'c2'), 'wallet');
  assert.equal(findPaymentChannel(list, 'c3'), null);
  assert.equal(findPaymentChannel(list, ''), null);
  assert.equal(findPaymentChannel(null, 'c1'), null);
  assert.equal(findPaymentChannelRecord(list, 'c2').customerName, 'Bilal');
  assert.equal(findPaymentChannelRecord(list, 'c3'), null);
});

test('upsert replaces one customer and never mutates the input list', () => {
  const before = [cash()];
  const after = upsertPaymentChannel(before, cash({ channel: 'wallet' }));
  assert.equal(before[0].channel, 'cash');
  assert.equal(after.length, 1);
  assert.equal(after[0].channel, 'wallet');
  assert.equal(upsertPaymentChannel(before, { customerId: 'c3', channel: 'bank' }).length, 1);
  assert.equal(upsertPaymentChannel(before, { channel: 'cash' }).length, 1);
  assert.equal(upsertPaymentChannel(before, wallet()).length, 2);
});

test('remove drops only the named customer', () => {
  const list = removePaymentChannel([cash(), wallet()], 'c1');
  assert.deepEqual(list.map((r) => r.customerId), ['c2']);
  assert.equal(removePaymentChannel([cash()], 'c9').length, 1);
});

test('cash instructions name the collector route in both variants', () => {
  const roman = paymentChannelInstructions('cash', 'roman');
  assert.equal(roman.channel, 'cash');
  assert.match(roman.text, /collector/i);
  assert.match(roman.text, /receipt/i);
  assert.doesNotMatch(roman.text, /Easypaisa/);
  const urdu = paymentChannelInstructions('cash', 'urdu');
  assert.equal(urdu.variant, 'urdu');
  assert.match(urdu.text, /نقد/);
  assert.match(urdu.text, /کلیکٹر/);
});

test('wallet instructions name the wallet route and a reference note, never an account number', () => {
  const roman = paymentChannelInstructions('wallet', 'roman');
  assert.equal(roman.channel, 'wallet');
  assert.match(roman.text, /Easypaisa\/wallet/);
  assert.match(roman.text, /reference/i);
  assert.doesNotMatch(roman.text, /collector/);
  assert.doesNotMatch(roman.text, /\b03\d{9}\b/);
  const urdu = paymentChannelInstructions('wallet', 'urdu');
  assert.match(urdu.text, /ایزی پیسہ/);
  assert.match(urdu.text, /ریفرنس/);
});

test('no recorded channel gets the neutral default in both variants', () => {
  const roman = paymentChannelInstructions(null, 'roman');
  assert.equal(roman.channel, null);
  assert.match(roman.text, /collector/);
  assert.match(roman.text, /Easypaisa\/wallet/);
  const urdu = paymentChannelInstructions('bank', 'urdu');
  assert.equal(urdu.channel, null);
  assert.match(urdu.text, /کلیکٹر/);
  assert.match(urdu.text, /ایزی پیسہ/);
});

test('withPaymentInstructions appends the line and never rewrites the draft', () => {
  const draft = 'Assalam-o-Alaikum Ayesha, yaad dehani: bill Rs. 3,000 tak ada karna hai.';
  const tailored = withPaymentInstructions(draft, 'cash', 'roman');
  assert.ok(tailored.startsWith(draft));
  assert.match(tailored, /collector/);
  assert.equal(withPaymentInstructions('', 'wallet', 'roman'), paymentChannelInstructions('wallet', 'roman').text);
  assert.equal(withPaymentInstructions('  ', null, 'roman'), paymentChannelInstructions(null, 'roman').text);
});

test('tailorDraftWithPaymentChannel looks the channel up and never mutates the draft', () => {
  const draft = { text: 'Reminder text.', variant: 'urdu' };
  const list = [cash(), wallet()];
  const tailored = tailorDraftWithPaymentChannel(draft, list, 'c2');
  assert.equal(draft.text, 'Reminder text.');
  assert.equal(tailored.channel, 'wallet');
  assert.equal(tailored.variant, 'urdu');
  assert.ok(tailored.text.startsWith('Reminder text.'));
  assert.match(tailored.text, /ایزی پیسہ/);
  const neutral = tailorDraftWithPaymentChannel(draft, list, 'c9');
  assert.equal(neutral.channel, null);
  assert.match(neutral.text, /کلیکٹر/);
  const unknownVariant = tailorDraftWithPaymentChannel({ text: 'Hi.' }, list, 'c1');
  assert.equal(unknownVariant.variant, 'roman');
  assert.match(unknownVariant.text, /collector/);
});

test('a channel record carries no money, bill, payment or credential field', () => {
  const record = normalizePaymentChannelRecord(cash());
  assert.deepEqual(Object.keys(record).sort(), ['channel', 'customerId', 'customerName', 'note']);
  assert.doesNotMatch(JSON.stringify(record), /amount|balance|account|password|pin/i);
});

test('summary text counts cash and wallet separately', () => {
  assert.equal(paymentChannelSummaryText([]), 'No preferred payment channel recorded yet.');
  assert.equal(
    paymentChannelSummaryText([cash(), wallet(), { customerId: 'c3', channel: 'wallet' }]),
    '3 customers with a recorded channel: 1 cash via collector, 2 Easypaisa/wallet.',
  );
});

test('html escapes names and notes and states the channel plainly', () => {
  assert.match(paymentChannelHtml(null), /No preferred payment channel/);
  assert.match(paymentChannelHtml(cash()), /Cash via collector/);
  assert.match(paymentChannelHtml(wallet({ note: 'a <b> note' })), /Easypaisa\/wallet/);
  assert.doesNotMatch(paymentChannelHtml(wallet({ note: 'a <b> note' })), /<b> note/);
});

test('csv quotes fields and carries one row per customer', () => {
  const csv = paymentChannelCsv([cash({ customerName: 'Ayesha, Khan' }), wallet()]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'Customer, Customer name, Preferred channel, Note');
  assert.equal(lines.length, 3);
  assert.match(lines[1], /"Ayesha, Khan"/);
  assert.match(lines[2], /,wallet,/);
});

test('filename is stable', () => {
  assert.equal(paymentChannelFilename(), 'payment-channels.csv');
});
