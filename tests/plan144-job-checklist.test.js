import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validJobChecklistDate,
  JOB_CHECKLIST_DEFAULTS,
  normalizeJobChecklistTemplate,
  normalizeJobChecklistTemplateList,
  jobChecklistTemplatesWithDefaults,
  findJobChecklistTemplate,
  upsertJobChecklistTemplate,
  removeJobChecklistTemplate,
  normalizeJobChecklistVisit,
  normalizeJobChecklistVisitList,
  findJobChecklistVisit,
  upsertJobChecklistVisit,
  removeJobChecklistVisit,
  tickJobChecklistVisit,
  untickJobChecklistVisit,
  jobChecklistView,
  incompleteJobChecklists,
  jobChecklistSummaryText,
  jobChecklistHtml,
  jobChecklistIncompleteHtml,
  jobChecklistTemplatesHtml,
  jobChecklistCsv,
  jobChecklistFilename,
} from '../job-checklist.js';

const dir = dirname(fileURLToPath(import.meta.url));
const noCustoms = [];

const visit = (over = {}) => ({
  id: 'JC-1',
  jobType: 'fault-visit',
  visit: 'Visit A',
  date: '2026-11-04',
  ticks: [],
  ...over,
});

test('strict dates accept 31-day months and reject impossible dates', () => {
  assert.equal(validJobChecklistDate('2026-08-31'), '2026-08-31');
  assert.equal(validJobChecklistDate('2026-10-31'), '2026-10-31');
  assert.equal(validJobChecklistDate('2026-12-31'), '2026-12-31');
  assert.equal(validJobChecklistDate('2026-02-30'), null);
  assert.equal(validJobChecklistDate('2026-04-31'), null);
  assert.equal(validJobChecklistDate('2026-09-31'), null);
  assert.equal(validJobChecklistDate('2026-11-31'), null);
  assert.equal(validJobChecklistDate('04-11-2026'), null);
  assert.equal(validJobChecklistDate(20261104), null);
});

test('built-in templates cover new connection, fault visit and relocation', () => {
  const types = JOB_CHECKLIST_DEFAULTS.map((entry) => entry.jobType);
  assert.deepEqual(types, ['new-connection', 'fault-visit', 'relocation']);
  for (const template of JOB_CHECKLIST_DEFAULTS) {
    assert.ok(template.items.length >= 5);
  }
});

test('template normalize refuses half-formed rows and duplicate item ids', () => {
  assert.equal(normalizeJobChecklistTemplate(null), null);
  assert.equal(normalizeJobChecklistTemplate({ jobType: '', items: [{ id: 'a', label: 'A' }] }), null);
  assert.equal(normalizeJobChecklistTemplate({ jobType: 'x', items: [] }), null);
  assert.equal(normalizeJobChecklistTemplate({ jobType: 'x', items: [{ id: 'a', label: '' }] }), null);
  assert.equal(normalizeJobChecklistTemplate({ jobType: 'x', items: [{ id: 'a', label: 'A' }, { id: 'a', label: 'A2' }] }), null);
  const clean = normalizeJobChecklistTemplate({ jobType: ' x ', items: [{ id: ' a ', label: ' A ' }], bill: 'never' });
  assert.deepEqual(clean, { jobType: 'x', items: [{ id: 'a', label: 'A' }] });
});

test('template list drops half-formed rows and keeps the first job type', () => {
  const list = normalizeJobChecklistTemplateList([
    { jobType: 'custom', items: [{ id: 'a', label: 'A' }] },
    { jobType: 'custom', items: [{ id: 'b', label: 'B' }] },
    { jobType: '', items: [{ id: 'c', label: 'C' }] },
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].items[0].id, 'a');
});

test('defaults plus customs: built-ins win and customs fill the gaps', () => {
  const all = jobChecklistTemplatesWithDefaults([{ jobType: 'meter-read', items: [{ id: 'read', label: 'Meter read' }] }]);
  assert.ok(all.some((entry) => entry.jobType === 'fault-visit'));
  assert.ok(all.some((entry) => entry.jobType === 'meter-read'));
  assert.equal(findJobChecklistTemplate(noCustoms, 'fault-visit').items.length, 5);
  assert.equal(findJobChecklistTemplate(noCustoms, 'nope'), null);
});

test('upsert template refuses a job type that already has a template', () => {
  const customs = [{ jobType: 'meter-read', items: [{ id: 'read', label: 'Meter read' }] }];
  assert.deepEqual(upsertJobChecklistTemplate(customs, { jobType: 'fault-visit', items: [{ id: 'a', label: 'A' }] }), customs);
  assert.deepEqual(upsertJobChecklistTemplate(customs, { jobType: 'meter-read', items: [{ id: 'b', label: 'B' }] }), customs);
  const next = upsertJobChecklistTemplate(customs, { jobType: 'audit', items: [{ id: 'a', label: 'A' }] });
  assert.equal(next.length, 2);
  assert.equal(upsertJobChecklistTemplate(customs, { jobType: '', items: [] }).length, 1);
});

