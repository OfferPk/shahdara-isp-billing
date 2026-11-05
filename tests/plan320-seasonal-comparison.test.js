import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validSeasonalComparisonMonth,
  seasonalComparisonMonthLabel,
  normalizeSeasonalMonthlyFigure,
  normalizeSeasonalComparisonGrouping,
  seasonForMonth,
  quarterForMonth,
  seasonalComparisonSeasonLabel,
  seasonalComparisonQuarterLabel,
  normalizeSeasonalMonthlyFigureRecord,
  normalizeSeasonalMonthlyFigureRecordList,
  findSeasonalMonthlyFigureRecord,
  recordSeasonalMonthlyFigure,
  removeSeasonalMonthlyFigure,
  seasonalComparisonMonths,
  buildSeasonalComparison,
  seasonalComparisonIncomplete,
  seasonalComparisonReconciles,
  seasonalComparisonGroupText,
  seasonalComparisonSummaryText,
  seasonalComparisonText,
  seasonalComparisonAllHtml,
  seasonalComparisonGroupHtml,
  seasonalComparisonCsv,
  seasonalComparisonFilename,
} from '../seasonal-comparison.js';

const dec2024 = { id: 'SC-2024-12', month: '2024-12', figures: { collections: 80000, faults: 6, exits: 1 } };
const jan2025 = { id: 'SC-2025-01', month: '2025-01', figures: { collections: 85000, faults: 5, exits: 1 } };
const feb2025 = { id: 'SC-2025-02', month: '2025-02', figures: { collections: 82000, faults: 3, exits: 0 } };
const jun2025 = { id: 'SC-2025-06', month: '2025-06', figures: { collections: 120000, faults: 2, exits: 0 } };
const jul2025 = { id: 'SC-2025-07', month: '2025-07', figures: { collections: 130000, faults: 3, exits: 1 } };
const aug2025 = { id: 'SC-2025-08', month: '2025-08', figures: { collections: 125000, faults: 2, exits: 0 } };
const dec2025 = { id: 'SC-2025-12', month: '2025-12', figures: { collections: 100000, faults: 5, exits: 1 } };
const jan2026 = { id: 'SC-2026-01', month: '2026-01', figures: { collections: 90000, faults: 7, exits: 2 } };
const feb2026 = { id: 'SC-2026-02', month: '2026-02', figures: { collections: 95000, faults: 4, exits: 0 } };
const mar2026 = { id: 'SC-2026-03', month: '2026-03', figures: { collections: 110000, faults: 3, exits: 1 } };

const twoWinters = [dec2024, jan2025, feb2025, dec2025, jan2026, feb2026];
const mixed = [...twoWinters, jun2025, jul2025, aug2025, mar2026];

test('month validation accepts YYYY-MM only', () => {
  assert.equal(validSeasonalComparisonMonth('2026-11'), '2026-11');
  assert.equal(validSeasonalComparisonMonth('2026-13'), '');
  assert.equal(validSeasonalComparisonMonth('2026-1'), '');
  assert.equal(validSeasonalComparisonMonth('Nov 2026'), '');
  assert.equal(validSeasonalComparisonMonth(null), '');
});

test('month label reads November 2026', () => {
  assert.equal(seasonalComparisonMonthLabel('2026-11'), 'November 2026');
  assert.equal(seasonalComparisonMonthLabel('2026-13'), '');
});

test('figure validation accepts whole numbers and digit strings, refuses money text, negatives and fractions', () => {
  assert.equal(normalizeSeasonalMonthlyFigure(0), 0);
  assert.equal(normalizeSeasonalMonthlyFigure('140000'), 140000);
  assert.equal(normalizeSeasonalMonthlyFigure('Rs 1800'), null);
  assert.equal(normalizeSeasonalMonthlyFigure(-5), null);
  assert.equal(normalizeSeasonalMonthlyFigure(10.5), null);
  assert.equal(normalizeSeasonalMonthlyFigure(null), null);
  assert.equal(normalizeSeasonalMonthlyFigure(true), null);
});

test('December belongs to the winter of the following year, January and February to the same winter', () => {
  assert.deepEqual(seasonForMonth('2025-12'), { season: 'Winter', seasonYear: 2026, months: [12, 1, 2] });
  assert.deepEqual(seasonForMonth('2026-01'), { season: 'Winter', seasonYear: 2026, months: [12, 1, 2] });
  assert.deepEqual(seasonForMonth('2026-02'), { season: 'Winter', seasonYear: 2026, months: [12, 1, 2] });
  assert.deepEqual(seasonForMonth('2026-06'), { season: 'Summer', seasonYear: 2026, months: [6, 7, 8] });
  assert.deepEqual(seasonForMonth('2026-09'), { season: 'Autumn', seasonYear: 2026, months: [9, 10, 11] });
  assert.equal(seasonForMonth('2026-13'), null);
});

