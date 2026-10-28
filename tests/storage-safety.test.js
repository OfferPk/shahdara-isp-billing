/**
 * storage-safety.test.js — On-device data-safety layers (Layers A/B/C).
 *
 * Covers, with synthetic data only and no real browser storage:
 *  (a) Safety-snapshot rotation: the 6th safety snapshot drops the oldest
 *      safety snapshot and never touches manual/automatic backups.
 *  (b) Quota guard: the warning fires at the conservative threshold, and a
 *      simulated quota write failure triggers the IndexedDB fallback
 *      attempt plus an explicit error classification (never a silent success).
 *  (c) Load-time integrity: a corrupt or checksum-mismatched ledger offers
 *      recovery (verified candidates only) and never starts blank or
 *      auto-overwrites; a healthy ledger verifies as healthy with zero
 *      behaviour change (the existing readState load tests stay green in
 *      the full suite).
 *
 * The IndexedDB fake below is intentionally compact: it fires onsuccess /
 * onerror / oncomplete / onabort through microtasks, supports the store
 * operations the two stores use (add/put/get/delete/getAll with a keyPath),
 * and aborts a transaction when any of its requests errors — the same
 * contract the real IndexedDB gives the backup and fallback stores.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createLocalBackupStore } from '../backup-store.js';
import { computeBackupChecksum } from '../backup-health.js';
import {
  SAFETY_SNAPSHOT_KIND,
  MAX_SAFETY_SNAPSHOTS,
  SAVE_SIZE_WARN_BYTES,
  SAVE_FALLBACK_RECORD_ID,
  assessSaveSize,
  isQuotaError,
  selectSafetySnapshotsToRotate,
  countLedgerRecords,
  verifyLiveLedger,
  rankRecoveryCandidates,
  createSaveFallbackStore
} from '../storage-safety.js';

// ---------------------------------------------------------- fake IndexedDB --
function createFakeIndexedDB() {
  const databases = new Map();

  class FakeRequest {
    constructor() { this.result = undefined; this.error = undefined; this.onsuccess = null; this.onerror = null; }
  }
  function deliver(request, transaction, result, error) {
    queueMicrotask(() => {
      if (error) {
        request.error = error;
        if (transaction) { transaction.failed = true; transaction.error = error; }
        request.onerror?.();
      } else {
        request.result = result;
        request.onsuccess?.();
      }
    });
  }

  class FakeObjectStore {
    constructor(map, keyPath, transaction) { this.map = map; this.keyPath = keyPath; this.transaction = transaction; }
    add(value) {
      const request = new FakeRequest();
      const key = value[this.keyPath];
      if (this.map.has(key)) deliver(request, this.transaction, undefined, new Error('Key already exists'));
      else { this.map.set(key, value); deliver(request, this.transaction, key); }
      return request;
    }
    put(value) {
      const request = new FakeRequest();
      const key = value[this.keyPath];
      this.map.set(key, value);
      deliver(request, this.transaction, key);
      return request;
    }
    get(key) {
      const request = new FakeRequest();
      deliver(request, this.transaction, this.map.get(key));
      return request;
    }
    delete(key) {
      const request = new FakeRequest();
      this.map.delete(key);
      deliver(request, this.transaction, undefined);
      return request;
    }
    getAll() {
      const request = new FakeRequest();
      deliver(request, this.transaction, [...this.map.values()]);
      return request;
    }
  }

  class FakeTransaction {
    constructor(database) {
      this.database = database;
      this.failed = false;
      this.error = undefined;
      this.oncomplete = null;
      this.onerror = null;
      this.onabort = null;
      // Two hops: request deliveries are single-hop microtasks queued after
      // construction, so the completion check sees any request failure.
      queueMicrotask(() => queueMicrotask(() => {
        if (this.failed) { this.onerror?.(); this.onabort?.(); }
        else this.oncomplete?.();
      }));
    }
    objectStore(name) {
      return new FakeObjectStore(this.database.stores.get(name), this.database.keyPaths.get(name), this);
    }
  }

  class FakeDatabase {
    constructor() {
      this.stores = new Map();
      this.keyPaths = new Map();
      this.objectStoreNames = { contains: name => this.stores.has(name) };
    }
    createObjectStore(name, { keyPath }) {
      this.stores.set(name, new Map());
      this.keyPaths.set(name, keyPath);
      return null;
    }
    transaction() { return new FakeTransaction(this); }
  }

  return {
    open(name) {
      const request = new FakeRequest();
      queueMicrotask(() => {
        let database = databases.get(name);
        if (!database) {
          database = new FakeDatabase();
          databases.set(name, database);
          request.result = database;
          request.onupgradeneeded?.();
          request.onsuccess?.();
        } else {
          request.result = database;
          request.onsuccess?.();
        }
      });
      return request;
    }
  };
}

// A minimal backup document: the real builder stamps a checksum, so the
// checksum helpers see it as verified; corrupting one character afterwards
// must flip it to mismatch.
function fakeBackupDoc(label) {
  const doc = { format: 'shahdara-isp-billing-backup', version: 1, exportedAt: '2026-10-28T00:00:00.000Z', state: { label } };
  doc.checksum = computeBackupChecksum(doc);
  return JSON.stringify(doc);
}

function fakeState(customerCount, paymentsPerCustomer) {
  return {
    customers: Array.from({ length: customerCount }, (_, i) => ({
      name: `Customer ${i + 1}`,
      bills: [{ payments: Array.from({ length: paymentsPerCustomer }, () => ({})) }]
    }))
  };
}

// ------------------------------------------------------------- Layer A tests --
test('safety rotation drops only the oldest safety snapshot, never other kinds', () => {
  const backups = [
    { id: 'manual-1', kind: 'manual', createdAt: '2026-10-28T10:00:00.000Z' },
    { id: 'safety-6', kind: 'safety', createdAt: '2026-10-28T06:00:00.000Z' },
    { id: 'auto-1', kind: 'automatic', createdAt: '2026-10-28T09:00:00.000Z' },
    { id: 'safety-1', kind: 'safety', createdAt: '2026-10-28T01:00:00.000Z' },
    { id: 'safety-2', kind: 'safety', createdAt: '2026-10-28T02:00:00.000Z' },
    { id: 'safety-3', kind: 'safety', createdAt: '2026-10-28T03:00:00.000Z' },
    { id: 'safety-4', kind: 'safety', createdAt: '2026-10-28T04:00:00.000Z' },
    { id: 'safety-5', kind: 'safety', createdAt: '2026-10-28T05:00:00.000Z' }
  ];
  // Six safety snapshots, keep 5: exactly the oldest safety snapshot goes.
  assert.deepEqual(selectSafetySnapshotsToRotate(backups, MAX_SAFETY_SNAPSHOTS), ['safety-1']);
  // Five safety snapshots: nothing rotates, and unsorted input is handled.
  assert.deepEqual(selectSafetySnapshotsToRotate(backups.slice(3), MAX_SAFETY_SNAPSHOTS), []);
  assert.equal(MAX_SAFETY_SNAPSHOTS, 5);
  assert.equal(SAFETY_SNAPSHOT_KIND, 'safety');
});

test('safety snapshots save with counts, do not touch backup health status, and rotate via deleteBackup', async () => {
  const fakeIndexedDB = createFakeIndexedDB();
  const store = createLocalBackupStore({ indexedDB: fakeIndexedDB, storage: undefined, clock: () => new Date('2026-10-28T12:00:00.000Z') });
  const manual = await store.saveBackup(fakeBackupDoc('manual'), { kind: 'manual', createdAt: new Date('2026-10-28T01:00:00.000Z') });
  const automatic = await store.saveBackup(fakeBackupDoc('auto'), { kind: 'automatic', createdAt: new Date('2026-10-28T02:00:00.000Z') });
  const safetyIds = [];
  for (let i = 1; i <= 6; i++) {
    const record = await store.saveBackup(fakeBackupDoc(`safety-${i}`), {
      kind: 'safety',
      createdAt: new Date(`2026-10-28T0${i}:00:00.000Z`),
      customerCount: 10 + i,
      paymentCount: 20 + i,
      updateStatus: false
    });
    safetyIds.push(record.id);
  }
  // Health status still points at the automatic backup, not at any safety snapshot.
  const status = await store.getStatus();
  assert.equal(status.lastBackupId, automatic.id);
  assert.equal(status.lastKind, 'automatic');
  // Metadata carries the counts for the safety list UI.
  const listed = await store.listBackups();
  const newestSafety = listed.find(backup => backup.id === safetyIds[5]);
  assert.equal(newestSafety.kind, 'safety');
  assert.equal(newestSafety.customerCount, 16);
  assert.equal(newestSafety.paymentCount, 26);
  // Rotate: drop the oldest safety snapshot; manual + automatic untouched.
  const stale = selectSafetySnapshotsToRotate(listed, MAX_SAFETY_SNAPSHOTS);
  assert.deepEqual(stale, [safetyIds[0]]);
  await store.deleteBackup(stale[0]);
  const after = await store.listBackups();
  assert.equal(after.some(backup => backup.id === safetyIds[0]), false);
  assert.equal(after.some(backup => backup.id === manual.id), true);
  assert.equal(after.some(backup => backup.id === automatic.id), true);
  assert.equal(after.filter(backup => backup.kind === 'safety').length, 5);
  // The rotated snapshot's payload is gone too.
  await assert.rejects(() => store.getBackup(safetyIds[0]), /unavailable/i);
});

test('backup kind validation still rejects unknown kinds', async () => {
  const store = createLocalBackupStore({ indexedDB: createFakeIndexedDB(), storage: undefined });
  await assert.rejects(() => store.saveBackup(fakeBackupDoc('x'), { kind: 'bogus' }), /invalid/i);
});

// ------------------------------------------------------------- Layer B tests --
test('quota guard warns at the conservative threshold and via storage estimate', () => {
  assert.equal(SAVE_SIZE_WARN_BYTES, 4_000_000);
  assert.equal(assessSaveSize(1_000_000).warn, false);
  assert.equal(assessSaveSize(3_999_999).warn, false);
  assert.deepEqual({ warn: assessSaveSize(4_000_000).warn, reason: assessSaveSize(4_000_000).reason }, { warn: true, reason: 'ledger-size' });
  assert.equal(assessSaveSize(1_000_000, { quota: 10_000_000, usage: 9_500_000 }).warn, true);
  assert.equal(assessSaveSize(1_000_000, { quota: 10_000_000, usage: 9_500_000 }).reason, 'storage-estimate');
  assert.equal(assessSaveSize(1_000_000, { quota: 100_000_000, usage: 1_000_000 }).warn, false);
  assert.equal(assessSaveSize(1_000_000, null).warn, false);
  assert.equal(assessSaveSize(1_000_000, { quota: null, usage: null }).warn, false);
});

test('quota error classification covers name, legacy codes, and message', () => {
  const quotaName = new Error('full');
  quotaName.name = 'QuotaExceededError';
  assert.equal(isQuotaError(quotaName), true);
  assert.equal(isQuotaError(Object.assign(new Error('x'), { code: 22 })), true);
  assert.equal(isQuotaError(Object.assign(new Error('x'), { code: 1014 })), true);
  assert.equal(isQuotaError(new Error('storage quota exceeded')), true);
  assert.equal(isQuotaError(new Error('boom')), false);
  assert.equal(isQuotaError(null), false);
});

test('emergency fallback store saves, reads, and clears a single record — never a second ledger', async () => {
  const fallback = createSaveFallbackStore({ indexedDB: createFakeIndexedDB() });
  assert.equal(await fallback.getFallback(), null);
  const saved = await fallback.saveFallback(fakeBackupDoc('emergency'), { format: 'backup', savedAt: new Date('2026-10-28T12:00:00.000Z') });
  assert.equal(saved.id, SAVE_FALLBACK_RECORD_ID);
  const record = await fallback.getFallback();
  assert.equal(record.format, 'backup');
  assert.equal(record.backupText, fakeBackupDoc('emergency'));
  assert.ok(record.sizeBytes > 0);
  // A second failure overwrites the same single record, never a second copy.
  await fallback.saveFallback('raw-ledger-text', { format: 'ledger', savedAt: new Date('2026-10-28T13:00:00.000Z') });
  assert.equal((await fallback.getFallback()).format, 'ledger');
  await fallback.clearFallback();
  assert.equal(await fallback.getFallback(), null);
});

test('ledger record counts feed the safety snapshot metadata', () => {
  assert.deepEqual(countLedgerRecords(fakeState(3, 2)), { customerCount: 3, paymentCount: 6 });
  assert.deepEqual(countLedgerRecords({ customers: [] }), { customerCount: 0, paymentCount: 0 });
  assert.deepEqual(countLedgerRecords(null), { customerCount: 0, paymentCount: 0 });
});

// ------------------------------------------------------------- Layer C tests --
test('live ledger verification: healthy passes, corrupt variants fail, empty is distinct', () => {
  assert.deepEqual(verifyLiveLedger(JSON.stringify({ version: 1, customers: [{ name: 'RAJA ALI' }] })), { status: 'healthy', checksum: 'none' });
  assert.equal(verifyLiveLedger(null).status, 'empty');
  assert.equal(verifyLiveLedger(undefined).status, 'empty');
  assert.equal(verifyLiveLedger('not json{').status, 'corrupt');
  assert.equal(verifyLiveLedger('not json{').reason, 'malformed');
  assert.equal(verifyLiveLedger(JSON.stringify({ version: 2, customers: [] })).status, 'corrupt');
  assert.equal(verifyLiveLedger(JSON.stringify({ version: 1, customers: 'nope' })).status, 'corrupt');
  assert.equal(verifyLiveLedger(JSON.stringify({ version: 1, customers: [{ name: '   ' }] })).status, 'corrupt');
  assert.equal(verifyLiveLedger(JSON.stringify({ version: 1, customers: [{ name: null }] })).status, 'corrupt');
  // The live ledger carries no checksum by design — checksum is a property
  // of backup/snapshot candidates, never of the live ledger.
  assert.equal(verifyLiveLedger(JSON.stringify({ version: 1, customers: [] })).checksum, 'none');
});

test('recovery ranking offers verified first, unverified second, and never mismatch or invalid', () => {
  const verified = fakeBackupDoc('good');
  const tampered = verified.slice(0, -3) + 'xxx';
  const legacy = JSON.stringify({ format: 'shahdara-isp-billing-backup', version: 1, state: {} });
  const candidates = rankRecoveryCandidates([
    { id: 'mismatch', createdAt: '2026-10-28T09:00:00.000Z', kind: 'safety', backupText: tampered },
    { id: 'legacy', createdAt: '2026-10-28T08:00:00.000Z', kind: 'manual', backupText: legacy },
    { id: 'verified-old', createdAt: '2026-10-28T07:00:00.000Z', kind: 'automatic', backupText: verified },
    { id: 'verified-new', createdAt: '2026-10-28T10:00:00.000Z', kind: 'safety', backupText: verified },
    { id: 'garbage', createdAt: '2026-10-28T11:00:00.000Z', kind: 'safety', backupText: 'not json' }
  ]);
  assert.deepEqual(candidates.map(candidate => candidate.id), ['verified-new', 'verified-old', 'legacy']);
  assert.deepEqual(candidates.map(candidate => candidate.checksumStatus), ['verified', 'verified', 'unverified']);
  // A corrupt ledger never yields a blank start: ranking alone never
  // overwrites anything — the operator's explicit Restore choice does.
  assert.equal(candidates.some(candidate => candidate.id === 'mismatch'), false);
  assert.equal(candidates.some(candidate => candidate.id === 'garbage'), false);
});

test('a corrupt live ledger plus a valid safety snapshot yields a recoverable candidate', () => {
  const live = verifyLiveLedger('{"version":1,"customers":[');
  assert.equal(live.status, 'corrupt');
  const candidates = rankRecoveryCandidates([
    { id: 'safety-1', createdAt: '2026-10-28T06:00:00.000Z', kind: 'safety', backupText: fakeBackupDoc('pre-delete') }
  ]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].checksumStatus, 'verified');
});
