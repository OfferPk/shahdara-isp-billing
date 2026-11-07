// Plan 454 — Search ledger for one single day: one strict date
// listing exactly that day's entries in time order, with the day,
// the count, and the total shown in PKR — and never changing any
// record.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatLedgerDayRupees,
  formatLedgerDayPkrTotal,
  normalizeLedgerDay,
  ledgerDayActive,
  formatLedgerDay,
  ledgerDayMatches,
  searchLedgerByDay,
  ledgerDaySummary,
  ledgerDaySummaryText,
  ledgerDayEmptyText,
  ledgerDayRangeEmptyText,
} from '../ledger-single-day.js';

// Generic fixtures only — no real customer names, no phone numbers.
function entry(id, amount, date, customerName = 'Customer A', method = 'Cash', extra = {}) {
  return { id, paymentId: id, amount, date, customerName, customerNumber: 101, method, ...extra };
}

function ledger() {
  return [
    entry('t1', 500, '2026-11-04', 'Customer A', 'Cash', { recordedAt: '2026-11-04T09:00:00.000Z' }),
    entry('t2', 1000, '2026-11-05', 'Customer B', 'JazzCash', { recordedAt: '2026-11-05T11:30:00.000Z' }),
    entry('t3', 1500, '2026-11-05', 'Customer C', 'Cash', { recordedAt: '2026-11-05T09:15:00.000Z' }),
    entry('t4', 2000, '2026-11-05', 'Customer D', 'Easypaisa', { recordedAt: '2026-11-05T14:45:00.000Z' }),
    entry('t5', 2500, '2026-11-05', 'Customer E', 'Cash', { voided: true, recordedAt: '2026-11-05T10:00:00.000Z' }),
    entry('t6', 3000, '2026-11-06', 'Customer F', 'Bank Transfer', { recordedAt: '2026-11-06T08:00:00.000Z' }),
    entry('t7', 1200, '2026-11-05', 'Customer G', 'Cash'),
    entry('t8', 700, '', 'Customer H', 'Cash', { recordedAt: '2026-11-05T12:00:00.000Z' }),
  ];
}

test('money formats like the ledger: Rs bounds, PKR total, min-0 decimals', () => {
  assert.equal(formatLedgerDayRupees(0), 'Rs 0');
  assert.equal(formatLedgerDayRupees(1500), 'Rs 1,500');
  assert.equal(formatLedgerDayRupees(1500.5), 'Rs 1,501');
  assert.equal(formatLedgerDayRupees(null), 'Rs 0');
  assert.equal(formatLedgerDayPkrTotal(0), 'PKR 0');
  assert.equal(formatLedgerDayPkrTotal(4500), 'PKR 4,500');
  assert.equal(formatLedgerDayPkrTotal(4500.4), 'PKR 4,500');
});

test('one strict date parses, with real calendar days only', () => {
  assert.equal(normalizeLedgerDay('2026-11-05'), '2026-11-05');
  assert.equal(normalizeLedgerDay(' 2026-11-05 '), '2026-11-05');
  assert.equal(normalizeLedgerDay('2028-02-29'), '2028-02-29');
  assert.equal(normalizeLedgerDay('2026-08-31'), '2026-08-31');
  assert.equal(normalizeLedgerDay('2026-10-31'), '2026-10-31');
  assert.equal(normalizeLedgerDay('2026-12-31'), '2026-12-31');
  assert.equal(normalizeLedgerDay('2026-02-29'), null);
  assert.equal(normalizeLedgerDay('2027-02-29'), null);
  assert.equal(normalizeLedgerDay('2026-02-30'), null);
  assert.equal(normalizeLedgerDay('2026-04-31'), null);
  assert.equal(normalizeLedgerDay('2026-13-01'), null);
  assert.equal(normalizeLedgerDay('2026-00-10'), null);
  assert.equal(normalizeLedgerDay('2026-11-00'), null);
  assert.equal(normalizeLedgerDay('2026-2-5'), null);
  assert.equal(normalizeLedgerDay('2026-11-05T00:00'), null);
  assert.equal(normalizeLedgerDay(''), null);
  assert.equal(normalizeLedgerDay('   '), null);
  assert.equal(normalizeLedgerDay(null), null);
  assert.equal(normalizeLedgerDay(undefined), null);
  assert.equal(normalizeLedgerDay(20261105), null);
});

