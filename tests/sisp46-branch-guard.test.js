// SISP-46: Multi-Branch Merge Guard.
//
// Two in-memory "devices" (Map-backed localStorage stubs + deterministic
// id factories) simulate the dangerous setup: the same ledger living in
// two browsers. The pins:
//  - a normal same-lineage restore stays silent and works as before;
//  - a FOREIGN lineage merge is blocked by default and the protected
//    side's state is byte-identical after the blocked preview;
//  - the explicit operator override still merges merge-only: the same
//    receipt id recorded on both sides is counted ONCE (Rs 1,500 total,
//    never Rs 2,500);
//  - a DIVERGED same-lineage fork is blocked too, and an override apply
//    heals the chain for both copies;
//  - guard metadata round-trips export -> adopt -> next export;
//  - legacy backups without a stamp warn but are never bricked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, createJsonBackup, previewJsonBackupMerge } from '../core.js';
import {
  BRANCH_GUARD_KEY,
  ensureBranchGuard, loadBranchGuard, saveBranchGuard,
  createBranchGuardStamp, recordBranchGuardExport, recordBranchGuardApply,
  classifyBranchGuardRestore, fingerprintState,
  sanitizeBranchGuard, sanitizeBranchGuardStamp
} from '../branch-guard.js';

const NOW = new Date('2026-10-29T10:00:00.000Z');

function makeStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: key => { map.delete(key); }
  };
}

function makeDevice(prefix) {
  let counter = 0;
  return { storage: makeStorage(), idFactory: () => `${prefix}-${++counter}` };
}

function guardOf(device) {
  return ensureBranchGuard(device.storage, { idFactory: device.idFactory, now: NOW });
}

// Mirrors app.js backupExtras(): stamp the current state, then advance
// the guard head to the stamp just produced.
function exportFrom(device, state) {
  const guard = guardOf(device);
  const stamp = createBranchGuardStamp(guard, state, NOW);
  saveBranchGuard(recordBranchGuardExport(guard, stamp, NOW), device.storage);
  return { text: createJsonBackup(state, NOW, { branchGuard: stamp }), stamp };
}

// Mirrors app.js backupRestoreOptions() + the Apply-path guard update.
function previewOn(device, localState, text, { override = false } = {}) {
  const options = { currentBranchGuard: guardOf(device) };
  if (override) options.branchGuardOverride = true;
  return previewJsonBackupMerge(localState, text, options);
}

function applyOn(device, preview) {
  const next = recordBranchGuardApply(loadBranchGuard(device.storage), preview.branchGuard.stamp, {
    status: preview.branchGuard.status,
    override: preview.branchGuardOverrideApplied === true,
    resultingState: preview.state,
    now: NOW
  });
  saveBranchGuard(next, device.storage);
  return preview.state;
}

function stateWithPayments(payments) {
  const state = createInitialState(['Synthetic Customer One']);
  state.customers[0].bills.push({ id: 'bill-1', month: '2026-10', dueAmount: 1500, status: 'pending', generated: true, payments });
  return state;
}

const pay = (id, amount) => ({ id, date: '2026-10-05', amount, method: 'Cash' });

function paymentTotal(state) {
  return state.customers.reduce((sum, customer) => sum + customer.bills.reduce(
    (billSum, bill) => billSum + bill.payments.reduce((paySum, payment) => paySum + payment.amount, 0), 0), 0);
}

function paymentIds(state) {
  return state.customers.flatMap(customer => customer.bills.flatMap(bill => bill.payments.map(payment => payment.id))).sort();
}

test('same-lineage restores stay silent: same-point, own older export, and no-option callers', () => {
  const deviceA = makeDevice('A');
  const state1 = stateWithPayments([pay('pay-1', 1000)]);
  const first = exportFrom(deviceA, state1);

  // Restoring the exact head export: silent, nothing new to merge.
  const samePoint = previewOn(deviceA, state1, first.text);
  assert.equal(samePoint.branchGuard.status, 'same-point');
  assert.equal(samePoint.branchGuard.silent, true);
  assert.equal(samePoint.branchGuard.blocked, false);
  assert.equal(samePoint.canApply, false); // no changes — the pre-guard rule, unchanged

  // The device advances (a second collection, a second export)…
  const state2 = stateWithPayments([pay('pay-1', 1000), pay('pay-2', 500)]);
  exportFrom(deviceA, state2);
  // …then an OLDER export from this very instance is previewed: still
  // silent ('own'), merge-only adds nothing, never blocked.
  const own = previewOn(deviceA, state2, first.text);
  assert.equal(own.branchGuard.status, 'own');
  assert.equal(own.branchGuard.silent, true);
  assert.equal(own.branchGuard.blocked, false);
  assert.deepEqual(paymentIds(own.state), ['pay-1', 'pay-2']);

  // Callers that never pass a guard record keep the exact pre-guard
  // behaviour (no classification, no block).
  const unchecked = previewJsonBackupMerge(state2, first.text, {});
  assert.equal(unchecked.branchGuard.status, 'not-checked');
  assert.equal(unchecked.branchGuard.blocked, false);
});

