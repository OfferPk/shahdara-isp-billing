import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validComplaintCategoryTrendDate,
  normalizeComplaintCategoryTrendRow,
  normalizeComplaintCategoryTrendRows,
  validComplaintCategoryTrendPeriod,
  complaintCategoryTrendInPeriod,
  previousComplaintCategoryTrendPeriod,
  complaintCategoryTrend,
  complaintCategoryTrendFor,
  complaintCategoryTrendText,
  complaintCategoryTrendCategoryText,
  complaintCategoryTrendCategoryHtml,
  complaintCategoryTrendSummaryText,
  complaintCategoryTrendHtml,
  complaintCategoryTrendCsv,
  complaintCategoryTrendFilename,
} from '../complaint-category-trend.js';

// Shared fixture: period 2026-11-01 to 2026-11-07 (7 days),
// previous period 2026-10-25 to 2026-10-31 (7 days).
const FIXTURE = [
  { category: 'Billing', date: '2026-11-01' },
  { category: 'Billing', date: '2026-11-02' },
  { category: 'Billing', date: '2026-11-03' },
  { category: 'Service', date: '2026-11-04' },
  { category: 'Billing', date: '2026-10-26' },
  { category: 'Service', date: '2026-10-27' },
  { category: 'Service', date: '2026-10-28' },
  { category: 'Behaviour', date: '2026-10-30' },
  { category: 'Billing', date: '2026-11-10' },
  { category: 'Service', date: '2026-10-20' },
];
const FROM = '2026-11-01';
const TO = '2026-11-07';

test('half-formed rows are refused', () => {
  assert.equal(normalizeComplaintCategoryTrendRow(null), null);
  assert.equal(normalizeComplaintCategoryTrendRow('Billing'), null);
  assert.equal(normalizeComplaintCategoryTrendRow({ date: '2026-11-01' }), null);
  assert.equal(normalizeComplaintCategoryTrendRow({ category: '  ', date: '2026-11-01' }), null);
  assert.equal(normalizeComplaintCategoryTrendRow({ category: 'Billing' }), null);
  assert.equal(normalizeComplaintCategoryTrendRow({ category: 'Billing', date: 'not a date' }), null);
  assert.equal(normalizeComplaintCategoryTrendRow({ category: 'Billing', date: '2026-02-29' }), null);
  assert.deepEqual(normalizeComplaintCategoryTrendRows('nope'), []);
  assert.deepEqual(normalizeComplaintCategoryTrendRows([
    { category: 'Billing', date: '2026-11-01' },
    { category: '', date: '2026-11-02' },
  ]), [{ category: 'Billing', date: '2026-11-01' }]);
});

test('strict dates use the 12-entry days-in-month table', () => {
  assert.equal(validComplaintCategoryTrendDate('2024-02-29'), true);
  assert.equal(validComplaintCategoryTrendDate('2026-02-29'), false);
  assert.equal(validComplaintCategoryTrendDate('2026-04-31'), false);
  assert.equal(validComplaintCategoryTrendDate('2026-13-01'), false);
  assert.equal(validComplaintCategoryTrendDate('2026-00-10'), false);
  assert.equal(validComplaintCategoryTrendDate('2026-11-00'), false);
  assert.equal(validComplaintCategoryTrendDate('2026-11-32'), false);
  assert.equal(validComplaintCategoryTrendDate('2026/11/01'), false);
  assert.equal(validComplaintCategoryTrendDate(20261101), false);
  assert.equal(validComplaintCategoryTrendDate('2026-11-01'), true);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const input = { category: 'Billing', date: '2026-11-01', billId: 'B-1', amount: 2000, status: 'open' };
  const snapshot = JSON.stringify(input);
  const clean = normalizeComplaintCategoryTrendRow(input);
  assert.deepEqual(clean, { category: 'Billing', date: '2026-11-01' });
  assert.equal(JSON.stringify(input), snapshot);
  const list = [{ category: 'Billing', date: '2026-11-01', extra: 1 }];
  const listSnapshot = JSON.stringify(list);
  normalizeComplaintCategoryTrendRows(list);
  assert.equal(JSON.stringify(list), listSnapshot);
});

