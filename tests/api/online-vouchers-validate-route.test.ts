import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/online/vouchers/validate/route";
import { prisma } from "@/server/db/prisma";
import type { RateLimiter } from "@/server/security/rate-limit";
import { setVoucherRateLimiter } from "@/server/vouchers/voucher-rate-limit";

const allow: RateLimiter = {
  async check() {
    return { allowed: true, remaining: 10, limit: 10, resetInSeconds: 60 };
  },
};

const deny: RateLimiter = {
  async check() {
    return {
      allowed: false,
      reason: "rate_limited",
      retryAfterSeconds: 42,
      limit: 30,
      remaining: 0,
    };
  },
};

function request(body: unknown) {
  return new Request("https://example.com/api/online/vouchers/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  setVoucherRateLimiter(allow);
  await prisma.voucher.deleteMany();
  await prisma.voucher.create({
    data: { code: "GIAM10", type: "percent", value: 10, maxDiscount: 30_000 },
  });
});

afterEach(async () => {
  setVoucherRateLimiter(null);
  await prisma.voucher.deleteMany();
});

describe("POST /api/online/vouchers/validate", () => {
  it("trả phần giảm cho mã hợp lệ (không phân biệt hoa thường)", async () => {
    const response = await POST(
      request({ code: " giam10 ", subtotal: 500_000 }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = await response.json();
    expect(body.data).toMatchObject({
      ok: true,
      code: "GIAM10",
      type: "percent",
      discount: 30_000,
      shippingDiscount: 0,
    });
  });

  it("mã không tồn tại trả ok=false kèm thông báo tiếng Việt", async () => {
    const response = await POST(
      request({ code: "KHONGCO", subtotal: 100_000 }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.ok).toBe(false);
    expect(body.data.message).toMatch(/không tồn tại/);
  });

  it("400 khi payload sai", async () => {
    const response = await POST(request({ code: "", subtotal: -1 }));
    expect(response.status).toBe(400);
  });

  it("429 khi vượt giới hạn theo IP", async () => {
    setVoucherRateLimiter(deny);
    const response = await POST(request({ code: "GIAM10", subtotal: 1 }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
  });
});
