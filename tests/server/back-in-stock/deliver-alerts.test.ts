// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deliverBackInStockAlerts,
  scheduleBackInStockSweep,
  stopBackInStockSweep,
  sweepBackInStockAlerts,
} from "@/server/back-in-stock/deliver-alerts";
import { subscribeBackInStock } from "@/server/back-in-stock/subscriptions";
import { revalidatePublic } from "@/server/cache/public-cache";
import { createBackInStockNotification } from "@/server/customer-notifications/create-customer-notification";
import { prisma } from "@/server/db/prisma";
import { BACK_IN_STOCK_NOTIFICATION_KIND } from "@/types/back-in-stock";

const events: string[] = [];

vi.mock("@/server/cache/public-cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/cache/public-cache")>()),
  revalidatePublic: vi.fn((...tags: string[]) => {
    events.push(`revalidate:${tags.join(",")}`);
  }),
}));

vi.mock(
  "@/server/customer-notifications/create-customer-notification",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/server/customer-notifications/create-customer-notification")
      >();
    return {
      ...actual,
      createBackInStockNotification: vi.fn(
        actual.createBackInStockNotification,
      ),
    };
  },
);

const PRODUCT_ID = "bis-deliver-01";
const PRODUCT_SLUG = "ca-phe-sua-da";

async function seedAccount(suffix: number) {
  const account = await prisma.customerAccount.create({
    data: {
      phoneNormalized: `+849000009${String(suffix).padStart(2, "0")}`,
      displayName: `Khách ${suffix}`,
      passwordHash: "dummy",
    },
  });
  return account.id;
}

async function seedProduct(
  data: { id?: string; slug?: string | null; stock?: number } = {},
) {
  return prisma.product.create({
    data: {
      id: data.id ?? PRODUCT_ID,
      name: "Cà phê sữa đá",
      slug: data.slug === undefined ? PRODUCT_SLUG : data.slug,
      price: 25_000,
      stock: data.stock ?? 0,
      searchText: "ca phe sua da",
    },
  });
}

async function setStock(stock: number, id = PRODUCT_ID) {
  await prisma.product.update({ where: { id }, data: { stock } });
}

/** Ghi ranh gioi transaction de kiem tra khi nao delivery mo transaction. */
function spyTransactions() {
  const originalTransaction = prisma.$transaction.bind(prisma);
  return vi.spyOn(prisma, "$transaction").mockImplementation(((
    ...args: Parameters<typeof originalTransaction>
  ) => {
    events.push("tx:begin");
    return originalTransaction(...args).finally(() => {
      events.push("tx:end");
    });
  }) as typeof prisma.$transaction);
}

