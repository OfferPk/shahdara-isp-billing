import { test, expect } from '@playwright/test';

test.describe('Mobile Header & Fixed Bottom Nav QA (#214, #211)', () => {
  test('Mobile topbar height <= 64px and zero horizontal overflow across mobile widths', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile topbar test is for mobile viewports');

    const viewports = [
      { width: 360, height: 640 },
      { width: 390, height: 844 },
      { width: 412, height: 915 }
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.goto('/');

      // Wait for topbar to be visible
      const topbar = page.locator('.topbar');
      await expect(topbar).toBeVisible();

      // Verify topbar height is <= 64px
      const topbarBox = await topbar.boundingBox();
      expect(topbarBox).toBeTruthy();
      expect(topbarBox.height).toBeLessThanOrEqual(64);

      // Verify no horizontal overflow on document
      const overflow = await page.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth
        };
      });
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

      // Verify header actions fit within viewport width
      const headerActions = page.locator('.topbar-actions');
      const actionsBox = await headerActions.boundingBox();
      expect(actionsBox).toBeTruthy();
      expect(actionsBox.x + actionsBox.width).toBeLessThanOrEqual(vp.width);

      // Verify essential buttons are clickable and visible
      const themeToggle = page.locator('#themeToggle');
      const langToggle = page.locator('#languageToggleBtn');
      const drawerBtn = page.locator('#navDrawerToggle');

      await expect(themeToggle).toBeVisible();
      await expect(langToggle).toBeVisible();
      await expect(drawerBtn).toBeVisible();
    }
  });

  test('Mobile theme toggle and language toggle work cleanly', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile test for theme and language toggle');

    await page.goto('/');

    const themeToggle = page.locator('#themeToggle');
    const initialTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'light');

    // Click theme toggle
    await themeToggle.click();
    const newTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(newTheme).not.toBe(initialTheme);

    // Toggle back
    await themeToggle.click();
    const restoredTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(restoredTheme).toBe(initialTheme);

    // Test language toggle
    const langToggle = page.locator('#languageToggleBtn');
    const initialLang = await page.evaluate(() => document.documentElement.getAttribute('lang') || 'en');
    await langToggle.click();
    const toggledLang = await page.evaluate(() => document.documentElement.getAttribute('lang'));
    expect(toggledLang).not.toBe(initialLang);

    // Toggle back
    await langToggle.click();
    const restoredLang = await page.evaluate(() => document.documentElement.getAttribute('lang'));
    expect(restoredLang).toBe(initialLang);
  });

  test('Nav drawer opens, displays theme toggle, and closes cleanly', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Nav drawer is tested in mobile view');

    await page.goto('/');

    const drawerToggle = page.locator('#navDrawerToggle');
    await drawerToggle.click();

    const drawer = page.locator('#navDrawer');
    await expect(drawer).toBeVisible();

    // Verify drawer theme toggle button exists and works
    const drawerThemeBtn = page.locator('#drawerThemeToggleBtn');
    await expect(drawerThemeBtn).toBeVisible();
    await drawerThemeBtn.click();

    // Close drawer via close button
    const closeBtn = page.locator('#navDrawerClose');
    await closeBtn.click();
    await expect(drawer).not.toBeVisible();
  });

  test('Bottom nav is fixed to bottom on mobile, stays fixed on scroll, and switches views', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Bottom nav fixed test is for mobile viewports');

    await page.goto('/');

    const bottomNav = page.locator('.mobile-bottom-nav');
    await expect(bottomNav).toBeVisible();

    // Check position CSS property is fixed
    const position = await bottomNav.evaluate(el => window.getComputedStyle(el).position);
    expect(position).toBe('fixed');

    // Check bottom nav bounding box is at bottom of viewport
    let box = await bottomNav.boundingBox();
    expect(box).toBeTruthy();
    expect(box.y + box.height).toBeGreaterThanOrEqual(840);

    // Scroll down 2000px
    await page.evaluate(() => window.scrollTo(0, 2000));
    await page.waitForTimeout(100);

    // Position must still be fixed and at bottom of viewport
    box = await bottomNav.boundingBox();
    expect(box).toBeTruthy();
    expect(box.y + box.height).toBeGreaterThanOrEqual(840);
    expect(box.y).toBeLessThanOrEqual(844);

    // Test clicking Reports tab -> reports view becomes visible
    const reportsBtn = page.locator('[data-mobile-nav="reports"]');
    await reportsBtn.click();
    await expect(page.locator('#billingReportsView')).toBeVisible();

    // Test clicking Customers tab -> customers view becomes visible
    const custBtn = page.locator('[data-mobile-nav="customers"]');
    await custBtn.click();
    await expect(page.locator('#customersView')).toBeVisible();

    // Test clicking Collection tab -> opens Quick Collect modal
    const collBtn = page.locator('[data-mobile-nav="collection"]');
    await collBtn.click();
    const quickCollectModal = page.locator('#quickCollectModal');
    await expect(quickCollectModal).toBeVisible();
    await page.locator('#closeQuickCollectModalBtn').click();
    await expect(quickCollectModal).not.toBeVisible();

    // Test clicking Home tab -> back to home/customers view
    const homeBtn = page.locator('[data-mobile-nav="home"]');
    await homeBtn.click();
    await expect(page.locator('#customersView')).toBeVisible();

    // Bottom nav still fixed after navigation
    box = await bottomNav.boundingBox();
    expect(box).toBeTruthy();
    expect(box.y + box.height).toBeGreaterThanOrEqual(840);
  });

  test('Desktop view (1280x800): bottom nav hidden, topbar shortcuts visible, zero horizontal scroll', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop view test is for desktop viewport');

    await page.goto('/');

    const bottomNav = page.locator('.mobile-bottom-nav');
    await expect(bottomNav).toBeHidden();

    const commandPaletteTrigger = page.locator('#commandPaletteTrigger');
    await expect(commandPaletteTrigger).toBeVisible();

    const overflow = await page.evaluate(() => {
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      };
    });
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });
});
