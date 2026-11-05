import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validGrowthFundingDate,
  normalizeGrowthFundingNote,
  normalizeGrowthFundingList,
  findGrowthFundingNote,
  recordGrowthFundingNote,
  removeGrowthFundingNote,
  growthFundingSorted,
  growthFundingNotesForSource,
  growthFundingSources,
  growthFundingTotalSetAside,
  growthFundingReconciles,
  growthFundingSummaryText,
  growthFundingEntryText,
  growthFundingEntryHtml,
  growthFundingAllHtml,
  growthFundingNotesForSourceHtml,
  growthFundingCsv,
  growthFundingFilename,
} from '../growth-funding.js';

const first = {
  id: 'GF-1',
  date: '2026-11-02',
  amount: 5000,
  source: 'Shop cash',
  runningTotal: 5000,
};
const second = {
  id: 'GF-2',
  date: '2026-11-04',
  amount: 3000,
  source: 'Collection round',
  runningTotal: 8000,
};
const third = {
  id: 'GF-3',
  date: '2026-11-05',
  amount: 2000,
  source: 'Shop cash',
  runningTotal: 10000,
};
const fourth = {
  id: 'GF-4',
  date: '2026-11-04',
  amount: 1000,
  source: 'Bank transfer',
  runningTotal: 9000,
};

test('strict dates: real calendar days only', () => {
  assert.equal(validGrowthFundingDate('2026-11-05'), true);
  assert.equal(validGrowthFundingDate('2024-02-29'), true);
  assert.equal(validGrowthFundingDate('2026-02-29'), false);
  assert.equal(validGrowthFundingDate('2026-04-31'), false);
  assert.equal(validGrowthFundingDate('2026-13-01'), false);
  assert.equal(validGrowthFundingDate('2026-11-5'), false);
  assert.equal(validGrowthFundingDate('05-11-2026'), false);
  assert.equal(validGrowthFundingDate(''), false);
  assert.equal(validGrowthFundingDate(null), false);
  assert.equal(validGrowthFundingDate(20261105), false);
});

test('half-formed notes are refused', () => {
  assert.equal(normalizeGrowthFundingNote(null), null);
  assert.equal(normalizeGrowthFundingNote('nope'), null);
  assert.equal(normalizeGrowthFundingNote({ ...first, id: '' }), null);
  assert.equal(normalizeGrowthFundingNote({ ...first, date: '2026-02-30' }), null);
  assert.equal(normalizeGrowthFundingNote({ ...first, date: '' }), null);
  assert.equal(normalizeGrowthFundingNote({ ...first, amount: 0 }), null);
  assert.equal(normalizeGrowthFundingNote({ ...first, amount: -5 }), null);
  assert.equal(normalizeGrowthFundingNote({ ...first, amount: 12.5 }), null);
  assert.equal(normalizeGrowthFundingNote({ ...first, amount: 'abc' }), null);
  assert.equal(normalizeGrowthFundingNote({ ...first, source: '' }), null);
  assert.equal(normalizeGrowthFundingNote({ ...first, source: '   ' }), null);
  assert.equal(normalizeGrowthFundingNote({ ...first, runningTotal: -1 }), null);
  assert.equal(normalizeGrowthFundingNote({ ...first, runningTotal: 10.5 }), null);
  assert.equal(normalizeGrowthFundingNote({ ...first, runningTotal: 'abc' }), null);
  const noRunningTotal = { ...first };
  delete noRunningTotal.runningTotal;
  assert.equal(normalizeGrowthFundingNote(noRunningTotal), null);
  assert.deepEqual(normalizeGrowthFundingNote({ ...first, amount: '5000', runningTotal: '5000' }), first);
  assert.deepEqual(normalizeGrowthFundingNote({ ...first, runningTotal: 0, amount: 5000 }), { ...first, runningTotal: 0 });
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = { ...first, billId: 'B-9', paymentId: 'P-9', ledgerTotal: 99999, extra: 'x' };
  const before = JSON.stringify(raw);
  assert.deepEqual(normalizeGrowthFundingNote(raw), first);
  assert.equal(JSON.stringify(raw), before);
  const listBefore = JSON.stringify([raw]);
  assert.deepEqual(normalizeGrowthFundingList([raw]), [first]);
  assert.equal(JSON.stringify([raw]), listBefore);
});

test('a duplicate id is never rewritten: the first note stays', () => {
  assert.deepEqual(recordGrowthFundingNote([first], { ...first, amount: 9999 }), [first]);
  assert.deepEqual(recordGrowthFundingNote([first], second), [first, second]);
  assert.deepEqual(recordGrowthFundingNote([], { ...first, amount: 0 }), []);
});

test('find and remove', () => {
  const list = [first, second, third];
  assert.deepEqual(findGrowthFundingNote(list, 'GF-2'), second);
  assert.equal(findGrowthFundingNote(list, 'GF-9'), null);
  assert.equal(findGrowthFundingNote(list, ''), null);
  assert.deepEqual(removeGrowthFundingNote(list, 'GF-2'), [first, third]);
  assert.deepEqual(removeGrowthFundingNote(list, 'GF-9'), list);
  assert.deepEqual(removeGrowthFundingNote(list, ''), list);
});

test('notes sort by date, then source, then id', () => {
  assert.deepEqual(
    growthFundingSorted([third, second, first, fourth]).map((note) => note.id),
    ['GF-1', 'GF-4', 'GF-2', 'GF-3'],
  );
  assert.deepEqual(growthFundingSorted([]), []);
});

