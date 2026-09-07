import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/customer-auth/register/route";
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

const testPhone = "0989998877";
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
  return new Request("https://example.com/api/customer-auth/register", {
    method: "POST",
    headers: new Headers({
      "content-type": "application/json",
      "cf-connecting-ip": "198.51.100.33",
      ...headers,
    }),
    body: JSON.stringify(body),
  });
}

describe("POST /api/customer-auth/register", () => {
  it("creates new customer account with privacy-preserving accepted response", async () => {
    const req = makeRequest({
      phone: testPhone,
      displayName: "New User",
      password: "password123",
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("set-cookie")).toBeNull();

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.message).toContain("Vui lòng đăng nhập");

    const created = await prisma.customerAccount.findUnique({
      where: { phoneNormalized: normalizedPhone },
    });
    expect(created).not.toBeNull();
    expect(created?.displayName).toBe("New User");
  });

  it("returns identical 200 response for existing phone without leaking existence or overwriting account", async () => {
    // 1. Pre-register
    const req1 = makeRequest({
      phone: testPhone,
      displayName: "First User",
      password: "initialPassword123",
    });
    const res1 = await POST(req1);
    expect(res1.status).toBe(200);
    const json1 = await res1.json();

    const initialAccount = await prisma.customerAccount.findUnique({
      where: { phoneNormalized: normalizedPhone },
    });
    expect(initialAccount).not.toBeNull();

    // 2. Attempt registration again with existing phone
    const req2 = makeRequest({
      phone: testPhone,
      displayName: "Attacker Trying Duplicate",
      password: "attackerPassword123",
    });
    const res2 = await POST(req2);

    expect(res2.status).toBe(200);
    expect(res2.headers.get("cache-control")).toContain("no-store");
    expect(res2.headers.get("set-cookie")).toBeNull();

    const json2 = await res2.json();
    // Body is completely identical to res1
    expect(json2).toEqual(json1);

    // Existing account data is unmodified
    const untouchedAccount = await prisma.customerAccount.findUnique({
      where: { phoneNormalized: normalizedPhone },
    });
    expect(untouchedAccount?.displayName).toBe("First User");
    expect(untouchedAccount?.passwordHash).toBe(initialAccount?.passwordHash);
  });

  it("fails closed with 503 when limiter is unavailable", async () => {
    store.shouldFail = true;
    const req = makeRequest({
      phone: testPhone,
      displayName: "New User",
      password: "password123",
    });
    const res = await POST(req);

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.message).toBe("Dịch vụ tạm thời không khả dụng");
  });

  it("returns 413 when request body exceeds maximum allowed size", async () => {
    const largePayload = {
      phone: testPhone,
      displayName: "A".repeat(70_000),
      password: "password123",
    };
    const req = makeRequest(largePayload);
    const res = await POST(req);

    expect(res.status).toBe(413);
  });
});
