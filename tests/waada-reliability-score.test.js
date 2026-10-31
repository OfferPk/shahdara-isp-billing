// SISP-98: Waada Tareekh Reliability Score (waadaKeptCount vs waadaBrokenCount).
// The score is DERIVED, never stored: kept/broken counts are computed from
// recorded promise resolutions — SISP-34 `clearedWaada` stamps on the
// payments that auto-cleared a promise (paid on/before the promise date =
// kept; paid after it = broken) plus the live promise's tier right now
// (expired + still unpaid = broken). These tests pin the derivation, the
// spec scenario (Kept 2 / Broken 1 on profile AND defaulter row), the
// snooze rule, the SISP-34 void unwind, and idempotency (pure function:
// re-render / reload / backup round-trip recompute identical numbers).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeWaadaScore,
  setCustomerWaada
} from '../waada-queue.js';
import {
  createInitialState,
  saveBillMonth,
  addPayment,
  createJsonBackup
} from '../core.js';
import { voidPayment } from '../payment-void-audit.js';
import { waadaScoreBadgeHtml } from '../profile-ui.js';
import { calculateTopDefaulters } from '../dashboard-top-defaulters.js';
import { TRANSLATIONS, t } from '../nav-language.js';

const SAMPLE_NAMES = Array.from({ length: 74 }, (_, i) => `Test Customer ${String(i + 1).padStart(2, '0')}`); // synthetic seed names (privacy cleanup: app ships an empty starter list)

const septemberReference = new Date(2026, 8, 29, 12);
const octoberReference = new Date(2026, 9, 20, 12);
const novemberReference = new Date(2026, 10, 15, 12);

const withPromise = (state, customerId, promise) => ({
  ...state,
  customers: state.customers.map(c => c.id === customerId ? { ...c, ...promise } : c)
});
const pricedBill = (state, customerId, month, dueAmount, refDate) =>
  saveBillMonth(state, customerId, { month, dueAmount, dueDate: `${month}-05`, status: 'pending' }, refDate);
const customerOf = (state, id) => state.customers.find(c => c.id === id);

// --- Pure derivation from recorded resolutions ------------------------------

test('score: a promise paid on or before its date counts kept (stamp on the clearing payment)', () => {
  const customer = {
    id: 'c1',
    bills: [{
      month: '2026-09',
      payments: [{ id: 'p1', date: '2026-09-09', amount: 3000, clearedWaada: { promiseDate: '2026-09-10', promiseAmount: 3000, promiseNote: '' } }]
    }]
  };
  assert.deepEqual(computeWaadaScore(customer, 0, '2026-09-15'), { kept: 1, broken: 0, total: 1 });
  // Paid exactly ON the promise date is still kept ("on/before").
  const onTheDay = {
    id: 'c1',
    bills: [{ month: '2026-09', payments: [{ id: 'p1', date: '2026-09-10', amount: 3000, clearedWaada: { promiseDate: '2026-09-10' } }] }]
  };
  assert.deepEqual(computeWaadaScore(onTheDay, 0, '2026-09-15'), { kept: 1, broken: 0, total: 1 });
});

test('score: a promise paid only after its date counts broken exactly once (no live double-count)', () => {
  // The late full payment cleared the promise, so nothing is live; the
  // stamp alone carries the broken resolution.
  const customer = {
    id: 'c1',
    bills: [{ month: '2026-10', payments: [{ id: 'p1', date: '2026-10-12', amount: 3000, clearedWaada: { promiseDate: '2026-10-10' } }] }]
  };
  assert.deepEqual(computeWaadaScore(customer, 0, '2026-10-20'), { kept: 0, broken: 1, total: 1 });
});

test('score: the live expired-and-unpaid promise counts broken via the shared tier definition', () => {
  const customer = { id: 'c1', promiseDate: '2026-10-10', bills: [] };
  assert.deepEqual(computeWaadaScore(customer, 3000, '2026-10-11'), { kept: 0, broken: 1, total: 1 });
  // Same promise the day before its date: promised, not broken.
  assert.deepEqual(computeWaadaScore(customer, 3000, '2026-10-09'), { kept: 0, broken: 0, total: 0 });
  // Expired date but nothing owed: not queued, not broken.
  assert.deepEqual(computeWaadaScore(customer, 0, '2026-10-11'), { kept: 0, broken: 0, total: 0 });
  // No promise at all: honest zero state.
  assert.deepEqual(computeWaadaScore({ id: 'c1', bills: [] }, 3000, '2026-10-11'), { kept: 0, broken: 0, total: 0 });
});

