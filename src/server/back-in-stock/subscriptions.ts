import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";

/** Tran dang ky dang cho moi tai khoan: chan mot tai khoan dang ky hang loat. */
export const MAX_PENDING_BACK_IN_STOCK_PER_ACCOUNT = 50;

/** San pham ban online duoc (trang san pham khong 404). */
export const ONLINE_SELLABLE_PRODUCT_WHERE = {
  isActive: true,
  isService: false,
  deletedAt: null,
} satisfies Prisma.ProductWhereInput;

export type BackInStockFailureCode =
  | "product_not_found"
  | "product_in_stock"
  | "too_many_subscriptions";

export type BackInStockResult =
  | { ok: true }
  | { ok: false; code: BackInStockFailureCode };

/**
 * Bat bao co hang cho san pham dang het hang. Idempotent: da dang ky thi tra
 * ok. Mot transaction ngan (chi `tx`) de kiem tra ton kho, tran va ghi cung
 * luc — dot nhap hang commit truoc thi thay `stock > 0` va tra 409.
 */
export async function subscribeBackInStock(
  accountId: string,
  productId: string,
): Promise<BackInStockResult> {
  return prisma.$transaction(async (tx): Promise<BackInStockResult> => {
    const product = await tx.product.findFirst({
      where: { id: productId, ...ONLINE_SELLABLE_PRODUCT_WHERE },
      select: { stock: true },
    });
    if (!product) return { ok: false, code: "product_not_found" };
    if (product.stock > 0) return { ok: false, code: "product_in_stock" };

    const existing = await tx.backInStockSubscription.findUnique({
      where: { accountId_productId: { accountId, productId } },
      select: { id: true },
    });
    if (existing) return { ok: true };

    // Chi dem san pham khach con thay (va huy duoc) tren trang san pham.
    const pending = await tx.backInStockSubscription.count({
      where: { accountId, product: ONLINE_SELLABLE_PRODUCT_WHERE },
    });
    if (pending >= MAX_PENDING_BACK_IN_STOCK_PER_ACCOUNT) {
      return { ok: false, code: "too_many_subscriptions" };
    }

    await tx.backInStockSubscription.create({
      data: { accountId, productId },
      select: { id: true },
    });
    return { ok: true };
  });
}

/** Tat bao co hang. Luon ok — ke ca khi san pham da co hang hoac da xoa. */
export async function unsubscribeBackInStock(
  accountId: string,
  productId: string,
): Promise<{ ok: true }> {
  await prisma.backInStockSubscription.deleteMany({
    where: { accountId, productId },
  });
  return { ok: true };
}

export async function isSubscribedBackInStock(
  accountId: string,
  productId: string,
): Promise<boolean> {
  const row = await prisma.backInStockSubscription.findUnique({
    where: { accountId_productId: { accountId, productId } },
    select: { id: true },
  });
  return row !== null;
}
