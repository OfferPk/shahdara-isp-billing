import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateInboxTotals } from '../payments-inbox.js';

// Sharafat 54: one malformed inbox amount must not poison every
// inbox total to NaN. The guard lives in calculateInboxTotals:
// amounts Number() cannot parse are skipped from the money sums
// and counted separately as unreadable. The discriminating
// fixture MUST use a string ("abc" / "1,000") — a literal NaN
// amount never poisons (NaN || 0 is 0), so a NaN fixture passes
// on unfixed code; it is pinned here as already-safe instead.

// The :82 control fixture from tests/easypaisa-inbox.test.js —
// today 4000/1000, month 9000/4000, total 13000/4000.
const REF_DATE = new Date('2026-10-20T12:00:00Z');
function goodRows() {
  return [
    // Today Received
    { txnId: 'T1', amount: 2500, direction: 'Received', date: '2026-10-20', recorded: false },
    { txnId: 'T2', amount: 1500, direction: 'Received', date: '2026-10-20', recorded: true },
    // Today Sent
    { txnId: 'T3', amount: 1000, direction: 'Sent', date: '2026-10-20' },
    // Earlier this month
    { txnId: 'T4', amount: 5000, direction: 'Received', date: '2026-10-15', recorded: true },
    { txnId: 'T5', amount: 3000, direction: 'Sent', date: '2026-10-14' },
    // Previous month
    { txnId: 'T6', amount: 4000, direction: 'Received', date: '2026-09-28', recorded: false },
    // Needs review
    { txnId: 'T7', amount: null, direction: 'Unknown', status: 'Needs review', date: '2026-10-20' }
  ];
}

function assertGoodRowsTotals(totals) {
  assert.equal(totals.today.received, 4000);
  assert.equal(totals.today.sent, 1000);
  assert.equal(totals.month.received, 9000);
  assert.equal(totals.month.sent, 4000);
  assert.equal(totals.total.received, 13000);
  assert.equal(totals.total.sent, 4000);
}

test('Sharafat 54: control — good rows only, unreadableCount is 0', () => {
  const totals = calculateInboxTotals(goodRows(), REF_DATE);
  assertGoodRowsTotals(totals);
  assert.equal(totals.total.unreadableCount, 0);
  assert.equal(totals.total.totalCount, 7);
});

test('Sharafat 54: corrupt Received "abc" dated today does not poison the totals', () => {
  const items = goodRows();
  items.push({ txnId: 'X1', amount: 'abc', direction: 'Received', date: '2026-10-20', recorded: false });
  const totals = calculateInboxTotals(items, REF_DATE);

  // Money totals equal the good-rows totals — no NaN anywhere.
  assertGoodRowsTotals(totals);
  assert.ok(Number.isFinite(totals.today.received));
  assert.ok(Number.isFinite(totals.month.received));
  assert.ok(Number.isFinite(totals.total.received));
  // The corrupt row still counts as an incoming payment (D3(a)).
  assert.equal(totals.today.receivedCount, 3);
  assert.equal(totals.month.receivedCount, 4);
  assert.equal(totals.total.unrecordedCount, 3);
  assert.equal(totals.total.totalCount, 8);
  assert.equal(totals.total.unreadableCount, 1);
});

test('Sharafat 54: corrupt Sent "abc" dated today poisons only the sent side on unfixed code', () => {
  const items = goodRows();
  items.push({ txnId: 'X2', amount: 'abc', direction: 'Sent', date: '2026-10-20' });
  const totals = calculateInboxTotals(items, REF_DATE);

  assertGoodRowsTotals(totals);
  assert.ok(Number.isFinite(totals.today.sent));
  assert.ok(Number.isFinite(totals.month.sent));
  assert.ok(Number.isFinite(totals.total.sent));
  assert.equal(totals.today.sentCount, 2);
  assert.equal(totals.month.sentCount, 3);
  assert.equal(totals.total.totalCount, 8);
  assert.equal(totals.total.unreadableCount, 1);
});

test('Sharafat 54: "1,000" string amount is unreadable too', () => {
  const items = goodRows();
  items.push({ txnId: 'X3', amount: '1,000', direction: 'Received', date: '2026-10-20', recorded: false });
  const totals = calculateInboxTotals(items, REF_DATE);

  assertGoodRowsTotals(totals);
  assert.equal(totals.total.unreadableCount, 1);
  assert.equal(totals.total.totalCount, 8);
});

test('Sharafat 54: corrupt Received "abc" dated last month heals total.received only', () => {
  const items = goodRows();
  items.push({ txnId: 'X4', amount: 'abc', direction: 'Received', date: '2026-09-28', recorded: false });
  const totals = calculateInboxTotals(items, REF_DATE);

  // Today and month are untouched; total.received is the good-rows
  // figure (13000) instead of NaN — the only total this row could
  // poison, and it is never rendered on any card.
  assertGoodRowsTotals(totals);
  assert.equal(totals.today.receivedCount, 2);
  assert.equal(totals.month.receivedCount, 3);
  assert.equal(totals.total.unreadableCount, 1);
  assert.equal(totals.total.totalCount, 8);
});

test('Sharafat 54: in-memory NaN amount is already safe and counts as unreadable', () => {
  const items = goodRows();
  items.push({ txnId: 'X5', amount: NaN, direction: 'Received', date: '2026-10-20', recorded: false });
  const totals = calculateInboxTotals(items, REF_DATE);

  // NaN || 0 is 0, so the money totals were never poisoned — this
  // half of the doc's test line is vacuous. The row still counts as
  // unreadable (present-but-not-finite via Number()).
  assertGoodRowsTotals(totals);
  assert.equal(totals.today.receivedCount, 3);
  assert.equal(totals.total.unreadableCount, 1);
  assert.equal(totals.total.totalCount, 8);
});

test('Sharafat 54: null / undefined / empty / 0 / negative amounts stay exactly as today', () => {
  const items = goodRows();
  items.push({ txnId: 'X6', amount: null, direction: 'Received', date: '2026-10-20', recorded: false });
  items.push({ txnId: 'X7', amount: undefined, direction: 'Received', date: '2026-10-20', recorded: false });
  items.push({ txnId: 'X8', amount: '', direction: 'Received', date: '2026-10-20', recorded: false });
  items.push({ txnId: 'X9', amount: 0, direction: 'Received', date: '2026-10-20', recorded: false });
  items.push({ txnId: 'X10', amount: -500, direction: 'Received', date: '2026-10-20', recorded: false });
  const totals = calculateInboxTotals(items, REF_DATE);

  // null/undefined/''/0 add nothing; the -500 still sums (a negative
  // payment is a real amount, not an unreadable one).
  assert.equal(totals.today.received, 3500);
  assert.equal(totals.month.received, 8500);
  assert.equal(totals.total.received, 12500);
  assert.equal(totals.today.sent, 1000);
  assert.equal(totals.total.sent, 4000);
  assert.equal(totals.total.unreadableCount, 0);
  assert.equal(totals.total.totalCount, 12);
});

test('Sharafat 54: two corrupt rows count as two unreadable', () => {
  const items = goodRows();
  items.push({ txnId: 'X11', amount: 'abc', direction: 'Received', date: '2026-10-20', recorded: false });
  items.push({ txnId: 'X12', amount: 'xyz', direction: 'Sent', date: '2026-10-20' });
  const totals = calculateInboxTotals(items, REF_DATE);

  assertGoodRowsTotals(totals);
  assert.equal(totals.total.unreadableCount, 2);
  assert.equal(totals.total.totalCount, 9);
});
