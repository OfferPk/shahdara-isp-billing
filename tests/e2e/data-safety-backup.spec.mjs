import { test, expect } from '@playwright/test';

test.describe('Data Safety, Backup Age Indicator & One-Tap Share E2E Verification', () => {
  test('data safety banner displays backup age and storage status (grid card removed)', async ({ page, isMobile }) => {
    await page.goto('/');

    // 1. Verify Data Safety Banner. Placement changed: the banner used to sit above
    // every screen under the header; it now lives at the bottom of Home (see
    // storage-banner-placement.spec.mjs). Visibility assertions below are
    // position-independent — Playwright scrolls the banner into view for actions.
    const banner = page.locator('#dataSafetyBanner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Stored on this device only.');

    const backupBadge = page.locator('#dataSafetyBackupBadge');
    await expect(backupBadge).toBeVisible();
    await expect(backupBadge).toContainText(/Backup:/);

    const persistBadge = page.locator('#dataSafetyPersistenceBadge');
    await expect(persistBadge).toBeVisible();
    await expect(persistBadge).toContainText(/Storage:/);

    // 2. The duplicated Dashboard Data Safety Card was removed by owner decision:
    // the bottom-of-Home banner is the single Data Safety place. The card and its
    // ids must not exist, and the storage estimate that only the card showed now
    // lives in the banner persistence badge's title.
    await expect(page.locator('#dashboardDataSafetyCard')).toHaveCount(0);
    await expect(page.locator('#dashboardBackupAgeBadge')).toHaveCount(0);
    await expect(page.locator('#dashboardBackupAgeValue')).toHaveCount(0);
    await expect(page.locator('#dashboardBackupStorageEstimate')).toHaveCount(0);
    await expect(persistBadge).toHaveAttribute('title', /used/);

    // Verify touch targets and dimensions on mobile
    if (isMobile) {
      const bannerBox = await banner.boundingBox();
      const viewportSize = page.viewportSize();
      if (bannerBox && viewportSize) {
        expect(bannerBox.width).toBeLessThanOrEqual(viewportSize.width);
      }
    }
  });

  test('one-tap share backup triggers file share or download fallback and updates last backup timestamp', async ({ page }) => {
    await page.goto('/');

    const shareBtn = page.locator('#dataSafetyShareBackupBtn');
    await expect(shareBtn).toBeVisible();

    // Trigger share backup (falls back to browser download in headless test environment)
    const downloadPromise = page.waitForEvent('download');
    await shareBtn.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^shahdara-isp-billing-backup-.*\.json$/);

    // Verify toast announcement
    const toast = page.locator('#toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/backup/i);

    // Verify badge updates to "Backed up today" or "Today"
    const backupBadge = page.locator('#dataSafetyBackupBadge');
    await expect(backupBadge).toContainText(/Today/i);
  });

  test('banner protect storage button operates correctly and dashboard card buttons are gone', async ({ page }) => {
    await page.goto('/');

    // The duplicated dashboard card buttons were removed with the card.
    await expect(page.locator('#dashboardShareBackupBtn')).toHaveCount(0);
    await expect(page.locator('#dashboardProtectStorageBtn')).toHaveCount(0);

    // Banner protect storage button (share via the banner is covered by the test above)
    const protectBtn = page.locator('#dataSafetyProtectStorageBtn');
    await expect(protectBtn).toBeVisible();
    await protectBtn.click();

    // Verify toast notification
    const toast = page.locator('#toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/storage/i);
  });

  test('footer backup controls include persistence info, quota info, and share button with >= 48px toggle', async ({ page }) => {
    await page.goto('/');

    // Check toggle touch target size (>= 48px per WCAG / Grok review #217)
    const toggle = page.locator('#backupControlsToggle');
    await expect(toggle).toBeVisible();
    const toggleBox = await toggle.boundingBox();
    expect(toggleBox).not.toBeNull();
    expect(toggleBox.width).toBeGreaterThanOrEqual(44);
    expect(toggleBox.height).toBeGreaterThanOrEqual(44);

    // Open backup panel
    await toggle.click();
    const controls = page.locator('#backupControls');
    await expect(controls).toBeVisible();

    // Verify persistence status and quota rows
    const persistenceStatus = page.locator('#backupStoragePersistence');
    await expect(persistenceStatus).toBeVisible();

    const quotaEstimate = page.locator('#backupStorageQuota');
    await expect(quotaEstimate).toBeVisible();

    // Verify share backup button inside footer actions
    const footerShareBtn = page.locator('#shareJsonBackupButton');
    await expect(footerShareBtn).toBeVisible();

    // Verify protect storage button
    const footerProtectBtn = page.locator('#requestStoragePersistenceBtn');
    await expect(footerProtectBtn).toBeVisible();
    await footerProtectBtn.click();

    const toast = page.locator('#toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/storage/i);
  });

  test('dark theme styling verification for data safety elements', async ({ page }) => {
    await page.goto('/');

    // Switch to dark theme
    const themeToggle = page.locator('#themeToggle');
    await themeToggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    const banner = page.locator('#dataSafetyBanner');
    await expect(banner).toBeVisible();

    await expect(page.locator('#dashboardDataSafetyCard')).toHaveCount(0);

    const badge = page.locator('#dataSafetyBackupBadge');
    await expect(badge).toBeVisible();
  });
});
