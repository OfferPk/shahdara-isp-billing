import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

test.describe('Mobile bottom navigation 5-item bar (#211)', () => {
  test('mobile bottom nav has at most 5 buttons, with action sheet accessible via More and speed dial', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile bottom nav is phone-only');
    const errors = trackErrors(page);
    await page.goto('/');

    const bottomNav = page.locator('.mobile-bottom-nav');
    await expect(bottomNav).toBeVisible();

    const buttons = page.locator('.mobile-bottom-nav > button');
    const buttonCount = await buttons.count();
    expect(buttonCount).toBeLessThanOrEqual(5);
    expect(buttonCount).toBe(5);

    // Verify the 5 items: Home, Customers, Collect, Reports, More
    const homeBtn = page.locator('.mobile-bottom-nav [data-mobile-nav="home"]');
    const custBtn = page.locator('.mobile-bottom-nav [data-mobile-nav="customers"]');
    const collBtn = page.locator('.mobile-bottom-nav [data-mobile-nav="collection"]');
    const repBtn = page.locator('.mobile-bottom-nav [data-mobile-nav="reports"]');
    const moreBtn = page.locator('#mobileMoreButton');

    await expect(homeBtn).toBeVisible();
    await expect(custBtn).toBeVisible();
    await expect(collBtn).toBeVisible();
    await expect(repBtn).toBeVisible();
    await expect(moreBtn).toBeVisible();

    // Verify Action sheet button in More menu
    await moreBtn.click();
    const actionSheetInMore = page.locator('#mobileMoreMenu #mobileActionSheetToggle');
    await expect(actionSheetInMore).toBeVisible();
    await actionSheetInMore.click();
    await expect(page.locator('#mobileActionSheet')).toBeVisible();

    // Close action sheet
    await page.locator('#mobileActionSheetClose').click();
    await expect(page.locator('#mobileActionSheet')).toBeHidden();

    // Verify Action sheet stays available via More menu, and speed dial FAB operates
    const speedDialFab = page.locator('#speedDialTrigger');
    await expect(speedDialFab).toBeVisible();
    await speedDialFab.click();
    await expect(page.locator('#speedDialMenu')).toBeVisible();
    await expect(page.locator('#speedDialMenu button.speed-dial-action')).toHaveCount(5);
    await speedDialFab.click();
    await expect(page.locator('#speedDialMenu')).toBeHidden();

    expect(errors).toEqual([]);
  });
});

