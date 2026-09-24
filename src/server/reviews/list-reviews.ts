import type { Prisma } from "@prisma/client";

import { paginate } from "@/server/admin/pagination";
import { cachedPublic } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import { prisma } from "@/server/db/prisma";
import {
  REVIEW_PAGE_SIZE,
  type PublicReview,
  type PublicReviewPage,
} from "@/types/review";

export const publicReviewSelect = {
  id: true,
  authorName: true,
  rating: true,
  content: true,
  isVerifiedPurchase: true,
  createdAt: true,
} satisfies Prisma.ProductReviewSelect;

type PublicReviewRow = Prisma.ProductReviewGetPayload<{
  select: typeof publicReviewSelect;
}>;

export function toPublicReview(row: PublicReviewRow): PublicReview {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

/**
 * Mot trang (10) danh gia `published` cua san pham, moi nhat truoc. Khop index
 * [productId, status, createdAt]. Khong kiem tra san pham ton tai — tra rong.
 */
export async function listProductReviews(
  productId: string,
  page: number,
): Promise<PublicReviewPage> {
  const where = { productId, status: "published" };
  const result = await paginate(
    { page, pageSize: REVIEW_PAGE_SIZE },
    () => prisma.productReview.count({ where }),
    ({ skip, take }) =>
      prisma.productReview.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
        select: publicReviewSelect,
      }),
  );
  return { ...result, items: result.items.map(toPublicReview) };
}

/**
 * Trang 1 cho HTML san pham (ISR): cache theo tag `product:<id>` — moi lan
 * tao/an/xoa review deu revalidate tag nay.
 */
export function getInitialProductReviews(
  productId: string,
): Promise<PublicReviewPage> {
  return cachedPublic(
    () => listProductReviews(productId, 1),
    ["product-reviews", productId],
    {
      tags: [CACHE_TAGS.product(productId)],
      revalidate: 60,
      fallback: () => ({
        items: [],
        total: 0,
        page: 1,
        pageSize: REVIEW_PAGE_SIZE,
      }),
    },
  );
}
