// Issue #368: at 390px the Business Health Score badge was squeezed into
// a 95px box while its content needed 134px — "Not available" was clipped
// ("Not / availab…") and the heading block overflowed its card (378px in
// 340px). The fix stacks the heading at <=620px (the score badge takes a
// full-width row under the title, value may wrap). This spec pins the
// geometry on a fresh install (the "Not available" state) at 390px in
// light and dark, and confirms the desktop side-by-side layout is intact.
import { test, expect } from '@playwright/test';

async function openAnalytics(page, theme) {
  await page.goto('/#/home');
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.evaluate(t => { localStorage.clear(); localStorage.setItem('shahdara_theme', t); }, theme);
  await page.reload();
  await page.goto('/#/analytics');
  await expect(page.locator('#businessHealthScore')).toBeVisible();
  await expect(page.locator('.business-health-score-value')).toHaveText('Not available');
}

async function measure(page) {
  return page.evaluate(() => {
    const score = document.querySelector('.business-health-score');
    const heading = document.querySelector('.business-health-heading');
    const value = document.querySelector('.business-health-score-value');
    return {
      score: { client: score.clientWidth, scroll: score.scrollWidth },
      heading: { client: heading.clientWidth, scroll: heading.scrollWidth },
      value: { client: value.clientWidth, scroll: value.scrollWidth },
      doc: { sw: document.documentElement.scrollWidth, iw: window.innerWidth }
    };
  });
}

test.describe('Issue 368: health score badge at mobile width', () => {
  test.setTimeout(120000);

  test('390px light: badge and heading do not overflow', async ({ page }) => {
    await openAnalytics(page, 'light');
    const m = await measure(page);
    expect(m.score.scroll).toBeLessThanOrEqual(m.score.client + 1);
    expect(m.heading.scroll).toBeLessThanOrEqual(m.heading.client + 1);
    expect(m.value.scroll).toBeLessThanOrEqual(m.value.client + 1);
    expect(m.doc.sw).toBeLessThanOrEqual(m.doc.iw);
  });

  test('390px dark: badge and heading do not overflow', async ({ page }) => {
    await openAnalytics(page, 'dark');
    const m = await measure(page);
    expect(m.score.scroll).toBeLessThanOrEqual(m.score.client + 1);
    expect(m.heading.scroll).toBeLessThanOrEqual(m.heading.client + 1);
    expect(m.value.scroll).toBeLessThanOrEqual(m.value.client + 1);
    expect(m.doc.sw).toBeLessThanOrEqual(m.doc.iw);
  });
});
