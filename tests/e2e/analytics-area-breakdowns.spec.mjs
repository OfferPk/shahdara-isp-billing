// Issue #361: Area Analytics — area, zone & package breakdown cards.
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Seeded history is written through the app's own core helpers plus
// direct localStorage patches for location and package snapshots, the same
// pattern as the analytics-health-insights-361 spec. Assertions check
// rendered groups and self-consistent properties, not fixed amounts.
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  return errors;
}

async function boot(page) {
  await page.goto('/#/home');
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

async function seedBreakdowns(page) {
  await page.evaluate(async () => {
    const core = await import('./core.js');
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const [c0, c1, c2] = s.customers.slice(0, 3);
    s = { ...s, customers: s.customers.map((c) => {
      if (c.id === c0.id) return { ...c, area: 'Shahdara', zone: 'Zone 1' };
      if (c.id === c1.id) return { ...c, mohalla: 'Shahdara', zone: 'Zone 2' };
      if (c.id === c2.id) return { ...c, mohalla: 'Margalla' };
      return c;
    }) };
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
    s = core.saveBillMonth(s, c0.id, { month, dueAmount: '1000', status: 'pending' });
    s = core.addPayment(s, c0.id, month, { date: `${month}-06`, amount: '900', method: 'Cash' });
    s = core.saveBillMonth(s, c1.id, { month, dueAmount: '500', status: 'pending' });
    s = core.saveBillMonth(s, c2.id, { month, dueAmount: '300', status: 'pending' });
    s = core.addPayment(s, c2.id, month, { date: `${month}-06`, amount: '300', method: 'Cash' });
    // Deterministic package snapshots and past due dates for overdue math.
    s = { ...s, customers: s.customers.map((c) => {
      const label = c.id === c2.id ? '15 Mbps' : '10 Mbps';
      return { ...c, bills: (c.bills ?? []).map((b) => (b.month === month ? { ...b, dueDate: `${month}-05`, packageSnapshot: { label } } : b)) };
    }) };
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
  });
  await page.reload();
}

test.describe('Issue 361: Area, zone & package breakdown cards', () => {
  test.setTimeout(180000);

  test('with saved history: area, zone and package cards render with rates and overdue', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await seedBreakdowns(page);
    await page.goto('/#/analytics');
    const section = page.locator('#areaBreakdowns');
    await expect(section).toBeVisible();
    await expect(section.locator('.area-breakdown-totals')).toContainText('Total billed');
    await expect(section.locator('.area-breakdown-totals')).toContainText('Overdue bills');
    const areas = section.locator('.area-breakdown-group[aria-label="Areas"]');
    await expect(areas).toContainText('Shahdara');
    await expect(areas).toContainText('Margalla');
    const zones = section.locator('.area-breakdown-group[aria-label="Zones"]');
    await expect(zones).toContainText('Shahdara · Zone 1');
    await expect(zones).toContainText('Shahdara · Zone 2');
    const packages = section.locator('.area-breakdown-group[aria-label="Packages"]');
    await expect(packages).toContainText('10 Mbps');
    await expect(packages).toContainText('15 Mbps');
    const cards = section.locator('.area-breakdown-card');
    expect(await cards.count()).toBeGreaterThanOrEqual(6);
    await expect(section).toContainText('Collection rate');
    await expect(section).toContainText('Overdue bills · customers');
    expect(errors).toEqual([]);
  });

  test('fresh data: breakdown section shows its empty state', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await page.goto('/#/analytics');
    const section = page.locator('#areaBreakdowns');
    await expect(section).toBeVisible();
    await expect(section).toContainText('No priced bills are saved yet');
    expect(errors).toEqual([]);
  });

  test('no horizontal page scroll at 390px, light and dark', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await seedBreakdowns(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/analytics');
    await expect(page.locator('#areaBreakdowns')).toBeVisible();
    const light = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    expect(light.sw).toBeLessThanOrEqual(light.iw);
    await page.evaluate(() => localStorage.setItem('shahdara_theme', 'dark'));
    await page.reload();
    await page.goto('/#/analytics');
    await expect(page.locator('#areaBreakdowns')).toBeVisible();
    const dark = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, theme: document.documentElement.dataset.theme }));
    expect(dark.theme).toBe('dark');
    expect(dark.sw).toBeLessThanOrEqual(dark.iw);
    expect(errors).toEqual([]);
  });
});
