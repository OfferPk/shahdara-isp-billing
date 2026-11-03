import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REPEAT_FAULT_CATEGORIES,
  REPEAT_FAULT_DEFAULT_THRESHOLD,
  REPEAT_FAULT_DEFAULT_WINDOW_DAYS,
  validRepeatFaultDate,
  wholeDaysBetweenRepeatFaultDates,
  normalizeRepeatFaultSettings,
  normalizeRepeatFaultTicket,
  normalizeRepeatFaultTicketList,
  buildRepeatFaultFlags,
  repeatFaultSummary,
  repeatFaultSummaryText,
  repeatFaultHtml,
  repeatFaultCsv,
  repeatFaultFilename,
} from '../repeat-fault-flag.js';

function ticket(overrides = {}) {
  return {
    id: 'T1',
    customerId: 'C1',
    customerName: 'Ahmed',
    mohalla: 'Bani',
    category: 'no_connection',
    reportedDate: '2026-11-01',
    ...overrides,
  };
}

const TODAY = '2026-11-10';

test('catalogue: Plan 21 five categories, defaults 3 in 60 days', () => {
  assert.deepEqual([...REPEAT_FAULT_CATEGORIES], ['no_connection', 'slow_speed', 'billing_query', 'device_fault', 'relocation_request']);
  assert.equal(REPEAT_FAULT_DEFAULT_THRESHOLD, 3);
  assert.equal(REPEAT_FAULT_DEFAULT_WINDOW_DAYS, 60);
});

test('date validation: real dates pass, 2026-02-30 and bad shapes fail', () => {
  assert.equal(validRepeatFaultDate('2026-02-28'), '2026-02-28');
  assert.equal(validRepeatFaultDate('2026-02-30'), null);
  assert.equal(validRepeatFaultDate('2026-13-01'), null);
  assert.equal(validRepeatFaultDate('01-11-2026'), null);
  assert.equal(validRepeatFaultDate(''), null);
  assert.equal(validRepeatFaultDate(null), null);
});

test('day arithmetic: forward, backward and invalid', () => {
  assert.equal(wholeDaysBetweenRepeatFaultDates('2026-11-01', '2026-11-10'), 9);
  assert.equal(wholeDaysBetweenRepeatFaultDates('2026-11-10', '2026-11-01'), -9);
  assert.equal(wholeDaysBetweenRepeatFaultDates('2026-11-01', '2026-11-01'), 0);
  assert.equal(wholeDaysBetweenRepeatFaultDates('2026-02-30', '2026-11-10'), null);
});

test('settings: valid pairs kept, bad pairs fall back to defaults as a whole', () => {
  assert.deepEqual(normalizeRepeatFaultSettings({ threshold: 2, windowDays: 30 }), { threshold: 2, windowDays: 30 });
  assert.deepEqual(normalizeRepeatFaultSettings({ threshold: 3, windowDays: 60 }), { threshold: 3, windowDays: 60 });
  assert.deepEqual(normalizeRepeatFaultSettings({ threshold: 1, windowDays: 60 }), { threshold: 3, windowDays: 60 });
  assert.deepEqual(normalizeRepeatFaultSettings({ threshold: 3, windowDays: 0 }), { threshold: 3, windowDays: 60 });
  assert.deepEqual(normalizeRepeatFaultSettings({ threshold: 2.5, windowDays: 30 }), { threshold: 3, windowDays: 60 });
  assert.deepEqual(normalizeRepeatFaultSettings({ threshold: 'x', windowDays: 30 }), { threshold: 3, windowDays: 60 });
  assert.deepEqual(normalizeRepeatFaultSettings(null), { threshold: 3, windowDays: 60 });
  assert.deepEqual(normalizeRepeatFaultSettings({}), { threshold: 3, windowDays: 60 });
});

test('ticket normalisation: no customer, unknown category or bad date drops the row', () => {
  assert.equal(normalizeRepeatFaultTicket(ticket({ customerId: '' })), null);
  assert.equal(normalizeRepeatFaultTicket(ticket({ category: 'rude_staff' })), null);
  assert.equal(normalizeRepeatFaultTicket(ticket({ reportedDate: '2026-02-30' })), null);
  assert.equal(normalizeRepeatFaultTicket(ticket({ reportedDate: '' })), null);
  assert.equal(normalizeRepeatFaultTicket(null), null);
  const kept = normalizeRepeatFaultTicket(ticket());
  assert.equal(kept.customerId, 'C1');
  assert.equal(kept.category, 'no_connection');
  assert.equal(kept.reportedDate, '2026-11-01');
});

