import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validOutageNoticeDate,
  normalizeOutageNoticeList,
  recordOutageNotice,
  removeOutageNotice,
  findOutageNotice,
  addOutageNoticeStep,
  addOutageNoticeUnreached,
  annotateOutageNotice,
  outageNoticeIsComplete,
  outageNoticeSorted,
  outageNoticeForOutage,
  outageNoticeRefs,
  outageNoticeIncomplete,
  outageNoticeMohallasPending,
  outageNoticeText,
  outageNoticeSummaryText,
  outageNoticeHtml,
  outageNoticeCsv,
  outageNoticeFilename,
} from '../outage-notice.js';
import fs from 'node:fs';

const listA = {
  id: 'n1',
  outageRef: 'OUT-101',
  mohallas: [
    { mohalla: 'Mohalla A', method: 'WhatsApp', date: '2026-07-10', operator: 'Saad' },
    { mohalla: 'Mohalla B', method: '', date: '', operator: '' },
  ],
  unreached: ['Ahmed'],
  annotations: [],
};
const listB = {
  id: 'n2',
  outageRef: 'OUT-102',
  mohallas: [{ mohalla: 'Mohalla C', method: 'Call', date: '2026-07-11', operator: 'Saad' }],
  unreached: [],
  annotations: [],
};

test('half-formed checklists are refused', () => {
  assert.equal(recordOutageNotice([], { outageRef: 'OUT-1', mohallas: ['M1'] }).length, 0);
  assert.equal(recordOutageNotice([], { id: 'x', mohallas: ['M1'] }).length, 0);
  assert.equal(recordOutageNotice([], { id: 'x', outageRef: 'OUT-1' }).length, 0);
  assert.equal(recordOutageNotice([], { id: 'x', outageRef: 'OUT-1', mohallas: [] }).length, 0);
  assert.equal(recordOutageNotice([], { id: 'x', outageRef: 'OUT-1', mohallas: ['  '] }).length, 0);
  // A bad notice date on one mohalla drops that notice back to
  // "not yet noticed" — the checklist itself is still recorded.
  const badDate = recordOutageNotice([], { id: 'x', outageRef: 'OUT-1', mohallas: [{ mohalla: 'M1', method: 'Call', date: '2026-02-30', operator: 'Saad' }] });
  assert.equal(badDate.length, 1);
  assert.equal(badDate[0].mohallas[0].method, '');
  assert.equal(badDate[0].mohallas[0].date, '');
});

test('strict dates: leap day accepted only in leap years', () => {
  assert.equal(validOutageNoticeDate('2024-02-29'), true);
  assert.equal(validOutageNoticeDate('2026-02-29'), false);
  assert.equal(validOutageNoticeDate('2026-13-01'), false);
  assert.equal(validOutageNoticeDate('2026-07-32'), false);
  assert.equal(validOutageNoticeDate('12-07-2026'), false);
});

test('unknown fields are dropped and inputs are not mutated', () => {
  const raw = { ...listA, surprise: 'nope' };
  const recorded = recordOutageNotice([], raw);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].surprise, undefined);
  assert.equal(raw.surprise, 'nope');
  const before = JSON.stringify([listA]);
  normalizeOutageNoticeList([listA]);
  assert.equal(JSON.stringify([listA]), before);
});

test('duplicate ids are never rewritten', () => {
  const list = recordOutageNotice([listA], { ...listA, outageRef: 'OUT-999' });
  assert.equal(list.length, 1);
  assert.equal(list[0].outageRef, 'OUT-101');
});

test('find and remove', () => {
  assert.equal(findOutageNotice([listA, listB], 'n2').outageRef, 'OUT-102');
  assert.equal(findOutageNotice([listA], 'nope'), null);
  assert.equal(removeOutageNotice([listA, listB], 'n1').length, 1);
  assert.equal(removeOutageNotice([listA], 'nope').length, 1);
});

test('sorting is by outage reference, then id', () => {
  const sorted = outageNoticeSorted([listB, listA]);
  assert.deepEqual(sorted.map((row) => row.id), ['n1', 'n2']);
});

test('per-outage listing is case-insensitive and refs list is unique', () => {
  assert.equal(outageNoticeForOutage([listA, listB], 'out-101').length, 1);
  assert.equal(outageNoticeForOutage([listA], 'OUT-999').length, 0);
  assert.deepEqual(outageNoticeRefs([listB, listA, listA]), ['OUT-101', 'OUT-102']);
});

test('a notice step fills a mohalla that has none, and never rewrites one that has', () => {
  const stepped = addOutageNoticeStep([listA], 'n1', 'mohalla b', { method: 'Visit', date: '2026-07-12', operator: 'Saad' });
  assert.equal(stepped[0].mohallas[1].method, 'Visit');
  assert.equal(stepped[0].mohallas[1].date, '2026-07-12');
  assert.equal(outageNoticeIsComplete(stepped[0]), true);
  const again = addOutageNoticeStep(stepped, 'n1', 'Mohalla B', { method: 'Call', date: '2026-07-13', operator: 'Other' });
  assert.equal(again, stepped);
  assert.equal(again[0].mohallas[1].method, 'Visit');
});

test('half-formed notice steps are refused', () => {
  const input = [listA];
  assert.equal(addOutageNoticeStep(input, 'n1', 'Mohalla B', { method: '', date: '2026-07-12', operator: 'Saad' }), input);
  assert.equal(addOutageNoticeStep(input, 'n1', 'Mohalla B', { method: 'Call', date: '2026-02-30', operator: 'Saad' }), input);
  assert.equal(addOutageNoticeStep(input, 'n1', 'Mohalla B', { method: 'Call', date: '2026-07-12', operator: '' }), input);
  assert.equal(addOutageNoticeStep(input, 'n1', 'Mohalla Z', { method: 'Call', date: '2026-07-12', operator: 'Saad' }), input);
  assert.equal(addOutageNoticeStep(input, 'nope', 'Mohalla B', { method: 'Call', date: '2026-07-12', operator: 'Saad' }), input);
});

