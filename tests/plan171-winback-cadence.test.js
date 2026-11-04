import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeCadenceSettings,
  normalizeWinbackCadence,
  normalizeWinbackCadenceList,
  findWinbackCadence,
  startWinbackCadence,
  removeWinbackCadence,
  completeWinbackStep,
  markWinbackCadenceReturned,
  markWinbackCadenceDoNotContact,
  winbackCadenceDueDate,
  winbackCadenceNext,
  winbackCadenceActive,
  winbackCadenceOverdue,
  winbackCadenceCustomers,
  winbackCadenceStepLabel,
  winbackCadenceDraftText,
  winbackCadenceSummaryText,
  winbackCadenceAllHtml,
  winbackCadenceCsv,
  winbackCadenceFilename,
} from '../winback-cadence.js';

const dir = dirname(fileURLToPath(import.meta.url));

const record = (over = {}) => ({
  id: 'WC-1',
  customerId: 'Cust A',
  startDate: '2026-11-01',
  ...over,
});

test('half-formed cadence records are refused', () => {
  assert.equal(normalizeWinbackCadence(null), null);
  assert.equal(normalizeWinbackCadence({ customerId: 'Cust A', startDate: '2026-11-01' }), null);
  assert.equal(normalizeWinbackCadence({ id: 'WC-1', startDate: '2026-11-01' }), null);
  assert.equal(normalizeWinbackCadence({ id: 'WC-1', customerId: 'Cust A' }), null);
  assert.equal(startWinbackCadence([], { id: 'WC-1', customerId: 'Cust A' }).length, 0);
});

test('strict dates: impossible dates refused, Feb 29 only in leap years', () => {
  assert.equal(normalizeWinbackCadence(record({ startDate: '2026-02-30' })), null);
  assert.equal(normalizeWinbackCadence(record({ startDate: '2026-04-31' })), null);
  assert.equal(normalizeWinbackCadence(record({ startDate: '2026-02-29' })), null);
  assert.notEqual(normalizeWinbackCadence(record({ startDate: '2024-02-29' })), null);
  assert.notEqual(normalizeWinbackCadence(record({ startDate: '2026-08-31' })), null);
  assert.notEqual(normalizeWinbackCadence(record({ startDate: '2026-10-31' })), null);
  assert.notEqual(normalizeWinbackCadence(record({ startDate: '2026-12-31' })), null);
});

test('unknown fields are dropped', () => {
  const clean = normalizeWinbackCadence(record({ billId: 'B-1', offer: 'free month', status: 'active' }));
  assert.equal(clean.billId, undefined);
  assert.equal(clean.offer, undefined);
  assert.equal(clean.status, 'active');
});

test('duplicate ids are never rewritten', () => {
  const first = startWinbackCadence([], record());
  const same = startWinbackCadence(first, record());
  assert.deepEqual(same, first);
  const changed = startWinbackCadence(first, record({ startDate: '2026-11-05' }));
  assert.deepEqual(changed, first);
});

test('one cadence record per customer, case-insensitive', () => {
  const first = startWinbackCadence([], record());
  assert.equal(startWinbackCadence(first, record({ id: 'WC-2', customerId: 'cust a' })).length, 1);
  assert.equal(startWinbackCadence(first, record({ id: 'WC-2', customerId: 'Cust B' })).length, 2);
});

test('a new cadence starts at step 1 due on the start date', () => {
  const list = startWinbackCadence([], record());
  const next = winbackCadenceNext(list, 'Cust A', null, '2026-11-01');
  assert.equal(next.step, 1);
  assert.equal(next.stepLabel, 'First follow-up');
  assert.equal(next.dueDate, '2026-11-01');
  assert.equal(next.overdue, false);
});

test('completing a step moves only the step marker', () => {
  const list = startWinbackCadence([], record());
  const moved = completeWinbackStep(list, 'WC-1', '2026-11-02');
  assert.equal(moved[0].step, 2);
  assert.equal(moved[0].lastStepDate, '2026-11-02');
  assert.equal(moved[0].customerId, 'Cust A');
  assert.equal(moved[0].startDate, '2026-11-01');
  assert.equal(moved[0].status, 'active');
});

