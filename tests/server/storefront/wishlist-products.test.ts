import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { getWishlistProducts } from "@/server/storefront/wishlist-products";

const IDS = ["wl-a", "wl-b", "wl-deleted", "wl-inactive", "wl-service"];

async function reset() {
  await prisma.product.deleteMany({ where: { id: { in: IDS } } });
}

beforeEach(async () => {
  await reset();
  await prisma.product.createMany({
    data: [
      { id: "wl-a", name: "Gạo ST25", price: 30_000, stock: 5, slug: "wl-gao" },
      { id: "wl-b", name: "Nước mắm", price: 40_000, stock: 0 },
      { id: "wl-deleted", name: "Đã xoá", price: 1, deletedAt: new Date() },
      { id: "wl-inactive", name: "Ngừng bán", price: 1, isActive: false },
      { id: "wl-service", name: "Tiền công", price: 1, isService: true },
    ],
  });
});

afterAll(reset);

describe("getWishlistProducts", () => {
  it("giữ đúng thứ tự yêu thích, bỏ hàng đã xoá/ngừng bán/dịch vụ và id lạ", async () => {
    const products = await getWishlistProducts([
      "wl-b",
      "wl-deleted",
      "khong-co",
      "wl-a",
      "wl-inactive",
      "wl-service",
    ]);
    expect(products.map((p) => p.id)).toEqual(["wl-b", "wl-a"]);
    expect(products[1]).toMatchObject({
      name: "Gạo ST25",
      slug: "wl-gao",
      price: 30_000,
      stock: 5,
    });
  });

  it("danh sách rỗng không truy vấn gì", async () => {
    await expect(getWishlistProducts([])).resolves.toEqual([]);
  });
});
