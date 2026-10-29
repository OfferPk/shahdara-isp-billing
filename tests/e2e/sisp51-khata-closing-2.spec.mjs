// SISP-51: Owner Khata Closing Report 2.0 — Payment Channel Split &
// Closing Roznamcha Cash-in-Hand. CI-only Playwright spec (the repo's
// Playwright runner cannot run in the VM; written for CI, not claimed
// as run locally). Seeds a synthetic October 2026 ledger whose
// Rs. 10,000 collection arrives via Direct Cash / Waseem Shop /
// EasyPaisa (the spec split), plus a roznamcha drawer whose month-end
// day (2026-10-31) is closed with Rs. 7,000 counted. Checks, at a real
// 360px viewport:
//   - the Owner Khata modal shows the "Collections by channel" lines
//     with the exact spec amounts;
//   - the closing cash-in-hand line shows the frozen Rs. 7,000 with
//     its closed-through date;
//   - no horizontal overflow at 360px.
import { test, expect } from '@playwright/test';

const SEED_KEY = 'shahdara-isp-billing-v1';
const ROZNAMCHA_KEY = 'sisp_roznamcha_v1';

async function seed(page) {
  await page.addInitScript(([seedKey, roznamchaKey]) => {
    const state = {
      version: 1,
      nextCustomerNumber: 2,
      customers: [
        { id: 'c1', customerNumber: 1, name: 'E2E Ali', bills: [
          { month: '2026-10', dueAmount: 10000, payments: [
            { id: 'p1', date: '2026-10-05', amount: 4000, method: 'Cash' },
            { id: 'p2', date: '2026-10-06', amount: 3000, method: 'Cash at Waseem shop' },
            { id: 'p3', date: '2026-10-07', amount: 3000, method: 'Easypaisa' },
          ] },
        ] },
      ],
      expenses: [],
      monthlyClosings: [],
    };
    window.localStorage.setItem(seedKey, JSON.stringify(state));
    const days = [
      { date: '2026-10-31', closed: true, openingBalance: 0, cashIn: 4000, shopIn: 3000,
        cashPayments: [], handovers: [], outflows: [], expectedClosing: 7000,
        closingBalance: 7000, countedCash: 7000, discrepancy: 0, closedAt: '2026-10-31T20:00:00.000Z' },
    ];
    window.localStorage.setItem(roznamchaKey, JSON.stringify(days));
  }, [SEED_KEY, ROZNAMCHA_KEY]);
}

test('owner khata 2.0 shows the channel split and closing cash-in-hand at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await seed(page);
  await page.goto('/');
  await expect(page.locator('#openOwnerKhataModalBtn')).toBeVisible();
  await page.locator('#openOwnerKhataModalBtn').click();
  await expect(page.locator('#ownerKhataModal')).toBeVisible();
  await page.locator('#ownerKhataMonth').fill('2026-10');
  await page.locator('#ownerKhataMonth').dispatchEvent('change');
  const body = page.locator('#ownerKhataBody');
  await expect(body).toContainText('Collections by channel');
  await expect(body).toContainText('Direct Cash');
  await expect(body).toContainText('Rs. 4,000');
  await expect(body).toContainText('Waseem Abbasi Shop');
  await expect(body).toContainText('Easypaisa');
  await expect(body).toContainText('Rs. 3,000');
  await expect(body).toContainText('Closing Cash-in-Hand (Roznamcha)');
  await expect(body).toContainText('Rs. 7,000');
  await expect(body).toContainText('2026-10-31');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
