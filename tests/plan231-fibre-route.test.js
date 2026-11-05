import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validFibreRouteDate,
  normalizeFibreRouteList,
  recordFibreRoute,
  removeFibreRoute,
  findFibreRoute,
  addFibreRouteFollowup,
  fibreRoutesSorted,
  fibreRoutesForMohalla,
  fibreRouteSummaryText,
  fibreRouteText,
  fibreRouteHtml,
  fibreRouteCsv,
  fibreRouteFilename,
} from '../fibre-route.js';

const dir = dirname(fileURLToPath(import.meta.url));
const moduleSrc = readFileSync(join(dir, '..', 'fibre-route.js'), 'utf8');
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');

const r1 = { id: 'FR-1', segmentId: 'SEG-A', startPoint: 'Main Chowk', endPoint: 'Masjid Gali', poles: ['Pole 4', 'Pole 5'], cabinets: ['Cabinet North'], mohalla: 'Mohalla North', note: 'Overhead run along the main street.' };
const r2 = { id: 'FR-2', segmentId: 'SEG-B', startPoint: 'School Mor', endPoint: 'Bazaar End', poles: [], cabinets: [], mohalla: 'Mohalla South', note: '' };

test('half-formed refusal, including no mohalla and no end point', () => {
  assert.equal(recordFibreRoute([], { segmentId: 'SEG-X', startPoint: 'A', endPoint: 'B', mohalla: 'M' }), null);
  assert.equal(recordFibreRoute([], { id: 'FR-x', startPoint: 'A', endPoint: 'B', mohalla: 'M' }), null);
  assert.equal(recordFibreRoute([], { id: 'FR-x', segmentId: 'SEG-X', endPoint: 'B', mohalla: 'M' }), null);
  assert.equal(recordFibreRoute([], { id: 'FR-x', segmentId: 'SEG-X', startPoint: 'A', mohalla: 'M' }), null);
  assert.equal(recordFibreRoute([], { id: 'FR-x', segmentId: 'SEG-X', startPoint: 'A', endPoint: 'B' }), null);
});

test('strict dates on follow-up notes', () => {
  assert.equal(validFibreRouteDate('2026-02-30'), false);
  assert.equal(validFibreRouteDate('2024-02-29'), true);
  assert.equal(validFibreRouteDate('2026-02-29'), false);
  assert.equal(validFibreRouteDate('2026-13-01'), false);
  const withBadFollowup = normalizeFibreRouteList([{ ...r1, followups: [{ date: '2026-02-30', note: 'Checked again.' }] }]);
  assert.equal(withBadFollowup[0].followups.length, 0);
  const withGoodFollowup = normalizeFibreRouteList([{ ...r1, followups: [{ date: '2024-02-29', note: 'Checked again.' }] }]);
  assert.equal(withGoodFollowup[0].followups.length, 1);
});

test('unknown-field drop and non-mutation', () => {
  const input = { ...r1, billTotal: 5000, faultId: 'F-9' };
  const next = recordFibreRoute([], input);
  assert.equal(next.length, 1);
  assert.equal('billTotal' in next[0], false);
  assert.equal('faultId' in next[0], false);
  assert.deepEqual(input.poles, ['Pole 4', 'Pole 5']);
  assert.equal(input.followups, undefined);
});

test('duplicate id and duplicate segment rules', () => {
  const one = recordFibreRoute([], r1);
  assert.equal(recordFibreRoute(one, { ...r2, id: 'FR-1' }), null);
  assert.equal(recordFibreRoute(one, { ...r2, segmentId: 'SEG-A' }), null);
  assert.equal(normalizeFibreRouteList([r1, { ...r2, segmentId: 'SEG-A' }]).length, 1);
  assert.equal(normalizeFibreRouteList([r1, { ...r2, id: 'FR-1' }]).length, 1);
});

test('find and remove', () => {
  const list = recordFibreRoute(recordFibreRoute([], r1), r2);
  assert.equal(findFibreRoute(list, 'FR-2').segmentId, 'SEG-B');
  assert.equal(findFibreRoute(list, 'FR-9'), null);
  assert.equal(findFibreRoute(list, ''), null);
  assert.equal(removeFibreRoute(list, 'FR-1').length, 1);
  assert.equal(removeFibreRoute(list, 'FR-9').length, 2);
  assert.equal(removeFibreRoute(list, '').length, 2);
});

test('sorting by mohalla, then segment, then id', () => {
  const sorted = fibreRoutesSorted([r2, r1]);
  assert.deepEqual(sorted.map((item) => item.id), ['FR-1', 'FR-2']);
  const sameMohalla = fibreRoutesSorted([
    { ...r1, id: 'FR-9', segmentId: 'SEG-Z' },
    { ...r1, id: 'FR-8', segmentId: 'SEG-A' },
  ]);
  assert.deepEqual(sameMohalla.map((item) => item.id), ['FR-8', 'FR-9']);
});

test('segments listed by mohalla', () => {
  const list = recordFibreRoute(recordFibreRoute([], r1), r2);
  assert.deepEqual(fibreRoutesForMohalla(list, 'north').map((item) => item.id), ['FR-1']);
  assert.deepEqual(fibreRoutesForMohalla(list, 'MOHALLA').map((item) => item.id), ['FR-1', 'FR-2']);
  assert.deepEqual(fibreRoutesForMohalla(list, 'East'), []);
  assert.deepEqual(fibreRoutesForMohalla(list, '').map((item) => item.id), ['FR-1', 'FR-2']);
});

