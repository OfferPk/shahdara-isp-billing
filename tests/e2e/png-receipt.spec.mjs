// SISP-6: Visual PNG Image Receipt & Urdu "PAID / وصول پایا" Digital Stamp.
// Written to run in CI (the repo Playwright runner cannot run in the
// dev VM). Seeds a customer with a full Rs. 2,000 payment, checks the PNG
// receipt button sits on the payment row, renders a real canvas PNG in
// the browser and asserts a valid image/png download with a SIP filename.
// The PNG itself is a white paper slip by design (like a bank slip); the
// button reuses the existing themed print-receipt-button class, so no new
// dark-mode surface is introduced.
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
}

async function seedPngCustomer(page) {
  await page.evaluate(async () => {
    const core = await import('./core.js');
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const [c0] = s.customers.slice(0, 1);
    c0.name = 'PNG TEST CUSTOMER';
    c0.nameUrdu = 'پی این جی ٹیسٹ';
    c0.mohalla = 'Shahdara Town';
    c0.zone = 'Barrian';
    c0.packageSpeed = '10 Mbps';
    c0.bills = [{
      id: 'bill-png-001', month: '2026-10', dueAmount: 2000, status: 'paid',
      payments: [{ id: 'pay-png-001', date: '2026-10-05', amount: 2000, method: 'Cash' }],
    }];
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

test('PNG receipt button renders a real canvas slip and downloads it', async ({ page }) => {
  const errors = trackErrors(page);
  // Force the download fallback deterministically: the share chooser has
  // no target in headless CI, so canShare must read false here.
  await page.addInitScript(() => {
    try {
      Object.defineProperty(Navigator.prototype, 'canShare', { value: () => false, configurable: true });
    } catch { /* share path simply stays available */ }
  });
  await boot(page);
  await seedPngCustomer(page);

  await page.goto('/#/customers');
  await page.locator('#customerList [data-customer-id]', { hasText: 'PNG TEST CUSTOMER' }).first().click();
  await expect(page.locator('#detailName')).toHaveText('PNG TEST CUSTOMER');
  const monthCard = page.locator('#historyContainer .month-card').first();
  await expect(monthCard).toBeVisible();
  if (!(await monthCard.getAttribute('open')) && !(await monthCard.evaluate((el) => el.open))) {
    await monthCard.locator('summary').click();
  }
  const pngButton = monthCard.locator('[data-png-receipt]').first();
  await expect(pngButton).toBeVisible();

  // Real canvas render in the browser (not a stub): valid PNG data URL,
  // 1600x2000 dimensions, PAID seal, accurate customer details.
  const rendered = await page.evaluate(async () => {
    const core = await import('./core.js');
    const receiptMod = await import('./receipt.js');
    const pngMod = await import('./png-receipt.js');
    const s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const customer = s.customers.find((c) => c.name === 'PNG TEST CUSTOMER');
    const bill = customer.bills[0];
    const receipt = receiptMod.buildPaymentReceipt(customer, bill, bill.payments[0]);
    const png = await pngMod.generateReceiptPNG(receipt, customer);
    return {
      mime: png.mime, width: png.width, height: png.height,
      dataUrlPrefix: png.dataUrl.slice(0, 22), blobType: png.blob?.type ?? null,
      seal: png.model.seal.kind, name: png.model.customerName,
      urduName: png.model.urduName, filename: png.filename,
    };
  });
  expect(rendered.mime).toBe('image/png');
  expect(rendered.width).toBe(1600);
  expect(rendered.height).toBe(2000);
  expect(rendered.dataUrlPrefix).toBe('data:image/png;base64,');
  expect(rendered.blobType).toBe('image/png');
  expect(rendered.seal).toBe('PAID');
  expect(rendered.name).toBe('PNG TEST CUSTOMER');
  expect(rendered.urduName).toBe('پی این جی ٹیسٹ');
  expect(rendered.filename).toMatch(/^SIP-receipt-.*\.png$/);

  // 1-tap download: clicking the row button downloads the PNG file.
  const downloadPromise = page.waitForEvent('download', { timeout: 20000 });
  await pngButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^SIP-receipt-.*\.png$/);

  // No horizontal overflow at a narrow phone width.
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
});
