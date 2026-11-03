/**
 * plan48-maintenance-calendar.test.js — Plan 48: planned maintenance
 * calendar by mohalla.
 * Pins:
 * - each window lists exactly the customers in its affected mohallas
 *   or segments on the same fixture (canonical mohalla rule, segment
 *   via the connection register; archived listed separately, never
 *   counted; a customer with no mohalla and no segment is never
 *   assigned to a window);
 * - a completed window stays in history with its final times, and
 *   completing it prepares an announcement draft;
 * - impossible dates (2026-02-30), invalid times, an end time not
 *   after the start, a blank description, or no affected scope are
 *   refused, never stored half-formed;
 * - creating or completing a window never changes a bill, payment,
 *   ticket, or customer status: the module holds no such field, and
 *   inputs are never mutated.
 * Synthetic data only; no ledger figure is ever changed by this plan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidMaintenanceDate,
  isValidMaintenanceTime,
  canonicalMaintenanceMohalla,
  normalizeMaintenanceWindow,
  upsertMaintenanceWindow,
  removeMaintenanceWindow,
  findMaintenanceWindow,
  setMaintenanceWindowStatus,
  windowsByStatus,
  completedMaintenanceWindows,
  sortMaintenanceWindows,
  affectedMaintenanceCustomers,
  buildMaintenanceAnnouncement,
  maintenanceWhatsAppUrl,
  maintenanceSummaryText,
  maintenanceWindowsHtml,
  maintenanceWindowsCsv,
  maintenanceCalendarFilename,
} from '../maintenance-calendar.js';

const WINDOW = {
  id: 'm-1', date: '2026-11-10', startTime: '09:00', endTime: '12:00',
  description: 'Splitter swap', mohallas: ['Bani'], segments: [],
};
const CUSTOMERS = [
  { id: 'c-1', customerName: 'Ali', mohalla: 'Bani' },
  { id: 'c-2', customerName: 'Bilal', mohalla: 'Kishti' },
  { id: 'c-3', customerName: 'Usman' },
  { id: 'c-4', customerName: 'Zain', mohalla: 'Bani', archived: true },
  { id: 'c-5', customerName: 'Hassan', mohalla: 'Other place' },
];
const CONNECTIONS = [{ customerId: 'c-5', splitter: 'Splitter A' }];

test('date and time validation: real values pass, impossible values fail', () => {
  assert.equal(isValidMaintenanceDate('2026-11-10'), true);
  assert.equal(isValidMaintenanceDate('2026-02-30'), false);
  assert.equal(isValidMaintenanceDate('2026-13-01'), false);
  assert.equal(isValidMaintenanceDate('not-a-date'), false);
  assert.equal(isValidMaintenanceTime('09:00'), true);
  assert.equal(isValidMaintenanceTime('23:59'), true);
  assert.equal(isValidMaintenanceTime('24:00'), false);
  assert.equal(isValidMaintenanceTime('9:00'), false);
  assert.equal(isValidMaintenanceTime('09:60'), false);
});

test('canonical mohalla: prefix stripped, aliases collapse, unknown kept', () => {
  assert.equal(canonicalMaintenanceMohalla('Bani').key, 'banii');
  assert.equal(canonicalMaintenanceMohalla('Mohalla Bani').key, 'banii');
  assert.equal(canonicalMaintenanceMohalla('bani').stored, 'BANII');
  assert.equal(canonicalMaintenanceMohalla('kishti').stored, 'KISHTII');
  assert.equal(canonicalMaintenanceMohalla('Somewhere New').label, 'Somewhere New');
  assert.equal(canonicalMaintenanceMohalla('  '), null);
});

test('window validation: bad date, bad times, end not after start, blank description, no scope rejected', () => {
  assert.equal(normalizeMaintenanceWindow({ ...WINDOW, date: '2026-02-30' }), null);
  assert.equal(normalizeMaintenanceWindow({ ...WINDOW, startTime: '25:00' }), null);
  assert.equal(normalizeMaintenanceWindow({ ...WINDOW, endTime: '09:00' }), null);
  assert.equal(normalizeMaintenanceWindow({ ...WINDOW, endTime: '08:00' }), null);
  assert.equal(normalizeMaintenanceWindow({ ...WINDOW, description: '  ' }), null);
  assert.equal(normalizeMaintenanceWindow({ ...WINDOW, mohallas: [], segments: [] }), null);
  assert.equal(normalizeMaintenanceWindow({ ...WINDOW, id: '' }), null);
  const ok = normalizeMaintenanceWindow(WINDOW);
  assert.equal(ok.status, 'scheduled');
  assert.deepEqual(ok.mohallas, ['BANII']);
  assert.equal(ok.finalDate, null);
});

test('upsert: invalid window leaves the list unchanged, duplicate id replaces', () => {
  const list = [WINDOW];
  assert.equal(upsertMaintenanceWindow(list, { ...WINDOW, id: 'm-2', date: '2026-02-30' }), list);
  const replaced = upsertMaintenanceWindow(list, { ...WINDOW, description: 'Cable re-route' });
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].description, 'Cable re-route');
  assert.equal(list[0].description, 'Splitter swap');
  assert.equal(findMaintenanceWindow(list, 'm-1').id, 'm-1');
  assert.equal(findMaintenanceWindow(list, 'missing'), null);
  assert.equal(removeMaintenanceWindow(list, 'm-1').length, 0);
});

test('affected customers: exactly the mohalla customers, archived separate, unassigned never included', () => {
  const result = affectedMaintenanceCustomers(WINDOW, { customers: CUSTOMERS, connections: CONNECTIONS });
  assert.deepEqual(result.customers.map((c) => c.customerId), ['c-1']);
  assert.equal(result.customers[0].matchedBy, 'mohalla');
  assert.deepEqual(result.archivedCustomers.map((c) => c.customerId), ['c-4']);
  assert.equal(result.affectedCount, 1);
  assert.equal(result.totalCustomers, 5);
});

test('affected customers: segment match via the connection register, alias mohalla match', () => {
  const segmentWindow = { ...WINDOW, id: 'm-2', mohallas: [], segments: ['splitter a'] };
  const bySegment = affectedMaintenanceCustomers(segmentWindow, { customers: CUSTOMERS, connections: CONNECTIONS });
  assert.deepEqual(bySegment.customers.map((c) => c.customerId), ['c-5']);
  assert.equal(bySegment.customers[0].matchedBy, 'segment');
  const aliasWindow = { ...WINDOW, id: 'm-3', mohallas: ['Mohalla bani'] };
  const byAlias = affectedMaintenanceCustomers(aliasWindow, { customers: CUSTOMERS, connections: CONNECTIONS });
  assert.deepEqual(byAlias.customers.map((c) => c.customerId), ['c-1']);
});

test('status machine: legal moves apply, illegal moves leave the list unchanged', () => {
  const list = [WINDOW];
  const started = setMaintenanceWindowStatus(list, 'm-1', 'in_progress');
  assert.equal(started[0].status, 'in_progress');
  assert.equal(setMaintenanceWindowStatus(started, 'm-1', 'scheduled'), started);
  assert.equal(setMaintenanceWindowStatus(list, 'm-1', 'bogus'), list);
  assert.equal(setMaintenanceWindowStatus(list, 'missing', 'completed'), list);
  const postponed = setMaintenanceWindowStatus(list, 'm-1', 'postponed');
  const rescheduled = setMaintenanceWindowStatus(postponed, 'm-1', 'scheduled');
  assert.equal(rescheduled[0].status, 'scheduled');
  assert.deepEqual(windowsByStatus(rescheduled, 'scheduled').map((w) => w.id), ['m-1']);
});

test('completion: window stays in history with final times and a draft', () => {
  const list = [WINDOW];
  const done = setMaintenanceWindowStatus(list, 'm-1', 'completed', { date: '2026-11-11', startTime: '10:00', endTime: '11:30' });
  assert.equal(done.length, 1);
  assert.equal(done[0].status, 'completed');
  assert.equal(done[0].finalDate, '2026-11-11');
  assert.equal(done[0].finalStartTime, '10:00');
  assert.equal(done[0].finalEndTime, '11:30');
  assert.match(done[0].announcementDraft, /2026-11-11/);
  assert.deepEqual(completedMaintenanceWindows(done).map((w) => w.id), ['m-1']);
  const kept = setMaintenanceWindowStatus(list, 'm-1', 'completed');
  assert.equal(kept[0].finalDate, '2026-11-10');
  assert.equal(kept[0].finalStartTime, '09:00');
  assert.equal(setMaintenanceWindowStatus(list, 'm-1', 'completed', { date: '2026-02-30' }), list);
  assert.equal(setMaintenanceWindowStatus(done, 'm-1', 'scheduled'), done);
});

test('announcement: roman and urdu variants name scope, times, and work verbatim', () => {
  const roman = buildMaintenanceAnnouncement(WINDOW, {});
  assert.match(roman.text, /Bani/);
  assert.match(roman.text, /2026-11-10/);
  assert.match(roman.text, /09:00 se 12:00 tak/);
  assert.match(roman.text, /Splitter swap/);
  const urdu = buildMaintenanceAnnouncement(WINDOW, { variant: 'urdu' });
  assert.match(urdu.text, /شاہدرہ فائبر نیٹ/);
  assert.match(urdu.text, /Splitter swap/);
  assert.equal(buildMaintenanceAnnouncement({ ...WINDOW, mohallas: [], segments: [] }), null);
  assert.ok(maintenanceWhatsAppUrl(roman.text).startsWith('https://wa.me/?text='));
  assert.equal(maintenanceWhatsAppUrl(''), 'https://wa.me/');
});

test('summary, html, csv, filename: honest figures, escaped html, no invented data', () => {
  assert.equal(maintenanceSummaryText([]), 'No maintenance windows scheduled yet.');
  const list = [WINDOW, { ...WINDOW, id: 'm-2', date: '2026-11-09', description: '<b>bold</b> work', mohallas: ['Kishti'] }];
  assert.match(maintenanceSummaryText(list), /2 windows/);
  const html = maintenanceWindowsHtml(list, { 'm-1': affectedMaintenanceCustomers(WINDOW, { customers: CUSTOMERS, connections: CONNECTIONS }) });
  assert.match(html, /1 customer affected/);
  assert.doesNotMatch(html, /<b>bold<\/b>/);
  assert.match(html, /&lt;b&gt;bold&lt;\/b&gt;/);
  const csv = maintenanceWindowsCsv(list, { 'm-1': affectedMaintenanceCustomers(WINDOW, { customers: CUSTOMERS, connections: CONNECTIONS }) });
  assert.match(csv, /^id,date,start_time,end_time,description,status,mohallas,segments,affected_customers,final_date,final_start_time,final_end_time/);
  assert.match(csv, /Splitter swap/);
  assert.equal(maintenanceCalendarFilename('2026-11-04'), 'maintenance-calendar-2026-11-04.csv');
  assert.equal(maintenanceCalendarFilename('bogus'), 'maintenance-calendar-unknown-date.csv');
});

test('sorting and both-sides match: date then start time, mohalla and segment together', () => {
  const later = { ...WINDOW, id: 'm-9', date: '2026-11-12' };
  const earlier = { ...WINDOW, id: 'm-8', date: '2026-11-09', startTime: '08:00', endTime: '09:00' };
  assert.deepEqual(sortMaintenanceWindows([WINDOW, later, earlier]).map((w) => w.id), ['m-8', 'm-1', 'm-9']);
  const both = affectedMaintenanceCustomers(
    { ...WINDOW, id: 'm-4', segments: ['Splitter A'] },
    { customers: [...CUSTOMERS, { id: 'c-6', customerName: 'Danish', mohalla: 'Bani' }], connections: [...CONNECTIONS, { customerId: 'c-6', splitter: 'Splitter A' }] },
  );
  const danish = both.customers.find((c) => c.customerId === 'c-6');
  assert.equal(danish.matchedBy, 'mohalla and segment');
});

test('no bill, payment, ticket, or customer-status field on a window; inputs never mutated', () => {
  const window = normalizeMaintenanceWindow(WINDOW);
  for (const key of Object.keys(window)) {
    assert.doesNotMatch(key, /bill|payment|ticket|customerStatus|balance/i);
  }
  const before = JSON.stringify(WINDOW);
  normalizeMaintenanceWindow(WINDOW);
  affectedMaintenanceCustomers(WINDOW, { customers: CUSTOMERS, connections: CONNECTIONS });
  assert.equal(JSON.stringify(WINDOW), before);
});
