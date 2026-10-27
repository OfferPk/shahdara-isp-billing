// Profile UI polish: compact profile groups, Urdu names, PKR note chips,
// themed modal containers (Part D).
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Seeds one overdue customer through the app's own core helpers, then
// checks the home overdue row (note chips, no dollar visual), the Urdu name
// after toggling language, the grouped profile (Urdu name + Roman subtitle),
// the shop modal container in dark mode, and 390px no-overflow.
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  return errors;
}

async function boot(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/home');
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

async function seedOverdueCustomer(page) {
  await page.evaluate(async () => {
    const core = await import('./core.js');
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    s = core.addCustomer(s, 'RAJA FAISAL', new Date(), {});
    const customer = s.customers.at(-1);
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    s = core.saveBillMonth(s, customer.id, { month, dueAmount: '3000', status: 'pending' });
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
}

test('profile polish: note chips, Urdu names, grouped profile, dark modal', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedOverdueCustomer(page);

  // Part C: home overdue row shows PKR note chips, Collect without $ visual.
  await page.goto('/#/home');
  const overdueRow = page.locator('#homeTopOverdueList .home-overdue-item', { hasText: 'RAJA FAISAL' });
  await expect(overdueRow).toBeVisible();
  await expect(overdueRow.locator('.pkr-note-chip')).toHaveText('₨1000 ×3');
  await expect(overdueRow.locator('.overdue-collect-link')).toHaveText('Collect');
  await expect(overdueRow.locator('.overdue-collect-link')).not.toContainText('💵');
  await assertNoHorizontalOverflow(page);

  // Part A (English): grouped profile, Roman name, no subtitle yet.
  await page.goto('/#/customers');
  await page.locator('#customerList [data-customer-id]', { hasText: 'RAJA FAISAL' }).first().click();
  await expect(page.locator('.profile-info-group').first()).toBeVisible();
  await expect(page.locator('#detailName')).toHaveText('RAJA FAISAL');
  await expect(page.locator('#detailNameSub')).toBeHidden();
  await assertNoHorizontalOverflow(page);

  // Part B: toggle Urdu -> overdue name + profile name render in Urdu script.
  await page.goto('/#/home');
  await page.click('#languageToggleBtn');
  const overdueUrdu = page.locator('#homeTopOverdueList .home-overdue-item', { hasText: 'راجہ فیصل' });
  await expect(overdueUrdu).toBeVisible();
  await page.goto('/#/customers');
  await page.locator('#customerList [data-customer-id]', { hasText: 'راجہ فیصل' }).first().click();
  await expect(page.locator('#detailName')).toHaveText('راجہ فیصل');
  await expect(page.locator('#detailNameSub')).toHaveText('RAJA FAISAL');
  await assertNoHorizontalOverflow(page);

  // Part D: shop modal container follows the theme in dark mode.
  await page.evaluate(() => localStorage.setItem('shahdara_theme', 'dark'));
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.click('#openShopSettlementModalBtn');
  await expect(page.locator('#shopSettlementModal')).toBeVisible();
  const bg = await page.evaluate(() => getComputedStyle(document.getElementById('shopSettlementModal')).backgroundColor);
  const channels = bg.match(/\d+/g).map(Number);
  expect(Math.max(...channels)).toBeLessThan(80);
  await assertNoHorizontalOverflow(page);

  expect(errors).toEqual([]);
});
