import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { createOnlineOrder } from "@/server/orders/create-online-order";
import { OnlineOrderError } from "@/types/online-order";

const productId = "online-test-product";

beforeEach(async () => {
  await prisma.stockMovement.deleteMany({ where: { productId } });
  await prisma.order.deleteMany({ where: { channel: "online" } });
  await prisma.product.upsert({
    where: { id: productId },
    create: {
      id: productId,
      name: "Sản phẩm online",
      price: 25_000,
      stock: 10,
    },
    update: {
      name: "Sản phẩm online",
      price: 25_000,
      stock: 10,
      isActive: true,
      isService: false,
      deletedAt: null,
    },
  });
});

afterEach(async () => {
  await prisma.order.deleteMany({ where: { channel: "online" } });
  await prisma.stockMovement.deleteMany({ where: { productId } });
  await prisma.product.deleteMany({ where: { id: productId } });
});

function input(quantity = 2) {
  return {
    clientId: randomUUID(),
    lines: [{ productId, quantity }],
    contactName: "Nguyễn Văn An",
    contactPhone: "0901234567",
    fulfillmentType: "pickup" as const,
    paymentMethod: "cod" as const,
    deliveryAddress: "",
    deliveryWard: "",
    deliveryDistrict: "",
    deliveryProvince: "",
    note: "",
  };
}

describe("createOnlineOrder", () => {
  it("dùng giá database và lưu metadata online", async () => {
    const result = await createOnlineOrder(input());
    expect(result.order.total).toBe(50_000);
    const order = await prisma.order.findUnique({
      where: { id: result.order.id },
      include: { items: true },
    });
    expect(order).toMatchObject({
      channel: "online",
      status: "pending",
      fulfillmentStatus: "new",
      paymentMethod: "cod",
    });
    expect(order?.items[0]?.unitPrice).toBe(25_000);
  });

  it("idempotent theo clientId", async () => {
    const payload = input();
    const first = await createOnlineOrder(payload);
    const second = await createOnlineOrder(payload);
    expect(second.order.id).toBe(first.order.id);
    expect(second.duplicated).toBe(true);
  });

  it("từ chối thiếu tồn mà không tạo đơn", async () => {
    await expect(createOnlineOrder(input(11))).rejects.toBeInstanceOf(
      OnlineOrderError,
    );
    expect(await prisma.order.count({ where: { channel: "online" } })).toBe(0);
  });
});
