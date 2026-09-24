import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

import { logger } from "@/lib/logger";
import { backfillSlugs } from "@/server/seo/backfill-slugs";

/**
 * Gán slug SEO cho sản phẩm/danh mục cũ (Task 10). Chạy lại an toàn:
 * `pnpm tsx scripts/backfill-slugs.ts`.
 */
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
} else if (existsSync(".env")) {
  process.loadEnvFile(".env");
}
process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./dev.db";

const prisma = new PrismaClient();

async function main() {
  const result = await backfillSlugs(prisma);
  logger.info("Đã gán slug SEO", result);
}

main()
  .catch((error: unknown) => {
    logger.error("Gán slug SEO thất bại", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
