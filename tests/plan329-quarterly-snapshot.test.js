import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validQuarterlySnapshotMonth,
  quarterlySnapshotMonthLabel,
  quarterForMonth,
  quarterlySnapshotQuarterLabel,
  quarterlySnapshotQuarterMonths,
  normalizeQuarterlySnapshotFigure,
  normalizeQuarterlyMonthlyFigure,
  normalizeQuarterlyMonthlyFigureList,
  findQuarterlyMonthlyFigure,
  recordQuarterlyMonthlyFigure,
  removeQuarterlyMonthlyFigure,
  buildQuarterlySnapshot,
  buildQuarterlySnapshots,
  quarterlySnapshotReconciles,
  quarterlySnapshotSummaryText,
  quarterlySnapshotsSummaryText,
  quarterlySnapshotHtml,
  quarterlySnapshotAllHtml,
  quarterlySnapshotCsv,
  quarterlySnapshotFilename,
} from '../quarterly-snapshot.js';

function figure(month, collections, gained, lost, openFaults, dues) {
  return {
    id: `QS-${month}`,
    month,
    figures: { collections, gained, lost, openFaults, dues },
  };
}

function q1Fixture() {
  return [
    figure('2026-01', 300000, 4, 1, 12, 45000),
    figure('2026-02', 310000, 3, 2, 9, 42000),
    figure('2026-03', 320000, 5, 1, 7, 40000),
  ];
}

test('valid months accept YYYY-MM only', () => {
  assert.equal(validQuarterlySnapshotMonth('2026-01'), '2026-01');
  assert.equal(validQuarterlySnapshotMonth('2026-13'), '');
  assert.equal(validQuarterlySnapshotMonth('2026-1'), '');
  assert.equal(validQuarterlySnapshotMonth('Jan 2026'), '');
  assert.equal(validQuarterlySnapshotMonth(''), '');
});

test('month labels are plain words', () => {
  assert.equal(quarterlySnapshotMonthLabel('2026-11'), 'November 2026');
  assert.equal(quarterlySnapshotMonthLabel('2026-13'), '');
});

test('quarterForMonth maps every month to its calendar quarter', () => {
  assert.deepEqual(quarterForMonth('2026-01'), { year: 2026, quarter: 'Q1' });
  assert.deepEqual(quarterForMonth('2026-03'), { year: 2026, quarter: 'Q1' });
  assert.deepEqual(quarterForMonth('2026-04'), { year: 2026, quarter: 'Q2' });
  assert.deepEqual(quarterForMonth('2026-07'), { year: 2026, quarter: 'Q3' });
  assert.deepEqual(quarterForMonth('2026-10'), { year: 2026, quarter: 'Q4' });
  assert.deepEqual(quarterForMonth('2026-12'), { year: 2026, quarter: 'Q4' });
  assert.equal(quarterForMonth('2026-13'), null);
});

test('quarter labels and quarter months', () => {
  assert.equal(quarterlySnapshotQuarterLabel(2026, 'Q1'), 'Q1 2026');
  assert.equal(quarterlySnapshotQuarterLabel(2026, 'Q5'), '');
  assert.deepEqual(quarterlySnapshotQuarterMonths(2026, 'Q1'), ['2026-01', '2026-02', '2026-03']);
  assert.deepEqual(quarterlySnapshotQuarterMonths(2026, 'Q4'), ['2026-10', '2026-11', '2026-12']);
  assert.deepEqual(quarterlySnapshotQuarterMonths(2026, 'Q5'), []);
});

test('whole-number figures only: digit strings ok, money text and fractions refused', () => {
  assert.equal(normalizeQuarterlySnapshotFigure(310000), 310000);
  assert.equal(normalizeQuarterlySnapshotFigure('310000'), 310000);
  assert.equal(normalizeQuarterlySnapshotFigure(0), 0);
  assert.equal(normalizeQuarterlySnapshotFigure('Rs 1800'), null);
  assert.equal(normalizeQuarterlySnapshotFigure(-5), null);
  assert.equal(normalizeQuarterlySnapshotFigure('-5'), null);
  assert.equal(normalizeQuarterlySnapshotFigure(12.5), null);
  assert.equal(normalizeQuarterlySnapshotFigure('12.5'), null);
  assert.equal(normalizeQuarterlySnapshotFigure(''), null);
  assert.equal(normalizeQuarterlySnapshotFigure(null), null);
});