test('list normalisation: unusable entries dropped, order preserved, inputs not mutated', () => {
  const input = [ticket({ id: 'T1' }), ticket({ id: 'T2', category: 'nope' }), ticket({ id: 'T3', reportedDate: '2026-11-02' })];
  const snapshot = JSON.stringify(input);
  const out = normalizeRepeatFaultTicketList(input);
  assert.deepEqual(out.map((row) => row.id), ['T1', 'T3']);
  assert.equal(JSON.stringify(input), snapshot);
  assert.deepEqual(normalizeRepeatFaultTicketList(null), []);
  assert.deepEqual(normalizeRepeatFaultTicketList('nope'), []);
});

test('flag: exactly threshold tickets in the window flags, one below does not', () => {
  const rows = [
    ticket({ id: 'T1', reportedDate: '2026-10-20' }),
    ticket({ id: 'T2', reportedDate: '2026-10-28' }),
    ticket({ id: 'T3', reportedDate: '2026-11-05' }),
  ];
  const flags = buildRepeatFaultFlags(rows, { today: TODAY });
  assert.equal(flags.length, 1);
  assert.equal(flags[0].customerId, 'C1');
  assert.equal(flags[0].category, 'no_connection');
  assert.equal(flags[0].count, 3);
  assert.deepEqual(flags[0].ticketIds, ['T1', 'T2', 'T3']);
  assert.equal(buildRepeatFaultFlags(rows.slice(0, 2), { today: TODAY }).length, 0);
});

test('window: inclusive both ends, one day outside the window does not count', () => {
  // 60-day window ending 2026-11-10 starts 2026-09-12.
  const rows = [
    ticket({ id: 'T1', reportedDate: '2026-09-12' }),
    ticket({ id: 'T2', reportedDate: '2026-11-10' }),
    ticket({ id: 'T3', reportedDate: '2026-11-05' }),
  ];
  assert.equal(buildRepeatFaultFlags(rows, { today: TODAY }).length, 1);
  const outside = [
    ticket({ id: 'T1', reportedDate: '2026-09-11' }),
    ticket({ id: 'T2', reportedDate: '2026-11-10' }),
    ticket({ id: 'T3', reportedDate: '2026-11-05' }),
  ];
  assert.equal(buildRepeatFaultFlags(outside, { today: TODAY }).length, 0);
});

test('window expiry: flag disappears when the window passes without a new ticket', () => {
  const rows = [
    ticket({ id: 'T1', reportedDate: '2026-10-20' }),
    ticket({ id: 'T2', reportedDate: '2026-10-28' }),
    ticket({ id: 'T3', reportedDate: '2026-11-05' }),
  ];
  assert.equal(buildRepeatFaultFlags(rows, { today: TODAY }).length, 1);
  // By 2026-12-20 the 60-day window is 2026-10-22..2026-12-20: only T2, T3 remain.
  assert.equal(buildRepeatFaultFlags(rows, { today: '2026-12-20' }).length, 0);
});

test('flag: future tickets never count, undated and unknown rows never count', () => {
  const rows = [
    ticket({ id: 'T1', reportedDate: '2026-11-05' }),
    ticket({ id: 'T2', reportedDate: '2026-11-08' }),
    ticket({ id: 'T3', reportedDate: '2026-12-01' }),
    ticket({ id: 'T4', reportedDate: '' }),
    ticket({ id: 'T5', category: 'nope' }),
  ];
  assert.equal(buildRepeatFaultFlags(rows, { today: TODAY }).length, 0);
});

test('flag: same customer, different categories are separate flags', () => {
  const rows = [
    ticket({ id: 'T1', category: 'no_connection', reportedDate: '2026-11-01' }),
    ticket({ id: 'T2', category: 'no_connection', reportedDate: '2026-11-02' }),
    ticket({ id: 'T3', category: 'no_connection', reportedDate: '2026-11-03' }),
    ticket({ id: 'T4', category: 'slow_speed', reportedDate: '2026-11-01' }),
    ticket({ id: 'T5', category: 'slow_speed', reportedDate: '2026-11-02' }),
  ];
  const flags = buildRepeatFaultFlags(rows, { today: TODAY });
  assert.equal(flags.length, 1);
  assert.equal(flags[0].category, 'no_connection');
});

