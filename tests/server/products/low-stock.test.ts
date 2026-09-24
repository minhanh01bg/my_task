import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PRODUCT_LOW_STOCK_THRESHOLD } from "@/server/admin/list-products";
import { prisma } from "@/server/db/prisma";
import { countLowStock } from "@/server/products/low-stock";

async function product(
  name: string,
  data: { stock: number; isService?: boolean; deletedAt?: Date },
) {
  return prisma.product.create({
    data: { name, price: 10_000, searchText: name, ...data },
  });
}

beforeEach(async () => {
  await prisma.stockMovement.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.productReview.deleteMany();
  await prisma.product.deleteMany();
});

afterAll(async () => {
  await prisma.product.deleteMany();
});

describe("countLowStock", () => {
  it("đếm hàng stock <= ngưỡng (kể cả tồn âm), bỏ dịch vụ và hàng đã xoá", async () => {
    await product("Sát ngưỡng", { stock: PRODUCT_LOW_STOCK_THRESHOLD });
    await product("Hết hàng", { stock: 0 });
    await product("Tồn âm", { stock: -2 });
    await product("Còn nhiều", { stock: PRODUCT_LOW_STOCK_THRESHOLD + 1 });
    await product("Tiền công", { stock: 0, isService: true });
    await product("Đã xoá", { stock: 1, deletedAt: new Date() });

    expect(await countLowStock()).toBe(3);
  });

  it("trả 0 khi kho đủ hàng", async () => {
    await product("Còn nhiều", { stock: 100 });
    expect(await countLowStock()).toBe(0);
  });
});
