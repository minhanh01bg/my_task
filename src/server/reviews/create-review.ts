import { Prisma } from "@prisma/client";

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
  | {
      ok: true;
      review: PublicReview;
      summary: RatingSummary;
      /** true khi cập nhật đánh giá sẵn có của tài khoản thay vì tạo mới. */
      updated: boolean;
    }
  | { ok: false; reason: "invalid"; message: string }
  | { ok: false; reason: "not_found"; message: string };

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * "Da mua": co don cua tai khoan chua san pham, da hoan tat
 * (`fulfillmentStatus = completed`, xem `online-order-status.ts`) hoac da
 * thanh toan (`status = paid`).
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
      OR: [{ fulfillmentStatus: "completed" }, { status: "paid" }],
    },
    select: { id: true },
  });
  return order !== null;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/**
 * Tao danh gia cho khach da dang nhap. Moi tai khoan chi co mot danh gia cho
 * moi san pham (`@@unique([productId, accountId])`): neu da co thi CAP NHAT
 * (rating/noi dung/da mua, hien lai neu dang an) thay vi tao moi. Ten hien thi
 * lay tu tai khoan; ghi review + tinh lai aggregate trong cung transaction,
 * revalidate cache sau khi commit.
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

  const write = () =>
    prisma.$transaction(async (tx) => {
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
      const existing = await tx.productReview.findUnique({
        where: { productId_accountId: { productId, accountId } },
        select: { id: true },
      });
      const data = {
        authorName: account.displayName,
        rating: parsed.data.rating,
        content: parsed.data.content,
        isVerifiedPurchase,
      };
      const saved = existing
        ? await tx.productReview.update({
            where: { id: existing.id },
            data: { ...data, status: "published" },
            select: publicReviewSelect,
          })
        : await tx.productReview.create({
            data: { ...data, productId, accountId },
            select: publicReviewSelect,
          });
      const summary = await recomputeProductRating(tx, productId);
      return {
        review: toPublicReview(saved),
        summary,
        updated: existing !== null,
      };
    });

  let outcome: Awaited<ReturnType<typeof write>>;
  try {
    outcome = await write();
  } catch (error: unknown) {
    // Hai lan gui dong thoi cung tao moi: lan thua dung unique index, chay lai
    // mot lan de roi vao nhanh cap nhat.
    if (!isUniqueViolation(error)) throw error;
    outcome = await write();
  }

  if (!outcome) {
    return {
      ok: false,
      reason: "not_found",
      message: "Không tìm thấy sản phẩm",
    };
  }

  revalidatePublic(CACHE_TAGS.product(productId), CACHE_TAGS.catalog);
  logger.info(
    outcome.updated ? "product_review_updated" : "product_review_created",
    {
      productId,
      reviewId: outcome.review.id,
      rating: outcome.review.rating,
      verified: outcome.review.isVerifiedPurchase,
    },
  );
  return { ok: true, ...outcome };
}
