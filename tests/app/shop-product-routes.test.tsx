import { isValidElement } from "react";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import ProductBySlugPage from "@/app/shop/p/[slug]/page";
import ProductDetailPage from "@/app/shop/products/[id]/page";
import { prisma } from "@/server/db/prisma";
import { getShippingSettings } from "@/server/settings/store-settings";

const SLUG_ID = "test-route-slug-01";
const LEGACY_ID = "test-route-legacy-01";
const CATEGORY_ID = "test-route-cat-01";

async function cleanup() {
  await prisma.product.deleteMany({
    where: { id: { in: [SLUG_ID, LEGACY_ID] } },
  });
  await prisma.category.deleteMany({ where: { id: CATEGORY_ID } });
}

beforeEach(async () => {
  await cleanup();
  await prisma.category.create({
    data: { id: CATEGORY_ID, name: "Nước chấm", slug: "test-route-nuoc-cham" },
  });
  await prisma.product.create({
    data: {
      id: SLUG_ID,
      name: "Nước mắm Phú Quốc",
      slug: "test-route-nuoc-mam",
      price: 45_000,
      categoryId: CATEGORY_ID,
    },
  });
  await prisma.product.create({
    data: { id: LEGACY_ID, name: "Muối hột", price: 5_000 },
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

describe("/shop/products/[id] (URL cũ)", () => {
  it("chuyển hướng vĩnh viễn 308 sang /shop/p/<slug> khi sản phẩm có slug", async () => {
    const digest = await digestOf(
      ProductDetailPage({ params: Promise.resolve({ id: SLUG_ID }) }),
    );
    expect(digest).toMatch(/^NEXT_REDIRECT;/);
    expect(digest).toContain(";/shop/p/test-route-nuoc-mam;308;");
  });

  it("vẫn render trang khi sản phẩm chưa có slug", async () => {
    const element = await ProductDetailPage({
      params: Promise.resolve({ id: LEGACY_ID }),
    });
    expect(isValidElement(element)).toBe(true);
  });

  it("404 khi không có sản phẩm", async () => {
    const digest = await digestOf(
      ProductDetailPage({ params: Promise.resolve({ id: "khong-co" }) }),
    );
    expect(digest).toContain("404");
  });
});

describe("/shop/p/[slug]", () => {
  it("render sản phẩm theo slug", async () => {
    const element = await ProductBySlugPage({
      params: Promise.resolve({ slug: "test-route-nuoc-mam" }),
    });
    expect(isValidElement(element)).toBe(true);
    // Gio hang tren trang san pham dung cai dat phi ship cua cua hang.
    expect(
      (element as { props: { shipping?: unknown } }).props.shipping,
    ).toEqual(await getShippingSettings());
  });

  it("404 khi slug không tồn tại hoặc sản phẩm đã ẩn", async () => {
    expect(
      await digestOf(
        ProductBySlugPage({ params: Promise.resolve({ slug: "khong-co" }) }),
      ),
    ).toContain("404");

    await prisma.product.update({
      where: { id: SLUG_ID },
      data: { isActive: false },
    });
    expect(
      await digestOf(
        ProductBySlugPage({
          params: Promise.resolve({ slug: "test-route-nuoc-mam" }),
        }),
      ),
    ).toContain("404");
  });
});
