// Issue #361: the Customer rankings filters sat in a cramped 2-column
// grid on narrow screens, so select values clipped ("Highest-payir…",
// "All recorded a…"). The fix stacks the rankings filters full-width at
// ≤700px. Written to run in CI (the repo Playwright runner cannot run
// in the dev VM). Seeds bills + receipts so the default Highest-paying
// ranking renders rows, then asserts at 390px that the filter grid is a
// single column, the Area select spans (nearly) the full panel width,
// and ranking rows stay readable in light and dark mode. Data, order
// and the "Open ledger" action are untouched — presence of the button
// is asserted, it is not clicked.
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

async function seedRankings(page) {
  await page.evaluate(async () => {
    const core = await import('./core.js');
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const [c0, c1, c2] = s.customers.slice(0, 3);
    s = { ...s, customers: s.customers.map((c) => {
      if (c.id === c0.id) return { ...c, area: 'Shahdara', zone: 'Zone 1', packageSpeed: '10 Mbps' };
      if (c.id === c1.id) return { ...c, area: 'Shahdara', zone: 'Zone 2', packageSpeed: '15 Mbps' };
      if (c.id === c2.id) return { ...c, mohalla: 'Margalla', packageSpeed: '10 Mbps' };
      return c;
    }) };
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
    s = core.saveBillMonth(s, c0.id, { month, dueAmount: '1000', status: 'pending' });
    s = core.addPayment(s, c0.id, month, { date: `${month}-06`, amount: '900', method: 'Cash' });
    s = core.saveBillMonth(s, c1.id, { month, dueAmount: '500', status: 'pending' });
    s = core.saveBillMonth(s, c2.id, { month, dueAmount: '300', status: 'pending' });
    s = core.addPayment(s, c2.id, month, { date: `${month}-06`, amount: '300', method: 'Cash' });
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
  });
  await page.reload();
}

function luminance(rgb) {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return -1;
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => {
    const s = Number(v) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

test.describe('Issue 361: customer rankings filters and rows at 390px', () => {
  test.setTimeout(180000);

  test('filters stack full-width and rows stay readable in light and dark', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await seedRankings(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/reports');
    const rows = page.locator('#customerRankingResults .owner-result-card');
    await expect(rows.first()).toBeVisible();

    // The rankings filter grid is a single column: every select spans
    // (nearly) the full panel width instead of a cramped half column.
    const gridColumns = await page.evaluate(() => {
      const grid = document.querySelector('section[aria-labelledby="customerRankingHeading"] .owner-filter-grid');
      return getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    });
    expect(gridColumns).toBe(1);
    const areaSelectBox = await page.locator('#rankingArea').boundingBox();
    expect(areaSelectBox.width).toBeGreaterThan(300);
    await expect(page.locator('#rankingType option:checked')).toHaveText('Highest-paying customers');
    await expect(page.locator('#rankingArea option:checked')).toHaveText('All recorded areas');

    // Rows stay readable: name dark-on-light in light mode, and the
    // Open ledger action is present (not removed or relabelled).
    const lightRow = await page.evaluate(() => {
      const card = document.querySelector('#customerRankingResults .owner-result-card');
      const name = card.querySelector('.owner-result-main strong');
      const value = card.querySelector('.owner-result-value');
      return { cardBg: getComputedStyle(card).backgroundColor, name: getComputedStyle(name).color, value: getComputedStyle(value).color };
    });
    expect(luminance(lightRow.cardBg)).toBeGreaterThan(0.8);
    expect(luminance(lightRow.name)).toBeLessThan(0.4);
    expect(luminance(lightRow.value)).toBeLessThan(0.4);
    await expect(rows.first().locator('button[data-open-ranking-customer]')).toHaveText('Open ledger');

    // Dark mode: cards go dark, name and amount go light.
    await page.evaluate(() => localStorage.setItem('shahdara_theme', 'dark'));
    await page.reload();
    await page.goto('/#/reports');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(rows.first()).toBeVisible();
    const darkRow = await page.evaluate(() => {
      const card = document.querySelector('#customerRankingResults .owner-result-card');
      const name = card.querySelector('.owner-result-main strong');
      const value = card.querySelector('.owner-result-value');
      return { cardBg: getComputedStyle(card).backgroundColor, name: getComputedStyle(name).color, value: getComputedStyle(value).color };
    });
    expect(luminance(darkRow.cardBg)).toBeLessThan(0.15);
    expect(luminance(darkRow.name)).toBeGreaterThan(0.4);
    expect(luminance(darkRow.value)).toBeGreaterThan(0.4);
    expect(errors).toEqual([]);
  });
});
