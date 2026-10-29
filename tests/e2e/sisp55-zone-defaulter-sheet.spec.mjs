// SISP-55: Printable Monthly Zone Defaulter Sheet for Field Linemen.
// CI-only Playwright spec (the repo's Playwright runner cannot run in
// the VM; written for CI, not claimed as run locally).
// Seeds a minimal synthetic ledger for the CURRENT Pakistan-Time
// month and checks, at a real 360px viewport:
//   - the Zone Collection Sheet dialog opens from the Top Defaulters
//     modal and previews only unpaid, non-snoozed defaulters;
//   - the zone picker narrows the preview to one canonical zone;
//   - the Waada toggle brings the snoozed customer back in;
//   - the dialog surface stays on theme tokens in dark mode;
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
      nextCustomerNumber: 5,
      customers: [
        { id: 'c1', customerNumber: 1, name: 'E2E Due One', mohalla: 'BARRIAN', poleNumber: 'Pole #9', bills: [
          { month, dueAmount: 3000, payments: [] }
        ] },
        { id: 'c2', customerNumber: 2, name: 'E2E Due Two', mohalla: 'PALALIYAA', bills: [
          { month, dueAmount: 2000, payments: [] }
        ] },
        { id: 'c3', customerNumber: 3, name: 'E2E Waada', mohalla: 'BARRIAN', promiseDate: '2099-01-01', bills: [
          { month, dueAmount: 1500, payments: [] }
        ] },
        { id: 'c4', customerNumber: 4, name: 'E2E Paid', mohalla: 'BARRIAN', bills: [
          { month, dueAmount: 2500, payments: [
            { id: 'p4', date: `${month}-05`, amount: 2500, method: 'Cash' }
          ] }
        ] }
      ],
      expenses: [],
      monthlyClosings: []
    };
    window.localStorage.setItem(seedKey, JSON.stringify(state));
  }, SEED_KEY);
}

async function openZoneSheet(page) {
  await page.goto('/#/home');
  await page.click('#dashboardOpenTopDefaultersBtn');
  await expect(page.locator('#topDefaultersModal')).toBeVisible();
  await page.click('#topDefaultersZoneSheetBtn');
  await expect(page.locator('#zoneSheetDialog')).toBeVisible();
}

test('zone sheet dialog previews defaulters, filters by zone, and honours the Waada toggle at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await seed(page);
  await openZoneSheet(page);

  // Default: the Waada-snoozed and the paid customer stay out —
  // 2 defaulters, PKR 5,000 total.
  const preview = page.locator('#zoneSheetPreview');
  await expect(preview).toContainText('2');
  await expect(preview).toContainText('5,000');

  // Zone picker offers both canonical zones with counts.
  const options = page.locator('#zoneSheetZoneSelect option');
  await expect(options).toHaveCount(3); // All zones + Barrian + Palaliyaa

  // Narrowing to Barrian leaves the single Barrian defaulter.
  await page.selectOption('#zoneSheetZoneSelect', 'barrian');
  await expect(preview).toContainText('1');
  await expect(preview).toContainText('3,000');

  // Including Waada-snoozed customers brings the promised one back.
  await page.selectOption('#zoneSheetZoneSelect', 'all');
  await page.check('#zoneSheetWaadaToggle');
  await expect(preview).toContainText('3');
  await expect(preview).toContainText('6,500');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('zone sheet dialog uses the theme modal surface in dark mode', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await seed(page);
  await page.goto('/#/home');
  await page.evaluate(() => localStorage.setItem('shahdara_theme', 'dark'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await openZoneSheet(page);
  const bg = await page.locator('#zoneSheetDialog').evaluate(el => window.getComputedStyle(el).backgroundColor);
  expect(bg).not.toBe('rgb(255, 255, 255)');
});
