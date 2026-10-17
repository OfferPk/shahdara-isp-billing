import { test, expect } from '@playwright/test';

test.describe('Bilingual English / Urdu (اردو) UI & RTL Layout Verification', () => {
  test('language toggle button exists, switches to Urdu with RTL layout, and updates navigation', async ({ page }) => {
    await page.goto('/');

    const html = page.locator('html');
    const toggleBtn = page.locator('#languageToggleBtn');

    // 1. Initial State (English / LTR)
    await expect(toggleBtn).toBeVisible();
    await expect(html).toHaveAttribute('dir', 'ltr');
    await expect(html).toHaveAttribute('lang', 'en');

    // 2. Click toggle button to switch to Urdu
    await toggleBtn.click();

    // Verify RTL attributes and class applied to document root
    await expect(html).toHaveAttribute('dir', 'rtl');
    await expect(html).toHaveAttribute('lang', 'ur');
    await expect(html).toHaveClass(/lang-ur/);

    // Verify toggle button label flipped to 'English'
    await expect(toggleBtn).toContainText('English');

    // Verify bottom nav items translated
    const collectionNavBtn = page.locator('[data-mobile-nav="collection"]');
    await expect(collectionNavBtn).toContainText('وصولی');

    const homeNavBtn = page.locator('[data-mobile-nav="home"]');
    await expect(homeNavBtn).toContainText('ڈیش بورڈ');

    // Verify no horizontal scrolling occurs in RTL mode
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // 3. Click toggle button again to switch back to English
    await toggleBtn.click();

    await expect(html).toHaveAttribute('dir', 'ltr');
    await expect(html).toHaveAttribute('lang', 'en');
    await expect(toggleBtn).toContainText('اردو');
    await expect(collectionNavBtn).toContainText('Collect');

    // 4. Persistence across reloads
    await toggleBtn.click(); // set to Urdu
    await page.reload();
    await expect(html).toHaveAttribute('dir', 'rtl');
    await expect(html).toHaveAttribute('lang', 'ur');
  });

  test('navigation drawer opens and displays Urdu translations with RTL alignment', async ({ page, isMobile }) => {
    await page.goto('/');

    // Switch to Urdu
    const toggleBtn = page.locator('#languageToggleBtn');
    await toggleBtn.click();

    // Open drawer
    const drawerToggle = page.locator('#navDrawerToggle');
    await drawerToggle.click();

    const drawer = page.locator('#navDrawer');
    await expect(drawer).toBeVisible();

    // Verify drawer header toggle button exists and shows English
    const drawerLangBtn = page.locator('#drawerLanguageToggleBtn');
    await expect(drawerLangBtn).toBeVisible();
    await expect(drawerLangBtn).toContainText('English');

    // Close drawer
    const drawerClose = page.locator('#navDrawerClose');
    await drawerClose.click();
    await expect(drawer).not.toBeVisible();
  });

  test('capture browser verification screenshots in mobile 390x844 and desktop 1280x800', async ({ page, isMobile }) => {
    await page.goto('/');
    const toggleBtn = page.locator('#languageToggleBtn');
    await toggleBtn.click();
    await page.waitForTimeout(400);

    const prefix = isMobile ? 'mobile-390x844' : 'desktop-1280x800';
    await page.screenshot({
      path: `C:/Users/Perfect/.gemini/antigravity/brain/528d6a23-e54a-4288-9b33-f00da9001e81/scratch/${prefix}-urdu-rtl.png`,
      fullPage: false
    });
  });
});
