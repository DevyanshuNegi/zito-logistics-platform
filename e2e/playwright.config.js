// E2E Testing Configuration - Playwright
// Tests critical user flows across all portals

module.exports = {
  testDir: './tests',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false, // Login state shared
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    viewport: { width: 1280, height: 720 }
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: { browserName: 'chromium' }
    },
    {
      name: 'Mobile Chrome',
      use: { 
        browserName: 'chromium',
        viewport: { width: 375, height: 667 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' 
      }
    }
  ]
};
