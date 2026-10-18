import test from 'node:test';
import assert from 'node:assert/strict';
import { assessBackupStorage, BACKUP_FREQUENCIES, DEFAULT_BACKUP_FREQUENCY, isAutomaticBackupDue, normalizeBackupFrequency, calculateBackupAge, checkStoragePersistence, requestStoragePersistence, getStorageEstimateInfo, formatBytes, shareJsonBackupFile } from '../backup-store.js';

test('automatic backup frequency accepts only daily or weekly and defaults to weekly', () => {
  assert.equal(normalizeBackupFrequency('daily'), 'daily');
  assert.equal(normalizeBackupFrequency('weekly'), 'weekly');
  assert.equal(normalizeBackupFrequency('never'), DEFAULT_BACKUP_FREQUENCY);
  assert.deepEqual(Object.keys(BACKUP_FREQUENCIES).sort(), ['daily','weekly']);
});

test('first automatic backup is due and daily/weekly schedules use elapsed time', () => {
  const now = new Date('2026-10-07T10:00:00.000Z');
  assert.equal(isAutomaticBackupDue(null, 'daily', now), true);
  assert.equal(isAutomaticBackupDue('not-a-date', 'weekly', now), true);
  assert.equal(isAutomaticBackupDue('2026-10-06T10:00:00.000Z', 'daily', now), true);
  assert.equal(isAutomaticBackupDue('2026-10-06T10:00:01.000Z', 'daily', now), false);
  assert.equal(isAutomaticBackupDue('2026-09-30T10:00:00.000Z', 'weekly', now), true);
  assert.equal(isAutomaticBackupDue('2026-10-01T10:00:00.000Z', 'weekly', now), false);
  assert.throws(() => isAutomaticBackupDue(null, 'monthly', now), /daily or weekly/);
});

test('quota preflight includes a safety margin and conservatively budgets stored text', () => {
  const fits = assessBackupStorage(100_000, { usage:1_000_000, quota:5_000_000 });
  assert.equal(fits.checked, true);
  assert.equal(fits.available, true);
  assert.ok(fits.requiredBytes > 200_000);
  const full = assessBackupStorage(1_000_000, { usage:4_000_000, quota:5_000_000 });
  assert.equal(full.available, false);
  assert.equal(full.freeBytes, 1_000_000);
});

test('unknown quota remains an attempted write with an explicit safety reserve', () => {
  const result = assessBackupStorage(80_000, {});
  assert.equal(result.checked, false);
  assert.equal(result.available, true);
  assert.ok(result.requiredBytes >= 80_000 * 2);
});

test('formatBytes converts bytes into clean human readable units', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(2.5 * 1024 * 1024), '2.5 MB');
  assert.equal(formatBytes(1.5 * 1024 * 1024 * 1024), '1.50 GB');
});

test('calculateBackupAge correctly classifies backup recency and danger levels', () => {
  const now = new Date('2026-10-18T14:00:00.000Z');

  // Never backed up
  const never = calculateBackupAge(null, now);
  assert.equal(never.level, 'danger');
  assert.equal(never.shortLabel, 'Never');
  assert.equal(never.days, null);

  // Today
  const today = calculateBackupAge('2026-10-18T08:00:00.000Z', now);
  assert.equal(today.level, 'healthy');
  assert.equal(today.shortLabel, 'Today');
  assert.equal(today.days, 0);

  // Yesterday (1d ago)
  const yest = calculateBackupAge('2026-10-17T12:00:00.000Z', now);
  assert.equal(yest.level, 'healthy');
  assert.equal(yest.shortLabel, '1d ago');
  assert.equal(yest.days, 1);

  // 5 days ago (healthy, <= 7 days)
  const fiveDays = calculateBackupAge('2026-10-13T12:00:00.000Z', now);
  assert.equal(fiveDays.level, 'healthy');
  assert.equal(fiveDays.days, 5);

  // 9 days ago (warning, > 7 days && <= 14 days)
  const nineDays = calculateBackupAge('2026-10-09T12:00:00.000Z', now);
  assert.equal(nineDays.level, 'warning');
  assert.equal(nineDays.days, 9);

  // 16 days ago (danger, > 14 days)
  const sixteenDays = calculateBackupAge('2026-10-02T12:00:00.000Z', now);
  assert.equal(sixteenDays.level, 'danger');
  assert.equal(sixteenDays.days, 16);
});

test('checkStoragePersistence and requestStoragePersistence query storage API safely', async () => {
  // Unsupported
  const unsupp = await checkStoragePersistence({ storage: null });
  assert.equal(unsupp.supported, false);
  assert.equal(unsupp.persisted, false);

  // Persisted
  const mockStoragePersisted = {
    persisted: async () => true,
    persist: async () => true
  };
  const res1 = await checkStoragePersistence({ storage: mockStoragePersisted });
  assert.equal(res1.supported, true);
  assert.equal(res1.persisted, true);
  assert.equal(res1.status, 'persisted');

  // Best-effort
  const mockStorageBestEffort = {
    persisted: async () => false,
    persist: async () => false
  };
  const res2 = await checkStoragePersistence({ storage: mockStorageBestEffort });
  assert.equal(res2.supported, true);
  assert.equal(res2.persisted, false);
  assert.equal(res2.status, 'best-effort');

  const reqRes = await requestStoragePersistence({ storage: mockStoragePersisted });
  assert.equal(reqRes.supported, true);
  assert.equal(reqRes.persisted, true);
});

test('getStorageEstimateInfo calculates formatted usage, quota, and percentage', async () => {
  const mockEstimateStorage = {
    estimate: async () => ({ usage: 50 * 1024 * 1024, quota: 1000 * 1024 * 1024 })
  };
  const info = await getStorageEstimateInfo({ storage: mockEstimateStorage });
  assert.equal(info.supported, true);
  assert.equal(info.usageFormatted, '50.0 MB');
  assert.equal(info.quotaFormatted, '1000.0 MB');
  assert.equal(info.percentUsed, 5);
});

test('shareJsonBackupFile invokes Web Share when supported and falls back to download', async () => {
  const jsonContent = JSON.stringify({ state: { customers: [] } });

  // Web Share supported
  let shareCalled = false;
  let sharedPayload = null;
  const mockShare = async (payload) => {
    shareCalled = true;
    sharedPayload = payload;
  };
  const mockCanShare = ({ files }) => files && files.length > 0;

  const shareResult = await shareJsonBackupFile({
    backupText: jsonContent,
    filename: 'test-backup.json',
    shareApi: mockShare,
    canShareApi: mockCanShare
  });

  assert.equal(shareResult.success, true);
  assert.equal(shareResult.method, 'share');
  assert.equal(shareCalled, true);
  assert.equal(sharedPayload.title, 'Shahdara ISP Billing Backup');

  // Fallback to download when Web Share unavailable
  const downloadResult = await shareJsonBackupFile({
    backupText: jsonContent,
    filename: 'test-backup.json',
    shareApi: null,
    canShareApi: null
  });
  assert.equal(downloadResult.success, true);
  assert.equal(downloadResult.method, 'download');
  assert.equal(downloadResult.filename, 'test-backup.json');
  assert.equal(downloadResult.backupText, jsonContent);
});

