import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { cancelOrder } from "@/server/orders/cancel-order";
import { createOrder } from "@/server/orders/create-order";

const prisma = new PrismaClient();

async function seedProduct(stock = 10) {
  return prisma.product.create({
    data: {
      name: "Đường trắng",
      price: 15000,
      stock,
      unit: "kg",
      searchText: "duong trang",
    },
  });
}

beforeEach(async () => {
  await prisma.stockMovement.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("cancelOrder", () => {
  it("doi trang thai don sang cancelled", async () => {
    const product = await seedProduct();
    const { order } = await createOrder({
      clientId: "c1",
      lines: [
        {
          productId: product.id,
          name: "Đường trắng",
          unitPrice: 15000,
          originalPrice: 15000,
          quantity: 2,
          discount: 0,
          unit: "kg",
          isService: false,
        },
      ],
      payments: [{ method: "cash", amount: 30000 }],
    });

    await cancelOrder(order.id);

    const after = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(after.status).toBe("cancelled");
  });

  it("hoan lai ton kho da tru", async () => {
    const product = await seedProduct(10);
    const { order } = await createOrder({
      clientId: "c2",
      lines: [
        {
          productId: product.id,
          name: "Đường trắng",
          unitPrice: 15000,
          originalPrice: 15000,
          quantity: 2.5,
          discount: 0,
          unit: "kg",
          isService: false,
        },
      ],
      payments: [{ method: "cash", amount: 40000 }],
    });

    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
        .stock,
    ).toBe(7.5);

    await cancelOrder(order.id);

    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
        .stock,
    ).toBe(10);
  });

  it("ghi StockMovement voi reason cancel", async () => {
    const product = await seedProduct();
    const { order } = await createOrder({
      clientId: "c3",
      lines: [
        {
          productId: product.id,
          name: "Đường trắng",
          unitPrice: 15000,
          originalPrice: 15000,
          quantity: 2,
          discount: 0,
          unit: "kg",
          isService: false,
        },
      ],
      payments: [{ method: "cash", amount: 30000 }],
    });

    await cancelOrder(order.id);

    const movements = await prisma.stockMovement.findMany({
      where: { reason: "cancel" },
    });
    expect(movements).toHaveLength(1);
    expect(movements[0]?.delta).toBe(2);
  });

  it("dong dich vu khong hoan ton kho", async () => {
    const { order } = await createOrder({
      clientId: "c4",
      lines: [
        {
          productId: null,
          name: "Công thay nhớt",
          unitPrice: 20000,
          originalPrice: 20000,
          quantity: 1,
          discount: 0,
          unit: "lần",
          isService: true,
        },
      ],
      payments: [{ method: "cash", amount: 20000 }],
    });

    await cancelOrder(order.id);

    expect(
      await prisma.stockMovement.count({ where: { reason: "cancel" } }),
    ).toBe(0);
  });

  it("huy hai lan khong hoan ton kho hai lan", async () => {
    const product = await seedProduct(10);
    const { order } = await createOrder({
      clientId: "c5",
      lines: [
        {
          productId: product.id,
          name: "Đường trắng",
          unitPrice: 15000,
          originalPrice: 15000,
          quantity: 2,
          discount: 0,
          unit: "kg",
          isService: false,
        },
      ],
      payments: [{ method: "cash", amount: 30000 }],
    });

    await cancelOrder(order.id);
    await cancelOrder(order.id);

    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
        .stock,
    ).toBe(10);
  });
});
