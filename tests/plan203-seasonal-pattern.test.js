import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  seasonalPatternMonthName,
  normalizeSeasonalPattern,
  normalizeSeasonalPatternList,
  findSeasonalPattern,
  recordSeasonalPattern,
  removeSeasonalPattern,
  seasonalPatternsSorted,
  seasonalPatternsForMohalla,
  seasonalPatternsForMonth,
  seasonalPatternsForSeason,
  seasonalPatternMohallas,
  seasonalPatternSummaryText,
  seasonalPatternText,
  seasonalPatternAllHtml,
  seasonalPatternMohallaHtml,
  seasonalPatternMonthHtml,
  seasonalPatternCsv,
  seasonalPatternFilename,
} from '../seasonal-pattern.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'seasonal-pattern.js'), 'utf8');

const noteA = { id: 'SP-1', mohalla: 'Gali 4', season: 'Winter', pattern: 'slow', reason: 'Field visits are harder in fog', months: [12, 1, 2] };
const noteB = { id: 'SP-2', mohalla: 'Gali 4', season: 'Harvest', pattern: 'busy', reason: 'Cash timing shifts at harvest', months: [4, 5] };
const noteC = { id: 'SP-3', mohalla: 'Main Bazar', season: 'Winter', pattern: 'slow', reason: 'Shops close early in cold', months: [1, 12] };

test('half-formed seasonal pattern notes are refused', () => {
  assert.equal(normalizeSeasonalPattern({ id: 'SP-9', season: 'Winter', pattern: 'slow', reason: 'Fog', months: [1] }), null);
  assert.equal(normalizeSeasonalPattern({ ...noteA, mohalla: '' }), null);
  assert.equal(normalizeSeasonalPattern({ ...noteA, months: [] }), null);
  assert.equal(normalizeSeasonalPattern({ ...noteA, months: [0, 13, 'x'] }), null);
  assert.equal(normalizeSeasonalPattern({ ...noteA, season: '' }), null);
  assert.equal(normalizeSeasonalPattern({ ...noteA, pattern: 'normal' }), null);
  assert.equal(normalizeSeasonalPattern({ ...noteA, pattern: '' }), null);
  assert.equal(normalizeSeasonalPattern({ ...noteA, reason: '   ' }), null);
  assert.equal(normalizeSeasonalPattern({ id: '', mohalla: 'Gali 4', season: 'Winter', pattern: 'slow', reason: 'Fog', months: [1] }), null);
  assert.equal(normalizeSeasonalPattern(null), null);
});

test('pattern is case-insensitive and stored lowercase', () => {
  assert.equal(normalizeSeasonalPattern({ ...noteA, pattern: 'Slow' }).pattern, 'slow');
  assert.equal(normalizeSeasonalPattern({ ...noteA, pattern: 'BUSY' }).pattern, 'busy');
});

test('months are cleaned: invalid dropped, duplicates removed, sorted', () => {
  assert.deepEqual(normalizeSeasonalPattern({ ...noteA, months: [2, 12, 2, 0, 13, '1'] }).months, [1, 2, 12]);
  assert.deepEqual(normalizeSeasonalPattern({ ...noteA, months: ['3', 3.5, null] }).months, [3]);
  assert.equal(seasonalPatternMonthName(1), 'January');
  assert.equal(seasonalPatternMonthName(12), 'December');
  assert.equal(seasonalPatternMonthName(13), '');
  assert.equal(seasonalPatternMonthName('x'), '');
});

test('unknown fields are dropped, so no price, discount, or billing field can creep in', () => {
  const clean = normalizeSeasonalPattern({ ...noteA, price: 500, discount: 10, dueDate: '2026-01-05', billId: 'B-1', paymentId: 'P-1' });
  assert.deepEqual(Object.keys(clean).sort(), ['id', 'mohalla', 'months', 'pattern', 'reason', 'season']);
});

