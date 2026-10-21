import { test, expect } from '@playwright/test';

// Dark mode: the Customers list cards must go dark with their text.
// Regression guard for the white-card leak: styles.css paints the card body
// (.customer-select.customer-profile-card-open) with a near-white gradient, and
// #288's dark-contrast.css darkened the <li> shell + text but not that button,
// leaving the customer name at ~1.1:1 (white-on-white).

const CONTRAST_FN = () => {
  const parseRGB = s => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(',').map(v => parseFloat(v)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const contrast = (fg, bg) => { const l1 = lum(fg), l2 = lum(bg); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const stopsOf = bgImage => { if (!bgImage || bgImage === 'none') return []; return [...bgImage.matchAll(/rgba?\([^)]+\)/g)].map(m => parseRGB(m[0])).filter(Boolean); };
  const effBg = el => {
    let node = el;
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node);
      const stops = stopsOf(cs.backgroundImage);
      if (stops.length) return stops;
      const c = parseRGB(cs.backgroundColor);
      if (c && c.a > 0) return [c];
      node = node.parentElement;
    }
    return [{ r: 255, g: 255, b: 255, a: 1 }];
  };
  window.__contrastOf = el => {
    const fg = parseRGB(getComputedStyle(el).color);
    return Math.min(...effBg(el).map(s => contrast(fg, s)));
  };
};

async function openCustomersDark(page) {
  await page.addInitScript(() => { try { localStorage.setItem('shahdara_theme', 'dark'); } catch {} });
  await page.goto('/#/customers');
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    try { localStorage.setItem('shahdara_theme', 'dark'); } catch {}
  });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.customer-item').first()).toBeVisible();
  await page.evaluate(CONTRAST_FN);
}

test.describe('Customers list in dark mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test('card body is a dark surface and the name/package read at >= 4.5:1', async ({ page }) => {
    await openCustomersDark(page);
    const card = page.locator('.customer-item').first();
    const buttonBg = await card.locator('.customer-select.customer-profile-card-open').evaluate(el => getComputedStyle(el).backgroundImage);
    expect(buttonBg).not.toContain('rgb(255, 255, 255)');
    expect(buttonBg).not.toContain('rgb(251, 253, 252)');
    expect(buttonBg).toMatch(/rgb\(29, 53, 46\)|rgb\(24, 45, 39\)/); // --dk-surface-2 / --dk-surface stops
    for (const sel of ['.customer-name', '.customer-number-line', '.customer-card-package', '.customer-card-stat strong', '.customer-card-open-hint', '.customer-health-reasons li']) {
      const ratio = await card.locator(sel).first().evaluate((el) => window.__contrastOf(el));
      expect(ratio, `${sel} contrast`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('service-choice chips are not white in dark mode and their text reads', async ({ page }) => {
    await openCustomersDark(page);
    const chips = page.locator('.customer-item').first().locator('.service-choice');
    const count = await chips.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const chip = chips.nth(i);
      const bg = await chip.evaluate(el => getComputedStyle(el).backgroundColor);
      expect(bg, `chip ${i} background`).not.toBe('rgb(255, 255, 255)');
      const ratio = await chip.evaluate(el => window.__contrastOf(el));
      expect(ratio, `chip ${i} contrast`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('selected card (aria-current) is visually distinct from unselected cards', async ({ page }) => {
    await openCustomersDark(page);
    await page.locator('.customer-item .customer-select').first().click();
    await page.waitForTimeout(600);
    // On mobile the tap opens the profile pane; return to the list where the
    // selected card keeps aria-current="true".
    if (await page.locator('.customer-item').first().isHidden().catch(() => false)) {
      await page.goBack();
      await expect(page.locator('.customer-item').first()).toBeVisible();
    }
    await page.evaluate(CONTRAST_FN); // navigation may have replaced the document
    const selected = page.locator('.customer-select.customer-profile-card-open[aria-current="true"]').first();
    await expect(selected).toBeVisible();
    const selectedBg = await selected.evaluate(el => getComputedStyle(el).backgroundImage);
    const unselected = page.locator('.customer-select.customer-profile-card-open[aria-current="false"]').first();
    if (await unselected.count()) {
      const plainBg = await unselected.evaluate(el => getComputedStyle(el).backgroundImage);
      expect(selectedBg).not.toBe(plainBg);
    }
    const nameRatio = await selected.locator('.customer-name').evaluate(el => window.__contrastOf(el));
    expect(nameRatio).toBeGreaterThanOrEqual(4.5);
  });

  test('light mode card is unchanged (white gradient)', async ({ page }) => {
    await page.goto('/#/customers');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
      try { localStorage.setItem('shahdara_theme', 'light'); } catch {}
    });
    await expect(page.locator('.customer-item').first()).toBeVisible();
    const buttonBg = await page.locator('.customer-item').first().locator('.customer-select.customer-profile-card-open')
      .evaluate(el => getComputedStyle(el).backgroundImage);
    expect(buttonBg).toContain('rgb(255, 255, 255)');
    const liBg = await page.locator('.customer-item').first().evaluate(el => getComputedStyle(el).backgroundColor);
    expect(liBg).toBe('rgb(255, 255, 255)');
  });
});
