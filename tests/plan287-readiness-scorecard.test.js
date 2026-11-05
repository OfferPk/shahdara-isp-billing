import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validReadinessScorecardDate,
  foldReadinessDone,
  normalizeReadinessItem,
  normalizeReadinessItems,
  normalizeReadinessScorecard,
  normalizeReadinessScorecardList,
  findReadinessScorecard,
  recordReadinessScorecard,
  removeReadinessScorecard,
  readinessScorecardSorted,
  checkedItemCount,
  totalItemCount,
  readinessScorecardSummaryText,
  readinessScorecardText,
  readinessScorecardHtml,
  readinessScorecardAllHtml,
  readinessScorecardCsv,
  readinessScorecardFilename,
} from '../readiness-scorecard.js';

const first = {
  id: 'RS-1',
  date: '2026-11-01',
  recordedBy: 'Saad',
  items: [
    { label: 'Port count under 250', done: true },
    { label: 'Second unit rack space ready', done: false },
    { label: 'Power backup checked', done: true },
  ],
};
const second = {
  id: 'RS-2',
  date: '2026-11-05',
  recordedBy: 'Aqib',
  items: [
    'Port count under 250',
    { label: 'Spare fibre stock counted', done: 'yes' },
  ],
};
const fixture = [first, second];

test('half-formed scorecards are refused', () => {
  assert.equal(normalizeReadinessScorecard(null), null);
  assert.equal(normalizeReadinessScorecard('nope'), null);
  assert.equal(normalizeReadinessScorecard({ ...first, id: '  ' }), null);
  assert.equal(normalizeReadinessScorecard({ ...first, date: '' }), null);
  assert.equal(normalizeReadinessScorecard({ ...first, date: '2026-02-30' }), null);
  assert.equal(normalizeReadinessScorecard({ ...first, date: '01-11-2026' }), null);
  assert.equal(normalizeReadinessScorecard({ ...first, recordedBy: '' }), null);
  assert.equal(normalizeReadinessScorecard({ ...first, items: [] }), null);
  assert.equal(normalizeReadinessScorecard({ ...first, items: [{ label: '  ', done: true }] }), null);
  assert.equal(normalizeReadinessScorecard({ ...first, items: 'not a list' }), null);
  const entry = normalizeReadinessScorecard(first);
  assert.deepEqual(entry, {
    id: 'RS-1',
    date: '2026-11-01',
    recordedBy: 'Saad',
    items: [
      { label: 'Port count under 250', done: true },
      { label: 'Second unit rack space ready', done: false },
      { label: 'Power backup checked', done: true },
    ],
  });
});

test('strict dates: 31-day months pass, bad dates fail, leap years work', () => {
  assert.equal(validReadinessScorecardDate('2026-08-31'), true);
  assert.equal(validReadinessScorecardDate('2026-10-31'), true);
  assert.equal(validReadinessScorecardDate('2026-12-31'), true);
  assert.equal(validReadinessScorecardDate('2026-02-29'), false);
  assert.equal(validReadinessScorecardDate('2028-02-29'), true);
  assert.equal(validReadinessScorecardDate('2024-02-29'), true);
  assert.equal(validReadinessScorecardDate('2026-04-31'), false);
  assert.equal(validReadinessScorecardDate('2026-13-01'), false);
  assert.equal(validReadinessScorecardDate('02-11-2026'), false);
  assert.equal(validReadinessScorecardDate(''), false);
  assert.equal(validReadinessScorecardDate(null), false);
  assert.equal(validReadinessScorecardDate(20261101), false);
});

