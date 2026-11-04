import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeMilestone,
  normalizeMilestoneList,
  findMilestone,
  recordMilestone,
  removeMilestone,
  setMilestoneStatus,
  markMilestoneDone,
  milestonesSorted,
  milestonesByStatus,
  starterMilestones,
  milestonePositionText,
  milestoneSummaryText,
  milestoneReadinessText,
  milestoneText,
  milestoneHtml,
  milestoneAllHtml,
  milestoneCsv,
  milestoneFilename,
} from '../growth-milestone.js';

const dir = dirname(fileURLToPath(import.meta.url));

const milestone = (over = {}) => ({
  id: 'GM-1',
  milestone: 'First unit near 250 customers',
  target: '250 customers',
  current: '100 customers',
  linkedCount: '',
  order: 1,
  status: 'not-started',
  note: '',
  ...over,
});

test('half-formed milestones are refused', () => {
  assert.equal(normalizeMilestone(null), null);
  assert.equal(normalizeMilestone({ milestone: 'x', target: 'y' }), null);
  assert.equal(normalizeMilestone({ id: 'GM-1', target: 'y' }), null);
  assert.equal(normalizeMilestone({ id: 'GM-1', milestone: 'x' }), null);
  assert.equal(recordMilestone([], { id: 'GM-1', milestone: 'x' }).length, 0);
});

test('unknown status falls back to not-started, never hidden', () => {
  assert.equal(normalizeMilestone(milestone({ status: 'almost' })).status, 'not-started');
  assert.equal(normalizeMilestone(milestone({ status: '' })).status, 'not-started');
  assert.equal(normalizeMilestone(milestone({ status: 'done' })).status, 'done');
});

test('bad orders sort last instead of breaking the list', () => {
  assert.equal(normalizeMilestone(milestone({ order: 0 })).order, null);
  assert.equal(normalizeMilestone(milestone({ order: -2 })).order, null);
  assert.equal(normalizeMilestone(milestone({ order: 1.5 })).order, null);
  assert.equal(normalizeMilestone(milestone({ order: '3' })).order, 3);
  assert.equal(normalizeMilestone(milestone({})).order, 1);
});

test('unknown fields are dropped', () => {
  const clean = normalizeMilestone(milestone({ billId: 'B-1', payment: 500, customer: 'C-1', sendNow: true }));
  assert.equal('billId' in clean, false);
  assert.equal('payment' in clean, false);
  assert.equal('customer' in clean, false);
  assert.equal('sendNow' in clean, false);
  assert.equal(clean.milestone, 'First unit near 250 customers');
});

test('duplicate ids are never rewritten', () => {
  const list = [milestone()];
  const next = recordMilestone(list, milestone({ target: '999 customers' }));
  assert.equal(next.length, 1);
  assert.equal(next[0].target, '250 customers');
});

test('find and remove work by id', () => {
  const list = [milestone(), milestone({ id: 'GM-2', milestone: 'Other', order: 2 })];
  assert.equal(findMilestone(list, 'GM-2').milestone, 'Other');
  assert.equal(findMilestone(list, 'nope'), null);
  assert.equal(removeMilestone(list, 'GM-1').length, 1);
  assert.equal(removeMilestone(list, '').length, 2);
});

test('setting a status changes only that milestone', () => {
  const list = [milestone(), milestone({ id: 'GM-2', milestone: 'Other', order: 2 })];
  const next = setMilestoneStatus(list, 'GM-2', 'in-progress');
  assert.equal(next[1].status, 'in-progress');
  assert.equal(next[0].status, 'not-started');
  assert.equal(next[1].target, '250 customers');
});

test('an invalid status leaves the record unchanged', () => {
  const list = [milestone()];
  const next = setMilestoneStatus(list, 'GM-1', 'almost');
  assert.equal(next[0].status, 'not-started');
  assert.deepEqual(next, list);
});

test('mark done moves only the status marker', () => {
  const list = [milestone({ note: 'keep me' })];
  const next = markMilestoneDone(list, 'GM-1');
  assert.equal(next[0].status, 'done');
  assert.equal(next[0].note, 'keep me');
  assert.equal(next[0].target, '250 customers');
});

test('milestones sort by order, then name, then id; unordered last', () => {
  const list = [
    milestone({ id: 'GM-9', milestone: 'Zulu', order: null }),
    milestone({ id: 'GM-2', milestone: 'Beta', order: 2 }),
    milestone({ id: 'GM-1', milestone: 'Alpha', order: 1 }),
    milestone({ id: 'GM-3', milestone: 'Alpha', order: 1 }),
  ];
  assert.deepEqual(milestonesSorted(list).map((entry) => entry.id), ['GM-1', 'GM-3', 'GM-2', 'GM-9']);
});

