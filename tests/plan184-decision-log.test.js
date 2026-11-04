import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeDecision,
  normalizeDecisionList,
  findDecision,
  recordDecision,
  removeDecision,
  decisionsSorted,
  decisionsForTopic,
  decisionsForDecider,
  decisionDeciders,
  decisionTopics,
  decisionText,
  decisionSummaryText,
  decisionHtml,
  decisionAllHtml,
  decisionCsv,
  decisionFilename,
} from '../decision-log.js';

const dir = dirname(fileURLToPath(import.meta.url));

const entry = (over = {}) => ({
  id: 'OD-1',
  topic: 'New mohalla',
  decision: 'Start work in Mohalla B next month',
  date: '2026-11-01',
  reason: 'Mohalla A is nearly full',
  options: ['Wait', 'Start now'],
  decidedBy: 'Owner',
  reviewDate: '2026-12-01',
  ...over,
});

test('refuses half-formed decisions', () => {
  assert.equal(normalizeDecision(entry({ id: '' })), null);
  assert.equal(normalizeDecision(entry({ topic: '' })), null);
  assert.equal(normalizeDecision(entry({ decision: '' })), null);
  assert.equal(normalizeDecision(entry({ date: '' })), null);
  assert.equal(normalizeDecision(null), null);
  assert.equal(normalizeDecision('nope'), null);
  assert.equal(normalizeDecision(entry({ reason: '', options: [], decidedBy: '', reviewDate: '' }))?.id, 'OD-1');
});

test('refuses impossible dates and bad review dates', () => {
  assert.equal(normalizeDecision(entry({ date: '2026-02-30' })), null);
  assert.equal(normalizeDecision(entry({ date: '2026-13-01' })), null);
  assert.equal(normalizeDecision(entry({ date: '01-11-2026' })), null);
  assert.equal(normalizeDecision(entry({ date: '2026-04-31' })), null);
  assert.equal(normalizeDecision(entry({ reviewDate: '2026-02-29' })), null);
  assert.equal(normalizeDecision(entry({ date: '2026-08-31' }))?.date, '2026-08-31');
  assert.equal(normalizeDecision(entry({ date: '2026-10-31' }))?.date, '2026-10-31');
  assert.equal(normalizeDecision(entry({ date: '2026-12-31' }))?.date, '2026-12-31');
});

test('accepts Feb 29 in leap years, refuses in non-leap years', () => {
  assert.equal(normalizeDecision(entry({ date: '2024-02-29' }))?.date, '2024-02-29');
  assert.equal(normalizeDecision(entry({ date: '2025-02-29' })), null);
  assert.equal(normalizeDecision(entry({ date: '2100-02-29' })), null);
});

test('normalizes options from arrays and newline strings, drops blanks', () => {
  assert.deepEqual(normalizeDecision(entry({ options: [' A ', '', 'B'] })).options, ['A', 'B']);
  assert.deepEqual(normalizeDecision(entry({ options: 'Wait\nStart now\n\n' })).options, ['Wait', 'Start now']);
  assert.deepEqual(normalizeDecision(entry({ options: undefined })).options, []);
  assert.deepEqual(normalizeDecision(entry({ options: 42 })).options, []);
});

test('drops unknown fields', () => {
  const kept = normalizeDecision(entry({ billId: 'B-1', amount: 500, sendNow: true }));
  assert.deepEqual(Object.keys(kept).sort(), ['date', 'decidedBy', 'decision', 'id', 'options', 'reason', 'reviewDate', 'topic']);
});

test('never rewrites a duplicate id', () => {
  const list = [entry()];
  assert.deepEqual(recordDecision(list, entry()), list);
  assert.deepEqual(recordDecision(list, entry({ decision: 'Different decision' })), list);
  assert.equal(recordDecision(list, entry({ id: 'OD-2' })).length, 2);
});

test('finds and removes by id', () => {
  const list = [entry(), entry({ id: 'OD-2', topic: 'Tool purchase' })];
  assert.equal(findDecision(list, 'OD-2').topic, 'Tool purchase');
  assert.equal(findDecision(list, 'OD-9'), null);
  assert.deepEqual(removeDecision(list, 'OD-1').map((item) => item.id), ['OD-2']);
  assert.equal(removeDecision(list, 'OD-9').length, 2);
});

test('lists newest first, id A-Z on ties', () => {
  const list = [
    entry({ id: 'OD-2', date: '2026-11-02' }),
    entry({ id: 'OD-1', date: '2026-11-01' }),
    entry({ id: 'OD-3', date: '2026-11-02' }),
  ];
  assert.deepEqual(decisionsSorted(list).map((item) => item.id), ['OD-2', 'OD-3', 'OD-1']);
});

