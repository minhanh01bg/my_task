import { beforeEach, describe, expect, it } from "vitest";

import { listCategoriesWithProductCount } from "@/server/categories/get-categories";
import { prisma } from "@/server/db/prisma";

describe("listCategoriesWithProductCount", () => {
  beforeEach(async () => {
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
  });

  it("trả về danh sách danh mục sắp xếp theo sortOrder và đếm đúng số sản phẩm", async () => {
    const cat1 = await prisma.category.create({
      data: { name: "Bánh kẹo", slug: "banh-keo", sortOrder: 2 },
    });
    const cat2 = await prisma.category.create({
      data: { name: "Đồ uống", slug: "do-uong", sortOrder: 1 },
    });

    await prisma.product.create({
      data: {
        name: "Trà xanh",
        price: 10_000,
        costPrice: 7_000,
        unit: "chai",
        stock: 50,
        categoryId: cat2.id,
      },
    });

    const result = await listCategoriesWithProductCount();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(cat2.id);
    expect(result[0].name).toBe("Đồ uống");
    expect(result[0]._count.products).toBe(1);

    expect(result[1].id).toBe(cat1.id);
    expect(result[1].name).toBe("Bánh kẹo");
    expect(result[1]._count.products).toBe(0);
  });
});
