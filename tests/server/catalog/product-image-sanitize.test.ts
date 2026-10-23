import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { getOnlineCatalog } from "@/server/catalog/get-online-catalog";
import { getPosCatalog } from "@/server/catalog/get-pos-catalog";
import { getOnlineProductDetail } from "@/server/catalog/get-product-detail";
import { listCategoryProducts } from "@/server/catalog/list-category-products";
import { prisma } from "@/server/db/prisma";
import { getWishlistProducts } from "@/server/storefront/wishlist-products";

// WB-7: ảnh lưu từ trước (http://, host lạ) không được trả ra cho POS/shop.
const CAT_ID = "test-cat-image-sanitize";
const UNSPLASH = "https://images.unsplash.com/photo-1542838132-92c53300491e";
const PRODUCTS = [
  { id: "img-legacy-http", imageUrl: "http://cdn.example.com/a.jpg" },
  { id: "img-other-host", imageUrl: "https://example.com/a.jpg" },
  { id: "img-unsplash", imageUrl: UNSPLASH },
  { id: "img-upload", imageUrl: "/uploads/products/abc123.webp" },
];
const IDS = PRODUCTS.map((product) => product.id);
const EXPECTED: Record<string, string | null> = {
  "img-legacy-http": null,
  "img-other-host": null,
  "img-unsplash": UNSPLASH,
  "img-upload": "/uploads/products/abc123.webp",
};

async function cleanup() {
  await prisma.product.deleteMany({ where: { id: { in: IDS } } });
  await prisma.category.deleteMany({ where: { id: CAT_ID } });
}

function imagesById(products: { id: string; imageUrl: string | null }[]) {
  return Object.fromEntries(
    products
      .filter((product) => IDS.includes(product.id))
      .map((product) => [product.id, product.imageUrl]),
  );
}

beforeEach(async () => {
  await cleanup();
  await prisma.category.create({
    data: { id: CAT_ID, name: "Ảnh sản phẩm", slug: "test-anh-san-pham" },
  });
  await prisma.product.createMany({
    data: PRODUCTS.map((product, index) => ({
      ...product,
      name: `Ảnh sản phẩm ${index}`,
      slug: `test-anh-san-pham-${index}`,
      price: 10_000,
      stock: 5,
      categoryId: CAT_ID,
    })),
  });
});

afterAll(cleanup);

describe("ảnh sản phẩm khi đọc catalog (WB-7)", () => {
  it("POS catalog bỏ ảnh http/host lạ, giữ ảnh hợp lệ", async () => {
    const catalog = await getPosCatalog();
    expect(imagesById(catalog.products)).toEqual(EXPECTED);
  });

  it("catalog online bỏ ảnh http/host lạ, giữ ảnh hợp lệ", async () => {
    const catalog = await getOnlineCatalog();
    expect(imagesById(catalog.products)).toEqual(EXPECTED);
  });

  it("trang danh mục bỏ ảnh http/host lạ, giữ ảnh hợp lệ", async () => {
    const page = await listCategoryProducts("test-anh-san-pham", 1);
    expect(imagesById(page!.products)).toEqual(EXPECTED);
  });

  it("chi tiết sản phẩm và sản phẩm liên quan bỏ ảnh http/host lạ", async () => {
    const detail = await getOnlineProductDetail("img-legacy-http");
    expect(detail!.product.imageUrl).toBeNull();
    expect(imagesById(detail!.relatedProducts)).toEqual({
      "img-other-host": null,
      "img-unsplash": UNSPLASH,
      "img-upload": "/uploads/products/abc123.webp",
    });
  });

  it("danh sách yêu thích bỏ ảnh http/host lạ, giữ ảnh hợp lệ", async () => {
    const products = await getWishlistProducts(IDS);
    expect(imagesById(products)).toEqual(EXPECTED);
  });
});
