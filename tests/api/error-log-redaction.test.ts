import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as login } from "@/app/api/auth/login/route";
import { POST as createReviewRoute } from "@/app/api/online/products/[id]/reviews/route";
import { POST as validateVoucher } from "@/app/api/online/vouchers/validate/route";
import { GET as getWishlist } from "@/app/api/online/wishlist/route";
import { GET as getStorefrontSession } from "@/app/api/storefront/session/route";
import { logger } from "@/lib/logger";
import * as adminRateLimitModule from "@/server/auth/rate-limit";
import * as requireAdminModule from "@/server/auth/require-admin-session";
import * as customerSessionModule from "@/server/customer-auth/session";
import * as originModule from "@/server/http/origin";
import * as createReviewModule from "@/server/reviews/create-review";
import * as reviewRateLimitModule from "@/server/reviews/review-rate-limit";
import * as wishlistModule from "@/server/storefront/wishlist-products";
import * as checkVoucherModule from "@/server/vouchers/check-voucher-code";
import * as voucherRateLimitModule from "@/server/vouchers/voucher-rate-limit";

const PHONE = "0901234567";

/** Lỗi kiểu Prisma có message lặp lại dữ liệu khách. */
function piiError() {
  return Object.assign(
    new Error(`Unique constraint failed on phone ${PHONE} (Nguyễn Văn A)`),
    { code: "P2002" },
  );
}

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

let errorSpy: ReturnType<typeof vi.spyOn>;

function loggedMeta(event: string): Record<string, unknown> {
  const call = errorSpy.mock.calls.find(
    ([message]: unknown[]) => message === event,
  );
  expect(call, `logger.error("${event}")`).toBeDefined();
  return call![1] as Record<string, unknown>;
}

beforeEach(() => {
  errorSpy = vi.spyOn(logger, "error").mockImplementation(() => {});
});

afterEach(() => {
  expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(PHONE);
  vi.restoreAllMocks();
});

describe("log lỗi route không chứa message thô (WEB-6)", () => {
  it("POST /api/auth/login giữ correlationId, chỉ log lớp và mã lỗi", async () => {
    vi.spyOn(originModule, "hasSafeMutationOrigin").mockReturnValue(true);
    vi.spyOn(
      adminRateLimitModule,
      "checkAdminLoginRateLimit",
    ).mockRejectedValue(piiError());

    const response = await login(
      jsonRequest("https://example.com/api/auth/login", { password: "x" }),
    );
    const body = (await response.json()) as { correlationId: string };

    expect(response.status).toBe(500);
    const meta = loggedMeta("admin_login_error");
    expect(Object.keys(meta).sort()).toEqual([
      "correlationId",
      "errorClass",
      "errorCode",
    ]);
    expect(meta).toMatchObject({ errorClass: "Error", errorCode: "P2002" });
    expect(body.correlationId).toBe(meta.correlationId);
  });

  it("POST /api/online/vouchers/validate", async () => {
    vi.spyOn(voucherRateLimitModule, "checkVoucherRateLimit").mockResolvedValue(
      null,
    );
    vi.spyOn(checkVoucherModule, "checkVoucherCode").mockRejectedValue(
      piiError(),
    );

    const response = await validateVoucher(
      jsonRequest("https://example.com/api/online/vouchers/validate", {
        code: "GIAM10",
        subtotal: 100_000,
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      message: "Không kiểm tra được mã lúc này. Vui lòng thử lại.",
    });
    expect(loggedMeta("voucher_validate_failed")).toEqual({
      errorClass: "Error",
      errorCode: "P2002",
    });
  });

  it("GET /api/online/wishlist", async () => {
    vi.spyOn(wishlistModule, "getWishlistProducts").mockRejectedValue(
      piiError(),
    );

    const response = await getWishlist(
      new Request("https://example.com/api/online/wishlist?ids=a"),
    );

    expect(response.status).toBe(500);
    expect(loggedMeta("wishlist_products_failed")).toEqual({
      errorClass: "Error",
      errorCode: "P2002",
    });
  });

  it("GET /api/storefront/session", async () => {
    vi.spyOn(requireAdminModule, "hasAdminSession").mockRejectedValue(
      piiError(),
    );

    const response = await getStorefrontSession();

    expect(await response.json()).toEqual({
      isAdmin: false,
      isCustomer: false,
    });
    expect(loggedMeta("storefront_session_resolve_failed")).toEqual({
      errorClass: "Error",
      errorCode: "P2002",
    });
  });

  it("POST /api/online/products/[id]/reviews", async () => {
    vi.spyOn(originModule, "hasSafeMutationOrigin").mockReturnValue(true);
    vi.spyOn(
      customerSessionModule,
      "resolveCustomerSessionToken",
    ).mockResolvedValue({ accountId: "acc-1" } as Awaited<
      ReturnType<typeof customerSessionModule.resolveCustomerSessionToken>
    >);
    vi.spyOn(reviewRateLimitModule, "checkReviewRateLimit").mockResolvedValue(
      null,
    );
    vi.spyOn(createReviewModule, "createReview").mockRejectedValue(piiError());

    const response = await createReviewRoute(
      jsonRequest("https://example.com/api/online/products/p1/reviews", {
        rating: 5,
        content: "Sản phẩm dùng rất tốt, giao nhanh.",
      }),
      { params: Promise.resolve({ id: "p1" }) },
    );

    expect(response.status).toBe(500);
    expect(loggedMeta("product_review_create_failed")).toEqual({
      productId: "p1",
      errorClass: "Error",
      errorCode: "P2002",
    });
  });
});
