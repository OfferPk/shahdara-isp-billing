/**
 * topbar-search-trigger-355.spec.mjs
 * Issue #355: the top-bar search trigger must not keep the browser-default
 * light-grey box; its computed background must match the other top-bar
 * icon buttons in both themes (dark: rgb(20, 36, 31)).
 */
import { test, expect } from '@playwright/test';

async function triggerBg(page, theme) {
  await page.addInitScript((t) => localStorage.setItem('shahdara_theme', t), theme);
  await page.goto('/#/home');
  const el = page.locator('#mobileCustomerSearchTrigger');
  await expect(el).toBeAttached();
  return el.evaluate((node) => {
    const cs = getComputedStyle(node);
    return { bg: cs.backgroundColor, border: cs.borderTopColor, radius: cs.borderTopLeftRadius };
  });
}

test.describe('Issue 355: top-bar search trigger styling', () => {
  test('dark mode: dark chrome, not the browser default grey', async ({ page }) => {
    const m = await triggerBg(page, 'dark');
    expect(m.bg).toBe('rgb(20, 36, 31)');
    expect(m.border).toBe('rgb(37, 61, 53)');
    expect(m.radius).toBe('8px');
  });

  test('light mode: surface background like its neighbours', async ({ page }) => {
    const m = await triggerBg(page, 'light');
    expect(m.bg).toBe('rgb(255, 255, 255)');
    expect(m.radius).toBe('8px');
  });
});
