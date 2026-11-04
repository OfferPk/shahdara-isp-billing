import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validBalanceConfirmationDate,
  BALANCE_CONFIRMATION_METHODS,
  balanceConfirmationMethodLabel,
  balanceConfirmationAmountCents,
  normalizeBalanceConfirmation,
  normalizeBalanceConfirmationList,
  upsertBalanceConfirmation,
  removeBalanceConfirmation,
  findBalanceConfirmation,
  confirmationsForCustomer,
  latestConfirmationForCustomer,
  formatBalanceConfirmationCents,
  balanceConfirmationSummaryText,
  balanceConfirmationHtml,
  balanceConfirmationCsv,
  balanceConfirmationFilename,
} from '../balance-confirmations.js';

const rec = (over = {}) => ({
  id: 'BC-1',
  customer: 'CUST-1',
  customerName: 'Ahmed',
  balance: 1500,
  date: '2026-10-05',
  method: 'in-person',
  recordedBy: 'Saad',
  note: 'Agreed at shop',
  ...over,
});

test('strict dates: real dates pass, impossible dates refused', () => {
  assert.equal(validBalanceConfirmationDate('2026-10-05'), '2026-10-05');
  assert.equal(validBalanceConfirmationDate('2024-02-29'), '2024-02-29');
  assert.equal(validBalanceConfirmationDate('2026-02-30'), null);
  assert.equal(validBalanceConfirmationDate('2026-13-01'), null);
  assert.equal(validBalanceConfirmationDate('05-10-2026'), null);
  assert.equal(validBalanceConfirmationDate(''), null);
  assert.equal(validBalanceConfirmationDate(null), null);
});

test('method catalogue: exactly three methods, labels plain', () => {
  assert.deepEqual(Object.values(BALANCE_CONFIRMATION_METHODS).sort(), ['in-person', 'message', 'paper']);
  assert.equal(balanceConfirmationMethodLabel('in-person'), 'In person');
  assert.equal(balanceConfirmationMethodLabel('message'), 'By message');
  assert.equal(balanceConfirmationMethodLabel('paper'), 'On paper kept at the shop');
  assert.equal(balanceConfirmationMethodLabel('smoke-signal'), 'Not recorded');
});

test('rupees convert once, *Cents pass through as-is, unusable refused', () => {
  assert.equal(balanceConfirmationAmountCents({ balance: 1500 }), 150000);
  assert.equal(balanceConfirmationAmountCents({ balance: 1500.55 }), 150055);
  assert.equal(balanceConfirmationAmountCents({ balanceCents: 150000 }), 150000);
  assert.equal(balanceConfirmationAmountCents({ balanceCents: 150000, balance: 9999 }), 150000);
  assert.equal(balanceConfirmationAmountCents({ balance: '1500' }), 150000);
  assert.equal(balanceConfirmationAmountCents({ balance: 'not money' }), null);
  assert.equal(balanceConfirmationAmountCents({}), null);
  assert.equal(balanceConfirmationAmountCents(null), null);
});

test('half-formed records refused outright', () => {
  assert.equal(normalizeBalanceConfirmation(rec({ id: '' })), null);
  assert.equal(normalizeBalanceConfirmation(rec({ customer: '   ' })), null);
  assert.equal(normalizeBalanceConfirmation(rec({ balance: undefined })), null);
  assert.equal(normalizeBalanceConfirmation(rec({ date: '2026-02-30' })), null);
  assert.equal(normalizeBalanceConfirmation(rec({ method: 'telepathy' })), null);
  assert.equal(normalizeBalanceConfirmation(rec({ method: '' })), null);
  assert.equal(normalizeBalanceConfirmation(null), null);
});

test('zero balance is a real record, negative is a credit balance', () => {
  assert.equal(normalizeBalanceConfirmation(rec({ balance: 0 })).balanceCents, 0);
  assert.equal(normalizeBalanceConfirmation(rec({ balance: -250 })).balanceCents, -25000);
  assert.match(balanceConfirmationHtml([rec({ balance: -250 })]), /credit/);
});

test('unknown fields dropped: a confirmation never grows a payment, bill, or version field', () => {
  const clean = normalizeBalanceConfirmation(rec({ paymentId: 'P-9', billId: 'B-9', termsVersion: 'v3', amount: 999 }));
  assert.deepEqual(Object.keys(clean).sort(), ['balanceCents', 'customer', 'customerName', 'date', 'id', 'method', 'note', 'recordedBy']);
});

test('one record per customer per date: second replaces first, never duplicates', () => {
  const first = upsertBalanceConfirmation([], rec());
  const second = upsertBalanceConfirmation(first, rec({ id: 'BC-2', balance: 1200, method: 'message' }));
  assert.equal(second.length, 1);
  assert.equal(second[0].id, 'BC-2');
  assert.equal(second[0].balanceCents, 120000);
  const otherDate = upsertBalanceConfirmation(second, rec({ id: 'BC-3', date: '2026-11-05', balance: 1200 }));
  assert.equal(otherDate.length, 2);
});

