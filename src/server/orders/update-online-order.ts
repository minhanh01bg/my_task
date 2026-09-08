import {
  createCustomerOrderPaymentNotification,
  createCustomerOrderStatusNotification,
} from "@/server/customer-notifications/create-customer-notification";
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
  return prisma.$transaction(async (tx) => {
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
