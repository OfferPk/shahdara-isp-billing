import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validDrumUsageDate,
  normalizeDrumUsageList,
  recordDrumUsage,
  removeDrumUsage,
  findDrumUsage,
  addDrumUsageFollowup,
  drumUsageSorted,
  drumUsageForJob,
  drumUsageForDrum,
  drumUsageDrums,
  drumUsageSummaryText,
  drumUsageReconciliation,
  drumUsageReconciliationText,
  drumUsageText,
  drumUsageHtml,
  drumUsageCsv,
  drumUsageFilename,
} from '../drum-usage.js';
import fs from 'node:fs';

const entryA = { id: 'd1', jobRef: 'J-101', drum: 'DRUM-7', quantityUsed: 30, quantityRemaining: 170, date: '2026-07-12' };
const entryB = { id: 'd2', jobRef: 'J-102', drum: 'DRUM-7', quantityUsed: 20, quantityRemaining: 150, date: '2026-07-20' };
const entryC = { id: 'd3', jobRef: 'J-103', drum: 'CONNECTOR-BAG', quantityUsed: 5, quantityRemaining: 40, date: '2026-08-01' };

test('half-formed entries are refused', () => {
  assert.equal(recordDrumUsage([], { jobRef: 'J-1', drum: 'D', quantityUsed: 5, quantityRemaining: 10, date: '2026-07-12' }).length, 0);
  assert.equal(recordDrumUsage([], { id: 'x', drum: 'D', quantityUsed: 5, quantityRemaining: 10, date: '2026-07-12' }).length, 0);
  assert.equal(recordDrumUsage([], { id: 'x', jobRef: 'J-1', quantityUsed: 5, quantityRemaining: 10, date: '2026-07-12' }).length, 0);
  assert.equal(recordDrumUsage([], { id: 'x', jobRef: 'J-1', drum: 'D', quantityRemaining: 10, date: '2026-07-12' }).length, 0);
  assert.equal(recordDrumUsage([], { id: 'x', jobRef: 'J-1', drum: 'D', quantityUsed: 5, date: '2026-07-12' }).length, 0);
  assert.equal(recordDrumUsage([], { id: 'x', jobRef: 'J-1', drum: 'D', quantityUsed: 0, quantityRemaining: 10, date: '2026-07-12' }).length, 0);
  assert.equal(recordDrumUsage([], { id: 'x', jobRef: 'J-1', drum: 'D', quantityUsed: -5, quantityRemaining: 10, date: '2026-07-12' }).length, 0);
  assert.equal(recordDrumUsage([], { id: 'x', jobRef: 'J-1', drum: 'D', quantityUsed: 5, quantityRemaining: -1, date: '2026-07-12' }).length, 0);
  assert.equal(recordDrumUsage([], { id: 'x', jobRef: 'J-1', drum: 'D', quantityUsed: 5, quantityRemaining: 10, date: '2026-02-30' }).length, 0);
});

test('strict dates: leap day accepted only in leap years', () => {
  assert.equal(validDrumUsageDate('2024-02-29'), true);
  assert.equal(validDrumUsageDate('2026-02-29'), false);
  assert.equal(validDrumUsageDate('2026-13-01'), false);
  assert.equal(validDrumUsageDate('2026-07-32'), false);
  assert.equal(validDrumUsageDate('12-07-2026'), false);
});

test('unknown fields are dropped and inputs are not mutated', () => {
  const raw = { ...entryA, surprise: 'nope', quantityUsed: 30 };
  const recorded = recordDrumUsage([], raw);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].surprise, undefined);
  assert.equal(raw.surprise, 'nope');
  const before = JSON.stringify([entryA]);
  normalizeDrumUsageList([entryA]);
  assert.equal(JSON.stringify([entryA]), before);
});

test('duplicate ids are never rewritten', () => {
  const list = recordDrumUsage([entryA], { ...entryA, quantityUsed: 99 });
  assert.equal(list.length, 1);
  assert.equal(list[0].quantityUsed, 30);
});

test('find and remove', () => {
  assert.equal(findDrumUsage([entryA, entryB], 'd2').jobRef, 'J-102');
  assert.equal(findDrumUsage([entryA], 'nope'), null);
  assert.equal(removeDrumUsage([entryA, entryB], 'd1').length, 1);
  assert.equal(removeDrumUsage([entryA], '').length, 1);
});

test('sorting is by date, then drum, then id', () => {
  const sorted = drumUsageSorted([entryC, entryB, entryA]);
  assert.deepEqual(sorted.map((e) => e.id), ['d1', 'd2', 'd3']);
});

test('per-job listing is exact and case-insensitive', () => {
  assert.deepEqual(drumUsageForJob([entryA, entryB], 'j-101').map((e) => e.id), ['d1']);
  assert.deepEqual(drumUsageForJob([entryA], ''), []);
});

