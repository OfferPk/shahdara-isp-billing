import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeChangeConfirmation,
  normalizeChangeConfirmationList,
  findChangeConfirmation,
  upsertChangeConfirmation,
  removeChangeConfirmation,
  markChangeConfirmationSent,
  markChangeConfirmationUnsent,
  changeConfirmationsForCustomer,
  changeConfirmationCustomers,
  changeConfirmationSentList,
  changeConfirmationUnsentList,
  changeConfirmationText,
  changeConfirmationSummaryText,
  changeConfirmationHtml,
  changeConfirmationAllHtml,
  changeConfirmationCustomerHtml,
  changeConfirmationCsv,
  changeConfirmationFilename,
} from '../change-confirmation.js';

const dir = dirname(fileURLToPath(import.meta.url));

const draft = (over = {}) => ({
  id: 'CC-1',
  customerId: 'Cust A',
  changeDate: '2026-11-01',
  agreedChange: 'Move from 20 Mbps to 50 Mbps package',
  appliesFrom: '2026-12-01',
  unchanged: ['Mohalla', 'Billing day'],
  sent: false,
  sentDate: '',
  ...over,
});

test('plan167: half-formed draft refused (no id, customer, dates, or agreed change)', () => {
  assert.equal(normalizeChangeConfirmation(draft({ id: '  ' })), null);
  assert.equal(normalizeChangeConfirmation(draft({ customerId: '' })), null);
  assert.equal(normalizeChangeConfirmation(draft({ changeDate: '' })), null);
  assert.equal(normalizeChangeConfirmation(draft({ changeDate: '2026-02-30' })), null);
  assert.equal(normalizeChangeConfirmation(draft({ changeDate: '2026-04-31' })), null);
  assert.equal(normalizeChangeConfirmation(draft({ agreedChange: '' })), null);
  assert.equal(normalizeChangeConfirmation(draft({ appliesFrom: '' })), null);
  assert.equal(normalizeChangeConfirmation(draft({ appliesFrom: '2026-13-01' })), null);
  assert.equal(normalizeChangeConfirmation(draft({ sentDate: '2026-02-30' })), null);
  assert.equal(normalizeChangeConfirmation(null), null);
  assert.equal(normalizeChangeConfirmation('not an object'), null);
});

test('plan167: strict dates accept 31-day months and leap-day rules', () => {
  assert.ok(normalizeChangeConfirmation(draft({ changeDate: '2026-08-31' })));
  assert.ok(normalizeChangeConfirmation(draft({ changeDate: '2026-10-31' })));
  assert.ok(normalizeChangeConfirmation(draft({ changeDate: '2026-12-31' })));
  assert.ok(normalizeChangeConfirmation(draft({ changeDate: '2024-02-29' })));
  assert.equal(normalizeChangeConfirmation(draft({ changeDate: '2026-02-29' })), null);
  assert.equal(normalizeChangeConfirmation(draft({ changeDate: '2026-09-31' })), null);
  assert.equal(normalizeChangeConfirmation(draft({ changeDate: '2026-11-31' })), null);
});

test('plan167: unchanged list is trimmed, empties dropped, non-array becomes empty', () => {
  assert.deepEqual(normalizeChangeConfirmation(draft({ unchanged: ['  Mohalla  ', '', '  '] })).unchanged, ['Mohalla']);
  assert.deepEqual(normalizeChangeConfirmation(draft({ unchanged: undefined })).unchanged, []);
  assert.deepEqual(normalizeChangeConfirmation(draft({ unchanged: 'Mohalla' })).unchanged, []);
  assert.equal(normalizeChangeConfirmation({}), null);
});

test('plan167: unknown fields are dropped', () => {
  const clean = normalizeChangeConfirmation(draft({ packageName: '50 Mbps', billAmount: 2500, status: 'active' }));
  assert.equal(clean.packageName, undefined);
  assert.equal(clean.billAmount, undefined);
  assert.equal(clean.status, undefined);
  assert.equal(clean.customerId, 'Cust A');
});

test('plan167: duplicate ids are never rewritten', () => {
  const before = [draft()];
  assert.deepEqual(upsertChangeConfirmation(before, draft()), before);
  assert.deepEqual(upsertChangeConfirmation(before, draft({ agreedChange: 'Pause for one month.' })), before);
  assert.equal(upsertChangeConfirmation(before, draft({ id: 'CC-2' })).length, 2);
});

test('plan167: find and remove by id', () => {
  const list = [draft(), draft({ id: 'CC-2', customerId: 'Cust B' })];
  assert.equal(findChangeConfirmation(list, 'CC-2').customerId, 'Cust B');
  assert.equal(findChangeConfirmation(list, 'CC-9'), null);
  assert.equal(findChangeConfirmation(list, ''), null);
  assert.deepEqual(removeChangeConfirmation(list, 'CC-1').map((item) => item.id), ['CC-2']);
  assert.equal(removeChangeConfirmation(list, '').length, 2);
});

test('plan167: customer view newest first, case-insensitive match', () => {
  const list = [
    draft({ id: 'CC-1', changeDate: '2026-11-01' }),
    draft({ id: 'CC-2', changeDate: '2026-11-05' }),
    draft({ id: 'CC-3', changeDate: '2026-11-05', customerId: 'CUST A' }),
    draft({ id: 'CC-4', customerId: 'Cust B' }),
  ];
  assert.deepEqual(changeConfirmationsForCustomer(list, 'cust a').map((item) => item.id), ['CC-2', 'CC-3', 'CC-1']);
  assert.deepEqual(changeConfirmationsForCustomer(list, ''), []);
  assert.deepEqual(changeConfirmationsForCustomer(list, 'Cust C'), []);
});

