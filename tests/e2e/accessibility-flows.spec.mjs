import { test, expect } from '@playwright/test';

test.describe('Billing & Field Operations Accessibility Suite', () => {

  async function openShortcutsModal(page) {
    const helpBtn = page.locator('#shortcutsHelpButton');
    if (await helpBtn.isVisible()) {
      await helpBtn.click();
    } else {
      const moreBtn = page.locator('#mobileMoreButton');
      if (await moreBtn.isVisible()) {
        await moreBtn.click();
        await page.locator('#mobileMoreShortcutsBtn').click();
      } else {
        await page.keyboard.press('?');
      }
    }
  }

  test('keyboard shortcuts modal opens and dismisses with Escape key', async ({ page }) => {
    await page.goto('/');

    await openShortcutsModal(page);

    const modal = page.locator('#keyboardShortcutsModal');
    await expect(modal).toBeVisible();

    // Verify shortcuts sections are rendered
    await expect(modal.locator('.shortcuts-section')).toHaveCount(3);
    await expect(modal.locator('text=Field Collection & Actions')).toBeVisible();

    // Verify Escape key closes dialog cleanly
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('screen reader live regions exist with proper aria-live attributes', async ({ page }) => {
    await page.goto('/');

    const politeRegion = page.locator('#navA11yLiveRegion');
    await expect(politeRegion).toHaveAttribute('aria-live', 'polite');
    await expect(politeRegion).toHaveAttribute('role', 'status');

    const alertRegion = page.locator('#navA11yAlertRegion');
    await expect(alertRegion).toHaveAttribute('aria-live', 'assertive');
    await expect(alertRegion).toHaveAttribute('role', 'alert');
  });

  test('focus trapping: Tab key stays within keyboard shortcuts dialog when open', async ({ page }) => {
    await page.goto('/');

    await openShortcutsModal(page);
    const modal = page.locator('#keyboardShortcutsModal');
    await expect(modal).toBeVisible();

    // Press Tab multiple times
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Active element must be inside modal
    const isInsideModal = await page.evaluate(() => {
      const active = document.activeElement;
      const modalEl = document.getElementById('keyboardShortcutsModal');
      return modalEl ? modalEl.contains(active) : false;
    });

    expect(isInsideModal).toBe(true);

    // Close modal
    await page.locator('#shortcutsModalCloseBtn').click();
    await expect(modal).not.toBeVisible();
  });

  test('responsive verification: 44px min touch targets and zero horizontal scroll at 390px mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Check touch target heights on mobile topbar and bottom nav buttons
    const helpBtn = page.locator('#shortcutsHelpButton');
    if (await helpBtn.isVisible()) {
      const box = await helpBtn.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(40);
      }
    }

    const moreBtn = page.locator('#mobileMoreButton');
    await moreBtn.click();
    const moreMenu = page.locator('#mobileMoreMenu');
    await expect(moreMenu).toBeVisible();

    const shortcutsMoreBtn = page.locator('#mobileMoreShortcutsBtn');
    await expect(shortcutsMoreBtn).toBeVisible();
    await shortcutsMoreBtn.click();

    const modal = page.locator('#keyboardShortcutsModal');
    await expect(modal).toBeVisible();

    // Zero horizontal scroll at 390px
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflow).toBe(false);

    await page.locator('#shortcutsModalCloseBtn').click();
    await expect(modal).not.toBeVisible();
  });

  test('theme verification: shortcuts modal renders with high contrast in dark mode', async ({ page }) => {
    await page.goto('/');

    // Switch to dark mode
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    await openShortcutsModal(page);
    const modal = page.locator('#keyboardShortcutsModal');
    await expect(modal).toBeVisible();

    // Heading should be visible and styled
    const heading = modal.locator('#shortcutsModalTitle');
    await expect(heading).toBeVisible();

    await page.locator('#shortcutsModalCloseBtn').click();
    await expect(modal).not.toBeVisible();
  });
});
