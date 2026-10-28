// SISP-35: Multi-Connection Family / Landlord Group Billing & Combined Receipt.
// Written to run in CI (the repo Playwright runner cannot run in the dev VM).
// Seeds three starter connections with current-month bills of Rs. 2,000 +
// Rs. 3,000 + Rs. 1,500, links them into one group through the modal, then
// Collect Group Total pays all three and shows a combined Rs. 6,500 receipt.
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  return errors;
}

async function boot(page) {
  await page.goto('/#/home');
  await page.waitForSelector('#openGroupBillingModalBtn', { state: 'attached', timeout: 20000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#openGroupBillingModalBtn', { state: 'attached', timeout: 20000 });
}

async function seedGroupMembers(page) {
  return page.evaluate(async () => {
    const core = await import('./core.js');
    const now = new Date(Date.now() + 5 * 3600 * 1000); // PKT
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const [c0, c1, c2] = s.customers.slice(0, 3);
    const names = ['E2E Alpha', 'E2E Beta', 'E2E Gamma'];
    s = {
      ...s,
      customers: s.customers.map((customer, index) => (
        index < 3 ? { ...customer, name: names[index], archived: false } : customer
      ))
    };
    s = core.saveBillMonth(s, c0.id, { month, dueAmount: 2000, status: 'pending' });
    s = core.saveBillMonth(s, c1.id, { month, dueAmount: 3000, status: 'pending' });
    s = core.saveBillMonth(s, c2.id, { month, dueAmount: 1500, status: 'pending' });
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
    return names;
  });
}

test('group billing: link 3 connections, Collect Group Total pays Rs. 6,500 with a combined receipt at 390px', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  const names = await seedGroupMembers(page);
  await page.reload();
  await page.waitForSelector('#openGroupBillingModalBtn', { state: 'attached', timeout: 20000 });
  await page.setViewportSize({ width: 390, height: 844 });

  await page.locator('#openGroupBillingModalBtn').click();
  const dialog = page.locator('#groupBillingModal');
  await expect(dialog).toBeVisible();

  await dialog.locator('#groupBillingTitle').fill('Khan Family');
  await dialog.locator('#groupBillingMemberFilter').fill('E2E');
  await expect(dialog.locator('[data-group-member]')).toHaveCount(3);
  for (const box of await dialog.locator('[data-group-member]').all()) await box.check();
  await dialog.locator('#groupBillingSubmitBtn').click();

  const card = dialog.locator('#groupBillingList .group-billing-card').first();
  await expect(card).toContainText('Khan Family');
  await expect(card).toContainText('Rs. 6,500');
  for (const name of names) await expect(card).toContainText(name);

  await card.locator('[data-group-collect]').click();
  const receiptPanel = dialog.locator('#groupBillingReceiptPanel');
  await expect(receiptPanel).toBeVisible();
  await expect(dialog.locator('#groupBillingReceiptText')).toContainText('Rs. 6,500');
  await expect(dialog.locator('#groupBillingReceiptText')).toContainText('TOTAL: Rs. 6,500');
  // All three members are now paid: the group total drops to zero.
  await expect(card.locator('[data-group-collect]')).toBeDisabled();

  expect(errors).toEqual([]);
});