test('guard metadata round-trips: adopt on an empty device, next export continues the lineage', () => {
  const deviceA = makeDevice('A');
  const deviceB = makeDevice('B');
  const stateA = stateWithPayments([pay('pay-1', 1000)]);
  const exported = exportFrom(deviceA, stateA);
  assert.equal(exported.stamp.seq, 1);

  // The backup document itself carries the stamp under settings.
  const parsed = JSON.parse(exported.text);
  assert.equal(parsed.settings.branchGuard.lineageId, exported.stamp.lineageId);
  assert.equal(parsed.settings.branchGuard.stampId, exported.stamp.stampId);

  // Device B is empty: the restore is an adopt — silent and applicable.
  const emptyState = createInitialState([]);
  const preview = previewOn(deviceB, emptyState, exported.text);
  assert.equal(preview.branchGuard.status, 'adopt');
  assert.equal(preview.branchGuard.silent, true);
  assert.equal(preview.canApply, true);
  const adoptedState = applyOn(deviceB, preview);
  assert.equal(paymentTotal(adoptedState), 1000);

  // B's guard now heads lineage A at the adopted stamp…
  const guardB = loadBranchGuard(deviceB.storage);
  assert.equal(guardB.lineageId, exported.stamp.lineageId);
  assert.equal(guardB.headSeq, exported.stamp.seq);
  assert.equal(guardB.headStampId, exported.stamp.stampId);
  // …while B keeps its OWN branch identity.
  assert.notEqual(guardB.branchId, guardB.lineageId);

  // B collects a new payment and exports: same lineage, seq + 1, parent
  // chained to the adopted stamp.
  const stateB2 = stateWithPayments([pay('pay-1', 1000), pay('pay-2', 500)]);
  const second = exportFrom(deviceB, stateB2);
  assert.equal(second.stamp.lineageId, exported.stamp.lineageId);
  assert.equal(second.stamp.seq, exported.stamp.seq + 1);
  assert.equal(second.stamp.parentStampId, exported.stamp.stampId);

  // Back on device A that export is a true descendant: silent, applies.
  const backOnA = previewOn(deviceA, stateA, second.text);
  assert.equal(backOnA.branchGuard.status, 'descendant');
  assert.equal(backOnA.branchGuard.silent, true);
  assert.equal(backOnA.canApply, true);
  assert.equal(paymentTotal(backOnA.state), 1500);
});

test('foreign lineage merge is BLOCKED by default and the protected side is untouched', () => {
  const deviceA = makeDevice('A');
  const deviceB = makeDevice('B');
  // Both copies recorded the SAME real-world receipt (id pay-1, Rs 1,000)
  // before they split; copy A additionally recorded pay-2 (Rs 500).
  const shared = [pay('pay-1', 1000)];
  const stateA = stateWithPayments([...shared, pay('pay-2', 500)]);
  const stateB = stateWithPayments([...shared]);
  guardOf(deviceB); // B has its own lineage and a non-empty ledger.
  const foreign = exportFrom(deviceA, stateA);

  const beforeJson = JSON.stringify(stateB);
  const blocked = previewOn(deviceB, stateB, foreign.text);
  assert.equal(blocked.branchGuard.status, 'foreign');
  assert.equal(blocked.branchGuard.blocked, true);
  assert.equal(blocked.branchGuard.requiresOverride, true);
  assert.equal(blocked.canApply, false); // blocked even though the merge WOULD add pay-2
  assert.ok(blocked.counts.changes > 0);
  assert.equal(JSON.stringify(stateB), beforeJson); // preview never mutates the protected side
  assert.equal(paymentTotal(blocked.state), 1500); // the computed merge itself is union-only

  // The explicit operator override applies the SAME merge-only result:
  // pay-1 exists on both sides under one id, so it is counted once —
  // Rs 1,500 total, never Rs 2,500.
  const overridden = previewOn(deviceB, stateB, foreign.text, { override: true });
  assert.equal(overridden.branchGuardOverrideApplied, true);
  assert.equal(overridden.canApply, true);
  assert.deepEqual(paymentIds(overridden.state), ['pay-1', 'pay-2']);
  assert.equal(paymentTotal(overridden.state), 1500);

  // The override is remembered in B's guard log; B's lineage stays B's.
  const guardBefore = loadBranchGuard(deviceB.storage);
  applyOn(deviceB, overridden);
  const guardAfter = loadBranchGuard(deviceB.storage);
  assert.equal(guardAfter.lineageId, guardBefore.lineageId);
  assert.ok(guardAfter.events.some(event => event.type === 'apply-foreign-override' && event.override === true));
});

