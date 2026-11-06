import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SCALE_READINESS_CHECKLIST_AREAS,
  validScaleReadinessChecklistDay,
  foldScaleReadinessChecklistStatus,
  normalizeScaleReadinessChecklist,
  normalizeScaleReadinessChecklistList,
  recordScaleReadinessChecklist,
  scaleReadinessChecklistGaps,
  scaleReadinessChecklistIsReady,
  scaleReadinessChecklistStatusText,
  scaleReadinessChecklistsReady,
  scaleReadinessChecklistsNotReady,
  scaleReadinessChecklistCountsAll,
  scaleReadinessChecklistSummaryText,
  scaleReadinessChecklistText,
  scaleReadinessChecklistsHtml,
  scaleReadinessChecklistGapsHtml,
  scaleReadinessChecklistCsv,
  scaleReadinessChecklistFilename,
} from '../scale-readiness-checklist.js';

const dir = dirname(fileURLToPath(import.meta.url));
const appJs = readFileSync(join(dir, '..', 'app.js'), 'utf8');
const indexHtml = readFileSync(join(dir, '..', 'index.html'), 'utf8');
const moduleSrc = readFileSync(join(dir, '..', 'scale-readiness-checklist.js'), 'utf8');

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function baseChecklist(overrides = {}) {
  return {
    id: 'SCL-1',
    reviewDate: '2026-11-06',
    reviewer: 'Owner',
    items: [
      { area: 'portsFree', status: 'ready', note: '' },
      { area: 'stockLevels', status: 'ready', note: '' },
      { area: 'collectorCapacity', status: 'ready', note: '' },
      { area: 'routeCoverage', status: 'ready', note: '' },
      { area: 'backupHealth', status: 'ready', note: '' },
    ],
    ...overrides,
  };
}

function gapChecklist(overrides = {}) {
  return baseChecklist({
    id: 'SCL-2',
    reviewDate: '2026-11-05',
    items: [
      { area: 'portsFree', status: 'gap', note: 'Only 3 ports free' },
      { area: 'stockLevels', status: 'ready', note: '' },
      { area: 'collectorCapacity', status: 'gap', note: 'Saad alone on rounds' },
      { area: 'routeCoverage', status: 'ready', note: '' },
      { area: 'backupHealth', status: 'ready', note: '' },
    ],
    ...overrides,
  });
}

test('valid day accepts strict dates including leap years', () => {
  assert.equal(validScaleReadinessChecklistDay('2026-11-06'), true);
  assert.equal(validScaleReadinessChecklistDay('2028-02-29'), true);
  assert.equal(validScaleReadinessChecklistDay('2026-01-31'), true);
});

test('valid day refuses bad dates', () => {
  assert.equal(validScaleReadinessChecklistDay('2027-02-29'), false);
  assert.equal(validScaleReadinessChecklistDay('2026-11-31'), false);
  assert.equal(validScaleReadinessChecklistDay('2026-13-01'), false);
  assert.equal(validScaleReadinessChecklistDay('2026-11-6'), false);
  assert.equal(validScaleReadinessChecklistDay('06-11-2026'), false);
  assert.equal(validScaleReadinessChecklistDay(''), false);
  assert.equal(validScaleReadinessChecklistDay(null), false);
});

test('fold status: ready spellings read ready, everything else reads gap', () => {
  assert.equal(foldScaleReadinessChecklistStatus('ready'), 'ready');
  assert.equal(foldScaleReadinessChecklistStatus('OK'), 'ready');
  assert.equal(foldScaleReadinessChecklistStatus('yes'), 'ready');
  assert.equal(foldScaleReadinessChecklistStatus('pass'), 'ready');
  assert.equal(foldScaleReadinessChecklistStatus('gap'), 'gap');
  assert.equal(foldScaleReadinessChecklistStatus('not ready'), 'gap');
  assert.equal(foldScaleReadinessChecklistStatus(''), 'gap');
  assert.equal(foldScaleReadinessChecklistStatus(undefined), 'gap');
});

