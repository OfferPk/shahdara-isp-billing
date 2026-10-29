import { test, expect } from '@playwright/test';

// Regression spec for the user-reported Customers list bug (compact density,
// which is the default): the customer NAME was squeezed to ~42 px and
// ellipsized to "N…"/"A…" — effectively invisible. Measured cause (390 px,
// service Active + fee paid): the <li> grid gave the billing badge a ~156 px
// auto column ("Bill paid · Rs 1000/mo"), and inside the heading the
// "Service status: Active" pill took a non-shrinking 92 px, leaving
// .customer-copy just 42 px wide for the name (clientWidth 42 vs
// scrollWidth 222 for a 21-char name). The fix (ui-feedback.css, compact
// only) stacks the card — badge row under the card body — and lets the
// heading wrap so the status pill drops to its own line under the name,
// giving .customer-copy the full heading width. No information is removed:
// avatar, #number, package, service-status pill and billing badge all stay.

const LONG_NAME = 'SAMPLE CUSTOMER AHMAD';
const LONGEST_NAME = 'SHAHID MEHMOOD KHAN RAJPOOT';
const SHORT_NAME = 'ALI';

// Put the first three seeded customers into the user's realistic state:
// long names, service status Active (status pill visible), monthly fee set
// and the current month paid (full billing-badge text) — the exact
// combination that squeezed the name.
async function seedRealisticCustomers(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(async (names) => {
    const core = await import('./core.js');
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const month = new Date().toISOString().slice(0, 7);
    s.customers.slice(0, 3).forEach((c, i) => {
      c.name = names[i];
      c.serviceStatus = 'active';
      c.monthlySellingAmount = 1000 + i * 500;
    });
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
    s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    for (const c of s.customers.slice(0, 3)) {
      s = core.saveBillMonth(s, c.id, { month, dueAmount: c.monthlySellingAmount, status: 'pending' });
      s = core.addPayment(s, c.id, month, { date: `${month}-05`, amount: c.monthlySellingAmount, method: 'Cash' });
    }
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
  }, [LONG_NAME, SHORT_NAME, LONGEST_NAME]);
  await page.reload();
}

async function openCustomers(page, { theme = 'dark', density = 'compact' } = {}) {
  await page.evaluate(({ theme, density }) => {
    try {
      localStorage.setItem('shahdara_theme', theme);
      localStorage.setItem('shahdara_customer_density', density);
    } catch {}
  }, { theme, density });
  await page.reload();
  await page.goto('/#/customers');
  await page.evaluate(t => {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('shahdara_theme', t); } catch {}
  }, theme);
  await expect(page.locator('.customer-item').first()).toBeVisible();
  await expect(page.locator('#customerList')).toHaveClass(/cust-compact|cust-detailed/, { timeout: 10000 }).catch(() => {});
  if (density === 'compact') await expect(page.locator('#customerList.cust-compact')).toHaveCount(1);
}

function cardByName(page, name) {
  return page.locator('.customer-item', { has: page.locator('.customer-name', { hasText: name }) }).first();
}

async function nameMetrics(page, name) {
  const el = cardByName(page, name).locator('.customer-name');
  await expect(el).toHaveText(name);
  return el.evaluate(node => ({
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth,
    text: node.textContent
  }));
}

test.describe('Customers list — customer name must be visible (compact density)', () => {
  // Seeding + full app boot is slow on shared hardware (cf. #333/#337 specs).
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedRealisticCustomers(page);
  });

  for (const theme of ['dark', 'light']) {
    test(`full name renders without truncation at 390px (${theme})`, async ({ page }) => {
      await openCustomers(page, { theme, density: 'compact' });
      for (const name of [LONG_NAME, LONGEST_NAME]) {
        const m = await nameMetrics(page, name);
        expect(m.text, 'name text is the full name').toBe(name);
        expect(m.clientWidth, `${name}: name box must be wide enough to read`).toBeGreaterThanOrEqual(200);
        expect(m.scrollWidth, `${name}: not ellipsized`).toBeLessThanOrEqual(m.clientWidth);
      }
      // Nothing was removed to make room: status pill, billing badge and
      // package line are all still on the card.
      const card = cardByName(page, LONG_NAME);
      await expect(card.locator('.customer-manual-state')).toBeVisible();
      await expect(card.locator('.customer-manual-state')).toContainText('Service status: Active');
      await expect(card.locator('.customer-billing-badge')).toBeVisible();
      // In compact the badge paints its data-short label ("Bill paid · rs …")
      // via ::after; the raw chip text is "Paid · Rs …". Either proves the
      // paid billing badge survived the relayout.
      const badgeText = await card.locator('.customer-billing-badge').evaluate(el => `${el.dataset.short || ''} ${el.textContent}`);
      expect(badgeText).toMatch(/bill paid|paid/i);
      await expect(card.locator('.customer-card-package')).toBeVisible();
      await expect(card.locator('.avatar')).toBeVisible();
      await expect(card.locator('.customer-number-line')).toContainText('#');
    });
  }

  test('desktop compact list: name is not squeezed either', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openCustomers(page, { theme: 'dark', density: 'compact' });
    const m = await nameMetrics(page, LONG_NAME);
    expect(m.clientWidth).toBeGreaterThanOrEqual(200);
    expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
  });

  test('detailed density still shows the full name at 390px', async ({ page }) => {
    await openCustomers(page, { theme: 'dark', density: 'detailed' });
    const m = await nameMetrics(page, LONGEST_NAME);
    expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
  });
});
