import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { cancelOrder } from "@/server/orders/cancel-order";
import { createReview } from "@/server/reviews/create-review";
import { hasVerifiedPurchase } from "@/server/reviews/verified-purchase";

import {
  REVIEW_OTHER_PRODUCT_ID,
  REVIEW_PRODUCT_ID,
  resetReviewFixtures,
  seedOrder,
  seedPurchase,
  seedReviewFixtures,
} from "./fixtures";

let accountId: string;
let otherAccountId: string;

beforeEach(async () => {
  await resetReviewFixtures();
  ({ accountId, otherAccountId } = await seedReviewFixtures());
});

afterAll(resetReviewFixtures);

async function productRating(productId = REVIEW_PRODUCT_ID) {
  return prisma.product.findUniqueOrThrow({
    where: { id: productId },
    select: { ratingAvg: true, ratingCount: true },
  });
}

async function reviewAs(id: string, rating: number) {
  const result = await createReview({
    productId: REVIEW_PRODUCT_ID,
    accountId: id,
    input: { rating, content: "Nội dung đánh giá hợp lệ" },
  });
  if (!result.ok) throw new Error(`seed review failed: ${result.reason}`);
  return result.review;
}

describe("hasVerifiedPurchase", () => {
  it("chỉ tính đơn của đúng tài khoản và đúng sản phẩm", async () => {
    await seedPurchase(otherAccountId, REVIEW_PRODUCT_ID, "other-account");
    await seedPurchase(accountId, REVIEW_OTHER_PRODUCT_ID, "other-product");
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

  it.each([
    ["online", "paid", "completed", true],
    ["online", "pending", "completed", true],
    ["online", "paid", "new", false],
    ["online", "paid", "ready", false],
    ["online", "cancelled", "cancelled", false],
    ["pos", "paid", null, true],
    ["pos", "pending", null, false],
    ["pos", "debt", null, false],
    ["pos", "cancelled", null, false],
  ] as const)(
    "kênh %s, status %s, giao hàng %s → %s",
    async (channel, status, fulfillmentStatus, expected) => {
      await seedOrder({
        accountId,
        productId: REVIEW_PRODUCT_ID,
        channel,
        status,
        fulfillmentStatus,
        key: "matrix",
      });
      expect(
        await hasVerifiedPurchase(prisma, accountId, REVIEW_PRODUCT_ID),
      ).toBe(expected);
    },
  );
});

describe("hủy đơn thu hồi nhãn đã mua", () => {
  it("hủy đơn duy nhất đủ điều kiện: bỏ nhãn đã mua và tính lại điểm", async () => {
    const order = await seedOrder({
      accountId,
      productId: REVIEW_PRODUCT_ID,
      channel: "pos",
      status: "paid",
      key: "pos-only",
    });
    await seedPurchase(otherAccountId, REVIEW_PRODUCT_ID, "other-buyer");
    const review = await reviewAs(accountId, 1);
    await reviewAs(otherAccountId, 5);
    expect(await productRating()).toEqual({ ratingAvg: 3, ratingCount: 2 });

    const result = await cancelOrder(order.id);
    expect(result.cancelled).toBe(true);

    const stored = await prisma.productReview.findUniqueOrThrow({
      where: { id: review.id },
      select: { isVerifiedPurchase: true, status: true },
    });
    expect(stored).toEqual({ isVerifiedPurchase: false, status: "published" });
    expect(await productRating()).toEqual({ ratingAvg: 5, ratingCount: 1 });
  });

  it("còn đơn khác đủ điều kiện thì giữ nguyên nhãn và điểm", async () => {
    const pos = await seedOrder({
      accountId,
      productId: REVIEW_PRODUCT_ID,
      channel: "pos",
      status: "paid",
      key: "pos-first",
    });
    await seedPurchase(accountId, REVIEW_PRODUCT_ID, "online-second");
    const review = await reviewAs(accountId, 4);

    await cancelOrder(pos.id);

    const stored = await prisma.productReview.findUniqueOrThrow({
      where: { id: review.id },
      select: { isVerifiedPurchase: true },
    });
    expect(stored.isVerifiedPurchase).toBe(true);
    expect(await productRating()).toEqual({ ratingAvg: 4, ratingCount: 1 });
  });

  it("thu hồi cả khi hủy trong transaction của người gọi", async () => {
    const order = await seedOrder({
      accountId,
      productId: REVIEW_PRODUCT_ID,
      channel: "pos",
      status: "paid",
      key: "pos-tx",
    });
    const review = await reviewAs(accountId, 2);

    await prisma.$transaction((tx) => cancelOrder(order.id, tx));

    const stored = await prisma.productReview.findUniqueOrThrow({
      where: { id: review.id },
      select: { isVerifiedPurchase: true },
    });
    expect(stored.isVerifiedPurchase).toBe(false);
    expect(await productRating()).toEqual({ ratingAvg: 0, ratingCount: 0 });
  });

  it("không đụng đánh giá của tài khoản khác hoặc sản phẩm không có trong đơn", async () => {
    const order = await seedOrder({
      accountId,
      productId: REVIEW_OTHER_PRODUCT_ID,
      channel: "pos",
      status: "paid",
      key: "pos-other-product",
    });
    await seedPurchase(accountId, REVIEW_PRODUCT_ID, "kept");
    await seedPurchase(otherAccountId, REVIEW_PRODUCT_ID, "kept-other");
    const own = await reviewAs(accountId, 5);
    const other = await reviewAs(otherAccountId, 3);

    await cancelOrder(order.id);

    const rows = await prisma.productReview.findMany({
      where: { id: { in: [own.id, other.id] } },
      select: { isVerifiedPurchase: true },
    });
    expect(rows.every((row) => row.isVerifiedPurchase)).toBe(true);
    expect(await productRating()).toEqual({ ratingAvg: 4, ratingCount: 2 });
  });
});