test('normalize: a full valid checklist keeps five items in fixed area order', () => {
  const clean = normalizeScaleReadinessChecklist(baseChecklist({
    items: [
      { area: 'backupHealth', status: 'ready', note: '' },
      { area: 'portsFree', status: 'ready', note: '' },
      { area: 'routeCoverage', status: 'ready', note: '' },
      { area: 'stockLevels', status: 'ready', note: '' },
      { area: 'collectorCapacity', status: 'ready', note: '' },
    ],
  }));
  assert.ok(clean);
  assert.deepEqual(clean.items.map((item) => item.area), ['portsFree', 'stockLevels', 'collectorCapacity', 'routeCoverage', 'backupHealth']);
  assert.deepEqual(SCALE_READINESS_CHECKLIST_AREAS.map((area) => area.key), ['portsFree', 'stockLevels', 'collectorCapacity', 'routeCoverage', 'backupHealth']);
});

test('normalize: items accept an object map keyed by area', () => {
  const clean = normalizeScaleReadinessChecklist(baseChecklist({
    items: {
      portsFree: 'ready',
      stockLevels: { status: 'ready', note: '' },
      collectorCapacity: { status: 'gap', note: 'One collector short' },
      routeCoverage: 'ready',
      backupHealth: { status: 'ready', note: 'Checked' },
    },
  }));
  assert.ok(clean);
  assert.equal(clean.items[2].status, 'gap');
  assert.equal(clean.items[2].note, 'One collector short');
});

test('normalize refuses a checklist with no id, a bad date, or no reviewer', () => {
  assert.equal(normalizeScaleReadinessChecklist(baseChecklist({ id: '' })), null);
  assert.equal(normalizeScaleReadinessChecklist(baseChecklist({ reviewDate: '2026-11-31' })), null);
  assert.equal(normalizeScaleReadinessChecklist(baseChecklist({ reviewer: '   ' })), null);
  assert.equal(normalizeScaleReadinessChecklist(null), null);
  assert.equal(normalizeScaleReadinessChecklist('nope'), null);
});

test('normalize refuses a checklist missing an area', () => {
  const clean = normalizeScaleReadinessChecklist(baseChecklist({
    items: [
      { area: 'portsFree', status: 'ready', note: '' },
      { area: 'stockLevels', status: 'ready', note: '' },
      { area: 'collectorCapacity', status: 'ready', note: '' },
      { area: 'routeCoverage', status: 'ready', note: '' },
    ],
  }));
  assert.equal(clean, null);
});

test('normalize refuses an unnamed gap', () => {
  const clean = normalizeScaleReadinessChecklist(baseChecklist({
    items: [
      { area: 'portsFree', status: 'gap', note: '' },
      { area: 'stockLevels', status: 'ready', note: '' },
      { area: 'collectorCapacity', status: 'ready', note: '' },
      { area: 'routeCoverage', status: 'ready', note: '' },
      { area: 'backupHealth', status: 'ready', note: '' },
    ],
  }));
  assert.equal(clean, null);
});

test('normalize refuses a duplicated area', () => {
  const clean = normalizeScaleReadinessChecklist(baseChecklist({
    items: [
      { area: 'portsFree', status: 'ready', note: '' },
      { area: 'portsFree', status: 'ready', note: '' },
      { area: 'stockLevels', status: 'ready', note: '' },
      { area: 'collectorCapacity', status: 'ready', note: '' },
      { area: 'routeCoverage', status: 'ready', note: '' },
    ],
  }));
  assert.equal(clean, null);
});

test('normalize drops unknown fields', () => {
  const clean = normalizeScaleReadinessChecklist(baseChecklist({ portsInstalled: 12, hired: 'yes', amount: 5000 }));
  assert.ok(clean);
  assert.equal('portsInstalled' in clean, false);
  assert.equal('hired' in clean, false);
  assert.equal('amount' in clean, false);
});

test('record adds a checklist and never rewrites a duplicate id', () => {
  const first = recordScaleReadinessChecklist([], baseChecklist());
  assert.equal(first.length, 1);
  const again = recordScaleReadinessChecklist(first, baseChecklist({ reviewer: 'Someone else' }));
  assert.equal(again.length, 1);
  assert.equal(again[0].reviewer, 'Owner');
});

test('record refuses a half-formed checklist', () => {
  const before = [];
  const next = recordScaleReadinessChecklist(before, baseChecklist({ reviewDate: 'bad-date' }));
  assert.equal(next, before);
  assert.equal(next.length, 0);
});

