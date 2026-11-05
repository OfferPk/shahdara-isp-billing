import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validCollectorMonthlyTargetMonth,
  normalizeCollectorMonthlyTarget,
  normalizeCollectorMonthlyTargetList,
  findCollectorMonthlyTarget,
  recordCollectorMonthlyTarget,
  removeCollectorMonthlyTarget,
  collectorMonthlyTargetsSorted,
  collectorMonthlyTargetsForCollector,
  collectorMonthlyTargetsForMonth,
  collectorMonthlyTargetCollectors,
  collectorMonthlyTargetComparisonText,
  collectorMonthlyTargetSummaryText,
  collectorMonthlyTargetEntryText,
  collectorMonthlyTargetEntryHtml,
  collectorMonthlyTargetAllHtml,
  collectorMonthlyTargetsForCollectorHtml,
  collectorMonthlyTargetsForMonthHtml,
  collectorMonthlyTargetCsv,
  collectorMonthlyTargetFilename,
} from '../collector-monthly-target.js';

const first = {
  id: 'CMT-1',
  collector: 'Saad',
  month: '2026-11',
  target: 'Collect Rs 100,000 across 11 mohallas',
  targetAmount: 100000,
  achievedAmount: 95000,
};
const second = {
  id: 'CMT-2',
  collector: 'Saad',
  month: '2026-10',
  target: 'Collect Rs 90,000 across 11 mohallas',
  targetAmount: 90000,
  achievedAmount: 90000,
};
const third = {
  id: 'CMT-3',
  collector: 'Bilal',
  month: '2026-11',
  target: 'Collect Rs 50,000 across 5 mohallas',
  targetAmount: 50000,
  achievedAmount: null,
};
const fixture = [first, second, third];

test('half-formed records are refused', () => {
  assert.equal(normalizeCollectorMonthlyTarget(null), null);
  assert.equal(normalizeCollectorMonthlyTarget({}), null);
  assert.equal(normalizeCollectorMonthlyTarget({ ...first, id: '' }), null);
  assert.equal(normalizeCollectorMonthlyTarget({ ...first, collector: '' }), null);
  assert.equal(normalizeCollectorMonthlyTarget({ ...first, month: '' }), null);
  assert.equal(normalizeCollectorMonthlyTarget({ ...first, target: '' }), null);
  assert.equal(normalizeCollectorMonthlyTarget({ ...first, targetAmount: 0 }), null);
  assert.equal(normalizeCollectorMonthlyTarget({ ...first, targetAmount: -5 }), null);
  assert.equal(normalizeCollectorMonthlyTarget({ ...first, targetAmount: 100.5 }), null);
  assert.equal(normalizeCollectorMonthlyTarget({ ...first, targetAmount: 'lots' }), null);
  assert.equal(normalizeCollectorMonthlyTarget({ ...first, achievedAmount: -1 }), null);
  assert.equal(normalizeCollectorMonthlyTarget({ ...first, achievedAmount: 10.5 }), null);
  assert.deepEqual(normalizeCollectorMonthlyTarget({ ...first, targetAmount: '100000' }), { ...first, targetAmount: 100000 });
  assert.deepEqual(normalizeCollectorMonthlyTarget({ ...first, achievedAmount: '' }), { ...first, achievedAmount: null });
});

test('strict months only', () => {
  assert.equal(validCollectorMonthlyTargetMonth('2026-11'), true);
  assert.equal(validCollectorMonthlyTargetMonth('2026-01'), true);
  assert.equal(validCollectorMonthlyTargetMonth('2026-12'), true);
  assert.equal(validCollectorMonthlyTargetMonth('2026-00'), false);
  assert.equal(validCollectorMonthlyTargetMonth('2026-13'), false);
  assert.equal(validCollectorMonthlyTargetMonth('2026-1'), false);
  assert.equal(validCollectorMonthlyTargetMonth('2026-11-01'), false);
  assert.equal(validCollectorMonthlyTargetMonth('11-2026'), false);
  assert.equal(validCollectorMonthlyTargetMonth(''), false);
  assert.equal(validCollectorMonthlyTargetMonth(null), false);
  assert.equal(normalizeCollectorMonthlyTarget({ ...first, month: '2026-13' }), null);
});

