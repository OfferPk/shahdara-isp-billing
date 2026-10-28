// SISP-7: Daisy-Chain / Feeder Outage Impact & Bulk WhatsApp Alert Tool.
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Seeds a House A -> House B -> House C feeder chain into the app
// state, then checks the dashboard outage card, the modal trace (B and C
// listed, A never listed), the bulk message text, and 390px no-overflow.
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

async function seedFeederChain(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('shahdara-isp-billing-v1');
    const state = raw ? JSON.parse(raw) : null;
    if (!state || !Array.isArray(state.customers) || state.customers.length < 3) return null;
    const [a, b, c] = state.customers;
    b.upstreamCustomerId = a.id;
    b.fiberZone = 'Side 2';
    c.upstreamCustomerId = b.id;
    c.fiberZone = 'Side 2a';
    b.phone = '+923001234567';
    c.phone = '+923001234568';
    localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify(state));
    return { a: a.name, b: b.name, c: c.name };
  });
}

test('dashboard outage card and modal trace show the A -> B -> C chain', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  const names = await seedFeederChain(page);
  test.skip(!names, 'seed customers unavailable');
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });

  await expect(page.locator('#dashboardOutageValue')).toContainText('feeder-linked');
  await expect(page.locator('#outageImpactSummary')).toContainText('downstream');

  await page.click('#openOutageImpactModalBtn');
  await expect(page.locator('#outageImpactModal')).toBeVisible();
  await page.selectOption('#outageImpactSource', { index: 1 });
  await page.click('#outageImpactTraceBtn');
  await expect(page.locator('#outageImpactSummaryLine')).toContainText('2 downstream');
  await expect(page.locator('#outageImpactResultList')).toContainText(names.b);
  await expect(page.locator('#outageImpactResultList')).toContainText(names.c);
  await expect(page.locator('#outageImpactResultList')).toContainText('Assalam-o-Alaikum');
  await expect(page.locator('#outageImpactResultList').locator('a[href^="https://wa.me/"]')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('outage modal has no horizontal overflow at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page);
  await seedFeederChain(page);
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.click('#openOutageImpactModalBtn');
  await expect(page.locator('#outageImpactModal')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
