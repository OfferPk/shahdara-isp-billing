/**
 * customer-name-edit.spec.mjs
 * Plan 494: one name-edit path, not two. The profile header's Edit name
 * button opens the full edit form at the name field — there is no separate
 * inline editor any more. Renaming Test Customer 07 -> ALI MNA through
 * the form's Save profile updates the heading, the avatar initials, the
 * customer list, and survives a reload. Empty names are rejected by the
 * form's own validation (updateCustomerProfile throws), with the red
 * error banner shown and the name unchanged.
 */
import { test, expect } from '@playwright/test';
import { installSyntheticRoster } from './seed-roster.mjs';

test.describe('Customer rename from the profile header', () => {
  test.beforeEach(async ({ page }) => {
    // Opens seed customer #7 ("Test Customer 07"): written against the
    // old built-in seed (PR #478 emptied the shipped roster).
    await installSyntheticRoster(page);
  });

  test('edit name opens the form at the name field, save, and the new name sticks everywhere', async ({ page }) => {
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

    // Plan 494: no inline editor — Edit name opens the full edit form,
    // scrolled to the name field with focus, holding the current name.
    await page.locator('#editCustomerNameBtn').click();
    const input = page.locator('#profileNameInput');
    await expect(page.locator('#customerProfileForm')).toBeVisible();
    await expect(page.locator('#customerProfileView')).toBeHidden();
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('Test Customer 07');
    await expect(page.locator('#customerNameEditor')).toHaveCount(0);
    await expect(page.locator('#saveCustomerNameBtn')).toHaveCount(0);

    // Empty name is rejected by the form save and the name stays put.
    await input.fill('   ');
    await page.locator('#saveMohallaButton').click();
    await expect(page.locator('#profileFormError')).toBeVisible();
    await expect(page.locator('#profileFormError')).toContainText('Customer name cannot be empty.');
    await expect(page.locator('#customerProfileForm')).toBeVisible();
    await page.locator('#cancelProfileEditButton').click();
    await expect(page.locator('#detailName')).toHaveText('Test Customer 07');

    await page.locator('#editCustomerNameBtn').click();
    await expect(page.locator('#profileNameInput')).toBeFocused();
    await page.locator('#profileNameInput').fill('ALI MNA');
    await page.locator('#saveMohallaButton').click();
    await expect(page.locator('#detailName')).toHaveText('ALI MNA');
    await expect(page.locator('#profileAvatar')).toHaveText('AM');
    await expect(page.locator('#toast')).toContainText('Customer profile saved');

    // The list shows the new name too, and it persists across reload.
    await page.reload();
    await page.goto('/#/home');
    await page.goto('/#/customers');
    await page.waitForSelector('#customerList [data-customer-id]');
    await expect(page.locator('#customerList [data-customer-id]', { hasText: 'ALI MNA' }).first()).toBeVisible();
    await expect(page.locator('#customerList [data-customer-id]', { hasText: 'Test Customer 07' })).toHaveCount(0);
  });

  test('cancel from the form leaves the name unchanged', async ({ page }) => {
    await page.goto('/#/customers');
    await page.waitForSelector('#customerList');
    await page.locator('#customerList [data-customer-id]').first().click();
    const original = await page.locator('#detailName').textContent();
    await page.locator('#editCustomerNameBtn').click();
    await expect(page.locator('#profileNameInput')).toBeFocused();
    await page.locator('#profileNameInput').fill('SOMETHING ELSE');
    await page.locator('#cancelProfileEditButton').click();
    await expect(page.locator('#customerProfileView')).toBeVisible();
    await expect(page.locator('#detailName')).toHaveText(original.trim());
  });
});
