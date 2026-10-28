// SISP-13: MikroTik RouterOS PPPoE Script and Defaulter Walled-Garden
// Command Generator. Written to run in CI (the repo Playwright runner
// cannot run in the dev VM). Seeds customers into the real ledger key
// (shahdara-isp-billing-v1, version 1 + customers array, as readState
// requires), then checks the profile RouterOS snippet section and the Top
// Defaulters lock/restore script generation (including the future-Waada
// exclusion), plus 390px no-overflow.
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

async function seedCustomers(page) {
  await page.evaluate(() => {
    const state = {
      version: 1,
      nextCustomerNumber: 3,
      customers: [
        {
          id: 'seed-mikrotik-1', customerNumber: 1, name: 'SEED ROUTER',
          packageSpeed: '5Mbps / 150GB', pppoeUsername: 'seedrouter1',
          pppoePassword: 'seedpw', staticIp: '192.168.1.50',
          macAddress: 'AA:BB:CC:DD:EE:FF', promiseDate: null,
          bills: [{ month: '2026-10', dueAmount: 1500, payments: [] }],
          archived: false
        },
        {
          id: 'seed-mikrotik-2', customerNumber: 2, name: 'SEED WAADA',
          packageSpeed: '3Mbps / 100GB', pppoeUsername: 'seedwaada2',
          pppoePassword: 'seedpw', staticIp: '192.168.1.51',
          macAddress: 'AA:BB:CC:DD:EE:00', promiseDate: '2099-01-01',
          bills: [{ month: '2026-10', dueAmount: 1000, payments: [] }],
          archived: false
        }
      ]
    };
    localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify(state));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

async function openSeedRouterProfile(page) {
  await page.goto('/#/customers');
  await page.waitForSelector('#customerList [data-customer-id]', { timeout: 20000 });
  const card = page.locator('#customerList [data-customer-id]', { hasText: 'SEED ROUTER' }).first();
  await card.click();
  await page.waitForSelector('#profileMikrotikScript', { timeout: 20000 });
}

test('profile shows a copyable RouterOS snippet with exact username and speed', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedCustomers(page);
  await openSeedRouterProfile(page);

  await expect(page.locator('#profileMikrotikScript')).toContainText('/ppp secret add name="seedrouter1"');
  await expect(page.locator('#profileMikrotikScript')).toContainText('max-limit=5M/5M');
  await expect(page.locator('#profileMikrotikScript')).toContainText('customerId: seed-mikrotik-1');
  await expect(page.locator('#profileMikrotikCopyBtn')).toBeVisible();
  await expect(errors).toEqual([]);
});

test('top defaulters lock script excludes the future-Waada customer', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedCustomers(page);

  await page.goto('/#/home');
  await page.click('#dashboardOpenTopDefaultersBtn');
  await expect(page.locator('#topDefaultersModal')).toBeVisible();
  await page.click('#topDefaultersMikrotikLockBtn');
  await expect(page.locator('#topDefaultersMikrotikOutput')).toBeVisible();
  await expect(page.locator('#topDefaultersMikrotikScript')).toContainText('profile=payment-reminder-pool');
  await expect(page.locator('#topDefaultersMikrotikScript')).toContainText('max-limit=128k/128k');
  await expect(page.locator('#topDefaultersMikrotikScript')).not.toContainText('# Lock: SEED WAADA');
  await expect(page.locator('#topDefaultersMikrotikNote')).toContainText('skipped');

  await page.click('#topDefaultersMikrotikRestoreBtn');
  await expect(page.locator('#topDefaultersMikrotikScript')).toContainText('profile=default');
  await expect(errors).toEqual([]);
});

test('mikrotik sections do not overflow at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = trackErrors(page);
  await boot(page);
  await seedCustomers(page);
  await openSeedRouterProfile(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(errors).toEqual([]);
});
