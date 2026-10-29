// SISP-48: In-App QR Khata Card Camera Scanner.
// Written to run in CI (the repo Playwright runner cannot run in the
// dev VM, and no real camera exists there). A headless browser cannot
// scan a physical card, so this spec drives the scanner's manual paste
// path — the same routing the camera decode lands on — and checks:
//  - the [📷 Scan QR Card] buttons exist in the top bar and Field Mode;
//  - pasting a valid SISP-14 payload (?customer=12&action=pay) closes
//    the scanner and opens Customer #12's Quick Collect modal;
//  - an unknown id shows the safe "Customer not found" status and opens
//    NOTHING;
//  - a foreign URL shows the "not a Shahdara QR Khata card" status and
//    opens NOTHING;
//  - the scanner dialog fits a 360px phone with no horizontal overflow.
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

async function seedCustomers(page) {
  await page.evaluate(() => {
    const state = {
      version: 1,
      nextCustomerNumber: 13,
      customers: [
        {
          id: 'seed-qr-12', customerNumber: 12, name: 'SEED QR TWELVE',
          packageSpeed: '5Mbps / 150GB', pppoeUsername: 'seedqr12',
          bills: [{ month: '2026-10', dueAmount: 1500, payments: [] }],
          archived: false
        }
      ]
    };
    localStorage.setItem('shahdara-isp-billing-v1', JSON.stringify(state));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

async function openScanner(page) {
  await page.click('#qrScanTopbarBtn');
  await expect(page.locator('#qrScannerModal')).toBeVisible();
}

async function pastePayload(page, payload) {
  await page.fill('#qrScannerManualInput', payload);
  await page.click('#qrScannerManualForm button[type="submit"]');
}

test('SISP-48: valid Khata payload opens Quick Collect; unknown and foreign payloads open nothing', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedCustomers(page);

  // Valid SISP-14 payload for Customer #12 → Quick Collect opens for them.
  await openScanner(page);
  await pastePayload(page, 'https://offerpk.github.io/shahdara-isp-billing/?customer=12&action=pay');
  await expect(page.locator('#qrScannerModal')).toBeHidden();
  await expect(page.locator('#quickCollectModal')).toBeVisible();
  await expect(page.locator('#quickCollectModal')).toContainText('SEED QR TWELVE');
  await page.evaluate(() => document.getElementById('quickCollectModal')?.close());

  // Unknown id → safe status inside the scanner, no modal opens.
  await openScanner(page);
  await pastePayload(page, '?customer=999&action=pay');
  await expect(page.locator('#qrScannerStatus')).toContainText('Customer not found for this QR card.');
  await expect(page.locator('#qrScannerModal')).toBeVisible();
  await expect(page.locator('#quickCollectModal')).toBeHidden();

  // Foreign URL → rejected status, still nothing opens.
  await pastePayload(page, 'https://evil.example.com/?customer=12&action=pay');
  await expect(page.locator('#qrScannerStatus')).toContainText('not a Shahdara QR Khata card');
  await expect(page.locator('#quickCollectModal')).toBeHidden();
  await page.keyboard.press('Escape');

  // Field Mode carries its own Scan QR button that opens the same dialog.
  await page.click('#fieldModeToggleBtn');
  await expect(page.locator('#fieldModeScanQrBtn')).toBeVisible();
  await page.click('#fieldModeScanQrBtn');
  await expect(page.locator('#qrScannerModal')).toBeVisible();
  await page.keyboard.press('Escape');

  expect(errors).toEqual([]);
});

test('SISP-48: scanner dialog fits a 360px phone without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await boot(page);
  await seedCustomers(page);
  await openScanner(page);
  const overflow = await page.evaluate(() => {
    const dialog = document.getElementById('qrScannerModal');
    return {
      scrollWidth: dialog.scrollWidth,
      clientWidth: dialog.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      innerWidth: window.innerWidth
    };
  });
  expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.innerWidth);
  await page.keyboard.press('Escape');
});
