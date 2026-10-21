/**
 * home-summary-cards-style.spec.mjs
 * The Home summary (KPI) cards share the Today's Summary card's geometry
 * and every card carries the animated gradient border line.
 */
import { test, expect } from '@playwright/test';

test.describe('Home summary cards: khulasa-matched style + animated line', () => {
  test('cards match today-card radius/shadow and the gradient line moves', async ({ page }) => {
    await page.goto('/#/home');
    await page.waitForSelector('.summary-card');
    const probe = await page.evaluate(() => {
      const card = document.querySelector('.summary-card');
      const today = document.querySelector('.home-today-card');
      const cs = getComputedStyle(card);
      const ts = getComputedStyle(today);
      const before = getComputedStyle(card, '::before');
      const todayBefore = getComputedStyle(today, '::before');
      return {
        cardRadius: cs.borderRadius, todayRadius: ts.borderRadius,
        cardShadow: cs.boxShadow, todayShadow: ts.boxShadow,
        animName: before.animationName, stripBg: before.backgroundImage,
        stripH: before.height, todayStripBg: todayBefore.backgroundImage,
        pos1: before.backgroundPosition
      };
    });
    expect(probe.cardRadius).toBe(probe.todayRadius);
    expect(probe.cardShadow).toBe(probe.todayShadow);
    expect(probe.animName).toBe('summary-line-flow');
    expect(probe.stripBg).toContain('linear-gradient');
    expect(probe.todayStripBg).toContain('linear-gradient');
    expect(parseFloat(probe.stripH)).toBeGreaterThanOrEqual(3);
    await page.waitForTimeout(900);
    const pos2 = await page.evaluate(() => getComputedStyle(document.querySelector('.summary-card'), '::before').backgroundPosition);
    expect(pos2).not.toBe(probe.pos1);
  });
});