test('unreached customers are added once, never duplicated', () => {
  const added = addOutageNoticeUnreached([listA], 'n1', 'Bilal');
  assert.deepEqual(added[0].unreached, ['Ahmed', 'Bilal']);
  const dup = addOutageNoticeUnreached(added, 'n1', 'ahmed');
  assert.equal(dup, added);
  const input = [listA];
  assert.equal(addOutageNoticeUnreached(input, 'n1', '  '), input);
});

test('a completed checklist is never edited, only annotated', () => {
  const annotated = annotateOutageNotice([listB], 'n2', '2026-07-12', 'All told before work started.');
  assert.equal(annotated[0].annotations.length, 1);
  assert.equal(annotated[0].mohallas[0].method, 'Call');
  assert.equal(annotated[0].outageRef, 'OUT-102');
  const input = [listB];
  assert.equal(annotateOutageNotice(input, 'n2', '2026-02-30', 'Bad date.'), input);
  assert.equal(annotateOutageNotice(input, 'n2', '2026-07-12', '  '), input);
});

test('completeness needs every mohalla noticed; pending list names the rest', () => {
  assert.equal(outageNoticeIsComplete(listA), false);
  assert.equal(outageNoticeIsComplete(listB), true);
  assert.deepEqual(outageNoticeMohallasPending(listA), ['Mohalla B']);
  assert.deepEqual(outageNoticeMohallasPending(listB), []);
  assert.equal(outageNoticeIncomplete([listA, listB]).length, 1);
});

test('summary and checklist text list the unreached, never hide them', () => {
  assert.equal(outageNoticeSummaryText([listA, listB]), '2 checklist(s); 1 complete; 1 mohalla(s) still unnoticed; 1 customer(s) not yet reached.');
  assert.equal(outageNoticeSummaryText([]), 'No outage notice checklists recorded.');
  assert.match(outageNoticeText(listA), /Incomplete: still to tell — Mohalla B/);
  assert.match(outageNoticeText(listA), /Customers not yet reached: Ahmed/);
  assert.match(outageNoticeText(listB), /No customers unreached\./);
  assert.match(outageNoticeText(listB), /Complete: every affected mohalla was told\./);
  assert.equal(outageNoticeText(null), 'No checklist to show.');
});

test('HTML escapes values and CSV carries one row per mohalla', () => {
  const nasty = { ...listB, outageRef: 'OUT-<b>1</b>' };
  assert.ok(!outageNoticeHtml(nasty).includes('<b>1</b>'));
  assert.match(outageNoticeHtml(nasty), /OUT-&lt;b&gt;1&lt;\/b&gt;/);
  const csv = outageNoticeCsv([listA, listB]);
  assert.ok(csv.startsWith('Outage reference,Checklist id,Mohalla,Notice method,Date noticed,Operator,Unreached customers,Complete'));
  assert.equal(csv.split('\n').length, 4);
  assert.match(csv, /"OUT-101","n1","Mohalla B","","","","Ahmed","No"/);
  assert.equal(outageNoticeFilename(), 'outage-notice-checklists.csv');
});

test('list normalisation drops bad rows and bad notice dates', () => {
  const clean = normalizeOutageNoticeList([
    listA,
    { id: 'bad', outageRef: 'OUT-9', mohallas: [{ mohalla: 'M1', method: 'Call', date: '2026-02-30', operator: 'Saad' }] },
    null,
    'nope',
  ]);
  assert.equal(clean.length, 2);
  assert.equal(clean[1].mohallas[0].method, '');
  assert.equal(clean[1].mohallas[0].date, '');
});

test('purity fence: the module imports nothing', () => {
  const src = fs.readFileSync(new URL('../outage-notice.js', import.meta.url), 'utf8');
  assert.ok(!/^import /m.test(src));
  assert.ok(!src.includes('localStorage'));
  assert.ok(!src.includes('fetch('));
  assert.ok(!src.includes('Date.now'));
});

test('neighbour-module fence: calendar, outage type and notice draft exist and are untouched', () => {
  for (const name of ['maintenance-calendar.js', 'outage-type.js', 'maintenance-notice.js']) {
    assert.ok(fs.existsSync(new URL(`../${name}`, import.meta.url)));
  }
  const src = fs.readFileSync(new URL('../outage-notice.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('maintenance-calendar'));
  assert.ok(!src.includes('outage-type'));
  assert.ok(!src.includes('maintenance-notice'));
});

test('panel ids are present in index.html', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const id of ['onBody', 'onSummary', 'onOutageRef', 'onMohallas', 'onUnreached', 'onSaveBtn', 'onRemoveId', 'onRemoveBtn', 'onFilter', 'onIncompleteOnly', 'onExportBtn', 'onStepId', 'onStepMohalla', 'onStepMethod', 'onStepDate', 'onStepOperator', 'onStepBtn', 'onAddUnreachedId', 'onAddUnreachedName', 'onAddUnreachedBtn', 'onNoteId', 'onNoteDate', 'onNoteText', 'onNoteBtn']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wires the panel and the deployment guard holds', () => {
  const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './outage-notice.js'"));
  assert.ok(app.includes('renderOutageNotice()'));
  assert.ok(!/\bOLT\b/.test(app));
});
