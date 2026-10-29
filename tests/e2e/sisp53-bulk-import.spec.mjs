// SISP-53: Bulk Customer CSV / Excel Paste Import Wizard & Duplicate Guard.
// Written to run in CI (the repo Playwright runner cannot run in the
// dev VM). The spec drives the real wizard dialog — no camera, no network —
// and checks:
//  - the [📋 Excel/CSV] button opens the wizard on the Customers pane;
//  - pasting a header CSV with 2 valid rows and 1 duplicate Connection ID
//    row previews 2 rows as OK and flags the duplicate row as Duplicate ID;
//  - importing adds exactly the 2 valid customers, keeps their register
//    Connection IDs, stores +92 phones and Urdu names, and skips the
//    duplicate row;
//  - the dialog fits a 360px phone with no horizontal overflow.
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (m) => errors.push(m.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  return errors;
}

async function boot(page) {
  await page.goto('/#/home');
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

async function seedCustomers(page) {
  await page.evaluate(() => {
    const state = {
      version: 1,
      nextCustomerNumber: 13,
      customers: [{
        id: 'seed-bci-12', customerNumber: 12, name: 'SEED BCI TWELVE',
        phone: '03001234567', mohalla: 'BARRIAN', archived: false, bills: []
      }]
    };
    localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify(state));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

test('SISP-53: Excel/CSV wizard imports valid rows, keeps Connection IDs, flags the duplicate', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedCustomers(page);

  await page.click('#bulkImportOpenBtn');
  await expect(page.locator('#bulkImportModal')).toBeVisible();
  await page.fill('#bciText',
    'Connection ID,Name,Phone,Package,Fee,Area\n' +
    '101,ALI KHAN,03001112233,15Mbps Unlimited,3000,BARRIAN\n' +
    '102,SAIM RAZA,+923214567890,5Mbps / 150GB,1500,PALALIYAA\n' +
    '12,DUPLICATE ID,03009998877,5Mbps / 150GB,1500,BARRIAN');
  await page.click('#bciPreviewBtn');
  await expect(page.locator('#bciRows')).toContainText('ALI KHAN');
  await expect(page.locator('#bciRows')).toContainText('Duplicate ID');
  const dupRow = page.locator('#bciRows li', { hasText: 'DUPLICATE ID' });
  await expect(dupRow).toContainText('Duplicate ID');
  await expect(dupRow.locator('[data-bci-include]')).toBeDisabled();

  await page.click('#bciImportBtn');
  await expect(page.locator('#bciDoneTitle')).toContainText('Added 2 customers');
  const added = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('shahdara-isp-billing-v1'));
    return state.customers
      .filter(c => [101, 102].includes(c.customerNumber))
      .map(c => ({ n: c.customerNumber, phone: c.phone, urdu: c.nameUrdu }));
  });
  expect(added).toHaveLength(2);
  expect(added[0].phone).toBe('+923001112233');
  expect(added[0].urdu).toMatch(/[\u0600-\u06FF]/);
  expect(added[1].phone).toBe('+923214567890');
  const dupAdded = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('shahdara-isp-billing-v1'));
    return state.customers.some(c => c.name === 'DUPLICATE ID');
  });
  expect(dupAdded).toBe(false);

  await page.click('#bciDoneBtn');
  await expect(page.locator('#bulkImportModal')).toBeHidden();
  expect(errors).toEqual([]);
});

test('SISP-53: import dialog fits a 360px phone without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await boot(page);
  await page.click('#bulkImportOpenBtn');
  await expect(page.locator('#bulkImportModal')).toBeVisible();
  const overflow = await page.evaluate(() => {
    const dialog = document.getElementById('bulkImportModal');
    return {
      scrollWidth: dialog.scrollWidth,
      clientWidth: dialog.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      innerWidth: window.innerWidth
    };
  });
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
  expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.innerWidth);
  await page.keyboard.press('Escape');
});
