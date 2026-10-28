/**
 * storage-safety.js — On-device data-safety layers for the Shahdara ISP
 * billing app. This module ADDS protective layers around the existing
 * storage; it never changes the data model, storage keys, backup file
 * format, or source of truth (localStorage ledger + the existing local
 * backup store stay exactly as they are).
 *
 * Layer A — Pre-destructive-action safety snapshots: a timestamped snapshot
 *   (same backup document as the existing local backups, so the existing
 *   checksum-gated restore review can read it) saved before a customer
 *   delete, a payment void, or a backup restore/apply. Kept: newest 5.
 * Layer B — Quota guard + save-failure fallback: size assessment before the
 *   central persist, a one-time-per-session warning, and an emergency
 *   IndexedDB fallback copy when a save fails with a quota error. The
 *   fallback is NEVER read on normal load and is never a second source of
 *   truth; it exists only so a failed save is not silently lost.
 * Layer C — Load-time integrity check: pure verification of the saved
 *   ledger text (parse + the same structural guards readState applies).
 *   The live ledger carries no checksum by design, so checksum verification
 *   applies to snapshot/backup candidates, never to the live ledger.
 *
 * Pure helpers have zero DOM/storage access so they run unchanged in Node
 * unit tests. Only createSaveFallbackStore touches IndexedDB, and only on
 * the explicit fallback path.
 */

import { verifyBackupChecksum } from './backup-health.js?v=1.11.0';

export const SAFETY_SNAPSHOT_KIND = 'safety';
export const MAX_SAFETY_SNAPSHOTS = 5;
// Conservative localStorage warning threshold. Browsers commonly allow
// ~5 MB per origin for localStorage, but the limit is not standardised, so
// warn well before it: a ledger at/above this size deserves an immediate
// off-device JSON export.
export const SAVE_SIZE_WARN_BYTES = 4_000_000;
export const SAVE_FALLBACK_DB = 'shahdara-isp-billing-save-fallback-v1';
export const SAVE_FALLBACK_STORE = 'fallbackSaves';
export const SAVE_FALLBACK_RECORD_ID = 'latest-failed-save';

// ------------------------------------------------------------ Layer B sizes --
// Pure: assess whether a serialized ledger is safe to write. `estimate` is
// the optional navigator.storage.estimate() result ({quota, usage}); when it
// is absent only the conservative byte threshold applies.
export function assessSaveSize(byteLength, estimate = null) {
  const bytes = Number(byteLength);
  if (!Number.isFinite(bytes) || bytes < 0) return { warn: false, reason: 'unknown', bytes };
  if (bytes >= SAVE_SIZE_WARN_BYTES) {
    return { warn: true, reason: 'ledger-size', bytes, threshold: SAVE_SIZE_WARN_BYTES };
  }
  const quota = Number(estimate?.quota);
  const usage = Number(estimate?.usage);
  if (Number.isFinite(quota) && quota > 0 && Number.isFinite(usage) && usage >= 0) {
    const freeBytes = Math.max(0, quota - usage);
    if (freeBytes < bytes * 2 + 256 * 1024) {
      return { warn: true, reason: 'storage-estimate', bytes, freeBytes };
    }
  }
  return { warn: false, reason: 'ok', bytes };
}

export function isQuotaError(error) {
  if (!error) return false;
  if (error.name === 'QuotaExceededError') return true;
  if (error.code === 22 || error.code === 1014) return true;
  return /quota|exceeded/i.test(String(error.message || ''));
}

// --------------------------------------------------------- Layer A rotation --
// Pure: from a metadata list (listBackups returns newest-first), return the
// ids of safety snapshots beyond the newest `keep` — i.e. the ones rotation
// must delete. Other kinds are never touched, and the list order is never
// trusted: sort defensively by createdAt descending first.
export function selectSafetySnapshotsToRotate(backups, keep = MAX_SAFETY_SNAPSHOTS) {
  const safety = (backups ?? []).filter(backup => backup?.kind === SAFETY_SNAPSHOT_KIND);
  const sorted = [...safety].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
  return sorted.slice(keep).map(backup => backup.id).filter(Boolean);
}

// Pure: counts for snapshot metadata, from the live state object.
export function countLedgerRecords(state) {
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  let paymentCount = 0;
  for (const customer of customers) {
    for (const bill of customer?.bills ?? []) paymentCount += (bill?.payments ?? []).length;
  }
  return { customerCount: customers.length, paymentCount };
}