beforeEach(async () => {
  await prisma.backInStockSubscription.deleteMany();
  await prisma.customerNotification.deleteMany();
  await prisma.customerSession.deleteMany();
  await prisma.adminNotification.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.customerAccount.deleteMany();
  await prisma.product.deleteMany();
  events.length = 0;
  vi.mocked(revalidatePublic).mockClear();
  vi.mocked(createBackInStockNotification).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("deliverBackInStockAlerts", () => {
  it("mỗi khách đúng một thông báo tới trang sản phẩm, đăng ký bị xóa", async () => {
    await seedProduct();
    const first = await seedAccount(1);
    const second = await seedAccount(2);
    await subscribeBackInStock(first, PRODUCT_ID);
    await subscribeBackInStock(second, PRODUCT_ID);
    const subscriptions = await prisma.backInStockSubscription.findMany({
      select: { id: true, accountId: true },
    });
    await setStock(5);

    expect(await deliverBackInStockAlerts([PRODUCT_ID, PRODUCT_ID])).toEqual({
      delivered: 2,
    });

    expect(await prisma.backInStockSubscription.count()).toBe(0);
    for (const subscription of subscriptions) {
      const notifications = await prisma.customerNotification.findMany({
        where: { accountId: subscription.accountId },
      });
      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject({
        kind: BACK_IN_STOCK_NOTIFICATION_KIND,
        title: "Sản phẩm bạn chờ đã có hàng",
        body: "Cà phê sữa đá đã có hàng trở lại. Đặt mua ngay trước khi hết nhé.",
        eventKey: `back-in-stock:${subscription.id}`,
        href: `/shop/p/${PRODUCT_SLUG}`,
        orderId: null,
        readAt: null,
      });
    }
  });

  it("sản phẩm chưa có slug: href /shop/products/<id>", async () => {
    await seedProduct({ slug: null });
    const accountId = await seedAccount(1);
    await subscribeBackInStock(accountId, PRODUCT_ID);
    await setStock(1);

    await deliverBackInStockAlerts([PRODUCT_ID]);

    const notification = await prisma.customerNotification.findFirstOrThrow({
      where: { accountId },
    });
    expect(notification.href).toBe(`/shop/products/${PRODUCT_ID}`);
  });

  it("gọi hai lần không tạo thông báo trùng", async () => {
    await seedProduct();
    const accountId = await seedAccount(1);
    await subscribeBackInStock(accountId, PRODUCT_ID);
    await setStock(3);

    await deliverBackInStockAlerts([PRODUCT_ID]);
    expect(await deliverBackInStockAlerts([PRODUCT_ID])).toEqual({
      delivered: 0,
    });

    expect(await prisma.customerNotification.count({ where: { accountId } })).toBe(
      1,
    );
  });

  it("sản phẩm còn hết hàng, bị ẩn hoặc đã xóa mềm: không gửi, giữ đăng ký", async () => {
    await seedProduct();
    const accountId = await seedAccount(1);
    await subscribeBackInStock(accountId, PRODUCT_ID);

    expect(await deliverBackInStockAlerts([PRODUCT_ID])).toEqual({
      delivered: 0,
    });

    await prisma.product.update({
      where: { id: PRODUCT_ID },
      data: { stock: 4, isActive: false },
    });
    expect(await deliverBackInStockAlerts([PRODUCT_ID])).toEqual({
      delivered: 0,
    });

    await prisma.product.update({
      where: { id: PRODUCT_ID },
      data: { isActive: true, deletedAt: new Date() },
    });
    expect(await deliverBackInStockAlerts([PRODUCT_ID])).toEqual({
      delivered: 0,
    });

    expect(await prisma.customerNotification.count()).toBe(0);
    expect(await prisma.backInStockSubscription.count()).toBe(1);
  });

  it("đăng ký lại sau lần hết hàng thứ hai: thông báo thứ hai, eventKey khác", async () => {
    await seedProduct();
    const accountId = await seedAccount(1);
    await subscribeBackInStock(accountId, PRODUCT_ID);
    await setStock(2);
    await deliverBackInStockAlerts([PRODUCT_ID]);

    await setStock(0);
    expect(await subscribeBackInStock(accountId, PRODUCT_ID)).toEqual({
      ok: true,
    });
    await setStock(6);
    expect(await deliverBackInStockAlerts([PRODUCT_ID])).toEqual({
      delivered: 1,
    });

    const notifications = await prisma.customerNotification.findMany({
      where: { accountId },
      select: { eventKey: true },
    });
    expect(notifications).toHaveLength(2);
    expect(new Set(notifications.map((n) => n.eventKey)).size).toBe(2);
  });

  it("không ai chờ: chỉ một lần đọc, không mở transaction", async () => {
    await seedProduct({ stock: 5 });
    spyTransactions();

    expect(await deliverBackInStockAlerts([PRODUCT_ID, "bis-missing"])).toEqual(
      { delivered: 0 },
    );
    expect(await deliverBackInStockAlerts([])).toEqual({ delivered: 0 });
    expect(events).toEqual([]);
  });

  it("hơn một lô 50: gửi hết, mỗi lô một transaction", async () => {
    await seedProduct();
    const total = 55;
    await prisma.customerAccount.createMany({
      data: Array.from({ length: total }, (_, index) => ({
        phoneNormalized: `+84910000${String(index).padStart(3, "0")}`,
        displayName: `Khách lô ${index}`,
        passwordHash: "dummy",
      })),
    });
    const accounts = await prisma.customerAccount.findMany({
      select: { id: true },
    });
    await prisma.backInStockSubscription.createMany({
      data: accounts.map(({ id }) => ({ accountId: id, productId: PRODUCT_ID })),
    });
    await setStock(10);
    spyTransactions();

    expect(await deliverBackInStockAlerts([PRODUCT_ID])).toEqual({
      delivered: total,
    });

    expect(events).toEqual(["tx:begin", "tx:end", "tx:begin", "tx:end"]);
    expect(await prisma.backInStockSubscription.count()).toBe(0);
    expect(await prisma.customerNotification.count()).toBe(total);
  });

  it("lỗi khi tạo thông báo: không ném, giữ đăng ký, ghi log không lộ dữ liệu", async () => {
    await seedProduct();
    const accountId = await seedAccount(1);
    await subscribeBackInStock(accountId, PRODUCT_ID);
    await setStock(3);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    vi.mocked(createBackInStockNotification).mockRejectedValueOnce(
      Object.assign(new Error("SQLITE_BUSY +84900000901"), { code: "P1008" }),
    );

    await expect(deliverBackInStockAlerts([PRODUCT_ID])).resolves.toEqual({
      delivered: 0,
    });

    expect(await prisma.backInStockSubscription.count()).toBe(1);
    expect(await prisma.customerNotification.count()).toBe(0);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: PRODUCT_ID } }))
        .stock,
    ).toBe(3);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const logged = consoleErrorSpy.mock.calls[0]?.[0] as {
      message: string;
      meta: Record<string, unknown>;
    };
    expect(logged.message).toBe("back_in_stock_delivery_failed");
    expect(logged.meta).toMatchObject({
      productId: PRODUCT_ID,
      errorCode: "P1008",
    });
    expect(JSON.stringify(logged)).not.toContain("0900000901");

    // Lần sau (vd. sweep) gửi bù được.
    expect(await deliverBackInStockAlerts([PRODUCT_ID])).toEqual({
      delivered: 1,
    });
  });
});

