import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  FOLLOWUP_OPEN_STATUSES,
  ESCALATION_STEPS,
  validFollowUpDate,
  normalizeFollowUp,
  normalizeFollowUpList,
  findFollowUp,
  recordFollowUp,
  removeFollowUp,
  followUpsForOwner,
  buildFollowUpQueue,
  escalationList,
  buildFollowUpSummary,
  followUpSummaryText,
  followUpHtml,
  followUpCsv,
  followUpFilename,
} from '../dispute-followups.js';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'dispute-followups.js'), 'utf8');
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');

const follow = (overrides = {}) => ({
  id: 'FU-1',
  caseId: 'DISP-1',
  customerId: 'CUST-76',
  owner: 'Saad',
  nextFollowUpDate: '2026-11-10',
  lastFollowUpDate: '2026-11-03',
  escalationStep: 'reminder',
  note: 'Customer asked for a call back',
  ...overrides,
});

const disputeCase = (overrides = {}) => ({
  id: 'DISP-1',
  customerId: 'CUST-76',
  customerName: 'Orient school',
  billId: 'BILL-1',
  reason: 'wrong_amount',
  status: 'open',
  ...overrides,
});

test('plan117: strict dates — 2026-02-30, bad shapes, and non-strings refused', () => {
  assert.equal(validFollowUpDate('2026-02-30'), null);
  assert.equal(validFollowUpDate('2026-13-01'), null);
  assert.equal(validFollowUpDate('10-11-2026'), null);
  assert.equal(validFollowUpDate(20261110), null);
  assert.equal(validFollowUpDate('2026-02-28'), '2026-02-28');
  assert.equal(validFollowUpDate(' 2026-11-10 '), '2026-11-10');
});

test('plan117: half-formed follow-up refused, list unchanged', () => {
  const base = [follow()];
  assert.deepEqual(recordFollowUp(base, follow({ caseId: '' })), base);
  assert.deepEqual(recordFollowUp(base, follow({ owner: '   ' })), base);
  assert.deepEqual(recordFollowUp(base, follow({ nextFollowUpDate: '2026-02-30' })), base);
  assert.deepEqual(recordFollowUp(base, follow({ escalationStep: 'shout' })), base);
  assert.deepEqual(recordFollowUp(base, follow({ lastFollowUpDate: 'not-a-date' })), base);
  assert.equal(normalizeFollowUp(null), null);
  assert.equal(normalizeFollowUp({}), null);
});

test('plan117: unknown fields dropped, step defaults to none', () => {
  const item = normalizeFollowUp(follow({ outcome: 'refund given', amountCents: 5000, escalationStep: '' }));
  assert.equal(item.outcome, undefined);
  assert.equal(item.amountCents, undefined);
  assert.equal(item.escalationStep, 'none');
  assert.equal(item.owner, 'Saad');
});

test('plan117: one record per case — second record replaces, never duplicates', () => {
  const next = recordFollowUp([follow()], follow({ id: 'FU-2', nextFollowUpDate: '2026-11-20', note: 'New date agreed' }));
  assert.equal(next.length, 1);
  assert.equal(next[0].id, 'FU-2');
  assert.equal(next[0].nextFollowUpDate, '2026-11-20');
  assert.equal(next[0].note, 'New date agreed');
  const other = recordFollowUp(next, follow({ id: 'FU-3', caseId: 'DISP-2' }));
  assert.equal(other.length, 2);
});

test('plan117: find, owner filter, and remove by case id', () => {
  const list = [follow(), follow({ id: 'FU-2', caseId: 'DISP-2', owner: 'Owner' })];
  assert.equal(findFollowUp(list, 'DISP-2').owner, 'Owner');
  assert.equal(findFollowUp(list, 'DISP-9'), null);
  assert.equal(followUpsForOwner(list, 'Saad').length, 1);
  assert.equal(followUpsForOwner(list, '').length, 2);
  assert.deepEqual(removeFollowUp(list, 'DISP-1').map((e) => e.caseId), ['DISP-2']);
  assert.deepEqual(removeFollowUp(list, ''), normalizeFollowUpList(list));
});

test('plan117: queue shows only open cases; resolved never appears', () => {
  const cases = [
    disputeCase(),
    disputeCase({ id: 'DISP-2', status: 'investigating' }),
    disputeCase({ id: 'DISP-3', status: 'escalated' }),
    disputeCase({ id: 'DISP-4', status: 'resolved', outcome: 'Adjusted' }),
  ];
  const queue = buildFollowUpQueue(cases, [follow()], '2026-11-04');
  assert.deepEqual(queue.map((e) => e.caseId), ['DISP-1', 'DISP-2', 'DISP-3']);
  assert.deepEqual(FOLLOWUP_OPEN_STATUSES, ['open', 'investigating', 'escalated']);
});

test('plan117: case with no follow-up shows null next date, never an invented date', () => {
  const queue = buildFollowUpQueue([disputeCase()], [], '2026-11-04');
  assert.equal(queue[0].nextFollowUpDate, null);
  assert.equal(queue[0].overdue, false);
  assert.equal(queue[0].daysOverdue, 0);
  assert.equal(queue[0].owner, '');
  assert.equal(escalationList(queue).length, 0);
});

