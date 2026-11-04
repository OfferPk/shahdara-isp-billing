import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  VISIT_WINDOWS,
  VISIT_WINDOW_LABELS,
  normalizeVisitWindow,
  normalizeVisitWindowList,
  findVisitWindow,
  recordVisitWindow,
  updateVisitWindow,
  removeVisitWindow,
  visitWindowForCustomer,
  visitWindowCustomers,
  visitWindowsForWindow,
  orderCustomersByWindow,
  visitWindowText,
  visitWindowSummaryText,
  visitWindowHtml,
  visitWindowAllHtml,
  visitWindowOrderedHtml,
  visitWindowCsv,
  visitWindowFilename,
} from '../visit-window.js';

const dir = dirname(fileURLToPath(import.meta.url));

const record = (over = {}) => ({
  id: 'VW-1',
  customerId: 'Cust A',
  window: 'morning',
  note: 'After school run.',
  ...over,
});

test('half-formed record refused: no id or no customer', () => {
  assert.equal(normalizeVisitWindow({ customerId: 'Cust A' }), null);
  assert.equal(normalizeVisitWindow({ id: 'VW-1' }), null);
  assert.equal(normalizeVisitWindow(null), null);
  assert.equal(normalizeVisitWindow('nope'), null);
  assert.equal(recordVisitWindow([], { customerId: 'Cust A' }).length, 0);
});

test('window: fixed values only, case-insensitive, unknown or missing becomes any-time, never guessed', () => {
  assert.equal(normalizeVisitWindow(record({ window: 'EVENING' })).window, 'evening');
  assert.equal(normalizeVisitWindow(record({ window: 'afternoon' })).window, 'afternoon');
  assert.equal(normalizeVisitWindow(record({ window: 'midnight' })).window, 'any-time');
  assert.equal(normalizeVisitWindow(record({ window: '' })).window, 'any-time');
  assert.equal(normalizeVisitWindow(record({ window: undefined })).window, 'any-time');
  assert.deepEqual(VISIT_WINDOWS, ['morning', 'afternoon', 'evening', 'any-time']);
  assert.equal(VISIT_WINDOW_LABELS.morning, 'Morning');
});

test('unknown fields dropped: no visit, bill, payment, ticket, booking, or sending field can ever exist', () => {
  const item = normalizeVisitWindow(record({
    visitOutcome: 'done', billId: 'B-1', paymentId: 'P-1', ticketId: 'T-1',
    bookingDate: '2026-11-01', sendTo: 'someone', promise: true,
  }));
  assert.deepEqual(Object.keys(item).sort(), ['customerId', 'id', 'note', 'window']);
});

test('duplicate id never rewritten by recording', () => {
  const list = [record()];
  assert.deepEqual(recordVisitWindow(list, record()), list);
  assert.deepEqual(recordVisitWindow(list, record({ window: 'evening' })), list);
  assert.equal(recordVisitWindow([], record()).length, 1);
});

test('one record per customer, case-insensitive', () => {
  const list = [record()];
  assert.equal(recordVisitWindow(list, record({ id: 'VW-2', customerId: 'cust a' })).length, 1);
  assert.equal(recordVisitWindow(list, record({ id: 'VW-2', customerId: 'Cust B' })).length, 2);
});

test('find and remove', () => {
  const list = [record(), record({ id: 'VW-2', customerId: 'Cust B', window: 'evening' })];
  assert.equal(findVisitWindow(list, 'VW-2').customerId, 'Cust B');
  assert.equal(findVisitWindow(list, 'VW-9'), null);
  assert.equal(removeVisitWindow(list, 'VW-1').length, 1);
  assert.equal(removeVisitWindow(list, 'VW-9').length, 2);
});

test('edit replaces only window and note, never id or customer', () => {
  const list = [record()];
  const updated = updateVisitWindow(list, 'VW-1', { window: 'evening', note: 'After work.', customerId: 'Cust Z', id: 'VW-9' });
  assert.equal(updated[0].window, 'evening');
  assert.equal(updated[0].note, 'After work.');
  assert.equal(updated[0].customerId, 'Cust A');
  assert.equal(updated[0].id, 'VW-1');
  const badWindow = updateVisitWindow(list, 'VW-1', { window: 'midnight' });
  assert.equal(badWindow[0].window, 'any-time');
  assert.deepEqual(updateVisitWindow(list, 'VW-9', { window: 'evening' }), list);
  assert.deepEqual(updateVisitWindow(list, 'VW-1', null), list);
});

test('window lookup: recorded window, or any-time for a customer with no record', () => {
  const list = [record()];
  assert.equal(visitWindowForCustomer(list, 'Cust A'), 'morning');
  assert.equal(visitWindowForCustomer(list, 'cust a'), 'morning');
  assert.equal(visitWindowForCustomer(list, 'Cust Nobody'), 'any-time');
  assert.equal(visitWindowForCustomer([], 'Cust A'), 'any-time');
});

