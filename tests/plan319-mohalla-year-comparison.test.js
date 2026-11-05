import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOHALLA_YEAR_FIGURES,
  validMohallaYearComparisonYear,
  normalizeMohallaYearFigure,
  mohallaYearFigureDef,
  normalizeMohallaYearFigureRecord,
  normalizeMohallaYearFigureRecordList,
  findMohallaYearFigureRecord,
  recordMohallaYearFigure,
  removeMohallaYearFigure,
  mohallaYearFigureMohallas,
  mohallaYearFigureYears,
  normalizeShopWideYearFigure,
  normalizeShopWideYearFigureList,
  recordShopWideYearFigure,
  removeShopWideYearFigure,
  buildMohallaYearComparison,
  mohallaYearComparisonYears,
  mohallaYearComparisonMohallas,
  mohallaYearComparisonMissing,
  mohallaYearComparisonMismatches,
  mohallaYearComparisonChange,
  mohallaYearFigureText,
  mohallaYearComparisonSummaryText,
  mohallaYearComparisonForMohallaHtml,
  mohallaYearComparisonAllHtml,
  mohallaYearComparisonCsv,
  mohallaYearComparisonFilename,
} from '../mohalla-year-comparison.js';

const village2024 = {
  id: 'MY-2024-VILLAGE',
  mohalla: 'Shahdara Village',
  year: 2024,
  figures: { customers: 50, collections: 150000, dues: 8000 },
};

const village2025 = {
  id: 'MY-2025-VILLAGE',
  mohalla: 'Shahdara Village',
  year: 2025,
  figures: { customers: 55, collections: 170000, dues: 6000 },
};

const second2024 = {
  id: 'MY-2024-SECOND',
  mohalla: 'Mohalla B',
  year: 2024,
  figures: { customers: 40, collections: 130000, dues: 7000 },
};

const second2025 = {
  id: 'MY-2025-SECOND',
  mohalla: 'Mohalla B',
  year: 2025,
  figures: { customers: 45, collections: 140000, dues: 6000 },
};

const shopWide2024 = { year: 2024, figures: { customers: 90, collections: 280000, dues: 15000 } };
const shopWide2025 = { year: 2025, figures: { customers: 100, collections: 310000, dues: 12000 } };

const perMohalla = [village2024, village2025, second2024, second2025];
const shopWide = [shopWide2024, shopWide2025];

test('year validation accepts whole years 1900-2100 as numbers or digit strings', () => {
  assert.equal(validMohallaYearComparisonYear(2025), 2025);
  assert.equal(validMohallaYearComparisonYear('2025'), 2025);
  assert.equal(validMohallaYearComparisonYear(1899), null);
  assert.equal(validMohallaYearComparisonYear(2101), null);
  assert.equal(validMohallaYearComparisonYear('2025.5'), null);
  assert.equal(validMohallaYearComparisonYear('Rs 2025'), null);
  assert.equal(validMohallaYearComparisonYear(null), null);
});

test('figure validation accepts whole numbers and digit strings, refuses money text, negatives and fractions', () => {
  assert.equal(normalizeMohallaYearFigure(0), 0);
  assert.equal(normalizeMohallaYearFigure('140000'), 140000);
  assert.equal(normalizeMohallaYearFigure(null), null);
  assert.equal(normalizeMohallaYearFigure(''), null);
  assert.equal(normalizeMohallaYearFigure('Rs 1800'), undefined);
  assert.equal(normalizeMohallaYearFigure(-5), undefined);
  assert.equal(normalizeMohallaYearFigure(12.5), undefined);
  assert.equal(normalizeMohallaYearFigure('12.5'), undefined);
});

test('figure definitions name the three yearly figures in view order', () => {
  assert.deepEqual(MOHALLA_YEAR_FIGURES.map((figure) => figure.key), ['customers', 'collections', 'dues']);
  assert.equal(mohallaYearFigureDef('collections').unit, 'PKR');
  assert.equal(mohallaYearFigureDef('customers').unit, 'customers');
  assert.equal(mohallaYearFigureDef('faults'), null);
});

