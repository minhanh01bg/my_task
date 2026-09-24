import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { listProductReviews } from "@/server/reviews/list-reviews";

import {
  REVIEW_OTHER_PRODUCT_ID,
  REVIEW_PRODUCT_ID,
  resetReviewFixtures,
  seedReviewFixtures,
} from "./fixtures";

beforeEach(async () => {
  await resetReviewFixtures();
  const { accountId } = await seedReviewFixtures();
  await prisma.productReview.createMany({
    data: [
      ...Array.from({ length: 12 }, (_, index) => ({
        productId: REVIEW_PRODUCT_ID,
        // Mỗi tài khoản một đánh giá / sản phẩm: chỉ đánh giá đầu gắn tài khoản.
        accountId: index === 0 ? accountId : null,
        authorName: `Khách ${index + 1}`,
        rating: 4,
        content: `Đánh giá số ${index + 1}`,
        createdAt: new Date(Date.UTC(2026, 8, 1, 0, index)),
      })),
      {
        productId: REVIEW_PRODUCT_ID,
        authorName: "Bị ẩn",
        rating: 1,
        content: "Nội dung vi phạm",
        status: "hidden",
        createdAt: new Date(Date.UTC(2026, 8, 2)),
      },
      {
        productId: REVIEW_OTHER_PRODUCT_ID,
        authorName: "Khác",
        rating: 5,
        content: "Sản phẩm khác",
      },
    ],
  });
});

afterAll(resetReviewFixtures);

describe("listProductReviews", () => {
  it("phân trang 10 đánh giá đã đăng, mới nhất trước, bỏ đánh giá bị ẩn", async () => {
    const first = await listProductReviews(REVIEW_PRODUCT_ID, 1);
    expect(first.total).toBe(12);
    expect(first.pageSize).toBe(10);
    expect(first.page).toBe(1);
    expect(first.items).toHaveLength(10);
    expect(first.items[0]).toMatchObject({
      authorName: "Khách 12",
      rating: 4,
      isVerifiedPurchase: false,
    });
    expect(typeof first.items[0]?.createdAt).toBe("string");
    expect(first.items.some((r) => r.authorName === "Bị ẩn")).toBe(false);

    const second = await listProductReviews(REVIEW_PRODUCT_ID, 2);
    expect(second.items.map((r) => r.authorName)).toEqual([
      "Khách 2",
      "Khách 1",
    ]);
  });

  it("trang vượt quá trả về trang cuối", async () => {
    const result = await listProductReviews(REVIEW_PRODUCT_ID, 9);
    expect(result.page).toBe(2);
    expect(result.items).toHaveLength(2);
  });
});