test('remove template removes customs only, never a built-in', () => {
  const customs = [{ jobType: 'meter-read', items: [{ id: 'read', label: 'Meter read' }] }];
  assert.deepEqual(removeJobChecklistTemplate(customs, 'meter-read'), []);
  assert.deepEqual(removeJobChecklistTemplate(customs, 'fault-visit'), customs);
});

test('visit normalize refuses half-formed rows and unknown job types', () => {
  assert.equal(normalizeJobChecklistVisit(visit({ visit: '' }), noCustoms), null);
  assert.equal(normalizeJobChecklistVisit(visit({ date: '2026-02-30' }), noCustoms), null);
  assert.equal(normalizeJobChecklistVisit(visit({ jobType: 'nope' }), noCustoms), null);
  assert.equal(normalizeJobChecklistVisit(visit({ payment: 'changed' }), noCustoms).payment, undefined);
});

test('visit ticks keep template items only, first tick wins, bad tick dates become null', () => {
  const clean = normalizeJobChecklistVisit(visit({
    ticks: [
      { item: 'confirm', by: 'Saad', date: '2026-11-04' },
      { item: 'confirm', by: 'Other', date: '2026-11-05' },
      { item: 'not-a-step', by: 'Saad', date: '2026-11-04' },
      { item: 'cause', by: '', date: '2026-02-30' },
    ],
  }), noCustoms);
  assert.deepEqual(clean.ticks, [
    { item: 'confirm', by: 'Saad', date: '2026-11-04' },
    { item: 'cause', by: '', date: null },
  ]);
});

test('upsert visit refuses duplicate ids and half-formed rows', () => {
  const list = [visit()];
  assert.deepEqual(upsertJobChecklistVisit(list, visit({ visit: 'Other' }), noCustoms), list);
  assert.deepEqual(upsertJobChecklistVisit(list, visit({ id: '' }), noCustoms), list);
  const next = upsertJobChecklistVisit(list, visit({ id: 'JC-2', visit: 'Visit B' }), noCustoms);
  assert.equal(next.length, 2);
});

test('find and remove visit work by id', () => {
  const list = [visit(), visit({ id: 'JC-2', visit: 'Visit B' })];
  assert.equal(findJobChecklistVisit(list, 'JC-2', noCustoms).visit, 'Visit B');
  assert.equal(findJobChecklistVisit(list, 'JC-9', noCustoms), null);
  assert.equal(removeJobChecklistVisit(list, 'JC-1', noCustoms).length, 1);
  assert.equal(removeJobChecklistVisit(list, 'JC-9', noCustoms).length, 2);
});

test('ticking adds one template item and ignores repeats and unknown items', () => {
  const list = [visit()];
  const ticked = tickJobChecklistVisit(list, 'JC-1', 'confirm', 'Saad', '2026-11-04', noCustoms);
  assert.equal(ticked[0].ticks.length, 1);
  assert.deepEqual(tickJobChecklistVisit(ticked, 'JC-1', 'confirm', 'Saad', '2026-11-04', noCustoms), ticked);
  assert.deepEqual(tickJobChecklistVisit(ticked, 'JC-1', 'not-a-step', 'Saad', '2026-11-04', noCustoms), ticked);
  assert.deepEqual(tickJobChecklistVisit(ticked, 'JC-9', 'cause', 'Saad', '2026-11-04', noCustoms), ticked);
});

test('ticking without a date still counts, with the date shown as null', () => {
  const ticked = tickJobChecklistVisit([visit()], 'JC-1', 'cause', 'Saad', '', noCustoms);
  assert.deepEqual(ticked[0].ticks, [{ item: 'cause', by: 'Saad', date: null }]);
});

test('unticking removes only that item', () => {
  const list = [visit({ ticks: [{ item: 'confirm', by: 'Saad', date: '2026-11-04' }, { item: 'cause', by: 'Saad', date: null }] })];
  const next = untickJobChecklistVisit(list, 'JC-1', 'confirm', noCustoms);
  assert.deepEqual(next[0].ticks.map((entry) => entry.item), ['cause']);
  assert.deepEqual(untickJobChecklistVisit(next, 'JC-1', 'fix', noCustoms), next);
});

test('visit view shows items in template order, ticked and unticked side by side', () => {
  const view = jobChecklistView(visit({ ticks: [{ item: 'fix', by: 'Saad', date: '2026-11-04' }] }), noCustoms);
  assert.deepEqual(view.items.map((entry) => entry.id), ['confirm', 'cause', 'fix', 'test', 'briefing']);
  assert.equal(view.ticked, 1);
  assert.equal(view.total, 5);
  assert.equal(view.complete, false);
  assert.equal(view.items[2].ticked, true);
  assert.equal(view.items[0].ticked, false);
  const empty = jobChecklistView(visit(), noCustoms);
  assert.equal(empty.ticked, 0);
  assert.equal(empty.complete, false);
  assert.equal(jobChecklistView(visit({ jobType: 'nope' }), noCustoms), null);
});