test('customers list: first spelling kept, A-Z', () => {
  const list = [record({ customerId: 'cust b' }), record({ id: 'VW-2', customerId: 'Cust A' }), record({ id: 'VW-3', customerId: 'Cust B' })];
  assert.deepEqual(visitWindowCustomers(list), ['Cust A', 'cust b']);
});

test('filter by window returns only that window', () => {
  const list = [record(), record({ id: 'VW-2', customerId: 'Cust B', window: 'evening' }), record({ id: 'VW-3', customerId: 'Cust C', window: 'any-time' })];
  assert.deepEqual(visitWindowsForWindow(list, 'evening').map((item) => item.id), ['VW-2']);
  assert.deepEqual(visitWindowsForWindow(list, 'ANY-TIME').map((item) => item.id), ['VW-3']);
  assert.deepEqual(visitWindowsForWindow(list, 'midnight').map((item) => item.id), ['VW-3']);
});

test('queue ordering: morning, afternoon, evening, any-time, then customer A-Z; unrecorded last as any-time', () => {
  const list = [
    record({ customerId: 'Cust Z', window: 'evening' }),
    record({ customerId: 'Cust B', window: 'morning' }),
    record({ customerId: 'Cust A', window: 'morning' }),
    record({ customerId: 'Cust M', window: 'afternoon' }),
  ];
  const ordered = orderCustomersByWindow(list, ['Cust New', 'Cust Z', 'Cust B', 'Cust A', 'Cust M', 'Cust B']);
  assert.deepEqual(ordered.map((item) => item.customerId), ['Cust A', 'Cust B', 'Cust M', 'Cust Z', 'Cust New']);
  assert.deepEqual(ordered.map((item) => item.window), ['morning', 'morning', 'afternoon', 'evening', 'any-time']);
  assert.equal(ordered[4].note, '');
  assert.equal(orderCustomersByWindow(list, []).length, 0);
  assert.equal(orderCustomersByWindow(list, 'nope').length, 0);
});

test('window text states the preference plainly and says it is not a booking or a promise', () => {
  assert.equal(
    visitWindowText(record()),
    'Preferred visit window for Cust A: Morning. Note: After school run. This is a preference only, not a booking or a promise.',
  );
  assert.equal(
    visitWindowText(record({ note: '' })),
    'Preferred visit window for Cust A: Morning. This is a preference only, not a booking or a promise.',
  );
  assert.equal(visitWindowText(null), '');
  assert.equal(visitWindowSummaryText([record()]), '1 preferred visit window for 1 customer');
  assert.equal(visitWindowSummaryText([]), '0 preferred visit windows for 0 customers');
});

test('ordered HTML keeps the caller order for the visit queue view', () => {
  const html = visitWindowOrderedHtml([record({ customerId: 'Cust Z' }), record({ id: 'VW-2', customerId: 'Cust A' })]);
  assert.ok(html.indexOf('Cust Z') < html.indexOf('Cust A'));
  assert.equal(visitWindowOrderedHtml([]), '<p>No preferred visit windows recorded.</p>');
});

test('HTML escapes customer text and lists records customer A-Z', () => {
  const html = visitWindowAllHtml([record({ customerId: 'Cust <B> & Sons', note: '<script>' })]);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /Cust &lt;B&gt; &amp; Sons/);
  assert.equal(visitWindowAllHtml([]), '<p>No preferred visit windows recorded.</p>');
  assert.equal(visitWindowHtml(null), '');
});

test('CSV export and filename', () => {
  const csv = visitWindowCsv([record({ note: 'Has a "gate", code 12' })]);
  assert.match(csv, /^id,customer,window,note\n/);
  assert.match(csv, /"Has a ""gate"", code 12"/);
  assert.equal(visitWindowFilename(), 'shahdara_visit_windows.csv');
});

test('inputs never mutated; list normalization tolerates junk', () => {
  const input = record({ extra: 'dropped' });
  const frozen = JSON.stringify(input);
  recordVisitWindow([], input);
  updateVisitWindow([input], 'VW-1', { note: 'Changed.' });
  removeVisitWindow([input], 'VW-1');
  assert.equal(JSON.stringify(input), frozen);
  assert.equal(normalizeVisitWindowList('nope').length, 0);
  assert.equal(normalizeVisitWindowList([record(), null, 'x']).length, 1);
});

test('purity fence: module never touches storage, network, or the clock', () => {
  const source = readFileSync(join(dir, '..', 'visit-window.js'), 'utf8');
  assert.doesNotMatch(source, /localStorage|fetch\(|XMLHttpRequest|new Date|Date\.now/);
});

test('panel wiring: all panel element ids exist in index.html, no standalone OLT in app.js', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['vwHeading', 'vwSummary', 'vwExportBtn', 'vwCustomer', 'vwWindow', 'vwNote', 'vwSaveBtn', 'vwEditId', 'vwEditWindow', 'vwEditNote', 'vwEditBtn', 'vwRemoveId', 'vwRemoveBtn', 'vwFilter', 'vwOrderFilter', 'vwBody']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
  const app = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.doesNotMatch(app, /(?<![A-Za-z])OLT(?![A-Za-z])/);
});
