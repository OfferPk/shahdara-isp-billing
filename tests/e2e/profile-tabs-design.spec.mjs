// Profile tabs design: compact month cards, 2-col month forms, 2-col
// billing metrics on phones, themed incident pill/form in dark mode.
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Seeds one customer with a bill through the app's own core helpers,
// then checks the Billing tab (metric grid + month summary stat cells +
// visible payment form with cells), the Complaints tab (incident section),
// and the incident pill in dark mode — all at 390px with no overflow.
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  return errors;
}

async function boot(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/home');
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

async function seedCustomerWithBill(page) {
  await page.evaluate(async () => {
    const core = await import('./core.js');
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    s = core.addCustomer(s, 'TABS TEST', new Date(), {});
    const customer = s.customers.at(-1);
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    s = core.saveBillMonth(s, customer.id, { month, dueAmount: '3000', status: 'pending' });
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

async function openCustomer(page) {
  await page.goto('/#/customers');
  await page.locator('#customerList [data-customer-id]', { hasText: 'TABS TEST' }).first().click();
  await expect(page.locator('#detailName')).toHaveText('TABS TEST');
}

async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
}

async function darkChannelMax(page, selector) {
  const bg = await page.evaluate((sel) => getComputedStyle(document.querySelector(sel)).backgroundColor, selector);
  const channels = bg.match(/\d+/g).map(Number);
  return Math.max(...channels);
}

test('profile tabs: compact billing, month cards, complaints, dark pill', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedCustomerWithBill(page);
  await openCustomer(page);

  // Billing tab (default): metric grid is 2 columns at 390px.
  const grid = page.locator('.profile-summary-grid').first();
  await expect(grid).toBeVisible();
  const tracks = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(tracks).toBe(2);

  // Month card: summary stat cells + visible payment form with cells.
  const monthCard = page.locator('#historyContainer .month-card').first();
  await expect(monthCard).toBeVisible();
  const isOpen = await monthCard.evaluate((el) => el.open);
  if (!isOpen) await monthCard.locator('summary').click();
  await expect(monthCard.locator('.month-summary-stat').first()).toBeVisible();
  const paymentForm = monthCard.locator('form[data-kind="payment"]');
  await expect(paymentForm).toBeVisible();
  await expect(paymentForm.locator('.form-cell').first()).toBeVisible();
  await expect(paymentForm.locator('input[name="amount"]')).toBeVisible();
  await expect(paymentForm.locator('select[name="method"]')).toBeVisible();
  await assertNoHorizontalOverflow(page);

  // Complaints tab: incident section renders, pill visible.
  await page.locator('#profileTabComplaints').click();
  await expect(page.locator('.incident-section')).toBeVisible();
  await expect(page.locator('.incident-count')).toBeVisible();
  await expect(page.locator('#incidentEmptyNote')).toBeVisible();
  await assertNoHorizontalOverflow(page);

  // Dark mode: the incident pill must not stay white.
  await page.evaluate(() => localStorage.setItem('shahdara_theme', 'dark'));
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await openCustomer(page);
  await page.locator('#profileTabComplaints').click();
  await expect(page.locator('.incident-count')).toBeVisible();
  expect(await darkChannelMax(page, '.incident-count')).toBeLessThan(80);
  await assertNoHorizontalOverflow(page);

  expect(errors).toEqual([]);
});
