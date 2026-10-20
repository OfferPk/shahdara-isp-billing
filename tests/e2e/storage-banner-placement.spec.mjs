import { test, expect } from '@playwright/test';

// Placement change (user request): the "Stored on this device only / No cloud sync…"
// banner used to render above every screen, directly under the header, so it was the
// first thing in the user's face on every app open. It now lives as the last section
// of Home (end of #billingDashboard) — off the first screen, still expanded, with its
// badges and Share Backup / Protect Storage actions intact. The duplicated
// "Data Safety & Backup" summary card was later removed from the Home grid, so
// this banner is now the only Data Safety place on Home. The storage-recovery
// <p role="alert"> deliberately did NOT move: it stays at the top level so a genuine
// storage failure is immediately visible on any screen.

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  return errors;
}

test.describe('Storage banner placement — bottom of Home', () => {
  test('banner is below the first viewport on Home load, nothing above the dashboard', async ({ page }) => {
    await page.goto('/');

    const banner = page.locator('#dataSafetyBanner');
    await expect(banner).toBeVisible();
    // Badges populate in place at the bottom of Home.
    await expect(page.locator('#dataSafetyBackupBadge')).toContainText(/Backup:/);
    await expect(page.locator('#dataSafetyBackupBadge')).not.toContainText('Checking');
    await expect(page.locator('#dataSafetyPersistenceBadge')).toContainText(/Storage:/);

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    const bannerBox = await banner.boundingBox();
    expect(bannerBox).not.toBeNull();
    // Not in the first viewport (project viewports: 390x844 mobile, 1280x800 desktop).
    expect(bannerBox.y).toBeGreaterThanOrEqual(viewport.height);

    // The duplicated summary-grid Data Safety card was removed (owner decision):
    // none of its ids exist, and the banner's actions are the only ones in the doc.
    await expect(page.locator('#dashboardDataSafetyCard')).toHaveCount(0);
    await expect(page.locator('#dashboardShareBackupBtn')).toHaveCount(0);
    await expect(page.locator('#dashboardProtectStorageBtn')).toHaveCount(0);
    await expect(page.locator('#dataSafetyShareBackupBtn')).toHaveCount(1);
    await expect(page.locator('#dataSafetyProtectStorageBtn')).toHaveCount(1);
    const bannerInDashboard = await page.evaluate(() => document.querySelector('#billingDashboard').contains(document.querySelector('#dataSafetyBanner')));
    expect(bannerInDashboard).toBe(true);

    // The recovery alert is a sibling at the top level, not inside the moved banner,
    // and starts hidden (no storage failure in a fresh profile).
    const alertPlacement = await page.evaluate(() => {
      const warn = document.querySelector('#storageRecoveryWarning');
      const aside = document.querySelector('#dataSafetyBanner');
      return {
        insideBanner: aside.contains(warn),
        hidden: warn.hidden,
        beforeMain: Boolean(warn.compareDocumentPosition(document.querySelector('#main')) & Node.DOCUMENT_POSITION_FOLLOWING)
      };
    });
    expect(alertPlacement.insideBanner).toBe(false);
    expect(alertPlacement.hidden).toBe(true);
    expect(alertPlacement.beforeMain).toBe(true);
  });

  test('scrolling to the bottom of Home: badges populated, Protect Storage and Share Backup work', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');

    const banner = page.locator('#dataSafetyBanner');
    await banner.scrollIntoViewIfNeeded();
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Stored on this device only.');
    await expect(page.locator('#dataSafetyBackupBadge')).not.toContainText('Checking');
    await expect(page.locator('#dataSafetyPersistenceBadge')).toContainText(/Storage:/);

    // Protect Storage action still wired from its new home.
    await page.locator('#dataSafetyProtectStorageBtn').click();
    const toast = page.locator('#toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/storage/i);

    // Share Backup still triggers the download fallback and refreshes the badge.
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#dataSafetyShareBackupBtn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^shahdara-isp-billing-backup-.*\.json$/);
    await expect(page.locator('#dataSafetyBackupBadge')).toContainText(/Today/i);

    expect(errors).toEqual([]);
  });

  test('banner does not appear at the top of the Customers screen', async ({ page }) => {
    await page.goto('/#/customers');

    // Customers screen is the active one.
    await expect(page.locator('#srPrimaryAction')).toBeVisible();

    const banner = page.locator('#dataSafetyBanner');
    await expect(banner).toBeHidden();

    // Nothing of the banner is painted anywhere in the Customers viewport.
    const painted = await page.evaluate(() => {
      const el = document.querySelector('#dataSafetyBanner');
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && st.visibility !== 'hidden' && st.display !== 'none';
    });
    expect(painted).toBe(false);
  });

  test('Urdu mode still translates the banner actions at the bottom of Home', async ({ page }) => {
    await page.goto('/');
    await page.locator('#languageToggleBtn').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.evaluate(() => window.languageController?.updateTranslations?.());

    const banner = page.locator('#dataSafetyBanner');
    await banner.scrollIntoViewIfNeeded();
    await expect(page.locator('#dataSafetyShareBackupBtn')).toContainText('بیک اپ شیئر کریں');
    await expect(page.locator('#dataSafetyProtectStorageBtn')).toContainText('اسٹوریج محفوظ کریں');
  });
});
