import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validWeatherDisruptionDate,
  normalizeWeatherDisruptionList,
  recordWeatherDisruption,
  removeWeatherDisruption,
  findWeatherDisruption,
  weatherDisruptionsSorted,
  weatherDisruptionsForMohalla,
  weatherDisruptionMohallas,
  addWeatherDisruptionAnnotation,
  weatherDisruptionSummaryText,
  weatherDisruptionText,
  weatherDisruptionHtml,
  weatherDisruptionCsv,
  weatherDisruptionFilename,
} from '../weather-disruption.js';
import fs from 'node:fs';

const entryA = { id: 'w1', date: '2026-07-12', weather: 'Heavy rain and storm', mohallas: ['Mohalla A', 'Mohalla B'], visitsPostponed: ['Visit 1', 'Visit 2'], faultsAttributed: ['Fault F1'] };
const entryB = { id: 'w2', date: '2026-07-12', weather: 'Thunderstorm', mohallas: 'Mohalla C', visitsPostponed: 'Visit 3', faultsAttributed: [] };
const entryC = { id: 'w3', date: '2026-08-01', weather: 'Flash flooding', mohallas: ['Mohalla A'], visitsPostponed: ['Visit 4'], faultsAttributed: ['Fault F2', 'Fault F3'] };

test('half-formed entries are refused', () => {
  assert.equal(recordWeatherDisruption([], { date: '2026-07-12', weather: 'Storm', mohallas: ['X'], visitsPostponed: ['V'] }).length, 0);
  assert.equal(recordWeatherDisruption([], { id: 'x', weather: 'Storm', mohallas: ['X'], visitsPostponed: ['V'] }).length, 0);
  assert.equal(recordWeatherDisruption([], { id: 'x', date: '2026-07-12', mohallas: ['X'], visitsPostponed: ['V'] }).length, 0);
  assert.equal(recordWeatherDisruption([], { id: 'x', date: '2026-07-12', weather: 'Storm', visitsPostponed: ['V'] }).length, 0);
  assert.equal(recordWeatherDisruption([], { id: 'x', date: '2026-07-12', weather: 'Storm', mohallas: [], visitsPostponed: ['V'] }).length, 0);
  assert.equal(recordWeatherDisruption([], { id: 'x', date: '2026-07-12', weather: 'Storm', mohallas: ['X'] }).length, 0);
  assert.equal(recordWeatherDisruption([], { id: 'x', date: '2026-07-12', weather: 'Storm', mohallas: ['X'], visitsPostponed: [] }).length, 0);
});

test('strict dates: leap day accepted, impossible dates refused', () => {
  assert.equal(validWeatherDisruptionDate('2024-02-29'), true);
  assert.equal(validWeatherDisruptionDate('2026-02-29'), false);
  assert.equal(validWeatherDisruptionDate('2026-02-30'), false);
  assert.equal(validWeatherDisruptionDate('2026-13-01'), false);
  assert.equal(validWeatherDisruptionDate('2026-10-3'), false);
});

test('unknown fields are dropped and inputs are never mutated', () => {
  const input = { ...entryA, surprise: 'nope', annotations: [{ date: '2026-07-13', note: 'Checked poles.', junk: 1 }] };
  const frozen = JSON.parse(JSON.stringify(input));
  const list = recordWeatherDisruption([], input);
  assert.equal(list.length, 1);
  assert.equal('surprise' in list[0], false);
  assert.deepEqual(list[0].annotations, [{ date: '2026-07-13', note: 'Checked poles.' }]);
  assert.deepEqual(input, frozen);
});

test('duplicate ids are never rewritten', () => {
  const list = recordWeatherDisruption(recordWeatherDisruption([], entryA), { ...entryA, weather: 'Changed' });
  assert.equal(list.length, 1);
  assert.equal(list[0].weather, 'Heavy rain and storm');
});

test('find and remove', () => {
  const list = [entryA, entryB].reduce((acc, item) => recordWeatherDisruption(acc, item), []);
  assert.equal(findWeatherDisruption(list, 'w2').weather, 'Thunderstorm');
  assert.equal(findWeatherDisruption(list, 'missing'), null);
  assert.equal(removeWeatherDisruption(list, 'w1').length, 1);
  assert.equal(removeWeatherDisruption(list, 'missing').length, 2);
});

test('sorting is date, then id', () => {
  const sorted = weatherDisruptionsSorted([entryC, entryB, entryA]);
  assert.deepEqual(sorted.map((item) => item.id), ['w1', 'w2', 'w3']);
});

