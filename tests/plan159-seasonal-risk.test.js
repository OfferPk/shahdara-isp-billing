import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeSeasonalRisk,
  normalizeSeasonalRiskList,
  findSeasonalRisk,
  upsertSeasonalRisk,
  removeSeasonalRisk,
  seasonRisks,
  seasonalRiskSeasons,
  seasonalRiskSummaryText,
  seasonalRiskAllHtml,
  seasonalRiskSeasonHtml,
  seasonalRiskCsv,
  seasonalRiskFilename,
} from '../seasonal-risk.js';

const dir = dirname(fileURLToPath(import.meta.url));

const note = (over = {}) => ({
  id: 'SR-1',
  season: 'monsoon',
  risk: 'Low drop cable sags in rain',
  area: 'Mohalla A',
  action: 'Tighten slack before June',
  ...over,
});

test('half-formed refusal: no season, no area, no risk, or no id refused', () => {
  assert.equal(normalizeSeasonalRisk(note({ season: '' })), null);
  assert.equal(normalizeSeasonalRisk(note({ season: '   ' })), null);
  assert.equal(normalizeSeasonalRisk(note({ area: '' })), null);
  assert.equal(normalizeSeasonalRisk(note({ risk: '' })), null);
  assert.equal(normalizeSeasonalRisk(note({ id: '' })), null);
  assert.equal(normalizeSeasonalRisk(null), null);
  assert.equal(normalizeSeasonalRisk('nope'), null);
});

test('preparedness action is optional, whitespace is trimmed', () => {
  const noAction = normalizeSeasonalRisk(note({ action: undefined }));
  assert.equal(noAction.action, '');
  const trimmed = normalizeSeasonalRisk(note({ season: '  monsoon ', area: ' Mohalla A ' }));
  assert.equal(trimmed.season, 'monsoon');
  assert.equal(trimmed.area, 'Mohalla A');
});

test('unknown fields are dropped, never stored', () => {
  const clean = normalizeSeasonalRisk(note({ billId: 'B-9', payment: 500, outageId: 'O-1' }));
  assert.equal('billId' in clean, false);
  assert.equal('payment' in clean, false);
  assert.equal('outageId' in clean, false);
  assert.deepEqual(Object.keys(clean).sort(), ['action', 'area', 'id', 'risk', 'season']);
});

test('duplicate ids never rewritten', () => {
  const list = [note()];
  assert.equal(upsertSeasonalRisk(list, note()).length, 1);
  assert.deepEqual(upsertSeasonalRisk(list, note()), [note()]);
  const changed = upsertSeasonalRisk(list, note({ risk: 'Different risk' }));
  assert.equal(changed.length, 1);
  assert.equal(changed[0].risk, 'Low drop cable sags in rain');
  assert.equal(upsertSeasonalRisk(list, note({ season: '' })).length, 1);
});

test('find and remove by id', () => {
  const list = [note(), note({ id: 'SR-2', season: 'summer', area: 'Mohalla B' })];
  assert.equal(findSeasonalRisk(list, 'SR-2').area, 'Mohalla B');
  assert.equal(findSeasonalRisk(list, 'SR-9'), null);
  assert.equal(findSeasonalRisk(list, '  '), null);
  assert.deepEqual(removeSeasonalRisk(list, 'SR-1').map((item) => item.id), ['SR-2']);
  assert.equal(removeSeasonalRisk(list, 'SR-9').length, 2);
});

test('season view: case-insensitive match, area A-Z then id A-Z', () => {
  const list = [
    note({ id: 'SR-3', season: 'Monsoon', area: 'Mohalla C' }),
    note({ id: 'SR-1', season: 'monsoon', area: 'Mohalla B' }),
    note({ id: 'SR-2', season: 'MONSOON', area: 'Mohalla B' }),
    note({ id: 'SR-4', season: 'summer', area: 'Mohalla A' }),
  ];
  assert.deepEqual(seasonRisks(list, 'monsoon').map((item) => item.id), ['SR-1', 'SR-2', 'SR-3']);
  assert.deepEqual(seasonRisks(list, '  Monsoon ').map((item) => item.id), ['SR-1', 'SR-2', 'SR-3']);
  assert.deepEqual(seasonRisks(list, 'winter'), []);
  assert.deepEqual(seasonRisks(list, ''), []);
  assert.deepEqual(seasonRisks(list, '   '), []);
});

