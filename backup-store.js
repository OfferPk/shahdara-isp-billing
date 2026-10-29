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
      return (await listBackups()).map(({ id, createdAt, kind, sizeBytes, customerCount, paymentCount }) => ({ id, createdAt, kind, sizeBytes, customerCount, paymentCount }));
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
    async deleteBackup(id) {
      if (!id) throw new Error('Choose a saved backup first.');
      const database = await openDatabase();
      const transaction = database.transaction([BACKUP_STORE, PAYLOAD_STORE], 'readwrite');
      const done = transactionResult(transaction);
      transaction.objectStore(BACKUP_STORE).delete(id);
      transaction.objectStore(PAYLOAD_STORE).delete(id);
      await done;
    },
    async saveBackup(backupText, { kind = 'manual', createdAt = clock(), customerCount = undefined, paymentCount = undefined, updateStatus = true } = {}) {
      if (typeof backupText !== 'string' || backupText.length === 0 || backupText.length > MAX_BACKUP_CHARACTERS) throw new Error('Backup is too large or unreadable for local backup storage. No existing backup or ledger data was changed. Download a JSON backup to a user-selected location instead.');
      if (!['manual','automatic','safety'].includes(kind)) throw new Error('Backup type is invalid.');
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
      const record = { id, createdAt:timestamp.toISOString(), kind, sizeBytes,
        ...(Number.isFinite(customerCount) ? { customerCount } : {}),
        ...(Number.isFinite(paymentCount) ? { paymentCount } : {}) };
      const database = await openDatabase();
      const transaction = database.transaction([BACKUP_STORE, PAYLOAD_STORE, META_STORE], 'readwrite');
      const done = transactionResult(transaction);
      // add() is intentional: a duplicate key aborts rather than replacing any prior snapshot.
      transaction.objectStore(BACKUP_STORE).add(record);
      transaction.objectStore(PAYLOAD_STORE).add({ id, backupText });
      // Safety snapshots must not disturb the automatic-backup schedule or
      // the "last successful backup" display: they are a separate safety
      // net, so callers pass updateStatus:false for them.
      if (updateStatus) {
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
      }
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

// ------------------------------------------------------- SISP-36 doctor --
// The Khata Doctor's verified-balance cache (qa-khata-doctor.js). It is a
// NEW key with safe defaults: an absent or unreadable cache simply means
// "no verified baseline yet" and the doctor reports balances as
// unverified — the ledger itself is never read from or written to here.
// The cache is written ONLY by Auto-Repair, after a safety snapshot, and
// stores per customer the exact ledger-derived balance plus the ledger
// fingerprint it was derived from.
export const KHATA_DOCTOR_CACHE_KEY = 'sisp_khata_doctor_v1';

/** Sanitize a stored doctor cache; anything malformed degrades to empty. */
export function sanitizeKhataDoctorCache(value) {
  const balances = {};
  if (value && typeof value === 'object' && value.balances && typeof value.balances === 'object') {
    for (const [customerId, entry] of Object.entries(value.balances)) {
      if (!customerId || !entry || typeof entry !== 'object') continue;
      const balanceCents = Number(entry.balanceCents);
      if (!Number.isSafeInteger(balanceCents)) continue;
      balances[customerId] = {
        balanceCents,
        fingerprint: typeof entry.fingerprint === 'string' ? entry.fingerprint : ''
      };
    }
  }
  return {
    version: 1,
    updatedAt: typeof value?.updatedAt === 'string' ? value.updatedAt : null,
    balances
  };
}

export function loadKhataDoctorCache(storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return sanitizeKhataDoctorCache(null);
    const raw = store.getItem(KHATA_DOCTOR_CACHE_KEY);
    if (!raw) return sanitizeKhataDoctorCache(null);
    return sanitizeKhataDoctorCache(JSON.parse(raw));
  } catch {
    return sanitizeKhataDoctorCache(null);
  }
}

/** Persists the doctor cache; never throws. */
export function saveKhataDoctorCache(cache, storage) {
  try {
    const store = storage || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!store) return false;
    store.setItem(KHATA_DOCTOR_CACHE_KEY, JSON.stringify(sanitizeKhataDoctorCache(cache)));
    return true;
  } catch {
    return false;
  }
}

export const STORAGE_PERSISTENCE_KEY = 'shahdara_storage_persistence_v1';
export const LAST_BACKUP_TIME_KEY = 'shahdara_last_backup_time_v1';

