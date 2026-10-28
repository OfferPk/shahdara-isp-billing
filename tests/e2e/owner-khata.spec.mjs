// SISP-20: Monthly Owner Khata Closing Report — CI-only Playwright spec.
// The repo's Playwright runner cannot run in the VM; this spec is written
// for CI and is NOT claimed as run locally.
import { test, expect } from '@playwright/test';

const SEED_KEY = 'shahdara-isp-billing-v1';

async function seedState(page) {
  await page.addInitScript((key) => {
    const state = {
      version: 1,
      nextCustomerNumber: 3,
      customers: [
        { id: 'c1', customerNumber: 1, name: 'Ali', bills: [
          { month: '2026-09', dueAmount: 3000, payments: [] },
          { month: '2026-10', dueAmount: 3000, payments: [
            { id: 'p1', date: '2026-10-05', amount: 3000, method: 'Cash' },
          ] },
        ] },
        { id: 'c2', customerNumber: 2, name: 'Bilal', bills: [
          { month: '2026-10', dueAmount: 2000, payments: [
            { id: 'p2', date: '2026-10-07', amount: 2000, method: 'Cash' },
          ] },
        ] },
      ],
      expenses: [
        { id: 'e1', date: '2026-10-03', amount: 1000, category: 'NayaPay Bandwidth' },
      ],
      monthlyClosings: [],
    };
    window.localStorage.setItem(key, JSON.stringify(state));
  }, SEED_KEY);
}

test('owner khata card opens the closing modal with month figures', async ({ page }) => {
  await seedState(page);
  await page.goto('/');
  await expect(page.locator('#openOwnerKhataModalBtn')).toBeVisible();
  await page.locator('#openOwnerKhataModalBtn').click();
  await expect(page.locator('#ownerKhataModal')).toBeVisible();
  await expect(page.locator('#ownerKhataSummaryLine')).toContainText('Rs. 5,000');
  await expect(page.locator('#ownerKhataBody')).toContainText('Pending Arrears');
  await expect(page.locator('#ownerKhataBody')).toContainText('Nasir share');
  await expect(page.locator('#ownerKhataBody')).toContainText('Aqib share');
});

test('owner khata modal saves a note and prints without overflow at 390px', async ({ page }) => {
  await seedState(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#openOwnerKhataModalBtn').click();
  await page.locator('#ownerKhataNote').fill('October closing note');
  await page.locator('#ownerKhataSaveNoteBtn').click();
  await expect(page.locator('#ownerKhataNote')).toHaveValue('October closing note');
  const overflow = await page.evaluate(() => {
    const el = document.querySelector('#ownerKhataModal .modal-card');
    return el ? el.scrollWidth > el.clientWidth + 1 : false;
  });
  expect(overflow).toBe(false);
});
