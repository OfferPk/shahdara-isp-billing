import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MONTHLY_KPI_FIGURES,
  validMonthlyKpiMonth,
  monthlyKpiMonthLabel,
  normalizeMonthlyKpiFigure,
  monthlyKpiFigureDef,
  normalizeMonthlyKpiSheet,
  normalizeMonthlyKpiSheetList,
  findMonthlyKpiSheet,
  recordMonthlyKpiSheet,
  removeMonthlyKpiSheet,
  monthlyKpiSheetsSorted,
  monthlyKpiSheetMonths,
  monthlyKpiSheetComplete,
  monthlyKpiSheetMissingSources,
  monthlyKpiSheetMatches,
  monthlyKpiSheetSummaryText,
  monthlyKpiSheetEntryText,
  monthlyKpiSheetEntryHtml,
  monthlyKpiSheetAllHtml,
  monthlyKpiSheetCsv,
  monthlyKpiSheetFilename,
} from '../monthly-kpi-sheet.js';

const october = {
  id: 'KPI-2026-10',
  month: '2026-10',
  recordedBy: 'Owner',
  figures: {
    collections: 285000,
    newCustomers: 4,
    exitedCustomers: 1,
    openFaults: 3,
    duesOutstanding: 12000,
  },
};

const november = {
  id: 'KPI-2026-11',
  month: '2026-11',
  recordedBy: 'Owner',
  figures: {
    collections: 301000,
    newCustomers: 2,
    exitedCustomers: 0,
    openFaults: 5,
    duesOutstanding: null,
  },
};

const octoberSources = {
  collections: 285000,
  newCustomers: 4,
  exitedCustomers: 1,
  openFaults: 3,
  duesOutstanding: 12000,
};

test('Plan 318: a month is YYYY-MM with a real month number', () => {
  assert.equal(validMonthlyKpiMonth('2026-11'), true);
  assert.equal(validMonthlyKpiMonth('2026-13'), false);
  assert.equal(validMonthlyKpiMonth('2026-1'), false);
  assert.equal(validMonthlyKpiMonth('2026-11-05'), false);
  assert.equal(validMonthlyKpiMonth(''), false);
  assert.equal(validMonthlyKpiMonth(202611), false);
  assert.equal(monthlyKpiMonthLabel('2026-11'), 'November 2026');
  assert.equal(monthlyKpiMonthLabel('2026-02'), 'February 2026');
  assert.equal(monthlyKpiMonthLabel('2026-13'), '');
});

test('Plan 318: the sheet carries exactly five figures, each naming its source report', () => {
  assert.deepEqual(MONTHLY_KPI_FIGURES.map((figure) => figure.key), [
    'collections', 'newCustomers', 'exitedCustomers', 'openFaults', 'duesOutstanding',
  ]);
  for (const figure of MONTHLY_KPI_FIGURES) {
    assert.ok(figure.label.length > 0);
    assert.ok(figure.source.length > 0);
    assert.equal(monthlyKpiFigureDef(figure.key), figure);
  }
  assert.equal(monthlyKpiFigureDef('bills'), null);
});

test('Plan 318: a figure accepts a whole number or a digit string, and a blank reads as missing', () => {
  assert.equal(normalizeMonthlyKpiFigure(0), 0);
  assert.equal(normalizeMonthlyKpiFigure(285000), 285000);
  assert.equal(normalizeMonthlyKpiFigure('301000'), 301000);
  assert.equal(normalizeMonthlyKpiFigure('  12  '), 12);
  assert.equal(normalizeMonthlyKpiFigure(null), null);
  assert.equal(normalizeMonthlyKpiFigure(undefined), null);
  assert.equal(normalizeMonthlyKpiFigure(''), null);
  assert.equal(normalizeMonthlyKpiFigure('   '), null);
});

test('Plan 318: a figure refuses negatives, fractions, and money written as text', () => {
  assert.equal(normalizeMonthlyKpiFigure(-1), undefined);
  assert.equal(normalizeMonthlyKpiFigure(1.5), undefined);
  assert.equal(normalizeMonthlyKpiFigure('Rs 1800'), undefined);
  assert.equal(normalizeMonthlyKpiFigure('1800 Rs'), undefined);
  assert.equal(normalizeMonthlyKpiFigure('1,800'), undefined);
  assert.equal(normalizeMonthlyKpiFigure('twelve'), undefined);
  assert.equal(normalizeMonthlyKpiFigure(true), undefined);
  assert.equal(normalizeMonthlyKpiFigure({}), undefined);
});

