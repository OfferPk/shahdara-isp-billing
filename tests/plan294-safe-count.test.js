import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validSafeCountDate,
  normalizeSafeCount,
  normalizeSafeCountList,
  findSafeCount,
  recordSafeCount,
  removeSafeCount,
  safeCountVariance,
  safeCountVarianceWord,
  safeCountSorted,
  safeCountLatest,
  safeCountVariances,
  safeCountSummaryText,
  safeCountEntryText,
  safeCountEntryHtml,
  safeCountAllHtml,
  safeCountCsv,
  safeCountFilename,
} from '../safe-count.js';

const first = {
  id: 'SC-1',
  date: '2026-11-02',
  countedBy: 'Saad',
  countedAmount: 45200,
  expectedAmount: 45200,
  varianceNote: '',
};
const second = {
  id: 'SC-2',
  date: '2026-11-09',
  countedBy: 'Saad',
  countedAmount: 38950,
  expectedAmount: 39500,
  varianceNote: 'Rs 550 paid out for emergency cable, receipt kept',
};
const third = {
  id: 'SC-3',
  date: '2026-10-26',
  countedBy: 'Aqib',
  countedAmount: 51000,
  expectedAmount: 50500,
  varianceNote: 'Rs 500 extra from a late collection added after the ledger closed',
};
const fixture = [second, first, third];

test('half-formed counts are refused', () => {
  assert.equal(normalizeSafeCount(null), null);
  assert.equal(normalizeSafeCount([]), null);
  assert.equal(normalizeSafeCount({ ...first, id: '  ' }), null);
  assert.equal(normalizeSafeCount({ ...first, date: '' }), null);
  assert.equal(normalizeSafeCount({ ...first, date: '2026-13-02' }), null);
  assert.equal(normalizeSafeCount({ ...first, date: '02-11-2026' }), null);
  assert.equal(normalizeSafeCount({ ...first, countedBy: '' }), null);
  assert.equal(normalizeSafeCount({ ...first, countedAmount: '' }), null);
  assert.equal(normalizeSafeCount({ ...first, countedAmount: -100 }), null);
  assert.equal(normalizeSafeCount({ ...first, countedAmount: 45200.5 }), null);
  assert.equal(normalizeSafeCount({ ...first, countedAmount: '45,200' }), null);
  assert.equal(normalizeSafeCount({ ...first, expectedAmount: '' }), null);
  assert.equal(normalizeSafeCount({ ...first, expectedAmount: -1 }), null);
  assert.equal(normalizeSafeCount({ ...first, expectedAmount: 45200.25 }), null);
  assert.deepEqual(normalizeSafeCount(first), first);
  assert.deepEqual(normalizeSafeCount({ ...first, countedAmount: '45200' }).countedAmount, 45200);
  assert.deepEqual(normalizeSafeCount({ ...first, countedBy: '  Saad  ' }).countedBy, 'Saad');
});

test('a variance with no explanation in words is refused', () => {
  assert.equal(normalizeSafeCount({ ...second, varianceNote: '' }), null);
  assert.equal(normalizeSafeCount({ ...second, varianceNote: '   ' }), null);
  assert.equal(normalizeSafeCount({ ...third, varianceNote: '' }), null);
  assert.notEqual(normalizeSafeCount(second), null);
  assert.notEqual(normalizeSafeCount(third), null);
  assert.notEqual(normalizeSafeCount(first), null);
});

test('strict dates: real calendar only', () => {
  assert.equal(validSafeCountDate('2026-02-29'), false);
  assert.equal(validSafeCountDate('2024-02-29'), true);
  assert.equal(validSafeCountDate('2026-04-31'), false);
  assert.equal(validSafeCountDate('2026-11-05'), true);
  assert.equal(validSafeCountDate('2026-00-10'), false);
  assert.equal(validSafeCountDate('2026-11-00'), false);
  assert.equal(validSafeCountDate(20261105), false);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const raw = {
    ...first,
    billId: 'B-1',
    paymentId: 'P-1',
    ledgerTotal: 99999,
    extra: 'drop me',
  };
  const clean = normalizeSafeCount(raw);
  assert.equal(clean.billId, undefined);
  assert.equal(clean.paymentId, undefined);
  assert.equal(clean.ledgerTotal, undefined);
  assert.equal(clean.extra, undefined);
  assert.deepEqual(Object.keys(clean).sort(), ['countedAmount', 'countedBy', 'date', 'expectedAmount', 'id', 'varianceNote']);
  const before = JSON.stringify(raw);
  normalizeSafeCount(raw);
  assert.equal(JSON.stringify(raw), before);
});

test('duplicate ids are never rewritten', () => {
  const list = recordSafeCount([first], { ...first, countedAmount: 1, expectedAmount: 1 });
  assert.deepEqual(list, [first]);
  assert.deepEqual(recordSafeCount([first], { ...first, id: 'SC-9', date: '2026-11-03' }), [first, {
    id: 'SC-9', date: '2026-11-03', countedBy: 'Saad', countedAmount: 45200, expectedAmount: 45200, varianceNote: '',
  }]);
});

test('find and remove', () => {
  assert.deepEqual(findSafeCount(fixture, 'SC-2'), second);
  assert.equal(findSafeCount(fixture, 'SC-9'), null);
  assert.equal(findSafeCount(fixture, ''), null);
  assert.deepEqual(removeSafeCount(fixture, 'SC-2'), [first, third]);
  assert.deepEqual(removeSafeCount(fixture, 'SC-9'), fixture);
});

