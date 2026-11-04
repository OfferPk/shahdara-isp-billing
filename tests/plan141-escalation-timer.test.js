import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validEscalationDate,
  escalationAgeDays,
  thresholdStage,
  normalizeEscalation,
  normalizeEscalationList,
  findEscalation,
  upsertEscalation,
  removeEscalation,
  effectiveEscalation,
  recordEscalationStage,
  closeEscalation,
  ageingEscalations,
  escalationSummaryText,
  escalationHtml,
  escalationCsv,
  escalationFilename,
} from '../escalation-timer.js';

const dir = dirname(fileURLToPath(import.meta.url));

const rec = (over = {}) => ({
  id: 'ESC-1',
  ticket: 'T-100',
  openedDate: '2026-11-01',
  watchDays: 3,
  escalatedDays: 7,
  stage: 'open',
  stageChangedDate: '2026-11-01',
  status: 'open',
  note: '',
  ...over,
});

test('strict dates: real dates pass, impossible dates fail', () => {
  assert.equal(validEscalationDate('2026-08-31'), '2026-08-31');
  assert.equal(validEscalationDate('2026-10-31'), '2026-10-31');
  assert.equal(validEscalationDate('2026-12-31'), '2026-12-31');
  assert.equal(validEscalationDate('2026-02-30'), null);
  assert.equal(validEscalationDate('2026-11-31'), null);
  assert.equal(validEscalationDate('2026-11-1'), null);
  assert.equal(validEscalationDate(''), null);
  assert.equal(validEscalationDate(null), null);
});

test('half-formed records are refused outright', () => {
  assert.equal(normalizeEscalation(rec({ id: '' })), null);
  assert.equal(normalizeEscalation(rec({ ticket: '  ' })), null);
  assert.equal(normalizeEscalation(rec({ openedDate: '2026-02-30' })), null);
  assert.equal(normalizeEscalation(rec({ watchDays: 0 })), null);
  assert.equal(normalizeEscalation(rec({ watchDays: -2 })), null);
  assert.equal(normalizeEscalation(rec({ watchDays: 2.5 })), null);
  assert.equal(normalizeEscalation(rec({ escalatedDays: 'seven' })), null);
  assert.equal(normalizeEscalation(null), null);
  assert.equal(normalizeEscalation('nope'), null);
});

test('escalated threshold must sit strictly above the watch threshold', () => {
  assert.equal(normalizeEscalation(rec({ watchDays: 7, escalatedDays: 7 })), null);
  assert.equal(normalizeEscalation(rec({ watchDays: 9, escalatedDays: 7 })), null);
  assert.notEqual(normalizeEscalation(rec({ watchDays: 3, escalatedDays: 7 })), null);
});

test('numeric-string day counts are accepted, stage defaults when blank', () => {
  const row = normalizeEscalation(rec({ watchDays: '3', escalatedDays: '7', stage: '', stageChangedDate: '' }));
  assert.equal(row.watchDays, 3);
  assert.equal(row.escalatedDays, 7);
  assert.equal(row.stage, 'open');
  assert.equal(row.stageChangedDate, '2026-11-01');
});

test('unknown fields are dropped, so a record never grows a priority or bill field', () => {
  const row = normalizeEscalation(rec({ priority: 'high', billTotal: 500, ticketStatus: 'closed' }));
  assert.equal(row.priority, undefined);
  assert.equal(row.billTotal, undefined);
  assert.equal(row.ticketStatus, undefined);
});

test('age in whole days, never negative before the opened date', () => {
  assert.equal(escalationAgeDays('2026-11-01', '2026-11-08'), 7);
  assert.equal(escalationAgeDays('2026-11-01', '2026-11-01'), 0);
  assert.equal(escalationAgeDays('2026-11-08', '2026-11-01'), 0);
  assert.equal(escalationAgeDays('2026-11-01', 'not-a-date'), null);
});

test('threshold stage crosses exactly on the threshold day', () => {
  const row = rec();
  assert.equal(thresholdStage(row, '2026-11-03'), 'open');
  assert.equal(thresholdStage(row, '2026-11-04'), 'watch');
  assert.equal(thresholdStage(row, '2026-11-07'), 'watch');
  assert.equal(thresholdStage(row, '2026-11-08'), 'escalated');
});

test('effective stage never moves backwards, and the crossing date is opened plus threshold days', () => {
  const young = rec({ stage: 'escalated', stageChangedDate: '2026-11-02' });
  const eff = effectiveEscalation(young, '2026-11-02');
  assert.equal(eff.stage, 'escalated');
  assert.equal(eff.stageChangedDate, '2026-11-02');
  const crossed = effectiveEscalation(rec(), '2026-11-08');
  assert.equal(crossed.stage, 'escalated');
  assert.equal(crossed.stageChangedDate, '2026-11-08');
  const watched = effectiveEscalation(rec(), '2026-11-05');
  assert.equal(watched.stage, 'watch');
  assert.equal(watched.stageChangedDate, '2026-11-04');
});

test('duplicate ids are never rewritten', () => {
  const list = [rec()];
  assert.deepEqual(upsertEscalation(list, rec()), list);
  assert.deepEqual(upsertEscalation(list, rec({ note: 'changed' })), list);
});

test('one record per open ticket; a closed ticket may gain a fresh record', () => {
  const list = [rec()];
  assert.deepEqual(upsertEscalation(list, rec({ id: 'ESC-2' })), list);
  const closed = closeEscalation(list, 'ESC-1');
  const next = upsertEscalation(closed, rec({ id: 'ESC-2' }));
  assert.equal(next.length, 2);
});

