import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './__tests__/e2e',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:3002',
    headless: false, // Show browser for debugging in WSL
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        browserName: 'chromium',
        // Force software rendering for WSL
        launchOptions: {
          args: ['--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox']
        }
      },
    },
  ],
  reporter: [['list'], ['html', { open: 'never' }]],
})