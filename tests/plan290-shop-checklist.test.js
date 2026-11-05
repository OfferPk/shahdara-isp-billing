import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  validShopChecklistDate,
  foldShopChecklistShift,
  foldShopChecklistDone,
  normalizeShopChecklistStep,
  normalizeShopChecklist,
  findShopChecklistStep,
  recordShopChecklistStep,
  removeShopChecklistStep,
  shopChecklistSorted,
  shopChecklistForDay,
  shopChecklistMissedSteps,
  shopChecklistDaySummaryText,
  shopChecklistSummaryText,
  shopChecklistStepText,
  shopChecklistStepHtml,
  shopChecklistDayHtml,
  shopChecklistAllHtml,
  shopChecklistCsv,
  shopChecklistFilename,
} from '../shop-checklist.js';

const first = {
  id: 'SC-1',
  date: '2026-11-01',
  shift: 'opening',
  step: 'Open the shutter',
  done: true,
  doneBy: 'Saad',
  keyId: 'K-1',
};
const second = {
  id: 'SC-2',
  date: '2026-11-01',
  shift: 'opening',
  step: 'Check the cash box',
  done: false,
  doneBy: '',
  keyId: '',
};
const third = {
  id: 'SC-3',
  date: '2026-11-01',
  shift: 'closing',
  step: 'Lock the shutter',
  done: true,
  doneBy: 'Aqib',
  keyId: 'K-1',
};
const fourth = {
  id: 'SC-4',
  date: '2026-11-02',
  shift: 'closing',
  step: 'Switch off the lights',
  done: false,
  doneBy: '',
  keyId: '',
};
const fixture = [third, first, fourth, second];

test('half-formed steps are refused, and a step with no done-by reads as not done yet', () => {
  assert.equal(normalizeShopChecklistStep(null), null);
  assert.equal(normalizeShopChecklistStep('nope'), null);
  assert.equal(normalizeShopChecklistStep({ ...first, id: '' }), null);
  assert.equal(normalizeShopChecklistStep({ ...first, date: '' }), null);
  assert.equal(normalizeShopChecklistStep({ ...first, date: '2026-11-32' }), null);
  assert.equal(normalizeShopChecklistStep({ ...first, shift: '' }), null);
  assert.equal(normalizeShopChecklistStep({ ...first, shift: 'afternoon' }), null);
  assert.equal(normalizeShopChecklistStep({ ...first, step: '' }), null);
  assert.equal(normalizeShopChecklistStep({ ...first, step: '   ' }), null);
  const minimal = normalizeShopChecklistStep({ id: 'SC-9', date: '2026-11-05', shift: 'closing', step: 'Lock the door' });
  assert.deepEqual(minimal, { id: 'SC-9', date: '2026-11-05', shift: 'closing', step: 'Lock the door', done: false, doneBy: '', keyId: '' });
  assert.deepEqual(normalizeShopChecklistStep(first), first);
});

test('strict dates: only real calendar dates pass', () => {
  assert.equal(validShopChecklistDate('2026-11-01'), true);
  assert.equal(validShopChecklistDate('2024-02-29'), true);
  assert.equal(validShopChecklistDate('2026-02-29'), false);
  assert.equal(validShopChecklistDate('2026-04-31'), false);
  assert.equal(validShopChecklistDate('2026-13-01'), false);
  assert.equal(validShopChecklistDate('2026-00-10'), false);
  assert.equal(validShopChecklistDate('2026-11-00'), false);
  assert.equal(validShopChecklistDate('01-11-2026'), false);
  assert.equal(validShopChecklistDate('2026/11/01'), false);
  assert.equal(validShopChecklistDate(20261101), false);
  assert.equal(validShopChecklistDate(''), false);
});

