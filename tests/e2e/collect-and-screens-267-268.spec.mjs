// E2E test verifying:
// Issue #268: Quick Collect & Bulk Collect after setup generate real dues & prefilled amounts.
// Issue #267: More menu items (Bills, Backup & Restore, Owner Assistant, Dues Recovery, Smart Alerts)
//             and deep links open dedicated screens at the top.
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

async function openCollect(page, isMobile) {
  if (isMobile) await page.locator('[data-mobile-nav="collection"]').click();
  else await page.evaluate(() => window.quickCollectModalController.open());
  await expect(page.locator('#quickCollectModal')).toBeVisible();
}

async function openMoreItem(page, item, isMobile) {
  if (isMobile) {
    await page.locator('#mobileMoreButton').click();
    await page.locator(`[data-mobile-more="${item}"]`).click();
  } else {
    const drawerToggle = page.locator('#navDrawerToggle');
    if (await drawerToggle.isVisible()) {
      await drawerToggle.click();
      const drawerTarget = page.locator(`#navDrawer [data-nav-target="${item}"]`);
      if (await drawerTarget.isVisible()) {
        await drawerTarget.click();
        return;
      }
    }
    await page.goto(`/#/${item}`);
  }
}

test.describe('Issue #268: Quick Collect & Bulk Collect data path', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('setup packages via modal generates bills, sets dues, and populates Quick & Bulk Collect', async ({ page, isMobile }) => {
    const errors = trackErrors(page);

    // 1. Open Collect (Quick Collect)
    await openCollect(page, isMobile);

    // Verify initial empty state with 74 customers needing fee
    await expect(page.locator('#quickCollectDuesCount')).toHaveText('0');
    await expect(page.locator('#quickCollectAllCount')).toHaveText('74');
    await expect(page.locator('.qc-needs-setup')).toBeVisible();

    // 2. Click "Set packages & monthly fee"
    await page.locator('[data-qc-setup-packages]').first().click();
    await expect(page.locator('#collectSetupModal')).toBeVisible();

    // Verify initial count is 0, click Select All
    await expect(page.locator('#collectSetupCount')).toHaveText('0 selected');
    await page.locator('#collectSetupSelectAll').check();
    await expect(page.locator('#collectSetupCount')).toHaveText('74 selected');
    await expect(page.locator('#collectSetupApplyBtn')).toBeEnabled();
    await expect(page.locator('#collectSetupApplyBtn')).toHaveText(/Apply: Set package/);

    // 3. Click Apply and close
    await page.locator('#collectSetupApplyBtn').click();
    await expect(page.locator('#collectSetupStatus')).toContainText('Package set for 74 customers · 74 bills generated');
    await page.locator('#closeCollectSetupBtn').click();
    await expect(page.locator('#collectSetupModal')).toBeHidden();

    // 4. Quick Collect now has Pending (74), customer rows show dues
    await expect(page.locator('#quickCollectDuesCount')).toHaveText('74');
    const firstRow = page.locator('.qc-customer-card').first();
    await expect(firstRow).toBeVisible();
    await expect(firstRow).toContainText('PKR 1,000');

    // Bottom nav Collect badge shows 74 (on mobile)
    if (isMobile) {
      await expect(page.locator('#bottomNavBadgeCollection')).toBeVisible();
      await expect(page.locator('#bottomNavBadgeCollection')).toHaveText('74');
    }

    // 5. Open Bulk Collect Cash
    await page.locator('#openBulkCollectBtn').click();
    await expect(page.locator('#bulkCollectModal')).toBeVisible();

    // Bulk caption shows Pending customers (74), NOT "No pending dues"
    await expect(page.locator('.bc-list-caption')).toContainText('Pending customers (74)');

    // 6. Search Test Customer 01
    await page.locator('#bulkCollectSearch').fill('Test Customer 01');
    const firstRow = page.locator('[data-bulk-row="seed-001"]');
    await expect(firstRow).toBeVisible();
    await expect(firstRow.locator('.bc-badge-due')).toHaveText('Due PKR 1,000');
    // Amount input is prefilled with 1000
    await expect(firstRow.locator('.bc-amount')).toHaveValue('1000');

    // Add Test Customer 01 to batch
    await firstRow.locator('.bc-row-add').click();
    await expect(page.locator('#bulkCollectCount')).toHaveText('1 customer');
    await expect(page.locator('#bulkCollectTotal')).toHaveText('PKR 1,000');

    expect(errors).toEqual([]);
  });

  test('Generate this month bills button in empty state notifies that packages are needed first', async ({ page, isMobile }) => {
    const errors = trackErrors(page);

    // Open Quick Collect
    await openCollect(page, isMobile);
    await expect(page.locator('.qc-needs-setup')).toBeVisible();

    // Click "Generate this month's bills"
    await page.locator('[data-qc-generate-bills]').first().click();
    await expect(page.locator('.qc-generate-result')).toContainText('need a package');

    // After setting up 5 customers, bills generate and dues appear
    await page.locator('[data-qc-setup-packages]').first().click();
    const setup = page.locator('#collectSetupModal');
    await expect(setup).toBeVisible();
    for (let i = 0; i < 5; i++) {
      await setup.locator('[data-cs-customer]').nth(i).check();
    }
    await page.locator('#collectSetupApplyBtn').click();
    await expect(page.locator('#collectSetupStatus')).toContainText('Package set for 5 customers · 5 bills generated');
    await page.locator('#closeCollectSetupBtn').click();
    await expect(setup).toBeHidden();

    await expect(page.locator('#quickCollectDuesCount')).toHaveText('5');
    await expect(page.locator('.qc-customer-card')).toHaveCount(5);

    expect(errors).toEqual([]);
  });
});

