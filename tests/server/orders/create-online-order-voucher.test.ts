import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { cancelOrder } from "@/server/orders/cancel-order";
import { createOnlineOrder } from "@/server/orders/create-online-order";
import { createOrder } from "@/server/orders/create-order";
import { OnlineOrderError } from "@/types/online-order";

const productId = "voucher-test-product";
const PER_CUSTOMER_KEY = "voucher.maxUsesPerCustomer";
const PER_CUSTOMER_MESSAGE =
  "Bạn đã dùng hết số lần cho phép của mã giảm giá này";
const GENERIC_VOUCHER_MESSAGE =
  "Mã giảm giá không hợp lệ hoặc không áp dụng được cho đơn này";

async function cleanup() {
  await prisma.adminNotification.deleteMany();
  await prisma.customerNotification.deleteMany();
  await prisma.stockMovement.deleteMany({ where: { productId } });
  await prisma.orderItem.deleteMany({ where: { productId } });
  await prisma.order.deleteMany({
    where: { OR: [{ channel: "online" }, { voucherCode: { not: null } }] },
  });
  await prisma.voucher.deleteMany();
  await prisma.customerAccount.deleteMany({
    where: { phoneNormalized: { startsWith: "+8490000009" } },
  });
  await prisma.setting.deleteMany({
    where: {
      key: {
        in: [
          "store.shippingFee",
          "store.freeShippingThreshold",
          PER_CUSTOMER_KEY,
        ],
      },
    },
  });
}

async function shippingSettings(shippingFee: number, threshold: number) {
  await prisma.setting.createMany({
    data: [
      { key: "store.shippingFee", value: String(shippingFee) },
      { key: "store.freeShippingThreshold", value: String(threshold) },
    ],
  });
}

const DELIVERY = {
  fulfillmentType: "delivery" as const,
  deliveryAddress: "12 Lê Lợi",
  deliveryWard: "Phường Bến Nghé",
  deliveryDistrict: "Quận 1",
  deliveryProvince: "TP. Hồ Chí Minh",
};

beforeEach(async () => {
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000;");
  await cleanup();
  await prisma.product.upsert({
    where: { id: productId },
    create: { id: productId, name: "Gạo ST25", price: 100_000, stock: 50 },
    update: {
      name: "Gạo ST25",
      price: 100_000,
      stock: 50,
      isActive: true,
      isService: false,
      deletedAt: null,
    },
  });
});

afterEach(async () => {
  await cleanup();
  await prisma.product.deleteMany({ where: { id: productId } });
});

function checkout(overrides: Record<string, unknown> = {}) {
  return {
    clientId: randomUUID(),
    lines: [{ productId, quantity: 3 }],
    contactName: "Trần Thị Bình",
    contactPhone: "0912345678",
    fulfillmentType: "pickup" as const,
    paymentMethod: "cod" as const,
    deliveryAddress: "",
    deliveryWard: "",
    deliveryDistrict: "",
    deliveryProvince: "",
    note: "",
    ...overrides,
  };
}

function voucher(data: Record<string, unknown> = {}) {
  return prisma.voucher.create({
    data: {
      code: "GIAM10",
      type: "percent",
      value: 10,
      maxDiscount: 20_000,
      ...data,
    },
  });
}

