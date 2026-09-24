import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { GET, POST } from "@/app/api/online/products/[id]/reviews/route";
import { createCustomerSession } from "@/server/customer-auth/session";
import { prisma } from "@/server/db/prisma";
import { setReviewRateLimiter } from "@/server/reviews/review-rate-limit";
import {
  createRateLimiter,
  type RateLimiter,
} from "@/server/security/rate-limit";

import {
  REVIEW_PRODUCT_ID,
  resetReviewFixtures,
  seedReviewFixtures,
} from "../server/reviews/fixtures";

const allow: RateLimiter = {
  async check() {
    return { allowed: true, remaining: 5, limit: 5, resetInSeconds: 60 };
  },
};

const deny: RateLimiter = {
  async check() {
    return {
      allowed: false,
      reason: "rate_limited",
      retryAfterSeconds: 3600,
      limit: 5,
      remaining: 0,
    };
  },
};

const URL_BASE = `https://example.com/api/online/products/${REVIEW_PRODUCT_ID}/reviews`;
const context = (id = REVIEW_PRODUCT_ID) => ({
  params: Promise.resolve({ id }),
});

let token: string;

function postRequest(body: unknown, cookie?: string) {
  return new Request(URL_BASE, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

const validBody = { rating: 5, content: "Sản phẩm rất tốt, sẽ mua lại" };

beforeEach(async () => {
  setReviewRateLimiter(allow);
  await prisma.customerSession.deleteMany();
  await resetReviewFixtures();
  const { accountId } = await seedReviewFixtures();
  ({ token } = await createCustomerSession(accountId));
});

afterEach(() => setReviewRateLimiter(null));
afterAll(resetReviewFixtures);

describe("POST /api/online/products/[id]/reviews", () => {
  it("401 khi chưa đăng nhập", async () => {
    const response = await POST(postRequest(validBody), context());
    expect(response.status).toBe(401);
    expect(await prisma.productReview.count()).toBe(0);
  });

  it("tạo đánh giá cho khách đã đăng nhập và trả điểm tổng hợp mới", async () => {
    const response = await POST(
      postRequest(validBody, `customer_session=${token}`),
      context(),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = await response.json();
    expect(body.review).toMatchObject({ authorName: "Minh Anh", rating: 5 });
    expect(body.summary).toEqual({ avg: 5, count: 1 });
  });

  it("400 khi dữ liệu không hợp lệ", async () => {
    const response = await POST(
      postRequest({ rating: 9, content: "x" }, `customer_session=${token}`),
      context(),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).message).toBeTruthy();
  });

  it("404 khi sản phẩm không tồn tại", async () => {
    const response = await POST(
      postRequest(validBody, `customer_session=${token}`),
      context("khong-ton-tai"),
    );
    expect(response.status).toBe(404);
  });

  it("429 kèm Retry-After khi vượt giới hạn", async () => {
    setReviewRateLimiter(deny);
    const response = await POST(
      postRequest(validBody, `customer_session=${token}`),
      context(),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("3600");
    expect(await prisma.productReview.count()).toBe(0);
  });

  it("policy thật: tối đa 5 đánh giá mỗi tài khoản trong 24h", async () => {
    setReviewRateLimiter(createRateLimiter());
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const response = await POST(
        postRequest(validBody, `customer_session=${token}`),
        context(),
      );
      statuses.push(response.status);
    }
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
  });
});

describe("GET /api/online/products/[id]/reviews", () => {
  it("trả trang đánh giá đã đăng, 10 mỗi trang", async () => {
    await prisma.productReview.createMany({
      data: Array.from({ length: 11 }, (_, index) => ({
        productId: REVIEW_PRODUCT_ID,
        authorName: `Khách ${index}`,
        rating: 4,
        content: "Nội dung đánh giá",
      })),
    });
    const first = await GET(new Request(`${URL_BASE}?page=1`), context());
    expect(first.status).toBe(200);
    const body = await first.json();
    expect(body).toMatchObject({ total: 11, page: 1, pageSize: 10 });
    expect(body.items).toHaveLength(10);

    const second = await GET(new Request(`${URL_BASE}?page=2`), context());
    expect((await second.json()).items).toHaveLength(1);

    const bogus = await GET(new Request(`${URL_BASE}?page=abc`), context());
    expect((await bogus.json()).page).toBe(1);
  });
});
