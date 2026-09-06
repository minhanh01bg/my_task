"use server";

import { revalidatePath } from "next/cache";

import { cancelOrder } from "@/server/orders/cancel-order";
import {
  markOnlineOrderPaid,
  transitionOnlineOrder,
} from "@/server/orders/update-online-order";
import { isOnlineOrderStatus } from "@/server/orders/online-order-status";

export async function cancelOrderAction(orderId: string) {
  await cancelOrder(orderId);
  revalidatePath("/admin/orders");
  revalidatePath("/pos");
}

export async function transitionOnlineOrderAction(
  orderId: string,
  next: string,
) {
  if (!isOnlineOrderStatus(next)) throw new Error("Trạng thái không hợp lệ");
  await transitionOnlineOrder(orderId, next);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/shop");
}

export async function markOnlineOrderPaidAction(orderId: string) {
  await markOnlineOrderPaid(orderId);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
}
