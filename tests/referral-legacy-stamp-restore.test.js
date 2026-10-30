// FU5b — a backup exported from a PRE-FU5 ledger must be restorable.
// billing-cycle.js withReferralCredit (shipped writer) stamped the
// bill's amountHistory entry `changedAt` and `referralCreditAppliedAt`
// via Date#toISOString() ("2026-10-02T12:00:00.000Z"), while core.js
// backup validation requires the local "YYYY-MM-DDTHH:MM" shape — so
// every backup containing a cycle-applied SISP-40 referral credit
// failed restore with "Backup contains an invalid bill correction
// date." FU5 fixed the writer going forward, but bills already stamped
// carry the ISO string forever and every re-export copies it verbatim.
//
// The restore-side fix is deliberately narrow: during backup
// validation, ONLY an amountHistory entry whose type is exactly
// 'referral_credit_applied' AND whose changedAt is a strict ISO-8601
// UTC timestamp naming a real instant is converted, via
// localDateTimeValue, to the house local format (and the bill's
// referralCreditAppliedAt with it, when the bill carries such an
// entry). Everything else — other entry types, missing type, garbage,
// impossible calendar values, non-UTC shapes — still throws exactly
// as before. These tests pin both halves of that contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState, addCustomer, updateCustomerProfile, addPayment,
  createJsonBackup, previewJsonBackupMerge
} from '../core.js';
import { runBillingCycle } from '../billing-cycle.js';
import { reconcileReferralCredits } from '../referral-credits.js';

const D = (y, m, d) => new Date(y, m - 1, d, 12);
const SEP1 = D(2026, 9, 1);
const OCT2 = D(2026, 10, 2);
const NOV2 = D(2026, 11, 2);
const LEGACY_ISO = '2026-10-02T12:00:00.000Z';
// 12:00 UTC is 17:00 in Asia/Karachi (UTC+5, no DST) — the exact
// local stamp localDateTimeValue must produce for the legacy instant.
const LEGACY_AS_LOCAL = '2026-10-02T17:00';
const CORRECTION_ERROR = /Backup contains an invalid bill correction date\./;

// Same minimal referral scenario as the FU5 suite, built entirely
// through the real write paths: referrer Rs 3,000/mo, referred
// Rs 2,000/mo pays September in full, the Rs 500 referral credit
// queues and the October cycle applies it to the referrer's bill.
function referralStampedState() {
  let s = createInitialState();
  s = addCustomer(s, 'FU5b Referrer', SEP1, { mohalla: 'Gangall' });
  const referrer = s.customers[0];
  s = addCustomer(s, 'FU5b Referred', SEP1, { mohalla: 'Gangall', referredByCustomerId: referrer.id });
  const referred = s.customers[1];
  s = updateCustomerProfile(s, referrer.id, { monthlySellingAmount: '3000' }, SEP1);
  s = updateCustomerProfile(s, referred.id, { monthlySellingAmount: '2000' }, SEP1);
  let cycles = [];
  let run = runBillingCycle(s, '2026-09', cycles, D(2026, 9, 2)); s = run.state; cycles = [...cycles, run.cycle];
  s = addPayment(s, referred.id, '2026-09', { date: '2026-09-09', amount: '2000', method: 'Cash' }, D(2026, 9, 9));
  const rec = reconcileReferralCredits(s, [], { now: D(2026, 9, 20) });
  run = runBillingCycle(s, '2026-10', cycles, OCT2, { referralCredits: rec.credits }); s = run.state;
  return { state: s, referrerId: referrer.id };
}

function octoberBill(state, customerId) {
  const customer = state.customers.find((c) => c.id === customerId);
  return customer.bills.find((b) => b.month === '2026-10');
}

function referralEntry(bill) {
  return (bill.amountHistory ?? []).find((row) => row.type === 'referral_credit_applied');
}

