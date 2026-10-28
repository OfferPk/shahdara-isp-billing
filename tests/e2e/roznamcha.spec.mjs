// SISP-11: Daily Cash Roznamcha (Cash Drawer and Lineman Petty Cash Register).
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Seeds a closed day and an open day with one outflow directly into
// sisp_roznamcha_v1, then checks the dashboard card, the modal's closed
// vs open rendering, the opening carry-forward (closed 2026-10-20 closing
// PKR 1,000 -> open 2026-10-21 opening PKR 1,000, minus PKR 500 outflow =
// expected closing PKR 500), and 390px no-overflow.
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

async function seedDays(page) {
  await page.evaluate(() => {
    const days = [
      { date: '2026-10-20', outflows: [], closed: true, openingBalance: 0, cashIn: 1000, shopIn: 0, cashPayments: [], handovers: [], expectedClosing: 1000, closingBalance: 1000, countedCash: 1000, discrepancy: 0, closedAt: '2026-10-20T20:00:00.000Z' },
      { date: '2026-10-21', outflows: [{ id: 'out-seed', category: 'Petrol / Bike Fuel', amount: 500, lineman: 'Saad', note: '' }], closed: false }
    ];
    localStorage.setItem('sisp_roznamcha_v1', JSON.stringify(days));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

test('dashboard roznamcha card and modal show closed vs open days', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedDays(page);

  await expect(page.locator('#roznamchaSummary')).toBeAttached();
  await page.click('#openRoznamchaModalBtn');
  await expect(page.locator('#roznamchaModal')).toBeVisible();

  // Closed day: frozen snapshot, close form hidden, reopen offered.
  await page.fill('#roznamchaDate', '2026-10-20');
  await expect(page.locator('#roznamchaSummaryLine')).toContainText('Closed day');
  await expect(page.locator('#roznamchaSummaryLine')).toContainText('PKR 1,000');
  await expect(page.locator('#roznamchaCloseBlock')).toBeHidden();
  await expect(page.locator('#roznamchaReopenBlock')).toBeVisible();

  // Open day: opening carried from the closed day, outflow listed,
  // expected closing = 1,000 opening - 500 outflow = PKR 500.
  await page.fill('#roznamchaDate', '2026-10-21');
  await expect(page.locator('#roznamchaSummaryLine')).toContainText('expected closing PKR 500');
  await expect(page.locator('#roznamchaOutflows')).toContainText('Petrol / Bike Fuel');
  await expect(page.locator('#roznamchaOutflows')).toContainText('PKR 500');
  await expect(page.locator('#roznamchaOutflowForm')).toBeVisible();
  await expect(page.locator('#roznamchaCloseBlock')).toBeVisible();

  // No horizontal overflow at 390px in the modal.
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  expect(errors).toEqual([]);
});
