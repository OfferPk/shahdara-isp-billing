// Issue #381: regression from the #366 single-scroll fix — when the
// worklist is long, the flex column squeezes .worklist-tabs to a ~10px
// strip (clientHeight 10 vs scrollHeight 52), making the To Disconnect /
// To Reconnect / Rules tabs invisible and unclickable. The list must be
// the only element that gives up height. This spec pins the tab row's
// geometry with a full 74-customer overdue list, on mobile and desktop,
// and confirms the tabs still switch panes.
import { test, expect } from '@playwright/test';

async function seedAndOpenWorklists(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.evaluate(() => window.collectSetup?.open());
  await page.locator('#collectSetupSelectAll').check();
  await page.locator('#collectSetupApplyBtn').click();
  await page.waitForSelector('#collectSetupModal', { state: 'hidden', timeout: 20000 });
  await page.evaluate(() => document.getElementById('openWorklistsModalBtn')?.click());
  await expect(page.locator('#workListModal')).toBeVisible();
  await expect(page.locator('#worklistDisconnectList .worklist-item').first()).toBeVisible({ timeout: 20000 });
}

test.describe('Issue 381: worklist tabs keep their height with a long list', () => {
  test.setTimeout(180000);

  test('tabs stay full height and clickable; only the list scrolls', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
    await seedAndOpenWorklists(page);
    const geo = await page.evaluate(() => {
      const tabs = document.querySelector('.worklist-tabs');
      const header = document.querySelector('.worklist-modal-header');
      const footer = document.querySelector('.worklist-modal-footer');
      const rows = document.querySelectorAll('#worklistDisconnectList .worklist-item').length;
      return {
        tabsClient: tabs.clientHeight, tabsScroll: tabs.scrollHeight,
        headerClient: header.clientHeight, footerClient: footer.clientHeight,
        rows
      };
    });
    expect(geo.rows).toBeGreaterThanOrEqual(10);
    expect(geo.tabsClient).toBeGreaterThanOrEqual(40);
    expect(geo.tabsScroll - geo.tabsClient).toBeLessThanOrEqual(2);
    expect(geo.headerClient).toBeGreaterThanOrEqual(40);
    expect(geo.footerClient).toBeGreaterThanOrEqual(30);
    // Tabs actually work: switch to Reconnect and Rules panes.
    await page.locator('.worklist-tab-btn[data-tab="reconnect"]').click();
    await expect(page.locator('#worklistReconnectPane')).toBeVisible();
    await page.locator('.worklist-tab-btn[data-tab="rules"]').click();
    await expect(page.locator('#worklistRulesPane')).toBeVisible();
    await page.locator('.worklist-tab-btn[data-tab="disconnect"]').click();
    await expect(page.locator('#worklistDisconnectPane')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
