// @vitest-environment node
import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { revalidatePublic } from "@/server/cache/public-cache";
import { prisma } from "@/server/db/prisma";
import { createOnlineOrder } from "@/server/orders/create-online-order";
import { createOrder } from "@/server/orders/create-order";
import {
  expireStaleOnlineOrders,
  scheduleStaleOnlineOrderExpiry,
  stopStaleOnlineOrderExpiry,
} from "@/server/orders/expire-stale-online-orders";

vi.mock("@/server/cache/public-cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/cache/public-cache")>()),
  revalidatePublic: vi.fn(),
}));

const productId = "expire-stale-product";
const HOUR = 60 * 60 * 1000;

async function cleanup() {
  await prisma.adminNotification.deleteMany();
  await prisma.stockMovement.deleteMany({ where: { productId } });
  await prisma.order.deleteMany({ where: { items: { some: { productId } } } });
  await prisma.voucher.deleteMany();
}

beforeEach(async () => {
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000;");
  await cleanup();
  await prisma.product.upsert({
    where: { id: productId },
    create: { id: productId, name: "Nước mắm", price: 50_000, stock: 20 },
    update: {
      name: "Nước mắm",
      price: 50_000,
      stock: 20,
      soldCount: 0,
      isActive: true,
      isService: false,
      deletedAt: null,
    },
  });
  await prisma.voucher.create({
    data: { code: "GIAM10", type: "fixed", value: 10_000 },
  });
  vi.mocked(revalidatePublic).mockClear();
});

afterEach(async () => {
  await cleanup();
  await prisma.product.deleteMany({ where: { id: productId } });
});

async function onlineOrder(
  contactPhone: string,
  ageMs: number,
  overrides: Record<string, unknown> = {},
) {
  const { order } = await createOnlineOrder({
    clientId: randomUUID(),
    lines: [{ productId, quantity: 1 }],
    contactName: "Lê Văn Cường",
    contactPhone,
    fulfillmentType: "pickup",
    paymentMethod: "bank_transfer",
    deliveryAddress: "",
    deliveryWard: "",
    deliveryDistrict: "",
    deliveryProvince: "",
    note: "",
    ...overrides,
  });
  await prisma.order.update({
    where: { id: order.id },
    data: { createdAt: new Date(Date.now() - ageMs) },
  });
  return order;
}

async function product() {
  return prisma.product.findUniqueOrThrow({ where: { id: productId } });
}

async function usedCount() {
  return (await prisma.voucher.findUniqueOrThrow({ where: { code: "GIAM10" } }))
    .usedCount;
}

describe("expireStaleOnlineOrders (BL-1)", () => {
  it("hủy đơn online mới chưa thanh toán quá 24h, hoàn kho và voucher đúng một lần", async () => {
    const stale = await onlineOrder("0900000001", 25 * HOUR, {
      lines: [{ productId, quantity: 3 }],
      voucherCode: "GIAM10",
    });

    const paid = await onlineOrder("0900000002", 25 * HOUR);
    await prisma.payment.updateMany({
      where: { orderId: paid.id },
      data: { receivedAt: new Date() },
    });
    await prisma.order.update({
      where: { id: paid.id },
      data: { status: "paid" },
    });

    const recent = await onlineOrder("0900000003", 23 * HOUR);
    const confirmed = await onlineOrder("0900000004", 25 * HOUR);
    await prisma.order.update({
      where: { id: confirmed.id },
      data: { fulfillmentStatus: "confirmed" },
    });

    const pos = await createOrder({
      clientId: randomUUID(),
      channel: "pos",
      lines: [
        {
          productId,
          name: "Nước mắm",
          unitPrice: 50_000,
          originalPrice: 50_000,
          quantity: 1,
          discount: 0,
          unit: "chai",
          isService: false,
        },
      ],
      payments: [{ method: "transfer", amount: 50_000 }],
    });
    await prisma.order.update({
      where: { id: pos.order.id },
      data: { createdAt: new Date(Date.now() - 25 * HOUR) },
    });

    // 3 + 1 + 1 + 1 (online) + 1 (POS).
    expect(await product()).toMatchObject({ stock: 13, soldCount: 5 });
    expect(await usedCount()).toBe(1);
    vi.mocked(revalidatePublic).mockClear();

    const first = await expireStaleOnlineOrders();

    expect(first.cancelled).toBe(1);
    expect(
      await prisma.order.findUniqueOrThrow({ where: { id: stale.id } }),
    ).toMatchObject({ status: "cancelled", fulfillmentStatus: "cancelled" });
    expect(await product()).toMatchObject({ stock: 16, soldCount: 4 });
    expect(await usedCount()).toBe(0);
    expect(revalidatePublic).toHaveBeenCalledWith("catalog", "vouchers");

    const notification = await prisma.adminNotification.findUniqueOrThrow({
      where: { eventKey: `online-order:${stale.id}:expired` },
    });
    expect(notification).toMatchObject({
      entityType: "order",
      entityId: stale.id,
      href: `/admin/orders/${stale.id}`,
    });
    expect(notification.body).not.toContain("0900000001");

    for (const untouched of [paid, recent, confirmed, pos.order]) {
      const order = await prisma.order.findUniqueOrThrow({
        where: { id: untouched.id },
      });
      expect(order.status).not.toBe("cancelled");
    }

    vi.mocked(revalidatePublic).mockClear();
    const second = await expireStaleOnlineOrders();

    expect(second.cancelled).toBe(0);
    expect(await product()).toMatchObject({ stock: 16, soldCount: 4 });
    expect(await usedCount()).toBe(0);
    expect(
      await prisma.stockMovement.count({
        where: { productId, reason: "cancel" },
      }),
    ).toBe(1);
    expect(
      await prisma.adminNotification.count({
        where: { kind: "online_order_expired" },
      }),
    ).toBe(1);
    expect(revalidatePublic).not.toHaveBeenCalled();
  });

  it("hai lần chạy đồng thời chỉ hủy và hoàn kho một lần", async () => {
    const stale = await onlineOrder("0900000005", 30 * HOUR, {
      lines: [{ productId, quantity: 4 }],
      voucherCode: "GIAM10",
    });
    expect(await product()).toMatchObject({ stock: 16, soldCount: 1 });

    const results = await Promise.all([
      expireStaleOnlineOrders(),
      expireStaleOnlineOrders(),
    ]);

    expect(results.reduce((sum, result) => sum + result.cancelled, 0)).toBe(1);
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { id: stale.id } }))
        .status,
    ).toBe("cancelled");
    expect(await product()).toMatchObject({ stock: 20, soldCount: 0 });
    expect(await usedCount()).toBe(0);
    expect(
      await prisma.adminNotification.count({
        where: { kind: "online_order_expired" },
      }),
    ).toBe(1);
  });
});