export function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function calculateBackupAge(lastBackupAt, now = new Date()) {
  const currentDate = now instanceof Date ? now : new Date(now);
  if (!lastBackupAt) {
    return {
      days: null,
      label: 'Never backed up',
      shortLabel: 'Never',
      level: 'danger',
      statusText: 'No backup found. Create a backup to protect your business ledger.'
    };
  }
  const lastDate = lastBackupAt instanceof Date ? lastBackupAt : new Date(lastBackupAt);
  if (Number.isNaN(lastDate.getTime()) || Number.isNaN(currentDate.getTime())) {
    return {
      days: null,
      label: 'Date unreadable',
      shortLabel: 'Unknown',
      level: 'danger',
      statusText: 'Last backup timestamp is invalid.'
    };
  }

  const diffMs = Math.max(0, currentDate.getTime() - lastDate.getTime());
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays === 0) {
    return {
      days: 0,
      label: 'Backed up today',
      shortLabel: 'Today',
      level: 'healthy',
      statusText: 'Ledger backup is current and up to date.'
    };
  }
  if (diffDays === 1) {
    return {
      days: 1,
      label: 'Backed up yesterday',
      shortLabel: '1d ago',
      level: 'healthy',
      statusText: 'Ledger backup is recent.'
    };
  }
  if (diffDays <= 7) {
    return {
      days: diffDays,
      label: `Last backup ${diffDays} days ago`,
      shortLabel: `${diffDays}d ago`,
      level: 'healthy',
      statusText: 'Ledger backup is up to date.'
    };
  }
  if (diffDays <= 14) {
    return {
      days: diffDays,
      label: `Last backup ${diffDays} days ago`,
      shortLabel: `${diffDays}d ago`,
      level: 'warning',
      statusText: 'Backup is over a week old. Download or share a backup.'
    };
  }
  return {
    days: diffDays,
    label: `Last backup ${diffDays} days ago`,
    shortLabel: `${diffDays}d ago`,
    level: 'danger',
    statusText: 'Backup is severely outdated (>14 days). Risk of data loss!'
  };
}

export async function checkStoragePersistence({ storage = globalThis.navigator?.storage } = {}) {
  if (!storage || typeof storage.persisted !== 'function') {
    return { supported: false, persisted: false, status: 'unsupported' };
  }
  try {
    const persisted = await storage.persisted();
    return { supported: true, persisted: Boolean(persisted), status: persisted ? 'persisted' : 'best-effort' };
  } catch {
    return { supported: true, persisted: false, status: 'unknown' };
  }
}

export async function requestStoragePersistence({ storage = globalThis.navigator?.storage } = {}) {
  if (!storage || typeof storage.persist !== 'function') {
    return { supported: false, persisted: false, status: 'unsupported' };
  }
  try {
    const persisted = await storage.persist();
    return { supported: true, persisted: Boolean(persisted), status: persisted ? 'persisted' : 'best-effort' };
  } catch {
    return { supported: true, persisted: false, status: 'unknown' };
  }
}

export async function getStorageEstimateInfo({ storage = globalThis.navigator?.storage } = {}) {
  if (!storage || typeof storage.estimate !== 'function') {
    return { supported: false, usageBytes: null, quotaBytes: null, usageFormatted: 'Not available', quotaFormatted: 'Not available', percentUsed: null };
  }
  try {
    const estimate = await storage.estimate();
    const usageBytes = estimate?.usage ?? 0;
    const quotaBytes = estimate?.quota ?? 0;
    const usageFormatted = formatBytes(usageBytes);
    const quotaFormatted = formatBytes(quotaBytes);
    const percentUsed = quotaBytes > 0 ? Math.round((usageBytes / quotaBytes) * 100) : 0;
    return { supported: true, usageBytes, quotaBytes, usageFormatted, quotaFormatted, percentUsed };
  } catch {
    return { supported: true, usageBytes: null, quotaBytes: null, usageFormatted: 'Error checking', quotaFormatted: 'Error checking', percentUsed: null };
  }
}

