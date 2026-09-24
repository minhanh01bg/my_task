import { isValidElement } from "react";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import CategoryPage from "@/app/shop/c/[slug]/page";
import { prisma } from "@/server/db/prisma";

const CATEGORY_ID = "test-route-cat-02";
const PRODUCT_ID = "test-route-cat-product-02";

async function cleanup() {
  await prisma.product.deleteMany({ where: { id: PRODUCT_ID } });
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
  it("render trang danh mục theo slug", async () => {
    const element = await CategoryPage({
      params: Promise.resolve({ slug: "test-route-gia-vi" }),
      searchParams: Promise.resolve({}),
    });
    expect(isValidElement(element)).toBe(true);
  });

  it("404 khi slug lạ hoặc trang vượt quá số trang", async () => {
    expect(
      await digestOf(
        CategoryPage({
          params: Promise.resolve({ slug: "khong-co" }),
          searchParams: Promise.resolve({}),
        }),
      ),
    ).toContain("404");
    expect(
      await digestOf(
        CategoryPage({
          params: Promise.resolve({ slug: "test-route-gia-vi" }),
          searchParams: Promise.resolve({ page: "3" }),
        }),
      ),
    ).toContain("404");
  });
});
