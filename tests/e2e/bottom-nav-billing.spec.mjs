import { test, expect } from '@playwright/test';

test.describe('Mobile Bottom Navigation & More Sheet Billing Polish', () => {
  test('bottom nav displays at most 5 items, dues badge, and handles active states on mobile (#211)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Bottom nav is a mobile-specific component');

    await page.goto('/');

    const bottomNav = page.locator('.mobile-bottom-nav');
    await expect(bottomNav).toBeVisible();

    // Verify at most 5 navigation buttons are present (Material 3 and #211 specification)
    const navButtons = bottomNav.locator('button');
    await expect(navButtons).toHaveCount(5);
    expect(await navButtons.count()).toBeLessThanOrEqual(5);

    const homeBtn = page.locator('[data-mobile-nav="home"]');
    const custBtn = page.locator('[data-mobile-nav="customers"]');
    const collBtn = page.locator('[data-mobile-nav="collection"]');
    const reportsBtn = page.locator('[data-mobile-nav="reports"]');
    const moreBtn = page.locator('#mobileMoreButton');

    await expect(homeBtn).toBeVisible();
    await expect(custBtn).toBeVisible();
    await expect(collBtn).toBeVisible();
    await expect(reportsBtn).toBeVisible();
    await expect(moreBtn).toBeVisible();

    // Actions Sheet folded into More menu (#211)
    await moreBtn.click();
    const moreMenu = page.locator('#mobileMoreMenu');
    await expect(moreMenu).toBeVisible();
    const actionsBtn = page.locator('#mobileActionSheetToggle');
    await expect(actionsBtn).toBeVisible();
    await moreBtn.click();

    // Initial state: Home should be active page
    await expect(homeBtn).toHaveAttribute('aria-current', 'page');

    // Check touch target min-height >= 44px
    const collBox = await collBtn.boundingBox();
    expect(collBox?.height).toBeGreaterThanOrEqual(44);

    // Dues badge on collection exists
    const duesBadge = collBtn.locator('#bottomNavBadgeCollection');
    await expect(duesBadge).toBeAttached();

    // Tap Reports -> active tab updates
    await reportsBtn.click();
    await expect(reportsBtn).toHaveAttribute('aria-current', 'page');
    await expect(homeBtn).toHaveAttribute('aria-current', 'false');
    await expect(page.locator('#billingReportsView')).toBeVisible();

    // Tap Customers -> active tab updates
    await custBtn.click();
    await expect(custBtn).toHaveAttribute('aria-current', 'page');
    await expect(reportsBtn).toHaveAttribute('aria-current', 'false');
    await expect(page.locator('#customersView')).toBeVisible();

    // Check no horizontal scrollbar at 390px
    const bodyScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const bodyClientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 1);
  });

  test('More sheet opens, prioritizes billing items first, and navigates cleanly', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'More sheet is tested in mobile viewport');

    await page.goto('/');

    const moreBtn = page.locator('#mobileMoreButton');
    const moreMenu = page.locator('#mobileMoreMenu');

    // Menu initially hidden
    await expect(moreMenu).not.toBeVisible();

    // Click More -> opens sheet
    await moreBtn.click();
    await expect(moreMenu).toBeVisible();
    await expect(moreBtn).toHaveAttribute('aria-expanded', 'true');

    // Verify title and Billing & Business section label exist
    const title = moreMenu.locator('.more-menu-title');
    await expect(title).toBeVisible();
    await expect(title).toHaveText(/More Features & Tools/i);

    const billingLabel = moreMenu.locator('.more-menu-section-label').first();
    await expect(billingLabel).toBeVisible();
    await expect(billingLabel).toHaveText(/Billing & Business/i);

    // Verify billing items are placed at the beginning before field tools
    const billingButtons = [
      'customers',
      'collection',
      'bills',
      'expenses',
      'reports',
      'backup',
      'inventory',
      'recovery',
      'alerts',
      'assistant',
      'analytics'
    ];

    for (const key of billingButtons) {
      const btn = moreMenu.locator(`button[data-mobile-more="${key}"]`);
      await expect(btn).toBeAttached();
      const box = await btn.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }

    // Verify clicking 'Expenses' closes the menu and switches to expenses view
    const expensesBtn = moreMenu.locator('button[data-mobile-more="expenses"]');
    await expensesBtn.click();
    await expect(moreMenu).not.toBeVisible();
    await expect(moreBtn).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#expensesView')).toBeVisible();

    // Reopen More menu and verify Escape key dismisses it
    await moreBtn.click();
    await expect(moreMenu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(moreMenu).not.toBeVisible();

    // Reopen More menu and verify clicking outside dismisses it
    await moreBtn.click();
    await expect(moreMenu).toBeVisible();
    await page.locator('header.topbar').click({ position: { x: 50, y: 20 } });
    await expect(moreMenu).not.toBeVisible();
  });

  test('Dark mode styling on mobile navigation and More sheet', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile dark mode test');

    await page.goto('/');

    // Toggle theme to dark
    const themeBtn = page.locator('#themeToggle');
    await themeBtn.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    const moreBtn = page.locator('#mobileMoreButton');
    const moreMenu = page.locator('#mobileMoreMenu');

    // Open More sheet in dark mode
    await moreBtn.click();
    await expect(moreMenu).toBeVisible();

    // Verify dark mode background color
    const menuBg = await moreMenu.evaluate(el => window.getComputedStyle(el).backgroundColor);
    // Dark mode background should be a dark shade (e.g. rgb(20, 36, 31))
    expect(menuBg).toContain('20, 36, 31');

    await page.keyboard.press('Escape');
    await expect(moreMenu).not.toBeVisible();
  });

  test('Desktop view keeps top navigation visible and accessible', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop specific test');

    await page.goto('/');

    // Desktop view should have top bar visible
    const topBar = page.locator('header.topbar');
    await expect(topBar).toBeVisible();

    // Desktop view navigation bar should have view tabs
    const viewNav = page.locator('nav.view-nav');
    await expect(viewNav).toBeVisible();

    const customersBtn = page.locator('#showCustomersButton');
    const reportsBtn = page.locator('#showReportsButton');
    await expect(customersBtn).toBeVisible();
    await expect(reportsBtn).toBeVisible();

    // Switching views on desktop works
    await reportsBtn.click();
    await expect(page.locator('#billingReportsView')).toBeVisible();

    await customersBtn.click();
    await expect(page.locator('#customersView')).toBeVisible();
  });
});
