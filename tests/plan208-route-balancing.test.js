import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validRouteLoadDate,
  normalizeRouteLoadRecord,
  normalizeRouteLoadList,
  findRouteLoadRecord,
  recordRouteLoad,
  removeRouteLoad,
  routeLoadsSorted,
  routeLoadsForDate,
  routeLoadsForCollector,
  routeDayView,
  routeDayTotal,
  routeDayImbalance,
  routeDayImbalanceText,
  routeDaySummaryText,
  routeLoadRecordText,
  routeLoadRecordHtml,
  routeLoadAllHtml,
  routeLoadDayHtml,
  routeLoadCsv,
  routeLoadFilename,
} from '../route-balancing.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'route-balancing.js'), 'utf8');

const loadA = { id: 'RB-1', date: '2026-11-02', collector: 'Saad', mohallas: ['BANII', 'KISHTII'], stopsPlanned: 18, estimatedVisits: 20, note: 'Far round' };
const loadB = { id: 'RB-2', date: '2026-11-02', collector: 'Aqib', mohallas: ['CHAMYAAA'], stopsPlanned: 8 };
const loadC = { id: 'RB-3', date: '2026-11-03', collector: 'Saad', mohallas: ['BANII'], stopsPlanned: 12 };

test('half-formed route-load records are refused', () => {
  assert.equal(normalizeRouteLoadRecord({ date: '2026-11-02', collector: 'Saad', mohallas: ['BANII'], stopsPlanned: 5 }), null);
  assert.equal(normalizeRouteLoadRecord({ id: 'RB-9', collector: 'Saad', mohallas: ['BANII'], stopsPlanned: 5 }), null);
  assert.equal(normalizeRouteLoadRecord({ id: 'RB-9', date: '2026-11-02', mohallas: ['BANII'], stopsPlanned: 5 }), null);
  assert.equal(normalizeRouteLoadRecord({ id: 'RB-9', date: '2026-11-02', collector: 'Saad', mohallas: [], stopsPlanned: 5 }), null);
  assert.equal(normalizeRouteLoadRecord({ id: 'RB-9', date: '2026-11-02', collector: 'Saad', mohallas: ['BANII'] }), null);
  assert.equal(normalizeRouteLoadRecord({ id: 'RB-9', date: '2026-11-02', collector: 'Saad', mohallas: ['BANII'], stopsPlanned: -1 }), null);
  assert.equal(normalizeRouteLoadRecord({ id: 'RB-9', date: '2026-11-02', collector: 'Saad', mohallas: ['BANII'], stopsPlanned: 2.5 }), null);
  assert.equal(normalizeRouteLoadRecord({ id: 'RB-9', date: '2026-11-02', collector: 'Saad', mohallas: ['BANII'], stopsPlanned: 'many' }), null);
  assert.equal(normalizeRouteLoadRecord(null), null);
});

test('strict dates: impossible calendar dates are refused', () => {
  assert.equal(validRouteLoadDate('2026-02-30'), false);
  assert.equal(validRouteLoadDate('2026-02-29'), false);
  assert.equal(validRouteLoadDate('2024-02-29'), true);
  assert.equal(validRouteLoadDate('2026-11-02'), true);
  assert.equal(validRouteLoadDate('2026-13-01'), false);
  assert.equal(validRouteLoadDate('02-11-2026'), false);
  assert.equal(normalizeRouteLoadRecord({ ...loadA, date: '2026-02-30' }), null);
});

test('unknown fields are dropped and empty mohallas are cleaned', () => {
  const record = normalizeRouteLoadRecord({ ...loadA, routeOrder: ['BANII'], paymentTotal: 9000, mohallas: ['  BANII  ', '', 'KISHTII'] });
  assert.equal(record.routeOrder, undefined);
  assert.equal(record.paymentTotal, undefined);
  assert.deepEqual(record.mohallas, ['BANII', 'KISHTII']);
  assert.equal(record.estimatedVisits, 20);
  assert.equal(normalizeRouteLoadRecord({ ...loadA, estimatedVisits: 'soon' }).estimatedVisits, null);
});

test('zero planned stops is a valid load record', () => {
  const record = normalizeRouteLoadRecord({ ...loadA, stopsPlanned: 0 });
  assert.equal(record.stopsPlanned, 0);
});

