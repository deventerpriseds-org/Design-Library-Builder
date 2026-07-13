import { defineConfig, devices } from '@playwright/test'

// Only override the executable when explicitly set (CCR environment).
// On CI, Playwright uses the browser it installs via `npx playwright install`.
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH || ''
const launchOptions = chromiumPath ? { executablePath: chromiumPath } : {}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions,
      },
    },
    {
      // iPhone 13 viewport via Chromium — WebKit not pre-installed on CI runners
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        launchOptions,
      },
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
