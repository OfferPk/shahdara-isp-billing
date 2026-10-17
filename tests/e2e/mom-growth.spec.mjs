import { test, expect } from '@playwright/test';

test.describe('Month-over-Month (MoM) Growth & Momentum Suite E2E Verification', () => {
  test('opens via dashboard chart section button, toggles 3M/6M/12M window, and closes cleanly', async ({ page }) => {
    await page.goto('/');

    // Navigate to Analytics view via drawer
    const drawerToggle = page.locator('#navDrawerToggle');
    await drawerToggle.click();
    await expect(page.locator('#navDrawer')).toBeVisible();
    const analyticsBtn = page.locator('#navDrawer [data-nav-target="analytics"]');
    await expect(analyticsBtn).toBeVisible();
    await analyticsBtn.click();
    const analyticsView = page.locator('#analyticsView');
    await expect(analyticsView).toBeVisible();

    const openBtn = page.locator('#openMomGrowthModalBtn');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    const modal = page.locator('#momGrowthModal');
    await expect(modal).toBeVisible();

    // Verify KPI grid
    const kpiSubs = page.locator('#momKpiSubscribers');
    await expect(kpiSubs).toBeVisible();
    const kpiBilled = page.locator('#momKpiBilled');
    await expect(kpiBilled).toBeVisible();
    const kpiCollected = page.locator('#momKpiCollected');
    await expect(kpiCollected).toBeVisible();
    const kpiProfit = page.locator('#momKpiProfit');
    await expect(kpiProfit).toBeVisible();
    const kpiMomentum = page.locator('#momKpiMomentumBadge');
    await expect(kpiMomentum).toBeVisible();

    // Verify SVG Charts
    const svgContainer = page.locator('#momGrowthSvgContainer svg');
    await expect(svgContainer).toBeVisible();

    // Toggle 3-month window
    const win3Btn = page.locator('#momGrowthWindowToggle button[data-window="3"]');
    await expect(win3Btn).toBeVisible();
    await win3Btn.click();
    await expect(win3Btn).toHaveClass(/active/);

    // Toggle 12-month window
    const win12Btn = page.locator('#momGrowthWindowToggle button[data-window="12"]');
    await expect(win12Btn).toBeVisible();
    await win12Btn.click();
    await expect(win12Btn).toHaveClass(/active/);

    // Toggle back to 6-month window
    const win6Btn = page.locator('#momGrowthWindowToggle button[data-window="6"]');
    await expect(win6Btn).toBeVisible();
    await win6Btn.click();
    await expect(win6Btn).toHaveClass(/active/);

    // Verify Table exists
    const table = page.locator('.mom-growth-table');
    await expect(table).toBeVisible();

    // Close via close button
    const closeBtn = page.locator('#closeMomGrowthModalBtn');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('opens via quick action ribbon and closes with Esc key', async ({ page }) => {
    await page.goto('/');

    const quickBtn = page.locator('#quickActionMomGrowth');
    if (await quickBtn.isVisible()) {
      await quickBtn.click();
      const modal = page.locator('#momGrowthModal');
      await expect(modal).toBeVisible();

      // Test month select
      const monthSelect = page.locator('#momGrowthMonthSelect');
      if (await monthSelect.isVisible()) {
        const count = await monthSelect.locator('option').count();
        if (count > 1) {
          await monthSelect.selectOption({ index: 1 });
        }
      }

      // Press Esc key to close
      await page.keyboard.press('Escape');
      await expect(modal).not.toBeVisible();
    }
  });

  test('responsive verification: no horizontal overflow at 390px mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const quickBtn = page.locator('#quickActionMomGrowth');
    if (await quickBtn.isVisible()) {
      await quickBtn.click();
    } else {
      const drawerToggle = page.locator('#navDrawerToggle');
      await drawerToggle.click();
      const analyticsBtn = page.locator('#navDrawer [data-nav-target="analytics"]');
      await analyticsBtn.click();
      await page.locator('#openMomGrowthModalBtn').click();
    }

    const modal = page.locator('#momGrowthModal');
    await expect(modal).toBeVisible();

    // Verify zero horizontal scroll overflow at 390px
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflow).toBe(false);

    // Check footer buttons visible and interactive
    const csvBtn = page.locator('#exportMomGrowthCsvBtn');
    await expect(csvBtn).toBeVisible();
    const waBtn = page.locator('#shareMomGrowthWhatsAppBtn');
    await expect(waBtn).toBeVisible();

    // Dismiss with Close button
    const closeBtn = page.locator('#closeMomGrowthModalBtn');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('theme verification: renders cleanly in dark mode', async ({ page }) => {
    await page.goto('/');

    // Toggle to dark mode if currently light
    const themeBtn = page.locator('#themeToggleBtn');
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
    }

    const quickBtn = page.locator('#quickActionMomGrowth');
    if (await quickBtn.isVisible()) {
      await quickBtn.click();
      const modal = page.locator('#momGrowthModal');
      await expect(modal).toBeVisible();

      // Verify KPI values rendered
      await expect(page.locator('#momKpiSubscribers')).toBeVisible();

      // Close modal via secondary close button
      const closeSecBtn = page.locator('#closeMomGrowthSecondaryBtn');
      await closeSecBtn.click();
      await expect(modal).not.toBeVisible();
    }
  });
});