test('mohalla filter is case-insensitive substring', () => {
  const list = [entryA, entryB, entryC].reduce((acc, item) => recordWeatherDisruption(acc, item), []);
  assert.deepEqual(weatherDisruptionsForMohalla(list, 'mohalla a').map((item) => item.id), ['w1', 'w3']);
  assert.deepEqual(weatherDisruptionsForMohalla(list, 'C').map((item) => item.id), ['w2']);
  assert.deepEqual(weatherDisruptionMohallas(list), ['Mohalla A', 'Mohalla B', 'Mohalla C']);
});

test('annotation annotates without rewriting the entry', () => {
  const list = [entryA].reduce((acc, item) => recordWeatherDisruption(acc, item), []);
  const next = addWeatherDisruptionAnnotation(list, 'w1', '2026-07-13', 'Poles checked after the storm.');
  assert.equal(next[0].weather, 'Heavy rain and storm');
  assert.equal(next[0].date, '2026-07-12');
  assert.deepEqual(next[0].mohallas, ['Mohalla A', 'Mohalla B']);
  assert.deepEqual(next[0].visitsPostponed, ['Visit 1', 'Visit 2']);
  assert.deepEqual(next[0].annotations, [{ date: '2026-07-13', note: 'Poles checked after the storm.' }]);
  assert.deepEqual(addWeatherDisruptionAnnotation(list, 'missing', '2026-07-13', 'Note.'), list);
  assert.deepEqual(addWeatherDisruptionAnnotation(list, 'w1', '2026-02-30', 'Note.'), list);
  assert.deepEqual(addWeatherDisruptionAnnotation(list, 'w1', '2026-07-13', '   '), list);
});

test('summary and entry text with fallbacks', () => {
  const list = [entryA, entryB, entryC].reduce((acc, item) => recordWeatherDisruption(acc, item), []);
  assert.equal(weatherDisruptionSummaryText(list), '3 weather disruptions across 3 mohallas: 4 visits postponed, 3 faults attributed.');
  assert.equal(weatherDisruptionSummaryText([]), 'No weather disruptions recorded.');
  assert.equal(
    weatherDisruptionText(entryB),
    'Thunderstorm on 2026-07-12. Mohallas affected: Mohalla C. Visits postponed: Visit 3. Faults attributed: No faults attributed.'
  );
});

test('HTML escapes markup and CSV has the right filename', () => {
  const nasty = { id: 'w9', date: '2026-07-12', weather: '<Storm & rain>', mohallas: ['<Mohalla>'], visitsPostponed: ['Visit 1'] };
  const html = weatherDisruptionHtml(nasty);
  assert.equal(html.includes('<Storm'), false);
  assert.equal(html.includes('&lt;Storm &amp; rain&gt;'), true);
  const list = [entryA, entryB].reduce((acc, item) => recordWeatherDisruption(acc, item), []);
  const csv = weatherDisruptionCsv(list);
  assert.equal(csv.split('\n')[0], '"id","date","weather","mohallas affected","visits postponed","faults attributed","annotations"');
  assert.equal(csv.includes('w1'), true);
  assert.equal(weatherDisruptionFilename(), 'weather-disruption-log.csv');
});

test('list normalisation keeps the first record per id', () => {
  const list = normalizeWeatherDisruptionList([entryA, { ...entryA, weather: 'Changed' }, entryB]);
  assert.deepEqual(list.map((item) => item.id), ['w1', 'w2']);
  assert.equal(list[0].weather, 'Heavy rain and storm');
});

test('purity fence: no storage, clock, or network access', () => {
  const source = fs.readFileSync(new URL('../weather-disruption.js', import.meta.url), 'utf8');
  assert.equal(/localStorage|sessionStorage|new Date\(|Date\.now\(|fetch\(|XMLHttpRequest/.test(source), false);
});

test('neighbour-module fence: the seasonal risk note is never imported', () => {
  const source = fs.readFileSync(new URL('../weather-disruption.js', import.meta.url), 'utf8');
  assert.equal(/import\s/.test(source), false);
  assert.equal(source.includes('seasonal-risk'), false);
});

test('panel ids are present in index.html', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['wdHeading', 'wdSummary', 'wdExportBtn', 'wdDate', 'wdWeather', 'wdMohallas', 'wdVisits', 'wdFaults', 'wdSaveBtn', 'wdRemoveId', 'wdRemoveBtn', 'wdFilter', 'wdAnnotateId', 'wdAnnotateDate', 'wdAnnotateNote', 'wdAnnotateBtn', 'wdBody']) {
    assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
  }
});

test('app.js wiring imports the weather disruption module', () => {
  const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './weather-disruption.js'"), true);
  assert.equal(source.includes('renderWeatherDisruptions'), true);
});

test('deployment guard: no standalone OLT word added to app.js by this plan', () => {
  const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const matches = source.match(/(?<![A-Za-z])OLT(?![A-Za-z])/g) || [];
  assert.equal(matches.length, 0);
});
