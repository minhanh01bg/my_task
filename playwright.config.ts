import { defineConfig, devices } from "@playwright/test";

/**
 * Cong 3000 hay bi chiem tren may dung chung — cho phep doi bang bien moi
 * truong thay vi phai sua file nay.
 */
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DATABASE_URL = process.env.DATABASE_URL ?? "file:./prisma/test.db";
const PRODUCTION_DIR = process.env.PLAYWRIGHT_PRODUCTION_DIR;
// Hash của credential fixture `123456`; chỉ dùng cho web server e2e cục bộ/CI.
const E2E_STORE_PASSWORD_HASH =
  "714989c4f592fda0ff69a63ef217e4b0:98dcc3f54f21aa15273f4836302084e830fa296f505bc7187ca79c022470fc0b";

// Global setup runs outside Next.js, so it cannot rely on Next loading .env.local.
process.env.DATABASE_URL = DATABASE_URL;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Cold compile tren may RAM thap can them thoi gian, van fail neu request treo.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  // Cac file dung chung SQLite va Setting; tranh ghi/restore fixture dong thoi.
  fullyParallel: false,
  workers: 1,
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
    command: PRODUCTION_DIR
      ? `pnpm start --port ${PORT}`
      : `pnpm dev --port ${PORT}`,
    url: BASE_URL,
    // Server phai dung dung DB/env fixture va song cung vong doi bo test.
    reuseExistingServer: false,
    env: {
      DATABASE_URL,
      CANONICAL_ORIGIN: process.env.PLAYWRIGHT_CANONICAL_ORIGIN ?? BASE_URL,
      ...(PRODUCTION_DIR ? { NEXT_DIST_DIR: PRODUCTION_DIR } : {}),
      SESSION_SECRET:
        process.env.SESSION_SECRET ??
        "playwright-only-session-secret-at-least-32-chars",
      STORE_PASSWORD_HASH:
        process.env.STORE_PASSWORD_HASH || E2E_STORE_PASSWORD_HASH,
    },
  },
});
