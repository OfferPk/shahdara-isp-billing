// #263: Quick Collect / Bulk Collect behave like app screens: Back closes the top sheet,
// #collect / #/collect deep links and reload open Quick Collect.
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  return errors;
}

const qc = page => page.locator('#quickCollectModal');
const bulk = page => page.locator('#bulkCollectModal');

async function openCollect(page, isMobile) {
  if (isMobile) await page.locator('[data-mobile-nav="collection"]').click();
  else await page.evaluate(() => window.quickCollectModalController.open());
  await expect(qc(page)).toBeVisible();
  await expect(page).toHaveURL(/#\/collect$/);
}

test.describe('#263 Collect routes', () => {
  test('one Back closes Quick Collect and stays on the screen underneath; Forward reopens it', async ({ page, isMobile }) => {
    const errors = trackErrors(page);
    await page.goto('/#/customers');
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'customers');
    await openCollect(page, isMobile);
    await page.goBack();
    await expect(qc(page)).toBeHidden();
    await expect(page).toHaveURL(/#\/customers$/);
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'customers');
    await expect(page.locator('#customersView')).toBeVisible();
    await page.goForward();
    await expect(qc(page)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Back from Home Collect returns to Home, not further back', async ({ page, isMobile }) => {
    const errors = trackErrors(page);
    await page.goto('/#/reports');
    await page.goto('/#/home');
    await openCollect(page, isMobile);
    await page.goBack();
    await expect(qc(page)).toBeHidden();
    await expect(page).toHaveURL(/#\/home$/);
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'home');
    expect(errors).toEqual([]);
  });

  test('closing with × or Esc also leaves the #/collect route (no stale history entry)', async ({ page, isMobile }) => {
    const errors = trackErrors(page);
    await page.goto('/#/customers');
    await openCollect(page, isMobile);
    await page.locator('#quickCollectModal .close-button').first().click();
    await expect(qc(page)).toBeHidden();
    await expect(page).toHaveURL(/#\/customers$/);
    await openCollect(page, isMobile);
    await page.keyboard.press('Escape');
    await expect(qc(page)).toBeHidden();
    await expect(page).toHaveURL(/#\/customers$/);
    expect(errors).toEqual([]);
  });

  test('Bulk Collect stacks: Back closes Bulk (batch kept) and returns to Quick Collect, Back again closes it; × closes both', async ({ page, isMobile }) => {
    const errors = trackErrors(page);
    await page.goto('/#/home');
    await openCollect(page, isMobile);
    await page.locator('#openBulkCollectBtn').click();
    await expect(bulk(page)).toBeVisible();
    await expect(page).toHaveURL(/#\/bulk-collect$/);
    await page.locator('#bulkCollectSearch').fill('nazeer');
    await page.locator('.bc-row [data-bulk-amount]').first().fill('500');
    await page.locator('.bc-row [data-bulk-add]').first().click();
    await expect(page.locator('#bulkCollectCount')).toHaveText('1 customer');

    await page.goBack();
    await expect(bulk(page)).toBeHidden();
    await expect(qc(page)).toBeVisible();
    await expect(page).toHaveURL(/#\/collect$/);
    await page.goBack();
    await expect(qc(page)).toBeHidden();
    await expect(page).toHaveURL(/#\/home$/);

    // The unsaved batch is still there when Bulk Collect is reopened.
    await openCollect(page, isMobile);
    await page.locator('#openBulkCollectBtn').click();
    await expect(page.locator('#bulkCollectCount')).toHaveText('1 customer');
    // × on Bulk closes Bulk and Quick Collect and returns to Home (one tap back to the app).
    await page.locator('#closeBulkCollectBtn').click();
    await expect(bulk(page)).toBeHidden();
    await expect(qc(page)).toBeHidden();
    await expect(page).toHaveURL(/#\/home$/);
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'home');
    expect(errors).toEqual([]);
  });

  for (const hash of ['#collect', '#/collect']) {
    test(`deep link ${hash} and reload open Quick Collect`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto(`/${hash}`);
      await expect(qc(page)).toBeVisible();
      await expect(page).toHaveURL(/#\/collect$/);
      await page.reload();
      await expect(qc(page)).toBeVisible();
      // Fits the screen.
      const box = await qc(page).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
      // Closing a deep-linked sheet lands on Home.
      await page.locator('#quickCollectModal .close-button').first().click();
      await expect(qc(page)).toBeHidden();
      await expect(page).toHaveURL(/#\/home$/);
      expect(errors).toEqual([]);
    });
  }

  test('#collect/bulk deep link opens Bulk Collect', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/#collect/bulk');
    await expect(bulk(page)).toBeVisible();
    await expect(page).toHaveURL(/#\/bulk-collect$/);
    expect(errors).toEqual([]);
  });
});
