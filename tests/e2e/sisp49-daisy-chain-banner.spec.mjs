// SISP-49: Complaint Register Upstream Daisy-Chain Alert Banner.
// Written to run in CI (the repo Playwright runner cannot run in the
// dev VM). Seeds a synthetic feeder chain (A feeds B, B feeds C) into
// app state plus three complaints into sisp_complaints_ledger_v1, then
// checks, at a real 360px viewport:
//   - the Open complaint on feeder A shows the daisy-chain banner
//     listing BOTH downstream homes (B and C) with the notify button;
//   - the Resolved complaint on A and the Open complaint on leaf C
//     show NO banner;
//   - clicking "Notify all on WhatsApp" opens the SISP-7 Outage Impact
//     tool prefilled with A and its impacted list (B and C);
//   - the complaint records in storage are byte-identical afterwards
//     (the banner never mutates a complaint);
//   - no horizontal overflow at 360px.
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  return errors;
}

async function boot(page) {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/#/home');
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

async function seedChain(page) {
  await page.evaluate(() => {
    const state = {
      version: 1,
      nextCustomerNumber: 14,
      customers: [
        { id: 'seed-a', customerNumber: 11, name: 'E2E CHAIN A', mohalla: 'Barrian', phone: '', upstreamCustomerId: '', fiberZone: 'Side 1', bills: [], archived: false },
        { id: 'seed-b', customerNumber: 12, name: 'E2E CHAIN B', mohalla: 'Barrian', phone: '923001234567', upstreamCustomerId: 'seed-a', fiberZone: 'Side 1', bills: [], archived: false },
        { id: 'seed-c', customerNumber: 13, name: 'E2E CHAIN C', mohalla: 'Barrian', phone: '', upstreamCustomerId: 'seed-b', fiberZone: 'Side 1', bills: [], archived: false }
      ]
    };
    localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify(state));
    const complaint = (id, customerId, customerName, status) => ({
      id, customerId, customerName,
      zone: 'Barrian',
      issueCategory: 'Media Converter / Charger Off',
      reportedAt: '2026-10-29T10:00',
      resolvedAt: status === 'Resolved' ? '2026-10-29T12:00' : '',
      downtimeHours: status === 'Resolved' ? 2 : null,
      downtimeManual: false,
      status,
      resolutionNote: '',
      createdAt: ''
    });
    localStorage.setItem('sisp_complaints_ledger_v1', JSON.stringify([
      complaint('CMP-101', 'seed-a', 'E2E CHAIN A', 'Open'),
      complaint('CMP-102', 'seed-a', 'E2E CHAIN A', 'Resolved'),
      complaint('CMP-103', 'seed-c', 'E2E CHAIN C', 'Open')
    ]));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

test('daisy-chain banner lists downstream homes and launches the outage tool; records untouched', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedChain(page);
  const complaintsBefore = await page.evaluate(() => localStorage.getItem('sisp_complaints_ledger_v1'));

  await page.click('#openComplaintRegisterModalBtn');
  await expect(page.locator('#complaintRegisterModal')).toBeVisible();

  // CMP-101 (Open, feeder A): banner with both downstream homes.
  const card101 = page.locator('article[data-complaint-id="CMP-101"]');
  const banner = card101.locator('.complaint-chain-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Daisy-chain alert');
  await expect(banner).toContainText('E2E CHAIN B');
  await expect(banner).toContainText('E2E CHAIN C');
  await expect(banner.locator('[data-complaint-action="notify-chain"]')).toBeVisible();

  // CMP-102 (Resolved) and CMP-103 (leaf, no dependents): no banner.
  await expect(page.locator('article[data-complaint-id="CMP-102"] .complaint-chain-banner')).toHaveCount(0);
  await expect(page.locator('article[data-complaint-id="CMP-103"] .complaint-chain-banner')).toHaveCount(0);

  // 1-tap launch opens the SISP-7 outage tool prefilled with A.
  await banner.locator('[data-complaint-action="notify-chain"]').click();
  await expect(page.locator('#outageImpactModal')).toBeVisible();
  await expect(page.locator('#outageImpactSummaryLine')).toContainText('2 downstream');
  await expect(page.locator('#outageImpactResultList')).toContainText('E2E CHAIN B');
  await expect(page.locator('#outageImpactResultList')).toContainText('E2E CHAIN C');

  // The banner never mutates a complaint record.
  const complaintsAfter = await page.evaluate(() => localStorage.getItem('sisp_complaints_ledger_v1'));
  expect(complaintsAfter).toBe(complaintsBefore);

  // No horizontal overflow at phone width.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
