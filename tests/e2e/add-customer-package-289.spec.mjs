// #289: Add Customer takes Package / Monthly fee / Connection date, so a new connection is
// billed this month and pending in Quick Collect and Bulk Collect straight away.
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  return errors;
}

async function openAddCustomer(page) {
  await page.goto('/#/customers');
  await page.locator('#srPrimaryAction').click(); // "+ Add Customer"
  await expect(page.locator('#addCustomerDialog')).toBeVisible();
}
const pktToday = page => page.evaluate(() => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10));

test.describe('#289 Add Customer package & billing', () => {
  test('add a customer with fee 1500 -> pending in Quick Collect with PKR 1,500 (and in Bulk Collect)', async ({ page }) => {
    const errors = trackErrors(page);
    await openAddCustomer(page);
    // Existing fields are all still there.
    for (const id of ['newCustomerName', 'newCustomerCnic', 'newCustomerPhone', 'newCustomerAddress', 'newCustomerMohalla', 'newCustomerZone']) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    await expect(page.locator('#newCustomerConnectionDate')).toHaveValue(await pktToday(page));
    await page.locator('#newCustomerName').fill('Zubair Test');
    await page.locator('#newCustomerPhone').fill('03001234567');
    await page.locator('#newCustomerPackage').selectOption('5mbps-150gb');
    await expect(page.locator('#newCustomerFee')).toHaveValue('1500');
    await expect(page.locator('#newCustomerPlanHint')).toContainText('PKR 1,500');
    // Fits the phone width.
    const overflow = await page.locator('#addCustomerDialog').evaluate(d => d.scrollWidth - d.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    for (const sel of ['#newCustomerPackage', '#newCustomerFee', '#newCustomerConnectionDate']) {
      expect((await page.locator(sel).boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    await page.locator('#addCustomerSubmit').click();
    await expect(page.locator('#addCustomerDialog')).toBeHidden();
    await expect(page.locator('#toast')).toContainText('PKR 1,500 bill created');

    const saved = await page.evaluate(async () => {
      const core = await import('./core.js');
      const s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
      const c = s.customers.find(x => x.name === 'Zubair Test');
      return { fee: c.monthlySellingAmount, pkg: c.packageSpeed, date: c.connectionDate, bills: c.bills.map(b => [b.month, Number(b.dueAmount)]) };
    });
    expect(saved.fee).toBe(1500);
    expect(saved.pkg).toBe('5Mbps / 150GB');
    expect(saved.date).toBe(await pktToday(page));
    expect(saved.bills).toEqual([[(await pktToday(page)).slice(0, 7), 1500]]);

    // Quick Collect: pending, PKR 1,500.
    await page.evaluate(() => window.quickCollectModalController.open());
    const qc = page.locator('#quickCollectModal');
    await expect(qc).toBeVisible();
    await expect(page.locator('#quickCollectDuesCount')).toHaveText('1');
    const card = qc.locator('.qc-customer-card', { hasText: 'Zubair Test' });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText('PKR 1,500');
    // Bulk Collect: first in the pending list with the due prefilled.
    await page.locator('#openBulkCollectBtn').click();
    const row = page.locator('#bulkCollectModal .bc-row').first();
    await expect(row).toContainText('Zubair Test');
    await expect(row.locator('.bc-badge-due')).toHaveText('Due PKR 1,500');
    await expect(row.locator('[data-bulk-amount]')).toHaveValue('1500');
    expect(errors).toEqual([]);
  });

  test('fee stays editable; "Collect first payment" opens Quick Collect for that customer', async ({ page }) => {
    const errors = trackErrors(page);
    await openAddCustomer(page);
    await page.locator('#newCustomerName').fill('Custom Fee Test');
    await page.locator('#newCustomerPackage').selectOption('5mbps-150gb');
    await page.locator('#newCustomerFee').fill('1350');
    await page.locator('#addCustomerSubmit').click();
    await expect(page.locator('#toast')).toContainText('PKR 1,350 bill created');
    await page.locator('#toast .toast-action-btn').click();
    await expect(page.locator('#quickCollectModal')).toBeVisible();
    await expect(page.locator('#quickCollectAmountInput')).toHaveValue('1350.00');
    expect(errors).toEqual([]);
  });

  test('name-only add still works and creates no bill; a negative fee is refused', async ({ page }) => {
    const errors = trackErrors(page);
    await openAddCustomer(page);
    await page.locator('#newCustomerName').fill('Name Only Test');
    // A negative fee is refused (browser validation on the number box), nothing is saved.
    await page.locator('#newCustomerFee').fill('-10');
    await page.locator('#addCustomerSubmit').click();
    expect(await page.locator('#newCustomerFee').evaluate(el => el.validity.valid)).toBe(false);
    await expect(page.locator('#addCustomerDialog')).toBeVisible();
    expect(await page.evaluate(() => window.quickCollectModalController.getState().customers.some(x => x.name === 'Name Only Test'))).toBe(false);
    await page.locator('#newCustomerFee').fill('');
    await page.locator('#addCustomerSubmit').click();
    await expect(page.locator('#addCustomerDialog')).toBeHidden();
    const c = await page.evaluate(() => window.quickCollectModalController.getState().customers.find(x => x.name === 'Name Only Test'));
    expect(c.monthlySellingAmount).toBeNull();
    expect(c.bills).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('duplicate-name "continue anyway" path also applies the package', async ({ page }) => {
    const errors = trackErrors(page);
    await openAddCustomer(page);
    const existing = await page.evaluate(() => window.quickCollectModalController.getState().customers[0].name);
    await page.locator('#newCustomerName').fill(existing);
    await page.locator('#newCustomerPackage').selectOption('3mbps-100gb');
    await page.locator('#addCustomerSubmit').click();
    await expect(page.locator('#duplicateCustomerReview')).toBeVisible();
    await page.locator('#continueNewCustomerAnyway').click();
    await expect(page.locator('#addCustomerDialog')).toBeHidden();
    const added = await page.evaluate(() => window.quickCollectModalController.getState().customers.at(-1));
    expect(added.name).toBe(existing);
    expect(added.monthlySellingAmount).toBe(1000);
    expect(added.bills.map(b => Number(b.dueAmount))).toEqual([1000]);
    expect(errors).toEqual([]);
  });

  test('profile Edit form: package picker fills Package / speed and Monthly selling amount', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/#/customers');
    await page.locator('#customerList [data-customer-id], #customerList button, #customerList li').first().click();
    await page.locator('#profileTabInfo').click();
    await page.locator('#editProfileButton').click();
    await expect(page.locator('#customerProfileForm')).toBeVisible();
    await page.locator('#profilePackagePicker').selectOption('5mbps-500gb');
    await expect(page.locator('#packageSpeedInput')).toHaveValue('5Mbps / 500GB');
    await expect(page.locator('#monthlySellingAmountInput')).toHaveValue('2500');
    // Existing fields remain.
    await expect(page.locator('#connectionDateInput')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
});
