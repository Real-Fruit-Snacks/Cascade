import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  workers: 1,
  fullyParallel: false,
  use: {
    headless: false,
  },
  projects: [
    { name: 'tauri', use: { browserName: 'chromium' } },
  ],
});