test.describe('Issue #267: More menu dedicated screens and deep links', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Bills opens dedicated Monthly Bills screen at top', async ({ page, isMobile }) => {
    const errors = trackErrors(page);
    await openMoreItem(page, 'bills', isMobile);

    await expect(page).toHaveURL(/#\/bills$/);
    await expect(page.locator('#srScreenHeader')).toBeVisible();
    await expect(page.locator('#srScreenTitle')).toHaveText('Monthly Bills');
    await expect(page.locator('#srScreenSubtitle')).toHaveText('Generated bills, due dates and customer billing status');
    await expect(page.locator('#srPrimaryAction')).toHaveText('+ Add Payment');
    await expect(page.locator('#billingReportsView')).toBeVisible();
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeLessThan(5);

    expect(errors).toEqual([]);
  });

  test('Backup & Restore opens dedicated screen with controls at top', async ({ page, isMobile }) => {
    const errors = trackErrors(page);
    await openMoreItem(page, 'backup', isMobile);

    await expect(page).toHaveURL(/#\/backup$/);
    await expect(page.locator('#srScreenHeader')).toBeVisible();
    await expect(page.locator('#srScreenTitle')).toHaveText('Backup & Restore');
    await expect(page.locator('#srPrimaryAction')).toHaveText('Backup Now');
    await expect(page.locator('#backupControls')).toBeVisible();
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeLessThan(5);

    expect(errors).toEqual([]);
  });

  test('Owner Assistant opens dedicated screen with input ready at top', async ({ page, isMobile }) => {
    const errors = trackErrors(page);
    await openMoreItem(page, 'assistant', isMobile);

    await expect(page).toHaveURL(/#\/assistant$/);
    await expect(page.locator('#srScreenHeader')).toBeVisible();
    await expect(page.locator('#srScreenTitle')).toHaveText('Owner Assistant');
    await expect(page.locator('#srPrimaryAction')).toHaveText('Ask Question');
    await expect(page.locator('#ownerCommandCenter')).toBeVisible();
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeLessThan(5);

    // Clicking primary action focuses input
    await page.locator('#srPrimaryAction').click();
    await expect(page.locator('#ownerCommandInput')).toBeFocused();

    expect(errors).toEqual([]);
  });

  test('Dues Recovery opens dedicated screen with panel at top', async ({ page, isMobile }) => {
    const errors = trackErrors(page);
    await openMoreItem(page, 'recovery', isMobile);

    await expect(page).toHaveURL(/#\/recovery$/);
    await expect(page.locator('#srScreenHeader')).toBeVisible();
    await expect(page.locator('#srScreenTitle')).toHaveText('Dues Recovery');
    await expect(page.locator('#srPrimaryAction')).toHaveText('Remind Pending');
    await expect(page.locator('#duesRecoveryPanel')).toBeVisible();
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeLessThan(5);

    expect(errors).toEqual([]);
  });

  test('Smart Alerts opens dedicated screen with alerts at top', async ({ page, isMobile }) => {
    const errors = trackErrors(page);
    await openMoreItem(page, 'alerts', isMobile);

    await expect(page).toHaveURL(/#\/alerts$/);
    await expect(page.locator('#srScreenHeader')).toBeVisible();
    await expect(page.locator('#srScreenTitle')).toHaveText('Smart Alerts');
    await expect(page.locator('#smartAlertsPanel')).toBeVisible();
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeLessThan(5);

    expect(errors).toEqual([]);
  });

  test('Deep links #/settings, #/payments, #/field-tools route correctly', async ({ page }) => {
    const errors = trackErrors(page);

    // #/settings -> backup
    await page.goto('/#/settings');
    await expect(page.locator('#srScreenTitle')).toHaveText('Backup & Restore');
    await expect(page.locator('#backupControls')).toBeVisible();

    // #/payments -> transactions
    await page.goto('/#/payments');
    await expect(page.locator('#srScreenTitle')).toHaveText('Transactions');
    await expect(page.locator('#transactionsView')).toBeVisible();

    // #/field-tools -> opens field tools modal
    await page.goto('/#/field-tools');
    await expect(page.locator('#fieldToolsModal')).toBeVisible();

    expect(errors).toEqual([]);
  });
});
