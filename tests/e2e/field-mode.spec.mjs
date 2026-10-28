// SISP-5: 1-Thumb Mobile "Field Collection Mode".
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Seeds two customers with dues through the app's own core helpers,
// then checks, at a real 360px viewport:
//   - the header toggle opens the full-screen field-mode overlay with ZERO
//     horizontal scroll (spec criterion 1);
//   - the Area / Zone filter narrows the list and shows the live remaining
//     target for the selected zone;
//   - search -> tap customer (tap 1) -> tap Cash Full (tap 2) produces the
//     receipt card with the WA Receipt link (spec criterion 2);
//   - the overlay background is dark in dark mode (standing dark-mode rule).
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  return errors;
}

async function boot(page) {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/#/home');
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.waitForFunction(() => !!window.fieldModeController, { timeout: 20000 });
}

async function seedCustomers(page) {
  await page.evaluate(async () => {
    const core = await import('./core.js');
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    s = core.addCustomer(s, 'FIELD ALI', now, { phone: '+923001234567', mohalla: 'Barrian', zone: 'Barrian' });
    const ali = s.customers.at(-1);
    s = core.saveBillMonth(s, ali.id, { month, dueAmount: '3000', status: 'pending' });
    s = core.addCustomer(s, 'FIELD BILAL', now, { phone: '+923009998877', mohalla: 'Shahdara Town', zone: 'Shahdara Town' });
    const bilal = s.customers.at(-1);
    s = core.saveBillMonth(s, bilal.id, { month, dueAmount: '3000', status: 'pending' });
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.waitForFunction(() => !!window.fieldModeController, { timeout: 20000 });
}

async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
}

async function openFieldMode(page) {
  await page.locator('#fieldModeToggleBtn').click();
  await expect(page.locator('#fieldModeView')).toBeVisible();
}

test('field mode: 360px zero scroll, zone target, 2-tap search-to-receipt', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedCustomers(page);
  await openFieldMode(page);

  // Spec criterion 1: zero horizontal scroll at 360px.
  await assertNoHorizontalOverflow(page);

  // Both seeded customers are pending: 2 cards, combined target PKR 6,000.
  await expect(page.locator('#fieldModeCustomerList [data-field-customer-id]')).toHaveCount(2);
  await expect(page.locator('#fieldModeZoneTarget')).toContainText('PKR 6,000');

  // Zone filter narrows to Barrian only, with its live target.
  await page.locator('#fieldModeZoneFilters [data-field-zone]', { hasText: 'Barrian' }).first().click();
  await expect(page.locator('#fieldModeCustomerList [data-field-customer-id]')).toHaveCount(1);
  await expect(page.locator('#fieldModeZoneTarget')).toContainText('Barrian');
  await expect(page.locator('#fieldModeZoneTarget')).toContainText('PKR 3,000');
  await assertNoHorizontalOverflow(page);

  // Back to all areas, then search for FIELD ALI.
  await page.locator('#fieldModeZoneFilters [data-field-zone]', { hasText: 'All areas' }).first().click();
  await page.locator('#fieldModeSearchInput').fill('FIELD ALI');
  await expect(page.locator('#fieldModeCustomerList [data-field-customer-id]')).toHaveCount(1);

  // Tap 1: select the customer card -> action panel with Cash Full.
  await page.locator('#fieldModeCustomerList [data-field-customer-id]').first().click();
  const cashBtn = page.locator('#fieldModeActionPanel [data-field-action="cash"]');
  await expect(cashBtn).toBeVisible();
  await expect(cashBtn).toContainText('PKR 3,000');

  // Tap 2: Cash Full -> receipt card with the WA Receipt link (spec criterion 2).
  await cashBtn.click();
  await expect(page.locator('#fieldModeActionPanel .field-mode-receipt')).toBeVisible();
  await expect(page.locator('#fieldModeActionPanel .field-mode-receipt')).toContainText('PAID IN FULL');
  const waHref = await page.locator('#fieldModeActionPanel .field-mode-whatsapp-btn').getAttribute('href');
  expect(waHref).toContain('wa.me/923001234567');

  // Next customer: the settled customer leaves the pending list.
  await page.locator('#fieldModeActionPanel [data-field-action="next"]').click();
  await page.locator('#fieldModeSearchInput').fill('');
  await expect(page.locator('#fieldModeCustomerList [data-field-customer-id]')).toHaveCount(1);
  await assertNoHorizontalOverflow(page);

  expect(errors).toEqual([]);
});

test('field mode: overlay background is dark in dark mode', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedCustomers(page);
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await openFieldMode(page);
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('#fieldModeView')).backgroundColor);
  const channels = bg.match(/\d+/g).map(Number);
  expect(Math.max(...channels)).toBeLessThan(80);
  await assertNoHorizontalOverflow(page);
  expect(errors).toEqual([]);
});