test('a valid per-mohalla record normalises with digit-string year and figures, and unknown fields are dropped', () => {
  const clean = normalizeMohallaYearFigureRecord({
    id: 'MY-2025-X', mohalla: '  Mohalla C  ', year: '2025',
    figures: { customers: '10', collections: 50000, dues: null, billId: 'B-1', paymentId: 'P-1' },
  });
  assert.deepEqual(clean, {
    id: 'MY-2025-X', mohalla: 'Mohalla C', year: 2025,
    figures: { customers: 10, collections: 50000, dues: null },
  });
});

test('a per-mohalla record is refused without id, mohalla, valid year, or with every figure missing or any figure invalid', () => {
  assert.equal(normalizeMohallaYearFigureRecord({ ...village2024, id: '' }), null);
  assert.equal(normalizeMohallaYearFigureRecord({ ...village2024, mohalla: '  ' }), null);
  assert.equal(normalizeMohallaYearFigureRecord({ ...village2024, year: 1899 }), null);
  assert.equal(normalizeMohallaYearFigureRecord({ ...village2024, figures: { customers: null, collections: null, dues: null } }), null);
  assert.equal(normalizeMohallaYearFigureRecord({ ...village2024, figures: { customers: 50, collections: 'Rs 150000', dues: 8000 } }), null);
  assert.equal(normalizeMohallaYearFigureRecord({ ...village2024, figures: { customers: 50, collections: -1, dues: 8000 } }), null);
  assert.equal(normalizeMohallaYearFigureRecord(null), null);
});

test('recording refuses a second record for the same mohalla and year and a duplicate id, keeping the first record', () => {
  const one = recordMohallaYearFigure([], village2024);
  assert.equal(one.length, 1);
  assert.deepEqual(recordMohallaYearFigure(one, { ...village2024, id: 'MY-2024-OTHER', figures: { customers: 99, collections: 1, dues: 1 } }), one);
  assert.deepEqual(recordMohallaYearFigure(one, { ...second2024, id: 'MY-2024-VILLAGE' }), one);
  assert.deepEqual(recordMohallaYearFigure(one, { ...village2024, figures: { customers: 'bad', collections: 1, dues: 1 } }), one);
});

test('removing a record by id and finding a record by mohalla and year touch only that record', () => {
  const list = normalizeMohallaYearFigureRecordList(perMohalla);
  assert.equal(findMohallaYearFigureRecord(list, 'Mohalla B', 2025).id, 'MY-2025-SECOND');
  assert.equal(findMohallaYearFigureRecord(list, 'Mohalla B', 2026), null);
  assert.equal(findMohallaYearFigureRecord(list, 'Missing Mohalla', 2025), null);
  const kept = removeMohallaYearFigure(list, 'MY-2024-VILLAGE');
  assert.equal(kept.length, 3);
  assert.equal(findMohallaYearFigureRecord(kept, 'Shahdara Village', 2024), null);
  assert.equal(findMohallaYearFigureRecord(kept, 'Shahdara Village', 2025).id, 'MY-2025-VILLAGE');
});

test('mohalla names and years list in first-seen and earliest-first order', () => {
  assert.deepEqual(mohallaYearFigureMohallas(perMohalla), ['Shahdara Village', 'Mohalla B']);
  assert.deepEqual(mohallaYearFigureYears(perMohalla), [2024, 2025]);
  assert.deepEqual(mohallaYearFigureMohallas([]), []);
  assert.deepEqual(mohallaYearFigureYears([]), []);
});

test('a shop-wide yearly figure records once per year and is removed by year only', () => {
  const one = recordShopWideYearFigure([], shopWide2024);
  assert.equal(one.length, 1);
  assert.deepEqual(recordShopWideYearFigure(one, { year: 2024, figures: { customers: 1, collections: 1, dues: 1 } }), one);
  assert.equal(normalizeShopWideYearFigure({ year: 2024, figures: { customers: null, collections: null, dues: null } }), null);
  assert.equal(normalizeShopWideYearFigure({ year: 2024, figures: { customers: 90, collections: 'Rs 280000', dues: 15000 } }), null);
  const two = recordShopWideYearFigure(one, shopWide2025);
  assert.equal(two.length, 2);
  const kept = removeShopWideYearFigure(two, '2024');
  assert.deepEqual(kept.map((figure) => figure.year), [2025]);
});

