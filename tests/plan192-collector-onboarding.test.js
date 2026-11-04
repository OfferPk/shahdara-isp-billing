import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeDate,
  normalizeChecklist,
  normalizeChecklistList,
  findChecklist,
  recordChecklist,
  removeChecklist,
  tickChecklistStep,
  untickChecklistStep,
  checklistsSorted,
  checklistsForCollector,
  isChecklistComplete,
  completedChecklists,
  pendingChecklists,
  starterCollectorSteps,
  checklistSummaryText,
  checklistText,
  checklistHtml,
  checklistAllHtml,
  checklistCsv,
  checklistFilename,
} from '../collector-onboarding.js';

const dir = dirname(fileURLToPath(import.meta.url));

const checklist = (over = {}) => ({
  id: 'CO-1',
  collector: 'Saad',
  steps: [
    { step: 'Shop opening and closing routine', done: false, date: null, checkedBy: '', note: '' },
    { step: 'Receipt book and record-keeping', done: false, date: null, checkedBy: '', note: '' },
  ],
  ...over,
});

test('half-formed checklists are refused', () => {
  assert.equal(normalizeChecklist(null), null);
  assert.equal(normalizeChecklist({ id: '', collector: 'Saad', steps: [{ step: 'X' }] }), null);
  assert.equal(normalizeChecklist({ id: 'CO-1', collector: '', steps: [{ step: 'X' }] }), null);
  assert.equal(normalizeChecklist({ id: 'CO-1', collector: 'Saad', steps: [] }), null);
  assert.equal(normalizeChecklist({ id: 'CO-1', collector: 'Saad', steps: [{ step: '' }] }), null);
  assert.deepEqual(recordChecklist([], { id: 'CO-1', collector: 'Saad', steps: [] }), []);
});

test('strict calendar dates: 31-day months, Feb 29 leap and non-leap', () => {
  assert.equal(normalizeDate('2026-08-31'), '2026-08-31');
  assert.equal(normalizeDate('2026-10-31'), '2026-10-31');
  assert.equal(normalizeDate('2026-12-31'), '2026-12-31');
  assert.equal(normalizeDate('2026-04-31'), null);
  assert.equal(normalizeDate('2026-02-29'), null);
  assert.equal(normalizeDate('2024-02-29'), '2024-02-29');
  assert.equal(normalizeDate('2026-02-30'), null);
  assert.equal(normalizeDate('2026-13-01'), null);
  assert.equal(normalizeDate('not-a-date'), null);
  assert.equal(normalizeDate('2026-5-1'), null);
});

test('unknown fields are dropped, so no bill, payment, route, or customer field can creep in', () => {
  const clean = normalizeChecklist(checklist({
    mohalla: 'Mohalla A',
    route: 'Route 1',
    billId: 'B-1',
    payment: 500,
    customerId: 'C-1',
    send: true,
  }));
  assert.equal(clean.mohalla, undefined);
  assert.equal(clean.route, undefined);
  assert.equal(clean.billId, undefined);
  assert.equal(clean.payment, undefined);
  assert.equal(clean.customerId, undefined);
  assert.equal(clean.send, undefined);
  assert.deepEqual(Object.keys(clean).sort(), ['collector', 'id', 'steps']);
});

test('duplicate ids are never rewritten', () => {
  const first = [checklist()];
  const second = checklist({ collector: 'Bilal' });
  assert.deepEqual(recordChecklist(first, second), first);
  assert.equal(findChecklist(first, 'CO-1').collector, 'Saad');
});

test('one checklist per collector, case-insensitive', () => {
  const first = [checklist()];
  const duplicate = checklist({ id: 'CO-2', collector: 'saad' });
  assert.deepEqual(recordChecklist(first, duplicate), first);
  const other = checklist({ id: 'CO-2', collector: 'Bilal' });
  assert.equal(recordChecklist(first, other).length, 2);
});

test('duplicate step names inside one checklist keep only the first', () => {
  const clean = normalizeChecklist(checklist({
    steps: [
      { step: 'Receipt book', done: false },
      { step: 'receipt book', done: true, date: '2026-11-01', checkedBy: 'Owner' },
      { step: 'Cash handover rules', done: false },
    ],
  }));
  assert.equal(clean.steps.length, 2);
  assert.equal(clean.steps[0].done, false);
});

