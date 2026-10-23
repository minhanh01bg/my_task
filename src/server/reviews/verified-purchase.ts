import type { Prisma } from "@prisma/client";

import type { prisma } from "@/server/db/prisma";

import { recomputeProductRating } from "./product-rating";

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

/**
 * Goi trong transaction cua `cancelOrder`, SAU khi don da chuyen `cancelled`:
 * danh gia "da mua" cua chu don cho cac san pham trong don ma khong con don nao
 * khac du dieu kien thi bo nhan da mua va tinh lai diem san pham. Nguoi goi
 * revalidate `catalog` sau commit (trang san pham gan ca tag nay).
 */
export async function revokeCancelledPurchaseReviews(
  tx: Prisma.TransactionClient,
  order: {
    customerAccountId: string | null;
    items: { productId: string | null }[];
  },
): Promise<void> {
  const accountId = order.customerAccountId;
  if (!accountId) return;
  const productIds = [
    ...new Set(order.items.flatMap((item) => item.productId ?? [])),
  ];
  if (productIds.length === 0) return;

  const reviews = await tx.productReview.findMany({
    where: {
      accountId,
      productId: { in: productIds },
      isVerifiedPurchase: true,
    },
    select: { id: true, productId: true },
  });
  for (const review of reviews) {
    if (await hasVerifiedPurchase(tx, accountId, review.productId)) continue;
    await tx.productReview.update({
      where: { id: review.id },
      data: { isVerifiedPurchase: false },
      select: { id: true },
    });
    await recomputeProductRating(tx, review.productId);
  }
}