test('the view composes sorted years and mohallas with the copied per-mohalla figures', () => {
  const view = buildMohallaYearComparison(perMohalla, shopWide);
  assert.deepEqual(mohallaYearComparisonYears(view), [2024, 2025]);
  assert.deepEqual(mohallaYearComparisonMohallas(view), ['Shahdara Village', 'Mohalla B']);
  assert.deepEqual(view.perMohalla['Shahdara Village'][2025], { customers: 55, collections: 170000, dues: 6000 });
  assert.deepEqual(view.shopWide[2024], { customers: 90, collections: 280000, dues: 15000 });
  assert.deepEqual(mohallaYearComparisonMissing(view), []);
});

test('per-mohalla figures sum exactly to the shop-wide yearly figures on the same fixture', () => {
  const view = buildMohallaYearComparison(perMohalla, shopWide);
  assert.deepEqual(view.totals[2024], { customers: 90, collections: 280000, dues: 15000 });
  assert.deepEqual(view.totals[2025], { customers: 100, collections: 310000, dues: 12000 });
  assert.deepEqual(view.reconciles, { 2024: true, 2025: true });
  assert.deepEqual(mohallaYearComparisonMismatches(view), []);
});

test('a year where the mohalla figures do not sum to the shop-wide figure is named with both numbers', () => {
  const changed = [{ ...second2025, figures: { customers: 45, collections: 139000, dues: 6000 } }];
  const view = buildMohallaYearComparison([village2024, village2025, second2024, ...changed], shopWide);
  assert.equal(view.reconciles[2025], false);
  assert.equal(view.reconciles[2024], true);
  const mismatches = mohallaYearComparisonMismatches(view);
  assert.equal(mismatches.length, 1);
  assert.deepEqual(mismatches[0], { year: 2025, figure: 'collections', shopWide: 310000, summed: 309000 });
});

test('a mohalla with no figure for a year says so plainly and is listed among the missing pairs', () => {
  const view = buildMohallaYearComparison([village2024, village2025, second2024], shopWide);
  assert.deepEqual(mohallaYearComparisonMissing(view), [{ mohalla: 'Mohalla B', year: 2025 }]);
  assert.equal(view.reconciles[2025], false);
  const html = mohallaYearComparisonForMohallaHtml(view, 'Mohalla B');
  assert.ok(html.includes('No figure for this year'));
  assert.ok(mohallaYearComparisonSummaryText(view).includes('Mohalla B 2025'));
});

test('a year with no shop-wide figure cannot reconcile and is listed with a plain note', () => {
  const view = buildMohallaYearComparison(perMohalla, [shopWide2024]);
  assert.equal(view.reconciles[2025], false);
  const mismatches = mohallaYearComparisonMismatches(view);
  assert.equal(mismatches.length, 1);
  assert.equal(mismatches[0].year, 2025);
  assert.equal(mismatches[0].note, 'No shop-wide figure for this year');
});

test('composing the view never mutates the caller-supplied figures', () => {
  const beforePerMohalla = JSON.stringify(perMohalla);
  const beforeShopWide = JSON.stringify(shopWide);
  buildMohallaYearComparison(perMohalla, shopWide);
  assert.equal(JSON.stringify(perMohalla), beforePerMohalla);
  assert.equal(JSON.stringify(shopWide), beforeShopWide);
});

test('year-on-year change is the whole-number difference, and null when either year has no figure', () => {
  const view = buildMohallaYearComparison(perMohalla, shopWide);
  assert.deepEqual(mohallaYearComparisonChange(view, 'Shahdara Village', 'customers', 2025), { from: 50, to: 55, change: 5 });
  assert.deepEqual(mohallaYearComparisonChange(view, 'Shahdara Village', 'collections', 2025), { from: 150000, to: 170000, change: 20000 });
  assert.deepEqual(mohallaYearComparisonChange(view, 'Shahdara Village', 'dues', 2025), { from: 8000, to: 6000, change: -2000 });
  assert.equal(mohallaYearComparisonChange(view, 'Shahdara Village', 'customers', 2024), null);
  assert.equal(mohallaYearComparisonChange(view, 'Missing Mohalla', 'customers', 2025), null);
  assert.equal(mohallaYearComparisonChange(view, 'Shahdara Village', 'faults', 2025), null);
  const partial = buildMohallaYearComparison([village2024, village2025, second2024], shopWide);
  assert.equal(mohallaYearComparisonChange(partial, 'Mohalla B', 'customers', 2025), null);
});

