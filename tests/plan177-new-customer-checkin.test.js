import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeNewCustomerCheckin,
  normalizeNewCustomerCheckinList,
  findNewCustomerCheckin,
  upsertNewCustomerCheckin,
  removeNewCustomerCheckin,
  markNewCustomerCheckedIn,
  windowEndDate,
  isInFirstMonth,
  newCustomerCheckinList,
  checkinsForCustomer,
  newCustomerCheckinCustomers,
  newCustomerCheckinDraftText,
  newCustomerCheckinSummaryText,
  newCustomerCheckinHtml,
  newCustomerCheckinAllHtml,
  newCustomerCheckinCsv,
  newCustomerCheckinFilename,
} from '../new-customer-checkin.js';

const dir = dirname(fileURLToPath(import.meta.url));

const record = (over = {}) => ({
  id: 'NC-1',
  customerId: 'Cust A',
  connectionDate: '2026-11-04',
  mohalla: 'Mohalla One',
  lastContactDate: '',
  ...over,
});

test('half-formed records are refused outright', () => {
  assert.equal(normalizeNewCustomerCheckin(null), null);
  assert.equal(normalizeNewCustomerCheckin({}), null);
  assert.equal(normalizeNewCustomerCheckin(record({ id: '' })), null);
  assert.equal(normalizeNewCustomerCheckin(record({ customerId: '   ' })), null);
  assert.equal(normalizeNewCustomerCheckin(record({ mohalla: '' })), null);
  assert.equal(normalizeNewCustomerCheckin(record({ connectionDate: '' })), null);
  assert.equal(normalizeNewCustomerCheckin(record({ connectionDate: '2026-13-01' })), null);
  assert.equal(normalizeNewCustomerCheckin(record({ connectionDate: '04-11-2026' })), null);
  assert.equal(normalizeNewCustomerCheckin(record({ lastContactDate: '2026-02-30' })), null);
});

test('strict dates: 31-day months pass, February rules hold', () => {
  assert.ok(normalizeNewCustomerCheckin(record({ connectionDate: '2026-08-31' })));
  assert.ok(normalizeNewCustomerCheckin(record({ connectionDate: '2026-10-31' })));
  assert.ok(normalizeNewCustomerCheckin(record({ connectionDate: '2026-12-31' })));
  assert.equal(normalizeNewCustomerCheckin(record({ connectionDate: '2026-11-31' })), null);
  assert.equal(normalizeNewCustomerCheckin(record({ connectionDate: '2026-02-29' })), null);
  assert.ok(normalizeNewCustomerCheckin(record({ connectionDate: '2024-02-29' })));
  assert.equal(normalizeNewCustomerCheckin(record({ connectionDate: '2026-02-30' })), null);
});

test('unknown fields are dropped, never stored', () => {
  const item = normalizeNewCustomerCheckin(record({
    billId: 'B-9', paymentId: 'P-9', packageId: 'PK-9', sendNow: true, onboardingStep: 'cable',
  }));
  assert.deepEqual(Object.keys(item).sort(), ['connectionDate', 'customerId', 'id', 'lastContactDate', 'mohalla']);
});

test('duplicate ids are never rewritten', () => {
  const base = upsertNewCustomerCheckin([], record());
  assert.equal(upsertNewCustomerCheckin(base, record()).length, 1);
  const changed = upsertNewCustomerCheckin(base, record({ mohalla: 'Mohalla Two' }));
  assert.equal(changed.length, 1);
  assert.equal(changed[0].mohalla, 'Mohalla One');
});

test('one record per customer, case-insensitive', () => {
  const base = upsertNewCustomerCheckin([], record());
  assert.equal(upsertNewCustomerCheckin(base, record({ id: 'NC-2', customerId: 'cust a' })).length, 1);
  assert.equal(upsertNewCustomerCheckin(base, record({ id: 'NC-2', customerId: 'Cust B' })).length, 2);
});