test('done folds from plain spellings, anything else reads as not done', () => {
  assert.equal(foldReadinessDone(true), true);
  assert.equal(foldReadinessDone('true'), true);
  assert.equal(foldReadinessDone('YES'), true);
  assert.equal(foldReadinessDone('done'), true);
  assert.equal(foldReadinessDone('checked'), true);
  assert.equal(foldReadinessDone('x'), true);
  assert.equal(foldReadinessDone(false), false);
  assert.equal(foldReadinessDone('false'), false);
  assert.equal(foldReadinessDone('no'), false);
  assert.equal(foldReadinessDone('maybe'), false);
  assert.equal(foldReadinessDone(''), false);
  assert.equal(foldReadinessDone(null), false);
  assert.equal(foldReadinessDone(1), false);
});

test('items normalise: strings read as not done, empty labels drop, unknown fields drop', () => {
  assert.deepEqual(normalizeReadinessItem('Port count under 250'), { label: 'Port count under 250', done: false });
  assert.equal(normalizeReadinessItem('  '), null);
  assert.equal(normalizeReadinessItem(null), null);
  assert.equal(normalizeReadinessItem(42), null);
  assert.deepEqual(normalizeReadinessItem({ label: 'Power backup checked', done: 'done', bill: 1500 }),
    { label: 'Power backup checked', done: true });
  assert.deepEqual(normalizeReadinessItems(['A', { label: 'B', done: true }, '  ', null, { label: '', done: true }]),
    [{ label: 'A', done: false }, { label: 'B', done: true }]);
  assert.deepEqual(normalizeReadinessItems('nope'), []);
  const raw = { ...first, customer: 'Ali', billAmount: 1500 };
  const entry = normalizeReadinessScorecard(raw);
  assert.equal('customer' in entry, false);
  assert.equal('billAmount' in entry, false);
  assert.equal(raw.customer, 'Ali');
  assert.deepEqual(Object.keys(raw).sort(), ['billAmount', 'customer', 'date', 'id', 'items', 'recordedBy']);
});

test('a duplicate id is never rewritten', () => {
  const next = recordReadinessScorecard(fixture, { ...first, date: '2026-11-09', recordedBy: 'Someone else' });
  assert.equal(next.length, 2);
  assert.equal(next[0].date, '2026-11-01');
  assert.equal(next[0].recordedBy, 'Saad');
  assert.equal(recordReadinessScorecard(fixture, { ...first, id: '' }).length, 2);
  assert.equal(recordReadinessScorecard(fixture, { ...second, id: 'RS-3' }).length, 3);
});

test('find and remove work by id only', () => {
  assert.equal(findReadinessScorecard(fixture, 'RS-1').recordedBy, 'Saad');
  assert.equal(findReadinessScorecard(fixture, 'RS-9'), null);
  assert.equal(findReadinessScorecard(fixture, ''), null);
  assert.deepEqual(removeReadinessScorecard(fixture, 'RS-1').map((entry) => entry.id), ['RS-2']);
  assert.equal(removeReadinessScorecard(fixture, 'RS-9').length, 2);
  assert.equal(removeReadinessScorecard(fixture, '').length, 2);
});

test('scorecards sort by date then id', () => {
  const rows = readinessScorecardSorted([second, first, { ...second, id: 'RS-0', date: '2026-11-01' }]);
  assert.deepEqual(rows.map((entry) => entry.id), ['RS-0', 'RS-1', 'RS-2']);
  assert.deepEqual(normalizeReadinessScorecardList('nope'), []);
});

test('the checked count is a plain count, never a percentage or a score', () => {
  assert.equal(checkedItemCount(first), 2);
  assert.equal(totalItemCount(first), 3);
  assert.equal(checkedItemCount(second), 1);
  assert.equal(totalItemCount(second), 2);
  assert.equal(checkedItemCount(null), 0);
  assert.equal(totalItemCount(null), 0);
  assert.equal(readinessScorecardText(first).includes('%'), false);
  assert.equal(readinessScorecardText(first).includes('score'), false);
  assert.equal(readinessScorecardSummaryText(fixture).includes('%'), false);
  assert.equal(readinessScorecardSummaryText(fixture), '2 readiness scorecards recorded. Latest 2026-11-05: 1 of 2 items checked.');
  assert.equal(readinessScorecardSummaryText([first]), '1 readiness scorecard recorded. Latest 2026-11-01: 2 of 3 items checked.');
  assert.equal(readinessScorecardSummaryText([]), 'No readiness scorecards recorded.');
});

