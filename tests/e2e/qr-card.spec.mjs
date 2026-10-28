// SISP-14: QR Khata Card & Deep-Link Shop Counter Lookup.
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Seeds one customer into the real ledger key, then checks the profile
// QR card modal (canvas renders, link carries ?customer=[id]&action=pay),
// the ?customer= deep link opening profile vs payment modal on app load,
// the unknown-id toast, and 390px no-overflow.
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
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

async function seedCustomer(page) {
  await page.evaluate(() => {
    const state = {
      version: 1,
      nextCustomerNumber: 43,
      customers: [{
        id: 'cust-qr1',
        customerNumber: 42,
        name: 'QR TEST CUSTOMER',
        mohalla: 'Shahdara',
        zone: 'Side 1',
        address: '',
        phone: '',
        ispProvider: '',
        serviceStatus: 'active',
        packageSpeed: '5Mbps',
        monthlyPurchaseCost: null,
        monthlySellingAmount: 1500,
        monthlyPriceSchedule: [],
        billingStartMonth: null,
        connectionDate: null,
        expiryDate: null,
        cancellationDate: null,
        packageHistory: [],
        archived: false,
        archivedAt: null,
        bills: [],
        incidents: []
      }],
      inventoryItems: [],
      inventoryMovements: [],
      expenses: [],
      saadAttendanceDays: [],
      umairWorkdays: [],
      monthlyClosings: []
    };
    localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify(state));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

test('profile QR card modal renders the canvas and the deep link', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedCustomer(page);

  await page.click('#customerList [data-customer-id="cust-qr1"]');
  await page.click('#profileQrCardButton');
  await expect(page.locator('#qrKhataCardModal')).toBeVisible();
  await expect(page.locator('#qrKhataCardName')).toContainText('QR TEST CUSTOMER');
  await expect(page.locator('#qrKhataCardConnection')).toContainText('#42');
  await expect(page.locator('#qrKhataCardRate')).toContainText('1,500');
  await expect(page.locator('#qrKhataCardShops')).toContainText('Waseem Abbasi Shop');
  await expect(page.locator('#qrKhataCardShops')).toContainText('Hassan Shop');
  const canvas = page.locator('#qrKhataCardCanvas');
  await expect(canvas).toBeVisible();
  const width = await canvas.evaluate((el) => el.width);
  expect(width).toBeGreaterThan(0);
  const link = await page.locator('#qrKhataCardLink').textContent();
  expect(link).toContain('?customer=cust-qr1&action=pay');
  expect(link).not.toContain('1500');
  await expect(page.locator('#qrKhataCardPngBtn')).toBeEnabled();
  expect(errors).toEqual([]);
});

test('deep link ?customer=[id]&action=pay opens the payment modal on load', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedCustomer(page);

  await page.goto('/?customer=cust-qr1&action=pay');
  await expect(page.locator('#quickCollectModal')).toBeVisible({ timeout: 20000 });
  expect(errors).toEqual([]);
});

test('deep link ?customer=[id] without action opens the profile; unknown id toasts', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedCustomer(page);

  await page.goto('/?customer=cust-qr1');
  await expect(page.locator('#customerDetail')).toBeVisible({ timeout: 20000 });

  await page.goto('/?customer=cust-nope&action=pay');
  await expect(page.locator('#toast')).toContainText('Customer not found', { timeout: 20000 });
  expect(errors).toEqual([]);
});

test('QR card modal has no horizontal overflow at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  await seedCustomer(page);
  await page.click('#customerList [data-customer-id="cust-qr1"]');
  await page.click('#profileQrCardButton');
  await expect(page.locator('#qrKhataCardModal')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});
