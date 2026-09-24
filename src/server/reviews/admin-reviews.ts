import type { Prisma } from "@prisma/client";

import { paginate, type PageResult } from "@/server/admin/pagination";
import { logAdminAction } from "@/server/auth/admin-audit";
import { revalidatePublic } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import { prisma } from "@/server/db/prisma";
import type { ReviewStatus } from "@/types/review";

import { recomputeProductRating } from "./product-rating";

export const ADMIN_REVIEWS_PAGE_SIZE = 20;

export interface ReviewActor {
  identityId?: string;
}

export type ReviewActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const NOT_FOUND: ReviewActionResult = {
  ok: false,
  error: "Không tìm thấy đánh giá",
};

const adminReviewSelect = {
  id: true,
  authorName: true,
  rating: true,
  content: true,
  isVerifiedPurchase: true,
  status: true,
  createdAt: true,
  product: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ProductReviewSelect;

export type AdminReviewRow = Prisma.ProductReviewGetPayload<{
  select: typeof adminReviewSelect;
}>;

export function listAdminReviews(query: {
  page?: number;
  pageSize?: number;
  status?: ReviewStatus;
}): Promise<PageResult<AdminReviewRow>> {
  const where = query.status ? { status: query.status } : {};
  return paginate(
    {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? ADMIN_REVIEWS_PAGE_SIZE,
    },
    () => prisma.productReview.count({ where }),
    ({ skip, take }) =>
      prisma.productReview.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
        select: adminReviewSelect,
      }),
  );
}

/** An/hien review; aggregate san pham tinh lai trong cung transaction. */
export async function setReviewStatus(
  id: string,
  status: ReviewStatus,
  actor: ReviewActor,
): Promise<ReviewActionResult> {
  const productId = await prisma.$transaction(async (tx) => {
    const review = await tx.productReview.findUnique({
      where: { id },
      select: { productId: true },
    });
    if (!review) return null;
    await tx.productReview.update({ where: { id }, data: { status } });
    await recomputeProductRating(tx, review.productId);
    return review.productId;
  });
  if (!productId) return NOT_FOUND;

  await logAdminAction({
    identityId: actor.identityId,
    action:
      status === "hidden" ? "product_review.hide" : "product_review.publish",
    entityType: "product_review",
    entityId: id,
    metadata: { productId, status },
  });
  revalidatePublic(CACHE_TAGS.product(productId), CACHE_TAGS.catalog);
  return {
    ok: true,
    message: status === "hidden" ? "Đã ẩn đánh giá" : "Đã hiện đánh giá",
  };
}

export async function deleteReview(
  id: string,
  actor: ReviewActor,
): Promise<ReviewActionResult> {
  const deleted = await prisma.$transaction(async (tx) => {
    const review = await tx.productReview.findUnique({
      where: { id },
      select: { productId: true, rating: true, status: true },
    });
    if (!review) return null;
    await tx.productReview.delete({ where: { id } });
    await recomputeProductRating(tx, review.productId);
    return review;
  });
  if (!deleted) return NOT_FOUND;

  await logAdminAction({
    identityId: actor.identityId,
    action: "product_review.delete",
    entityType: "product_review",
    entityId: id,
    metadata: {
      productId: deleted.productId,
      rating: deleted.rating,
      status: deleted.status,
    },
  });
  revalidatePublic(CACHE_TAGS.product(deleted.productId), CACHE_TAGS.catalog);
  return { ok: true, message: "Đã xoá đánh giá" };
}
