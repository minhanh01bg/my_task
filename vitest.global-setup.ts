import { execSync } from "node:child_process";

import { TEST_DATABASE_URL } from "./tests/test-env";

/**
 * Chay mot lan truoc toan bo test suite: dong bo schema Prisma vao file
 * SQLite dung rieng cho test, de "pnpm test" tu chay duoc ma khong can
 * .env.local hay buoc setup thu cong nao khac (kem ca tren CI).
 */
export default function setup() {
  execSync("pnpm exec prisma db push --skip-generate --accept-data-loss", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
