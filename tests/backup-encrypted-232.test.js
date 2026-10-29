import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encryptBackupJson,
  decryptBackupJson,
  isEncryptedBackupPayload,
  ENCRYPTED_BACKUP_FORMAT,
  ENCRYPTED_BACKUP_VERSION,
  DEFAULT_PBKDF2_ITERATIONS,
  shareJsonBackupFile
} from '../backup-store.js';
import { inspectBackupFileHeader } from '../qa-backup-csv-import.js';
import { createJsonBackup, previewJsonBackupMerge, createInitialState } from '../core.js';

const SAMPLE_NAMES = Array.from({ length: 74 }, (_, i) => `Test Customer ${String(i + 1).padStart(2, '0')}`); // synthetic seed names (privacy cleanup: app ships an empty starter list)

test('Issue #232: isEncryptedBackupPayload accurately identifies encrypted envelopes', () => {
  assert.equal(isEncryptedBackupPayload(null), false);
  assert.equal(isEncryptedBackupPayload(''), false);
  assert.equal(isEncryptedBackupPayload('{"plain":"json"}'), false);
  assert.equal(isEncryptedBackupPayload('{"format":"shahdara-isp-billing-backup"}'), false);

  const mockValid = {
    format: ENCRYPTED_BACKUP_FORMAT,
    formatVersion: 1,
    cipher: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: 100000,
    salt: 'c2FsdDEyMzQ1Njc4OTAxMg==',
    iv: 'aXYxMjM0NTY3ODkw',
    ciphertext: 'Y2lwaGVydGV4dA=='
  };

  assert.equal(isEncryptedBackupPayload(mockValid), true);
  assert.equal(isEncryptedBackupPayload(JSON.stringify(mockValid)), true);

  // Missing salt or iv or ciphertext
  assert.equal(isEncryptedBackupPayload({ ...mockValid, ciphertext: null }), false);
  assert.equal(isEncryptedBackupPayload({ ...mockValid, iv: undefined }), false);
  assert.equal(isEncryptedBackupPayload({ ...mockValid, format: 'other-format' }), false);
});

test('Issue #232: encryptBackupJson validates inputs and protects ledger privacy', async () => {
  const plainText = JSON.stringify({ secret: 'customer-data', balance: 5000 });

  await assert.rejects(
    encryptBackupJson('', 'pass123'),
    /Backup data is empty or invalid/
  );
  await assert.rejects(
    encryptBackupJson(plainText, ''),
    /Passphrase must be at least 6 characters long/
  );
  await assert.rejects(
    encryptBackupJson(plainText, '12345'),
    /Passphrase must be at least 6 characters long/
  );

  const encryptedString = await encryptBackupJson(plainText, 'ShahdaraSecure2026', {
    hint: 'Shop owner password'
  });

  const parsed = JSON.parse(encryptedString);
  assert.equal(parsed.format, ENCRYPTED_BACKUP_FORMAT);
  assert.equal(parsed.formatVersion, ENCRYPTED_BACKUP_VERSION);
  assert.equal(parsed.cipher, 'AES-GCM');
  assert.equal(parsed.kdf, 'PBKDF2-SHA256');
  assert.equal(parsed.iterations, DEFAULT_PBKDF2_ITERATIONS);
  assert.equal(parsed.hint, 'Shop owner password');
  assert.ok(parsed.salt && parsed.salt.length > 10, 'salt exists in base64');
  assert.ok(parsed.iv && parsed.iv.length > 10, 'iv exists in base64');
  assert.ok(parsed.ciphertext && parsed.ciphertext.length > 10, 'ciphertext exists in base64');

  // Verify privacy: no plaintext customer or ledger details leak in the wrapper
  assert.equal(encryptedString.includes('customer-data'), false);
  assert.equal(encryptedString.includes('5000'), false);
});

