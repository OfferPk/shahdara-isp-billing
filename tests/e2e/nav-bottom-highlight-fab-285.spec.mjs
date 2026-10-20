/**
 * nav-bottom-highlight-fab-285.spec.mjs
 * Verification for Issue #285:
 * - Mobile bottom nav highlights More on #/backup, #/settings, #/assistant, #/field-tools
 * - Mobile bottom nav highlights Collection on #/collect
 * - Speed dial + FAB is hidden while More menu, sheet, or modal dialog is open
 * - Desktop Home view-nav buttons don't have duplicate aria-current="page" with Home sidebar
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

test.describe('Issue #285: Mobile bottom nav highlights', () => {
  test('bottom nav highlights More on backup, settings, assistant, and field-tools (#285)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile bottom nav is verified on mobile viewport');
    const errors = trackErrors(page);

    const homeBtn = page.locator('.mobile-bottom-nav [data-mobile-nav="home"]');
    const custBtn = page.locator('.mobile-bottom-nav [data-mobile-nav="customers"]');
    const collBtn = page.locator('.mobile-bottom-nav [data-mobile-nav="collection"]');
    const reportsBtn = page.locator('.mobile-bottom-nav [data-mobile-nav="reports"]');
    const moreBtn = page.locator('.mobile-bottom-nav [data-mobile-nav="more"]');

    // 1. Initial /#home
    await page.goto('/#home');
    await expect(homeBtn).toHaveAttribute('aria-current', 'page');
    await expect(moreBtn).toHaveAttribute('aria-current', 'false');

    // 2. Deep link to #/backup -> expected More, NOT Home
    await page.goto('/#backup');
    await expect(moreBtn).toHaveAttribute('aria-current', 'page');
    await expect(homeBtn).toHaveAttribute('aria-current', 'false');

    // 3. Deep link to #/settings -> expected More, NOT Home
    await page.goto('/#settings');
    await expect(moreBtn).toHaveAttribute('aria-current', 'page');
    await expect(homeBtn).toHaveAttribute('aria-current', 'false');

    // 4. Deep link to #/assistant -> expected More, NOT Home
    await page.goto('/#assistant');
    await expect(moreBtn).toHaveAttribute('aria-current', 'page');
    await expect(homeBtn).toHaveAttribute('aria-current', 'false');

    // 5. Deep link to #/field-tools -> expected More, NOT Home
    await page.goto('/#field-tools');
    await expect(moreBtn).toHaveAttribute('aria-current', 'page');
    await expect(homeBtn).toHaveAttribute('aria-current', 'false');

    // 6. Deep link to #/collect -> expected Collection
    await page.goto('/#collect');
    await expect(collBtn).toHaveAttribute('aria-current', 'page');
    await expect(homeBtn).toHaveAttribute('aria-current', 'false');

    // Close collect sheet with Escape
    await page.keyboard.press('Escape');

    // 7. Customers & Reports routes
    await page.goto('/#customers');
    await expect(custBtn).toHaveAttribute('aria-current', 'page');
    await expect(moreBtn).toHaveAttribute('aria-current', 'false');

    await page.goto('/#reports');
    await expect(reportsBtn).toHaveAttribute('aria-current', 'page');
    await expect(moreBtn).toHaveAttribute('aria-current', 'false');

    expect(errors).toEqual([]);
  });

  test('speed dial + FAB is hidden when More menu or dialog is open (#285)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Speed dial FAB verified on mobile viewport');
    const errors = trackErrors(page);

    await page.goto('/#home');

    const speedDial = page.locator('#mobileSpeedDial');
    const moreBtn = page.locator('#mobileMoreButton');
    const moreMenu = page.locator('#mobileMoreMenu');

    // FAB is initially visible on Home
    await expect(speedDial).toBeVisible();

    // Open More menu
    await moreBtn.click();
    await expect(moreMenu).toBeVisible();

    // Speed dial MUST be hidden while More menu is open
    await expect(speedDial).toBeHidden();

    // Verify Reminders Queue row is fully accessible without FAB overlap
    const remindersQueueBtn = page.locator('#mobileMoreRemindersQueueBtn');
    await expect(remindersQueueBtn).toBeVisible();

    // Close More menu
    await page.keyboard.press('Escape');
    await expect(moreMenu).toBeHidden();

    // FAB is visible again
    await expect(speedDial).toBeVisible();

    // Open Field Tools dialog
    await page.goto('/#field-tools');
    const fieldToolsModal = page.locator('#fieldToolsModal');
    await expect(fieldToolsModal).toBeVisible();

    // FAB is hidden while dialog is open
    await expect(speedDial).toBeHidden();

    // Close modal
    await page.keyboard.press('Escape');
    await expect(fieldToolsModal).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('Desktop Home view-nav buttons don\'t have duplicate aria-current="page" (#285 / #278)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop navigation checked on desktop viewport');
    const errors = trackErrors(page);

    await page.goto('/#home');

    // Home is active in sidebar
    const sidebarHome = page.locator('#navDrawer [data-nav-target="home"]');
    await expect(sidebarHome).toHaveAttribute('aria-current', 'page');

    // showCustomersButton should NOT have aria-current="page" on Home
    const showCustBtn = page.locator('#showCustomersButton');
    await expect(showCustBtn).not.toHaveAttribute('aria-current', 'page');

    // When navigating to customers
    await page.goto('/#customers');
    const sidebarCust = page.locator('#navDrawer [data-nav-target="customers"]');
    await expect(sidebarCust).toHaveAttribute('aria-current', 'page');
    await expect(showCustBtn).toHaveAttribute('aria-current', 'page');

    expect(errors).toEqual([]);
  });
});