test('correction only by dated follow-up note, never by silent edit', () => {
  const list = recordFibreRoute([], r1);
  const noted = addFibreRouteFollowup(list, 'FR-1', '2026-03-02', 'Pole 5 replaced after storm.');
  assert.equal(noted[0].followups.length, 1);
  assert.equal(noted[0].followups[0].date, '2026-03-02');
  assert.equal(noted[0].startPoint, 'Main Chowk');
  assert.equal(noted[0].endPoint, 'Masjid Gali');
  assert.deepEqual(noted[0].poles, ['Pole 4', 'Pole 5']);
  assert.equal(noted[0].mohalla, 'Mohalla North');
  assert.equal(addFibreRouteFollowup(list, 'FR-1', '2026-02-30', 'Bad date.'), null);
  assert.equal(addFibreRouteFollowup(list, 'FR-1', '2026-03-02', '   '), null);
  assert.equal(addFibreRouteFollowup(list, 'FR-9', '2026-03-02', 'No such route.'), null);
  assert.equal(list[0].followups.length, 0);
});

test('recording never changes existing records: before and after listing', () => {
  const before = recordFibreRoute([], r1);
  const beforeSnapshot = JSON.parse(JSON.stringify(before));
  const after = recordFibreRoute(before, r2);
  assert.deepEqual(after[0], beforeSnapshot[0]);
  assert.equal(after.length, 2);
});

test('poles and cabinets accept comma-separated text', () => {
  const record = normalizeFibreRouteList([{ ...r1, poles: 'Pole 4, Pole 5 ', cabinets: 'Cabinet North' }])[0];
  assert.deepEqual(record.poles, ['Pole 4', 'Pole 5']);
  assert.deepEqual(record.cabinets, ['Cabinet North']);
  const empty = normalizeFibreRouteList([{ ...r2, poles: ' , ', cabinets: null }])[0];
  assert.deepEqual(empty.poles, []);
  assert.deepEqual(empty.cabinets, []);
});

test('summary text and route text with fallbacks', () => {
  const list = recordFibreRoute(recordFibreRoute([], r1), r2);
  assert.equal(fibreRouteSummaryText(list), '2 route segments across 2 mohallas, 0 dated follow-up notes.');
  assert.equal(fibreRouteSummaryText([r1]), '1 route segment across 1 mohalla, 0 dated follow-up notes.');
  assert.ok(fibreRouteText(r1).includes('Segment SEG-A: Main Chowk to Masjid Gali, mohalla Mohalla North.'));
  assert.ok(fibreRouteText(r1).includes('Poles: Pole 4, Pole 5'));
  assert.ok(fibreRouteText(r2).includes('No poles listed.'));
  assert.ok(fibreRouteText(r2).includes('No cabinets listed.'));
  assert.ok(fibreRouteText(r2).includes('No note.'));
  assert.equal(fibreRouteText(null), '');
  const noted = addFibreRouteFollowup(list, 'FR-1', '2026-03-02', 'Pole 5 replaced after storm.');
  assert.ok(fibreRouteText(noted[0]).includes('Follow-up 2026-03-02: Pole 5 replaced after storm.'));
  assert.equal(fibreRouteSummaryText(noted), '2 route segments across 2 mohallas, 1 dated follow-up note.');
});

test('HTML escaping', () => {
  const nasty = { ...r1, startPoint: '<b>Main</b> Chowk', note: '<script>alert(1)</script>' };
  const html = fibreRouteHtml(nasty);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;b&gt;Main&lt;/b&gt; Chowk'), true);
  assert.equal(fibreRouteHtml(null), '');
});

test('CSV and filename', () => {
  const csv = fibreRouteCsv([r2, r1]);
  assert.ok(csv.startsWith('segment_id,start_point,end_point,mohalla,poles,cabinets,note,followups'));
  assert.ok(csv.includes('SEG-A,Main Chowk,Masjid Gali,Mohalla North'));
  assert.equal(fibreRouteFilename(), 'fibre-routes.csv');
});

test('purity fence: no storage, clock, or network in the module', () => {
  assert.equal(/localStorage|sessionStorage/.test(moduleSrc), false);
  assert.equal(/new Date\(|Date\.now\(/.test(moduleSrc), false);
  assert.equal(/fetch\(|XMLHttpRequest/.test(moduleSrc), false);
});

test('neighbour-module fence: route sequencing, proof, and diary are not read or rewritten', () => {
  assert.equal(/route-sequencing|route-proof|segment-diary/.test(moduleSrc), false);
  assert.equal(/import /.test(moduleSrc), false);
});

test('panel ids present in index.html', () => {
  for (const id of ['frBody', 'frSummary', 'frSegment', 'frStart', 'frEnd', 'frPoles', 'frCabinets', 'frMohalla', 'frNote', 'frSaveBtn', 'frFollowupId', 'frFollowupDate', 'frFollowupNote', 'frFollowupBtn', 'frRemoveId', 'frRemoveBtn', 'frFilter', 'frExportBtn']) {
    assert.ok(indexHtml.includes(`id="${id}"`), `missing index.html id ${id}`);
  }
});

test('app.js wiring', () => {
  assert.ok(appJs.includes("from './fibre-route.js'"));
  assert.ok(appJs.includes('renderFibreRoutes()'));
  assert.ok(appJs.includes('shahdara_fibre_routes_v1'));
});

test('deployment guard: no standalone OLT word added to app.js', () => {
  const standalone = appJs.match(/(?<![A-Za-z])OLT(?![A-Za-z])/g) || [];
  assert.equal(standalone.length, 0);
});
