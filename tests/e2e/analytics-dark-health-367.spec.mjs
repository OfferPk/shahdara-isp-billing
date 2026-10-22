// Issue #367: in dark mode the Business Health Score panel on Analytics
// kept its light gradient background while its text had already switched
// to dark-theme colours — near-white text on a near-white card (title,
// eyebrow, group headings unreadable). The fix gives the panel and score
// box the dark surfaces in dark-contrast.css and lifts the paragraph
// colours styles.css hard-codes for the light theme.
// This spec pins: panel background is a dark surface (no light gradient),
// and the title / availability text meet AA contrast against it.
import { test, expect } from '@playwright/test';

function luminance(r, g, b) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function parseRgb(text) {
  const m = String(text).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
}

test.describe('Issue 367: Business Health panel in dark mode', () => {
  test.setTimeout(120000);

  test('panel uses a dark surface and its text meets AA contrast', async ({ page }) => {
    await page.goto('/#/home');
    await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('shahdara_theme', 'dark'); });
    await page.reload();
    await page.goto('/#/analytics');
    const panel = page.locator('#businessHealthScore');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.business-health-heading h3')).toHaveText('Business Health Score');
    const measured = await panel.evaluate(host => {
      const cs = el => getComputedStyle(el);
      const pick = sel => host.querySelector(sel);
      return {
        panelBg: cs(host).backgroundColor,
        panelImage: cs(host).backgroundImage,
        titleColor: cs(pick('.business-health-heading h3')).color,
        periodColor: cs(pick('.business-health-heading p:not(.eyebrow)')).color,
        availabilityColor: cs(pick('.business-health-availability')).color,
        scoreBg: cs(pick('.business-health-score')).backgroundColor,
        groupColor: cs(pick('.business-health-group > h4')).color
      };
    });
    const bg = parseRgb(measured.panelBg);
    expect(bg, 'panel background parses').not.toBeNull();
    expect(measured.panelImage).toBe('none');
    // The panel itself must be a dark surface now.
    expect(luminance(bg.r, bg.g, bg.b)).toBeLessThan(0.05);
    const bgL = luminance(bg.r, bg.g, bg.b);
    const ratio = color => {
      const c = parseRgb(color);
      const l = luminance(c.r, c.g, c.b);
      return (Math.max(l, bgL) + 0.05) / (Math.min(l, bgL) + 0.05);
    };
    expect(ratio(measured.titleColor)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(measured.periodColor)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(measured.availabilityColor)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(measured.groupColor)).toBeGreaterThanOrEqual(4.5);
    const score = parseRgb(measured.scoreBg);
    expect(luminance(score.r, score.g, score.b)).toBeLessThan(0.05);
  });

  test('light mode panel is unchanged (light gradient kept)', async ({ page }) => {
    await page.goto('/#/home');
    await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('shahdara_theme', 'light'); });
    await page.reload();
    await page.goto('/#/analytics');
    const panel = page.locator('#businessHealthScore');
    await expect(panel).toBeVisible();
    const image = await panel.evaluate(host => getComputedStyle(host).backgroundImage);
    expect(image).toContain('linear-gradient');
  });
});