test('Issue #232: decryptBackupJson rejects wrong passphrase and tampered data', async () => {
  const plainText = JSON.stringify({ message: 'confidential ledger records' });
  const passphrase = 'CorrectPassphrase99!';
  const encrypted = await encryptBackupJson(plainText, passphrase);

  // Wrong passphrase gives clear, friendly error
  await assert.rejects(
    decryptBackupJson(encrypted, 'WrongPassphrase!'),
    /Decryption failed: incorrect passphrase or corrupted backup file/
  );

  // Missing passphrase
  await assert.rejects(
    decryptBackupJson(encrypted, ''),
    /Passphrase is required to decrypt this backup/
  );

  // Tampered ciphertext
  const tamperedObj = JSON.parse(encrypted);
  tamperedObj.ciphertext = 'AAAA' + tamperedObj.ciphertext.slice(4);
  await assert.rejects(
    decryptBackupJson(tamperedObj, passphrase),
    /Decryption failed: incorrect passphrase or corrupted backup file/
  );

  // Wrong format
  await assert.rejects(
    decryptBackupJson({ format: 'unknown' }, passphrase),
    /The selected file is not an encrypted Shahdara ISP Billing backup/
  );
});

test('Issue #232: inspectBackupFileHeader seamlessly recognizes encrypted backups and extracts hint', () => {
  const mockEncrypted = JSON.stringify({
    format: ENCRYPTED_BACKUP_FORMAT,
    formatVersion: 1,
    cipher: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    salt: 'abc',
    iv: 'def',
    ciphertext: 'ghi',
    hint: 'Under keyboard',
    createdAt: '2026-10-21T00:00:00.000Z'
  });

  const inspection = inspectBackupFileHeader(mockEncrypted);
  assert.equal(inspection.valid, true);
  assert.equal(inspection.encrypted, true);
  assert.equal(inspection.hint, 'Under keyboard');
  assert.equal(inspection.cipher, 'AES-GCM');
  assert.equal(inspection.createdAt, '2026-10-21T00:00:00.000Z');
  assert.equal(inspection.customerCount, null);
  assert.equal(inspection.error, null);

  // Unsupported future version
  const futureEncrypted = JSON.stringify({
    format: ENCRYPTED_BACKUP_FORMAT,
    formatVersion: 99
  });
  const futureInspection = inspectBackupFileHeader(futureEncrypted);
  assert.equal(futureInspection.valid, false);
  assert.match(futureInspection.error, /newer than supported/);
});

test('Issue #232: Full round-trip test: state -> backup -> encrypt -> decrypt -> previewJsonBackupMerge identical', async () => {
  const state = createInitialState(SAMPLE_NAMES);
  const rawBackupJson = createJsonBackup(state);

  const passphrase = 'ShahdaraFiberNetwork#2026';
  const hint = 'Head office safe combination';

  // 1. Encrypt
  const encryptedJson = await encryptBackupJson(rawBackupJson, passphrase, { hint });
  assert.ok(isEncryptedBackupPayload(encryptedJson), 'payload detected as encrypted');

  // Inspection recognises it as encrypted
  const header = inspectBackupFileHeader(encryptedJson);
  assert.equal(header.valid, true);
  assert.equal(header.encrypted, true);
  assert.equal(header.hint, hint);

  // 2. Decrypt
  const decryptedJson = await decryptBackupJson(encryptedJson, passphrase);
  assert.equal(decryptedJson, rawBackupJson, 'decrypted JSON exactly matches original backup string');

  // 3. Preview merge
  const previewOriginal = previewJsonBackupMerge(state, rawBackupJson);
  const previewFromDecrypted = previewJsonBackupMerge(state, decryptedJson);

  assert.deepEqual(previewFromDecrypted.counts, previewOriginal.counts);
  assert.deepEqual(previewFromDecrypted.conflicts, previewOriginal.conflicts);
  assert.equal(previewFromDecrypted.canApply, previewOriginal.canApply);

  // When restoring into a different state (e.g. empty customers), canApply is true
  const emptyState = { ...state, customers: [] };
  const previewEmpty = previewJsonBackupMerge(emptyState, decryptedJson);
  assert.equal(previewEmpty.canApply, true);
  assert.ok(previewEmpty.counts.addedCustomers > 0);
});

test('Issue #232: shareJsonBackupFile packages encrypted backup file for WhatsApp / Drive export', async () => {
  let sharedPayload = null;
  const mockShare = async (data) => { sharedPayload = data; };
  const mockCanShare = () => true;

  const encryptedContent = await encryptBackupJson('{"test":true}', 'SecurePass789');
  const filename = 'shahdara-isp-billing-encrypted-backup-2026-10-21.json';

  const result = await shareJsonBackupFile({
    backupText: encryptedContent,
    filename,
    shareApi: mockShare,
    canShareApi: mockCanShare
  });

  assert.equal(result.success, true);
  assert.equal(result.filename, filename);
});
