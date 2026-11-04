/**
 * plan85-move-transfers.test.js — Plan 85: move-house pause and
 * transfer (same customer, new address).
 * Pins:
 * - one move per record with old and new mohalla/address,
 *   pause start, expected reconnect, and a hold treatment;
 * - half-formed records refused outright (no id/customer,
 *   unknown status/treatment, blank address, impossible
 *   dates, reconnect on or before the pause start, a
 *   retention move without a positive charge);
 * - a month fully inside the gap takes the move's treatment
 *   (no bill, or exactly the retention charge and nothing
 *   else); a partly-inside month is ordinary, never an
 *   invented pro-rata split;
 * - reconnecting closes the move with a date and keeps the
 *   full record; only a pending move can reconnect, and
 *   reopening clears the reconnect date;
 * - pending moves feed Plan 84's resume queue in its
 *   relocation shape, and a reconnected move never queues;
 * - a move creates no customer, bill, payment, or deposit
 *   record, so the module holds no such field;
 * - impossible dates (2026-02-30) are never stored as a date.
 * Synthetic data only; no bill, payment, or customer record
 * is ever changed by this plan.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MOVE_STATUSES,
  MOVE_TREATMENTS,
  validMoveDate,
  moveMohallaKey,
  normalizeMove,
  normalizeMoveList,
  findMove,
  upsertMove,
  removeMove,
  moveGapTreatment,
  moveGapTreatmentText,
  reconnectMove,
  reopenMove,
  movesFiltered,
  pendingMoves,
  buildMoveSummary,
  moveSummaryText,
  toResumeRelocation,
  movesToResumeRelocations,
  moveHtml,
  moveCsv,
  moveFilename,
} from '../move-transfers.js';
import { buildResumeQueue } from '../resume-queue.js';

function move(overrides = {}) {
  return {
    id: 'm1',
    customerId: 'c1',
    customerName: 'Ayesha',
    oldMohalla: 'BANII',
    oldAddress: 'Gali 3, Bani',
    newMohalla: 'KISHTII',
    newAddress: 'Gali 9, Kishti',
    pauseStartDate: '2026-01-10',
    expectedReconnectDate: '2026-03-15',
    treatment: 'no_bill',
    status: 'pending',
    ...overrides,
  };
}

test('strict dates: impossible dates are not dates', () => {
  assert.equal(validMoveDate('2026-02-30'), null);
  assert.equal(validMoveDate('2026-13-01'), null);
  assert.equal(validMoveDate('not a date'), null);
  assert.equal(validMoveDate('2026-01-10'), '2026-01-10');
});

test('catalogues: statuses and treatments are fixed', () => {
  assert.deepEqual(MOVE_STATUSES, ['pending', 'reconnected']);
  assert.deepEqual(MOVE_TREATMENTS, ['no_bill', 'retention']);
});

test('half-formed moves are refused outright', () => {
  assert.equal(normalizeMove(move({ id: '' })), null);
  assert.equal(normalizeMove(move({ customerId: '' })), null);
  assert.equal(normalizeMove(move({ oldAddress: '  ' })), null);
  assert.equal(normalizeMove(move({ newAddress: '' })), null);
  assert.equal(normalizeMove(move({ status: 'done' })), null);
  assert.equal(normalizeMove(move({ treatment: 'free' })), null);
  assert.equal(normalizeMove(move({ pauseStartDate: '2026-02-30' })), null);
  assert.equal(normalizeMove(move({ expectedReconnectDate: '2026-01-10' })), null);
  assert.equal(normalizeMove(move({ expectedReconnectDate: '2026-01-09' })), null);
  assert.equal(normalizeMove(move({ treatment: 'retention' })), null);
  assert.equal(normalizeMove(move({ treatment: 'retention', retentionAmount: '0' })), null);
  assert.equal(normalizeMove(move({ status: 'reconnected' })), null);
  assert.equal(normalizeMove(move({ status: 'reconnected', actualReconnectDate: '2026-01-09' })), null);
});

test('no-bill move drops a stray retention amount', () => {
  const entry = normalizeMove(move({ retentionAmount: '500' }));
  assert.equal(entry.retentionCents, null);
});

test('retention move keeps exactly its charge in integer cents', () => {
  const entry = normalizeMove(move({ treatment: 'retention', retentionAmount: '500' }));
  assert.equal(entry.retentionCents, 50000);
  const fromCents = normalizeMove(move({ treatment: 'retention', retentionCents: 50000 }));
  assert.equal(fromCents.retentionCents, 50000);
});

test('rupees convert once, cents used as-is on re-read', () => {
  const entry = normalizeMove(move({ treatment: 'retention', retentionAmount: '500' }));
  const reread = normalizeMove(entry);
  assert.equal(reread.retentionCents, 50000);
});

test('mohalla keys follow the Plan T canonical rule', () => {
  assert.equal(moveMohallaKey('Mohalla Bani'), 'BANII');
  assert.equal(moveMohallaKey('bani'), 'BANII');
  assert.equal(moveMohallaKey(''), '__unassigned__');
  assert.equal(moveMohallaKey('Kishti'), 'KISHTII');
});

test('upsert, find, and remove keep one record per id', () => {
  let list = upsertMove([], move());
  list = upsertMove(list, move({ newAddress: 'Gali 10, Kishti' }));
  assert.equal(list.length, 1);
  assert.equal(findMove(list, 'm1').newAddress, 'Gali 10, Kishti');
  assert.equal(findMove(list, 'missing'), null);
  list = removeMove(list, 'm1');
  assert.deepEqual(list, []);
  // A half-formed upsert leaves the list unchanged.
  list = upsertMove([move()], move({ id: 'm2', newAddress: '' }));
  assert.equal(list.length, 1);
});

test('upsert never mutates its inputs', () => {
  const input = move();
  const before = JSON.stringify(input);
  upsertMove([move()], move({ id: 'm2', newAddress: 'Somewhere else' }));
  assert.equal(JSON.stringify(input), before);
});

test('gap treatment: fully-inside month takes the treatment, partial month is ordinary', () => {
  const noBill = move();
  assert.deepEqual(moveGapTreatment(noBill, '2026-02'), { month: '2026-02', treatment: 'no_bill', chargeCents: 0, fullyInside: true });
  assert.deepEqual(moveGapTreatment(noBill, '2026-01'), { month: '2026-01', treatment: 'ordinary', chargeCents: null, fullyInside: false });
  assert.deepEqual(moveGapTreatment(noBill, '2026-03'), { month: '2026-03', treatment: 'ordinary', chargeCents: null, fullyInside: false });
  const retention = move({ treatment: 'retention', retentionAmount: '500' });
  assert.deepEqual(moveGapTreatment(retention, '2026-02'), { month: '2026-02', treatment: 'retention', chargeCents: 50000, fullyInside: true });
  assert.equal(moveGapTreatment(noBill, '2026-13'), null);
  assert.equal(moveGapTreatment(noBill, 'not-a-month'), null);
  assert.match(moveGapTreatmentText(moveGapTreatment(noBill, '2026-02')), /no bill raised/);
  assert.match(moveGapTreatmentText(moveGapTreatment(retention, '2026-02')), /500\.00/);
  assert.match(moveGapTreatmentText(moveGapTreatment(noBill, '2026-01')), /ordinary/);
});

test('reconnecting closes the move and keeps both addresses and both dates', () => {
  const list = reconnectMove([move()], 'm1', '2026-03-12');
  const entry = list[0];
  assert.equal(entry.status, 'reconnected');
  assert.equal(entry.actualReconnectDate, '2026-03-12');
  assert.equal(entry.oldAddress, 'Gali 3, Bani');
  assert.equal(entry.newAddress, 'Gali 9, Kishti');
  assert.equal(entry.pauseStartDate, '2026-01-10');
  assert.equal(entry.expectedReconnectDate, '2026-03-15');
  // A reconnected gap month is judged against the actual date.
  assert.equal(moveGapTreatment(entry, '2026-03').treatment, 'ordinary');
});

test('reconnect gate: only a pending move with a real date on or after the pause start', () => {
  const pending = [move()];
  assert.equal(reconnectMove(pending, 'm1', '2026-01-09')[0].status, 'pending');
  assert.equal(reconnectMove(pending, 'm1', '2026-02-30')[0].status, 'pending');
  assert.equal(reconnectMove(pending, 'missing', '2026-03-12').length, 1);
  const closed = reconnectMove(pending, 'm1', '2026-03-12');
  assert.equal(reconnectMove(closed, 'm1', '2026-03-13')[0].actualReconnectDate, '2026-03-12');
});

test('reopening clears the reconnect date but keeps the record', () => {
  const closed = reconnectMove([move()], 'm1', '2026-03-12');
  const reopened = reopenMove(closed, 'm1');
  assert.equal(reopened[0].status, 'pending');
  assert.equal(reopened[0].actualReconnectDate, '');
  assert.equal(reopened[0].oldAddress, 'Gali 3, Bani');
  assert.equal(reopenMove([move()], 'm1')[0].status, 'pending');
});

test('filters: status, treatment, and either mohalla', () => {
  const list = [
    move({ id: 'a', status: 'pending', treatment: 'no_bill' }),
    move({ id: 'b', status: 'reconnected', actualReconnectDate: '2026-03-12', treatment: 'retention', retentionAmount: '250' }),
    move({ id: 'c', oldMohalla: 'CHAMYAAA', newMohalla: 'BANII' }),
  ];
  assert.deepEqual(movesFiltered(list, { status: 'pending' }).map((row) => row.id), ['a', 'c']);
  assert.deepEqual(movesFiltered(list, { treatment: 'retention' }).map((row) => row.id), ['b']);
  assert.deepEqual(movesFiltered(list, { mohalla: 'chamyaa' }).map((row) => row.id), ['c']);
  assert.deepEqual(movesFiltered(list, { mohalla: 'kishti' }).map((row) => row.id), ['a', 'b']);
  assert.deepEqual(pendingMoves(list).map((row) => row.id), ['a', 'c']);
});

test('summary counts pending and reconnected', () => {
  const summary = buildMoveSummary([
    move({ id: 'a' }),
    move({ id: 'b', status: 'reconnected', actualReconnectDate: '2026-03-12' }),
  ]);
  assert.equal(summary.total, 2);
  assert.equal(summary.pending, 1);
  assert.equal(summary.reconnected, 1);
  assert.match(moveSummaryText(summary), /2 moves recorded: 1 pending, 1 reconnected/);
});

test('resume shape: pending moves queue, reconnected moves never queue', () => {
  const relocation = toResumeRelocation(move());
  assert.equal(relocation.kind, undefined);
  assert.equal(relocation.returnDate, '2026-03-15');
  assert.equal(relocation.status, 'pending');
  assert.equal(relocation.mohalla, 'KISHTII');
  assert.equal(toResumeRelocation(reconnectMove([move()], 'm1', '2026-03-12')[0]), null);
  assert.equal(toResumeRelocation(move({ expectedReconnectDate: '2026-02-30' })), null);
  assert.deepEqual(movesToResumeRelocations([move(), move({ id: 'm2' })]).map((row) => row.id), ['m1', 'm2']);
  // The shape round-trips through Plan 84's queue builder.
  const queue = buildResumeQueue([], movesToResumeRelocations([move()]), { today: '2026-03-10', windowDays: 7 });
  assert.equal(queue.length, 1);
  assert.equal(queue[0].kind, 'relocation');
  assert.equal(queue[0].treatment, 'relocation');
});

test('no ledger fields: a move record carries no bill, payment, package, or deposit field', () => {
  const keys = Object.keys(normalizeMove(move()));
  for (const key of keys) {
    assert.ok(!/bill|payment|package|deposit|customer record/i.test(key), `unexpected ledger field ${key}`);
  }
  const source = readFileSync(new URL('../move-transfers.js', import.meta.url), 'utf8');
  assert.ok(!/newCustomer|createCustomer|duplicateBill|newDeposit/.test(source));
});

test('html escaping, csv quoting, and filename', () => {
  const row = move({ customerName: 'A <b>& "Q"' });
  assert.ok(!moveHtml([row]).includes('<b>'));
  assert.ok(moveHtml([row]).includes('&lt;b&gt;'));
  const csv = moveCsv([move({ newAddress: 'Gali "9", Kishti' })]);
  assert.ok(csv.includes('"Gali ""9"", Kishti"'));
  assert.equal(moveFilename(), 'move-transfers.csv');
});
