import type { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

export async function createOnlineOrderNotification(
  tx: TransactionClient,
  order: { id: string; code: string; total: number },
) {
  return tx.adminNotification.create({
    data: {
      eventKey: `online-order:${order.id}:created`,
      kind: "online_order_created",
      title: "Có đơn online mới",
      body: `Đơn ${order.code} · ${order.total.toLocaleString("vi-VN")} ₫`,
      entityType: "order",
      entityId: order.id,
      href: `/admin/orders/${encodeURIComponent(order.id)}`,
    },
  });
}
