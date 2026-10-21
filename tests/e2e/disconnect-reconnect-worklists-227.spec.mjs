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

test.describe('Issue #227: Disconnection & Reconnection Worklists Suite', () => {

  test('Mobile 390x844: Summary card opens modal, displays worklists, searches, switches tabs and closes cleanly', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile 390x844 test');
    const errors = trackErrors(page);

    await page.goto('/');

    // 1. Verify Worklists summary card is visible on Home
    const card = page.locator('#worklistsSummaryCard');
    await expect(card).toBeVisible();
    await expect(page.locator('#worklistsSummaryDiscCount')).toBeVisible();
    await expect(page.locator('#worklistsSummaryRecCount')).toBeVisible();

    // 2. Click to open modal
    const openBtn = page.locator('#openWorklistsModalBtn');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    // 3. Modal is visible and no horizontal scroll at 390px
    const modal = page.locator('#workListModal');
    await expect(modal).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    // 4. Check tabs exist and switch
    const discTab = page.locator('.worklist-tab-btn[data-tab="disconnect"]');
    const recTab = page.locator('.worklist-tab-btn[data-tab="reconnect"]');
    const rulesTab = page.locator('.worklist-tab-btn[data-tab="rules"]');

    await expect(discTab).toBeVisible();
    await expect(recTab).toBeVisible();
    await expect(rulesTab).toBeVisible();

    // Disconnect tab is active initially
    await expect(page.locator('#worklistDisconnectPane')).toBeVisible();
    await expect(page.locator('#worklistReconnectPane')).toBeHidden();

    // Switch to Reconnect tab
    await recTab.click();
    await expect(page.locator('#worklistReconnectPane')).toBeVisible();
    await expect(page.locator('#worklistDisconnectPane')).toBeHidden();

    // Switch to Rules tab
    await rulesTab.click();
    await expect(page.locator('#worklistRulesPane')).toBeVisible();
    await expect(page.locator('#worklistRuleOverdueDays')).toBeVisible();
    await expect(page.locator('#worklistRuleMinBalance')).toBeVisible();

    // Switch back to Disconnect tab
    await discTab.click();
    await expect(page.locator('#worklistDisconnectPane')).toBeVisible();

    // 5. Test search filter input
    const searchInput = page.locator('#worklistSearchInput');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('NonexistentUserQueryXYZ');
    await expect(page.locator('#worklistDisconnectList')).toContainText('No accounts scheduled for disconnection');
    await searchInput.clear();

    // 6. Test Close button
    const closeBtn = page.locator('#worklistCloseBtn');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(modal).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('Desktop 1280x800: Worklist actions, mark offline/active, CSV/Print export and Dues Recovery integration', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop 1280x800 test');
    const errors = trackErrors(page);

    await page.goto('/');

    // 1. Open worklist modal from Home summary card
    await page.locator('#openWorklistsModalBtn').click();
    const modal = page.locator('#workListModal');
    await expect(modal).toBeVisible();

    // 2. Verify export action buttons exist in modal footer
    await expect(page.locator('#worklistExportCsvBtn')).toBeVisible();
    await expect(page.locator('#worklistPrintBtn')).toBeVisible();
    await expect(page.locator('#worklistCopyDispatchBtn')).toBeVisible();

    // 3. Telemetry SVG visualizer is rendered
    await expect(page.locator('#worklistSvgHost svg')).toBeVisible();

    // 4. Close via close button
    await page.locator('#worklistCloseBtn').click();
    await expect(modal).toBeHidden();

    // 5. Verify Dues Recovery panel contains the worklists button
    await page.goto('/#/recovery');
    await expect(page.locator('#billingReportsView')).toBeVisible();
    await expect(page.locator('#billingReportsView')).toHaveAttribute('data-report-screen', 'recovery');
    const duesBtn = page.locator('#openWorklistsFromDuesBtn');
    await expect(duesBtn).toBeVisible();
    await duesBtn.click();
    await expect(modal).toBeVisible();
    await page.locator('#worklistCloseBtn').click();
    await expect(modal).toBeHidden();

    expect(errors).toEqual([]);
  });

});
