// SISP-38: Defaulter Grace Period Countdown & MikroTik Suspension
// Readiness Filter. Pure-function tests on synthetic data only.
// Spec test criteria (pinned):
//   - An unpaid customer with no future promiseDate on the 16th is badged
//     Lock Due and included in the suspension filter.
//   - An unpaid customer WITH a future promiseDate on the 16th is NOT
//     Lock Due and NOT in the suspension filter.
// All dates are injected (todayStr / referenceDate) — never the wall clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  ESCALATION_STAGES,
  getEscalationStage,
  escalationBadgeLabel,
  escalationBadgeClass,
  isLockDueCustomer,
  filterLockDueEntries
} from '../reminder-queue.js';
import { calculateTopDefaulters } from '../dashboard-top-defaulters.js';
import {
  buildLockDueSuspensionScript,
  buildDefaulterLockScript,
  DEFAULTER_PROFILE
} from '../mikrotik-generator.js';
import { createInitialState, saveBillMonth } from '../core.js';

const unpaid = (overrides = {}) => ({ id: 'c1', name: 'Test Defaulter', ...overrides });

// --- Stage windows (calendar day of month) --------------------------------

test('escalation stages follow the 5/11/15 calendar windows', () => {
  const c = unpaid();
  assert.equal(getEscalationStage(c, 1500, '2026-10-04'), null, 'before the 5th: no escalation');
  assert.equal(getEscalationStage(c, 1500, '2026-10-05').stage, ESCALATION_STAGES.GRACE);
  assert.equal(getEscalationStage(c, 1500, '2026-10-10').stage, ESCALATION_STAGES.GRACE);
  assert.equal(getEscalationStage(c, 1500, '2026-10-11').stage, ESCALATION_STAGES.FINAL_NOTICE);
  assert.equal(getEscalationStage(c, 1500, '2026-10-14').stage, ESCALATION_STAGES.FINAL_NOTICE);
  assert.equal(getEscalationStage(c, 1500, '2026-10-15').stage, ESCALATION_STAGES.LOCK_DUE);
  assert.equal(getEscalationStage(c, 1500, '2026-10-31').stage, ESCALATION_STAGES.LOCK_DUE);
});

test('no escalation for paid-up customers or invalid input', () => {
  assert.equal(getEscalationStage(unpaid(), 0, '2026-10-16'), null);
  assert.equal(getEscalationStage(unpaid(), -500, '2026-10-16'), null);
  assert.equal(getEscalationStage(null, 1500, '2026-10-16'), null);
  assert.equal(getEscalationStage(unpaid(), 1500, 'not-a-date'), null);
});

test('badge labels and classes match the spec stages', () => {
  assert.equal(escalationBadgeLabel(ESCALATION_STAGES.GRACE), '🟢 Grace');
  assert.equal(escalationBadgeLabel(ESCALATION_STAGES.FINAL_NOTICE), '🟠 Final Notice');
  assert.equal(escalationBadgeLabel(ESCALATION_STAGES.LOCK_DUE), '🔴 Lock Due');
  assert.equal(escalationBadgeLabel('bogus'), null);
  assert.equal(escalationBadgeClass(ESCALATION_STAGES.LOCK_DUE), 'escalation-lock');
});

// --- Pinned criteria: the 16th, with and without a future Waada -----------

test('PINNED: unpaid, no future promiseDate, on the 16th -> Lock Due', () => {
  const c = unpaid();
  const esc = getEscalationStage(c, 3000, '2026-10-16');
  assert.equal(esc.stage, ESCALATION_STAGES.LOCK_DUE);
  assert.equal(esc.hasActiveWaada, false);
  assert.equal(escalationBadgeLabel(esc.stage), '🔴 Lock Due');
  assert.equal(isLockDueCustomer(c, 3000, '2026-10-16'), true);
});

test('PINNED: unpaid WITH a future promiseDate on the 16th -> NOT Lock Due', () => {
  const c = unpaid({ promiseDate: '2026-10-20' });
  const esc = getEscalationStage(c, 3000, '2026-10-16');
  assert.equal(esc.hasActiveWaada, true);
  assert.equal(esc.stage, ESCALATION_STAGES.FINAL_NOTICE, 'active Waada caps escalation at Final Notice');
  assert.notEqual(esc.stage, ESCALATION_STAGES.LOCK_DUE);
  assert.equal(isLockDueCustomer(c, 3000, '2026-10-16'), false);
});

test('a promise dated today still snoozes the lock (SISP-3 tier promised)', () => {
  const c = unpaid({ promiseDate: '2026-10-16' });
  assert.equal(isLockDueCustomer(c, 3000, '2026-10-16'), false);
});

test('a broken (past) promiseDate does not block Lock Due on the 16th', () => {
  const c = unpaid({ promiseDate: '2026-10-10' });
  const esc = getEscalationStage(c, 3000, '2026-10-16');
  assert.equal(esc.hasActiveWaada, false);
  assert.equal(esc.stage, ESCALATION_STAGES.LOCK_DUE);
  assert.equal(isLockDueCustomer(c, 3000, '2026-10-16'), true);
});

test('an invalid stored promiseDate is treated as no promise', () => {
  const c = unpaid({ promiseDate: '16-10-2026' });
  assert.equal(isLockDueCustomer(c, 3000, '2026-10-16'), true);
});

test('filterLockDueEntries keeps only the suspension set, order preserved', () => {
  const entries = [
    { customer: unpaid({ id: 'a' }), outstanding: 1000 },
    { customer: unpaid({ id: 'b', promiseDate: '2026-10-25' }), outstanding: 2000 },
    { customer: unpaid({ id: 'c' }), outstanding: 0 },
    { customer: unpaid({ id: 'd', promiseDate: '2026-10-01' }), outstanding: 4000 }
  ];
  const kept = filterLockDueEntries(entries, '2026-10-16');
  assert.deepEqual(kept.map(e => e.customer.id), ['a', 'd']);
  // Same entries a week earlier: nobody is lock-due yet.
  assert.deepEqual(filterLockDueEntries(entries, '2026-10-12'), []);
});

