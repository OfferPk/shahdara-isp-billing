// Field Mode search fix (owner report 2026-10-29): searching a name in
// Field Mode must surface a fully-paid customer (default view stays
// dues-only), colour-coded GREEN/paid, and his sheet must offer the
// Advance option in the same flow. Written to run in CI (the repo
// Playwright runner cannot run in the dev VM). Seeds synthetic data
// through the app's own core helpers at a real 360px viewport.
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
  await page.waitForFunction(() => !!window.fieldModeController, { timeout: 20000 });
}

async function seed(page) {
  await page.evaluate(async () => {
    const core = await import('./core.js');
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const today = `${month}-${String(now.getDate()).padStart(2, '0')}`;
    // Paid-in-full customer (the owner's Qasim case, synthetic).
    s = core.addCustomer(s, 'Test Customer 77', now, { phone: '+923001234567', mohalla: 'Gangall', zone: 'Gangall' });
    const paid = s.customers.at(-1);
    s = core.saveBillMonth(s, paid.id, { month, dueAmount: '3000', status: 'pending' });
    s = core.addPayment(s, paid.id, month, { amount: 3000, date: today, method: 'Cash' });
    // Customer with dues still pending.
    s = core.addCustomer(s, 'Test Customer 78', now, { phone: '+923009998877', mohalla: 'Barrian', zone: 'Barrian' });
    const dues = s.customers.at(-1);
    s = core.saveBillMonth(s, dues.id, { month, dueAmount: '3000', status: 'pending' });
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.waitForFunction(() => !!window.fieldModeController, { timeout: 20000 });
}

test('field mode search fix: paid customer hidden by default, found by search, advance recorded in-flow', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seed(page);
  await page.locator('#fieldModeToggleBtn').click();
  await expect(page.locator('#fieldModeView')).toBeVisible();

  const cards = page.locator('#fieldModeCustomerList [data-field-customer-id]');

  // DEFAULT view: only the dues customer shows, RED strip; the paid
  // customer stays hidden (owner-locked default).
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveClass(/field-mode-status--due/);
  await expect(cards.first()).toContainText('🔴 Due');

  // SEARCH: the paid customer MUST show, GREEN/paid.
  await page.locator('#fieldModeSearchInput').fill('Test Customer 77');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveClass(/field-mode-status--paid/);
  await expect(cards.first()).toContainText('🟢 Paid');
  await expect(page.locator('#fieldModeZoneTarget')).toContainText('1 customers');

  // His sheet is the Advance sheet: checkbox pre-ticked, amount field,
  // method buttons — no dead end.
  await cards.first().click();
  const checkbox = page.locator('#fieldModeAdvanceCheckbox');
  await expect(checkbox).toBeVisible();
  await expect(checkbox).toBeChecked();
  await page.locator('#fieldModeAdvanceAmount').fill('3000');
  await page.locator('#fieldModeActionPanel [data-field-advance-method="Cash"]').click();

  // Receipt card confirms the advance; the stored payment is tagged.
  await expect(page.locator('#fieldModeActionPanel .field-mode-receipt')).toBeVisible();
  await expect(page.locator('#fieldModeActionPanel .field-mode-receipt')).toContainText('Advance');
  const storedKind = await page.evaluate(async () => {
    const core = await import('./core.js');
    const s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const c = s.customers.find(x => x.name === 'Test Customer 77');
    const payments = c.bills.flatMap(b => b.payments);
    return payments.at(-1)?.kind ?? null;
  });
  expect(storedKind).toBe('advance');

  // Back to the list with the search still active: he is now YELLOW
  // (advance credit waiting).
  await page.locator('#fieldModeActionPanel [data-field-action="next"]').click();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveClass(/field-mode-status--advance/);
  await expect(cards.first()).toContainText('🟡 Advance');

  expect(errors).toEqual([]);
});