test('sorting is by date then id', () => {
  assert.deepEqual(safeCountSorted(fixture).map((count) => count.id), ['SC-3', 'SC-1', 'SC-2']);
  assert.deepEqual(safeCountSorted([{ ...first, id: 'SC-0', date: '2026-11-02' }, first]).map((count) => count.id), ['SC-0', 'SC-1']);
});

test('variance is counted minus expected, in whole rupees', () => {
  assert.equal(safeCountVariance(first), 0);
  assert.equal(safeCountVariance(second), -550);
  assert.equal(safeCountVariance(third), 500);
  assert.equal(safeCountVariance(null), null);
  assert.equal(safeCountVarianceWord(first), 'exact');
  assert.equal(safeCountVarianceWord(second), 'short');
  assert.equal(safeCountVarianceWord(third), 'over');
  assert.equal(safeCountVarianceWord(null), '');
});

test('latest count and variance-only list', () => {
  assert.deepEqual(safeCountLatest(fixture), second);
  assert.equal(safeCountLatest([]), null);
  assert.deepEqual(safeCountVariances(fixture).map((count) => count.id), ['SC-3', 'SC-2']);
  assert.deepEqual(safeCountVariances([first]), []);
});

test('summary text names the latest count and its variance', () => {
  assert.equal(safeCountSummaryText([]), 'No safe counts recorded.');
  assert.equal(
    safeCountSummaryText([first]),
    '1 safe count recorded. Latest count on 2026-11-02: counted Rs 45200 against Rs 45200 expected, exact.',
  );
  assert.equal(
    safeCountSummaryText(fixture),
    '3 safe counts recorded. Latest count on 2026-11-09: counted Rs 38950 against Rs 39500 expected, short by Rs 550.',
  );
});

test('entry text shows counted versus expected with the variance explained', () => {
  assert.equal(safeCountEntryText(null), 'No safe count recorded.');
  assert.equal(
    safeCountEntryText(first),
    '2026-11-02 — counted Rs 45200, expected Rs 45200, exact. Counted by Saad',
  );
  assert.equal(
    safeCountEntryText(second),
    '2026-11-09 — counted Rs 38950, expected Rs 39500, short by Rs 550. Counted by Saad — Variance: Rs 550 paid out for emergency cable, receipt kept',
  );
  assert.equal(
    safeCountEntryText(third),
    '2026-10-26 — counted Rs 51000, expected Rs 50500, over by Rs 500. Counted by Aqib — Variance: Rs 500 extra from a late collection added after the ledger closed',
  );
});

test('HTML escapes input', () => {
  const nasty = { ...second, varianceNote: 'A & B <b>bold</b>' };
  assert.equal(safeCountEntryHtml(nasty).includes('<b>'), false);
  assert.equal(safeCountEntryHtml(nasty).includes('A &amp; B &lt;b&gt;bold&lt;/b&gt;'), true);
  assert.equal(safeCountEntryHtml(null), '<p>No safe count recorded.</p>');
  const html = safeCountAllHtml(fixture);
  assert.equal(html.includes('2026-11-09'), true);
  assert.equal(html.includes('short by Rs 550'), true);
  assert.equal(safeCountAllHtml([]), '<p>No safe counts recorded.</p>');
});

test('CSV export and filename', () => {
  const csv = safeCountCsv(fixture);
  assert.equal(csv.split('\n')[0], '"id","date","counted by","counted amount","expected amount","variance","variance note"');
  assert.equal(csv.includes('"SC-2","2026-11-09","Saad","38950","39500","-550","Rs 550 paid out for emergency cable, receipt kept"'), true);
  assert.equal(csv.split('\n').length, 4);
  assert.equal(csv.split('\n')[1].startsWith('"SC-3"'), true);
  assert.equal(safeCountFilename(), 'safe-counts.csv');
});

test('list normalisation drops half-formed rows and keeps the first of each id', () => {
  assert.deepEqual(normalizeSafeCountList(null), []);
  assert.deepEqual(normalizeSafeCountList('nope'), []);
  assert.deepEqual(normalizeSafeCountList([first, null, { ...first, id: '' }]).length, 1);
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../safe-count.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the handover, petty cash, cash-in-hand, and settlement records are untouched', () => {
  const source = readFileSync(new URL('../safe-count.js', import.meta.url), 'utf8');
  assert.equal(source.includes('denomination-count.js'), false, 'module must not reference the denomination handover count module');
  assert.equal(source.includes('petty-cash.js'), false, 'module must not reference the petty cash log module');
  assert.equal(source.includes('cash-in-hand.js'), false, 'module must not reference the cash-in-hand limit module');
  assert.equal(source.includes('collector-settlements.js'), false, 'module must not reference the collector settlement statement module');
  assert.equal(existsSync(new URL('../denomination-count.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../petty-cash.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../cash-in-hand.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../collector-settlements.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'sfcHeading', 'sfcSummary', 'sfcExportBtn', 'sfcDate', 'sfcCountedBy',
    'sfcCountedAmount', 'sfcExpectedAmount', 'sfcVarianceNote', 'sfcRecordBtn',
    'sfcRemoveId', 'sfcRemoveBtn', 'sfcBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the safe count panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './safe-count.js'"), true);
  assert.equal(source.includes('renderSafeCount()'), true);
  assert.equal(source.includes('loadSafeCounts()'), true);
  assert.equal(source.includes('shahdara_safe_counts_v1'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
