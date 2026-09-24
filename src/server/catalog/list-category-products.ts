import { cache } from "react";

import type { OnlineProduct } from "@/features/online-store/types";
import { cachedPublic } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import { prisma } from "@/server/db/prisma";

export const CATEGORY_PAGE_SIZE = 24;

export interface CategoryProductsPage {
  category: { id: string; name: string; slug: string };
  products: OnlineProduct[];
  /** Tổng sản phẩm đang bán của danh mục (mọi trang). */
  total: number;
  page: number;
  pageSize: number;
}

async function loadCategoryProducts(
  slug: string,
  page: number,
): Promise<CategoryProductsPage | null> {
  const category = await prisma.category.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
  if (!category?.slug) return null;

  // Cùng điều kiện với trang chi tiết; khớp index [categoryId, isActive, soldCount].
  const where = {
    categoryId: category.id,
    isActive: true,
    isService: false,
    deletedAt: null,
  };
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ soldCount: "desc" }, { name: "asc" }],
      skip: (page - 1) * CATEGORY_PAGE_SIZE,
      take: CATEGORY_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        unit: true,
        stock: true,
        imageUrl: true,
        categoryId: true,
        searchText: true,
        soldCount: true,
        ratingAvg: true,
        ratingCount: true,
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    category: { id: category.id, name: category.name, slug: category.slug },
    products,
    total,
    page,
    pageSize: CATEGORY_PAGE_SIZE,
  };
}

/**
 * Một trang sản phẩm của danh mục (3 truy vấn cố định, không N+1). Dedupe
 * trong request (generateMetadata + page) và Data Cache theo tag catalog.
 */
export const listCategoryProducts = cache(
  (slug: string, page: number): Promise<CategoryProductsPage | null> => {
    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    return cachedPublic(
      () => loadCategoryProducts(slug, safePage),
      ["category-products", slug, String(safePage)],
      {
        tags: [CACHE_TAGS.catalog],
        revalidate: 60,
        fallback: () => null,
      },
    );
  },
);
