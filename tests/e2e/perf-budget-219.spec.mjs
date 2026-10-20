import { test, expect } from '@playwright/test';

// Issue #219: first load must need <= 25 requests (was 154), and every
// feature must still work offline after that first load.
test.describe('#219 bundled first load', () => {
  test('home loads in <= 25 requests at 390x844 and 1280x800 and works offline after first load', async ({ page, context }) => {
    const requests = [];
    page.on('request', req => {
      const url = new URL(req.url());
      if (url.origin === 'http://localhost:4173') requests.push(url.pathname);
    });
    await page.goto('/');
    await expect(page.locator('#languageToggleBtn')).toBeVisible();
    // Let the entry bundles and their shared chunks settle (the app keeps a
    // service-worker update poll alive, so networkidle never fires).
    await page.waitForTimeout(1500);
    const unique = [...new Set(requests)];
    expect(unique.length, `first-load requests: ${unique.join(', ')}`).toBeLessThanOrEqual(25);
    expect(unique.filter(p => p.endsWith('.css'))).toHaveLength(1);

    // Wait until the service worker controls the page and has precached the
    // bundles, then go offline: the app must still load and show Home.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
      }
    });
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#languageToggleBtn')).toBeVisible();
    await context.setOffline(false);
  });
});