test('Plan 318: a valid sheet normalises to its stored shape', () => {
  assert.deepEqual(normalizeMonthlyKpiSheet(october), october);
  assert.deepEqual(normalizeMonthlyKpiSheet(november), november);
});

test('Plan 318: a sheet is refused without an id, a valid month, or a recorder', () => {
  assert.equal(normalizeMonthlyKpiSheet({ ...october, id: '  ' }), null);
  assert.equal(normalizeMonthlyKpiSheet({ ...october, month: '2026-13' }), null);
  assert.equal(normalizeMonthlyKpiSheet({ ...october, month: 'October 2026' }), null);
  assert.equal(normalizeMonthlyKpiSheet({ ...october, recordedBy: '' }), null);
  assert.equal(normalizeMonthlyKpiSheet(null), null);
  assert.equal(normalizeMonthlyKpiSheet('sheet'), null);
});

test('Plan 318: a sheet with every figure missing is refused, never recorded blank', () => {
  const blank = {
    id: 'KPI-2026-12',
    month: '2026-12',
    recordedBy: 'Owner',
    figures: { collections: null, newCustomers: '', exitedCustomers: null, openFaults: '', duesOutstanding: null },
  };
  assert.equal(normalizeMonthlyKpiSheet(blank), null);
  assert.equal(recordMonthlyKpiSheet([], blank).length, 0);
});

test('Plan 318: a sheet with any invalid figure is refused outright', () => {
  assert.equal(normalizeMonthlyKpiSheet({
    ...october,
    figures: { ...october.figures, collections: 'Rs 285000' },
  }), null);
  assert.equal(normalizeMonthlyKpiSheet({
    ...october,
    figures: { ...october.figures, openFaults: -2 },
  }), null);
  assert.equal(normalizeMonthlyKpiSheet({
    ...october,
    figures: { ...october.figures, newCustomers: 1.5 },
  }), null);
});

test('Plan 318: unknown fields are dropped, so a sheet can never grow a bill or customer field', () => {
  const withExtras = { ...october, billId: 'B-1', customerId: 'C-1', amount: 999, figures: { ...october.figures, billTotal: 500 } };
  assert.deepEqual(normalizeMonthlyKpiSheet(withExtras), october);
});

test('Plan 318: recording adds a sheet, and a second sheet for the same month is refused', () => {
  const list = recordMonthlyKpiSheet([], october);
  assert.equal(list.length, 1);
  const again = recordMonthlyKpiSheet(list, { ...november, month: '2026-10', id: 'KPI-OTHER' });
  assert.equal(again.length, 1);
  assert.deepEqual(again[0], october);
  const sameId = recordMonthlyKpiSheet(list, { ...november, id: 'KPI-2026-10' });
  assert.equal(sameId.length, 1);
  assert.deepEqual(sameId[0], october);
});

test('Plan 318: recording never changes the list it was given', () => {
  const before = [];
  const after = recordMonthlyKpiSheet(before, october);
  assert.equal(before.length, 0);
  assert.notEqual(after, before);
  assert.deepEqual(after, [october]);
});

test('Plan 318: find, remove, sort, and months work on the stored list', () => {
  const list = recordMonthlyKpiSheet(recordMonthlyKpiSheet([], november), october);
  assert.deepEqual(findMonthlyKpiSheet(list, '2026-10'), october);
  assert.equal(findMonthlyKpiSheet(list, '2026-12'), null);
  assert.equal(findMonthlyKpiSheet(list, 'bad'), null);
  assert.deepEqual(monthlyKpiSheetsSorted(list).map((sheet) => sheet.month), ['2026-10', '2026-11']);
  assert.deepEqual(monthlyKpiSheetMonths(list), ['2026-10', '2026-11']);
  const removed = removeMonthlyKpiSheet(list, 'KPI-2026-10');
  assert.deepEqual(removed.map((sheet) => sheet.month), ['2026-11']);
  assert.equal(removeMonthlyKpiSheet(list, 'KPI-NOPE').length, 2);
  assert.equal(removeMonthlyKpiSheet(list, '').length, 2);
});

test('Plan 318: a month with a missing source is incomplete, and the missing sources are named', () => {
  assert.equal(monthlyKpiSheetComplete(october), true);
  assert.equal(monthlyKpiSheetComplete(november), false);
  assert.deepEqual(monthlyKpiSheetMissingSources(october), []);
  assert.deepEqual(monthlyKpiSheetMissingSources(november), [
    { key: 'duesOutstanding', label: 'Dues outstanding', source: 'Dues report' },
  ]);
  assert.equal(monthlyKpiSheetComplete(null), false);
  assert.deepEqual(monthlyKpiSheetMissingSources(null), []);
});

