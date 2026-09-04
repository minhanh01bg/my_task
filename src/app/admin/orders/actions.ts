"use server";

import { revalidatePath } from "next/cache";

import { cancelOrder } from "@/server/orders/cancel-order";

export async function cancelOrderAction(orderId: string) {
  await cancelOrder(orderId);
  revalidatePath("/admin/orders");
  revalidatePath("/pos");
}
