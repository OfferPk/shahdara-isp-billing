/**
 * settings-backup-deep-359.spec.mjs
 * Issue #359: deep functional test of the Settings and Backup screens.
 *
 * Exercises (mobile + desktop projects):
 * - Backup & Restore screen: frequency persistence, Backup Now, saved-backup
 *   restore preview + cancel, JSON download contents, cross-device restore
 *   round trip (no loss, no duplication), idempotent re-import, corrupted
 *   file rejection without data damage, encrypted backup validation/export/
 *   decrypt-preview round trip, dialog close paths (x / Cancel / Esc).
 * - Digital Payments & QR Settings: save + persist + reopen, QR upload and
 *   removal, settings actually APPEAR in Quick Collect for a digital method,
 *   and Cancel closes the dialog without saving (regression: the Cancel
 *   button used to have no handler at all and left the dialog open).
 * - Settings survive backup/restore (regression: backups used to carry only
 *   the ledger state, silently dropping Raast/Till/bank/QR on device change).
 * - Theme + language persistence, incl. a dark-mode pass over both screens.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const DP_KEY = 'shahdara_digital_payments_settings_v1';

function trackErrors(page) {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  return errors;
}

async function fresh(page) {
  await page.goto('/#/home');
  await page.waitForSelector('#quickAddPaymentButton', { state: 'attached' });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#quickAddPaymentButton', { state: 'attached' });
}

async function stateStats(page) {
  return page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('shahdara-isp-billing-v1'));
    let payments = 0, bills = 0;
    for (const c of s.customers || []) for (const b of c.bills || []) { bills++; payments += (b.payments || []).length; }
    return { customers: (s.customers || []).length, bills, payments };
  });
}

async function seedFees(page) {
  await page.evaluate(() => window.collectSetup?.open());
  await page.locator('#collectSetupSelectAll').check();
  await page.locator('#collectSetupApplyBtn').click();
  await page.waitForSelector('#collectSetupModal', { state: 'hidden', timeout: 20000 });
}

async function openBackupScreen(page) {
  await page.goto('/#/backup');
  await expect(page.locator('#backupControls')).toBeVisible({ timeout: 15000 });
}

async function downloadBackup(page) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bk359-'));
  const file = path.join(dir, 'backup.json');
  const dlPromise = page.waitForEvent('download', { timeout: 20000 });
  await page.locator('#downloadJsonBackupButton').click();
  const dl = await dlPromise;
  await dl.saveAs(file);
  return file;
}

async function fillDigitalSettings(page, { raast = '03009998887' } = {}) {
  await page.evaluate(() => window.digitalPaymentsSettingsController?.open());
  const dlg = page.locator('#digitalPaymentsSettingsModal');
  await expect(dlg).toBeVisible({ timeout: 15000 });
  await page.locator('#settingOwnerAccountTitle').fill('Deep Test Fiber');
  await page.locator('#settingOwnerRaastId').fill(raast);
  await page.locator('#settingOwnerTillId').fill('TILL-4242');
  await page.locator('#settingOwnerBankName').fill('Meezan Bank');
  await page.locator('#settingOwnerAccountNumber').fill('PK36MEZN000111222333');
  return dlg;
}

test.describe('Issue 359: Settings & Backup deep test', () => {
  test.setTimeout(300000);

  test.beforeEach(async ({ page }) => {
    await fresh(page);
  });

  test('backup screen: frequency persists, Backup Now saves a restorable snapshot', async ({ page }) => {
    const errors = trackErrors(page);
    await openBackupScreen(page);

    const freq = page.locator('#backupFrequencySelect');
    await expect(freq).toHaveValue('weekly');
    await expect(page.locator('#backupStatus')).not.toContainText('Checking');

    await freq.selectOption('daily');
    await expect(page.locator('#toast')).toContainText(/daily/i);
    await page.reload();
    await expect(page.locator('#backupControls')).toBeVisible();
    await expect(page.locator('#backupFrequencySelect')).toHaveValue('daily');

    const optionsBefore = await page.locator('#savedLocalBackupSelect option').count();
    await page.locator('#backupNowButton').click();
    await expect(page.locator('#toast')).toContainText(/Backup saved/i);
    await expect(page.locator('#savedLocalBackupSelect option')).toHaveCount(optionsBefore + 1);
    await expect(page.locator('#backupLastSuccess')).not.toContainText('Never');
    await expect(page.locator('#backupLastSize')).not.toContainText('Not available');

    // Local snapshot restore: preview opens, Cancel changes nothing.
    const before = await stateStats(page);
    const select = page.locator('#savedLocalBackupSelect');
    const id = await select.evaluate(el => [...el.options].find(o => o.value)?.value || '');
    expect(id).toBeTruthy();
    await select.selectOption(id);
    await expect(page.locator('#restoreLocalBackupButton')).toBeEnabled();
    await page.locator('#restoreLocalBackupButton').click();
    const dlg = page.locator('#jsonBackupDialog');
    await expect(dlg).toBeVisible();
    await expect(page.locator('#jsonBackupPreviewSummary')).toContainText('Backup created:');
    await page.locator('#cancelJsonBackupButton').click();
    await expect(dlg).toBeHidden();
    expect(await stateStats(page)).toEqual(before);
    console.log('console/page errors during backup-screen test:', JSON.stringify(errors));
  });

  test('json backup round trip: export, wipe, restore — nothing lost or duplicated', async ({ page }) => {
    await seedFees(page);
    // Record one payment so the backup carries a receipt.
    await page.goto('/#/home');
    await page.locator('#quickAddPaymentButton').click();
    const modal = page.locator('#quickCollectModal');
    await expect(modal).toBeVisible();
    await modal.locator('.qc-customer-card', { hasText: 'Test Customer 01' }).first().click();
    await page.locator('#quickCollectConfirmBtn').click();
    await expect(page.locator('#quickCollectStepSuccess')).toBeVisible();
    await page.locator('#quickCollectDoneCloseBtn').click();
    expect((await stateStats(page)).payments).toBe(1);

    await openBackupScreen(page);
    const file = await downloadBackup(page);
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(doc.format).toBe('shahdara-isp-billing-backup');
    expect(doc.state.customers).toHaveLength(74);
    let backedUpPayments = 0;
    for (const c of doc.state.customers) for (const b of c.bills || []) backedUpPayments += (b.payments || []).length;
    expect(backedUpPayments).toBe(1);

    // New device: wipe to defaults (no bills/payments), then restore the file.
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('#quickAddPaymentButton', { state: 'attached' });
    expect((await stateStats(page)).payments).toBe(0);

    await openBackupScreen(page);
    await page.locator('#restoreJsonBackupButton').click();
    await page.setInputFiles('#jsonBackupFileInput', file);
    const dlg = page.locator('#jsonBackupDialog');
    await expect(dlg).toBeVisible();
    await expect(page.locator('#jsonBackupPreviewSummary')).toContainText('1 new actual receipts');
    await expect(page.locator('#applyJsonBackupButton')).toBeEnabled();
    await page.locator('#applyJsonBackupButton').click();
    await expect(dlg).toBeHidden();
    const restored = await stateStats(page);
    expect(restored.customers).toBe(74);
    expect(restored.payments).toBe(1);

    // Re-importing the same file is a no-op merge (Apply disabled).
    await page.locator('#restoreJsonBackupButton').click();
    await page.setInputFiles('#jsonBackupFileInput', file);
    await expect(dlg).toBeVisible();
    await expect(page.locator('#applyJsonBackupButton')).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
    expect((await stateStats(page)).payments).toBe(1);
  });

  test('corrupted backup files are rejected and current data is untouched', async ({ page }) => {
    await seedFees(page);
    await openBackupScreen(page);
    const good = await downloadBackup(page);
    const validText = fs.readFileSync(good, 'utf8');
    const before = await stateStats(page);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bk359bad-'));
    const tampered = JSON.parse(validText);
    tampered.state.customers[1].customerNumber = tampered.state.customers[0].customerNumber;
    const cases = {
      truncated: validText.slice(0, 400),
      wrongFormat: JSON.stringify({ format: 'something-else', state: {} }),
      tampered: JSON.stringify(tampered),
      empty: ''
    };
    for (const [name, content] of Object.entries(cases)) {
      const file = path.join(dir, `${name}.json`);
      fs.writeFileSync(file, content);
      await page.locator('#restoreJsonBackupButton').click();
      await page.setInputFiles('#jsonBackupFileInput', file);
      await expect(page.locator('#toast')).toContainText(/No local data|Invalid JSON|Unrecognized|empty or not readable/i, { timeout: 15000 });
      await expect(page.locator('#jsonBackupDialog')).toBeHidden();
      expect(await stateStats(page), `case ${name}`).toEqual(before);
    }
  });

  test('encrypted backup: validation, export, wrong/correct passphrase restore preview', async ({ page }) => {
    await openBackupScreen(page);
    await page.locator('#openExportEncryptedBackupBtn').click();
    const dlg = page.locator('#encryptedBackupDialog');
    await expect(dlg).toBeVisible();

    await page.locator('#encryptedBackupPassphrase').fill('abc');
    await page.locator('#encryptedBackupPassphraseConfirm').fill('abc');
    await page.locator('#downloadEncryptedBackupBtn').click();
    await expect(page.locator('#encryptedBackupError')).toContainText(/at least 6/);
    await expect(dlg).toBeVisible();

    await page.locator('#encryptedBackupPassphrase').fill('deep-test-pass');
    await page.locator('#encryptedBackupPassphraseConfirm').fill('different-pass');
    await page.locator('#downloadEncryptedBackupBtn').click();
    await expect(page.locator('#encryptedBackupError')).toContainText(/do not match/);

    await page.locator('#encryptedBackupPassphraseConfirm').fill('deep-test-pass');
    await page.locator('#encryptedBackupHint').fill('deep test hint');
    const dlPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.locator('#downloadEncryptedBackupBtn').click();
    const dl = await dlPromise;
    expect(dl.suggestedFilename()).toMatch(/encrypted-backup/);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bk359enc-'));
    const file = path.join(dir, 'encrypted.json');
    await dl.saveAs(file);
    await expect(dlg).toBeHidden();

    await page.locator('#restoreJsonBackupButton').click();
    await page.setInputFiles('#jsonBackupFileInput', file);
    const restoreDlg = page.locator('#jsonBackupDialog');
    await expect(restoreDlg).toBeVisible();
    await expect(page.locator('#encryptedRestoreSection')).toBeVisible();
    await expect(page.locator('#encryptedRestoreHintText')).toContainText('deep test hint');

    await page.locator('#encryptedRestorePassphrase').fill('wrong-pass');
    await page.locator('#unlockEncryptedRestoreBtn').click();
    await expect(page.locator('#encryptedRestoreError')).not.toBeEmpty();
    await expect(page.locator('#encryptedRestoreSection')).toBeVisible();

    await page.locator('#encryptedRestorePassphrase').fill('deep-test-pass');
    await page.locator('#unlockEncryptedRestoreBtn').click();
    await expect(page.locator('#plainBackupRestoreSection')).toBeVisible({ timeout: 25000 });
    await page.locator('#cancelJsonBackupButton').click();
    await expect(restoreDlg).toBeHidden();
  });

  test('digital payments settings: save, persist, apply in Quick Collect; Cancel closes without saving', async ({ page }) => {
    const dlg = await fillDigitalSettings(page);
    await page.setInputFiles('#settingOwnerQrFile', { name: 'qr.png', mimeType: 'image/png', buffer: PNG_1PX });
    await expect(page.locator('#settingOwnerQrPreviewWrap')).toBeVisible();
    await page.locator('#saveDigitalPaymentsSettingsBtn').click();
    await expect(dlg).toBeHidden();
    const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), DP_KEY);
    expect(saved.ownerRaastId).toBe('03009998887');
    expect(saved.ownerTillId).toBe('TILL-4242');
    expect(saved.ownerQrDataUrl.startsWith('data:image/')).toBe(true);

    // Persist across reload and reopen prefilled.
    await page.reload();
    await page.waitForSelector('#quickAddPaymentButton', { state: 'attached' });
    await page.evaluate(() => window.digitalPaymentsSettingsController?.open());
    await expect(dlg).toBeVisible();
    await expect(page.locator('#settingOwnerRaastId')).toHaveValue('03009998887');
    await expect(page.locator('#settingOwnerQrPreviewWrap')).toBeVisible();

    // CANCEL regression (#359): the button used to be dead — dialog stayed open.
    await page.locator('#settingOwnerRaastId').fill('SHOULD-NOT-SAVE');
    await page.locator('#cancelDigitalPaymentsSettingsBtn').click();
    await expect(dlg).toBeHidden();
    const afterCancel = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), DP_KEY);
    expect(afterCancel.ownerRaastId).toBe('03009998887');

    // APPLIES: Quick Collect with a digital method shows the owner's details.
    await seedFees(page);
    await page.goto('/#/home');
    await page.locator('#quickAddPaymentButton').click();
    const modal = page.locator('#quickCollectModal');
    await expect(modal).toBeVisible();
    await modal.locator('.qc-customer-card', { hasText: 'Test Customer 01' }).first().click();
    await page.locator('.quick-method-chip[data-method="Easypaisa"]').click();
    const info = page.locator('.qc-owner-info-box');
    await expect(info).toBeVisible({ timeout: 15000 });
    await expect(info).toContainText('03009998887');
    await expect(info).toContainText('TILL-4242');
    await page.keyboard.press('Escape');
  });

  test('digital payments settings survive a backup restore on a new device (#359)', async ({ page }) => {
    await fillDigitalSettings(page);
    await page.locator('#saveDigitalPaymentsSettingsBtn').click();
    await expect(page.locator('#digitalPaymentsSettingsModal')).toBeHidden();

    await openBackupScreen(page);
    const file = await downloadBackup(page);
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(doc.settings?.digitalPayments?.ownerRaastId).toBe('03009998887');

    // New device: wipe everything, restore — settings must come back too.
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('#quickAddPaymentButton', { state: 'attached' });
    expect(await page.evaluate(k => localStorage.getItem(k), DP_KEY)).toBeNull();

    await openBackupScreen(page);
    await page.locator('#restoreJsonBackupButton').click();
    await page.setInputFiles('#jsonBackupFileInput', file);
    const dlg = page.locator('#jsonBackupDialog');
    await expect(dlg).toBeVisible();
    await expect(page.locator('#jsonBackupPreviewSummary')).toContainText('Digital payment settings');
    await page.locator('#applyJsonBackupButton').click();
    await expect(dlg).toBeHidden();
    const restored = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), DP_KEY);
    expect(restored.ownerRaastId).toBe('03009998887');
    expect(restored.ownerTillId).toBe('TILL-4242');
    expect(restored.ownerAccountNumber).toBe('PK36MEZN000111222333');
  });

  test('theme and language persist; backup + settings render in dark mode', async ({ page }) => {
    const html = page.locator('html');
    await page.locator('#themeToggle').click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await page.waitForSelector('#quickAddPaymentButton', { state: 'attached' });
    await expect(html).toHaveAttribute('data-theme', 'dark');

    await openBackupScreen(page);
    await expect(page.locator('#downloadJsonBackupButton')).toBeVisible();
    await expect(page.locator('#backupNowButton')).toBeVisible();
    await page.evaluate(() => window.digitalPaymentsSettingsController?.open());
    await expect(page.locator('#digitalPaymentsSettingsModal')).toBeVisible();
    await expect(page.locator('#saveDigitalPaymentsSettingsBtn')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#digitalPaymentsSettingsModal')).toBeHidden();

    await page.locator('#themeToggle').click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await page.locator('#languageToggleBtn').click();
    await expect(html).toHaveAttribute('lang', 'ur', { timeout: 15000 });
    await page.reload();
    await page.waitForSelector('#quickAddPaymentButton', { state: 'attached' });
    await expect(html).toHaveAttribute('lang', 'ur');
    await page.locator('#languageToggleBtn').click();
    await expect(html).toHaveAttribute('lang', 'en', { timeout: 15000 });
  });

  test('misc backup-screen actions: protect storage, storage audit, exports, CSV import dialog', async ({ page }) => {
    const errors = trackErrors(page);
    await openBackupScreen(page);
    await page.locator('#requestStoragePersistenceBtn').click();
    await expect(page.locator('#toast')).toContainText(/storage/i);
    await page.locator('#verifyStorageIntegrityBtn').click();
    await expect(page.locator('#toast')).toContainText(/Storage Health/, { timeout: 20000 });

    await page.goto('/#/home');
    const dlPromise = page.waitForEvent('download', { timeout: 20000 });
    await page.locator('#exportAllButton').click();
    const dl = await dlPromise;
    expect(dl.suggestedFilename()).toMatch(/payment-details\.txt$/);

    await openBackupScreen(page);
    const tplPromise = page.waitForEvent('download', { timeout: 20000 });
    await page.locator('#downloadCustomerCsvTemplateBtn').click();
    const tpl = await tplPromise;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bk359csv-'));
    const csvFile = path.join(dir, 'template.csv');
    await tpl.saveAs(csvFile);

    const customersBefore = (await stateStats(page)).customers;
    await page.locator('#importCustomerCsvBtn').click();
    await page.setInputFiles('#customerCsvFileInput', csvFile);
    const csvDlg = page.locator('#csvImportDialog');
    await expect(csvDlg).toBeVisible();
    await expect(page.locator('#csvImportPreviewSummary')).toContainText(/rows found/);
    await page.keyboard.press('Escape');
    await expect(csvDlg).toBeHidden();
    expect((await stateStats(page)).customers).toBe(customersBefore);

    await page.locator('#openDataIntegrityBtn').click();
    await expect(page.locator('dialog[open]').first()).toBeVisible({ timeout: 20000 });
    await page.keyboard.press('Escape');
    await page.locator('#openBillingCorrectnessBtn').click();
    await expect(page.locator('dialog[open]').first()).toBeVisible({ timeout: 20000 });
    await page.keyboard.press('Escape');
    console.log('console/page errors during misc test:', JSON.stringify(errors));
  });
});
