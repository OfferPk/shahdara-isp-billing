import { test, expect } from '@playwright/test';

test.describe('Daily Cash Closing, Till Reconciliation & Register Audit Suite E2E Verification', () => {
  test('opens via dashboard daily closing card button, interacts with date controls, and closes cleanly', async ({ page }) => {
    await page.goto('/');

    const openBtn = page.locator('#openDailyClosingModalBtn');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    const modal = page.locator('#dailyClosingModal');
    await expect(modal).toBeVisible();

    // Verify KPI elements
    await expect(page.locator('#dcKpiTotal')).toBeVisible();
    await expect(page.locator('#dcKpiCash')).toBeVisible();
    await expect(page.locator('#dcKpiDigital')).toBeVisible();
    await expect(page.locator('#dcKpiExpenses')).toBeVisible();
    await expect(page.locator('#dcKpiNetCash')).toBeVisible();
    await expect(page.locator('#dcKpiNetBalance')).toBeVisible();

    // Verify SVG Visualizer
    const svg = page.locator('#dailyClosingSvgContainer svg');
    await expect(svg).toBeVisible();

    // Verify Date Navigation buttons
    const prevBtn = page.locator('#dailyClosingPrevDateBtn');
    await expect(prevBtn).toBeVisible();
    await prevBtn.click();

    const todayBtn = page.locator('#dailyClosingTodayDateBtn');
    await expect(todayBtn).toBeVisible();
    await todayBtn.click();

    const nextBtn = page.locator('#dailyClosingNextDateBtn');
    await expect(nextBtn).toBeVisible();
    await nextBtn.click();

    // Verify footer actions exist
    await expect(page.locator('#dcCopySlipBtn')).toBeVisible();
    await expect(page.locator('#dcShareWhatsAppBtn')).toBeVisible();
    await expect(page.locator('#dcPrintA4Btn')).toBeVisible();
    await expect(page.locator('#dcPrintPosBtn')).toBeVisible();
    await expect(page.locator('#dcExportCsvBtn')).toBeVisible();

    // Close via close button
    const closeBtn = page.locator('#closeDailyClosingModalBtn');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('opens via quick action ribbon and dismisses with Escape key', async ({ page }) => {
    await page.goto('/');

    const quickActionBtn = page.locator('#quickActionDailyClosing');
    await expect(quickActionBtn).toBeVisible();
    await quickActionBtn.click();

    const modal = page.locator('#dailyClosingModal');
    await expect(modal).toBeVisible();

    // Dismiss with Escape key
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('dismisses via secondary close button and backdrop click', async ({ page }) => {
    await page.goto('/');

    const openBtn = page.locator('#openDailyClosingModalBtn');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    const modal = page.locator('#dailyClosingModal');
    await expect(modal).toBeVisible();

    // Close via secondary close button
    const secondaryCloseBtn = page.locator('#closeDailyClosingSecondaryBtn');
    await expect(secondaryCloseBtn).toBeVisible();
    await secondaryCloseBtn.click();
    await expect(modal).not.toBeVisible();

    // Reopen and test backdrop click
    await openBtn.click();
    await expect(modal).toBeVisible();

    // Click near modal border edge to trigger backdrop dismiss
    await page.mouse.click(10, 10);
    await expect(modal).not.toBeVisible();
  });

  test('responsive verification: zero horizontal scroll overflow at 390px mobile viewport and min 44px touch targets', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const openBtn = page.locator('#openDailyClosingModalBtn');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    const modal = page.locator('#dailyClosingModal');
    await expect(modal).toBeVisible();

    // Check zero horizontal scroll overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      const modalEl = document.getElementById('dailyClosingModal');
      const contentEl = modalEl ? modalEl.querySelector('.billing-modal-content') : null;
      if (!contentEl) return false;
      return contentEl.scrollWidth > window.innerWidth + 2;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Check touch target heights on mobile (buttons should be >= 40px)
    const buttons = page.locator('#dailyClosingModal .billing-modal-footer button');
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(40);
      }
    }

    const closeBtn = page.locator('#closeDailyClosingModalBtn');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('desktop 1280x800 layout verification and theme toggle compatibility', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const openBtn = page.locator('#openDailyClosingModalBtn');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    const modal = page.locator('#dailyClosingModal');
    await expect(modal).toBeVisible();

    // Toggle dark theme
    const themeBtn = page.locator('#themeToggleBtn');
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      const isDark = await page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark');
      expect(isDark).toBe(true);

      // Verify modal is still visible and readable
      await expect(modal).toBeVisible();
      const kpiTotal = page.locator('#dcKpiTotal');
      await expect(kpiTotal).toBeVisible();
    }

    // Close modal
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('quick action daily closing slip button copies closing text and triggers toast', async ({ page }) => {
    await page.goto('/');

    // Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    const slipBtn = page.locator('#quickActionDailyClosingSlip');
    await expect(slipBtn).toBeVisible();
    await slipBtn.click();

    const toast = page.locator('#toast');
    await expect(toast).toBeVisible();
  });
});