test('same id re-saved replaces its own record; identical re-save unchanged', () => {
  const list = upsertBalanceConfirmation([], rec());
  const changed = upsertBalanceConfirmation(list, rec({ balance: 9999 }));
  assert.equal(changed.length, 1);
  assert.equal(changed[0].balanceCents, 999900);
  const same = upsertBalanceConfirmation(list, rec());
  assert.deepEqual(same, list);
});

test('remove drops only the named record; unknown id leaves the list unchanged', () => {
  const list = upsertBalanceConfirmation(upsertBalanceConfirmation([], rec()), rec({ id: 'BC-2', date: '2026-11-05' }));
  assert.equal(removeBalanceConfirmation(list, 'BC-1').length, 1);
  assert.deepEqual(removeBalanceConfirmation(list, 'BC-9'), list);
  assert.deepEqual(removeBalanceConfirmation(list, ''), list);
});

test('find, per-customer list newest first, and latest', () => {
  const list = [
    rec({ id: 'BC-1', date: '2026-10-05' }),
    rec({ id: 'BC-2', date: '2026-11-05' }),
    rec({ id: 'BC-3', customer: 'CUST-2', date: '2026-12-05' }),
  ];
  assert.equal(findBalanceConfirmation(list, 'BC-2').date, '2026-11-05');
  assert.equal(findBalanceConfirmation(list, 'BC-9'), null);
  assert.deepEqual(confirmationsForCustomer(list, 'CUST-1').map((r) => r.id), ['BC-2', 'BC-1']);
  assert.deepEqual(confirmationsForCustomer(list, 'NOBODY'), []);
  assert.equal(latestConfirmationForCustomer(list, 'CUST-1').id, 'BC-2');
  assert.equal(latestConfirmationForCustomer(list, 'NOBODY'), null);
});

test('a later balance change never alters an earlier confirmation (non-mutation)', () => {
  const earlier = rec();
  const list = upsertBalanceConfirmation([], earlier);
  const frozen = JSON.parse(JSON.stringify(list));
  const later = upsertBalanceConfirmation(list, rec({ id: 'BC-2', date: '2026-11-05', balance: 500 }));
  assert.deepEqual(list, frozen);
  assert.equal(later.find((r) => r.id === 'BC-1').balanceCents, 150000);
  assert.equal(later.find((r) => r.id === 'BC-2').balanceCents, 50000);
  // Confirming itself changes nothing about the balance: the record is evidence only.
  assert.equal(balanceConfirmationSummaryText(later, 'CUST-1'), '2 confirmations; latest 2026-11-05: Rs. 500.00 (In person).');
  assert.equal(balanceConfirmationSummaryText(later, 'NOBODY'), 'No balance confirmation recorded.');
});

test('format, summary, HTML escaping, CSV quoting', () => {
  assert.equal(formatBalanceConfirmationCents(150000), 'Rs. 1500.00');
  assert.equal(formatBalanceConfirmationCents(-25000), '-Rs. 250.00');
  assert.equal(formatBalanceConfirmationCents('x'), '—');
  const html = balanceConfirmationHtml([rec({ customerName: '<b>Ahmed</b>', note: 'a "quoted" note' })]);
  assert.doesNotMatch(html, /<b>Ahmed<\/b>/);
  assert.match(html, /&lt;b&gt;Ahmed&lt;\/b&gt;/);
  assert.match(html, /never settles/);
  const csv = balanceConfirmationCsv([rec({ note: 'has, comma' })]);
  assert.match(csv, /^id,customer,customer_name,balance_cents,date,method,recorded_by,note\n/);
  assert.match(csv, /"has, comma"/);
  assert.equal(balanceConfirmationFilename(), 'balance-confirmations.csv');
});

test('purity fence: module is import-free and names no other record module', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(dir, '..', 'balance-confirmations.js'), 'utf8');
  assert.doesNotMatch(source, /^import /m);
  assert.doesNotMatch(source, /localStorage|document\.|fetch\(|XMLHttpRequest/);
  assert.doesNotMatch(source, /termsAck|terms-ack|paymentChannel|disputeCases|creditBalance/);
});

test('panel ids present in index.html', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['balanceConfBody', 'balanceConfCustomer', 'balanceConfBalance', 'balanceConfDate', 'balanceConfMethod', 'balanceConfRecordedBy', 'balanceConfNote', 'balanceConfSaveBtn', 'balanceConfFilter', 'balanceConfRemove', 'balanceConfRemoveId', 'balanceConfExportBtn', 'balanceConfSummary']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