test('shift folds from plain spellings', () => {
  assert.equal(foldShopChecklistShift('opening'), 'opening');
  assert.equal(foldShopChecklistShift('open'), 'opening');
  assert.equal(foldShopChecklistShift('OPENING'), 'opening');
  assert.equal(foldShopChecklistShift('closing'), 'closing');
  assert.equal(foldShopChecklistShift('close'), 'closing');
  assert.equal(foldShopChecklistShift('CLOSE'), 'closing');
  assert.equal(foldShopChecklistShift('afternoon'), null);
  assert.equal(foldShopChecklistShift(''), null);
  assert.equal(foldShopChecklistShift(null), null);
});

test('done folds from plain spellings', () => {
  assert.equal(foldShopChecklistDone(true), true);
  assert.equal(foldShopChecklistDone(1), true);
  assert.equal(foldShopChecklistDone('yes'), true);
  assert.equal(foldShopChecklistDone('done'), true);
  assert.equal(foldShopChecklistDone('checked'), true);
  assert.equal(foldShopChecklistDone('x'), true);
  assert.equal(foldShopChecklistDone('TRUE'), true);
  assert.equal(foldShopChecklistDone(false), false);
  assert.equal(foldShopChecklistDone(0), false);
  assert.equal(foldShopChecklistDone('no'), false);
  assert.equal(foldShopChecklistDone('maybe'), false);
  assert.equal(foldShopChecklistDone(''), false);
  assert.equal(foldShopChecklistDone(undefined), false);
});

test('unknown fields are dropped and the input is never mutated', () => {
  const raw = {
    ...first,
    bill: 'B-1',
    payment: 500,
    stock: 'cable',
    access: 'granted',
    keyIssued: true,
    extra: 'dropped',
  };
  const before = JSON.stringify(raw);
  const out = normalizeShopChecklistStep(raw);
  assert.deepEqual(out, first);
  assert.equal(JSON.stringify(raw), before);
  const listBefore = JSON.stringify(fixture);
  normalizeShopChecklist(fixture);
  recordShopChecklistStep(fixture, { ...first, id: 'SC-5' });
  assert.equal(JSON.stringify(fixture), listBefore);
});

test('a duplicate id is never rewritten', () => {
  const out = recordShopChecklistStep(fixture, { ...first, step: 'Open the back door', doneBy: 'Aqib' });
  assert.equal(out.length, 4);
  assert.equal(findShopChecklistStep(out, 'SC-1').step, 'Open the shutter');
  assert.equal(findShopChecklistStep(out, 'SC-1').doneBy, 'Saad');
  assert.deepEqual(recordShopChecklistStep(fixture, { ...first, date: '' }).map((entry) => entry.id), ['SC-3', 'SC-1', 'SC-4', 'SC-2']);
});

test('find and remove', () => {
  assert.deepEqual(findShopChecklistStep(fixture, 'SC-3'), third);
  assert.equal(findShopChecklistStep(fixture, 'SC-9'), null);
  assert.equal(findShopChecklistStep(fixture, ''), null);
  assert.deepEqual(removeShopChecklistStep(fixture, 'SC-2').map((entry) => entry.id), ['SC-3', 'SC-1', 'SC-4']);
  assert.deepEqual(removeShopChecklistStep(fixture, 'SC-9').map((entry) => entry.id), ['SC-3', 'SC-1', 'SC-4', 'SC-2']);
  assert.deepEqual(removeShopChecklistStep(fixture, '').map((entry) => entry.id), ['SC-3', 'SC-1', 'SC-4', 'SC-2']);
});

test('sorting is date, then opening before closing, then step A-Z, then id', () => {
  assert.deepEqual(shopChecklistSorted(fixture).map((entry) => entry.id), ['SC-2', 'SC-1', 'SC-3', 'SC-4']);
  assert.deepEqual(shopChecklistSorted([fourth, third, second, first]).map((entry) => entry.id), ['SC-2', 'SC-1', 'SC-3', 'SC-4']);
});

