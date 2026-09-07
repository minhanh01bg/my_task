import { describe, expect, it } from "vitest";

import {
  checkCustomerAuthAccount,
  checkCustomerAuthPreCheck,
  resetCustomerAuthAccount,
} from "@/server/customer-auth/rate-limit";
import {
  createRateLimiter,
  type RateLimitStore,
} from "@/server/security/rate-limit";

class FakeRedisStore implements RateLimitStore {
  public map = new Map<string, { count: number; expiresAt: number }>();
  public shouldThrow = false;

  async incrementAndGetTtl(
    key: string,
    windowSeconds: number,
    now = Date.now(),
  ): Promise<{ count: number; ttlSeconds: number }> {
    if (this.shouldThrow) {
      throw new Error("Redis connection failure");
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

function makeRequest(
  ip: string,
  headers: Record<string, string> = {},
): Request {
  return new Request("https://example.com/api/customer-auth/login", {
    method: "POST",
    headers: {
      "cf-connecting-ip": ip,
      "content-type": "application/json",
      ...headers,
    },
  });
}

describe("Distributed Customer Auth Rate Limiting (Task 7)", () => {
  it("blocks an IP after exceeding IP limit when spraying multiple phone numbers", async () => {
    const store = new FakeRedisStore();
    const limiter = createRateLimiter({ store, secret: "s".repeat(32) });
    const authOpts = {
      limiter,
      proxyMode: "cloudflare" as const,
      isProduction: true,
    };
    const ip = "198.51.100.1";

    // Exhaust 20 allowed IP attempts across 20 distinct phone numbers
    for (let i = 1; i <= 20; i++) {
      const req = makeRequest(ip);
      const preCheck = await checkCustomerAuthPreCheck(req, authOpts);
      expect(preCheck.ok).toBe(true);

      const phone = `09000000${String(i).padStart(2, "0")}`;
      const accountCheck = await checkCustomerAuthAccount(phone, limiter);
      expect(accountCheck.ok).toBe(true);
    }

    // 21st attempt from same IP must be blocked by IP bucket
    const req21 = makeRequest(ip);
    const preCheck21 = await checkCustomerAuthPreCheck(req21, authOpts);
    expect(preCheck21.ok).toBe(false);
    if (!preCheck21.ok) {
      expect(preCheck21.status).toBe(429);
      expect(preCheck21.retryAfterSeconds).toBeGreaterThan(0);
      expect(preCheck21.message).toBe("Vui lòng thử lại sau");
    }
  });

  it("blocks attacks from many IPs targeting one single phone number", async () => {
    const store = new FakeRedisStore();
    const limiter = createRateLimiter({ store, secret: "s".repeat(32) });
    const authOpts = {
      limiter,
      proxyMode: "cloudflare" as const,
      isProduction: true,
    };
    const targetPhone = "0987654321";

    // 5 attempts from 5 different IPs
    for (let i = 1; i <= 5; i++) {
      const req = makeRequest(`198.51.100.${i}`);
      const preCheck = await checkCustomerAuthPreCheck(req, authOpts);
      expect(preCheck.ok).toBe(true);

      const accountCheck = await checkCustomerAuthAccount(targetPhone, limiter);
      expect(accountCheck.ok).toBe(true);
    }

    // 6th attempt from a brand new IP targeting the same phone must fail
    const req6 = makeRequest("198.51.100.99");
    const preCheck6 = await checkCustomerAuthPreCheck(req6, authOpts);
    expect(preCheck6.ok).toBe(true);

    const accountCheck6 = await checkCustomerAuthAccount(targetPhone, limiter);
    expect(accountCheck6.ok).toBe(false);
    if (!accountCheck6.ok) {
      expect(accountCheck6.status).toBe(429);
      expect(accountCheck6.retryAfterSeconds).toBeGreaterThan(0);
      expect(accountCheck6.message).toBe("Vui lòng thử lại sau");
    }
  });

  it("enforces subnet velocity across rotating IPs within the same /24", async () => {
    const store = new FakeRedisStore();
    const limiter = createRateLimiter({ store, secret: "s".repeat(32) });
    const authOpts = {
      limiter,
      proxyMode: "cloudflare" as const,
      isProduction: true,
    };

    // Subnet limit is 100 in POLICIES.customerAuth
    for (let i = 1; i <= 100; i++) {
      const ip = `203.0.113.${i}`;
      const req = makeRequest(ip);
      const preCheck = await checkCustomerAuthPreCheck(req, authOpts);
      expect(preCheck.ok).toBe(true);
    }

    // 101st attempt from the same subnet (different host) must be rate limited
    const req101 = makeRequest("203.0.113.250");
    const preCheck101 = await checkCustomerAuthPreCheck(req101, authOpts);
    expect(preCheck101.ok).toBe(false);
    if (!preCheck101.ok) {
      expect(preCheck101.status).toBe(429);
      expect(preCheck101.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("fails closed with 503 when Redis store is unavailable or throws", async () => {
    const store = new FakeRedisStore();
    store.shouldThrow = true;
    const limiter = createRateLimiter({ store, secret: "s".repeat(32) });
    const authOpts = {
      limiter,
      proxyMode: "cloudflare" as const,
      isProduction: true,
    };

    const req = makeRequest("198.51.100.5");
    const preCheck = await checkCustomerAuthPreCheck(req, authOpts);
    expect(preCheck.ok).toBe(false);
    if (!preCheck.ok) {
      expect(preCheck.status).toBe(503);
      expect(preCheck.message).toBe("Dịch vụ tạm thời không khả dụng");
    }
  });

  it("ensures rate limit keys in the store are HMAC pseudonymized without plaintext phone or IP", async () => {
    const store = new FakeRedisStore();
    const limiter = createRateLimiter({ store, secret: "s".repeat(32) });
    const authOpts = {
      limiter,
      proxyMode: "cloudflare" as const,
      isProduction: true,
    };
    const ip = "198.51.100.42";
    const phone = "0912345678";

    const req = makeRequest(ip);
    await checkCustomerAuthPreCheck(req, authOpts);
    await checkCustomerAuthAccount(phone, limiter);

    const keys = Array.from(store.map.keys());
    expect(keys.length).toBeGreaterThanOrEqual(2);

    for (const key of keys) {
      // Must follow HMAC derived key structure: rl:v1:...
      expect(key).toMatch(/^rl:v1:customer-auth:/);
      // Plaintext IP or phone must NEVER appear in keys
      expect(key).not.toContain(ip);
      expect(key).not.toContain(phone);
      expect(key).not.toContain("0912345678");
    }
  });

  it("resets only the phone bucket on successful login without erasing IP/subnet history", async () => {
    const store = new FakeRedisStore();
    const limiter = createRateLimiter({ store, secret: "s".repeat(32) });
    const authOpts = {
      limiter,
      proxyMode: "cloudflare" as const,
      isProduction: true,
    };
    const ip = "198.51.100.8";
    const phone = "0912345678";

    // 4 failed attempts on this phone from this IP
    for (let i = 0; i < 4; i++) {
      const req = makeRequest(ip);
      await checkCustomerAuthPreCheck(req, authOpts);
      await checkCustomerAuthAccount(phone, limiter);
    }

    // Now simulate successful login resetting the account bucket
    await resetCustomerAuthAccount(phone, limiter);

    // The phone bucket is reset, so 4 more attempts on this phone succeed
    for (let i = 0; i < 4; i++) {
      const check = await checkCustomerAuthAccount(phone, limiter);
      expect(check.ok).toBe(true);
    }

    // But the IP bucket was NOT erased! It has 4 attempts from earlier.
    // Making 16 more requests from this IP should exhaust its 20 limit
    for (let i = 0; i < 16; i++) {
      const req = makeRequest(ip);
      const pre = await checkCustomerAuthPreCheck(req, authOpts);
      expect(pre.ok).toBe(true);
    }

    // 21st attempt from this IP must be blocked because IP counter was not cleared
    const blockedReq = makeRequest(ip);
    const blockedPre = await checkCustomerAuthPreCheck(blockedReq, authOpts);
    expect(blockedPre.ok).toBe(false);
    if (!blockedPre.ok) {
      expect(blockedPre.status).toBe(429);
    }
  });
});
