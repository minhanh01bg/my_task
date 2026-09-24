import { cache } from "react";

import type { OnlineProduct } from "@/features/online-store/types";
import { cachedPublic } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import { prisma } from "@/server/db/prisma";

export interface OnlineProductDetail {
  product: OnlineProduct & {
    sku: string | null;
    category: { id: string; name: string; slug?: string | null } | null;
  };
  relatedProducts: OnlineProduct[];
}

const ONLINE_PRODUCT_SELECT = {
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
} as const;

type ProductLookup = { id: string } | { slug: string };

async function loadOnlineProductDetail(
  lookup: ProductLookup,
): Promise<OnlineProductDetail | null> {
  const product = await prisma.product.findFirst({
    where: {
      ...lookup,
      isActive: true,
      isService: false,
      deletedAt: null,
    },
    select: {
      ...ONLINE_PRODUCT_SELECT,
      sku: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!product) return null;

  let relatedProducts: OnlineProduct[] = [];
  if (product.categoryId) {
    relatedProducts = await prisma.product.findMany({
      where: {
        categoryId: product.categoryId,
        id: { not: product.id },
        isActive: true,
        isService: false,
        deletedAt: null,
      },
      orderBy: [{ soldCount: "desc" }, { name: "asc" }],
      take: 4,
      select: ONLINE_PRODUCT_SELECT,
    });
  }

  return {
    product,
    relatedProducts,
  };
}

/**
 * generateMetadata va page cung goi — cache() gom lai mot lan trong request.
 * Tag `product:<id>` cho lan sua san pham nay, `catalog` cho thay doi chung
 * (ton kho, san pham lien quan, slug).
 */
export const getOnlineProductDetail = cache(
  (id: string): Promise<OnlineProductDetail | null> =>
    cachedPublic(
      () => loadOnlineProductDetail({ id }),
      ["online-product-detail", id],
      {
        tags: [CACHE_TAGS.product(id), CACHE_TAGS.catalog],
        revalidate: 60,
        fallback: () => null,
      },
    ),
);

/**
 * Trang canonical `/shop/p/<slug>`. Chưa biết id trước khi đọc nên chỉ gắn
 * tag `catalog` — mọi lần saveProduct đều revalidate tag này.
 */
export const getOnlineProductDetailBySlug = cache(
  (slug: string): Promise<OnlineProductDetail | null> =>
    cachedPublic(
      () => loadOnlineProductDetail({ slug }),
      ["online-product-detail-slug", slug],
      {
        tags: [CACHE_TAGS.catalog],
        revalidate: 60,
        fallback: () => null,
      },
    ),
);