test('step 2 falls due after the first gap, step 3 after the second gap', () => {
  const settings = { firstGapDays: 7, secondGapDays: 14 };
  let list = startWinbackCadence([], record());
  list = completeWinbackStep(list, 'WC-1', '2026-11-02');
  assert.equal(winbackCadenceDueDate(list[0], settings), '2026-11-09');
  list = completeWinbackStep(list, 'WC-1', '2026-11-10');
  assert.equal(winbackCadenceDueDate(list[0], settings), '2026-11-24');
});

test('gap arithmetic crosses month, year, and leap-day boundaries', () => {
  const settings = { firstGapDays: 7, secondGapDays: 14 };
  let list = startWinbackCadence([], record({ startDate: '2026-11-30' }));
  list = completeWinbackStep(list, 'WC-1', '2026-11-30');
  assert.equal(winbackCadenceDueDate(list[0], settings), '2026-12-07');
  list = completeWinbackStep(list, 'WC-1', '2026-12-30');
  assert.equal(winbackCadenceDueDate(list[0], settings), '2027-01-13');
  let leap = startWinbackCadence([], record({ startDate: '2024-02-28' }));
  leap = completeWinbackStep(leap, 'WC-1', '2024-02-28');
  assert.equal(winbackCadenceDueDate(leap[0], { firstGapDays: 1, secondGapDays: 1 }), '2024-02-29');
});

test('owner-set gaps change the due dates', () => {
  const settings = { firstGapDays: 3, secondGapDays: 30 };
  let list = startWinbackCadence([], record());
  list = completeWinbackStep(list, 'WC-1', '2026-11-02');
  assert.equal(winbackCadenceDueDate(list[0], settings), '2026-11-05');
  assert.deepEqual(normalizeCadenceSettings({ firstGapDays: 0, secondGapDays: 'nope' }), { firstGapDays: 7, secondGapDays: 14 });
  assert.deepEqual(normalizeCadenceSettings(null), { firstGapDays: 7, secondGapDays: 14 });
});

test('completing the closing note finishes the cadence', () => {
  let list = startWinbackCadence([], record());
  list = completeWinbackStep(list, 'WC-1', '2026-11-02');
  list = completeWinbackStep(list, 'WC-1', '2026-11-10');
  list = completeWinbackStep(list, 'WC-1', '2026-11-25');
  assert.equal(list[0].status, 'completed');
  assert.equal(winbackCadenceNext(list, 'Cust A', null, '2026-11-26'), null);
  assert.equal(winbackCadenceDueDate(list[0], null), null);
});

test('an invalid completion date changes nothing', () => {
  const list = startWinbackCadence([], record());
  assert.deepEqual(completeWinbackStep(list, 'WC-1', '2026-02-30'), list);
  assert.deepEqual(completeWinbackStep(list, 'WC-9', '2026-11-02'), list);
});

test('returned and do-not-contact customers leave the cadence', () => {
  let list = startWinbackCadence([], record());
  list = startWinbackCadence(list, record({ id: 'WC-2', customerId: 'Cust B', startDate: '2026-10-01' }));
  list = markWinbackCadenceReturned(list, 'WC-1');
  list = markWinbackCadenceDoNotContact(list, 'WC-2');
  assert.equal(winbackCadenceActive(list, null).length, 0);
  assert.equal(winbackCadenceNext(list, 'Cust A', null, '2026-11-20'), null);
  assert.equal(winbackCadenceNext(list, 'Cust B', null, '2026-11-20'), null);
});

test('overdue means due strictly before today', () => {
  const list = startWinbackCadence([], record({ startDate: '2026-11-01' }));
  assert.equal(winbackCadenceOverdue(list, null, '2026-11-02').length, 1);
  assert.equal(winbackCadenceOverdue(list, null, '2026-11-01').length, 0);
  assert.equal(winbackCadenceNext(list, 'Cust A', null, '2026-11-01').overdue, false);
});

