import { cache } from "react";

import { cachedPublic } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import { prisma } from "@/server/db/prisma";

export interface SitemapProduct {
  id: string;
  /** ISO 8601 — Data Cache chỉ giữ được giá trị JSON, không giữ Date. */
  updatedAt: string;
}

/** Cùng điều kiện với trang chi tiết: chỉ URL trả 200 mới vào sitemap. */
async function loadSitemapProducts(): Promise<SitemapProduct[]> {
  const rows = await prisma.product.findMany({
    where: { isActive: true, isService: false, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: { id: true, updatedAt: true },
  });
  return rows.map((row) => ({
    id: row.id,
    updatedAt: row.updatedAt.toISOString(),
  }));
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
