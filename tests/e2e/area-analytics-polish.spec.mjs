import { test, expect } from '@playwright/test';

async function navigateToAnalytics(page) {
  const desktopBtn = page.locator('#showAnalyticsButton');
  if (await desktopBtn.isVisible()) {
    await desktopBtn.click();
  } else {
    const moreBtn = page.locator('#mobileMoreButton');
    await expect(moreBtn).toBeVisible();
    await moreBtn.click();
    const analyticsMoreBtn = page.locator('[data-mobile-more="analytics"]');
    await expect(analyticsMoreBtn).toBeVisible();
    await analyticsMoreBtn.click();
  }
}

test.describe('Area Intelligence & Analytics Polish Suite E2E Verification', () => {
  test('switches to analytics, verifies search, sorting, and CSV exports', async ({ page }) => {
    await page.goto('/');

    // Switch to Analytics view via responsive navigation helper
    await navigateToAnalytics(page);

    const analyticsView = page.locator('#analyticsView');
    await expect(analyticsView).toBeVisible();

    // Verify search toolbar in Area Intelligence
    const searchInput = page.locator('#areaIntelSearch');
    await expect(searchInput).toBeVisible();
    const rowCount = page.locator('#areaIntelRowCount');
    await expect(rowCount).toBeVisible();

    // Verify CSV export buttons exist
    const exportAreaCsvBtn = page.locator('#exportAreaIntelCsvBtn');
    await expect(exportAreaCsvBtn).toBeVisible();
    const exportPackageCsvBtn = page.locator('#exportPackageSummaryCsvBtn');
    await expect(exportPackageCsvBtn).toBeVisible();
    const exportAreaSummaryCsvBtn = page.locator('#exportAreaSummaryCsvBtn');
    await expect(exportAreaSummaryCsvBtn).toBeVisible();

    // Test search filter with non-existent query
    await searchInput.fill('NonExistentAreaName999');
    const emptyState = page.locator('#areaIntelligenceEmpty');
    await expect(emptyState).toBeVisible();
    const resetBtn = page.locator('#resetAreaIntelFiltersBtn');
    await expect(resetBtn).toBeVisible();

    // Reset filter
    await resetBtn.click();
    await expect(searchInput).toHaveValue('');
    await expect(emptyState).not.toBeVisible();

    // Test sort headers on Area Intelligence table
    const avgValHeader = page.locator('[data-sort-area="averageCustomerValue"]');
    await expect(avgValHeader).toBeVisible();
    await avgValHeader.click();
    await expect(avgValHeader).toHaveAttribute('aria-sort', /ascending|descending/);

    const expensesHeader = page.locator('[data-sort-area="expenses"]');
    await expect(expensesHeader).toBeVisible();
    await expensesHeader.click();
    await expect(expensesHeader).toHaveAttribute('aria-sort', /ascending|descending/);

    const profitHeader = page.locator('[data-sort-area="estimatedProfit"]');
    await expect(profitHeader).toBeVisible();
    await profitHeader.click();
    await expect(profitHeader).toHaveAttribute('aria-sort', /ascending|descending/);

    // Test sort headers on Package Summary table
    const pkgHeader = page.locator('[data-sort-pkgsum="package"]');
    await expect(pkgHeader).toBeVisible();
    await pkgHeader.click();
    await expect(pkgHeader).toHaveAttribute('aria-sort', /ascending|descending/);

    const arpuHeader = page.locator('[data-sort-pkgsum="arpu"]');
    await expect(arpuHeader).toBeVisible();
    await arpuHeader.click();
    await expect(arpuHeader).toHaveAttribute('aria-sort', /ascending|descending/);
  });

  test('responsive viewport checks: no horizontal scroll and accessible search', async ({ page }) => {
    await page.goto('/');

    await navigateToAnalytics(page);

    const analyticsView = page.locator('#analyticsView');
    await expect(analyticsView).toBeVisible();

    // Check search input visible and accessible touch target
    const searchInput = page.locator('#areaIntelSearch');
    await expect(searchInput).toBeVisible();
    const searchBox = await searchInput.boundingBox();
    expect(searchBox.height).toBeGreaterThanOrEqual(40);

    // Check export button visible
    const exportBtn = page.locator('#exportAreaIntelCsvBtn');
    await expect(exportBtn).toBeVisible();

    // Verify document does not horizontally scroll out of bounds
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);
  });
});