test('plan167: customers list keeps first spelling, sorted A-Z', () => {
  const list = [draft({ customerId: 'Cust B' }), draft({ id: 'CC-2', customerId: 'cust a' }), draft({ id: 'CC-3', customerId: 'Cust A' })];
  assert.deepEqual(changeConfirmationCustomers(list), ['Cust B', 'cust a']);
  assert.deepEqual(changeConfirmationCustomers('not a list'), []);
});

test('plan167: mark sent only with a strict date, mark unsent clears both', () => {
  const list = [draft()];
  const sent = markChangeConfirmationSent(list, 'CC-1', '2026-11-04');
  assert.equal(sent[0].sent, true);
  assert.equal(sent[0].sentDate, '2026-11-04');
  assert.deepEqual(markChangeConfirmationSent(list, 'CC-1', '2026-02-30'), list);
  assert.deepEqual(markChangeConfirmationSent(list, 'CC-9', '2026-11-04'), list);
  const unsent = markChangeConfirmationUnsent(sent, 'CC-1');
  assert.equal(unsent[0].sent, false);
  assert.equal(unsent[0].sentDate, '');
  assert.deepEqual(markChangeConfirmationUnsent(list, ''), list);
});

test('plan167: sent and unsent lists split cleanly', () => {
  const list = [draft(), draft({ id: 'CC-2', sent: true, sentDate: '2026-11-04' })];
  assert.deepEqual(changeConfirmationSentList(list).map((item) => item.id), ['CC-2']);
  assert.deepEqual(changeConfirmationUnsentList(list).map((item) => item.id), ['CC-1']);
});

test('plan167: draft text states change, start date, and unchanged exactly as entered', () => {
  assert.equal(
    changeConfirmationText(draft()),
    'Agreed change for Cust A: Move from 20 Mbps to 50 Mbps package. Applies from 2026-12-01. Unchanged: Mohalla; Billing day.',
  );
  assert.ok(changeConfirmationText(draft({ unchanged: [] })).includes('Unchanged: nothing listed.'));
  assert.equal(changeConfirmationText(null), '');
  assert.equal(changeConfirmationText(draft({ agreedChange: '' })), '');
});

test('plan167: summary text counts drafts, customers, and sent', () => {
  const list = [draft(), draft({ id: 'CC-2', sent: true, sentDate: '2026-11-04' }), draft({ id: 'CC-3', customerId: 'Cust B' })];
  assert.equal(changeConfirmationSummaryText(list), '3 confirmation drafts · 2 customers · 1 sent');
  assert.equal(changeConfirmationSummaryText([]), '0 confirmation drafts · 0 customers · 0 sent');
});

test('plan167: HTML escapes markup in customer, change, and unchanged', () => {
  const html = changeConfirmationHtml(draft({
    customerId: 'Cust <A>', agreedChange: '<script>alert(1)</script>', unchanged: ['<b>Mohalla</b>'],
  }));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('Cust &lt;A&gt;'));
  assert.ok(html.includes('&lt;b&gt;Mohalla&lt;/b&gt;'));
  assert.ok(html.includes('Not sent'));
  assert.equal(changeConfirmationHtml(null), '');
  assert.ok(changeConfirmationAllHtml([]).includes('No confirmation drafts'));
  assert.ok(changeConfirmationCustomerHtml([draft()], 'Cust C').includes('No confirmation drafts for this customer.'));
});

test('plan167: CSV carries only draft fields, with a stable filename', () => {
  const csv = changeConfirmationCsv([draft({ agreedChange: 'Fast, "really" fast' })]);
  assert.ok(csv.startsWith('id,customerId,changeDate,agreedChange,appliesFrom,unchanged,sent,sentDate\n'));
  assert.ok(csv.includes('"Fast, ""really"" fast"'));
  assert.ok(csv.includes('Mohalla; Billing day'));
  assert.equal(changeConfirmationFilename(), 'change-confirmations.csv');
});

test('plan167: inputs are never mutated', () => {
  const input = draft();
  const snapshot = JSON.stringify(input);
  normalizeChangeConfirmation(input);
  upsertChangeConfirmation([input], draft({ id: 'CC-2' }));
  markChangeConfirmationSent([input], 'CC-1', '2026-11-04');
  assert.equal(JSON.stringify(input), snapshot);
});

test('plan167: list normalization drops bad rows and later duplicate ids', () => {
  const list = normalizeChangeConfirmationList([
    draft(),
    draft({ agreedChange: '' }),
    draft({ id: 'CC-1', agreedChange: 'Pause for one month.' }),
    draft({ id: 'CC-2', customerId: 'Cust B' }),
    null,
  ]);
  assert.deepEqual(list.map((item) => item.id), ['CC-1', 'CC-2']);
  assert.deepEqual(normalizeChangeConfirmationList('not a list'), []);
});

test('plan167: module is pure — no storage, network, or document access', () => {
  const source = readFileSync(join(dir, '..', 'change-confirmation.js'), 'utf8');
  for (const forbidden of ['localStorage', 'sessionStorage', 'fetch(', 'XMLHttpRequest', 'document.', 'window.']) {
    assert.equal(source.includes(forbidden), false, `module must not use ${forbidden}`);
  }
});

test('plan167: panel element ids present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['ccSummary', 'ccExportBtn', 'ccCustomer', 'ccChangeDate', 'ccAgreedChange', 'ccAppliesFrom', 'ccUnchanged', 'ccSaveBtn', 'ccSentId', 'ccSentDate', 'ccMarkSentBtn', 'ccMarkUnsentBtn', 'ccRemoveId', 'ccRemoveBtn', 'ccFilter', 'ccCustomerBody', 'ccBody']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
