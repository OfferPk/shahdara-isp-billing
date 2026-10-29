// SISP-41: PNG Receipt Button Integration in Customer Profile & Field Mode.
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Seeds one customer with dues through the app's own core helpers,
// then checks, at a real 360px viewport:
//   - after Cash Full in Field Mode, the receipt card shows a 1-tap
//     🖼️ PNG Receipt button (asserted visible only — clicking it would
//     open the share sheet / download, which the runner cannot dismiss);
//   - on the Customer Profile, the saved payment's history row shows the
//     same 1-tap PNG receipt button.
// The generator behind both buttons is the EXISTING SISP-6 path
// (generateReceiptPNG + shareOrDownloadPng); no new generator is built.
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

async function seedCustomer(page) {
  await page.evaluate(async () => {
    const core = await import('./core.js');
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    s = core.addCustomer(s, 'RAJA FAISAL', now, { phone: '+923001234567', mohalla: 'Barrian', zone: 'Barrian' });
    const raja = s.customers.at(-1);
    s = core.saveBillMonth(s, raja.id, { month, dueAmount: '3000', status: 'pending' });
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.waitForFunction(() => !!window.fieldModeController, { timeout: 20000 });
}

test('sisp-41: field receipt card and profile history row show the PNG receipt button', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedCustomer(page);

  // Field Mode: tap 1 selects the customer, tap 2 (Cash Full) collects —
  // the receipt card must show the 1-tap PNG Receipt button next to 58mm Slip.
  await page.locator('#fieldModeToggleBtn').click();
  await expect(page.locator('#fieldModeView')).toBeVisible();
  const cards = page.locator('#fieldModeCustomerList [data-field-customer-id]');
  await expect(cards).toHaveCount(1);
  await cards.first().click();
  await page.locator('#fieldModeActionPanel [data-field-action="cash"]').click();
  await expect(page.locator('#fieldModeActionPanel .field-mode-receipt')).toBeVisible();
  const fieldPngBtn = page.locator('#fieldModeActionPanel [data-field-action="pngReceipt"]');
  await expect(fieldPngBtn).toBeVisible();
  await expect(fieldPngBtn).toContainText('PNG Receipt');

  // Profile: the same saved payment's history row carries the PNG button.
  await page.locator('#fieldModeCloseBtn').click();
  await page.evaluate(() => { window.location.hash = '#/customers'; });
  await page.locator('.customer-card, [data-customer-row]').first().click();
  await expect(page.locator('[data-png-receipt]').first()).toBeVisible();

  expect(errors).toEqual([]);
});
