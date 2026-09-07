import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { createOnlineOrder } from "@/server/orders/create-online-order";
import { createOrder } from "@/server/orders/create-order";
import { OnlineOrderError } from "@/types/online-order";

const testProductId = "concurrency-test-product";

beforeEach(async () => {
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000;");
  await prisma.adminNotification.deleteMany();
  await prisma.stockMovement.deleteMany({
    where: { productId: testProductId },
  });
  await prisma.orderItem.deleteMany({ where: { productId: testProductId } });
  await prisma.order.deleteMany({ where: { channel: "online" } });
  await prisma.product.upsert({
    where: { id: testProductId },
    create: {
      id: testProductId,
      name: "Sản phẩm thử nghiệm tồn kho",
      price: 100_000,
      stock: 1, // Only 1 item in stock
      isActive: true,
      isService: false,
    },
    update: {
      name: "Sản phẩm thử nghiệm tồn kho",
      price: 100_000,
      stock: 1,
      isActive: true,
      isService: false,
      deletedAt: null,
    },
  });
});

afterEach(async () => {
  await prisma.adminNotification.deleteMany();
  await prisma.stockMovement.deleteMany({
    where: { productId: testProductId },
  });
  await prisma.orderItem.deleteMany({ where: { productId: testProductId } });
  await prisma.order.deleteMany({ where: { channel: "online" } });
  await prisma.product.deleteMany({ where: { id: testProductId } });
});

function makeOrderInput(quantity = 1) {
  return {
    clientId: randomUUID(),
    lines: [{ productId: testProductId, quantity }],
    contactName: "Khách Hàng Concurrency",
    contactPhone: "0912345678",
    fulfillmentType: "pickup" as const,
    paymentMethod: "cod" as const,
    deliveryAddress: "",
    deliveryWard: "",
    deliveryDistrict: "",
    deliveryProvince: "",
    note: "",
  };
}

describe("Atomic Online Stock Concurrency (Task 6)", () => {
  it("prevents overselling under concurrent online checkouts against stock 1", async () => {
    const input1 = makeOrderInput(1);
    const input2 = makeOrderInput(1);

    // Launch both concurrently
    const [res1, res2] = await Promise.allSettled([
      createOnlineOrder(input1),
      createOnlineOrder(input2),
    ]);

    const successes = [res1, res2].filter((r) => r.status === "fulfilled");
    const rejections = [res1, res2].filter((r) => r.status === "rejected");

    // Exactly one must succeed and one must fail
    expect(successes).toHaveLength(1);
    expect(rejections).toHaveLength(1);

    const rejectedReason = (rejections[0] as PromiseRejectedResult).reason;
    expect(rejectedReason).toBeInstanceOf(OnlineOrderError);
    expect(rejectedReason.code).toBe("OUT_OF_STOCK");

    // Check database state: stock must be exactly 0, NEVER negative
    const product = await prisma.product.findUnique({
      where: { id: testProductId },
    });
    expect(product?.stock).toBe(0);

    // Exactly 1 order created, 1 stock movement, 1 notification
    const orders = await prisma.order.findMany({
      where: { channel: "online" },
    });
    expect(orders).toHaveLength(1);

    const movements = await prisma.stockMovement.findMany({
      where: { productId: testProductId },
    });
    expect(movements).toHaveLength(1);
    expect(movements[0].delta).toBe(-1);

    const notifications = await prisma.adminNotification.findMany();
    expect(notifications).toHaveLength(1);
  });

  it("rolls back the entire transaction without leaving orphaned movements or notifications on failure", async () => {
    // Attempt to order 5 items when only 1 exists
    const inputOversized = makeOrderInput(5);

    await expect(createOnlineOrder(inputOversized)).rejects.toMatchObject({
      code: "OUT_OF_STOCK",
    });

    const orders = await prisma.order.findMany({
      where: { channel: "online" },
    });
    expect(orders).toHaveLength(0);

    const movements = await prisma.stockMovement.findMany({
      where: { productId: testProductId },
    });
    expect(movements).toHaveLength(0);

    const notifications = await prisma.adminNotification.findMany();
    expect(notifications).toHaveLength(0);

    // Stock remains 1
    const product = await prisma.product.findUnique({
      where: { id: testProductId },
    });
    expect(product?.stock).toBe(1);
  });

  it("confirms POS orders continue to permit negative stock", async () => {
    // Set stock to 0
    await prisma.product.update({
      where: { id: testProductId },
      data: { stock: 0 },
    });

    // POS creates order for 2 items
    const posResult = await createOrder({
      clientId: randomUUID(),
      channel: "pos",
      lines: [
        {
          productId: testProductId,
          name: "Sản phẩm POS bán âm",
          unitPrice: 100_000,
          originalPrice: 100_000,
          quantity: 2,
          discount: 0,
          unit: "cái",
          isService: false,
        },
      ],
      payments: [{ method: "cash", amount: 200_000 }],
    });

    expect(posResult.order.hasStockWarning).toBe(true);

    const product = await prisma.product.findUnique({
      where: { id: testProductId },
    });
    // POS allows negative stock: 0 - 2 = -2
    expect(product?.stock).toBe(-2);
  });
});
