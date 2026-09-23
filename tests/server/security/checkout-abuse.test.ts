import { describe, expect, it } from "vitest";

import {
  checkPreParseAbuse,
  checkPostParseAbuse,
} from "@/server/security/checkout-abuse";
import {
  createRateLimiter,
  type RateLimitDecision,
  type RateLimiter,
  type RateLimitStore,
} from "@/server/security/rate-limit";
import type { OnlineCheckoutInput } from "@/types/online-order";

class FakeStore implements RateLimitStore {
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
}

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/online/orders", {
    method: "POST",
    headers: new Headers({
      "content-type": "application/json",
      "cf-connecting-ip": "203.0.113.5",
      ...headers,
    }),
  });
}

const mockOrder: OnlineCheckoutInput = {
  clientId: "550e8400-e29b-41d4-a716-446655440000",
  contactName: "Nguyen Van A",
  contactPhone: "0987654321",
  fulfillmentType: "pickup",
  paymentMethod: "cod",
  lines: [{ productId: "prod_1", quantity: 2 }],
  deliveryAddress: "",
  deliveryWard: "",
  deliveryDistrict: "",
  deliveryProvince: "",
  note: "",
};

describe("Checkout Layered Anti-Abuse", () => {
  const secret = "k".repeat(32);

  describe("Pre-parse cheap IP / Subnet / Global checks", () => {
    it("returns 503 if trusted client IP cannot be resolved in production", async () => {
      const store = new FakeStore();
      const limiter = createRateLimiter({ store, secret });

      // Missing trusted IP header in production
      const req = new Request("https://example.com/api/online/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });

      const res = await checkPreParseAbuse(req, {
        limiter,
        isProduction: true,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.status).toBe(503);
        expect(res.error).toBe("untrusted_ip");
      }
    });

    it("returns 503 if rate limiter is unavailable (fails closed)", async () => {
      const store = new FakeStore();
      store.shouldFail = true;
      const limiter = createRateLimiter({ store, secret });

      const req = makeRequest();
      const res = await checkPreParseAbuse(req, { limiter });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.status).toBe(503);
        expect(res.error).toBe("limiter_unavailable");
      }
    });

    it("burst requests with rotating UUIDs hit IP bucket and return 429 with Retry-After", async () => {
      const store = new FakeStore();
      const limiter = createRateLimiter({ store, secret });

      const req = makeRequest({ "cf-connecting-ip": "198.51.100.1" });

      // IP limit is 10 in POLICIES.checkoutIp
      for (let i = 0; i < 10; i++) {
        const pass = await checkPreParseAbuse(req, {
          limiter,
          proxyMode: "cloudflare",
        });
        expect(pass.ok).toBe(true);
      }

      // 11th request should be blocked
      const blocked = await checkPreParseAbuse(req, {
        limiter,
        proxyMode: "cloudflare",
      });
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) {
        expect(blocked.status).toBe(429);
        expect(blocked.error).toBe("rate_limited");
        expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
      }
    });

    it("burst requests across different IPs in the same subnet hit subnet bucket", async () => {
      const store = new FakeStore();
      const limiter = createRateLimiter({ store, secret });

      // Subnet limit is 50 in POLICIES.checkoutIp (198.51.100.0/24)
      for (let i = 1; i <= 50; i++) {
        // Rotate IPs within the same subnet
        const req = makeRequest({ "cf-connecting-ip": `198.51.100.${i}` });
        const pass = await checkPreParseAbuse(req, {
          limiter,
          proxyMode: "cloudflare",
        });
        expect(pass.ok).toBe(true);
      }

      // 51st request on the same subnet must be blocked by subnet-burst
      const reqBlocked = makeRequest({ "cf-connecting-ip": "198.51.100.200" });
      const blocked = await checkPreParseAbuse(reqBlocked, {
        limiter,
        proxyMode: "cloudflare",
      });
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) {
        expect(blocked.status).toBe(429);
        expect(blocked.error).toBe("rate_limited");
      }
    });
  });

  describe("Post-parse velocity checks (Phone & Product)", () => {
    it("enforces phone hourly velocity bucket", async () => {
      const store = new FakeStore();
      const limiter = createRateLimiter({ store, secret });
      const req = makeRequest();

      // Phone limit is 5 in POLICIES.checkoutPhone
      for (let i = 0; i < 5; i++) {
        const pass = await checkPostParseAbuse(mockOrder, req, { limiter });
        expect(pass.ok).toBe(true);
      }

      // 6th order with the same phone is blocked
      const blocked = await checkPostParseAbuse(mockOrder, req, { limiter });
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) {
        expect(blocked.status).toBe(429);
        expect(blocked.error).toBe("rate_limited");
      }
    });

    it("enforces product velocity bucket", async () => {
      const store = new FakeStore();
      const limiter = createRateLimiter({ store, secret });
      const req = makeRequest();

      const orderWithHotProduct: OnlineCheckoutInput = {
        ...mockOrder,
        contactPhone: "0912345678",
        lines: [{ productId: "hot_deal_product", quantity: 1 }],
      };

      // Product limit is 600 in POLICIES.checkoutProduct
      for (let i = 0; i < 600; i++) {
        const pass = await checkPostParseAbuse(
          {
            ...orderWithHotProduct,
            contactPhone: `0900000${String(i).padStart(3, "0")}`,
          },
          req,
          { limiter },
        );
        expect(pass.ok).toBe(true);
      }

      // 601st request on hot_deal_product is blocked
      const blocked = await checkPostParseAbuse(
        {
          ...orderWithHotProduct,
          contactPhone: "0999999999",
        },
        req,
        { limiter },
      );
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) {
        expect(blocked.status).toBe(429);
        expect(blocked.error).toBe("rate_limited");
      }
    });
  });

  describe("Post-parse checks run in parallel", () => {
    const allowed: RateLimitDecision = {
      allowed: true,
      remaining: 1,
      limit: 5,
      resetInSeconds: 60,
    };
    const limited: RateLimitDecision = {
      allowed: false,
      reason: "rate_limited",
      retryAfterSeconds: 30,
      limit: 5,
      remaining: 0,
    };

    function gatedLimiter(decisions: Record<string, RateLimitDecision>) {
      const started: string[] = [];
      const waiters: Array<() => void> = [];
      const limiter: RateLimiter = {
        async check(policy) {
          started.push(policy.name);
          await new Promise<void>((resolve) => waiters.push(resolve));
          return decisions[policy.name] ?? allowed;
        },
      };
      const releaseAll = () => {
        for (const release of waiters.splice(0)) release();
      };
      return { limiter, started, releaseAll };
    }

    async function flushMicrotasks(): Promise<void> {
      for (let i = 0; i < 10; i++) await Promise.resolve();
    }

    it("checks phone and product velocity concurrently", async () => {
      const { limiter, started, releaseAll } = gatedLimiter({});

      const pending = checkPostParseAbuse(mockOrder, makeRequest(), {
        limiter,
      });
      await flushMicrotasks();

      expect(started.sort()).toEqual(["checkout-phone", "checkout-product"]);
      releaseAll();
      expect(await pending).toEqual({ ok: true });
    });

    it("reports the phone denial when both phone and product are limited", async () => {
      const { limiter, releaseAll } = gatedLimiter({
        "checkout-phone": limited,
        "checkout-product": limited,
      });

      const pending = checkPostParseAbuse(mockOrder, makeRequest(), {
        limiter,
      });
      await flushMicrotasks();
      releaseAll();

      const res = await pending;
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.status).toBe(429);
        expect(res.message).toBe(
          "Quá nhiều đơn hàng từ số điện thoại này trong thời gian ngắn",
        );
      }
    });

    it("denies on product velocity even when the phone bucket allows", async () => {
      const { limiter, releaseAll } = gatedLimiter({
        "checkout-product": limited,
      });

      const pending = checkPostParseAbuse(mockOrder, makeRequest(), {
        limiter,
      });
      await flushMicrotasks();
      releaseAll();

      const res = await pending;
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.status).toBe(429);
        expect(res.retryAfterSeconds).toBe(30);
        expect(res.message).toBe(
          "Sản phẩm đang có quá nhiều lượt mua cùng lúc. Vui lòng thử lại.",
        );
      }
    });
  });

  describe("Adaptive security challenge", () => {
    it("passes low-risk traffic without challenge when challenge is disabled", async () => {
      const store = new FakeStore();
      const limiter = createRateLimiter({ store, secret });
      const req = makeRequest();

      const res = await checkPostParseAbuse(mockOrder, req, {
        limiter,
        challengeEnabled: false,
      });
      expect(res.ok).toBe(true);
    });

    it("requires and verifies challenge token when challenge is enabled", async () => {
      const store = new FakeStore();
      const limiter = createRateLimiter({ store, secret });

      // Request without challenge token fails closed
      const reqNoToken = makeRequest();
      const resNoToken = await checkPostParseAbuse(mockOrder, reqNoToken, {
        limiter,
        challengeEnabled: true,
      });
      expect(resNoToken.ok).toBe(false);
      if (!resNoToken.ok) {
        expect(resNoToken.status).toBe(403);
        expect(resNoToken.error).toBe("challenge_required");
      }

      // Request with invalid challenge token fails
      const reqBadToken = makeRequest({ "cf-turnstile-response": "bad-token" });
      const resBadToken = await checkPostParseAbuse(mockOrder, reqBadToken, {
        limiter,
        challengeEnabled: true,
        verifyChallenge: async (token) => token === "valid-token",
      });
      expect(resBadToken.ok).toBe(false);
      if (!resBadToken.ok) {
        expect(resBadToken.status).toBe(403);
        expect(resBadToken.error).toBe("challenge_failed");
      }

      // Request with valid challenge token passes
      const reqValidToken = makeRequest({
        "cf-turnstile-response": "valid-token",
      });
      const resValidToken = await checkPostParseAbuse(
        mockOrder,
        reqValidToken,
        {
          limiter,
          challengeEnabled: true,
          verifyChallenge: async (token) => token === "valid-token",
        },
      );
      expect(resValidToken.ok).toBe(true);
    });
  });
});
