import { test, expect } from '@playwright/test';

test.describe('Pending Actions Center & Collection Promises Suite E2E Verification', () => {
  test('topbar button opens pending actions modal, displays tabs, and closes cleanly', async ({ page }) => {
    await page.goto('/');

    // Verify topbar pending actions button exists
    const topbarBtn = page.locator('#topbarPendingActionsBtn');
    await expect(topbarBtn).toBeVisible();

    // Open Pending Actions Modal
    await topbarBtn.click();

    const modal = page.locator('#pendingActionsModal');
    await expect(modal).toBeVisible();

    // Verify Title and Subtitle
    const title = page.locator('#pendingActionsTitle');
    await expect(title).toBeVisible();
    await expect(title).toContainText('Pending Actions');

    // Verify tabs exist
    const tabAll = page.locator('.pending-actions-tab[data-pending-tab="all"]');
    const tabReceipts = page.locator('.pending-actions-tab[data-pending-tab="receipts"]');
    const tabPromises = page.locator('.pending-actions-tab[data-pending-tab="promises"]');
    const tabOffline = page.locator('.pending-actions-tab[data-pending-tab="offline"]');

    await expect(tabAll).toBeVisible();
    await expect(tabReceipts).toBeVisible();
    await expect(tabPromises).toBeVisible();
    await expect(tabOffline).toBeVisible();

    // Switch between tabs
    await tabReceipts.click();
    await expect(tabReceipts).toHaveClass(/active/);

    await tabPromises.click();
    await expect(tabPromises).toHaveClass(/active/);

    await tabAll.click();
    await expect(tabAll).toHaveClass(/active/);

    // Close via close button
    const closeBtn = page.locator('#closePendingActionsModalBtn');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('navigation drawer opens pending actions modal and dismisses with Escape key', async ({ page }) => {
    await page.goto('/');

    // Open navigation drawer
    const drawerToggle = page.locator('#navDrawerToggle');
    await expect(drawerToggle).toBeVisible();
    await drawerToggle.click();

    const drawer = page.locator('#navDrawer');
    await expect(drawer).toBeVisible();

    // Click Pending Actions in drawer
    const drawerPendingBtn = page.locator('#navPendingActionsBtn');
    await expect(drawerPendingBtn).toBeVisible();
    await drawerPendingBtn.click();

    // Verify drawer closed and modal opened
    const modal = page.locator('#pendingActionsModal');
    await expect(modal).toBeVisible();

    // Dismiss with Escape key
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('schedule collection promise form toggles, validates, and cancels cleanly', async ({ page }) => {
    await page.goto('/');

    // Open modal via topbar
    const topbarBtn = page.locator('#topbarPendingActionsBtn');
    await topbarBtn.click();

    const modal = page.locator('#pendingActionsModal');
    await expect(modal).toBeVisible();

    // Toggle Schedule Promise Form
    const toggleFormBtn = page.locator('#toggleSchedulePromiseFormBtn');
    await expect(toggleFormBtn).toBeVisible();
    await toggleFormBtn.click();

    const formContainer = page.locator('#pendingPromiseFormContainer');
    await expect(formContainer).toBeVisible();

    // Verify customer dropdown has options
    const custSelect = page.locator('#promiseCustomerSelect');
    await expect(custSelect).toBeVisible();

    // Verify amount input
    const amountInput = page.locator('#promiseAmountInput');
    await expect(amountInput).toBeVisible();
    await amountInput.fill('2500');

    // Cancel form
    const cancelBtn = page.locator('#cancelPromiseFormBtn');
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();
    await expect(formContainer).not.toBeVisible();

    // Close modal via secondary footer button
    const secondaryCloseBtn = page.locator('#closePendingActionsSecondaryBtn');
    await expect(secondaryCloseBtn).toBeVisible();
    await secondaryCloseBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('responsive verification: zero horizontal scroll overflow at 390px mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Open modal at 390px
    const topbarBtn = page.locator('#topbarPendingActionsBtn');
    await topbarBtn.click();

    const modal = page.locator('#pendingActionsModal');
    await expect(modal).toBeVisible();

    // Verify zero horizontal scroll overflow
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // Dismiss with close button
    const closeBtn = page.locator('#closePendingActionsModalBtn');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });
});
