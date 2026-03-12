import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuratie voor E2E tests van de collaborative 3D editor.
 * 
 * Deze configuratie ondersteunt:
 * - Multi-browser testing voor real-time collaboration scenarios
 * - Network conditioning voor offline/reconnect tests
 * - Parallel execution van meerdere browser instances
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Sequential voor collaboration tests
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Één worker voor consistente multi-user tests
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  
  // Globale timeout voor collaboration tests
  timeout: 60000,
  expect: {
    timeout: 10000,
  },

  use: {
    // Base URL voor de applicatie
    baseURL: 'http://localhost:5173',
    
    // Trace bij failures
    trace: 'on-first-retry',
    
    // Screenshot bij failures
    screenshot: 'only-on-failure',
    
    // Video opnemen voor debugging
    video: 'retain-on-failure',
  },

  // Projecten voor verschillende test scenarios
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    // Multi-user collaboration tests
    {
      name: 'collaboration',
      use: { 
        ...devices['Desktop Chrome'],
        // Extra lange timeouts voor sync tests
        actionTimeout: 15000,
      },
      testMatch: '**/collaboration/**/*.spec.ts',
    },
    // Offline/reconnect tests
    {
      name: 'network',
      use: { 
        ...devices['Desktop Chrome'],
      },
      testMatch: '**/network/**/*.spec.ts',
    },
  ],

  // Start de dev server automatisch
  webServer: [
    {
      command: 'npm run server',
      port: 1234,
      reuseExistingServer: !process.env.CI,
      timeout: 10000,
    },
    {
      command: 'npm run dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
  ],
});
