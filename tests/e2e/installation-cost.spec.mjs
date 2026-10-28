// SISP-23: New Connection Installation Cost & First-Month Profitability
// Tracker. Written to run in CI (the repo Playwright runner cannot run in
// the dev VM). Seeds the verbatim spec case on the first saved customer —
// fee 2500, router 2200, 100 m fiber at Rs. 12/m, monthly amount 1000 —
// and checks the subsidy badge appears both on the New Customers ledger
// row and in the profile Connection group, with a 1-bill break-even.
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  return errors;
}

async function seedInstallCostCustomer(page) {
  await page.goto('/#/home');
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.evaluate(async () => {
    const core = await import('./core.js');
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const c = s.customers[0];
    // Joined this month so the row shows in the default "this month" view.
    c.addedOn = new Date().toISOString().slice(0, 10);
    c.connectionFee = 2500;
    c.routerPrice = 2200;
    c.fiberMeters = 100;
    c.fiberPerMeterRate = 12;
    c.monthlySellingAmount = 1000;
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

test('installation cost: ledger row and profile show the Rs. 900 subsidy with 1-bill break-even', async ({ page }) => {
  const errors = trackErrors(page);
  await seedInstallCostCustomer(page);
  await page.goto('/#/customers');
  await expect(page.locator('#newCustomersPanel')).toBeVisible();
  const panel = page.locator('#newCustomersPanel');
  await expect(panel.locator('.new-customers-list')).toContainText('ISP subsidy');
  await expect(panel.locator('.new-customers-list')).toContainText('PKR 900');
  await expect(panel.locator('.new-customers-list')).toContainText('break-even 1 bill');
  // Open the profile from the customers list and read the Connection group.
  await page.locator('.customer-profile-card-open').first().click();
  await expect(page.locator('#profileTabInfo')).toBeVisible();
  await page.locator('#profileTabInfo').click();
  const profile = page.locator('#customerProfileView');
  await expect(profile).toContainText('Installation cost & profitability');
  await expect(profile).toContainText('ISP Hardware Subsidy');
  await expect(profile).toContainText('PKR 900');
  await expect(profile).toContainText('break-even in 1 monthly bill');
  expect(errors).toEqual([]);
});