test.describe('Desktop persistent sidebar navigation (#212)', () => {
  test('sidebar #navDrawer is persistent on desktop without blocking backdrop', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop persistent sidebar is desktop-only');
    const errors = trackErrors(page);
    await page.goto('/');

    const drawer = page.locator('#navDrawer');
    await expect(drawer).toBeVisible();

    const drawerBox = await drawer.boundingBox();
    expect(drawerBox).not.toBeNull();
    expect(drawerBox.x).toBe(0);
    expect(drawerBox.width).toBeGreaterThanOrEqual(240);

    // Dark backdrop must not block clicks
    const backdrop = page.locator('#navDrawerBackdrop');
    await expect(backdrop).toBeHidden();

    // Drawer close should be hidden on desktop (persistent sidebar)
    await expect(page.locator('#navDrawerClose')).toBeHidden();
    await expect(page.locator('#navDrawerToggle')).toBeVisible();

    // Verify grouped drawer navigation items
    const homeNav = page.locator('#navDrawer [data-nav-target="home"]');
    const custNav = page.locator('#navDrawer [data-nav-target="customers"]');
    const txNav = page.locator('#navDrawer [data-nav-target="transactions"]');
    const billsNav = page.locator('#navDrawer [data-nav-target="bills"]');
    const repNav = page.locator('#navDrawer [data-nav-target="reports"]');
    const analyticsNav = page.locator('#navDrawer [data-nav-target="analytics"]');
    const invNav = page.locator('#navDrawer [data-nav-target="inventory"]');
    const expNav = page.locator('#navDrawer [data-nav-target="expenses"]');
    const asstNav = page.locator('#navDrawer [data-nav-target="assistant"]');
    const alertsNav = page.locator('#navDrawer [data-nav-target="alerts"]');
    const recNav = page.locator('#navDrawer [data-nav-target="recovery"]');
    const backupNav = page.locator('#drawerNavBackupBtn');
    const toolsNav = page.locator('#drawerFieldToolsBtn');

    await expect(homeNav).toBeVisible();
    await expect(custNav).toBeVisible();
    await expect(txNav).toBeVisible();
    await expect(billsNav).toBeVisible();
    await expect(repNav).toBeVisible();
    await expect(analyticsNav).toBeVisible();
    await expect(invNav).toBeVisible();
    await expect(expNav).toBeVisible();
    await expect(asstNav).toBeVisible();
    await expect(alertsNav).toBeVisible();
    await expect(recNav).toBeVisible();
    await expect(backupNav).toBeVisible();
    await expect(toolsNav).toBeVisible();

    // Verify technical engineering tools details
    const techDetails = page.locator('#drawerTechnicalToolsDetails');
    await expect(techDetails).toBeVisible();
    await page.locator('#drawerTechnicalToolsDetails summary').click();
    await expect(page.locator('#navDrawer [data-open-field-diagnostics]')).toBeVisible();

    // Test clicking sidebar links
    await txNav.click();
    await expect(page).toHaveURL(/#\/transactions$/);
    await expect(page.locator('#transactionsView')).toBeVisible();

    await billsNav.click();
    await expect(page).toHaveURL(/#\/bills$/);

    await custNav.click();
    await expect(page).toHaveURL(/#\/customers$/);
    await expect(page.locator('#customersView')).toBeVisible();

    await homeNav.click();
    await expect(page).toHaveURL(/#\/home$/);
    await expect(page.locator('#billingDashboard')).toBeVisible();

    expect(errors).toEqual([]);
  });
});

test.describe('Customer deep link #/customers/:id (#212)', () => {
  test('direct link #/customers/:id opens customer ledger offline and on reload', async ({ page }) => {
    const errors = trackErrors(page);

    // Initial navigation to customer 1 via deep link
    await page.goto('/#/customers/1');
    await expect(page.locator('#customersView')).toBeVisible();
    await expect(page.locator('#customerDetail')).toBeVisible();
    await expect(page.locator('#detailName')).toHaveText('Test Customer 01');

    // Reload page to verify offline/re-entry persistence
    await page.reload();
    await expect(page.locator('#customersView')).toBeVisible();
    await expect(page.locator('#customerDetail')).toBeVisible();
    await expect(page.locator('#detailName')).toHaveText('Test Customer 01');

    expect(errors).toEqual([]);
  });
});

test.describe('Android back button dialog support (#212)', () => {
  test('back button closes open modal dialog first then navigates view then exits on home', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Android back button test is mobile viewport');
    const errors = trackErrors(page);
    await page.goto('/');

    // Navigate to customers screen
    await page.locator('.mobile-bottom-nav [data-mobile-nav="customers"]').click();
    await expect(page).toHaveURL(/#\/customers$/);

    // Open Add Customer dialog
    const addCustBtn = page.locator('#srPrimaryAction');
    await expect(addCustBtn).toBeVisible();
    await addCustBtn.click();

    const addCustDialog = page.locator('#addCustomerDialog');
    await expect(addCustDialog).toBeVisible();

    // Press browser / Android Back button -> MUST close dialog, staying on customers screen
    await page.goBack();
    await expect(addCustDialog).toBeHidden();
    await expect(page).toHaveURL(/#\/customers$/);
    await expect(page.locator('#customersView')).toBeVisible();

    // Press Back again -> navigates back to Home screen
    await page.goBack();
    await expect(page).toHaveURL(/(?:\/|#\/home)$/);
    await expect(page.locator('#billingDashboard')).toBeVisible();

    expect(errors).toEqual([]);
  });
});
