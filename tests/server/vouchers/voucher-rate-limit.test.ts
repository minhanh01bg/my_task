import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { env } from "@/config/env";
import {
  createRateLimiter,
  type RateLimitStore,
} from "@/server/security/rate-limit";
import {
  checkVoucherRateLimit,
  setVoucherRateLimiter,
} from "@/server/vouchers/voucher-rate-limit";

class FakeStore implements RateLimitStore {
  public counts = new Map<string, number>();
  public shouldFail = false;

  async incrementAndGetTtl(
    key: string,
    windowSeconds: number,
  ): Promise<{ count: number; ttlSeconds: number }> {
    if (this.shouldFail) throw new Error("Redis failure");
    const count = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, count);
    return { count, ttlSeconds: windowSeconds };
  }
}

// Ở chế độ cloudflare, request thiếu cf-connecting-ip không xác định được IP.
function requestWithoutClientIp(): Request {
  return new Request("https://example.com/api/online/vouchers/validate", {
    method: "POST",
  });
}

describe("checkVoucherRateLimit khi không xác định được IP", () => {
  let store: FakeStore;
  let originalProxyMode: unknown;

  beforeEach(() => {
    store = new FakeStore();
    setVoucherRateLimiter(createRateLimiter({ store, secret: "v".repeat(32) }));
    originalProxyMode = env.TRUSTED_PROXY_MODE;
    (env as Record<string, unknown>).TRUSTED_PROXY_MODE = "cloudflare";
  });

  afterEach(() => {
    setVoucherRateLimiter(null);
    (env as Record<string, unknown>).TRUSTED_PROXY_MODE = originalProxyMode;
  });

  it("dùng chung một bucket dự phòng thay vì bỏ qua giới hạn", async () => {
    for (let i = 0; i < 150; i++) {
      expect(await checkVoucherRateLimit(requestWithoutClientIp())).toBeNull();
    }

    expect(
      await checkVoucherRateLimit(requestWithoutClientIp()),
    ).toBeGreaterThan(0);
    expect([...store.counts.keys()]).toEqual([
      expect.stringMatching(/^rl:v1:voucher-unresolved-ip:global-misses:/),
    ]);
  });

  it("fail-closed khi limiter lỗi", async () => {
    store.shouldFail = true;

    expect(
      await checkVoucherRateLimit(requestWithoutClientIp()),
    ).toBeGreaterThan(0);
  });
});