// ------------------------------------------------------- Layer C verification --
// Pure: verify saved ledger text with the same guards readState applies
// (parseable JSON, version 1, customers array, every customer named).
// Returns 'empty' for no saved text (first run), 'corrupt' for anything
// unreadable, 'healthy' otherwise. The live ledger carries no checksum
// field by design, so checksum is always reported as 'none' here —
// checksum verification belongs to backup/snapshot candidates below.
export function verifyLiveLedger(rawText) {
  if (rawText === null || rawText === undefined) return { status: 'empty', checksum: 'none' };
  let parsed;
  try { parsed = JSON.parse(rawText); }
  catch { return { status: 'corrupt', checksum: 'none', reason: 'malformed' }; }
  if (parsed?.version !== 1 || !Array.isArray(parsed.customers)) {
    return { status: 'corrupt', checksum: 'none', reason: 'structure' };
  }
  if (!parsed.customers.every(customer => customer && typeof customer === 'object' && typeof customer.name === 'string' && customer.name.trim())) {
    return { status: 'corrupt', checksum: 'none', reason: 'customer' };
  }
  return { status: 'healthy', checksum: 'none' };
}

// Pure: rank recovery candidates for the Layer C recovery screen.
// Candidates carry {id, createdAt, kind, backupText}. Verified backups come
// first (newest first), then unverified legacy backups (also newest first).
// Checksum mismatches and unparseable texts are NEVER offered.
export function rankRecoveryCandidates(candidates) {
  const ranked = [];
  for (const candidate of candidates ?? []) {
    if (!candidate || typeof candidate.backupText !== 'string') continue;
    const verdict = verifyBackupChecksum(candidate.backupText);
    if (verdict.status === 'verified') ranked.push({ ...candidate, checksumStatus: 'verified', rank: 0 });
    else if (verdict.status === 'unverified') ranked.push({ ...candidate, checksumStatus: 'unverified', rank: 1 });
  }
  return ranked.sort((a, b) => (a.rank - b.rank) || String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
}

// ------------------------------------------------- Layer B fallback storage --
// Minimal IndexedDB wrapper for the emergency save-failure copy. Single
// record, single store, separate database from the local backup store.
// Deliberately NOT read on normal load: the only reader is the backup
// manager's emergency-copy notice (download + clear), so a failed save can
// be recovered by the operator without ever becoming a second ledger.
function fallbackRequestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Emergency save storage request failed.'));
  });
}

function fallbackTransactionResult(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Emergency save storage transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Emergency save storage transaction was interrupted.'));
  });
}

export function createSaveFallbackStore({ indexedDB = globalThis.indexedDB } = {}) {
  let databasePromise;
  function openDatabase() {
    if (!indexedDB?.open) return Promise.reject(new Error('Emergency save storage is unavailable in this browser. Export a JSON backup immediately.'));
    if (!databasePromise) {
      databasePromise = new Promise((resolve, reject) => {
        let request;
        try { request = indexedDB.open(SAVE_FALLBACK_DB, 1); }
        catch { reject(new Error('Could not open emergency save storage.')); return; }
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(SAVE_FALLBACK_STORE)) {
            database.createObjectStore(SAVE_FALLBACK_STORE, { keyPath: 'id' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Could not open emergency save storage.'));
        request.onblocked = () => reject(new Error('Emergency save storage is busy in another app window.'));
      }).catch(error => {
        databasePromise = undefined;
        throw error;
      });
    }
    return databasePromise;
  }

  return Object.freeze({
    async saveFallback(backupText, { format = 'backup', savedAt = new Date() } = {}) {
      if (typeof backupText !== 'string' || backupText.length === 0) {
        throw new Error('Emergency save copy is empty.');
      }
      const timestamp = savedAt instanceof Date ? savedAt : new Date(savedAt);
      if (!Number.isFinite(timestamp.getTime())) throw new Error('Emergency save date is invalid.');
      const database = await openDatabase();
      const transaction = database.transaction(SAVE_FALLBACK_STORE, 'readwrite');
      const done = fallbackTransactionResult(transaction);
      transaction.objectStore(SAVE_FALLBACK_STORE).put({
        id: SAVE_FALLBACK_RECORD_ID,
        backupText,
        format,
        savedAt: timestamp.toISOString(),
        sizeBytes: new TextEncoder().encode(backupText).byteLength
      });
      await done;
      return { id: SAVE_FALLBACK_RECORD_ID, savedAt: timestamp.toISOString() };
    },
    async getFallback() {
      const database = await openDatabase();
      const transaction = database.transaction(SAVE_FALLBACK_STORE, 'readonly');
      const done = fallbackTransactionResult(transaction);
      const request = transaction.objectStore(SAVE_FALLBACK_STORE).get(SAVE_FALLBACK_RECORD_ID);
      const [record] = await Promise.all([fallbackRequestResult(request), done]);
      return record ?? null;
    },
    async clearFallback() {
      const database = await openDatabase();
      const transaction = database.transaction(SAVE_FALLBACK_STORE, 'readwrite');
      const done = fallbackTransactionResult(transaction);
      transaction.objectStore(SAVE_FALLBACK_STORE).delete(SAVE_FALLBACK_RECORD_ID);
      await done;
    }
  });
}
