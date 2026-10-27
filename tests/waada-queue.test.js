// SISP-3: "Waada Tareekh" (Promise-to-Pay) & 3-Tier Reminder Snooze Queue.
// Pure-module tests (tiering, chips, set/clear, auto-clear) plus integration
// tests for the daily queue, the defaulters tier filter, core addPayment
// auto-clear, and backup-merge carry of the promise fields.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WAADA_TIERS,
  isValidWaadaDate,
  addWaadaDays,
  tenthOfMonthWaadaDate,
  computeWaadaChipDate,
  setCustomerWaada,
  clearCustomerWaada,
  getWaadaTier,
  waadaBadgeLabel,
  tierWaadaQueue,
  clearWaadaOnFullPayment
} from '../waada-queue.js';
import {
  createInitialState,
  saveBillMonth,
  addPayment,
  createJsonBackup,
  previewJsonBackupMerge
} from '../core.js';
import {
  DEFAULT_REMINDER_STAGES,
  getRemindersTodayQueue
} from '../reminder-queue.js';
import { calculateTopDefaulters } from '../dashboard-top-defaulters.js';

const TODAY = '2026-10-28';
const referenceDate = new Date(2026, 8, 29, 12);
const mockStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
};
const withPromise = (state, customerId, promise) => ({
  ...state,
  customers: state.customers.map(c => c.id === customerId ? { ...c, ...promise } : c)
});
const pricedBill = (state, customerId, month, dueAmount, refDate = referenceDate) =>
  saveBillMonth(state, customerId, { month, dueAmount, dueDate: `${month}-05`, status: 'pending' }, refDate);
const octoberReference = new Date(2026, 9, 20, 12);

// --- Date helpers & chips ---

test('chip dates: +2 / +5 days, 10th of month (same month and rollover), custom validation', () => {
  assert.equal(computeWaadaChipDate('plus2', TODAY), '2026-10-30');
  assert.equal(computeWaadaChipDate('plus5', TODAY), '2026-11-02');
  assert.equal(computeWaadaChipDate('tenth', '2026-10-05'), '2026-10-10');
  assert.equal(computeWaadaChipDate('tenth', '2026-10-10'), '2026-10-10');
  assert.equal(computeWaadaChipDate('tenth', TODAY), '2026-11-10');
  assert.equal(computeWaadaChipDate('tenth', '2026-12-20'), '2027-01-10');
  assert.equal(computeWaadaChipDate('custom', TODAY, '2026-11-15'), '2026-11-15');
  assert.equal(computeWaadaChipDate('custom', TODAY, '2026-02-30'), null);
  assert.equal(computeWaadaChipDate('custom', TODAY, 'not-a-date'), null);
  assert.equal(computeWaadaChipDate('unknown', TODAY), null);
  assert.equal(addWaadaDays('2026-12-30', 5), '2027-01-04');
  assert.equal(tenthOfMonthWaadaDate('2026-02-28'), '2026-03-10');
  assert.equal(isValidWaadaDate('2024-02-29'), true);
  assert.equal(isValidWaadaDate('2025-02-29'), false);
  assert.equal(isValidWaadaDate('2026-13-01'), false);
});

// --- Tier classification (spec criteria 1 & 2) ---

test('future promiseDate moves the customer to the Promised/Snoozed tier', () => {
  const customer = { id: 'c1', promiseDate: '2026-11-05' };
  assert.equal(getWaadaTier(customer, 3000, TODAY), WAADA_TIERS.PROMISED);
  assert.equal(waadaBadgeLabel(customer, TODAY), 'Waada: 2026-11-05');
});

test('past promiseDate flags the customer as Broken at the top of the queue', () => {
  const customer = { id: 'c1', promiseDate: '2026-10-10' };
  assert.equal(getWaadaTier(customer, 3000, TODAY), WAADA_TIERS.BROKEN);
  assert.equal(waadaBadgeLabel(customer, TODAY), 'Waada Expired: 2026-10-10');
});

