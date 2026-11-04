import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeApologyDraft,
  normalizeApologyDraftList,
  findApologyDraft,
  upsertApologyDraft,
  removeApologyDraft,
  markApologyDraftSent,
  markApologyDraftUnsent,
  apologyDraftsForTopic,
  apologyDraftTopics,
  sentApologyDrafts,
  unsentApologyDrafts,
  apologyDraftStarters,
  draftPromisesNothing,
  apologyDraftText,
  apologyDraftSummaryText,
  apologyDraftHtml,
  apologyDraftCsv,
  apologyDraftFilename,
} from '../apology-draft.js';

const dir = dirname(fileURLToPath(import.meta.url));

const draft = (over = {}) => ({
  id: 'APO-1',
  topic: 'Slow speed',
  whatHappened: 'Your connection has been slower than usual.',
  whatNext: 'We will check the line and let you know what we find.',
  customerAction: 'Please restart your router once and tell us if it is still slow.',
  sent: false,
  sentDate: '',
  ...over,
});

test('half-formed drafts are refused', () => {
  assert.equal(normalizeApologyDraft(draft({ id: '' })), null);
  assert.equal(normalizeApologyDraft(draft({ topic: '' })), null);
  assert.equal(normalizeApologyDraft(draft({ whatHappened: '' })), null);
  assert.equal(normalizeApologyDraft(draft({ whatNext: '' })), null);
  assert.equal(normalizeApologyDraft(draft({ customerAction: '' })), null);
  assert.equal(normalizeApologyDraft(null), null);
});

test('a draft promising a credit, refund, discount, waiver, or compensation is refused', () => {
  assert.equal(normalizeApologyDraft(draft({ whatNext: 'We will give you a credit.' })), null);
  assert.equal(normalizeApologyDraft(draft({ whatHappened: 'You asked for a refund.' })), null);
  assert.equal(normalizeApologyDraft(draft({ customerAction: 'Claim your discount now.' })), null);
  assert.equal(normalizeApologyDraft(draft({ whatNext: 'We will waive the fee.' })), null);
  assert.equal(normalizeApologyDraft(draft({ whatNext: 'Compensation will follow.' })), null);
  // Whole-word match only: "refund" inside another word does not refuse.
  assert.notEqual(normalizeApologyDraft(draft({ whatNext: 'We refunded nothing, we only explain.' })), null);
  assert.equal(draftPromisesNothing('a', 'b', 'c'), true);
  assert.equal(draftPromisesNothing('a credit', 'b', 'c'), false);
});

test('unknown fields are dropped and a bad sent date keeps no sent date', () => {
  const clean = normalizeApologyDraft(draft({ billId: 'B-9', paymentTotal: 500, sent: true, sentDate: '2026-02-30' }));
  assert.deepEqual(Object.keys(clean).sort(), ['customerAction', 'id', 'sent', 'sentDate', 'topic', 'whatHappened', 'whatNext']);
  assert.equal(clean.sentDate, '');
  const dated = normalizeApologyDraft(draft({ sent: true, sentDate: '2026-11-01' }));
  assert.equal(dated.sentDate, '2026-11-01');
});

test('duplicate ids are never rewritten', () => {
  const base = [draft()];
  assert.deepEqual(upsertApologyDraft(base, draft()), base);
  assert.deepEqual(upsertApologyDraft(base, draft({ topic: 'Other topic' })), base);
  assert.equal(upsertApologyDraft(base, draft({ id: 'APO-2' })).length, 2);
});

test('find and remove', () => {
  assert.equal(findApologyDraft([draft()], 'APO-1').topic, 'Slow speed');
  assert.equal(findApologyDraft([draft()], 'nope'), null);
  assert.deepEqual(removeApologyDraft([draft()], 'APO-1'), []);
  assert.equal(removeApologyDraft([draft()], '').length, 1);
});

test('marking sent needs a strict date and marking not sent clears both', () => {
  assert.deepEqual(markApologyDraftSent([draft()], 'APO-1', '2026-02-30'), [draft()]);
  assert.deepEqual(markApologyDraftSent([draft()], 'nope', '2026-11-01'), [draft()]);
  const sent = markApologyDraftSent([draft()], 'APO-1', '2026-11-01');
  assert.equal(sent[0].sent, true);
  assert.equal(sent[0].sentDate, '2026-11-01');
  const unsent = markApologyDraftUnsent(sent, 'APO-1');
  assert.equal(unsent[0].sent, false);
  assert.equal(unsent[0].sentDate, '');
});