describe("scheduleStaleOnlineOrderExpiry", () => {
  afterEach(() => {
    stopStaleOnlineOrderExpiry();
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("chạy định kỳ, không chồng lượt và không giữ tiến trình sống", async () => {
    vi.useFakeTimers();
    let release: () => void = () => {};
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    const timer = scheduleStaleOnlineOrderExpiry({ run, intervalMs: 1_000 });
    expect(timer?.hasRef()).toBe(false);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(run).toHaveBeenCalledTimes(1);

    // Lượt đầu chưa xong: tick tiếp theo bị bỏ qua.
    await vi.advanceTimersByTimeAsync(2_000);
    expect(run).toHaveBeenCalledTimes(1);

    release();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("bắt và ghi log lỗi của một lượt, lượt sau vẫn chạy", async () => {
    vi.useFakeTimers();
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const run = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(
        Object.assign(new Error("SQLITE_BUSY 0900000001"), {
          code: "P1008",
        }),
      )
      .mockResolvedValue({ cancelled: 0 });

    scheduleStaleOnlineOrderExpiry({ run, intervalMs: 1_000 });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const logged = consoleErrorSpy.mock.calls[0]?.[0] as {
      message: string;
      meta: Record<string, unknown>;
    };
    expect(logged.message).toBe("stale_online_order_expiry_failed");
    expect(logged.meta).toMatchObject({ errorCode: "P1008" });
    expect(JSON.stringify(logged)).not.toContain("0900000001");

    await vi.advanceTimersByTimeAsync(1_000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("gọi lần hai (HMR, register chạy lại) trả timer đang chạy, không quét chồng", async () => {
    vi.useFakeTimers();
    const first = vi.fn().mockResolvedValue({ cancelled: 0 });
    const second = vi.fn().mockResolvedValue({ cancelled: 0 });

    const timer = scheduleStaleOnlineOrderExpiry({
      run: first,
      intervalMs: 1_000,
    });
    expect(timer).not.toBeNull();
    expect(
      scheduleStaleOnlineOrderExpiry({ run: second, intervalMs: 1_000 }),
    ).toBe(timer);

    await vi.advanceTimersByTimeAsync(3_000);
    expect(first).toHaveBeenCalledTimes(3);
    expect(second).not.toHaveBeenCalled();
  });

  it("DISABLE_BACKGROUND_JOBS=1 thì không hẹn giờ", async () => {
    vi.useFakeTimers();
    vi.stubEnv("DISABLE_BACKGROUND_JOBS", "1");
    const run = vi.fn().mockResolvedValue({ cancelled: 0 });

    expect(scheduleStaleOnlineOrderExpiry({ run, intervalMs: 1_000 })).toBe(
      null,
    );
    await vi.advanceTimersByTimeAsync(5_000);
    expect(run).not.toHaveBeenCalled();

    // Không để lại guard: bật lại thì hẹn giờ bình thường.
    vi.unstubAllEnvs();
    expect(
      scheduleStaleOnlineOrderExpiry({ run, intervalMs: 1_000 }),
    ).not.toBeNull();
  });
});
