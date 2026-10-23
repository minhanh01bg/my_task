import type { Prisma } from "@prisma/client";

import { paginate } from "@/server/admin/pagination";
import { prisma } from "@/server/db/prisma";
import {
  REVIEW_PAGE_SIZE,
  type PublicReview,
  type PublicReviewPage,
} from "@/types/review";

import { countedReviewWhere } from "./product-rating";

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

/** Ten cong khai khi tu dau khong phai chu (so dien thoai, email...). */
const ANONYMOUS_REVIEWER = "Khách hàng";

/**
 * Che ho ten cho trang cong khai: giu tu dau, cac tu sau chi con chu cai dau
 * ("Nguyễn Văn An" → "Nguyễn V. A."). Tu dau co so/ky tu la thi an han. Trang
 * admin (`admin-reviews.ts`) van doc `authorName` day du.
 */
export function maskReviewerName(name: string): string {
  const [first, ...rest] = name.normalize("NFC").trim().split(/\s+/u);
  if (!first || !/^[\p{L}\p{M}]+$/u.test(first)) return ANONYMOUS_REVIEWER;
  const initials = rest.flatMap((word) => {
    const initial = word.match(/[\p{L}\p{N}]/u)?.[0];
    return initial ? [`${initial.toUpperCase()}.`] : [];
  });
  return [first, ...initials].join(" ");
}

export function toPublicReview(row: PublicReviewRow): PublicReview {
  return {
    ...row,
    authorName: maskReviewerName(row.authorName),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Mot trang (10) danh gia `published` da xac minh mua cua san pham, moi nhat
 * truoc — cung bo loc voi diem trung binh nen `total` khop `ratingCount`. Khop
 * index [productId, status, createdAt]. Khong kiem tra san pham ton tai — tra
 * rong.
 */
export async function listProductReviews(
  productId: string,
  page: number,
): Promise<PublicReviewPage> {
  const where = countedReviewWhere(productId);
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