export async function shareJsonBackupFile({
  backupText,
  filename,
  shareApi = globalThis.navigator?.share,
  canShareApi = globalThis.navigator?.canShare
} = {}) {
  if (typeof backupText !== 'string' || !backupText) {
    throw new Error('Backup data is empty or invalid.');
  }
  const name = filename || `shahdara-isp-billing-backup-${new Date().toISOString().slice(0, 10)}.json`;

  let canShareFiles = false;
  let file = null;
  try {
    if (typeof File !== 'undefined' && typeof canShareApi === 'function') {
      file = new File([backupText], name, { type: 'application/json' });
      canShareFiles = canShareApi({ files: [file] });
    }
  } catch {
    canShareFiles = false;
  }

  if (canShareFiles && typeof shareApi === 'function') {
    try {
      await shareApi({
        title: 'Shahdara ISP Billing Backup',
        text: `Shahdara ISP Billing ledger backup (${name}). Save to WhatsApp or Google Drive.`,
        files: [file]
      });
      return { success: true, method: 'share', filename: name };
    } catch (err) {
      if (err?.name === 'AbortError') {
        return { success: false, method: 'cancelled', message: 'Share was cancelled by user.' };
      }
    }
  }

  return { success: true, method: 'download', filename: name, backupText };
}

export const ENCRYPTED_BACKUP_FORMAT = 'shahdara-isp-billing-encrypted-backup';
export const ENCRYPTED_BACKUP_VERSION = 1;
export const DEFAULT_PBKDF2_ITERATIONS = 100000;

export function bytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(base64) {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function isEncryptedBackupPayload(payload) {
  if (!payload) return false;
  let parsed = payload;
  if (typeof payload === 'string') {
    try {
      parsed = JSON.parse(payload);
    } catch {
      return false;
    }
  }
  return Boolean(
    parsed &&
    typeof parsed === 'object' &&
    parsed.format === ENCRYPTED_BACKUP_FORMAT &&
    typeof parsed.ciphertext === 'string' &&
    typeof parsed.salt === 'string' &&
    typeof parsed.iv === 'string'
  );
}

export async function encryptBackupJson(backupJsonText, passphrase, {
  hint = '',
  iterations = DEFAULT_PBKDF2_ITERATIONS,
  cryptoObject = globalThis.crypto
} = {}) {
  if (typeof backupJsonText !== 'string' || !backupJsonText.trim()) {
    throw new Error('Backup data is empty or invalid.');
  }
  if (!passphrase || typeof passphrase !== 'string' || passphrase.trim().length < 6) {
    throw new Error('Passphrase must be at least 6 characters long.');
  }
  if (!cryptoObject?.subtle) {
    throw new Error('WebCrypto encryption is not supported in this environment.');
  }

  const enc = new TextEncoder();
  const salt = cryptoObject.getRandomValues(new Uint8Array(16));
  const iv = cryptoObject.getRandomValues(new Uint8Array(12));

  const keyMaterial = await cryptoObject.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await cryptoObject.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const plaintextBytes = enc.encode(backupJsonText);
  const ciphertextBuffer = await cryptoObject.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintextBytes
  );

  const envelope = {
    format: ENCRYPTED_BACKUP_FORMAT,
    formatVersion: ENCRYPTED_BACKUP_VERSION,
    cipher: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertextBuffer)),
    hint: typeof hint === 'string' ? hint.trim().slice(0, 100) : '',
    createdAt: new Date().toISOString()
  };

  return JSON.stringify(envelope, null, 2);
}

export async function decryptBackupJson(encryptedDataOrText, passphrase, {
  cryptoObject = globalThis.crypto
} = {}) {
  let envelope = encryptedDataOrText;
  if (typeof encryptedDataOrText === 'string') {
    try {
      envelope = JSON.parse(encryptedDataOrText);
    } catch (err) {
      throw new Error(`Invalid encrypted backup file: ${err.message}`);
    }
  }
  if (!envelope || typeof envelope !== 'object' || envelope.format !== ENCRYPTED_BACKUP_FORMAT) {
    throw new Error('The selected file is not an encrypted Shahdara ISP Billing backup.');
  }
  if (Number(envelope.formatVersion) > ENCRYPTED_BACKUP_VERSION) {
    throw new Error(`Encrypted backup version (${envelope.formatVersion}) is newer than supported by this app. Please update the app.`);
  }
  if (!passphrase || typeof passphrase !== 'string') {
    throw new Error('Passphrase is required to decrypt this backup.');
  }
  if (!cryptoObject?.subtle) {
    throw new Error('WebCrypto decryption is not supported in this environment.');
  }

  const salt = base64ToBytes(envelope.salt);
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  const iterations = Number(envelope.iterations) || DEFAULT_PBKDF2_ITERATIONS;

  const enc = new TextEncoder();
  const keyMaterial = await cryptoObject.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await cryptoObject.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  let decryptedBuffer;
  try {
    decryptedBuffer = await cryptoObject.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
  } catch {
    throw new Error('Decryption failed: incorrect passphrase or corrupted backup file.');
  }

  const dec = new TextDecoder();
  return dec.decode(decryptedBuffer);
}