test('target and achieved sit side by side in plain words', () => {
  assert.equal(collectorMonthlyTargetComparisonText(first), 'target Rs 100000, achieved Rs 95000, short by Rs 5000');
  assert.equal(collectorMonthlyTargetComparisonText(second), 'target Rs 90000 met, achieved Rs 90000');
  assert.equal(collectorMonthlyTargetComparisonText(third), 'target Rs 50000, achieved not yet entered');
  assert.equal(collectorMonthlyTargetComparisonText({ ...first, achievedAmount: 120000 }), 'target Rs 100000, achieved Rs 120000, over by Rs 20000');
  assert.equal(collectorMonthlyTargetComparisonText(null), '');
  assert.equal(
    collectorMonthlyTargetEntryText(first),
    'Saad — 2026-11: Collect Rs 100,000 across 11 mohallas (target Rs 100000, achieved Rs 95000, short by Rs 5000).',
  );
  assert.equal(collectorMonthlyTargetEntryText(null), 'No monthly collector target recorded.');
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, billAmount: 5000, paymentId: 'P-1', customer: 'Ali', extra: 'x' };
  const clean = normalizeCollectorMonthlyTarget(raw);
  assert.equal(clean.billAmount, undefined);
  assert.equal(clean.paymentId, undefined);
  assert.equal(clean.customer, undefined);
  assert.equal(clean.extra, undefined);
  assert.deepEqual(raw, { ...first, billAmount: 5000, paymentId: 'P-1', customer: 'Ali', extra: 'x' });
  const list = [{ ...first, billAmount: 1 }];
  const out = normalizeCollectorMonthlyTargetList(list);
  assert.equal(out[0].billAmount, undefined);
  assert.deepEqual(list, [{ ...first, billAmount: 1 }]);
});

test('duplicate ids are never rewritten', () => {
  const next = recordCollectorMonthlyTarget(fixture, { ...second, id: 'CMT-1', month: '2026-09', targetAmount: 1 });
  assert.deepEqual(next, normalizeCollectorMonthlyTargetList(fixture));
  assert.equal(findCollectorMonthlyTarget(fixture, 'CMT-1').targetAmount, 100000);
});

test('one record per collector per month', () => {
  const again = { id: 'CMT-9', collector: 'saad', month: '2026-11', target: 'Another target', targetAmount: 5000, achievedAmount: null };
  assert.deepEqual(recordCollectorMonthlyTarget(fixture, again), normalizeCollectorMonthlyTargetList(fixture));
  const otherMonth = { ...again, id: 'CMT-10', month: '2026-12' };
  assert.equal(recordCollectorMonthlyTarget(fixture, otherMonth).length, 4);
  const otherCollector = { ...again, id: 'CMT-11', collector: 'Bilal', month: '2026-10' };
  assert.equal(recordCollectorMonthlyTarget(fixture, otherCollector).length, 4);
});

test('find and remove', () => {
  assert.deepEqual(findCollectorMonthlyTarget(fixture, 'CMT-2'), second);
  assert.equal(findCollectorMonthlyTarget(fixture, 'CMT-9'), null);
  assert.equal(findCollectorMonthlyTarget(fixture, ''), null);
  assert.equal(removeCollectorMonthlyTarget(fixture, 'CMT-2').length, 2);
  assert.equal(removeCollectorMonthlyTarget(fixture, 'CMT-9').length, 3);
});

test('sorting by month, then collector A-Z, then id', () => {
  const sorted = collectorMonthlyTargetsSorted([third, first, second]);
  assert.deepEqual(sorted.map((r) => r.id), ['CMT-2', 'CMT-3', 'CMT-1']);
});

test('targets for one collector, in month order, first spelling kept', () => {
  assert.deepEqual(collectorMonthlyTargetsForCollector(fixture, 'saad').map((r) => r.id), ['CMT-2', 'CMT-1']);
  assert.deepEqual(collectorMonthlyTargetsForCollector(fixture, 'Bilal').map((r) => r.id), ['CMT-3']);
  assert.deepEqual(collectorMonthlyTargetsForCollector(fixture, 'Nobody'), []);
  assert.deepEqual(collectorMonthlyTargetsForCollector(fixture, ''), []);
  const mixed = [{ ...first, id: 'CMT-4', month: '2026-09', collector: 'saad' }];
  assert.deepEqual(collectorMonthlyTargetCollectors([...fixture, ...mixed]), ['Bilal', 'Saad']);
});

test('targets for one month, collector A-Z', () => {
  assert.deepEqual(collectorMonthlyTargetsForMonth(fixture, '2026-11').map((r) => r.id), ['CMT-3', 'CMT-1']);
  assert.deepEqual(collectorMonthlyTargetsForMonth(fixture, '2026-10').map((r) => r.id), ['CMT-2']);
  assert.deepEqual(collectorMonthlyTargetsForMonth(fixture, '2026-13'), []);
  assert.deepEqual(collectorMonthlyTargetsForMonth(fixture, ''), []);
});

