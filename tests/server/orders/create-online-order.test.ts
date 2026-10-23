import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { createOnlineOrder } from "@/server/orders/create-online-order";
import { OnlineOrderError, onlineCheckoutSchema } from "@/types/online-order";

const productId = "online-test-product";

beforeEach(async () => {
  await prisma.adminNotification.deleteMany();
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
  await prisma.adminNotification.deleteMany();
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
    const notifications = await prisma.adminNotification.findMany();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      eventKey: `online-order:${first.order.id}:created`,
      entityId: first.order.id,
      href: `/admin/orders/${first.order.id}`,
    });
    expect(notifications[0]?.body).not.toContain("0901234567");
    expect(notifications[0]?.body).not.toContain("Nguyễn Văn An");
  });

  it("từ chối thiếu tồn mà không tạo đơn", async () => {
    await expect(createOnlineOrder(input(11))).rejects.toBeInstanceOf(
      OnlineOrderError,
    );
    expect(await prisma.order.count({ where: { channel: "online" } })).toBe(0);
    expect(await prisma.adminNotification.count()).toBe(0);
  });

  it("BL-1: schema và server đều chặn quá 50 đơn vị mỗi dòng", async () => {
    await prisma.product.update({
      where: { id: productId },
      data: { stock: 200 },
    });
    expect(onlineCheckoutSchema.safeParse(input(51)).success).toBe(false);
    expect(onlineCheckoutSchema.safeParse(input(50)).success).toBe(true);

    await expect(createOnlineOrder(input(51))).rejects.toMatchObject({
      code: "INVALID_QUANTITY",
      productIds: [productId],
    });
    expect(await prisma.order.count({ where: { channel: "online" } })).toBe(0);

    await expect(createOnlineOrder(input(50))).resolves.toMatchObject({
      duplicated: false,
    });
  });

  it("BL-1: từ chối đơn mở thứ 4 của cùng SĐT, kể cả khi gửi dạng +84", async () => {
    for (let index = 0; index < 3; index += 1) {
      await createOnlineOrder(input(1));
    }

    const fourth = { ...input(1), contactPhone: "+84901234567" };
    await expect(createOnlineOrder(fourth)).rejects.toMatchObject({
      name: "OnlineOrderError",
      code: "TOO_MANY_OPEN_ORDERS",
    });
    expect(await prisma.order.count({ where: { channel: "online" } })).toBe(3);
    const product = await prisma.product.findUniqueOrThrow({
      where: { id: productId },
    });
    expect(product.stock).toBe(7);
  });

  it("BL-1: đơn đã hủy hoặc đã xác nhận không tính vào giới hạn đơn mở", async () => {
    const ids: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      ids.push((await createOnlineOrder(input(1))).order.id);
    }
    await prisma.order.update({
      where: { id: ids[0] },
      data: { status: "cancelled", fulfillmentStatus: "cancelled" },
    });
    await prisma.order.update({
      where: { id: ids[1] },
      data: { fulfillmentStatus: "confirmed" },
    });

    await expect(createOnlineOrder(input(1))).resolves.toMatchObject({
      duplicated: false,
    });
    await expect(createOnlineOrder(input(1))).resolves.toMatchObject({
      duplicated: false,
    });
    await expect(createOnlineOrder(input(1))).rejects.toMatchObject({
      code: "TOO_MANY_OPEN_ORDERS",
    });
  });

  it("BL-1: giới hạn 3 đơn mở theo tài khoản dù đổi SĐT", async () => {
    const account = await prisma.customerAccount.create({
      data: {
        phoneNormalized: "+84900000077",
        displayName: "Khách giới hạn",
        passwordHash: "x",
        phoneVerifiedAt: new Date(),
      },
    });
    try {
      const phones = ["0911111111", "0922222222", "0933333333"];
      for (const contactPhone of phones) {
        await createOnlineOrder(
          { ...input(1), contactPhone },
          { customerAccountId: account.id },
        );
      }

      await expect(
        createOnlineOrder(
          { ...input(1), contactPhone: "0944444444" },
          { customerAccountId: account.id },
        ),
      ).rejects.toMatchObject({ code: "TOO_MANY_OPEN_ORDERS" });
      expect(
        await prisma.order.count({ where: { customerAccountId: account.id } }),
      ).toBe(3);
    } finally {
      await prisma.order.deleteMany({
        where: { customerAccountId: account.id },
      });
      await prisma.customerAccount.delete({ where: { id: account.id } });
    }
  });

  it("từ chối số lượng lẻ ngay cả khi bỏ qua schema", async () => {
    await expect(createOnlineOrder(input(1.5))).rejects.toMatchObject({
      name: "OnlineOrderError",
      code: "INVALID_QUANTITY",
      productIds: [productId],
    });
    expect(await prisma.order.count({ where: { channel: "online" } })).toBe(0);
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    expect(product?.stock).toBe(10);
  });
});