test('quarter mapping stays inside the calendar year', () => {
  assert.deepEqual(quarterForMonth('2026-01'), { quarter: 'Q1', quarterYear: 2026, months: [1, 2, 3] });
  assert.deepEqual(quarterForMonth('2026-04'), { quarter: 'Q2', quarterYear: 2026, months: [4, 5, 6] });
  assert.deepEqual(quarterForMonth('2026-12'), { quarter: 'Q4', quarterYear: 2026, months: [10, 11, 12] });
  assert.equal(quarterForMonth('bad'), null);
});

test('season and quarter labels read Winter 2025-26 and Q1 2026', () => {
  assert.equal(seasonalComparisonSeasonLabel('Winter', 2026), 'Winter 2025-26');
  assert.equal(seasonalComparisonSeasonLabel('Summer', 2026), 'Summer 2026');
  assert.equal(seasonalComparisonSeasonLabel('Monsoon', 2026), '');
  assert.equal(seasonalComparisonQuarterLabel('Q1', 2026), 'Q1 2026');
  assert.equal(seasonalComparisonQuarterLabel('Q5', 2026), '');
});

test('grouping normalizes quarter and falls back to season', () => {
  assert.equal(normalizeSeasonalComparisonGrouping('quarter'), 'quarter');
  assert.equal(normalizeSeasonalComparisonGrouping('Q'), 'quarter');
  assert.equal(normalizeSeasonalComparisonGrouping('season'), 'season');
  assert.equal(normalizeSeasonalComparisonGrouping('half-year'), 'season');
  assert.equal(normalizeSeasonalComparisonGrouping(null), 'season');
});

test('record normalization keeps a full record and refuses missing figures, bad months and blank ids', () => {
  assert.deepEqual(normalizeSeasonalMonthlyFigureRecord(dec2025), dec2025);
  assert.equal(normalizeSeasonalMonthlyFigureRecord({ id: 'X', month: '2025-12', figures: { collections: 100, faults: 1 } }), null);
  assert.equal(normalizeSeasonalMonthlyFigureRecord({ id: 'X', month: '2025-13', figures: { collections: 100, faults: 1, exits: 0 } }), null);
  assert.equal(normalizeSeasonalMonthlyFigureRecord({ id: '  ', month: '2025-12', figures: { collections: 100, faults: 1, exits: 0 } }), null);
  assert.equal(normalizeSeasonalMonthlyFigureRecord({ id: 'X', month: '2025-12', figures: { collections: 'Rs 100', faults: 1, exits: 0 } }), null);
});

test('list normalization drops unusable entries and find locates by id', () => {
  const list = normalizeSeasonalMonthlyFigureRecordList([dec2025, { id: 'BAD' }, jan2026, null]);
  assert.equal(list.length, 2);
  assert.deepEqual(findSeasonalMonthlyFigureRecord(list, 'SC-2026-01'), jan2026);
  assert.equal(findSeasonalMonthlyFigureRecord(list, 'NOPE'), null);
});

test('recording refuses a duplicate id, a duplicate month, and a bad record, and never mutates the input', () => {
  const before = [dec2025];
  const snapshot = JSON.stringify(before);
  assert.equal(recordSeasonalMonthlyFigure(before, jan2026).length, 2);
  assert.equal(recordSeasonalMonthlyFigure(before, { id: 'SC-2025-12', month: '2026-01', figures: { collections: 1, faults: 0, exits: 0 } }).length, 1);
  assert.equal(recordSeasonalMonthlyFigure(before, { id: 'NEW', month: '2025-12', figures: { collections: 1, faults: 0, exits: 0 } }).length, 1);
  assert.equal(recordSeasonalMonthlyFigure(before, { id: 'NEW' }).length, 1);
  assert.equal(JSON.stringify(before), snapshot);
});

test('removal drops only the named record and leaves an unknown id unchanged', () => {
  assert.deepEqual(removeSeasonalMonthlyFigure([dec2025, jan2026], 'SC-2025-12'), [jan2026]);
  assert.deepEqual(removeSeasonalMonthlyFigure([dec2025], 'NOPE'), [dec2025]);
});

test('months supplied are sorted earliest first', () => {
  assert.deepEqual(seasonalComparisonMonths([jan2026, dec2024, feb2025]), ['2024-12', '2025-02', '2026-01']);
});

test('season build groups December with the following January and February and sums integer totals', () => {
  const view = buildSeasonalComparison(twoWinters);
  assert.equal(view.grouping, 'season');
  assert.equal(view.groups.length, 2);
  assert.equal(view.groups[0].label, 'Winter 2024-25');
  assert.deepEqual(view.groups[0].totals, { collections: 247000, faults: 14, exits: 2 });
  assert.equal(view.groups[1].label, 'Winter 2025-26');
  assert.deepEqual(view.groups[1].totals, { collections: 285000, faults: 16, exits: 3 });
  assert.deepEqual(view.groups[1].months, ['2025-12', '2026-01', '2026-02']);
  assert.equal(view.groups[1].complete, true);
  assert.deepEqual(view.totals, { collections: 532000, faults: 30, exits: 5 });
});