test('searches by topic case-insensitively', () => {
  const list = [
    entry({ id: 'OD-1', topic: 'New mohalla' }),
    entry({ id: 'OD-2', topic: 'Tool purchase' }),
    entry({ id: 'OD-3', topic: 'Mohalla pricing' }),
  ];
  assert.deepEqual(decisionsForTopic(list, 'mohalla').map((item) => item.id), ['OD-1', 'OD-3']);
  assert.deepEqual(decisionsForTopic(list, 'MOHALLA').map((item) => item.id), ['OD-1', 'OD-3']);
  assert.deepEqual(decisionsForTopic(list, 'price').map((item) => item.id), []);
  assert.deepEqual(decisionsForTopic(list, ''), []);
});

test('lists deciders first-spelling A-Z and filters by decider', () => {
  const list = [
    entry({ id: 'OD-1', decidedBy: 'owner' }),
    entry({ id: 'OD-2', decidedBy: 'Saad' }),
    entry({ id: 'OD-3', decidedBy: 'Owner' }),
  ];
  assert.deepEqual(decisionDeciders(list), ['owner', 'Saad']);
  assert.deepEqual(decisionsForDecider(list, 'OWNER').map((item) => item.id), ['OD-1', 'OD-3']);
  assert.deepEqual(decisionsForDecider(list, ''), []);
});

test('lists topics first-spelling A-Z', () => {
  const list = [
    entry({ id: 'OD-1', topic: 'tool purchase' }),
    entry({ id: 'OD-2', topic: 'New mohalla' }),
    entry({ id: 'OD-3', topic: 'Tool Purchase' }),
  ];
  assert.deepEqual(decisionTopics(list), ['New mohalla', 'tool purchase']);
});

test('renders decision text with all parts and minimal parts', () => {
  assert.equal(
    decisionText(entry()),
    'Decision on 2026-11-01 [New mohalla]: Start work in Mohalla B next month. Reason: Mohalla A is nearly full. Options considered: Wait; Start now. Decided by Owner. Review on 2026-12-01.',
  );
  assert.equal(
    decisionText(entry({ reason: '', options: [], decidedBy: '', reviewDate: '' })),
    'Decision on 2026-11-01 [New mohalla]: Start work in Mohalla B next month.',
  );
  assert.equal(decisionText(null), '');
});

test('summarizes counts', () => {
  assert.equal(decisionSummaryText([entry(), entry({ id: 'OD-2' })]), '2 owner decisions recorded');
  assert.equal(decisionSummaryText([]), '0 owner decisions recorded');
});

test('escapes HTML', () => {
  const html = decisionHtml(entry({ decision: '<b>Bold</b> & "quoted"' }));
  assert.doesNotMatch(html, /<b>/);
  assert.match(html, /&lt;b&gt;Bold&lt;\/b&gt; &amp; &quot;quoted&quot;/);
  assert.equal(decisionHtml(null), '');
  assert.match(decisionAllHtml([entry()]), /New mohalla/);
});

test('exports CSV with filename', () => {
  const csv = decisionCsv([entry()]);
  assert.match(csv, /"id","topic","decision","date","reason","options","decided by","review date"/);
  assert.match(csv, /"OD-1","New mohalla","Start work in Mohalla B next month","2026-11-01","Mohalla A is nearly full","Wait; Start now","Owner","2026-12-01"/);
  assert.equal(decisionFilename(), 'owner-decisions.csv');
});

test('never mutates inputs', () => {
  const input = entry({ options: [' A ', 'B'] });
  const snapshot = JSON.stringify(input);
  const list = [input];
  recordDecision(list, entry({ id: 'OD-2' }));
  removeDecision(list, 'OD-1');
  decisionsSorted(list);
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(list.length, 1);
});

test('normalizes lists', () => {
  assert.deepEqual(normalizeDecisionList(null), []);
  assert.deepEqual(normalizeDecisionList('nope'), []);
  assert.deepEqual(normalizeDecisionList([entry(), entry(), entry({ id: 'OD-2', date: 'bad' })]).map((item) => item.id), ['OD-1']);
});

test('stays pure: no clock, storage, or network', () => {
  const source = readFileSync(join(dir, '..', 'decision-log.js'), 'utf8');
  assert.doesNotMatch(source, /new Date\(|Date\.now\(|fetch\(|localStorage|XMLHttpRequest/);
  assert.doesNotMatch(source, /from '\.\//);
  assert.doesNotMatch(source, /import /);
});

test('panel ids exist in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['odTopic', 'odDecision', 'odDate', 'odReason', 'odOptions', 'odBy', 'odReview', 'odSaveBtn', 'odRemoveId', 'odRemoveBtn', 'odSearch', 'odBody', 'odSummary', 'odExportBtn', 'odHeading']) {
    assert.match(html, new RegExp(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wiring is present', () => {
  const app = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.match(app, /from '\.\/decision-log\.js'/);
  assert.match(app, /renderOwnerDecision\(\)/);
  assert.match(app, /shahdara_owner_decisions_v1/);
});
