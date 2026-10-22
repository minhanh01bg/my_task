import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createRateLimiter,
  deriveRateLimitKey,
  type RateLimitStore,
  type RateLimitTarget,
} from "@/server/security/rate-limit";
import {
  POLICIES,
  type RateLimitPolicy,
} from "@/server/security/rate-limit-policy";

/**
 * Store whose increments stay pending until released, so a test can observe
 * how many bucket increments are in flight at the same time.
 */
class GatedStore implements RateLimitStore {
  public counts = new Map<string, number>();
  public inFlight = 0;
  public maxInFlight = 0;
  private waiters: Array<() => void> = [];

  constructor(private readonly seed: Record<string, number> = {}) {}

  async incrementAndGetTtl(
    key: string,
    windowSeconds: number,
  ): Promise<{ count: number; ttlSeconds: number }> {
    this.inFlight += 1;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.inFlight -= 1;
    const bucket = key.split(":").slice(2, 4).join(":");
    const next = (this.counts.get(key) ?? this.seed[bucket] ?? 0) + 1;
    this.counts.set(key, next);
    return { count: next, ttlSeconds: windowSeconds };
  }

  releaseAll(): void {
    const pending = this.waiters;
    this.waiters = [];
    for (const release of pending) release();
  }
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

class FakeRedisStore implements RateLimitStore {
  public map = new Map<string, { count: number; expiresAt: number }>();
  public shouldTimeout = false;
  public shouldThrow = false;
  public returnMalformed = false;

