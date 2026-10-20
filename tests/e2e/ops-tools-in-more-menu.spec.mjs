// #278 follow-up: the Operations & Intelligence Tools grid moved off Home into the
// More menu (collapsible "Operations & Intelligence Tools (15 tools)" section),
// cutting Home's height. These tests pin the new location and verify the tools
// still work when launched from the menu.
import { test, expect } from '@playwright/test';

const OPS_TILES = [
  '#quickActionRecordExpense',
  '#quickActionMonthlyReports',
  '#quickActionAnalytics',
  '#quickActionBackupData',
  '#quickActionExecutiveBriefing',
  '#quickActionFieldWizard',
  '#quickActionDailyRegisterTile',
  '#quickActionBillingCorrectness',
  '#quickActionDataIntegrity',
  '#quickActionLateFeeManager',
  '#quickActionTopDefaulters',
  '#quickActionAreaCollections',
  '#quickActionPackageRevenue',
  '#quickActionPnl',
  '#quickActionMomGrowth'
];

async function openOpsTools(page) {
  await page.locator('#mobileMoreButton').click();
  await expect(page.locator('#mobileMoreMenu')).toBeVisible();
  const details = page.locator('#moreMenuOpsToolsDetails');
  if (!(await details.evaluate(d => d.open))) {
    await details.locator('summary').click();
  }
  await expect(details).toHaveAttribute('open', '');
}

test.describe('Operations & Intelligence Tools live in the More menu (#278)', () => {

  test('Mobile: tools grid is not on Home and Home is shorter', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'More menu is the mobile navigation pattern');
    await page.goto('/');

    // The region now lives inside the More menu, not the Home dashboard
    const placement = await page.evaluate(() => ({
      inDashboard: document.getElementById('billingDashboard').contains(document.getElementById('dashboardSecondaryRegion')),
      inMoreMenu: document.getElementById('mobileMoreMenu').contains(document.getElementById('dashboardSecondaryRegion'))
    }));
    expect(placement).toEqual({ inDashboard: false, inMoreMenu: true });
    await expect(page.locator('#dashboardSecondaryRegion')).toBeHidden();

    // Home essentials stay on Home: Daily Closing card (the Data Safety grid
    // card was removed by owner decision — Data Safety lives in the bottom banner)
    await expect(page.locator('#dashboardDataSafetyCard')).toHaveCount(0);
    await expect(page.locator('#openDailyClosingModalBtn')).toBeVisible();

    // Home height dropped: 4,602 px with the grid on Home (measured at 390x844, demo seed)
    await page.waitForTimeout(1200);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(height).toBeLessThan(4400);
  });

  test('Mobile: More menu shows all 15 tool tiles with unclipped labels', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'More menu is the mobile navigation pattern');
    await page.goto('/');
    await openOpsTools(page);

    await expect(page.locator('#moreMenuOpsToolsDetails .quick-action-tile')).toHaveCount(15);
    await page.evaluate(() => document.fonts.ready);
    for (const selector of OPS_TILES) {
      const tile = page.locator(selector);
      await tile.scrollIntoViewIfNeeded();
      await expect(tile).toBeVisible();
      // Label text must wrap inside the tile, not clip: its box stays within
      // the tile's box and no single word overflows horizontally.
      const clipped = await tile.evaluate(el => {
        const label = el.querySelector('.quick-action-label');
        const t = el.getBoundingClientRect();
        const l = label.getBoundingClientRect();
        return l.left < t.left - 1 || l.right > t.right + 1 ||
               l.top < t.top - 1 || l.bottom > t.bottom + 1 ||
               label.scrollWidth > label.clientWidth + 1;
      });
      expect(clipped, `${selector} label is clipped`).toBe(false);
    }
  });

  test('Mobile: Record Expense, Monthly Report, Backup Ledger and Billing Audit work from the More menu', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'More menu is the mobile navigation pattern');
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/');

    // Record Expense -> Expenses screen, and the menu closes behind it
    await openOpsTools(page);
    await page.locator('#quickActionRecordExpense').click();
    await expect(page).toHaveURL(/#\/expenses$/);
    await expect(page.locator('#expensesView')).toBeVisible();
    await expect(page.locator('#mobileMoreMenu')).toBeHidden();
    await page.goto('/#/home');

    // Monthly Report -> Reports screen
    await openOpsTools(page);
    await page.locator('#quickActionMonthlyReports').click();
    await expect(page).toHaveURL(/#\/reports$/);
    await expect(page.locator('#billingReportsView')).toBeVisible();
    await expect(page.locator('#mobileMoreMenu')).toBeHidden();
    await page.goto('/#/home');

    // Backup Ledger -> backup controls panel opens
    await openOpsTools(page);
    await page.locator('#quickActionBackupData').click();
    await expect(page.locator('#mobileMoreMenu')).toBeHidden();
    await expect(page.locator('#backupControls')).toBeVisible();
    await page.goto('/#/home');

    // Billing Audit -> dialog opens from the menu and closes cleanly
    await openOpsTools(page);
    const auditTile = page.locator('#quickActionBillingCorrectness');
    await auditTile.scrollIntoViewIfNeeded();
    await auditTile.click();
    const modal = page.locator('#billingCorrectnessModal');
    await expect(modal).toBeVisible();
    await expect(page.locator('#mobileMoreMenu')).toBeHidden();
    await page.locator('#closeBillingCorrectnessModalBtn').click();
    await expect(modal).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('Desktop: tools grid is not rendered on Home; Home essentials remain', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop layout check');
    await page.goto('/');
    await expect(page.locator('#dashboardSecondaryRegion')).toBeHidden();
    await expect(page.locator('#dashboardDataSafetyCard')).toHaveCount(0);
    await expect(page.locator('#openDailyClosingModalBtn')).toBeVisible();
  });
});
