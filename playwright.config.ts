import { pbkdf2Sync, randomBytes } from "node:crypto";

import { defineConfig, devices } from "@playwright/test";

/**
 * Cong 3000 hay bi chiem tren may dung chung — cho phep doi bang bien moi
 * truong thay vi phai sua file nay.
 */
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DATABASE_URL = process.env.DATABASE_URL ?? "file:./prisma/test.db";
const PRODUCTION_DIR = process.env.PLAYWRIGHT_PRODUCTION_DIR;
// Mật khẩu dùng một lần cho mỗi lần chạy (production từ chối hash mẫu như
// `123456`). Worker Playwright thừa kế process.env của tiến trình chính nên
// spec đọc lại qua e2e/credentials.ts; mật khẩu chủ khác mật khẩu cửa hàng.
const E2E_STORE_PASSWORD =
  (process.env.E2E_STORE_PASSWORD ||= `e2e-store-${randomBytes(12).toString("hex")}`);
const E2E_OWNER_PASSWORD =
  (process.env.E2E_OWNER_PASSWORD ||= `e2e-owner-${randomBytes(12).toString("hex")}`);

/** Cùng định dạng scripts/hash-password.ts, số vòng tối thiểu cho nhanh. */
function e2ePasswordHash(password: string) {
  const salt = randomBytes(16);
  const derived = pbkdf2Sync(password, salt, 100_000, 32, "sha256");
  return `pbkdf2-sha256:100000:${salt.toString("hex")}:${derived.toString("hex")}`;
}

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
      // Fixture login attempts must use separate Redis keys from production.
      RATE_LIMIT_KEY_SECRET:
        process.env.PLAYWRIGHT_RATE_LIMIT_KEY_SECRET ??
        "playwright-only-rate-limit-secret-at-least-32-chars",
      SESSION_SECRET:
        process.env.SESSION_SECRET ??
        "playwright-only-session-secret-at-least-32-chars",
      STORE_PASSWORD_HASH: e2ePasswordHash(E2E_STORE_PASSWORD),
      OWNER_PASSWORD_HASH: e2ePasswordHash(E2E_OWNER_PASSWORD),
    },
  },
});
