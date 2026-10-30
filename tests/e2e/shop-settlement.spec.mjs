// SISP-1: Shop Collector Cash Handover & Settlement Ledger.
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Seeds a shop payment through the app's own core helpers, then checks
// the dashboard shop card, the settlement modal drilldown, a partial
// handover, and that the settlement record survives in sisp_shop_settlements_v1.
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

async function seedShopPayment(page) {
  await page.evaluate(async () => {
    const core = await import('./core.js');
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const [c0] = s.customers.slice(0, 1);
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const day = String(now.getDate()).padStart(2, '0');
    s = core.saveBillMonth(s, c0.id, { month, dueAmount: '3000', status: 'pending' });
    s = core.addPayment(s, c0.id, month, { date: `${month}-${day}`, amount: '3000', method: 'Cash at Waseem Abbasi shop' });
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

test('dashboard shop card shows unsettled cash and modal settles it', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedShopPayment(page);

  const card = page.locator('#shopSettlementSummary');
  await expect(card).toContainText('Waseem Abbasi Shop');
  await expect(page.locator('#dashboardShopSettlementValue')).not.toHaveText('No shop collections');

  await page.click('#openShopSettlementModalBtn');
  await expect(page.locator('#shopSettlementModal')).toBeVisible();
  await expect(page.locator('#shopSettlementCards')).toContainText('Waseem Abbasi Shop');
  await expect(page.locator('#shopSettlementCards')).toContainText('PKR 3,000');
  await expect(page.locator('#shopSettlementReceiptList')).toContainText('PKR 3,000');

  // Partial handover of 1,000 leaves 2,000 unsettled.
  await page.selectOption('#shopSettlementShopSelect', { label: /Waseem Abbasi Shop/ });
  await page.fill('#shopSettlementAmountInput', '1000');
  await page.click('#shopSettlementSubmitBtn');
  await expect(page.locator('#shopSettlementReceiptText')).toContainText('PKR 1,000');
  await expect(page.locator('#shopSettlementReceiptText')).toContainText('PKR 2,000');

  const stored = await page.evaluate(() => localStorage.getItem('sisp_shop_settlements_v1'));
  expect(stored).toBeTruthy();
  const records = JSON.parse(stored);
  expect(records).toHaveLength(1);
  expect(records[0].shop).toBe('Waseem Abbasi Shop');
  expect(records[0].amount).toBe(1000);

  // No horizontal overflow at 390px in the modal.
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  expect(errors).toEqual([]);
});

test('SISP-68: handover kept by Nasir records a linked partner drawing', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedShopPayment(page);

  await page.click('#openShopSettlementModalBtn');
  await expect(page.locator('#shopSettlementModal')).toBeVisible();
  await page.selectOption('#shopSettlementShopSelect', { label: /Waseem Abbasi Shop/ });
  await page.fill('#shopSettlementAmountInput', '3000');
  await page.selectOption('#shopSettlementReceivedIntoSelect', 'nasir');
  await page.click('#shopSettlementSubmitBtn');
  await expect(page.locator('#shopSettlementReceiptText')).toContainText('Kept by Nasir (Partner Drawing)');

  const settlements = JSON.parse(await page.evaluate(() => localStorage.getItem('sisp_shop_settlements_v1')));
  expect(settlements).toHaveLength(1);
  expect(settlements[0].receivedInto).toBe('nasir');
  expect(settlements[0].amount).toBe(3000);

  const ledger = JSON.parse(await page.evaluate(() => localStorage.getItem('sisp_partner_ledger_v1')));
  expect(ledger).toHaveLength(1);
  expect(ledger[0].partner).toBe('Nasir');
  expect(ledger[0].type).toBe('drawing');
  expect(ledger[0].amount).toBe(3000);
  expect(ledger[0].settlementId).toBe(settlements[0].id);
  expect(errors).toEqual([]);
});
