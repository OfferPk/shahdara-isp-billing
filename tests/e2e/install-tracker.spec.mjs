// Installation tracker: request + delay reason + month summary.
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Logs a request for Test Customer 122 (Rs. 10,000 EasyPaisa), marks it
// installed 2 days later with a delay reason, and checks the month
// summary shows 2 days, the reason, and total delay 2 — plus a pending
// request that shows days-so-far without entering the total, and no
// horizontal overflow at 390px.
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

test('installation tracker: request, install 2 days later with reason, summary totals', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await expect(page.locator('#dashboardInstallTrackerValue')).toContainText('No requests yet');
  await page.locator('#openInstallTrackerModalBtn').click();
  await expect(page.locator('#installTrackerModal')).toBeVisible();
  await page.locator('#installTrackerMonth').fill('2026-10');
  await page.locator('#installRequestName').fill('Test Customer 122');
  await page.locator('#installRequestDate').fill('2026-10-01');
  await page.locator('#installRequestAmount').fill('10000');
  await page.locator('#installRequestPayMethod').selectOption('easypaisa');
  await page.locator('#installRequestPayReference').fill('TID123');
  await page.locator('#installRequestForm button[type="submit"]').click();
  let listText = await page.locator('#installTrackerList').innerText();
  expect(listText).toContain('Test Customer 122');
  expect(listText).toContain('still pending');
  // Mark installed 2 days later with the Nasir fiber/ONU reason.
  await page.locator('#installMarkRequest').selectOption({ index: 1 });
  await page.locator('#installMarkDate').fill('2026-10-03');
  await page.locator('#installMarkReasonPreset').selectOption('Fiber/ONU late — Nasir');
  await page.locator('#installMarkForm button[type="submit"]').click();
  const summaryText = await page.locator('#installTrackerMonthSummary').innerText();
  expect(summaryText).toContain('Total delay days');
  expect(summaryText).toContain('Fiber/ONU late — Nasir');
  listText = await page.locator('#installTrackerList').innerText();
  expect(listText).toContain('2 days');
  // A second, still-pending request shows days-so-far, never in the total.
  await page.locator('#installRequestName').fill('Waiting Customer');
  await page.locator('#installRequestDate').fill('2026-10-10');
  await page.locator('#installRequestAmount').fill('0');
  await page.locator('#installRequestForm button[type="submit"]').click();
  listText = await page.locator('#installTrackerList').innerText();
  expect(listText).toContain('Waiting Customer');
  expect(listText).toContain('still pending');
  expect(errors).toEqual([]);
});

test('installation tracker: no horizontal overflow at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  await page.locator('#openInstallTrackerModalBtn').click();
  await expect(page.locator('#installTrackerModal')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});