test('flag: different customers never share a flag', () => {
  const rows = [
    ticket({ id: 'T1', customerId: 'C1', reportedDate: '2026-11-01' }),
    ticket({ id: 'T2', customerId: 'C2', customerName: 'Bilal', reportedDate: '2026-11-02' }),
    ticket({ id: 'T3', customerId: 'C1', reportedDate: '2026-11-03' }),
    ticket({ id: 'T4', customerId: 'C2', customerName: 'Bilal', reportedDate: '2026-11-04' }),
  ];
  assert.equal(buildRepeatFaultFlags(rows, { today: TODAY }).length, 0);
});

test('flag: operator settings change the threshold and the window', () => {
  const rows = [
    ticket({ id: 'T1', reportedDate: '2026-11-01' }),
    ticket({ id: 'T2', reportedDate: '2026-11-05' }),
  ];
  assert.equal(buildRepeatFaultFlags(rows, { today: TODAY, threshold: 2, windowDays: 30 }).length, 1);
  assert.equal(buildRepeatFaultFlags(rows, { today: TODAY, threshold: 2, windowDays: 3 }).length, 0);
  assert.equal(buildRepeatFaultFlags(rows, { today: TODAY, threshold: 2, windowDays: 9 }).length, 0);
  assert.equal(buildRepeatFaultFlags(rows, { today: TODAY, threshold: 2, windowDays: 10 }).length, 1);
});

test('flag: invalid today gives no flags, never a crash', () => {
  const rows = [ticket(), ticket({ id: 'T2' }), ticket({ id: 'T3' })];
  assert.deepEqual(buildRepeatFaultFlags(rows, { today: '2026-02-30' }), []);
  assert.deepEqual(buildRepeatFaultFlags(rows, {}), []);
});

test('flag: tickets linked to it are the window tickets only, oldest first', () => {
  const rows = [
    ticket({ id: 'T3', reportedDate: '2026-11-05' }),
    ticket({ id: 'T0', reportedDate: '2026-08-01' }),
    ticket({ id: 'T1', reportedDate: '2026-10-20' }),
    ticket({ id: 'T2', reportedDate: '2026-10-28' }),
  ];
  const flags = buildRepeatFaultFlags(rows, { today: TODAY });
  assert.equal(flags.length, 1);
  assert.deepEqual(flags[0].ticketIds, ['T1', 'T2', 'T3']);
  assert.equal(flags[0].windowStart, '2026-09-12');
  assert.equal(flags[0].windowEnd, TODAY);
  assert.equal(flags[0].latestDate, '2026-11-05');
  assert.equal(flags[0].tickets.length, 3);
});

test('flag: sorting is customer name A-Z, then category label', () => {
  const rows = [
    ticket({ id: 'B1', customerId: 'C2', customerName: 'Bilal', category: 'slow_speed', reportedDate: '2026-11-01' }),
    ticket({ id: 'B2', customerId: 'C2', customerName: 'Bilal', category: 'slow_speed', reportedDate: '2026-11-02' }),
    ticket({ id: 'B3', customerId: 'C2', customerName: 'Bilal', category: 'slow_speed', reportedDate: '2026-11-03' }),
    ticket({ id: 'A1', customerId: 'C1', customerName: 'Ahmed', category: 'no_connection', reportedDate: '2026-11-01' }),
    ticket({ id: 'A2', customerId: 'C1', customerName: 'Ahmed', category: 'no_connection', reportedDate: '2026-11-02' }),
    ticket({ id: 'A3', customerId: 'C1', customerName: 'Ahmed', category: 'no_connection', reportedDate: '2026-11-03' }),
  ];
  const flags = buildRepeatFaultFlags(rows, { today: TODAY });
  assert.deepEqual(flags.map((flag) => flag.customerName), ['Ahmed', 'Bilal']);
});

test('flag: inputs are never mutated', () => {
  const rows = [
    ticket({ id: 'T1', reportedDate: '2026-11-01' }),
    ticket({ id: 'T2', reportedDate: '2026-11-02' }),
    ticket({ id: 'T3', reportedDate: '2026-11-03' }),
  ];
  const snapshot = JSON.stringify(rows);
  buildRepeatFaultFlags(rows, { today: TODAY });
  assert.equal(JSON.stringify(rows), snapshot);
});

test('flag: no billing, priority or status field is carried on a flag', () => {
  const rows = [
    ticket({ id: 'T1', reportedDate: '2026-11-01', status: 'open', priority: 'urgent' }),
    ticket({ id: 'T2', reportedDate: '2026-11-02', status: 'open', priority: 'urgent' }),
    ticket({ id: 'T3', reportedDate: '2026-11-03', status: 'open', priority: 'urgent' }),
  ];
  const flags = buildRepeatFaultFlags(rows, { today: TODAY });
  assert.equal(flags.length, 1);
  assert.equal('status' in flags[0], false);
  assert.equal('priority' in flags[0], false);
  assert.equal('bill' in flags[0], false);
  assert.equal('payment' in flags[0], false);
});

