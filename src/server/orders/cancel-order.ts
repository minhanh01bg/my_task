import type { Prisma } from "@prisma/client";

import { deliverBackInStockAlerts } from "@/server/back-in-stock/deliver-alerts";
import { revalidatePublic } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import { prisma } from "@/server/db/prisma";
import { revokeCancelledPurchaseReviews } from "@/server/reviews/verified-purchase";

import { OrderStatusError } from "./order-status-error";

export interface CancelOrderResult {
  /** false khi don khong ton tai hoac da huy tu truoc (khong ghi gi). */
  cancelled: boolean;
  /** Ma voucher vua duoc hoan mot luot — nguoi goi can revalidate tag vouchers. */
  voucherCode: string | null;
  /** San pham vua duoc hoan ton kho — nguoi goi bao "co hang" sau commit. */
  restockedProductIds: string[];
}

/**
 * Huy don: hoan ton kho, giam `soldCount` (moi dong mot lan — khop voi
 * createOrder, khong am) va hoan mot luot voucher (khong am). Idempotent —
 * huy don da huy khong lam gi them, neu khong se cong ton kho nhieu lan.
 *
 * Khi truyen `txClient`, transaction thuoc ve nguoi goi: sau khi transaction
 * cua ho commit, nguoi goi PHAI goi `revalidatePublic(CACHE_TAGS.catalog)` va,
 * neu ket qua co `voucherCode`, ca `CACHE_TAGS.vouchers`; roi
 * `deliverBackInStockAlerts(restockedProductIds)`
 * (xem `transitionOnlineOrder` trong update-online-order.ts).
 */
export async function cancelOrder(
  orderId: string,
  txClient?: Prisma.TransactionClient,
): Promise<CancelOrderResult> {
  const runner = async (
    tx: Prisma.TransactionClient,
  ): Promise<CancelOrderResult> => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order || order.status === "cancelled") {
      return { cancelled: false, voucherCode: null, restockedProductIds: [] };
    }

    if (order.fulfillmentStatus === "completed") {
      throw new OrderStatusError(
        "ORDER_COMPLETED",
        "Không thể hủy đơn hàng đã hoàn tất",
      );
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "cancelled",
        ...(order.channel === "online"
          ? { fulfillmentStatus: "cancelled" }
          : {}),
      },
    });

    const restocked = new Set<string>();
    for (const item of order.items) {
      if (item.isService || !item.productId) continue;

      restocked.add(item.productId);
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
      // createOrder tang soldCount +1 moi dong; MAX(0, ...) de khong am khi
      // du lieu cu da bi chinh tay. Prisma khong co decrement co san.
      await tx.$executeRaw`
        UPDATE "Product"
        SET "soldCount" = MAX(0, "soldCount" - 1)
        WHERE "id" = ${item.productId}
      `;

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          delta: item.quantity,
          reason: "cancel",
          refId: orderId,
        },
      });
    }

    if (order.voucherCode) {
      await tx.$executeRaw`
        UPDATE "Voucher"
        SET "usedCount" = MAX(0, "usedCount" - 1)
        WHERE "code" = ${order.voucherCode}
      `;
    }

    // Don vua huy khong con la bang chung "da mua" cho danh gia cua chu don.
    await revokeCancelledPurchaseReviews(tx, order);

    return {
      cancelled: true,
      voucherCode: order.voucherCode,
      restockedProductIds: [...restocked],
    };
  };

  if (txClient) {
    return runner(txClient);
  }

  const result = await prisma.$transaction(runner);
  if (!result.cancelled) return result;
  if (result.voucherCode) {
    revalidatePublic(CACHE_TAGS.catalog, CACHE_TAGS.vouchers);
  } else {
    revalidatePublic(CACHE_TAGS.catalog);
  }
  await deliverBackInStockAlerts(result.restockedProductIds);
  return result;
}
