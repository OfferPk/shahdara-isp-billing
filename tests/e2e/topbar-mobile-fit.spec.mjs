// Top-bar phone fit (2026-10-29 hotfix). Owner report: on his phone the
// "Backup: Due" pill and the options after it were clipped — the language
// toggle was half off-screen and the theme + field-mode buttons were
// unreachable. Root causes (see tests/topbar-mobile-fit.test.js): an
// unclosed @media block in components.css, a backup-badge label-hide rule
// that matched no element, and a non-shrinking .topbar-actions row.
// This spec pins the outcome in a real browser: at 360px and 390px every
// visible top-bar action sits fully inside the viewport, the page has no
// horizontal overflow, and the buttons actually work; at 620px the full
// text labels are back and everything still fits.
import { test, expect } from '@playwright/test';

const ACTION_IDS = [
  'navDrawerToggle',
  'backupHealthBadge',
  'mobileCustomerSearchTrigger',
  'qrScanTopbarBtn',
  'topbarPendingActionsBtn',
  'languageToggleBtn',
  'themeToggle',
  'fieldModeToggleBtn'
];

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
  await page.waitForTimeout(400);
}

async function expectAllActionsInsideViewport(page, width) {
  const report = await page.evaluate((ids) => {
    const out = { scrollWidth: document.documentElement.scrollWidth, items: {} };
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) { out.items[id] = 'missing'; continue; }
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') { out.items[id] = 'hidden'; continue; }
      const r = el.getBoundingClientRect();
      out.items[id] = { x: r.x, right: r.right, width: r.width };
    }
    return out;
  }, ACTION_IDS);
  expect(report.scrollWidth, 'page must not gain horizontal overflow').toBeLessThanOrEqual(width);
  for (const id of ACTION_IDS) {
    const item = report.items[id];
    expect(item, `${id} must be present and visible`).not.toBe('missing');
    expect(item, `${id} must not be display:none at this width`).not.toBe('hidden');
    expect(item.x, `${id} must start inside the viewport`).toBeGreaterThanOrEqual(0);
    expect(item.right, `${id} must end inside the ${width}px viewport (was ${item.right})`).toBeLessThanOrEqual(width);
    expect(item.width, `${id} must keep a tappable width`).toBeGreaterThanOrEqual(24);
  }
}

test.describe('topbar fit at 360px', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test('every top-bar action is fully inside the viewport and works', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await expectAllActionsInsideViewport(page, 360);

    // Backup badge compacts to its status emoji; the text label is hidden
    // but the badge (and its aria-label) remains the backup action.
    await expect(page.locator('#backupHealthLabel')).toBeHidden();
    await expect(page.locator('#backupHealthBadge')).toBeVisible();

    // Drawer opens from the hamburger (close via the drawer's own button —
    // the open drawer overlays the top bar).
    await page.click('#navDrawerToggle');
    await expect(page.locator('#navDrawerToggle')).toHaveAttribute('aria-expanded', 'true');
    await page.click('#navDrawerClose');
    await expect(page.locator('#navDrawerToggle')).toHaveAttribute('aria-expanded', 'false');

    // QR scanner opens from the (previously unstyled at some widths) camera button.
    await page.click('#qrScanTopbarBtn');
    await expect(page.locator('#qrScannerModal')).toBeVisible();
    await page.keyboard.press('Escape');

    // Theme toggle flips the theme.
    const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await page.click('#themeToggle');
    const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(after).not.toBe(before);

    // Language toggle (icon-only at this width) still switches language.
    await page.click('#languageToggleBtn');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ur');
    await page.click('#languageToggleBtn');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // Field mode opens.
    await page.click('#fieldModeToggleBtn');
    await expect(page.locator('#fieldModeView')).toBeVisible();

    expect(errors, `no page errors: ${errors.join(' | ')}`).toEqual([]);
  });
});

test.describe('topbar fit at 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('every top-bar action is fully inside the viewport', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await expectAllActionsInsideViewport(page, 390);
    expect(errors, `no page errors: ${errors.join(' | ')}`).toEqual([]);
  });
});

test.describe('topbar fit at 620px', () => {
  test.use({ viewport: { width: 620, height: 800 } });

  test('full labels return and everything still fits', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await expectAllActionsInsideViewport(page, 620);
    // Above 480px the backup pill shows its full text again and the
    // language toggle shows its label; the QR button keeps its styled
    // 38px chrome (it lost it above 480px while the media block was open).
    await expect(page.locator('#backupHealthLabel')).toBeVisible();
    await expect(page.locator('#languageToggleLabel')).toBeVisible();
    const qrWidth = await page.evaluate(() => document.getElementById('qrScanTopbarBtn').getBoundingClientRect().width);
    expect(qrWidth).toBe(38);
    expect(errors, `no page errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
