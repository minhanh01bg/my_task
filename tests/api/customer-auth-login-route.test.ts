import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/customer-auth/login/route";
import { hashCustomerPassword } from "@/server/customer-auth/password";
import { setCustomerAuthLimiter } from "@/server/customer-auth/rate-limit";
import { prisma } from "@/server/db/prisma";
import {
  createRateLimiter,
  type RateLimitStore,
} from "@/server/security/rate-limit";
import { canonicalizeVietnamesePhone } from "@/types/customer-auth";

class MockStore implements RateLimitStore {
  public map = new Map<string, { count: number; expiresAt: number }>();
  public shouldFail = false;

  async incrementAndGetTtl(
    key: string,
    windowSeconds: number,
    now = Date.now(),
  ): Promise<{ count: number; ttlSeconds: number }> {
    if (this.shouldFail) {
      throw new Error("Redis failure");
    }
    const entry = this.map.get(key);
    if (!entry || entry.expiresAt <= now) {
      const expiresAt = now + windowSeconds * 1000;
      this.map.set(key, { count: 1, expiresAt });
      return { count: 1, ttlSeconds: windowSeconds };
    }
    entry.count += 1;
    const ttlSeconds = Math.max(1, Math.ceil((entry.expiresAt - now) / 1000));
    return { count: entry.count, ttlSeconds };
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
}

const testPhone = "0981112233";
const normalizedPhone = canonicalizeVietnamesePhone(testPhone);
let store: MockStore;

beforeEach(async () => {
  store = new MockStore();
  const limiter = createRateLimiter({ store, secret: "s".repeat(32) });
  setCustomerAuthLimiter(limiter);

  await prisma.customerSession.deleteMany();
  await prisma.customerAccount.deleteMany({
    where: { phoneNormalized: normalizedPhone },
  });

  const passwordHash = await hashCustomerPassword("password123");
  await prisma.customerAccount.create({
    data: {
      phoneNormalized: normalizedPhone,
      displayName: "Test User",
      passwordHash,
    },
  });
});

afterEach(async () => {
  setCustomerAuthLimiter(null);
  await prisma.customerSession.deleteMany();
  await prisma.customerAccount.deleteMany({
    where: { phoneNormalized: normalizedPhone },
  });
});

function makeRequest(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request("https://example.com/api/customer-auth/login", {
    method: "POST",
    headers: new Headers({
      "content-type": "application/json",
      "cf-connecting-ip": "198.51.100.22",
      ...headers,
    }),
    body: JSON.stringify(body),
  });
}

describe("POST /api/customer-auth/login", () => {
  it("authenticates valid credentials and sets session cookie with no-store", async () => {
    const req = makeRequest({ phone: testPhone, password: "password123" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const json = await res.json();
    expect(json.data.account.displayName).toBe("Test User");
  });

  it("returns 401 with generic error message on invalid password", async () => {
    const req = makeRequest({ phone: testPhone, password: "wrong-password" });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.message).toBe("Số điện thoại hoặc mật khẩu không đúng");
  });

  it("enforces rate limits and returns 429 with Retry-After when attempts exceeded", async () => {
    // Exceed the 5-attempt phone limit
    for (let i = 0; i < 5; i++) {
      const req = makeRequest({ phone: testPhone, password: "wrong-password" });
      await POST(req);
    }

    // 6th attempt must be rejected by rate limiter
    const req6 = makeRequest({ phone: testPhone, password: "wrong-password" });
    const res6 = await POST(req6);

    expect(res6.status).toBe(429);
    expect(res6.headers.get("retry-after")).toBeDefined();
    const json = await res6.json();
    expect(json.message).toBe("Vui lòng thử lại sau");
  });

  it("fails closed with 503 when distributed limiter is unavailable", async () => {
    store.shouldFail = true;
    const req = makeRequest({ phone: testPhone, password: "password123" });
    const res = await POST(req);

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.message).toBe("Dịch vụ tạm thời không khả dụng");
  });
});
