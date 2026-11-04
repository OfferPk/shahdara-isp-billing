import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validPoleInspectionDate,
  cleanPoleInspectionCondition,
  cleanPoleInspectionKind,
  parsePoleInspectionItems,
  normalizePoleInspectionRound,
  normalizePoleInspectionList,
  findPoleInspectionRound,
  upsertPoleInspectionRound,
  removePoleInspectionRound,
  markPoleInspectionItemFixed,
  poleInspectionConditionCounts,
  poleInspectionRoundsSorted,
  poleInspectionActionList,
  poleInspectionSummaryText,
  poleInspectionRoundsHtml,
  poleInspectionActionHtml,
  poleInspectionCsv,
  poleInspectionFilename,
} from '../pole-inspection.js';

const dir = dirname(fileURLToPath(import.meta.url));

const round = (over = {}) => ({
  id: 'POL-1',
  area: 'Mohalla A',
  date: '2026-11-01',
  inspector: 'Saad',
  items: [
    { name: 'Pole 12', kind: 'pole', condition: 'good', note: '', fixed: false, fixedDate: null },
    { name: 'Cabinet 3', kind: 'cabinet', condition: 'watch', note: 'Damp base', fixed: false, fixedDate: null },
    { name: 'Pole 14', kind: 'pole', condition: 'poor', note: 'Leaning', fixed: false, fixedDate: null },
  ],
  ...over,
});

test('strict dates: real dates pass, impossible dates refused', () => {
  assert.equal(validPoleInspectionDate('2026-08-31'), '2026-08-31');
  assert.equal(validPoleInspectionDate('2026-10-31'), '2026-10-31');
  assert.equal(validPoleInspectionDate('2026-12-31'), '2026-12-31');
  assert.equal(validPoleInspectionDate('2024-02-29'), '2024-02-29');
  assert.equal(validPoleInspectionDate('2026-02-30'), null);
  assert.equal(validPoleInspectionDate('2026-04-31'), null);
  assert.equal(validPoleInspectionDate('2026-09-31'), null);
  assert.equal(validPoleInspectionDate('2026-11-31'), null);
  assert.equal(validPoleInspectionDate('2026-13-01'), null);
  assert.equal(validPoleInspectionDate('01-11-2026'), null);
  assert.equal(validPoleInspectionDate(''), null);
  assert.equal(validPoleInspectionDate(null), null);
});

test('half-formed refusal: no date, no area, or no id is refused', () => {
  assert.equal(normalizePoleInspectionRound(round({ date: '' })), null);
  assert.equal(normalizePoleInspectionRound(round({ date: '2026-02-30' })), null);
  assert.equal(normalizePoleInspectionRound(round({ area: '  ' })), null);
  assert.equal(normalizePoleInspectionRound(round({ id: '' })), null);
  assert.equal(normalizePoleInspectionRound(null), null);
  assert.deepEqual(upsertPoleInspectionRound([], round({ date: '' })), []);
});

test('condition and kind normalization: unknown condition is watch, never good', () => {
  assert.equal(cleanPoleInspectionCondition('good'), 'good');
  assert.equal(cleanPoleInspectionCondition('poor'), 'poor');
  assert.equal(cleanPoleInspectionCondition('broken'), 'watch');
  assert.equal(cleanPoleInspectionCondition(''), 'watch');
  assert.equal(cleanPoleInspectionKind('pole'), 'pole');
  assert.equal(cleanPoleInspectionKind('cabinet'), 'cabinet');
  assert.equal(cleanPoleInspectionKind('tower'), 'other');
});

test('unknown-field drop: a round can never grow a maintenance, bill, or payment field', () => {
  const clean = normalizePoleInspectionRound(round({
    maintenanceWindow: 'MW-1', bill: 500, payment: 'cash',
    items: [{ name: 'Pole 1', kind: 'pole', condition: 'good', ticket: 'T-1' }],
  }));
  assert.equal('maintenanceWindow' in clean, false);
  assert.equal('bill' in clean, false);
  assert.equal('payment' in clean, false);
  assert.equal('ticket' in clean.items[0], false);
});

