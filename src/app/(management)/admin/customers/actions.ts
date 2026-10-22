"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  ADMIN_UNAUTHORIZED_MESSAGE,
  adminEntityIdSchema,
  authorizeAdminAction,
  INVALID_INPUT_MESSAGE,
} from "@/server/admin/admin-action";
import { prisma } from "@/server/db/prisma";
import type { AdminActionResult } from "@/types/admin-action";

const ACCOUNT_NOT_FOUND = "Không tìm thấy tài khoản";

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
