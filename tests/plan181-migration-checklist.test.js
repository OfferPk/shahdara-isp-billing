import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeMigrationStep,
  normalizeMigrationStepList,
  findMigrationStep,
  upsertMigrationStep,
  removeMigrationStep,
  markMigrationStepDone,
  markMigrationStepUndone,
  migrationStepsSorted,
  migrationStepsDone,
  migrationStepsOpen,
  migrationStepSummaryText,
  migrationStepText,
  migrationStepHtml,
  migrationStepAllHtml,
  migrationStepCsv,
  migrationStepFilename,
  migrationStepStarters,
  normalizePortMove,
  normalizePortMoveList,
  findPortMove,
  upsertPortMove,
  removePortMove,
  portMovesSorted,
  portMovesForCustomer,
  portMovesOnDate,
  portMoveCustomers,
  portMoveSummaryText,
  portMoveText,
  portMoveHtml,
  portMoveAllHtml,
  portMoveCsv,
  portMoveFilename,
} from '../migration-checklist.js';

const dir = dirname(fileURLToPath(import.meta.url));

const step = (over = {}) => ({
  id: 'MIG-1',
  step: 'Confirm the second unit capacity and port plan',
  order: 1,
  done: false,
  doneDate: '',
  doneBy: '',
  ...over,
});

const move = (over = {}) => ({
  id: 'MOVE-1',
  customerId: 'Cust A',
  oldUnit: 'Unit 1',
  oldPort: '1',
  newUnit: 'Unit 2',
  newPort: '5',
  date: '2026-11-01',
  reason: 'Balancing load across units',
  ...over,
});

test('half-formed steps are refused', () => {
  assert.equal(normalizeMigrationStep(step({ id: '' })), null);
  assert.equal(normalizeMigrationStep(step({ step: '' })), null);
  assert.equal(normalizeMigrationStep(step({ order: '' })), null);
  assert.equal(normalizeMigrationStep(step({ order: 0 })), null);
  assert.equal(normalizeMigrationStep(step({ order: 1.5 })), null);
  assert.equal(normalizeMigrationStep(step({ order: 'nope' })), null);
  assert.equal(normalizeMigrationStep(null), null);
  assert.equal(normalizeMigrationStep('nope'), null);
});

test('step order accepts numeric strings', () => {
  assert.equal(normalizeMigrationStep(step({ order: '3' })).order, 3);
});

test('a done step with a bad done date keeps the flag but no date', () => {
  const clean = normalizeMigrationStep(step({ done: true, doneDate: '2026-02-29', doneBy: 'Saad' }));
  assert.equal(clean.done, true);
  assert.equal(clean.doneDate, '');
  assert.equal(clean.doneBy, 'Saad');
  const good = normalizeMigrationStep(step({ done: true, doneDate: '2024-02-29', doneBy: 'Saad' }));
  assert.equal(good.doneDate, '2024-02-29');
});

test('unknown fields are dropped from steps and moves', () => {
  assert.deepEqual(Object.keys(normalizeMigrationStep(step({ billId: 'B-1', status: 'paid' }))).sort(),
    ['done', 'doneBy', 'doneDate', 'id', 'order', 'step']);
  assert.deepEqual(Object.keys(normalizePortMove(move({ billId: 'B-1', package: '20 Mbps' }))).sort(),
    ['customerId', 'date', 'id', 'newPort', 'newUnit', 'oldPort', 'oldUnit', 'reason']);
});

test('duplicate step ids are never rewritten', () => {
  const list = [step()];
  assert.deepEqual(upsertMigrationStep(list, step()), list);
  assert.deepEqual(upsertMigrationStep(list, step({ step: 'A different step' })), list);
  assert.equal(upsertMigrationStep(list, step({ id: 'MIG-2', order: 2 })).length, 2);
});

test('duplicate move ids are never rewritten', () => {
  const list = [move()];
  assert.deepEqual(upsertPortMove(list, move()), list);
  assert.deepEqual(upsertPortMove(list, move({ reason: 'A different reason' })), list);
  assert.equal(upsertPortMove(list, move({ id: 'MOVE-2', date: '2026-11-02' })).length, 2);
});

test('every move is logged once, even under a different id', () => {
  const list = [move()];
  assert.deepEqual(upsertPortMove(list, move({ id: 'MOVE-9' })), list);
  assert.equal(upsertPortMove(list, move({ id: 'MOVE-9', date: '2026-11-02' })).length, 2);
});

test('a move from a unit and port to itself is refused', () => {
  assert.equal(normalizePortMove(move({ newUnit: 'Unit 1', newPort: '1' })), null);
  assert.notEqual(normalizePortMove(move({ newUnit: 'Unit 1', newPort: '2' })), null);
  assert.notEqual(normalizePortMove(move({ newUnit: 'unit 1', newPort: '2' })), null);
});

