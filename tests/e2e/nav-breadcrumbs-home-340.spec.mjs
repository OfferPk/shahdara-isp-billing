/**
 * nav-breadcrumbs-home-340.spec.mjs
 * Verification for Issue #340:
 * - Home shows no breadcrumbs or Back button on initial load or after returning from other screens
 * - Mobile bottom nav navigation: Home -> Customers -> Home -> Reports -> Home keeps breadcrumbs hidden
 * - Desktop sidebar navigation: Home -> Customers -> Home -> Reports -> Home keeps breadcrumbs hidden
 * - Browser back/forward navigation keeps normalized '#/screen' URL hashes
 * - No horizontal overflow on mobile 390x844 or desktop 1280x800
 */

import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon.ico') && !text.includes('Failed to load resource')) {
        errors.push(text);
      }
    }
  });
  page.on('pageerror', err => errors.push(err.message));
  return errors;
}

test.describe('Issue #340: Stale breadcrumbs hidden on Home', () => {
  test('Mobile: breadcrumb bar stays hidden on Home across navigation flows (#340)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile test running on mobile viewport');
    const errors = trackErrors(page);

    const breadcrumbBar = page.locator('#mobileBreadcrumbBar');
    const breadcrumbBackBtn = page.locator('#breadcrumbBackBtn');
    const homeBottomBtn = page.locator('.mobile-bottom-nav [data-mobile-nav="home"]');
    const custBottomBtn = page.locator('.mobile-bottom-nav [data-mobile-nav="customers"]');
    const reportsBottomBtn = page.locator('.mobile-bottom-nav [data-mobile-nav="reports"]');

    // 1. Initial load on Home
    await page.goto('/#home');
    await expect(page.locator('#billingDashboard')).toBeVisible();

    await expect(breadcrumbBar).toBeHidden();
    await expect(breadcrumbBackBtn).toBeHidden();

    // 2. Navigate to Customers
    await custBottomBtn.click();
    await expect(page).toHaveURL(/#\/customers/);
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'customers');

    // Breadcrumb bar is replaced by screen header on feature screen
    await expect(breadcrumbBar).toBeHidden();

    // 3. Return to Home via bottom nav
    await homeBottomBtn.click();
    await expect(page).toHaveURL(/#\/home/);
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'home');

    // Crucial check: breadcrumb bar must NOT show stale 'Home / Customers' on Home
    await expect(breadcrumbBar).toBeHidden();
    await expect(breadcrumbBackBtn).toBeHidden();

    // 4. Navigate to Reports
    await reportsBottomBtn.click();
    await expect(page).toHaveURL(/#\/reports/);
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'reports');

    // 5. Return to Home via screen header Home back button
    const screenBackBtn = page.locator('.sr-screen-header .sr-back-button[data-sr-home]');
    await expect(screenBackBtn).toBeVisible();
    await screenBackBtn.click();
    await expect(page).toHaveURL(/#\/home/);
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'home');

    // Crucial check: breadcrumb bar must NOT show stale 'Home / Reports' on Home
    await expect(breadcrumbBar).toBeHidden();
    await expect(breadcrumbBackBtn).toBeHidden();

    // 6. Test browser history traversal
    await page.goBack(); // Back to Reports
    await expect(page).toHaveURL(/#\/reports/);
    await expect(breadcrumbBar).toBeHidden();

    await page.goBack(); // Back to Home
    await expect(page).toHaveURL(/#\/home/);
    await expect(breadcrumbBar).toBeHidden();

    // 7. Verify horizontal scroll overflow
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth - window.innerWidth;
    });
    expect(overflow).toBeLessThanOrEqual(1);

    expect(errors).toEqual([]);
  });

  test('Desktop: breadcrumb bar stays hidden on Home across navigation flows (#340)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop test running on desktop viewport');
    const errors = trackErrors(page);

    const breadcrumbBar = page.locator('#mobileBreadcrumbBar');
    const breadcrumbBackBtn = page.locator('#breadcrumbBackBtn');
    const sidebarHome = page.locator('.nav-drawer [data-nav-target="home"]');
    const sidebarCust = page.locator('.nav-drawer [data-nav-target="customers"]');
    const sidebarReports = page.locator('.nav-drawer [data-nav-target="reports"]');

    // 1. Initial load on desktop Home
    await page.goto('/#home');
    await expect(page.locator('#billingDashboard')).toBeVisible();

    await expect(breadcrumbBar).toBeHidden();
    await expect(breadcrumbBackBtn).toBeHidden();

    // 2. Go to Customers
    await sidebarCust.click();
    await expect(page).toHaveURL(/#\/customers/);
    await expect(breadcrumbBar).toBeHidden();

    // 3. Go back to Home via sidebar
    await sidebarHome.click();
    await expect(page).toHaveURL(/#\/home/);
    await expect(breadcrumbBar).toBeHidden();
    await expect(breadcrumbBackBtn).toBeHidden();

    // 4. Go to Reports
    await sidebarReports.click();
    await expect(page).toHaveURL(/#\/reports/);
    await expect(breadcrumbBar).toBeHidden();

    // 5. Go back to Home
    await sidebarHome.click();
    await expect(page).toHaveURL(/#\/home/);
    await expect(breadcrumbBar).toBeHidden();
    await expect(breadcrumbBackBtn).toBeHidden();

    // 6. Check horizontal overflow on desktop
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth - window.innerWidth;
    });
    expect(overflow).toBeLessThanOrEqual(0);

    expect(errors).toEqual([]);
  });
});
