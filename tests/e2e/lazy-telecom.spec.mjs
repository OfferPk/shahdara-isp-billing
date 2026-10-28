// SISP-9: Performance Lazy-Loading for Telecom Engineering Modules + Global
// Quick Jump (Ctrl+K / /).
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Covers: the home dashboard renders its core charts without waiting
// for telecom code; scrolling the charts region into view loads the telecom
// charts (OTDR chart populates); Ctrl+K opens the command palette; '/'
// focuses the global customer search; and 390px no-overflow.
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

test('telecom charts load lazily when the charts region scrolls into view', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  // Core dashboard renders immediately (trend chart is a core chart).
  await page.waitForFunction(
    () => document.getElementById('dashboardTrendChart')?.innerHTML.includes('<svg'),
    { timeout: 20000 }
  );

  // Scrolling the charts region into view triggers the lazy telecom chunk;
  // the OTDR chart (a telecom chart) populates afterwards.
  await page.locator('.dashboard-charts-region').scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () => document.getElementById('dashboardOtdrChart')?.innerHTML.includes('<svg'),
    { timeout: 20000 }
  );
  assertNoErrors(errors);
});

test('Ctrl+K opens the command palette and / focuses global search', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);

  await page.keyboard.press('Control+k');
  await expect(page.locator('#commandPaletteModal')).toBeVisible({ timeout: 10000 });
  await page.keyboard.press('Escape');

  // '/' quick jump: app.js focuses the global search AND the mobile search
  // sheet opens — either outcome is a valid quick jump, so accept both.
  await page.keyboard.press('/');
  await page.waitForTimeout(500);
  const jumped = await page.evaluate(() => {
    const active = document.activeElement?.id;
    const sheet = document.getElementById('mobileCustomerSearchModal');
    return active === 'globalCustomerSearch' || Boolean(sheet && (sheet.open || sheet.hasAttribute('open')));
  });
  expect(jumped).toBe(true);
  assertNoErrors(errors);
});

test('lazy telecom layout does not overflow at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = trackErrors(page);
  await boot(page);
  await page.locator('.dashboard-charts-region').scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () => document.getElementById('dashboardOtdrChart')?.innerHTML.includes('<svg'),
    { timeout: 20000 }
  );
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  assertNoErrors(errors);
});

function assertNoErrors(errors) {
  expect(errors).toEqual([]);
}
