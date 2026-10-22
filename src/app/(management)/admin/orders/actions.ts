"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  ADMIN_UNAUTHORIZED_MESSAGE,
  adminEntityIdSchema,
  authorizeAdminAction,
  INVALID_INPUT_MESSAGE,
} from "@/server/admin/admin-action";
import { logAdminAction } from "@/server/auth/admin-audit";
import { cancelOrder } from "@/server/orders/cancel-order";
import { ONLINE_ORDER_STATUSES } from "@/server/orders/online-order-status";
import { OrderStatusError } from "@/server/orders/order-status-error";
import {
  markOnlineOrderPaid,
  transitionOnlineOrder,
} from "@/server/orders/update-online-order";
import type { AdminActionResult } from "@/types/admin-action";

const UNAUTHORIZED = {
  ok: false as const,
  message: ADMIN_UNAUTHORIZED_MESSAGE,
};
const INVALID_INPUT = { ok: false as const, message: INVALID_INPUT_MESSAGE };

const onlineOrderStatusSchema = z.enum(ONLINE_ORDER_STATUSES);

/** Lỗi nghiệp vụ đơn hàng thành `{ ok: false }`; lỗi lạ ném lại. */
function orderStatusFailure(error: unknown) {
  if (error instanceof OrderStatusError) {
    return { ok: false as const, message: error.message };
  }
  throw error;
}

export async function cancelOrderAction(
  orderId: string,
): Promise<AdminActionResult> {
  const session = await authorizeAdminAction();
  if (!session) return UNAUTHORIZED;
  const parsed = adminEntityIdSchema.safeParse(orderId);
  if (!parsed.success) return INVALID_INPUT;
  const validOrderId = parsed.data;

  try {
    await cancelOrder(validOrderId);
  } catch (error) {
    return orderStatusFailure(error);
  }
  await logAdminAction({
    identityId: session.identity?.id,
    action: "order.cancel",
    entityType: "order",
    entityId: validOrderId,
  });

  revalidatePath("/admin/orders");
  revalidatePath("/pos");
  return { ok: true };
}

export async function transitionOnlineOrderAction(
  orderId: string,
  next: string,
): Promise<AdminActionResult> {
  const session = await authorizeAdminAction();
  if (!session) return UNAUTHORIZED;
  const parsedId = adminEntityIdSchema.safeParse(orderId);
  if (!parsedId.success) return INVALID_INPUT;
  const parsedNext = onlineOrderStatusSchema.safeParse(next);
  if (!parsedNext.success) {
    return { ok: false, message: "Trạng thái không hợp lệ" };
  }
  const validOrderId = parsedId.data;

  try {
    await transitionOnlineOrder(validOrderId, parsedNext.data);
  } catch (error) {
    return orderStatusFailure(error);
  }
  await logAdminAction({
    identityId: session.identity?.id,
    action: "order.transition",
    entityType: "order",
    entityId: validOrderId,
    metadata: { nextStatus: parsedNext.data },
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${validOrderId}`);
  revalidatePath("/shop");
  return { ok: true };
}

export async function markOnlineOrderPaidAction(
  orderId: string,
): Promise<AdminActionResult> {
  const session = await authorizeAdminAction();
  if (!session) return UNAUTHORIZED;
  const parsed = adminEntityIdSchema.safeParse(orderId);
  if (!parsed.success) return INVALID_INPUT;
  const validOrderId = parsed.data;

  try {
    await markOnlineOrderPaid(validOrderId);
  } catch (error) {
    return orderStatusFailure(error);
  }
  await logAdminAction({
    identityId: session.identity?.id,
    action: "order.mark_paid",
    entityType: "order",
    entityId: validOrderId,
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${validOrderId}`);
  return { ok: true };
}