test('figure text shows rupees for money, counts for customers, and the plain no-figure line when missing', () => {
  assert.equal(mohallaYearFigureText('collections', 150000), 'Rs 150000');
  assert.equal(mohallaYearFigureText('customers', 55), '55 customers');
  assert.equal(mohallaYearFigureText('dues', null), 'No figure for this year');
  assert.equal(mohallaYearFigureText('faults', 3), 'No figure for this year');
});

test('summary text states the reconciliation and names missing pairs, and the empty view says so plainly', () => {
  const view = buildMohallaYearComparison(perMohalla, shopWide);
  const text = mohallaYearComparisonSummaryText(view);
  assert.ok(text.includes('2 mohallas compared across 2 years (2024, 2025)'));
  assert.ok(text.includes('Every year reconciles'));
  assert.equal(mohallaYearComparisonSummaryText(buildMohallaYearComparison([], [])), 'No per-mohalla year comparison: no yearly figures recorded.');
});

test('one mohalla renders as a table with years, figures, and the change from the previous year', () => {
  const view = buildMohallaYearComparison(perMohalla, shopWide);
  const html = mohallaYearComparisonForMohallaHtml(view, 'Shahdara Village');
  assert.ok(html.includes('Shahdara Village'));
  assert.ok(html.includes('2024'));
  assert.ok(html.includes('Rs 170000'));
  assert.ok(html.includes('(+5)'));
  assert.ok(html.includes('(+20000)'));
  assert.equal(mohallaYearComparisonForMohallaHtml(view, 'Missing Mohalla'), '<p>No figure for this mohalla.</p>');
  assert.ok(html.includes('&lt;') === false);
});

test('the whole view renders a reconciliation line per year and names a mismatch in plain words', () => {
  const view = buildMohallaYearComparison(perMohalla, shopWide);
  const html = mohallaYearComparisonAllHtml(view);
  assert.ok(html.includes('2024: mohalla figures sum exactly to the shop-wide yearly figure'));
  assert.ok(html.includes('2025: mohalla figures sum exactly to the shop-wide yearly figure'));
  assert.ok(html.includes('Shahdara Village'));
  assert.ok(html.includes('Mohalla B'));
  const changed = buildMohallaYearComparison(
    [village2024, village2025, second2024, { ...second2025, figures: { customers: 45, collections: 139000, dues: 6000 } }],
    shopWide,
  );
  const changedHtml = mohallaYearComparisonAllHtml(changed);
  assert.ok(changedHtml.includes('2025: mohalla figures do not sum to the shop-wide yearly figure'));
  assert.ok(changedHtml.includes('shop-wide Rs 310000'));
  assert.ok(changedHtml.includes('mohalla figures sum to Rs 309000'));
  assert.equal(mohallaYearComparisonAllHtml(buildMohallaYearComparison([], [])), '<p>No per-mohalla yearly figures recorded.</p>');
});

test('the comparison exports as CSV with one row per mohalla per year per figure, and a fixed filename', () => {
  const view = buildMohallaYearComparison(perMohalla, shopWide);
  const csv = mohallaYearComparisonCsv(view);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'mohalla,year,figure,value,shop_wide_value,mohalla_sum,reconciles');
  assert.equal(lines.length, 1 + 2 * 2 * 3);
  assert.ok(lines.includes('Shahdara Village,2025,Collections,170000,310000,310000,yes'));
  assert.ok(lines.includes('Mohalla B,2024,Dues outstanding,7000,15000,15000,yes'));
  assert.equal(mohallaYearComparisonFilename(), 'mohalla-year-comparison.csv');
});