test('score: voided clearing payments are skipped and unstamped/invalid records never count', () => {
  const customer = {
    id: 'c1',
    bills: [{
      month: '2026-09',
      payments: [
        { id: 'p1', date: '2026-09-09', amount: 3000, voided: true, clearedWaada: { promiseDate: '2026-09-10' } },
        { id: 'p2', date: '2026-09-09', amount: 500 },
        { id: 'p3', date: '2026-09-09', amount: 500, clearedWaada: { promiseDate: 'not-a-date' } },
        { id: 'p4', amount: 500, clearedWaada: { promiseDate: '2026-09-10' } }
      ]
    }]
  };
  assert.deepEqual(computeWaadaScore(customer, 0, '2026-09-15'), { kept: 0, broken: 0, total: 0 });
});

test('score: resolutions across several bills sum; evaluation is pure and idempotent', () => {
  const customer = {
    id: 'c1',
    promiseDate: '2026-11-10',
    bills: [
      { month: '2026-09', payments: [{ id: 'p1', date: '2026-09-08', amount: 3000, clearedWaada: { promiseDate: '2026-09-10' } }] },
      { month: '2026-10', payments: [{ id: 'p2', date: '2026-10-10', amount: 3000, clearedWaada: { promiseDate: '2026-10-10' } }] }
    ]
  };
  const snapshot = JSON.stringify(customer);
  const first = computeWaadaScore(customer, 3000, '2026-11-15');
  const second = computeWaadaScore(customer, 3000, '2026-11-15');
  assert.deepEqual(first, { kept: 2, broken: 1, total: 3 });
  assert.deepEqual(second, first, 're-evaluation never accumulates');
  assert.equal(JSON.stringify(customer), snapshot, 'the derivation never mutates the record');
  // A reload / backup round-trip of the same record recomputes identically.
  const reloaded = JSON.parse(snapshot);
  assert.deepEqual(computeWaadaScore(reloaded, 3000, '2026-11-15'), first);
});

test('score: snoozing moves the promise date — it is NOT broken at the old date', () => {
  const promised = { id: 'c1', promiseDate: '2026-10-05', bills: [] };
  assert.deepEqual(computeWaadaScore(promised, 3000, '2026-10-06'), { kept: 0, broken: 1, total: 1 }, 'expired unpaid before the snooze');
  const snoozed = setCustomerWaada(promised, { promiseDate: '2026-10-20', promiseAmount: 3000, promiseNote: '' });
  assert.deepEqual(computeWaadaScore(snoozed, 3000, '2026-10-10'), { kept: 0, broken: 0, total: 0 }, 'old date passed, new date has not — not broken');
  assert.deepEqual(computeWaadaScore(snoozed, 3000, '2026-10-21'), { kept: 0, broken: 1, total: 1 }, 'the new date is the one that can break');
});

// --- End-to-end through the real ledger (core addPayment auto-clear) -------

// Builds the spec journey on seed-001: Sep promise kept early, Oct promise
// kept on the day, Nov promise left expired + unpaid.
function specJourneyState() {
  let state = createInitialState(SAMPLE_NAMES);
  state = pricedBill(state, 'seed-001', '2026-09', '3000', septemberReference);
  state = withPromise(state, 'seed-001', { promiseDate: '2026-09-10', promiseAmount: 3000, promiseNote: '' });
  state = addPayment(state, 'seed-001', '2026-09', { date: '2026-09-09', amount: '3000', method: 'Cash' }, septemberReference);

  state = pricedBill(state, 'seed-001', '2026-10', '3000', octoberReference);
  state = withPromise(state, 'seed-001', { promiseDate: '2026-10-10', promiseAmount: 3000, promiseNote: '' });
  state = addPayment(state, 'seed-001', '2026-10', { date: '2026-10-10', amount: '3000', method: 'Cash' }, octoberReference);

  state = pricedBill(state, 'seed-001', '2026-11', '3000', novemberReference);
  state = withPromise(state, 'seed-001', { promiseDate: '2026-11-10', promiseAmount: 3000, promiseNote: '' });
  return state;
}

test('spec pin: kept 2 / broken 1 derives end-to-end from real recorded payments', () => {
  const state = specJourneyState();
  const customer = customerOf(state, 'seed-001');
  assert.equal('promiseDate' in customerOf(specJourneyState(), 'seed-001'), true, 'the Nov promise is the live one');
  assert.deepEqual(computeWaadaScore(customer, 3000, '2026-11-15'), { kept: 2, broken: 1, total: 3 });
});

