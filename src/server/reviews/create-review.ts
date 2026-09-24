import type { Prisma } from "@prisma/client";

import { logger } from "@/lib/logger";
import { revalidatePublic } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import { prisma } from "@/server/db/prisma";
import {
  createReviewInputSchema,
  type PublicReview,
  type RatingSummary,
} from "@/types/review";

import { publicReviewSelect, toPublicReview } from "./list-reviews";
import { recomputeProductRating } from "./product-rating";

export type CreateReviewResult =
  | { ok: true; review: PublicReview; summary: RatingSummary }
  | { ok: false; reason: "invalid"; message: string }
  | { ok: false; reason: "not_found"; message: string };

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * "Da mua": co don cua tai khoan chua san pham, da giao
 * (`fulfillmentStatus = delivered`) hoac da thanh toan (`status = paid`).
 */
export async function hasVerifiedPurchase(
  db: DbClient,
  accountId: string,
  productId: string,
): Promise<boolean> {
  const order = await db.order.findFirst({
    where: {
      customerAccountId: accountId,
      items: { some: { productId } },
      OR: [{ fulfillmentStatus: "delivered" }, { status: "paid" }],
    },
    select: { id: true },
  });
  return order !== null;
}

/**
 * Tao danh gia cho khach da dang nhap. Ten hien thi lay tu tai khoan; tao
 * review + tinh lai aggregate san pham trong cung transaction, revalidate
 * cache sau khi commit.
 */
export async function createReview(params: {
  productId: string;
  accountId: string;
  input: unknown;
}): Promise<CreateReviewResult> {
  const parsed = createReviewInputSchema.safeParse(params.input);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "invalid",
      message: parsed.error.issues[0]?.message ?? "Đánh giá không hợp lệ",
    };
  }
  const { productId, accountId } = params;

  const outcome = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: {
        id: productId,
        isActive: true,
        isService: false,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!product) return null;
    const account = await tx.customerAccount.findFirst({
      where: { id: accountId, disabledAt: null },
      select: { displayName: true },
    });
    if (!account) return null;

    const isVerifiedPurchase = await hasVerifiedPurchase(
      tx,
      accountId,
      productId,
    );
    const created = await tx.productReview.create({
      data: {
        productId,
        accountId,
        authorName: account.displayName,
        rating: parsed.data.rating,
        content: parsed.data.content,
        isVerifiedPurchase,
      },
      select: publicReviewSelect,
    });
    const summary = await recomputeProductRating(tx, productId);
    return { review: toPublicReview(created), summary };
  });

  if (!outcome) {
    return {
      ok: false,
      reason: "not_found",
      message: "Không tìm thấy sản phẩm",
    };
  }

  revalidatePublic(CACHE_TAGS.product(productId), CACHE_TAGS.catalog);
  logger.info("product_review_created", {
    productId,
    reviewId: outcome.review.id,
    rating: outcome.review.rating,
    verified: outcome.review.isVerifiedPurchase,
  });
  return { ok: true, ...outcome };
}