test('no promise means Active dues; no balance means no tier at all', () => {
  assert.equal(getWaadaTier({ id: 'c1' }, 3000, TODAY), WAADA_TIERS.ACTIVE);
  assert.equal(getWaadaTier({ id: 'c1', promiseDate: '2026-10-10' }, 0, TODAY), null);
  assert.equal(getWaadaTier({ id: 'c1', promiseDate: '2026-10-10' }, -5, TODAY), null);
  assert.equal(getWaadaTier({ id: 'c1', promiseDate: 'bogus' }, 3000, TODAY), WAADA_TIERS.ACTIVE);
  assert.equal(waadaBadgeLabel({ id: 'c1' }, TODAY), null);
});

test('tierWaadaQueue buckets and orders: broken (most overdue first), active, promised', () => {
  const entries = [
    { customer: { id: 'a', promiseDate: '2026-10-20' }, outstanding: 1000 },
    { customer: { id: 'b' }, outstanding: 5000 },
    { customer: { id: 'c', promiseDate: '2026-11-05' }, outstanding: 2000 },
    { customer: { id: 'd', promiseDate: '2026-10-10' }, outstanding: 3000 },
    { customer: { id: 'e', promiseDate: '2026-10-01' }, outstanding: 0 },
    { customer: { id: 'f', promiseDate: '2026-12-01' }, outstanding: 4000 }
  ];
  const tiers = tierWaadaQueue(entries, TODAY);
  assert.deepEqual(tiers.broken.map(i => i.customer.id), ['d', 'a']);
  assert.deepEqual(tiers.active.map(i => i.customer.id), ['b']);
  assert.deepEqual(tiers.promised.map(i => i.customer.id), ['c', 'f']);
});

// --- Set / clear ---

test('setCustomerWaada validates the date and never mutates the input', () => {
  const original = { id: 'c1', name: 'Test' };
  const updated = setCustomerWaada(original, { promiseDate: '2026-11-10', promiseAmount: 3000, promiseNote: 'Salary on the 10th' });
  assert.equal(updated.promiseDate, '2026-11-10');
  assert.equal(updated.promiseAmount, 3000);
  assert.equal(updated.promiseNote, 'Salary on the 10th');
  assert.equal('promiseDate' in original, false);
  assert.throws(() => setCustomerWaada(original, { promiseDate: '2026-02-30' }), /YYYY-MM-DD/);
  const cleared = clearCustomerWaada(updated);
  assert.equal('promiseDate' in cleared, false);
  assert.equal('promiseAmount' in cleared, false);
  assert.equal('promiseNote' in cleared, false);
  assert.equal(updated.promiseDate, '2026-11-10', 'clear does not mutate its input');
});

test('clearWaadaOnFullPayment clears only when the balance is fully paid', () => {
  const customer = { id: 'c1', promiseDate: '2026-11-10' };
  assert.deepEqual(clearWaadaOnFullPayment(customer, 0), { customer: { id: 'c1' }, cleared: true });
  assert.equal(clearWaadaOnFullPayment(customer, 1500).cleared, false);
  assert.equal(clearWaadaOnFullPayment({ id: 'c1' }, 0).cleared, false);
});

// --- Core addPayment auto-clear (spec criterion 3) ---

test('recording full payment automatically clears promiseDate; partial payment keeps it', () => {
  let state = createInitialState();
  state = pricedBill(state, 'seed-001', '2026-09', '3000');
  state = withPromise(state, 'seed-001', { promiseDate: '2026-10-10', promiseAmount: 3000, promiseNote: 'Salary' });

  const partial = addPayment(state, 'seed-001', '2026-09', { date: '2026-09-15', amount: '1000', method: 'Cash' }, referenceDate);
  assert.equal(partial.customers[0].promiseDate, '2026-10-10', 'partial payment keeps the promise');

  const full = addPayment(partial, 'seed-001', '2026-09', { date: '2026-09-20', amount: '2000', method: 'Cash' }, referenceDate);
  assert.equal('promiseDate' in full.customers[0], false, 'full payment clears promiseDate');
  assert.equal('promiseAmount' in full.customers[0], false);
  assert.equal('promiseNote' in full.customers[0], false);
});

