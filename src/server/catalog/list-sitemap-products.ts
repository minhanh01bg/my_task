import { cache } from "react";

import { cachedPublic } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import { prisma } from "@/server/db/prisma";

export interface SitemapProduct {
  id: string;
  /** Có slug → URL canonical `/shop/p/<slug>` (xem `productHref`). */
  slug: string | null;
  /** ISO 8601 — Data Cache chỉ giữ được giá trị JSON, không giữ Date. */
  updatedAt: string;
}

export interface SitemapCategory {
  id: string;
  slug: string;
}

const LISTED_PRODUCT = {
  isActive: true,
  isService: false,
  deletedAt: null,
} as const;

/** Cùng điều kiện với trang chi tiết: chỉ URL trả 200 mới vào sitemap. */
async function loadSitemapProducts(): Promise<SitemapProduct[]> {
  const rows = await prisma.product.findMany({
    where: LISTED_PRODUCT,
    orderBy: { updatedAt: "desc" },
    select: { id: true, slug: true, updatedAt: true },
  });
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

/** Danh mục có trang `/shop/c/<slug>` và ít nhất một sản phẩm đang bán. */
async function loadSitemapCategories(): Promise<SitemapCategory[]> {
  const rows = await prisma.category.findMany({
    where: { slug: { not: null }, products: { some: LISTED_PRODUCT } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, slug: true },
  });
  return rows.flatMap((row) =>
    row.slug ? [{ id: row.id, slug: row.slug }] : [],
  );
}

/** Dedupe trong request (cache) + Data Cache theo tag catalog, làm mới mỗi giờ. */
export const listSitemapProducts = cache(
  (): Promise<SitemapProduct[]> =>
    cachedPublic(loadSitemapProducts, ["sitemap-products"], {
      tags: [CACHE_TAGS.catalog],
      revalidate: 3600,
      fallback: () => [],
    }),
);

export const listSitemapCategories = cache(
  (): Promise<SitemapCategory[]> =>
    cachedPublic(loadSitemapCategories, ["sitemap-categories"], {
      tags: [CACHE_TAGS.catalog],
      revalidate: 3600,
      fallback: () => [],
    }),
);
