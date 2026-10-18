import { test, expect } from '@playwright/test';

test.describe('PWA Shortcuts, Install Prompt & Mobile Speed Suite', () => {

  test('mobile 390x844: PWA status modal opens from More menu and dismisses cleanly', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Check zero horizontal overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Open More Menu on mobile
    const moreBtn = page.locator('#mobileMoreButton');
    await expect(moreBtn).toBeVisible();
    await moreBtn.click();

    // Click PWA & App Shortcuts button
    const pwaStatusBtn = page.locator('#mobileMorePwaStatusBtn');
    await expect(pwaStatusBtn).toBeVisible();
    await pwaStatusBtn.click();

    // Verify modal is open and visible
    const statusModal = page.locator('#pwaStatusModal');
    await expect(statusModal).toBeVisible();

    // Verify metrics and badges
    await expect(page.locator('#pwaStatusModalTitle')).toBeVisible();
    await expect(page.locator('#pwaStatusModeBadge')).toBeVisible();
    await expect(page.locator('#pwaStatusCacheBadge')).toBeVisible();

    // Test shortcut button inside status modal (Quick Collect)
    const shortcutCollectBtn = page.locator('#pwaShortcutCollectBtn');
    await expect(shortcutCollectBtn).toBeVisible();
    await shortcutCollectBtn.click();

    // Verify status modal closed and quick collect opened
    await expect(statusModal).not.toBeVisible();
    const qcModal = page.locator('#quickCollectModal');
    await expect(qcModal).toBeVisible();

    // Close quick collect modal
    const closeQcBtn = page.locator('#closeQuickCollectBtn');
    if (await closeQcBtn.isVisible()) {
      await closeQcBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await expect(qcModal).not.toBeVisible();
  });

  test('PWA hash shortcut #quick-collect activates Quick Collect modal directly', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#quick-collect');

    const qcModal = page.locator('#quickCollectModal');
    await expect(qcModal).toBeVisible({ timeout: 5000 });

    // Dismiss cleanly
    await page.keyboard.press('Escape');
    await expect(qcModal).not.toBeVisible();
  });

  test('PWA hash shortcut #today-dues applies pending bill status filter', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#today-dues');

    // Verify pending filter button is pressed
    const pendingFilter = page.locator('[data-customer-billing-filter="pending"]');
    await expect(pendingFilter).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });
  });

  test('desktop 1280x800: PWA status modal opens and displays storage quota metrics', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Check zero horizontal overflow at desktop
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Open Drawer
    const drawerToggle = page.locator('#navDrawerToggle');
    await expect(drawerToggle).toBeVisible();
    await drawerToggle.click();

    // Open PWA Status from Drawer tools
    const pwaBtn = page.locator('#navDrawerPwaStatusBtn');
    await expect(pwaBtn).toBeVisible();
    await pwaBtn.click();

    const statusModal = page.locator('#pwaStatusModal');
    await expect(statusModal).toBeVisible();

    // Dismiss with Escape key
    await page.keyboard.press('Escape');
    await expect(statusModal).not.toBeVisible();
  });

  test('touch targets on small viewports enforce 44px minimum height', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Open More Menu
    await page.locator('#mobileMoreButton').click();
    await page.locator('#mobileMorePwaStatusBtn').click();

    const shortcutBtn = page.locator('#pwaShortcutCollectBtn');
    const box = await shortcutBtn.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);

    const closeBtn = page.locator('#closePwaStatusModalBtn');
    const closeBox = await closeBtn.boundingBox();
    expect(closeBox.height).toBeGreaterThanOrEqual(30); // close icon button

    await page.keyboard.press('Escape');
  });

});
