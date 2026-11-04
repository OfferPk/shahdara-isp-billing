/**
 * plan70-month-snapshots.test.js — Plan 70: frozen month-end
 * balance snapshot (read-only, for audit and comparison).
 * Pins:
 * - a snapshot is taken only for a month the Plan 67 checklist
 *   records as closed, and only once per month — a second take
 *   is refused, never overwriting frozen figures;
 * - a stored snapshot's figures match the ledger at its close
 *   date on the same fixture, with the total outstanding
 *   recomputed from its own rows (exact cent sums);
 * - an unusable figure (blank, boolean, negative, non-finite)
 *   refuses the whole snapshot, never zero-fills it;
 * - strict months and dates (2026-02-30 is not a date);
 * - opening a snapshot never edits it, and later ledger
 *   movement (a changed input row) never alters a stored
 *   snapshot, because figures are copied at take time;
 * - comparing two snapshots shows the change with each month's
 *   figures intact; joined/left customers carry a null change,
 *   never a change against a guessed zero;
 * - snapshots export as flat rows for the Plan 32 export pack,
 *   and the pack's counts and totals stay exactly as Plan 32
 *   defined them;
 * - the module holds no bill, payment, concession, expense, or
 *   month-close field of its own, and never mutates inputs.
 * Synthetic data only; no live record is ever changed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validSnapshotMonth,
  validSnapshotDate,
  toSnapshotCents,
  normalizeSnapshot,
  normalizeSnapshotList,
  findSnapshot,
  takeSnapshot,
  removeSnapshot,
  snapshotSummaryText,
  snapshotHtml,
  snapshotCsv,
  snapshotFilename,
  snapshotExportRows,
  compareSnapshots,
  compareSnapshotsSummaryText,
  compareSnapshotsHtml,
  compareSnapshotsCsv,
} from '../month-snapshots.js';
import { buildExportPack, exportPackCsv } from '../export-pack.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const closedOct = { month: '2026-10', status: 'closed', closedDate: '2026-10-31', closedBy: 'Owner' };
const openNov = { month: '2026-11', status: 'open' };

function fixtureRows() {
  return [
    { customerId: 'c1', customerName: 'Ahmed', mohalla: 'Bani', closing: 1000 },
    { customerId: 'c2', customerName: 'Bilal', mohalla: 'Kishti', closing: 333.33 },
    { customerId: 'c3', customerName: 'Usman', mohalla: 'Chamyaa', closing: 166.67 },
  ];
}

function takeOct(list = []) {
  return takeSnapshot(list, {
    month: '2026-10',
    closeDate: '2026-10-31',
    closedBy: 'Owner',
    customers: fixtureRows(),
    collections: 2500,
    expenses: 800,
    monthClose: closedOct,
  });
}

test('strict months and dates', () => {
  assert.equal(validSnapshotMonth('2026-10'), true);
  assert.equal(validSnapshotMonth('2026-13'), false);
  assert.equal(validSnapshotMonth('2026-1'), false);
  assert.equal(validSnapshotDate('2026-10-31'), true);
  assert.equal(validSnapshotDate('2026-02-30'), false);
  assert.equal(validSnapshotDate('2026-02-29'), false);
  assert.equal(toSnapshotCents(333.33), 33333);
  assert.equal(toSnapshotCents(''), null);
  assert.equal(toSnapshotCents(true), null);
  assert.equal(toSnapshotCents(-5), null);
  assert.equal(toSnapshotCents(Number.NaN), null);
});

test('snapshot taken for a closed month matches its rows exactly', () => {
  const list = takeOct();
  assert.equal(list.length, 1);
  const snap = list[0];
  assert.equal(snap.month, '2026-10');
  assert.equal(snap.closeDate, '2026-10-31');
  assert.equal(snap.customerCount, 3);
  // 1000 + 333.33 + 166.67 = 1500 exactly, in integer cents.
  assert.equal(snap.totalOutstandingCents, 150000);
  assert.equal(snap.totalOutstanding, 1500);
  assert.equal(snap.collectionsCents, 250000);
  assert.equal(snap.expensesCents, 80000);
  assert.match(snapshotSummaryText(snap), /2026-10 frozen at close on 2026-10-31/);
  assert.match(snapshotSummaryText(snap), /total outstanding Rs\. 1500\.00/);
});

test('snapshot refused for an open month, a mismatched close record, or a missing close record', () => {
  const attempt = (monthClose) => takeSnapshot([], {
    month: '2026-11', closeDate: '2026-11-30', customers: fixtureRows(), collections: 100, expenses: 50, monthClose,
  });
  assert.deepEqual(attempt(openNov), []);
  assert.deepEqual(attempt(null), []);
  assert.deepEqual(attempt({ month: '2026-10', status: 'closed' }), []);
});

test('one snapshot per month: a second take never overwrites frozen figures', () => {
  const list = takeOct();
  const again = takeSnapshot(list, {
    month: '2026-10',
    closeDate: '2026-10-31',
    customers: [{ customerId: 'c9', customerName: 'Changed', closing: 9999 }],
    collections: 1,
    expenses: 1,
    monthClose: closedOct,
  });
  assert.equal(again.length, 1);
  assert.equal(again[0].totalOutstandingCents, 150000);
  assert.equal(again[0].customers[0].customerName, 'Ahmed');
});

test('half-formed snapshots refused outright, never stored half-formed', () => {
  assert.equal(normalizeSnapshot({ month: '2026-13', closeDate: '2026-10-31', customers: fixtureRows(), collections: 1, expenses: 1 }), null);
  assert.equal(normalizeSnapshot({ month: '2026-10', closeDate: '2026-02-30', customers: fixtureRows(), collections: 1, expenses: 1 }), null);
  assert.equal(normalizeSnapshot({ month: '2026-10', closeDate: '2026-10-31', customers: [], collections: 1, expenses: 1 }), null);
  assert.equal(normalizeSnapshot({ month: '2026-10', closeDate: '2026-10-31', customers: [fixtureRows()[0], fixtureRows()[0]], collections: 1, expenses: 1 }), null);
  assert.equal(normalizeSnapshot({ month: '2026-10', closeDate: '2026-10-31', customers: fixtureRows(), collections: '', expenses: 1 }), null);
  assert.equal(normalizeSnapshot({ month: '2026-10', closeDate: '2026-10-31', customers: fixtureRows(), collections: 1, expenses: true }), null);
});

test('unusable closing balance refuses the snapshot, never zero-fills it', () => {
  const rows = fixtureRows();
  rows[1].closing = '';
  const list = takeSnapshot([], {
    month: '2026-10', closeDate: '2026-10-31', customers: rows, collections: 2500, expenses: 800, monthClose: closedOct,
  });
  assert.deepEqual(list, []);
  const negative = fixtureRows();
  negative[0].closing = -100;
  assert.deepEqual(takeSnapshot([], {
    month: '2026-10', closeDate: '2026-10-31', customers: negative, collections: 2500, expenses: 800, monthClose: closedOct,
  }), []);
});

test('opening a snapshot never edits it, and later ledger movement never alters it', () => {
  const rows = fixtureRows();
  const list = takeOct();
  const found = findSnapshot(list, '2026-10');
  found.customers[0].closing = 9999;
  found.totalOutstandingCents = 1;
  const again = findSnapshot(list, '2026-10');
  assert.equal(again.customers[0].closing, 1000);
  assert.equal(again.totalOutstandingCents, 150000);
  // The caller's rows move on after the take; the stored snapshot does not.
  rows[0].closing = 7777;
  const stored = findSnapshot(list, '2026-10');
  assert.equal(stored.customers[0].closing, 1000);
});

test('inputs are never mutated', () => {
  const rows = fixtureRows();
  const before = JSON.stringify(rows);
  takeOct();
  assert.equal(JSON.stringify(rows), before);
  const list = takeOct();
  const snapshot = JSON.parse(JSON.stringify(list[0]));
  snapshotHtml(list[0]);
  snapshotCsv(list[0]);
  compareSnapshots(list[0], list[0]);
  assert.deepEqual(list[0], snapshot);
});

test('comparing two snapshots shows the change with each month intact', () => {
  const oct = takeOct()[0];
  const nov = takeSnapshot([], {
    month: '2026-11',
    closeDate: '2026-11-30',
    closedBy: 'Owner',
    customers: [
      { customerId: 'c1', customerName: 'Ahmed', mohalla: 'Bani', closing: 1200 },
      { customerId: 'c2', customerName: 'Bilal', mohalla: 'Kishti', closing: 333.33 },
      { customerId: 'c4', customerName: 'Danish', mohalla: 'Bani', closing: 500 },
    ],
    collections: 3000,
    expenses: 900,
    monthClose: { month: '2026-11', status: 'closed' },
  })[0];
  const cmp = compareSnapshots(oct, nov);
  // Totals: outstanding 1500 -> 2033.33 (+533.33), collections +500, expenses +100.
  assert.equal(cmp.totalOutstandingChangeCents, 53333);
  assert.equal(cmp.collectionsChangeCents, 50000);
  assert.equal(cmp.expensesChangeCents, 10000);
  const ahmed = cmp.perCustomer.find((row) => row.customerId === 'c1');
  assert.equal(ahmed.changeCents, 20000);
  assert.equal(ahmed.status, 'changed');
  const bilal = cmp.perCustomer.find((row) => row.customerId === 'c2');
  assert.equal(bilal.status, 'unchanged');
  const usman = cmp.perCustomer.find((row) => row.customerId === 'c3');
  assert.equal(usman.status, 'left');
  assert.equal(usman.changeCents, null);
  const danish = cmp.perCustomer.find((row) => row.customerId === 'c4');
  assert.equal(danish.status, 'joined');
  assert.equal(danish.changeCents, null);
  // Each month's own figures are untouched by the comparison.
  assert.equal(cmp.earlier.totalOutstandingCents, 150000);
  assert.equal(cmp.later.totalOutstandingCents, 203333);
  assert.equal(oct.totalOutstandingCents, 150000);
  assert.match(compareSnapshotsSummaryText(cmp), /2026-10 → 2026-11/);
  assert.match(compareSnapshotsHtml(cmp), /Danish/);
  assert.match(compareSnapshotsCsv(cmp), /TOTAL,1500,2033\.33,533\.33/);
  assert.equal(compareSnapshots(null, nov), null);
  assert.equal(compareSnapshots(oct, { month: 'bad' }), null);
});

test('remove drops a whole snapshot; snapshots list sorted by month', () => {
  const list = normalizeSnapshotList([takeOct()[0], takeSnapshot([], {
    month: '2026-09', closeDate: '2026-09-30', customers: fixtureRows(), collections: 1, expenses: 1,
    monthClose: { month: '2026-09', status: 'closed' },
  })[0]]);
  assert.deepEqual(list.map((row) => row.month), ['2026-09', '2026-10']);
  assert.deepEqual(removeSnapshot(list, '2026-09').map((row) => row.month), ['2026-10']);
  assert.equal(findSnapshot(list, '2026-12'), null);
});

test('snapshots export as flat rows for the Plan 32 export pack', () => {
  const list = takeOct();
  const rows = snapshotExportRows(list);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], { month: '2026-10', closeDate: '2026-10-31', customerId: 'c1', customerName: 'Ahmed', mohalla: 'Bani', closingBalance: 1000 });
  const pack = buildExportPack({ customers: [], expenses: [], exportDate: '2026-11-04', snapshots: list });
  assert.equal(pack.snapshotCount, 3);
  assert.equal(pack.snapshotExcluded, 0);
  // Plan 32 counts and totals stay exactly as defined, untouched by snapshots.
  assert.deepEqual(pack.counts, { customers: 0, bills: 0, payments: 0, waadas: 0, expenses: 0 });
  assert.match(exportPackCsv(pack, 'snapshots'), /2026-10,2026-10-31,c1,Ahmed,Bani,1000/);
  const badPack = buildExportPack({ customers: [], expenses: [], exportDate: '2026-11-04', snapshots: [{ month: '2026-10', closeDate: '2026-10-31', customers: [{ customerId: '', customerName: 'No id', closing: 5 }] }] });
  assert.equal(badPack.snapshotCount, 0);
  assert.equal(badPack.snapshotExcluded, 1);
});

test('no ledger field fence, HTML escaping, CSV quoting, filename', () => {
  const source = awaitImportSource();
  assert.doesNotMatch(source, /\b(billId|paymentId|waadaId|expenseId|monthCloseId)\b/);
  const snap = takeOct()[0];
  const quoted = normalizeSnapshot({
    month: '2026-10', closeDate: '2026-10-31',
    customers: [{ customerId: 'c1', customerName: 'A "quoted", name', mohalla: 'Bani', closing: 100 }],
    collections: 100, expenses: 10,
  });
  assert.match(snapshotHtml(quoted), /A &quot;quoted&quot;, name/);
  assert.match(snapshotCsv(quoted), /"A ""quoted"", name"/);
  assert.equal(snapshotFilename('2026-10'), 'month-snapshot-2026-10.csv');
  assert.equal(snapshotFilename('bad'), 'month-snapshot.csv');
  assert.equal(snapshotHtml(null), '');
  assert.equal(snapshotCsv(null), '');
  assert.equal(snapshotSummaryText(null), '');
});

function awaitImportSource() {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'month-snapshots.js'), 'utf8');
}