test('duplicate ids are never rewritten', () => {
  const next = recordRouteLoad([loadA], { ...loadA, stopsPlanned: 99 });
  assert.equal(next.length, 1);
  assert.equal(next[0].stopsPlanned, 18);
});

test('one record per collector per day: a second record for the same collector and date is refused', () => {
  const next = recordRouteLoad([loadA], { id: 'RB-9', date: '2026-11-02', collector: 'saad', mohallas: ['BANII'], stopsPlanned: 3 });
  assert.equal(next.length, 1);
  const otherDay = recordRouteLoad([loadA], { ...loadC, id: 'RB-9' });
  assert.equal(otherDay.length, 2);
});

test('find and remove work by id', () => {
  assert.equal(findRouteLoadRecord([loadA, loadB], 'RB-2').collector, 'Aqib');
  assert.equal(findRouteLoadRecord([loadA], 'RB-9'), null);
  assert.equal(findRouteLoadRecord([loadA], ''), null);
  assert.deepEqual(removeRouteLoad([loadA, loadB], 'RB-1').map((r) => r.id), ['RB-2']);
});

test('sorting is date, then collector A-Z, then id', () => {
  const sorted = routeLoadsSorted([loadC, loadB, loadA]);
  assert.deepEqual(sorted.map((r) => r.id), ['RB-2', 'RB-1', 'RB-3']);
});

test('date filter returns only that day, sorted', () => {
  assert.deepEqual(routeLoadsForDate([loadA, loadB, loadC], '2026-11-02').map((r) => r.id), ['RB-2', 'RB-1']);
  assert.deepEqual(routeLoadsForDate([loadA], '2026-02-30'), []);
  assert.deepEqual(routeLoadsForDate([loadA], '2026-11-09'), []);
});

test('collector filter is a case-insensitive substring', () => {
  assert.deepEqual(routeLoadsForCollector([loadA, loadB, loadC], 'saa').map((r) => r.id), ['RB-1', 'RB-3']);
  assert.deepEqual(routeLoadsForCollector([loadA, loadB], '').map((r) => r.id), ['RB-2', 'RB-1']);
});

test('day view shows each collector side by side, collectors A-Z', () => {
  const view = routeDayView([loadA, loadB, loadC], '2026-11-02');
  assert.equal(view.length, 2);
  assert.equal(view[0].collector, 'Aqib');
  assert.equal(view[1].collector, 'Saad');
  assert.deepEqual(view[1].mohallas, ['BANII', 'KISHTII']);
  assert.deepEqual(routeDayView([loadA], '2026-11-09'), []);
});

test('day total is the plain sum of the day view planned stops', () => {
  assert.equal(routeDayTotal([loadA, loadB, loadC], '2026-11-02'), 26);
  assert.equal(routeDayTotal([loadA], '2026-11-09'), 0);
});

test('imbalance is flagged only when one collector carries more than twice another', () => {
  const flagged = routeDayImbalance([loadA, loadB], '2026-11-02');
  assert.equal(flagged.flagged, true);
  assert.equal(flagged.maxCollector, 'Saad');
  assert.equal(flagged.maxStops, 18);
  assert.equal(flagged.minCollector, 'Aqib');
  assert.equal(flagged.minStops, 8);
  const exactlyTwice = routeDayImbalance([
    { id: 'RB-1', date: '2026-11-02', collector: 'Saad', mohallas: ['BANII'], stopsPlanned: 16 },
    { id: 'RB-2', date: '2026-11-02', collector: 'Aqib', mohallas: ['CHAMYAAA'], stopsPlanned: 8 },
  ], '2026-11-02');
  assert.equal(exactlyTwice, null);
});

test('imbalance needs at least two collectors and is not flagged when all stops are zero', () => {
  assert.equal(routeDayImbalance([loadA], '2026-11-02'), null);
  assert.equal(routeDayImbalance([
    { id: 'RB-1', date: '2026-11-02', collector: 'Saad', mohallas: ['BANII'], stopsPlanned: 0 },
    { id: 'RB-2', date: '2026-11-02', collector: 'Aqib', mohallas: ['CHAMYAAA'], stopsPlanned: 0 },
  ], '2026-11-02'), null);
});