test('summary text names the latest record', () => {
  assert.equal(collectorMonthlyTargetSummaryText([]), 'No monthly collector targets recorded.');
  assert.equal(
    collectorMonthlyTargetSummaryText(fixture),
    '3 monthly collector targets recorded. Latest: Saad, 2026-11, target Rs 100000, achieved Rs 95000, short by Rs 5000.',
  );
  assert.equal(
    collectorMonthlyTargetSummaryText([first]),
    '1 monthly collector target recorded. Latest: Saad, 2026-11, target Rs 100000, achieved Rs 95000, short by Rs 5000.',
  );
});

test('HTML is escaped', () => {
  const nasty = { ...first, collector: '<b>Saad</b>', target: 'Collect & win "big"' };
  const html = collectorMonthlyTargetEntryHtml(nasty);
  assert.equal(html.includes('<b>'), false);
  assert.equal(html.includes('&lt;b&gt;Saad&lt;/b&gt;'), true);
  assert.equal(html.includes('Collect &amp; win &quot;big&quot;'), true);
  assert.equal(collectorMonthlyTargetEntryHtml(null), '<p>No monthly collector target recorded.</p>');
  assert.equal(collectorMonthlyTargetAllHtml([]), '<p>No monthly collector targets recorded.</p>');
  assert.equal(collectorMonthlyTargetsForCollectorHtml([], 'Saad'), '<p>No monthly collector targets recorded for this collector.</p>');
  assert.equal(collectorMonthlyTargetsForMonthHtml([], '2026-11'), '<p>No monthly collector targets recorded for this month.</p>');
  assert.equal(collectorMonthlyTargetAllHtml(fixture).includes('<li>'), true);
});

test('CSV export and filename', () => {
  const csv = collectorMonthlyTargetCsv(fixture);
  assert.equal(csv.split('\n')[0], '"id","collector","month","target","target amount","achieved amount"');
  assert.equal(csv.includes('"CMT-2","Saad","2026-10","Collect Rs 90,000 across 11 mohallas","90000","90000"'), true);
  assert.equal(csv.includes('"CMT-3","Bilal","2026-11","Collect Rs 50,000 across 5 mohallas","50000",""'), true);
  assert.equal(csv.split('\n').length, 4);
  assert.equal(csv.split('\n')[1].startsWith('"CMT-2"'), true);
  assert.equal(collectorMonthlyTargetFilename(), 'collector-monthly-targets.csv');
});

test('list normalisation drops half-formed rows and keeps the first of each id and collector-month', () => {
  assert.deepEqual(normalizeCollectorMonthlyTargetList(null), []);
  assert.deepEqual(normalizeCollectorMonthlyTargetList('nope'), []);
  assert.deepEqual(normalizeCollectorMonthlyTargetList([first, null, { ...first, id: '' }]).length, 1);
  assert.deepEqual(normalizeCollectorMonthlyTargetList([first, { ...first, id: 'CMT-9' }]).length, 1);
  assert.deepEqual(normalizeCollectorMonthlyTargetList([first, { ...second, id: 'CMT-1' }]).length, 1);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../collector-monthly-target.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: day target, performance view, and mohalla target are untouched', () => {
  const source = readFileSync(new URL('../collector-monthly-target.js', import.meta.url), 'utf8');
  assert.equal(source.includes('day-target.js'), false, 'module must not reference the field day target');
  assert.equal(source.includes('collector-performance.js'), false, 'module must not reference the collector performance view');
  assert.equal(source.includes('mohalla-collection-target.js'), false, 'module must not reference the monthly collection target per mohalla');
  assert.equal(existsSync(new URL('../day-target.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../collector-performance.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../mohalla-collection-target.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'cmtHeading', 'cmtSummary', 'cmtExportBtn', 'cmtCollector', 'cmtMonth',
    'cmtTargetWords', 'cmtTargetAmount', 'cmtAchievedAmount', 'cmtRecordBtn',
    'cmtRemoveId', 'cmtRemoveBtn', 'cmtCollectorInput', 'cmtCollectorBtn',
    'cmtCollectorBody', 'cmtMonthInput', 'cmtMonthBtn', 'cmtMonthBody', 'cmtBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the monthly target record per collector panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './collector-monthly-target.js'"), true);
  assert.equal(source.includes('renderCollectorMonthlyTargets()'), true);
  assert.equal(source.includes('loadCollectorMonthlyTargets()'), true);
  assert.equal(source.includes('shahdara_collector_monthly_targets_v1'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