test('one day shows its opening and closing checklists with done and missed steps visible', () => {
  const day = shopChecklistForDay(fixture, '2026-11-01');
  assert.deepEqual(day.opening.map((entry) => entry.id), ['SC-2', 'SC-1']);
  assert.deepEqual(day.closing.map((entry) => entry.id), ['SC-3']);
  assert.equal(day.opening.find((entry) => entry.id === 'SC-1').done, true);
  assert.equal(day.opening.find((entry) => entry.id === 'SC-2').done, false);
  assert.deepEqual(shopChecklistForDay(fixture, '2026-11-03'), { date: '2026-11-03', opening: [], closing: [] });
  assert.equal(shopChecklistForDay(fixture, '2026-11-32'), null);
  assert.equal(shopChecklistForDay(fixture, ''), null);
});

test('missed steps stay visible until done', () => {
  assert.deepEqual(shopChecklistMissedSteps(fixture, '2026-11-01').map((entry) => entry.id), ['SC-2']);
  assert.deepEqual(shopChecklistMissedSteps(fixture, '2026-11-01', 'opening').map((entry) => entry.id), ['SC-2']);
  assert.deepEqual(shopChecklistMissedSteps(fixture, '2026-11-01', 'closing').map((entry) => entry.id), []);
  assert.deepEqual(shopChecklistMissedSteps(fixture, '2026-11-02').map((entry) => entry.id), ['SC-4']);
  assert.deepEqual(shopChecklistMissedSteps(fixture, '2026-11-03'), []);
  assert.deepEqual(shopChecklistMissedSteps(fixture, '2026-11-32'), []);
});

test('summary names the count, the latest day, and the done count per day', () => {
  assert.equal(shopChecklistSummaryText(fixture), '4 shop checklist steps recorded. Latest day: 2026-11-02.');
  assert.equal(shopChecklistSummaryText([first]), '1 shop checklist step recorded. Latest day: 2026-11-01.');
  assert.equal(shopChecklistSummaryText([]), 'No shop checklist steps recorded.');
  assert.equal(shopChecklistDaySummaryText(fixture, '2026-11-01'), '2026-11-01: opening 1 of 2 steps done, closing 1 of 1 steps done — 2 of 3 steps done in total.');
  assert.equal(shopChecklistDaySummaryText(fixture, '2026-11-02'), '2026-11-02: opening 0 of 0 steps done, closing 0 of 1 steps done — 0 of 1 steps done in total.');
  assert.equal(shopChecklistDaySummaryText(fixture, '2026-11-03'), 'No checklist steps recorded for 2026-11-03.');
  assert.equal(shopChecklistDaySummaryText(fixture, '2026-11-32'), 'No checklist steps recorded for this day.');
});

test('text shows shift, step, and who did it — or that it is still missed', () => {
  assert.equal(shopChecklistStepText(first), '2026-11-01 opening — Open the shutter — done by Saad — key K-1');
  assert.equal(shopChecklistStepText(second), '2026-11-01 opening — Check the cash box — not done yet');
  assert.equal(shopChecklistStepText(third), '2026-11-01 closing — Lock the shutter — done by Aqib — key K-1');
  assert.equal(shopChecklistStepText({ ...first, doneBy: '' }), '2026-11-01 opening — Open the shutter — done — key K-1');
  assert.equal(shopChecklistStepText(null), 'No shop checklist step recorded.');
  assert.equal(shopChecklistStepText({ ...first, date: '' }), 'No shop checklist step recorded.');
});

