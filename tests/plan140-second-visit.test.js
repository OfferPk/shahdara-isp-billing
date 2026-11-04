import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validSecondVisitDate,
  normalizeSecondVisit,
  normalizeSecondVisitList,
  findSecondVisit,
  upsertSecondVisit,
  removeSecondVisit,
  markSecondVisitOutcome,
  openSecondVisits,
  overdueSecondVisits,
  secondVisitSummaryText,
  secondVisitHtml,
  secondVisitOverdueHtml,
  secondVisitCsv,
  secondVisitFilename,
} from '../second-visit.js';

const dir = dirname(fileURLToPath(import.meta.url));

const rule = (over = {}) => ({
  id: 'SV-1',
  ticket: 'T-100',
  dueDate: '2026-11-10',
  outcome: 'pending',
  note: '',
  ...over,
});

test('strict dates: real dates pass, impossible dates refused', () => {
  assert.equal(validSecondVisitDate('2026-08-31'), '2026-08-31');
  assert.equal(validSecondVisitDate('2026-10-31'), '2026-10-31');
  assert.equal(validSecondVisitDate('2026-12-31'), '2026-12-31');
  assert.equal(validSecondVisitDate('2024-02-29'), '2024-02-29');
  assert.equal(validSecondVisitDate('2026-02-30'), null);
  assert.equal(validSecondVisitDate('2026-04-31'), null);
  assert.equal(validSecondVisitDate('2026-09-31'), null);
  assert.equal(validSecondVisitDate('2026-11-31'), null);
  assert.equal(validSecondVisitDate('2026-02-29'), null);
  assert.equal(validSecondVisitDate('not-a-date'), null);
  assert.equal(validSecondVisitDate(''), null);
  assert.equal(validSecondVisitDate(20261110), null);
});

test('half-formed rules refused: no id, no ticket, no or bad due date', () => {
  assert.equal(normalizeSecondVisit(rule({ id: '' })), null);
  assert.equal(normalizeSecondVisit(rule({ id: '   ' })), null);
  assert.equal(normalizeSecondVisit(rule({ ticket: '' })), null);
  assert.equal(normalizeSecondVisit(rule({ ticket: '   ' })), null);
  assert.equal(normalizeSecondVisit(rule({ dueDate: '' })), null);
  assert.equal(normalizeSecondVisit(rule({ dueDate: '2026-02-30' })), null);
  assert.equal(normalizeSecondVisit(null), null);
  assert.equal(normalizeSecondVisit('nope'), null);
});

test('unknown fields dropped, so a rule never grows a bill, payment, or ticket-status field', () => {
  const clean = normalizeSecondVisit(rule({
    status: 'closed', bill: 500, payment: 'P-1', closed: true, amount: 99,
  }));
  assert.deepEqual(Object.keys(clean).sort(), ['dueDate', 'id', 'note', 'outcome', 'ticket']);
});

test('unknown outcome defaults to pending', () => {
  assert.equal(normalizeSecondVisit(rule({ outcome: 'done' })).outcome, 'pending');
  assert.equal(normalizeSecondVisit(rule({ outcome: '' })).outcome, 'pending');
  assert.equal(normalizeSecondVisit(rule()).outcome, 'pending');
});

test('duplicate ids never rewritten: identical re-save unchanged, different figures refused', () => {
  const list = [rule()];
  assert.deepEqual(upsertSecondVisit(list, rule()), list);
  assert.deepEqual(upsertSecondVisit(list, rule({ dueDate: '2026-11-12' })), list);
  assert.equal(upsertSecondVisit(list, rule({ dueDate: '2026-11-12' })).length, 1);
});

test('one open rule per ticket: a second open rule for the same ticket is refused', () => {
  const list = [rule()];
  assert.deepEqual(upsertSecondVisit(list, rule({ id: 'SV-2' })), list);
  const closed = markSecondVisitOutcome(list, 'SV-1', 'closed');
  const next = upsertSecondVisit(closed, rule({ id: 'SV-2' }));
  assert.equal(next.length, 2);
});

test('normalize list drops half-formed rows and duplicate ids, first wins', () => {
  const list = normalizeSecondVisitList([rule(), rule({ dueDate: '2026-02-30' }), rule({ note: 'later' }), null]);
  assert.equal(list.length, 1);
  assert.equal(list[0].note, '');
});

test('find and remove work by trimmed id', () => {
  const list = [rule(), rule({ id: 'SV-2', ticket: 'T-200', dueDate: '2026-11-09' })];
  assert.equal(findSecondVisit(list, ' SV-2 ').ticket, 'T-200');
  assert.equal(findSecondVisit(list, 'SV-9'), null);
  assert.equal(removeSecondVisit(list, 'SV-1').length, 1);
  assert.equal(removeSecondVisit(list, 'SV-9').length, 2);
});

test('outcome moves forward only; a closed rule never reopens', () => {
  const list = [rule()];
  assert.equal(markSecondVisitOutcome(list, 'SV-1', 'still-open')[0].outcome, 'still-open');
  assert.equal(markSecondVisitOutcome(list, 'SV-1', 'missed')[0].outcome, 'missed');
  const closed = markSecondVisitOutcome(list, 'SV-1', 'closed');
  assert.equal(closed[0].outcome, 'closed');
  assert.equal(markSecondVisitOutcome(closed, 'SV-1', 'pending')[0].outcome, 'closed');
  assert.equal(markSecondVisitOutcome(closed, 'SV-1', 'still-open')[0].outcome, 'closed');
  const reopened = markSecondVisitOutcome(list, 'SV-1', 'still-open');
  assert.equal(markSecondVisitOutcome(reopened, 'SV-1', 'closed')[0].outcome, 'closed');
  assert.equal(markSecondVisitOutcome(reopened, 'SV-1', 'pending')[0].outcome, 'still-open');
  assert.deepEqual(markSecondVisitOutcome(list, 'SV-1', 'done'), list);
  assert.deepEqual(markSecondVisitOutcome(list, 'SV-9', 'closed'), list);
});