test('find and remove work by id only', () => {
  const list = [checklist(), checklist({ id: 'CO-2', collector: 'Bilal' })];
  assert.equal(findChecklist(list, 'CO-2').collector, 'Bilal');
  assert.equal(findChecklist(list, 'CO-9'), null);
  assert.equal(findChecklist(list, ''), null);
  assert.equal(removeChecklist(list, 'CO-1').length, 1);
  assert.equal(removeChecklist(list, 'CO-9').length, 2);
});

test('ticking a step records date, checked-by, and note; a bad date leaves the record unchanged', () => {
  const list = [checklist()];
  const ticked = tickChecklistStep(list, 'CO-1', 'Receipt book and record-keeping', { date: '2026-11-02', checkedBy: 'Owner', note: 'Shown twice' });
  const step = ticked[0].steps[1];
  assert.equal(step.done, true);
  assert.equal(step.date, '2026-11-02');
  assert.equal(step.checkedBy, 'Owner');
  assert.equal(step.note, 'Shown twice');
  assert.equal(ticked[0].steps[0].done, false);
  const bad = tickChecklistStep(list, 'CO-1', 'Receipt book and record-keeping', { date: '2026-02-30', checkedBy: 'Owner' });
  assert.deepEqual(bad, normalizeChecklistList(list));
  const unknown = tickChecklistStep(list, 'CO-1', 'No such step', { date: '2026-11-02' });
  assert.deepEqual(unknown, normalizeChecklistList(list));
  const wrongList = tickChecklistStep(list, 'CO-9', 'Receipt book and record-keeping', { date: '2026-11-02' });
  assert.deepEqual(wrongList, normalizeChecklistList(list));
});

test('ticking is case-insensitive on the step name', () => {
  const ticked = tickChecklistStep([checklist()], 'CO-1', 'receipt book and record-keeping', { date: '2026-11-02' });
  assert.equal(ticked[0].steps[1].done, true);
});

test('unticking clears done, date, and checked-by but keeps the note', () => {
  const ticked = tickChecklistStep([checklist()], 'CO-1', 'Shop opening and closing routine', { date: '2026-11-01', checkedBy: 'Owner', note: 'Keep' });
  const unticked = untickChecklistStep(ticked, 'CO-1', 'Shop opening and closing routine');
  assert.equal(unticked[0].steps[0].done, false);
  assert.equal(unticked[0].steps[0].date, null);
  assert.equal(unticked[0].steps[0].checkedBy, '');
  assert.equal(unticked[0].steps[0].note, 'Keep');
});

test('checklists sort by collector A-Z then id', () => {
  const list = [
    checklist({ id: 'CO-3', collector: 'Bilal' }),
    checklist({ id: 'CO-2', collector: 'Zain' }),
    checklist({ id: 'CO-1', collector: 'Saad' }),
  ];
  assert.deepEqual(checklistsSorted(list).map((entry) => entry.id), ['CO-3', 'CO-1', 'CO-2']);
});

test('collector filter matches case-insensitively by substring', () => {
  const list = [checklist(), checklist({ id: 'CO-2', collector: 'Bilal' })];
  assert.equal(checklistsForCollector(list, 'saa').length, 1);
  assert.equal(checklistsForCollector(list, 'BIL').length, 1);
  assert.equal(checklistsForCollector(list, '').length, 2);
  assert.equal(checklistsForCollector(list, 'Noor').length, 0);
});

test('complete and pending views; completed checklists stay in the list', () => {
  const done = checklist({
    steps: [{ step: 'Only step', done: true, date: '2026-11-01', checkedBy: 'Owner', note: '' }],
  });
  const open = checklist({ id: 'CO-2', collector: 'Bilal' });
  const list = [done, open];
  assert.equal(isChecklistComplete(done), true);
  assert.equal(isChecklistComplete(open), false);
  assert.equal(completedChecklists(list).length, 1);
  assert.equal(pendingChecklists(list).length, 1);
  assert.equal(completedChecklists(list)[0].id, 'CO-1');
});

