import { defineConfig } from '@playwright/test';

const PORT = 5183;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Locally the installed Edge is used, so no browser download is needed; CI installs Chromium.
    channel: process.env.CI ? undefined : 'msedge',
  },
  // The tests run against the production build: the service worker only exists there.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
