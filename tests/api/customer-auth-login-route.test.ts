import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/customer-auth/login/route";
import { POST as register } from "@/app/api/customer-auth/register/route";
import {
  hashCustomerPassword,
  verifyCustomerPassword,
} from "@/server/customer-auth/password";
import { setCustomerAuthLimiter } from "@/server/customer-auth/rate-limit";
import { customerCookieOptions } from "@/server/customer-auth/session";
import { prisma } from "@/server/db/prisma";
import {
  createRateLimiter,
  type RateLimitStore,
} from "@/server/security/rate-limit";
import { canonicalizeVietnamesePhone } from "@/types/customer-auth";

vi.mock("@/server/customer-auth/password", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/customer-auth/password")>();
  return {
    ...actual,
    verifyCustomerPassword: vi.fn(actual.verifyCustomerPassword),
  };
});

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
const originalSecure = customerCookieOptions.secure;

beforeEach(async () => {
  vi.mocked(verifyCustomerPassword).mockClear();
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
  customerCookieOptions.secure = originalSecure;
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

  it("rejects cross-site login attempts before verifying credentials", async () => {
    const res = await POST(
      makeRequest(
        { phone: testPhone, password: "password123" },
        { origin: "https://attacker.example" },
      ),
    );

    expect(res.status).toBe(403);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(verifyCustomerPassword).not.toHaveBeenCalled();
  });

  it("keeps the production Secure cookie flag on a plain-http request", async () => {
    customerCookieOptions.secure = true;
    const res = await POST(
      new Request("http://example.com/api/customer-auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: testPhone, password: "password123" }),
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("Secure");
  });

  describe("account enumeration timing", () => {
    it("runs one full scrypt verification when the phone has no account", async () => {
      const res = await POST(
        makeRequest({ phone: "0981119999", password: "password123" }),
      );

      expect(res.status).toBe(401);
      expect(verifyCustomerPassword).toHaveBeenCalledTimes(1);
      // The dummy hash must cost the same as a real one.
      const [, dummyHash] = vi.mocked(verifyCustomerPassword).mock.calls[0];
      const realHash = await hashCustomerPassword("password123");
      expect(dummyHash.split("$").slice(0, 4)).toEqual(
        realHash.split("$").slice(0, 4),
      );
    });

    it("runs one full scrypt verification when the account is disabled", async () => {
      await prisma.customerAccount.update({
        where: { phoneNormalized: normalizedPhone },
        data: { disabledAt: new Date() },
      });

      const res = await POST(
        makeRequest({ phone: testPhone, password: "password123" }),
      );

      expect(res.status).toBe(401);
      expect(verifyCustomerPassword).toHaveBeenCalledTimes(1);
    });
  });

  it("does not let registrations for a phone lock that phone out of login", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await register(
        new Request("https://example.com/api/customer-auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            phone: testPhone,
            displayName: "Someone Else",
            password: "another-password",
          }),
        }),
      );
      statuses.push(res.status);
    }
    // The 6th registration hits the registration bucket, not the login one.
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);

    const res = await POST(
      makeRequest({ phone: testPhone, password: "password123" }),
    );
    expect(res.status).toBe(200);
  });

  it("only counts failed logins toward the phone bucket", async () => {
    for (let i = 0; i < 6; i++) {
      const ok = await POST(
        makeRequest({ phone: testPhone, password: "password123" }),
      );
      expect(ok.status).toBe(200);
    }

    const wrong = await POST(
      makeRequest({ phone: testPhone, password: "wrong-password" }),
    );
    expect(wrong.status).toBe(401);
  });
});
