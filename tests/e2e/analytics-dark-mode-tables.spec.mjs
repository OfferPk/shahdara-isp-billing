// Issue #361: the Area & zone service summary table painted area/mohalla
// rows with hardcoded light backgrounds and no dark override, so in dark
// mode the rows stayed near-white while the text went light.
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Seeds locations only — summary rows come from the customers'
// current area/mohalla/zone, no bills needed — then asserts the row
// backgrounds and text are light-on-dark in dark mode and keep their
// light tints in light mode, at 390px width.
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

async function seedLocations(page) {
  await page.evaluate(async () => {
    const core = await import('./core.js');
    const s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const [c0, c1, c2] = s.customers.slice(0, 3);
    const next = { ...s, customers: s.customers.map((c) => {
      if (c.id === c0.id) return { ...c, area: 'Shahdara', zone: 'Zone 1' };
      if (c.id === c1.id) return { ...c, area: 'Shahdara', mohalla: 'Mohalla A', zone: 'Zone 2' };
      if (c.id === c2.id) return { ...c, mohalla: 'Margalla' };
      return c;
    }) };
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(next));
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

async function rowColors(page, level) {
  return page.evaluate((level) => {
    const row = document.querySelector(`#areaSummaryTable tr.summary-row-${level}`);
    if (!row) return null;
    const th = row.querySelector('th');
    const td = row.querySelector('td');
    const value = row.querySelector('.location-summary-value');
    const cs = (el, prop) => (el ? getComputedStyle(el)[prop] : null);
    return { thBg: cs(th, 'backgroundColor'), tdBg: cs(td, 'backgroundColor'), text: cs(value, 'color') };
  }, level);
}

test.describe('Issue 361: service summary table rows in dark mode', () => {
  test.setTimeout(180000);

  test('at 390px: area/mohalla/zone rows are dark-surfaced with light text in dark mode', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await seedLocations(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/analytics');
    await expect(page.locator('#areaSummaryTable tr.summary-row-area').first()).toBeVisible();
    await expect(page.locator('#areaSummaryTable tr.summary-row-zone').first()).toBeVisible();

    // Light mode first: the parent/child tints are the light ones.
    const lightArea = await rowColors(page, 'area');
    expect(lightArea).not.toBeNull();
    expect(luminance(lightArea.thBg)).toBeGreaterThan(0.8);

    // Dark mode: every row level goes dark, text stays light.
    await page.evaluate(() => localStorage.setItem('shahdara_theme', 'dark'));
    await page.reload();
    await page.goto('/#/analytics');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('#areaSummaryTable tr.summary-row-area').first()).toBeVisible();
    for (const level of ['area', 'mohalla', 'zone']) {
      const colors = await rowColors(page, level);
      expect(colors, `${level} row must render`).not.toBeNull();
      expect(luminance(colors.thBg), `${level} th background must be dark`).toBeLessThan(0.15);
      expect(luminance(colors.tdBg), `${level} td background must be dark`).toBeLessThan(0.15);
      expect(luminance(colors.text), `${level} label text must be light`).toBeGreaterThan(0.4);
    }
    // The parent/child ladder survives in dark mode: area is the lightest
    // of the three row tints, zone sits on the card surface.
    const area = await rowColors(page, 'area');
    const zone = await rowColors(page, 'zone');
    expect(luminance(area.thBg)).toBeGreaterThan(luminance(zone.thBg));
    expect(errors).toEqual([]);
  });
});
