// SISP-3: "Waada Tareekh" (Promise-to-Pay) & 3-Tier Reminder Snooze Queue.
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Seeds two defaulters — one with a broken (past) promise, one with no
// promise — then checks the broken badge pins at the top, the Waada tier
// filter isolates tiers, a +5 Days chip moves the second customer to the
// Promised tier, and a full payment clears the first customer's promise.
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

function ymd(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function seedDefaulters(page) {
  const names = await page.evaluate(async () => {
    const core = await import('./core.js');
    const waada = await import('./waada-queue.js');
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const [c0, c1] = s.customers.slice(0, 2);
    const now = new Date();
    const month = ymd(now).slice(0, 7);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    s = core.saveBillMonth(s, c0.id, { month, dueAmount: '3000', status: 'pending' });
    s = core.saveBillMonth(s, c1.id, { month, dueAmount: '5000', status: 'pending' });
    const idx = s.customers.findIndex(c => c.id === c0.id);
    s.customers[idx] = waada.setCustomerWaada(s.customers[idx], {
      promiseDate: ymd(yesterday),
      promiseAmount: 3000,
      promiseNote: 'Salary'
    });
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
    return { broken: c0.name, active: c1.name, month };
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  return names;
}

test('broken promise badges first, tier filter isolates, chip snoozes, full payment clears', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  const { broken, active, month } = await seedDefaulters(page);

  await page.click('#dashboardOpenTopDefaultersBtn');
  await expect(page.locator('#topDefaultersModal')).toBeVisible();
  const table = page.locator('#topDefaultersTableBody');
  await expect(table).toContainText('Waada Expired');
  await expect(table).toContainText(broken);

  // Tier filter: broken shows only the broken-promise customer.
  await page.selectOption('#topDefaultersWaadaSelect', 'broken');
  await expect(table).toContainText(broken);
  await expect(table).not.toContainText(active);
  // Active shows only the customer with no promise.
  await page.selectOption('#topDefaultersWaadaSelect', 'active');
  await expect(table).toContainText(active);
  await expect(table).not.toContainText(broken);
  await page.selectOption('#topDefaultersWaadaSelect', 'all');

  // One-tap +5 Days chip on the active customer's row moves them to Promised.
  const waadaBtn = table.locator('.defaulter-waada-btn').first();
  await waadaBtn.click();
  await expect(page.locator('#waadaChipDialog')).toBeVisible();
  await expect(page.locator('#waadaChipCurrent')).toContainText('no promise set');
  await page.click('#waadaChipDialog [data-waada-chip="plus5"]');
  const plus5 = ymd(new Date(Date.now() + 5 * 86400000));
  await expect(page.locator('#waadaChipCurrent')).toContainText(plus5);
  await page.click('#waadaChipCloseBtn');
  await page.selectOption('#topDefaultersWaadaSelect', 'promised');
  await expect(table).toContainText(active);
  await expect(table).toContainText('Waada:');

  // Full payment of the broken customer's balance clears their promise.
  await page.evaluate(async ({ month: billMonth }) => {
    const core = await import('./core.js');
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const [c0] = s.customers.slice(0, 1);
    const day = String(new Date().getDate()).padStart(2, '0');
    s = core.addPayment(s, c0.id, billMonth, { date: `${billMonth}-${day}`, amount: '3000', method: 'Cash' });
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
  }, { month });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  const cleared = await page.evaluate(async () => {
    const core = await import('./core.js');
    const s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    return s.customers[0].promiseDate ?? null;
  });
  expect(cleared).toBeNull();

  // No horizontal overflow at 390px in the modal.
  await page.click('#dashboardOpenTopDefaultersBtn');
  await expect(page.locator('#topDefaultersModal')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  expect(errors).toEqual([]);
});
