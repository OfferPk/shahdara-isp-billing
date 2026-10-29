// SISP-19 (CI only — Playwright cannot run in this VM; never claimed as run).
// Hardware custody: profile fields, disconnection recovery checklist,
// Pending Hardware Recovery dashboard card + modal, mark recovered.
import { test, expect } from '@playwright/test';

const APP_URL = process.env.APP_URL || 'http://localhost:8080/';

async function seedCustomer(page) {
  await page.goto(APP_URL);
  await page.evaluate(() => {
    const state = {
      version: 1,
      nextCustomerNumber: 2,
      customers: [{
        id: 'cust-sisp19',
        customerNumber: 42,
        name: 'Test Customer 34',
        mohalla: 'Shahdara Town',
        zone: '',
        address: '',
        phone: '',
        cnic: '',
        ispProvider: '',
        serviceStatus: 'active',
        packageSpeed: '5 Mbps',
        monthlyPurchaseCost: null,
        monthlySellingAmount: 1500,
        monthlyPriceSchedule: [],
        billingStartMonth: null,
        connectionDate: null,
        connectionFee: null,
        routerModel: 'Tenda F3',
        routerPrice: null,
        fiberMeters: 120,
        routerOwnership: 'isp-owned',
        mediaConverterOwnership: 'isp-owned',
        serialNumber: 'SN-1234',
        securityDeposit: 2000,
        hardwareRecovered: { router: null, mediaConverter: null },
        nameUrdu: '',
        expiryDate: null,
        cancellationDate: null,
        packageHistory: [],
        archived: false,
        archivedAt: null,
        bills: [],
        incidents: [],
        installmentPlans: []
      }],
      inventoryItems: [],
      inventoryMovements: [],
      expenses: [],
      saadAttendanceDays: [],
      umairWorkdays: [],
      monthlyClosings: []
    };
    localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify(state));
  });
  await page.reload();
}

test('profile shows custody fields; archiving flags pending recovery until marked recovered', async ({ page }) => {
  await seedCustomer(page);
  // Dashboard card exists and shows nothing pending before disconnection.
  await expect(page.locator('#dashboardHardwareRecoveryValue')).toHaveText('Nothing pending');
  // Open the customer profile and check the custody section.
  await page.locator('#customerList [data-customer-id="cust-sisp19"]').click();
  await expect(page.locator('.profile-custody-section')).toContainText('ISP Owned — Returnable');
  await expect(page.locator('.profile-custody-section')).toContainText('SN-1234');
  await expect(page.locator('.profile-custody-section')).toContainText('120 m');
  // No checklist while connected.
  await expect(page.locator('.profile-custody-checklist')).toHaveCount(0);
  // Archive = disconnect: checklist appears, card counts the customer.
  await page.locator('#archiveCustomerButton').click();
  await expect(page.locator('#appConfirmTitle')).toHaveText('Archive this customer?');
  await page.locator('#appConfirmOkBtn').click();
  await expect(page.locator('.profile-custody-checklist')).toContainText('Media Converter / ONU');
  await expect(page.locator('#dashboardHardwareRecoveryValue')).toContainText('1 customer');
  // Modal lists the pending items; mark one recovered.
  await page.locator('#openHardwareRecoveryModalBtn').click();
  await expect(page.locator('#hardwareRecoveryList')).toContainText('Test Customer 34');
  await page.locator('[data-hardware-recover="cust-sisp19:mediaConverter"]').click();
  await expect(page.locator('#hardwareRecoveryList')).not.toContainText('Media Converter / ONU');
  // The other item still pends; mark all recovered clears the list.
  await expect(page.locator('#hardwareRecoveryList')).toContainText('Router');
  await page.locator('[data-hardware-recover-all="cust-sisp19"]').click();
  await expect(page.locator('#hardwareRecoveryList')).toContainText('Nothing pending');
});

test('custody UI does not overflow at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedCustomer(page);
  await page.locator('#customerList [data-customer-id="cust-sisp19"]').click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});
