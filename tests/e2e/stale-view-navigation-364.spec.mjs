// #364: leaving a screen via browser Back, the desktop sidebar/drawer or a
// hash link left the previous screen's whole panel visible under the next
// one, because those paths never ran the app's switchView() cleanup. The
// screen router's apply() now enforces exactly one visible main view (and
// synced tab / bottom-nav highlights) on every navigation path.
import { test, expect } from '@playwright/test';

const APP_VIEWS = ['customersView', 'transactionsView', 'billingReportsView', 'analyticsView', 'inventoryView', 'expensesView'];

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

async function hiddenStates(page) {
  return page.evaluate(ids => Object.fromEntries(ids.map(id => {
    const el = document.getElementById(id);
    return [id, el ? el.hidden : null];
  })), APP_VIEWS);
}

async function expectOnlyView(page, visibleId) {
  const states = await hiddenStates(page);
  for (const id of APP_VIEWS) {
    if (id === visibleId) expect(states[id], `${id} should be un-hidden`).toBe(false);
    else expect(states[id], `${id} should be hidden`).toBe(true);
  }
}

async function openFromDrawer(page, target) {
  const drawer = page.locator('#navDrawer');
  if (await drawer.isVisible()) {
    await page.locator(`#navDrawer [data-nav-target="${target}"]`).click();
  } else {
    await page.locator('#navDrawerToggle').click();
    await page.locator(`#navDrawer [data-nav-target="${target}"]`).click();
  }
}

test.describe('#364 stale view after Back / sidebar / hash navigation', () => {
  test.setTimeout(120000);
  test('mobile: bottom-nav Reports then browser Back shows Home only', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile Back path');
    const errors = trackErrors(page);
    await page.goto('/#/home');
    await expect(page.locator('#billingDashboard')).toBeVisible();

    await page.locator('[data-mobile-nav="reports"]').click();
    await expect(page.locator('#srScreenTitle')).toHaveText('Monthly Report');
    await expectOnlyView(page, 'billingReportsView');
    const reportsHeight = await page.evaluate(() => document.documentElement.scrollHeight);

    await page.goBack();
    await expect(page.locator('#srScreenHeader')).toBeHidden();
    await expect(page.locator('#billingDashboard')).toBeVisible();
    const states = await hiddenStates(page);
    expect(states.billingReportsView, 'reports view must be hidden again after Back').toBe(true);
    const homeHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(homeHeight, 'Home must not keep the reports panel underneath').toBeLessThan(reportsHeight);
    expect(errors).toEqual([]);
  });

  test('desktop: sidebar Analytics then Home hides the Analytics view', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop sidebar path');
    const errors = trackErrors(page);
    await page.goto('/#/home');
    await expect(page.locator('#billingDashboard')).toBeVisible();

    await openFromDrawer(page, 'analytics');
    await expect(page.locator('#srScreenTitle')).toHaveText('Area Analytics');
    await expectOnlyView(page, 'analyticsView');

    await openFromDrawer(page, 'home');
    await expect(page.locator('#srScreenHeader')).toBeHidden();
    await expect(page.locator('#billingDashboard')).toBeVisible();
    const states = await hiddenStates(page);
    expect(states.analyticsView, 'analytics view must be hidden again on Home').toBe(true);
    expect(errors).toEqual([]);
  });

  test('desktop: sidebar Transactions then Backup shows the backup panel only', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop sidebar path');
    const errors = trackErrors(page);
    await page.goto('/#/home');

    await openFromDrawer(page, 'transactions');
    await expect(page.locator('#srScreenTitle')).toHaveText('Transactions');
    await expectOnlyView(page, 'transactionsView');
    await expect(page.locator('#showTransactionsButton')).toHaveAttribute('aria-current', 'page');

    await openFromDrawer(page, 'backup');
    await expect(page.locator('#srScreenTitle')).toHaveText('Backup & Restore');
    const states = await hiddenStates(page);
    expect(states.transactionsView, 'transactions view must not stay above the backup panel').toBe(true);
    await expect(page.locator('#backupControls')).toBeVisible();
    await expect(page.locator('#showTransactionsButton')).toHaveAttribute('aria-current', 'false');
    expect(errors).toEqual([]);
  });

  test('hash navigation: #/expenses then #/assistant hides the Expenses view', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/#/expenses');
    await expect(page.locator('#srScreenTitle')).toHaveText('Expenses');
    await expectOnlyView(page, 'expensesView');

    await page.evaluate(() => { window.location.hash = '#/assistant'; });
    await expect(page.locator('#srScreenTitle')).toHaveText('Owner Assistant');
    await expect(page.locator('#ownerCommandCenter')).toBeVisible();
    const states = await hiddenStates(page);
    expect(states.expensesView, 'expenses view must be hidden on the Assistant screen').toBe(true);
    expect(errors).toEqual([]);
  });

  test('hash navigation: #/transactions then #/home hides the Transactions view', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/#/transactions');
    await expect(page.locator('#srScreenTitle')).toHaveText('Transactions');
    await expectOnlyView(page, 'transactionsView');

    await page.evaluate(() => { window.location.hash = '#/home'; });
    await expect(page.locator('#srScreenHeader')).toBeHidden();
    await expect(page.locator('#billingDashboard')).toBeVisible();
    const states = await hiddenStates(page);
    expect(states.transactionsView, 'transactions view must be hidden on Home').toBe(true);
    expect(errors).toEqual([]);
  });

  test('shared reports view: Reports then Dues Recovery keeps billingReportsView, others hidden', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/#/reports');
    await expectOnlyView(page, 'billingReportsView');

    await page.evaluate(() => { window.location.hash = '#/recovery'; });
    await expect(page.locator('#srScreenTitle')).toHaveText('Dues Recovery');
    await expectOnlyView(page, 'billingReportsView');
    await expect(page.locator('#billingReportsView')).toHaveAttribute('data-report-screen', 'recovery');
    expect(errors).toEqual([]);
  });
});
