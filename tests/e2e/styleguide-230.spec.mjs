/**
 * styleguide-230.spec.mjs
 * #230: the dev styleguide renders tokens + components in both themes and
 * the theme toggle actually swaps the token values.
 */
import { test, expect } from '@playwright/test';

test.describe('Issue #230: design system styleguide', () => {
  test('renders tokens and components; toggle switches theme values', async ({ page }) => {
    await page.goto('/styleguide.html');
    await expect(page.locator('h1')).toContainText('Design System');
    for (const sel of ['.ds-btn--primary', '.ds-chip--paid', '.ds-card', '.ds-kpi', '.ds-row', '.ds-sheet', '.ds-toast', '.ds-empty', '.ds-skeleton']) {
      await expect(page.locator(sel).first()).toBeVisible();
    }
    const light = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      green: getComputedStyle(document.documentElement).getPropertyValue('--green').trim(),
      surface: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim()
    }));
    expect(light.theme).toBe('light');
    expect(light.green).toBe('#145b4b');
    expect(light.surface).toBe('#ffffff');

    await page.locator('#themeToggle').click();
    const dark = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      green: getComputedStyle(document.documentElement).getPropertyValue('--green').trim(),
      surface: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim()
    }));
    expect(dark.theme).toBe('dark');
    expect(dark.green).toBe('#29b88f');
    expect(dark.surface).toBe('#14241f');
  });
});
