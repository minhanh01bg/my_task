import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
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