test('find and remove work by id', () => {
  const base = upsertNewCustomerCheckin(upsertNewCustomerCheckin([], record()), record({ id: 'NC-2', customerId: 'Cust B' }));
  assert.equal(findNewCustomerCheckin(base, 'NC-2').customerId, 'Cust B');
  assert.equal(findNewCustomerCheckin(base, 'NC-9'), null);
  const removed = removeNewCustomerCheckin(base, 'NC-1');
  assert.equal(removed.length, 1);
  assert.equal(removed[0].id, 'NC-2');
});

test('checking in updates only the last-contact date', () => {
  const base = upsertNewCustomerCheckin([], record());
  const checked = markNewCustomerCheckedIn(base, 'NC-1', '2026-11-10');
  assert.equal(checked[0].lastContactDate, '2026-11-10');
  assert.equal(checked[0].connectionDate, '2026-11-04');
  assert.equal(checked[0].mohalla, 'Mohalla One');
  // Bad contact date leaves the record unchanged.
  assert.equal(markNewCustomerCheckedIn(base, 'NC-1', '2026-11-31')[0].lastContactDate, '');
  // Unknown id leaves the list unchanged.
  assert.deepEqual(markNewCustomerCheckedIn(base, 'NC-9', '2026-11-10'), base);
});

test('window end is one calendar month after connection, clamped', () => {
  assert.equal(windowEndDate('2026-11-04'), '2026-12-04');
  assert.equal(windowEndDate('2026-12-15'), '2027-01-15');
  assert.equal(windowEndDate('2026-01-31'), '2026-02-28');
  assert.equal(windowEndDate('2024-01-31'), '2024-02-29');
  assert.equal(windowEndDate('not-a-date'), null);
});

test('first-month window: connection day in, window-end day out', () => {
  const item = record();
  assert.equal(isInFirstMonth(item, '2026-11-04'), true);
  assert.equal(isInFirstMonth(item, '2026-12-03'), true);
  assert.equal(isInFirstMonth(item, '2026-12-04'), false);
  assert.equal(isInFirstMonth(item, '2026-11-03'), false);
  assert.equal(isInFirstMonth(item, 'garbage'), false);
  assert.equal(isInFirstMonth(null, '2026-11-04'), false);
});

test('timed list: only in-window customers, oldest connection first', () => {
  const base = upsertNewCustomerCheckin(
    upsertNewCustomerCheckin(
      upsertNewCustomerCheckin(
        upsertNewCustomerCheckin([], record({ id: 'NC-3', customerId: 'Cust C', connectionDate: '2026-11-20' })),
        record({ id: 'NC-1', customerId: 'Cust A', connectionDate: '2026-11-04' })),
      record({ id: 'NC-2', customerId: 'Cust B', connectionDate: '2026-10-01' })),
    record({ id: 'NC-4', customerId: 'Cust D', connectionDate: '2026-12-01' }));
  const listed = newCustomerCheckinList(base, '2026-11-25');
  // NC-2 left the window (Oct 1 + one month = Nov 1); NC-4 connects in the future.
  assert.deepEqual(listed.map((item) => item.id), ['NC-1', 'NC-3']);
  // Same connection date orders by customer A-Z.
  const tied = upsertNewCustomerCheckin(base, record({ id: 'NC-5', customerId: 'Cust A2', connectionDate: '2026-11-04' }));
  assert.deepEqual(newCustomerCheckinList(tied, '2026-11-25').map((item) => item.id), ['NC-1', 'NC-5', 'NC-3']);
});

test('customer views are case-insensitive, customers list keeps first spelling', () => {
  const base = upsertNewCustomerCheckin(
    upsertNewCustomerCheckin([], record()),
    record({ id: 'NC-2', customerId: 'Cust B' }));
  assert.equal(checkinsForCustomer(base, 'cust a').length, 1);
  assert.equal(checkinsForCustomer(base, '').length, 0);
  assert.deepEqual(newCustomerCheckinCustomers(base), ['Cust A', 'Cust B']);
});

