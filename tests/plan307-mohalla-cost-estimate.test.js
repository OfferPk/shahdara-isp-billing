import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validMohallaCostEstimateDay,
  normalizeMohallaCostEstimateItem,
  normalizeMohallaCostEstimateSheet,
  normalizeMohallaCostEstimateList,
  findMohallaCostEstimateSheet,
  recordMohallaCostEstimateSheet,
  removeMohallaCostEstimateSheet,
  mohallaCostEstimateSheetTotal,
  mohallaCostEstimateSorted,
  mohallaCostEstimatesForMohalla,
  mohallaCostEstimateMohallas,
  mohallaCostEstimateTotalEstimated,
  mohallaCostEstimateSummaryText,
  mohallaCostEstimateEntryText,
  mohallaCostEstimateEntryHtml,
  mohallaCostEstimateAllHtml,
  mohallaCostEstimatesForMohallaHtml,
  mohallaCostEstimateCsv,
  mohallaCostEstimateFilename,
} from '../mohalla-cost-estimate.js';

const first = {
  id: 'MCE-1',
  mohalla: 'Mohalla A',
  date: '2026-11-02',
  estimator: 'Owner',
  items: [
    { label: 'Cable', amount: 45000 },
    { label: 'Labour', amount: 12000 },
  ],
};
const second = {
  id: 'MCE-2',
  mohalla: 'Mohalla B',
  date: '2026-11-04',
  estimator: 'Owner',
  items: [{ label: 'Cable', amount: 30000 }],
};
const third = {
  id: 'MCE-3',
  mohalla: 'Mohalla A',
  date: '2026-11-05',
  estimator: 'Saad',
  items: [
    { label: 'Equipment', amount: 80000 },
    { label: 'Cable', amount: 20000 },
    { label: 'Labour', amount: 15000 },
  ],
};
const fourth = {
  id: 'MCE-4',
  mohalla: 'mohalla a',
  date: '2026-11-04',
  estimator: 'Owner',
  items: [{ label: 'Poles', amount: 9000 }],
};

test('strict dates: real calendar days only', () => {
  assert.equal(validMohallaCostEstimateDay('2026-11-05'), true);
  assert.equal(validMohallaCostEstimateDay('2024-02-29'), true);
  assert.equal(validMohallaCostEstimateDay('2026-02-29'), false);
  assert.equal(validMohallaCostEstimateDay('2026-04-31'), false);
  assert.equal(validMohallaCostEstimateDay('2026-13-01'), false);
  assert.equal(validMohallaCostEstimateDay('2026-11-5'), false);
});

test('half-formed sheets are refused', () => {
  assert.equal(normalizeMohallaCostEstimateSheet(null), null);
  assert.equal(normalizeMohallaCostEstimateSheet({ ...first, id: '' }), null);
  assert.equal(normalizeMohallaCostEstimateSheet({ ...first, mohalla: '  ' }), null);
  assert.equal(normalizeMohallaCostEstimateSheet({ ...first, date: '2026-02-30' }), null);
  assert.equal(normalizeMohallaCostEstimateSheet({ ...first, estimator: '' }), null);
  assert.equal(normalizeMohallaCostEstimateSheet({ ...first, items: [] }), null);
  assert.equal(normalizeMohallaCostEstimateSheet({ ...first, items: 'Cable' }), null);
  assert.deepEqual(normalizeMohallaCostEstimateSheet(first), first);
});