test('item parsing: "name | kind | condition | note" lines, blanks skipped', () => {
  const items = parsePoleInspectionItems('Pole 12 | pole | good |\nCabinet 3 | cabinet | poor | Damp base\n\nPole 14 | pole | watch | Loose bolt');
  assert.equal(items.length, 3);
  assert.equal(items[0].name, 'Pole 12');
  assert.equal(items[1].condition, 'poor');
  assert.equal(items[1].note, 'Damp base');
  assert.equal(items[2].condition, 'watch');
  assert.deepEqual(parsePoleInspectionItems(''), []);
  assert.deepEqual(parsePoleInspectionItems(null), []);
});

test('duplicate-id rules: identical re-save unchanged, different figures refused', () => {
  const list = [round()];
  assert.deepEqual(upsertPoleInspectionRound(list, round()), list);
  assert.deepEqual(upsertPoleInspectionRound(list, round({ inspector: 'Other' })), list);
  assert.deepEqual(upsertPoleInspectionRound(list, round({ id: 'POL-2', date: '2026-11-02' })).length, 2);
});

test('one round per area per date: same area and date under a new id refused', () => {
  const list = [round()];
  assert.deepEqual(upsertPoleInspectionRound(list, round({ id: 'POL-2' })), list);
  assert.deepEqual(upsertPoleInspectionRound(list, round({ id: 'POL-2', area: 'mohalla a' })), list);
  assert.deepEqual(upsertPoleInspectionRound(list, round({ id: 'POL-2', area: 'Mohalla B' })).length, 2);
});

test('duplicate item names in one round collapse to the first entry', () => {
  const clean = normalizePoleInspectionRound(round({
    items: [
      { name: 'Pole 12', kind: 'pole', condition: 'good' },
      { name: 'pole 12', kind: 'pole', condition: 'poor' },
      { name: '', kind: 'pole', condition: 'good' },
    ],
  }));
  assert.equal(clean.items.length, 1);
  assert.equal(clean.items[0].condition, 'good');
});

test('find and remove', () => {
  const list = [round(), round({ id: 'POL-2', area: 'Mohalla B', date: '2026-11-02' })];
  assert.equal(findPoleInspectionRound(list, 'POL-2').area, 'Mohalla B');
  assert.equal(findPoleInspectionRound(list, 'POL-9'), null);
  assert.deepEqual(removePoleInspectionRound(list, 'POL-1').map(item => item.id), ['POL-2']);
});

test('mark fixed: a fixed item leaves the action list, good items never on it', () => {
  const list = [round()];
  assert.equal(poleInspectionActionList(list).length, 2);
  const fixed = markPoleInspectionItemFixed(list, 'POL-1', 'Cabinet 3', '2026-11-03');
  const actions = poleInspectionActionList(fixed);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].name, 'Pole 14');
  const stored = findPoleInspectionRound(fixed, 'POL-1').items.find(item => item.name === 'Cabinet 3');
  assert.equal(stored.fixed, true);
  assert.equal(stored.fixedDate, '2026-11-03');
});

test('mark fixed defaults to the round date when no valid date is given', () => {
  const fixed = markPoleInspectionItemFixed([round()], 'POL-1', 'Pole 14', 'not-a-date');
  const stored = findPoleInspectionRound(fixed, 'POL-1').items.find(item => item.name === 'Pole 14');
  assert.equal(stored.fixedDate, '2026-11-01');
  assert.deepEqual(markPoleInspectionItemFixed([round()], 'POL-1', '', '2026-11-03'), [round()]);
});

test('condition counts per round', () => {
  assert.deepEqual(poleInspectionConditionCounts(round()), { good: 1, watch: 1, poor: 1 });
  assert.deepEqual(poleInspectionConditionCounts(null), { good: 0, watch: 0, poor: 0 });
});

test('round ordering: newest first, then area A-Z', () => {
  const list = [
    round({ id: 'POL-1', area: 'Mohalla B', date: '2026-11-01' }),
    round({ id: 'POL-2', area: 'Mohalla A', date: '2026-11-05' }),
    round({ id: 'POL-3', area: 'Mohalla A', date: '2026-11-01' }),
  ];
  assert.deepEqual(poleInspectionRoundsSorted(list).map(item => item.id), ['POL-2', 'POL-3', 'POL-1']);
});

