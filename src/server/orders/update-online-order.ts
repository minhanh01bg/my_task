import {
  createCustomerOrderPaymentNotification,
  createCustomerOrderStatusNotification,
} from "@/server/customer-notifications/create-customer-notification";
import { revalidatePublic } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import { prisma } from "@/server/db/prisma";

import { cancelOrder } from "./cancel-order";
import {
  canTransitionOnlineOrder,
  isOnlineOrderStatus,
  type OnlineOrderStatus,
} from "./online-order-status";

export async function transitionOnlineOrder(
  orderId: string,
  next: OnlineOrderStatus,
) {
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
      throw new Error("Không tìm thấy đơn online");
    }
    if (!canTransitionOnlineOrder(order.fulfillmentStatus, next)) {
      throw new Error("Chuyển trạng thái không hợp lệ");
    }
    if (next === "cancelled") {
      await cancelOrder(orderId, tx);
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
  // Huy don da hoan ton kho trong transaction tren — lam moi catalog sau commit.
  if (next === "cancelled") revalidatePublic(CACHE_TAGS.catalog);
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
      throw new Error("Không tìm thấy đơn online");
    if (order.status === "cancelled") throw new Error("Đơn đã hủy");
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
