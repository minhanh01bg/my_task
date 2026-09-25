import type { Customer, Order, OrderItem, Payment } from "@prisma/client";

import { prisma } from "@/server/db/prisma";

export type OrderDetail = Order & {
  customer: Customer | null;
  items: OrderItem[];
  payments: Payment[];
};

/**
 * Lấy thông tin chi tiết một đơn hàng kèm khách hàng, mặt hàng và lịch sử thanh toán.
 */
export async function getOrderDetail(id: string): Promise<OrderDetail | null> {
  return prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      items: true,
      payments: { orderBy: { createdAt: "asc" } },
    },
  });
}
