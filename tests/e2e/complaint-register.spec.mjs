// SISP-15: Centralized Monthly Complaint Register + Resolution Timeline.
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Seeds a complaint directly into sisp_complaints_ledger_v1, then
// checks the dashboard complaint card, the register modal drilldown, a
// resolve action with automatic downtime, and 390px no-overflow.
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

async function seedComplaint(page) {
  await page.evaluate(() => {
    const complaints = [{
      id: 'CMP-101',
      customerId: 'seed-c1',
      customerName: 'SEED CUSTOMER',
      zone: 'Shahdara Town',
      issueCategory: 'Fiber Cut',
      reportedAt: '2026-10-28T10:00',
      resolvedAt: '',
      downtimeHours: null,
      downtimeManual: false,
      status: 'Open',
      resolutionNote: '',
      createdAt: ''
    }];
    localStorage.setItem('sisp_complaints_ledger_v1', JSON.stringify(complaints));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

test('dashboard complaint card shows open faults and modal resolves with downtime', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedComplaint(page);

  await expect(page.locator('#complaintRegisterSummary')).toContainText('Open now');
  await expect(page.locator('#dashboardComplaintValue')).not.toHaveText('No complaints');

  await page.click('#openComplaintRegisterModalBtn');
  await expect(page.locator('#complaintRegisterModal')).toBeVisible();
  await expect(page.locator('#complaintRegisterList')).toContainText('CMP-101');
  await expect(page.locator('#complaintRegisterList')).toContainText('Fiber Cut');

  // Resolve: the card's resolved-at input is enabled only after resolving,
  // so set it via the resolve action, then check the auto downtime (10:00
  // reported; resolving now shows a computed value, not "auto" blank).
  await page.click('[data-complaint-action="resolve"]');
  await expect(page.locator('#complaintRegisterList')).toContainText('Resolved');
  const stored = await page.evaluate(() => localStorage.getItem('sisp_complaints_ledger_v1'));
  expect(stored).toBeTruthy();
  const records = JSON.parse(stored);
  expect(records).toHaveLength(1);
  expect(records[0].status).toBe('Resolved');
  expect(records[0].resolvedAt).toBeTruthy();
  expect(records[0].downtimeHours).not.toBeNull();

  // Filter to Resolved keeps the entry; filter to Open hides it.
  await page.selectOption('#complaintFilterStatus', 'Open');
  await expect(page.locator('#complaintRegisterList')).toContainText('No complaints match');
  await page.selectOption('#complaintFilterStatus', 'Resolved');
  await expect(page.locator('#complaintRegisterList')).toContainText('CMP-101');

  // No horizontal overflow at 390px in the modal.
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  expect(errors).toEqual([]);
});
