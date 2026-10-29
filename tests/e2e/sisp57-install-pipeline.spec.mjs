// SISP-57: Installation completion pipeline — marking a request
// installed creates the active customer (connection fee / router /
// fiber fields recorded) and deducts the used stock (120m fiber + 1
// router) from sisp_inventory_v1. Written to run in CI (the repo
// Playwright runner cannot run in the dev VM). Synthetic data only.
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
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('sisp_inventory_v1', JSON.stringify([
      { id: 'STK-1', itemId: 'fiber-2core', kind: 'in', qty: 500, date: '2026-10-01', customerName: '', note: 'Purchase', createdAt: '2026-10-01T00:00:00.000Z' },
      { id: 'STK-2', itemId: 'router', kind: 'in', qty: 3, date: '2026-10-01', customerName: '', note: 'Purchase', createdAt: '2026-10-01T00:00:00.000Z' }
    ]));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

test('sisp-57: completing an install creates the customer and deducts 120m fiber + 1 router', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await page.locator('#openInstallTrackerModalBtn').click();
  await expect(page.locator('#installTrackerModal')).toBeVisible();

  await page.locator('#installRequestName').fill('Pipeline Customer');
  await page.locator('#installRequestDate').fill('2026-10-01');
  await page.locator('#installRequestAmount').fill('10000');
  await page.locator('#installRequestPayMethod').selectOption('easypaisa');
  await page.locator('#installRequestForm button[type="submit"]').click();
  await expect(page.locator('#installTrackerList')).toContainText('Pipeline Customer');

  await page.locator('#installMarkRequest').selectOption({ index: 1 });
  await page.locator('#installMarkDate').fill('2026-10-03');
  await page.locator('#installMarkConnectionFee').fill('3000');
  await page.locator('#installMarkRouterModel').fill('TP-Link WR841');
  await page.locator('#installMarkRouterPrice').fill('2500');
  await page.locator('#installMarkFiberMeters').fill('120');
  await page.locator('#installMarkRouterQty').fill('1');
  await page.locator('#installMarkForm button[type="submit"]').click();

  // Customer created active with the recorded connection fields.
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('shahdara-isp-billing-v1')));
  const customer = state.customers.find((c) => c.name === 'Pipeline Customer');
  expect(customer).toBeTruthy();
  expect(customer.serviceStatus).toBe('active');
  expect(customer.connectionDate).toBe('2026-10-03');
  expect(customer.connectionFee).toBe(3000);
  expect(customer.routerModel).toBe('TP-Link WR841');
  expect(customer.routerPrice).toBe(2500);
  expect(customer.fiberMeters).toBe(120);

  // Stock deducted exactly: 120m fiber out, 1 router out.
  const movements = await page.evaluate(() => JSON.parse(localStorage.getItem('sisp_inventory_v1')));
  const outs = movements.filter((m) => m.kind === 'out');
  expect(outs.map((m) => [m.itemId, m.qty])).toEqual([['router', 1], ['fiber-2core', 120]]);

  // Request stamped as completed against the new customer.
  const requests = await page.evaluate(() => JSON.parse(localStorage.getItem('sisp_install_requests_v1')));
  expect(requests[0].completedCustomerId).toBe(customer.id);
  expect(requests[0].completion.stockDeductions).toEqual([{ itemId: 'router', qty: 1 }, { itemId: 'fiber-2core', qty: 120 }]);
  await expect(page.locator('#installTrackerList')).toContainText('Stock out');
  expect(errors).toEqual([]);
});
