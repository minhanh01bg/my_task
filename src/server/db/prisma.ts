import { PrismaClient } from "@prisma/client";

/**
 * Singleton an toan voi HMR — Next dev reload module lien tuc, neu tao
 * PrismaClient moi moi lan se can kiet connection.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
