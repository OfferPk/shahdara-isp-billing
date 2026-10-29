// SISP-47: Vacation Hold (SISP-8 pause-billing.js) ↔ MikroTik PPPoE
// Disable/Enable Snippet (SISP-13). Pure-function + core-integration
// tests on synthetic data only.
// Spec test criterion (verbatim): "Pausing customer cust-10 generates a
// valid /ppp secret disable command, and resuming generates
// /ppp secret enable."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildVacationHoldDisableSnippet,
  buildVacationHoldEnableSnippet,
  buildDefaulterLockScript,
  buildLockDueSuspensionScript,
  buildDefaulterRestoreScript
} from '../mikrotik-generator.js';
import { vacationHoldState, isBillingPaused } from '../pause-billing.js';
import { vacationHoldRouterPresentation } from '../profile-ui.js';
import { calculateTopDefaulters } from '../dashboard-top-defaulters.js';
import { createInitialState, addCustomer, updateCustomerProfile } from '../core.js';

const heldCustomer = (overrides = {}) => ({
  id: 'cust-10',
  customerNumber: 10,
  name: 'Test Customer 10',
  packageSpeed: '5Mbps / 150GB',
  paused: true,
  pauseStartDate: '2026-10-05',
  autoResumeDate: null,
  pauseSkippedMonths: [],
  promiseDate: null,
  ...overrides
});

test('vacationHoldState: none / scheduled / active / expired day boundaries', () => {
  const held = heldCustomer({ pauseStartDate: '2026-10-20', autoResumeDate: '2026-11-10' });
  assert.equal(vacationHoldState({}, '2026-10-20'), 'none');
  assert.equal(vacationHoldState(heldCustomer({ paused: false }), '2026-10-20'), 'none');
  // A paused flag without a valid start date is no hold (billing agrees).
  assert.equal(vacationHoldState(heldCustomer({ pauseStartDate: null }), '2026-10-20'), 'none');
  // Mid-month start: the day before is scheduled, the start day is active.
  assert.equal(vacationHoldState(held, '2026-10-19'), 'scheduled');
  assert.equal(vacationHoldState(held, '2026-10-20'), 'active');
  // Mid-month auto-resume: the day before is active, the resume day is expired.
  assert.equal(vacationHoldState(held, '2026-11-09'), 'active');
  assert.equal(vacationHoldState(held, '2026-11-10'), 'expired');
  assert.equal(vacationHoldState(held, '2026-12-01'), 'expired');
  // No auto-resume date: the hold never expires on its own.
  assert.equal(vacationHoldState(heldCustomer({ pauseStartDate: '2026-10-20' }), '2027-06-01'), 'active');
  // An unreadable "today" can prove neither scheduled nor expired -> active.
  assert.equal(vacationHoldState(held, ''), 'active');
  assert.equal(vacationHoldState(held, 'not-a-date'), 'active');
});

test('spec criterion: pausing cust-10 generates the exact disable commands; resuming generates enable', () => {
  const disable = buildVacationHoldDisableSnippet(heldCustomer(), { todayStr: '2026-10-06' });
  assert.ok(disable.includes('/ppp secret disable [find name="cust-10"]'));
  // The live session is dropped too (spec: disable + drop active session).
  assert.ok(disable.includes('/ppp active remove [find name="cust-10"]'));
  const resumed = heldCustomer({ paused: false, pauseSkippedMonths: ['2026-10'] });
  const enable = buildVacationHoldEnableSnippet(resumed, { todayStr: '2026-11-02' });
  assert.ok(enable.includes('/ppp secret enable [find name="cust-10"]'));
});

test('hold snippets name ONLY their own customer and never apply a lock', () => {
  const other = heldCustomer({ id: 'cust-77', customerNumber: 77, name: 'Test Customer 77', pppoeUsername: 'other77' });
  const disable = buildVacationHoldDisableSnippet(heldCustomer(), { todayStr: '2026-10-06' });
  assert.ok(!disable.includes('cust-77'));
  assert.ok(!disable.includes('other77'));
  assert.ok(!disable.includes('Test Customer 77'));
  // A hold is not a lock: no profile switch, no walled-garden profile, no cap.
  assert.ok(!disable.includes('/ppp secret set'));
  assert.ok(!disable.includes('payment-reminder-pool'));
  assert.ok(!disable.includes('128k'));
  const enable = buildVacationHoldEnableSnippet(other, { todayStr: '2026-10-06' });
  assert.ok(enable.includes('/ppp secret enable [find name="other77"]'));
  assert.ok(!enable.includes('cust-10'));
});

