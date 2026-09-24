import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { revalidatePublic } from "@/server/cache/public-cache";
import { cancelOrder } from "@/server/orders/cancel-order";
import { createOrder } from "@/server/orders/create-order";

vi.mock("@/server/cache/public-cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/cache/public-cache")>()),
  revalidatePublic: vi.fn(),
}));

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
  await prisma.voucher.deleteMany();
  vi.mocked(revalidatePublic).mockClear();
});

function sugarLine(productId: string, quantity = 1) {
  return {
    productId,
    name: "Đường trắng",
    unitPrice: 15000,
    originalPrice: 15000,
    quantity,
    discount: 0,
    unit: "kg",
    isService: false,
  };
}

async function soldCountOf(id: string) {
  return (await prisma.product.findUniqueOrThrow({ where: { id } })).soldCount;
}

async function seedVoucherOrder(usedCount: number, clientId: string) {
  await prisma.voucher.create({
    data: { code: "GIAM10", type: "fixed", value: 10_000, usedCount },
  });
  return prisma.order.create({
    data: {
      code: `DH-${clientId}`,
      clientId,
      channel: "online",
      status: "pending",
      subtotal: 100_000,
      discount: 10_000,
      total: 90_000,
      voucherCode: "GIAM10",
      voucherDiscount: 10_000,
    },
  });
}

async function usedCountOf(code: string) {
  return (await prisma.voucher.findUniqueOrThrow({ where: { code } }))
    .usedCount;
}

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

  it("giam soldCount moi dong mot lan (khop createOrder), huy lai khong giam them", async () => {
    const product = await seedProduct(10);
    await prisma.product.update({
      where: { id: product.id },
      data: { soldCount: 5 },
    });
    const { order } = await createOrder({
      clientId: "c6",
      lines: [sugarLine(product.id, 2), sugarLine(product.id, 1)],
      payments: [{ method: "cash", amount: 45000 }],
    });
    expect(await soldCountOf(product.id)).toBe(7);

    await cancelOrder(order.id);
    expect(await soldCountOf(product.id)).toBe(5);

    await cancelOrder(order.id);
    expect(await soldCountOf(product.id)).toBe(5);
  });

  it("soldCount khong am khi huy", async () => {
    const product = await seedProduct(10);
    const { order } = await createOrder({
      clientId: "c7",
      lines: [sugarLine(product.id, 1)],
      payments: [{ method: "cash", amount: 15000 }],
    });
    await prisma.product.update({
      where: { id: product.id },
      data: { soldCount: 0 },
    });

    await cancelOrder(order.id);
    expect(await soldCountOf(product.id)).toBe(0);
  });

  it("hoan mot luot voucher khi huy don dung ma, idempotent khi huy hai lan", async () => {
    const order = await seedVoucherOrder(3, "v1");

    await cancelOrder(order.id);
    expect(await usedCountOf("GIAM10")).toBe(2);
    expect(revalidatePublic).toHaveBeenCalledWith("catalog", "vouchers");

    vi.mocked(revalidatePublic).mockClear();
    await cancelOrder(order.id);
    expect(await usedCountOf("GIAM10")).toBe(2);
    expect(revalidatePublic).not.toHaveBeenCalled();
  });

  it("usedCount voucher khong am", async () => {
    const order = await seedVoucherOrder(0, "v2");

    await cancelOrder(order.id);
    expect(await usedCountOf("GIAM10")).toBe(0);
  });

  it("txClient: tra ve voucherCode de nguoi goi tu revalidate sau commit", async () => {
    const order = await seedVoucherOrder(1, "v3");

    const result = await prisma.$transaction((tx) => cancelOrder(order.id, tx));

    expect(result).toEqual({ cancelled: true, voucherCode: "GIAM10" });
    expect(await usedCountOf("GIAM10")).toBe(0);
    expect(revalidatePublic).not.toHaveBeenCalled();
  });
});
