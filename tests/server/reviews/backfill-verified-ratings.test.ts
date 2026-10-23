import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import * as loggerModule from "@/lib/logger";
import { revalidatePublic } from "@/server/cache/public-cache";
import { prisma } from "@/server/db/prisma";
import {
  backfillVerifiedRatings,
  scheduleVerifiedRatingBackfill,
  stopVerifiedRatingBackfill,
  VERIFIED_RATING_BACKFILL_KEY,
} from "@/server/reviews/backfill-verified-ratings";

import {
  REVIEW_OTHER_PRODUCT_ID,
  REVIEW_PRODUCT_ID,
  resetReviewFixtures,
  seedOrder,
  seedReviewFixtures,
} from "./fixtures";

vi.mock("@/server/cache/public-cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/cache/public-cache")>()),
  revalidatePublic: vi.fn(),
}));

let accountId: string;
let otherAccountId: string;

async function reset() {
  await resetReviewFixtures();
  await prisma.setting.deleteMany({
    where: { key: VERIFIED_RATING_BACKFILL_KEY },
  });
}

async function productRating(productId = REVIEW_PRODUCT_ID) {
  return prisma.product.findUniqueOrThrow({
    where: { id: productId },
    select: { ratingAvg: true, ratingCount: true },
  });
}

beforeEach(async () => {
  vi.mocked(revalidatePublic).mockClear();
  await reset();
  ({ accountId, otherAccountId } = await seedReviewFixtures());
});

afterAll(reset);

describe("backfillVerifiedRatings", () => {
  it("tính lại điểm chỉ từ đánh giá đã mua một lần, lần sau không làm gì", async () => {
    await prisma.productReview.createMany({
      data: [
        {
          productId: REVIEW_PRODUCT_ID,
          authorName: "Đã mua",
          rating: 5,
          content: "Hàng chuẩn",
          isVerifiedPurchase: true,
        },
        {
          productId: REVIEW_PRODUCT_ID,
          authorName: "Chưa mua",
          rating: 1,
          content: "Chê bừa",
        },
        {
          productId: REVIEW_OTHER_PRODUCT_ID,
          authorName: "Chưa mua",
          rating: 1,
          content: "Chê bừa",
        },
      ],
    });
    // Điểm lưu sẵn theo công thức cũ (tính cả đánh giá chưa mua).
    await prisma.product.update({
      where: { id: REVIEW_PRODUCT_ID },
      data: { ratingAvg: 3, ratingCount: 2 },
    });
    await prisma.product.update({
      where: { id: REVIEW_OTHER_PRODUCT_ID },
      data: { ratingAvg: 1, ratingCount: 1 },
    });

    expect(await backfillVerifiedRatings()).toEqual({ ran: true, products: 2 });
    expect(await productRating()).toEqual({ ratingAvg: 5, ratingCount: 1 });
    expect(await productRating(REVIEW_OTHER_PRODUCT_ID)).toEqual({
      ratingAvg: 0,
      ratingCount: 0,
    });
    expect(
      await prisma.setting.findUnique({
        where: { key: VERIFIED_RATING_BACKFILL_KEY },
      }),
    ).toMatchObject({ value: "1" });
    expect(revalidatePublic).toHaveBeenCalledWith("catalog");

    vi.mocked(revalidatePublic).mockClear();
    await prisma.product.update({
      where: { id: REVIEW_PRODUCT_ID },
      data: { ratingAvg: 2, ratingCount: 7 },
    });
    expect(await backfillVerifiedRatings()).toEqual({
      ran: false,
      products: 0,
    });
    expect(await productRating()).toEqual({ ratingAvg: 2, ratingCount: 7 });
    expect(revalidatePublic).not.toHaveBeenCalled();
  });

  it("bỏ nhãn đã mua của đánh giá không còn đơn hợp lệ theo quy tắc mới", async () => {
    // Quy tắc cũ chấp nhận đơn online `paid` chưa giao và đơn đã hủy.
    await seedOrder({
      accountId,
      productId: REVIEW_PRODUCT_ID,
      status: "paid",
      fulfillmentStatus: "ready",
      key: "legacy-undelivered",
    });
    await seedOrder({
      accountId: otherAccountId,
      productId: REVIEW_PRODUCT_ID,
      channel: "pos",
      status: "paid",
      key: "legacy-pos",
    });
    await prisma.productReview.createMany({
      data: [
        {
          productId: REVIEW_PRODUCT_ID,
          accountId,
          authorName: "Minh Anh",
          rating: 1,
          content: "Đơn chưa giao",
          isVerifiedPurchase: true,
        },
        {
          productId: REVIEW_PRODUCT_ID,
          accountId: otherAccountId,
          authorName: "Thu Trang",
          rating: 4,
          content: "Mua tại quầy",
          isVerifiedPurchase: true,
        },
      ],
    });

    await backfillVerifiedRatings();

    const rows = await prisma.productReview.findMany({
      where: { productId: REVIEW_PRODUCT_ID },
      select: { accountId: true, isVerifiedPurchase: true },
    });
    expect(
      Object.fromEntries(rows.map((r) => [r.accountId, r.isVerifiedPurchase])),
    ).toEqual({ [accountId]: false, [otherAccountId]: true });
    expect(await productRating()).toEqual({ ratingAvg: 4, ratingCount: 1 });
  });
});

describe("scheduleVerifiedRatingBackfill", () => {
  afterEach(() => {
    stopVerifiedRatingBackfill();
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("chạy một lần sau khi khởi động, không giữ tiến trình sống, lỗi chỉ ghi log", async () => {
    vi.useFakeTimers();
    const error = vi.spyOn(loggerModule.logger, "error");
    const run = vi.fn().mockRejectedValue(new Error("db locked"));

    const timer = scheduleVerifiedRatingBackfill({ run, delayMs: 1_000 });
    expect(timer?.hasRef()).toBe(false);
    expect(run).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(run).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      "review_rating_backfill_failed",
      expect.anything(),
    );

    await vi.advanceTimersByTimeAsync(10_000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("gọi lần hai trả timer đã hẹn, backfill chỉ chạy một lần mỗi tiến trình", async () => {
    vi.useFakeTimers();
    const first = vi.fn().mockResolvedValue({ ran: true, products: 0 });
    const second = vi.fn().mockResolvedValue({ ran: true, products: 0 });

    const timer = scheduleVerifiedRatingBackfill({
      run: first,
      delayMs: 1_000,
    });
    expect(timer).not.toBeNull();
    expect(
      scheduleVerifiedRatingBackfill({ run: second, delayMs: 1_000 }),
    ).toBe(timer);
    await vi.advanceTimersByTimeAsync(1_000);
    // Đã chạy xong vẫn không hẹn lại.
    expect(
      scheduleVerifiedRatingBackfill({ run: second, delayMs: 1_000 }),
    ).toBe(timer);
    await vi.advanceTimersByTimeAsync(5_000);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it("DISABLE_BACKGROUND_JOBS=1 thì không hẹn giờ", async () => {
    vi.useFakeTimers();
    vi.stubEnv("DISABLE_BACKGROUND_JOBS", "1");
    const run = vi.fn().mockResolvedValue({ ran: true, products: 0 });

    expect(scheduleVerifiedRatingBackfill({ run, delayMs: 1_000 })).toBe(null);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(run).not.toHaveBeenCalled();
  });
});