test('stored PPPoE username wins over the derived one in both snippets', () => {
  const c = heldCustomer({ pppoeUsername: 'village.user.5' });
  assert.ok(buildVacationHoldDisableSnippet(c, { todayStr: '2026-10-06' }).includes('[find name="village.user.5"]'));
  assert.ok(buildVacationHoldEnableSnippet(c, { todayStr: '2026-10-06' }).includes('[find name="village.user.5"]'));
});

test('disable snippet for a customer with no recorded hold warns instead of staying silent', () => {
  const snippet = buildVacationHoldDisableSnippet(
    { id: 'cust-3', customerNumber: 3, name: 'Test Customer 03' },
    { todayStr: '2026-10-06' }
  );
  assert.match(snippet, /WARNING: no vacation hold is recorded/);
  assert.ok(snippet.includes('/ppp secret disable [find name="cust-3"]'));
});

test('expired hold: disable snippet points at the enable path instead', () => {
  const expired = heldCustomer({ pauseStartDate: '2026-09-01', autoResumeDate: '2026-10-01' });
  const snippet = buildVacationHoldDisableSnippet(expired, { todayStr: '2026-10-06' });
  assert.match(snippet, /auto-resume date 2026-10-01 has already passed/);
  assert.match(snippet, /ENABLE snippet instead/);
});