test('a fully ticked visit view is complete', () => {
  const all = ['confirm', 'cause', 'fix', 'test', 'briefing'].map((item) => ({ item, by: 'Saad', date: '2026-11-04' }));
  const view = jobChecklistView(visit({ ticks: all }), noCustoms);
  assert.equal(view.complete, true);
  assert.equal(view.ticked, 5);
});

test('incomplete list flags unticked visits oldest first and hides complete ones', () => {
  const list = [
    visit({ id: 'JC-2', visit: 'Visit B', date: '2026-11-03', ticks: [{ item: 'confirm', by: '', date: null }] }),
    visit({ id: 'JC-1', visit: 'Visit A', date: '2026-11-04', ticks: [] }),
    visit({ id: 'JC-3', visit: 'Visit C', date: '2026-11-02', ticks: ['confirm', 'cause', 'fix', 'test', 'briefing'].map((item) => ({ item, by: '', date: null })) }),
  ];
  const incomplete = incompleteJobChecklists(list, noCustoms);
  assert.deepEqual(incomplete.map((entry) => entry.id), ['JC-2', 'JC-1']);
});

test('inputs are never mutated', () => {
  const list = [visit()];
  const customs = [{ jobType: 'meter-read', items: [{ id: 'read', label: 'Meter read' }] }];
  const snapshot = JSON.stringify(list);
  const customSnapshot = JSON.stringify(customs);
  upsertJobChecklistVisit(list, visit({ id: 'JC-2' }), noCustoms);
  tickJobChecklistVisit(list, 'JC-1', 'confirm', 'Saad', '2026-11-04', noCustoms);
  untickJobChecklistVisit(list, 'JC-1', 'confirm', noCustoms);
  jobChecklistView(visit(), noCustoms);
  upsertJobChecklistTemplate(customs, { jobType: 'audit', items: [{ id: 'a', label: 'A' }] });
  assert.equal(JSON.stringify(list), snapshot);
  assert.equal(JSON.stringify(customs), customSnapshot);
});

test('summary text counts visits, complete and incomplete rows', () => {
  const all = ['confirm', 'cause', 'fix', 'test', 'briefing'].map((item) => ({ item, by: '', date: null }));
  const list = [visit(), visit({ id: 'JC-2', ticks: all })];
  assert.equal(jobChecklistSummaryText(list, noCustoms), '2 visit checklists, 1 complete, 1 incomplete — flagged, not hidden');
  assert.equal(jobChecklistSummaryText([], noCustoms), '0 visit checklists, 0 complete, 0 incomplete — flagged, not hidden');
});

test('HTML shows ticked and unticked items and flags incomplete visits', () => {
  const html = jobChecklistHtml([visit({ visit: '<b>V</b>', ticks: [{ item: 'confirm', by: 'Saad', date: '2026-11-04' }] })], noCustoms, '');
  assert.ok(html.includes('&lt;b&gt;V&lt;/b&gt;'));
  assert.ok(!html.includes('<b>V</b>'));
  assert.ok(html.includes('☑ Fault confirmed on site'));
  assert.ok(html.includes('☐ Cause identified'));
  assert.ok(html.includes('INCOMPLETE'));
  assert.ok(jobChecklistHtml([], noCustoms, '').includes('No visit checklist recorded yet'));
  assert.ok(jobChecklistIncompleteHtml([visit()], noCustoms).includes('INCOMPLETE'));
  assert.ok(jobChecklistIncompleteHtml([], noCustoms).includes('No incomplete checklist'));
  assert.ok(jobChecklistTemplatesHtml(noCustoms).includes('fault-visit'));
});

test('CSV header and rows carry every field', () => {
  const csv = jobChecklistCsv([visit({ ticks: [{ item: 'confirm', by: 'Saad', date: '2026-11-04' }] })], noCustoms);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,jobType,visit,date,tickedItems,totalItems,complete');
  assert.ok(lines[1].startsWith('JC-1,fault-visit,Visit A,2026-11-04,confirm,5,no'));
  assert.equal(jobChecklistFilename(), 'job-checklists.csv');
});

test('panel element ids exist in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['jobCheckSummary', 'jobCheckExportBtn', 'jobCheckTemplateType',
    'jobCheckTemplateItems', 'jobCheckTemplateSaveBtn', 'jobCheckTemplateRemoveId',
    'jobCheckTemplateRemoveBtn', 'jobCheckTemplateBody', 'jobCheckVisitType',
    'jobCheckVisit', 'jobCheckVisitDate', 'jobCheckVisitSaveBtn', 'jobCheckTickVisit',
    'jobCheckTickItem', 'jobCheckTickBy', 'jobCheckTickDate', 'jobCheckTickBtn',
    'jobCheckUntickBtn', 'jobCheckRemoveId', 'jobCheckRemoveBtn', 'jobCheckFilter',
    'jobCheckBody', 'jobCheckIncompleteBody']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
