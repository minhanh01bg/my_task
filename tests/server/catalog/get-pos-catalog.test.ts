import { beforeEach, describe, expect, it } from "vitest";

import { getPosCatalog } from "@/server/catalog/get-pos-catalog";
import { prisma } from "@/server/db/prisma";

describe("getPosCatalog", () => {
  beforeEach(async () => {
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
  });

  it("trả về categories và products kèm fetchedAt cho POS", async () => {
    const cat = await prisma.category.create({
      data: { name: "Nước giải khát", slug: "nuoc-giai-khat", sortOrder: 1 },
    });

    const activeProd = await prisma.product.create({
      data: {
        name: "Coca Cola",
        price: 10_000,
        costPrice: 7_000,
        unit: "lon",
        stock: 24,
        categoryId: cat.id,
        isActive: true,
      },
    });

    // Inactive product should NOT be in POS catalog
    await prisma.product.create({
      data: {
        name: "Sản phẩm tạm ngưng",
        price: 15_000,
        costPrice: 10_000,
        unit: "cái",
        stock: 10,
        categoryId: cat.id,
        isActive: false,
      },
    });

    const catalog = await getPosCatalog();
    expect(catalog.categories).toHaveLength(1);
    expect(catalog.categories[0].id).toBe(cat.id);
    expect(catalog.products).toHaveLength(1);
    expect(catalog.products[0].id).toBe(activeProd.id);
    expect(catalog.products[0].name).toBe("Coca Cola");
    expect(catalog.fetchedAt).toBeDefined();
  });
});
