// SISP-24: Optical Splitter Box (1:8 / 1:16 PLC) Port Map & Customer RX
// Signal (dBm) Tracker.
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Seeds one customer on port 4 of a 1:8 splitter with a -28.5 dBm
// reading directly into the app state, then checks the dashboard splitter
// card, the port-map modal grid (port 4 occupied, 7 spare) and the
// high-loss warning badge, plus 390px no-overflow.
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

async function seedOpticalCustomer(page) {
  await page.evaluate(async () => {
    const core = await import('./core.js');
    const state = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const target = state.customers[0];
    state.customers[0] = {
      ...target,
      splitterBoxId: 'SPL-Barrian-02',
      splitterPort: 4,
      oltPonPort: 'PON 1/2/3',
      lastRxDbm: -28.5
    };
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(state));
  });
}

test('dashboard splitter card and port-map modal show the spec assignment', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedOpticalCustomer(page);
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });

  await expect(page.locator('#dashboardSplitterValue')).not.toHaveText('No splitter boxes');
  await expect(page.locator('#splitterMapSummary')).toContainText('SPL-Barrian-02');

  await page.click('#openSplitterMapModalBtn');
  await expect(page.locator('#splitterMapModal')).toBeVisible();
  await expect(page.locator('#splitterMapSummaryLine')).toContainText('SPL-Barrian-02');
  await expect(page.locator('#splitterMapSummaryLine')).toContainText('1 occupied');
  await expect(page.locator('#splitterMapSummaryLine')).toContainText('7 spare');
  await expect(page.locator('#splitterMapGrid')).toContainText('-28.5 dBm');
  await expect(page.locator('#splitterMapGrid')).toContainText('High-loss');
  await expect(page.locator('#splitterMapWeakList')).toContainText('check attenuation');

  // No horizontal overflow at 390px in the modal.
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  expect(errors).toEqual([]);
});