test('gaps returns only gap items in fixed area order with their notes', () => {
  const gaps = scaleReadinessChecklistGaps(gapChecklist());
  assert.deepEqual(gaps.map((item) => item.area), ['portsFree', 'collectorCapacity']);
  assert.equal(gaps[0].note, 'Only 3 ports free');
  assert.deepEqual(scaleReadinessChecklistGaps(baseChecklist()), []);
  assert.deepEqual(scaleReadinessChecklistGaps(null), []);
});

test('isReady is true only when every area is ready', () => {
  assert.equal(scaleReadinessChecklistIsReady(baseChecklist()), true);
  assert.equal(scaleReadinessChecklistIsReady(gapChecklist()), false);
  assert.equal(scaleReadinessChecklistIsReady(null), false);
});

test('status text names the gaps when a checklist is not ready', () => {
  assert.equal(scaleReadinessChecklistStatusText(baseChecklist()), 'Ready');
  assert.equal(scaleReadinessChecklistStatusText(gapChecklist()), 'Not ready — 2 gaps: Ports free, Collector capacity');
  assert.equal(scaleReadinessChecklistStatusText(null), '');
});

test('ready and not-ready lists sort newest first and counts reconcile', () => {
  const list = [gapChecklist(), baseChecklist()];
  const ready = scaleReadinessChecklistsReady(list);
  const notReady = scaleReadinessChecklistsNotReady(list);
  assert.deepEqual(ready.map((item) => item.id), ['SCL-1']);
  assert.deepEqual(notReady.map((item) => item.id), ['SCL-2']);
  const counts = scaleReadinessChecklistCountsAll(list);
  assert.deepEqual(counts, { total: 2, ready: 1, notReady: 1 });
  assert.equal(counts.total, counts.ready + counts.notReady);
  const later = baseChecklist({ id: 'SCL-3', reviewDate: '2026-11-07' });
  assert.deepEqual(scaleReadinessChecklistsReady([baseChecklist(), later]).map((item) => item.id), ['SCL-3', 'SCL-1']);
});

test('summary text covers empty and mixed lists', () => {
  assert.equal(scaleReadinessChecklistSummaryText([]), 'No scale readiness checklists recorded.');
  assert.equal(scaleReadinessChecklistSummaryText([baseChecklist()]), '1 readiness checklist recorded, 1 ready, 0 not ready.');
  assert.equal(scaleReadinessChecklistSummaryText([baseChecklist(), gapChecklist()]), '2 readiness checklists recorded, 1 ready, 1 not ready.');
});

test('plain text names gaps with their notes', () => {
  assert.equal(scaleReadinessChecklistText(baseChecklist()), '2026-11-06 — Review by Owner: Ready.');
  assert.equal(
    scaleReadinessChecklistText(gapChecklist()),
    '2026-11-05 — Review by Owner: Not ready — 2 gaps: Ports free, Collector capacity. Gaps: Ports free (Only 3 ports free); Collector capacity (Saad alone on rounds).',
  );
  assert.equal(scaleReadinessChecklistText(null), '');
});

test('HTML escapes user-entered text', () => {
  const html = scaleReadinessChecklistsHtml([baseChecklist({ reviewer: '<script>alert(1)</script>' })]);
  assert.ok(!html.includes('<script>alert(1)</script>'), 'raw script must not appear');
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'escaped script appears');
});

test('gaps HTML lists named gaps for not-ready checklists only', () => {
  const html = scaleReadinessChecklistGapsHtml([baseChecklist(), gapChecklist()]);
  assert.ok(html.includes('Only 3 ports free'), 'gap note appears');
  assert.ok(!html.includes('2026-11-06'), 'ready checklist does not appear');
  assert.equal(scaleReadinessChecklistGapsHtml([]), '<ul></ul>');
});