test('half-formed moves are refused', () => {
  assert.equal(normalizePortMove(move({ customerId: '' })), null);
  assert.equal(normalizePortMove(move({ oldUnit: '' })), null);
  assert.equal(normalizePortMove(move({ oldPort: '' })), null);
  assert.equal(normalizePortMove(move({ newUnit: '' })), null);
  assert.equal(normalizePortMove(move({ newPort: '' })), null);
  assert.equal(normalizePortMove(move({ date: '' })), null);
  assert.equal(normalizePortMove(move({ date: '2026-04-31' })), null);
  assert.equal(normalizePortMove(move({ reason: '' })), null);
  assert.equal(normalizePortMove(null), null);
});

test('find and remove work for steps and moves', () => {
  assert.equal(findMigrationStep([step()], 'MIG-1').step, step().step);
  assert.equal(findMigrationStep([step()], 'MIG-9'), null);
  assert.deepEqual(removeMigrationStep([step()], 'MIG-1'), []);
  assert.equal(findPortMove([move()], 'MOVE-1').customerId, 'Cust A');
  assert.equal(findPortMove([move()], 'MOVE-9'), null);
  assert.deepEqual(removePortMove([move()], 'MOVE-1'), []);
});

test('marking a step done records only the completion date', () => {
  const list = [step()];
  const done = markMigrationStepDone(list, 'MIG-1', '2026-11-02', 'Saad');
  assert.equal(done[0].done, true);
  assert.equal(done[0].doneDate, '2026-11-02');
  assert.equal(done[0].doneBy, 'Saad');
  assert.equal(done[0].step, step().step);
  assert.deepEqual(markMigrationStepDone(list, 'MIG-1', '2026-02-29', 'Saad'), list);
  const undone = markMigrationStepUndone(done, 'MIG-1');
  assert.equal(undone[0].done, false);
  assert.equal(undone[0].doneDate, '');
  assert.equal(undone[0].doneBy, '');
});

test('steps sort by order then id, and done/open lists split', () => {
  const list = [step({ id: 'MIG-3', order: 3 }), step({ id: 'MIG-1', order: 1, done: true, doneDate: '2026-11-01' }), step({ id: 'MIG-2', order: 2 })];
  assert.deepEqual(migrationStepsSorted(list).map((item) => item.id), ['MIG-1', 'MIG-2', 'MIG-3']);
  assert.deepEqual(migrationStepsDone(list).map((item) => item.id), ['MIG-1']);
  assert.deepEqual(migrationStepsOpen(list).map((item) => item.id), ['MIG-2', 'MIG-3']);
  assert.equal(migrationStepSummaryText(list), '1/3 migration steps done');
});

test('moves sort newest first, and filter by customer and date', () => {
  const list = [
    move({ id: 'MOVE-1', date: '2026-11-01' }),
    move({ id: 'MOVE-2', customerId: 'Cust B', date: '2026-11-03' }),
    move({ id: 'MOVE-3', customerId: 'cust a', date: '2026-11-03' }),
  ];
  assert.deepEqual(portMovesSorted(list).map((item) => item.id), ['MOVE-3', 'MOVE-2', 'MOVE-1']);
  assert.deepEqual(portMovesForCustomer(list, 'CUST A').map((item) => item.id), ['MOVE-3', 'MOVE-1']);
  assert.deepEqual(portMovesOnDate(list, '2026-11-03').map((item) => item.id), ['MOVE-3', 'MOVE-2']);
  assert.deepEqual(portMovesOnDate(list, '2026-11-09'), []);
});

test('customers list keeps first spelling, A-Z', () => {
  const list = [move({ customerId: 'Cust B' }), move({ customerId: 'cust a' }), move({ customerId: 'Cust A', id: 'MOVE-2', date: '2026-11-02' })];
  assert.deepEqual(portMoveCustomers(list), ['cust a', 'Cust B']);
  assert.equal(portMoveSummaryText(list), '3 port moves logged');
  assert.equal(portMoveSummaryText([move()]), '1 port move logged');
});

test('move and step texts state the facts plainly', () => {
  assert.equal(portMoveText(move()), 'Cust A: Unit 1/1 → Unit 2/5 on 2026-11-01 — Balancing load across units');
  assert.equal(portMoveText(move({ customerId: '' })), '');
  assert.equal(migrationStepText(step()), 'Step 1: Confirm the second unit capacity and port plan — Not done');
  assert.equal(migrationStepText(step({ done: true, doneDate: '2026-11-02', doneBy: 'Saad' })),
    'Step 1: Confirm the second unit capacity and port plan — Done on 2026-11-02 by Saad');
});

