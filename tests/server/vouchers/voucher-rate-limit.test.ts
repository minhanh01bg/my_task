import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { env } from "@/config/env";
import {
  getPublicReceipt,
  setReceiptRateLimiter,
} from "@/server/orders/public-receipt";
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

describe("BL-5: khoá theo rateLimitClientId", () => {
  let originalProxyMode: unknown;

  beforeEach(() => {
    setVoucherRateLimiter(
      createRateLimiter({ store: new FakeStore(), secret: "v".repeat(32) }),
    );
    originalProxyMode = env.TRUSTED_PROXY_MODE;
    (env as Record<string, unknown>).TRUSTED_PROXY_MODE = "cloudflare";
  });

  afterEach(() => {
    setVoucherRateLimiter(null);
    (env as Record<string, unknown>).TRUSTED_PROXY_MODE = originalProxyMode;
  });

  function requestFrom(ip: string): Request {
    return new Request("https://example.com/api/online/vouchers/validate", {
      method: "POST",
      headers: { "cf-connecting-ip": ip },
    });
  }

  it("một host IPv6 không xoay địa chỉ trong /64 để có thêm lượt", async () => {
    for (let i = 1; i <= 30; i++) {
      expect(
        await checkVoucherRateLimit(requestFrom(`2001:db8:1:2::${i}`)),
      ).toBeNull();
    }
    expect(
      await checkVoucherRateLimit(requestFrom("2001:db8:1:2::ffff")),
    ).toBeGreaterThan(0);
  });

  it("IPv4 vẫn tính riêng từng địa chỉ", async () => {
    for (let i = 0; i < 30; i++) {
      expect(
        await checkVoucherRateLimit(requestFrom("203.0.113.7")),
      ).toBeNull();
    }
    expect(
      await checkVoucherRateLimit(requestFrom("203.0.113.7")),
    ).toBeGreaterThan(0);
    expect(await checkVoucherRateLimit(requestFrom("203.0.113.8"))).toBeNull();
  });
});

describe("BL-5: bộ đếm dò mã tách khỏi tra cứu biên nhận", () => {
  let store: FakeStore;
  let originalProxyMode: unknown;

  beforeEach(() => {
    // Cùng store và secret như một tiến trình thật: chỉ tên policy tách khoá.
    store = new FakeStore();
    setVoucherRateLimiter(createRateLimiter({ store, secret: "v".repeat(32) }));
    setReceiptRateLimiter(createRateLimiter({ store, secret: "v".repeat(32) }));
    originalProxyMode = env.TRUSTED_PROXY_MODE;
    (env as Record<string, unknown>).TRUSTED_PROXY_MODE = "cloudflare";
  });

  afterEach(() => {
    setVoucherRateLimiter(null);
    setReceiptRateLimiter(null);
    (env as Record<string, unknown>).TRUSTED_PROXY_MODE = originalProxyMode;
  });

  function requestFrom(ip: string): Request {
    return new Request("https://example.com/api/online/vouchers/validate", {
      method: "POST",
      headers: { "cf-connecting-ip": ip },
    });
  }

  it("dò hết lượt mã không chặn tra cứu biên nhận của cùng IP", async () => {
    for (let i = 0; i < 30; i++) {
      expect(
        await checkVoucherRateLimit(requestFrom("203.0.113.7")),
      ).toBeNull();
    }
    expect(
      await checkVoucherRateLimit(requestFrom("203.0.113.7")),
    ).toBeGreaterThan(0);
    expect(
      [...store.counts.keys()].every((key) =>
        key.startsWith("rl:v1:voucher-check:"),
      ),
    ).toBe(true);

    await expect(
      getPublicReceipt("a".repeat(64), requestFrom("203.0.113.7")),
    ).resolves.toBeNull();
  });
});