test('starter steps cover shop routine, record-keeping, and handover rules', () => {
  const steps = starterCollectorSteps();
  assert.ok(steps.includes('Shop opening and closing routine'));
  assert.ok(steps.includes('Receipt book and record-keeping'));
  assert.ok(steps.includes('Cash handover rules'));
  assert.equal(steps.length, 5);
  assert.equal(new Set(steps).size, 5);
});

test('summary text names completed over total', () => {
  assert.equal(checklistSummaryText([]), '0/0 collector checklists complete');
  const done = checklist({ steps: [{ step: 'Only step', done: true, date: '2026-11-01' }] });
  assert.equal(checklistSummaryText([done, checklist({ id: 'CO-2', collector: 'Bilal' })]), '1/2 collector checklists complete');
});

test('checklist text shows status, ticks, dates, and notes', () => {
  const ticked = tickChecklistStep([checklist()], 'CO-1', 'Shop opening and closing routine', { date: '2026-11-01', checkedBy: 'Owner', note: 'Keep' });
  const text = checklistText(ticked[0]);
  assert.ok(text.includes('Saad [in progress]'));
  assert.ok(text.includes('Shop opening and closing routine [done] (2026-11-01, checked by Owner)'));
  assert.ok(text.includes('Note: Keep'));
  assert.ok(text.includes('Receipt book and record-keeping [not done]'));
  assert.equal(checklistText(null), '');
});

test('HTML escapes operator text', () => {
  const entry = checklist({ collector: '<b>Saad</b>', steps: [{ step: '<script>', done: false, note: '"quoted"' }] });
  const html = checklistHtml(entry);
  assert.ok(!html.includes('<b>Saad</b>'));
  assert.ok(html.includes('&lt;b&gt;Saad&lt;/b&gt;'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&quot;quoted&quot;'));
  assert.equal(checklistHtml(null), '');
  assert.ok(checklistAllHtml([entry]).includes('&lt;b&gt;Saad&lt;/b&gt;'));
});

test('CSV has one row per step plus a checklist-complete column, and the filename is fixed', () => {
  const csv = checklistCsv([checklist()]);
  const lines = csv.split('\n');
  assert.equal(lines[0], '"id","collector","step","done","date","checkedBy","note","checklistComplete"');
  assert.equal(lines.length, 3);
  assert.ok(lines[1].includes('"CO-1","Saad","Shop opening and closing routine","not done"'));
  assert.ok(lines[1].includes('"in progress"'));
  assert.equal(checklistFilename(), 'collector-onboarding.csv');
});

test('inputs are never mutated', () => {
  const entry = checklist();
  const snapshot = JSON.stringify(entry);
  recordChecklist([], entry);
  tickChecklistStep([entry], 'CO-1', 'Shop opening and closing routine', { date: '2026-11-01' });
  untickChecklistStep([entry], 'CO-1', 'Shop opening and closing routine');
  removeChecklist([entry], 'CO-1');
  assert.equal(JSON.stringify(entry), snapshot);
});

test('list normalization drops half-formed entries and later duplicates', () => {
  const list = normalizeChecklistList([
    checklist(),
    { id: 'CO-2', collector: '', steps: [{ step: 'X' }] },
    checklist({ id: 'CO-1', collector: 'Bilal' }),
    checklist({ id: 'CO-3', collector: 'saad' }),
    'not an object',
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].collector, 'Saad');
});

test('panel element ids are present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['coBody', 'coSummary', 'coExportBtn', 'coCollector', 'coSteps', 'coSaveBtn', 'coTickId', 'coTickStep', 'coTickDate', 'coTickBy', 'coTickNote', 'coTickBtn', 'coUntickId', 'coUntickStep', 'coUntickBtn', 'coRemoveId', 'coRemoveBtn', 'coFilter']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wires the collector onboarding module', () => {
  const app = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.ok(app.includes("from './collector-onboarding.js'"));
  assert.ok(app.includes('renderCollectorOnboarding()'));
  assert.ok(app.includes('COLLECTOR_ONBOARDING_KEY'));
});
