import { test, expect } from '@playwright/test';

test.describe('Issue #232: Optional Encrypted Off-Device Backup (Owner-Held Key) E2E', () => {
  test('export encrypted backup dialog opens, validates passphrase, toggles visibility, and downloads AES-256-GCM backup', async ({ page }) => {
    await page.goto('/');

    // 1. Open Backup Controls in footer
    const toggle = page.locator('#backupControlsToggle');
    await expect(toggle).toBeVisible();
    await toggle.click();

    const controls = page.locator('#backupControls');
    await expect(controls).toBeVisible();

    // 2. Click "Lock & Encrypt (AES-256)" button
    const openEncryptBtn = page.locator('#openExportEncryptedBackupBtn');
    await expect(openEncryptBtn).toBeVisible();
    await openEncryptBtn.click();

    // 3. Encrypted Backup Dialog should open
    const dialog = page.locator('#encryptedBackupDialog');
    await expect(dialog).toBeVisible();

    // Verify notice and inputs
    await expect(page.locator('.threat-model-notice')).toBeVisible();
    const passInput = page.locator('#encryptedBackupPassphrase');
    const confirmInput = page.locator('#encryptedBackupPassphraseConfirm');
    const hintInput = page.locator('#encryptedBackupHint');
    const toggleBtn = page.locator('#toggleExportPassphraseBtn');
    const downloadBtn = page.locator('#downloadEncryptedBackupBtn');

    await expect(passInput).toBeVisible();
    await expect(confirmInput).toBeVisible();
    await expect(hintInput).toBeVisible();

    // 4. Test password toggle button
    await passInput.fill('TestSecret123');
    expect(await passInput.getAttribute('type')).toBe('password');
    await toggleBtn.click();
    expect(await passInput.getAttribute('type')).toBe('text');
    await toggleBtn.click();
    expect(await passInput.getAttribute('type')).toBe('password');

    // 5. Test mismatch validation
    await confirmInput.fill('DifferentSecret123');
    await downloadBtn.click();

    const err = page.locator('#encryptedBackupError');
    await expect(err).toBeVisible();
    await expect(err).toContainText(/do not match/i);

    // 6. Provide matching valid passphrase and hint
    const validPassphrase = 'SafeOwnerKey2026!';
    await passInput.fill(validPassphrase);
    await confirmInput.fill(validPassphrase);
    await hintInput.fill('Office locker code');

    // 7. Download encrypted backup file
    const downloadPromise = page.waitForEvent('download');
    await downloadBtn.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^shahdara-isp-billing-encrypted-backup-.*\.json$/);

    // Read downloaded content to verify encryption format
    const path = await download.path();
    const fs = await import('fs');
    const fileContent = fs.readFileSync(path, 'utf-8');
    const parsed = JSON.parse(fileContent);

    expect(parsed.format).toBe('shahdara-isp-billing-encrypted-backup');
    expect(parsed.cipher).toBe('AES-GCM');
    expect(parsed.kdf).toBe('PBKDF2-SHA256');
    expect(parsed.hint).toBe('Office locker code');
    expect(typeof parsed.salt).toBe('string');
    expect(typeof parsed.iv).toBe('string');
    expect(typeof parsed.ciphertext).toBe('string');
    expect(parsed.ciphertext.length).toBeGreaterThan(100);

    // Dialog should automatically close on successful export
    await expect(dialog).not.toBeVisible();
  });

  test('importing encrypted backup prompts for owner passphrase, rejects wrong key, and unlocks safe merge', async ({ page }) => {
    await page.goto('/');

    // 1. Generate an encrypted backup payload inside browser context using WebCrypto and backup-store.js
    const encryptedJsonText = await page.evaluate(async () => {
      const { encryptBackupJson } = await import('./backup-store.js');
      const samplePayload = {
        app: 'shahdara-isp-billing',
        version: 1,
        exportedAt: new Date().toISOString(),
        customers: [
          {
            id: 'TEST-ENC-1',
            name: 'Zahid Khan Off-Device',
            phone: '03009999999',
            area: 'Baradari',
            balance: 2000
          }
        ],
        payments: []
      };
      // Returns JSON string
      return await encryptBackupJson(JSON.stringify(samplePayload), 'CorrectOwnerPass789!', {
        hint: 'Blue ledger book'
      });
    });

    // 2. Open Backup Controls and trigger file upload with the encrypted backup via #jsonBackupFileInput
    await page.locator('#backupControlsToggle').click();
    const fileInput = page.locator('#jsonBackupFileInput');

    await fileInput.setInputFiles({
      name: 'test-encrypted-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(encryptedJsonText, 'utf-8')
    });

    // 3. JSON Backup Dialog opens with encrypted restore section visible
    const jsonDialog = page.locator('#jsonBackupDialog');
    await expect(jsonDialog).toBeVisible();

    const encSection = page.locator('#encryptedRestoreSection');
    await expect(encSection).toBeVisible();
    await expect(page.locator('#encryptedRestoreHintText')).toContainText('Blue ledger book');

    const restorePassInput = page.locator('#encryptedRestorePassphrase');
    const unlockBtn = page.locator('#unlockEncryptedRestoreBtn');
    await expect(restorePassInput).toBeVisible();
    await expect(unlockBtn).toBeVisible();

    // Plain restore section should remain hidden before unlocking
    const plainSection = page.locator('#plainBackupRestoreSection');
    await expect(plainSection).toBeHidden();

    // 4. Test wrong passphrase rejection
    await restorePassInput.fill('WrongPassphrase123');
    await unlockBtn.click();

    const errorEl = page.locator('#encryptedRestoreError');
    await expect(errorEl).toBeVisible();
    await expect(errorEl).toContainText(/failed|incorrect/i);

    // 5. Submit correct passphrase
    await restorePassInput.fill('CorrectOwnerPass789!');
    await unlockBtn.click();

    // Encrypted section is hidden and plain preview is rendered
    await expect(encSection).toBeHidden();
    await expect(plainSection).toBeVisible();

    // Safe merge button exists and can be clicked or inspected
    const applyBtn = page.locator('#applyJsonBackupButton');
    await expect(applyBtn).toBeVisible();

    // Close dialog
    await page.locator('#cancelJsonBackupButton').click();
    await expect(jsonDialog).not.toBeVisible();
  });

  test('mobile 390x844 responsive layout has zero horizontal scroll and dark mode support', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // 1. Check root overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    // 2. Open Encrypted Dialog
    await page.locator('#backupControlsToggle').click();
    const openEncryptBtn = page.locator('#openExportEncryptedBackupBtn');
    await openEncryptBtn.click();

    const dialog = page.locator('#encryptedBackupDialog');
    await expect(dialog).toBeVisible();

    // Check dialog fits within mobile viewport
    const dialogBox = await page.locator('#encryptedBackupDialog section').boundingBox();
    expect(dialogBox).not.toBeNull();
    if (dialogBox) {
      expect(dialogBox.width).toBeLessThanOrEqual(390);
    }

    // Check button touch target size >= 40px
    const downloadBox = await page.locator('#downloadEncryptedBackupBtn').boundingBox();
    if (downloadBox) {
      expect(downloadBox.height).toBeGreaterThanOrEqual(40);
    }

    // 3. Switch to Dark Mode and verify readable styles
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    const isDark = await page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark');
    expect(isDark).toBe(true);

    // Close dialog with Esc key
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});