// --- Dashboard integration: calculateTopDefaulters escalation filter ------

const withPromise = (state, customerId, promise) => ({
  ...state,
  customers: state.customers.map(c => c.id === customerId ? { ...c, ...promise } : c)
});
const pricedBill = (state, customerId, month, dueAmount, refDate) =>
  saveBillMonth(state, customerId, { month, dueAmount, dueDate: `${month}-05`, status: 'pending' }, refDate);

function lockDueState() {
  const ref = new Date(2026, 9, 16, 12);
  let state = createInitialState();
  state = pricedBill(state, 'seed-001', '2026-10', '3000', ref);
  state = pricedBill(state, 'seed-002', '2026-10', '5000', ref);
  state = pricedBill(state, 'seed-003', '2026-10', '2000', ref);
  // seed-001: promise already broken before the 16th -> Lock Due.
  state = withPromise(state, 'seed-001', { promiseDate: '2026-10-10' });
  // seed-003: active future promise -> capped at Final Notice.
  state = withPromise(state, 'seed-003', { promiseDate: '2026-10-20' });
  // seed-002: no promise at all -> Lock Due.
  return state;
}

test('defaulters rows carry escalationStage for the reference date (16th)', () => {
  const ref = new Date(2026, 9, 16, 12);
  const all = calculateTopDefaulters(lockDueState(), { referenceDate: ref, limit: 0 });
  assert.equal(all.accounts.length, 3);
  const byId = Object.fromEntries(all.accounts.map(a => [a.id, a.escalationStage]));
  assert.equal(byId['seed-001'], ESCALATION_STAGES.LOCK_DUE);
  assert.equal(byId['seed-002'], ESCALATION_STAGES.LOCK_DUE);
  assert.equal(byId['seed-003'], ESCALATION_STAGES.FINAL_NOTICE);
  assert.deepEqual(all.metrics.escalationCounts, { grace: 0, finalNotice: 1, lockDue: 2 });
});

test('PINNED: escalation lock-due filter includes no-promise, excludes future promise', () => {
  const ref = new Date(2026, 9, 16, 12);
  const lockDue = calculateTopDefaulters(lockDueState(), {
    referenceDate: ref, limit: 0, escalation: ESCALATION_STAGES.LOCK_DUE
  });
  assert.deepEqual(lockDue.accounts.map(a => a.id).sort(), ['seed-001', 'seed-002']);
  assert.equal(lockDue.metrics.escalationFilter, 'lock-due');
  assert.ok(lockDue.accounts.every(a => a.escalationStage === ESCALATION_STAGES.LOCK_DUE));
});

test('escalation stages on the 7th are all Grace; on the 12th all Final Notice', () => {
  const state = lockDueState();
  const on7th = calculateTopDefaulters(state, { referenceDate: new Date(2026, 9, 7, 12), limit: 0 });
  assert.ok(on7th.accounts.every(a => a.escalationStage === ESCALATION_STAGES.GRACE));
  const on12th = calculateTopDefaulters(state, { referenceDate: new Date(2026, 9, 12, 12), limit: 0 });
  assert.ok(on12th.accounts.every(a => a.escalationStage === ESCALATION_STAGES.FINAL_NOTICE));
});

// --- MikroTik suspension script -------------------------------------------

const scriptCustomer = (overrides = {}) => ({
  id: 'cust-1',
  customerNumber: 7,
  name: 'Lock Candidate',
  packageSpeed: '5Mbps / 150GB',
  pppoeUsername: 'lockme7',
  ...overrides
});

test('PINNED: suspension script locks the no-promise customer, skips the promised one', () => {
  const noPromise = scriptCustomer();
  const promised = scriptCustomer({
    id: 'cust-2', customerNumber: 8, name: 'Promised Payer',
    pppoeUsername: 'promised8', promiseDate: '2026-10-20'
  });
  const { script, locked, skippedWaada } = buildLockDueSuspensionScript(
    [noPromise, promised], { todayStr: '2026-10-16' }
  );
  assert.deepEqual(locked.map(c => c.id), ['cust-1']);
  assert.deepEqual(skippedWaada.map(c => c.id), ['cust-2']);
  assert.match(script, /Lock Due \(15th\+\) suspension script/);
  assert.match(script, new RegExp(`/ppp secret set \\[find name="lockme7"\\] profile=${DEFAULTER_PROFILE}`));
  assert.doesNotMatch(script, /find name="promised8"\] profile=/);
});

test('general lock script behaviour is unchanged by the Lock Due wrapper', () => {
  const c = scriptCustomer();
  const general = buildDefaulterLockScript([c], { todayStr: '2026-10-16' });
  const lockDue = buildLockDueSuspensionScript([c], { todayStr: '2026-10-16' });
  assert.deepEqual(lockDue.locked, general.locked);
  assert.ok(general.script.includes('Defaulter lock / walled-garden script'));
  assert.ok(lockDue.script.includes('Lock Due (15th+) suspension script'));
});

// --- Markup / style hooks ---------------------------------------------------

test('index.html has the Lock Due filter button; styles.css has badge hooks', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  assert.match(html, /id="topDefaultersLockDueBtn"/);
  assert.match(css, /\.escalation-badge\s*\{/);
  assert.match(css, /\.escalation-lock\s*\{/);
  assert.match(css, /\[data-theme="dark"\] \.escalation-lock/);
  assert.match(css, /\.lock-due-toggle\.is-active/);
});
