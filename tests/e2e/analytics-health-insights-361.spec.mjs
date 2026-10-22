// Issue #361: the Analytics screen showed "Business Health Score: Not
// available, 0 of 6 factors" with empty factor groups and no guidance.
// The score engine already computed from saved data — this spec proves,
// with realistic saved history, that (1) the score and factors render from
// that data on the Analytics screen, (2) with no history every unavailable
// factor says in plain language what unlocks it, (3) the new ISP insights
// strip (collection rate this vs last month, overdue trend, new/lost
// customers) renders from the same saved data, and (4) the Analytics
// screen has no horizontal page scroll at 390px in light or dark mode.
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  return errors;
}

async function boot(page) {
  await page.goto('/#/home');
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

// Give every seeded customer an added-on date and priced bills + payments
// across the three completed months before the current one, so the health
// window (last three completed months) has real saved data.
async function seedHistory(page) {
  await page.evaluate(async () => {
    const core = await import('./core.js');
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const now = new Date();
    const completed = [];
    for (let back = 1; back <= 3; back++) {
      const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
      completed.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    s = { ...s, customers: s.customers.map(c => ({ ...c, addedOn: '2026-01-01' })) };
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
    for (const month of completed) {
      for (const c of s.customers.slice(0, 10)) {
        s = core.saveBillMonth(s, c.id, { month, dueAmount: '1000', status: 'pending' });
        s = core.addPayment(s, c.id, month, { date: `${month}-10`, amount: '900', method: 'Cash' });
      }
    }
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
  });
  await page.reload();
}

test.describe('Issue 361: Analytics health score + ISP insights from saved data', () => {
  test.setTimeout(180000);

  test('with saved history: score computes, factors render, insights strip shows real figures', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await seedHistory(page);
    await page.goto('/#/analytics');
    const panel = page.locator('#businessHealthScore');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.business-health-score-value')).not.toHaveText('Not available');
    await expect(panel.locator('.business-health-availability')).toContainText('of 6 factors available');
    const availability = await panel.locator('.business-health-availability').textContent();
    const availableCount = Number((availability || '').match(/(\d+) of 6/)?.[1] || 0);
    expect(availableCount).toBeGreaterThanOrEqual(4);
    const insights = page.locator('#ispInsights');
    await expect(insights).toBeVisible();
    await expect(insights).toContainText('Collection rate');
    await expect(insights.locator('.isp-trend-row')).toHaveCount(4);
    await expect(insights).toContainText('New customers');
    await expect(insights).toContainText('Lost customers');
    expect(errors).toEqual([]);
  });

  test('fresh data: unavailable factors explain what unlocks them', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await page.goto('/#/analytics');
    const panel = page.locator('#businessHealthScore');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.business-health-availability')).toContainText('0 of 6 factors available');
    const steps = panel.locator('.business-health-next-step');
    expect(await steps.count()).toBeGreaterThanOrEqual(4);
    await expect(steps.first()).toContainText('What unlocks this:');
    const insights = page.locator('#ispInsights');
    await expect(insights).toBeVisible();
    await expect(insights).toContainText('Not available');
    expect(errors).toEqual([]);
  });

  test('no horizontal page scroll at 390px, light and dark', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await page.goto('/#/analytics');
    await expect(page.locator('#businessHealthScore')).toBeVisible();
    const light = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    expect(light.sw).toBeLessThanOrEqual(light.iw);
    await page.evaluate(() => localStorage.setItem('shahdara_theme', 'dark'));
    await page.reload();
    await page.goto('/#/analytics');
    await expect(page.locator('#businessHealthScore')).toBeVisible();
    const dark = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, theme: document.documentElement.dataset.theme }));
    expect(dark.theme).toBe('dark');
    expect(dark.sw).toBeLessThanOrEqual(dark.iw);
    expect(errors).toEqual([]);
  });
});
