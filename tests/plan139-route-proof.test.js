import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validRouteProofDate,
  splitStopLines,
  normalizeSkippedStop,
  normalizeRouteProof,
  normalizeRouteProofList,
  findRouteProof,
  upsertRouteProof,
  removeRouteProof,
  routeProofForDay,
  routeProofCounts,
  routeProofFollowups,
  routeProofSummaryText,
  routeProofDayHtml,
  routeProofHtml,
  routeProofFollowupHtml,
  routeProofCsv,
  routeProofFilename,
} from '../route-proof.js';

const dir = dirname(fileURLToPath(import.meta.url));

const proof = (over = {}) => ({
  id: 'RP-1',
  route: 'Bani Morning',
  date: '2026-11-05',
  collector: 'Saad',
  planned: ['Stop A', 'Stop B', 'Stop C'],
  visited: ['Stop A', 'Stop B'],
  skipped: [{ stop: 'Stop C', reason: 'Shop closed' }],
  ...over,
});

test('strict dates: real dates pass, impossible dates refused', () => {
  assert.equal(validRouteProofDate('2026-08-31'), '2026-08-31');
  assert.equal(validRouteProofDate('2026-10-31'), '2026-10-31');
  assert.equal(validRouteProofDate('2026-12-31'), '2026-12-31');
  assert.equal(validRouteProofDate('2024-02-29'), '2024-02-29');
  assert.equal(validRouteProofDate('2026-02-30'), null);
  assert.equal(validRouteProofDate('2026-04-31'), null);
  assert.equal(validRouteProofDate('2026-09-31'), null);
  assert.equal(validRouteProofDate('2026-11-31'), null);
  assert.equal(validRouteProofDate('2026-02-29'), null);
  assert.equal(validRouteProofDate('not-a-date'), null);
  assert.equal(validRouteProofDate(''), null);
});

test('half-formed proofs refused: no id, no route, no date, no planned stop', () => {
  assert.equal(normalizeRouteProof(proof({ id: '' })), null);
  assert.equal(normalizeRouteProof(proof({ route: '   ' })), null);
  assert.equal(normalizeRouteProof(proof({ date: '2026-02-30' })), null);
  assert.equal(normalizeRouteProof(proof({ planned: [] })), null);
  assert.equal(normalizeRouteProof(proof({ planned: ['  '] })), null);
  assert.equal(normalizeRouteProof(null), null);
  assert.equal(normalizeRouteProof('nope'), null);
});

test('partition invariant: visited + skipped sum exactly to planned', () => {
  const clean = normalizeRouteProof(proof());
  assert.deepEqual(routeProofCounts(clean), { planned: 3, visited: 2, skipped: 1 });
  // A planned stop neither visited nor skipped refuses the proof.
  assert.equal(normalizeRouteProof(proof({ visited: ['Stop A'] })), null);
  // A stop both visited and skipped refuses the proof.
  assert.equal(
    normalizeRouteProof(proof({ skipped: [{ stop: 'Stop A', reason: 'Closed' }] })),
    null,
  );
  // A visited stop that was never planned refuses the proof.
  assert.equal(normalizeRouteProof(proof({ visited: ['Stop A', 'Stop B', 'Stop X'] })), null);
  // A skipped stop that was never planned refuses the proof.
  assert.equal(
    normalizeRouteProof(proof({ skipped: [{ stop: 'Stop X', reason: 'Closed' }] })),
    null,
  );
  // A skipped stop with no reason refuses the proof.
  assert.equal(normalizeRouteProof(proof({ skipped: [{ stop: 'Stop C', reason: '' }] })), null);
});

test('skipped stops parse from "stop | reason" strings, and reasonless strings refuse', () => {
  assert.deepEqual(normalizeSkippedStop('Stop C | Shop closed'), { stop: 'Stop C', reason: 'Shop closed' });
  assert.equal(normalizeSkippedStop('Stop C'), null);
  assert.equal(normalizeSkippedStop('Stop C | '), null);
  const clean = normalizeRouteProof(proof({ skipped: ['Stop C | Shop closed'] }));
  assert.deepEqual(clean.skipped, [{ stop: 'Stop C', reason: 'Shop closed' }]);
});

test('splitStopLines: one stop per line, blank lines dropped', () => {
  assert.deepEqual(splitStopLines('Stop A\n\nStop B\n  Stop C  \n'), ['Stop A', 'Stop B', 'Stop C']);
  assert.deepEqual(splitStopLines(['Stop A', ' ', 'Stop B']), ['Stop A', 'Stop B']);
  assert.deepEqual(splitStopLines(null), []);
});

test('duplicate ids never rewritten; identical re-save leaves the list unchanged', () => {
  const base = upsertRouteProof([], proof());
  assert.equal(base.length, 1);
  const same = upsertRouteProof(base, proof());
  assert.equal(same.length, 1);
  assert.deepEqual(same, base);
  const changed = upsertRouteProof(base, proof({ visited: ['Stop A', 'Stop B', 'Stop C'], skipped: [] }));
  assert.equal(changed.length, 1);
  assert.deepEqual(changed, base);
});