test('duplicate ids are never rewritten', () => {
  const list = recordSeasonalPattern([noteA], { ...noteA, reason: 'Changed reason' });
  assert.deepEqual(list, [normalizeSeasonalPattern(noteA)]);
  assert.deepEqual(recordSeasonalPattern([noteA], noteA), [normalizeSeasonalPattern(noteA)]);
});

test('one note per mohalla per season: a second note for the same pair is refused', () => {
  const otherSeason = recordSeasonalPattern([noteA], { ...noteB, mohalla: 'Gali 4', season: 'Winter', id: 'SP-9' });
  assert.deepEqual(otherSeason, [normalizeSeasonalPattern(noteA)]);
  const otherMohalla = recordSeasonalPattern([noteA], { ...noteA, id: 'SP-9', mohalla: 'Main Bazar' });
  assert.equal(otherMohalla.length, 2);
  const casePair = recordSeasonalPattern([noteA], { ...noteB, id: 'SP-9', mohalla: 'gali 4', season: 'winter' });
  assert.deepEqual(casePair, [normalizeSeasonalPattern(noteA)]);
});

test('find and remove by id', () => {
  assert.deepEqual(findSeasonalPattern([noteA, noteB], 'SP-2'), normalizeSeasonalPattern(noteB));
  assert.equal(findSeasonalPattern([noteA], 'SP-9'), null);
  assert.deepEqual(removeSeasonalPattern([noteA, noteB], 'SP-1'), [normalizeSeasonalPattern(noteB)]);
  assert.deepEqual(removeSeasonalPattern([noteA], 'SP-9'), [normalizeSeasonalPattern(noteA)]);
});

test('sorting: mohalla A-Z, then season A-Z, then id A-Z', () => {
  const sorted = seasonalPatternsSorted([noteC, noteB, noteA]);
  assert.deepEqual(sorted.map((item) => item.id), ['SP-2', 'SP-1', 'SP-3']);
});

test('mohalla filter is a case-insensitive substring', () => {
  assert.deepEqual(seasonalPatternsForMohalla([noteA, noteB, noteC], 'gali').map((item) => item.id), ['SP-2', 'SP-1']);
  assert.deepEqual(seasonalPatternsForMohalla([noteA, noteB, noteC], '').map((item) => item.id), ['SP-2', 'SP-1', 'SP-3']);
  assert.deepEqual(seasonalPatternsForMohalla([noteA, noteC], 'Bazar').map((item) => item.id), ['SP-3']);
});

test('month view: the mohalla planning view for that month', () => {
  assert.deepEqual(seasonalPatternsForMonth([noteA, noteB, noteC], 1).map((item) => item.id), ['SP-1', 'SP-3']);
  assert.deepEqual(seasonalPatternsForMonth([noteA, noteB, noteC], 4).map((item) => item.id), ['SP-2']);
  assert.deepEqual(seasonalPatternsForMonth([noteA, noteB], 6), []);
  assert.deepEqual(seasonalPatternsForMonth([noteA], 0), []);
  assert.deepEqual(seasonalPatternsForMonth([noteA], 13), []);
  assert.deepEqual(seasonalPatternsForMonth([noteA], 'x'), []);
});

test('season view is case-insensitive', () => {
  assert.deepEqual(seasonalPatternsForSeason([noteA, noteB, noteC], 'winter').map((item) => item.id), ['SP-1', 'SP-3']);
  assert.deepEqual(seasonalPatternsForSeason([noteA], 'summer'), []);
  assert.deepEqual(seasonalPatternsForSeason([noteA], ''), []);
});

test('mohalla list keeps first spelling, sorted case-insensitively', () => {
  assert.deepEqual(seasonalPatternMohallas([noteC, noteA, noteB]), ['Gali 4', 'Main Bazar']);
});

test('summary text', () => {
  assert.equal(seasonalPatternSummaryText([]), 'No seasonal collection pattern notes recorded.');
  assert.equal(seasonalPatternSummaryText([noteA]), '1 seasonal collection pattern note across 1 mohalla and 1 season.');
  assert.equal(seasonalPatternSummaryText([noteA, noteB, noteC]), '3 seasonal collection pattern notes across 2 mohallas and 2 seasons.');
});

