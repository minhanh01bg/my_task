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
import { prisma } from "@/server/db/prisma";
import type { AdminActionResult } from "@/types/admin-action";

const ACCOUNT_NOT_FOUND = "Không tìm thấy tài khoản";
const ACCOUNT_HAS_ORDERS =
  "Tài khoản đã có đơn hàng nên không thể giải phóng số điện thoại. Hãy khóa tài khoản thay vì xóa.";

const toggleAccountSchema = z.object({
  accountId: adminEntityIdSchema,
});

export type ToggleAccountResult =
  | { ok: true; disabled: boolean }
  | { ok: false; error: string };

/** Đảo trạng thái khoá; khoá thì thu hồi mọi phiên. null khi không có tài khoản. */
async function toggleAccountDisabled(
  accountId: string,
): Promise<boolean | null> {
  const account = await prisma.customerAccount.findUnique({
    where: { id: accountId },
    select: { id: true, disabledAt: true },
  });

  if (!account) return null;

  const willDisable = !account.disabledAt;

  if (willDisable) {
    await prisma.$transaction([
      prisma.customerAccount.update({
        where: { id: accountId },
        data: { disabledAt: new Date() },
      }),
      prisma.customerSession.deleteMany({
        where: { accountId },
      }),
    ]);
  } else {
    await prisma.customerAccount.update({
      where: { id: accountId },
      data: { disabledAt: null },
    });
  }

  revalidatePath("/admin/customers");
  return willDisable;
}

export async function toggleCustomerAccountDisabledAction(
  formData: FormData,
): Promise<ToggleAccountResult> {
  if (!(await authorizeAdminAction())) {
    return { ok: false, error: ADMIN_UNAUTHORIZED_MESSAGE };
  }

  const parsed = toggleAccountSchema.safeParse({
    accountId: formData.get("accountId"),
  });

  if (!parsed.success) {
    return { ok: false, error: INVALID_INPUT_MESSAGE };
  }

  const disabled = await toggleAccountDisabled(parsed.data.accountId);
  if (disabled === null) return { ok: false, error: ACCOUNT_NOT_FOUND };
  return { ok: true, disabled };
}

export async function toggleCustomerAccountAction(
  accountId: string,
): Promise<AdminActionResult<{ disabled: boolean }>> {
  if (!(await authorizeAdminAction())) {
    return { ok: false, message: ADMIN_UNAUTHORIZED_MESSAGE };
  }

  const parsed = toggleAccountSchema.safeParse({ accountId });
  if (!parsed.success) return { ok: false, message: INVALID_INPUT_MESSAGE };

  const disabled = await toggleAccountDisabled(parsed.data.accountId);
  if (disabled === null) return { ok: false, message: ACCOUNT_NOT_FOUND };
  return { ok: true, disabled };
}

/** Đơn chen vào giữa lúc kiểm tra và lúc xoá: huỷ transaction. */
class AccountHasOrdersError extends Error {}

type ReleaseOutcome =
  | {
      status: "released";
      sessionsDeleted: number;
      notificationsDeleted: number;
      reviewsDetached: number;
    }
  | { status: "not_found" }
  | { status: "has_orders" };

/**
 * Xoá hẳn tài khoản chưa có đơn nào để chủ số thật đăng ký lại. Có đơn thì giữ
 * nguyên: xoá sẽ làm đơn mất liên kết (onDelete: SetNull).
 */
async function releaseAccountWithoutOrders(
  accountId: string,
): Promise<ReleaseOutcome> {
  try {
    return await prisma.$transaction(async (tx) => {
      const account = await tx.customerAccount.findUnique({
        where: { id: accountId },
        select: { _count: { select: { orders: true } } },
      });
      if (!account) return { status: "not_found" as const };
      if (account._count.orders > 0) return { status: "has_orders" as const };

      const sessions = await tx.customerSession.deleteMany({
        where: { accountId },
      });
      const notifications = await tx.customerNotification.deleteMany({
        where: { accountId },
      });
      // Đánh giá công khai giữ nguyên nội dung, chỉ gỡ khỏi tài khoản.
      const reviews = await tx.productReview.updateMany({
        where: { accountId },
        data: { accountId: null },
      });
      const deleted = await tx.customerAccount.deleteMany({
        where: { id: accountId, orders: { none: {} } },
      });
      if (deleted.count !== 1) throw new AccountHasOrdersError();

      return {
        status: "released" as const,
        sessionsDeleted: sessions.count,
        notificationsDeleted: notifications.count,
        reviewsDetached: reviews.count,
      };
    });
  } catch (error) {
    if (error instanceof AccountHasOrdersError) return { status: "has_orders" };
    throw error;
  }
}

export async function releaseCustomerPhoneAction(
  accountId: string,
): Promise<AdminActionResult> {
  const session = await authorizeAdminAction();
  if (!session) return { ok: false, message: ADMIN_UNAUTHORIZED_MESSAGE };

  const parsed = toggleAccountSchema.safeParse({ accountId });
  if (!parsed.success) return { ok: false, message: INVALID_INPUT_MESSAGE };

  const outcome = await releaseAccountWithoutOrders(parsed.data.accountId);
  if (outcome.status === "not_found") {
    return { ok: false, message: ACCOUNT_NOT_FOUND };
  }
  if (outcome.status === "has_orders") {
    return { ok: false, message: ACCOUNT_HAS_ORDERS };
  }

  // Không ghi số điện thoại vào audit, chỉ ghi số bản ghi đã dọn.
  await logAdminAction({
    identityId: session.identity?.id,
    action: "customer_account.release_phone",
    entityType: "customer_account",
    entityId: parsed.data.accountId,
    metadata: {
      sessionsDeleted: outcome.sessionsDeleted,
      notificationsDeleted: outcome.notificationsDeleted,
      reviewsDetached: outcome.reviewsDetached,
    },
  });

  revalidatePath("/admin/customers");
  return { ok: true };
}
