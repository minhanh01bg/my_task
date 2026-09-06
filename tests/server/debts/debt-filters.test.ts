import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { settledDebtWhere } from "@/server/debts/debt-filters";

const prisma = new PrismaClient();

async function createOrder(
  clientId: string,
  status: "paid" | "debt",
  initialMethod: "cash" | "debt",
) {
  return prisma.order.create({
    data: {
      clientId,
      code: clientId.toUpperCase(),
      status,
      total: 10000,
      payments: {
        create: {
          method: initialMethod,
          amount: 10000,
          receivedAt: initialMethod === "cash" ? new Date() : null,
        },
      },
    },
  });
}

beforeEach(async () => {
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("settledDebtWhere", () => {
  it("chỉ nhận diện đơn đã trả xong từng được ghi nợ", async () => {
    const settledDebt = await createOrder("settled-debt", "paid", "debt");
    await createOrder("normal-cash", "paid", "cash");
    await createOrder("open-debt", "debt", "debt");

    const orders = await prisma.order.findMany({ where: settledDebtWhere });

    expect(orders.map((order) => order.id)).toEqual([settledDebt.id]);
  });
});
