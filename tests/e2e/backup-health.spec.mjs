import { test, expect } from '@playwright/test';

// SISP-10: Backup Health Badge & Checksum Transfer (CI only — Playwright
// cannot run in the dev VM, same as all prior phases).
test.describe('SISP-10: Backup health badge & sync-code transfer', () => {
  test('top-bar badge is visible and tapping it downloads a JSON backup', async ({ page }) => {
    await page.goto('/');

    const badge = page.locator('#backupHealthBadge');
    await expect(badge).toBeVisible();
    // Fresh profile: never exported -> critical badge with a label.
    await expect(badge).toContainText(/Backup:/);

    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    await badge.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/shahdara-isp-billing-backup-.*\.json/);
  });

  test('backup panel offers copy/paste sync-code controls', async ({ page }) => {
    await page.goto('/');

    const toggle = page.locator('#backupControlsToggle');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator('#backupControls')).toBeVisible();

    await expect(page.locator('#copySyncCodeButton')).toBeVisible();
    await expect(page.locator('#pasteSyncCodeText')).toBeVisible();
    await expect(page.locator('#importSyncCodeButton')).toBeVisible();

    // Empty paste is rejected without touching data.
    await page.locator('#importSyncCodeButton').click();
    await expect(page.locator('#jsonBackupDialog')).toBeHidden();
  });

  test('no horizontal overflow at 390px with the badge in the top bar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('#backupHealthBadge')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