test('summary: flag and customer counts, largest count, empty text', () => {
  const rows = [
    ticket({ id: 'T1', reportedDate: '2026-11-01' }),
    ticket({ id: 'T2', reportedDate: '2026-11-02' }),
    ticket({ id: 'T3', reportedDate: '2026-11-03' }),
    ticket({ id: 'T4', reportedDate: '2026-11-04' }),
  ];
  const summary = repeatFaultSummary(buildRepeatFaultFlags(rows, { today: TODAY }));
  assert.deepEqual(summary, { flags: 1, customers: 1, largestCount: 4 });
  assert.equal(repeatFaultSummaryText(summary), '1 repeat-fault flag on 1 customer');
  assert.equal(repeatFaultSummaryText(repeatFaultSummary([])), 'No repeat-fault flags');
  assert.equal(repeatFaultSummaryText(null), 'No repeat-fault flags');
});

test('summary: two flags on one customer count as two flags, one customer', () => {
  const rows = [
    ticket({ id: 'T1', category: 'no_connection', reportedDate: '2026-11-01' }),
    ticket({ id: 'T2', category: 'no_connection', reportedDate: '2026-11-02' }),
    ticket({ id: 'T3', category: 'no_connection', reportedDate: '2026-11-03' }),
    ticket({ id: 'T4', category: 'slow_speed', reportedDate: '2026-11-01' }),
    ticket({ id: 'T5', category: 'slow_speed', reportedDate: '2026-11-02' }),
    ticket({ id: 'T6', category: 'slow_speed', reportedDate: '2026-11-03' }),
  ];
  const summary = repeatFaultSummary(buildRepeatFaultFlags(rows, { today: TODAY }));
  assert.deepEqual(summary, { flags: 2, customers: 1, largestCount: 3 });
  assert.equal(repeatFaultSummaryText(summary), '2 repeat-fault flags on 1 customer');
});

test('html: names the customer, category, count, window and linked tickets, escaped', () => {
  const rows = [
    ticket({ id: 'T1', customerName: 'Ahmed <b>', reportedDate: '2026-11-01' }),
    ticket({ id: 'T2', customerName: 'Ahmed <b>', reportedDate: '2026-11-02' }),
    ticket({ id: 'T3', customerName: 'Ahmed <b>', reportedDate: '2026-11-03' }),
  ];
  const html = repeatFaultHtml(buildRepeatFaultFlags(rows, { today: TODAY }));
  assert.match(html, /Ahmed &lt;b&gt;/);
  assert.doesNotMatch(html, /<b>/);
  assert.match(html, /No connection/);
  assert.match(html, /3 tickets in 60 days/);
  assert.match(html, /T1 \(2026-11-01\)/);
  assert.equal(repeatFaultHtml([]), '<p class="empty-state">No repeat-fault flags at these settings.</p>');
});

test('html: ticket list can be hidden with showTickets false', () => {
  const rows = [
    ticket({ id: 'T1', reportedDate: '2026-11-01' }),
    ticket({ id: 'T2', reportedDate: '2026-11-02' }),
    ticket({ id: 'T3', reportedDate: '2026-11-03' }),
  ];
  const html = repeatFaultHtml(buildRepeatFaultFlags(rows, { today: TODAY }), { showTickets: false });
  assert.doesNotMatch(html, /T1/);
  assert.match(html, /Ahmed/);
});

test('csv: header, one row per flag, quoting, filename', () => {
  const rows = [
    ticket({ id: 'T1', customerName: 'Ahmed, Jr', reportedDate: '2026-11-01' }),
    ticket({ id: 'T2', customerName: 'Ahmed, Jr', reportedDate: '2026-11-02' }),
    ticket({ id: 'T3', customerName: 'Ahmed, Jr', reportedDate: '2026-11-03' }),
  ];
  const csv = repeatFaultCsv(buildRepeatFaultFlags(rows, { today: TODAY }));
  const lines = csv.split('\n');
  assert.equal(lines[0], 'Customer,Mohalla,Category,Ticket count,Threshold,Window days,Window start,Window end,Latest ticket date,Ticket ids');
  assert.equal(lines.length, 2);
  assert.match(lines[1], /"Ahmed, Jr"/);
  assert.match(lines[1], /T1; T2; T3/);
  assert.equal(repeatFaultFilename(), 'repeat-fault-flags.csv');
  assert.equal(repeatFaultCsv([]).split('\n').length, 1);
});
