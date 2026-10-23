import { beforeEach, describe, expect, it, vi } from "vitest";

import CategoryPage, {
  generateMetadata as categoryMetadata,
} from "@/app/shop/c/[slug]/page";
import PaginatedCategoryPage, {
  generateMetadata as paginatedCategoryMetadata,
} from "@/app/shop/c/[slug]/page/[page]/page";
import ProductBySlugPage, {
  generateMetadata as productBySlugMetadata,
} from "@/app/shop/p/[slug]/page";
import ProductDetailPage, {
  generateMetadata as productDetailMetadata,
} from "@/app/shop/products/[id]/page";

const loaders = vi.hoisted(() => ({
  productBySlug: vi.fn(async () => null),
  productById: vi.fn(async () => null),
  category: vi.fn(async () => null),
}));

vi.mock("@/server/catalog/get-product-detail", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/server/catalog/get-product-detail")
  >()),
  getOnlineProductDetailBySlug: loaders.productBySlug,
  getOnlineProductDetail: loaders.productById,
}));

vi.mock("@/server/catalog/list-category-products", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/server/catalog/list-category-products")
  >()),
  listCategoryProducts: loaders.category,
}));

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

function noLoaderCalled() {
  expect(loaders.productBySlug).not.toHaveBeenCalled();
  expect(loaders.productById).not.toHaveBeenCalled();
  expect(loaders.category).not.toHaveBeenCalled();
}

// Trang ISR render (và cache) mọi param: giá trị không thể là slug/id thật phải
// 404 trước khi chạm DB.
const BAD_SLUGS = [
  "",
  "Nuoc-Mam",
  "nuoc--mam",
  "-nuoc-mam",
  "nuoc-mam-",
  "nuoc_mam",
  "nuoc.mam",
  "nước-mắm",
  "../admin",
  "a".repeat(81),
];
const BAD_IDS = [
  "",
  "a".repeat(65),
  "id.with.dot",
  "../admin",
  "id with space",
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/shop slug routes", () => {
  it.each(BAD_SLUGS)("404 without a lookup for slug %j", async (slug) => {
    const params = Promise.resolve({ slug });
    const pageParams = Promise.resolve({ slug, page: "2" });
    for (const render of [
      () => ProductBySlugPage({ params }),
      () => productBySlugMetadata({ params }),
      () => CategoryPage({ params }),
      () => categoryMetadata({ params }),
      () => PaginatedCategoryPage({ params: pageParams }),
      () => paginatedCategoryMetadata({ params: pageParams }),
    ]) {
      expect(await digestOf(render())).toContain("404");
    }
    noLoaderCalled();
  });

  it.each(["test-route-nuoc-mam", "a1", "a".repeat(80)])(
    "looks up well-formed slug %j",
    async (slug) => {
      await digestOf(ProductBySlugPage({ params: Promise.resolve({ slug }) }));
      expect(loaders.productBySlug).toHaveBeenCalledWith(slug);
      await digestOf(CategoryPage({ params: Promise.resolve({ slug }) }));
      expect(loaders.category).toHaveBeenCalledWith(slug, 1);
      await digestOf(
        PaginatedCategoryPage({ params: Promise.resolve({ slug, page: "2" }) }),
      );
      expect(loaders.category).toHaveBeenCalledWith(slug, 2);
    },
  );
});

describe("/shop/products/[id]", () => {
  it.each(BAD_IDS)("404 without a lookup for id %j", async (id) => {
    const params = Promise.resolve({ id });
    for (const render of [
      () => ProductDetailPage({ params }),
      () => productDetailMetadata({ params }),
    ]) {
      expect(await digestOf(render())).toContain("404");
    }
    noLoaderCalled();
  });

  it.each(["clx0k2v8a0000qz3b9c1d2e3f", "test-route-slug-01"])(
    "looks up id %j",
    async (id) => {
      await digestOf(ProductDetailPage({ params: Promise.resolve({ id }) }));
      expect(loaders.productById).toHaveBeenCalledWith(id);
    },
  );
});