test('check-in draft names the customer and promises nothing', () => {
  const draft = newCustomerCheckinDraftText(record());
  assert.ok(draft.includes('Cust A'));
  assert.ok(draft.includes('Mohalla One'));
  assert.ok(draft.includes('2026-11-04'));
  assert.ok(!/discount|offer|credit|free package/i.test(draft));
  assert.equal(newCustomerCheckinDraftText(null), '');
});

test('summary text counts in-window and checked-in customers', () => {
  const base = upsertNewCustomerCheckin(
    upsertNewCustomerCheckin([], record()),
    record({ id: 'NC-2', customerId: 'Cust B', connectionDate: '2026-10-01' }));
  const summary = newCustomerCheckinSummaryText(base, '2026-11-25');
  assert.ok(summary.includes('1 new customer(s)'));
  assert.ok(summary.includes('0 already checked in'));
  const checked = markNewCustomerCheckedIn(base, 'NC-1', '2026-11-10');
  assert.ok(newCustomerCheckinSummaryText(checked, '2026-11-25').includes('1 already checked in'));
});

test('HTML escapes markup, all-HTML handles an empty list', () => {
  const html = newCustomerCheckinHtml(record({ customerId: '<b>Cust</b>', mohalla: 'M & M' }));
  assert.ok(!html.includes('<b>Cust</b>'));
  assert.ok(html.includes('&lt;b&gt;Cust&lt;/b&gt;'));
  assert.ok(html.includes('M &amp; M'));
  assert.equal(newCustomerCheckinHtml(null), '');
  assert.ok(newCustomerCheckinAllHtml([]).includes('No new-customer check-in records.'));
});

test('CSV export and filename', () => {
  const csv = newCustomerCheckinCsv([record()]);
  assert.ok(csv.startsWith('id,customerId,connectionDate,mohalla,lastContactDate'));
  assert.ok(csv.includes('"NC-1","Cust A","2026-11-04","Mohalla One",""'));
  assert.equal(newCustomerCheckinFilename(), 'new-customer-checkins.csv');
});

test('inputs are never mutated', () => {
  const input = record();
  const snapshot = JSON.stringify(input);
  upsertNewCustomerCheckin([], input);
  markNewCustomerCheckedIn([input], 'NC-1', '2026-11-10');
  assert.equal(JSON.stringify(input), snapshot);
});

test('list normalization drops bad records and non-lists', () => {
  assert.deepEqual(normalizeNewCustomerCheckinList(null), []);
  assert.deepEqual(normalizeNewCustomerCheckinList([record(), record({ id: '' })]).length, 1);
});

test('purity fence: the module never reads storage, the clock, or the network', () => {
  const source = readFileSync(join(dir, '..', 'new-customer-checkin.js'), 'utf8');
  assert.ok(!source.includes('new Date('));
  assert.ok(!source.includes('Date.now('));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('fetch('));
});

test('panel element ids are present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['ncHeading', 'ncSummary', 'ncExportBtn', 'ncCustomer', 'ncConnectionDate', 'ncMohalla', 'ncSaveBtn', 'ncCheckinId', 'ncCheckinDate', 'ncCheckinBtn', 'ncRemoveId', 'ncRemoveBtn', 'ncFilter', 'ncBody']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wires the new-customer check-in panel and render loop', () => {
  const source = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.ok(source.includes("from './new-customer-checkin.js'"));
  assert.ok(source.includes('shahdara_new_customer_checkin_v1'));
  assert.ok(source.includes('renderNewCustomerCheckin();'));
});

test('no standalone OLT word added to app.js', () => {
  const source = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.ok(!/(^|[^A-Za-z])OLT([^A-Za-z]|$)/.test(source));
});
