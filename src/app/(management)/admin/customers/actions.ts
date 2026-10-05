"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminSession } from "@/server/auth/require-admin-session";
import { prisma } from "@/server/db/prisma";

const toggleAccountSchema = z.object({
  accountId: z.string().min(1),
});

export type ToggleAccountResult =
  | { ok: true; disabled: boolean }
  | { ok: false; error: string };

export async function toggleCustomerAccountDisabledAction(
  formData: FormData,
): Promise<ToggleAccountResult> {
  await requireAdminSession();

  const parsed = toggleAccountSchema.safeParse({
    accountId: formData.get("accountId"),
  });

  if (!parsed.success) {
    return { ok: false, error: "Dữ liệu không hợp lệ" };
  }

  const { accountId } = parsed.data;
  const account = await prisma.customerAccount.findUnique({
    where: { id: accountId },
    select: { id: true, disabledAt: true },
  });

  if (!account) {
    return { ok: false, error: "Không tìm thấy tài khoản" };
  }

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
  return { ok: true, disabled: willDisable };
}

export async function toggleCustomerAccountAction(
  accountId: string,
): Promise<void> {
  await requireAdminSession();

  const account = await prisma.customerAccount.findUnique({
    where: { id: accountId },
    select: { id: true, disabledAt: true },
  });

  if (!account) return;

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
}
