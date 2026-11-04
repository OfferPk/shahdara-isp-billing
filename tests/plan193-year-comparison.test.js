import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validComparisonYear,
  validComparisonPeriod,
  comparisonPeriodLabel,
  normalizeYearRecord,
  normalizeYearRecordList,
  comparisonYears,
  comparisonPeriods,
  buildYearComparison,
  yearComparisonText,
  yearComparisonHtml,
  yearComparisonCsv,
  yearComparisonFilename,
} from '../year-comparison.js';

const dir = dirname(fileURLToPath(import.meta.url));

const record = (over = {}) => ({
  year: '2024',
  period: '03',
  figures: { Collections: 1200, Expenses: 400, 'New customers': 5 },
  ...over,
});

const view = () => buildYearComparison({
  period: '03',
  records: [
    record(),
    record({ year: '2025', figures: { Collections: 1500, Expenses: 500, 'New customers': 8 } }),
    record({ year: '2026', period: '04', figures: { Collections: 999 } }),
  ],
});

test('valid years and periods: only four-digit years, year or 01-12 months', () => {
  assert.equal(validComparisonYear('2024'), '2024');
  assert.equal(validComparisonYear('24'), '');
  assert.equal(validComparisonYear('2024-03'), '');
  assert.equal(validComparisonPeriod('year'), 'year');
  assert.equal(validComparisonPeriod('Full year'), 'year');
  assert.equal(validComparisonPeriod('full-year'), 'year');
  assert.equal(validComparisonPeriod('03'), '03');
  assert.equal(validComparisonPeriod('13'), '');
  assert.equal(validComparisonPeriod('2024-03'), '');
  assert.equal(validComparisonPeriod(''), '');
  assert.equal(comparisonPeriodLabel('year'), 'Full year');
  assert.equal(comparisonPeriodLabel('03'), 'March');
  assert.equal(comparisonPeriodLabel('13'), '');
});

test('normalizeYearRecord: trims, drops unknown fields, merges figure names case-insensitively', () => {
  const out = normalizeYearRecord({
    year: ' 2024 ', period: '03', bill: 'must not survive',
    figures: { Collections: 1200, collections: 999, '  ': 5, Expenses: '' },
  });
  assert.equal(out.year, '2024');
  assert.equal(out.period, '03');
  assert.equal(out.bill, undefined);
  assert.deepEqual(Object.keys(out.figures).sort(), ['Collections', 'Expenses']);
  assert.equal(out.figures.Collections, 1200);
  assert.equal(out.figures.Expenses, null);
  assert.equal(normalizeYearRecord({ year: '2024', period: '13', figures: {} }), null);
  assert.equal(normalizeYearRecord({ year: '24', period: '03', figures: {} }), null);
  assert.equal(normalizeYearRecord(null), null);
});

test('unusable figure values become missing, never zero', () => {
  const out = normalizeYearRecord(record({
    figures: { A: null, B: '', C: true, D: NaN, E: Infinity, F: 0, G: '  12  ' },
  }));
  assert.deepEqual(out.figures, { A: null, B: null, C: null, D: null, E: null, F: 0, G: '12' });
});

test('normalizeYearRecordList: dedupes year+period keeping the first, sorts by year then period', () => {
  const out = normalizeYearRecordList([
    record({ year: '2025', period: '03' }),
    record({ year: '2024', period: '03' }),
    record({ year: '2024', period: '03', figures: { Collections: 1 } }),
    record({ year: '2024', period: '02' }),
    { year: 'bad', period: '03', figures: {} },
  ]);
  assert.deepEqual(out.map((r) => `${r.year}-${r.period}`), ['2024-02', '2024-03', '2025-03']);
  assert.equal(out[1].figures.Collections, 1200);
});

test('buildYearComparison refuses a bad period or no records', () => {
  assert.equal(buildYearComparison({ period: '13', records: [record()] }), null);
  assert.equal(buildYearComparison({ period: '03', records: [] }), null);
  assert.equal(buildYearComparison({ period: '', records: [record()] }), null);
});

test('the same figure lines up across years for the same period', () => {
  const out = view();
  assert.deepEqual(out.years, ['2024', '2025', '2026']);
  assert.equal(out.period, '03');
  assert.equal(out.periodLabel, 'March');
  const collections = out.rows.find((r) => r.figure === 'Collections');
  assert.deepEqual(collections.values, { 2024: 1200, 2025: 1500, 2026: null });
  assert.deepEqual(out.rows.map((r) => r.figure), ['Collections', 'Expenses', 'New customers']);
});

