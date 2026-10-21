import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error' && !/navigator\.vibrate/.test(msg.text())) {
      errors.push(msg.text());
    }
  });
  return errors;
}

test.describe('Collector & Staff Performance Suite (Backlog #9)', () => {

  test('Mobile 390x844: Open modal from Home, verify KPI HUD, SVG chart, search, and close cleanly', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile 390x844 test');
    const errors = trackErrors(page);

    await page.goto('/');

    // 1. Locate and click open button on Home
    const openBtn = page.locator('#openStaffPerfModalBtn');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    // 2. Verify modal is visible
    const modal = page.locator('#staffPerformanceModal');
    await expect(modal).toBeVisible();

    // 3. Verify zero horizontal overflow at 390px
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    // 4. Verify KPI HUD tiles
    await expect(page.locator('#staffPerfTotalCollected')).toBeVisible();
    await expect(page.locator('#staffPerfTotalReceipts')).toBeVisible();
    await expect(page.locator('#staffPerfUniqueCustomers')).toBeVisible();
    await expect(page.locator('#staffPerfAvgTicket')).toBeVisible();
    await expect(page.locator('#staffPerfActiveCrew')).toBeVisible();
    await expect(page.locator('#staffPerfCashDigitalRatio')).toBeVisible();

    // 5. Verify SVG chart container has svg element
    const svg = page.locator('#staffPerfSvgContainer svg');
    await expect(svg).toBeVisible();

    // 6. Test search filter input
    const searchInput = page.locator('#staffPerfSearchInput');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('NonExistentStaffQuery123');
    await expect(page.locator('#staffPerfTableBody')).toContainText('No collectors match the current filter');
    await searchInput.clear();

    // 7. Test Close button
    const closeBtn = page.locator('#closeStaffPerfModalBtn');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(modal).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('Desktop 1280x800: Filter channels, sort table, export actions, and open from Daily Closing', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop 1280x800 test');
    const errors = trackErrors(page);

    await page.goto('/');

    // 1. Open modal from Home
    const openBtn = page.locator('#openStaffPerfModalBtn');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    const modal = page.locator('#staffPerformanceModal');
    await expect(modal).toBeVisible();

    // 2. Verify channel filter dropdown
    const channelSelect = page.locator('#staffPerfChannelSelect');
    await expect(channelSelect).toBeVisible();
    await channelSelect.selectOption('cash');
    await channelSelect.selectOption('digital');
    await channelSelect.selectOption('all');

    // 3. Test sortable header click
    const avgHeader = page.locator('th[data-sort-staff="avgTicket"]');
    await expect(avgHeader).toBeVisible();
    await avgHeader.click();
    await expect(avgHeader).toHaveAttribute('aria-sort', 'descending');
    await avgHeader.click();
    await expect(avgHeader).toHaveAttribute('aria-sort', 'ascending');

    // 4. Verify action buttons in footer
    await expect(page.locator('#exportStaffPerfCsvBtn')).toBeVisible();
    await expect(page.locator('#printStaffPerfA4Btn')).toBeVisible();
    await expect(page.locator('#printStaffPerfThermalBtn')).toBeVisible();
    await expect(page.locator('#shareStaffPerfWhatsAppBtn')).toBeVisible();

    // 5. Close with Esc key
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();

    // 6. Open from Daily Cash Closing Suite modal cross-link
    const openDcBtn = page.locator('#openDailyClosingModalBtn');
    await expect(openDcBtn).toBeVisible();
    await openDcBtn.click();

    const dcModal = page.locator('#dailyClosingModal');
    await expect(dcModal).toBeVisible();

    const openFromClosingBtn = page.locator('#openStaffPerfFromClosingBtn');
    await expect(openFromClosingBtn).toBeVisible();
    await openFromClosingBtn.click();

    // Staff performance modal should now be open
    await expect(modal).toBeVisible();

    // Close via secondary close button
    const closeSecBtn = page.locator('#closeStaffPerfSecondaryBtn');
    await expect(closeSecBtn).toBeVisible();
    await closeSecBtn.click();
    await expect(modal).toBeHidden();

    expect(errors).toEqual([]);
  });

});