// A deep-copied state whose referral stamps are rewritten into the
// exact legacy ISO shape the shipped writer produced — the content of
// a backup exported from an affected (pre-FU5) ledger. The optional
// mutator lets a test damage the stamps further.
function legacyState(mutator) {
  const { state, referrerId } = referralStampedState();
  const legacy = JSON.parse(JSON.stringify(state));
  const bill = octoberBill(legacy, referrerId);
  assert.equal(bill.referralCreditAmount, 500, 'fixture carries the applied referral credit');
  bill.referralCreditAppliedAt = LEGACY_ISO;
  referralEntry(bill).changedAt = LEGACY_ISO;
  if (mutator) mutator(bill);
  return { legacy, referrerId };
}

function restoreIntoEmpty(backupText) {
  return previewJsonBackupMerge(createInitialState(), backupText, {});
}

test('FU5b: a legacy ISO-stamped referral backup restores, stamps converted to PKT local format', () => {
  const { legacy, referrerId } = legacyState();
  const backup = createJsonBackup(legacy, NOV2);
  let preview;
  assert.doesNotThrow(() => { preview = restoreIntoEmpty(backup); });
  assert.equal(preview.checksumStatus, 'verified');
  assert.equal(preview.canApply, true);
  const bill = octoberBill(preview.state, referrerId);
  // Money is untouched — only the stamp strings moved.
  assert.equal(bill.dueAmount, 3000);
  assert.equal(bill.referralCreditAmount, 500);
  // 2026-10-02T12:00:00.000Z == 2026-10-02 17:00 Asia/Karachi.
  assert.equal(referralEntry(bill).changedAt, LEGACY_AS_LOCAL);
  assert.equal(bill.referralCreditAppliedAt, LEGACY_AS_LOCAL);
  // The rest of the entry rides through unchanged.
  assert.equal(referralEntry(bill).referralCredit, 500);
});

test('FU5b: round trip — a restored ledger re-exports and restores again with no further change', () => {
  const { legacy, referrerId } = legacyState();
  const first = restoreIntoEmpty(createJsonBackup(legacy, NOV2));
  const firstBill = octoberBill(first.state, referrerId);
  const second = restoreIntoEmpty(createJsonBackup(first.state, NOV2));
  const secondBill = octoberBill(second.state, referrerId);
  assert.equal(referralEntry(secondBill).changedAt, LEGACY_AS_LOCAL);
  assert.equal(secondBill.referralCreditAppliedAt, LEGACY_AS_LOCAL);
  assert.deepEqual(secondBill.amountHistory, firstBill.amountHistory);
  // Previewing the same backup text twice is deterministic — the
  // first run leaves no side effects behind.
  const again = restoreIntoEmpty(createJsonBackup(legacy, NOV2));
  assert.deepEqual(octoberBill(again.state, referrerId).amountHistory, firstBill.amountHistory);
});

test('FU5b: a mixed bill converts only the referral entry — ordinary corrections stay byte-identical', () => {
  const { legacy, referrerId } = legacyState((bill) => {
    bill.amountHistory.push({ changedAt: '2026-10-05T09:30', previousAmount: 3000, newAmount: 2800, source: 'manual correction' });
  });
  const preview = restoreIntoEmpty(createJsonBackup(legacy, NOV2));
  const bill = octoberBill(preview.state, referrerId);
  assert.equal(referralEntry(bill).changedAt, LEGACY_AS_LOCAL);
  const manual = bill.amountHistory.find((row) => row.source === 'manual correction');
  assert.deepEqual(manual, { changedAt: '2026-10-05T09:30', previousAmount: 3000, newAmount: 2800, source: 'manual correction' });
});

test('FU5b: a referral entry with a garbage changedAt still fails validation', () => {
  const { legacy } = legacyState((bill) => { referralEntry(bill).changedAt = 'hello'; });
  assert.throws(() => restoreIntoEmpty(createJsonBackup(legacy, NOV2)), CORRECTION_ERROR);
});