test('payment on an unpriced bill does not clear the promise (no priced balance to settle)', () => {
  let state = createInitialState();
  state = withPromise(state, 'seed-001', { promiseDate: '2026-10-10' });
  const next = addPayment(state, 'seed-001', '2026-09', { date: '2026-09-15', amount: '500', method: 'Cash' }, referenceDate);
  assert.equal(next.customers[0].promiseDate, '2026-10-10');
});

// --- Daily reminder queue tiering ---

test('daily queue: broken promises pin first, promised customers are snoozed out', () => {
  let state = createInitialState();
  state = pricedBill(state, 'seed-001', '2026-10', '3000', octoberReference);
  state = pricedBill(state, 'seed-002', '2026-10', '5000', octoberReference);
  state = pricedBill(state, 'seed-003', '2026-10', '2000', octoberReference);
  state = withPromise(state, 'seed-001', { promiseDate: '2026-10-10' });
  state = withPromise(state, 'seed-003', { promiseDate: '2026-11-05' });

  const queue = getRemindersTodayQueue(state, {
    todayString: TODAY,
    stages: DEFAULT_REMINDER_STAGES,
    storage: mockStorage()
  });
  assert.deepEqual(queue.queue.map(e => e.customerId), ['seed-001', 'seed-002']);
  assert.equal(queue.queue[0].waadaTier, WAADA_TIERS.BROKEN);
  assert.equal(queue.queue[1].waadaTier, WAADA_TIERS.ACTIVE);
  assert.equal(queue.queue[0].promiseDate, '2026-10-10');
});

// --- Defaulters tier filter ---

test('defaulters waada filter isolates broken / promised / active tiers', () => {
  let state = createInitialState();
  state = pricedBill(state, 'seed-001', '2026-10', '3000', octoberReference);
  state = pricedBill(state, 'seed-002', '2026-10', '5000', octoberReference);
  state = pricedBill(state, 'seed-003', '2026-10', '2000', octoberReference);
  state = withPromise(state, 'seed-001', { promiseDate: '2026-10-10', promiseAmount: 3000 });
  state = withPromise(state, 'seed-003', { promiseDate: '2026-11-05' });

  const ref = new Date(2026, 9, 28, 12);
  const all = calculateTopDefaulters(state, { referenceDate: ref, limit: 0 });
  assert.equal(all.accounts.length, 3);
  assert.equal(all.accounts.find(a => a.id === 'seed-001').waadaTier, WAADA_TIERS.BROKEN);
  assert.equal(all.accounts.find(a => a.id === 'seed-002').waadaTier, WAADA_TIERS.ACTIVE);
  assert.equal(all.accounts.find(a => a.id === 'seed-003').waadaTier, WAADA_TIERS.PROMISED);

  const broken = calculateTopDefaulters(state, { referenceDate: ref, limit: 0, waadaTier: 'broken' });
  assert.deepEqual(broken.accounts.map(a => a.id), ['seed-001']);
  const promised = calculateTopDefaulters(state, { referenceDate: ref, limit: 0, waadaTier: 'promised' });
  assert.deepEqual(promised.accounts.map(a => a.id), ['seed-003']);
  const active = calculateTopDefaulters(state, { referenceDate: ref, limit: 0, waadaTier: 'active' });
  assert.deepEqual(active.accounts.map(a => a.id), ['seed-002']);
});

// --- Backup round-trip ---

test('promise fields survive JSON backup export and safe-merge restore', () => {
  let existing = createInitialState();
  let backupState = createInitialState();
  backupState = withPromise(backupState, 'seed-001', { promiseDate: '2026-11-10', promiseAmount: 3000, promiseNote: 'Salary' });
  const backupText = createJsonBackup(backupState, new Date());

  // Full restore keeps the fields (whole-state deep copy).
  const restored = JSON.parse(backupText).state;
  assert.equal(restored.customers[0].promiseDate, '2026-11-10');

  // Safe merge fills an empty local promise from the backup.
  const merged = previewJsonBackupMerge(existing, backupText);
  assert.equal(merged.state.customers[0].promiseDate, '2026-11-10');
  assert.equal(merged.state.customers[0].promiseAmount, 3000);
  assert.equal(merged.state.customers[0].promiseNote, 'Salary');
  assert.equal(merged.counts.filledProfileFields >= 3, true);
});