test('CSV carries every area plus the overall verdict, quoting commas', () => {
  const csv = scaleReadinessChecklistCsv([gapChecklist()]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,reviewDate,reviewer,portsFree,stockLevels,collectorCapacity,routeCoverage,backupHealth,overall');
  assert.ok(lines[1].includes('SCL-2,2026-11-05,Owner'), 'row carries id, date, reviewer');
  assert.ok(lines[1].includes('gap: Only 3 ports free'), 'gap cell names the note');
  assert.ok(lines[1].includes('gap: Saad alone on rounds'), 'second gap cell names the note');
  assert.ok(lines[1].endsWith(',not ready'), 'overall verdict is not ready');
  const readyCsv = scaleReadinessChecklistCsv([baseChecklist()]);
  assert.ok(readyCsv.split('\n')[1].endsWith(',ready'), 'ready checklist ends ready');
  const commaCsv = scaleReadinessChecklistCsv([baseChecklist({
    id: 'SCL-9',
    items: [
      { area: 'portsFree', status: 'gap', note: 'Only 3 ports free, more on order' },
      { area: 'stockLevels', status: 'ready', note: '' },
      { area: 'collectorCapacity', status: 'ready', note: '' },
      { area: 'routeCoverage', status: 'ready', note: '' },
      { area: 'backupHealth', status: 'ready', note: '' },
    ],
  })]);
  assert.ok(commaCsv.split('\n')[1].includes('"gap: Only 3 ports free, more on order"'), 'a comma inside a note is quoted');
});

test('filename is stable', () => {
  assert.equal(scaleReadinessChecklistFilename(), 'scale-readiness-checklists.csv');
});

test('inputs are never mutated', () => {
  const frozen = deepFreeze([baseChecklist(), gapChecklist()]);
  const before = JSON.stringify(frozen);
  scaleReadinessChecklistGaps(frozen[1]);
  scaleReadinessChecklistIsReady(frozen[0]);
  scaleReadinessChecklistCountsAll(frozen);
  scaleReadinessChecklistSummaryText(frozen);
  scaleReadinessChecklistText(frozen[1]);
  scaleReadinessChecklistsHtml(frozen);
  scaleReadinessChecklistCsv(frozen);
  assert.equal(JSON.stringify(frozen), before);
});

test('normalize list drops bad entries and keeps good ones', () => {
  const out = normalizeScaleReadinessChecklistList([baseChecklist(), { id: 'BAD' }, gapChecklist(), null]);
  assert.deepEqual(out.map((item) => item.id), ['SCL-1', 'SCL-2']);
  assert.deepEqual(normalizeScaleReadinessChecklistList('nope'), []);
});

test('fences: module never names the fenced files literally', () => {
  assert.ok(!moduleSrc.includes('growth-milestone'), 'must not contain the growth milestone filename');
  assert.ok(!moduleSrc.includes('readiness-scorecard'), 'must not contain the readiness scorecard filename');
});

test('purity: no storage, clock, network, page, or standalone OLT use', () => {
  assert.ok(!moduleSrc.includes('document.'), 'no document access');
  assert.ok(!moduleSrc.includes('localStorage'), 'no localStorage');
  assert.ok(!moduleSrc.includes('new Date('), 'no new Date(');
  assert.ok(!moduleSrc.includes('Date.now('), 'no Date.now(');
  assert.ok(!moduleSrc.includes('fetch('), 'no fetch');
  assert.ok(!moduleSrc.includes('window.'), 'no window');
  assert.ok(!moduleSrc.includes('import '), 'no imports');
  assert.ok(!/\bOLT\b/.test(moduleSrc), 'no standalone OLT word');
});

test('wiring: app.js imports the module, renders it, and stores it', () => {
  assert.ok(appJs.includes("from './scale-readiness-checklist.js'"), 'app.js imports the module');
  assert.ok(appJs.includes('renderScaleReadinessChecklists()'), 'app.js calls the render function');
  assert.ok(appJs.includes("shahdara_scl_checklists_v1"), 'app.js uses the scl store key');
  assert.ok(appJs.includes('loadScaleReadinessChecklists'), 'app.js has a load helper');
  assert.ok(appJs.includes('saveScaleReadinessChecklists'), 'app.js has a save helper');
});

test('wiring: index.html carries the scl panel', () => {
  assert.ok(indexHtml.includes('id="sclHeading"'), 'panel heading present');
  assert.ok(indexHtml.includes('id="sclBody"'), 'panel body present');
  assert.ok(indexHtml.includes('id="sclSummary"'), 'panel summary present');
  assert.ok(indexHtml.includes('id="sclSaveBtn"'), 'panel save button present');
  assert.ok(indexHtml.includes('id="sclExportBtn"'), 'panel export button present');
});
