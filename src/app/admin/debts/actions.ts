"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/server/db/prisma";

/** Khach tra tien no — ghi them mot khoan thanh toan tien mat va dong don. */
export async function settleDebtAction(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { total: true, status: true },
  });

  if (!order || order.status !== "debt") return;

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        orderId,
        method: "cash",
        amount: order.total,
        receivedAt: new Date(),
        note: "Khách trả nợ",
      },
    }),
    prisma.order.update({ where: { id: orderId }, data: { status: "paid" } }),
  ]);

  revalidatePath("/admin/debts");
}
