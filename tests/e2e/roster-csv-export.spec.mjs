// Regression for #235: roster "📥 Export CSV" threw `ReferenceError: customerQuery is not defined`.
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function openCustomerTable(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  const drawerToggle = page.locator('#navDrawerToggle');
  if (await drawerToggle.isVisible()) {
    await drawerToggle.click();
    await page.locator('#navDrawer [data-nav-target="customers"]').click();
  }
  await expect(page.locator('#customersView')).toBeVisible();
  await page.locator('#customerViewTableBtn').click();
  await expect(page.locator('#exportCustomerRosterCsvBtn')).toBeVisible();
  return errors;
}

async function exportCsv(page) {
  const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
  await page.locator('#exportCustomerRosterCsvBtn').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^shahdara-customer-roster-.+\.csv$/);
  const csv = await readFile(await download.path(), 'utf8');
  return csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
}

test.describe('Customer roster CSV export (#235)', () => {
  test('downloads the full roster with a header row and a confirmation toast', async ({ page }) => {
    const errors = await openCustomerTable(page);
    const lines = await exportCsv(page);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0].toLowerCase()).toContain('name');
    await expect(page.locator('#toast')).toContainText(`Exported ${lines.length - 1} customer records`);
    expect(errors).toEqual([]);
  });

  test('respects the roster search term', async ({ page }) => {
    const errors = await openCustomerTable(page);
    const all = await exportCsv(page);
    const firstName = all[1].split(',')[1]?.replace(/^"|"$/g, '').trim();
    expect(firstName, 'roster CSV has a name column').toBeTruthy();
    await page.locator('#customerListSearch').fill(firstName);
    const filtered = await exportCsv(page);
    expect(filtered.length).toBeGreaterThan(1);
    expect(filtered.length).toBeLessThan(all.length);
    for (const row of filtered.slice(1)) expect(row.toLowerCase()).toContain(firstName.toLowerCase());
    expect(errors).toEqual([]);
  });
});
