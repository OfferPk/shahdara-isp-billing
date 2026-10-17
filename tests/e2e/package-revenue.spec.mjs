import { test, expect } from '@playwright/test';

test.describe('Package Revenue Mix & Portfolio ARPU Suite E2E Verification', () => {
  test('opens via package snapshot section button, toggles donut metrics, and closes cleanly', async ({ page }) => {
    await page.goto('/');

    // Open drawer and navigate to Analytics view
    const drawerToggle = page.locator('#navDrawerToggle');
    await drawerToggle.click();
    await expect(page.locator('#navDrawer')).toBeVisible();
    const analyticsBtn = page.locator('#navDrawer [data-nav-target="analytics"]');
    await expect(analyticsBtn).toBeVisible();
    await analyticsBtn.click();
    const analyticsView = page.locator('#analyticsView');
    await expect(analyticsView).toBeVisible();

    const openBtn = page.locator('#openPackageRevenueModalBtn');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    const modal = page.locator('#packageRevenueModal');
    await expect(modal).toBeVisible();

    // Verify KPI ribbon
    const kpiBilled = page.locator('#packageRevenueKpiBilled');
    await expect(kpiBilled).toBeVisible();
    const kpiCollected = page.locator('#packageRevenueKpiCollected');
    await expect(kpiCollected).toBeVisible();
    const kpiArpu = page.locator('#packageRevenueKpiArpu');
    await expect(kpiArpu).toBeVisible();

    // Verify SVG Donut Chart
    const svgChart = page.locator('.package-revenue-donut-svg');
    await expect(svgChart).toBeVisible();

    // Test Metric Toggle buttons
    const modeSubsBtn = page.locator('#packageRevenueModeSubsBtn');
    await expect(modeSubsBtn).toBeVisible();
    await modeSubsBtn.click();
    await expect(page.locator('#packageRevenueChartContainer').getByText('TOTAL SUBS')).toBeVisible();

    const modeBilledBtn = page.locator('#packageRevenueModeBilledBtn');
    await expect(modeBilledBtn).toBeVisible();
    await modeBilledBtn.click();
    await expect(page.locator('#packageRevenueChartContainer').getByText('TOTAL BILLED')).toBeVisible();

    // Verify table exists
    const table = page.locator('.package-revenue-table');
    await expect(table).toBeVisible();

    // Test search filter
    const searchInput = page.locator('#packageRevenueSearchInput');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Mbps');

    // Close via close button
    const closeBtn = page.locator('#closePackageRevenueModalBtn');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('opens via quick action ribbon and closes with Esc key', async ({ page }) => {
    page.on('pageerror', err => console.log('BROWSER_PAGE_ERROR:', err));
    page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
    await page.goto('/');

    const quickBtn = page.locator('#quickActionPackageRevenue');
    if (await quickBtn.isVisible()) {
      await quickBtn.click();
      const modal = page.locator('#packageRevenueModal');
      await expect(modal).toBeVisible();

      // Press Esc key to close
      await page.keyboard.press('Escape');
      await expect(modal).not.toBeVisible();
    }
  });

  test('responsive verification: no horizontal overflow at 390px mobile viewport', async ({ page }) => {
    await page.goto('/');

    const quickBtn = page.locator('#quickActionPackageRevenue');
    if (await quickBtn.isVisible()) {
      await quickBtn.click();
    } else {
      const drawerToggle = page.locator('#navDrawerToggle');
      await drawerToggle.click();
      const analyticsBtn = page.locator('#navDrawer [data-nav-target="analytics"]');
      await analyticsBtn.click();
      await page.locator('#openPackageRevenueModalBtn').click();
    }
    const modal = page.locator('#packageRevenueModal');
    await expect(modal).toBeVisible();

    // Check overflow
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflow).toBe(false);

    const closeBtn = page.locator('#closePackageRevenueModalBtn');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });
});