test('a year with no record for the period is Missing everywhere, never zero', () => {
  const out = view();
  assert.deepEqual(out.missingYears, ['2026']);
  for (const row of out.rows) assert.equal(row.values['2026'], null);
  const text = yearComparisonText(out);
  assert.match(text, /2026: Missing/);
  assert.doesNotMatch(text, /2026: 0/);
});

test('a figure present in only one year shows Missing in the others', () => {
  const out = buildYearComparison({
    period: 'year',
    records: [
      record({ period: 'year', figures: { Collections: 100 } }),
      record({ year: '2025', period: 'year', figures: { Expenses: 50 } }),
    ],
  });
  const collections = out.rows.find((r) => r.figure === 'Collections');
  assert.deepEqual(collections.values, { 2024: 100, 2025: null });
  const expenses = out.rows.find((r) => r.figure === 'Expenses');
  assert.deepEqual(expenses.values, { 2024: null, 2025: 50 });
});

test('figure spellings merge across years onto one row', () => {
  const out = buildYearComparison({
    period: '03',
    records: [
      record({ figures: { Collections: 100 } }),
      record({ year: '2025', figures: { collections: 200 } }),
    ],
  });
  assert.equal(out.rows.length, 1);
  assert.equal(out.rows[0].figure, 'Collections');
  assert.deepEqual(out.rows[0].values, { 2024: 100, 2025: 200 });
});

test('the view adds no total, difference, percentage, or score', () => {
  const out = view();
  assert.equal('total' in out, false);
  assert.equal('difference' in out, false);
  assert.equal('percentage' in out, false);
  assert.equal('score' in out, false);
  const text = yearComparisonText(out);
  const csv = yearComparisonCsv(out);
  for (const line of [...text.split('\n'), ...csv.split('\n')]) {
    assert.doesNotMatch(line, /^Total/i);
  }
});

test('summary text names missing years plainly', () => {
  const text = yearComparisonText(view());
  assert.match(text, /Year comparison — March \(2024, 2025, 2026\)/);
  assert.match(text, /No record for this period in: 2026/);
  assert.match(text, /Collections: 2024: 1200 \| 2025: 1500 \| 2026: Missing/);
  assert.equal(yearComparisonText(null), '');
});

test('HTML escapes values and marks Missing cells', () => {
  const out = buildYearComparison({
    period: '03',
    records: [record({ figures: { 'Note <b>': '<script>' } })],
  });
  const html = yearComparisonHtml(out);
  assert.match(html, /Note &lt;b&gt;/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.equal(yearComparisonHtml(null), '');
});

test('CSV: header years, Missing cells, filename per period', () => {
  const csv = yearComparisonCsv(view());
  const lines = csv.split('\n');
  assert.equal(lines[0], 'Figure,2024,2025,2026');
  assert.match(lines[1], /Collections,1200,1500,Missing/);
  assert.equal(yearComparisonCsv(null), '');
  assert.equal(yearComparisonFilename('03'), 'year-comparison-03.csv');
  assert.equal(yearComparisonFilename('year'), 'year-comparison-year.csv');
  assert.equal(yearComparisonFilename('13'), 'year-comparison.csv');
});

test('comparisonYears and comparisonPeriods list what exists', () => {
  const records = [record(), record({ year: '2025', period: 'year' }), record({ year: '2023', period: '12' })];
  assert.deepEqual(comparisonYears(records), ['2023', '2024', '2025']);
  assert.deepEqual(comparisonPeriods(records), ['year', '03', '12']);
});

test('inputs are never mutated', () => {
  const records = [record(), record({ year: '2025' })];
  const before = JSON.stringify(records);
  buildYearComparison({ period: '03', records });
  assert.equal(JSON.stringify(records), before);
});

test('purity fence: the module reads no storage, clock, or network', () => {
  const source = readFileSync(join(dir, '..', 'year-comparison.js'), 'utf8');
  for (const banned of ['localStorage', 'document.', 'fetch(', 'Date.now', 'XMLHttpRequest']) {
    assert.ok(!source.includes(banned), `module must not use ${banned}`);
  }
});

test('panel element ids are present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['ycPeriod', 'ycBody', 'ycSummary', 'ycExportBtn']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wires the year comparison module', () => {
  const app = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.ok(app.includes("from './year-comparison.js'"));
  assert.ok(app.includes('renderYearComparison()'));
});
