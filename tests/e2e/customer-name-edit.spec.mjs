/**
 * customer-name-edit.spec.mjs
 * The customer profile header carries Edit name / Save name: renaming
 * Test Customer 07 -> ALI MNA updates the heading, the avatar initials, the
 * customer list, and survives a reload. Empty names are rejected inline.
 */
import { test, expect } from '@playwright/test';

test.describe('Customer rename from the profile header', () => {
  test('edit name, save, and the new name sticks everywhere', async ({ page }) => {
    await page.goto('/#/customers');
    await page.waitForSelector('#customerList');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.goto('/#/home');
    await page.goto('/#/customers');
    await page.waitForSelector('#customerList [data-customer-id]');
    // Open Test Customer 07 (seed customer #7 in the user's example).
    const card = page.locator('#customerList [data-customer-id]', { hasText: 'Test Customer 07' }).first();
    await card.click();
    await expect(page.locator('#detailName')).toHaveText('Test Customer 07');

    await page.locator('#editCustomerNameBtn').click();
    const input = page.locator('#customerNameInput');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('Test Customer 07');

    // Empty name is rejected inline and the editor stays open.
    await input.fill('   ');
    await page.locator('#saveCustomerNameBtn').click();
    await expect(page.locator('#customerNameEditError')).toBeVisible();
    await expect(page.locator('#detailName')).toHaveText('Test Customer 07');

    await input.fill('ALI MNA');
    await page.locator('#saveCustomerNameBtn').click();
    await expect(page.locator('#detailName')).toHaveText('ALI MNA');
    await expect(page.locator('#customerNameEditor')).toBeHidden();
    await expect(page.locator('#profileAvatar')).toHaveText('AM');
    await expect(page.locator('#toast')).toContainText('ALI MNA');

    // The list shows the new name too, and it persists across reload.
    await page.reload();
    await page.goto('/#/home');
    await page.goto('/#/customers');
    await page.waitForSelector('#customerList [data-customer-id]');
    await expect(page.locator('#customerList [data-customer-id]', { hasText: 'ALI MNA' }).first()).toBeVisible();
    await expect(page.locator('#customerList [data-customer-id]', { hasText: 'Test Customer 07' })).toHaveCount(0);
  });

  test('cancel leaves the name unchanged', async ({ page }) => {
    await page.goto('/#/customers');
    await page.waitForSelector('#customerList');
    await page.locator('#customerList [data-customer-id]').first().click();
    const original = await page.locator('#detailName').textContent();
    await page.locator('#editCustomerNameBtn').click();
    await page.locator('#customerNameInput').fill('SOMETHING ELSE');
    await page.locator('#cancelCustomerNameBtn').click();
    await expect(page.locator('#customerNameEditor')).toBeHidden();
    await expect(page.locator('#detailName')).toHaveText(original.trim());
  });
});