test('the day label reads like the app shows dates', () => {
  assert.equal(formatLedgerDay('2026-11-05'), '5 Nov 2026');
  assert.equal(formatLedgerDay('2026-01-01'), '1 Jan 2026');
  assert.equal(formatLedgerDay('2026-12-25'), '25 Dec 2026');
  assert.equal(formatLedgerDay('2026-02-30'), '');
  assert.equal(formatLedgerDay(''), '');
  assert.equal(formatLedgerDay(null), '');
});

test('the search is active only on one usable date', () => {
  assert.equal(ledgerDayActive('2026-11-05'), true);
  assert.equal(ledgerDayActive('2026-02-30'), false);
  assert.equal(ledgerDayActive(''), false);
  assert.equal(ledgerDayActive(null), false);
});

test('an entry belongs to the day only on an exact date match', () => {
  assert.equal(ledgerDayMatches(entry('a', 100, '2026-11-05'), '2026-11-05'), true);
  assert.equal(ledgerDayMatches(entry('a', 100, '2026-11-06'), '2026-11-05'), false);
  assert.equal(ledgerDayMatches(entry('a', 100, '2026-11-04'), '2026-11-05'), false);
  assert.equal(ledgerDayMatches(entry('a', 100, ''), '2026-11-05'), false);
  assert.equal(ledgerDayMatches(entry('a', 100, '2026-11-05'), '2026-11-06'), false);
  assert.equal(ledgerDayMatches(entry('a', 100, '2026-11-05'), ''), false);
  assert.equal(ledgerDayMatches(entry('a', 100, '2026-11-05'), '2026-02-30'), false);
});

test('one day returns exactly that day, in time order, and nothing else', () => {
  const found = searchLedgerByDay(ledger(), '2026-11-05');
  // Time order: t3 (09:15), t5 voided (10:00), t2 (11:30), t4 (14:45),
  // then the unstamped t7 in list order. Other days and the undated
  // entry never appear.
  assert.deepEqual(found.map((row) => row.id), ['t3', 't5', 't2', 't4', 't7']);
  assert.equal(found.some((row) => row.id === 't1'), false);
  assert.equal(found.some((row) => row.id === 't6'), false);
  assert.equal(found.some((row) => row.id === 't8'), false);
});

test('a voided entry on the day stays listed as history', () => {
  const found = searchLedgerByDay(ledger(), '2026-11-05');
  assert.equal(found.some((row) => row.id === 't5' && row.voided === true), true);
});

test('a payment recorded later sorts after the ones logged on the day', () => {
  const rows = [
    entry('b1', 100, '2026-11-05', 'Customer A', 'Cash', { recordedAt: '2026-11-05T08:00:00.000Z' }),
    entry('b2', 200, '2026-11-05', 'Customer B', 'Cash', { recordedAt: '2026-11-07T09:00:00.000Z' }),
    entry('b3', 300, '2026-11-05', 'Customer C', 'Cash', { recordedAt: '2026-11-05T07:00:00.000Z' }),
  ];
  assert.deepEqual(searchLedgerByDay(rows, '2026-11-05').map((row) => row.id), ['b3', 'b1', 'b2']);
});

test('same recorded minute falls back to customer name, then payment id', () => {
  const rows = [
    entry('c2', 200, '2026-11-05', 'Customer B', 'Cash', { recordedAt: '2026-11-05T09:00:00.000Z' }),
    entry('c1', 100, '2026-11-05', 'Customer A', 'Cash', { recordedAt: '2026-11-05T09:00:00.000Z' }),
    entry('c3', 300, '2026-11-05', 'Customer A', 'Cash', { recordedAt: '2026-11-05T09:00:00.000Z' }),
  ];
  assert.deepEqual(searchLedgerByDay(rows, '2026-11-05').map((row) => row.id), ['c1', 'c3', 'c2']);
});

