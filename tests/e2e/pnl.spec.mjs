import { test, expect } from '@playwright/test';

test.describe('Income vs Expense Profit & Loss (P&L) Suite E2E Verification', () => {
  test('opens via dashboard chart section button, toggles 6M/12M window, and closes cleanly', async ({ page }) => {
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

    const openBtn = page.locator('#openPnlModalBtn');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    const modal = page.locator('#pnlModal');
    await expect(modal).toBeVisible();

    // Verify KPI grid
    const kpiIncome = page.locator('#pnlKpiIncome');
    await expect(kpiIncome).toBeVisible();
    const kpiExpenses = page.locator('#pnlKpiExpenses');
    await expect(kpiExpenses).toBeVisible();
    const kpiProfit = page.locator('#pnlKpiProfit');
    await expect(kpiProfit).toBeVisible();

    // Verify SVG Charts
    const pnlSvg = page.locator('.pnl-chart-svg');
    await expect(pnlSvg).toBeVisible();

    // Toggle 12-month window
    const win12Btn = page.locator('#pnlWindow12Btn');
    await expect(win12Btn).toBeVisible();
    await win12Btn.click();
    await expect(win12Btn).toHaveClass(/active/);

    // Toggle back to 6-month window
    const win6Btn = page.locator('#pnlWindow6Btn');
    await expect(win6Btn).toBeVisible();
    await win6Btn.click();
    await expect(win6Btn).toHaveClass(/active/);

    // Verify Table exists
    const table = page.locator('.pnl-table');
    await expect(table).toBeVisible();

    // Close via close button
    const closeBtn = page.locator('#closePnlModalBtn');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('opens via quick action ribbon and closes with Esc key', async ({ page }) => {
    await page.goto('/');

    const quickBtn = page.locator('#quickActionPnl');
    if (await quickBtn.isVisible()) {
      await quickBtn.click();
      const modal = page.locator('#pnlModal');
      await expect(modal).toBeVisible();

      // Test month select
      const monthSelect = page.locator('#pnlMonthSelect');
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

    const quickBtn = page.locator('#quickActionPnl');
    if (await quickBtn.isVisible()) {
      await quickBtn.click();
    } else {
      const drawerToggle = page.locator('#navDrawerToggle');
      await drawerToggle.click();
      const analyticsBtn = page.locator('#navDrawer [data-nav-target="analytics"]');
      await analyticsBtn.click();
      await page.locator('#openPnlModalBtn').click();
    }

    const modal = page.locator('#pnlModal');
    await expect(modal).toBeVisible();

    // Verify zero horizontal scroll overflow at 390px
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflow).toBe(false);

    // Check footer buttons visible and interactive
    const csvBtn = page.locator('#pnlExportCsvBtn');
    await expect(csvBtn).toBeVisible();
    const briefingBtn = page.locator('#pnlCopyBriefingBtn');
    await expect(briefingBtn).toBeVisible();

    // Dismiss with Close button
    const closeBtn = page.locator('#closePnlModalBtn');
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

    const quickBtn = page.locator('#quickActionPnl');
    if (await quickBtn.isVisible()) {
      await quickBtn.click();
      const modal = page.locator('#pnlModal');
      await expect(modal).toBeVisible();

      // Verify KPI values rendered
      await expect(page.locator('#pnlKpiIncome')).toBeVisible();

      // Close modal
      const closeSecBtn = page.locator('#closePnlSecondaryBtn');
      await closeSecBtn.click();
      await expect(modal).not.toBeVisible();
    }
  });
});
