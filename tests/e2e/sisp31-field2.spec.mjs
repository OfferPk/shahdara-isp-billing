// SISP-31: Field Collection Mode 2.0 — bilingual search, 58mm slip button,
// zone "Collected Today" pill.
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Seeds two customers with dues through the app's own core helpers,
// then checks, at a real 360px viewport:
//   - typing راجہ and typing Raja return the exact same customer card;
//   - after Cash Full, the receipt card shows a 1-tap 58mm Slip button
//     (asserted visible only — clicking it would open the system print
//     dialog, which the runner cannot dismiss);
//   - the zone target's "Collected Today" pill updates immediately to
//     1 house after the collection.
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
    s = core.addCustomer(s, 'Test Customer 34', now, { phone: '+923001234567', mohalla: 'Barrian', zone: 'Barrian' });
    const raja = s.customers.at(-1);
    s = core.saveBillMonth(s, raja.id, { month, dueAmount: '3000', status: 'pending' });
    s = core.addCustomer(s, 'ALI KHAN', now, { phone: '+923009998877', mohalla: 'Shahdara Town', zone: 'Shahdara Town' });
    const ali = s.customers.at(-1);
    s = core.saveBillMonth(s, ali.id, { month, dueAmount: '3000', status: 'pending' });
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.waitForFunction(() => !!window.fieldModeController, { timeout: 20000 });
}

test('field mode 2.0: bilingual search, 58mm slip button, collected-today pill', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedCustomers(page);
  await page.locator('#fieldModeToggleBtn').click();
  await expect(page.locator('#fieldModeView')).toBeVisible();

  // Pill starts at zero before any collection today.
  await expect(page.locator('#fieldModeZoneTarget')).toContainText('Collected Today');
  await expect(page.locator('#fieldModeZoneTarget')).toContainText('0 houses');

  // Urdu query finds Test Customer 34; capture the card id.
  await page.locator('#fieldModeSearchInput').fill('راجہ');
  const cards = page.locator('#fieldModeCustomerList [data-field-customer-id]');
  await expect(cards).toHaveCount(1);
  const urduCardId = await cards.first().getAttribute('data-field-customer-id');

  // Roman query finds the exact same card.
  await page.locator('#fieldModeSearchInput').fill('Raja');
  await expect(cards).toHaveCount(1);
  const romanCardId = await cards.first().getAttribute('data-field-customer-id');
  expect(romanCardId).toBe(urduCardId);

  // Tap 1: select; tap 2: Cash Full -> receipt card with the 58mm Slip button.
  await cards.first().click();
  const cashBtn = page.locator('#fieldModeActionPanel [data-field-action="cash"]');
  await expect(cashBtn).toBeVisible();
  await cashBtn.click();
  await expect(page.locator('#fieldModeActionPanel .field-mode-receipt')).toBeVisible();
  const slipBtn = page.locator('#fieldModeActionPanel [data-field-action="print58"]');
  await expect(slipBtn).toBeVisible();
  await expect(slipBtn).toContainText('58mm Slip');

  // Back to the list: the pill updates immediately to 1 house.
  await page.locator('#fieldModeActionPanel [data-field-action="next"]').click();
  await page.locator('#fieldModeSearchInput').fill('');
  await expect(page.locator('#fieldModeZoneTarget')).toContainText('Collected Today in All areas: 1 houses');
  await expect(page.locator('#fieldModeZoneTarget')).toContainText('PKR 3,000');

  expect(errors).toEqual([]);
});
