import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = 4174; // Distinct port to avoid clashes

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
        let pathname = decodeURIComponent(parsedUrl.pathname);
        if (pathname === '/' || pathname === '') {
          pathname = '/index.html';
        }

        const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
        const filePath = path.join(ROOT_DIR, safePath);

        if (!filePath.startsWith(ROOT_DIR)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }

        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          res.statusCode = 404;
          res.end('Not Found');
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache'
        });

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
      } catch (err) {
        res.statusCode = 500;
        res.end('Internal Server Error: ' + err.message);
      }
    });

    server.listen(PORT, () => {
      console.log(`Inventory static server listening on http://localhost:${PORT}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

async function runInventory() {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  const results = {
    mobile: { controlsFound: 0, errors: [] },
    desktop: { controlsFound: 0, errors: [] }
  };

  try {
    const viewports = [
      { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
      { name: 'desktop', width: 1280, height: 800, isMobile: false, hasTouch: false }
    ];

    for (const vp of viewports) {
      console.log(`\nScanning inventory for viewport: ${vp.name} (${vp.width}x${vp.height})...`);
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile,
        hasTouch: vp.hasTouch
      });
      const page = await context.newPage();

      const errors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      page.on('pageerror', (err) => {
        errors.push(err.message);
      });

      await page.goto(`http://localhost:${PORT}`);
      await page.waitForLoadState('domcontentloaded');

      // Check horizontal overflow
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      console.log(`  Horizontal overflow: ${hasHorizontalOverflow ? 'FAILED (detected overflow)' : 'PASSED (0 overflow)'}`);

      // Enumerate visible controls
      const controls = await page.evaluate(() => {
        const selectors = [
          'button',
          'a[href]',
          'input',
          'select',
          'textarea',
          '[role="button"]',
          '[role="tab"]',
          '[role="columnheader"]',
          '[data-quick-action]',
          '[data-nav-target]'
        ];
        const elements = document.querySelectorAll(selectors.join(', '));
        const items = [];
        elements.forEach((el, index) => {
          const rect = el.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none' && window.getComputedStyle(el).visibility !== 'hidden';
          if (isVisible) {
            items.push({
              tag: el.tagName.toLowerCase(),
              id: el.id || null,
              className: el.className || null,
              text: (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 40),
              type: el.getAttribute('type') || null,
              role: el.getAttribute('role') || null,
              ariaLabel: el.getAttribute('aria-label') || null,
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            });
          }
        });
        return items;
      });

      console.log(`  Visible interactive controls: ${controls.length}`);
      results[vp.name].controlsFound = controls.length;
      results[vp.name].errors = errors;

      // Ensure screenshots folder exists
      const screenshotDir = path.join(ROOT_DIR, 'test-results', 'inventory');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }
      await page.screenshot({ path: path.join(screenshotDir, `inventory-${vp.name}.png`), fullPage: false });
      console.log(`  Screenshot saved: test-results/inventory/inventory-${vp.name}.png`);

      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n--- Inventory Scan Summary ---');
  console.log(`Mobile (390x844): ${results.mobile.controlsFound} controls, ${results.mobile.errors.length} console errors`);
  console.log(`Desktop (1280x800): ${results.desktop.controlsFound} controls, ${results.desktop.errors.length} console errors`);
  return results;
}

runInventory().catch((err) => {
  console.error('Inventory error:', err);
  process.exit(1);
});