test('one proof per route day: a second proof for the same route and date is refused', () => {
  const base = upsertRouteProof([], proof());
  const second = upsertRouteProof(base, proof({ id: 'RP-2' }));
  assert.equal(second.length, 1);
  assert.deepEqual(second, base);
  const otherDay = upsertRouteProof(base, proof({ id: 'RP-2', date: '2026-11-06' }));
  assert.equal(otherDay.length, 2);
  const otherRoute = upsertRouteProof(base, proof({ id: 'RP-3', route: 'Kishti Evening' }));
  assert.equal(otherRoute.length, 2);
});

test('unknown fields dropped: a proof can never grow an outcome, bill, or payment field', () => {
  const clean = normalizeRouteProof(
    proof({ outcome: 'paid', billTotal: 3000, payment: 'cash', ticket: 'T-9' }),
  );
  assert.deepEqual(Object.keys(clean).sort(), [
    'collector',
    'date',
    'id',
    'planned',
    'route',
    'skipped',
    'visited',
  ]);
});

test('inputs are never mutated', () => {
  const raw = proof();
  const snapshot = JSON.stringify(raw);
  normalizeRouteProof(raw);
  upsertRouteProof([], raw);
  assert.equal(JSON.stringify(raw), snapshot);
});

test('find and remove by id', () => {
  const base = upsertRouteProof([], proof());
  assert.equal(findRouteProof(base, 'RP-1').route, 'Bani Morning');
  assert.equal(findRouteProof(base, 'RP-9'), null);
  assert.equal(findRouteProof(base, ''), null);
  assert.deepEqual(removeRouteProof(base, 'RP-1'), []);
  assert.deepEqual(removeRouteProof(base, 'RP-9'), base);
});

test('route day lookup: same route and date only, case-insensitive route', () => {
  const base = upsertRouteProof([], proof());
  assert.equal(routeProofForDay(base, 'bani morning', '2026-11-05').id, 'RP-1');
  assert.equal(routeProofForDay(base, 'Bani Morning', '2026-11-06'), null);
  assert.equal(routeProofForDay(base, 'Other Route', '2026-11-05'), null);
  assert.equal(routeProofForDay(base, '', '2026-11-05'), null);
});

test('follow-up list: only skipped stops, newest day first, then route, then stop', () => {
  const day1 = upsertRouteProof([], proof());
  const day2 = upsertRouteProof(day1, proof({
    id: 'RP-2',
    route: 'Kishti Evening',
    date: '2026-11-06',
    planned: ['Stop Z'],
    visited: [],
    skipped: [{ stop: 'Stop Z', reason: 'No answer' }],
  }));
  const followups = routeProofFollowups(day2);
  assert.equal(followups.length, 2);
  assert.equal(followups[0].stop, 'Stop Z');
  assert.equal(followups[0].date, '2026-11-06');
  assert.equal(followups[1].stop, 'Stop C');
  assert.equal(routeProofFollowupHtml([]), '<p>No skipped stop is waiting for a follow-up.</p>');
  assert.ok(routeProofFollowupHtml(day2).includes('No answer'));
});

test('day page: counts sum to planned, no-proof and picker notes say so plainly', () => {
  const base = upsertRouteProof([], proof());
  const html = routeProofDayHtml(base, 'Bani Morning', '2026-11-05');
  assert.ok(html.includes('2 visited + 1 skipped = 3 planned'));
  assert.ok(html.includes('Shop closed'));
  assert.ok(routeProofDayHtml(base, 'Bani Morning', '2026-11-06').includes('No route completion proof recorded yet'));
  assert.ok(routeProofDayHtml(base, '', '2026-11-05').includes('Pick a route and a date'));
});

test('summary text: empty log and counted log', () => {
  assert.equal(routeProofSummaryText([]), 'No route completion proof recorded yet.');
  const base = upsertRouteProof([], proof());
  assert.ok(routeProofSummaryText(base).includes('1 route day'));
  assert.ok(routeProofSummaryText(base).includes('2 stops visited, 1 skipped, of 3 planned'));
});

test('html escaping: markup in a route name never breaks the page', () => {
  const base = upsertRouteProof([], proof({ route: '<script>alert(1)</script>' }));
  const html = routeProofHtml(base, '');
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('csv: header, one row per proof, quoted fields', () => {
  const base = upsertRouteProof([], proof({ route: 'Bani, Morning' }));
  const csv = routeProofCsv(base);
  assert.ok(csv.startsWith('id,route,date,collector,planned,visited,skipped'));
  assert.ok(csv.includes('"Bani, Morning"'));
  assert.ok(csv.includes('Stop C | Shop closed'));
  assert.equal(routeProofFilename(), 'route-proofs.csv');
});

test('purity: module never imports, reads storage, or touches the network', () => {
  const source = readFileSync(join(dir, '..', 'route-proof.js'), 'utf8');
  assert.ok(!source.includes('import '));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('XMLHttpRequest'));
});

test('panel ids present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  const ids = [
    'routeProofRoute',
    'routeProofDate',
    'routeProofCollector',
    'routeProofPlanned',
    'routeProofVisited',
    'routeProofSkipped',
    'routeProofSaveBtn',
    'routeProofFilter',
    'routeProofBody',
    'routeProofSummary',
    'routeProofExportBtn',
    'routeProofRemoveId',
    'routeProofRemoveBtn',
    'routeProofFollowupBody',
    'routeProofDayDate',
    'routeProofDayBody',
  ];
  for (const id of ids) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