test('category counts for a period sum to that period complaints on the same fixture', () => {
  const trend = complaintCategoryTrend(FIXTURE, FROM, TO);
  assert.equal(trend.total, 4);
  assert.equal(trend.prevTotal, 4);
  assert.equal(trend.change, 0);
  const sum = trend.categories.reduce((acc, entry) => acc + entry.count, 0);
  assert.equal(sum, trend.total);
  const prevSum = trend.categories.reduce((acc, entry) => acc + entry.prevCount, 0);
  assert.equal(prevSum, trend.prevTotal);
  const billing = trend.categories.find((entry) => entry.category === 'Billing');
  assert.deepEqual(
    { count: billing.count, prevCount: billing.prevCount, change: billing.change },
    { count: 3, prevCount: 1, change: 2 },
  );
  const service = trend.categories.find((entry) => entry.category === 'Service');
  assert.deepEqual(
    { count: service.count, prevCount: service.prevCount, change: service.change },
    { count: 1, prevCount: 2, change: -1 },
  );
});

test('a category with no complaints shows zero, not a blank', () => {
  const trend = complaintCategoryTrend(FIXTURE, FROM, TO);
  const behaviour = trend.categories.find((entry) => entry.category === 'Behaviour');
  assert.deepEqual(
    { count: behaviour.count, prevCount: behaviour.prevCount, change: behaviour.change },
    { count: 0, prevCount: 1, change: -1 },
  );
  const view = complaintCategoryTrendFor(FIXTURE, 'Behaviour', FROM, TO);
  assert.equal(view.count, 0);
  assert.equal(view.hasComplaints, false);
  assert.equal(view.category, 'Behaviour');
  const neverSeen = complaintCategoryTrendFor(FIXTURE, 'Network', FROM, TO);
  assert.equal(neverSeen.count, 0);
  assert.equal(neverSeen.hasComplaints, false);
  assert.equal(complaintCategoryTrendFor(FIXTURE, '  ', FROM, TO), null);
});

test('the previous period is the same number of days immediately before', () => {
  assert.deepEqual(previousComplaintCategoryTrendPeriod('2026-11-01', '2026-11-07'), { from: '2026-10-25', to: '2026-10-31' });
  assert.deepEqual(previousComplaintCategoryTrendPeriod('2026-01-01', '2026-01-07'), { from: '2025-12-25', to: '2025-12-31' });
  assert.deepEqual(previousComplaintCategoryTrendPeriod('2026-03-01', '2026-03-01'), { from: '2026-02-28', to: '2026-02-28' });
  assert.deepEqual(previousComplaintCategoryTrendPeriod('2024-03-01', '2024-03-01'), { from: '2024-02-29', to: '2024-02-29' });
  assert.equal(previousComplaintCategoryTrendPeriod('2026-11-07', '2026-11-01'), null);
  assert.equal(previousComplaintCategoryTrendPeriod('not a date', '2026-11-07'), null);
});

test('bad periods give no trend', () => {
  assert.equal(complaintCategoryTrend(FIXTURE, '2026-11-07', '2026-11-01'), null);
  assert.equal(complaintCategoryTrend(FIXTURE, '2026-02-29', '2026-03-01'), null);
  assert.equal(complaintCategoryTrend(FIXTURE, '', ''), null);
  assert.equal(validComplaintCategoryTrendPeriod('2026-11-01', '2026-11-07'), true);
  assert.equal(validComplaintCategoryTrendPeriod('2026-11-07', '2026-11-01'), false);
  assert.deepEqual(complaintCategoryTrendInPeriod(FIXTURE, '2026-11-07', '2026-11-01'), []);
});

test('categories fold case-insensitively and keep the first spelling', () => {
  const rows = [
    { category: 'billing', date: '2026-11-01' },
    { category: 'Billing', date: '2026-11-02' },
    { category: 'BILLING', date: '2026-11-03' },
  ];
  const trend = complaintCategoryTrend(rows, FROM, TO);
  assert.equal(trend.categories.length, 1);
  assert.equal(trend.categories[0].category, 'billing');
  assert.equal(trend.categories[0].count, 3);
  const view = complaintCategoryTrendFor(rows, 'BILLING', FROM, TO);
  assert.equal(view.category, 'billing');
  assert.equal(view.count, 3);
});

test('categories sort by count, ties A-Z', () => {
  const rows = [
    { category: 'Zebra', date: '2026-11-01' },
    { category: 'Apple', date: '2026-11-02' },
    { category: 'Mango', date: '2026-11-03' },
    { category: 'Mango', date: '2026-11-04' },
  ];
  const trend = complaintCategoryTrend(rows, FROM, TO);
  assert.deepEqual(trend.categories.map((entry) => entry.category), ['Mango', 'Apple', 'Zebra']);
});

