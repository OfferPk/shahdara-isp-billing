import test from 'node:test';
import assert from 'node:assert/strict';
import { assessBackupStorage, BACKUP_FREQUENCIES, DEFAULT_BACKUP_FREQUENCY, isAutomaticBackupDue, normalizeBackupFrequency } from '../backup-store.js';

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
