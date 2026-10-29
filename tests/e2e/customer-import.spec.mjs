// Bulk Add Customers: paste / CSV upload -> preview with statuses -> add -> pending in Quick Collect.
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  return errors;
}
const modal = page => page.locator('#customerImportModal');

async function openImport(page) {
  await page.goto('/#/customers');
  await page.locator('#bulkAddCustomersBtn').click();
  await expect(modal(page)).toBeVisible();
  await expect(page).toHaveURL(/#\/customers\/import$/);
}

async function expectInList(page, name) {
  await page.locator('#customerListSearch').fill(name);
  await expect(page.locator('#customerList')).toContainText(name);
  await page.locator('#customerListSearch').fill('');
}

test.describe('Bulk add customers', () => {
  test("paste John's 3 lines -> 3 customers in the list and 3 pending in Quick Collect", async ({ page }) => {
    const errors = trackErrors(page);
    await openImport(page);
    const countBefore = Number(await page.locator('#customerCount').textContent());
    await page.locator('#ciText').fill('ALI, 15MBPS, 3000RS\nSAIM, 5MBPS, 1500\nTOUSEEF 5MBPS, 1000');
    await page.locator('#ciPreviewBtn').click();
    const rows = modal(page).locator('.ci-row');
    await expect(rows).toHaveCount(3);
    await expect(modal(page).locator('[data-ci-status]')).toHaveText(['OK', 'OK', 'OK']);
    await expect(rows.nth(0).locator('[data-ci-field="packageLabel"]')).toHaveValue('15Mbps Unlimited');
    await expect(rows.nth(1).locator('[data-ci-field="fee"]')).toHaveValue('1500');
    await expect(rows.nth(2).locator('[data-ci-field="packageLabel"]')).toHaveValue('5 Mbps');
    // Fits the screen, no sideways scroll.
    expect(await modal(page).evaluate(d => d.scrollWidth - d.clientWidth)).toBeLessThanOrEqual(1);
    await expect(page.locator('#ciAddBtn')).toHaveText('Add 3 customers');
    await page.locator('#ciAddBtn').click();

    await expect(page.locator('#ciDoneTitle')).toHaveText('Added 3 customers');
    await expect(page.locator('#ciDoneDetail')).toContainText('3 got this month\'s bill');
    await expect(page.locator('#customerCount')).toHaveText(String(countBefore + 3));

    await page.locator('#ciOpenCollectBtn').click();
    const qc = page.locator('#quickCollectModal');
    await expect(qc).toBeVisible();
    await expect(page.locator('#quickCollectDuesCount')).toHaveText('3');
    for (const [name, amount] of [['ALI', 'PKR 3,000'], ['SAIM', 'PKR 1,500'], ['TOUSEEF', 'PKR 1,000']]) {
      await expect(qc.locator('.qc-customer-card', { hasText: name }).first()).toContainText(amount);
    }
    await page.keyboard.press('Escape');
    await expect(qc).toBeHidden();
    for (const name of ['ALI', 'SAIM', 'TOUSEEF']) await expectInList(page, name);
    expect(errors).toEqual([]);
  });

  test('CSV upload with a header row; fix a missing fee, skip a duplicate, remove a row; undo the batch', async ({ page }) => {
    const errors = trackErrors(page);
    await openImport(page);
    const countBefore = Number(await page.locator('#customerCount').textContent());
    const csv = [
      'Name,Package,Fee,Phone,Area',
      'Usman,5mbps,1500,0300-1112223,Shahdara',
      'Asif,15 MB,,,',
      'Test Customer 35,3mbps,1000,,',
      'Junk Row,5mbps,1500,,',
      '"Khan, Imran",5Mbps / 500GB,"2,500",03215550001,Begum Kot'
    ].join('\n');
    await page.locator('#ciFile').setInputFiles({ name: 'customers.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    // A readable file goes straight to the preview.
    await expect(page.locator('#ciStepPreview')).toBeVisible();
    const rows = modal(page).locator('.ci-row');
    await expect(rows).toHaveCount(5);
    // Asif's 15 MB matches the only 15 Mbps package, so its price fills the fee.
    await expect(modal(page).locator('[data-ci-status]')).toHaveText(['OK', 'OK', 'Duplicate', 'OK', 'OK']);
    await expect(rows.nth(1).locator('[data-ci-field="fee"]')).toHaveValue('3000');
    await expect(rows.nth(2)).toContainText('Matches #');
    // Clear Asif's fee -> Missing fee (unticked); type one back -> OK again.
    await rows.nth(1).locator('[data-ci-field="fee"]').fill('');
    await rows.nth(1).locator('[data-ci-field="fee"]').press('Tab');
    await expect(rows.nth(1).locator('[data-ci-status]')).toHaveText('Missing fee');
    await expect(rows.nth(1).locator('[data-ci-include]')).not.toBeChecked();
    await rows.nth(1).locator('[data-ci-field="fee"]').fill('2800');
    await rows.nth(1).locator('[data-ci-field="fee"]').press('Tab');
    await expect(rows.nth(1).locator('[data-ci-status]')).toHaveText('OK');
    // Remove the junk row.
    await rows.nth(3).locator('[data-ci-remove]').click();
    await expect(rows).toHaveCount(4);
    await expect(page.locator('#ciAddBtn')).toHaveText('Add 3 customers');
    await page.locator('#ciAddBtn').click();
    await expect(page.locator('#ciDoneTitle')).toHaveText('Added 3 customers');
    await expect(page.locator('#ciDoneDetail')).toContainText('Skipped 1');
    const saved = await page.evaluate(() => window.quickCollectModalController.getState().customers.slice(-3)
      .map(c => [c.name, c.packageSpeed, c.monthlySellingAmount, c.phone, c.mohalla]));
    expect(saved).toEqual([
      ['Usman', '5Mbps / 150GB', 1500, '03001112223', 'Shahdara'],
      ['Asif', '15Mbps Unlimited', 2800, '', ''],
      ['Khan, Imran', '5Mbps / 500GB', 2500, '03215550001', 'Begum Kot']
    ]);
    await expect(page.locator('#customerCount')).toHaveText(String(countBefore + 3));
    // Undo the whole batch.
    await page.locator('#ciUndoBtn').click();
    await expect(page.locator('#ciDoneStatus')).toContainText('removed 3 customers');
    await expect(page.locator('#customerCount')).toHaveText(String(countBefore));
    await page.locator('#ciDoneBtn').click();
    await expect(modal(page)).toBeHidden();
    await expect(page).toHaveURL(/#\/customers$/);
    expect(errors).toEqual([]);
  });

  test('#/customers/import deep link opens it; Back closes it; Add Customer dialog links to it', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/#/customers');
    await page.goto('/#/customers/import');
    await expect(modal(page)).toBeVisible();
    await page.goBack();
    await expect(modal(page)).toBeHidden();
    await expect(page).toHaveURL(/#\/customers$/);
    // Opened by tap: one Back closes it and stays on Customers.
    await page.locator('#bulkAddCustomersBtn').click();
    await expect(modal(page)).toBeVisible();
    await expect(page).toHaveURL(/#\/customers\/import$/);
    await page.goBack();
    await expect(modal(page)).toBeHidden();
    await expect(page).toHaveURL(/#\/customers$/);
    await page.waitForTimeout(300);
    await expect(modal(page)).toBeHidden();
    await page.locator('#srPrimaryAction').click();
    await expect(page.locator('#addCustomerDialog')).toBeVisible();
    await page.locator('#openBulkAddFromForm').click();
    await expect(page.locator('#addCustomerDialog')).toBeHidden();
    await expect(modal(page)).toBeVisible();
    await expect(page).toHaveURL(/#\/customers\/import$/);
    await page.waitForTimeout(500);
    await expect(modal(page)).toBeVisible();
    // Empty list explains instead of doing nothing.
    await page.locator('#ciPreviewBtn').click();
    await expect(page.locator('#ciInputStatus')).toContainText('Paste at least one line');
    expect(errors).toEqual([]);
  });
});
