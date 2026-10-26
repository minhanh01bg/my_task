// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logger";
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
import { cancelOrder } from "@/server/orders/cancel-order";
import {
  expireStaleOnlineOrders,
  STALE_ONLINE_ORDER_TTL_MS,
} from "@/server/orders/expire-stale-online-orders";
import { transitionOnlineOrder } from "@/server/orders/update-online-order";
import {
  quickUpdateProduct,
  saveProduct,
} from "@/server/products/save-product";
import { BACK_IN_STOCK_NOTIFICATION_KIND } from "@/types/back-in-stock";

const events: string[] = [];

const nextCache = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("next/cache", () => nextCache);

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
  nextCache.revalidatePath.mockReset();
  nextCache.revalidateTag.mockReset();
  nextCache.updateTag.mockReset();
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

    expect(
      await prisma.customerNotification.count({ where: { accountId } }),
    ).toBe(1);
  });

  it("tồn kho lẻ dưới 1 chưa đặt online được: không gửi, giữ đăng ký; đủ 1 thì gửi", async () => {
    await seedProduct();
    const accountId = await seedAccount(1);
    await subscribeBackInStock(accountId, PRODUCT_ID);

    await setStock(0.5);
    expect(await deliverBackInStockAlerts([PRODUCT_ID])).toEqual({
      delivered: 0,
    });
    expect(await sweepBackInStockAlerts()).toEqual({ delivered: 0 });
    expect(await prisma.customerNotification.count()).toBe(0);
    expect(await prisma.backInStockSubscription.count()).toBe(1);

    await setStock(1);
    expect(await deliverBackInStockAlerts([PRODUCT_ID])).toEqual({
      delivered: 1,
    });
    expect(await notifiedCount(accountId)).toBe(1);
    expect(await prisma.backInStockSubscription.count()).toBe(0);
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

  it("hai lượt gửi và sweep chạy cùng lúc: mỗi đăng ký đúng một thông báo", async () => {
    await seedProduct();
    const accountIds = [
      await seedAccount(1),
      await seedAccount(2),
      await seedAccount(3),
    ];
    for (const accountId of accountIds) {
      await subscribeBackInStock(accountId, PRODUCT_ID);
    }
    await setStock(4);

    const results = await Promise.all([
      deliverBackInStockAlerts([PRODUCT_ID]),
      deliverBackInStockAlerts([PRODUCT_ID]),
      sweepBackInStockAlerts(),
    ]);

    expect(results.reduce((sum, { delivered }) => sum + delivered, 0)).toBe(
      accountIds.length,
    );
    for (const accountId of accountIds) {
      expect(await notifiedCount(accountId)).toBe(1);
    }
    expect(await prisma.customerNotification.count()).toBe(accountIds.length);
    expect(await prisma.backInStockSubscription.count()).toBe(0);
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
      data: accounts.map(({ id }) => ({
        accountId: id,
        productId: PRODUCT_ID,
      })),
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

/** Don giu 2 san pham (ton kho da tru) — huy don thi hoan ton kho. */
async function seedOrder(
  key: string,
  channel: "pos" | "online",
  createdAt?: Date,
) {
  return prisma.order.create({
    data: {
      code: `BIS-${key}`,
      clientId: `bis-${key}`,
      channel,
      status: channel === "pos" ? "paid" : "pending",
      fulfillmentStatus: channel === "online" ? "new" : null,
      fulfillmentType: channel === "online" ? "pickup" : null,
      subtotal: 50_000,
      total: 50_000,
      ...(createdAt ? { createdAt } : {}),
      items: {
        create: {
          productId: PRODUCT_ID,
          nameSnapshot: "Cà phê sữa đá",
          unitPrice: 25_000,
          originalPrice: 25_000,
          quantity: 2,
          lineTotal: 50_000,
        },
      },
    },
  });
}

async function notifiedCount(accountId: string) {
  return prisma.customerNotification.count({
    where: { accountId, kind: BACK_IN_STOCK_NOTIFICATION_KIND },
  });
}

describe("Đường tăng tồn kho gửi báo có hàng sau commit", () => {
  let accountId: string;

  beforeEach(async () => {
    await seedProduct();
    accountId = await seedAccount(1);
    await subscribeBackInStock(accountId, PRODUCT_ID);
  });

  it("quickUpdateProduct nhập hàng: gửi; vẫn 0 thì không", async () => {
    await quickUpdateProduct({
      id: PRODUCT_ID,
      price: 26_000,
      stock: 0,
      originalStock: 0,
    });
    expect(await notifiedCount(accountId)).toBe(0);

    await quickUpdateProduct({
      id: PRODUCT_ID,
      price: 26_000,
      stock: 12,
      originalStock: 0,
    });

    expect(await notifiedCount(accountId)).toBe(1);
    expect(await prisma.backInStockSubscription.count()).toBe(0);
  });

  it("saveProduct sửa tồn kho: gửi", async () => {
    await saveProduct({
      id: PRODUCT_ID,
      name: "Cà phê sữa đá",
      unit: "ly",
      price: 25_000,
      costPrice: 15_000,
      stock: 4,
      originalStock: 0,
    });

    expect(await notifiedCount(accountId)).toBe(1);
  });

  it("saveProduct bật bán lại sản phẩm đang có hàng: gửi", async () => {
    await prisma.product.update({
      where: { id: PRODUCT_ID },
      data: { stock: 7, isActive: false },
    });

    await saveProduct({
      id: PRODUCT_ID,
      name: "Cà phê sữa đá",
      unit: "ly",
      price: 25_000,
      costPrice: 15_000,
      stock: 7,
      originalStock: 7,
      isActive: true,
    });

    expect(await notifiedCount(accountId)).toBe(1);
  });

  it("cancelOrder độc lập: transaction hủy → revalidate → transaction gửi", async () => {
    const order = await seedOrder("pos", "pos");
    spyTransactions();

    const result = await cancelOrder(order.id);

    expect(result.restockedProductIds).toEqual([PRODUCT_ID]);
    expect(events).toEqual([
      "tx:begin",
      "tx:end",
      "revalidate:catalog",
      "tx:begin",
      "tx:end",
    ]);
    expect(await notifiedCount(accountId)).toBe(1);
  });

  it("transitionOnlineOrder(…, cancelled): gửi sau revalidate", async () => {
    const order = await seedOrder("online-cancel", "online");
    spyTransactions();

    await transitionOnlineOrder(order.id, "cancelled");

    expect(events).toEqual([
      "tx:begin",
      "tx:end",
      "revalidate:catalog",
      "tx:begin",
      "tx:end",
    ]);
    expect(await notifiedCount(accountId)).toBe(1);
  });

  it("expireStaleOnlineOrders hoàn tồn kho đơn quá hạn: gửi", async () => {
    await seedOrder(
      "online-stale",
      "online",
      new Date(Date.now() - STALE_ONLINE_ORDER_TTL_MS - 60_000),
    );

    expect(await expireStaleOnlineOrders()).toEqual({ cancelled: 1 });

    expect(vi.mocked(revalidatePublic)).toHaveBeenCalledWith("catalog");
    expect(await notifiedCount(accountId)).toBe(1);
  });
});

/**
 * Moi lan het han trang (revalidatePath) chay truoc moi lan tao thong bao.
 * invocationCallOrder dem chung cho moi mock nen so sanh duoc giua hai mock.
 */
function expectPageExpiredBeforeNotifications() {
  const expired = nextCache.revalidatePath.mock.invocationCallOrder;
  const notified = vi.mocked(createBackInStockNotification).mock
    .invocationCallOrder;
  expect(expired.length).toBeGreaterThan(0);
  expect(notified.length).toBeGreaterThan(0);
  expect(Math.max(...expired)).toBeLessThan(Math.min(...notified));
}

/** Het han tung trang, khong het han tag (khong doi "max" cua ghi khac). */
function expectOnlyPathsExpired(paths: string[]) {
  expect(nextCache.revalidatePath.mock.calls).toEqual(
    paths.map((path) => [path]),
  );
  expect(nextCache.revalidateTag).not.toHaveBeenCalled();
  expect(nextCache.updateTag).not.toHaveBeenCalled();
}

const PRODUCT_PAGE = `/shop/p/${PRODUCT_SLUG}`;

describe("Hết hạn ngay trang sản phẩm trước khi báo có hàng", () => {
  let accountId: string;

  beforeEach(async () => {
    // Ngoài Vitest public-cache mới thực sự gọi next/cache.
    vi.stubEnv("VITEST", "");
    await seedProduct();
    accountId = await seedAccount(1);
    await subscribeBackInStock(accountId, PRODUCT_ID);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("revalidatePath đúng trang thông báo mở, trước khi tạo thông báo", async () => {
    await setStock(5);

    expect(await deliverBackInStockAlerts([PRODUCT_ID])).toEqual({
      delivered: 1,
    });

    expectOnlyPathsExpired([PRODUCT_PAGE]);
    expectPageExpiredBeforeNotifications();
    const notification = await prisma.customerNotification.findFirstOrThrow({
      where: { accountId },
    });
    expect(notification.href).toBe(PRODUCT_PAGE);
  });

  it("sản phẩm chưa có slug: hết hạn /shop/products/<id>", async () => {
    await prisma.product.update({
      where: { id: PRODUCT_ID },
      data: { slug: null, stock: 2 },
    });

    expect(await deliverBackInStockAlerts([PRODUCT_ID])).toEqual({
      delivered: 1,
    });

    expectOnlyPathsExpired([`/shop/products/${PRODUCT_ID}`]);
    expectPageExpiredBeforeNotifications();
  });

  it("quickUpdateProduct nhập hàng: revalidatePublic → hết hạn trang → thông báo", async () => {
    await quickUpdateProduct({
      id: PRODUCT_ID,
      price: 25_000,
      stock: 9,
      originalStock: 0,
    });

    expect(events).toEqual([`revalidate:catalog,product:${PRODUCT_ID}`]);
    expectOnlyPathsExpired([PRODUCT_PAGE]);
    expect(
      vi.mocked(revalidatePublic).mock.invocationCallOrder[0],
    ).toBeLessThan(
      Math.min(...nextCache.revalidatePath.mock.invocationCallOrder),
    );
    expectPageExpiredBeforeNotifications();
    expect(await notifiedCount(accountId)).toBe(1);
  });

  // Cac duong nhap hang con lai va luot quet: deu qua deliverBackInStockAlerts.
  it.each<[string, () => Promise<unknown>]>([
    [
      "saveProduct sửa tồn kho",
      () =>
        saveProduct({
          id: PRODUCT_ID,
          name: "Cà phê sữa đá",
          unit: "ly",
          price: 25_000,
          costPrice: 15_000,
          stock: 4,
          originalStock: 0,
        }),
    ],
    [
      "cancelOrder",
      async () => cancelOrder((await seedOrder("expire-pos", "pos")).id),
    ],
    [
      "transitionOnlineOrder(…, cancelled)",
      async () =>
        transitionOnlineOrder(
          (await seedOrder("expire-online", "online")).id,
          "cancelled",
        ),
    ],
    [
      "expireStaleOnlineOrders",
      async () => {
        await seedOrder(
          "expire-stale",
          "online",
          new Date(Date.now() - STALE_ONLINE_ORDER_TTL_MS - 60_000),
        );
        return expireStaleOnlineOrders();
      },
    ],
    [
      "lượt quét",
      async () => {
        await setStock(8);
        return sweepBackInStockAlerts();
      },
    ],
  ])("%s: hết hạn trang trước khi gửi", async (_path, restock) => {
    await restock();

    expectOnlyPathsExpired([PRODUCT_PAGE]);
    expectPageExpiredBeforeNotifications();
    expect(await notifiedCount(accountId)).toBe(1);
  });

  it("không ai chờ hoặc chưa đủ hàng: không đụng cache", async () => {
    await setStock(0.5);
    expect(await deliverBackInStockAlerts([PRODUCT_ID])).toEqual({
      delivered: 0,
    });

    await prisma.backInStockSubscription.deleteMany();
    await setStock(5);
    expect(await deliverBackInStockAlerts([PRODUCT_ID])).toEqual({
      delivered: 0,
    });

    expect(nextCache.revalidatePath).not.toHaveBeenCalled();
  });

  it("hết hạn trang lỗi (job nền không có store của Next): vẫn gửi, chỉ logger.warn", async () => {
    nextCache.revalidatePath.mockImplementation((path: string) => {
      throw new Error(
        `Invariant: static generation store missing in revalidatePath ${path}`,
      );
    });
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
    await setStock(3);

    await expect(deliverBackInStockAlerts([PRODUCT_ID])).resolves.toEqual({
      delivered: 1,
    });

    expect(await notifiedCount(accountId)).toBe(1);
    expect(await prisma.backInStockSubscription.count()).toBe(0);
    expect(warnSpy.mock.calls).toEqual([
      ["revalidatePath thất bại", { path: PRODUCT_PAGE, errorClass: "Error" }],
    ]);
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

  it("quá 100 sản phẩm: ưu tiên sản phẩm có đăng ký chờ lâu nhất, không theo id", async () => {
    const total = 101;
    const ids = Array.from(
      { length: total },
      (_, index) => `bis-sweep-${String(index).padStart(3, "0")}`,
    );
    await prisma.product.createMany({
      data: ids.map((id) => ({ id, name: id, price: 1_000, stock: 5 })),
    });
    const accountId = await seedAccount(1);
    const base = Date.now() - 24 * 60 * 60 * 1000;
    // id lớn nhất chờ lâu nhất; bis-sweep-000 chờ mới nhất.
    await prisma.backInStockSubscription.createMany({
      data: ids.map((productId, index) => ({
        accountId,
        productId,
        createdAt: new Date(base + (total - index) * 1_000),
      })),
    });

    expect(await sweepBackInStockAlerts()).toEqual({ delivered: 100 });

    expect(
      await prisma.backInStockSubscription.findMany({
        select: { productId: true },
      }),
    ).toEqual([{ productId: "bis-sweep-000" }]);
    expect(await sweepBackInStockAlerts()).toEqual({ delivered: 1 });
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
      .mockRejectedValueOnce(
        Object.assign(new Error("busy"), { code: "P1008" }),
      )
      .mockResolvedValue({ delivered: 0 });

    scheduleBackInStockSweep({ run, intervalMs: 1_000 });
    await vi.advanceTimersByTimeAsync(1_000);
    const logged = consoleErrorSpy.mock.calls[0]?.[0] as { message: string };
    expect(logged.message).toBe("back_in_stock_sweep_failed");

    await vi.advanceTimersByTimeAsync(1_000);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
