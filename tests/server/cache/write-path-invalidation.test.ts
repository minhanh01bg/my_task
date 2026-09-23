import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { revalidatePublic } from "@/server/cache/public-cache";
import { prisma } from "@/server/db/prisma";
import { cancelOrder } from "@/server/orders/cancel-order";
import { createOrder } from "@/server/orders/create-order";
import { saveProduct, softDeleteProduct } from "@/server/products/save-product";

const events: string[] = [];

vi.mock("@/server/cache/public-cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/cache/public-cache")>()),
  revalidatePublic: vi.fn((...tags: string[]) => {
    events.push(`revalidate:${tags.join(",")}`);
  }),
}));

function orderLine(productId: string) {
  return {
    productId,
    name: "Đường trắng",
    unitPrice: 15000,
    originalPrice: 15000,
    quantity: 1,
    discount: 0,
    unit: "kg",
    isService: false,
  };
}

beforeEach(async () => {
  await prisma.stockMovement.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();

  events.length = 0;
  vi.mocked(revalidatePublic).mockClear();

  // Ghi lai ranh gioi transaction de kiem tra revalidate chi chay SAU commit.
  const originalTransaction = prisma.$transaction.bind(prisma);
  vi.spyOn(prisma, "$transaction").mockImplementation(((
    ...args: Parameters<typeof originalTransaction>
  ) => {
    events.push("tx:begin");
    return originalTransaction(...args).finally(() => {
      events.push("tx:end");
    });
  }) as typeof prisma.$transaction);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Đường ghi làm mất hiệu lực cache công khai", () => {
  it("saveProduct/softDeleteProduct: tag catalog và product:<id>", async () => {
    const { id } = await saveProduct({
      name: "Đường trắng",
      unit: "kg",
      price: 15000,
      costPrice: 12000,
      stock: 5,
      isActive: true,
    });
    await softDeleteProduct(id);

    expect(vi.mocked(revalidatePublic).mock.calls).toEqual([
      ["catalog", `product:${id}`],
      ["catalog", `product:${id}`],
    ]);
  });

  it("createOrder và cancelOrder: tag catalog sau khi transaction kết thúc", async () => {
    const product = await prisma.product.create({
      data: {
        name: "Đường trắng",
        price: 15000,
        stock: 10,
        unit: "kg",
        searchText: "duong trang",
      },
    });
    events.length = 0;

    const { order } = await createOrder({
      clientId: "cache-c1",
      lines: [orderLine(product.id)],
      payments: [{ method: "cash", amount: 15000 }],
    });
    expect(events).toEqual(["tx:begin", "tx:end", "revalidate:catalog"]);

    events.length = 0;
    await cancelOrder(order.id);
    expect(events).toEqual(["tx:begin", "tx:end", "revalidate:catalog"]);
  });

  it("cancelOrder trong transaction của người gọi: không tự revalidate", async () => {
    const product = await prisma.product.create({
      data: {
        name: "Đường trắng",
        price: 15000,
        stock: 10,
        unit: "kg",
        searchText: "duong trang",
      },
    });
    const { order } = await createOrder({
      clientId: "cache-c2",
      lines: [orderLine(product.id)],
      payments: [{ method: "cash", amount: 15000 }],
    });
    vi.mocked(revalidatePublic).mockClear();

    await prisma.$transaction((tx) => cancelOrder(order.id, tx));

    expect(revalidatePublic).not.toHaveBeenCalled();
  });

  it("createOrder trùng clientId: không revalidate", async () => {
    const product = await prisma.product.create({
      data: {
        name: "Đường trắng",
        price: 15000,
        stock: 10,
        unit: "kg",
        searchText: "duong trang",
      },
    });
    const input = {
      clientId: "cache-c3",
      lines: [orderLine(product.id)],
      payments: [{ method: "cash" as const, amount: 15000 }],
    };
    await createOrder(input);
    vi.mocked(revalidatePublic).mockClear();

    const again = await createOrder(input);

    expect(again.duplicated).toBe(true);
    expect(revalidatePublic).not.toHaveBeenCalled();
  });
});