test('lock script: a held defaulter is excluded and listed, a plain defaulter is locked', () => {
  const held = heldCustomer({ id: 'cust-held', customerNumber: 21, name: 'HELD DEFAULTER', pppoeUsername: 'held21' });
  const plain = heldCustomer({ id: 'cust-plain', customerNumber: 22, name: 'PLAIN DEFAULTER', pppoeUsername: 'plain22', paused: false, pauseStartDate: null });
  const frozenHeld = Object.freeze({ ...held });
  const { script, locked, skippedWaada, skippedPaused } = buildDefaulterLockScript([frozenHeld, plain], { todayStr: '2026-10-28' });
  assert.deepEqual(locked.map((c) => c.id), ['cust-plain']);
  assert.deepEqual(skippedPaused.map((c) => c.id), ['cust-held']);
  assert.equal(skippedWaada.length, 0);
  assert.ok(!script.includes('# Lock: HELD DEFAULTER'));
  assert.ok(!script.includes('[find name="held21"]'));
  assert.match(script, /# Excluded \(vacation hold — resume or hold via the profile, never this lock script\): HELD DEFAULTER \(customerId: cust-held HELD DEFAULTER #21\)/);
  assert.ok(script.includes('# Lock: PLAIN DEFAULTER'));
  assert.ok(script.includes('[find name="plain22"]'));
  // Read-only: the frozen held record was not mutated.
  assert.equal(frozenHeld.paused, true);
});

test('lock-due suspension script applies the same vacation-hold guard', () => {
  const held = heldCustomer({ id: 'cust-held', customerNumber: 21, name: 'HELD DEFAULTER' });
  const plain = heldCustomer({ id: 'cust-plain', customerNumber: 22, name: 'PLAIN DEFAULTER', paused: false, pauseStartDate: null });
  const { script, locked, skippedPaused } = buildLockDueSuspensionScript([held, plain], { todayStr: '2026-10-28' });
  assert.deepEqual(locked.map((c) => c.id), ['cust-plain']);
  assert.deepEqual(skippedPaused.map((c) => c.id), ['cust-held']);
  assert.match(script, /Lock Due \(15th\+\) suspension script/);
  assert.ok(!script.includes('# Lock: HELD DEFAULTER'));
});

test('lock script with everyone on hold locks nobody and says why', () => {
  const { script, locked, skippedPaused } = buildDefaulterLockScript([heldCustomer()], { todayStr: '2026-10-28' });
  assert.equal(locked.length, 0);
  assert.equal(skippedPaused.length, 1);
  assert.match(script, /No customers to lock — every visible defaulter is on a vacation hold\./);
});

test('an expired hold is still excluded from the lock script (resume is explicit, never silent)', () => {
  const expired = heldCustomer({ id: 'cust-exp', customerNumber: 31, name: 'EXPIRED HOLD', pauseStartDate: '2026-08-01', autoResumeDate: '2026-09-01' });
  const { script, locked, skippedPaused } = buildDefaulterLockScript([expired], { todayStr: '2026-10-28' });
  assert.equal(locked.length, 0);
  assert.deepEqual(skippedPaused.map((c) => c.id), ['cust-exp']);
  assert.ok(!script.includes('# Lock: EXPIRED HOLD'));
});

test('future-Waada exclusion still works alongside the hold guard', () => {
  const waada = heldCustomer({ id: 'cust-waada', customerNumber: 41, name: 'WAADA ONLY', paused: false, pauseStartDate: null, promiseDate: '2026-11-15' });
  const heldWaada = heldCustomer({ id: 'cust-both', customerNumber: 42, name: 'HELD AND WAADA', promiseDate: '2026-11-15' });
  const { locked, skippedWaada, skippedPaused } = buildDefaulterLockScript([waada, heldWaada], { todayStr: '2026-10-28' });
  assert.equal(locked.length, 0);
  assert.deepEqual(skippedWaada.map((c) => c.id), ['cust-waada']);
  // Hold wins the classification: the stronger state is reported first.
  assert.deepEqual(skippedPaused.map((c) => c.id), ['cust-both']);
});

test('defaulter restore script never re-enables a held secret (hold is orthogonal to lock)', () => {
  const { script } = buildDefaulterRestoreScript([heldCustomer()]);
  assert.ok(!script.includes('/ppp secret enable'));
  assert.ok(!script.includes('/ppp secret disable'));
});

test('presentation: never-paused customer sees no router hold section', () => {
  const p = vacationHoldRouterPresentation({ id: 'cust-1', customerNumber: 1, name: 'Test Customer 01' }, { todayStr: '2026-10-28' });
  assert.equal(p.visible, false);
  assert.equal(p.snippet, '');
});

test('presentation: active hold -> disable mode with the exact snippet', () => {
  const c = heldCustomer();
  const p = vacationHoldRouterPresentation(c, { todayStr: '2026-10-06' });
  assert.equal(p.visible, true);
  assert.equal(p.mode, 'disable');
  assert.equal(p.state, 'active');
  assert.equal(p.snippet, buildVacationHoldDisableSnippet(c, { todayStr: '2026-10-06' }));
  assert.match(p.statusText, /On vacation hold since 2026-10-05/);
});

test('presentation: scheduled hold -> disable mode with the start-date warning', () => {
  const p = vacationHoldRouterPresentation(heldCustomer({ pauseStartDate: '2026-11-01' }), { todayStr: '2026-10-28' });
  assert.equal(p.visible, true);
  assert.equal(p.mode, 'disable');
  assert.equal(p.state, 'scheduled');
  assert.match(p.statusText, /Vacation hold starts 2026-11-01/);
});

test('presentation: expired hold -> enable mode, explicitly not silent', () => {
  const c = heldCustomer({ pauseStartDate: '2026-09-01', autoResumeDate: '2026-10-01' });
  const p = vacationHoldRouterPresentation(c, { todayStr: '2026-10-06' });
  assert.equal(p.visible, true);
  assert.equal(p.mode, 'enable');
  assert.equal(p.state, 'expired');
  assert.match(p.statusText, /auto-resume date 2026-10-01 has passed/);
  assert.ok(p.snippet.includes('/ppp secret enable [find name="cust-10"]'));
});

test('presentation: resumed customer (skipped months recorded) -> enable mode', () => {
  const c = heldCustomer({ paused: false, pauseSkippedMonths: ['2026-09'] });
  const p = vacationHoldRouterPresentation(c, { todayStr: '2026-10-06' });
  assert.equal(p.visible, true);
  assert.equal(p.mode, 'enable');
  assert.equal(p.state, 'resumed');
  assert.ok(p.snippet.includes('/ppp secret enable [find name="cust-10"]'));
});

test('FREE connection on hold: snippet, guard and presentation all behave sanely', () => {
  const free = heldCustomer({ id: 'cust-free', customerNumber: 99, name: 'FREE LINE', isFreeConnection: true });
  const disable = buildVacationHoldDisableSnippet(free, { todayStr: '2026-10-06' });
  assert.ok(disable.includes('/ppp secret disable [find name="cust-99"]'));
  const { locked, skippedPaused } = buildDefaulterLockScript([free], { todayStr: '2026-10-28' });
  assert.equal(locked.length, 0);
  assert.equal(skippedPaused.length, 1);
  const p = vacationHoldRouterPresentation(free, { todayStr: '2026-10-06' });
  assert.equal(p.visible, true);
  assert.equal(p.mode, 'disable');
});

test('top defaulters: held defaulter stays visible, flagged on-hold; FREE defaulter stays out', () => {
  const bill = { month: '2026-09', dueAmount: 2000, dueDate: '2026-09-05', payments: [] };
  const state = {
    customers: [
      { id: 'd-held', customerNumber: 51, name: 'HELD OWING', paused: true, pauseStartDate: '2026-10-05', autoResumeDate: null, pauseSkippedMonths: [], bills: [bill], archived: false },
      { id: 'd-plain', customerNumber: 52, name: 'PLAIN OWING', bills: [{ ...bill }], archived: false },
      { id: 'd-free', customerNumber: 53, name: 'FREE OWING', isFreeConnection: true, bills: [{ ...bill }], archived: false }
    ]
  };
  const { accounts } = calculateTopDefaulters(state, { referenceDate: new Date('2026-10-28T12:00:00Z'), limit: null });
  const heldRow = accounts.find((a) => a.id === 'd-held');
  const plainRow = accounts.find((a) => a.id === 'd-plain');
  assert.ok(heldRow, 'held defaulter remains visible in the list');
  assert.equal(heldRow.vacationHold, 'active');
  assert.equal(heldRow.totalOutstanding, 2000);
  assert.ok(plainRow);
  assert.equal(plainRow.vacationHold, 'none');
  assert.ok(!accounts.some((a) => a.id === 'd-free'), 'free connections never appear as defaulters');
});

test('core flow: pause via profile -> disable state; resume via profile -> skipped months + enable state', () => {
  let state = createInitialState([]);
  state = addCustomer(state, 'Test Customer 60', new Date('2026-09-01T12:00:00Z'), {});
  const created = state.customers[state.customers.length - 1];
  state = updateCustomerProfile(state, created.id, {
    paused: true, pauseStartDate: '2026-10-05', autoResumeDate: ''
  }, new Date('2026-10-05T12:00:00Z'));
  const pausedRecord = state.customers.find((c) => c.id === created.id);
  assert.equal(pausedRecord.paused, true);
  assert.equal(isBillingPaused(pausedRecord, '2026-10'), true);
  assert.equal(vacationHoldState(pausedRecord, '2026-10-06'), 'active');
  const p1 = vacationHoldRouterPresentation(pausedRecord, { todayStr: '2026-10-06' });
  assert.equal(p1.mode, 'disable');
  assert.ok(p1.snippet.includes(`/ppp secret disable [find name="cust-${created.customerNumber}"]`));

  // Resume in December: Oct + Nov are recorded as skipped, never backfilled.
  state = updateCustomerProfile(state, created.id, {
    paused: false, pauseStartDate: '2026-10-05', autoResumeDate: ''
  }, new Date('2026-12-03T12:00:00Z'));
  const resumedRecord = state.customers.find((c) => c.id === created.id);
  assert.equal(resumedRecord.paused, false);
  assert.deepEqual(resumedRecord.pauseSkippedMonths, ['2026-10', '2026-11']);
  assert.equal(isBillingPaused(resumedRecord, '2026-10'), true, 'skipped month stays unbilled after resume');
  assert.equal(isBillingPaused(resumedRecord, '2026-12'), false, 'billing restarts on resume');
  const p2 = vacationHoldRouterPresentation(resumedRecord, { todayStr: '2026-12-03' });
  assert.equal(p2.visible, true);
  assert.equal(p2.mode, 'enable');
  assert.ok(p2.snippet.includes(`/ppp secret enable [find name="cust-${created.customerNumber}"]`));
});

test('generators are read-only: frozen held input is untouched', () => {
  const frozen = Object.freeze(heldCustomer());
  assert.doesNotThrow(() => buildVacationHoldDisableSnippet(frozen, { todayStr: '2026-10-06' }));
  assert.doesNotThrow(() => buildVacationHoldEnableSnippet(frozen, { todayStr: '2026-10-06' }));
  assert.doesNotThrow(() => vacationHoldRouterPresentation(frozen, { todayStr: '2026-10-06' }));
  assert.equal(frozen.paused, true);
  assert.equal(frozen.pauseStartDate, '2026-10-05');
});