test('status views split the tracker', () => {
  const list = [
    milestone(),
    milestone({ id: 'GM-2', milestone: 'B', order: 2, status: 'in-progress' }),
    milestone({ id: 'GM-3', milestone: 'C', order: 3, status: 'done' }),
  ];
  assert.deepEqual(milestonesByStatus(list, 'done').map((entry) => entry.id), ['GM-3']);
  assert.deepEqual(milestonesByStatus(list, 'in-progress').map((entry) => entry.id), ['GM-2']);
  assert.deepEqual(milestonesByStatus(list, 'bogus'), []);
});

test('current position shows entered value, linked count, or plain absence', () => {
  assert.equal(milestonePositionText(milestone()), '100 customers');
  assert.equal(milestonePositionText(milestone({ current: '120', linkedCount: 'customers' })), '120 (linked count: customers)');
  assert.equal(milestonePositionText(milestone({ current: '', linkedCount: 'customers' })), 'Linked count: customers');
  assert.equal(milestonePositionText(milestone({ current: '' })), 'No current position entered');
});

test('summary counts done over total, readiness names the next milestone', () => {
  assert.equal(milestoneSummaryText([]), '0/0 milestones done');
  const list = [
    milestone({ status: 'done' }),
    milestone({ id: 'GM-2', milestone: 'Next step', order: 2 }),
  ];
  assert.equal(milestoneSummaryText(list), '1/2 milestones done');
  assert.ok(milestoneReadinessText(list).includes('1/2 milestones done'));
  assert.ok(milestoneReadinessText(list).includes('Next: Next step'));
  assert.ok(milestoneReadinessText([]).includes('not yet tracked'));
  assert.ok(milestoneReadinessText([milestone({ status: 'done' })]).includes('All 1 milestones done'));
});

test('starter milestones are ordered and none is done', () => {
  const starters = starterMilestones();
  assert.equal(starters.length, 5);
  assert.deepEqual(starters.map((entry) => entry.order), [1, 2, 3, 4, 5]);
  assert.ok(starters.every((entry) => entry.status === 'not-started'));
  assert.ok(starters[0].milestone.length > 0 && starters[0].target.length > 0);
});

test('milestone text carries no percentage and no score', () => {
  const textOut = milestoneText(milestone({ note: 'owner note' }));
  assert.ok(textOut.includes('First unit near 250 customers'));
  assert.ok(textOut.includes('Target: 250 customers'));
  assert.ok(textOut.includes('Current: 100 customers'));
  assert.ok(textOut.includes('Note: owner note'));
  assert.ok(!textOut.includes('%'));
  assert.ok(!/score/i.test(textOut));
});

test('html escapes user text and csv has no total column', () => {
  const html = milestoneHtml(milestone({ milestone: '<b>bold</b> & co' }));
  assert.ok(!html.includes('<b>bold</b>'));
  assert.ok(html.includes('&lt;b&gt;bold&lt;/b&gt;'));
  const csv = milestoneCsv([milestone()]);
  assert.ok(csv.startsWith('"id","milestone","target","current","linkedCount","order","status","note"'));
  assert.ok(!/total/i.test(csv.split('\n')[0]));
  assert.equal(milestoneFilename(), 'growth-milestones.csv');
});

test('inputs are never mutated', () => {
  const raw = milestone({ note: 'orig' });
  const frozen = JSON.parse(JSON.stringify(raw));
  recordMilestone([], raw);
  setMilestoneStatus([raw], 'GM-1', 'done');
  assert.deepEqual(raw, frozen);
  const list = [milestone()];
  const before = JSON.parse(JSON.stringify(list));
  milestonesSorted(list);
  assert.deepEqual(list, before);
});

test('list normalization drops bad rows and duplicate ids', () => {
  const list = normalizeMilestoneList([milestone(), milestone({ target: 'other' }), null, milestone()]);
  assert.equal(list.length, 1);
  assert.equal(normalizeMilestoneList('nope').length, 0);
});

test('module is pure: no storage, network, or other record access', () => {
  const source = readFileSync(join(dir, '..', 'growth-milestone.js'), 'utf8');
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('document.'));
  assert.ok(!source.includes('capacity-forecast'));
  assert.ok(!source.includes('migration-checklist'));
});

test('panel element ids are present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['gmBody', 'gmSummary', 'gmExportBtn', 'gmStarterBtn', 'gmMilestone', 'gmTarget', 'gmCurrent', 'gmLinked', 'gmOrder', 'gmNote', 'gmSaveBtn', 'gmStatusId', 'gmStatus', 'gmStatusBtn', 'gmRemoveId', 'gmRemoveBtn', 'gmFilter']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring mentions the growth milestone module and render function', () => {
  const app = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.ok(app.includes("from './growth-milestone.js'"));
  assert.ok(app.includes('renderGrowthMilestones()'));
  assert.ok(app.includes('shahdara_growth_milestones_v1'));
});