test('text names the date, the recorder, and the checked count', () => {
  assert.equal(readinessScorecardText(first),
    '2026-11-01 — recorded by Saad — 2 of 3 items checked: [x] Port count under 250; [ ] Second unit rack space ready; [x] Power backup checked');
  assert.equal(readinessScorecardText(null), 'No readiness scorecard recorded.');
  assert.equal(readinessScorecardText({ ...first, items: [] }), 'No readiness scorecard recorded.');
});

test('html escapes input', () => {
  const evil = { id: 'RS-9', date: '2026-11-05', recordedBy: '<script>alert(1)</script>', items: ['<b>bold</b>'] };
  const html = readinessScorecardHtml(evil);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(html.includes('&lt;b&gt;bold&lt;/b&gt;'), true);
  assert.equal(html.includes('0 of 1 items checked'), true);
  assert.equal(readinessScorecardHtml(null), '<p>No readiness scorecard recorded.</p>');
  const all = readinessScorecardAllHtml([evil, first]);
  assert.equal(all.includes('&lt;script&gt;'), true);
  assert.equal(readinessScorecardAllHtml([]), '<p>No readiness scorecards recorded.</p>');
});

test('csv export and filename', () => {
  const csv = readinessScorecardCsv(fixture);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","date","recorded by","items checked","items total","items"');
  assert.equal(lines.length, 3);
  assert.equal(lines[1].includes('"RS-1"'), true);
  assert.equal(lines[1].includes('"2026-11-01"'), true);
  assert.equal(lines[1].includes('"Saad"'), true);
  assert.equal(lines[1].includes('"2"'), true);
  assert.equal(lines[1].includes('"3"'), true);
  assert.equal(lines[1].includes('[x] Port count under 250'), true);
  assert.equal(readinessScorecardCsv([]), '"id","date","recorded by","items checked","items total","items"');
  assert.equal(readinessScorecardFilename(), 'readiness-scorecards.csv');
});

test('list normalisation drops bad scorecards and keeps the first duplicate', () => {
  const bad = { ...first, id: '' };
  const out = normalizeReadinessScorecardList([bad, first, { ...first, date: '2026-11-09' }, second, 'nope', null]);
  assert.deepEqual(out.map((entry) => entry.id), ['RS-1', 'RS-2']);
  assert.equal(out[0].date, '2026-11-01');
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../readiness-scorecard.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the forecast, migration, and milestone records are untouched', () => {
  const source = readFileSync(new URL('../readiness-scorecard.js', import.meta.url), 'utf8');
  assert.equal(source.includes('capacity-forecast.js'), false, 'module must not reference the capacity forecast module');
  assert.equal(source.includes('migration-checklist.js'), false, 'module must not reference the migration checklist module');
  assert.equal(source.includes('growth-milestone.js'), false, 'module must not reference the milestone tracker module');
  assert.equal(existsSync(new URL('../capacity-forecast.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../migration-checklist.js', import.meta.url)), true);
  assert.equal(existsSync(new URL('../growth-milestone.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'scHeading', 'scSummary', 'scExportBtn', 'scDate', 'scRecordedBy',
    'scDoneItems', 'scPendingItems', 'scRecordBtn', 'scRemoveId', 'scRemoveBtn', 'scBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the readiness scorecard panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './readiness-scorecard.js'"), true);
  assert.equal(source.includes('renderReadinessScorecards()'), true);
  assert.equal(source.includes('loadReadinessScorecards()'), true);
  assert.equal(source.includes('shahdara_readiness_scorecards_v1'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
