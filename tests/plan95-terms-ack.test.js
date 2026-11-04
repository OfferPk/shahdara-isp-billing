import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validTermsAckDate,
  TERMS_ACK_METHODS,
  TERMS_ACK_METHOD_LABELS,
  termsAckMethodLabel,
  normalizeTermsAck,
  normalizeTermsAckList,
  upsertTermsAck,
  removeTermsAck,
  findTermsAck,
  termsAckForCustomer,
  customerTermsStatus,
  buildCustomerTermsRows,
  filterTermsAcks,
  termsAckSummaryText,
  termsAckHtml,
  termsAckStatusHtml,
  termsAckCsv,
  termsAckFilename,
} from '../terms-ack.js';

const ack = (overrides = {}) => ({
  id: 'TA-1',
  customer: 'C-1',
  customerName: 'Ahmed',
  termsVersion: 'v1',
  date: '2026-11-01',
  method: 'in-person',
  recordedBy: 'Saad',
  ...overrides,
});

test('strict dates: real dates pass, impossible and malformed dates fail', () => {
  assert.equal(validTermsAckDate('2026-11-01'), '2026-11-01');
  assert.equal(validTermsAckDate('2024-02-29'), '2024-02-29');
  assert.equal(validTermsAckDate('2026-02-30'), null);
  assert.equal(validTermsAckDate('2026-13-01'), null);
  assert.equal(validTermsAckDate('01-11-2026'), null);
  assert.equal(validTermsAckDate(''), null);
  assert.equal(validTermsAckDate(null), null);
});

test('method catalogue: three methods with plain labels', () => {
  assert.deepEqual(Object.values(TERMS_ACK_METHODS).sort(), ['in-person', 'message', 'paper']);
  assert.equal(TERMS_ACK_METHOD_LABELS['in-person'], 'In person');
  assert.equal(TERMS_ACK_METHOD_LABELS.message, 'By message');
  assert.equal(TERMS_ACK_METHOD_LABELS.paper, 'On paper kept at the shop');
  assert.equal(termsAckMethodLabel('message'), 'By message');
  assert.equal(termsAckMethodLabel('carrier-pigeon'), 'Not recorded');
});

test('half-formed records are refused outright, never stored half-formed', () => {
  assert.equal(normalizeTermsAck(ack({ id: '  ' })), null);
  assert.equal(normalizeTermsAck(ack({ customer: '' })), null);
  assert.equal(normalizeTermsAck(ack({ termsVersion: '   ' })), null);
  assert.equal(normalizeTermsAck(ack({ date: '2026-02-30' })), null);
  assert.equal(normalizeTermsAck(ack({ method: 'phone-call' })), null);
  assert.equal(normalizeTermsAck(null), null);
  assert.equal(normalizeTermsAck('not an object'), null);
  const good = normalizeTermsAck(ack());
  assert.equal(good.id, 'TA-1');
  assert.equal(good.method, 'in-person');
});

test('unknown fields are dropped: the record carries only its own keys, never a personal document field', () => {
  const record = normalizeTermsAck(ack({ idCardNumber: '35202-1234567-1', passport: 'AB123', note: 'extra' }));
  assert.deepEqual(Object.keys(record).sort(), ['customer', 'customerName', 'date', 'id', 'method', 'recordedBy', 'termsVersion']);
  assert.equal(record.idCardNumber, undefined);
});

test('one acknowledgement per customer per version: a second record for the same version replaces the first', () => {
  const first = upsertTermsAck([], ack());
  assert.equal(first.length, 1);
  const replaced = upsertTermsAck(first, ack({ id: 'TA-2', date: '2026-11-05', method: 'message' }));
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].id, 'TA-2');
  assert.equal(replaced[0].date, '2026-11-05');
  const added = upsertTermsAck(replaced, ack({ id: 'TA-3', termsVersion: 'v2', date: '2026-12-01' }));
  assert.equal(added.length, 2);
  const sameIdNewVersion = upsertTermsAck(added, ack({ id: 'TA-3', termsVersion: 'v3' }));
  assert.equal(sameIdNewVersion.length, 2);
  assert.ok(!sameIdNewVersion.some((item) => item.id === 'TA-3' && item.termsVersion === 'v2'));
});

test('a half-formed upsert leaves the list unchanged', () => {
  const list = upsertTermsAck([], ack());
  const next = upsertTermsAck(list, ack({ id: 'TA-9', method: 'smoke-signal' }));
  assert.deepEqual(next, list);
});

test('remove drops only the named record', () => {
  const list = normalizeTermsAckList([ack(), ack({ id: 'TA-2', termsVersion: 'v2' })]);
  assert.equal(removeTermsAck(list, 'TA-1').length, 1);
  assert.equal(removeTermsAck(list, 'TA-1')[0].id, 'TA-2');
  assert.equal(removeTermsAck(list, 'missing').length, 2);
  assert.deepEqual(removeTermsAck(null, 'TA-1'), []);
});

test('find returns the exact customer + version record, or null', () => {
  const list = normalizeTermsAckList([ack(), ack({ id: 'TA-2', termsVersion: 'v2' })]);
  assert.equal(findTermsAck(list, 'C-1', 'v2').id, 'TA-2');
  assert.equal(findTermsAck(list, 'C-1', 'v3'), null);
  assert.equal(findTermsAck(list, 'C-2', 'v1'), null);
});

test("a customer's history is in date order", () => {
  const list = normalizeTermsAckList([
    ack({ id: 'TA-2', termsVersion: 'v2', date: '2026-12-01' }),
    ack({ id: 'TA-1', date: '2026-11-01' }),
  ]);
  const history = termsAckForCustomer(list, 'C-1');
  assert.deepEqual(history.map((item) => item.id), ['TA-1', 'TA-2']);
  assert.deepEqual(termsAckForCustomer(list, 'C-9'), []);
});

