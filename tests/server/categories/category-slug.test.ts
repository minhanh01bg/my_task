import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { resolveCategorySlug } from "@/server/categories/category-slug";
import { prisma } from "@/server/db/prisma";

beforeEach(async () => {
  await prisma.product.updateMany({ data: { categoryId: null } });
  await prisma.category.deleteMany();
});

afterAll(async () => {
  await prisma.category.deleteMany();
});

describe("resolveCategorySlug", () => {
  it("sinh slug bỏ dấu, trùng thì thêm -2", async () => {
    expect(await resolveCategorySlug(prisma, { name: "Đồ uống" })).toBe(
      "do-uong",
    );
    await prisma.category.create({
      data: { name: "Đồ uống", slug: "do-uong" },
    });
    expect(await resolveCategorySlug(prisma, { name: "Đồ Uống" })).toBe(
      "do-uong-2",
    );
  });

  it("giữ nguyên slug đã có kể cả khi đổi tên", async () => {
    const category = await prisma.category.create({
      data: { name: "Mì gói", slug: "mi-goi-cu" },
    });
    expect(
      await resolveCategorySlug(prisma, { id: category.id, name: "Mì gói" }),
    ).toBe("mi-goi-cu");
    expect(
      await resolveCategorySlug(prisma, { id: category.id, name: "Mì  gói!" }),
    ).toBe("mi-goi-cu");
  });

  it("tên rỗng ký tự hợp lệ dùng slug dự phòng", async () => {
    expect(await resolveCategorySlug(prisma, { name: "???" })).toBe("danh-muc");
  });
});