test('list normalize drops half-formed rows and later duplicate ids', () => {
  const rows = normalizeEscalationList([rec(), rec({ ticket: '' }), rec({ id: 'ESC-1', note: 'dup' })]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].note, '');
});

test('find and remove work by id only', () => {
  const list = [rec(), rec({ id: 'ESC-2', ticket: 'T-200' })];
  assert.equal(findEscalation(list, 'ESC-2').ticket, 'T-200');
  assert.equal(findEscalation(list, 'ESC-9'), null);
  assert.equal(removeEscalation(list, 'ESC-1').length, 1);
  assert.equal(removeEscalation(list, '').length, 2);
});

test('operator-recorded stage moves forward only, never on a closed record', () => {
  const list = [rec()];
  const watched = recordEscalationStage(list, 'ESC-1', 'watch', '2026-11-03');
  assert.equal(watched[0].stage, 'watch');
  assert.equal(watched[0].stageChangedDate, '2026-11-03');
  const back = recordEscalationStage(watched, 'ESC-1', 'open', '2026-11-04');
  assert.deepEqual(back, watched);
  const bad = recordEscalationStage(list, 'ESC-1', 'escalated', '2026-02-30');
  assert.deepEqual(bad, list);
  const unknown = recordEscalationStage(list, 'ESC-1', 'urgent', '2026-11-04');
  assert.deepEqual(unknown, list);
  const closed = closeEscalation(list, 'ESC-1');
  assert.deepEqual(recordEscalationStage(closed, 'ESC-1', 'watch', '2026-11-04'), closed);
});

test('closing is terminal and leaves the ageing list at once', () => {
  const list = [rec(), rec({ id: 'ESC-2', ticket: 'T-200', openedDate: '2026-10-20' })];
  const closed = closeEscalation(list, 'ESC-1');
  assert.equal(ageingEscalations(closed, '2026-11-10').length, 1);
  assert.equal(ageingEscalations(closed, '2026-11-10')[0].id, 'ESC-2');
  assert.deepEqual(closeEscalation(closed, 'ESC-1'), closed);
});

test('ageing list sorts by stage, then age descending, then id A-Z', () => {
  const list = [
    rec({ id: 'ESC-A', ticket: 'T-A', openedDate: '2026-11-05' }),
    rec({ id: 'ESC-B', ticket: 'T-B', openedDate: '2026-10-20' }),
    rec({ id: 'ESC-C', ticket: 'T-C', openedDate: '2026-10-25' }),
    rec({ id: 'ESC-D', ticket: 'T-D', openedDate: '2026-10-25', status: 'closed' }),
  ];
  const rows = ageingEscalations(list, '2026-11-10');
  assert.deepEqual(rows.map((r) => r.id), ['ESC-B', 'ESC-C', 'ESC-A']);
  assert.deepEqual(rows.map((r) => r.stage), ['escalated', 'escalated', 'watch']);
  assert.deepEqual(rows.map((r) => r.ageDays), [21, 16, 5]);
});

test('an invalid reference date gives an empty ageing list, never a guessed order', () => {
  assert.deepEqual(ageingEscalations([rec()], 'nope'), []);
  assert.deepEqual(ageingEscalations([rec()], ''), []);
});

test('inputs are never mutated', () => {
  const list = [rec()];
  const snapshot = JSON.stringify(list);
  upsertEscalation(list, rec({ id: 'ESC-2', ticket: 'T-200' }));
  recordEscalationStage(list, 'ESC-1', 'watch', '2026-11-03');
  closeEscalation(list, 'ESC-1');
  ageingEscalations(list, '2026-11-10');
  assert.equal(JSON.stringify(list), snapshot);
});

test('summary text counts timers, ageing rows and escalated rows', () => {
  const list = [rec(), rec({ id: 'ESC-2', ticket: 'T-200', openedDate: '2026-10-20' })];
  assert.equal(escalationSummaryText(list, '2026-11-10'), '2 escalation timers, 2 ageing, 2 escalated');
  assert.equal(escalationSummaryText([], '2026-11-10'), '0 escalation timers, 0 ageing, 0 escalated');
});

test('HTML escapes ticket text and says plainly when nothing is ageing', () => {
  const html = escalationHtml([rec({ ticket: '<b>T</b>' })], '2026-11-10', '');
  assert.ok(html.includes('&lt;b&gt;T&lt;/b&gt;'));
  assert.ok(!html.includes('<b>T</b>'));
  assert.ok(escalationHtml([], '2026-11-10', '').includes('No open ticket is ageing'));
  const filtered = escalationHtml([rec()], '2026-11-10', 'T-999');
  assert.ok(filtered.includes('No open ticket is ageing'));
});

test('CSV header and rows carry every field', () => {
  const csv = escalationCsv([rec({ note: 'a, "b"' })]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'id,ticket,openedDate,watchDays,escalatedDays,stage,stageChangedDate,status,note');
  assert.ok(lines[1].includes('"a, ""b"""'));
  assert.equal(escalationFilename(), 'escalation-timers.csv');
});

test('panel element ids exist in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['escSummary', 'escExportBtn', 'escTicket', 'escOpened', 'escWatch',
    'escEscalated', 'escNote', 'escSaveBtn', 'escFilter', 'escBody', 'escStageId',
    'escStage', 'escStageDate', 'escStageBtn', 'escCloseId', 'escCloseBtn',
    'escRemoveId', 'escRemoveBtn']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