test('topic view is case-insensitive and topics list keeps first spelling A-Z', () => {
  const list = [draft(), draft({ id: 'APO-2', topic: 'Missed visit' }), draft({ id: 'APO-3', topic: 'slow SPEED' })];
  assert.equal(apologyDraftsForTopic(list, 'slow speed').length, 2);
  assert.deepEqual(apologyDraftTopics(list), ['Missed visit', 'Slow speed']);
  assert.equal(apologyDraftsForTopic(list, '').length, 0);
});

test('sent and unsent lists', () => {
  const list = [draft(), draft({ id: 'APO-2', sent: true, sentDate: '2026-11-01' })];
  assert.equal(sentApologyDrafts(list).length, 1);
  assert.equal(unsentApologyDrafts(list).length, 1);
});

test('starter drafts cover slow speed, bill confusion, and a missed visit', () => {
  const starters = apologyDraftStarters();
  assert.equal(starters.length, 3);
  assert.deepEqual(starters.map((item) => item.topic), ['Slow speed', 'Confusion about a bill', 'Missed visit']);
  for (const item of starters) {
    assert.notEqual(normalizeApologyDraft(item), null);
    assert.ok(apologyDraftText(item).includes('No credit or refund is promised'));
  }
  // Recording starters twice changes nothing.
  let list = [];
  for (const item of starters) list = upsertApologyDraft(list, item);
  for (const item of starters) list = upsertApologyDraft(list, item);
  assert.equal(list.length, 3);
});

test('draft text states all three parts and the promise-free line', () => {
  const textOut = apologyDraftText(draft());
  assert.ok(textOut.includes('Your connection has been slower than usual.'));
  assert.ok(textOut.includes('We will check the line'));
  assert.ok(textOut.includes('Please restart your router'));
  assert.ok(textOut.includes('No credit or refund is promised'));
  assert.ok(textOut.includes('Not sent yet.'));
  assert.ok(apologyDraftText(draft({ sent: true, sentDate: '2026-11-01' })).includes('Sent on 2026-11-01.'));
  assert.equal(apologyDraftText(draft({ topic: '' })), '');
});

test('summary text counts sent and unsent', () => {
  const list = [draft(), draft({ id: 'APO-2', sent: true, sentDate: '2026-11-01' })];
  assert.equal(apologyDraftSummaryText(list), '2 apology drafts, 1 marked sent, 1 not sent');
});

test('HTML escapes user text', () => {
  const html = apologyDraftHtml(draft({ topic: '<b>Slow</b>', whatHappened: 'a & b' }));
  assert.ok(!html.includes('<b>Slow</b>'));
  assert.ok(html.includes('&lt;b&gt;Slow&lt;/b&gt;'));
  assert.ok(html.includes('a &amp; b'));
});

test('CSV and filename', () => {
  const csv = apologyDraftCsv([draft()]);
  assert.ok(csv.startsWith('id,topic,whatHappened,whatNext,customerAction,sent,sentDate'));
  assert.ok(csv.includes('"APO-1"'));
  assert.equal(apologyDraftFilename(), 'apology-drafts.csv');
});

test('inputs are never mutated', () => {
  const input = draft();
  const snapshot = JSON.stringify(input);
  upsertApologyDraft([], input);
  markApologyDraftSent([input], 'APO-1', '2026-11-01');
  assert.equal(JSON.stringify(input), snapshot);
});

test('list normalization drops bad records and non-lists', () => {
  assert.deepEqual(normalizeApologyDraftList(null), []);
  assert.deepEqual(normalizeApologyDraftList([draft(), draft({ id: '' })]).length, 1);
});

test('purity fence: the module never reads storage, the clock, or the network', () => {
  const source = readFileSync(join(dir, '..', 'apology-draft.js'), 'utf8');
  assert.ok(!source.includes('new Date('));
  assert.ok(!source.includes('Date.now('));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('fetch('));
});

test('panel element ids are present in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['adHeading', 'adSummary', 'adExportBtn', 'adTopic', 'adHappened', 'adNext', 'adAction', 'adSaveBtn', 'adStarterBtn', 'adSentId', 'adSentDate', 'adSentBtn', 'adUnsentId', 'adUnsentBtn', 'adRemoveId', 'adRemoveBtn', 'adFilter', 'adBody']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});

test('app.js wires the apology-draft panel and render loop', () => {
  const source = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.ok(source.includes("from './apology-draft.js'"));
  assert.ok(source.includes('shahdara_apology_drafts_v1'));
  assert.ok(source.includes('renderApologyDrafts();'));
});

test('no standalone OLT word added to app.js', () => {
  const source = readFileSync(join(dir, '..', 'app.js'), 'utf8');
  assert.ok(!/(^|[^A-Za-z])OLT([^A-Za-z]|$)/.test(source));
});