test('plan117: overdue math — due today is not overdue, yesterday is 1 day', () => {
  const cases = [disputeCase()];
  const today = buildFollowUpQueue(cases, [follow({ nextFollowUpDate: '2026-11-04' })], '2026-11-04');
  assert.equal(today[0].overdue, false);
  const yesterday = buildFollowUpQueue(cases, [follow({ nextFollowUpDate: '2026-11-03' })], '2026-11-04');
  assert.equal(yesterday[0].overdue, true);
  assert.equal(yesterday[0].daysOverdue, 1);
  const future = buildFollowUpQueue(cases, [follow({ nextFollowUpDate: '2026-11-10' })], '2026-11-04');
  assert.equal(future[0].overdue, false);
  assert.equal(future[0].daysOverdue, 0);
  const leap = buildFollowUpQueue(cases, [follow({ nextFollowUpDate: '2026-02-28' })], '2026-03-01');
  assert.equal(leap[0].daysOverdue, 1);
});

test('plan117: escalation list ordered most overdue first, ties by case id', () => {
  const cases = [
    disputeCase({ id: 'DISP-1' }),
    disputeCase({ id: 'DISP-2' }),
    disputeCase({ id: 'DISP-3' }),
    disputeCase({ id: 'DISP-4' }),
  ];
  const follows = [
    follow({ id: 'FU-1', caseId: 'DISP-1', nextFollowUpDate: '2026-10-20' }),
    follow({ id: 'FU-2', caseId: 'DISP-2', nextFollowUpDate: '2026-10-20' }),
    follow({ id: 'FU-3', caseId: 'DISP-3', nextFollowUpDate: '2026-11-01' }),
    follow({ id: 'FU-4', caseId: 'DISP-4', nextFollowUpDate: '2026-11-10' }),
  ];
  const esc = escalationList(buildFollowUpQueue(cases, follows, '2026-11-04'));
  assert.deepEqual(esc.map((e) => e.caseId), ['DISP-1', 'DISP-2', 'DISP-3']);
  assert.equal(esc[0].daysOverdue, 15);
  assert.equal(esc[2].daysOverdue, 3);
});

test('plan117: recording a follow-up never touches the case list', () => {
  const cases = [disputeCase()];
  const before = JSON.parse(JSON.stringify(cases));
  buildFollowUpQueue(cases, [follow()], '2026-11-04');
  recordFollowUp([], follow());
  assert.deepEqual(cases, before);
  // The queue builder also leaves its inputs unchanged.
  const follows = [follow()];
  const followsBefore = JSON.parse(JSON.stringify(follows));
  buildFollowUpQueue(cases, follows, '2026-11-04');
  assert.deepEqual(follows, followsBefore);
});

test('plan117: bad today date yields an empty queue, never a crash', () => {
  assert.deepEqual(buildFollowUpQueue([disputeCase()], [follow()], 'not-a-date'), []);
  assert.deepEqual(buildFollowUpQueue(null, null, '2026-11-04'), []);
});

test('plan117: summary counts open, overdue, most overdue, and unset', () => {
  const cases = [disputeCase({ id: 'DISP-1' }), disputeCase({ id: 'DISP-2' }), disputeCase({ id: 'DISP-3' })];
  const follows = [
    follow({ id: 'FU-1', caseId: 'DISP-1', nextFollowUpDate: '2026-10-20' }),
    follow({ id: 'FU-2', caseId: 'DISP-2', nextFollowUpDate: '2026-11-10' }),
  ];
  const summary = buildFollowUpSummary(buildFollowUpQueue(cases, follows, '2026-11-04'));
  assert.deepEqual(summary, { openCases: 3, overdueCases: 1, mostOverdueDays: 15, withoutNextDate: 1 });
  assert.ok(followUpSummaryText(summary).includes('3 open case(s)'));
  assert.ok(followUpSummaryText(summary).includes('most overdue 15 day(s)'));
  assert.ok(followUpSummaryText(buildFollowUpSummary([])).includes('0 open case(s)'));
});

test('plan117: html escapes, csv quotes, filename', () => {
  const queue = buildFollowUpQueue([disputeCase({ customerName: '<b>Bad</b>' })], [follow({ note: 'a "quoted", note' })], '2026-11-04');
  const out = followUpHtml(queue);
  assert.ok(!out.includes('<b>Bad</b>'));
  assert.ok(out.includes('&lt;b&gt;Bad&lt;/b&gt;'));
  assert.ok(out.includes('OVERDUE') === false);
  const csv = followUpCsv(queue);
  assert.ok(csv.startsWith('case_id,customer_id'));
  assert.ok(csv.includes('"a ""quoted"", note"'));
  assert.equal(followUpFilename(), 'dispute-followups.csv');
  assert.equal(followUpHtml([]), '<p>No open dispute cases in the follow-up queue.</p>');
});

test('plan117: purity fence — no imports, storage, DOM, or dispute-module references', () => {
  assert.ok(!source.includes('dispute-cases'));
  assert.ok(!source.includes('dispute-resolutions'));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('document.'));
  assert.ok(!/^import /m.test(source));
  assert.ok(source.includes('never reads or writes a dispute case'));
  assert.deepEqual(ESCALATION_STEPS, ['none', 'reminder', 'owner_review', 'final_notice']);
});

test('plan117: panel element ids present in index.html', () => {
  const ids = [
    'followUpBody', 'followUpSummary', 'followUpCase', 'followUpOwner',
    'followUpNextDate', 'followUpStep', 'followUpNote', 'followUpSaveBtn',
    'followUpRemoveBtn', 'followUpToday', 'followUpEscalationBody', 'followUpExportBtn',
  ];
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
});
