import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { backfillSlugs } from "@/server/seo/backfill-slugs";

async function reset() {
  await prisma.stockMovement.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
}

beforeEach(reset);
afterAll(reset);

describe("backfillSlugs", () => {
  it("gán slug duy nhất cho sản phẩm/danh mục còn thiếu, giữ slug sẵn có", async () => {
    const category = await prisma.category.create({
      data: { name: "Đồ uống" },
    });
    await prisma.category.create({
      data: { name: "Đồ uống cũ", slug: "do-uong-cu" },
    });
    await prisma.product.create({
      data: { name: "Bugi NGK", slug: "bugi-ngk" },
    });
    const a = await prisma.product.create({
      data: { name: "Bugi NGK", categoryId: category.id },
    });
    const b = await prisma.product.create({ data: { name: "bugi ngk" } });
    const deleted = await prisma.product.create({
      data: { name: "Hàng đã xoá", deletedAt: new Date() },
    });

    const result = await backfillSlugs(prisma);
    expect(result).toEqual({ products: 2, categories: 1 });

    const slugs = await prisma.product.findMany({
      where: { id: { in: [a.id, b.id, deleted.id] } },
      select: { id: true, slug: true },
    });
    const byId = new Map(slugs.map((row) => [row.id, row.slug]));
    expect(byId.get(a.id)).toBe("bugi-ngk-2");
    expect(byId.get(b.id)).toBe("bugi-ngk-3");
    expect(byId.get(deleted.id)).toBeNull();

    const cat = await prisma.category.findUniqueOrThrow({
      where: { id: category.id },
    });
    expect(cat.slug).toBe("do-uong");
  });

  it("idempotent: lần chạy thứ hai không đổi gì", async () => {
    await prisma.product.create({ data: { name: "Nhớt Castrol" } });
    await prisma.category.create({ data: { name: "Phụ tùng" } });

    expect(await backfillSlugs(prisma)).toEqual({ products: 1, categories: 1 });
    expect(await backfillSlugs(prisma)).toEqual({ products: 0, categories: 0 });
  });
});