test('HTML escapes user text in steps and moves', () => {
  const html = migrationStepHtml(step({ step: '<b>bold</b> & "quoted"' }));
  assert.ok(!html.includes('<b>bold</b>'));
  assert.ok(html.includes('&lt;b&gt;bold&lt;/b&gt;'));
  const moveHtml = portMoveHtml(move({ reason: '<script>alert(1)</script>' }));
  assert.ok(!moveHtml.includes('<script>'));
  assert.ok(migrationStepAllHtml([]) === '');
  assert.ok(portMoveAllHtml([]) === '');
});

test('CSV exports and filenames', () => {
  const stepCsv = migrationStepCsv([step({ done: true, doneDate: '2026-11-02', doneBy: 'Saad' })]);
  assert.ok(stepCsv.startsWith('"id","order","step","done","doneDate","doneBy"'));
  assert.ok(stepCsv.includes('"MIG-1","1","Confirm the second unit capacity and port plan","yes","2026-11-02","Saad"'));
  assert.equal(migrationStepFilename(), 'migration-checklist.csv');
  const moveCsv = portMoveCsv([move()]);
  assert.ok(moveCsv.startsWith('"id","customerId","oldUnit","oldPort","newUnit","newPort","date","reason"'));
  assert.ok(moveCsv.includes('"MOVE-1","Cust A","Unit 1","1","Unit 2","5","2026-11-01","Balancing load across units"'));
  assert.equal(portMoveFilename(), 'port-moves.csv');
});

test('inputs are never mutated', () => {
  const rawStep = step();
  const rawMove = move();
  const stepBefore = JSON.stringify(rawStep);
  const moveBefore = JSON.stringify(rawMove);
  upsertMigrationStep([rawStep], step({ id: 'MIG-2', order: 2 }));
  markMigrationStepDone([rawStep], 'MIG-1', '2026-11-02', 'Saad');
  upsertPortMove([rawMove], move({ id: 'MOVE-2' }));
  assert.equal(JSON.stringify(rawStep), stepBefore);
  assert.equal(JSON.stringify(rawMove), moveBefore);
});

test('list normalization drops half-formed rows', () => {
  assert.equal(normalizeMigrationStepList([step(), step({ id: '' }), null]).length, 1);
  assert.equal(normalizePortMoveList([move(), move({ reason: '' }), null]).length, 1);
  assert.deepEqual(normalizeMigrationStepList('nope'), []);
  assert.deepEqual(normalizePortMoveList('nope'), []);
});

test('starter checklist has six ordered steps with fixed ids', () => {
  const starters = migrationStepStarters();
  assert.equal(starters.length, 6);
  assert.deepEqual(starters.map((item) => item.order), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(starters.map((item) => item.id), ['MIG-1', 'MIG-2', 'MIG-3', 'MIG-4', 'MIG-5', 'MIG-6']);
  assert.ok(starters.every((item) => normalizeMigrationStep(item) !== null));
  let list = [];
  for (const starter of starters) list = upsertMigrationStep(list, starter);
  for (const starter of starters) list = upsertMigrationStep(list, starter);
  assert.equal(list.length, 6);
});

test('purity fence: the module never reads storage, the clock, or the network', () => {
  const source = readFileSync(join(dir, '..', 'migration-checklist.js'), 'utf8');
  assert.ok(!source.includes('new Date('));
  assert.ok(!source.includes('Date.now('));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('fetch('));
});

test('panel element ids are present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['migHeading', 'migSummary', 'migExportStepsBtn', 'migExportMovesBtn', 'migStepId', 'migStepOrder', 'migStepText', 'migStepSaveBtn', 'migStepDoneId', 'migStepDoneDate', 'migStepDoneBy', 'migStepDoneBtn', 'migStepUndoneBtn', 'migStepRemoveBtn', 'migStarterBtn', 'migStepBody', 'migMoveId', 'migMoveCustomer', 'migMoveOldUnit', 'migMoveOldPort', 'migMoveNewUnit', 'migMoveNewPort', 'migMoveDate', 'migMoveReason', 'migMoveSaveBtn', 'migMoveRemoveBtn', 'migMoveFilter', 'migMoveDateFilter', 'migMoveBody']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wires the migration panel and render loop', () => {
  const source = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.ok(source.includes("from './migration-checklist.js'"));
  assert.ok(source.includes('renderMigrationChecklist();'));
});

test('no standalone OLT word added to app.js', () => {
  const source = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.ok(!/(^|[^A-Za-z])OLT([^A-Za-z]|$)/i.test(source.replace(/OLTS/g, '')));
});
