/**
 * a11y-baseline-229.spec.mjs
 * #229 accessibility baseline gate: axe-core scan of the core routes in
 * light + dark, mobile + desktop. Serious/critical violations fail the
 * suite. Also checks the global :focus-visible ring and 200% text zoom
 * without horizontal scroll.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ROUTES = [
  { name: 'home', hash: '/#/home', ready: '#billingDashboard' },
  { name: 'customers', hash: '/#/customers', ready: '#customerList' },
  { name: 'reports', hash: '/#/reports', ready: 'body[data-screen="reports"]' },
  { name: 'transactions', hash: '/#/transactions', ready: 'body[data-screen="transactions"]' },
  { name: 'expenses', hash: '/#/expenses', ready: 'body[data-screen="expenses"]' }
];

async function scanRoute(page, route) {
  await page.goto(route.hash);
  await page.waitForSelector(route.ready, { timeout: 20000 });
  await page.waitForTimeout(700);
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
}

for (const theme of ['light', 'dark']) {
  for (const vp of [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1280, height: 800 }]) {
    test(`axe: 0 serious/critical on core routes (${theme}, ${vp.name})`, async ({ page }) => {
      test.setTimeout(240000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.addInitScript((t) => { try { localStorage.setItem('shahdara_theme', t); } catch {} }, theme);
      const failures = [];
      for (const route of ROUTES) {
        const bad = await scanRoute(page, route);
        for (const v of bad) failures.push(`${route.name}: [${v.impact}] ${v.id} (${v.nodes.length} nodes) e.g. ${v.nodes[0]?.target?.join(' ')}`);
      }
      // Customer detail (drill-down) is a route of its own.
      await page.goto('/#/customers');
      await page.waitForSelector('#customerList');
      await page.locator('#customerList [data-customer-id]').first().click();
      await page.waitForTimeout(800);
      const detailBad = await new AxeBuilder({ page }).analyze()
        .then(r => r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical'));
      for (const v of detailBad) failures.push(`customer-detail: [${v.impact}] ${v.id} (${v.nodes.length} nodes) e.g. ${v.nodes[0]?.target?.join(' ')}`);
      expect(failures, failures.join('\n')).toEqual([]);
    });
  }
}

test('keyboard focus ring is visible (:focus-visible)', async ({ page }) => {
  await page.goto('/#/home');
  await page.waitForSelector('#billingDashboard');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { tag: el.tagName, width: cs.outlineWidth, style: cs.outlineStyle };
  });
  expect(outline, 'an element should receive keyboard focus').not.toBeNull();
  expect(outline.style).not.toBe('none');
  expect(parseFloat(outline.width)).toBeGreaterThanOrEqual(2);
});

test('200% text zoom: no horizontal scroll on home and customers', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/home');
  await page.waitForSelector('#billingDashboard');
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  await page.waitForTimeout(400);
  for (const hash of ['/#/home', '/#/customers']) {
    await page.goto(hash);
    await page.waitForTimeout(600);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${hash} overflows by ${overflow}px at 200% text size`).toBeLessThanOrEqual(1);
  }
});