test('spec pin: profile badge renders "Kept 2 / Broken 1" for the same customer', () => {
  const state = specJourneyState();
  const html = waadaScoreBadgeHtml(state, customerOf(state, 'seed-001'), '2026-11-15');
  assert.match(html, /Waada Score: Kept 2 \/ Broken 1/);
  assert.match(html, /waada-score-badge/);
});

test('spec pin: defaulter row carries the same Kept 2 / Broken 1 score', () => {
  const state = specJourneyState();
  const { accounts } = calculateTopDefaulters(state, { referenceDate: novemberReference, limit: 0 });
  const row = accounts.find(a => a.id === 'seed-001');
  assert.ok(row, 'the customer still owes the November bill, so the row exists');
  assert.deepEqual(row.waadaScore, { kept: 2, broken: 1, total: 3 });
  assert.equal(
    t('wscore_badge', 'en', { kept: row.waadaScore.kept, broken: row.waadaScore.broken }),
    '🤝 Waada Score: Kept 2 / Broken 1'
  );
});

test('zero state: a customer with no resolved waada shows no profile badge and a zero score', () => {
  const state = createInitialState(SAMPLE_NAMES);
  const customer = customerOf(state, 'seed-002');
  assert.equal(waadaScoreBadgeHtml(state, customer, '2026-11-15'), '');
  assert.deepEqual(computeWaadaScore(customer, 0, '2026-11-15'), { kept: 0, broken: 0, total: 0 });
});

test('void interplay: voiding the clearing payment unwinds the kept count and restores the promise as broken', () => {
  let state = createInitialState(SAMPLE_NAMES);
  state = pricedBill(state, 'seed-001', '2026-10', '3000', octoberReference);
  state = withPromise(state, 'seed-001', { promiseDate: '2026-10-10', promiseAmount: 3000, promiseNote: '' });
  state = addPayment(state, 'seed-001', '2026-10', { date: '2026-10-09', amount: '3000', method: 'Cash' }, octoberReference);
  assert.deepEqual(computeWaadaScore(customerOf(state, 'seed-001'), 0, '2026-10-20'), { kept: 1, broken: 0, total: 1 });

  const clearingPayment = customerOf(state, 'seed-001').bills.find(b => b.month === '2026-10').payments
    .find(p => p.clearedWaada);
  assert.ok(clearingPayment, 'the full payment carries the SISP-34 stamp');
  const { state: voided } = voidPayment(state, 'seed-001', '2026-10', clearingPayment.id, {
    voidReason: 'Synthetic void for SISP-98 test',
    voidedAt: '2026-10-20T10:00:00.000Z'
  });
  const restored = customerOf(voided, 'seed-001');
  assert.equal(restored.promiseDate, '2026-10-10', 'SISP-34 restores the stamped promise');
  // The voided stamp counts for nothing; the restored, expired, unpaid
  // promise counts once as broken — the score unwinds exactly, never twice.
  assert.deepEqual(computeWaadaScore(restored, 3000, '2026-10-20'), { kept: 0, broken: 1, total: 1 });
});

test('backup carry: clearedWaada stamps ride the JSON backup, so a restored ledger recomputes the same score', () => {
  const state = specJourneyState();
  const backup = createJsonBackup(state, novemberReference);
  const backupText = typeof backup === 'string' ? backup : JSON.stringify(backup);
  assert.match(backupText, /clearedWaada/, 'the resolution stamps are part of the backup payload');
  const parsed = JSON.parse(backupText);
  const restoredCustomer = (parsed.customers ?? parsed.state?.customers ?? []).find(c => c.id === 'seed-001');
  assert.ok(restoredCustomer, 'customer record present in the backup');
  assert.deepEqual(computeWaadaScore(restoredCustomer, 3000, '2026-11-15'), { kept: 2, broken: 1, total: 3 });
});

// --- i18n -------------------------------------------------------------------

test('i18n: wscore_badge exists in both dictionaries and interpolates counts without leaking the raw key', () => {
  assert.equal(typeof TRANSLATIONS.en.wscore_badge, 'string');
  assert.equal(typeof TRANSLATIONS.ur.wscore_badge, 'string');
  assert.equal(t('wscore_badge', 'en', { kept: 2, broken: 1 }), '🤝 Waada Score: Kept 2 / Broken 1');
  const urdu = t('wscore_badge', 'ur', { kept: 2, broken: 1 });
  assert.match(urdu, /2/);
  assert.match(urdu, /1/);
  assert.ok(!urdu.includes('wscore_badge'), 'Urdu badge never falls back to the raw key');
});
