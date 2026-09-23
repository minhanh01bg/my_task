import { cache } from "react";

import type { OnlineCatalog } from "@/features/online-store/types";
import { cachedPublic } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import { prisma } from "@/server/db/prisma";

/**
 * Giu `searchText` trong DTO: cua hang online loc/tim kiem phia client
 * (`features/online-store/filter-products.ts`).
 */
async function loadOnlineCatalog(): Promise<OnlineCatalog> {
  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            products: {
              where: { isActive: true, isService: false, deletedAt: null },
            },
          },
        },
      },
    }),
    prisma.product.findMany({
      where: { isActive: true, isService: false, deletedAt: null },
      orderBy: [{ soldCount: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        price: true,
        unit: true,
        stock: true,
        imageUrl: true,
        categoryId: true,
        searchText: true,
        soldCount: true,
      },
    }),
  ]);

  return {
    categories: categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      productCount: cat._count.products,
    })),
    products,
  };
}

/** Dedupe trong request (cache) + dung chung giua request theo tag catalog. */
export const getOnlineCatalog = cache(
  (): Promise<OnlineCatalog> =>
    cachedPublic(loadOnlineCatalog, ["online-catalog"], {
      tags: [CACHE_TAGS.catalog],
      revalidate: 60,
      fallback: () => ({ categories: [], products: [] }),
    }),
);
