export const BACKUP_FREQUENCIES = Object.freeze({ daily:24 * 60 * 60 * 1000, weekly:7 * 24 * 60 * 60 * 1000 });
export const DEFAULT_BACKUP_FREQUENCY = 'weekly';
export const BACKUP_DATABASE_NAME = 'shahdara-isp-billing-local-backups-v1';
const DATABASE_VERSION = 1;
const META_STORE = 'metadata';
const BACKUP_STORE = 'backups';
const PAYLOAD_STORE = 'backupPayloads';
const MAX_BACKUP_CHARACTERS = 25 * 1024 * 1024;
const MINIMUM_FREE_BYTES = 256 * 1024;

export function normalizeBackupFrequency(value) {
  return Object.hasOwn(BACKUP_FREQUENCIES, value) ? value : DEFAULT_BACKUP_FREQUENCY;
}

export function isAutomaticBackupDue(lastSuccessfulAt, frequency = DEFAULT_BACKUP_FREQUENCY, now = new Date()) {
  const interval = BACKUP_FREQUENCIES[frequency];
  if (!interval) throw new Error('Backup frequency must be daily or weekly.');
  if (!lastSuccessfulAt) return true;
  const last = Date.parse(lastSuccessfulAt);
  const current = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(last) || !Number.isFinite(current)) return true;
  return current - last >= interval;
}

export function assessBackupStorage(snapshotBytes, estimate) {
  const size = Number(snapshotBytes);
  const quota = Number(estimate?.quota);
  const usage = Number(estimate?.usage);
  if (!Number.isFinite(size) || size < 0) throw new Error('Backup size is invalid.');
  if (!Number.isFinite(quota) || quota <= 0 || !Number.isFinite(usage) || usage < 0) {
    return { available:true, checked:false, requiredBytes:size * 2 + MINIMUM_FREE_BYTES, freeBytes:null };
  }
  const freeBytes = Math.max(0, quota - usage);
  // IndexedDB may store text with more overhead than its downloadable UTF-8 size.
  const requiredBytes = size * 2 + Math.max(MINIMUM_FREE_BYTES, Math.ceil(quota * 0.02));
  return { available:freeBytes >= requiredBytes, checked:true, requiredBytes, freeBytes };
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Local backup storage request failed.'));
  });
}

function transactionResult(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Local backup storage transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Local backup storage transaction was interrupted.'));
  });
}

