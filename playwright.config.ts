import { defineConfig, devices } from "@playwright/test";

/**
 * Cong 3000 hay bi chiem tren may dung chung — cho phep doi bang bien moi
 * truong thay vi phai sua file nay.
 */
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    env: {
      STORE_PASSWORD_HASH: process.env.STORE_PASSWORD_HASH ?? "",
    },
  },
});