describe("createOnlineOrder với voucher", () => {
  it("áp voucher phía server, lưu voucherCode/voucherDiscount và tăng usedCount", async () => {
    await voucher();

    const result = await createOnlineOrder(
      checkout({ voucherCode: " giam10 " }),
    );

    // 10% của 300k = 30k, chặn trần 20k.
    expect(result.order).toMatchObject({
      subtotal: 300_000,
      discount: 20_000,
      total: 280_000,
    });
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: result.order.id },
      include: { payments: true },
    });
    expect(order).toMatchObject({
      voucherCode: "GIAM10",
      voucherDiscount: 20_000,
      shippingFee: 0,
    });
    const manualDiscount = order.discount - order.voucherDiscount;
    expect(order.total).toBe(
      order.subtotal -
        manualDiscount -
        order.voucherDiscount +
        order.shippingFee,
    );
    expect(order.payments[0]?.amount).toBe(280_000);
    expect(
      (await prisma.voucher.findUniqueOrThrow({ where: { code: "GIAM10" } }))
        .usedCount,
    ).toBe(1);
  });

  it("lưu khung giờ giao vào cột riêng, không nhồi vào ghi chú", async () => {
    await voucher();
    const result = await createOnlineOrder(
      checkout({
        fulfillmentType: "delivery",
        deliveryAddress: "12 Lê Lợi",
        deliveryWard: "Phường Bến Nghé",
        deliveryDistrict: "Quận 1",
        deliveryProvince: "TP. Hồ Chí Minh",
        deliverySlot: "08:00 - 11:30",
        voucherCode: "GIAM10",
        note: "Gọi trước khi giao",
      }),
    );
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: result.order.id },
    });
    expect(order.deliverySlot).toBe("08:00 - 11:30");
    expect(order.note).toBe("Gọi trước khi giao");
  });

  it("từ chối voucher đã hết lượt và không tạo đơn", async () => {
    await voucher({ maxUses: 2, usedCount: 2 });

    await expect(
      createOnlineOrder(checkout({ voucherCode: "GIAM10" })),
    ).rejects.toMatchObject({ code: "VOUCHER_INVALID" });

    expect(await prisma.order.count({ where: { channel: "online" } })).toBe(0);
    expect(
      (await prisma.voucher.findUniqueOrThrow({ where: { code: "GIAM10" } }))
        .usedCount,
    ).toBe(2);
  });

  it("từ chối voucher không đủ điều kiện (dưới đơn tối thiểu, không tồn tại)", async () => {
    await voucher({ minOrderTotal: 500_000 });

    await expect(
      createOnlineOrder(checkout({ voucherCode: "GIAM10" })),
    ).rejects.toBeInstanceOf(OnlineOrderError);
    await expect(
      createOnlineOrder(checkout({ voucherCode: "KHONGCO" })),
    ).rejects.toMatchObject({ code: "VOUCHER_INVALID" });
    expect(await prisma.order.count({ where: { channel: "online" } })).toBe(0);
  });

  it.each([
    ["không tồn tại", null],
    ["đã tắt", { isActive: false }],
    ["chưa đến ngày", { startsAt: new Date(Date.now() + 86_400_000) }],
    ["đã hết hạn", { endsAt: new Date(Date.now() - 86_400_000) }],
    ["hết lượt", { maxUses: 2, usedCount: 2 }],
    ["dưới đơn tối thiểu", { minOrderTotal: 500_000 }],
  ])(
    "BL-5: mã %s chỉ nhận một thông báo chung, không lộ ngưỡng",
    async (_label, data) => {
      if (data) await voucher(data);

      const error = await createOnlineOrder(
        checkout({ voucherCode: "GIAM10" }),
      ).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(OnlineOrderError);
      expect(error).toMatchObject({
        code: "VOUCHER_INVALID",
        message: GENERIC_VOUCHER_MESSAGE,
      });
      expect((error as Error).message).not.toMatch(/\d/);
    },
  );

  it("gửi lại cùng clientId không tăng usedCount lần hai", async () => {
    await voucher();
    const payload = checkout({ voucherCode: "GIAM10" });
    const first = await createOnlineOrder(payload);
    const second = await createOnlineOrder(payload);
    expect(second.duplicated).toBe(true);
    expect(second.order.id).toBe(first.order.id);
    expect(
      (await prisma.voucher.findUniqueOrThrow({ where: { code: "GIAM10" } }))
        .usedCount,
    ).toBe(1);
  });

  it("2 đơn đồng thời với voucher còn 1 lượt: đúng 1 đơn thành công", async () => {
    await voucher({ maxUses: 1, usedCount: 0 });

    const results = await Promise.allSettled([
      createOnlineOrder(checkout({ voucherCode: "GIAM10" })),
      createOnlineOrder(checkout({ voucherCode: "GIAM10" })),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({ code: "VOUCHER_INVALID" });

    const row = await prisma.voucher.findUniqueOrThrow({
      where: { code: "GIAM10" },
    });
    expect(row.usedCount).toBe(1);
    expect(await prisma.order.count({ where: { channel: "online" } })).toBe(1);
    // Đơn bị từ chối rollback toàn bộ: tồn kho chỉ trừ một lần.
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
        .stock,
    ).toBe(47);
  });
});