test('normalize refuses half-formed monthly figures', () => {
  assert.equal(normalizeQuarterlyMonthlyFigure(figure('2026-01', 300000, 4, 1, 12, 45000)).month, '2026-01');
  assert.equal(normalizeQuarterlyMonthlyFigure({ month: '2026-01', figures: { collections: 1, gained: 1, lost: 1, openFaults: 1, dues: 1 } }), null);
  assert.equal(normalizeQuarterlyMonthlyFigure(figure('2026-13', 1, 1, 1, 1, 1)), null);
  assert.equal(normalizeQuarterlyMonthlyFigure(figure('2026-01', 'Rs 100', 1, 1, 1, 1)), null);
  assert.equal(normalizeQuarterlyMonthlyFigure({ id: 'X', month: '2026-01' }), null);
  assert.deepEqual(normalizeQuarterlyMonthlyFigureList([figure('2026-01', 1, 1, 1, 1, 1), { id: 'bad' }]).length, 1);
});

test('record refuses duplicates and invalid records, remove works', () => {
  const base = q1Fixture();
  assert.equal(recordQuarterlyMonthlyFigure(base, figure('2026-01', 1, 1, 1, 1, 1)).length, 3);
  assert.equal(recordQuarterlyMonthlyFigure(base, { id: 'QS-2026-01', month: '2026-04', figures: { collections: 1, gained: 1, lost: 1, openFaults: 1, dues: 1 } }).length, 3);
  assert.equal(recordQuarterlyMonthlyFigure(base, figure('2026-04', 1, 1, 1, 1, 1)).length, 4);
  assert.equal(removeQuarterlyMonthlyFigure(base, 'QS-2026-02').length, 2);
  assert.equal(removeQuarterlyMonthlyFigure(base, 'QS-2026-99').length, 3);
  assert.equal(findQuarterlyMonthlyFigure(base, '2026-02').figures.collections, 310000);
  assert.equal(findQuarterlyMonthlyFigure(base, '2026-05'), null);
});

test('a complete quarter sums flows and carries stocks from the latest month', () => {
  const snapshot = buildQuarterlySnapshot(q1Fixture(), 2026, 'Q1');
  assert.equal(snapshot.complete, true);
  assert.deepEqual(snapshot.missingMonths, []);
  assert.equal(snapshot.collections, 930000);
  assert.equal(snapshot.gained, 12);
  assert.equal(snapshot.lost, 4);
  assert.equal(snapshot.netChange, 8);
  assert.equal(snapshot.openFaults, 7);
  assert.equal(snapshot.openFaultsMonth, '2026-03');
  assert.equal(snapshot.dues, 40000);
  assert.equal(snapshot.duesMonth, '2026-03');
  assert.equal(snapshot.label, 'Q1 2026');
});

test('a quarter with a missing month is incomplete and names it', () => {
  const partial = [figure('2026-01', 300000, 4, 1, 12, 45000), figure('2026-03', 320000, 5, 1, 7, 40000)];
  const snapshot = buildQuarterlySnapshot(partial, 2026, 'Q1');
  assert.equal(snapshot.complete, false);
  assert.deepEqual(snapshot.missingMonths, ['2026-02']);
  assert.equal(snapshot.collections, 620000);
  assert.equal(snapshot.openFaults, 7);
  assert.equal(snapshot.openFaultsMonth, '2026-03');
  assert.match(quarterlySnapshotSummaryText(snapshot), /Incomplete/);
  assert.match(quarterlySnapshotSummaryText(snapshot), /February 2026/);
});

test('a quarter with no months at all is incomplete with null stocks', () => {
  const snapshot = buildQuarterlySnapshot([], 2026, 'Q2');
  assert.equal(snapshot.complete, false);
  assert.deepEqual(snapshot.missingMonths, ['2026-04', '2026-05', '2026-06']);
  assert.equal(snapshot.openFaults, null);
  assert.equal(snapshot.dues, null);
  assert.equal(snapshot.collections, 0);
});

test('invalid quarters return null', () => {
  assert.equal(buildQuarterlySnapshot(q1Fixture(), 2026, 'Q5'), null);
  assert.equal(buildQuarterlySnapshot(q1Fixture(), 'soon', 'Q1'), null);
});

test('snapshots build for every quarter with data, newest first', () => {
  const list = [...q1Fixture(), figure('2026-04', 330000, 2, 3, 5, 38000), figure('2025-10', 200000, 1, 0, 3, 10000)];
  const snapshots = buildQuarterlySnapshots(list);
  assert.deepEqual(snapshots.map((item) => item.label), ['Q2 2026', 'Q1 2026', 'Q4 2025']);
  assert.equal(snapshots[0].complete, false);
  assert.equal(snapshots[1].complete, true);
  assert.deepEqual(buildQuarterlySnapshots([]), []);
});

