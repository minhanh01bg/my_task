import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import {
  createReview,
  hasVerifiedPurchase,
} from "@/server/reviews/create-review";

import {
  REVIEW_OTHER_PRODUCT_ID,
  REVIEW_PRODUCT_ID,
  resetReviewFixtures,
  seedOrder,
  seedReviewFixtures,
} from "./fixtures";

let accountId: string;
let otherAccountId: string;

beforeEach(async () => {
  await resetReviewFixtures();
  ({ accountId, otherAccountId } = await seedReviewFixtures());
});

afterAll(resetReviewFixtures);

describe("createReview", () => {
  it("tạo đánh giá với tên hiển thị của tài khoản và cập nhật điểm trung bình", async () => {
    const first = await createReview({
      productId: REVIEW_PRODUCT_ID,
      accountId,
      input: { rating: 5, content: "  Cà phê thơm, đóng gói kỹ  " },
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.review).toMatchObject({
      authorName: "Minh Anh",
      rating: 5,
      content: "Cà phê thơm, đóng gói kỹ",
      isVerifiedPurchase: false,
    });
    expect(typeof first.review.createdAt).toBe("string");
    expect(first.summary).toEqual({ avg: 5, count: 1 });

    const second = await createReview({
      productId: REVIEW_PRODUCT_ID,
      accountId: otherAccountId,
      input: { rating: 2, content: "Giao hơi chậm nhưng hàng ổn" },
    });
    expect(second.ok && second.summary).toEqual({ avg: 3.5, count: 2 });

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: REVIEW_PRODUCT_ID },
      select: { ratingAvg: true, ratingCount: true },
    });
    expect(product).toEqual({ ratingAvg: 3.5, ratingCount: 2 });
  });

  it.each([
    [{ rating: 0, content: "Nội dung hợp lệ đủ dài" }],
    [{ rating: 6, content: "Nội dung hợp lệ đủ dài" }],
    [{ rating: 4.5, content: "Nội dung hợp lệ đủ dài" }],
    [{ rating: 4, content: "ngắn" }],
    [{ rating: 4, content: "a".repeat(1001) }],
    [{ rating: "5", content: "Nội dung hợp lệ đủ dài" }],
    [{ rating: 5, content: "Nội dung hợp lệ đủ dài", authorName: "Giả mạo" }],
  ])("từ chối dữ liệu không hợp lệ %j", async (input) => {
    const result = await createReview({
      productId: REVIEW_PRODUCT_ID,
      accountId,
      input,
    });
    expect(result).toMatchObject({ ok: false, reason: "invalid" });
    expect(await prisma.productReview.count()).toBe(0);
  });

  it("trả not_found với sản phẩm không tồn tại hoặc ngừng bán", async () => {
    await prisma.product.update({
      where: { id: REVIEW_OTHER_PRODUCT_ID },
      data: { isActive: false },
    });
    for (const productId of ["khong-ton-tai", REVIEW_OTHER_PRODUCT_ID]) {
      const result = await createReview({
        productId,
        accountId,
        input: { rating: 4, content: "Nội dung hợp lệ đủ dài" },
      });
      expect(result).toMatchObject({ ok: false, reason: "not_found" });
    }
  });

  it("đánh dấu đã mua khi có đơn đã giao hoặc đã thanh toán chứa sản phẩm", async () => {
    await seedOrder({
      accountId,
      productId: REVIEW_PRODUCT_ID,
      status: "pending",
      fulfillmentStatus: "completed",
      key: "completed",
    });
    const verified = await createReview({
      productId: REVIEW_PRODUCT_ID,
      accountId,
      input: { rating: 4, content: "Đã mua và dùng thử rồi" },
    });
    expect(verified.ok && verified.review.isVerifiedPurchase).toBe(true);
  });
});

describe("createReview — mỗi tài khoản một đánh giá / sản phẩm", () => {
  it("gửi lần hai cập nhật đánh giá cũ thay vì tạo mới, ratingCount vẫn là 1", async () => {
    const first = await createReview({
      productId: REVIEW_PRODUCT_ID,
      accountId,
      input: { rating: 2, content: "Lần đầu dùng thấy chưa hợp" },
    });
    expect(first.ok && first.updated).toBe(false);
    if (!first.ok) return;

    await seedOrder({
      accountId,
      productId: REVIEW_PRODUCT_ID,
      status: "paid",
      key: "paid-later",
    });
    const second = await createReview({
      productId: REVIEW_PRODUCT_ID,
      accountId,
      input: { rating: 5, content: "Dùng lâu rồi thấy rất ổn" },
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.updated).toBe(true);
    expect(second.review).toMatchObject({
      id: first.review.id,
      rating: 5,
      content: "Dùng lâu rồi thấy rất ổn",
      isVerifiedPurchase: true,
    });
    expect(second.summary).toEqual({ avg: 5, count: 1 });
    expect(await prisma.productReview.count()).toBe(1);
    const product = await prisma.product.findUniqueOrThrow({
      where: { id: REVIEW_PRODUCT_ID },
      select: { ratingAvg: true, ratingCount: true },
    });
    expect(product).toEqual({ ratingAvg: 5, ratingCount: 1 });
  });

  it("đánh giá bị ẩn được hiển thị lại khi khách gửi lại", async () => {
    const first = await createReview({
      productId: REVIEW_PRODUCT_ID,
      accountId,
      input: { rating: 1, content: "Nội dung ban đầu bị ẩn" },
    });
    if (!first.ok) throw new Error("seed review failed");
    await prisma.productReview.update({
      where: { id: first.review.id },
      data: { status: "hidden" },
    });

    const second = await createReview({
      productId: REVIEW_PRODUCT_ID,
      accountId,
      input: { rating: 4, content: "Nội dung đã chỉnh sửa lại" },
    });
    expect(second.ok && second.summary).toEqual({ avg: 4, count: 1 });
    const row = await prisma.productReview.findUniqueOrThrow({
      where: { id: first.review.id },
      select: { status: true },
    });
    expect(row.status).toBe("published");
  });

  it("DB chặn hai đánh giá cùng tài khoản cho cùng sản phẩm", async () => {
    const data = {
      productId: REVIEW_PRODUCT_ID,
      accountId,
      authorName: "Minh Anh",
      rating: 4,
      content: "Nội dung đánh giá",
    };
    await prisma.productReview.create({ data });
    await expect(prisma.productReview.create({ data })).rejects.toThrow();
  });
});

describe("hasVerifiedPurchase", () => {
  it("chỉ tính đơn của đúng tài khoản, đúng sản phẩm, đã giao hoặc đã thanh toán", async () => {
    await seedOrder({
      accountId,
      productId: REVIEW_PRODUCT_ID,
      status: "pending",
      fulfillmentStatus: "ready",
      key: "pending",
    });
    await seedOrder({
      accountId: otherAccountId,
      productId: REVIEW_PRODUCT_ID,
      status: "paid",
      key: "other-account",
    });
    await seedOrder({
      accountId,
      productId: REVIEW_OTHER_PRODUCT_ID,
      status: "paid",
      key: "other-product",
    });
    expect(
      await hasVerifiedPurchase(prisma, accountId, REVIEW_PRODUCT_ID),
    ).toBe(false);
    expect(
      await hasVerifiedPurchase(prisma, otherAccountId, REVIEW_PRODUCT_ID),
    ).toBe(true);
    expect(
      await hasVerifiedPurchase(prisma, accountId, REVIEW_OTHER_PRODUCT_ID),
    ).toBe(true);
  });
});