test('active cadence sorts by due date, then customer A-Z', () => {
  let list = startWinbackCadence([], record({ id: 'WC-1', customerId: 'Cust B', startDate: '2026-11-05' }));
  list = startWinbackCadence(list, record({ id: 'WC-2', customerId: 'Cust A', startDate: '2026-11-01' }));
  list = startWinbackCadence(list, record({ id: 'WC-3', customerId: 'Cust C', startDate: '2026-11-01' }));
  assert.deepEqual(winbackCadenceActive(list, null).map((item) => item.customerId), ['Cust A', 'Cust C', 'Cust B']);
});

test('find and remove work by id', () => {
  const list = startWinbackCadence([], record());
  assert.equal(findWinbackCadence(list, 'WC-1').customerId, 'Cust A');
  assert.equal(findWinbackCadence(list, 'WC-9'), null);
  assert.equal(removeWinbackCadence(list, 'WC-1').length, 0);
});

test('customers list keeps first spelling, sorted A-Z', () => {
  let list = startWinbackCadence([], record({ customerId: 'cust b' }));
  list = startWinbackCadence(list, record({ id: 'WC-2', customerId: 'Cust A' }));
  assert.deepEqual(winbackCadenceCustomers(list), ['Cust A', 'cust b']);
});

test('draft texts name each step and promise nothing', () => {
  assert.match(winbackCadenceDraftText(1), /First follow-up/);
  assert.match(winbackCadenceDraftText(2), /Second follow-up/);
  assert.match(winbackCadenceDraftText(3), /Closing note/);
  assert.equal(winbackCadenceDraftText(9), '');
  assert.equal(winbackCadenceStepLabel(2), 'Second follow-up');
});

test('summary text counts every status', () => {
  let list = startWinbackCadence([], record());
  list = startWinbackCadence(list, record({ id: 'WC-2', customerId: 'Cust B' }));
  list = markWinbackCadenceReturned(list, 'WC-2');
  assert.equal(winbackCadenceSummaryText(list), '1 in cadence, 0 finished, 1 returned, 0 do-not-contact');
});

test('HTML escapes customer ids and CSV plus filename are stable', () => {
  const list = startWinbackCadence([], record({ customerId: '<b>Cust</b>' }));
  const html = winbackCadenceAllHtml(list, null, '2026-11-01');
  assert.ok(!html.includes('<b>Cust</b>'));
  assert.match(html, /&lt;b&gt;Cust&lt;\/b&gt;/);
  const csv = winbackCadenceCsv(list, null);
  assert.match(csv, /id,customer,next step,due date,status/);
  assert.match(csv, /WC-1/);
  assert.equal(winbackCadenceFilename(), 'shahdara_winback_cadence.csv');
});

test('inputs are never mutated and lists normalize', () => {
  const input = record({ step: 9, status: 'bogus' });
  const frozen = JSON.parse(JSON.stringify(input));
  const clean = normalizeWinbackCadence(input);
  assert.deepEqual(input, frozen);
  assert.equal(clean.step, 1);
  assert.equal(clean.status, 'active');
  assert.deepEqual(normalizeWinbackCadenceList([record(), null, 'nope']), [clean && normalizeWinbackCadence(record())]);
});

test('module is pure: no imports, no storage, no clock, no network', () => {
  const source = readFileSync(join(dir, '..', 'winback-cadence.js'), 'utf8');
  assert.ok(!/^\s*import\s/m.test(source));
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('new Date('));
  assert.ok(!source.includes('fetch('));
});

test('panel element ids exist in index.html', () => {
  const html = readFileSync(join(dir, '..', 'index.html'), 'utf8');
  for (const id of ['wcCustomer', 'wcStartDate', 'wcSaveBtn', 'wcStepId', 'wcStepDate', 'wcCompleteBtn', 'wcReturnedBtn', 'wcDoNotBtn', 'wcRemoveBtn', 'wcRemoveId', 'wcFirstGap', 'wcSecondGap', 'wcSettingsBtn', 'wcFilter', 'wcBody', 'wcSummary', 'wcExportBtn']) {
    assert.ok(html.includes(`id="${id}"`), `missing panel id ${id}`);
  }
});