test('notes per source and the source list', () => {
  assert.deepEqual(growthFundingNotesForSource([third, first, second], 'shop cash'), [first, third]);
  assert.deepEqual(growthFundingNotesForSource([third, first, second], 'SHOP CASH'), [first, third]);
  assert.deepEqual(growthFundingNotesForSource([first], 'Nope'), []);
  assert.deepEqual(growthFundingNotesForSource([first], ''), []);
  assert.deepEqual(
    growthFundingSources([third, second, first, fourth]),
    ['Bank transfer', 'Collection round', 'Shop cash'],
  );
  assert.deepEqual(growthFundingSources([]), []);
});

test('total set aside uses integer arithmetic only', () => {
  assert.equal(growthFundingTotalSetAside([first, second, third]), 10000);
  assert.equal(growthFundingTotalSetAside([]), 0);
  assert.equal(growthFundingTotalSetAside([first]), 5000);
});

test('reconciliation: entered running totals must match the summed set-asides in date order', () => {
  assert.equal(growthFundingReconciles([first, second, third]), true);
  assert.equal(growthFundingReconciles([third, first, second]), true);
  assert.equal(growthFundingReconciles([]), true);
  assert.equal(growthFundingReconciles([{ ...third, runningTotal: 9000 }]), false);
  assert.equal(growthFundingReconciles([first, { ...second, runningTotal: 7000 }, third]), false);
  assert.equal(growthFundingReconciles([first, second, fourth]), false);
});

test('summary text names the count, the total, the latest running total, and whether it reconciles', () => {
  assert.equal(growthFundingSummaryText([]), 'No growth funding notes recorded.');
  assert.equal(
    growthFundingSummaryText([first, second, third]),
    '3 set-asides, Rs 10000 set aside in total. Latest running total Rs 10000 on 2026-11-05; the running total reconciles with the set-asides.',
  );
  assert.equal(
    growthFundingSummaryText([{ ...third, runningTotal: 9000 }]),
    '1 set-aside, Rs 2000 set aside in total. Latest running total Rs 9000 on 2026-11-05; the running total does not reconcile with the set-asides — check the entered totals.',
  );
});

test('entry text shows date, amount, source, and running total', () => {
  assert.equal(
    growthFundingEntryText(first),
    '2026-11-02 — Rs 5000 set aside from Shop cash; running total Rs 5000.',
  );
  assert.equal(growthFundingEntryText(null), '');
  assert.equal(growthFundingEntryText({ ...first, amount: 0 }), '');
});

test('HTML is escaped', () => {
  const tricky = { ...first, source: 'Shop <cash> & "till"' };
  assert.equal(
    growthFundingEntryHtml(tricky),
    '<li>2026-11-02 — Rs 5000 set aside from Shop &lt;cash&gt; &amp; &quot;till&quot;; running total Rs 5000.</li>',
  );
  assert.equal(growthFundingEntryHtml(null), '');
  assert.equal(
    growthFundingAllHtml([second, first]),
    '<ul><li>2026-11-02 — Rs 5000 set aside from Shop cash; running total Rs 5000.</li><li>2026-11-04 — Rs 3000 set aside from Collection round; running total Rs 8000.</li></ul>',
  );
  assert.equal(growthFundingAllHtml([]), '<p>No growth funding notes recorded.</p>');
  assert.equal(
    growthFundingNotesForSourceHtml([third, first, second], 'shop cash'),
    '<ul><li>2026-11-02 — Rs 5000 set aside from Shop cash; running total Rs 5000.</li><li>2026-11-05 — Rs 2000 set aside from Shop cash; running total Rs 10000.</li></ul>',
  );
  assert.equal(growthFundingNotesForSourceHtml([first], 'Nope'), '<p>No growth funding notes from that source.</p>');
});

test('CSV export and filename', () => {
  const lines = growthFundingCsv([third, first, second]).split('\n');
  assert.equal(lines[0], 'id,date,amount,source,running_total');
  assert.equal(lines[1], 'GF-1,2026-11-02,5000,Shop cash,5000');
  assert.equal(lines[2], 'GF-2,2026-11-04,3000,Collection round,8000');
  assert.equal(lines[3], 'GF-3,2026-11-05,2000,Shop cash,10000');
  assert.equal(lines.length, 4);
  assert.equal(growthFundingCsv([]), 'id,date,amount,source,running_total');
  assert.equal(growthFundingFilename(), 'growth-funding-notes.csv');
});

test('list normalisation drops half-formed rows and keeps the first of a duplicate id', () => {
  assert.deepEqual(normalizeGrowthFundingList(null), []);
  assert.deepEqual(normalizeGrowthFundingList('nope'), []);
  assert.deepEqual(normalizeGrowthFundingList([first, null, { ...second, id: '' }, first]), [first]);
  assert.deepEqual(normalizeGrowthFundingList([second, first, second]), [second, first]);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../growth-funding.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: growth milestone tracker and replacement reserve tracker are untouched', () => {
  const source = readFileSync(new URL('../growth-funding.js', import.meta.url), 'utf8');
  assert.equal(source.includes('growth-milestone.js'), false, 'module must not reference the growth milestone tracker file');
  assert.equal(source.includes('equipment-ageing.js'), false, 'module must not reference the replacement reserve tracker file');
  assert.equal(existsSync(new URL('../growth-milestone.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../equipment-ageing.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'gfuHeading', 'gfuSummary', 'gfuExportBtn', 'gfuDate', 'gfuAmount',
    'gfuSource', 'gfuRunningTotal', 'gfuRecordBtn', 'gfuRemoveId',
    'gfuRemoveBtn', 'gfuSourceSelect', 'gfuSourceBody', 'gfuBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the growth funding note panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './growth-funding.js'"), true);
  assert.equal(source.includes('renderGrowthFunding();'), true);
  assert.equal(source.includes('shahdara_growth_funding_v1'), true);
  assert.equal(source.includes('loadGrowthFundingNotes'), true);
  assert.equal(source.includes('saveGrowthFundingNotes'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
