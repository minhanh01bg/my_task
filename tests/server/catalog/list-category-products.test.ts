import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  CATEGORY_PAGE_SIZE,
  listCategoryProducts,
} from "@/server/catalog/list-category-products";
import { prisma } from "@/server/db/prisma";

const CAT_ID = "test-cat-landing-01";
const OTHER_CAT_ID = "test-cat-landing-02";

async function cleanup() {
  await prisma.product.deleteMany({
    where: { categoryId: { in: [CAT_ID, OTHER_CAT_ID] } },
  });
  await prisma.category.deleteMany({
    where: { id: { in: [CAT_ID, OTHER_CAT_ID] } },
  });
}

beforeEach(async () => {
  await cleanup();
  await prisma.category.createMany({
    data: [
      { id: CAT_ID, name: "Mì gói", slug: "test-mi-goi" },
      { id: OTHER_CAT_ID, name: "Đồ uống", slug: "test-do-uong" },
    ],
  });
});

afterAll(cleanup);

describe("listCategoryProducts", () => {
  it("trả null khi slug không tồn tại", async () => {
    expect(await listCategoryProducts("khong-co-danh-muc", 1)).toBeNull();
  });

  it(`phân trang ${CATEGORY_PAGE_SIZE}/trang theo soldCount giảm dần, chỉ hàng đang bán của danh mục`, async () => {
    const total = CATEGORY_PAGE_SIZE + 3;
    await prisma.product.createMany({
      data: Array.from({ length: total }, (_, i) => ({
        id: `test-landing-p${String(i).padStart(2, "0")}`,
        name: `Mì ${String(i).padStart(2, "0")}`,
        slug: `test-landing-mi-${i}`,
        price: 5_000,
        categoryId: CAT_ID,
        soldCount: i,
      })),
    });
    await prisma.product.createMany({
      data: [
        { name: "Mì ẩn", categoryId: CAT_ID, isActive: false },
        { name: "Mì xoá", categoryId: CAT_ID, deletedAt: new Date() },
        { name: "Dịch vụ nấu mì", categoryId: CAT_ID, isService: true },
        { name: "Nước suối", categoryId: OTHER_CAT_ID, soldCount: 999 },
      ],
    });

    const first = await listCategoryProducts("test-mi-goi", 1);
    expect(first).not.toBeNull();
    expect(first?.category).toEqual({
      id: CAT_ID,
      name: "Mì gói",
      slug: "test-mi-goi",
    });
    expect(first?.total).toBe(total);
    expect(first?.pageSize).toBe(CATEGORY_PAGE_SIZE);
    expect(first?.products).toHaveLength(CATEGORY_PAGE_SIZE);
    expect(first?.products[0]).toMatchObject({
      name: `Mì ${total - 1}`,
      slug: `test-landing-mi-${total - 1}`,
    });
    // DTO công khai: không lộ giá vốn.
    expect(first?.products[0]).not.toHaveProperty("costPrice");

    const second = await listCategoryProducts("test-mi-goi", 2);
    expect(second?.products.map((p) => p.name)).toEqual([
      "Mì 02",
      "Mì 01",
      "Mì 00",
    ]);
  });

  it("trang vượt quá số trang trả danh sách rỗng kèm tổng", async () => {
    await prisma.product.create({
      data: { name: "Mì lẻ", categoryId: CAT_ID },
    });
    const result = await listCategoryProducts("test-mi-goi", 5);
    expect(result?.total).toBe(1);
    expect(result?.products).toEqual([]);
  });
});