test('a season with missing months is marked incomplete and the missing months are named', () => {
  const view = buildSeasonalComparison(mixed);
  const spring = view.groups.find((group) => group.label === 'Spring 2026');
  assert.equal(spring.complete, false);
  assert.deepEqual(spring.missingMonths, ['2026-04', '2026-05']);
  assert.deepEqual(spring.totals, { collections: 110000, faults: 3, exits: 1 });
  assert.deepEqual(seasonalComparisonIncomplete(view).map((group) => group.label), ['Spring 2026']);
});

test('change against the same season last year is the plain integer difference', () => {
  const view = buildSeasonalComparison(twoWinters);
  assert.equal(view.groups[0].change, null);
  assert.deepEqual(view.groups[1].change, { collections: 38000, faults: 2, exits: 1 });
  assert.deepEqual(view.groups[1].previousTotals, { collections: 247000, faults: 14, exits: 2 });
});

test('quarter build sums the calendar quarter and marks a quarter with missing months incomplete', () => {
  const view = buildSeasonalComparison(mixed, 'quarter');
  assert.equal(view.grouping, 'quarter');
  const q1 = view.groups.find((group) => group.label === 'Q1 2026');
  assert.deepEqual(q1.totals, { collections: 295000, faults: 14, exits: 3 });
  assert.equal(q1.complete, true);
  const q4 = view.groups.find((group) => group.label === 'Q4 2025');
  assert.equal(q4.complete, false);
  assert.deepEqual(q4.missingMonths, ['2025-10', '2025-11']);
});

test('the view reconciles to the monthly figures on the same fixture and not to different figures', () => {
  const view = buildSeasonalComparison(mixed);
  assert.equal(seasonalComparisonReconciles(view, mixed), true);
  assert.equal(seasonalComparisonReconciles(view, twoWinters), false);
  const tampered = JSON.parse(JSON.stringify(view));
  tampered.totals.collections += 1;
  assert.equal(seasonalComparisonReconciles(tampered, mixed), false);
  const tamperedGroup = JSON.parse(JSON.stringify(view));
  tamperedGroup.groups[0].totals.faults += 1;
  assert.equal(seasonalComparisonReconciles(tamperedGroup, mixed), false);
});

test('building the view never mutates the input list', () => {
  const snapshot = JSON.stringify(mixed);
  buildSeasonalComparison(mixed);
  buildSeasonalComparison(mixed, 'quarter');
  assert.equal(JSON.stringify(mixed), snapshot);
});

test('the view carries no forecast: no projected or forecast field anywhere in the output', () => {
  const view = buildSeasonalComparison(mixed);
  assert.equal(/forecast|project/i.test(JSON.stringify(view)), false);
});

test('summary and group text name the incomplete season and its missing months in plain words', () => {
  const view = buildSeasonalComparison(mixed);
  const summary = seasonalComparisonSummaryText(view);
  assert.match(summary, /4 seasons from 10 months/);
  assert.match(summary, /Spring 2026/);
  assert.match(seasonalComparisonGroupText(view.groups.find((group) => group.label === 'Spring 2026')), /incomplete — missing April 2026, May 2026/);
  assert.match(seasonalComparisonGroupText(view.groups.find((group) => group.label === 'Summer 2025')), /complete/);
  assert.equal(seasonalComparisonSummaryText(buildSeasonalComparison([])), 'No seasonal figures yet.');
  assert.equal(seasonalComparisonText(buildSeasonalComparison([])), 'No seasonal figures yet.');
  assert.match(seasonalComparisonText(view), /Winter 2025-26/);
});

test('html names the incomplete season and its missing months, and csv carries one row per season', () => {
  const view = buildSeasonalComparison(mixed);
  const html = seasonalComparisonAllHtml(view);
  assert.match(html, /Winter 2025-26/);
  assert.match(html, /Incomplete — missing April 2026, May 2026/);
  assert.match(html, /Rs 285,000/);
  assert.equal(seasonalComparisonGroupHtml(view.groups[0]).includes('Winter 2024-25'), true);
  assert.equal(seasonalComparisonAllHtml(buildSeasonalComparison([])), '<p>No seasonal figures yet.</p>');
  const csv = seasonalComparisonCsv(view);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'Season,Collections (Rs),Faults,Exits,Status,Missing months,Change collections (Rs),Change faults,Change exits');
  assert.equal(lines.length, view.groups.length + 1);
  assert.match(lines[1], /Winter 2024-25,247000,14,2,Complete/);
  assert.equal(seasonalComparisonFilename(), 'seasonal-comparison.csv');
});
