import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeTimelineEntry,
  normalizeTimelineEntryList,
  collectTimelineEntries,
  timelineForCustomer,
  timelineCustomers,
  timelineSummaryText,
  timelineEntryText,
  timelineHtml,
  timelineAllHtml,
  timelineCustomerHtml,
  timelineCsv,
  timelineFilename,
} from '../comms-timeline.js';

const dir = dirname(fileURLToPath(import.meta.url));

const entry = (over = {}) => ({
  customerId: 'Cust A',
  type: 'Service-change confirmation',
  sent: true,
  sentDate: '2026-11-01',
  title: 'Package changed to 20 Mbps',
  ...over,
});

test('half-formed entries are refused', () => {
  assert.equal(normalizeTimelineEntry(entry({ customerId: '' })), null);
  assert.equal(normalizeTimelineEntry(entry({ type: '' })), null);
  assert.equal(normalizeTimelineEntry(entry({ title: '' })), null);
  assert.equal(normalizeTimelineEntry(entry({ sentDate: '' })), null);
  assert.equal(normalizeTimelineEntry(entry({ sentDate: '2026-02-29' })), null);
  assert.equal(normalizeTimelineEntry(entry({ sentDate: '2026-04-31' })), null);
  assert.equal(normalizeTimelineEntry(entry({ sentDate: '2026-13-01' })), null);
  assert.equal(normalizeTimelineEntry(entry({ sentDate: '01-11-2026' })), null);
  assert.equal(normalizeTimelineEntry(null), null);
  assert.equal(normalizeTimelineEntry('nope'), null);
});

test('leap-day sent dates are accepted only in leap years', () => {
  assert.notEqual(normalizeTimelineEntry(entry({ sentDate: '2024-02-29' })), null);
  assert.equal(normalizeTimelineEntry(entry({ sentDate: '2025-02-29' })), null);
});

test('an unsent draft never appears, even with a date on it', () => {
  assert.equal(normalizeTimelineEntry(entry({ sent: false })), null);
  assert.equal(normalizeTimelineEntry(entry({ sent: undefined })), null);
  assert.equal(normalizeTimelineEntry(entry({ sent: 'yes' })), null);
  assert.deepEqual(normalizeTimelineEntryList([
    entry({ sent: false }),
    entry({ sentDate: '2026-11-02', title: 'Second' }),
  ]).map((row) => row.title), ['Second']);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = entry({ billId: 'B-1', amount: 500, extra: 'x' });
  const clean = normalizeTimelineEntry(raw);
  assert.deepEqual(Object.keys(clean).sort(), ['customerId', 'sent', 'sentDate', 'title', 'type']);
  assert.equal(raw.billId, 'B-1');
  const list = [entry()];
  const out = normalizeTimelineEntryList(list);
  assert.notEqual(out[0], list[0]);
  assert.equal(list[0].sent, true);
});

test('exact duplicate rows are listed once', () => {
  const rows = normalizeTimelineEntryList([entry(), entry(), entry({ title: 'Other' })]);
  assert.equal(rows.length, 2);
});

test('the timeline is in date order, then type, then title', () => {
  const rows = timelineForCustomer([
    entry({ sentDate: '2026-11-03', type: 'Referral thank-you', title: 'B' }),
    entry({ sentDate: '2026-11-01', type: 'Referral thank-you', title: 'A' }),
    entry({ sentDate: '2026-11-01', type: 'Education note shared', title: 'Z' }),
    entry({ sentDate: '2026-11-01', type: 'Education note shared', title: 'A' }),
    entry({ customerId: 'Cust B', sentDate: '2026-10-01' }),
  ], 'cust a');
  assert.deepEqual(rows.map((row) => `${row.sentDate}|${row.type}|${row.title}`), [
    '2026-11-01|Education note shared|A',
    '2026-11-01|Education note shared|Z',
    '2026-11-01|Referral thank-you|A',
    '2026-11-03|Referral thank-you|B',
  ]);
});

test('customer matching is case-insensitive and empty means no timeline', () => {
  assert.equal(timelineForCustomer([entry()], 'CUST a').length, 1);
  assert.equal(timelineForCustomer([entry()], '').length, 0);
  assert.equal(timelineForCustomer([entry()], null).length, 0);
});

test('customers list keeps first spelling, A-Z', () => {
  assert.deepEqual(timelineCustomers([
    entry({ customerId: 'zebra' }),
    entry({ customerId: 'Cust A' }),
    entry({ customerId: 'CUST A', title: 'Other' }),
    entry({ sent: false, customerId: 'ghost' }),
  ]), ['Cust A', 'zebra']);
});

