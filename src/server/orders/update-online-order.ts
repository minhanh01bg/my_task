import { prisma } from "@/server/db/prisma";

import {
  canTransitionOnlineOrder,
  isOnlineOrderStatus,
  type OnlineOrderStatus,
} from "./online-order-status";
import { cancelOrder } from "./cancel-order";

export async function transitionOnlineOrder(
  orderId: string,
  next: OnlineOrderStatus,
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { channel: true, fulfillmentStatus: true },
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
    await cancelOrder(orderId);
    return prisma.order.update({
      where: { id: orderId },
      data: { fulfillmentStatus: "cancelled" },
    });
  }
  return prisma.order.update({
    where: { id: orderId, fulfillmentStatus: order.fulfillmentStatus },
    data: { fulfillmentStatus: next },
  });
}

export async function markOnlineOrderPaid(orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { channel: true, status: true },
    });
    if (!order || order.channel !== "online")
      throw new Error("Không tìm thấy đơn online");
    if (order.status === "cancelled") throw new Error("Đơn đã hủy");
    await tx.payment.updateMany({
      where: { orderId, receivedAt: null },
      data: { receivedAt: new Date() },
    });
    return tx.order.update({
      where: { id: orderId },
      data: { status: "paid" },
    });
  });
}
