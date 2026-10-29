// SISP-54: Monthly Collection Thermometer & Area-Wise Daily Run-Rate
// Forecaster. CI-only Playwright spec (the repo's Playwright runner
// cannot run in the VM; written for CI, not claimed as run locally).
// Seeds a minimal synthetic ledger for the CURRENT Pakistan-Time
// month and checks, at a real 360px viewport:
//   - the thermometer section renders on Home with the pool progress
//     (two Rs. 3,000 bills, one paid → 50%);
//   - the area bars list both mohallas (paid BARRIAN at 100%, unpaid
//     PALALIYAA at 0% with the full amount remaining);
//   - the card stays on theme tokens in dark mode;
//   - no horizontal overflow at 360px.
import { test, expect } from '@playwright/test';

const SEED_KEY = 'shahdara-isp-billing-v1';

async function seed(page) {
  await page.addInitScript(seedKey => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const get = type => parts.find(p => p.type === type).value;
    const month = `${get('year')}-${get('month')}`;
    const state = {
      version: 1,
      nextCustomerNumber: 3,
      customers: [
        { id: 'c1', customerNumber: 1, name: 'E2E Paid Customer', mohalla: 'BARRIAN', bills: [
          { month, dueAmount: 3000, payments: [
            { id: 'p1', date: `${month}-05`, amount: 3000, method: 'Cash' }
          ] }
        ] },
        { id: 'c2', customerNumber: 2, name: 'E2E Due Customer', mohalla: 'PALALIYAA', bills: [
          { month, dueAmount: 3000, payments: [] }
        ] }
      ],
      expenses: [],
      monthlyClosings: []
    };
    window.localStorage.setItem(seedKey, JSON.stringify(state));
  }, SEED_KEY);
}

test('thermometer shows pool progress and area bars at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await seed(page);
  await page.goto('/');

  const section = page.locator('#collectionForecastSection');
  await expect(section).toBeVisible();
  await expect(page.locator('#collectionForecastPct')).toHaveText('50%');
  await expect(page.locator('#collectionForecastCollected')).toContainText('3,000');

  const areas = page.locator('#collectionForecastAreas .fcst-area-row');
  await expect(areas).toHaveCount(2);
  await expect(areas.nth(0)).toContainText('PALALIYAA');
  await expect(areas.nth(0)).toContainText('0%');
  await expect(areas.nth(1)).toContainText('BARRIAN');
  await expect(areas.nth(1)).toContainText('100%');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('thermometer card renders on theme tokens in dark mode', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await seed(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('shahdara_theme', 'dark'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#collectionForecastSection')).toBeVisible();
  await expect(page.locator('#collectionForecastPct')).toHaveText('50%');
  const cardBg = await page.locator('.collection-forecast-card').evaluate(el => getComputedStyle(el).backgroundColor);
  expect(cardBg).not.toBe('rgb(255, 255, 255)');
});
