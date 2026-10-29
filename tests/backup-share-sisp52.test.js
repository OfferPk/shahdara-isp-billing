/**
 * backup-share-sisp52.test.js — SISP-52: 1-Tap Off-Device Backup File Share.
 *
 * Spec criterion, pinned end to end at the pure-module level: sharing a
 * backup file (a) hands the share handler the exact CRC-32-checksum-stamped
 * export `createJsonBackup` builds — byte-identical, SISP-46 branch-guard
 * stamp intact, never a re-serialized copy — (b) invokes the file share
 * handler, and (c) resets Backup Health (sisp_backup_health_v1) to Safe.
 * The download fallback also counts as an off-device export; a cancelled
 * share records nothing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BACKUP_HEALTH_KEY, assessBackupHealth, countAllPayments,
  createBackupHealthRecord, recordBackupHealthExport, shareBackupOffDevice,
  verifyBackupChecksum
} from '../backup-health.js';
import { shareJsonBackupFile } from '../backup-store.js';
import { createInitialState, createJsonBackup } from '../core.js';

const NOW = new Date('2026-10-29T12:00:00.000Z');

function fakeStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: key => { map.delete(key); },
    _map: map
  };
}

function syntheticState() {
  const state = createInitialState();
  state.customers = [
    { id: 'c1', bills: [{ month: '2026-10', payments: [{ date: '2026-10-20' }, { date: '2026-10-27' }] }] },
    { id: 'c2', bills: [{ month: '2026-10', payments: [{ date: '2026-10-28' }] }] }
  ];
  return state;
}

const BRANCH_STAMP = {
  lineageId: 'lineage-test-1', seq: 4, stampId: 'stamp-test-4',
  parentStampId: 'stamp-test-3', instanceId: 'instance-test-1', fingerprint: 'fp-test'
};

function stampedBackupText(state) {
  return createJsonBackup(state, NOW, { branchGuard: BRANCH_STAMP });
}

test('SISP-52: sharing stamps CRC-32, invokes the file share handler, and resets Backup Health to Safe', async () => {
  const state = syntheticState();
  const backupText = stampedBackupText(state);
  // The export itself carries the SISP-10 CRC-32 stamp before any sharing.
  assert.match(JSON.parse(backupText).checksum, /^crc32:[0-9a-f]{8}$/);
  assert.equal(verifyBackupChecksum(backupText).status, 'verified');

  const storage = fakeStorage();
  let handlerArgs = null;
  const shareFile = async args => {
    handlerArgs = args;
    return { success: true, method: 'share', filename: args.filename };
  };
  let exportedRecord = null;
  const result = await shareBackupOffDevice({
    backupText,
    filename: 'shahdara-backup.json',
    state,
    storage,
    shareFile,
    now: NOW,
    onExported: record => { exportedRecord = record; }
  });

  // (b) the file share handler was invoked with the backup.
  assert.equal(handlerArgs.backupText, backupText);
  assert.equal(handlerArgs.filename, 'shahdara-backup.json');
  assert.equal(result.method, 'share');
  assert.equal(result.checksumStatus, 'verified');

  // (c) sisp_backup_health_v1 now holds a fresh export record → Safe.
  const stored = JSON.parse(storage.getItem(BACKUP_HEALTH_KEY));
  assert.equal(stored.lastExportAt, NOW.toISOString());
  assert.equal(stored.paymentCountAtExport, countAllPayments(state));
  assert.deepEqual(exportedRecord, stored);
  assert.equal(result.healthRecord.lastExportAt, NOW.toISOString());
  assert.equal(result.health.status, 'safe');
  assert.equal(result.health.label, 'Backup: Safe');
  assert.equal(
    assessBackupHealth({ lastExportAt: stored.lastExportAt, paymentsSinceExport: 0, now: NOW }).status,
    'safe'
  );
});

test('SISP-52: the shared file is byte-identical to the downloaded export (checksum + branch stamp intact)', async () => {
  const state = syntheticState();
  const backupText = stampedBackupText(state);
  let seenText = null;
  const result = await shareBackupOffDevice({
    backupText,
    filename: 'shahdara-backup.json',
    state,
    storage: fakeStorage(),
    shareFile: async args => { seenText = args.backupText; return { success: true, method: 'share', filename: args.filename }; },
    now: NOW
  });
  // Pass-through, never re-serialized: the shared bytes ARE the export bytes.
  assert.equal(seenText, backupText);
  const parsed = JSON.parse(seenText);
  // The SISP-46 branch-guard stamp is present, exactly as createJsonBackup
  // stamped it (its sanitizer's canonical shape), with identity intact.
  const stampedInExport = JSON.parse(createJsonBackup(state, NOW, { branchGuard: BRANCH_STAMP })).settings.branchGuard;
  assert.deepEqual(parsed.settings.branchGuard, stampedInExport);
  assert.equal(parsed.settings.branchGuard.lineageId, BRANCH_STAMP.lineageId);
  assert.equal(parsed.settings.branchGuard.seq, BRANCH_STAMP.seq);
  assert.equal(parsed.settings.branchGuard.instanceId, BRANCH_STAMP.instanceId);
  assert.equal(verifyBackupChecksum(seenText).status, 'verified');
  assert.equal(result.checksumStatus, 'verified');
});

test('SISP-52: download fallback also marks Backup Health Safe', async () => {
  const state = syntheticState();
  const storage = fakeStorage();
  const result = await shareBackupOffDevice({
    backupText: stampedBackupText(state),
    filename: 'shahdara-backup.json',
    state,
    storage,
    shareFile: async args => ({ success: true, method: 'download', filename: args.filename, backupText: args.backupText }),
    now: NOW
  });
  assert.equal(result.method, 'download');
  assert.equal(result.backupText, stampedBackupText(state));
  assert.equal(result.health.status, 'safe');
  assert.ok(storage.getItem(BACKUP_HEALTH_KEY));
});

test('SISP-52: a cancelled share is not an error and records nothing', async () => {
  const state = syntheticState();
  const storage = fakeStorage();
  const result = await shareBackupOffDevice({
    backupText: stampedBackupText(state),
    filename: 'shahdara-backup.json',
    state,
    storage,
    shareFile: async () => ({ success: false, method: 'cancelled', message: 'Share was cancelled by user.' }),
    now: NOW
  });
  assert.equal(result.method, 'cancelled');
  assert.equal(result.healthRecord, null);
  assert.equal(result.health, null);
  assert.equal(storage.getItem(BACKUP_HEALTH_KEY), null);
});

test('SISP-52: flow through the real shareJsonBackupFile — Web Share gets the stamped file, verdict reported', async () => {
  const state = syntheticState();
  const backupText = stampedBackupText(state);
  let sharedPayload = null;
  const storage = fakeStorage();
  const result = await shareBackupOffDevice({
    backupText,
    filename: 'shahdara-backup.json',
    state,
    storage,
    shareFile: args => shareJsonBackupFile({
      ...args,
      shareApi: async payload => { sharedPayload = payload; },
      canShareApi: ({ files }) => Array.isArray(files) && files.length === 1
    }),
    now: NOW
  });
  assert.equal(result.method, 'share');
  assert.equal(result.checksumStatus, 'verified');
  assert.equal(sharedPayload.files.length, 1);
  assert.equal(sharedPayload.files[0].name, 'shahdara-backup.json');
  assert.equal(sharedPayload.files[0].type, 'application/json');
  assert.equal(await sharedPayload.files[0].text(), backupText);
  assert.equal(result.health.status, 'safe');
});

test('SISP-52: shareJsonBackupFile reports the checksum verdict — verified, mismatch, unverified', async () => {
  const state = syntheticState();
  const ok = await shareJsonBackupFile({
    backupText: stampedBackupText(state), filename: 'b.json',
    shareApi: null, canShareApi: null
  });
  assert.equal(ok.checksumStatus, 'verified');

  const tamperedDoc = JSON.parse(stampedBackupText(state));
  tamperedDoc.state.nextCustomerNumber = 999;
  const tampered = await shareJsonBackupFile({
    backupText: JSON.stringify(tamperedDoc), filename: 'b.json',
    shareApi: null, canShareApi: null
  });
  assert.equal(tampered.method, 'download'); // reporting never blocks the fallback
  assert.equal(tampered.checksumStatus, 'mismatch');

  const legacyDoc = JSON.parse(stampedBackupText(state));
  delete legacyDoc.checksum;
  const legacy = await shareJsonBackupFile({
    backupText: JSON.stringify(legacyDoc), filename: 'b.json',
    shareApi: null, canShareApi: null
  });
  assert.equal(legacy.checksumStatus, 'unverified');
});

test('SISP-52: recordBackupHealthExport writes the canonical record and never throws', () => {
  const state = syntheticState();
  const storage = fakeStorage();
  const record = recordBackupHealthExport(storage, state, NOW);
  assert.deepEqual(record, createBackupHealthRecord(state, NOW));
  assert.deepEqual(JSON.parse(storage.getItem(BACKUP_HEALTH_KEY)), record);
  assert.equal(record.paymentCountAtExport, 3);
  // Unavailable storage degrades to null — a share must never fail over this.
  assert.equal(recordBackupHealthExport(null, state, NOW), null);
  assert.equal(recordBackupHealthExport({ setItem() { throw new Error('quota'); } }, state, NOW), null);
});

test('SISP-52: share flow refuses empty data / a missing handler instead of dead-ending silently', async () => {
  await assert.rejects(
    () => shareBackupOffDevice({ backupText: '', filename: 'b.json', state: syntheticState(), storage: fakeStorage(), shareFile: async () => ({}) }),
    /empty or invalid/
  );
  await assert.rejects(
    () => shareBackupOffDevice({ backupText: stampedBackupText(syntheticState()), filename: 'b.json', state: syntheticState(), storage: fakeStorage(), shareFile: null }),
    /share handler is unavailable/
  );
});

test('SISP-52: wiring — 1-tap button lives in the Backup Health panel and routes through the share flow', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const panelAt = html.indexOf('class="backup-manager"');
  const buttonAt = html.indexOf('id="shareBackupHealthButton"');
  assert.ok(panelAt !== -1 && buttonAt > panelAt, 'share button must sit inside the backup-manager (Backup Health) panel');
  assert.match(html, /id="shareBackupHealthButton"[^>]*>📤 <span data-i18n="bkup_share_wa_drive_btn">Share Backup to WhatsApp \/ Drive<\/span>/);

  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /\$\('#shareBackupHealthButton'\)\?\.addEventListener\('click', handleShareBackupAction\)/);
  assert.match(app, /shareBackupOffDevice\(\{/);
  assert.match(app, /shareFile: shareJsonBackupFile/);
  assert.match(app, /recordBackupHealthExport\(localStorage, state, new Date\(\)\)/);

  const lang = readFileSync(new URL('../nav-language.js', import.meta.url), 'utf8');
  assert.equal(lang.split('bkup_share_wa_drive_btn').length - 1, 2, 'key must exist in both en and ur dictionaries');
});
