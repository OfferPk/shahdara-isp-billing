// FU5 — a backup containing a cycle-applied SISP-40 referral credit must
// be restorable. Defect found by the SISP-200 certification suite:
// billing-cycle.js withReferralCredit stamped the bill's amountHistory
// entry `changedAt` (and `referralCreditAppliedAt`) with
// Date#toISOString() ("2026-10-02T12:00:00.000Z"), while core.js backup
// validation requires every amountHistory `changedAt` to match
// parseLocalDateTime's strict local "YYYY-MM-DDTHH:MM" format — so
// previewJsonBackupMerge threw "Backup contains an invalid bill
// correction date." for any ledger that ever had a referral credit
// cycle-applied. Every other amountHistory writer uses
// localDateTimeValue (core.js) or `${date}T00:00` (hardware-custody.js);
// withReferralCredit was the only exception.
//
// The fix stamps with core.js's localDateTimeValue — the exact helper
// the other writers use. Amounts, credit logic and engine figures are
// untouched; only the stamp string format changes.
//
// LEGACY PIN (last test) — FLIPPED BY FU5b: a backup exported from a
// PRE-FIX ledger still carries the old ISO stamp in its stored bill,
// and the writer fix alone cannot rewrite history inside an
// already-exported file or an already-stored bill. FU5 originally
// pinned that such a backup still fails restore validation. FU5b then
// added the approved restore-side normalization for exactly this one
// known writer's ISO shape: during backup validation, an
// amountHistory entry of type 'referral_credit_applied' whose
// changedAt is a strict ISO-8601 UTC timestamp naming a real instant
// is converted via localDateTimeValue to the house local format (and
// the bill's referralCreditAppliedAt with it) — so the last test now
// pins the NEW behaviour: the legacy backup restores, with stamps
// converted. The full positive/negative matrix (garbage, impossible
// calendar values, non-UTC shapes and non-referral entries still
// throw) lives in tests/referral-legacy-stamp-restore.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState, addCustomer, updateCustomerProfile, addPayment,
  calculatePaymentAllocations, createJsonBackup, previewJsonBackupMerge
} from '../core.js';
import { runBillingCycle } from '../billing-cycle.js';
import { reconcileReferralCredits } from '../referral-credits.js';

const D = (y, m, d) => new Date(y, m - 1, d, 12);
const SEP1 = D(2026, 9, 1);
const OCT2 = D(2026, 10, 2);
const NOV2 = D(2026, 11, 2);
const LOCAL_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

// Minimal repro (mirrors the SISP-200 certification minimal fixture):
// referrer Rs 3,000/mo, referred Rs 2,000/mo pays September in full,
// the Rs 500 referral credit queues and the October cycle applies it
// to the referrer's October bill.
function referralStampedState() {
  let s = createInitialState();
  s = addCustomer(s, 'FU5 Referrer', SEP1, { mohalla: 'Gangall' });
  const referrer = s.customers[0];
  s = addCustomer(s, 'FU5 Referred', SEP1, { mohalla: 'Gangall', referredByCustomerId: referrer.id });
  const referred = s.customers[1];
  s = updateCustomerProfile(s, referrer.id, { monthlySellingAmount: '3000' }, SEP1);
  s = updateCustomerProfile(s, referred.id, { monthlySellingAmount: '2000' }, SEP1);
  let cycles = [];
  let run = runBillingCycle(s, '2026-09', cycles, D(2026, 9, 2)); s = run.state; cycles = [...cycles, run.cycle];
  s = addPayment(s, referred.id, '2026-09', { date: '2026-09-09', amount: '2000', method: 'Cash' }, D(2026, 9, 9));
  const rec = reconcileReferralCredits(s, [], { now: D(2026, 9, 20) });
  run = runBillingCycle(s, '2026-10', cycles, OCT2, { referralCredits: rec.credits }); s = run.state;
  return { state: s, referrerId: referrer.id, referredId: referred.id };
}

function stampedBill(state, customerId) {
  const customer = state.customers.find((c) => c.id === customerId);
  return customer.bills.find((b) => b.month === '2026-10');
}