function uniqueId(now, cryptoObject) {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  let random;
  try { random = cryptoObject?.randomUUID?.(); } catch { random = ''; }
  if (!random) random = `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `${stamp}-${random}`;
}

export function createLocalBackupStore({
  indexedDB = globalThis.indexedDB,
  storage = globalThis.navigator?.storage,
  cryptoObject = globalThis.crypto,
  clock = () => new Date()
} = {}) {
  let databasePromise;
  function openDatabase() {
    if (!indexedDB?.open) return Promise.reject(new Error('App-private backup storage is unavailable in this browser. Download a JSON backup instead.'));
    if (!databasePromise) {
      databasePromise = new Promise((resolve, reject) => {
        let request;
        try { request = indexedDB.open(BACKUP_DATABASE_NAME, DATABASE_VERSION); }
        catch { reject(new Error('Could not open app-private backup storage. Download a JSON backup instead.')); return; }
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(META_STORE)) database.createObjectStore(META_STORE, { keyPath:'key' });
          if (!database.objectStoreNames.contains(BACKUP_STORE)) database.createObjectStore(BACKUP_STORE, { keyPath:'id' });
          if (!database.objectStoreNames.contains(PAYLOAD_STORE)) database.createObjectStore(PAYLOAD_STORE, { keyPath:'id' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Could not open app-private backup storage.'));
        request.onblocked = () => reject(new Error('Local backup storage is busy in another app window. Close the other window and retry.'));
      }).catch(error => {
        databasePromise = undefined;
        throw error;
      });
    }
    return databasePromise;
  }

  async function readMeta(key) {
    const database = await openDatabase();
    const transaction = database.transaction(META_STORE, 'readonly');
    const done = transactionResult(transaction);
    const request = transaction.objectStore(META_STORE).get(key);
    const [record] = await Promise.all([requestResult(request), done]);
    return record ?? null;
  }

  async function updateMeta(record) {
    const database = await openDatabase();
    const transaction = database.transaction(META_STORE, 'readwrite');
    const done = transactionResult(transaction);
    transaction.objectStore(META_STORE).put(record);
    await done;
  }

  async function listBackups() {
    const database = await openDatabase();
    const transaction = database.transaction(BACKUP_STORE, 'readonly');
    const done = transactionResult(transaction);
    const request = transaction.objectStore(BACKUP_STORE).getAll();
    const [records] = await Promise.all([requestResult(request), done]);
    return records.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }

  return Object.freeze({
    async getSettings() {
      const record = await readMeta('settings');
      return { frequency:normalizeBackupFrequency(record?.frequency) };
    },
    async setFrequency(frequency) {
      if (!Object.hasOwn(BACKUP_FREQUENCIES, frequency)) throw new Error('Choose daily or weekly automatic backups.');
      await updateMeta({ key:'settings', frequency, updatedAt:clock().toISOString() });
      return { frequency };
    },
    async getStatus() {
      const record = await readMeta('status');
      return record ?? { key:'status', lastSuccessfulAt:null, lastSizeBytes:null, lastBackupId:null, failureAt:null, failureMessage:'' };
    },
    async listBackups() {
      return (await listBackups()).map(({ id, createdAt, kind, sizeBytes }) => ({ id, createdAt, kind, sizeBytes }));
    },
    async getBackup(id) {
      if (!id) throw new Error('Choose a saved backup first.');
      const database = await openDatabase();
      const transaction = database.transaction([BACKUP_STORE, PAYLOAD_STORE], 'readonly');
      const done = transactionResult(transaction);
      const metadataRequest = transaction.objectStore(BACKUP_STORE).get(id);
      const payloadRequest = transaction.objectStore(PAYLOAD_STORE).get(id);
      const [metadata, payload] = await Promise.all([requestResult(metadataRequest), requestResult(payloadRequest), done]).then(values => values);
      if (!metadata || typeof payload?.backupText !== 'string') throw new Error('That saved backup is unavailable or incomplete. No local data has changed.');
      return { ...metadata, backupText:payload.backupText };
    },
    async saveBackup(backupText, { kind = 'manual', createdAt = clock() } = {}) {
      if (typeof backupText !== 'string' || backupText.length === 0 || backupText.length > MAX_BACKUP_CHARACTERS) throw new Error('Backup is too large or unreadable for local backup storage. No existing backup or ledger data was changed. Download a JSON backup to a user-selected location instead.');
      if (!['manual','automatic'].includes(kind)) throw new Error('Backup type is invalid.');
      const timestamp = createdAt instanceof Date ? createdAt : new Date(createdAt);
      if (!Number.isFinite(timestamp.getTime())) throw new Error('Backup date is invalid.');
      const sizeBytes = new TextEncoder().encode(backupText).byteLength;
      if (typeof storage?.estimate === 'function') {
        let estimate;
        try { estimate = await storage.estimate(); }
        catch { estimate = null; }
        if (estimate) {
          const capacity = assessBackupStorage(sizeBytes, estimate);
          if (!capacity.available) throw new Error('Not enough browser storage for another safe backup. Your existing backups and ledger were left unchanged; download a JSON backup to a location with free space.');
        }
      }
      // Best-effort eviction protection only; backups remain app-private and are not a cloud/device-loss copy.
      if (typeof storage?.persist === 'function') {
        try { await storage.persist(); } catch { /* Browser refusal does not block a safe local write. */ }
      }
      const id = uniqueId(timestamp, cryptoObject);
      const record = { id, createdAt:timestamp.toISOString(), kind, sizeBytes };
      const database = await openDatabase();
      const transaction = database.transaction([BACKUP_STORE, PAYLOAD_STORE, META_STORE], 'readwrite');
      const done = transactionResult(transaction);
      // add() is intentional: a duplicate key aborts rather than replacing any prior snapshot.
      transaction.objectStore(BACKUP_STORE).add(record);
      transaction.objectStore(PAYLOAD_STORE).add({ id, backupText });
      transaction.objectStore(META_STORE).put({
        key:'status',
        lastSuccessfulAt:record.createdAt,
        lastSizeBytes:sizeBytes,
        lastBackupId:id,
        failureAt:null,
        failureMessage:'',
        lastAttemptAt:record.createdAt,
        lastKind:kind
      });
      await done;
      return record;
    },
    async recordFailure(message, failedAt = clock()) {
      const previous = await readMeta('status') ?? { lastSuccessfulAt:null, lastSizeBytes:null, lastBackupId:null };
      const safeMessage = String(message || 'Local backup could not be saved.').replace(/[\r\n\u2028\u2029]+/g, ' ').slice(0, 240);
      await updateMeta({ ...previous, key:'status', failureAt:(failedAt instanceof Date ? failedAt : new Date(failedAt)).toISOString(), failureMessage:safeMessage, lastAttemptAt:(failedAt instanceof Date ? failedAt : new Date(failedAt)).toISOString() });
    }
  });
}
