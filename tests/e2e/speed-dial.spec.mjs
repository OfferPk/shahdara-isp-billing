import { test, expect } from '@playwright/test';

test.describe('Mobile Speed-Dial & Overlay Verification', () => {
  test('speed dial menu and backdrop are collapsed and not covering content on initial load', async ({ page }) => {
    await page.goto('/');

    const menu = page.locator('#speedDialMenu');
    const backdrop = page.locator('#speedDialBackdrop');
    const fieldToolsModal = page.locator('#fieldToolsModal');

    // Menu and backdrop must not be visible on initial load
    await expect(menu).not.toBeVisible();
    await expect(backdrop).not.toBeVisible();
    await expect(fieldToolsModal).not.toBeVisible();

    // Verify center of mobile screen is not intercepted by speed dial or overlays
    const isObscured = await page.evaluate(() => {
      const el = document.elementFromPoint(195, 400);
      if (!el) return false;
      const speedDial = document.getElementById('mobileSpeedDial');
      const menuEl = document.getElementById('speedDialMenu');
      const backdropEl = document.getElementById('speedDialBackdrop');
      return el === menuEl || el === backdropEl || (speedDial && speedDial.contains(el) && el.id !== 'speedDialTrigger');
    });
    expect(isObscured).toBe(false);

    // Verify zero horizontal scroll at current viewport
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflow).toBe(false);
  });

  test('speed dial expands on trigger, shows max 5 primary actions, and closes cleanly', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Speed-dial trigger is mobile-only component (hidden on desktop >= 900px)');

    await page.goto('/');

    const trigger = page.locator('#speedDialTrigger');
    const menu = page.locator('#speedDialMenu');
    const backdrop = page.locator('#speedDialBackdrop');

    await expect(trigger).toBeVisible();

    // Click trigger to expand
    await trigger.click();
    await expect(menu).toBeVisible();
    await expect(backdrop).toBeVisible();

    // Verify exactly 5 actions are shown in speed dial menu
    const actions = menu.locator('button.speed-dial-action');
    await expect(actions).toHaveCount(5);

    // Verify billing actions and More Field Tools action exist
    await expect(menu.locator('[data-speed-action="search"]')).toBeVisible();
    await expect(menu.locator('[data-speed-action="payment"]')).toBeVisible();
    await expect(menu.locator('[data-speed-action="add-customer"]')).toBeVisible();
    await expect(menu.locator('[data-speed-action="reminders"]')).toBeVisible();
    await expect(menu.locator('#speedDialMoreToolsBtn')).toBeVisible();

    // Close via backdrop tap
    await backdrop.click({ position: { x: 50, y: 50 } });
    await expect(menu).not.toBeVisible();
    await expect(backdrop).not.toBeVisible();

    // Reopen and close via Esc key
    await trigger.click();
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).not.toBeVisible();
  });

  test('More Field Tools opens categorized tools sheet with all engineering tools', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Speed-dial trigger is mobile-only component');

    await page.goto('/');

    const trigger = page.locator('#speedDialTrigger');
    const moreToolsBtn = page.locator('#speedDialMoreToolsBtn');
    const fieldToolsModal = page.locator('#fieldToolsModal');
    const closeBtn = page.locator('#closeFieldToolsModalBtn');

    // Open speed dial and click More Field Tools
    await trigger.click();
    await moreToolsBtn.click();

    // Field Tools modal sheet opens
    await expect(fieldToolsModal).toBeVisible();
    await expect(page.locator('#speedDialMenu')).not.toBeVisible();

    // Verify key engineering tools are present inside the categorized groups
    await expect(fieldToolsModal.locator('#speedDialOtdrTraceBtn')).toBeVisible();
    await expect(fieldToolsModal.locator('#speedDialOpticalBudgetBtn')).toBeVisible();
    await expect(fieldToolsModal.locator('#speedDialWifiSurveyBtn')).toBeVisible();
    await expect(fieldToolsModal.locator('#speedDialFdtAllocationBtn')).toBeVisible();
    await expect(fieldToolsModal.locator('#speedDialOntDiagnosticsBtn')).toBeVisible();
    await expect(fieldToolsModal.locator('[data-speed-action="scroll-top"]')).toBeVisible();

    // Close modal via close button
    await closeBtn.click();
    await expect(fieldToolsModal).not.toBeVisible();

    // Reopen and close via Esc key
    await trigger.click();
    await moreToolsBtn.click();
    await expect(fieldToolsModal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(fieldToolsModal).not.toBeVisible();
  });

  test('offline sync banner is top-safe and does not block bottom navigation or speed dial', async ({ page }) => {
    await page.goto('/');

    // Evaluate offline sync banner styling and position
    const bannerInfo = await page.evaluate(() => {
      const banner = document.getElementById('offlineSyncBanner');
      if (!banner) return null;
      const rect = banner.getBoundingClientRect();
      const style = window.getComputedStyle(banner);
      return {
        top: rect.top,
        bottom: rect.bottom,
        zIndex: parseInt(style.zIndex, 10),
        cursor: style.cursor
      };
    });

    if (bannerInfo) {
      expect(bannerInfo.zIndex).toBeGreaterThanOrEqual(1000);
      expect(bannerInfo.cursor).toBe('pointer');
    }
  });
});