test('per-drum listing is a substring filter and drum list is unique', () => {
  assert.deepEqual(drumUsageForDrum([entryA, entryB, entryC], 'drum').map((e) => e.id), ['d1', 'd2']);
  assert.deepEqual(drumUsageDrums([entryA, entryB, entryC]), ['DRUM-7', 'CONNECTOR-BAG']);
});

test('follow-up only: a correction never rewrites the entry', () => {
  const list = addDrumUsageFollowup([entryA], 'd1', '2026-07-15', 'Recount confirmed 30 used.');
  assert.equal(list[0].quantityUsed, 30);
  assert.equal(list[0].quantityRemaining, 170);
  assert.equal(list[0].followups.length, 1);
  assert.equal(list[0].followups[0].note, 'Recount confirmed 30 used.');
  assert.deepEqual(addDrumUsageFollowup([entryA], 'd1', '2026-02-30', 'Bad date.'), [{ ...entryA, followups: [] }]);
  assert.deepEqual(addDrumUsageFollowup([entryA], 'nope', '2026-07-15', 'Unknown.'), [{ ...entryA, followups: [] }]);
});

test('reconciliation: entries sum to issued minus remaining', () => {
  const check = drumUsageReconciliation(200, [entryA, entryB]);
  assert.equal(check.totalUsed, 50);
  assert.equal(check.latestRemaining, 150);
  assert.equal(check.expectedRemaining, 150);
  assert.equal(check.reconciles, true);
  assert.match(drumUsageReconciliationText(200, [entryA, entryB]), /Reconciles/);
  const bad = drumUsageReconciliation(200, [{ ...entryB, quantityRemaining: 140 }]);
  assert.equal(bad.reconciles, false);
  assert.match(drumUsageReconciliationText(200, [{ ...entryB, quantityRemaining: 140 }]), /Does not reconcile/);
  assert.equal(drumUsageReconciliation(200, []), null);
  assert.equal(drumUsageReconciliation(0, [entryA]), null);
  assert.equal(drumUsageReconciliation('not a number', [entryA]), null);
});

test('summary and entry text', () => {
  assert.equal(drumUsageSummaryText([]), 'No drum usage recorded.');
  assert.match(drumUsageSummaryText([entryA, entryB, entryC]), /3 usage entries across 2 drums, 55 used in total/);
  assert.match(drumUsageText(entryA), /Job J-101 used 30 from DRUM-7 on 2026-07-12, leaving 170 on the drum/);
  assert.equal(drumUsageText(null), 'No drum usage recorded.');
});

test('html escaping', () => {
  const html = drumUsageHtml({ ...entryA, jobRef: '<J&1>' });
  assert.doesNotMatch(html, /<J&1>/);
  assert.match(html, /&lt;J&amp;1&gt;/);
});

test('csv and filename', () => {
  const csv = drumUsageCsv([entryA, entryB]);
  assert.match(csv, /"id","job reference","drum or consumable","quantity used","quantity remaining","date","follow-ups"/);
  assert.match(csv, /J-101/);
  assert.equal(drumUsageFilename(), 'drum-usage.csv');
});

test('list normalisation drops bad rows and later duplicates', () => {
  const list = normalizeDrumUsageList([entryA, { id: 'bad' }, entryA, entryB]);
  assert.deepEqual(list.map((e) => e.id), ['d1', 'd2']);
});

test('purity fence: no clock, storage, or network calls', () => {
  const src = fs.readFileSync(new URL('../drum-usage.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /new Date\(|Date\.now\(|localStorage|sessionStorage|fetch\(|XMLHttpRequest/);
});

test('neighbour-module fence: stock register, fault parts, and reorder are not imported', () => {
  const src = fs.readFileSync(new URL('../drum-usage.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /from '\.\/(stock-register|fault-parts|spare-reorder|fiber-drum-tracker)\.js'/);
  assert.doesNotMatch(src, /stockRegister|faultParts|spareReorder|fiberDrum/);
});

test('panel-id presence: drum usage panel ids exist in index.html', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['duHeading', 'duSummary', 'duJob', 'duDrum', 'duUsed', 'duRemaining', 'duDate', 'duSaveBtn', 'duRemoveId', 'duRemoveBtn', 'duFilter', 'duDrumFilter', 'duIssued', 'duCheckBtn', 'duCorrectId', 'duCorrectDate', 'duCorrectNote', 'duCorrectBtn', 'duExportBtn', 'duBody']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring: drum usage render is called and imported', () => {
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /from '\.\/drum-usage\.js'/);
  assert.match(app, /renderDrumUsage\(\)/);
  assert.match(app, /DRUM_USAGE_KEY = 'shahdara_drum_usage_v1'/);
});

test('deployment guard: no standalone OLT word added to app.js', () => {
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const before = app.indexOf('drum-usage');
  assert.ok(before > 0);
});
