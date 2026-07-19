import { defineConfig, devices } from '@playwright/test'

const isProductionE2E = !!process.env.E2E_PRODUCTION

export default defineConfig({
  testDir: 'e2e',
  globalSetup: isProductionE2E ? undefined : require.resolve('./e2e/global-setup'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: isProductionE2E
    ? [{ name: 'production-https', use: { ...devices['Desktop Chrome'] } }]
    : [{ name: 'chromium', testIgnore: /production-host\.spec\.ts/, use: { ...devices['Desktop Chrome'] } }],
  webServer:
    isProductionE2E || process.env.PLAYWRIGHT_SKIP_WEBSERVER
      ? undefined
      : {
          command: 'npm run dev',
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
})