test('line items are refused without a label or a whole-rupee amount of at least Rs 1', () => {
  assert.equal(normalizeMohallaCostEstimateItem({ label: '', amount: 100 }), null);
  assert.equal(normalizeMohallaCostEstimateItem({ label: 'Cable', amount: 0 }), null);
  assert.equal(normalizeMohallaCostEstimateItem({ label: 'Cable', amount: -5 }), null);
  assert.equal(normalizeMohallaCostEstimateItem({ label: 'Cable', amount: 12.5 }), null);
  assert.equal(normalizeMohallaCostEstimateItem({ label: 'Cable', amount: 'abc' }), null);
  assert.deepEqual(normalizeMohallaCostEstimateItem({ label: ' Cable ', amount: '45000' }), { label: 'Cable', amount: 45000 });
  assert.equal(normalizeMohallaCostEstimateSheet({ ...first, items: [{ label: 'Cable', amount: 0 }] }), null);
  assert.equal(normalizeMohallaCostEstimateSheet({ ...first, items: [{ amount: 100 }] }), null);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, bill: 'B-1', payment: 5000, customer: 'Someone', extra: true };
  const clean = normalizeMohallaCostEstimateSheet(raw);
  assert.deepEqual(clean, first);
  assert.equal('bill' in clean, false);
  assert.equal('payment' in clean, false);
  assert.equal('customer' in clean, false);
  const before = JSON.stringify(raw);
  normalizeMohallaCostEstimateSheet(raw);
  assert.equal(JSON.stringify(raw), before);
  const withExtraItem = { ...first, items: [{ label: 'Cable', amount: 100, bill: 'B-1' }] };
  assert.deepEqual(normalizeMohallaCostEstimateSheet(withExtraItem).items, [{ label: 'Cable', amount: 100 }]);
});

test('duplicate ids are never rewritten', () => {
  const list = recordMohallaCostEstimateSheet([first], { ...first, mohalla: 'Mohalla Z' });
  assert.deepEqual(list, [first]);
  assert.deepEqual(recordMohallaCostEstimateSheet([first], second), [first, second]);
  assert.deepEqual(recordMohallaCostEstimateSheet([], 'nope'), []);
});

test('find and remove', () => {
  assert.deepEqual(findMohallaCostEstimateSheet([first, second], 'MCE-2'), second);
  assert.equal(findMohallaCostEstimateSheet([first], 'MCE-9'), null);
  assert.equal(findMohallaCostEstimateSheet([first], ''), null);
  assert.deepEqual(removeMohallaCostEstimateSheet([first, second], 'MCE-1'), [second]);
  assert.deepEqual(removeMohallaCostEstimateSheet([first], 'MCE-9'), [first]);
});

test('sheet total sums exactly to its line items', () => {
  assert.equal(mohallaCostEstimateSheetTotal(first), 57000);
  assert.equal(mohallaCostEstimateSheetTotal(second), 30000);
  assert.equal(mohallaCostEstimateSheetTotal(third), 115000);
  assert.equal(mohallaCostEstimateSheetTotal(null), null);
  assert.equal(mohallaCostEstimateTotalEstimated([first, second, third]), 202000);
  assert.equal(mohallaCostEstimateTotalEstimated([]), 0);
});

test('sorting is by date, then mohalla, then id', () => {
  assert.deepEqual(
    mohallaCostEstimateSorted([third, first, fourth, second]).map((sheet) => sheet.id),
    ['MCE-1', 'MCE-4', 'MCE-2', 'MCE-3'],
  );
});

test('sheets for one mohalla, in date order, and mohalla list keeps the first spelling', () => {
  assert.deepEqual(mohallaCostEstimatesForMohalla([third, first, fourth, second], 'MOHALLA A').map((sheet) => sheet.id), ['MCE-1', 'MCE-4', 'MCE-3']);
  assert.deepEqual(mohallaCostEstimatesForMohalla([first], 'Nope'), []);
  assert.deepEqual(mohallaCostEstimatesForMohalla([first], ''), []);
  assert.deepEqual(mohallaCostEstimateMohallas([second, first, fourth]), ['Mohalla A', 'Mohalla B']);
});

test('summary text names the count, the total estimated, and the latest sheet', () => {
  assert.equal(mohallaCostEstimateSummaryText([]), 'No mohalla cost estimate sheets recorded.');
  assert.equal(
    mohallaCostEstimateSummaryText([third, first, second]),
    '3 estimate sheets, Rs 202000 estimated in total. Latest: Mohalla A on 2026-11-05, Rs 115000.',
  );
  assert.equal(
    mohallaCostEstimateSummaryText([first]),
    '1 estimate sheet, Rs 57000 estimated in total. Latest: Mohalla A on 2026-11-02, Rs 57000.',
  );
});

test('entry text names the sheet, its items, and its total', () => {
  assert.equal(
    mohallaCostEstimateEntryText(first),
    '2026-11-02 — Mohalla A estimate by Owner: Cable Rs 45000; Labour Rs 12000 — total Rs 57000.',
  );
  assert.equal(mohallaCostEstimateEntryText(null), '');
});

