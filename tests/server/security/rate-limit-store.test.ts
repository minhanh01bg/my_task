import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RateLimitPolicy } from "@/server/security/rate-limit-policy";

const redisMock = vi.hoisted(() => ({
  constructed: 0,
  evalCalls: 0,
  delCalls: 0,
}));

vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor() {
      redisMock.constructed += 1;
    }

    async eval(): Promise<[number, number]> {
      redisMock.evalCalls += 1;
      return [1, 60];
    }

    async del(): Promise<number> {
      redisMock.delCalls += 1;
      return 1;
    }
  },
}));

vi.mock("@/config/env", () => ({
  env: {
    UPSTASH_REDIS_REST_URL: "https://example-redis.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    RATE_LIMIT_KEY_SECRET: "k".repeat(32),
  },
}));

const policy: RateLimitPolicy = {
  name: "store-reuse",
  failClosed: true,
  buckets: [
    { name: "ip-burst", limit: 10, windowSeconds: 60 },
    { name: "subnet-burst", limit: 50, windowSeconds: 60 },
    { name: "global-burst", limit: 6000, windowSeconds: 60 },
  ],
};

const targets = [
  { bucketName: "ip-burst", dimension: "ip", identifier: "203.0.113.7" },
  {
    bucketName: "subnet-burst",
    dimension: "subnet",
    identifier: "203.0.113.0/24",
  },
  { bucketName: "global-burst", dimension: "global", identifier: "global" },
];

describe("Production Upstash store lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    redisMock.constructed = 0;
    redisMock.evalCalls = 0;
    redisMock.delCalls = 0;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates the Redis client once and reuses it across checks and limiters", async () => {
    const { createRateLimiter } = await import("@/server/security/rate-limit");
    const limiterA = createRateLimiter();
    const limiterB = createRateLimiter();

    expect(redisMock.constructed).toBe(0);

    for (let i = 0; i < 3; i++) {
      const decision = await limiterA.check(policy, targets);
      expect(decision.allowed).toBe(true);
    }
    await limiterB.check(policy, targets);
    await limiterB.reset?.(policy, targets[0]);

    expect(redisMock.constructed).toBe(1);
    expect(redisMock.evalCalls).toBe(12);
    expect(redisMock.delCalls).toBe(1);
  });
});