test('reconciliation is exact on the same fixture and false on tampered figures', () => {
  const fixture = q1Fixture();
  const snapshot = buildQuarterlySnapshot(fixture, 2026, 'Q1');
  assert.equal(quarterlySnapshotReconciles(snapshot, fixture), true);
  const tampered = [...fixture];
  tampered[1] = figure('2026-02', 999999, 3, 2, 9, 42000);
  assert.equal(quarterlySnapshotReconciles(snapshot, tampered), false);
  const dropped = fixture.slice(0, 2);
  assert.equal(quarterlySnapshotReconciles(snapshot, dropped), false);
  assert.equal(quarterlySnapshotReconciles(null, fixture), false);
});

test('building a snapshot never mutates its input, even frozen', () => {
  const fixture = q1Fixture();
  const frozen = JSON.parse(JSON.stringify(fixture));
  const deepFreeze = (value) => {
    if (value && typeof value === 'object') {
      Object.freeze(value);
      for (const item of Object.values(value)) deepFreeze(item);
    }
    return value;
  };
  deepFreeze(frozen);
  const snapshot = buildQuarterlySnapshot(frozen, 2026, 'Q1');
  assert.equal(snapshot.collections, 930000);
  assert.equal(JSON.stringify(frozen), JSON.stringify(fixture));
});

test('summary text states the figures in plain words', () => {
  const snapshot = buildQuarterlySnapshot(q1Fixture(), 2026, 'Q1');
  const text = quarterlySnapshotSummaryText(snapshot);
  assert.match(text, /Q1 2026/);
  assert.match(text, /Rs 930,000/);
  assert.match(text, /12 customers gained, 4 lost \(net 8\)/);
  assert.match(text, /Complete/);
  assert.equal(quarterlySnapshotSummaryText(null), 'No quarterly snapshot.');
  assert.equal(quarterlySnapshotsSummaryText([]), 'No quarterly snapshots.');
  assert.equal(quarterlySnapshotsSummaryText(buildQuarterlySnapshots(q1Fixture())), '1 quarterly snapshot (1 complete, 0 incomplete).');
});

test('HTML shows the snapshot figures and escapes labels', () => {
  const snapshot = buildQuarterlySnapshot(q1Fixture(), 2026, 'Q1');
  const html = quarterlySnapshotHtml(snapshot);
  assert.match(html, /Q1 2026/);
  assert.match(html, /Rs 930,000/);
  assert.match(html, /Open faults/);
  assert.equal(quarterlySnapshotHtml(null), '<p>No quarterly snapshot.</p>');
  assert.equal(quarterlySnapshotAllHtml([]), '<p>No quarterly snapshots recorded.</p>');
  assert.match(quarterlySnapshotAllHtml([snapshot]), /Q1 2026/);
});

test('CSV carries every figure with a header row', () => {
  const snapshots = buildQuarterlySnapshots(q1Fixture());
  const csv = quarterlySnapshotCsv(snapshots);
  assert.match(csv, /^Quarter,Collections \(Rs\),Gained,Lost,Net change,Open faults,Open faults as of,Dues \(Rs\),Dues as of,Complete,Missing months\n/);
  assert.match(csv, /Q1 2026,930000,12,4,8,7,March 2026,40000,March 2026,yes,/);
  assert.equal(quarterlySnapshotFilename(), 'quarterly-snapshots.csv');
});

test('net change can be negative when more customers are lost than gained', () => {
  const list = [figure('2026-04', 100000, 1, 5, 2, 10000), figure('2026-05', 100000, 0, 2, 2, 10000), figure('2026-06', 100000, 1, 1, 2, 10000)];
  const snapshot = buildQuarterlySnapshot(list, 2026, 'Q2');
  assert.equal(snapshot.netChange, -6);
  assert.equal(snapshot.gained, 2);
  assert.equal(snapshot.lost, 8);
});

test('the snapshot carries no forecast field', () => {
  const snapshot = buildQuarterlySnapshot(q1Fixture(), 2026, 'Q1');
  const keys = Object.keys(snapshot);
  assert.ok(!keys.some((key) => /forecast|project|predict|estimat/i.test(key)));
  assert.ok(!('forecast' in snapshot));
});