describe("createOrder với voucher (đường ghi đơn duy nhất)", () => {
  function onlineInput(
    voucherInput: {
      code: string;
      discount: number;
      shippingDiscount: number;
    },
    shippingFee: number,
    /** Tong don server se tinh — createOrder doi chieu thanh toan voi so nay. */
    total: number,
  ) {
    return {
      clientId: randomUUID(),
      channel: "online" as const,
      lines: [
        {
          productId,
          name: "Gạo ST25",
          unitPrice: 100_000,
          originalPrice: 100_000,
          quantity: 2,
          discount: 0,
          unit: "túi",
          isService: false,
        },
      ],
      payments: [{ method: "cash" as const, amount: total }],
      initialStatus: "pending",
      autoReceiveCash: false,
      voucher: voucherInput,
      online: {
        fulfillmentStatus: "new" as const,
        fulfillmentType: "delivery" as const,
        paymentMethod: "cod" as const,
        contactName: "Khách",
        contactPhone: "0912345678",
        shippingFee,
      },
    };
  }

  it("freeship chỉ giảm phí ship; tổng = tạm tính - giảm + phí ship sau giảm", async () => {
    await voucher({ code: "FREESHIP", type: "freeship", value: 0 });

    const result = await createOrder(
      onlineInput(
        { code: "FREESHIP", discount: 0, shippingDiscount: 25_000 },
        30_000,
        205_000,
      ),
    );
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: result.order.id },
    });
    expect(order).toMatchObject({
      subtotal: 200_000,
      discount: 0,
      voucherDiscount: 0,
      voucherCode: "FREESHIP",
      shippingFee: 5_000,
      total: 205_000,
    });
  });

  it("chặn phần giảm voucher không vượt quá tiền hàng / phí ship", async () => {
    await voucher({ code: "BIG", type: "fixed", value: 999_999 });
    const result = await createOrder(
      onlineInput(
        { code: "BIG", discount: 999_999, shippingDiscount: 50_000 },
        10_000,
        0,
      ),
    );
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: result.order.id },
    });
    expect(order).toMatchObject({
      voucherDiscount: 200_000,
      discount: 200_000,
      shippingFee: 0,
      total: 0,
    });
  });

  it("từ chối nguyên tử khi usedCount đã chạm maxUses dù bên gọi bỏ qua kiểm tra", async () => {
    await voucher({ maxUses: 1, usedCount: 1 });

    await expect(
      createOrder(
        onlineInput(
          { code: "GIAM10", discount: 20_000, shippingDiscount: 0 },
          0,
          180_000,
        ),
      ),
    ).rejects.toMatchObject({
      code: "VOUCHER_INVALID",
      message: GENERIC_VOUCHER_MESSAGE,
    });

    expect(await prisma.order.count({ where: { channel: "online" } })).toBe(0);
    expect(
      (await prisma.voucher.findUniqueOrThrow({ where: { code: "GIAM10" } }))
        .usedCount,
    ).toBe(1);
  });
});