test('trend text, category text, and summary text', () => {
  const trend = complaintCategoryTrend(FIXTURE, FROM, TO);
  const text = complaintCategoryTrendText(trend);
  assert.equal(text.includes('Billing: 3 complaints, up 2 from the previous period'), true);
  assert.equal(text.includes('Behaviour: 0 complaints, down 1 from the previous period'), true);
  const view = complaintCategoryTrendFor(FIXTURE, 'Billing', FROM, TO);
  assert.equal(
    complaintCategoryTrendCategoryText(view),
    'Billing: 3 complaints from 2026-11-01 to 2026-11-07, up 2 from the previous period.',
  );
  assert.equal(
    complaintCategoryTrendCategoryText(complaintCategoryTrendFor(FIXTURE, 'Behaviour', FROM, TO)),
    'No complaints recorded for Behaviour from 2026-11-01 to 2026-11-07.',
  );
  assert.equal(complaintCategoryTrendCategoryText(null), 'Give a category and a real period to see its trend.');
  const summary = complaintCategoryTrendSummaryText(FIXTURE, FROM, TO);
  assert.equal(summary.includes('4 complaints from 2026-11-01 to 2026-11-07 across 3 categories'), true);
  assert.equal(summary.includes('Most complaints: Billing (3)'), true);
  assert.equal(summary.includes('Rising: Billing (+2)'), true);
  assert.equal(complaintCategoryTrendSummaryText(FIXTURE, '2026-11-07', '2026-11-01'), 'Give a real period to see the complaint category trend.');
  assert.equal(complaintCategoryTrendText(null), 'No complaint category trend for this period.');
  const empty = complaintCategoryTrend([], FROM, TO);
  assert.equal(complaintCategoryTrendText(empty), 'No complaints recorded from 2026-11-01 to 2026-11-07.');
});

test('HTML escapes category text', () => {
  const rows = [{ category: '<script>alert(1)</script>', date: '2026-11-01' }];
  const trend = complaintCategoryTrend(rows, FROM, TO);
  const html = complaintCategoryTrendHtml(trend);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), true);
  assert.equal(complaintCategoryTrendHtml(null), '<p>Give a real period to see the complaint category trend.</p>');
  const evilView = complaintCategoryTrendFor(rows, '<script>alert(1)</script>', FROM, TO);
  const evilHtml = complaintCategoryTrendCategoryHtml(evilView);
  assert.equal(evilHtml.includes('<script>'), false);
  assert.equal(evilHtml.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), true);
  assert.equal(complaintCategoryTrendCategoryHtml(null), '<p>Give a category and a real period to see its trend.</p>');
});

test('CSV export and filename', () => {
  const trend = complaintCategoryTrend(FIXTURE, FROM, TO);
  const csv = complaintCategoryTrendCsv(trend);
  assert.equal(csv.startsWith('category,count,previous count,change,period from,period to\n'), true);
  assert.equal(csv.includes('"Billing",3,1,2,2026-11-01,2026-11-07'), true);
  assert.equal(csv.includes('"Behaviour",0,1,-1,2026-11-01,2026-11-07'), true);
  assert.equal(csv.includes('"Billing, with comma"'), false);
  const quoted = complaintCategoryTrendCsv(complaintCategoryTrend(
    [{ category: 'Billing, "late"', date: '2026-11-01' }], FROM, TO,
  ));
  assert.equal(quoted.includes('"Billing, ""late""",1,0,1,2026-11-01,2026-11-07'), true);
  assert.equal(complaintCategoryTrendCsv(null), 'category,count,previous count,change,period from,period to\n');
  assert.equal(complaintCategoryTrendFilename(), 'complaint-category-trends.csv');
});

test('purity fence: no storage, clock, network, or DOM access', () => {
  const source = readFileSync(new URL('../complaint-category-trend.js', import.meta.url), 'utf8');
  assert.equal(source.includes('import '), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: billing disputes and fault root causes are untouched', () => {
  const source = readFileSync(new URL('../complaint-category-trend.js', import.meta.url), 'utf8');
  assert.equal(source.includes('dispute-letters.js'), false, 'module must not reference the billing-dispute letters module');
  assert.equal(source.includes('dispute-cases.js'), false, 'module must not reference the billing-dispute cases module');
  assert.equal(source.includes('root-cause.js'), false, 'module must not reference the fault root-cause module');
  assert.equal(source.includes('complaint-register.js'), false, 'module must not read the complaint register');
  assert.equal(existsSync(new URL('../dispute-letters.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../dispute-cases.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../root-cause.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../complaint-register.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'cctHeading', 'cctSummary', 'cctExportBtn',
    'cctCategory', 'cctPeriodFrom', 'cctPeriodTo', 'cctRows', 'cctShowBtn',
    'cctTrendBody', 'cctAllBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the complaint category trend panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './complaint-category-trend.js'"), true);
  assert.equal(source.includes('renderComplaintCategoryTrend()'), true);
  assert.equal(source.includes('complaintCategoryTrendFor'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
