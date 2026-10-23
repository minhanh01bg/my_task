import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import {
  listProductReviews,
  maskReviewerName,
} from "@/server/reviews/list-reviews";

import {
  REVIEW_ACCOUNT_PHONE,
  REVIEW_OTHER_PRODUCT_ID,
  REVIEW_PRODUCT_ID,
  resetReviewFixtures,
  seedReviewFixtures,
} from "./fixtures";

let accountId: string;

beforeEach(async () => {
  await resetReviewFixtures();
  ({ accountId } = await seedReviewFixtures());
  await prisma.productReview.createMany({
    data: [
      ...Array.from({ length: 12 }, (_, index) => ({
        productId: REVIEW_PRODUCT_ID,
        // Mỗi tài khoản một đánh giá / sản phẩm: chỉ đánh giá đầu gắn tài khoản.
        accountId: index === 0 ? accountId : null,
        authorName: `Khách ${index + 1}`,
        rating: 4,
        content: `Đánh giá số ${index + 1}`,
        isVerifiedPurchase: true,
        createdAt: new Date(Date.UTC(2026, 8, 1, 0, index)),
      })),
      {
        productId: REVIEW_PRODUCT_ID,
        authorName: "Bị ẩn",
        rating: 1,
        content: "Nội dung vi phạm",
        isVerifiedPurchase: true,
        status: "hidden",
        createdAt: new Date(Date.UTC(2026, 8, 2)),
      },
      {
        productId: REVIEW_PRODUCT_ID,
        authorName: "Chưa mua",
        rating: 1,
        content: "Đánh giá chưa xác minh đã mua",
        createdAt: new Date(Date.UTC(2026, 8, 3)),
      },
      {
        productId: REVIEW_OTHER_PRODUCT_ID,
        authorName: "Khác",
        rating: 5,
        content: "Sản phẩm khác",
        isVerifiedPurchase: true,
      },
    ],
  });
});

afterAll(resetReviewFixtures);

describe("listProductReviews", () => {
  it("phân trang 10 đánh giá đã đăng, mới nhất trước, bỏ đánh giá bị ẩn hoặc chưa mua", async () => {
    const first = await listProductReviews(REVIEW_PRODUCT_ID, 1);
    expect(first.total).toBe(12);
    expect(first.pageSize).toBe(10);
    expect(first.page).toBe(1);
    expect(first.items).toHaveLength(10);
    expect(first.items[0]).toMatchObject({
      content: "Đánh giá số 12",
      rating: 4,
      isVerifiedPurchase: true,
    });
    expect(typeof first.items[0]?.createdAt).toBe("string");
    expect(
      first.items.some((r) =>
        ["Nội dung vi phạm", "Đánh giá chưa xác minh đã mua"].includes(
          r.content,
        ),
      ),
    ).toBe(false);

    const second = await listProductReviews(REVIEW_PRODUCT_ID, 2);
    expect(second.items.map((r) => r.content)).toEqual([
      "Đánh giá số 2",
      "Đánh giá số 1",
    ]);
  });

  it("trang vượt quá trả về trang cuối", async () => {
    const result = await listProductReviews(REVIEW_PRODUCT_ID, 9);
    expect(result.page).toBe(2);
    expect(result.items).toHaveLength(2);
  });

  it("che họ tên người đánh giá, không lộ tài khoản/số điện thoại", async () => {
    await prisma.productReview.deleteMany();
    await prisma.productReview.create({
      data: {
        productId: REVIEW_PRODUCT_ID,
        accountId,
        authorName: "Nguyễn Văn An",
        rating: 5,
        content: "Hàng chuẩn, giao nhanh",
        isVerifiedPurchase: true,
      },
    });

    const { items } = await listProductReviews(REVIEW_PRODUCT_ID, 1);
    expect(items).toHaveLength(1);
    expect(Object.keys(items[0]!).sort()).toEqual([
      "authorName",
      "content",
      "createdAt",
      "id",
      "isVerifiedPurchase",
      "rating",
    ]);
    expect(items[0]?.authorName).toBe("Nguyễn V. A.");
    const json = JSON.stringify(items);
    expect(json).not.toContain("Nguyễn Văn An");
    expect(json).not.toContain(accountId);
    expect(json).not.toContain(REVIEW_ACCOUNT_PHONE);
  });
});

describe("maskReviewerName", () => {
  it.each([
    ["Nguyễn Văn An", "Nguyễn V. A."],
    ["  Minh   Anh ", "Minh A."],
    ["trần thị bích ngọc", "trần T. B. N."],
    ["Nguyễn Văn An".normalize("NFD"), "Nguyễn V. A."],
    ["Lan", "Lan"],
    ["Minh (VIP)", "Minh V."],
    ["Khách 12", "Khách 1."],
  ])("%j → %j", (name, masked) => {
    expect(maskReviewerName(name)).toBe(masked);
  });

  it.each(["", "   ", "0901234567", "+84901234567", "minh.anh@gmail.com"])(
    "tên rỗng, số điện thoại hoặc email %j → Khách hàng",
    (name) => {
      expect(maskReviewerName(name)).toBe("Khách hàng");
    },
  );
});
