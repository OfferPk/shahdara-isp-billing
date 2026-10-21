/**
 * bluetooth-print-226.spec.mjs
 * #226: Web Bluetooth thermal printing.
 * - Without navigator.bluetooth every Bluetooth affordance is hidden and
 *   the system-print fallback remains (feature-hidden acceptance).
 * - With a fake GATT printer injected, the Settings tile appears, the
 *   connect flow remembers the device, and a payment-row BT print sends
 *   ESC/POS bytes for that receipt.
 */
import { test, expect } from '@playwright/test';

const FAKE_BT_INIT = () => {
  window.__btWrites = [];
  const characteristic = {
    properties: { write: true, writeWithoutResponse: true },
    writeValueWithoutResponse: async (chunk) => { window.__btWrites.push(Array.from(chunk)); },
    writeValue: async (chunk) => { window.__btWrites.push(Array.from(chunk)); }
  };
  const service = { getCharacteristics: async () => [characteristic] };
  const device = {
    id: 'fake-1', name: 'POS-58 Fake',
    gatt: {
      connected: false,
      connect: async () => { device.gatt.connected = true; return { getPrimaryServices: async () => [service], getPrimaryService: async () => service }; },
      disconnect: () => { device.gatt.connected = false; }
    }
  };
  Object.defineProperty(navigator, 'bluetooth', { value: { requestDevice: async () => device }, configurable: true });
};

async function openMoreMenu(page) {
  const btn = page.locator('#mobileMoreButton');
  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(600);
  }
}

test.describe('Issue #226: Bluetooth thermal printing', () => {
  // The printer settings live in the mobile More menu and Quick Collect is
  // a field flow; the desktop layout has neither surface.
  test.beforeEach(async ({ page }) => {
    if ((page.viewportSize()?.width || 0) > 600) test.skip();
  });
  test('hidden when Web Bluetooth is unavailable; fallback print buttons remain', async ({ page }) => {
    await page.goto('/#/home');
    await page.waitForSelector('#billingDashboard');
    // Headless Chromium here exposes no usable Web Bluetooth printer path;
    // the app must keep every BT affordance hidden.
    const btState = await page.evaluate(() => ({
      hasApi: !!navigator.bluetooth,
      tileHidden: document.querySelector('#mobileMoreBluetoothPrinterBtn')?.hidden,
      qcHidden: document.querySelector('#quickCollectBluetoothPrintBtn')?.hidden
    }));
    if (!btState.hasApi) {
      expect(btState.tileHidden).toBe(true);
      expect(btState.qcHidden).toBe(true);
    }
    // Fallback: the system-print statement/receipt controls are untouched.
    await openMoreMenu(page);
    await expect(page.locator('#mobileMoreDigitalSettingsBtn')).toBeVisible();
  });

  test('connect flow, remembered device, and BT print sends ESC/POS bytes', async ({ page }) => {
    await page.addInitScript(FAKE_BT_INIT);
    await page.goto('/#/home');
    await page.waitForSelector('#billingDashboard');

    await openMoreMenu(page);
    const tile = page.locator('#mobileMoreBluetoothPrinterBtn');
    await expect(tile).toBeVisible();
    await tile.click();
    const modal = page.locator('#bluetoothPrinterModal');
    await expect(modal).toBeVisible();
    await page.locator('#connectBluetoothPrinterBtn').click();
    await expect(page.locator('#bluetoothPrinterStatus')).toContainText('connected', { timeout: 10000 });
    const remembered = await page.evaluate(() => localStorage.getItem('shahdara_bt_printer'));
    expect(remembered).toContain('POS-58 Fake');
    await page.locator('#testBluetoothPrinterBtn').click();
    await page.waitForTimeout(600);
    const testWrites = await page.evaluate(() => window.__btWrites.length);
    expect(testWrites).toBeGreaterThan(0);
    await page.locator('#closeBluetoothPrinterModalBtn').click();
    await expect(modal).toBeHidden();

    // Print on the receipt success screen: record a payment via Quick
    // Collect, then use its Bluetooth print button.
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('#billingDashboard');
    await page.locator('#quickAddPaymentButton').click();
    const qcModal = page.locator('#quickCollectModal');
    await expect(qcModal).toBeVisible();
    const setupBtn = page.locator('[data-qc-setup-packages]').first();
    if (await setupBtn.isVisible().catch(() => false)) {
      await setupBtn.click();
      await page.locator('#collectSetupSelectAll').check();
      await page.locator('#collectSetupApplyBtn').click();
      await page.locator('#closeCollectSetupBtn').click();
    }
    const card = qcModal.locator('.qc-customer-card').first();
    await expect(card).toBeVisible();
    await card.click();
    await page.locator('#quickCollectConfirmBtn').click();
    await expect(page.locator('#quickCollectStepSuccess')).toBeVisible();
    const qcBtBtn = page.locator('#quickCollectBluetoothPrintBtn');
    await expect(qcBtBtn).toBeVisible();
    await page.evaluate(() => { window.__btWrites = []; });
    await qcBtBtn.click();
    await expect.poll(() => page.evaluate(() => window.__btWrites.length), { timeout: 10000 }).toBeGreaterThan(0);
    const decoded = await page.evaluate(() => new TextDecoder().decode(new Uint8Array(window.__btWrites.flat())));
    expect(decoded).toContain('AMOUNT PAID');
    expect(decoded).toContain('PAYMENT RECEIPT');
    expect(decoded.charCodeAt(0)).toBe(0x1b);
  });
});