test('FU5: cycle-applied referral credit stamps use the local datetime format', () => {
  const { state, referrerId } = referralStampedState();
  const bill = stampedBill(state, referrerId);
  assert.equal(bill.referralCreditAmount, 500);
  const entry = (bill.amountHistory ?? []).find((row) => row.type === 'referral_credit_applied');
  assert.ok(entry, 'the referral credit leaves an amountHistory entry');
  // The exact contract core.js backup validation enforces
  // (parseLocalDateTime): YYYY-MM-DDTHH:MM, no seconds, no Z suffix.
  assert.match(entry.changedAt, LOCAL_DATETIME_RE);
  // referralCreditAppliedAt carries the same stamp, same format.
  assert.equal(bill.referralCreditAppliedAt, entry.changedAt);
  assert.match(bill.referralCreditAppliedAt, LOCAL_DATETIME_RE);
});

test('FU5: a backup of a referral-stamped ledger restores cleanly', () => {
  const { state, referrerId } = referralStampedState();
  const backup = createJsonBackup(state, NOV2);
  // Export side was always healthy: document created and checksummed.
  assert.match(JSON.parse(backup).checksum, /^crc32:[0-9a-f]{8}$/);
  let preview;
  assert.doesNotThrow(() => { preview = previewJsonBackupMerge(createInitialState(), backup, {}); });
  const restoredBill = stampedBill(preview.state, referrerId);
  assert.equal(restoredBill.referralCreditAmount, 500);
  const entry = (restoredBill.amountHistory ?? []).find((row) => row.type === 'referral_credit_applied');
  assert.match(entry.changedAt, LOCAL_DATETIME_RE);
});

test('FU5: referral figures are unchanged — only the stamp format moved', () => {
  const { state, referrerId } = referralStampedState();
  const bill = stampedBill(state, referrerId);
  assert.equal(bill.dueAmount, 3000);
  assert.equal(bill.referralCreditAmount, 500);
  // Engine: October balance due is 3,000 − 500 credit = Rs 2,500.
  const allocations = calculatePaymentAllocations(state);
  const summary = allocations.forMonth(referrerId, '2026-10');
  assert.equal(summary.balanceDueCents, 250000);
});

test('FU5 legacy pin (flipped by FU5b): a pre-fix ISO-stamped backup now restores, stamps normalized', () => {
  const { state, referrerId } = referralStampedState();
  // Simulate a ledger written by the shipped (pre-fix) code: rewrite
  // the referral stamps back into the old ISO shape, exactly as
  // withReferralCredit used to write them.
  const legacy = JSON.parse(JSON.stringify(state));
  const bill = stampedBill(legacy, referrerId);
  bill.referralCreditAppliedAt = '2026-10-02T12:00:00.000Z';
  for (const entry of bill.amountHistory ?? []) {
    if (entry.type === 'referral_credit_applied') entry.changedAt = '2026-10-02T12:00:00.000Z';
  }
  // FU5b: restore-side validation converts ONLY this referral entry's
  // strict-ISO-UTC stamp (and the bill's referralCreditAppliedAt) to
  // the house local format — 12:00 UTC is 17:00 in Asia/Karachi — so
  // the legacy backup restores instead of throwing. Money is
  // untouched; only the stamp strings move. (Before FU5b this test
  // pinned the throw; the full FU5b matrix is in
  // tests/referral-legacy-stamp-restore.test.js.)
  let preview;
  assert.doesNotThrow(() => { preview = previewJsonBackupMerge(createInitialState(), createJsonBackup(legacy, NOV2), {}); });
  const restoredBill = stampedBill(preview.state, referrerId);
  assert.equal(restoredBill.referralCreditAmount, 500);
  const entry = (restoredBill.amountHistory ?? []).find((row) => row.type === 'referral_credit_applied');
  assert.equal(entry.changedAt, '2026-10-02T17:00');
  assert.equal(restoredBill.referralCreditAppliedAt, '2026-10-02T17:00');
  assert.match(entry.changedAt, LOCAL_DATETIME_RE);
});
