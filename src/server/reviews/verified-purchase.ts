import type { Prisma } from "@prisma/client";

import type { prisma } from "@/server/db/prisma";

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * "Da mua": co don chua huy cua tai khoan chua san pham, va la don online da
 * giao xong (`fulfillmentStatus = completed`, xem `online-order-status.ts`)
 * hoac don POS da thanh toan. Don online co `status = paid` ngay khi dat nen
 * khong dung `status` cho kenh online.
 */
export async function hasVerifiedPurchase(
  db: DbClient,
  accountId: string,
  productId: string,
): Promise<boolean> {
  const order = await db.order.findFirst({
    where: {
      customerAccountId: accountId,
      status: { not: "cancelled" },
      items: { some: { productId } },
      OR: [
        { channel: "online", fulfillmentStatus: "completed" },
        { channel: "pos", status: "paid" },
      ],
    },
    select: { id: true },
  });
  return order !== null;
}
