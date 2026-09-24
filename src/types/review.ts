import { z } from "zod";

export const REVIEW_PAGE_SIZE = 10;
export const REVIEW_CONTENT_MIN = 10;
export const REVIEW_CONTENT_MAX = 1000;

export const REVIEW_STATUSES = ["published", "hidden"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Payload POST /api/online/products/[id]/reviews. Tên hiển thị lấy từ tài khoản. */
export const createReviewInputSchema = z.object({
  rating: z.coerce
    .number({ message: "Số sao không hợp lệ" })
    .int("Số sao không hợp lệ")
    .min(1, "Vui lòng chọn từ 1 đến 5 sao")
    .max(5, "Vui lòng chọn từ 1 đến 5 sao"),
  content: z
    .string({ message: "Vui lòng nhập nội dung đánh giá" })
    .trim()
    .min(
      REVIEW_CONTENT_MIN,
      `Nội dung đánh giá cần ít nhất ${REVIEW_CONTENT_MIN} ký tự`,
    )
    .max(
      REVIEW_CONTENT_MAX,
      `Nội dung đánh giá tối đa ${REVIEW_CONTENT_MAX} ký tự`,
    ),
});

export type CreateReviewInput = z.infer<typeof createReviewInputSchema>;

export const reviewPageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

/** Đánh giá công khai — JSON-serializable (createdAt dạng ISO). */
export interface PublicReview {
  id: string;
  authorName: string;
  rating: number;
  content: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
}

export interface PublicReviewPage {
  items: PublicReview[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RatingSummary {
  avg: number;
  count: number;
}
