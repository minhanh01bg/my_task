"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminSession } from "@/server/auth/require-admin-session";
import { cancelOrder } from "@/server/orders/cancel-order";
import { isOnlineOrderStatus } from "@/server/orders/online-order-status";
import {
  markOnlineOrderPaid,
  transitionOnlineOrder,
} from "@/server/orders/update-online-order";

const orderIdSchema = z.string().trim().min(1);

export async function cancelOrderAction(orderId: string) {
  await requireAdminSession();
  const validOrderId = orderIdSchema.parse(orderId);

  await cancelOrder(validOrderId);
  revalidatePath("/admin/orders");
  revalidatePath("/pos");
}

export async function transitionOnlineOrderAction(
  orderId: string,
  next: string,
) {
  await requireAdminSession();
  const validOrderId = orderIdSchema.parse(orderId);

  if (!isOnlineOrderStatus(next)) {
    throw new Error("Trạng thái không hợp lệ");
  }

  await transitionOnlineOrder(validOrderId, next);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${validOrderId}`);
  revalidatePath("/shop");
}

export async function markOnlineOrderPaidAction(orderId: string) {
  await requireAdminSession();
  const validOrderId = orderIdSchema.parse(orderId);

  await markOnlineOrderPaid(validOrderId);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${validOrderId}`);
}
