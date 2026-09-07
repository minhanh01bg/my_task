import { describe, expect, it } from "vitest";

import {
  checkAdminLoginRateLimit,
  type AdminLoginCheckResult,
} from "@/server/auth/rate-limit";
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
}

function makeRequest(
  ip: string,
  headers: Record<string, string> = {},
): Request {
  return new Request("https://example.com/api/auth/login", {
    method: "POST",
    headers: {
      "cf-connecting-ip": ip,
      "content-type": "application/json",
      ...headers,
    },
  });
}

describe("Admin Login Rate Limiting (Task 8)", () => {
  it("exhausts the IP bucket on 10 attempts and blocks the 11th attempt with 429", async () => {
    const store = new FakeRedisStore();
    const limiter = createRateLimiter({ store, secret: "s".repeat(32) });
    const authOpts = {
      limiter,
      proxyMode: "cloudflare" as const,
      isProduction: true,
    };
    const ip = "198.51.100.50";

    for (let i = 1; i <= 10; i++) {
      const req = makeRequest(ip);
      const res = await checkAdminLoginRateLimit(req, authOpts);
      expect(res.ok).toBe(true);
    }

    const req11 = makeRequest(ip);
    const res11: AdminLoginCheckResult = await checkAdminLoginRateLimit(
      req11,
      authOpts,
    );
    expect(res11.ok).toBe(false);
    if (!res11.ok) {
      expect(res11.status).toBe(429);
      expect(res11.retryAfterSeconds).toBeGreaterThan(0);
      expect(res11.message).toBe("Vui lòng thử lại sau");
    }
  });

  it("enforces global limit across multiple distinct IPs", async () => {
    const store = new FakeRedisStore();
    const limiter = createRateLimiter({ store, secret: "s".repeat(32) });
    const authOpts = {
      limiter,
      proxyMode: "cloudflare" as const,
      isProduction: true,
    };

    // Global limit is 30 in POLICIES.adminLogin
    for (let i = 1; i <= 30; i++) {
      // Different subnets so IP and subnet buckets aren't hit
      const ip = `198.51.${i}.1`;
      const req = makeRequest(ip);
      const res = await checkAdminLoginRateLimit(req, authOpts);
      expect(res.ok).toBe(true);
    }

    // 31st attempt from a new IP hits the global limit
    const req31 = makeRequest("203.0.113.99");
    const res31 = await checkAdminLoginRateLimit(req31, authOpts);
    expect(res31.ok).toBe(false);
    if (!res31.ok) {
      expect(res31.status).toBe(429);
      expect(res31.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("fails closed with 503 when Redis store is unavailable", async () => {
    const store = new FakeRedisStore();
    store.shouldThrow = true;
    const limiter = createRateLimiter({ store, secret: "s".repeat(32) });
    const authOpts = {
      limiter,
      proxyMode: "cloudflare" as const,
      isProduction: true,
    };

    const req = makeRequest("198.51.100.70");
    const res = await checkAdminLoginRateLimit(req, authOpts);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(503);
      expect(res.message).toBe("Dịch vụ tạm thời không khả dụng");
    }
  });

  it("fails closed with 503 when client IP is untrusted or missing in production", async () => {
    const store = new FakeRedisStore();
    const limiter = createRateLimiter({ store, secret: "s".repeat(32) });
    const authOpts = {
      limiter,
      proxyMode: "cloudflare" as const,
      isProduction: true,
    };

    // Missing cf-connecting-ip header in cloudflare production mode
    const req = new Request("https://example.com/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "1.2.3.4", // Spoofed
      },
    });

    const res = await checkAdminLoginRateLimit(req, authOpts);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(503);
    }
  });

  it("ensures stored keys are HMAC pseudonymized with admin-login prefix", async () => {
    const store = new FakeRedisStore();
    const limiter = createRateLimiter({ store, secret: "s".repeat(32) });
    const authOpts = {
      limiter,
      proxyMode: "cloudflare" as const,
      isProduction: true,
    };
    const ip = "198.51.100.88";

    const req = makeRequest(ip);
    await checkAdminLoginRateLimit(req, authOpts);

    const keys = Array.from(store.map.keys());
    expect(keys.length).toBeGreaterThan(0);

    for (const key of keys) {
      expect(key).toMatch(/^rl:v1:admin-login:/);
      expect(key).not.toContain(ip);
    }
  });
});
