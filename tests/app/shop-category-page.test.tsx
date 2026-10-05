import { isValidElement } from "react";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import CategoryPage, { generateMetadata } from "@/app/shop/c/[slug]/page";
import PaginatedCategoryPage, {
  generateMetadata as generatePaginatedMetadata,
} from "@/app/shop/c/[slug]/page/[page]/page";
import { prisma } from "@/server/db/prisma";

const CATEGORY_ID = "test-route-cat-02";
const PRODUCT_ID = "test-route-cat-product-02";

async function cleanup() {
  await prisma.product.deleteMany({ where: { categoryId: CATEGORY_ID } });
  await prisma.category.deleteMany({ where: { id: CATEGORY_ID } });
}

beforeEach(async () => {
  await cleanup();
  await prisma.category.create({
    data: { id: CATEGORY_ID, name: "Gia vị", slug: "test-route-gia-vi" },
  });
  await prisma.product.create({
    data: { id: PRODUCT_ID, name: "Tiêu đen", categoryId: CATEGORY_ID },
  });
});

afterAll(cleanup);

/** Lỗi điều hướng của Next mang `digest`, không phải message. */
async function digestOf(render: Promise<unknown>): Promise<string> {
  try {
    await render;
  } catch (error: unknown) {
    const digest = (error as { digest?: unknown }).digest;
    return typeof digest === "string" ? digest : String(error);
  }
  return "rendered";
}

describe("/shop/c/[slug]", () => {
  it("render ISR và metadata mà không đọc searchParams của request", async () => {
    const props = {
      params: Promise.resolve({ slug: "test-route-gia-vi" }),
      get searchParams(): Promise<{ page?: string }> {
        throw new Error("ISR không được đọc searchParams");
      },
    };
    expect(isValidElement(await CategoryPage(props))).toBe(true);
    expect((await generateMetadata(props)).alternates?.canonical).toBe(
      "/shop/c/test-route-gia-vi",
    );
  });

  it("render trang danh mục theo slug", async () => {
    const element = await CategoryPage({
      params: Promise.resolve({ slug: "test-route-gia-vi" }),
    });
    expect(isValidElement(element)).toBe(true);
  });

  it("404 khi slug lạ hoặc trang vượt quá số trang", async () => {
    expect(
      await digestOf(
        CategoryPage({
          params: Promise.resolve({ slug: "khong-co" }),
        }),
      ),
    ).toContain("404");
    expect(
      await digestOf(
        PaginatedCategoryPage({
          params: Promise.resolve({ slug: "test-route-gia-vi", page: "3" }),
        }),
      ),
    ).toContain("404");
  });

  it("trang 2 dùng params, giữ canonical ?page=2 và phân trang đúng dữ liệu", async () => {
    await prisma.product.createMany({
      data: Array.from({ length: 24 }, (_, i) => ({
        name: `Gia vị ${i}`,
        categoryId: CATEGORY_ID,
      })),
    });
    const props = {
      params: Promise.resolve({ slug: "test-route-gia-vi", page: "2" }),
      get searchParams(): Promise<{ page?: string }> {
        throw new Error("ISR không được đọc searchParams");
      },
    };
    expect(isValidElement(await PaginatedCategoryPage(props))).toBe(true);
    expect((await generatePaginatedMetadata(props)).alternates?.canonical).toBe(
      "/shop/c/test-route-gia-vi?page=2",
    );
  });

  it.each(["0", "-1", "abc", "9007199254740992"])(
    "trang %s không hợp lệ trả 404",
    async (page) => {
      expect(
        await digestOf(
          PaginatedCategoryPage({
            params: Promise.resolve({ slug: "test-route-gia-vi", page }),
          }),
        ),
      ).toContain("404");
    },
  );
});
