import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const TARGET_URL = process.env.TARGET_URL || 'https://offerpk.github.io/shahdara-isp-billing/';
const OUTPUT_DIR = path.resolve('test-results/smoke');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function runSmokeForViewport(browser, name, viewport, isMobile = false) {
  console.log(`\n--- Running smoke test for ${name} (${viewport.width}x${viewport.height}) on ${TARGET_URL} ---`);
  const context = await browser.newContext({
    viewport,
    isMobile,
    hasTouch: isMobile
  });

  const page = await context.newPage();
  const failedRequests = [];
  const pageErrors = [];

  page.on('response', (res) => {
    const status = res.status();
    const url = res.url();
    // Ignore external analytics or CDN third parties if any
    if (status >= 400 && !url.includes('google-analytics')) {
      failedRequests.push({ url, status });
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.message || String(err));
  });

  // Navigate with retries
  let loaded = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
      if (response && response.status() < 400) {
        loaded = true;
        break;
      }
    } catch (e) {
      console.warn(`Attempt ${attempt} failed: ${e.message}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, 4000));
    }
  }

  if (!loaded) {
    throw new Error(`Failed to load target URL ${TARGET_URL} after 3 attempts`);
  }

  // Wait for billing dashboard on root route
  await page.waitForSelector('#billingDashboard', { state: 'visible', timeout: 15000 });

  // Verify header is within bounds (no horizontal scroll)
  const isOverflowing = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });

  const screenshotPath = path.join(OUTPUT_DIR, `smoke-${name}-home.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`Saved screenshot: ${screenshotPath}`);

  // Navigate to #/customers and verify customer view is visible
  const customersUrl = TARGET_URL.replace(/#.*$/, '') + '#/customers';
  await page.goto(customersUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('#customersView', { state: 'visible', timeout: 15000 });

  const customersScreenshotPath = path.join(OUTPUT_DIR, `smoke-${name}-customers.png`);
  await page.screenshot({ path: customersScreenshotPath, fullPage: false });
  console.log(`Saved screenshot: ${customersScreenshotPath}`);

  if (pageErrors.length > 0) {
    throw new Error(`Page errors detected on ${name}:\n${pageErrors.join('\n')}`);
  }

  if (failedRequests.length > 0) {
    throw new Error(`Failed network requests on ${name}:\n${JSON.stringify(failedRequests, null, 2)}`);
  }

  if (isOverflowing) {
    throw new Error(`Horizontal scroll overflow detected on ${name} (${viewport.width}px)!`);
  }

  console.log(`✓ Smoke test passed for ${name}: 0 errors, 0 failed requests, 0 overflow.`);
  await context.close();
}

async function main() {
  const browser = await chromium.launch();
  try {
    await runSmokeForViewport(browser, 'mobile', { width: 390, height: 844 }, true);
    await runSmokeForViewport(browser, 'desktop', { width: 1280, height: 800 }, false);
    console.log('\nAll smoke checks PASSED successfully!');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('\nSMOKE TEST FAILED:', err);
  process.exit(1);
});