test('customer status: acknowledged, not-yet-acknowledged (never assumed), and no-version-set', () => {
  const list = normalizeTermsAckList([ack()]);
  const ok = customerTermsStatus(list, 'C-1', 'v1');
  assert.equal(ok.acknowledged, true);
  assert.equal(ok.status, 'acknowledged');
  assert.match(ok.text, /2026-11-01/);
  const pending = customerTermsStatus(list, 'C-1', 'v2');
  assert.equal(pending.acknowledged, false);
  assert.equal(pending.status, 'not-yet-acknowledged');
  assert.match(pending.text, /never assumed/);
  const unset = customerTermsStatus(list, 'C-1', '');
  assert.equal(unset.acknowledged, false);
  assert.equal(unset.status, 'no-version-set');
  assert.equal(unset.record, null);
});

test('per-customer rows: name order, and a new version shows everyone as not yet acknowledged', () => {
  const list = normalizeTermsAckList([ack({ customer: 'C-2', customerName: 'Bilal' }), ack({ customer: 'C-1', customerName: 'Ahmed' })]);
  const customers = [{ id: 'C-1', name: 'Ahmed' }, { id: 'C-2', name: 'Bilal' }, { id: 'C-3', name: 'Usman' }];
  const rows = buildCustomerTermsRows(list, customers, 'v1');
  assert.deepEqual(rows.map((row) => row.customerName), ['Ahmed', 'Bilal', 'Usman']);
  assert.deepEqual(rows.map((row) => row.acknowledged), [true, true, false]);
  const newVersion = buildCustomerTermsRows(list, customers, 'v2');
  assert.ok(newVersion.every((row) => row.acknowledged === false));
  assert.ok(newVersion.every((row) => row.status === 'not-yet-acknowledged'));
});

test('filters match version, method, and customer exactly', () => {
  const list = normalizeTermsAckList([
    ack(),
    ack({ id: 'TA-2', customer: 'C-2', termsVersion: 'v2', method: 'paper' }),
    ack({ id: 'TA-3', termsVersion: 'v2', method: 'message' }),
  ]);
  assert.equal(filterTermsAcks(list, { version: 'v2' }).length, 2);
  assert.equal(filterTermsAcks(list, { method: 'paper' }).length, 1);
  assert.equal(filterTermsAcks(list, { customer: 'C-2' }).length, 1);
  assert.equal(filterTermsAcks(list, { version: 'v2', method: 'message' }).length, 1);
  assert.equal(filterTermsAcks(list, {}).length, 3);
});

test('summary text counts records, customers, and the current version', () => {
  const list = normalizeTermsAckList([ack(), ack({ id: 'TA-2', termsVersion: 'v2' }), ack({ id: 'TA-3', customer: 'C-2' })]);
  assert.equal(termsAckSummaryText(list, 'v2'), '3 acknowledgements for 2 customers · current terms version v2');
  assert.equal(termsAckSummaryText([], ''), '0 acknowledgements for 0 customers · no current terms version set');
  assert.equal(termsAckSummaryText(normalizeTermsAckList([ack()]), 'v1'), '1 acknowledgement for 1 customer · current terms version v1');
});

test('upsert never mutates its input list', () => {
  const list = normalizeTermsAckList([ack()]);
  const snapshot = JSON.stringify(list);
  upsertTermsAck(list, ack({ id: 'TA-2', termsVersion: 'v2' }));
  removeTermsAck(list, 'TA-1');
  assert.equal(JSON.stringify(list), snapshot);
});

test('HTML escapes markup and the status line reads plainly', () => {
  const list = normalizeTermsAckList([ack({ customerName: '<b>Ahmed</b>', recordedBy: '"Saad"' })]);
  const html = termsAckHtml(list);
  assert.ok(!html.includes('<b>Ahmed</b>'));
  assert.ok(html.includes('&lt;b&gt;Ahmed&lt;/b&gt;'));
  assert.ok(termsAckHtml([]).includes('No terms acknowledgements recorded yet.'));
  const pending = termsAckStatusHtml(customerTermsStatus(list, 'C-1', 'v9'));
  assert.match(pending, /not yet acknowledged/);
  assert.match(pending, /never assumed/);
  assert.match(termsAckStatusHtml(customerTermsStatus(list, 'C-1', '')), /No current terms version set yet/);
});

test('CSV quotes commas and quotes, and the filename carries the date', () => {
  const list = normalizeTermsAckList([ack({ customerName: 'Ahmed, Jr.', recordedBy: 'Saad "Boss"' })]);
  const csv = termsAckCsv(list);
  assert.ok(csv.startsWith('Customer,Customer name,Terms version,Date,How acknowledged,Recorded by'));
  assert.ok(csv.includes('"Ahmed, Jr."'));
  assert.ok(csv.includes('"Saad ""Boss"""'));
  assert.equal(termsAckFilename('2026-11-04'), 'terms-ack-2026-11-04.csv');
  assert.equal(termsAckFilename('2026-02-30'), 'terms-ack-undated.csv');
});

test('module purity fence: no bill, payment, package, or lifecycle field is named', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(join(here, '..', 'terms-ack.js'), 'utf8');
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('state.customers'));
  for (const forbidden of ['billId', 'paymentId', 'packageSpeed', 'lifecycle', 'dueAmount', 'outstanding']) {
    assert.ok(!source.includes(forbidden), `module must not name ${forbidden}`);
  }
});