test('with no usable date every entry is kept, in the same order', () => {
  const rows = ledger();
  assert.deepEqual(searchLedgerByDay(rows, '').map((row) => row.id), rows.map((row) => row.id));
  assert.deepEqual(searchLedgerByDay(rows, '2026-02-30').map((row) => row.id), rows.map((row) => row.id));
  assert.deepEqual(searchLedgerByDay(null, '2026-11-05'), []);
  assert.deepEqual(searchLedgerByDay(undefined, '2026-11-05'), []);
});

test('the search never mutates the input list or its entries', () => {
  const rows = ledger();
  const before = rows.map((row) => row.id).join(',');
  searchLedgerByDay(rows, '2026-11-05');
  assert.equal(rows.map((row) => row.id).join(','), before);
});

test('the day summary counts and totals only collected cash', () => {
  const day = searchLedgerByDay(ledger(), '2026-11-05');
  // t2 1000 + t3 1500 + t4 2000 + t7 1200; the voided t5 (2500) counts
  // towards neither.
  assert.deepEqual(ledgerDaySummary(day), { count: 4, total: 5700 });
  assert.deepEqual(ledgerDaySummary([]), { count: 0, total: 0 });
  assert.deepEqual(ledgerDaySummary(null), { count: 0, total: 0 });
  assert.deepEqual(ledgerDaySummary([entry('x', 'abc', '2026-11-05'), entry('y', 500, '2026-11-05')]), { count: 2, total: 500 });
  assert.deepEqual(ledgerDaySummary([entry('x', 100, '2026-11-05', 'Customer A', 'Cash', { voided: true })]), { count: 0, total: 0 });
});

test('the day line names the day, the count, and the PKR total', () => {
  const day = searchLedgerByDay(ledger(), '2026-11-05');
  assert.equal(ledgerDaySummaryText(day, '2026-11-05'), '5 Nov 2026: 4 entries · PKR 5,700 total');
  assert.equal(ledgerDaySummaryText([entry('x', 100, '2026-11-05')], '2026-11-05'), '5 Nov 2026: 1 entry · PKR 100 total');
  assert.equal(ledgerDaySummaryText([], '2026-11-05'), '5 Nov 2026: 0 entries · PKR 0 total');
  assert.equal(ledgerDaySummaryText(day, ''), '');
  assert.equal(ledgerDaySummaryText(day, '2026-02-30'), '');
});

test('a day with no entries says so plainly', () => {
  assert.equal(ledgerDayEmptyText('2026-11-05'), 'No entries on 5 Nov 2026.');
  assert.equal(ledgerDayEmptyText('2026-01-01'), 'No entries on 1 Jan 2026.');
  assert.equal(ledgerDayEmptyText(''), 'No recorded payments match these filters.');
  assert.equal(ledgerDayEmptyText('2026-02-30'), 'No recorded payments match these filters.');
});

test('a day with no entries inside the range names both the day and the range', () => {
  assert.equal(ledgerDayRangeEmptyText('2026-11-05', '1000', '2000'), 'No entries on 5 Nov 2026 between Rs 1,000 and Rs 2,000.');
  assert.equal(ledgerDayRangeEmptyText('2026-11-05', 'Rs 2,000', 'Rs 1,000'), 'No entries on 5 Nov 2026 between Rs 1,000 and Rs 2,000.');
  assert.equal(ledgerDayRangeEmptyText('2026-11-05', 'Rs 1,500', ''), 'No entries on 5 Nov 2026 of Rs 1,500 or more.');
  assert.equal(ledgerDayRangeEmptyText('2026-11-05', '', '2,000'), 'No entries on 5 Nov 2026 up to Rs 2,000.');
  assert.equal(ledgerDayRangeEmptyText('2026-11-05', '', ''), 'No entries on 5 Nov 2026.');
  assert.equal(ledgerDayRangeEmptyText('2026-11-05', 'abc', 'xyz'), 'No entries on 5 Nov 2026.');
  assert.equal(ledgerDayRangeEmptyText('', '1000', '2000'), 'No recorded payments match these filters.');
});
