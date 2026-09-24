import { PrismaClient } from "@prisma/client";

import { logger } from "@/lib/logger";

/**
 * Pragma SQLite chay mot lan khi tao client: WAL cho phep doc song song voi
 * ghi, busy_timeout cho request ghi cho khoa thay vi loi "database is locked".
 * journal_mode duoc luu trong file; cac pragma con lai theo tung ket noi nen
 * pool bi gioi han 1 ket noi (xem `withSqliteConnectionLimit`).
 */
const SQLITE_PRAGMAS = [
  "PRAGMA journal_mode=WAL;",
  "PRAGMA busy_timeout=5000;",
  "PRAGMA synchronous=NORMAL;",
  "PRAGMA foreign_keys=ON;",
] as const;

type RawQueryClient = {
  $queryRawUnsafe: (query: string) => Promise<unknown>;
};

function isSqliteFileUrl(url: string | undefined): url is string {
  return url?.startsWith("file:") ?? false;
}

/**
 * SQLite chi co mot writer; voi pool nhieu ket noi, cac transaction doc-roi-ghi
 * dong thoi tranh nhau nang cap khoa va tra ve P1008/P2028 hang loat. Mot ket
 * noi duy nhat xep hang chung trong pool cua Prisma (cho toi `maxWait`) va dam
 * bao moi truy van deu thay pragma theo ket noi o tren.
 */
export function withSqliteConnectionLimit(
  url: string | undefined,
): string | undefined {
  if (!isSqliteFileUrl(url) || /[?&]connection_limit=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}connection_limit=1`;
}

export async function applySqlitePragmas(
  client: RawQueryClient,
  databaseUrl: string | undefined = process.env.DATABASE_URL,
): Promise<void> {
  if (!isSqliteFileUrl(databaseUrl)) return;

  for (const pragma of SQLITE_PRAGMAS) {
    try {
      await client.$queryRawUnsafe(pragma);
    } catch (error) {
      logger.warn("Khong ap dung duoc pragma SQLite", {
        pragma,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function createPrismaClient(): PrismaClient {
  const datasourceUrl = withSqliteConnectionLimit(process.env.DATABASE_URL);
  return new PrismaClient({
    ...(datasourceUrl ? { datasourceUrl } : {}),
    transactionOptions: { maxWait: 10_000, timeout: 15_000 },
  });
}

/**
 * Singleton an toan voi HMR — Next dev reload module lien tuc, neu tao
 * PrismaClient moi moi lan se can kiet connection.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaReady: Promise<void> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

/** Khong chan import; `register()` trong instrumentation await luc boot. */
export const prismaReady: Promise<void> =
  globalForPrisma.prismaReady ?? applySqlitePragmas(prisma);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaReady = prismaReady;
}