test('seasons list: first spelling kept, sorted A-Z', () => {
  const list = [
    note({ id: 'SR-1', season: 'Summer' }),
    note({ id: 'SR-2', season: 'monsoon' }),
    note({ id: 'SR-3', season: 'MONSOON' }),
    note({ id: 'SR-4', season: 'winter' }),
  ];
  assert.deepEqual(seasonalRiskSeasons(list), ['monsoon', 'Summer', 'winter']);
  assert.deepEqual(seasonalRiskSeasons('not a list'), []);
});

test('summary text counts notes, seasons, and areas', () => {
  assert.equal(
    seasonalRiskSummaryText([note(), note({ id: 'SR-2', season: 'summer', area: 'Mohalla A' })]),
    '2 seasonal risk notes across 2 seasons and 1 area.',
  );
  assert.equal(seasonalRiskSummaryText([note()]), '1 seasonal risk note across 1 season and 1 area.');
  assert.equal(seasonalRiskSummaryText([]), '0 seasonal risk notes across 0 seasons and 0 areas.');
});

test('all HTML: season A-Z, then area A-Z, empty state plain', () => {
  assert.equal(seasonalRiskAllHtml([]), '<p>No seasonal risk notes recorded yet.</p>');
  const html = seasonalRiskAllHtml([
    note({ id: 'SR-2', season: 'summer', area: 'Mohalla B' }),
    note({ id: 'SR-1', season: 'monsoon', area: 'Mohalla A' }),
  ]);
  assert.ok(html.indexOf('monsoon') < html.indexOf('summer'));
  assert.ok(html.includes('Tighten slack before June'));
});

test('season HTML shows risks with actions, empty season plain', () => {
  assert.equal(seasonalRiskSeasonHtml([], 'monsoon'), '<p>No risks recorded for this season yet.</p>');
  const html = seasonalRiskSeasonHtml([note(), note({ id: 'SR-2', season: 'summer' })], 'monsoon');
  assert.ok(html.includes('Low drop cable sags in rain'));
  assert.ok(html.includes('Tighten slack before June'));
  assert.ok(!html.includes('SR-2'));
});

test('HTML escaping: markup in fields never renders as markup', () => {
  const html = seasonalRiskAllHtml([note({ risk: '<script>alert(1)</script>', area: 'A & B' })]);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('A &amp; B'));
});

test('CSV and filename: header, rows, quoting', () => {
  assert.equal(seasonalRiskFilename(), 'seasonal-risks.csv');
  const csv = seasonalRiskCsv([note(), note({ id: 'SR-2', risk: 'Heat, "bake" risk' })]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,season,risk,area,action');
  assert.equal(lines[1], 'SR-1,monsoon,Low drop cable sags in rain,Mohalla A,Tighten slack before June');
  assert.ok(lines[2].includes('"Heat, ""bake"" risk"'));
  assert.equal(seasonalRiskCsv([]), 'id,season,risk,area,action');
});

test('inputs are never mutated', () => {
  const input = note();
  const snapshot = { ...input };
  upsertSeasonalRisk([note({ id: 'SR-0' })], input);
  removeSeasonalRisk([input], 'SR-1');
  seasonRisks([input], 'monsoon');
  assert.deepEqual(input, snapshot);
  const list = [note({ id: 'SR-2' }), note({ id: 'SR-1' })];
  const before = list.map((item) => item.id);
  seasonalRiskAllHtml(list);
  assert.deepEqual(list.map((item) => item.id), before);
});

test('normalize list drops half-formed records and keeps order', () => {
  const list = normalizeSeasonalRiskList([note({ id: 'SR-2' }), note({ season: '' }), note({ id: 'SR-1' })]);
  assert.deepEqual(list.map((item) => item.id), ['SR-2', 'SR-1']);
  assert.deepEqual(normalizeSeasonalRiskList(null), []);
  assert.deepEqual(normalizeSeasonalRiskList('nope'), []);
});

test('purity fence: module imports nothing and reads no storage, clock, or network', () => {
  const source = readFileSync(join(dir, '..', 'seasonal-risk.js'), 'utf8');
  assert.ok(!/^\s*import\s/m.test(source));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('sessionStorage'));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('Date.now'));
  assert.ok(!source.includes('new Date('));
});

test('panel ids present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['seasonalRiskSeason', 'seasonalRiskRisk', 'seasonalRiskArea', 'seasonalRiskAction', 'seasonalRiskSaveBtn', 'seasonalRiskRemoveId', 'seasonalRiskRemoveBtn', 'seasonalRiskFilter', 'seasonalRiskSeasonBody', 'seasonalRiskBody', 'seasonalRiskSummary', 'seasonalRiskExportBtn']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
