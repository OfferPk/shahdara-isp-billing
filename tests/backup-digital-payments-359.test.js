/**
 * backup-digital-payments-359.test.js — Issue #359 (Settings & Backup deep test).
 *
 * Finding: JSON backups (download / share / encrypted / local snapshots) used
 * to carry only the ledger state, so the owner's Digital Payments & QR
 * settings — Raast/Till/bank/QR printed on receipts and WhatsApp reminders —
 * were silently lost when a backup was restored on a new device.
 *
 * Fix: createJsonBackup attaches an optional `settings.digitalPayments`
 * section when the owner changed anything from the factory defaults, and
 * previewJsonBackupMerge adopts it under the same safe-merge rules as the
 * ledger (adopt when this device has nothing stored or only defaults; keep
 * existing + report a conflict when both sides hold different real settings).
 * Old backups (no section) and old app versions (ignore unknown fields) stay
 * fully compatible.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, createJsonBackup, previewJsonBackupMerge } from '../core.js';
import {
  getDefaultDigitalPaymentsSettings,
  sanitizeDigitalPaymentsSettings
} from '../digital-payments-settings.js';

const ref = new Date('2026-10-21T10:00:00+05:00');
const customSettings = {
  ownerRaastId: '03009998887',
  ownerTillId: 'TILL-4242',
  ownerAccountTitle: 'Probe Fiber Net',
  ownerPhone: '03009998887',
  ownerBankName: 'Meezan Bank',
  ownerAccountNumber: 'PK36MEZN000111222333',
  ownerQrDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
  instructions: 'Pay then WhatsApp the receipt'
};

test('backup omits the settings section for factory-default settings', () => {
  const text = createJsonBackup(createInitialState(), ref, {
    digitalPaymentsSettings: getDefaultDigitalPaymentsSettings()
  });
  const doc = JSON.parse(text);
  assert.equal(doc.settings, undefined);
});

test('backup omits the settings section when no settings are passed (legacy callers)', () => {
  const doc = JSON.parse(createJsonBackup(createInitialState(), ref));
  assert.equal(doc.settings, undefined);
});

test('backup carries a sanitized settings section for customized settings', () => {
  const text = createJsonBackup(createInitialState(), ref, {
    digitalPaymentsSettings: { ...customSettings, ownerRaastId: '  03009998887  ', ownerQrDataUrl: 'https://evil.example/x.png', junk: 'drop me' }
  });
  const doc = JSON.parse(text);
  assert.ok(doc.settings?.digitalPayments, 'settings section present');
  const carried = doc.settings.digitalPayments;
  assert.equal(carried.ownerRaastId, '03009998887', 'values are trimmed');
  assert.equal(carried.ownerTillId, 'TILL-4242');
  assert.equal(carried.ownerQrDataUrl, '', 'non data:image QR values are dropped');
  assert.equal(carried.junk, undefined, 'unknown fields are dropped');
});

test('restore adopts backup settings on a device with nothing stored', () => {
  const backup = createJsonBackup(createInitialState(), ref, { digitalPaymentsSettings: customSettings });
  const preview = previewJsonBackupMerge(createInitialState(), backup, {
    currentDigitalPaymentsSettings: getDefaultDigitalPaymentsSettings(),
    currentDigitalPaymentsStored: false
  });
  assert.equal(preview.counts.digitalPaymentsSettingsRestored, 1);
  assert.equal(preview.canApply, true, 'a settings-only restore is applicable');
  assert.deepEqual(preview.digitalPaymentsSettings, sanitizeDigitalPaymentsSettings(customSettings));
  assert.equal(preview.conflicts.length, 0);
});

test('restore adopts backup settings when this device still holds factory defaults', () => {
  const backup = createJsonBackup(createInitialState(), ref, { digitalPaymentsSettings: customSettings });
  const preview = previewJsonBackupMerge(createInitialState(), backup, {
    currentDigitalPaymentsSettings: getDefaultDigitalPaymentsSettings(),
    currentDigitalPaymentsStored: true
  });
  assert.equal(preview.counts.digitalPaymentsSettingsRestored, 1);
  assert.deepEqual(preview.digitalPaymentsSettings, sanitizeDigitalPaymentsSettings(customSettings));
});

test('restore keeps existing settings and reports a conflict when both sides differ', () => {
  const backup = createJsonBackup(createInitialState(), ref, { digitalPaymentsSettings: customSettings });
  const otherSettings = { ...customSettings, ownerRaastId: '03111111111', ownerTillId: 'TILL-OTHER' };
  const preview = previewJsonBackupMerge(createInitialState(), backup, {
    currentDigitalPaymentsSettings: otherSettings,
    currentDigitalPaymentsStored: true
  });
  assert.equal(preview.digitalPaymentsSettings, null);
  assert.equal(preview.counts.digitalPaymentsSettingsRestored, 0);
  assert.ok(
    preview.conflicts.some(c => /Digital payment settings differ/.test(c.field)),
    'a settings conflict is reported'
  );
});

test('restore is a no-op when settings are identical on both sides', () => {
  const backup = createJsonBackup(createInitialState(), ref, { digitalPaymentsSettings: customSettings });
  const preview = previewJsonBackupMerge(createInitialState(), backup, {
    currentDigitalPaymentsSettings: customSettings,
    currentDigitalPaymentsStored: true
  });
  assert.equal(preview.digitalPaymentsSettings, null);
  assert.equal(preview.counts.digitalPaymentsSettingsRestored, 0);
  assert.equal(preview.conflicts.length, 0);
  assert.equal(preview.canApply, false, 'identical ledger + identical settings = nothing to apply');
});

test('old backups without a settings section restore exactly as before', () => {
  const legacy = JSON.stringify({
    format: 'shahdara-isp-billing-backup',
    formatVersion: 1,
    exportedAt: '2026-10-01T10:00',
    state: createInitialState()
  });
  const preview = previewJsonBackupMerge(createInitialState(), legacy, {
    currentDigitalPaymentsSettings: getDefaultDigitalPaymentsSettings(),
    currentDigitalPaymentsStored: false
  });
  assert.equal(preview.digitalPaymentsSettings, null);
  assert.equal(preview.counts.digitalPaymentsSettingsRestored, 0);
});

test('malformed settings sections are ignored, never fatal', () => {
  for (const bad of [42, 'nope', [1, 2, 3], null]) {
    const doc = JSON.parse(createJsonBackup(createInitialState(), ref));
    doc.settings = { digitalPayments: bad };
    const preview = previewJsonBackupMerge(createInitialState(), JSON.stringify(doc), {
      currentDigitalPaymentsSettings: getDefaultDigitalPaymentsSettings(),
      currentDigitalPaymentsStored: false
    });
    assert.equal(preview.digitalPaymentsSettings, null, `section ${JSON.stringify(bad)} ignored`);
    assert.equal(preview.counts.digitalPaymentsSettingsRestored, 0);
  }
});

test('sanitize bounds every field exactly like dialog save does', () => {
  const cleaned = sanitizeDigitalPaymentsSettings({
    ownerRaastId: 'x'.repeat(80),
    ownerAccountTitle: 'y'.repeat(200),
    ownerQrDataUrl: 'data:image/png;base64,' + 'A'.repeat(400000)
  });
  assert.equal(cleaned.ownerRaastId.length, 40);
  assert.equal(cleaned.ownerAccountTitle.length, 100);
  assert.equal(cleaned.ownerQrDataUrl.length, 350000);
});
