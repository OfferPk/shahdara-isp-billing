// SISP-12: Lineman Complaint Worklist and Material Consumed Tracker.
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Seeds a field ticket directly into sisp_tickets_v1, then checks the
// dashboard field-tickets card, the worklist modal, a resolve action with a
// billed Patch Cord charge, and 390px no-overflow.
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

async function seedTicket(page) {
  await page.evaluate(() => {
    const tickets = [{
      id: 'TKT-101',
      customerId: 'seed-c1',
      customerName: 'SEED CUSTOMER',
      complaintId: '',
      faultPreset: 'Fiber Cut / Splice Loss',
      customFault: '',
      technician: 'Saad',
      priority: 'Urgent',
      status: 'Open',
      createdAt: '2026-10-28T10:00',
      resolvedAt: '',
      note: '',
      materialsUsed: [],
      billingType: 'free',
      billedAmount: 0,
      chargePaid: false,
      chargePaidAt: '',
      stockDeductions: [],
      stockDeducted: false
    }];
    localStorage.setItem('sisp_tickets_v1', JSON.stringify(tickets));
  });
}

test('field tickets card, modal resolve with billed charge, 390px no overflow', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedTicket(page);
  await page.reload();
  await page.waitForSelector('#dashboardFieldTicketsValue', { state: 'attached', timeout: 20000 });
  await expect(page.locator('#dashboardFieldTicketsValue')).toContainText('1 open');
  await page.click('#openFieldTicketsModalBtn');
  await expect(page.locator('#fieldTicketsModal')).toBeVisible();
  await expect(page.locator('[data-ticket-id="TKT-101"]')).toBeVisible();
  await page.click('[data-ticket-action="show-resolve"][data-ticket-id="TKT-101"]');
  const form = page.locator('[data-resolve-form="TKT-101"]');
  await expect(form).toBeVisible();
  await form.locator('[data-resolve-material="patch-cord"][data-resolve-field="qty"]').fill('1');
  await form.locator('[data-resolve-material="patch-cord"][data-resolve-field="amount"]').fill('500');
  await form.locator('input[type="radio"][value="billed"]').check();
  await form.locator('button[type="submit"]').click();
  await expect(page.locator('[data-ticket-id="TKT-101"]')).toContainText('Resolved');
  await expect(page.locator('[data-ticket-id="TKT-101"]')).toContainText('Billed · PKR 500');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('sisp_tickets_v1') || '[]'));
  expect(stored[0].status).toBe('Resolved');
  expect(stored[0].billedAmount).toBe(500);
  expect(stored[0].resolvedAt).toBeTruthy();
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
