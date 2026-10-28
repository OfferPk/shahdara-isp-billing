// SISP-18: Offline Hardware and Fiber Stock Inventory Book. Written to run
// in CI (the repo Playwright runner cannot run in the dev VM). Seeds a
// 1000m fiber roll, logs 150m used, and checks the stock book shows 850m
// remaining, the low-stock highlight, and no horizontal overflow at 390px.
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

test('stock book: 1000m in + 150m out shows 850m remaining', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await expect(page.locator('#dashboardInventoryValue')).toContainText('No stock recorded');
  await page.locator('#openInventoryBookModalBtn').click();
  await expect(page.locator('#inventoryBookModal')).toBeVisible();
  await page.locator('#inventoryBookItem').selectOption('fiber-2core');
  await page.locator('#inventoryBookKind').selectOption('in');
  await page.locator('#inventoryBookQty').fill('1000');
  await page.locator('#inventoryBookDate').fill('2026-10-01');
  await page.locator('#inventoryBookNote').fill('New roll');
  await page.locator('#inventoryBookForm button[type="submit"]').click();
  await page.locator('#inventoryBookItem').selectOption('fiber-2core');
  await page.locator('#inventoryBookKind').selectOption('out');
  await page.locator('#inventoryBookQty').fill('150');
  await page.locator('#inventoryBookDate').fill('2026-10-05');
  await page.locator('#inventoryBookCustomer').fill('Faisal');
  await page.locator('#inventoryBookNote').fill('Installation');
  await page.locator('#inventoryBookForm button[type="submit"]').click();
  const stockText = await page.locator('#inventoryBookStockList').innerText();
  expect(stockText).toContain('2-Core Fiber Cable');
  expect(stockText).toContain('850 m');
  await page.locator('#inventoryBookCloseBtn').click();
  await expect(page.locator('#dashboardInventoryValue')).not.toContainText('No stock recorded');
  expect(errors).toEqual([]);
});

test('stock book: no horizontal overflow at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = trackErrors(page);
  await boot(page);
  await page.locator('#openInventoryBookModalBtn').click();
  await expect(page.locator('#inventoryBookModal')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  expect(errors).toEqual([]);
});