  async incrementAndGetTtl(
    key: string,
    windowSeconds: number,
    now = Date.now(),
  ): Promise<{ count: number; ttlSeconds: number }> {
    if (this.shouldTimeout) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      throw new Error("Redis connection timeout");
    }
    if (this.shouldThrow) {
      throw new Error("Network error connecting to Redis REST API");
    }
    if (this.returnMalformed) {
      // @ts-expect-error simulating malformed data
      return { count: "invalid", ttlSeconds: null };
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

  async decrement(key: string): Promise<void> {
    if (this.shouldThrow) {
      throw new Error("Network error connecting to Redis REST API");
    }
    const entry = this.map.get(key);
    if (entry && entry.count > 0) entry.count -= 1;
  }
}

describe("Distributed Rate Limiter", () => {
  const testSecret = "k".repeat(32);

  describe("HMAC key derivation", () => {
    it("never includes plaintext sensitive dimensions in keys", () => {
      const sensitiveInputs = {
        ip: "198.51.100.42",
        subnet: "198.51.100.0/24",
        phone: "0987654321",
        productId: "prod_sensitive_xyz",
        route: "/api/online/orders",
      };

      for (const [dimension, value] of Object.entries(sensitiveInputs)) {
        const key = deriveRateLimitKey(
          "v1",
          "checkout",
          dimension,
          value,
          testSecret,
        );

        expect(key).not.toContain(value);
        expect(key).toMatch(/^rl:v1:checkout:[a-zA-Z0-9_-]+:[0-9a-f]{32,64}$/);
      }
    });

    it("produces consistent keys for identical inputs and distinct for different", () => {
      const key1 = deriveRateLimitKey(
        "v1",
        "checkout",
        "ip",
        "1.2.3.4",
        testSecret,
      );
      const key2 = deriveRateLimitKey(
        "v1",
        "checkout",
        "ip",
        "1.2.3.4",
        testSecret,
      );
      const key3 = deriveRateLimitKey(
        "v1",
        "checkout",
        "ip",
        "1.2.3.5",
        testSecret,
      );

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });
  });

  describe("Atomic consumption, quota, and expiry", () => {
    const policy: RateLimitPolicy = {
      name: "test-auth",
      failClosed: true,
      buckets: [{ name: "per-ip", limit: 3, windowSeconds: 60 }],
    };

    it("tracks remaining quota and enforces limit", async () => {
      const store = new FakeRedisStore();
      const limiter = createRateLimiter({ store, secret: testSecret });
      const target: RateLimitTarget = {
        bucketName: "per-ip",
        dimension: "ip",
        identifier: "203.0.113.1",
      };

      // Request 1
      const res1 = await limiter.check(policy, [target]);
      expect(res1.allowed).toBe(true);
      if (res1.allowed) {
        expect(res1.remaining).toBe(2);
      }

      // Request 2
      const res2 = await limiter.check(policy, [target]);
      expect(res2.allowed).toBe(true);
      if (res2.allowed) {
        expect(res2.remaining).toBe(1);
      }

      // Request 3
      const res3 = await limiter.check(policy, [target]);
      expect(res3.allowed).toBe(true);
      if (res3.allowed) {
        expect(res3.remaining).toBe(0);
      }

      // Request 4 - should be rate limited
      const res4 = await limiter.check(policy, [target]);
      expect(res4.allowed).toBe(false);
      if (!res4.allowed) {
        expect(res4.reason).toBe("rate_limited");
        expect(res4.retryAfterSeconds).toBeGreaterThanOrEqual(1);
        expect(res4.retryAfterSeconds).toBeLessThanOrEqual(60);
      }
    });

    it("resets quota after window expiry", async () => {
      const store = new FakeRedisStore();
      const limiter = createRateLimiter({ store, secret: testSecret });
      const target: RateLimitTarget = {
        bucketName: "per-ip",
        dimension: "ip",
        identifier: "203.0.113.2",
      };

      // Fill quota
      await limiter.check(policy, [target]);
      await limiter.check(policy, [target]);
      await limiter.check(policy, [target]);
      const blocked = await limiter.check(policy, [target]);
      expect(blocked.allowed).toBe(false);

      // Set expiresAt to the past to simulate expiry
      const key = deriveRateLimitKey(
        "v1",
        "test-auth:per-ip",
        "ip",
        "203.0.113.2",
        testSecret,
      );
      const entry = store.map.get(key);
      if (entry) {
        entry.expiresAt = Date.now() - 1000;
      }

      const resAfterExpiry = await limiter.check(policy, [target]);
      expect(resAfterExpiry.allowed).toBe(true);
      if (resAfterExpiry.allowed) {
        expect(resAfterExpiry.remaining).toBe(2);
      }
    });
  });

  describe("Multi-bucket independent evaluation", () => {
    const multiPolicy: RateLimitPolicy = {
      name: "checkout-guard",
      failClosed: true,
      buckets: [
        { name: "ip-burst", limit: 2, windowSeconds: 10 },
        { name: "subnet-burst", limit: 5, windowSeconds: 10 },
      ],
    };

    it("rejects if any bucket in the set is exceeded", async () => {
      const store = new FakeRedisStore();
      const limiter = createRateLimiter({ store, secret: testSecret });

      const targets: RateLimitTarget[] = [
        { bucketName: "ip-burst", dimension: "ip", identifier: "198.51.100.1" },
        {
          bucketName: "subnet-burst",
          dimension: "subnet",
          identifier: "198.51.100.0/24",
        },
      ];

      // Req 1 & 2 pass
      expect((await limiter.check(multiPolicy, targets)).allowed).toBe(true);
      expect((await limiter.check(multiPolicy, targets)).allowed).toBe(true);

      // Req 3: ip-burst exceeded (limit 2), even though subnet-burst has capacity (2 of 5)
      const res3 = await limiter.check(multiPolicy, targets);
      expect(res3.allowed).toBe(false);
      if (!res3.allowed) {
        expect(res3.reason).toBe("rate_limited");
      }
    });
  });

  describe("Narrow-to-broad bucket evaluation", () => {
    const threeBucketPolicy: RateLimitPolicy = {
      name: "layered",
      failClosed: true,
      buckets: [
        { name: "ip", limit: 2, windowSeconds: 60 },
        { name: "subnet", limit: 50, windowSeconds: 60 },
        { name: "global", limit: 3, windowSeconds: 60 },
      ],
    };
    const targetsFor = (ip: string): RateLimitTarget[] => [
      { bucketName: "ip", dimension: "ip", identifier: ip },
      {
        bucketName: "subnet",
        dimension: "subnet",
        identifier: `${ip.split(".").slice(0, 3).join(".")}.0/24`,
      },
      { bucketName: "global", dimension: "global", identifier: "global" },
    ];

    /** Sums stored counts per bucket name (`rl:v1:<policy>:<bucket>:...`). */
    function countsByBucket(store: FakeRedisStore): Record<string, number> {
      const counts: Record<string, number> = {};
      for (const [key, entry] of store.map) {
        const bucket = key.split(":")[3];
        counts[bucket] = (counts[bucket] ?? 0) + entry.count;
      }
      return counts;
    }

    it("checks buckets one at a time, narrowest first", async () => {
      const store = new GatedStore();
      const limiter = createRateLimiter({ store, secret: testSecret });

      const pending = limiter.check(threeBucketPolicy, targetsFor("1.2.3.4"));
      for (let step = 0; step < 3; step++) {
        await flushMicrotasks();
        expect(store.inFlight).toBe(1);
        store.releaseAll();
      }

      const decision = await pending;
      expect(decision.allowed).toBe(true);
      expect(store.maxInFlight).toBe(1);
      if (decision.allowed) {
        expect(decision.remaining).toBe(1);
      }
    });

    it("stops at the first exceeded bucket without touching broader ones", async () => {
      const store = new FakeRedisStore();
      const limiter = createRateLimiter({ store, secret: testSecret });

      const decisions = [];
      for (let i = 0; i < 5; i++) {
        decisions.push(
          await limiter.check(threeBucketPolicy, targetsFor("198.51.100.9")),
        );
      }

      expect(decisions.map((d) => d.allowed)).toEqual([
        true,
        true,
        false,
        false,
        false,
      ]);
      const denied = decisions[2];
      if (!denied.allowed) {
        expect(denied.reason).toBe("rate_limited");
        expect(denied.limit).toBe(2);
      }
      // A blocked IP must not drain the subnet/global budgets shared with
      // everyone else.
      expect(countsByBucket(store)).toEqual({ ip: 5, subnet: 2, global: 2 });

      // So another client is still served.
      const other = await limiter.check(
        threeBucketPolicy,
        targetsFor("203.0.113.1"),
      );
      expect(other.allowed).toBe(true);
    });

    it("denies on a broad bucket once enough distinct clients pass the narrow ones", async () => {
      const store = new FakeRedisStore();
      const limiter = createRateLimiter({ store, secret: testSecret });

      for (const ip of ["192.0.2.1", "198.51.100.1", "203.0.113.1"]) {
        expect(
          (await limiter.check(threeBucketPolicy, targetsFor(ip))).allowed,
        ).toBe(true);
      }

      const decision = await limiter.check(
        threeBucketPolicy,
        targetsFor("203.0.113.2"),
      );
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) {
        expect(decision.limit).toBe(3);
        expect(decision.retryAfterSeconds).toBe(60);
      }
    });

    it("release refunds one unit on the listed buckets only", async () => {
      const store = new FakeRedisStore();
      const limiter = createRateLimiter({ store, secret: testSecret });
      const targets = targetsFor("198.51.100.9");

      await limiter.check(threeBucketPolicy, targets);
      await limiter.check(threeBucketPolicy, targets);
      await limiter.release?.(threeBucketPolicy, targets.slice(1));

      expect(countsByBucket(store)).toEqual({ ip: 2, subnet: 1, global: 1 });
    });

    it("release is best-effort when the store fails", async () => {
      const store = new FakeRedisStore();
      const limiter = createRateLimiter({ store, secret: testSecret });
      await limiter.check(threeBucketPolicy, targetsFor("198.51.100.9"));
      store.shouldThrow = true;

      await expect(
        limiter.release?.(threeBucketPolicy, targetsFor("198.51.100.9")),
      ).resolves.toBeUndefined();
    });

    it("release on the default in-memory store refunds without going negative", async () => {
      const limiter = createRateLimiter({ secret: testSecret });
      const policy: RateLimitPolicy = {
        name: `memory-release-${Date.now()}`,
        failClosed: true,
        buckets: [{ name: "global", limit: 1, windowSeconds: 60 }],
      };
      const target: RateLimitTarget = {
        bucketName: "global",
        dimension: "global",
        identifier: "global",
      };

      expect((await limiter.check(policy, [target])).allowed).toBe(true);
      await limiter.release?.(policy, [target]);
      await limiter.release?.(policy, [target]);
      expect((await limiter.check(policy, [target])).allowed).toBe(true);
      expect((await limiter.check(policy, [target])).allowed).toBe(false);
    });
  });

  describe("Timeout timer cleanup", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("clears the timeout timer once the store answers", async () => {
      vi.useFakeTimers();
      const store = new FakeRedisStore();
      const limiter = createRateLimiter({
        store,
        secret: testSecret,
        timeoutMs: 1500,
      });

      const decision = await limiter.check(
        {
          name: "timer",
          failClosed: true,
          buckets: [{ name: "burst", limit: 5, windowSeconds: 60 }],
        },
        [{ bucketName: "burst", dimension: "ip", identifier: "1.2.3.4" }],
      );

      expect(decision.allowed).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("clears the timeout timer when the store fails fast", async () => {
      vi.useFakeTimers();
      const store = new FakeRedisStore();
      store.shouldThrow = true;
      const limiter = createRateLimiter({ store, secret: testSecret });

      const decision = await limiter.check(
        {
          name: "timer",
          failClosed: true,
          buckets: [{ name: "burst", limit: 5, windowSeconds: 60 }],
        },
        [{ bucketName: "burst", dimension: "ip", identifier: "1.2.3.4" }],
      );

      expect(decision.allowed).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe("Production policy caps", () => {
    it("raises global caps to realistic values", () => {
      const bucket = (
        policy: RateLimitPolicy,
        name: string,
      ): { limit: number; windowSeconds: number } | undefined =>
        policy.buckets.find((b) => b.name === name);

      expect(bucket(POLICIES.checkoutIp, "global-burst")).toEqual({
        name: "global-burst",
        limit: 6000,
        windowSeconds: 60,
      });
      expect(bucket(POLICIES.checkoutProduct, "product-velocity")).toEqual({
        name: "product-velocity",
        limit: 600,
        windowSeconds: 60,
      });
      expect(bucket(POLICIES.customerAuth, "global-attempts")).toEqual({
        name: "global-attempts",
        limit: 10000,
        windowSeconds: 900,
      });
    });

    it("keeps per-IP, subnet and phone caps unchanged", () => {
      const limits = (policy: RateLimitPolicy) =>
        Object.fromEntries(policy.buckets.map((b) => [b.name, b.limit]));

      expect(limits(POLICIES.checkoutIp)).toMatchObject({
        "ip-burst": 10,
        "subnet-burst": 50,
      });
      expect(limits(POLICIES.checkoutPhone)).toEqual({ "phone-hourly": 5 });
      expect(limits(POLICIES.customerAuth)).toMatchObject({
        "ip-attempts": 20,
        "subnet-attempts": 100,
        "phone-attempts": 5,
      });
    });
  });

  describe("Multi-instance simulation", () => {
    it("shares state across instances without bypass by alternating instances", async () => {
      const sharedStore = new FakeRedisStore();
      const instance1 = createRateLimiter({
        store: sharedStore,
        secret: testSecret,
      });
      const instance2 = createRateLimiter({
        store: sharedStore,
        secret: testSecret,
      });

      const policy: RateLimitPolicy = {
        name: "shared-checkout",
        failClosed: true,
        buckets: [{ name: "burst", limit: 2, windowSeconds: 60 }],
      };

      const target: RateLimitTarget = {
        bucketName: "burst",
        dimension: "ip",
        identifier: "203.0.113.99",
      };

      // Alternating instances
      const res1 = await instance1.check(policy, [target]);
      expect(res1.allowed).toBe(true);

      const res2 = await instance2.check(policy, [target]);
      expect(res2.allowed).toBe(true);

      // 3rd request from instance1 must be blocked because store is shared
      const res3 = await instance1.check(policy, [target]);
      expect(res3.allowed).toBe(false);
      if (!res3.allowed) {
        expect(res3.reason).toBe("rate_limited");
      }
    });
  });

  describe("Fail-closed policy under Redis outage", () => {
    const policy: RateLimitPolicy = {
      name: "checkout-critical",
      failClosed: true,
      timeoutMs: 100,
      buckets: [{ name: "burst", limit: 10, windowSeconds: 60 }],
    };

    it("fails closed on Redis timeout", async () => {
      const store = new FakeRedisStore();
      store.shouldTimeout = true;
      const limiter = createRateLimiter({
        store,
        secret: testSecret,
        timeoutMs: 100,
      });

      const res = await limiter.check(policy, [
        { bucketName: "burst", dimension: "ip", identifier: "1.2.3.4" },
      ]);

      expect(res.allowed).toBe(false);
      if (!res.allowed) {
        expect(res.reason).toBe("limiter_unavailable");
        expect(res.retryAfterSeconds).toBeGreaterThanOrEqual(1);
      }
    });

    it("fails closed on transport/network error", async () => {
      const store = new FakeRedisStore();
      store.shouldThrow = true;
      const limiter = createRateLimiter({ store, secret: testSecret });

      const res = await limiter.check(policy, [
        { bucketName: "burst", dimension: "ip", identifier: "1.2.3.4" },
      ]);

      expect(res.allowed).toBe(false);
      if (!res.allowed) {
        expect(res.reason).toBe("limiter_unavailable");
      }
    });

    it("fails closed on malformed response", async () => {
      const store = new FakeRedisStore();
      store.returnMalformed = true;
      const limiter = createRateLimiter({ store, secret: testSecret });

      const res = await limiter.check(policy, [
        { bucketName: "burst", dimension: "ip", identifier: "1.2.3.4" },
      ]);

      expect(res.allowed).toBe(false);
      if (!res.allowed) {
        expect(res.reason).toBe("limiter_unavailable");
      }
    });
  });
});
