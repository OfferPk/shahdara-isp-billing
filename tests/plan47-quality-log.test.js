/**
 * plan47-quality-log.test.js — Plan 47: per-customer speed and
 * service-quality log.
 * Pins:
 * - each entry carries a date, both speed figures, and a location
 *   note; the profile shows entries in date order with the package
 *   speed alongside for comparison;
 * - impossible dates (2026-02-30), missing/non-finite/negative
 *   speeds, blank locations, and missing customers are refused,
 *   never stored half-formed; blank notes/ticket links stay null,
 *   never guessed;
 * - logging never touches a bill, payment, or ticket: the module
 *   holds no bill, payment, dBm, or ticket-status field, and inputs
 *   are never mutated; a ticket link is one-way only.
 * Synthetic data only; no ledger figure is ever changed by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidQualityDate,
  normalizeQualityLocation,
  normalizeQualityEntry,
  recordQualityEntry,
  entriesForCustomer,
  entriesForTicket,
  qualityEntriesWithComparison,
  qualityLogSummary,
  qualityLogSummaryText,
  qualityLogHtml,
  qualityLogCsv,
  qualityLogFilename,
} from '../quality-log.js';

const ENTRY = { id: 'q-1', customerId: 'c-1', date: '2026-11-02', downloadMbps: 12, uploadMbps: 4, location: 'near router', note: 'evening check' };

test('date validation: real dates pass, impossible dates fail', () => {
  assert.equal(isValidQualityDate('2026-11-02'), true);
  assert.equal(isValidQualityDate('2026-02-29'), false);
  assert.equal(isValidQualityDate('2026-02-30'), false);
  assert.equal(isValidQualityDate('2026-13-01'), false);
  assert.equal(isValidQualityDate('not-a-date'), false);
  assert.equal(isValidQualityDate(''), false);
});

test('location normalisation: plan-named spots canonical, own wording kept', () => {
  assert.equal(normalizeQualityLocation('near router'), 'Near router');
  assert.equal(normalizeQualityLocation('Near the router'), 'Near router');
  assert.equal(normalizeQualityLocation('far room'), 'Far room');
  assert.equal(normalizeQualityLocation('far-room'), 'Far room');
  assert.equal(normalizeQualityLocation('bedroom corner'), 'bedroom corner');
  assert.equal(normalizeQualityLocation('  '), null);
  assert.equal(normalizeQualityLocation(null), null);
});

test('entry validation: missing customer, bad date, bad speeds, blank location rejected', () => {
  assert.equal(normalizeQualityEntry({ ...ENTRY, customerId: '  ' }), null);
  assert.equal(normalizeQualityEntry({ ...ENTRY, date: '2026-02-30' }), null);
  assert.equal(normalizeQualityEntry({ ...ENTRY, downloadMbps: null }), null);
  assert.equal(normalizeQualityEntry({ ...ENTRY, downloadMbps: 'abc' }), null);
  assert.equal(normalizeQualityEntry({ ...ENTRY, downloadMbps: -1 }), null);
  assert.equal(normalizeQualityEntry({ ...ENTRY, uploadMbps: Number.NaN }), null);
  assert.equal(normalizeQualityEntry({ ...ENTRY, location: '' }), null);
  assert.equal(normalizeQualityEntry(null), null);
});

test('entry validation: zero speed is a real measurement, not a refusal', () => {
  const normalized = normalizeQualityEntry({ ...ENTRY, downloadMbps: 0, uploadMbps: 0 });
  assert.equal(normalized.downloadMbps, 0);
  assert.equal(normalized.uploadMbps, 0);
});

test('entry normalisation: speeds round to 2 decimals, blank note and ticket stay null', () => {
  const normalized = normalizeQualityEntry({ ...ENTRY, downloadMbps: 12.345, note: ' ', linkedTicketId: '' });
  assert.equal(normalized.downloadMbps, 12.35);
  assert.equal(normalized.note, null);
  assert.equal(normalized.linkedTicketId, null);
  assert.equal(normalized.location, 'Near router');
});

test('record: valid entry appends, invalid entry leaves the list unchanged', () => {
  const list = [ENTRY];
  const appended = recordQualityEntry(list, { ...ENTRY, id: 'q-2', date: '2026-11-03' });
  assert.equal(appended.length, 2);
  assert.equal(list.length, 1);
  assert.equal(recordQualityEntry(list, { ...ENTRY, id: 'q-3', date: '2026-02-30' }), list);
  assert.equal(recordQualityEntry(list, { ...ENTRY, id: 'q-3', downloadMbps: -5 }), list);
});

test('record: duplicate id replaces the earlier entry, never duplicates it', () => {
  const list = [ENTRY];
  const replaced = recordQualityEntry(list, { ...ENTRY, downloadMbps: 14 });
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].downloadMbps, 14);
  assert.equal(list[0].downloadMbps, 12);
});

test('record: inputs are never mutated', () => {
  const list = [ENTRY];
  const snapshot = JSON.stringify(list);
  const entry = { ...ENTRY, id: 'q-9', date: '2026-11-04' };
  const entrySnapshot = JSON.stringify(entry);
  recordQualityEntry(list, entry);
  assert.equal(JSON.stringify(list), snapshot);
  assert.equal(JSON.stringify(entry), entrySnapshot);
});

test('entries for customer: only that customer, date order, undated-free', () => {
  const list = [
    { ...ENTRY, id: 'q-2', date: '2026-11-05' },
    { ...ENTRY, id: 'q-3', customerId: 'c-2', date: '2026-11-01' },
    ENTRY,
  ];
  const rows = entriesForCustomer(list, 'c-1');
  assert.deepEqual(rows.map((row) => row.id), ['q-1', 'q-2']);
  assert.deepEqual(entriesForCustomer(list, 'c-2').map((row) => row.id), ['q-3']);
  assert.deepEqual(entriesForCustomer(list, ''), []);
});

test('ticket link: entries for a ticket, one-way only', () => {
  const list = [
    { ...ENTRY, id: 'q-1', linkedTicketId: 't-7' },
    { ...ENTRY, id: 'q-2', date: '2026-11-03', linkedTicketId: null },
  ];
  assert.deepEqual(entriesForTicket(list, 't-7').map((row) => row.id), ['q-1']);
  assert.deepEqual(entriesForTicket(list, 't-8'), []);
  // The entry carries no ticket status or bill field at all.
  assert.equal('status' in entriesForTicket(list, 't-7')[0], false);
  assert.equal('billId' in entriesForTicket(list, 't-7')[0], false);
});

test('comparison: above, at, below, and unknown when no package speed', () => {
  const rows = qualityEntriesWithComparison([
    { ...ENTRY, id: 'q-a', downloadMbps: 20 },
    { ...ENTRY, id: 'q-b', downloadMbps: 15 },
    { ...ENTRY, id: 'q-c', downloadMbps: 8 },
  ], 15);
  assert.deepEqual(rows.map((row) => row.comparison), ['above', 'at', 'below']);
  assert.equal(rows[0].packageSpeedMbps, 15);
  const unknown = qualityEntriesWithComparison([ENTRY], null);
  assert.equal(unknown[0].comparison, 'unknown');
  assert.equal(unknown[0].packageSpeedMbps, null);
});

test('summary: counts, latest date, averages, below-package count', () => {
  const summary = qualityLogSummary([
    { ...ENTRY, id: 'q-1', downloadMbps: 10, uploadMbps: 2 },
    { ...ENTRY, id: 'q-2', date: '2026-11-04', downloadMbps: 20, uploadMbps: 6 },
  ], 15);
  assert.equal(summary.count, 2);
  assert.equal(summary.latestDate, '2026-11-04');
  assert.equal(summary.averageDownloadMbps, 15);
  assert.equal(summary.averageUploadMbps, 4);
  assert.equal(summary.belowPackageCount, 1);
  assert.deepEqual(qualityLogSummary([], 15), { count: 0, latestDate: null, averageDownloadMbps: null, averageUploadMbps: null, belowPackageCount: 0, packageSpeedMbps: null });
});

test('summary text: empty, with package, and without package speed', () => {
  assert.equal(qualityLogSummaryText([], 15), 'No speed measurements recorded yet.');
  assert.match(qualityLogSummaryText([ENTRY], 15), /1 measurement, latest 2026-11-02/);
  assert.match(qualityLogSummaryText([ENTRY], 15), /package 15 Mbps, 1 below the package speed/);
  assert.match(qualityLogSummaryText([ENTRY], null), /package speed not set/);
});

test('html: date order, package column, escaped note', () => {
  const html = qualityLogHtml([
    { ...ENTRY, id: 'q-2', date: '2026-11-05', note: '<script>alert(1)</script>' },
    ENTRY,
  ], 15);
  assert.ok(html.indexOf('2026-11-02') < html.indexOf('2026-11-05'));
  assert.ok(html.includes('15 Mbps'));
  assert.ok(html.includes('Below package'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.equal(qualityLogHtml([], 15), '<p class="empty-state">No speed measurements recorded yet.</p>');
});

test('csv: header, rows, quoted note with a comma', () => {
  const csv = qualityLogCsv([
    { ...ENTRY, note: 'far room, weak signal', linkedTicketId: 't-7' },
  ], 15);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'date,download_mbps,upload_mbps,location,package_mbps,comparison,note,ticket_id');
  assert.equal(lines[1], '2026-11-02,12,4,Near router,15,below,"far room, weak signal",t-7');
});

test('filename: safe customer id, fallback when blank', () => {
  assert.equal(qualityLogFilename('c-1'), 'quality-log-c-1.csv');
  assert.equal(qualityLogFilename('cust 1/2'), 'quality-log-cust-1-2.csv');
  assert.equal(qualityLogFilename(''), 'quality-log-customer.csv');
});

test('module holds no bill, payment, dBm, or ticket-status field', () => {
  const normalized = normalizeQualityEntry(ENTRY);
  for (const key of ['billId', 'paymentId', 'amount', 'dbm', 'status', 'ticketStatus']) {
    assert.equal(key in normalized, false);
  }
});