test('action list ordering: newest round first, then item A-Z', () => {
  const list = [
    round({ id: 'POL-1', date: '2026-11-01' }),
    round({ id: 'POL-2', area: 'Mohalla B', date: '2026-11-05', items: [
      { name: 'Pole 9', kind: 'pole', condition: 'poor' },
      { name: 'Cabinet 1', kind: 'cabinet', condition: 'watch' },
    ] }),
  ];
  assert.deepEqual(
    poleInspectionActionList(list).map(item => `${item.roundId}:${item.name}`),
    ['POL-2:Cabinet 1', 'POL-2:Pole 9', 'POL-1:Cabinet 3', 'POL-1:Pole 14']);
});

test('non-mutation: inputs are never changed', () => {
  const input = round();
  const snapshot = JSON.stringify(input);
  upsertPoleInspectionRound([input], round({ id: 'POL-2', date: '2026-11-02' }));
  markPoleInspectionItemFixed([input], 'POL-1', 'Pole 14', '2026-11-03');
  assert.equal(JSON.stringify(input), snapshot);
});

test('summary text', () => {
  assert.equal(
    poleInspectionSummaryText([round(), round({ id: 'POL-2', area: 'Mohalla B', date: '2026-11-02', items: [] })]),
    '2 rounds · 2 areas · 3 items checked · 2 actions open');
  assert.equal(poleInspectionSummaryText([]), '0 rounds · 0 areas · 0 items checked · 0 actions open');
});

test('round HTML: counts, items, and plain empty message', () => {
  const html = poleInspectionRoundsHtml([round()], '');
  assert.ok(html.includes('Mohalla A'));
  assert.ok(html.includes('good 1'));
  assert.ok(html.includes('poor 1'));
  assert.ok(html.includes('Leaning'));
  assert.ok(poleInspectionRoundsHtml([], '').includes('No inspection rounds recorded yet.'));
  assert.ok(poleInspectionRoundsHtml([round()], 'mohalla b').includes('No inspection rounds'));
});

test('action HTML: open actions listed, fixed-all message when empty', () => {
  const html = poleInspectionActionHtml([round()]);
  assert.ok(html.includes('Cabinet 3'));
  assert.ok(html.includes('Pole 14'));
  assert.ok(!html.includes('Pole 12'));
  const fixed = markPoleInspectionItemFixed(
    markPoleInspectionItemFixed([round()], 'POL-1', 'Cabinet 3', '2026-11-03'),
    'POL-1', 'Pole 14', '2026-11-03');
  assert.ok(poleInspectionActionHtml(fixed).includes('No open actions'));
});

test('HTML escaping: markup in names and notes never renders raw', () => {
  const html = poleInspectionRoundsHtml([round({
    area: '<b>Area</b>',
    items: [{ name: '<script>alert(1)</script>', kind: 'pole', condition: 'poor', note: '<i>x</i>' }],
  })], '');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('CSV and filename', () => {
  const csv = poleInspectionCsv([round()]);
  assert.ok(csv.startsWith('round_id,area,date,inspector,item,kind,condition,note,fixed,fixed_date'));
  assert.ok(csv.includes('POL-1,Mohalla A,2026-11-01,Saad,Pole 12,pole,good,,no,'));
  assert.equal(poleInspectionFilename(), 'pole-inspections.csv');
});

test('purity: the module imports nothing', () => {
  const source = readFileSync(join(dir, '..', 'pole-inspection.js'), 'utf8');
  assert.ok(!source.includes('import '));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('fetch('));
});

test('panel-id presence: all wiring ids exist in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  const ids = ['poleArea', 'poleDate', 'poleInspector', 'poleItems', 'poleSaveBtn',
    'poleRemoveId', 'poleRemoveBtn', 'poleFixRound', 'poleFixItem', 'poleFixDate',
    'poleFixBtn', 'poleFilterArea', 'poleBody', 'poleActionBody', 'poleSummary', 'poleExportBtn'];
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), `missing ${id}`);
  assert.equal(ids.length, 16);
});
