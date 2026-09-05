"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/server/db/prisma";

const paymentSchema = z.object({
  orderId: z.string().min(1),
  amount: z.coerce.number().int().positive("Số tiền phải lớn hơn 0"),
  method: z.enum(["cash", "transfer"]),
});

export async function recordDebtPaymentAction(formData: FormData) {
  const parsed = paymentSchema.safeParse({
    orderId: formData.get("orderId"),
    amount: formData.get("amount"),
    method: formData.get("method"),
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ",
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: parsed.data.orderId },
      select: {
        total: true,
        status: true,
        payments: {
          where: {
            method: { in: ["cash", "transfer"] },
            receivedAt: { not: null },
          },
          select: { amount: true },
        },
      },
    });

    if (!order || order.status !== "debt") {
      return { ok: false as const, message: "Đơn nợ không còn tồn tại" };
    }

    const paid = order.payments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );
    const balance = Math.max(0, order.total - paid);

    if (balance === 0) {
      await tx.order.update({
        where: { id: parsed.data.orderId },
        data: { status: "paid" },
      });
      return { ok: true as const };
    }

    if (parsed.data.amount > balance) {
      return {
        ok: false as const,
        message: `Số tiền vượt quá dư nợ còn lại ${balance.toLocaleString("vi-VN")} ₫`,
      };
    }

    await tx.payment.create({
      data: {
        orderId: parsed.data.orderId,
        method: parsed.data.method,
        amount: parsed.data.amount,
        receivedAt: new Date(),
        note: "Khách trả nợ",
      },
    });

    if (parsed.data.amount === balance) {
      await tx.order.update({
        where: { id: parsed.data.orderId },
        data: { status: "paid" },
      });
    }

    return { ok: true as const };
  });

  revalidatePath("/admin/debts");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${parsed.data.orderId}`);

  return result;
}
