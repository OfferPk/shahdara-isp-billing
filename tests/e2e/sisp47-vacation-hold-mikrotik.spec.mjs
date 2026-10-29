// SISP-47: Vacation Hold ↔ MikroTik PPPoE Disable/Enable Snippet.
// Written to run in CI (the repo Playwright runner cannot run in the
// dev VM). Seeds a paused customer (with pre-hold arrears, so they also
// appear in Top Defaulters) and a plain defaulter, then checks:
//  - the profile shows the vacation-hold section with the exact
//    /ppp secret disable + /ppp active remove commands (1-click copy);
//  - a never-paused profile shows no vacation-hold section;
//  - the Top Defaulters row badges the held customer "On Vacation Hold"
//    and the MikroTik lock script excludes them while locking the
//    plain defaulter;
//  - 390px no-overflow on the paused profile.
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
          id: 'seed-hold-1', customerNumber: 1, name: 'SEED HOLD',
          packageSpeed: '5Mbps / 150GB', pppoeUsername: 'seedhold1',
          pppoePassword: 'seedpw', staticIp: '192.168.1.60',
          macAddress: 'AA:BB:CC:DD:EE:11', promiseDate: null,
          paused: true, pauseStartDate: '2026-01-05', autoResumeDate: null,
          pauseSkippedMonths: [],
          bills: [{ month: '2026-10', dueAmount: 2000, payments: [] }],
          archived: false
        },
        {
          id: 'seed-plain-2', customerNumber: 2, name: 'SEED PLAIN',
          packageSpeed: '3Mbps / 100GB', pppoeUsername: 'seedplain2',
          pppoePassword: 'seedpw', staticIp: '192.168.1.61',
          macAddress: 'AA:BB:CC:DD:EE:22', promiseDate: null,
          bills: [{ month: '2026-10', dueAmount: 1500, payments: [] }],
          archived: false
        }
      ]
    };
    localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify(state));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

async function openProfile(page, name, waitSelector) {
  await page.goto('/#/customers');
  await page.waitForSelector('#customerList [data-customer-id]', { timeout: 20000 });
  const card = page.locator('#customerList [data-customer-id]', { hasText: name }).first();
  await card.click();
  await page.waitForSelector(waitSelector, { timeout: 20000 });
}

test('paused profile shows the 1-click PPPoE disable snippet for the hold', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedCustomers(page);
  await openProfile(page, 'SEED HOLD', '#profileVacationHoldScript');

  await expect(page.locator('#profileVacationHoldScript')).toContainText('/ppp secret disable [find name="seedhold1"]');
  await expect(page.locator('#profileVacationHoldScript')).toContainText('/ppp active remove [find name="seedhold1"]');
  await expect(page.locator('#profileVacationHoldScript')).not.toContainText('payment-reminder-pool');
  await expect(page.locator('#profileVacationHoldCopyBtn')).toBeVisible();
  await expect(errors).toEqual([]);
});

test('never-paused profile shows no vacation-hold router section', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedCustomers(page);
  await openProfile(page, 'SEED PLAIN', '#profileMikrotikScript');

  await expect(page.locator('#profileVacationHoldScript')).toHaveCount(0);
  await expect(page.locator('#profileVacationHoldCopyBtn')).toHaveCount(0);
  await expect(errors).toEqual([]);
});

test('top defaulters badges the held customer and the lock script excludes them', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedCustomers(page);

  await page.goto('/#/home');
  await page.click('#dashboardOpenTopDefaultersBtn');
  await expect(page.locator('#topDefaultersModal')).toBeVisible();
  await expect(page.locator('#topDefaultersModal')).toContainText('On Vacation Hold');

  await page.click('#topDefaultersMikrotikLockBtn');
  await expect(page.locator('#topDefaultersMikrotikOutput')).toBeVisible();
  await expect(page.locator('#topDefaultersMikrotikScript')).toContainText('# Lock: SEED PLAIN');
  await expect(page.locator('#topDefaultersMikrotikScript')).toContainText('Excluded (vacation hold');
  await expect(page.locator('#topDefaultersMikrotikScript')).not.toContainText('# Lock: SEED HOLD');
  await expect(page.locator('#topDefaultersMikrotikScript')).not.toContainText('[find name="seedhold1"]');
  await expect(page.locator('#topDefaultersMikrotikNote')).toContainText('skipped (vacation hold)');
  await expect(errors).toEqual([]);
});

test('vacation hold profile section does not overflow at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = trackErrors(page);
  await boot(page);
  await seedCustomers(page);
  await openProfile(page, 'SEED HOLD', '#profileVacationHoldScript');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(errors).toEqual([]);
});
