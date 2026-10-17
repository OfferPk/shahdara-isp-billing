import { test, expect } from '@playwright/test';

test.describe('Navigation, Views, and Modal Dialogs Verification', () => {
  test('bottom navigation switches views and opens collection modal cleanly on mobile', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Bottom nav is mobile-only component');
    await page.goto('/');

    // 1. Initial view: Customers / Home
    const customersView = page.locator('#customersView');
    await expect(customersView).toBeVisible();

    // 2. Tap Collection tab -> #quickCollectModal opens
    const collectBtn = page.locator('[data-mobile-nav="collection"]');
    await collectBtn.click();

    const quickCollectModal = page.locator('#quickCollectModal');
    await expect(quickCollectModal).toBeVisible();

    // Close #quickCollectModal via close button
    const closeQcBtn = page.locator('#closeQuickCollectModalBtn');
    await closeQcBtn.click();
    await expect(quickCollectModal).not.toBeVisible();

    // 3. Tap Reports tab -> reports view becomes visible
    const reportsBtn = page.locator('[data-mobile-nav="reports"]');
    await reportsBtn.click();
    const reportsView = page.locator('#billingReportsView');
    await expect(reportsView).toBeVisible();

    // 4. Tap Customers tab -> customers view becomes visible again
    const custBtn = page.locator('[data-mobile-nav="customers"]');
    await custBtn.click();
    await expect(customersView).toBeVisible();

    // 5. Tap Actions sheet toggle -> #mobileActionSheet opens
    const actionToggle = page.locator('#mobileActionSheetToggle');
    await actionToggle.click();
    const actionSheet = page.locator('#mobileActionSheet');
    await expect(actionSheet).toBeVisible();

    const actionBackdrop = page.locator('#mobileActionSheetBackdrop');

    // Close action sheet via close button
    const closeSheetBtn = page.locator('#mobileActionSheetClose');
    await closeSheetBtn.click();
    await expect(actionSheet).not.toBeVisible();

    // Reopen and test close via Escape key
    await actionToggle.click();
    await expect(actionSheet).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(actionSheet).not.toBeVisible();

    // Reopen and test close via backdrop tap (tap in upper exposed area)
    await actionToggle.click();
    await expect(actionSheet).toBeVisible();
    await actionBackdrop.click({ position: { x: 20, y: 50 } });
    await expect(actionSheet).not.toBeVisible();
  });

  test('topbar controls operate search, theme, language, and drawer', async ({ page }) => {
    await page.goto('/');

    const html = page.locator('html');

    // 1. Theme toggle
    const themeBtn = page.locator('#themeToggle');
    await expect(themeBtn).toBeVisible();
    const initialTheme = await html.getAttribute('data-theme');
    await themeBtn.click();
    const nextTheme = await html.getAttribute('data-theme');
    expect(nextTheme).not.toBe(initialTheme);
    await themeBtn.click(); // restore

    // 2. Fast Customer Search modal
    const searchTrigger = page.locator('#mobileCustomerSearchTrigger');
    if (await searchTrigger.isVisible()) {
      await searchTrigger.click();
      const searchModal = page.locator('#mobileCustomerSearchModal');
      await expect(searchModal).toBeVisible();

      // Close with Escape key
      await page.keyboard.press('Escape');
      await expect(searchModal).not.toBeVisible();
    }

    // 3. Drawer toggle
    const drawerToggle = page.locator('#navDrawerToggle');
    await drawerToggle.click();
    const drawer = page.locator('#navDrawer');
    await expect(drawer).toBeVisible();

    // Close drawer with close button
    const drawerClose = page.locator('#navDrawerClose');
    await drawerClose.click();
    await expect(drawer).not.toBeVisible();
  });

  test('drawer navigation switches views and closes drawer automatically', async ({ page }) => {
    await page.goto('/');

    // Open drawer
    const drawerToggle = page.locator('#navDrawerToggle');
    await drawerToggle.click();
    const drawer = page.locator('#navDrawer');
    await expect(drawer).toBeVisible();

    // Click Transactions item
    const txBtn = drawer.locator('[data-nav-target="transactions"]');
    await txBtn.click();

    // Drawer must close and transactions view must be visible
    await expect(drawer).not.toBeVisible();
    const txView = page.locator('#transactionsView');
    await expect(txView).toBeVisible();

    // Reopen drawer and navigate to Expenses
    await drawerToggle.click();
    await expect(drawer).toBeVisible();

    const expBtn = drawer.locator('[data-nav-target="expenses"]');
    await expBtn.click();

    await expect(drawer).not.toBeVisible();
    const expView = page.locator('#expensesView');
    await expect(expView).toBeVisible();
  });

  test('dashboard ribbon quick action modals open and close cleanly', async ({ page }) => {
    await page.goto('/');

    // Top Defaulters modal
    const topDefaultersBtn = page.locator('#quickActionTopDefaulters');
    if (await topDefaultersBtn.isVisible()) {
      await topDefaultersBtn.click();
      const defaultersModal = page.locator('#topDefaultersModal');
      await expect(defaultersModal).toBeVisible();

      const closeBtn = page.locator('#closeTopDefaultersModalBtn');
      await closeBtn.click();
      await expect(defaultersModal).not.toBeVisible();
    }

    // Area Collections modal
    const areaCollectionsBtn = page.locator('#quickActionAreaCollections');
    if (await areaCollectionsBtn.isVisible()) {
      await areaCollectionsBtn.click();
      const areaModal = page.locator('#areaCollectionsModal');
      await expect(areaModal).toBeVisible();

      const closeBtn = page.locator('#closeAreaCollectionsModalBtn');
      await closeBtn.click();
      await expect(areaModal).not.toBeVisible();
    }

    // Package Revenue Mix modal
    const packageRevenueBtn = page.locator('#quickActionPackageRevenue');
    if (await packageRevenueBtn.isVisible()) {
      await packageRevenueBtn.click();
      const pkgModal = page.locator('#packageRevenueModal');
      await expect(pkgModal).toBeVisible();

      // Check Donut chart container and KPI elements exist
      const chartContainer = page.locator('#packageRevenueChartContainer');
      await expect(chartContainer).toBeVisible();
      const kpiBilled = page.locator('#packageRevenueKpiBilled');
      await expect(kpiBilled).toBeVisible();

      const closeBtn = page.locator('#closePackageRevenueModalBtn');
      await closeBtn.click();
      await expect(pkgModal).not.toBeVisible();
    }
  });
});
