import { prisma } from "@/server/db/prisma";

/**
 * Huy don va hoan lai ton kho. Idempotent — huy don da huy khong lam gi them,
 * neu khong se cong ton kho nhieu lan.
 */
export async function cancelOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order || order.status === "cancelled") return;

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: "cancelled" },
    });

    for (const item of order.items) {
      if (item.isService || !item.productId) continue;

      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          delta: item.quantity,
          reason: "cancel",
          refId: orderId,
        },
      });
    }
  });
}
