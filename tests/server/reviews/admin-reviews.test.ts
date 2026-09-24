import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteReviewAction,
  setReviewStatusAction,
} from "@/app/admin/reviews/actions";
import * as requireAdminModule from "@/server/auth/require-admin-session";
import { prisma } from "@/server/db/prisma";
import {
  deleteReview,
  listAdminReviews,
  setReviewStatus,
} from "@/server/reviews/admin-reviews";
import { createReview } from "@/server/reviews/create-review";

import {
  REVIEW_PRODUCT_ID,
  resetReviewFixtures,
  seedReviewFixtures,
} from "./fixtures";

let reviewIds: string[] = [];

async function productRating() {
  return prisma.product.findUniqueOrThrow({
    where: { id: REVIEW_PRODUCT_ID },
    select: { ratingAvg: true, ratingCount: true },
  });
}

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetReviewFixtures();
  const { accountId, otherAccountId } = await seedReviewFixtures();
  reviewIds = [];
  for (const [id, rating] of [
    [accountId, 5],
    [otherAccountId, 3],
  ] as const) {
    const result = await createReview({
      productId: REVIEW_PRODUCT_ID,
      accountId: id,
      input: { rating, content: "Nội dung đánh giá hợp lệ" },
    });
    if (result.ok) reviewIds.push(result.review.id);
  }
});

afterAll(resetReviewFixtures);

describe("admin reviews", () => {
  it("liệt kê mọi trạng thái kèm tên sản phẩm, có phân trang", async () => {
    await setReviewStatus(reviewIds[0]!, "hidden", {});
    const page = await listAdminReviews({ page: 1, pageSize: 1 });
    expect(page.total).toBe(2);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.product.name).toBe("Cà phê Robusta");

    const hidden = await listAdminReviews({ page: 1, status: "hidden" });
    expect(hidden.items.map((r) => r.id)).toEqual([reviewIds[0]]);
  });

  it("ẩn/hiện đánh giá cập nhật lại điểm trung bình và ghi audit", async () => {
    expect(await productRating()).toEqual({ ratingAvg: 4, ratingCount: 2 });

    const hidden = await setReviewStatus(reviewIds[0]!, "hidden", {
      identityId: undefined,
    });
    expect(hidden.ok).toBe(true);
    expect(await productRating()).toEqual({ ratingAvg: 3, ratingCount: 1 });

    await setReviewStatus(reviewIds[0]!, "published", {});
    expect(await productRating()).toEqual({ ratingAvg: 4, ratingCount: 2 });

    const audit = await prisma.adminAuditEvent.findMany({
      where: { entityType: "product_review", entityId: reviewIds[0] },
      orderBy: { createdAt: "asc" },
    });
    expect(audit.map((e) => e.action)).toEqual([
      "product_review.hide",
      "product_review.publish",
    ]);
  });

  it("xoá đánh giá cập nhật điểm và trả lỗi khi không tìm thấy", async () => {
    await deleteReview(reviewIds[0]!, {});
    await deleteReview(reviewIds[1]!, {});
    expect(await productRating()).toEqual({ ratingAvg: 0, ratingCount: 0 });
    expect(await prisma.productReview.count()).toBe(0);

    expect(await deleteReview("khong-co", {})).toMatchObject({ ok: false });
    expect(await setReviewStatus("khong-co", "hidden", {})).toMatchObject({
      ok: false,
    });
  });

  it("server action yêu cầu phiên admin và kiểm tra trạng thái hợp lệ", async () => {
    const spy = vi
      .spyOn(requireAdminModule, "requireAdminSession")
      .mockResolvedValue({ authorized: true });

    expect(await setReviewStatusAction(reviewIds[0]!, "bogus")).toMatchObject({
      ok: false,
    });
    expect(await setReviewStatusAction(reviewIds[0]!, "hidden")).toMatchObject({
      ok: true,
    });
    expect(await deleteReviewAction(reviewIds[1]!)).toMatchObject({ ok: true });
    expect(spy).toHaveBeenCalledTimes(3);
    expect(await productRating()).toEqual({ ratingAvg: 0, ratingCount: 0 });
  });

  it("server action từ chối khi không có phiên admin", async () => {
    vi.spyOn(requireAdminModule, "requireAdminSession").mockRejectedValue(
      new requireAdminModule.AdminUnauthorizedError(),
    );
    await expect(deleteReviewAction(reviewIds[0]!)).rejects.toThrow();
    expect(await prisma.productReview.count()).toBe(2);
  });
});