test('imbalance and summary texts name the collectors and the totals', () => {
  assert.match(routeDayImbalanceText([loadA, loadB], '2026-11-02'), /Saad carries 18 stops, more than twice Aqib's 8 stops/);
  assert.equal(routeDayImbalanceText([loadB, loadC], '2026-11-02'), '');
  assert.equal(routeDaySummaryText([loadA, loadB], '2026-11-02'), '2026-11-02: 2 collectors, 26 planned stops.');
  assert.equal(routeDaySummaryText([loadA], '2026-11-09'), 'No route load recorded for 2026-11-09.');
  assert.match(routeDaySummaryText([loadA], 'not-a-date'), /real date/);
});

test('record text shows mohallas, stops, visits and note', () => {
  assert.equal(routeLoadRecordText(loadA), '2026-11-02: Saad — BANII, KISHTII — 18 planned stops, 20 estimated visits — Far round');
  assert.equal(routeLoadRecordText(loadB), '2026-11-02: Aqib — CHAMYAAA — 8 planned stops');
  assert.equal(routeLoadRecordText(null), '');
});

test('html output escapes markup in typed fields', () => {
  const html = routeLoadRecordHtml({ ...loadA, collector: '<b>Saad</b>', note: 'a & b' });
  assert.doesNotMatch(html, /<b>Saad<\/b>/);
  assert.match(html, /&lt;b&gt;Saad&lt;\/b&gt;/);
  assert.match(html, /a &amp; b/);
  assert.match(routeLoadAllHtml([loadA]), /Saad/);
  assert.match(routeLoadDayHtml([loadA, loadB], '2026-11-02'), /Aqib/);
});

test('csv export and filename', () => {
  const csv = routeLoadCsv([loadA, loadB]);
  assert.match(csv, /^id,date,collector,mohallas,stopsPlanned,estimatedVisits,note\n/);
  assert.match(csv, /RB-1,2026-11-02,Saad,BANII; KISHTII,18,20,Far round/);
  assert.match(csv, /RB-2,2026-11-02,Aqib,CHAMYAAA,8,,/);
  assert.equal(routeLoadFilename(), 'route-load.csv');
});

test('inputs are never mutated', () => {
  const input = { ...loadA, mohallas: ['BANII', 'KISHTII'] };
  const before = JSON.stringify(input);
  normalizeRouteLoadRecord(input);
  recordRouteLoad([loadA], loadC);
  assert.equal(JSON.stringify(input), before);
  const view = routeDayView([loadA], '2026-11-02');
  view[0].mohallas.push('CHANGED');
  assert.deepEqual(loadA.mohallas, ['BANII', 'KISHTII']);
});

test('list normalization keeps the first record for a duplicate id or collector-day', () => {
  const list = normalizeRouteLoadList([loadA, { ...loadA, stopsPlanned: 99 }, loadB]);
  assert.equal(list.length, 2);
  assert.equal(list[0].stopsPlanned, 18);
});

test('purity fence: the module is import-free and touches no storage, clock, or network', () => {
  assert.doesNotMatch(moduleSrc, /^import\s/m);
  assert.doesNotMatch(moduleSrc, /localStorage|fetch\(|Date\.now|new Date\(/);
});

test('panel element ids are present in index.html', () => {
  for (const id of ['rbSummary', 'rbExportBtn', 'rbCollector', 'rbDate', 'rbMohallas', 'rbStops', 'rbVisits', 'rbNote', 'rbSaveBtn', 'rbRemoveId', 'rbRemoveBtn', 'rbCollectorFilter', 'rbBody', 'rbDayDate', 'rbDayBtn', 'rbDayBody', 'rbDayTotal', 'rbImbalanceBody']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring mentions the route-load store and render function', () => {
  assert.match(appJs, /shahdara_route_load_v1/);
  assert.match(appJs, /renderRouteLoad\(\)/);
  assert.match(appJs, /route-balancing\.js/);
});

test('deployment guard: no standalone OLT word added to app.js by this plan', () => {
  assert.doesNotMatch(appJs, /(?<![A-Za-z])OLT(?![A-Za-z])/);
});
