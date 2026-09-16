import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'live-teacher-workspace.spec.ts',
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  timeout: 30000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4181',
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command: 'node apps/web/test/browser-server.js',
    url: 'http://127.0.0.1:4181',
    reuseExistingServer: false,
    timeout: 30000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
  },
});