test('html escapes input and shows a day with both shifts', () => {
  const evil = { id: 'SC-9', date: '2026-11-05', shift: 'opening', step: '<script>alert(1)</script>', done: true, doneBy: '<b>Aqib</b>', keyId: '' };
  const html = shopChecklistStepHtml(evil);
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.equal(html.includes('&lt;b&gt;Aqib&lt;/b&gt;'), true);
  assert.equal(html.includes('done by'), true);
  assert.equal(shopChecklistStepHtml(null), '<p>No shop checklist step recorded.</p>');
  const day = shopChecklistDayHtml(fixture, '2026-11-01');
  assert.equal(day.includes('Opening'), true);
  assert.equal(day.includes('Closing'), true);
  assert.equal(day.includes('Open the shutter'), true);
  assert.equal(day.includes('Lock the shutter'), true);
  assert.equal(shopChecklistDayHtml(fixture, '2026-11-03'), '<p>No checklist steps recorded for 2026-11-03.</p>');
  assert.equal(shopChecklistDayHtml(fixture, '2026-11-32'), '<p>No checklist steps recorded for this day.</p>');
  assert.equal(shopChecklistAllHtml([]), '<p>No shop checklist steps recorded.</p>');
  assert.equal(shopChecklistAllHtml([evil]).includes('&lt;script&gt;'), true);
});

test('csv export and filename', () => {
  const csv = shopChecklistCsv(fixture);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","date","shift","step","done","done by","key id"');
  assert.equal(lines.length, 5);
  assert.equal(lines[1].includes('"SC-2"'), true);
  assert.equal(lines[1].includes('"Check the cash box"'), true);
  assert.equal(lines[1].includes('"not done"'), true);
  assert.equal(lines[2].includes('"SC-1"'), true);
  assert.equal(lines[2].includes('"done"'), true);
  assert.equal(lines[2].includes('"Saad"'), true);
  assert.equal(lines[2].includes('"K-1"'), true);
  assert.equal(lines[3].includes('"SC-3"'), true);
  assert.equal(lines[4].includes('"SC-4"'), true);
  assert.equal(shopChecklistCsv([]), '"id","date","shift","step","done","done by","key id"');
  assert.equal(shopChecklistFilename(), 'shop-checklists.csv');
});

test('list normalisation drops bad steps and keeps the first duplicate', () => {
  const bad = { ...first, id: '' };
  const out = normalizeShopChecklist([bad, first, { ...first, step: 'Open the back door' }, second, 'nope', null]);
  assert.deepEqual(out.map((entry) => entry.id), ['SC-1', 'SC-2']);
  assert.equal(out[0].step, 'Open the shutter');
});

test('purity fence: the module imports nothing and reads no storage', () => {
  const source = readFileSync(new URL('../shop-checklist.js', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(source), false);
  assert.equal(source.includes('localStorage'), false);
  assert.equal(source.includes('sessionStorage'), false);
  assert.equal(source.includes('fetch('), false);
  assert.equal(source.includes('new Date('), false);
  assert.equal(source.includes('Date.now('), false);
  assert.equal(source.includes('document.'), false);
  assert.equal(source.includes('window.'), false);
});

test('neighbour-module fence: the keys and access register is untouched', () => {
  const source = readFileSync(new URL('../shop-checklist.js', import.meta.url), 'utf8');
  assert.equal(source.includes('access-register.js'), false, 'module must not reference the keys and access register module');
  assert.equal(existsSync(new URL('../access-register.js', import.meta.url)), true);
});

test('panel ids are present in index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [
    'socHeading', 'socSummary', 'socExportBtn', 'socDate', 'socShift',
    'socStep', 'socDone', 'socDoneBy', 'socKeyId', 'socRecordBtn',
    'socRemoveId', 'socRemoveBtn', 'socDayFilter', 'socDayBtn',
    'socDayBody', 'socBody',
  ];
  for (const id of ids) assert.equal(html.includes(`id="${id}"`), true, `missing ${id}`);
});

test('app.js wires the shop checklist panel', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(source.includes("from './shop-checklist.js'"), true);
  assert.equal(source.includes('renderShopChecklist()'), true);
  assert.equal(source.includes('loadShopChecklistSteps()'), true);
  assert.equal(source.includes('shahdara_shop_checklists_v1'), true);
});

test('deployment guard: no standalone OLT word is added to app.js', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/\bOLT\b/.test(source), false);
});
