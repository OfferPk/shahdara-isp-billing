import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.mjs',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'mobile',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        browserName: 'chromium'
      }
    },
    {
      name: 'desktop',
      use: {
        viewport: { width: 1280, height: 800 },
        browserName: 'chromium'
      }
    }
  ],
  webServer: {
    command: 'node tests/e2e/static-server.mjs',
    port: 4173,
    reuseExistingServer: true,
    timeout: 10000
  }
});