describe("sweepBackInStockAlerts", () => {
  it("gửi các đăng ký còn treo của sản phẩm đã có hàng", async () => {
    await seedProduct();
    await seedProduct({ id: "bis-deliver-02", slug: "tra-dao", stock: 0 });
    const accountId = await seedAccount(1);
    await subscribeBackInStock(accountId, PRODUCT_ID);
    await subscribeBackInStock(accountId, "bis-deliver-02");
    // Có hàng lại mà không qua đường gửi (vd. lần gửi trước lỗi).
    await setStock(8);

    expect(await sweepBackInStockAlerts()).toEqual({ delivered: 1 });

    expect(
      await prisma.backInStockSubscription.findMany({
        select: { productId: true },
      }),
    ).toEqual([{ productId: "bis-deliver-02" }]);
    expect(await sweepBackInStockAlerts()).toEqual({ delivered: 0 });
  });
});

describe("scheduleBackInStockSweep", () => {
  afterEach(() => {
    stopBackInStockSweep();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("DISABLE_BACKGROUND_JOBS=1 thì không hẹn giờ", async () => {
    vi.useFakeTimers();
    vi.stubEnv("DISABLE_BACKGROUND_JOBS", "1");
    const run = vi.fn().mockResolvedValue({ delivered: 0 });

    expect(scheduleBackInStockSweep({ run, intervalMs: 1_000 })).toBeNull();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(run).not.toHaveBeenCalled();
  });

  it("gọi hai lần trả cùng timer, không giữ tiến trình; stop hủy timer", async () => {
    vi.useFakeTimers();
    const first = vi.fn().mockResolvedValue({ delivered: 0 });
    const second = vi.fn().mockResolvedValue({ delivered: 0 });

    const timer = scheduleBackInStockSweep({ run: first, intervalMs: 1_000 });
    expect(timer).not.toBeNull();
    expect(timer?.hasRef()).toBe(false);
    expect(scheduleBackInStockSweep({ run: second, intervalMs: 1_000 })).toBe(
      timer,
    );
    await vi.advanceTimersByTimeAsync(2_000);
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).not.toHaveBeenCalled();

    stopBackInStockSweep();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(first).toHaveBeenCalledTimes(2);
    const next = scheduleBackInStockSweep({ run: second, intervalMs: 1_000 });
    expect(next).not.toBe(timer);
  });

  it("lỗi một lượt chỉ ghi log back_in_stock_sweep_failed", async () => {
    vi.useFakeTimers();
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const run = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(Object.assign(new Error("busy"), { code: "P1008" }))
      .mockResolvedValue({ delivered: 0 });

    scheduleBackInStockSweep({ run, intervalMs: 1_000 });
    await vi.advanceTimersByTimeAsync(1_000);
    const logged = consoleErrorSpy.mock.calls[0]?.[0] as { message: string };
    expect(logged.message).toBe("back_in_stock_sweep_failed");

    await vi.advanceTimersByTimeAsync(1_000);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