test('diverged same-lineage fork is BLOCKED; the override unions once and heals the chain', () => {
  const deviceA = makeDevice('A');
  const deviceB = makeDevice('B');
  const base = stateWithPayments([pay('pay-1', 1000)]);
  const genesis = exportFrom(deviceA, base);

  // B adopts the genesis backup, then BOTH copies keep collecting.
  const adopted = applyOn(deviceB, previewOn(deviceB, createInitialState([]), genesis.text));
  assert.equal(paymentTotal(adopted), 1000);
  const stateB = stateWithPayments([pay('pay-1', 1000), pay('pay-b', 300)]);
  const forkB = exportFrom(deviceB, stateB);
  const stateA2 = stateWithPayments([pay('pay-1', 1000), pay('pay-a', 400)]);
  exportFrom(deviceA, stateA2);

  // B's fork descends from the genesis stamp, not from A's new head:
  // same lineage, different instance, broken chain -> blocked.
  const diverged = previewOn(deviceA, stateA2, forkB.text);
  assert.equal(diverged.branchGuard.status, 'diverged');
  assert.equal(diverged.branchGuard.blocked, true);
  assert.equal(diverged.canApply, false);
  assert.equal(paymentTotal(stateA2), 1400); // A's own money untouched

  // Override: union merge, every receipt counted exactly once.
  const healed = previewOn(deviceA, stateA2, forkB.text, { override: true });
  assert.equal(healed.canApply, true);
  assert.deepEqual(paymentIds(healed.state), ['pay-1', 'pay-a', 'pay-b']);
  assert.equal(paymentTotal(healed.state), 1700);
  const mergedState = applyOn(deviceA, healed);

  // A's head moved to B's fork stamp, so B's NEXT export chains cleanly
  // and A accepts it as a descendant — the fork is healed, not hidden.
  const stateB2 = stateWithPayments([pay('pay-1', 1000), pay('pay-b', 300), pay('pay-c', 200)]);
  const nextFromB = exportFrom(deviceB, stateB2);
  const afterHeal = previewOn(deviceA, mergedState, nextFromB.text);
  assert.equal(afterHeal.branchGuard.status, 'descendant');
  assert.equal(afterHeal.canApply, true);
  assert.equal(paymentTotal(afterHeal.state), 1900);
});

test('legacy backups without a stamp warn but are never bricked', () => {
  const deviceA = makeDevice('A');
  guardOf(deviceA);
  const local = stateWithPayments([pay('pay-1', 1000)]);
  const legacyState = createInitialState(['Synthetic Customer One', 'Synthetic Customer Two']);
  const legacyText = createJsonBackup(legacyState, NOW, {}); // no branchGuard option at all
  assert.equal(JSON.parse(legacyText).settings?.branchGuard, undefined);

  const preview = previewOn(deviceA, local, legacyText);
  assert.equal(preview.branchGuard.status, 'legacy');
  assert.equal(preview.branchGuard.blocked, false);
  assert.equal(preview.branchGuard.silent, false); // warned, not silent
  assert.equal(preview.canApply, true); // the second customer merges in as before

  // A malformed stamp option is dropped at export, never written.
  const junkText = createJsonBackup(legacyState, NOW, { branchGuard: { nope: true } });
  assert.equal(JSON.parse(junkText).settings?.branchGuard, undefined);
});

test('sanitizers and fingerprints degrade safely; corrupt storage never breaks restores', () => {
  assert.equal(sanitizeBranchGuard(null), null);
  assert.equal(sanitizeBranchGuard('junk'), null);
  assert.equal(sanitizeBranchGuard([]), null);
  assert.equal(sanitizeBranchGuard({ branchId: 'b' }), null);
  assert.equal(sanitizeBranchGuardStamp(null), null);
  assert.equal(sanitizeBranchGuardStamp({ lineageId: 'x', instanceId: 'y', seq: 'NaN' }), null);
  assert.equal(sanitizeBranchGuardStamp({ lineageId: 'x', instanceId: 'y', seq: 3 }).stampId, '3:y');

  // Key order never changes the fingerprint; content changes always do.
  assert.equal(fingerprintState({ a: 1, b: { c: 2, d: [3] } }), fingerprintState({ b: { d: [3], c: 2 }, a: 1 }));
  assert.notEqual(fingerprintState({ a: 1 }), fingerprintState({ a: 2 }));

  // Corrupt stored JSON -> unguarded (null), and classification of a
  // stamped backup against it warns instead of throwing.
  const device = makeDevice('C');
  device.storage.setItem(BRANCH_GUARD_KEY, '{corrupt');
  assert.equal(loadBranchGuard(device.storage), null);
  const verdict = classifyBranchGuardRestore({
    guard: null,
    stamp: { lineageId: 'L1', instanceId: 'I1', seq: 1 },
    localCustomerCount: 3
  });
  assert.equal(verdict.status, 'unguarded');
  assert.equal(verdict.blocked, false);

  // ensure() recovers by creating a fresh record.
  const fresh = guardOf(device);
  assert.ok(fresh.branchId);
  assert.equal(loadBranchGuard(device.storage).branchId, fresh.branchId);

  // The guard record's own backup-side key name is stable.
  assert.equal(BRANCH_GUARD_KEY, 'sisp_branch_guard_v1');
});