test('collectTimelineEntries reads only sent source records', () => {
  const rows = collectTimelineEntries({
    changeConfirmations: [
      { customerId: 'Cust A', agreedChange: 'Package changed', sent: true, sentDate: '2026-11-02' },
      { customerId: 'Cust A', agreedChange: 'Never sent', sent: false, sentDate: '' },
      { customerId: 'Cust A', agreedChange: 'Bad date', sent: true, sentDate: '2026-02-30' },
    ],
    referralThanks: [
      { referrerId: 'Cust A', newCustomerId: 'Cust B', sent: true, sentDate: '2026-11-01' },
      { referrerId: 'Cust A', newCustomerId: 'Cust C', sent: false, sentDate: '' },
    ],
    educationNotes: [{ id: 'EDU-1', title: 'How to restart your ONU' }],
    educationShares: [
      { customerId: 'Cust A', noteId: 'EDU-1', sharedDate: '2026-11-03' },
      { customerId: 'Cust A', noteId: 'EDU-9', sharedDate: '2026-11-04' },
    ],
    greetingDates: [
      { customer: 'Cust A', kind: 'birthday', sentDate: '2026-11-05' },
      { customer: 'Cust A', kind: 'anniversary', sentDate: '' },
    ],
  });
  assert.deepEqual(rows.map((row) => `${row.sentDate}|${row.type}|${row.title}`), [
    '2026-11-01|Referral thank-you|Thank-you for referring Cust B',
    '2026-11-02|Service-change confirmation|Package changed',
    '2026-11-03|Education note shared|How to restart your ONU',
    '2026-11-04|Education note shared|Education note',
    '2026-11-05|Greeting draft|Birthday greeting',
  ]);
});

test('collectTimelineEntries tolerates missing or malformed sources', () => {
  assert.deepEqual(collectTimelineEntries(null), []);
  assert.deepEqual(collectTimelineEntries({}), []);
  assert.deepEqual(collectTimelineEntries({ changeConfirmations: 'nope' }), []);
  assert.deepEqual(collectTimelineEntries({ educationShares: [null, 'x'] }), []);
});

test('there is no way to edit or delete an entry through the timeline', () => {
  const source = readFileSync(join(dir, '..', 'comms-timeline.js'), 'utf8');
  assert.ok(!source.includes('export function upsert'));
  assert.ok(!source.includes('export function remove'));
  assert.ok(!source.includes('export function mark'));
  assert.ok(!source.includes('export function update'));
});

test('summary, entry text, html escaping, csv, and filename', () => {
  assert.equal(timelineSummaryText([entry(), entry({ title: 'Other' })]), '2 sent messages for 1 customer (read-only timeline; nothing here edits a past entry or sends anything).');
  assert.equal(timelineSummaryText([]), '0 sent messages for 0 customers (read-only timeline; nothing here edits a past entry or sends anything).');
  assert.equal(timelineEntryText(entry()), '2026-11-01 — Service-change confirmation: Package changed to 20 Mbps');
  assert.equal(timelineEntryText(entry({ sent: false })), '');
  assert.ok(timelineHtml(entry({ title: '<b>&"x"' })).includes('&lt;b&gt;&amp;&quot;x&quot;'));
  assert.equal(timelineHtml(entry({ sent: false })), '');
  assert.equal(timelineAllHtml([]), '<p>No sent messages on the timeline.</p>');
  assert.equal(timelineCustomerHtml([entry()], 'someone else'), '<p>No sent messages for this customer.</p>');
  assert.ok(timelineCustomerHtml([entry()], 'Cust A').includes('2026-11-01'));
  const csv = timelineCsv([entry({ title: 'Say "hi", friend' })]);
  assert.ok(csv.startsWith('customerId,type,sentDate,title\n'));
  assert.ok(csv.includes('"Say ""hi"", friend"'));
  assert.equal(timelineFilename(), 'comms-timeline.csv');
});

test('list normalization: non-arrays become empty lists', () => {
  assert.deepEqual(normalizeTimelineEntryList(null), []);
  assert.deepEqual(normalizeTimelineEntryList('nope'), []);
});

test('purity fence: the module never reads storage, the clock, or the network', () => {
  const source = readFileSync(join(dir, '..', 'comms-timeline.js'), 'utf8');
  assert.ok(!source.includes('new Date('));
  assert.ok(!source.includes('Date.now('));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('fetch('));
});

test('panel element ids are present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['ctHeading', 'ctSummary', 'ctExportBtn', 'ctFilter', 'ctBody']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wires the comms-timeline panel and render loop', () => {
  const source = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.ok(source.includes("from './comms-timeline.js'"));
  assert.ok(source.includes('renderCommsTimeline();'));
});

test('no standalone OLT word added to app.js', () => {
  const source = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.ok(!/(^|[^A-Za-z])OLT([^A-Za-z]|$)/.test(source));
});