test('HTML escapes user-entered text', () => {
  const tricky = { ...first, mohalla: '<b>Mohalla</b>', estimator: 'O"wner', items: [{ label: '<script>', amount: 100 }] };
  const html = mohallaCostEstimateEntryHtml(tricky);
  assert.equal(html.includes('<b>'), false);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;b&gt;Mohalla&lt;/b&gt;'), true);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(mohallaCostEstimateEntryHtml(null), '');
  assert.equal(
    mohallaCostEstimateAllHtml([second, first]),
    '<ul><li>2026-11-02 — Mohalla A estimate by Owner: Cable Rs 45000; Labour Rs 12000 — total Rs 57000.</li><li>2026-11-04 — Mohalla B estimate by Owner: Cable Rs 30000 — total Rs 30000.</li></ul>',
  );
  assert.equal(mohallaCostEstimateAllHtml([]), '<p>No mohalla cost estimate sheets recorded.</p>');
  assert.equal(
    mohallaCostEstimatesForMohallaHtml([third, first, second], 'mohalla a'),
    '<ul><li>2026-11-02 — Mohalla A estimate by Owner: Cable Rs 45000; Labour Rs 12000 — total Rs 57000.</li><li>2026-11-05 — Mohalla A estimate by Saad: Equipment Rs 80000; Cable Rs 20000; Labour Rs 15000 — total Rs 115000.</li></ul>',
  );
  assert.equal(mohallaCostEstimatesForMohallaHtml([first], 'Nope'), '<p>No cost estimate sheets for that mohalla.</p>');
});

test('CSV export and filename', () => {
  const lines = mohallaCostEstimateCsv([third, first, second]).split('\n');
  assert.equal(lines[0], 'id,date,mohalla,estimator,items,total');
  assert.equal(lines[1], 'MCE-1,2026-11-02,Mohalla A,Owner,Cable:45000; Labour:12000,57000');
  assert.equal(lines[2], 'MCE-2,2026-11-04,Mohalla B,Owner,Cable:30000,30000');
  assert.equal(lines[3], 'MCE-3,2026-11-05,Mohalla A,Saad,Equipment:80000; Cable:20000; Labour:15000,115000');
  assert.equal(lines.length, 4);
  assert.equal(mohallaCostEstimateCsv([]), 'id,date,mohalla,estimator,items,total');
  assert.equal(mohallaCostEstimateFilename(), 'mohalla-cost-estimates.csv');
});

test('list normalisation drops half-formed rows and keeps the first of a duplicate id', () => {
  assert.deepEqual(normalizeMohallaCostEstimateList(null), []);
  assert.deepEqual(normalizeMohallaCostEstimateList('nope'), []);
  assert.deepEqual(normalizeMohallaCostEstimateList([first, null, { ...second, id: '' }, first]), [first]);
  assert.deepEqual(normalizeMohallaCostEstimateList([second, first, second]), [second, first]);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../mohalla-cost-estimate.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: launch checklist, growth milestone tracker and replacement reserve tracker are untouched', () => {
  const source = readFileSync(new URL('../mohalla-cost-estimate.js', import.meta.url), 'utf8');
  assert.equal(source.includes('launch-checklist.js'), false, 'module must not reference the new-mohalla launch checklist file');
  assert.equal(source.includes('growth-milestone.js'), false, 'module must not reference the growth milestone tracker file');
  assert.equal(source.includes('equipment-ageing.js'), false, 'module must not reference the replacement reserve tracker file');
  assert.equal(existsSync(new URL('../launch-checklist.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../growth-milestone.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../equipment-ageing.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'mceHeading', 'mceSummary', 'mceExportBtn', 'mceMohalla', 'mceDate',
    'mceEstimator', 'mceItems', 'mceRecordBtn', 'mceRemoveId',
    'mceRemoveBtn', 'mceMohallaSelect', 'mceMohallaBody', 'mceBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the mohalla cost estimate panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './mohalla-cost-estimate.js'"), true);
  assert.equal(source.includes('renderMohallaCostEstimate();'), true);
  assert.equal(source.includes('shahdara_mohalla_cost_estimates_v1'), true);
  assert.equal(source.includes('loadMohallaCostEstimates'), true);
  assert.equal(source.includes('saveMohallaCostEstimates'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