test('open list sorted by due date then id, closed rules excluded', () => {
  const list = [
    rule({ id: 'SV-3', ticket: 'T-300', dueDate: '2026-11-12' }),
    rule({ id: 'SV-1', ticket: 'T-100', dueDate: '2026-11-10' }),
    rule({ id: 'SV-2', ticket: 'T-200', dueDate: '2026-11-10' }),
    rule({ id: 'SV-4', ticket: 'T-400', dueDate: '2026-11-09', outcome: 'closed' }),
  ];
  assert.deepEqual(openSecondVisits(list).map((item) => item.id), ['SV-1', 'SV-2', 'SV-3']);
});

test('overdue list: due strictly before today, closed rules never overdue', () => {
  const list = [
    rule({ id: 'SV-1', dueDate: '2026-11-09' }),
    rule({ id: 'SV-2', ticket: 'T-200', dueDate: '2026-11-10' }),
    rule({ id: 'SV-3', ticket: 'T-300', dueDate: '2026-11-11' }),
    rule({ id: 'SV-4', ticket: 'T-400', dueDate: '2026-11-01', outcome: 'closed' }),
  ];
  assert.deepEqual(overdueSecondVisits(list, '2026-11-10').map((item) => item.id), ['SV-1']);
  assert.deepEqual(overdueSecondVisits(list, '2026-11-09'), []);
  assert.deepEqual(overdueSecondVisits(list, 'not-a-date'), []);
});

test('a ticket closed on the second visit leaves the open and overdue lists', () => {
  const list = [rule({ dueDate: '2026-11-09' })];
  assert.equal(openSecondVisits(list).length, 1);
  assert.equal(overdueSecondVisits(list, '2026-11-10').length, 1);
  const closed = markSecondVisitOutcome(list, 'SV-1', 'closed');
  assert.equal(openSecondVisits(closed).length, 0);
  assert.equal(overdueSecondVisits(closed, '2026-11-10').length, 0);
  assert.equal(closed.length, 1);
});

test('inputs are never mutated', () => {
  const input = rule({ note: 'first' });
  const before = JSON.stringify(input);
  upsertSecondVisit([], input);
  markSecondVisitOutcome([input], 'SV-1', 'closed');
  removeSecondVisit([input], 'SV-1');
  assert.equal(JSON.stringify(input), before);
});

test('summary text counts rules and open rules', () => {
  assert.equal(secondVisitSummaryText([]), '0 second-visit rules, 0 open');
  assert.equal(secondVisitSummaryText([rule()]), '1 second-visit rule, 1 open');
  const closed = markSecondVisitOutcome([rule()], 'SV-1', 'closed');
  assert.equal(secondVisitSummaryText(closed), '1 second-visit rule, 0 open');
});

test('open HTML filters by ticket and says plainly when empty', () => {
  const list = [rule(), rule({ id: 'SV-2', ticket: 'T-200', dueDate: '2026-11-09' })];
  const all = secondVisitHtml(list, '');
  assert.match(all, /SV-1/);
  assert.match(all, /SV-2/);
  assert.match(secondVisitHtml(list, 'T-200'), /SV-2/);
  assert.doesNotMatch(secondVisitHtml(list, 'T-200'), /SV-1/);
  assert.match(secondVisitHtml([], ''), /No open second visit/);
});

test('overdue HTML says plainly when nothing is overdue', () => {
  assert.match(secondVisitOverdueHtml([], '2026-11-10'), /No second visit is overdue/);
  assert.match(secondVisitOverdueHtml([rule()], '2026-11-10'), /No second visit is overdue/);
  assert.match(secondVisitOverdueHtml([rule()], '2026-11-11'), /SV-1/);
});

test('HTML output escapes markup in ticket and note', () => {
  const html = secondVisitHtml([rule({ ticket: '<b>T</b>', note: '<script>x</script>' })], '');
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;b&gt;T&lt;\/b&gt;/);
});

test('CSV rows and filename', () => {
  const csv = secondVisitCsv([rule({ note: 'a, "quoted" note' })]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,ticket,dueDate,outcome,note');
  assert.match(lines[1], /"a, ""quoted"" note"/);
  assert.equal(secondVisitFilename(), 'second-visits.csv');
});

test('purity fence: module has no imports, storage, DOM, or network access', () => {
  const source = readFileSync(join(dir, '..', 'second-visit.js'), 'utf8');
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /localStorage|document\.|window\.|fetch\(|XMLHttpRequest/);
});

test('panel ids exist in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of [
    'secondVisitSummary', 'secondVisitExportBtn', 'secondVisitTicket',
    'secondVisitDue', 'secondVisitNote', 'secondVisitSaveBtn',
    'secondVisitFilter', 'secondVisitBody', 'secondVisitOverdueBody',
    'secondVisitOutcomeId', 'secondVisitOutcome', 'secondVisitOutcomeBtn',
    'secondVisitRemoveId', 'secondVisitRemoveBtn',
  ]) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
