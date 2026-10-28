/**
 * backup-health.test.js — SISP-10: Backup Health Badge & Checksum Transfer.
 *
 * Pure-module tests (backup-health.js) plus the core.js round-trip:
 * createJsonBackup stamps a checksum, previewJsonBackupMerge verifies it,
 * a tampered backup is refused, and a legacy backup without a checksum
 * still merges with checksumStatus 'unverified'.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crc32Hex, canonicalize, computeBackupChecksum, verifyBackupChecksum,
  countAllPayments, countPaymentsAfterDate, assessBackupHealth,
  BACKUP_HEALTH_PAYMENT_THRESHOLD
} from '../backup-health.js';
import { createInitialState, createJsonBackup, previewJsonBackupMerge } from '../core.js';

const HOUR = 60 * 60 * 1000;

test('SISP-10: CRC-32 is deterministic and sensitive to a single character', () => {
  assert.equal(crc32Hex('shahdara'), crc32Hex('shahdara'));
  assert.notEqual(crc32Hex('shahdara'), crc32Hex('shahdarb'));
  assert.match(crc32Hex('x'), /^[0-9a-f]{8}$/);
  // Known vector: CRC-32 of "123456789" is 0xCBF43926.
  assert.equal(crc32Hex('123456789'), 'cbf43926');
});

test('SISP-10: canonicalize sorts keys so reordering never breaks the checksum', () => {
  assert.equal(canonicalize({ b: 1, a: { d: 4, c: 3 } }), '{"a":{"c":3,"d":4},"b":1}');
  const doc = { format: 'x', state: { customers: [{ name: 'A' }] } };
  const reordered = { state: { customers: [{ name: 'A' }] }, format: 'x' };
  assert.equal(computeBackupChecksum(doc), computeBackupChecksum(reordered));
});

test('SISP-10: createJsonBackup stamps a checksum that verifies', () => {
  const state = createInitialState();
  const text = createJsonBackup(state);
  const parsed = JSON.parse(text);
  assert.match(parsed.checksum, /^crc32:[0-9a-f]{8}$/);
  assert.equal(verifyBackupChecksum(text).status, 'verified');
});

test('SISP-10: a tampered backup is apply-blocked, never silently merged', () => {
  const state = createInitialState();
  const parsed = JSON.parse(createJsonBackup(state));
  parsed.state.nextCustomerNumber = 999;
  const tampered = JSON.stringify(parsed);
  assert.equal(verifyBackupChecksum(tampered).status, 'mismatch');
  // Deep validation still runs (no masking), but the preview refuses apply:
  // no local data is ever overwritten from a corrupted or edited backup.
  const preview = previewJsonBackupMerge(state, tampered);
  assert.equal(preview.checksumStatus, 'mismatch');
  assert.equal(preview.canApply, false);
});

test('SISP-10: a legacy backup without a checksum still merges as unverified', () => {
  const state = createInitialState();
  const parsed = JSON.parse(createJsonBackup(state));
  delete parsed.checksum;
  const legacy = JSON.stringify(parsed);
  assert.equal(verifyBackupChecksum(legacy).status, 'unverified');
  const preview = previewJsonBackupMerge(state, legacy);
  assert.equal(preview.checksumStatus, 'unverified');
});

test('SISP-10: a stamped backup merges as verified', () => {
  const state = createInitialState();
  const preview = previewJsonBackupMerge(state, createJsonBackup(state));
  assert.equal(preview.checksumStatus, 'verified');
});

test('SISP-10: health thresholds — safe < 24h, due 1–3 days, critical > 3 days', () => {
  const now = new Date('2026-10-28T12:00:00Z');
  assert.equal(assessBackupHealth({ lastExportAt: new Date(now - 23 * HOUR).toISOString(), paymentsSinceExport: 0, now }).status, 'safe');
  assert.equal(assessBackupHealth({ lastExportAt: new Date(now - 25 * HOUR).toISOString(), paymentsSinceExport: 0, now }).status, 'due');
  assert.equal(assessBackupHealth({ lastExportAt: new Date(now - 72 * HOUR).toISOString(), paymentsSinceExport: 0, now }).status, 'due');
  const critical = assessBackupHealth({ lastExportAt: new Date(now - 73 * HOUR).toISOString(), paymentsSinceExport: 0, now });
  assert.equal(critical.status, 'critical');
  assert.equal(critical.pulse, true);
  assert.equal(assessBackupHealth({ lastExportAt: null, paymentsSinceExport: 0, now }).status, 'critical');
});

test('SISP-10: recording 10 new payments flips the indicator to critical', () => {
  const now = new Date('2026-10-28T12:00:00Z');
  const recent = new Date(now - 2 * HOUR).toISOString();
  assert.equal(assessBackupHealth({ lastExportAt: recent, paymentsSinceExport: 9, now }).status, 'safe');
  const flipped = assessBackupHealth({ lastExportAt: recent, paymentsSinceExport: BACKUP_HEALTH_PAYMENT_THRESHOLD, now });
  assert.equal(flipped.status, 'critical');
  assert.equal(flipped.pulse, true);
});

test('SISP-10: exporting resets to safe — fresh timestamp, zero new payments', () => {
  const now = new Date('2026-10-28T12:00:00Z');
  assert.equal(assessBackupHealth({ lastExportAt: now.toISOString(), paymentsSinceExport: 0, now }).status, 'safe');
});

test('SISP-10: payment counters — totals and date-based fallback', () => {
  const state = createInitialState();
  state.customers = [
    { id: 'c1', bills: [{ month: '2026-10', payments: [{ date: '2026-10-20' }, { date: '2026-10-27' }] }] },
    { id: 'c2', bills: [{ month: '2026-10', payments: [{ date: '2026-10-28' }] }, { month: '2026-09', payments: [] }] }
  ];
  assert.equal(countAllPayments(state), 3);
  // Export on 2026-10-26: only the 27th and 28th payments are newer.
  assert.equal(countPaymentsAfterDate(state, '2026-10-26'), 2);
  // Same-day payments are not distinguishable by date alone (documented).
  assert.equal(countPaymentsAfterDate(state, '2026-10-28'), 0);
  assert.equal(countPaymentsAfterDate(state, ''), 0);
  assert.equal(countAllPayments(null), 0);
});