test('Plan 318: a sheet matches its source reports on the same fixture', () => {
  assert.equal(monthlyKpiSheetMatches(octoberSources, october), true);
  assert.equal(monthlyKpiSheetMatches({ ...octoberSources, collections: 285001 }, october), false);
  assert.equal(monthlyKpiSheetMatches({ ...octoberSources, openFaults: 4 }, october), false);
  assert.equal(monthlyKpiSheetMatches({ ...octoberSources, duesOutstanding: '12000' }, october), true);
  assert.equal(monthlyKpiSheetMatches({ ...octoberSources, duesOutstanding: 'Rs 12000' }, october), false);
  assert.equal(monthlyKpiSheetMatches(octoberSources, null), false);
  assert.equal(monthlyKpiSheetMatches(null, october), false);
});

test('Plan 318: a missing figure is never checked against a source — it was never filled', () => {
  const sources = { collections: 301000, newCustomers: 2, exitedCustomers: 0, openFaults: 5 };
  assert.equal(monthlyKpiSheetMatches(sources, november), true);
  assert.equal(monthlyKpiSheetMatches({ ...sources, openFaults: 6 }, november), false);
});

test('Plan 318: summary text counts complete and incomplete sheets', () => {
  assert.equal(monthlyKpiSheetSummaryText([]), 'No monthly KPI sheets recorded.');
  assert.equal(monthlyKpiSheetSummaryText([october]), '1 monthly KPI sheet recorded: 1 complete, 0 incomplete.');
  assert.equal(
    monthlyKpiSheetSummaryText([october, november]),
    '2 monthly KPI sheets recorded: 1 complete, 1 incomplete.',
  );
});

test('Plan 318: entry text names every source report and marks a missing figure plainly', () => {
  const text = monthlyKpiSheetEntryText(october);
  assert.ok(text.includes('October 2026'));
  assert.ok(text.includes('Complete'));
  assert.ok(text.includes('Collections (Collections report): Rs 285000'));
  assert.ok(text.includes('New customers (New customers report): 4 customers'));
  assert.ok(text.includes('Open faults (Faults report): 3 faults'));
  assert.ok(text.includes('Dues outstanding (Dues report): Rs 12000'));
  const incomplete = monthlyKpiSheetEntryText(november);
  assert.ok(incomplete.includes('Incomplete'));
  assert.ok(incomplete.includes('Dues outstanding (Dues report): not recorded, source missing'));
  assert.equal(monthlyKpiSheetEntryText(null), 'No monthly KPI sheet.');
});

test('Plan 318: entry HTML shows each figure with its source and escapes recorder text', () => {
  const html = monthlyKpiSheetEntryHtml(november);
  assert.ok(html.includes('November 2026'));
  assert.ok(html.includes('Incomplete — a source is missing'));
  assert.ok(html.includes('Collections report'));
  assert.ok(html.includes('Rs 301000'));
  assert.ok(html.includes('Not recorded — source missing'));
  const nasty = normalizeMonthlyKpiSheet({ ...october, recordedBy: '<b>Owner & Co</b>' });
  const nastyHtml = monthlyKpiSheetEntryHtml(nasty);
  assert.ok(!nastyHtml.includes('<b>Owner'));
  assert.ok(nastyHtml.includes('&lt;b&gt;Owner &amp; Co&lt;/b&gt;'));
  assert.equal(monthlyKpiSheetEntryHtml(null), '<p>No monthly KPI sheet.</p>');
  assert.ok(monthlyKpiSheetAllHtml([november, october]).indexOf('October 2026') < monthlyKpiSheetAllHtml([november, october]).indexOf('November 2026'));
  assert.equal(monthlyKpiSheetAllHtml([]), '<p>No monthly KPI sheets recorded.</p>');
});

test('Plan 318: CSV names the source report on every row and the filename is fixed', () => {
  const csv = monthlyKpiSheetCsv([october, november]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'month,figure,source_report,value,recorded_by,complete');
  assert.equal(lines.length, 11);
  assert.ok(lines.some((line) => line === '2026-10,Collections,Collections report,285000,Owner,yes'));
  assert.ok(lines.some((line) => line === '2026-10,Open faults,Faults report,3,Owner,yes'));
  assert.ok(lines.some((line) => line === '2026-11,Dues outstanding,Dues report,,Owner,no'));
  assert.equal(monthlyKpiSheetCsv([]), 'month,figure,source_report,value,recorded_by,complete');
  assert.equal(monthlyKpiSheetFilename(), 'monthly-kpi-sheets.csv');
});