test('note text names mohalla, season, pattern, months, and reason', () => {
  assert.equal(seasonalPatternText(noteA), 'Gali 4 · Winter: expect slow collection in January, February, December — Field visits are harder in fog');
  assert.equal(seasonalPatternText(noteB), 'Gali 4 · Harvest: expect busy collection in April, May — Cash timing shifts at harvest');
  assert.equal(seasonalPatternText(null), '');
});

test('HTML escapes operator input and orders rows', () => {
  const html = seasonalPatternAllHtml([{ ...noteA, reason: '<b>&"x"</b>' }]);
  assert.doesNotMatch(html, /<b>/);
  assert.match(html, /&lt;b&gt;&amp;&quot;x&quot;&lt;\/b&gt;/);
  assert.match(seasonalPatternMohallaHtml([noteA, noteB], 'Gali 4'), /Gali 4/);
  assert.match(seasonalPatternMohallaHtml([], 'Gali 4'), /No seasonal pattern notes recorded for this mohalla yet/);
  assert.match(seasonalPatternMonthHtml([noteA], 1), /January/);
  assert.match(seasonalPatternMonthHtml([], 6), /No seasonal pattern notes affect this month yet/);
  assert.match(seasonalPatternAllHtml([]), /No seasonal collection pattern notes recorded yet/);
});

test('CSV columns and filename', () => {
  const csv = seasonalPatternCsv([noteB, noteA]);
  assert.equal(csv.split('\n')[0], 'id,mohalla,season,pattern,months,reason');
  assert.match(csv, /SP-1,Gali 4,Winter,slow,1;2;12,Field visits are harder in fog/);
  assert.equal(seasonalPatternFilename(), 'seasonal-patterns.csv');
});

test('inputs are never mutated', () => {
  const input = [noteA, noteB];
  const snapshot = JSON.stringify(input);
  recordSeasonalPattern(input, noteC);
  removeSeasonalPattern(input, 'SP-1');
  seasonalPatternsSorted(input);
  seasonalPatternsForMonth(input, 1);
  assert.equal(JSON.stringify(input), snapshot);
});

test('list normalization drops bad entries and later duplicates', () => {
  assert.deepEqual(normalizeSeasonalPatternList(null), []);
  assert.deepEqual(
    normalizeSeasonalPatternList([null, noteA, { ...noteA, reason: 'Other' }, { ...noteA, id: 'SP-9' }, noteB]),
    [normalizeSeasonalPattern(noteA), normalizeSeasonalPattern(noteB)],
  );
});

test('purity fence: the module is import-free and touches no storage, clock, network, or neighbouring module', () => {
  assert.doesNotMatch(moduleSrc, /^import\s/m);
  assert.doesNotMatch(moduleSrc, /localStorage|fetch\(|Date\.now|new Date\(/);
  // Neighbouring modules are named only in the header fence comment;
  // no code path imports them or reads their records.
  const code = moduleSrc.replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /seasonal-risk|campaign-planner/);
  assert.doesNotMatch(code, /record\.(price|discount|dueDate|billId|paymentId)/);
});

test('panel element ids are present in index.html', () => {
  for (const id of ['spSummary', 'spExportBtn', 'spMohalla', 'spSeason', 'spPattern', 'spMonths', 'spReason', 'spSaveBtn', 'spRemoveId', 'spRemoveBtn', 'spMohallaFilter', 'spMonthFilter', 'spBody']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring mentions the seasonal-pattern store and render function', () => {
  assert.match(appJs, /shahdara_seasonal_patterns_v1/);
  assert.match(appJs, /renderSeasonalPatterns\(\)/);
  assert.match(appJs, /seasonal-pattern\.js/);
});

test('deployment guard: no standalone OLT word added to app.js by this plan', () => {
  const matches = appJs.match(/(?<![A-Z])OLT(?![A-Z])/g) || [];
  assert.equal(matches.length, 0);
});