describe("BL-3: giới hạn số lần mỗi khách dùng một mã", () => {
  function limitPerCustomer(value: string) {
    return prisma.setting.create({
      data: { key: PER_CUSTOMER_KEY, value },
    });
  }

  async function usedCount() {
    return (
      await prisma.voucher.findUniqueOrThrow({ where: { code: "GIAM10" } })
    ).usedCount;
  }

  it("giới hạn 1: đơn thứ hai cùng SĐT (cả dạng +84) bị từ chối, không tiêu lượt", async () => {
    await voucher();
    await limitPerCustomer("1");

    await createOnlineOrder(checkout({ voucherCode: "GIAM10" }));
    for (const contactPhone of ["0912345678", "+84912345678"]) {
      await expect(
        createOnlineOrder(checkout({ voucherCode: "GIAM10", contactPhone })),
      ).rejects.toMatchObject({
        code: "VOUCHER_INVALID",
        message: PER_CUSTOMER_MESSAGE,
      });
    }

    expect(await usedCount()).toBe(1);
    expect(await prisma.order.count({ where: { voucherCode: "GIAM10" } })).toBe(
      1,
    );
    // Khách khác vẫn dùng được mã.
    await expect(
      createOnlineOrder(
        checkout({ voucherCode: "GIAM10", contactPhone: "0987654321" }),
      ),
    ).resolves.toMatchObject({ duplicated: false });
  });

  it("đếm theo tài khoản dù khách đổi SĐT", async () => {
    await voucher();
    await limitPerCustomer("1");
    const account = await prisma.customerAccount.create({
      data: {
        phoneNormalized: "+84900000091",
        displayName: "Khách voucher",
        passwordHash: "x",
      },
    });

    await createOnlineOrder(checkout({ voucherCode: "GIAM10" }), {
      customerAccountId: account.id,
    });
    await expect(
      createOnlineOrder(
        checkout({ voucherCode: "GIAM10", contactPhone: "0987654321" }),
        { customerAccountId: account.id },
      ),
    ).rejects.toMatchObject({ code: "VOUCHER_INVALID" });
    expect(await usedCount()).toBe(1);
  });

  it("đơn đã huỷ không tính: huỷ đơn đầu thì khách dùng lại được", async () => {
    await voucher();
    await limitPerCustomer("1");

    const first = await createOnlineOrder(checkout({ voucherCode: "GIAM10" }));
    await cancelOrder(first.order.id);

    await expect(
      createOnlineOrder(checkout({ voucherCode: "GIAM10" })),
    ).resolves.toMatchObject({ duplicated: false });
    expect(await usedCount()).toBe(1);
  });

  it("chưa đặt giới hạn: cùng khách dùng mã nhiều lần như trước", async () => {
    await voucher();

    await createOnlineOrder(checkout({ voucherCode: "GIAM10" }));
    await createOnlineOrder(checkout({ voucherCode: "GIAM10" }));

    expect(await usedCount()).toBe(2);
  });

  it("đơn POS không có danh tính khách không bị giới hạn", async () => {
    await voucher();
    await limitPerCustomer("1");
    const posOrder = () =>
      createOrder({
        clientId: randomUUID(),
        lines: [
          {
            productId,
            name: "Gạo ST25",
            unitPrice: 100_000,
            originalPrice: 100_000,
            quantity: 1,
            discount: 0,
            unit: "túi",
            isService: false,
          },
        ],
        voucher: { code: "GIAM10", discount: 10_000, shippingDiscount: 0 },
        payments: [{ method: "cash", amount: 90_000 }],
      });

    await posOrder();
    await posOrder();

    expect(await usedCount()).toBe(2);
  });
});

describe("createOnlineOrder — phí giao hàng từ cài đặt", () => {
  it("giao tận nơi dưới ngưỡng: cộng store.shippingFee vào tổng", async () => {
    await shippingSettings(20_000, 500_000);
    const { order } = await createOnlineOrder(checkout(DELIVERY));
    const saved = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(saved).toMatchObject({
      subtotal: 300_000,
      shippingFee: 20_000,
      total: 320_000,
    });
  });

  it("giao tận nơi từ ngưỡng trở lên: miễn phí", async () => {
    await shippingSettings(20_000, 300_000);
    const { order } = await createOnlineOrder(checkout(DELIVERY));
    const saved = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(saved).toMatchObject({ shippingFee: 0, total: 300_000 });
  });

  it("nhận tại cửa hàng: không tính phí dù dưới ngưỡng", async () => {
    await shippingSettings(20_000, 500_000);
    const { order } = await createOnlineOrder(checkout());
    const saved = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(saved).toMatchObject({ shippingFee: 0, total: 300_000 });
  });

  it("freeship trên đơn có phí: phí về 0, voucherDiscount 0", async () => {
    await shippingSettings(20_000, 500_000);
    await voucher({ code: "FREESHIP", type: "freeship", value: 0 });
    const { order } = await createOnlineOrder(
      checkout({ ...DELIVERY, voucherCode: "freeship" }),
    );
    const saved = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(saved).toMatchObject({
      voucherCode: "FREESHIP",
      voucherDiscount: 0,
      shippingFee: 0,
      total: 300_000,
    });
  });

  it("freeship khi đơn đã miễn phí ship: từ chối VOUCHER_INVALID, không tiêu lượt", async () => {
    await voucher({ code: "FREESHIP", type: "freeship", value: 0 });
    await expect(
      createOnlineOrder(checkout({ voucherCode: "FREESHIP" })),
    ).rejects.toMatchObject({
      code: "VOUCHER_INVALID",
      message: GENERIC_VOUCHER_MESSAGE,
    });
    const saved = await prisma.voucher.findUniqueOrThrow({
      where: { code: "FREESHIP" },
    });
    expect(saved.usedCount).toBe(0);
  });
});
