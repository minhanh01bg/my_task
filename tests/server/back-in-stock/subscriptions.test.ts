import { beforeEach, describe, expect, it } from "vitest";

import {
  isSubscribedBackInStock,
  MAX_PENDING_BACK_IN_STOCK_PER_ACCOUNT,
  subscribeBackInStock,
  unsubscribeBackInStock,
} from "@/server/back-in-stock/subscriptions";
import { prisma } from "@/server/db/prisma";

let accountId: string;

async function seedProduct(
  id: string,
  data: {
    stock?: number;
    isActive?: boolean;
    isService?: boolean;
    deletedAt?: Date;
  } = {},
) {
  return prisma.product.create({
    data: { id, name: `Sản phẩm ${id}`, price: 20_000, stock: 0, ...data },
  });
}

beforeEach(async () => {
  await prisma.backInStockSubscription.deleteMany();
  await prisma.customerNotification.deleteMany();
  await prisma.customerSession.deleteMany();
  await prisma.customerAccount.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.product.deleteMany();

  const account = await prisma.customerAccount.create({
    data: {
      phoneNormalized: "+84900000801",
      displayName: "Khách chờ hàng",
      passwordHash: "dummy",
    },
  });
  accountId = account.id;
});

describe("subscribeBackInStock", () => {
  it("đăng ký sản phẩm hết hàng; gọi lại không tạo thêm dòng", async () => {
    await seedProduct("bis-out");

    expect(await subscribeBackInStock(accountId, "bis-out")).toEqual({
      ok: true,
    });
    expect(await subscribeBackInStock(accountId, "bis-out")).toEqual({
      ok: true,
    });

    expect(
      await prisma.backInStockSubscription.count({
        where: { accountId, productId: "bis-out" },
      }),
    ).toBe(1);
  });

  it("tồn kho âm cũng coi là hết hàng", async () => {
    await seedProduct("bis-negative", { stock: -2 });

    expect(await subscribeBackInStock(accountId, "bis-negative")).toEqual({
      ok: true,
    });
  });

  it("sản phẩm còn hàng → product_in_stock, không ghi gì", async () => {
    await seedProduct("bis-in", { stock: 3 });

    expect(await subscribeBackInStock(accountId, "bis-in")).toEqual({
      ok: false,
      code: "product_in_stock",
    });
    expect(await prisma.backInStockSubscription.count()).toBe(0);
  });

  it("sản phẩm ẩn, đã xóa mềm, dịch vụ hoặc không tồn tại → product_not_found", async () => {
    await seedProduct("bis-hidden", { isActive: false });
    await seedProduct("bis-deleted", { deletedAt: new Date() });
    await seedProduct("bis-service", { isService: true });

    for (const id of ["bis-hidden", "bis-deleted", "bis-service", "bis-x"]) {
      expect(await subscribeBackInStock(accountId, id)).toEqual({
        ok: false,
        code: "product_not_found",
      });
    }
    expect(await prisma.backInStockSubscription.count()).toBe(0);
  });

  it(`đăng ký thứ ${MAX_PENDING_BACK_IN_STOCK_PER_ACCOUNT + 1} → too_many_subscriptions`, async () => {
    const ids = Array.from(
      { length: MAX_PENDING_BACK_IN_STOCK_PER_ACCOUNT + 1 },
      (_, index) => `bis-cap-${index}`,
    );
    await prisma.product.createMany({
      data: ids.map((id) => ({ id, name: id, price: 1_000, stock: 0 })),
    });
    await prisma.backInStockSubscription.createMany({
      data: ids
        .slice(0, MAX_PENDING_BACK_IN_STOCK_PER_ACCOUNT)
        .map((productId) => ({ accountId, productId })),
    });

    expect(await subscribeBackInStock(accountId, ids.at(-1)!)).toEqual({
      ok: false,
      code: "too_many_subscriptions",
    });
    // Sản phẩm đã đăng ký vẫn trả ok dù đã chạm trần.
    expect(await subscribeBackInStock(accountId, ids[0]!)).toEqual({
      ok: true,
    });
    expect(
      await prisma.backInStockSubscription.count({ where: { accountId } }),
    ).toBe(MAX_PENDING_BACK_IN_STOCK_PER_ACCOUNT);
  });
});

describe("unsubscribeBackInStock / isSubscribedBackInStock", () => {
  it("hủy idempotent, kể cả khi chưa từng đăng ký", async () => {
    await seedProduct("bis-off");
    await subscribeBackInStock(accountId, "bis-off");
    expect(await isSubscribedBackInStock(accountId, "bis-off")).toBe(true);

    expect(await unsubscribeBackInStock(accountId, "bis-off")).toEqual({
      ok: true,
    });
    expect(await unsubscribeBackInStock(accountId, "bis-off")).toEqual({
      ok: true,
    });
    expect(await unsubscribeBackInStock(accountId, "bis-missing")).toEqual({
      ok: true,
    });
    expect(await isSubscribedBackInStock(accountId, "bis-off")).toBe(false);
  });

  it("chỉ hủy đăng ký của chính tài khoản", async () => {
    await seedProduct("bis-shared");
    const other = await prisma.customerAccount.create({
      data: {
        phoneNormalized: "+84900000802",
        displayName: "Khách khác",
        passwordHash: "dummy",
      },
    });
    await subscribeBackInStock(accountId, "bis-shared");
    await subscribeBackInStock(other.id, "bis-shared");

    await unsubscribeBackInStock(accountId, "bis-shared");

    expect(await isSubscribedBackInStock(accountId, "bis-shared")).toBe(false);
    expect(await isSubscribedBackInStock(other.id, "bis-shared")).toBe(true);
  });
});
