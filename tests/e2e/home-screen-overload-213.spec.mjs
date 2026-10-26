import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  return errors;
}

async function setupMocks(page) {
  await page.addInitScript(() => {
    window.SpeechRecognition = window.SpeechRecognition || class MockSpeech {
      start() {}
      stop() {}
      abort() {}
      static available() { return true; }
    };
    window.webkitSpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
  });
}

test.describe('Issue #213: Home Screen Overload & Navigation Redesign', () => {

  test('Mobile 390x844: KPI strip and 4 primary actions are completely above the fold (< 844px)', async ({ page }) => {
    const errors = trackErrors(page);
    await setupMocks(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const kpiStrip = page.locator('#homeKpiStrip');
    await expect(kpiStrip).toBeVisible();

    // Verify 4 KPI cards
    await expect(page.locator('#kpiTodayCollection')).toBeVisible();
    await expect(page.locator('#kpiMonthCollectionBilled')).toBeVisible();
    await expect(page.locator('#kpiTotalDue')).toBeVisible();
    await expect(page.locator('#kpiCustomersWithDues')).toBeVisible();

    const primaryActions = page.locator('#homePrimaryActions');
    await expect(primaryActions).toBeVisible();

    // Check vertical coordinate: all 4 primary actions must fit well above 844px fold
    const primaryBox = await primaryActions.boundingBox();
    expect(primaryBox).not.toBeNull();
    const bottomY = primaryBox.y + primaryBox.height;
    expect(bottomY).toBeLessThan(844); // Fits 100% above the 844px mobile viewport fold

    // Check no horizontal scrollbar
    const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasHorizontalScroll).toBe(false);

    expect(errors).toEqual([]);
  });

  test('4 primary actions execute real workflows end-to-end', async ({ page }) => {
    const errors = trackErrors(page);
    await setupMocks(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // 1. Payment lo -> Quick Collect modal
    const payLoBtn = page.locator('#quickActionReceivePayment');
    await expect(payLoBtn).toBeVisible();
    await expect(payLoBtn).toContainText('Payment lo');
    await payLoBtn.click();
    const collectModal = page.locator('#quickCollectModal');
    await expect(collectModal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(collectModal).toBeHidden();

    // 2. Customer add -> Add Customer dialog
    const custAddBtn = page.locator('#quickActionAddCustomer');
    await expect(custAddBtn).toBeVisible();
    await expect(custAddBtn).toContainText('Customer add');
    await custAddBtn.click();
    const addCustDialog = page.locator('#addCustomerDialog');
    await expect(addCustDialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(addCustDialog).toBeHidden();

    // 3. Dues list -> Dues Recovery view
    const duesBtn = page.locator('#homeActionDuesList');
    await expect(duesBtn).toBeVisible();
    await expect(duesBtn).toContainText('Dues list');
    await duesBtn.click();
    await expect(page).toHaveURL(/#\/recovery$/);
    await expect(page.locator('#duesRecoveryPanel')).toBeVisible();

    // Return Home
    await page.goto('/#/home');

    // 4. Aaj ka hisaab -> Daily Closing modal
    const closingBtn = page.locator('#quickActionDailyClosing');
    await expect(closingBtn).toBeVisible();
    await expect(closingBtn).toContainText('Aaj ka hisaab');
    await closingBtn.click();
    const closingModal = page.locator('#dailyClosingModal');
    await expect(closingModal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(closingModal).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('Quick-action speed dial sheet: <= 8 billing actions, opens on tap and closes on outside tap/Esc/Back', async ({ page }) => {
    const errors = trackErrors(page);
    await setupMocks(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const speedDial = page.locator('#mobileSpeedDial');
    const menu = page.locator('#speedDialMenu');
    const trigger = page.locator('#speedDialTrigger');
    const backdrop = page.locator('#speedDialBackdrop');

    await expect(speedDial).toBeVisible();
    await expect(menu).toBeHidden();

    // Verify sheet items <= 8
    const actions = menu.locator('button[role="menuitem"]');
    const actionCount = await actions.count();
    expect(actionCount).toBeLessThanOrEqual(8);
    expect(actionCount).toBeGreaterThanOrEqual(4);

    // 1. Opens on tap
    await trigger.click();
    await expect(menu).toBeVisible();

    // 2. Closes on backdrop / outside tap
    await backdrop.click({ position: { x: 10, y: 10 }, force: true });
    await expect(menu).toBeHidden();

    // 3. Opens on tap, closes on Escape
    await trigger.click();
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    // 4. Opens on tap, closes on Back navigation
    await page.evaluate(() => history.pushState({}, '', '#dummy'));
    await trigger.click();
    await expect(menu).toBeVisible();
    await page.goBack();
    await expect(menu).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('More menu: organized into semantic groups and includes Field Tools', async ({ page }) => {
    const errors = trackErrors(page);
    await setupMocks(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const moreBtn = page.locator('#mobileMoreButton');
    await expect(moreBtn).toBeVisible();
    await moreBtn.click();

    const moreMenu = page.locator('#mobileMoreMenu');
    await expect(moreMenu).toBeVisible();

    // Verify the section headers exist. The menu was regrouped from four
    // sections (Reports / Money / Customers / Settings) into three broader
    // ones; every destination from the old groups is still present.
    const labels = moreMenu.locator('.more-menu-section-label');
    await expect(labels).toHaveCount(3);
    // Assert the runtime (i18n) texts, which replace the static HTML ones.
    await expect(labels.nth(0)).toContainText('Reports & Analytics');
    await expect(labels.nth(1)).toContainText('Customers & Data');
    await expect(labels.nth(2)).toContainText('Settings & Tools');

    // Verify Field Tools button in More
    const fieldToolsBtn = page.locator('#mobileMoreFieldToolsBtn');
    await expect(fieldToolsBtn).toBeVisible();
    await fieldToolsBtn.click();

    const fieldToolsModal = page.locator('#fieldToolsModal');
    await expect(fieldToolsModal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(fieldToolsModal).toBeHidden();

    // Verify outside tap closes more menu
    await moreBtn.click();
    await expect(moreMenu).toBeVisible();
    await page.mouse.click(10, 10);
    await expect(moreMenu).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('Inventory test: every previously available tool is preserved and accessible', async ({ page }) => {
    const errors = trackErrors(page);
    await setupMocks(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // The 4 primary Home actions are still visible directly on Home
    const primaryTiles = [
      '#quickActionReceivePayment',
      '#quickActionAddCustomer',
      '#homeActionDuesList',
      '#quickActionDailyClosing'
    ];
    for (const selector of primaryTiles) {
      await expect(page.locator(selector)).toBeVisible();
    }

    // The 15 Operations & Intelligence tiles moved off Home into the More menu
    // (#278 follow-up): still present in the document at desktop size...
    const opsTiles = [
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
    for (const selector of opsTiles) {
      await expect(page.locator(selector)).toBeAttached();
    }
    await expect(page.locator('#dashboardSecondaryRegion')).toBeHidden();

    // ...and visible + operable at mobile size via More -> Operations & Intelligence Tools
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#mobileMoreButton').click();
    await page.locator('#moreMenuOpsToolsDetails summary').click();
    for (const selector of opsTiles) {
      const tile = page.locator(selector);
      await tile.scrollIntoViewIfNeeded();
      await expect(tile).toBeVisible();
    }
    await page.keyboard.press('Escape');
    await expect(page.locator('#mobileMoreMenu')).toBeHidden();

    // Verify Field Tools screen opens via #/field-tools
    await page.goto('/#/field-tools');
    const fieldToolsModal = page.locator('#fieldToolsModal');
    await expect(fieldToolsModal).toBeVisible();

    expect(errors).toEqual([]);
  });

});
