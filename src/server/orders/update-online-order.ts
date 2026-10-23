import { deliverBackInStockAlerts } from "@/server/back-in-stock/deliver-alerts";
import { revalidatePublic } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import {
  createCustomerOrderPaymentNotification,
  createCustomerOrderStatusNotification,
} from "@/server/customer-notifications/create-customer-notification";
import { prisma } from "@/server/db/prisma";

import { cancelOrder } from "./cancel-order";
import { OrderStatusError } from "./order-status-error";
import {
  canTransitionOnlineOrder,
  isOnlineOrderStatus,
  type OnlineOrderStatus,
} from "./online-order-status";

export async function transitionOnlineOrder(
  orderId: string,
  next: OnlineOrderStatus,
) {
  let restoredVoucher = false;
  let restockedProductIds: string[] = [];
  const updated = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        code: true,
        channel: true,
        fulfillmentStatus: true,
        customerAccountId: true,
      },
    });
    if (
      !order ||
      order.channel !== "online" ||
      !order.fulfillmentStatus ||
      !isOnlineOrderStatus(order.fulfillmentStatus)
    ) {
      throw new OrderStatusError(
        "ORDER_NOT_FOUND",
        "Không tìm thấy đơn online",
      );
    }
    if (!canTransitionOnlineOrder(order.fulfillmentStatus, next)) {
      throw new OrderStatusError(
        "INVALID_TRANSITION",
        "Chuyển trạng thái không hợp lệ",
      );
    }
    if (next === "cancelled") {
      const cancelled = await cancelOrder(orderId, tx);
      restoredVoucher = cancelled.voucherCode !== null;
      restockedProductIds = cancelled.restockedProductIds;
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { fulfillmentStatus: "cancelled" },
      });
      await createCustomerOrderStatusNotification(tx, order, next);
      return updated;
    }
    const updated = await tx.order.update({
      where: { id: orderId, fulfillmentStatus: order.fulfillmentStatus },
      data: { fulfillmentStatus: next },
    });
    await createCustomerOrderStatusNotification(tx, order, next);
    return updated;
  });
  // Huy don da hoan ton kho (va luot voucher) trong transaction tren — cancelOrder
  // voi txClient khong tu revalidate/bao co hang nen lam o day, sau commit.
  if (next === "cancelled") {
    if (restoredVoucher) {
      revalidatePublic(CACHE_TAGS.catalog, CACHE_TAGS.vouchers);
    } else {
      revalidatePublic(CACHE_TAGS.catalog);
    }
    await deliverBackInStockAlerts(restockedProductIds);
  }
  return updated;
}

export async function markOnlineOrderPaid(orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        code: true,
        channel: true,
        status: true,
        customerAccountId: true,
      },
    });
    if (!order || order.channel !== "online")
      throw new OrderStatusError(
        "ORDER_NOT_FOUND",
        "Không tìm thấy đơn online",
      );
    if (order.status === "cancelled")
      throw new OrderStatusError("ORDER_CANCELLED", "Đơn đã hủy");
    await tx.payment.updateMany({
      where: { orderId, receivedAt: null },
      data: { receivedAt: new Date() },
    });
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: "paid" },
    });
    await createCustomerOrderPaymentNotification(tx, order);
    return updated;
  });
}