test('FU5b: a referral entry with impossible calendar values still fails validation', () => {
  const { legacy } = legacyState((bill) => { referralEntry(bill).changedAt = '2026-13-45T99:99:99.000Z'; });
  assert.throws(() => restoreIntoEmpty(createJsonBackup(legacy, NOV2)), CORRECTION_ERROR);
});

test('FU5b: a referral entry with a rollover date (Feb 30) still fails validation', () => {
  // Date parsing rolls 2026-02-30 over to March — a strict conversion
  // must refuse it rather than silently moving the stamp to another day.
  const { legacy } = legacyState((bill) => { referralEntry(bill).changedAt = '2026-02-30T12:00:00.000Z'; });
  assert.throws(() => restoreIntoEmpty(createJsonBackup(legacy, NOV2)), CORRECTION_ERROR);
});

test('FU5b: non-UTC shapes (no Z suffix, date-only, offset form) still fail validation', () => {
  for (const shape of ['2026-10-02T12:00:00', '2026-10-02', '2026-10-02T12:00:00.000+00:00']) {
    const { legacy } = legacyState((bill) => { referralEntry(bill).changedAt = shape; });
    assert.throws(() => restoreIntoEmpty(createJsonBackup(legacy, NOV2)), CORRECTION_ERROR, `shape ${shape} must stay invalid`);
  }
});

test('FU5b: the same ISO string on a NON-referral entry still fails validation', () => {
  const { legacy } = legacyState((bill) => {
    bill.amountHistory = bill.amountHistory.filter((row) => row.type !== 'referral_credit_applied');
    bill.amountHistory.push({ changedAt: LEGACY_ISO, previousAmount: 3000, newAmount: 2500, source: 'manual correction' });
    delete bill.referralCreditAppliedAt;
    delete bill.referralCreditAmount;
  });
  assert.throws(() => restoreIntoEmpty(createJsonBackup(legacy, NOV2)), CORRECTION_ERROR);
});

test('FU5b: an entry with no type at all still fails validation, even with referral fields', () => {
  const { legacy } = legacyState((bill) => {
    const entry = referralEntry(bill);
    delete entry.type;
  });
  assert.throws(() => restoreIntoEmpty(createJsonBackup(legacy, NOV2)), CORRECTION_ERROR);
});

test('FU5b: a backup with no referral stamps restores exactly as before — history untouched', () => {
  // Plain ledger: one priced customer, September bill paid, plus an
  // ordinary local-format amount correction on the bill.
  let s = createInitialState();
  s = addCustomer(s, 'FU5b Plain', SEP1, { mohalla: 'Gangall' });
  const customer = s.customers[0];
  s = updateCustomerProfile(s, customer.id, { monthlySellingAmount: '2000' }, SEP1);
  let cycles = [];
  const run = runBillingCycle(s, '2026-09', cycles, D(2026, 9, 2)); s = run.state; cycles = [...cycles, run.cycle];
  s = addPayment(s, customer.id, '2026-09', { date: '2026-09-09', amount: '2000', method: 'Cash' }, D(2026, 9, 9));
  const source = JSON.parse(JSON.stringify(s));
  const sourceBill = source.customers[0].bills.find((b) => b.month === '2026-09');
  sourceBill.amountHistory = [{ changedAt: '2026-09-15T10:15', previousAmount: 2200, newAmount: 2000, source: 'manual correction' }];
  const preview = restoreIntoEmpty(createJsonBackup(source, NOV2));
  assert.equal(preview.canApply, true);
  const restoredBill = preview.state.customers[0].bills.find((b) => b.month === '2026-09');
  assert.deepEqual(restoredBill.amountHistory, sourceBill.amountHistory);
  assert.deepEqual(restoredBill.payments.map((p) => p.amount), sourceBill.payments.map((p) => p.amount));
  assert.equal(restoredBill.dueAmount, sourceBill.dueAmount);
  assert.equal('referralCreditAppliedAt' in restoredBill, 'referralCreditAppliedAt' in sourceBill);
});
